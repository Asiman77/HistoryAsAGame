# 0021. Önizləmə, rəyçi təyinatı və ad dəyişmə

Tarix: 2026-11-22 · Status: Qəbul

## Kontekst
BACKEND_SPEC §11-də üç bənd qurulmamışdı:
- `GET /documents/{id}/preview`: dərc olunmamış revision-ın ictimai API formatında önizləməsi;
- `GET /documents?assignedToMe=`: bunun üçün kiminsə sənədə təyin olunması lazımdır;
- §5.5: slug dərcdən sonra yalnız `slug_redirect` ilə dəyişə bilər, amma bunu edən heç bir əməliyyat yox idi.

İctimai format modulların oxuyucularında qurulur (`catalog`, `geo`, `chronology`, `theming`, `media`), proyeksiya isə `publishing`-dədir.
`publishing` artıq `editorial`-dan asılıdır.

## Qərar
1. **Önizləmə `publishing`-dədir** (endpoint yolu `/api/v1/editorial/...` olsa da):
   - revision dərcdəki writer-lərlə həmişə geri alınan tranzaksiyada proyeksiya olunur;
   - sonra hər modul `shared.read.PreviewSource` SPI-si ilə onu öz oxuyucusu ilə oxuyur.

   Bunun nəticələri:
   - `publishing` oxuyuculardan asılı olmur;
   - önizləmə həqiqi proyeksiya qaydalarından keçir (yaş, marşrut, məkan uyğunlaşdırması);
   - başqa sorğular sətirləri görmür (MVCC);
   - `ReadContext.preview` `PublicCache`-i söndürür, ona görə geri alınan sətirlər keşə düşmür.

   Alternativlər rədd olundu:
   - ayrıca "önizləmə proyeksiya cədvəlləri": sxem ikiqat artar;
   - sənəd JSON-unu ictimai formata çevirən ikinci kod: qaydalar iki yerdə olar və bir-birindən ayrılardı.
2. **Təyinat sadə sahədir.** `editorial_document.assignee_id` bir rəyçi saxlayır.
   - Təyini REVIEWER və ya ADMIN edir, təyin olunan aktiv REVIEWER və ya ADMIN olmalıdır (`identity.api.Accounts`).
   - Status dəyişmir, jurnalda `ASSIGN` yazılır.
   - Bir neçə rəyçi və ya rəy növbəsi lazım olsa, ayrıca cədvəl olacaq.
3. **Ad dəyişmə ADMIN əməliyyatıdır.**
   - Yeni revision yeni `id`-ni daşıyır, köhnə slug `slug_redirect`-ə yazılır.
   - **İctimai slug dərc olunmuş revision-ın öz `id`-sidir**, sənəd sətrinin slug-ı deyil (`PublishedContents`). Yeni ad rəydən keçib dərc olunana qədər ictimai API, rebuild və statik eksport köhnə slug-ı işlədir və heç bir link sınmır. Dərcdən sonra köhnə link `301` verir.
   - Başqa sənədlərin köhnə slug-a istinadları avtomatik dəyişdirilmir, çünki onlar başqa müəlliflərin mətnidir. Onlar `/admin/broken-references`-də görünür.
   - Importer datadakı köhnə slug-ı yönləndirmə ilə tanıyır və `CONFLICT` sayır.

## Nəticələr
- Önizləmə bir dərc qədər işdir (sətir yazılır və geri alınır), sənəd üzrə advisory lock-u qısa müddət saxlayır. Redaktor UI-si üçün kifayətdir, ictimai trafik üçün deyil.
- Yeni oxuyucu yazan modul önizləmə üçün öz `PreviewSource`-unu əlavə etməlidir.
- Adı dəyişmiş sənədin `editorial_document.slug`-ı ilə ictimai slug dərcə qədər fərqlənir. Bu qəsdəndir və testlə yoxlanılır (`ProjectionTests`).
