/**
 * Cloudflare Worker script for URL redirects with optimized caching.
 * Minimized for CPU and memory efficiency.
 * Uncomment console.logs for debugging.
 */

const REDIRECTS_API = 'https://kozmoz.io/kozmoz-redirects.json';
const CACHE_DURATION = 86400;
const ENABLE_CACHE = true;

addEventListener('fetch', event => {
    event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
    try {
        const cache = caches.default;
        const cacheKey = new Request(REDIRECTS_API);
        const requestUrl = new URL(request.url);
        const path = requestUrl.pathname.replace(/\/$/, '');
        const baseUrl = `https://${requestUrl.host}`;

        // console.log('Incoming request:', { path, baseUrl });
        // Try cache first if enabled
        let response = ENABLE_CACHE ? await cache.match(cacheKey) : null;
        // console.log('Cache hit:', !!response);

        // Fetch from API if needed
        if (!response) {
            // console.log('Fetching from API');
            response = await fetch(REDIRECTS_API, {
                headers: { 'Host': 'api.kozmoz.io' }
            });

            if (response.ok) {
                // console.log('API response status:', response.status);
                response = new Response(response.body, {
                    status: response.status,
                    statusText: response.statusText,
                    headers: {
                        ...Object.fromEntries(response.headers),
                        'Cache-Control': `public, max-age=${CACHE_DURATION}`,
                        'Age': '0'
                    }
                });

                if (ENABLE_CACHE) {
                    await cache.put(cacheKey, response.clone());
                    // console.log('Cached new response');
                }
            } else {
                // console.log('API error response:', response.status);
                return fetch(request);
            }
        }

        // Find matching redirect
        const redirectsData = await response.json();
        // console.log('Redirects data loaded, entries:', redirectsData.data.length);

        const redirectEntry = redirectsData.data.find(entry => 
            entry.from.replace(/\/$/, '') === path
        );
        // console.log('Redirect match found:', !!redirectEntry);

        if (redirectEntry) {
            const destination = !redirectEntry.to.startsWith('http') 
                ? baseUrl + (redirectEntry.to.startsWith('/') ? redirectEntry.to : '/' + redirectEntry.to)
                : redirectEntry.to;
            
            // console.log('Redirecting to:', destination);
            return Response.redirect(
                destination, 
                redirectEntry.type === 'permanent' ? 301 : 302
            );
        }

        // console.log('No redirect found, passing through request');
        return fetch(request);

    } catch (error) {
        console.error('[Error]:', error.message);
        // console.log('Stack trace:', error.stack);
        return fetch(request);
    }
}
