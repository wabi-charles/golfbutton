# Club Picker

A one-file web page for the driving range. Press the big red button, get a club to hit.

- Open `index.html` in any browser (works from a `file://` URL, no server needed).
- On a phone, open it and use **Add to Home Screen** for a full-screen app.
- Tap the gear for settings. Everything is saved in the browser.

## Modes

- **Random** (default) - any club in play, every press, repeats allowed.
- **No repeats** - shuffles through every club in play before repeating.
- **Simulate full course** - a real par 72 routing, 6,750 yards. It shows the hole,
  the par, the yardage, the shot number and the distance left, and calls the club
  that fits. The driver only comes out on the tee. Regulation is 36 swings a round.
- **Simulate par 3 course** - 18 one-shot holes from 90 to 210 yards.

## Distances

Every club's carry is derived from one number: your 7 iron. Set it at the bottom of
settings (default 150 yards) and the whole bag plus the course length scale with it,
so a 120 yard 7 iron plays a proportionally shorter course. Each club chip shows its
carry so you can sanity-check the gapping.

## Clubs

Every wood (Driver, 2, 3, 4, 5, 7, 9, 11), hybrid (2-7), iron (1-9), and wedge
(PW, 46-64 degrees). Default bag: Driver, 3W, 5W, 4H, 5-9 iron, PW, 52, 56, 60.

## Installing it

The site is a progressive web app. On a phone, open it and use Add to Home
Screen: it gets its own icon, opens without browser chrome, and works with no
signal. The page is cached by `sw.js`, network-first so a new deploy still
reaches you on the next load that has a connection.

The screen stays awake while the app is open, and tapping anywhere on the
main screen advances, not just the button.

## Layout

- `index.html` - markup and styles
- `logic.js` - the golf: clubs, yardages, the course, the shot simulation. No DOM.
- `app.js` - storage, settings UI, event wiring
- `sw.js`, `manifest.webmanifest`, `icon-*.png` - installable, offline
- `test.js` - run with `node test.js`

`logic.js` holds no browser references, so the yardage model and the round
simulation can be exercised directly. Cases marked "regression" in the tests
are bugs that actually shipped; leave them in.

Changing anything in the cached shell means bumping `CACHE` in `sw.js`, or
installed users keep the old copy.

