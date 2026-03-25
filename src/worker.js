/**
 * Open Wegram Bot - Cloudflare Worker Entry Point
 * A two-way private messaging Telegram bot
 *
 * GitHub Repository: https://github.com/wozulong/open-wegram-bot
 */

import {handleRequest, handleVerifyPage} from './core.js';

export default {
    async fetch(request, env, ctx) {
        const config = {
            prefix: env.PREFIX || 'public',
            secretToken: env.SECRET_TOKEN || ''
        };

        const url = new URL(request.url);
        const path = url.pathname;

        // Handle verify-page route before calling handleRequest
        const verifyPagePattern = new RegExp(`^/${config.prefix}/verify-page/([^/]+)$`);
        const match = path.match(verifyPagePattern);
        if (match) {
            return handleVerifyPage(match[1], env.TURNSTILE_SITE_KEY, config.prefix);
        }

        return handleRequest(request, env, config);
    }
};