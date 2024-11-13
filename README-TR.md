# Cloudflare Workers Koleksiyonu

Çeşitli web işlevlerini, örneğin yönlendirmeler, A/B testi ve daha fazlasını yönetmek için özelleştirilmiş bir Cloudflare Workers koleksiyonu.

## Projeler

### 1. Yönlendirme İşçisi
İki yönlendirme işleme uygulaması:

#### JSON Tabanlı Yönlendirmeler
- JSON veri kaynağını kullanan basit bir uygulama
- CPU ve bellek verimliliği için optimize edilmiştir
- Önbellekleme süresi yapılandırılabilir
- `redirects-worker/redirects-json.js` konumunda

#### Strapi CMS Yönlendirmeleri (v5)
- Strapi CMS'yi veri kaynağı olarak kullanan gelişmiş bir uygulama
- Büyük veri setleri için sayfalandırmayı destekler
- Verimli aramalar için Map kullanır
- Kapsamlı hata yönetimi ve günlük kaydı içerir
- `redirects-worker/redirects-strapi-v5.js` konumunda

### 2. Bölünmüş Test İşçisi
- A/B testi işlevselliğini uygular
- Çerez tabanlı kullanıcı takibi
- Yapılandırılabilir bölünme oranı (varsayılan 50/50)
- Basit yönlendirme tabanlı test
- `split-test-worker/split-test-ab.js` konumunda

## Özellikler

- **Önbellekleme**: Optimum performans için yapılandırılabilir önbellekleme süresi
- **Hata Yönetimi**: Kapsamlı hata yönetimi ve yedekleme seçenekleri
- **Günlük Kaydı**: Hata ayıklama günlüğü yetenekleri (açılabilir/kapatılabilir)
- **Esnek Yönlendirme**: Göreli ve mutlak URL yönlendirmelerini destekler
- **Performans Optimizasyonu**: Verimli veri yapıları ve algoritmalar kullanır

## Yapılandırma

Her bir işçi, kendi dosyalarının üst kısmındaki ortam değişkenleri ile yapılandırılabilir:

### Yönlendirme İşçisi
```javascript
const CACHE_DURATION = 86400; // 24 saat
const ENABLE_CACHE = true;
```

### Bölünmüş Test İşçisi
```javascript
const RATIO = 0.5; // 50/50 oran
const URL_CONTROL = "https://inanolcer.com/";
const URL_TEST = "https://kozmoz.io/";
```

## Cloudflare Kurulumu

1. İstediğiniz işçiyi Cloudflare hesabınıza yükleyin:
   - Cloudflare hesabınıza giriş yapın
   - "Workers" bölüme gidin
   - "Create a Worker" seçeneğine tıklayın ve işçi scriptinizi yükleyin
2. Gerekli ortam değişkenlerini yapılandırın:
   - İşçinizin "Ayarlar" sekmesine gidin
   - "Ortam Değişkenleri" bölümüne gerekli değişkenleri ekleyin
3. Cloudflare kontrol panelinizde uygun yolları ayarlayın:
   - "Workers" sekmesine gidin
   - "Rota Ekle" üzerine tıklayın, rota desenini ve kullanılacak işçiyi belirtin
4. İşçinizi test edin:
   - Cloudflare kontrol panelinde "Hızlı Düzenleme" özelliğini kullanarak işçinizi test edin
   - Günlükleri kontrol edin ve olası sorunları giderin
5. İzleyin ve bakım yapın:
   - İşçinizin performansını ve günlüklerini düzenli olarak kontrol edin
   - İyileştirme veya hata düzeltmeleri için işçi scriptini güncelleyin

 ### Dikkat !!!
    Yönlendirmeler, uygulamanızın ana sunucusunun Cloudflare dışındaki bir sunucu olduğu durumlar için önerilmektedir. Rotaların aynı alan içinde bir `fetch()` çağrısının hedefi olamayacağını unutmayın.

    Örneğin, yönlendirilen alan adı (kozmoz.io) aynı bölgedeki (api.kozmoz.io) bir alandan veri çekemez.
    Bu nedenle, API'yi harici bir alan adı olan (strapi.samplr.io) taşıdık ve rota için yapılandırma yaptık.

    Cloudflare Workers yönlendirme hakkında daha fazla bilgi için, [resmi belgeleri](https://developers.cloudflare.com/workers/configuration/routing/) inceleyebilirsiniz.

## Geliştirme

İşçileri değiştirmek veya genişletmek için:

1. Depoyu klonlayın
2. Değişikliklerinizi yapın
3. [Wrangler](https://developers.cloudflare.com/workers/wrangler/) kullanarak yerel olarak test edin
4. Cloudflare’a dağıtın

## Lisans

Bu proje MIT Lisansı altında lisanslanmıştır - ayrıntılar için LICENSE dosyasına bakın.

## Katkıda Bulunma

Katkılar memnuniyetle karşılanır! Bir Çekme İsteği göndermekten çekinmeyin.
