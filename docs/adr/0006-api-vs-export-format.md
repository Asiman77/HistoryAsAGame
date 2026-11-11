# 0006. İctimai API öz formasında, statik eksport `data/` formasında

Tarix: 2026-11-11 · Status: Qəbul

## Kontekst
Spesifikasiya ictimai API üçün resurs-yönümlü forma verir (`stepKey`, `sequence`, böyük hərfli enum-lar, `?lang` ilə tək dilli sətirlər, `available` bayrağı). Frontend isə kiçik hərfli enum-lar, `id`/`order`, çoxdilli `LocalizedText` obyektləri ilə işləyir. Frontend tam statikdir (`output: "export"`, GitHub Pages).

## Qərar
- **İctimai API** spesifikasiyanın formasındadır — mobil tətbiq, "Rəqəmsal məktəb" və digər istehlakçılar üçün sabit müqavilə. OpenAPI (`springdoc`) ilə sənədləşir.
- **Statik eksport** `data/` qovluğunun formasını dəqiq təkrarlayır və frontend Zod sxemlərindən keçməlidir (test).
- **Frontend `ApiRepository`** `next build` zamanı API-dən `?lang=all` ilə oxuyur və anti-corruption layer kimi API DTO-larını mövcud domen tiplərinə map edir. `output: "export"` saxlanılır; GitHub Pages deploy-u dəyişmir. `NEXT_PUBLIC_DATA_SOURCE=static|api`.
- Enum-lar bazada və API-də böyük hərflə (`BIRTH`), sənədlərdə və eksportda kiçik hərflə (`birth`) — çevrilmə yalnız proyektorda və eksportda olur.

## Nəticələr
- \+ API frontend-in daxili strukturuna bağlanmır; frontend UI dəyişmir.
- − İki forma və bir mapper saxlanılır; mapper eksport uyğunluq testi ilə qorunur.
