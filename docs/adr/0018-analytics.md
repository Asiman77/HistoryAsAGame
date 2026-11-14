# 0018. Anonim öyrənmə analitikası: sahə siyahısı, partition-lar, toplama, hesabatlar

Tarix: 2026-11-14 · Status: Qəbul

## Kontekst
BACKEND_SPEC.md §12 bunları tələb edir:
- anonim event qəbulu (batch, ən çox 50);
- yalnız icazə verilmiş sahələr;
- IP saxlanılmasın;
- `session_id` hesabla bağlı olmasın;
- xam event-lər 12 aydan sonra silinsin;
- session və bağlantı üzrə limit;
- gecəlik `daily_aggregate`;
- üç hesabat: quiz çətinliyi, drop-off, sinif.

Spesifikasiya bunları demir: event-lərin dəqiq sahələri, gün sərhədi, gecikən event-lər, partition-ların idarəsi və hesabatların nəyə əsaslandığı. Frontend hələ event göndərmir. Quiz suallarının id-si yoxdur (addımda 1–3 sual var). Rejimlər `story` və `learn`-dir.

## Qərar

### Qəbul: `POST /api/v1/events`
- Gövdə: `{sessionId, classCode?, events: [{type, occurredAt?, ownerType?, ownerSlug?, stepKey?, questionIndex?, correct?, optionIndex?, mode?, durationMs?, targetType?, targetSlug?, shown?, year?}]}`. **Başqa sahə yoxdur:** naməlum sahə bütün sorğuya `400` verir. Bunun üçün ayrıca sərt mapper istifadə olunur, çünki Jackson 3-də annotasiya bunu məcbur etmir. Səhv göndərilən şəxsi məlumat ("email", "studentName") səssizcə atılmır, müştəri dərhal xəta görür.
- Hər tip yalnız öz sahələrini daşıya bilər (`EventRules`). Məsələn, `quiz_answered` → `questionIndex` + `correct`; `time_slider_used` → yalnız `year`. Başqa tipin sahəsi həmin event-i rədd edir. Pis event batch-dən atılır, qalanları saxlanılır. Cavab: `202 {accepted, rejected[{index, reason}], classCode}`.
- **Token oxunmur:** bu yol üçün `BearerTokenResolver` `null` qaytarır. Etibarlı token də, saxta token də nəzərə alınmır, ona görə event heç vaxt hesaba bağlanmır.
- `text/plain` da qəbul olunur: `navigator.sendBeacon` cross-origin sorğunu preflight-sız belə göndərir.
- Gövdə ən çox 64 KB-dır. Bu, JSON oxunmazdan əvvəl, servlet filtrində yoxlanılır. `Content-Length`-siz (chunked) gövdə ən çox limit qədər oxunur.
- Bilinməyən sinif kodu atılır, event-lər isə yenə sayılır.
- Müştəri saatına yalnız `[qəbul − 48 saat, qəbul + 5 dəq.]` aralığında etibar olunur. Bu aralıqdan kənar vaxt əvəzinə qəbul vaxtı yazılır.

### Məxfilik
- `learning_event`-də IP, user-agent və istifadəçi sütunu **yoxdur**. Test cədvəlin sütun siyahısını yoxlayır.
- Limit (Bucket4j, event sayı ilə): sessiya üzrə 600 / 10 dəq., ünvan üzrə 20 000 / 10 dəq. Ünvan limiti genişdir, çünki bütün məktəb bir NAT ünvanından çıxa bilər. Ünvan yalnız yaddaşdakı keşin açarıdır, ən çox bir limit müddəti qalır və heç yerə yazılmır.
- Tətbiq access log yazmır. Reverse proxy log yazarsa, `/api/v1/events` üçün IP orada maskalanmalıdır (deploy qeydi).
- Hesabatlar yalnız gündəlik cəmlərdən oxunur, xam event-lərdən yox. Onlarda sessiya id-si yoxdur.

### Saxlama: aylıq partition-lar
- `learning_event` `received_at` (server vaxtı) üzrə `RANGE` partition-lara bölünür (`learning_event_YYYY_MM`, UTC). Partition-ları `analytics_ensure_partitions(n)` yaradır: miqrasiyada, startup-da, hər gecə və lazım olsa sorğu zamanı, cari ay və sonrakı 2 ay üçün.
- Retention: `analytics_drop_partitions_before(cutoff)` tamamilə köhnəlmiş ayları silir (`DROP TABLE`, `format('%I')` ilə). Sərhəddəki aydan köhnə sətirlər isə `DELETE` ilə silinir. Cutoff = indi − 12 ay. `daily_aggregate`-ə toxunulmur.

### Toplama
- Gün `Asia/Baku` zonası ilə hesablanır (`platform.analytics.zone`).
- Hər gecə (02:15) son 3 gün **yenidən hesablanır**: event 48 saata qədər gec gələ bilər. Bir gün öz bütün event-lərindən hesablanır və `UNIQUE` açarla upsert olunur. Ona görə təkrar hesablama təhlükəsizdir.
- Açar: `(day, event_type, owner_type, owner_slug, step_key, class_code, detail)`. Boş dəyər `NULL` yox, `''`-dir, beləliklə adi `UNIQUE` kifayət edir.
- `detail` event-in nə haqqında olduğunu göstərir: `q0` (sual), `o2` (variant), `story`/`learn`, `battle:chaldiran` (keçid), `shown`/`hidden`, `1501` (il).
- Dəyərlər: `count`, `sessions` (həmin gün fərqli sessiyalar), `payload_stats` (`correct`/`wrong`, `durationMsSum`/`durationMsCount`).
- ADMIN istənilən günləri əl ilə yenidən hesablaya bilər: `POST /api/v1/admin/analytics/aggregate?from=&to=`.

### Hesabatlar (defolt: dünənə qədər son 30 gün, ən çox 366 gün)
- `GET /analytics/quiz-difficulty?minAnswers=10&limit=50` (ADMIN): suallar səhv cavab nisbətinə görə sıralanır. Az cavablı suallar `minAnswers` ilə kənarda qalır.
- `GET /analytics/drop-off?owner=person:<slug>` (ADMIN): başlanan/tamamlanan simulyasiyalar və addımlar üzrə `views` (günlük sessiyaların cəmi), `abandoned`, `abandonRate`.
- `GET /analytics/classes/{code}` (TEACHER): yalnız öz sinfi. Başqasının sinfi və mövcud olmayan sinif eyni `404` cavabını verir. Hesabatda simulyasiyalar, sual üzrə doğru/səhv və tərk edilən addımlar var. Şagird adı yoxdur, çünki şagird hesabı da yoxdur.

## Nəticələr
- \+ Şəxsi məlumatı saxlamaq üçün sütun yoxdur. Göndərilsə belə, sorğu rədd olunur.
- \+ Köhnə data bir `DROP TABLE` ilə silinir, böyük `DELETE` və vakuum lazım olmur.
- \+ Hesabatlar retention-dan sonra da işləyir.
- − Bu günün rəqəmləri ertəsi gecəyə qədər hesabatda görünmür (və ya ADMIN əl ilə hesablamalıdır).
- − `views` günlük fərqli sessiyaların cəmidir: bir sessiya gecə yarısını keçsə, iki dəfə sayılır.
- − Limitlər bir instansiyanın yaddaşındadır (login limiti kimi, ADR-0016).
- Frontend inteqrasiyası (event-lərin göndərilməsi) mərhələ 14-də edilir.
