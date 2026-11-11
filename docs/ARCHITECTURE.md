# Arxitektura

> Mənbə: [`BACKEND_SPEC.md`](BACKEND_SPEC.md). Ondan fərqlər: [`adr/`](adr/README.md).
> Bu sənəd hər mərhələdə yenilənir. Son yeniləmə: mərhələ 1 (skelet).

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
- Modullar arası FK yoxdur (slug ilə bağlanır); modul daxilində FK var.
- Bütün PK-lar `uuid` (UUIDv7, tətbiqdə yaradılır), analytics istisna.

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
| `reign` | `id`, `polity_id → polity`, `ruler_id → ruler`, `start_year`, `start_month`, `end_year`, `end_month`, `certainty`, `note LT` | `INDEX (polity_id, start_year, end_year)` — üst-üstə düşmə icazəlidir |

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
| 2 | Paylaşılan sxem | növbəti |

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
