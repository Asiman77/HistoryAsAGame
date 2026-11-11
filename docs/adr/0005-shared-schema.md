# 0005. `shared/schema` Zod-dan çıxarılır və yeganə mənbəyə çevrilir

Tarix: 2026-11-11 · Status: Qəbul

## Kontekst
Bu gün məzmun sxemi `src/domain/schema.ts`-də Zod 4 ilə yazılıb. Spesifikasiya JSON Schema-nı yeganə mənbə kimi tələb edir ki, Java backend də eyni sxemlə validasiya etsin.

## Qərar
1. **Mərhələ 2**: Zod 4-ün daxili `z.toJSONSchema()` funksiyası ilə hər fayl formatı üçün (Draft 2020-12) sxem çıxarılır → `shared/schema/*.schema.json`, commit olunur. Skript (`scripts/export-json-schema.ts`) və CI yoxlaması əlavə olunur ki, hər iki tərəf uyğun qalsın (Zod ↔ JSON Schema drift testi).
2. Backend redaksiya sənədlərini `networknt/json-schema-validator` ilə bu fayllara qarşı yoxlayır.
3. **Mərhələ 13**: istiqamət çevrilir — JSON Schema mənbə olur, Zod sxemləri ondan generasiya olunur və əl ilə yazılmış sxem əvəzlənir.
4. JSON Schema ilə ifadə olunmayan `.refine()` qaydaları (fakt mənbəsiz ola bilməz, `historicalOptionIndex < options.length`, `ageFrom ≤ ageTo`, real tarix və s.) backend-in `ValidationRule`-larına köçürülür və `shared/schema/README.md`-də sənədləşdirilir. Frontend tərəfdə həmin qaydalar `validate-data.ts`-də qalır.
5. Hər sxemdə `$id` və `x-schema-version` var; revision-da `schema_version` saxlanılır.

## Nəticələr
- \+ Mövcud data və UI dərhal etibarlı sxemə malikdir; uydurma sxem yoxdur.
- − Keçid dövründə iki mənbə var — drift testi bunu idarə edir.
- − Refine qaydaları iki dildə yaşayır; paylaşılan test fikstürləri (yaxşı/pis nümunələr) ilə sinxron saxlanılır.
