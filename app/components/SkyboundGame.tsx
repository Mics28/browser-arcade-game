'use client';

import { useEffect, useRef, useState } from 'react';

// --------------------------------------------------
// GAME CONFIGURATION
// --------------------------------------------------

// Fixed dimensions used as the game's internal coordinate system.
const GAME_WIDTH = 800;
const GAME_HEIGHT = 520;
const PLAYABLE_HEIGHT = GAME_HEIGHT;

// --------------------------------------------------
// PILLAR CONFIGURATION
// --------------------------------------------------

type PillarPair = {
  x: number;
  width: number;
  topHeight: number;
  gapHeight: number;
  passed: boolean;
};

const PILLAR_WIDTH = 72;

const BASE_GAP_HEIGHT = 160;
const MIN_GAP_HEIGHT = 120;
const GAP_DECREASE = 4;

const MIN_PILLAR_HEIGHT = 70;
const MAX_GAP_VERTICAL_SHIFT = 100;

const BASE_PILLAR_SPEED = 2.5;
const MAX_PILLAR_SPEED = 4.5;
const SPEED_INCREASE = 0.15;

const PILLAR_SPAWN_X = GAME_WIDTH + 40;
const PILLAR_SPACING = 300;

// Persistent browser storage key for the best score.
const BEST_SCORE_STORAGE_KEY = 'skybound-best-score';

function readStoredBestScore(): number {
  if (typeof window === 'undefined') return 0;

  const savedBestScore = window.localStorage.getItem(
    BEST_SCORE_STORAGE_KEY
  );

  const parsedBestScore = Number(savedBestScore);

  return Number.isInteger(parsedBestScore) && parsedBestScore >= 0
    ? parsedBestScore
    : 0;
}

// --------------------------------------------------
// PLAYER CONFIGURATION
// --------------------------------------------------

const PLAYER = {
  x: 150,
  y: 230,
  width: 56,
  height: 56,
};

const PLAYER_HITBOX = {
  offsetX: 12,
  offsetY: 4,
  width: 32,
  height: 49,
};

// --------------------------------------------------
// BACKGROUND CONFIGURATION
// --------------------------------------------------

type BackgroundPalette = {
  skyTop: string;
  skyBottom: string;
  trees: string;
};

function getBackgroundPalette(hour: number): BackgroundPalette {
  if (hour >= 5 && hour < 12) {
    return {
      skyTop: '#7dd3fc',
      skyBottom: '#fef3c7',
      trees: '#166534',
    };
  }

  if (hour >= 12 && hour < 18) {
    return {
      skyTop: '#fb923c',
      skyBottom: '#fed7aa',
      trees: '#7c2d12',
    };
  }

  return {
    skyTop: '#0f172a',
    skyBottom: '#1e3a5f',
    trees: '#020617',
  };
}

// --------------------------------------------------
// GAME STATE
// --------------------------------------------------

type GameState = 'START' | 'PLAYING' | 'GAME_OVER';

// --------------------------------------------------
// MAIN GAME COMPONENT
// --------------------------------------------------

export default function SkyboundGame() {
  // React state controls information that the HTML UI needs to display.
  const [gameState, setGameState] = useState<GameState>('START');
  const [finalScore, setFinalScore] = useState(0);
  const [displayScore, setDisplayScore] = useState(0);
  const [bestScore, setBestScore] = useState(0);

  // Refs provide current values/functions to the long-running Canvas game loop
  // without requiring the loop to be recreated whenever React state changes.
  const gameStateRef = useRef<GameState>('START');
  const bestScoreRef = useRef(bestScore);
  const resetGameRef = useRef<() => void>(() => {});
  const startWithFlapRef = useRef<() => void>(() => {});
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // These functions allow the React UI to trigger game-loop actions.
  const retryGame = () => {
    resetGameRef.current();
  };

  const startFromInput = () => {
    startWithFlapRef.current();
  };

  const startGameFromButton = () => {
    gameStateRef.current = 'PLAYING';
    setGameState('PLAYING');
  };

  // --------------------------------------------------
  // LOAD PERSISTENT BEST SCORE
  // --------------------------------------------------

  useEffect(() => {
    const storedBestScore = readStoredBestScore();

    bestScoreRef.current = storedBestScore;

    window.requestAnimationFrame(() => {
      setBestScore(storedBestScore);
    });
  }, []);

  // --------------------------------------------------
  // CANVAS GAME SETUP
  // --------------------------------------------------

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) return;

    const context = canvas.getContext('2d');

    if (!context) return;

    const palette = getBackgroundPalette(new Date().getHours());

    // --------------------------------------------------
    // RUNTIME GAME DATA
    // --------------------------------------------------

    // These values belong to the Canvas simulation rather than React UI state.
    // They change frequently while the game is running.
    const player = {
      ...PLAYER,
      velocity: 0,
    };

    let score = 0;

    
    // --------------------------------------------------
    // DIFFICULTY
    // --------------------------------------------------

    // Difficulty is calculated from the current score.
    // Speed increases gradually while the gap becomes smaller,
    // with limits preventing the game from becoming uncontrollable.
    const getDifficulty = () => {
      const pillarSpeed = Math.min(
        MAX_PILLAR_SPEED,
        BASE_PILLAR_SPEED + score * SPEED_INCREASE
      );

      const gapHeight = Math.max(
        MIN_GAP_HEIGHT,
        BASE_GAP_HEIGHT - score * GAP_DECREASE
      );

      return { pillarSpeed, gapHeight, };
    };

    // --------------------------------------------------
    // PILLAR GENERATION
    // --------------------------------------------------

    // Generates a pillar pair that satisfies both the game's geometry limits
    // and the vertical fairness rule between consecutive pillar gaps.
    function createPillarPair(
      x: number,
      previousTopHeight?: number
    ): PillarPair {
      const { gapHeight } = getDifficulty();

      const maximumAllowedTopHeight =
        PLAYABLE_HEIGHT - gapHeight - MIN_PILLAR_HEIGHT;

      const minimumTopHeight =
        previousTopHeight === undefined
          ? MIN_PILLAR_HEIGHT
          : Math.max(
              MIN_PILLAR_HEIGHT,
              previousTopHeight - MAX_GAP_VERTICAL_SHIFT
            );

      const maximumTopHeight =
        previousTopHeight === undefined
          ? maximumAllowedTopHeight
          : Math.min(
              maximumAllowedTopHeight,
              previousTopHeight + MAX_GAP_VERTICAL_SHIFT
            );

      const topHeight =
        Math.floor(
          Math.random() *
            (maximumTopHeight - minimumTopHeight + 1)
        ) + minimumTopHeight;

      return {
        x,
        width: PILLAR_WIDTH,
        topHeight,
        gapHeight,
        passed: false,
      };
    }

    const pillarPairs = [
      createPillarPair(PILLAR_SPAWN_X),
    ];


    // --------------------------------------------------
    // PLAYER IMAGE
    // --------------------------------------------------

    const playerImage = new Image();
    let isPlayerImageLoaded = false;

    playerImage.onload = () => {
      isPlayerImageLoaded = true;
    };

    playerImage.src = '/mico-man.png';

    // --------------------------------------------------
    // PLAYER PHYSICS
    // --------------------------------------------------

    const GRAVITY = 0.11;
    const FLAP_VELOCITY = -3.5;

    const flap = () => {
      player.velocity = FLAP_VELOCITY;
    };

    // Starts a game through gameplay input and immediately performs
    // the first flap so the player does not begin falling before acting.
    const startGameWithFlap = () => {
      gameStateRef.current = 'PLAYING';
      setGameState('PLAYING');
      flap();
    };

    startWithFlapRef.current = startGameWithFlap;

    // --------------------------------------------------
    // GAME RESET
    // --------------------------------------------------

    // Retry creates a clean simulation: player physics, pillars, score,
    // and UI state are returned to their initial values.
    const resetGame = () => {
      player.x = PLAYER.x;
      player.y = PLAYER.y;
      player.velocity = 0;

      pillarPairs.splice(
        0,
        pillarPairs.length,
        createPillarPair(PILLAR_SPAWN_X)
      );

      score = 0;

      setDisplayScore(0);
      setFinalScore(0);

      gameStateRef.current = 'START';
      setGameState('START');
    };

    resetGameRef.current = resetGame;

    // --------------------------------------------------
    // BEST SCORE
    // --------------------------------------------------

    // Only update persistent storage when the completed run produces
    // a new record. Existing best scores are never overwritten by a
    // lower score.
    const updateBestScore = () => {
      const nextBestScore = Math.max(
        bestScoreRef.current,
        score
      );

      if (nextBestScore > bestScoreRef.current) {
        bestScoreRef.current = nextBestScore;
        setBestScore(nextBestScore);

        window.localStorage.setItem(
          BEST_SCORE_STORAGE_KEY,
          String(nextBestScore)
        );
      }
    };

    // --------------------------------------------------
    // COLLISION DETECTION
    // --------------------------------------------------

    // Checks whether two rectangles overlap on both horizontal and
    // vertical axes.
    const rectanglesOverlap = (
      first: {
        x: number;
        y: number;
        width: number;
        height: number;
      },
      second: {
        x: number;
        y: number;
        width: number;
        height: number;
      }
    ) => {
      return (
        first.x < second.x + second.width &&
        first.x + first.width > second.x &&
        first.y < second.y + second.height &&
        first.y + first.height > second.y
      );
    };

    // Uses a smaller hitbox than the player's image so collision
    // detection better matches the meaningful part of the player.
    const getPlayerHitbox = () => ({
      x: player.x + PLAYER_HITBOX.offsetX,
      y: player.y + PLAYER_HITBOX.offsetY,
      width: PLAYER_HITBOX.width,
      height: PLAYER_HITBOX.height,
    });

    // Checks both Canvas boundaries and all active pillar pairs.
    const hasCollision = () => {
      const playerHitbox = getPlayerHitbox();

      const hitBoundary =
        playerHitbox.y < 0 ||
        playerHitbox.y + playerHitbox.height > PLAYABLE_HEIGHT;

      const hitPillar = pillarPairs.some((pillarPair) => {
        const bottomY =
          pillarPair.topHeight + pillarPair.gapHeight;

        const bottomHeight =
          PLAYABLE_HEIGHT - bottomY;

        const hitTopPillar = rectanglesOverlap(
          playerHitbox,
          {
            x: pillarPair.x,
            y: 0,
            width: pillarPair.width,
            height: pillarPair.topHeight,
          }
        );

        const hitBottomPillar = rectanglesOverlap(
          playerHitbox,
          {
            x: pillarPair.x,
            y: bottomY,
            width: pillarPair.width,
            height: bottomHeight,
          }
        );

        return hitTopPillar || hitBottomPillar;
      });

      return hitBoundary || hitPillar;
    };

    // --------------------------------------------------
    // KEYBOARD INPUT
    // --------------------------------------------------

    // Space either starts the game with the first flap or performs
    // a normal flap while the game is already running.
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space') return;

      event.preventDefault();

      if (event.repeat) return;

      if (gameStateRef.current === 'START') {
        startGameWithFlap();
        return;
      }

      if (gameStateRef.current !== 'PLAYING') return;

      flap();
    };

    window.addEventListener('keydown', handleKeyDown);

    // --------------------------------------------------
    // POINTER INPUT
    // --------------------------------------------------

    // Canvas pointer input follows the same rules as Space:
    // start with a first flap from START, or flap normally while PLAYING.
    const handlePointerDown = (event: PointerEvent) => {
      event.preventDefault();

      if (gameStateRef.current === 'START') {
        startGameWithFlap();
        return;
      }

      if (gameStateRef.current !== 'PLAYING') return;

      flap();
    };

    canvas.addEventListener(
      'pointerdown',
      handlePointerDown
    );

    // --------------------------------------------------
    // CANVAS RENDERING
    // --------------------------------------------------

    // Draws the current simulation state. Rendering does not decide
    // whether the game is playing; it simply displays the current data.
    const drawScene = () => {
      context.clearRect(
        0,
        0,
        GAME_WIDTH,
        GAME_HEIGHT
      );

      const sky = context.createLinearGradient(
        0,
        0,
        0,
        GAME_HEIGHT
      );

      sky.addColorStop(0, palette.skyTop);
      sky.addColorStop(1, palette.skyBottom);

      context.fillStyle = sky;

      context.fillRect(
        0,
        0,
        GAME_WIDTH,
        GAME_HEIGHT
      );

      context.fillStyle = palette.trees;

      for (
        let x = 40;
        x < GAME_WIDTH;
        x += 110
      ) {
        context.beginPath();
        context.moveTo(x, GAME_HEIGHT);
        context.lineTo(
          x + 36,
          GAME_HEIGHT - 190
        );
        context.lineTo(
          x + 72,
          GAME_HEIGHT
        );
        context.fill();
      }

      if (isPlayerImageLoaded) {
        context.drawImage(
          playerImage,
          player.x,
          player.y,
          PLAYER.width,
          PLAYER.height
        );
      }

      for (const pillarPair of pillarPairs) {
        const bottomY =
          pillarPair.topHeight +
          pillarPair.gapHeight;

        const bottomHeight =
          PLAYABLE_HEIGHT - bottomY;

        context.fillRect(
          pillarPair.x,
          0,
          pillarPair.width,
          pillarPair.topHeight
        );

        context.fillRect(
          pillarPair.x,
          bottomY,
          pillarPair.width,
          bottomHeight
        );
      }
    };

    // --------------------------------------------------
    // GAME LOOP
    // --------------------------------------------------

    // While PLAYING, update physics, move pillars, handle collisions,
    // generate/remove pillars, and update the score. START and GAME_OVER
    // freeze the simulation while the Canvas continues rendering.
    const update = () => {
      if (gameStateRef.current === 'PLAYING') {
        player.velocity += GRAVITY;
        player.y += player.velocity;

        const { pillarSpeed } = getDifficulty();

        for (const pillarPair of pillarPairs) {
          pillarPair.x -= pillarSpeed;
        }

        // A collision ends the current run. The return prevents the
        // scoring/spawning logic from running later in this same frame.
        if (hasCollision()) {
          gameStateRef.current = 'GAME_OVER';
          setFinalScore(score);
          updateBestScore();
          setGameState('GAME_OVER');
        } else {
          // If the newest pillar has moved far enough left, create a new
          // pair on the right while using the previous gap position to
          // keep the next gap vertically playable.
          const lastPillarPair =
            pillarPairs[pillarPairs.length - 1];

          if (
            lastPillarPair &&
            lastPillarPair.x <=
              PILLAR_SPAWN_X - PILLAR_SPACING
          ) {
            pillarPairs.push(
              createPillarPair(
                PILLAR_SPAWN_X,
                lastPillarPair.topHeight
              )
            );
          }

          // Remove pillars only after their entire width has passed
          // beyond the left side of the Canvas.
          for (
            let index = pillarPairs.length - 1;
            index >= 0;
            index -= 1
          ) {
            const pillarPair = pillarPairs[index];

            if (
              pillarPair.x + pillarPair.width < 0
            ) {
              pillarPairs.splice(index, 1);
            }
          }

          // A pillar scores once after its entire right edge passes
          // the player's x-coordinate.
          for (const pillarPair of pillarPairs) {
            const hasPassedPlayer =
              pillarPair.x + pillarPair.width <
              player.x;

            if (
              !pillarPair.passed &&
              hasPassedPlayer
            ) {
              pillarPair.passed = true;
              score += 1;
              setDisplayScore(score);
            }
          }
        }
      }

      // Rendering continues even during START and GAME_OVER so the
      // Canvas remains visible while the simulation is frozen.
      drawScene();

      animationFrameId =
        window.requestAnimationFrame(update);
    };

    let animationFrameId = 0;

    drawScene();

    animationFrameId =
      window.requestAnimationFrame(update);

    // --------------------------------------------------
    // CLEANUP
    // --------------------------------------------------

    return () => {
      window.removeEventListener(
        'keydown',
        handleKeyDown
      );

      canvas.removeEventListener(
        'pointerdown',
        handlePointerDown
      );

      window.cancelAnimationFrame(
        animationFrameId
      );

      startWithFlapRef.current = () => {};
      resetGameRef.current = () => {};
    };
  }, []);

  // --------------------------------------------------
  // REACT / HTML UI
  // --------------------------------------------------

  // React owns the surrounding interface: the title, score display,
  // START overlay, GAME_OVER overlay, and buttons. These elements are
  // separate from the Canvas simulation itself.
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-8 text-white">
      <section className="w-full max-w-[800px]">

        {/* Game header */}
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">
            Skybound
          </h1>

          <div className="flex items-center gap-2">
            <p className="rounded-full bg-white/10 px-4 py-2 font-semibold">
              Best: {bestScore}
            </p>

            <p className="rounded-full bg-white/10 px-4 py-2 font-semibold">
              Score: {displayScore}
            </p>
          </div>
        </div>

        {/* Canvas and React overlays */}
        <div className="relative">
          <canvas
            ref={canvasRef}
            width={GAME_WIDTH}
            height={GAME_HEIGHT}
            aria-label="Skybound game area"
            className="touch-none h-auto w-full rounded-2xl border-4 border-emerald-900 shadow-2xl"
          />

          {/* START overlay */}
          {gameState === 'START' && (
            <div
              onPointerDown={startFromInput}
              className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl bg-slate-950/55 text-center"
            >
              <h2 className="text-3xl font-bold">
                Ready for takeoff?
              </h2>

              <p className="mt-2 text-slate-200">
                Guide Mico through the stone pillars.
              </p>

              <button
                type="button"
                onClick={startGameFromButton}
                onPointerDown={(event) =>
                  event.stopPropagation()
                }
                className="mt-6 rounded-full bg-emerald-500 px-6 py-3 font-bold text-slate-950 transition hover:bg-emerald-400"
              >
                Start flight
              </button>
            </div>
          )}

          {/* GAME OVER overlay */}
          {gameState === 'GAME_OVER' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl bg-slate-950/70 text-center">
              <h2 className="text-3xl font-bold">
                Flight ended
              </h2>

              <p className="mt-3 text-xl text-slate-100">
                Score: {finalScore}
              </p>

              <button
                type="button"
                onClick={retryGame}
                className="mt-6 rounded-full bg-amber-400 px-6 py-3 font-bold text-slate-950 transition hover:bg-amber-300"
              >
                Retry
              </button>
            </div>
          )}
        </div>

        {/* Game description */}
        <p className="mt-4 text-center text-sm text-slate-300">
          A forest flight awaits.
        </p>

      </section>
    </main>
  );
}