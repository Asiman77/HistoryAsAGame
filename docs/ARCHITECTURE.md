# Arxitektura

> Mənbə: [`BACKEND_SPEC.md`](BACKEND_SPEC.md). Ondan fərqlər: [`adr/`](adr/README.md).
> Bu sənəd hər mərhələdə yenilənir. Son yeniləmə: mərhələ 10 (təhlükəsizliyin qalanı).

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
| `catalog` | şəxsiyyət, müharibə, döyüş, dövlət, qəhrəman, addımlar, iddialar, mənbələr, əlaqələr, lüğət, xatirə günləri, dünya hadisələri | shared, geo (məkan uyğunlaşdırması), chronology, media (yaş portretləri) | — | — (keş versiya açarlıdır, ADR-0014) |
| `geo` | məkanlar, ərazi snapshot-ları, nöqtə→dövlət | shared | — | — |
| `chronology` | dövrlər, dövlətlər (polity), hökmdarlar, hakimiyyətlər | shared | — | — |
| `theming` | temalar (variant birləşməsi ilə) | shared | — | — |
| `media` | media reyestri, presigned yükləmə, portretlər, treklər | shared, identity | — | — |
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
| 6 | Dərc + proyektorlar | ✅ |
| 7 | İdxal | ✅ |
| 8 | İctimai API (əsas) | ✅ |
| 9 | Coğrafi və xronoloji sorğular | ✅ |
| 10 | Təhlükəsizliyin qalanı | ✅ |

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

- **Cədvəllər** (`V009__identity`): `app_user` (e-poçt kiçik hərflə, unikal; `password_hash` NULL = login edə bilməz), `user_role`, `refresh_token` (+ `family_id`). `class_group` (`V012`) mərhələ 10-da gəldi, §15-ə bax.
- **Şifrələr:** Argon2id, OWASP minimumu (m = 19 MiB, t = 2, p = 1). Parametrlər hash-in içindədir; artırılarsa köhnə hash-lər növbəti login-də yenilənir. Siyasət: 12–128 simvol, e-poçt adını ehtiva etməsin (NIST 800-63B: tərkib qaydaları yox, uzunluq).
- **Access token:** JWT HS256, 15 dəq., `iss`, `sub` (istifadəçi id), `roles`, `jti`. Açar `JWT_SECRET`-dən (Base64, ≥ 256 bit; yoxdursa tətbiq başlamır). Yoxlama: imza, `iss`, `exp` (30 san. tolerantlıq), `sub` məcburi.
- **Refresh token:** qeyri-şəffaf 256 bit təsadüfi sətir, bazada yalnız SHA-256. Hər refresh köhnəni ləğv edib yenisini verir (rotasiya). Artıq istifadə olunmuş token yenidən gələrsə, həmin login-in **bütün ailəsi** ləğv olunur (oğurlanmış token-in həm oğruda, həm sahibində işləməsi dayanır); istifadəçinin digər sessiyalarına toxunulmur. Eyni token ilə paralel refresh sətir kilidi (`SELECT … FOR UPDATE`) ilə bloklanır.
- **Endpoint-lər** (`/api/v1/auth`): `POST /login`, `POST /refresh`, `POST /logout` (həmişə 204), `GET /me`. Token cavabları `Cache-Control: no-store`. Uğursuz login-in bütün səbəbləri (naməlum e-poçt, səhv şifrə, deaktiv hesab) eyni 401 cavabını verir; naməlum e-poçt üçün də Argon2 yoxlaması işləyir (vaxta görə hesab mövcudluğunu təxmin etmək olmasın).
- **Giriş qaydaları:** `GET /api/v1/**` açıq; `/api/v1/{auth,editorial,admin,analytics,teacher}/**` və bütün digər metodlar token tələb edir; `/actuator/health`, `/actuator/info` açıq, digər actuator endpoint-ləri ADMIN. 401/403 Problem Details (`…/problems/unauthorized`, `…/problems/forbidden`) + `WWW-Authenticate: Bearer`. Rol qaydaları modullarda `@PreAuthorize` ilə.
- **Admin bootstrap:** `ADMIN_EMAIL` + `ADMIN_PASSWORD` verilibsə və hesab yoxdursa, ADMIN yaradılır. Mövcud hesab heç vaxt dəyişdirilmir; zəif şifrə startup-ı dayandırır. Kodda heç bir default şifrə yoxdur. Loglara e-poçt, şifrə və token yazılmır.
- **Digər modullar üçün API:** `identity.api.CurrentUserProvider` → `CurrentUser(id, roles)`, `Role`.
- Login rate limiting, CORS, başlıqlar, hesab idarəetməsi: §15.

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
- **Sonraya qalanlar:** `GET /{id}/preview` (ictimai API formatı mərhələ 8-dədir), `/media/*` (mərhələ 11), `assignedToMe` filtri (təyinat modeli yoxdur; hələlik `mine=true`), slug dəyişmə endpoint-i (`slug_redirect` cədvəli hazırdır), daxili naməlum açarlar üçün `WARNING` (hələlik yalnız yuxarı səviyyədəki bölmələr).

## 11. Dərc və proyeksiya (mərhələ 6)

Qərarlar: [ADR-0012](adr/0012-projection.md).

```
editorial ──ContentPublished / ContentArchived──► publishing.ProjectionListener (@ApplicationModuleListener, async, registry)
                                                     │
                                                     ▼
                                      Projector.project(documentId)   ── bir tranzaksiya, sənəd üzrə advisory lock
                                        ├─ PublishedContents.of(id)    (editorial.api: hazırkı dərc olunmuş revision)
                                        ├─ hər ProjectionWriter: delete(id) → write(content) → afterChanges()
                                        ├─ content_version + 1
                                        └─ ContentProjected(documentId, contentVersion)  (publishing.api)
```

| Writer (`<modul>.internal.projection`) | Sənəd tipləri → cədvəllər |
|---|---|
| `CatalogProjectionWriter` + `StepWriter` | `PERSON`, `CONFLICT`, `STATE` → `person`/`conflict`/`state_profile`, `simulation_step`, `step_claim`, `source`, `step_source`, `claim_source`, `entity_relation`, `settlement`, `commander`; `BATTLE`, `HERO`, `GLOSSARY_ENTRY`, `COMMEMORATION`, `WORLD_EVENT`, `PLANNED_ENTITY`; `RULER`-in `related` keçidləri |
| `GeoProjectionWriter` | `PLACE` → `place`, `place_period`, `place_upcoming`; `TERRITORY_SNAPSHOT` → `territory_snapshot`, `polity_territory` |
| `ChronologyProjectionWriter` | `ERA`, `POLITY` (+ `polity_period`, `polity_fact`, `reign`), `RULER` |
| `ThemingProjectionWriter` | `THEME` (miras birləşdirilmiş) |
| `MediaProjectionWriter` | `PERSON`-un yaşa görə portretləri → `portrait`; `SOUNDTRACK_TRACK` → `soundtrack_track` |

- `SOURCE` və `TERRITORY_REGISTRY` proyeksiya olunmur (ADR-0007).
- **Miqrasiya `V011`:** media reyestrinə qədər sətirdə saxlanılan şəkil/fayl sütunları (`person.portrait`, `hero.photo`, `polity.emblem`, `ruler.portraits`, `portrait.image`, `soundtrack_track.file_path`). `location_place_slug` yalnız açıq `placeId`-dir.
- **Təkrar cəhd:** tamamlanmamış event-lər `platform.publishing.retry-interval` (1 dəq.) ilə yenidən göndərilir (`retry-after` = 1 dəq.-dən köhnələr), həmçinin tətbiq başlayanda (`republish-outstanding-events-on-restart`).
- **Endpoint-lər (ADMIN):** `POST /api/v1/admin/projections/rebuild` → `{documents, deferred[], contentVersion, tookMs}`; `GET /api/v1/admin/broken-references` → `[{documentId, type, slug, revisionNo, level, code, pointer, message}]`.
- **Testlər:** bugünkü bütün `data/` sənəd kimi yazılır və rebuild olunur. Yoxlananlar:
  - hər cədvəlin sətir sayı data ilə üst-üstə düşür;
  - törəmə dəyərlər: yaş, marşrut, snapshot aralıqları, tema mirası, mənbə dublikatsızlığı;
  - rebuild iki dəfə eyni nəticəni verir;
  - API ilə dərc → asinxron proyeksiya → yeni draft ictimai sətirlərə toxunmur → arxiv sətirləri silir;
  - valideyni olmayan variantın proyeksiyası uğursuz olur, registry-də qalır və valideyn dərc olunandan sonra təkrar cəhddə keçir.
- **Data qeydi:** qurulmuş `y2020` snapshot-unda `russian-federation` poliqonu PostGIS-ə görə etibarsızdır (halqa öz-özünü kəsir, (38.172, 50)). Validasiya onu `ERROR` sayır; proyeksiya onu təmir edir.

## 12. İdxal (mərhələ 7)

Qərarlar: [ADR-0013](adr/0013-data-import.md). Kod: `editorial.internal.importing` (`DataFolder`, `DataImporter`, `MediaPermissions`).

```
POST /api/v1/admin/import[?dryRun=true]  (ADMIN)
  DataFolder.read(data/, public/data/territories)  → 432 sənəd (2026-11-12)
  1. upsert: CREATED | UPDATED | UNCHANGED | CONFLICT (CMS-də redaktə olunub) | ARCHIVED   — müəllif: importer@system.invalid
  2. flush → hər sənədin validasiyası (referanslar bir-birini tapır)
  3. ERROR yoxdursa → PUBLISHED (jurnalda `import`, icraçı: ADMIN); varsa → DRAFT + hesabatda xətalar
  4. ContentImported → publishing: bir rebuild (~6 san.)
```

- **Bugünkü nəticə:** 432 sənəd. 429-u dərc olunur. 3-ü draft qalır: icazəsi gözlənilən 2 trek (`media-permission`) və `y2020` snapshot-u (`invalid-geometry`, §11-dəki data qeydi). İkinci idxal 432 `UNCHANGED` verir: yeni revision, jurnal sətri və dublikat yaranmır.
- **Hesabat:** `{dryRun, documents, outcomes, published, drafts, results[{type, slug, outcome, status, revisionNo, files, errors}], sourceProblems, media{status: say}, mediaPending[]}`.
- **Konfiqurasiya:** `platform.import.data-dir` (`IMPORT_DATA_DIR`, defolt `../data`), `platform.import.built-territories-dir` (`IMPORT_BUILT_TERRITORIES_DIR`, defolt `../public/data/territories`). Docker-də `/import/data` və `/import/territories` yalnız oxumaq üçün qoşulur.
- **Rebuild:** catalog cədvəlləri `TRUNCATE` ilə yox, `DELETE` ilə təmizlənir. Belə olanda ictimai oxu rebuild bitənə qədər köhnə sətirləri görür (MVCC) və bloklanmır.
- **Testlər** (`ImportTests`):
  - hamısı idxal olunur, yalnız dərc oluna bilməyənlər draft qalır;
  - müəllif və icraçı düzgün yazılır; media statusları ADR-0010-a uyğundur;
  - rebuild sonrası proyeksiya doludur;
  - iki dəfə idxal heç nəyi dəyişmir;
  - `dryRun` heç nə saxlamır;
  - dəyişmiş data yeni revision olur, CMS redaktəsi isə `CONFLICT` kimi qorunur;
  - yalnız ADMIN idxal edə bilər.

## 13. İctimai API (mərhələ 8)

Qərarlar: [ADR-0014](adr/0014-public-read-api.md). OpenAPI: `/v3/api-docs/public`, Swagger UI: `/swagger-ui.html`.

```
GET /api/v1/...  ──► PublicApiInterceptor: dil + content_version (1 sorğu) → If-None-Match uyğundursa 304
                      │
                      ▼
                 @PublicApi controller (modulun internal.web) ──► <Modul>Reader (internal.read)
                      │                                             ├─ PublicCache (version, dil, sorğu, arqument)
                      │                                             ├─ JdbcClient + native SQL (ADR-0003)
                      │                                             └─ EntityLinks / PlaceLookup / Portraits (modullar arası, toplu)
                      ▼
                 PublicApiHeaders (2xx: ETag, Cache-Control, Vary, Content-Language)
                 PublicApiProblems (Problem Details + no-store; köhnə slug → 301)
```

| Endpoint | Modul | Qeyd |
|---|---|---|
| `GET /persons` | catalog | kartlar: ad, doğum/ölüm, dövrlər, teqlər, tema, əsas portret; seçilmişlər əvvəldə |
| `GET /persons/{slug}` | catalog | + titullar, doğum/ölüm yeri (kataloq məkanı ilə), bio, epiqraf, yaş portretləri, əlaqələr |
| `GET /persons/{slug}/steps`, `…/steps/{stepKey}` | catalog | §10.2 forması: `{owner, contentVersion, steps}` |
| `GET /conflicts`, `/conflicts/{slug}`, `/conflicts/{slug}/days`, `…/days/{stepKey}` | catalog | müharibə + məntəqələr, komandanlar, qəhrəmanlar, döyüşlər |
| `GET /states`, `/states/{slug}`, `/states/{slug}/steps`, `…/steps/{stepKey}` | catalog | |
| `GET /battles/{slug}`, `/heroes/{slug}` | catalog | qəhrəman fotosu yalnız ictimai lisenziya ilə |
| `GET /relations?type=&slug=` | catalog | öz və addımlarının keçidləri (`OUTGOING`) + ona gələnlər (`INCOMING`) |
| `GET /places?bbox=&minImportance=`, `/places/{slug}` | geo | `minImportance=k` → vaciblik ≤ k (1 = ən vacib); dövrlərə görə adlar, gələcək məzmun |
| `GET /eras` | chronology | hamısı, səhifələnmir |
| `GET /polities/{slug}`, `/rulers/{slug}` | chronology | dövrlər, faktlar, hakimiyyətlər; hökmdarın şəxsiyyət səhifəsi varsa `personAvailable` |
| `GET /themes/{slug}` | theming | miras birləşdirilmiş; `moodOverrides` açarları böyük hərflə |

- **Addım:** `stepKey, sequence, kind, date (+alternatives, note), ageAtEvent, ageApproximate, title, factualSummary, narrative, mood, claimType, claims[], location, fromLocation, route (GeoJSON), territorySnapshot, themeSlug, portrait, sources[], related[], details`. `location.slug` açıq `placeId`-dir, yoxdursa uyğunlaşdırılmış kataloq məkanı (ADR-0014).
- **Ümumi tiplər** (`shared.read`): `ApiDate`, `ApiImage`, `ApiSource` (`slug` = dublikatsız `source` sətirinin slug-ı), `ApiLink`, `ResultPage`.
- **Modullar arası API-lər:** `geo.api.PlaceLookup` (`bySlugs`, `nearest`, `byName`), `media.api.Portraits`, `shared.read.EntityDirectory` (catalog, geo, chronology təqdim edir), `shared.read.PlannedTitles` (catalog).
- **Təhlükəsizlik:** `GET /api/v1/**` əvvəlki kimi açıqdır. `/v3/api-docs/**` və `/swagger-ui/**` yalnız `GET` ilə açıqdır.
- **Testlər:**
  - unit: dil seçimi və dərin lokallaşdırma, ETag müqayisəsi, keş, slug yönləndirməsi, media icazəsi filtri, portret seçimi, bbox, səhifələmə;
  - inteqrasiya (`PublicApiTests`, bütün `data/` dərc olunmuş halda):
    - hər endpoint, dillər, `304`, keşin versiya ilə yenilənməsi, Problem Details, `301`;
    - `PENDING` media görünmür;
    - addım sorğusunun SQL sayı addımların sayından asılı deyil (`QueryCounter`, datasource-proxy).
- **Sonraya qalanlar:**
  - `GET /editorial/documents/{id}/preview`: dərc olunmamış revision-ı bu formatda göstərmək üçün proyeksiyanı tranzaksiyada yazıb geri almaq lazımdır;
  - `/soundtracks` (media, mərhələ 11);
  - `openapi.json`-dan frontend tiplərinin generasiyası (mərhələ 14).

## 14. Coğrafi və xronoloji sorğular (mərhələ 9)

Qərarlar: [ADR-0015](adr/0015-geo-chronology-queries.md). Qaydalar frontend-dəki ilə eynidir. Bunu `scripts/parity-history-queries.ts` yoxlayır: bütün məkanlar, ilin hər günü və 1400–2020-nin hər ili.

```
                      ┌──────────── catalog (HistoryController) ───────────────┐
 /timeline ─────────► │ TimelineReader ─┬─ HistoryIndex ─── PlaceMatcher ──────┼──► geo.api.PlaceLookup
 /on-this-day ──────► │                 │   (simulation_step + sahib, LATERAL)  │
 /places/{s}/timeline►│ PlaceTimelineReader                                     ├──► geo.api.Territories
 /compare ──────────► │ CompareReader ──┘                                       ├──► chronology.api.Chronology
 /search ───────────► │ SearchReader ──► shared.read.SearchSource (catalog, geo, chronology)
                      └─────────────────────────────────────────────────────────┘
 /territories, /polities/at ──► geo (TerritoryReader)       /polities/{slug}/ruler ──► chronology (ChronologyReader)
```

| Endpoint | Modul | Qeyd |
|---|---|---|
| `GET /territories?year=&simplified=true` | geo | `application/geo+json` FeatureCollection. Hər dövlət bir Feature-dır (`id` = polity slug, `capital`, `vassalOf`, `labelAt`, `areaKm2`). `covered`, `prevYear`, `nextYear`, `snapshot` əlavə üzvlərdir (foreign member). |
| `GET /polities/at?lat=&lng=&year=` | geo | Əhatəli snapshot-da nöqtəni ehtiva edən bütün dövlətlər (`ST_Intersects`, sərhəd daxil). `available` dövlət səhifəsinin olub-olmadığını göstərir. |
| `GET /polities/{slug}/ruler?year=` | chronology | `{polity, year, exists, facts, rulers[]}`. Həmhökmdarlar və həmin il hakimiyyətin dəyişməsi bir neçə hökmdar verir. Dərc olunmamış hökmdar `available: false` ilə gəlir. |
| `GET /timeline?year=` | catalog | `{coverage, era, themeSlug, map, capitals, rulers, persons, events, nearestEventYears}`. `persons`: yaş (`ageApproximate`) və son məlum yer. |
| `GET /on-this-day?month=&day=` | catalog | `mode: DAY` (günə qədər dəqiq), `MONTH` (ayın hadisələri, günə görə) və ya `NONE`. Xüsusi günlərdə `commemoration` də gəlir. |
| `GET /places/{slug}/timeline` | catalog | `{place, membership[], events[]}`. `membership` frontend-in `placeMembership` + `clipToLifetime` qaydası ilə hesablanır. |
| `GET /compare?a=type:slug&b=type:slug` | catalog | `{a, b, overlap, intersections[]}`. Zolaqlar `person`, `state` və `conflict` ola bilər. Addımlar `battles[]` daşıyır. Kəsişmənin səbəbi `PLACE` və/və ya `BATTLE`-dır. |
| `GET /search?q=&types=&limit=` | catalog + SPI | 2–100 simvol. `types` vergüllə ayrılır, `limit` ≤ 50. Nəticə: `{type, slug, name, fromYear, toYear, score}`. |

- **İndeks hadisəsi** (`HistoryIndex.IndexEvent`): `key` (`person:shah-ismayil:ismayil-chaldiran`), `ownerType/Slug/Name`, `category` (`PERSON`/`BATTLE`/`STATE`), `stepKey`, `kind`, `mood`, `claimType`, `title`, `date`, `location {placeSlug, name, lat, lng, type}`, `eraSlug`, `themeSlug`, `image`.
- **Modullar arası API-lər:**
  - `geo.api.Territories`: `pick(year)`, `at(point, year)`, `holders(snapshot)`, `membership(place)`;
  - `chronology.api.Chronology`: `eras()`, `reignsIn(year)`, `eraFor`;
  - `shared.read.SearchSource` + `TableSearch`;
  - `shared.read.PublicParams`: il və koordinat yoxlaması.
- Catalog artıq real olaraq `chronology :: api`-dən asılıdır (modul diaqramı yeniləndi). Asılılıq qaydaları dəyişməyib.
- **Performans** (lokal, isti keş): bütün yeni endpoint-lər 10–22 ms. Soyuq keşdə `/compare` ~240 ms, qalanları < 100 ms. GeoJSON gzip ilə təxminən 3 dəfə kiçilir.
- **Testlər:**
  - unit: `TerritoryRulesTests` (snapshot seçimi, mənsubiyyət, kəsmə), `HistoryRulesTests` (dövr, gün, müqayisə qaydaları), `PublicParamsTests`, `SearchSqlTests`;
  - inteqrasiya: `HistoryQueriesTests`, 29 test. Yoxlananlar:
    - hər endpoint, kənar hallar (boşluq, sıçrayış ili, mübahisəli ərazi, dərc olunmamış hökmdar, açıq hakimiyyət);
    - `400`/`404`, `304`, dil, OpenAPI;
    - `/timeline`-ın sorğu sayı ildən asılı deyil.
- **Açıq sual:** dünya hadisələri (`world_event`) proyeksiya olunur, amma heç bir endpoint onları vermir. Frontend onları şəxsiyyət və dövlət səhifələrində "eyni vaxtda dünyada" bloku üçün işlədir (`pickWorldEvents`). Spesifikasiyanın §10.1 siyahısında belə endpoint yoxdur. Sürüşdürücü onları göstərmir.

## 15. Təhlükəsizliyin qalanı (mərhələ 10)

Qərarlar: [ADR-0016](adr/0016-security-hardening.md).

- **Login limiti** (Bucket4j, `platform.identity.login-limit.*`): ünvan üzrə 20/dəq., hesab üzrə 10/15 dəq. Limit şifrə yoxlamasından əvvəl yoxlanır. Hesab bloklanmır, sadəcə yavaşıdılır. Cavab `429` + `Retry-After`. `POST /auth/password` da eyni limitdən keçir. Vedrələr yaddaşdadır (bir instansiya). Ünvan `getRemoteAddr()`-dir; reverse proxy əlavə olunanda forward başlıqları etibarlı proxy ilə birlikdə qurulmalıdır.
- **CORS:** `CORS_ALLOWED_ORIGINS` (dəqiq origin-lər, `*` yox, səhv yazılış startup-ı dayandırır). Credentials yoxdur, token `Authorization`-dadır. Açıq başlıqlar: `ETag`, `Location`, `Retry-After`, `Content-Language`, `X-Request-Id`. `local` profili və compose: `http://localhost:3000`.
- **Başlıqlar:** `nosniff`, `Referrer-Policy: no-referrer`, `X-Frame-Options: DENY`, API üçün `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'`. Swagger UI-nin öz CSP-si var.
- **Hesablar** (ADMIN, `/api/v1/admin/users`):
  - `GET` (rol və mətn filtri; sistem hesabları gizlidir), `POST` (rollar + ilk şifrə), `GET/PATCH /{id}` (ad, rollar, aktivlik), `PUT /{id}/password`;
  - admin özünü deaktiv edə, öz ADMIN rolunu silə bilməz; son aktiv admin qalır;
  - deaktiv etmək, rolu dəyişmək, şifrə qoymaq istifadəçinin bütün sessiyalarını bitirir;
  - hər kəs: `POST /api/v1/auth/password` (cari şifrə tələb olunur), bütün sessiyalar bitir;
  - xəta kodları: `duplicate-email`, `self-lockout`, `last-admin`, `invalid-password`, `wrong-password`.
- **Siniflər** (`V012__class_group`): TEACHER `/api/v1/teacher/classes` altında öz siniflərini yaradır, siyahılayır, adını dəyişir, silir. Kod 6 simvoldur, oxşar hərflərsizdir (31⁶). Başqasının sinfi `404` verir. ADMIN: `GET /api/v1/admin/classes`. Analitika üçün API: `identity.api.ClassGroups` (`byCode`, `ownedBy`).
- **İcazə matrisi:** `PermissionMatrixTests` — 37 qeyri-ictimai endpoint × 5 çağıran (anonim + 4 rol), 183 dinamik test. Matrisdə olmayan endpoint testi sındırır; `@PublicApi` controller-lərdə yalnız `GET` var.
- **Asılılıq yoxlaması:** OWASP Dependency-Check 13.0.0, `./mvnw dependency-check:check` (fazaya bağlı deyil). CI: `.github/workflows/backend-dependencies.yml`, `pom.xml` dəyişəndə və həftəlik; CVSS ≥ 7 build-i dayandırır. Yanlış pozitivlər `backend/dependency-check-suppressions.xml`-də (səbəb + `until`). **`NVD_API_KEY` repo secret-i məcburidir** (lokalda: `-DnvdApiKey=…`); açarsız NVD yükləməsi işləmir.
- **Testlər:** `LoginRateLimiterTests`, `LoginRateLimitTests`, `CorsPropertiesTests`, `SecurityHeadersTests`, `AccountManagementTests`, `ClassCodeTests`, `TeacherClassTests`, `PermissionMatrixTests`.
