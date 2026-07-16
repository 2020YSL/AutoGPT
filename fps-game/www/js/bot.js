/* 敵方 AI 機器人：狀態機（巡邏 / 追擊 / 交火 / 側移走位）+ 命中玩家 */
class Bot {
  constructor(scene, game, x, z, cfg) {
    this.scene = scene;
    this.game = game;
    this.pos = { x, z };
    this.vel = { x: 0, z: 0 };
    this.angle = Utils.rand(0, Math.PI * 2);
    this.radius = 0.6;
    this.speed = cfg.speed;
    this.maxHealth = cfg.health;
    this.health = cfg.health;
    this.accuracy = cfg.accuracy;     // 0..1 命中機率
    this.fireInterval = cfg.fireInterval;
    this.damage = cfg.damage;
    this.reactTime = cfg.reactTime;
    this.viewRange = 55;

    this.alive = true;
    this.state = 'patrol';
    this._fireCd = Utils.rand(0.5, this.fireInterval);
    this._stateTime = 0;
    this._target = this._wander();
    this._strafeDir = Math.random() < 0.5 ? 1 : -1;
    this._strafeT = Utils.rand(1, 2.5);
    this._seenT = 0;

    this._build();
  }

  _build() {
    const g = new THREE.Group();
    const hue = Utils.rand(0, 0.12); // 敵人偏紅橙
    const bodyColor = new THREE.Color().setHSL(hue, 0.7, 0.45);
    const bodyMat = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.5, metalness: 0.4 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x15181f, roughness: 0.6, metalness: 0.5 });
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0xff3344, emissive: 0xff3344, emissiveIntensity: 1.2 });

    // 軀幹
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.1, 0.5), bodyMat);
    torso.position.y = 1.05; torso.castShadow = true; g.add(torso);
    // 頭
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), darkMat);
    head.position.y = 1.85; head.castShadow = true; g.add(head);
    // 眼帶
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.12, 0.1), eyeMat);
    visor.position.set(0, 1.88, 0.24); g.add(visor);
    this.visor = visor;
    // 腿
    const legMat = darkMat;
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.9, 0.3), legMat);
    legL.position.set(-0.22, 0.45, 0); legL.castShadow = true; g.add(legL);
    const legR = legL.clone(); legR.position.x = 0.22; g.add(legR);
    this.legL = legL; this.legR = legR;
    // 手臂 + 武器
    const armL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.8, 0.22), bodyMat);
    armL.position.set(-0.6, 1.15, 0.1); armL.castShadow = true; g.add(armL);
    const armR = armL.clone(); armR.position.x = 0.6; g.add(armR);
    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.6), darkMat);
    gun.position.set(0.6, 1.05, 0.4); g.add(gun);

    g.position.set(this.pos.x, 0, this.pos.z);
    this.scene.add(g);
    this.mesh = g;

    // 頭頂血條 (Sprite)
    this._buildHealthBar();
  }

  _buildHealthBar() {
    const c = document.createElement('canvas');
    c.width = 128; c.height = 20;
    this._hbCanvas = c; this._hbCtx = c.getContext('2d');
    this._drawHealthBar();
    const tex = new THREE.CanvasTexture(c);
    this._hbTex = tex;
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
    spr.scale.set(1.6, 0.25, 1);
    spr.position.y = 2.4;
    this.mesh.add(spr);
    this.healthBar = spr;
  }

  _drawHealthBar() {
    const g = this._hbCtx;
    g.clearRect(0, 0, 128, 20);
    g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(0, 0, 128, 20);
    const p = Utils.clamp(this.health / this.maxHealth, 0, 1);
    const col = p > 0.5 ? '#35e0c8' : (p > 0.25 ? '#ffcf5c' : '#ff5d6c');
    g.fillStyle = col; g.fillRect(2, 2, (128 - 4) * p, 16);
    g.strokeStyle = 'rgba(255,255,255,0.3)'; g.lineWidth = 2; g.strokeRect(1, 1, 126, 18);
    if (this._hbTex) this._hbTex.needsUpdate = true;
  }

  _wander() {
    return this.game.world.randomSpawn(undefined, this.pos.x, this.pos.z);
  }

  _canSeePlayer() {
    const p = this.game.player;
    const d = Utils.dist2D(this.pos.x, this.pos.z, p.pos.x, p.pos.z);
    if (d > this.viewRange) return false;
    return !this.game.world.blocked(this.pos.x, 1.6, this.pos.z, p.pos.x, 1.5, p.pos.z);
  }

  takeDamage(dmg, headshot) {
    if (!this.alive) return;
    this.health -= dmg;
    this._drawHealthBar();
    // 受擊閃白
    this._flash = 0.08;
    // 立即進入警戒
    this._seenT = 3;
    if (this.state === 'patrol') this.state = 'chase';
    if (this.health <= 0) this._die();
  }

  _die() {
    this.alive = false;
    this.state = 'dead';
    this.game.onBotKilled(this);
    // 死亡碎裂效果
    this._deathT = 0.6;
    if (this.healthBar) this.healthBar.visible = false;
  }

  update(dt) {
    if (!this.alive) {
      if (this._deathT > 0) {
        this._deathT -= dt;
        this.mesh.rotation.z += dt * 4;
        this.mesh.position.y -= dt * 2;
        this.mesh.scale.multiplyScalar(1 - dt * 1.5);
        if (this._deathT <= 0) { this.scene.remove(this.mesh); this._disposed = true; }
      }
      return;
    }

    this._stateTime += dt;
    const p = this.game.player;
    const canSee = this._canSeePlayer();
    if (canSee) this._seenT = 2.5; else this._seenT -= dt;
    const distToPlayer = Utils.dist2D(this.pos.x, this.pos.z, p.pos.x, p.pos.z);

    // ---- 狀態轉移 ----
    if (this._seenT > 0) {
      this.state = distToPlayer < 14 ? 'combat' : 'chase';
    } else if (this.state !== 'patrol') {
      this.state = 'patrol';
      this._target = this._wander();
    }

    let desired = { x: 0, z: 0 };

    if (this.state === 'patrol') {
      if (Utils.dist2D(this.pos.x, this.pos.z, this._target.x, this._target.z) < 2) this._target = this._wander();
      desired = this._steerTo(this._target.x, this._target.z);
    } else if (this.state === 'chase') {
      desired = this._steerTo(p.pos.x, p.pos.z);
    } else if (this.state === 'combat') {
      // 面向玩家並側移走位
      this._strafeT -= dt;
      if (this._strafeT <= 0) { this._strafeDir *= -1; this._strafeT = Utils.rand(1, 2.2); }
      const toX = p.pos.x - this.pos.x, toZ = p.pos.z - this.pos.z;
      const len = Math.hypot(toX, toZ) || 1;
      const nx = toX / len, nz = toZ / len;
      // 保持約 8~11 的交火距離
      let approach = 0;
      if (distToPlayer > 11) approach = 1;
      else if (distToPlayer < 7) approach = -1;
      const perpX = -nz * this._strafeDir, perpZ = nx * this._strafeDir;
      desired.x = nx * approach * 0.7 + perpX * 0.8;
      desired.z = nz * approach * 0.7 + perpZ * 0.8;
    }

    // 面向移動或玩家
    if (this.state === 'combat' || this.state === 'chase') {
      this.angle = Math.atan2(p.pos.x - this.pos.x, p.pos.z - this.pos.z);
    } else if (desired.x || desired.z) {
      this.angle = Math.atan2(desired.x, desired.z);
    }

    // 套用移動 + 碰撞
    const sp = this.speed * (this.state === 'combat' ? 0.85 : 1);
    let nx = this.pos.x + desired.x * sp * dt;
    let nz = this.pos.z + desired.z * sp * dt;
    const r = this.game.world.resolve(nx, nz, this.radius);
    // 與其他機器人簡易分離
    for (const other of this.game.bots) {
      if (other === this || !other.alive) continue;
      const dd = Utils.dist2D(r.x, r.z, other.pos.x, other.pos.z);
      const min = this.radius + other.radius;
      if (dd < min && dd > 0.001) {
        r.x += (r.x - other.pos.x) / dd * (min - dd) * 0.5;
        r.z += (r.z - other.pos.z) / dd * (min - dd) * 0.5;
      }
    }
    this.pos.x = r.x; this.pos.z = r.z;

    // ---- 開火 ----
    this._fireCd -= dt;
    if (this.state === 'combat' && canSee && this._fireCd <= 0 && this._stateTime > this.reactTime) {
      this._shoot(distToPlayer);
      this._fireCd = this.fireInterval * Utils.rand(0.8, 1.25);
    }

    this._animate(dt, desired);
  }

  _steerTo(tx, tz) {
    let dx = tx - this.pos.x, dz = tz - this.pos.z;
    const len = Math.hypot(dx, dz) || 1;
    dx /= len; dz /= len;
    // 前方障礙避讓：偵測前方是否有掩體，若有則側偏
    const aheadX = this.pos.x + dx * 2.2;
    const aheadZ = this.pos.z + dz * 2.2;
    for (const o of this.game.world.obstacles) {
      if (aheadX > o.x - o.w/2 - 0.6 && aheadX < o.x + o.w/2 + 0.6 &&
          aheadZ > o.z - o.d/2 - 0.6 && aheadZ < o.z + o.d/2 + 0.6) {
        // 垂直繞行
        const perpX = -dz, perpZ = dx;
        dx = dx * 0.3 + perpX * this._strafeDir;
        dz = dz * 0.3 + perpZ * this._strafeDir;
        const l2 = Math.hypot(dx, dz) || 1;
        dx /= l2; dz /= l2;
        break;
      }
    }
    return { x: dx, z: dz };
  }

  _shoot(dist) {
    Audio.enemyShoot();
    this.game.spawnEnemyTracer(this);
    // 命中判定：距離越遠越難命中
    const distFactor = Utils.clamp(1 - dist / 60, 0.35, 1);
    if (Math.random() < this.accuracy * distFactor) {
      this.game.onPlayerDamaged(this.damage * Utils.rand(0.8, 1.15));
    }
  }

  _animate(dt, desired) {
    this.mesh.rotation.y = this.angle;
    const moving = Math.abs(desired.x) + Math.abs(desired.z) > 0.05;
    if (moving) {
      this._walk = (this._walk || 0) + dt * 8;
      const s = Math.sin(this._walk) * 0.5;
      this.legL.rotation.x = s; this.legR.rotation.x = -s;
    } else {
      this.legL.rotation.x *= (1 - dt * 6); this.legR.rotation.x *= (1 - dt * 6);
    }
    // 受擊閃白
    if (this._flash > 0) {
      this._flash -= dt;
      this.visor.material.emissiveIntensity = 3;
    } else {
      this.visor.material.emissiveIntensity = 1.2;
    }
    // 血條面向相機
    if (this.healthBar) this.healthBar.material.rotation = 0;
  }
}
