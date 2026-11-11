# 0004. Next.js kökdə qalır, backend `backend/` qovluğunda

Tarix: 2026-11-11 · Status: Qəbul

## Kontekst
Spesifikasiya `frontend/` qovluğunu nəzərdə tutur, lakin Next.js tətbiqi repo kökündədir (`src/`, `data/`, `public/`, `scripts/`, `tests/`), GitHub Pages workflow-u, `tsconfig` yolları, Playwright və Vitest konfiqurasiyası kökə bağlıdır. Spesifikasiyanın 6-cı qaydası: frontend heç bir mərhələdə sınmamalıdır.

## Qərar
- Frontend kökdə qalır. Spesifikasiyadakı `frontend/` → kök, `frontend/data/` → `data/` kimi oxunur.
- Yeni qovluqlar: `backend/` (Maven layihəsi), `shared/schema/`, `docker/`, `docs/adr/`.
- CI: frontend workflow-u (`deploy.yml`) toxunulmaz qalır; backend üçün `paths: backend/**, shared/**, docker/**` filtrli ayrıca `backend.yml`.
- Kökdəki `.gitignore` backend artefaktlarını (`backend/target/`, `.env`) da əhatə edir.

## Nəticələr
- \+ Frontend-in heç bir yolu, importu, deploy-u dəyişmir; risk sıfırdır.
- \+ Backend müstəqil build olunur (`cd backend && ./mvnw verify`).
- − Kök qovluq iki dünyanı qarışdırır. Gələcəkdə `frontend/`-ə köçürmə istənsə, bu ayrıca refaktorinq commit-i olacaq (yollar + workflow).
