/* 建構 3D 競技場：地面、牆、掩體、燈光、天空 */
class World {
  constructor(scene) {
    this.scene = scene;
    this.colliders = [];   // {min:{x,z}, max:{x,z}} AABB (XZ 平面)
    this.size = 60;        // 場地半徑
    this.obstacles = [];
  }

  build() {
    const scene = this.scene;

    // 霧氣營造縱深
    scene.fog = new THREE.Fog(0x0b1020, 40, 130);
    scene.background = new THREE.Color(0x0b1020);

    // ---- 環境光 + 主光 ----
    const hemi = new THREE.HemisphereLight(0x8fbfff, 0x30263a, 0.55);
    scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xfff0d0, 1.1);
    sun.position.set(40, 70, 20);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const s = 90;
    sun.shadow.camera.left = -s; sun.shadow.camera.right = s;
    sun.shadow.camera.top = s; sun.shadow.camera.bottom = -s;
    sun.shadow.camera.near = 1; sun.shadow.camera.far = 200;
    sun.shadow.bias = -0.0004;
    scene.add(sun);

    // 補色點光，增添氛圍
    const p1 = new THREE.PointLight(0x35e0c8, 0.8, 60);
    p1.position.set(-25, 12, -25); scene.add(p1);
    const p2 = new THREE.PointLight(0xff5d6c, 0.8, 60);
    p2.position.set(25, 12, 25); scene.add(p2);

    // ---- 地面 ----
    const groundTex = this._makeGridTexture();
    const groundMat = new THREE.MeshStandardMaterial({
      map: groundTex, roughness: 0.9, metalness: 0.1, color: 0x2a3350
    });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(this.size * 2, this.size * 2), groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // 中心發光圓盤
    const disc = new THREE.Mesh(
      new THREE.RingGeometry(6, 6.5, 48),
      new THREE.MeshBasicMaterial({ color: 0x35e0c8, transparent: true, opacity: 0.5, side: THREE.DoubleSide })
    );
    disc.rotation.x = -Math.PI / 2; disc.position.y = 0.02; scene.add(disc);

    // ---- 外牆 ----
    this._buildWalls();

    // ---- 掩體 ----
    this._buildObstacles();

    // ---- 星空天球 ----
    this._buildSky();
  }

  _makeGridTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 512;
    const g = c.getContext('2d');
    g.fillStyle = '#222b45'; g.fillRect(0, 0, 512, 512);
    g.strokeStyle = 'rgba(90,120,180,0.5)'; g.lineWidth = 2;
    for (let i = 0; i <= 512; i += 64) {
      g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 512); g.stroke();
      g.beginPath(); g.moveTo(0, i); g.lineTo(512, i); g.stroke();
    }
    g.strokeStyle = 'rgba(53,224,200,0.25)'; g.lineWidth = 1;
    for (let i = 32; i <= 512; i += 64) {
      g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 512); g.stroke();
      g.beginPath(); g.moveTo(0, i); g.lineTo(512, i); g.stroke();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(24, 24);
    return tex;
  }

  _buildWalls() {
    const h = 8, t = 2, S = this.size;
    const mat = new THREE.MeshStandardMaterial({ color: 0x1a2138, roughness: 0.7, metalness: 0.3 });
    const emissiveMat = new THREE.MeshStandardMaterial({
      color: 0x0e1526, roughness: 0.5, metalness: 0.4,
      emissive: 0x35e0c8, emissiveIntensity: 0.25
    });
    const specs = [
      { x: 0, z: -S, w: S * 2, d: t },
      { x: 0, z: S, w: S * 2, d: t },
      { x: -S, z: 0, w: t, d: S * 2 },
      { x: S, z: 0, w: t, d: S * 2 },
    ];
    specs.forEach((sp, i) => {
      const geo = new THREE.BoxGeometry(sp.w, h, sp.d);
      const mesh = new THREE.Mesh(geo, i % 2 === 0 ? mat : emissiveMat);
      mesh.position.set(sp.x, h / 2, sp.z);
      mesh.castShadow = true; mesh.receiveShadow = true;
      this.scene.add(mesh);
      this._addCollider(sp.x, sp.z, sp.w, sp.d);
    });
  }

  _buildObstacles() {
    const layout = [
      // 大型中央掩體
      { x: 0, z: 0, w: 8, h: 3, d: 8, c: 0x2c3555 },
      // 四角箱堆
      { x: -22, z: -22, w: 6, h: 4, d: 6, c: 0x3a2c4d },
      { x: 22, z: 22, w: 6, h: 4, d: 6, c: 0x3a2c4d },
      { x: -22, z: 22, w: 5, h: 2.5, d: 5, c: 0x274a45 },
      { x: 22, z: -22, w: 5, h: 2.5, d: 5, c: 0x274a45 },
      // 中距離矮牆
      { x: -12, z: 6, w: 3, h: 2, d: 10, c: 0x33405f },
      { x: 12, z: -6, w: 3, h: 2, d: 10, c: 0x33405f },
      { x: 0, z: -30, w: 14, h: 2.2, d: 2, c: 0x33405f },
      { x: 0, z: 30, w: 14, h: 2.2, d: 2, c: 0x33405f },
      { x: -34, z: 0, w: 2, h: 3, d: 12, c: 0x2c3555 },
      { x: 34, z: 0, w: 2, h: 3, d: 12, c: 0x2c3555 },
      // 散落小箱
      { x: 8, z: 14, w: 3, h: 1.6, d: 3, c: 0x4a3a2c },
      { x: -8, z: -14, w: 3, h: 1.6, d: 3, c: 0x4a3a2c },
      { x: 16, z: 0, w: 2.5, h: 1.4, d: 2.5, c: 0x4a3a2c },
      { x: -16, z: 0, w: 2.5, h: 1.4, d: 2.5, c: 0x4a3a2c },
    ];

    layout.forEach(o => {
      const mat = new THREE.MeshStandardMaterial({ color: o.c, roughness: 0.6, metalness: 0.35 });
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(o.w, o.h, o.d), mat);
      mesh.position.set(o.x, o.h / 2, o.z);
      mesh.castShadow = true; mesh.receiveShadow = true;
      this.scene.add(mesh);

      // 邊緣霓虹描邊
      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(mesh.geometry),
        new THREE.LineBasicMaterial({ color: 0x35e0c8, transparent: true, opacity: 0.35 })
      );
      edges.position.copy(mesh.position);
      this.scene.add(edges);

      this._addCollider(o.x, o.z, o.w, o.d);
      this.obstacles.push({ x: o.x, z: o.z, w: o.w, d: o.d, h: o.h });
    });
  }

  _buildSky() {
    const geo = new THREE.SphereGeometry(400, 32, 16);
    const c = document.createElement('canvas');
    c.width = 16; c.height = 256;
    const g = c.getContext('2d');
    const grad = g.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, '#05070f');
    grad.addColorStop(0.5, '#0d1430');
    grad.addColorStop(1, '#1b2444');
    g.fillStyle = grad; g.fillRect(0, 0, 16, 256);
    const tex = new THREE.CanvasTexture(c);
    const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false });
    this.scene.add(new THREE.Mesh(geo, mat));

    // 星星
    const starGeo = new THREE.BufferGeometry();
    const cnt = 800, pos = new Float32Array(cnt * 3);
    for (let i = 0; i < cnt; i++) {
      const r = 380;
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(Math.random() * 0.9 + 0.05);
      pos[i*3] = r * Math.sin(ph) * Math.cos(th);
      pos[i*3+1] = r * Math.cos(ph);
      pos[i*3+2] = r * Math.sin(ph) * Math.sin(th);
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xbcd4ff, size: 1.6, fog: false }));
    this.scene.add(stars);
  }

  _addCollider(cx, cz, w, d) {
    this.colliders.push({
      minX: cx - w / 2, maxX: cx + w / 2,
      minZ: cz - d / 2, maxZ: cz + d / 2
    });
  }

  // 圓形碰撞體與所有 AABB 解算 (XZ 平面)，回傳修正後座標
  resolve(x, z, radius) {
    for (const c of this.colliders) {
      const closestX = Utils.clamp(x, c.minX, c.maxX);
      const closestZ = Utils.clamp(z, c.minZ, c.maxZ);
      const dx = x - closestX, dz = z - closestZ;
      const d2 = dx * dx + dz * dz;
      if (d2 < radius * radius) {
        const d = Math.sqrt(d2) || 0.0001;
        const push = (radius - d);
        if (d2 > 0.00001) {
          x += (dx / d) * push;
          z += (dz / d) * push;
        } else {
          // 圓心在方塊內，沿最短軸推出
          const left = x - c.minX, right = c.maxX - x;
          const top = z - c.minZ, bottom = c.maxZ - z;
          const m = Math.min(left, right, top, bottom);
          if (m === left) x = c.minX - radius;
          else if (m === right) x = c.maxX + radius;
          else if (m === top) z = c.minZ - radius;
          else z = c.maxZ + radius;
        }
      }
    }
    // 場地邊界
    const lim = this.size - radius - 1;
    x = Utils.clamp(x, -lim, lim);
    z = Utils.clamp(z, -lim, lim);
    return { x, z };
  }

  // 射線是否被掩體遮擋 (用於 AI 視線 & 命中判定)，僅考量水平面 + 高度
  blocked(ox, oy, oz, tx, ty, tz) {
    const steps = 24;
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const px = Utils.lerp(ox, tx, t);
      const py = Utils.lerp(oy, ty, t);
      const pz = Utils.lerp(oz, tz, t);
      for (const o of this.obstacles) {
        if (px > o.x - o.w/2 && px < o.x + o.w/2 &&
            pz > o.z - o.d/2 && pz < o.z + o.d/2 &&
            py < o.h) {
          return true;
        }
      }
    }
    return false;
  }

  randomSpawn(minDistFrom, refX, refZ) {
    for (let tries = 0; tries < 60; tries++) {
      const x = Utils.rand(-this.size + 6, this.size - 6);
      const z = Utils.rand(-this.size + 6, this.size - 6);
      let ok = true;
      for (const c of this.colliders) {
        if (x > c.minX - 2 && x < c.maxX + 2 && z > c.minZ - 2 && z < c.maxZ + 2) { ok = false; break; }
      }
      if (ok && (minDistFrom === undefined || Utils.dist2D(x, z, refX, refZ) > minDistFrom)) {
        return { x, z };
      }
    }
    return { x: Utils.rand(-20, 20), z: Utils.rand(-20, 20) };
  }
}
