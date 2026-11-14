# 0019. Statik eksport: idxalın tərsi, sənədin mövqeyi, versiyalı bucket, debounce

Tarix: 2026-11-14 · Status: Qəbul

## Kontekst
BACKEND_SPEC.md §15 bunları tələb edir:
- dərcdən sonra (debounce ilə) bütün ictimai məzmun frontend-in `data/` formatında yazılsın;
- fayllar `public-content/v{content_version}/…` altına, yanında `latest.json` manifesti;
- ərazilər ayrıca fayllar kimi;
- eksport frontend sxemlərindən keçsin (test).

ADR-0006 eksportun `data/`-nı dəqiq təkrarlamasını tələb edir. ADR-0011 isə qeyd edir ki, `jsonb` sıranı saxlamır.

Bir neçə sənədin bölüşdüyü fayllardakı (`places.json`, `rulers.json`, `heroes.json`, `reigns.json`, `glossary.json`…) sıra əl ilə qurulub, əlifba sırası deyil. Məsələn, `reigns.json` dövlətlərə görə xüsusi sırada qruplaşıb. Frontend bu sıranı istifadə edir (siyahılar, lüğət). Redaksiya modeli isə bu sıranı saxlamırdı.

## Qərar

### Eksport = idxalın tərsi
- `ExportLayout` dərc olunmuş sənədlərin bölmələrini (ADR-0011) dəyişmədən fayllara qaytarır. Bu, `DataFolder`-in tərsidir.
- Yollar repo köküna nisbətəndir:
  - `data/…`;
  - qurulmuş poliqonlar `public/data/territories/{snapshot}.json`-dadır. Spesifikasiyadakı `territories/{slug}.geojson` əvəzinə frontend-in bugünkü yeri seçildi, ki eksport birbaşa repo yerinə qoyula bilsin.
- Ümumi fayllar boş olsa da yazılır (`planned.json` bu gün boşdur).
- `SOURCE` öz faylına çıxmır (ADR-0007). `territories/countries.json`, `land.json` (əsas xəritə) redaksiya məzmunu deyil və eksporta düşmür.
- JSON kompakt yazılır. Açarların sırası fərqli ola bilər, məzmun eynidir.

### Sənədin mövqeyi: `editorial_document.position` (V015)
- İdxal hər sənədə öz faylındakı yerini yazır:
  - ümumi faylda elementin indeksi;
  - şəxsiyyət üçün `relations.json`-da, dövlət üçün `reigns.json`-da onun ilk sətrinin indeksi.
- Bu, kontent dəyişikliyi deyil: revision yaranmır.
- Eksport sənədləri `position` (boşlar sonda), sonra yaradılma vaxtı, sonra slug üzrə düzür. CMS-də yaradılan yeni sənəd faylın sonuna düşür.
- `editorial.api.PublishedContents.allPublished()` hamısını bir sorğu ilə verir.

### Media
İctimai API ilə eyni qayda tətbiq olunur (ADR-0017): yalnız `GRANTED`/`NOT_REQUIRED`.

Dərcdən sonra icazəsi götürülmüş fayl sxemin icazə verdiyi yolla çıxarılır:
- yaş portreti yer tutucu olur (`src` silinir);
- könüllü şəkil (`portrait`, `image`, `emblem`, `photo`) silinir;
- siyahıdakı şəkil siyahıdan çıxır;
- icazəsiz trek ümumiyyətlə yazılmır.

`media:<id>` istinadı faylın ictimai URL-i ilə əvəz olunur, lisenziya da reyestrdən götürülür.

### Bucket və manifest
- Fayllar `v{content_version}/{path}`-ə yazılır, `Cache-Control: public, max-age=31536000, immutable`.
- `latest.json` (`no-cache`) ən sonda yazılır: `{contentVersion, prefix, generatedAt, fileCount, files[]}`. Oxuyan heç vaxt yarımçıq versiya görmür.
- `public-content` bucket-i anonim oxunur (SeaweedFS: `Read:public-content`).
- Köhnə versiyalar silinmir. Prod-da bucket lifecycle qaydası ilə təmizlənməlidir.

### Nə vaxt işləyir
- `ContentProjected` (hər dərc, arxiv, rebuild, media dəyişikliyi) eksportu gözləməyə qoyur.
- Son dəyişiklikdən 30 saniyə sonra eksport başlayır. Dəyişikliklər dayanmadan gəlsə belə, ən geci 5 dəqiqədən bir eksport olunur.
- Tətbiq başlayanda manifestin versiyası cari `content_version`-dan geridədirsə, eksport tamamlanır.
- Uğursuz eksport növbəti yoxlamada təkrarlanır.
- ADMIN: `POST /api/v1/admin/export` (dərhal).
- `platform.export.enabled=false` bucket olmayan mühitlər (testlər) üçündür.

## Nəticələr
- \+ Bugünkü data idxal olunub eksport ediləndə **eyni məzmunu və sıranı** verir. Fərq yalnız dərc oluna bilməyənlərdədir: icazəsi gözlənilən 2 trek və poliqonu etibarsız `y2020` snapshot-u (test bunu yoxlayır).
- \+ Eksport `shared/schema` ilə yoxlanılır (test). Diskə yazılmış eksport frontend-in öz yoxlayıcısından da keçirilə bilir: `npx tsx scripts/validate-data.ts backend/target/static-export/data`.
- − Bu yoxlayıcı bütövlük qaydalarını da işlədir. Bugünkü datada müharibə günləri dərc olunmamış `y2020` snapshot-una istinad edir. Bu, data problemidir (poliqon təmir olunmalıdır), eksportun xətası deyil.
- − Trek faylı "uzantısız yol" kimi gözlənilir (`.webm`/`.mp3`). Yüklənmiş səs isə uzantılı tam URL-dir. Frontend bunu mərhələ 14-də nəzərə almalıdır.
- − Hər eksport bütün faylları yazır (≈ 1–2 MB), yalnız dəyişənləri yox.
