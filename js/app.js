/* Lines — a private library for Leon × Zoi.
   Everything the reader imports stays in this browser (IndexedDB). Nothing is uploaded. */
(() => {
  'use strict';

  // ---------- Fixed data ----------

  const CHARS = {
    Leon:   { full: 'Leon S. Kennedy',  color: '#2D4E9C', object: 'Personal items', objectZh: '个人物品', alias: ['leon', '里昂', '莱昂'] },
    Zoi:    { full: 'Zoi Z',            color: '#D0432E', object: 'Sketchbook',     objectZh: '速写本',   alias: ['zoi', '雪儿'] },
    Evan:   { full: 'Evan J. Mercer',   color: '#B98516', object: 'Save files',     objectZh: '存档',     alias: ['evan', '埃文'] },
    Hudson: { full: 'Hudson M. Foster', color: '#2F7D63', object: 'Diary',          objectZh: '日记',     alias: ['hudson', '哈德森'] },
  };
  const ORDER = ['Leon', 'Zoi', 'Evan', 'Hudson'];
  const DEFAULT_COLORS = Object.fromEntries(ORDER.map((c) => [c, CHARS[c].color]));
  ORDER.forEach((c) => {
    const v = store('lines:color:' + c);
    if (v && /^#[0-9a-f]{6}$/i.test(v)) CHARS[c].color = v;
  });

  const SECTIONS = [
    { key: 'main',      href: '#/main',      name: 'Main line',  desc: 'The chapters that form the main thread.' },
    { key: 'dialogues', href: '#/dialogues', name: 'Dialogues',  desc: 'One-to-one conversations, kept in their own words.' },
    { key: 'side',      href: '#/side',      name: 'Side lines', desc: 'Other moments, possibilities and paths.' },
    { key: 'messages',  href: '#/messages',  name: 'Messages',   desc: 'Texts sent between them.' },
    { key: 'studies',   href: '#/studies',   name: 'Studies',    desc: 'Overviews, terms and readings of the source.' },
    { key: 'gallery',   href: '#/gallery',   name: 'Gallery',    desc: 'Portraits, sketches and photographs.' },
  ];

  const TILE_LAYOUT = [
    { basis: 420, ar: '4 / 5', mt: 40,  dot: true },
    { basis: 220, ar: '1 / 1', mt: 180 },
    { basis: 320, ar: '3 / 4', mt: 80 },
    { basis: 280, ar: '4 / 5', mt: 40,  ml: '10%' },
    { basis: 220, ar: '1 / 1', mt: 220, blue: true },
    { basis: 460, ar: '3 / 2', mt: 120 },
  ];

  const TYPE_LABEL = {
    dialogue: 'Dialogue', side: 'Side line', message: 'Messages', diary: 'Diary', item: 'Item',
    save: 'Save', note: 'Note', profile: 'Profile', sketch: 'Sketch', study: 'Study', other: 'Other',
  };

  const TYPE_HOME = {
    dialogue: '#/dialogues', side: '#/side', message: '#/messages', study: '#/studies', other: '#/studies',
    diary: '#/c/Hudson', item: '#/c/Leon', save: '#/c/Evan', sketch: '#/c/Zoi',
  };

  const IMG_TYPES = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', heic: 'image/heic' };
  const HEAD_RE = /^第(\d{1,4})篇([^，,。：:｜|、；;\s][^\n]{0,59}|\s+[^\n]{1,60})?$/;
  const SPEAKER_RE = /^(Leon|Zoi|Evan|Hudson|里昂)\s*[:：]\s*(.*)$/i;
  const GENERIC_SPEAKER_RE = /^([A-Z][A-Za-z.'-]{1,20})\s*[:：]\s*(.*)$/;

  // ---------- Small helpers ----------

  const $app = document.getElementById('app');
  const $overlay = document.getElementById('overlay');
  const $file = document.getElementById('file-input');

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const enc = encodeURIComponent;
  const pad = (n, w = 2) => String(n).padStart(w, '0');
  const basename = (p) => p.split('/').pop();
  const stripExt = (n) => n.replace(/\.[^.]+$/, '');

  function store(key, value) {
    try {
      if (value === undefined) return localStorage.getItem(key);
      localStorage.setItem(key, value);
    } catch (e) { /* storage can be unavailable; the library still works */ }
    return null;
  }

  function canonChar(name) {
    const n = String(name).trim().toLowerCase();
    for (const c of ORDER) if (CHARS[c].alias.includes(n)) return c;
    return null;
  }

  function parseChars(s) {
    const out = [];
    for (const part of String(s).split(/[×xX&、,，/＋+和与\s]+/)) {
      if (!part) continue;
      const c = canonChar(part) || part.trim();
      if (c && !out.includes(c)) out.push(c);
    }
    return sortChars(out);
  }

  function detectChars(str) {
    const low = String(str).toLowerCase();
    return ORDER.filter((c) => CHARS[c].alias.some((a) => low.includes(a)));
  }

  function sortChars(list) {
    return [...list].sort((a, b) => {
      const ia = ORDER.indexOf(a), ib = ORDER.indexOf(b);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
  }

  const charColor = (c) => (CHARS[c] ? CHARS[c].color : '#8A857A');
  const dashes = (chars, cls = 'dashes') =>
    chars && chars.length ? `<span class="${cls}" aria-hidden="true">${chars.map((c) => `<i style="background:${charColor(c)}"></i>`).join('')}</span>` : '';
  const pairLabel = (chars) => (chars || []).join(' × ');

  function decodeText(u8) {
    if (u8[0] === 0xff && u8[1] === 0xfe) return new TextDecoder('utf-16le').decode(u8.subarray(2));
    if (u8[0] === 0xfe && u8[1] === 0xff) return new TextDecoder('utf-16be').decode(u8.subarray(2));
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(u8).replace(/^﻿/, '');
    } catch (e) {
      try { return new TextDecoder('gb18030').decode(u8); } catch (e2) { return new TextDecoder('utf-8').decode(u8); }
    }
  }

  function toast(msg, ms = 2600) {
    let t = document.querySelector('.toast');
    if (!t) { t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.remove('show'), ms);
  }

  // ---------- IndexedDB ----------

  const dbp = new Promise((resolve, reject) => {
    const r = indexedDB.open('lines', 1);
    r.onupgradeneeded = () => { r.result.createObjectStore('files', { keyPath: 'key' }); };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });

  function idb(mode, op) {
    return dbp.then((db) => new Promise((resolve, reject) => {
      const t = db.transaction('files', mode);
      const req = op(t.objectStore('files'));
      t.oncomplete = () => resolve(req && 'result' in req ? req.result : undefined);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error || new Error('Storage was interrupted.'));
    }));
  }
  const getAllRecords = () => idb('readonly', (s) => s.getAll());
  const putRecords = (recs) => idb('readwrite', (s) => { recs.forEach((r) => s.put(r)); });
  const deleteRecord = (key) => idb('readwrite', (s) => s.delete(key));
  const clearRecords = () => idb('readwrite', (s) => s.clear());

  // ---------- Import / export ----------

  function makeRecord(path, data) {
    path = path.replace(/\\/g, '/').replace(/^\/+/, '');
    if (path.includes('__MACOSX/')) return null;
    const name = basename(path);
    if (!name || name.startsWith('.')) return null;
    const folder = path.slice(0, path.length - name.length).replace(/\/$/, '');
    const ext = (name.split('.').pop() || '').toLowerCase();
    if (['txt', 'md', 'markdown'].includes(ext)) {
      return { key: name, name, folder, kind: 'text', text: decodeText(data).replace(/\r\n?/g, '\n'), added: Date.now() };
    }
    if (IMG_TYPES[ext]) {
      return { key: name, name, folder, kind: 'image', mime: IMG_TYPES[ext], buf: data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength), added: Date.now() };
    }
    return null;
  }

  async function importFiles(fileList, replace) {
    const recs = [];
    let skipped = 0;
    toast('Importing…', 60000);
    for (const f of fileList) {
      try {
        if (f.name.toLowerCase().endsWith('.zip')) {
          for (const e of await window.LinesZip.readZip(await f.arrayBuffer())) {
            const r = makeRecord(e.name, e.data);
            r ? recs.push(r) : skipped++;
          }
        } else {
          const r = makeRecord(f.name, new Uint8Array(await f.arrayBuffer()));
          r ? recs.push(r) : skipped++;
        }
      } catch (err) {
        toast(`Could not read ${f.name}: ${err.message}`, 5000);
        return;
      }
    }
    if (!recs.length) { toast('No .txt, .md or image files were found.', 4000); return; }
    if (replace) await clearRecords();
    await putRecords(recs);
    await loadLibrary();
    toast(`Imported ${recs.length} file${recs.length === 1 ? '' : 's'}${skipped ? ` · skipped ${skipped}` : ''}.`, 4000);
    route();
  }

  async function exportAll() {
    const recs = await getAllRecords();
    if (!recs.length) { toast('The library is empty.'); return; }
    const te = new TextEncoder();
    const items = recs.map((r) => ({
      name: 'Lines/' + (r.folder ? r.folder.replace(/^Lines\/?/, '') + (r.folder.replace(/^Lines\/?/, '') ? '/' : '') : '') + r.name,
      data: r.kind === 'text' ? te.encode(r.text) : new Uint8Array(r.buf),
    }));
    const d = new Date();
    const blob = window.LinesZip.writeZip(items);
    await saveBlob(blob, `Lines-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}.zip`);
  }

  async function saveBlob(blob, filename) {
    const file = new File([blob], filename, { type: blob.type || 'application/octet-stream' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file] }); return; } catch (e) { if (e.name === 'AbortError') return; }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  // ---------- Parsing ----------

  function parseHeader(text) {
    const lines = text.split('\n');
    const meta = {};
    let i = 0;
    while (i < lines.length && !lines[i].trim()) i++;
    const start = i;
    for (; i < lines.length && i < start + 12; i++) {
      const L = lines[i].trim();
      if (/^[-—]{3,}$/.test(L)) {
        if (meta['类型']) return { meta, body: lines.slice(i + 1).join('\n') };
        break;
      }
      const m = L.match(/^(类型|人物|篇号|标题|日期|篇章|图片)\s*[:：]\s*(.*)$/);
      if (!m) break;
      meta[m[1]] = m[2].trim();
    }
    return { meta: null, body: text };
  }

  function normType(v) {
    v = String(v || '').toLowerCase();
    if (/主线|main/.test(v)) return 'main';
    if (/1v1|对话|dialogue/.test(v)) return 'dialogue';
    if (/支线|side/.test(v)) return 'side';
    if (/短信|message|sms/.test(v)) return 'message';
    if (/日记|diary/.test(v)) return 'diary';
    if (/物件|物品|item/.test(v)) return 'item';
    if (/存档|save/.test(v)) return 'save';
    if (/留言/.test(v)) return 'note';
    if (/档案|profile/.test(v)) return 'profile';
    if (/插画|速写|sketch/.test(v)) return 'sketch';
    if (/概览|术语|交接|研究|解析|overview/.test(v)) return 'study';
    return 'other';
  }

  const countHeadings = (text) => text.split('\n').filter((l) => HEAD_RE.test(l.trim())).length;

  function guessType(path, text) {
    if (/概览|术语|交接|解析|研究/.test(path)) return 'study';
    if (/1v1/i.test(path)) return 'dialogue';
    if (/支线/.test(path)) return 'side';
    if (/短信/.test(path)) return 'message';
    if (/日记/.test(path)) return 'diary';
    if (/档案/.test(path)) return 'profile';
    if (/存档/.test(path)) return 'save';
    if (/物品|物件/.test(path)) return 'item';
    if (/留言/.test(path)) return 'note';
    if (/主线/.test(path) || countHeadings(text) >= 2) return 'main';
    return 'other';
  }

  function epFrom(str) {
    const m = String(str || '').match(/(\d{1,4})/);
    return m ? parseInt(m[1], 10) : null;
  }

  let LIB = { arcs: [], chapters: [], docs: [], images: [], records: [], byId: new Map() };

  function parseMain(rec, body, meta, arcs, chapters) {
    const base = stripExt(rec.name);
    let arcName = meta && meta['篇章'] ? meta['篇章'] : null;
    let range = null;
    const segs = base.split(/[｜|]/).map((s) => s.trim());
    const ri = segs.findIndex((s) => /^\d+\s*[-–—~]\s*\d+$/.test(s));
    if (ri >= 0) {
      range = segs[ri].split(/[-–—~]/).map((x) => parseInt(x, 10));
      if (!arcName) arcName = segs.slice(ri + 1).join('｜') || null;
    }
    if (!arcName) {
      const m = body.match(/^第(\d+)\s*[-–—]\s*(\d+)篇[｜|]([^｜|\n]+)/m);
      if (m) { arcName = m[3].trim(); range = range || [+m[1], +m[2]]; }
    }
    if (!arcName) arcName = base.replace(/^<[^>]*>/, '').trim() || 'Main line';

    if (!arcs.has(arcName)) arcs.set(arcName, { name: arcName, range, chapters: [] });
    const arc = arcs.get(arcName);
    if (!arc.range && range) arc.range = range;

    const parts = [];
    let cur = null;
    for (const line of body.split('\n')) {
      const m = line.trim().match(HEAD_RE);
      if (m) { cur = { num: +m[1], note: (m[2] || '').trim(), lines: [] }; parts.push(cur); continue; }
      if (cur) cur.lines.push(line);
    }
    if (!parts.length && meta && meta['篇号']) {
      parts.push({ num: epFrom(meta['篇号']), note: meta['标题'] || '', lines: body.split('\n') });
    }
    for (const p of parts) {
      const ch = {
        kind: 'chapter', num: p.num, note: p.note, tags: p.note ? p.note.split(/\s+/).filter(Boolean) : [],
        arc: arcName, text: p.lines.join('\n').trim(), path: rec.name,
      };
      arc.chapters.push(ch);
      chapters.push(ch);
    }
  }

  function makeDoc(rec, type, meta, body) {
    const base = stripExt(rec.name);
    let chars = meta['人物'] ? parseChars(meta['人物']) : detectChars(base);
    if (!chars.length) {
      if (type === 'diary') chars = ['Hudson'];
      if (type === 'save') chars = ['Evan'];
      if (type === 'item') chars = ['Leon'];
      if (type === 'sketch') chars = ['Zoi'];
    }
    let ep = meta['篇号'] ? epFrom(meta['篇号']) : null;
    if (ep == null) {
      const m = base.match(/第(\d{1,4})篇/) || base.match(/(?:^|[｜|])(\d{1,4})(?:[｜|]|$)/);
      if (m) ep = parseInt(m[1], 10);
    }
    let title = meta['标题'] || base.replace(/^<[^>]*>/, '').trim();
    return {
      kind: 'doc', id: type + ':' + rec.name, type, title, chars, ep, date: meta['日期'] || '',
      image: meta['图片'] || '', text: body.trim(), path: rec.name,
    };
  }

  function buildIndex(records) {
    LIB.images.forEach((im) => URL.revokeObjectURL(im.url));
    const arcs = new Map();
    const chapters = [], docs = [], images = [];
    for (const r of records) {
      if (r.kind === 'image') {
        const where = (r.folder + '/' + r.name);
        images.push({
          kind: 'image', id: 'img:' + r.name, name: r.name, folder: r.folder,
          url: URL.createObjectURL(new Blob([r.buf], { type: r.mime })),
          chars: detectChars(where),
          sketch: /插画|速写|sketch|drawing/i.test(where),
          cover: /封面|cover/i.test(r.folder),
        });
        continue;
      }
      const { meta, body } = parseHeader(r.text);
      const type = meta ? normType(meta['类型']) : guessType((r.folder ? r.folder + '/' : '') + r.name, r.text);
      if (type === 'main') parseMain(r, body, meta, arcs, chapters);
      else docs.push(makeDoc(r, type, meta || {}, body));
    }

    const arcList = [...arcs.values()];
    arcList.forEach((a) => {
      a.chapters.sort((x, y) => x.num - y.num);
      if (!a.range && a.chapters.length) a.range = [a.chapters[0].num, a.chapters[a.chapters.length - 1].num];
    });
    arcList.sort((a, b) => (a.range ? a.range[0] : 1e9) - (b.range ? b.range[0] : 1e9));

    const ordered = [];
    arcList.forEach((a) => a.chapters.forEach((c) => ordered.push(c)));
    const seen = new Map();
    ordered.forEach((c, i) => {
      const k = seen.get(c.num) || 0;
      seen.set(c.num, k + 1);
      c.id = 'ch:' + c.num + (k ? '-' + (k + 1) : '');
      c.index = i;
      c.title = '第' + c.num + '篇';
    });

    docs.sort((a, b) => (a.ep ?? 1e9) - (b.ep ?? 1e9) || a.title.localeCompare(b.title, 'zh'));
    images.sort((a, b) => a.name.localeCompare(b.name, 'zh'));

    const byId = new Map();
    ordered.forEach((c) => byId.set(c.id, c));
    docs.forEach((d) => byId.set(d.id, d));
    LIB = { arcs: arcList, chapters: ordered, docs, images, records, byId };
  }

  async function loadLibrary() {
    const recs = await getAllRecords();
    buildIndex(recs);
  }

  // ---------- Queries ----------

  const docsOf = (type) => LIB.docs.filter((d) => (Array.isArray(type) ? type.includes(d.type) : d.type === type));
  const imageByName = (n) => n && LIB.images.find((i) => i.name === n || stripExt(i.name) === stripExt(n));

  function coverFor(key) {
    const k = key.toLowerCase();
    return LIB.images.find((i) => i.cover && stripExt(i.name).toLowerCase() === k);
  }

  function overviewFor(arcName) {
    const core = arcName.replace(/篇$/, '');
    return LIB.docs.find((d) => d.type === 'study' && /概览/.test(d.title + d.path) && (d.title + d.path).includes(core));
  }

  function sectionCount(key) {
    switch (key) {
      case 'main': return LIB.chapters.length;
      case 'dialogues': return docsOf('dialogue').length;
      case 'side': return docsOf('side').length;
      case 'messages': return docsOf('message').length;
      case 'studies': return docsOf(['study', 'other']).length;
      case 'gallery': return LIB.images.filter((i) => !i.cover).length;
      default: return 0;
    }
  }

  // ---------- Shared pieces of markup ----------

  const ringSVG = (size = 28, stroke = 'currentColor', hole = 4) =>
    `<svg width="${size}" height="${size}" viewBox="0 0 28 28" aria-hidden="true"><circle cx="14" cy="14" r="12.5" fill="none" stroke="${stroke}" stroke-width="1.5"/><circle cx="14" cy="14" r="${hole}" fill="none" stroke="${stroke}" stroke-width="1.5"/></svg>`;

  const lineArt = (d) => `<svg viewBox="0 0 200 120" class="lineart" aria-hidden="true"><path d="${d}" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>`;
  const ART = [
    'M8 84 C 40 18, 82 20, 100 62 S 158 112, 192 36',
    'M10 60 C 50 10, 90 110, 130 60 S 180 20, 190 70',
    'M10 100 C 30 30, 70 30, 90 70 C 110 110, 150 100, 160 50 S 185 10, 192 30',
    'M14 70 C 40 20, 80 100, 110 60 S 160 30, 188 80',
    '',
    'M6 70 C 30 40, 60 40, 80 66 S 130 96, 150 60 S 186 30, 196 52',
  ];

  function bagelSVG() {
    const seeds = [[170,140,30],[330,150,-20],[362,238,60],[140,240,-40],[192,330,15],[312,338,-50],[292,418,20],[205,414,-30],[384,300,10],[118,302,70],[302,96,45],[196,92,-60],[398,198,0],[104,194,30],[342,384,-15],[160,384,40]];
    // Leon and Zoi sit on the axis through the hole; Evan and Hudson join Zoi from either side.
    return `<svg class="bagel" viewBox="-50 0 600 500" role="img" aria-label="Four characters on a ring. Leon and Zoi are joined through the centre; Evan and Hudson each have a line to Zoi.">
      <defs>
        <linearGradient id="gZL" gradientUnits="userSpaceOnUse" x1="250" y1="50" x2="250" y2="450"><stop offset="0" stop-color="${CHARS.Zoi.color}"/><stop offset="1" stop-color="${CHARS.Leon.color}"/></linearGradient>
        <linearGradient id="gZE" gradientUnits="userSpaceOnUse" x1="250" y1="50" x2="77" y2="150"><stop offset="0" stop-color="${CHARS.Zoi.color}"/><stop offset="1" stop-color="${CHARS.Evan.color}"/></linearGradient>
        <linearGradient id="gZH" gradientUnits="userSpaceOnUse" x1="250" y1="50" x2="423" y2="150"><stop offset="0" stop-color="${CHARS.Zoi.color}"/><stop offset="1" stop-color="${CHARS.Hudson.color}"/></linearGradient>
      </defs>
      <circle cx="250" cy="250" r="200" fill="none" stroke="var(--ink)" stroke-width="1.2"/>
      <g fill="var(--ink)">${seeds.map(([x, y, r]) => `<ellipse cx="${x}" cy="${y}" rx="4.5" ry="1.8" transform="rotate(${r} ${x} ${y})"/>`).join('')}</g>
      <line x1="250" y1="50" x2="250" y2="450" stroke="url(#gZL)" stroke-width="3.5"/>
      <line x1="250" y1="50" x2="77" y2="150" stroke="url(#gZE)" stroke-width="1.5"/>
      <line x1="250" y1="50" x2="423" y2="150" stroke="url(#gZH)" stroke-width="1.5"/>
      <circle cx="250" cy="250" r="62" fill="var(--paper)" stroke="var(--ink)" stroke-width="1.2"/>
      <line x1="250" y1="188" x2="250" y2="312" stroke="url(#gZL)" stroke-width="3.5" stroke-dasharray="2 7" stroke-linecap="round"/>
      <a href="#/c/Zoi"><circle cx="250" cy="50" r="11" fill="${CHARS.Zoi.color}" stroke="var(--paper)" stroke-width="3"/><text x="250" y="26" text-anchor="middle">Zoi</text></a>
      <a href="#/c/Leon"><circle cx="250" cy="450" r="11" fill="${CHARS.Leon.color}" stroke="var(--paper)" stroke-width="3"/><text x="250" y="486" text-anchor="middle">Leon</text></a>
      <a href="#/c/Evan"><circle cx="77" cy="150" r="9" fill="${CHARS.Evan.color}" stroke="var(--paper)" stroke-width="3"/><text x="60" y="140" text-anchor="end">Evan</text></a>
      <a href="#/c/Hudson"><circle cx="423" cy="150" r="9" fill="${CHARS.Hudson.color}" stroke="var(--paper)" stroke-width="3"/><text x="440" y="140">Hudson</text></a>
    </svg>`;
  }

  function topbar() {
    return `<header class="top">
      <a class="logo" href="#/">${ringSVG(26)}<span>Lines</span></a>
      <div class="top-actions">
        <button class="iconbtn" data-act="search" aria-label="Search"><svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.5" cy="8.5" r="6.5" fill="none" stroke="currentColor" stroke-width="1.5"/><line x1="13.5" y1="13.5" x2="18.5" y2="18.5" stroke="currentColor" stroke-width="1.5"/></svg></button>
        <button class="menubtn" data-act="menu">MENU <svg width="18" height="10" viewBox="0 0 18 10" aria-hidden="true"><line x1="0" y1="2" x2="18" y2="2" stroke="currentColor" stroke-width="1.5"/><line x1="0" y1="8" x2="18" y2="8" stroke="currentColor" stroke-width="1.5"/></svg></button>
      </div>
    </header>`;
  }

  const footer = () => `<footer class="foot"><span>Lines · Leon × Zoi</span>${ringSVG(36, 'currentColor', 5)}<a href="#/library">Library · import &amp; export</a></footer>`;

  const sectionHead = (label, count, extra = '') =>
    `<div class="shead"><h2>${esc(label)}</h2><span>${extra}${count != null ? `(${pad(count)})` : ''}</span></div>`;

  function pageTitle(title, lede, right = '') {
    return `<div class="ptitle"><div class="ptitle-row"><h1>${esc(title)}</h1>${right}</div>${lede ? `<p class="lede">${esc(lede)}</p>` : ''}</div>`;
  }

  function emptyState(msg) {
    return `<div class="empty"><p>${esc(msg)}</p><button class="btn" data-act="import">Import files</button></div>`;
  }

  function rowHTML(item, opts = {}) {
    const isCh = item.kind === 'chapter';
    const href = isCh ? '#/ch/' + enc(item.id) : '#/doc/' + enc(item.id);
    const num = isCh ? pad(item.num, 3) : item.ep != null ? pad(item.ep, 3) : '—';
    const title = isCh ? (opts.chapterTitle ? item.title : excerpt(item.text, 30) || item.title) : item.title;
    const meta = isCh
      ? item.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join('')
      : [opts.showType ? TYPE_LABEL[item.type] : '', pairLabel(item.chars), item.date].filter(Boolean).map(esc).join(' · ');
    return `<a class="row${opts.noNum ? ' no-num' : ''}${isCh && !opts.chapterTitle ? ' ch-row' : ''}" href="${href}"><span class="row-num">${num}</span><span class="row-main"><span class="row-title">${esc(title)}</span>${meta ? `<span class="row-meta">${meta}</span>` : ''}</span>${isCh ? '' : dashes(item.chars)}</a>`;
  }

  // ---------- Body formatting ----------

  function speakerOf(t, generic) {
    let m = t.match(SPEAKER_RE);
    if (m) return { name: canonChar(m[1]) || m[1], rest: m[2] };
    if (generic) { m = t.match(GENERIC_SPEAKER_RE); if (m) return { name: m[1], rest: m[2] }; }
    return null;
  }

  const speakerLabel = (name) => `<span class="spk"><i style="background:${charColor(name)}"></i>${esc(name)}</span>`;

  function formatBody(text, opts = {}) {
    const out = [];
    let block = null;
    const flush = () => {
      if (block) { out.push(`<div class="turn">${speakerLabel(block.name)}${block.paras.map((p) => `<p>${esc(p)}</p>`).join('')}</div>`); block = null; }
    };
    for (const raw of text.split('\n')) {
      const t = raw.trim();
      if (!t) continue;
      if (/^[（(][\s\S]*[)）]$/.test(t)) { flush(); out.push(`<p class="scene">${esc(t.slice(1, -1))}</p>`); continue; }
      if (/^([一二三四五六七八九十百]+、|#{1,3}\s)/.test(t) || /^【[^】]*】$/.test(t)) {
        flush(); out.push(`<h3 class="sub">${esc(t.replace(/^#{1,3}\s/, ''))}</h3>`); continue;
      }
      const sp = opts.speakers === false ? null : speakerOf(t, opts.generic);
      if (sp) { flush(); block = { name: sp.name, paras: sp.rest ? [sp.rest] : [] }; continue; }
      if (block) block.paras.push(t); else out.push(`<p>${esc(t)}</p>`);
    }
    flush();
    return out.join('');
  }

  function formatMessages(text) {
    const out = [];
    let who = null;
    for (const raw of text.split('\n')) {
      const t = raw.trim();
      if (!t) continue;
      if (/^[（(][\s\S]*[)）]$/.test(t)) { out.push(`<p class="msg-scene">${esc(t.slice(1, -1))}</p>`); continue; }
      if (/^([一二三四五六七八九十百]+、|#{1,3}\s)/.test(t) || /^\d{1,2}[:：]\d{2}/.test(t)) { out.push(`<p class="msg-time">${esc(t.replace(/^#{1,3}\s/, ''))}</p>`); continue; }
      const sp = speakerOf(t, true);
      if (sp) {
        who = sp.name;
        out.push(`<p class="msg-name ${who === 'Zoi' ? 'me' : ''}">${speakerLabel(who)}</p>`);
        if (sp.rest) out.push(`<p class="bubble ${who === 'Zoi' ? 'me' : ''}">${esc(sp.rest)}</p>`);
        continue;
      }
      out.push(`<p class="bubble ${who === 'Zoi' ? 'me' : ''}">${esc(t)}</p>`);
    }
    return `<div class="thread">${out.join('')}</div>`;
  }

  function excerpt(text, n = 80) {
    const t = text.replace(/^[（(].*?[)）]$/gm, '').replace(/^(Leon|Zoi|Evan|Hudson)\s*[:：]\s*$/gim, '').replace(/\s+/g, ' ').trim();
    return t.length > n ? t.slice(0, n) + '…' : t;
  }

  // ---------- Views ----------

  function viewHome() {
    const empty = !LIB.records.length;
    const cur = LIB.arcs[LIB.arcs.length - 1];
    const lastId = store('lines:last');
    const last = lastId && LIB.byId.get(lastId);

    const tiles = SECTIONS.map((s, i) => {
      const L = TILE_LAYOUT[i];
      const cover = coverFor(s.key);
      const count = sectionCount(s.key);
      let art;
      if (cover) art = `<img src="${cover.url}" alt="">`;
      else if (L.blue) art = `<span class="tile-ring">${ringSVG(96, 'var(--paper)', 5)}</span>`;
      else art = `${lineArt(ART[i])}<span class="ph">[your line drawing]</span>`;
      return `<a class="tile" href="${s.href}" style="--basis:${L.basis}px;--mt:${L.mt}px;--ml:${L.ml || '0px'}">
        <span class="tile-img${L.blue && !cover ? ' is-blue' : ''}" style="aspect-ratio:${L.ar}">${art}${L.dot ? '<span class="tile-dot"></span>' : ''}</span>
        <span class="tile-title">${s.name}<sup>${pad(i + 1)}</sup></span>
        <span class="tile-desc">${s.desc}${count ? ` <b>${count}</b>` : ''}</span>
      </a>`;
    }).join('');

    const arcItems = LIB.arcs.slice(0, -1).map((a, i, arr) => {
      const shade = ['#8A857A', '#7A756B', '#6B675E', '#5C5951', '#4A4741'][Math.max(0, 4 - (arr.length - 1 - i))] || '#8A857A';
      return `<a href="#/main/${enc(a.name)}" style="color:${shade}">${esc(a.name)}<sup>${a.range ? a.range.join('–') : ''}</sup></a>`;
    }).join('');
    const ov = cur && overviewFor(cur.name);
    const curBlock = cur ? `<div class="arc-current">
        <i class="br tl"></i><i class="br tr"></i><i class="br bl"></i><i class="br br2"></i>
        <a class="arc-name" href="#/main/${enc(cur.name)}">${esc(cur.name)}</a>
        <span class="arc-meta">${cur.range ? `第${cur.range[0]}–${cur.range[1]}篇 · ` : ''}Current arc${ov ? ` · <a href="#/doc/${enc(ov.id)}">Overview ↗</a>` : ''}</span>
      </div>` : '';

    return `${topbar()}
    <main>
      <section class="hero wrap">
        <div class="hero-line">
          <h1 class="mega">Lines</h1>
          <span class="rule"></span>
          <p class="pair"><span style="color:${CHARS.Leon.color}">Leon</span> <span class="x">×</span> <span style="color:${CHARS.Zoi.color}">Zoi</span></p>
        </div>
        <div class="hero-sub">
          <div class="hero-text">
            <p class="intro">A private library for one long story: the main line, the dialogues, the side lines, and the four people they run between.</p>
            ${last ? `<a class="continue" href="${last.kind === 'chapter' ? '#/ch/' : '#/doc/'}${enc(last.id)}">Continue reading · ${esc(last.title)} →</a>` : ''}
            ${empty ? `<div class="import-cta"><p>The library is empty. Compress your Lines folder in Files, then import the .zip.</p><button class="btn" data-act="import">Import</button></div>` : '<p class="small">Kept offline, on this device.</p>'}
          </div>
          ${bagelSVG()}
        </div>
      </section>

      <section class="wrap block">
        ${sectionHead('CONTENTS', SECTIONS.length)}
        <div class="tiles">${tiles}</div>
      </section>

      ${LIB.arcs.length ? `<section class="wrap block">
        ${sectionHead('ARCS', LIB.arcs.length, '<a href="#/timeline">Timeline ↗</a> ')}
        <div class="arcs">${arcItems}${curBlock}</div>
      </section>` : ''}

      <section class="wrap block">
        ${sectionHead('CHARACTERS', 4)}
        ${ORDER.map((c, i) => charRow(c, i)).join('')}
      </section>
    </main>
    ${footer()}`;
  }

  function charRow(c, i) {
    return `<a class="crow" href="#/c/${c}">
      <span class="crow-line" style="background:${CHARS[c].color}"></span>
      <span class="crow-name">${c}<sup>${pad(i + 1)}</sup></span>
      <span class="crow-full"><span>${CHARS[c].full}</span><span aria-hidden="true">↗</span></span>
    </a>`;
  }

  function viewMain(arcName) {
    if (!LIB.arcs.length) return shell(pageTitle('Main line', 'The chapters that form the main thread.') + emptyState('No main line files yet. Files whose name contains 主线 are split into chapters automatically.'));
    const open = arcName || (LIB.arcs[LIB.arcs.length - 1] || {}).name;
    const body = LIB.arcs.map((a) => {
      const ov = overviewFor(a.name);
      return `<details class="arc" ${a.name === open ? 'open' : ''} id="arc-${enc(a.name)}">
        <summary><span class="arc-title">${esc(a.name)}<sup>${a.range ? a.range.join('–') : ''}</sup></span><span class="arc-count">${a.chapters.length}</span></summary>
        ${ov ? `<a class="arc-ov" href="#/doc/${enc(ov.id)}">Overview ↗</a>` : ''}
        <div class="rows">${a.chapters.map((c) => rowHTML(c)).join('')}</div>
      </details>`;
    }).join('');
    return shell(pageTitle('Main line', 'The chapters that form the main thread.') + `<div class="arcs-list">${body}</div>`);
  }

  function shell(inner) {
    return `${topbar()}<main class="wrap page">${inner}</main>${footer()}`;
  }

  function filterBar(base, list, active) {
    const pairs = [];
    list.forEach((d) => { const p = pairLabel(d.chars); if (p && !pairs.includes(p)) pairs.push(p); });
    if (pairs.length < 2) return '';
    pairs.sort((a, b) => {
      const ka = a.split(' × ').map((n) => ORDER.indexOf(n)).join(','), kb = b.split(' × ').map((n) => ORDER.indexOf(n)).join(',');
      return ka.localeCompare(kb);
    });
    return `<div class="filters" role="tablist">
      <a href="${base}" class="${!active ? 'on' : ''}">All</a>
      ${pairs.map((p) => `<a href="${base}?f=${enc(p)}" class="${active === p ? 'on' : ''}">${dashes(p.split(' × '), 'dashes sm')}${esc(p)}</a>`).join('')}
    </div>`;
  }

  function viewList(type, params) {
    const conf = {
      dialogue: { title: 'Dialogues', lede: 'One-to-one conversations, kept in their own words.', base: '#/dialogues', types: ['dialogue'] },
      side: { title: 'Side lines', lede: 'Other moments, possibilities and paths.', base: '#/side', types: ['side'] },
      message: { title: 'Messages', lede: 'Texts sent between them.', base: '#/messages', types: ['message'] },
      study: { title: 'Studies', lede: 'Overviews, terms, handover notes and readings of the source.', base: '#/studies', types: ['study', 'other'] },
    }[type];
    const all = docsOf(conf.types);
    const f = params.get('f');
    const list = f ? all.filter((d) => pairLabel(d.chars) === f) : all;
    const rows = list.length ? `<div class="rows">${list.map((d) => rowHTML(d, { showType: type === 'study' && d.type === 'other' })).join('')}</div>` : emptyState('Nothing here yet.');
    return shell(pageTitle(conf.title, conf.lede) + filterBar(conf.base, all, f) + rows);
  }

  function readerActions(back, backLabel) {
    return `<div class="rbar"><a href="${back}">← ${esc(backLabel)}</a><span><button class="linkbtn" data-act="copy">Copy</button><button class="linkbtn" data-act="save-txt">Save .txt</button></span></div>`;
  }

  function relatedFor(ep, exceptId) {
    if (ep == null) return '';
    const rel = LIB.docs.filter((d) => d.ep === ep && d.id !== exceptId);
    const ch = LIB.chapters.find((c) => c.num === ep);
    const items = [];
    if (ch && ch.id !== exceptId) items.push(rowHTML(ch, { chapterTitle: true }));
    rel.forEach((d) => items.push(rowHTML(d, { showType: true })));
    return items.length ? `<section class="related">${sectionHead('AROUND 第' + ep + '篇', items.length)}<div class="rows">${items.join('')}</div></section>` : '';
  }

  let CURRENT_TEXT = { title: '', text: '' };

  function viewChapter(id) {
    const ch = LIB.byId.get(id);
    if (!ch) return viewMissing();
    store('lines:last', ch.id);
    const arc = LIB.arcs.find((a) => a.name === ch.arc);
    const pos = arc ? (arc.chapters.indexOf(ch) + 1) / arc.chapters.length : 0;
    const prev = LIB.chapters[ch.index - 1], next = LIB.chapters[ch.index + 1];
    CURRENT_TEXT = { title: ch.title + (ch.note ? ' ' + ch.note : ''), text: ch.text };
    return `${topbar()}<main class="wrap reader">
      ${readerActions('#/main/' + enc(ch.arc), 'Main line')}
      <div class="progress"><span style="width:${Math.round(pos * 100)}%;background:${CHARS.Leon.color}"></span><span style="width:${Math.round(pos * 100)}%;background:${CHARS.Zoi.color}"></span></div>
      <div class="rhead">
        <h1 class="bignum" aria-label="${esc(ch.title)}">(${ch.num})</h1>
        <div class="rmeta"><a href="#/main/${enc(ch.arc)}">${esc(ch.arc)}</a>${ch.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</div>
      </div>
      <article class="body">${formatBody(ch.text)}</article>
      ${relatedFor(ch.num, ch.id)}
      <nav class="pn">
        ${prev ? `<a href="#/ch/${enc(prev.id)}"><small>Previous</small><span>← ${prev.num}</span></a>` : '<span></span>'}
        ${next ? `<a class="r" href="#/ch/${enc(next.id)}"><small>Next</small><span>${next.num} →</span></a>` : '<span></span>'}
      </nav>
    </main>${footer()}`;
  }

  function backFor(d) {
    let href = TYPE_HOME[d.type] || '#/studies';
    if ((d.type === 'note' || d.type === 'profile') && d.chars[0] && CHARS[d.chars[0]]) href = '#/c/' + d.chars[0];
    if (d.type === 'note' || d.type === 'profile') return [href, d.chars[0] || 'Characters'];
    const label = { '#/dialogues': 'Dialogues', '#/side': 'Side lines', '#/messages': 'Messages', '#/studies': 'Studies', '#/c/Hudson': 'Hudson', '#/c/Leon': 'Leon', '#/c/Evan': 'Evan', '#/c/Zoi': 'Zoi' }[href] || 'Back';
    return [href, label];
  }

  function viewDoc(id) {
    const d = LIB.byId.get(id);
    if (!d || d.kind !== 'doc') return viewMissing();
    if (['dialogue', 'side', 'message'].includes(d.type)) store('lines:last', d.id);
    const [back, backLabel] = backFor(d);
    const siblings = LIB.docs.filter((x) => x.type === d.type);
    const i = siblings.indexOf(d);
    const prev = siblings[i - 1], next = siblings[i + 1];
    CURRENT_TEXT = { title: d.title, text: d.text };
    const img = imageByName(d.image);
    let body;
    if (d.type === 'message') body = formatMessages(d.text);
    else if (d.type === 'diary') body = `<div class="diary">${formatBody(d.text, { speakers: false })}</div>`;
    else body = formatBody(d.text, { generic: ['dialogue', 'side', 'save', 'note'].includes(d.type) });
    const ch = d.ep != null && LIB.chapters.find((c) => c.num === d.ep);
    return `${topbar()}<main class="wrap reader">
      ${readerActions(back, backLabel)}
      ${d.chars.length ? `<div class="progress">${d.chars.slice(0, 2).map((c) => `<span style="width:${Math.round(((i + 1) / siblings.length) * 100)}%;background:${charColor(c)}"></span>`).join('')}</div>` : ''}
      <div class="rhead">
        ${d.ep != null ? `<span class="bignum">(${d.ep})</span>` : `<span class="kicker">${TYPE_LABEL[d.type]}</span>`}
        <h1>${esc(d.title)}</h1>
        <div class="rmeta">${dashes(d.chars, 'dashes sm')}${esc([pairLabel(d.chars), d.ep != null ? TYPE_LABEL[d.type] : '', d.date].filter(Boolean).join(' · '))}${ch ? ` · <a href="#/ch/${enc(ch.id)}">Read 第${ch.num}篇 ↗</a>` : ''}</div>
      </div>
      ${img ? `<figure class="doc-img"><img src="${img.url}" alt=""></figure>` : ''}
      <article class="body">${body}</article>
      ${relatedFor(d.ep, d.id)}
      <nav class="pn">
        ${prev ? `<a href="#/doc/${enc(prev.id)}"><small>Previous</small><span>← ${esc(prev.title)}</span></a>` : '<span></span>'}
        ${next ? `<a class="r" href="#/doc/${enc(next.id)}"><small>Next</small><span>${esc(next.title)} →</span></a>` : '<span></span>'}
      </nav>
    </main>${footer()}`;
  }

  function viewMissing() {
    return shell(pageTitle('Not found', 'This page may have been removed in the last import.') + '<p><a href="#/">Back to the start →</a></p>');
  }

  function viewCharacters() {
    return shell(pageTitle('Characters', 'Four people, their own lines.') + ORDER.map((c, i) => charRow(c, i)).join(''));
  }

  function objectSection(c) {
    if (c === 'Leon') {
      const items = docsOf('item').filter((d) => d.chars.includes('Leon'));
      const cards = items.map((d) => {
        const img = imageByName(d.image);
        return `<a class="item" href="#/doc/${enc(d.id)}"><span class="item-img">${img ? `<img src="${img.url}" alt="">` : ringSVG(40, 'currentColor', 5)}</span><span class="item-name">${esc(d.title)}</span>${d.ep != null ? `<span class="item-ep">第${d.ep}篇</span>` : ''}</a>`;
      }).join('');
      return `<section class="block">${sectionHead('PERSONAL ITEMS', items.length)}<p class="note-line">The things he kept.</p>
        ${items.length ? `<div class="items">${cards}</div>` : `<div class="items">${[0, 1, 2].map(() => `<span class="item ph-item"><span class="item-img">${lineArt(ART[3])}</span><span class="item-name">[an object he keeps]</span></span>`).join('')}</div>`}</section>`;
    }
    if (c === 'Zoi') {
      const imgs = LIB.images.filter((i) => i.sketch && !i.cover);
      const docs = docsOf('sketch');
      const grid = imgs.map((im) => `<button class="sk" data-act="lightbox" data-src="${im.url}" aria-label="Open ${esc(im.name)}"><img src="${im.url}" alt="" loading="lazy"></button>`).join('');
      return `<section class="block">${sectionHead('SKETCHBOOK', imgs.length + docs.length)}
        ${imgs.length ? `<div class="sketches">${grid}</div>` : `<div class="sketches">${[0, 1, 2, 3].map((k) => `<span class="sk ph-sk">${lineArt(ART[k])}<span class="ph">[your line drawing]</span></span>`).join('')}</div>`}
        ${docs.length ? `<div class="rows">${docs.map((d) => rowHTML(d)).join('')}</div>` : ''}</section>`;
    }
    if (c === 'Evan') {
      const saves = docsOf('save').filter((d) => d.chars.includes('Evan'));
      const slots = saves.map((d, k) => `<a class="slot" href="#/doc/${enc(d.id)}"><span class="slot-top"><b>SAVE ${pad(k + 1)}</b><span>${d.ep != null ? '第' + d.ep + '篇' : ''}</span></span><span class="slot-title">${esc(d.title)}</span><span class="slot-ex">${esc(excerpt(d.text, 60))}</span></a>`).join('');
      const empties = [0, 1, 2].slice(0, Math.max(0, 3 - saves.length)).map((k) => `<span class="slot empty-slot"><span class="slot-top"><b>SAVE ${pad(saves.length + k + 1)}</b></span><span class="slot-title">— EMPTY —</span></span>`).join('');
      return `<section class="block">${sectionHead('SAVE FILES', saves.length)}
        <div class="saves"><div class="saves-head"><span>LOAD GAME</span><span>Lines · Evan J. Mercer</span></div><div class="slots">${slots}${empties}</div></div>
        <p class="note-line"><a href="#/messages?f=${enc('Zoi × Evan')}">Messages with Zoi →</a></p></section>`;
    }
    const entries = docsOf('diary').filter((d) => d.chars.includes('Hudson'));
    return `<section class="block">${sectionHead('DIARY', entries.length)}
      ${entries.length ? `<div class="diary-list">${entries.map((d) => `<a class="dentry" href="#/doc/${enc(d.id)}"><span class="dentry-top">${d.ep != null ? '第' + d.ep + '篇' : ''}${d.date ? ' · ' + esc(d.date) : ''}</span><span class="dentry-title">${esc(d.title)}</span><span class="dentry-ex">${esc(excerpt(d.text, 90))}</span></a>`).join('')}</div>`
        : `<div class="diary-list"><span class="dentry ph-entry"><span class="dentry-title">[the first page of his diary]</span></span></div>`}</section>`;
  }

  function viewCharacter(c) {
    if (!CHARS[c]) return viewMissing();
    const info = CHARS[c];
    const cover = coverFor(c);
    const notes = docsOf('note').filter((d) => d.chars.includes(c));
    const profiles = docsOf('profile').filter((d) => d.chars.includes(c));
    const appears = LIB.docs.filter((d) => ['dialogue', 'message', 'side'].includes(d.type) && d.chars.includes(c));
    return `${topbar()}<main class="wrap page">
      <div class="chero">
        <span class="crow-line" style="background:${info.color}"></span>
        <h1 class="cname">${c}<sup>${pad(ORDER.indexOf(c) + 1)}</sup></h1>
        <p class="lede">${info.full}</p>
        ${cover ? `<figure class="ccover"><img src="${cover.url}" alt=""></figure>` : ''}
      </div>
      ${objectSection(c)}
      ${notes.length ? `<section class="block">${sectionHead('NOTES', notes.length)}<div class="rows">${notes.map((d) => rowHTML(d)).join('')}</div></section>` : ''}
      ${profiles.length ? `<section class="block">${sectionHead('PROFILE', profiles.length)}${profiles.map((d) => `<details class="profile"><summary>${esc(d.title)}</summary><div class="body">${formatBody(d.text, { speakers: false })}</div></details>`).join('')}</section>` : ''}
      ${appears.length ? `<section class="block">${sectionHead('APPEARS IN', appears.length)}<div class="rows">${appears.slice(-12).reverse().map((d) => rowHTML(d, { showType: true })).join('')}</div></section>` : ''}
      <nav class="pn">${ORDER.filter((x) => x !== c).map((x) => `<a href="#/c/${x}"><small>Character</small><span>${dashes([x], 'dashes sm')}${x}</span></a>`).join('')}</nav>
    </main>${footer()}`;
  }

  function viewGallery(params) {
    const f = params.get('f');
    const imgs = LIB.images.filter((i) => !i.cover && (!f || i.chars.includes(f)));
    const filters = `<div class="filters"><a href="#/gallery" class="${!f ? 'on' : ''}">All</a>${ORDER.map((c) => `<a href="#/gallery?f=${c}" class="${f === c ? 'on' : ''}">${dashes([c], 'dashes sm')}${c}</a>`).join('')}</div>`;
    const grid = imgs.length
      ? `<div class="gallery">${imgs.map((im) => `<button class="gimg" data-act="lightbox" data-src="${im.url}" aria-label="Open ${esc(im.name)}"><img src="${im.url}" alt="" loading="lazy"><span>${esc(stripExt(im.name))}</span></button>`).join('')}</div>`
      : emptyState('No images yet. Put images in your Lines folder; a folder or file name with a character’s name files it under that character.');
    return shell(pageTitle('Gallery', 'Portraits, sketches and photographs.') + filters + grid);
  }

  function viewTimeline() {
    const groups = new Map();
    LIB.chapters.forEach((c) => { if (!groups.has(c.num)) groups.set(c.num, []); groups.get(c.num).push(c); });
    LIB.docs.forEach((d) => { if (d.ep != null) { if (!groups.has(d.ep)) groups.set(d.ep, []); groups.get(d.ep).push(d); } });
    const nums = [...groups.keys()].sort((a, b) => b - a);
    if (!nums.length) return shell(pageTitle('Timeline', 'Everything, by chapter number.') + emptyState('Nothing has a chapter number yet.'));
    const arcOf = (n) => (LIB.arcs.find((a) => a.range && n >= a.range[0] && n <= a.range[1]) || {}).name || '';
    const body = nums.map((n) => {
      const items = groups.get(n);
      return `<section class="tl" id="tl-${n}"><div class="tl-head"><span class="tl-num">${n}</span><span class="tl-arc">${esc(arcOf(n))}</span></div>
        <div class="rows">${items.map((it) => it.kind === 'chapter' ? rowHTML(it, { noNum: true }) : rowHTML(it, { showType: true, noNum: true })).join('')}</div></section>`;
    }).join('');
    return shell(pageTitle('Timeline', 'Everything, by chapter number. The world at each point in the story.') +
      `<form class="jump" data-act="jump"><label for="jump-n">Go to 第</label><input id="jump-n" type="number" inputmode="numeric" min="1" placeholder="${nums[0]}"><label for="jump-n">篇</label><button class="btn sm" type="submit">Go</button></form>` + body);
  }

  async function viewLibrary() {
    const recs = LIB.records;
    let persisted = false;
    try { persisted = navigator.storage && navigator.storage.persisted ? await navigator.storage.persisted() : false; } catch (e) { /* ignore */ }
    const texts = recs.filter((r) => r.kind === 'text').length;
    const imgs = recs.length - texts;
    const files = [...recs].sort((a, b) => (a.folder + a.name).localeCompare(b.folder + b.name, 'zh'))
      .map((r) => `<li><span>${esc(r.folder ? r.folder + '/' : '')}<b>${esc(r.name)}</b></span><button class="linkbtn" data-act="del" data-key="${esc(r.key)}" aria-label="Remove ${esc(r.name)}">Remove</button></li>`).join('');
    return shell(pageTitle('Library', 'Import and export. Everything stays on this device.') + `
      <div class="lib-stats">
        <div><b>${LIB.chapters.length}</b><span>chapters</span></div>
        <div><b>${LIB.docs.length}</b><span>other texts</span></div>
        <div><b>${imgs}</b><span>images</span></div>
        <div><b>${texts}</b><span>text files</span></div>
      </div>
      <div class="lib-actions">
        <button class="btn" data-act="import">Import · add or update</button>
        <button class="btn ghost" data-act="import-replace">Import · replace everything</button>
        <button class="btn ghost" data-act="export">Export all as .zip</button>
      </div>
      <p class="small">${persisted ? 'Storage is marked as persistent on this device.' : 'Tip: add Lines to your Home Screen so the browser keeps this library safely. Your Lines folder in Files stays the original either way.'}</p>

      <section class="block">${sectionHead('COLORS', null)}
        <p class="note-line">Each person’s color is used for their name on the home page, their lines and their dashes. Tap a swatch to change it.</p>
        <div class="colors">${ORDER.map((c) => `<div class="color-row">
          <label class="swatch" style="background:${CHARS[c].color}"><input type="color" value="${CHARS[c].color}" data-color="${c}" aria-label="${c}’s color"></label>
          <span class="color-name">${c}</span><span class="color-hex">${CHARS[c].color.toUpperCase()}</span>
          ${CHARS[c].color.toLowerCase() !== DEFAULT_COLORS[c].toLowerCase() ? `<button class="linkbtn" data-act="color-reset" data-c="${c}">Reset</button>` : ''}
        </div>`).join('')}</div>
      </section>

      <section class="block">${sectionHead('FILE FORMAT', null)}
        <p class="note-line">Main line files need no changes: lines like 第93篇 split them into chapters, and the file name gives the arc (e.g. 〈主线〉Leon x Zoi｜93-114｜洛杉矶｜上海篇.txt). Every other file can start with a short header:</p>
        <pre class="code">类型：1v1
人物：Zoi × Evan
篇号：163
标题：仙本那早餐
---
正文……</pre>
        <p class="note-line">类型 can be 1v1, 支线, 短信, 日记, 物品, 存档, 留言, 档案, 插画 or 概览 / 研究. Optional lines: 日期, 图片 (an image file name). Images in a folder named 插画 or 速写 go to Zoi’s sketchbook; images in a folder named 封面 named after a section (main, dialogues, side, messages, studies, gallery) or a character (Leon, Zoi, Evan, Hudson) become covers. Files with the same name replace each other.</p>
      </section>

      <section class="block">${sectionHead('FILES', recs.length)}
        ${recs.length ? `<ul class="files">${files}</ul><button class="btn danger" data-act="clear">Remove everything from this device</button>` : '<p class="note-line">No files yet.</p>'}
      </section>`);
  }

  // ---------- Overlays ----------

  function openOverlay(html, cls) {
    $overlay.className = 'overlay ' + (cls || '');
    $overlay.innerHTML = html;
    $overlay.hidden = false;
    document.body.classList.add('locked');
  }
  function closeOverlay() {
    $overlay.hidden = true;
    $overlay.innerHTML = '';
    document.body.classList.remove('locked');
  }

  function openMenu() {
    const links = [
      ...SECTIONS.map((s) => [s.href, s.name]),
      ['#/characters', 'Characters'],
      ['#/timeline', 'Timeline'],
    ];
    openOverlay(`<div class="top"><a class="logo" href="#/" data-act="close-nav">${ringSVG(26)}<span>Lines</span></a><button class="menubtn" data-act="close">CLOSE ×</button></div>
      <nav class="menu-list">${links.map(([h, n], i) => `<a href="${h}" data-act="close-nav">${n}<sup>${pad(i + 1)}</sup></a>`).join('')}</nav>
      <div class="menu-chars">${ORDER.map((c) => `<a href="#/c/${c}" data-act="close-nav">${dashes([c], 'dashes sm')}${c}</a>`).join('')}</div>
      <div class="menu-foot"><a href="#/library" data-act="close-nav">Library · import &amp; export</a></div>`, 'menu');
  }

  function openSearch() {
    openOverlay(`<div class="top"><span class="logo">${ringSVG(26)}<span>Search</span></span><button class="menubtn" data-act="close">CLOSE ×</button></div>
      <div class="search"><input id="q" type="search" placeholder="篇号, a name, a line…" autocomplete="off" aria-label="Search the library"><div id="results" class="rows"></div></div>`, 'search-ov');
    const q = document.getElementById('q');
    let timer;
    q.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => runSearch(q.value), 150); });
    setTimeout(() => q.focus(), 50);
  }

  function runSearch(raw) {
    const out = document.getElementById('results');
    const q = raw.trim();
    if (!q) { out.innerHTML = ''; return; }
    const low = q.toLowerCase();
    const n = /^\d{1,4}$/.test(q) ? parseInt(q, 10) : null;
    const hits = [];
    const consider = (item, hay) => {
      if (n != null && (item.num === n || item.ep === n)) { hits.push({ item, snip: '' }); return; }
      const i = hay.toLowerCase().indexOf(low);
      if (i >= 0) hits.push({ item, snip: hay.slice(Math.max(0, i - 24), i + q.length + 40).replace(/\s+/g, ' ') });
    };
    LIB.chapters.forEach((c) => consider(c, c.title + ' ' + c.note + '\n' + c.text));
    LIB.docs.forEach((d) => consider(d, d.title + ' ' + pairLabel(d.chars) + '\n' + d.text));
    out.innerHTML = hits.slice(0, 60).map(({ item, snip }) => {
      const href = item.kind === 'chapter' ? '#/ch/' + enc(item.id) : '#/doc/' + enc(item.id);
      const num = item.kind === 'chapter' ? pad(item.num, 3) : item.ep != null ? pad(item.ep, 3) : '—';
      let s = esc(snip);
      if (snip) { const k = snip.toLowerCase().indexOf(low); if (k >= 0) s = esc(snip.slice(0, k)) + '<mark>' + esc(snip.slice(k, k + q.length)) + '</mark>' + esc(snip.slice(k + q.length)); }
      return `<a class="row" href="${href}" data-act="close-nav"><span class="row-num">${num}</span><span class="row-main"><span class="row-title">${esc(item.title)}</span><span class="row-meta">${item.kind === 'chapter' ? esc(item.arc) : TYPE_LABEL[item.type]}${s ? ' · …' + s + '…' : ''}</span></span></a>`;
    }).join('') || '<p class="note-line">No results.</p>';
  }

  // ---------- Router ----------

  async function route() {
    const hash = location.hash.slice(1) || '/';
    const [path, query] = hash.split('?');
    const parts = path.split('/').filter(Boolean).map(decodeURIComponent);
    const params = new URLSearchParams(query || '');
    let html;
    switch (parts[0]) {
      case undefined: html = viewHome(); break;
      case 'main': html = viewMain(parts[1]); break;
      case 'ch': html = viewChapter(parts[1]); break;
      case 'doc': html = viewDoc(parts[1]); break;
      case 'dialogues': html = viewList('dialogue', params); break;
      case 'side': html = viewList('side', params); break;
      case 'messages': html = viewList('message', params); break;
      case 'studies': html = viewList('study', params); break;
      case 'characters': html = viewCharacters(); break;
      case 'c': html = viewCharacter(parts[1]); break;
      case 'gallery': html = viewGallery(params); break;
      case 'timeline': html = viewTimeline(); break;
      case 'library': html = await viewLibrary(); break;
      default: html = viewMissing();
    }
    $app.innerHTML = html;
    if (parts[0] === 'main' && parts[1]) {
      const el = document.getElementById('arc-' + enc(parts[1]));
      if (el) { el.scrollIntoView(); return; }
    }
    window.scrollTo(0, 0);
  }

  // ---------- Events ----------

  document.addEventListener('click', async (e) => {
    const el = e.target.closest('[data-act]');
    if (!el || el.tagName === 'FORM') return;
    const act = el.dataset.act;
    switch (act) {
      case 'menu': openMenu(); break;
      case 'search': openSearch(); break;
      case 'close': closeOverlay(); break;
      case 'close-nav': closeOverlay(); break;
      case 'import': $file.dataset.mode = 'add'; $file.click(); break;
      case 'import-replace': $file.dataset.mode = 'replace'; $file.click(); break;
      case 'export': exportAll(); break;
      case 'copy':
        try { await navigator.clipboard.writeText(CURRENT_TEXT.title + '\n\n' + CURRENT_TEXT.text); toast('Copied.'); } catch (err) { toast('Copy is not available here.'); }
        break;
      case 'save-txt': {
        const name = CURRENT_TEXT.title.replace(/[\\/:*?"<>|]/g, '').slice(0, 60) || 'Lines';
        await saveBlob(new Blob([CURRENT_TEXT.title + '\n\n' + CURRENT_TEXT.text], { type: 'text/plain;charset=utf-8' }), name + '.txt');
        break;
      }
      case 'lightbox':
        openOverlay(`<button class="lb-close menubtn" data-act="close">CLOSE ×</button><img class="lb-img" src="${el.dataset.src}" alt="">`, 'lightbox');
        break;
      case 'del':
        await deleteRecord(el.dataset.key);
        await loadLibrary(); route(); toast('Removed.');
        break;
      case 'clear':
        el.dataset.act = 'clear-confirm';
        el.textContent = 'Tap again to remove everything';
        setTimeout(() => { if (el.isConnected) { el.dataset.act = 'clear'; el.textContent = 'Remove everything from this device'; } }, 4000);
        break;
      case 'color-reset':
        setColor(el.dataset.c, DEFAULT_COLORS[el.dataset.c]);
        break;
      case 'clear-confirm':
        await clearRecords(); await loadLibrary(); route(); toast('The library on this device is empty.');
        break;
    }
  });

  function setColor(c, value) {
    if (!CHARS[c] || !/^#[0-9a-f]{6}$/i.test(value)) return;
    CHARS[c].color = value;
    store('lines:color:' + c, value);
    const y = window.scrollY;
    route().then(() => window.scrollTo(0, y));
  }

  document.addEventListener('change', (e) => {
    const input = e.target.closest('input[data-color]');
    if (input) setColor(input.dataset.color, input.value);
  });

  document.addEventListener('input', (e) => {
    const input = e.target.closest('input[data-color]');
    if (input) input.parentElement.style.background = input.value;
  });

  document.addEventListener('submit', (e) => {
    const form = e.target.closest('[data-act="jump"]');
    if (!form) return;
    e.preventDefault();
    const n = form.querySelector('input').value;
    const el = document.getElementById('tl-' + n);
    if (el) el.scrollIntoView({ behavior: 'smooth' }); else toast('Nothing at 第' + n + '篇.');
  });

  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$overlay.hidden) closeOverlay(); });

  $file.addEventListener('change', async () => {
    const files = [...$file.files];
    const replace = $file.dataset.mode === 'replace';
    $file.value = '';
    if (files.length) await importFiles(files, replace);
  });

  window.addEventListener('hashchange', () => { if (!$overlay.hidden) closeOverlay(); route(); });

  // ---------- Start ----------

  (async () => {
    try { if (navigator.storage && navigator.storage.persist) await navigator.storage.persist(); } catch (e) { /* ignore */ }
    try { await loadLibrary(); } catch (e) { toast('Could not open storage: ' + e.message, 6000); }
    route();
    if ('serviceWorker' in navigator && location.protocol === 'https:') {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  })();
})();
