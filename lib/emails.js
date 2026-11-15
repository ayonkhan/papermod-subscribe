// Shared helpers for the emails the Functions send

// SITE_NAME is optional. Without it, emails use the site's address, such as example.com
export function siteName(env, requestUrl) {
    return env.SITE_NAME || new URL(requestUrl).hostname.replace(/^www\./, '');
}

// Optional settings that are missing, empty or only spaces count as not set
export function setting(value) {
    return (value || '').trim();
}

// Ends an email with a closing, such as "Thanks,", and SIGN_OFF_NAME, like a
// letter. The email is only signed when both are set.
export function signOff(closing, env) {
    var name = setting(env.SIGN_OFF_NAME);
    closing = setting(closing);
    if (!name || !closing) return '';
    return '<p>' + escapeHtml(closing) + '<br>' + escapeHtml(name) + '</p>';
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
