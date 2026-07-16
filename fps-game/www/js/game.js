/* 主程式：場景、玩家、迴圈、波次、UI、狀態機 */

const DIFFICULTY = {
  easy:   { botHealth: 70,  botAcc: 0.10, botFire: 1.4, botSpeed: 3.2, botDmg: 5,  react: 0.7, base: 3, perWave: 1, maxAlive: 4 },
  normal: { botHealth: 100, botAcc: 0.16, botFire: 1.1, botSpeed: 4.0, botDmg: 8,  react: 0.5, base: 4, perWave: 2, maxAlive: 6 },
  hard:   { botHealth: 130, botAcc: 0.24, botFire: 0.85, botSpeed: 4.7, botDmg: 11, react: 0.35, base: 5, perWave: 2, maxAlive: 8 },
};

class UI {
  constructor() {
    this.kills = Utils.$('kills');
    this.enemiesLeft = Utils.$('enemies-left');
    this.score = Utils.$('score');
    this.wave = Utils.$('wave');
    this.healthFill = Utils.$('health-fill');
    this.healthText = Utils.$('health-text');
    this.ammoCur = Utils.$('ammo-cur');
    this.ammoReserve = Utils.$('ammo-reserve');
    this.reloadHint = Utils.$('reload-hint');
    this.crosshair = Utils.$('crosshair');
    this.hitmarker = Utils.$('hitmarker');
    this.vignette = Utils.$('damage-vignette');
    this.killfeed = Utils.$('killfeed');
  }
  updateKills(v) { this.kills.textContent = v; }
  updateEnemies(v) { this.enemiesLeft.textContent = v; }
  updateScore(v) { this.score.textContent = v; }
  updateWave(v) { this.wave.textContent = v; }
  updateHealth(v) {
    v = Math.max(0, Math.round(v));
    this.healthFill.style.width = v + '%';
    this.healthText.textContent = v;
  }
  updateAmmo(cur, reserve) { this.ammoCur.textContent = cur; this.ammoReserve.textContent = reserve; }
  showReload(on) { this.reloadHint.classList.toggle('hidden', !on); }
  hitmarkerFlash(headshot) {
    this.hitmarker.classList.remove('hidden');
    this.hitmarker.style.filter = headshot ? 'drop-shadow(0 0 6px #ffcf5c)' : 'none';
    void this.hitmarker.offsetWidth;
    this.hitmarker.style.animation = 'none';
    void this.hitmarker.offsetWidth;
    this.hitmarker.style.animation = '';
    clearTimeout(this._hmT);
    this._hmT = setTimeout(() => this.hitmarker.classList.add('hidden'), 250);
  }
  recoil() {
    this.crosshair.classList.add('recoil');
    clearTimeout(this._rcT);
    this._rcT = setTimeout(() => this.crosshair.classList.remove('recoil'), 80);
  }
  damageFlash() {
    this.vignette.style.opacity = '0.8';
    clearTimeout(this._dfT);
    this._dfT = setTimeout(() => this.vignette.style.opacity = '0', 130);
  }
  addKillfeed(text) {
    const el = document.createElement('div');
    el.className = 'kf-item';
    el.textContent = text;
    this.killfeed.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .4s'; }, 2600);
    setTimeout(() => el.remove(), 3100);
    while (this.killfeed.children.length > 4) this.killfeed.removeChild(this.killfeed.firstChild);
  }
}

class Game {
  constructor() {
    this.ui = new UI();
    this.state = 'menu';      // menu | playing | paused | gameover
    this.difficulty = 'normal';
    this.bots = [];
    this.player = {
      pos: { x: 0, z: 0 }, vel: { x: 0, z: 0 },
      y: 1.6, vy: 0, onGround: true,
      yaw: 0, pitch: 0,
      health: 100, maxHealth: 100,
      radius: 0.5, height: 1.6, speed: 6.2, sprintSpeed: 9,
    };
    this.kills = 0; this.score = 0; this.waveNum = 0;
    this._enemyTracers = [];
    this._spawnQueue = 0;
    this._spawnTimer = 0;
    this._regenTimer = 0;
    this._lastDamageT = 0;
  }

  init() {
    this._initThree();
    this.world = new World(this.scene);
    this.world.build();
    this.weapon = new Weapon(this.scene, this.camera, this);
    this._bindUI();
    window.addEventListener('resize', () => this._onResize());
    Utils.$('loading').classList.add('hidden');
    this._clock = Utils.now();
    this._loop();
  }

  _initThree() {
    this.canvas = Utils.$('game-canvas');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    if (THREE.sRGBEncoding !== undefined) this.renderer.outputEncoding = THREE.sRGBEncoding;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.05, 500);
    this.camera.position.set(0, this.player.y, 0);
    this.scene.add(this.camera);
  }

  _bindUI() {
    // 難度
    document.querySelectorAll('.diff-btn').forEach(b => {
      b.addEventListener('click', () => {
        document.querySelectorAll('.diff-btn').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        this.difficulty = b.dataset.diff;
      });
    });
    Utils.$('btn-start').addEventListener('click', () => this.start());
    Utils.$('btn-retry').addEventListener('click', () => this.start());
    Utils.$('btn-menu').addEventListener('click', () => this.toMenu());
    Utils.$('btn-resume').addEventListener('click', () => this.resume());
    Utils.$('btn-quit').addEventListener('click', () => this.toMenu());
    Utils.$('btn-pause').addEventListener('click', () => this.pause());

    Input.setup(this.canvas);

    // 桌機：點畫布重新鎖定滑鼠
    this.canvas.addEventListener('click', () => {
      if (this.state === 'playing' && !Input.mobile && !Input.pointerLocked) Input.requestPointerLock();
    });
    document.addEventListener('pointerlockchange', () => {
      if (this.state === 'playing' && !Input.pointerLocked && !Input.mobile) this.pause();
    });
    // Esc 暫停 (桌機)
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape' && this.state === 'playing') this.pause();
    });
  }

  start() {
    Audio.init(); Audio.resume();
    this.cfg = DIFFICULTY[this.difficulty];
    // 重置
    this.bots.forEach(b => { if (b.mesh) this.scene.remove(b.mesh); });
    this.bots = [];
    this._clearEnemyTracers();
    this.kills = 0; this.score = 0; this.waveNum = 0;
    this._spawnQueue = 0; this._spawnTimer = 0;
    Object.assign(this.player, {
      pos: { x: 0, z: 0 }, vel: { x: 0, z: 0 }, y: 1.6, vy: 0, onGround: true,
      yaw: 0, pitch: 0, health: 100
    });
    this.weapon.reset();
    this.ui.updateKills(0); this.ui.updateScore(0); this.ui.updateHealth(100);

    this._show('menu', false); this._show('gameover', false); this._show('pause', false);
    this._show('hud', true); this._show('crosshair', true);
    Utils.$('btn-pause').classList.remove('hidden');
    if (Input.mobile) this._show('touch-ui', true);

    this.state = 'playing';
    Input.enabled = true;
    if (!Input.mobile) Input.requestPointerLock();

    this._nextWave();
  }

  _nextWave() {
    this.waveNum++;
    this.ui.updateWave(this.waveNum);
    const total = this.cfg.base + (this.waveNum - 1) * this.cfg.perWave;
    this._spawnQueue = total;
    this._waveRemaining = total;
    this.ui.updateEnemies(total);
    Audio.wave();
    this.ui.addKillfeed(`⚔ 第 ${this.waveNum} 波 · ${total} 名敵人`);
  }

  _trySpawn(dt) {
    if (this._spawnQueue <= 0) return;
    const aliveCount = this.bots.filter(b => b.alive).length;
    if (aliveCount >= this.cfg.maxAlive) return;
    this._spawnTimer -= dt;
    if (this._spawnTimer > 0) return;
    this._spawnTimer = Utils.rand(0.6, 1.4);

    const sp = this.world.randomSpawn(22, this.player.pos.x, this.player.pos.z);
    // 難度隨波次微幅提升
    const scale = 1 + (this.waveNum - 1) * 0.06;
    const bot = new Bot(this.scene, this, sp.x, sp.z, {
      health: this.cfg.botHealth * scale,
      accuracy: Math.min(0.5, this.cfg.botAcc * scale),
      fireInterval: this.cfg.botFire,
      speed: this.cfg.botSpeed,
      damage: this.cfg.botDmg,
      reactTime: this.cfg.react,
    });
    this.bots.push(bot);
    this._spawnQueue--;
  }

  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    Input.enabled = false;
    Input.exitPointerLock();
    this._show('pause', true);
  }
  resume() {
    if (this.state !== 'paused') return;
    this._show('pause', false);
    this.state = 'playing';
    Input.enabled = true;
    Audio.resume();
    if (!Input.mobile) Input.requestPointerLock();
  }
  toMenu() {
    this.state = 'menu';
    Input.enabled = false;
    Input.exitPointerLock();
    this._show('pause', false); this._show('gameover', false);
    this._show('hud', false); this._show('crosshair', false);
    this._show('touch-ui', false);
    Utils.$('btn-pause').classList.add('hidden');
    this._show('menu', true);
  }
  gameOver() {
    this.state = 'gameover';
    Input.enabled = false;
    Input.exitPointerLock();
    Utils.$('go-kills').textContent = this.kills;
    Utils.$('go-score').textContent = this.score;
    Utils.$('go-wave').textContent = this.waveNum;
    Utils.$('go-title').textContent = '任務結束';
    this._show('hud', false); this._show('crosshair', false); this._show('touch-ui', false);
    Utils.$('btn-pause').classList.add('hidden');
    this._show('gameover', true);
  }

  // ---- 回呼 ----
  onPlayerShoot() { this.ui.recoil(); }
  onHit(headshot) { Audio.hit(); this.ui.hitmarkerFlash(headshot); }
  onBotKilled(bot) {
    this.kills++;
    this.score += bot._headshotKill ? 150 : 100;
    Audio.kill();
    this.ui.updateKills(this.kills);
    this.ui.updateScore(this.score);
    this._waveRemaining--;
    this.ui.updateEnemies(Math.max(0, this._waveRemaining));
    this.ui.addKillfeed('☠ 擊倒敵人 +100');
    // 偶爾補彈
    if (Math.random() < 0.4) this.weapon.addAmmo(15);
    // 波次清空 => 下一波
    if (this._waveRemaining <= 0 && this._spawnQueue <= 0) {
      // 回血獎勵
      this.player.health = Math.min(this.player.maxHealth, this.player.health + 25);
      this.ui.updateHealth(this.player.health);
      setTimeout(() => { if (this.state === 'playing') this._nextWave(); }, 2500);
    }
  }
  onPlayerDamaged(dmg) {
    if (this.state !== 'playing') return;
    this.player.health -= dmg;
    this._lastDamageT = Utils.now();
    Audio.hurt();
    this.ui.damageFlash();
    this.ui.updateHealth(this.player.health);
    if (this.player.health <= 0) { this.player.health = 0; this.ui.updateHealth(0); this.gameOver(); }
  }

  spawnEnemyTracer(bot) {
    const from = new THREE.Vector3(bot.pos.x + Math.sin(bot.angle) * 0.6, 1.3, bot.pos.z + Math.cos(bot.angle) * 0.6);
    const to = new THREE.Vector3(this.player.pos.x, this.player.y, this.player.pos.z);
    // 稍微偏移，看起來像掃射
    to.x += Utils.rand(-0.6, 0.6); to.y += Utils.rand(-0.4, 0.4); to.z += Utils.rand(-0.6, 0.6);
    const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
    const mat = new THREE.LineBasicMaterial({ color: 0xff6655, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending });
    const line = new THREE.Line(geo, mat);
    this.scene.add(line);
    this._enemyTracers.push({ line, life: 0.08 });
  }
  _clearEnemyTracers() {
    this._enemyTracers.forEach(t => { this.scene.remove(t.line); t.line.geometry.dispose(); t.line.material.dispose(); });
    this._enemyTracers = [];
  }

  _updatePlayer(dt) {
    const p = this.player;
    const look = Input.consumeLook();
    p.yaw -= look.dx;
    p.pitch -= look.dy;
    p.pitch = Utils.clamp(p.pitch, -Math.PI / 2 + 0.05, Math.PI / 2 - 0.05);

    // 移動 (相對朝向)
    const mv = Input.getMoveVector();
    const sinY = Math.sin(p.yaw), cosY = Math.cos(p.yaw);
    // 前進為 -z
    const forwardX = -sinY, forwardZ = -cosY;
    const rightX = cosY, rightZ = -sinY;
    let wishX = forwardX * (-mv.y) + rightX * mv.x;
    let wishZ = forwardZ * (-mv.y) + rightZ * mv.x;
    const wl = Math.hypot(wishX, wishZ);
    if (wl > 1) { wishX /= wl; wishZ /= wl; }

    const sprint = Input.sprint && mv.y < -0.1;
    const speed = sprint ? p.sprintSpeed : p.speed;
    p.pos.x += wishX * speed * dt;
    p.pos.z += wishZ * speed * dt;

    // 碰撞
    const r = this.world.resolve(p.pos.x, p.pos.z, p.radius);
    p.pos.x = r.x; p.pos.z = r.z;

    // 跳躍 / 重力
    if (Input.consumeJump() && p.onGround) { p.vy = 6.2; p.onGround = false; }
    p.vy -= 20 * dt;
    p.y += p.vy * dt;
    if (p.y <= 1.6) { p.y = 1.6; p.vy = 0; p.onGround = true; }

    // 相機
    this.camera.position.set(p.pos.x, p.y, p.pos.z);
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = p.yaw;
    this.camera.rotation.x = p.pitch;

    // 生命緩慢回復（脫離戰鬥後）
    if (Utils.now() - this._lastDamageT > 5 && p.health < p.maxHealth) {
      this._regenTimer += dt;
      if (this._regenTimer > 0.4) {
        this._regenTimer = 0;
        p.health = Math.min(p.maxHealth, p.health + 2);
        this.ui.updateHealth(p.health);
      }
    }
  }

  _updateEnemyTracers(dt) {
    for (let i = this._enemyTracers.length - 1; i >= 0; i--) {
      const t = this._enemyTracers[i];
      t.life -= dt;
      t.line.material.opacity = Math.max(0, t.life / 0.08) * 0.8;
      if (t.life <= 0) { this.scene.remove(t.line); t.line.geometry.dispose(); t.line.material.dispose(); this._enemyTracers.splice(i, 1); }
    }
  }

  _loop() {
    requestAnimationFrame(() => this._loop());
    const now = Utils.now();
    let dt = now - this._clock;
    this._clock = now;
    if (dt > 0.05) dt = 0.05;  // 防止分頁切換造成大跳動

    if (this.state === 'playing') {
      this._updatePlayer(dt);
      this._trySpawn(dt);
      for (const bot of this.bots) bot.update(dt);
      // 清除已消失的機器人
      this.bots = this.bots.filter(b => !b._disposed);
      this.weapon.update(dt, Input.firing);
      this._updateEnemyTracers(dt);
    }

    this.renderer.render(this.scene, this.camera);
  }

  _onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  _show(id, on) { Utils.$(id).classList.toggle('hidden', !on); }
}

window.addEventListener('load', () => {
  const game = new Game();
  window.__game = game;
  game.init();
});
