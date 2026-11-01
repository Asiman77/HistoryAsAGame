# Dövrə uyğun siyasi xəritə

Bütün sərhədlər **təxminidir** və UI-da belə işarələnir. Orta əsrlərdə dövlət sərhədi dəqiq xətt deyildi:
hakimiyyət qalalar, şəhərlər, yollar və tayfaların sədaqəti üzərində qurulurdu.

## Fayllar

| Fayl | Nə saxlayır |
|---|---|
| `registry.json` | `bbox`, dövlətlər (`polities`: id, ad, rəng, bütün snapshot-larda eyni) və regionlar (`regions`: Voronoi "toxum" nöqtələri) |
| `snapshots/<id>.json` | Bir il üçün: hansı dövlət hansı regionlara sahibdir, paytaxt (`capitalId` → `data/places.json`), vassallıq (`vassalOf`), mənbələr |
| `land.json` | Sahil maskası: Natural Earth 1:50m land + lakes (public domain), bbox-a kəsilib və sadələşdirilib |

`scripts/build-territories.ts` (`npm run dev` və `npm run build`-dan əvvəl avtomatik işləyir) bunları birləşdirir:
bütün toxumlar üzərində bir Voronoi diaqramı qurur, hər dövlətin regionlarını birləşdirir, quru ilə kəsir,
`turf.simplify` ilə sadələşdirir və hər snapshot-u ayrıca `public/data/territories/<id>.json` faylına yazır (~25–32 KB).
Brauzer faylı yalnız lazım olanda yükləyir, növbəti mərhələnin snapshot-unu isə əvvəlcədən yükləyir.

Snapshot-un real GeoJSON-u varsa, gələcəkdə region əvəzinə birbaşa `geometry` də dəstəklənə bilər. Brauzerə gedən format (`TerritorySnapshot`) artıq GeoJSON-dur.

## Hadisəyə bağlanma

`LifeEvent.territorySnapshotId` göstərilibsə, o istifadə olunur. Yoxdursa, `src/lib/territory.ts` hadisə ilindən
**əvvəlki ən yaxın** snapshot-u seçir (xəritə nəticəni hadisədən əvvəl göstərməsin deyə). O 60 ildən köhnədirsə, ən yaxın snapshot götürülür.

## Niyə `historical-basemaps` istifadə olunmayıb

[aourednik/historical-basemaps](https://github.com/aourednik/historical-basemaps) yoxlanılıb:

- Lisenziyası **GPL-3.0**-dır. Datanı layihəyə daxil etmək bütün paylanan nəticəni GPL şərtlərinə bağlayardı.
- Lazımi anlar üçün dəqiqlik çatmır: 1400 və 1492 snapshot-ları arasında Qaraqoyunlu yoxdur, Şirvanşahlar və Əfşarlar ayrıca göstərilmir, 1700-dən sonra Səfəvi sərhədləri əfqan, Osmanlı və rus işğallarını əks etdirmir.

Ona görə sadələşdirilmiş poliqonlar layihə daxilində hazırlanıb. Sahil xətti Natural Earth-dən götürülüb (public domain).

## Yeni snapshot əlavə etmək

1. `snapshots/y<il>.json` yaradın (fayl adı `id` ilə eyni olmalıdır). Region id-ləri `registry.json`-dakı regionlardır, bir region yalnız bir dövlətdə ola bilər.
2. Lazım olan yeni dövləti `registry.json`-a əlavə edin. Region kifayət qədər dəqiq deyilsə, yeni region və ya əlavə toxum nöqtəsi əlavə edin.
3. `npm run validate:data && npm run build:territories`.
