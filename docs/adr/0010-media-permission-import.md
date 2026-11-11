# 0010. İdxalda media icazə statusunun təyini

Tarix: 2026-11-11 · Status: Qəbul

## Kontekst
Mövcud datada media reyestri yoxdur; şəkil və səslər `public/` altındadır, lisenziya sərbəst sətirdir. 2026-11-11 tarixinə datadakı lisenziyalar: `Public domain` (7), `CC0 1.0 (Met Open Access)` (4), public domain mətn + layihə CC0 tərcüməsi (1), `Layihə lisenziyası` (1), müəllif hüququ ilə qorunan 2 trek (`permissionStatus: pending`). Hero fotosu yoxdur. `src`-siz AI portretləri (yer tutucu) var.

Prinsip: icazə heç vaxt fərz edilmir; dəqiq olmayan hal həmişə `PENDING`-dir (prod-a düşmür).

## Qərar
İdxalçı `permission_status`-u bu qaydalarla təyin edir (birinci uyğun gələn):
1. Datada açıq `permissionStatus` varsa → onun böyük hərfli forması (`pending` → `PENDING`, `granted` → `GRANTED`).
2. Lisenziya `Public domain` və ya `CC0` ilə başlayırsa (registr fərqi nəzərə alınmadan) → `NOT_REQUIRED`.
3. Lisenziya `Layihə lisenziyası` (layihənin öz işi) və ya `BackgroundArt.kind = own` → `NOT_REQUIRED`.
4. `CC BY*` lisenziyaları → `NOT_REQUIRED` (atribusiya `rights_holder` + `source_url` ilə saxlanılır).
5. Qalan hər şey → `PENDING` və idxal hesabatında ayrıca siyahıda göstərilir.

`src`-siz portretlər üçün `media_asset` yaradılmır; `portrait.media_id = NULL` (UI yer tutucu göstərir).
`ai_illustration` → `is_ai_generated = true` və `ai_disclosure_label` = "Rəssam təsəvvürü (AI illüstrasiya)" (datadakı `caption` varsa, o).

## Nəticələr
- \+ Bu gün ictimai olan bütün media (public domain/CC0/öz işi) ictimai qalır; qorunan treklər əvvəlki kimi gizli qalır.
- \+ Gələcəkdə naməlum lisenziya avtomatik olaraq ictimaiyyətdən gizlənir.
- `GRANTED` statusunu yalnız ADMIN əl ilə verə bilər (`PATCH /media/{id}`).
