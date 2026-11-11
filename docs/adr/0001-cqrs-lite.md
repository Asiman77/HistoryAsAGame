# 0001. Redaksiya sənədi (JSONB) + oxuma proyeksiyası

Tarix: 2026-11-11 · Status: Qəbul

## Kontekst
Məzmun iyerarxikdir (şəxsiyyət → addımlar → iddialar → mənbələr), redaktorlar onu bütöv vahid kimi yazır, versiyalayır və rəyə göndərir. İctimai API isə coğrafi və xronoloji kəsişmə sorğuları (`/timeline`, `/polities/at`, `/compare`) tələb edir ki, bunlar normallaşdırılmış, indekslənmiş cədvəllərdə sürətli işləyir. Mövcud məzmun artıq JSON fayllarıdır.

## Qərar
- **Yazma tərəfi** (`editorial`): hər məzmun vahidi `editorial_document` + dəyişməz `editorial_revision` (JSONB). Revision `shared/schema` ilə validasiya olunur.
- **Oxuma tərəfi**: modullara (`catalog`, `geo`, `chronology`, `theming`, `media`) məxsus proyeksiya cədvəlləri. İctimai API yalnız buradan oxuyur.
- **Dərc**: `ContentPublished` event-i → `publishing` sənəd tipinə görə proyektoru çağırır → bir tranzaksiyada `document_id`-yə aid sətirlər silinib yenidən yazılır → `content_version` artır → `ContentProjected`.
- Event-lər Spring Modulith event publication registry-də (JDBC) saxlanılır; uğursuz proyeksiya yenidən cəhd edilir.
- `POST /api/v1/admin/projections/rebuild` bütün proyeksiyanı dərc olunmuş revision-lardan sıfırdan qurur.

## Nəticələr
- \+ Versiyalama, diff (RFC 6902) və geri qayıtma sadədir; mövcud JSON birbaşa idxal olunur.
- \+ İctimai sorğular sadə və indeksli qalır; proyeksiya sxemi dəyişəndə `rebuild` kifayətdir.
- − Məlumat iki yerdə yaşayır; proyektorlar idempotent olmalı və testlə qorunmalıdır.
- − Proyeksiya asinxron olduğundan dərcdən sonra qısa müddət köhnə versiya görünə bilər (qəbul edilir).
