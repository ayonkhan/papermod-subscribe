import { verify } from '../../lib/token.js';
import { missingSettings } from '../../lib/settings.js';
import { resendHeaders } from '../../lib/emails.js';

// Opening the link only shows the unsubscribe page, for the same reason as
// confirming: link scanners visit links, and a visit alone shouldn't count.
export async function onRequestGet(context) {
    var url = new URL(context.request.url);
    return Response.redirect(new URL('/unsubscribe/' + url.search, url).toString(), 303);
}

// Runs when the reader presses Unsubscribe on that page, or when a mail app's
// own Unsubscribe button sends a one-click request
export async function onRequestPost(context) {
    var env = context.env;
    var request = context.request;

    var missing = missingSettings(env, ['RESEND_API_KEY', 'TOKEN_SECRET']);
    if (missing) return missing;

    var url = new URL(request.url);
    var email = url.searchParams.get('email') || '';
    var signature = url.searchParams.get('signature') || '';

    if (!await verify('unsubscribe|' + email, signature, env.TOKEN_SECRET)) {
        return new Response('This link is invalid.', { status: 400 });
    }

    // The same as unsubscribing from a broadcast's link: Resend stops sending
    // broadcasts to this contact
    var updated = await fetch('https://api.resend.com/contacts/' + encodeURIComponent(email), {
        method: 'PATCH',
        headers: resendHeaders(env),
        body: JSON.stringify({ unsubscribed: true })
    });

    // A contact that no longer exists won't get any email either
    if (!updated.ok && updated.status !== 404) {
        return new Response('Something went wrong. Please try again later.', { status: 502 });
    }

    // Mail apps only need to know it worked. A person gets the confirmation page.
    var body = await request.text();
    if (body.includes('List-Unsubscribe=One-Click')) {
        return new Response('Unsubscribed');
    }
    return Response.redirect(new URL('/unsubscribed/', url).toString(), 303);
}
