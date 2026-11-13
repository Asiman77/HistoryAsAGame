# 0014. İctimai oxuma API-si: kontekst, keş, keçidlər, sorğu zamanı məkan

Tarix: 2026-11-13 · Status: Qəbul

## Kontekst
BACKEND_SPEC.md §10 ictimai API üçün ümumi qaydalar verir: dil seçimi (`?lang`, `Accept-Language`, `az`-a qayıtma), `ETag: "cv-{content_version}"` və `304`, `Cache-Control`, səhifələmə, Problem Details, köhnə slug üçün `301` və yalnız icazəli media. §14 Caffeine keşi tələb edir, açarı `content_version` olsun və dərcdə tam təmizlənsin. Oxuma beş modulun cədvəllərinə yayılıb (catalog, geo, chronology, theming, media), Modulith isə modulların bir-birinin daxilinə girməsinə icazə vermir. `publishing` bütün bu modullardan asılıdır, ona görə onlar `publishing`-in event-ini dinləyə bilməzlər (dövrü asılılıq yaranardı).

## Qərar

### Hər controller-ə ortaq dəstək (`shared.web`, `shared.read`)
- İctimai controller `@PublicApi` ilə işarələnir. Qalan hər şeyi interceptor və controller advice edir:
  - dil və `content_version` sorğuda **bir dəfə** oxunur və handler-ə `ReadContext` arqumenti kimi verilir;
  - `If-None-Match` uyğun gəlirsə, `304` kontent cədvəllərinə toxunmadan qaytarılır;
  - uğurlu cavaba `ETag`, `Cache-Control: public, max-age=300, stale-while-revalidate=86400`, `Vary: Accept-Language` və `Content-Language` əlavə olunur;
  - xətalar Problem Details olur və `no-store` alır;
  - tapılmayan slug `slug_redirect`-də varsa, `301` qaytarılır və URL-in qalanı (alt yol, query) saxlanılır.
- **ETag spesifikasiyadan fərqlidir:** `W/"cv-{version}-{lang}"`. Eyni URL `Accept-Language`-ə görə fərqli cavab verir, ona görə dil validatorun bir hissəsidir. Validator zəifdir (`W/`), çünki gzip ilə sıxılmış və sıxılmamış cavab eyni məzmundur.
- **Dil:** `?lang` `az|en|ru|all` ola bilər. Naməlum dəyər `400` verir. `Accept-Language` RFC 4647 lookup ilə uyğunlaşdırılır, naməlum dil isə səhv sayılmır və `az` götürülür. Lokallaşdırılmış sahələr sətir olur, `all` olanda `{az, en, ru}` obyekti. Sərbəst JSON-da (addımın `details`-i, `epigraph`, `finalNotes`…) `LocalizedText` formalı hər obyekt istənilən dərinlikdə əvəz olunur. Bu forma: açarları iki hərfli dil kodlarıdır, dəyərləri sətirdir və `az` mütləq var.
- **Səhifələmə:** siyahılar `{items, page, size, totalElements}` qaytarır (`size` ≤ 100). Ümumi say sətirlərlə birlikdə `count(*) OVER ()` ilə gəlir. `/eras` səhifələnmir, çünki dövrlər bir neçədir.

### Keş
- `PublicCache` (Caffeine, 20 000 element, 1 saat istifadəsiz qalanda silinir) açarı `(content_version, dil, sorğu, arqument)`-dir. Dərc versiyanı artırır, ona görə köhnə məzmun heç vaxt verilmir. Daha yeni versiya ilk dəfə görünəndə bütün keş silinir (§14-dəki "dərcdə tam təmizlənir" qaydası).
- Bunun üçün event dinləyicisi lazım deyil. Oxuyan modullar `ContentProjected`-i dinləyə bilməzdi (yuxarıdakı dövrü asılılıq səbəbindən). Bunun qiyməti hər sorğuda bir dəfə `content_version` oxumaqdır, onsuz da ETag üçün lazımdır.
- `404` keşlənmir.
- Metriklər: `cache.*{cache="public-api"}` (Micrometer).

### Modullar arası oxuma
- **Keçidin hədəfi** (`EntityRef` hələ dərc olunmamış ola bilər, §5.3). `shared.read.EntityDirectory` SPI-dir. Hər modul öz tiplərini ona təqdim edir: catalog `PERSON, CONFLICT, BATTLE, STATE, HERO`, geo `PLACE`, chronology `ERA, POLITY, RULER`. `EntityLinks` hər tip üçün **bir** sorğu ilə hədəfin dərc olunub-olunmadığını və adını tapır. Dərc olunmayan hədəfin adı `planned_entity`-dən (`PlannedTitles`, catalog), o da yoxdursa keçidin öz `label`-ından götürülür.
- Keçid `ApiLink` formasındadır: `{type, slug, stepKey, relation, direction, available, name, label, note, fromStepKey, sources}`. `available: false` passiv keçiddir. `direction` göstərir ki, keçid bu entity-nin sənədində yazılıb (`OUTGOING`), yoxsa başqa sənəddən buraya gəlir (`INCOMING`). Spesifikasiyadakı "aktiv/passiv bayrağı" hər iki mənada ödənilir.
- **Məkan** (ADR-0012: sorğu zamanı hesablanır, mərhələ 9-dan buraya çəkildi, çünki addımın `location.slug`-ı onsuz olmur). `geo.api.PlaceLookup` hər qayda üçün **bir** toplu sorğu verir. Qaydalar frontend-dəki kimidir:
  - əvvəl açıq `placeId`;
  - müharibə günləri üçün eyni ad (`" (…)"` hissəsi atılır);
  - qalan addımlar və doğum/ölüm yeri üçün 30 km daxilində ən yaxın məkan. Məsafə frontend-in `distanceKm` düsturu ilə (R = 6371 km) hesablanır, ona görə sərhəddə də eyni nəticə çıxır.
  - Bir neçə məkan eyni ada uyğun gəlsə: frontend fayldakı ilk məkanı götürür, backend isə ən vacibini, sonra slug-a görə.
- **Portret:** `media.api.Portraits`. Yaşa görə seçim frontend-in `pickPortrait`-i ilə eynidir: yaş aralıqdadırsa həmin portret, yoxsa ən yaxın aralıq, bərabərlikdə birincisi. Catalog modulu `media :: api`-dən asılı olur.
- Addımların sayından asılı olmayaraq hər sorğu sabit sayda SQL işlədir: addımlar, iddialar, iki mənbə sorğusu, keçidlər, hər hədəf tipinə bir, məkan, portretlər. Test bunu sayır (`QueryCounter`).

### Media (mərhələ 11-ə qədər)
Şəkillər hələ kontentin içindədir (V011). İctimai API şəkli yalnız lisenziyası ADR-0010-a görə ictimai olanda verir (`PermissionStatus.fromLicense`, idxalla eyni qayda). Əks halda:
- kart və profil şəkli `null` olur;
- tema fon şəkli siyahıdan çıxarılır;
- yaş portreti yer tutucuya çevrilir (`url: null`).

AI illüstrasiya həmişə `disclosure` ilə gəlir. URL-lər saytın kökünə nisbidir (`/portraits/…`), media reyestri gələndə dəyişəcək.

### OpenAPI
springdoc 3.2 istifadə olunur.
- `/v3/api-docs/public` və `/v3/api-docs/internal` qruplara bölünüb, Swagger UI `/swagger-ui.html`-dədir. Hamısı autentifikasiyasız oxunur.
- Hər ictimai əməliyyat `lang`, `Accept-Language` və `If-None-Match` parametrlərini sənədləşdirir.
- `ReadContext` sorğu parametri kimi görünmür.

## Nəticələr
- \+ Controller-lər yalnız oxuyur. Keş, ETag, dil və xəta formatı bir yerdədir və bütün ictimai endpoint-lərdə eyni işləyir.
- \+ Qeyri-dərc hədəf xəta deyil: dərc olunan kimi keçid özü aktivləşir.
- − Hər sorğu, `304` də daxil, bir `content_version` sorğusu edir.
- − Eyni ada uyğun gələn bir neçə məkan olanda nəticə frontend-dən fərqli ola bilər. Bu gün belə hal yoxdur.
