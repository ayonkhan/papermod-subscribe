# PaperMod Subscribe

[![Tests](https://github.com/ayonkhan/papermod-subscribe/actions/workflows/test.yml/badge.svg)](https://github.com/ayonkhan/papermod-subscribe/actions/workflows/test.yml)

Email subscriptions for Hugo sites that use the [PaperMod](https://github.com/adityatelange/hugo-PaperMod) theme and are hosted on [Cloudflare Pages](https://pages.cloudflare.com/).

It adds a signup form under each post. Readers confirm their address by email, then get added to a segment in [Resend](https://resend.com/). From there, you can email them with Resend's broadcasts, or automatically with [Paperboy](https://github.com/ayonkhan/paperboy).

You can see it under any post on [ayonkhan.ca](https://www.ayonkhan.ca/).

## Features

- **Double opt-in:** nobody is added until they confirm from the email.
- **Spam protection** with Cloudflare Turnstile, which most readers never see.
- **No database:** confirmation links are signed and expire after 24 hours, so there's nothing to store.
- **Safe from link scanners:** some email security tools open every link in an email. The confirmation link opens a page with a button, so a scanner can't subscribe someone by accident.
- **Private:** the form never says whether an address is already subscribed.
- **Easy to leave:** a welcome email confirms the subscription, with an unsubscribe link that works straight away.
- **Matches your theme:** the form uses PaperMod's own colours, in light and dark mode.
- **Free** on the free plans of Cloudflare and Resend.

## Requirements

- Hugo 0.158 or newer, the same as PaperMod
- A site using PaperMod, hosted on Cloudflare Pages, which runs the small Functions behind the form
- A [Resend](https://resend.com/) account with a verified domain
- A [Cloudflare Turnstile](https://www.cloudflare.com/application-services/products/turnstile/) widget

## Install

### 1. Add the Component

From your site's folder:

```bash
git submodule add https://github.com/ayonkhan/papermod-subscribe.git themes/papermod-subscribe
```

### 2. Turn It On

In your site's config, list it before PaperMod:

```yaml
theme: ["papermod-subscribe", "PaperMod"]
```

Hugo combines the files from both, and the first one wins when they have a file with the same name.

Then add these under `params`:

```yaml
params:
  comments: true
  subscribe: true
  turnstileSiteKey: "your-turnstile-site-key"
```

The form goes in the spot at the end of each post that PaperMod keeps for comments, so `comments` needs to be on. This doesn't add a comment system: if you don't have one, the form simply shows there on its own.

### 3. Add the Functions

Cloudflare Pages only runs Functions from your site's own `functions` folder. Create these three files, each one line long. They point to the code in the component, so updating the component updates them too.

`functions/api/subscribe.js`:

```js
export { onRequestPost } from '../../themes/papermod-subscribe/functions/api/subscribe.js';
```

`functions/api/confirm.js`:

```js
export { onRequestGet, onRequestPost } from '../../themes/papermod-subscribe/functions/api/confirm.js';
```

`functions/api/unsubscribe.js`:

```js
export { onRequestGet, onRequestPost } from '../../themes/papermod-subscribe/functions/api/unsubscribe.js';
```

### 4. If You Already Have Comments

If your site has its own `comments.html`, for Giscus or Disqus for example, Hugo uses yours instead of the component's. Add this line at the top of it to show the form above your comments:

```go-html-template
{{ if .Param "subscribe" }}{{ partial "subscribe.html" . }}{{ end }}
```

If you don't have that file, there's nothing to do.

## Set Up the Services

### Resend

1. Add and verify your sending domain. Resend recommends a subdomain, such as `news.example.com`.
2. Under **Audience**, create a segment for subscribers, and copy its ID.
3. Under **API Keys**, create a key with sending access.

### Turnstile

1. In Cloudflare, go to **Turnstile** and add a widget.
2. Add your site's domain as a hostname.
3. Choose **Managed** mode.
4. Copy the site key into your config as `turnstileSiteKey`, and keep the secret key for the next step.

### Cloudflare Pages

In your Pages project, go to **Settings > Variables and Secrets** and add:

| Name | Type | Example |
| --- | --- | --- |
| `RESEND_API_KEY` | Secret | `re_...` |
| `TURNSTILE_SECRET` | Secret | the Turnstile secret key |
| `TOKEN_SECRET` | Secret | a long random string, used to sign confirmation links |
| `FROM_EMAIL` | Text | `Your Name <blog@news.example.com>` |
| `SEGMENT_ID` | Text | the Resend segment ID |
| `REPLY_TO` | Text | `hello@example.com` (optional, where replies go) |
| `SITE_NAME` | Text | `My Blog` (optional, defaults to your site's address, such as `example.com`) |

To create `TOKEN_SECRET`, run this and copy what it prints:

```bash
openssl rand -hex 32
```

It prints 64 random characters. Keep it the same once readers have signed up. Changing it stops the links in earlier emails from working: confirmation links that haven't been clicked yet, and the unsubscribe links in welcome emails. Nobody gets unsubscribed, and the links in new post emails keep working, since those come from Resend.

Push your changes, and Cloudflare Pages builds the site with the form. If a setting is missing, the signup fails with an error naming it, which you can find under the Functions logs in Cloudflare.

## Options

To hide the form on one post, add this to its front matter:

```yaml
subscribe: false
```

To turn it off everywhere, set `subscribe: false` under `params`.

To change any of the text, copy the file into the same place in your own site and edit it there. Your copy takes priority:

| To change | Copy |
| --- | --- |
| The form | `layouts/_partials/subscribe.html` |
| The confirm page's text and button | `layouts/_shortcodes/subscribe-confirm.html` |
| The confirm page's title | `content/confirm.md` |
| The "You're Subscribed" page | `content/subscribed.md` |
| The unsubscribe page's text and button | `layouts/_shortcodes/unsubscribe-confirm.html` |
| The "You're Unsubscribed" page | `content/unsubscribed.md` |

To change the styling, add your own CSS in `assets/css/extended/`.

## Test Locally

`hugo server` shows the form and the pages, but it can't run the Functions. To test the whole signup, create a `.dev.vars` file in your site's folder with the same settings as above, and add it to `.gitignore`, so it never gets committed. For Turnstile, use Cloudflare's test secret, `1x0000000000000000000000000000000AA`, which always passes.

Build the site in development mode, so the form uses Turnstile's test site key:

```bash
hugo --environment development --baseURL http://localhost:8788/ --cleanDestinationDir
```

Then serve it together with the Functions:

```bash
npx wrangler pages dev public --compatibility-date=2026-10-25
```

Then open:

```text
http://localhost:8788
```

Sign up with your own address. The confirmation email is real, so use an address you can check. Locally, it names the site "localhost".

## Update

To get the latest version of the component:

```bash
git submodule update --remote --merge themes/papermod-subscribe
```

Then test it, commit the change and push.

## How It Works

1. A reader enters their email address. Turnstile checks they're human.
2. `functions/api/subscribe.js` checks the Turnstile result, signs the address with `TOKEN_SECRET`, and emails a confirmation link through Resend.
3. The link opens the confirm page, which has one button. Clicking it sends the signed link to `functions/api/confirm.js`.
4. The Function checks the signature and the expiry, then adds the address to your Resend segment.
5. The reader lands on the "You're Subscribed" page, and gets a welcome email with an unsubscribe link.
6. That link opens the unsubscribe page, which also has one button. Clicking it sends the link to `functions/api/unsubscribe.js`, which marks the contact as unsubscribed in Resend.

| File | What it does |
| --- | --- |
| `layouts/_partials/subscribe.html` | The form, with Turnstile |
| `layouts/_partials/comments.html` | Shows the form at the end of each post |
| `layouts/_shortcodes/subscribe-confirm.html` | The Confirm button, as a shortcode so it works without raw HTML in Markdown |
| `layouts/_shortcodes/unsubscribe-confirm.html` | The Unsubscribe button |
| `assets/css/extended/subscribe.css` | Styles the form with PaperMod's colours |
| `content/confirm.md` | The page the confirmation link opens |
| `content/subscribed.md` | The page shown after confirming |
| `content/unsubscribe.md` | The page the unsubscribe link opens |
| `content/unsubscribed.md` | The page shown after unsubscribing |
| `functions/api/subscribe.js` | Checks Turnstile and sends the confirmation email |
| `functions/api/confirm.js` | Checks the link, adds the subscriber and sends the welcome email |
| `functions/api/unsubscribe.js` | Checks the unsubscribe link and unsubscribes the reader |
| `lib/token.js` | Signs and checks confirmation and unsubscribe links |
| `lib/emails.js` | Small helpers shared by the emails |
| `lib/settings.js` | Stops with a clear error when a setting is missing |
| `tests/functions.test.mjs` | Tests for the Functions |

## Tests

The Functions have automated tests, which run on GitHub every time code is pushed. To run them yourself, you need Node.js 22 or newer:

```bash
node --test
```

They use fake requests, so they don't need a Resend or Turnstile account.

## Emails for New Posts

This component handles signups. To email subscribers when you publish, see [Paperboy](https://github.com/ayonkhan/paperboy), a Cloudflare Worker that checks your RSS feed every hour and sends each new post to your segment.

You can also write emails yourself in Resend under **Broadcasts**, and send them to the same segment.

## Unsubscribing

The welcome email has its own unsubscribe link, so readers can leave at any time, whatever you use to email them later. It opens a page with an Unsubscribe button, for the same reason as the Confirm button. The link never expires. The welcome email also has a List-Unsubscribe header, so mail apps can show their own Unsubscribe button.

Unsubscribing marks the contact as unsubscribed in Resend, the same as unsubscribing from a broadcast, so Resend stops sending them broadcasts. If they sign up again later, confirming clears it.

## License

[MIT](LICENSE)
