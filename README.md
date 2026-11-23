# Tarixin İçində

Azərbaycan tarixi şəxsiyyətlərinin həyatını interaktiv şəkildə yaşamaq üçün veb tətbiq.
İstifadəçi şəxsiyyət seçir və onun həyatını doğumdan ölümə qədər mərhələ-mərhələ keçir.
Hər mərhələ xəritədə göstərilir. Yerdəyişmələr animasiyalı marşrutla çəkilir, döyüşlər, seçim anları və yekun sınaq var.

Xəritə həmin ilin siyasi vəziyyətini göstərir (18 snapshot, 1440–2020). Dövlətlər, paytaxtlar və dövrə uyğun toponimlər var.
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
| `npm run schema:export` | Zod modelindən `shared/schema/` (JSON Schema, backend ilə paylaşılır) yaradır. `src/domain/schema.ts` dəyişəndən sonra işlədin; `npm test` uyğunsuzluğu tutur |
| `npm run build:territories` | Siyasi xəritə snapshot-larını `public/data/territories/`-a yığır (`dev` və `build`-dan əvvəl avtomatik işləyir) |
| `npm run generate:audio` | Placeholder musiqi və səsləri yenidən sintez edir (`public/audio/`, bax `docs/AUDIO_CREDITS.md`) |
| `npm test` | Unit testlər (`tests/unit`, node) və komponent testləri (`tests/component`, jsdom + Testing Library), Vitest |
| `npm run test:e2e` | Playwright: hər şəxsiyyət başdan sona; desktop, planşet və mobil. Əvvəlcə `npm run build` lazımdır. İlk dəfə `npx playwright install chromium` |
| `npm run lint`, `npm run typecheck` | ESLint və TypeScript. ESLint komponentlərdə hex rəngi qadağan edir (dizayn tokenləri, bax `docs/FRONTEND_PLAN.md`) |
| `npm run storybook` | Komponent kataloqu (http://localhost:6006). Alət panelində dövr teması və yüngül rejim seçilir |
| `npm run build-storybook` | Storybook-u `storybook-static/`-a statik build edir |
| `npm run stories:shots -- <qovluq> [--axe] [story-id@tema …]` | Story-lərin ekran görüntüləri (mərhələ hesabatları üçün). `--axe` WCAG 2.2 AA yoxlaması da aparır |
| `npm run pages:shots -- <qovluq> [--axe] [--mobile] /az/ …` | Build olunmuş səhifələrin ekran görüntüləri (1440 və 390 px), `--axe` ilə. Git Bash-də `MSYS_NO_PATHCONV=1` lazımdır |
| `npm run build:api` | Saytı backend-in dərc olunmuş məzmunundan build edir: eksportu `.content/`-ə çəkir (`CONTENT_URL` və ya `CONTENT_DIR`), sonra `next build`. `NEXT_PUBLIC_DATA_SOURCE=api` ilə işlədin (aşağıya bax) |
| `npm run content:pull` | Yalnız eksportu çəkir (`build:api`-nin birinci addımı) |
| `npm run api:types` | `shared/openapi/public.json`-dan (backend testləri yazır) `src/data/api/openapi.ts` tiplərini generasiya edir |

## Deploy (GitHub Pages)

`.github/workflows/deploy.yml` hər `main` push-unda testləri işə salır, saytı build edir və GitHub Pages-ə yerləşdirir.
Bunun üçün bir dəfəlik ayar lazımdır: repo **Settings → Pages → Build and deployment → Source: GitHub Actions**.
Sayt `https://<istifadəçi>.github.io/<repo>/` ünvanında açılır. Alt-yol `NEXT_PUBLIC_BASE_PATH` ilə avtomatik verilir.

Başqa statik hostinqdə (Netlify, Vercel, Cloudflare Pages) `out/` qovluğunu yerləşdirmək kifayətdir.
Sayt kökdə deyilsə, build zamanı `NEXT_PUBLIC_BASE_PATH=/alt-yol` verilməlidir.

> **Windows qeydi:** Next.js 16.4 Windows-da statik export edəndə iç-içə route-ların prefetch fayllarını səhv adla yazır
> (yolda `\` işarəsinin nöqtəyə çevrilmədiyi üçün). Bu halda brauzer konsolunda `__next.*.txt` üçün 404 görünür və keçidlər
> adi səhifə yüklənməsi ilə işləyir. Linux-da (GitHub Actions) build edəndə bu problem yoxdur.

## Backend

`backend/` qovluğunda Spring Boot 4.1 (Java 25) modular monoliti var (Spring Modulith, 10 modul). O, bunları edir:
- məzmunun redaksiyası: draft → rəy → dərc, versiyalar, sahə səviyyəsində şərhlər;
- ictimai oxuma API-si və PostGIS sorğuları: xəritə, zaman sürgüsü, müqayisə, axtarış;
- media reyestri və lisenziya qaydaları;
- anonim öyrənmə analitikası;
- saytın build olunduğu statik eksport.

Sayt backend-siz də işləyir: defolt olaraq `data/`-dan build olunur. Backend qoşulanda isə onun dərc etdiyi məzmundan build olunur.

| Sənəd | Nə var |
|---|---|
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | modullar, ER modeli, hər mərhələnin təfsilatı; §20: mühit dəyişənləri, planlı işlər, API xəritəsi; §21: açıq məsələlər; §22: önizləmə, təyinat, ad dəyişmə |
| [`docs/adr/`](docs/adr/README.md) | memarlıq qərarları (21 ADR), spesifikasiyadan fərqlər |
| [`docs/modules/`](docs/modules/) | modul diaqramları (Spring Modulith `Documenter`, testlər yaradır) |
| [`docs/BACKEND_SPEC.md`](docs/BACKEND_SPEC.md) | ilkin spesifikasiya |
| [`shared/schema/`](shared/schema/README.md), `shared/openapi/` | frontend və backend arasında paylaşılan JSON Schema və ictimai OpenAPI |

**Bütün sistemi Docker ilə qaldırmaq** (yalnız Docker lazımdır):

```bash
cp docker/.env.example docker/.env        # parolları, JWT_SECRET (openssl rand -base64 48) və ADMIN_* doldurun
docker compose -f docker/docker-compose.yml up --build --wait
curl http://localhost:8080/actuator/health  # {"status":"UP",...}
```

Servislər: `db` (PostgreSQL 18 + PostGIS 3.7, `127.0.0.1:${DB_PORT}`), `s3` (SeaweedFS, S3 API `127.0.0.1:8333`;
`media` və `public-content` bucket-lərini `s3-init` yaradır; `media` anonim oxunur), `backend` (`127.0.0.1:${BACKEND_PORT}`).
5432 portu məşğuldursa, `docker/.env`-də `DB_PORT`-u dəyişin. Dayandırmaq: `docker compose -f docker/docker-compose.yml down`
(`-v` əlavə etsəniz, data da silinir).

**Backend-i lokalda build və test etmək** (JDK 25 və işləyən Docker lazımdır; testlər PostGIS-i və SeaweedFS-i Testcontainers ilə qaldırır):

```bash
cd backend
./mvnw verify          # Windows: mvnw.cmd verify
```

Giriş: `POST /api/v1/auth/login` (`{"email", "password"}`) access və refresh token qaytarır; access token `Authorization: Bearer …` başlığında göndərilir. İlk ADMIN hesabı `ADMIN_EMAIL`/`ADMIN_PASSWORD`-dən yaradılır.

**Mövcud `data/`-nı idxal etmək** (ADMIN; təkrar işlətmək təhlükəsizdir, dəyişməyən heç nə yazılmır):

```bash
TOKEN=$(curl -s localhost:8080/api/v1/auth/login -H 'Content-Type: application/json'   -d '{"email":"…","password":"…"}' | jq -r .accessToken)
curl -s -X POST "localhost:8080/api/v1/admin/import?dryRun=true" -H "Authorization: Bearer $TOKEN" | jq '.outcomes, .drafts'
curl -s -X POST  localhost:8080/api/v1/admin/import             -H "Authorization: Bearer $TOKEN" | jq '.published, .drafts'
```

Xətasız sənədlər birbaşa dərc olunur, xətalılar draft qalır (hesabatda `results[].errors`); sonra proyeksiya bir dəfə yenidən qurulur.
Docker-də `data/` və `public/data/territories` konteynerə yalnız oxumaq üçün qoşulur ([ADR-0013](docs/adr/0013-data-import.md)).

**İctimai API** (yalnız `GET`, autentifikasiyasız; `ETag` ilə `304`, dil `?lang=az|en|ru|all` və ya `Accept-Language`):

```bash
curl -s "localhost:8080/api/v1/persons/shah-ismayil/steps?lang=en" | jq '.steps[0]'
```

Bütün endpoint-lər: `/swagger-ui.html` (OpenAPI: `/v3/api-docs/public`), ətraflı: [ARCHITECTURE.md §13](docs/ARCHITECTURE.md), [ADR-0014](docs/adr/0014-public-read-api.md).

`verify` həm də modul diaqramlarını `docs/modules/`-a, ictimai OpenAPI təsvirini `shared/openapi/public.json`-a yenidən yazır;
dəyişibsə, commit edin və `npm run api:types` işlədin (CI bunu yoxlayır).

**Saytı backend-in məzmunundan build etmək** ([ADR-0020](docs/adr/0020-frontend-integration.md)). Backend dərcdən sonra statik eksportu
`public-content` bucket-inə yazır ([ADR-0019](docs/adr/0019-static-export.md)); sayt ondan, `data/` formatında build olunur, UI dəyişmir:

```bash
NEXT_PUBLIC_DATA_SOURCE=api CONTENT_URL=http://localhost:8333/public-content npm run build:api
```

Backend-in anonim öyrənmə analitikası ([ADR-0018](docs/adr/0018-analytics.md)) üçün build zamanı `NEXT_PUBLIC_ANALYTICS_URL=https://…/api/v1/events`
verin. Verilməyibsə, sayt heç bir event göndərmir. Brauzer DNT və ya GPC siqnalı göndərirsə, yenə göndərmir. Müəllim sinfin
linkini `?class=KOD` ilə paylaşa bilər; həmin tab-ın event-ləri sinfin hesabatına düşür.


## Arxitektura

```
data/                    bütün kontent, kodda heç bir şəxsiyyət yoxdur
  eras/<id>.json         dövrlər
  themes/<id>.json       dövr temaları (rəng, şrift, faktura, ornament)
  commemorations.json    xüsusi günlər ("Tarixdə bu gün")
  persons/<id>/          person.json + events.json
  relations.json         şəxsiyyətlər arası əlaqələr (qohumluq, varislik)
  planned.json           elan olunmuş, hələ qurulmamış simulyasiyalar ("tezliklə" kartları və passiv keçidlər)
  glossary.json          qlossari: termin, izah, şəkilçiləri nəzərə alan söz kökləri
  places.json            şəhər, qala, ziyarətgah, liman, döyüş meydanı kataloqu
  world-events.json      "Bu zaman dünyada" hadisələri
  territories/           siyasi xəritə: registry.json (regionlar), snapshots/, land.json (bax territories/README.md)
  polities/<id>.json     dövlətlər: ad, rəng, mövcud olduğu illər, dövrlər üzrə vəziyyət (facts), stateId
  rulers.json            hökmdarlar: ad, titul, sülalə, doğum və ölüm, portret, personId
  reigns.json            hakimiyyət cədvəli: { polityId, rulerId, start, end, certainty }
  states/<id>/           dövlət simulyasiyası: state.json + steps.json (mərhələlər)
  conflicts/<id>/        müharibə: conflict.json, days.json, settlements.json, heroes.json, commanders.json,
                         soundtrack.json, battles/*.json
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
  features/…             conflicts, states, places, timeline, home, claims, theme, engine
  lib/analytics/         anonim öyrənmə event-ləri (backend-ə, istəyə bağlı)
scripts/                 validate-data, export-json-schema, pull-content, build-territories, parity-history-queries…
tests/unit, tests/e2e
shared/schema/           Zod-dan çıxarılan JSON Schema (backend eyni qaydalarla yoxlayır)
shared/openapi/          backend-in ictimai API təsviri (frontend tipləri buradan)
backend/                 Spring Boot modular monolit: az.tarix.platform.{shared, identity, editorial, publishing,
                         catalog, geo, chronology, theming, media, analytics}
docker/                  docker-compose.yml (PostGIS, SeaweedFS, backend) + .env.example
docs/                    ARCHITECTURE.md, adr/, modules/, BACKEND_SPEC.md, mənbə və lisenziya qeydləri
```

**Data qatı.** UI yalnız `HistoryRepository` interfeysindən (`src/data/repository.ts`) asılıdır.
`FileSystemRepository` build zamanı məzmun qovluğunu oxuyur və `data/persons/*` qovluqlarını özü tapır.
Qovluğu `src/data/index.ts` seçir: defolt `data/`, `NEXT_PUBLIC_DATA_SOURCE=api` ilə isə backend-in eksportu (`.content/`).
Eksport `data/` ilə eyni formatdadır, ona görə ikinci repository implementasiyası lazım olmadı ([ADR-0020](docs/adr/0020-frontend-integration.md)).

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
**Hazırkı səslər sintez olunmuş placeholder-lərdir** və real CC0 yazılarla əvəz edilməlidir (`docs/AUDIO_CREDITS.md`).

**Yüngül rejim.** Zəif kompüterlər üçün relyef kölgəsi, marşrut və sərhəd animasiyaları, rəng qatının blend effekti və mühit səsləri söndürülür,
xəritə 1x piksel sıxlığında çəkilir. Cihaz zəif görünəndə (≤2 nüvə və ya ≤2 GB yaddaş) avtomatik açılır, ayarlardan dəyişdirilə bilər.

**Müəllim rejimi.** Proyektor üçün bütün UI 125% böyüyür. Mərhələləri müəllim ← → və ya təqdimat pultunun PageUp/PageDown düymələri ilə idarə edir.
Yekun sınaqda sinif birlikdə variant seçir, müəllim "Cavabı göstər" düyməsi ilə cavabı açır.

**Animasiya.** Kamera `flyTo` / `fitBounds` ilə hərəkət edir. Marşrut `requestAnimationFrame` ilə tədricən çəkilir və
üzərində hərəkət edən bayraq markeri olur. Hər yeni addım əvvəlki animasiyanı ləğv edir. `prefers-reduced-motion` aktiv olanda
keçidlər ani olur. Real GPU-da (Intel Iris Xe) marşrut animasiyası 60 fps göstərib, p95 kadr vaxtı 16.7 ms.

## Kateqoriyalar və simulyasiya mühərriki

| Route | Səhifə |
|---|---|
> **Yeni dizayn** (`docs/FRONTEND_SPEC.md`, [ADR-0022](docs/adr/0022-frontend-redesign.md)) mərhələ-mərhələ qurulur.
> Yeni route-lar köhnələrin yanındadır. Ekran yeni dizaynda hazır olanda köhnə route yönləndirməyə çevrilir. Vəziyyət: `docs/FRONTEND_PLAN.md` §15.

| Route | Səhifə |
|---|---|
| `/az/` | Ana səhifə (yeni dizayn) |
| `/az/sexsiyyetler/`, `/az/doyusler/`, `/az/dovletler/`, `/az/mekanlar/` | Kolleksiyalar (yeni dizayn). Köhnə `/persons/`, `/conflicts/`, `/states/`, `/places/` siyahıları bura yönləndirir |
| `/az/kurikulum/`, `/az/kurikulum/<sinif>/` | Dərsliklə öyrən (kurikulum datası hələ yoxdur, boş vəziyyət) |
| `/az/sexsiyyetler/<id>/` | Şəxsiyyət simulyasiyası yeni `SimulationShell`-də (`?step=`, `?mode=story|learn`, `?legends=0`). Xəritə hələlik sxematik SVG-dir, MapLibre mərhələ 4-də |
| `/az/sexsiyyetler/<id>/final/`, `/az/doyusler/<id>/`, `…/gun/`, `/az/dovletler/<id>/`, `/az/mekanlar/<id>/`, `/az/zaman/`, `/az/muqayise/`, `/az/pasport/`, `/az/muellim/` | Yeni dizaynın skeletləri: ekran öz mərhələsində qurulur, o vaxta qədər köhnə səhifəyə keçid verir |
| `/az/persons/<id>/` | Şəxsiyyət simulyasiyası (köhnə UI) |
| `/az/conflicts/<id>/` | "Şanlı Zəfər tariximiz": 44 günlük Vətən müharibəsi (köhnə UI) |
| `/az/states/<id>/` | Dövlət simulyasiyası, ilk olaraq Əfşarlar (köhnə UI) |
| `/az/person/<id>/` | Köhnə ünvan, `?step=` saxlanmaqla `/persons/<id>/`-ə yönləndirir |

Bütün kateqoriyalar eyni mühərriki işlədir: `src/features/engine/SimulationEngine.tsx`.
Mühərrik xəritəni, timeline-ı, mood və səsi, start ekranını, proqresi, dərin linkləri və geri qayıdışı idarə edir.
Step-in nə olduğunu (həyat hadisəsi, müharibə günü, dövlət mərhələsi) kateqoriya adapteri təyin edir:
HUD sayğacları (`counters`), step paneli (`renderStep`) və final paneli (`renderFinal`).
Hər step `EngineStep` sahələrinə malikdir (`src/features/engine/types.ts`): `id`, `year`, `title`, `mood`, `location`, `zoom`,
`route`, `snapshotId`, `battle`, `related`. Şəxsiyyətlər üçün adapter `src/features/simulation/PersonSimulation.tsx`-dir.

### Çarpaz keçidlər (`EntityRef`)

`{ type: person | conflict | battle | state | place | ruler, id, stepId?, note?, label? }`. Hadisələrin `related[]` sahəsində saxlanır.

- `src/domain/registry.ts` build zamanı bütün obyektlərin indeksini qurur: şəxsiyyətlər (mərhələləri ilə), məkanlar və `planned.json`.
- **Obyekt mövcuddursa**, keçid aktiv chip və ya kart olur (`/az/persons/<id>/?step=<stepId>`).
- **Mövcud deyilsə və ya yalnız planlaşdırılıbsa**, chip passiv "tezliklə" kimi göstərilir. Referans datada qalır və obyekt əlavə olunanda keçid avtomatik açılır.
- `note` olan referans "Tarixi kəsişmə" kartı kimi, `note`-suz referans chip kimi göstərilir. Başqa şəxsiyyətə keçid xəritədə portret medalyonu və timeline-da qızılı nöqtə verir.
- Şəxsiyyətin döyüş hadisəsi `{ type: "battle", id: "chaldiran-1514" }` kimi döyüşə istinad edir. Döyüş əlavə olunanda keçid aktivləşəcək.

**Geri qayıdış.** Keçiddən əvvəl cari səhifə və mərhələ `sessionStorage`-da stack-ə yazılır (`src/features/engine/navStack.ts`).
Hədəf simulyasiyada "← Şah İsmayıl Xətai · Çaldıran döyüşü (1514)" düyməsi görünür və əvvəlki mərhələyə qaytarır.
Tətbiq daxilində keçidlə gələndə səs artıq açıq olduğundan start ekranı buraxılır və hekayə birbaşa həmin mərhələdə açılır.

**Validasiya.** `npm run validate:data` hər referansı eyni registry ilə yoxlayır:
- mövcud olmayan obyekt **xəbərdarlıqdır** və hədəfə görə qruplaşdırılaraq göstərilir;
- mövcud obyektdə olmayan `stepId` və ya adı (`label`) olmayan sınıq referans **xətadır**.

## "Şanlı Zəfər tariximiz": 44 günlük Vətən müharibəsi

`/az/conflicts/karabakh-war-2020/`: 27 sentyabr – 10 noyabr 2020 günlər üzrə, sonra Ağdam, Kəlbəcər və Laçının qaytarılması (epiloq).

- **Mənbələr:** hadisələr AZƏRTAC-ın gündəlik "Vətən müharibəsinin xronikası" seriyasına, Prezidentin müraciətlərinə (Report.az-da tam mətn)
  və Müdafiə Nazirliyinin açıqlamalarına əsaslanır. Hər günün mənbəsi panelda göstərilir.
- **`WarDay`:** `{ id, order, date, dayNumber?, kind: operation | liberation | memorial | statement | epilogue, title, summary, mood, location, zoom?,
  liberated[], extraLiberated?, commanders[], fallenHeroes[], officialStatement?, related[], sources[], quiz? }`.
- **Xəritə:** dövlətlər beynəlxalq səviyyədə tanınmış sərhədlərlə (Natural Earth). Rəsmi açıqlamalarda adı çəkilən hər yaşayış məntəqəsi azad olunduğu günə
  qədər boz, sonra bayraq rənglərində göstərilir; həmin günün məntəqələri "dalğa" animasiyası və adları ilə vurğulanır. **Cəbhə xətti çəkilmir**,
  çünki etibarlı açıq data yoxdur. Koordinatlar OpenStreetMap-dəndir (ODbL); 250 məntəqədən etibarlı koordinatı tapılmayan 28-i yalnız siyahıda göstərilir.
- **Sayğaclar:** "Müharibənin N-ci günü" və rəsmi açıqlamalarda adı çəkilən (və ya sayı verilən) azad olunmuş yaşayış məntəqələrinin cəmi.
- **Xatirə günləri:** Tərtər, Gəncə və Bərdə üçün sakit ton, qərənfil motivi, şam işığı, səs effekti yoxdur, musiqi balaban ağısına keçir.
- **Şuşa (8 noyabr):** ayrıca təntənəli səhnə: dalğalanan bayraq, qələbə fanfarı və "triumph" musiqi qatı.
- **Giriş:** qaranlıq fonda bayrağın zolaqları açılır, aypara və səkkizguşəli ulduz görünür, sonra "27 sentyabr 2020" tarixi.
- **Qəhrəmanlar:** 9 dekabr 2020-ci il sərəncamı ilə "Vətən Müharibəsi Qəhrəmanı" adı verilən 82 hərbi qulluqçu (ad, rütbə, "ölümündən sonra").
  Rəsmi mənbələr ölüm tarixlərini vermədiyi üçün qəhrəmanlar günlərə bağlanmır, ayrıca xatirə bölməsində göstərilir.
  Foto yoxdur: `photo` sahəsi yalnız rəsmi, icazəli şəkil üçündür, müasir real şəxslər üçün AI şəkli yaradılmır. Hazırda hörmətli siluet göstərilir.
- **Sərkərdələr:** yalnız AZƏRTAC xronikasında adı çəkilən komandanlar, 2020-ci il vəzifələri ilə.
- **Musiqi:** bölmənin öz orijinal musiqisi var: əməliyyat günlərində marş, azadetmə günlərində himn, Şuşada himn + "triumph", xatirə günlərində ağı
  (`SimulationEngine`-in `soundFor` propu). `soundtrack.json` icazə statusunu saxlayır; "Vətən yaxşıdır" və "Bayatı-Şiraz" `pending`-dir və build-ə düşmür (bax `docs/AUDIO_CREDITS.md`).
- **Döyüşlər:** `battles/shusha-2020.json` (Şuşa əməliyyatı) registry-də müharibənin 8 noyabr gününə aparan link kimi qeyd olunur.

## Yaşa görə portretlər

`person.json`-da `portraits: [{ ageFrom, ageTo, kind: historical | artwork | ai_illustration, src?, alt, source?, sourceUrl?, license?, author?, promptId? }]`.
Simulyasiyada portret kartı hadisənin yaşına uyğun şəkli göstərir və dövr dəyişəndə crossfade ilə keçir. `src` yoxdursa, siluet göstərilir.
AI illüstrasiyalarının altında həmişə "Rəssam təsəvvürü (AI illüstrasiya)" yazılır. Belə şəkillər yalnız tarixi şəxsiyyətlər üçün qəbul olunur, 1850-dən sonra doğulanlar üçün validator AI şəklini rədd edir.
Promptlar: `docs/portrait-prompts.md`.

## Dövlət simulyasiyası

`/az/states/afshar/`: Əfşarlar dövləti 1722-dən 1796-ya qədər 15 mərhələdə. Səfəvi böhranı, Nadirin yüksəlişi, Muğan qurultayı,
yürüşlər, zirvə, parçalanma, Azərbaycan xanlıqlarının yaranması və Əfşarların sonu.

- **`State`**: `{ id, polityId, name, years, description, legacy, image?, eraIds, dynasty?, sources }`. `dynasty` sülalə zolağına düşən dövlətləri sıralayır (Səfəvilər → Əfşarlar).
- **`StateStep`**: `{ id, order, date, title, summary, mood, location, zoom?, territorySnapshotId?, capitalId?, polityId?, events[], keyFacts?, related[], sources[], quiz? }`.
  `keyFacts` (ərazi, əhali, ordu, iqtisadiyyat, din, dil) yalnız mənbəsi olanda yazılır, rəqəmlər diapazonla verilir.
- **Xəritə:** dövlətin sərhədi qalın xətlə vurğulanır, snapshot-lar arasında sərhədlər crossfade ilə dəyişir, mərhələnin paytaxtı qızılı halə ilə göstərilir.
- **Sülalə zolağı:** timeline-ın altında hökmdarlar real il şkalası üzrə çəkilir və cari il işarələnir. Zolaq `reigns.json`-dan qurulur.
- **Keçidlər:** Nadir Şahın həyatındakı mərhələlər (Təhmasibin xidməti, Muğan, Karnal, ölüm) dövlət mərhələlərinə, dövlət mərhələləri isə geri Nadirə aparır.

1747-dən sonrakı xəritələr üçün (1750, 1760, 1796) Azərbaycan regionları xanlıqlara bölündü. Köhnə snapshot-ların pozulmaması üçün
`registry.json`-da `groups` var: məsələn `azerbaijan` = Təbriz + Xoy + Urmiya + Marağa + Qaradağ regionları.

## Hökmdar paneli

Xəritədə dövlətin üzərinə gələndə sərhədi vurğulanır və adı görünür. Klikləyəndə (və ya xəritə açarında dövlətin adına basanda) panel açılır.
Panel həmişə **cari mərhələnin ilini** təsvir edir:

- **Hökmdar** `reigns.json`-dan ilə görə avtomatik tapılır, hadisələrə əl ilə yazılmır. Hakimiyyət bölünübsə (məs. 1501-də Əlvənd və Murad), hər iki hökmdar göstərilir. Hökmdarın şəxsiyyət simulyasiyası varsa, "Hekayəsinə keç" linki görünür.
- **Paytaxt** xəritə snapshot-undan, **ərazi** isə xəritədəki təxmini poliqondan hesablanır və "xəritəyə görə təxmini" kimi yazılır.
- **Vəziyyət, din, dil, rəqiblər və müttəfiqlər** `polities/<id>.json`-un `facts` dövrlərindən gəlir.
- **Hekayə ilə əlaqə:** döyüşdə tərəfdirsə ("Bu mərhələdə rəqib tərəfdir"), hadisənin `related` qeydi və ya cari şəxsiyyət bu dövlətin hökmdarıdırsa ("Bu dövlətin hökmdarı sənsən").
- **"Bu dövlətin simulyasiyasına keç"** düyməsi `stateId` olan dövlətlər üçün görünür, simulyasiya hələ yoxdursa passivdir.
- Data olmayan dövlət üçün "Məlumat tezliklə əlavə olunacaq" yazılır.

Səhifəyə yalnız simulyasiyanın illərinə (±10 il) aid dövlətlər, hökmdarlar və hakimiyyət dövrləri düşür (`src/data/political.ts`).
Validasiya hakimiyyət dövrünün dövlətin mövcud olduğu illərə uyğun gəldiyini, `personId`-ni və rəqib/müttəfiq id-lərini yoxlayır.

## Yeni şəxsiyyət əlavə etmək

1. `data/persons/<id>/` qovluğunu yaradın. `<id>` kebab-case olmalı və `person.json`-dakı `id` ilə eyni olmalıdır.
2. `person.json` yazın (aşağıdakı sxemə baxın). Portret varsa, `public/portraits/`-a qoyun və lisenziyanı göstərin.
3. `events.json` yazın: `{ "events": [ ... ] }`. İlk hadisə `birth`, sonuncu `death` olmalıdır.
4. `npm run validate:data` işə salın.
5. Mənbələri və mübahisəli məqamları `docs/RESEARCH_NOTES.md`-yə əlavə edin.

Kodda heç nə dəyişmir. Giriş ekranı, səhifə, e2e testlər yeni qovluğu avtomatik götürür.

## Yeni dövr əlavə etmək

`data/eras/<id>.json` faylı yaradın (fayl adı `id` ilə eyni olmalıdır) və şəxsiyyətlərin `eraIds` siyahısına əlavə edin.
Giriş ekranındakı dövr filtri onu avtomatik göstərir. Dövrün `themeId` sahəsi onun temasını göstərir (aşağıya bax).

## Qlobal zaman sürgüsü (`/timeline/` və ana səhifə)

İl sürgüsü 1400–2020 aralığını əhatə edir. Paylaşmaq üçün `/timeline/?year=1514` linkindən istifadə olunur. İl dəyişəndə bunlar yenilənir:
- ən yaxın ərazi snapshot-u (sərhədlər crossfade ilə dəyişir) və paytaxtlar (★);
- həmin il hökm sürənlər (`Reign` cədvəlindən);
- həmin il yaşayan şəxsiyyətlər, portret, yaş və o vaxtkı yeri ilə;
- bütün kateqoriyalardan həmin ilin hadisələri.

Ölkəyə və ya hökmdara klik etdikdə hökmdar paneli seçilmiş il üçün açılır.
Snapshot 30 ildən köhnədirsə, xəritə solğun göstərilir və "Bu dövr üçün məzmun hazırlanır" kartında ən yaxın illərə keçid düymələri olur.
Sürgünün altındakı rəngli zolaqlar dövrləri göstərir, zolağa klik etdikdə həmin dövrün əvvəlinə keçid olur.

Performans: il rəqəmi və sürgü dərhal, siyahılar `useDeferredValue` ilə yenilənir. Sərhədlər 140 ms, tema isə 320 ms sakitlikdən sonra dəyişir.
Sürükləmə zamanı kadr intervalı ölçülüb: median və p95 təxminən 16.7 ms. Ana səhifədəki kompakt versiya yalnız öz qutusunu dövrün rənginə boyayır.

## "Tarixdə bu gün" (ana səhifə)

Blok ziyarətçinin bugünkü tarixini brauzerdə oxuyur, statik HTML-də isə placeholder göstərilir. Sonra ortaq indeksdən həmin gün və ayda baş verən mərhələləri tapır.
Yalnız gün dəqiqliyi olan mərhələlər götürülür. Belə mərhələ yoxdursa, "Bu ay tarixdə" göstərilir. Hər mərhələdən simulyasiyaya dərin keçid var.
Xüsusi günlərin (27 Sentyabr Anım Günü, 8 Noyabr Zəfər Günü) öz dizaynı var. Onlar `data/commemorations.json`-dadır və mənbə ilə gəlir.
Önizləmə üçün `/az/?today=09-27` linkindən istifadə etmək olar (müəllimlər və testlər üçün).

## Məkan səhifələri (`/places/<id>/`)

Hər məkan üçün səhifə `data/places.json`-dan avtomatik yaranır. Səhifə ortaq hadisə indeksindən (`getHistoryIndex()`, `src/lib/historyIndex.ts`)
həmin məkanda baş verən bütün mərhələləri (şəxsiyyət, döyüş, dövlət) xronoloji sıra ilə göstərir. Hər mərhələdən simulyasiyaya dərin keçid var.

- **Hansı dövlətin tərkibində olub:** build zamanı ərazi snapshot-larında point-in-polygon ilə hesablanır (`src/lib/placeHistory.ts`).
  Bir snapshot ən çox 30 il "əhatə edir". Daha uzun boşluqlar "Bu dövr üçün məzmun hazırlanır" kimi göstərilir, məkan isə yalnız mövcud olduğu illərdə göstərilir.
- **Uyğunlaşdırma:** şəxsiyyət və dövlət mərhələləri 30 km radiusla məkana bağlanır. Müharibə günləri isə yalnız ad və ya `placeId` ilə bağlanır,
  çünki cəbhə nöqtələri bir-birinə çox yaxındır.
- **Tema:** hər mərhələ öz dövrünün rəngindədir (`.theme-scope`). Səhifənin teması ekranın ortasındakı mərhələyə uyğun dəyişir.
- **Tezliklə:** `Place.upcoming` hələ simulyasiyası olmayan fəsilləri göstərir (məs. Şuşa üçün Qarabağ xanlığı).
- Xəritədə şəhər kartında "Bu şəhərin tarixi" düyməsi var.

## Müqayisə (`/compare/?a=…&b=…`)

İki simulyasiyanı (şəxsiyyət, dövlət və ya müharibə) bir zaman oxunda və bir xəritədə yan-yana göstərir.
Parametrlər `type:slug` formasındadır (`?a=person:nadir-shah&b=state:afshar`); sadə slug şəxsiyyət sayılır.
Parametr verilməyibsə, defolt cüt Uzun Həsən ilə Şah İsmayıldır.
Seçicilər bütün simulyasiyaları build zamanı `loadCompareData` (`src/data/compare.ts`) ilə yığır, ona görə yeni simulyasiya (məs. Sultan Səlim) kodsuz əlavə olunur.

- **Görüş** (qızılı rəng, zolaqları birləşdirən xətt): eyni ildə eyni məkan və ya bir-birindən ≤ 25 km məsafə, ya da eyni döyüşə istinad.
  Döyüşə istinad addımın `battle` keçidindən və ya müharibə gününün özünün döyüş olmasından gəlir. Qaydalar backend-in `GET /compare`-i ilə eynidir (`src/lib/compare.ts`).
  `scripts/parity-history-queries.ts` bütün cütləri backend ilə müqayisə edir.
- **Ortaq məkan** (qırıq xətt): eyni məkan, amma fərqli illərdə. Bu səviyyə yalnız frontend-dədir; həyatları üst-üstə düşməyən rəqiblər üçündür (Uzun Həsən və Şah İsmayıl: Təbriz).
- Zolaqların rəngi sabitdir (birinci göy, ikinci qırmızı), çünki temanın öz rəngləri dövrə görə dəyişir. Seçim URL-ə yazılır.
- Giriş nöqtələri: ana səhifə və şəxsiyyətin final ekranındakı "Başqası ilə müqayisə et" düyməsi.

## Dövr temaları və atmosfer

Görünüş data ilə idarə olunur, komponentlərdə hardcode olunmur. Hər `Era` bir temaya bağlıdır. Şəxsiyyət, dövlət və müharibə onu miras alır
(`themeId` ilə override edə bilər), ayrı addım da öz variantını seçə bilər (Nadirin Hind yürüşü: `efshar-hind`).
Seçim ardıcıllığı: addım → entity → ilin dövrü → `default` (`src/lib/theme.ts`, `pickThemeId`).

- **Rənglər və şriftlər.** `ThemeShell` temanı `<html>` üzərində CSS dəyişənləri kimi yazır (`--theme-primary`, `--theme-surface`...).
  `globals.css` bütün Tailwind rənglərini (`parchment`, `ink`, `carmine`, `gold`, `lapis`) onlardan törədir. Dəyişənlər `@property` ilə
  qeydiyyatdan keçib, ona görə bir entity-dən digərinə keçəndə rənglər yumşaq keçidlə dəyişir.
- **Mood.** Tema daxilində mood fonun parlaqlığını və səthin tonunu azca dəyişir (`moodTones`): Çaldıranda tünd, taclanmada parlaq.
- **Qatlı fon** (`src/features/theme/Atmosphere.tsx`): bulanıq illüstrasiya (parallax), tekstura, ornament çərçivəsi, ambient effekt
  (toz, közlər, şam işığı, duman). Simulyasiyada xəritənin üstündə yalnız ambient və nazik çərçivə olur, illüstrasiya start ekranında görünür.
- **Xəritə** `mapStyleVariant` ilə rəngini dəyişir: `manuscript`, `miniature`, `military`, `modern`.
- **Musiqi.** `musicThemeId`: `klassik` ümumi mood xəritəsidir, `zefer-2020` müharibənin öz saundtrekidir.
- **Performans.** Şəkillər AVIF və WebP formatındadır (1400 və 700 px), lazy load olunur. Yüngül rejimdə və `prefers-reduced-motion`
  zamanı parallax, ambient və blur söndürülür.
- **Şriftlər** `src/app/layout.tsx`-də yüklənir (preload olunmur). Hər biri ə, Ə, ğ, ı, İ, ş, ç, ö, ü daşıyır: Cinzel, Marcellus və
  Philosopher ə/Ə olmadığı üçün seçilmədi.
- **Şəkillər** `docs/IMAGE_CREDITS.md`-dədir (The Met Open Access, CC0). Yeni AI fonları üçün promptlar `docs/background-prompts.md`-dədir.

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
`id`, `name`, `startYear`, `endYear`, `description`, `themeId` (`data/themes`). Dövrlər üst-üstə düşəndə (Ağqoyunlu 1503-ə qədər, Səfəvi 1501-dən) ən son başlayan dövr seçilir.

### `Claim` (fakt və rəvayət)
`LifeEvent`, `StateStep`, `WarDay`: `claimType?` (`fact` standartdır) və `claims[]`: `{ id, claimType: fact | disputed | legend | literary, text, why?, sources, firstRecorded?, versions? }`.
UI hər növü rəng, ikon və "Bu niyə ... sayılır?" izahı ilə göstərir. Ayarlarda "Rəvayətləri göstər" seçimi var, final ekranında isə "Fakt yoxsa rəvayət?" quizi.
Təsnifatın əsasları `docs/RESEARCH_NOTES.md`-dədir.

### `Theme` (`data/themes/<id>.json`)
`palette { primary, accent, surface, text, link? }`, `fonts { display, body }`, `textures`, `ornaments { border, divider, corner }`,
`backgroundArt[]`, `ambientEffect`, `mapStyleVariant`, `musicThemeId`, `moodTones?`. Variant faylı `extends` ilə yalnız fərqli hissələri yazır
(məs. `efshar-hind`). Validator kontrastı (bütün mood-larda), şəkil fayllarını, kreditləri və prompt id-lərini yoxlayır.

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
| `related?` | `EntityRef[]`: əlaqəli şəxsiyyətlər, döyüşlər, dövlətlər, məkanlar, hökmdarlar |
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
`{ from, to, type, note?, sources? }`, burada `from`, `to`-nun `type`-ıdır (məs. `uzun-hasan` → `shah-ismayil`: `grandparent`).
Kəsişmə anları hadisələrin `related[]` sahəsindədir, bax "Çarpaz keçidlər".

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

- **Ailə ağacı.** `Relation` tipləri (`parent`, `grandparent`, `spouse`, `sibling`, `successor`) qrafa çevrilə bilər.
- **Çoxdilli interfeys (az, en, ru).** Bütün mətnlər `LocalizedText`-dir, UI mətnləri `locales/`-dadır. Yeni dil faylı əlavə edib `generateStaticParams`-da açmaq lazımdır.
- **PWA / offline.** Audio, snapshot və ikonlar statik fayldır və service worker ilə keşlənə bilər. Xəritə tile-ları üçün ölçüsü məhdud runtime keş lazım olacaq.
- **Redaksiya UI-si (CMS frontend-i).** Backend-in redaksiya API-si və OpenAPI təsviri hazırdır; UI ayrıca layihə olacaq.
- **"Tarixi şəxsiyyətdən soruş".** Yalnız dərc olunmuş, mənbəli məzmun üzərində; arxitekturada yer saxlanılıb.

## Lisenziyalar və mənbələr

Portretlər public domain-dir (`docs/RESEARCH_NOTES.md`-də hər birinin mənbəyi göstərilib). Xəritə: © OpenFreeMap, © OpenMapTiles,
© OpenStreetMap contributors, Natural Earth. Relyef kölgəsi: [Terrain Tiles](https://registry.opendata.aws/terrain-tiles/) (Mapzen, AWS Open Data).
Tarixi mənbələr və mübahisəli məqamlar `docs/RESEARCH_NOTES.md`-dədir.

| Data | Mənbə | Lisenziya |
|---|---|---|
| Sahil xətti (`data/territories/land.json`) | Natural Earth 1:50m land + lakes | Public domain |
| Siyasi sərhədlər | Layihə daxilində hazırlanıb (`data/territories/`) | Layihənin öz datası |
| historical-basemaps | Yoxlanılıb, **istifadə olunmayıb**: GPL-3.0, lazımi dövlətlər yoxdur (bax `data/territories/README.md`) | GPL-3.0 |
| Musiqi və səslər | Koddan sintez olunmuş placeholder-lər (`docs/AUDIO_CREDITS.md`) | CC0 1.0 |
| Kontarininin sitatı | R. Kerr, *A General History and Collection of Voyages and Travels*, 1811 | Public domain |
| 2020-ci il ölkə sərhədləri (`data/territories/countries.json`) | Natural Earth 1:50m admin-0 | Public domain |
| Azad olunan məntəqələrin koordinatları | © OpenStreetMap contributors, Nominatim ilə | ODbL |
| Şəkillər | `docs/IMAGE_CREDITS.md` | |
