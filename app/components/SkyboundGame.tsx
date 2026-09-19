'use client';

import { useEffect, useRef } from 'react';

const GAME_WIDTH = 800;
const GAME_HEIGHT = 520;
const PLAYABLE_HEIGHT = GAME_HEIGHT;

const PILLAR_PAIR = {
  x: 560,
  width: 72,
  topHeight: 180,
  gapHeight: 160,
};

const PLAYER = {
    x: 150,
    y: 230,
    width: 56,
    height: 56,
};

export default function SkyboundGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) return;

    const context = canvas.getContext('2d');

    if (!context) return;

    const player = { ...PLAYER, velocity: 0};
    const playerImage = new Image();
    let isPlayerImageLoaded = false;
    
    playerImage.onload = () => {
      isPlayerImageLoaded = true;
    };

    playerImage.src = '/mico-man.png';

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

    // Draw the game scene
    const drawScene = () => {
      context.clearRect(0,0, GAME_WIDTH, GAME_HEIGHT);

      const sky = context.createLinearGradient(0, 0, 0, GAME_HEIGHT);
      sky.addColorStop(0, '#7dd3fc');
      sky.addColorStop(1, '#dcfce7');

      context.fillStyle = sky;
      context.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

      context.fillStyle = '#14532d';

      for (let x = 40; x < GAME_WIDTH; x += 110) {
        context.beginPath();
        context.moveTo(x, GAME_HEIGHT);
        context.lineTo(x + 36, GAME_HEIGHT - 190);
        context.lineTo(x + 72, GAME_HEIGHT);
        context.fill();
      }

      if (isPlayerImageLoaded) {
        context.drawImage(playerImage, player.x, player.y, PLAYER.width, PLAYER.height);
      }
      
      const bottomY = PILLAR_PAIR.topHeight + PILLAR_PAIR.gapHeight;
      const bottomHeight = PLAYABLE_HEIGHT - bottomY;
      
      context.fillStyle = '#64748b';
      context.fillRect(PILLAR_PAIR.x, 0, PILLAR_PAIR.width, PILLAR_PAIR.topHeight);
      context.fillRect(PILLAR_PAIR.x, bottomY, PILLAR_PAIR.width, bottomHeight);

      
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