import { sign } from '../../lib/token.js';

var ONE_DAY = 24 * 60 * 60 * 1000;

export async function onRequestPost(context) {
    var env = context.env;
    var request = context.request;
    var form = await request.formData();
    var email = String(form.get('email') || '').trim().toLowerCase();

    // Email addresses can't be longer than 254 characters
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return new Response('Invalid email', { status: 400 });
    }

    // Make sure a person filled in the form, not a bot
    var check = new FormData();
    check.append('secret', env.TURNSTILE_SECRET);
    check.append('response', form.get('cf-turnstile-response') || '');
    check.append('remoteip', request.headers.get('CF-Connecting-IP') || '');
    var turnstile = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        body: check
    }).then(function (response) { return response.json(); });

    if (!turnstile.success) {
        return new Response('Verification failed', { status: 403 });
    }

    // Build a signed confirmation link that expires in a day.
    // It opens a page with a button, so link scanners can't confirm on their own.
    var expires = Date.now() + ONE_DAY;
    var signature = await sign(email + '|' + expires, env.TOKEN_SECRET);
    var link = new URL('/confirm/', request.url);
    link.searchParams.set('email', email);
    link.searchParams.set('expires', expires);
    link.searchParams.set('signature', signature);

    var sent = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
            'Authorization': 'Bearer ' + env.RESEND_API_KEY,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            from: env.FROM_EMAIL,
            reply_to: env.REPLY_TO,
            to: email,
            subject: 'Confirm your subscription to ayonkhan.ca',
            html: '<p>Thanks for subscribing to new posts on ayonkhan.ca. Please confirm your email address:</p>' +
                '<p><a href="' + link + '">Confirm subscription</a></p>' +
                '<p>The link works for 24 hours. If you didn\'t sign up, you can ignore this email, ' +
                'and you won\'t get any more.</p>'
        })
    });

    if (!sent.ok) {
        return new Response('Could not send email', { status: 502 });
    }
    return new Response('OK');
}
