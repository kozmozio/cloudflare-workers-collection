/**
 * Cloudflare A/B split test worker script
 * This script demonstrates how to implement A/B testing using Cloudflare Workers.
 * It uses a cookie to track the group assignment of each client.
 * The script randomly assigns clients to either the control or test group.
 * The control group is redirected to the control URL.
 * The test group is redirected to the test URL.
 * Adjust random split by changing the ratio of the Math.random() comparison ratio (0.5).
 * Test on : https://lp.samplr.io/
 */

const NAME = "Landing-Page-AB-Test";
const RATIO = 0.5; // 50/50 split  control/test
const URL_CONTROL = "https://kozmoz.net/";
const URL_TEST = "https://kozmoz.io/";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    // console.log("URL:", url)
    // Enable Passthrough to allow direct access to control and test routes.
    if (url.pathname.startsWith("/control") || url.pathname.startsWith("/test")) {
      return fetch(request);
    }

    // If there is no cookie, this is a new client. Choose a group and set the cookie.
    const group = Math.random() < RATIO ? "control" : "test"; // 50/50 split

    let redirectURL = '';
    //
    if (group === "control") {
      redirectURL = URL_CONTROL;
    } else {
      redirectURL = URL_TEST;

    }
    // Reconstruct response to avoid immutability
    // console.log("url:" + url)
    let res = await fetch(redirectURL);
    // console.log("res:", res)
    res = new Response(res.body, res);

    // Set cookie to enable persistent A/B sessions.
    // todo : not implemented yet.
    res.headers.append("Set-Cookie", `${NAME}=${group}; path=/`);

    return res;
    
  },
};