# Tarixin İçində

Azərbaycan tarixi şəxsiyyətlərinin həyatını interaktiv şəkildə yaşamaq üçün veb tətbiq.
İstifadəçi şəxsiyyət seçir və onun həyatını doğumdan ölümə qədər mərhələ-mərhələ keçir.
Hər mərhələ xəritədə göstərilir. Yerdəyişmələr animasiyalı marşrutla çəkilir, döyüşlər, seçim anları və yekun sınaq var.

Xəritə həmin ilin siyasi vəziyyətini göstərir (14 snapshot, 1440–1739). Dövlətlər, paytaxtlar və dövrə uyğun toponimlər var.
Hər mərhələnin əhvalı (*mood*) musiqini, mühit səslərini, xəritənin rəng tonunu və UI vurğusunu idarə edir.
Döyüşlərdə xəritə meydana yaxınlaşır, tərəflərin hərəkəti sxematik oxlarla çəkilir.
Bundan əlavə: "Bu zaman dünyada" paneli, şəxsiyyətlər arası kəsişmələr, qlossari, proqresin yadda saxlanması,
tarixi kart kolleksiyası, müəllim rejimi və zəif kompüterlər üçün yüngül rejim.

İlkin versiyadakı şəxsiyyətlər: **Uzun Həsən**, **Şah İsmayıl Xətai**, **Nadir Şah Əfşar** (cəmi 50 mərhələ).

## Qurulma

Node.js 20+ lazımdır (layihə Node 26 ilə yoxlanılıb).

```bash
npm install          # MapLibre worker-i public/vendor/-a da kopyalayır
npm run dev          # http://localhost:3000
```

| Əmr | Nə edir |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Əvvəlcə datanı validasiya edir, sonra `out/`-a statik export edir |
| `npm start` | `out/` qovluğunu lokal serve edir (port 3000) |
| `npm run validate:data` | Bütün `data/` fayllarını sxem və bütövlük qaydaları ilə yoxlayır |
| `npm run build:territories` | Siyasi xəritə snapshot-larını `public/data/territories/`-a yığır (`dev` və `build`-dan əvvəl avtomatik işləyir) |
| `npm run generate:audio` | Placeholder musiqi və səsləri yenidən sintez edir (`public/audio/`, bax `AUDIO_CREDITS.md`) |
| `npm test` | Unit testlər (Vitest) |
| `npm run test:e2e` | Playwright: hər şəxsiyyət başdan sona; desktop, planşet və mobil. Əvvəlcə `npm run build` lazımdır. İlk dəfə `npx playwright install chromium` |
| `npm run lint`, `npm run typecheck` | ESLint və TypeScript |

## Deploy (GitHub Pages)

`.github/workflows/deploy.yml` hər `main` push-unda testləri işə salır, saytı build edir və GitHub Pages-ə yerləşdirir.
Bunun üçün bir dəfəlik ayar lazımdır: repo **Settings → Pages → Build and deployment → Source: GitHub Actions**.
Sayt `https://<istifadəçi>.github.io/<repo>/` ünvanında açılır. Alt-yol `NEXT_PUBLIC_BASE_PATH` ilə avtomatik verilir.

Başqa statik hostinqdə (Netlify, Vercel, Cloudflare Pages) `out/` qovluğunu yerləşdirmək kifayətdir.
Sayt kökdə deyilsə, build zamanı `NEXT_PUBLIC_BASE_PATH=/alt-yol` verilməlidir.

> **Windows qeydi:** Next.js 16.4 Windows-da statik export edəndə iç-içə route-ların prefetch fayllarını səhv adla yazır
> (yolda `\` işarəsinin nöqtəyə çevrilmədiyi üçün). Bu halda brauzer konsolunda `__next.*.txt` üçün 404 görünür və keçidlər
> adi səhifə yüklənməsi ilə işləyir. Linux-da (GitHub Actions) build edəndə bu problem yoxdur.

## Arxitektura

```
data/                    bütün kontent, kodda heç bir şəxsiyyət yoxdur
  eras/<id>.json         dövrlər
  persons/<id>/          person.json + events.json
  relations.json         şəxsiyyətlər arası əlaqələr və kəsişmə anları (moments)
  glossary.json          qlossari: termin, izah, şəkilçiləri nəzərə alan söz kökləri
  places.json            şəhər, qala, ziyarətgah, liman, döyüş meydanı kataloqu
  world-events.json      "Bu zaman dünyada" hadisələri
  territories/           siyasi xəritə: registry.json, snapshots/, land.json (bax territories/README.md)
public/audio/            musiqi, mühit və effekt səsləri (.webm + .mp3)
locales/az.json          UI mətnləri
public/portraits/        public domain portretlər
src/
  domain/schema.ts       Zod sxemi, bütün tiplərin tək mənbəyi
  domain/integrity.ts    fayllar arası qaydalar (xronologiya, birth/death, disputed alternativlər...)
  data/                  HistoryRepository interfeysi + FileSystemRepository
  lib/                   tarix/yaş, coğrafiya (turf), i18n, basePath
  features/landing/      giriş ekranı
  features/simulation/   simulyasiya: panel, timeline, seçimlər, rejimlər
  features/map/          MapLibre səhnəsi: baza stil + hillshade, sərhəd snapshot-ları (crossfade),
                         məkan ikonları, döyüş oxları, kəsişmə medalyonları, label declutter, xəritə açarı, şəhər kartı
  features/audio/        Howler.js mühərriki: music / ambience / sfx / voice kanalları, mood → səs xəritəsi
  features/settings/     səs səviyyələri, tam söndürmə, yüngül rejim, müəllim rejimi
  features/legacy/       final: irs, statistika, quiz
scripts/validate-data.ts
tests/unit, tests/e2e
```

**Data qatı.** UI yalnız `HistoryRepository` interfeysindən (`src/data/repository.ts`) asılıdır.
Hazırda `FileSystemRepository` build zamanı `data/`-nı oxuyur və `data/persons/*` qovluqlarını özü tapır.
REST API-yə (məsələn, Spring Boot) keçmək üçün `src/data/index.ts`-də `HttpRepository` qaytarmaq kifayətdir.
Data runtime-da gələcəksə, `next.config.ts`-dəki `output: "export"` da götürülməlidir.

**Build zamanı hesablananlar** (`src/features/simulation/model.ts`): hər hadisə üçün yaş, hamarlanmış marşrut koordinatları
(turf `bezierSpline` / `greatCircle`), məsafə, məkan siyahısı, statistika və quiz sualları. Brauzerə hazır nəticə gedir, turf client bundle-a düşmür.

**Xəritə.** OpenFreeMap vektor tile-ları və Natural Earth relyefi istifadə olunur, token tələb olunmur.
Stil (`src/features/map/style.ts`) bilərəkdən minimaldır: müasir sərhəd, yol və yer adı yoxdur.
Tarixi adlar hadisə datasından HTML marker kimi çəkilir, ona görə Azərbaycan hərfləri tətbiqin öz şrifti (Noto) ilə düzgün görünür.
Xəritə üçün internet bağlantısı lazımdır.

**Siyasi xəritə.** Sərhədlər layihə daxilində hazırlanmış sadələşdirilmiş poliqonlardır: hər region bir neçə "toxum" nöqtəsinin Voronoi sahəsidir,
dövlət isə regionların birləşməsidir. Quru ilə kəsmək üçün Natural Earth sahil xətti istifadə olunur. İki snapshot arasında keçid poliqon morph ilə deyil,
iki qat arasında crossfade (opacity) ilə edilir: köhnə dövlət solur, yenisi görünür, rəng tədricən dəyişir.
Sərhəd yumşaq rəngli zolaq və qırıq xəttlə çəkilir, xəritə açarında "Sərhədlər təxminidir" yazılır. Ətraflı: `data/territories/README.md`.

**Məkanlar.** `data/places.json`-dakı hər məkanın tipi var və tipə görə miniatür üslubunda SVG ikonla göstərilir
(paytaxt: taclı qala, döyüş meydanı: çarpaz qılınclar, ziyarətgah: firuzəyi günbəz, liman: yelkənli gəmi).
Uzaqdan yalnız paytaxtlar və böyük şəhərlər görünür, yaxınlaşdıqca kiçik şəhərlər çıxır. Hansı şəhərin paytaxt olduğu
snapshot-dan gəlir (məs. Ağqoyunlu: 1460-da Amid, 1472-də Təbriz). Ad dövrə görə dəyişə bilər (Konstantinopol → İstanbul), müasir ad hover-də görünür.
Məkana klikləyəndə şəhər kartı açılır: qısa tarix və bu şəxsiyyətin həyatında orada baş verən mərhələlər.

**Mood və səs.** `LifeEvent.mood` 15 dəyərdən biridir. `src/lib/mood.ts` rəng tonunu (xəritənin üzərində `multiply` qatı, vignette, UI vurğusu),
`src/features/audio/manifest.ts` isə musiqi və mühit qatlarını təyin edir. Ümumi fon burdonu həmişə səslənir, mood qatları 1,6 saniyəlik crossfade ilə dəyişir.
Səs yalnız "Hekayəyə başla" klikindən sonra başlayır (brauzer autoplay qaydası). Səviyyə default olaraq ortadır,
bir kliklə tam söndürülür, seçim `localStorage`-da qalır. Audio fayllar lazım olanda yüklənir, növbəti mərhələnin mood-u əvvəlcədən yüklənir.
**Hazırkı səslər sintez olunmuş placeholder-lərdir** və real CC0 yazılarla əvəz edilməlidir (`AUDIO_CREDITS.md`).

**Yüngül rejim.** Zəif kompüterlər üçün relyef kölgəsi, marşrut və sərhəd animasiyaları, rəng qatının blend effekti və mühit səsləri söndürülür,
xəritə 1x piksel sıxlığında çəkilir. Cihaz zəif görünəndə (≤2 nüvə və ya ≤2 GB yaddaş) avtomatik açılır, ayarlardan dəyişdirilə bilər.

**Müəllim rejimi.** Proyektor üçün bütün UI 125% böyüyür. Mərhələləri müəllim ← → və ya təqdimat pultunun PageUp/PageDown düymələri ilə idarə edir.
Yekun sınaqda sinif birlikdə variant seçir, müəllim "Cavabı göstər" düyməsi ilə cavabı açır.

**Animasiya.** Kamera `flyTo` / `fitBounds` ilə hərəkət edir. Marşrut `requestAnimationFrame` ilə tədricən çəkilir və
üzərində hərəkət edən bayraq markeri olur. Hər yeni addım əvvəlki animasiyanı ləğv edir. `prefers-reduced-motion` aktiv olanda
keçidlər ani olur. Real GPU-da (Intel Iris Xe) marşrut animasiyası 60 fps göstərib, p95 kadr vaxtı 16.7 ms.

## Yeni şəxsiyyət əlavə etmək

1. `data/persons/<id>/` qovluğunu yaradın. `<id>` kebab-case olmalı və `person.json`-dakı `id` ilə eyni olmalıdır.
2. `person.json` yazın (aşağıdakı sxemə baxın). Portret varsa, `public/portraits/`-a qoyun və lisenziyanı göstərin.
3. `events.json` yazın: `{ "events": [ ... ] }`. İlk hadisə `birth`, sonuncu `death` olmalıdır.
4. `npm run validate:data` işə salın.
5. Mənbələri və mübahisəli məqamları `RESEARCH_NOTES.md`-yə əlavə edin.

Kodda heç nə dəyişmir. Giriş ekranı, səhifə, e2e testlər yeni qovluğu avtomatik götürür.

## Yeni dövr əlavə etmək

`data/eras/<id>.json` faylı yaradın (fayl adı `id` ilə eyni olmalıdır) və şəxsiyyətlərin `eraIds` siyahısına əlavə edin.
Giriş ekranındakı dövr filtri onu avtomatik göstərir.

## Data sxemi

Bütün mətn sahələri `LocalizedText` tipindədir: `{ "az": "...", "en"?: "...", "ru"?: "..." }`.
`az` məcburidir, digər dillər ona fallback edir. Tam sxem `src/domain/schema.ts`-dədir.

### `HistoricalDate`
| Sahə | Təsvir |
|---|---|
| `year`, `month?`, `day?` | Qriqori təqvimi; dəqiqlik sahələrin varlığı ilə müəyyən olunur |
| `certainty` | `exact` \| `approximate` \| `disputed` |
| `alternatives?` | Digər versiyalar: `{ year, month?, day?, note, source? }`. `disputed` üçün məcburidir |
| `note?` | İzah |

### `Location` (hadisənin yeri)
`name` (dövrə uyğun ad), `modernName?`, `lat`, `lng`, `approximate?` (yer təxminidir), `placeId?` (kataloq məkanı; yoxdursa, 30 km daxilindəki ən yaxın məkan).

### `Place` (`data/places.json`)
`id`, `names: { historical, modern? }`, `lat`, `lng`, `type` (`capital` `city` `fortress` `shrine` `battlefield` `port`),
`importance` (1 həmişə, 2 regional, 3 yaxınlaşanda), `periods[]` (`{ from, to, name? }`: göstərildiyi illər və həmin dövrdəki ad), `description`, `sources?`.

### `TerritorySnapshot`
Brauzerə gedən format: `{ id, year, title, certainty, note?, polities: [{ id, name, color, geometry (GeoJSON), capitalId?, vassalOf?, labelAt }], sources[] }`.
Mənbə formatı (`data/territories/snapshots/`) geometriya əvəzinə `regions[]` saxlayır.

### `WorldEvent` (`data/world-events.json`)
`id`, `year`, `endYear?`, `region` (`europe` `middle-east` `asia` `africa` `americas`), `title`, `description`, `sources[]`.
Hər mərhələdə ±12 il daxilində ən yaxın 3 hadisə göstərilir, mümkün qədər fərqli regionlardan.

### `Era`
`id`, `name`, `startYear`, `endYear`, `description`, `theme: { color, accent }`.

### `Person`
| Sahə | Təsvir |
|---|---|
| `id`, `name`, `shortName?`, `titles[]` | `shortName` mətn içində işlənir ("Gözünü Nadir Şah olaraq aç") |
| `birth`, `death` | `{ date: HistoricalDate, place: Place }` |
| `eraIds[]` | Mövcud dövrlərə istinad |
| `portrait?` | `{ src, alt, license, author?, sourceUrl? }`, yalnız PD/CC |
| `epigraph?` | Kart üçün bədii giriş (sitat deyilsə, `attribution`-da bunu yazın) |
| `shortBio`, `legacy`, `tags[]`, `featuredOrder?` | |

### `LifeEvent`
| Sahə | Təsvir |
|---|---|
| `id`, `personId`, `order` | `order` sıralama üçündür, tarixlərlə uyğun olmalıdır |
| `date` | `HistoricalDate` |
| `type` | `birth` `childhood` `education` `journey` `battle` `coronation` `marriage` `diplomacy` `culture` `exile` `death` |
| `mood` | `birth` `childhood` `hardship` `exile` `journey` `rise` `coronation` `battle` `victory` `defeat` `peace` `diplomacy` `culture` `decline` `death` |
| `territorySnapshotId?` | Xəritə snapshot-u. Yoxdursa, ilə görə seçilir |
| `narrationAudio?` | Nağılçı səsi üçün yer: `{ src, cues: [{ start, end, text }], license, voice? }`. Subtitrlər səslə sinxron göstərilir. Hələ heç bir hadisədə yoxdur |
| `primarySource?` | İlkin mənbədən parça: `{ original?, text, attribution, license, translator?, note?, source }` |
| `location`, `fromLocation?`, `route?` | `fromLocation` varsa, xəritədə marşrut çəkilir. `route` ara nöqtələrdir: `[[lng, lat], ...]` |
| `title` | |
| `factualSummary` | **Yalnız yoxlanılmış faktlar** (Öyrənmə rejimi) |
| `narrative` | **Birinci şəxsdə bədii mətn** (Hekayə rejimi, UI-da "Bədii təsvir" kimi işarələnir) |
| `outcome?` | Yalnız `battle` üçün və orada məcburidir: `{ result, ownSide, enemySide, opponent, commanders: { own[], enemy[] }, forces?, forcesSource?, context` (tarixi əhəmiyyəti)`, ownPolityId?, enemyPolityId?, artillery?, maneuvers? }`. `maneuvers` sxematik oxlardır: `[{ side, kind, path: [[lng, lat], ...], label? }]`, `kind`: advance, attack, flank, retreat |
| `sources[]` | Ən azı bir mənbə: `{ title, author?, url?, type, note? }` |
| `choice?` | `{ prompt, options[{text, explanation}], historicalOptionIndex, why }` |
| `quiz?` | 1–3 sual: `{ question, options[], correctIndex, explanation }` |

`ageAtEvent` data-da saxlanmır, doğum tarixindən avtomatik hesablanır. Tarixlərdən biri təxmini olanda yaş `~` ilə göstərilir.

### `Relation` (`data/relations.json`)
`{ from, to, type, note?, moments?, sources? }`, burada `from`, `to`-nun `type`-ıdır (məs. `uzun-hasan` → `shah-ismayil`: `grandparent`).
`moments: [{ personId, eventId, note, targetEventId? }]` kəsişmə anlarıdır: həmin mərhələdə timeline-da qızılı nöqtə,
xəritədə portret medalyonu və digər hekayəyə link (`/az/person/<id>/?step=<eventId>`) göstərilir.

### `GlossaryEntry` (`data/glossary.json`)
`{ id, term, definition, forms[], sources? }`. `forms` kiçik hərflə söz kökləridir: "qızılbaş" kökü "Qızılbaşların" sözünü də tapır,
amma kökdən sonra şəkilçi ilə başlamayan sözlər ("sultanzadə") tapılmır. Hər mətn blokunda terminin yalnız ilk işlənməsi işarələnir.

### Validasiya qaydaları (`npm run validate:data`)
Zod sxeminə əlavə olaraq: fayl/qovluq adı `id` ilə eynidir; `order` və `id` unikaldır; xronologiya pozulmur
(müqayisə hər iki tarixin ortaq dəqiqliyində aparılır); tam bir `birth` və bir `death` var və onların illəri `person.json` ilə uyğundur;
`disputed` tarixin alternativi var; döyüşün `outcome`-u var; `route` yalnız `fromLocation` ilə birlikdə işlənir;
`narrative` `factualSummary`-nin surəti deyil; əlaqələr mövcud şəxsiyyətlərə istinad edir.

## Yadda saxlama (localStorage)

| Açar | Nə saxlayır |
|---|---|
| `tarix:settings` | Səs səviyyələri, tam və kanal üzrə söndürmə, yüngül rejim, müəllim rejimi |
| `tarix:progress` | Hər şəxsiyyət üçün mərhələ, seçimlər, ən uzaq mərhələ. Kolleksiya: tarixi kartlar və sınaq nişanları |
| `tarix:mode` | Hekayə / Öyrənmə rejimi |

Brauzer yaddaşı əlçatan deyilsə (gizli rejim, bloklanmış sayt datası), tətbiq yaddaşsız işləyir.

## Gələcək üçün (arxitekturada yer saxlanılıb, hələ qurulmayıb)

- **Dövrlər üzrə naviqasiya və geniş xronoloji ox.** Snapshot-lar və dünya hadisələri şəxsiyyətdən asılı deyil, il üzrə seçilir.
- **Ailə ağacı.** `Relation` tipləri (`parent`, `grandparent`, `spouse`, `sibling`, `successor`) qrafa çevrilə bilər.
- **Çoxdilli interfeys (az, en, ru).** Bütün mətnlər `LocalizedText`-dir, UI mətnləri `locales/`-dadır. Yeni dil faylı əlavə edib `generateStaticParams`-da açmaq lazımdır.
- **PWA / offline.** Audio, snapshot və ikonlar statik fayldır və service worker ilə keşlənə bilər. Xəritə tile-ları üçün ölçüsü məhdud runtime keş lazım olacaq.
- **Backend (Spring Boot).** UI yalnız `HistoryRepository`-dən asılıdır, bax "Data qatı".

## Lisenziyalar və mənbələr

Portretlər public domain-dir (`RESEARCH_NOTES.md`-də hər birinin mənbəyi göstərilib). Xəritə: © OpenFreeMap, © OpenMapTiles,
© OpenStreetMap contributors, Natural Earth. Relyef kölgəsi: [Terrain Tiles](https://registry.opendata.aws/terrain-tiles/) (Mapzen, AWS Open Data).
Tarixi mənbələr və mübahisəli məqamlar `RESEARCH_NOTES.md`-dədir.

| Data | Mənbə | Lisenziya |
|---|---|---|
| Sahil xətti (`data/territories/land.json`) | Natural Earth 1:50m land + lakes | Public domain |
| Siyasi sərhədlər | Layihə daxilində hazırlanıb (`data/territories/`) | Layihənin öz datası |
| historical-basemaps | Yoxlanılıb, **istifadə olunmayıb**: GPL-3.0, lazımi dövlətlər yoxdur (bax `data/territories/README.md`) | GPL-3.0 |
| Musiqi və səslər | Koddan sintez olunmuş placeholder-lər (`AUDIO_CREDITS.md`) | CC0 1.0 |
| Kontarininin sitatı | R. Kerr, *A General History and Collection of Voyages and Travels*, 1811 | Public domain |
