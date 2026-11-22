/* Order Listener · web kitchen screen.
 * One page, three ways to run:
 *  - served by the KDS phone (http://<phone>:8765): live orders over its small JSON API
 *  - demo: made-up orders, so the page can be tried anywhere (this is what github.io shows)
 *  - launcher (https hosting such as github.io): a browser will not let an https page talk to the
 *    phone's plain-http address, so the launcher opens the page the phone itself serves.
 */
(function () {
  'use strict';

  // ------------------------------------------------------------------ helpers
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const LS = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } },
  };
  const PLAT = {
    grab: { label: 'GrabFood', color: 0xFF00B14F, mark: 'G' },
    gofood: { label: 'GoFood', color: 0xFFEE2737, mark: 'Go' },
    shopee: { label: 'ShopeeFood', color: 0xFFEE4D2D, mark: 'S' },
  };
  const hex6 = (c) => '#' + ((Number(c) & 0xFFFFFF) >>> 0).toString(16).padStart(6, '0');
  const rgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const toHex = (a) => '#' + a.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
  const mix = (a, b, t) => { const x = rgb(a), y = rgb(b); return toHex(x.map((v, i) => v + (y[i] - v) * t)); };
  const lum = (h) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; const [r, g, b] = rgb(h); return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const onColor = (h) => (lum(h) > 0.4 ? '#111111' : '#ffffff');
  const validHex = (s) => /^#[0-9a-fA-F]{6}$/.test(s || '');
  const pad2 = (n) => String(n).padStart(2, '0');
  const clock = (ms) => {
    const s = Math.floor(Math.abs(ms) / 1000);
    return s >= 3600 ? Math.floor(s / 3600) + ':' + pad2(Math.floor(s / 60) % 60) + ':' + pad2(s % 60) : pad2(Math.floor(s / 60)) + ':' + pad2(s % 60);
  };
  const ageText = (ms) => { const m = Math.max(0, Math.floor(ms / 60000)); return m < 1 ? '<1 min' : m < 60 ? m + ' min' : Math.floor(m / 60) + ' h ' + pad2(m % 60); };
  const shortAge = (ms) => { const s = Math.max(0, Math.floor(ms / 1000)); return s < 60 ? s + 's' : s < 3600 ? Math.floor(s / 60) + 'm' : Math.floor(s / 3600) + 'h'; };
  const plural = (n) => (n === 1 ? '1 order' : n + ' orders');
  const HIST = ['READY', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'];
  const isHistory = (o) => HIST.indexOf(o.status) >= 0;
  const STALE_MS = 10 * 60 * 1000;
  const STICKY_MS = 6 * 60 * 60 * 1000; // a reading that came from a notification (shop closed / check-in)

  // ------------------------------------------------------------------ icons (Material paths)
  const PATH = {
    menu: 'M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z',
    refresh: 'M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z',
    link: 'M3.9,12c0,-1.71 1.39,-3.1 3.1,-3.1h4L11,7L7,7c-2.76,0 -5,2.24 -5,5s2.24,5 5,5h4v-1.9L7,15.1c-1.71,0 -3.1,-1.39 -3.1,-3.1zM8,13h8v-2L8,11v2zM17,7h-4v1.9h4c1.71,0 3.1,1.39 3.1,3.1s-1.39,3.1 -3.1,3.1h-4L13,17h4c2.76,0 5,-2.24 5,-5s-2.24,-5 -5,-5z',
    linkoff: 'M17,7h-4v1.9h4c1.71,0 3.1,1.39 3.1,3.1 0,1.43 -0.98,2.63 -2.31,3.01l1.48,1.48C20.55,15.67 22,13.99 22,12c0,-2.76 -2.24,-5 -5,-5zM2,4.27l3.11,3.11C3.29,8.12 2,9.91 2,12c0,2.76 2.24,5 5,5h4v-1.9L7,15.1c-1.71,0 -3.1,-1.39 -3.1,-3.1 0,-1.72 1.4,-3.1 3.1,-3.1h0.01L8.73,11H8v2h2.73L13,15.27V17h1.73l4.01,4L20,19.74 3.27,3 2,4.27zM16,11h-2.73l2,2H16v-2z',
    printer: 'M19,8H5c-1.66,0 -3,1.34 -3,3v6h4v4h12v-4h4v-6c0,-1.66 -1.34,-3 -3,-3zM16,19H8v-5h8v5zM19,12c-0.55,0 -1,-0.45 -1,-1s0.45,-1 1,-1 1,0.45 1,1 -0.45,1 -1,1zM18,3H6v4h12V3z',
    moto: 'M20,11c-0.18,0 -0.36,0.02 -0.53,0.04L17.41,9L20,9V6l-3.72,1.86L13.41,5H9v2h3.59l2,2H11l-4,2L5,9H0v2h4c-2.21,0 -4,1.79 -4,4s1.79,4 4,4c2.21,0 4,-1.79 4,-4l2,2h3l3.49,-6.1l1.01,1.01C16.59,12.64 16,13.75 16,15c0,2.21 1.79,4 4,4s4,-1.79 4,-4S22.21,11 20,11zM4,17c-1.1,0 -2,-0.9 -2,-2c0,-1.1 0.9,-2 2,-2c1.1,0 2,0.9 2,2C6,16.1 5.1,17 4,17zM20,17c-1.1,0 -2,-0.9 -2,-2s0.9,-2 2,-2s2,0.9 2,2S21.1,17 20,17z',
    warn: 'M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z',
    vol: 'M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z',
    mute: 'M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z',
    lock: 'M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z',
    theme: 'M20 8.69V4h-4.69L12 .69 8.69 4H4v4.69L.69 12 4 15.31V20h4.69L12 23.31 15.31 20H20v-4.69L23.31 12 20 8.69zM12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6 6-2.69 6-6 6zm0-10c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4z',
    history: 'M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z',
    board: 'M10 18h5V5h-5v13zm-6 0h5V5H4v13zM16 5v13h5V5h-5z',
    plus: 'M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z',
  };
  const icon = (n, cls, label) => '<svg class="i ' + (cls || '') + '" viewBox="0 0 24 24" ' + (label ? 'role="img" aria-label="' + esc(label) + '"' : 'aria-hidden="true"') + '><path d="' + PATH[n] + '"/></svg>';

  // ------------------------------------------------------------------ state
  const params = new URLSearchParams(location.search);
  const HOSTED = location.protocol === 'https:' || params.has('hosted');
  const S = {
    mode: 'boot', // boot | start | demo | phone
    src: null, data: null, view: 'board', filter: '', tab: 0,
    hist: { range: 'today', from: '', to: '' },
    menu: false, overlay: null, overlayErr: '', connErr: '',
    sound: LS.get('sound') === '1', themePref: LS.get('theme'),
    armed: null, holds: {}, ringTick: 0, helloInfo: null,
  };
  const app = $('#app');
  const cache = {};
  const setHTML = (el, key, html) => { if (cache[key] !== html) { cache[key] = html; el.innerHTML = html; return true; } return false; };

  // ------------------------------------------------------------------ data sources
  function phoneSource() {
    const base = ''; // the page is served by the phone, so the API is on the same address
    let token = LS.get('token') || '';
    async function call(method, path, body) {
      const headers = { 'x-code': LS.get('code') || '' };
      if (token) headers['x-token'] = token;
      if (body) headers['content-type'] = 'application/json';
      const r = await fetch(base + path, { method, headers, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' });
      let j = {};
      try { j = await r.json(); } catch (e) { /* empty */ }
      if (!r.ok) { const e = new Error(j.error || 'error ' + r.status); e.status = r.status; e.body = j; throw e; }
      return j;
    }
    return {
      live: true,
      hello: () => call('GET', '/api/hello'),
      async login(name, pin) { const j = await call('POST', '/api/login', { name, pin }); token = j.token || ''; LS.set('token', token); return j; },
      state: () => call('GET', '/api/state'),
      act: (action, id, arg) => call('POST', '/api/action', { action, id: id || '', arg: arg || '' }),
      async logout() { try { await call('POST', '/api/logout', {}); } catch (e) { /* ignore */ } token = ''; LS.del('token'); },
    };
  }

  function demoSource() {
    const t0 = Date.now();
    const min = (m) => m * 60000;
    const stores = [
      { id: 'a', platform: 'grab', name: 'GrabFood A', chip: 'GF-A', color: 0xFF00B14F },
      { id: 'b', platform: 'grab', name: 'GrabFood B', chip: 'GF-B', color: 0xFF6A1B9A },
      { id: 'c', platform: 'gofood', name: 'GoFood Kemang', chip: 'GO-K', color: 0xFFEE2737 },
    ];
    const mk = (o) => Object.assign({
      id: '', platform: 'grab', orderNo: '', customerName: '', itemCount: 0, items: [], note: '', pin: '', sourceName: 'Order phone',
      storeId: '', storeName: '', storeShort: '', storeColor: 0, attention: '', prepMinutes: 0, acceptedAt: 0, stage: 'NONE', stageAt: 0,
      etaAt: 0, readyAt: 0, prepFrom: 0, driverName: '', driverStatus: 'NONE', status: 'NEW', acknowledged: false, autoAccepted: false,
      printCount: 0, createdAt: t0, updatedAt: t0,
    }, o);
    const sc = (id) => stores.find((s) => s.id === id);
    const items = (list) => list.map((x) => ({ qty: x[0], name: x[1], note: x[2] || '', opts: x[3] || '' }));
    const base = (id, store, no, who, ageMin, its, extra) => mk(Object.assign({
      id, platform: sc(store).platform, orderNo: no, customerName: who, items: items(its), itemCount: its.reduce((n, x) => n + (x[0] || 1), 0),
      storeId: store, storeName: sc(store).name, storeShort: sc(store).chip, storeColor: sc(store).color,
      createdAt: t0 - min(ageMin), updatedAt: t0 - min(ageMin),
    }, extra));
    let orders = [
      base('1', 'a', 'A-4821', 'Budi Santoso', 3, [[2, 'Fudgy Brownies', 'no nuts'], [1, 'Iced Latte', 'less sugar, no ice']], { prepMinutes: 15 }),
      base('2', 'b', 'B-7782', 'Siti', 12, [[1, 'Butter Croissant'], [2, 'Kopi Susu']], { note: 'please call on arrival' }),
      base('h', 'c', 'GF-201', 'Andi', 4, [[2, 'Nasi Goreng'], [1, 'Es Teh']], { stage: 'HOLD', stageAt: t0 - 190000 }),
      base('f', 'c', 'GF-198', 'Rina', 9, [[1, 'Mie Ayam']], { acknowledged: true, status: 'ACCEPTED', prepMinutes: 10, acceptedAt: t0 - min(6), stage: 'FINDING', stageAt: t0 - 130000 }),
      base('w', 'a', 'A-4810', 'Budi', 11, [[2, 'Fudgy Brownies', 'no nuts']], { acknowledged: true, status: 'ACCEPTED', prepMinutes: 15, acceptedAt: t0 - min(9), stage: 'ON_WAY', stageAt: t0 - 200000, etaAt: t0 + min(4), driverName: 'Pak Joko · B 1234 XY', driverStatus: 'ON_THE_WAY' }),
      base('r', 'b', 'B-7790', 'Siti', 18, [[1, 'Butter Croissant']], { acknowledged: true, status: 'ACCEPTED', prepMinutes: 15, acceptedAt: t0 - min(13.5), stage: 'ARRIVED', stageAt: t0 - 95000, driverName: 'Mas Dedi', driverStatus: 'ARRIVED' }),
      base('x', 'b', 'B-7750', 'Joko', 34, [[2, 'Cookie box']], { acknowledged: true, status: 'ACCEPTED', prepMinutes: 15, acceptedAt: t0 - min(30), attention: 'Extra time not set' }),
      base('g', 'c', 'GF-123', 'Dewi', 40, [[3, 'Nasi Goreng', 'extra spicy'], [1, 'Es Teh']], { acknowledged: true, status: 'ACCEPTED', pin: '4821', prepMinutes: 15, acceptedAt: t0 - min(13.5) }),
      base('d', 'a', 'A-4801', 'Rina', 25, [[4, 'Cookie box']], { acknowledged: true, status: 'READY', stage: 'ARRIVED', stageAt: t0 - 240000, updatedAt: t0 - min(5) }),
      base('y1', 'a', 'A-4700', 'Eko', 60 * 26, [[1, 'Chocolate Cake Slice']], { acknowledged: true, status: 'DELIVERED', updatedAt: t0 - 3600000 * 25 }),
    ];
    let holdLifted = false; let n = 0;
    const pick = (id) => orders.find((o) => o.id === id);
    return {
      live: false, demo: true,
      async hello() { return { name: 'Demo kitchen', usersRequired: false }; },
      async login() { return { token: '', name: '', role: 'OPEN' }; },
      async state() {
        const now = Date.now();
        if (!holdLifted && now - t0 > 25000) { // the platform says "prepare" a little after the page opens
          holdLifted = true; const h = pick('h');
          if (h) { h.stage = 'PREPARE'; h.stageAt = now; h.prepFrom = now; h.prepMinutes = 12; h.updatedAt = now; }
        }
        return {
          now, name: 'Demo kitchen', user: '', role: 'ADMIN', orders: JSON.parse(JSON.stringify(orders)), stores,
          status: { stores: { a: { state: 'ONLINE', at: now }, b: { state: 'OFFLINE', at: now - 20000 }, c: { state: 'WARNING', at: now - 5000, sticky: true } }, refreshed: { a: now - 25000 } },
          printer: 'CONNECTED', settings: { warnMin: 10, lateMin: 20, theme: 'DARK', bg: '', text: '', button: '', font: 'DEFAULT' },
        };
      },
      async act(action, id, arg) {
        const now = Date.now(); const o = pick(id);
        if (action === 'accept' && o) Object.assign(o, { acknowledged: true, status: 'ACCEPTED', acceptedAt: o.acceptedAt || now, updatedAt: now });
        else if (action === 'acceptAll') orders.filter((x) => !x.acknowledged && !isHistory(x)).forEach((x) => Object.assign(x, { acknowledged: true, status: 'ACCEPTED', acceptedAt: now, updatedAt: now }));
        else if (action === 'ready' && o) Object.assign(o, { status: 'READY', acknowledged: true, readyAt: now, updatedAt: now });
        else if (action === 'done' && o) Object.assign(o, { status: 'DELIVERED', updatedAt: now });
        else if (action === 'undo' && o) Object.assign(o, { status: 'ACCEPTED', updatedAt: now });
        else if (action === 'dismiss' && o) o.attention = '';
        else if (action === 'delete') orders = orders.filter((x) => x.id !== id);
        else if (action === 'deleteMany') { const ids = (arg || '').split(','); orders = orders.filter((x) => ids.indexOf(x.id) < 0); }
        else if (action === 'addTest') {
          n++; const s = stores[n % stores.length];
          orders.unshift(mk({ id: 't' + n + now, platform: s.platform, orderNo: 'T-' + (1000 + n), customerName: 'Test customer', items: items([[2, 'Fudgy Brownies', 'no nuts'], [1, 'Iced Latte']]), itemCount: 3, storeId: s.id, storeName: s.name, storeShort: s.chip, storeColor: s.color, createdAt: now, updatedAt: now, prepMinutes: 12 }));
        }
        return { ok: true };
      },
      async logout() {},
    };
  }

  // ------------------------------------------------------------------ order helpers
  function look(o) {
    const st = (S.data.stores || []).find((s) => s.id === o.storeId);
    const p = PLAT[o.platform] || PLAT.grab;
    let name = '', color = p.color;
    if (st) { name = st.name; color = st.color; } else if (o.storeName) { name = o.storeName; color = o.storeColor || p.color; }
    return { name, color: hex6(color), title: p.label.toUpperCase() + (name ? ' · ' + name : '') };
  }
  function colOf(o, now) {
    if (o.status === 'CANCELLED' || o.status === 'DELIVERED') return null;
    if (o.status === 'READY' || o.status === 'OUT_FOR_DELIVERY') return now - o.updatedAt < 2 * 3600000 ? 'READY' : null;
    return o.acknowledged ? 'ACCEPTED' : 'NEW';
  }
  const COLS = [['NEW', 'New', 'No new orders'], ['ACCEPTED', 'Accepted', 'Nothing being prepared'], ['READY', 'Ready', 'Nothing ready']];
  const canDelete = () => { const r = S.data && S.data.role; return r === 'OPEN' || r === 'MANAGER' || r === 'ADMIN'; };
  const unacked = () => (S.data ? S.data.orders.filter((o) => !o.acknowledged && !isHistory(o)) : []);
  const now = () => (S.data ? S.data.now + (Date.now() - S.fetchedAt) : Date.now());

  // ------------------------------------------------------------------ rendering
  function applyLook() {
    const set = (S.data && S.data.settings) || {};
    const root = document.documentElement;
    const theme = S.themePref || set.theme || 'DARK';
    let base = theme === 'LIGHT' ? 'light' : 'dark';
    const bg = validHex(set.bg) ? set.bg : null, tx = validHex(set.text) ? set.text : null;
    ['--bg', '--surface', '--text', '--muted', '--line', '--btn', '--btn-fg', '--font'].forEach((v) => root.style.removeProperty(v));
    if (bg) base = lum(bg) < 0.4 ? 'dark' : 'light';
    root.setAttribute('data-theme', base);
    if (bg || tx) {
      const b = bg || (base === 'dark' ? '#0e1013' : '#f6f6f8');
      const t = tx || (bg ? (base === 'dark' ? '#eceff1' : '#1b1b1f') : null);
      if (bg) { root.style.setProperty('--bg', b); root.style.setProperty('--surface', mix(b, t, 0.08)); }
      if (t) { root.style.setProperty('--text', t); root.style.setProperty('--muted', mix(t, b, 0.35)); }
      root.style.setProperty('--line', mix(b, t || '#ffffff', 0.2));
    }
    if (validHex(set.button)) { root.style.setProperty('--btn', set.button); root.style.setProperty('--btn-fg', onColor(set.button)); }
    const fonts = { SANS: 'Helvetica, Arial, sans-serif', SERIF: 'Georgia, "Times New Roman", serif', MONO: 'ui-monospace, Menlo, Consolas, monospace', CURSIVE: '"Brush Script MT", "Comic Sans MS", cursive' };
    if (fonts[set.font]) root.style.setProperty('--font', fonts[set.font]);
    const meta = $('meta[name=theme-color]'); if (meta) meta.setAttribute('content', getComputedStyle(root).getPropertyValue('--bg').trim() || '#0e1013');
  }

  function pillHTML(p, chip, key, full, stat, refreshed, tap) {
    const fresh = stat && now() - stat.at <= (stat.sticky ? STICKY_MS : STALE_MS);
    const state = fresh ? stat.state : 'UNKNOWN';
    const word = state === 'ONLINE' ? 'online' : state === 'OFFLINE' ? 'offline' : state === 'WARNING' ? 'needs attention' : 'status unknown';
    const blink = (state === 'OFFLINE' || state === 'WARNING') && policyOpen();
    const lk = blink ? icon(state === 'OFFLINE' ? 'linkoff' : 'link', 'lk warn blink') : state === 'ONLINE' ? icon('link', 'lk') : state === 'OFFLINE' ? icon('linkoff', 'lk off') : state === 'WARNING' ? icon('link', 'lk warn') : icon('link', 'lk unk');
    const plat = PLAT[p];
    return '<button class="pill' + (tap ? ' tap' : '') + '" data-act="refreshStore" data-arg="' + esc(key) + '" title="' + esc(full + ' is ' + word + (tap ? ' (touch to refresh)' : '')) + '" aria-label="' + esc(full + ' ' + word + (tap ? ', tap to refresh' : '')) + '">' +
      '<span class="pi" style="background:' + hex6(plat.color) + '">' + plat.mark + '</span>' + (chip ? '<span>' + esc(chip) + '</span>' : '') + lk +
      (stat ? '<span class="age" data-kind="pillage" data-at="' + stat.at + '"></span>' : '') + '</button>';
  }
  function policyOpen() { const p = S.data && S.data.policy; return !p || p.open !== false; }
  /** Running text: stores that are closed / paused (or need a check-in) during open hours; a calm line outside them. */
  function marqueeHTML() {
    const d = S.data, p = d.policy || {}, st = (d.status && d.status.stores) || {};
    let text, html = '', cls = 'marq';
    if (!policyOpen()) { text = 'Closed now · open ' + (p.hours || '') + ' · no orders are read and no merchant app is visited'; cls += ' calm'; }
    else {
      if (p.marquee === false) return '';
      const names = {}, colors = {}; (d.stores || []).forEach((s) => { names[s.id] = s.name || (PLAT[s.platform] || {}).label || s.id; colors[s.id] = s.color; });
      Object.keys(PLAT).forEach((k) => { names['p:' + k] = PLAT[k].label; colors['p:' + k] = PLAT[k].color; });
      const items = Object.keys(st).filter((k) => now() - st[k].at <= (st[k].sticky ? STICKY_MS : STALE_MS) && (st[k].state === 'OFFLINE' || st[k].state === 'WARNING'))
        .map((k) => ({ name: names[k] || k, color: colors[k], off: st[k].state === 'OFFLINE' })).sort((a, b) => a.name.localeCompare(b.name));
      if (!items.length) return '';
      text = '⚠ ' + items.map((i) => i.name + (i.off ? ' is CLOSED / PAUSED' : ' needs attention')).join(' • ');
      html = '⚠&nbsp; ' + items.map((i) => {
        const c = i.color ? hex6(i.color) : '#888888', fg = onColor(c);
        return '<b class="mq-store" style="background:' + c + ';color:' + fg + '">' + esc(i.name) + '</b> <b class="mq-bad">' + (i.off ? 'CLOSED / PAUSED' : 'NEEDS ATTENTION') + '</b>';
      }).join('&nbsp;&nbsp; • &nbsp;&nbsp;');
    }
    const speed = Math.min(200, Math.max(10, +p.speed || 40));
    const dur = Math.round((text.length * 8 + 700) / speed);
    return '<div class="' + cls + '" role="status" aria-label="' + esc(text) + '"><span style="animation-duration:' + dur + 's">' + (html || esc(text)) + '</span></div>';
  }
  function pillsHTML() {
    const d = S.data, st = (d.status && d.status.stores) || {}, ref = (d.status && d.status.refreshed) || {};
    const tap = true; const out = [];
    Object.keys(PLAT).forEach((p) => {
      const mine = (d.stores || []).filter((s) => s.platform === p);
      if (mine.length) mine.forEach((s) => out.push(pillHTML(p, s.chip, s.id, s.name, st[s.id], ref[s.id], tap)));
      else if (st['p:' + p]) out.push(pillHTML(p, '', 'p:' + p, PLAT[p].label, st['p:' + p], ref['p:' + p], tap));
    });
    if (d.printer && d.printer !== 'NONE') {
      const on = d.printer === 'CONNECTED';
      out.push('<span class="pill printer" role="img" aria-label="printer ' + (on ? 'connected' : 'disconnected') + '">' + icon('printer') + (on ? icon('link', 'lk') : icon('linkoff', 'lk off')) + '</span>');
    }
    return out.join('');
  }

  function alarmHTML() {
    const w = unacked(); if (!w.length) return '';
    const same = w.every((o) => o.storeId === w[0].storeId && o.platform === w[0].platform);
    const l = look(w[0]); const store = same && l.name;
    const bg = store ? l.color : '#d32f2f', fg = store ? onColor(l.color) : '#ffffff';
    const holdOnly = w.every((o) => o.stage === 'HOLD');
    return '<div class="alarm" style="background:' + bg + ';color:' + fg + '" role="alert"><div class="grow">' +
      (same ? '<div class="t1">' + esc(l.title) + '</div>' : '') +
      '<div class="t2">' + (w.length > 1 ? w.length + ' new orders' : 'New order') + (holdOnly ? ', on hold: don\'t prepare yet' : '') + '</div></div>' +
      '<button class="btn" style="background:' + fg + ';color:' + bg + '" data-act="acceptAll">ACCEPT ALL</button></div>';
  }

  function armedBtn(key, cls, label, armedLabel, attrs) {
    const on = S.armed && S.armed.key === key;
    return '<button class="' + cls + (on ? ' armed' : '') + '" data-act="armed" data-key="' + esc(key) + '" ' + attrs + '>' + esc(on ? armedLabel : label) + '</button>' +
      (on ? '<div class="tip">Tap again within 3 seconds to confirm</div>' : '');
  }

  function driverHTML(o, col) {
    if (!col) return '';
    let stage = o.stage;
    if (stage !== 'FINDING' && stage !== 'ON_WAY' && stage !== 'ARRIVED') {
      if (o.driverStatus === 'ON_THE_WAY') stage = 'ON_WAY'; else if (o.driverStatus === 'ARRIVED') stage = 'ARRIVED'; else return '';
    }
    const cls = stage === 'FINDING' ? 'finding' : stage === 'ON_WAY' ? 'onway' : 'arrived';
    const label = stage === 'FINDING' ? 'Finding driver' : stage === 'ON_WAY' ? 'Driver on the way' : 'Driver arrived';
    const since = o.stageAt > 0 ? o.stageAt : o.updatedAt;
    return '<div class="driver ' + cls + '" data-kind="driver" data-since="' + since + '" data-eta="' + (stage === 'ON_WAY' ? o.etaAt : 0) + '">' +
      icon('moto') + '<div class="who"><div class="lbl">' + label + '</div>' + (o.driverName ? '<div class="nm">' + esc(o.driverName) + '</div>' : '') + '</div>' +
      '<span class="dtimer mono" data-kind="dtimer"></span></div>';
  }

  function prepHTML(o, col) {
    if (col !== 'NEW' && col !== 'ACCEPTED') return '';
    if (o.stage === 'HOLD') {
      const since = o.stageAt > 0 ? o.stageAt : o.createdAt;
      return '<div class="hold"><div class="bar"><span class="grow">HOLD: don\'t prepare yet</span><span class="mono" data-kind="hold" data-since="' + since + '"></span></div>' +
        '<div class="why">Waiting for the platform\'s instruction. The label prints when it says to prepare.</div></div>';
    }
    if (o.prepMinutes <= 0 && !(o.deadline > 0)) return col === 'ACCEPTED' ? '<div class="sub" style="margin-top:6px;font-size:13px">Prep time not read from the merchant app yet</div>' : '';
    if (col === 'NEW' && o.prepMinutes > 0) return '<div class="sub" style="margin-top:6px">Prep time ' + o.prepMinutes + ' min</div>';
    const start = o.prepFrom > 0 ? o.prepFrom : o.acceptedAt > 0 ? o.acceptedAt : o.createdAt;
    const due = o.deadline > 0 ? o.deadline : start + o.prepMinutes * 60000; // the merchant app's own clock when it was read
    return '<div><span class="prep mono" data-kind="prep" data-due="' + due + '"></span>' + (o.prepMinutes > 0 ? '<span class="prepof">of ' + o.prepMinutes + ' min</span>' : '') + '</div>';
  }

  function ticketHTML(o, col) {
    const l = look(o);
    const items = (o.items || []).map((it) => '<div><div class="item"><span class="q">' + (it.qty > 0 ? it.qty + '×' : '•') + '</span><span>' + esc(it.name) + '</span></div>' +
      (it.opts ? it.opts.split('\n').map((l) => '<div class="opt">' + esc(l) + '</div>').join('') : '') +
      (it.note ? '<div class="note">Note: ' + esc(it.note) + '</div>' : '') + '</div>').join('');
    const chips = [];
    if (!col && o.driverStatus === 'ARRIVED') chips.push('<span class="badge ok">Driver arrived</span>');
    if (o.autoAccepted) chips.push('<span class="badge purple">Auto-accepted</span>');
    if (o.status === 'OUT_FOR_DELIVERY') chips.push('<span class="badge blue">Out for delivery</span>');
    if (!col) chips.push('<span class="badge grey">' + esc({ READY: 'Ready', OUT_FOR_DELIVERY: 'Out for delivery', DELIVERED: 'Delivered', CANCELLED: 'Cancelled' }[o.status] || o.status) + '</span>');
    let main = '';
    if (col === 'NEW') main = '<button class="btn accept block" data-act="accept" data-id="' + esc(o.id) + '">ACCEPT</button>';
    else if (col === 'ACCEPTED') main = '<button class="btn ready block" data-act="ready" data-id="' + esc(o.id) + '">READY</button>';
    else if (col === 'READY') main = '<div class="actions two"><button class="btn line" data-act="undo" data-id="' + esc(o.id) + '">Undo</button><button class="btn done" data-act="done" data-id="' + esc(o.id) + '">DONE</button></div>';
    else main = '<button class="btn line block" style="min-height:52px;font-size:16px" data-act="undo" data-id="' + esc(o.id) + '">Undo</button>';
    return '<article class="ticket' + (col === 'NEW' ? ' new' : '') + '" style="--sc:' + l.color + '" data-id="' + esc(o.id) + '">' +
      '<div class="tband" style="background:' + l.color + ';color:' + onColor(l.color) + '"><span class="ttl">' + esc(l.title) + '</span>' + (o.sourceName ? '<span class="src">' + esc(o.sourceName) + '</span>' : '') + '</div>' +
      '<div class="tbody"><div class="row"><div class="no">#' + esc(o.orderNo || '-') + '</div><div class="age mono" data-kind="age" data-since="' + o.createdAt + '" data-work="' + (col === 'NEW' || col === 'ACCEPTED' ? 1 : 0) + '"></div></div>' +
      '<div class="sub">' + esc(o.customerName || 'Customer') + ' · ' + o.itemCount + ' items</div>' +
      prepHTML(o, col) + driverHTML(o, col) +
      (o.pin ? '<div class="pinrow">PIN<span class="pin mono">' + esc(o.pin) + '</span></div>' : '') +
      '<div class="items">' + (items || '<div class="noitems">Items not read yet. Open the order in the merchant app and they will appear.</div>') +
      (o.note ? '<div class="note order">Order note: ' + esc(o.note) + '</div>' : '') + '</div>' +
      (chips.length ? '<div class="chipline">' + chips.join('') + '</div>' : '') +
      (o.attention ? '<div class="attn">' + icon('warn') + '<div class="t"><b>Needs attention</b><span class="m">' + esc(o.attention) + '. Finish it on the order phone.</span></div><button class="textbtn" data-act="dismiss" data-id="' + esc(o.id) + '">Dismiss</button></div>' : '') +
      '<div class="actions">' + main + '</div>' +
      '<div class="more"><button class="textbtn" data-act="print" data-id="' + esc(o.id) + '">' + (o.printCount > 0 ? 'Reprint' : 'Print') + '</button><span class="grow"></span>' +
      (canDelete() ? armedBtn('delete:' + o.id, 'textbtn danger', 'Delete', 'Tap again to delete', 'data-id="' + esc(o.id) + '" data-do="delete"') : '') + '</div></div></article>';
  }

  function filterHTML() {
    const stores = S.data.stores || []; if (stores.length < 2) return '';
    const n = (id) => S.data.orders.filter((o) => o.storeId === id && colOf(o, now())).length;
    return '<button class="chip" data-act="filter" data-arg="" aria-pressed="' + (S.filter === '') + '">All stores</button>' +
      stores.map((s) => '<button class="chip" data-act="filter" data-arg="' + esc(s.id) + '" aria-pressed="' + (S.filter === s.id) + '"><span class="dot" style="background:' + hex6(s.color) + '"></span>' + esc(s.chip) + ' (' + n(s.id) + ')</button>').join('');
  }

  function boardHTML() {
    const t = now(); const wide = window.matchMedia('(min-width: 800px)').matches;
    const orders = S.data.orders.filter((o) => !S.filter || o.storeId === S.filter);
    const by = { NEW: [], ACCEPTED: [], READY: [] };
    orders.forEach((o) => { const c = colOf(o, t); if (c) by[c].push(o); });
    by.NEW.sort((a, b) => a.createdAt - b.createdAt); by.ACCEPTED.sort((a, b) => a.createdAt - b.createdAt); by.READY.sort((a, b) => b.updatedAt - a.updatedAt);
    const col = (c, label, empty) => '<div class="col">' + (by[c.k].length ? by[c.k].map((o) => ticketHTML(o, c.k)).join('') : '<div class="empty">' + esc(empty) + '</div>') + '</div>';
    if (wide) {
      return '<div class="board wide">' + COLS.map(([k, label, empty]) => {
        const list = by[k]; const oldest = list.length && k !== 'READY' ? '<span class="old">oldest <span data-kind="oldest" data-since="' + Math.min.apply(null, list.map((o) => o.createdAt)) + '"></span></span>' : '';
        return '<div><div class="colhead">' + label.toUpperCase() + '<span class="n">' + list.length + '</span>' + oldest + '</div>' + col({ k }, label, empty) + '</div>';
      }).join('') + '</div>';
    }
    const k = COLS[Math.min(S.tab, 2)][0];
    return '<div class="tabs" role="tablist">' + COLS.map(([ck, label], i) => '<button class="tab" role="tab" data-act="tab" data-arg="' + i + '" aria-selected="' + (S.tab === i) + '">' + label + ' (' + by[ck].length + ')</button>').join('') + '</div>' +
      '<div class="board">' + col({ k }, '', COLS[Math.min(S.tab, 2)][2]) + '</div>';
  }

  // ----- history
  function dayBounds() {
    const d0 = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
    const today = d0(new Date());
    if (S.hist.range === 'today') return [today.getTime(), today.getTime() + 86400000];
    if (S.hist.range === 'yesterday') return [today.getTime() - 86400000, today.getTime()];
    const parse = (v) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v || ''); return m ? new Date(+m[1], +m[2] - 1, +m[3]).getTime() : null; };
    const a = parse(S.hist.from), b = parse(S.hist.to) || a;
    if (a == null) return [0, 0];
    const lo = Math.min(a, b), hi = Math.max(a, b);
    return [lo, hi + 86400000];
  }
  function histLabel() {
    if (S.hist.range === 'today') return 'Today'; if (S.hist.range === 'yesterday') return 'Yesterday';
    const [a, b] = dayBounds(); if (!a) return 'Pick dates';
    const f = (ms) => new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
    return f(a) === f(b - 1) ? f(a) : f(a) + ' – ' + f(b - 1);
  }
  function historyHTML() {
    const [lo, hi] = dayBounds();
    const list = S.data.orders.filter((o) => isHistory(o) && (!S.filter || o.storeId === S.filter) && o.createdAt >= lo && o.createdAt < hi).sort((a, b) => b.updatedAt - a.updatedAt);
    const r = S.hist.range;
    const chip = (k, label) => '<button class="chip" data-act="histrange" data-arg="' + k + '" aria-pressed="' + (r === k) + '">' + label + '</button>';
    return '<div class="hist"><div class="bar">' + chip('today', 'Today') + chip('yesterday', 'Yesterday') + chip('custom', r === 'custom' ? esc(histLabel()) : 'Custom') + '</div>' +
      (r === 'custom' ? '<div class="bar"><label>From <input type="date" id="hfrom" value="' + esc(S.hist.from) + '"></label><label>To <input type="date" id="hto" value="' + esc(S.hist.to) + '"></label></div>' : '') +
      '<div class="bar"><span class="count">' + plural(list.length) + ' · ' + esc(histLabel()) + '</span></div>' +
      (list.length && canDelete() ? armedBtn('deleteMany', 'btn line small', 'Delete ' + plural(list.length), 'Tap again: delete ' + plural(list.length), 'data-do="deleteMany" data-arg="' + list.map((o) => o.id).join(',') + '"') : '') + '</div>' +
      (list.length ? '<div class="histlist">' + list.map((o) => ticketHTML(o, null)).join('') + '</div>' : '<div class="empty">No finished orders for ' + esc(histLabel().toLowerCase()) + '</div>');
  }

  function drawerHTML() {
    if (!S.menu) return '';
    const d = S.data; const item = (act, ic, label, cur, arg) => '<button class="item-btn" data-act="' + act + '"' + (arg ? ' data-arg="' + arg + '"' : '') + (cur ? ' aria-current="true"' : '') + '>' + icon(ic) + '<span>' + label + '</span></button>';
    const who = d.user ? d.user + ' · ' + ({ ADMIN: 'Admin (owner)', MANAGER: 'Manager', STAFF: 'Staff' }[d.role] || d.role) : (S.src.demo ? 'Demo, nothing here is real' : 'Kitchen screen');
    return '<div class="scrim" data-act="closemenu"></div><nav class="drawer" aria-label="Menu"><h2>Order Listener</h2><div class="who">' + esc(who) + '</div><hr>' +
      item('view', 'board', 'Kitchen board', S.view === 'board', 'board') + item('view', 'history', 'History', S.view === 'history', 'history') + '<hr>' +
      item('sound', S.sound ? 'vol' : 'mute', S.sound ? 'Sound on (tap to mute)' : 'Turn sound on') +
      '<div class="volrow"><label for="vol">Alarm volume</label><input type="range" id="vol" min="10" max="100" step="10" value="' + Math.round(vol() * 100) + '"></div>' +
      item('testSound', 'vol', 'Test the alarm') +
      item('theme', 'theme', 'Switch dark / light') +
      (S.src.demo ? item('addTest', 'plus', 'Add a test order') : '') +
      (S.src.live && d.role !== 'OPEN' ? '<hr>' + item('logout', 'lock', 'Log out') : '') +
      (HOSTED || S.src.demo ? '<hr>' + item('exitDemo', 'link', 'Connect to my KDS') : '') +
      '<div class="ver">Web kitchen screen. The KDS phone keeps ringing and printing.</div></nav>';
  }

  function topHTML() {
    const d = S.data; const ringing = unacked().length > 0;
    return '<div class="top"><button class="icon-btn" data-act="menu" aria-label="Menu">' + icon('menu') + '</button>' +
      '<h1>' + (S.view === 'history' ? 'History' : 'Kitchen') + (S.src.demo ? '<span class="badge demo-badge">DEMO</span>' : '<span class="badge ' + (S.connErr ? 'bad' : 'ok') + '">' + (S.connErr ? 'Offline' : 'Live') + '</span>') + '</h1>' +
      '<button class="icon-btn" data-act="sound" aria-label="' + (S.sound ? 'Mute sound' : 'Turn sound on') + '" aria-pressed="' + S.sound + '">' + icon(S.sound ? 'vol' : 'mute') + '</button>' +
      '<button class="icon-btn" data-act="refreshAll" aria-label="Refresh the order phones">' + icon('refresh') + '</button></div>';
  }

  function overlayHTML() {
    const o = S.overlay; if (!o) return '';
    if (o === 'start') {
      const last = LS.get('kdsAddr') || '';
      return '<div class="card"><h2>Kitchen screen</h2><p>Try it with sample orders, or open the kitchen screen of your own KDS phone.</p>' +
        '<div class="stack"><button class="btn block" style="background:#1565c0" data-act="startDemo">Try the demo</button></div>' +
        '<hr style="border:0;border-top:1px solid var(--line);margin:18px 0"><h2 style="font-size:19px">Open my KDS</h2>' +
        '<p>Type the address shown on the KDS phone (Settings → Kitchen display), for example <b>192.168.1.50:8765</b>. You must be on the same WiFi. Your browser may ask to allow local network access.</p>' +
        '<label class="field"><span>KDS address</span><input id="addr" inputmode="url" autocomplete="off" autocapitalize="off" placeholder="192.168.1.50:8765" value="' + esc(last) + '"></label>' +
        '<div class="err" id="oerr">' + esc(S.overlayErr) + '</div><button class="btn block" data-act="openKds" style="background:#2e7d32">Open my KDS</button>' +
        '<p style="font-size:12px;margin-top:14px">Why a separate page? A page on https cannot talk to the phone\'s plain http address, so this opens the page the phone serves itself.</p></div>';
    }
    if (o === 'code') {
      return '<div class="card"><h2>Pairing code</h2><p>Type the code shown on the KDS phone (Settings → Kitchen display).</p>' +
        '<label class="field"><span>Pairing code</span><input id="code" inputmode="numeric" autocomplete="off" value=""></label><div class="err">' + esc(S.overlayErr) + '</div>' +
        '<button class="btn block" data-act="saveCode">Continue</button></div>';
    }
    if (o === 'login') {
      return '<div class="card"><h2>Who is working?</h2><p>Type your name and PIN.</p>' +
        '<label class="field"><span>Name</span><input id="uname" autocomplete="username" autocapitalize="words" value="' + esc(LS.get('uname') || '') + '"></label>' +
        '<label class="field"><span>PIN</span><input id="upin" type="password" inputmode="numeric" autocomplete="current-password" maxlength="6"></label><div class="err">' + esc(S.overlayErr) + '</div>' +
        '<button class="btn block" data-act="doLogin">Log in</button></div>';
    }
    if (o === 'down') {
      return '<div class="card"><h2>Can\'t reach the KDS</h2><p>' + esc(S.overlayErr || 'Check that the KDS phone is on, in KDS mode, and that this device is on the same WiFi.') + '</p><button class="btn block" data-act="retry">Try again</button></div>';
    }
    return '';
  }

  function render() {
    applyLook();
    if (S.overlay) { setHTML(app, 'app', '<div class="shell">' + overlayHTML() + '</div>'); return; }
    if (!S.data) { setHTML(app, 'app', '<div class="shell"><div class="empty">Loading…</div></div>'); return; }
    const shell = '<div class="shell"><div id="s-marq"></div><div id="s-conn"></div><div id="s-top"></div><div class="pills" id="s-pills"></div><div id="s-alarm"></div><div class="chips" id="s-filter"></div><div class="body" id="s-body"></div></div><div id="s-drawer"></div>';
    if (!$('#s-body')) { cache.app = shell; app.innerHTML = shell; Object.keys(cache).forEach((k) => { if (k !== 'app') delete cache[k]; }); }
    setHTML($('#s-top'), 'top', topHTML());
    setHTML($('#s-conn'), 'conn', (S.connErr ? '<div class="conn" role="status"><span>' + esc(S.connErr) + '</span></div>' : '') + (S.sound && !S.ready ? '<div class="conn info"><span>Tap anywhere to turn the alarm sound on</span></div>' : ''));
    setHTML($('#s-pills'), 'pills', pillsHTML());
    setHTML($('#s-marq'), 'marq', marqueeHTML());
    setHTML($('#s-alarm'), 'alarm', alarmHTML());
    setHTML($('#s-filter'), 'filter', filterHTML());
    setHTML($('#s-body'), 'body', S.view === 'history' ? historyHTML() : boardHTML());
    setHTML($('#s-drawer'), 'drawer', drawerHTML());
    $('#s-filter').style.display = filterHTML() ? '' : 'none';
    tick();
  }

  // ------------------------------------------------------------------ timers (text only, so animations are not restarted)
  function tick() {
    if (!S.data) return;
    const t = now(); const set = S.data.settings || {};
    const warn = Math.max(1, set.warnMin || 10), late = Math.max(warn + 1, set.lateMin || 20);
    $$('[data-kind=age]').forEach((el) => {
      const ms = t - Number(el.dataset.since); el.textContent = ageText(ms);
      const m = ms / 60000; el.classList.toggle('late', el.dataset.work === '1' && m >= late); el.classList.toggle('warn', el.dataset.work === '1' && m >= warn && m < late);
    });
    $$('[data-kind=prep]').forEach((el) => {
      const left = Number(el.dataset.due) - t; const lateNow = left < 0, soon = !lateNow && left <= 120000;
      el.textContent = lateNow ? 'LATE +' + clock(left) : clock(left) + ' left';
      el.classList.toggle('late', lateNow); el.classList.toggle('soon', soon);
      el.setAttribute('aria-label', lateNow ? 'Late by ' + clock(left) : clock(left) + ' left to prepare');
    });
    $$('[data-kind=hold]').forEach((el) => { el.textContent = clock(t - Number(el.dataset.since)); });
    $$('[data-kind=oldest]').forEach((el) => { el.textContent = ageText(t - Number(el.dataset.since)); });
    $$('[data-kind=pillage]').forEach((el) => { el.textContent = shortAge(t - Number(el.dataset.at)); });
    $$('[data-kind=driver]').forEach((el) => {
      const eta = Number(el.dataset.eta); const out = $('[data-kind=dtimer]', el);
      out.textContent = eta > 0 ? (eta - t >= 0 ? 'ETA ' + clock(eta - t) : 'ETA +' + clock(eta - t)) : clock(t - Number(el.dataset.since));
    });
  }

  // ------------------------------------------------------------------ sound
  // The alarm is a generated WAV played through an <audio> element, not a quiet Web Audio beep:
  //  - a hard-edged siren near full scale (about 9 dB louder than a plain sine at the same setting)
  //  - loops until every order is accepted, like the app
  //  - an <audio> element is not muted by the iPhone silent switch the way Web Audio is
  // The device's own media volume still sets the final loudness: turn it up.
  const SR = 22050;
  function makeWav(parts) { // parts: [[hz, seconds], ...]; hz 0 = silence
    let total = 0; parts.forEach((q) => { total += Math.round(q[1] * SR); });
    const buf = new ArrayBuffer(44 + total * 2), v = new DataView(buf);
    const w = (o, str) => { for (let k = 0; k < str.length; k++) v.setUint8(o + k, str.charCodeAt(k)); };
    w(0, 'RIFF'); v.setUint32(4, 36 + total * 2, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true);
    v.setUint16(22, 1, true); v.setUint32(24, SR, true); v.setUint32(28, SR * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
    w(36, 'data'); v.setUint32(40, total * 2, true);
    // build the samples, then scale the loudest one to 97% of full scale (louder, without clipping)
    const x = new Float32Array(total); let at = 0, peak = 0.0001;
    parts.forEach((q) => {
      const f = q[0], n = Math.round(q[1] * SR);
      for (let k = 0; k < n; k++, at++) {
        if (f > 0) {
          const ph = 2 * Math.PI * f * k / SR;
          const y = (Math.tanh(2.2 * Math.sin(ph)) + 0.25 * Math.sin(3 * ph)) * Math.min(1, k / (SR * 0.006), (n - k) / (SR * 0.006)); // square-ish, short fades
          x[at] = y; if (Math.abs(y) > peak) peak = Math.abs(y);
        }
      }
    });
    for (let k = 0; k < total; k++) v.setInt16(44 + k * 2, Math.round((x[k] / peak) * 0.97 * 32767), true);
    return new Blob([buf], { type: 'audio/wav' });
  }
  const ALARM = [[880, 0.22], [660, 0.22], [880, 0.22], [660, 0.22], [0, 0.3]];
  const CHIME = [[988, 0.18], [1319, 0.32]];
  const vol = () => { const v = Number(LS.get('vol')); return (v >= 10 && v <= 100 ? v : 100) / 100; };
  function sounds() {
    if (!S.alarm) {
      S.alarm = new Audio(URL.createObjectURL(makeWav(ALARM))); S.alarm.loop = true; S.alarm.preload = 'auto';
      S.chime = new Audio(URL.createObjectURL(makeWav(CHIME))); S.chime.preload = 'auto';
      try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) { /* not supported */ }
    }
    S.alarm.volume = vol(); S.chime.volume = vol();
    return S;
  }
  // a browser only allows sound after a tap: unlock both players inside one
  function unlockAudio() {
    sounds();
    const un = (a) => a.play().then(() => { a.pause(); a.currentTime = 0; }).catch(() => {});
    un(S.alarm); un(S.chime);
    S.ready = true;
  }
  function playChime() { if (!S.sound) return; sounds(); S.chime.currentTime = 0; S.chime.play().catch(() => { S.ready = false; }); }
  function soundLoop() {
    if (!S.sound || !S.data || !S.alarm) return;
    const want = S.ready && unacked().length > 0;
    if (want && S.alarm.paused) S.alarm.play().catch(() => { S.ready = false; render(); });
    if (!want && !S.alarm.paused) { S.alarm.pause(); S.alarm.currentTime = 0; }
  }
  function chimeIfHoldLifted(orders) {
    orders.forEach((o) => { if (S.holds[o.id] === 'HOLD' && o.stage !== 'HOLD') playChime(); S.holds[o.id] = o.stage; });
  }

  // ------------------------------------------------------------------ networking
  S.fetchedAt = Date.now();
  async function poll() {
    if (!S.src || S.overlay === 'start') return;
    try {
      const d = await S.src.state();
      S.fetchedAt = Date.now(); chimeIfHoldLifted(d.orders || []);
      S.data = d; S.connErr = ''; if (S.overlay === 'down') S.overlay = null;
      render();
    } catch (e) {
      if (e.status === 401 && e.message === 'wrong code') { S.overlay = 'code'; S.overlayErr = LS.get('code') ? 'That code was not accepted' : ''; render(); return; }
      if (e.status === 401) { S.overlay = 'login'; S.overlayErr = ''; render(); return; }
      S.connErr = 'Connection lost, retrying…'; if (!S.data) { S.overlay = 'down'; S.overlayErr = ''; }
      render();
    }
  }
  async function connect() {
    try {
      S.helloInfo = await S.src.hello();
    } catch (e) { S.overlay = 'down'; S.overlayErr = 'No answer from this address.'; render(); return; }
    if (!S.src.demo && !LS.get('code')) { S.overlay = 'code'; render(); return; }
    await poll();
  }
  async function act(action, id, arg) {
    try { await S.src.act(action, id, arg); } catch (e) { toast(e.status === 403 ? 'Not allowed for your role' : 'Could not do that: ' + e.message); }
    await poll();
  }
  function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove('show'), 2600); }

  // ------------------------------------------------------------------ events
  document.addEventListener('pointerdown', () => { if (S.sound && !S.ready) { unlockAudio(); render(); } }, { passive: true });
  document.addEventListener('click', async (e) => {
    const el = e.target.closest('[data-act]'); if (!el) return;
    const a = el.dataset.act, id = el.dataset.id, arg = el.dataset.arg;
    if (a === 'armed') {
      const key = el.dataset.key;
      if (S.armed && S.armed.key === key) { S.armed = null; render(); await act(el.dataset.do, id, arg); return; }
      S.armed = { key }; render(); clearTimeout(S.armedH); S.armedH = setTimeout(() => { S.armed = null; render(); }, 3000); return;
    }
    switch (a) {
      case 'accept': case 'ready': case 'done': case 'undo': case 'dismiss': case 'acceptAll': return act(a, id, arg);
      case 'print': await act('print', id); return toast('Sent to the KDS printer');
      case 'refreshAll': await act('refresh', '', ''); return toast('Refresh sent to the order phones');
      case 'refreshStore': await act('refresh', '', arg); return toast('Refresh sent');
      case 'filter': S.filter = arg || ''; return render();
      case 'tab': S.tab = Number(arg); return render();
      case 'histrange': S.hist.range = arg; if (arg === 'custom' && !S.hist.from) { const d = new Date(); S.hist.from = S.hist.to = d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); } return render();
      case 'menu': S.menu = true; return render();
      case 'closemenu': S.menu = false; return render();
      case 'view': S.view = arg; S.menu = false; return render();
      case 'sound': S.sound = !S.sound; LS.set('sound', S.sound ? '1' : '0'); if (S.sound) { unlockAudio(); setTimeout(() => { S.chime.currentTime = 0; S.chime.play().catch(() => {}); }, 120); } else if (S.alarm) { S.alarm.pause(); S.alarm.currentTime = 0; } S.menu = false; return render();
      case 'testSound': { S.sound = true; LS.set('sound', '1'); unlockAudio(); setTimeout(() => { S.alarm.currentTime = 0; S.alarm.play().catch(() => {}); setTimeout(() => { if (!unacked().length) { S.alarm.pause(); S.alarm.currentTime = 0; } }, 2600); }, 150); toast('Playing the alarm for a moment'); return render(); }
      case 'theme': { const cur = document.documentElement.getAttribute('data-theme'); S.themePref = cur === 'dark' ? 'LIGHT' : 'DARK'; LS.set('theme', S.themePref); S.menu = false; return render(); }
      case 'addTest': S.menu = false; return act('addTest');
      case 'logout': await S.src.logout(); S.data = null; S.menu = false; S.overlay = 'login'; return render();
      case 'exitDemo': S.menu = false; S.src = null; S.data = null; S.mode = 'start'; S.overlay = 'start'; return render();
      case 'startDemo': S.mode = 'demo'; S.src = demoSource(); S.overlay = null; return connect();
      case 'openKds': {
        const v = ($('#addr').value || '').trim().replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
        if (!/^[A-Za-z0-9.\-]+(:\d{2,5})?$/.test(v)) { S.overlayErr = 'Type it like 192.168.1.50:8765'; return render(); }
        LS.set('kdsAddr', v); location.href = 'http://' + (v.indexOf(':') < 0 ? v + ':8765' : v) + '/'; return;
      }
      case 'saveCode': { const c = ($('#code').value || '').trim(); if (!c) { S.overlayErr = 'Type the code'; return render(); } LS.set('code', c); S.overlay = null; S.overlayErr = ''; return poll(); }
      case 'doLogin': {
        const n = ($('#uname').value || '').trim(), p = $('#upin').value || '';
        try { await S.src.login(n, p); LS.set('uname', n); S.overlay = null; S.overlayErr = ''; return poll(); }
        catch (er) { S.overlayErr = er.status === 429 ? 'Too many tries. Wait ' + ((er.body && er.body.seconds) || 30) + ' seconds.' : er.status === 401 && er.message === 'wrong code' ? 'Wrong pairing code' : 'Wrong name or PIN'; return render(); }
      }
      case 'retry': S.overlay = null; return connect();
    }
  });
  document.addEventListener('input', (e) => { if (e.target.id === 'vol') { LS.set('vol', e.target.value); if (S.alarm) { S.alarm.volume = vol(); S.chime.volume = vol(); } } });
  document.addEventListener('change', (e) => {
    if (e.target.id === 'hfrom') { S.hist.from = e.target.value; if (!S.hist.to || S.hist.to < S.hist.from) S.hist.to = S.hist.from; render(); }
    if (e.target.id === 'hto') { S.hist.to = e.target.value; render(); }
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Enter') { const b = $('.card .btn'); if (b && e.target.tagName === 'INPUT') b.click(); } if (e.key === 'Escape' && S.menu) { S.menu = false; render(); } });
  window.matchMedia('(min-width: 800px)').addEventListener('change', () => { delete cache.body; render(); });

  // ------------------------------------------------------------------ start
  if (params.has('demo')) { S.mode = 'demo'; S.src = demoSource(); connect(); }
  else if (HOSTED) { S.mode = 'start'; S.overlay = 'start'; render(); }
  else { S.mode = 'phone'; S.src = phoneSource(); connect(); }
  setInterval(() => { if (S.mode === 'demo' || S.mode === 'phone') poll(); }, 2000);
  setInterval(() => { tick(); soundLoop(); }, 1000);
  window.__kds = { S, render, tick, makeWav, ALARM, CHIME, SR }; // handy for tests
})();
