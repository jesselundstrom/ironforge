window.createLoginSparksController = function createLoginSparksController() {
  const MIN_EMBERS = 18;
  const MAX_EMBERS = 34;
  const COLOR_A = [255, 122, 58];
  const COLOR_B = [255, 176, 103];

  let canvas = null;
  let ctx = null;
  let embers = [];
  let width = 0;
  let height = 0;
  let dpr = 1;
  let animationId = 0;
  let isRunning = false;
  let lastTs = 0;
  let reducedMotionQuery = null;
  let isReducedMotion = false;

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function emberColor(t, alpha) {
    const r = Math.round(lerp(COLOR_A[0], COLOR_B[0], t));
    const g = Math.round(lerp(COLOR_A[1], COLOR_B[1], t));
    const b = Math.round(lerp(COLOR_A[2], COLOR_B[2], t));
    return `rgba(${r},${g},${b},${alpha})`;
  }

  function resetEmber(ember, initial) {
    const fromForge = Math.random() < 0.82;
    const originX = width * 0.5;
    const spread = fromForge ? width * 0.32 : width * 0.72;

    ember.size = fromForge ? 0.8 + Math.random() * 1.8 : 0.6 + Math.random() * 1.2;
    ember.x = fromForge
      ? originX + (Math.random() - 0.5) * spread
      : Math.random() * width;
    ember.y = initial
      ? fromForge
        ? height * 0.64 + Math.random() * height * 0.22
        : height * 0.4 + Math.random() * height * 0.36
      : fromForge
        ? height * 0.8 + Math.random() * height * 0.12
        : height * 0.58 + Math.random() * height * 0.24;
    ember.speed = fromForge ? 8 + Math.random() * 16 : 6 + Math.random() * 10;
    ember.drift = (Math.random() - 0.5) * (fromForge ? 8 : 4);
    ember.phase = Math.random() * Math.PI * 2;
    ember.wiggle = 0.35 + Math.random() * 0.95;
    ember.life = 0.55 + Math.random() * 0.95;
    ember.alpha = fromForge ? 0.24 + Math.random() * 0.36 : 0.16 + Math.random() * 0.22;
    ember.t = Math.random();
  }

  function resize() {
    if (!canvas || !ctx) return;
    const rect = canvas.getBoundingClientRect();
    width = Math.max(1, Math.floor(rect.width));
    height = Math.max(1, Math.floor(rect.height));
    dpr = clamp(window.devicePixelRatio || 1, 1, 1.75);
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!embers.length) {
      const total = Math.floor(lerp(MIN_EMBERS, MAX_EMBERS, Math.random()));
      embers = Array.from({ length: total }, () => {
        const ember = {};
        resetEmber(ember, true);
        return ember;
      });
    }
  }

  function draw(ts) {
    if (!isRunning || !ctx) return;
    if (!lastTs) lastTs = ts;
    const dt = Math.min((ts - lastTs) / 1000, 0.033);
    lastTs = ts;

    ctx.clearRect(0, 0, width, height);
    for (let index = 0; index < embers.length; index += 1) {
      const ember = embers[index];
      ember.y -= ember.speed * dt;
      ember.x += (ember.drift + Math.sin(ts * 0.0012 + ember.phase) * ember.wiggle * 3.8) * dt;
      ember.life -= dt * 0.22;
      ember.alpha = Math.max(0, ember.alpha - dt * 0.024);

      if (ember.y < -10 || ember.life <= 0 || ember.alpha <= 0) {
        resetEmber(ember, false);
      }

      const fadeTop = clamp((height - ember.y) / (height * 0.9), 0, 1);
      const alpha = ember.alpha * (1 - fadeTop * 0.88);
      if (alpha <= 0.01) continue;

      ctx.beginPath();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = emberColor(ember.t, alpha);
      ctx.shadowColor = emberColor(ember.t, alpha * 0.6);
      ctx.shadowBlur = 3;
      ctx.arc(ember.x, ember.y, ember.size, 0, Math.PI * 2);
      ctx.fill();
    }

    const forgeGlow = ctx.createRadialGradient(
      width * 0.5,
      height * 0.82,
      8,
      width * 0.5,
      height * 0.82,
      height * 0.2
    );
    forgeGlow.addColorStop(0, 'rgba(255,132,46,0.18)');
    forgeGlow.addColorStop(0.52, 'rgba(255,120,40,0.09)');
    forgeGlow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = forgeGlow;
    ctx.fillRect(0, 0, width, height);

    ctx.shadowBlur = 0;
    animationId = requestAnimationFrame(draw);
  }

  function onMotionPreferenceChange(event) {
    isReducedMotion = !!event.matches;
    if (isReducedMotion) {
      isRunning = false;
      if (animationId) cancelAnimationFrame(animationId);
      animationId = 0;
      lastTs = 0;
      window.removeEventListener('resize', resize);
      if (ctx && width && height) ctx.clearRect(0, 0, width, height);
      return;
    }
    if (!isRunning && canvas && ctx) {
      resize();
      lastTs = 0;
      isRunning = true;
      window.addEventListener('resize', resize);
      animationId = requestAnimationFrame(draw);
    }
  }

  function start() {
    if (isRunning) return;
    canvas = document.getElementById('sparks');
    if (!canvas) return;
    ctx = canvas.getContext('2d');
    if (!ctx) return;

    reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    isReducedMotion = !!reducedMotionQuery.matches;
    if (reducedMotionQuery.addEventListener) {
      reducedMotionQuery.addEventListener('change', onMotionPreferenceChange);
    } else if (reducedMotionQuery.addListener) {
      reducedMotionQuery.addListener(onMotionPreferenceChange);
    }

    resize();
    if (isReducedMotion) return;
    lastTs = 0;
    isRunning = true;
    window.addEventListener('resize', resize);
    animationId = requestAnimationFrame(draw);
  }

  function stop() {
    isRunning = false;
    if (animationId) cancelAnimationFrame(animationId);
    animationId = 0;
    lastTs = 0;
    if (reducedMotionQuery) {
      if (reducedMotionQuery.removeEventListener) {
        reducedMotionQuery.removeEventListener('change', onMotionPreferenceChange);
      } else if (reducedMotionQuery.removeListener) {
        reducedMotionQuery.removeListener(onMotionPreferenceChange);
      }
    }
    reducedMotionQuery = null;
    window.removeEventListener('resize', resize);
    if (ctx && width && height) ctx.clearRect(0, 0, width, height);
  }

  return { start, stop };
};
