// Scroll-driven 3D story: a PC whose state follows the chapters of the page.
// Each chapter maps to something the app really does: scan, clean, BOOST, restore.
// Part artwork comes from parts.js and is mapped onto the model as SVG textures.
(() => {
  const root = document.documentElement;
  const canvas = document.getElementById("stage");
  const fallback = () => { root.classList.remove("has-3d"); canvas?.remove(); };
  if (!root.classList.contains("has-3d") || !canvas) return;
  if (!window.THREE) return fallback();

  const T = window.THREE;
  let renderer;
  try {
    renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  } catch {
    return fallback();
  }
  const SMALL = innerWidth < 880;
  renderer.outputEncoding = T.sRGBEncoding;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.enabled = !SMALL;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  let pixelRatio = Math.min(devicePixelRatio || 1, SMALL ? 1.5 : 1.75);
  renderer.setPixelRatio(pixelRatio);

  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(32, 1, 0.1, 60);
  const pc = new T.Group();
  scene.add(pc);

  /* ---------- studio reflections: metal and glass need something to reflect ---------- */
  (() => {
    const studio = new T.Scene();
    studio.background = new T.Color(0x05060a);
    const panel = (color, strength, w, h, x, y, z) => {
      const mat = new T.MeshBasicMaterial({ color: new T.Color(color).multiplyScalar(strength), side: T.DoubleSide });
      const mesh = new T.Mesh(new T.PlaneGeometry(w, h), mat);
      mesh.position.set(x, y, z);
      mesh.lookAt(0, 0, 0);
      studio.add(mesh);
    };
    panel(0xffffff, 1.6, 8, 3, 0, 7, 2);
    panel(0xdfe6ff, 0.7, 3, 9, 7, 1, 5);
    panel(0xdfe6ff, 0.35, 3, 8, -7, 1, 5);
    panel(0x8fa6ff, 0.15, 9, 3, 0, -6, 3);
    const pmrem = new T.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(studio, 0.03).texture;
    pmrem.dispose();
  })();

  /* ---------- SVG textures ---------- */
  const ART = window.PC_PARTS || {};
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const textures = {};
  const svgTexture = (name, size = 1024, repeatX = 1, repeatY = 1) => {
    const key = `${name}:${repeatX}:${repeatY}`;
    if (textures[key]) return textures[key];
    const c = document.createElement("canvas");
    const tex = new T.CanvasTexture(c);
    tex.encoding = T.sRGBEncoding;
    tex.anisotropy = maxAniso;
    if (repeatX !== 1 || repeatY !== 1) {
      tex.wrapS = tex.wrapT = T.RepeatWrapping;
      tex.repeat.set(repeatX, repeatY);
    }
    textures[key] = tex;
    c.width = c.height = 2;
    if (ART[name]) {
      const img = new Image();
      img.onload = () => {
        const f = size / Math.max(img.width, img.height);
        c.width = Math.round(img.width * f);
        c.height = Math.round(img.height * f);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        tex.needsUpdate = true;
      };
      img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(ART[name])}`;
    }
    return tex;
  };

  /* ---------- materials and helpers ---------- */
  const std = (color, metalness = 0.55, roughness = 0.5) => new T.MeshStandardMaterial({ color, metalness, roughness });
  const caseBlack = std(0x17181d, 0.75, 0.42);
  const gunmetal = std(0x2c2f37, 0.9, 0.36);
  const matte = std(0x0b0c0f, 0.15, 0.85);
  const plastic = std(0x17181c, 0.05, 0.55);
  const chrome = std(0xd5d8df, 1, 0.14);
  const rubber = std(0x08080a, 0, 0.9);
  const bladeMat = std(0x24262d, 0.35, 0.34);
  const aluminium = new T.MeshStandardMaterial({ map: svgTexture("brush", 256), metalness: 1, roughness: 0.38 });
  const braidMat = new T.MeshStandardMaterial({ map: svgTexture("braid", 64, 30, 2), metalness: 0.35, roughness: 0.6 });

  const box = (w, h, d, mat, x, y, z, parent) => {
    const mesh = new T.Mesh(new T.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  };

  const roundedShape = (w, h, r) => {
    const s = new T.Shape();
    const x = -w / 2, y = -h / 2;
    s.moveTo(x + r, y);
    s.lineTo(x + w - r, y);
    s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + h - r);
    s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h);
    s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r);
    s.quadraticCurveTo(x, y, x + r, y);
    return s;
  };

  // Softened edges catch highlights, which is most of what makes a box read as a machined part.
  const rbox = (w, h, d, mat, x, y, z, parent, radius = 0.02) => {
    const bevel = Math.min(radius * 0.5, d * 0.3, 0.012);
    const r = Math.min(radius, Math.min(w, h) / 2 - bevel - 0.001);
    const geo = new T.ExtrudeGeometry(roundedShape(w - bevel * 2, h - bevel * 2, Math.max(r, 0.001)), {
      depth: Math.max(d - bevel * 2, 0.001), bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 2, curveSegments: 4,
    });
    geo.translate(0, 0, -(d - bevel * 2) / 2);
    const mesh = new T.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  };

  const decal = (w, h, art, x, y, z, parent, options = {}) => {
    const { size, rx = 0, ry = 0, metal = 0.45, rough = 0.5, repeatX = 1, repeatY = 1 } = options;
    const mesh = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshStandardMaterial({ map: svgTexture(art, size, repeatX, repeatY), metalness: metal, roughness: rough }));
    mesh.position.set(x, y, z);
    mesh.rotation.set(rx, ry, 0);
    parent.add(mesh);
    return mesh;
  };

  const screw = (x, y, z, parent, r = 0.018) => {
    const s = new T.Mesh(new T.CylinderGeometry(r, r, 0.012, 12), chrome);
    s.position.set(x, y, z);
    s.rotation.x = Math.PI / 2;
    parent.add(s);
    return s;
  };

  // Everything that emits RGB light registers here and is recolored once per frame.
  const lit = [];
  const litMaterial = (hueOffset) => {
    const mat = new T.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
    lit.push({ mat, hueOffset });
    return mat;
  };

  const radial = (stops) => {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const g = c.getContext("2d");
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    stops.forEach(([at, alpha]) => grad.addColorStop(at, `rgba(255,255,255,${alpha})`));
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    return new T.CanvasTexture(c);
  };
  const glowTexture = radial([[0, 0.5], [0.45, 0.2], [1, 0]]);

  const glows = [];
  const addGlow = (size, hueOffset, parent, pos) => {
    const mat = new T.SpriteMaterial({ map: glowTexture, blending: T.AdditiveBlending, transparent: true, depthWrite: false, toneMapped: false });
    const sprite = new T.Sprite(mat);
    sprite.scale.setScalar(size);
    if (pos) sprite.position.copy(pos);
    parent.add(sprite);
    glows.push({ mat, hueOffset, k: 0.42 });
  };

  /* ---------- fan: square frame, seven curved blades with real pitch, screws and a lit ring ---------- */
  const bladeShape = new T.Shape();
  bladeShape.moveTo(-0.07, 0.25);
  bladeShape.bezierCurveTo(0.14, 0.33, 0.42, 0.62, 0.46, 0.9);
  bladeShape.bezierCurveTo(0.22, 0.98, -0.04, 0.92, -0.2, 0.72);
  bladeShape.bezierCurveTo(-0.22, 0.52, -0.18, 0.36, -0.07, 0.25);
  const bladeGeo = new T.ExtrudeGeometry(bladeShape, { depth: 0.02, bevelEnabled: false, curveSegments: 10 });
  const fans = [];

  const makeFan = (radius, hueOffset, framed = true) => {
    const fan = new T.Group();
    const spinner = new T.Group();
    for (let i = 0; i < 7; i++) {
      const arm = new T.Group();
      arm.rotation.z = (i / 7) * Math.PI * 2;
      const b = new T.Mesh(bladeGeo, bladeMat);
      b.scale.setScalar(radius);
      b.rotation.y = 0.42;
      arm.add(b);
      spinner.add(arm);
    }
    fan.add(spinner);
    const hub = new T.Mesh(new T.CylinderGeometry(radius * 0.27, radius * 0.29, radius * 0.22, 32), plastic);
    hub.rotation.x = Math.PI / 2;
    fan.add(hub);
    const sticker = new T.Mesh(new T.CircleGeometry(radius * 0.26, 32), new T.MeshStandardMaterial({ map: svgTexture("hub", 128), metalness: 0.3, roughness: 0.45 }));
    sticker.position.z = radius * 0.115;
    fan.add(sticker);
    fan.add(new T.Mesh(new T.TorusGeometry(radius * 1.01, radius * 0.035, 10, 72), litMaterial(hueOffset)));
    addGlow(radius * 3, hueOffset, fan);

    if (framed) {
      const side = radius * 2.18;
      const frame = roundedShape(side, side, radius * 0.16);
      const opening = new T.Path();
      opening.absarc(0, 0, radius * 1.03, 0, Math.PI * 2, true);
      frame.holes.push(opening);
      const depth = radius * 0.32;
      const geo = new T.ExtrudeGeometry(frame, { depth, bevelEnabled: false, curveSegments: 32 });
      geo.translate(0, 0, -depth);
      fan.add(new T.Mesh(geo, plastic));
      [-1, 1].forEach((sx) => [-1, 1].forEach((sy) => screw(sx * side * 0.42, sy * side * 0.42, 0.006, fan, radius * 0.05)));
      for (let i = 0; i < 3; i++) {
        const strut = box(radius * 0.05, radius * 1.05, radius * 0.05, plastic, 0, 0, -depth * 0.85, fan);
        strut.geometry.translate(0, radius * 0.52, 0);
        strut.rotation.z = (i / 3) * Math.PI * 2 + 0.5;
      }
    }
    fans.push(spinner);
    return fan;
  };

  /* ---------- case ---------- */
  const W = 2.4, H = 2.6, D = 1.2;
  const shell = new T.Group();
  pc.add(shell);
  rbox(W, 0.07, D, caseBlack, 0, H / 2, 0, shell, 0.012).rotation.x = 0;
  rbox(W, 0.07, D, caseBlack, 0, -H / 2, 0, shell, 0.012);
  decal(2.05, 0.92, "vent", -0.05, H / 2 + 0.037, 0, shell, { rx: -Math.PI / 2, size: 256, repeatX: 7, repeatY: 6, metal: 0.8, rough: 0.45 });
  rbox(W, H, 0.05, caseBlack, 0, 0, -D / 2, shell, 0.012);
  const rear = box(0.05, H, D, caseBlack, -W / 2, 0, 0, shell);
  rear.castShadow = true;
  rbox(0.06, H, 0.06, aluminium, W / 2, 0, D / 2 - 0.03, shell, 0.02);
  rbox(0.06, H, 0.06, aluminium, W / 2, 0, -D / 2 + 0.03, shell, 0.02);
  rbox(0.06, H, 0.06, aluminium, -W / 2, 0, D / 2 - 0.03, shell, 0.02);
  for (let i = 0; i < 7; i++) box(0.012, 0.085, 0.86, aluminium, -W / 2 + 0.032, -0.72 + i * 0.105, 0, shell);
  [-1, 1].forEach((sx) => [-1, 1].forEach((sz) => {
    const foot = new T.Mesh(new T.CylinderGeometry(0.1, 0.12, 0.07, 24), rubber);
    foot.position.set(sx * (W / 2 - 0.25), -H / 2 - 0.07, sz * (D / 2 - 0.15));
    shell.add(foot);
  }));
  // LED strip under the top panel, the main light inside a real build.
  box(1.85, 0.012, 0.022, litMaterial(0.6), -0.1, H / 2 - 0.05, D / 2 - 0.16, shell);

  const exhaust = makeFan(0.28, 0.75);
  exhaust.rotation.y = Math.PI / 2;
  exhaust.position.set(-W / 2 + 0.08, 0.72, -0.02);
  shell.add(exhaust);

  // Parts move along `spread` when the case opens in the scan chapter.
  const parts = [];
  const part = (object, spread) => {
    parts.push({ object, home: object.position.clone(), spread: new T.Vector3(...spread) });
    if (!object.parent) pc.add(object);
    return object;
  };

  /* ---------- motherboard ---------- */
  const board = new T.Group();
  rbox(1.75, 2, 0.03, matte, 0, 0, 0, board, 0.01);
  decal(1.75, 2, "board", 0, 0, 0.017, board, { size: 2048, metal: 0.25, rough: 0.62 });
  // Rear I/O cover and power stage heatsinks.
  rbox(0.34, 0.56, 0.15, gunmetal, -0.7, 0.62, 0.09, board, 0.03);
  decal(0.15, 0.25, "io", -0.875 + 0.001, 0.68, 0.06, board, { ry: -Math.PI / 2, size: 300, metal: 0.6 });
  rbox(0.16, 0.5, 0.11, gunmetal, -0.5, 0.42, 0.07, board, 0.02);
  decal(0.12, 0.46, "fins", -0.5, 0.42, 0.127, board, { size: 256, repeatX: 2, repeatY: 7, metal: 0.8, rough: 0.35 });
  rbox(0.52, 0.14, 0.11, gunmetal, -0.17, 0.8, 0.07, board, 0.02);
  decal(0.48, 0.1, "fins", -0.17, 0.8, 0.127, board, { size: 256, repeatX: 6, repeatY: 1, metal: 0.8, rough: 0.35 });
  // CPU socket plate.
  rbox(0.4, 0.4, 0.025, aluminium, -0.2, 0.44, 0.024, board, 0.015);
  // Memory slots.
  for (let i = 0; i < 4; i++) rbox(0.038, 0.74, 0.03, plastic, 0.32 + i * 0.1, 0.4, 0.03, board, 0.006);
  // Primary graphics slot with steel reinforcement, then a smaller one.
  rbox(1.05, 0.045, 0.04, aluminium, -0.22, -0.6, 0.03, board, 0.01);
  rbox(0.55, 0.03, 0.03, plastic, -0.47, -0.82, 0.028, board, 0.008);
  // M.2 and chipset covers.
  rbox(0.78, 0.13, 0.03, gunmetal, -0.14, -0.21, 0.032, board, 0.012);
  decal(0.75, 0.12, "m2", -0.14, -0.21, 0.0485, board, { size: 750, metal: 0.8, rough: 0.35 });
  rbox(0.4, 0.34, 0.04, gunmetal, 0.53, -0.38, 0.036, board, 0.02);
  decal(0.38, 0.32, "chipset", 0.53, -0.38, 0.0565, board, { size: 400, metal: 0.8, rough: 0.35 });
  // Power connector.
  rbox(0.07, 0.3, 0.06, plastic, 0.8, 0.26, 0.04, board, 0.008);
  // Capacitors: instanced, there are many and they never change.
  const capPlaces = [];
  for (let i = 0; i < 12; i++) capPlaces.push([-0.38 + (i % 2) * 0.05, 0.14 + Math.floor(i / 2) * 0.05]);
  for (let i = 0; i < 10; i++) capPlaces.push([-0.7 + i * 0.055, -0.92]);
  for (let i = 0; i < 6; i++) capPlaces.push([0.2 + i * 0.055, -0.03]);
  const caps = new T.InstancedMesh(new T.CylinderGeometry(0.016, 0.016, 0.05, 12), chrome, capPlaces.length);
  const capDummy = new T.Object3D();
  capPlaces.forEach(([x, y], i) => {
    capDummy.position.set(x, y, 0.04);
    capDummy.rotation.x = Math.PI / 2;
    capDummy.updateMatrix();
    caps.setMatrixAt(i, capDummy.matrix);
  });
  board.add(caps);
  board.position.set(-0.22, 0.22, -0.53);
  part(board, [0, 0, -0.5]);

  /* ---------- liquid cooler ---------- */
  const pump = new T.Group();
  const pumpBody = new T.Mesh(new T.CylinderGeometry(0.235, 0.26, 0.17, 64), gunmetal);
  pumpBody.rotation.x = Math.PI / 2;
  pump.add(pumpBody);
  const cap = new T.Mesh(new T.CircleGeometry(0.225, 64), new T.MeshStandardMaterial({ map: svgTexture("pump", 512), metalness: 0.95, roughness: 0.3 }));
  cap.position.z = 0.086;
  pump.add(cap);
  const pumpRing = new T.Mesh(new T.TorusGeometry(0.228, 0.011, 10, 72), litMaterial(0.5));
  pumpRing.position.z = 0.088;
  pump.add(pumpRing);
  const bolt = new T.Shape();
  [[0.03, 0.14], [-0.08, -0.02], [-0.01, -0.02], [-0.03, -0.14], [0.08, 0.02], [0.01, 0.02]].forEach(([x, y], i) => (i ? bolt.lineTo(x, y) : bolt.moveTo(x, y)));
  const boltMesh = new T.Mesh(new T.ShapeGeometry(bolt), litMaterial(0.5));
  boltMesh.position.z = 0.09;
  pump.add(boltMesh);
  addGlow(0.7, 0.5, pump, new T.Vector3(0, 0, 0.11));
  pump.position.set(-0.42, 0.66, -0.42);
  part(pump, [0, 0.12, 1]);

  /* ---------- memory ---------- */
  const ram = new T.Group();
  for (let i = 0; i < 4; i++) {
    const x = i * 0.1;
    rbox(0.052, 0.66, 0.13, gunmetal, x, 0, 0, ram, 0.006);
    decal(0.125, 0.58, "ram", x + 0.027, -0.02, 0, ram, { ry: Math.PI / 2, size: 512, metal: 0.85, rough: 0.34 });
    decal(0.125, 0.58, "ram", x - 0.027, -0.02, 0, ram, { ry: -Math.PI / 2, size: 512, metal: 0.85, rough: 0.34 });
    box(0.044, 0.045, 0.122, litMaterial(i * 0.09), x, 0.348, 0, ram);
  }
  ram.position.set(0.1, 0.62, -0.42);
  part(ram, [0.12, 0.34, 0.68]);

  /* ---------- graphics card, fans facing the glass ---------- */
  const gpu = new T.Group();
  rbox(1.45, 0.36, 0.17, gunmetal, 0, 0, 0, gpu, 0.025);
  decal(1.45, 0.36, "gpu", 0, 0, 0.0865, gpu, { size: 2048, metal: 0.8, rough: 0.38 });
  rbox(1.42, 0.34, 0.016, aluminium, 0, 0, -0.095, gpu, 0.01);
  box(1.42, 0.016, 0.12, litMaterial(0.2), 0, 0.184, 0.01, gpu);
  rbox(0.024, 0.46, 0.21, aluminium, -0.745, 0, 0, gpu, 0.006);
  decal(0.2, 0.42, "bracket", -0.76, 0, 0, gpu, { ry: -Math.PI / 2, size: 420, metal: 0.8 });
  [-0.46, 0, 0.46].forEach((x, i) => {
    const f = makeFan(0.128, 0.25 + i * 0.08, false);
    f.position.set(x, 0, 0.082);
    gpu.add(f);
  });
  rbox(0.16, 0.05, 0.1, plastic, 0.46, 0.2, -0.02, gpu, 0.008);
  gpu.position.set(-0.2, -0.38, -0.27);
  part(gpu, [0, -0.1, 1.45]);

  /* ---------- power supply cover ---------- */
  const shroud = new T.Group();
  rbox(1.85, 0.44, 1.1, caseBlack, 0, 0, 0, shroud, 0.02);
  decal(1.85, 0.44, "psu", 0, 0, 0.5515, shroud, { size: 1024, metal: 0.7, rough: 0.45 });
  decal(1.5, 0.75, "vent", 0, 0.2215, 0, shroud, { rx: -Math.PI / 2, size: 256, repeatX: 5, repeatY: 5, metal: 0.8, rough: 0.45 });
  shroud.position.set(-0.25, -1.06, 0);
  part(shroud, [0, -0.55, 0]);

  /* ---------- radiator and front fans ---------- */
  const front = new T.Group();
  rbox(0.1, 2.46, 0.88, matte, 0.97, 0, 0, front, 0.01);
  decal(0.8, 2.36, "fins", 0.918, 0, 0, front, { ry: -Math.PI / 2, size: 256, repeatX: 14, repeatY: 1, metal: 0.8, rough: 0.35 });
  [0.82, 0, -0.82].forEach((y, i) => {
    const f = makeFan(0.36, i * 0.12);
    f.rotation.y = Math.PI / 2;
    f.position.set(W / 2 - 0.05, y, 0);
    front.add(f);
  });
  part(front, [0.6, 0, 0]);

  /* ---------- cables: hidden while the parts are apart ---------- */
  const cables = new T.Group();
  pc.add(cables);
  const cable = (points, radius, mat) => {
    const curve = new T.CatmullRomCurve3(points.map(([x, y, z]) => new T.Vector3(x, y, z)));
    cables.add(new T.Mesh(new T.TubeGeometry(curve, 48, radius, 10), mat));
  };
  cable([[-0.3, 0.86, -0.38], [-0.05, 1.08, -0.25], [0.5, 1.12, -0.12], [0.92, 1.0, -0.2]], 0.03, braidMat);
  cable([[-0.2, 0.82, -0.38], [0.05, 1.03, -0.15], [0.55, 1.05, 0.02], [0.92, 0.9, 0]], 0.03, braidMat);
  cable([[0.58, 0.32, -0.47], [0.68, 0.1, -0.38], [0.66, -0.5, -0.35], [0.56, -0.84, -0.3]], 0.05, braidMat);
  cable([[0.26, -0.2, -0.27], [0.34, -0.1, -0.17], [0.52, -0.42, -0.14], [0.5, -0.84, -0.14]], 0.028, braidMat);

  /* ---------- tempered glass ---------- */
  const glassMat = new T.MeshStandardMaterial({ color: 0xaebbd8, metalness: 0.9, roughness: 0.06, transparent: true, opacity: 0.07, depthWrite: false, envMapIntensity: 1 });
  const glass = box(W, H, 0.02, glassMat, 0, 0, D / 2, pc);
  const glassScrews = new T.Group();
  [-1, 1].forEach((sx) => [-1, 1].forEach((sy) => screw(sx * (W / 2 - 0.09), sy * (H / 2 - 0.09), 0.012, glassScrews, 0.026)));
  glass.add(glassScrews);
  parts.push({ object: glass, home: glass.position.clone(), spread: new T.Vector3(0, 0, 2.4) });

  /* ---------- floor: contact shadow and RGB spill keep the PC from floating ---------- */
  const floorY = -H / 2 - 0.105;
  const catcher = new T.Mesh(new T.PlaneGeometry(14, 14), new T.ShadowMaterial({ opacity: 0.55 }));
  catcher.rotation.x = -Math.PI / 2;
  catcher.position.y = floorY;
  catcher.receiveShadow = true;
  pc.add(catcher);
  const spillMat = new T.MeshBasicMaterial({ map: radial([[0, 0.55], [0.5, 0.18], [1, 0]]), blending: T.AdditiveBlending, transparent: true, depthWrite: false, toneMapped: false });
  const spill = new T.Mesh(new T.PlaneGeometry(6.6, 4.6), spillMat);
  spill.rotation.x = -Math.PI / 2;
  spill.position.y = floorY + 0.002;
  pc.add(spill);
  glows.push({ mat: spillMat, hueOffset: 0.3, k: 0.36 });

  /* ---------- dust leaving the case ---------- */
  const JUNK = SMALL ? 90 : 170;
  const junk = new T.InstancedMesh(new T.IcosahedronGeometry(1, 0), new T.MeshStandardMaterial({ color: 0x34363f, metalness: 0, roughness: 1, envMapIntensity: 0.2 }), JUNK);
  const seeds = Array.from({ length: JUNK }, () => ({
    x: (Math.random() - 0.5) * 2.05, y: (Math.random() - 0.5) * 2.2, z: (Math.random() - 0.5) * 0.85,
    size: 0.006 + Math.random() * 0.013, spin: Math.random() * 6, delay: Math.random() * 0.35,
  }));
  const dummy = new T.Object3D();
  let lastClean = -1;
  const placeJunk = (clean) => {
    if (clean === lastClean) return;
    lastClean = clean;
    seeds.forEach((s, i) => {
      const p = Math.min(1, Math.max(0, (clean - s.delay) / (1 - s.delay)));
      const eased = p * p;
      const angle = s.spin + eased * 5;
      const reach = 1 + eased * 4.5;
      dummy.position.set(s.x * reach + Math.cos(angle) * eased, s.y * reach + eased * 1.4, s.z * reach + Math.sin(angle) * eased * 2);
      dummy.rotation.set(s.spin + eased * 6, s.spin, 0);
      dummy.scale.setScalar(s.size * (p >= 1 ? 0.0001 : 1 - eased * 0.5));
      dummy.updateMatrix();
      junk.setMatrixAt(i, dummy.matrix);
    });
    junk.instanceMatrix.needsUpdate = true;
  };
  pc.add(junk);

  /* ---------- scan plane and BOOST pulses ---------- */
  const scanMat = new T.MeshBasicMaterial({ transparent: true, opacity: 0, blending: T.AdditiveBlending, side: T.DoubleSide, depthWrite: false, toneMapped: false });
  const scanPlane = new T.Mesh(new T.PlaneGeometry(W + 0.3, D + 0.3), scanMat);
  scanPlane.rotation.x = Math.PI / 2;
  pc.add(scanPlane);

  const pulses = [0, 1, 2].map(() => {
    const mat = new T.MeshBasicMaterial({ transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, toneMapped: false });
    const ring = new T.Mesh(new T.TorusGeometry(1.55, 0.012, 8, 96), mat);
    ring.rotation.y = Math.PI / 2;
    pc.add(ring);
    return { ring, mat };
  });

  /* ---------- lights ---------- */
  scene.add(new T.HemisphereLight(0xbcc6ff, 0x12131a, 0.22));
  const key = new T.DirectionalLight(0xffffff, 0.95);
  key.position.set(3.5, 5.5, 6);
  if (!SMALL) {
    key.castShadow = true;
    key.shadow.mapSize.set(1536, 1536);
    Object.assign(key.shadow.camera, { left: -3.2, right: 3.2, top: 3.2, bottom: -3.2, near: 1, far: 18 });
    key.shadow.bias = -0.0006;
    key.shadow.normalBias = 0.012;
  }
  scene.add(key);
  const rgbLights = [
    { light: new T.PointLight(0xffffff, 1, 5), pos: [0.2, 0.9, 0.2], hueOffset: 0.1 },
    { light: new T.PointLight(0xffffff, 1, 5), pos: [0.7, -0.3, 0.1], hueOffset: 0.4 },
    { light: new T.PointLight(0xffffff, 1, 8), pos: [2.4, -0.4, 1.4], hueOffset: 0.7 },
  ];
  rgbLights.forEach(({ light, pos }) => { light.position.set(...pos); pc.add(light); });

  // Solid parts cast and catch shadows; glass, glow and light strips do not.
  pc.traverse((o) => {
    if (!o.isMesh || o === catcher || o === glass) return;
    const m = o.material;
    if (m && m.isMeshStandardMaterial && !m.transparent) {
      // Reflections only as highlights: more than this turns black steel pale blue.
      if (m !== junk.material) m.envMapIntensity = 0.28;
      o.castShadow = !o.isInstancedMesh;
      o.receiveShadow = true;
    }
  });

  /* ---------- chapters ---------- */
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp01 = (v) => Math.min(1, Math.max(0, v));
  const smooth = (a, b, v) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };
  const bump = (a, peak, b, v) => (v < peak ? smooth(a, peak, v) : 1 - smooth(peak, b, v));

  // One key per chapter: orbit angles, distance, and where the case sits on screen.
  const KEYS = [
    // On phones the hero text sits on top of the case, so the case stays faint until the first panel.
    { az: 0.62, el: 0.12, r: 7.6, sx: -0.21, sy: 0, psy: -0.2, dim: 1, phoneDim: 0.22 },
    { az: -0.42, el: 0.3, r: 10.5, sx: 0, sy: 0, psy: 0, dim: 0.3, phoneDim: 0.22 },
    { az: 0.62, el: 0.2, r: 9.2, sx: 0.2, sy: 0, psy: 0.2, dim: 1 },
    { az: -0.52, el: -0.04, r: 7.2, sx: -0.22, sy: 0, psy: 0.2, dim: 1 },
    { az: 1.12, el: 0.1, r: 6.8, sx: 0.21, sy: 0, psy: 0.2, dim: 1 },
    { az: 0.5, el: 0.14, r: 7.8, sx: -0.21, sy: 0, psy: 0.2, dim: 1 },
  ];

  const story = document.querySelector(".story");
  const chapters = [...document.querySelectorAll(".chapter")];
  const tilt = document.querySelector(".tilt");
  const progress = document.querySelector(".progress");
  let centers = [], width = 0, height = 0, isPhone = false;

  const measure = () => {
    centers = chapters.map((c) => c.getBoundingClientRect().top + scrollY + c.offsetHeight / 2);
  };
  const resize = () => {
    const w = innerWidth, h = innerHeight;
    // Phone address bars change the height while scrolling: ignore small changes.
    if (w === width && Math.abs(h - height) < 120) return;
    width = w;
    height = h;
    isPhone = w < 880;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  const remeasure = () => { resize(); measure(); };
  remeasure();
  new ResizeObserver(remeasure).observe(story);
  addEventListener("resize", remeasure);

  const targetChapter = () => {
    const pos = scrollY + innerHeight / 2;
    if (pos <= centers[0]) return 0;
    for (let i = 0; i < centers.length - 1; i++) {
      if (pos < centers[i + 1]) return i + (pos - centers[i]) / (centers[i + 1] - centers[i]);
    }
    return centers.length - 1;
  };

  /* ---------- pointer parallax ---------- */
  let pointerX = 0, pointerY = 0, tiltX = 0, tiltY = 0;
  addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse") return;
    pointerX = e.clientX / innerWidth - 0.5;
    pointerY = e.clientY / innerHeight - 0.5;
  }, { passive: true });

  /* ---------- only render while the story is on screen ---------- */
  let visible = true;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) wake(); }, { rootMargin: "20% 0px" }).observe(story);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) wake(); });

  const GREY = new T.Color(0x2d303c);
  let current = targetChapter(), last = 0, running = false, slowFrames = 0, spinSpeed = 1;

  function frame(now) {
    if (!visible || document.hidden) { running = false; return; }
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now;
    const time = now / 1000;

    // On slow machines, give up sharpness and shadows rather than stutter.
    slowFrames = dt > 0.04 ? slowFrames + 1 : Math.max(0, slowFrames - 1);
    if (slowFrames > 40) {
      slowFrames = 0;
      if (key.castShadow) {
        key.castShadow = false;
      } else if (pixelRatio > 1) {
        pixelRatio = 1;
        renderer.setPixelRatio(1);
        renderer.setSize(width, height, false);
      }
    }

    current += (targetChapter() - current) * (1 - Math.exp(-dt * 5));
    const f = current;

    // Camera
    const i = Math.min(KEYS.length - 2, Math.floor(f));
    const t = smooth(0, 1, f - i);
    const a = KEYS[i], b = KEYS[i + 1];
    tiltX += (pointerX - tiltX) * 0.05;
    tiltY += (pointerY - tiltY) * 0.05;
    const az = lerp(a.az, b.az, t) + tiltX * 0.22 + Math.sin(time * 0.3) * 0.025;
    const el = lerp(a.el, b.el, t) - tiltY * 0.1;
    const r = lerp(a.r, b.r, t) * (isPhone ? 1.3 : 1);
    camera.position.set(Math.sin(az) * Math.cos(el) * r, Math.sin(el) * r, Math.cos(az) * Math.cos(el) * r);
    camera.lookAt(0, 0, 0);
    const sx = isPhone ? 0 : lerp(a.sx, b.sx, t);
    const sy = isPhone ? lerp(a.psy, b.psy, t) : lerp(a.sy, b.sy, t);
    camera.setViewOffset(width, height, sx * width, sy * height, width, height);

    // Chapter effects
    const open = bump(1.25, 2, 2.75, f);
    const scan = bump(1.5, 2, 2.5, f);
    const clean = smooth(2.45, 3.3, f);
    const boost = bump(3.35, 4, 4.65, f);
    const eased = open * open * (3 - 2 * open);

    parts.forEach((p) => {
      p.object.position.copy(p.home).addScaledVector(p.spread, eased);
    });
    cables.visible = eased < 0.03;
    glassMat.opacity = 0.07 * (1 - eased);
    glass.visible = eased < 0.95;
    glassScrews.visible = eased < 0.25;
    placeJunk(Math.round(clean * 200) / 200);

    // Light follows the RGB control on the page.
    const mode = root.dataset.rgb || "wave";
    const off = mode === "off";
    const breath = mode === "breathe" ? 0.5 + 0.5 * Math.sin(time * 1.25) : 1;
    const hueAt = (offset) => (mode === "static" ? 0.55 : mode === "breathe" ? offset : (time * 0.07 + offset) % 1);
    const strength = off ? 0 : (0.35 + 0.65 * breath) * (1 + boost * 0.6);

    lit.forEach(({ mat, hueOffset }) => {
      if (off) mat.color.copy(GREY);
      else mat.color.setHSL(hueAt(hueOffset), 0.85, lerp(0.42, 0.66, Math.min(1, strength)));
    });
    glows.forEach(({ mat, hueOffset, k }) => {
      mat.color.setHSL(hueAt(hueOffset), 0.85, 0.6);
      mat.opacity = k * strength;
    });
    rgbLights.forEach(({ light, hueOffset }) => {
      light.color.setHSL(hueAt(hueOffset), 0.8, 0.6);
      light.intensity = 0.75 * strength;
    });

    spinSpeed += (1.6 + boost * 26 - spinSpeed) * (1 - Math.exp(-dt * 2.5));
    fans.forEach((s) => { s.rotation.z -= spinSpeed * dt; });

    scanPlane.position.y = lerp(1.9, -1.9, smooth(1.5, 2.5, f));
    scanMat.opacity = scan * 0.2 * (off ? 0.4 : 1);
    scanMat.color.setHSL(hueAt(0.5), 0.9, 0.6);

    pulses.forEach(({ ring, mat }, n) => {
      const phase = (time * 0.75 + n / 3) % 1;
      ring.scale.setScalar(1 + phase * 1.5);
      mat.opacity = boost * (1 - phase) * 0.7;
      mat.color.setHSL(hueAt(n * 0.2), 0.9, 0.62);
    });
    pc.position.x = Math.sin(time * 46) * 0.005 * boost;

    // Page elements tied to the same scroll.
    const leaving = story.getBoundingClientRect().bottom / innerHeight;
    const dimOf = (k) => (isPhone && k.phoneDim !== undefined ? k.phoneDim : k.dim);
    canvas.style.opacity = String(lerp(dimOf(a), dimOf(b), t) * smooth(0.25, 0.85, leaving));
    if (tilt) {
      const lift = clamp01(1 - Math.abs(f - 1) * 1.7);
      tilt.style.transform = `rotateX(${(1 - lift) * 20 * (f < 1 ? 1 : -1)}deg) rotateY(${tiltX * 7}deg) scale(${0.93 + lift * 0.07})`;
    }
    if (progress) progress.style.transform = `scaleX(${clamp01(scrollY / (document.documentElement.scrollHeight - innerHeight))})`;

    renderer.render(scene, camera);
  }

  function wake() {
    if (running || !visible || document.hidden) return;
    running = true;
    last = performance.now();
    requestAnimationFrame(frame);
  }
  wake();
})();
