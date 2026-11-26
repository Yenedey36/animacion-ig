import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import * as TWEEN from "@tweenjs/tween.js";
import Ammo from "ammojs-typed";
import { GUI } from "lil-gui";

let camera, controls, scene, renderer;
const clock = new THREE.Clock();

let physicsWorld;
const gravityConstant = 12.0;
const margin = 0.04;
const rigidBodies = [];

let transformAux1, tmpVec, tmpQuat, tmpTrans;
let pinShape, ballShape;

const pins = [];
const balls = [];
let previewBall, aimArrow;
let sweeperMesh, sweeperBody;
let obstacleMesh, obstacleBody, obstacleTween;
let neonArches = [];

let isResetting = false;
let activeCamTweens = [];
let strikeTriggered = false;
let knockedCount = 0;

let hudScore;
const upVec = new THREE.Vector3();

const state = {
  posX: 0,
  angulo: 0,
  potencia: 25,
  efecto: 0,
  obstaculo: false,
  camaraDinamica: true,
  lanzar: () => launchBall(),
  reiniciar: () => resetPinsSequence(),
  vistaInicial: () => tweenCameraTo(0, 4.4, 16.5, 0, 0.8, -5, 800),
};

const pinPositions = [
  [0, -9.5],
  [-0.58, -10.5], [0.58, -10.5],
  [-1.16, -11.5], [0, -11.5], [1.16, -11.5],
  [-1.74, -12.5], [-0.58, -12.5], [0.58, -12.5], [1.74, -12.5],
];

let pinMaterial, ballMaterial;

Ammo(Ammo).then(start);

function start() {
  initGraphics();
  initHUD();
  initGUI();
  initPhysics();
  createAlley();
  createSweeperAndObstacle();
  createAimHelpers();
  spawnPinsImmediate();
  initInput();
  animationLoop();
}

function initGraphics() {
  // Limpia posibles elementos previos del body y quita margenes/scroll
  Array.from(document.body.children).forEach((el) => {
    if (el.tagName !== "SCRIPT") el.remove();
  });
  document.documentElement.style.margin = "0";
  document.documentElement.style.padding = "0";
  document.body.style.margin = "0";
  document.body.style.padding = "0";
  document.body.style.overflow = "hidden";
  document.body.style.background = "#090b16";

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x090b16);
  scene.fog = new THREE.FogExp2(0x090b16, 0.018);

  camera = new THREE.PerspectiveCamera(
    55,
    window.innerWidth / window.innerHeight,
    0.2,
    200
  );
  camera.position.set(0, 4.4, 16.5);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.style.display = "block";
  document.body.appendChild(renderer.domElement);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0.8, -5);
  controls.enableDamping = true;
  controls.maxPolarAngle = Math.PI * 0.48;
  controls.update();

  controls.addEventListener("start", stopCameraTweens);

  const hemiLight = new THREE.HemisphereLight(0xaaccff, 0x1a1428, 0.7);
  scene.add(hemiLight);

  const dirLight = new THREE.DirectionalLight(0xffffff, 1.15);
  dirLight.position.set(6, 16, 10);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.set(2048, 2048);
  dirLight.shadow.camera.left = -10;
  dirLight.shadow.camera.right = 10;
  dirLight.shadow.camera.top = 18;
  dirLight.shadow.camera.bottom = -18;
  dirLight.shadow.camera.near = 2;
  dirLight.shadow.camera.far = 45;
  scene.add(dirLight);

  const pinSpot = new THREE.PointLight(0xfff0dd, 1.4, 18);
  pinSpot.position.set(0, 5.5, -10.5);
  scene.add(pinSpot);

  const neonCyan = new THREE.PointLight(0x00f0ff, 1.1, 22);
  neonCyan.position.set(-4, 3, 2);
  scene.add(neonCyan);

  const neonMagenta = new THREE.PointLight(0xff00aa, 1.1, 22);
  neonMagenta.position.set(4, 3, -6);
  scene.add(neonMagenta);

  pinMaterial = new THREE.MeshStandardMaterial({
    map: createPinTexture(),
    roughness: 0.25,
    metalness: 0.05,
  });

  ballMaterial = new THREE.MeshStandardMaterial({
    map: createBallTexture(),
    roughness: 0.15,
    metalness: 0.35,
  });

  window.addEventListener("resize", onWindowResize);
}

function initHUD() {
  hudScore = document.createElement("div");
  hudScore.style.position = "absolute";
  hudScore.style.top = "10px";
  hudScore.style.left = "10px";
  hudScore.style.zIndex = "10";
  hudScore.style.color = "#f0f0f0";
  hudScore.style.fontFamily = "monospace";
  hudScore.style.fontSize = "13px";
  hudScore.style.backgroundColor = "rgba(0, 0, 0, 0.55)";
  hudScore.style.padding = "7px 10px";
  hudScore.style.userSelect = "none";
  hudScore.innerHTML =
    '<div id="pins-count">Bolos: 0 / 10</div>' +
    '<div style="font-size:11px;color:#b0b0b0;margin-top:4px;">A/D mover | Q/E angulo<br>Espacio lanzar | R reiniciar</div>';
  document.body.appendChild(hudScore);
}

function initGUI() {
    const gui = new GUI({ title: "Controles" });
    gui.domElement.style.position = "absolute";
    gui.domElement.style.top = "10px";
    gui.domElement.style.right = "10px";
    gui.domElement.style.maxHeight = "none";
    gui.domElement.style.overflow = "visible";
    gui.domElement.style.opacity = "0.98";
    gui.domElement.style.zIndex = "20";
    gui.domElement.style.setProperty("--background-color", "rgba(31, 31, 31, 0.92)");
  
    gui.add(state, "posX", -1.8, 1.8, 0.05).name("Posición X").listen().onChange(updateAimHelpers);
    gui.add(state, "angulo", -14, 14, 0.5).name("Ángulo").listen().onChange(updateAimHelpers);
    gui.add(state, "potencia", 16, 36, 1).name("Potencia").onChange(updateAimHelpers);
    gui.add(state, "efecto", -15, 15, 1).name("Efecto");
    gui.add(state, "obstaculo").name("Obstáculo móvil").onChange(toggleObstacle);
    gui.add(state, "camaraDinamica").name("Cámara dinámica");
    gui.add(state, "lanzar").name("Lanzar [Espacio]");
    gui.add(state, "reiniciar").name("Reiniciar [R]");
    gui.add(state, "vistaInicial").name("Reset cámara [V]");
  }

function initPhysics() {
  const collisionConfiguration = new Ammo.btDefaultCollisionConfiguration();
  const dispatcher = new Ammo.btCollisionDispatcher(collisionConfiguration);
  const broadphase = new Ammo.btDbvtBroadphase();
  const solver = new Ammo.btSequentialImpulseConstraintSolver();

  physicsWorld = new Ammo.btDiscreteDynamicsWorld(
    dispatcher,
    broadphase,
    solver,
    collisionConfiguration
  );
  physicsWorld.setGravity(new Ammo.btVector3(0, -gravityConstant, 0));

  transformAux1 = new Ammo.btTransform();
  tmpVec = new Ammo.btVector3(0, 0, 0);
  tmpQuat = new Ammo.btQuaternion(0, 0, 0, 1);
  tmpTrans = new Ammo.btTransform();

  pinShape = new Ammo.btCylinderShape(new Ammo.btVector3(0.19, 0.75, 0.19));
  pinShape.setMargin(margin);

  ballShape = new Ammo.btSphereShape(0.45);
  ballShape.setMargin(margin);
}

function createWoodTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 1024;
  const ctx = canvas.getContext("2d");

  const planks = 16;
  const pw = canvas.width / planks;
  for (let i = 0; i < planks; i++) {
    const shade = 168 + ((i * 19) % 28);
    ctx.fillStyle = `rgb(${shade}, ${Math.floor(shade * 0.72)}, ${Math.floor(shade * 0.42)})`;
    ctx.fillRect(i * pw, 0, pw, canvas.height);
    ctx.strokeStyle = "rgba(65, 35, 10, 0.35)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(i * pw, 0);
    ctx.lineTo(i * pw, canvas.height);
    ctx.stroke();
  }

  ctx.fillStyle = "#111";
  ctx.fillRect(0, canvas.height * 0.84, canvas.width, 10);
  ctx.fillStyle = "#ff00aa";
  ctx.fillRect(0, canvas.height * 0.84 + 3, canvas.width, 4);

  ctx.fillStyle = "#1b1e2e";
  const arrowY = canvas.height * 0.68;
  for (let i = -2; i <= 2; i++) {
    const cx = canvas.width * 0.5 + i * 70;
    const cy = arrowY + Math.abs(i) * 18;
    ctx.beginPath();
    ctx.moveTo(cx, cy - 28);
    ctx.lineTo(cx - 12, cy + 12);
    ctx.lineTo(cx + 12, cy + 12);
    ctx.closePath();
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 8;
  return tex;
}

function createPinTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#f4f2ec";
  ctx.fillRect(0, 0, 256, 256);

  ctx.fillStyle = "#d91636";
  ctx.fillRect(0, 62, 256, 16);
  ctx.fillRect(0, 88, 256, 16);

  return new THREE.CanvasTexture(canvas);
}

function createBallTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");

  const grad = ctx.createLinearGradient(0, 0, 512, 256);
  grad.addColorStop(0, "#1428a0");
  grad.addColorStop(0.5, "#6a11cb");
  grad.addColorStop(1, "#00d2ff");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 256);

  ctx.fillStyle = "rgba(255, 255, 255, 0.14)";
  for (let i = 0; i < 12; i++) {
    ctx.beginPath();
    ctx.arc((i * 53) % 512, (i * 37) % 256, 28, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = "#080910";
  const holes = [[240, 110, 10], [272, 110, 10], [256, 148, 13]];
  for (const [x, y, r] of holes) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  return new THREE.CanvasTexture(canvas);
}

function createAlley() {
  const q = new THREE.Quaternion();

  const laneMat = new THREE.MeshStandardMaterial({
    map: createWoodTexture(),
    roughness: 0.22,
    metalness: 0.08,
  });
  const lane = createStaticBox(4.6, 1.0, 30, new THREE.Vector3(0, -0.5, 0), q, laneMat, 0.18, 0.2);
  lane.receiveShadow = true;

  const gutterMat = new THREE.MeshStandardMaterial({ color: 0x181c2e, roughness: 0.6 });
  createStaticBox(0.9, 0.5, 30, new THREE.Vector3(-2.75, -0.52, 0), q, gutterMat, 0.3, 0.2);
  createStaticBox(0.9, 0.5, 30, new THREE.Vector3(2.75, -0.52, 0), q, gutterMat, 0.3, 0.2);

  const railMat = new THREE.MeshStandardMaterial({ color: 0x101424, roughness: 0.4, metalness: 0.5 });
  createStaticBox(0.5, 1.4, 31, new THREE.Vector3(-3.45, 0.1, 0), q, railMat, 0.2, 0.5);
  createStaticBox(0.5, 1.4, 31, new THREE.Vector3(3.45, 0.1, 0), q, railMat, 0.2, 0.5);

  const backMat = new THREE.MeshStandardMaterial({ color: 0x14172b, roughness: 0.8 });
  createStaticBox(7.4, 4.5, 0.8, new THREE.Vector3(0, 1.5, -15.4), q, backMat, 0.8, 0.1);

  const cyanMat = new THREE.MeshStandardMaterial({ color: 0x00f0ff, emissive: 0x00f0ff, emissiveIntensity: 1.5 });
  const magMat = new THREE.MeshStandardMaterial({ color: 0xff00aa, emissive: 0xff00aa, emissiveIntensity: 1.5 });

  const stripGeo = new THREE.BoxGeometry(0.08, 0.08, 30);
  const leftStrip = new THREE.Mesh(stripGeo, cyanMat);
  leftStrip.position.set(-3.18, 0.78, 0);
  scene.add(leftStrip);

  const rightStrip = new THREE.Mesh(stripGeo, magMat);
  rightStrip.position.set(3.18, 0.78, 0);
  scene.add(rightStrip);

  const archZ = [8, 1, -6, -13.5];
  archZ.forEach((z, idx) => {
    const group = new THREE.Group();
    const color = idx % 2 === 0 ? 0x00f0ff : 0xff00aa;
    const mat = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 1.2,
    });

    const leftPost = new THREE.Mesh(new THREE.BoxGeometry(0.14, 4.8, 0.14), mat);
    leftPost.position.set(-3.45, 2.4, z);
    const rightPost = new THREE.Mesh(new THREE.BoxGeometry(0.14, 4.8, 0.14), mat);
    rightPost.position.set(3.45, 2.4, z);
    const topBar = new THREE.Mesh(new THREE.BoxGeometry(7.04, 0.14, 0.14), mat);
    topBar.position.set(0, 4.8, z);

    group.add(leftPost, rightPost, topBar);
    scene.add(group);
    neonArches.push(mat);
  });

  const header = new THREE.Mesh(
    new THREE.BoxGeometry(7.0, 1.5, 0.5),
    new THREE.MeshStandardMaterial({ color: 0x161a30, roughness: 0.4, metalness: 0.6 })
  );
  header.position.set(0, 3.8, -14.8);
  scene.add(header);
}

function createSweeperAndObstacle() {
  const sweeperGeo = new THREE.BoxGeometry(4.9, 0.45, 0.35);
  const sweeperMat = new THREE.MeshStandardMaterial({
    color: 0x222638,
    emissive: 0x00d2ff,
    emissiveIntensity: 0.35,
    metalness: 0.7,
    roughness: 0.25,
  });
  sweeperMesh = new THREE.Mesh(sweeperGeo, sweeperMat);
  sweeperMesh.position.set(0, 2.6, -8.0);
  sweeperMesh.castShadow = true;
  scene.add(sweeperMesh);

  const sweeperShape = new Ammo.btBoxShape(new Ammo.btVector3(2.45, 0.225, 0.175));
  sweeperShape.setMargin(margin);
  sweeperBody = createKinematicBody(sweeperMesh, sweeperShape);

  const obsGeo = new THREE.BoxGeometry(1.4, 0.55, 0.35);
  const obsMat = new THREE.MeshStandardMaterial({
    color: 0xff00aa,
    emissive: 0xff00aa,
    emissiveIntensity: 0.9,
    roughness: 0.2,
  });
  obstacleMesh = new THREE.Mesh(obsGeo, obsMat);
  obstacleMesh.position.set(0, -1.5, -2.5);
  obstacleMesh.castShadow = true;
  scene.add(obstacleMesh);

  const obsShape = new Ammo.btBoxShape(new Ammo.btVector3(0.7, 0.275, 0.175));
  obsShape.setMargin(margin);
  obstacleBody = createKinematicBody(obstacleMesh, obsShape);
}

function toggleObstacle(enabled) {
  if (obstacleTween) {
    obstacleTween.stop();
    obstacleTween = null;
  }

  if (enabled) {
    const startPos = { x: obstacleMesh.position.x, y: obstacleMesh.position.y };
    new TWEEN.Tween(startPos)
      .to({ x: -1.5, y: 0.32 }, 550)
      .easing(TWEEN.Easing.Back.Out)
      .onUpdate(() => setKinematicPosition(obstacleMesh, obstacleBody, startPos.x, startPos.y, -2.5))
      .onComplete(() => {
        if (!state.obstaculo) return;
        const slide = { x: -1.5 };
        obstacleTween = new TWEEN.Tween(slide)
          .to({ x: 1.5 }, 1400)
          .easing(TWEEN.Easing.Sinusoidal.InOut)
          .yoyo(true)
          .repeat(Infinity)
          .onUpdate(() => setKinematicPosition(obstacleMesh, obstacleBody, slide.x, 0.32, -2.5))
          .start();
      })
      .start();
  } else {
    const down = { x: obstacleMesh.position.x, y: obstacleMesh.position.y };
    new TWEEN.Tween(down)
      .to({ x: 0, y: -1.5 }, 450)
      .easing(TWEEN.Easing.Cubic.In)
      .onUpdate(() => setKinematicPosition(obstacleMesh, obstacleBody, down.x, down.y, -2.5))
      .start();
  }
}

function createAimHelpers() {
  previewBall = new THREE.Mesh(new THREE.SphereGeometry(0.45, 24, 24), ballMaterial);
  previewBall.castShadow = true;
  scene.add(previewBall);

  aimArrow = new THREE.Group();
  const shaft = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.02, 2.8),
    new THREE.MeshBasicMaterial({ color: 0x00f0ff, transparent: true, opacity: 0.85 })
  );
  shaft.position.set(0, 0.04, -1.6);

  const head = new THREE.Mesh(
    new THREE.ConeGeometry(0.2, 0.5, 12),
    new THREE.MeshBasicMaterial({ color: 0x00f0ff })
  );
  head.rotation.x = -Math.PI / 2;
  head.position.set(0, 0.04, -3.2);

  aimArrow.add(shaft, head);
  scene.add(aimArrow);

  updateAimHelpers();
}

function updateAimHelpers() {
  previewBall.position.set(state.posX, 0.45, 11.4);
  aimArrow.position.set(state.posX, 0, 11.4);
  aimArrow.rotation.y = THREE.MathUtils.degToRad(-state.angulo);
  const scaleZ = THREE.MathUtils.mapLinear(state.potencia, 16, 36, 0.65, 1.35);
  aimArrow.scale.set(1, 1, scaleZ);
}

function createPinGeometry() {
  const pts = [
    new THREE.Vector2(0.0, -0.75),
    new THREE.Vector2(0.14, -0.75),
    new THREE.Vector2(0.18, -0.55),
    new THREE.Vector2(0.24, -0.25),
    new THREE.Vector2(0.22, 0.05),
    new THREE.Vector2(0.12, 0.35),
    new THREE.Vector2(0.11, 0.48),
    new THREE.Vector2(0.15, 0.62),
    new THREE.Vector2(0.12, 0.72),
    new THREE.Vector2(0.0, 0.75),
  ];
  return new THREE.LatheGeometry(pts, 18);
}

const pinGeometry = createPinGeometry();

function spawnPinsImmediate() {
  clearDynamicObjects();
  strikeTriggered = false;

  const q = new THREE.Quaternion();
  for (const [px, pz] of pinPositions) {
    const mesh = new THREE.Mesh(pinGeometry, pinMaterial);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const body = createDynamicBody(mesh, pinShape, 1.15, new THREE.Vector3(px, 0.76, pz), q, 0.4, 0.35);
    body.setDamping(0.08, 0.12);
    pins.push(mesh);
  }
}

function resetPinsSequence() {
  if (isResetting) return;
  isResetting = true;

  if (state.camaraDinamica) {
    tweenCameraTo(0, 4.4, 16.5, 0, 0.8, -5, 900);
  }

  const sw = { y: 2.6, z: -8.0 };

  const bajar = new TWEEN.Tween(sw)
    .to({ y: 0.32 }, 400)
    .easing(TWEEN.Easing.Cubic.InOut)
    .onUpdate(() => setKinematicPosition(sweeperMesh, sweeperBody, 0, sw.y, sw.z));

  const barrer = new TWEEN.Tween(sw)
    .to({ z: -14.6 }, 750)
    .easing(TWEEN.Easing.Quadratic.InOut)
    .onUpdate(() => setKinematicPosition(sweeperMesh, sweeperBody, 0, sw.y, sw.z))
    .onComplete(() => {
      clearDynamicObjects();
    });

  const subir = new TWEEN.Tween(sw)
    .to({ y: 2.6, z: -8.0 }, 500)
    .easing(TWEEN.Easing.Cubic.Out)
    .onUpdate(() => setKinematicPosition(sweeperMesh, sweeperBody, 0, sw.y, sw.z))
    .onComplete(() => {
      dropNewPinsWithTween();
    });

  bajar.chain(barrer);
  barrer.chain(subir);
  bajar.start();
}

function dropNewPinsWithTween() {
  const tempMeshes = [];
  const drop = { y: 3.0 };

  for (const [px, pz] of pinPositions) {
    const m = new THREE.Mesh(pinGeometry, pinMaterial);
    m.position.set(px, drop.y, pz);
    m.castShadow = true;
    scene.add(m);
    tempMeshes.push(m);
  }

  new TWEEN.Tween(drop)
    .to({ y: 0.76 }, 650)
    .easing(TWEEN.Easing.Bounce.Out)
    .onUpdate(() => {
      for (const m of tempMeshes) m.position.y = drop.y;
    })
    .onComplete(() => {
      for (const m of tempMeshes) scene.remove(m);
      spawnPinsImmediate();
      isResetting = false;
    })
    .start();
}

function launchBall() {
  if (isResetting) return;

  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.45, 24, 24), ballMaterial);
  ball.castShadow = true;
  ball.receiveShadow = true;

  const startPos = new THREE.Vector3(state.posX, 0.46, 11.4);
  const q = new THREE.Quaternion();
  const body = createDynamicBody(ball, ballShape, 14.0, startPos, q, 0.14, 0.25);

  const rad = THREE.MathUtils.degToRad(state.angulo);
  const vx = Math.sin(rad) * state.potencia;
  const vz = -Math.cos(rad) * state.potencia;

  body.setLinearVelocity(new Ammo.btVector3(vx, 0, vz));
  body.setAngularVelocity(new Ammo.btVector3(-state.potencia * 1.4, 0, -state.efecto * 0.6));

  ball.userData.spin = state.efecto;
  balls.push(ball);

  if (state.camaraDinamica) {
    const targetCamX = THREE.MathUtils.clamp(state.posX * 0.6, -2.5, 2.5);
    tweenCameraTo(targetCamX, 2.5, -2.8, 0, 0.6, -11.0, 1450);
  }
}

function tweenCameraTo(cx, cy, cz, tx, ty, tz, duration) {
  stopCameraTweens();
  const camData = {
    x: camera.position.x,
    y: camera.position.y,
    z: camera.position.z,
    tx: controls.target.x,
    ty: controls.target.y,
    tz: controls.target.z,
  };

  const t = new TWEEN.Tween(camData)
    .to({ x: cx, y: cy, z: cz, tx, ty, tz }, duration)
    .easing(TWEEN.Easing.Cubic.InOut)
    .onUpdate(() => {
      camera.position.set(camData.x, camData.y, camData.z);
      controls.target.set(camData.tx, camData.ty, camData.tz);
      controls.update();
    })
    .start();

  activeCamTweens.push(t);
}

function stopCameraTweens() {
  for (const t of activeCamTweens) t.stop();
  activeCamTweens = [];
}

function createStaticBox(sx, sy, sz, pos, quat, material, friction, restitution) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), material);
  const shape = new Ammo.btBoxShape(new Ammo.btVector3(sx * 0.5, sy * 0.5, sz * 0.5));
  shape.setMargin(margin);
  createDynamicBody(mesh, shape, 0, pos, quat, friction, restitution);
  return mesh;
}

function createDynamicBody(mesh, shape, mass, pos, quat, friction = 0.5, restitution = 0.2) {
  mesh.position.copy(pos);
  mesh.quaternion.copy(quat);
  scene.add(mesh);

  const transform = new Ammo.btTransform();
  transform.setIdentity();
  transform.setOrigin(new Ammo.btVector3(pos.x, pos.y, pos.z));
  transform.setRotation(new Ammo.btQuaternion(quat.x, quat.y, quat.z, quat.w));

  const motionState = new Ammo.btDefaultMotionState(transform);
  const localInertia = new Ammo.btVector3(0, 0, 0);
  if (mass > 0) shape.calculateLocalInertia(mass, localInertia);

  const rbInfo = new Ammo.btRigidBodyConstructionInfo(mass, motionState, shape, localInertia);
  const body = new Ammo.btRigidBody(rbInfo);
  body.setFriction(friction);
  body.setRestitution(restitution);

  mesh.userData.physicsBody = body;
  if (mass > 0) {
    rigidBodies.push(mesh);
    body.setActivationState(4);
  }
  physicsWorld.addRigidBody(body);

  return body;
}

function createKinematicBody(mesh, shape) {
  const transform = new Ammo.btTransform();
  transform.setIdentity();
  transform.setOrigin(new Ammo.btVector3(mesh.position.x, mesh.position.y, mesh.position.z));
  transform.setRotation(new Ammo.btQuaternion(0, 0, 0, 1));

  const motionState = new Ammo.btDefaultMotionState(transform);
  const localInertia = new Ammo.btVector3(0, 0, 0);
  const rbInfo = new Ammo.btRigidBodyConstructionInfo(0, motionState, shape, localInertia);
  const body = new Ammo.btRigidBody(rbInfo);

  body.setCollisionFlags(body.getCollisionFlags() | 2);
  body.setActivationState(4);
  body.setRestitution(0.6);
  physicsWorld.addRigidBody(body);

  return body;
}

function setKinematicPosition(mesh, body, x, y, z) {
  mesh.position.set(x, y, z);
  tmpTrans.setIdentity();
  tmpVec.setValue(x, y, z);
  tmpQuat.setValue(0, 0, 0, 1);
  tmpTrans.setOrigin(tmpVec);
  tmpTrans.setRotation(tmpQuat);
  body.getMotionState().setWorldTransform(tmpTrans);
  body.setWorldTransform(tmpTrans);
}

function clearDynamicObjects() {
  for (const obj of [...pins, ...balls]) {
    if (obj.userData.physicsBody) {
      physicsWorld.removeRigidBody(obj.userData.physicsBody);
    }
    scene.remove(obj);
    const idx = rigidBodies.indexOf(obj);
    if (idx !== -1) rigidBodies.splice(idx, 1);
  }
  pins.length = 0;
  balls.length = 0;
  knockedCount = 0;
  updateScoreUI();
}

function checkPinsAndScore() {
  if (pins.length === 0 || isResetting) return;

  let count = 0;
  for (const pin of pins) {
    upVec.set(0, 1, 0).applyQuaternion(pin.quaternion);
    if (upVec.y < 0.72 || pin.position.y < 0.25) {
      count++;
    }
  }

  if (count !== knockedCount) {
    knockedCount = count;
    updateScoreUI();

    if (knockedCount === 10 && !strikeTriggered) {
      strikeTriggered = true;
      triggerStrikeCelebration();
    }
  }
}

function updateScoreUI() {
  const el = document.getElementById("pins-count");
  if (!el) return;
  el.innerText =
    knockedCount === 10
      ? "Bolos: 10 / 10 (Strike!)"
      : `Bolos: ${knockedCount} / 10`;
}

function triggerStrikeCelebration() {
  const pulse = { intensity: 1.2 };
  new TWEEN.Tween(pulse)
    .to({ intensity: 3.5 }, 220)
    .yoyo(true)
    .repeat(5)
    .onUpdate(() => {
      for (const m of neonArches) m.emissiveIntensity = pulse.intensity;
    })
    .start();
}

function initInput() {
  window.addEventListener("keydown", (e) => {
    if (e.code === "Space") {
      e.preventDefault();
      launchBall();
    } else if (e.key === "r" || e.key === "R") {
      resetPinsSequence();
    } else if (e.key === "v" || e.key === "V") {
      state.vistaInicial();
    } else if (e.key === "a" || e.key === "A" || e.code === "ArrowLeft") {
      state.posX = Math.round(Math.max(-1.8, state.posX - 0.15) * 100) / 100;
      updateAimHelpers();
    } else if (e.key === "d" || e.key === "D" || e.code === "ArrowRight") {
      state.posX = Math.round(Math.min(1.8, state.posX + 0.15) * 100) / 100;
      updateAimHelpers();
    } else if (e.key === "q" || e.key === "Q") {
      state.angulo = Math.max(-14, state.angulo - 1.5);
      updateAimHelpers();
    } else if (e.key === "e" || e.key === "E") {
      state.angulo = Math.min(14, state.angulo + 1.5);
      updateAimHelpers();
    }
  });
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function updatePhysics(deltaTime) {
  for (const ball of balls) {
    if (ball.userData.spin && ball.position.y < 0.7 && ball.position.z > -13 && ball.position.z < 11) {
      tmpVec.setValue(ball.userData.spin * 6.5, 0, 0);
      ball.userData.physicsBody.applyCentralForce(tmpVec);
    }
  }

  physicsWorld.stepSimulation(deltaTime, 10);

  for (let i = 0; i < rigidBodies.length; i++) {
    const objThree = rigidBodies[i];
    const objPhys = objThree.userData.physicsBody;
    const ms = objPhys.getMotionState();
    if (ms) {
      ms.getWorldTransform(transformAux1);
      const p = transformAux1.getOrigin();
      const q = transformAux1.getRotation();
      objThree.position.set(p.x(), p.y(), p.z());
      objThree.quaternion.set(q.x(), q.y(), q.z(), q.w());
    }
  }

  checkPinsAndScore();
}

function animationLoop() {
  requestAnimationFrame(animationLoop);

  const deltaTime = Math.min(clock.getDelta(), 0.05);
  TWEEN.update();
  updatePhysics(deltaTime);
  controls.update();

  renderer.render(scene, camera);
}