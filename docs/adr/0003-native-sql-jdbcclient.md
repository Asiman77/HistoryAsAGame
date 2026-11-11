# 0003. Sorğular: JPA yazma modelində, `JdbcClient` + native SQL proyeksiya və oxumada

Tarix: 2026-11-11 · Status: Qəbul

## Kontekst
Spesifikasiya mürəkkəb sorğular üçün native SQL və ya jOOQ seçimini tələb edir. Sorğuların əsas hissəsi PostGIS funksiyalarıdır (`ST_Contains`, `ST_DWithin`, `ST_AsGeoJSON`, `ST_SimplifyPreserveTopology`), trigram axtarışı (`az_fold(...) % ?`, `similarity`) və JSONB çıxarışlarıdır.

## Qərar
- **JPA (Hibernate 7)**: yalnız zəngin domen davranışı və optimistic locking olan yazma modelləri — `editorial`, `identity`, `media`. `ddl-auto=validate`.
- **Spring `JdbcClient` + parametrləşdirilmiş native SQL**: proyektorların yazışı (toplu `DELETE … WHERE document_id = ?` + `INSERT`) və bütün ictimai oxuma sorğuları. Nəticələr birbaşa Java `record` DTO-lara map olunur (N+1 mümkün deyil).
- SQL mətnləri hər modulun `internal/persistence` paketində `static final String` sabitləri kimi saxlanılır; string birləşdirmə ilə sorğu qadağandır (dinamik filtrlər `WHERE (:x IS NULL OR …)` şəklində).
- jOOQ istifadə olunmur.

## Səbəb (jOOQ-a qarşı)
- jOOQ kod generasiyası build zamanı canlı (Testcontainers) baza və ya DDL parser tələb edir — build mürəkkəbləşir.
- PostGIS tipləri üçün açıq mənbəli jOOQ-da hazır binding yoxdur; əl ilə `Binding` yazmaq lazımdır.
- Sorğu sayı orta (≈30) və əksəriyyəti sabit formadadır; tip təhlükəsiz DSL-in qazancı xərcini ödəmir.
- Sorğuların düzgünlüyü Testcontainers inteqrasiya testləri ilə qorunur.

## Nəticələr
- \+ SQL olduğu kimi oxunur, PostGIS və JSONB-nin bütün imkanları əlçatandır.
- − Sxem dəyişəndə kompilyasiya xətası yoxdur — inteqrasiya testləri məcburidir.
