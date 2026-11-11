// Tests the Functions with fake requests, so no real Resend or Turnstile calls are made.
// Run them with: node --test
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { onRequestPost as subscribe } from '../functions/api/subscribe.js';
import { onRequestGet as openLink, onRequestPost as confirm } from '../functions/api/confirm.js';
import { onRequestGet as openUnsubscribe, onRequestPost as unsubscribe } from '../functions/api/unsubscribe.js';

var env = {
    RESEND_API_KEY: 're_test',
    TURNSTILE_SECRET: 'turnstile-test',
    TOKEN_SECRET: 'token-test',
    FROM_EMAIL: 'Test <blog@news.example.com>',
    SEGMENT_ID: 'segment-test'
};

// Every call to Resend is recorded here instead of being sent
var sent;
var turnstilePasses;
// Set these to make Resend answer with an error for one kind of call
var contactExists;
var emailFails;

beforeEach(function () {
    sent = [];
    turnstilePasses = true;
    contactExists = false;
    emailFails = false;
    globalThis.fetch = async function (url, options) {
        if (String(url).includes('siteverify')) {
            return Response.json({ success: turnstilePasses });
        }
        sent.push({ url: String(url), method: options.method, body: options.body ? JSON.parse(options.body) : null });
        if (contactExists && String(url) === 'https://api.resend.com/contacts') {
            return new Response('{}', { status: 409 });
        }
        if (emailFails && String(url) === 'https://api.resend.com/emails') {
            return new Response('{}', { status: 500 });
        }
        return new Response('{}', { status: 200 });
    };
});

function signupRequest(email, site) {
    var form = new FormData();
    form.append('email', email);
    form.append('cf-turnstile-response', 'token');
    return new Request((site || 'https://www.example.com') + '/api/subscribe', { method: 'POST', body: form });
}

// Signs up, then returns the confirmation link from the email
async function getConfirmLink() {
    await subscribe({ env: env, request: signupRequest('reader@example.com') });
    return sent[0].body.html.match(/href="([^"]+)"/)[1];
}

test('the confirmation email names the site by its address', async function () {
    var response = await subscribe({ env: env, request: signupRequest('reader@example.com') });
    assert.equal(response.status, 200);
    assert.equal(sent[0].body.subject, 'Confirm your subscription to example.com');
    assert.equal(sent[0].body.to, 'reader@example.com');
});

test('SITE_NAME replaces the address, and is escaped in the email body', async function () {
    await subscribe({ env: { ...env, SITE_NAME: 'Tips & <Tricks>' }, request: signupRequest('reader@example.com') });
    assert.equal(sent[0].body.subject, 'Confirm your subscription to Tips & <Tricks>');
    assert.match(sent[0].body.html, /Tips &amp; &lt;Tricks&gt;/);
});

test('an invalid email address is rejected', async function () {
    var response = await subscribe({ env: env, request: signupRequest('not-an-email') });
    assert.equal(response.status, 400);
    assert.equal(sent.length, 0);
});

test('a failed Turnstile check is rejected', async function () {
    turnstilePasses = false;
    var response = await subscribe({ env: env, request: signupRequest('reader@example.com') });
    assert.equal(response.status, 403);
    assert.equal(sent.length, 0);
});

test('opening the link only shows the confirm page', async function () {
    var link = await getConfirmLink();
    var apiLink = link.replace('/confirm/', '/api/confirm');
    sent = [];
    var response = await openLink({ request: new Request(apiLink) });
    assert.equal(response.status, 303);
    assert.match(response.headers.get('location'), /\/confirm\/\?email=/);
    assert.equal(sent.length, 0);
});

test('pressing Confirm adds the reader to the segment', async function () {
    var link = await getConfirmLink();
    sent = [];
    var response = await confirm({ env: env, request: new Request(link.replace('/confirm/', '/api/confirm'), { method: 'POST' }) });
    assert.equal(response.status, 303);
    assert.equal(response.headers.get('location'), 'https://www.example.com/subscribed/');
    assert.deepEqual(sent[0].body.segments, [{ id: 'segment-test' }]);
});

// Confirms, then returns the welcome email that was sent
async function confirmAndGetWelcome() {
    var link = await getConfirmLink();
    sent = [];
    await confirm({ env: env, request: new Request(link.replace('/confirm/', '/api/confirm'), { method: 'POST' }) });
    return sent.find(function (call) { return call.url === 'https://api.resend.com/emails'; }).body;
}

function unsubscribeLink(welcome) {
    return welcome.html.match(/href="([^"]+)"/)[1].replace(/&amp;/g, '&');
}

test('confirming sends a welcome email with an unsubscribe link', async function () {
    var welcome = await confirmAndGetWelcome();
    assert.equal(welcome.subject, 'You\'re subscribed to example.com');
    assert.equal(welcome.to, 'reader@example.com');
    assert.match(unsubscribeLink(welcome), /^https:\/\/www\.example\.com\/unsubscribe\/\?email=/);
    assert.match(welcome.headers['List-Unsubscribe'], /^<https:\/\/www\.example\.com\/api\/unsubscribe\?email=/);
    assert.equal(welcome.headers['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click');
});

test('confirming again clears an earlier unsubscribe', async function () {
    var link = await getConfirmLink();
    sent = [];
    contactExists = true;
    var response = await confirm({ env: env, request: new Request(link.replace('/confirm/', '/api/confirm'), { method: 'POST' }) });
    assert.equal(response.status, 303);
    var cleared = sent.find(function (call) { return call.method === 'PATCH'; });
    assert.equal(cleared.url, 'https://api.resend.com/contacts/reader%40example.com');
    assert.deepEqual(cleared.body, { unsubscribed: false });
});

test('a failed welcome email still finishes the subscription', async function (t) {
    t.mock.method(console, 'error', function () {});
    var link = await getConfirmLink();
    emailFails = true;
    var response = await confirm({ env: env, request: new Request(link.replace('/confirm/', '/api/confirm'), { method: 'POST' }) });
    assert.equal(response.status, 303);
    assert.equal(response.headers.get('location'), 'https://www.example.com/subscribed/');
});

test('opening the unsubscribe link only shows the unsubscribe page', async function () {
    var link = unsubscribeLink(await confirmAndGetWelcome());
    sent = [];
    var response = await openUnsubscribe({ request: new Request(link.replace('/unsubscribe/', '/api/unsubscribe')) });
    assert.equal(response.status, 303);
    assert.match(response.headers.get('location'), /\/unsubscribe\/\?email=/);
    assert.equal(sent.length, 0);
});

test('pressing Unsubscribe marks the contact as unsubscribed', async function () {
    var link = unsubscribeLink(await confirmAndGetWelcome());
    sent = [];
    var response = await unsubscribe({ env: env, request: new Request(link.replace('/unsubscribe/', '/api/unsubscribe'), { method: 'POST' }) });
    assert.equal(response.status, 303);
    assert.equal(response.headers.get('location'), 'https://www.example.com/unsubscribed/');
    assert.equal(sent[0].method, 'PATCH');
    assert.equal(sent[0].url, 'https://api.resend.com/contacts/reader%40example.com');
    assert.deepEqual(sent[0].body, { unsubscribed: true });
});

test('a mail app\'s one-click unsubscribe works too', async function () {
    var welcome = await confirmAndGetWelcome();
    var oneClick = welcome.headers['List-Unsubscribe'].slice(1, -1);
    sent = [];
    var response = await unsubscribe({ env: env, request: new Request(oneClick, { method: 'POST', body: 'List-Unsubscribe=One-Click' }) });
    assert.equal(response.status, 200);
    assert.deepEqual(sent[0].body, { unsubscribed: true });
});

test('a confirmation link can\'t be used to unsubscribe', async function () {
    var link = await getConfirmLink();
    sent = [];
    var response = await unsubscribe({ env: env, request: new Request(link.replace('/confirm/', '/api/unsubscribe'), { method: 'POST' }) });
    assert.equal(response.status, 400);
    assert.equal(sent.length, 0);
});

test('a changed link is rejected', async function () {
    var link = await getConfirmLink();
    var changed = link.replace('/confirm/', '/api/confirm').replace('reader%40example.com', 'someone-else%40example.com');
    sent = [];
    var response = await confirm({ env: env, request: new Request(changed, { method: 'POST' }) });
    assert.equal(response.status, 400);
    assert.equal(sent.length, 0);
});

test('missing settings stop with a clear error', async function (t) {
    var logged = t.mock.method(console, 'error', function () {});
    var response = await subscribe({ env: { RESEND_API_KEY: 're_test' }, request: signupRequest('reader@example.com') });
    assert.equal(response.status, 500);
    assert.equal(logged.mock.calls[0].arguments[0], 'Missing settings: TURNSTILE_SECRET, TOKEN_SECRET, FROM_EMAIL');
    assert.equal(sent.length, 0);
});
