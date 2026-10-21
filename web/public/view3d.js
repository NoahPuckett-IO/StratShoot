import * as THREE from 'three';

const canvas = document.getElementById('three');
const renderer = new THREE.WebGLRenderer({ canvas });
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
const camera = new THREE.PerspectiveCamera(75, canvas.width / canvas.height, 0.1, 100);

// Lights so things aren't pitch black
scene.add(new THREE.AmbientLight(0xffffff, 0.6));
const sun = new THREE.DirectionalLight(0xffffff, 1);
sun.position.set(5, 10, 5);
scene.add(sun);

const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(100, 100),
    new THREE.MeshLambertMaterial({ color: 0x555555 })
);
floor.rotation.x = -Math.PI / 2;
scene.add(floor);

const wallGeo = new THREE.BoxGeometry(1, 2, 1);
const wallMat = new THREE.MeshLambertMaterial({ color: 0x996633 });
const playerGeo = new THREE.CapsuleGeometry(0.3, 0.8);
const aliveMat = new THREE.MeshLambertMaterial({ color: 0xff3333 });
const deadMat = new THREE.MeshLambertMaterial({ color: 0x222222 });

const wallGroup = new THREE.Group();
const playerGroup = new THREE.Group();
scene.add(wallGroup, playerGroup);
let lastWalls = '';

// Grid x -> 3D x, grid y -> 3D z. Each tile is 1x1.
window.onState = state => {
    if (!state) return;

    // Only rebuild walls when they change (the closing rings)
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

    playerGroup.clear();
    for (const o of state.others) {
        const body = new THREE.Mesh(playerGeo, o.alive ? aliveMat : deadMat);
        body.position.set(o.x + 0.5, o.alive ? 0.7 : 0.3, o.y + 0.5);
        if (!o.alive) body.rotation.z = Math.PI / 2;
        playerGroup.add(body);
    }

    // First person: eye height 1.2, looking the way you face
    const { x, y, fx, fy } = state.me;
    camera.position.set(x + 0.5, 1.2, y + 0.5);
    camera.lookAt(x + 0.5 + fx, 1.2, y + 0.5 + fy);
};

function loop() {
    renderer.render(scene, camera);
    requestAnimationFrame(loop);
}
loop();