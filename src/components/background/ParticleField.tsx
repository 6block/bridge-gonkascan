import { useEffect, useRef } from "react";

/**
 * Diffusing gold-dust field. A sparse cloud of soft motes drifts on a slow
 * baseline and scatters outward when the cursor passes, then settles back.
 *
 * Performance is the whole point here (an earlier full-res additive version
 * janked). The wins, in order of impact:
 *  - render the buffer at RENDER_SCALE of CSS size and let the GPU upscale it.
 *    The motes are soft glows, so the blur is invisible, and fill-rate (the
 *    real cost) drops ~4x versus a retina buffer;
 *  - keep the mote count low and the sprites small to bound overdraw;
 *  - one cached radial sprite, one rAF loop, zero per-frame allocation;
 *  - park the loop when the tab is hidden;
 *  - prefers-reduced-motion renders a single static frame.
 */

const RENDER_SCALE = 0.6; // internal buffer density vs. CSS pixels
const MOTE_CAP = 120;
const AREA_PER_MOTE = 14000; // px² of viewport per mote, before the cap
const CURSOR_DIST = 170; // cursor influence radius (CSS px)
const CURSOR_PUSH = 0.8; // scatter strength near the cursor
const DAMP = 0.92; // velocity decay toward the baseline drift
const SPRITE = 48; // offscreen glow-sprite size in px

// Pale champagne gold — lighter than the accent so the dust reads as soft light.
const DUST = "245, 227, 168";

interface Mote {
  x: number;
  y: number;
  vx: number;
  vy: number;
  dx: number; // baseline drift, re-injected each frame so motion never dies
  dy: number;
  size: number;
  a: number; // base alpha
}

export function ParticleField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // --- cached glow sprite: a radial gold falloff drawn once ---
    const sprite = document.createElement("canvas");
    sprite.width = sprite.height = SPRITE;
    const sctx = sprite.getContext("2d")!;
    const grad = sctx.createRadialGradient(SPRITE / 2, SPRITE / 2, 0, SPRITE / 2, SPRITE / 2, SPRITE / 2);
    grad.addColorStop(0, `rgba(${DUST}, 0.9)`);
    grad.addColorStop(0.3, `rgba(${DUST}, 0.32)`);
    grad.addColorStop(1, `rgba(${DUST}, 0)`);
    sctx.fillStyle = grad;
    sctx.fillRect(0, 0, SPRITE, SPRITE);

    const motes: Mote[] = [];
    const pointer = { x: -9999, y: -9999, active: false };
    let w = 0;
    let h = 0;
    let raf = 0;
    let running = false;

    const rand = (min: number, max: number) => min + Math.random() * (max - min);

    const seed = () => {
      const target = Math.min(MOTE_CAP, Math.round((w * h) / AREA_PER_MOTE));
      motes.length = 0;
      for (let i = 0; i < target; i++) {
        const big = Math.random() < 0.2;
        motes.push({
          x: rand(0, w),
          y: rand(0, h),
          vx: 0,
          vy: 0,
          dx: rand(-0.1, 0.1),
          dy: rand(-0.12, 0.05), // faint upward bias
          size: big ? rand(26, 42) : rand(7, 16),
          a: big ? rand(0.08, 0.15) : rand(0.2, 0.4),
        });
      }
    };

    const resize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.floor(w * RENDER_SCALE);
      canvas.height = Math.floor(h * RENDER_SCALE);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      // Draw in CSS-pixel coordinates; the buffer is just lower-density.
      ctx.setTransform(RENDER_SCALE, 0, 0, RENDER_SCALE, 0, 0);
      seed();
    };

    const step = () => {
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = "lighter";

      for (let i = 0; i < motes.length; i++) {
        const m = motes[i];

        if (pointer.active) {
          const ax = m.x - pointer.x;
          const ay = m.y - pointer.y;
          const d2 = ax * ax + ay * ay;
          if (d2 < CURSOR_DIST * CURSOR_DIST && d2 > 0.01) {
            const d = Math.sqrt(d2);
            const force = (1 - d / CURSOR_DIST) * CURSOR_PUSH;
            m.vx += (ax / d) * force;
            m.vy += (ay / d) * force;
          }
        }

        m.vx = m.vx * DAMP + m.dx;
        m.vy = m.vy * DAMP + m.dy;
        m.x += m.vx;
        m.y += m.vy;

        if (m.x < -m.size) m.x = w + m.size;
        else if (m.x > w + m.size) m.x = -m.size;
        if (m.y < -m.size) m.y = h + m.size;
        else if (m.y > h + m.size) m.y = -m.size;

        const s = m.size;
        ctx.globalAlpha = m.a;
        ctx.drawImage(sprite, m.x - s / 2, m.y - s / 2, s, s);
      }

      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";

      if (running) raf = requestAnimationFrame(step);
    };

    const start = () => {
      if (running || reduced) return;
      running = true;
      raf = requestAnimationFrame(step);
    };
    const stop = () => {
      running = false;
      cancelAnimationFrame(raf);
    };

    const onPointerMove = (e: PointerEvent) => {
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      pointer.active = true;
    };
    const onPointerLeave = () => {
      pointer.active = false;
    };
    const onVisibility = () => {
      if (document.hidden) stop();
      else start();
    };

    resize();
    if (reduced) {
      step();
    } else {
      start();
    }

    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerout", onPointerLeave);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      stop();
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerout", onPointerLeave);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return <canvas ref={canvasRef} className="particle-field" aria-hidden="true" />;
}
