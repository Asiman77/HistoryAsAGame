# 0007. Mövcud data modelinin spesifikasiyaya uyğunlaşdırılması

Tarix: 2026-11-11 · Status: Qəbul

## Kontekst
Spesifikasiyadakı cədvəllər idealizə olunmuş modeldir; mövcud `data/` (və UI) bir sıra məqamlarda fərqlidir. Qayda: datanı itirmədən saxlamaq, UI-ın istifadə etdiyi hər sahəni proyeksiyada əlçatan etmək, uydurma sahə doldurmamaq.

## Qərar

### Sənəd tipləri
Spesifikasiyadakı 12 tipə əlavə olaraq: `GLOSSARY_ENTRY`, `COMMEMORATION`, `WORLD_EVENT`, `PLANNED_ENTITY`, `SOUNDTRACK_TRACK`, `TERRITORY_REGISTRY` (yalnız müəllif aləti üçün, proyeksiyası yoxdur).

| Mövcud fayl | Sənəd |
|---|---|
| `persons/<id>/person.json` + `events.json` + `relations.json`-dakı `from = <id>` sətirləri | `PERSON` (bir sənəd) |
| `conflicts/<id>/conflict.json` + `days.json` + `settlements.json` + `commanders.json` | `CONFLICT` |
| `conflicts/<id>/heroes.json` (hər element) | `HERO` (+ `conflictSlug`) |
| `conflicts/<id>/soundtrack.json` (hər element) | `SOUNDTRACK_TRACK` |
| `conflicts/<id>/battles/<id>.json` | `BATTLE` |
| `states/<id>/state.json` + `steps.json` | `STATE` |
| `places.json` (hər element) | `PLACE` |
| `polities/<id>.json` + `reigns.json`-dakı `polityId = <id>` sətirləri | `POLITY` |
| `rulers.json` (hər element) | `RULER` |
| `eras/*.json`, `themes/*.json` | `ERA`, `THEME` |
| `territories/snapshots/y*.json` + qurulmuş `public/data/territories/y*.json` | `TERRITORY_SNAPSHOT` |
| `glossary.json`, `commemorations.json`, `world-events.json`, `planned.json` (hər element) | uyğun tip |

`SOURCE` sənəd tipi sxemdə qalır, lakin mövcud mənbələr inline olduğundan idxal onu yaratmır (aşağıya bax).

### Fərqlər
| Mövzu | Qərar |
|---|---|
| Mənbələr | Revision-da inline qalır (`Source[]`). Proyektor onları `source` cədvəlinə məzmun hash-i (`sha256(title|author|url|type)`) ilə dublikatsız yazır; `step_source.locator` ← `Source.note`. |
| İddialar | `simulation_step.claim_type` (addımın ümumi növü, default `FACT`) + ayrıca `step_claim` cədvəli (`claim_key`, `claim_type`, `text`, `why`, `versions`, `first_recorded`) və `claim_source`. |
| Addımın yeri | Inline `Location` saxlanılır: `location_name jsonb`, `location_modern_name jsonb`, `location_point geometry(Point)`, `location_approximate`; `location_place_id` = açıq `placeId` və ya 30 km daxilində ən yaxın kataloq məkanı (frontend məntiqi ilə eyni). `from_location_*` analoji. |
| Marşrut | `route` = `fromLocation` → waypoints → `location` LineString (dərcdə qurulur). |
| `Polity` | `start/end_year` əvəzinə `polity_period(from_year, to_year)` və `polity_fact` cədvəlləri; `start_year/end_year` = periodların min/max-ı (törəmə sütun). `emblem` → media. `stateId` → `state_slug`. |
| `Reign` | `start_year/month`, `end_year/month` (gün yoxdur, `end` datada məcburidir). |
| Ərazilər | Sənəd həm müəllif formatını (regionlar/ISO), həm qurulmuş GeoJSON-u saxlayır; proyeksiya GeoJSON-dan. `valid_from_year = year`, `valid_to_year` = növbəti snapshot ili − 1 (sonuncu üçün `NULL` = açıq). Voronoi qurulması frontend skriptində (`build-territories.ts`) qalır. |
| `State` | `years` sətri saxlanılır; `start_year/end_year` addımların tarixlərindən hesablanır. |
| `Battle` | Mövcud minimal sahələr (`conflict_slug`, `step_key`, `dates`, `summary`); spesifikasiyadakı `sides/commanders/forces/outcome` sütunları nullable qalır. Şəxsiyyətin döyüş addımındakı `outcome` `simulation_step.details.outcome`-a gedir. |
| `Hero` | Datada doğum ili/ölüm tarixi yoxdur → sütunlar nullable. `posthumous` saxlanılır. `is_real_modern_person` `HERO` tipi üçün həmişə `true`. |
| Əlaqələr | `entity_relation.relation_type` = datanın tipləri (`PARENT, GRANDPARENT, SPOUSE, SIBLING, ALLY, RIVAL, SUCCESSOR, CONTEMPORARY`) + spesifikasiyanınkılar (`PARTICIPATED_IN, RULED, LOCATED_IN, RELATED`). Addımlardakı `related` ref-ləri → `RELATED` (`source_step_key` + `target_step_key` ilə). |
| `EntityType` | Datanın tipləri + spesifikasiyanınkılar: `PERSON, CONFLICT, BATTLE, STATE, PLACE, POLITY, RULER, ERA, HERO`. |
| Enum-lar | Spesifikasiyanın siyahıları datanın supersetidir (`Mood` + `REMEMBRANCE, TRIUMPH`; `PlaceType` + `VILLAGE, REGION`) — saxlanılır. `EventType` (datada var) `simulation_step.details.eventType`-a gedir. |
| Müharibə günü | `dayNumber`, `kind`, `liberated`, `extraLiberated`, `commanders`, `fallenHeroes`, `officialStatement`, `zoom` → `details`. |
| Tematik musiqi | `MUSIC_THEMES` açarlarının siyahısı `shared/schema/music-themes.json`-a çıxarılır ki, backend `musicThemeId`-ni yoxlaya bilsin. |
| `HistoricalDate.alternatives`, `note` | `*_alternatives jsonb`, `*_note jsonb` sütunları kimi saxlanılır. |
| `DatePrecision` | Datada yoxdur; `day` varsa `DAY`, `month` varsa `MONTH`, əks halda `YEAR` kimi törədilir. |

## Nəticələr
- \+ Heç bir mövcud sahə itmir; eksport `data/`-nı bayt-bayt bərpa edə bilir.
- − Proyeksiya sxemi spesifikasiyadan genişdir; bu fərqlər `docs/ARCHITECTURE.md`-dəki ER modelində əks olunur.
