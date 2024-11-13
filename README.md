# Cloudflare Workers Collection

A collection of specialized Cloudflare Workers for handling various web functionality including redirects, A/B testing, and more.

## Projects

### 1. Redirects Worker
Two implementations of redirect handling:

#### JSON-based Redirects
- Simple implementation using JSON data source
- Optimized for CPU and memory efficiency
- Configurable caching duration
- Located in `redirects-worker/redirects-json.js`

#### Strapi CMS Redirects (v5)
- Advanced implementation using Strapi CMS as data source
- Supports pagination for large datasets
- Uses Map for efficient lookups
- Includes comprehensive error handling and logging
- Located in `redirects-worker/redirects-strapi-v5.js`

#### Strapi CMS Redirects (v4)
- Same as v5 but for Strapi v4 json format
- Located in `redirects-worker/redirects-strapi-v4.js`

### 2. Split Test Worker
- Implements A/B testing functionality
- Cookie-based user tracking
- Configurable split ratio (default 50/50)
- Simple redirect-based testing
- Located in `split-test-worker/split-test-ab.js`

## Features
- **Caching**: Configurable caching duration for optimal performance
- **Error Handling**: Comprehensive error handling and fallbacks
- **Logging**: Debug logging capabilities (can be enabled/disabled)
- **Flexible Routing**: Support for both relative and absolute URL redirects
- **Performance Optimized**: Uses efficient data structures and algorithms

## Configuration

Each worker can be configured through environment variables at the top of their respective files:

### Redirects Worker
```javascript
const CACHE_DURATION = 86400; // 24 hours
const ENABLE_CACHE = true;
```

### Split Test Worker
```javascript
const RATIO = 0.5; // 50/50 split
const URL_CONTROL = "https://kozmoz.net/";
const URL_TEST = "https://kozmoz.io/";
```

## Cloudflare Setup

1. Deploy the desired worker to your Cloudflare account:
   - Log in to your Cloudflare account
   - Navigate to the Workers section
   - Click on "Create a Worker" and upload your worker script
2. Configure the necessary environment variables:
   - Go to the "Settings" tab of your worker
   - Add the required environment variables under the "Environment Variables" section
3. Set up the appropriate routes in your Cloudflare dashboard:
   - Navigate to the "Workers" tab
   - Click on "Add Route" and specify the route pattern and the worker to be used
4. Test your worker:
   - Use the "Quick Edit" feature in the Cloudflare dashboard to test your worker
   - Check the logs and debug any issues
5. Monitor and maintain:
   - Regularly check the performance and logs of your worker
   - Update the worker script as needed for improvements or bug fixes

 ### Attention !!!
    Routes are recommended for use cases where your application’s origin server is external to Cloudflare. Note that Routes cannot be the target of a same-zone fetch() call.

    For instance, redirected domain ( kozmoz.io ) cannot fetch from ( api.kozmoz.io ) becouse they are in same zone.
    So we have moved API to external domain ( strapi.samplr.io ) and configured route for it.

    For more information on Cloudflare Workers routing, see the [official documentation](https://developers.cloudflare.com/workers/configuration/routing/). 




## Development

To modify or extend the workers:

1. Clone the repository
2. Make your changes
3. Test locally using [Wrangler](https://developers.cloudflare.com/workers/wrangler/)
4. Deploy to Cloudflare

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

