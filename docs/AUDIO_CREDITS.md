# Səs və musiqi: mənbələr və lisenziyalar

**Qayda:** layihədə yalnız CC0 / royalty-free səslər və ya sonradan əvəz ediləcək placeholder-lər istifadə olunur.
Müəllif hüququ ilə qorunan musiqi istifadə olunmur. Hər fayl aşağıdakı cədvəldə olmalıdır (`npm test` bunu yoxlayır).

## Hazırkı vəziyyət: hamısı placeholder-dir

`public/audio/` qovluğundakı bütün fayllar `scripts/generate-audio.ts` skripti ilə **koddan sintez olunub**.
Heç bir səs yazısı (sample) istifadə edilməyib: alətlər riyazi modellərlə təqlid olunur (Karplus–Strong simi, aditiv sintez, süzgəcdən keçirilmiş küy).
Bu, layihənin öz işidir və **CC0 1.0** ilə yayılır.

Melodiyalar Şur məqamında, muğamdan ilhamlanaraq yazılmış qısa motivlərdir. Heç bir mövcud əsərin surəti deyil.
Bunlar real alət səsi deyil, sintez təqlididir. Dərsdə istifadədən əvvəl aşağıdakı plana uyğun real CC0 yazılarla əvəz etmək tövsiyə olunur.

| Fayl (`public/audio/`, `.webm` + `.mp3`) | Kanal | Mood | Məzmun | Mənbə | Lisenziya |
|---|---|---|---|---|---|
| `music-base` | music | hamısı (fon) | Re–Lya burdon, yavaş dalğalanma | sintez, `generate-audio.ts` | CC0 1.0 |
| `music-peace` | music | uşaqlıq, sülh, mədəniyyət | tar tremolosu + kamança cavabı | sintez | CC0 1.0 |
| `music-kamancha` | music | çətinlik, sürgün, tənəzzül | kamança solo, yavaş, qlissando ilə | sintez | CC0 1.0 |
| `music-balaban` | music | məğlubiyyət, ölüm | balaban ağısı, aşağı registr | sintez | CC0 1.0 |
| `music-battle` | music | döyüş | nağara (6/8) + zurna motivi | sintez | CC0 1.0 |
| `music-festive` | music | yüksəliş, taxta çıxma, qələbə | qaval/daf + tar + nağara zərbələri | sintez | CC0 1.0 |
| `music-journey` | music | yol | daf ritmi + tar ostinatosu + kamança | sintez | CC0 1.0 |
| `music-qanun` | music | doğuluş, diplomatiya, mədəniyyət | qanun arpeciosu | sintez | CC0 1.0 |
| `music-triumph` | music | qələbə (Şuşa, Zəfər) | Rast məqamında mis alətləri təqlid edən akkordlar, timpan (nağara) diyirləmələri, zurna melodiyası | sintez | CC0 1.0 |
| `amb-wind` | ambience | sürgün, ölüm, çətinlik | külək | sintez | CC0 1.0 |
| `amb-crowd` | ambience | döyüş düşərgəsi, taxta çıxma | izdiham uğultusu | sintez | CC0 1.0 |
| `amb-hooves` | ambience | yol, döyüş | at ayaq səsləri + külək | sintez | CC0 1.0 |
| `amb-market` | ambience | sülh, diplomatiya | bazar: izdiham, metal cingiltisi, uzaq çağırış | sintez | CC0 1.0 |
| `sfx-sprite` | sfx | — | whoosh, qılınc, top, nağara, kağız, zəng, qələbə fanfarı (sprite) | sintez | CC0 1.0 |

Səslərin yenidən yaradılması: `npm run generate:audio` (Playwright Chromium lazımdır: `npx playwright install chromium`).

## Əvəz etmə planı

Faylın adını saxlayıb `.webm` (Opus) və `.mp3` versiyasını əvəz etmək kifayətdir. Kodda dəyişiklik lazım deyil (`src/features/audio/manifest.ts`).
Musiqi qatları dövri təkrarlanır və mühərrik keçidləri 1,6 saniyəlik crossfade ilə edir, ona görə faylın əvvəli və sonu sakit olmalıdır.

Uyğun mənbələr (yükləmədən əvvəl hər faylın lisenziyasını ayrıca yoxlayın):

- **Freesound**, yalnız *Creative Commons 0* filtri ilə: tar, kamança, balaban, nağara, zurna, daf yazıları.
- **Pixabay Music / Sound Effects**: Pixabay Content License (royalty-free, atribusiya tələb olunmur, amma səsi dəyişmədən ayrıca satmaq olmaz).
- Öz yazılarınız: məktəbin musiqi müəllimi və ya tələbələrlə yazılmış ifalar (razılıqla, CC0 kimi).

Əvəz etdikdə bu cədvəldə həmin sətri yeniləyin: müəllif, URL, lisenziya və yüklənmə tarixi.

## Nağılçı səsi (`voice` kanalı)

Hələ heç bir hadisədə `narrationAudio` yoxdur. Əlavə edəndə fayllar `public/audio/narration/<event-id>.webm|.mp3` kimi saxlanmalı,
səsləndirənin razılığı və lisenziya bu sənədə əlavə olunmalıdır. TTS istifadə olunarsa, xidmətin şərtləri kommersiya olmayan təhsil istifadəsinə icazə verməlidir.

## "Şanlı Zəfər tariximiz" bölməsinin playlist-i

`data/conflicts/karabakh-war-2020/soundtrack.json` planlaşdırılan əsərlərin **yalnız metadata**sını saxlayır:

| Əsər | İfaçı | Status |
|---|---|---|
| "Vətən yaxşıdır" | Xudayar Yusifzadə | `pending`: müəllif hüququ ilə qorunur, icazə alınmayıb |
| "Bayatı-Şiraz" | seçilməlidir | `pending`: muğam ənənəvidir, amma konkret səs yazısı qorunur |

Fayllar yüklənməyib, mahnı sözləri heç yerdə yazılmayıb. Prod build-ə yalnız `permissionStatus: "granted"` olan və `file` sahəsi göstərilən treklər düşür
(validasiya `pending` trekə fayl əlavə edilməsinə icazə vermir). İcazə alınana qədər bölmədə yuxarıdakı CC0 sintez qatları səslənir.
