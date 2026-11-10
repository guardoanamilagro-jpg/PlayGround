import * as THREE from 'three';
import { mergeGeometries } from '../vendor/BufferGeometryUtils.js';

/* ═══════════════════════════════════════════════════════════
   SPECIES — stats are used by HUD, AI and balance tuning
   ═══════════════════════════════════════════════════════════ */
export const SPECIES = {
  monkey: {
    id: 'monkey', name: 'MONO', short: 'Mono', team: 'hider', emoji: '🐒',
    role: 'ESCONDIDO · 1 DE 9', tint: '#c9f16b', ui: '#8d6a3f',
    speed: 5.9, sprint: 1.32, stealth: 90, power: 82,
    ability: 'trepar', abilityName: 'TREPAR + CAMUFLAJE',
    abilityDesc: 'Sube a un árbol con E y quédate quieto',
    blurb: 'Trepa a los árboles y permanece inmóvil para fundirte con la copa.'
  },
  chameleon: {
    id: 'chameleon', name: 'CAMALEÓN', short: 'Camaleón', team: 'hider', emoji: '🦎',
    role: 'ESCONDIDO · 1 DE 9', tint: '#c9f16b', ui: '#4fa84f',
    speed: 5.45, sprint: 1.3, stealth: 98, power: 74,
    ability: 'camo', abilityName: 'CAMUFLAJE ACTIVO',
    abilityDesc: '10 s invisible sobre cualquier superficie',
    blurb: 'Cambia el color de tu piel para igualar cualquier superficie durante 10 segundos.'
  },
  fox: {
    id: 'fox', name: 'ZORRO', short: 'Zorro', team: 'hider', emoji: '🦊',
    role: 'ESCONDIDO · 1 DE 9', tint: '#c9f16b', ui: '#d9632a',
    speed: 6.1, sprint: 1.36, stealth: 64, power: 40,
    ability: 'none', abilityName: 'SIN HABILIDAD',
    abilityDesc: 'Rápido, ligero y silencioso',
    blurb: 'Una presa rápida y silenciosa. Sin poderes: solo instinto y velocidad.'
  },
  raccoon: {
    id: 'raccoon', name: 'MAPACHE', short: 'Mapache', team: 'hider', emoji: '🦝',
    role: 'ESCONDIDO · 1 DE 9', tint: '#c9f16b', ui: '#8b8f98',
    speed: 5.85, sprint: 1.34, stealth: 72, power: 38,
    ability: 'none', abilityName: 'SIN HABILIDAD',
    abilityDesc: 'Se mueve bien entre arbustos',
    blurb: 'Ágil y discreto entre la maleza. Confía en los arbustos y en su olfato.'
  },
  rabbit: {
    id: 'rabbit', name: 'CONEJO', short: 'Conejo', team: 'hider', emoji: '🐇',
    role: 'ESCONDIDO · 1 DE 9', tint: '#c9f16b', ui: '#cbb9a5',
    speed: 6.0, sprint: 1.4, stealth: 70, power: 34,
    ability: 'none', abilityName: 'SIN HABILIDAD',
    abilityDesc: 'El más rápido de las presas',
    blurb: 'El más rápido de las presas. Un arranque explosivo puede salvarte.'
  },
  cheetah: {
    id: 'cheetah', name: 'GUEPARDO', short: 'Guepardo', team: 'seeker', emoji: '🐆',
    role: 'CAZADOR · 1 DE 2', tint: '#ff5a3c', ui: '#e0a23a',
    speed: 7.35, sprint: 1.28, stealth: 42, power: 92,
    ability: 'burst', abilityName: 'IMPULSO',
    abilityDesc: 'Aceleración brutal durante 4 segundos',
    blurb: 'Velocidad extrema y un impulso explosivo. Si te ve, no hay escapatoria.'
  },
  lion: {
    id: 'lion', name: 'LEÓN', short: 'León', team: 'seeker', emoji: '🦁',
    role: 'CAZADOR · 1 DE 2', tint: '#ff5a3c', ui: '#c98f4a',
    speed: 6.75, sprint: 1.24, stealth: 48, power: 98,
    ability: 'roar', abilityName: 'RUGIDO',
    abilityDesc: 'Revela presas en movimiento cerca de ti',
    blurb: 'Fuerza bruta y un rugido que hace temblar el mapa. Nada se mueve sin ser visto.'
  }
};

export const HIDER_PLAYABLE = ['monkey', 'chameleon', 'fox', 'raccoon', 'rabbit'];
export const SEEKER_PLAYABLE = ['cheetah', 'lion'];
export const HIDER_AI_POOL = ['fox', 'raccoon', 'rabbit', 'monkey', 'chameleon', 'fox', 'raccoon', 'rabbit'];

/* ═══════════════════════════════════════════════════════════
   MODEL HELPERS
   ═══════════════════════════════════════════════════════════ */
const S = (r, w = 10, h = 8) => new THREE.SphereGeometry(r, w, h);
const C = (r1, r2, ht, seg = 7) => new THREE.CylinderGeometry(r1, r2, ht, seg);
const CO = (r, ht, seg = 7) => new THREE.ConeGeometry(r, ht, seg);
const B = (x, y, z) => new THREE.BoxGeometry(x, y, z);

function makeMesh(geo, material, x = 0, y = 0, z = 0, partList) {
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = false;
  if (partList) partList.push(mesh);
  return mesh;
}

function buildLimb(root, mat, x, y, z, len, r, phase, parts) {
  const pivot = new THREE.Group();
  pivot.position.set(x, y, z);
  const limb = makeMesh(C(r * 0.8, r, len, 6), mat, 0, -len / 2, 0);
  const paw = makeMesh(S(r * 1.4, 7, 5), mat, 0, -len + 0.01, r * 0.6);
  pivot.add(limb, paw);
  pivot.userData.phase = phase;
  pivot.userData.baseX = x;
  root.add(pivot);
  parts.legs.push(pivot);
  return pivot;
}

function buildArm(root, mat, x, y, z, len, r, phase, parts) {
  const pivot = new THREE.Group();
  pivot.position.set(x, y, z);
  const limb = makeMesh(C(r * 0.75, r, len, 6), mat, 0, -len / 2, 0);
  const hand = makeMesh(S(r * 1.35, 7, 5), mat, 0, -len, r * 0.4);
  pivot.add(limb, hand);
  pivot.userData.phase = phase;
  pivot.rotation.z = x > 0 ? -0.08 : 0.08;
  root.add(pivot);
  parts.arms.push(pivot);
  return pivot;
}

function mergeMeshChildren(group, keep, sources) {
  for (const child of [...group.children]) {
    if (child.isGroup) mergeMeshChildren(child, keep, sources);
  }
  const buckets = new Map();
  for (const child of [...group.children]) {
    if (!child.isMesh || child.isInstancedMesh || keep.has(child)) continue;
    if (!child.geometry || child.children.length) continue;
    const mat = child.material;
    if (!mat || Array.isArray(mat)) continue;
    let bucket = buckets.get(mat);
    if (!bucket) { bucket = []; buckets.set(mat, bucket); }
    bucket.push(child);
  }
  for (const [mat, meshes] of buckets) {
    if (meshes.length < 2) continue;
    const geos = [];
    for (const mesh of meshes) {
      let geo = mesh.geometry.clone();
      if (geo.index) {
        const flat = geo.toNonIndexed();
        geo.dispose();
        geo = flat;
      }
      mesh.updateMatrix();
      geo.applyMatrix4(mesh.matrix);
      for (const name of Object.keys(geo.attributes)) {
        if (name !== 'position' && name !== 'normal' && name !== 'uv') geo.deleteAttribute(name);
      }
      geos.push(geo);
      sources.push(mesh.geometry);
      group.remove(mesh);
    }
    const merged = mergeGeometries(geos, false);
    for (const geo of geos) geo.dispose();
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = false;
    group.add(mesh);
  }
}

function addEyes(root, mat, xs, y, z, r = 0.045) {
  const eyes = [];
  for (const x of xs) {
    const e = makeMesh(S(r, 8, 6), mat, x, y, z);
    e.castShadow = false;
    root.add(e);
    eyes.push(e);
    const glint = makeMesh(S(r * 0.32, 6, 4), new THREE.MeshBasicMaterial({ color: 0xffffff }), x + r * 0.22, y + r * 0.3, z + r * 0.72);
    glint.castShadow = false;
    root.add(glint);
  }
  return eyes;
}

export function createAnimal(speciesId, opts = {}) {
  const sp = SPECIES[speciesId] || SPECIES.fox;
  const root = new THREE.Group();
  const parts = { legs: [], arms: [], eyes: [], tail: null, body: null, head: null, extras: [] };
  const materials = [];
  const animated = [];

  const M = (color, options = {}) => {
    const mat = new THREE.MeshStandardMaterial({
      color,
      roughness: options.rough ?? 0.82,
      metalness: 0.02,
      flatShading: options.flat ?? true,
      emissive: options.emissive ?? 0x000000,
      emissiveIntensity: options.emissiveIntensity ?? 0
    });
    materials.push(mat);
    return mat;
  };

  const dark = M(0x1c1712, { rough: 0.5 });
  const eyeMat = M(0x090806, { rough: 0.25, flat: false });
  const white = M(0xf5efe2, { rough: 0.55 });
  const pink = M(0xc98580, { rough: 0.7 });

  if (sp.id === 'monkey') {
    const fur = M(0x7a4b2c);
    const fur2 = M(0x94603a);
    const face = M(0xd9a97a);
    const belly = M(0xc6a075);
    const body = makeMesh(S(0.43, 10, 8), fur, 0, 0.92, 0);
    body.scale.set(0.92, 1.05, 0.82);
    root.add(body); parts.body = body;
    const chest = makeMesh(S(0.28, 9, 7), belly, 0, 0.88, 0.26);
    chest.scale.set(1, 1.15, 0.5); root.add(chest);
    buildArm(root, fur2, -0.38, 1.16, 0.07, 0.55, 0.085, 0, parts);
    buildArm(root, fur2, 0.38, 1.16, 0.07, 0.55, 0.085, Math.PI, parts);
    buildLimb(root, fur2, -0.2, 0.6, 0.04, 0.5, 0.095, Math.PI, parts);
    buildLimb(root, fur2, 0.2, 0.6, 0.04, 0.5, 0.095, 0, parts);
    const head = new THREE.Group(); head.position.set(0, 1.48, 0.16); root.add(head); parts.head = head;
    const skull = makeMesh(S(0.3, 10, 8), fur, 0, 0, 0); skull.scale.set(1, 0.95, 0.9); head.add(skull);
    const muzzle = makeMesh(S(0.24, 9, 7), face, 0, -0.03, 0.19); muzzle.scale.set(1, 1.04, 0.57); head.add(muzzle);
    const snout = makeMesh(S(0.12, 8, 6), M(0xc08e63), 0, -0.09, 0.35); snout.scale.set(1.15, 0.7, 0.8); head.add(snout);
    for (const x of [-0.29, 0.29]) {
      const ear = makeMesh(S(0.105, 8, 6), fur, x, 0.04, -0.01); ear.scale.set(1, 1.1, 0.5); head.add(ear);
      const inner = makeMesh(S(0.055, 7, 5), face, x, 0.04, 0.045); inner.scale.set(1, 1, 0.4); head.add(inner);
    }
    parts.eyes = addEyes(head, eyeMat, [-0.11, 0.11], 0.075, 0.36, 0.042);
    // brow
    const brow = makeMesh(B(0.16, 0.025, 0.02), fur2, 0, 0.16, 0.35); head.add(brow);
    // curling tail
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.82, -0.32), new THREE.Vector3(0, 0.95, -0.75),
      new THREE.Vector3(0, 1.25, -0.95), new THREE.Vector3(0, 1.55, -0.7),
      new THREE.Vector3(0, 1.62, -0.35), new THREE.Vector3(0, 1.5, -0.22)
    ]);
    const tail = makeMesh(new THREE.TubeGeometry(curve, 14, 0.045, 5, false), fur2, 0, 0, 0);
    const tuft = makeMesh(S(0.075, 7, 5), face, 0, 1.5, -0.22); root.add(tail, tuft); parts.tail = tail;
    root.userData.height = 1.85;
  }

  else if (sp.id === 'chameleon') {
    const green = M(0x4f9d43);
    const green2 = M(0x7bc45a);
    const lime = M(0xb7d864);
    const yellow = M(0xe2cf58);
    const body = makeMesh(S(0.31, 10, 8), green, 0, 0.6, 0);
    body.scale.set(1.02, 0.86, 1.75); root.add(body); parts.body = body;
    const belly = makeMesh(S(0.25, 9, 7), lime, 0, 0.52, 0.02); belly.scale.set(0.92, 0.5, 1.6); root.add(belly);
    const head = new THREE.Group(); head.position.set(0, 0.74, 0.48); root.add(head); parts.head = head;
    const skull = makeMesh(S(0.21, 10, 8), green2, 0, 0, 0); skull.scale.set(1, 0.9, 1.02); head.add(skull);
    const casque = makeMesh(CO(0.16, 0.3, 6), green2, 0, 0.14, -0.03); casque.rotation.x = -0.32; head.add(casque);
    const mouth = makeMesh(B(0.2, 0.025, 0.12), M(0x2f4a24), 0, -0.08, 0.2); head.add(mouth);
    // turret eyes
    for (const x of [-0.2, 0.2]) {
      const socket = makeMesh(S(0.115, 9, 7), yellow, x, 0.04, 0.06); head.add(socket);
      const pupil = makeMesh(S(0.04, 7, 5), eyeMat, x * 1.13, 0.04, 0.14); head.add(pupil);
      parts.eyes.push(socket);
    }
    // dorsal crest
    for (let i = 0; i < 6; i++) {
      const crest = makeMesh(CO(0.07, 0.2 + (i % 2) * 0.06, 5), green2, 0, 0.94, 0.3 - i * 0.17);
      crest.rotation.x = 0.25; root.add(crest);
    }
    // legs
    buildLimb(root, green2, -0.24, 0.48, 0.36, 0.34, 0.06, 0, parts);
    buildLimb(root, green2, 0.24, 0.48, 0.36, 0.34, 0.06, Math.PI, parts);
    buildLimb(root, green2, -0.24, 0.48, -0.32, 0.34, 0.06, Math.PI, parts);
    buildLimb(root, green2, 0.24, 0.48, -0.32, 0.34, 0.06, 0, parts);
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.57, -0.48), new THREE.Vector3(0, 0.52, -0.82),
      new THREE.Vector3(0, 0.3, -1.02), new THREE.Vector3(0, 0.12, -0.88),
      new THREE.Vector3(0, 0.16, -0.66), new THREE.Vector3(0, 0.29, -0.72),
      new THREE.Vector3(0, 0.3, -0.87)
    ]);
    const tail = makeMesh(new THREE.TubeGeometry(curve, 18, 0.05, 5, false), yellow, 0, 0, 0);
    root.add(tail); parts.tail = tail;
    root.userData.height = 1.2;
  }

  else if (sp.id === 'fox') {
    const orange = M(0xd35f28);
    const orange2 = M(0xe57836);
    const cream = M(0xeadfc9);
    const sock = M(0x3a2b21);
    const body = makeMesh(S(0.33, 10, 8), orange, 0, 0.82, 0);
    body.scale.set(1, 0.92, 1.55); root.add(body); parts.body = body;
    const chest = makeMesh(S(0.22, 9, 7), cream, 0, 0.75, 0.35); chest.scale.set(0.9, 1.1, 0.55); root.add(chest);
    const head = new THREE.Group(); head.position.set(0, 1.17, 0.43); root.add(head); parts.head = head;
    const skull = makeMesh(S(0.26, 10, 8), orange2, 0, 0, 0); skull.scale.set(1, 0.92, 0.92); head.add(skull);
    const snout = makeMesh(S(0.15, 9, 7), cream, 0, -0.07, 0.22); snout.scale.set(0.86, 0.72, 1.35); head.add(snout);
    const nose = makeMesh(S(0.045, 6, 5), dark, 0, -0.055, 0.42); head.add(nose);
    for (const x of [-0.17, 0.17]) {
      const ear = makeMesh(CO(0.12, 0.34, 4), orange, x, 0.27, -0.03); ear.rotation.z = x > 0 ? -0.12 : 0.12; head.add(ear);
      const inner = makeMesh(CO(0.07, 0.23, 4), pink, x, 0.26, 0.02); inner.rotation.z = ear.rotation.z; head.add(inner);
    }
    parts.eyes = addEyes(head, eyeMat, [-0.11, 0.11], 0.055, 0.21, 0.04);
    const cheekL = makeMesh(S(0.1, 7, 5), cream, -0.19, -0.03, 0.1); const cheekR = cheekL.clone(); cheekR.position.x = 0.19;
    cheekL.scale.set(1, 0.7, 0.7); cheekR.scale.set(1, 0.7, 0.7); head.add(cheekL, cheekR);
    buildLimb(root, sock, -0.19, 0.48, 0.3, 0.46, 0.065, 0, parts);
    buildLimb(root, sock, 0.19, 0.48, 0.3, 0.46, 0.065, Math.PI, parts);
    buildLimb(root, sock, -0.19, 0.48, -0.3, 0.46, 0.065, Math.PI, parts);
    buildLimb(root, sock, 0.19, 0.48, -0.3, 0.46, 0.065, 0, parts);
    const tailGroup = new THREE.Group(); tailGroup.position.set(0, 0.86, -0.42); root.add(tailGroup);
    const tail = makeMesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0.16, -0.35), new THREE.Vector3(0, 0.42, -0.55), new THREE.Vector3(0, 0.62, -0.48)
    ]), 10, 0.13, 6, false), orange, 0, 0, 0);
    const tip = makeMesh(S(0.13, 7, 5), cream, 0, 0.63, -0.48); tip.scale.set(1, 1.25, 1); tailGroup.add(tail, tip);
    parts.tail = tailGroup;
    root.userData.height = 1.55;
  }

  else if (sp.id === 'raccoon') {
    const gray = M(0x7d828a);
    const gray2 = M(0x9398a1);
    const black = M(0x26262a);
    const cream = M(0xd9d6c8);
    const body = makeMesh(S(0.31, 10, 8), gray, 0, 0.74, 0);
    body.scale.set(1, 0.95, 1.4); root.add(body); parts.body = body;
    const chest = makeMesh(S(0.22, 9, 7), gray2, 0, 0.7, 0.28); chest.scale.set(0.9, 1.1, 0.55); root.add(chest);
    const head = new THREE.Group(); head.position.set(0, 1.06, 0.4); root.add(head); parts.head = head;
    const skull = makeMesh(S(0.25, 10, 8), gray, 0, 0, 0); skull.scale.set(1, 0.9, 0.95); head.add(skull);
    const snout = makeMesh(S(0.14, 9, 7), cream, 0, -0.08, 0.23); snout.scale.set(0.9, 0.72, 1.2); head.add(snout);
    const nose = makeMesh(S(0.045, 6, 5), black, 0, -0.08, 0.4); head.add(nose);
    const mask = makeMesh(S(0.235, 10, 6), black, 0, 0.055, 0.115); mask.scale.set(1.02, 0.33, 0.5); head.add(mask);
    for (const x of [-0.17, 0.17]) {
      const ear = makeMesh(S(0.095, 8, 6), gray, x, 0.22, -0.03); ear.scale.set(1, 1, 0.55); head.add(ear);
      const inner = makeMesh(S(0.05, 7, 5), black, x, 0.22, 0.02); inner.scale.set(1, 1, 0.4); head.add(inner);
    }
    const eyes = addEyes(head, white, [-0.11, 0.11], 0.06, 0.31, 0.036);
    for (const e of eyes) { const p = makeMesh(S(0.019, 6, 4), dark, e.position.x, e.position.y, e.position.z + 0.03); head.add(p); }
    buildLimb(root, black, -0.18, 0.48, 0.29, 0.44, 0.06, 0, parts);
    buildLimb(root, black, 0.18, 0.48, 0.29, 0.44, 0.06, Math.PI, parts);
    buildLimb(root, black, -0.18, 0.48, -0.29, 0.44, 0.06, Math.PI, parts);
    buildLimb(root, black, 0.18, 0.48, -0.29, 0.44, 0.06, 0, parts);
    const tailGroup = new THREE.Group(); tailGroup.position.set(0, 0.75, -0.38); root.add(tailGroup);
    for (let i = 0; i < 5; i++) {
      const seg = makeMesh(S(0.115 - i * 0.008, 8, 6), i % 2 ? black : gray2, 0, 0.06 + i * 0.115, -0.12 - i * 0.13);
      seg.scale.set(1, 0.95, 0.85); tailGroup.add(seg);
    }
    parts.tail = tailGroup;
    root.userData.height = 1.45;
  }

  else if (sp.id === 'rabbit') {
    const beige = M(0xc9b7a1);
    const beige2 = M(0xd9cbb8);
    const cream = M(0xefe5d3);
    const body = makeMesh(S(0.3, 10, 8), beige, 0, 0.64, 0);
    body.scale.set(1, 1.05, 1.18); root.add(body); parts.body = body;
    const chest = makeMesh(S(0.22, 9, 7), cream, 0, 0.61, 0.22); chest.scale.set(0.95, 1, 0.55); root.add(chest);
    const head = new THREE.Group(); head.position.set(0, 1.02, 0.25); root.add(head); parts.head = head;
    const skull = makeMesh(S(0.235, 10, 8), beige2, 0, 0, 0); skull.scale.set(1, 0.94, 0.95); head.add(skull);
    const snout = makeMesh(S(0.11, 9, 7), cream, 0, -0.06, 0.2); snout.scale.set(1, 0.72, 1.05); head.add(snout);
    const nose = makeMesh(S(0.035, 6, 5), pink, 0, -0.03, 0.31); head.add(nose);
    for (const x of [-0.13, 0.13]) {
      const ear = makeMesh(new THREE.CapsuleGeometry(0.055, 0.44, 3, 6), beige, x, 0.3, -0.02);
      ear.scale.set(1, 1, 0.62); ear.rotation.z = x > 0 ? -0.13 : 0.13; head.add(ear);
      const inner = makeMesh(new THREE.CapsuleGeometry(0.032, 0.35, 3, 5), pink, x, 0.31, 0.025);
      inner.rotation.z = ear.rotation.z; head.add(inner);
    }
    parts.eyes = addEyes(head, eyeMat, [-0.1, 0.1], 0.02, 0.21, 0.037);
    buildLimb(root, beige, -0.18, 0.42, 0.2, 0.38, 0.06, 0, parts);
    buildLimb(root, beige, 0.18, 0.42, 0.2, 0.38, 0.06, Math.PI, parts);
    buildLimb(root, beige, -0.18, 0.42, -0.2, 0.38, 0.06, Math.PI, parts);
    buildLimb(root, beige, 0.18, 0.42, -0.2, 0.38, 0.06, 0, parts);
    const tail = makeMesh(S(0.105, 8, 6), cream, 0, 0.66, -0.4); root.add(tail); parts.tail = tail;
    root.userData.height = 1.62;
  }

  else if (sp.id === 'cheetah') {
    const gold = M(0xdd9c3a);
    const cream = M(0xf0dcb4);
    const spot = M(0x3b2a1a);
    const body = makeMesh(S(0.3, 10, 8), gold, 0, 0.9, 0);
    body.scale.set(1, 0.9, 1.7); root.add(body); parts.body = body;
    const chest = makeMesh(S(0.23, 9, 7), cream, 0, 0.82, 0.32); chest.scale.set(0.9, 1.05, 0.6); root.add(chest);
    const head = new THREE.Group(); head.position.set(0, 1.28, 0.5); root.add(head); parts.head = head;
    const skull = makeMesh(S(0.23, 10, 8), gold, 0, 0, 0); skull.scale.set(1, 0.88, 0.92); head.add(skull);
    const snout = makeMesh(S(0.12, 9, 7), cream, 0, -0.06, 0.19); snout.scale.set(0.9, 0.72, 1.2); head.add(snout);
    const nose = makeMesh(S(0.04, 6, 5), dark, 0, -0.05, 0.32); head.add(nose);
    for (const x of [-0.15, 0.15]) {
      const ear = makeMesh(S(0.08, 8, 6), gold, x, 0.19, -0.01); ear.scale.set(1, 1, 0.55); head.add(ear);
      const tear = makeMesh(B(0.025, 0.11, 0.02), spot, x * 0.82, -0.02, 0.21); tear.rotation.z = x > 0 ? 0.18 : -0.18; head.add(tear);
    }
    parts.eyes = addEyes(head, eyeMat, [-0.1, 0.1], 0.05, 0.2, 0.037);
    for (let i = 0; i < 22; i++) {
      const side = i % 2 ? 1 : -1;
      const z = (Math.random() - 0.5) * 1.6;
      const y = 0.8 + Math.random() * 0.28;
      const x = side * (0.235 - Math.abs(z) * 0.035);
      const s = makeMesh(S(0.033, 5, 4), spot, x, y, z);
      s.scale.set(0.7, 0.7, 0.7); root.add(s);
    }
    buildLimb(root, gold, -0.2, 0.55, 0.4, 0.58, 0.07, 0, parts);
    buildLimb(root, gold, 0.2, 0.55, 0.4, 0.58, 0.07, Math.PI, parts);
    buildLimb(root, gold, -0.2, 0.55, -0.38, 0.58, 0.07, Math.PI, parts);
    buildLimb(root, gold, 0.2, 0.55, -0.38, 0.58, 0.07, 0, parts);
    const tailGroup = new THREE.Group(); tailGroup.position.set(0, 0.98, -0.45); root.add(tailGroup);
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -0.02, -0.45), new THREE.Vector3(0, 0.12, -0.85), new THREE.Vector3(0, 0.34, -1.05)
    ]);
    const tail = makeMesh(new THREE.TubeGeometry(curve, 12, 0.055, 5, false), gold, 0, 0, 0);
    const tip = makeMesh(S(0.075, 7, 5), spot, 0, 0.35, -1.05); tailGroup.add(tail, tip);
    parts.tail = tailGroup;
    root.userData.height = 1.7;
  }

  else { // lion
    const tan = M(0xc18a48);
    const tan2 = M(0xd39d58);
    const mane = M(0x71401f);
    const mane2 = M(0x8a5128);
    const cream = M(0xe4c89b);
    const body = makeMesh(S(0.4, 10, 8), tan, 0, 1.0, 0);
    body.scale.set(1.03, 0.92, 1.55); root.add(body); parts.body = body;
    const chest = makeMesh(S(0.3, 9, 7), cream, 0, 0.92, 0.34); chest.scale.set(0.95, 1, 0.6); root.add(chest);
    const head = new THREE.Group(); head.position.set(0, 1.5, 0.54); root.add(head); parts.head = head;
    const skull = makeMesh(S(0.29, 10, 8), tan2, 0, 0, 0); skull.scale.set(1, 0.94, 0.92); head.add(skull);
    const snout = makeMesh(S(0.17, 9, 7), cream, 0, -0.075, 0.21); snout.scale.set(1, 0.72, 1.05); head.add(snout);
    const nose = makeMesh(S(0.055, 6, 5), dark, 0, -0.06, 0.37); head.add(nose);
    // mane ring
    const ring = makeMesh(new THREE.TorusGeometry(0.36, 0.14, 6, 14), mane, 0, -0.01, -0.05); head.add(ring);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const puff = makeMesh(S(0.13, 7, 5), i % 2 ? mane : mane2, Math.cos(a) * 0.38, Math.sin(a) * 0.38, -0.04);
      head.add(puff);
    }
    for (const x of [-0.14, 0.14]) {
      const ear = makeMesh(S(0.075, 8, 6), tan, x, 0.27, -0.02); ear.scale.set(1, 1, 0.5); head.add(ear);
    }
    parts.eyes = addEyes(head, eyeMat, [-0.11, 0.11], 0.055, 0.24, 0.04);
    buildLimb(root, tan, -0.25, 0.62, 0.36, 0.6, 0.09, 0, parts);
    buildLimb(root, tan, 0.25, 0.62, 0.36, 0.6, 0.09, Math.PI, parts);
    buildLimb(root, tan, -0.25, 0.62, -0.34, 0.6, 0.09, Math.PI, parts);
    buildLimb(root, tan, 0.25, 0.62, -0.34, 0.6, 0.09, 0, parts);
    const tailGroup = new THREE.Group(); tailGroup.position.set(0, 1.02, -0.45); root.add(tailGroup);
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -0.08, -0.5), new THREE.Vector3(0, 0.08, -0.9), new THREE.Vector3(0, 0.22, -1.05)
    ]);
    const tail = makeMesh(new THREE.TubeGeometry(curve, 10, 0.045, 5, false), tan, 0, 0, 0);
    const tuft = makeMesh(S(0.09, 7, 5), mane, 0, 0.23, -1.05); tuft.scale.set(1, 1.3, 0.8); tailGroup.add(tail, tuft);
    parts.tail = tailGroup;
    root.userData.height = 2.0;
  }

  // scale model for gameplay readability
  const baseScale = opts.scale ?? 1;
  root.scale.setScalar(baseScale);
  root.userData.species = sp.id;
  root.userData.parts = parts;
  root.userData.materials = materials;
  root.userData.animTime = Math.random() * 10;
  root.userData.lean = 0;

  // Merge meshes that share a parent and a material. Limbs, tails and the head
  // still animate as groups; only redundant draw calls disappear.
  const keep = new Set(parts.eyes);
  if (parts.body?.isMesh) keep.add(parts.body);
  const mergedSources = [];
  mergeMeshChildren(root, keep, mergedSources);
  root.userData.mergedSourceGeometries = mergedSources;

  // soft blob shadow under the animal (cheap, readable)
  if (opts.blob !== false) {
    const blob = new THREE.Mesh(
      new THREE.CircleGeometry(0.44, 12),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false })
    );
    blob.rotation.x = -Math.PI / 2;
    blob.position.y = 0.015;
    blob.scale.set(1, 0.7, 1);
    root.add(blob);
    root.userData.blob = blob;
  }

  root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; } });
  if (root.userData.blob) root.userData.blob.castShadow = false;
  return root;
}

/* ═══════════════════════════════════════════════════════════
   ANIMATION — speed in world units / second
   ═══════════════════════════════════════════════════════════ */
export function animateAnimal(root, dt, speed = 0, opts = {}) {
  const p = root.userData.parts;
  if (!p) return;
  const ud = root.userData;
  const sp = SPECIES[ud.species] || SPECIES.fox;
  const t = (ud.animTime = (ud.animTime || 0) + dt);
  const moving = Math.min(1, speed / Math.max(2.4, sp.speed));
  const speedFactor = Math.min(2.2, speed / 4.5 + moving * 0.8);
  const cycle = t * (5 + speedFactor * 4.1);
  const amp = 0.2 + moving * 0.62;
  const dead = opts.dead;

  if (dead) {
    root.rotation.z = THREE.MathUtils.lerp(root.rotation.z, opts.fallTilt ?? 1.45, Math.min(1, dt * 3));
    if (p.body) p.body.position.y = p.body.userData.baseY ?? p.body.position.y;
    return;
  }

  const legs = p.legs;
  for (let i = 0; i < legs.length; i++) {
    const leg = legs[i];
    const phase = leg.userData.phase || 0;
    leg.rotation.x = Math.sin(cycle + phase) * amp * (i < 2 ? 1 : -1) * 0.9;
  }
  const arms = p.arms;
  for (let i = 0; i < arms.length; i++) {
    const arm = arms[i];
    const phase = arm.userData.phase || 0;
    arm.rotation.x = Math.sin(cycle + phase + Math.PI) * amp * 0.8;
  }

  if (p.body) {
    if (!p.body.userData.baseY) p.body.userData.baseY = p.body.position.y;
    p.body.position.y = p.body.userData.baseY + Math.abs(Math.sin(cycle * 2)) * 0.028 * moving + Math.sin(t * 1.7) * 0.008;
    p.body.rotation.x = THREE.MathUtils.lerp(p.body.rotation.x, -0.07 * moving, Math.min(1, dt * 6));
  }
  if (p.head) {
    p.head.rotation.y = Math.sin(t * 0.7) * 0.1 + Math.sin(cycle * 0.5) * 0.03 * moving;
    p.head.rotation.x = Math.sin(t * 0.9) * 0.025 - 0.04 * moving;
  }
  if (p.tail) {
    const sway = Math.sin(t * 1.7) * 0.22 + Math.sin(cycle * 0.5) * 0.06 * moving;
    p.tail.rotation.y = sway;
    p.tail.rotation.x = Math.sin(t * 1.1) * 0.05;
  }
  if (ud.species === 'chameleon' && p.eyes.length) {
    p.eyes.forEach((e, i) => {
      e.rotation.y = Math.sin(t * (0.8 + i * 0.27) + i) * 0.55;
      e.rotation.x = Math.sin(t * 0.63 + i * 1.7) * 0.28;
    });
  }
  if (ud.blob) {
    ud.blob.material.opacity = Math.max(0.08, 0.24 - moving * 0.05);
  }
}

export function setAnimalOpacity(root, opacity) {
  const mats = root.userData.materials || [];
  for (const mat of mats) {
    if (opacity >= 0.999) {
      mat.transparent = false;
      mat.opacity = 1;
      mat.depthWrite = true;
      mat.needsUpdate = true;
    } else {
      mat.transparent = true;
      mat.opacity = opacity;
      mat.depthWrite = opacity > 0.6;
      mat.needsUpdate = true;
    }
  }
  const blob = root.userData.blob;
  if (blob) blob.visible = opacity > 0.5;
}

export function disposeAnimal(root) {
  const geometries = new Set(root.userData.mergedSourceGeometries || []);
  const materials = new Set(root.userData.materials || []);
  root.traverse((o) => {
    if (!o.isMesh) return;
    if (o.geometry) geometries.add(o.geometry);
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const mat of mats) materials.add(mat);
  });
  for (const geo of geometries) geo.dispose?.();
  for (const mat of materials) {
    if (!mat.userData?._keep) mat.dispose?.();
  }
}
