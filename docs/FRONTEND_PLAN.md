# Frontend planı: "Tarixin İçində" yeni dizaynı (mərhələ 0)

> Mənbə: [`FRONTEND_SPEC.md`](FRONTEND_SPEC.md). Dizayn: [`design/`](design/) (12 artboard, `canvas.json`).
> Tarix: 2026-11-22. Status: **təsdiqlənib** (2026-11-22, tövsiyələrlə). Qərarlar: [ADR-0022](adr/0022-frontend-redesign.md).

---

## 1. Təsdiq üçün qərarlar

Spesifikasiyanın bir neçə bəndi mövcud arxitektura qərarları ilə ziddiyyət təşkil edir. Hər biri üçün tövsiyə verilib.
"Təsdiq" cavabı tövsiyələrin hamısının qəbulu deməkdir. Hər hansı bəndi dəyişmək istəsən, nömrəsini yaz.

| # | Mövzu | Spesifikasiya | Reallıq | Tövsiyə |
|---|---|---|---|---|
| Q1 | **Render modeli** | SSR/ISR, ETag, TanStack Query ilə API | `output: "export"`, GitHub Pages. Backend heç bir serverdə yerləşdirilməyib (ARCHITECTURE §21) | **Statik export qalır.** "SSR/ISR" əvəzinə build zamanı SSG: SEO və sürət eynidir. TanStack Query yalnız brauzerdə lazım olan data üçün (ərazi GeoJSON-ları, müəllim paneli, sinif kodu, axtarış) |
| Q2 | **`ApiRepository`** | `StaticRepository` + `ApiRepository` | ADR-0020: `api` rejimi backend-in statik eksportunu eyni repository ilə oxuyur. Bu qərarı sən 2026-11-14-də vermisən | **ADR-0020 qalır.** `FileSystemRepository` → `StaticRepository` adlandırılır. Canlı API-yə yalnız runtime funksiyalar (müəllim, sinif, analitika) `openapi-fetch` klienti ilə müraciət edir |
| Q3 | **Route-lar** | `/kurikulum`, `/zaman`, `/sexsiyyetler`... (prefiksiz) | `/az/persons/…`, `/az/timeline/…` | **Azərbaycan dilində ASCII adlar + `/az/` prefiksi saxlanılır.** Statik export-da proxy (middleware) yoxdur, ona görə `next-intl` `localePrefix: "always"` ilə işləyir. Köhnə ünvanlar yeni ünvanlara yönləndirilir (`?step=` saxlanılır). Əlavə: `/dovletler` və `/mekanlar` siyahı səhifələri (dizaynın menyusunda var, spesifikasiyada unudulub) |
| Q4 | **Keçid strategiyası** | — | `main`-ə hər push GitHub Pages-ə deploy olunur | **Yeni ekranlar köhnələrin yanında, `main`-də qurulur.** Route adları onsuz da dəyişir, ona görə köhnə və yeni səhifələr toqquşmur. Ekran hazır olanda köhnə route yönləndirməyə çevrilir. Sayt heç bir commit-də sınmır |
| Q5 | **Backend dəyişiklikləri** (§13 + əlavələr, bax §11) | "BACKEND_SPEC-ə əlavə ediləcək siyahı hazırla" | Kurikulum modeli, `template`, `era.weight` yoxdur | **Backend dəyişikliklərini mən edirəm**, ayrıca commit-lərlə, onlardan asılı frontend mərhələsindən dərhal əvvəl (B1 → mərhələ 6, B2 → 7, B3 → 13) |
| Q6 | **Dizaynda olmayan mövcud funksiyalar** | — | Qlossari, "Bu zaman dünyada", səsli nəql, ilkin mənbədən sitat, kolleksiya kartları, seçimin nəticəsi, şəhər kartı | **Saxlanılır.** `StoryPanel`-də "Ətraflı" bölməsinə yığılır (default yığılmış), şəhər kartı marker klikində açılır. Dizaynın kompozisiyası pozulmur |
| Q7 | **Zod sxemləri** | `shared/schema`-dan generasiya | ADR-0005: Zod mənbədir, JSON Schema ondan çıxarılır. 3-cü addımı (əks istiqamət) sən təxirə salmısan | **Hazırkı istiqamət qalır** (Zod → JSON Schema). Əks istiqamət ayrıca mərhələdir |
| Q8 | **Tema id-ləri və şriftlər** | `aq-qoyunlu`, `safavid`, `afsharid`, `victory-2020` | Datada `turkman-tebriz`, `sefevi`, `efshar`, `muasir-zefer` (+ `efshar-hind` variantı). Hər temanın öz başlıq şrifti var (Cormorant, Alegreya SC...) | **Data id-ləri qalır**, spesifikasiyadakı adlar yalnız təsvirdir. **Dövr şriftləri çıxarılır**: dizayn hər yerdə yalnız Noto Serif Display + Inter işlədir |
| Q9 | **Proyektor rejimi** | `/muellim/teqdimat/[...]` (auth altında) | İndi giriş tələb etmir | **Proyektor rejimi girişsiz işləyir** (şəxsi data yoxdur, hesabı olmayan müəllim də istifadə edə bilər). Siniflər, mövzu təyini və nəticələr giriş tələb edir |

---

## 2. Mövcud vəziyyətin auditi

**Yer:** frontend repo kökündədir (`src/`, `data/`, `public/`, `scripts/`, `tests/`), `frontend/` qovluğu yoxdur (ADR-0004).
Spesifikasiyadakı `frontend/` hər yerdə "kök" kimi oxunur.

**Stack:** Next.js 16.4.6 (App Router, `output: "export"`, `trailingSlash`), React 19.3, TypeScript 5.9 (strict, `noUncheckedIndexedAccess`),
Tailwind 4.3, `motion` 14 (Framer Motion-un davamı), `maplibre-gl` 6 (birbaşa, imperativ), turf 7, Howler 2.2, Zod 4.6, Vitest 5, Playwright 1.64.
Zustand, TanStack Query, next-intl, Storybook, Testing Library, axe və Serwist **yoxdur**.

**Həcm:** `src/`-də 110 fayl, ~13 500 sətir (generasiya olunan `openapi.ts` xaric). 15 unit test faylı (105 test, hamısı keçir), 12 e2e faylı.

**Data:** 3 şəxsiyyət (50 mərhələ), 1 müharibə (44 gün), 1 dövlət (Əfşarlar), 4 dövr (Ağqoyunlu, Səfəvi, Əfşar, müasir), 6 tema, 54 polity,
18 ərazi snapshot-ı, məkanlar, hökmdarlar, xatirə günləri, dünya hadisələri. **Kurikulum datası yoxdur.**

**Vizual dil:** hazırkı UI açıq rəngli perqamentdir (`globals.css`, 804 sətir). Yeni dizayn tünd gecə zəminidir, perqament yalnız xəritədədir.
Bu, vizual qatın demək olar ki, tam yenidən yazılması deməkdir. Domen, data və məntiq qatı isə yaxşı vəziyyətdədir və saxlanılır.

**Güclü tərəflər (saxlanılır):**
- Zod sxemi, registry, bütövlük qaydaları, `HistoryRepository`, iki data mənbəyi (`static` / `api` eksportu).
- Build zamanı hesablanan adapterlər: `features/simulation/model.ts`, `conflicts/model.ts`, `states/model.ts` (hamarlanmış marşrut, yaş, məsafə, quiz).
  Turf client bundle-a düşmür.
- Ümumi `EngineStep` modeli (şəxsiyyət, müharibə günü, dövlət mərhələsi eyni mühərrikdə).
- Xəritə məntiqi: snapshot crossfade, marşrut progress-i (`polyline.ts`), döyüş oxları, məkan ikonları, label declutter.
- Howler səs mühərriki (4 kanal, mood → səs xəritəsi, crossfade, əvvəlcədən yükləmə).
- Fakt/rəvayət (claims), müqayisə məntiqi, "Tarixdə bu gün", məkan tarixçəsi, hökmdar paneli datası, anonim analitika klienti.

**Zəif tərəflər (yenidən yazılır):**
- `SimulationEngine.tsx` (783 sətir) və `MapStage.tsx` (532 sətir) monolitdir. Xoreoqrafiya, panel, səs və naviqasiya bir komponentdədir.
- State öz yazdığımız `createStore` ilə (`useSyncExternalStore` + localStorage). Spesifikasiya Zustand tələb edir.
- i18n öz yazdığımız `t()`/`getMessages()`-dir, bəzi mətnlər komponentlərdə.
- Komponentlərdə hex rənglər var (məs. `MapStage`-dəki SVG-lər).
- Component testləri və Storybook yoxdur.

---

## 3. Route xəritəsi

Bütün səhifələr `generateStaticParams` ilə build zamanı yaradılır. Query parametrləri (`?step=`, `?year=`) brauzerdə oxunur (`useSearchParams` + `Suspense`).

| Route (`/az/` prefiksi ilə) | Ekran | Render | Köhnə route |
|---|---|---|---|
| `/` | `/az/`-ə yönləndirmə | statik, client redirect | eyni |
| `/az/` | Ana səhifə | SSG + client adaları | `Hub` |
| `/az/kurikulum/` | son seçilən sinfə yönləndirir, seçim yoxdursa sinif seçimi | SSG qabıq + client | yeni |
| `/az/kurikulum/[grade]/` | sinif: bölmələr, mövzular (6–11) | SSG | yeni |
| `/az/kurikulum/[grade]/[topicSlug]/` | mövzu simulyasiyası | SSG (datada olan mövzular) | yeni |
| `/az/zaman/` | zaman şkalası `?year=&grade=&layers=` | SSG qabıq + client | `/az/timeline/` |
| `/az/sexsiyyetler/` | kolleksiya | SSG | `/az/persons/` |
| `/az/sexsiyyetler/[slug]/` | şəxsiyyət simulyasiyası `?step=&mode=&legends=` | SSG + client | `/az/persons/[id]/`, `/az/person/[id]/` |
| `/az/sexsiyyetler/[slug]/final/` | irs, quiz, pasport | SSG | engine-in final paneli |
| `/az/doyusler/` | kolleksiya | SSG | `/az/conflicts/` |
| `/az/doyusler/[slug]/` | müharibə girişi | SSG | conflict start gate |
| `/az/doyusler/[slug]/gun/` | gün görünüşü `?day=2020-10-20` | SSG + client | `/az/conflicts/[id]/` |
| `/az/dovletler/` | kolleksiya (**əlavə**) | SSG | `/az/states/` |
| `/az/dovletler/[slug]/` | dövlət simulyasiyası `?step=` | SSG + client | `/az/states/[id]/` |
| `/az/mekanlar/` | məkanlar siyahısı (**əlavə**) | SSG | `/az/places/` |
| `/az/mekanlar/[slug]/` | məkan səhifəsi | SSG | `/az/places/[id]/` |
| `/az/muqayise/` | `?a=person:uzun-hasan&b=person:shah-ismayil` | SSG qabıq + client | `/az/compare/` |
| `/az/muellim/` | müəllim paneli (giriş) | client-only, canlı API | yeni |
| `/az/muellim/teqdimat/[...path]/` | proyektor rejimi (`path` = `sexsiyyetler/shah-ismayil` və s.) | SSG, bütün simulyasiyalar üçün | müəllim rejimi (ayar) |
| `/az/pasport/` | tarix pasportu (localStorage) | SSG qabıq + client | kolleksiya kartları |

**Qeydlər:**
- Slug-lar datanın id-ləridir: `shah-ismayil` (spesifikasiyadakı `shah-ismail` deyil), `karabakh-war-2020`, `afshar`.
- URL vəziyyəti: `step`, `mode=story|learn`, `legends=0|1`, `year`, `grade`, `layers`, `day`. Addım dəyişəndə `history.replaceState`, keçidlər `push`.
- Çarpaz keçid stack-i: `sessionStorage`-da (bugünkü `navStack.ts` formatı), Zustand store-a köçürülür.
- Köhnə route-lar Q4-ə görə: ekranın yeni versiyası hazır olana qədər işləyir, sonra `?step=`-i saxlayan yönləndirməyə çevrilir.
- Battle (`chaldiran-1514` və s.) üçün ayrıca route spesifikasiyada yoxdur. Bugünkü kimi: döyüş müharibənin içindədirsə aktiv, yoxdursa "tezliklə".

---

## 4. Layout ağacı

```
app/layout.tsx                          <html lang>, şriftlər (Noto Serif Display, Inter), tokens.css
└─ app/[locale]/layout.tsx              setRequestLocale, NextIntlClientProvider, <Providers>:
   │                                      QueryClientProvider, ThemeRoot (data-theme + crossfade),
   │                                      MotionConfig (reducedMotion), AudioProvider, LiveRegion (aria-live)
   ├─ (site)/layout.tsx                 SiteHeader + SiteFooter, Container
   │   ├─ page.tsx                      Ana səhifə
   │   ├─ kurikulum/page.tsx, kurikulum/[grade]/page.tsx
   │   ├─ zaman/page.tsx                (header "kompakt" variantında + Fənn keçidi)
   │   ├─ sexsiyyetler/page.tsx, doyusler/page.tsx, dovletler/page.tsx, mekanlar/page.tsx
   │   ├─ mekanlar/[slug]/page.tsx, muqayise/page.tsx, pasport/page.tsx
   ├─ (immersive)/layout.tsx            tam ekran, sayt header-i yoxdur
   │   ├─ sexsiyyetler/[slug]/page.tsx, sexsiyyetler/[slug]/final/page.tsx
   │   ├─ dovletler/[slug]/page.tsx
   │   ├─ doyusler/[slug]/page.tsx (giriş), doyusler/[slug]/gun/page.tsx
   │   ├─ kurikulum/[grade]/[topicSlug]/page.tsx
   │   └─ muellim/teqdimat/[...path]/page.tsx   (SimulationShell projector variantı)
   ├─ (teacher)/muellim/layout.tsx      TeacherSidebar, giriş yoxlaması (client)
   │   └─ page.tsx
   ├─ (legacy)/…                        köhnə route-lar, keçid dövründə (Q4), sonra yönləndirmələr
   ├─ not-found.tsx, error.tsx
```

`(legacy)` qrupu köhnə `globals.css`-i öz layout-unda yükləyir. Yeni dizayn sistemi `tokens.css`-dədir və köhnə səhifələrə təsir etmir.
Keçid bitəndə `(legacy)` və `globals.css` silinir.

---

## 5. Komponent siyahısı

### 5.1. Paylaşılan (dizayn sistemi, `src/components/`)

| Qrup | Komponentlər |
|---|---|
| `ui/` | `Button` (gold primary, outline, ghost, white: müharibə), `IconButton` (≥44 px), `Chip` (aktiv / passiv "tezliklə"), `Badge`, `Card` (tema gradienti ilə), `Panel`, `Eyebrow`, `SectionHeading`, `SegmentedControl` (Hekayə/Öyrənmə, Fənn), `Tabs` (siniflər), `ProgressRing`, `ProgressBar`, `ProgressSegments`, `Stat` (serif rəqəm + etiket), `AnimatedNumber` (mövcud), `EmptyState`, `ComingSoon`, `Popover`, `BottomSheet` (3 vəziyyət), `Checkbox`, `Switch`, `Skeleton`, `VisuallyHidden`, `LiveRegion` |
| `layout/` | `SiteHeader` (tam / kompakt), `SiteFooter`, `Container` (1280 px, 40/16–20 px), `ThemeRoot`, `ThemeScope` (bir kartı başqa dövrün rəngində göstərmək üçün) |
| `atmosphere/` | `AtmosphereBackground` + qatlar: `Ground`, `GirihPattern`, `Silhouette` (dağlar, şəhər, Şuşa qayaları, səma xətti), `Effects` (toz, ulduzlar, şəfəq; canvas və ya CSS), `Vignette`, `Grain` (`feTurbulence`) |
| `icons/` | `Logo` (səkkizguşəli ulduz), `CapitalCrown`, `BattleSwords`, `Shrine`, `Fortress`, `Port`, `City`, `Carnation`, `Compass`. Ümumi ikonlar Lucide-dən |
| `claims/` | `ClaimBadge` (ikon + söz + rəng), `ClaimWhy` (popover), `AlternativeVersion`, `LegendsToggle` |
| `cards/` | `PeriodCard` (şəxsiyyət kartı öz temasında, "Davam et · 7/14"), `CollectionCard`, `TopicRow` |

### 5.2. Simulyasiya mühərriki (`src/features/simulation-shell/`)

`SimulationShell`, `SimulationTopBar`, `MapStage`, `PortraitCard`, `DayCounter`, `YearAgeCounter`, `StoryPanel` (desktop: 420 px; mobil: `BottomSheet`),
`StepHeader`, `StepTitle`, `Narrative`, `FactualSummary`, `Sources`, `TextbookRef`, `RelatedChips`, `ChoiceCard`, `MoreSection` (Q6), `StepNav`,
`SimulationTimeline`, `AutoplayControl`.
Məntiq: `useStepChoreography` (§5.3 xoreoqrafiyası, ləğv və "skip"), `useStepUrlState`, `useSimulationKeys`, `useSwipe`,
şablon reyestri `templates/{location,journey,battle,territory,liberation,infographic,monument,artifact,migration,treaty}.ts`.

Xoreoqrafiya xəritədən asılı deyil: `MapController` interfeysi (`flyTo`, `drawRoute`, `setSnapshot`, `pulse`, `skipToEnd`) ilə işləyir.
Bu, mərhələ 3-ü mərhələ 4-dən (xəritə) ayırır və xoreoqrafiyanı mock ilə test etməyə imkan verir.

### 5.3. Xəritə (`src/features/map/`)

`@vis.gl/react-maplibre` (`react-map-gl/maplibre` ilə eyni paket) üzərində: `BaseMap` (öz stilimiz, variantlar), `TerritoryLayer` (fill + line, `feature-state`, crossfade),
`RouteLayer` (`line-gradient`, `lineMetrics`, rAF progress, solğun iz), `PlaceMarkers` (importance-a görə), `PulseMarker`, `BattleArrows`, `MigrationFlows`,
`LiberationLayer`, `MapLegend`, `MapCompass`, `ApproxBordersNote`, `ZoomControls`, `MapOverlay` (grain + vignette, DOM qatı), `SvgFallbackMap` (WebGL yoxdursa).

### 5.4. Ekrana xas

| Ekran | Komponentlər |
|---|---|
| Ana səhifə | `Hero` (səmada animasiyalı marşrut), `CurriculumTeaser` (sinif seçimi + davam kartı), `PersonCards`, `ConflictCard`, `StateCard`, `TimelinePreview`, `OnThisDay`, `ContentCounts` |
| Zaman şkalası | `YearDisplay`, `LayerToggles`, `RulerPanel`, `SubjectSwitch`, `GradeFilter`, `EraBands`, `TimelineLanes` (dövlətlər, hadisələr, şəxsiyyətlər), `TimelineAxis`, `TimeScrubber`; `lib/timeScale.ts` (`yearToX`, `xToYear`) |
| Kurikulum | `GradeTabs`, `SectionList`, `TopicList`, `AssignedTopicCard`, `ClassCodeDialog`, `SampleNotice` |
| Dövlət | `FactsGrid`, `DynastyStrip` (mövcud, yenidən stilləşir), `StageStrip` |
| Müharibə | `VictoryIntro` (səma, dalğalanan bayraq, ay-ulduz, Şuşa qayaları, hərf-hərf başlıq, "keç"), `DayPanel`, `LiberatedCount`, `Commanders`, `HeroesStrip`, `MemorialSection`, `DaysTimeline` |
| Məkan | `PlaceHero` (şəhər silueti), `PlaceTimeline` (şaquli, dövr rəngli kartlar, scroll ilə vurğu rəngi) |
| Müqayisə | `EntityPicker` (axtarış), `RelationBadge`, `CompareMap`, `IntersectionsPanel`, `ParallelTimelines` |
| Final | `LifeRouteReplay`, `FinalStats`, `Quiz` (4 növ: çoxseçimli, fakt/rəvayət, xronoloji sıra, xəritədə tap), `QuizExplanation`, `PassportStamps` |
| Müəllim | `TeacherSidebar`, `ClassHeader` (kod, proyektor), `StatCard`, `MissedQuestions`, `AbandonmentChart`, `AssignTopic`, `LiveQuizComingSoon`, `LoginForm` |
| Pasport | `PassportBook`, `Stamp` (möhür animasiyası + səs) |
| Ayarlar | `SettingsPanel` (kanal səsləri, yüngül rejim, proyektor) |

---

## 6. Tema sistemi

**Tokenlər.** `src/styles/tokens.css`: §3.1-dəki dəyişənlər eynilə `:root`-da. Tailwind 4 `@theme inline` onları utility-lərə bağlayır
(`bg-base`, `bg-raised`, `text-primary`, `text-muted`, `border-subtle`, `claim-fact` və s.). Radius, boşluq, kölgə, şrift şkalası da token kimi.

**Hex qadağası.** Komponentlərdə hex yazılmır. ESLint qaydası (`no-restricted-syntax`, `#[0-9a-f]{3,8}` literal-ları) `src/components` və `src/features`-də xəta verir.
İstisnalar: `tokens.css`, `theme/fallbacks.ts`, xəritə stil faylı (MapLibre CSS dəyişəni oxumur, rənglər tokenlərdən runtime-da oxunur).

**Dövr temaları.**
- `data-theme` atributu `<html>`-də (`ThemeRoot`). Bir hissəni başqa dövrün rəngində göstərmək üçün `ThemeScope` (məkan timeline-ının kartları).
- Tema datası `data/themes/` → (backend `/themes/{slug}`) gəlir. Theme sxeminə **yeni, isteğe bağlı `ui` bloku** əlavə olunur:
  `{ bg, bgRaised?, bgPanel?, accent, accentInk?, secondary?: string[] }` (tünd UI palitrası). Bugünkü `palette` xəritə və köhnə səhifələr üçün qalır.
- `ui` yoxdursa, kodda fallback: §3.2 cədvəli (`default`, `turkman-tebriz` = Ağqoyunlu, `sefevi`, `efshar`, `muasir-zefer` = 2020). Qalan dövrlər üçün
  `deriveTheme(eraColor)`: dövr rəngindən tünd zəmin və açıq vurğu törədilir.
- `[data-theme=…]` blokları build zamanı datadan generasiya olunur (Server Component `<style>`), yalnız səhifənin işlətdiyi temalar.
- **Crossfade:** rəng dəyişənləri `@property` ilə qeydiyyatdan keçir, `transition: 750ms` (600–900 ms aralığı). `prefers-reduced-motion` və yüngül rejimdə ani.
- **Mood** temanın içində tonlayır (xəritə üzərində `multiply` qatı, vurğunun yumşaq sürüşməsi). Bugünkü `MOOD_STYLES` saxlanılır.

**Kontrast.** Unit test hər tema üçün mətn tokenlərinin zəmin tokenlərinə qarşı WCAG nisbətini hesablayır (≥ 4.5:1, kiçik `text-muted` də daxil).
E2E-də axe hər route-da. Törədilən temalar da testdən keçir: kontrast çatmırsa, `deriveTheme` mətni avtomatik açır.

**Şriftlər.** `next/font/google`: Noto Serif Display (500, 700, italic 500) və Inter (400, 500, 600), `latin` + `latin-ext`.
Bugünkü Noto Serif, Noto Sans və 4 dövr şrifti çıxarılır (Q8). Mərhələ 1-də ə, Ə, ğ, ı, İ, ö, ü, ç, ş qliflərinin hər iki şriftdə olduğu skriptlə yoxlanılır.
Böyük rəqəmlər (il, yaş, gün) həmişə serif: `Stat`, `YearAgeCounter`, `DayCounter` bunu məcburi edir.

**Yüngül rejim.** `<html class="lite">`: atmosfer effektləri, parallax, grain, hillshade söndürülür. Avtomatik aşkarlama (`hardwareConcurrency`, `deviceMemory`, FPS ölçümü) + əl ilə seçim.

---

## 7. Data qatı

```
build zamanı:  data/ və ya .content/data (api eksportu) ─► StaticRepository (Zod) ─► Server Components ─► adapterlər (EngineStep + template) ─► props
brauzerdə:     public/data/territories/<id>.json ─► TanStack Query (staleTime: ∞, növbəti snapshot prefetch)
               canlı API (NEXT_PUBLIC_API_URL) ─► openapi-fetch (tipli, src/data/api/openapi.ts) ─► TanStack Query
                   └─ müəllim paneli, sinif kodu ilə təyin olunmuş mövzu, müqayisə axtarışı (və ya statik indeks), analitika
```

- `HistoryRepository` interfeysi saxlanılır. Yeni metodlar: `getCurriculum(subject)`, `getGrade(subject, grade)`, `getTopicSteps(slug)`.
- **Şablon (`template`).** Addımlarda bu sahə hələ yoxdur. Adapter onu mövcud datadan törədir: marşrutu olan həyat hadisəsi → `journey`,
  `outcome` olan → `battle`, dövlət mərhələsi → `territory`, müharibə günü → `liberation`, qalanı → `location`.
  Datada açıq `template` yazılıbsa (B1-dən sonra), o üstündür.
- **Kurikulum.** Real data olmayana qədər production-da aydın boş vəziyyət göstərilir. Storybook və testlər üçün nümunə data
  `fixtures/curriculum.sample.json`-dadır və hər qeyddə `"sample": true` + UI-da "Nümunə məzmun" qeydi var.
- **Saylar** (ana səhifə, məkan) yalnız repository-dən hesablanır.

---

## 8. State

| Store (Zustand) | Saxlanma | Məzmun |
|---|---|---|
| `useSimulationStore` | yox | aktiv addım, keçid fazası, avtomatik oynatma, sheet vəziyyəti, skip siqnalı |
| `useNavigationStack` | `sessionStorage` | çarpaz keçid stack-i `{href, stepKey, label}` |
| `useAudioStore` | `localStorage` | səssiz, kanal səviyyələri, "audio açılıb" |
| `usePrefsStore` | `localStorage` | yüngül rejim (auto/on/off), son sinif, rəvayətlər, rejim, sinif kodu, proyektor |
| `useProgressStore` | `localStorage` | simulyasiya irəliləyişi, quiz nəticələri, pasport möhürləri, mövzu statusları |

Bugünkü `tarix:settings` və `tarix:progress` açarları və formatı `persist`-in `migrate` funksiyası ilə köçürülür: istifadəçinin irəliləyişi itmir.
Bütün `localStorage` girişləri `try/catch`-dədir (bugünkü kimi).

---

## 9. Mövcud kod: nə qalır, nə yenidən yazılır

| Qərar | Fayllar |
|---|---|
| **Qalır** (genişlənir) | `src/domain/*`, `src/data/*` (`FileSystemRepository` → `StaticRepository`), `src/lib/{dates,geo,claims,compare,onThisDay,placeHistory,places,portraits,rulers,territory,historyIndex,worldContext,glossary,narration,basePath}.ts`, `src/lib/analytics/*`, adapterlər (`simulation/model.ts`, `conflicts/{model,liberation}.ts`, `states/model.ts`), `features/audio/{engine,manifest}.ts`, `scripts/*`, `data/*`, bütün unit testlər |
| **Yeni komponentlərin içinə köçür** | `features/map/{polyline,territories,battle,landmarks,style,icons}.ts`, `engine/navStack.ts`, `engine/types.ts`, `lib/timeSlider.ts` (`timeScale.ts` ilə əvəzlənir), `lib/mood.ts`, `lib/theme.ts` |
| **Yenidən yazılır** | `src/app/**` (yeni route-lar), `features/landing/*`, `engine/{SimulationEngine,Timeline,StartGate,RelatedLinks}.tsx`, `map/{MapStage,MapLegend,MiniMap,PlaceCard,PolityPanel}.tsx`, `simulation/{PersonSimulation,PortraitCard,StoryContent,Narration}.tsx`, `conflicts/*.tsx`, `states/*.tsx`, `timeline/*.tsx`, `places/PlacePage.tsx`, `compare/*.tsx`, `legacy/LegacyPanel.tsx`, `settings/SettingsPanel.tsx`, `theme/*`, `home/OnThisDay.tsx`, `claims/*.tsx`, `components/*.tsx`, `globals.css` |
| **Zustand / next-intl ilə əvəzlənir** | `lib/store.ts`, `lib/settings.ts`, `lib/progress.ts`, `simulation/useStoredMode.ts`, `lib/i18n.ts` (`locales/az.json` namespace-lərə bölünür) |
| **Silinir** (keçid bitəndə) | `(legacy)` route-ları (yönləndirmələr qalır), `globals.css`, dövr şriftləri, perqament UI sinifləri |
| **E2E** | 12 fayl mərhələ-mərhələ yeni route və seçicilərə köçürülür. Hər mərhələdə əhatə azalmır |

---

## 10. Kitabxanalar (npm-də 2026-11-22-də yoxlanılıb)

| Paket | Versiya | Qeyd |
|---|---|---|
| `next` / `react` / `react-dom` | 16.4.6 / 19.3.1 | mövcud, ən son |
| `typescript` | **5.9.3** | 7.0.2 çıxıb (Go portu), amma Next 16.4 və `typescript-eslint` dəstəyi yoxlanılmayıb. Mərhələ 1-də yoxlanılır; dəstək yoxdursa 5.9-da qalırıq |
| `tailwindcss` / `@tailwindcss/postcss` | 4.3.5 | 4.3.3 → 4.3.5 |
| `motion` | 14.14.0 | Framer Motion-un yeni adı (`motion/react`). GSAP lazım deyil |
| `maplibre-gl` | 6.19.0 | 6.16 → 6.19 |
| `@vis.gl/react-maplibre` | 8.1.3 | `react-map-gl/maplibre` ilə eyni kod, mapbox asılılığı olmadan. `maplibre-gl >= 4` |
| `@turf/turf` | 7.4.0 | mövcud |
| `flubber` | 0.4.2 | yalnız poliqon morph performans testindən keçsə (§7 spesifikasiya) |
| `howler` | 2.2.4 | mövcud |
| `zustand` | 5.1.0 | yeni |
| `@tanstack/react-query` | 5.108.2 | yeni |
| `openapi-fetch` / `openapi-typescript` | 0.17.0 / 7.13.0 | klient yeni, tiplər mövcud |
| `zod` | 4.6.7 | mövcud |
| `next-intl` | 4.15.3 | Next 16 dəstəkləyir, statik export `localePrefix: "always"` ilə |
| `lucide-react` | 1.77.0 | yeni |
| `vitest` | 5.1.1 | 5.0.5 → 5.1.1 |
| `@testing-library/react` | 16.3.3 | yeni (+ `jsdom`) |
| `@playwright/test` | 1.65.1 | 1.64 → 1.65 |
| `@axe-core/playwright` | 4.14.0 | yeni |
| `storybook` / `@storybook/nextjs-vite` | 10.6.8 | yeni, Vite əsaslı (Vitest ilə eyni) |
| `serwist` / `@serwist/turbopack` | 9.5.15 | mərhələ 14-də. Next 16-nın bələdçisi də Serwist-i göstərir |
| `eslint` | 9.x qalır | 10.15 çıxıb; `eslint-config-next` 16.4.6 ilə uyğunluğu mərhələ 1-də yoxlanılır |

---

## 11. Backend dəyişiklikləri (BACKEND_SPEC-ə əlavə)

| Paket | Dəyişiklik | Lazım olan mərhələ |
|---|---|---|
| **B1** | `simulation_step.template` (enum, §5.2 siyahısı, isteğe bağlı). `era.weight` (müsbət ədəd, defolt 1) və `era.subject` (defolt `azerbaijan-history`). `/eras?subject=`. Theme sxeminə `ui` bloku (§6). Zod + JSON Schema + idxal + eksport + proyeksiya | 6 (2 və 4 fallback ilə işləyir) |
| **B2** | `curriculum` modulu: `subject`, `grade`, `section`, `topic`, `topic_step` (mövzu ↔ addım, sıra), `textbook_ref` (sinif, müəllif kollektivi, nəşr ili, paraqraf). Redaksiya sənəd tipi `CURRICULUM_GRADE`. `GET /curriculum/{subject}/grades`, `/curriculum/{subject}/grades/{grade}`, `/curriculum/topics/{slug}/steps`. Addımlarda `curriculumRefs[]`. `/timeline?grade=`. Statik eksporta `data/curriculum/` | 7 |
| **B3** | Müəllimin mövzu təyini: `PUT /teacher/classes/{code}/assignment {topicSlug, from, to}` (TEACHER), ictimai `GET /classes/{code}/assignment` (yalnız mövzu slug-ı və tarixlər, şəxsi data yoxdur). Analitikada mövzu üzrə toplu nəticə | 13 |

`data/` formatı da eyni dəyişiklikləri alır (`data/curriculum/`, era-larda `weight`, temalarda `ui`), ki `static` build backend olmadan işləsin.
Hər paket: Flyway miqrasiyası, testlər, OpenAPI regenerasiyası, `npm run api:types`, `ARCHITECTURE.md` və ADR yenilənməsi.

---

## 12. Mərhələ planı

Spesifikasiyanın §15 cədvəli əsasdır. Dəyişikliklər: **next-intl və Zustand mərhələ 2-də** gəlir (yeni komponentlər əvvəldən lokal fayllardan oxusun;
mərhələ 15 `en`/`ru` strukturu və yoxlamadır). **Mobil (360 px) hər mərhələdə** yoxlanılır; mərhələ 14 yekun audit, PWA və Lighthouse-dur.

| # | Mərhələ | Əsas iş | Hazırdır, əgər... |
|---|---|---|---|
| 0 | Plan | bu sənəd | təsdiqlənib, ADR-0022 yazılıb |
| 1 | Dizayn sistemi | asılılıq yeniləmələri, `tokens.css`, tema fallback-ları + `deriveTheme`, şriftlər, ikonlar, `AtmosphereBackground`, `ui/*`, Storybook, Testing Library, hex ESLint qaydası, kontrast testi | Storybook-da bütün əsas komponentlər, kontrast testi keçir |
| 2 | Layout və naviqasiya | `[locale]` + next-intl, route qrupları, `SiteHeader`/`SiteFooter`, bütün yeni route-ların skeletləri (boş vəziyyətlə), `ThemeRoot` crossfade, Zustand store-ları + miqrasiya, naviqasiya stack-i, TanStack Query | bütün route-lar açılır, köhnə sayt işləyir |
| 3 | Simulyasiya mühərriki | `SimulationShell`, `StoryPanel`, `SimulationTimeline`, `useStepChoreography` (`MapController` mock ilə testli), `location` + `journey`, klaviatura, swipe, `BottomSheet`, URL state, reduced motion, `aria-live` | şəxsiyyət addımları yeni qabıqda keçilir (müvəqqəti xəritə adapteri ilə) |
| 4 | Xəritə | react-maplibre, öz stil + variantlar, ərazi qatları və crossfade, marşrut (`line-gradient`), markerlər, overlay, SVG fallback | `MapController` real xəritə ilə, 50–60 fps ölçülüb |
| 5 | Şəxsiyyət + final | 3 şəxsiyyət sonadək, portret sistemi, final route-u, quiz (4 növ), pasport; köhnə `/persons/*` → yönləndirmə | e2e: 3 səyahət başdan sona |
| B1 | Backend | §11 B1 | backend testləri, eksport, tiplər |
| 6 | Zaman şkalası | `timeScale.ts` (parçalı-xətti, e.ə.), dövr zolaqları, sinif filtri, zoom, xəritə sinxronu (debounce ≈120 ms), `RulerPanel`, Fənn keçidi | `yearToX`/`xToYear` testləri, e2e |
| B2 | Backend | §11 B2 | kurikulum API + eksport |
| 7 | Kurikulum | sinif → bölmə → mövzu, mövzu simulyasiyası, irəliləyiş, "hazırlanır" statusu, sinif kodu | real data olmadan boş vəziyyət, fixture ilə tam axın |
| 8 | Dövlət simulyasiyası | `territory`, sülalə zolağı, Əfşarlar sonadək | e2e |
| 9 | Müharibə | `VictoryIntro`, `liberation`, gün görünüşü, 8 Noyabr kulminasiyası, xatirə bölməsi | e2e, qaydalar (§6.6) yoxlanılıb |
| 10 | Məkan + müqayisə | məkan timeline-ı, müqayisə xəritəsi, paralel timeline-lar | e2e |
| 11 | Qalan şablonlar | `battle`, `infographic`, `monument`, `artifact`, `migration`, `treaty` | Storybook-da hər biri (nümunə data ilə) |
| 12 | Səs | Zustand audio store, kanallar, mood crossfade, `permissionStatus` yoxlaması, əvvəlcədən yükləmə | yüngül rejimdə də işləyir |
| B3 | Backend | §11 B3 | |
| 13 | Müəllim paneli | giriş, siniflər, mövzu təyini, proyektor rejimi (×1.4, avtomatik oynatma), toplu nəticələr | e2e (backend mock ilə) |
| 14 | Mobil, PWA, performans | 360 px auditi, Serwist, "Oflayn üçün yüklə", Lighthouse CI, yüngül rejim avtomatikası, `(legacy)` silinir | Lighthouse hədəfləri |
| 15 | i18n | `en`/`ru` strukturu, bütün mətnlərin lokal fayllarda olması yoxlanılır | |

**Hər mərhələnin sonunda:** qısa hesabat (nə edildi, açıq suallar), Playwright ekran görüntüləri (desktop 1440 və mobil 390), dizayn artboard-u ilə yan-yana.
Funksionallıq və refaktorinq ayrı commit-lərdə. `ARCHITECTURE.md` yerinə frontend üçün bu sənəd yenilənir.

---

## 13. Risklər

- **Məzmun boşluqları.** Dizayn 15 dövr, kurikulum, dərslik paraqrafları, şəhid foto və sayları göstərir. Datada 4 dövr var, kurikulum yoxdur.
  UI dizayndakından "boş" görünəcək: boş vəziyyətlər, "hazırlanır" statusları. Dizayndakı `[...]` mətnləri data deyil və koda keçmir.
- **Vizual regressiya** ekran görüntüləri OS-dən asılıdır (Windows və Linux şrift rendering-i). Baseline-lar CI-da (Linux) yaradılır,
  lokalda yalnız müqayisə üçün ekran görüntüsü çəkilir.
- **Windows-da statik export** iç-içə route-ların prefetch fayllarını səhv adlandırır (README). Lokal e2e-də keçidlər tam yüklənmə ilə işləyir; CI-da problem yoxdur.
- **Performans.** Atmosfer qatları + WebGL xəritə zəif iGPU-da ağır ola bilər. Yüngül rejim avtomatik açılır, FPS ölçümü e2e-dədir (bugünkü kimi).
- **`useSearchParams` və SSG.** Dərin linkdə ilk HTML 1-ci addımı göstərir, sonra `?step=`-ə keçir. Qabıq parametr oxunana qədər skelet göstərəcək.
- **Asılılıq yeniləmələri** (TS 7, ESLint 10) uyğunluq yoxlamasından keçməsə, əvvəlki major-da qalırıq və səbəbi hesabatda yazılır.

---

## 14. Spesifikasiyadakı kiçik uyğunsuzluqlar

- §4: `b=person:shah-ismail` → real slug `shah-ismayil`.
- §0: "mövcud `frontend/` kodu" → repo kökü (ADR-0004).
- §2 (Zod generasiyası) və §9 (`ApiRepository`, SSR/ISR) → Q7, Q2, Q1.
- §4: `/dovletler` və `/mekanlar` siyahıları yoxdur, dizaynın menyusu isə onlara keçid verir → Q3.
- §3.2 tema slug-ları datadakı id-lərlə üst-üstə düşmür → Q8.

---

## 15. Mərhələ vəziyyəti

| # | Mərhələ | Vəziyyət |
|---|---|---|
| 0 | Plan | ✅ 2026-11-22, ADR-0022 |
| 1 | Dizayn sistemi | ✅ 2026-11-22 |
| 2 | Layout və naviqasiya | ✅ 2026-11-23 |
| 3 | Simulyasiya mühərriki | ✅ 2026-11-23 |
| 4 | Xəritə | ✅ 2026-11-24 |
| 5–15 | | gözləyir |

### Mərhələ 1: dizayn sistemi

**Fayllar:**
- `src/styles/tokens.css`: §3.1 tokenləri, `@property` qeydiyyatı (crossfade 750 ms), `.ds-root`. `src/styles/design-system.css`: Tailwind adları. `globals.css` onu import edir.
- `src/theme/`: `color.ts` (qarışdırma, WCAG kontrastı, OKLCH), `tokens.ts` (CSS-in güzgüsü), `fallbacks.ts` (§3.2 + dizayndan götürülən mətn və səth rəngləri), `resolve.ts` (`themeTokens`, `deriveUiPalette`, `themeCss`).
- `src/styles/fonts.ts`: Noto Serif Display və Inter (variable). Köhnə səhifələrin şriftləri də burada, mərhələ 14-ə qədər.
- `src/components/`: `ui/` (Button, IconButton, Chip, Badge, Card, Panel, Eyebrow, SectionHeading, SegmentedControl, Progress*, Stat, EmptyState, ComingSoon, Checkbox), `claims/ClaimBadge`, `icons/`, `atmosphere/AtmosphereBackground`, `layout/ThemeScope`, `layout/ThemeStyles`.
- Storybook (`.storybook/`), komponent testləri (`tests/component/`), `scripts/story-screenshots.ts`.

**Tailwind adları** (komponentlərdə yalnız bunlar, hex qadağandır):

| Token | Utility |
|---|---|
| `--bg-base`, `--bg-raised`, `--bg-panel` | `bg-surface`, `bg-surface-raised`, `bg-surface-panel` |
| `--text-primary`, `--text-secondary`, `--text-muted` | `text-fg`, `text-fg-secondary`, `text-fg-muted` |
| `--accent`, `--accent-ink`, `--accent-hover`, `--eyebrow` | `accent`, `accent-ink`, `accent-hover`, `eyebrow` (`bg-`, `text-`, `border-`…) |
| `--border-subtle`, `--border-strong` | `border-line`, `border-line-strong` |
| `--secondary`, `--secondary-2` | `secondary`, `secondary-2` (səthləri tonlayır, mətn fonu deyil) |
| `--claim-*`, `--negative`, `--map-*`, `--flag-*`, `--sky-*`, `--dawn-glow` | eyni adla |
| şriftlər | `font-heading` (Noto Serif Display), `font-ui` (Inter) |
| ölçülər | `text-12` … `text-88`, `rounded-button(-lg)`, `rounded-panel`, `rounded-card(-lg)`, `shadow-deep`, `tracking-eyebrow(-wide)`, `max-w-content` |

**Qərarlar və qeydlər:**
- TypeScript 5.9.3-də qalır: 7.0-ın klassik compiler API-si yoxdur, `typescript-eslint` `<6.1` tələb edir, 6.0.3 isə `openapi-typescript` 7.13-ün `^5` peer-i ilə toqquşur. ESLint 9.39-da qalır: `eslint-plugin-react` 7.37 ESLint 10-u dəstəkləmir.
- Bütün dizayn temaları AA-dan düzəlişsiz keçir. `themeTokens` buna baxmayaraq hər mətn rəngini və vurğunu lazım olsa OKLCH-da açır, ona görə törədilən temalar da oxunaqlı qalır (test 9 fərqli rənglə yoxlayır).
- 2020, Səfəvi və Əfşar temalarının səth rəngləri artboard-lardan götürülüb (`#13263A`, `#1E0C0F`, `#1C130B` və s.).
- `next-intl` komponentlər üçün indidən quraşdırılıb (`useTranslations("ui")`), routing mərhələ 2-də. UI mətnləri `locales/az.json`-un `ui` bölməsindədir.
- Storybook telemetriyası söndürülüb. `@storybook/nextjs-vite`-in docgen plaqininin dev asılılığında (`glob` → `minimatch`) orta dərəcəli bir xəbərdarlıq qalır. Production bundle-a düşmür.
- next-intl-in `@swc/core` və `@parcel/watcher` install skriptləri `allowScripts`-də rədd edilib: hazır Windows/Linux binary paketləri onsuz da quraşdırılır.

### Mərhələ 2: layout və naviqasiya

**Quruluş:**
- `src/i18n/` (`routing`, `navigation`, `request`), `next.config.ts`-də next-intl plaqini. Yeni komponentlər mətnləri `useTranslations` ilə oxuyur, keçidlər locale-siz yazılır (`@/i18n/navigation` `Link`).
- `app/[locale]/(ds)/layout.tsx`: mesajlar (yalnız client namespace-ləri), `Providers` (TanStack Query, `MotionConfig`), bütün temaların `[data-theme]` blokları, tək `ThemeRoot`. Altında `(site)` (header + footer) və `(immersive)` (tam ekran) qrupları.
- `ThemeRoot`: default tema + `usePeriodTheme`/`PeriodTheme` ilə səhifə və addım səviyyəsində dəyişiklik, `<html>`-də güzgü (`ds`, `data-theme`, `lite`). Bütün yeni səhifələr bir kökü paylaşdığı üçün aralarında keçid crossfade olur.
- Zustand: `lib/store.ts` indi Zustand + persist-dir, dəyəri xam formatda saxlayır (köhnə `tarix:settings`, `tarix:progress`, `tarix:navstack` dəyişmir, köhnə səhifələr eyni store-u oxuyur). Yeni: `stores/prefs.ts` (`tarix:prefs`: son sinif), `stores/theme.ts`.
- `lib/ordinal.ts` (sıra sayları, 37 test), `lib/historicalDate.ts` ("1501-ci il", "e.ə. VII əsr"), `lib/routes.ts`, `lib/grades.ts`.

**Ekranlar:**
- Ana səhifə (yeni): hero (datadan nümunə marşrut), "Necə işləyir?" (üç yol + sinif seçimi), şəxsiyyət kartları (öz dövr temasında, irəliləyiş bayrağı), müharibə və dövlət kartları, zaman xətti önizləməsi (era zolaqları, il sürgüsü, həmin ilin hökmdarları), "Tarixdə bu gün" (gün → ay → gizlənir; 27 Sentyabr və 8 Noyabr 2020 temasında).
- Kolleksiyalar: şəxsiyyətlər (köhnə siyahının dövr filtri saxlanılıb, `?dovr=`), döyüşlər, dövlətlər, məkanlar (tip üzrə qruplar). Köhnə siyahı route-ları yönləndirməyə çevrildi.
- Kurikulum: sinif səhifələri 6–11 (boş vəziyyət), `/kurikulum/` son sinfi açır.
- Skeletlər: simulyasiya, final, müharibə girişi və gün, dövlət, məkan, zaman, müqayisə, pasport, müəllim. Başlıq datadan, tema dövrdən, "Hazırkı versiyada aç" köhnə səhifəyə.

**Qərarlar və qeydlər:**
- Ana səhifə bu mərhələdə tam quruldu (heç bir mərhələyə bağlı deyildi). Simulyasiya keçidləri köhnə səhifələrə gedir, onların mərhələsində `entityPath()` yeni ünvanlara keçəcək.
- "Necə işləyir?" düyməsi səhifədaxili bölməyə aparır: dizaynda ayrıca izah səhifəsi yoxdur. Spesifikasiyanın tələb etdiyi "Dərsliklə öyrən" bloku dizaynda yox idi, eyni dildə əlavə olundu.
- Hero marşrutu: birinci şəxsiyyətin doğulduğu yer → taclandığı yer (datada `coronation` olan ilk şəxsiyyət). Hazırkı datada Uzun Həsən: Amid · 1425 → Amid · 1452.
- Kartdakı dövr: şəxsiyyətin öldüyü ildəki dövrü (köhnə simulyasiyanın finalı ilə eyni qayda), əsr isə ömrün ortasından hesablanır.
- Köhnə temaların fon şəkilləri (`backgroundArt`) yeni dizaynda istifadə olunmur: atmosfer SVG qatlarından qurulur (§3.5). Data dəyişməyib.
- Footer yalnız mövcud səhifələrə keçid verir. Dizayndakı "Mənbələr · Lisenziyalar · Məxfilik" səhifələri hələ yoxdur (açıq sual).
- "Tarixdə bu gün"-ün gizlənmə halı yalnız komponent testində yoxlanılır: hazırkı datada hər ayda hadisə var.

### Mərhələ 3: simulyasiya mühərriki

**Quruluş** (`src/features/simulation-shell/`):
- `types.ts`: `ShellData` / `ShellStep` (build zamanı locale üçün həll olunmuş sətirlər) və `MapController` (`showStep`, `flyTo`, `drawRoute`).
- `templates.ts`: `deriveTemplate`. Datada `template` yoxdur (B1), ona görə addımdan oxunur: müharibə günü → `liberation`, dövlət mərhələsi → `territory`, nəticəsi olan döyüş → `battle`, marşrut → `journey`, qalanı → `location`. Hələ qurulmamış şablonlar `location` kimi oynanır, marşrutu varsa yenə çəkilir.
- `choreography.ts`: `planTransition` (§5.3 vaxtları) və `runTransition`. Hər ikisi xəritədən və React-dan asılı deyil, mock `MapController` və saxta taymerlərlə test olunur.
- `map/SvgMap.tsx`: `MapController`-in SVG reallaşdırması: quru konturu (Urmiya və Xəzər boşluq kimi), dövrə görə açılan məkanlar, keçilmiş marşrutların solğun izi, cari marşrut və onu izləyən marker, pulsasiya edən marker, perqament vignette və grain (DOM qatı). Mərhələ 4-də MapLibre eyni interfeysi reallaşdıracaq, SVG isə WebGL olmayanda fallback kimi qalacaq (§7).
- `SimulationShell.tsx`: top bar (geri, rejim, rəvayətlər, avtomatik oynatma, səs), portret kartı (yaş və il sayğacları), hekayə paneli (desktop 420 px), `BottomSheet` (telefon, 3 vəziyyət), "Həyat yolu" timeline-ı.
- `stores/simulation.ts` (Zustand): addım, panelin göstərdiyi addım, sayğaclar, hazır olan addım, avtomatik oynatma, panel və sheet vəziyyəti, `aria-live` mətni.
- `personAdapter.ts`: `buildJourney` → `ShellData`. Route: `/az/sexsiyyetler/<id>/`.

**Xoreoqrafiya:** 0 ms panel çıxır (200 ms) → 100 ms tema (750 ms crossfade) → 150 ms kamera (900–1800 ms, məsafəyə görə, `cubic-bezier(.65,0,.35,1)`) və sayğaclar (600 ms) → kamera çatanda marşrut (1200–2000 ms) → kamera yerə oturarkən yeni mətn (40 ms stagger).
Mətn kliklədən 0.9–2.0 s sonra oxunur, marşrut onunla paralel bitir. Spesifikasiyanın "1.6–2.4 s"-i belə oxunub: ayrı-ayrı aralıqların (900–1800 + 1200–2000) cəmi bu həddi aşır, ona görə marşrut mətni gözlətmir.
Animasiya bitmədən "növbəti" basılanda cari animasiya dərhal sona çatır, növbəti başlayır. `prefers-reduced-motion`-da kamera tullanır, marşrut birdən çəkilir, mətn 150 ms-lik fade ilə gəlir.

**İdarəetmə:** `←` `→` (və PageUp/PageDown pultu), `Space` avtomatik oynatma (düymə və linkin üstündə deyilsə), `Esc` paneli bağlayır (telefonda sheet-i yığır), `M` səs. Radio qrupunun içində oxlar rejimi dəyişir, addımı yox. Telefonda xəritənin üstündə sürüşdürmə ilə keçid. URL: `step`, `mode`, `legends` (`history.replaceState(null, …)`, Next `useSearchParams`-ı sinxronlaşdırır).

**Qərarlar və qeydlər:**
- Statik HTML-də qabığın yalnız çərçivəsi var (`ShellFallback`): qabıq `?step=`-i brauzerdə oxuyur, ona görə dərin linkdə ilk addım bir anlıq görünmür.
- Mərhələ 3-də xəritə MapLibre deyil, SVG-dir: xoreoqrafiya xəritə kitabxanasından asılı olmasın deyə müvəqqəti adapter kimi plan edilmişdi. Sərhəd snapshot-ları, relyef və şəhər ikonları mərhələ 4-dədir.
- Şəxsiyyət kartları hələ köhnə `/persons/<id>/`-ə aparır. Yeni route-a keçid (və köhnənin yönləndirməsi) final, quiz və pasportla birlikdə mərhələ 5-də olacaq.
- Yaş portretinin faylı yoxdursa, şəxsiyyətin öz portreti göstərilir. "Rəssam təsəvvürü (AI illüstrasiya)" yazısı yalnız AI şəkli göstəriləndə çıxır.
- Səs düyməsi `tarix:settings.muted`-i dəyişir, səs mühərrikinin qoşulması mərhələ 12-dədir.
- `Ətraflı` bölməsi (qlossari, "Bu zaman dünyada", nəql, ilkin mənbə; Q6) mərhələ 5-də əlavə olunacaq.

### Mərhələ 4: xəritə

**Quruluş:**
- `src/theme/mapPalettes.ts`: dövr variantlarının (`manuscript`, `miniature`, `military`, `modern`) xəritə rəngləri, `--map-*` tokenlərindən törədilib. MapLibre CSS dəyişəni oxumadığı üçün konkret rəngdir.
- `src/features/map-gl/style.ts`: öz stilimiz. Perqament zəmin, Natural Earth relyefi, hillshade, su və çaylar (OpenFreeMap). Müasir sərhəd, yol və ad yoxdur. `applyVariant` addım başqa dövrə keçəndə rəngləri 750 ms-də dəyişir.
- `territories.ts`: iki qat yığını, snapshot-lar arasında 600 ms crossfade, təxmini sərhəd (yumşaq rəng zolağı + qırıq xətt), `feature-state` ilə hover konturu, dövlət adları HTML-dir (Azərbaycan hərfləri tətbiqin şrifti ilə).
- `markers.ts`: kataloq məkanları (miniatür ikonlar, ilə görə ad, hover-də müasir ad, importance + zoom ilə görünmə, paytaxtlar snapshot-dan), hekayənin çatdığı məkanlar, pulsasiya edən cari marker, marşrutu izləyən marker.
- `MapLibreMap.tsx`: `MapController`-in MapLibre reallaşdırması. Marşrut `line-gradient` + `lineMetrics` ilə, irəliləyiş rAF ilə, keçilmiş marşrutlar solğun qırıq iz kimi qalır. Kamera `flyTo` (curve 1.4, spesifikasiyanın easing-i), panel və sheet üçün padding.
- `simulation-shell/map/ShellMap.tsx`: renderer seçimi. WebGL varsa MapLibre (`next/dynamic`, yalnız simulyasiya route-larında yüklənir), yoxdursa və ya xəritə başlaya bilməsə SVG xəritə. Xoreoqrafiyanın son istəklərini yadda saxlayır və xəritə hazır olanda təkrar oynadır.
- `ShellStep`-ə `snapshotId`, `mapVariant`; `ShellData`-ya `landmarks`, `capitals` əlavə olundu.

**Ölçmə:** route çəkilən keçid zamanı bu maşında (Playwright desktop, GPU bayraqları ilə) orta 51–56 fps, p95 kadr 16.8–33 ms (3 ölçüm, tək işləyəndə). Paralel e2e yükü altında 41 fps-ə düşür. Test həddi 20 fps-dir (proqram təminatlı WebGL üçün), rəqəm test çıxışında yazılır.

**Qərarlar və qeydlər:**
- **`maplibre-gl` birbaşa, `react-map-gl` olmadan** (spesifikasiyadan fərq, təsdiq gözləyir). Xəritə yalnız `MapController` vasitəsilə imperativ idarə olunur və hər kadr yeniləməsi React-dan kənardadır. `react-map-gl` burada əlavə asılılıqdan başqa bir şey vermir. Deklarativ qatlar lazım olsa (zaman şkalası, mərhələ 6), oraya əlavə etmək olar.
- **Poliqon morph-u (flubber) istifadə olunmur**, yalnız crossfade var. Snapshot-lar region birləşmələridir, eyni dövlətin iki snapshot-da topologiyası və nöqtə sayı fərqlidir. Morph hər kadrda onlarla poliqonu yenidən hesablamaq deməkdir, zəif məktəb kompüterində 50 fps hədəfi ilə uyğun deyil.
- Kataloq məkanlarının ikonları köhnə miniatür ikon dəstidir (`features/map/icons.ts`), xəritə üçün çəkilib və perqamentdə yaxşı oxunur.
- MapLibre marker elementinə inline `opacity` yazır, ona görə hər markerin bir host elementi var, görünmə daxili elementdə idarə olunur.
- Atribusiya (Natural Earth, Terrain Tiles, OpenFreeMap, OSM) sol aşağı küncdədir, lisenziya tələbidir.
- Dövlətə klik (hökmdar paneli) mərhələ 6-da, döyüş oxları mərhələ 11-də (`battle`), azad olunan məntəqələr mərhələ 9-da (`liberation`) gəlir. Label declutter yoxdur, görünmə importance və zoom ilə idarə olunur.
