import { sign, verify } from '../../lib/token.js';
import { missingSettings } from '../../lib/settings.js';
import { siteName, escapeHtml, resendHeaders } from '../../lib/emails.js';

// Opening the link only shows the confirmation page. Email security tools
// often visit links on their own, so a visit alone must not subscribe anyone.
export async function onRequestGet(context) {
    var url = new URL(context.request.url);
    return Response.redirect(new URL('/confirm/' + url.search, url).toString(), 303);
}

// The Confirm button on that page sends a POST, which only a person clicking it does
export async function onRequestPost(context) {
    var env = context.env;

    var missing = missingSettings(env, ['RESEND_API_KEY', 'TOKEN_SECRET', 'SEGMENT_ID', 'FROM_EMAIL']);
    if (missing) return missing;

    var url = new URL(context.request.url);
    var email = url.searchParams.get('email') || '';
    var expires = Number(url.searchParams.get('expires'));
    var signature = url.searchParams.get('signature') || '';

    var valid = expires > Date.now() &&
        await verify(email + '|' + expires, signature, env.TOKEN_SECRET);
    if (!valid) {
        return new Response('This link is invalid or has expired.', { status: 400 });
    }

    var headers = resendHeaders(env);
    var contact = 'https://api.resend.com/contacts/' + encodeURIComponent(email);

    // Add the contact straight into the subscribers segment
    var created = await fetch('https://api.resend.com/contacts', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
            email: email,
            unsubscribed: false,
            segments: [{ id: env.SEGMENT_ID }]
        })
    });

    // If the contact already exists, add it to the segment. Someone who
    // unsubscribed before is still marked as unsubscribed, so clear that too,
    // or they'd never get another email.
    if (!created.ok) {
        var added = await fetch(contact + '/segments/' + env.SEGMENT_ID, {
            method: 'POST',
            headers: headers
        });
        var resubscribed = await fetch(contact, {
            method: 'PATCH',
            headers: headers,
            body: JSON.stringify({ unsubscribed: false })
        });
        if (!added.ok || !resubscribed.ok) {
            return new Response('Something went wrong. Please try again later.', { status: 502 });
        }
    }

    // The subscription is done. If the welcome email fails, it's only logged,
    // so the reader still lands on the "You're Subscribed" page.
    try {
        await sendWelcome(env, email, url);
    } catch (error) {
        console.error('Welcome email failed: ' + error.message);
    }

    return Response.redirect(new URL('/subscribed/', url).toString(), 303);
}

// Confirms the subscription, with an unsubscribe link that works right away,
// whatever the site uses to send emails later.
async function sendWelcome(env, email, url) {
    var name = siteName(env, url);

    // The unsubscribe link never expires. "unsubscribe|" keeps its signature
    // different from a confirmation link's.
    var signature = await sign('unsubscribe|' + email, env.TOKEN_SECRET);
    var query = '?email=' + encodeURIComponent(email) + '&signature=' + signature;
    var page = new URL('/unsubscribe/' + query, url);
    var oneClick = new URL('/api/unsubscribe' + query, url);

    var sent = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: resendHeaders(env),
        body: JSON.stringify({
            from: env.FROM_EMAIL,
            reply_to: env.REPLY_TO,
            to: email,
            subject: 'You\'re subscribed to ' + name,
            // Lets mail apps show their own Unsubscribe button
            headers: {
                'List-Unsubscribe': '<' + oneClick + '>',
                'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'
            },
            html: '<p>Thanks for confirming. You\'re now subscribed to new posts on ' +
                escapeHtml(name) + '.</p>' +
                '<p>If you change your mind, you can <a href="' + page + '">unsubscribe here</a> at any time.</p>'
        })
    });

    if (!sent.ok) throw new Error('Resend returned ' + sent.status);
}
