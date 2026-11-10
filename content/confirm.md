---
title: "Confirm Your Subscription"
draft: false
searchHidden: true
hidemeta: true
disableShare: true
ShowReadingTime: false
ShowBreadCrumbs: false
ShowPostNavLinks: false
comments: false
# Keep this page out of the RSS feed and page lists
build:
  list: never
sitemap:
  disable: true
---

<div class="subscribe-confirm">
    <p id="confirm-text">One last step. Click the button below to start getting new posts from ayonkhan.ca by email.</p>
    <form id="confirm-form" method="post">
        <button type="submit">Confirm subscription</button>
    </form>
</div>

<script>
    (function () {
        var form = document.getElementById('confirm-form');
        var text = document.getElementById('confirm-text');

        // The link from the email carries the address, expiry and signature.
        // Send them along to /api/confirm when the button is clicked.
        if (window.location.search) {
            form.action = '/api/confirm' + window.location.search;
        } else {
            text.textContent = 'This page only works with the link from your confirmation email.';
            form.hidden = true;
        }
    })();
</script>
