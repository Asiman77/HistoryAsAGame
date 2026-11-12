# Arxitektura

> Mənbə: [`BACKEND_SPEC.md`](BACKEND_SPEC.md). Ondan fərqlər: [`adr/`](adr/README.md).
> Bu sənəd hər mərhələdə yenilənir. Son yeniləmə: mərhələ 5 (redaksiya).

## 1. Ümumi görünüş

```
                 ┌──────────── backend (Spring Boot 4.1, Java 25, modular monolit) ─────────────┐
 Redaktor ─JWT─► │ editorial ──ContentPublished──► publishing ──► catalog / geo / chronology /    │
                 │    ▲                               │            theming / media (proyeksiya)   │
                 │ identity                    ContentProjected          │                        │
                 │                                   ▼                    ▼                        │
                 │                              export (S3)         İctimai API (GET, ETag, cache) │ ◄── Next.js build (ApiRepository)
 Şagird ───────► │ analytics (POST /events, anonim)                                                │ ◄── mobil, digər istehlakçılar
                 └───────────────────────────────────────────────────────────────────────────────┘
                        PostgreSQL 18 + PostGIS 3.7 + pg_trgm          S3 (lokalda SeaweedFS)
```

Frontend (repo kökü, Next.js `output: "export"`) bu gün `data/`-dan oxuyur və backend hazır olana qədər belə qalır (ADR-0004, ADR-0006).

## 2. Modullar və sərhədlər

Paket: `az.tarix.platform.<modul>`. Hər modulda `api/` (açıq) və `internal/` (gizli). Spring Modulith `verify()` bunu məcbur edir.

| Modul | Məsuliyyət | Asılı olduğu modullar (`api`) | Atdığı event-lər | Dinlədiyi event-lər |
|---|---|---|---|---|
| `shared` | `HistoricalDate`, `LocalizedText`, `EntityRef`, enum-lar, slug, Problem Details, `ContentVersion` oxuyucusu | — | — | — |
| `identity` | istifadəçilər, rollar, JWT, refresh, sinif qrupları | shared | — | — |
| `editorial` | sənəd, revision, status maşını, validasiya, diff, şərhlər | shared, identity, media (lisenziya yoxlaması), catalog/geo/chronology (referans mövcudluğu — oxuma API-si) | `ContentPublished`, `ContentArchived` | — |
| `publishing` | proyektorların orkestrasiyası, `content_version`, rebuild, statik eksport | shared, editorial (revision oxuma), catalog/geo/chronology/theming/media (`*ProjectionWriter`) | `ContentProjected` | `ContentPublished`, `ContentArchived`, `ContentProjected` (eksport) |
| `catalog` | şəxsiyyət, müharibə, döyüş, dövlət, qəhrəman, addımlar, iddialar, mənbələr, əlaqələr, lüğət, xatirə günləri, dünya hadisələri | shared, geo (yaxın məkan) | — | `ContentProjected` (cache) |
| `geo` | məkanlar, ərazi snapshot-ları, nöqtə→dövlət | shared | — | `ContentProjected` (cache) |
| `chronology` | dövrlər, dövlətlər (polity), hökmdarlar, hakimiyyətlər | shared | — | `ContentProjected` (cache) |
| `theming` | temalar (variant birləşməsi ilə) | shared | — | `ContentProjected` (cache) |
| `media` | media reyestri, presigned yükləmə, portretlər, treklər | shared, identity | — | `ContentProjected` (cache) |
| `analytics` | anonim event qəbulu, toplama, hesabatlar | shared, identity | — | — |

`/timeline`, `/compare`, `/search`, `/places/{slug}/timeline` kimi çox modullu oxuma sorğuları `catalog` modulunda yaşayır və `geo`/`chronology`-nin `api` sorğu interfeyslərini çağırır (tək istiqamət: `catalog → geo, chronology`; əksinə asılılıq yoxdur).

Event-lər Spring Modulith JDBC event publication registry-də saxlanılır (`event_publication` cədvəli); tamamlanmamış event-lər tətbiq yenidən başlayanda və planlı job ilə təkrar işlənir.

## 3. ER modeli

Konvensiyalar:
- `HD(x)` = `HistoricalDate` sütunları: `x_year int`, `x_month smallint`, `x_day smallint`, `x_precision varchar(8)`, `x_certainty varchar(16)`, `x_sort_key bigint`, `x_alternatives jsonb`, `x_note jsonb`.
- `LT` = `LocalizedText` JSONB (`{"az": ..., "en": ..., "ru": ...}`, `az` məcburi, `CHECK (x ? 'az')`).
- Proyeksiya cədvəllərinin hamısında `document_id uuid NOT NULL` + `INDEX (document_id)`.
- FK yalnız **eyni sənədin** sətirləri arasındadır (`reign → polity`, `step_claim → simulation_step`). Başqa sənədə (hətta eyni modulda) slug ilə istinad olunur: dərc sənədin sətirlərini silib yenidən yazır, sənədlər arası FK isə ya silinməni bloklayar, ya da cascade ilə başqa sənədin datasını silərdi. İstisna: `media_asset` (sənədə bağlı deyil).
- Bütün PK-lar `uuid DEFAULT uuidv7()` (PostgreSQL 18), analytics istisna. `*_sort_key` sütunları `GENERATED ALWAYS … STORED`-dir.

### editorial
| Cədvəl | Sütunlar | İndekslər / məhdudiyyətlər |
|---|---|---|
| `editorial_document` | `id`, `doc_type`, `slug`, `status`, `current_revision_id`, `published_revision_id`, `created_by`, `created_at`, `updated_at`, `version` | `UNIQUE (doc_type, slug)`, `INDEX (status, doc_type)` |
| `editorial_revision` | `id`, `document_id → editorial_document`, `revision_no`, `schema_version`, `content jsonb`, `content_hash bytea`, `author_id`, `change_note`, `created_at` | `UNIQUE (document_id, revision_no)` |
| `review_comment` | `id`, `revision_id → editorial_revision`, `field_path`, `body`, `author_id`, `resolved`, `created_at` | `INDEX (revision_id)` |
| `status_transition_log` | `id`, `document_id`, `from_status`, `to_status`, `actor_id`, `comment`, `created_at` | `INDEX (document_id, created_at)` |
| `slug_redirect` | `doc_type`, `old_slug`, `new_slug` | `PK (doc_type, old_slug)` |
| `content_version` | `id smallint = 1`, `value bigint` | tək sətir |

`content_hash` (spesifikasiyaya əlavə): idxalın idempotentliyi üçün kanonik JSON-un SHA-256-sı.

### chronology
| Cədvəl | Sütunlar | İndekslər |
|---|---|---|
| `era` | `id`, `slug`, `name LT`, `start_year`, `end_year`, `description LT`, `theme_slug`, `sort_order` | `UNIQUE (slug)`, `INDEX (start_year, end_year)` |
| `polity` | `id`, `slug`, `name LT`, `short_name LT`, `color`, `emblem_media_id`, `start_year`, `end_year` (periodlardan törəmə), `state_slug`, `description LT` | `UNIQUE (slug)` |
| `polity_period` | `id`, `polity_id → polity`, `from_year`, `to_year` | `INDEX (polity_id, from_year, to_year)` |
| `polity_fact` | `id`, `polity_id → polity`, `from_year`, `to_year`, `status`, `status_note LT`, `religion LT`, `languages LT`, `rivals text[]`, `allies text[]`, `sources jsonb` | `INDEX (polity_id, from_year, to_year)` |
| `ruler` | `id`, `slug`, `name LT`, `titles jsonb`, `dynasty LT`, `HD(birth)`, `HD(death)`, `person_slug`, `related jsonb`, `sources jsonb` | `UNIQUE (slug)`, trigram `az_fold(name->>'az')` |
| `reign` | `id`, `polity_id → polity`, `ruler_slug`, `start_year`, `start_month`, `end_year`, `end_month`, `certainty`, `note LT` | `INDEX (polity_id, start_year, end_year)` — üst-üstə düşmə icazəlidir |

### geo
| Cədvəl | Sütunlar | İndekslər |
|---|---|---|
| `place` | `id`, `slug`, `historical_name LT`, `modern_name LT`, `place_type`, `location geometry(Point,4326)`, `importance smallint`, `description LT`, `sources jsonb` | `UNIQUE (slug)`, `GIST (location)`, `GIN (az_fold(historical_name->>'az') gin_trgm_ops)`, eyni `modern_name` üçün |
| `place_period` | `id`, `place_id → place`, `from_year`, `to_year`, `name LT` | `INDEX (place_id)` |
| `place_upcoming` | `id`, `place_id → place`, `year`, `title LT`, `ref jsonb`, `sources jsonb` | `INDEX (place_id)` |
| `territory_snapshot` | `id`, `slug`, `year`, `valid_from_year`, `valid_to_year NULL`, `title LT`, `certainty`, `note LT`, `sources jsonb` | `UNIQUE (slug)`, `INDEX (valid_from_year, valid_to_year)` |
| `polity_territory` | `id`, `snapshot_id → territory_snapshot`, `polity_slug`, `name LT`, `color`, `geometry geometry(MultiPolygon,4326)`, `geometry_simplified geometry(MultiPolygon,4326)`, `capital_place_slug`, `vassal_of_slug`, `label_at geometry(Point,4326)`, `area_km2`, `certainty` | `GIST (geometry)`, `GIST (geometry_simplified)`, `INDEX (snapshot_id)` |

### catalog
| Cədvəl | Sütunlar | İndekslər |
|---|---|---|
| `person` | `id`, `slug`, `name LT`, `short_name LT`, `titles jsonb`, `HD(birth)`, `HD(death)`, `birth_location jsonb`, `death_location jsonb`, `birth_place_slug`, `death_place_slug`, `short_bio LT`, `legacy LT`, `epigraph jsonb`, `era_slugs text[]`, `tags text[]`, `theme_slug`, `featured_order` | `UNIQUE (slug)`, `INDEX (birth_year, death_year)`, `GIN (era_slugs)`, trigram ad |
| `conflict` | `id`, `slug`, `name LT`, `display_title LT` (`heading`), `years`, `HD(start)`, `HD(end)` (günlərdən), `summary LT`, `legacy LT`, `intro_date LT`, `final_notes jsonb`, `era_slugs text[]`, `theme_slug`, `sources jsonb` | `UNIQUE (slug)` |
| `settlement` | `id`, `conflict_id → conflict`, `slug`, `name LT`, `district LT`, `kind`, `location geometry(Point) NULL` | `UNIQUE (conflict_id, slug)`, `GIST (location)` |
| `commander` | `id`, `conflict_id → conflict`, `slug`, `name LT`, `position LT`, `role LT`, `step_keys text[]`, `sources jsonb` | `UNIQUE (conflict_id, slug)` |
| `battle` | `id`, `slug`, `name LT`, `conflict_slug`, `step_key`, `dates`, `HD(date) NULL`, `place_slug NULL`, `summary LT`, `sides/commanders/forces/outcome/significance jsonb NULL`, `sources jsonb` | `UNIQUE (slug)` |
| `state_profile` | `id`, `slug`, `polity_slug`, `name LT`, `years`, `start_year`, `end_year`, `summary LT`, `legacy LT`, `image jsonb`, `era_slugs text[]`, `dynasty text[]`, `theme_slug`, `sources jsonb` | `UNIQUE (slug)` |
| `hero` | `id`, `slug`, `conflict_slug`, `full_name LT`, `rank LT`, `posthumous`, `birth_place LT`, `birth_year NULL`, `HD(death) NULL`, `awards jsonb`, `bio LT`, `photo_media_id NULL`, `is_real_modern_person` | `UNIQUE (slug)`, trigram ad |
| `simulation_step` | `id`, `owner_type`, `owner_slug`, `step_key`, `sequence`, `step_kind`, `HD(date)`, `title LT`, `factual_summary LT`, `narrative LT`, `mood`, `claim_type`, `location_name LT`, `location_modern_name LT`, `location_point geometry(Point)`, `location_approximate`, `location_place_slug`, `from_location_*` (eyni), `route geometry(LineString)`, `territory_snapshot_slug`, `theme_slug`, `age_at_event`, `details jsonb` | `UNIQUE (owner_type, owner_slug, step_key)`, `UNIQUE (owner_type, owner_slug, sequence)`, `INDEX (date_sort_key)`, `INDEX (date_month, date_day) WHERE date_precision='DAY'`, `INDEX (location_place_slug)`, `GIST (location_point)`, `GIST (route)` |
| `step_claim` | `id`, `step_id → simulation_step`, `claim_key`, `claim_type`, `text LT`, `why LT`, `versions jsonb`, `first_recorded jsonb`, `sort_order` | `UNIQUE (step_id, claim_key)` |
| `source` | `id`, `slug` (hash-dan), `title`, `authors`, `url`, `source_type`, `reliability_note LT`, `content_hash` | `UNIQUE (content_hash)` — paylaşılan, `document_id` yoxdur; istinadsız qalanlar dərcdən sonra təmizlənir |
| `step_source` | `step_id → simulation_step`, `source_id → source`, `locator`, `sort_order` | `PK (step_id, source_id, sort_order)` |
| `claim_source` | `claim_id → step_claim`, `source_id → source`, `locator`, `sort_order` | eyni |
| `entity_relation` | `id`, `source_type`, `source_slug`, `source_step_key`, `target_type`, `target_slug`, `target_step_key`, `relation_type`, `label LT`, `note LT`, `sources jsonb` | `INDEX (source_type, source_slug)`, `INDEX (target_type, target_slug)` |
| `glossary_entry` | `id`, `slug`, `term LT`, `definition LT`, `forms text[]`, `sources jsonb` | `UNIQUE (slug)` |
| `commemoration` | `id`, `slug`, `month`, `day`, `style`, `title LT`, `description LT`, `ref jsonb`, `sources jsonb` | `INDEX (month, day)` |
| `world_event` | `id`, `slug`, `year`, `end_year`, `region`, `title LT`, `description LT`, `sources jsonb` | `INDEX (year, end_year)` |
| `planned_entity` | `id`, `entity_type`, `slug`, `title LT`, `description LT`, `years` | `UNIQUE (entity_type, slug)` |

### theming
| `theme` | `id`, `slug`, `name LT`, `extends_slug`, `raw jsonb` (sənəddəki kimi), `palette`, `fonts`, `textures`, `ornaments`, `background_art`, `mood_overrides jsonb` (birləşdirilmiş), `ambient_effect`, `map_style_variant`, `music_theme_slug` | `UNIQUE (slug)` |
|---|---|---|

### media
| Cədvəl | Sütunlar | İndekslər |
|---|---|---|
| `media_asset` | spesifikasiyadakı kimi + `checksum` | `INDEX (permission_status)`, `UNIQUE (storage_key)` |
| `portrait` | `id`, `owner_type`, `owner_slug`, `age_from`, `age_to`, `media_id NULL`, `kind`, `alt LT`, `caption LT`, `prompt_id`, `sort_order`, `document_id` | `INDEX (owner_type, owner_slug)` |
| `soundtrack_track` | `id`, `slug`, `conflict_slug`, `title LT`, `performer`, `media_id NULL`, `moods text[]`, `license`, `permission_status`, `rights_holder`, `document_id` | `UNIQUE (slug)`, `GIN (moods)` |

### identity
`app_user`, `user_role`, `refresh_token` (+ `family_id` — təkrar istifadədə bütün ailəni ləğv etmək üçün), `class_group` — spesifikasiyadakı kimi.

### analytics
`learning_event` (aylıq `RANGE` partition-lar, partition-ları planlı job yaradır), `daily_aggregate (day, event_type, owner_type, owner_slug, step_key, class_code, count, payload_stats jsonb)` — `UNIQUE` toplama açarı ilə upsert.

## 4. Mərhələ planı

[ADR-0009](adr/0009-phase-order.md)-a bax. Hər mərhələnin sonunda bu sənəd yenilənir.

## 5. Mərhələ vəziyyəti

| # | Mərhələ | Vəziyyət |
|---|---|---|
| 0 | Plan | ✅ |
| 1 | Skelet | ✅ |
| 2 | Paylaşılan sxem | ✅ |
| 3 | Ümumi tiplər + proyeksiya cədvəlləri | ✅ |
| 4 | Identity (minimal) | ✅ |
| 5 | Redaksiya | ✅ |
| 6 | Dərc + proyektorlar | növbəti |

## 6. İş mühiti (mərhələ 1)

| Hissə | Versiya | Qeyd |
|---|---|---|
| Java | 25 (Temurin) | LTS |
| Spring Boot | 4.1.2 | Web MVC, virtual thread-lər aktiv |
| Spring Modulith | 2.1.2 | JDBC event registry (`event_publication` + `_archive`, completion mode `archive`), `verify()` + `Documenter` → [`docs/modules/`](modules/) |
| PostgreSQL / PostGIS | 18 / 3.7 | `postgis/postgis:18-3.7`; Testcontainers eyni image-i istifadə edir |
| S3 | SeaweedFS 4.50 | ADR-0008 |
| Flyway | Boot BOM | `V001__extensions`, `V002__event_publication` |

- Konfiqurasiya: `application.yml` (ümumi), `application-local.yml`, `application-prod.yml` (yalnız `health` ictimai). Datasource yalnız mühit dəyişənlərindən (`SPRING_DATASOURCE_*`).
- Loglar: `local`/`prod`-da ECS JSON; hər sorğuda `requestId` (MDC + `X-Request-Id` cavab başlığı, `shared.web.RequestIdFilter`).
- Modul sərhədləri `package-info.java`-dakı `allowedDependencies` ilə məcbur edilir; hər modulun `api` paketi `@NamedInterface("api")`-dir.
- Modulith observability modul bean-larını CGLIB proxy-yə bükür: `final` metodlu baza siniflərindən (məs. `GenericFilterBean`) törəyən bean-lar işləmir — birbaşa interfeys (`jakarta.servlet.Filter`) istifadə edin.
- CI: [`.github/workflows/backend.yml`](../.github/workflows/backend.yml) — `./mvnw verify`, modul sənədlərinin aktual olması, compose faylının validasiyası, image build.

## 7. Paylaşılan sxem (mərhələ 2)

```
src/domain/schema.ts (Zod) ─┐
src/domain/dataFiles.ts ────┴─► npm run schema:export ─► shared/schema/*.json ─┬─► backend classpath:schema/ (ContentSchemas)
  (fayl manifesti)                                                              └─► frontend: npm test (drift testi)
```

- 59 sxem (`<Ad>.schema.json`, draft 2020-12, paylaşılan bloklar `$ref` ilə) + `files.json` (data faylı → sxem) + `music-themes.json`. Ətraflı: [`shared/schema/README.md`](../shared/schema/README.md).
- Backend: `shared.schema.ContentSchemas` (networknt `json-schema-validator` 3.0.8, Jackson 3). `$id` prefiksi classpath-a bağlanır, şəbəkə istifadə olunmur; `format` yoxlanılır; xəta yolları JSON Pointer-dir (`review_comment.field_path` ilə eyni format).
- Docker build `shared/schema`-nı əlavə build context (`shared-schema`) kimi alır.
- Yoxlamalar: frontend `tests/unit/sharedSchema.test.ts` (sxem Zod ilə eynidir, hər data faylı tam bir sxemə düşür); backend `ContentSchemasTests` (hər `data/` faylı JSON Schema-dan keçir + mənfi hallar).
- `.refine()` qaydaları JSON Schema-ya keçmir; siyahısı `shared/schema/README.md`-dədir, backend-də mərhələ 5-də qayda kimi yazılacaq.

## 8. Ümumi tiplər və proyeksiya sxemi (mərhələ 3)

**Migrasiyalar** (`backend/src/main/resources/db/migration`):

| Fayl | Məzmun |
|---|---|
| `V003__shared_functions` | `az_fold`, `is_slug`, `is_localized_text`, `is_calendar_day`, `is_historical_date`, `historical_sort_key` |
| `V004__chronology` | `era`, `polity`, `polity_period`, `polity_fact`, `ruler`, `reign` |
| `V005__geo` | `place`, `place_period`, `place_upcoming`, `territory_snapshot`, `polity_territory` |
| `V006__catalog` | `person`, `conflict`, `settlement`, `commander`, `battle`, `state_profile`, `hero`, `simulation_step`, `step_claim`, `source`, `step_source`, `claim_source`, `entity_relation`, `glossary_entry`, `commemoration`, `world_event`, `planned_entity` |
| `V007__theming` | `theme` |
| `V008__media` | `media_asset`, `portrait`, `soundtrack_track` |

- Bazanın özü də qaydaları yoxlayır: slug, `LocalizedText` (`az` məcburi, boş sətir yoxdur), tarixin tutarlılığı (precision ↔ hissələr, real gün), `death ≥ birth`, poliqonun etibarlılığı (`ST_IsValid`), enum dəyərləri. Bu, redaksiya validasiyasından sonra ikinci müdafiə xəttidir.
- `is_historical_date` heç vaxt `NULL` qaytarmır (CHECK `NULL`-u keçmiş sayır). Java `HistoricalDate` ilə eyni təqvim qaydası: proleptik Qriqorian, astronomik il nömrələnməsi (0 = e.ə. 1). Test −800…2400 aralığında hər 29 fevralı hər iki tərəfdə müqayisə edir.
- **`az_fold` spesifikasiyadan fərqlidir:** §7.2-dəki hədəf sətir `ç`-ni `g`-yə çevirirdi ("Çaldıran" → "galdiran"); düzgün xəritələmə `'eeiiiissccggoouu'`-dur. `translate` `lower`-dən əvvəl işlədiyi üçün nəticə lokaldan asılı deyil.
- Axtarış: `az_fold(:q) <% az_fold(name->>'az')` (`pg_trgm` word similarity) + GIN trigram indeksləri. "seh ismayil" → "Şah İsmayıl Xətai".
- Spesifikasiyaya əlavələr: `simulation_step.age_approximate` (frontend-in "təq." işarəsi üçün), `*_alternatives`/`*_note` (tarix variantları), `source.content_hash`, `media_asset.version` (optimistic locking).
- JPA entity-ləri: ADR-0003-ə görə proyeksiya cədvəlləri `JdbcClient` ilə yazılır/oxunur, entity-si yoxdur. JPA entity-ləri yazma modelləri ilə birlikdə gəlir: identity (mərhələ 4), editorial (5), `media_asset` (11).

**Java ümumi tipləri** (`shared.domain`): `HistoricalDate` (+ `Age`, `ageAt` frontend-in `ageAt`-i ilə eyni nümunələrlə test olunub), `LocalizedText`, `EntityRef` (`type:slug[:stepKey]`), `Slugs`, enum-lar (`DataEnum`: bazada `AI_ILLUSTRATION`, sənəddə `ai_illustration`). `shared.jdbc.HistoricalDateColumns` sütun qrupunu `JdbcClient` parametrlərinə çevirir və geri oxuyur.

**Slug təklifi** (`Slugs.suggest`): `ə→e ı/İ→i ş→sh ç→ch ğ→gh ö→o ü→u`, `x` dəyişmir. "Şah İsmayıl" → `shah-ismayil` (datadakı slug; spesifikasiyadakı `shah-ismail` nümunəsi mövcud datayla uyğun gəlmir). Yalnız yeni sənəd üçün təklifdir; mövcud slug-lar dəyişmir.

## 9. Identity (mərhələ 4)

- **Cədvəllər** (`V009__identity`): `app_user` (e-poçt kiçik hərflə, unikal; `password_hash` NULL = login edə bilməz), `user_role`, `refresh_token` (+ `family_id`). `class_group` TEACHER funksiyaları ilə (mərhələ 10) gəlir.
- **Şifrələr:** Argon2id, OWASP minimumu (m = 19 MiB, t = 2, p = 1). Parametrlər hash-in içindədir; artırılarsa köhnə hash-lər növbəti login-də yenilənir. Siyasət: 12–128 simvol, e-poçt adını ehtiva etməsin (NIST 800-63B: tərkib qaydaları yox, uzunluq).
- **Access token:** JWT HS256, 15 dəq., `iss`, `sub` (istifadəçi id), `roles`, `jti`. Açar `JWT_SECRET`-dən (Base64, ≥ 256 bit; yoxdursa tətbiq başlamır). Yoxlama: imza, `iss`, `exp` (30 san. tolerantlıq), `sub` məcburi.
- **Refresh token:** qeyri-şəffaf 256 bit təsadüfi sətir, bazada yalnız SHA-256. Hər refresh köhnəni ləğv edib yenisini verir (rotasiya). Artıq istifadə olunmuş token yenidən gələrsə, həmin login-in **bütün ailəsi** ləğv olunur (oğurlanmış token-in həm oğruda, həm sahibində işləməsi dayanır); istifadəçinin digər sessiyalarına toxunulmur. Eyni token ilə paralel refresh sətir kilidi (`SELECT … FOR UPDATE`) ilə bloklanır.
- **Endpoint-lər** (`/api/v1/auth`): `POST /login`, `POST /refresh`, `POST /logout` (həmişə 204), `GET /me`. Token cavabları `Cache-Control: no-store`. Uğursuz login-in bütün səbəbləri (naməlum e-poçt, səhv şifrə, deaktiv hesab) eyni 401 cavabını verir; naməlum e-poçt üçün də Argon2 yoxlaması işləyir (vaxta görə hesab mövcudluğunu təxmin etmək olmasın).
- **Giriş qaydaları:** `GET /api/v1/**` açıq; `/api/v1/{auth,editorial,admin,analytics}/**` və bütün digər metodlar token tələb edir; `/actuator/health`, `/actuator/info` açıq, digər actuator endpoint-ləri ADMIN. 401/403 Problem Details (`…/problems/unauthorized`, `…/problems/forbidden`) + `WWW-Authenticate: Bearer`. Rol qaydaları modullarda `@PreAuthorize` ilə.
- **Admin bootstrap:** `ADMIN_EMAIL` + `ADMIN_PASSWORD` verilibsə və hesab yoxdursa, ADMIN yaradılır. Mövcud hesab heç vaxt dəyişdirilmir; zəif şifrə startup-ı dayandırır. Kodda heç bir default şifrə yoxdur. Loglara e-poçt, şifrə və token yazılmır.
- **Digər modullar üçün API:** `identity.api.CurrentUserProvider` → `CurrentUser(id, roles)`, `Role`.
- Login rate limiting (Bucket4j) mərhələ 10-dadır.

## 10. Redaksiya (mərhələ 5)

- **Cədvəllər** (`V010__editorial`): `editorial_document` (+ `title`: cari revision-ın az başlığı, siyahı və axtarış üçün), `editorial_revision` (dəyişməz; `content_hash` = kanonik JSON-un SHA-256-sı, eyni kontent yeni revision yaratmır), `review_comment` (+ `resolved_by/at`, `version`), `status_transition_log` (+ `action`, `revision_id`), `slug_redirect`, `content_version` (tək sətir, 0). Sənəddən revision-lara FK-lar `DEFERRABLE`-dır. `geojson_problem(text)`: PostGIS-in poliqona rəyi, heç vaxt xəta atmır.
- **Kontent strukturu və validasiya səviyyələri:** [ADR-0011](adr/0011-editorial-content-layout.md). Kontent bölmələrdən ibarət obyektdir (`PERSON` = `person` + `events` + `relations`…), hər bölmə `shared/schema` ilə yoxlanılır.
- **Status maşını** (`editorial.internal.domain.Workflow`, təmiz Java, unit testli): `submit`, `request_changes` (şərh məcburi), `approve`, `publish`, `archive`. Yeni revision sənədi `DRAFT`-a qaytarır; dərc olunmuş revision ictimai qalır. Son dərcdən sonra revision yazan heç kim (ADMIN də) təsdiqləyə bilməz. Hər keçid, o cümlədən `create` və `edit`, `status_transition_log`-a yazılır.
- **Validasiya** (`editorial.internal.validation`, 9 qayda): sxem və bölmələr, id = slug, mətn (`az` boş deyil; `en`/`ru` çatışmazlığı sənəd üzrə bir `INFO`), tarixlər (real gün, `disputed` → alternatives), addımlar (order, xronologiya, fakt/rəvayət/mübahisə iddiaları, quiz/choice/narration), şəxsiyyətin həyatı (doğum/ölüm hadisələri, ömürdən kənar tarix, döyüş nəticəsi), referanslar (redaksiya sənədlərinə qarşı), media (lisenziya, mənbə, müasir şəxslərin AI portreti, gözləyən icazə), tip üzrə uyğunluq (il aralıqları, hakimiyyət dövlətin illərində, musiqi teması, regions/iso), poliqonlar (PostGIS). Mövcud `data/`-nın hamısı xətasız keçir; yeganə istisna icazəsi gözlənilən 2 trekdir, onlar spesifikasiyaya görə dərc oluna bilməz.
- **Diff:** öz RFC 6902 implementasiyası (`JsonPatch`). Massivlər LCS ilə hizalanır: ortaya addım əlavə etmək bir `add` verir, bir sahəni dəyişmək bir `replace`. Yalnız `add`/`remove`/`replace` yaradılır; `apply` testlərdə round-trip üçündür.
- **Endpoint-lər** (`/api/v1/editorial/documents`, AUTHOR/REVIEWER/ADMIN):

| Metod və yol | Qeyd |
|---|---|
| `GET /` | `type`, `status`, `q` (slug + `az_fold` başlıq, trigram), `mine`, `limit` ≤ 200, `offset` |
| `POST /` | `{type, slug?, content, changeNote?}` → 201, `Location`, `ETag` |
| `GET /{id}` | sənəd + cari revision + `publishedRevisionNo`; `ETag` = versiya |
| `PUT /{id}` | `If-Match` məcburi: yoxdursa 428, köhnədirsə 412 (cari `ETag` ilə) |
| `GET /{id}/revisions`, `GET /{id}/revisions/{no}` | tarixçə (kontentsiz), bir revision kontentlə |
| `GET /{id}/diff?from=&to=` | `application/json-patch+json` |
| `POST /{id}/revert?to=` | köhnə revision-ın kontenti ilə yeni revision |
| `GET /{id}/validation?revision=` | `{publishable, errors, warnings, infos, issues[{level, code, pointer, message}]}` |
| `POST /{id}/transitions`, `GET /{id}/transitions` | `{action, comment}`; xətalı dərc 422 (`errors` ilə) |
| `GET/POST /{id}/comments`, `PATCH /{id}/comments/{cid}` | `fieldPath` JSON Pointer; mətni yalnız müəllif dəyişir; həll etmək şərhin müəllifi və ya sənədi redaktə edə bilən üçündür |

- **Xətalar** (Problem Details, `…/problems/<type>`): `not-found` 404, `forbidden` 403, `conflict` 409 (`code`: `duplicate-slug`, `invalid-transition`, `archived`, `comment-required`…), `precondition-required` 428, `precondition-failed` 412, `validation-failed` 422, `content-too-large` 413 (> 5 MiB), `bad-request` 400. Bütün cavablar `Cache-Control: no-store`.
- **Event-lər** (`editorial.api`): `ContentPublished(documentId, docType, slug, revisionId, revisionNo)`, `ContentArchived(…, wasPublished)`. Dinləyici mərhələ 6-da gəlir (`publishing`).
- **Sonraya qalanlar:** `GET /{id}/preview` (ictimai API formatı mərhələ 8-dədir), `/media/*` (mərhələ 11), `/admin/broken-references` və `/admin/projections/rebuild` (mərhələ 6), `assignedToMe` filtri (təyinat modeli yoxdur; hələlik `mine=true`), slug dəyişmə endpoint-i (`slug_redirect` cədvəli hazırdır), daxili naməlum açarlar üçün `WARNING` (hələlik yalnız yuxarı səviyyədəki bölmələr).
