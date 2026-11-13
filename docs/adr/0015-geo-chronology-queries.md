# 0015. Coğrafi və xronoloji sorğular: frontend qaydaları, xəritənin əhatəsi, kəsişmə, axtarış

Tarix: 2026-11-13 · Status: Qəbul

## Kontekst
BACKEND_SPEC.md §10.1 və §10.3 doqquz sorğu tələb edir: `/timeline`, `/territories`, `/polities/at`, `/polities/{slug}/ruler`, `/places/{slug}/timeline`, `/compare`, `/on-this-day`, `/search`. Frontend bunların çoxunu artıq build zamanı hesablayır: `snapshotForYear`, `personsInYear`, `placeMembership`, `eventsAtPlace`, `onThisDay`, `buildHistoryIndex`. Mərhələ 14-də frontend `ApiRepository`-yə keçəndə cavablar dəyişməməlidir. Spesifikasiyanın bəzi qaydaları frontend-dəkindən fərqlidir, bəzi məqamları isə heç təsvir etmir.

## Qərar

### Mənbə frontend-in qaydalarıdır
Backend frontend funksiyalarının nəticəsini təkrarlayır. `scripts/parity-history-queries.ts` frontend funksiyalarını `data/` üzərində işlədir və nəticəni işləyən backend-in cavabları ilə müqayisə edir: 74 məkan (hadisələr və mənsubiyyət), ilin 366 günü, 1400–2020-nin hər ili (xəritə seçimi, sağ olan şəxsiyyətlər, yaş və yer, hadisələr, hakimiyyətlər, dövr). 2026-11-13-də fərq yoxdur.

### Xəritənin əhatəsi: snapshot ən çox 30 il
- **Spesifikasiyadan fərq.** §10.3 `valid_from_year <= year <= valid_to_year` yazır. `valid_to_year` isə növbəti snapshot-a qədərdir. Belə olsa, 1520-nin xəritəsi 1699-a qədər doğru sayılardı.
- Frontend snapshot-ı ən çox 30 il keçərli sayır (`SNAPSHOT_REACH_YEARS`). `geo.api.Territories.REACH_YEARS` eyni qaydadır.
- Əhatəsiz ildə:
  - `/territories` ən yaxın snapshot-ı `covered: false` ilə verir (solğun çəkmək üçün), həmçinin keçid illərini (`prevYear`, `nextYear`);
  - `/polities/at` boş siyahı qaytarır.
- `valid_to_year` cədvəldə dəyişmir: o, "növbəti xəritəyə qədər" mənasındadır və `/territories`-in `snapshot` blokunda görünür.
- Məkanın mənsubiyyəti (`placeMembership`) frontend kimi son snapshot-ı yalnız öz ilinə aid edir. 1796-dan sonra boşluq yaranmır, sadəcə span bitir.

### Nöqtə sərhəddə də içəridədir
`ST_Contains` əvəzinə `ST_Intersects` istifadə olunur. Frontend-in `booleanPointInPolygon`-u da sərhədi içəri sayır. Üst-üstə düşən ərazilərin hamısı qaytarılır, müəllifin verdiyi sırada.

### `coverage`
- `FULL`: xəritə ili əhatə edir.
- `PARTIAL`: xəritə yoxdur, amma hökmdar, sağ şəxsiyyət və ya hadisə var.
- `NONE`: heç nə yoxdur. Frontend burada "Bu dövr üçün məzmun hazırlanır" yazır.

Spesifikasiya yalnız `NONE`-u adlandırır.

### Tarix indeksi sorğu zamanı hesablanır
`catalog.HistoryIndex` frontend-in `buildHistoryIndex`-inin SQL qarşılığıdır. Ayrıca cədvəl yoxdur. Hər çağırış bunlardan ibarətdir:
- bir addım sorğusu (sahib cədvəli ilə `LATERAL` birləşmə);
- dövrlər;
- məkan uyğunlaşdırması, ən çox üç sorğu (`PlaceMatcher`, ADR-0014 qaydaları).

Dövr və tema frontend-in `eraForYear` və `pickThemeId` qaydaları ilə seçilir. Sıralama `compareIndexed` kimidir.

`/places/{slug}/timeline` əvvəl namizədləri seçir:
- açıq `placeId`;
- adı eyni olan müharibə günü;
- 30,3 km daxilində qalan addımlar.

Sonra `PlaceMatcher` qərar verir. Başqa məkana daha yaxın addım düşmür, `/steps`-dəki kimi.

### Hökmdar paneli bütün hakimiyyətləri qaytarır
Hökmdar dərc olunmayıbsa, hakimiyyət yenə qaytarılır: `available: false`, yalnız slug və illər. Bu §10.3-ün "hamısını qaytar" qaydasına uyğundur. `end_year IS NULL` hakimiyyətin davam etdiyini bildirir.

### Müqayisə
- `a` və `b` istənilən simulyasiya sahibi ola bilər (`person`, `state`, `conflict`). Yeni rəqib (Sultan Səlim) əlavə olunanda kod lazım olmur.
- Kəsişmə §10.3-dəki kimidir:
  - eyni ildə eyni məkan və ya ≤ 25 km;
  - ya da eyni döyüşə istinad.
- Döyüşə istinad iki yerdən gəlir: addımın `BATTLE` keçidləri (`entity_relation`) və müharibə gününün özünün döyüş olması (`battle.step_key`).
- Döyüş kəsişməsi ildən asılı deyil. İki səbəbdən kəsişən cüt bir dəfə yazılır, `reasons: [PLACE, BATTLE]`.

### Axtarış hər modulun öz SPI-si ilə
- `shared.read.SearchSource`-u hər modul öz cədvəlləri üçün təqdim edir, `EntityDirectory` kimi. Catalog başqa modulun cədvəlini oxumur.
- Uyğunluq: `az_fold(q) <% az_fold(ad)` (pg_trgm word similarity, standart hədd 0,6), `az` və `en` adlar üzrə.
- Sıra: əvvəl `word_similarity`, bərabərlikdə bütöv adın `similarity`-si. Belə ki "Şah İsmayıl" "Səmədov İsmayıl Məhəmməd oğlu"-ndan əvvəl gəlir.
- **Spesifikasiyadan fərq:** axtarış səhifələnmir, ən yaxşı `limit` (≤ 50) nəticəni qaytarır. Axtarış qutusu üçün ikinci səhifənin mənası yoxdur.

### GeoJSON
- `/territories` `application/geo+json` FeatureCollection qaytarır. İl, `covered` və `snapshot` RFC 7946 §6.1 "foreign member"-ləridir.
- Koordinatlar 5 onluq işarə ilə verilir.
- `simplified=true` defoltdur. Sadələşdirilmiş geometriya yoxdursa, tam geometriya verilir.
- Cavab gzip ilə sıxılır (`server.compression`).

### Parametrlər
- `year` −5000…2100 aralığındadır, `lat`/`lng` Yer kürəsinin daxilində. `month`/`day` real təqvim günü olmalıdır, 29 fevral icazəlidir.
- Hər səhv `400` qaytarır və `parameter` sahəsi ilə səhv parametri göstərir.

## Nəticələr
- \+ Frontend API-yə keçəndə eyni cavabları alır. Bunu parity skripti yoxlayır.
- \+ Bütün sorğular sabit sayda SQL ilə işləyir. Testlər sayı yoxlayır, keşdə isə yalnız `content_version` oxunur.
- − `y2020` snapshot-u etibarsız poliqona görə dərc olunmayıb (§11-dəki data qeydi). Ona görə backend-də 2020 əhatəsizdir, frontend-də isə əhatəlidir.
- − Spesifikasiyadan iki fərq var: 30 illik əhatə və səhifələnməyən axtarış.
