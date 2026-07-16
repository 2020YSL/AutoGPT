/* 武器系統：射擊、換彈、後座力、槍口火光、彈道、第一人稱槍模型 */
class Weapon {
  constructor(scene, camera, game) {
    this.scene = scene;
    this.camera = camera;
    this.game = game;

    this.magSize = 30;
    this.ammo = 30;
    this.reserve = 120;
    this.fireRate = 0.095;      // 每發間隔秒
    this.damage = 26;
    this.spread = 0.012;        // 基礎散布
    this.reloadTime = 1.6;
    this.range = 200;

    this._cool = 0;
    this.reloading = false;
    this._reloadT = 0;
    this.recoil = 0;

    this.raycaster = new THREE.Raycaster();
    this._tracers = [];
    this._flashes = [];
    this._impacts = [];

    this._buildViewModel();
    this._buildMuzzleFlash();
  }

  _buildViewModel() {
    // 掛在相機下的簡易槍模型（第一人稱視角）
    this.vm = new THREE.Group();

    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x20242e, roughness: 0.5, metalness: 0.7 });
    const accentMat = new THREE.MeshStandardMaterial({ color: 0x35e0c8, roughness: 0.3, metalness: 0.6, emissive: 0x0a3d38, emissiveIntensity: 0.6 });

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 0.6), bodyMat);
    body.position.set(0, 0, -0.3);
    this.vm.add(body);

    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.5, 12), bodyMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.02, -0.65);
    this.vm.add(barrel);
    this.barrelTip = new THREE.Object3D();
    this.barrelTip.position.set(0, 0.02, -0.92);
    this.vm.add(this.barrelTip);

    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.22, 0.12), bodyMat);
    mag.position.set(0, -0.16, -0.2);
    this.vm.add(mag);

    const sight = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.05, 0.14), accentMat);
    sight.position.set(0, 0.11, -0.28);
    this.vm.add(sight);

    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.16, 0.09), bodyMat);
    grip.position.set(0, -0.14, 0.02); grip.rotation.x = 0.3;
    this.vm.add(grip);

    // 放到相機右下角
    this.vm.position.set(0.22, -0.2, -0.35);
    this.vm.traverse(o => { if (o.isMesh) o.castShadow = false; });
    this.camera.add(this.vm);
    this._vmBaseZ = -0.35;
  }

  _buildMuzzleFlash() {
    this.flash = new THREE.Mesh(
      new THREE.PlaneGeometry(0.35, 0.35),
      new THREE.MeshBasicMaterial({ color: 0xffdd88, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    this.flash.position.set(0, 0.02, -0.95);
    this.vm.add(this.flash);
    this.flashLight = new THREE.PointLight(0xffcc66, 0, 8);
    this.flash.add(this.flashLight);
  }

  tryReload() {
    if (this.reloading || this.ammo === this.magSize || this.reserve <= 0) return;
    this.reloading = true;
    this._reloadT = this.reloadTime;
    Audio.reload();
    this.game.ui.showReload(true);
  }

  update(dt, firing) {
    if (this._cool > 0) this._cool -= dt;
    this.recoil = Utils.lerp(this.recoil, 0, Math.min(1, dt * 10));

    // 換彈計時
    if (this.reloading) {
      this._reloadT -= dt;
      if (this._reloadT <= 0) {
        const need = this.magSize - this.ammo;
        const take = Math.min(need, this.reserve);
        this.ammo += take; this.reserve -= take;
        this.reloading = false;
        this.game.ui.showReload(false);
        this.game.ui.updateAmmo(this.ammo, this.reserve);
      }
    }

    // 開火
    if (firing && !this.reloading && this._cool <= 0) {
      if (this.ammo > 0) { this._fire(); }
      else { Audio.empty(); this._cool = 0.25; this.tryReload(); }
    }

    // 槍模型後座 / 呼吸擺動
    const t = Utils.now();
    const sway = Math.sin(t * 1.6) * 0.004;
    this.vm.position.z = this._vmBaseZ + this.recoil * 0.06;
    this.vm.position.y = -0.2 + sway + this.recoil * 0.01;
    this.vm.rotation.x = -this.recoil * 0.15;

    this._updateEffects(dt);
  }

  _fire() {
    this.ammo--;
    this._cool = this.fireRate;
    this.recoil = Math.min(1, this.recoil + 0.5);
    Audio.shoot();
    this.game.ui.updateAmmo(this.ammo, this.reserve);
    this.game.onPlayerShoot();

    // 由畫面中心射線 + 散布
    const spread = this.spread + this.recoil * 0.01;
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    dir.x += Utils.rand(-spread, spread);
    dir.y += Utils.rand(-spread, spread);
    dir.z += Utils.rand(-spread, spread);
    dir.normalize();

    const origin = new THREE.Vector3();
    this.camera.getWorldPosition(origin);

    // 對機器人做球體命中檢測
    const hit = this._raycastBots(origin, dir);
    let endPoint;
    if (hit) {
      endPoint = hit.point;
      const headshot = hit.head;
      const dmg = headshot ? this.damage * 2.2 : this.damage;
      hit.bot.takeDamage(dmg, headshot);
      this.game.onHit(headshot);
      this._spawnImpact(hit.point, 0xff5d6c, true);
    } else {
      // 命中環境或空中
      const wallHit = this._raycastWorld(origin, dir);
      endPoint = wallHit || origin.clone().add(dir.clone().multiplyScalar(this.range));
      if (wallHit) this._spawnImpact(wallHit, 0x9fd0ff, false);
    }

    this._spawnTracer(this.barrelTipWorld(), endPoint);
    this._triggerFlash();
  }

  barrelTipWorld() {
    const v = new THREE.Vector3();
    this.barrelTip.getWorldPosition(v);
    return v;
  }

  _raycastBots(origin, dir) {
    let best = null, bestT = Infinity;
    for (const bot of this.game.bots) {
      if (!bot.alive) continue;
      // 身體球體 (中心約 y=1) 與頭部球體 (y=1.7)
      const parts = [
        { c: new THREE.Vector3(bot.pos.x, 1.0, bot.pos.z), r: 0.75, head: false },
        { c: new THREE.Vector3(bot.pos.x, 1.75, bot.pos.z), r: 0.42, head: true },
      ];
      for (const p of parts) {
        const t = this._raySphere(origin, dir, p.c, p.r);
        if (t !== null && t < bestT && t <= this.range) {
          // 確認未被牆擋住
          const point = origin.clone().add(dir.clone().multiplyScalar(t));
          if (!this.game.world.blocked(origin.x, origin.y, origin.z, point.x, point.y, point.z)) {
            bestT = t;
            best = { bot, point, head: p.head };
          }
        }
      }
    }
    return best;
  }

  _raySphere(origin, dir, center, radius) {
    const oc = origin.clone().sub(center);
    const b = oc.dot(dir);
    const c = oc.dot(oc) - radius * radius;
    const disc = b * b - c;
    if (disc < 0) return null;
    const t = -b - Math.sqrt(disc);
    return t >= 0 ? t : null;
  }

  _raycastWorld(origin, dir) {
    // 對場地牆與掩體做簡易步進檢測
    const w = this.game.world;
    const steps = 120, maxT = this.range;
    let prev = origin.clone();
    for (let i = 1; i <= steps; i++) {
      const t = (i / steps) * maxT;
      const p = origin.clone().add(dir.clone().multiplyScalar(t));
      if (p.y <= 0.02) { p.y = 0.02; return p; }        // 地面
      for (const o of w.obstacles) {
        if (p.x > o.x - o.w/2 && p.x < o.x + o.w/2 &&
            p.z > o.z - o.d/2 && p.z < o.z + o.d/2 && p.y < o.h) {
          return prev;
        }
      }
      if (Math.abs(p.x) > w.size || Math.abs(p.z) > w.size) return prev;
      prev = p;
    }
    return null;
  }

  _triggerFlash() {
    this.flash.material.opacity = 1;
    this.flash.rotation.z = Utils.rand(0, Math.PI);
    this.flash.scale.setScalar(Utils.rand(0.8, 1.3));
    this.flashLight.intensity = 3;
    this._flashes.push(0.06);
  }

  _spawnTracer(from, to) {
    const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
    const mat = new THREE.LineBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending });
    const line = new THREE.Line(geo, mat);
    this.scene.add(line);
    this._tracers.push({ line, life: 0.06 });
  }

  _spawnImpact(point, color, isBot) {
    const count = isBot ? 10 : 6;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) { pos[i*3] = point.x; pos[i*3+1] = point.y; pos[i*3+2] = point.z; }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ color, size: 0.14, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false });
    const pts = new THREE.Points(geo, mat);
    this.scene.add(pts);
    const vels = [];
    for (let i = 0; i < count; i++) {
      vels.push(new THREE.Vector3(Utils.rand(-1,1), Utils.rand(0.2,1.5), Utils.rand(-1,1)).multiplyScalar(3));
    }
    this._impacts.push({ pts, vels, life: 0.4, max: 0.4 });
  }

  _updateEffects(dt) {
    // flash
    if (this._flashes.length) {
      this._flashes[0] -= dt;
      if (this._flashes[0] <= 0) {
        this.flash.material.opacity = 0;
        this.flashLight.intensity = 0;
        this._flashes.shift();
      } else {
        this.flash.material.opacity = Math.max(0, this.flash.material.opacity - dt * 12);
        this.flashLight.intensity = Math.max(0, this.flashLight.intensity - dt * 40);
      }
    }
    // tracers
    for (let i = this._tracers.length - 1; i >= 0; i--) {
      const tr = this._tracers[i];
      tr.life -= dt;
      tr.line.material.opacity = Math.max(0, tr.life / 0.06) * 0.9;
      if (tr.life <= 0) { this.scene.remove(tr.line); tr.line.geometry.dispose(); tr.line.material.dispose(); this._tracers.splice(i, 1); }
    }
    // impacts
    for (let i = this._impacts.length - 1; i >= 0; i--) {
      const im = this._impacts[i];
      im.life -= dt;
      const arr = im.pts.geometry.attributes.position.array;
      for (let k = 0; k < im.vels.length; k++) {
        im.vels[k].y -= 9 * dt;
        arr[k*3] += im.vels[k].x * dt;
        arr[k*3+1] += im.vels[k].y * dt;
        arr[k*3+2] += im.vels[k].z * dt;
      }
      im.pts.geometry.attributes.position.needsUpdate = true;
      im.pts.material.opacity = Math.max(0, im.life / im.max);
      if (im.life <= 0) { this.scene.remove(im.pts); im.pts.geometry.dispose(); im.pts.material.dispose(); this._impacts.splice(i, 1); }
    }
  }

  reset() {
    this.ammo = this.magSize;
    this.reserve = 120;
    this.reloading = false;
    this._cool = 0;
    this.recoil = 0;
    this.game.ui.showReload(false);
    this.game.ui.updateAmmo(this.ammo, this.reserve);
  }

  addAmmo(n) { this.reserve = Math.min(300, this.reserve + n); this.game.ui.updateAmmo(this.ammo, this.reserve); }
}
