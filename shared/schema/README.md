# shared/schema

Məzmun sxemi, JSON Schema (draft 2020-12). Frontend (Zod) və backend (Java, `networknt/json-schema-validator`) eyni sxemi paylaşır.
Qərar: [ADR-0005](../../docs/adr/0005-shared-schema.md).

> **Hazırda generasiya olunur.** Mənbə `src/domain/schema.ts` (Zod) və `src/domain/dataFiles.ts`-dir (fayl manifesti).
> Sxemi dəyişdikdən sonra `npm run schema:export` işlədin və nəticəni commit edin. `npm test` və backend CI
> uyğunsuzluğu tutur. Frontend generasiya olunmuş Zod-a keçəndə (mərhələ 14) bu fayllar əsas mənbə olacaq.

## Fayllar

| Fayl | Məzmun |
|---|---|
| `<Ad>.schema.json` | Bir sxem. `$id` = `https://tarixin-icinde.az/schema/v1/<Ad>.schema.json`. Bu yalnız identifikatordur, şəbəkədən yüklənmir: validatorlar bu prefiksi lokal fayllara bağlayır. Paylaşılan bloklar (`LocalizedText`, `HistoricalDate`, `LifeEvent`…) ayrıca fayldır və `$ref` ilə istinad olunur |
| `files.json` | `data/` altındakı hər fayl hansı sxemə uyğun olmalıdır (glob; `*` bir yol seqmenti daxilində) |
| `music-themes.json` | `Theme.musicThemeId` üçün icazəli dəyərlər (`src/features/audio/manifest.ts`-dən) |

Hər sxemdə `x-schema-version` var. Mövcud sənədləri etibarsız edən dəyişiklikdə `SCHEMA_VERSION` (`scripts/export-json-schema.ts`) artırılır. Redaksiya revision-ı hansı versiya ilə yazıldığını saxlayır.

## Semantika

- Sxemlər **giriş** formasını təsvir edir (`io: "input"`): JSON faylda necə yazılırsa, elə.
- Obyektlərdə naməlum açarlara icazə verilir (`additionalProperties` yoxdur), çünki Zod da onları rədd etmir. Redaksiyada naməlum açar ayrıca `WARNING` qaydası ilə göstəriləcək.
- Zod-un `z.url()`-i `format: "iri"` (RFC 3987) kimi yazılır, `uri` kimi yox: Zod ASCII olmayan ünvanları qəbul edir (məs. `…/wiki/Recep_Tayyip_Erdoğan`), ciddi `uri` (RFC 3986) isə onları rədd edərdi. Backend `format`-ı yoxlayır (yalnız annotasiya kimi saxlamır).

## JSON Schema ilə ifadə olunmayan qaydalar

Zod `.refine()` qaydaları JSON Schema-ya keçmir. Frontend-də onlar Zod-da qalır, backend-də isə validasiya qaydaları kimi təkrarlanır (`az.tarix.platform.editorial.internal.validation`, [ADR-0011](../../docs/adr/0011-editorial-content-layout.md)). Hər iki tərəf eyni nümunələrlə test olunur.

| Sxem | Qayda | Mesaj |
|---|---|---|
| `Claim` | `claimType = fact` → `sources` boş deyil | fakt mənbəsiz ola bilməz |
| `Claim` | `claimType = legend` → `firstRecorded` var | rəvayət üçün ilk qeyd (firstRecorded) lazımdır |
| `Claim` | `claimType = disputed` → `versions` ≥ 2 | mübahisəli iddia üçün ən azı iki versiya lazımdır |
| `Claim` | `claimType ∈ {disputed, legend}` → `why` var | mübahisəli və rəvayət iddiası üçün 'why' izahı lazımdır |
| `HistoricalDate` | `day` varsa, `month` da var | gün göstərilibsə, ay da göstərilməlidir |
| `Choice` | `historicalOptionIndex < options.length` | |
| `QuizQuestion` | `correctIndex < options.length` | |
| `NarrationCue` | `end > start` | |
| `AgePortrait` | `ageFrom ≤ ageTo` | |
| `BackgroundArt` | `kind ≠ placeholder` → `src` və `procedural`-dan **yalnız biri** | şəkildə ya src, ya da procedural olmalıdır |
| `BackgroundArt` | `kind = placeholder` → `promptId` var | |
| `Commemoration` | `day` həmin ayda mövcuddur (fevral: 29-a qədər) | belə gün yoxdur |
| `TerritorySnapshotSource` | hər dövlətdə `regions` və `iso`-dan **yalnız biri** | |

Fayllar arası qaydalar (referansların mövcudluğu, `order` ardıcıllığı, tarixin doğum–ölüm aralığında olması və s.) `scripts/validate-data.ts`-də və `src/domain/integrity.ts`-dədir. Backend-də onlar redaksiya validasiya hesabatının qaydalarıdır; mövcud `data/`-nın xətasız keçməsi `DocumentValidatorTests` ilə yoxlanılır.
