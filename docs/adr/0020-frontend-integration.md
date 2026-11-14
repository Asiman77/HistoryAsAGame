# 0020. Frontend inteqrasiyası: `api` rejimi statik eksportdan oxuyur, OpenAPI tipləri, analitika klienti

Tarix: 2026-11-14 · Status: Qəbul (ADR-0006-nın "Frontend `ApiRepository`" bəndini əvəz edir)

## Kontekst
BACKEND_SPEC.md §17 bunları tələb edir:
- `springdoc` ilə `openapi.json` generasiya olunsun, frontend-də ondan tiplər və klient alınsın;
- yeni `ApiRepository` implementasiyası olsun, `NEXT_PUBLIC_DATA_SOURCE=static|api` ilə seçilsin;
- UI komponentləri dəyişməsin.

ADR-0006 `ApiRepository`-nin ictimai API-dən `?lang=all` ilə oxuyub DTO-ları domen tiplərinə map etməsini nəzərdə tuturdu. Amma:
- `HistoryRepository` bugünkü `data/` tiplərini qaytarır (Person, LifeEvent, quiz, choice, narration…);
- ictimai API-nin forması fərqlidir (böyük hərfli enum-lar, `stepKey`, bəzi sahələr `details` içində);
- belə bir mapper Java-dakı eksport mapper-inin TypeScript təkrarı olardı və itkili ola bilərdi;
- statik eksport (ADR-0019) isə məhz `data/` formatıdır və test ilə Zod-dan keçir.

Analitika (ADR-0018) frontend-dən event tələb edir, frontend isə hələ heç nə göndərmir.

## Qərar (2026-11-14, istifadəçi ilə razılaşdırılıb)

### `api` rejimi = backend-in dərc olunmuş eksportu
- `npm run build:api` addımları:
  1. `scripts/pull-content.ts` eksportu `CONTENT_URL`-dən (`latest.json` → `v{N}/…`) və ya `CONTENT_DIR`-dən (diskdəki eksport) `.content/data`-ya çəkir.
  2. Qurulmuş poliqonlar həm `.content/public/data/territories`-ə (build zamanı istifadə üçün), həm də `public/data/territories`-ə (brauzer üçün; generasiya olunan, gitignore-da) yazılır.
  3. `next build` işləyir.
- `src/data/index.ts`: `NEXT_PUBLIC_DATA_SOURCE=api` olanda eyni `FileSystemRepository` `.content/data` kökü ilə yaradılır. Mapping yoxdur, UI və repository kodu dəyişmir. Data parse zamanı yenə Zod-dan keçir.
- Yalnız eksport yolları qəbul olunur (`data/…`, `public/data/territories/…`, `.json`, `..` qadağan).
- İctimai API (ADR-0014) mobil tətbiq və digər istehlakçılar üçün qalır.

### OpenAPI → TypeScript tipləri
- Backend testi (`OpenApiExportTests`) `/v3/api-docs/public`-u açarları sıralanmış şəkildə `shared/openapi/public.json`-a yazır. CI onun commit olunduğunu yoxlayır (`docs/modules` kimi).
- `npm run api:types` (`openapi-typescript` 7.13) → `src/data/api/openapi.ts`. Frontend testi generasiya olunan faylın aktual olduğunu yoxlayır.
- `POST /api/v1/events` tipli sənədləşdirildi (`EventBatch`, `IncomingEvent`, `Result`). Analitika klienti bu tipləri istifadə edir.

### Analitika klienti (`src/lib/analytics`)
- Yalnız `NEXT_PUBLIC_ANALYTICS_URL` verilib, brauzer isə DNT/GPC siqnalı göndərmirsə işləyir.
- Sessiya id-si `crypto.randomUUID()`-dir, yalnız həmin tab üçün saxlanılır (`sessionStorage`). Sinif kodu yalnız `?class=KOD` linki ilə gəlir.
- Event-lər batch-lərlə göndərilir: 50-yə çatanda və ya 10 saniyədən bir, səhifə gizlənəndə və bağlananda. Göndərmə `sendBeacon` ilə, `text/plain` formatında olur, ona görə CORS preflight lazım deyil.
- Görünməyən çağırışlar (UI dəyişmir):
  - `SimulationEngine`: `simulation_started`, `step_viewed`, `simulation_completed` (müddətlə), `simulation_abandoned` (səhifə bağlananda və ya simulyasiyadan çıxanda), `choice_made`, `mode_switched`;
  - `Quiz`: `quiz_answered`. Bunun üçün quiz sualları addımını və sırasını saxlayır (`quizOf`);
  - `RelatedLinks`: `cross_link_followed`;
  - `SettingsPanel`: `legend_toggle`;
  - `TimeExplorer`: `time_slider_used` (sürgü 1,5 saniyə dayananda).
  Simulyasiya və addım bilgisi `AnalyticsOwnerProvider` kontekstindən gəlir.

### Bu mərhələdə edilməyənlər
- Zod sxemlərinin `shared/schema`-dan generasiyası (ADR-0005 addım 3) ayrıca mərhələyə qaldı.

## Nəticələr
- \+ Eksportdan build olunan sayt `data/`-dan build olunanla müqayisə edildi: 541 səhifə faylı (HTML markup + RSC data, açar sırasından asılı olmadan). `y2020` müvəqqəti əlavə ediləndə yeganə real fərq `pendingTracks: 2 → 0` qaldı (icazəsi gözlənilən treklər dərc olunmur). Qalanları Next-in stream/meta sırasıdır.
- \+ Frontend tipləri API dəyişəndə köhnəlmir (iki drift yoxlaması).
- − `api` build-i backend-in əlçatan eksportunu tələb edir. Defolt (`static`) build dəyişməyib.
- − Hazırkı data ilə `api` build-də 2020 müharibəsinin günləri sərhədsiz göstərilir, çünki `y2020` dərc olunmayıb (data qeydi, ADR-0019).
- − Yüklənmiş səs faylı (`media:<id>` → uzantılı URL) frontend-in "uzantısız yol" gözləntisinə uyğun deyil. Hələ heç bir trek dərc olunmayıb, ona görə bu hələ problem deyil.
