# Dövr temaları: fon illüstrasiyaları üçün promptlar

Hər dövr temasının (`data/themes/<id>.json`) `backgroundArt` siyahısı var. Hazırda XV əsr, Səfəvi, Əfşar və Hind yürüşü üçün
The Met kolleksiyasından CC0 miniatürlər istifadə olunur (bax `docs/IMAGE_CREDITS.md`). 2020 üçün isə layihənin öz SVG illüstrasiyası var.
Bu fayl həmin şəkilləri əvəz etmək və ya yeni variant əlavə etmək üçün hazır promptları saxlayır.

## Necə əlavə etməli

1. Şəkli yaradın və ən azı 2400 px enində saxlayın. Kompozisiya geniş olsun: mərkəzdə boşluq qalsın, çünki fon həmişə məzmunun arxasında bulanıq görünür.
2. AVIF və WebP formatına çevirin (1400 və 700 px): `public/backgrounds/<ad>.avif`, `<ad>.webp`, `<ad>-sm.avif`, `<ad>-sm.webp`.
3. Temaya element əlavə edin:
   `{ "src": "/backgrounds/<ad>", "kind": "ai_illustration", "title": {...}, "source": "<alət, versiya>", "license": "AI illüstrasiya, layihə üçün yaradılıb", "promptId": "<id>" }`.
4. `docs/IMAGE_CREDITS.md`-yə sətir əlavə edin. `npm run validate:data` faylların və qeydin mövcudluğunu yoxlayır.
5. `kind: "ai_illustration"` olan şəklin altında "Rəssam təsəvvürü (AI illüstrasiya)" qeydi avtomatik göstərilir.

## Qaydalar

- **İnsan üzü ön planda olmasın.** Fon atmosfer üçündür, portret deyil. Real tarixi şəxsiyyətləri tanınan şəkildə çəkməyin.
- **Zorakılıq yoxdur.** Qan, yara, ölü bədən olmaz. Döyüş fonu uzaqdan, kütlə və bayraqlarla verilir.
- **Mətn yoxdur.** Hərf, imza, su nişanı olmasın. Şəkil üzərində yazı uydurma xəttatlıq kimi görünə bilər.
- **Müasir dövr (2020) üçün real insan, şəhid, əsgər təsviri yaradılmır.** Yalnız mənzərə, memarlıq və simvollar.
- **Rəng.** Tema palitrası ilə uyğun olsun (aşağıda hər prompta yazılıb). Çox kontrastlı, parlaq ağ sahələrdən qaçın: fon solğun göstərilir.

### Ümumi üslub bloku (tarixi dövrlər üçün hər promptun sonuna əlavə edin)

> Wide landscape composition, 16:9, calm open centre for overlaid text. Not photorealistic. No text, no letters, no calligraphy,
> no watermark, no signature. No blood, no wounded or dead figures. Faces small and distant.

---

<a id="turkman-tebriz"></a>
## XV əsr: Ağqoyunlu və Qaraqoyunlu (Təbriz miniatür məktəbi)

Palitra: lacivərd (#1f3f6e), qızılı (#a8812a), köhnə əlyazma kağızı (#efe4c9).

> A panoramic landscape in the manner of a late 15th-century Turkman Tabriz manuscript painting: rolling hills rendered as
> spongy clusters of pale green and ochre, a winding river in silver-blue, poplar and plane trees with dense stylised foliage,
> a distant walled city with blue-tiled domes and a tall portal decorated with geometric girih tile patterns in lapis and turquoise,
> small tents of a tribal summer camp on a meadow, horsemen as tiny figures far away. Gold sky with swirling Chinese-style cloud bands.
> Paper texture of an aged manuscript leaf, slight foxing at the edges, thin ruled gold and blue border lines.

<a id="sefevi"></a>
## XVI əsr: Səfəvi (saray miniatürü)

Palitra: qızılbaş qırmızısı (#a3221d), firuzəyi (#1f7a74), qızılı, perqament (#f1e3c6).

> A sumptuous court garden in the manner of an early 16th-century Safavid Tabriz miniature (school of Sultan Muhammad):
> a pavilion with turquoise and cobalt tile revetment and calligraphic-looking but illegible ornamental bands, a spread palace carpet
> with a central medallion and arabesque (islimi) scrolls, cypress and blossoming fruit trees, pink and purple rocky outcrops with
> hidden grotesque faces, a stream with silver water, distant riders wearing red Qizilbash taj caps with a tall baton (small, far away).
> Rich mineral pigments, gold sky, illuminated floral border with cloud bands.

<a id="efshar"></a>
## XVIII əsr: Əfşar (hərbi düşərgə)

Palitra: tünd qırmızı (#7a1f1a), tunc (#8a6a3c), çadır kətanı (#e8ddcb).

> A vast military encampment at dusk on a high plateau in the manner of an 18th-century Persian lacquer and oil painting:
> rows of canvas tents with dark red and bronze stripes, campfires with thin smoke, tethered horses, cannons on wooden carriages
> standing idle, standards with plain red and green banners (no inscriptions), snowy mountains of Khorasan on the horizon.
> Restrained, austere palette of bronze, rust and dark red; varnished lacquer sheen, fine craquelure.

<a id="efshar-hind"></a>
## 1739: Hind yürüşü (Moğol təsirli variant)

Palitra: tünd qırmızı (#8a2b1d), Moğol qızılısı (#9a6f17).

> A wide view of the plain near Delhi in the manner of an 18th-century Mughal painting: the red sandstone walls and domed gateways
> of Shahjahanabad in the distance, the Yamuna river, an approaching army as a sea of tiny tents, elephants with howdahs and banners
> far away, flat gold-white sky, delicate trees with individual leaves, a floral border with gold flowers on a deep red ground.
> Calm, no fighting.

<a id="muasir-zefer"></a>
## 2020: 44 günlük Vətən müharibəsi (müasir, təmiz)

Palitra: bayraq rəngləri (mavi #00b5e2, qırmızı #ef3340, yaşıl #509e2f), dəniz mavisi (#0a5c8a), açıq boz fon (#f3f5f7).
Hazırda bu fon kodda SVG kimi çəkilir (`src/features/theme/KarabakhMountains.tsx`). Aşağıdakı prompt daha zəngin variant üçündür.

> A clean, modern engraving-style illustration of the Karabakh mountains at early morning: layered ridges fading into soft blue-grey mist,
> the sheer limestone cliffs of Shusha on the right rendered with fine horizontal hatching like a banknote or stamp engraving,
> the silhouette of a historic town with two slender minarets on the plateau above the cliffs, a faint eight-pointed star rising like a sun
> behind the hills. Minimal palette of navy and slate with one restrained accent of flag blue. No people, no soldiers, no weapons,
> no flags with text. Vector-like precision, generous empty sky.
