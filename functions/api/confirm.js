import { verify } from '../../lib/token.js';

// Opening the link only shows the confirmation page. Email security tools
// often visit links on their own, so a visit alone must not subscribe anyone.
export async function onRequestGet(context) {
    var url = new URL(context.request.url);
    return Response.redirect(new URL('/confirm/' + url.search, url).toString(), 303);
}

// The Confirm button on that page sends a POST, which only a person clicking it does
export async function onRequestPost(context) {
    var env = context.env;
    var url = new URL(context.request.url);
    var email = url.searchParams.get('email') || '';
    var expires = Number(url.searchParams.get('expires'));
    var signature = url.searchParams.get('signature') || '';

    var valid = expires > Date.now() &&
        await verify(email + '|' + expires, signature, env.TOKEN_SECRET);
    if (!valid) {
        return new Response('This link is invalid or has expired.', { status: 400 });
    }

    var headers = {
        'Authorization': 'Bearer ' + env.RESEND_API_KEY,
        'Content-Type': 'application/json'
    };

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

    // If the contact already exists, just add it to the segment
    if (!created.ok) {
        var added = await fetch('https://api.resend.com/contacts/' +
            encodeURIComponent(email) + '/segments/' + env.SEGMENT_ID, {
            method: 'POST',
            headers: headers
        });
        if (!added.ok) {
            return new Response('Something went wrong. Please try again later.', { status: 502 });
        }
    }

    return Response.redirect(new URL('/subscribed/', url).toString(), 303);
}
