/* ═══════════════════════════════════════════════════════════
   THE ZEITGEIST — zeitgeist.js
   All-users collective drift space. Self-contained.
   ═══════════════════════════════════════════════════════════ */

'use strict';

// ─────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────
const SUPABASE_URL  = 'https://rbqwoiewrgcfbvotnaoj.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJicXdvaWV3cmdjZmJ2b3RuYW9qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5ODcyNTMsImV4cCI6MjA5MDU2MzI1M30.GdYT18ejTA7GhpjAi34Gtnuu5lYrlyivhaJsluPieh0';
const HEADERS       = { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON, 'Authorization': `Bearer ${SUPABASE_ANON}` };


const MOODS = [
  { name: 'Happy', c: ['#ffe045', '#f07a10'] },
  { name: 'Good',  c: ['#3ddfc8', '#1aaa8c'] },
  { name: 'Fine',  c: ['#6ab8f7', '#3a7ee8'] },
  { name: 'Bad',   c: ['#a86ef5', '#5c28d4'] },
  { name: 'Busy',  c: ['#ff6040', '#e8185a'] },
];

const PARTICLE_PALETTE = [
  'rgba(180,150,255,', 'rgba(140,200,240,',
  'rgba(200,160,255,', 'rgba(120,230,200,',
  'rgba(220,180,255,', 'rgba(160,210,255,',
  'rgba(255,180,220,',
];

// ─────────────────────────────────────────────────────────────
// UTILITIES  (duplicated from app.js to keep pages independent)
// ─────────────────────────────────────────────────────────────
const rand  = (a, b) => Math.random() * (b - a) + a;
const lerp  = (a, b, t) => a + (b - a) * t;
const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr + 'T12:00:00')
    .toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateLong(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr + 'T12:00:00')
    .toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

function escHtml(s) {
  const d = document.createElement('div');
  d.appendChild(document.createTextNode(String(s)));
  return d.innerHTML;
}

function normalizeMemory(mem) {
  if (!mem) return mem;
  if (mem.entry) return mem;
  const first = Array.isArray(mem.qa)
    ? mem.qa.find(i => i && typeof i.a === 'string' && i.a.trim())
    : null;
  return { ...mem, entry: first ? first.a.trim() : '' };
}


// ─────────────────────────────────────────────────────────────
// DATA
// ─────────────────────────────────────────────────────────────
async function loadAllMemories() {
  try {
    // Fetch all memories, newest-first, with a high row cap
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/memories?select=id,date,time,entry,qa,mood,sketch,ts,username,location&order=ts.desc`,
      { headers: HEADERS }
    );
    if (!r.ok) return [];
    const rows = await r.json();
    return rows.map(normalizeMemory);
  } catch { return []; }
}

// ─────────────────────────────────────────────────────────────
// PARTICLE
// ─────────────────────────────────────────────────────────────
class Particle {
  constructor(W, H) { this.W = W; this.H = H; this.init(true); }

  init(anywhere = false) {
    this.x    = rand(0, this.W);
    this.y    = anywhere ? rand(0, this.H) : this.H + 5;
    this.r    = rand(0.4, 2.4);
    this.vx   = rand(-0.18, 0.18);
    this.vy   = rand(-0.08, -0.38);
    this.maxA = rand(0.08, 0.55);
    this.a    = anywhere ? rand(0, this.maxA) : 0;
    this.ph   = rand(0, Math.PI * 2);
    this.ps   = rand(0.01, 0.028);
    this.col  = PARTICLE_PALETTE[Math.floor(Math.random() * PARTICLE_PALETTE.length)];
    this.age  = anywhere ? rand(0, 0.9) : 0;
  }

  tick() {
    this.x += this.vx; this.y += this.vy;
    this.ph += this.ps; this.age += 0.0018;
    if (this.y < -10 || this.x < -10 || this.x > this.W + 10 || this.age > 1) this.init();
  }

  draw(ctx) {
    const pulse = 0.5 + 0.5 * Math.sin(this.ph);
    const a = this.maxA * pulse * (1 - this.age * 0.55);
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
    ctx.fillStyle = `${this.col}${a.toFixed(2)})`;
    ctx.fill();
  }
}

// ─────────────────────────────────────────────────────────────
// MEMORY OBJECT — same visual logic as app.js MemObj
// ─────────────────────────────────────────────────────────────
class MemObj {
  constructor(mem, W, H) {
    this.mem  = mem;
    this.W = W; this.H = H;

    this.baseBw = rand(110, 155);
    this.bw     = this.baseBw;
    this.bh     = this.bw * 0.72;

    this.x  = rand(this.bw, W - this.bw);
    this.y  = rand(this.bh, H - this.bh);

    this.vx = (Math.random() - 0.5) * 0.60;
    this.vy = (Math.random() - 0.5) * 0.30;
    if (Math.abs(this.vx) < 0.06) this.vx = this.vx < 0 ? -0.10 : 0.10;

    this.ang  = rand(-0.07, 0.07);
    this.angV = (Math.random() - 0.5) * 0.0008;

    this.oscPh  = rand(0, Math.PI * 2);
    this.oscSpd = rand(0.007, 0.013);

    this.opacity    = 0;
    this.tOpacity   = 0.55;
    this.ageScore   = 0.5;
    this.clickCount = 0;
    this.scale      = 1;
    this.hovered    = false;

    this.pulsePh  = rand(0, Math.PI * 2);
    this.pulseSpd = rand(0.004, 0.009);

    this.img = null; this.loaded = false;
    if (mem.sketch) {
      this.img = new Image();
      this.img.onload = () => { this.loaded = true; };
      this.img.src = mem.sketch;
    }

    this.glowCol = mem.mood ? mem.mood.c[0] : '#8b7db5';
  }

  setAgeScore(score) {
    this.ageScore = score;
    const factor  = lerp(1.25, 2.25, score);
    const boosted = Math.min(factor + this.clickCount * 0.2, 1.5);
    this.bw = this.baseBw * boosted;
    this.bh = this.bw * 0.72;
    this.tOpacity = clamp(lerp(0.22, 0.85, score + this.clickCount * 0.08), 0.22, 0.92);
  }

  bump() {
    this.clickCount++;
    const factor  = lerp(1.25, 2.25, this.ageScore);
    const boosted = Math.min(factor + this.clickCount * 0.2, 1.5);
    this.bw = this.baseBw * boosted;
    this.bh = this.bw * 0.72;
    this.tOpacity = clamp(this.tOpacity + 0.08, 0.22, 0.92);
  }

  contains(px, py, pad = 0) {
    const hw = (this.bw * this.scale) / 2 + pad;
    const hh = (this.bh * this.scale) / 2 + pad;
    return px >= this.x - hw && px <= this.x + hw && py >= this.y - hh && py <= this.y + hh;
  }

  update(W, H) {
    this.W = W; this.H = H;
    this.opacity  = lerp(this.opacity, this.tOpacity, 0.025);
    this.pulsePh += this.pulseSpd;
    const breathe = 1 + 0.025 * Math.sin(this.pulsePh);
    this.scale    = lerp(this.scale, (this.hovered ? 1.13 : 1) * breathe, 0.08);

    this.x += this.vx; this.y += this.vy;
    this.oscPh += this.oscSpd;
    this.y += Math.sin(this.oscPh) * 0.12;
    this.ang += this.angV;
    this.ang = clamp(this.ang, -0.11, 0.11);
    if (Math.abs(this.ang) > 0.10) this.angV *= -0.6;

    const pad = this.bw * 0.7;
    if (this.x < pad)         this.vx += 0.012;
    if (this.x > W - pad)     this.vx -= 0.012;
    if (this.y < pad * 0.55)  this.vy += 0.009;
    if (this.y > H - pad * 0.55) this.vy -= 0.009;

    this.vx *= 0.999; this.vy *= 0.999;
    if (Math.abs(this.vx) < 0.05) this.vx += (Math.random() - 0.5) * 0.06;
    if (Math.abs(this.vy) < 0.025) this.vy += (Math.random() - 0.5) * 0.04;
  }

  draw(ctx) {
    if (this.opacity < 0.01) return;
    const w = this.bw * this.scale, h = this.bh * this.scale;
    const hw = w / 2, hh = h / 2;
    const gc = this.glowCol;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.ang);

    if (this.loaded && this.img) {
      ctx.globalAlpha = this.opacity * 0.38;
      ctx.shadowColor = gc;
      ctx.shadowBlur  = this.hovered ? 100 : 58;
      ctx.drawImage(this.img, -hw, -hh, w, h);

      ctx.globalAlpha = this.opacity * 0.58;
      ctx.shadowBlur  = this.hovered ? 50 : 26;
      ctx.drawImage(this.img, -hw, -hh, w, h);

      ctx.shadowBlur  = 0;
      ctx.globalAlpha = this.opacity;
      ctx.drawImage(this.img, -hw, -hh, w, h);
    } else if (!this.img) {
      // fallback: glowing frosted card for text-only memories
      const radius = 10;
      ctx.globalAlpha = this.opacity * 0.18;
      ctx.shadowColor = gc;
      ctx.shadowBlur  = this.hovered ? 80 : 40;
      ctx.fillStyle   = gc;
      ctx.beginPath();
      ctx.roundRect(-hw, -hh, w, h, radius);
      ctx.fill();

      ctx.globalAlpha = this.opacity * 0.45;
      ctx.shadowBlur  = 0;
      ctx.strokeStyle = gc;
      ctx.lineWidth   = this.hovered ? 1.8 : 1.1;
      ctx.beginPath();
      ctx.roundRect(-hw, -hh, w, h, radius);
      ctx.stroke();
    }

    ctx.restore();
  }
}

// ─────────────────────────────────────────────────────────────
// WORLD RENDERER
// ─────────────────────────────────────────────────────────────
class World {
  constructor(canvas) {
    this.cv  = canvas;
    this.ctx = canvas.getContext('2d');
    this.W   = canvas.width;
    this.H   = canvas.height;
    this.objects   = [];
    this.particles = [];
    this.glowOrbs  = [];
    this._initOrbs();
    this._initParticles();
  }

  resize(W, H) {
    this.W = W; this.H = H;
    this._initOrbs();
    this._initParticles();
  }

  _initOrbs() {
    this.glowOrbs = [
      { rx:.18, ry:.25, pr:.38, col:'#3a1a6e', ph: rand(0, Math.PI*2), spd:.0028 },
      { rx:.75, ry:.15, pr:.32, col:'#0e4858', ph: rand(0, Math.PI*2), spd:.0038 },
      { rx:.80, ry:.70, pr:.44, col:'#2a0e5c', ph: rand(0, Math.PI*2), spd:.0022 },
      { rx:.12, ry:.75, pr:.34, col:'#0e4840', ph: rand(0, Math.PI*2), spd:.0033 },
      { rx:.50, ry:.48, pr:.24, col:'#4a1858', ph: rand(0, Math.PI*2), spd:.0045 },
      { rx:.38, ry:.85, pr:.28, col:'#1a3a68', ph: rand(0, Math.PI*2), spd:.0030 },
    ];
  }

  _initParticles() {
    const n = Math.min(Math.floor(this.W * this.H / 11000), 130);
    this.particles = Array.from({ length: n }, () => new Particle(this.W, this.H));
  }

  add(mem) {
    this.objects.push(new MemObj(mem, this.W, this.H));
  }

  addAll(mems) {
    mems.forEach(m => this.objects.push(new MemObj(m, this.W, this.H)));
    this._recomputeAgeScores();
  }

  bump(id) {
    const obj = this.objects.find(o => o.mem.id === id);
    if (obj) obj.bump();
  }

  _recomputeAgeScores() {
    const all = this.objects.filter(o => o.mem.ts);
    if (!all.length) return;
    const tsNums = all.map(o => typeof o.mem.ts === 'number' ? o.mem.ts : new Date(o.mem.ts).getTime());
    const min = Math.min(...tsNums), max = Math.max(...tsNums);
    const range = max - min || 1;
    all.forEach((o, i) => o.setAgeScore((tsNums[i] - min) / range));
  }

  hitTest(x, y, pad = 0) {
    for (let i = this.objects.length - 1; i >= 0; i--) {
      if (this.objects[i].contains(x, y, pad)) return this.objects[i];
    }
    // nearest fallback
    let nearest = null, nearestD = Infinity;
    this.objects.forEach(o => {
      const d = Math.hypot(x - o.x, y - o.y);
      const reach = Math.max(o.bw, o.bh) * 0.45 + pad;
      if (d <= reach && d < nearestD) { nearest = o; nearestD = d; }
    });
    return nearest;
  }

  hover(x, y) {
    let any = false;
    this.objects.forEach(o => { o.hovered = o.contains(x, y); if (o.hovered) any = true; });
    this.cv.style.cursor = any ? 'pointer' : 'default';
    return this.objects.find(o => o.hovered) || null;
  }

  render() {
    const ctx = this.ctx;
    const W = this.W, H = this.H;

    ctx.clearRect(0, 0, W, H);

    const bg = ctx.createRadialGradient(W*.5, H*1.1, 0, W*.5, H*.3, Math.max(W,H));
    bg.addColorStop(0, '#14083a'); bg.addColorStop(0.4, '#0a041e'); bg.addColorStop(1, '#05030e');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

    ctx.save(); ctx.globalCompositeOperation = 'screen';
    this.glowOrbs.forEach(o => {
      o.ph += o.spd;
      const pulse = 0.68 + 0.32 * Math.sin(o.ph);
      const cx = o.rx * W + Math.sin(o.ph * 0.7) * W * 0.025;
      const cy = o.ry * H + Math.cos(o.ph * 0.5) * H * 0.025;
      const r  = o.pr * Math.max(W, H) * pulse;
      const g  = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, o.col + 'ff'); g.addColorStop(0.45, o.col + '70'); g.addColorStop(1, o.col + '00');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    });
    ctx.restore();

    this.particles.forEach(p => { p.tick(); p.draw(ctx); });
    this.objects.forEach(o => { o.update(W, H); o.draw(ctx); });
  }
}

// ─────────────────────────────────────────────────────────────
// ZEITGEIST APP
// ─────────────────────────────────────────────────────────────
class ZeitgeistApp {
  constructor() {
    this.memories = [];
    this.cvEl     = document.getElementById('worldCanvas');
    this.world    = new World(this.cvEl);
    this._resize();
    window.addEventListener('resize', () => this._resize());
    this._initCaustics();
    this._loop();
    this._bindUI();
    this._load();
  }

  _resize() {
    this.cvEl.width  = window.innerWidth;
    this.cvEl.height = window.innerHeight;
    this.world.resize(window.innerWidth, window.innerHeight);
  }

  _loop() {
    const tick = () => { this.world.render(); requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  }

  _initCaustics() {
    const wrap = document.getElementById('caustics');
    if (!wrap) return;
    for (let i = 0; i < 14; i++) {
      const s = document.createElement('div');
      s.className = 'shaft';
      s.style.left = `${2 + i * 7}%`;
      s.style.setProperty('--dur', `${8 + Math.random() * 7}s`);
      s.style.setProperty('--del', `${-(Math.random() * 10)}s`);
      s.style.setProperty('--r1', `${-2 - Math.random() * 5}deg`);
      s.style.setProperty('--r2', `${2 + Math.random() * 5}deg`);
      wrap.appendChild(s);
    }
  }

  async _load() {
    const all = await loadAllMemories();
    this.memories = all;
    this.world.addAll(this.memories);

    // Update count label
    const countEl = document.getElementById('zCount');
    if (countEl) {
      const userCount = new Set(all.map(m => m.username)).size;
      countEl.textContent = `${all.length} memories · ${userCount} people`;
    }

    // Hint
    setTimeout(() => {
      const hint = document.getElementById('worldHint');
      if (hint) {
        hint.classList.add('visible');
        setTimeout(() => hint.classList.remove('visible'), 4000);
      }
    }, 1800);
  }

  _openMoodPanel() {
    const panel = document.getElementById('zMoodPanel');
    panel.classList.add('open');
    panel.setAttribute('aria-hidden', 'false');

    const btnsWrap = document.getElementById('zMoodFilterBtns');
    const gridEl   = document.getElementById('zMoodMemGrid');

    btnsWrap.innerHTML = '';
    const selected = MOODS[0].name;

    MOODS.forEach(m => {
      const btn = document.createElement('button');
      btn.className = 'mood-filter-btn' + (m.name === selected ? ' active' : '');
      btn.textContent = m.name;
      btn.style.setProperty('--mc', m.c[0]);
      btn.addEventListener('click', () => {
        btnsWrap.querySelectorAll('.mood-filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderMoodGrid(m.name);
      });
      btnsWrap.appendChild(btn);
    });

    const renderMoodGrid = moodName => {
      gridEl.innerHTML = '';
      const matches = this.memories.filter(m => m.mood && m.mood.name === moodName)
        .sort((a, b) => new Date(b.ts) - new Date(a.ts));

      if (!matches.length) {
        gridEl.innerHTML = `<div class="weekly-empty">no ${moodName.toLowerCase()} memories yet</div>`;
        return;
      }

      matches.forEach(mem => {
        const thumb = document.createElement('div');
        thumb.className = 'week-thumb';
        if (mem.sketch) {
          thumb.innerHTML = `<img src="${mem.sketch}" alt="${formatDate(mem.date)}">`;
        } else {
          thumb.style.background = `linear-gradient(135deg,${mem.mood.c[0]}22,${mem.mood.c[1]}22)`;
        }
        const meta = document.createElement('div');
        meta.className = 'week-thumb-date';
        meta.textContent = `${mem.username || 'anon'} · ${formatDate(mem.date)}`;
        thumb.appendChild(meta);
        thumb.addEventListener('click', () => {
          this._closeMoodPanel();
          this._openPopup(mem);
        });
        gridEl.appendChild(thumb);
      });
    };

    renderMoodGrid(selected);
  }

  _closeMoodPanel() {
    const panel = document.getElementById('zMoodPanel');
    panel.classList.remove('open');
    panel.setAttribute('aria-hidden', 'true');
  }

  _openMapPanel() {
    const panel = document.getElementById('zMapPanel');
    panel.classList.add('open');
    panel.setAttribute('aria-hidden', 'false');

    requestAnimationFrame(() => {
      const container = document.getElementById('zMapContainer');
      const located = this.memories.filter(m => m.location && m.location.lat != null);

      if (!this._leafletMap) {
        this._leafletMap = L.map(container, { zoomControl: true }).setView([40.7128, -74.006], 11);

        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
          attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
          maxZoom: 19,
        }).addTo(this._leafletMap);

        this._mapMarkers = L.layerGroup().addTo(this._leafletMap);
      }

      this._mapMarkers.clearLayers();

      if (located.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'map-empty';
        empty.textContent = 'no memories with location data yet';
        container.appendChild(empty);
        return;
      }

      // Ensure hover card exists
      let hoverCard = document.getElementById('zMapHover');
      if (!hoverCard) {
        hoverCard = document.createElement('div');
        hoverCard.id = 'zMapHover';
        hoverCard.className = 'z-map-hover';
        document.body.appendChild(hoverCard);
      }

      const showHover = (mem, e) => {
        const moodName  = mem.mood ? mem.mood.name : '';
        const dateLabel = formatDate(mem.date);
        const preview   = (mem.entry || '').slice(0, 100) + ((mem.entry || '').length > 100 ? '…' : '');
        hoverCard.innerHTML =
          `<div class="z-mh-header">` +
            `<span class="z-mh-user">${escHtml(mem.username || 'anonymous')}</span>` +
            `<span class="z-mh-sep">·</span>` +
            `<span class="z-mh-date">${escHtml(dateLabel)}</span>` +
            (moodName ? `<span class="z-mh-sep">·</span><span class="z-mh-mood">${escHtml(moodName)}</span>` : '') +
          `</div>` +
          (mem.sketch ? `<img class="z-mh-sketch" src="${mem.sketch}" alt="sketch">` : '') +
          (preview ? `<div class="z-mh-entry">${escHtml(preview)}</div>` : '');
        hoverCard.style.display = 'block';
        positionHover(e);
      };

      const positionHover = (e) => {
        const x = e.originalEvent.clientX, y = e.originalEvent.clientY;
        hoverCard.style.left = `${x + 16}px`;
        hoverCard.style.top  = `${y - 10}px`;
      };

      const hideHover = () => { hoverCard.style.display = 'none'; };

      const bounds = [];
      located.forEach(mem => {
        const { lat, lng } = mem.location;
        const moodColor = mem.mood ? mem.mood.c[0] : '#b48ef5';

        const icon = L.divIcon({
          className: 'map-marker',
          html: `<div class="map-marker-dot" style="background:${moodColor}"></div>`,
          iconSize: [12, 12],
          iconAnchor: [6, 6],
        });

        const marker = L.marker([lat, lng], { icon });
        marker.on('mouseover', e => showHover(mem, e));
        marker.on('mousemove', positionHover);
        marker.on('mouseout',  hideHover);
        marker.on('click', () => {
          hideHover();
          this._closeMapPanel();
          setTimeout(() => this._openPopup(mem), 320);
        });
        this._mapMarkers.addLayer(marker);
        bounds.push([lat, lng]);
      });

      if (bounds.length === 1) {
        this._leafletMap.setView(bounds[0], 10);
      }

      setTimeout(() => this._leafletMap.invalidateSize(), 80);
    });
  }

  _closeMapPanel() {
    const panel = document.getElementById('zMapPanel');
    panel.classList.remove('open');
    panel.setAttribute('aria-hidden', 'true');
  }

  _bindUI() {
    const tooltip = document.getElementById('zTooltip');

    // Canvas: hover → tooltip, click → bump + popup
    this.cvEl.addEventListener('mousemove', e => {
      const r = this.cvEl.getBoundingClientRect();
      const obj = this.world.hover(e.clientX - r.left, e.clientY - r.top);

      if (obj) {
        const mem = obj.mem;
        const moodStr  = mem.mood ? mem.mood.name : '';
        const dateStr  = formatDate(mem.date);
        const userStr  = mem.username || '';
        tooltip.innerHTML =
          `<span class="z-tt-user">${escHtml(userStr)}</span>` +
          `<span class="z-tt-sep">·</span>` +
          `<span class="z-tt-date">${escHtml(dateStr)}</span>` +
          (moodStr ? `<span class="z-tt-sep">·</span><span class="z-tt-mood">${escHtml(moodStr)}</span>` : '');
        tooltip.style.left = `${e.clientX + 14}px`;
        tooltip.style.top  = `${e.clientY - 10}px`;
        tooltip.classList.add('visible');
      } else {
        tooltip.classList.remove('visible');
      }
    });

    this.cvEl.addEventListener('mouseleave', () => tooltip.classList.remove('visible'));

    this.cvEl.addEventListener('pointerdown', e => {
      const r   = this.cvEl.getBoundingClientRect();
      const obj = this.world.hitTest(e.clientX - r.left, e.clientY - r.top, 42);
      if (!obj) return;
      e.preventDefault();
      e.stopPropagation();
      this.world.bump(obj.mem.id);
      tooltip.classList.remove('visible');
      this._openPopup(obj.mem);
    });

    // Mood tab
    document.getElementById('zMoodTabBtn').addEventListener('click', () => this._openMoodPanel());
    document.querySelectorAll('.js-close-zmood').forEach(el =>
      el.addEventListener('click', () => this._closeMoodPanel()));

    // Map tab
    document.getElementById('zMapTabBtn').addEventListener('click', () => this._openMapPanel());
    document.querySelectorAll('.js-close-zmap').forEach(el =>
      el.addEventListener('click', () => this._closeMapPanel()));

    // Popup close
    document.querySelectorAll('.js-close-popup').forEach(el =>
      el.addEventListener('click', e => this._closePopup(e)));

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') { this._closePopup(); this._closeMapPanel(); this._closeMoodPanel(); }
    });
  }

  _openPopup(mem) {
    const body    = document.getElementById('popupBody');
    const dateLong = formatDateLong(mem.date);
    const timeStr  = mem.time ? `<span class="pop-time">${escHtml(mem.time)}</span>` : '';

    let html = `<div class="pop-date">${dateLong}${timeStr}</div>`;
    html += `<div class="z-pop-author">— ${escHtml(mem.username || 'anonymous')}</div>`;

    if (mem.sketch) html += `<img class="pop-sketch" src="${mem.sketch}" alt="sketch">`;

    if (mem.images && mem.images.length) {
      html += `<div class="pop-images">`;
      mem.images.forEach((src, i) => { html += `<img class="pop-photo" src="${src}" alt="photo ${i+1}">`; });
      html += `</div>`;
    }

    if (mem.location) {
      const locName = mem.location.name || `${mem.location.lat.toFixed(4)}, ${mem.location.lng.toFixed(4)}`;
      html += `<div class="pop-location">&#x2316; ${escHtml(locName)}</div>`;
    }

    const entry = (mem.entry || '').trim();
    if (entry) {
      html += `<div class="pop-qa"><div class="pop-q">journal entry</div><div class="pop-a">${escHtml(entry)}</div></div>`;
    } else if (Array.isArray(mem.qa)) {
      mem.qa.forEach(({ q, a }) => {
        if (!a) return;
        html += `<div class="pop-qa"><div class="pop-q">${escHtml(q)}</div><div class="pop-a">${escHtml(a)}</div></div>`;
      });
    }

    body.innerHTML = html;

    if (mem.audio) {
      const foot = document.createElement('div');
      foot.className = 'popup-foot';
      const wrap = document.createElement('div');
      wrap.className = 'pop-audio-wrap';
      const btn = document.createElement('button');
      btn.className = 'pop-audio-btn'; btn.innerHTML = '&#9654;';
      const bar  = document.createElement('div'); bar.className = 'pop-audio-bar';
      const prog = document.createElement('div'); prog.className = 'pop-audio-progress';
      bar.appendChild(prog); wrap.appendChild(btn); wrap.appendChild(bar); foot.appendChild(wrap);
      body.appendChild(foot);
      let audioEl = null;
      btn.addEventListener('click', () => {
        if (audioEl && !audioEl.paused) { audioEl.pause(); btn.innerHTML = '&#9654;'; return; }
        if (!audioEl) {
          audioEl = new Audio(mem.audio);
          audioEl.ontimeupdate = () => { if (audioEl.duration) prog.style.width = `${(audioEl.currentTime/audioEl.duration)*100}%`; };
          audioEl.onended = () => { btn.innerHTML = '&#9654;'; prog.style.width = '100%'; };
        }
        audioEl.play(); btn.innerHTML = '&#9646;&#9646;';
      });
    }

    const popup = document.getElementById('memoryPopup');
    this._popupOpenedAt = Date.now();
    popup.classList.add('open');
    popup.setAttribute('aria-hidden', 'false');
  }

  _closePopup(e) {
    if (e && this._popupOpenedAt && Date.now() - this._popupOpenedAt < 250) return;
    const popup = document.getElementById('memoryPopup');
    popup.classList.remove('open');
    popup.setAttribute('aria-hidden', 'true');
  }
}

// ─────────────────────────────────────────────────────────────
// BOOT
// ─────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => { window.app = new ZeitgeistApp(); });
