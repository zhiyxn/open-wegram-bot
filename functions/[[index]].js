/**
 * Open Wegram Bot - Netlify Entry Point
 * A two-way private messaging Telegram bot
 *
 * GitHub Repository: https://github.com/wozulong/open-wegram-bot
 */

import {handleRequest} from "../../src/core.js";

export default async (req) => {
    const request = new Request(req.url, {
        method: req.method,
        headers: new Headers(req.headers),
        body: req.method !== "GET" && req.method !== "HEAD" ? await req.text() : null
    });

    const config = {
        prefix: Netlify.env.get("NETLIFY_PREFIX") || "public",
        secretToken: Netlify.env.get("SECRET_TOKEN") || ""
    };

    const env = {
        PREFIX: Netlify.env.get("NETLIFY_PREFIX"),
        SECRET_TOKEN: Netlify.env.get("SECRET_TOKEN"),
        TURNSTILE_SITE_KEY: Netlify.env.get("TURNSTILE_SITE_KEY"),
        TURNSTILE_SECRET_KEY: Netlify.env.get("TURNSTILE_SECRET_KEY")
    };

    const response = await handleRequest(request, env, config);

    const body = await response.text();

    return new Response(body, {
        status: response.status,
        headers: {
            "Content-Type": response.headers.get("Content-Type") || "text/plain",
        },
    });
};
