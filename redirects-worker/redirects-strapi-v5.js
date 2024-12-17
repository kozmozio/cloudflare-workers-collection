/**
 * Cloudflare Worker script designed to handle HTTP requests
 * and manage URL redirects using data fetched from a Strapi
 * API. The script fetches all redirect entries from the API
 * Cacehes them for a configurable duration, and then uses
 * the cached data to handle incoming requests.
 *
 * Workders Docs: https://developers.cloudflare.com/workers/
 */

const API_DOMAIN = 'strapi.samplr.io';
const STRAPI_PATH = '/api/redirects';
const CACHE_DURATION = 86400; // Cache duration in seconds (24 hours)
const ENABLE_CACHE = true; // Toggle caching

addEventListener('fetch', event => {
    event.respondWith(handleRequest(event.request));
});
 
async function handleRequest(request) {
    const url = new URL(request.url);
    // console.log('Incoming request:', {
        url: request.url,
        hostname: url.hostname,
        path: url.pathname
    });


    try {
        return await handleRedirect(url, request);
    } catch (error) {
        console.error('Error handling request:', error);
        return fetch(request);
    }
}

// Main handler for redirect requests
async function handleRedirect(url, request) {
    // console.log('Handling request for:', request.url);

    try {
        const cache = caches.default;
        const cacheKey = new Request(`https://${new URL(request.url).host}/__redirect-cache`);
        const requestUrl = new URL(request.url);
        let path = requestUrl.pathname;

        // Add debug logging
        // console.log('Incoming request path:', path);
        // console.log('Request URL:', request.url);
        // console.log('Request host:', requestUrl.host);

        // Normalize path: remove trailing slash if it exists
        if (path !== '/') {
            path = path.replace(/\/$/, '');
        }
        // console.log('Normalized path:', path);

        let redirectsData;

        if (ENABLE_CACHE) {
            try {
                const cachedResponse = await cache.match(cacheKey);
                if (cachedResponse) {
                    const redirectsObj = await cachedResponse.json();
                    redirectsData = new Map(Object.entries(redirectsObj));
                }
            } catch (cacheError) {
                console.error('Cache error:', cacheError);
                // Continue execution without cached data...
            }
        }

        if (!redirectsData) {
            try {
                redirectsData = await fetchAllRedirects();
                const redirectsObj = Object.fromEntries(redirectsData);
                const responseToCache = new Response(JSON.stringify(redirectsObj), {
                    headers: {
                        'Content-Type': 'application/json',
                        'Cache-Control': `max-age=${CACHE_DURATION}`,
                        'Expires': new Date(Date.now() + CACHE_DURATION * 1000).toUTCString()
                    },
                });
                await cache.put(cacheKey, responseToCache);
            } catch (fetchError) {
                console.error('Error fetching redirects:', fetchError);
                // Continue to destination if we can't get redirects
                return fetch(request);
            }
        }

        // Retrieve the redirect entry using constant-time Map lookup
        const redirectEntry = redirectsData?.get(path);

        if (redirectEntry) {
            // console.log(`Found redirect entry:`, redirectEntry);
            try {
                let destination = redirectEntry.to;

                // Ensure destination has a leading slash if it's a relative path
                if (!destination.startsWith('http')) {
                    const baseUrl = `https://${requestUrl.host}`;
                    destination = baseUrl + (destination.startsWith('/') ? destination : '/' + destination);
                }
                // console.log(`Final destination URL: ${destination}`);

                const statusCode = redirectEntry.type === 'permanent' ? 301 : 302;
                return Response.redirect(destination, statusCode);

            } catch (redirectError) {
                console.error('Error during redirect:', redirectError);
                return new Response('Redirect Error', { status: 500 });
            }
        }

        // If no redirect found, return 404 instead of trying to fetch
        // console.log(`No redirect found for ${path}`);
        return fetch(request);

    } catch (error) {
        console.error('Error during Worker execution:', error);
        return new Response('Server Error', { status: 500 });
    }
}

// Fetch all redirects from the Strapi API with pagination
// Map is faster than find() for large datasets
async function fetchAllRedirects() {
    const redirectsMap = new Map();
    let page = 1;
    const pageSize = 50;

    try {
        while (true) {
            const apiUrl = `https://${API_DOMAIN}${STRAPI_PATH}?pagination[page]=${page}&pagination[pageSize]=${pageSize}`;
            console.log(`Fetching redirects from: ${apiUrl}`);

            const response = await fetch(apiUrl, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'Host': API_DOMAIN
                },
            });

            // Log full response details for debugging
            // console.log('API Response Status:', response.status);
            // console.log('API Response Headers:', Object.fromEntries(response.headers));

            if (!response.ok) {
                const errorText = await response.text();
                console.error('API URL attempted:', apiUrl);
                console.error('API Error Response Text:', errorText);
                throw new Error(`API fetch failed with status: ${response.status}`);
            }

            const data = await response.json();
            // console.log('API Response Data:', data);

            if (!data || !data.data) {
                console.error('Invalid API response structure:', data);
                throw new Error('Invalid API response structure');
            }

            processRedirectsData(data.data, redirectsMap);

            // Check if pagination info exists
            if (!data.meta?.pagination?.pageCount) {
                // console.log('No pagination info found, assuming single page');
                break;
            }

            const { pageCount } = data.meta.pagination;
            // console.log(`Fetched page ${page} of ${pageCount}`);

            if (page >= pageCount) break;

            page++;
        }

        return redirectsMap;

    } catch (error) {
        console.error('Error fetching redirects from API:', error);
        throw error;
    }
}

// Helper function to process redirect entries
function processRedirectsData(entries, redirectsMap) {
    if (!Array.isArray(entries)) {
        console.error('Expected array of entries, got:', typeof entries);
        return;
    }

    entries.forEach(entry => {
        if (!entry || !entry.from || !entry.to) {
            // console.log('Skipping invalid entry:', entry);
            return;
        }

        let fromPath = entry.from;

        // Ensure leading slash
        if (!fromPath.startsWith('/')) {
            fromPath = `/${fromPath}`;
        }

        // Normalize by removing trailing slash
        fromPath = fromPath.replace(/\/$/, '');

        // Add to map
        redirectsMap.set(fromPath, {
            to: entry.to,
            type: entry.type || 'temporary'
        });
        // console.log(`Added redirect: ${fromPath} -> ${entry.to}`);
    });
}