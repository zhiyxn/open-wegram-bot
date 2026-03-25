/**
 * Cloudflare Turnstile API wrapper
 */

const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export async function verifyTurnstileToken(token, secretKey) {
    try {
        const response = await fetch(TURNSTILE_VERIFY_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                secret: secretKey,
                response: token
            })
        });

        const result = await response.json();
        return {
            success: result.success === true,
            message: result['error-codes'] ? result['error-codes'][0] : null
        };
    } catch (error) {
        return {
            success: false,
            message: error.message
        };
    }
}