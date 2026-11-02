# Şəkillər: mənbələr və lisenziyalar

| Fayl | Nə göstərir | Mənbə | Lisenziya |
|---|---|---|---|
| `public/portraits/shah-ismayil.jpg` | Şah İsmayıl (Behzad və ya Məhəmmədi) | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Shah_Ismail_I_Safavid,_Behzad.jpg) | Public domain |
| `public/portraits/uzun-hasan.jpg` | Uzun Həsən, ov səhnəsi (detal) | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Uzun_Hasan_on_horse,_1460s%E2%80%931470s,_Aq_Qoyunlu_ruler_Uzun_Hasa_hunting_(detail).jpg) | Public domain |
| `public/portraits/nadir-shah.jpg` | Nadir Şahın müasir portreti, təqr. 1740 | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Contemporary_portrait_of_Nader_Shah._Artist_unknown,_created_in_ca._1740_in_Iran_(cropped).jpg) | Public domain |
| Azərbaycan bayrağı (`src/features/conflicts/Flag.tsx`) | Koddan çəkilmiş SVG, rəsmi rənglər (#00B5E2, #EF3340, #509E2F) | Layihə | Dövlət rəmzi; hörmətlə və dəyişdirilmədən istifadə olunur |
| Yaşa görə AI portretləri | Hələ yaradılmayıb: promptlar `docs/portrait-prompts.md`-dədir, kartda siluet göstərilir | | |
| Məkan ikonları, qərənfil, siluet | Koddan çəkilmiş SVG | Layihə | Layihənin öz işi |

## Dövr temalarının fon şəkilləri (`data/themes`)

Hamısı The Met Open Access kolleksiyasındandır. Hər obyekt üçün API-də `isPublicDomain: true` yoxlanılıb (CC0 1.0).
Faylları orijinaldan kəsib 1400 və 700 px enində AVIF və WebP formatına çevirmişik. Səhifədə bulanıq və solğun fon kimi göstərilir.
İlkin namizədlərdən biri (Met 446553, XV əsr antologiyası) uşaq auditoriyasına uyğun olmayan səhnəyə görə çıxarılıb.

| Fayl | Nə göstərir | Mənbə | Lisenziya |
|---|---|---|---|
| `public/backgrounds/turkman-khamsa` (`.avif`, `.webp`, `-sm`) | Nizami Gəncəvinin «Xəmsə»sindən səhifə, XV əsr, Şiraz (rəsm hissəsi kəsilib) | [The Met, 13.228.9.1](https://www.metmuseum.org/art/collection/search/455024) | CC0 1.0 |
| `public/backgrounds/safavid-feast-of-sada` | «Sədə bayramı», Şah Təhmasibin «Şahnamə»si, Təbriz, təqr. 1525 | [The Met, 1970.301.2](https://www.metmuseum.org/art/collection/search/452111) | CC0 1.0 |
| `public/backgrounds/afshar-stallion` | «At portreti», İran, XVIII əsr | [The Met, 14.84](https://www.metmuseum.org/art/collection/search/446656) | CC0 1.0 |
| `public/backgrounds/mughal-shahbarghan` | «Şahbərğan döyüşü», «Padşahnamə», Moğol Hindistanı, XVII əsr (Hind yürüşü variantı) | [The Met, 1986.283](https://www.metmuseum.org/art/collection/search/453276) | CC0 1.0 |
| 2020 teması: Qarabağ dağları və Şuşa qayaları | Koddan çəkilmiş SVG (`src/features/theme/KarabakhMountains.tsx`), qravür üslubunda | Layihə | Layihənin öz işi |
| Ornamentlər (girih, islimi, səkkizguşəli ulduz, çərçivələr) | Koddan çəkilmiş SVG (`src/features/theme/ornaments.tsx`) | Layihə | Layihənin öz işi |

AI ilə yaradılacaq fon illüstrasiyaları üçün hazır promptlar `docs/background-prompts.md`-dədir.
Belə şəkil əlavə olunanda temada `kind: "ai_illustration"` yazılır və səhifədə "Rəssam təsəvvürü (AI illüstrasiya)" qeydi göstərilir.

**Qaydalar.** Müasir real şəxslərin (sərkərdələr, şəhidlər) fotoları yalnız rəsmi mənbədən, icazəsi və lisenziyası aydın olanda əlavə olunur
(`Hero.photo: { url, source, license, permissionNote }`). Onlar üçün AI ilə şəkil yaradılmır. Tarixi şəxsiyyətlər üçün AI illüstrasiyaları
yalnız aydın işarə ilə ("Rəssam təsəvvürü (AI illüstrasiya)") istifadə olunur, bax `docs/portrait-prompts.md`.
