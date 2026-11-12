# 0012. Proyeksiya: modulların writer-ləri, idempotent proyektor, sorğu zamanı hesablanan məkan

Tarix: 2026-11-12 · Status: Qəbul

## Kontekst
ADR-0001 dərcin proyeksiyaya necə çevrildiyini ümumi təsvir edir: `ContentPublished` → `publishing` → proyektor. Hər modulun öz cədvəlləri var (catalog, geo, chronology, theming, media), `publishing` isə onların daxilinə girə bilməz (Modulith). Event-lər asinxron işlənir və təkrar oluna bilər. Bəzi törəmə dəyərlər bir neçə sənəddən asılıdır: snapshot-un etibarlılıq aralığı, tema mirası, "30 km daxilində ən yaxın məkan".

## Qərar

### Müqavilə `shared.content`-dədir
- `DocumentType` və `ContentPart` `editorial.api`-dən `shared.content`-ə köçürüldü (ayrıca refaktorinq commit-i). Kontent strukturu (ADR-0011) bütün modulların ortaq müqaviləsidir.
- `ProjectionWriter`: `delete(documentId)`, `write(PublishedContent)`, `deleteAll()`, `afterChanges()`. Hər modul öz `internal.projection` paketində bir writer təqdim edir və yalnız öz tiplərini yazır.
- `publishing` writer-ləri sənəd tipini bilmədən `List<ProjectionWriter>` kimi alır. Yeni modul və ya tip `publishing`-i dəyişmədən əlavə olunur.
- `editorial.api.PublishedContents` dərc olunmuş revision-ı oxuyur.

### Proyektor idempotentdir və sıradan asılı deyil
- Event hansı revision-ı daşısa da, proyektor sənədin **hazırkı** dərc olunmuş revision-ını yazır. Arxivlənmiş və ya dərc olunmamış sənədin isə sətirlərini silir. Gecikmiş və ya təkrar event eyni vəziyyəti yenidən yazır.
- Bir sənəd = bir tranzaksiya: bütün writer-lər `delete` + `write` edir, sonra `afterChanges`, sonra `content_version + 1`, sonra `ContentProjected`. Xəta olsa köhnə sətirlər qalır. Event registry-də tamamlanmamış qalır və təkrar göndərilir: hər `platform.publishing.retry-interval`-da (1 dəq.) və tətbiq yenidən başlayanda.
- Eyni sənədin paralel proyeksiyası advisory lock ilə (sənəd üzrə) növbəyə düzülür. Rebuild bütün proyeksiyaları eksklüziv kilidlə bloklayır.
- Bir sənədin asılı olduğu başqa sənəd hələ proyeksiyada yoxdursa (valideyn teması olmayan variant), writer heç nə yazmadan `MissingDependencyException` atır. Normal axında event sonra təkrar cəhd olunur. Rebuild-də sənəd növbəti keçidə saxlanılır, ona görə rebuild sənədlərin sırasından asılı deyil.

### Törəmə dəyərlər
| Dəyər | Harada | Qeyd |
|---|---|---|
| `age_at_event` | catalog, dərcdə | `HistoricalDate.ageAt` (frontend ilə eyni) |
| `route` | catalog, dərcdə | `fromLocation → route → location`; `fromLocation` yoxdursa NULL |
| `conflict.start/end`, `state_profile.start/end_year`, `polity.start/end_year` | dərcdə | günlərdən / addımlardan / periodlardan |
| `territory_snapshot.valid_to_year` | geo, `afterChanges` | növbəti snapshot-un ili − 1; sonuncu NULL; hər dəyişiklikdən sonra hamısı yenidən hesablanır |
| `geometry_simplified`, `area_km2` | geo, dərcdə | `ST_SimplifyPreserveTopology(0.01°)`, coğrafi sahə |
| Tema mirası | theming, dərcdə | frontend `resolveThemes` qaydası; valideyn dəyişəndə bütün nəsil yenidən birləşdirilir |
| `source` | catalog | `sha256(title\|author\|url\|type)` ilə dublikatsız; istinadsız qalanlar `afterChanges`-də silinir |
| `location_place_slug` | — | **yalnız açıq `placeId`.** "30 km daxilində ən yaxın" (frontend `matchPlace`) sorğu zamanı hesablanır (mərhələ 9). Dərcdə hesablansa, nəticə məkanların hansı sırayla dərc olunduğundan asılı olardı. Frontend müharibə günləri üçün ad uyğunluğu işlədir |

### Media reyestri olmadan
Əsas portret (`person.portrait`), hero fotosu, emblem, hökmdar portretləri, `portrait.image` və trek faylı indiki kimi JSONB/mətn kimi saxlanılır (V011). `media_id` NULL qalır. Mərhələ 11 bunları `media_asset`-ə çevirəcək. `kind` uydurulmur: yaşa görə portretlərin öz `kind`-i var, əsas portretin isə yoxdur.

### Etibarsız poliqon
Validasiya etibarsız poliqonu `ERROR` hesab edir, yəni dərc olunmur. Buna baxmayaraq proyeksiyaya çatan poliqon (köhnə məzmunun rebuild-i) `ST_MakeValid` ilə təmir olunur və loga yazılır, rebuild sınmır.

### Sınmış referanslar
`GET /api/v1/admin/broken-references` redaksiya modulundadır. Dərc olunmuş hər revision-a validasiyanın referans qaydalarını tətbiq edir, ona görə hesabat ilə validasiya heç vaxt ziddiyyət təşkil etmir.

## Nəticələr
- \+ `publishing` kiçikdir və tiplərdən xəbərsizdir; writer-lər öz modullarında test olunur.
- \+ Təkrar və sırasız event-lər təhlükəsizdir; rebuild istənilən an işə salına bilər.
- − Hər proyeksiya bütün writer-ləri çağırır (silmə sorğuları boş keçir). Bu ucuzdur və sadəlik üçün qəbul edilir.
- − Bir sənədin xətası (məs. DB constraint) rebuild-i tamamilə dayandırır (bir tranzaksiya). Bu qəsdəndir: yarımçıq rebuild olmamalıdır.
