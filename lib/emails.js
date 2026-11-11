// Shared helpers for the emails the Functions send

// SITE_NAME is optional. Without it, emails use the site's address, such as example.com
export function siteName(env, requestUrl) {
    return env.SITE_NAME || new URL(requestUrl).hostname.replace(/^www\./, '');
}

export function escapeHtml(text) {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function resendHeaders(env) {
    return {
        'Authorization': 'Bearer ' + env.RESEND_API_KEY,
        'Content-Type': 'application/json'
    };
}
