/* ═══════════════════════════════════════════════════════════
   MEMORY DRIFT — app.js
   ═══════════════════════════════════════════════════════════ */

'use strict';

// ─────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────
const QUESTIONS = [
  'What did you do today?',
  'Who did you meet?',
  'Where did you go?',
];

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

const WEEKLY_THRESHOLD = 7;   // days before composite generates
const SKETCH_QUALITY   = 0.72; // JPEG quality for storage

// ─────────────────────────────────────────────────────────────
// UTILITIES
// ─────────────────────────────────────────────────────────────
const rand  = (a, b) => Math.random() * (b - a) + a;
const lerp  = (a, b, t) => a + (b - a) * t;
const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function isoWeekKey(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  const day = d.getDay() || 7;
  d.setDate(d.getDate() + 4 - day);
  const yr = d.getFullYear();
  const wk = Math.ceil(((d - new Date(yr, 0, 1)) / 86400000 + 1) / 7);
  return `${yr}-W${String(wk).padStart(2, '0')}`;
}

function weekLabel(weekKey) {
  const [yr, wn] = weekKey.split('-W');
  const d = new Date(+yr, 0, 1 + (+wn - 1) * 7);
  // move to Monday
  const dow = d.getDay();
  d.setDate(d.getDate() + (dow <= 4 ? 1 - dow : 8 - dow));
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr + 'T12:00:00')
    .toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatDateLong(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr + 'T12:00:00')
    .toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
}

function normalizeMemory(mem) {
  if (!mem || mem.isWeekly) return mem;
  if (mem.entry) return mem;

  const firstAnswer = Array.isArray(mem.qa)
    ? mem.qa.find(item => item && typeof item.a === 'string' && item.a.trim())
    : null;

  return {
    ...mem,
    entry: firstAnswer ? firstAnswer.a.trim() : '',
  };
}

function escHtml(s) {
  const d = document.createElement('div');
  d.appendChild(document.createTextNode(s));
  return d.innerHTML;
}

// ─────────────────────────────────────────────────────────────
// STORAGE
// ─────────────────────────────────────────────────────────────
const store = {
  get: (k, d = null) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set: (k, v)        => { try { localStorage.setItem(k, JSON.stringify(v)); } catch(e) { console.warn('Storage full', e); } },
};

// ─────────────────────────────────────────────────────────────
// WEEKLY COMPOSITE GENERATOR
// ─────────────────────────────────────────────────────────────
function buildWeeklyComposite(memories) {
  return new Promise(resolve => {
    const W = 500, H = 400;
    const cv = Object.assign(document.createElement('canvas'), { width: W, height: H });
    const cx = cv.getContext('2d');
    // transparent base — lines will show directly

    let done = 0;
    const total = memories.length;
    if (!total) { resolve(cv.toDataURL('image/png')); return; }

    // Load all images first, then composite in order
    const imgs = [];
    memories.forEach((mem, i) => {
      const img = new Image();
      img.onload = () => {
        imgs[i] = img;
        done++;
        if (done === total) composite();
      };
      img.onerror = () => { done++; if (done === total) composite(); };
      img.src = mem.sketch;
    });

    function composite() {
      memories.forEach((_mem, i) => {
        if (!imgs[i]) return;
        // Each sketch layered with 'lighter' so glowing lines stack and brighten
        cx.globalCompositeOperation = 'lighter';
        cx.globalAlpha = clamp(0.75 / total, 0.12, 0.55);
        const ox = rand(-12, 12), oy = rand(-8, 8);
        cx.drawImage(imgs[i], ox, oy, W - Math.abs(ox), H - Math.abs(oy));
      });
      cx.globalCompositeOperation = 'source-over';
      cx.globalAlpha = 1;
      resolve(cv.toDataURL('image/png'));
    }
  });
}

// ─────────────────────────────────────────────────────────────
// PARTICLE
// ─────────────────────────────────────────────────────────────
class Particle {
  constructor(W, H) { this.W = W; this.H = H; this.init(true); }

  init(anywhere = false) {
    this.x  = rand(0, this.W);
    this.y  = anywhere ? rand(0, this.H) : this.H + 5;
    this.r  = rand(0.4, 2.4);
    this.vx = rand(-0.18, 0.18);
    this.vy = rand(-0.08, -0.38);
    this.maxA = rand(0.08, 0.55);
    this.a  = anywhere ? rand(0, this.maxA) : 0;
    this.ph = rand(0, Math.PI * 2);
    this.ps = rand(0.01, 0.028);
    this.col = PARTICLE_PALETTE[Math.floor(Math.random() * PARTICLE_PALETTE.length)];
    this.age= anywhere ? rand(0, 0.9) : 0;
  }

  tick() {
    this.x  += this.vx;
    this.y  += this.vy;
    this.ph += this.ps;
    this.age+= 0.0018;
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
// MEMORY OBJECT (floating card in the world)
// ─────────────────────────────────────────────────────────────
class MemObj {
  constructor(mem, W, H) {
    this.mem     = mem;
    this.weekly  = !!mem.isWeekly;
    this.W = W; this.H = H;

    this.bw = this.weekly ? rand(220, 280) : rand(110, 155);
    this.bh = this.bw * 0.72;

    this.x  = rand(this.bw, W - this.bw);
    this.y  = rand(this.bh, H - this.bh);

    const spd = this.weekly ? 0.16 : 0.30;
    this.vx = (Math.random() - 0.5) * spd * 2;
    this.vy = (Math.random() - 0.5) * spd;
    if (Math.abs(this.vx) < 0.06) this.vx = this.vx < 0 ? -0.1 : 0.1;

    this.ang  = rand(-0.07, 0.07);
    this.angV = (Math.random() - 0.5) * 0.0008;

    this.oscPh  = rand(0, Math.PI * 2);
    this.oscSpd = rand(0.007, 0.013);
    this.oscAmp = rand(6, 16);

    this.opacity  = 0;
    this.tOpacity = this.weekly ? 0.92 : rand(0.72, 0.88);
    this.scale    = 1;
    this.hovered  = false;

    // Breathing pulse to feel alive
    this.pulsePh  = rand(0, Math.PI * 2);
    this.pulseSpd = rand(0.004, 0.009);

    this.img = null; this.loaded = false;
    if (mem.sketch) { this.img = new Image(); this.img.onload = () => { this.loaded = true; }; this.img.src = mem.sketch; }

    this.glowCol = (mem.mood ? mem.mood.c[0] : '#8b7db5');
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

    this.x  += this.vx;
    this.y  += this.vy;
    this.oscPh += this.oscSpd;
    this.y  += Math.sin(this.oscPh) * 0.12;
    this.ang += this.angV;
    this.ang  = clamp(this.ang, -0.11, 0.11);
    if (Math.abs(this.ang) > 0.10) this.angV *= -0.6;

    const pad = this.bw * 0.7;
    if (this.x < pad)      this.vx += 0.012;
    if (this.x > W - pad)  this.vx -= 0.012;
    if (this.y < pad * 0.55) this.vy += 0.009;
    if (this.y > H - pad * 0.55) this.vy -= 0.009;

    this.vx *= 0.999; this.vy *= 0.999;
    const mn = 0.05;
    if (Math.abs(this.vx) < mn) this.vx += (Math.random() - 0.5) * 0.06;
    if (Math.abs(this.vy) < mn * 0.5) this.vy += (Math.random() - 0.5) * 0.04;
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
      if (this.weekly) {
        // Weekly: radial gradient glow behind — no shadowBlur on drawImage to avoid rect outline
        const glowR = hw * 1.35;
        const g1 = ctx.createRadialGradient(0, 0, 0, 0, 0, glowR);
        g1.addColorStop(0,   gc + (this.hovered ? '55' : '38'));
        g1.addColorStop(0.5, gc + (this.hovered ? '28' : '18'));
        g1.addColorStop(1,   gc + '00');
        ctx.globalAlpha = this.opacity;
        ctx.fillStyle = g1;
        ctx.beginPath(); ctx.ellipse(0, 0, glowR, glowR * 0.75, 0, 0, Math.PI * 2); ctx.fill();

        // Draw composite clean, no shadow
        ctx.shadowBlur = 0;
        ctx.globalAlpha = this.opacity;
        ctx.drawImage(this.img, -hw, -hh, w, h);

      } else {
        // Regular: shadow glow — works cleanly on transparent line PNGs
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
      }
    }

    ctx.restore();
  }

  _rr(ctx, x, y, w, h, r) {
    const minR = Math.min(r, w / 2, h / 2);
    ctx.moveTo(x + minR, y);
    ctx.lineTo(x + w - minR, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + minR);
    ctx.lineTo(x + w, y + h - minR);
    ctx.quadraticCurveTo(x + w, y + h, x + w - minR, y + h);
    ctx.lineTo(x + minR, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - minR);
    ctx.lineTo(x, y + minR);
    ctx.quadraticCurveTo(x, y, x + minR, y);
    ctx.closePath();
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
    this.objects   = [];  // MemObj[]
    this.particles = [];
    this.glowOrbs  = [];
    this.time      = 0;
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

  remove(id) {
    this.objects = this.objects.filter(o => o.mem.id !== id);
  }

  hitTest(x, y, pad = 0) {
    let nearest = null;
    let nearestDist = Infinity;

    for (let i = this.objects.length - 1; i >= 0; i--) {
      const obj = this.objects[i];
      if (obj.contains(x, y, pad)) return obj;

      const dx = x - obj.x;
      const dy = y - obj.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const reach = Math.max(obj.bw, obj.bh) * 0.45 + pad;
      if (dist <= reach && dist < nearestDist) {
        nearest = obj;
        nearestDist = dist;
      }
    }

    return nearest;
  }

  hover(x, y) {
    let any = false;
    this.objects.forEach(o => { o.hovered = o.contains(x, y); if (o.hovered) any = true; });
    this.cv.style.cursor = any ? 'pointer' : 'default';
  }

  render(t) {
    this.time = t;
    const ctx = this.ctx;
    const W = this.W, H = this.H;

    ctx.clearRect(0, 0, W, H);

    // ── Background — aquarium: dark top, faint blue glow at bottom ──
    const bg = ctx.createRadialGradient(W * 0.5, H * 1.1, 0, W * 0.5, H * 0.3, Math.max(W, H) * 1.0);
    bg.addColorStop(0,   '#14083a');
    bg.addColorStop(0.4, '#0a041e');
    bg.addColorStop(1,   '#05030e');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // ── Glow orbs ──
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    this.glowOrbs.forEach(o => {
      o.ph += o.spd;
      const pulse = 0.68 + 0.32 * Math.sin(o.ph);
      const cx = o.rx * W + Math.sin(o.ph * 0.7) * W * 0.025;
      const cy = o.ry * H + Math.cos(o.ph * 0.5) * H * 0.025;
      const r  = o.pr * Math.max(W, H) * pulse;
      const g  = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, o.col + 'ff');
      g.addColorStop(0.45, o.col + '70');
      g.addColorStop(1, o.col + '00');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    });
    ctx.restore();

    // ── Particles ──
    this.particles.forEach(p => { p.tick(); p.draw(ctx); });

    // ── Memory objects (weekly behind regular) ──
    this.objects.filter(o =>  o.weekly).forEach(o => { o.update(W, H); o.draw(ctx); });
    this.objects.filter(o => !o.weekly).forEach(o => { o.update(W, H); o.draw(ctx); });
  }
}

// ─────────────────────────────────────────────────────────────
// DRAWING CANVAS
// ─────────────────────────────────────────────────────────────
class DrawCanvas {
  constructor(el) {
    this.el  = el;
    this.ctx = el.getContext('2d');
    this.drawing = false;
    this.lx = 0; this.ly = 0;
    this.tool  = 'brush';
    this.color = '#c4a882';
    this.size  = 10;
    this.clear();
    this._bind();
  }

  clear() {
    this.ctx.clearRect(0, 0, this.el.width, this.el.height);
  }

  _pos(e) {
    const r = this.el.getBoundingClientRect();
    const sx = this.el.width  / r.width;
    const sy = this.el.height / r.height;
    const src = e.touches ? e.touches[0] : e;
    return { x: (src.clientX - r.left) * sx, y: (src.clientY - r.top) * sy };
  }

  _down(e) {
    e.preventDefault();
    this.drawing = true;
    const p = this._pos(e);
    this.lx = p.x; this.ly = p.y;
    this._dot(p.x, p.y);
  }

  _move(e) {
    e.preventDefault();
    if (!this.drawing) return;
    const p = this._pos(e);
    this._stroke(p.x, p.y);
    this.lx = p.x; this.ly = p.y;
  }

  _up() { this.drawing = false; }

  _dot(x, y) {
    const ctx = this.ctx;
    if (this.tool === 'eraser') {
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath(); ctx.arc(x, y, this.size, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,0,0,1)'; ctx.fill();
      ctx.restore();
    } else {
      ctx.save();
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = this.color;
      ctx.beginPath(); ctx.arc(x, y, this.size * 0.38, 0, Math.PI * 2);
      ctx.fill(); ctx.restore();
    }
  }

  _stroke(x, y) {
    const ctx = this.ctx;
    ctx.save();

    if (this.tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
      ctx.lineWidth   = this.size * 2.2;
      ctx.lineCap = ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(this.lx, this.ly); ctx.lineTo(x, y); ctx.stroke();

    } else if (this.tool === 'pencil') {
      ctx.strokeStyle = this.color;
      ctx.lineWidth   = this.size * 0.38;
      ctx.lineCap = ctx.lineJoin = 'round';
      ctx.globalAlpha = 0.82;
      ctx.beginPath();
      ctx.moveTo(this.lx, this.ly);
      ctx.quadraticCurveTo((this.lx+x)/2, (this.ly+y)/2, x, y);
      ctx.stroke();

    } else {
      // Watercolour brush — overlapping soft blobs
      const dx = x - this.lx, dy = y - this.ly;
      const dist  = Math.sqrt(dx*dx + dy*dy);
      const steps = Math.max(1, Math.floor(dist / 1.8));
      for (let i = 0; i < steps; i++) {
        const t = i / steps;
        const px = this.lx + dx * t, py = this.ly + dy * t;
        for (let j = 0; j < 4; j++) {
          const jit = this.size * 0.28;
          const jx  = px + (Math.random() - 0.5) * jit;
          const jy  = py + (Math.random() - 0.5) * jit;
          const r   = this.size * (0.75 + Math.random() * 0.5);
          const g   = ctx.createRadialGradient(jx, jy, 0, jx, jy, r);
          g.addColorStop(0, this.color);
          g.addColorStop(1, 'transparent');
          ctx.globalAlpha = 0.032;
          ctx.globalCompositeOperation = 'source-over';
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(jx, jy, r, 0, Math.PI * 2); ctx.fill();
        }
      }
    }
    ctx.restore();
  }

  _bind() {
    this.el.addEventListener('mousedown',  e => this._down(e));
    this.el.addEventListener('mousemove',  e => this._move(e));
    this.el.addEventListener('mouseup',    () => this._up());
    this.el.addEventListener('mouseleave', () => this._up());
    this.el.addEventListener('touchstart', e => this._down(e), { passive: false });
    this.el.addEventListener('touchmove',  e => this._move(e), { passive: false });
    this.el.addEventListener('touchend',   () => this._up());
  }

  dataURL() { return this.el.toDataURL('image/png'); }
}

// ─────────────────────────────────────────────────────────────
// APP
// ─────────────────────────────────────────────────────────────
class App {
  constructor() {
    this.memories  = store.get('md_memories', []).map(normalizeMemory);
    this.weeklies  = store.get('md_weeklies', []);
    this.mood      = null;
    this.questions = [];
    this.dc        = null;   // DrawCanvas instance

    this.cvEl  = document.getElementById('worldCanvas');
    this.world = new World(this.cvEl);

    this._resize();
    window.addEventListener('resize', () => this._resize());

    this._populateWorld();
    this._bindUI();
    this._loop();
    this._initCaustics();

    // Always start at stage 1 (intro screen)
    // World UI stays hidden until _enterWorld() is called
  }

  /* ── World setup ──────────────────────────────── */

  _resize() {
    this.cvEl.width  = window.innerWidth;
    this.cvEl.height = window.innerHeight;
    this.world.resize(window.innerWidth, window.innerHeight);
  }

  _populateWorld() {
    this.memories.forEach(m => this.world.add(m));
    this.weeklies.forEach(w => this.world.add({ ...w, isWeekly: true }));
  }

  _loop() {
    const tick = t => { this.world.render(t); requestAnimationFrame(tick); };
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

  _maybeHint() {
    if (this.memories.length === 0) return;
    setTimeout(() => {
      const el = document.getElementById('worldHint');
      el.classList.add('visible');
      setTimeout(() => el.classList.remove('visible'), 5000);
    }, 2200);
  }

  _showDriftMessage() {
    const div = document.createElement('div');
    div.className = 'world-empty';
    div.innerHTML = `<p>your memories will drift here</p>`;
    document.body.appendChild(div);
    requestAnimationFrame(() => div.classList.add('show'));
    setTimeout(() => {
      div.classList.remove('show');
      setTimeout(() => div.remove(), 1400);
    }, 2800);
  }

  /* ── UI bindings ──────────────────────────────── */

  _bindUI() {
    // Stage 1 → 2
    document.getElementById('recordBtn').addEventListener('click', () => {
      const intro = document.getElementById('introScreen');
      intro.classList.add('hidden');
      setTimeout(() => { intro.style.display = 'none'; }, 720);
      this._openForm(true);
    });

    // Open form from world (stage 3 → 2)
    document.getElementById('addBtn').addEventListener('click', () => this._openForm(false));

    // Clear all
    document.getElementById('clearBtn').addEventListener('click', () => {
      if (!confirm('Clear all memories?')) return;
      store.set('md_memories', []); store.set('md_weeklies', []);
      location.reload();
    });

    // Close form
    document.querySelectorAll('.js-close-form').forEach(el =>
      el.addEventListener('click', () => this._closeForm()));

    // Submit
    document.getElementById('submitBtn').addEventListener('click', () => this._submit());

    // Weekly overlay panel
    document.getElementById('weeklyTabBtn').addEventListener('click', () => this._openWeeklyPanel());
    document.querySelectorAll('.js-close-weekly').forEach(el =>
      el.addEventListener('click', () => this._closeWeeklyPanel()));

    // Close popup
    document.querySelectorAll('.js-close-popup').forEach(el =>
      el.addEventListener('click', e => this._closePopup(e)));

    // World interaction
    this.cvEl.addEventListener('pointerdown', e => this._openMemoryFromEvent(e));

    this.cvEl.addEventListener('mousemove', e => {
      const r = this.cvEl.getBoundingClientRect();
      this.world.hover(e.clientX - r.left, e.clientY - r.top);
    });

    // Drawing tools
    document.querySelectorAll('.tbtn[data-tool]').forEach(btn =>
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tbtn[data-tool]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        if (this.dc) this.dc.tool = btn.dataset.tool;
      })
    );

    document.getElementById('colorPicker').addEventListener('input', e => {
      if (this.dc) this.dc.color = e.target.value;
    });

    document.getElementById('brushSize').addEventListener('input', e => {
      if (this.dc) this.dc.size = +e.target.value;
    });

    document.getElementById('clearCanvas').addEventListener('click', () => {
      if (this.dc) this.dc.clear();
    });

    document.getElementById('insertBtn').addEventListener('click', () => {
      document.getElementById('insertInput').click();
    });
    document.getElementById('insertInput').addEventListener('change', e => {
      const file = e.target.files[0];
      if (!file || !this.dc) return;
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const ctx = this.dc.ctx;
        const cw = this.dc.el.width, ch = this.dc.el.height;
        const scale = Math.min(cw / img.width, ch / img.height);
        const w = img.width * scale, h = img.height * scale;
        ctx.drawImage(img, (cw - w) / 2, (ch - h) / 2, w, h);
        URL.revokeObjectURL(url);
      };
      img.src = url;
      e.target.value = '';
    });

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') { this._closeForm(); this._closePopup(); this._closeWeeklyPanel(); }
    });
  }

  /* ── Form ─────────────────────────────────────── */

  _enterWorld() {
    document.getElementById('uiOverlay').classList.add('visible');
    // Brief hint after settling
    setTimeout(() => {
      const el = document.getElementById('worldHint');
      el.classList.add('visible');
      setTimeout(() => el.classList.remove('visible'), 4000);
    }, 1800);
  }

  _openMemoryFromEvent(e) {
    const point = this._pointOnCanvas(e);
    if (!point) return;

    const obj = this.world.hitTest(point.x, point.y, 42);
    if (!obj) return;

    e.preventDefault();
    e.stopPropagation();
    this._openPopup(obj.mem);
  }

  _pointOnCanvas(e) {
    const r = this.cvEl.getBoundingClientRect();

    if (e.changedTouches && e.changedTouches[0]) {
      return {
        x: e.changedTouches[0].clientX - r.left,
        y: e.changedTouches[0].clientY - r.top,
      };
    }

    if (typeof e.clientX === 'number' && typeof e.clientY === 'number') {
      return {
        x: e.clientX - r.left,
        y: e.clientY - r.top,
      };
    }

    return null;
  }

  _openForm(initial = false) {
    this._initialEntry = initial;
    // Auto-set date to today (hidden, not shown)
    const today = new Date();
    document.getElementById('memoryDate').value = today.toISOString().slice(0, 10);

    // Single cycling question
    this._qIdx = 0;
    const wrap = document.getElementById('questionsWrap');
    wrap.innerHTML = `
      <div class="q-cycle-wrap">
        <div class="q-cycling" id="qCycling">${QUESTIONS[0]}</div>
        <textarea class="q-input" id="qAnswer" rows="2" placeholder="…"></textarea>
      </div>`;

    clearInterval(this._qInterval);
    this._qInterval = setInterval(() => this._cycleQuestion(), 4000);

    // Mood swatches
    const grid = document.getElementById('moodGrid');
    grid.innerHTML = '';
    this.mood = null;
    MOODS.forEach(m => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'mood-swatch';
      btn.style.background = `linear-gradient(135deg, ${m.c[0]}, ${m.c[1]})`;
      btn.textContent = m.name;
      btn.addEventListener('click', () => {
        grid.querySelectorAll('.mood-swatch').forEach(s => s.classList.remove('selected'));
        btn.classList.add('selected');
        this.mood = m;
        if (this.dc) {
          this.dc.color = m.c[0];
          document.getElementById('colorPicker').value = m.c[0];
        }
      });
      grid.appendChild(btn);
    });

    // Drawing canvas
    const dcEl = document.getElementById('drawingCanvas');
    this.dc = new DrawCanvas(dcEl);
    dcEl.style.background = '#060c18';

    // Reset tool buttons
    document.querySelectorAll('.tbtn[data-tool]').forEach(b => b.classList.remove('active'));
    document.querySelector('.tbtn[data-tool="brush"]').classList.add('active');
    document.getElementById('colorPicker').value = '#b48ef5';
    if (this.dc) this.dc.color = '#b48ef5';
    document.getElementById('brushSize').value = '10';

    const modal = document.getElementById('formModal');
    modal.classList.add('open');
    if (initial) modal.classList.add('initial');
    modal.setAttribute('aria-hidden', 'false');
  }

  _cycleQuestion() {
    const el = document.getElementById('qCycling');
    if (!el) return;
    el.classList.add('q-fade-out');
    setTimeout(() => {
      this._qIdx = (this._qIdx + 1) % QUESTIONS.length;
      el.textContent = QUESTIONS[this._qIdx];
      el.classList.remove('q-fade-out');
    }, 380);
  }

  _closeForm() {
    clearInterval(this._qInterval);
    const modal = document.getElementById('formModal');
    modal.classList.remove('open', 'initial');
    modal.setAttribute('aria-hidden', 'true');
  }

  async _submit() {
    const date = document.getElementById('memoryDate').value;
    if (!date) return;

    const entry = document.getElementById('qAnswer')?.value?.trim() || '';
    const qa = [{ q: QUESTIONS[this._qIdx], a: entry }];

    const memory = {
      id:   `mem_${Date.now()}`,
      date,
      entry,
      qa,
      mood:   this.mood,
      sketch: this.dc ? this.dc.dataURL() : null,
      ts:     Date.now(),
    };

    const wasInitial = this._initialEntry;
    this._initialEntry = false;

    this.memories.push(memory);
    store.set('md_memories', this.memories);
    this.world.add(memory);

    this._closeForm();

    if (wasInitial) {
      // Stage 2 → 3: reveal world
      this._enterWorld();
    }

    await this._checkWeekly(date);
  }

  _shake(el) {
    el.style.transition = 'transform 0.08s';
    el.style.transform  = 'translateX(-6px)';
    setTimeout(() => { el.style.transform = 'translateX(6px)'; }, 80);
    setTimeout(() => { el.style.transform = 'translateX(-4px)'; }, 160);
    setTimeout(() => { el.style.transform = 'translateX(0)'; el.style.transition = ''; }, 240);
  }

  /* ── Weekly composite ─────────────────────────── */

  async _checkWeekly(date) {
    const key = isoWeekKey(date);
    const weekMems = this.memories.filter(m => isoWeekKey(m.date) === key);
    if (weekMems.length < WEEKLY_THRESHOLD) return;

    const compositeData = await buildWeeklyComposite(weekMems);
    const wl = weekLabel(key);
    const composite = {
      id:        `wk_${key}`,
      weekKey:   key,
      weekLabel: wl,
      date:      weekMems[0].date,
      mood:      weekMems[0].mood,
      sketch:    compositeData,
      isWeekly:  true,
      count:     weekMems.length,
    };

    const existIdx = this.weeklies.findIndex(w => w.weekKey === key);
    if (existIdx >= 0) {
      this.weeklies[existIdx] = composite;
      this.world.remove(composite.id);
    } else {
      this.weeklies.push(composite);
    }
    store.set('md_weeklies', this.weeklies);
    this.world.add({ ...composite, isWeekly: true });
  }

  /* ── Weekly panel ─────────────────────────────── */

  _openWeeklyPanel() {
    const grid = document.getElementById('weeklyGrid');
    grid.innerHTML = '';

    if (this.weeklies.length === 0) {
      grid.innerHTML = `<div class="weekly-empty">
        sketch for 7 days in a row<br>to generate your first memory overlay
      </div>`;
    } else {
      this.weeklies.forEach(w => {
        const item = document.createElement('div');
        item.className = 'weekly-item';
        item.innerHTML = `
          <img src="${w.sketch}" alt="weekly overlay">
          <div class="weekly-item-meta">
            <div class="weekly-item-label">${w.weekLabel}</div>
            <div class="weekly-item-count">${w.count} memories layered</div>
          </div>`;
        item.addEventListener('click', () => {
          this._closeWeeklyPanel();
          this._openPopup(w);
        });
        grid.appendChild(item);
      });
    }

    const panel = document.getElementById('weeklyPanel');
    panel.classList.add('open');
    panel.setAttribute('aria-hidden', 'false');
  }

  _closeWeeklyPanel() {
    const panel = document.getElementById('weeklyPanel');
    panel.classList.remove('open');
    panel.setAttribute('aria-hidden', 'true');
  }

  /* ── Popup ────────────────────────────────────── */

  _openPopup(mem) {
    const body = document.getElementById('popupBody');

    const dateLong = formatDateLong(mem.date);
    let html = `<div class="pop-date">${dateLong}</div>`;

    if (mem.isWeekly) {
      html += `<div class="pop-weekly-badge">✦ weekly echo &nbsp;·&nbsp; ${mem.count || ''} memories</div>`;
    }

    if (mem.sketch) {
      html += `<img class="pop-sketch" src="${mem.sketch}" alt="sketch">`;
    }

    if (mem.isWeekly) {
      const weekEntries = this.memories
        .filter(entry => isoWeekKey(entry.date) === mem.weekKey)
        .sort((a, b) => a.ts - b.ts);

      weekEntries.forEach((entry, idx) => {
        html += this._renderEntryBlock(entry, idx + 1, false);
      });
    } else {
      html += this._renderEntryBlock(mem, 1, false);
    }

    body.innerHTML = html;

    const popup = document.getElementById('memoryPopup');
    this._popupOpenedAt = Date.now();
    popup.classList.add('open');
    popup.setAttribute('aria-hidden', 'false');
  }

  _closePopup(e) {
    if (e && this._popupOpenedAt && Date.now() - this._popupOpenedAt < 250) {
      return;
    }

    const popup = document.getElementById('memoryPopup');
    popup.classList.remove('open');
    popup.setAttribute('aria-hidden', 'true');
  }

  _renderEntryBlock(mem, index, showLabel) {
    let html = `<section class="pop-day-entry">`;

    if (showLabel) {
      html += `<div class="pop-entry-label">entry ${index}</div>`;
    }

    const textEntry = (mem.entry || '').trim();
    if (textEntry) {
      html += `<div class="pop-qa"><div class="pop-q">journal entry</div><div class="pop-a">${escHtml(textEntry)}</div></div>`;
    } else if (mem.qa) {
      mem.qa.forEach(({ q, a }) => {
        if (!a) return;
        html += `<div class="pop-qa"><div class="pop-q">${escHtml(q)}</div><div class="pop-a">${escHtml(a)}</div></div>`;
      });
    } else {
      html += `<div class="pop-qa"><div class="pop-q">journal entry</div><div class="pop-a">No journal entry was saved for this memory.</div></div>`;
    }

    html += `</section>`;
    return html;
  }
}

// ─────────────────────────────────────────────────────────────
// BOOT
// ─────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => { window.app = new App(); });
