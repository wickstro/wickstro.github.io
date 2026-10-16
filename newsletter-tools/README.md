# Newsletter without Campaign Monitor

How it fits together:

1. **Signup form** (`_includes/newsletter-form.html`, on the front pages and collection pages)
   posts to `https://drhardman.fi/newsletter/subscribe.php`, also from the wickstro.github.io
   sandbox, which can't run PHP.
2. **`newsletter/*.php`** on drhardman.fi keeps the list in
   `/var/www/production/drhardman-newsletter/subscribers.csv`. That folder is outside the web
   root, so deploys (`rsync --delete`) never touch it and nobody can download it.
   - `subscribe.php`: adds the address (or turns a cancelled one back on)
   - `unsubscribe.php`: the link at the end of every newsletter (asks before removing)
   - `export.php?key=…`: current subscribers as CSV, for the Google Sheet
3. **Google Sheet + Apps Script** (this folder) fetches the list and sends the HTML newsletter
   from your own Gmail, one email per person, each with its own unsubscribe link.

This folder is not part of the website (excluded in `_config.yml`).

## One-time setup on the server

```sh
ssh lotta@pilvi.jco.fi
ps -o user= -C apache2 | sort -u          # the user PHP runs as, usually www-data
mkdir /var/www/production/drhardman-newsletter
cd /var/www/production/drhardman-newsletter
echo "<?php return ['export_key' => '$(openssl rand -hex 24)'];" > config.php
sudo chgrp www-data . config.php           # Apache must be able to write the folder
chmod 2770 .
chmod 640 config.php
cat config.php                             # the export key, needed in the Google Sheet
```

Then deploy the site as usual (README.md in the repo root). Test: sign up on drhardman.fi
with your own address. You should come back to the same page with a thank-you message, and
`subscribers.csv` should appear in the folder.

If the form says "something went wrong", look in Apache's error log for lines starting
with `newsletter subscribe:`. They usually mean the folder isn't writable for Apache.

## One-time setup in Google

1. Make a new Google Sheet, e.g. "Dr Hardman newsletter".
2. **Extensions → Apps Script.** Replace the contents of `Code.gs` with `Code.gs` from this
   folder.
3. Add two HTML files (**+ → HTML**) named `uutiskirje_fi` and `nyhetsbrev_sv`, and paste in
   `uutiskirje_fi.html` and `nyhetsbrev_sv.html`.
4. Save, go back to the sheet and reload it. A **Newsletter** menu appears.
5. **Newsletter → Set export address**:
   `https://drhardman.fi/newsletter/export.php?key=<the key from config.php>`.
   The first time, Google asks you to allow the script to send email and fetch the list.

## Each newsletter

1. Edit the two templates in the Apps Script editor. The `<title>` is the subject line. Copy
   a product row for each product. Keep the unsubscribe link at the bottom.
2. **Newsletter → Start a new round** (clears the Sent column from the last newsletter).
3. **1. Fetch subscribers** gets the current list from drhardman.fi.
4. **2. Send test to me** sends both language versions to you. Check them on phone and computer.
5. **3. Send newsletter.** A normal Gmail account can send to about 100 people a day this way
   (Google Workspace: 1,500). If the list is longer, run step 3 again the next day; it
   continues where it stopped.

People who unsubscribe drop off the list straight away. Fetch subscribers again before each
send so they don't get the next one.

## Good to know

- The list on the server is the master copy; the sheet is only a working copy.
- Fetch once more just before sending, so you don't mail anyone who unsubscribed after your last fetch.
- If a reply says "please remove me", open their unsubscribe link from the sheet and press the
  button, or edit `subscribers.csv` (status `unsubscribed`).
