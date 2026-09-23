'use client';

// React hooks used to access the Canvas element and run the game setup once.
import { useEffect, useRef } from 'react';

// -------------------------------------------------- 
// GAME CONFIGURATION 
// --------------------------------------------------


// Fixed dimensions used as the game's internal coordinate system.
const GAME_WIDTH = 800;
const GAME_HEIGHT = 520;

// The vertical area available for gameplay. 
// Currently the entire Canvas is playable.
const PLAYABLE_HEIGHT = GAME_HEIGHT;

// -------------------------------------------------- 
// PILLAR DATA MODEL 
// --------------------------------------------------

// TypeScript type describing the data needed to represent one pair of pillars.
type PillarPair = {
  x: number;
  width: number;
  topHeight: number;
  gapHeight: number;
  passed: boolean;
};

// Pillar generation constants. 
// These control the width, gap, and minimum allowed pillar height.
const PILLAR_WIDTH = 72;
const BASE_GAP_HEIGHT = 160;
const MIN_GAP_HEIGHT = 120;
const GAP_DECREASE = 4;
const MIN_PILLAR_HEIGHT = 70;
const MAX_GAP_VERTICAL_SHIFT = 100;

// -------------------------------------------------- 
// PLAYER CONFIGURATION 
// --------------------------------------------------

// Starting position and dimensions of the player. 
// Velocity is added later because it changes during gameplay.
const PLAYER = {
    x: 150,
    y: 230,
    width: 56,
    height: 56,
};


// -------------------------------------------------- 
// BACKGROUND CONFIGURATION 
// --------------------------------------------------
type BackgroundPalette = {
  skyTop: string;
  skyBottom: string;
  trees: string;
};

// Selects the background color palette based on the current time of day
function getBackgroundPalette(hour: number): BackgroundPalette {
  // Morning: 5:00 AM through 11:59 AM.
  if (hour >= 5 && hour < 12) {
    return {
      skyTop: '#7dd3fc',
      skyBottom: '#fef3c7',
      trees: '#166534',
    };
  }

  // Afternoon: 12:00 PM through 5:59 PM.
  if (hour >= 12 && hour < 18) {
    return {
      skyTop: '#fb923c',
      skyBottom: '#fed7aa',
      trees: '#7c2d12',
    };
  }
  // Evening/night: 6:00 PM through 4:59 AM.
  return {
    skyTop: '#0f172a',
    skyBottom: '#1e3a5f',
    trees: '#020617',
  };
}

// -------------------------------------------------- 
// MAIN GAME COMPONENT 
// --------------------------------------------------


export default function SkyboundGame() {

  // Holds a reference to the actual HTML Canvas element. 
  // useRef lets the game access the Canvas without causing React re-renders.
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Runs the Canvas game setup after the component has mounted.
  useEffect(() => {
    // Get the Canvas element from the React ref.
    const canvas = canvasRef.current;

    // Stop setup if the Canvas element does not exist.
    if (!canvas) return;

    // Get the Canvas 2D drawing context used to render the game.
    const context = canvas.getContext('2d');

    // Stop setup if the browser cannot provide a 2D context.
    if (!context) return;

    // Determine the background palette once when the game starts.
    const palette = getBackgroundPalette(new Date().getHours());

    // Create the player's runtime state. 
    // The spread operator copies the starting PLAYER values, 
    // while velocity tracks the player's vertical movement.
    const player = { ...PLAYER, velocity: 0};

    // -------------------------------------------------- 
    // PILLAR GENERATION 
    // --------------------------------------------------


    // Creates one pillar pair at the supplied x-coordinate. 
    // The function returns data that follows the PillarPair TypeScript type.
    const BASE_PILLAR_SPEED = 2.5;
    const MAX_PILLAR_SPEED = 4.5;
    const SPEED_INCREASE = 0.15;
    const PILLAR_SPAWN_X = GAME_WIDTH + 40;
    const PILLAR_SPACING = 300;

    let score = 0;

    const getDifficulty = () => {
      const pillarSpeed = Math.min(
        MAX_PILLAR_SPEED,
        BASE_PILLAR_SPEED + score * SPEED_INCREASE
      );

      const gapHeight = Math.max(
        MIN_GAP_HEIGHT,
        BASE_GAP_HEIGHT - score * GAP_DECREASE
      );

      return { pillarSpeed, gapHeight };
    };

    const createPillarPair = (
      x: number,
      previousTopHeight?: number
    ): PillarPair => {
      const { gapHeight } = getDifficulty();

      // Calculate the absolute highest top-pillar height allowed by the game geometry.
      // This guarantees that the bottom pillar still has at least MIN_PILLAR_HEIGHT.
      const maximumAllowedTopHeight =
        PLAYABLE_HEIGHT - gapHeight - MIN_PILLAR_HEIGHT;

      // Calculate the lowest allowed top-pillar height for the next pillar.
      // If this is the first pillar, start at the absolute minimum.
      // Otherwise, don't allow the next gap to move downward by more than
      // MAX_GAP_VERTICAL_SHIFT from the previous gap position.
      const minimumTopHeight =
        previousTopHeight === undefined
          ? MIN_PILLAR_HEIGHT
          : Math.max(
              MIN_PILLAR_HEIGHT,
              previousTopHeight - MAX_GAP_VERTICAL_SHIFT
            );

      // Calculate the highest allowed top-pillar height for the next pillar.
      // If this is the first pillar, use the absolute maximum allowed height.
      // Otherwise, don't allow the next gap to move upward by more than
      // MAX_GAP_VERTICAL_SHIFT from the previous gap position.
      const maximumTopHeight =
        previousTopHeight === undefined
            ? maximumAllowedTopHeight
            : Math.min(
              maximumAllowedTopHeight,
              previousTopHeight + MAX_GAP_VERTICAL_SHIFT
            );

      // Choose a random whole-number top-pillar height
      // between the calculated minimum and maximum, inclusive.
      const topHeight =
        Math.floor(
          Math.random() * (maximumTopHeight - minimumTopHeight + 1)
        ) + minimumTopHeight;

      return {
        x,
        width: PILLAR_WIDTH,
        topHeight,
        gapHeight,
        passed: false,
      };
    };

    const pillarPairs = [createPillarPair(PILLAR_SPAWN_X)];


    // -------------------------------------------------- 
    // PLAYER IMAGE 
    // --------------------------------------------------

    // Create the image object used to display the player.
    const playerImage = new Image();
    // Tracks whether the image has finished loading.
    let isPlayerImageLoaded = false;
    
    // Only allow the game to draw the player image after loading finishes.
    playerImage.onload = () => {
      isPlayerImageLoaded = true;
    };

    // Start loading the player image.
    playerImage.src = '/mico-man.png';


    // -------------------------------------------------- 
    // PLAYER PHYSICS 
    // --------------------------------------------------

    // Gravity increases the player's downward velocity every frame.
    const GRAVITY = 0.12;

    // Negative velocity moves the player upward when they flap.
    const FLAP_VELOCITY = -4.8;

    // Applies an upward velocity to the player. 
    // The player does not teleport upward; physics moves them over time.
    const flap = () => {
      player.velocity = FLAP_VELOCITY;
    };

    // Stores the ID of the browser's animation loop. 
    // It is used later to stop the loop during cleanup.
    let animationFrameId = 0;


    // -------------------------------------------------- 
    // KEYBOARD INPUT 
    // --------------------------------------------------

    // Handles keyboard input for the player's flap action.
    const handleKeyDown= (event: KeyboardEvent) => {

      // Ignore every key except Space.
      if (event.code !== 'Space') return;

      // Prevent Space from triggering the browser's default behavior.
      event.preventDefault();

      // Ignore repeated keydown events when Space is held down.
      if (event.repeat) return;

      // Apply the flap physics.
      flap();
    };

    const rectanglesOverlap = (
      first: { x: number; y: number; width: number; height: number},
      second: { x: number; y: number; width: number; height: number}
    ) => {
      return (
        first.x < second.x + second.width &&
        first.x + first.width > second.x &&
        first.y < second.y + second.height &&
        first.y + first.height > second.y
      );
    };

    const hasCollision = () => {
      const hitBoundary =
        player.y < 0 ||
        player.y + player.height > PLAYABLE_HEIGHT;

      const hitPillar = pillarPairs.some((pillarPair) => {
        const bottomY = pillarPair.topHeight + pillarPair.gapHeight;
        const bottomHeight = PLAYABLE_HEIGHT - bottomY;

        const hitTopPillar = rectanglesOverlap(player, {
          x: pillarPair.x,
          y: 0,
          width: pillarPair.width,
          height: pillarPair.topHeight,
        });

        const hitBottomPillar = rectanglesOverlap(player, {
          x: pillarPair.x,
          y: bottomY,
          width: pillarPair.width,
          height: bottomHeight,
        });

        return hitTopPillar || hitBottomPillar;
      });

      return hitBoundary || hitPillar;
    };

    // Listen for keyboard input while the game is active.
    window.addEventListener('keydown', handleKeyDown);

    // -------------------------------------------------- 
    // POINTER / MOUSE / TOUCH INPUT 
    // --------------------------------------------------

    // Allows the player to flap using mouse or touch input.
    const handlePointerDown = (event: PointerEvent) => {

      // Prevent the browser from performing its default pointer behavior.
      event.preventDefault();

      // Apply the same flap action used by the keyboard.
      flap();
    };

    // Listen for pointer input directly on the Canvas.
    canvas.addEventListener('pointerdown', handlePointerDown);


    // -------------------------------------------------- 
    // RENDERING / DRAWING 
    // --------------------------------------------------

    // Draw the game scene
    const drawScene = () => {
      // Clear the previous frame before drawing the new one.
      context.clearRect(0,0, GAME_WIDTH, GAME_HEIGHT);

      // Create a vertical gradient for the sky.
      const sky = context.createLinearGradient(0, 0, 0, GAME_HEIGHT);

      // Set the top and bottom colors of the sky gradient.
      sky.addColorStop(0, palette.skyTop);
      sky.addColorStop(1, palette.skyBottom);

      // Use the gradient as the Canvas fill style.
      context.fillStyle = sky;
      // Draw the sky across the entire game area.
      context.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
      // Set the color used to draw the background trees.
      context.fillStyle = palette.trees;

      // Draw repeated triangular trees across the background.
      for (let x = 40; x < GAME_WIDTH; x += 110) {
        context.beginPath();
        context.moveTo(x, GAME_HEIGHT);
        context.lineTo(x + 36, GAME_HEIGHT - 190);
        context.lineTo(x + 72, GAME_HEIGHT);
        context.fill();
      }

      // Draw the player only after the image has finished loading.
      if (isPlayerImageLoaded) {
        context.drawImage(playerImage, player.x, player.y, PLAYER.width, PLAYER.height);
      }
      
      // -------------------------------------------------- 
      // PILLAR RENDERING 
      // --------------------------------------------------

      // Draw every pillar pair currently stored in the game.
      for (const pillarPair of pillarPairs) {
        // The bottom pillar begins after the top pillar and the gap.
        const bottomY = pillarPair.topHeight + pillarPair.gapHeight;
        // The bottom pillar uses all remaining playable height.
        const bottomHeight = PLAYABLE_HEIGHT - bottomY;

        // Draw the top pillar from the top of the Canvas.
        context.fillRect(pillarPair.x, 0, pillarPair.width, pillarPair.topHeight);
        // Draw the bottom pillar starting at bottomY.
        context.fillRect(pillarPair.x, bottomY, pillarPair.width, bottomHeight);
      }

    };


    // -------------------------------------------------- 
    // GAME LOOP / GAME STATE UPDATE 
    // --------------------------------------------------

    // Updates the game's state and then renders the next frame.
    const update = () => {
      // Apply gravity by increasing the player's downward velocity.
      player.velocity += GRAVITY;
      // Move the player according to their current velocity.
      player.y += player.velocity;

      // Move every pillar pair from right to left.
      const { pillarSpeed } = getDifficulty();

      for (const pillarPair of pillarPairs) {
        pillarPair.x -= pillarSpeed;
      }

      // Check the newest pillar to determine when the next pillar should spawn.
      const lastPillarPair = pillarPairs[pillarPairs.length - 1];
      // If the last pillar pair has moved far enough left, spawn a new one.
      if (
        lastPillarPair &&
        lastPillarPair.x <= PILLAR_SPAWN_X - PILLAR_SPACING
      ) {
         // Add a new pillar outside the right edge while keeping existing pillars active.
        pillarPairs.push(
          createPillarPair(PILLAR_SPAWN_X, lastPillarPair.topHeight)
        );
      }

      // Remove pillars only after they are completely outside the left edge.
      for (let index = pillarPairs.length - 1; index >= 0; index -= 1) {
        const pillarPair = pillarPairs[index];

        if (pillarPair.x + pillarPair.width < 0) {
          pillarPairs.splice(index, 1);
        }
      }

      if (hasCollision()) {
        console.log('Collision Detected');
      }

      for (const pillarPair of pillarPairs) {
        const hasPassedPlayer =
          pillarPair.x + pillarPair.width < player.x;

          if (!pillarPair.passed && hasPassedPlayer) {
            pillarPair.passed = true;
            score += 1;
            console.log(`Score: ${score}`);
          }
      }

      // Render the updated game state.
      drawScene();
      // Ask the browser to run update again on the next animation frame.
      animationFrameId = window.requestAnimationFrame(update);
    };

    // Draw the initial scene immediately.
    drawScene();
    // Start the continuous game loop.
    animationFrameId = window.requestAnimationFrame(update);

    // -------------------------------------------------- 
    // CLEANUP 
    // --------------------------------------------------
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      canvas.removeEventListener('pointerdown', handlePointerDown);
      window.cancelAnimationFrame(animationFrameId);
    };

  }, []);

  // -------------------------------------------------- 
  // REACT / HTML UI 
  // --------------------------------------------------

  // React renders the page structure surrounding the Canvas.
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