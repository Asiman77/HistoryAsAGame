# 0013. Mövcud datanın idxalı: rəysiz dərc, hash ilə idempotentlik, CMS redaktələrinin qorunması

Tarix: 2026-11-12 · Status: Qəbul

## Kontekst
BACKEND_SPEC.md §16 tələb edir ki, bütün `data/` idxal olunsun və idxal iki dəfə işlədildikdə dublikat yaranmasın. Bu data artıq saytda ictimaidir. Redaksiya axını isə hər dərcdən əvvəl rəy və təsdiq tələb edir (§8), həm də "heç kim öz revision-ını təsdiqləyə bilməz". Data CMS-də redaktə olunmağa başlayandan sonra `data/` yenidən idxal olunarsa, redaktorun işi itməməlidir. 2026-11-12 tarixində data 432 sənəd verir. Onlardan 3-ü validasiyadan keçmir: icazəsi gözlənilən 2 trek və etibarsız poliqonu olan `y2020` snapshot-u.

## Qərar
- **Mənbə:** `POST /api/v1/admin/import[?dryRun=true]` (ADMIN). Qovluqlar `platform.import.data-dir` və `built-territories-dir`-dən gəlir; Docker-də `data/` və `public/data/territories` yalnız oxumaq üçün qoşulur. Qruplaşdırmanı `DataFolder` edir (ADR-0007, ADR-0011). Test fikstürü də eyni kodu istifadə edir.
- **Müəllif:** revision-ları `importer@system.invalid` sistem hesabı yazır (`identity.api.SystemAccounts`). Onun şifrəsi və rolu yoxdur, login edə bilməz. Jurnalda əməliyyatın icraçısı idxalı işə salan ADMIN-dir.
- **Rəysiz dərc:** validasiyada `ERROR` olmayan sənəd birbaşa `PUBLISHED` olur. Jurnalda bu, ayrıca `import` əməliyyatıdır (`approve`/`publish` deyil), ona görə rəydən keçmədiyi görünür. `ERROR`-u olan sənəd `DRAFT` qalır və hesabatda xətaları ilə göstərilir. Pending treklər və etibarsız poliqon üçün heç nə fərz edilmir: onlar sadəcə dərc olunmur.
- **İdempotentlik:** kontent kanonik JSON-un SHA-256-sı ilə müqayisə olunur.

  | Vəziyyət | Nəticə |
  |---|---|
  | sənəd yoxdur | `CREATED` |
  | eyni hash | `UNCHANGED`: revision yaranmır, dərc olunubsa heç nə edilmir; draft-dırsa yenidən yoxlanılır (bəlkə asılılığı artıq var) |
  | fərqli hash, cari revision idxalçınındır və status `DRAFT`/`PUBLISHED` | `UPDATED`: yeni revision, yoxlama, dərc |
  | fərqli hash, amma CMS-də redaktə olunub və ya rəydədir | `CONFLICT`: toxunulmur |
  | arxivdədir | `ARCHIVED`: toxunulmur |
- **Bir tranzaksiya:** əvvəl bütün sənədlər yazılır, sonra yoxlanılır. Belə olanda sənədlər arası referanslar bir-birini tapır və nəticə fayl sırasından asılı olmur. `dryRun` hər şeyi edib hesabat verir, sonra tranzaksiyanı geri alır.
- **Proyeksiya:** hər sənəd üçün ayrıca `ContentPublished` atılmır. Bir `ContentImported` event-i atılır və `publishing` proyeksiyanı bir dəfə yenidən qurur (ADR-0012). Bu, toplu dəyişiklik üçün ucuzdur və sıradan asılı deyil (tema variantı valideyndən əvvəl gələ bilər).
- **Media icazəsi (ADR-0010):** qaydalar `MediaPermissions`-dadır, nəticə hesabatda saylarla və `PENDING` siyahısı ilə göstərilir. `media_asset` sətirləri media reyestri ilə birlikdə yaradılacaq (mərhələ 11), çünki onlar S3 `storage_key` tələb edir.
- **Mənbə problemləri:** oxunmayan fayl, id-siz element, təkrarlanan `(tip, slug)`, heç bir sənədə düşməyən `relations.json`/`reigns.json` sətirləri hesabatda `sourceProblems` kimi göstərilir. Bu gün siyahı boşdur.

## Nəticələr
- \+ Mövcud data bir əmrlə backend-ə keçir. Təkrar idxal (məsələn frontend-də data dəyişdikdən sonra) yalnız dəyişəni yazır.
- \+ CMS-də görülən iş heç vaxt idxalla üzərinə yazılmır.
- − İdxal olunan sənədlərin `created_by`-ı sistem hesabıdır. AUTHOR onları redaktə edə bilmir (yalnız öz sənədlərini), REVIEWER və ADMIN edə bilir. Bu, spesifikasiyanın icazə cədvəlinə uyğundur.
- − Rəysiz dərc yalnız idxala aiddir və jurnalda açıq görünür.
