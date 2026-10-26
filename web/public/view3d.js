import * as THREE from 'three';
import { drawMinimap } from './minimap.js';

//stupid constants
const canvas = document.getElementById('three');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.Fog(0x87ceeb, 6, 22); // far stuff fades out
const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 100);

function resize() {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

// Lights camera action
scene.add(new THREE.AmbientLight(0xffffff, 0.6));
const sun = new THREE.DirectionalLight(0xffffff, 1);
sun.position.set(5, 10, 5);
scene.add(sun); //sunn

//plane geo
const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(100, 100),
  new THREE.MeshLambertMaterial({ color: 0x555555 })
);
floor.rotation.x = -Math.PI / 2;
scene.add(floor);

//more stupid constants
const wallGeo = new THREE.BoxGeometry(1, 2, 1);
const wallMat = new THREE.MeshLambertMaterial({ color: 0x996633 });
const playerGeo = new THREE.CapsuleGeometry(0.3, 0.8);
const noseGeo = new THREE.BoxGeometry(0.15, 0.15, 0.3); // little box so you can tell which way they face
const ammoGeo = new THREE.OctahedronGeometry(0.2);
const ammoMat = new THREE.MeshLambertMaterial({ color: 0xf2c94c, emissive: 0x553300 });
const deadMat = new THREE.MeshLambertMaterial({ color: 0x222222 });

// colors match the minimap: red enemy, cyan ally, pink traitor
const enemyMat = new THREE.MeshLambertMaterial({ color: 0xff5252 });
const allyMat = new THREE.MeshLambertMaterial({ color: 0x4dd0e1 });
const traitorMat = new THREE.MeshLambertMaterial({ color: 0xff00ff });
const aimMat = new THREE.LineBasicMaterial({ color: 0xff3c3c });

//actual scorch marks for the scorch
const scorchGeo = new THREE.CircleGeometry(0.35, 16);
const scorchMat = new THREE.MeshBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.8 });

const wallGroup = new THREE.Group();
const playerGroup = new THREE.Group();
const scorchGroup = new THREE.Group();
const ammoGroup = new THREE.Group();
scene.add(wallGroup, playerGroup, scorchGroup, ammoGroup);
let lastWalls = '';

// where the camera is heading to. we slide toward it every frame instead of teleporting
const camTarget = new THREE.Vector3(2.5, 1.2, 2.5);
const lookTarget = new THREE.Vector3(3.5, 1.2, 2.5);
const lookNow = lookTarget.clone();

// gridding (grid x -> 3D x, grid y -> 3D z)
window.onState = state => {
  if (!state) return;
  drawMinimap(state);

  // walls closing in
  const key = JSON.stringify(state.walls);
  if (key !== lastWalls) {
    lastWalls = key;
    wallGroup.clear();
    state.walls.forEach((row, y) => row.forEach((isWall, x) => {
      if (!isWall) return;
      const box = new THREE.Mesh(wallGeo, wallMat);
      box.position.set(x + 0.5, 1, y + 0.5);
      wallGroup.add(box);
    }));
  }

  scorchGroup.clear();
  for (const b of state.burns) {
    if (!state.fog[b.y][b.x]) continue; // can't see it, don't draw it
    const mark = new THREE.Mesh(scorchGeo, scorchMat);
    mark.rotation.x = -Math.PI / 2;                // lay it flat
    mark.position.set(b.x + 0.5, 0.01, b.y + 0.5); // just above the floor so it doesn't flicker
    scorchGroup.add(mark);
  }

  ammoGroup.clear();
  for (const k of state.pickups) {
    const gem = new THREE.Mesh(ammoGeo, ammoMat);
    gem.position.set(k.x + 0.5, 0.4, k.y + 0.5);
    ammoGroup.add(gem);
  }

  playerGroup.clear();
  for (const o of state.others) {
    if (!o.alive) {
      const body = new THREE.Mesh(playerGeo, deadMat);
      body.position.set(o.x + 0.5, 0.3, o.y + 0.5);
      body.rotation.z = Math.PI / 2; // lying down
      playerGroup.add(body);
      continue;
    }
    const mat = o.traitor ? traitorMat : o.ally ? allyMat : enemyMat;
    const body = new THREE.Mesh(playerGeo, mat);
    body.position.set(o.x + 0.5, 0.7, o.y + 0.5);
    const nose = new THREE.Mesh(noseGeo, mat);
    nose.position.set(o.x + 0.5 + o.fx * 0.35, 1.0, o.y + 0.5 + o.fy * 0.35);
    nose.lookAt(o.x + 0.5 + o.fx, 1.0, o.y + 0.5 + o.fy);
    playerGroup.add(body, nose);
    if (o.aiming) playerGroup.add(aimLine(o, state.walls)); // red line = they're about to shoot
  }

  // camera correcting
  const { x, y, fx, fy } = state.me;
  camTarget.set(x + 0.5, 1.2, y + 0.5);
  lookTarget.set(x + 0.5 + fx, 1.2, y + 0.5 + fy);
};

// red line from someone out to the first wall in front of them
function aimLine(p, walls) {
  let x = p.x, y = p.y;
  while (!walls[y + p.fy]?.[x + p.fx]) { x += p.fx; y += p.fy; }
  const pts = [
    new THREE.Vector3(p.x + 0.5, 1.0, p.y + 0.5),
    new THREE.Vector3(x + 0.5 + p.fx * 0.5, 1.0, y + 0.5 + p.fy * 0.5),
  ];
  return new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), aimMat);
}

function loop() {
  // slide 25% of the way there each frame = smooth movement and turning
  camera.position.lerp(camTarget, 0.25);
  lookNow.lerp(lookTarget, 0.25);
  camera.lookAt(lookNow);
  // spin the ammo so it looks like a pickup
  for (const gem of ammoGroup.children) gem.rotation.y += 0.03;
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}
loop();
