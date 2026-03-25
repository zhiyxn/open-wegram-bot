/**
 * Open Wegram Bot - Deno Entry Point
 * A two-way private messaging Telegram bot
 *
 * GitHub Repository: https://github.com/wozulong/open-wegram-bot
 */

import {handleRequest} from "../src/core.js";

Deno.serve(async (req) => {
    const request = new Request(req.url, {
        method: req.method,
        headers: new Headers(req.headers),
        body: req.method !== "GET" && req.method !== "HEAD" ? await req.text() : null
    });

    const config = {
        prefix: Deno.env.get("PREFIX") || "public",
        secretToken: Deno.env.get("SECRET_TOKEN") || ""
    };

    const env = {
        PREFIX: Deno.env.get("PREFIX"),
        SECRET_TOKEN: Deno.env.get("SECRET_TOKEN"),
        TURNSTILE_SITE_KEY: Deno.env.get("TURNSTILE_SITE_KEY"),
        TURNSTILE_SECRET_KEY: Deno.env.get("TURNSTILE_SECRET_KEY")
    };

    const response = await handleRequest(request, env, config);

    const body = await response.text();

    return new Response(body, {
        status: response.status,
        headers: {
            "Content-Type": response.headers.get("Content-Type") || "text/plain",
        },
    });
});
