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
  startX: 0,
  startY: 0,
  moved: false,
};
let faceClick = null;

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
    geometry: new THREE.BoxGeometry(...Array(3).fill(2 * 1.32 / Math.sqrt(3))),
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

function createDualGeometry(geometry) {
  const positions = geometry.attributes.position;
  const index = geometry.index;
  const faces = [];
  const edges = new Map();
  const key = (v) => v.toArray().map((n) => Math.round(n * 1e5)).join(",");
  const count = index ? index.count : positions.count;

  // Merge coplanar triangles into polygon faces before finding adjacency.
  for (let i = 0; i < count; i += 3) {
    const vertices = [0, 1, 2].map((offset) => new THREE.Vector3().fromBufferAttribute(
      positions, index ? index.getX(i + offset) : i + offset,
    ));
    const normal = new THREE.Vector3().subVectors(vertices[1], vertices[0])
      .cross(new THREE.Vector3().subVectors(vertices[2], vertices[0])).normalize();
    const distance = normal.dot(vertices[0]);
    let faceId = faces.findIndex((face) => face.normal.distanceTo(normal) < 1e-5
      && Math.abs(face.distance - distance) < 1e-5);
    if (faceId < 0) {
      faceId = faces.length;
      faces.push({ normal, distance, vertices: new Map(), triangles: [], triangleIds: [] });
    }
    faces[faceId].triangles.push(...vertices);
    faces[faceId].triangleIds.push(i / 3);
    vertices.forEach((v, j) => {
      faces[faceId].vertices.set(key(v), v);
      const edgeKey = [key(v), key(vertices[(j + 1) % 3])].sort().join("|");
      if (!edges.has(edgeKey)) edges.set(edgeKey, new Set());
      edges.get(edgeKey).add(faceId);
    });
  }
  const centers = faces.map((face) => {
    const center = new THREE.Vector3();
    face.vertices.forEach((v) => center.add(v));
    return center.divideScalar(face.vertices.size);
  });
  const points = [];
  edges.forEach((neighbors) => {
    if (neighbors.size !== 2) return;
    const [a, b] = [...neighbors];
    points.push(centers[a], centers[b]);
  });
  const dualGeometry = new THREE.BufferGeometry().setFromPoints(points);
  dualGeometry.userData.faceCount = faces.length;
  dualGeometry.userData.faceCenters = centers;
  dualGeometry.userData.faces = faces;
  return dualGeometry;
}

function getOrderedFaceVertices(face) {
  const vertices = [...face.vertices.values()];
  const center = vertices.reduce((sum, v) => sum.add(v), new THREE.Vector3())
    .divideScalar(vertices.length);
  const u = vertices[0].clone().sub(center).normalize();
  const v = new THREE.Vector3().crossVectors(face.normal, u);
  const angle = (point) => {
    const offset = point.clone().sub(center);
    return Math.atan2(offset.dot(v), offset.dot(u));
  };
  // Sort polygon corners so triangulation diagonals never become edges.
  vertices.sort((a, b) => angle(a) - angle(b));
  return vertices;
}

function createDiagonalGeometry(faces) {
  const segments = [];
  // Box corners of equal sign parity form a tetrahedron. The eight
  // equal-coordinate-magnitude dodecahedron corners form an inscribed cube.
  const isSelectedVertex = faces.length === 6
    ? (point) => point.x * point.y * point.z > 0
    : (point) => Math.abs(Math.abs(point.x) - Math.abs(point.y)) < 1e-5
      && Math.abs(Math.abs(point.y) - Math.abs(point.z)) < 1e-5;
  faces.forEach((face) => {
    if (face.vertices.size < 4) return;
    const vertices = [...face.vertices.values()].filter(isSelectedVertex);
    if (vertices.length !== 2) throw new Error("Expected one inscribed edge per face");
    segments.push(...vertices);
  });
  return new THREE.BufferGeometry().setFromPoints(segments);
}

function createMidpointGeometry(faces) {
  const segments = [];
  faces.forEach((face) => {
    const vertices = getOrderedFaceVertices(face);
    const midpoints = vertices.map((point, i) => point.clone()
      .add(vertices[(i + 1) % vertices.length]).multiplyScalar(0.5));
    midpoints.forEach((point, i) => {
      segments.push(point, midpoints[(i + 1) % midpoints.length]);
    });
  });
  return new THREE.BufferGeometry().setFromPoints(segments);
}

function createProjectionPoints(geometry, edgeGeometry, faceCenters) {
  const { center, radius } = geometry.boundingSphere;
  const group = new THREE.Group();
  const markerGeometry = new THREE.SphereGeometry(radius * 0.0125, 12, 8);
  const edgeMaterial = new THREE.MeshBasicMaterial({ color: 0xc93620 });
  const faceMaterial = new THREE.MeshBasicMaterial({ color: 0x124bd1 });
  const vertexMaterial = new THREE.MeshBasicMaterial({ color: 0x00834a });
  const addPoint = (source, material) => {
    const point = new THREE.Mesh(markerGeometry, material);
    point.position.copy(source).sub(center).normalize().multiplyScalar(radius).add(center);
    group.add(point);
  };
  const positions = edgeGeometry.attributes.position;
  for (let i = 0; i < positions.count; i += 2) {
    const midpoint = new THREE.Vector3().fromBufferAttribute(positions, i)
      .add(new THREE.Vector3().fromBufferAttribute(positions, i + 1)).multiplyScalar(0.5);
    addPoint(midpoint, edgeMaterial);
  }
  faceCenters.forEach((centerPoint) => addPoint(centerPoint, faceMaterial));
  const seenVertices = new Set();
  const vertices = geometry.attributes.position;
  for (let i = 0; i < vertices.count; i += 1) {
    const vertex = new THREE.Vector3().fromBufferAttribute(vertices, i);
    const key = vertex.toArray().map((value) => Math.round(value * 1e5)).join(",");
    if (seenVertices.has(key)) continue;
    seenVertices.add(key);
    const point = new THREE.Mesh(markerGeometry, vertexMaterial);
    point.position.copy(vertex);
    group.add(point);
  }
  group.userData.pointCounts = { edges: positions.count / 2, faces: faceCenters.length, vertices: seenVertices.size };
  group.visible = false;
  return group;
}

function createEdgeVisibility(geometry, edges) {
  const positions = geometry.attributes.position;
  const index = geometry.index;
  const planes = [];
  for (let i = 0; i < (index ? index.count : positions.count); i += 3) {
    const vertices = [0, 1, 2].map((j) => new THREE.Vector3().fromBufferAttribute(
      positions, index ? index.getX(i + j) : i + j,
    ));
    const plane = new THREE.Plane().setFromCoplanarPoints(...vertices);
    if (!planes.some((p) => p.normal.distanceTo(plane.normal) < 1e-5
      && Math.abs(p.constant - plane.constant) < 1e-5)) planes.push(plane);
  }
  const segments = [];
  const endpoints = edges.attributes.position;
  for (let i = 0; i < endpoints.count; i += 2) {
    const a = new THREE.Vector3().fromBufferAttribute(endpoints, i);
    const b = new THREE.Vector3().fromBufferAttribute(endpoints, i + 1);
    segments.push({ a, b, planes: planes.filter((p) =>
      Math.abs(p.distanceToPoint(a)) < 1e-5 && Math.abs(p.distanceToPoint(b)) < 1e-5) });
  }
  return segments;
}

const meshes = polyhedra.map((item) => {
  const edges = new THREE.EdgesGeometry(item.geometry);
  const lineMaterial = new THREE.LineBasicMaterial({
    color: item.color,
    transparent: true,
    opacity: 0.94,
  });
  const visibleEdges = new THREE.BufferGeometry();
  visibleEdges.setAttribute("position", new THREE.BufferAttribute(
    new Float32Array(edges.attributes.position.array.length), 3,
  ).setUsage(THREE.DynamicDrawUsage));
  visibleEdges.setDrawRange(0, 0);
  const wire = new THREE.LineSegments(visibleEdges, lineMaterial);
  wire.frustumCulled = false;
  const faintWire = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({
    color: item.color, transparent: true, opacity: 0.18, depthWrite: false,
  }));
  faintWire.renderOrder = 1;
  wire.renderOrder = 2;
  const edgeVisibility = createEdgeVisibility(item.geometry, edges);

  const solid = new THREE.Mesh(item.geometry, new THREE.MeshStandardMaterial({
    color: item.color,
    roughness: 0.65,
    metalness: 0,
    flatShading: true,
  }));
  solid.visible = false;

  item.geometry.computeBoundingSphere();
  const bounds = item.geometry.boundingSphere;
  const circumsphere = new THREE.Mesh(
    new THREE.SphereGeometry(bounds.radius, 64, 32),
    new THREE.MeshStandardMaterial({
      color: item.color,
      transparent: true,
      opacity: 0.16,
      roughness: 0.45,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  circumsphere.position.copy(bounds.center);
  circumsphere.visible = false;

  const dual = new THREE.LineSegments(createDualGeometry(item.geometry),
    new THREE.LineBasicMaterial({ color: 0x20242b, depthTest: false, depthWrite: false, transparent: true }));
  dual.renderOrder = 10;
  dual.visible = false;
  const midpointPolyhedron = new THREE.LineSegments(
    createMidpointGeometry(dual.geometry.userData.faces),
    new THREE.LineBasicMaterial({ color: 0x006b68, depthTest: false, depthWrite: false, transparent: true }),
  );
  midpointPolyhedron.renderOrder = 11;
  midpointPolyhedron.visible = false;
  const diagonals = new THREE.LineSegments(
    createDiagonalGeometry(dual.geometry.userData.faces),
    new THREE.LineBasicMaterial({ color: 0x20242b, depthTest: false, depthWrite: false, transparent: true }),
  );
  diagonals.renderOrder = 12;
  diagonals.visible = false;
  const faceOverlays = dual.geometry.userData.faces.map((face) => {
    const faceGeometry = new THREE.BufferGeometry().setFromPoints(face.triangles);
    faceGeometry.computeVertexNormals();
    const overlay = new THREE.Mesh(faceGeometry, new THREE.MeshStandardMaterial({
      color: 0xff00cc, roughness: 0.65, flatShading: true,
      side: THREE.DoubleSide,
      polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
    }));
    overlay.visible = false;
    overlay.userData.triangleIds = face.triangleIds;
    return overlay;
  });
  const projections = createProjectionPoints(item.geometry, edges, dual.geometry.userData.faceCenters);

  const hit = new THREE.Mesh(item.geometry, hitMaterial);
  hit.scale.setScalar(1.35);
  hit.userData.polyhedron = item.name;

  const group = new THREE.Group();
  group.name = item.name;
  group.position.set(...item.position);
  group.add(hit, faintWire, wire, solid, circumsphere, dual, midpointPolyhedron, diagonals, projections, ...faceOverlays);
  rig.add(group);

  return { ...item, active: false, group, hit, wire, faintWire, edgeVisibility, solid, circumsphere, dual, midpointPolyhedron, diagonals, projections, faceOverlays };
});

document.querySelectorAll("[data-diagonal-polyhedron]").forEach((control) => {
  const item = meshes.find((mesh) => mesh.name === control.dataset.diagonalPolyhedron);
  control.addEventListener("click", () => {
    item.diagonals.visible = !item.diagonals.visible;
    control.setAttribute("aria-pressed", String(item.diagonals.visible));
  });
});

const midpointControl = document.querySelector("#toggle-midpoints");
let midpointsVisible = false;
midpointControl.addEventListener("click", () => {
  midpointsVisible = !midpointsVisible;
  meshes.forEach((item) => { item.midpointPolyhedron.visible = midpointsVisible; });
  midpointControl.setAttribute("aria-pressed", String(midpointsVisible));
});

const projectionControl = document.querySelector("#toggle-projections");
let projectionsVisible = false;
projectionControl.addEventListener("click", () => {
  projectionsVisible = !projectionsVisible;
  meshes.forEach((item) => { item.projections.visible = projectionsVisible; });
  projectionControl.setAttribute("aria-pressed", String(projectionsVisible));
  updateProjectionLegend();
});

const dualControl = document.querySelector("#toggle-duals");
let dualsVisible = false;
dualControl.addEventListener("click", () => {
  dualsVisible = !dualsVisible;
  meshes.forEach((item) => { item.dual.visible = dualsVisible; });
  dualControl.setAttribute("aria-pressed", String(dualsVisible));
});

const sphereControl = document.querySelector("#toggle-spheres");
let spheresVisible = false;
sphereControl.addEventListener("click", () => {
  spheresVisible = !spheresVisible;
  meshes.forEach((item) => { item.circumsphere.visible = spheresVisible; });
  sphereControl.setAttribute("aria-pressed", String(spheresVisible));
});

const modeControls = document.querySelectorAll("[data-display-mode]");
document.querySelector("#reset-colors").addEventListener("click", () => {
  if (faceClick) {
    clearTimeout(faceClick.timer);
    faceClick = null;
  }
  meshes.forEach((item) => {
    item.faceOverlays.forEach((face) => { face.visible = false; });
    item.solid.visible = false;
    item.wire.visible = true;
    item.faintWire.visible = true;
  });
  modeControls.forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.displayMode === "wire"));
  });
});
let focusedMesh = null;
const projectionLegend = document.querySelector("#projection-legend");
const countLabels = projectionLegend.querySelectorAll("[data-point-count]");

function updateProjectionLegend() {
  projectionLegend.hidden = !projectionsVisible;
  const counts = projectionsVisible && focusedMesh?.projections.userData.pointCounts;
  countLabels.forEach((label) => {
    label.hidden = !counts;
    label.textContent = counts ? `${counts[label.dataset.pointCount]}個` : "";
  });
}

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
    const scale = camera.position.z * Math.sin(limitingAngle) * 0.66 / (radius * rig.scale.x);
    focusedMesh.group.position.set(0, 0, 0);
    focusedMesh.group.scale.setScalar(scale);
  }
  scene.updateMatrixWorld(true);
}

canvas.addEventListener("dblclick", (event) => {
  if (faceClick) {
    clearTimeout(faceClick.timer);
    if (faceClick.applied) faceClick.overlay.visible = faceClick.previous;
    faceClick = null;
  }
  const item = findMeshAtPointer(event);
  if (!item) return;
  stopDrag();
  focusedMesh = focusedMesh === item ? null : item;
  updateProjectionLegend();
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
      item.faintWire.visible = !solidMode;
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
  if (event.button !== 0 || dragState.active) return;
  const mesh = findMeshAtPointer(event);
  if (!mesh) return;

  dragState.active = true;
  dragState.mesh = mesh;
  dragState.pointerId = event.pointerId;
  dragState.lastX = event.clientX;
  dragState.lastY = event.clientY;
  dragState.startX = event.clientX;
  dragState.startY = event.clientY;
  dragState.moved = false;
  canvas.setPointerCapture(event.pointerId);
  canvas.classList.add("is-dragging");
  event.preventDefault();
});

canvas.addEventListener("pointermove", (event) => {
  if (!dragState.active || dragState.pointerId !== event.pointerId || !dragState.mesh) return;

  if (Math.hypot(event.clientX - dragState.startX, event.clientY - dragState.startY) > 5) {
    dragState.moved = true;
  }
  if (!dragState.moved) return;

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

canvas.addEventListener("click", (event) => {
  if (event.button !== 0 || dragState.moved || event.detail > 1) return;
  // Raycast the actual surface, not the enlarged drag target.
  setPointerFromEvent(event);
  scene.updateMatrixWorld(true);
  camera.updateMatrixWorld(true);
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObjects(meshes.filter((item) => item.group.visible)
    .map((item) => item.solid), false)[0];
  if (!hit) return;
  const item = meshes.find((item) => item.solid === hit.object);
  const overlay = item.faceOverlays.find((face) => face.userData.triangleIds.includes(hit.faceIndex));
  if (!overlay) return;
  if (faceClick) {
    clearTimeout(faceClick.timer);
    if (!faceClick.applied) faceClick.overlay.visible = !faceClick.previous;
  }
  const selection = { overlay, previous: overlay.visible, applied: false };
  selection.timer = setTimeout(() => {
    overlay.visible = !selection.previous;
    selection.applied = true;
  }, 350);
  faceClick = selection;
});

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

  meshes.forEach((item) => {
    if (!item.active) return;

    item.group.rotation.x += delta * item.speed;
    item.group.rotation.y += delta * (item.speed * 0.82);
    item.group.rotation.z += delta * (item.speed * 0.46);
  });

  scene.updateMatrixWorld(true);
  camera.updateMatrixWorld(true);
  meshes.forEach((item) => {
    if (!item.group.visible || !item.wire.visible) return;
    const eye = item.group.worldToLocal(camera.getWorldPosition(new THREE.Vector3()));
    const positions = item.wire.geometry.attributes.position;
    let count = 0;
    // A convex polyhedron edge is visible when either adjacent face faces the eye.
    item.edgeVisibility.forEach(({ a, b, planes }) => {
      if (!planes.some((plane) => plane.distanceToPoint(eye) > 1e-6)) return;
      positions.setXYZ(count++, a.x, a.y, a.z);
      positions.setXYZ(count++, b.x, b.y, b.z);
    });
    positions.needsUpdate = true;
    item.wire.geometry.setDrawRange(0, count);
  });
  updateDebugState();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

animate();













