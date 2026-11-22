# 0022. Frontend-in yeni dizaynı: statik export qalır, yeni route-lar köhnələrin yanında, backend əlavələri mərhələlərlə

Tarix: 2026-11-22 · Status: Qəbul

## Kontekst
[`FRONTEND_SPEC.md`](../FRONTEND_SPEC.md) yeni vizual dil (tünd zəmin, dövr temaları, 12 artboard), yeni route-lar,
simulyasiya mühərrikinin yenidən qurulmasını və bir sıra kitabxanalar tələb edir. Bəzi bəndlər mövcud qərarlarla ziddiyyət təşkil edir:
- SSR/ISR və canlı `ApiRepository` (spesifikasiya §9) ↔ statik export, GitHub Pages, ADR-0020;
- `shared/schema`-dan generasiya olunan Zod (§2) ↔ ADR-0005 (Zod mənbədir);
- `frontend/` qovluğu (§0) ↔ ADR-0004 (kök);
- prefiksiz route-lar (§4) ↔ `[locale]` seqmenti və proxy olmayan statik export.

Plan ([`FRONTEND_PLAN.md`](../FRONTEND_PLAN.md) §1, Q1–Q9) 2026-11-22-də istifadəçi tərəfindən tövsiyələrlə birlikdə təsdiqləndi.

## Qərar
1. **Render:** `output: "export"` qalır. Səhifələr build zamanı yaradılır (SSG). TanStack Query yalnız brauzerdə yüklənən data üçündür
   (ərazi GeoJSON-ları, müəllim paneli, sinif kodu, axtarış).
2. **Data:** ADR-0020 qüvvədədir. `FileSystemRepository` `StaticRepository` adlanır. Canlı API-yə yalnız runtime funksiyalar
   `openapi-fetch` klienti ilə müraciət edir.
3. **Route-lar:** Azərbaycan dilində ASCII adlar (`/az/sexsiyyetler/…`, `/az/zaman/`…), `/az/` prefiksi saxlanılır
   (`next-intl`, `localePrefix: "always"`). `/dovletler` və `/mekanlar` siyahıları əlavə olunur. Köhnə ünvanlar `?step=`-i saxlayan yönləndirmələrə çevrilir.
4. **Keçid:** yeni ekranlar `main`-də köhnələrin yanında qurulur. Ekran hazır olanda köhnə route yönləndirməyə çevrilir. Hər commit deploy oluna bilər.
5. **Backend:** spesifikasiyanın §13 əlavələri (B1: `template`, `era.weight`/`subject`, tema `ui` bloku; B2: kurikulum; B3: müəllimin mövzu təyini)
   asılı frontend mərhələsindən dərhal əvvəl ayrıca commit-lərlə edilir. `data/` formatı da eyni dəyişiklikləri alır.
6. **Dizaynda olmayan mövcud funksiyalar** (qlossari, "Bu zaman dünyada", səsli nəql, ilkin mənbə sitatı, kolleksiya) saxlanılır, `StoryPanel`-in yığılmış "Ətraflı" bölməsində.
7. **Zod** mənbə olaraq qalır (ADR-0005). Əks istiqamət ayrıca mərhələdir.
8. **Temalar:** datadakı id-lər qalır (`turkman-tebriz` = Ağqoyunlu, `sefevi`, `efshar`, `muasir-zefer` = 2020). Tünd UI palitrası
   B1-ə qədər kodda fallback-dır. Şriftlər: yalnız Noto Serif Display və Inter. Dövr şriftləri çıxarılır.
9. **Proyektor rejimi** girişsiz işləyir. Siniflər, mövzu təyini və nəticələr giriş (TEACHER) tələb edir.

## Nəticələr
- \+ Hosting, deploy və data axını dəyişmir. Backend yerləşdirilməsi frontend-i bloklamır.
- \+ Sayt keçid boyu işlək qalır. Köhnə linklər yönləndirmə ilə açılır.
- − Keçid dövründə iki UI yanaşı yaşayır: `(legacy)` route qrupu və köhnə `globals.css` mərhələ 14-də silinir.
- − Dərin linkdə (`?step=`) ilk HTML 1-ci addımı göstərir, qabıq parametr oxunana qədər skelet göstərir.
- − Məzmun boşluqları (4 dövr, kurikulum yoxdur) UI-da boş vəziyyətlərlə görünür. Heç nə uydurulmur.
