# 0009. Mərhələ sırası: minimal identity redaksiyadan əvvəl

Tarix: 2026-11-11 · Status: Qəbul

## Kontekst
Spesifikasiyada identity 9-cu mərhələdir, redaksiya isə 4-cü. Redaksiya axını isə `author_id`, rol icazələri və "heç kim öz revision-ını təsdiqləyə bilməz" qaydasına bağlıdır; bunları istifadəçisiz düzgün test etmək olmur, saxta (stub) istifadəçi modeli sonradan yenidən yazılmalı olardı.

## Qərar
Yeni sıra:

| # | Mərhələ |
|---|---|
| 0 | Plan, ADR-lər |
| 1 | Skelet |
| 2 | Paylaşılan sxem |
| 3 | Ümumi tiplər + proyeksiya cədvəlləri |
| **4** | **Identity (minimal)**: `app_user`, `user_role`, Argon2, JWT access + refresh rotasiyası, admin bootstrap, `CurrentUser` API |
| 5 | Redaksiya |
| 6 | Dərc + proyektorlar |
| 7 | İdxal |
| 8 | İctimai API (əsas) |
| 9 | Coğrafi və xronoloji sorğular |
| 10 | Təhlükəsizliyin qalanı: login rate limit, CORS, başlıqlar, `TEACHER` + `class_group`, icazə matrisi testləri, Dependency-Check |
| 11 | Media |
| 12 | Analitika |
| 13 | Statik eksport |
| 14 | Frontend inteqrasiyası |
| 15 | Sənədləşmə |

## Nəticələr
- \+ Redaksiya ilk gündən real istifadəçi və rollarla test olunur.
- − Mərhələ nömrələri spesifikasiyadakından bir vahid sürüşür.
