# 0016. Təhlükəsizliyin qalanı: login limiti, CORS, sinif kodları, icazə matrisi, asılılıq yoxlaması

Tarix: 2026-11-14 · Status: Qəbul

## Kontekst
BACKEND_SPEC.md §13 login-də rate limiting, yalnız konfiqurasiya olunmuş domenlər üçün CORS, təhlükəsizlik başlıqları və CI-da asılılıqların zəiflik yoxlamasını tələb edir. §7.3 və §12 TEACHER rolunu və `class_group`-u tələb edir. Spesifikasiya limitin harada saxlanacağını, müştəri ünvanının necə təyin olunacağını, sinif kodunun formatını və yoxlamanın hansı həddə build-i dayandıracağını demir.

## Qərar

### Login limiti: yaddaşda, bloklamadan, şifrədən əvvəl
- Bucket4j: iki vedrə — müştəri ünvanı (20/dəq.) və hesab (e-poçt, 10/15 dəq.). Hər ikisi `platform.identity.login-limit.*` ilə dəyişir.
- Limit Argon2-dən **əvvəl** yoxlanır: limitə düşən cəhd CPU sərf etmir.
- Hesab **bloklanmır**, yalnız yavaşıdılır. Bloklama hücumçuya real istifadəçini kənarlaşdırmaq imkanı verərdi.
- Cavab: `429` Problem Details + `Retry-After` (tam saniyə).
- Vedrələr yaddaşdadır (ən çox 100 000 açar, LRU). Bir instansiya üçün kifayətdir. Bir neçə instansiya olanda Bucket4j-nin PostgreSQL backend-inə keçmək lazımdır (kod `LoginRateLimiter`-də bir yerdədir).
- Öz şifrəsini dəyişmə (`POST /auth/password`) eyni limitdən keçir: oğurlanmış token ilə şifrə təxmin etmək olmasın.

### Müştəri ünvanı: `getRemoteAddr()`, proxy başlıqlarına etibar yoxdur
`X-Forwarded-For` istənilən müştəri tərəfindən yazıla bilər. Ona etibar etsək, hər cəhddə yeni ünvan yazmaqla ünvan limitindən qaçmaq olar. Hazırda backend birbaşa açılır (compose: `127.0.0.1:8080`). Reverse proxy əlavə olunanda `server.forward-headers-strategy=native` və etibarlı proxy ünvanları birlikdə qurulmalıdır, əks halda bütün istifadəçilər proxy-nin bir ünvanını bölüşəcək.

### CORS: dəqiq origin-lər, credentials yoxdur
- `CORS_ALLOWED_ORIGINS`: vergüllə, `scheme://host[:port]`, `*` qadağandır; səhv yazılış startup-ı dayandırır. Boş: heç bir brauzer origin-i.
- Token-lər `Authorization` başlığındadır, cookie yoxdur, ona görə `allowCredentials=false` və CSRF söndürülüb.
- `local` profili Next.js dev serverinə (`http://localhost:3000`) icazə verir.

### Başlıqlar
API-nin hər cavabı: `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `X-Frame-Options: DENY`, `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'`. Swagger UI üçün ayrıca, işləyə biləcəyi siyasət (öz skriptləri, inline stillər, `data:` ikonlar).

### Sinif kodu
- 6 simvol, oxşar hərflər olmadan (`0/O`, `1/I/L` yoxdur): 31⁶ ≈ 887 mln. Sinifdə səslə oxumaq asandır, kiçik hərflə də qəbul olunur.
- Başqa müəllimin sinfi `404` qaytarır, mövcud olmayan kimi: kodları yoxlayıb tapmaq olmur.
- Şagird hesabı yoxdur; kod analitika hadisələrinə qoşulur (mərhələ 12). `identity.api.ClassGroups` müəllimə yalnız öz siniflərini oxumağa imkan verəcək.

### İcazə matrisi testdir, sənəd deyil
`PermissionMatrixTests` hər qeyri-ictimai endpoint-i hər rola və anonim istifadəçiyə qarşı yoxlayır (401/403 Problem Details tipinə görə, biznes 401-i ilə qarışmır). Matrisdə olmayan yeni endpoint testi sındırır, `@PublicApi` controller-lərdə yalnız `GET` ola bilər. Beləliklə yeni endpoint qaydasız buraxıla bilməz.

### Asılılıq yoxlaması: OWASP Dependency-Check, ayrıca workflow
- `dependency-check-maven` pom-dadır, amma heç bir fazaya bağlı deyil: `./mvnw dependency-check:check`. Adi `verify` NVD bazasını yükləmir.
- `.github/workflows/backend-dependencies.yml`: `pom.xml` dəyişəndə və hər bazar ertəsi (yeni CVE-lər kod dəyişmədən çıxır). NVD bazası `actions/cache` ilə saxlanılır, hesabat artifact kimi yüklənir.
- CVSS ≥ 7 build-i dayandırır. Daha aşağılar hesabatda görünür.
- Yanlış pozitivlər `backend/dependency-check-suppressions.xml`-də, hər biri səbəb və `until` tarixi ilə; istifadə olunmayan qayda build-i sındırır.
- Yalnız Java analizatorları: backend-də JS/.NET yoxdur; Sonatype OSS Index hesab tələb edir.
- **NVD API açarı məcburidir** (`NVD_API_KEY` repo secret-i, pulsuz). 2026-11-14-də yoxlandı: 13.0.0 açar verilməyəndə boş açar göndərir və NVD onu rədd edir (`Invalid apiKey`); 12.2.2 açarsız başlayır, amma NVD açarsız yükləməni `503` ilə kəsir. Açar pom-da yoxdur, `-DnvdApiKey` ilə ötürülür; secret yoxdursa workflow aydın xəta ilə dayanır.

## Nəticələr
- \+ Spesifikasiyanın §13 bəndləri bağlandı və testlə qorunur.
- − Limit yaddaşdadır: restart onu sıfırlayır, bir neçə instansiyada paylaşılmır.
- − Proxy arxasında ünvan limiti əlavə konfiqurasiya tələb edir.
- − Dependency-Check NVD-dən asılıdır; NVD əlçatmaz olanda workflow düşür (keş köməkdir).
