/* 通用工具函式 */
const Utils = {
  clamp(v, min, max) { return Math.max(min, Math.min(max, v)); },
  lerp(a, b, t) { return a + (b - a) * t; },
  rand(min, max) { return min + Math.random() * (max - min); },
  randInt(min, max) { return Math.floor(this.rand(min, max + 1)); },
  choice(arr) { return arr[Math.floor(Math.random() * arr.length)]; },
  deg(d) { return d * Math.PI / 180; },
  // 兩個 XZ 平面座標的距離
  dist2D(ax, az, bx, bz) { const dx = ax - bx, dz = az - bz; return Math.sqrt(dx * dx + dz * dz); },
  now() { return performance.now() / 1000; },
  isMobile() {
    return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
      ('ontouchstart' in window && navigator.maxTouchPoints > 0);
  },
  $(id) { return document.getElementById(id); }
};
