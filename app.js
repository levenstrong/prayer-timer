/* St. Gregory's Prayer Timer — app.js */
(function () {
  'use strict';

  // ── Config ──
  const SUPABASE_URL = 'https://znigtcsnkfghvzyggzgk.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_P2yUXF3ICRzdsvAkiYomjQ_WhQRAnPl';
  const API_BASE = '/.netlify/functions/candles';

  // ── DOM refs ──
  const screens = {
    landing: document.getElementById('screen-landing'),
    setup: document.getElementById('screen-setup'),
    meditation: document.getElementById('screen-meditation'),
    post: document.getElementById('screen-post'),
  };

  const candleListEl = document.getElementById('candle-list');
  const durationEl = document.getElementById('duration-display');
  const timerEl = document.getElementById('timer-display');
  const nameInput = document.getElementById('candle-name');
  const commentInput = document.getElementById('candle-comment');
  const nameCount = document.getElementById('name-count');
  const commentCount = document.getElementById('comment-count');

  // ── State ──
  let duration = 20; // minutes
  let timerInterval = null;
  let wakeLock = null;
  let audioCtx = null;

  // ── Screen navigation ──
  function showScreen(name) {
    Object.values(screens).forEach(s => s.classList.remove('active'));
    screens[name].classList.add('active');
    screens[name].scrollTo?.(0, 0);
    window.scrollTo(0, 0);
  }

  // ── Relative time ──
  function relativeTime(dateStr) {
    const now = Date.now();
    const then = new Date(dateStr).getTime();
    const diffMs = now - then;
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return mins === 1 ? '1 minute ago' : mins + ' minutes ago';
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return hrs === 1 ? '1 hour ago' : hrs + ' hours ago';
    const days = Math.floor(hrs / 24);
    return days === 1 ? '1 day ago' : days + ' days ago';
  }

  // ── Candle wall ──
  async function loadCandles() {
    candleListEl.innerHTML = '<p class="candle-empty">Loading candles…</p>';
    try {
      const res = await fetch(API_BASE);
      if (!res.ok) throw new Error('Failed to load');
      const candles = await res.json();
      renderCandles(candles);
    } catch {
      candleListEl.innerHTML = '<p class="candle-empty">Could not load candles.</p>';
    }
  }

  function renderCandles(candles) {
    if (!candles.length) {
      candleListEl.innerHTML = '<p class="candle-empty">No candles yet. Be the first to light one.</p>';
      return;
    }
    candleListEl.innerHTML = candles.map(c => `
      <div class="candle-card">
        <span class="candle-icon" aria-hidden="true">🕯️</span>
        <div class="candle-body">
          <div class="candle-name">${esc(c.name)}</div>
          <div class="candle-comment">${esc(c.comment)}</div>
          <div class="candle-time">${relativeTime(c.created_at)}</div>
        </div>
      </div>
    `).join('');
  }

  function esc(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  async function submitCandle(name, comment) {
    await fetch(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, comment }),
    });
  }

  // ── Audio with fade-out ──
  function getAudioCtx() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    return audioCtx;
  }

  async function playBell(url) {
    const ctx = getAudioCtx();
    if (ctx.state === 'suspended') await ctx.resume();
    const res = await fetch(url);
    const buf = await res.arrayBuffer();
    const decoded = await ctx.decodeAudioData(buf);
    const source = ctx.createBufferSource();
    source.buffer = decoded;
    const gain = ctx.createGain();
    gain.gain.value = 1;
    source.connect(gain).connect(ctx.destination);

    const dur = decoded.duration;
    const fadeStart = Math.max(0, dur - 10);
    gain.gain.setValueAtTime(1, ctx.currentTime + fadeStart);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + dur);

    source.start(0);
    return source;
  }

  // ── Wake Lock ──
  async function requestWakeLock() {
    try {
      if ('wakeLock' in navigator) {
        wakeLock = await navigator.wakeLock.request('screen');
      }
    } catch { /* unsupported or denied */ }
  }

  function releaseWakeLock() {
    wakeLock?.release?.();
    wakeLock = null;
  }

  // ── Timer ──
  function startTimer(minutes) {
    let remaining = minutes * 60;
    updateTimerDisplay(remaining);
    showScreen('meditation');
    playBell('assets/start-bell.mp3');
    requestWakeLock();

    // announce to screen readers every 60s
    let srCounter = 0;
    timerEl.setAttribute('aria-live', 'off');

    timerInterval = setInterval(() => {
      remaining--;
      if (remaining <= 0) {
        remaining = 0;
        clearInterval(timerInterval);
        timerInterval = null;
        updateTimerDisplay(0);
        releaseWakeLock();
        playBell('assets/end-bell.mp3');
        setTimeout(() => showScreen('post'), 2500);
        return;
      }
      updateTimerDisplay(remaining);
      srCounter++;
      if (srCounter % 60 === 0) {
        timerEl.setAttribute('aria-live', 'polite');
        requestAnimationFrame(() => timerEl.setAttribute('aria-live', 'off'));
      }
    }, 1000);
  }

  function updateTimerDisplay(secs) {
    const m = String(Math.floor(secs / 60)).padStart(2, '0');
    const s = String(secs % 60).padStart(2, '0');
    timerEl.textContent = m + ':' + s;
  }

  // ── Event listeners ──
  document.getElementById('btn-begin').addEventListener('click', () => {
    showScreen('setup');
  });

  document.getElementById('btn-back-landing').addEventListener('click', () => {
    showScreen('landing');
  });

  document.getElementById('btn-minus').addEventListener('click', () => {
    if (duration > 1) {
      duration--;
      durationEl.textContent = duration;
    }
  });

  document.getElementById('btn-plus').addEventListener('click', () => {
    if (duration < 60) {
      duration++;
      durationEl.textContent = duration;
    }
  });

  document.getElementById('btn-start').addEventListener('click', () => {
    startTimer(duration);
  });

  nameInput.addEventListener('input', () => {
    nameCount.textContent = nameInput.value.length;
  });

  commentInput.addEventListener('input', () => {
    commentCount.textContent = commentInput.value.length;
  });

  document.getElementById('candle-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = nameInput.value.trim();
    const comment = commentInput.value.trim();
    if (!name || !comment) return;

    const btn = e.target.querySelector('.btn-primary');
    btn.disabled = true;
    btn.textContent = 'Sending…';
    try {
      await submitCandle(name, comment);
    } catch { /* fail silently */ }
    nameInput.value = '';
    commentInput.value = '';
    nameCount.textContent = '0';
    commentCount.textContent = '0';
    btn.disabled = false;
    btn.textContent = 'Light a Candle';
    await loadCandles();
    showScreen('landing');
  });

  document.getElementById('btn-skip').addEventListener('click', () => {
    showScreen('landing');
  });

  // ── Init ──
  loadCandles();
})();
