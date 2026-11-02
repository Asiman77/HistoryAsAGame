# Araşdırma qeydləri

Bu sənəd `data/` qovluğundakı faktların hansı mənbələrə əsaslandığını və hansı məqamların mübahisəli olduğunu izah edir.
Hər hadisənin öz `sources[]` siyahısı var. Burada isə ümumi mənzərə və qərarların səbəbləri verilir.

## Ümumi prinsiplər

- **Fakt və bədii mətn ayrıdır.** `factualSummary` yalnız mənbələrlə təsdiqlənən məlumatı ehtiva edir.
  `narrative` birinci şəxsdə yazılmış bədii mətndir. Orada dialoq, hiss və təfərrüat uydurmadır və UI-da belə işarələnir.
  Şəxsiyyət kartlarındakı `epigraph` mətnləri də bədiidir, sitat deyil.
- **Təqvim.** Bütün tarixlər Qriqori təqvimindədir. Hicri tarixlər yalnız qeydlərdə verilir.
  1739-cu ildə Britaniya mənbələri Yuli təqvimindən istifadə edirdi, buna görə Karnal döyüşü üçün 13 fevral və 24 fevral kimi iki tarix rast gəlinir.
- **`certainty`.**
  - `exact`: mənbələr arasında ixtilaf yoxdur.
  - `approximate`: dəqiq tarix və ya yer məlum deyil, il təxminidir.
  - `disputed`: nüfuzlu mənbələr bir-biri ilə ziddiyyət təşkil edir. Alternativlər `alternatives[]`-də verilir.
- **Rəqəmlər.** Qoşun sayları və itkilər salnamələrdə çox vaxt şişirdilir. Biz diapazon veririk və "təqr." yazırıq.
- **Yerlər.** Döyüş meydanlarının dəqiq yeri çox vaxt məlum deyil. Belə nöqtələr `approximate: true` ilə işarələnib.
  Yer adı hadisənin dövründəki adla verilir (məs. Amid, Şahcahanabad), müasir ad isə `modernName`-dədir.

## Əsas mənbələr

| Mənbə | Növ | İstifadə |
|---|---|---|
| R. Savory, *Iran under the Safavids*, Cambridge UP, 1980 | kitab | Şah İsmayıl |
| V. Minorsky, "The Poetry of Shāh Ismāʿīl I", *BSOAS* 10/4, 1942 | məqalə | Xətai poeziyası |
| J. E. Woods, *The Aqquyunlu: Clan, Confederation, Empire*, 1999 | kitab | Uzun Həsən |
| *Travels to Tana and Persia* (Barbaro, Contarini), Hakluyt Society, 1873 | ilkin mənbə | Venesiya diplomatiyası |
| M. Axworthy, *The Sword of Persia*, I.B. Tauris, 2006 | kitab | Nadir Şah |
| Encyclopaedia Iranica (Savory: "Esmāʿīl I"; Tucker: "Nāder Shah") | ensiklopediya | hər üçü |
| Encyclopaedia Britannica (bioqrafik məqalələr) | ensiklopediya | doğum/ölüm tarixləri |
| İngilisdilli Wikipedia (döyüş məqalələri) | ensiklopediya | tarix, qoşun sayı, ədəbiyyat siyahıları üçün başlanğıc nöqtəsi |

> Qeyd: Wikipedia məqalələri ikinci dərəcəli mənbə kimi istifadə olunub. Onların istinad etdiyi akademik əsərlər (Savory, Woods, Axworthy)
> ayrıca göstərilib. Encyclopaedia Iranica avtomatik sorğulara 403 qaytardığından onun mətnləri birbaşa yoxlanmayıb.
> Iranica istinadları yalnız ümumi mənbə kimi verilib. Məktəb istifadəsindən əvvəl tarixçi müəllimin bir dəfə nəzərdən keçirməsi tövsiyə olunur.

## Şah İsmayıl Xətai

**Mübahisəli məqamlar**

| Məqam | Versiyalar | Datada qərar |
|---|---|---|
| Atası Heydərin ölüm tarixi | 9 iyul 1488 (əksəriyyət). Fərrux Yasar məqaləsində 9 iyun | 9 iyul, `approximate` |
| Rüstəmlə qırılma və Əli Mirzənin ölümü | 1493 / 1494 | 1494, `disputed` |
| Lahicandakı müəllimi | Səfəvi salnamələri Şəmsəddin Lahicini göstərir. Bir məqalə bunu əfsanə sayır | Faktda "salnamələrə görə", müzakirə qeyd olunub |
| Taxta çıxma tarixi | 1501-ci ilin yayı (Təbrizin tutulması) / 22 dekabr 1501 (yalnız Qasım bəy Heyati) | 22 dekabr, `disputed` + alternativ |
| Cabanı döyüşünün yeri | Cabanı (Şamaxı yaxınlığı) / Gülüstan | Cabanı, `approximate` yer |
| Çaldıranda qoşun sayı | Osmanlı 60–100 min, Səfəvi 40–80 min | diapazon |
| Çaldıranda "hücum etməmək" qərarı | Sonrakı salnamələrə əsaslanan rəvayət | Seçim anında rəvayət olduğu açıq yazılıb |
| Ölüm yeri | Təbriz yaxınlığı (Wikipedia) / Ərdəbil (Britannica) / Mankutay, Sayın keçidi yaxınlığı (Türkiyat Mecmuası, 2023) | Təbriz yaxınlığı, `approximate`. Bütün versiyalar faktda sadalanıb |
| Ölüm yaşı | 36 (hesablanmış) / 37 / 38 | Yaş avtomatik hesablanır: 36 |
| Behzad portretinin müəllifi | Behzad / Məhəmmədi | Hər ikisi `portrait.author`-da |

**Daxil edilməyənlər:** Lahicanda "Şahnamə" hədiyyəsi barədə məlumat (tək mənbəyə əsaslanır, yaşla uyğunsuzdur) və 1512-ci il Qəcdüvan döyüşü (İsmayıl şəxsən iştirak etməyib).

## Uzun Həsən

| Məqam | Versiyalar | Datada qərar |
|---|---|---|
| Doğum ili | 1423 (Britannica) / 1425-ci ilin fevral–martı (Woods) | 1425, `disputed`, alternativ 1423 |
| Hakimiyyətə gəliş | Sentyabr 1452 (Woods) / 1453 (Britannica) | 1452, `disputed` |
| Despina ilə nikah | 1457–1459, ehtimal ki, 1458 | 1458, `approximate` |
| Sara xatunun səfirliyi | 1461 (Trabzon yürüşü) / 1463 | 1461, `approximate` |
| Cahanşahın məğlubiyyəti | 30 oktyabr / 10 noyabr / 11 noyabr 1467. Çapaqçur / Muş | 11 noyabr, Çapaqçur, `disputed` |
| Əbu Səidin edamı | 5 fevral / 8 fevral 1469 | Döyüş 4 fevral (`exact`), edam qeyd kimi |
| Fərat sahili döyüşü | Wikipedia-da "Battle of Malatya", koordinatlar isə Tərcan–Otluqbeli bölgəsini göstərir | Yer "Fərat sahili (Tərcan yaxınlığı)", ad izah olunub |
| Otluqbelidə qoşun sayı | Ağqoyunlu: 70 min–300 min | "mənbələr ziddiyyətlidir" |
| Ölüm tarixi | 2 / 5 / 6 yanvar 1478 | 5 yanvar, `disputed` |
| Sara xatunun atası | Pir Əli Bayandur (Woods) / Əhməd b. Qutlunun qızı (digər versiya) | Faktda göstərilməyib |

## Nadir Şah Əfşar

| Məqam | Versiyalar | Datada qərar |
|---|---|---|
| Doğum tarixi | 22 oktyabr 1688 (Britannica) / noyabr 1688 (Iranica) / 6 avqust 1698 | 22 oktyabr 1688, `disputed` |
| Doğum yeri | Dəstgerd qalası (Dərəgəz) / Kobhan | Dəstgerd, Kobhan faktda qeyd olunub |
| Özbək əsirliyi (təq. 1704–1708) | Mənbələrdə "iddia olunur", təsdiqlənməyib | `disputed`, rəvayət kimi təqdim olunur. Yer məlum olmadığı üçün xəritədə Dərəgəzdə qalır |
| Damğan döyüşü | 29 sentyabr – 5 oktyabr 1729 | Başlanğıc tarixi + qeyd |
| Muğan qurultayı | Yanvar / fevral 1736. İştirakçılar 20 min / 100 min | Tacqoyma 8 mart 1736 (`exact`) |
| Qəndəharın süqutu | 24 / 25 mart 1738 | 24 mart, `approximate` |
| Karnal | 13 fevral (Yuli) = 24 fevral (Qriqori) 1739 | 24 fevral + izah. Bu, quiz sualıdır |
| Dehli qırğınının qurbanları | 20–30 min (ən çox qəbul edilən). Bəzi iddialar 100 min+ | 20–30 min |
| Əndəlal (1741) | Wikipedia: ilkin mənbələrdə meydan döyüşü yoxdur. Rus tədqiqatı (Musayev, 2022): ağır məğlubiyyət | `journey` tipi, hər iki baxış faktda |
| Qars döyüşü (1745) | Infobox: Qars. Mətn: Yegevard (Bağavərd) yaxınlığı | Bağavərd yaxınlığı, `approximate` |
| Ölüm tarixi | 19 / 20 / 21 iyun 1747 | 20 iyun, `disputed` |
| Sui-qəsdin təşkilatçısı | Əliqulu xan / naməlum | "mübahisəlidir" |

**Yoxlanmamış, data-ya daxil edilməyən:** Muğan qurultayında Qarabağ bəylərinin etirazı (yalnız zəif mənbədə rast gəlindi).

## Fakt və rəvayət təsnifatı (`claimType`)

Hər addım standart olaraq `fact` sayılır: `factualSummary` yalnız mənbəli məlumatdır, `narrative` isə həmişə `literary`-dir.
Ayrı-ayrı ifadələr `claims[]`-də təsnif olunur. Validator qaydaları belədir:
- `fact` mənbəsiz ola bilməz.
- `legend` üçün ilk qeyd (`firstRecorded`) və izah (`why`) məcburidir.
- `disputed` üçün ən azı iki mənbəli versiya lazımdır.
- Addım bütövlükdə `legend` və ya `disputed` işarələnibsə, eyni növdən iddia olmalıdır.

Bu mərhələdə üç şəxsiyyətin uşaqlıq və gənclik rəvayətləri xüsusi axtarıldı (noyabr 2026):

| İddia | Növ | Əsas | Qeyd |
|---|---|---|---|
| Mirzə Əli İsmayılı səbətdə ağacdan asıb "Gilan torpağında deyil" deyə and içir | `legend` | APA (Z. Bünyadovun «Azərbaycan tarixi», s. 398 istinadı ilə), Azernews (2017, "beşik" variantı) | Səfəvi dövrünün mənbəsində tapılmadı. Ən erkən yazılı qeyd müəyyənləşdirilmədi və bu, datada açıq yazılıb |
| Lahicanda müəllimi Şəmsəddin Lahici idi | `disputed` | WikiShia (salnamələrə əsasən) / magiran məqaləsi ("Fact or Legend") | |
| Şeybaninin kəlləsindən qızıl qədəh | `fact` | D. Morgan, *Medieval Persia* (2014), Wikipedia "Battle of Marv" | Babura göndərilməsi barədə xəbər yoxlanmadığı üçün daxil edilmədi |
| Çaldıranda erkən hücum təklifinin rədd edilməsi | `fact` | Savory (2007, s. 41), Iranica "ČĀLDERĀN" | "Mən karvan quldurı deyiləm" sözləri yalnız "deyilənə görə" kimi rast gəlindi, daxil edilmədi |
| Nadirin özbək əsirliyi (1704) | `legend` (addım da `legend`) | Axworthy (2006, s. 52) | İkinci variant: türkmənləri kömək vədi ilə razı salır. Ən erkən XVIII əsr qeydi yoxlanmayıb |
| Nadirin atası çoban idi | `fact` | Axworthy (2006, s. 17) | Kürkçülük yalnız ehtimaldır, ayrıca iddia kimi verilmədi |
| Sara xatun ilə Mehmedin "oğlum / ana" müraciəti | `fact` | Minorsky (EI², X), Runciman (1990), Osmanlı salnaməçilərinə istinadla | |
| «Dədə Qorqud» Ağqoyunlu sarayında yazıya alınıb | `disputed` | Lewis, Kafadar, Shaw (Wikipedia "Book of Dede Korkut" vasitəsilə) | |

**Uzun Həsən haqqında** mənbəli bir xalq rəvayəti tapılmadı. Ağqoyunlu dövrü ilə bağlı yeganə mübahisəli məqam «Dədə Qorqud» fərziyyəsidir.
Nadirin ölümündə Əliqulu xanın rolu (`RESEARCH_NOTES` yuxarıda) mənbəli versiyalar toplanana qədər `claims`-ə əlavə edilmədi.

## Portretlər

| Fayl | Lisenziya | Mənbə |
|---|---|---|
| `public/portraits/shah-ismayil.jpg` | Public domain | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Shah_Ismail_I_Safavid,_Behzad.jpg) |
| `public/portraits/uzun-hasan.jpg` | Public domain | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Uzun_Hasan_on_horse,_1460s%E2%80%931470s,_Aq_Qoyunlu_ruler_Uzun_Hasa_hunting_(detail).jpg) |
| `public/portraits/nadir-shah.jpg` | Public domain | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Contemporary_portrait_of_Nader_Shah._Artist_unknown,_created_in_ca._1740_in_Iran_(cropped).jpg) |

## Siyasi xəritə (sərhəd snapshot-ları)

Sərhədlər ensiklopedik xəritələrə və ümumi tarixə əsaslanan **təxmini** rekonstruksiyadır (hər snapshot-un `sources[]` siyahısı var).
Ən qeyri-müəyyən anlar `certainty: "disputed"` ilə işarələnib:

| Snapshot | Niyə qeyri-müəyyəndir |
|---|---|
| 1468 | Cahanşahın ölümü ilə Əbu Səidin məğlubiyyəti arasında sərhədlər aylar ərzində dəyişirdi. Qaraqoyunlu qalıqları cənubda sadələşdirilmiş şəkildə verilib |
| 1726 | Əfqan, Osmanlı və rus işğalları ölkəni parçalamışdı. II Təhmasibin nəzarəti və Sistan kimi bölgələr dəqiq müəyyən deyil |

Digər sadələşdirmələr:
- Şirvanşahların XV əsrdə paytaxtının Şamaxı, yoxsa Bakı olduğu mənbələrdə birmənalı göstərilmir, ona görə Şirvan üçün paytaxt işarəsi qoyulmayıb.
- 1501-də parçalanmış Ağqoyunlu (Əlvənd Diyarbəkirdə, Murad İraqi-Əcəmdə) bir dövlət kimi, "parçalanmış" adı ilə göstərilir.
- Dağıstan icmaları, Sistan, Xuzistan (Müşəşə), Ərəbistanın içərisi kimi yerli və ya tayfa hakimiyyəti olan bölgələr rəngsiz qalıb.
- Şərur döyüşü (1501) üçün xəritə 1490 snapshot-u ilə göstərilir (`territorySnapshotId`), çünki 1501 snapshot-u döyüşdən sonrakı vəziyyətdir.

## Döyüş oxları

Oxlar **sxematikdir** və UI-da belə yazılır. Yalnız mənbələrdə dəstəklənən istiqamətlər çəkilib:
tərəflərin gəldiyi istiqamət (marşrut datası ilə uyğun), məğlub tərəfin qaçış istiqaməti və mənbələrdə xüsusi qeyd olunan manevrlər
(Mərvdə və Fərat sahilində saxta geri çəkilmə və pusqu, Çaldıranda qızılbaş cinah hücumları və Osmanlı top-araba mövqeyi, Qarabağda mühasirə).
Oxların uzunluğu və dəqiq yeri təsviridir, real qoşun hərəkətinin xəritəsi deyil. Qoşun sayları diapazonla verilir, mənbə kartda göstərilir.
Komandanlar yalnız ümumi qəbul olunmuş adlarla verilib (məs. Çaldıranda Osmanlı tərəfdən I Səlim və Anadolu bəylərbəyi Sinan paşa).

## İlkin mənbələr

| Hadisə | Parça | Mənbə | Lisenziya |
|---|---|---|---|
| `uzun-hasan-contarini` | Kontarininin Uzun Həsəni təsviri ("about seventy years of age…") | R. Kerr, *A General History and Collection of Voyages and Travels*, c. 2 (1811), fəsil 2, bölmə 10. Mətn [franpritchett.com](https://franpritchett.com/00generallinks/kerr/vol02chap02sect06to10.html) nüsxəsində hərfi yoxlanılıb | Public domain. Azərbaycan dilinə tərcümə layihənindir (CC0) |

Kontarini Uzun Həsəni "təxminən yetmiş yaşında" görüb, halbuki o, təxminən 49 yaşında idi. Bu, kartdakı qeyddə izah olunur.
Xətainin şeirlərindən parçalar hələ əlavə edilməyib: orijinal mətn public domain-dir, amma müasir transliterasiya və tərcümələrin lisenziyası ayrıca yoxlanmalıdır.

## "Bu zaman dünyada"

`data/world-events.json`-dakı 45 hadisə ümumi qəbul olunmuş tarixlərlə verilib, hər birinin ensiklopedik mənbəyi var.
Tarixi mübahisəli olanlar (məs. Qutenberq İncili: təqr. 1455) ən çox işlənən il ilə göstərilir.

## Hökmdarlar və hakimiyyət cədvəli

`data/rulers.json` və `data/reigns.json` dövlətlərin hökmdar siyahılarına əsaslanır (hər hökmdarın `sources` sahəsində). Birinci dalğada
Osmanlı, Səfəvi, Ağqoyunlu, Qaraqoyunlu, Teymurilər, Böyük Moğollar, Əfşarlar, Şirvanşahlar, Rusiya, Hotakilər, Buxara, Dehli sultanlığı, Şeybanilər və Məmlüklər var.
Bizans, Trabzon, Qaraman, Dulqədir, gürcü çarlıqları, Gilan, Xivə, Krım, Marathalar və Əbdalilər üçün panel hələ "tezliklə" deyir.

| Məqam | Qərar |
|---|---|
| Uzun Həsənin hakimiyyətinin başlanğıcı | 1452 (Amidin tutulması), `disputed`; bəzi siyahılar 1453 və ya 1457 (yeganə hökmdar) verir |
| Ağqoyunlu 1497–1508 | Əlvənd (təq. 1498–1504) və Murad (təq. 1499–1508) eyni vaxtda, dövlətin müxtəlif hissələrində |
| Teymurilər 1451–1457 | Əbu Səid (Səmərqənd) və Əbülqasım Babur (Herat) eyni vaxtda; panel hər ikisini göstərir |
| Qaraqoyunlu: Cahanşahın başlanğıcı | 1436 / 1438, `approximate` |
| I Xəlilullahın ölüm ili | 1465 kimi verilir, bəzi mənbələrdə 1462; `approximate` |
| Böyük Moğollar, 1719 | Rəfi üd-Dərəcat və II Şah Cahanın bir neçə aylıq hakimiyyəti cədvəldə yoxdur, 1719 Məhəmməd şaha aiddir |
| Doğum illəri | Dəqiq gün çox vaxt məlum olmadığı üçün `approximate` kimi saxlanılıb |

**Ərazi** rəqəmləri tarixi mənbədən götürülmür: xəritədəki təxmini poliqonun sahəsidir və yalnız xəritənin əhatə etdiyi hissəni (16°–82° şərq) nəzərə alır.

## Əfşarlar dövləti (dövlət simulyasiyası)

Mərhələlər `data/states/afshar/steps.json`-dadır, hər birinin mənbəsi var (əsasən Axworthy, *The Sword of Persia*, 2006, və müvafiq ensiklopedik məqalələr).

| Məqam | Qərar |
|---|---|
| İsfahanın təslim olma günü | 21–23 oktyabr 1722; ay kimi verilib, `approximate` |
| Nadirin ölüm tarixi | 20 iyun 1747, `disputed`; alternativlər 19 və 21 iyun |
| Xanlıqların yaranma illəri | Əksəriyyəti 1747–1748; Şəki 1743 (Hacı Çələbinin üsyanı), Quba daha əvvəldən. Dövlət dövrləri `data/polities/*-kh.json`-da təxminidir |
| Cənubi Azərbaycan xanlıqlarının sonu | 1790-cı illərdə Qacarlara tabe oldular; dövr 1800 kimi yazılıb (təxmini) |
| 1750 xəritəsi | Fars, Kirman, Gilan kimi bölgələrdə hakimiyyət tez-tez dəyişirdi, boş saxlanılıb (`disputed`) |
| 1796 xəritəsi | V. Zubovun yürüşü zamanı Dərbənd, Quba, Bakı və Şamaxının müvəqqəti rus işğalı xəritədə deyil, qeyddə göstərilir |
| Dehli qırğını | Hekayə səviyyəsində deyil, faktiki xülasədə, qrafik təfərrüatsız: "təqribən 20–30 min dinc sakin" |

Ruler cədvəlinə əlavə olunanlar: Zəndlər (Kərim xan, Lütfəli xan), Dürranilər (Əhməd şah, Teymur şah, Zaman şah), Qacarlar (Məhəmmədhəsən xan,
Ağa Məhəmməd xan), II Teymuraz, II İrakli, Pənahəli xan, İbrahimxəlil xan, Hacı Çələbi, Fətəli xan. Digər xanlıqların xanları üçün panel "tezliklə" deyir.

## 44 günlük Vətən müharibəsi

Əsas mənbə AZƏRTAC-ın [Vətən müharibəsinin xronikası](https://azertag.az/bolme/chronicle_of_the_patriotic_war) seriyasıdır (27 sentyabr – 9 noyabr, hər gün üçün ayrıca məqalə).
Adları sadalanmadan yalnız sayı verilən günlər üçün Prezidentin müraciətlərinin tam mətni yoxlanılıb: 4 oktyabr (Cəbrayıl şəhəri və 9 kənd) və 20 oktyabr (Zəngilan şəhəri, 6 kənd, 18 kənd).

| Məqam | Qərar |
|---|---|
| Qubadlı şəhəri | Xronikada 25 oktyabr (Prezidentin tviti) və 26 oktyabr (adlar sadalanan müraciət) var. Step 25 oktyabrdır, hər iki mənbə göstərilir |
| Eyni kəndin iki dəfə çəkilməsi | Hacılı (Cəbrayıl) və Zərnəli (Zəngilan) rəsmi siyahılarda iki dəfə keçir. Sayğacda bir dəfə sayılır, panelda "təkrar xatırlanır" yazılır |
| Ağbənd və İran sərhədi | "Dövlət sərhədinin tam nəzarətə götürülməsi" Prezidentin açıqlaması kimi, ona istinadla verilir (mod.gov.az) |
| 9 noyabr | 23 kəndin adı var; əlavə "48 kənd, 1 qəsəbə, 8 strateji yüksəklik" yalnız sayla verilib |
| Cəbhə xətti | Çəkilmir: etibarlı açıq data yoxdur |
| Koordinatlar | OpenStreetMap Nominatim. Rayon mərkəzindən 30 km-dən uzaq və ya küçə tipli nəticələr rədd edilib; 28 məntəqə xəritəsiz qalıb |
| Zəfər Günü | 2020-ci ilin dekabrında 10 noyabr kimi təsis olunub, sonra 8 noyabra keçirilib |
| Qəhrəmanlar | Yalnız 9 dekabr 2020 sərəncamı (82 nəfər). Sonrakı sərəncamlar, doğum yerləri və təsvirlər hələ əlavə edilməyib |
| Dil | Mətnlər rəsmi mənbələrin faktlarını neytral, nifrət ifadəsi olmadan verir; zorakılıq qrafik təsvir edilmir |
