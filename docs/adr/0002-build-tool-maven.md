# 0002. Build aləti: Maven (wrapper ilə), Java 25

Tarix: 2026-11-11 · Status: Qəbul

## Kontekst
Spesifikasiya Maven və ya Gradle seçimini və Java 21+ LTS tələb edir. Tək modullu Spring Boot tətbiqidir; build-də xüsusi məntiq (kod generasiyası istisna olmaqla) yoxdur.

## Qərar
- **Maven**, `mvnw` wrapper ilə (komandada quraşdırılmış Maven-ə ehtiyac yoxdur, versiya sabitdir).
- **Java 25** (cari LTS, 2025-09). Spring Boot 4.1 onu tam dəstəkləyir; Java 21 ilə müqayisədə daha uzun dəstək müddəti.
- Versiyalar (2026-11-11 tarixində Maven Central-dan yoxlanılıb, ən son GA): Spring Boot **4.1.2**, Spring Modulith **2.1.2**, springdoc-openapi **3.2.0**, Testcontainers **2.0.5** (Boot BOM-u idarə edir), AWS SDK v2 BOM **2.57.x**, Bucket4j **8.22.0**, networknt json-schema-validator **3.0.x**. RC/milestone versiyalar istifadə olunmur.
- Docker image-ləri: `postgis/postgis:18-3.7` (PostgreSQL 18 + PostGIS 3.7; 19 hələ RC-dir), `eclipse-temurin:25-jre-noble` (runtime), `eclipse-temurin:25-jdk-noble` (build).

## Nəticələr
- \+ Deklarativ, IDE-lərdə və CI-da ən geniş dəstəklənən; Spring sənədlərinin əsas nümunələri.
- \+ Dependency-Check, Flyway, jib kimi plaginlər hazırdır.
- − Gradle-dən yavaş inkremental build (bu ölçüdə əhəmiyyətsizdir).
- Lokal tərtibatçıya JDK 25 lazımdır (`JAVA_HOME`). Alternativ: `docker compose` ilə tam Docker build.
