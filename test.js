// Golf Button tests: node test.js
// Covers the yardage model, the settings clamps, and the shot simulation.
// Every case marked "regression" is a bug that actually shipped.
const L = require('./logic.js');

let passed = 0, failed = 0;
const fails = [];
function check(name, cond, detail) {
  if (cond) { passed++; return; }
  failed++; fails.push(name + (detail ? '  (' + detail + ')' : ''));
}
function group(name) { console.log('\n' + name); }

function engineFor(seven, hcp) {
  let s = seven, h = hcp;
  return L.createEngine(function () { return s; }, function () { return h; });
}
// Play a hole at a time so per-hole invariants can be checked.
function playPresses(engine, mode, ids, n) {
  const p = engine.makePicker(mode);
  const out = [];
  for (let i = 0; i < n; i++) out.push(p.next(ids));
  return out;
}

// ---------------------------------------------------------------- distances
group('Distance model');
{
  const e = engineFor(150, 15);
  check('7 iron is the anchor', e.yardsFor(L.BY_ID['7i']) === 150);
  check('driver is 240 off a 150 yard 7 iron', e.yardsFor(L.BY_ID['driver']) === 240);

  const e2 = engineFor(165, 15);
  check('everything scales with the anchor', e2.yardsFor(L.BY_ID['7i']) === 165);

  // irons and wedges must descend without a tie or an inversion
  const ordered = L.CLUBS.filter(c => c.group === 'Irons' || c.group === 'Wedges');
  let monotonic = true;
  for (let i = 1; i < ordered.length; i++) {
    if (e.yardsFor(ordered[i]) >= e.yardsFor(ordered[i - 1])) monotonic = false;
  }
  check('irons then wedges descend strictly', monotonic);
  check('driver is the longest club in the bag',
        e.yardsFor(L.BY_ID['driver']) === Math.max.apply(null, L.CLUBS.map(e.yardsFor)));
}

// ------------------------------------------------------------------- clamps
group('Settings clamps');
{
  // regression: parseInt("0") || 15 returned 15, so scratch was unreachable
  check('handicap 0 survives (regression)', L.clampHcp(0) === 0);
  check('handicap clamps to the floor', L.clampHcp(-9) === L.MIN_HCP);
  check('handicap clamps to the ceiling', L.clampHcp(999) === L.MAX_HCP);
  check('handicap rounds', L.clampHcp(12.6) === 13);
  check('7 iron clamps low', L.clampSeven(1) === L.MIN_SEVEN);
  check('7 iron clamps high', L.clampSeven(9999) === L.MAX_SEVEN);
  check('default handicap is 15', L.DEFAULT_HCP === 15);
}

// ------------------------------------------------------------- club picking
group('Club selection');
{
  const e = engineFor(150, 15);
  const bag = L.DEFAULT_IDS.map(id => L.BY_ID[id]);
  check('nearest to 150 is the 7 iron', e.nearestClub(bag, 150).id === '7i');
  check('a target past every club gives the longest', e.nearestClub(bag, 900).id === 'driver');
  check('a target under every club gives the shortest', e.nearestClub(bag, 1).id === '60');
  check('off the deck excludes the driver', e.offTheDeck(bag).every(c => c.kind !== 'driver'));
  check('off the deck keeps a driver-only bag playable',
        e.offTheDeck([L.BY_ID['driver']]).length === 1);
}

// ------------------------------------------------------------------- course
group('The course');
{
  check('18 holes', L.COURSE.length === 18);
  check('par 72', L.COURSE.reduce((n, h) => n + h.par, 0) === 72);
  check('6,400 yards off the blues', L.COURSE.reduce((n, h) => n + h.yards, 0) === 6400);
  check('each nine is par 36',
        L.COURSE.slice(0, 9).reduce((n, h) => n + h.par, 0) === 36 &&
        L.COURSE.slice(9).reduce((n, h) => n + h.par, 0) === 36);

  // the whole point of the blue tees: normal approaches are short irons
  const e = engineFor(150, 15);
  const driver = e.yardsFor(L.BY_ID['driver']);
  const par4s = L.COURSE.filter(h => h.par === 4).map(h => h.yards - driver);
  const wedgeToNine = par4s.filter(d => d > 0 && d <= 140).length;
  check('most par 4s leave a wedge through a 9 iron', wedgeToNine >= 6,
        wedgeToNine + ' of ' + par4s.length);
  check('one par 4 is genuinely long', L.COURSE.some(h => h.par === 4 && h.yards >= 440));
}

// ------------------------------------------------------------------- modes
group('Modes');
{
  const e = engineFor(150, 15);
  const ids = L.DEFAULT_IDS;

  const rnd = playPresses(e, 'random', ids, 300);
  check('random only returns clubs in the bag', rnd.every(s => ids.indexOf(s.id) !== -1));
  check('random shows no scorecard', rnd.every(s => !s.card));

  // no repeats must exhaust the bag before anything comes back
  const p = e.makePicker('norepeat');
  const firstPass = [];
  for (let i = 0; i < ids.length; i++) firstPass.push(p.next(ids).id);
  check('no repeats covers every club before repeating',
        new Set(firstPass).size === ids.length, new Set(firstPass).size + '/' + ids.length);

  const yards = playPresses(e, 'distance', ids, 200).map(s => parseInt(s.label, 10));
  check('yardages are round numbers', yards.every(y => y % 5 === 0));
  check('yardages stay inside the bag',
        yards.every(y => y >= e.yardsFor(L.BY_ID['60']) - 5 && y <= e.yardsFor(L.BY_ID['driver']) + 5));
  let backToBack = 0;
  for (let i = 1; i < yards.length; i++) if (yards[i] === yards[i - 1]) backToBack++;
  check('yardages never repeat back to back', backToBack === 0, backToBack + ' repeats');

  const par3 = playPresses(e, 'par3', ids, 40);
  check('par 3 mode always shows a par 3 card', par3.every(s => s.card && s.card.par === 3));
}

// -------------------------------------------------------------- simulations
group('Course and round simulation');
{
  for (const hcp of [0, 15, 36]) {
    const e = engineFor(150, hcp);
    for (const mode of ['course', 'round']) {
      const shots = playPresses(e, mode, L.DEFAULT_IDS, 4000);
      const label = mode + ' at ' + hcp;

      check(label + ': every shot names a club in the bag',
            shots.every(s => L.DEFAULT_IDS.indexOf(s.id) !== -1));
      check(label + ': every shot carries a scorecard', shots.every(s => s.card));

      // regression: incident lines dropped the yardage, and greenside shots read 0
      const lines = shots.map(s => s.lines[0] || '');
      const missing = lines.filter(t => !/Tee shot$/.test(t) && !/\d+ yds/.test(t));
      check(label + ': no line loses its distance (regression)', missing.length === 0, missing[0]);
      check(label + ': nothing is played from 0 yards (regression)',
            !lines.some(t => /\b0 yds/.test(t)));

      // regression: penalty strokes inflated the shot number of the swing that caused them
      const nums = lines.map(t => parseInt((t.match(/Shot (\d+)/) || [0, 0])[1], 10));
      check(label + ': shot numbers stay sane (regression)', nums.every(n => n >= 1 && n <= 10));

      // regression: full swings looped from a few yards out
      const shortSwings = lines.filter(t => {
        const m = t.match(/^Shot \d+ · (\d+) yds in$/);
        return m && parseInt(m[1], 10) <= 15;
      });
      check(label + ': no full swing from inside 15 yards (regression)',
            shortSwings.length === 0, shortSwings[0]);

      // Nobody hits driver off the deck. Re-teeing after OB counts as a tee shot:
      // stroke and distance puts you back on the tee, and only a tee shot can
      // produce that line in the first place.
      const onTeeLine = (t) => /Tee shot$/.test(t) || /After OB/.test(t);
      const deckDriver = shots.filter((s, i) => s.id === 'driver' && !onTeeLine(lines[i]));
      check(label + ': the driver only comes out on the tee',
            deckDriver.length === 0,
            deckDriver.length + ' times, e.g. ' + lines[shots.indexOf(deckDriver[0])]);
    }
  }
}

// ------------------------------------------------------- handicap behaviour
group('Handicap changes the round');
{
  function measure(hcp) {
    const e = engineFor(150, hcp);
    const shots = playPresses(e, 'round', L.DEFAULT_IDS, 6000);
    let holes = 0, last = null, trouble = 0;
    shots.forEach(s => {
      if (s.card.hole !== last) { holes++; last = s.card.hole; }
      if (/Punch out|After OB|After a drop/.test(s.lines[0])) trouble++;
    });
    return { swingsPerHole: shots.length / holes, troublePerRound: trouble / (holes / 18) };
  }
  const low = measure(0), mid = measure(15), high = measure(36);

  check('a scratch player takes fewer swings than a 15',
        low.swingsPerHole < mid.swingsPerHole,
        low.swingsPerHole.toFixed(2) + ' vs ' + mid.swingsPerHole.toFixed(2));
  check('a 15 takes fewer swings than a 36',
        mid.swingsPerHole < high.swingsPerHole,
        mid.swingsPerHole.toFixed(2) + ' vs ' + high.swingsPerHole.toFixed(2));
  check('trouble rises with the handicap',
        low.troublePerRound < mid.troublePerRound && mid.troublePerRound < high.troublePerRound);
  check('a 15 plays to roughly bogey golf',
        mid.swingsPerHole > 2.4 && mid.swingsPerHole < 3.1, mid.swingsPerHole.toFixed(2));
  check('a 15 sees a handful of bad breaks, not a dozen',
        mid.troublePerRound > 1 && mid.troublePerRound < 6, mid.troublePerRound.toFixed(1));
}

// ------------------------------------------------------------- odd bag sizes
group('Awkward bags');
{
  const e = engineFor(150, 20);
  for (const bag of [['7i'], ['driver'], ['60', '56'], L.CLUBS.map(c => c.id)]) {
    for (const mode of ['random', 'norepeat', 'distance', 'course', 'par3', 'round']) {
      let ok = true, why = '';
      try {
        playPresses(e, mode, bag, 400).forEach(s => {
          if (bag.indexOf(s.id) === -1) { ok = false; why = 'club outside the bag'; }
        });
      } catch (err) { ok = false; why = err.message; }
      check('a ' + bag.length + ' club bag survives ' + mode, ok, why);
    }
  }
}

console.log('\n' + '-'.repeat(52));
if (failed) {
  console.log(failed + ' FAILED, ' + passed + ' passed\n');
  fails.forEach(f => console.log('  x ' + f));
  process.exit(1);
}
console.log('All ' + passed + ' checks passed.');
