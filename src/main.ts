import * as THREE from 'three';
import { Difficulty, PlayerSide, MatchStats } from '@/types';
import { RENDER_3D } from '@/utils/Constants';
import { Game } from '@/game/Game';
import { InputManager } from '@/input/InputManager';
import { UIManager } from '@/ui/UIManager';

type AppState = 'menu' | 'playing' | 'result';

let appState: AppState = 'menu';
let game: Game | null = null;
let prevTime = 0;

// ---- Three.js Setup ----
const container = document.getElementById('game-container')!;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
container.insertBefore(renderer.domElement, container.firstChild);

const scene = new THREE.Scene();
scene.background = new THREE.Color(RENDER_3D.COLORS.SKY);

const camera = new THREE.PerspectiveCamera(
  RENDER_3D.CAMERA_FOV,
  window.innerWidth / window.innerHeight,
  RENDER_3D.CAMERA_NEAR,
  RENDER_3D.CAMERA_FAR,
);
camera.position.set(0, RENDER_3D.CAMERA_HEIGHT, RENDER_3D.CAMERA_DISTANCE + 13);
camera.lookAt(0, 1, 0);

// Lights
const ambient = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambient);

const directional = new THREE.DirectionalLight(0xffffff, 0.8);
directional.position.set(5, 15, 10);
directional.castShadow = true;
directional.shadow.mapSize.width = 2048;
directional.shadow.mapSize.height = 2048;
directional.shadow.camera.near = 0.5;
directional.shadow.camera.far = 50;
directional.shadow.camera.left = -20;
directional.shadow.camera.right = 20;
directional.shadow.camera.top = 20;
directional.shadow.camera.bottom = -20;
scene.add(directional);

// ---- Input + UI ----
const inputManager = new InputManager();
const ui = new UIManager();

// ---- App State Machine ----
ui.setOnPlay((difficulty: Difficulty, sets: number) => {
  startMatch(difficulty, sets);
});

ui.setOnBackToMenu(() => {
  goToMenu();
});

function startMatch(difficulty: Difficulty, sets: number): void {
  // Clean up previous game objects from scene
  if (game) {
    game.destroy();
    game = null;
  }

  // Remove all non-light objects (court, players, ball from previous game)
  const toRemove: THREE.Object3D[] = [];
  scene.traverse((obj) => {
    if (obj !== scene && !(obj instanceof THREE.Light)) {
      if (obj.parent === scene) toRemove.push(obj);
    }
  });
  toRemove.forEach(obj => scene.remove(obj));

  game = new Game(scene, camera, inputManager, ui, difficulty, sets);
  game.setOnMatchEnd(onMatchEnd);
  inputManager.setEnabled(true);
  appState = 'playing';
  ui.showHUD();
}

function onMatchEnd(winner: PlayerSide, stats: MatchStats): void {
  appState = 'result';
  inputManager.setEnabled(false);
  ui.showResult(winner, stats);
}

function goToMenu(): void {
  if (game) {
    game.destroy();
    game = null;
  }

  // Clean scene
  const toRemove: THREE.Object3D[] = [];
  scene.traverse((obj) => {
    if (obj !== scene && !(obj instanceof THREE.Light)) {
      if (obj.parent === scene) toRemove.push(obj);
    }
  });
  toRemove.forEach(obj => scene.remove(obj));

  appState = 'menu';
  inputManager.setEnabled(false);
  ui.showMenu();
}

// ---- Animation Loop ----
function animate(time: number): void {
  requestAnimationFrame(animate);

  const dt = Math.min((time - prevTime) / 1000, 0.05); // cap at 50ms
  prevTime = time;

  if (appState === 'playing' && game) {
    game.update(dt);
  }

  renderer.render(scene, camera);
}

// ---- Window Resize ----
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---- Start ----
ui.showMenu();
requestAnimationFrame(animate);
