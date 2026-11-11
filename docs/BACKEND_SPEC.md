# Backend Spesifikasiyası: Azərbaycan Tarixi Simulyasiya Platforması

> Bu sənəd Claude Code üçün yazılıb. Repoya `docs/BACKEND_SPEC.md` kimi qoy və Claude Code-a de:
> "docs/BACKEND_SPEC.md faylını oxu və 0-cı mərhələdən başla."
>
> Bu spesifikasiyadan qəbul olunmuş fərqlər `docs/adr/` qovluğundadır (xülasə: `docs/adr/README.md`).

---

## 0. Claude Code üçün iş qaydaları

1. **Əvvəlcə plan, sonra kod.** Bu sənədi və mövcud `frontend/` kodunu (xüsusən `frontend/data/` və Zod sxemlərini) oxu. Sonra aşağıdakıları təqdim et və təsdiqimi gözlə:
   - yekun ER modeli (cədvəllər, əlaqələr, indekslər)
   - modul sərhədləri və modullar arası event-lər
   - bu sənəddən fərqləndiyin yerlər və səbəbləri
   - mərhələ planı
2. **Mərhələ-mərhələ işlə.** Hər mərhələ ayrıca, kiçik və məntiqli commit-lərlə. Bir commit = bir məqsəd. Mərhələ bitmədən növbətisinə keçmə.
3. **Hər mərhələnin sonunda hesabat ver:** nə edildi, hansı testlər yazıldı, hansı qərarlar qəbul olundu və niyə, açıq qalan suallar.
4. **Versiyaları yoxla.** Kitabxana və image versiyalarını yaddaşdan yazma. Ən son stabil versiyaları yoxla.
5. **Uydurma.** Bilmədiyin məqamı (məs. mövcud data-da bir sahənin mənası) mənə sual kimi ver, fərziyyə ilə doldurma.
6. **Mövcud frontend işləməyə davam etməlidir.** Backend hazır olana qədər frontend statik JSON ilə işləyir. Heç bir mərhələ onu sındırmamalıdır.
7. **Refaktorinqi ayrıca et.** Funksionallıq və refaktorinq eyni commit-də olmasın.

---

## 1. Kontekst və məqsəd

Platforma şagirdlərə Azərbaycan tarixini interaktiv simulyasiya kimi öyrədir. Üç kateqoriya var:

- **Şəxsiyyətlər:** Şah İsmayıl Xətai, Uzun Həsən, Nadir Şah Əfşar. Doğumdan ölümə qədər həyat mərhələləri xəritədə göstərilir.
- **Döyüşlər və müharibələr:** 44 günlük Vətən müharibəsi, gün-gün.
- **Dövlətlər:** Əfşarlar dövləti, mərhələ-mərhələ.

Kateqoriyalar bir-birinə bağlıdır: şəxsiyyətin həyatındakı döyüşdən həmin döyüşün simulyasiyasına keçmək olur. Xəritədə ölkəyə klik edildikdə seçilmiş ildəki hökmdar göstərilir. Qlobal zaman sürgüsü, məkan səhifələri, müqayisə rejimi, "Tarixdə bu gün", fakt/rəvayət ayrımı və dövrə uyğun tema sistemi var.

**Backend-in vəzifələri:**
1. Bütün məzmunun yeganə həqiqət mənbəyi olmaq
2. Redaksiya axınını (CMS) idarə etmək: yazır → yoxlanılır → dərc olunur
3. Frontend-ə sürətli, keşlənə bilən ictimai API vermək
4. Coğrafi və xronoloji sorğuları icra etmək (PostGIS)
5. Statik JSON eksportu yaratmaq (CDN və offline rejim üçün)
6. Anonim öyrənmə analitikasını toplamaq

**Gələcəkdə gələcəklər (indi qurma, amma arxitektura mane olmasın):** yüzlərlə şəxsiyyət, dövrlər üzrə naviqasiya, çoxdillilik (az, en, ru, tr), mobil tətbiq, "Rəqəmsal məktəb" inteqrasiyası, müəllim kabinetləri, RAG əsaslı "Tarixi şəxsiyyətdən soruş".

---

## 2. Texnologiya stack-i

| Sahə | Seçim |
|---|---|
| Dil | Java 21+ (LTS) |
| Framework | Spring Boot (ən son stabil), Spring Web MVC |
| Modullaşma | Spring Modulith |
| Baza | PostgreSQL + PostGIS, `pg_trgm` extension |
| ORM | Spring Data JPA + Hibernate, Hibernate Spatial (JTS) |
| Mürəkkəb sorğular | Native SQL və ya jOOQ (seçimini əsaslandır) |
| Migrasiya | Flyway |
| Təhlükəsizlik | Spring Security, JWT (access + refresh), Argon2 |
| Validasiya | Jakarta Validation (DTO), JSON Schema validator (redaksiya sənədləri) |
| JSON | Jackson, JSONB üçün Hibernate tip dəstəyi |
| API sənədləşmə | springdoc-openapi |
| Media saxlama | S3-uyğun (lokalda MinIO), AWS SDK v2 |
| Cache | Caffeine |
| Rate limiting | Bucket4j |
| Test | JUnit 5, AssertJ, Testcontainers (PostGIS image), Spring Modulith test, MockMvc / RestAssured |
| Build | Maven və ya Gradle (seçimini əsaslandır) |
| Konteyner | Docker, Docker Compose |
| Müşahidə | Spring Boot Actuator, Micrometer, strukturlaşdırılmış JSON loglar |

DTO-lar üçün Java `record` istifadə et. Lombok-dan yalnız entity-lərdə və minimal səviyyədə istifadə et.

---

## 3. Repo strukturu

```
/
├── backend/
│   ├── src/main/java/az/tarix/platform/
│   │   ├── PlatformApplication.java
│   │   ├── shared/            # ümumi tiplər: HistoricalDate, LocalizedText, EntityRef, xəta formatı
│   │   ├── catalog/
│   │   ├── geo/
│   │   ├── chronology/
│   │   ├── theming/
│   │   ├── media/
│   │   ├── editorial/
│   │   ├── publishing/
│   │   ├── analytics/
│   │   └── identity/
│   ├── src/main/resources/
│   │   ├── db/migration/      # Flyway
│   │   └── application*.yml
│   └── src/test/java/...
├── frontend/                  # mövcud Next.js
├── shared/schema/             # JSON Schema: məzmun sxeminin YEGANƏ mənbəyi
├── docker/
│   ├── docker-compose.yml
│   └── init/
└── docs/
    ├── BACKEND_SPEC.md        # bu sənəd
    ├── ARCHITECTURE.md        # Claude Code yaradır və yeniləyir
    └── adr/                   # memarlıq qərarları (ADR)
```

Əsas paket adı (`az.tarix.platform`) nümunədir. Layihə adı müəyyənləşəndə dəyişdiriləcək.

**Hər modulun daxili strukturu:**
```
catalog/
├── api/          # açıq servis interfeysləri, DTO-lar, event-lər (digər modullar yalnız bunu görür)
├── internal/
│   ├── domain/   # entity-lər, domen qaydaları
│   ├── persistence/
│   ├── service/
│   └── web/      # controller-lər
└── package-info.java  # @ApplicationModule
```

---

## 4. Memarlıq

### 4.1. Modular monolit

Tək deploy olunan tətbiq, daxildə Spring Modulith ilə ayrılmış modullar. Qaydalar:
- Modul digər modulun yalnız `api` paketinə müraciət edə bilər.
- Modullar arası yazma əməliyyatları domen event-ləri ilə (`@ApplicationModuleListener`) olur.
- Event-lər Spring Modulith-in event publication registry-si ilə saxlanılsın (itməsin, təkrar işlənə bilsin).
- `ApplicationModules.of(PlatformApplication.class).verify()` testi həmişə keçməlidir.
- Modul diaqramı (`Documenter`) avtomatik generasiya olunub `docs/`-a yazılsın.

### 4.2. Redaksiya sənədi + oxuma proyeksiyası (yüngül CQRS)

```
Redaktor ──► editorial (JSONB sənəd, versiyalar, status axını)
                 │
                 │  PUBLISHED olanda: ContentPublished event
                 ▼
            publishing ──► proyeksiya cədvəlləri (catalog, geo, chronology, theming)
                 │                      │
                 │                      ▼
                 │              İctimai API (yalnız oxuma, keşlənir)
                 ▼
            Statik JSON eksportu (MinIO / CDN)
```

- **Yazma tərəfi:** hər məzmun vahidi `editorial_document` + `editorial_revision` (JSONB) kimi saxlanılır. Revision `shared/schema` ilə validasiya olunur.
- **Oxuma tərəfi:** normallaşdırılmış, indekslənmiş cədvəllər. İctimai API yalnız buradan oxuyur.
- **Dərc əməliyyatı:** bir tranzaksiyada həmin sənədin proyeksiya sətirləri silinib yenidən yazılır.
- **Yenidən qurma:** bütün proyeksiyanı dərc olunmuş revision-lardan sıfırdan qurmaq üçün admin əməliyyatı olsun (`POST /api/v1/admin/projections/rebuild`). Bu, sxem dəyişəndə və xəta olanda həyat qurtarır.

Bu yanaşmanın üstünlükləri: versiyalama və diff asan olur, mövcud JSON birbaşa idxal olunur, frontend və backend eyni sxemi paylaşır, ictimai API sürətli qalır. Plan mərhələsində bunu qısa ADR kimi yaz.

---

## 5. Ümumi domen tipləri (`shared`)

### 5.1. `HistoricalDate`
Java `LocalDate` istifadə etmə: eramızdan əvvəlki tarixləri və natamam dəqiqliyi dəstəkləmir.

```java
public record HistoricalDate(
    int year,              // mənfi = e.ə.
    Integer month,         // null ola bilər
    Integer day,           // null ola bilər
    DatePrecision precision,   // YEAR | MONTH | DAY
    Certainty certainty        // EXACT | APPROXIMATE | DISPUTED
) {
    public long sortKey() { ... }   // year * 10000 + (month ?? 0) * 100 + (day ?? 0)
}
```
Validasiya: `precision = DAY` isə `month` və `day` məcburidir və real tarix olmalıdır. Bazada sütunlar: `*_year`, `*_month`, `*_day`, `*_precision`, `*_certainty`, `*_sort_key` (indeksli).

### 5.2. `LocalizedText`
JSONB: `{ "az": "...", "en": "...", "ru": "..." }`. `az` məcburidir. API `Accept-Language` və ya `?lang=` ilə dil seçir, olmayan dil üçün `az`-a qayıdır.

### 5.3. `EntityRef`
```java
public record EntityRef(EntityType type, String slug) {}
// EntityType: PERSON, CONFLICT, BATTLE, STATE, PLACE, POLITY, RULER, ERA, HERO
```
Referanslar **slug** ilə saxlanılır, ID ilə yox. Hədəf hələ mövcud olmaya bilər (gələcək məzmun). Bu xəta deyil. Hədəf dərc olunanda keçid avtomatik aktivləşir.

### 5.4. Enum-lar
- `Mood`: `BIRTH, CHILDHOOD, HARDSHIP, EXILE, JOURNEY, RISE, CORONATION, BATTLE, VICTORY, DEFEAT, PEACE, DIPLOMACY, CULTURE, DECLINE, DEATH, REMEMBRANCE, TRIUMPH`
- `ClaimType`: `FACT, DISPUTED, LEGEND, LITERARY`
- `PlaceType`: `CAPITAL, CITY, FORTRESS, SHRINE, BATTLEFIELD, PORT, VILLAGE, REGION`
- `StepKind`: `LIFE_EVENT, WAR_DAY, STATE_STEP`
- `PermissionStatus`: `PENDING, GRANTED, NOT_REQUIRED, DENIED`

### 5.5. Slug qaydaları
Kiçik latın hərfləri, rəqəmlər və tire: `^[a-z0-9]+(-[a-z0-9]+)*$`. Azərbaycan hərfləri transliterasiya olunur (`şah-ismayıl` → `shah-ismail`). Slug dərcdən sonra dəyişdirilə bilməz (köhnə linklər sınmasın). Dəyişmək lazım olsa, `slug_redirect` cədvəli ilə yönləndirmə olsun.

---

## 6. Redaksiya sənəd tipləri

Hər sənədin `type` və `slug` sahəsi var. Sxemlər `shared/schema/` qovluğundadır.

| Sənəd tipi | Məzmunu | Proyeksiya edildiyi modul |
|---|---|---|
| `PERSON` | şəxsiyyət + həyat mərhələləri + portretlər | catalog, media |
| `CONFLICT` | müharibə + günlər + əməliyyatlar | catalog |
| `BATTLE` | ayrıca döyüş (tərəflər, komandanlar, nəticə) | catalog |
| `STATE` | dövlət simulyasiyası + mərhələlər | catalog |
| `PLACE` | məkan (tarixi/müasir adlar, koordinat, tip) | geo |
| `POLITY` | siyasi qurum (bayraq, rənglər) + hakimiyyət dövrləri (reign-lər) | chronology |
| `RULER` | hökmdar (ad, titullar, sülalə, portretlər) | chronology |
| `ERA` | dövr (illər, təsvir, tema) | chronology |
| `THEME` | vizual tema (palitra, şriftlər, teksturalar, musiqi) | theming |
| `TERRITORY_SNAPSHOT` | il üzrə sərhədlər (GeoJSON FeatureCollection) | geo |
| `HERO` | qəhrəman / şəhid (rütbə, doğum yeri, təltiflər, foto) | catalog |
| `SOURCE` | mənbə (kitab, məqalə, rəsmi sayt) | catalog |

---

## 7. Verilənlər bazası

### 7.1. Extension-lar (ilk migrasiya)
```sql
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
```

### 7.2. Azərbaycan dili üçün axtarış funksiyası
PostgreSQL-də Azərbaycan dili üçün hazır lüğət yoxdur. Hərfləri sadələşdirən `IMMUTABLE` funksiya yaz və indekslərdə istifadə et:
```sql
CREATE FUNCTION az_fold(input text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT lower(translate(input,
    'ƏəIıİiŞşÇçĞğÖöÜü',
    'eeiiiisscgggoouu'))
$$;
```
(Xəritələməni diqqətlə yoxla: `I`/`ı`/`İ` hərflərinin `lower()` davranışı lokaldan asılıdır. Test yaz.) Axtarış: `pg_trgm` + `GIN (az_fold(name) gin_trgm_ops)`. Beləliklə "seh ismayil" yazan istifadəçi "Şah İsmayıl"ı tapır.

### 7.3. Redaksiya cədvəlləri (`editorial`)

```sql
CREATE TABLE editorial_document (
  id               uuid PRIMARY KEY,
  doc_type         varchar(32)  NOT NULL,
  slug             varchar(120) NOT NULL,
  status           varchar(32)  NOT NULL,     -- DRAFT, IN_REVIEW, CHANGES_REQUESTED, APPROVED, PUBLISHED, ARCHIVED
  current_revision_id   uuid,
  published_revision_id uuid,
  created_by       uuid NOT NULL,
  created_at       timestamptz NOT NULL,
  updated_at       timestamptz NOT NULL,
  version          bigint NOT NULL,           -- optimistic locking
  UNIQUE (doc_type, slug)
);

CREATE TABLE editorial_revision (
  id            uuid PRIMARY KEY,
  document_id   uuid NOT NULL REFERENCES editorial_document(id),
  revision_no   int  NOT NULL,
  schema_version int NOT NULL,
  content       jsonb NOT NULL,
  author_id     uuid NOT NULL,
  change_note   text,
  created_at    timestamptz NOT NULL,
  UNIQUE (document_id, revision_no)
);

CREATE TABLE review_comment (
  id            uuid PRIMARY KEY,
  revision_id   uuid NOT NULL REFERENCES editorial_revision(id),
  field_path    varchar(500),               -- JSON Pointer, məs. /steps/3/factualSummary/az
  body          text NOT NULL,
  author_id     uuid NOT NULL,
  resolved      boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL
);

CREATE TABLE status_transition_log (
  id            uuid PRIMARY KEY,
  document_id   uuid NOT NULL REFERENCES editorial_document(id),
  from_status   varchar(32),
  to_status     varchar(32) NOT NULL,
  actor_id      uuid NOT NULL,
  comment       text,
  created_at    timestamptz NOT NULL
);

CREATE TABLE slug_redirect (
  doc_type  varchar(32)  NOT NULL,
  old_slug  varchar(120) NOT NULL,
  new_slug  varchar(120) NOT NULL,
  PRIMARY KEY (doc_type, old_slug)
);

CREATE TABLE content_version (           -- tək sətir; hər dərcdə artır, ETag üçün
  id     smallint PRIMARY KEY DEFAULT 1,
  value  bigint NOT NULL
);
```

### 7.4. Proyeksiya cədvəlləri (əsas sahələr)

Bütün proyeksiya cədvəllərində `document_id` (mənbə sənəd) sütunu olsun ki, dərc zamanı sil-yenidən-yaz asan olsun.

**chronology**
```sql
era (id, slug UNIQUE, name jsonb, start_year int, end_year int, description jsonb, theme_slug, color, sort_order, document_id)

polity (id, slug UNIQUE, name jsonb, short_name jsonb, color, flag_media_id, emblem_media_id,
        start_year, end_year, description jsonb, document_id)

ruler (id, slug UNIQUE, name jsonb, titles jsonb, dynasty jsonb,
       birth_* (HistoricalDate sütunları), death_* , person_slug (şəxsiyyət səhifəsi varsa), document_id)

reign (id, polity_id FK, ruler_id FK, start_year int, start_month, start_day,
       end_year int NULL, end_month, end_day, certainty, note jsonb, document_id)
  -- INDEX (polity_id, start_year, end_year)
  -- Eyni dövlətdə üst-üstə düşən hakimiyyət mümkündür (həmhökmdarlar, iddiaçılar). Bunu qadağan etmə.
```

**geo**
```sql
place (id, slug UNIQUE, historical_name jsonb, modern_name jsonb, place_type,
       location geometry(Point, 4326) NOT NULL, importance smallint,
       description jsonb, document_id)
  -- GIST (location), GIN (az_fold(...) gin_trgm_ops)

territory_snapshot (id, slug UNIQUE, valid_from_year int, valid_to_year int,
                    certainty, description jsonb, document_id)
  -- INDEX (valid_from_year, valid_to_year)

polity_territory (id, snapshot_id FK, polity_id FK, geometry geometry(MultiPolygon, 4326) NOT NULL,
                  capital_place_id FK NULL, status jsonb, certainty, source_id NULL)
  -- GIST (geometry)
  -- geometry_simplified geometry(MultiPolygon, 4326): kiçik zoom üçün sadələşdirilmiş versiya (ST_SimplifyPreserveTopology)
```

**catalog**
```sql
person (id, slug UNIQUE, name jsonb, titles jsonb, birth_*, death_*,
        birth_place_id, death_place_id, short_bio jsonb, era_slugs text[], tags text[],
        theme_slug, document_id)

conflict (id, slug UNIQUE, name jsonb, display_title jsonb, start_*, end_*,
          summary jsonb, theme_slug, document_id)

battle (id, slug UNIQUE, name jsonb, date_*, place_id, conflict_slug NULL,
        sides jsonb, commanders jsonb, forces jsonb, outcome jsonb, significance jsonb, document_id)

state_profile (id, slug UNIQUE, polity_slug, name jsonb, start_year, end_year,
               summary jsonb, theme_slug, document_id)

hero (id, slug UNIQUE, full_name jsonb, rank jsonb, birth_place jsonb, birth_year,
      death_date_*, awards jsonb, bio jsonb, photo_media_id NULL, is_real_modern_person boolean, document_id)

simulation_step (
  id uuid PRIMARY KEY,
  owner_type varchar(16) NOT NULL,      -- PERSON | CONFLICT | STATE
  owner_slug varchar(120) NOT NULL,
  step_key   varchar(120) NOT NULL,     -- dərin link üçün sabit açar, məs. "1501-tabriz-coronation"
  sequence   int NOT NULL,
  step_kind  varchar(16) NOT NULL,
  date_* (HistoricalDate sütunları),
  title jsonb NOT NULL,
  factual_summary jsonb,
  narrative jsonb,
  mood varchar(32) NOT NULL,
  claim_type varchar(16) NOT NULL,
  location_id uuid NULL REFERENCES place(id),
  from_location_id uuid NULL REFERENCES place(id),
  route geometry(LineString, 4326) NULL,
  territory_snapshot_id uuid NULL,
  age_at_event int NULL,                -- şəxsiyyət üçün dərcdə hesablanır
  details jsonb,                        -- tipə xas: war day üçün liberatedPlaces, heroes; choice, quiz və s.
  document_id uuid NOT NULL,
  UNIQUE (owner_type, owner_slug, step_key),
  UNIQUE (owner_type, owner_slug, sequence)
);
-- INDEX (date_sort_key), INDEX (date_month, date_day) WHERE date_precision = 'DAY'  -- "Tarixdə bu gün"
-- GIST (route)

source (id, slug UNIQUE, title text, authors text, publisher text, year int,
        url text, source_type, reliability_note jsonb, document_id)

step_source (step_id FK, source_id FK, locator text)   -- locator: səhifə, fəsil və s.

entity_relation (
  source_type varchar(16), source_slug varchar(120), source_step_key varchar(120) NULL,
  target_type varchar(16), target_slug varchar(120), target_step_key varchar(120) NULL,
  relation_type varchar(32),            -- PARTICIPATED_IN, RULED, FAMILY, RIVAL, SUCCESSOR, LOCATED_IN, RELATED
  label jsonb NULL,
  document_id uuid NOT NULL
);
-- INDEX (source_type, source_slug), INDEX (target_type, target_slug)
```

**theming**
```sql
theme (id, slug UNIQUE, palette jsonb, fonts jsonb, textures jsonb, ornaments jsonb,
       background_art jsonb, ambient_effect varchar, map_style_variant varchar,
       mood_overrides jsonb, music_theme_slug, document_id)
```

**media**
```sql
media_asset (
  id uuid PRIMARY KEY,
  storage_key text NOT NULL,
  media_type varchar(16) NOT NULL,      -- IMAGE | AUDIO | GEOJSON
  mime_type varchar(100), size_bytes bigint, width int, height int, duration_ms int,
  title jsonb, caption jsonb,
  license varchar(100) NOT NULL,
  source_url text, rights_holder text,
  permission_status varchar(16) NOT NULL,
  is_ai_generated boolean NOT NULL DEFAULT false,
  ai_disclosure_label jsonb,            -- "Rəssam təsəvvürü (AI illüstrasiya)"
  uploaded_by uuid, created_at timestamptz
);

portrait (id, owner_type, owner_slug, age_from int, age_to int,
          media_id FK, kind varchar(16), sort_order, document_id)
          -- kind: HISTORICAL | ARTWORK | AI_ILLUSTRATION | PHOTO

soundtrack_track (id, slug UNIQUE, title jsonb, performer text, media_id FK,
                  moods text[], permission_status, rights_holder, document_id)
```

**identity**
```sql
app_user (id, email UNIQUE, password_hash, display_name, enabled, created_at)
user_role (user_id, role)               -- AUTHOR, REVIEWER, ADMIN, TEACHER
refresh_token (id, user_id, token_hash, expires_at, revoked_at, replaced_by)
class_group (id, code UNIQUE, name, teacher_id, created_at)   -- müəllim sinfi; şagird hesabı YOXDUR
```

**analytics**
```sql
learning_event (
  id bigserial,
  occurred_at timestamptz NOT NULL,
  session_id uuid NOT NULL,             -- klient tərəfindən yaradılan anonim ID, IP yoxdur
  class_code varchar(16) NULL,
  event_type varchar(40) NOT NULL,
  owner_type varchar(16), owner_slug varchar(120), step_key varchar(120),
  payload jsonb
) PARTITION BY RANGE (occurred_at);     -- aylıq partition-lar
-- daily_aggregate cədvəli: gecə toplanır, xam event-lər 12 aydan sonra silinir
```

### 7.5. Migrasiya qaydaları
- Migrasiya faylları ardıcıl: `V001__extensions.sql`, `V002__editorial.sql`, ...
- Tətbiq edilmiş migrasiya **heç vaxt dəyişdirilmir**. Düzəliş yeni migrasiya ilə olur.
- Hər migrasiya Testcontainers testində sıfırdan tətbiq olunur.
- `spring.jpa.hibernate.ddl-auto=validate`.

---

## 8. Redaksiya axını

### 8.1. Status maşını

```
DRAFT ──submit──► IN_REVIEW ──approve──► APPROVED ──publish──► PUBLISHED
  ▲                  │                                             │
  │             request_changes                                    │ yeni revision
  │                  ▼                                             ▼
  └────────── CHANGES_REQUESTED                          DRAFT (yeni revision; dərc olunmuş versiya ictimai qalır)

İstənilən status ──archive──► ARCHIVED (yalnız ADMIN)
```

Vacib: dərc olunmuş sənədə yeni dəyişiklik edildikdə köhnə versiya ictimai API-də qalır. Yeni versiya ayrıca axından keçib dərc olunana qədər ictimaiyyət onu görmür.

### 8.2. İcazələr

| Keçid | AUTHOR | REVIEWER | ADMIN |
|---|---|---|---|
| Sənəd yarat / redaktə et | ✓ (öz sənədi) | ✓ | ✓ |
| `submit` | ✓ | ✓ | ✓ |
| `request_changes` | ✗ | ✓ | ✓ |
| `approve` | ✗ | ✓ (başqasının sənədi) | ✓ |
| `publish` | ✗ | ✗ | ✓ |
| `archive` | ✗ | ✗ | ✓ |
| Əvvəlki revision-a qayıt (yeni revision kimi) | ✓ | ✓ | ✓ |

Qayda: **heç kim öz yazdığı revision-ı təsdiqləyə bilməz.** Bütün keçidlər `status_transition_log`-a yazılsın.

### 8.3. Dərcdən əvvəl validasiya

`GET /api/v1/editorial/documents/{id}/validation` hesabat qaytarır. `ERROR` səviyyəli problem varsa, `publish` bloklanır.

| Qayda | Səviyyə |
|---|---|
| JSON Schema-ya uyğunsuzluq | ERROR |
| `claimType = FACT` olan addımda mənbə yoxdur | ERROR |
| `DISPUTED` addımda alternativ versiya yoxdur | WARNING |
| `LEGEND` addımda rəvayətin mənşəyi göstərilməyib | WARNING |
| Məkan referansı mövcud deyil | ERROR |
| `EntityRef` hədəfi mövcud deyil | INFO (gələcək məzmun ola bilər) |
| Media-da lisenziya yoxdur | ERROR |
| Media `permission_status` = `PENDING` və ya `DENIED` | ERROR (prod-a düşə bilməz) |
| Real müasir şəxs (`HERO`, 2020 dövlət xadimləri) üçün `is_ai_generated` portret | ERROR |
| `sequence` ardıcıllığı pozulub və ya təkrarlanır | ERROR |
| Tarix `DAY` dəqiqliyindədir, amma real tarix deyil (31 fevral) | ERROR |
| Şəxsiyyətin addım tarixi doğumdan əvvəl və ya ölümdən sonradır | ERROR |
| `az` dilində mətn boşdur | ERROR |
| `en`/`ru` tərcüməsi yoxdur | INFO |
| Ərazi poliqonu etibarsızdır (`ST_IsValid = false`) | ERROR |
| Marşrutun başlanğıcı/sonu `from_location`/`location` ilə uyğun gəlmir (>5 km) | WARNING |

### 8.4. Versiya fərqi (diff)
`GET /api/v1/editorial/documents/{id}/diff?from=3&to=5`: JSON Patch (RFC 6902) formatında fərq. Rəyçi nəyin dəyişdiyini görür.

---

## 9. Dərc və proyeksiya (`publishing`)

1. `editorial` `publish` əməliyyatında `ContentPublished(documentId, docType, slug, revisionId)` event-i atır.
2. `publishing` event-i dinləyir və sənəd tipinə görə uyğun proyektoru çağırır (`PersonProjector`, `TerritorySnapshotProjector` və s.).
3. Proyektor bir tranzaksiyada həmin `document_id`-yə aid bütün proyeksiya sətirlərini silir və yenidən yazır.
4. Dərc zamanı hesablanan sahələr: `age_at_event`, `date_sort_key`, sadələşdirilmiş geometriyalar, `az_fold` sahələri.
5. `content_version` artırılır, Caffeine cache təmizlənir.
6. `ContentProjected` event-i atılır → statik eksport işə düşür (debounce: 30 saniyə ərzində gələn dərclər birləşdirilir).
7. Proyeksiya uğursuz olsa, event registry-də qalır, səhv loglanır və təkrar cəhd edilir. Sənədin statusu dəyişmir.

**Arxivləmə:** `ContentArchived` event-i proyeksiya sətirlərini silir.

---

## 10. İctimai API

**Ümumi qaydalar:**
- Baza yolu: `/api/v1`. Autentifikasiya yoxdur, yalnız `GET`.
- Dil: `?lang=az|en|ru` və ya `Accept-Language`. Cavabdakı lokallaşdırılmış sahələr seçilmiş dildə sadə string olur. `?lang=all` bütün dilləri JSON obyekt kimi qaytarır (CMS önizləməsi üçün).
- `ETag: "cv-{content_version}"`, `Cache-Control: public, max-age=300, stale-while-revalidate=86400`. `If-None-Match` → `304`.
- Səhifələmə: `?page=0&size=20` (maks. 100). Cavabda `page`, `size`, `totalElements`.
- Xəta formatı: RFC 9457 Problem Details (`application/problem+json`).
- Köhnə slug ilə sorğu → `301` yeni slug-a.
- Yalnız `permission_status ∈ {GRANTED, NOT_REQUIRED}` olan media qaytarılır.

### 10.1. Endpoint-lər

| Metod və yol | Təsvir |
|---|---|
| `GET /persons` | siyahı (kartlar üçün: ad, illər, dövr, portret, tema) |
| `GET /persons/{slug}` | tam profil + əlaqələr |
| `GET /persons/{slug}/steps` | bütün həyat mərhələləri (sıralı) |
| `GET /persons/{slug}/steps/{stepKey}` | tək mərhələ (dərin link üçün) |
| `GET /conflicts`, `/conflicts/{slug}`, `/conflicts/{slug}/days` | müharibə və günləri |
| `GET /battles/{slug}` | döyüş |
| `GET /states`, `/states/{slug}`, `/states/{slug}/steps` | dövlət simulyasiyası |
| `GET /heroes/{slug}` | qəhrəman |
| `GET /places/{slug}` | məkan |
| `GET /places/{slug}/timeline` | həmin məkanla bağlı bütün kateqoriyalardan addımlar, xronoloji |
| `GET /places?bbox=minLng,minLat,maxLng,maxLat&minImportance=` | xəritə görünüşündəki məkanlar |
| `GET /timeline?year=` | həmin ilin snapshot-ı, hökmdarlar, sağ olan şəxsiyyətlər, hadisələr |
| `GET /territories?year=&simplified=true` | GeoJSON FeatureCollection (xəritə layı) |
| `GET /polities/at?lat=&lng=&year=` | nöqtə həmin il hansı dövlətdə idi |
| `GET /polities/{slug}` | dövlət məlumatı |
| `GET /polities/{slug}/ruler?year=` | hökmdar paneli |
| `GET /rulers/{slug}` | hökmdar |
| `GET /relations?type=&slug=` | entity-nin bütün əlaqələri (aktiv/passiv bayrağı ilə) |
| `GET /on-this-day?month=&day=` | "Tarixdə bu gün" (boşdursa, həmin ay üzrə fallback) |
| `GET /compare?a=person:shah-ismail&b=person:uzun-hasan` | paralel timeline və kəsişmələr |
| `GET /search?q=&types=` | axtarış (`az_fold` + trigram) |
| `GET /eras`, `/themes/{slug}` | dövrlər, temalar |
| `GET /soundtracks?mood=` | icazəli treklər |

### 10.2. Nümunə cavab: `GET /api/v1/persons/shah-ismail/steps?lang=az`

```json
{
  "owner": { "type": "PERSON", "slug": "shah-ismail" },
  "contentVersion": 42,
  "steps": [
    {
      "stepKey": "1487-ardabil-birth",
      "sequence": 1,
      "kind": "LIFE_EVENT",
      "date": { "year": 1487, "month": 7, "day": 17, "precision": "DAY", "certainty": "APPROXIMATE" },
      "ageAtEvent": 0,
      "title": "Ərdəbildə doğuluş",
      "factualSummary": "...",
      "narrative": "...",
      "mood": "BIRTH",
      "claimType": "FACT",
      "location": { "slug": "ardabil", "name": "Ərdəbil", "lat": 38.25, "lng": 48.29, "type": "CITY" },
      "fromLocation": null,
      "route": null,
      "territorySnapshot": "1487-aq-qoyunlu",
      "portrait": { "url": "...", "kind": "AI_ILLUSTRATION", "disclosure": "Rəssam təsəvvürü (AI illüstrasiya)" },
      "sources": [ { "slug": "...", "title": "...", "locator": "s. 112" } ],
      "related": [
        { "type": "PERSON", "slug": "uzun-hasan", "relation": "FAMILY", "label": "Ana babası", "available": true }
      ],
      "details": { }
    }
  ]
}
```

### 10.3. Əsas sorğuların məntiqi
- **`/polities/at`:** `year` üçün `valid_from_year <= year <= valid_to_year` olan snapshot tapılır, sonra `ST_Contains(geometry, ST_SetSRID(ST_MakePoint(lng, lat), 4326))`. Bir neçə nəticə ola bilər (mübahisəli ərazilər). Hamısını qaytar.
- **`/polities/{slug}/ruler`:** `start_year <= year AND (end_year IS NULL OR end_year >= year)`. Bir neçə nəticə ola bilər (həmhökmdarlar). Hamısını qaytar.
- **`/timeline`:** sağ olan şəxsiyyətlər `birth_year <= year <= death_year` ilə. Data olmayan illər üçün `"coverage": "NONE"` bayrağı qaytar.
- **`/compare`:** kəsişmə = eyni `place` (və ya 25 km radius) + eyni il, və ya eyni `BATTLE` referansı.

---

## 11. Redaksiya API (`/api/v1/editorial`, JWT)

| Metod və yol | Təsvir |
|---|---|
| `GET /documents?type=&status=&q=&assignedToMe=` | siyahı |
| `POST /documents` | yeni sənəd (ilk revision ilə) |
| `GET /documents/{id}` | sənəd + cari revision |
| `PUT /documents/{id}` | yeni revision (`If-Match: version` məcburi) |
| `GET /documents/{id}/revisions` | revision tarixçəsi |
| `GET /documents/{id}/diff?from=&to=` | JSON Patch fərqi |
| `POST /documents/{id}/revert?to=` | köhnə revision-dan yeni revision |
| `GET /documents/{id}/validation` | validasiya hesabatı |
| `POST /documents/{id}/transitions` | `{ "action": "submit|approve|request_changes|publish|archive", "comment": "..." }` |
| `GET /documents/{id}/comments`, `POST .../comments`, `PATCH .../comments/{cid}` | rəy şərhləri |
| `GET /documents/{id}/preview` | dərc olunmamış revision-ın ictimai API formatında önizləməsi |
| `POST /media/uploads` | presigned URL al (MinIO-ya birbaşa yükləmə) |
| `POST /media` | yüklənmiş faylı qeyd et (lisenziya sahələri məcburi) |
| `PATCH /media/{id}` | lisenziya / icazə statusunu yenilə (yalnız ADMIN `GRANTED` edə bilər) |
| `GET /admin/broken-references` | mövcud olmayan hədəfə işarə edən bütün referanslar |
| `POST /admin/projections/rebuild` | bütün proyeksiyanı sıfırdan qur (ADMIN) |
| `POST /admin/export` | statik eksportu əl ilə işə sal (ADMIN) |

---

## 12. Analitika (`analytics`)

- `POST /api/v1/events`: batch (maks. 50 event), auth yoxdur.
- **Məxfilik (məcburi):**
  - DTO-da yalnız icazə verilmiş sahələr olsun. Şəxsi məlumat sahəsi ümumiyyətlə olmasın.
  - IP ünvanı saxlanılmasın. Bu endpoint üçün access log-larda da IP maskalansın.
  - `session_id` klient tərəfindən yaradılan təsadüfi UUID-dir, hesabla əlaqəsi yoxdur.
  - Xam event-lər 12 aydan sonra silinsin, yalnız toplu statistika qalsın.
- **Event tipləri:** `simulation_started`, `step_viewed`, `simulation_completed`, `simulation_abandoned`, `quiz_answered`, `choice_made`, `mode_switched`, `cross_link_followed`, `legend_toggle`, `time_slider_used`.
- **Rate limiting:** session və bağlantı üzrə (Bucket4j).
- **Hesabatlar:**
  - `GET /api/v1/analytics/quiz-difficulty` (ADMIN): ən çox səhv cavablanan suallar
  - `GET /api/v1/analytics/drop-off?owner=` (ADMIN): ən çox yarımçıq qoyulan mərhələlər
  - `GET /api/v1/analytics/classes/{code}` (TEACHER, yalnız öz sinfi): toplu nəticələr, şagird adları olmadan
- Gecə işləyən `@Scheduled` job `daily_aggregate`-i doldursun.

---

## 13. Təhlükəsizlik

- İctimai `GET` endpoint-ləri açıq, qalan hər şey JWT tələb edir.
- **Access token:** 15 dəqiqə. **Refresh token:** 14 gün, rotasiya ilə, bazada yalnız hash saxlanılır. Təkrar istifadə olunan refresh token bütün sessiyanı ləğv edir.
- Şifrələr Argon2 ilə. Login endpoint-ində rate limiting.
- İlk ADMIN istifadəçi mühit dəyişənlərindən yaradılsın (`ADMIN_EMAIL`, `ADMIN_PASSWORD`), kodda heç bir default şifrə olmasın.
- Bütün native SQL parametrləşdirilmiş olsun. String birləşdirmə ilə sorğu qadağandır.
- CORS: yalnız konfiqurasiya olunmuş frontend domenləri.
- Təhlükəsizlik başlıqları: `X-Content-Type-Options`, `Referrer-Policy`, `Content-Security-Policy` (API üçün sadə).
- Yükləmələr: MIME tipi və ölçü yoxlanılsın, şəkillər üçün icazə verilən formatlar siyahısı olsun.
- Secret-lər `.env`-də, `.env.example` repoda, `.env` `.gitignore`-da.
- Asılılıqlar üçün zəiflik yoxlaması (OWASP Dependency-Check və ya oxşar) CI-da.

---

## 14. Performans və cache

- İctimai oxuma servislərində Caffeine cache, açar `content_version` ilə. Dərcdə tam təmizlənir.
- N+1 olmamalıdır: siyahı endpoint-ləri üçün proyeksiya sorğuları (DTO projection) və ya `JOIN FETCH`. Testdə sorğu sayını yoxla (məs. datasource-proxy).
- Ərazi geometriyaları üçün `simplified=true` default olsun. Tam geometriya yalnız yaxın zoom üçün.
- GeoJSON cavabları gzip ilə sıxılsın.
- Hədəflər (lokal, isti cache): siyahı endpoint-ləri < 50 ms, `/timeline` < 150 ms, `/polities/at` < 50 ms.

---

## 15. Statik eksport

- `ContentProjected` event-indən sonra (debounce ilə) bütün ictimai məzmun frontend-in mövcud `frontend/data` formatında JSON fayllarına yazılır.
- Hədəf: MinIO bucket (`public-content/v{content_version}/...`) + `latest.json` manifest.
- Format frontend-in hazırkı statik rejimi ilə **tam uyğun** olmalıdır. Uyğunluğu yoxlayan test yaz: eksport olunmuş JSON frontend-in Zod sxemlərindən keçməlidir.
- Ərazilər ayrıca fayllar kimi (`territories/{snapshot-slug}.geojson`), lazım olanda yüklənsin.

---

## 16. Mövcud datanın idxalı

- `--spring.profiles.active=import` və ya ayrıca CLI komandası: `frontend/data/` qovluğunu oxuyur.
- Hər fayl uyğun sənəd tipinə çevrilir, `shared/schema` ilə validasiya olunur, `PUBLISHED` statusu ilə yazılır və proyeksiya yaradılır.
- **İdempotent:** eyni slug artıq varsa və məzmun eynidirsə, heç nə etmir. Fərqlidirsə, yeni revision yaradır.
- Sonda hesabat: neçə sənəd yaradıldı / yeniləndi / dəyişmədi, validasiya xəbərdarlıqları, sınıq referanslar.
- İdxal sistem istifadəçisi (`system-import`) adından edilsin.

---

## 17. Frontend inteqrasiyası

- `springdoc` ilə `openapi.json` generasiya olunsun. Frontend-də `openapi-typescript` (və ya oxşar) ilə tiplər və klient generasiya edilsin.
- Frontend-də yeni `ApiRepository` implementasiyası. `NEXT_PUBLIC_DATA_SOURCE=static|api` ilə seçilir.
- Mövcud UI komponentləri dəyişməməlidir. Yalnız repository qatı dəyişir.
- `shared/schema`-dan frontend Zod sxemləri generasiya olunsun və mövcud əl ilə yazılmış Zod sxemləri bununla əvəz edilsin (ayrıca mərhələdə, diqqətlə).

---

## 18. Test strategiyası

| Səviyyə | Nə yoxlanılır |
|---|---|
| Unit | `HistoricalDate` validasiyası və sort key, slug generasiyası, `az_fold` xəritələməsi, status maşını, validasiya qaydaları, `age_at_event` hesablanması |
| Modulith | `ApplicationModules.verify()`, modullar arası event axını (`Scenario` API) |
| İnteqrasiya (Testcontainers + PostGIS) | migrasiyalar sıfırdan, proyektorlar, `/polities/at`, `/timeline`, `/places/{slug}/timeline`, `/compare`, axtarış, optimistic locking konflikti |
| Web (MockMvc / RestAssured) | hər endpoint üçün uğurlu və xəta halları, ETag/304, icazələr (hər rol üçün), Problem Details formatı |
| İdxal | idempotentlik (iki dəfə işlət → dublikat yoxdur), mövcud bütün `frontend/data` faylları xətasız idxal olunur |
| Eksport | eksport olunmuş JSON frontend Zod sxemlərindən keçir |
| Təhlükəsizlik | AUTHOR öz revision-ını təsdiqləyə bilmir, TEACHER başqa sinfin statistikasını görə bilmir, `PENDING` media ictimai API-də görünmür |

Hədəf: domen və servis qatında yüksək əhatə. Controller-lərdə əsas ssenarilər. Testlər bir-birindən asılı olmasın.

---

## 19. Konfiqurasiya və mühitlər

- Profillər: `local`, `test`, `prod`, `import`.
- Bütün mühitə xas dəyərlər mühit dəyişənlərindən: DB URL, MinIO, JWT açarı, CORS domenləri, admin bootstrap.
- `application.yml`-da heç bir secret olmasın.
- Actuator: `health`, `info`, `metrics`, `prometheus`. Prod-da yalnız `health` ictimai.
- Loglar JSON formatında, hər sorğu üçün `requestId` (MDC). Şəxsi məlumat loglanmasın.

---

## 20. Docker Compose

```yaml
services:
  db:       # postgis/postgis (ən son stabil tag-ı yoxla), healthcheck, volume
  minio:    # MinIO + bucket-ləri yaradan init konteyner
  backend:  # db və minio sağlam olandan sonra başlasın
```
`docker compose up` ilə bütün sistem lokalda qalxmalıdır. `README`-də addım-addım təlimat olsun.

---

## 21. İş mərhələləri və "hazırdır" meyarları

| # | Mərhələ | Hazırdır, əgər... |
|---|---|---|
| 0 | **Plan** | ER modeli, modul sərhədləri, ADR-lər (CQRS-lite, build aləti, jOOQ və ya native SQL) təsdiqlənib |
| 1 | **Skelet** | `docker compose up` işləyir, `/actuator/health` UP, Flyway ilk migrasiya, Modulith `verify()` keçir, CI-da build + test |
| 2 | **Paylaşılan sxem** | `shared/schema` mövcud Zod sxemlərindən çıxarılıb, mövcud bütün `frontend/data` faylları JSON Schema validasiyasından keçir |
| 3 | **Ümumi tiplər + proyeksiya cədvəlləri** | `HistoricalDate`, `LocalizedText`, `EntityRef`, `az_fold`, bütün proyeksiya migrasiyaları, entity-lər, unit testlər |
| 4 | **Redaksiya** | sənəd/revision CRUD, status maşını, validasiya hesabatı, diff, optimistic locking, testlər |
| 5 | **Dərc + proyektorlar** | hər sənəd tipi üçün proyektor, `content_version`, proyeksiyanın yenidən qurulması, event təkrar cəhdi |
| 6 | **İdxal** | bütün mövcud data idxal olunur, idempotentlik testi keçir |
| 7 | **İctimai API (əsas)** | persons, conflicts, states, battles, heroes, places, eras, themes; ETag/304; Problem Details; OpenAPI |
| 8 | **Coğrafi və xronoloji sorğular** | `/timeline`, `/territories`, `/polities/at`, `/polities/{slug}/ruler`, `/places/{slug}/timeline`, `/compare`, `/on-this-day`, `/search` |
| 9 | **Identity + təhlükəsizlik** | JWT, refresh rotasiyası, rollar, icazə testləri, admin bootstrap |
| 10 | **Media** | MinIO, presigned yükləmə, lisenziya qaydaları, portretlər, soundtrack |
| 11 | **Analitika** | event qəbulu, rate limit, partition-lar, gecəlik toplama, hesabatlar, məxfilik testləri |
| 12 | **Statik eksport** | eksport frontend sxemlərindən keçir, debounce işləyir |
| 13 | **Frontend inteqrasiyası** | OpenAPI klienti, `ApiRepository`, `static`/`api` keçidi, UI dəyişmədən işləyir |
| 14 | **Sənədləşmə** | `README`, `docs/ARCHITECTURE.md`, modul diaqramı, ADR-lər yenilənib |

---

## 22. Bu mərhələdə QURMA (amma arxitektura mane olmasın)

- Redaksiya üçün UI (CMS frontend-i ayrıca layihə olacaq. Hələlik API + OpenAPI kifayətdir)
- "Tarixi şəxsiyyətdən soruş" (RAG). Gələcəkdə yalnız dərc olunmuş, mənbəli məzmun üzərində işləyəcək
- Mikroservislərə bölmə
- Şagird hesabları (platforma qeydiyyatsız işləyir; yalnız müəllimlərin hesabı var)
- Ödəniş, abunə
- Mobil tətbiq üçün xüsusi endpoint-lər (ictimai API kifayət etməlidir)
