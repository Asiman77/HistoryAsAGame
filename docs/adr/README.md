# Memarlıq qərarları (ADR)

Format: [Michael Nygard](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions) — Kontekst, Qərar, Nəticələr.
Qəbul olunmuş ADR dəyişdirilmir; yeni qərar köhnəni `Superseded by` ilə əvəz edir.

| # | Qərar | Status |
|---|---|---|
| [0001](0001-cqrs-lite.md) | Redaksiya sənədi (JSONB) + oxuma proyeksiyası | Qəbul |
| [0002](0002-build-tool-maven.md) | Build aləti: Maven (wrapper ilə), Java 25 | Qəbul |
| [0003](0003-native-sql-jdbcclient.md) | Sorğular: yazma modelində JPA, proyeksiya və oxumada `JdbcClient` + native SQL | Qəbul |
| [0004](0004-repo-layout.md) | Next.js kökdə qalır, backend `backend/` qovluğunda | Qəbul |
| [0005](0005-shared-schema.md) | `shared/schema` (JSON Schema) Zod-dan çıxarılır və yeganə mənbəyə çevrilir | Qəbul |
| [0006](0006-api-vs-export-format.md) | İctimai API öz formasında, statik eksport `data/` formasında | Qəbul (bir bəndi 0020 ilə əvəz olunub) |
| [0007](0007-content-model-mapping.md) | Mövcud data modelinin spesifikasiyaya uyğunlaşdırılması | Qəbul |
| [0008](0008-object-storage.md) | Obyekt anbarı: S3 API, lokalda SeaweedFS (MinIO əvəzinə) | Qəbul |
| [0009](0009-phase-order.md) | Mərhələ sırası: minimal identity redaksiyadan əvvəl | Qəbul |
| [0010](0010-media-permission-import.md) | İdxalda media icazə statusunun təyini | Qəbul |
| [0011](0011-editorial-content-layout.md) | Redaksiya sənədinin kontent strukturu və validasiya səviyyələri | Qəbul |
| [0012](0012-projection.md) | Proyeksiya: modulların writer-ləri, idempotent proyektor, sorğu zamanı hesablanan məkan | Qəbul |
| [0013](0013-data-import.md) | Mövcud datanın idxalı: rəysiz dərc, hash ilə idempotentlik, CMS redaktələrinin qorunması | Qəbul |
| [0014](0014-public-read-api.md) | İctimai oxuma API-si: kontekst, keş, keçidlər, sorğu zamanı məkan | Qəbul |
| [0015](0015-geo-chronology-queries.md) | Coğrafi və xronoloji sorğular: frontend qaydaları, xəritənin əhatəsi, kəsişmə, axtarış | Qəbul |
| [0016](0016-security-hardening.md) | Təhlükəsizliyin qalanı: login limiti, CORS, sinif kodları, icazə matrisi, asılılıq yoxlaması | Qəbul |
| [0017](0017-media-registry.md) | Media reyestri: məzmunda `media:<id>` istinadı, mövcud fayllar `LINKED`, icazə oxuda tətbiq olunur | Qəbul |
| [0018](0018-analytics.md) | Anonim analitika: sahə siyahısı, tokensiz qəbul, aylıq partition-lar, gecəlik toplama, hesabatlar | Qəbul |
| [0019](0019-static-export.md) | Statik eksport: idxalın tərsi, sənədin mövqeyi, versiyalı bucket + manifest, debounce | Qəbul |
| [0020](0020-frontend-integration.md) | Frontend inteqrasiyası: `api` rejimi statik eksportdan, OpenAPI tipləri, analitika klienti (ADR-0006-nın bir bəndini əvəz edir) | Qəbul |
