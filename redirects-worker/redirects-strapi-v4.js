/**
 * Cloudflare Worker script designed to handle HTTP requests
 * and manage URL redirects using data fetched from a Strapi v4
 * API. The script fetches all redirect entries from the API,
 * caches them for a configurable duration, and then uses
 * the cached data to handle incoming requests.
 *
 * Workers Docs: https://developers.cloudflare.com/workers/
 */

const API_DOMAIN = 'strapi.samplr.io';
const STRAPI_PATH = '/api/redirects';
const CACHE_DURATION = 86400; // Cache duration in seconds (24 hours)
const ENABLE_CACHE = true; // Toggle caching

addEventListener('fetch', event => {
    event.respondWith(handleRequest(event.request));
});

// ... [Previous code remains the same until fetchAllRedirects] ...

// Fetch all redirects from the Strapi v4 API with pagination
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
            console.log('API Response Status:', response.status);
            console.log('API Response Headers:', Object.fromEntries(response.headers));

            if (!response.ok) {
                const errorText = await response.text();
                console.error('API URL attempted:', apiUrl);
                console.error('API Error Response Text:', errorText);
                throw new Error(`API fetch failed with status: ${response.status}`);
            }

            const data = await response.json();
            console.log('API Response Data:', data);

            if (!data || !data.data) {
                console.error('Invalid API response structure:', data);
                throw new Error('Invalid API response structure');
            }

            processRedirectsData(data.data, redirectsMap);

            // Check if pagination info exists
            if (!data.meta?.pagination?.pageCount) {
                console.log('No pagination info found, assuming single page');
                break;
            }

            const { pageCount } = data.meta.pagination;
            console.log(`Fetched page ${page} of ${pageCount}`);

            if (page >= pageCount) break;

            page++;
        }

        return redirectsMap;

    } catch (error) {
        console.error('Error fetching redirects from API:', error);
        throw error;
    }
}

// Helper function to process Strapi v4 redirect entries
function processRedirectsData(entries, redirectsMap) {
    if (!Array.isArray(entries)) {
        console.error('Expected array of entries, got:', typeof entries);
        return;
    }

    entries.forEach(entry => {
        // Handle Strapi v4 structure with attributes wrapper
        const attributes = entry.attributes;
        if (!attributes || !attributes.from || !attributes.to) {
            console.log('Skipping invalid entry:', entry);
            return;
        }

        let fromPath = attributes.from;

        // Ensure leading slash
        if (!fromPath.startsWith('/')) {
            fromPath = `/${fromPath}`;
        }

        // Normalize by removing trailing slash
        fromPath = fromPath.replace(/\/$/, '');

        // Add to map
        redirectsMap.set(fromPath, {
            to: attributes.to,
            type: attributes.type || 'temporary'
        });
        console.log(`Added redirect: ${fromPath} -> ${attributes.to}`);
    });
}

// ... [Rest of the code remains the same] ... 