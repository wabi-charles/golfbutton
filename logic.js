// Golf Button: the parts that are just golf, with no browser in them.
// Split out of index.html so `node test.js` can exercise the yardage model and
// the shot simulation directly. Loads as a global in the page, a module in Node.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GolfLogic = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

// ratio: carry distance as a multiple of the player's 7 iron.
const CLUBS = [
  { id: 'driver', label: 'Driver',  short: 'Dr',  group: 'Woods',   kind: 'driver', ratio: 1.60 },
  { id: '2w',  label: '2 Wood',  short: '2W',  group: 'Woods',   kind: 'wood',   ratio: 1.53 },
  { id: '3w',  label: '3 Wood',  short: '3W',  group: 'Woods',   kind: 'wood',   ratio: 1.49 },
  { id: '4w',  label: '4 Wood',  short: '4W',  group: 'Woods',   kind: 'wood',   ratio: 1.45 },
  { id: '5w',  label: '5 Wood',  short: '5W',  group: 'Woods',   kind: 'wood',   ratio: 1.41 },
  { id: '7w',  label: '7 Wood',  short: '7W',  group: 'Woods',   kind: 'wood',   ratio: 1.35 },
  { id: '9w',  label: '9 Wood',  short: '9W',  group: 'Woods',   kind: 'wood',   ratio: 1.29 },
  { id: '11w', label: '11 Wood', short: '11W', group: 'Woods',   kind: 'wood',   ratio: 1.23 },

  { id: '2h', label: '2 Hybrid', short: '2H', group: 'Hybrids', kind: 'hybrid', ratio: 1.39 },
  { id: '3h', label: '3 Hybrid', short: '3H', group: 'Hybrids', kind: 'hybrid', ratio: 1.34 },
  { id: '4h', label: '4 Hybrid', short: '4H', group: 'Hybrids', kind: 'hybrid', ratio: 1.29 },
  { id: '5h', label: '5 Hybrid', short: '5H', group: 'Hybrids', kind: 'hybrid', ratio: 1.24 },
  { id: '6h', label: '6 Hybrid', short: '6H', group: 'Hybrids', kind: 'hybrid', ratio: 1.19 },
  { id: '7h', label: '7 Hybrid', short: '7H', group: 'Hybrids', kind: 'hybrid', ratio: 1.13 },

  { id: '1i', label: '1 Iron', short: '1i', group: 'Irons', kind: 'iron', ratio: 1.42 },
  { id: '2i', label: '2 Iron', short: '2i', group: 'Irons', kind: 'iron', ratio: 1.35 },
  { id: '3i', label: '3 Iron', short: '3i', group: 'Irons', kind: 'iron', ratio: 1.28 },
  { id: '4i', label: '4 Iron', short: '4i', group: 'Irons', kind: 'iron', ratio: 1.21 },
  { id: '5i', label: '5 Iron', short: '5i', group: 'Irons', kind: 'iron', ratio: 1.14 },
  { id: '6i', label: '6 Iron', short: '6i', group: 'Irons', kind: 'iron', ratio: 1.07 },
  { id: '7i', label: '7 Iron', short: '7i', group: 'Irons', kind: 'iron', ratio: 1.00 },
  { id: '8i', label: '8 Iron', short: '8i', group: 'Irons', kind: 'iron', ratio: 0.93 },
  { id: '9i', label: '9 Iron', short: '9i', group: 'Irons', kind: 'iron', ratio: 0.86 },

  { id: 'pw', label: 'Pitching Wedge', short: 'PW',  group: 'Wedges', kind: 'wedge', ratio: 0.80 },
  { id: '46', label: '46° Wedge', short: '46°', group: 'Wedges', kind: 'wedge', ratio: 0.77 },
  { id: '48', label: '48° Wedge', short: '48°', group: 'Wedges', kind: 'wedge', ratio: 0.73 },
  { id: '50', label: '50° Wedge', short: '50°', group: 'Wedges', kind: 'wedge', ratio: 0.70 },
  { id: '52', label: '52° Wedge', short: '52°', group: 'Wedges', kind: 'wedge', ratio: 0.66 },
  { id: '54', label: '54° Wedge', short: '54°', group: 'Wedges', kind: 'wedge', ratio: 0.62 },
  { id: '56', label: '56° Wedge', short: '56°', group: 'Wedges', kind: 'wedge', ratio: 0.58 },
  { id: '58', label: '58° Wedge', short: '58°', group: 'Wedges', kind: 'wedge', ratio: 0.53 },
  { id: '60', label: '60° Wedge', short: '60°', group: 'Wedges', kind: 'wedge', ratio: 0.48 },
  { id: '62', label: '62° Wedge', short: '62°', group: 'Wedges', kind: 'wedge', ratio: 0.43 },
  { id: '64', label: '64° Wedge', short: '64°', group: 'Wedges', kind: 'wedge', ratio: 0.39 },
];

const DEFAULT_IDS = ['driver', '3w', '5w', '4h', '5i', '6i', '7i', '8i', '9i', 'pw', '52', '56', '60'];
const GROUPS = ['Woods', 'Hybrids', 'Irons', 'Wedges'];
const BY_ID = Object.fromEntries(CLUBS.map(c => [c.id, c]));
const VALID = new Set(CLUBS.map(c => c.id));

const REFERENCE_SEVEN = 150;   // the yardages below are drawn for a 150 yard 7 iron
const DEFAULT_SEVEN = 150;
const MIN_SEVEN = 70, MAX_SEVEN = 220;
const DEFAULT_HCP = 15, MIN_HCP = 0, MAX_HCP = 36;
const MODES = [
  { id: 'random',   set: 'Practice', short: 'Random',      button: 'Next Club',
    desc: 'Any club in play, every press. Repeats can happen.' },
  { id: 'norepeat', set: 'Practice', short: 'No repeats',  button: 'Next Club',
    desc: 'Work through every club in play before any comes up again.' },
  { id: 'distance', set: 'Practice', short: 'Yardages',    button: 'Next Yardage',
    desc: 'A number instead of a club. Choosing what to hit is the drill.' },
  { id: 'course',   set: 'Play',     short: 'Full course', button: 'Next Shot',
    desc: 'Blue tees, par 72, 6,400 yards. Every club is the one the shot calls for.' },
  { id: 'par3',     set: 'Play',     short: 'Par 3s',      button: 'Next Hole',
    desc: '18 one-shot holes, 90 to 210 yards, club matched to the number.' },
  { id: 'round',    set: 'Play',     short: 'Real round',  button: 'Next Shot',
    desc: 'The same course with the misses in it: OB, trees, punch outs, bunkers. Scaled to your handicap.' },
];
const MODE_SETS = ['Practice', 'Play'];
function modeDef(id) { return MODES.find(m => m.id === id) || MODES[0]; }
const DEFAULT_MODE = 'random';
// Par 72 off the blue tees, 6,400 yards. Par 4s sit around 370 so the normal
// second shot is a wedge through a 9 iron; 8 and 16 are the long exceptions.
const COURSE = [
  { par: 4, yards: 375 }, { par: 5, yards: 505 }, { par: 3, yards: 155 },
  { par: 4, yards: 400 }, { par: 4, yards: 350 }, { par: 3, yards: 175 },
  { par: 5, yards: 535 }, { par: 4, yards: 445 }, { par: 4, yards: 365 },
  { par: 4, yards: 355 }, { par: 3, yards: 140 }, { par: 5, yards: 490 },
  { par: 4, yards: 385 }, { par: 4, yards: 300 }, { par: 5, yards: 520 },
  { par: 3, yards: 195 }, { par: 4, yards: 370 }, { par: 4, yards: 340 },
];

// An 18 hole par 3 course.
const PAR3_COURSE = [155, 120, 185, 140, 205, 100, 165, 130, 175, 110, 195, 145, 90, 160, 125, 210, 135, 150];
function clampSeven(n) { return Math.min(MAX_SEVEN, Math.max(MIN_SEVEN, Math.round(n))); }
function clampHcp(n) { return Math.min(MAX_HCP, Math.max(MIN_HCP, Math.round(n))); }

function randomOf(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Everything below depends on the player's two numbers, so it is built per
// player rather than read off module state. Tests can spin up their own.
function createEngine(getSeven, getHandicap) {

  function yardsFor(club) { return Math.round(club.ratio * getSeven()); }
  function courseScale() { return getSeven() / REFERENCE_SEVEN; }
  function scaleYards(y) { return Math.max(40, Math.round(y * courseScale() / 5) * 5); }

  function nearestClub(bag, target) {
    let best = bag[0], bestGap = Infinity;
    for (const c of bag) {
      const gap = Math.abs(yardsFor(c) - target);
      if (gap < bestGap) { best = c; bestGap = gap; }
    }
    return best;
  }
  // Nobody hits driver off the deck, so it only comes out on the tee.
  function offTheDeck(bag) {
    const rest = bag.filter(c => c.kind !== 'driver');
    return rest.length ? rest : bag;
  }
  function longestClub(bag) {
    return bag.reduce((a, c) => (yardsFor(c) > yardsFor(a) ? c : a), bag[0]);
  }
  function shortestClub(bag) {
    return bag.reduce((a, c) => (yardsFor(c) < yardsFor(a) ? c : a), bag[0]);
  }
  function teeClub(bag, holeYards) {
    const driver = bag.find(c => c.kind === 'driver');
    const bigs = bag.filter(c => c.kind === 'driver' || c.kind === 'wood' || c.kind === 'hybrid');
    if (driver && holeYards > yardsFor(driver) * 0.95) return driver;   // full length hole
    if (driver && Math.random() < 0.6) return driver;                    // shorter hole, usually still driver
    const alt = (bigs.length ? bigs : bag).filter(c => c.kind !== 'driver');
    if (!alt.length) return driver || longestClub(bag);
    return nearestClub(alt, holeYards);
  }
  function makePicker(mode) {
    if (mode === 'norepeat') {
      let deck = [], total = 0, last = null;
      return {
        next(ids) {
          if (deck.length === 0) {
            deck = shuffle(ids);
            total = ids.length;
            if (deck.length > 1 && deck[deck.length - 1] === last) deck.unshift(deck.pop());
          }
          last = deck.pop();
          return { id: last, card: null, lines: ['Club ' + (total - deck.length) + ' of ' + total] };
        },
      };
    }

    if (mode === 'course') {
      let hole = -1, remaining = 0, shot = 0, holeYards = 0, needNewHole = true;
      return {
        next(ids) {
          const bag = ids.map(id => BY_ID[id]);
          const shortest = Math.min(...bag.map(yardsFor));
          if (needNewHole) {
            hole = (hole + 1) % COURSE.length;
            holeYards = scaleYards(COURSE[hole].yards);
            remaining = holeYards;
            shot = 0;
            needNewHole = false;
          }
          const par = COURSE[hole].par;
          shot += 1;

          const club = (shot === 1 && par > 3)
            ? teeClub(bag, holeYards)
            : nearestClub(offTheDeck(bag), remaining);
          const card = { hole: hole + 1, par: par, yards: holeYards };
          const lines = [shot === 1
            ? 'Shot 1 · Tee shot'
            : 'Shot ' + shot + ' · ' + remaining + ' yds in'];

          const carry = yardsFor(club) * (0.88 + Math.random() * 0.18);   // 88% to 106% of the number
          remaining = Math.max(0, Math.round(remaining - carry));
          const greenEdge = Math.max(15, Math.round(25 * courseScale()));
          if (remaining <= greenEdge || remaining < shortest * 0.4 || shot >= 8) needNewHole = true;

          return { id: club.id, card: card, lines: lines };
        },
      };
    }

    if (mode === 'distance') {
      let last = null;
      return {
        next(ids) {
          const bag = ids.map(id => BY_ID[id]);
          const lo = Math.min.apply(null, bag.map(yardsFor));
          const hi = Math.max.apply(null, bag.map(yardsFor));
          let y = null;
          for (let i = 0; i < 8 && (y === null || (y === last && hi > lo)); i++) {
            y = Math.round((lo + Math.random() * (hi - lo)) / 5) * 5;
          }
          last = y;
          return { id: nearestClub(bag, y).id, label: y + ' yds', card: null, lines: [] };
        },
      };
    }

    if (mode === 'round') {
      let hole = -1, remaining = 0, strokes = 0, holeYards = 0, lie = 'tee', note = '', needNewHole = true;
      let troubleThisHole = 0;
      return {
        next(ids) {
          const bag = ids.map(id => BY_ID[id]);
          const h = getHandicap();
          if (needNewHole) {
            hole = (hole + 1) % COURSE.length;
            holeYards = scaleYards(COURSE[hole].yards);
            remaining = holeYards; strokes = 0; lie = 'tee'; note = ''; needNewHole = false;
            troubleThisHole = 0;
          }
          const par = COURSE[hole].par;
          const card = { hole: hole + 1, par: par, yards: holeYards };
          strokes += 1;
          const shotNo = strokes;   // a penalty counts against the next swing, not this one
          const greenEdge = Math.max(15, Math.round(25 * courseScale()));

          // Anything inside the surrounds is putting, so the hole ends there.
          function settle(farLie) {
            if (remaining > greenEdge) { lie = farLie; return; }
            const pMissGreen = Math.min(0.72, 0.20 + h * 0.022);
            if (Math.random() < pMissGreen) {
              lie = (Math.random() < 0.4 ? 'bunker' : 'chip');
              // You are off the green, not on top of the hole: keep a real number to play.
              remaining = Math.max(4, Math.round((6 + Math.random() * 22) * courseScale()));
            } else {
              needNewHole = true;
            }
          }

          let club, situation;

          const shotFrom = remaining;   // every line reports the distance you are playing from

          if (lie === 'trees') {
            // A punch out is a low club run down the hole, not a lob wedge: 80 to 140
            // yards of advance unless the pin is closer than that.
            const punchTo = Math.min(Math.round(shotFrom * 0.7),
                                     Math.round((80 + Math.random() * 60) * courseScale()));
            club = nearestClub(bag, Math.max(30, punchTo));
            situation = 'Punch out · ' + shotFrom + ' yds in';
            remaining = Math.max(0, Math.round(shotFrom - Math.min(punchTo, yardsFor(club))));
            settle('fairway');
          } else if (lie === 'bunker' || lie === 'chip') {
            club = shortestClub(bag);
            situation = (lie === 'bunker' ? 'Bunker' : 'Chip on') + ' · ' + shotFrom + ' yds';
            remaining = 0;
            needNewHole = true;
          } else {
            const onTee = (lie === 'tee');
            club = (onTee && par > 3) ? teeClub(bag, holeYards) : nearestClub(offTheDeck(bag), shotFrom);
            const dist = onTee ? shotFrom + ' yds' : shotFrom + ' yds in';
            situation = note ? note + ' · ' + dist : (onTee ? 'Tee shot' : dist);
            note = '';

            // Trouble is mostly a driver problem, and one bad break per hole is
            // plenty; without that cap the misses compound into scores nobody makes.
            const swinging = onTee && par > 3;
            const allowance = h >= 25 ? 2 : 1;
            const inPlay = troubleThisHole < allowance;
            const pPenalty = !inPlay ? 0
              : swinging ? Math.min(0.13, 0.004 + h * 0.005) : Math.min(0.05, 0.002 + h * 0.0012);
            const pTrees = !inPlay ? 0
              : swinging ? Math.min(0.20, 0.015 + h * 0.005) : Math.min(0.04, h * 0.0008);

            const low = 0.94 - h * 0.006, spread = 0.12 + h * 0.004;
            const carry = yardsFor(club) * (low + Math.random() * spread);
            const roll = Math.random();

            if (roll < pPenalty) {
              // Stroke and distance off the tee, or a drop at the hazard: same spot, one more shot.
              note = onTee ? 'After OB' : 'After a drop';
              strokes += 1;
              troubleThisHole += 1;
            } else if (roll < pPenalty + pTrees) {
              remaining = Math.max(0, Math.round(remaining - carry * 0.75));
              troubleThisHole += 1;
              settle('trees');
            } else {
              remaining = Math.max(0, Math.round(remaining - carry));
              settle('fairway');
            }
          }

          if (strokes >= 10) needNewHole = true;
          return { id: club.id, card: card, lines: ['Shot ' + shotNo + ' · ' + situation] };
        },
      };
    }

    if (mode === 'par3') {
      let hole = -1;
      return {
        next(ids) {
          hole = (hole + 1) % PAR3_COURSE.length;
          const yards = scaleYards(PAR3_COURSE[hole]);
          const club = nearestClub(ids.map(id => BY_ID[id]), yards);
          return { id: club.id, card: { hole: hole + 1, par: 3, yards: yards }, lines: [] };
        },
      };
    }

    return { next(ids) { return { id: randomOf(ids), card: null, lines: [] }; } };
  }

  return {
    yardsFor: yardsFor, courseScale: courseScale, scaleYards: scaleYards,
    nearestClub: nearestClub, offTheDeck: offTheDeck,
    longestClub: longestClub, shortestClub: shortestClub, teeClub: teeClub,
    makePicker: makePicker,
  };
}

return {
  CLUBS: CLUBS, DEFAULT_IDS: DEFAULT_IDS, GROUPS: GROUPS, BY_ID: BY_ID, VALID: VALID,
  MODES: MODES, MODE_SETS: MODE_SETS, DEFAULT_MODE: DEFAULT_MODE, modeDef: modeDef,
  COURSE: COURSE, PAR3_COURSE: PAR3_COURSE,
  REFERENCE_SEVEN: REFERENCE_SEVEN,
  DEFAULT_SEVEN: DEFAULT_SEVEN, MIN_SEVEN: MIN_SEVEN, MAX_SEVEN: MAX_SEVEN,
  DEFAULT_HCP: DEFAULT_HCP, MIN_HCP: MIN_HCP, MAX_HCP: MAX_HCP,
  clampSeven: clampSeven, clampHcp: clampHcp,
  randomOf: randomOf, shuffle: shuffle,
  createEngine: createEngine,
};
}));
