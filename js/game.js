import * as THREE from 'three';
import { World, MAPS, MAP_ORDER } from './world.js';
import {
  SPECIES, HIDER_PLAYABLE, SEEKER_PLAYABLE, HIDER_AI_POOL,
  createAnimal, animateAnimal, setAnimalOpacity, disposeAnimal
} from './animals.js';
import { formatTime } from './ui.js';

const HIDE_TIME = 30;
const HUNT_TIME = 240;
const WINS_NEEDED = 3;
const MAX_ROUNDS = 5;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerpAngle = (a, b, t) => {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
};
const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
const pick = (arr) => arr[(Math.random() * arr.length) | 0];
const shuffle = (arr) => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

function glowCanvas(inner = 'rgba(255,255,240,1)', outer = 'rgba(255,255,255,0)') {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, inner);
  g.addColorStop(0.4, inner);
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function markerCanvas() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  ctx.translate(64, 64);
  ctx.strokeStyle = 'rgba(255,90,60,0.85)';
  ctx.lineWidth = 5;
  ctx.beginPath(); ctx.arc(0, 0, 34, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#ff5a3c';
  ctx.shadowColor = '#ff5a3c';
  ctx.shadowBlur = 18;
  ctx.beginPath();
  ctx.moveTo(0, -38); ctx.lineTo(22, 6); ctx.lineTo(0, -2); ctx.lineTo(-22, 6); ctx.closePath();
  ctx.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class Game {
  constructor({ renderer, scene, camera, input, audio, ui }) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.input = input;
    this.audio = audio;
    this.ui = ui;

    this.mode = 'menu';
    this.phase = 'menu';
    this.paused = false;
    this.world = null;
    this.entities = [];
    this.player = null;
    this.time = 0;
    this.phaseTime = HIDE_TIME;
    this.roundIndex = 0;
    this.scores = { hider: 0, seeker: 0 };
    this.stats = { captures: 0, survived: 0 };
    this.config = { role: 'hider', species: 'monkey', mapId: 'jungle' };
    this.matchMaps = ['jungle', 'savanna', 'temple', 'jungle', 'savanna'];
    this.usedBushes = new Set();
    this.effects = [];
    this.endCountdown = 0;
    this.matchOver = false;
    this.shake = 0;
    this.spectateTarget = null;
    this.minimapT = 0;
    this.pointerHintShown = false;
    this.footstepT = 0;
    this.huntStartTime = 0;
    this.roundElapsed = 0;
    this.menuTime = 0;
    this.menuAngle = 0.55;
    this.yaw = 0;
    this.pitch = 0.22;
    this.camLook = new THREE.Vector3();
    this.camPos = new THREE.Vector3();
    this.camFov = 58;
    this.snapCamera = true;
    this.spectateAngle = 0;

    this.entityRoot = new THREE.Group();
    this.entityRoot.name = 'entities';
    this.scene.add(this.entityRoot);

    this.markerTexture = markerCanvas();
    this.glowTexture = glowCanvas();
    this.coralGlow = glowCanvas('rgba(255,120,80,1)', 'rgba(255,60,20,0)');
    this.acidGlow = glowCanvas('rgba(210,255,130,1)', 'rgba(150,220,60,0)');

    this.menu = {
      showcase: null,
      lights: null,
      angle: 0.6,
      mapId: 'jungle'
    };
    this.tmpV = new THREE.Vector3();
    this.tmpV2 = new THREE.Vector3();
  }

  /* ══════════════════════════════════════════════════════
     MENU
     ══════════════════════════════════════════════════════ */
  showMenu() {
    this.mode = 'menu';
    this.phase = 'menu';
    this.paused = false;
    this.input.enabled = false;
    this.input.reset();
    this.input.releaseLock();
    this.disposeRound();
    this.ui.hideRoundEnd();
    this.ui.hideMatchEnd();
    this.ui.hidePause();
    this.ui.showMenu();
    this.ui.renderMenu(this.config);
    this.buildMenuWorld();
    this.audio.setMap(this.config.mapId);
    this.camera.fov = 50;
    this.camera.updateProjectionMatrix();
    this.snapCamera = true;
  }

  setMenuRole(role) {
    if (role === this.config.role) return;
    this.config.role = role;
    this.config.species = role === 'hider' ? 'monkey' : 'cheetah';
    this.rebuildShowcase();
    this.ui.renderMenu(this.config);
    this.audio.ui();
  }

  setMenuSpecies(id) {
    const sp = SPECIES[id];
    if (!sp || sp.team !== this.config.role) return;
    this.config.species = id;
    this.rebuildShowcase();
    this.ui.renderMenu(this.config);
    this.audio.ui();
  }

  setMenuMap(id) {
    if (!MAPS[id] || id === this.config.mapId) return;
    this.config.mapId = id;
    this.ui.renderMenu(this.config);
    this.audio.ui();
    this.buildMenuWorld();
  }

  buildMenuWorld() {
    this.disposeRound();
    this.world = new World(this.scene, this.config.mapId);
    this.menu.mapId = this.config.mapId;
    this.audio.setMap(this.config.mapId);
    this.buildShowcase();
  }

  buildShowcase() {
    this.disposeShowcase();
    const sp = SPECIES[this.config.species];
    const y = this.world.heightAt(0, 0);
    const group = createAnimal(this.config.species, { scale: 1.55, blob: false });
    group.position.set(0, y + 0.06, 0);
    group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    this.scene.add(group);
    this.menu.showcase = group;

    const lights = new THREE.Group();
    const key = new THREE.PointLight(0xffe0b0, 55, 18, 2);
    key.position.set(3.4, y + 4.6, 2.6);
    const rim = new THREE.PointLight(0xc9f16b, 38, 14, 2);
    rim.position.set(-3.2, y + 2.6, -2.4);
    const under = new THREE.PointLight(sp.team === 'hider' ? 0xc9f16b : 0xff5a3c, 18, 8, 2);
    under.position.set(0, y + 0.5, 0.4);
    lights.add(key, rim, under);
    this.scene.add(lights);
    this.menu.lights = lights;

    // selection halo
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(1.7, 1.9, 40),
      new THREE.MeshBasicMaterial({ color: sp.team === 'hider' ? 0xc9f16b : 0xff5a3c, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(0, y + 0.09, 0);
    this.scene.add(ring);
    this.menu.halo = ring;
  }

  rebuildShowcase() {
    if (this.mode !== 'menu' || !this.world) return;
    this.buildShowcase();
  }

  disposeShowcase() {
    if (this.menu.showcase) {
      this.scene.remove(this.menu.showcase);
      disposeAnimal(this.menu.showcase);
      this.menu.showcase = null;
    }
    if (this.menu.lights) {
      this.scene.remove(this.menu.lights);
      this.menu.lights = null;
    }
    if (this.menu.halo) {
      this.scene.remove(this.menu.halo);
      this.menu.halo.geometry.dispose();
      this.menu.halo.material.dispose();
      this.menu.halo = null;
    }
  }

  updateMenu(dt) {
    this.menuTime += dt;
    if (this.world) this.world.update(dt);
    if (this.menu.showcase) {
      this.menu.showcase.rotation.y += dt * 0.22;
      animateAnimal(this.menu.showcase, dt, 0);
    }
    if (this.menu.halo) {
      this.menu.halo.material.opacity = 0.3 + Math.sin(this.menuTime * 2) * 0.14;
      this.menu.halo.scale.setScalar(1 + Math.sin(this.menuTime * 2) * 0.025);
    }
    this.updateMenuCamera(dt);
  }

  updateMenuCamera(dt) {
    this.menu.angle += dt * 0.085;
    const c = this.menu.showcase ? this.menu.showcase.position : new THREE.Vector3(0, 0, 0);
    const radius = 7.4;
    const px = c.x + Math.sin(this.menu.angle) * radius;
    const pz = c.z + Math.cos(this.menu.angle) * radius;
    const py = c.y + 3.35;
    const pos = this.tmpV.set(px, py, pz);
    if (this.snapCamera) {
      this.camera.position.copy(pos);
      this.snapCamera = false;
    } else {
      this.camera.position.lerp(pos, 1 - Math.exp(-dt * 5.5));
    }
    const f = this.tmpV2.set(c.x - px, 0, c.z - pz).normalize();
    const rx = -f.z, rz = f.x;
    const look = new THREE.Vector3(c.x - rx * 2.25, c.y + 1.42, c.z - rz * 2.25);
    this.camera.lookAt(look);
    if (Math.abs(this.camera.fov - 50) > 0.1) {
      this.camera.fov = 50;
      this.camera.updateProjectionMatrix();
    }
  }

  /* ══════════════════════════════════════════════════════
     MATCH + ROUND SETUP
     ══════════════════════════════════════════════════════ */
  startMatch() {
    this.audio.ensure();
    this.scores = { hider: 0, seeker: 0 };
    this.stats = { captures: 0, survived: 0 };
    this.roundIndex = 0;
    const idx = Math.max(0, MAP_ORDER.indexOf(this.config.mapId));
    this.matchMaps = Array.from({ length: MAX_ROUNDS }, (_, i) => MAP_ORDER[(idx + i) % 3]);
    this.ui.hideMenu();
    this.ui.hideMatchEnd();
    this.ui.hideRoundEnd();
    this.ui.hidePhase();
    this.ui.clearFeed();
    this.startRound();
  }

  startRound() {
    this.disposeRound();
    this.matchOver = false;
    this.endCountdown = 0;
    this.paused = false;
    this.mode = 'playing';
    this.phase = 'hide';
    this.time = 0;
    this.phaseTime = HIDE_TIME;
    this.roundElapsed = 0;
    this.usedBushes.clear();
    this.effects = [];
    this.spectateTarget = null;
    this.pointerHintShown = false;
    this.input.reset();
    this.input.enabled = true;

    this.world = new World(this.scene, this.matchMaps[this.roundIndex]);
    this.audio.setMap(this.world.mapId);
    this.spawnEntities();
    this.ui.showHud(this.world.cfg.name);
    this.ui.setScores(this.scores.hider, this.scores.seeker);
    this.ui.clearFeed();
    this.ui.hidePhase();
    this.ui.hideRoundEnd();

    const p = this.player;
    if (p) {
      const toCenter = { x: -p.pos.x, z: -p.pos.z };
      this.yaw = Math.atan2(-toCenter.x, -toCenter.z);
      p.yaw = this.yaw + Math.PI;
      this.pitch = 0.22;
      this.snapCamera = true;
    }

    if (p && p.team === 'seeker') {
      this.ui.showBlackout(this.phaseTime);
      this.ui.toast('PANTALLA A OSCURAS', 'coral', 'los escondidos se están ocultando', 2.6);
    } else {
      this.ui.toast('ESCÓNDETE', 'acid', '30 segundos antes de que empiece la caza', 2.6);
      if (this.world) this.ui.feed('<b>9</b> presas se ocultan en el mapa');
    }
    this.audio.hornStart();
    this.input.requestLock();
    this.ui.updateHud(this.getHudState());
  }

  startHunt() {
    if (this.phase !== 'hide') return;
    this.phase = 'hunt';
    this.phaseTime = HUNT_TIME;
    this.huntStartTime = this.time;
    this.ui.hidePhase();
    this.audio.hornStart();
    this.shake = Math.max(this.shake, 0.45);
    if (this.player && this.player.team === 'seeker') {
      this.ui.toast('¡A CAZAR!', 'coral', '4:00 · 9 presas en el mapa', 2.2);
      this.ui.feed('<b>LA CAZA</b> ha comenzado');
    } else {
      this.ui.toast('¡LA CAZA COMIENZA!', 'coral', 'sobrevive 4:00', 2.2);
      this.ui.feed('<b>Los cazadores</b> están en libertad');
    }
    for (const e of this.entities) {
      if (e.team === 'seeker') {
        e.state = 'patrol';
        e.scentTimer = rand(1.5, 3);
      }
    }
  }

  spawnEntities() {
    const role = this.config.role;
    let hiderSpecies;
    if (role === 'hider') {
      const pool = shuffle(HIDER_AI_POOL.filter((s) => s !== this.config.species));
      while (pool.length < 8) pool.push(SPECIES[this.config.species].id);
      hiderSpecies = [this.config.species, ...pool.slice(0, 8)];
    } else {
      const pool = shuffle([...HIDER_AI_POOL, 'fox', 'rabbit', 'raccoon']);
      hiderSpecies = pool.slice(0, 9);
    }
    const seekerSpecies = role === 'seeker'
      ? [this.config.species, this.config.species === 'cheetah' ? 'lion' : 'cheetah']
      : ['cheetah', 'lion'];

    const hiderPts = this.world.getSpawnPoints('hider', hiderSpecies.length);
    const seekerPts = this.world.getSpawnPoints('seeker', seekerSpecies.length);
    this.entities = [];
    this.player = null;

    hiderSpecies.forEach((sid, i) => {
      const isPlayer = role === 'hider' && i === 0;
      const pt = hiderPts[i % hiderPts.length];
      const e = this.createEntity(sid, 'hider', pt, isPlayer);
      if (isPlayer) {
        this.player = e;
      } else {
        // AI prey starts already tucked into cover instead of piling out of
        // the same spawn ring in front of the player camera.
        this.assignHideSpot(e);
        if (e.hideSpot) {
          const safe = { x: e.hideSpot.x, z: e.hideSpot.z };
          this.world.resolve(safe, e.radius);
          e.pos.x = safe.x;
          e.pos.z = safe.z;
          e.pos.y = this.world.heightAt(safe.x, safe.z);
          e.group.position.set(e.pos.x, e.pos.y, e.pos.z);
        }
      }
    });

    seekerSpecies.forEach((sid, i) => {
      const isPlayer = role === 'seeker' && i === 0;
      const pt = seekerPts[i % seekerPts.length];
      const e = this.createEntity(sid, 'seeker', pt, isPlayer);
      if (isPlayer) this.player = e;
      e.state = 'idle';
    });

    for (const e of this.entities) this.updateEntityVisuals(e, 0);
    this.spectateTarget = this.player && !this.player.alive ? null : this.player;
  }

  createEntity(species, team, pt, isPlayer) {
    const sp = SPECIES[species];
    const group = createAnimal(species, { scale: isPlayer ? 1.06 : 1 });
    group.position.set(pt.x, this.world.heightAt(pt.x, pt.z), pt.z);
    group.rotation.y = Math.random() * Math.PI * 2;
    this.entityRoot.add(group);

    const marker = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this.markerTexture, color: 0xffffff, transparent: true, opacity: 0.9,
      depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending
    }));
    marker.scale.set(1.65, 1.65, 1);
    marker.position.y = (group.userData.height || 1.5) + 0.8;
    marker.visible = false;
    marker.renderOrder = 30;
    group.add(marker);

    let ring = null;
    if (isPlayer) {
      ring = new THREE.Mesh(
        new THREE.RingGeometry(0.52, 0.65, 24),
        new THREE.MeshBasicMaterial({ color: team === 'hider' ? 0xc9f16b : 0xff5a3c, transparent: true, opacity: 0.65, side: THREE.DoubleSide, depthWrite: false })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.035;
      group.add(ring);
    }

    const entity = {
      id: `${team}-${species}-${Math.random().toString(36).slice(2, 7)}`,
      species, team, isPlayer,
      name: sp.name,
      group, marker, ring,
      pos: new THREE.Vector3(pt.x, this.world.heightAt(pt.x, pt.z), pt.z),
      yaw: Math.random() * Math.PI * 2,
      radius: 0.45,
      speedActual: 0,
      alive: true,
      state: team === 'hider' ? 'toHide' : 'idle',
      hideSpot: null,
      target: null,
      lastSeen: null,
      lastSeenTime: -99,
      patrolTarget: null,
      patrolTimer: 0,
      scentTimer: rand(3, 7),
      scent: null,
      stillTime: 0,
      stunUntil: 0,
      stamina: 100,
      abilityReadyAt: 0,
      abilityCdTotal: 0,
      camoUntil: 0,
      burstUntil: 0,
      revealedUntil: 0,
      climbing: null,
      climbAngle: 0,
      treeShake: 0,
      deathT: 0,
      currentOpacity: 1,
      baseColors: null,
      baseScale: isPlayer ? 1.06 : 1,
      speed: sp.speed,
      sprint: sp.sprint,
      captures: 0,
      stuck: 0,
      detourUntil: 0,
      detourSign: Math.random() > 0.5 ? 1 : -1,
      splashT: 0
    };
    this.entities.push(entity);
    return entity;
  }

  assignHideSpot(e) {
    const bushes = this.world.bushes
      .filter((b) => !this.usedBushes.has(b) && Math.hypot(b.x - e.pos.x, b.z - e.pos.z) < 70 && Math.hypot(b.x - this.world.seekerSpawn.x, b.z - this.world.seekerSpawn.z) > 18)
      .sort(() => Math.random() - 0.5);
    let spot = bushes[0];
    if (!spot) {
      const p = this.world.randomClearPoint(10, this.world.arena - 8);
      spot = { x: p.x, z: p.z, r: 1.4 };
    } else {
      this.usedBushes.add(spot);
    }
    e.hideSpot = { x: spot.x + rand(-0.45, 0.45), z: spot.z + rand(-0.45, 0.45) };
  }

  disposeRound() {
    this.disposeEntities();
    if (this.world) {
      this.world.dispose();
      this.world = null;
    }
    this.disposeEffects();
    this.disposeShowcase();
  }

  disposeEntities() {
    for (const e of this.entities) {
      if (e.group) {
        this.entityRoot.remove(e.group);
        disposeAnimal(e.group);
      }
    }
    this.entities = [];
    this.player = null;
  }

  updatePlayer(dt) {
    const p = this.player;
    if (!p) return;
    const look = this.input.takeLook();
    if (this.input.locked || this.input.touch) {
      this.yaw -= look.x * this.input.sensitivity;
      this.pitch -= look.y * this.input.sensitivity;
      this.pitch = clamp(this.pitch, -0.12, 0.92);
    }
    if (!p.alive) return;
    if (p.stunUntil > this.time) {
      p.speedActual = 0;
      return;
    }
    if (this.phase === 'hide' && p.team === 'seeker') {
      p.speedActual = 0;
      return;
    }
    if (p.climbing) {
      this.updateClimbing(p, dt);
      return;
    }

    if (this.input.consume('KeyF')) this.tryAbility(p);
    if (this.input.consume('KeyE')) {
      const tree = p.species === 'monkey' ? this.world.nearestTree(p.pos.x, p.pos.z, 2.8) : null;
      if (tree) this.startClimb(p, tree);
      else if (p.species === 'monkey') this.ui.toast('SIN ÁRBOL CERCA', '', 'acércate al tronco y pulsa E', 1.4);
    }

    const mv = this.input.moveVector();
    const moving = Math.abs(mv.x) + Math.abs(mv.z) > 0.02;
    const sp = SPECIES[p.species];
    let speed = sp.speed;
    const wantSprint = this.input.sprint && moving && p.stamina > 0.5;
    if (wantSprint) speed *= sp.sprint;
    if (this.input.crouch) speed *= 0.55;
    if (p.burstUntil > this.time) speed *= 1.58;
    if (p.camoUntil > this.time) speed *= 0.96;

    if (wantSprint) {
      p.stamina = Math.max(0, p.stamina - 23 * dt);
      p.regenDelay = 0.7;
    } else {
      p.regenDelay = Math.max(0, (p.regenDelay || 0) - dt);
      if (p.regenDelay <= 0) p.stamina = Math.min(100, p.stamina + 16 * dt);
    }

    const f = { x: -Math.sin(this.yaw), z: -Math.cos(this.yaw) };
    const r = { x: Math.cos(this.yaw), z: -Math.sin(this.yaw) };
    let dx = f.x * mv.z + r.x * mv.x;
    let dz = f.z * mv.z + r.z * mv.x;
    const dl = Math.hypot(dx, dz);
    if (dl > 0.001) { dx /= dl; dz /= dl; }

    if (moving) {
      p.yaw = lerpAngle(p.yaw, Math.atan2(dx, dz), Math.min(1, dt * 11));
    }
    p.crouching = this.input.crouch;
    this.moveEntity(p, { x: dx, z: dz }, moving ? speed : 0, dt);

    if (this.input.consume('Space')) p.jumpT = 0.45;

    if (p.speedActual > 1.0) {
      this.footstepT -= dt;
      if (this.footstepT <= 0) {
        this.audio.step();
        this.footstepT = clamp(0.46 - p.speedActual * 0.022, 0.2, 0.4);
      }
    }
    if (p.team === 'seeker') this.checkPlayerCapture();
    this.updateEntityVisuals(p, dt);
  }

  setTreeCover(tree, hidden) {
    if (tree?.crown) tree.crown.visible = !hidden;
  }

  startClimb(p, tree) {
    p.climbing = tree;
    this.setTreeCover(tree, true);
    p.climbAngle = Math.atan2(p.pos.z - tree.z, p.pos.x - tree.x);
    p.treeShake = 0;
    p.stillTime = 0;
    p.speedActual = 0;
    const radius = tree.branchLen * 0.82;
    p.pos.x = tree.x + Math.cos(p.climbAngle) * radius;
    p.pos.z = tree.z + Math.sin(p.climbAngle) * radius;
    p.pos.y = tree.climbY;
    p.group.position.set(p.pos.x, p.pos.y, p.pos.z);
    this.audio.ability('camo');
    if (p.isPlayer) this.ui.toast('EN LA COPA', 'acid', 'permanece inmóvil para camuflarte · E para bajar', 2.1);
    this.spawnRing(new THREE.Vector3(p.pos.x, p.pos.y, p.pos.z), 0xc9f16b, 2.4, 0.7);
  }

  updateClimbing(p, dt) {
    const tree = p.climbing;
    const mv = this.input.moveVector();
    if (this.input.consume('Space') || this.input.consume('KeyE')) {
      this.dropFromTree(p, false);
      return;
    }
    if (this.input.consume('KeyF')) this.tryAbility(p);
    if (Math.abs(mv.x) > 0.08) {
      p.climbAngle += mv.x * dt * 1.5;
      p.stillTime = 0;
      p.speedActual = 1.5;
    } else {
      p.stillTime += dt;
      p.speedActual = 0;
    }
    const radius = tree.branchLen * 0.82;
    p.pos.x = tree.x + Math.cos(p.climbAngle) * radius;
    p.pos.z = tree.z + Math.sin(p.climbAngle) * radius;
    p.pos.y = tree.climbY;
    p.yaw = lerpAngle(p.yaw, Math.atan2(p.pos.x - tree.x, p.pos.z - tree.z), Math.min(1, dt * 6));

    if (this.phase === 'hunt') {
      let near = false;
      for (const s of this.entities) {
        if (s.team !== 'seeker' || !s.alive) continue;
        if (Math.hypot(s.pos.x - tree.x, s.pos.z - tree.z) < 3.2) near = true;
      }
      if (near) p.treeShake += dt;
      else p.treeShake = Math.max(0, p.treeShake - dt * 1.5);
      if (p.treeShake > 2.5) {
        this.dropFromTree(p, true);
        return;
      }
    }
    this.updateEntityVisuals(p, dt);
  }

  dropFromTree(p, forced) {
    if (!p.climbing) return;
    this.setTreeCover(p.climbing, false);
    p.climbing = null;
    p.treeShake = 0;
    p.stillTime = 0;
    const pos = { x: p.pos.x, z: p.pos.z };
    this.world.resolve(pos, 0.5);
    p.pos.x = pos.x;
    p.pos.z = pos.z;
    p.pos.y = this.world.heightAt(p.pos.x, p.pos.z);
    p.group.position.set(p.pos.x, p.pos.y, p.pos.z);
    if (forced) {
      p.stunUntil = this.time + 1.1;
      this.shake = Math.max(this.shake, 0.7);
      this.audio.capture();
      this.ui.toast('¡TE HAN SACUDIDO!', 'coral', 'has caído del árbol', 1.8);
      this.spawnBurst(new THREE.Vector3(p.pos.x, p.pos.y + 0.8, p.pos.z), 0xff5a3c, 14, 3);
    } else {
      this.audio.step();
      if (p.isPlayer) this.ui.toast('DE VUELTA AL SUELO', '', '', 1.1);
    }
  }

  tryAbility(p) {
    const now = this.time;
    if (p.abilityReadyAt > now) {
      if (p.isPlayer) this.ui.toast('HABILIDAD EN RECARGA', '', `lista en ${Math.ceil(p.abilityReadyAt - now)} s`, 1.1);
      return;
    }
    switch (p.species) {
      case 'chameleon': {
        p.camoUntil = now + 10;
        p.abilityReadyAt = now + 24;
        p.abilityCdTotal = 24;
        this.applyCamo(p, true);
        this.audio.ability('camo');
        this.spawnRing(p.pos.clone(), 0xc9f16b, 3.8, 0.8);
        if (p.isPlayer) this.ui.toast('CAMUFLAJE ACTIVO', 'acid', '10 segundos · muévete con cuidado', 1.8);
        break;
      }
      case 'cheetah': {
        p.burstUntil = now + 4;
        p.abilityReadyAt = now + 15;
        p.abilityCdTotal = 15;
        this.audio.ability('burst');
        this.spawnRing(p.pos.clone(), 0xff5a3c, 4.5, 0.7);
        this.shake = Math.max(this.shake, 0.18);
        if (p.isPlayer) this.ui.toast('IMPULSO', 'coral', '4 segundos de velocidad brutal', 1.5);
        break;
      }
      case 'lion': {
        p.abilityReadyAt = now + 26;
        p.abilityCdTotal = 26;
        this.doRoar(p);
        break;
      }
      case 'monkey': {
        if (p.isPlayer) this.ui.toast('TREPA A UN ÁRBOL', '', 'acércate al tronco y pulsa E', 1.5);
        break;
      }
      default: {
        if (p.isPlayer) this.ui.toast('SIN HABILIDAD', '', 'confía en tus patas', 1.3);
        break;
      }
    }
  }

  doRoar(e) {
    this.audio.ability('roar');
    this.shake = Math.max(this.shake, e.isPlayer ? 0.6 : 0.36);
    this.spawnRing(e.pos.clone(), 0xff5a3c, 26, 1.25);
    this.spawnBurst(new THREE.Vector3(e.pos.x, e.pos.y + 1.6, e.pos.z), 0xff5a3c, 12, 5);
    let revealed = 0;
    for (const h of this.entities) {
      if (h.team !== 'hider' || !h.alive) continue;
      const d = Math.hypot(h.pos.x - e.pos.x, h.pos.z - e.pos.z);
      if (d < 32 && h.speedActual > 0.9) {
        h.revealedUntil = this.time + 5;
        revealed++;
      }
    }
    if (e.isPlayer) {
      this.ui.toast('RUGIDO', 'coral', revealed ? `${revealed} presa${revealed > 1 ? 's' : ''} en movimiento revelada${revealed > 1 ? 's' : ''}` : 'nadie se movió… esta vez', 2.1);
      this.ui.feed(`<b>LEÓN</b> rugió · ${revealed} presa${revealed === 1 ? '' : 's'} revelada${revealed === 1 ? '' : 's'}`);
    } else {
      this.ui.feed('<b>EL LEÓN</b> ha rugido');
      if (this.player && this.player.team === 'hider' && this.player.revealedUntil > this.time) {
        this.ui.toast('¡TE HAN REVELADO!', 'coral', 'el león te ha sentido', 2);
      }
    }
    this.audio.ability('roar');
  }

  applyCamo(e, on) {
    const mats = e.group.userData.materials || [];
    if (on) {
      if (!e.baseColors) e.baseColors = mats.map((m) => m.color.clone());
      const cfg = MAPS[this.world ? this.world.mapId : 'jungle'];
      const target = new THREE.Color(cfg.groundBase).lerp(new THREE.Color(0xdfe8cf), 0.22);
      mats.forEach((m, i) => {
        if (e.baseColors[i]) m.color.copy(e.baseColors[i]).lerp(target, 0.78);
      });
    } else if (e.baseColors) {
      mats.forEach((m, i) => { if (e.baseColors[i]) m.color.copy(e.baseColors[i]); });
      e.baseColors = null;
    }
  }

  checkPlayerCapture() {
    const p = this.player;
    if (!p || !p.alive || p.team !== 'seeker') return;
    for (const h of this.entities) {
      if (h.team !== 'hider' || !h.alive) continue;
      const d = Math.hypot(h.pos.x - p.pos.x, h.pos.z - p.pos.z);
      if (d < 1.4 && Math.abs(h.pos.y - p.pos.y) < 1.6) {
        this.capture(p, h);
        return;
      }
    }
  }

  hiddenState(e) {
    if (!e.alive) return 'dead';
    if (e.camoUntil > this.time) return 'camo';
    if (e.climbing && e.stillTime > 1.0) return 'tree';
    const b = this.world ? this.world.inBush(e.pos.x, e.pos.z) : null;
    if (b && e.speedActual < 0.7) return 'bush';
    if (b) return 'bush-moving';
    return null;
  }

  detectionRadius(seeker, hider) {
    if (this.phase !== 'hunt') return 0;
    let r = 18;
    const hs = this.hiddenState(hider);
    if (hs === 'bush') r = 2.3;
    else if (hs === 'bush-moving') r = 8;
    else if (hs === 'camo') r = 3.8;
    else if (hs === 'tree') r = 5.2;
    if (hider.crouching) r *= 0.87;
    if (hider.speedActual > 4.2) r += 4.2;
    if (hider.revealedUntil > this.time) r = 45;
    if (this.world && this.world.lineBlocked(seeker.pos.x, seeker.pos.z, hider.pos.x, hider.pos.z)) r *= 0.5;
    return r;
  }

  nearestSeeker(e) {
    let best = null, bd = Infinity;
    for (const s of this.entities) {
      if (s.team !== 'seeker' || !s.alive) continue;
      const d = Math.hypot(s.pos.x - e.pos.x, s.pos.z - e.pos.z);
      if (d < bd) { bd = d; best = s; }
    }
    return { seeker: best, dist: bd };
  }

  updateEntityVisuals(e, dt) {
    if (!e.group) return;
    if (!e.alive) {
      e.deathT += dt;
      const baseY = this.world ? this.world.heightAt(e.pos.x, e.pos.z) : 0;
      e.group.position.set(e.pos.x, Math.max(baseY - Math.max(0, e.deathT - 0.9) * 0.75, baseY - 1.1), e.pos.z);
      animateAnimal(e.group, dt, 0, { dead: true });
      if (e.marker) e.marker.visible = false;
      if (e.ring) e.ring.visible = false;
      if (e.currentOpacity < 0.98) {
        e.currentOpacity = 1;
        setAnimalOpacity(e.group, 1);
      }
      if (e.deathT > 1.7) e.group.visible = false;
      return;
    }
    if (e.speedActual < 0.28) e.stillTime += dt;
    const baseY = this.world.heightAt(e.pos.x, e.pos.z);
    let jump = 0;
    if (e.jumpT > 0) {
      e.jumpT = Math.max(0, e.jumpT - dt);
      jump = Math.sin((1 - e.jumpT / 0.45) * Math.PI) * 0.55;
    }
    const y = e.climbing ? e.pos.y : baseY + jump;
    e.group.position.set(e.pos.x, y, e.pos.z);
    e.group.rotation.y = e.yaw;

    const hs = this.hiddenState(e);
    let opacity = 1;
    if (hs === 'camo') opacity = e.isPlayer ? 0.32 : 0.2;
    else if (hs === 'tree') opacity = e.isPlayer ? 0.55 : 0.4;
    else if (hs === 'bush') opacity = e.isPlayer ? 0.82 : 0.88;
    if (Math.abs(opacity - e.currentOpacity) > 0.02) {
      e.currentOpacity = opacity;
      setAnimalOpacity(e.group, opacity);
    }
    if (e.marker) {
      const show = this.player && this.player.team === 'seeker' && this.player.alive && e.revealedUntil > this.time && e.team === 'hider';
      e.marker.visible = !!show;
      if (show) {
        e.marker.material.opacity = 0.65 + Math.sin(this.time * 7) * 0.3;
        e.marker.position.y = (e.group.userData.height || 1.5) + 0.85 + Math.sin(this.time * 3) * 0.12;
      }
    }
    if (e.ring) {
      e.ring.visible = e.isPlayer && !e.climbing && hs !== 'camo';
      e.ring.material.opacity = 0.42 + Math.sin(this.time * 3) * 0.15;
    }
    animateAnimal(e.group, dt, e.speedActual, {});
  }

  updateAI(dt) {
    for (const e of this.entities) {
      if (e.isPlayer || !e.alive) continue;
      if (e.team === 'seeker' && this.phase === 'hide') {
        e.speedActual = 0;
        this.updateEntityVisuals(e, dt);
        continue;
      }
      if (e.stunUntil > this.time) {
        e.speedActual = 0;
        this.updateEntityVisuals(e, dt);
        continue;
      }
      if (e.team === 'hider') {
        if (this.phase === 'hide') this.updateHiderHide(e, dt);
        else this.updateHiderHunt(e, dt);
      } else {
        this.updateSeekerAI(e, dt);
      }
      this.updateEntityVisuals(e, dt);
    }
  }

  updateHiderHide(e, dt) {
    if (!e.hideSpot) this.assignHideSpot(e);
    const d = e.hideSpot ? Math.hypot(e.hideSpot.x - e.pos.x, e.hideSpot.z - e.pos.z) : 0;
    if (d > 1.1) {
      const dir = { x: (e.hideSpot.x - e.pos.x) / d, z: (e.hideSpot.z - e.pos.z) / d };
      e.state = 'toHide';
      this.moveEntity(e, dir, SPECIES[e.species].speed * 1.22, dt);
    } else {
      e.state = 'hidden';
      e.speedActual = 0;
      e.crouching = true;
      const ns = this.nearestSeeker(e);
      if (ns.seeker) e.yaw = lerpAngle(e.yaw, Math.atan2(ns.seeker.pos.x - e.pos.x, ns.seeker.pos.z - e.pos.z), Math.min(1, dt * 3));
    }
  }

  updateHiderHunt(e, dt) {
    const ns = this.nearestSeeker(e);
    const hidden = this.hiddenState(e);
    const inBush = !!(this.world && this.world.inBush(e.pos.x, e.pos.z));
    e.crouching = inBush;
    const threat = ns.seeker ? ns.dist : Infinity;
    const dangerRange = hidden === 'bush' ? 2.7 : hidden === 'camo' ? 3.2 : hidden === 'tree' ? 2.8 : 15.5;
    let flee = threat < dangerRange || (hidden === null && threat < 18);

    if (e.species === 'chameleon' && threat < 14 && e.abilityReadyAt <= this.time && !flee && !inBush) {
      this.tryAbility(e);
    }

    if (flee && ns.seeker) {
      e.state = 'flee';
      e.fleeTimer = (e.fleeTimer ?? 0) - dt;
      const away = Math.atan2(e.pos.x - ns.seeker.pos.x, e.pos.z - ns.seeker.pos.z);
      let dx = Math.sin(away), dz = Math.cos(away);
      // sidestep, so they don't run in a perfectly straight line
      dx += Math.cos(this.time * 1.7 + e.pos.z * 0.1) * 0.25;
      dz += Math.sin(this.time * 1.3 + e.pos.x * 0.1) * 0.25;
      const l = Math.hypot(dx, dz) || 1;
      dx /= l; dz /= l;
      if (e.species === 'chameleon' && threat < 12 && e.abilityReadyAt <= this.time) this.tryAbility(e);
      this.moveEntity(e, { x: dx, z: dz }, SPECIES[e.species].speed * SPECIES[e.species].sprint * 0.97, dt);
      if (e.fleeTimer <= 0) {
        e.fleeTimer = rand(3.6, 5.4);
        this.chooseFleeSpot(e, ns.seeker);
      }
      return;
    }

    if (threat > 24 && e.abilityReadyAt <= this.time && e.species === 'chameleon' && Math.random() < dt * 0.15) {
      this.tryAbility(e);
    }

    if (e.hideSpot) {
      const d = Math.hypot(e.hideSpot.x - e.pos.x, e.hideSpot.z - e.pos.z);
      if (d > 1.8) {
        e.state = 'toHide';
        this.moveEntity(e, { x: (e.hideSpot.x - e.pos.x) / d, z: (e.hideSpot.z - e.pos.z) / d }, SPECIES[e.species].speed * 0.82, dt);
        return;
      }
    } else if (!inBush) {
      const b = this.world.nearestBush(e.pos.x, e.pos.z, 35);
      if (b) {
        e.hideSpot = { x: b.x + rand(-0.3, 0.3), z: b.z + rand(-0.3, 0.3) };
        return;
      }
    }
    e.state = 'hidden';
    e.speedActual = 0;
    e.crouching = true;
    if (ns.seeker) e.yaw = lerpAngle(e.yaw, Math.atan2(ns.seeker.pos.x - e.pos.x, ns.seeker.pos.z - e.pos.z), Math.min(1, dt * 2));
  }

  chooseFleeSpot(e, seeker) {
    // Prefer a nearby thicket that is on the far side of the fleeing animal.
    // This gives the AI a real chance to break the seeker's line of sight.
    const thickets = this.world.bushes
      .map((b) => ({
        b,
        fromAnimal: Math.hypot(b.x - e.pos.x, b.z - e.pos.z),
        fromSeeker: Math.hypot(b.x - seeker.pos.x, b.z - seeker.pos.z)
      }))
      .filter((c) => c.fromAnimal > 2.5 && c.fromAnimal < 19 && c.fromSeeker > 5.5)
      .sort((a, b) => b.fromSeeker - a.fromSeeker);
    if (thickets.length) {
      const choice = thickets[(Math.random() * Math.min(4, thickets.length)) | 0].b;
      e.hideSpot = { x: choice.x + rand(-0.3, 0.3), z: choice.z + rand(-0.3, 0.3) };
      return;
    }
    const a = Math.atan2(e.pos.x - seeker.pos.x, e.pos.z - seeker.pos.z) + rand(-0.8, 0.8);
    let x = e.pos.x + Math.sin(a) * rand(10, 20);
    let z = e.pos.z + Math.cos(a) * rand(10, 20);
    const r = Math.hypot(x, z);
    if (r > this.world.arena - 6) { x *= (this.world.arena - 6) / r; z *= (this.world.arena - 6) / r; }
    const b = this.world.nearestBush(x, z, 22);
    e.hideSpot = b ? { x: b.x + rand(-0.3, 0.3), z: b.z + rand(-0.3, 0.3) } : { x, z };
  }

  updateSeekerAI(e, dt) {
    const sp = SPECIES[e.species];
    // ── target acquisition ──────────────────────────────
    let best = null, bestScore = Infinity;
    for (const h of this.entities) {
      if (h.team !== 'hider' || !h.alive) continue;
      const d = Math.hypot(h.pos.x - e.pos.x, h.pos.z - e.pos.z);
      const heard = h.speedActual > 4.2 && d < 18 &&
        !this.world.lineBlocked(e.pos.x, e.pos.z, h.pos.x, h.pos.z);
      const r = this.detectionRadius(e, h);
      if (d < r || heard) {
        const score = d - (h.revealedUntil > this.time ? 35 : 0) - (heard ? 7 : 0);
        if (score < bestScore) { bestScore = score; best = h; }
      }
    }

    if (best) {
      e.target = best;
      e.lastSeen = { x: best.pos.x, z: best.pos.z };
      e.lastSeenTime = this.time;
      e.scent = null;
      e.state = 'chase';
    } else if (e.target && e.target.alive && this.time - e.lastSeenTime < 3.2) {
      e.state = 'chase';
      e.lastSeen = { x: e.target.pos.x, z: e.target.pos.z };
    } else {
      e.target = null;
    }

    // ── abilities ───────────────────────────────────────
    if (e.target) {
      const d = Math.hypot(e.target.pos.x - e.pos.x, e.target.pos.z - e.pos.z);
      if (e.species === 'lion' && d < 23 && e.abilityReadyAt <= this.time) this.tryAbility(e);
      if (e.species === 'cheetah' && d > 7 && d < 34 && e.abilityReadyAt <= this.time) this.tryAbility(e);
    }

    // ── chase ───────────────────────────────────────────
    if (e.state === 'chase') {
      const target = e.target;
      const tx = target && target.alive ? target.pos.x : e.lastSeen?.x ?? e.pos.x;
      const tz = target && target.alive ? target.pos.z : e.lastSeen?.z ?? e.pos.z;
      const d = Math.hypot(tx - e.pos.x, tz - e.pos.z);
      const dy = target ? Math.abs(target.pos.y - e.pos.y) : 0;

      if (target && target.alive && target.climbing && d < 4.2) {
        // the monkey is up in the tree: hold the trunk and shake it
        e.speedActual = 0;
        e.yaw = lerpAngle(e.yaw, Math.atan2(target.pos.x - e.pos.x, target.pos.z - e.pos.z), Math.min(1, dt * 6));
        return;
      }
      if (target && target.alive && d < 1.42 && dy < 1.7) {
        this.capture(e, target);
        return;
      }
      if (!target && d < 1.8) {
        // reached the last known position: search a small circle
        e.target = null;
        e.patrolTarget = this.world.randomClearPoint(4, this.world.arena - 6);
        e.patrolTimer = rand(2, 4);
        e.state = 'patrol';
        return;
      }
      let speed = sp.speed * sp.sprint * 0.88;
      if (e.burstUntil > this.time) speed *= 1.4;
      if (d < 4) speed *= 0.9;
      const dir = d > 0.001 ? { x: (tx - e.pos.x) / d, z: (tz - e.pos.z) / d } : { x: 0, z: 0 };
      this.moveEntity(e, dir, speed, dt);
      return;
    }

    // ── patrol / scent ──────────────────────────────────
    e.state = 'patrol';
    e.patrolTimer -= dt;
    e.scentTimer -= dt;
    if (e.scentTimer <= 0) {
      e.scentTimer = rand(9, 14);
      let nearest = null, nd = 48;
      for (const h of this.entities) {
        if (h.team !== 'hider' || !h.alive) continue;
        const d = Math.hypot(h.pos.x - e.pos.x, h.pos.z - e.pos.z);
        if (d < nd) { nd = d; nearest = h; }
      }
      if (nearest) {
        e.scent = { x: nearest.pos.x + rand(-9, 9), z: nearest.pos.z + rand(-9, 9), until: this.time + 5 };
        e.patrolTarget = { x: e.scent.x, z: e.scent.z };
        e.patrolTimer = 5.5;
      }
    }
    if (!e.patrolTarget || e.patrolTimer <= 0 || Math.hypot(e.patrolTarget.x - e.pos.x, e.patrolTarget.z - e.pos.z) < 2.4) {
      let target;
      if (Math.random() < 0.58 && this.world.bushes.length) {
        const b = this.world.bushes[(Math.random() * this.world.bushes.length) | 0];
        target = { x: b.x + rand(-1, 1), z: b.z + rand(-1, 1) };
      } else {
        target = this.world.randomClearPoint(8, this.world.arena - 7);
      }
      e.patrolTarget = target;
      e.patrolTimer = rand(5, 9);
    }
    const d = Math.hypot(e.patrolTarget.x - e.pos.x, e.patrolTarget.z - e.pos.z);
    if (d > 0.8) {
      let speed = sp.speed * (e.scent ? 1.05 : 0.86);
      if (e.burstUntil > this.time) speed *= 1.4;
      this.moveEntity(e, { x: (e.patrolTarget.x - e.pos.x) / d, z: (e.patrolTarget.z - e.pos.z) / d }, speed, dt);
    } else {
      e.speedActual = 0;
    }
  }

  moveEntity(e, dir, speed, dt) {
    let dx = dir.x, dz = dir.z;
    const l0 = Math.hypot(dx, dz);
    if (l0 < 0.001 || speed <= 0.01) {
      e.speedActual = Math.max(0, e.speedActual - dt * 8);
      if (e.speedActual < 0.25) e.stillTime += dt;
      return;
    }
    dx /= l0; dz /= l0;

    if (!e.isPlayer) {
      // keep some personal space from teammates
      for (const o of this.entities) {
        if (o === e || !o.alive) continue;
        const d = Math.hypot(o.pos.x - e.pos.x, o.pos.z - e.pos.z);
        if (d > 0.001 && d < 1.25) {
          const w = (1.25 - d) / 1.25 * 0.9;
          dx += ((e.pos.x - o.pos.x) / d) * w;
          dz += ((e.pos.z - o.pos.z) / d) * w;
        }
      }
      // steer around big obstacles
      for (const c of this.world.colliders) {
        const d = c.type === 'circle'
          ? Math.hypot(e.pos.x - c.x, e.pos.z - c.z)
          : Math.hypot(e.pos.x - c.x, e.pos.z - c.z);
        const rr = (c.type === 'circle' ? c.r : Math.max(c.hw, c.hd)) + 2.2;
        if (d > 0.01 && d < rr) {
          const w = (rr - d) / rr * 1.4;
          dx += ((e.pos.x - c.x) / d) * w;
          dz += ((e.pos.z - c.z) / d) * w;
        }
      }
      const edge = Math.hypot(e.pos.x, e.pos.z);
      if (edge > this.world.arena - 5) {
        const w = (edge - (this.world.arena - 5)) / 5 * 2.2;
        dx -= (e.pos.x / edge) * w;
        dz -= (e.pos.z / edge) * w;
      }
      if (e.detourUntil > this.time) {
        const px = -dz * e.detourSign, pz = dx * e.detourSign;
        dx += px * 1.1; dz += pz * 1.1;
      }
    }
    const ln = Math.hypot(dx, dz);
    if (ln < 0.001) return;
    dx /= ln; dz /= ln;

    const step = speed * dt;
    const pos = { x: e.pos.x + dx * step, z: e.pos.z + dz * step };
    this.world.resolve(pos, e.radius);
    const moved = Math.hypot(pos.x - e.pos.x, pos.z - e.pos.z);
    e.pos.x = pos.x;
    e.pos.z = pos.z;
    const inst = moved / Math.max(dt, 0.0001);
    e.speedActual = e.speedActual * 0.4 + inst * 0.6;
    if (e.speedActual < 0.3) e.stillTime += dt; else e.stillTime = 0;
    if (e.speedActual > 0.4) e.yaw = lerpAngle(e.yaw, Math.atan2(dx, dz), Math.min(1, dt * 10));

    if (moved < step * 0.3) {
      e.stuck += dt;
      if (e.stuck > 0.55) {
        e.stuck = 0;
        e.detourUntil = this.time + rand(0.7, 1.2);
        e.detourSign = Math.random() > 0.5 ? 1 : -1;
      }
    } else {
      e.stuck = Math.max(0, e.stuck - dt * 1.5);
    }
  }

  update(dt) {
    dt = Math.min(dt, 0.05);
    this.audio.update(dt);
    if (this.mode === 'menu') {
      this.updateMenu(dt);
    } else if (this.mode === 'playing') {
      if (this.paused) {
        // frozen frame
      } else {
        this.time += dt;
        this.roundElapsed += dt;
        if (this.world) this.world.update(dt);
        if (this.phase === 'hide' || this.phase === 'hunt') this.updatePlaying(dt);
        else if (this.phase === 'roundEnd') this.updateRoundEnd(dt);
        this.updateEffects(dt);
        this.updateCamera(dt);
        if (this.phase === 'hide' || this.phase === 'hunt') {
          this.syncUI();
          this.drawMinimap(dt);
        }
      }
    } else if (this.mode === 'matchEnd') {
      if (this.world) this.world.update(dt);
      this.updateEffects(dt);
      this.updateCamera(dt);
    }
    this.input.endFrame();
  }

  updatePlaying(dt) {
    if (this.phase === 'hide') {
      this.phaseTime -= dt;
      if (this.player && this.player.team === 'seeker') this.ui.showBlackout(this.phaseTime);
      if (this.phaseTime <= 0) this.startHunt();
    } else {
      this.phaseTime -= dt;
      if (this.phaseTime <= 0) {
        this.endRound('hider');
        return;
      }
    }

    this.updatePlayer(dt);
    this.updateAI(dt);

    if (this.phase === 'hunt' && this.aliveHiders() === 0) {
      this.endRound('seeker');
      return;
    }
    if (this.phase === 'hide' && this.player && !this.player.alive) {
      // safety net — should never happen while seekers are frozen
      this.endRound('seeker');
    }
  }

  aliveHiders() {
    let n = 0;
    for (const e of this.entities) if (e.team === 'hider' && e.alive) n++;
    return n;
  }

  endRound(winner) {
    if (this.phase !== 'hide' && this.phase !== 'hunt') return;
    this.phase = 'roundEnd';
    this.paused = false;
    if (this.player?.climbing) this.setTreeCover(this.player.climbing, false);
    this.scores[winner]++;
    this.matchOver = this.scores[winner] >= WINS_NEEDED;
    this.endCountdown = this.matchOver ? 6 : 8;
    this.input.enabled = false;
    this.input.releaseLock();
    this.ui.hidePhase();
    this.ui.setScores(this.scores.hider, this.scores.seeker);
    this.ui.setScores(this.scores.hider, this.scores.seeker);
    this.ui.$('spectate').classList.add('hidden');

    const alive = this.aliveHiders();
    const p = this.player;
    let sub;
    if (winner === 'hider') {
      sub = `${alive} de 9 presas han sobrevivido. La caza se apaga.`;
      if (p && p.team === 'hider' && p.alive) sub = `Has sobrevivido hasta el final. ${alive} de 9 presas siguen vivas.`;
      if (p && p.team === 'seeker') sub = `Se te han escapado ${alive} presas. La selva se queda con ellas.`;
      if (p && p.team === 'hider' && p.alive) this.stats.survived++;
    } else {
      const used = Math.max(0, HUNT_TIME - Math.max(0, this.phaseTime));
      sub = `Las 9 presas han sido devoradas${used > 0 ? ` en ${formatTime(used)}` : ''}. No quedó nadie.`;
      if (p && p.team === 'seeker') sub = `Has eliminado a las 9 presas en ${formatTime(used)}. Cacería perfecta.`;
      else sub = 'El último escondido ha caído. La caza ha terminado.';
    }

    this.ui.showRoundEnd({
      round: this.roundIndex + 1,
      winner,
      sub,
      hiderScore: this.scores.hider,
      seekerScore: this.scores.seeker,
      final: this.matchOver,
      countdown: this.endCountdown
    });
    const playerWon = p && p.team === winner;
    this.audio.result(!!playerWon);
    this.ui.toast(winner === 'hider' ? 'RONDA PARA LOS ESCONDIDOS' : 'RONDA PARA LOS CAZADORES', winner === 'hider' ? 'acid' : 'coral', '', 2.2);
  }

  updateRoundEnd(dt) {
    if (this.world) this.world.update(dt);
    this.updateEffects(dt);
    this.updateCamera(dt);
    this.endCountdown -= dt;
    this.ui.updateRoundCountdown(Math.max(0, Math.ceil(this.endCountdown)));
    if (this.endCountdown <= 0) {
      if (this.matchOver) this.showMatchEnd();
      else this.continueRound();
    }
  }

  continueRound() {
    if (this.phase !== 'roundEnd') return;
    if (this.matchOver) { this.showMatchEnd(); return; }
    this.roundIndex++;
    this.ui.hideRoundEnd();
    this.startRound();
  }

  showMatchEnd() {
    this.mode = 'matchEnd';
    this.phase = 'matchEnd';
    this.paused = false;
    this.input.enabled = false;
    this.input.releaseLock();
    this.ui.hideRoundEnd();
    this.ui.hidePhase();
    this.ui.hideHud();
    this.ui.$('spectate').classList.add('hidden');
    const p = this.player;
    const playerWon = p && this.scores[p.team] >= WINS_NEEDED;
    const winner = this.scores.hider >= WINS_NEEDED ? 'hider' : 'seeker';
    const sub = winner === 'hider'
      ? 'Los escondidos han sobrevivido. La partida es suya.'
      : 'Los cazadores han arrasado el mapa. La partida es suya.';
    const captures = this.stats.captures;
    const survived = this.stats.survived;
    const stats = `<span>TU ROL <b>${this.config.role === 'hider' ? 'ESCONDIDO' : 'CAZADOR'}</b></span>
      <span>CAPTURAS <b>${captures}</b></span><span>SUPERVIVENCIAS <b>${survived}</b></span>`;
    this.ui.showMatchEnd({
      playerWon: !!playerWon,
      sub,
      hiderScore: this.scores.hider,
      seekerScore: this.scores.seeker,
      stats
    });
    this.audio.result(!!playerWon);
    this.spectateTarget = null;
    this.snapCamera = false;
  }

  pause() {
    if (this.mode !== 'playing' || this.paused) return;
    if (this.phase !== 'hide' && this.phase !== 'hunt') return;
    this.paused = true;
    this.input.enabled = false;
    this.input.releaseLock();
    this.ui.showPause(true);
  }

  resume() {
    if (!this.paused) return;
    this.paused = false;
    this.ui.showPause(false);
    this.input.enabled = true;
    this.input.reset();
    this.input.requestLock();
  }

  quitToMenu() {
    this.ui.showPause(false);
    this.ui.hideHow();
    this.ui.hideRoundEnd();
    this.ui.hideMatchEnd();
    this.ui.hideHud();
    this.ui.hidePhase();
    this.scores = { hider: 0, seeker: 0 };
    this.config.mapId = this.matchMaps[this.roundIndex] || this.config.mapId;
    this.showMenu();
  }

  isPlaying() {
    return this.mode === 'playing' && (this.phase === 'hide' || this.phase === 'hunt') && !this.paused;
  }

  getHudState() {
    const p = this.player;
    const alive = this.aliveHiders();
    let status = 'AL DESCUBIERTO';
    let statusMode = '';
    let objective = '';
    let stamina = 100;
    let ability = null;
    const phaseTime = this.phaseTime;
    if (p) {
      const sp = SPECIES[p.species];
      stamina = p.stamina;
      const key = sp.ability === 'trepar' ? 'E' : sp.ability === 'none' ? '—' : 'F';
      if (!p.alive) {
        ability = { name: 'ELIMINADO', desc: 'observando la caza', key: '—', ready: true, ratio: 1, total: 0 };
        status = 'ELIMINADO';
        statusMode = 'danger';
        objective = 'OBSERVANDO A TUS COMPAÑEROS';
      } else {
        let name = sp.abilityName;
        let desc = sp.abilityDesc;
        const total = p.abilityCdTotal || (sp.id === 'chameleon' ? 24 : sp.id === 'cheetah' ? 15 : sp.id === 'lion' ? 26 : 1);
        const remain = Math.max(0, p.abilityReadyAt - this.time);
        let ready = remain <= 0.01;
        let ratio = total > 1 ? 1 - remain / total : 1;
        if (sp.id === 'monkey') {
          const tree = this.world ? this.world.nearestTree(p.pos.x, p.pos.z, 2.8) : null;
          if (p.climbing) desc = p.stillTime > 1 ? 'Fundido con la copa · E para bajar' : 'En la copa · quieto para camuflarte';
          else desc = tree ? 'Toca E para trepar a este árbol' : 'Busca un árbol cercano';
          ready = true; ratio = 1;
        }
        if (sp.id === 'chameleon' && p.camoUntil > this.time) {
          desc = `Camuflaje activo · ${Math.ceil(p.camoUntil - this.time)} s`;
          ready = true; ratio = 1;
        }
        if (sp.id === 'cheetah' && p.burstUntil > this.time) {
          desc = `Impulso activo · ${Math.ceil(p.burstUntil - this.time)} s`;
          ready = true; ratio = 1;
        }
        if (sp.ability === 'none') { name = 'SIN HABILIDAD'; desc = `${sp.short}: velocidad y silencio`; ready = true; ratio = 1; }
        ability = { name, desc, key, ready, ratio, total };

        if (p.team === 'seeker') {
          let near = false;
          for (const h of this.entities) {
            if (h.team !== 'hider' || !h.alive) continue;
            const d = Math.hypot(h.pos.x - p.pos.x, h.pos.z - p.pos.z);
            if (d < 13 && !this.world.lineBlocked(p.pos.x, p.pos.z, h.pos.x, h.pos.z)) { near = true; break; }
          }
          status = near ? 'PRESA A LA VISTA' : 'RASTREANDO';
          statusMode = near ? 'danger' : '';
        } else {
          const hs = this.hiddenState(p);
          const ns = this.nearestSeeker(p);
          if (p.treeShake > 0.25) { status = '¡SACUDEN EL ÁRBOL!'; statusMode = 'danger'; }
          else if (hs === 'camo') { status = 'CAMUFLAJE ACTIVO'; statusMode = 'hidden'; }
          else if (hs === 'tree') { status = 'OCULTO EN LA COPA'; statusMode = 'hidden'; }
          else if (hs === 'bush') { status = 'OCULTO EN LA VEGETACIÓN'; statusMode = 'hidden'; }
          else if (p.crouching) { status = 'AGACHADO'; statusMode = ''; }
          else if (ns.dist < 12) { status = 'EN PELIGRO'; statusMode = 'danger'; }
          else { status = 'AL DESCUBIERTO'; statusMode = ''; }
        }

        if (this.phase === 'hide') {
          objective = p.team === 'hider'
            ? `ESCÓNDETE · QUEDAN ${formatTime(phaseTime)}`
            : `PANTALLA A OSCURAS · ${formatTime(phaseTime)}`;
        } else if (this.phase === 'hunt') {
          objective = p.team === 'hider'
            ? `SOBREVIVE · QUEDAN ${formatTime(phaseTime)}`
            : `CAZA A LAS 9 PRESAS · QUEDAN ${formatTime(phaseTime)}`;
        }
      }
    }
    return {
      phase: this.phase,
      time: phaseTime,
      round: this.roundIndex + 1,
      alive,
      objective,
      status,
      statusMode,
      stamina,
      ability,
      spectating: !!(p && !p.alive && p.team === 'hider' && (this.phase === 'hide' || this.phase === 'hunt'))
    };
  }

  syncUI() {
    this.ui.setScores(this.scores.hider, this.scores.seeker);
    this.ui.updateHud(this.getHudState());
    if (this.player && this.player.team === 'seeker' && this.phase === 'hide') {
      this.ui.showBlackout(this.phaseTime);
    }
  }

  capture(seeker, hider) {
    if (!hider.alive) return;
    hider.alive = false;
    hider.deathT = 0;
    hider.speedActual = 0;
    hider.stunUntil = 0;
    hider.revealedUntil = 0;
    hider.camoUntil = 0;
    if (hider.climbing) {
      this.setTreeCover(hider.climbing, false);
      hider.climbing = null;
    }
    hider.currentOpacity = 1;
    setAnimalOpacity(hider.group, 1);
    if (hider.marker) hider.marker.visible = false;
    if (hider.ring) hider.ring.visible = false;
    seeker.captures = (seeker.captures || 0) + 1;
    if (seeker.isPlayer) this.stats.captures++;
    if (hider.isPlayer) {
      this.spectateTarget = null;
      this.ui.toast('TE HAN DEVORADO', 'coral', 'la ronda continúa sin ti', 2.4);
      this.ui.flash();
    } else if (seeker.isPlayer) {
      this.ui.toast('PRESA ELIMINADA', 'coral', `${this.aliveHiders()} presas restantes`, 1.5);
      this.ui.flash();
    }
    const spName = SPECIES[seeker.species].name;
    const hName = SPECIES[hider.species].name;
    this.ui.feed(`<b>${spName}</b> devoró a ${hName}`);
    this.audio.capture();
    this.shake = Math.max(this.shake, hider.isPlayer ? 1.0 : 0.55);
    const y = this.world.heightAt(hider.pos.x, hider.pos.z);
    this.spawnBurst(new THREE.Vector3(hider.pos.x, y + 1.0, hider.pos.z), 0xff6a45, 22, 4.2);
    this.spawnRing(new THREE.Vector3(hider.pos.x, y + 0.1, hider.pos.z), 0xff5a3c, 3.2, 0.7);
    if (hider.isPlayer) {
      this.ui.feed('<b>TÚ</b> has sido eliminado');
    }
  }

  updateCamera(dt) {
    if (this.mode === 'menu') return;
    if (this.mode === 'matchEnd' || this.phase === 'roundEnd' || this.phase === 'matchEnd') {
      this.overviewAngle = (this.overviewAngle || 0) + dt * 0.055;
      const r = 56;
      const pos = this.tmpV.set(Math.sin(this.overviewAngle) * r, 38, Math.cos(this.overviewAngle) * r);
      if (this.snapCamera) { this.camera.position.copy(pos); this.snapCamera = false; }
      else this.camera.position.lerp(pos, 1 - Math.exp(-dt * 2.2));
      this.camera.lookAt(0, 4, 0);
      const sh = this.shake;
      if (sh > 0.001) {
        this.camera.position.x += rand(-sh, sh) * 0.35;
        this.camera.position.y += rand(-sh, sh) * 0.3;
        this.shake = sh * Math.exp(-dt * 4);
      }
      this.setFov(52, dt);
      return;
    }

    const p = this.player;
    if (p && p.alive) {
      const baseY = p.climbing ? p.pos.y : this.world.heightAt(p.pos.x, p.pos.z);
      const target = this.tmpV.set(p.pos.x, baseY + (p.climbing ? 1.25 : 1.15), p.pos.z);
      const dist = p.climbing ? 7.6 : 6.2;
      const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
      const desired = this.tmpV2.set(
        target.x + Math.sin(this.yaw) * cp * dist,
        target.y + sp * dist + 1.0,
        target.z + Math.cos(this.yaw) * cp * dist
      );
      const ground = this.world.heightAt(desired.x, desired.z) + 0.65;
      if (desired.y < ground) desired.y = ground;
      if (this.snapCamera) {
        this.camera.position.copy(desired);
        this.camPos.copy(desired);
        this.camLook.copy(target);
        this.snapCamera = false;
      } else {
        const k = 1 - Math.exp(-dt * 10);
        this.camera.position.lerp(desired, k);
        this.camLook.lerp(target, k);
      }
      const look = this.tmpV.set(
        this.camLook.x - Math.sin(this.yaw) * 1.25,
        this.camLook.y + 0.1,
        this.camLook.z - Math.cos(this.yaw) * 1.25
      );
      this.camera.lookAt(look);
      if (p.burstUntil > this.time) this.setFov(70, dt);
      else this.setFov(p.team === 'seeker' ? 61 : 58, dt);
    } else {
      if (!this.spectateTarget || !this.spectateTarget.alive) {
        let best = null, bd = Infinity;
        const from = p ? p.pos : new THREE.Vector3(0, 0, 0);
        for (const e of this.entities) {
          if (e.team !== 'hider' || !e.alive) continue;
          const d = Math.hypot(e.pos.x - from.x, e.pos.z - from.z);
          if (d < bd) { bd = d; best = e; }
        }
        this.spectateTarget = best;
      }
      const t = this.spectateTarget;
      this.spectateAngle += dt * 0.24;
      if (t) {
        const y = this.world.heightAt(t.pos.x, t.pos.z);
        const pos = this.tmpV.set(
          t.pos.x + Math.sin(this.spectateAngle) * 9.5,
          y + 6.2,
          t.pos.z + Math.cos(this.spectateAngle) * 9.5
        );
        const g = this.world.heightAt(pos.x, pos.z) + 0.8;
        if (pos.y < g) pos.y = g;
        this.camera.position.lerp(pos, 1 - Math.exp(-dt * 3));
        this.camera.lookAt(t.pos.x, y + 1.0, t.pos.z);
      } else {
        const pos = this.tmpV.set(0, 40, 58);
        this.camera.position.lerp(pos, 1 - Math.exp(-dt * 2));
        this.camera.lookAt(0, 0, 0);
      }
      this.setFov(61, dt);
    }

    const sh = this.shake;
    if (sh > 0.001) {
      const amp = sh * 0.42;
      this.camera.position.x += rand(-amp, amp);
      this.camera.position.y += rand(-amp, amp) * 0.8;
      this.camera.position.z += rand(-amp, amp) * 0.6;
      this.camera.rotateZ(rand(-1, 1) * sh * 0.012);
      this.shake = sh * Math.exp(-dt * 4);
    }
  }

  setFov(target, dt) {
    const f = this.camera.fov;
    if (Math.abs(f - target) < 0.05) return;
    this.camera.fov = f + (target - f) * Math.min(1, dt * 6);
    this.camera.updateProjectionMatrix();
  }

  spawnBurst(pos, color = 0xff6a45, count = 18, power = 3.5) {
    const positions = new Float32Array(count * 3);
    const vel = [];
    for (let i = 0; i < count; i++) {
      positions[i * 3] = pos.x;
      positions[i * 3 + 1] = pos.y;
      positions[i * 3 + 2] = pos.z;
      const a = Math.random() * Math.PI * 2;
      const up = rand(0.3, 1.1);
      const m = rand(0.35, 1) * power;
      vel.push({ x: Math.cos(a) * m, y: up * power, z: Math.sin(a) * m });
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color, size: 0.52, map: this.glowTexture, transparent: true, opacity: 0.95,
      depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true
    });
    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    this.scene.add(points);
    this.effects.push({ type: 'burst', points, vel, age: 0, dur: 0.9, gravity: 9.5 });
  }

  spawnRing(pos, color = 0xc9f16b, maxR = 4, dur = 0.8) {
    const geo = new THREE.RingGeometry(0.94, 1.06, 48);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.75, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(pos.x, pos.y + 0.07, pos.z);
    mesh.scale.setScalar(0.35);
    this.scene.add(mesh);
    this.effects.push({ type: 'ring', mesh, age: 0, dur, maxR });
  }

  updateEffects(dt) {
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const fx = this.effects[i];
      fx.age += dt;
      if (fx.type === 'burst') {
        const arr = fx.points.geometry.attributes.position.array;
        for (let p = 0; p < fx.vel.length; p++) {
          const v = fx.vel[p];
          arr[p * 3] += v.x * dt;
          arr[p * 3 + 1] += v.y * dt;
          arr[p * 3 + 2] += v.z * dt;
          v.y -= fx.gravity * dt;
          v.x *= (1 - dt * 0.9);
          v.z *= (1 - dt * 0.9);
        }
        fx.points.geometry.attributes.position.needsUpdate = true;
        fx.points.material.opacity = Math.max(0, 1 - fx.age / fx.dur);
        if (fx.age >= fx.dur) {
          this.scene.remove(fx.points);
          fx.points.geometry.dispose();
          fx.points.material.dispose();
          this.effects.splice(i, 1);
        }
      } else {
        const t = Math.min(1, fx.age / fx.dur);
        fx.mesh.scale.setScalar(0.35 + t * fx.maxR);
        fx.mesh.material.opacity = Math.max(0, 0.75 * (1 - t));
        if (t >= 1) {
          this.scene.remove(fx.mesh);
          fx.mesh.geometry.dispose();
          fx.mesh.material.dispose();
          this.effects.splice(i, 1);
        }
      }
    }
  }

  disposeEffects() {
    for (const fx of this.effects) {
      if (fx.type === 'burst') {
        this.scene.remove(fx.points);
        fx.points.geometry.dispose();
        fx.points.material.dispose();
      } else {
        this.scene.remove(fx.mesh);
        fx.mesh.geometry.dispose();
        fx.mesh.material.dispose();
      }
    }
    this.effects = [];
  }

  drawMinimap(dt) {
    this.minimapT -= dt;
    if (this.minimapT > 0) return;
    this.minimapT = 0.075;
    if (!this.mapCtx) {
      this.mapCanvas = this.ui.minimap;
      this.mapCtx = this.mapCanvas ? this.mapCanvas.getContext('2d') : null;
    }
    const ctx = this.mapCtx;
    if (!ctx || !this.world) return;
    const W = this.mapCanvas.width;
    const cx = W / 2, cy = W / 2, R = W / 2 - 8;
    const arena = this.world.arena + 1;
    const sc = (R - 6) / arena;
    const mx = (x) => cx + x * sc;
    const my = (z) => cy + z * sc;
    const p = this.player;

    ctx.clearRect(0, 0, W, W);
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.clip();

    const bg = ctx.createRadialGradient(cx, cy, 8, cx, cy, R);
    bg.addColorStop(0, '#102319');
    bg.addColorStop(1, '#050c08');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, W);

    // rings
    ctx.strokeStyle = 'rgba(201,241,107,0.08)';
    ctx.lineWidth = 1;
    for (let r = 0.33; r < 1; r += 0.33) {
      ctx.beginPath(); ctx.arc(cx, cy, R * r, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy + R);
    ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy);
    ctx.stroke();

    // vegetation
    ctx.fillStyle = 'rgba(96,160,70,0.18)';
    for (const b of this.world.bushes) {
      ctx.beginPath(); ctx.arc(mx(b.x), my(b.z), Math.max(2.2, b.r * sc), 0, Math.PI * 2); ctx.fill();
    }
    // solids
    ctx.fillStyle = 'rgba(170,190,150,0.32)';
    for (const c of this.world.colliders) {
      if (c.type === 'circle') {
        if (c.r < 0.5) continue;
        ctx.beginPath(); ctx.arc(mx(c.x), my(c.z), Math.max(1.4, c.r * sc), 0, Math.PI * 2); ctx.fill();
      }
    }
    for (const b of this.world.boxes) {
      ctx.fillStyle = 'rgba(190,195,170,0.35)';
      ctx.fillRect(mx(b.x - b.hw), my(b.z - b.hd), b.hw * 2 * sc, b.hd * 2 * sc);
    }

    // shrines / spawn hints
    ctx.strokeStyle = 'rgba(201,241,107,0.22)';
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(mx(0), my(0), 2.8, 0, Math.PI * 2); ctx.stroke();

    const showAll = !p || !p.alive;
    if (p && p.alive) {
      for (const e of this.entities) {
        if (!e.alive || e.isPlayer) continue;
        const ex = mx(e.pos.x), ey = my(e.pos.z);
        if (e.team === 'hider') {
          if (p.team === 'hider') {
            ctx.fillStyle = 'rgba(159,229,95,0.9)';
            ctx.beginPath(); ctx.arc(ex, ey, 3.2, 0, Math.PI * 2); ctx.fill();
          } else {
            const d = Math.hypot(e.pos.x - p.pos.x, e.pos.z - p.pos.z);
            const rev = e.revealedUntil > this.time;
            if (rev || d < 15) {
              ctx.fillStyle = rev ? '#ff5a3c' : 'rgba(255,90,60,0.45)';
              ctx.beginPath(); ctx.arc(ex, ey, rev ? 4 : 2.8, 0, Math.PI * 2); ctx.fill();
              if (rev) {
                ctx.strokeStyle = 'rgba(255,90,60,0.55)';
                ctx.lineWidth = 1.2;
                ctx.beginPath(); ctx.arc(ex, ey, 7 + Math.sin(this.time * 5) * 2, 0, Math.PI * 2); ctx.stroke();
              }
            }
          }
        } else {
          if (p.team === 'hider') {
            const d = Math.hypot(e.pos.x - p.pos.x, e.pos.z - p.pos.z);
            if (d < 28) {
              ctx.fillStyle = '#ff5a3c';
              ctx.beginPath(); ctx.arc(ex, ey, 4, 0, Math.PI * 2); ctx.fill();
            }
          } else {
            ctx.fillStyle = '#e8a25c';
            ctx.beginPath(); ctx.arc(ex, ey, 3.2, 0, Math.PI * 2); ctx.fill();
          }
        }
      }
    } else {
      for (const e of this.entities) {
        if (!e.alive) continue;
        ctx.fillStyle = e.team === 'hider' ? '#9fe55f' : '#ff5a3c';
        ctx.beginPath(); ctx.arc(mx(e.pos.x), my(e.pos.z), e.team === 'hider' ? 3.2 : 4, 0, Math.PI * 2); ctx.fill();
      }
    }

    // player arrow
    const focus = p && p.alive ? p : this.spectateTarget;
    if (focus) {
      const px = mx(focus.pos.x), py = my(focus.pos.z);
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(Math.PI - focus.yaw);
      ctx.fillStyle = focus.team === 'hider' ? '#d7ff83' : '#ff7b5e';
      ctx.shadowColor = focus.team === 'hider' ? '#c9f16b' : '#ff5a3c';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.moveTo(0, -8);
      ctx.lineTo(5.5, 6);
      ctx.lineTo(0, 3.2);
      ctx.lineTo(-5.5, 6);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // map edge
    ctx.restore();
    ctx.strokeStyle = 'rgba(243,238,225,0.22)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = 'rgba(201,241,107,0.55)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, R - 1, -Math.PI * 0.62, -Math.PI * 0.38); ctx.stroke();
  }

  debugHuntNow() {
    this.startHunt();
  }

  debugSetRemaining(sec) {
    if (this.phase === 'hunt' || this.phase === 'hide') this.phaseTime = sec;
  }

  debugCaptureHiders(n) {
    let left = n;
    for (const e of this.entities) {
      if (left <= 0) break;
      if (e.team === 'hider' && e.alive) {
        const seeker = this.entities.find((s) => s.team === 'seeker' && s.alive);
        if (seeker) this.capture(seeker, e);
        left--;
      }
    }
  }

}
