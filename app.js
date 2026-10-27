/* ==========================================================================
   FISIOAR | app.js
   Sin dependencias. Un solo bucle rAF lee el scroll y escribe variables CSS (--p)
   en las escenas; el CSS decide qué hacer con ellas.
   Módulos: 0 config y utilidades, 1 textos, 2 loader, 3 escenas, 4 navegación,
   5 WebGL (cinta 3D y morfosis de partículas), 6 galería y tarjetas apiladas,
   7 interacciones, 8 formulario, 9 arranque.
   ========================================================================== */
(() => {
  'use strict';

  /* ------------------------------------------------------------------------
     0. CONFIG Y UTILIDADES
     ------------------------------------------------------------------------ */
  const CONFIG = {
    phone: '528331349348',                 // WhatsApp del negocio (lada 52 + 10 dígitos)
    waBase: 'https://wa.me/',
    loaderMin: 2300,                       // ms mínimos del loader
    loaderMax: 6500                        // ms máximos (red lenta)
  };

  const root = document.documentElement;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (t) => t * t * (3 - 2 * t);
  const mqReduce = matchMedia('(prefers-reduced-motion: reduce)');
  const prefersReduced = mqReduce.matches;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const isDesktop = () => matchMedia('(min-width: 900px)').matches;
  const isSmall = () => matchMedia('(max-width: 700px)').matches;

  // marca que JS funciona: a partir de aquí el CSS puede ocultar elementos para revelarlos
  root.classList.add('js-ready');

  // enlaces de WhatsApp con mensaje prellenado
  const waLink = (msg) => `${CONFIG.waBase}${CONFIG.phone}?text=${encodeURIComponent(msg)}`;
  $$('[data-wa]').forEach((a) => { a.href = waLink(a.dataset.wa); });

  /* ------------------------------------------------------------------------
     1. TEXTOS: partir en palabras (revelado con máscara y palabras que se iluminan)
     ------------------------------------------------------------------------ */
  function wrapWords(el, mk) {
    let idx = 0;
    const walk = (node) => {
      Array.from(node.childNodes).forEach((child) => {
        if (child.nodeType === 3) {
          const frag = document.createDocumentFragment();
          child.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
            frag.appendChild(mk(part, idx++));
          });
          child.replaceWith(frag);
        } else if (child.nodeType === 1) {
          walk(child);
        }
      });
    };
    walk(el);
    return idx;
  }

  $$('[data-split]').forEach((el) => {
    el.setAttribute('aria-label', el.textContent.replace(/\s+/g, ' ').trim());
    wrapWords(el, (word, i) => {
      const w = document.createElement('span');
      w.className = 'w';
      w.setAttribute('aria-hidden', 'true');
      const inner = document.createElement('span');
      inner.className = 'wi';
      inner.style.setProperty('--i', i);
      inner.textContent = word;
      w.appendChild(inner);
      return w;
    });
  });

  $$('[data-scrub]').forEach((el) => {
    el.setAttribute('aria-label', el.textContent.replace(/\s+/g, ' ').trim());
    const n = wrapWords(el, (word, i) => {
      const s = document.createElement('span');
      s.className = 'sw';
      s.setAttribute('aria-hidden', 'true');
      s.style.setProperty('--i', i);
      s.textContent = word;
      return s;
    });
    el.style.setProperty('--n', n);
  });

  /* ------------------------------------------------------------------------
     2. GONIÓMETRO (loader y método) y LOADER
     ------------------------------------------------------------------------ */
  function buildGonio(svg) {
    const g = $('.gonio__ticks', svg);
    if (!g || g.childNodes.length) return;
    const NS = 'http://www.w3.org/2000/svg';
    const cx = 220, cy = 222, R = 170;
    for (let a = 0; a <= 180; a += 5) {
      const major = a % 30 === 0;
      const rad = (a * Math.PI) / 180;
      const r1 = R + 9, r2 = R + (major ? 24 : 16);
      const line = document.createElementNS(NS, 'line');
      line.setAttribute('x1', (cx - r1 * Math.cos(rad)).toFixed(2));
      line.setAttribute('y1', (cy - r1 * Math.sin(rad)).toFixed(2));
      line.setAttribute('x2', (cx - r2 * Math.cos(rad)).toFixed(2));
      line.setAttribute('y2', (cy - r2 * Math.sin(rad)).toFixed(2));
      if (major) line.setAttribute('class', 'major');
      g.appendChild(line);
      if (major) {
        const t = document.createElementNS(NS, 'text');
        t.setAttribute('x', (cx - (R + 40) * Math.cos(rad)).toFixed(2));
        t.setAttribute('y', (cy - (R + 40) * Math.sin(rad)).toFixed(2));
        t.textContent = String(a);
        g.appendChild(t);
      }
    }
  }

  function runLoader() {
    return new Promise((resolve) => {
      const loader = $('#loader');
      if (!loader) { resolve(); return; }
      const gonio = $('.gonio', loader);
      const num = $('#loaderNum');
      buildGonio(gonio);

      const min = prefersReduced ? 350 : CONFIG.loaderMin;
      const t0 = performance.now();
      let ready = document.readyState === 'complete';
      let p = 0, last = t0, done = false;
      window.addEventListener('load', () => { ready = true; }, { once: true });

      const finish = () => {
        if (done) return;
        done = true;
        gonio.style.setProperty('--ang', 180);
        num.textContent = '180';
        loader.classList.add('is-done');
        setTimeout(resolve, 650);
        setTimeout(() => loader.remove(), 1700);
      };
      setTimeout(finish, CONFIG.loaderMax);

      const step = (now) => {
        if (done) return;
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        const t = now - t0;
        const target = ready && t >= min ? 1 : Math.min(0.86, (t / min) * 0.86);
        p += (target - p) * (1 - Math.exp(-dt * 3.2));
        const ang = p * 180;
        gonio.style.setProperty('--ang', ang.toFixed(2));
        num.textContent = String(Math.round(ang));
        if (target === 1 && p > 0.996) { finish(); return; }
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }

  /* ------------------------------------------------------------------------
     3. ESCENAS: lectura de scroll -> variable CSS --p (0 a 1) con suavizado
     ------------------------------------------------------------------------ */
  const scenes = [];
  const ticks = [];                                  // funciones por frame (vh, dt, now)
  const ptr = { x: 0, y: 0, tx: 0, ty: 0, energy: 0 };

  function addScene(el, type, onUpdate, ease = 9) {
    const s = { el, type, onUpdate, ease, cur: undefined, written: undefined, rect: null, on: true };
    scenes.push(s);
    return s;
  }

  const targetOf = (s, vh) => {
    const r = s.rect;
    if (s.type === 'exit') return clamp(-r.top / Math.max(1, r.height));
    if (s.type === 'view') return clamp((vh - r.top) / (vh + r.height));
    return clamp(-r.top / Math.max(1, r.height - vh));      // 'pin'
  };

  let lastNow = performance.now();
  let lastScrollY = -1;
  function frame(now) {
    const dt = Math.min(0.064, (now - lastNow) / 1000);
    lastNow = now;
    const vh = window.innerHeight;

    // pointer suavizado (compartido por los canvas)
    ptr.x += (ptr.tx - ptr.x) * (1 - Math.exp(-dt * 3));
    ptr.y += (ptr.ty - ptr.y) * (1 - Math.exp(-dt * 3));
    ptr.energy *= Math.exp(-dt * 2.2);

    // 1) leer
    for (const s of scenes) if (s.on) s.rect = s.el.getBoundingClientRect();
    // 2) escribir
    for (const s of scenes) {
      if (!s.on) continue;
      const t = targetOf(s, vh);
      const near = s.rect.bottom > -vh * 0.6 && s.rect.top < vh * 1.6;
      if (s.cur === undefined || !near) s.cur = t;
      else {
        s.cur += (t - s.cur) * (1 - Math.exp(-dt * s.ease));
        if (Math.abs(t - s.cur) < 0.0004) s.cur = t;
      }
      if (s.cur !== s.written) {
        s.written = s.cur;
        s.el.style.setProperty('--p', s.cur.toFixed(4));
        if (s.onUpdate) s.onUpdate(s.cur, s);
      }
    }

    // progreso global de lectura
    const y = window.scrollY;
    if (y !== lastScrollY) {
      lastScrollY = y;
      const max = document.documentElement.scrollHeight - vh;
      root.style.setProperty('--sp', max > 0 ? (y / max).toFixed(4) : 0);
    }

    for (const fn of ticks) fn(vh, dt, now);
    requestAnimationFrame(frame);
  }

  function setupScenes() {
    $$('[data-scene]').forEach((el) => {
      const type = el.dataset.scene || 'pin';
      let cb = null;

      if (el.classList.contains('manifesto')) {
        cb = (p) => { el.classList.toggle('is-done', p > 0.88); morph.p = p; };
      } else if (el.classList.contains('journey')) {
        const gonio = $('#gonioJourney');
        const num = $('#gonioNum');
        const steps = $$('.step', el);
        buildGonio(gonio);
        let active = -1;
        cb = (p) => {
          const ang = p * 168;
          gonio.style.setProperty('--ang', ang.toFixed(2));
          num.textContent = String(Math.round(ang));
          const idx = Math.min(steps.length - 1, Math.floor(p * steps.length));
          if (idx !== active) {
            active = idx;
            steps.forEach((st, i) => st.classList.toggle('is-active', i === idx));
          }
        };
      }
      addScene(el, type, cb, el.classList.contains('hero') ? 14 : 9);
    });
  }

  /* ------------------------------------------------------------------------
     4. NAVEGACIÓN, MENÚ, REVELADO
     ------------------------------------------------------------------------ */
  function setupNav() {
    const burger = $('#burger');
    const menu = $('#menu');
    if (!burger || !menu) return;

    const setMenu = (open) => {
      burger.setAttribute('aria-expanded', String(open));
      burger.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
      menu.classList.toggle('is-open', open);
      menu.setAttribute('aria-hidden', String(!open));
      menu.toggleAttribute('inert', !open);
      document.body.classList.toggle('is-locked', open);
    };
    burger.addEventListener('click', () => setMenu(burger.getAttribute('aria-expanded') !== 'true'));
    $$('a', menu).forEach((a) => a.addEventListener('click', () => setMenu(false)));
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });
    matchMedia('(min-width: 960px)').addEventListener('change', (e) => { if (e.matches) setMenu(false); });

    // enlace activo según la sección en el centro de la pantalla
    const links = $$('.nav__links a');
    const map = new Map();
    links.forEach((a) => { const sec = $(a.getAttribute('href')); if (sec) map.set(sec, a); });
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        const a = map.get(en.target);
        if (a) a.classList.toggle('is-active', en.isIntersecting);
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    map.forEach((_, sec) => io.observe(sec));
  }

  function setupReveal() {
    const hero = $('.hero__title');
    if (hero) hero.classList.add('is-in');
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        en.target.classList.add('is-in');
        io.unobserve(en.target);
      });
    }, { threshold: 0.18, rootMargin: '0px 0px -6% 0px' });
    $$('.rv, [data-split]').forEach((el) => { if (el !== hero) io.observe(el); });
  }

  /* ------------------------------------------------------------------------
     5. WEBGL: cinta 3D de hilos (hero y cierre) + morfosis silla de ruedas -> corredor
     ------------------------------------------------------------------------ */
  const mulberry = (a) => () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  function getGL(canvas) {
    const opts = { alpha: true, antialias: false, premultipliedAlpha: false, powerPreference: 'high-performance' };
    try { return canvas.getContext('webgl', opts) || canvas.getContext('experimental-webgl', opts); }
    catch (e) { return null; }
  }
  function buildProgram(gl, vs, fs) {
    const mk = (type, src) => {
      const sh = gl.createShader(type);
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
      return sh;
    };
    const p = gl.createProgram();
    gl.attachShader(p, mk(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    return p;
  }
  // tamaño del canvas cacheado con ResizeObserver (evita leer layout en cada frame)
  function watchSize(canvas, maxDpr) {
    const st = { w: 1, h: 1, dpr: 1, visible: true };
    const apply = () => {
      st.dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
      st.w = Math.max(1, Math.round(canvas.clientWidth * st.dpr));
      st.h = Math.max(1, Math.round(canvas.clientHeight * st.dpr));
      if (canvas.width !== st.w || canvas.height !== st.h) { canvas.width = st.w; canvas.height = st.h; }
    };
    apply();
    new ResizeObserver(apply).observe(canvas);
    new IntersectionObserver((es) => { st.visible = es[0].isIntersecting; }, { rootMargin: '120px' }).observe(canvas);
    return st;
  }

  /* ---- Cinta de hilos: evoca la onda azul decorativa de las paredes de la clínica ---- */
  const RIBBON_VS = `
    precision highp float;
    attribute vec3 a;                         // x: hilo (0..1), y: t a lo largo (0..1), z: semilla
    uniform float u_time, u_intro, u_chaos, u_energy, u_aspect, u_fade, u_pt, u_dpr;
    uniform vec2 u_scale, u_off, u_mouse;
    varying float v_a;
    varying float v_c;
    void main() {
      float s = a.x, t = a.y, sd = a.z, time = u_time;
      vec3 c = vec3((t - .5) * 4.4,
                    sin(t * 5.2 + time * .42) * .34 + sin(t * 11.0 - time * .66) * .07,
                    sin(t * 3.6 + time * .31 + 1.3) * .55);
      float tw = t * 3.2 + time * .22 + sin(t * 2.0 + time * .3) * .8;
      float env = smoothstep(0., .22, t) * smoothstep(1., .78, t);
      float width = (.5 + .38 * sin(t * 4.0 - time * .4)) * (.25 + .75 * env);
      float o = (s - .5) * 2. * width;
      vec3 p = c + vec3(0., cos(tw), sin(tw)) * o;
      float fl = .012 * (1. + u_energy * 3.);
      p += vec3(0., sin(t * 18. + sd * 40. + time * 1.1), cos(t * 14. + sd * 30. - time)) * fl;
      p += vec3(sin(sd * 91. + time * 1.7 + t * 23.), cos(sd * 57. - time * 1.3 + t * 17.), sin(sd * 33. + time * 1.1)) * u_chaos * .5;
      float ry = u_mouse.x * .34, rx = -u_mouse.y * .2;
      float cy = cos(ry), sy = sin(ry);
      p = vec3(p.x * cy + p.z * sy, p.y, -p.x * sy + p.z * cy);
      float cx = cos(rx), sx = sin(rx);
      p = vec3(p.x, p.y * cx - p.z * sx, p.y * sx + p.z * cx);
      float w = 3.4 - p.z;
      vec2 q = p.xy / w * 2.6;
      q.x = q.x * u_scale.x / u_aspect + u_off.x;
      q.y = q.y * u_scale.y + u_off.y;
      gl_Position = vec4(q, 0., 1.);
      float lim = u_intro * 1.25;
      float vis = 1. - smoothstep(lim - .25, lim, t);
      float edge = 1. - abs(s - .5) * 2.;
      float depth = clamp((p.z + .8) / 1.6, 0., 1.);
      v_a = vis * u_fade * (.35 + .65 * edge) * (.55 + .45 * depth);
      v_c = clamp(depth * .8 + edge * .35 + sin(t * 6.0 + time * .5) * .15, 0., 1.);
      gl_PointSize = u_pt * (1. + sd * 1.6) * (3.4 / w) * u_dpr * (.7 + .3 * sin(time * 2. + sd * 50.));
    }`;
  const RIBBON_FS = `
    precision mediump float;
    uniform float u_mode;
    varying float v_a;
    varying float v_c;
    void main() {
      vec3 navy = vec3(.16, .34, .86), sky = vec3(.53, .79, .94);
      vec3 col = mix(navy, sky, smoothstep(.0, .9, v_c));
      float a = v_a;
      if (u_mode > .5) {
        float r = length(gl_PointCoord - .5);
        if (r > .5) discard;
        float soft = smoothstep(.5, .0, r);
        col = mix(col, vec3(1.), soft * .7);
        a *= soft;
      } else {
        a *= .95;
      }
      gl_FragColor = vec4(col, a);
    }`;

  class Ribbon {
    constructor(canvas, opt) {
      this.canvas = canvas;
      this.opt = opt;
      const gl = getGL(canvas);
      if (!gl) throw new Error('webgl');
      this.gl = gl;
      this.size = watchSize(canvas, opt.maxDpr);
      this.prog = buildProgram(gl, RIBBON_VS, RIBBON_FS);
      this.loc = gl.getAttribLocation(this.prog, 'a');
      this.u = {};
      ['u_time', 'u_intro', 'u_chaos', 'u_energy', 'u_aspect', 'u_fade', 'u_pt', 'u_dpr', 'u_scale', 'u_off', 'u_mouse', 'u_mode']
        .forEach((n) => { this.u[n] = gl.getUniformLocation(this.prog, n); });

      const { strands: S, segments: M, points: P } = opt;
      const rnd = mulberry(opt.seed || 7);
      const lines = new Float32Array(S * (M - 1) * 2 * 3);
      let k = 0;
      for (let s = 0; s < S; s++) {
        const fs = s / (S - 1), sd = rnd();
        for (let j = 0; j < M - 1; j++) {
          lines[k++] = fs; lines[k++] = j / (M - 1); lines[k++] = sd;
          lines[k++] = fs; lines[k++] = (j + 1) / (M - 1); lines[k++] = sd;
        }
      }
      const pts = new Float32Array(S * P * 3);
      k = 0;
      for (let s = 0; s < S; s++) {
        const fs = s / (S - 1);
        for (let j = 0; j < P; j++) { pts[k++] = fs; pts[k++] = (j + rnd()) / P; pts[k++] = rnd(); }
      }
      this.lineCount = lines.length / 3;
      this.pointCount = pts.length / 3;
      this.lineBuf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.lineBuf);
      gl.bufferData(gl.ARRAY_BUFFER, lines, gl.STATIC_DRAW);
      this.pointBuf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.pointBuf);
      gl.bufferData(gl.ARRAY_BUFFER, pts, gl.STATIC_DRAW);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
      this.intro = 0;
    }

    render(time, st) {
      const { gl, size, u, opt } = this;
      if (!size.visible) return;
      gl.viewport(0, 0, size.w, size.h);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(this.prog);

      const aspect = size.w / size.h;
      let sx = 1, sy = 1, ox = opt.offX, oy = opt.offY;
      if (aspect < 1.25) { sx = clamp(aspect / 1.35, 0.42, 1); sy = 1.02; ox = 0; oy = opt.offYPortrait; }

      gl.uniform1f(u.u_time, time);
      gl.uniform1f(u.u_intro, this.intro);
      gl.uniform1f(u.u_chaos, (1 - this.intro) * 0.95 + (st.chaos || 0));
      gl.uniform1f(u.u_energy, ptr.energy);
      gl.uniform1f(u.u_aspect, aspect);
      gl.uniform1f(u.u_fade, st.fade);
      gl.uniform1f(u.u_pt, opt.pointSize);
      gl.uniform1f(u.u_dpr, size.dpr);
      gl.uniform2f(u.u_scale, sx, sy);
      gl.uniform2f(u.u_off, ox, oy + (st.lift || 0));
      gl.uniform2f(u.u_mouse, st.mx, st.my);

      gl.enableVertexAttribArray(this.loc);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.lineBuf);
      gl.vertexAttribPointer(this.loc, 3, gl.FLOAT, false, 0, 0);
      gl.uniform1f(u.u_mode, 0);
      gl.drawArrays(gl.LINES, 0, this.lineCount);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.pointBuf);
      gl.vertexAttribPointer(this.loc, 3, gl.FLOAT, false, 0, 0);
      gl.uniform1f(u.u_mode, 1);
      gl.drawArrays(gl.POINTS, 0, this.pointCount);
    }
  }

  /* ---- Morfosis: la silla de ruedas del logo se convierte en el corredor ---- */
  const CLOUDS = {
    range: 0.8,
    n: 4800,
    wheelchair: 'b7Zod0Nmasc+snQ5SL55tn03sWNrhZV3o1t6kFO1TEqnWpx4vUdXcloxap9NcUh5lYmsaXSVlklrQXG2hHuIkXy+mD1vfz2yR1hEnnM8b5pqxmeggIiTe1o7o1VkiGjKb7BdL6R8qFZ2wnLGukRFaW2MX4tuvGurashWRX97ZLdmT1WhfMFNZ5k9fcixSFSjP7tyy4GOS1CYeZ9Db5pPi3+TgTKGOG6In36YjMVPfsVyv1qBjpW2RKBQo3NfWrFWbUtyOWOyqWFUtHl9wEuPPmZNfMZuh2mvZS9Ts4yVXIh1wZZBYF9usGN4Tb2vZVmVcsVwuVpxYV9MiWdekYk4tU+Li4KQO3O5Sbypb3g1YztEVG2/u0ifV1S0dHt9w29JbFKvSW5Nf5JnSneTVLR+gVd3iY+wZktlgJRDYVyHu1Bsjk5JVYBIcUZZZ3d7kokyULtNiVdyashUsFFIsEthX4c9wE5mja5eaIhsT2qCc7FuQKJWt09PcKBLn32jbke/WnGjR69Um0hKd1M/erpqP1iEerxmYn58ZX+YQ1K0QmNMgKB2aXdvtZl4nUFWq3nNdL+lfGYyesR7MUZ0Urhzf22euFNFc1qOaZNfQcZNon9lgUlPfDNivWivXoaHd0+/bcJtmnGCZlCoZW7Hf8RmfFw/VjpPhpg+eDlvgMNPT4U9sKBsTLykW1JIWjqgfTe4iD2WQWEzTWhHWWiEZad3jqFRTYqsVXh3SXxjM2qtaXlusGk4c3l8imOsTmiVgmW2ZMaAgkhqaHZsPIc7XzdVSHx6iXaPgZaBZcRNSFqTb8iAe2ZSoH9th7JbaK93zUNoS3VaQVl/vktyy37JTWZrl3G/aLdPg1OITW+YPlKGbKZFbGvQa4Ffi3aCTcJQcV9iZ06JNk6Ha1twfVmbVj3BT5Q4bkdqOmu2e8tEoJmASFZUfaR4mU1Jv61YeMNylK1SnldlgI6OTEV1kX7HZ5RtyWlHcbhkMmmcWIyia2qLcINJunuCb8lXl3E7XI+XkbRYYD6Xj1mCwFKaSmZjb6lkp09NuFSbPWZLi39ntmE9YlWpbGFXbYJ5iaJto3pjUl84T0N2gV+EbDmJgmdIPrtifFJ3UEePQHKyRGJMYHCynEVLcWs1bKaQd5GLX15NZZx4TIp8d1+EYz1Re2h6gpJakmw2l4tvQaNoWDFvr4o4nUxFbVBTrlKjfUJfW5ZwyqFYYnlWO2WRxEduMVw8gDVosGOuWpZYhnC5aLJ2yos5VIenYnt8qE+5SWCCqXVku4ePbZhsjJeLn22DiVaJbkV7zXbPTcFYQa9gUVCKNVqZgTmIlGl3S1fHSW6Udnlhw5iPWjFVO65rwkuIPHqJWTGjfmevR3ZLaLZWq1pkxKteijqlWWgzlXdoSHG1lz6kf28/fItfYbtEpFOkY3ozY7w8uqhycjW2V3SLdbqhfZF5jntmYmWQnUBajnC6iIlbN2ywjJBqOYWImERQw1I+epVkqKRPdjFdNKZOVTpwMURxZbNpQ42Cjot1d3jGd8tokaloaE6GNUtGhjdgX7dQQ2luvX3BbE1Fn2lJa3trzqhweH5uvpSTXIx/iLdUUqx6fURlbjdtuVG+aaRLmGeuf75nnW+YinpNXGuGY6xMu1uSUqyWepxAS1JZn3/Hc7+ff2mHZFc+vGSTsldHblZ3cz1juVahom6fbooyeTOvamVNo1VltkpmT4xph2uwds6zQ1BRpE5ajmuAcKpJZVdEUUuNOZKTTFRSt0d0O7mldUpzgoiKiKJTl3p2gFC4bZBPQ4UzZoSaQVNAZJptkWlVV4x3NU6FnVBFUm2bW0Bniju5TcJlfKlhWpFxRIGSUkNrxlqSbLCdfY6JiYGUQ1xrrWZ9gkpHd3jCT1U6RmOZfmSRijy8TVNIZJikfmI+WpSgR2R0aJlSg3++RVhLUWvHe41TS2ShTXS4SGNucLhuO0ZOnm+CiURqgYJAt3C4T8NCq1iTR1+fbKRpcUZMu3mCUb12gE69ar9Jun2Crk1pkKFQaJWUj6Z7eL9JfExqsUaAwVVIWG5Ia0/Cmz+KkKhzZHR0O0NmfDFblWhbrGyleLFhoXJQiEpefr2Hem19aptGbqVZPLdOjX7BQmdwvWaWnn5lfGnHdjdrlqlkaJmoaJKJaYtjeqlqSmdOVoqSf7xJk1aJSWRPf4KLa7uuaDq5VXZOVkdibq9SiIU3ebywWaJ+X2OHgny3rXBozrdCTElrhE90mnaJMnfEXI1xgUlKb1GbgHnNX1xvgHy5ZmGHfVmMj5JtdmuUhoGNOH16WZJud2k5XUGnWWU8R01EV2F/U7KnULJhZDN8im4/ZZptN4cxasOXi2IwZzOoWXG1ac53lF82sEllfppNiDxujVhAkpFniX7Eb7CicmTJo3NvrVJOa7dqnYySRWpNSK1OnE9PV1Vzd4hTqLdCgoGiXXm/UYZ8u06IslFxiWBXeLhsgouAjXdblq5VWz+WR3vIcHl7ia5tfL1tUGZ/XDd7y25/ZXluRcZOb6dli75RfX9bkXs5mkRRh2VyeDlqmm07cD5HUbNXrFdkc0RqaaFEb0NYV3m1WJd8nUijUWy9Z0yBj269abiVipB2cYpkn2ZMa4NUP42VnlZeiGxDRV2vWD+7nU+WiWxPtERxuHrMTkxqM208nH+cRWPIYcGra5l3sEZplV97djCGjV+BSmWGMFamp1ZOgJqCdJN3e05tgoGBeExflUOkcF6CajRqq1DDaDt0km+yboJ4iE2HkkNsj2O2ZJqJNmZ+UYZIS1o3kXijR2mSjYmqbXeVeZBjpUyRWES2SmW4iIisUXJCnnBIUHmVmUtqRnKBdZVrxk1gp2B00Gx2cTdrxz+1UMCkf2mClEFqv2WgbTh7y4eTiIJt0JSPTWaoY2hkp12kZHbHYFtMa1qZe4B7lW9BlpForsRJmk2YQ6dYZoBrelpwq2dlNnGRUUxqylSkXjaGk5R4YjpNXHN5TlOBMoc4aahvtVqOabO1TZ9FdLRovpOLRFVoTEp7ql9pOpxAOriwU8JMYjtwf2mxV3pPhIeCl0iwXEVXQlx4tGDBioJsQ2Jcb0pDYrBKiDGxU5pCizNuT5lHTL1ixZY6epWYjXi1Q19yx09IZI2xT4U7oVaif2hhTkKkU5CUcc6aP0phScCjck5pg46MP4CVU7NzjFuIbD6mXG63h4JCurBUukNEu2x4jJWEkEdOdjKXkU50eot/wExmZLFJV0hOPLOtaEWdrk2KkGpWYF2gbFqZokVOh2xMZ3qhfatTb4ixTYd+bU+kVGY3foGIiIQxVHZ0f0ZUf5SLNbNOZ1x4j1NHczpwSY07PLucT11Ab3lkvU1zh5Rmxls4lEVDXlJPrllle2i4XY6Cd65re41ktnaIaKZ7OVqZiIJIc5CUpnlEcXrDdzZVdHGzYDBjrU9Ronp7knCDmHpUhGWTXoCefklWbKFQw51Ff79nYFBzaDJGpJk/erdWrElbZq6qamRYP7ZpSpmAYTN4zU29pGN4k1CAbDt6iU/CP7OdcbRMTU2me3+VbrZwmGSgZTt4gXy4pV6RfG3HiTJuNlqSmEV/fElYRluoUGV9dbOjSGV9cH1oTa5YdTB3gkNff71RuWSTWo+TfWSWXzhiflyChzy+SmlMmTvEUE6MaDR9yFQ8fH9WiGV6l4GRQbpJxE9klF99eL6nT2rEjYJssplDbzpljrRAZqmiUoSUjH2vZY6JbqFFaa9KiDGIi3qSQb1sn3TJe5TCUmu5RVyQjmSWSHmifpZ+N7hbb4c8Zs1qvaZraYqNk3IwaoyDOkJid8h1kny/VXRoO2bCZMdvx2eQaa5oM7ZLdzegbGtGY1J5jkJbZI5ue5ZGSphpqpRDZXtWqmSLXI+bPk96gTqfe3g4ZDpDbcJKlJByuaNlesGHe6RiSkxUPGefV0FLeEZiVntUQ2+Ndc5WRWNbS1I4t2SepGFITmBaq2hfWz2yVXxsisJRZHedUk5UVDtTQlDCTVpohH67gnqaRMRKZrpEn05VaDNEvWm8ZlWuZGtHb6GieWpJXIKWgmjGyEmUfWeDYlyfQ11Bd4lmZXaCVUSjSmNbnUaPeKFtZq9MUlqOqnBrz5GCrWNhYE1ujZROW19aoWlfg3GypXFhwmE6kohzkFZ8R7ptPokym0ZIbYQ4dIl0e2SrooByOaRaoXNFdEZfp2VqfZN3Orl7fmFYb5mHkLBJOrRWoUxHZ7d0jIQ7n4HCSLpNZMpumYk7gItZgJU5ObmDM0ddR2B00GBgcUaIgWi/UrVEvlWAwUdjwGiBmoKSgpl3qHVnn7RKVXaRiH40slNpr24zSGtqiXqVdcCMlV2OfIlzMEJobKNShIN+fL2Qe4h4cTuKfk9WtVhpqq1vSXxmrmTIiDF3vZE+WYVwvYI0SVpegUxESlNZgGZRTE9nq0pSZDpIVlJIeTHCSpp7rXDHTaVgTL9vwWSQS0ZkmG2KmUZxt1qPcZNtw6ZPe4p3gYWKZr+zRHK1h4+iUYeIhXhyiZ5vX4uKfHjOeMyEeMBIYjCbSI12qV6uWW1RfTF7iZN9U0tlmk67Yzxky4o+VjplrrxPXo9LkGMxlT+3TaF+bDGebooyplJpw0lITkRRP0Jha8ZsQI+AZKFWnG+gtkdjvm06acuxUnCWSXZVqWY8Z7GDe2hlcXxnm2iOkzg+tm/LbDuNPq1XSHpcNZ6BZsyZfqd3THKcP3W/tkNydqxQTYCYjpiKc5FzfUhma0Vkq1B8WHZLRp5TSWFNWKJ9vUi/RahvfblQf2uSaqNPjFNGhIhtfl2BcKakbWV/YThMYn4yb0KGeWXKZ5tEt0pQUrSwXomLknpHTWSNZKtajls3RnGUj260eMCMimljjn1wSIUxY259ibVJabxoTVY/vkxtu6dslkiVgKFEaK6kd0RwTUqagICSqFNnuWWFjXtLSqJ/rXCtWGlYejVle6htfMtqo3OURZxod1WgYm64RmW/iJVOeGPDUbOfbJeCkjyfbUhNgIheg7NDqGNWOpCUa7mmWD22f75+gbZXT4etT4F8g4+gdqVmYrKraWStZjNRdW+fbcRXmmeLRGykWqdTaX1fYEtxTI1pmpWCnlZytkxfaclop6VZSkdITKBXXJJyMa5mdDtgOHyVdDNrvWdfc5NJu1htZJzBS1J7lJJ5za9WX1+ySF+CVzpiyHI5u00/unAxcrybT4yVpla+RTq3l4uUPnt6dLJPvHe3ZrlaiMJMbnxru5KJSHmifUheSFdNTkZ0dMhnS6NKbFBOfpM+T7psT61nt1VxwGY0dsdUqVV3rm1lqZaPWTqAi4l9RLlNbUdTbk9klW6FTluMNGdMapliv2SKqHdckWhKc5N8t0xmbExvn4qJjJNryGlXT8JFY7FiSHZtw2jFTHaEeHvMcsymTJeLT1JDoHOSXTxtoXuBY3eoU3uLaV1pmE5XbspwpXbAPLpQTm17pEtnM2umU0yEM3OMQ71Tek1zTVafbn6NZK5oiZN7Z6ZljWw+nIA+t7RbT4dLdoOCa7lGT0xtdTF1z65tTX6Wf69Rh5WYgmm2q25LfW7EbpaLgVZ1P7xmY8NHgoltv3Wzrk1YdTq1Va2ZRbRYZlVxtHkxW5OWiW2VkzdnYElxTX9QUpB7Untwsp1HaMBlO2M5dHZsr1qZa7RHVGCGXzFxiG6KoVmRQJd2cLdSq8FTwk13MURsmkthWWVzS0hln3Sxdoxsgog3sUe0UGQ+YYJqMWY7ZKZlg2iLZKJnN3+BcUGuaGzAjH5oSm2Kf49Fu1d6kTh4ypI+pmdbj148cTmMM197UICsW1Q9i4l8in+AbMpoRJN8g3uoYFBHrlSJio6OhYpYdWtIdM6rZqBEp29Wgld5RnevYni+nUmoc4iQWzmTgrRMWo1Mckaja5BqiVKzbk1UfYOJomtrlk99Q26uY5N/qFBeQXg0nnCHNXA3YVtxtUdeUXVlVJiRgDGBiF4vgpB7ek5XjJJtgGNbpk5nOqpzdDRqj6NkS019vcZLUkdFbpg6tFVchb5IaHafWHIxalRISrlHZaBrxX2/cnuMNZF+lzqCjjyzbYCgRGIzZHRPgklJon+BjcROer3ETG02RLqYS2PJO7Z+jmkvaMGJfXJ+Val8MneVcjxRdK5Trk9gWFJHUz94tGy8c3x1uqZpijhKd2KtfLlVdq1Pu0nDT3F6YD+qdJ5Xbs+DeU29ZJt5jURtQb2oUomCWpp7NU1amIl2uH55b0yZeHeMUblHl2pJbbBaMWpRU4BspHl7YDVCuIqVQr24UpI3pnBbjXs0rmpgNWaEbbNFvn6Sin6xTJN7kJJtPK1sTWVYRqpahZRjNlKvPq9oXURrZZVlU3S7Z3l0N5k9omWkSaJaZpVtQq9lqGhmNk1vUImRf51wskGTRJGBcnh/w6tfl0ltokpfcLRWRJxRkzh6kEOrn25RwWpHap9otj6yoVN9w42Aa6hsSnLCZKKZTFF3b7l5MFWEe4CfUJJ4WUVGdFiTqXZURFuQS19da7VWcIdtl6taVUOmezu0oUmgd2RXOrq0S1+FXD5rlGfOb4u4UW5RVENvnU5oZr5al2HDSWCVPUJmTWaSPG6KpnFVSGyinlRCvXGFb6eDfmqfeMGDfX2CuFFvzEpffMRWeGXKhTtteXd5Tb7ES3eRnnqsUm9KcoJ0wG0xZ5NqxKRiUT9ivGDCpVivbYaSbpFITGzJgpVfh69Ml4x0wa5PTFZlt1FQSmFmhUhseXijSZQ3b4h1vHCHpWdxk1SxWptbQ7ZSQLdqjZiRR7lWQ2WOn29cgkW+YsVOVUNgknlWqWyIhXdkm6lsWURkqXw4h3h6MmQ0SsBOV4mVqmNZPZh8QlxNWmSlTH5xjqV6pU1ns0hxfndrgnBEi4lVSUq/X31+uk1DrFpkm2CEZLZyPnA9cT2uZmiShnyuWkt+UcCPdmK9c5XBSGZkxkq0WKpcZ5RNUkG3c8teiG+xT1WIj3bHuUyVOKJTeDWiS3k4RVi0S7pKe7h1i0JjgYu0QXPCa7dfiniIlUV3zMBGijN+w1w1SlpStW5FQrdlgnyVZ4Jts22CTW5ue293iT6UQ1G5ulDBSW47hIKXOqZxkXuHeJyAoFZVdZA/lXtkwm6xnYBIepxIpGlsrYKNRXSkSlBSQ15qk55uj5RiwFJNol1zMUdPkJRlx3J/aYhPdnGEccN7wGiHTWptqm+oWJSgULZNanl1woE4cUF7jXjOjnljrE6CmIKEjJU8e4JHuZ9snD9IlYd4ZYNoWIuLZ5NjNJxHn1NrXI05TcBlfUZicLeHMbZXZk2ONUdrkjtlhIs6hni4TFqQcHqicE53lzqPfGs/Q7lvnG6qZKejajq6SFmeQJM6fcJblGd9c8xKWXx8Vn5lsX+/bD5MZ4GJnD98uZKCar6kSmA/gpBMRl01bpaMNJiJTVJKdYmJQmZs0Hd4aHixYL9Nm0BvSZ9BUYNluqZcT8JyNp96c5J9x5lEn0ZttplLUbxmVWR1R14/taFKxktwRE+BhZNlcqtVbkxJfGhlQ12raWVRdIxylF2OmUpqNGSLTlupa50/d8uwYpBBhTVlf5t6WkSVOXaVnT5Tt1DCZ8Z4vlC7c5RajnEzlklIunCkRFStZo99S37BT4p4b1J3zXu7Z6ZCaK1scUGTP0pHdolmwXI+fDlpyHHPZKlRh7FUh3xOW59IQ6l4i3s0qXWXeaRyRnK+UpdAYGFnYEhrfpW1TW+heZJjiI93S0ZWiE1mmX6Ufo80Tlxvy05BdHh6NTm3XzRhXK5jVHhgM75FjHdQg3mCfnpTqGqVY1tvTF47Y7BvjG+nqGF+jXaLcr+kTIE5OrSAebdLcUCOiWzBxU1lU4yCYTFKUWJuoWlivV80dzFVrlNLXGuIgqRpaLeMiYeKTleddnfIWo5hgWWGxUtSRVw2gzd1eUhwX2aGeG7FPrnCSq1OfIxtoUxtVUN6wq9dZJduk2l9b6+5UFC7p3loWllFSXF6tk1Hczh2x1g6r2JGZ3iBZq+tZ3M+Z8lacWpfdDp3y3CFY7Z/jGM7Vqhsh3BGaE9oOXy3Ur5lmKR5RFg3uEJgZ5hzNJ5xa7SVRp55aExLc3I/Zo90M3LLXoNSsHIxfMtbj3iCe75rOm1MVnRsgGyjVK5qgF9kskKJlLJCY1tqr2HGach9NY+UZsCzW3yQWzenWpM/p12sUE17ooBvS1emZb+FPGGCS3CKgrNQxUxmp51LZItPbqZ5u0RugLRGhTifbLhIlT5blmJ8czxuTE1CSmZxgsRLfoiua3CdmoKkfWS5O7mLPm0xVK5UhU1YUbNtwFo7bI99NW12rmqjdIZ3iZGrYV99W0Nkjm+klUJGdWOWSUqRj21RaVx7jk5ed3hyx34ykpNlgZ4/n1ZvrUpeccpSTqdmoFtDbpaJaVylfGVPecZwkWqxlXisYm+ZbTZShG/LRlFGuXPLZI6Ue4KVc4o/tVqHwEmBjK1rbJw6t2WLa8ZVeaxUjH9ll5eLVEaDlXiKQ1Z3lHk5a6toyFZ+pXVXbpGLbEuzRGx5V0evSGupcLRStUi8xUxbgne1UHNMjW/DUoC6RqpTbDFjenc0XYF9ecFPm3xwrp5TYTpVh1mAb4tPVZJ5a5ZgPHHMskVOQEq7astIXUlraayFf1C7oICSd489ToNlsJM2Z190tW7BVYGHlFyFXJCOO3BHqFpyvG9KkYJwQE/CcbN7t7dHazbCT2iMYcJ9NFKraEime1+JioBDvnu4akFtfLRZgYqherRJQlyUgk17bjFkx5yBe7ZRuWrBwE2QfFByfI2JgWV8UkV7vVOoba14e3l6RldzMWc6gZV3gU12bUqXeG2wTMJoiURkV6h8fGCCYDW2VWsyaXeMeXoydoBJcWTIZ6ySj46VjH5VPmidb8NFbmmGZ8NsTWw4vU9VSVNNhDJqtG9ATFSIN09DrHKtXFqTkYpTsVKBu0dxiFc+VqJIXW6VX1/BS5NAok08s65Xio6CeHe0cn2xXGi5TWlzP5d3VYpmnWt7iYJHVW5PplVRTWlKwVKAlENrgIFDvUxgeLWxV1F0UL6Kf6l0eJR9OJI2SrpkUV5/m0VlOHN4sWBehrNaezF/iXLHfTN9yUlWoGtZgXk5Y7h8lVVFbM5akWqshn/EUWE2jJVozKNPcjt0zGlkS2hacK5hlpGLPVqYZTZcNW9FdIJ1N1mai3h/eG21bjFlqIp6R71kj2hFtVhwhmlcQ6xHW1s9b8xujXSTZLxZOmVWqGNJY0RZhI9qoEK9YrFEoMVKhot0gmZPaTNIuq5qbH9qqGeJoEuJkp1whHxzy49Cm0K2Rph/an9FWG4xZXdejGV6qW5MYH04SGxwR0p6b3xcO3+Pgo2rc0W5VK1Ud0NdijJRuWvETlaYPTu7W41MWEZekECgWno3hI69UGRqhoGhUblEXGtHUpqAkUJogkxhqmikeGs6olNkabFTUFJ0iVmLpWRqtGpHZkxIXYSKgzKhT5lCbVJIcHeQZKi9R7Bid5RknGZ5Q16hTZB6f5OlWHe2ZKtcha1vect5tkpTkoGYfkh6aqqENJY6Q15/vERWUEiUiWmzSFBHX4SBlI53OU+8eYyIemNpbZNOaEa4UXVAvHyBq1NYoHGyiTRmf0/BS39dkcNImT+gTUxZoW5RwKhddYJpj55vhpVwMUlnZU59umTFaKttpp5yaVyXPU27VHhEWl5/Yr5Ru2bNf4o+roY3YWBou7JafXdqRWmlg4h2eZV4UbNpRVSvZXtNbVN9bYmrUox2n1ekTVc5lnlqgIA6iTS1QWSfaTtHXHJ3PbZkrlxBXY5XeV5+boJLflqPZjxHd4eOY5ttSFRKakamaHOJWpxlhHG9e5CFiXK5cLJDt3qCajiRNUe6pWh2z0Vap2KheI+RdHt0xWJcS0pFvWUvVqlcOoUyoX9rRKpwZZBEVmmHdLJvTFijkjhDoI2LbUm7RpyCpGVbNnGOiJFRumZWplZ1t25RWo6VeKlwSWqscpaCRVRunZBAd4GiTGVlZX1seZB2dH+ocHN6nESUk6ZOloCUQ0tGeL9wOW9IaFxpo5VFq2pZlLBfUreyVW+kT4t8ymmEQmVqXF+AWo9Nu1OHmUuJOYM6P7xptmaFSnBMwm+8skZdMFJ9oEpmU1RMh4B4OXm3d5FKX3uUU0RuRlVKkT9JX3CoaIpzz4uCS1+fVbhTi5KYOmRzbp5kN7RZaldLZGrQqXOnUrRbWptlerhRhzxqlq5ufb9tqnCDasqWiJpBgo1qsk+5q3NMgalhTIGZdmWAW49uzXGPoU9+iZpMZ8SfVLNGipVxg2aSn390OqBVTrpfMENXnkdaRHQ6w0ySkUdOaVpqf5RAec1/eG8/VXVcgni6VKRskoAxTnJkjJM+r2WOjkxccslxd5Z2er9JWn3Ja6OcUJ2ColKbdWx7Q2hmym/QbTefVmentlZkOb5FS16Sd0Nib6iRfWtAZYaCkm12lkhZPmMwgTR3uYV8rHKpWEW5bYZZg0pkbYVVi2ylo1tvjG2fhjtpgoqQeLxrd3GIoGqAjJZ7bLZ+wYk5uVB+f1ahpFpNZqhjfDOTiXY5jH5oMok0VYBkd5I+cT1Nu394abu7Q5WSaopzimxSk4tofVNAYX1qOmc6eXxZlXA4RHBRiGfBa3t2xq9hiYF1jm+aRk1lPHnPR3ZIvXvGYTGSjJ11iz1OXomIUFShS7NedIHATmiEXIZlkGQyRLdnwnqOe7hXhXI3ezZYlpWOTYGJNm2RpU2rX5lAhpF1OF4wjoJZOKdQZpdtfYWTizxplo5AhpFsPaNKrVCMkU5RrWGFiW8xgjVEXGc8j4pwrJOJSW6GPFREg5VLR3A/S2qneZx7a6J7koV4m3hNdZV+bENSrGepfzmiakhiR3pif42Jm3bAR3vEjzdFo3l5wUdktqZcr2ZQcGlGebZGmYg7hjc4tqdZaLuSOVk3plaMeq1cnW+wRplFlUFPRFqZV56gVaVyaDNLwVqAbUFJfG61WYltNG9MWEWQkpZIdtBsmqNhsFyEfJE2cYVdkGafR067R7BGsGJ5xk9/Uqx0j2PHSVV+lERvbTR0lYqPcZNov61vrHKiZ3M0q2yoZWA9WECJd7BmXoZVeKZ5S3V1la5neY99jFyMtEpGvoYxY61NYluVqldVQpB+kntjMWRpVYVsllxCslWCjIN3UrTETGc8UVGnU3u3hDukaJk9w09SPUpHolGnZ5eRh5RXOshJkJRPum5AasxfYUhTo4CYO0JdfzGmVqxxZr1TPje4fZBhXaRXYTlrNok6aUlbgrhRZbCXi10wr153OWitomdpp7dTbjmkf27LgYlNvJJ9b0lcMY+RU7Jsw2WMfpNtnm8/io9msGuyv1Jyf3eBqVRpYVR7aGJqjIB+oFhzynqAXIKOinV4ZVZkT2xMpGJ7zGSUY1o3t59resxWRHCtlX5luFOppHtvdrZCbp1ZPniUh4GRNad3ZJNvfJVGmEBRuE93UYJ9vl99j45RUGTLbHx9iYeAi36DMrBXZoJTiUp+jziuaGs1V55ud6VRs0ZIummBtEBmZHi0hX93d2vPiIBjenM0Z3eZdkG+acWlfGFgZJlDbUy7b5Bvd2SMhn2sUmmpaVxpNbFGUIOoX1G5qFJOTlmYToGnZa5cpWJSTnFDmXt5zLpJN7lHdbNSxEhKdqlggTRpTH2QlTirWIGNgJB3fY54s0SLfKJTlIqUe5aLgoKyVVmVe3iiT2/NgIGfTGtcsUh2k6Rjaow/vb1LZY2wUG5MuUlojm9IjJSsWnjOuUtIv2tRpmBHwEZqtVTESVswgJVMfluFaVpFpE9wfZVGnbZOTnJQS6BacUNxemXMXi9olp9GVqCSd12Op1xRvWK+UntaQ3t7OriAMWW6eoujb5GSslV5f7ZJdr2VRoo8XJN6lVo+TICSgWRqT3KXR6Rar1RzfqZ4ukJdQUJjqWmJjZF6V6JWeW3Ae5OGj1Z6YVdmu0ReuEtmrmW1ObqlYI2CcsV6uWeGYcKiSmijZ0d9xleJejlwsmTFTETGSUx4QbeCjoN9dTRvnE1aRlKXQE1YcIRxfWh6TGlXdkK5okxvh2dhgIubfogxcMyuX2ukczZnRnFFTUR6iIN4jzmle3w4oEdyeZl2a3aLkoyJXn5ldWs/UHhIb0ZTUkiMM2RPomdPUnC4Zk9rmZ5As0FEYG84T8F9vkd3b6F3yl41d39oRIePamB/wGdjtFRFY5Z6UFBjl2BYko9iv3CEpk5lrrRLXoiOeUS/Uq1DWZg7fJJOV5tAu0SUN3m5aFp1jm7DaHiJNn6IlpJ6MLBZUq9pynW9dr2QPp1Ua6iMf0l8t0KMM3jOfMhMZHbCUH9qX1J3Z6aTj6B0c7J6OVmSsURYoWl4VUapWna2gZJfgYF3jTWJiFOGUHVZlmpFbNGbTpc7dYm4TUVQUEu0WqtzeZCjgHK5Sl9Id2m/Q7heimShZKGuTF6KUb+BOmk2vkZofIA0ZztOXaBUp1JFcp5At0KjTkhSd3pTiY01TWt7N2mZZa5IUEtZWX9md3g4SFedclyPa6xxg5aNt1R/MZJBapB2jktnaUOXjF2Pg3pwTH98Z8xDVpw+r1Ztx0qQiXdLeFC9gI9hgXx4YjFPUp12Zsxkxq9Lpm9kWW+3bjKoeEttYVenYMVLap1+wZWAZkq3TnqCR064S7pKZjRVe25QWzpxj2oxV4iwW1S0VKN+vKVfdsimerBPWpBlo3M1WZ+ia2l7XDtmYKJ5W5JNRJWMaketVUpxXjCtXktntlRTrF59bNA5tHjG',
    runner: 'rn2Ov5CQkIrFXHhadExYU6Wsg327aoiif1tfU2BXdJWknpytl8aktaG2Qkq8Y8RgwE+erCdLc02GpKOofF6qd5+igGByrrw/qqFRo35siGqla7VqloaZdz5QvpuYknyFU6WskYdrsmvIM6OKu3CNXVhUxEBvnpS+1DZ2ipimjmGAV6SSulWKl5Sbt1RQW8Nri5+RksJchF5cXb9sUqVhl5y1cUyBXYyNbrHCNpC1rHg/TJaNWaVSpJe5lYbBasCYmoKEb41shoVLWpaaSk6San+qdIW+m5CKp6iPmFivpXGFXViixDRemDtRupuhwZ64ZLttS4p2uFORcZvLY2ZMV4aAUFukocVE2jrCQnqOcVFmaKCWipegsytKqKLAM7CScJe+UFVbirmfdmOOWaWvetI3bFy9V5J3pLJ6vJO9u03FVJ6EjKNRUq52unTCM3aSm8O+M0RdnaeQfaKlXmdSUHpacpGSwo6HimaKZcE6iIG3VmloUVt0hs48V7Cbfr1vvlCOX1yLwZqCcL1Hqml6oHJUgZ5ho46AbGg6UXunoJiispilzziUa3amS1JqvKDITlCRaL5jloKKvXShPlSdyLmSblyWt3qbhGxCS4+LxGOHdXpfknuOeIljmJ7XM5vAjYGIqWRonqeEYZa8XK9YsLRtv5KTw6d+g3GzdoJjXFuCWUJVYlaYzKeTgmhYjXthbFDBNYqsg1J4TIqHnKLNNW6uXFFWmCRJg1V6V8RgZVuykkpMmoaponWOn8JYjlSlmnK3XX6pWEuMkI21oaZtTrxEdpu3lpfKpn5hjnWlbFx6paWmsXh2jV6wnH6ltn1osJher5y/2zhUi5+8Xk+He7thjXWrnb5vmXOarqDCvJiWx8RroXlmZnKWxVM9UXmAr2iWacRlbGiclKOIca5mVZqmsGpwonyGwjpUo4zGTVugpp6sjapYVG9YZE+NrZFmxpJJo19ZUFuPYGB/xGaepbw+bVhfjLCZk5ZvTaCIWEuLaYefpJi4VJhxxZmdiqdvsm7ONJW0yTw8S2ZovplnZnVbpqy/PHJ0uptQVHqRZlStkYvDmnOJf522YVeRkMBtk2NWi1qxalVxWoqVlH+BblWLwTipa5mtZb22eIpZqpaad79Qq59OXoJVY5eRgklazzp+gpd8gqlkS56Pk4K/WLB22jlCU01Yl6yJdzdLeZ1IXYZ5blCYw9Y0jYWmpcCVr5Wgw3ylTlW5WIN4iV6jinKhi5Jhi8RMnqWBZKlqiJrVO8VHc1BvTbmbN0t8goelmajCk1+YqpNxToidppiVb9M6uVureJaca1Nlf6HAoLZ6o494ko9XpYN0rXqclHiXi5S7ZJKqeZO2cpZyxFaLgF+LjZ67l6ejWVSlnGZUxF8xVrddlcyNlTdOmcOavGV/WVR3oLFqm4GeeXNnVKMsSoN9m6+NlbdUrJiXvHamjnF4VllUzDlSXpaRvlmXpFGampx8Z3qBjpbHNJimvHFXUVmjVU04To9hv5mzZ2e8lJShgsFYdpzFPHyEkMpmo31Ql6uiv6aYuXCWsY5fdYVvnn+kWXKgi7xUvlGRsMRKulA/THZPtWZ3TbZiYWmhpltblGtmrpexyDl5vWJYlmpzoqukwUCFZn5Pe1uLf4Or2DW5lnNcmpi6WpDEYmaulnJNdY6/M7xFZq6is6CIalyXv1NPJEmazJOtp6q1ZliiulaUvXSKo39VT4y5noSPipeYWI2VkIyhb1mzdktQxEiPwJvGlGWscGajn8U3TIp1jqBykqCrnIybh2q8cFGPqZR+fKlKXnmZjqRIS15TKUqii6WfgVGSpsZRvVtacYenw1BnTWFmksWao5VrxThQo4/Ax5OLiL+Sg3xylJ6foLLDPHNmw2aIrLGWrGi+mYt3aU27abWaqXfGS5Ssaa6/YMJplYCLZVelu5pTW3dNwWyPaENLmcJko4NZS12Uy5dreKSskKGSf2fPPZqEmX68Q39uhJ9qULianMGalHqPxlmhmL1rkZKCfIGpgKOWhcNPjp6erl+vK1axk1GNoKuofpOSWq6WaKKDc5BRpaWBk7iklHSTe7yrdGNaor1IWWKXyjfEX4q/jm5Zrqx+nMK/W0NcjoKdpaK4hH+9b5a9sniSqMRjnp/LPT1RkXQtVoq/o4t4pYuVj4p5oJZpLEpnsYBvUaZRTZWsWlCbgZZ7gqGBpqKLhG6kl883RlynmIqSqn+9So15j5l0ZqWjuFvTNG69iKhKS4iqbU1cUb5halDFWH2lcl2MXaKTu0yQgZKamcyihqeolpZ6mXSdbWd1TnmkcVRdT3t+eqLBasRcSFKTscI6jFuMja6ZsZmCoIyNmcWSiYyji2mde525PUmVs7l0d4llTo6PopVIVY6uf6pXmCVIxZpdS4NrnJ6Ih4dhTqVjf6Snjn6NbleldIrEmk9dfWOhqLh0nY5dmHyGocCbg6aXrHORYcRFgIeNiGBTo6qoqbRtfKQuVW5aoJHDa6t4xTVUsEddZmm5ZYuYjZnBNXtiwZM5THqLw5OQyMRLhm6ZtF5YYE24UsM3l6ekoW5ZhmrLPI5gdZFTZI+PiHyRicKan6W/W4SBlGmJdJWEjaqNwKN+iZ8rSpCjrWmOuXCamstzUW2uu0zFTr1vXY2LgGi9jqygvr47lMJyUaGxk4m9R21oT1PBmIvDhHuRco5zkpZ1VWZ/faKGhZmAh6h8vY7FX2dUr4BZjWVoWa5zimmtmpZnkcpZW5GnlZtmaMVNZ69YXXeAw02NooujjcGasFddtlWKeneOpJqpb7w0dlyObYmntlzMPXhVTlmbg3mHLFGQcY+EwHB5pKKkkrC7m2N/u3OQf4ihWLCjf3uDtltAUZ+tj4JoS5eXvFV2goVnUVU+T3pQaVm8a785lp+RqLRklpyencYzcJdmaD9JuVl2UIuRvGKAVoyrXUuMoXBci5GPjZWyeoVLVcJSbWZsWXGuUFx9ZMs4kJWAaohwvUBuWZPDlKvKPlSkVoyibzZMglnDmpeCwjlypHGkU43ZOHunuFuHo4qXS02AXEZWo4GqaKpxYGdlS5OZZlmYm4Vmj4qqnpqhu5O1Y4VooYuPZbuYYWaOq5W0jceTZsVRd1KKcF9OWYyQlV+YWoyYbJVnxZl3T4Rcfr2AccM+nrXFUVuwqn6wk46eRFs+UVauvDulp4pyWKJUVpettluJaXegjXi9NC1LrJlJXcBEW1V7g7ZvtWeLuLV1uGeUltA4pI+nb5CumMxPo7yUpp9STMBrdYuMYV2Xsm+8YMU1QFK8cmKxrJphWXxSlcOQtYuSvkhJTn68sXZSUop1U1XOPLebzziOfnebj5W/Ttk10ThssF9exVhhr4JX0TuKvGaxnKSEgbtfh1uUvpimeFV6g1lxlLZdW29ooZtYsKZ4YU6GpXVUo37AlLZio22ehpHKr5qmdZt7XmaAnqeVhXZiT4y6VlLCl4Cql4B+qGNndU2Wypt4i7d2iZygiIcvSYVjp2yGbb00ob+IWL1Bb3SIW9M7aWZlWUxdlMBPi6l8UYyncqaWp29rvbaYe41kWL5McGeVpqKRRVmipj1R0TRrgo1omaGEooCmnXamqJS2kqurdJmSu2eRjIh+kGJuZ9I6k21YsX2pfFGQgZaseYNoaIuns2djro53fp61XryWfqhNWVtPXluvZqKRjsNwllyMn7eeoH2KepunnmxzZ2ijknWWhlaIaFyYUEs+TMWaqW5fsINei8Wgwo9qocDWO5jKv1qoksCYJUmGZ7FzfadYjWdSV1tPUtIzc6B4UaDIS6NPXMVQjom5UHimZlVeVMJik4G3lJPAlMhejXuCXX+ltVZUrXFsvZjJp6N6jpJja11kVEpYY2hSVXaDmXfBOU2jrmd5VJ2xYE10rnqRkMaWe4qrvl2cr4q8po1YUpjBhoEyV4dkkanElHtOxUp7f71dm4VkrqGuuFDSO5KEc2akdJF8QFNvnpS3xD6Xi71CtlqemFiltl2edUhXhWeSqFxd2DhKTVJTg3SwaYxznYdju79heo9ZjFulqZfBmaK0f1jBNVxNVFZ4WKWAj4ummsRopLS5WVhdX3/DbJN1RVCuk8BLlK62YKxz1jp5mC1WR07ARbxDiKitc0dbeqWEooFsmJPRO36BuGDGmcVbzjl1T2FVbqK2VKKujL+Eal6Lqn+dbn2BoqqTo5yuh4CukqdpsmpgWXmMZkucyrlRmaqLlHaUnruxbYyihoKQkY6Yipeji412kZejirVvwZuAqkdWSaOmfYinrZF6hZh0rJWUxXRzZVu4Z1OlflljZnOWiqyrfmVmoLKYx3dQtWGJib1soaBTT2m8pbm8XWNap3eYjnGui3Shc56qlI+Gnpp/fU5UjE1ccaR9gE5bs5KWwm5cTVugrmpXe4O4ko7HxJpXXHyC1zWIrIByTV27mmNLgGyctbSTkHZ6nqOcxFbEV7KZrW9rvZKSaU+7mFaMnZeYi6OuspSeqH9VTEyrn4V0hoOseNs2bWZ4UbtokqhpTIR6vUSSecFSiGujs8CYn6CPmX5XxU20lrtzeKRZVXGvQk6QkVSOYKK1d8CSi5hprpqNjGxzTLJwpqmgsqGKmMSEe4mGnqpajZJstZXIPH+Dg3B4paltuVGqaYuKxDSTjZ3KRlakjWyuN0qOYIVVjqprZnhYxF5jjHBNn7ysen1kY43HQF+YfZ+RoytKpW6ej5VyVVx1XISBioV0XJB9lJqvb8I9i2Y9TW1LpHxiizxOm6GbsIyfwUChn4WfwlvTNJCma66ve2O7w1LSNI15wWiKv8VExVqvbHqY0jh7oaKFgGeloc01gmaml3W9xUmKv6DDsm2ks71rpHSEe657oZbNPYpupH6IbVNdnHCUaquem8LZOJWdpKZsW8c+vzZ5lGt0joh1jsBvi2nDRZiMj7OeqaqTZmmooK6YSUudwWFQirvXOX9wjW6Rkp6QclVWVMVIVa6id2lSw09NW21ak8afuLdww5uSv5GJgJ+RqJdquWuwlbxJoahgTr00s3Z5p71ETFnCMnqVX0zNN1aLpJs+SIqsdHNeWK12m4mTnmdMO0d3gMNei2VgZ8VQeEyddoiGj4Z6VWOwtWKIoaqkWaNoS0VORVCke3lddIrDQmmvXoy7k6V5tlViUYZ8iIWgi2GwgWCDeGpOaE1CUkVWxUq7WZFxkLRZTyxVjoaNYprApZy/VU1XZmibd569iaUlSKKuoG6/TWhRaFptvbtZzT1+oZuhUU50pKWRlbJYrr5aSVymnYSDmI2WhIuZuFWdol+XVVtYTZV1X46AXFJMknvEaXaEamdzUKqjkXOkt1dcime+ZZKlYE+zaJdrkobFSXuEmYVXVZmfVa6vmsFNmpK3ZZ16eY2Lgr1jV65pXLJ52TrCmo+Up5Biu0pdpaxUU55vcJyplytWY1qWzH+hOkuho1Sju3HVOqhxlneMhalob6KOgy9JtJrCPH6ChVTDX32ecU1cVFmXl4ZnVrF5lZOejoiCxGKOppBqtV3UOY911jtFW1+MoICgfX9aR169mXyliplHVIt4Vl2Ni5W1xZp0hI6YYE/QOcRYsXGrdb1dbVx8h2+iOU2Qx3iclbhgT5KTjqm6WZOVY7CevcNpt5OJoo6PpI6IZKC2m6mWqa5rSUu/VUlYw0V4T75uZWizmGpVcliUxl5Pc1B4XcVUgaaIgnCbXly/lHChwU1ZjD9Ut3ZkTldTxT9yTcCVZIu/VZq8lJCPw6OBnL6ZoGSjOEqegJOneE6vZo+mQ0ycfYqTjq5Ko4h6omulkJGdoKyKbLibYqJjUGBWuG53gKKVnoibtrBqbEunlcKbqqGYsWdpjGycxkRTSVJfmFxTd0w9TXSLpJCZoLZYxFejq6+VqKnBVLw+Ymh8gqCRZH+DdYedn68/SleXkq9jUWJZfIdeXKFzmpteVFyui2pkrrpTka/Al7pPdZh6vJmWfGWzmpuzncp6Xol0k3WKcpx/hGN8jmN/moygpJadwZh4W9E6lIOPyUZamM1yc7qXSFl9onGuoKbBmYSlJkirk75bh4BxolVbvVOXf5F7pZGiccVakp1+ZFOid4per79HQkxjaKSziGKKWoxri5I6SFmXpLSalnanWq6UwIu2xUZ+oKapdabIPL9Sk218Z5GBsJp7XX6fVlt+WpqWjGy5bZNpXFZCS5ONf3KRmlqXU1Fxl5KknnVZS5+vPlODbEVQw0PEVoqth3iahFZNV4t6kVhdc57AmIedv0B8i8KXor1RW4mkdIy/lVNLa1mxdLNzxUyjnMk3NFW1c5ly0jSuk5eHnHY/S21pq51un9E6kZvGNE9NLVGXaWKMYbBkaVajbK6ykpWJwzpsXIJssWydgHmGb0tlsF1Nn4yOvYxgbq6qkIVpUotYpZF4ooLPNIuZe6FfXFhQp6JNpHaRnXWMpoljb1BKXcw1mn+qo9I2WKPAm4uGi42qokqjwUdynJJnnK+zkmlRVVxlrrhfcJjDbJ6zfojAXounjpPCYZhtXI5KXKydsGt0k4WDd494n3GfKkuevHSgobt6mrxAOE09UEpdYH9mUZd0bH6UsZ1/uZKzlbNpvk6ObLKTtXCWuqeqo3PElKKuf57RN5nMpbU9T1Vbe4iPx72Slm5orovClsyPbbebmsNVjLNrjIOIbZjCkHCgs2NWLUqGpyVJrpK7T1pOi16ehmhckq1JoztRum62VZjIwVm8TsU3fmWii2qwmqVqr3qYwEB9T619wZi5VWu9g1dOo3Kuc5WTjmNRiJy9RmhQREtZrqdqlmiTc3ialsKKX2JakHquc1JNpnueh1KMXEtxVKJ8c2aldMZDpIxVmrxAq3CxcImrN02Tw7KToG2NpMCSwEnBQKGyxGeOZb+Tw0SFcG5clmdzU6KFl82cym+wb1uLwqdpl7TaOJe3tJicksNSe5yOZGppxjiLioaFWlVkrn5aqHZ9T2t0tpeWf7xYkmSYjICjoHGSr31ohH2Dd2mxq2mTfbFvOlCxlqGZUJp/pdM5j3p/aXeGrZWLp39ayDSxabw/eZ6hq8U3aGZTrluuvpGOyItxknWcenWdnZWpaElUlaqjmIxsn7FfrsRW2zimnEldlMmBo0RViax2V2Nmmnmnb5uLhG5osK17kJSfmaK3vpJRW1NNQVWxcl5RaFCzaVaYk5eBUoeoSUyDe4VySEu3WY6NTVlFW9k5sme4dFej0DRkW46dxGZ8h5KHupmMqpVr0zqhv3qTgF6JnIl8dE9voqGamXFzl1mLfIahrFFakspqTmS9nm6hjc02k5m9To3AxFllr4ifi3Rgr69sf2SDcFRQU12gyM00UlK7TpuyobmSgHaKUEuYpNg1v02krXCZxDSWdZe4XaNVjG5mlL1wS8Azd6OBbISAMVjKPoZcYmdrsJmXmMq4Y1yjfl5hZq5upZeXcGV+i8O4W79AhmVuWayRoXu1lp5ufqF0h4WB2DWgdJ26in5HUsA6dJtWXJimilqYj8JralfFWZqFmMiDX3SNOktuvMVYk5R1iaCXn8VfS7FpooGsfnlMY06WkWu8dlaHW8JhflWhcLtwSUtfsJJnw1lKTKyXms3GWbh0hKKHbqx5jce6YKufdU3GPK10k6nBObdhP02Ip79ZUY2ViGeuvmPBQWWvf6WuZ5Z0upudeZ6FVq9if3BXbbx/qZjKla6HoI/ApHOPb8RjSqN9ooaBhl6Tj4+km4NXo4uVj7SxaF9Vo6KopIN1uWCXak1dnbShsU6jRVSUkWFNVa+9m09RpZqPj3yjpYBhWH+DeIelbj1Ij3SPaExLVJqIqm9Om5yQan+DjLmWrFWlg6RoXIhrSVpjUpBroInDPnWFZK5Zr3xm1TS1ljtNxGqxk2JOl7LDlXKWX13FkqSZc015kLZlVZdyZ6qTipi/NKWOZFaxdo7HbWbAk4+BYouLt7tQkLPCM495Z71pXFlUqW1eW1NLxUypqJa4kbKTl1lbXFTFNWJNcZ6CV6aSwT+4cGtZxGm9bIubmo26aJuUSU87SXOVnIWQanuKloFzj42aTE67Yo5ispNGWXiezjZgrrqXvpNaS8FtwD16kUxdTqSThZqrob+JWEdLQEqBUXRchIHFXU+LvD6cnpmadIuDqFGlb1uetZ+XdI6WiJejjIzGWIisd1dXU5Knd02jlVpyPUicwZB8r3h1pZ+yoomnp4esgmvFVFxbmJJhUKxnVKOIqo91uFeveHKfmKahu0pcWUzJNnB0WY6jjE+lvjmlq5GAhqZYsE6jkIe8S5fLunAqSIluUVXHkltXg368RZWYj6GMaWWMlMiSvKR6vk+WpMFfncudjHhZv2WMj5GRVFuXt1VTuk9kTnemo6CbfsU6cWddS9Q5KUqSxKeAcGa5UI19dY+emoCnvDU3SmW8eqSOX4FkkrFbjVaueo99T6t3ZVuEcVBdhaFyZ8CSoKKZe56rl4hbVZyIi6uPuMBfnrKiqjpIvEPZOkNRrHOWq8ObcWaAosVIwmp/oplzr3V7Umpcbp6rm3KkfL2McV5YgL2BarxGxFZyWmSOjmhVjpSad1yMq7RmpK2+lEJTf2+noXaYg1Wykm9mZk6IqX2nYq9xVJKzkMFaS6KPvFORqn2IUKXEao25Nk2olX5mV7C5W4d0hWq8OISCpJ21ZoFar3t7VpCKWLGPZXamcpGOyGRLwlDFREFKXFOXnF1Qi11haU9Xwm2Fg6F6X657h7B6nomVZW+bf2RNoliYak5LTF+Me5xoV2xYmH6ilWRRwkB/UISkoZxXjto3lqyxdmxOmnRBTpnAVIyVslaxRFNusKp3VFvElKmamKRnaHxWtm+PkrKUfVNoS0dRlp2kf1Can8GPqH1qkMpGTLNmpXGkbz5JepN3nbtNsHeldY6gwTiPeX5kXFBki5K+rXxco3p+kGyylHijvk6btK1vvGaYdk1dSqORupuSwk7BkpB0qJKUx0xdlmx7YaeVjJNsrqSXzzRrS7F2q5C+ObxoZrx3pFBLSku7mI6blJeAo8Jlk76ln1qYqZCgoo68uWpSYpaEpKNkrp93nZpIS5KBdVqegsI7Y1CraWFSulZ6p6mTi1+NjqOIkGu8alpNPEg/TLRmw16jhZGcX1LBTnRcX42iglJkuZa8O5l2hnjDZYibjI8qR2WMs3eGao59VKSpfI99bU67VzNViHOklnpfj3Scd6R1RExjmI60cWauc5jGdFnEmoqSn4ate4Fvl4mzk3uNlpBQUXhMkMDaOI2JcZTBV25SvFF+WK58Zq6rk4ppmpqoc4Vpi4SYeH+gk2qhe32jelaglrWXinakqUtdrHSbwHqCa1xQpIerdllemJ55aF2WzYBYbLFYjktXk7Ona7dZksd2jWhmm5iRYnWGjm5/V3xfSVaSkaqXrJHDV4R6mHaPmbRoZH+zmJJplICYp7CZcFWAvIxzupKOo7dnZ2e8O9g5q2mKdUtblYWIgpXLmJZwZlGad5yAcW1QvzazeZ9vsG2beodsfWtIWomBrW2emMVdT107UXxafqmUvpHAn4evkqN2sXpXjoNjwFHEWT5Rc1y2YJyRZoxJVYunclGBW42Tdr1wnFuYmnuRjHmneY6BcYGmtmalbb88uFahoHxgrGqwaYuNhVi8knWekp6Ll5+Lxj6Jb5GHhnasdYShU5qEgZqDiKDNNMJFcV2VwCxVrZJwVZTKs2WKnah9fGNYpYyae16rnkBKrpqOe4ZcxJIxWJOaMVaPuWy9iax0WHJTg1hfU1dTRUuzeKuQa1aHhZhqbGdajoidyzVLXUxLVbGxknKfyziZhlRNYY18hoNUlWWSqKStuWDJN8VSXWZWUHxaYa6FWnOfqpm7TMCbr2Z1WX+faLCktJO5UU2euYNgfoDIPp6v1zSApaB2mGyvasBijpdcTJarcJqhgHxptJNSjYZgqqKZs6N5f291c3q8xF18VIl/s5q9NJB1i2Rjo52+fKmsm4ytanSNh6p4VqLGWpl8mrSSuJCBlr/IO6ebpnuHqYNXbkuQm8CXyjTBWV9WoMhdjaCUnahUTKluwmHDm3eNkntmo4mYxGOYd3BnjK2DfZ2aXZjTOsA9WEylrbVgWV2eypCZXVO1dbSTjIKhgVqjalPLPruYtVwsVqDCYlSWqcVMmpqNX52InnFnsJqKzjiXpoSkZ0y8nHecyDuQxYuXjIyMYFdRfoKdjVxVxVZ8ni9VS1CZlD9Nk5SqaXmbg6KnfmpmrZfQOZOLmrmGo75hpnk4SY9+ksSOeWKuxUWPl4h9zTy9a4taalqYdKNskGqImp2kTVu7ZISqh3RvUJioTUtRpIJkkGOXy6KWZExqUThKoX2VrZKmXouUx6+YblByU8RBd5yei7w6blNpaYvDjIRwmkhSb1Ngjp2PZGe6T6x+mr18np1ykqVwoG9XZX5YsKK9h25rTpeLqqKBvFRbYWdcW4Jtd42hdF+wX1RyTC5VOE2ibISBbWeks11QdZGYobxhdqS2YJ6ribqMmZ3ByD6NvMCbk8M6T1WkdIWse5icmm98UIqXpHpKVqS71TurlZp6uHWNcktaxlRrUJSYlrOzkn6Jpa2SnJ3BkLKSeDhNuJtVVJZ3n6c8SHyCtV6cu1dOU6V4jLuTuFZoUm5SjJWXl4FQkGGQlKqejY2sZ8A5imW8RYRqbFtMUo25VK5TUXBSvJN2W41wMlWueZyOdb2QlpCnmG5jaIiHj4eKX1xbiJucxbpjlWafbaehr3tvUb4zlHSbq5SzSlJ6gKCSirxMpp58pYCDqF2wm3Kppp54kobAlV9elJ6Wbn+DU6N6Tr5Tp6WpeKuRuGaLopDJYqOgdZGomrqWzcKWfJ6LwIBnc1yUaNE0qWxEXIlrlZuff5++vmXDUH1oQVGUon9UxGF/WY6vl3aIrJW4emCOapDK1TXAabmSk2lyV3JdYaKNqnhRi6JJTHucuFJoZp7Gp5aWsH5rO0e8aaCllLp3h6mme6XQNL5sj7nFTVKiw5p3gaujo6Sof7hUw5JhS8OaXqNaXlSLUlFkmFSilsOofp6lsZKPcb9gkZCzd7xGj2+JbpFlQVWTjZuxvEmioYumsZooSmpoi4uPtdQ10DV8Y3ufiXNkS4y8spLFXItxbGfAlJqHpXNgaLWWhW9PW5h4lLlWjMVMlGbZOIdhqW1Qo0VLwGuUgZ6siKWOiKNtUotgaLaTjH3NO849aWjUNL1KrpOeppaQWUymcox7nXDQPJC4dUyljaqQmK6cb6t4kXCOZXuCpJiMandUk7h0jbZaooGFeMM9rmiKa3qRe4dsZl+jZ1xRTp7Dlqqvk7eZxVXBm3xZspmYxpqBlKmehTNVWVOkqL0/hqdnW09VkaZeo1uLXI1nV6J6alx/p5CIr3pYi05XqZWQgYJddU87RrGatJaAvGtOpI29cElNvZJxTG5TUlR7icBMinxnsF2vf1OwdI+OdIrBVJzKYGeju79NlJy9Q5W9ip5VjHCemqxrZrGaYJhraGy9sW6SvElRmYyTc3SYrHuyksGUoqVMo41eX1xgV4Z4kcpLXIl6uJeQfKWnbFZif3tilK1tUH9vqWiMho10XmbFWGBTt3OGc01Mhat5ibeZoaqrn5Vyna5nU5CWiViUuXiAlLGPxaGmoYh1m4RaVbFHS52WbqCbkXemgXG2bYp1eaNkS0xLwzOhjIagpne5UL5JbEy7mKl4caRJTKWSuJiXwzhMvGGCUnKjkq5mTJy9u5WHd3pilI+3am+vWo2dm75vVZm/XrlqhaA4Sql5kplmS7WYT1uIW5Zsxz7FRGN+j6pCS5jHP1K5cqG9wViJgaqQw2ywdpx+LlW7lsOaRVPGNZixxGWnq5rLSVxoTWRWioi4dXibUphpWpeInMmdyXJOWl09SounoofTOqeTUl2NcZ6mkHd7Ta9xX01UrmB/hoRWpXxdmaaVs1mYhoF8Z2ZcipuOgr1vRFvHQFhVvE17YMNnyj7BP1hbg588TY+Rl7qTw5Kw1DSodp6peJZCTXmEqWq/mpWOen+cpbxAVV2DbYmDlMA8T5GikMWMo6CubUuTx703xDu7UoBReVp6isU2tnShvUNVuVabxqS8sHGTpG9RxVR3ipTLeF3TO9E8jMTEmY+vWlumaT9SiruVsn5Un6jYN5R4b5eblcMzqpe2XYyrj2a1kzdK2zmPmMVLb55Yr0FSn7qCbmKukZG9NF2NVVukeU9QrHK5V4y6malko6huXK+Zpo/CelpVi5RkvkZ4UpydhWbDkp6mOEu0ZalrvVqxmlKNjYCRpHSbYE2/OdA8eFBLTFKjimmJo1dS2DbMN2OwfYeBo4q6Sl2mq6qdU1zbOYqflaN6f0xNxVtvVsEzSEx8goChSUyTrXqgs5mMjcMzT1hXjso1lq9wmpaZm29zoZ+vX0xfi4SlbmZ0iEhWdJJFS4p8noWFWLpqRktYTcFnmYmFqk1TdYq8mYFyn7BmUJ2lWKWghqqgP1TAZ5+8isOUdIzGlG2fv5yjkIyWkrWakX+8RopdWVJeXMBYQlbDlovBl4p/W5CRjWa0mrtMb1tmi2OjhYRRo4ldW1yFgZmOmoOLeZGJonR+Xcg3nHnDRHqagKlKV6Kuw0XGQJfGnm+AvIuad41haF1Tu5ugxUtRj3OPw5afmqFNVJeQv0CDfsU0smfBllqLkZq5kztRg1iIqXmBZKO2ak+jum1oS8JGU43UNF5RooeXzMVYdXTFO1SNmJhRo5TAo6xym7SVnnGap8FganSVt2W8Za7TObiTk3x0hcVIWlOHobCVibyHZ6Zwn8STcnWCnIF8f3NcwViYwDZJ'
  };
  const MORPH_VS = `
    precision highp float;
    attribute vec2 a_from;
    attribute vec2 a_to;
    attribute vec3 a_seed;
    uniform float u_mix, u_time, u_aspect, u_dpr, u_shift, u_fade;
    uniform vec3 u_view;                       // x: escala, y: desplazamiento vertical (NDC), z: tamaño de punto
    uniform vec2 u_mouse;
    varying float v_k;
    varying float v_a;
    void main() {
      float delay = a_seed.x * .38;
      float k = clamp((u_mix - delay) / .62, 0., 1.);
      k = k * k * (3. - 2. * k);
      vec2 p = mix(a_from, a_to, k);
      p.x += mix(-u_shift, u_shift, k);
      float transit = sin(k * 3.14159);
      float ang = a_seed.y * 6.28318;
      p += vec2(cos(ang), sin(ang)) * transit * (.16 + a_seed.z * .5);
      p += .008 * vec2(sin(u_time * 1.2 + a_seed.y * 40.), cos(u_time * 1.0 + a_seed.z * 40.));
      float z = (a_seed.z - .5) * .5 + transit * (a_seed.x - .5) * .9;
      float ry = sin(u_time * .35) * .32 + u_mouse.x * .42;
      float cy = cos(ry), sy = sin(ry);
      vec3 q = vec3(p.x * cy + z * sy, p.y + u_mouse.y * .04, -p.x * sy + z * cy);
      float persp = 1. / (1. - q.z * .5);
      vec2 s = q.xy * persp * u_view.x;
      s.x /= u_aspect;
      s.y += u_view.y;
      gl_Position = vec4(s, 0., 1.);
      gl_PointSize = (1.7 + a_seed.z * 2.0) * (1. + transit * .6) * persp * u_dpr * u_view.z;
      v_k = k;
      v_a = mix(.78, 1., k) * u_fade;
    }`;
  const MORPH_FS = `
    precision mediump float;
    varying float v_k;
    varying float v_a;
    void main() {
      float r = length(gl_PointCoord - .5);
      if (r > .5) discard;
      float soft = smoothstep(.5, .1, r);
      vec3 col = mix(vec3(.4, .52, .8), vec3(.53, .79, .94), v_k);
      col = mix(col, vec3(1.), soft * .35 * v_k);
      gl_FragColor = vec4(col, soft * v_a);
    }`;

  function decodeCloud(b64, take) {
    const bin = atob(b64);
    const total = bin.length / 2;
    const n = Math.min(take, total);
    const pts = [];
    for (let i = 0; i < n; i++) {
      const x = (bin.charCodeAt(i * 2) / 255) * 2 * CLOUDS.range - CLOUDS.range;
      const y = (bin.charCodeAt(i * 2 + 1) / 255) * 2 * CLOUDS.range - CLOUDS.range;
      pts.push([x, y]);
    }
    pts.sort((p, q) => p[0] - q[0] || p[1] - q[1]);       // orden por x: el flujo cruza de forma ordenada
    return pts;
  }

  const morph = {
    p: 0, gl: null, size: null, ready: false, textEl: null,
    init(canvas, textEl) {
      const gl = getGL(canvas);
      if (!gl) throw new Error('webgl');
      this.gl = gl;
      this.textEl = textEl;
      this.size = watchSize(canvas, isSmall() ? 1.6 : 2);
      this.prog = buildProgram(gl, MORPH_VS, MORPH_FS);
      this.loc = {
        from: gl.getAttribLocation(this.prog, 'a_from'),
        to: gl.getAttribLocation(this.prog, 'a_to'),
        seed: gl.getAttribLocation(this.prog, 'a_seed')
      };
      this.u = {};
      ['u_mix', 'u_time', 'u_aspect', 'u_dpr', 'u_shift', 'u_fade', 'u_view', 'u_mouse']
        .forEach((n) => { this.u[n] = gl.getUniformLocation(this.prog, n); });

      const take = isSmall() ? 2600 : CLOUDS.n;
      const A = decodeCloud(CLOUDS.wheelchair, take);
      const B = decodeCloud(CLOUDS.runner, take);
      const N = Math.min(A.length, B.length);
      const rnd = mulberry(23);
      const data = new Float32Array(N * 7);
      for (let i = 0; i < N; i++) {
        const o = i * 7;
        data[o] = A[i][0]; data[o + 1] = A[i][1];
        data[o + 2] = B[i][0]; data[o + 3] = B[i][1];
        data[o + 4] = rnd(); data[o + 5] = rnd(); data[o + 6] = rnd();
      }
      this.count = N;
      this.buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
      this.ready = true;
    },
    render(time, mx, my) {
      const { gl, size, u } = this;
      if (!this.ready || !size.visible) return;
      gl.viewport(0, 0, size.w, size.h);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(this.prog);

      const W = size.w / size.dpr, H = size.h / size.dpr;
      const aspect = W / H;
      // la figura ocupa el espacio libre entre la barra de navegación y el texto
      const textTop = this.textEl ? this.textEl.offsetTop : H * 0.6;
      const topPad = 98;
      const areaH = Math.max(120, textTop - topPad - 14);
      const shift = aspect > 1.2 ? 0.5 : 0.1;
      const figH = Math.min(areaH * 0.86, (W * 0.86) / (1.2 + 2 * shift));
      const cy = topPad + areaH / 2;
      const scale = (2 * figH) / H;                  // unidades de figura -> NDC
      const offY = 1 - (2 * cy) / H;
      const mix = prefersReduced ? 1 : clamp((this.p - 0.05) / 0.8);

      gl.uniform1f(u.u_mix, mix);
      gl.uniform1f(u.u_time, time);
      gl.uniform1f(u.u_aspect, aspect);
      gl.uniform1f(u.u_dpr, size.dpr);
      gl.uniform1f(u.u_shift, shift);
      gl.uniform1f(u.u_fade, 1);
      gl.uniform3f(u.u_view, scale, offY, clamp(figH / 340, 0.8, 1.7));
      gl.uniform2f(u.u_mouse, mx, my);

      gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
      const stride = 28;
      gl.enableVertexAttribArray(this.loc.from);
      gl.vertexAttribPointer(this.loc.from, 2, gl.FLOAT, false, stride, 0);
      gl.enableVertexAttribArray(this.loc.to);
      gl.vertexAttribPointer(this.loc.to, 2, gl.FLOAT, false, stride, 8);
      gl.enableVertexAttribArray(this.loc.seed);
      gl.vertexAttribPointer(this.loc.seed, 3, gl.FLOAT, false, stride, 16);
      gl.drawArrays(gl.POINTS, 0, this.count);
    }
  };

  function setupWebGL() {
    const small = isSmall();
    const heroCv = $('#heroCanvas');
    const finaleCv = $('#finaleCanvas');
    const morphCv = $('#morphCanvas');
    let hero = null, finale = null;
    const t0 = performance.now();

    try {
      if (heroCv) {
        hero = new Ribbon(heroCv, {
          strands: small ? 34 : 64, segments: small ? 110 : 180, points: small ? 34 : 64,
          pointSize: small ? 2.6 : 3.1, maxDpr: small ? 1.6 : 2, seed: 7,
          offX: 0.2, offY: 0.02, offYPortrait: 0.3
        });
      }
    } catch (e) { hero = null; }
    try {
      if (finaleCv) {
        finale = new Ribbon(finaleCv, {
          strands: small ? 28 : 48, segments: small ? 90 : 140, points: small ? 24 : 44,
          pointSize: small ? 2.4 : 2.9, maxDpr: small ? 1.5 : 1.8, seed: 19,
          offX: 0, offY: 0, offYPortrait: 0
        });
        finale.intro = 1;
      }
    } catch (e) { finale = null; }
    try {
      if (morphCv) morph.init(morphCv, $('.manifesto__text'));
    } catch (e) { root.classList.add('no-gl'); }

    const heroScene = scenes.find((s) => s.el.classList.contains('hero'));
    let introStart = null;
    const drift = (t, k) => Math.sin(t * 0.21 * k) * 0.42;

    const draw = (now, dt) => {
      const t = (now - t0) / 1000;
      const mx = clamp(ptr.x + drift(t, 1), -1, 1), my = clamp(ptr.y * 0.7 + Math.cos(t * 0.17) * 0.25, -1, 1);

      if (hero) {
        if (prefersReduced) hero.intro = 1;
        else if (root.classList.contains('is-loaded')) {
          if (introStart === null) introStart = now;
          hero.intro = smooth(clamp((now - introStart) / 3200));
        }
        const hp = heroScene ? heroScene.cur || 0 : 0;
        hero.render(prefersReduced ? 4.2 : t, { fade: clamp(1.05 - hp * 1.15), chaos: hp * 0.5, lift: hp * 0.22, mx, my });
      }
      if (finale) finale.render(prefersReduced ? 9 : t + 30, { fade: 0.9, mx: mx * 0.6, my: my * 0.6 });
      if (morph.ready) morph.render(t, mx, my);
    };

    if (prefersReduced) {
      // un solo cuadro estático
      requestAnimationFrame((now) => draw(now, 0));
      window.addEventListener('resize', () => requestAnimationFrame((now) => draw(now, 0)));
    } else {
      ticks.push((vh, dt, now) => draw(now, dt));
    }
  }

  /* ------------------------------------------------------------------------
     6. GALERÍA HORIZONTAL (pinned en escritorio) y TARJETAS APILADAS
     ------------------------------------------------------------------------ */
  function setupGallery() {
    const sec = $('[data-gallery]');
    if (!sec) return;
    const track = $('.gallery__track', sec);
    const cards = $$('.gcard', sec);
    let dist = 0;
    let scene = null;

    const configure = () => {
      const want = isDesktop() && !prefersReduced;
      if (want) {
        sec.classList.add('is-pinned');
        track.scrollLeft = 0;
        dist = Math.max(0, track.scrollWidth - window.innerWidth);
        sec.style.setProperty('--h', `${Math.round(dist + window.innerHeight * 1.15)}px`);
        if (!scene) {
          scene = addScene(sec, 'pin', (p) => { track.style.setProperty('--gx', (p * dist).toFixed(1)); }, 10);
        }
        scene.on = true;
        scene.written = undefined;
      } else {
        sec.classList.remove('is-pinned');
        sec.style.removeProperty('--h');
        track.style.removeProperty('--gx');
        if (scene) scene.on = false;
      }
    };
    configure();
    let to;
    window.addEventListener('resize', () => { clearTimeout(to); to = setTimeout(configure, 150); });

    if (prefersReduced) return;
    // parallax horizontal de cada foto según su posición respecto al centro de la pantalla
    ticks.push((vh) => {
      const r = sec.getBoundingClientRect();
      if (r.bottom < -vh * 0.3 || r.top > vh * 1.3) return;
      const half = window.innerWidth / 2;
      cards.forEach((c) => {
        const b = c.getBoundingClientRect();
        const cp = clamp(((b.left + b.width / 2) - half) / half, -1.3, 1.3);
        c.style.setProperty('--cp', cp.toFixed(3));
      });
    });
  }

  function setupStack() {
    const cards = $$('.scard');
    if (cards.length < 2 || prefersReduced) return;
    let stickTop = [];
    const measure = () => { stickTop = cards.map((c) => parseFloat(getComputedStyle(c).top) || 0); };
    measure();
    window.addEventListener('resize', measure);
    const last = new Array(cards.length).fill(-1);
    ticks.push((vh) => {
      const first = cards[0].getBoundingClientRect();
      const lastR = cards[cards.length - 1].getBoundingClientRect();
      if (first.top > vh * 1.5 || lastR.bottom < -vh * 0.5) return;
      for (let i = 0; i < cards.length - 1; i++) {
        const nr = cards[i + 1].getBoundingClientRect();
        const s = clamp((vh * 0.95 - nr.top) / (vh * 0.95 - stickTop[i + 1]));
        const v = Math.round(s * 500) / 500;
        if (v !== last[i]) { last[i] = v; cards[i].style.setProperty('--s', v); }
      }
    });
  }

  /* ------------------------------------------------------------------------
     7. INTERACCIONES: preguntas frecuentes, foco/tilt, botones magnéticos
     ------------------------------------------------------------------------ */
  function setupFaq() {
    const items = $$('.qa');
    items.forEach((item) => {
      const btn = $('button', item);
      btn.addEventListener('click', () => {
        const open = !item.classList.contains('is-open');
        items.forEach((o) => {
          const isThis = o === item;
          o.classList.toggle('is-open', isThis && open);
          $('button', o).setAttribute('aria-expanded', String(isThis && open));
        });
      });
    });
  }

  function setupPointerFx() {
    if (!finePointer) return;
    $$('.spot').forEach((el) => {
      const tilt = el.classList.contains('tilt') && !prefersReduced;
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width;
        const y = (e.clientY - r.top) / r.height;
        el.style.setProperty('--mx', `${(x * 100).toFixed(1)}%`);
        el.style.setProperty('--my', `${(y * 100).toFixed(1)}%`);
        if (tilt) {
          el.style.setProperty('--ry', `${((x - 0.5) * 7).toFixed(2)}deg`);
          el.style.setProperty('--rx', `${((0.5 - y) * 5).toFixed(2)}deg`);
        }
      });
      el.addEventListener('pointerleave', () => {
        el.style.setProperty('--rx', '0deg');
        el.style.setProperty('--ry', '0deg');
      });
    });

    if (prefersReduced) return;
    $$('[data-magnetic]').forEach((el) => {
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2);
        const dy = e.clientY - (r.top + r.height / 2);
        el.style.translate = `${(dx * 0.16).toFixed(1)}px ${(dy * 0.26).toFixed(1)}px`;
      });
      el.addEventListener('pointerleave', () => { el.style.translate = ''; });
    });
  }

  function setupPointerTracking() {
    window.addEventListener('pointermove', (e) => {
      const nx = (e.clientX / window.innerWidth) * 2 - 1;
      const ny = (e.clientY / window.innerHeight) * 2 - 1;
      ptr.energy = Math.min(1, ptr.energy + Math.hypot(nx - ptr.tx, ny - ptr.ty) * 2.2);
      ptr.tx = nx; ptr.ty = ny;
    }, { passive: true });
  }

  /* ------------------------------------------------------------------------
     8. FORMULARIO -> WHATSAPP
     ------------------------------------------------------------------------ */
  function setupForm() {
    const form = $('#waForm');
    if (!form) return;
    const status = $('#formStatus');
    const nameEl = $('#f-name'), topicEl = $('#f-topic'), phoneEl = $('#f-phone'), msgEl = $('#f-msg');

    const setErr = (input, text) => {
      const field = input.closest('.field');
      const err = $(`#${input.id}-err`);
      field.classList.toggle('is-invalid', Boolean(text));
      input.setAttribute('aria-invalid', text ? 'true' : 'false');
      if (err) err.textContent = text || '';
    };
    [nameEl, topicEl].forEach((el) => {
      el.addEventListener('input', () => setErr(el, ''));
      el.addEventListener('change', () => setErr(el, ''));
    });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      status.textContent = '';
      status.classList.remove('is-error');

      const name = nameEl.value.trim();
      const topic = topicEl.value;
      let bad = null;
      if (name.length < 2) { setErr(nameEl, 'Escribe tu nombre para saber cómo llamarte.'); bad = bad || nameEl; }
      if (!topic) { setErr(topicEl, 'Elige qué te gustaría atender.'); bad = bad || topicEl; }
      if (bad) {
        bad.focus();
        status.textContent = 'Revisa los campos marcados.';
        status.classList.add('is-error');
        return;
      }

      const lines = [
        `Hola FISIOAR, soy ${name}.`,
        `Me gustaría atender: ${topic}.`,
        msgEl.value.trim() ? `Detalle: ${msgEl.value.trim()}` : '',
        phoneEl.value.trim() ? `Mi teléfono: ${phoneEl.value.trim()}` : '',
        '¿Me ayudan a agendar una valoración?'
      ].filter(Boolean);

      form.classList.add('is-loading');
      const url = waLink(lines.join('\n'));
      const win = window.open(url, '_blank', 'noopener');
      if (!win) window.location.href = url;          // si el navegador bloquea la ventana nueva
      setTimeout(() => {
        form.classList.remove('is-loading');
        status.textContent = 'Listo. Abrimos WhatsApp con tu mensaje, solo falta que lo envíes.';
        form.reset();
      }, 900);
    });
  }

  /* ------------------------------------------------------------------------
     9. ARRANQUE
     ------------------------------------------------------------------------ */
  function boot() {
    setupNav();
    setupForm();
    setupFaq();
    setupPointerTracking();
    setupPointerFx();

    if (!prefersReduced) setupScenes();
    setupWebGL();
    setupGallery();
    setupStack();
    if (!prefersReduced) requestAnimationFrame((t) => { lastNow = t; frame(t); });

    runLoader().then(() => {
      root.classList.add('is-loaded');
      setupReveal();
      setTimeout(() => root.classList.add('wa-on'), 2200);
      setTimeout(() => {
        const wa = $('.wa-float');
        if (!wa) return;
        wa.classList.add('show-tip');
        setTimeout(() => wa.classList.remove('show-tip'), 4200);
      }, 5200);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
