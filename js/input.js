export class Input {
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.keys = new Set();
    this.pressed = new Set();
    this.look = { x: 0, y: 0 };
    this.sensitivity = opts.sensitivity ?? 0.0023;
    this.locked = false;
    this.enabled = false;
    this.touch = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 1;
    this.joy = { x: 0, y: 0, active: false };
    this.touchSprint = false;
    this._bind();
    if (this.touch) document.body.classList.add('touch');
  }

  _bind() {
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      const c = e.code;
      this.keys.add(c);
      this.pressed.add(c);
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(c)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => { this.keys.clear(); this.touchSprint = false; this.joy.active = false; this.joy.x = this.joy.y = 0; });

    document.addEventListener('mousemove', (e) => {
      if (!this.locked || !this.enabled) return;
      this.look.x += e.movementX;
      this.look.y += e.movementY;
    });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.canvas;
      if (!this.locked) {
        // let the game decide whether this is a pause (only when actually playing)
        window.dispatchEvent(new CustomEvent('esconderte:unlock'));
      }
    });
    this.canvas.addEventListener('mousedown', (e) => {
      if (this.enabled && !this.locked && e.button === 0) this.requestLock();
    });

    // touch joystick
    const joy = document.getElementById('joy');
    if (joy) {
      const knob = document.getElementById('joy-knob');
      const update = (e) => {
        const r = joy.getBoundingClientRect();
        const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        let dx = e.clientX - cx, dy = e.clientY - cy;
        const max = r.width * 0.36;
        const d = Math.hypot(dx, dy);
        if (d > max) { dx = (dx / d) * max; dy = (dy / d) * max; }
        this.joy.x = dx / max;
        this.joy.y = dy / max;
        this.joy.active = true;
        knob.style.transform = `translate(${dx}px,${dy}px)`;
      };
      const end = () => {
        this.joy.x = this.joy.y = 0;
        this.joy.active = false;
        knob.style.transform = 'none';
      };
      joy.addEventListener('pointerdown', (e) => { e.preventDefault(); joy.setPointerCapture(e.pointerId); update(e); });
      joy.addEventListener('pointermove', (e) => { if (this.joy.active) { e.preventDefault(); update(e); } });
      joy.addEventListener('pointerup', end);
      joy.addEventListener('pointercancel', end);
    }

    const actions = document.querySelectorAll('.touch-actions button');
    actions.forEach((btn) => {
      const action = btn.dataset.action;
      const down = (e) => {
        e.preventDefault();
        if (action === 'sprint') this.touchSprint = true;
        else this.pressed.add(action === 'ability' ? 'KeyF' : 'KeyE');
      };
      const up = () => { if (action === 'sprint') this.touchSprint = false; };
      btn.addEventListener('pointerdown', down);
      btn.addEventListener('pointerup', up);
      btn.addEventListener('pointercancel', up);
    });

    // touch look: drag on the right-hand side of the screen
    let lookId = null, lx = 0, ly = 0;
    this.canvas.addEventListener('pointerdown', (e) => {
      if (!this.touch || !this.enabled || e.pointerType !== 'touch') return;
      if (e.clientX < window.innerWidth * 0.42) return;
      lookId = e.pointerId; lx = e.clientX; ly = e.clientY;
    });
    this.canvas.addEventListener('pointermove', (e) => {
      if (e.pointerId !== lookId) return;
      this.look.x += (e.clientX - lx) * 1.6;
      this.look.y += (e.clientY - ly) * 1.6;
      lx = e.clientX; ly = e.clientY;
    });
    const endLook = (e) => { if (e.pointerId === lookId) lookId = null; };
    this.canvas.addEventListener('pointerup', endLook);
    this.canvas.addEventListener('pointercancel', endLook);
  }

  requestLock() {
    if (this.touch) return;
    this.canvas.requestPointerLock?.();
  }

  releaseLock() {
    if (document.pointerLockElement) document.exitPointerLock();
  }

  down(code) { return this.keys.has(code); }
  hit(code) { return this.pressed.has(code); }
  consume(code) { const v = this.pressed.has(code); this.pressed.delete(code); return v; }

  get sprint() { return this.down('ShiftLeft') || this.down('ShiftRight') || this.touchSprint; }
  get crouch() { return this.down('KeyC') || this.down('ControlLeft'); }

  moveVector() {
    let x = 0, z = 0;
    if (this.down('KeyW') || this.down('ArrowUp')) z += 1;
    if (this.down('KeyS') || this.down('ArrowDown')) z -= 1;
    if (this.down('KeyA') || this.down('ArrowLeft')) x -= 1;
    if (this.down('KeyD') || this.down('ArrowRight')) x += 1;
    if (this.joy.active) { x += this.joy.x; z -= this.joy.y; }
    const len = Math.hypot(x, z);
    if (len > 1) { x /= len; z /= len; }
    return { x, z };
  }

  takeLook() {
    const l = this.look;
    this.look = { x: 0, y: 0 };
    return l;
  }

  endFrame() {
    this.pressed.clear();
  }

  reset() {
    this.keys.clear();
    this.pressed.clear();
    this.look.x = this.look.y = 0;
    this.joy.x = this.joy.y = 0;
    this.joy.active = false;
    this.touchSprint = false;
  }
}
