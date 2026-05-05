/* ═══════════════════════════════════════════════════════════
   MEMORY DRIFT — app.js
   ═══════════════════════════════════════════════════════════ */

'use strict';

// ─────────────────────────────────────────────────────────────
// SUPABASE
// ─────────────────────────────────────────────────────────────
const MAPBOX_TOKEN = 'pk.eyJ1IjoiaGtrMjEyNiIsImEiOiJjbWgxN3lnMnowOGFqMm1wdjhjdWt5MDg4In0.RyP5qk4n8VrWbK5cMzoZcA';

const SUPABASE_URL = 'https://rbqwoiewrgcfbvotnaoj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJicXdvaWV3cmdjZmJ2b3RuYW9qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5ODcyNTMsImV4cCI6MjA5MDU2MzI1M30.GdYT18ejTA7GhpjAi34Gtnuu5lYrlyivhaJsluPieh0';

const sb = {
  _h: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` },

  async getUser(username) {
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/users?username=eq.${encodeURIComponent(username)}&select=username`, { headers: this._h });
      if (!r.ok) return null;
      const rows = await r.json();
      return rows[0] || null;
    } catch { return null; }
  },

  async createUser(username) {
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/users`, {
        method: 'POST',
        headers: { ...this._h, 'Prefer': 'return=minimal' },
        body: JSON.stringify({ username }),
      });
      return r.ok;
    } catch { return false; }
  },

  async loadMemories(username) {
    try {
      // Fetch without heavy blob columns first — audio/images loaded on demand
      const r = await fetch(
        `${SUPABASE_URL}/rest/v1/memories?username=eq.${encodeURIComponent(username)}&select=id,date,time,entry,qa,mood,sketch,sketch_duration,ts,username,location&order=ts.asc`,
        { headers: this._h }
      );
      if (!r.ok) return null;
      return await r.json();
    } catch { return null; }
  },

  async loadMemoryFull(id) {
    try {
      const r = await fetch(
        `${SUPABASE_URL}/rest/v1/memories?id=eq.${encodeURIComponent(id)}&select=audio,images&limit=1`,
        { headers: this._h }
      );
      if (!r.ok) return null;
      const rows = await r.json();
      return rows[0] || null;
    } catch { return null; }
  },

  async loadWeeklies(username) {
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/weeklies?username=eq.${encodeURIComponent(username)}&order=created_at.asc`, { headers: this._h });
      if (!r.ok) return null;
      return await r.json();
    } catch { return null; }
  },

  async saveMemory(mem) {
    try {
      const row = { id: mem.id, date: mem.date, time: mem.time || null, entry: mem.entry, qa: mem.qa, mood: mem.mood, sketch: mem.sketch, sketch_duration: mem.sketch_duration || null, ts: mem.ts, username: mem.username, location: mem.location || null, audio: mem.audio || null, images: mem.images || null };
      await fetch(`${SUPABASE_URL}/rest/v1/memories`, {
        method: 'POST',
        headers: { ...this._h, 'Prefer': 'resolution=merge-duplicates' },
        body: JSON.stringify(row),
      });
    } catch (e) { console.warn('Supabase save failed', e); }
  },

  async saveWeekly(w) {
    try {
      const row = { id: w.id, week_key: w.weekKey, week_label: w.weekLabel, date: w.date, mood: w.mood, sketch: w.sketch, is_weekly: true, count: w.count, username: w.username };
      await fetch(`${SUPABASE_URL}/rest/v1/weeklies`, {
        method: 'POST',
        headers: { ...this._h, 'Prefer': 'resolution=merge-duplicates' },
        body: JSON.stringify(row),
      });
    } catch (e) { console.warn('Supabase weekly save failed', e); }
  },

  async deleteMemory(id) {
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/memories?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE', headers: this._h });
    } catch (e) { console.warn('Supabase delete failed', e); }
  },

  async deleteAll(username) {
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/memories?username=eq.${encodeURIComponent(username)}`, { method: 'DELETE', headers: this._h });
      await fetch(`${SUPABASE_URL}/rest/v1/weeklies?username=eq.${encodeURIComponent(username)}`, { method: 'DELETE', headers: this._h });
    } catch (e) { console.warn('Supabase delete failed', e); }
  },
};

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

function weekDateRange(weekKey) {
  const [yr, wn] = weekKey.split('-W');
  const d = new Date(+yr, 0, 1 + (+wn - 1) * 7);
  const dow = d.getDay();
  d.setDate(d.getDate() + (dow <= 4 ? 1 - dow : 8 - dow));
  const sun = new Date(d); sun.setDate(d.getDate() + 6);
  const fmt = dt => dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${fmt(d)} – ${fmt(sun)}`;
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
// SUPABASE
// ─────────────────────────────────────────────────────────────
const db = supabase.createClient(
  'https://rbqwoiewrgcfbvotnaoj.supabase.co',
  'sb_publishable_LvJihLKo6TuFlsEt9VyekQ_QnFWHHSi'
);

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

    this.baseBw  = this.weekly ? rand(220, 280) : rand(110, 155);
    this.bw      = this.baseBw;
    this.bh      = this.bw * 0.72;

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

    this.opacity    = 0;
    this.tOpacity   = this.weekly ? 0.92 : 0.55;
    this.ageScore   = 0.5;
    this.clickCount = 0;
    this.scale      = 1;
    this.hovered    = false;

    // Breathing pulse to feel alive
    this.pulsePh  = rand(0, Math.PI * 2);
    this.pulseSpd = rand(0.004, 0.009);

    this.img = null; this.loaded = false;
    if (mem.sketch) { this.img = new Image(); this.img.onload = () => { this.loaded = true; }; this.img.src = mem.sketch; }

    this.glowCol = (mem.mood ? mem.mood.c[0] : '#8b7db5');
  }

  // Called by World whenever age range changes
  setAgeScore(score) {
    this.ageScore = score;
    if (this.weekly) return;
    const factor = lerp(1.25, 2.25, score);
    const boosted = Math.min(factor + this.clickCount * 0.2, 1.5);
    this.bw = this.baseBw * boosted;
    this.bh = this.bw * 0.72;
    this.tOpacity = lerp(0.22, 0.85, score + this.clickCount * 0.08);
    this.tOpacity = clamp(this.tOpacity, 0.22, 0.92);
  }

  // Called on each click — grow size and opacity
  bump() {
    if (this.weekly) return;
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
    this._recomputeAgeScores();
  }

  addAll(mems) {
    mems.forEach(m => this.objects.push(new MemObj(m, this.W, this.H)));
    this._recomputeAgeScores();
  }

  remove(id) {
    this.objects = this.objects.filter(o => o.mem.id !== id);
    this._recomputeAgeScores();
  }

  bump(id) {
    const obj = this.objects.find(o => o.mem.id === id);
    if (obj) obj.bump();
  }

  _recomputeAgeScores() {
    const regular = this.objects.filter(o => !o.weekly && o.mem.ts);
    if (!regular.length) return;
    const tsNums = regular.map(o => typeof o.mem.ts === 'number' ? o.mem.ts : new Date(o.mem.ts).getTime());
    const minTs = Math.min(...tsNums);
    const maxTs = Math.max(...tsNums);
    const range = maxTs - minTs || 1;
    regular.forEach((o, i) => {
      o.setAgeScore((tsNums[i] - minTs) / range);
    });
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
    this.tool  = 'pencil';
    this.color = '#c4a882';
    this.size  = 10;
    this._history = [];
    this._clearCanvas();
    this._bind();
  }

  _clearCanvas() {
    this.ctx.clearRect(0, 0, this.el.width, this.el.height);
    this._drawStart   = null;
    this._totalDrawMs = 0;
  }

  _saveHistory() {
    this._history.push(this.ctx.getImageData(0, 0, this.el.width, this.el.height));
    if (this._history.length > 40) this._history.shift();
  }

  undo() {
    if (!this._history.length) { this._clearCanvas(); return; }
    this.ctx.putImageData(this._history.pop(), 0, 0);
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
    this._saveHistory();
    this.drawing = true;
    this._drawStart = Date.now();
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

  _up() {
    if (this._drawStart !== null) {
      this._totalDrawMs += Date.now() - this._drawStart;
      this._drawStart = null;
    }
    this.drawing = false;
  }

  drawDuration() { return this._totalDrawMs; }

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
    this.memories    = [];
    this.weeklies    = [];
    this.mood           = null;
    this.location       = null;
    this.audio          = null;  // base64 data URL
    this.images         = [];    // array of base64 data URLs
    this.questions      = [];
    this.dc             = null;
    this._leafletMap    = null;
    this._mediaRecorder  = null;
    this._audioChunks    = [];
    this._pendingGeocode = null;
    this.currentUser = localStorage.getItem('md_user') || null;

    this.cvEl  = document.getElementById('worldCanvas');
    this.world = new World(this.cvEl);

    this._resize();
    window.addEventListener('resize', () => this._resize());

    this._bindUI();
    this._bindAuth();
    this._loop();
    this._initCaustics();

    if (this.currentUser) {
      this._showUserView(this.currentUser);
      this._init(this.currentUser).then(() => {
        if (new URLSearchParams(location.search).get('world') === '1') {
          const intro = document.getElementById('introScreen');
          intro.style.display = 'none';
          this._enterWorld();
        }
      });
    }
  }

  async _init(username) {
    const loadingEl = document.getElementById('worldLoading');
    if (loadingEl) loadingEl.classList.add('visible');

    const [mems, wks] = await Promise.all([sb.loadMemories(username), sb.loadWeeklies(username)]);

    this.memories = (mems || []).map(normalizeMemory);
    this.weeklies = (wks || []).map(w => ({
      ...w,
      weekKey:   w.week_key,
      weekLabel: w.week_label,
      isWeekly:  true,
    }));

    this._populateWorld();

    if (loadingEl) loadingEl.classList.remove('visible');
  }

  /* ── World setup ──────────────────────────────── */

  _resize() {
    this.cvEl.width  = window.innerWidth;
    this.cvEl.height = window.innerHeight;
    this.world.resize(window.innerWidth, window.innerHeight);
  }

  _populateWorld() {
    const all = [
      ...this.memories,
      ...this.weeklies.map(w => ({ ...w, isWeekly: true })),
    ];
    this.world.addAll(all);
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
    document.getElementById('clearBtn').addEventListener('click', async () => {
      if (!this.currentUser) return;
      if (!confirm('Clear all memories?')) return;
      await sb.deleteAll(this.currentUser);
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

    // Mood panel
    document.getElementById('moodTabBtn').addEventListener('click', () => this._openMoodPanel());
    document.querySelectorAll('.js-close-mood').forEach(el =>
      el.addEventListener('click', () => this._closeMoodPanel()));

    // Map panel
    document.getElementById('mapTabBtn').addEventListener('click', () => this._openMapPanel());
    document.querySelectorAll('.js-close-map').forEach(el =>
      el.addEventListener('click', () => this._closeMapPanel()));

    // Timeline panel
    document.getElementById('timelineTabBtn').addEventListener('click', () => this._openTimelinePanel());
    document.querySelectorAll('.js-close-timeline').forEach(el =>
      el.addEventListener('click', () => this._closeTimelinePanel()));

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

    document.getElementById('brushSize').addEventListener('input', e => {
      if (this.dc) this.dc.size = +e.target.value;
    });

    document.getElementById('undoCanvas').addEventListener('click', () => {
      if (this.dc) this.dc.undo();
    });



    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') { this._closeForm(); this._closePopup(); this._closeWeeklyPanel(); this._closeMoodPanel(); this._closeMapPanel(); this._closeTimelinePanel(); }
    });
  }

  /* ── Auth ────────────────────────────────────── */

  _bindAuth() {
    document.getElementById('authSignInBtn').addEventListener('click',  () => this._authSubmit());
    document.getElementById('authSignOutBtn').addEventListener('click', () => this._signOut());
    document.getElementById('authUsername').addEventListener('keydown', e => {
      if (e.key === 'Enter') this._authSubmit();
    });
  }

  async _authSubmit() {
    const username = document.getElementById('authUsername').value.trim().toLowerCase();
    if (!username)        { this._authMsg('enter a username'); return; }
    if (username.length < 2) { this._authMsg('username too short'); return; }
    if (!/^[a-z0-9_-]+$/.test(username)) { this._authMsg('letters, numbers, _ and - only'); return; }

    const existing = await sb.getUser(username);
    if (!existing) {
      const ok = await sb.createUser(username);
      if (!ok) { this._authMsg('could not create account'); return; }
    }

    localStorage.setItem('md_user', username);
    this.currentUser = username;
    this._showUserView(username);
    this._authMsg('');
    await this._init(username);
  }

  _authMsg(text, isError = true) {
    const el = document.getElementById('authMsg');
    el.textContent = text;
    el.className = 'auth-msg' + (isError ? '' : ' ok');
  }

  _showUserView(username) {
    document.getElementById('authLoginView').style.display = 'none';
    document.getElementById('authUserView').style.display  = 'flex';
    document.getElementById('authWelcome').textContent = `welcome back, ${username}`;
    document.getElementById('recordBtn').classList.remove('record-btn--locked');

    const seeBtn = document.getElementById('introSeeBtn');
    if (seeBtn) {
      seeBtn.style.display = 'block';
      seeBtn.onclick = () => {
        const intro = document.getElementById('introScreen');
        intro.classList.add('hidden');
        setTimeout(() => { intro.style.display = 'none'; }, 720);
        this._enterWorld();
      };
    }
  }

  _signOut() {
    localStorage.removeItem('md_user');
    location.reload();
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
    this.world.bump(obj.mem.id);
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
    const today = new Date();
    document.getElementById('memoryDate').value = today.toISOString().slice(0, 10);

    // Populate time selects (once — if already populated, just reset values)
    const hourSel   = document.getElementById('memoryHour');
    const minSel    = document.getElementById('memoryMinute');
    const ampmSel   = document.getElementById('memoryAmpm');

    if (!hourSel.options.length) {
      for (let h = 1; h <= 12; h++) {
        const o = document.createElement('option'); o.value = h; o.textContent = h;
        hourSel.appendChild(o);
      }
      for (let m = 0; m < 60; m++) {
        const o = document.createElement('option');
        o.value = String(m).padStart(2, '0');
        o.textContent = String(m).padStart(2, '0');
        minSel.appendChild(o);
      }
      ['AM', 'PM'].forEach(p => {
        const o = document.createElement('option'); o.value = p; o.textContent = p;
        ampmSel.appendChild(o);
      });
    }

    // Set to current time
    let h = today.getHours(), m = today.getMinutes();
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    hourSel.value = h;
    minSel.value  = String(m).padStart(2, '0');
    ampmSel.value = ampm;

    // Reset location
    this.location = null;
    const locDisplay = document.getElementById('locationDisplay');
    if (locDisplay) locDisplay.textContent = '';
    const locBtn = document.getElementById('locateBtn');
    if (locBtn) { locBtn.textContent = 'locate me'; locBtn.disabled = false; }
    this._pendingGeocode = null;
    const addrInput = document.getElementById('addressInput');
    if (addrInput) addrInput.value = '';

    // Reset audio
    this._stopRecording();
    this.audio = null;
    this._audioChunks = [];
    document.getElementById('soundRecordBtn').textContent = 'record';
    document.getElementById('soundRecordBtn').classList.remove('recording');
    document.getElementById('soundPlayback').style.display = 'none';
    document.getElementById('soundProgress').style.width = '0%';

    // Reset images
    this.images = [];
    document.getElementById('imagesPreview').innerHTML = '';
    document.getElementById('imagesInput').value = '';

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
        if (this.dc) this.dc.color = m.c[0];
        // Unlock sketch + submit once mood is chosen
        document.getElementById('drawingCanvas').classList.remove('sketch-locked');
        document.querySelector('.drawing-wrap').classList.remove('sketch-locked-wrap');
        document.getElementById('submitBtn').disabled = false;
      });
      grid.appendChild(btn);
    });

    // Drawing canvas — reset history each open
    const dcEl = document.getElementById('drawingCanvas');
    if (!this.dc) this.dc = new DrawCanvas(dcEl);
    this.dc._clearCanvas();
    this.dc._history = [];
    dcEl.style.background = '#060c18';

    // Reset tool buttons
    document.querySelectorAll('.tbtn[data-tool]').forEach(b => b.classList.remove('active'));
    document.querySelector('.tbtn[data-tool="pencil"]').classList.add('active');
    if (this.dc) this.dc.color = '#b48ef5';
    document.getElementById('brushSize').value = '10';

    // Lock sketch and submit until mood selected
    dcEl.classList.add('sketch-locked');
    document.querySelector('.drawing-wrap').classList.add('sketch-locked-wrap');
    document.getElementById('submitBtn').disabled = true;

    // Bind locate button
    document.getElementById('locateBtn').onclick = () => this._geolocate();

    // Address autocomplete
    this._initAddressAutocomplete();

    // Bind sound button
    document.getElementById('soundRecordBtn').onclick    = () => this._toggleRecording();
    document.getElementById('soundPlayBtn').onclick      = () => this._playAudio();
    document.getElementById('soundDiscardBtn').onclick   = () => this._discardAudio();

    // Bind images
    document.getElementById('imagesAddBtn').onclick      = () => document.getElementById('imagesInput').click();
    document.getElementById('imagesInput').onchange      = e  => this._addImages(e);

    const modal = document.getElementById('formModal');
    modal.classList.add('open');
    if (initial) modal.classList.add('initial');
    modal.setAttribute('aria-hidden', 'false');
  }

  async _geolocate() {
    const btn = document.getElementById('locateBtn');
    const display = document.getElementById('locationDisplay');
    if (!navigator.geolocation) {
      display.textContent = 'not supported';
      return;
    }
    btn.textContent = '…';
    btn.disabled = true;

    navigator.geolocation.getCurrentPosition(
      async pos => {
        const { latitude: lat, longitude: lng } = pos.coords;
        display.textContent = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
        this.location = { lat, lng, name: null };
        btn.textContent = 'relocate';
        btn.disabled = false;

        // Reverse geocode via Nominatim
        try {
          const r = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
            { headers: { 'Accept': 'application/json' } }
          );
          if (r.ok) {
            const data = await r.json();
            const addr = data.address || {};
            const name = addr.city || addr.town || addr.village || addr.county || addr.state || data.display_name || `${lat.toFixed(3)}, ${lng.toFixed(3)}`;
            this.location.name = name;
            display.textContent = name;
          }
        } catch { /* keep raw coords */ }
      },
      err => {
        const msgs = { 1: 'permission denied', 2: 'unavailable', 3: 'timed out' };
        display.textContent = msgs[err.code] || 'error';
        btn.textContent = 'try again';
        btn.disabled = false;
      },
      { timeout: 10000 }
    );
  }

  _initAddressAutocomplete() {
    const input    = document.getElementById('addressInput');
    const dropdown = document.getElementById('addressDropdown');
    const display  = document.getElementById('locationDisplay');

    let timer       = null;
    let activeIdx   = -1;
    let suggestions = [];

    const close = () => {
      dropdown.innerHTML = '';
      dropdown.hidden = true;
      activeIdx = -1;
    };

    const setActive = idx => {
      activeIdx = idx;
      dropdown.querySelectorAll('.addr-option').forEach((el, i) => {
        el.classList.toggle('active', i === activeIdx);
        if (i === activeIdx) el.scrollIntoView({ block: 'nearest' });
      });
    };

    const commit = item => {
      this.location = { lat: item.lat, lng: item.lng, name: item.name || item.label };
      input.value = item.label;
      display.textContent = item.name || item.label;
      close();
    };

    const render = items => {
      suggestions = items;
      activeIdx   = -1;
      dropdown.innerHTML = '';
      if (!items.length) { close(); return; }

      items.forEach((item, i) => {
        const el = document.createElement('div');
        el.className = 'addr-option';
        el.innerHTML = `<span class="addr-main">${escHtml(item.main)}</span>`
                     + (item.sub ? `<span class="addr-sub">${escHtml(item.sub)}</span>` : '');
        el.addEventListener('mousedown', e => { e.preventDefault(); commit(item); });
        el.addEventListener('mouseover', () => setActive(i));
        dropdown.appendChild(el);
      });
      dropdown.hidden = false;
    };

    const search = async query => {
      if (query.length < 2) { close(); return; }
      try {
        const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json`
          + `?types=poi,address,place,neighborhood&autocomplete=true&limit=8&language=en`
          + `&proximity=-73.9857,40.7484`
          + `&access_token=${MAPBOX_TOKEN}`;
        const r = await fetch(url);
        if (!r.ok) return;
        const data = await r.json();
        const items = (data.features || []).map(f => {
          const [lng, lat] = f.center;
          // For POIs: text = landmark name, place_name includes full address context
          const isPoi  = f.place_type && f.place_type.includes('poi');
          const main   = f.text || f.place_name;
          const full   = f.place_name || main;
          // sub = everything after the name (address context)
          const sub    = full.startsWith(main) ? full.slice(main.length).replace(/^,\s*/, '') : full;
          // Store display name: for POIs use landmark name; for addresses use street
          const name   = isPoi ? main : full;
          return { lat, lng, label: full, main, sub, name };
        });
        render(items);
      } catch { /* network error — fail silently */ }
    };

    input.addEventListener('input', () => {
      clearTimeout(timer);
      const q = input.value.trim();
      if (!q) { close(); display.textContent = ''; this.location = null; return; }
      timer = setTimeout(() => search(q), 260);
    });

    input.addEventListener('keydown', e => {
      const opts = dropdown.querySelectorAll('.addr-option');
      if (!opts.length && e.key !== 'Escape') return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActive(Math.min(activeIdx + 1, opts.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActive(Math.max(activeIdx - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (activeIdx >= 0 && suggestions[activeIdx]) commit(suggestions[activeIdx]);
      } else if (e.key === 'Escape') {
        close();
      }
    });

    // Close on outside click, not on clicking an option (mousedown prevents blur)
    input.addEventListener('blur', () => setTimeout(close, 160));
  }

  async _toggleRecording() {
    if (this._mediaRecorder && this._mediaRecorder.state === 'recording') {
      this._stopRecording();
    } else {
      await this._startRecording();
    }
  }

  async _startRecording() {
    const btn = document.getElementById('soundRecordBtn');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this._audioChunks = [];
      this._mediaRecorder = new MediaRecorder(stream);
      this._mediaRecorder.ondataavailable = e => { if (e.data.size > 0) this._audioChunks.push(e.data); };
      this._mediaRecorder.onstop = () => {
        const blob = new Blob(this._audioChunks, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onload = () => {
          this.audio = reader.result;
          document.getElementById('soundPlayback').style.display = 'flex';
        };
        reader.readAsDataURL(blob);
        stream.getTracks().forEach(t => t.stop());
      };
      this._mediaRecorder.start();
      btn.textContent = 'stop';
      btn.classList.add('recording');
      // Pulse timer label
      this._recStart = Date.now();
      this._recTimer = setInterval(() => {
        const s = Math.floor((Date.now() - this._recStart) / 1000);
        btn.textContent = `stop ${s}s`;
      }, 1000);
    } catch {
      document.getElementById('locationDisplay');
      btn.textContent = 'mic denied';
    }
  }

  _stopRecording() {
    clearInterval(this._recTimer);
    if (this._mediaRecorder && this._mediaRecorder.state === 'recording') {
      this._mediaRecorder.stop();
    }
    this._mediaRecorder = null;
  }

  _playAudio() {
    if (!this.audio) return;
    if (this._audioEl) { this._audioEl.pause(); this._audioEl = null; }
    const el = new Audio(this.audio);
    this._audioEl = el;
    const prog = document.getElementById('soundProgress');
    prog.style.width = '0%';
    el.ontimeupdate = () => {
      if (el.duration) prog.style.width = `${(el.currentTime / el.duration) * 100}%`;
    };
    el.onended = () => { prog.style.width = '100%'; };
    el.play();
  }

  _discardAudio() {
    if (this._audioEl) { this._audioEl.pause(); this._audioEl = null; }
    this.audio = null;
    this._audioChunks = [];
    document.getElementById('soundPlayback').style.display = 'none';
    document.getElementById('soundRecordBtn').textContent = 'record';
    document.getElementById('soundRecordBtn').classList.remove('recording');
    document.getElementById('soundProgress').style.width = '0%';
  }

  _addImages(e) {
    const file = e.target.files[0];
    if (!file) return;
    const preview = document.getElementById('imagesPreview');
    const reader = new FileReader();
    reader.onload = ev => {
      const dataURL = ev.target.result;
      // Replace any existing photo
      this.images = [dataURL];
      preview.innerHTML = '';
      const wrap = document.createElement('div');
      wrap.className = 'img-thumb-wrap';
      wrap.innerHTML = `<img src="${dataURL}" class="img-thumb" alt="photo">
        <button type="button" class="img-remove-btn" aria-label="Remove">×</button>`;
      wrap.querySelector('.img-remove-btn').onclick = () => {
        this.images = [];
        wrap.remove();
      };
      preview.appendChild(wrap);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
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
    this._stopRecording();
    if (this._audioEl) { this._audioEl.pause(); this._audioEl = null; }
    const submitBtn = document.getElementById('submitBtn');
    submitBtn.disabled = false;
    submitBtn.textContent = 'release this memory';
    const modal = document.getElementById('formModal');
    modal.classList.remove('open', 'initial');
    modal.setAttribute('aria-hidden', 'true');
  }

  async _submit() {
    const date = document.getElementById('memoryDate').value;
    if (!date) return;

    const submitBtn = document.getElementById('submitBtn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'releasing…';

    const h    = document.getElementById('memoryHour').value;
    const m    = document.getElementById('memoryMinute').value;
    const ampm = document.getElementById('memoryAmpm').value;
    const time = `${h}:${m} ${ampm}`;

    const entry = document.getElementById('qAnswer')?.value?.trim() || '';
    const qa = [{ q: QUESTIONS[this._qIdx], a: entry }];

    const memory = {
      id:       `mem_${Date.now()}`,
      date,
      time,
      entry,
      qa,
      mood:     this.mood,
      sketch:          this.dc ? this.dc.dataURL() : null,
      sketch_duration: this.dc ? this.dc.drawDuration() : null,
      ts:       Date.now(),
      username: this.currentUser,
      location: this.location || null,
      audio:    this.audio   || null,
      images:   this.images.length ? this.images : null,
    };

    const wasInitial = this._initialEntry;
    this._initialEntry = false;

    this.memories.push(memory);
    await sb.saveMemory(memory);
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
      username:  this.currentUser,
    };

    const existIdx = this.weeklies.findIndex(w => w.weekKey === key);
    if (existIdx >= 0) {
      this.weeklies[existIdx] = composite;
      this.world.remove(composite.id);
    } else {
      this.weeklies.push(composite);
    }
    await sb.saveWeekly(composite);
    this.world.add({ ...composite, isWeekly: true });
  }

  /* ── Weekly panel ─────────────────────────────── */

  _openWeeklyPanel() {
    const container = document.getElementById('weeklyGrid');
    container.innerHTML = '';

    // Group memories by ISO week, newest week first
    const byWeek = new Map();
    this.memories.forEach(m => {
      const key = isoWeekKey(m.date);
      if (!byWeek.has(key)) byWeek.set(key, []);
      byWeek.get(key).push(m);
    });

    if (byWeek.size === 0) {
      container.innerHTML = `<div class="weekly-empty">your sketches will appear here, grouped by week</div>`;
    } else {
      const sortedWeeks = [...byWeek.keys()].sort().reverse();
      sortedWeeks.forEach(key => {
        const mems = byWeek.get(key).sort((a, b) => a.ts - b.ts);
        const range = weekDateRange(key);

        const section = document.createElement('div');
        section.className = 'week-section';

        const label = document.createElement('div');
        label.className = 'week-section-label';
        label.textContent = range;
        section.appendChild(label);

        const grid = document.createElement('div');
        grid.className = 'week-sketch-grid';

        mems.forEach(mem => {
          const thumb = document.createElement('div');
          thumb.className = 'week-thumb';
          if (mem.sketch) {
            thumb.innerHTML = `<img src="${mem.sketch}" alt="${formatDate(mem.date)}">`;
          } else {
            thumb.classList.add('week-thumb--nosketc');
            thumb.style.background = mem.mood ? `linear-gradient(135deg,${mem.mood.c[0]}22,${mem.mood.c[1]}22)` : '';
          }
          const dateLbl = document.createElement('div');
          dateLbl.className = 'week-thumb-date';
          dateLbl.textContent = formatDate(mem.date);
          thumb.appendChild(dateLbl);
          thumb.addEventListener('click', () => {
            this._closeWeeklyPanel();
            this._openPopup(mem);
          });
          grid.appendChild(thumb);
        });

        section.appendChild(grid);
        container.appendChild(section);
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

  /* ── Mood panel ───────────────────────────────── */

  _openMoodPanel(activeMoodName = null) {
    const panel = document.getElementById('moodPanel');
    panel.classList.add('open');
    panel.setAttribute('aria-hidden', 'false');

    const btnsWrap = document.getElementById('moodFilterBtns');
    const gridEl   = document.getElementById('moodMemGrid');

    // Build filter buttons once per open
    btnsWrap.innerHTML = '';
    const selected = activeMoodName || MOODS[0].name;

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
        .sort((a, b) => b.ts - a.ts);

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
        const dateLbl = document.createElement('div');
        dateLbl.className = 'week-thumb-date';
        dateLbl.textContent = formatDate(mem.date);
        thumb.appendChild(dateLbl);
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
    const panel = document.getElementById('moodPanel');
    panel.classList.remove('open');
    panel.setAttribute('aria-hidden', 'true');
  }

  /* ── Map panel ────────────────────────────────── */

  _openMapPanel() {
    const panel = document.getElementById('mapPanel');
    panel.classList.add('open');
    panel.setAttribute('aria-hidden', 'false');

    // Give the panel a tick to become visible before Leaflet initializes
    requestAnimationFrame(() => {
      const container = document.getElementById('mapContainer');
      const located = this.memories.filter(m => m.location && m.location.lat != null);

      if (!this._leafletMap) {
        const defaultCenter = located.length
          ? [located[0].location.lat, located[0].location.lng]
          : [20, 0];
        this._leafletMap = L.map(container, { zoomControl: true }).setView(defaultCenter, located.length ? 5 : 2);

        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
          attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
          maxZoom: 19,
        }).addTo(this._leafletMap);

        this._mapMarkers = L.layerGroup().addTo(this._leafletMap);
      }

      // Rebuild markers each open so new memories appear
      this._mapMarkers.clearLayers();

      if (located.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'map-empty';
        empty.textContent = 'no memories with location yet — use "locate me" when recording';
        container.appendChild(empty);
        return;
      }

      // Ensure hover card exists
      let hoverCard = document.getElementById('mapHoverCard');
      if (!hoverCard) {
        hoverCard = document.createElement('div');
        hoverCard.id = 'mapHoverCard';
        hoverCard.className = 'z-map-hover';
        document.body.appendChild(hoverCard);
      }

      const showHover = (mem, e) => {
        const moodName  = mem.mood ? mem.mood.name : '';
        const dateLabel = formatDate(mem.date);
        const preview   = (mem.entry || '').slice(0, 100) + ((mem.entry || '').length > 100 ? '…' : '');
        hoverCard.innerHTML =
          `<div class="z-mh-header">` +
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
        const iconHtml = mem.sketch
          ? `<div class="map-marker-sketch" style="border-color:${moodColor}"><img src="${mem.sketch}" alt="sketch"></div>`
          : `<div class="map-marker-dot" style="background:${moodColor}"></div>`;
        const icon = L.divIcon({
          className: 'map-marker',
          html: iconHtml,
          iconSize:   mem.sketch ? [48, 48] : [12, 12],
          iconAnchor: mem.sketch ? [24, 24] : [6, 6],
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
      } else if (bounds.length > 1) {
        this._leafletMap.fitBounds(bounds, { padding: [40, 40] });
      }

      setTimeout(() => this._leafletMap.invalidateSize(), 80);
    });
  }

  _closeMapPanel() {
    const panel = document.getElementById('mapPanel');
    panel.classList.remove('open');
    panel.setAttribute('aria-hidden', 'true');
    const hoverCard = document.getElementById('mapHoverCard');
    if (hoverCard) hoverCard.style.display = 'none';
  }

  /* ── Timeline panel ───────────────────────────── */

  _openTimelinePanel() {
    const panel = document.getElementById('timelinePanel');
    panel.classList.add('open');
    panel.setAttribute('aria-hidden', 'false');

    const container = document.getElementById('timelineContainer');
    container.innerHTML = '';

    // oldest → newest left to right
    const sorted = [...this.memories].sort((a, b) => {
      const ta = typeof a.ts === 'number' ? a.ts : new Date(a.ts).getTime();
      const tb = typeof b.ts === 'number' ? b.ts : new Date(b.ts).getTime();
      return ta - tb;
    });

    if (!sorted.length) {
      container.innerHTML = `<div class="weekly-empty">no memories yet</div>`;
      return;
    }

    sorted.forEach((mem, i) => {
      const moodColor = mem.mood ? mem.mood.c[0] : '#b48ef5';
      const side = i % 2 === 0 ? 'tl-top' : 'tl-bottom';

      const entry = document.createElement('div');
      entry.className = `tl-entry ${side}`;

      const card = document.createElement('div');
      card.className = 'tl-card';
      card.innerHTML = mem.sketch
        ? `<img class="tl-sketch" src="${mem.sketch}" alt="sketch">`
        : `<div class="tl-card-no-sketch" style="background:linear-gradient(135deg,${moodColor}18,${moodColor}08)"></div>`;
      card.addEventListener('click', () => {
        this._closeTimelinePanel();
        this._openPopup(mem);
      });

      const dot = document.createElement('div');
      dot.className = 'tl-dot';
      dot.style.background = moodColor;

      const label = document.createElement('div');
      label.className = 'tl-date-label';
      label.textContent = mem.date
        ? new Date(mem.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        : '';

      entry.appendChild(card);
      entry.appendChild(dot);
      entry.appendChild(label);
      container.appendChild(entry);
    });

    // fixed spine line on panel-card (doesn't scroll with container)
    const panelCard = panel.querySelector('.timeline-panel-card');
    let spineEl = panelCard.querySelector('.tl-spine-fixed');
    if (!spineEl) {
      spineEl = document.createElement('div');
      spineEl.className = 'tl-spine-fixed';
      panelCard.appendChild(spineEl);
    }
    spineEl.style.top = (container.offsetTop + Math.round(container.offsetHeight / 2)) + 'px';

    // drag-to-scroll
    let _ds = false, _sx = 0, _sl = 0;
    container.addEventListener('mousedown', e => { _ds = true; _sx = e.pageX - container.offsetLeft; _sl = container.scrollLeft; });
    container.addEventListener('mouseleave', () => { _ds = false; });
    container.addEventListener('mouseup', () => { _ds = false; });
    container.addEventListener('mousemove', e => { if (!_ds) return; e.preventDefault(); container.scrollLeft = _sl - (e.pageX - container.offsetLeft - _sx); });
  }

  _closeTimelinePanel() {
    const panel = document.getElementById('timelinePanel');
    panel.classList.remove('open');
    panel.setAttribute('aria-hidden', 'true');
  }

  /* ── Popup ────────────────────────────────────── */

  _openPopup(mem) {
    const body = document.getElementById('popupBody');
    const popup = document.getElementById('memoryPopup');

    // Look up click count from the live MemObj
    const obj = this.world.objects.find(o => o.mem.id === mem.id);
    mem._clickCount = obj ? obj.clickCount : (mem._clickCount || 0);

    // If media already cached, show everything immediately; otherwise show what we have now
    const mediaReady = mem.isWeekly || mem.audio !== undefined || mem.images !== undefined;
    this._renderPopupContent(mem, body, mediaReady);

    this._popupOpenedAt = Date.now();
    popup.classList.add('open');
    popup.setAttribute('aria-hidden', 'false');

    // Lazy-load audio/images in background if not yet fetched
    if (!mem.isWeekly && mem.audio === undefined && mem.images === undefined) {
      // Show a subtle loading indicator in the footer area
      const loadingIndicator = document.createElement('div');
      loadingIndicator.className = 'pop-media-loading';
      loadingIndicator.textContent = 'loading media…';
      body.appendChild(loadingIndicator);

      sb.loadMemoryFull(mem.id).then(full => {
        // Only update if the same popup is still open
        if (!popup.classList.contains('open')) return;
        if (full) {
          mem.audio  = full.audio  ?? null;
          mem.images = full.images ?? null;
        } else {
          mem.audio  = null;
          mem.images = null;
        }
        // Re-render with full data
        this._renderPopupContent(mem, body, true);
      });
    }
  }

  _renderPopupContent(mem, body, includeMedia) {
    const dateLong = formatDateLong(mem.date);
    const timeStr  = mem.time ? `<span class="pop-time">${mem.time}</span>` : '';
    let html = `<div class="pop-date">${dateLong}${timeStr}</div>`;

    if (!mem.isWeekly && mem._clickCount > 0) {
      html += `<div class="pop-click-count">${mem._clickCount} ${mem._clickCount === 1 ? 'visit' : 'visits'}</div>`;
    }

    if (mem.isWeekly) {
      html += `<div class="pop-weekly-badge">✦ weekly echo &nbsp;·&nbsp; ${mem.count || ''} memories</div>`;
    }

    if (mem.sketch) {
      html += `<img class="pop-sketch" src="${mem.sketch}" alt="sketch">`;
    }

    if (includeMedia && mem.images && mem.images.length) {
      html += `<div class="pop-images">`;
      mem.images.forEach((src, i) => {
        html += `<img class="pop-photo" src="${src}" alt="photo ${i + 1}">`;
      });
      html += `</div>`;
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

    // Footer: audio player + download + delete
    if (!mem.isWeekly) {
      const foot = document.createElement('div');
      foot.className = 'popup-foot';

      if (includeMedia && mem.audio) {
        const audioWrap = document.createElement('div');
        audioWrap.className = 'pop-audio-wrap';
        const playBtn = document.createElement('button');
        playBtn.className = 'pop-audio-btn';
        playBtn.innerHTML = '&#9654;';
        playBtn.setAttribute('aria-label', 'Play recording');
        const bar = document.createElement('div');
        bar.className = 'pop-audio-bar';
        const prog = document.createElement('div');
        prog.className = 'pop-audio-progress';
        bar.appendChild(prog);
        audioWrap.appendChild(playBtn);
        audioWrap.appendChild(bar);
        foot.appendChild(audioWrap);

        let audioEl = null;
        playBtn.addEventListener('click', () => {
          if (audioEl && !audioEl.paused) {
            audioEl.pause();
            playBtn.innerHTML = '&#9654;';
            return;
          }
          if (!audioEl) {
            audioEl = new Audio(mem.audio);
            audioEl.ontimeupdate = () => {
              if (audioEl.duration) prog.style.width = `${(audioEl.currentTime / audioEl.duration) * 100}%`;
            };
            audioEl.onended = () => { playBtn.innerHTML = '&#9654;'; prog.style.width = '100%'; };
          }
          audioEl.play();
          playBtn.innerHTML = '&#9646;&#9646;';
        });
      }

      if (mem.sketch) {
        const dlBtn = document.createElement('button');
        dlBtn.className = 'dl-btn';
        dlBtn.textContent = 'download';
        dlBtn.addEventListener('click', () => this._downloadMemory(mem));
        foot.appendChild(dlBtn);
      }

      const delBtn = document.createElement('button');
      delBtn.className = 'del-btn';
      delBtn.textContent = 'delete';
      delBtn.addEventListener('click', async () => {
        if (!confirm('Delete this memory?')) return;
        await sb.deleteMemory(mem.id);
        this.memories = this.memories.filter(m => m.id !== mem.id);
        this.world.remove(mem.id);
        this._closePopup();
      });
      foot.appendChild(delBtn);

      body.appendChild(foot);
    }
  }

  _closePopup(e) {
    if (e && this._popupOpenedAt && Date.now() - this._popupOpenedAt < 250) {
      return;
    }

    const popup = document.getElementById('memoryPopup');
    popup.classList.remove('open');
    popup.setAttribute('aria-hidden', 'true');
  }

  _downloadMemory(mem) {
    if (!mem.sketch) return;
    const a = document.createElement('a');
    a.download = `memory-${mem.date || 'entry'}.png`;
    a.href = mem.sketch;
    a.click();
  }

  _renderEntryBlock(mem, index, showLabel) {
    let html = `<section class="pop-day-entry">`;

    if (showLabel) {
      html += `<div class="pop-entry-label">entry ${index}</div>`;
    }

    if (mem.location) {
      const locName = mem.location.name || `${mem.location.lat.toFixed(4)}, ${mem.location.lng.toFixed(4)}`;
      html += `<div class="pop-location">&#x2316; ${escHtml(locName)}</div>`;
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
