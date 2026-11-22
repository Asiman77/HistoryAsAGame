# Frontend Spesifikasiyası: "Tarixin İçində"

> Bu sənəd Claude Code üçün yazılıb. Repoya `docs/FRONTEND_SPEC.md` kimi qoy və Claude Code-a de:
> "docs/FRONTEND_SPEC.md faylını oxu və 0-cı mərhələdən başla."
>
> Vizual istinad: dizayn kanvası (12 ekran) — https://claude.ai/artifact/QuU1krLbLPaXn8NhhZHFST
> Kanvasdakı ekranların HTML mənbəyini `docs/design/` qovluğuna əlavə edəcəyəm. Rəngləri, ölçüləri, boşluqları və
> kompozisiyanı oradan götür. Kanvasdakı `[...]` mətnləri placeholder-dir, real data deyil.

---

## 0. Claude Code üçün iş qaydaları

1. **Əvvəlcə plan.** Bu sənədi, `docs/BACKEND_SPEC.md`-ni, `docs/design/` qovluğunu və mövcud `frontend/` kodunu oxu.
   Sonra təqdim et və təsdiqimi gözlə:
   - route xəritəsi və layout ağacı
   - komponent siyahısı (paylaşılan / ekrana xas)
   - tema sisteminin quruluşu
   - mövcud koddan nəyin saxlanılacağı, nəyin yenidən yazılacağı
   - mərhələ planı
2. **Mərhələ-mərhələ işlə.** Kiçik, məntiqli commit-lər. Funksionallıq və refaktorinq ayrı commit-lərdə.
3. **Hər mərhələnin sonunda hesabat:** nə edildi, ekran görüntüləri (Playwright), açıq suallar.
4. **Versiyaları yoxla.** Kitabxanaların ən son stabil versiyalarını istifadə et, yaddaşdan yazma.
5. **Məzmun uydurma.** Tarixi fakt, tarix, ad, rəqəm yazmırsan. UI-da data yoxdursa, aydın boş vəziyyət (empty state) göstər.
   Test və Storybook üçün lazım olan nümunə data `fixtures/` qovluğunda olsun və açıq şəkildə "nümunə" kimi işarələnsin.
6. **Dizayna sadiq qal.** Kanvasdan kənara çıxmaq istəsən (daha yaxşı UX, texniki məhdudiyyət), səbəbi ilə soruş.

---

## 1. Məhsul və konsepsiya

Azərbaycan tarixini qədim dövrlərdən bu günə qədər **Təhsil Nazirliyinin təsdiqlədiyi dərsliklərə və kurikuluma uyğun**,
animasiyalı, interaktiv simulyasiya kimi öyrədən platforma. Hədəf auditoriya 6–11-ci sinif şagirdləri və tarix müəllimləridir.
Gələcəkdə Ümumi tarix də əlavə olunacaq.

**İstifadəçi tarixə üç yolla girir:**
1. **Dərsliklə öyrən:** sinif → bölmə → mövzu → mövzunun simulyasiyası
2. **Zaman şkalası:** qədim dövrdən bu günə sərbəst səyahət, istənilən ilin xəritəsi
3. **Kolleksiyalar:** şəxsiyyətlər, döyüşlər və müharibələr, dövlətlər, məkanlar

Hamısı eyni **simulyasiya mühərrikindən** istifadə edir: xəritə + hekayə paneli + timeline + mood (səs, rəng, atmosfer).

**Ton:** atmosferli, emosional, amma faktlara sadiq. Dərslik qədər quru deyil, oyun qədər yüngül deyil.

---

## 2. Texnologiya

| Sahə | Seçim |
|---|---|
| Framework | Next.js (App Router), React, TypeScript (strict) |
| Stil | Tailwind CSS + CSS dəyişənləri (tema tokenləri) |
| Animasiya | Framer Motion (UI), GSAP yalnız mürəkkəb timeline animasiyaları lazım olsa (səbəbini əsaslandır) |
| Xəritə | MapLibre GL JS + `react-map-gl/maplibre`, turf.js (qövslər, məsafə, interpolasiya) |
| Baza xəritə | Pulsuz vektor tile (məs. OpenFreeMap) + öz stilimiz. Mapbox token tələb edən həll seçmə |
| Səs | Howler.js |
| State | Zustand (simulyasiya, səs, istifadəçi seçimləri), URL state (addım, il, filtr) |
| Data | TanStack Query + backend-in OpenAPI-dən generasiya olunmuş TypeScript klienti |
| Validasiya | Zod (`shared/schema`-dan generasiya olunur, bax BACKEND_SPEC) |
| i18n | `next-intl`. Əsas dil `az`, sonra `en`, `ru` |
| Test | Vitest + Testing Library, Playwright (e2e + vizual regressiya), axe (a11y) |
| Komponent kataloqu | Storybook |
| PWA | Serwist (və ya Next.js-ə uyğun müasir alternativ) |

---

## 3. Dizayn sistemi

### 3.1. Rənglər (əsas tokenlər)

Bütün rənglər CSS dəyişəni kimi. Komponentlərdə heç vaxt hex yazılmır.

```css
:root {
  /* zəmin */
  --bg-base: #0B1222;        /* gecə lacivərdi */
  --bg-raised: #101A31;
  --bg-panel: #0E1730;
  /* mətn */
  --text-primary: #F3E9D2;   /* perqament */
  --text-secondary: #CFC3A8;
  --text-muted: #A99D84;
  /* vurğu */
  --accent: #E2C27A;         /* qızılı */
  --accent-ink: #1A1408;     /* qızılı düymə üzərində mətn */
  --border-subtle: rgba(226,194,122,0.16);
  --border-strong: rgba(226,194,122,0.4);
  /* semantik */
  --claim-fact: #4FB3AE;
  --claim-disputed: #E2A04A;
  --claim-legend: #B9A8D6;
  --claim-literary: #A99D84;
  /* xəritə */
  --map-parchment-center: #E9D7AE;
  --map-parchment-mid: #CFB37C;
  --map-parchment-edge: #6E4A2A;
  --map-water: #7FA3A1;
  --map-ink: #3A2414;
}
```

### 3.2. Dövr temaları

Hər dövrün öz teması var. Tema `data-theme` atributu ilə root-a tətbiq olunur və yuxarıdakı tokenlərin bir hissəsini əvəz edir.
Tema datası backend-dən gəlir (`/themes/{slug}`), amma ilkin dəyərlər kodda fallback kimi qalır.

| Tema | Zəmin | Vurğu | İkinci rəng | Xarakter |
|---|---|---|---|---|
| `default` | `#0B1222` | `#E2C27A` | — | gecə səması, qızılı naxış |
| `aq-qoyunlu` | `#0C1630` | `#C9A14A` | `#2A4A8C` lacivərd | Təbriz miniatürü |
| `safavid` | `#140A0C` | `#E2C27A` | `#9E2A2B` qızılbaş qırmızısı, `#4FB3AE` firuzəyi | zəngin miniatür |
| `afsharid` | `#140E08` | `#E0B07A` | `#7A3A16` tunc | sərt, hərbi |
| `victory-2020` | `#06111D` | `#FFFFFF` | bayraq: `#00B5E2`, `#EF3340`, `#509E2F` | müasir, təntənəli |
| digər dövrlər | — | — | — | Zaman şkalasındakı dövr rənglərindən törət (bax §6.2) |

Dövrlər arasında keçiddə tema dəyişikliyi **600–900 ms crossfade** ilə olur (rəng dəyişənləri CSS transition ilə).

### 3.3. Tipoqrafiya

- **Başlıqlar:** Noto Serif Display (500, 700, italic 500)
- **Mətn və UI:** Inter (400, 500, 600)
- Hər ikisi Azərbaycan hərflərini (ə, ğ, ı, İ, ö, ü, ç, ş) tam dəstəkləyir. `next/font` ilə yüklə, `latin-ext` subset.
- Şkala: 12 / 13 / 14 / 15 / 16 / 19 / 22 / 26 / 30 / 34 / 38 / 44 / 48 / 60 / 76 / 88 px.
- Böyük rəqəmlər (il, yaş, gün sayğacı) həmişə serif şriftlə.
- Eyebrow mətnlər: 12–13 px, `letter-spacing: 0.18–0.22em`, uppercase, vurğu rəngində.

### 3.4. Formalar və boşluqlar
- Radius: kart 20–22 px, panel 16–20 px, düymə 12–14 px, chip və pill 999 px.
- Boşluq şkalası 4 px əsaslı: 4, 8, 10, 12, 14, 16, 18, 22, 24, 28, 36, 40, 56, 80.
- Kölgələr: dərin, yumşaq, aşağı yönəlmiş (`0 30px 80px -30px rgba(0,0,0,.8)`).
- Kontent konteyneri `max-width: 1280px`, yan boşluq 40 px (mobildə 16–20 px).

### 3.5. Ornament və fon qatları (`<AtmosphereBackground />`)
Kanvasdakı fonları təkrar istifadə olunan komponentə çevir. Qatlar (aşağıdan yuxarı):
1. **Zəmin:** tema rəngi + yumşaq radial işıq (mövqe və rəng propla)
2. **Naxış:** SVG girih (səkkizguşəli ulduz) pattern, maska ilə kənarlara doğru sönür, `opacity 0.06–0.1`
3. **Siluet:** dağlar, şəhər, qayalar (dövrə görə), parallax (scroll və ya siçan ilə 2–6 px)
4. **Effekt:** toz hissəcikləri, ulduzlar, şəfəq (dövrə görə, Canvas və ya CSS)
5. **Vignette + tekstura** (SVG `feTurbulence` grain)

Hamısı `prefers-reduced-motion` və "Yüngül rejim"də statik olur.

### 3.6. İkonlar
Stroke əsaslı SVG ikonlar (1.5–2 px). Lucide istifadə etmək olar, xüsusi ikonlar (paytaxt tacı, döyüş qılıncı, ziyarətgah,
qala, liman, səkkizguşəli ulduz loqo) `components/icons/` qovluğunda. Emoji istifadə olunmur.

---

## 4. Route xəritəsi

```
/                                   Ana səhifə
/kurikulum                          Dərsliklə öyrən (default sinif = istifadəçinin son seçimi)
/kurikulum/[grade]                  Sinif: bölmələr və mövzular
/kurikulum/[grade]/[topicSlug]      Mövzunun simulyasiyası (SimulationShell)
/zaman                              Zaman şkalası + xəritə (?year=1501&grade=8&layers=...)
/sexsiyyetler                       Kolleksiya
/sexsiyyetler/[slug]                Şəxsiyyət simulyasiyası (?step=stepKey)
/sexsiyyetler/[slug]/final          Final: irs, quiz, pasport
/doyusler                           Kolleksiya
/doyusler/[slug]                    Müharibə: giriş ekranı (məs. Şanlı Zəfər tariximiz)
/doyusler/[slug]/gun                Gün görünüşü (?day=2020-10-20)
/dovletler/[slug]                   Dövlət simulyasiyası (?step=)
/mekanlar/[slug]                    Məkan səhifəsi
/muqayise                           ?a=person:uzun-hasan&b=person:shah-ismail
/muellim                            Müəllim paneli (auth)
/muellim/teqdimat/[...]             Proyektor rejimi
/pasport                            Tarix pasportu (localStorage)
```

- Route adları Azərbaycan dilində, ASCII (SEO və paylaşma üçün). Plan mərhələsində son variantı təsdiqlə.
- Bütün simulyasiya vəziyyəti URL-də: addım, il, rejim (`mode=story|learn`), rəvayət filtri. Link paylaşılanda eyni ekran açılır.
- Çarpaz keçid stack-i: bir simulyasiyadan digərinə keçəndə "geri" əvvəlki simulyasiyanın eyni addımına qaytarır
  (Zustand-da `navigationStack` + sessionStorage).

---

## 5. Simulyasiya mühərriki (əsas)

Bütün simulyasiya ekranları (`şəxsiyyət`, `mövzu`, `dövlət`, `müharibə günü`) bir `SimulationShell` üzərində qurulur.

### 5.1. Quruluş
```
<SimulationShell theme mood>
  <SimulationTopBar />            geri, başlıq, rejim keçidi (Hekayə/Öyrənmə), Rəvayətlər, səs
  <MapStage />                    MapLibre + overlay-lər
    <PortraitCard />              (şəxsiyyət) yaşa görə portret + yaş/il sayğacı
    <DayCounter />                (müharibə) gün sayğacı
    <MapLegend />
  <StoryPanel />                  desktop: sağda 420 px; mobil: bottom sheet
    <StepHeader />                "Mərhələ 7 / 14 · Taclanma" + ClaimBadge
    <StepTitle />, <Narrative />, <FactualSummary />, <Sources />
    <RelatedChips />              aktiv / passiv ("tezliklə")
    <ChoiceCard />                "Sən olsaydın?"
    <StepNav />                   əvvəlki / növbəti (qonşu addımın adı ilə)
  <SimulationTimeline />          addımlar, mood rəngli nöqtələr, keçilən hissə gradient
</SimulationShell>
```

### 5.2. Addım tipləri və şablonlar
Hər addımın `template` sahəsi var. Mühərrik şablona görə xəritə davranışını seçir:

| Şablon | Xəritə davranışı |
|---|---|
| `location` | kamera məkana uçur, marker pulsasiya edir |
| `journey` | A → B qövs marşrutu tədricən çəkilir, üzərində hərəkət edən marker |
| `battle` | döyüş meydanına zoom, tərəflərin oxları animasiya ilə, nəticə kartı |
| `territory` | ərazi snapshot-ları arasında keçid (sərhədlər genişlənir və daralır) |
| `liberation` | rayonlar ardıcıl rəng dəyişir (boz → yaşıl, dalğa effekti) |
| `infographic` | xəritə arxa plana keçir və bulanıqlaşır, mərkəzdə infoqrafika kartı (islahatlar, qanunlar) |
| `monument` | abidə kartı (şəkil, sonra 3D), xəritədə məkan |
| `artifact` | arxeoloji tapıntı kartı (Qobustan, Azıx və s.) |
| `migration` | axın oxları (köç və məskunlaşma) |
| `treaty` | tərəflər + ərazi dəyişikliyi |

### 5.3. Addım keçidinin xoreoqrafiyası (desktop)
Bir addımdan digərinə keçid **təxminən 1.6–2.4 saniyə** və ardıcıl olmalıdır:
1. `0 ms` — hekayə panelinin məzmunu fade-out + 8 px yuxarı (200 ms)
2. `100 ms` — mood dəyişirsə tema rəngləri crossfade (600 ms), musiqi crossfade (1–2 s)
3. `150 ms` — kamera `flyTo` (curve 1.4, easing `cubic-bezier(.65,0,.35,1)`, məsafəyə görə 900–1800 ms)
4. kamera çatanda — marşrut çəkilir (`line-dasharray`/`line-gradient` progress, 1200–2000 ms), marker yol boyunca hərəkət edir
5. paralel — il və yaş sayğacı rəqəm-rəqəm dəyişir (400–800 ms)
6. son — yeni məzmun fade-in + yuxarıdan aşağıya stagger (başlıq, mətn, chip-lər; 40 ms aralıqla)
7. portret dəyişirsə crossfade (500 ms)

Keçilmiş marşrutlar xəritədə solğun iz kimi qalır. İstifadəçi animasiya bitməmiş "növbəti"yə bassa, cari animasiya
dərhal sona çəkilir (skip), növbəti başlayır. Animasiya heç vaxt interfeysi bloklamamalıdır.

### 5.4. İdarəetmə
- Klaviatura: `←` `→` addımlar, `Space` avtomatik oynatma (pauza ilə), `Esc` panel bağla, `M` səs.
- Mobil: üfüqi swipe, bottom sheet üç vəziyyət (yığılmış / yarım / tam).
- Avtomatik oynatma rejimi (müəllimin proyektor rejimi üçün də).

### 5.5. Fakt və rəvayət
- `ClaimBadge`: Fakt (firuzəyi, ✓), Mübahisəli (narıncı), Rəvayət (bənövşəyi, ulduz), Ədəbi (boz). Hover/tap: "Bu niyə ... sayılır?"
- "Rəvayətlər" düyməsi rəvayət addımlarını göstərir və ya gizlədir (default: göstər, nişanla).
- Mübahisəli addımlarda "Alternativ versiya" bölməsi açılır.

### 5.6. Rejimlər
- **Hekayə:** `narrative` (birinci şəxs, serif italic) böyük, `factualSummary` kiçik.
- **Öyrənmə:** `factualSummary` əsas, mənbələr açıq, dərslik istinadı (`Dərslik: 8-ci sinif, § N`) görünür, narrative gizli.

---

## 6. Ekranlar

Hər ekran üçün kanvasdakı artboard əsasdır. Aşağıda funksional tələblər.

### 6.1. Ana səhifə (`/`) — kanvas: "Ana səhifə"
- Hero: `AtmosphereBackground` (default tema), göydə animasiyalı nümunə marşrut, başlıq, iki CTA.
- "Dərsliklə öyrən" bloku: sinif seçimi (6–11) birbaşa ana səhifədə, son davam etdirilən mövzu kartı.
- Şəxsiyyət kartları (hər biri öz dövr temasında, hover-də portret yüngül böyüyür və işıqlanır, "Davam et · 7/14" bayrağı).
- Döyüş və dövlət kartları.
- Zaman şkalası önizləməsi (sürüşdürmək olur, `/zaman`-a keçid).
- "Tarixdə bu gün" (data yoxdursa "bu ay" fallback, o da yoxdursa blok gizlənir).
- Mövcud məzmunun sayları backend-dən (uydurma rəqəm yoxdur).

### 6.2. Zaman şkalası (`/zaman`) — kanvas: "Zaman şkalası + hökmdar paneli"
- **Yuxarı:** həmin ilin xəritəsi (`/territories?year=`), paytaxtlar, hadisə markerləri. Qatlar: sərhədlər, paytaxtlar, hadisələr, rəvayətlər.
- **İl göstəricisi:** böyük serif rəqəm + cari dövrün adı.
- **Ölkəyə klik → `RulerPanel`:** hökmdar portreti, ad, hakimiyyət illəri, paytaxt, vəziyyət, rəqiblər, "Həyatını yaşa" və
  "Dövlət simulyasiyası" düymələri (mövcud deyilsə passiv "tezliklə"). Data olmayan ölkə üçün "məlumat hazırlanır".
- **Aşağı (360 px):**
  - sinif filtrləri (Bütün dövrlər, 6–11): seçiləndə həmin sinfin əhatə etdiyi dövr vurğulanır, qalanı solğunlaşır
  - **dövr zolaqları** (data-driven, `/eras`): Daş dövrü, Tunc və Dəmir, Qədim dövlətlər, Xilafət, Feodal dövlətlər,
    Səlcuqlar və Atabəylər, Monqollar, Qara- və Ağqoyunlu, Səfəvilər, Əfşarlar, Xanlıqlar, XIX əsr, AXC, Sovet dövrü, Müstəqillik.
    Bu siyahı kanvasdakı nümunədir: real siyahı və sərhəd illəri backend datasından gəlir
  - zolaqlar: Dövlətlər, Hadisələr, Şəxsiyyətlər (ömür xətləri)
  - ox + sürüşdürülən göstərici (drag, klik, klaviatura `←→` = 1 il, `Shift+←→` = 10 il, `PageUp/Down` = dövr)
- **Qeyri-xətti miqyas:** Daş dövründən bu günə xətti miqyas işləmir. Hər dövrə `weight` verilir və ox parçalı-xətti
  (piecewise linear) qurulur. Funksiya `yearToX(year)` və `xToYear(x)` test olunmalıdır (e.ə. illər, sərhəd halları).
- Zoom: dövr zolağına klik → həmin dövrə yaxınlaşır (ox həmin intervala genişlənir, animasiya ilə).
- Sürgü sürüklənəndə xəritə yenilənməsi debounce (≈120 ms), sərhəd keçidi animasiyalı.
- Fənn keçidi: "Azərbaycan tarixi" / "Ümumi tarix · tezliklə" (passiv).

### 6.3. Dərsliklə öyrən (`/kurikulum/[grade]`) — kanvas: "Dərsliklə öyrən"
- Sinif tabları (6–11), seçim `localStorage`-da yadda qalır.
- Sol: bölmələr, hər biri irəliləyiş halqası ilə. Sağ: mövzular siyahısı (status: tamamlandı / davam edir / yeni / hazırlanır).
- Hər mövzuda: ad, dərslik paraqrafı (`§ N`), mərhələ sayı, təxmini müddət, quiz nəticəsi.
- Yuxarıda "Müəllimin bu həftə təyin etdiyi mövzu" kartı (sinif kodu daxil edilibsə).
- "Hazırlanır" statuslu mövzular siyahıda görünür, amma klik edilmir. Bu, şagirdə proqramın tam əhatə olunacağını göstərir.
- Sinif → bölmə → mövzu strukturu backend-dən gəlir (`curriculum` modeli). Frontend heç bir mövzu adını hardcode etmir.

### 6.4. Mövzu və şəxsiyyət simulyasiyası — kanvas: "Simulyasiya — Şah İsmayıl, 1501"
`SimulationShell`. Mövzu simulyasiyası bir neçə şəxsiyyət, döyüş və dövlət addımını bir xətdə birləşdirə bilər.
Mövzunun sonunda quiz və "Növbəti mövzu" keçidi var.

### 6.5. Dövlət simulyasiyası (`/dovletler/[slug]`) — kanvas: "Dövlət simulyasiyası — Əfşarlar"
- Əsas vizual: `territory` şablonu. Əvvəlki sərhəd qırıq xətlə qalır, yeni ərazi böyüyərək dolur.
- Paytaxt köçəndə marker yeni yerə uçur.
- Yürüş oxları (nöqtəli, ucunda ox).
- Faktlar paneli: hökmdar, paytaxt, vəziyyət, ərazi (yalnız mənbədə varsa), əlaqəli chip-lər.
- Aşağıda **sülalə zolağı** (hakimiyyət müddətinə mütənasib) + mərhələlər.

### 6.6. Müharibə: giriş və gün görünüşü — kanvas: "Şanlı Zəfər tariximiz — giriş", "Vətən müharibəsi — gün görünüşü"
- **Giriş:** gecədən şəfəqə keçən səma, dalğalanan üçrəngli bayraq, ay-ulduz, Şuşa qayaları silueti, başlıq "ŞANLI ZƏFƏR TARİXİMİZ".
  Giriş animasiyası: qaranlıq → bayraq zolaqları soldan sağa açılır → ay-ulduz yuxarı qalxır → başlıq hərf-hərf görünür (≈3 s, keçmək olar).
- **Gün görünüşü:** gün sayğacı ("24-cü günü"), `liberation` şablonu, gün paneli (təsvir, mənbə, azad olunmuş məntəqə sayı,
  sərkərdələr, həmin gün şəhid olan qəhrəmanlar), günlər timeline-ı.
- 8 Noyabr (Şuşa) addımı xüsusi kulminasiya səhnəsidir: musiqi kulminasiyası, işıq partlayışı əvəzinə yavaş şəfəq, bayraq.
- **Şəhidlər bölməsi xatirə tonundadır:** sakit keçid, musiqi yumşalır, qərənfil motivi.
- **Qaydalar:** qrafik zorakılıq yoxdur; real müasir şəxslər üçün AI şəkil yoxdur (foto yoxdursa hörmətli siluet placeholder);
  bütün mətnlər rəsmi mənbəyə istinadla; xəritə "stilizə, sxematik" kimi işarələnir.

### 6.7. Məkan səhifəsi (`/mekanlar/[slug]`) — kanvas: "Məkan səhifəsi — Təbriz"
- Hero: şəhər silueti, ad (tarixi + müasir), qısa təsvir, saylar.
- Şaquli timeline: bütün kateqoriyalardan hadisələr, hər biri öz dövrünün rəngində (kartın fonu tema gradienti).
  Scroll etdikcə səhifənin vurğu rəngi dövrə uyğun dəyişir.
- Hər kartda kateqoriya, başlıq, birbaşa simulyasiya addımına keçid.

### 6.8. Müqayisə (`/muqayise`) — kanvas: "Müqayisə rejimi"
- İki entity seçimi (axtarışla), əlaqə nişanı ("baba və nəvə").
- Xəritədə iki marşrut, hər biri öz rəngində. Kəsişmə nöqtələri halqa ilə vurğulanır.
- Kəsişmələr paneli (backend `/compare`-dən).
- Altda iki paralel timeline, ümumi il oxu ilə.

### 6.9. Final (`/sexsiyyetler/[slug]/final`) — kanvas: "Final — irs, quiz, tarix pasportu"
- Bütün həyat marşrutu xəritədə, ardıcıl çəkilir.
- Statistika (yalnız datadan hesablanan): mərhələ sayı, döyüş sayı, şəhər sayı, qət edilən təxmini məsafə (turf ilə).
- Quiz (növlər: çoxseçimli, "fakt yoxsa rəvayət", xronoloji sıralama, xəritədə tap). Cavabdan sonra izah və uyğun addıma keçid.
- Tarix pasportu: ziyarət olunan şəhərlər üçün möhür animasiyası (möhür vurulma effekti + yüngül səs).

### 6.10. Müəllim paneli (`/muellim`) — kanvas: "Müəllim paneli"
- Siniflər, sinif kodu, mövzu təyin etmə, proyektor rejimi, canlı viktorina (sonrakı mərhələ), toplu nəticələr.
- Statistika yalnız toplu; şagird adı yoxdur.
- **Proyektor rejimi:** böyük şrift (×1.4), panel sadələşir, avtomatik oynatma, müəllim klaviatura və ya pult ilə idarə edir.

### 6.11. Mobil — kanvas: "Mobil — simulyasiya"
- Xəritə yuxarı ~55%, hekayə bottom sheet.
- Üst: geri, il və yaş, səs. Sheet: addım, nişan, başlıq, narrative, xülasə, irəliləyiş seqmentləri, naviqasiya.
- Bütün ekranlar 360 px enində işləməlidir. Toxunma hədəfləri ≥ 44 px.

---

## 7. Xəritə

- **Stil:** öz MapLibre stilimiz. Müasir sərhədlər, yollar, şəhər adları gizli. Relyef (hillshade), su obyektləri, çaylar qalır.
  Perqament rəngləri (§3.1 xəritə tokenləri). Dövrə görə stil variantı (`mapStyleVariant`: perqament, gecə, müasir sxematik).
- **Overlay-lər:** grain və vignette DOM qatı kimi (WebGL-dən asılı deyil).
- **Ərazilər:** `fill` + `line` qatları; `feature-state` ilə hover və seçim. Snapshot keçidi:
  köhnə qat opacity 1→0, yeni 0→1 (600 ms), mümkün olduqda sadə poliqon morph (flubber) — performans testi ilə qərar ver.
- **Marşrutlar:** `line-gradient` + `lineMetrics: true`, progress animasiyası `requestAnimationFrame` ilə.
  Qövslər turf `greatCircle` və ya Bezier ilə.
- **Markerlər:** paytaxt (tac), şəhər, qala, döyüş meydanı, ziyarətgah, liman — SVG ikonlar, zoom səviyyəsinə görə görünürlük (`importance`).
- **Toponimlər:** dövrün adı əsas, müasir ad hover-də.
- **"Stilizə / təxmini sərhədlər"** qeydi həmişə xəritə küncündə.
- Xəritə yüklənə bilməsə (WebGL yoxdur, zəif cihaz): SVG fallback xəritə (kanvasdakı kimi stilizə), simulyasiya işləməyə davam edir.

---

## 8. Səs

- Howler.js, kanallar: `music`, `ambience`, `sfx`, `voice` (gələcək). Hər biri üçün ayrıca səs səviyyəsi.
- Mood → musiqi qatı xəritələməsi backend temasından. Mood dəyişəndə 1–2 s crossfade.
- Səs yalnız istifadəçinin ilk qarşılıqlı əlaqəsindən sonra başlayır (autoplay qaydası). Default səviyyə orta, bir kliklə tam söndürülür, seçim yadda qalır.
- `permissionStatus !== GRANTED` olan treklər oynadılmır (backend onsuz da qaytarmır, frontend də yoxlayır).
- Növbəti addımın səsi əvvəlcədən yüklənir.

---

## 9. Data qatı

- Backend OpenAPI-dən klient generasiya (`openapi-typescript` + `openapi-fetch` və ya oxşar).
- `Repository` interfeysi saxlanılır. İki implementasiya: `StaticRepository` (statik JSON eksportu) və `ApiRepository`.
  `NEXT_PUBLIC_DATA_SOURCE=static|api`.
- TanStack Query: ictimai məzmun üçün uzun `staleTime`, ETag dəstəyi.
- Ağır data (ərazi GeoJSON-ları) lazım olanda yüklənir, növbəti snapshot əvvəlcədən gətirilir.
- Server Components: kolleksiya, məkan, kurikulum siyahıları SSR/ISR (SEO və sürət). Simulyasiya və xəritə client component.
- **Kurikulum modeli** (backend-ə əlavə olunacaq, bax §13): `subject → grade → section → topic → steps`. Hər addımda
  `curriculumRefs: [{ grade, sectionSlug, topicSlug, textbookRef }]`.

---

## 10. İstifadəçi vəziyyəti və məxfilik

- Şagird hesabı yoxdur. İrəliləyiş, pasport, seçimlər `localStorage`-da (try/catch ilə, boş gələ bilər).
- Sinif kodu daxil edilə bilər (yalnız toplu analitika və müəllimin təyin etdiyi mövzu üçün).
- Analitika event-ləri (BACKEND_SPEC §12) anonim `sessionId` ilə. Şəxsi məlumat göndərilmir. Üçüncü tərəf tracker yoxdur.

---

## 11. Əlçatanlıq və performans

**Əlçatanlıq (WCAG 2.2 AA):**
- Mətn kontrastı ≥ 4.5:1 (kiçik boz etiketlər də). Tema dəyişəndə yoxla (avtomatik test).
- Hər şey klaviatura ilə idarə olunur, fokus görünür. Real `<button>`, `<a>`, `<label>`.
- Xəritə hadisələri ekran oxuyucu üçün mətn kimi də təqdim olunur (`aria-live` ilə addım dəyişikliyi elanı).
- `prefers-reduced-motion`: kamera uçuşu əvəzinə ani keçid + fade, parallax və hissəciklər söndürülür.
- Rənglə yanaşı forma və mətn (fakt nişanı yalnız rəng deyil, ikon + söz).

**Performans:**
- Hədəf: zəif məktəb kompüterində (4 GB RAM, inteqrasiya olunmuş qrafika) simulyasiya 50–60 fps.
- **"Yüngül rejim"**: avtomatik aşkarlanır (`navigator.hardwareConcurrency`, `deviceMemory`, FPS ölçümü) və əl ilə seçilir.
  Effektlər, parallax, grain, hillshade söndürülür.
- LCP < 2.5 s (ana səhifə), JS bundle: xəritə və səs yalnız simulyasiya route-larında yüklənir (dynamic import).
- Şəkillər `next/image`, AVIF/WebP. Səslər ogg + mp3 fallback.

**PWA / offline:**
- Seçilmiş sinfin mövzuları, onların ərazi faylları, şəkil və səsləri "Oflayn üçün yüklə" düyməsi ilə keşlənir.
- Xəritə tile-ları üçün məhdud keş (bölgə üzrə).

---

## 12. Test strategiyası

| Səviyyə | Nə yoxlanılır |
|---|---|
| Unit | `yearToX`/`xToYear` (e.ə. illər), tarix formatlama (`HistoricalDate` → "1501-ci il", "e.ə. VII əsr"), Azərbaycan dilində sıra sayları ("24-cü", "43-cü", "1-ci"), mood → tema xəritələməsi, quiz qiymətləndirmə |
| Komponent | StoryPanel, ClaimBadge, RulerPanel, SimulationTimeline, CurriculumList — Storybook + Testing Library |
| E2E (Playwright) | Ana səhifə → kurikulum → mövzu → son addım → quiz; zaman şkalasında il dəyişmə və ölkəyə klik; dərin link (`?step=`) açılır; çarpaz keçid və geri qayıtma; mobil bottom sheet |
| Vizual regressiya | Hər ekranın desktop və mobil ekran görüntüsü, kanvas ilə müqayisə üçün |
| A11y | axe hər route-da, klaviatura naviqasiyası ssenarisi |
| Performans | Lighthouse CI hədəfləri, simulyasiya keçidində FPS ölçümü |

Azərbaycan dilində sıra sayı şəkilçiləri (`-ci`, `-cı`, `-cu`, `-cü`) üçün xüsusi util yaz və hərtərəfli test et.

---

## 13. Backend ilə əlaqəli əlavələr (BACKEND_SPEC-ə qeyd)

Frontend aşağıdakıları tələb edir. Plan mərhələsində BACKEND_SPEC-ə əlavə ediləcək dəyişiklik siyahısını hazırla:
- `curriculum` modulu: `subject`, `grade`, `section`, `topic`, `topic_step` (mövzu ↔ addım), `textbook_ref`
- `GET /curriculum/{subject}/grades`, `/curriculum/{subject}/grades/{grade}`, `/curriculum/topics/{slug}/steps`
- `simulation_step.template` sahəsi (§5.2 siyahısı)
- `era.weight` (zaman şkalasının qeyri-xətti miqyası üçün), `era.subject`
- `/eras?subject=` və `/timeline` cavabında `grade` filtrinə dəstək

---

## 14. Kontent hazırlığı üçün köməkçi alət (ayrıca, sonrakı mərhələ)

`tools/curriculum-extractor/`: TRİMS-dəki təsdiqlənmiş Azərbaycan tarixi dərsliklərinin (PDF) **mündəricatından**
sinif → bölmə → mövzu → paraqraf strukturunu çıxaran skript. Nəticə redaksiya sənədləri kimi CMS-ə qaralama (`DRAFT`) kimi düşür.
- Yalnız struktur (başlıqlar, paraqraf nömrələri) çıxarılır. Dərslik mətnləri, xəritələri və şəkilləri **köçürülmür**:
  onlar müəllif hüququ ilə qorunur. Məzmun öz sözlərimizlə yazılır və tarix müəllimi tərəfindən yoxlanılır.
- Hər mövzuda dərsliyə istinad (sinif, müəllif kollektivi, nəşr ili, paraqraf) saxlanılır.

---

## 15. İş mərhələləri və "hazırdır" meyarları

| # | Mərhələ | Hazırdır, əgər... |
|---|---|---|
| 0 | **Plan** | route xəritəsi, komponent siyahısı, tema quruluşu, mövcud kodun auditi təsdiqlənib |
| 1 | **Dizayn sistemi** | tokenlər, dövr temaları, şriftlər, ikonlar, `AtmosphereBackground`, düymə/chip/kart/panel komponentləri Storybook-da; kontrast testi keçir |
| 2 | **Layout və naviqasiya** | header, footer, route skeletləri, tema keçid animasiyası, çarpaz keçid stack-i |
| 3 | **Simulyasiya mühərriki** | `SimulationShell`, addım xoreoqrafiyası, `location` və `journey` şablonları, klaviatura/swipe, URL state, reduced motion |
| 4 | **Xəritə** | öz stil, ərazi qatları və keçidlər, marşrut animasiyası, markerlər, SVG fallback |
| 5 | **Şəxsiyyət simulyasiyası + final** | mövcud 3 şəxsiyyət sonadək işləyir, portret sistemi, quiz, pasport |
| 6 | **Zaman şkalası** | qeyri-xətti ox, dövr zolaqları, sinif filtri, xəritə sinxronu, hökmdar paneli |
| 7 | **Kurikulum** | sinif → bölmə → mövzu ekranları, mövzu simulyasiyası, irəliləyiş |
| 8 | **Dövlət simulyasiyası** | `territory` şablonu, sülalə zolağı, Əfşarlar sonadək |
| 9 | **Müharibə** | giriş animasiyası, `liberation` şablonu, gün görünüşü, xatirə bölməsi |
| 10 | **Məkan + müqayisə** | məkan timeline-ı, müqayisə xəritəsi və paralel timeline-lar |
| 11 | **Qalan şablonlar** | `battle`, `infographic`, `monument`, `artifact`, `migration`, `treaty` |
| 12 | **Səs** | kanallar, mood crossfade, icazə yoxlaması, yüngül rejimdə də işləyir |
| 13 | **Müəllim paneli** | siniflər, mövzu təyini, proyektor rejimi, toplu nəticələr |
| 14 | **Mobil, PWA, performans** | bütün ekranlar 360 px-də, oflayn sinif paketi, Lighthouse hədəfləri, yüngül rejim |
| 15 | **i18n hazırlığı** | bütün UI mətnləri lokal fayllarda, `en`/`ru` üçün struktur hazırdır |

---

## 16. Bu mərhələdə QURMA

- Ümumi tarix məzmunu (yalnız struktur və passiv keçid)
- "Tarixi şəxsiyyətdən soruş" (AI söhbət)
- 3D abidə modelləri (yalnız `monument` şablonunda yer)
- Şagird hesabları, ödəniş
- Canlı viktorina (müəllim panelində passiv "tezliklə")
