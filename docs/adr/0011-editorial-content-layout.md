# 0011. Redaksiya sənədinin kontent strukturu və validasiya səviyyələri

Tarix: 2026-11-12 · Status: Qəbul

## Kontekst
ADR-0007 bir sənədin `data/`-dakı bir neçə faylı birləşdirdiyini deyir (məs. `PERSON` = `person.json` + `events.json` + öz əlaqələri), amma revision-dakı JSON-un formasını təyin etmir. `shared/schema` isə fayl formatlarını təsvir edir, sənəd formatını yox. Validasiya cədvəlində (BACKEND_SPEC.md §8.3) bəzi qaydalar `WARNING`-dir, halbuki frontend (Zod `.refine()` və `scripts/validate-data.ts`) həmin halları rədd edir. Belə məzmun dərc olunsa, statik eksport frontend sxemindən keçməzdi (ADR-0006).

## Qərar

### Kontent = bölmələrdən ibarət obyekt
Hər revision-ın `content`-i JSON obyektidir. Onun açarları sənəd tipinin **bölmələridir** (`editorial.api.DocumentType`, `ContentPart`). Hər bölmə `shared/schema`-dakı mövcud sxemlə yoxlanılır; yeni sxem yazılmır.

| Tip | Bölmələr (`*` məcburi) | Sxem |
|---|---|---|
| `PERSON` | `person*`, `events*` (≥1), `relations` (`from` = slug) | `Person`, `LifeEvent[]`, `Relation[]` |
| `CONFLICT` | `conflict*`, `days*` (≥1), `settlements`, `settlementsSource`, `commanders` | `Conflict`, `WarDay[]`, `Settlement[]`, mətn, `Commander[]` |
| `STATE` | `state*`, `steps*` (≥1) | `State`, `StateStep[]` |
| `POLITY` | `polity*`, `reigns` (`polityId` = slug) | `Polity`, `Reign[]` |
| `TERRITORY_SNAPSHOT` | `snapshot*`, `built` (qurulmuş poliqonlar, `public/data/territories/y*.json`) | `TerritorySnapshotSource`, `TerritorySnapshot` |
| `HERO`, `SOUNDTRACK_TRACK` | `conflictId*` (slug), `hero*` / `track*` | `Hero` / `Track` |
| `PLANNED_ENTITY` | `entity*` | `PlannedFile`-in elementi (ayrıca sxemi yoxdur) |
| qalanlar | bir bölmə: `place`, `ruler`, `era`, `theme`, `battle`, `source`, `entry`, `commemoration`, `event`, `registry` | uyğun sxem |

- Kontentdəki id (`/person/id`, `/track/trackId`…) sənədin slug-ı ilə eyni olmalıdır. `POST` zamanı slug verilməsə, oradan götürülür.
- Naməlum bölmə `WARNING`-dir (nəzərə alınmır).
- Bütün göstəricilər (validasiya, şərhlər, diff) bu struktur daxilində JSON Pointer-dir: `/events/3/title/az`.

### Validasiya səviyyələri
Frontend-in rədd etdiyi hər şey `ERROR`-dur, spesifikasiyada `WARNING` yazılsa belə. Səbəbi odur ki, dərc olunan məzmun eksportda Zod-dan keçməlidir. Fərqlər:

| Qayda | Spesifikasiya | Burada | Səbəb |
|---|---|---|---|
| `legend` iddiasında `firstRecorded` yoxdur | WARNING | ERROR | Zod `Claim.refine` |
| `disputed` iddiada < 2 versiya, `why` yoxdur | WARNING | ERROR | Zod `Claim.refine` |
| `disputed` tarixdə `alternatives` yoxdur | — | ERROR | `integrity.ts` |
| Marşrutun ucları `fromLocation`/`location`-dan > 5 km | WARNING | yoxdur | Datada `route` yalnız ara nöqtələrdir; xətt `fromLocation → route → location` kimi qurulur (ADR-0007), uclar həmişə üst-üstə düşür |

Referanslar (məkan, polity, tema, dövr, snapshot, hökmdar…) **redaksiya sənədlərinə** qarşı yoxlanılır, proyeksiyaya yox. Bu yoxlama proyeksiyadan əvvəl də işləyir:
- hədəf yoxdur və ya arxivdədir → `ERROR`;
- hədəf var, amma dərc olunmayıb → `WARNING`;
- çarpaz keçid (`related`, xatirə gününün `ref`-i) → yalnız `INFO` (gələcək məzmun, §5.3); `PLANNED_ENTITY`-də elan olunubsa, heç nə.

Poliqonların etibarlılığını PostGIS yoxlayır (`geojson_problem`, V010). Funksiya heç vaxt xəta atmır, ona görə dərc tranzaksiyasının içində işlədilə bilir.

### Status maşını
- İstənilən yeni revision (redaktə və ya revert) `DRAFT` olmayan sənədi `DRAFT`-a qaytarır. Rəydən keçən versiya artıq orada olan versiya deyil. Bu, jurnalda `edit` kimi yazılır. Dərc olunmuş versiya ictimai qalır.
- `submit` həm `DRAFT`-dan, həm də `CHANGES_REQUESTED`-dən mümkündür. `request_changes` şərh tələb edir.
- "Heç kim öz revision-ını təsdiqləyə bilməz" qaydası belə şərh olunur: son dərc olunmuş revision-dan sonrakı revision-lardan **hər hansı birini** yazan şəxs təsdiqləyə bilməz, ADMIN də daxil olmaqla. Əks halda A yazar, B kiçik düzəliş edər, A təsdiqləyərdi.
- `ARCHIVED` son statusdur (arxivdən qaytarma yoxdur).
- AUTHOR yalnız öz yaratdığı sənədi redaktə edə və rəyə göndərə bilər, amma hamısını oxuya bilər. TEACHER-in redaksiyaya girişi yoxdur.

## Nəticələr
- \+ Sxem tək mənbədə qalır (`shared/schema`); idxal (mərhələ 7) faylları dəyişmədən bölmələrə qoyur.
- \+ Dərc olunan hər şey frontend-in qəbul etdiyi formadadır.
- − Bölmə strukturu Java-da (`DocumentType`) yazılıb; CMS və idxalçı onu ADR-dən oxumalıdır. OpenAPI (mərhələ 8) onu sənədləşdirəcək.
- − `jsonb` açar sırasını saxlamır. Eksport (mərhələ 13) açarları sxemdəki sıraya görə düzməlidir ki, `data/` faylları bayt-bayt bərpa olunsun.
