import test from "node:test";
import assert from "node:assert/strict";

import {
  setDirection,
  spawnFood,
  stepState,
} from "../src/gameLogic.js";

test("stepState moves snake one cell without growing", () => {
  const state = {
    gridSize: 8,
    snake: [
      { x: 3, y: 3 },
      { x: 2, y: 3 },
      { x: 1, y: 3 },
    ],
    direction: "right",
    pendingDirection: "right",
    food: { x: 6, y: 6 },
    score: 0,
    status: "running",
  };

  const next = stepState(state, () => 0.5);

  assert.equal(next.status, "running");
  assert.equal(next.score, 0);
  assert.deepEqual(next.snake, [
    { x: 4, y: 3 },
    { x: 3, y: 3 },
    { x: 2, y: 3 },
  ]);
});

test("setDirection ignores direct reversal", () => {
  const state = {
    gridSize: 8,
    snake: [{ x: 2, y: 2 }],
    direction: "right",
    pendingDirection: "right",
    food: { x: 5, y: 5 },
    score: 0,
    status: "running",
  };

  const next = setDirection(state, "left");
  assert.equal(next.pendingDirection, "right");
});

test("stepState grows snake and increments score when eating food", () => {
  const state = {
    gridSize: 6,
    snake: [
      { x: 2, y: 2 },
      { x: 1, y: 2 },
    ],
    direction: "right",
    pendingDirection: "right",
    food: { x: 3, y: 2 },
    score: 0,
    status: "running",
  };

  const next = stepState(state, () => 0);

  assert.equal(next.score, 1);
  assert.equal(next.snake.length, 3);
  assert.equal(next.status, "running");
  assert.ok(next.food);
  assert.equal(
    next.snake.some((segment) => segment.x === next.food.x && segment.y === next.food.y),
    false,
  );
});

test("stepState triggers game-over on wall collision", () => {
  const state = {
    gridSize: 5,
    snake: [
      { x: 4, y: 2 },
      { x: 3, y: 2 },
    ],
    direction: "right",
    pendingDirection: "right",
    food: { x: 0, y: 0 },
    score: 0,
    status: "running",
  };

  const next = stepState(state, () => 0.2);

  assert.equal(next.status, "game-over");
});

test("stepState triggers game-over on self collision", () => {
  const state = {
    gridSize: 6,
    snake: [
      { x: 2, y: 2 },
      { x: 2, y: 3 },
      { x: 1, y: 3 },
      { x: 1, y: 2 },
      { x: 1, y: 1 },
      { x: 2, y: 1 },
    ],
    direction: "left",
    pendingDirection: "left",
    food: { x: 5, y: 5 },
    score: 0,
    status: "running",
  };

  const next = stepState(state, () => 0.2);

  assert.equal(next.status, "game-over");
});

test("spawnFood picks deterministic free cell index", () => {
  const snake = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 2, y: 0 },
  ];

  const food = spawnFood(() => 0.5, 3, snake);

  assert.deepEqual(food, { x: 0, y: 2 });
});
