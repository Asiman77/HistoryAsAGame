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
| [0006](0006-api-vs-export-format.md) | İctimai API öz formasında, statik eksport `data/` formasında | Qəbul |
| [0007](0007-content-model-mapping.md) | Mövcud data modelinin spesifikasiyaya uyğunlaşdırılması | Qəbul |
| [0008](0008-object-storage.md) | Obyekt anbarı: S3 API, lokalda SeaweedFS (MinIO əvəzinə) | Qəbul |
| [0009](0009-phase-order.md) | Mərhələ sırası: minimal identity redaksiyadan əvvəl | Qəbul |
| [0010](0010-media-permission-import.md) | İdxalda media icazə statusunun təyini | Qəbul |
