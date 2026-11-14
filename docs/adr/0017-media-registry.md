# 0017. Media reyestri: məzmunda istinad, mövcud fayllar, icazənin oxuda tətbiqi

Tarix: 2026-11-14 · Status: Qəbul

## Kontekst
BACKEND_SPEC.md §7.4 `media_asset` cədvəlini, §11 presigned yükləməni, qeydiyyatı və `PATCH /media/{id}`-ni (yalnız ADMIN `GRANTED` edir), §10 isə ictimai API-də yalnız `GRANTED`/`NOT_REQUIRED` medianın görünməsini tələb edir. Spesifikasiya bunları demir:
- sənəd faylı necə göstərir (bugünkü məzmunda `src`/`url`/`file` sətirdir, yol `public/` altındadır);
- `public/`-dəki mövcud fayllar reyestrə necə düşür;
- icazə dəyişəndə (sənəd dərc olunmadan) ictimai çıxış necə yenilənir;
- yüklənmiş faylın nə olduğu necə yoxlanılır.

Frontend `data/` formatı (və Zod sxemləri) dəyişməməlidir (§0.6).

## Qərar

### Məzmunda istinad: `media:<id>` sətri
- Yüklənmiş fayla məzmunda mövcud sahə ilə istinad olunur: `src`, `url` (hero fotosu) və ya `file` (trek) = `media:<uuid>`. Sxem dəyişmir: bu sahələr onsuz da istənilən sətri qəbul edir. `BackgroundArt.src` regex-i buna icazə vermir; fon şəkilləri hələlik yalnız `public/`-dən gəlir.
- Lisenziya, hüquq sahibi, mənbə və icazə **reyestrdədir**. Məzmundakı `license` mətni reyestrdəkindən fərqlidirsə, validasiya `WARNING` (`media-license-mismatch`) verir, ictimai API isə reyestrdəkini göstərir.

### İki mənşə: `UPLOAD` və `LINKED`
- `UPLOAD`: `media` bucket-indəki obyekt. Açar backend-də yaradılır (`uploads/<uuid>.<ext>`), müştəri seçmir.
- `LINKED`: məzmunun olduğu kimi göstərdiyi fayl (`/portraits/…` və ya `https://…`). `storage_key` = həmin yol. İdxal bugünkü data-dakı bütün lisenziyalı faylları ADR-0010-dakı statusla belə qeyd edir. Artıq qeyd olunmuş yola toxunulmur (CMS-də dəyişdirilmiş icazə itmir). Lisenziyasız fayl qeyd olunmur; validasiya onu onsuz da `ERROR` sayır.

### Yükləmə: iki addım, fayl backend-dən keçmir
1. `POST /editorial/media/uploads {mimeType, sizeBytes}` → allowlist (JPEG, PNG, WebP, AVIF, MP3, WebM audio, Ogg, GeoJSON; SVG yoxdur — skript daşıya bilər) və ölçü həddi (şəkil 15 MB, səs 50 MB, GeoJSON 30 MB) → 15 dəq. etibarlı presigned `PUT`. `Content-Type` imzanın içindədir.
2. Brauzer faylı birbaşa S3-ə qoyur.
3. `POST /editorial/media {storageKey, license, …}` → backend obyekti yoxlayır: mövcuddur, ölçüsü həddədir, `Content-Type` uzantıya uyğundur, **ilk baytları tipə uyğundur** (magic bytes), SHA-256 hesablanır. Uyğun gəlməyən obyekt silinir və sorğu `422`/`413` alır.
- Qeyd olunmamış yükləmələr 24 saatdan sonra gecəlik iş ilə silinir.

### İcazə qaydaları (`PermissionPolicy`)
| Status | Kim qoya bilər |
|---|---|
| `GRANTED` | yalnız ADMIN |
| `DENIED` | REVIEWER, ADMIN |
| `NOT_REQUIRED` | hər redaktor, amma yalnız lisenziya ADR-0010-a görə açıqdırsa (yoxsa `409 permission-not-applicable`) |
| `PENDING` | hər redaktor (həmişə təhlükəsiz istiqamət) |

- Yeni faylın statusu yalnız lisenziyadan çıxır (`NOT_REQUIRED` və ya `PENDING`); sorğu statusu seçə bilməz.
- Lisenziya, hüquq sahibi və ya mənbə dəyişəndə status lisenziyadan yenidən çıxarılır: icazə köhnə şərtlərə verilmişdi. İstisnalar: `DENIED` qalır (onu yalnız rəyçi götürür), ADMIN `GRANTED` faylı redaktə edəndə icazə qalır.
- Dəyişiklik `If-Match` tələb edir (`428`/`412`), `ETag` = versiya.

### İcazə oxuda tətbiq olunur
- Proyeksiya fayl istinadını olduğu kimi saxlayır (`portrait.media_id` və `soundtrack_track.media_id` əlavə olaraq doldurulur). Faylın göstərilib-göstərilməməsi **sorğu zamanı** reyestrə görə həll olunur: `shared.read.MediaFiles` (SPI, `media` modulu təqdim edir). Bu SPI `content_version` üzrə keşlənmiş `MediaIndex` qaytarır. Beləliklə `chronology` və `theming` `media`-dan asılı olmur.
- Qayda: qeydiyyatdakı fayl öz statusu ilə; `media:` istinadı qeydiyyatda yoxdursa heç vaxt; qeydiyyatsız yol isə sətirdəki lisenziya ilə (ADR-0010).
- Faylın lisenziyası və ya icazəsi dəyişəndə `MediaAssetChanged` event-i atılır. `publishing` bunu dinləyir və `content_version`-ı artırır (`Projector.touch`). Keş, ETag və gələcək statik eksport yenilənir, proyeksiyanı yenidən qurmağa ehtiyac qalmır.
- Validasiya (`MediaRule`) da reyestrə baxır: `media-not-found`, `media-permission` (`PENDING`/`DENIED`, eləcə də açıq olmayan lisenziyalı qeydiyyatsız yol), `media-type` (şəkil yerinə səs), `ai-portrait-of-modern-person` (reyestrdə `is_ai_generated` olan fayl qəhrəman və ya 1850-dən sonra doğulmuş şəxs üçün).

### Faylın ictimai URL-i
- `LINKED`: yazıldığı kimi (frontend `public/`-dən verir).
- `UPLOAD`: `MEDIA_PUBLIC_BASE_URL + "/" + key` (prod-da CDN; lokalda `http://localhost:8333/media`). Bucket anonim oxunur (SeaweedFS: `anonymous` identity, yalnız `Read:media`). Presigned URL-lər brauzerin gördüyü ünvanla imzalanır (`S3_PRESIGN_ENDPOINT`).
- Ünvan bilinmirsə (konfiqurasiya yoxdur), yüklənmiş fayl ictimai API-də göstərilmir.

### `GET /soundtracks`
Yalnız səs yazısı ictimai səsləndirilə bilən treklər qaytarılır (`mood`, `conflict` filtrləri ilə). Gözləyən trek ümumiyyətlə görünmür: onun adı və ifaçısı da hüquq məsələsinin bir hissəsidir.

## Nəticələr
- \+ Frontend data formatı və sxemlər dəyişmir; bugünkü statik rejim olduğu kimi işləyir.
- \+ İcazəni ləğv etmək (`DENIED`) bir dəqiqədən az müddətdə bütün ictimai cavablara təsir edir, heç bir sənədi yenidən dərc etmədən.
- \+ Fayl tipi müştərinin dediyinə görə yox, məzmununa görə yoxlanılır.
- − Bucket anonim oxunduğu üçün hələ `PENDING` olan yüklənmiş fayl onun 122 bitlik təsadüfi açarını bilən hər kəs üçün əlçatandır. Açar heç bir ictimai cavabda görünmür. Prod-da bu qəbul olunmazsa, ictimai fayllar ayrıca bucket-ə köçürülməlidir (statik eksport mərhələsində yenidən baxılacaq).
- − `public/` altındakı fon şəkillərinin (`.avif`/`.webp` + `-sm` variantları) və trek fayllarının (`.webm`/`.mp3`) bir neçə fiziki faylı var. Onlar reyestrdə uzantısız tək bir yol kimi saxlanılır.
- − İdxal artıq qeyd olunmuş yolun reyestr sətrini yeniləmir. `data/`-da lisenziya mətni dəyişsə, reyestrdə CMS-dən (`PATCH`) dəyişdirilməlidir.
