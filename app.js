// Golf Button: the browser half. Storage, layout and wiring.
// The golf itself lives in logic.js so it can be tested without a page.
(function () {
  'use strict';

  const L = window.GolfLogic;
  const CLUBS = L.CLUBS, DEFAULT_IDS = L.DEFAULT_IDS, GROUPS = L.GROUPS;
  const BY_ID = L.BY_ID, VALID = L.VALID;
  const MODES = L.MODES, MODE_SETS = L.MODE_SETS, DEFAULT_MODE = L.DEFAULT_MODE, modeDef = L.modeDef;
  const DEFAULT_SEVEN = L.DEFAULT_SEVEN, MIN_SEVEN = L.MIN_SEVEN, MAX_SEVEN = L.MAX_SEVEN;
  const DEFAULT_HCP = L.DEFAULT_HCP, MIN_HCP = L.MIN_HCP, MAX_HCP = L.MAX_HCP;
  const clampSeven = L.clampSeven, clampHcp = L.clampHcp;

  const STORAGE_KEY = 'golfButton.enabled';
  const MODE_KEY = 'golfButton.mode';
  const SEVEN_KEY = 'golfButton.sevenIron';
  const HCP_KEY = 'golfButton.handicap';

  // ---- storage ----
  function loadEnabled() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw === null) return new Set(DEFAULT_IDS);
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr)) return new Set(DEFAULT_IDS);
      return new Set(arr.filter(id => VALID.has(id)));
    } catch (e) { return new Set(DEFAULT_IDS); }
  }
  function saveEnabled(set) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...set])); } catch (e) {}
  }
  function loadMode() {
    try {
      const m = localStorage.getItem(MODE_KEY);
      return MODES.some(x => x.id === m) ? m : DEFAULT_MODE;
    } catch (e) { return DEFAULT_MODE; }
  }
  function saveMode(m) { try { localStorage.setItem(MODE_KEY, m); } catch (e) {} }
  function loadSeven() {
    try {
      const n = parseInt(localStorage.getItem(SEVEN_KEY), 10);
      return clampSeven(isNaN(n) ? DEFAULT_SEVEN : n);
    } catch (e) { return DEFAULT_SEVEN; }
  }
  function saveSeven(n) { try { localStorage.setItem(SEVEN_KEY, String(n)); } catch (e) {} }
  function loadHandicap() {
    try {
      const n = parseInt(localStorage.getItem(HCP_KEY), 10);
      return clampHcp(isNaN(n) ? DEFAULT_HCP : n);
    } catch (e) { return DEFAULT_HCP; }
  }
  function saveHandicap(n) { try { localStorage.setItem(HCP_KEY, String(n)); } catch (e) {} }

  // ---- distances ----
  let sevenIron = loadSeven();
  let handicap = loadHandicap();

  // The engine reads these two through getters, so changing a setting takes
  // effect on the next press without rebuilding anything.
  const engine = L.createEngine(function () { return sevenIron; },
                                function () { return handicap; });
  const yardsFor = engine.yardsFor;
  const makePicker = engine.makePicker;

  // ---- state ----
  let enabled = loadEnabled();
  let mode = loadMode();
  let picker = makePicker(mode);
  let settingsDirty = false;

  const mainEl = document.querySelector('main');
  const cardEl = document.getElementById('card');
  const clubEl = document.getElementById('club');
  const contextEl = document.getElementById('context');
  const bigBtn = document.getElementById('big');
  const gearBtn = document.getElementById('gear');
  const settingsEl = document.getElementById('settings');
  const closeBtn = document.getElementById('close');
  const groupsEl = document.getElementById('groups');

  function setReadout(text, opts) {
    opts = opts || {};
    clubEl.textContent = text;
    clubEl.classList.toggle('placeholder', !!opts.placeholder);

    cardEl.textContent = '';
    cardEl.hidden = !opts.card;
    if (opts.card) {
      [['Hole', opts.card.hole], ['Par', opts.card.par], ['Yards', opts.card.yards]].forEach(pair => {
        cardEl.append(el('div', { className: 'cell' },
          el('span', { className: 'k', textContent: pair[0] }),
          el('span', { className: 'v', textContent: String(pair[1]) })));
      });
    }

    contextEl.textContent = '';
    (opts.lines || []).filter(Boolean).forEach(line => {
      contextEl.append(el('div', { className: 'shot', textContent: line }));
    });
  }
  function updateButtonLabel() {
    const def = modeDef(mode);
    bigBtn.textContent = def.button;
    bigBtn.setAttribute('aria-label', def.button);
  }

  function updateMainState() {
    const empty = enabled.size === 0;
    bigBtn.disabled = empty;
    if (empty) setReadout('Pick some clubs in settings', { placeholder: true });
  }

  function track(path) {
    try {
      if (window.goatcounter && window.goatcounter.count) {
        window.goatcounter.count({ path: path, title: 'Button press', event: true });
      }
    } catch (e) {}
  }

  // ---- keep the screen on between shots ----
  let wakeLock = null;
  function keepAwake() {
    if (!('wakeLock' in navigator) || wakeLock) return;
    navigator.wakeLock.request('screen').then((lock) => {
      wakeLock = lock;
      lock.addEventListener('release', () => { wakeLock = null; });
    }).catch(() => {});   // denied, low battery, unsupported: not worth mentioning
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') keepAwake();
  });

  function advance() {
    if (enabled.size === 0) { updateMainState(); return; }
    const shot = picker.next([...enabled]);
    track('press/' + mode);
    setReadout(shot.label || BY_ID[shot.id].label, { card: shot.card, lines: shot.lines });
    if (navigator.vibrate) { try { navigator.vibrate(30); } catch (e) {} }
    bigBtn.classList.add('pressed');
    setTimeout(() => bigBtn.classList.remove('pressed'), 90);
    keepAwake();          // the first press is a user gesture, which is when this is allowed
  }

  // Anywhere on the screen advances, so you can hit it through a glove or without
  // looking down. The gear is the one thing that does something else. The button
  // still fires this by bubbling, so a press counts exactly once.
  mainEl.addEventListener('click', (e) => {
    if (e.target.closest('#gear')) return;
    advance();
  });

  // iOS has ignored user-scalable=no since iOS 10, so pinch is only stoppable
  // through these. Block it on the button screen, where a zoomed layout strands
  // you, but leave it working in settings, where the smallest text lives.
  ['gesturestart', 'gesturechange', 'gestureend'].forEach((type) => {
    document.addEventListener(type, (e) => {
      if (settingsEl.hidden) e.preventDefault();
    }, { passive: false });
  });

  // ---- settings ----
  function el(tag, props, ...children) {
    const node = document.createElement(tag);
    Object.assign(node, props || {});
    node.append(...children);
    return node;
  }

  function renderSettings() {
    groupsEl.innerHTML = '';

    const modeWrap = el('div', { className: 'group' });
    modeWrap.append(el('div', { className: 'group-head' }, el('h2', { textContent: 'Mode' })));
    const note = el('p', { className: 'mode-note' });
    for (const set of MODE_SETS) {
      modeWrap.append(el('div', { className: 'mode-set', textContent: set }));
      const grid = el('div', { className: 'modegrid' });
      for (const m of MODES.filter(x => x.set === set)) {
        const input = el('input', { type: 'radio', name: 'mode', value: m.id, checked: mode === m.id });
        input.addEventListener('change', () => {
          if (!input.checked) return;
          mode = m.id; saveMode(mode); settingsDirty = true;
          note.textContent = m.desc;
        });
        grid.append(el('label', {}, input, el('span', { className: 'mface', textContent: m.short })));
      }
      modeWrap.append(grid);
    }
    note.textContent = modeDef(mode).desc;
    modeWrap.append(note);
    groupsEl.append(modeWrap);

    for (const group of GROUPS) {
      const wrap = el('div', { className: 'group' });
      const allBtn = el('button', { type: 'button', textContent: 'All' });
      const noneBtn = el('button', { type: 'button', textContent: 'None' });
      wrap.append(el('div', { className: 'group-head' },
        el('h2', { textContent: group }), el('span', {}, allBtn, noneBtn)));

      const chips = el('div', { className: 'chips' });
      const inputs = [];
      for (const club of CLUBS.filter(c => c.group === group)) {
        const cb = el('input', { type: 'checkbox', checked: enabled.has(club.id) });
        cb.dataset.id = club.id;
        cb.addEventListener('change', () => {
          if (cb.checked) enabled.add(club.id); else enabled.delete(club.id);
          onEnabledChanged();
        });
        const yds = el('span', { className: 'yds', textContent: String(yardsFor(club)) });
        yds.dataset.yardsFor = club.id;
        chips.append(el('label', { className: 'chip', title: club.label }, cb,
          el('span', { className: 'face' }, el('span', { textContent: club.short }), yds)));
        inputs.push(cb);
      }
      wrap.append(chips);

      allBtn.addEventListener('click', () => {
        inputs.forEach(cb => { cb.checked = true; enabled.add(cb.dataset.id); });
        onEnabledChanged();
      });
      noneBtn.addEventListener('click', () => {
        inputs.forEach(cb => { cb.checked = false; enabled.delete(cb.dataset.id); });
        onEnabledChanged();
      });
      groupsEl.append(wrap);
    }

    // Your game, at the bottom.
    const distWrap = el('div', { className: 'group' });
    distWrap.append(el('div', { className: 'group-head' }, el('h2', { textContent: 'Your game' })));

    function stepper(opts) {
      const minus = el('button', { type: 'button', textContent: '−', ariaLabel: 'Less ' + opts.name });
      const plus = el('button', { type: 'button', textContent: '+', ariaLabel: 'More ' + opts.name });
      const input = el('input', { type: 'text', inputMode: 'numeric', pattern: '[0-9]*',
                                  autocomplete: 'off', value: String(opts.value) });
      input.setAttribute('aria-label', opts.name);
      input.id = opts.id;
      const row = el('div', { className: 'dist' },
        el('div', { className: 'lbl' }, el('span', { textContent: opts.name }),
           el('small', { textContent: opts.hint })),
        el('div', { className: 'ctl' }, minus, input,
           el('span', { className: 'yds', textContent: opts.unit }), plus));
      function apply(n) {
        const v = opts.clamp(n);
        input.value = String(v);
        opts.onChange(v);
        settingsDirty = true;
      }
      minus.addEventListener('click', () => apply(opts.get() - opts.step));
      plus.addEventListener('click', () => apply(opts.get() + opts.step));
      input.addEventListener('change', () => {
        const raw = input.value.trim();
        if (raw === '') { input.value = String(opts.get()); return; }   // left alone
        const parsed = parseInt(raw, 10);   // 0 is a real handicap, so no falsy fallback
        apply(Number.isNaN(parsed) ? opts.fallback : parsed);
      });
      // Tapping the field used to drop a cursor after the digits, so typing appended:
      // 15 became 1536 and clamped to the maximum. Empty it on focus and keep the old
      // number as the placeholder, so whatever you type is the whole value.
      input.addEventListener('focus', () => {
        input.placeholder = input.value;
        input.value = '';
      });
      input.addEventListener('blur', () => {
        if (input.value.trim() === '') input.value = String(opts.get());
      });
      // And never let a scroll over a focused field spin the number.
      input.addEventListener('wheel', () => input.blur(), { passive: true });
      return row;
    }

    distWrap.append(stepper({
      id: 'seven', name: '7 iron carry', unit: 'yds',
      hint: 'Every other club and the course scale from this.',
      value: sevenIron, min: MIN_SEVEN, max: MAX_SEVEN, step: 5,
      fallback: DEFAULT_SEVEN, clamp: clampSeven, get: () => sevenIron,
      onChange: v => { sevenIron = v; saveSeven(v); refreshYardages(); },
    }));

    distWrap.append(stepper({
      id: 'hcp', name: 'Handicap', unit: '',
      hint: 'Used by the real round mode to decide how often you miss.',
      value: handicap, min: MIN_HCP, max: MAX_HCP, step: 1,
      fallback: DEFAULT_HCP, clamp: clampHcp, get: () => handicap,
      onChange: v => { handicap = v; saveHandicap(v); },
    }));

    groupsEl.append(distWrap);

    const reset = el('button', { id: 'reset', type: 'button', textContent: 'Reset to default bag' });
    reset.addEventListener('click', () => {
      enabled = new Set(DEFAULT_IDS);
      syncCheckboxes();
      onEnabledChanged();
    });
    groupsEl.append(reset, el('p', { id: 'summary' }));
    updateSummary();
  }

  function refreshYardages() {
    groupsEl.querySelectorAll('[data-yards-for]').forEach(node => {
      node.textContent = String(yardsFor(BY_ID[node.dataset.yardsFor]));
    });
  }
  function onEnabledChanged() { saveEnabled(enabled); settingsDirty = true; updateSummary(); }
  function syncCheckboxes() {
    groupsEl.querySelectorAll('input[type=checkbox]').forEach(cb => { cb.checked = enabled.has(cb.dataset.id); });
  }
  function updateSummary() {
    const s = document.getElementById('summary');
    if (s) s.textContent = enabled.size === 1 ? '1 club in play' : enabled.size + ' clubs in play';
  }

  gearBtn.addEventListener('click', () => {
    syncCheckboxes(); updateSummary(); settingsDirty = false;
    settingsEl.hidden = false; groupsEl.scrollTop = 0;
  });
  closeBtn.addEventListener('click', () => {
    settingsEl.hidden = true;
    if (settingsDirty) {
      picker = makePicker(mode);
      updateButtonLabel();
      if (enabled.size > 0) setReadout('Press for a club', { placeholder: true });
    }
    updateMainState();
  });

  renderSettings();
  updateButtonLabel();
  updateMainState();
})();
