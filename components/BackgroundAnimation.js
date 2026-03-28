/**
 * Stellar Nexus — Quantum Crystal Network
 * A Three.js 3D background: glowing crystals, energy beams,
 * particle streams, nebula shaders, mouse parallax, animated rings.
 */
import { useEffect, useRef } from 'react';

export default function BackgroundAnimation() {
  const mountRef = useRef(null);

  useEffect(() => {
    let animId;
    let renderer;
    let mounted = true;
    const disposables = [];

    async function init() {
      const THREE = await import('three');
      if (!mounted || !mountRef.current) return;
      const mount = mountRef.current;

      // ── RENDERER ──────────────────────────────────────────────────────────
      renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.setClearColor(0x07071a, 1);
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.1;
      mount.appendChild(renderer.domElement);
      disposables.push(() => {
        renderer.dispose();
        if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
      });

      // ── SCENE + CAMERA ────────────────────────────────────────────────────
      const scene = new THREE.Scene();
      scene.fog = new THREE.FogExp2(0x07071a, 0.007);

      const camera = new THREE.PerspectiveCamera(68, window.innerWidth / window.innerHeight, 0.1, 400);
      camera.position.set(0, 0, 42);

      const clock = new THREE.Clock();

      // ── HELPER: canvas glow texture ───────────────────────────────────────
      function makeGlowTex(r, g, b, size = 128) {
        const c = document.createElement('canvas');
        c.width = c.height = size;
        const ctx = c.getContext('2d');
        const half = size / 2;
        const grad = ctx.createRadialGradient(half, half, 0, half, half, half);
        grad.addColorStop(0,   `rgba(${r},${g},${b},1)`);
        grad.addColorStop(0.15,`rgba(${r},${g},${b},0.8)`);
        grad.addColorStop(0.4, `rgba(${r},${g},${b},0.25)`);
        grad.addColorStop(0.7, `rgba(${r},${g},${b},0.05)`);
        grad.addColorStop(1,   `rgba(0,0,0,0)`);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, size, size);
        const tex = new THREE.CanvasTexture(c);
        disposables.push(() => tex.dispose());
        return tex;
      }

      // ── COLOR PALETTE ─────────────────────────────────────────────────────
      const PALETTE = [
        { r: 0,   g: 212, b: 255, hex: 0x00d4ff }, // cyan
        { r: 124, g: 58,  b: 237, hex: 0x7c3aed }, // violet
        { r: 245, g: 158, b: 11,  hex: 0xf59e0b }, // gold
        { r: 236, g: 72,  b: 153, hex: 0xec4899 }, // pink
        { r: 16,  g: 185, b: 129, hex: 0x10b981 }, // emerald
      ];

      // ── NEBULA BACKGROUND SPHERE ──────────────────────────────────────────
      const bgGeo = new THREE.SphereGeometry(280, 32, 32);
      const bgMat = new THREE.ShaderMaterial({
        side: THREE.BackSide,
        uniforms: { time: { value: 0 } },
        vertexShader: `
          varying vec3 vDir;
          void main() {
            vDir = normalize(position);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform float time;
          varying vec3 vDir;

          // Hash-based pseudo-random
          float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }

          // Smooth noise
          float noise(vec2 p) {
            vec2 i = floor(p); vec2 f = fract(p);
            vec2 u = f * f * (3.0 - 2.0 * f);
            return mix(mix(hash(i), hash(i+vec2(1,0)), u.x),
                       mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), u.x), u.y);
          }

          void main() {
            float y = vDir.y * 0.5 + 0.5;

            // Base deep space gradient
            vec3 colTop = vec3(0.03, 0.01, 0.10);
            vec3 colMid = vec3(0.02, 0.01, 0.07);
            vec3 colBot = vec3(0.01, 0.00, 0.04);
            vec3 base = mix(colBot, mix(colMid, colTop, y), smoothstep(0.0, 1.0, y));

            // Nebula wisps — two layers
            vec2 uv1 = vec2(atan(vDir.x, vDir.z), vDir.y) * vec2(1.5, 2.0);
            vec2 uv2 = uv1 * 1.7 + vec2(0.4, 0.2);
            float n1 = noise(uv1 + time * 0.012);
            float n2 = noise(uv2 - time * 0.009);
            float nebula = pow(n1 * n2, 1.8) * 0.35;

            // Purple-blue nebula tint
            vec3 nebulaCol = mix(vec3(0.05, 0.00, 0.18), vec3(0.00, 0.10, 0.30), n1);
            base += nebulaCol * nebula;

            // Subtle gold wisps near equator
            float equator = 1.0 - abs(vDir.y) * 2.0;
            float goldNeb = noise(uv1 * 2.0 + vec2(time * 0.008, 0.0)) * equator * 0.05;
            base += vec3(0.15, 0.06, 0.01) * goldNeb;

            gl_FragColor = vec4(base, 1.0);
          }
        `,
        depthWrite: false,
      });
      scene.add(new THREE.Mesh(bgGeo, bgMat));
      disposables.push(() => { bgGeo.dispose(); bgMat.dispose(); });

      // ── CRYSTAL NODE SHADERS ──────────────────────────────────────────────
      const crystalVS = `
        varying vec3 vN;
        varying vec3 vVD;
        void main() {
          vN  = normalize(normalMatrix * normal);
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vVD = normalize(-mv.xyz);
          gl_Position = projectionMatrix * mv;
        }
      `;
      const crystalFS = `
        uniform vec3  color;
        uniform float time;
        uniform float pOff;
        varying vec3 vN;
        varying vec3 vVD;
        void main() {
          float fr   = pow(1.0 - clamp(dot(vN, vVD), 0.0, 1.0), 2.8);
          float face = clamp(dot(vN, vVD), 0.0, 1.0);
          float pulse= 0.65 + 0.35 * sin(time * 1.8 + pOff);
          vec3  col  = color * (fr * 3.0 + face * 0.4) * pulse;
          float alpha= (fr * 0.9 + face * 0.15) * pulse;
          gl_FragColor = vec4(col, alpha * 0.9);
        }
      `;

      // ── BUILD CRYSTAL NODES ───────────────────────────────────────────────
      const isMobile = window.innerWidth < 768;
      const NODE_COUNT = isMobile ? 28 : 52;

      const crystals    = [];
      const nodePositions = [];

      for (let i = 0; i < NODE_COUNT; i++) {
        const theta = Math.random() * Math.PI * 2;
        const phi   = Math.acos(2 * Math.random() - 1);
        const r     = 10 + Math.random() * 22;

        const pos = new THREE.Vector3(
          r * Math.sin(phi) * Math.cos(theta),
          (Math.random() - 0.5) * 30,
          r * Math.sin(phi) * Math.sin(theta)
        );
        nodePositions.push(pos);

        const size   = 0.22 + Math.random() * 0.52;
        const geoIdx = Math.floor(Math.random() * 4);
        const geo    = [
          new THREE.IcosahedronGeometry(size, 0),
          new THREE.OctahedronGeometry(size),
          new THREE.TetrahedronGeometry(size),
          new THREE.IcosahedronGeometry(size, 1),
        ][geoIdx];

        const ci    = Math.floor(Math.random() * PALETTE.length);
        const pal   = PALETTE[ci];
        const color = new THREE.Color(pal.r / 255, pal.g / 255, pal.b / 255);

        const mat = new THREE.ShaderMaterial({
          uniforms: {
            color: { value: color.clone() },
            time:  { value: 0 },
            pOff:  { value: Math.random() * Math.PI * 2 },
          },
          vertexShader: crystalVS,
          fragmentShader: crystalFS,
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide,
        });

        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.copy(pos);
        mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
        mesh.userData = {
          rotV:   new THREE.Vector3((Math.random()-.5)*.007, (Math.random()-.5)*.011, (Math.random()-.5)*.005),
          ci,
          fOff:   Math.random() * Math.PI * 2,
          fSpd:   0.28 + Math.random() * 0.35,
          baseY:  pos.y,
        };

        // Wireframe edges
        const edGeo = new THREE.EdgesGeometry(geo);
        const edMat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false });
        mesh.add(new THREE.LineSegments(edGeo, edMat));

        // Per-crystal glow halo
        const gTex = makeGlowTex(pal.r, pal.g, pal.b);
        const gMat = new THREE.SpriteMaterial({ map: gTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.65 });
        const spr  = new THREE.Sprite(gMat);
        spr.scale.setScalar(size * 7);
        mesh.add(spr);

        scene.add(mesh);
        crystals.push(mesh);
        disposables.push(() => { geo.dispose(); mat.dispose(); edGeo.dispose(); edMat.dispose(); gMat.dispose(); });
      }

      // ── NETWORK CONNECTIONS ───────────────────────────────────────────────
      const CONN_DIST = isMobile ? 11 : 13;
      const MAX_CONNS = isMobile ? 60 : 110;
      const conns = [];

      for (let i = 0; i < nodePositions.length && conns.length < MAX_CONNS; i++) {
        for (let j = i + 1; j < nodePositions.length && conns.length < MAX_CONNS; j++) {
          if (nodePositions[i].distanceTo(nodePositions[j]) < CONN_DIST) {
            conns.push({ from: i, to: j });
          }
        }
      }

      // Gradient line geometry (4 segments per connection for smooth color blend)
      const lPos = [], lCol = [];
      conns.forEach(({ from, to }) => {
        const c1 = PALETTE[crystals[from].userData.ci];
        const c2 = PALETTE[crystals[to].userData.ci];
        const p1 = nodePositions[from], p2 = nodePositions[to];
        for (let s = 0; s < 4; s++) {
          const t0 = s / 4, t1 = (s + 1) / 4;
          lPos.push(p1.x+(p2.x-p1.x)*t0, p1.y+(p2.y-p1.y)*t0, p1.z+(p2.z-p1.z)*t0,
                    p1.x+(p2.x-p1.x)*t1, p1.y+(p2.y-p1.y)*t1, p1.z+(p2.z-p1.z)*t1);
          const r0=c1.r/255+(c2.r/255-c1.r/255)*t0, g0=c1.g/255+(c2.g/255-c1.g/255)*t0, b0=c1.b/255+(c2.b/255-c1.b/255)*t0;
          const r1=c1.r/255+(c2.r/255-c1.r/255)*t1, g1=c1.g/255+(c2.g/255-c1.g/255)*t1, b1=c1.b/255+(c2.b/255-c1.b/255)*t1;
          lCol.push(r0,g0,b0, r1,g1,b1);
        }
      });
      const lineGeo = new THREE.BufferGeometry();
      lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(lPos, 3));
      lineGeo.setAttribute('color',    new THREE.Float32BufferAttribute(lCol, 3));
      const lineMat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false });
      scene.add(new THREE.LineSegments(lineGeo, lineMat));
      disposables.push(() => { lineGeo.dispose(); lineMat.dispose(); });

      // ── FLOW PARTICLES (single draw call) ─────────────────────────────────
      const FC    = Math.min(conns.length, isMobile ? 40 : 80);
      const fPos  = new Float32Array(FC * 3);
      const fCol  = new Float32Array(FC * 3);
      for (let i = 0; i < FC; i++) {
        const pal = PALETTE[crystals[conns[i].from].userData.ci];
        fCol[i*3]=pal.r/255; fCol[i*3+1]=pal.g/255; fCol[i*3+2]=pal.b/255;
      }
      const flowGeo = new THREE.BufferGeometry();
      flowGeo.setAttribute('position', new THREE.Float32BufferAttribute(fPos, 3));
      flowGeo.setAttribute('color',    new THREE.Float32BufferAttribute(fCol, 3));
      const flowMat = new THREE.PointsMaterial({ size: 0.38, vertexColors: true, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true });
      scene.add(new THREE.Points(flowGeo, flowMat));
      const flowT   = Float32Array.from({ length: FC }, () => Math.random());
      const flowSpd = Float32Array.from({ length: FC }, () => 0.003 + Math.random() * 0.006);
      disposables.push(() => { flowGeo.dispose(); flowMat.dispose(); });

      // ── CENTRAL ENERGY CORE ───────────────────────────────────────────────
      const coreGeo = new THREE.SphereGeometry(1.8, 32, 32);
      const coreMat = new THREE.ShaderMaterial({
        uniforms: { time: { value: 0 } },
        vertexShader: `
          varying vec3 vN; varying vec3 vVD;
          void main() {
            vN  = normalize(normalMatrix * normal);
            vec4 mv = modelViewMatrix * vec4(position,1.0);
            vVD = normalize(-mv.xyz);
            gl_Position = projectionMatrix * mv;
          }
        `,
        fragmentShader: `
          uniform float time;
          varying vec3 vN; varying vec3 vVD;
          void main() {
            float fr = pow(1.0 - clamp(dot(vN,vVD),0.0,1.0), 1.8);
            float p  = 0.5 + 0.5 * sin(time * 2.2);
            vec3 ca  = vec3(0.0, 0.55, 1.0);
            vec3 cb  = vec3(0.45, 0.0, 1.0);
            vec3 col = mix(ca, cb, p) * (fr + 0.25) * 2.5;
            gl_FragColor = vec4(col, (fr * 0.85 + 0.1) * 0.9);
          }
        `,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const coreMesh = new THREE.Mesh(coreGeo, coreMat);
      scene.add(coreMesh);
      disposables.push(() => { coreGeo.dispose(); coreMat.dispose(); });

      // Core halo sprite
      const cHaloTex = makeGlowTex(80, 140, 255, 256);
      const cHaloMat = new THREE.SpriteMaterial({ map: cHaloTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.7 });
      const cHalo    = new THREE.Sprite(cHaloMat);
      cHalo.scale.setScalar(18);
      scene.add(cHalo);
      disposables.push(() => cHaloMat.dispose());

      // ── EXPANDING ENERGY RINGS ────────────────────────────────────────────
      const RING_COLS = [0x00d4ff, 0x7c3aed, 0xf59e0b];
      const rings = RING_COLS.map((hex, i) => {
        const geo = new THREE.TorusGeometry(1, 0.035, 8, 80);
        const mat = new THREE.MeshBasicMaterial({ color: hex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.rotation.x = (Math.PI / 2) + (i * Math.PI / 3);
        mesh.rotation.z = i * 1.2;
        scene.add(mesh);
        disposables.push(() => { geo.dispose(); mat.dispose(); });
        return { mesh, mat, t: i / 3 };
      });

      // ── STELLAR DUST FIELD ────────────────────────────────────────────────
      const DUST = isMobile ? 2500 : 5500;
      const dP   = new Float32Array(DUST * 3);
      const dC   = new Float32Array(DUST * 3);
      for (let i = 0; i < DUST; i++) {
        const t = Math.random()*Math.PI*2, p = Math.acos(2*Math.random()-1), r = 18 + Math.random() * 120;
        dP[i*3]=r*Math.sin(p)*Math.cos(t); dP[i*3+1]=r*Math.sin(p)*Math.sin(t); dP[i*3+2]=r*Math.cos(p);
        const ci = Math.floor(Math.random() * PALETTE.length);
        const pal = PALETTE[ci]; const dim = 0.1 + Math.random() * 0.2;
        dC[i*3]=pal.r/255*dim; dC[i*3+1]=pal.g/255*dim; dC[i*3+2]=pal.b/255*dim;
      }
      const dustGeo = new THREE.BufferGeometry();
      dustGeo.setAttribute('position', new THREE.Float32BufferAttribute(dP, 3));
      dustGeo.setAttribute('color',    new THREE.Float32BufferAttribute(dC, 3));
      const dustMat  = new THREE.PointsMaterial({ size: 0.055, vertexColors: true, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true });
      const dustMesh = new THREE.Points(dustGeo, dustMat);
      scene.add(dustMesh);
      disposables.push(() => { dustGeo.dispose(); dustMat.dispose(); });

      // ── SHOOTING STARS ────────────────────────────────────────────────────
      const shooters = [];
      let nextStar = 3.5;

      function spawnStar() {
        const dir  = new THREE.Vector3(Math.random()-.5, Math.random()-.5, Math.random()-.5).normalize();
        const perp = new THREE.Vector3(Math.random()-.5, Math.random()-.5, Math.random()-.5).cross(dir).normalize();
        const start= dir.clone().multiplyScalar(60 + Math.random() * 40);
        const vel  = dir.clone().negate().multiplyScalar(0.28 + Math.random() * 0.35);
        const trail = 8;
        const pts   = new Float32Array(trail * 3);
        for (let i = 0; i < trail; i++) {
          pts[i*3]=start.x; pts[i*3+1]=start.y; pts[i*3+2]=start.z;
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
        const mat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
        const line = new THREE.Line(geo, mat);
        scene.add(line);
        shooters.push({ line, geo, mat, pos: start.clone(), vel, life: 0, max: 50 + Math.random() * 40 });
      }

      // ── DYNAMIC LIGHTS ────────────────────────────────────────────────────
      scene.add(new THREE.AmbientLight(0x080420, 4));
      const movLights = [
        { light: new THREE.PointLight(0x00d4ff, 6, 70), r: 20, sp: 0.22, ysp: 0.14, ph: 0.0 },
        { light: new THREE.PointLight(0x7c3aed, 6, 65), r: 26, sp: 0.16, ysp: 0.19, ph: 2.1 },
        { light: new THREE.PointLight(0xf59e0b, 5, 50), r: 16, sp: 0.31, ysp: 0.11, ph: 4.2 },
      ];
      movLights.forEach(({ light }) => scene.add(light));

      // ── MOUSE & RESIZE ────────────────────────────────────────────────────
      const mouse = { x: 0, y: 0 };
      const onMouse = (e) => {
        mouse.x = (e.clientX / window.innerWidth  - 0.5) * 2;
        mouse.y = -(e.clientY / window.innerHeight - 0.5) * 2;
      };
      window.addEventListener('mousemove', onMouse);
      disposables.push(() => window.removeEventListener('mousemove', onMouse));

      const onResize = () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
      };
      window.addEventListener('resize', onResize);
      disposables.push(() => window.removeEventListener('resize', onResize));

      // ── CAMERA STATE ──────────────────────────────────────────────────────
      const camPos   = new THREE.Vector3(0, 0, 42);
      let   orbit    = 0;

      // ── ANIMATION LOOP ────────────────────────────────────────────────────
      function animate() {
        animId = requestAnimationFrame(animate);
        const t  = clock.getElapsedTime();

        // Background nebula
        bgMat.uniforms.time.value = t;

        // Camera — slow orbit + mouse parallax
        orbit += 0.00038;
        const R   = 42;
        const tgX = Math.sin(orbit) * R + mouse.x * 5;
        const tgY = Math.sin(orbit * 0.38) * 9 + mouse.y * 5;
        const tgZ = Math.cos(orbit) * R;
        camPos.lerp(new THREE.Vector3(tgX, tgY, tgZ), 0.014);
        camera.position.copy(camPos);
        camera.lookAt(0, 0, 0);

        // Crystals
        crystals.forEach(c => {
          c.rotation.x += c.userData.rotV.x;
          c.rotation.y += c.userData.rotV.y;
          c.rotation.z += c.userData.rotV.z;
          c.position.y  = c.userData.baseY + Math.sin(t * c.userData.fSpd + c.userData.fOff) * 0.45;
          c.material.uniforms.time.value = t;
        });

        // Flow particles
        const fp = flowGeo.attributes.position;
        for (let i = 0; i < FC; i++) {
          flowT[i] = (flowT[i] + flowSpd[i]) % 1;
          const { from, to } = conns[i];
          const p1 = nodePositions[from], p2 = nodePositions[to];
          fp.setXYZ(i, p1.x+(p2.x-p1.x)*flowT[i], p1.y+(p2.y-p1.y)*flowT[i], p1.z+(p2.z-p1.z)*flowT[i]);
        }
        fp.needsUpdate = true;

        // Energy core
        coreMat.uniforms.time.value = t;
        const cp  = 0.85 + 0.15 * Math.sin(t * 2.2);
        coreMesh.scale.setScalar(cp);
        cHalo.scale.setScalar(16 + 6 * Math.sin(t * 1.6));

        // Expanding rings
        rings.forEach(ring => {
          ring.t = (ring.t + 0.0035) % 1;
          ring.mesh.scale.setScalar(ring.t * 22);
          ring.mat.opacity = Math.max(0, 0.55 * (1 - ring.t));
        });

        // Dynamic lights orbit
        movLights.forEach(({ light, r, sp, ysp, ph }) => {
          light.position.set(Math.cos(t*sp+ph)*r, Math.sin(t*ysp+ph)*9, Math.sin(t*sp+ph)*r);
        });

        // Dust drift
        dustMesh.rotation.y = t * 0.004;
        dustMesh.rotation.x = t * 0.0025;

        // Shooting stars
        if (t > nextStar) { spawnStar(); nextStar = t + 5 + Math.random() * 12; }
        for (let i = shooters.length - 1; i >= 0; i--) {
          const s = shooters[i];
          s.life++;
          s.pos.add(s.vel);
          const pos = s.geo.attributes.position;
          const trail = pos.count;
          for (let j = 0; j < trail; j++) {
            pos.setXYZ(j, s.pos.x - s.vel.x*j*2.5, s.pos.y - s.vel.y*j*2.5, s.pos.z - s.vel.z*j*2.5);
          }
          pos.needsUpdate = true;
          s.mat.opacity   = 0.85 * (1 - s.life / s.max);
          if (s.life >= s.max) {
            scene.remove(s.line);
            s.geo.dispose(); s.mat.dispose();
            shooters.splice(i, 1);
          }
        }

        renderer.render(scene, camera);
      }

      animate();
    }

    init().catch(console.error);

    return () => {
      mounted = false;
      cancelAnimationFrame(animId);
      disposables.forEach(fn => fn());
    };
  }, []);

  return <div ref={mountRef} style={{ position: 'fixed', inset: 0, zIndex: -1 }} />;
}
