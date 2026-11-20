# Kitchen screen (web)

The web version of the Order Listener kitchen screen (KDS). Plain HTML, CSS and JavaScript: no build step, no server, no secrets in this repo.

**Live page:** https://sarangbutter-admin.github.io/my-web/

## What it does
- **Try the demo** - sample orders so you can look around on any PC, Mac, iPhone or iPad.
- **Open my KDS** - type the address shown on your KDS phone (Settings -> Kitchen display, e.g. `192.168.1.50:8765`) and the page opens the kitchen screen that the phone itself serves, with live orders, over your shop WiFi.

A browser will not let an `https` page (like this one) talk to the phone's plain `http` address, so this page is a launcher plus demo. The live screen is served by the KDS phone (Order Listener build 9 or newer).

## iPhone / iPad / Mac
Open the KDS address in Safari, then Share -> Add to Home Screen. Set Auto-Lock to Never so the screen stays on. Sound starts after you tap the speaker button once.

## Files
`index.html`, `app.js`, `style.css`, `manifest.webmanifest`, icons. The same files are packed into the Order Listener app (`app/src/main/assets/web`).
