import { useEffect, useRef } from "react";
import * as THREE from "three";
import gsap from "gsap";
import { slideBg } from "../services/heroSlides";

/**
 * WebGL hero — the photography flows like liquid under the cursor while a
 * fine atlas graticule is revealed in its wake, then everything relaxes.
 * Velocity is written into a ping-pong flowmap; the fragment shader offsets
 * the image by it and draws warping map lines where the field is alive.
 * Crossfades and settles are GSAP tweens on uniforms. Desktop only; the DOM
 * crossfade stays as poster + fallback (onReady/onFail decide which shows).
 */

const FLOW_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
  }
`;

// Flow field pass — decay previous frame, stamp cursor velocity (0.5-centred
// so a plain byte target holds signed values everywhere).
const FLOW_FRAG = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uPrev;
  uniform vec2 uMouse;
  uniform vec2 uVelo;
  uniform float uAspect;
  void main() {
    vec2 v = (texture2D(uPrev, vUv).rg - 0.5) * 0.925;
    vec2 d = vUv - uMouse;
    d.x *= uAspect;
    v += uVelo * exp(-dot(d, d) / 0.0042) * 0.5;
    gl_FragColor = vec4(clamp(v, -0.5, 0.5) + 0.5, 0.0, 1.0);
  }
`;

const IMAGE_FRAG = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uTexA;
  uniform sampler2D uTexB;
  uniform sampler2D uFlow;
  uniform vec2 uRes;
  uniform vec2 uSizeA;
  uniform vec2 uSizeB;
  uniform float uZoomA;
  uniform float uZoomB;
  uniform float uProg;
  uniform vec2 uPar;

  vec2 coverUV(vec2 uv, vec2 img, float zoom) {
    vec2 ratio = vec2(
      min((uRes.x / uRes.y) / (img.x / img.y), 1.0),
      min((uRes.y / uRes.x) / (img.y / img.x), 1.0)
    );
    uv = (uv - 0.5) / zoom + 0.5;
    return vec2(
      uv.x * ratio.x + (1.0 - ratio.x) * 0.5,
      uv.y * ratio.y + (1.0 - ratio.y) * 0.5
    );
  }

  vec3 sampleTex(sampler2D t, vec2 uv, vec2 off) {
    return vec3(
      texture2D(t, uv + off).r,
      texture2D(t, uv).g,
      texture2D(t, uv - off).b
    );
  }

  void main() {
    vec2 flow = texture2D(uFlow, vUv).rg - 0.5;

    // the photo drags with the field + eased parallax
    vec2 duv = vUv + uPar - flow * 0.062;
    vec2 chroma = flow * 0.014;
    vec3 a = sampleTex(uTexA, coverUV(duv, uSizeA, uZoomA), chroma);
    vec3 b = sampleTex(uTexB, coverUV(duv, uSizeB, uZoomB), chroma);
    vec3 col = mix(a, b, smoothstep(0.0, 1.0, uProg));

    gl_FragColor = vec4(col, 1.0);
  }
`;

export default function HeroFlow({ slides, active, onReady, onFail }) {
  const hostRef = useRef(null);
  const stRef = useRef(null);

  // Build the whole GL world once.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let dead = false;

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, powerPreference: "low-power" });
    } catch {
      onFail?.();
      return;
    }
    renderer.setClearColor(0x1b1713, 1);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    host.appendChild(renderer.domElement);

    const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const quad = new THREE.PlaneGeometry(2, 2);

    const rtOpts = { depthBuffer: false, stencilBuffer: false };
    let rtA = new THREE.WebGLRenderTarget(192, 108, rtOpts);
    let rtB = new THREE.WebGLRenderTarget(192, 108, rtOpts);
    // flow is 0.5-centred — clear to the zero-flow value (raw, no color mgmt)
    const zeroFlow = new THREE.Color().setRGB(0.5, 0.5, 0, THREE.NoColorSpace);
    renderer.setClearColor(zeroFlow, 1);
    renderer.setRenderTarget(rtA);
    renderer.clear();
    renderer.setRenderTarget(rtB);
    renderer.clear();
    renderer.setRenderTarget(null);
    renderer.setClearColor(0x1b1713, 1);

    const flowMat = new THREE.ShaderMaterial({
      vertexShader: FLOW_VERT,
      fragmentShader: FLOW_FRAG,
      uniforms: {
        uPrev: { value: rtA.texture },
        uMouse: { value: new THREE.Vector2(0.5, 0.5) },
        uVelo: { value: new THREE.Vector2(0, 0) },
        uAspect: { value: 1 },
      },
    });
    const flowScene = new THREE.Scene();
    flowScene.add(new THREE.Mesh(quad, flowMat));

    const imgMat = new THREE.ShaderMaterial({
      vertexShader: FLOW_VERT,
      fragmentShader: IMAGE_FRAG,
      uniforms: {
        uTexA: { value: null },
        uTexB: { value: null },
        uFlow: { value: rtB.texture },
        uRes: { value: new THREE.Vector2(1, 1) },
        uSizeA: { value: new THREE.Vector2(1, 1) },
        uSizeB: { value: new THREE.Vector2(1, 1) },
        uZoomA: { value: 1.06 },
        uZoomB: { value: 1.06 },
        uProg: { value: 1 },
        uPar: { value: new THREE.Vector2(0, 0) },
      },
    });
    const imgScene = new THREE.Scene();
    imgScene.add(new THREE.Mesh(quad, imgMat));

    const st = {
      renderer, imgMat, flowMat,
      textures: new Array(slides.length).fill(null),
      current: active,
      ready: false,
      zoomTween: null,
    };
    stRef.current = st;

    // textures — Appwrite storage needs CORS; any failure keeps the DOM hero.
    // `glx` cache-buster: the DOM hero caches these URLs from no-cors <img>
    // requests, and that cache entry (no ACAO stored) poisons CORS loads.
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin("anonymous");
    slides.forEach((s, i) => {
      let src = slideBg(s);
      if (!src) return;
      if (/^https?:/.test(src)) src += (src.includes("?") ? "&" : "?") + "glx=1";
      loader.load(
        src,
        (tex) => {
          if (dead) return;
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.minFilter = THREE.LinearFilter;
          tex.generateMipmaps = false;
          st.textures[i] = tex;
          if (!st.ready && i === st.current) {
            st.ready = true;
            const u = imgMat.uniforms;
            u.uTexA.value = u.uTexB.value = tex;
            u.uSizeA.value.set(tex.image.width, tex.image.height);
            u.uSizeB.value.set(tex.image.width, tex.image.height);
            u.uZoomB.value = 1.13;
            st.zoomTween = gsap.to(u.uZoomB, { value: 1.06, duration: 6.5, ease: "expo.out" });
            onReady?.();
          }
        },
        undefined,
        () => { if (!st.ready && i === st.current) onFail?.(); }
      );
    });

    // pointer → smoothed position, velocity from the smoothed motion
    const mouse = { x: 0.5, y: 0.5, sx: 0.5, sy: 0.5, px: 0.5, py: 0.5, in: false };
    const zone = host.closest(".mk-hero-zone") || host.closest(".mk-hero") || host;
    const onMove = (e) => {
      const r = host.getBoundingClientRect();
      mouse.x = (e.clientX - r.left) / r.width;
      mouse.y = 1 - (e.clientY - r.top) / r.height;
      if (!mouse.in) { mouse.sx = mouse.px = mouse.x; mouse.sy = mouse.py = mouse.y; mouse.in = true; }
    };
    const onLeave = () => { mouse.in = false; };
    zone.addEventListener("pointermove", onMove, { passive: true });
    zone.addEventListener("pointerleave", onLeave);

    const size = () => {
      const w = host.clientWidth || 1;
      const h = host.clientHeight || 1;
      renderer.setSize(w, h);
      imgMat.uniforms.uRes.value.set(w, h);
      flowMat.uniforms.uAspect.value = w / h;
    };
    size();
    const ro = new ResizeObserver(size);
    ro.observe(host);

    let raf = 0;
    const frame = () => {
      raf = requestAnimationFrame(frame);
      if (document.hidden || !st.ready) return;

      mouse.sx += (mouse.x - mouse.sx) * 0.1;
      mouse.sy += (mouse.y - mouse.sy) * 0.1;
      const vx = THREE.MathUtils.clamp((mouse.sx - mouse.px) * 9, -0.85, 0.85);
      const vy = THREE.MathUtils.clamp((mouse.sy - mouse.py) * 9, -0.85, 0.85);
      mouse.px = mouse.sx;
      mouse.py = mouse.sy;

      flowMat.uniforms.uMouse.value.set(mouse.sx, mouse.sy);
      flowMat.uniforms.uVelo.value.set(mouse.in ? vx : 0, mouse.in ? vy : 0);
      flowMat.uniforms.uPrev.value = rtA.texture;
      renderer.setRenderTarget(rtB);
      renderer.render(flowScene, cam);
      renderer.setRenderTarget(null);

      imgMat.uniforms.uFlow.value = rtB.texture;
      imgMat.uniforms.uPar.value.set((mouse.sx - 0.5) * 0.016, (mouse.sy - 0.5) * 0.011);
      renderer.render(imgScene, cam);
      [rtA, rtB] = [rtB, rtA];
    };
    raf = requestAnimationFrame(frame);

    return () => {
      dead = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      zone.removeEventListener("pointermove", onMove);
      zone.removeEventListener("pointerleave", onLeave);
      st.zoomTween?.kill();
      gsap.killTweensOf(imgMat.uniforms.uProg);
      st.textures.forEach((t) => t?.dispose());
      rtA.dispose(); rtB.dispose();
      quad.dispose(); flowMat.dispose(); imgMat.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      stRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slides]);

  // Slide change → crossfade the incoming texture with its own settle.
  useEffect(() => {
    const st = stRef.current;
    if (!st || !st.ready || active === st.current) return;
    const tex = st.textures[active];
    if (!tex) { st.current = active; return; }
    const u = st.imgMat.uniforms;

    u.uTexA.value = u.uTexB.value;
    u.uSizeA.value.copy(u.uSizeB.value);
    u.uZoomA.value = u.uZoomB.value;
    st.zoomTween?.kill();

    u.uTexB.value = tex;
    u.uSizeB.value.set(tex.image.width, tex.image.height);
    u.uZoomB.value = 1.13;
    u.uProg.value = 0;
    st.current = active;
    gsap.killTweensOf(u.uProg);
    gsap.to(u.uProg, { value: 1, duration: 1.25, ease: "power2.inOut" });
    st.zoomTween = gsap.to(u.uZoomB, { value: 1.06, duration: 6.5, ease: "expo.out" });
  }, [active]);

  return <div ref={hostRef} className="mk-hero-gl" aria-hidden="true" />;
}
