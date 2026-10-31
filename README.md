# Tarixin İçində

Azərbaycan tarixi şəxsiyyətlərinin həyatını interaktiv şəkildə yaşamaq üçün veb tətbiq.
İstifadəçi şəxsiyyət seçir və onun həyatını doğumdan ölümə qədər mərhələ-mərhələ keçir.
Hər mərhələ xəritədə göstərilir. Yerdəyişmələr animasiyalı marşrutla çəkilir, döyüşlər, seçim anları və yekun sınaq var.

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
  relations.json         şəxsiyyətlər arası əlaqələr
  glossary.json          qlossari (gələcək üçün)
  borders/               dövrə görə tarixi sərhədlər (gələcək üçün)
locales/az.json          UI mətnləri
public/portraits/        public domain portretlər
src/
  domain/schema.ts       Zod sxemi, bütün tiplərin tək mənbəyi
  domain/integrity.ts    fayllar arası qaydalar (xronologiya, birth/death, disputed alternativlər...)
  data/                  HistoryRepository interfeysi + FileSystemRepository
  lib/                   tarix/yaş, coğrafiya (turf), i18n, basePath
  features/landing/      giriş ekranı
  features/simulation/   simulyasiya: panel, timeline, seçimlər, rejimlər
  features/map/          MapLibre səhnəsi: baza stil, marşrut animasiyası, label declutter
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

### `Place`
`name` (dövrə uyğun ad), `modernName?`, `lat`, `lng`, `approximate?` (yer təxminidir).

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
| `location`, `fromLocation?`, `route?` | `fromLocation` varsa, xəritədə marşrut çəkilir. `route` ara nöqtələrdir: `[[lng, lat], ...]` |
| `title` | |
| `factualSummary` | **Yalnız yoxlanılmış faktlar** (Öyrənmə rejimi) |
| `narrative` | **Birinci şəxsdə bədii mətn** (Hekayə rejimi, UI-da "Bədii təsvir" kimi işarələnir) |
| `outcome?` | Yalnız `battle` üçün və orada məcburidir: `{ result, opponent, forces?, context }` |
| `sources[]` | Ən azı bir mənbə: `{ title, author?, url?, type, note? }` |
| `choice?` | `{ prompt, options[{text, explanation}], historicalOptionIndex, why }` |
| `quiz?` | 1–3 sual: `{ question, options[], correctIndex, explanation }` |

`ageAtEvent` data-da saxlanmır, doğum tarixindən avtomatik hesablanır. Tarixlərdən biri təxmini olanda yaş `~` ilə göstərilir.

### `Relation` (`data/relations.json`)
`{ from, to, type, note?, sources? }`, burada `from`, `to`-nun `type`-ıdır (məs. `uzun-hasan` → `shah-ismayil`: `grandparent`).

### Validasiya qaydaları (`npm run validate:data`)
Zod sxeminə əlavə olaraq: fayl/qovluq adı `id` ilə eynidir; `order` və `id` unikaldır; xronologiya pozulmur
(müqayisə hər iki tarixin ortaq dəqiqliyində aparılır); tam bir `birth` və bir `death` var və onların illəri `person.json` ilə uyğundur;
`disputed` tarixin alternativi var; döyüşün `outcome`-u var; `route` yalnız `fromLocation` ilə birlikdə işlənir;
`narrative` `factualSummary`-nin surəti deyil; əlaqələr mövcud şəxsiyyətlərə istinad edir.

## Lisenziyalar və mənbələr

Portretlər public domain-dir (`RESEARCH_NOTES.md`-də hər birinin mənbəyi göstərilib). Xəritə: © OpenFreeMap, © OpenMapTiles,
© OpenStreetMap contributors, Natural Earth. Tarixi mənbələr və mübahisəli məqamlar `RESEARCH_NOTES.md`-dədir.
