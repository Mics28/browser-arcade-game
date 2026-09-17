'use client';

import { useEffect, useRef } from 'react';

const GAME_WIDTH = 800;
const GAME_HEIGHT = 520;
const PLAYER = {
    x: 150,
    y: 230,
    width: 56,
    height: 38,
};

export default function SkyboundGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) return;

    const context = canvas.getContext('2d');

    if (!context) return;

    const player = { ...PLAYER, velocity: 0};
    const GRAVITY = 0.12;
    const FLAP_VELOCITY = -4.8;

    const flap = () => {
      player.velocity = FLAP_VELOCITY;
    };

    let animationFrameId = 0;

    const handleKeyDown= (event: KeyboardEvent) => {
      if (event.code !== 'Space') return;

      event.preventDefault();

      if (event.repeat) return;

      flap();
    };

    window.addEventListener('keydown', handleKeyDown);

    const handlePointerDown = (event: PointerEvent) => {
      event.preventDefault();
      flap();
    };

    canvas.addEventListener('pointerdown', handlePointerDown);

    const drawScene = () => {
      context.clearRect(0,0, GAME_WIDTH, GAME_HEIGHT);

      const sky = context.createLinearGradient(0, 0, 0, GAME_HEIGHT);
      sky.addColorStop(0, '#7dd3fc');
      sky.addColorStop(1, '#dcfce7');

      context.fillStyle = sky;
      context.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

      context.fillStyle = '#166534';
      context.fillRect(0, GAME_HEIGHT - 72, GAME_WIDTH, 72);

      context.fillStyle = '#14532d';

      for (let x = 40; x < GAME_WIDTH; x += 110) {
        context.beginPath();
        context.moveTo(x, GAME_HEIGHT - 72);
        context.lineTo(x + 36, GAME_HEIGHT - 190);
        context.lineTo(x + 72, GAME_HEIGHT - 72);
        context.fill();
      }

      context.fillStyle = '#f8fafc';
      context.strokeStyle = '#334155';
      context.lineWidth = 2;

      // Gliders Orientation
      context.beginPath();
      context.moveTo(player.x, player.y);
      context.lineTo(player.x + player.width, player.y + player.height / 2);
      context.lineTo(player.x, player.y + player.height);
      context.closePath();

      context.fill();
      context.stroke();

    };

    const update = () => {
      player.velocity += GRAVITY;
      player.y += player.velocity;

      drawScene();
      animationFrameId = window.requestAnimationFrame(update);
    };

    drawScene();
    animationFrameId = window.requestAnimationFrame(update);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      canvas.removeEventListener('pointerdown', handlePointerDown);
      window.cancelAnimationFrame(animationFrameId);
    };

  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-8 text-white">
      <section className="w-full max-w-[800px]">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">Skybound</h1>
          <p className="rounded-full bg-white/10 px-4 py-2 font-semibold">
            Score: 0
          </p>
        </div>

        <canvas
          ref={canvasRef}
          width={GAME_WIDTH}
          height={GAME_HEIGHT}
          aria-label="Skybound game area"
          className="touch-none h-auto w-full rounded-2xl border-4 border-emerald-900 shadow-2xl"
        />

        <p className="mt-4 text-center text-sm text-slate-300">
          A forest flight awaits.
        </p>
      </section>
    </main>
  );
}