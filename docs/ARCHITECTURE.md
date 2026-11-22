# Arxitektura

> Mənbə: [`BACKEND_SPEC.md`](BACKEND_SPEC.md). Ondan fərqlər: [`adr/`](adr/README.md).
> Bu sənəd hər mərhələdə yenilənir. Son yeniləmə: mərhələ 15 (sənədləşmə). BACKEND_SPEC-in bütün mərhələləri bitib.
> Gündəlik iş üçün qısa bələdçi: §20 (konfiqurasiya, planlı işlər, miqrasiyalar), açıq məsələlər: §21,
> mərhələlərdən sonra əlavə olunanlar (önizləmə, təyinat, ad dəyişmə, dünya hadisələri): §22.

## 1. Ümumi görünüş

```
                 ┌──────────── backend (Spring Boot 4.1, Java 25, modular monolit) ─────────────┐
 Redaktor ─JWT─► │ editorial ──ContentPublished──► publishing ──► catalog / geo / chronology /    │
                 │    ▲                               │            theming / media (proyeksiya)   │
                 │ identity                    ContentProjected          │                        │
                 │                                   ▼                    ▼                        │
                 │                     statik eksport (S3)    İctimai API (GET, ETag, cache)       │ ◄── mobil, digər istehlakçılar
 Şagird ───────► │ analytics (POST /events, anonim)  │                                             │
                 └───────────────────────────────────┼─────────────────────────────────────────────┘
                        PostgreSQL 18 + PostGIS 3.7 + pg_trgm          S3 (lokalda SeaweedFS)
                                                     │
                                                     ▼
                              Next.js build (npm run build:api, data/ formatında) ─► statik sayt
```

Frontend (repo kökü, Next.js `output: "export"`) iki mənbədən build oluna bilər (ADR-0004, ADR-0020):
defolt olaraq repodakı `data/`-dan, `NEXT_PUBLIC_DATA_SOURCE=api` ilə isə backend-in statik eksportundan.
Hər iki halda eyni `FileSystemRepository` və eyni Zod sxemi işləyir, UI fərqlənmir. Sayt runtime-da backend-ə
yalnız anonim analitika üçün müraciət edir (`NEXT_PUBLIC_ANALYTICS_URL` verilibsə).

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
| `media_asset` | spesifikasiyadakı kimi + `checksum`, `origin` (`UPLOAD`/`LINKED`, ADR-0017), `updated_at`, `version` | `INDEX (permission_status)`, `INDEX (created_at)`, `UNIQUE (storage_key)` |
| `portrait` | `id`, `owner_type`, `owner_slug`, `age_from`, `age_to`, `media_id NULL`, `kind`, `alt LT`, `caption LT`, `prompt_id`, `sort_order`, `document_id` | `INDEX (owner_type, owner_slug)` |
| `soundtrack_track` | `id`, `slug`, `conflict_slug`, `title LT`, `performer`, `media_id NULL`, `moods text[]`, `license`, `permission_status`, `rights_holder`, `document_id` | `UNIQUE (slug)`, `GIN (moods)` |

### identity
`app_user`, `user_role`, `refresh_token` (+ `family_id` — təkrar istifadədə bütün ailəni ləğv etmək üçün), `class_group` — spesifikasiyadakı kimi.

### analytics
`learning_event` (`received_at` üzrə aylıq `RANGE` partition-lar; IP/user-agent/istifadəçi sütunu yoxdur; `detail`, `payload` yalnız tipin sahələri), `daily_aggregate (day, event_type, owner_type, owner_slug, step_key, class_code, detail, count, sessions, payload_stats jsonb, computed_at)` — `UNIQUE` toplama açarı ilə upsert (ADR-0018).

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
| 11 | Media | ✅ |
| 12 | Analitika | ✅ |
| 13 | Statik eksport | ✅ |
| 14 | Frontend inteqrasiyası | ✅ |
| 15 | Sənədləşmə | ✅ |

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
- `.refine()` qaydaları JSON Schema-ya keçmir; siyahısı `shared/schema/README.md`-dədir. Backend-də onlar redaksiya validasiyasının qaydaları kimi yazılıb (§10).

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
- **Event-lər** (`editorial.api`): `ContentPublished(documentId, docType, slug, revisionId, revisionNo)`, `ContentArchived(…, wasPublished)`. Onları `publishing` dinləyir (§11).
- **Sonradan əlavə olunanlar (§22):** `GET /{id}/preview`, `PUT /{id}/assignee` + `assignedToMe`, `POST /{id}/rename`, istənilən dərinlikdə naməlum açarlar üçün `WARNING` (`unknown-key`).

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
- **Data qeydi (həll olunub, 2026-11-22):** `y2020` snapshot-unda `russian-federation` poliqonu öz-özünü kəsirdi ((38.172, 50)), çünki `prepare-countries.ts` onu `bboxClip` ilə kəsirdi. `countries.json` təmir olundu, skript poliqon kəsişməsinə keçdi, unit test heç bir poliqonda kəsişmə olmadığını yoxlayır. Proyeksiyadakı `ST_MakeValid` müdafiəsi qalır.

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

- **Bugünkü nəticə:** 432 sənəd. 430-u dərc olunur. 2-si draft qalır: icazəsi gözlənilən 2 trek (`media-permission`). `y2020` snapshot-u poliqon təmirindən sonra dərc olunur (§11). İkinci idxal 432 `UNCHANGED` verir: yeni revision, jurnal sətri və dublikat yaranmır.
- **CMS-də adı dəyişmiş sənəd** (§22): datadakı köhnə slug yönləndirmə ilə tanınır və `CONFLICT` olur, köhnə adla yenidən yaradılmır.
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
- **Önizləmə:** `GET /editorial/documents/{id}/preview` istənilən revision-ı bu formatda qaytarır (§22). Frontend tiplərinin OpenAPI-dən generasiyası mərhələ 14-də edildi (§19).

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
- **Dünya hadisələri:** `GET /world-events` (§22) frontend-in `pickWorldEvents` qaydası ilə eyni seçimi qaytarır; parity skripti hər ili yoxlayır.

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

## 16. Media (mərhələ 11)

Qərarlar: [ADR-0017](adr/0017-media-registry.md). S3 müştərisi: AWS SDK v2 2.59.1 (yalnız sync, Apache HTTP; checksum `WHEN_REQUIRED` — S3-uyğun anbarlar üçün).

```
Redaktor ─► POST /editorial/media/uploads {mimeType, sizeBytes} ─► allowlist + ölçü ─► presigned PUT (15 dəq.)
        ─► PUT <url> (fayl birbaşa S3-ə, backend-dən keçmir)
        ─► POST /editorial/media {storageKey, license, …} ─► HEAD + ilk baytlar + SHA-256 ─► media_asset (status lisenziyadan)
        ─► məzmunda src/url/file = "media:<id>"
ADMIN ──► PATCH /editorial/media/{id} {permissionStatus: GRANTED} (If-Match) ─► MediaAssetChanged ─► publishing: content_version + 1

İctimai oxu: <Modul>Reader ─► ApiImage.of(şəkil, dil, MediaFiles.at(contentVersion)) ─► reyestrə görə göstər / gizlət
```

- **Miqrasiya `V013__media_registry`:** `origin` (`UPLOAD`/`LINKED`), `updated_at`. CHECK-lər: yükləmənin açarı `uploads/…`-dir və `mime_type`, `size_bytes`, `checksum` doludur; `LINKED` açarı `/` və ya `http(s)://` ilə başlayır.
- **Modullar arası API-lər:**
  - `media.api.MediaRegistry`: `find(refs)` (validasiya üçün, həmişə cari vəziyyət), `registerLinked(files)` (idxal üçün);
  - `media.api.MediaAssetChanged`: `publishing` dinləyir → `Projector.touch()`;
  - `shared.read.MediaFiles` / `MediaIndex`: ictimai oxu üçün, `content_version` üzrə keşlənir. `catalog`, `chronology`, `theming` və `media` oxuyucuları bunu istifadə edir; `ApiImage.of` və `ofPhoto` indeks qəbul edir.
- **Endpoint-lər** (`/api/v1/editorial/media`, AUTHOR/REVIEWER/ADMIN; hamısı `no-store`):

| Metod və yol | Qeyd |
|---|---|
| `POST /uploads` | `{mimeType, sizeBytes}` → `{storageKey, url, method: PUT, headers, expiresAt, maxSizeBytes}`. Tip allowlist-də deyilsə 422 `unsupported-type`, böyükdürsə 413 |
| `POST /` | `{storageKey, license, title?, caption?, sourceUrl?, rightsHolder?, aiGenerated?, aiDisclosureLabel?, width?, height?, durationMs?}` → 201, `Location`, `ETag`. Xəta kodları: `invalid-storage-key`, `upload-missing`, `content-type-mismatch`, `content-mismatch`, `empty-file`, `license-required`, `already-registered` (409); 413 `file-too-large`. Uyğun gəlməyən obyekt silinir |
| `GET /` | `type`, `status`, `origin`, `q` (açar, lisenziya, hüquq sahibi, az başlıq), `limit` ≤ 200, `offset` |
| `GET /{id}` | `ETag` = versiya; cavabda `ref` (`media:<id>`) və `url` |
| `PATCH /{id}` | JSON Merge Patch; `If-Match` məcburi (428/412). `grant-requires-admin`, `deny-requires-reviewer` (403), `permission-not-applicable`, `unknown-field` |

- **İctimai:** `GET /api/v1/soundtracks?mood=&conflict=` — yalnız səsləndirilə bilən treklər. Bugünkü data-da hər iki trekin icazəsi gözlənilir, ona görə siyahı boşdur.
- **İdxal:** data-dakı lisenziyalı bütün fayllar `LINKED` kimi qeyd olunur (`importer@system.invalid` adından). Hesabatda `mediaRegistry: {registered, existing}` var. İkinci idxal heç nə qeyd etmir. Yalnız media qeyd olunubsa (dərc yoxdursa), `MediaAssetChanged` atılır.
- **Gecəlik iş:** `OrphanUploadCleanup` (`platform.media.orphan-cleanup-cron`, 03:30) — 24 saatdan köhnə, qeyd olunmamış `uploads/` obyektlərini silir.
- **Konfiqurasiya** (`platform.media.*`): `S3_ENDPOINT`, `S3_PRESIGN_ENDPOINT` (brauzerin gördüyü ünvan; presigned URL host-u imzalayır), `S3_REGION`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_MEDIA_BUCKET`, `MEDIA_PUBLIC_BASE_URL`; ölçü hədləri `max-size.{image,audio,geojson}`. Endpoint boşdursa AWS default-ları işləyir. Compose: SeaweedFS-də `anonymous` identity yalnız `Read:media` hüququna malikdir.
- **Testlər:**
  - unit: `FileTypeTests` (allowlist, imzalar, adı dəyişdirilmiş HTML), `PermissionPolicyTests`, `MediaPropertiesTests`, `PublicValuesTests` (reyestrə görə göstər/gizlət), `DocumentValidatorTests` (`media-not-found`, `media-permission`, `media-type`, lisenziya fərqi, reyestrdə AI);
  - inteqrasiya (S3 ilə: Testcontainers SeaweedFS, eyni image): `MediaFlowTests` (presigned yükləmə → qeydiyyat → anonim oxu; saxta PNG silinir; icazə qaydaları və `If-Match`; icazə verilir/ləğv olunur → hero fotosu ictimai API-də görünür/gizlənir; `/soundtracks`), `OrphanUploadCleanupTests`;
  - `ImportTests`: reyestr sayları, statuslar, `portrait.media_id`, ikinci idxal, `dryRun`; `PermissionMatrixTests`: 5 yeni endpoint.

## 17. Analitika (mərhələ 12)

Qərarlar: [ADR-0018](adr/0018-analytics.md).

```
Brauzer ─► POST /api/v1/events {sessionId, classCode?, events[≤50]}   (token oxunmur; application/json və ya text/plain)
             EventBodyLimitFilter (≤ 64 KB) ─► sərt JSON (naməlum sahə → 400) ─► EventRateLimiter (sessiya, ünvan)
             ─► EventRules (tip üzrə sahələr) ─► learning_event_YYYY_MM                       ─► 202 {accepted, rejected[]}
Gecə 02:15 (Asia/Baku) ─► DailyAggregation: son 3 gün → daily_aggregate (upsert) ─► retention (12 ay) ─► partition-lar (+2 ay)
ADMIN/TEACHER ─► /api/v1/analytics/* ─► yalnız daily_aggregate
```

- **Miqrasiya `V014__analytics`:**
  - `learning_event` (partition-lı) və `daily_aggregate`;
  - `analytics_ensure_partitions(n)`, `analytics_drop_partitions_before(cutoff)` (DDL `format('%I')` ilə, Java-da SQL birləşdirmə yoxdur).
- **Event-lər və sahələri:**

| `type` | sahib / addım | sahələr | `detail` |
|---|---|---|---|
| `simulation_started` | sahib məcburi | `mode?` | `story` / `learn` / boş |
| `step_viewed` | sahib + addım | `durationMs?` | — |
| `simulation_completed` | sahib | `durationMs?` | — |
| `simulation_abandoned` | sahib + addım (son addım) | — | — |
| `quiz_answered` | sahib + addım | `questionIndex` (0–4), `correct` | `q<i>` |
| `choice_made` | sahib + addım | `optionIndex` (0–3) | `o<i>` |
| `mode_switched` | sahib? | `mode` | rejim |
| `cross_link_followed` | sahib? addım? | `targetType`, `targetSlug` | `battle:chaldiran` |
| `legend_toggle` | sahib? addım? | `shown` | `shown` / `hidden` |
| `time_slider_used` | — | `year` | il |

  `ownerType`: `person`, `conflict`, `state`. `occurredAt` yalnız `[qəbul − 48 saat, qəbul + 5 dəq.]` aralığında qəbul olunur, əks halda qəbul vaxtı yazılır.
- **Endpoint-lər** (hamısı `no-store`):

| Metod və yol | Kim | Qeyd |
|---|---|---|
| `POST /api/v1/events` | hər kəs | `202`; `400` (forma, naməlum sahə, 0 və ya > 50 event), `413`, `429` + `Retry-After` |
| `GET /api/v1/analytics/quiz-difficulty?from=&to=&minAnswers=&limit=` | ADMIN | `[{ownerType, ownerSlug, stepKey, questionIndex, answers, wrong, wrongRate}]` |
| `GET /api/v1/analytics/drop-off?owner=person:<slug>&from=&to=` | ADMIN | `{started, completed, steps[{stepKey, views, abandoned, abandonRate}]}` |
| `GET /api/v1/analytics/classes/{code}?from=&to=` | TEACHER (öz sinfi) | `{code, name, period, simulations[], quizzes[], abandoned[]}`; başqasının sinfi `404` |
| `POST /api/v1/admin/analytics/aggregate?from=&to=` | ADMIN | günləri indi yenidən hesablayır |

- **Konfiqurasiya** (`platform.analytics.*`): `zone`, `max-batch`, `max-body`, `retention`, `recompute-days`, `per-session`, `per-address`, `aggregate-cron`.
- **Testlər:**
  - `EventRulesTests` (tip üzrə sahələr, saatın məhdudlaşdırılması);
  - `AnalyticsTests`, 7 test. Yoxlananlar:
    - sütunlarda şəxsi məlumat yoxdur, token oxunmur;
    - naməlum sahə `400` verir;
    - batch event-event yoxlanılır, `text/plain` qəbul olunur, `413`;
    - sessiya limiti işləyir;
    - toplama idempotentdir;
    - üç hesabat, başqa müəllimin sinfi `404`;
  - `RetentionTests` (köhnə partition silinir, cəmlər qalır);
  - `PermissionMatrixTests`: 5 yeni endpoint.
- **Frontend:** event-ləri mərhələ 14-dən göndərir (§19). Yalnız `NEXT_PUBLIC_ANALYTICS_URL` ilə build olunanda və brauzer DNT/GPC göndərmirsə.

## 18. Statik eksport (mərhələ 13)

Qərarlar: [ADR-0019](adr/0019-static-export.md).

```
ContentProjected ─► ExportScheduler (30 san. sakitlik, ən çox 5 dəq. gözləmə; startup-da gecikən versiya)
                       └─► StaticExporter: PublishedContents.allPublished() (position sırası)
                                ─► ExportMedia (icazəsiz fayl çıxır, media:<id> → URL)
                                ─► ExportLayout (DataFolder-in tərsi) ─► public-content/v{N}/data/…, v{N}/public/data/territories/…
                                ─► latest.json {contentVersion, prefix, generatedAt, fileCount, files[]}
ADMIN ─► POST /api/v1/admin/export (dərhal)
```

- **Miqrasiya `V015__document_position`:** `editorial_document.position`. İdxal onu faylın sırasından yazır.
- **Fayllar:** `data/persons/{s}/person.json`, `events.json`; `data/conflicts/{s}/conflict.json`, `days.json`, `settlements.json`, `commanders.json`, `heroes.json`, `soundtrack.json`, `battles/{b}.json`; `data/states/{s}/state.json`, `steps.json`; `data/polities/{s}.json`; `data/eras/`, `data/themes/`; ümumi `places`, `rulers`, `reigns`, `relations`, `glossary`, `commemorations`, `world-events`, `planned`; `data/territories/snapshots/{s}.json`, `registry.json`; `public/data/territories/{s}.json`.
- **API-lər:** `editorial.api.PublishedContents.allPublished()`, `media.api.PublicContentStore` (`public-content` bucket-i, `platform.media.s3.public-content-bucket`).
- **Konfiqurasiya** (`platform.export.*`): `enabled` (`EXPORT_ENABLED`), `debounce`, `max-delay`, `poll`.
- **Testlər:**
  - `ExportSchedulerTests`: debounce, maksimum gözləmə, söndürülmüş halı;
  - `StaticExportTests`:
    - idxal + eksport = `data/` + `public/data/territories` (fayllar, məzmun, sıra), dərc olunmayanlar çıxmaq şərtilə;
    - hər fayl `shared/schema`-dan keçir və `target/static-export`-a yazılır;
    - icazəsi götürülmüş portret eksportdan çıxır;
    - S3-ə versiyalı fayllar + manifest yazılır (S3 lazımdır);
  - `PermissionMatrixTests`: `POST /admin/export`.
- **Frontend yoxlaması:** `npx tsx scripts/validate-data.ts backend/target/static-export/data`. Skript indi qovluq arqumenti qəbul edir. 2026-11-14 nəticəsi:
  - Zod sxem xətası yoxdur;
  - 26 bütövlük xətası: müharibə günləri dərc olunmamış `y2020` snapshot-una istinad edirdi (§11-dəki data qeydi, 2026-11-22-də həll olunub);
  - qalanları eksport qovluğunun yanında olmayan şəkillər və `docs/*.md` faylları haqqındadır (mühitlə bağlıdır).

## 19. Frontend inteqrasiyası (mərhələ 14)

Qərarlar: [ADR-0020](adr/0020-frontend-integration.md).

```
NEXT_PUBLIC_DATA_SOURCE=static (defolt)   data/ ─────────────────────────────┐
NEXT_PUBLIC_DATA_SOURCE=api               public-content/latest.json         ├─► FileSystemRepository (Zod) ─► next build (UI eynidir)
  npm run build:api ─► pull-content.ts ─► .content/data, .content/public/…  ─┘
                                        └► public/data/territories (brauzer)

backend test ─► shared/openapi/public.json ─► npm run api:types ─► src/data/api/openapi.ts ─► analitika klienti
Brauzer (NEXT_PUBLIC_ANALYTICS_URL varsa, DNT/GPC yoxdursa) ─► sendBeacon text/plain ─► POST /api/v1/events
```

- **Frontend faylları:** `src/data/index.ts` (`dataSource`, `dataRoot`), `scripts/pull-content.ts`, `src/data/api/openapi.ts` (generasiya olunur), `src/lib/analytics/{client.ts, context.tsx, quiz.ts}`.
- **Event-lər** (§17-dəki cədvəl): `SimulationEngine`, `Quiz`, `RelatedLinks`, `SettingsPanel`, `TimeExplorer`. Sahib və addım `AnalyticsOwnerProvider` kontekstindən gəlir, quiz sualı isə öz addımını saxlayır (`quizOf`).
- **`scripts/validate-data.ts`:** istəyə bağlı qovluq arqumenti qəbul edir (§18).
- **CI:** `git diff --exit-code -- docs/modules shared/openapi`.
- **Testlər:**
  - backend `OpenApiExportTests`;
  - frontend `analytics.test.ts`:
    - batch, ən çox 50 event;
    - icazəli sahələr;
    - sessiya və sinif kodu;
    - DNT/endpoint olmayanda söndürülür;
    - `quizOf`, `dataSource`, `safePath`;
  - frontend `apiTypes.test.ts`: generasiya olunan tiplər aktualdır;
  - e2e `analytics.spec.ts`: brauzerdə bir səyahət `simulation_started`, `step_viewed`, `simulation_abandoned` göndərir, yalnız sessiya id-si ilə. Yalnız `NEXT_PUBLIC_ANALYTICS_URL` ilə build olunanda işləyir;
  - `timeline.spec.ts`-dəki köhnə yarış vəziyyəti düzəldildi.
- **Yoxlama (2026-11-14):** eksportdan və `data/`-dan build olunan saytlar 541 faylda müqayisə edildi (ADR-0020). Real fərq `y2020` və gözləyən treklərdir.

## 20. Əməliyyat bələdçisi (mərhələ 15)

Əvvəlki bölmələrdə səpələnmiş məlumatın xülasəsi. Qurulma addımları: [README → Backend](../README.md#backend).

**Mühit dəyişənləri** (hamısı `application.yml`-də `${…}` ilə bağlanır; sirlər yalnız mühitdən gəlir, şablon: [`docker/.env.example`](../docker/.env.example)):

| Dəyişən | Məcburi | Nə üçündür |
|---|---|---|
| `SPRING_DATASOURCE_URL`, `_USERNAME`, `_PASSWORD` | bəli | PostgreSQL 18 + PostGIS 3.7 |
| `JWT_SECRET` | bəli | HS256 açarı, Base64, ≥ 256 bit; yoxdursa tətbiq başlamır (§9) |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_DISPLAY_NAME` | ilk dəfə | ilk ADMIN hesabı; mövcud hesab dəyişdirilmir |
| `CORS_ALLOWED_ORIGINS` | sayt başqa origin-dədirsə | dəqiq origin-lər, vergüllə (§15) |
| `S3_ENDPOINT`, `S3_PRESIGN_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY`, `S3_SECRET_KEY` | media/eksport üçün | boşdursa AWS default-ları (§16) |
| `S3_MEDIA_BUCKET`, `MEDIA_PUBLIC_BASE_URL` | media üçün | yükləmələrin bucket-i və brauzerin oxuduğu ünvan |
| `EXPORT_ENABLED` | yox (`true`) | dərcdən sonra statik eksport (§18) |
| `IMPORT_DATA_DIR`, `IMPORT_BUILT_TERRITORIES_DIR` | yox | `POST /admin/import` üçün qovluqlar (§12) |
| `SPRING_PROFILES_ACTIVE` | yox | `local` (compose) və ya `prod` (yalnız `health` açıq, ECS JSON log) |

**Frontend build dəyişənləri:** `NEXT_PUBLIC_DATA_SOURCE` (`static` | `api`), `CONTENT_URL` və ya `CONTENT_DIR` (`api` rejimində eksportun yeri),
`NEXT_PUBLIC_ANALYTICS_URL` (verilməyibsə event göndərilmir), `NEXT_PUBLIC_BASE_PATH` (alt-yol).

**Planlı işlər** (bir instansiya nəzərdə tutulub; bir neçə instansiyada ShedLock və ya oxşar kilid lazım olacaq):

| İş | Vaxt | Açar |
|---|---|---|
| Tamamlanmamış proyeksiya event-lərinin təkrarı (`RetryIncompleteProjections`) | hər 1 dəq. | `platform.publishing.retry-interval` |
| Statik eksport (`ExportScheduler`) | dərcdən 30 san. sakitlik sonra, ən gec 5 dəq. | `platform.export.*` |
| Gündəlik analitika toplaması + retention + partition-lar (`DailyAggregation`) | 02:15 Asia/Baku | `platform.analytics.aggregate-cron` |
| Qeyd olunmamış yükləmələrin silinməsi (`OrphanUploadCleanup`) | 03:30 | `platform.media.orphan-cleanup-cron` |

**Flyway miqrasiyaları** (`backend/src/main/resources/db/migration`):

| Fayl | Mərhələ | Məzmun |
|---|---|---|
| `V001__extensions`, `V002__event_publication` | 1 | PostGIS, `pg_trgm`; Modulith event registry |
| `V003`–`V008` | 3 | ümumi funksiyalar, chronology, geo, catalog, theming, media proyeksiyaları (§8) |
| `V009__identity` | 4 | istifadəçilər, rollar, refresh token-lər |
| `V010__editorial` | 5 | sənədlər, revision-lar, şərhlər, jurnal, `content_version` |
| `V011__projection_adjustments` | 6 | proyeksiya sütunlarının düzəlişləri |
| `V012__class_group` | 10 | müəllim sinifləri |
| `V013__media_registry` | 11 | `origin`, `updated_at` |
| `V014__analytics` | 12 | partition-lı `learning_event`, `daily_aggregate` |
| `V015__document_position` | 13 | eksport sırası |
| `V016__document_assignee` | §22 | rəyçi təyinatı (`assignee_id`) |

Tətbiq olunmuş miqrasiya heç vaxt dəyişdirilmir; düzəliş yeni `V0NN` faylı ilədir.

**API xəritəsi** (`/api/v1`):

| Prefiks | Kim | Bölmə |
|---|---|---|
| `GET /persons`, `/conflicts`, `/states`, `/battles`, `/heroes`, `/relations`, `/places`, `/eras`, `/polities`, `/rulers`, `/themes`, `/soundtracks`, `/world-events` | hər kəs | §13, §16 |
| `GET /territories`, `/polities/at`, `/polities/{slug}/ruler`, `/timeline`, `/on-this-day`, `/places/{slug}/timeline`, `/compare`, `/search` | hər kəs | §14 |
| `POST /events` | hər kəs (anonim) | §17 |
| `/auth/*` | `login`, `refresh`: hər kəs; qalanı token ilə | §9, §15 |
| `/editorial/documents/*`, `/editorial/media/*` | AUTHOR, REVIEWER, ADMIN (təyinat: REVIEWER, ADMIN; ad dəyişmə: ADMIN) | §10, §16, §22 |
| `/teacher/classes/*` | TEACHER | §15 |
| `/analytics/*` | ADMIN; `classes/{code}` TEACHER | §17 |
| `/admin/import`, `/admin/projections/rebuild`, `/admin/broken-references`, `/admin/export`, `/admin/users`, `/admin/classes`, `/admin/analytics/aggregate` | ADMIN | §11–§18 |

Tam siyahı və sxemlər: `/swagger-ui.html`. İctimai hissənin təsviri repoda da var: `shared/openapi/public.json`.

**Generasiya olunan və commit edilən fayllar** (CI fərqi yoxlayır):

| Fayl | Kim yaradır | Nə vaxt yeniləmək lazımdır |
|---|---|---|
| `shared/schema/*.json` | `npm run schema:export` | `src/domain/schema.ts` dəyişəndə |
| `docs/modules/*` | backend `ModularityTests` | modul asılılıqları və ya event-lər dəyişəndə. Test faylı yalnız məzmun dəyişəndə yazır (`StableFiles`: sətirlərin sırası nəzərə alınmır) |
| `shared/openapi/public.json` | backend `OpenApiExportTests` | ictimai API dəyişəndə; sonra `npm run api:types` |
| `src/data/api/openapi.ts` | `npm run api:types` | `public.json` dəyişəndə |

**Testlər:** `./mvnw verify` (backend; Docker lazımdır: Testcontainers PostGIS və SeaweedFS qaldırır), `npm test`, `npm run test:e2e`.
Docker yoxdursa, backend testlərini mövcud PostGIS bazası ilə işlətmək olar:
`-Dspring.datasource.url=jdbc:postgresql://…`. Bu halda `TestcontainersConfiguration` konteyneri qaldırmır,
S3 testləri isə `-Dplatform.media.s3.endpoint=…` verilməyibsə ötürülür.

## 21. Açıq məsələlər

Mərhələlər bitəndən sonra qalanlar. Heç biri mövcud funksionallığı bloklamır.

| Məsələ | Harada | Qeyd |
|---|---|---|
| 2 soundtrack trekinin icazəsi gözlənilir | data, §16 | ADMIN icazə verənə qədər dərc olunmur, `/soundtracks` boşdur |
| Zod sxemlərinin `shared/schema`-dan generasiyası | ADR-0005, 3-cü addım | hazırda istiqamət Zod → JSON Schema-dır; ayrıca mərhələ kimi saxlanılıb |
| `NVD_API_KEY` repo secret-i | CI, §15 | açar olmadan Dependency-Check işləmir; secret-i repo sahibi əlavə etməlidir |
| Login limiti və planlı işlər bir instansiya üçündür | §15, §20 | üfüqi miqyaslamada paylaşılan vedrə və iş kilidi lazımdır |
| Reverse proxy arxasında real ünvan | §15 | forward başlıqları yalnız etibarlı proxy ilə açılmalıdır |
| Backend heç bir serverdə yerləşdirilməyib | §20 | canlı sayt (GitHub Pages) `data/`-dan build olunur; server seçimi qərar tələb edir |
| Redaksiya UI-si (CMS frontend-i) | BACKEND_SPEC §22 | spesifikasiyaya görə ayrıca layihədir; API və OpenAPI hazırdır |

**Həll olunanlar (2026-11-22, §22):** `y2020` poliqonu; `world_event` endpoint-i; `preview`; `assignedToMe` + təyinat; slug dəyişmə;
daxili naməlum açarlar; `Documenter`-in qeyri-sabit sırası (CI-ın `git diff` addımı bundan düşürdü); `docker compose up`-ın CI-da həqiqətən
qaldırılıb istifadə olunması.

## 22. Mərhələlərdən sonra (2026-11-22)

Spesifikasiyanın qalan bəndləri və §21-in açıq məsələləri. Qərarlar: [ADR-0021](adr/0021-preview-assignment-rename.md).

**Önizləmə** (BACKEND_SPEC §11): `GET /api/v1/editorial/documents/{id}/preview[?revision=&lang=]`, AUTHOR/REVIEWER/ADMIN.
- Kod `publishing`-dədir (`PreviewService`, `PreviewController`): ona proyeksiya writer-ləri lazımdır, `editorial → publishing` asılılığı isə dövr yaradardı.
- Revision dərcdəki writer-lərlə həmişə geri alınan tranzaksiyada proyeksiya olunur. Sonra hər modulun `shared.read.PreviewSource`-u onu ictimai formatda oxuyur: `CatalogPreview`, `GeoPreview`, `ChronologyPreview`, `ThemePreview`, `MediaPreview`.
- `ReadContext.asPreview()` `PublicCache`-dən keçmir: geri alınan sətirlər keşə düşmür. `content_version` dəyişmir.
- Cavab: `{documentId, type, slug, revisionNo, parts}`. Hissələr: şəxsiyyət `profile` + `steps`, müharibə `conflict` + `days`, dövlət `state` + `steps`, `battle`, `hero`, məkan `place` + `timeline`, snapshot `territories` (öz ili), `eras`, `polity`, `ruler`, `theme`, səslənə bilən `track`.
- Xətalar: `404` (sənəd/revision yoxdur), `400` (`revision < 1`), `422 preview-unavailable` (proyeksiya oluna bilmir).

**Rəyçi təyinatı:** `PUT /documents/{id}/assignee {assigneeId | null}`, REVIEWER/ADMIN; `GET /documents?assignedToMe=true`.
- Təyin olunan aktiv REVIEWER və ya ADMIN olmalıdır (`identity.api.Accounts.activeRoles`), əks halda `400`.
- Status dəyişmir; jurnalda `assign`. Miqrasiya `V016__document_assignee`.

**Ad dəyişmə** (BACKEND_SPEC §5.5): `POST /documents/{id}/rename {slug, changeNote?}`, yalnız ADMIN.
- Yeni revision yeni `id`-ni və sənədə geri işarə edən sətirləri daşıyır: şəxsiyyətin `events[].personId`, `relations[].from`; dövlətin `reigns[].polityId`; snapshot-un `built.id`. Sənəd `DRAFT`-a qayıdır.
- `slug_redirect`-ə köhnə → yeni yazılır. Köhnə adlar yenisinə yönəldilir, zəncir yaranmır. Əvvəlki ada qayıtmaq onun yönləndirməsini silir. Başqa sənədə yönləndirilən ad rədd olunur (`409 slug-redirected`).
- İctimai slug dərc olunmuş revision-ın öz `id`-sidir (`PublishedContents`). Yeni ad dərc olunana qədər köhnə slug ilə verilir; rebuild da belə edir. Dərcdən sonra köhnə link `301` verir.
- Başqa sənədlərin köhnə slug-a istinadları `/admin/broken-references`-də görünür.

**Dünya hadisələri:** `GET /api/v1/world-events`.
- `?year=&limit=` frontend-in `pickWorldEvents` qaydasıdır: ±12 il, ən yaxın əvvəl, hər regiondan biri, sonra xronoloji; `limit` 1–10, defolt 3.
- `?from=&to=` aralıqla kəsişən bütün hadisələri qaytarır (ən çox 1000 il).

**Naməlum açarlar:** `ContentSchemas.unknownKeys()` eyni sxemləri hər obyektə `unevaluatedProperties: false` əlavə edilmiş halda yoxlayır.
- `anyOf`/`oneOf`/`allOf` budaqları açıq qalır.
- `SchemaRule` tapılan açarları `WARNING unknown-key` kimi göstərir. Bugünkü `data/`-da belə açar yoxdur.

**CI:**
- `StableFiles` generasiya olunan faylı yalnız məzmun dəyişəndə yazır (`docs/modules`, `shared/openapi`).
- Yeni `compose` job-u `docker compose up --build --wait` ilə sistemi qaldırır: login, `POST /admin/import`, `/persons`, `/places/tebriz`, `/compare`.

**Testlər:** `PreviewTests`, `EditorialFlowTests` (təyinat), `ProjectionTests` (dərc → ad dəyişmə → köhnə link → yenidən dərc → `301` → əvvəlki ada qayıdış), `WorkflowTests`, `RenameInsideTests`, `WorldEventRulesTests`, `PublicApiTests` (dünya hadisələri), `ContentSchemasTests`, `DocumentValidatorTests`, `PublicCacheTests`, `PermissionMatrixTests` (3 yeni sətir).
