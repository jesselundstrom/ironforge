type BurstPalette = [number, number, number][];

type ForgeBurstOptions = {
  densityMultiplier?: number;
  duration?: number;
  originX?: number;
  originY?: number;
  glowFrom?: number;
  glowTo?: number;
  palette?: BurstPalette | null;
};

type Ember = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  gravity: number;
  drag: number;
  size: number;
  alpha: number;
  life: number;
  age: number;
  t: number;
};

const COLOR_A: [number, number, number] = [255, 122, 58];
const COLOR_B: [number, number, number] = [255, 176, 103];

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function boundedNumber(
  value: unknown,
  fallback: number,
  min: number,
  max: number
) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? clamp(parsed, min, max) : fallback;
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

export function playForgeBurst(
  canvas: HTMLCanvasElement | null,
  options?: ForgeBurstOptions
) {
  if (!(canvas instanceof HTMLCanvasElement)) return () => {};
  const target = canvas;
  const ctx = target.getContext('2d');
  if (!ctx) return () => {};
  const context: CanvasRenderingContext2D = ctx;

  const prefersReducedMotion =
    window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
    document.documentElement.classList.contains('test-env');
  if (prefersReducedMotion) {
    const rect = target.getBoundingClientRect();
    const width = Math.max(1, Math.floor(rect.width || target.clientWidth || 1));
    const height = Math.max(1, Math.floor(rect.height || target.clientHeight || 1));
    const dpr = clamp(window.devicePixelRatio || 1, 1, 1.75);
    target.width = Math.floor(width * dpr);
    target.height = Math.floor(height * dpr);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, width, height);
    return () => context.clearRect(0, 0, width, height);
  }

  const config = {
    densityMultiplier: 1,
    duration: 980,
    originX: 0.5,
    originY: 0.84,
    glowFrom: 0.18,
    glowTo: 0.4,
    palette: null,
    ...(options || {}),
  };
  const densityMultiplier = boundedNumber(
    config.densityMultiplier,
    1,
    0.25,
    2.5
  );
  const durationMs = boundedNumber(config.duration, 980, 120, 2000);
  const originXRatio = boundedNumber(config.originX, 0.5, 0, 1);
  const originYRatio = boundedNumber(config.originY, 0.84, 0, 1);
  const glowFrom = boundedNumber(config.glowFrom, 0.18, 0, 1);
  const glowTo = boundedNumber(config.glowTo, 0.4, 0, 1);
  const emberColor = (t: number, alpha: number) => {
    const palette =
      Array.isArray(config.palette) && config.palette.length >= 2
        ? config.palette
        : [COLOR_A, COLOR_B];
    const start = palette[0];
    const end = palette[Math.min(1, palette.length - 1)] || palette[0];
    return `rgba(${Math.round(lerp(start[0], end[0], t))},${Math.round(
      lerp(start[1], end[1], t)
    )},${Math.round(lerp(start[2], end[2], t))},${alpha})`;
  };

  let width = 0;
  let height = 0;
  let rafId = 0;
  let startTs = 0;
  let lastTs = 0;
  let embers: Ember[] = [];

  function resize() {
    const rect = target.getBoundingClientRect();
    width = Math.max(1, Math.floor(rect.width || target.clientWidth || 1));
    height = Math.max(1, Math.floor(rect.height || target.clientHeight || 1));
    const dpr = clamp(window.devicePixelRatio || 1, 1, 1.75);
    target.width = Math.floor(width * dpr);
    target.height = Math.floor(height * dpr);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function buildEmbers() {
    const total = Math.max(18, Math.round(32 * densityMultiplier));
    const originX = width * originXRatio;
    const originY = height * originYRatio;
    embers = Array.from({ length: total }, (_, index) => {
      const spread = Math.PI * (0.65 + Math.random() * 0.4);
      const baseAngle =
        -Math.PI / 2 + (index / Math.max(1, total - 1) - 0.5) * spread;
      const angle = baseAngle + (Math.random() - 0.5) * 0.32;
      const speed = 190 + Math.random() * 210;
      const lift = 0.72 + Math.random() * 0.4;
      return {
        x: originX + (Math.random() - 0.5) * 28,
        y: originY + Math.random() * 18,
        vx: Math.cos(angle) * speed * 0.55,
        vy: Math.sin(angle) * speed * lift,
        gravity: 140 + Math.random() * 70,
        drag: 0.9 + Math.random() * 0.06,
        size: 1.6 + Math.random() * 3,
        alpha: 0.42 + Math.random() * 0.42,
        life: 0.62 + Math.random() * 0.38,
        age: 0,
        t: Math.random(),
      };
    });
  }

  function cleanup() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
    context.clearRect(0, 0, width, height);
  }

  function draw(ts: number) {
    if (!startTs) {
      startTs = ts;
      lastTs = ts;
    }
    const dt = Math.min((ts - lastTs) / 1000, 0.033);
    lastTs = ts;
    const elapsed = ts - startTs;
    const progress = clamp(elapsed / durationMs, 0, 1);
    const glowStrength = lerp(
      glowFrom,
      glowTo,
      easeOutCubic(Math.min(1, elapsed / 600))
    );

    context.clearRect(0, 0, width, height);
    const originX = width * originXRatio;
    const originY = height * originYRatio;
    const glow = context.createRadialGradient(
      originX,
      originY,
      10,
      originX,
      originY,
      height * 0.26
    );
    glow.addColorStop(
      0,
      `rgba(255,132,46,${(glowStrength * (1 - progress * 0.3)).toFixed(3)})`
    );
    glow.addColorStop(
      0.45,
      `rgba(255,120,40,${(glowStrength * 0.52).toFixed(3)})`
    );
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    context.globalCompositeOperation = 'screen';
    context.fillStyle = glow;
    context.fillRect(0, 0, width, height);

    let alive = 0;
    for (const ember of embers) {
      ember.age += dt;
      const lifeProgress = clamp(ember.age / ember.life, 0, 1);
      if (lifeProgress >= 1) continue;
      alive += 1;
      ember.vx *= ember.drag;
      ember.vy += ember.gravity * dt;
      ember.x += ember.vx * dt;
      ember.y += ember.vy * dt;
      const alpha = ember.alpha * (1 - lifeProgress) * (1 - progress * 0.16);
      if (alpha <= 0.01) continue;
      context.beginPath();
      context.globalCompositeOperation = 'lighter';
      context.fillStyle = emberColor(ember.t, alpha);
      context.shadowColor = emberColor(ember.t, alpha * 0.8);
      context.shadowBlur = 6;
      context.arc(
        ember.x,
        ember.y,
        ember.size * (1 - lifeProgress * 0.2),
        0,
        Math.PI * 2
      );
      context.fill();
    }
    context.shadowBlur = 0;

    if (progress < 1 && alive > 0) {
      rafId = requestAnimationFrame(draw);
      return;
    }
    cleanup();
  }

  resize();
  buildEmbers();
  rafId = requestAnimationFrame(draw);
  window.addEventListener('resize', resize, { once: true });
  return () => {
    window.removeEventListener('resize', resize);
    cleanup();
  };
}
