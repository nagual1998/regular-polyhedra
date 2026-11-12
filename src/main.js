import * as THREE from "./vendor/three.module.js";

const canvas = document.querySelector("#polyhedra-canvas");

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0xf7f8fb, 0.018);
scene.add(new THREE.HemisphereLight(0xffffff, 0x697586, 2));
const keyLight = new THREE.DirectionalLight(0xffffff, 2.5);
keyLight.position.set(-3, 5, 8);
scene.add(keyLight);

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: true,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setClearColor(0x000000, 0);

const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
camera.position.set(0, 0, 14.5);

const rig = new THREE.Group();
scene.add(rig);
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const dragState = {
  active: false,
  mesh: null,
  pointerId: null,
  lastX: 0,
  lastY: 0,
};

const hitMaterial = new THREE.MeshBasicMaterial({
  transparent: true,
  opacity: 0,
  depthWrite: false,
});

const palette = [0x0077b6, 0xd18b00, 0x18864b, 0xc03a5b, 0x6f4bd8];
const polyhedra = [
  {
    name: "Tetrahedron",
    geometry: new THREE.TetrahedronGeometry(1.15, 0),
    position: [-5.8, 0.2, 0],
    color: palette[0],
    speed: 0.78,
  },
  {
    name: "Cube",
    geometry: new THREE.BoxGeometry(1.9, 1.9, 1.9),
    position: [-2.9, -0.05, 0],
    color: palette[1],
    speed: 0.62,
  },
  {
    name: "Octahedron",
    geometry: new THREE.OctahedronGeometry(1.35, 0),
    position: [0, 0.12, 0],
    color: palette[2],
    speed: 0.86,
  },
  {
    name: "Dodecahedron",
    geometry: new THREE.DodecahedronGeometry(1.32, 0),
    position: [2.9, 0.02, 0],
    color: palette[3],
    speed: 0.52,
  },
  {
    name: "Icosahedron",
    geometry: new THREE.IcosahedronGeometry(1.34, 0),
    position: [5.8, 0.1, 0],
    color: palette[4],
    speed: 0.7,
  },
];

const meshes = polyhedra.map((item) => {
  const edges = new THREE.EdgesGeometry(item.geometry);
  const lineMaterial = new THREE.LineBasicMaterial({
    color: item.color,
    transparent: true,
    opacity: 0.94,
  });
  const wire = new THREE.LineSegments(edges, lineMaterial);

  const glowMaterial = new THREE.MeshBasicMaterial({
    color: item.color,
    transparent: true,
    opacity: 0.06,
    wireframe: true,
  });
  const glow = new THREE.Mesh(item.geometry, glowMaterial);
  glow.scale.setScalar(1.04);

  const solid = new THREE.Mesh(item.geometry, new THREE.MeshStandardMaterial({
    color: item.color,
    roughness: 0.65,
    metalness: 0,
    flatShading: true,
  }));
  solid.visible = false;

  const hit = new THREE.Mesh(item.geometry, hitMaterial);
  hit.scale.setScalar(1.35);
  hit.userData.polyhedron = item.name;

  const group = new THREE.Group();
  group.name = item.name;
  group.position.set(...item.position);
  group.add(hit, glow, wire, solid);
  rig.add(group);

  return { ...item, active: false, group, hit, wire, glow, solid };
});

const modeControls = document.querySelectorAll("[data-display-mode]");
let focusedMesh = null;

function updateFocusLayout() {
  meshes.forEach((item) => {
    item.group.visible = focusedMesh === null || item === focusedMesh;
    item.group.position.set(...item.position);
    item.group.scale.setScalar(1);
  });
  if (focusedMesh) {
    focusedMesh.geometry.computeBoundingSphere();
    const halfFov = THREE.MathUtils.degToRad(camera.fov / 2);
    const limitingAngle = Math.min(halfFov, Math.atan(Math.tan(halfFov) * camera.aspect));
    const radius = focusedMesh.geometry.boundingSphere.radius * 1.04;
    const scale = camera.position.z * Math.sin(limitingAngle) * 0.55 / (radius * rig.scale.x);
    focusedMesh.group.position.set(0, 0, 0);
    focusedMesh.group.scale.setScalar(scale);
  }
  scene.updateMatrixWorld(true);
}

canvas.addEventListener("dblclick", (event) => {
  const item = findMeshAtPointer(event);
  if (!item) return;
  stopDrag();
  focusedMesh = focusedMesh === item ? null : item;
  updateFocusLayout();
  updateDebugState();
  event.preventDefault();
});

modeControls.forEach((control) => {
  control.addEventListener("click", () => {
    const solidMode = control.dataset.displayMode === "solid";
    meshes.forEach((item) => {
      item.solid.visible = solidMode;
      item.wire.visible = !solidMode;
      item.glow.visible = !solidMode;
    });
    modeControls.forEach((button) => {
      button.setAttribute("aria-pressed", String(button === control));
    });
  });
});

window.polyhedraDemo = {
  meshes,
};
const controls = document.querySelectorAll(".hud button[data-polyhedron]");

controls.forEach((control) => {
  control.addEventListener("click", () => {
    const mesh = meshes.find((item) => item.name === control.dataset.polyhedron);
    if (!mesh) return;

    mesh.active = !mesh.active;
    control.setAttribute("aria-pressed", String(mesh.active));
  });
});

function setPointerFromEvent(event) {
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
}

function findMeshAtPointer(event) {
  setPointerFromEvent(event);
  scene.updateMatrixWorld(true);
  camera.updateMatrixWorld(true);
  raycaster.setFromCamera(pointer, camera);

  const hits = raycaster.intersectObjects(
    meshes.filter((item) => item.group.visible).map((item) => item.hit),
    false,
  );
  const hit = hits[0];
  if (!hit) return null;

  return meshes.find((item) => item.name === hit.object.userData.polyhedron) ?? null;
}

function stopDrag() {
  dragState.active = false;
  dragState.mesh = null;
  dragState.pointerId = null;
  canvas.classList.remove("is-dragging");
}

canvas.addEventListener("pointerdown", (event) => {
  const mesh = findMeshAtPointer(event);
  if (!mesh) return;

  dragState.active = true;
  dragState.mesh = mesh;
  dragState.pointerId = event.pointerId;
  dragState.lastX = event.clientX;
  dragState.lastY = event.clientY;
  canvas.setPointerCapture(event.pointerId);
  canvas.classList.add("is-dragging");
  event.preventDefault();
});

canvas.addEventListener("pointermove", (event) => {
  if (!dragState.active || dragState.pointerId !== event.pointerId || !dragState.mesh) return;

  const dx = event.clientX - dragState.lastX;
  const dy = event.clientY - dragState.lastY;
  dragState.mesh.group.rotation.y += dx * 0.01;
  dragState.mesh.group.rotation.x += dy * 0.01;
  dragState.lastX = event.clientX;
  dragState.lastY = event.clientY;
  updateDebugState();
  event.preventDefault();
});

canvas.addEventListener("pointerup", stopDrag);
canvas.addEventListener("pointercancel", stopDrag);
const starGeometry = new THREE.BufferGeometry();
const starCount = 520;
const starPositions = new Float32Array(starCount * 3);

for (let i = 0; i < starCount; i += 1) {
  const i3 = i * 3;
  starPositions[i3] = THREE.MathUtils.randFloatSpread(26);
  starPositions[i3 + 1] = THREE.MathUtils.randFloatSpread(14);
  starPositions[i3 + 2] = THREE.MathUtils.randFloat(-13, -3);
}

starGeometry.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
const stars = new THREE.Points(
  starGeometry,
  new THREE.PointsMaterial({
    color: 0x9aa3af,
    size: 0.018,
    transparent: true,
    opacity: 0.42,
  }),
);
scene.add(stars);

function resize() {
  const { innerWidth: width, innerHeight: height } = window;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.position.z = width < 760 ? 18.5 : 14.5;
  camera.position.y = 0;
  camera.updateProjectionMatrix();

  const compactScale = width < 760 ? 0.72 : 1;
  rig.scale.setScalar(compactScale);
  updateFocusLayout();
}

window.addEventListener("resize", resize);
resize();

function updateDebugState() {
  canvas.dataset.polyhedraPositions = JSON.stringify(
    meshes.map((item) => ({
      name: item.name,
      position: item.group.position.toArray(),
      active: item.active,
      visible: item.group.visible,
      focused: item === focusedMesh,
      rotation: [item.group.rotation.x, item.group.rotation.y, item.group.rotation.z],
      screen: item.group.getWorldPosition(new THREE.Vector3()).project(camera).toArray(),
    })),
  );
}
const clock = new THREE.Clock();

function animate() {
  const delta = clock.getDelta();
  const elapsed = clock.elapsedTime;

  stars.rotation.y = elapsed * 0.018;

  meshes.forEach((item) => {
    if (!item.active) return;

    item.group.rotation.x += delta * item.speed;
    item.group.rotation.y += delta * (item.speed * 0.82);
    item.group.rotation.z += delta * (item.speed * 0.46);
  });

  updateDebugState();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

animate();













