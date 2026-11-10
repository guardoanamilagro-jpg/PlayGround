import * as THREE from 'three';
import { mergeGeometries } from '../vendor/BufferGeometryUtils.js';

/* ═══════════════════════════════════════════════════════════
   MAP CONFIG
   ═══════════════════════════════════════════════════════════ */
export const MAPS = {
  jungle: {
    id: 'jungle', name: 'SELVA TROPICAL', tag: 'HÚMEDO', size: '160 × 160 M',
    desc: 'Vegetación densa, copas altas y sombras profundas. El territorio del mono.',
    seed: 1937, heightAmp: 0.85, arena: 72,
    skyTop: 0x071f2a, skyBottom: 0x9bb37a, fog: 0x17382d, fogDensity: 0.0125,
    sunColor: 0xffd39a, sunIntensity: 2.5, sunDir: [-0.45, 0.72, 0.32],
    hemiSky: 0xa9d8b8, hemiGround: 0x13250f, hemiIntensity: 0.95,
    groundBase: '#33552f', groundColors: ['#263f25', '#466b34', '#587a38', '#1e3520', '#6b6a37'],
    trail: 0x493a26, trailWidth: 3.4,
    hiderSpawn: { x: 0, z: 44 }, seekerSpawn: { x: 0, z: -47 },
    accent: 0xc9f16b, skyGlow: 0xffd9a0
  },
  savanna: {
    id: 'savanna', name: 'SABANA AFRICANA', tag: 'ÁRIDO', size: '170 × 170 M',
    desc: 'Hierba dorada, acacias solitarias y kilómetros de campo abierto. Aquí no hay dónde esconderse.',
    seed: 7712, heightAmp: 1.35, arena: 75,
    skyTop: 0x2d6f9f, skyBottom: 0xf2c27d, fog: 0xd5a469, fogDensity: 0.0072,
    sunColor: 0xffe0a8, sunIntensity: 3.0, sunDir: [-0.5, 0.58, 0.45],
    hemiSky: 0xffe6b9, hemiGround: 0x6a4d24, hemiIntensity: 0.9,
    groundBase: '#b18a4b', groundColors: ['#c09b58', '#9d763e', '#d1ad68', '#88632f', '#a88647'],
    trail: 0xd0b078, trailWidth: 5.2,
    hiderSpawn: { x: 0, z: 46 }, seekerSpawn: { x: 0, z: -50 },
    accent: 0xe9b76b, skyGlow: 0xffe9b0
  },
  temple: {
    id: 'temple', name: 'RUINAS DEL TEMPLO', tag: 'ANTIGUO', size: '150 × 150 M',
    desc: 'Piedra cubierta de musgo, columnas rotas y un guardián que lleva siglos observando. El eco delata a los vivos.',
    seed: 4207, heightAmp: 0.45, arena: 66,
    skyTop: 0x121f2a, skyBottom: 0x9c9068, fog: 0x4b5341, fogDensity: 0.014,
    sunColor: 0xffd6a0, sunIntensity: 2.2, sunDir: [0.4, 0.52, 0.55],
    hemiSky: 0xb3bfa0, hemiGround: 0x1a1d12, hemiIntensity: 0.8,
    groundBase: '#414a33', groundColors: ['#515a3b', '#343d2a', '#686d49', '#2c3323', '#5c6443'],
    trail: 0x686a52, trailWidth: 3.8,
    hiderSpawn: { x: -2, z: 39 }, seekerSpawn: { x: 2, z: -44 },
    accent: 0xe9b76b, skyGlow: 0xffd7a0
  }
};

export const MAP_ORDER = ['jungle', 'savanna', 'temple'];

/* ═══════════════════════════════════════════════════════════
   UTILITIES
   ═══════════════════════════════════════════════════════════ */
export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function canvasTexture(draw, size = 256) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  draw(ctx, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

function groundTexture(cfg, rng) {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const ctx = c.getContext('2d');
  ctx.fillStyle = cfg.groundBase;
  ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 2200; i++) {
    const col = cfg.groundColors[(rng() * cfg.groundColors.length) | 0];
    ctx.globalAlpha = 0.05 + rng() * 0.2;
    ctx.fillStyle = col;
    const x = rng() * 512, y = rng() * 512;
    const r = 2 + rng() * 20;
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * (0.4 + rng() * 0.8), rng() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  // fine speckle / dry blades
  for (let i = 0; i < 900; i++) {
    const x = rng() * 512, y = rng() * 512;
    ctx.globalAlpha = 0.16 + rng() * 0.24;
    ctx.strokeStyle = cfg.groundColors[(rng() * cfg.groundColors.length) | 0];
    ctx.lineWidth = 0.6 + rng();
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (rng() - 0.5) * 6, y - 2 - rng() * 9); ctx.stroke();
  }
  if (cfg.id === 'temple') {
    ctx.globalAlpha = 0.22;
    ctx.strokeStyle = '#252b20';
    for (let i = 0; i < 26; i++) {
      ctx.lineWidth = 1 + rng() * 2;
      ctx.beginPath();
      let x = rng() * 512, y = rng() * 512;
      ctx.moveTo(x, y);
      for (let j = 0; j < 4; j++) { x += (rng() - 0.5) * 48; y += rng() * 32; ctx.lineTo(x, y); }
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(cfg.id === 'temple' ? 14 : 20, cfg.id === 'temple' ? 14 : 20);
  tex.anisotropy = 4;
  return tex;
}

function grassTexture(colorA, colorB) {
  return canvasTexture((ctx, s) => {
    ctx.clearRect(0, 0, s, s);
    for (let i = 0; i < 18; i++) {
      const x = 8 + Math.random() * (s - 16);
      ctx.strokeStyle = Math.random() > 0.55 ? colorA : colorB;
      ctx.globalAlpha = 0.6 + Math.random() * 0.4;
      ctx.lineWidth = 1.4 + Math.random() * 1.8;
      ctx.beginPath();
      ctx.moveTo(x, s);
      ctx.quadraticCurveTo(x + (Math.random() - 0.5) * 18, s * 0.55, x + (Math.random() - 0.5) * 30, 6 + Math.random() * 18);
      ctx.stroke();
    }
  }, 96);
}

function glowTexture(inner = 'rgba(255,245,220,1)', outer = 'rgba(255,230,180,0)') {
  return canvasTexture((ctx, s) => {
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, inner);
    g.addColorStop(0.25, inner);
    g.addColorStop(1, outer);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
  }, 128);
}

/* ═══════════════════════════════════════════════════════════
   WORLD
   ═══════════════════════════════════════════════════════════ */
export class World {
  constructor(scene, mapId) {
    this.scene = scene;
    this.mapId = mapId in MAPS ? mapId : 'jungle';
    this.cfg = MAPS[this.mapId];
    this.rng = mulberry32(this.cfg.seed);
    this.root = new THREE.Group();
    this.root.name = 'world-' + mapId;
    scene.add(this.root);
    this.colliders = [];
    this.bushes = [];
    this.trees = [];
    this.boxes = [];
    this.textures = [];
    this.particleSystems = [];
    this.torches = [];
    this.clouds = [];
    this.time = 0;
    this.arena = this.cfg.arena;
    this.hiderSpawn = { ...this.cfg.hiderSpawn };
    this.seekerSpawn = { ...this.cfg.seekerSpawn };
    this.hiderSpawn.y = 0;
    this.seekerSpawn.y = 0;

    this.scene.fog = new THREE.FogExp2(this.cfg.fog, this.cfg.fogDensity);
    this.scene.background = new THREE.Color(this.cfg.fog);
    this.build();
  }

  /* ── terrain ─────────────────────────────────────────── */
  heightAt(x, z) {
    const s = this.cfg.seed * 0.001;
    let h = Math.sin(x * 0.044 + s) * Math.cos(z * 0.051 + s * 2.1) * this.cfg.heightAmp;
    h += Math.sin(x * 0.109 + z * 0.073 + s * 3.7) * this.cfg.heightAmp * 0.32;
    h += Math.cos(z * 0.148 - x * 0.043 + s) * this.cfg.heightAmp * 0.16;
    const dh = Math.hypot(x - this.cfg.hiderSpawn.x, z - this.cfg.hiderSpawn.z);
    const ds = Math.hypot(x - this.cfg.seekerSpawn.x, z - this.cfg.seekerSpawn.z);
    const flat = Math.min(1, Math.min(dh, ds) / 16);
    h *= 0.35 + 0.65 * flat;
    const edge = Math.hypot(x, z);
    if (edge > 62) h += (edge - 62) * 0.045 * (this.mapId === 'savanna' ? 1.8 : 0.8);
    return h;
  }

  build() {
    this.buildSky();
    this.buildLights();
    this.buildGround();
    this.addTrail();
    this.addShrine();
    this.buildAmbientParticles();

    if (this.mapId === 'jungle') this.buildJungle();
    else if (this.mapId === 'savanna') this.buildSavanna();
    else this.buildTemple();

    this.buildDistant();
    this.buildSpawnMarkers();
    this.batchStaticGeometry();
    this.updateParticles(0.016);
  }

  /* Collapse the hundreds of low-poly props into a handful of vertex-coloured
     meshes. The arena is static, so this keeps draw calls low on software
     renderers and integrated GPUs without changing the silhouettes. */
  batchStaticGeometry() {
    const dynamic = new Set();
    for (const cloud of this.clouds) dynamic.add(cloud.g);
    for (const torch of this.torches) {
      dynamic.add(torch.flame);
      dynamic.add(torch.sprite);
    }
    if (this.hiderRing) dynamic.add(this.hiderRing);
    if (this.seekerRing) dynamic.add(this.seekerRing);

    const isDynamic = (object) => {
      let node = object;
      while (node && node !== this.root) {
        if (dynamic.has(node)) return true;
        node = node.parent;
      }
      return false;
    };

    const candidates = [];
    this.root.updateMatrixWorld(true);
    this.root.traverse((object) => {
      if (!object.isMesh || object.isInstancedMesh) return;
      const mat = object.material;
      if (!mat || Array.isArray(mat) || mat.isShaderMaterial || mat.isSpriteMaterial) return;
      if (!mat.isMeshStandardMaterial && !mat.isMeshBasicMaterial) return;
      if (mat.transparent || mat.map || mat.alphaTest > 0 || mat.vertexColors) return;
      if (mat.emissive && (mat.emissive.r > 0.01 || mat.emissive.g > 0.01 || mat.emissive.b > 0.01)) return;
      if (isDynamic(object)) return;
      let parent = object.parent;
      let protectedParent = null;
      while (parent && parent !== this.root) {
        if (parent.userData.protectedBatch) { protectedParent = parent; break; }
        parent = parent.parent;
      }
      candidates.push({ object, target: protectedParent || this.root });
    });
    if (candidates.length < 2) return;

    const buckets = new Map();
    const color = new THREE.Color();

    for (const candidate of candidates) {
      const object = candidate.object;
      const target = candidate.target;
      const mat = object.material;
      const key = [
        target.uuid,
        mat.isMeshBasicMaterial ? 'basic' : 'standard',
        mat.flatShading ? 'flat' : 'smooth',
        mat.side,
        (mat.roughness ?? 1).toFixed(2),
        (mat.metalness ?? 0).toFixed(2),
        object.castShadow ? 1 : 0,
        object.receiveShadow ? 1 : 0
      ].join('|');
      let bucket = buckets.get(key);
      if (!bucket) {
        bucket = { mat, target, geos: [], cast: false, receive: false };
        buckets.set(key, bucket);
      }
      bucket.cast ||= object.castShadow;
      bucket.receive ||= object.receiveShadow;

      let geo = object.geometry.clone();
      if (geo.index) {
        const flat = geo.toNonIndexed();
        geo.dispose();
        geo = flat;
      }
      geo.applyMatrix4(target === this.root ? object.matrixWorld : object.matrix);
      if (!geo.attributes.normal) geo.computeVertexNormals();
      for (const name of Object.keys(geo.attributes)) {
        if (name !== 'position' && name !== 'normal' && name !== 'color') geo.deleteAttribute(name);
      }
      const count = geo.attributes.position.count;
      const colors = new Float32Array(count * 3);
      color.copy(mat.color || color.set(0xffffff));
      for (let i = 0; i < count; i++) {
        colors[i * 3] = color.r;
        colors[i * 3 + 1] = color.g;
        colors[i * 3 + 2] = color.b;
      }
      geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      bucket.geos.push(geo);
      this._batchSourceResources = this._batchSourceResources || { geometries: new Set(), materials: new Set() };
      this._batchSourceResources.geometries.add(object.geometry);
      this._batchSourceResources.materials.add(mat);
      object.removeFromParent();
    }

    for (const bucket of buckets.values()) {
      if (!bucket.geos.length) continue;
      const geometry = mergeGeometries(bucket.geos, false);
      for (const geo of bucket.geos) geo.dispose();
      if (!geometry) continue;
      const source = bucket.mat;
      let material;
      if (source.isMeshBasicMaterial) {
        material = new THREE.MeshBasicMaterial({
          color: 0xffffff, vertexColors: true, side: source.side,
          transparent: false, depthWrite: true, fog: source.fog
        });
      } else {
        material = new THREE.MeshStandardMaterial({
          color: 0xffffff, vertexColors: true,
          roughness: source.roughness ?? 1,
          metalness: source.metalness ?? 0,
          flatShading: !!source.flatShading,
          side: source.side,
          transparent: false
        });
      }
      const mesh = new THREE.Mesh(geometry, material);
      mesh.name = 'batched-static';
      mesh.castShadow = bucket.cast;
      mesh.receiveShadow = bucket.receive;
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      bucket.target.add(mesh);
    }
  }

  buildSky() {
    const geo = new THREE.SphereGeometry(420, 32, 18);
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: {
        top: { value: new THREE.Color(this.cfg.skyTop) },
        bottom: { value: new THREE.Color(this.cfg.skyBottom) },
        glow: { value: new THREE.Color(this.cfg.skyGlow) },
        sunDir: { value: new THREE.Vector3(...this.cfg.sunDir).normalize() }
      },
      vertexShader: `varying vec3 vW; void main(){ vec4 w=modelMatrix*vec4(position,1.0); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
      fragmentShader: `
        uniform vec3 top; uniform vec3 bottom; uniform vec3 glow; uniform vec3 sunDir;
        varying vec3 vW;
        void main(){
          vec3 d=normalize(vW);
          float h=clamp(d.y*1.15,0.0,1.0);
          vec3 col=mix(bottom,top,pow(h,0.62));
          float sun=pow(max(dot(d,sunDir),0.0),110.0);
          float halo=pow(max(dot(d,sunDir),0.0),7.0);
          col=mix(col,glow,sun*0.9+halo*0.22);
          gl_FragColor=vec4(col,1.0);
        }`
    });
    this.sky = new THREE.Mesh(geo, mat);
    this.sky.frustumCulled = false;
    this.root.add(this.sky);

    // sun disc
    const tex = glowTexture('rgba(255,247,224,1)', 'rgba(255,220,150,0)');
    this.textures.push(tex);
    const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: 0xfff3d6, transparent: true, opacity: 0.85, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }));
    sun.position.copy(new THREE.Vector3(...this.cfg.sunDir).normalize().multiplyScalar(330));
    sun.scale.set(95, 95, 1);
    this.root.add(sun);

    // stylised clouds
    const cloudMat = new THREE.MeshBasicMaterial({ color: this.mapId === 'savanna' ? 0xfff0cf : 0xd7e4cf, transparent: true, opacity: 0.13, depthWrite: false, fog: false });
    for (let i = 0; i < 7; i++) {
      const g = new THREE.Group();
      const a = this.rng() * Math.PI * 2;
      const r = 95 + this.rng() * 150;
      g.position.set(Math.cos(a) * r, 45 + this.rng() * 32, Math.sin(a) * r);
      g.rotation.y = this.rng() * Math.PI;
      for (let j = 0; j < 4; j++) {
        const s = new THREE.Mesh(new THREE.SphereGeometry(9 + this.rng() * 12, 7, 5), cloudMat);
        s.position.set((j - 1.5) * 12, this.rng() * 3, this.rng() * 5);
        s.scale.y = 0.3;
        g.add(s);
      }
      this.clouds.push({ g, speed: 0.25 + this.rng() * 0.35 });
      this.root.add(g);
    }
  }

  buildLights() {
    const hemi = new THREE.HemisphereLight(this.cfg.hemiSky, this.cfg.hemiGround, this.cfg.hemiIntensity);
    this.root.add(hemi);
    const dir = new THREE.DirectionalLight(this.cfg.sunColor, this.cfg.sunIntensity);
    dir.position.set(...this.cfg.sunDir).normalize().multiplyScalar(85);
    dir.castShadow = true;
    dir.shadow.mapSize.set(2048, 2048);
    dir.shadow.camera.left = -64; dir.shadow.camera.right = 64;
    dir.shadow.camera.top = 64; dir.shadow.camera.bottom = -64;
    dir.shadow.camera.near = 1; dir.shadow.camera.far = 190;
    dir.shadow.bias = -0.0006;
    dir.shadow.normalBias = 0.035;
    this.root.add(dir);
    this.sun = dir;

    // subtle bounce from opposite side
    const fill = new THREE.DirectionalLight(this.cfg.hemiSky, 0.28);
    fill.position.set(-40, 25, -55);
    this.root.add(fill);
  }

  buildGround() {
    const size = 210, seg = 96;
    const geo = new THREE.PlaneGeometry(size, size, seg, seg);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const colors = [];
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const y = this.heightAt(x, z);
      pos.setY(i, y);
      const v = 0.78 + Math.sin(x * 0.42 + z * 0.31) * 0.07 + this.rng() * 0.06 + Math.min(0.14, y * 0.04);
      c.setRGB(v, v, v);
      colors.push(c.r, c.g, c.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const tex = groundTexture(this.cfg, this.rng);
    this.textures.push(tex);
    const mat = new THREE.MeshStandardMaterial({ map: tex, vertexColors: true, roughness: 1, metalness: 0, color: 0xffffff });
    const ground = new THREE.Mesh(geo, mat);
    ground.receiveShadow = true;
    ground.name = 'ground';
    this.root.add(ground);
    this.ground = ground;

    // subtle ground fog plane for depth
    const fogGeo = new THREE.CircleGeometry(95, 40);
    fogGeo.rotateX(-Math.PI / 2);
    const fogMat = new THREE.MeshBasicMaterial({ color: this.cfg.fog, transparent: true, opacity: 0.1, depthWrite: false });
    const fogPlane = new THREE.Mesh(fogGeo, fogMat);
    fogPlane.position.y = 0.3;
    this.root.add(fogPlane);
  }

  addTrail() {
    const pts = [];
    const n = 60;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const z = -56 + t * 112;
      const x = Math.sin(t * 8.2 + this.cfg.seed) * 7 + Math.sin(t * 3.1) * 3;
      pts.push(new THREE.Vector3(x, 0, z));
    }
    const verts = [], uvs = [], idx = [];
    const w = this.cfg.trailWidth / 2;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const prev = pts[Math.max(0, i - 1)], next = pts[Math.min(pts.length - 1, i + 1)];
      const dx = next.x - prev.x, dz = next.z - prev.z;
      const len = Math.hypot(dx, dz) || 1;
      const nx = -dz / len, nz = dx / len;
      const wob = 1 + Math.sin(i * 0.9) * 0.18;
      const p1 = { x: p.x + nx * w * wob, z: p.z + nz * w * wob };
      const p2 = { x: p.x - nx * w * wob, z: p.z - nz * w * wob };
      verts.push(p1.x, this.heightAt(p1.x, p1.z) + 0.035, p1.z);
      verts.push(p2.x, this.heightAt(p2.x, p2.z) + 0.035, p2.z);
      uvs.push(0, i / 6, 1, i / 6);
      if (i < pts.length - 1) {
        const a = i * 2;
        idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ color: this.cfg.trail, roughness: 1, metalness: 0, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    this.root.add(mesh);
  }

  addShrine() {
    const y = this.heightAt(0, 0);
    const ringMat = new THREE.MeshStandardMaterial({ color: this.mapId === 'temple' ? 0x8f8f70 : 0x5f6748, roughness: 0.9, emissive: this.cfg.accent, emissiveIntensity: 0.08 });
    const ring = new THREE.Mesh(new THREE.RingGeometry(2.1, 2.45, 32), ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = y + 0.045;
    this.root.add(ring);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(2.08, 32), new THREE.MeshStandardMaterial({ color: 0x23291d, roughness: 0.95, transparent: true, opacity: 0.5 }));
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = y + 0.04;
    this.root.add(disc);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const stone = new THREE.Mesh(new THREE.DodecahedronGeometry(0.24 + this.rng() * 0.16, 0), new THREE.MeshStandardMaterial({ color: 0x6a6d56, roughness: 1, flatShading: true }));
      stone.position.set(Math.cos(a) * 2.75, y + 0.16, Math.sin(a) * 2.75);
      stone.rotation.set(this.rng(), this.rng(), this.rng());
      stone.castShadow = true;
      this.root.add(stone);
    }
  }

  buildAmbientParticles() {
    const isTemple = this.mapId === 'temple';
    const isSavanna = this.mapId === 'savanna';
    const count = isTemple ? 130 : isSavanna ? 110 : 150;
    const color = isTemple ? 0xffc26e : isSavanna ? 0xe8c98e : 0x9acb6f;
    const tex = glowTexture(isTemple ? 'rgba(255,210,130,1)' : 'rgba(255,255,240,1)', 'rgba(255,255,255,0)');
    this.textures.push(tex);
    const positions = new Float32Array(count * 3);
    const data = [];
    for (let i = 0; i < count; i++) {
      const a = this.rng() * Math.PI * 2, r = 4 + this.rng() * 64;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      positions[i * 3] = x;
      positions[i * 3 + 1] = (isTemple ? 0.8 : 1.5) + this.rng() * (isTemple ? 6 : 9);
      positions[i * 3 + 2] = z;
      data.push({ seed: this.rng() * 10, speed: 0.2 + this.rng() * 0.5, baseY: positions[i * 3 + 1], x, z, r: 0.4 + this.rng() * 1.7 });
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color, size: isTemple ? 0.34 : (isSavanna ? 0.2 : 0.26), map: tex, transparent: true,
      opacity: isTemple ? 0.85 : 0.5, depthWrite: false, blending: isTemple ? THREE.AdditiveBlending : THREE.NormalBlending,
      sizeAttenuation: true, fog: true
    });
    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    this.root.add(points);
    this.particleSystems.push({ points, data, type: isTemple ? 'firefly' : isSavanna ? 'dust' : 'leaf' });
  }

  /* ── placement helpers ───────────────────────────────── */
  randomSpot(minR, maxR) {
    const a = this.rng() * Math.PI * 2;
    const r = minR + Math.sqrt(this.rng()) * (maxR - minR);
    return { x: Math.cos(a) * r, z: Math.sin(a) * r };
  }

  isNearSpawn(x, z, pad = 8) {
    return Math.hypot(x - this.cfg.hiderSpawn.x, z - this.cfg.hiderSpawn.z) < pad ||
      Math.hypot(x - this.cfg.seekerSpawn.x, z - this.cfg.seekerSpawn.z) < pad;
  }

  isFree(x, z, radius, spacing = 0) {
    if (Math.hypot(x, z) < 4.5) return false;
    if (this.isNearSpawn(x, z, 7 + spacing)) return false;
    for (const c of this.colliders) {
      if (Math.hypot(x - c.x, z - c.z) < c.r + radius + spacing) return false;
    }
    return true;
  }

  putCircle(x, z, r) { this.colliders.push({ type: 'circle', x, z, r }); }
  putBox(x, z, hw, hd) {
    const b = { type: 'box', x, z, hw, hd };
    this.colliders.push(b);
    this.boxes.push(b);
  }

  addBush(x, z, scale = 1, palette) {
    const y = this.heightAt(x, z);
    const g = new THREE.Group();
    const colors = palette || (this.mapId === 'savanna' ? [0x6e713a, 0x7c7d3f, 0x5b5e2d] : this.mapId === 'temple' ? [0x3e5230, 0x4b6138, 0x35472a] : [0x2c5c2f, 0x376b33, 0x244c28, 0x43803c]);
    const lobes = 3 + ((this.rng() * 3) | 0);
    for (let i = 0; i < lobes; i++) {
      const mat = new THREE.MeshStandardMaterial({ color: colors[(this.rng() * colors.length) | 0], roughness: 0.95, flatShading: true });
      const s = 0.75 + this.rng() * 0.65;
      const lobe = new THREE.Mesh(new THREE.IcosahedronGeometry(1.15 * scale * s, 0), mat);
      lobe.position.set((this.rng() - 0.5) * 1.8 * scale, 0.65 * scale * s + this.rng() * 0.4, (this.rng() - 0.5) * 1.8 * scale);
      lobe.scale.set(1, 0.8 + this.rng() * 0.4, 1);
      lobe.rotation.set(this.rng(), this.rng(), this.rng());
      lobe.castShadow = true;
      g.add(lobe);
    }
    g.position.set(x, y, z);
    this.root.add(g);
    this.bushes.push({ x, z, r: 1.55 * scale, y });
    return g;
  }

  addTree(x, z, opts = {}) {
    const y = this.heightAt(x, z);
    const type = opts.type || 'jungle';
    if (type === 'acacia') return this.addAcacia(x, z, opts);
    if (type === 'palm') return this.addPalm(x, z, opts);

    const scale = opts.scale ?? (0.85 + this.rng() * 0.55);
    const h = (7.2 + this.rng() * 4.2) * scale;
    const g = new THREE.Group();
    g.position.set(x, y, z);
    const bark = new THREE.MeshStandardMaterial({ color: this.mapId === 'temple' ? 0x4b4230 : 0x55402a, roughness: 1, flatShading: true });
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.42 * scale, 0.72 * scale, h, 7), bark);
    trunk.position.y = h / 2;
    trunk.castShadow = true;
    g.add(trunk);

    // roots / buttresses
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + this.rng();
      const root = new THREE.Mesh(new THREE.CylinderGeometry(0.1 * scale, 0.26 * scale, 2.4 * scale, 5), bark);
      root.position.set(Math.cos(a) * 0.65 * scale, 0.55 * scale, Math.sin(a) * 0.65 * scale);
      root.rotation.z = Math.cos(a) * 0.48;
      root.rotation.x = -Math.sin(a) * 0.48;
      root.castShadow = true;
      g.add(root);
    }

    const canopyColors = this.mapId === 'temple' ? [0x354b2b, 0x45603a, 0x2a3d24] : [0x23502b, 0x2f6635, 0x1b4023, 0x3c7a3d];
    const crown = new THREE.Group();
    crown.position.y = h;
    const lobes = 3 + ((this.rng() * 2) | 0);
    for (let i = 0; i < lobes; i++) {
      const mat = new THREE.MeshStandardMaterial({ color: canopyColors[(this.rng() * canopyColors.length) | 0], roughness: 1, flatShading: true });
      const r = (2.1 + this.rng() * 1.7) * scale;
      const lobe = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), mat);
      lobe.position.set((this.rng() - 0.5) * 3.2 * scale, (this.rng() - 0.2) * 1.5 * scale, (this.rng() - 0.5) * 3.2 * scale);
      lobe.scale.set(1.05, 0.66, 1.05);
      lobe.rotation.set(this.rng() * 2, this.rng() * 2, this.rng() * 2);
      lobe.castShadow = true;
      crown.add(lobe);
    }
    g.add(crown);
    crown.userData.protectedBatch = true;

    // branch where the monkey can perch
    const branchY = h * 0.68;
    const angle = this.rng() * Math.PI * 2;
    const branchLen = 2.2 * scale;
    const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.11 * scale, 0.16 * scale, branchLen, 5), bark);
    branch.position.set(Math.cos(angle) * branchLen * 0.5, branchY, Math.sin(angle) * branchLen * 0.5);
    branch.rotation.z = Math.PI / 2;
    branch.rotation.y = -angle;
    branch.castShadow = true;
    g.add(branch);

    if (this.mapId === 'jungle' && this.rng() > 0.55) {
      const vineCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(Math.cos(angle) * branchLen, branchY, Math.sin(angle) * branchLen),
        new THREE.Vector3(Math.cos(angle) * (branchLen + 0.4), branchY - 2.2, Math.sin(angle) * (branchLen + 0.4)),
        new THREE.Vector3(Math.cos(angle) * (branchLen - 0.2), 0.4, Math.sin(angle) * (branchLen - 0.2))
      ]);
      const vine = new THREE.Mesh(new THREE.TubeGeometry(vineCurve, 8, 0.035, 4, false), new THREE.MeshStandardMaterial({ color: 0x3f6a2d, roughness: 1 }));
      g.add(vine);
    }

    this.root.add(g);
    this.putCircle(x, z, 0.62 * scale);
    const tree = {
      x, z, y, h, scale, mesh: g, crown, climbable: opts.climbable !== false,
      climbY: y + branchY, branchAngle: angle, branchLen,
      radius: 0.62 * scale
    };
    this.trees.push(tree);
    return tree;
  }

  addPalm(x, z, opts = {}) {
    const y = this.heightAt(x, z);
    const scale = opts.scale ?? (0.8 + this.rng() * 0.35);
    const h = (7 + this.rng() * 2.2) * scale;
    const g = new THREE.Group();
    g.position.set(x, y, z);
    const bark = new THREE.MeshStandardMaterial({ color: 0x6a5236, roughness: 1, flatShading: true });
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.28 * scale, 0.46 * scale, h, 6), bark);
    trunk.position.y = h / 2;
    trunk.rotation.z = 0.06;
    trunk.castShadow = true;
    g.add(trunk);
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x2f6d34, roughness: 0.9, side: THREE.DoubleSide, flatShading: true });
    const palmCrown = new THREE.Mesh(this.palmCrownGeometry(), leafMat);
    palmCrown.position.set(0.4, h - 0.1, 0);
    palmCrown.castShadow = true;
    const crown = new THREE.Group();
    crown.add(palmCrown);
    crown.userData.protectedBatch = true;
    g.add(crown);
    this.root.add(g);
    this.putCircle(x, z, 0.45 * scale);
    const tree = { x, z, y, h, scale, mesh: g, crown, climbable: true, climbY: y + h * 0.72, branchAngle: 0, branchLen: 1.6 * scale, radius: 0.45 * scale };
    this.trees.push(tree);
    return tree;
  }

  palmCrownGeometry() {
    if (this._palmGeo) return this._palmGeo;
    const parts = [];
    for (let i = 0; i < 8; i++) {
      const g = new THREE.ConeGeometry(0.5, 3.4, 4);
      g.translate(0, 1.7, 0);
      g.rotateZ(-Math.PI / 2 - 0.18);
      g.rotateY((i / 8) * Math.PI * 2);
      g.scale(1, 1, 0.24);
      parts.push(g);
    }
    const center = new THREE.ConeGeometry(0.5, 1.1, 5);
    center.translate(0, 0.55, 0);
    parts.push(center);
    this._palmGeo = mergeGeometries(parts, false);
    return this._palmGeo;
  }

  addAcacia(x, z, opts = {}) {
    const y = this.heightAt(x, z);
    const scale = opts.scale ?? (0.9 + this.rng() * 0.4);
    const h = (4.3 + this.rng() * 1.8) * scale;
    const g = new THREE.Group();
    g.position.set(x, y, z);
    const bark = new THREE.MeshStandardMaterial({ color: 0x5c472e, roughness: 1, flatShading: true });
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.24 * scale, 0.42 * scale, h, 6), bark);
    trunk.position.y = h / 2;
    trunk.castShadow = true;
    g.add(trunk);
    const bcount = 3;
    for (let i = 0; i < bcount; i++) {
      const a = (i / bcount) * Math.PI * 2 + this.rng() * 0.5;
      const br = new THREE.Mesh(new THREE.CylinderGeometry(0.09 * scale, 0.19 * scale, 2.4 * scale, 5), bark);
      br.position.set(Math.cos(a) * 1.0 * scale, h - 0.3, Math.sin(a) * 1.0 * scale);
      br.rotation.z = Math.cos(a) * 0.8;
      br.rotation.x = -Math.sin(a) * 0.8;
      br.castShadow = true;
      g.add(br);
    }
    const canopyMat = new THREE.MeshStandardMaterial({ color: 0x4c6431, roughness: 1, flatShading: true });
    const canopyMat2 = new THREE.MeshStandardMaterial({ color: 0x3c5228, roughness: 1, flatShading: true });
    const crown = new THREE.Group();
    crown.userData.protectedBatch = true;
    for (let i = 0; i < 3; i++) {
      const pad = new THREE.Mesh(new THREE.IcosahedronGeometry((2.5 + this.rng() * 1.2) * scale, 0), i % 2 ? canopyMat : canopyMat2);
      pad.position.set((this.rng() - 0.5) * 3.5 * scale, h + 0.35 + this.rng() * 0.5, (this.rng() - 0.5) * 3.5 * scale);
      pad.scale.set(1.35, 0.2, 1.35);
      pad.castShadow = true;
      crown.add(pad);
    }
    g.add(crown);
    this.root.add(g);
    this.putCircle(x, z, 0.5 * scale);
    const tree = { x, z, y, h, scale, mesh: g, crown, climbable: true, climbY: y + h * 0.82, branchAngle: 0, branchLen: 2.1 * scale, radius: 0.5 * scale };
    this.trees.push(tree);
    return tree;
  }

  addRock(x, z, scale = 1, collide = true) {
    const y = this.heightAt(x, z);
    const shade = this.mapId === 'temple' ? [0x6b6f5c, 0x5b604f, 0x777b64] : this.mapId === 'savanna' ? [0x8a795d, 0x75664f, 0x9c8a6b] : [0x5b6252, 0x4b5347, 0x6b7260];
    const mat = new THREE.MeshStandardMaterial({ color: shade[(this.rng() * shade.length) | 0], roughness: 1, flatShading: true });
    const geo = new THREE.DodecahedronGeometry((0.7 + this.rng() * 0.6) * scale, 0);
    const rock = new THREE.Mesh(geo, mat);
    rock.position.set(x, y + 0.22 * scale, z);
    rock.rotation.set(this.rng() * 3, this.rng() * 3, this.rng() * 3);
    rock.scale.set(1, 0.65 + this.rng() * 0.35, 1);
    rock.castShadow = true;
    rock.receiveShadow = true;
    this.root.add(rock);
    if (collide && scale > 0.9) this.putCircle(x, z, 0.7 * scale);
    return rock;
  }

  addFern(x, z, scale = 1) {
    if (!this._fernGeo) {
      const parts = [];
      for (let i = 0; i < 7; i++) {
        const g = new THREE.ConeGeometry(0.17, 1.5, 4);
        g.translate(0, 0.7, 0);
        g.rotateX(0.85);
        g.rotateY((i / 7) * Math.PI * 2 + this.rng());
        g.scale(1, 1, 0.35);
        parts.push(g);
      }
      this._fernGeo = mergeGeometries(parts, false);
    }
    const mat = new THREE.MeshStandardMaterial({ color: this.mapId === 'temple' ? 0x46603b : 0x3d783b, roughness: 0.95, side: THREE.DoubleSide, flatShading: true });
    const fern = new THREE.Mesh(this._fernGeo, mat);
    fern.position.set(x, this.heightAt(x, z), z);
    fern.scale.setScalar(scale * (0.8 + this.rng() * 0.7));
    fern.rotation.y = this.rng() * 6;
    fern.castShadow = true;
    this.root.add(fern);
  }

  addGrassField(count, palette, size = 1) {
    const tex = grassTexture(palette[0], palette[1]);
    this.textures.push(tex);
    const geo1 = new THREE.PlaneGeometry(0.9, 1.5);
    geo1.translate(0, 0.75, 0);
    const geo2 = geo1.clone();
    geo2.rotateY(Math.PI / 2);
    const merged = mergeGeometries([geo1, geo2], false);
    const mat = new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.95, color: 0xffffff });
    const mesh = new THREE.InstancedMesh(merged, mat, count);
    mesh.receiveShadow = false;
    mesh.castShadow = false;
    const dummy = new THREE.Object3D();
    const col = new THREE.Color();
    for (let i = 0; i < count; i++) {
      let spot = this.randomSpot(2, 70);
      let guard = 0;
      while (this.isNearSpawn(spot.x, spot.z, 7) && guard++ < 12) spot = this.randomSpot(2, 70);
      const x = spot.x, z = spot.z;
      const s = (0.7 + this.rng() * 1.1) * size;
      dummy.position.set(x, this.heightAt(x, z), z);
      dummy.rotation.y = this.rng() * Math.PI;
      dummy.scale.set(s, s * (0.7 + this.rng() * 0.8), s);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      col.setHSL(0.18 + this.rng() * 0.1, 0.2 + this.rng() * 0.2, 0.5 + this.rng() * 0.16);
      mesh.setColorAt(i, col);
    }
    mesh.instanceMatrix.needsUpdate = true;
    this.root.add(mesh);
    return mesh;
  }

  buildJungle() {
    // trailside mega foliage
    let trees = 0, guard = 0;
    while (trees < 54 && guard++ < 900) {
      const p = this.randomSpot(7, 68);
      if (!this.isFree(p.x, p.z, 1, 4.5)) continue;
      if (Math.hypot(p.x, p.z) < 7) continue;
      const type = this.rng() > 0.84 ? 'palm' : 'jungle';
      this.addTree(p.x, p.z, { type, scale: 0.85 + this.rng() * 0.6 });
      trees++;
    }
    // bushes — main hiding spots
    guard = 0; let bushes = 0;
    while (bushes < 34 && guard++ < 600) {
      const p = this.randomSpot(6, 67);
      if (!this.isFree(p.x, p.z, 1.4, 1.8)) continue;
      if (this.bushes.some(b => Math.hypot(b.x - p.x, b.z - p.z) < 4)) continue;
      this.addBush(p.x, p.z, 0.9 + this.rng() * 0.7);
      bushes++;
    }
    // ferns, rocks, logs
    for (let i = 0; i < 78; i++) {
      const p = this.randomSpot(3, 69);
      this.addFern(p.x, p.z, 0.7 + this.rng() * 0.7);
    }
    for (let i = 0; i < 20; i++) {
      const p = this.randomSpot(8, 68);
      if (this.isNearSpawn(p.x, p.z, 10)) continue;
      this.addRock(p.x, p.z, 0.7 + this.rng() * 1.2);
    }
    // fallen giant log
    for (let k = 0; k < 2; k++) {
      const p = this.randomSpot(14, 52);
      const a = this.rng() * Math.PI;
      const len = 9 + this.rng() * 6;
      const log = new THREE.Group();
      const logMat = new THREE.MeshStandardMaterial({ color: 0x4a3a26, roughness: 1, flatShading: true });
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.85, len, 8), logMat);
      trunk.rotation.z = Math.PI / 2;
      trunk.castShadow = true;
      log.add(trunk);
      for (let i = 0; i < 3; i++) {
        const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5 + this.rng() * 0.4, 0), new THREE.MeshStandardMaterial({ color: 0x3b6b32, roughness: 1, flatShading: true }));
        m.position.set((this.rng() - 0.5) * len * 0.8, 0.55, (this.rng() - 0.5) * 1.2);
        log.add(m);
      }
      log.position.set(p.x, this.heightAt(p.x, p.z) + 0.6, p.z);
      log.rotation.y = a;
      this.root.add(log);
      for (let t = -0.4; t <= 0.4; t += 0.2) {
        this.putCircle(p.x + Math.cos(a) * t * len, p.z + Math.sin(a) * t * len, 0.85);
      }
    }
    // ground cover
    this.addGrassField(850, ['#3d7838', '#5e9a45'], 0.8);
    this.addGrassField(250, ['#6b8f3d', '#8ab54d'], 1.05);
  }

  buildSavanna() {
    let trees = 0, guard = 0;
    while (trees < 20 && guard++ < 400) {
      const p = this.randomSpot(10, 70);
      if (!this.isFree(p.x, p.z, 2, 8)) continue;
      this.addTree(p.x, p.z, { type: 'acacia', scale: 0.9 + this.rng() * 0.55 });
      trees++;
    }
    guard = 0; let bushes = 0;
    while (bushes < 22 && guard++ < 400) {
      const p = this.randomSpot(8, 69);
      if (!this.isFree(p.x, p.z, 1.2, 3)) continue;
      if (this.bushes.some(b => Math.hypot(b.x - p.x, b.z - p.z) < 5)) continue;
      this.addBush(p.x, p.z, 0.75 + this.rng() * 0.55, [0x77753d, 0x67682f, 0x8a8148]);
      bushes++;
    }
    for (let i = 0; i < 30; i++) {
      const p = this.randomSpot(7, 71);
      if (this.isNearSpawn(p.x, p.z, 9)) continue;
      this.addRock(p.x, p.z, 0.65 + this.rng() * 1.5);
    }
    // termite mounds
    for (let i = 0; i < 7; i++) {
      const p = this.randomSpot(12, 62);
      if (this.isNearSpawn(p.x, p.z, 12)) continue;
      const y = this.heightAt(p.x, p.z);
      const mat = new THREE.MeshStandardMaterial({ color: 0x9a7746, roughness: 1, flatShading: true });
      const h = 2 + this.rng() * 2.4;
      const mound = new THREE.Mesh(new THREE.ConeGeometry(0.9 + this.rng() * 0.5, h, 7), mat);
      mound.position.set(p.x, y + h / 2, p.z);
      mound.rotation.y = this.rng() * 3;
      mound.castShadow = true;
      this.root.add(mound);
      this.putCircle(p.x, p.z, 0.9);
    }
    // dry grass sea
    this.addGrassField(1350, ['#c6a15b', '#e0c07c'], 0.72);
    this.addGrassField(420, ['#a87f42', '#c19a55'], 0.95);
    this.addGrassField(110, ['#7f6a35', '#9d8346'], 1.15);
    // sun-bleached bones
    for (let i = 0; i < 3; i++) {
      const p = this.randomSpot(18, 58);
      const y = this.heightAt(p.x, p.z);
      const boneMat = new THREE.MeshStandardMaterial({ color: 0xd9d1b8, roughness: 0.9, flatShading: true });
      for (let r = 0; r < 4; r++) {
        const rib = new THREE.Mesh(new THREE.TorusGeometry(0.5 + r * 0.18, 0.035, 4, 8, Math.PI), boneMat);
        rib.position.set(p.x + r * 0.45, y + 0.1, p.z);
        rib.rotation.x = -0.1;
        this.root.add(rib);
      }
    }
  }

  buildTemple() {
    const stoneDark = new THREE.MeshStandardMaterial({ color: 0x5f6351, roughness: 1, flatShading: true });
    const stone = new THREE.MeshStandardMaterial({ color: 0x7a7d67, roughness: 1, flatShading: true });
    const stoneMoss = new THREE.MeshStandardMaterial({ color: 0x59653f, roughness: 1, flatShading: true });
    const y0 = this.heightAt(0, 0);

    // central plaza
    const plaza = new THREE.Mesh(new THREE.CircleGeometry(13, 40), new THREE.MeshStandardMaterial({ color: 0x6b6d59, roughness: 1 }));
    plaza.rotation.x = -Math.PI / 2;
    plaza.position.y = y0 + 0.06;
    plaza.receiveShadow = true;
    this.root.add(plaza);
    const plazaRing = new THREE.Mesh(new THREE.RingGeometry(12.4, 13, 40), new THREE.MeshStandardMaterial({ color: 0x444a37, roughness: 1 }));
    plazaRing.rotation.x = -Math.PI / 2;
    plazaRing.position.y = y0 + 0.07;
    this.root.add(plazaRing);

    // broken pillars in two rings
    const pillarPositions = [];
    for (let ring = 0; ring < 2; ring++) {
      const radius = ring === 0 ? 13.5 : 22;
      const count = ring === 0 ? 10 : 14;
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2 + (ring ? 0.17 : 0);
        const x = Math.cos(a) * radius + (this.rng() - 0.5) * 1.2;
        const z = Math.sin(a) * radius + (this.rng() - 0.5) * 1.2;
        if (Math.hypot(x, z) < 10) continue;
        const h = this.rng() > 0.42 ? 3.4 + this.rng() * 3.8 : 0.8 + this.rng() * 1.6;
        this.addPillar(x, z, h, stone, stoneDark, stoneMoss);
        pillarPositions.push({ x, z, h });
      }
    }

    // ruined walls
    const walls = [
      [-30, 20, 12, 4.2, 1.1, 0], [-30, 20, 3, 4.2, 1.1, Math.PI / 2],
      [31, 24, 9, 3.4, 1.0, 0], [24, -28, 14, 5, 1.0, Math.PI / 2],
      [-25, -26, 10, 3, 1.2, 0.4], [8, 38, 8, 2.6, 0.9, 0],
      [38, -6, 7, 4.5, 1.1, 0], [-38, 4, 10, 3.2, 1.0, Math.PI / 2]
    ];
    for (const [x, z, w, h, d, rot] of walls) {
      this.addWall(x, z, w, h, d, rot, stone, stoneMoss);
    }

    // guardian statue
    this.addGuardian(-3, -20, stone, stoneDark, stoneMoss);

    // jungle reclaiming the stones
    let trees = 0, guard = 0;
    while (trees < 28 && guard++ < 500) {
      const p = this.randomSpot(16, 64);
      if (!this.isFree(p.x, p.z, 2, 4.5)) continue;
      this.addTree(p.x, p.z, { type: this.rng() > 0.8 ? 'palm' : 'jungle', scale: 0.75 + this.rng() * 0.4 });
      trees++;
    }
    guard = 0; let bushes = 0;
    while (bushes < 26 && guard++ < 500) {
      const p = this.randomSpot(10, 63);
      if (!this.isFree(p.x, p.z, 1.3, 2)) continue;
      if (this.bushes.some(b => Math.hypot(b.x - p.x, b.z - p.z) < 4.5)) continue;
      this.addBush(p.x, p.z, 0.8 + this.rng() * 0.55);
      bushes++;
    }
    for (let i = 0; i < 66; i++) {
      const p = this.randomSpot(4, 65);
      this.addFern(p.x, p.z, 0.65 + this.rng() * 0.6);
    }
    for (let i = 0; i < 18; i++) {
      const p = this.randomSpot(9, 64);
      if (this.isNearSpawn(p.x, p.z, 10)) continue;
      this.addRock(p.x, p.z, 0.7 + this.rng() * 1.1);
    }

    // torches
    for (const [x, z] of [[8, 8], [-8, 8], [8, -8], [-8, -8]]) {
      this.addTorch(x, z);
    }

    this.addGrassField(550, ['#566636', '#748247'], 0.78);
    this.addGrassField(180, ['#6c7a3c', '#8b9a54'], 1.0);
  }

  addPillar(x, z, h, stone, stoneDark, stoneMoss) {
    const y = this.heightAt(x, z);
    const g = new THREE.Group();
    g.position.set(x, y, z);
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.45, 1.9), stoneDark);
    base.position.y = 0.22;
    base.castShadow = true; base.receiveShadow = true;
    g.add(base);
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.72, h, 8), stone);
    shaft.position.y = h / 2 + 0.4;
    shaft.castShadow = true; shaft.receiveShadow = true;
    g.add(shaft);
    if (h > 2.5) {
      const cap = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.35, 1.7), stoneDark);
      cap.position.y = h + 0.55;
      cap.rotation.y = this.rng() * 0.3;
      cap.castShadow = true;
      g.add(cap);
      // moss cap
      const moss = new THREE.Mesh(new THREE.IcosahedronGeometry(0.8, 0), stoneMoss);
      moss.position.set((this.rng() - 0.5) * 0.6, h + 0.8, (this.rng() - 0.5) * 0.6);
      moss.scale.y = 0.22;
      g.add(moss);
    } else {
      // broken top
      const broken = new THREE.Mesh(new THREE.CylinderGeometry(0.56, 0.68, 0.5, 7), stone);
      broken.position.y = h + 0.55;
      broken.rotation.z = 0.1;
      g.add(broken);
    }
    // vines
    if (this.rng() > 0.5) {
      const a = this.rng() * Math.PI * 2;
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(Math.cos(a) * 0.58, h + 0.4, Math.sin(a) * 0.58),
        new THREE.Vector3(Math.cos(a) * 0.8, h * 0.55, Math.sin(a) * 0.8),
        new THREE.Vector3(Math.cos(a) * 0.6, 0.1, Math.sin(a) * 0.6)
      ]);
      const vine = new THREE.Mesh(new THREE.TubeGeometry(curve, 9, 0.04, 4, false), new THREE.MeshStandardMaterial({ color: 0x445f31, roughness: 1 }));
      g.add(vine);
    }
    this.root.add(g);
    this.putCircle(x, z, 0.85);
  }

  addWall(x, z, w, h, d, rot, stone, stoneMoss) {
    const y = this.heightAt(x, z);
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = rot;
    const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), stone);
    wall.position.y = h / 2;
    wall.castShadow = true; wall.receiveShadow = true;
    g.add(wall);
    // bricks / broken top
    const bricks = Math.max(2, Math.round(w / 1.4));
    for (let i = 0; i < bricks; i++) {
      if (this.rng() > 0.55) continue;
      const bw = w / bricks;
      const brick = new THREE.Mesh(new THREE.BoxGeometry(bw * 0.92, 0.28 + this.rng() * 0.3, d * 0.96), stoneMoss);
      brick.position.set(-w / 2 + bw * (i + 0.5), h - (0.1 + this.rng() * 0.25), 0);
      brick.rotation.y = (this.rng() - 0.5) * 0.09;
      brick.castShadow = true;
      g.add(brick);
    }
    // moss patches
    for (let i = 0; i < 3; i++) {
      const moss = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5 + this.rng() * 0.6, 0), stoneMoss);
      moss.position.set((this.rng() - 0.5) * w * 0.8, this.rng() * h * 0.8 + 0.3, (this.rng() - 0.5) * d);
      moss.scale.set(1.2, 0.18, 0.6);
      g.add(moss);
    }
    this.root.add(g);
    const swap = Math.abs(Math.sin(rot)) > 0.5;
    const hw = (swap ? d : w) / 2;
    const hd = (swap ? w : d) / 2;
    this.putBox(x, z, hw, hd);
  }

  addGuardian(x, z, stone, stoneDark, stoneMoss) {
    const y = this.heightAt(x, z);
    const g = new THREE.Group();
    g.position.set(x, y, z);
    const pedestal = new THREE.Mesh(new THREE.BoxGeometry(6, 1.2, 5), stoneDark);
    pedestal.position.y = 0.6; pedestal.castShadow = true; pedestal.receiveShadow = true; g.add(pedestal);
    const body = new THREE.Mesh(new THREE.BoxGeometry(3.6, 4.2, 3), stone);
    body.position.y = 3.2; body.rotation.x = -0.08; body.castShadow = true; g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(1.55, 8, 6), stone);
    head.position.set(0, 6.1, 0.2); head.scale.set(1, 0.92, 0.95); head.castShadow = true; g.add(head);
    const snout = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.0, 1.4), stoneDark);
    snout.position.set(0, 5.65, 1.15); snout.castShadow = true; g.add(snout);
    for (const sx of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.2, 5), stoneDark);
      ear.position.set(sx * 1.2, 7.2, 0); ear.rotation.z = sx * 0.25; g.add(ear);
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.18, 6, 5), new THREE.MeshStandardMaterial({ color: 0xffb347, emissive: 0xff7a1a, emissiveIntensity: 2.4 }));
      eye.position.set(sx * 0.55, 6.32, 1.4); g.add(eye);
    }
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.65, 0.5, 8), stoneMoss);
    crown.position.y = 7.2; g.add(crown);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.8, 4), stoneMoss);
      spike.position.set(Math.cos(a) * 1.2, 7.8, Math.sin(a) * 1.2);
      g.add(spike);
    }
    // moss over the shoulders
    for (let i = 0; i < 4; i++) {
      const moss = new THREE.Mesh(new THREE.IcosahedronGeometry(0.6 + this.rng() * 0.4, 0), stoneMoss);
      moss.position.set((this.rng() - 0.5) * 3, 4.8 + this.rng(), (this.rng() - 0.5) * 2.5);
      moss.scale.y = 0.25; g.add(moss);
    }
    this.root.add(g);
    this.putBox(x, z, 3, 2.5);
    // little altar in front
    const altar = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.8, 1.4), stoneDark);
    altar.position.set(x, y + 0.4, z + 4.6);
    altar.castShadow = true; this.root.add(altar);
    this.putBox(x, z + 4.6, 1.2, 0.7);
  }

  addTorch(x, z) {
    const y = this.heightAt(x, z);
    const g = new THREE.Group();
    g.position.set(x, y, z);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 2.6, 6), new THREE.MeshStandardMaterial({ color: 0x4a3a26, roughness: 1 }));
    post.position.y = 1.3; post.castShadow = true; g.add(post);
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.2, 0.3, 7), new THREE.MeshStandardMaterial({ color: 0x393d31, roughness: 0.8, metalness: 0.2 }));
    bowl.position.y = 2.6; g.add(bowl);
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.8, 6), new THREE.MeshBasicMaterial({ color: 0xffb05a, transparent: true, opacity: 0.9 }));
    flame.position.y = 3.05; g.add(flame);
    const tex = glowTexture('rgba(255,190,90,0.95)', 'rgba(255,120,30,0)');
    this.textures.push(tex);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: 0xffb060, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending }));
    sprite.position.y = 3.05; sprite.scale.set(2.8, 2.8, 1); g.add(sprite);
    const light = new THREE.PointLight(0xff8d3d, 16, 15, 2);
    light.position.y = 3.2; g.add(light);
    this.torches.push({ light, flame, sprite, seed: this.rng() * 10 });
    this.root.add(g);
    this.putCircle(x, z, 0.24);
  }

  buildDistant() {
    const isSavanna = this.mapId === 'savanna';
    const isTemple = this.mapId === 'temple';
    if (isSavanna) {
      const mat = new THREE.MeshStandardMaterial({ color: 0x8f7550, roughness: 1, flatShading: true });
      for (let i = 0; i < 15; i++) {
        const a = (i / 15) * Math.PI * 2 + this.rng() * 0.2;
        const r = 105 + this.rng() * 55;
        const h = 20 + this.rng() * 35;
        const m = new THREE.Mesh(new THREE.ConeGeometry(18 + this.rng() * 20, h, 5), mat);
        m.position.set(Math.cos(a) * r, h / 2 - 4, Math.sin(a) * r);
        m.rotation.y = this.rng() * 3;
        this.root.add(m);
      }
    } else if (isTemple) {
      const mat = new THREE.MeshStandardMaterial({ color: 0x39402f, roughness: 1, flatShading: true });
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2 + this.rng();
        const r = 92 + this.rng() * 55;
        const h = 10 + this.rng() * 28;
        const m = new THREE.Mesh(new THREE.BoxGeometry(4 + this.rng() * 8, h, 4 + this.rng() * 8), mat);
        m.position.set(Math.cos(a) * r, h / 2 - 3, Math.sin(a) * r);
        m.rotation.y = this.rng() * 3;
        this.root.add(m);
      }
    } else {
      const mat = new THREE.MeshStandardMaterial({ color: 0x173222, roughness: 1, flatShading: true });
      const geo = new THREE.IcosahedronGeometry(1, 0);
      const inst = new THREE.InstancedMesh(geo, mat, 120);
      const dummy = new THREE.Object3D();
      for (let i = 0; i < 120; i++) {
        const a = (i / 120) * Math.PI * 2 + this.rng() * 0.08;
        const r = 82 + this.rng() * 60;
        const s = 5 + this.rng() * 10;
        dummy.position.set(Math.cos(a) * r, 8 + this.rng() * 18, Math.sin(a) * r);
        dummy.scale.set(s, s * (0.6 + this.rng() * 0.5), s);
        dummy.rotation.y = this.rng() * 3;
        dummy.updateMatrix();
        inst.setMatrixAt(i, dummy.matrix);
      }
      inst.instanceMatrix.needsUpdate = true;
      this.root.add(inst);
      // silhouette trunks
      const trunkMat = new THREE.MeshStandardMaterial({ color: 0x11251a, roughness: 1 });
      const tgeo = new THREE.CylinderGeometry(0.8, 1.3, 18, 5);
      const tinst = new THREE.InstancedMesh(tgeo, trunkMat, 60);
      for (let i = 0; i < 60; i++) {
        const a = (i / 60) * Math.PI * 2 + this.rng() * 0.1;
        const r = 84 + this.rng() * 45;
        dummy.position.set(Math.cos(a) * r, 6, Math.sin(a) * r);
        dummy.scale.set(1, 1 + this.rng() * 0.8, 1);
        dummy.updateMatrix();
        tinst.setMatrixAt(i, dummy.matrix);
      }
      tinst.instanceMatrix.needsUpdate = true;
      this.root.add(tinst);
    }
  }

  buildSpawnMarkers() {
    // subtle rings so players can find their start / den
    const mk = (x, z, color) => {
      const y = this.heightAt(x, z);
      const ring = new THREE.Mesh(new THREE.RingGeometry(1.6, 1.95, 24), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.32, depthWrite: false, side: THREE.DoubleSide }));
      ring.rotation.x = -Math.PI / 2; ring.position.set(x, y + 0.06, z); this.root.add(ring);
      return ring;
    };
    this.hiderRing = mk(this.hiderSpawn.x, this.hiderSpawn.z, 0xc9f16b);
    this.seekerRing = mk(this.seekerSpawn.x, this.seekerSpawn.z, 0xff5a3c);
  }

  /* ── queries ─────────────────────────────────────────── */
  getSpawnPoints(team, count) {
    const anchor = team === 'hider' ? this.hiderSpawn : this.seekerSpawn;
    const pts = [];
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + this.rng() * 0.6;
      const r = 1.1 + (i % 3) * 1.35 + this.rng() * 0.8;
      let x = anchor.x + Math.cos(a) * r;
      let z = anchor.z + Math.sin(a) * r;
      const pos = { x, z };
      this.resolve(pos, 0.45);
      pts.push({ x: pos.x, z: pos.z, y: this.heightAt(pos.x, pos.z) });
    }
    return pts;
  }

  inBush(x, z) {
    for (const b of this.bushes) {
      if (Math.hypot(x - b.x, z - b.z) < b.r * 0.95) return b;
    }
    return null;
  }

  nearestTree(x, z, maxDist = 2.5) {
    let best = null, bestD = maxDist;
    for (const t of this.trees) {
      if (!t.climbable) continue;
      const d = Math.hypot(x - t.x, z - t.z);
      if (d < bestD) { bestD = d; best = t; }
    }
    return best;
  }

  resolve(pos, radius = 0.45, arena = this.arena) {
    let hit = false;
    for (const c of this.colliders) {
      if (c.type === 'circle') {
        const dx = pos.x - c.x, dz = pos.z - c.z;
        const rr = c.r + radius;
        const d2 = dx * dx + dz * dz;
        if (d2 < rr * rr) {
          const d = Math.sqrt(d2) || 0.0001;
          pos.x = c.x + (dx / d) * rr;
          pos.z = c.z + (dz / d) * rr;
          hit = true;
        }
      } else {
        const cx = clamp(pos.x, c.x - c.hw, c.x + c.hw);
        const cz = clamp(pos.z, c.z - c.hd, c.z + c.hd);
        let dx = pos.x - cx, dz = pos.z - cz;
        let d2 = dx * dx + dz * dz;
        if (d2 < radius * radius) {
          if (d2 > 0.000001) {
            const d = Math.sqrt(d2);
            pos.x = cx + (dx / d) * radius;
            pos.z = cz + (dz / d) * radius;
          } else {
            // inside the box: push out along smallest penetration
            const px = c.x - pos.x, pz = c.z - pos.z;
            const ox = c.hw + radius - Math.abs(px);
            const oz = c.hd + radius - Math.abs(pz);
            if (ox < oz) pos.x = c.x + Math.sign(px || 1) * (c.hw + radius);
            else pos.z = c.z + Math.sign(pz || 1) * (c.hd + radius);
          }
          hit = true;
        }
      }
    }
    const r = Math.hypot(pos.x, pos.z);
    if (r > arena) {
      pos.x = (pos.x / r) * arena;
      pos.z = (pos.z / r) * arena;
      hit = true;
    }
    return hit;
  }

  lineBlocked(ax, az, bx, bz) {
    const dx = bx - ax, dz = bz - az;
    const len2 = dx * dx + dz * dz;
    if (len2 < 0.001) return false;
    for (const c of this.colliders) {
      if (c.type !== 'circle' || c.r < 0.5) continue;
      const t = clamp(((c.x - ax) * dx + (c.z - az) * dz) / len2, 0, 1);
      const px = ax + dx * t, pz = az + dz * t;
      if (Math.hypot(px - c.x, pz - c.z) < c.r * 0.85) return true;
    }
    return false;
  }

  randomClearPoint(minR = 6, maxR = this.arena - 5) {
    for (let i = 0; i < 40; i++) {
      const p = this.randomSpot(minR, maxR);
      const pos = { x: p.x, z: p.z };
      this.resolve(pos, 0.5);
      if (Math.hypot(pos.x - p.x, pos.z - p.z) < 0.1) return { x: p.x, z: p.z };
    }
    return { x: 0, z: 0 };
  }

  nearestBush(x, z, maxDist = 100) {
    let best = null, bd = maxDist;
    for (const b of this.bushes) {
      const d = Math.hypot(x - b.x, z - b.z);
      if (d < bd) { bd = d; best = b; }
    }
    return best;
  }

  /* ── per-frame ───────────────────────────────────────── */
  update(dt) {
    this.time += dt;
    const t = this.time;
    this.updateParticles(dt);
    for (const c of this.clouds) {
      c.g.position.x += c.speed * dt;
      if (c.g.position.x > 240) c.g.position.x = -240;
    }
    for (const tc of this.torches) {
      const f = 0.78 + Math.sin(t * 9 + tc.seed) * 0.1 + Math.sin(t * 23 + tc.seed * 2) * 0.06;
      tc.light.intensity = 16 * f;
      tc.flame.scale.set(0.85 + f * 0.2, 0.85 + f * 0.3, 0.85 + f * 0.2);
      tc.sprite.material.opacity = 0.45 + f * 0.2;
    }
    if (this.hiderRing) this.hiderRing.material.opacity = 0.18 + (Math.sin(t * 1.6) * 0.5 + 0.5) * 0.18;
    if (this.seekerRing) this.seekerRing.material.opacity = 0.18 + (Math.sin(t * 1.6 + 2) * 0.5 + 0.5) * 0.18;
  }

  updateParticles(dt) {
    const t = this.time;
    for (const ps of this.particleSystems) {
      const arr = ps.points.geometry.attributes.position.array;
      for (let i = 0; i < ps.data.length; i++) {
        const d = ps.data[i];
        if (ps.type === 'leaf') {
          arr[i * 3 + 1] -= (0.35 + d.speed * 0.5) * dt;
          arr[i * 3] += Math.sin(t * 0.6 + d.seed) * 0.35 * dt + 0.12 * dt;
          arr[i * 3 + 2] += Math.cos(t * 0.42 + d.seed) * 0.2 * dt;
          if (arr[i * 3 + 1] < 0.2) {
            const a = this.rng() * Math.PI * 2, r = 4 + this.rng() * 64;
            arr[i * 3] = Math.cos(a) * r;
            arr[i * 3 + 2] = Math.sin(a) * r;
            arr[i * 3 + 1] = 5 + this.rng() * 9;
          }
        } else if (ps.type === 'dust') {
          arr[i * 3] += Math.sin(t * 0.2 + d.seed) * 0.5 * dt + 0.28 * dt;
          arr[i * 3 + 2] += Math.cos(t * 0.17 + d.seed) * 0.4 * dt;
          arr[i * 3 + 1] = d.baseY + Math.sin(t * 0.6 + d.seed) * 0.7;
          if (arr[i * 3] > 75) arr[i * 3] = -75;
        } else {
          const rr = d.r + Math.sin(t * 0.3 + d.seed) * 0.6;
          arr[i * 3] = Math.cos(t * 0.18 + d.seed) * (d.r + 20) * 1.1;
          arr[i * 3 + 2] = Math.sin(t * 0.15 + d.seed) * (d.r + 20) * 1.1;
          arr[i * 3 + 1] = d.baseY + Math.sin(t * 0.8 + d.seed) * 1.2;
        }
      }
      ps.points.geometry.attributes.position.needsUpdate = true;
    }
  }

  dispose() {
    this.scene.remove(this.root);
    const disposed = new Set();
    this.root.traverse((o) => {
      if (o.geometry && !disposed.has(o.geometry)) { o.geometry.dispose(); disposed.add(o.geometry); }
      if (o.material) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) {
          if (disposed.has(m)) continue;
          disposed.add(m);
          if (m.map && !this.textures.includes(m.map)) m.map.dispose?.();
          m.dispose?.();
        }
      }
    });
    for (const t of this.textures) t.dispose?.();
    this._palmGeo?.dispose?.();
    this._fernGeo?.dispose?.();
    if (this._batchSourceResources) {
      for (const geo of this._batchSourceResources.geometries) geo.dispose?.();
      for (const mat of this._batchSourceResources.materials) mat.dispose?.();
    }
    this.scene.fog = null;
  }
}
