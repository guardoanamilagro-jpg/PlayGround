import * as THREE from 'three';
import { Game } from './game.js';
import { UI } from './ui.js';
import { Input } from './input.js';
import { AudioEngine } from './audio.js';
import { SPECIES, createAnimal, disposeAnimal } from './animals.js';

const stage = document.getElementById('stage');
const loader = document.getElementById('loader');

/* ═══════════════════════════════════════════════════════════
   RENDERER + SCENE
   ═══════════════════════════════════════════════════════════ */
let renderer;
try {
  renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance',
    preserveDrawingBuffer: true
  });
} catch (err) {
  showFatal('Tu navegador no ha podido iniciar WebGL.', err);
  throw err;
}

const pixelRatio = () => Math.min(window.devicePixelRatio || 1, matchMedia('(pointer: coarse)').matches ? 1.25 : 1.65);
renderer.setPixelRatio(pixelRatio());
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.domElement.id = 'game-canvas';
renderer.domElement.setAttribute('aria-label', 'Mundo 3D de Esconderte o mueres');
stage.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 520);
camera.position.set(0, 5, 9);

const input = new Input(renderer.domElement);
const audio = new AudioEngine();

let game = null;

const ui = new UI({
  onRole: (role) => game?.setMenuRole(role),
  onSpecies: (id) => game?.setMenuSpecies(id),
  onMap: (id) => game?.setMenuMap(id),
  onPlay: () => {
    audio.ensure();
    audio.ui();
    game?.startMatch();
  },
  onHow: () => {
    audio.ensure();
    audio.ui();
    ui.showHow();
  },
  onSound: () => {
    audio.ensure();
    const on = audio.toggle();
    ui.setMuted(!on);
  },
  onFullscreen: () => {
    const doc = document;
    if (!doc.fullscreenElement) {
      doc.documentElement.requestFullscreen?.().catch(() => {});
    } else {
      doc.exitFullscreen?.().catch(() => {});
    }
  },
  onResume: () => game?.resume(),
  onQuit: () => game?.quitToMenu(),
  onRematch: () => {
    ui.hideMatchEnd();
    audio.ensure();
    game?.startMatch();
  },
  onMenu: () => game?.quitToMenu(),
  onContinue: () => game?.continueRound()
});

game = new Game({ renderer, scene, camera, input, audio, ui });

/* ═══════════════════════════════════════════════════════════
   PORTRAITS — rendered once with the main renderer
   ═══════════════════════════════════════════════════════════ */
function renderPortraits() {
  const size = 256;
  const out = {};
  const oldRatio = renderer.getPixelRatio();
  const oldSize = new THREE.Vector2();
  renderer.getSize(oldSize);
  const oldClear = new THREE.Color();
  renderer.getClearColor(oldClear);
  const oldAlpha = renderer.getClearAlpha();
  const oldShadow = renderer.shadowMap.enabled;

  const portraitScene = new THREE.Scene();
  portraitScene.background = new THREE.Color(0x0a1711);
  const portraitCam = new THREE.PerspectiveCamera(31, 1, 0.1, 40);

  const hemi = new THREE.HemisphereLight(0xd8efcf, 0x1b2c1d, 1.6);
  const key = new THREE.DirectionalLight(0xffe0b0, 3.2);
  key.position.set(3.2, 5.2, 4.2);
  const rim = new THREE.DirectionalLight(0xc9f16b, 2.2);
  rim.position.set(-3.8, 1.8, -3.2);
  const fill = new THREE.PointLight(0xffffff, 9, 9, 2);
  fill.position.set(-1.6, 2.4, 3.4);
  portraitScene.add(hemi, key, rim, fill);

  const stageDisc = new THREE.Mesh(
    new THREE.CircleGeometry(1.42, 48),
    new THREE.MeshStandardMaterial({ color: 0x12251a, roughness: 0.92, metalness: 0.04 })
  );
  stageDisc.rotation.x = -Math.PI / 2;
  stageDisc.position.y = -0.015;
  portraitScene.add(stageDisc);
  const glowDisc = new THREE.Mesh(
    new THREE.RingGeometry(1.08, 1.17, 48),
    new THREE.MeshBasicMaterial({ color: 0x6b9b45, transparent: true, opacity: 0.35, side: THREE.DoubleSide })
  );
  glowDisc.rotation.x = -Math.PI / 2;
  glowDisc.position.y = 0.002;
  portraitScene.add(glowDisc);

  renderer.shadowMap.enabled = false;
  renderer.setPixelRatio(1);
  renderer.setSize(size, size, false);

  for (const id of Object.keys(SPECIES)) {
    const sp = SPECIES[id];
    const animal = createAnimal(id, { scale: 1.18, blob: false });
    animal.rotation.y = -0.22;
    const h = animal.userData.height || 1.5;
    portraitCam.position.set(2.15, h * 0.92 + 0.55, 3.55);
    portraitCam.lookAt(0, h * 0.5 - 0.04, 0);
    portraitCam.updateMatrixWorld();
    portraitScene.add(animal);
    renderer.render(portraitScene, portraitCam);
    out[id] = renderer.domElement.toDataURL('image/jpeg', 0.9);
    portraitScene.remove(animal);
    disposeAnimal(animal);
  }

  stageDisc.geometry.dispose();
  stageDisc.material.dispose();
  glowDisc.geometry.dispose();
  glowDisc.material.dispose();

  renderer.shadowMap.enabled = oldShadow;
  renderer.setPixelRatio(oldRatio);
  renderer.setSize(oldSize.x, oldSize.y, false);
  renderer.setClearColor(oldClear, oldAlpha);
  return out;
}

/* ═══════════════════════════════════════════════════════════
   START
   ═══════════════════════════════════════════════════════════ */
try {
  const portraits = renderPortraits();
  ui.setPortraits(portraits);
  game.showMenu();
} catch (err) {
  showFatal('No se ha podido preparar el escenario.', err);
}

/* ═══════════════════════════════════════════════════════════
   EVENTS
   ═══════════════════════════════════════════════════════════ */
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(pixelRatio());
  renderer.setSize(window.innerWidth, window.innerHeight);
});

window.addEventListener('esconderte:unlock', () => {
  if (game?.isPlaying()) game.pause();
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden && game?.isPlaying()) game.pause();
});

document.addEventListener('keydown', (e) => {
  if (e.code !== 'Escape') return;
  if (!ui.$('how').classList.contains('hidden')) {
    ui.hideHow();
    if (game?.isPlaying()) game.resume();
  }
});

/* Keep the menu modal from scrolling behind the pointer-lock canvas. */
document.addEventListener('fullscreenchange', () => {
  const btn = document.getElementById('fullscreen-btn');
  btn?.classList.toggle('active', !!document.fullscreenElement);
});

/* ═══════════════════════════════════════════════════════════
   LOOP
   ═══════════════════════════════════════════════════════════ */
const clock = new THREE.Clock();
let firstFrame = true;

function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  game.update(dt);
  renderer.render(scene, camera);

  if (firstFrame) {
    firstFrame = false;
    requestAnimationFrame(() => loader?.classList.add('gone'));
  }
}

requestAnimationFrame(frame);

/* A tiny debug surface keeps browser verification honest. */
window.__esconderte = game;
window.__game = game;
window.__ui = ui;
window.__scene = scene;
window.__renderer = renderer;

function showFatal(message, err) {
  console.error(message, err);
  if (!loader) return;
  loader.innerHTML = `<div class="loader-mark">E<span>/</span>M</div>
    <p style="max-width:420px;text-align:center;color:#f3eee1;font:12px/1.6 system-ui;padding:0 24px">${message}<br><span style="color:#96a69c">Revisa que WebGL esté habilitado y recarga la página.</span></p>`;
}
