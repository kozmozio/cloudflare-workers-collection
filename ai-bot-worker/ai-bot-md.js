/**
 * Cloudflare Worker: AI Bot Markdown Responder
 *
 * Detects AI bot / LLM crawler requests and serves a clean
 * Markdown representation of the page instead of HTML.
 *
 * Detection signals (either triggers markdown mode):
 *   1. Accept header contains "text/markdown" (or "text/x-markdown")
 *   2. User-Agent matches a known AI bot pattern
 *      (GPTBot, ClaudeBot, PerplexityBot, Google-Extended, etc.)
 *
 * Response strategy:
 *   1. If the path already ends with ".md", pass through.
 *   2. Try fetching ${path}.md from the origin. If 2xx, return it
 *      with Content-Type: text/markdown.
 *   3. Otherwise fetch the HTML page, strip nav/scripts/styles, and
 *      convert the main content to Markdown on the fly.
 *   4. Cache the generated markdown in the Workers Cache for
 *      CACHE_DURATION seconds to avoid recomputing.
 *
 * Uncomment console.logs when debugging.
 */

const CACHE_DURATION = 3600; // 1 hour
const ENABLE_CACHE = true;

// Known AI crawler / LLM bot user-agents.
// Sources: official bot docs from OpenAI, Anthropic, Google, Apple,
// Perplexity, Meta, CommonCrawl, ByteDance, Amazon, Mistral, etc.
const AI_BOT_UA_PATTERN = new RegExp(
    [
        'GPTBot',
        'ChatGPT-User',
        'OAI-SearchBot',
        'ClaudeBot',
        'Claude-Web',
        'anthropic-ai',
        'PerplexityBot',
        'Perplexity-User',
        'Applebot-Extended',
        'Google-Extended',
        'GoogleOther',
        'CCBot',
        'cohere-ai',
        'Bytespider',
        'Amazonbot',
        'Meta-ExternalAgent',
        'meta-externalagent',
        'FacebookBot',
        'Diffbot',
        'YouBot',
        'DuckAssistBot',
        'MistralAI-User',
        'Timpibot',
        'ImagesiftBot',
        'Omgilibot',
        'Omgili',
    ].join('|'),
    'i'
);

const MARKDOWN_ACCEPT_PATTERN = /text\/(x-)?markdown/i;

export default {
    async fetch(request, env, ctx) {
        try {
            return await handle(request);
        } catch (err) {
            console.error('[ai-bot-md] error:', err && err.message);
            return fetch(request);
        }
    },
};

async function handle(request) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Pass through non-GET or already-markdown paths.
    if (request.method !== 'GET' || path.endsWith('.md')) {
        return fetch(request);
    }

    if (!isAiBotRequest(request)) {
        return fetch(request);
    }
    // console.log('[ai-bot-md] bot request:', request.headers.get('user-agent'));

    const cache = caches.default;
    const cacheKey = new Request(`${url.origin}${path}?__fmt=md`, {
        method: 'GET',
    });

    if (ENABLE_CACHE) {
        const cached = await cache.match(cacheKey);
        if (cached) {
            // console.log('[ai-bot-md] cache hit');
            return cached;
        }
    }

    const markdown = await resolveMarkdown(url, request);
    if (markdown == null) {
        return fetch(request);
    }

    const response = new Response(markdown, {
        status: 200,
        headers: {
            'Content-Type': 'text/markdown; charset=utf-8',
            'Cache-Control': `public, max-age=${CACHE_DURATION}`,
            'X-AI-Bot-Markdown': '1',
            'Vary': 'Accept, User-Agent',
        },
    });

    if (ENABLE_CACHE) {
        await cache.put(cacheKey, response.clone());
    }
    return response;
}

function isAiBotRequest(request) {
    const accept = request.headers.get('accept') || '';
    if (MARKDOWN_ACCEPT_PATTERN.test(accept)) return true;

    const ua = request.headers.get('user-agent') || '';
    if (AI_BOT_UA_PATTERN.test(ua)) return true;

    return false;
}

// Try origin's ${path}.md first; fall back to converting HTML.
async function resolveMarkdown(url, request) {
    const mdUrl = buildMarkdownVariantUrl(url);
    const mdResponse = await fetch(mdUrl, {
        headers: { 'Accept': 'text/markdown,text/plain,*/*' },
        redirect: 'follow',
    });

    if (mdResponse.ok) {
        const body = await mdResponse.text();
        if (body && body.trim().length > 0) {
            // console.log('[ai-bot-md] served origin .md variant');
            return body;
        }
    }

    // Fallback: fetch HTML and convert.
    const htmlResponse = await fetch(url.toString(), {
        headers: { 'Accept': 'text/html,*/*' },
        redirect: 'follow',
    });
    if (!htmlResponse.ok) return null;

    const contentType = htmlResponse.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) {
        // Not HTML — don't try to convert binary or JSON.
        return null;
    }

    const html = await htmlResponse.text();
    return htmlToMarkdown(html, url);
}

function buildMarkdownVariantUrl(url) {
    const variant = new URL(url.toString());
    let p = variant.pathname.replace(/\/$/, '');
    if (p === '') p = '/index';
    variant.pathname = `${p}.md`;
    return variant.toString();
}

/**
 * HTML → Markdown conversion.
 *
 * Regex-based pipeline, intentionally dependency-free so the whole
 * worker stays in a single file. Handles headings, paragraphs, lists,
 * inline formatting, links, images, code, and blockquotes. Good enough
 * for typical article / landing page content served to AI crawlers.
 */
function htmlToMarkdown(html, url) {
    // 1. Extract page title for an H1 prefix.
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = titleMatch ? decodeEntities(stripTags(titleMatch[1])).trim() : '';

    const descMatch = html.match(
        /<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)["']/i
    );
    const description = descMatch ? decodeEntities(descMatch[1]).trim() : '';

    // 2. Pick the most content-like region if available.
    let body = html;
    const regionMatch =
        body.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i) ||
        body.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i) ||
        body.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
    if (regionMatch) body = regionMatch[1];

    // 3. Drop non-content blocks entirely.
    body = body
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
        .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
        .replace(/<svg[\s\S]*?<\/svg>/gi, '')
        .replace(/<nav[\s\S]*?<\/nav>/gi, '')
        .replace(/<header[\s\S]*?<\/header>/gi, '')
        .replace(/<footer[\s\S]*?<\/footer>/gi, '')
        .replace(/<aside[\s\S]*?<\/aside>/gi, '')
        .replace(/<form[\s\S]*?<\/form>/gi, '')
        .replace(/<!--[\s\S]*?-->/g, '');

    // 4. Convert block & inline elements to markdown tokens.
    body = body
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<hr\s*\/?>/gi, '\n\n---\n\n')
        .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '\n\n# $1\n\n')
        .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '\n\n## $1\n\n')
        .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '\n\n### $1\n\n')
        .replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, '\n\n#### $1\n\n')
        .replace(/<h5[^>]*>([\s\S]*?)<\/h5>/gi, '\n\n##### $1\n\n')
        .replace(/<h6[^>]*>([\s\S]*?)<\/h6>/gi, '\n\n###### $1\n\n')
        .replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, (_, code) => {
            const inner = stripTags(code);
            return `\n\n\u0060\u0060\u0060\n${decodeEntities(inner).trim()}\n\u0060\u0060\u0060\n\n`;
        })
        .replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '`$1`')
        .replace(/<(strong|b)[^>]*>([\s\S]*?)<\/\1>/gi, '**$2**')
        .replace(/<(em|i)[^>]*>([\s\S]*?)<\/\1>/gi, '*$2*')
        .replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_, inner) => {
            const text = stripTags(inner).trim();
            const quoted = text
                .split(/\n+/)
                .map((l) => `> ${l.trim()}`)
                .join('\n');
            return `\n\n${quoted}\n\n`;
        })
        .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_, inner) => `- ${stripTags(inner).trim()}\n`)
        .replace(/<\/(ul|ol)>/gi, '\n')
        .replace(/<(ul|ol)[^>]*>/gi, '\n')
        .replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '\n\n$1\n\n')
        .replace(/<a\b[^>]*href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi, (_, href, text) => {
            const cleanText = stripTags(text).trim();
            const abs = absoluteUrl(href, url);
            if (!cleanText) return abs;
            return `[${cleanText}](${abs})`;
        })
        .replace(
            /<img\b[^>]*?(?:alt=["']([^"']*)["'][^>]*?src=["']([^"']*)["']|src=["']([^"']*)["'][^>]*?alt=["']([^"']*)["']|src=["']([^"']*)["'])[^>]*\/?>/gi,
            (_, a1, s1, s2, a2, s3) => {
                const src = s1 || s2 || s3 || '';
                const alt = a1 || a2 || '';
                return `![${alt}](${absoluteUrl(src, url)})`;
            }
        );

    // 5. Strip any remaining tags, decode entities, normalize whitespace.
    body = stripTags(body);
    body = decodeEntities(body);
    body = body
        .replace(/\r\n/g, '\n')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n[ \t]+/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .replace(/[ \t]{2,}/g, ' ')
        .trim();

    // 6. Prepend title/description/source.
    const header = [];
    if (title) header.push(`# ${title}`);
    if (description) header.push(`> ${description}`);
    header.push(`Source: ${url.toString()}`);
    return `${header.join('\n\n')}\n\n${body}\n`;
}

function stripTags(s) {
    return String(s).replace(/<[^>]+>/g, '');
}

function decodeEntities(s) {
    return String(s)
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&apos;/g, "'")
        .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
        .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)));
}

function absoluteUrl(href, base) {
    try {
        return new URL(href, base).toString();
    } catch {
        return href;
    }
}
