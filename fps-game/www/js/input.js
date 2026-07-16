/* 統一輸入層：鍵盤 / 滑鼠 / 觸控 */
class InputManager {
  constructor() {
    this.keys = {};
    this.move = { x: 0, y: 0 };      // 移動向量 (-1..1)
    this.look = { dx: 0, dy: 0 };    // 每幀視角增量
    this.firing = false;
    this.wantJump = false;
    this.wantReload = false;
    this.sprint = false;
    this.sensitivity = 0.0022;
    this.touchSensitivity = 0.004;
    this.pointerLocked = false;
    this.mobile = Utils.isMobile();
    this._touchLookId = null;
    this._touchLookLast = null;
    this._moveTouchId = null;
    this.enabled = false;
  }

  setup(canvas) {
    this.canvas = canvas;

    // ---- 鍵盤 ----
    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
      if (e.code === 'KeyR') this.wantReload = true;
      if (e.code === 'Space') this.wantJump = true;
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.sprint = true;
      if (['KeyW','KeyA','KeyS','KeyD','Space'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.sprint = false;
    });

    // ---- 滑鼠 (Pointer Lock) ----
    document.addEventListener('pointerlockchange', () => {
      this.pointerLocked = (document.pointerLockElement === canvas);
    });
    document.addEventListener('mousemove', (e) => {
      if (this.pointerLocked && this.enabled) {
        this.look.dx += e.movementX * this.sensitivity;
        this.look.dy += e.movementY * this.sensitivity;
      }
    });
    canvas.addEventListener('mousedown', (e) => {
      if (!this.enabled) return;
      if (e.button === 0) this.firing = true;
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.firing = false;
    });

    // ---- 觸控 ----
    if (this.mobile) this._setupTouch();
  }

  requestPointerLock() {
    if (!this.mobile && this.canvas.requestPointerLock) this.canvas.requestPointerLock();
  }
  exitPointerLock() {
    if (document.exitPointerLock) document.exitPointerLock();
  }

  _setupTouch() {
    const stick = Utils.$('move-stick');
    const knob = stick.querySelector('.stick-knob');
    const base = stick.querySelector('.stick-base');
    const radius = 52;

    const stickStart = (e) => {
      const t = e.changedTouches[0];
      this._moveTouchId = t.identifier;
      this._updateStick(t, stick, knob, radius);
      e.preventDefault();
    };
    const findTouch = (list, id) => {
      for (let i = 0; i < list.length; i++) if (list[i].identifier === id) return list[i];
      return null;
    };
    stick.addEventListener('touchstart', stickStart, { passive: false });

    window.addEventListener('touchmove', (e) => {
      if (!this.enabled) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (t.identifier === this._moveTouchId) {
          this._updateStick(t, stick, knob, radius);
        } else if (t.identifier === this._touchLookId) {
          if (this._touchLookLast) {
            this.look.dx += (t.clientX - this._touchLookLast.x) * this.touchSensitivity;
            this.look.dy += (t.clientY - this._touchLookLast.y) * this.touchSensitivity;
          }
          this._touchLookLast = { x: t.clientX, y: t.clientY };
        }
      }
      e.preventDefault();
    }, { passive: false });

    // 右半螢幕滑動 => 視角
    window.addEventListener('touchstart', (e) => {
      if (!this.enabled) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        const isUI = t.target.closest('#touch-ui .stick, #touch-ui .tbtn, .corner-btn');
        if (!isUI && t.identifier !== this._moveTouchId && this._touchLookId === null) {
          this._touchLookId = t.identifier;
          this._touchLookLast = { x: t.clientX, y: t.clientY };
        }
      }
    }, { passive: false });

    const endTouch = (e) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (t.identifier === this._moveTouchId) {
          this._moveTouchId = null; this.move.x = 0; this.move.y = 0;
          knob.style.transform = 'translate(-50%, -50%)';
        }
        if (t.identifier === this._touchLookId) {
          this._touchLookId = null; this._touchLookLast = null;
        }
      }
    };
    window.addEventListener('touchend', endTouch);
    window.addEventListener('touchcancel', endTouch);

    // 按鈕
    const fire = Utils.$('btn-fire');
    fire.addEventListener('touchstart', (e) => { this.firing = true; e.preventDefault(); }, { passive: false });
    fire.addEventListener('touchend', (e) => { this.firing = false; e.preventDefault(); }, { passive: false });
    Utils.$('btn-reload').addEventListener('touchstart', (e) => { this.wantReload = true; e.preventDefault(); }, { passive: false });
    Utils.$('btn-jump').addEventListener('touchstart', (e) => { this.wantJump = true; e.preventDefault(); }, { passive: false });
  }

  _updateStick(t, stick, knob, radius) {
    const r = stick.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    let dx = t.clientX - cx;
    let dy = t.clientY - cy;
    const len = Math.hypot(dx, dy);
    if (len > radius) { dx = dx / len * radius; dy = dy / len * radius; }
    knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    this.move.x = dx / radius;
    this.move.y = dy / radius;
  }

  // 每幀取用後清除的一次性旗標
  consumeLook() {
    const l = { dx: this.look.dx, dy: this.look.dy };
    this.look.dx = 0; this.look.dy = 0;
    return l;
  }

  getMoveVector() {
    if (this.mobile) return { x: this.move.x, y: this.move.y };
    let x = 0, y = 0;
    if (this.keys['KeyW']) y -= 1;
    if (this.keys['KeyS']) y += 1;
    if (this.keys['KeyA']) x -= 1;
    if (this.keys['KeyD']) x += 1;
    const len = Math.hypot(x, y);
    if (len > 0) { x /= len; y /= len; }
    return { x, y };
  }

  consumeReload() { const r = this.wantReload; this.wantReload = false; return r; }
  consumeJump() { const j = this.wantJump; this.wantJump = false; return j; }
}

const Input = new InputManager();
