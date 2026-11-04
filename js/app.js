/* Lines — a private library for Leon × Zoi.
   Everything the reader imports stays in this browser (IndexedDB). Nothing is uploaded. */
(() => {
  'use strict';

  // ---------- Fixed data ----------

  const CHARS = {
    Leon:   { full: 'Leon S. Kennedy',  color: '#6E7279', object: 'Personal items', objectZh: '个人物品', alias: ['leon', '里昂', '莱昂'] },
    Zoi:    { full: 'Zoi Z',            color: '#1E3BB0', object: 'Sketchbook',     objectZh: '速写本',   alias: ['zoi', '雪儿'] },
    Evan:   { full: 'Evan J. Mercer',   color: '#5E6B33', object: 'Save files',     objectZh: '存档',     alias: ['evan', '埃文'] },
    Hudson: { full: 'Hudson M. Foster', color: '#7B2236', object: 'Diary',          objectZh: '日记',     alias: ['hudson', '哈德森'] },
  };
  const APP_VERSION = '2026-11-05 · 26';
  const ORDER = ['Leon', 'Zoi', 'Evan', 'Hudson'];
  const DEFAULT_COLORS = Object.fromEntries(ORDER.map((c) => [c, CHARS[c].color]));
  // The two home-page accents: the round dot on Main line and the solid Studies block.
  const ACCENT = { circle: '#C9A45C', block: '#1E3BB0' };
  const DEFAULT_ACCENT = { ...ACCENT };
  const SLOTS = [...ORDER, 'circle', 'block'];
  const SLOT_LABEL = { circle: 'Circle', block: 'Block' };
  // Each preset keeps its colors at a similar strength, so no one reads as an accident.
  const PRESETS = [
    { name: 'Classic',         colors: { Leon: '#2D4E9C', Zoi: '#D0432E', Evan: '#B98516', Hudson: '#2F7D63', circle: '#D0432E', block: '#2D4E9C' } },
    { name: 'Klein',           colors: { Leon: '#2B2B2E', Zoi: '#1E3BB0', Evan: '#5E6B33', Hudson: '#7B2236', circle: '#C9A45C', block: '#1E3BB0' } },
    { name: 'Klein · grey',    colors: { Leon: '#6E7279', Zoi: '#1E3BB0', Evan: '#5E6B33', Hudson: '#7B2236', circle: '#C9A45C', block: '#1E3BB0' } },
    { name: 'Ink & vermilion', colors: { Leon: '#1F2A44', Zoi: '#E0482F', Evan: '#A7792A', Hudson: '#4F7A6A', circle: '#E0482F', block: '#1F2A44' } },
    { name: 'Klein & coral',   colors: { Leon: '#2440B8', Zoi: '#E0573F', Evan: '#C9962E', Hudson: '#2E8A7A', circle: '#E0573F', block: '#2440B8' } },
    { name: 'Dusk',            colors: { Leon: '#3A4E7A', Zoi: '#C4546A', Evan: '#B07A3A', Hudson: '#4E8073', circle: '#C4546A', block: '#3A4E7A' } },
  ];
  const HEX_RE = /^#?[0-9a-f]{6}$/i;
  ORDER.forEach((c) => {
    const v = store('lines:color:' + c);
    if (v && HEX_RE.test(v)) CHARS[c].color = v;
  });
  Object.keys(ACCENT).forEach((k) => {
    const v = store('lines:accent:' + k);
    if (v && HEX_RE.test(v)) ACCENT[k] = v;
  });
  function applyAccents() {
    document.documentElement.style.setProperty('--accent-circle', ACCENT.circle);
    document.documentElement.style.setProperty('--accent-block', ACCENT.block);
  }
  applyAccents();

  // Menu order. Its numbers are reused on the home tiles, so a number always means the same place.
  const NAV = [
    { key: 'main',       href: '#/main',       name: 'Main line',  desc: 'The chapters that form the main thread.' },
    { key: 'dialogues',  href: '#/dialogues',  name: 'Dialogues',  desc: 'One-to-one conversations, kept in their own words.' },
    { key: 'messages',   href: '#/messages',   name: 'Messages',   desc: 'Zoi’s phone: the texts between them.' },
    { key: 'characters', href: '#/characters', name: 'Characters', desc: 'Four people, their own lines.' },
    { key: 'timeline',   href: '#/timeline',   name: 'Timeline',   desc: 'Everything, by chapter number.' },
    { key: 'gallery',    href: '#/gallery',    name: 'Gallery',    desc: 'Portraits, sketches and photographs.' },
    { key: 'studies',    href: '#/studies',    name: 'Studies',    desc: 'Overviews, terms and readings of the source.' },
    { key: 'side',       href: '#/side',       name: 'Side lines', desc: 'Other moments, possibilities and paths.' },
  ].map((s, i) => ({ ...s, n: String(i + 1).padStart(2, '0') }));
  // Characters and Timeline have their own sections on the home page, so the tiles leave them out.
  const SECTIONS = NAV.filter((s) => !['characters', 'timeline'].includes(s.key));

  const TILE_LAYOUT = [
    { basis: 420, ar: '4 / 5', mt: 40 },
    { basis: 220, ar: '1 / 1', mt: 180 },
    { basis: 320, ar: '3 / 4', mt: 80 },
    { basis: 280, ar: '4 / 5', mt: 40,  ml: '10%' },
    { basis: 220, ar: '1 / 1', mt: 220 },
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
  const HEAD_RE = /^第(\d{1,4})篇([^，,。：:｜|、；;\s][^\n]{0,119}|\s+[^\n]{1,120})?$/;
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
    // Version 2 added a 'masks' store for a photo style that has since been removed; it stays empty.
    const r = indexedDB.open('lines', 2);
    r.onupgradeneeded = () => {
      const db = r.result;
      if (!db.objectStoreNames.contains('files')) db.createObjectStore('files', { keyPath: 'key' });
      if (!db.objectStoreNames.contains('masks')) db.createObjectStore('masks', { keyPath: 'key' });
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });

  function idb(mode, op, storeName = 'files') {
    return dbp.then((db) => new Promise((resolve, reject) => {
      const t = db.transaction(storeName, mode);
      const req = op(t.objectStore(storeName));
      t.oncomplete = () => resolve(req && 'result' in req ? req.result : undefined);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error || new Error('Storage was interrupted.'));
    }));
  }
  const getAllRecords = () => idb('readonly', (s) => s.getAll());
  const putRecords = (recs) => idb('readwrite', (s) => { recs.forEach((r) => s.put(r)); });
  const deleteRecord = (key) => idb('readwrite', (s) => s.delete(key));
  const clearRecords = () => idb('readwrite', (s) => s.clear());

  // Things the reader sets inside the app (pinned messages, contact names) live in one small file,
  // so Export carries them to Files with everything else and Import brings them back.
  const SETTINGS_KEY = 'lines-settings.json';
  const blankSettings = () => ({ pins: {}, contacts: {}, group: { name: '', nick: {} } });
  let SETTINGS = blankSettings();
  function readSettings(text) {
    try {
      const v = JSON.parse(text) || {};
      SETTINGS = { pins: v.pins || {}, contacts: v.contacts || {}, group: { name: (v.group && v.group.name) || '', nick: (v.group && v.group.nick) || {} } };
    } catch (e) { SETTINGS = blankSettings(); }
  }
  const saveSettings = () => putRecords([{ key: SETTINGS_KEY, name: SETTINGS_KEY, folder: '', kind: 'settings', text: JSON.stringify(SETTINGS, null, 2), added: Date.now() }]);

  // ---------- Import / export ----------

  function makeRecord(path, data) {
    path = path.replace(/\\/g, '/').replace(/^\/+/, '');
    if (path.includes('__MACOSX/')) return null;
    const name = basename(path);
    if (!name || name.startsWith('.')) return null;
    const folder = path.slice(0, path.length - name.length).replace(/\/$/, '');
    const ext = (name.split('.').pop() || '').toLowerCase();
    if (name === SETTINGS_KEY) return { key: name, name, folder: '', kind: 'settings', text: decodeText(data), added: Date.now() };
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
      data: r.kind === 'image' ? new Uint8Array(r.buf) : te.encode(r.text),
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

  const PART_RE = /^[（(]\s*([一二三四五六七八九十]+|\d{1,2})\s*[)）]\s*/;
  const CN_DIGITS = '一二三四五六七八九';
  function cnNum(s) {
    if (/^\d+$/.test(s)) return +s;
    const d = (ch) => CN_DIGITS.indexOf(ch) + 1;
    if (s === '十') return 10;
    if (s.length === 1) return d(s);
    if (s[0] === '十') return 10 + d(s[1]);
    if (s.length === 2 && s[1] === '十') return d(s[0]) * 10;
    if (s.length === 3) return d(s[0]) * 10 + d(s[2]);
    return null;
  }
  function cnLabel(n) {
    if (n >= 1 && n <= 9) return CN_DIGITS[n - 1];
    if (n === 10) return '十';
    if (n > 10 && n < 20) return '十' + CN_DIGITS[n - 11];
    return String(n);
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

    const parts = /^【标题】\s*$/m.test(body) ? splitStructured(body, arc) : splitPlain(body);
    if (!parts.length && meta && meta['篇号']) {
      parts.push({ num: epFrom(meta['篇号']), note: meta['标题'] || '', lines: body.split('\n'), sections: {} });
    }
    for (const p of parts) {
      let note = p.note.replace(/^[｜|\s]+/, '');
      let part = null;
      const pm = note.match(PART_RE);
      const partMarked = !!pm;
      if (pm) { part = cnNum(pm[1]); note = note.slice(pm[0].length).replace(/^[｜|\s]+/, ''); }
      // With ｜ in the heading, split only there; otherwise split on spaces but keep English phrases together.
      let tags = /[｜|]/.test(note)
        ? note.split(/\s*[｜|]\s*/).map((t) => t.trim()).filter(Boolean)
        : joinTime(joinLatin(note.split(/\s+/).filter(Boolean)));
      const isKey = (t) => /^重点篇?$/.test(t);
      const key = tags.some(isKey);
      tags = tags.filter((t) => !isKey(t));
      const ch = {
        kind: 'chapter', num: p.num, part, partMarked, note, tags, key,
        arc: arcName, text: p.lines.join('\n').trim(), path: rec.name,
        recKey: rec.key, headLine: p.headLine || '', structured: !!p.structured,
        sections: p.sections || {}, summary: (p.sections && p.sections['检索摘要']) || '',
      };
      arc.chapters.push(ch);
      chapters.push(ch);
    }
  }

  // "Someone in the Crowd" or "Vivienne Westwood项链" stay one tag; "Crowd Evan视角" splits before the name.
  function joinLatin(tokens) {
    const out = [];
    for (const t of tokens) {
      const prev = out[out.length - 1];
      if (prev && /[A-Za-z0-9.'&]$/.test(prev) && /^[A-Za-z]/.test(t) && !/^(Leon|Zoi|Evan|Hudson)(?![A-Za-z])/.test(t)) {
        out[out.length - 1] = prev + ' ' + t;
      } else out.push(t);
    }
    return out;
  }

  // "温泉第一天 晚上" reads as one tag, matching "温泉篇第三天晚上" elsewhere.
  const TIME_WORDS = /^(凌晨|清晨|早晨|早上|上午|中午|午后|下午|傍晚|白天|晚上|夜晚|夜里|深夜|早午|晚)$/;
  function joinTime(tokens) {
    const out = [];
    for (const t of tokens) {
      const prev = out[out.length - 1];
      if (prev && TIME_WORDS.test(t) && /第[一二三四五六七八九十\d]+天$/.test(prev)) out[out.length - 1] = prev + t;
      else out.push(t);
    }
    return out;
  }

  // Older files: a line such as 第97篇 重点 Leon坦白 starts each chapter.
  function splitPlain(body) {
    const parts = [];
    let cur = null;
    for (const line of body.split('\n')) {
      const m = line.trim().match(HEAD_RE);
      if (m) { cur = { num: +m[1], note: (m[2] || '').trim(), lines: [], headLine: line.trim() }; parts.push(cur); continue; }
      if (cur) cur.lines.push(line);
    }
    return parts;
  }

  // Newer files: each chapter opens with 【标题】, then the heading line, then labelled
  // sections (【关系线】【检索摘要】【连续性更新】【前置关联】) and finally 【正文】.
  // Only the line after 【标题】 starts a chapter, so 篇号 quoted inside the notes stay notes.
  function splitStructured(body, arc) {
    const lines = body.split('\n');
    const parts = [];
    const intro = [];
    let cur = null;
    let section = null;
    for (let i = 0; i < lines.length; i++) {
      const t = lines[i].trim();
      if (t === '【标题】') {
        let j = i + 1;
        while (j < lines.length && !lines[j].trim()) j++;
        const m = (lines[j] || '').trim().match(/^第(\d{1,4})篇(.*)$/);
        if (m) {
          cur = { num: +m[1], note: m[2].trim(), lines: [], sections: {}, structured: true, headLine: lines[j].trim() };
          parts.push(cur);
          section = null;
          i = j;
          continue;
        }
      }
      if (!cur) { intro.push(lines[i]); continue; }
      const sm = t.match(/^【([^】]{1,12})】$/);
      if (sm && section !== '正文') { section = sm[1]; continue; }
      if (sm && sm[1] === '正文') { section = '正文'; continue; }
      if (section === '正文') cur.lines.push(lines[i]);
      else if (section) cur.sections[section] = ((cur.sections[section] || '') + '\n' + lines[i]).trim();
    }
    const introText = intro.join('\n').trim();
    if (introText && !arc.intro) arc.intro = introText;
    return parts;
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
    // 篇号 can carry a part, as in 160.2 for 第160篇（二）.
    let ep = null, part = null;
    const em = (meta['篇号'] && String(meta['篇号']).match(/(\d{1,4})(?:\s*[.．]\s*(\d{1,2}))?/)) ||
      base.match(/第(\d{1,4})篇/) || base.match(/(?:^|[｜|])(\d{1,4})(?:[.．](\d{1,2}))?(?:[｜|]|$)/);
    if (em) { ep = parseInt(em[1], 10); part = em[2] ? parseInt(em[2], 10) : null; }
    // Without a 标题 line, the file name gives the title once the type, 篇号 and names are taken out:
    // 1v1｜163｜Zoi×Evan｜早晨 仙本那早餐 → 早晨 仙本那早餐
    let title = meta['标题'];
    if (!title) {
      const segs = base.replace(/^<[^>]*>/, '').split(/[｜|]/).map((x) => x.trim()).filter(Boolean);
      const rest = segs.filter((x) =>
        !/^(1v1|支线|短信|日记|物品|物件|存档|留言|档案|插画|速写|概览|研究|Leon x Zoi)$/i.test(x) &&
        !/^第?\d{1,4}(?:[.．]\d{1,2})?篇?$/.test(x) &&
        !(detectChars(x).length && !x.replace(/Leon|Zoi|Evan|Hudson|里昂|[×xX&、\s]/gi, '')));
      title = rest.join('｜') || base;
    }
    return {
      kind: 'doc', id: type + ':' + rec.name, type, title, chars, ep, part, epLabel: ep == null ? '' : ep + (part ? '.' + part : ''), date: meta['日期'] || '',
      image: meta['图片'] || '', text: body.trim(), path: rec.name,
    };
  }

  function buildIndex(records) {
    LIB.images.forEach((im) => URL.revokeObjectURL(im.url));
    const arcs = new Map();
    const chapters = [], docs = [], images = [];
    SETTINGS = blankSettings();
    for (const r of records) {
      if (r.kind === 'settings') { readSettings(r.text); continue; }
      if (r.kind === 'image') {
        const info = parseImageName(r.folder, r.name);
        images.push({
          id: 'img:' + r.name, key: r.key, name: r.name, folder: r.folder,
          url: URL.createObjectURL(new Blob([r.buf], { type: r.mime })),
          kind: info.kind, ep: info.ep, part: info.part, links: info.links, caption: info.caption,
          chars: info.people, sketch: info.kind === 'art',
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

    // Who is in each chapter: 【人物】 in the file wins; otherwise count how often each name appears.
    // A person counts when named at least 6 times and at least 30% as often as the most-named person.
    arcList.forEach((a) => a.chapters.forEach((c) => {
      if (c.sections['人物']) { c.chars = parseChars(c.sections['人物']); return; }
      const n = {
        Leon: (c.text.match(/Leon|里昂|Kennedy/g) || []).length,
        Zoi: (c.text.match(/Zoi|雪儿/g) || []).length,
        Evan: (c.text.match(/Evan/g) || []).length,
        Hudson: (c.text.match(/Hudson|Hudbear/g) || []).length,
      };
      const top = Math.max(...Object.values(n));
      c.chars = ORDER.filter((k) => n[k] >= 6 && n[k] >= top * 0.3);
    }));

    const ordered = [];
    arcList.forEach((a) => a.chapters.forEach((c) => ordered.push(c)));
    // Same-day sections share one chapter number: 第142篇（一）（二）（三） become 142.1, 142.2, 142.3.
    const total = new Map();
    ordered.forEach((c) => total.set(c.num, (total.get(c.num) || 0) + 1));
    const seen = new Map();
    const ids = new Set();
    ordered.forEach((c, i) => {
      const k = seen.get(c.num) || 0;
      seen.set(c.num, k + 1);
      if (c.part == null && total.get(c.num) > 1) c.part = k + 1;
      c.label = c.num + (c.part ? '.' + c.part : '');
      let id = 'ch:' + c.label;
      while (ids.has(id)) id += '+';
      ids.add(id);
      c.id = id;
      c.index = i;
      c.title = '第' + c.num + '篇' + (c.part ? '（' + cnLabel(c.part) + '）' : '');
    });

    docs.sort((a, b) => (a.ep ?? 1e9) - (b.ep ?? 1e9) || (a.part || 0) - (b.part || 0) || a.title.localeCompare(b.title, 'zh'));
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

  const epName = (d) => (d.ep == null ? '' : '第' + d.ep + '篇' + (d.part ? '（' + cnLabel(d.part) + '）' : ''));
  const chapterFor = (d) => d.ep != null && (LIB.chapters.find((c) => c.num === d.ep && (d.part ? c.part === d.part : true)) || LIB.chapters.find((c) => c.num === d.ep));
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

  // Section pictures on the home page. Same language as the icon: dots, lines, rings,
  // ink on paper, with the block colour and the circle colour as the only accents.
  // Each viewBox is about the tile's width in pixels, so a 1.6 stroke reads as one fine line everywhere.
  const INK = 'var(--ink)', BLOCK = 'var(--accent-block, var(--blue))', GOLD = 'var(--accent-circle, var(--red))', HAIR = 'var(--hair)', PAPER = 'var(--paper)', PAPER2 = 'var(--paper-2)';
  const bubble = (x, y, w, h, tail) => {
    // A rounded bar with one sharp corner where the tail would be: 'bl' or 'br'.
    const r = h / 2, s = 5;
    const bl = tail === 'bl' ? s : r, br = tail === 'br' ? s : r;
    return `M${x + r} ${y} H${x + w - r} A${r} ${r} 0 0 1 ${x + w} ${y + r} V${y + h - br} A${br} ${br} 0 0 1 ${x + w - br} ${y + h} H${x + bl} A${bl} ${bl} 0 0 1 ${x} ${y + h - bl} V${y + r} A${r} ${r} 0 0 1 ${x + r} ${y} Z`;
  };
  // Character badges: a round badge with a fine black ring, a big plain head in the character's colour
  // and a half-length figure with one or two details from the story.
  let badgeSeq = 0;
  function badgeSVG(name) {
    const C = { Leon: CHARS.Leon.color, Zoi: CHARS.Zoi.color, Evan: CHARS.Evan.color, Hudson: CHARS.Hudson.color, gold: '#C9A45C' };
    const INK = 'var(--ink, #141414)', PAPER = 'var(--paper, #EEEBE3)', NAVY = '#1F2B47';
    const SH = 'M42 252 C 42 172, 76 142, 120 142 S 198 172, 198 252 Z'; // shoulders
    const uid = 'bd' + (++badgeSeq);
    const HX = 120, HY = 88, HR = 43;
    const headC = (fill) => `<circle cx="${HX}" cy="${HY}" r="${HR}" style="fill:${fill}"/>`;
    // The same crew neck for Leon and Hudson.
    const crew = (fill, line) => `<path d="M92 145 C 104 139, 136 139, 148 145 Q120 166 92 145 Z" style="fill:${PAPER};stroke:${PAPER}" stroke-width="3.4" stroke-linejoin="round"/>
        <path d="M92 145 Q120 166 148 145${line ? ' M86 149 Q120 175 154 149' : ''}" fill="none" style="stroke:${fill}" stroke-width="2.2" stroke-linecap="round"/>`;
    let back = '', body = '', head = '', front = '';

    if (name === 'Leon') {
      // Navy T-shirt with the split crew neck he wears in the main line.
      head = headC(C.gold);
      body = `<path d="${SH}" style="fill:${NAVY}"/>${crew(PAPER, true)}
        <path d="M113 162 L120 174 L127 162" fill="none" style="stroke:${PAPER}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>`;
    }

    if (name === 'Zoi') {
      // White blouse with a ruffled collar, wide black braces and the high waistband of the tiered skirt. She smiles a lot.
      head = headC(C.Zoi) + `<path d="M104 100 H136 A16 16 0 0 1 104 100 Z" style="fill:${PAPER};stroke:${INK}" stroke-width="2.2" stroke-linejoin="round"/>`;
      // The collar takes the blouse's own shoulder line as its top edge, so only the ruffled hem and the seam are drawn.
      const hemL = 'M60 150 Q66 158 72 163 A8 8 0 0 0 84 176 A8 8 0 0 0 100 181 A8 8 0 0 0 117 180';
      const hemR = 'M180 150 Q174 158 164 163 A8 8 0 0 1 152 176 A8 8 0 0 1 136 181 A8 8 0 0 1 117 180';
      body = `<path d="${SH}" style="fill:${PAPER}"/>
        <path d="M84 170 L80 252 H104 L106 174 Z M156 170 L160 252 H136 L134 174 Z" style="fill:${INK}"/>
        <rect x="38" y="218" width="164" height="40" style="fill:${INK}"/>
        <g clip-path="url(#${uid}s)">
          <path d="${hemL} Q113 162 118 130 H40 V150 Z ${hemR.replace('M180 150', 'M200 150 L180 150')} Q113 162 118 130 H200 Z" style="fill:${PAPER}"/>
          <path d="${hemL} M${hemR.slice(1)} M117 180 Q113 162 118 130" fill="none" style="stroke:${INK}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>
        </g>
        <path d="${SH}" fill="none" style="stroke:${INK}" stroke-width="2.4"/>`;
      // Her two Devon Rex cats peek in at the bottom corners: the cream one with brown points, and the black one.
      const cat = (x, y, fill, ear, eye, flip) => `<g transform="translate(${x} ${y}) rotate(${flip ? -10 : 10}) scale(${flip ? -1.45 : 1.45} 1.45)">
          <path d="M-17 4 C -19 -6, -20 -16, -18 -27 C -12 -21, -8 -16, -5 -13 C -2 -14, 2 -14, 5 -13 C 8 -16, 12 -21, 18 -27 C 20 -16, 19 -6, 17 4 C 16 14, 8 18, 0 18 C -8 18, -16 14, -17 4 Z" style="fill:${fill};stroke:${INK}" stroke-width="2"/>
          <path d="M-15 -8 C -15 -14, -16 -19, -16 -22 M15 -8 C 15 -14, 16 -19, 16 -22" fill="none" style="stroke:${ear}" stroke-width="3" stroke-linecap="round"/>
          <circle cx="-7" cy="0" r="4.4" style="fill:${eye};stroke:${INK}" stroke-width="1.4"/><circle cx="7" cy="0" r="4.4" style="fill:${eye};stroke:${INK}" stroke-width="1.4"/>
          <circle cx="-7" cy="0.5" r="1.6" style="fill:${INK}"/><circle cx="7" cy="0.5" r="1.6" style="fill:${INK}"/>
          <path d="M-1.6 7 L0 8.6 L1.6 7" fill="none" style="stroke:${INK}" stroke-width="1.4" stroke-linejoin="round"/>
        </g>`;
      front = cat(22, 132, '#E9D7B8', '#8A5A3C', '#BFD3D6', false) + cat(218, 132, '#1A1714', '#1A1714', '#C9D3A4', true);
    }

    if (name === 'Evan') {
      // Square nerd glasses, a navy hoodie under his green jacket, and a small friend of his own floating beside him.
      head = headC(C.Evan) + `<g fill="none" style="stroke:${INK}" stroke-width="2.8" stroke-linejoin="round">
          <rect x="91" y="84" width="24" height="17" rx="2"/><rect x="125" y="84" width="24" height="17" rx="2"/><path d="M115 90 H125 M91 89 L80 86 M149 89 L160 86"/></g>`;
      body = `<path d="${SH}" style="fill:${C.Evan};stroke:${INK}" stroke-width="2.4"/>
        <g clip-path="url(#${uid}s)"><path d="M96 130 H144 L136 252 H104 Z" style="fill:${NAVY}"/>
        <path d="M86 150 C 92 172, 148 172, 154 150 L154 130 H86 Z" style="fill:${NAVY}"/></g>
        <path d="M86 150 C 92 172, 148 172, 154 150" fill="none" style="stroke:${INK}" stroke-width="2"/>
        <path d="${SH}" fill="none" style="stroke:${INK}" stroke-width="2.4"/>
        <path d="M96 143 L84 156 L104 214 M144 143 L156 156 L136 214" fill="none" style="stroke:${INK}" stroke-width="2.4" stroke-linejoin="round"/>
        <path d="M112 166 V196 M128 166 V196" fill="none" style="stroke:${PAPER}" stroke-width="2.2" stroke-linecap="round"/>
        <circle cx="112" cy="199" r="3" style="fill:${PAPER}"/><circle cx="128" cy="199" r="3" style="fill:${PAPER}"/>`;
      front = `<g transform="translate(186 92)">
          <path d="M-7 10 V16 M7 10 V16" fill="none" style="stroke:${INK}" stroke-width="2.4" stroke-linecap="round"/>
          <rect x="-16" y="-14" width="32" height="26" rx="9" style="fill:${C.Evan};stroke:${INK}" stroke-width="2"/>
          <circle cx="-6.5" cy="-1" r="4.6" style="fill:${PAPER};stroke:${INK}" stroke-width="1.4"/><circle cx="6.5" cy="-1" r="4.6" style="fill:${PAPER};stroke:${INK}" stroke-width="1.4"/>
          <circle cx="-6.5" cy="-0.5" r="1.9" style="fill:${INK}"/><circle cx="6.5" cy="-0.5" r="1.9" style="fill:${INK}"/>
        </g>`;
    }

    if (name === 'Hudson') {
      // The mouth with its cupid's bow, and his four tattoos laid round him like a flash sheet. The snake is the big one.
      head = headC(C.Hudson) + `<path d="M100 103 Q120 128 140 103" fill="none" style="stroke:${PAPER}" stroke-width="3" stroke-linecap="round"/>`;
      body = `<path d="${SH}" style="fill:${PAPER};stroke:${INK}" stroke-width="2.4"/>${crew(INK, false)}`;
      const s = `fill="none" style="stroke:${C.Hudson}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"`;
      back = `
        <g transform="translate(58 56) rotate(-35)"><path d="M-14 0 H12 M6 -5 L12 0 L6 5 M-14 0 L-18 -4 M-14 0 L-18 4 M-9 0 L-13 -4 M-9 0 L-13 4" ${s}/></g>
        <g transform="translate(190 64) rotate(8)"><path d="M-10 10 V-2 C -10 -9, -5 -13, 0 -13 C 5 -13, 10 -9, 10 -2 V10 L6.5 7 L3.3 10 L0 7 L-3.3 10 L-6.5 7 Z" ${s}/><circle cx="-3.5" cy="-3" r="1.5" style="fill:${C.Hudson}"/><circle cx="3.5" cy="-3" r="1.5" style="fill:${C.Hudson}"/></g>
        <path d="M28 182 C 20 164, 38 156, 44 168 C 50 180, 64 176, 60 160 C 56 144, 36 140, 40 122 C 43 110, 52 104, 60 106" fill="none" style="stroke:${C.Hudson}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
        <circle cx="61" cy="106" r="3.8" style="fill:${C.Hudson}"/><path d="M64 104 L70 100 L73 101 M70 100 L71 97" fill="none" style="stroke:${C.Hudson}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
        <g transform="translate(204 130) rotate(12)"><path d="M-12 -6 H10 V0 H-2 L-4 9 H-10 L-8 0 H-12 Z M-1 0 Q-1 4 2 4" ${s}/></g>`;
    }

    return `<svg class="badge" viewBox="0 0 240 240" role="img" aria-label="${name}">
      <defs><clipPath id="${uid}"><circle cx="120" cy="120" r="113"/></clipPath><clipPath id="${uid}s"><path d="${SH}"/></clipPath></defs>
      <circle cx="120" cy="120" r="113" style="fill:${PAPER}"/>
      <g clip-path="url(#${uid})">${back}${body}${head}${front}</g>
      <circle cx="120" cy="120" r="113" fill="none" style="stroke:${INK}" stroke-width="2.6"/>
    </svg>`;
  }

  const TILE_ART = {
    // One long thread of chapters: ink dots, gold for a key chapter, blue where the story is now, dashed after.
    main: () => {
      const d = 'M236 -12 C 318 96, 104 150, 200 258 S 312 410, 176 512';
      const pts = [[255,33.1],[225.5,106.3],[174.7,200.2],[208.5,267.7],[254.3,326.3]];
      return `<svg class="tart" viewBox="0 0 400 500" aria-hidden="true"><g transform="translate(-24 0)">
        <defs><clipPath id="ta-past"><rect x="0" y="0" width="440" height="402"/></clipPath><clipPath id="ta-next"><rect x="0" y="402" width="440" height="120"/></clipPath></defs>
        <path d="${d}" fill="none" style="stroke:${INK}" stroke-width="1.6" clip-path="url(#ta-past)"/>
        <path d="${d}" fill="none" style="stroke:${INK}" stroke-width="1.6" stroke-dasharray="3 7" clip-path="url(#ta-next)"/>
        ${pts.map(([x, y], i) => i === 2 ? `<circle cx="${x}" cy="${y}" r="8.5" style="fill:${GOLD}"/>` : `<circle cx="${x}" cy="${y}" r="6" style="fill:${INK}"/>`).join('')}
        <circle cx="273" cy="402.4" r="12" style="fill:${BLOCK}"/>
      </g></svg>`;
    },
    // Two people and what passes between them; the faint outer pair is the echo.
    dialogues: () => `<svg class="tart" viewBox="0 0 240 240" aria-hidden="true">
        <g fill="none" stroke-width="1.6">
          <path d="M60 98 Q120 22 180 98 M180 142 Q120 218 60 142" style="stroke:${HAIR}"/>
          <path d="M72 110 Q120 60 168 110 M168 130 Q120 180 72 130" style="stroke:${INK}"/>
        </g>
        <circle cx="58" cy="120" r="12" style="fill:${INK}"/>
        <circle cx="182" cy="120" r="12" style="fill:${BLOCK}"/>
      </svg>`,
    // A short thread in Evan's colour, since texting is his; his next reply is still being typed.
    messages: () => {
      const E = CHARS.Evan.color;
      return `<svg class="tart" viewBox="0 0 300 400" aria-hidden="true">
        <path d="${bubble(40, 92, 150, 44, 'bl')}" fill="none" style="stroke:${INK}" stroke-width="1.6"/>
        <path d="${bubble(110, 154, 150, 44, 'br')}" style="fill:${E}"/>
        <path d="${bubble(40, 216, 104, 44, 'bl')}" fill="none" style="stroke:${INK}" stroke-width="1.6"/>
        <path d="${bubble(180, 284, 80, 40, 'br')}" fill="none" style="stroke:${E}" stroke-width="1.6"/>
        <g style="fill:${E}"><circle cx="204" cy="304" r="3.5"/><circle cx="220" cy="304" r="3.5"/><circle cx="236" cy="304" r="3.5"/></g>
      </svg>`;
    },
    // Zoi, with a small picture she made leaning beside her.
    gallery: () => `<svg class="tart" viewBox="0 0 280 350" aria-hidden="true"><g transform="translate(0 -26)">
        <circle cx="108" cy="133" r="27" style="fill:${BLOCK}"/>
        <path d="M54 300 C 54 210, 72 168, 108 168 S 162 210, 162 300" fill="none" style="stroke:${INK}" stroke-width="1.6"/>
        <rect x="146" y="176" width="96" height="124" style="fill:${PAPER2};stroke:${INK}" stroke-width="1.6"/>
        <circle cx="194" cy="224" r="15" style="fill:${GOLD}"/>
        <path d="M198.5 209.5 Q201 219 208 222 M198.5 209.5 Q194 223 179.5 220.5" fill="none" style="stroke:${INK}" stroke-width="1.6" stroke-linecap="round"/>
        <path d="M164 300 C 164 266, 176 250, 194 250 S 224 266, 224 300" fill="none" style="stroke:${INK}" stroke-width="1.6"/>
        <path d="M28 300 H252" fill="none" style="stroke:${INK}" stroke-width="1.6"/></g>
      </svg>`,
    // A reading instrument on the blue block. The four points sit where they sit on the app icon:
    // Zoi in the middle, Leon, Evan and Hudson on the ring.
    studies: () => {
      const grid = [];
      for (let v = 24; v < 240; v += 24) grid.push(`M${v} 0 V240 M0 ${v} H240`);
      return `<svg class="tart" viewBox="0 0 240 240" aria-hidden="true">
        <path d="${grid.join(' ')}" fill="none" style="stroke:${PAPER}" stroke-opacity="0.2" stroke-width="1"/>
        <path d="M120 22 V218 M22 120 H218" fill="none" style="stroke:${PAPER}" stroke-opacity="0.6" stroke-width="1.6"/>
        <circle cx="120" cy="120" r="72" fill="none" style="stroke:${PAPER}" stroke-width="1.6"/>
        <g style="fill:${PAPER}">
          <circle cx="120" cy="120" r="7.5"/>
          <circle cx="74.3" cy="64.3" r="8"/>
          <circle cx="58.4" cy="157.3" r="5.6"/>
          <circle cx="190.2" cy="135.9" r="4.4"/>
        </g>
      </svg>`;
    },
    // The main line starts at its dot and runs on. One path leaves it, goes down and stops;
    // the other climbs away in blue and is still going.
    side: () => `<svg class="tart" viewBox="0 0 480 320" aria-hidden="true">
        <path d="M48 196 H480" fill="none" style="stroke:${INK}" stroke-width="1.6"/>
        <circle cx="48" cy="196" r="7" style="fill:${INK}"/>
        <path d="M128 196 C 196 196, 214 268, 318 272" fill="none" style="stroke:${INK}" stroke-width="1.6"/>
        <g style="fill:${INK}"><circle cx="196" cy="226" r="4.5"/><circle cx="252" cy="262" r="4.5"/><circle cx="324" cy="272" r="7"/></g>
        <path d="M224 196 C 292 196, 300 104, 392 96" fill="none" style="stroke:${BLOCK}" stroke-width="1.6"/>
        <path d="M392 96 C 428 93, 452 80, 480 62" fill="none" style="stroke:${BLOCK}" stroke-width="1.6" stroke-dasharray="3 7"/>
        <g style="fill:${BLOCK}"><circle cx="292" cy="140" r="4.5"/><circle cx="392" cy="96" r="7"/></g>
      </svg>`,
  };
  const ART = [
    'M8 84 C 40 18, 82 20, 100 62 S 158 112, 192 36',
    'M10 60 C 50 10, 90 110, 130 60 S 180 20, 190 70',
    'M10 100 C 30 30, 70 30, 90 70 C 110 110, 150 100, 160 50 S 185 10, 192 30',
    'M14 70 C 40 20, 80 100, 110 60 S 160 30, 188 80',
    'M12 50 C 50 100, 90 10, 120 60 S 170 100, 190 40',
    'M6 70 C 30 40, 60 40, 80 66 S 130 96, 150 60 S 186 30, 196 52',
  ];

  function bagelSVG() {
    // Zoi sits in the hole of the bagel. Leon, Evan and Hudson stand on the ring at equal distances,
    // each joined to her; Leon's line is the strongest.
    const seeds = [[-65,110,20],[-40,170,-35],[-15,125,60],[5,180,-10],[55,150,40],[80,105,-25],[100,175,70],[125,130,-50],[175,165,15],[200,110,-40],[225,175,30],[250,135,-15]]
      .map(([a, r, rot]) => [250 + r * Math.cos((a * Math.PI) / 180), 250 + r * Math.sin((a * Math.PI) / 180), rot]);
    const P = { Leon: [250, 50], Evan: [77, 350], Hudson: [423, 350] };
    const grad = (c) => `<linearGradient id="g${c}" gradientUnits="userSpaceOnUse" x1="250" y1="250" x2="${P[c][0]}" y2="${P[c][1]}"><stop offset="0" stop-color="${CHARS.Zoi.color}"/><stop offset="1" stop-color="${CHARS[c].color}"/></linearGradient>`;
    const spoke = (c, w) => `<line x1="250" y1="250" x2="${P[c][0]}" y2="${P[c][1]}" stroke="url(#g${c})" stroke-width="${w}"/>`;
    return `<svg class="bagel" viewBox="-50 0 600 500" role="img" aria-label="Zoi at the centre of a ring. Leon, Evan and Hudson stand on the ring, each joined to her by a line.">
      <defs>${grad('Leon')}${grad('Evan')}${grad('Hudson')}</defs>
      <circle cx="250" cy="250" r="200" fill="none" stroke="var(--ink)" stroke-width="1.2"/>
      <g fill="var(--ink)">${seeds.map(([x, y, r]) => `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="4.5" ry="1.8" transform="rotate(${r} ${x.toFixed(1)} ${y.toFixed(1)})"/>`).join('')}</g>
      ${spoke('Evan', 1.5)}${spoke('Hudson', 1.5)}${spoke('Leon', 3.5)}
      <circle cx="250" cy="250" r="62" fill="none" stroke="var(--ink)" stroke-width="1.2"/>
      <a href="#/c/Leon"><circle cx="250" cy="50" r="11" fill="${CHARS.Leon.color}" stroke="var(--paper)" stroke-width="3"/><text x="250" y="26" text-anchor="middle">Leon</text></a>
      <a href="#/c/Evan"><circle cx="77" cy="350" r="9" fill="${CHARS.Evan.color}" stroke="var(--paper)" stroke-width="3"/><text x="60" y="380" text-anchor="end">Evan</text></a>
      <a href="#/c/Hudson"><circle cx="423" cy="350" r="9" fill="${CHARS.Hudson.color}" stroke="var(--paper)" stroke-width="3"/><text x="440" y="380">Hudson</text></a>
      <a href="#/c/Zoi"><circle cx="250" cy="250" r="13" fill="${CHARS.Zoi.color}" stroke="var(--paper)" stroke-width="3"/><text x="250" y="292" text-anchor="middle">Zoi</text></a>
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
    const num = isCh ? pad(item.num, 3) + (item.part ? '.' + item.part : '') : item.ep != null ? pad(item.ep, 3) + (item.part ? '.' + item.part : '') : '—';
    const title = isCh ? (opts.chapterTitle ? item.title : excerpt(item.text, 32) || item.title) : item.title;
    // Chapter tags read as one quiet line; 重点 becomes a gold mark instead of a tag.
    const meta = isCh
      ? esc([opts.noNum && item.part ? item.label : '', ...item.tags.slice(0, 3)].filter(Boolean).join(' · '))
      : [opts.showType ? TYPE_LABEL[item.type] : '', pairLabel(item.chars), item.date].filter(Boolean).map(esc).join(' · ');
    const mark = isCh && item.key ? '<i class="key-mark" title="重点" aria-label="Key chapter"></i>' : '';
    return `<a class="row${opts.noNum ? ' no-num' : ''}${isCh && !opts.chapterTitle ? ' ch-row' : ''}" href="${href}"><span class="row-num">${num}</span><span class="row-main"><span class="row-title">${mark}${esc(title)}</span>${meta ? `<span class="row-meta${isCh ? ' one-line' : ''}">${meta}</span>` : ''}</span>${dashes(item.chars)}</a>`;
  }

  // ---------- Body formatting ----------

  function speakerOf(t, generic) {
    let m = t.match(SPEAKER_RE);
    if (m) return { name: canonChar(m[1]) || m[1], rest: m[2] };
    if (generic) { m = t.match(GENERIC_SPEAKER_RE); if (m) return { name: m[1], rest: m[2] }; }
    return null;
  }

  const speakerLabel = (name) => `<span class="spk"><i style="background:${charColor(name)}"></i>${esc(name)}</span>`;

  // Lines grouped for reading. A scene note in （…） can run over several lines; everything up to the closing
  // bracket is one scene, so a long aside never ends up inside the last speaker's lines.
  const OPEN_RE = /^[（(]/, CLOSE_RE = /[)）]$/;
  const HEADING_RE = /^([一二三四五六七八九十百]+、|#{1,3}\s)/;
  const TEXTING_RE = /短信|texts?\b|messages?\b|微信|imessage|聊天/i;
  // 【图：童年照片】 on a line of its own puts that picture from the Gallery right there.
  const PIC_RE = /^[【\[]\s*(?:图|图片|照片|photos?|pics?|img)\s*[:：]\s*(.+?)\s*[】\]]$/i;
  let PIC_CTX = { ep: null, used: new Set() };
  function findPic(name) {
    const n = name.toLowerCase();
    const pool = LIB.images.filter((im) => !im.cover);
    const near = (im) => (PIC_CTX.ep != null && im.ep === PIC_CTX.ep ? 0 : 1);
    const hits = (test) => pool.filter(test).sort((a, b) => near(a) - near(b));
    return hits((im) => (im.caption || '').toLowerCase() === n)[0] ||
      hits((im) => (im.caption || '').toLowerCase().includes(n))[0] ||
      hits((im) => stripExt(im.name).toLowerCase().includes(n))[0] || null;
  }
  function picsFor(names) {
    const found = names.map(findPic).filter(Boolean);
    found.forEach((im) => PIC_CTX.used.add(im.key));
    return found;
  }
  // In prose: small instant photos laid on the page. In texting: a photo message on the sender's side.
  function polaroids(names) {
    const ims = picsFor(names);
    if (!ims.length) return `<p class="scene">［${esc(names.join('｜'))}］</p>`;
    return `<div class="pols">${ims.map((im, i) => `<button class="pol" style="--tilt:${[-2.2, 1.6, -0.8, 2.4][i % 4]}deg" data-act="lightbox" data-key="${esc(im.key)}"><img src="${im.url}" alt="" loading="lazy">${im.caption ? `<span>${esc(im.caption)}</span>` : ''}</button>`).join('')}</div>`;
  }
  function picBubble(names, me) {
    const ims = picsFor(names);
    if (!ims.length) return `<p class="bubble${me ? ' me' : ''} aside">［${esc(names.join('｜'))}］</p>`;
    return `<div class="pic-msg${me ? ' me' : ''}${ims.length > 1 ? ' many' : ''}">${ims.map((im) => `<button data-act="lightbox" data-key="${esc(im.key)}" aria-label="${esc(im.caption || 'Photo')}"><img src="${im.url}" alt="" loading="lazy"></button>`).join('')}</div>`;
  }

  function scanLines(text) {
    const lines = text.split('\n').map((l) => l.trim());
    const out = [];
    for (let i = 0; i < lines.length; i++) {
      const t = lines[i];
      if (!t) continue;
      if (OPEN_RE.test(t) && !CLOSE_RE.test(t)) {
        let j = i + 1;
        while (j < lines.length && j - i < 40 && !CLOSE_RE.test(lines[j])) j++;
        if (j < lines.length && CLOSE_RE.test(lines[j])) {
          const parts = lines.slice(i, j + 1).filter(Boolean);
          parts[0] = parts[0].slice(1);
          parts[parts.length - 1] = parts[parts.length - 1].slice(0, -1);
          out.push({ scene: parts.map((x) => x.trim()).filter(Boolean) });
          i = j;
          continue;
        }
      }
      if (OPEN_RE.test(t) && CLOSE_RE.test(t)) { out.push({ scene: [t.slice(1, -1)] }); continue; }
      const pm = t.match(PIC_RE);
      if (pm) { out.push({ pics: pm[1].split(/[｜|、,，]/).map((x) => x.trim()).filter(Boolean) }); continue; }
      out.push({ t });
    }
    return out;
  }

  // Message bubbles: Zoi on the right, everyone else on the left; in a group, names above.
  // In a thread, a short stage note sits centred; a longer one (a scene, someone's thoughts) becomes a narrow
  // card across the thread with the line of whoever it is about.
  function msgScene(lines, lastMan) {
    const long = lines.length > 1 || lines.join('').length > 36;
    if (!long) return `<p class="msg-scene">${lines.map(esc).join('<br>')}</p>`;
    return `<div class="msg-note"${sceneColor(lines, lastMan)}>${lines.map((x) => `<p>${esc(x)}</p>`).join('')}</div>`;
  }

  function chatBubbles(tokens, group) {
    const out = [];
    let who = null, prev = null, lastMan = null;
    for (const tk of tokens) {
      if (tk.scene) { prev = null; out.push(msgScene(tk.scene, lastMan)); continue; }
      if (tk.pics) { out.push(picBubble(tk.pics, who === 'Zoi')); continue; }
      const t = tk.t;
      if (HEADING_RE.test(t) || /^\d{1,2}[:：]\d{2}/.test(t) || /^\d{4}[.\-/年]\d{1,2}/.test(t)) { prev = null; out.push(`<p class="msg-time">${esc(t.replace(/^#{1,3}\s/, ''))}</p>`); continue; }
      const sp = speakerOf(t, true);
      if (sp) { who = sp.name; if (CHARS[who] && who !== 'Zoi') lastMan = who; if (!sp.rest) continue; }
      const text = sp ? sp.rest : t;
      if (group && who && who !== 'Zoi' && who !== prev) {
        const nick = groupNick(who);
        out.push(`<p class="msg-from" style="color:${charColor(who)}"><b>${esc(nick || who)}</b>${nick ? `<span>${esc(who)}</span>` : ''}</p>`);
      }
      prev = who;
      out.push(`<p class="bubble${who === 'Zoi' ? ' me' : ''}${/^[（(][\s\S]*[)）]$/.test(text) ? ' aside' : ''}">${esc(text)}</p>`);
    }
    return out.join('');
  }

  // A scene note belongs to whoever it is about: the first person named in it gets the line beside it,
  // so Evan's thoughts after one of Zoi's lines read as his, not hers.
  // With no name in it, 她 is Zoi and 他 is the last man who spoke.
  function sceneColor(lines, lastMan) {
    const t = lines.join(' ');
    let best = null, at = Infinity;
    for (const c of ORDER) for (const a of [c, ...CHARS[c].alias]) {
      const i = t.toLowerCase().indexOf(a.toLowerCase());
      if (i >= 0 && i < at) { at = i; best = c; }
    }
    if (!best) {
      const he = t.indexOf('他'), she = t.indexOf('她');
      if (she >= 0 && (he < 0 || she < he)) best = 'Zoi';
      else if (he >= 0 && lastMan) best = lastMan;
    }
    return best && CHARS[best] ? ` style="--who:${CHARS[best].color}"` : '';
  }

  function formatBody(text, opts = {}) {
    const out = [];
    let block = null, chat = null, lastMan = null;
    const flush = () => {
      if (block) { out.push(`<div class="turn">${speakerLabel(block.name)}${block.paras.map((p) => `<p>${esc(p)}</p>`).join('')}</div>`); block = null; }
    };
    // In a 1v1 file, a part headed 一、08:18｜短信 is texting, so it is shown as bubbles on the chat paper.
    const endChat = () => {
      if (chat) {
        out.push(`<div class="chat inline" style='${chatBg(opts.chatKey || 'leon')}'>${chatBubbles(chat, opts.chatKey === 'group')}</div>`);
        chat = null;
      }
    };
    for (const tk of scanLines(text)) {
      if (tk.scene) {
        if (chat) { chat.push(tk); continue; }
        flush(); out.push(`<div class="scene"${sceneColor(tk.scene, lastMan)}>${tk.scene.map((x) => `<p>${esc(x)}</p>`).join('')}</div>`); continue;
      }
      if (tk.pics) {
        if (chat) { chat.push(tk); continue; }
        flush(); out.push(polaroids(tk.pics)); continue;
      }
      const t = tk.t;
      if (HEADING_RE.test(t) || /^【[^】]*】$/.test(t)) {
        flush(); endChat();
        out.push(`<h3 class="sub">${esc(t.replace(/^#{1,3}\s/, ''))}</h3>`);
        if (opts.chatKey && TEXTING_RE.test(t)) chat = [];
        continue;
      }
      if (chat) { chat.push(tk); continue; }
      const sp = opts.speakers === false ? null : speakerOf(t, opts.generic);
      if (sp) { flush(); block = { name: sp.name, paras: sp.rest ? [sp.rest] : [] }; if (CHARS[sp.name] && sp.name !== 'Zoi') lastMan = sp.name; continue; }
      if (block) block.paras.push(t); else out.push(`<p>${esc(t)}</p>`);
    }
    flush(); endChat();
    return out.join('');
  }

  // Record files often open with working notes (时间, 主线状态, 人物状态, 记录说明…) and close with an end state.
  // Those are folded away as Notes, and ===== rules are dropped, so the reading view shows only the exchange.
  const RULE_RE = /^[=＝\-—_*·•~]{4,}$/;
  const META_RE = /^(时间|地点|交流方式|主线状态|人物状态|记录说明|场景|状态|承接|前情)\s*[:：]|记录/;
  const TAIL_RE = /^(记录结束状态|结束状态|后续状态|本轮状态|预定承接)\s*[:：]?/;
  function splitNotes(text) {
    const lines = text.split('\n');
    const startsBody = (t) => speakerOf(t, true) || /^[（(]/.test(t) || /^[一二三四五六七八九十百]+、/.test(t);
    let i = 0;
    const head = [];
    for (; i < lines.length; i++) {
      const t = lines[i].trim();
      if (!t || RULE_RE.test(t)) continue;
      if (startsBody(t)) break;
      head.push(t);
    }
    const headIsNotes = i < lines.length && head.length && head.some((t) => META_RE.test(t));
    const from = headIsNotes ? i : 0;
    let end = lines.length;
    for (let k = from; k < lines.length; k++) if (TAIL_RE.test(lines[k].trim())) { end = k; break; }
    const tail = lines.slice(end).map((l) => l.trim()).filter((t) => t && !RULE_RE.test(t));
    const body = lines.slice(from, end).filter((l) => !RULE_RE.test(l.trim()) && !/^记录结束$/.test(l.trim())).join('\n');
    return { head: headIsNotes ? head : [], tail, body };
  }
  const notesFold = (head, tail, label = 'Notes') => (head.length || tail.length)
    ? `<details class="notes"><summary>${label}</summary>${head.length ? `<div class="note-sec">${head.map((l) => `<p>${esc(l)}</p>`).join('')}</div>` : ''}${tail.length ? `<div class="note-sec"><span class="note-k">After</span>${tail.map((l) => `<p>${esc(l)}</p>`).join('')}</div>` : ''}</details>`
    : '';

  function formatMessages(text, group) {
    return `<div class="thread">${chatBubbles(scanLines(text), group)}</div>`;
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
      const L = { ...TILE_LAYOUT[i], blue: s.key === 'studies', dot: s.key === 'main' };
      const cover = coverFor(s.key);
      const count = sectionCount(s.key);
      let art;
      if (cover) art = `<img src="${cover.url}" alt="">`;
      else if (TILE_ART[s.key]) art = TILE_ART[s.key]();
      else if (L.blue) art = `<span class="tile-ring">${ringSVG(96, 'var(--paper)', 5)}</span>`;
      else art = `${lineArt(ART[i % ART.length] || ART[0])}<span class="ph">[your line drawing]</span>`;
      return `<a class="tile" href="${s.href}" style="--basis:${L.basis}px;--mt:${L.mt}px;--ml:${L.ml || '0px'}">
        <span class="tile-img${L.blue && !cover ? ' is-blue' : ''}" style="aspect-ratio:${L.ar}">${art}${L.dot ? '<span class="tile-dot"></span>' : ''}</span>
        <span class="tile-title">${s.name}<sup>${s.n}</sup></span>
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
      <span class="crow-badge">${badgeSVG(c)}</span>
      <span class="crow-name">${c}<sup>${pad(i + 1)}</sup></span>
      <span class="crow-full"><span>${CHARS[c].full}</span><span aria-hidden="true">↗</span></span>
    </a>`;
  }

  const MAIN_FILTERS = [
    { key: 'pair', label: 'Leon × Zoi', chars: ['Leon', 'Zoi'], test: (c) => c.chars.length === 2 && c.chars.includes('Leon') && c.chars.includes('Zoi') },
    { key: 'Evan', label: 'with Evan', chars: ['Evan'], test: (c) => c.chars.includes('Evan') },
    { key: 'Hudson', label: 'with Hudson', chars: ['Hudson'], test: (c) => c.chars.includes('Hudson') },
    { key: 'four', label: 'All four', chars: ORDER, test: (c) => ORDER.every((k) => c.chars.includes(k)) },
  ];

  function viewMain(arcName, params) {
    if (!LIB.arcs.length) return shell(pageTitle('Main line', 'The chapters that form the main thread.') + emptyState('No main line files yet. Files whose name contains 主线 are split into chapters automatically.'));
    const open = arcName || (LIB.arcs[LIB.arcs.length - 1] || {}).name;
    const f = MAIN_FILTERS.find((x) => x.key === (params && params.get('f')));
    const filters = `<div class="filters"><a href="#/main" class="${!f ? 'on' : ''}">All</a>${MAIN_FILTERS.map((x) => `<a href="#/main?f=${x.key}" class="${f === x ? 'on' : ''}">${dashes(x.chars, 'dashes sm')}${esc(x.label)}</a>`).join('')}</div>`;
    const body = LIB.arcs.map((a) => {
      const ov = overviewFor(a.name);
      const list = f ? a.chapters.filter(f.test) : a.chapters;
      if (f && !list.length) return '';
      return `<details class="arc" ${f || a.name === open ? 'open' : ''} id="arc-${enc(a.name)}">
        <summary><span class="arc-title">${esc(a.name)}<sup>${a.range ? a.range.join('–') : ''}</sup></span><span class="arc-count">${list.length}</span></summary>
        ${ov ? `<a class="arc-ov" href="#/doc/${enc(ov.id)}">Overview ↗</a>` : ''}
        ${a.intro ? `<details class="notes"><summary>About this arc</summary><div class="body">${formatBody(a.intro, { speakers: false })}</div></details>` : ''}
        <div class="rows">${list.map((c) => rowHTML(c)).join('')}</div>
      </details>`;
    }).join('');
    return shell(pageTitle('Main line', 'The chapters that form the main thread.') + filters + `<div class="arcs-list">${body}</div>`);
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
    const chs = LIB.chapters.filter((c) => c.num === ep && c.id !== exceptId);
    const items = [];
    chs.forEach((c) => items.push(rowHTML(c, { chapterTitle: true })));
    rel.forEach((d) => items.push(rowHTML(d, { showType: true })));
    return items.length ? `<section class="related">${sectionHead('AROUND 第' + ep + '篇', items.length)}<div class="rows">${items.join('')}</div></section>` : '';
  }

  let CURRENT_TEXT = { title: '', text: '' };
  let CURRENT_CH = null;

  // Tag edits are written into the heading line of the stored file, so Export carries them back to Files.
  async function saveTags(ch, raw) {
    const tags = raw.split(/\s*[｜|]\s*/).map((t) => t.trim()).filter(Boolean);
    const rec = await idb('readonly', (st) => st.get(ch.recKey));
    if (!rec) { toast('Could not find the file for this chapter.'); return; }
    const lines = rec.text.split('\n');
    let idx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim() !== ch.headLine) continue;
      if (ch.structured) {
        let k = i - 1;
        while (k >= 0 && !lines[k].trim()) k--;
        if (k < 0 || lines[k].trim() !== '【标题】') continue;
      }
      idx = i; break;
    }
    if (idx < 0) { toast('This heading has changed in the file; re-import and try again.'); return; }
    const part = ch.partMarked ? '（' + cnLabel(ch.part) + '）' : '';
    const head = '第' + ch.num + '篇' + part;
    lines[idx] = !tags.length ? head : ch.structured ? head + '｜' + tags.join('｜') : head + (part ? '' : ' ') + tags.join('｜');
    rec.text = lines.join('\n');
    await putRecords([rec]);
    await loadLibrary();
    await route();
    toast('Saved. Export when you want this change in your Files too.', 4000);
  }

  // The labelled notes above 【正文】 are mostly for models; keep them folded away while reading.
  function chapterNotes(ch) {
    const order = ['检索摘要', '关系线', '连续性更新', '前置关联'];
    const keys = [...order.filter((k) => ch.sections[k]), ...Object.keys(ch.sections).filter((k) => !order.includes(k))];
    if (!keys.length) return '';
    return `<details class="notes"><summary>Chapter notes</summary>${keys.map((k) => `<div class="note-sec"><span class="note-k">${esc(k)}</span>${ch.sections[k].split('\n').filter((l) => l.trim()).map((l) => `<p>${esc(l.trim())}</p>`).join('')}</div>`).join('')}</details>`;
  }

  function viewChapter(id) {
    const ch = LIB.byId.get(id);
    if (!ch) return viewMissing();
    store('lines:last', ch.id);
    const arc = LIB.arcs.find((a) => a.name === ch.arc);
    const pos = arc ? (arc.chapters.indexOf(ch) + 1) / arc.chapters.length : 0;
    const prev = LIB.chapters[ch.index - 1], next = LIB.chapters[ch.index + 1];
    CURRENT_TEXT = { title: ch.title + (ch.note ? ' ' + ch.note : ''), text: ch.text };
    CURRENT_CH = ch;
    return `${topbar()}<main class="wrap reader">
      ${readerActions('#/main/' + enc(ch.arc), 'Main line')}
      <div class="progress"><span style="width:${Math.round(pos * 100)}%;background:${CHARS.Leon.color}"></span><span style="width:${Math.round(pos * 100)}%;background:${CHARS.Zoi.color}"></span></div>
      <div class="rhead">
        <h1 class="bignum" aria-label="${esc(ch.title)}">(${ch.label})</h1>
        <div class="rmeta">${dashes(ch.chars, 'dashes sm')}<a href="#/main/${enc(ch.arc)}">${esc(ch.arc)}</a>${ch.key ? '<span class="tag key">重点</span>' : ''}${ch.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join('')}${ch.headLine ? '<button class="linkbtn tag-edit" data-act="edit-tags">Edit tags</button>' : ''}</div>
      </div>
      ${chapterNotes(ch)}
      <article class="body">${(PIC_CTX = { ep: ch.num, used: new Set() }, formatBody(ch.text))}</article>
      ${storyStrip(storyImagesFor(ch.num, ch.part, 'main').filter((im) => !PIC_CTX.used.has(im.key)))}
      ${relatedFor(ch.num, ch.id)}
      <nav class="pn">
        ${prev ? `<a href="#/ch/${enc(prev.id)}"><small>Previous</small><span>← ${prev.label}</span></a>` : '<span></span>'}
        ${next ? `<a class="r" href="#/ch/${enc(next.id)}"><small>Next</small><span>${next.label} →</span></a>` : '<span></span>'}
      </nav>
    </main>${footer()}`;
  }

  function backFor(d) {
    if (d.type === 'message') { const t = THREADS.find((x) => x.key === threadKeyOf(d)); return ['#/messages/' + t.key, threadName(t)]; }
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
    PIC_CTX = { ep: d.ep, used: new Set() };
    const sn = ['message', 'dialogue', 'side'].includes(d.type) ? splitNotes(d.text) : { head: [], tail: [], body: d.text };
    if (d.type === 'message') body = `<div class="chat inline" style='${chatBg(threadKeyOf(d))}'>${chatBubbles(scanLines(sn.body), threadKeyOf(d) === 'group')}</div>`;
    else if (d.type === 'diary') body = `<div class="diary">${formatBody(d.text, { speakers: false })}</div>`;
    else body = formatBody(sn.body, { generic: ['dialogue', 'side', 'save', 'note'].includes(d.type), chatKey: ['dialogue', 'side'].includes(d.type) ? threadKeyOf(d) : null });
    body = notesFold(sn.head, sn.tail) + body;
    const ch = chapterFor(d);
    return `${topbar()}<main class="wrap reader">
      ${readerActions(back, backLabel)}
      ${d.chars.length ? `<div class="progress">${d.chars.slice(0, 2).map((c) => `<span style="width:${Math.round(((i + 1) / siblings.length) * 100)}%;background:${charColor(c)}"></span>`).join('')}</div>` : ''}
      <div class="rhead">
        ${d.ep != null ? `<span class="bignum">(${d.epLabel})</span>` : `<span class="kicker">${TYPE_LABEL[d.type]}</span>`}
        <h1>${esc(d.title)}</h1>
        <div class="rmeta">${dashes(d.chars, 'dashes sm')}${esc([pairLabel(d.chars), d.ep != null ? TYPE_LABEL[d.type] : '', d.date].filter(Boolean).join(' · '))}${ch ? ` · <a href="#/ch/${enc(ch.id)}">Read ${esc(ch.title)} ↗</a>` : ''}</div>
      </div>
      ${img ? `<figure class="doc-img"><img src="${img.url}" alt=""></figure>` : ''}
      <article class="body">${body}</article>
      ${['dialogue', 'message', 'side'].includes(d.type) ? storyStrip(storyImagesFor(d.ep, d.part, d.type === 'message' ? 'message' : 'dialogue').filter((im) => !PIC_CTX.used.has(im.key))) : ''}
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

  // Each person's own things, in one shared grid of same-size cards; only the cards differ.
  //   Leon: objects with a museum label.  Zoi: drawings in a paper mount.
  //   Evan: save slots.                   Hudson: pages of a ruled notebook.
  const ccard = (inner, label, attrs, cls = '') => `<${attrs.href ? 'a' : 'button'} class="ccard ${cls}" ${attrs.href ? `href="${attrs.href}"` : `type="button" data-act="${attrs.act}"${attrs.key ? ` data-key="${esc(attrs.key)}"` : ''}${attrs.c ? ` data-c="${attrs.c}"` : ''}`}>
      <span class="ccard-face">${inner}</span>${label ? `<span class="ccard-label">${label}</span>` : ''}</${attrs.href ? 'a' : 'button'}>`;
  const clabel = (k, t) => `${k ? `<span class="ccard-k">${esc(k)}</span>` : ''}<span class="ccard-t">${esc(t)}</span>`;
  const addCard = (c, text) => ccard('<span class="plus" aria-hidden="true"></span>', `<span class="ccard-t muted">${text}</span>`, { act: 'char-add', c }, 'add');

  function objectSection(c) {
    let head, cards = [], note = '';
    if (c === 'Leon') {
      const items = docsOf('item').filter((d) => d.chars.includes('Leon'));
      const pics = LIB.images.filter((im) => im.kind === 'story' && im.chars.includes('Leon') && !items.some((d) => imageByName(d.image) === im));
      pics.forEach((im) => cards.push(ccard(`<img src="${im.url}" alt="" loading="lazy">`, clabel(imgEp(im), im.caption || 'Untitled'), { act: 'lightbox', key: im.key }, 'leon')));
      items.forEach((d) => {
        const img = imageByName(d.image);
        cards.push(ccard(img ? `<img src="${img.url}" alt="" loading="lazy">` : ringSVG(40, 'currentColor', 5), clabel(epName(d), d.title), { href: '#/doc/' + enc(d.id) }, 'leon'));
      });
      head = sectionHead('PERSONAL ITEMS', items.length + pics.length);
      note = 'The things he kept.';
      cards.push(addCard('Leon', 'Add a picture'));
    } else if (c === 'Zoi') {
      const imgs = LIB.images.filter((i) => i.kind === 'art' && !i.cover);
      const docs = docsOf('sketch');
      imgs.forEach((im) => cards.push(ccard(`<img src="${im.url}" alt="" loading="lazy">`, im.caption ? clabel('', im.caption) : '', { act: 'lightbox', key: im.key }, 'zoi')));
      docs.forEach((d) => cards.push(ccard(`<span class="sk-text">${esc(excerpt(d.text, 60))}</span>`, clabel(epName(d), d.title), { href: '#/doc/' + enc(d.id) }, 'zoi')));
      head = sectionHead('SKETCHBOOK', imgs.length + docs.length);
      note = 'Her drawings.';
      cards.push(addCard('Zoi', 'Add a drawing'));
    } else if (c === 'Evan') {
      const saves = docsOf('save').filter((d) => d.chars.includes('Evan'));
      saves.forEach((d, k) => cards.push(ccard(`<span class="slot-k">SAVE ${pad(k + 1)}</span><span class="slot-t">${esc(d.title)}</span><span class="slot-x">${esc(excerpt(d.text, 70))}</span><span class="slot-ep">${esc(epName(d))}</span>`, '', { href: '#/doc/' + enc(d.id) }, 'evan')));
      for (let k = saves.length; k < Math.max(2, saves.length); k++) cards.push(`<span class="ccard evan blank"><span class="ccard-face"><span class="slot-k">SAVE ${pad(k + 1)}</span><span class="slot-t">— EMPTY —</span></span></span>`);
      head = sectionHead('SAVE FILES', saves.length);
      note = `Load game. <a href="#/messages/evan">Messages with Zoi →</a>`;
      cards.push(addCard('Evan', 'New save'));
    } else {
      const entries = docsOf('diary').filter((d) => d.chars.includes('Hudson'));
      entries.forEach((d) => cards.push(ccard(`<span class="page-date">${esc(d.date || epName(d))}</span><span class="page-text">${esc(excerpt(d.text, 120))}</span>`, clabel(d.date ? epName(d) : '', d.title), { href: '#/doc/' + enc(d.id) }, 'hudson')));
      if (!entries.length) cards.push(`<span class="ccard hudson blank"><span class="ccard-face"><span class="page-text">the first page of his diary</span></span></span>`);
      head = sectionHead('DIARY', entries.length);
      note = 'He writes most nights.';
      cards.push(addCard('Hudson', 'New page'));
    }
    return `<section class="block">${head}${note ? `<p class="note-line">${note}</p>` : ''}<div class="cgrid">${cards.join('')}</div></section>`;
  }

  function charAdd(c) {
    if (c === 'Leon') return pickImages({ kind: 'story', people: ['Leon'] });
    if (c === 'Zoi') return pickImages({ kind: 'art', people: [] });
    const t = c === 'Evan' ? '存档' : '日记';
    openOverlay(`<div class="sheet"><p class="sheet-k">${c}</p><h2>${c === 'Evan' ? 'A new save' : 'A new page'}</h2>
      <p class="note-line">${c === 'Evan' ? 'Save files' : 'Diary pages'} are text files. Start one in Notes or Pages with these lines, save it as .txt into your Lines folder, then import.</p>
      <pre class="code">类型：${t}\n人物：${c}\n篇号：163\n标题：…${c === 'Hudson' ? '\n日期：2026.08.27' : ''}\n---\n正文……</pre>
      <span class="sheet-btns"><button class="btn sm" data-act="close">Got it</button></span></div>`, 'sheet-ov');
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
        <span class="cbadge">${badgeSVG(c)}</span>
        <h1 class="cname">${c}<sup>${pad(ORDER.indexOf(c) + 1)}</sup></h1>
        <p class="lede">${info.full}</p>
        ${cover ? `<figure class="ccover"><img src="${cover.url}" alt=""></figure>` : ''}
      </div>
      ${photoStrip(c)}
      ${objectSection(c)}
      ${notes.length ? `<section class="block">${sectionHead('NOTES', notes.length)}<div class="rows">${notes.map((d) => rowHTML(d)).join('')}</div></section>` : ''}
      ${profiles.length ? `<section class="block">${sectionHead('PROFILE', profiles.length)}${profiles.map((d) => `<details class="profile"><summary>${esc(d.title)}</summary><div class="body">${formatBody(d.text, { speakers: false })}</div></details>`).join('')}</section>` : ''}
      ${appears.length ? `<section class="block">${sectionHead('APPEARS IN', appears.length)}<div class="rows">${appears.slice(-12).reverse().map((d) => rowHTML(d, { showType: true })).join('')}</div></section>` : ''}
      <nav class="pn">${ORDER.filter((x) => x !== c).map((x) => `<a href="#/c/${x}"><small>Character</small><span>${dashes([x], 'dashes sm')}${x}</span></a>`).join('')}</nav>
    </main>${footer()}`;
  }

  function viewGallery(params) {
    const f = params.get('f') || '', k = params.get('k') || '';
    const href = (kk, ff) => { const q = new URLSearchParams(); if (kk) q.set('k', kk); if (ff) q.set('f', ff); const t = q.toString(); return '#/gallery' + (t ? '?' + t : ''); };
    const pool = LIB.images.filter((i) => !i.cover && (!f || i.chars.includes(f)));
    const kinds = `<div class="filters">${[['', 'All'], ...KINDS].map(([kk, label]) => `<a href="${href(kk, f)}" class="${k === kk ? 'on' : ''}">${label}</a>`).join('')}</div>`;
    const people = `<div class="filters sm">${['', ...ORDER].map((c) => `<a href="${href(k, c)}" class="${f === c ? 'on' : ''}">${c ? dashes([c], 'dashes sm') + c : 'Everyone'}</a>`).join('')}</div>`;
    const actions = `<div class="gal-actions"><button class="btn sm" data-act="add-images">Add images</button><button class="chip${SELECTING ? ' on' : ''}" data-act="gselect">${SELECTING ? 'Done' : 'Select'}</button><span class="tone-modes" role="group" aria-label="Photo style">${TONES.map(([m, label]) => `<button class="chip${toneMode() === m ? ' on' : ''}" data-act="tone-mode" data-mode="${m}" aria-pressed="${toneMode() === m}">${label}</button>`).join('')}</span></div>`;
    const section = ([kk, label]) => {
      const imgs = pool.filter((i) => i.kind === kk);
      if (kk === 'story') imgs.sort((a, b) => (a.ep ?? 1e9) - (b.ep ?? 1e9) || (a.part || 0) - (b.part || 0));
      if (!imgs.length) return '';
      return `<section class="gsec">${k ? '' : sectionHead(label.toUpperCase(), imgs.length)}<div class="gallery">${imgs.map((im) => thumb(im, true, SELECTING)).join('')}</div></section>`;
    };
    const body = (k ? KINDS.filter(([kk]) => kk === k) : KINDS).map(section).join('') ||
      emptyState('Nothing here yet. Add images here, or name them in Files as 类别｜篇号｜人物｜关联｜标题 and import the folder as a zip.');
    const bar = SELECTING ? `<div class="selbar"><span class="selcount">${SELECTED.size} selected</span><button class="linkbtn" data-act="gsel-all">Select all shown</button><button class="chip danger" data-act="gsel-delete"${SELECTED.size ? '' : ' disabled'}>Delete</button></div>` : '';
    return shell(pageTitle('Gallery', 'Portraits, pictures from the story, and art.') + actions + kinds + people + body) + bar;
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
    const imgs = recs.filter((r) => r.kind === 'image').length;
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
      <p class="small">Version ${APP_VERSION}</p>
      <p class="small">${persisted ? 'Storage is marked as persistent on this device.' : 'Tip: add Lines to your Home Screen so the browser keeps this library safely. Your Lines folder in Files stays the original either way.'}</p>

      <section class="block">${sectionHead('COLORS', null)}
        <div class="color-preview-wrap">
          <p class="color-preview"><span data-preview="Leon" style="color:${CHARS.Leon.color}">Leon</span> <span class="x">×</span> <span data-preview="Zoi" style="color:${CHARS.Zoi.color}">Zoi</span></p>
          <span class="preview-accents" aria-hidden="true"><i data-preview-bg="circle" class="pa-circle" style="background:${ACCENT.circle}"></i><i data-preview-bg="block" class="pa-block" style="background:${ACCENT.block}"></i></span>
        </div>
        <div class="presets">${PRESETS.map((p, i) => `<button class="preset${SLOTS.every((k) => p.colors[k].toLowerCase() === getSlot(k).toLowerCase()) ? ' on' : ''}" data-act="preset" data-i="${i}"><span class="pdots" aria-hidden="true">${SLOTS.map((k) => `<i style="background:${p.colors[k]}"></i>`).join('')}</span>${esc(p.name)}</button>`).join('')}</div>
        <p class="note-line">Start from a set, then fine-tune. Tap a swatch to pick by eye, or type a color code. Each person’s color is used for their name, their lines and their dashes; Circle and Block are the two accents on the home page.</p>
        <div class="colors">${SLOTS.map((k) => `<div class="color-row${CHARS[k] ? '' : ' accent-row'}">
          <label class="swatch${k === 'circle' ? ' round' : k === 'block' ? ' square' : ''}" data-swatch="${k}" style="background:${getSlot(k)}"><input type="color" value="${getSlot(k).toLowerCase()}" data-slot="${k}" aria-label="${SLOT_LABEL[k] || k} color"></label>
          <span class="color-name">${SLOT_LABEL[k] || k}</span>
          <input class="hex" type="text" value="${getSlot(k).toUpperCase()}" data-hex="${k}" maxlength="7" autocomplete="off" autocapitalize="characters" spellcheck="false" aria-label="${SLOT_LABEL[k] || k} color code">
          <button class="linkbtn" data-act="color-reset" data-c="${k}">Reset</button>
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
        <p class="note-line">For texts, 人物 is Leon × Zoi, Zoi × Evan, Zoi × Hudson or 群聊 for the group chat. 类型 can be 1v1, 支线, 短信, 日记, 物品, 存档, 留言, 档案, 插画 or 概览 / 研究. Optional lines: 日期, 图片 (an image file name). Images are named 类别｜篇号｜人物｜关联｜标题: 类别 is 人物, 故事 or 创作; 关联 (主线, 1v1 or 短信) only matters for 故事, and shows the picture under that piece. Everything but 类别 can be left out, e.g. 人物｜Zoi｜湖边.jpg or 故事｜160.2｜Evan｜短信｜童年照片.jpg. Images in a folder named 封面, named after a section (main, dialogues, side, messages, studies, gallery) or a character, become covers. Files with the same name replace each other.</p>
      </section>

      <section class="block">${sectionHead('FILES', recs.length)}
        ${recs.length ? `<ul class="files">${files}</ul><button class="btn danger" data-act="clear">Remove everything from this device</button>` : '<p class="note-line">No files yet.</p>'}
      </section>`);
  }

  // ---------- Images: kinds, names, styles, editing ----------

  // Every image is one of three kinds, and can show any number of people:
  //   Portraits — what the characters look like.
  //   In the story — pictures that exist inside the story (an old photo, a place, an object);
  //                  these can carry a 篇号 and show under that chapter, text or dialogue.
  //   Art — Zoi's own drawings; they keep their colours.
  // The file name carries all of it, so a folder of images can be named in Files and imported as a zip:
  //   类别｜篇号｜人物｜关联｜标题.jpg   e.g. 故事｜160.2｜Evan｜短信｜童年照片.jpg
  const KINDS = [['portrait', 'Portraits', '人物'], ['story', 'In the story', '故事'], ['art', 'Art', '创作']];
  const LINKS = [['main', '主线'], ['dialogue', '1v1'], ['message', '短信']];
  const CAMERA_NAME = /^(IMG|DSC|PXL|DCIM|image|photo|Screenshot|截屏|屏幕快照|微信图片)[\s_\-]*[\d_\-\s]*$/i;

  function parseImageName(folder, name) {
    const segs = stripExt(name).split(/[｜|]/).map((x) => x.trim()).filter(Boolean);
    let kind = null, ep = null, part = null, links = [], people = [];
    const title = [];
    for (const sg of segs) {
      let m;
      if (/^(人物|人像|portraits?)$/i.test(sg)) kind = 'portrait';
      else if (/^(故事|剧情|story|in the story)$/i.test(sg)) kind = 'story';
      else if (/^(创作|插画|速写|绘画|art|sketch(es)?|drawings?)$/i.test(sg)) kind = 'art';
      else if ((m = sg.match(/^第?(\d{1,4})(?:[.．](\d{1,2}))?篇?$/))) { ep = +m[1]; part = m[2] ? +m[2] : null; }
      else if (/^(主线|1v1|短信)([、,，+＋\s]+(主线|1v1|短信))*$/i.test(sg)) {
        links = sg.split(/[、,，+＋\s]+/).map((x) => (x === '主线' ? 'main' : /1v1/i.test(x) ? 'dialogue' : 'message'));
      } else if (detectChars(sg).length && !sg.replace(/Leon|Zoi|Evan|Hudson|里昂|雪儿|[×xX&+＋、,，\s]/gi, '')) people = parseChars(sg).filter((c) => CHARS[c]);
      else title.push(sg);
    }
    const where = folder + '/' + name;
    if (!kind) kind = /插画|速写|sketch|drawing|创作|\bart\b/i.test(where) ? 'art' : /故事|story/i.test(where) ? 'story' : 'portrait';
    if (!people.length) people = detectChars(folder);
    if (!people.length) people = detectChars(stripExt(name));
    const caption = title.join('｜');
    return { kind, ep, part, links, people, caption: CAMERA_NAME.test(caption) ? '' : caption };
  }

  function imageName(o, ext) {
    const kind = (KINDS.find(([k]) => k === o.kind) || KINDS[0])[2];
    const segs = [kind];
    if (o.ep != null) segs.push(o.ep + (o.part ? '.' + o.part : ''));
    if (o.people.length) segs.push(sortChars(o.people).join('×'));
    if (o.ep != null && o.links.length) segs.push(o.links.map((l) => LINKS.find(([k]) => k === l)[1]).join('、'));
    if (o.caption) segs.push(o.caption.replace(/[\\/:*?"<>|｜]/g, ' ').trim());
    return segs.join('｜') + ext;
  }

  const imgEp = (im) => (im.ep == null ? '' : '第' + im.ep + '篇' + (im.part ? '（' + cnLabel(im.part) + '）' : ''));

  // Story images that belong under a chapter, a text or a dialogue with the same 篇号.
  function storyImagesFor(num, part, linkType) {
    if (num == null) return [];
    return LIB.images.filter((im) => im.kind === 'story' && im.ep === num &&
      (!im.part || !part || im.part === part) && (!im.links.length || im.links.includes(linkType)));
  }
  function storyStrip(imgs, label = 'IN THE STORY') {
    if (!imgs.length) return '';
    return `<section class="related">${sectionHead(label, imgs.length)}<div class="strip">${imgs.map((im) => thumb(im)).join('')}</div></section>`;
  }

  // Ink: black and white laid on the paper. Print: one colour per person, softened toward the paper. Off: as taken.
  const TONES = [['off', 'Original'], ['ink', 'Ink'], ['print', 'Print']];
  const toneMode = () => { const v = store('lines:tone'); return TONES.some(([k]) => k === v) ? v : 'off'; };
  const toneColor = (im) => (im.chars[0] && CHARS[im.chars[0]] ? CHARS[im.chars[0]].color : '#141414');
  const toned = (im, original) => {
    const mode = original || im.kind === 'art' ? 'off' : toneMode();
    const people = im.chars.filter((c) => CHARS[c]);
    const marks = im.kind !== 'art' && people.length && mode !== 'print' ? `<i class="tdash" aria-hidden="true">${people.map((c) => `<b style="background:${CHARS[c].color}"></b>`).join('')}</i>` : '';
    return `<span class="tone t-${mode}" style="--tone:${toneColor(im)}"><img src="${im.url}" alt="" loading="lazy">${marks}</span>`;
  };

  let SELECTING = false;
  const SELECTED = new Set();
  const thumb = (im, cap, pick) => `<button class="gimg${pick && SELECTED.has(im.key) ? ' picked' : ''}" data-act="${pick ? 'gsel' : 'lightbox'}" data-key="${esc(im.key)}" aria-label="Open ${esc(im.caption || im.name)}">${toned(im)}${pick ? '<i class="gcheck" aria-hidden="true"></i>' : ''}${cap ? `<span class="gcap">${esc([im.kind === 'story' ? imgEp(im) : '', im.caption].filter(Boolean).join(' · '))}</span>` : ''}</button>`;

  let PENDING_IMAGES = [];
  let PENDING = { kind: 'portrait', people: [] };
  let LB_ORIGINAL = false;

  function pickImages(preset) {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'image/*'; inp.multiple = true; inp.hidden = true;
    document.body.appendChild(inp);
    inp.addEventListener('change', () => {
      PENDING_IMAGES = [...inp.files];
      inp.remove();
      if (!PENDING_IMAGES.length) return;
      PENDING = preset ? { kind: preset.kind, people: [...preset.people] } : { kind: 'portrait', people: [] };
      addSheet();
    });
    inp.click();
  }

  function addSheet() {
    const n = PENDING_IMAGES.length;
    openOverlay(`<div class="sheet"><p class="sheet-k">${n} image${n === 1 ? '' : 's'}</p>
      <h2>What ${n === 1 ? 'is it' : 'are they'}?</h2>
      <div class="chips">${KINDS.map(([k, label]) => `<button class="chip${PENDING.kind === k ? ' on' : ''}" data-act="add-kind" data-kind="${k}">${label}</button>`).join('')}</div>
      <p class="sheet-k">Who is in ${n === 1 ? 'it' : 'them'}</p>
      <div class="chips">${ORDER.map((c) => `<button class="chip${PENDING.people.includes(c) ? ' on' : ''}" data-act="add-person" data-c="${c}">${dashes([c], 'dashes sm')}${c}</button>`).join('')}</div>
      <p class="note-line">Pick as many people as you like, or none. Open an image later to add a 篇号, a caption or change any of this.</p>
      <span class="sheet-btns"><button class="btn sm" data-act="add-save">Add</button><button class="linkbtn" data-act="close">Cancel</button></span></div>`, 'sheet-ov');
  }

  function uniqueName(name, taken) {
    const stem = stripExt(name), ext = name.slice(stem.length);
    for (let k = 2; taken.has(name); k++) name = `${stem} ${k}${ext}`;
    taken.add(name);
    return name;
  }

  async function addPendingImages() {
    const taken = new Set(LIB.records.map((r) => r.key));
    const recs = [];
    for (const f of PENDING_IMAGES) {
      const orig = f.name || 'image.jpg';
      let ext = (orig.match(/\.[^.]+$/) || ['.jpg'])[0].toLowerCase();
      if (!IMG_TYPES[ext.slice(1)]) ext = '.jpg';
      const caption = CAMERA_NAME.test(stripExt(orig)) ? '' : stripExt(orig);
      const name = uniqueName(imageName({ kind: PENDING.kind, ep: null, part: null, people: PENDING.people, links: [], caption }, ext), taken);
      const r = makeRecord('Gallery/' + name, new Uint8Array(await f.arrayBuffer()));
      if (r) { if (f.type && f.type.startsWith('image/')) r.mime = f.type; recs.push(r); }
    }
    PENDING_IMAGES = [];
    closeOverlay();
    if (!recs.length) { toast('Those files could not be read as images.'); return; }
    await putRecords(recs);
    await loadLibrary();
    await route();
    toast(`Added ${recs.length} image${recs.length === 1 ? '' : 's'}. Export when you want them in your Files too.`, 4000);
  }

  function openLightbox(key) {
    const im = LIB.images.find((i) => i.key === key);
    if (!im) return;
    const k = esc(key);
    openOverlay(`<button class="lb-close menubtn" data-act="close">CLOSE ×</button>
      <figure class="lb-fig">${toned(im, LB_ORIGINAL)}</figure>
      ${im.caption || im.ep != null ? `<p class="lb-cap">${esc([im.kind === 'story' ? imgEp(im) : '', im.caption].filter(Boolean).join(' · '))}</p>` : ''}
      <div class="lb-bar">
        ${im.kind === 'art' || toneMode() === 'off' ? '' : `<button class="chip" data-act="lb-tone" data-key="${k}">${LB_ORIGINAL ? 'Show styled' : 'Show original'}</button>`}
        <div class="chips">${KINDS.map(([kk, label]) => `<button class="chip${im.kind === kk ? ' on' : ''}" data-act="lb-set" data-field="kind" data-v="${kk}" data-key="${k}">${label}</button>`).join('')}</div>
        <div class="chips">${ORDER.map((c) => `<button class="chip${im.chars.includes(c) ? ' on' : ''}" data-act="lb-set" data-field="person" data-v="${c}" data-key="${k}">${c}</button>`).join('')}</div>
        <form class="lb-form" data-act="lb-save" data-key="${k}">
          <label><span>篇号</span><input name="ep" type="text" inputmode="decimal" value="${im.ep != null ? im.ep + (im.part ? '.' + im.part : '') : ''}" placeholder="160.2"></label>
          <label class="wide"><span>Caption</span><input name="caption" type="text" value="${esc(im.caption)}" placeholder="童年照片"></label>
          ${im.kind === 'story' ? `<div class="chips links"><span>Show under</span>${LINKS.map(([lk, label]) => `<button type="button" class="chip${im.links.includes(lk) ? ' on' : ''}" data-act="lb-set" data-field="link" data-v="${lk}" data-key="${k}">${label}</button>`).join('')}</div>` : ''}
          <button class="chip" type="submit">Save</button>
        </form>
        <button class="chip danger" data-act="lb-remove" data-key="${k}">Remove</button>
      </div>`, 'lightbox');
  }

  // Edits rename the stored file, so the name in Files says the same thing after Export.
  async function updateImage(key, change) {
    const im = LIB.images.find((i) => i.key === key);
    const rec = await idb('readonly', (s) => s.get(key));
    if (!im || !rec) return;
    const o = { kind: im.kind, ep: im.ep, part: im.part, people: [...im.chars], links: [...im.links], caption: im.caption };
    change(o);
    const ext = (rec.name.match(/\.[^.]+$/) || ['.jpg'])[0];
    const taken = new Set(LIB.records.map((r) => r.key).filter((x) => x !== key));
    const name = uniqueName(imageName(o, ext), taken);
    if (name !== rec.name) {
      await deleteRecord(key);
      rec.key = name; rec.name = name;
    }
    rec.folder = 'Gallery';
    await putRecords([rec]);
    await loadLibrary();
    await route();
    openLightbox(name);
  }

  function photoStrip(c) {
    const imgs = LIB.images.filter((i) => !i.cover && i.kind === 'portrait' && i.chars.includes(c));
    if (!imgs.length) return '';
    return `<section class="block">${sectionHead('PHOTOS', imgs.length, `<a href="#/gallery?f=${c}">Gallery ↗</a> `)}
      <div class="strip">${imgs.slice(0, 12).map((im) => thumb(im)).join('')}</div></section>`;
  }

  // ---------- Messages: Zoi's phone ----------

  const THREADS = [
    { key: 'leon', with: 'Leon', label: 'Leon × Zoi' },
    { key: 'evan', with: 'Evan', label: 'Zoi × Evan' },
    { key: 'hudson', with: 'Hudson', label: 'Zoi × Hudson' },
    { key: 'group', label: 'Group chat' },
  ];

  function threadKeyOf(d) {
    const named = d.chars.filter((c) => CHARS[c]);
    if (d.chars.some((c) => /群|group/i.test(c)) || /群聊|group/i.test(d.path) || named.length >= 3) return 'group';
    for (const t of THREADS) if (t.with && named.includes(t.with)) return t.key;
    return 'group';
  }

  const threadDocs = (key) => docsOf('message').filter((d) => threadKeyOf(d) === key);
  const groupNick = (c) => ((SETTINGS.group.nick || {})[c] || '').trim();
  function threadName(t) {
    if (t.key === 'group') return SETTINGS.group.name || 'Group chat';
    return ((SETTINGS.contacts[t.key] || {}).name || '').trim() || t.with;
  }

  // The app icon is the four of them, so it is also the group's picture.
  function groupAvatar() {
    const L = CHARS.Leon.color, Z = CHARS.Zoi.color, E = CHARS.Evan.color, H = CHARS.Hudson.color;
    return `<svg class="badge" viewBox="0 0 100 100" role="img" aria-label="Group">
      <circle cx="50" cy="50" r="47" fill="var(--paper)"/>
      <g stroke-width="2.4"><line x1="56" y1="57" x2="24" y2="18" stroke="${L}"/><line x1="56" y1="57" x2="18" y2="80" stroke="${E}"/><line x1="56" y1="57" x2="87" y2="64" stroke="${H}"/></g>
      <circle cx="56" cy="57" r="13.5" fill="var(--paper)" stroke="#C9A45C" stroke-width="1.6"/>
      <circle cx="24" cy="18" r="8.5" fill="${L}"/><circle cx="18" cy="80" r="5.8" fill="${E}"/><circle cx="87" cy="64" r="4.4" fill="${H}"/><circle cx="56" cy="57" r="8" fill="${Z}"/>
      <circle cx="50" cy="50" r="47" fill="none" stroke="var(--ink)" stroke-width="1.3"/></svg>`;
  }
  const threadAvatar = (t) => (t.key === 'group' ? groupAvatar() : badgeSVG(t.with));

  // A faint pattern behind each conversation, drawn from their own things.
  function chatBg(key) {
    const L = CHARS.Leon.color, Z = CHARS.Zoi.color, E = CHARS.Evan.color, H = CHARS.Hudson.color, G = '#C9A45C';
    let svg;
    if (key === 'leon') {
      svg = `<svg xmlns="http://www.w3.org/2000/svg" width="140" height="140"><g fill-opacity="0.32"><circle cx="22" cy="26" r="3.5" fill="${G}"/><circle cx="96" cy="58" r="3.5" fill="${Z}"/><circle cx="52" cy="104" r="3.5" fill="${Z}"/><circle cx="118" cy="122" r="3.5" fill="${G}"/></g><g fill="none" stroke-opacity="0.3" stroke-width="1.4"><circle cx="70" cy="18" r="5" stroke="${G}"/><circle cx="16" cy="80" r="5" stroke="${Z}"/></g></svg>`;
    } else if (key === 'evan') {
      const pet = (x, y, r) => `<g transform="translate(${x} ${y}) rotate(${r})"><path d="M-4 7 V10 M4 7 V10" stroke="${E}" stroke-width="1.6" stroke-linecap="round"/><rect x="-9" y="-8" width="18" height="15" rx="5" fill="${E}"/><circle cx="-3.6" cy="-1" r="2.5" fill="#EEEBE3"/><circle cx="3.6" cy="-1" r="2.5" fill="#EEEBE3"/></g>`;
      svg = `<svg xmlns="http://www.w3.org/2000/svg" width="150" height="150"><g opacity="0.26">${pet(30, 34, -12)}${pet(108, 82, 10)}${pet(52, 124, 4)}</g></svg>`;
    } else if (key === 'hudson') {
      const s = `fill="none" stroke="${H}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"`;
      svg = `<svg xmlns="http://www.w3.org/2000/svg" width="170" height="170"><g opacity="0.3">
        <g transform="translate(30 30) rotate(-35)"><path d="M-12 0 H10 M5 -4 L10 0 L5 4 M-12 0 L-15 -3 M-12 0 L-15 3" ${s}/></g>
        <g transform="translate(124 36)"><path d="M-8 8 V-2 C -8 -7, -4 -10, 0 -10 C 4 -10, 8 -7, 8 -2 V8 L5 6 L2.5 8 L0 6 L-2.5 8 L-5 6 Z" ${s}/></g>
        <path d="M60 112 C 52 98, 66 92, 70 102 C 74 112, 86 108, 82 96 C 79 86, 70 82, 76 72" ${s}/>
        <g transform="translate(138 128) rotate(12)"><path d="M-9 -4 H8 V0 H-1 L-3 7 H-8 L-6 0 H-9 Z" ${s}/></g></g></svg>`;
    } else {
      const mini = (x, y) => `<g transform="translate(${x} ${y}) scale(0.34)"><g stroke-width="2.4" stroke-opacity="0.9"><line x1="56" y1="57" x2="24" y2="18" stroke="${L}"/><line x1="56" y1="57" x2="18" y2="80" stroke="${E}"/><line x1="56" y1="57" x2="87" y2="64" stroke="${H}"/></g><circle cx="24" cy="18" r="8.5" fill="${L}"/><circle cx="18" cy="80" r="5.8" fill="${E}"/><circle cx="87" cy="64" r="4.4" fill="${H}"/><circle cx="56" cy="57" r="8" fill="${Z}"/></g>`;
      svg = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><g opacity="0.22">${mini(10, 12)}${mini(92, 90)}</g></svg>`;
    }
    return `background-image:url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
  }

  function parseMsgs(text) {
    const items = [];
    let who = null;
    for (const tk of scanLines(text)) {
      if (tk.scene) { items.push({ kind: 'scene', text: tk.scene.join('\n') }); continue; }
      if (tk.pics) { items.push({ kind: 'pics', names: tk.pics, who }); continue; }
      const t = tk.t;
      if (/^([一二三四五六七八九十百]+、|#{1,3}\s)/.test(t) || /^\d{1,2}[:：]\d{2}/.test(t) || /^\d{4}[.\-/年]\d{1,2}/.test(t)) { items.push({ kind: 'time', text: t.replace(/^#{1,3}\s/, '') }); continue; }
      const sp = speakerOf(t, true);
      if (sp) { who = sp.name; if (sp.rest) items.push({ kind: 'msg', who, text: sp.rest }); continue; }
      items.push({ kind: 'msg', who, text: t });
    }
    return items;
  }

  // The parts of a 1v1 (or side line) headed …｜短信, so the phone shows those texts too
  // while the file itself stays one continuous scene.
  function textingParts(d) {
    const parts = [];
    let cur = null;
    for (const raw of splitNotes(d.text).body.split('\n')) {
      const t = raw.trim();
      if (HEADING_RE.test(t)) {
        cur = TEXTING_RE.test(t) ? { heading: t.replace(/^#{1,3}\s/, ''), lines: [] } : null;
        if (cur) parts.push(cur);
        continue;
      }
      if (cur) cur.lines.push(raw);
    }
    return parts.map((x, i) => ({ heading: x.heading, text: x.lines.join('\n'), i }));
  }

  function threadSegments(key) {
    const segs = [];
    threadDocs(key).forEach((d) => { const sn = splitNotes(d.text); segs.push({ d, text: sn.body, head: sn.head, tail: sn.tail, from: null, mk: d.path }); });
    docsOf(['dialogue', 'side']).filter((d) => threadKeyOf(d) === key).forEach((d) => textingParts(d).forEach((p) =>
      segs.push({ d, text: p.text, head: [], tail: [], from: p.heading, mk: d.path + '§' + p.i })));
    segs.sort((a, b) => (a.d.ep ?? 1e9) - (b.d.ep ?? 1e9) || (a.d.part || 0) - (b.d.part || 0) || (a.from ? 1 : 0) - (b.from ? 1 : 0));
    return segs;
  }

  function threadSummary(key) {
    const segs = threadSegments(key);
    let count = 0, last = null;
    segs.forEach((g) => parseMsgs(g.text).forEach((m) => { if (m.kind === 'msg') { count++; last = m; } }));
    const numbered = segs.map((g) => g.d).filter((d) => d.ep != null);
    return { segs, docs: segs.map((g) => g.d), count, last, first: numbered[0] || null, latest: numbered[numbered.length - 1] || null };
  }

  function viewMessages() {
    const rows = THREADS.map((t) => {
      const s = threadSummary(t.key);
      const lastWho = s.last && s.last.who;
      const prefix = s.last && t.key === 'group' && lastWho ? (lastWho === 'Zoi' ? 'You' : groupNick(lastWho) || lastWho) + ': ' : s.last && lastWho === 'Zoi' ? 'You: ' : '';
      return `<a class="trow" href="#/messages/${t.key}">
        <span class="trow-av">${threadAvatar(t)}</span>
        <span class="trow-main"><span class="trow-name">${esc(threadName(t))}</span><span class="trow-last">${s.last ? esc(prefix + s.last.text) : '<em>No messages yet</em>'}</span></span>
        <span class="trow-meta">${s.latest ? esc(epName(s.latest)) : ''}</span>
      </a>`;
    }).join('');
    return shell(pageTitle('Messages', 'Zoi’s phone. The texts that the main line retells.') + `<div class="threads">${rows}</div>`);
  }

  function viewThread(key) {
    const t = THREADS.find((x) => x.key === key);
    if (!t) return viewMissing();
    const s = threadSummary(key);
    const pins = SETTINGS.pins[key] || [];
    const isGroup = key === 'group';
    const ids = new Map();
    const segs = s.segs.map((g, di) => {
      const d = g.d;
      const ch = chapterFor(d);
      let prev = null, n = 0, lastMan = null;
      PIC_CTX = { ep: d.ep, used: new Set() };
      const items = parseMsgs(g.text).map((m) => {
        if (m.kind === 'scene') { prev = null; return msgScene(m.text.split('\n'), lastMan); }
        if (m.kind === 'time') { prev = null; return `<p class="msg-time">${esc(m.text)}</p>`; }
        if (m.kind === 'pics') return picBubble(m.names, m.who === 'Zoi');
        n++;
        const mid = g.mk + '#' + n, id = `m${di}-${n}`;
        ids.set(mid, id);
        const me = m.who === 'Zoi';
        let from = '';
        if (isGroup && !me && m.who && m.who !== prev) {
          const nick = groupNick(m.who);
          from = `<p class="msg-from" style="color:${charColor(m.who)}"><b>${esc(nick || m.who)}</b>${nick ? `<span>${esc(m.who)}</span>` : ''}</p>`;
        }
        prev = m.who;
        if (CHARS[m.who] && m.who !== 'Zoi') lastMan = m.who;
        const pinned = pins.some((p) => p.mid === mid);
        return `${from}<p class="bubble${me ? ' me' : ''}${pinned ? ' pinned' : ''}${/^[（(][\s\S]*[)）]$/.test(m.text) ? ' aside' : ''}" id="${id}" data-act="bubble" data-mid="${esc(mid)}">${esc(m.text)}</p>`;
      }).join('');
      const label = [epName(d), d.date, d.title !== stripExt(d.path) ? d.title : ''].filter(Boolean).map(esc).join(' · ');
      const link = g.from ? `<a href="#/doc/${enc(d.id)}">1v1 ↗</a>` : ch ? `<a href="#/ch/${enc(ch.id)}">Main line ↗</a>` : '';
      return `<div class="seg"><span>${label}</span>${link}</div>${notesFold(g.head, g.tail)}${g.from ? '' : (() => { const pics = storyImagesFor(d.ep, d.part, 'message').filter((im) => !PIC_CTX.used.has(im.key)); return pics.length ? `<div class="strip chat-pics">${pics.map((im) => thumb(im)).join('')}</div>` : ''; })()}${items}`;
    }).join('');
    const pinHTML = pins.length ? `<div class="pins">${pins.map((p) => {
      const id = ids.get(p.mid);
      return `<button class="pin" data-act="goto-pin" data-target="${id || ''}"><span class="pin-k">Pinned</span><span class="pin-t">${esc(p.text)}</span></button>`;
    }).join('')}</div>` : '';
    const c = SETTINGS.contacts[key] || {};
    const sub = isGroup
      ? ORDER.map((x) => groupNick(x) || x).map(esc).join(', ')
      : esc(CHARS[t.with].full) + (c.theirs ? ` · saves Zoi as “${esc(c.theirs)}”` : '');
    const stats = s.count ? `${s.first ? 'Since ' + epName(s.first) + ' · ' : ''}${s.count} message${s.count === 1 ? '' : 's'}` : 'No messages yet';
    return `${topbar()}<main class="wrap chat-page">
      <div class="rbar"><a href="#/messages">← Messages</a><button class="linkbtn" data-act="edit-contact" data-thread="${key}">Edit</button></div>
      <div class="chat-head">
        <span class="chat-av">${threadAvatar(t)}</span>
        <h1>${esc(threadName(t))}</h1>
        <p class="chat-sub">${sub}</p>
        <p class="chat-stats">${stats}</p>
      </div>
      ${pinHTML}
      <div class="chat" style='${chatBg(key)}'>
        ${segs || '<p class="msg-scene">Messages filed under this conversation will show here. Put 类型：短信 and 人物：' + esc(isGroup ? '群聊' : t.label) + ' at the top of a file.</p>'}
      </div>
      <p class="note-line chat-hint">Tap a message to pin it to the top.</p>
    </main>${footer()}`;
  }

  function openContactEditor(key) {
    const t = THREADS.find((x) => x.key === key);
    if (!t) return;
    const field = (name, label, value, ph) => `<label class="field"><span>${label}</span><input name="${name}" type="text" value="${esc(value || '')}" placeholder="${esc(ph)}" autocomplete="off"></label>`;
    let inner;
    if (key === 'group') {
      inner = field('gname', 'Group name', SETTINGS.group.name, 'Group chat') +
        ORDER.map((c) => field('nick-' + c, `${c}’s name in the group`, groupNick(c), c)).join('');
    } else {
      const c = SETTINGS.contacts[key] || {};
      inner = field('name', `Zoi saved him as`, c.name, t.with) + field('theirs', `${t.with} saved Zoi as`, c.theirs, 'Zoi');
    }
    openOverlay(`<form class="sheet" data-act="save-contact" data-thread="${key}"><p class="sheet-k">${esc(t.label)}</p><h2>Names</h2>${inner}
      <span class="sheet-btns"><button class="btn sm" type="submit">Save</button><button class="linkbtn" type="button" data-act="close">Cancel</button></span></form>`, 'sheet-ov');
  }

  async function togglePin(key, mid, text) {
    const list = SETTINGS.pins[key] || (SETTINGS.pins[key] = []);
    const i = list.findIndex((p) => p.mid === mid);
    if (i >= 0) list.splice(i, 1); else list.push({ mid, text });
    if (!list.length) delete SETTINGS.pins[key];
    await saveSettings();
    rerenderInPlace();
    toast(i >= 0 ? 'Unpinned.' : 'Pinned to the top.');
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
    const links = NAV.map((x) => [x.href, x.name, x.n]);
    openOverlay(`<div class="top"><a class="logo" href="#/" data-act="close-nav">${ringSVG(26)}<span>Lines</span></a><button class="menubtn" data-act="close">CLOSE ×</button></div>
      <nav class="menu-list">${links.map(([h, n, num]) => `<a href="${h}" data-act="close-nav">${n}<sup>${num}</sup></a>`).join('')}</nav>
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
    const nm = q.match(/^第?(\d{1,4})(?:篇)?(?:[.．·\-－](\d{1,2}))?$/);
    const n = nm ? parseInt(nm[1], 10) : null;
    const part = nm && nm[2] ? parseInt(nm[2], 10) : null;
    const hits = [];
    const consider = (item, hay) => {
      if (n != null && (item.num === n || item.ep === n) && (part == null || item.part === part)) { hits.push({ item, snip: '' }); return; }
      const i = hay.toLowerCase().indexOf(low);
      if (i >= 0) hits.push({ item, snip: hay.slice(Math.max(0, i - 24), i + q.length + 40).replace(/\s+/g, ' ') });
    };
    LIB.chapters.forEach((c) => consider(c, c.title + ' ' + c.note + '\n' + Object.values(c.sections).join('\n') + '\n' + c.text));
    LIB.docs.forEach((d) => consider(d, d.title + ' ' + pairLabel(d.chars) + '\n' + d.text));
    out.innerHTML = hits.slice(0, 60).map(({ item, snip }) => {
      const href = item.kind === 'chapter' ? '#/ch/' + enc(item.id) : '#/doc/' + enc(item.id);
      const num = item.kind === 'chapter' ? item.label : item.ep != null ? pad(item.ep, 3) : '—';
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
      case 'main': html = viewMain(parts[1], params); break;
      case 'ch': html = viewChapter(parts[1]); break;
      case 'doc': html = viewDoc(parts[1]); break;
      case 'dialogues': html = viewList('dialogue', params); break;
      case 'side': html = viewList('side', params); break;
      case 'messages': html = parts[1] ? viewThread(parts[1]) : viewMessages(); break;
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
      case 'lightbox': LB_ORIGINAL = false; openLightbox(el.dataset.key); break;
      case 'lb-tone': LB_ORIGINAL = !LB_ORIGINAL; openLightbox(el.dataset.key); break;
      case 'lb-set': {
        const { field, v } = el.dataset;
        await updateImage(el.dataset.key, (o) => {
          if (field === 'kind') o.kind = v;
          if (field === 'person') o.people = o.people.includes(v) ? o.people.filter((x) => x !== v) : [...o.people, v];
          if (field === 'link') o.links = o.links.includes(v) ? o.links.filter((x) => x !== v) : [...o.links, v];
        });
        break;
      }
      case 'lb-remove':
        if (el.dataset.sure) { await deleteRecord(el.dataset.key); closeOverlay(); await loadLibrary(); await route(); toast('Removed from this device.'); }
        else { el.dataset.sure = '1'; el.textContent = 'Tap again to remove'; }
        break;
      case 'add-images': pickImages(); break;
      case 'char-add': charAdd(el.dataset.c); break;
      case 'totop': window.scrollTo({ top: 0, behavior: 'smooth' }); break;
      case 'gselect': SELECTING = !SELECTING; SELECTED.clear(); rerenderInPlace(); break;
      case 'gsel': {
        const key = el.dataset.key;
        if (SELECTED.has(key)) SELECTED.delete(key); else SELECTED.add(key);
        el.classList.toggle('picked', SELECTED.has(key));
        updateSelBar();
        break;
      }
      case 'gsel-all':
        document.querySelectorAll('.gallery [data-act="gsel"]').forEach((b) => { SELECTED.add(b.dataset.key); b.classList.add('picked'); });
        updateSelBar();
        break;
      case 'gsel-delete':
        if (!SELECTED.size) break;
        if (!el.dataset.sure) { el.dataset.sure = '1'; el.textContent = `Tap again to delete ${SELECTED.size}`; break; }
        { const n = SELECTED.size;
          await idb('readwrite', (st) => { SELECTED.forEach((k) => st.delete(k)); });
          SELECTED.clear(); SELECTING = false;
          await loadLibrary(); await route();
          toast(`Removed ${n} image${n === 1 ? '' : 's'} from this device.`); }
        break;
      case 'add-kind': PENDING.kind = el.dataset.kind; addSheet(); break;
      case 'add-person': { const c = el.dataset.c; PENDING.people = PENDING.people.includes(c) ? PENDING.people.filter((x) => x !== c) : [...PENDING.people, c]; addSheet(); break; }
      case 'add-save': await addPendingImages(); break;
      case 'tone-mode': store('lines:tone', el.dataset.mode); rerenderInPlace(); break;
      case 'bubble': {
        const open = document.querySelector('.bubble-act');
        const same = open && open.previousElementSibling === el;
        if (open) open.remove();
        document.querySelectorAll('.bubble.sel').forEach((b) => b.classList.remove('sel'));
        if (same) break;
        el.classList.add('sel');
        const key = (location.hash.split('/')[2] || '').split('?')[0];
        const pinned = (SETTINGS.pins[key] || []).some((p) => p.mid === el.dataset.mid);
        el.insertAdjacentHTML('afterend', `<span class="bubble-act${el.classList.contains('me') ? ' me' : ''}"><button class="chip" data-act="pin" data-mid="${esc(el.dataset.mid)}">${pinned ? 'Unpin' : 'Pin'}</button></span>`);
        break;
      }
      case 'pin': {
        const key = (location.hash.split('/')[2] || '').split('?')[0];
        const b = document.querySelector(`.bubble[data-mid="${CSS.escape(el.dataset.mid)}"]`);
        await togglePin(key, el.dataset.mid, b ? b.textContent : '');
        break;
      }
      case 'goto-pin': {
        const t = el.dataset.target && document.getElementById(el.dataset.target);
        if (!t) { toast('This message is no longer in the file.'); break; }
        t.scrollIntoView({ behavior: 'smooth', block: 'center' });
        t.classList.add('flash'); setTimeout(() => t.classList.remove('flash'), 1600);
        break;
      }
      case 'edit-contact': openContactEditor(el.dataset.thread); break;
      case 'del':
        await deleteRecord(el.dataset.key);
        await loadLibrary(); route(); toast('Removed.');
        break;
      case 'clear':
        el.dataset.act = 'clear-confirm';
        el.textContent = 'Tap again to remove everything';
        setTimeout(() => { if (el.isConnected) { el.dataset.act = 'clear'; el.textContent = 'Remove everything from this device'; } }, 4000);
        break;
      case 'edit-tags': {
        const ch = CURRENT_CH;
        if (!ch) break;
        const value = [ch.key ? '重点' : '', ...ch.tags].filter(Boolean).join('｜');
        const box = el.closest('.rmeta');
        box.insertAdjacentHTML('afterend', `<form class="tag-form" data-act="save-tags"><label for="tag-input">Tags, separated by ｜ — 重点 adds the gold mark</label><input id="tag-input" type="text" value="${esc(value)}" autocomplete="off"><span><button class="btn sm" type="submit">Save</button><button class="linkbtn" type="button" data-act="cancel-tags">Cancel</button></span></form>`);
        el.remove();
        document.getElementById('tag-input').focus();
        break;
      }
      case 'cancel-tags': rerenderInPlace(); break;
      case 'color-reset': {
        const k = el.dataset.c;
        setSlot(k, CHARS[k] ? DEFAULT_COLORS[k] : DEFAULT_ACCENT[k]);
        paintSlot(k);
        break;
      }
      case 'preset': {
        const p = PRESETS[+el.dataset.i];
        if (p) { SLOTS.forEach((k) => setSlot(k, p.colors[k])); rerenderInPlace(); }
        break;
      }
      case 'clear-confirm':
        await clearRecords(); await loadLibrary(); route(); toast('The library on this device is empty.');
        break;
    }
  });

  function updateSelBar() {
    const c = document.querySelector('.selcount'), d = document.querySelector('[data-act="gsel-delete"]');
    if (c) c.textContent = `${SELECTED.size} selected`;
    if (d) { d.disabled = !SELECTED.size; delete d.dataset.sure; d.textContent = 'Delete'; }
  }

  // Back to top, once the page has been scrolled a good way down.
  const $top = document.createElement('button');
  $top.className = 'totop'; $top.type = 'button'; $top.dataset.act = 'totop'; $top.setAttribute('aria-label', 'Back to top');
  $top.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M12 19V5M5.5 11.5 12 5l6.5 6.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  document.body.appendChild($top);
  let topTick = false;
  window.addEventListener('scroll', () => {
    if (topTick) return;
    topTick = true;
    requestAnimationFrame(() => { $top.classList.toggle('show', window.scrollY > window.innerHeight * 1.2); topTick = false; });
  }, { passive: true });

  function rerenderInPlace() {
    const y = window.scrollY;
    route().then(() => window.scrollTo(0, y));
  }

  function getSlot(k) { return CHARS[k] ? CHARS[k].color : ACCENT[k]; }

  // Saves a color without redrawing the page, so the system color picker stays open while it is used.
  function setSlot(k, value) {
    if (!HEX_RE.test(value || '')) return false;
    const v = ('#' + value.replace('#', '')).toUpperCase();
    if (CHARS[k]) { CHARS[k].color = v; store('lines:color:' + k, v); }
    else if (k in ACCENT) { ACCENT[k] = v; store('lines:accent:' + k, v); applyAccents(); }
    else return false;
    return true;
  }

  function paintSlot(k, from) {
    const v = getSlot(k);
    document.querySelectorAll(`[data-swatch="${k}"]`).forEach((el) => { el.style.background = v; });
    document.querySelectorAll(`[data-preview="${k}"]`).forEach((el) => { el.style.color = v; });
    document.querySelectorAll(`[data-preview-bg="${k}"]`).forEach((el) => { el.style.background = v; });
    document.querySelectorAll(`input[data-slot="${k}"]`).forEach((el) => { if (el !== from) el.value = v.toLowerCase(); });
    document.querySelectorAll(`input[data-hex="${k}"]`).forEach((el) => { if (el !== from) el.value = v; el.classList.remove('bad'); });
    document.querySelectorAll('.preset.on').forEach((el) => el.classList.remove('on'));
  }

  function onColorInput(e) {
    const picker = e.target.closest('input[data-slot]');
    if (picker) { if (setSlot(picker.dataset.slot, picker.value)) paintSlot(picker.dataset.slot, picker); return; }
    const hex = e.target.closest('input[data-hex]');
    if (hex) {
      const v = hex.value.trim();
      if (setSlot(hex.dataset.hex, v)) paintSlot(hex.dataset.hex, hex);
      else hex.classList.toggle('bad', v.replace('#', '').length >= 6);
    }
  }
  document.addEventListener('input', onColorInput);
  document.addEventListener('change', onColorInput);
  document.addEventListener('focusout', (e) => {
    const hex = e.target.closest && e.target.closest('input[data-hex]');
    if (hex) { hex.value = getSlot(hex.dataset.hex); hex.classList.remove('bad'); }
  });

  document.addEventListener('submit', async (e) => {
    const lbForm = e.target.closest('[data-act="lb-save"]');
    if (lbForm) {
      e.preventDefault();
      const epRaw = lbForm.querySelector('[name="ep"]').value.trim();
      const m = epRaw.match(/(\d{1,4})(?:\s*[.．]\s*(\d{1,2}))?/);
      const cap = lbForm.querySelector('[name="caption"]').value.trim();
      await updateImage(lbForm.dataset.key, (o) => { o.ep = m ? +m[1] : null; o.part = m && m[2] ? +m[2] : null; o.caption = cap; });
      toast('Saved. Export when you want this in your Files too.', 3000);
      return;
    }
    const contact = e.target.closest('[data-act="save-contact"]');
    if (contact) {
      e.preventDefault();
      const key = contact.dataset.thread;
      const v = (n) => ((contact.querySelector(`[name="${n}"]`) || {}).value || '').trim();
      if (key === 'group') {
        SETTINGS.group.name = v('gname');
        ORDER.forEach((c) => { const x = v('nick-' + c); if (x) SETTINGS.group.nick[c] = x; else delete SETTINGS.group.nick[c]; });
      } else {
        SETTINGS.contacts[key] = { name: v('name'), theirs: v('theirs') };
      }
      await saveSettings();
      closeOverlay();
      rerenderInPlace();
      toast('Saved. Export when you want this in your Files too.', 3000);
      return;
    }
    const tagForm = e.target.closest('[data-act="save-tags"]');
    if (tagForm) {
      e.preventDefault();
      if (CURRENT_CH) saveTags(CURRENT_CH, tagForm.querySelector('input').value);
      return;
    }
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

  window.addEventListener('hashchange', () => {
    if (!location.hash.startsWith('#/gallery')) { SELECTING = false; SELECTED.clear(); } if (!$overlay.hidden) closeOverlay(); route(); });

  // ---------- Start ----------

  (async () => {
    try { if (navigator.storage && navigator.storage.persist) await navigator.storage.persist(); } catch (e) { /* ignore */ }
    try { await loadLibrary(); } catch (e) { toast('Could not open storage: ' + e.message, 6000); }
    // Spot was tried and taken out; clear the outlines it saved.
    idb('readwrite', (st) => st.clear(), 'masks').catch(() => {});
    route();
    if ('serviceWorker' in navigator && location.protocol === 'https:') {
      // When a new version takes over, reload once so the new design shows straight away.
      const hadController = !!navigator.serviceWorker.controller;
      let reloaded = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (hadController && !reloaded) { reloaded = true; location.reload(); }
      });
      navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' })
        .then((reg) => {
          reg.update().catch(() => {});
          document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}); });
        })
        .catch(() => {});
    }
  })();
})();
