# Yaşa görə portretlər: AI illüstrasiya promptları

Layihədə şəkil yaradan alət yoxdur. Bu fayl hər tarixi şəxsiyyət və yaş dövrü üçün hazır promptları saxlayır.
Şəkil hazır olanda faylı `public/portraits/` qovluğuna qoyun və `data/persons/<id>/person.json` içindəki uyğun `portraits` elementinə
`src`, `source`, `license` əlavə edin. O vaxta qədər portret kartında siluet və "rəssam təsəvvürü hazırlanır" yazısı görünür.

## Qaydalar

- **Yalnız tarixi şəxsiyyətlər.** Müasir real şəxslər (sərkərdələr, şəhidlər, siyasətçilər) üçün AI şəkli yaradılmır.
  `scripts/validate-data.ts` 1850-dən sonra doğulan şəxslər üçün `ai_illustration` qəbul etmir.
- **Həmişə işarəli.** `kind: "ai_illustration"` olan hər şəklin altında "Rəssam təsəvvürü (AI illüstrasiya)" yazılır. Bu yazı koddadır, silinmir.
- **Foto kimi görünməsin.** Üslub rəssamlıqdır (miniatür və ya yağlı boya), fotoreal deyil, ki, şagird onu sənəd kimi qəbul etməsin.
- **Zorakılıq yoxdur.** Qan, yara, döyüş səhnəsi, silahın kiməsə tuşlanması olmaz. Silah varsa, qınında və ya sakit vəziyyətdədir.
- **Fakta söykənən detallar.** Geyim və baş örtüyü dövrə uyğundur. Mənbələrdə olmayan xüsusi əlamətlər (çapıq, göz rəngi və s.) uydurulmur.
- **Ardıcıllıq.** Eyni şəxsin bütün yaşları üçün eyni üslub bloku, eyni kompozisiya (sinəyə qədər, üz azca sola), eyni işıq istifadə olunur.

## Texniki tələblər

- Ölçü: 4:5, ən azı 1200×1500 px. Kartda 60×75 kimi kəsilir, üz mərkəzdə olmalıdır.
- Format: `.webp` və ya `.jpg`, 300 KB-dan az.
- Fayl adı: `public/portraits/<promptId>.webp` (məsələn `public/portraits/shah-ismayil-child.webp`).
- `person.json`: `"src": "/portraits/<promptId>.webp"`, `"source": "<alət və versiya>"`, `"license": "AI illüstrasiya, layihə üçün yaradılıb"`.

### Ümumi üslub bloku (hər promptun sonuna əlavə edin)

> Painted portrait in the manner of a 15th–16th century Tabriz/Herat Persian miniature, reinterpreted as a modern book illustration:
> flat mineral pigments (lapis blue, vermilion, malachite green, gold leaf accents), fine ink outlines, soft even light, plain parchment
> background with a faint gold floral border. Head and shoulders, three-quarter view facing slightly left, calm dignified expression.
> Not photorealistic. No text, no letters, no watermark, no signature.

### Ümumi neqativ prompt

> photograph, photorealistic, 3D render, blood, wound, weapon pointed at viewer, battle, corpse, fire, gore, modern clothing,
> text, calligraphy, watermark, signature, extra fingers, distorted face, caricature

Nadir Şah üçün üslub blokunda "15th–16th century Tabriz/Herat Persian miniature" əvəzinə
"18th century Persian (Afsharid–Zand) oil portrait on canvas" yazın: onun dövründə portret yağlı boya ilə çəkilirdi.

---

## Şah İsmayıl Xətai (1487–1524)

23–37 yaş üçün dövrünün əsəri var (Behzada aid edilən portret). Ondan əvvəlki yaşlar AI illüstrasiyadır.
Venesiyalı tacirlərin təsvirlərinə görə üzü açıq rəngli idi, saqqalını qırxdırır, bığ saxlayırdı. Uşaqlıq portretlərində bığ yoxdur.

<a id="shah-ismayil-child"></a>
### shah-ismayil-child (0–6 yaş, Ərdəbil)

> A young boy of about five, son of the Safavid sheikh family of Ardabil, late 15th century. Round face, fair complexion, dark curious
> eyes, short dark hair under a small white cotton cap. Simple long tunic of undyed cotton with a pale blue sash. Behind him, softly
> suggested, the turquoise-tiled dome of the Sheikh Safi shrine in Ardabil. Gentle, slightly serious expression, as of a child who has
> already lost his father.

<a id="shah-ismayil-lahijan"></a>
### shah-ismayil-lahijan (7–13 yaş, Lahıcanda gizlənir)

> A boy of about eleven living in hiding in Lahijan, Gilan, in the 1490s, under the protection of a local ruler. Fair skin, dark eyes,
> attentive and thoughtful look, beardless. Plain dark green wool robe, white under-tunic, a simple wrapped white turban. Behind him
> green humid hills, rice terraces and a misty forest of the Caspian coast. Holds a small closed book, hinting at his later poetry.

<a id="shah-ismayil-young-shah"></a>
### shah-ismayil-young-shah (14–22 yaş, Təbrizdə tac)

> Shah Ismail at about fifteen, newly proclaimed shah in Tabriz in 1501. Fair skin, beardless face with the first light moustache,
> confident calm gaze. Wears the Qizilbash headgear: a tall red felt cap with twelve folds rising from a white turban wrap. Rich
> red-and-gold brocade robe over a white tunic, a gold belt. A curved sword rests sheathed at his side. Background: gold-leaf sky and
> the arches of a Tabriz palace.

---

## Uzun Həsən (təqr. 1423/1425–1478)

44–53 yaş üçün dövrünün miniatürü var (ov səhnəsi, 1460–1470-ci illər). Doğum ili mübahisəlidir, yaş aralıqları 1425-dən hesablanıb.
Venesiyalı səfirlər (Kontarini, Barbaro) onu çox hündür, arıq, xoş üzlü kimi təsvir edirlər. Başqa fərdi əlamət uydurmayın.

<a id="uzun-hasan-youth"></a>
### uzun-hasan-youth (0–26 yaş, Amid / Diyarbəkir)

> Hasan, a young prince of the Aq Qoyunlu Turkmen dynasty, about twenty, in Amid (Diyarbakir) in the 1440s. Tall and lean, long neck,
> dark hair, short young beard, alert eyes. Turkmen riding dress: a blue kaftan with a crossed front, red trim, leather belt, a white
> turban wrapped around a small red cap. Behind him the black basalt walls of Amid and the Tigris valley.

<a id="uzun-hasan-ruler"></a>
### uzun-hasan-ruler (27–43 yaş, Ağqoyunlu hökmdarı)

> Uzun Hasan, ruler of the Aq Qoyunlu, about forty, around 1467, after his victory made him master of Azerbaijan and Iran. Very tall,
> lean, pleasant composed face, full dark beard with first grey hairs. Large white turban with a jewelled aigrette, a long gold-embroidered
> crimson robe, a fur-lined mantle. Behind him the domes and minarets of Tabriz in gold-leaf light. Dignified, welcoming expression,
> as described by Venetian envoys.

---

## Nadir Şah Əfşar (1688–1747)

51–59 yaş üçün dövrünün portreti var (təqr. 1740). Ondan əvvəlki yaşlar AI illüstrasiyadır.
Dördtərəfli "Nadiri" papağını yalnız şahlıq dövründə (1736-dan) taxırdı, ona görə gənclik portretlərində yoxdur.

<a id="nadir-shah-youth"></a>
### nadir-shah-youth (0–17 yaş, Xorasan)

> Nadir as a poor teenage boy of the Afshar tribe in northern Khorasan, around 1704. Sun-tanned face, strong eyebrows, dark eyes,
> beardless. Simple brown sheepskin coat over a coarse cotton shirt, a felt cap. Behind him dry hills near Dastgird and a small flock
> of sheep. Determined, quiet expression. (Style: 18th century Persian oil portrait.)

<a id="nadir-shah-commander"></a>
### nadir-shah-commander (18–37 yaş, gənc sərkərdə)

> Nadir as a young commander of Khorasan in the 1710s–1720s, about thirty. Strong build, short dark beard, piercing eyes, weathered
> skin. Wears a simple steel helmet with a mail aventail over a dark red kaftan, a leather belt with a sheathed sword. Behind him the
> mountains around Kalat in evening light. Calm, resolute expression, no fighting. (Style: 18th century Persian oil portrait.)

<a id="nadir-shah-tahmasp-quli"></a>
### nadir-shah-tahmasp-quli (38–50 yaş, Təhmasibqulu xan)

> Nadir as Tahmasp Quli Khan, chief commander of the Safavid shah Tahmasp II, about forty-five, around 1733. Full dark beard,
> intense gaze, broad shoulders. Large white turban with a red Safavid cap, a richly embroidered green-and-gold robe, a jewelled dagger
> sheathed in the sash. Background: a campaign tent of red cloth and the Mughan plain beyond. Composed, authoritative expression.
> (Style: 18th century Persian oil portrait.)
