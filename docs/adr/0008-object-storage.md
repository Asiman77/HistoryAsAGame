# 0008. Obyekt anbarı: S3 API, lokalda SeaweedFS (MinIO əvəzinə)

Tarix: 2026-11-11 · Status: Qəbul

## Kontekst
Spesifikasiya lokalda MinIO nəzərdə tutur. 2025-10-23-dən MinIO icma versiyasının Docker image-ləri yayımlanmır, `minio/minio` Docker Hub-dan silinib və layihə 2026-cı ildə arxivləşdirilib (yalnız kommersiya AIStor inkişaf etdirilir). Qeyri-rəsmi rebuild-lər (Chainguard, soldevelo) təchizat zənciri riski daşıyır.

## Qərar
- Kod yalnız **S3 API**-yə bağlıdır (AWS SDK v2, `S3Client` + `S3Presigner`, `forcePathStyle=true`, endpoint konfiqurasiyadan). Prod-da istənilən S3 (AWS S3, Cloudflare R2, Hetzner, DigitalOcean Spaces) istifadə oluna bilər.
- Lokal və test mühiti: **SeaweedFS** (`chrislusf/seaweedfs`, Apache-2.0, 2015-dən aktiv, S3 + presigned URL dəstəyi). Tag sabitlənir (`4.49`).
- Bucket-lər (`media`, `public-content`) init konteyneri ilə yaradılır.
- Spesifikasiyada "MinIO" deyilən hər yer "S3-uyğun anbar" kimi oxunur.

## Nəticələr
- \+ Aktiv saxlanılan, açıq lisenziyalı, tək konteynerlə işləyən anbar.
- \+ Vendor-dan asılılıq yoxdur.
- − SeaweedFS-in S3 uyğunluğu tam deyil (məs. bəzi ACL/versiyalama xüsusiyyətləri); bizə yalnız PUT/GET/presign/list lazımdır — inteqrasiya testi ilə yoxlanılır.
