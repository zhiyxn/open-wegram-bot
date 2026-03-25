/**
 * Open Wegram Bot - Core Logic
 * Shared code between Cloudflare Worker and Vercel deployments
 */

import { verifyTurnstileToken } from './turnstile.js';

export function validateSecretToken(token) {
    return token.length > 15 && /[A-Z]/.test(token) && /[a-z]/.test(token) && /[0-9]/.test(token);
}

export function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {'Content-Type': 'application/json'}
    });
}

export async function postToTelegramApi(token, method, body) {
    return fetch(`https://api.telegram.org/bot${token}/${method}`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(body)
    });
}

export async function handleInstall(request, ownerUid, botToken, prefix, secretToken) {
    if (!validateSecretToken(secretToken)) {
        return jsonResponse({
            success: false,
            message: 'Secret token must be at least 16 characters and contain uppercase letters, lowercase letters, and numbers.'
        }, 400);
    }

    const url = new URL(request.url);
    const baseUrl = `${url.protocol}//${url.hostname}`;
    const webhookUrl = `${baseUrl}/${prefix}/webhook/${ownerUid}/${botToken}`;

    try {
        const response = await postToTelegramApi(botToken, 'setWebhook', {
            url: webhookUrl,
            allowed_updates: ['message'],
            secret_token: secretToken
        });

        const result = await response.json();
        if (result.ok) {
            return jsonResponse({success: true, message: 'Webhook successfully installed.'});
        }

        return jsonResponse({success: false, message: `Failed to install webhook: ${result.description}`}, 400);
    } catch (error) {
        return jsonResponse({success: false, message: `Error installing webhook: ${error.message}`}, 500);
    }
}

export async function handleUninstall(botToken, secretToken) {
    if (!validateSecretToken(secretToken)) {
        return jsonResponse({
            success: false,
            message: 'Secret token must be at least 16 characters and contain uppercase letters, lowercase letters, and numbers.'
        }, 400);
    }

    try {
        const response = await postToTelegramApi(botToken, 'deleteWebhook', {})

        const result = await response.json();
        if (result.ok) {
            return jsonResponse({success: true, message: 'Webhook successfully uninstalled.'});
        }

        return jsonResponse({success: false, message: `Failed to uninstall webhook: ${result.description}`}, 400);
    } catch (error) {
        return jsonResponse({success: false, message: `Error uninstalling webhook: ${error.message}`}, 500);
    }
}

export async function handleVerify(request, env, userId) {
    const secretKey = env.TURNSTILE_SECRET_KEY;
    if (!secretKey) {
        return jsonResponse({success: false, message: 'Turnstile secret key not configured'}, 500);
    }

    let body;
    try {
        body = await request.json();
    } catch {
        return jsonResponse({success: false, message: 'Invalid request body'}, 400);
    }

    const token = body.token;
    if (!token) {
        return jsonResponse({success: false, message: 'Missing token'}, 400);
    }

    const result = await verifyTurnstileToken(token, secretKey);
    if (!result.success) {
        return jsonResponse({success: false, message: result.message || 'Verification failed'}, 400);
    }

    // Store verified status in KV
    if (env.VERIFIED_USERS) {
        await env.VERIFIED_USERS.put(`verified:${userId}`, '1');
    }

    return jsonResponse({success: true, message: 'Verification successful'});
}

export function handleVerifyPage(userId, siteKey, prefix) {
    const html = getVerifyPageHtml(userId, siteKey, prefix);

    return new Response(html, {
        status: 200,
        headers: {'Content-Type': 'text/html; charset=utf-8'}
    });
}

function getVerifyPageHtml(userId, siteKey, prefix) {
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Sam Wegram Bot</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .container {
            background: white;
            border-radius: 16px;
            padding: 40px;
            max-width: 400px;
            width: 100%;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            text-align: center;
        }
        h1 { color: #333; margin-bottom: 10px; font-size: 24px; }
        p { color: #666; margin-bottom: 30px; line-height: 1.6; }
        .status {
            margin-top: 20px;
            padding: 15px;
            border-radius: 8px;
            font-size: 14px;
        }
        .status.success { background: #d4edda; color: #155724; }
        .status.error { background: #f8d7da; color: #721c24; }
        .status.loading { background: #cce5ff; color: #004085; }
        #turnstile-widget { display: flex; justify-content: center; margin-bottom: 20px; }
        .hidden { display: none; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Sam Wegram Bot</h1>
        <p id="description">请完成人机验证以继续使用 bot 服务</p>
        <div id="turnstile-widget"></div>
        <div id="status" class="status hidden"></div>
    </div>
    <script>
        var userId = '${userId}';
        var siteKey = '${siteKey || ''}';
        var verifyUrl = '/${prefix}/verify/' + userId;

        function showStatus(message, type) {
            var status = document.getElementById('status');
            status.textContent = message;
            status.className = 'status ' + type;
            status.classList.remove('hidden');
        }

        function showSuccess() {
            showStatus('验证成功！现在可以返回 Telegram 继续使用 bot。', 'success');
            document.getElementById('turnstile-widget').classList.add('hidden');
        }

        function showError(message) {
            showStatus('验证失败: ' + message, 'error');
        }

        function submitToken(token) {
            showStatus('验证中...', 'loading');
            fetch(verifyUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: token })
            }).then(function(r) { return r.json(); })
              .then(function(result) {
                if (result.success) {
                    showSuccess();
                } else {
                    showError(result.message || '未知错误');
                }
              }).catch(function() {
                showError('网络错误，请重试');
              });
        }

        if (siteKey) {
            var script = document.createElement('script');
            script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
            script.async = true;
            script.onload = function() {
                if (typeof turnstile !== 'undefined') {
                    turnstile.render('#turnstile-widget', {
                        sitekey: siteKey,
                        callback: submitToken,
                        'error-callback': function() { showError('验证组件加载失败'); },
                        'expired-callback': function() { showError('验证已过期，请重试'); }
                    });
                }
            };
            document.body.appendChild(script);
        } else {
            showError('站点密钥未配置，请联系 bot 管理员');
        }
    </script>
</body>
</html>`;
}

export async function handleWebhook(request, env, ownerUid, botToken, secretToken) {
    if (secretToken !== request.headers.get('X-Telegram-Bot-Api-Secret-Token')) {
        return new Response('Unauthorized', {status: 401});
    }

    const update = await request.json();
    if (!update.message) {
        return new Response('OK');
    }

    const message = update.message;
    const reply = message.reply_to_message;
    try {
        if (reply && message.chat.id.toString() === ownerUid) {
            const rm = reply.reply_markup;
            if (rm && rm.inline_keyboard && rm.inline_keyboard.length > 0) {
                let senderUid = rm.inline_keyboard[0][0].callback_data;
                if (!senderUid) {
                    senderUid = rm.inline_keyboard[0][0].url.split('tg://user?id=')[1];
                }

                await postToTelegramApi(botToken, 'copyMessage', {
                    chat_id: parseInt(senderUid),
                    from_chat_id: message.chat.id,
                    message_id: message.message_id
                });
            }

            return new Response('OK');
        }

        if ("/start" === message.text) {
            return new Response('OK');
        }

        // Check verification status for non-owner messages
        const senderUid = message.chat.id.toString();
        console.log('senderUid:', senderUid);
        if (env.VERIFIED_USERS) {
            const verified = await env.VERIFIED_USERS.get(`verified:${senderUid}`);
            console.log('verified value:', verified, 'key:', `verified:${senderUid}`);
            if (!verified) {
                // Send verification prompt
                const url = new URL(request.url);
                const verifyLink = `${url.protocol}//${url.hostname}/${env.PREFIX || 'public'}/verify-page/${senderUid}`;
                await postToTelegramApi(botToken, 'sendMessage', {
                    chat_id: parseInt(senderUid),
                    text: `请先完成人机验证才能使用 bot:\n${verifyLink}`,
                    parse_mode: 'HTML'
                });
                return new Response('OK');
            }
        }

        const sender = message.chat;
        const senderName = sender.username ? `@${sender.username}` : [sender.first_name, sender.last_name].filter(Boolean).join(' ');

        const copyMessage = async function (withUrl = false) {
            const ik = [[{
                text: `🔏 From: ${senderName} (${senderUid})`,
                callback_data: senderUid,
            }]];

            if (withUrl) {
                ik[0][0].text = `🔓 From: ${senderName} (${senderUid})`
                ik[0][0].url = `tg://user?id=${senderUid}`;
            }

            return await postToTelegramApi(botToken, 'copyMessage', {
                chat_id: parseInt(ownerUid),
                from_chat_id: message.chat.id,
                message_id: message.message_id,
                reply_markup: {inline_keyboard: ik}
            });
        }

        const response = await copyMessage(true);
        if (!response.ok) {
            await copyMessage();
        }

        return new Response('OK');
    } catch (error) {
        console.error('Error handling webhook:', error);
        return new Response('Internal Server Error', {status: 500});
    }
}

export async function handleRequest(request, env, config) {
    const {prefix, secretToken} = config;

    const url = new URL(request.url);
    const path = url.pathname;

    const INSTALL_PATTERN = new RegExp(`^/${prefix}/install/([^/]+)/([^/]+)$`);
    const UNINSTALL_PATTERN = new RegExp(`^/${prefix}/uninstall/([^/]+)$`);
    const WEBHOOK_PATTERN = new RegExp(`^/${prefix}/webhook/([^/]+)/([^/]+)$`);
    const VERIFY_PATTERN = new RegExp(`^/${prefix}/verify/([^/]+)$`);

    let match;

    if (match = path.match(INSTALL_PATTERN)) {
        return handleInstall(request, match[1], match[2], prefix, secretToken);
    }

    if (match = path.match(UNINSTALL_PATTERN)) {
        return handleUninstall(match[1], secretToken);
    }

    if (match = path.match(VERIFY_PATTERN)) {
        return handleVerify(request, env, match[1]);
    }

    if (match = path.match(WEBHOOK_PATTERN)) {
        return handleWebhook(request, env, match[1], match[2], secretToken);
    }

    return new Response('Not Found', {status: 404});
}