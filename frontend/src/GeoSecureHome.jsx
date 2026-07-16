import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import * as THREE from "three";

/* ----------------------------------------------------------------------
   GeoSecure — geospatial threat intelligence landing page
   Signature element: a wireframe/point-cloud earth with monitored asset
   nodes, security arcs, and a satellite in orbit, set against a deep
   space starfield. Built with three.js (r128) + Tailwind CSS.
---------------------------------------------------------------------- */

const COLORS = {
  cyan: 0x4ff0d7,
  amber: 0xffb454,
  land: "#0d3d3a",
};

function latLonToVector3(lat, lon, radius) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );
}

function createEarthTexture() {
  const width = 1024;
  const height = 512;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });

  const ocean = ctx.createLinearGradient(0, 0, 0, height);
  ocean.addColorStop(0, "#04141c");
  ocean.addColorStop(0.5, "#071f2b");
  ocean.addColorStop(1, "#04141c");
  ctx.fillStyle = ocean;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = COLORS.land;
  const continents = [
    { cx: 0.18, cy: 0.32, r: 0.09, n: 16 },
    { cx: 0.24, cy: 0.62, r: 0.06, n: 10 },
    { cx: 0.48, cy: 0.26, r: 0.07, n: 12 },
    { cx: 0.52, cy: 0.55, r: 0.09, n: 18 },
    { cx: 0.69, cy: 0.3, r: 0.11, n: 20 },
    { cx: 0.78, cy: 0.68, r: 0.06, n: 8 },
  ];
  continents.forEach((c) => {
    for (let i = 0; i < c.n; i++) {
      const ang = Math.random() * Math.PI * 2;
      const dist = Math.random() * c.r * width;
      const x = c.cx * width + Math.cos(ang) * dist;
      const y = c.cy * height + Math.sin(ang) * dist * 0.6;
      const rad = (0.3 + Math.random() * 0.7) * c.r * width * 0.5;
      ctx.beginPath();
      ctx.arc(x, y, rad, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  ctx.strokeStyle = "rgba(79,240,215,0.06)";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 12; i++) {
    const x = (i / 12) * width;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let j = 0; j <= 6; j++) {
    const y = (j / 6) * height;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  return { canvas, ctx };
}

function sampleLandPoint(ctx, width, height) {
  for (let attempt = 0; attempt < 20; attempt++) {
    const x = Math.floor(Math.random() * width);
    const y = Math.floor(Math.random() * height);
    const [r, g] = ctx.getImageData(x, y, 1, 1).data;
    if (g > 50 && g - r > 30) {
      return {
        lat: 90 - (y / height) * 180,
        lon: (x / width) * 360 - 180,
      };
    }
  }
  return {
    lat: 90 - Math.random() * 180,
    lon: Math.random() * 360 - 180,
  };
}

function glowSpriteTexture() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const grad = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
  grad.addColorStop(0, 'rgba(79,240,215,0.35)');
  grad.addColorStop(0.4, 'rgba(79,240,215,0.12)');
  grad.addColorStop(1, 'rgba(79,240,215,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0,0,size,size);
  return new THREE.CanvasTexture(canvas);
}

function GlobeCanvas({ onLocationSelect }) {
  const mountRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const reduceMotion =
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      45,
      mount.clientWidth / mount.clientHeight,
      0.1,
      1000
    );
    camera.position.set(0, 0, 6.4);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    mount.appendChild(renderer.domElement);
    // allow interactions on the canvas even if parent has pointer-events set
    renderer.domElement.style.pointerEvents = 'auto';
    renderer.domElement.style.cursor = 'grab';

    // Interaction state and helpers
    const raycaster = new THREE.Raycaster();
    const pointerVec = new THREE.Vector2();
    let isDragging = false;
    let hasMoved = false;
    let lastX = 0;
    let lastY = 0;
    let earthMeshRef = null; // will be set after textures load

    // lighting for phong materials
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.55);
    scene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0xfff6e0, 0.9);
    dirLight.position.set(5, 3, 5);
    scene.add(dirLight);

    // ---- Globe group ----
    const globeGroup = new THREE.Group();
    scene.add(globeGroup);

    // Load realistic Earth textures and build globe after textures are ready.
    const manager = new THREE.LoadingManager();
    const texLoader = new THREE.TextureLoader(manager);
    const urls = {
      day: 'https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/planets/earth_atmos_2048.jpg',
      normal: 'https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/planets/earth_normal_2048.jpg',
      spec: 'https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/planets/earth_specular_2048.jpg',
      clouds: 'https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/planets/earth_clouds_1024.png',
    };

    let dayMap, normalMap, specMap, cloudMap;
    texLoader.load(urls.day, (t) => (dayMap = t));
    texLoader.load(urls.normal, (t) => (normalMap = t));
    texLoader.load(urls.spec, (t) => (specMap = t));
    texLoader.load(urls.clouds, (t) => (cloudMap = t));

    manager.onLoad = () => {
      // create earth mesh with PBR-ish material
      const earthGeo = new THREE.SphereGeometry(2, 64, 64);
      const earthMat = new THREE.MeshPhongMaterial({
        map: dayMap,
        normalMap: normalMap,
        specularMap: specMap,
        shininess: 10,
      });
      const earthMesh = new THREE.Mesh(earthGeo, earthMat);
      globeGroup.add(earthMesh);
      earthMeshRef = earthMesh;

      // subtle wireframe overlay
      const wireGeo = new THREE.SphereGeometry(2.015, 32, 32);
      const wireMat = new THREE.MeshBasicMaterial({
        color: COLORS.cyan,
        wireframe: true,
        transparent: true,
        opacity: 0.08,
      });
      const wireMesh = new THREE.Mesh(wireGeo, wireMat);
      globeGroup.add(wireMesh);

      // cloud layer
      if (cloudMap) {
        const cloudGeo = new THREE.SphereGeometry(2.02, 64, 64);
        const cloudMat = new THREE.MeshPhongMaterial({
          map: cloudMap,
          transparent: true,
          opacity: 0.55,
          depthWrite: false,
        });
        const cloudMesh = new THREE.Mesh(cloudGeo, cloudMat);
        globeGroup.add(cloudMesh);
      }

      // prepare offscreen canvas for land sampling
      const img = dayMap.image;
      const offW = img.width || 1024;
      const offH = img.height || 512;
      const offCanvas = document.createElement('canvas');
      offCanvas.width = offW;
      offCanvas.height = offH;
      const offCtx = offCanvas.getContext('2d', { willReadFrequently: true });
      offCtx.drawImage(img, 0, 0, offW, offH);

      // ---- Monitored asset nodes (sample land pixels from day map) ----
      const nodeCount = 90;
      const nodePositions = new Float32Array(nodeCount * 3);
      const nodeLatLon = [];
      for (let i = 0; i < nodeCount; i++) {
        const { lat, lon } = sampleLandPoint(offCtx, offW, offH);
        const v = latLonToVector3(lat, lon, 2.03);
        nodePositions[i * 3] = v.x;
        nodePositions[i * 3 + 1] = v.y;
        nodePositions[i * 3 + 2] = v.z;
        nodeLatLon.push({ lat, lon, v });
      }
      const nodeGeo = new THREE.BufferGeometry();
      nodeGeo.setAttribute('position', new THREE.BufferAttribute(nodePositions, 3));
      const nodeMat = new THREE.PointsMaterial({
        color: COLORS.amber,
        size: 0.032,
        transparent: true,
        opacity: 0.95,
        sizeAttenuation: true,
      });
      const nodePoints = new THREE.Points(nodeGeo, nodeMat);
      globeGroup.add(nodePoints);

      // ---- Security arcs between nodes ----
      const arcsGroup = new THREE.Group();
      const arcMat = new THREE.LineBasicMaterial({
        color: COLORS.cyan,
        transparent: true,
        opacity: 0.28,
        blending: THREE.AdditiveBlending,
      });
      for (let i = 0; i < 9; i++) {
        const a = nodeLatLon[Math.floor(Math.random() * nodeLatLon.length)];
        const b = nodeLatLon[Math.floor(Math.random() * nodeLatLon.length)];
        if (!a || !b || a === b) continue;
        const mid = a.v.clone().add(b.v).multiplyScalar(0.5);
        const liftFactor = 1 + a.v.distanceTo(b.v) * 0.18;
        mid.normalize().multiplyScalar(2.03 * liftFactor);
        const curve = new THREE.QuadraticBezierCurve3(a.v, mid, b.v);
        const pts = curve.getPoints(32);
        const geo = new THREE.BufferGeometry().setFromPoints(pts);
        arcsGroup.add(new THREE.Line(geo, arcMat));
      }
      globeGroup.add(arcsGroup);
    };

    // pointer handlers for click-to-pick and drag-to-rotate
    function onDragPointerDown(e) {
      isDragging = true;
      hasMoved = false;
      lastX = e.clientX;
      lastY = e.clientY;
      renderer.domElement.style.cursor = 'grabbing';
    }

    function onDragPointerMove(e) {
      if (!isDragging) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) hasMoved = true;
      globeGroup.rotation.y += dx * 0.005;
      globeGroup.rotation.x += dy * 0.005;
      globeGroup.rotation.x = THREE.MathUtils.clamp(globeGroup.rotation.x, -1.2, 1.2);
      lastX = e.clientX;
      lastY = e.clientY;
    }

    function vectorToLatLon(point) {
      const p = point.clone().normalize();
      const lat = Math.asin(THREE.MathUtils.clamp(p.y, -1, 1)) * (180 / Math.PI);
      const lon = Math.atan2(p.z, p.x) * (180 / Math.PI);
      return { lat, lon };
    }

    function pick(clientX, clientY) {
      if (!earthMeshRef) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointerVec.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      pointerVec.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointerVec, camera);
      const hits = raycaster.intersectObject(earthMeshRef, false);
      if (hits.length > 0) {
        const p = hits[0].point.clone().normalize();
        const { lat, lon } = vectorToLatLon(p);
        onLocationSelect?.({
          lat,
          lon,
          googleMapsUrl: `https://www.google.com/maps?q=${lat.toFixed(4)},${lon.toFixed(4)}`,
        });
      }
    }

    function onDragPointerUp(e) {
      if (isDragging && !hasMoved) {
        pick(e.clientX, e.clientY);
      }
      isDragging = false;
      renderer.domElement.style.cursor = 'grab';
    }

    function onWheel(e) {
      // rotate globe with wheel
      const delta = e.deltaY;
      globeGroup.rotation.y += delta * 0.0022;
      // prevent page scroll when over canvas
      e.preventDefault();
    }

    renderer.domElement.addEventListener('pointerdown', onDragPointerDown);
    window.addEventListener('pointermove', onDragPointerMove);
    window.addEventListener('pointerup', onDragPointerUp);
    renderer.domElement.addEventListener('wheel', onWheel, { passive: false });

    // ---- Atmosphere glow ----
    const glowTexture = glowSpriteTexture();
    const glowMat = new THREE.SpriteMaterial({
      map: glowTexture,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
    });
    const glowSprite = new THREE.Sprite(glowMat);
    glowSprite.scale.set(6.2, 6.2, 1);
    scene.add(glowSprite);

    // ---- Orbit + satellite ----
    const orbitGroup = new THREE.Group();
    orbitGroup.rotation.x = 0.5;
    orbitGroup.rotation.z = 0.18;
    scene.add(orbitGroup);

    const orbitRadius = 2.9;
    const ringGeo = new THREE.TorusGeometry(orbitRadius, 0.003, 8, 128);
    const ringMat = new THREE.MeshBasicMaterial({
      color: COLORS.cyan,
      transparent: true,
      opacity: 0.22,
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.rotation.x = Math.PI / 2;
    orbitGroup.add(ringMesh);

    const satGeo = new THREE.SphereGeometry(0.045, 16, 16);
    const satMat = new THREE.MeshBasicMaterial({ color: COLORS.amber });
    const satellite = new THREE.Mesh(satGeo, satMat);
    orbitGroup.add(satellite);

    const satGlow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTexture,
        color: COLORS.amber,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
      })
    );
    satGlow.scale.set(0.5, 0.5, 1);
    satellite.add(satGlow);

    // ---- Starfield ----
    function makeStars(count, spread, size, color, opacity) {
      const positions = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        const r = spread * (0.6 + Math.random() * 0.4);
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
        positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
        positions[i * 3 + 2] = r * Math.cos(phi);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      const mat = new THREE.PointsMaterial({
        color,
        size,
        transparent: true,
        opacity,
        sizeAttenuation: true,
      });
      return new THREE.Points(geo, mat);
    }
    const starsFar = makeStars(1400, 60, 0.05, 0xffffff, 0.55);
    const starsNear = makeStars(300, 35, 0.09, 0x9fe8de, 0.7);
    scene.add(starsFar);
    scene.add(starsNear);

    // ---- Responsive horizontal offset (globe sits right of copy on desktop) ----
    function applyLayoutOffset() {
      const isDesktop = mount.clientWidth >= 1024;
      // shift the globe further left on desktop (negative x moves left)
      const targetX = isDesktop ? 3 : 0;
      globeGroup.position.x = targetX;
      orbitGroup.position.x = targetX;
      glowSprite.position.x = targetX;
    }
    applyLayoutOffset();

    // ---- Pointer parallax ----
    const pointer = { x: 0, y: 0 };
    const target = { x: 0, y: 0 };
    function onPointerMove(e) {
      pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
    }
    window.addEventListener("pointermove", onPointerMove);

    // ---- Resize ----
    function handleResize() {
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      applyLayoutOffset();
    }
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(mount);
    window.addEventListener("resize", handleResize);

    // ---- Animation loop ----
    const clock = new THREE.Clock();
    let satAngle = 0;
    let frameId;
    function animate() {
      frameId = requestAnimationFrame(animate);
      const delta = clock.getDelta();

      if (!reduceMotion) {
        globeGroup.rotation.y += delta * 0.12;
        starsFar.rotation.y += delta * 0.004;
        starsNear.rotation.y -= delta * 0.006;
        satAngle += delta * 0.35;
      }

      satellite.position.set(
        Math.cos(satAngle) * orbitRadius,
        0,
        Math.sin(satAngle) * orbitRadius
      );

      target.x += (pointer.x * 0.3 - target.x) * 0.03;
      target.y += (pointer.y * 0.2 - target.y) * 0.03;
      camera.position.x += (target.x - camera.position.x) * 0.05;
      camera.position.y += (-target.y - camera.position.y) * 0.05;
      camera.lookAt(globeGroup.position.x * 0.4, 0, 0);

      renderer.render(scene, camera);
    }
    animate();

    return () => {
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("pointermove", onPointerMove);
      mount.removeChild(renderer.domElement);

      scene.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (obj.material.map) obj.material.map.dispose();
          obj.material.dispose();
        }
      });
      renderer.dispose();
    };
  }, []);

  return (
    <div
      ref={mountRef}
      className="pointer-events-auto absolute inset-0 z-0"
      aria-hidden="true"
    />
  );
}

function CrosshairMark() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      className="text-[#4ff0d7]"
    >
      <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.2" />
      <path
        d="M10 1V5M10 15V19M1 10H5M15 10H19"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <circle cx="10" cy="10" r="1.4" fill="currentColor" />
    </svg>
  );
}

export default function GeoSecureHome({ isAuthenticated, onLogout }) {
  const [selectedLocation, setSelectedLocation] = useState(null);

  const tickerItems = [
    "24.4539\u00B0 N, 54.3773\u00B0 E \u00B7 NODE SECURE",
    "51.5072\u00B0 N, 0.1276\u00B0 W \u00B7 SIGNAL NOMINAL",
    "35.6762\u00B0 N, 139.6503\u00B0 E \u00B7 ASSET VERIFIED",
    "-33.8688\u00B0, 151.2093\u00B0 \u00B7 PERIMETER CLEAR",
    "40.7128\u00B0 N, 74.0060\u00B0 W \u00B7 NODE SECURE",
    "1.3521\u00B0 N, 103.8198\u00B0 E \u00B7 SIGNAL NOMINAL",
  ];

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#05070a] font-body text-[#e8f1f2] selection:bg-[#4ff0d7]/30">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&family=Inter:wght@400;500;600&display=swap');
        .font-display { font-family: 'Space Grotesk', ui-sans-serif, system-ui, sans-serif; }
        .font-mono { font-family: 'JetBrains Mono', ui-monospace, monospace; }
        .font-body { font-family: 'Inter', ui-sans-serif, system-ui, sans-serif; }
        @keyframes ticker-scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .ticker-track {
          animation: ticker-scroll 32s linear infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .ticker-track { animation: none; }
        }
      `}</style>

      {/* Vignette / color grade */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_-10%,rgba(79,240,215,0.08),transparent_60%),radial-gradient(ellipse_at_85%_85%,rgba(255,180,84,0.05),transparent_50%)]" />

      {/* 3D globe canvas */}
      <GlobeCanvas onLocationSelect={setSelectedLocation} />

      {selectedLocation && (
        <div className="pointer-events-auto fixed bottom-4 left-4 z-[1000] max-w-sm rounded-xl border border-[#4ff0d7]/30 bg-[#04141c]/85 p-4 text-left shadow-2xl backdrop-blur">
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#4ff0d7]">
            Selected point
          </div>
          <div className="mt-2 font-display text-lg text-[#e8f1f2]">
            {selectedLocation.lat.toFixed(4)}° {selectedLocation.lat >= 0 ? 'N' : 'S'}, {selectedLocation.lon.toFixed(4)}° {selectedLocation.lon >= 0 ? 'E' : 'W'}
          </div>
          <a
            href={selectedLocation.googleMapsUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.25em] text-[#4ff0d7] transition-colors hover:text-[#7bf5e1]"
          >
            Open in Google Maps
            <span aria-hidden="true">↗</span>
          </a>
        </div>
      )}

      {/* Foreground content */}
      <div className="relative z-10 flex min-h-screen flex-col">
        {/* Nav */}
        <nav className="flex items-center justify-between px-6 py-6 lg:px-16">
          <div className="flex items-center gap-2">
            <CrosshairMark />
            <span className="font-display text-lg font-semibold tracking-wide">
              GEOSECURE
            </span>
          </div>
          <div className="hidden items-center gap-8 font-mono text-xs uppercase tracking-widest text-[#8fa3ad] md:flex">
            <a href="#" className="transition-colors hover:text-[#e8f1f2]">
              Platform
            </a>
            <a href="#" className="transition-colors hover:text-[#e8f1f2]">
              Intelligence
            </a>
            <a href="#" className="transition-colors hover:text-[#e8f1f2]">
              Coverage
            </a>
            <a href="#" className="transition-colors hover:text-[#e8f1f2]">
              Docs
            </a>
          </div>
          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <button
                onClick={onLogout}
                className="rounded-sm bg-red-500/20 border border-red-500/40 px-4 py-2 font-mono text-xs uppercase tracking-widest text-red-400 transition-colors hover:bg-red-500/30 hover:border-red-500/60"
              >
                Logout
              </button>
            ) : (
              <>
                <Link to="/login" className="font-mono text-xs uppercase tracking-widest text-[#8fa3ad] transition-colors hover:text-[#e8f1f2]">
                  Sign in
                </Link>
                <button className="rounded-sm border border-[#4ff0d7]/40 bg-[#4ff0d7]/10 px-4 py-2 font-mono text-xs uppercase tracking-widest text-[#4ff0d7] transition-colors hover:bg-[#4ff0d7]/20">
                  Get access
                </button>
              </>
            )}
          </div>
        </nav>

        {/* Hero */}
        <main className="flex flex-1 items-center px-6 lg:px-16">
          <div className="max-w-xl py-12 lg:py-0">
            <div className="mb-6 flex items-center gap-2 font-mono text-xs uppercase tracking-[0.3em] text-[#4ff0d7]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#4ff0d7] animate-pulse" />
              Geospatial threat intelligence
            </div>
            <h1 className="font-display text-5xl font-medium leading-[1.05] tracking-tight sm:text-6xl">
              See every asset.
              <br />
              <span className="text-[#4ff0d7]">Everywhere,</span> in real
              time.
            </h1>
            <p className="mt-6 max-w-md text-base leading-relaxed text-[#8fa3ad]">
              GeoSecure fuses satellite telemetry, network signal, and
              on-ground sensors into a single live map — so your team sees
              risk before it reaches the perimeter.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-5">
              <button className="rounded-sm bg-[#4ff0d7] px-6 py-3 font-mono text-xs font-semibold uppercase tracking-widest text-[#04141c] transition-colors hover:bg-[#7bf5e1]">
                Request access
              </button>
              <button className="group flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-[#e8f1f2] transition-colors hover:text-[#4ff0d7]" onClick={() => window.location.href = '/dashboard'}>
                View Dashboard
                <span className="transition-transform group-hover:translate-x-1">
                  &rarr;
                </span>
              </button>
            </div>

            <div className="mt-14 grid max-w-md grid-cols-3 gap-6 border-t border-white/10 pt-6">
              <div>
                <div className="font-display text-xl font-semibold">
                  14,208
                </div>
                <div className="mt-1 font-mono text-[10px] uppercase tracking-widest text-[#5c7078]">
                  Assets tracked
                </div>
              </div>
              <div>
                <div className="font-display text-xl font-semibold">142</div>
                <div className="mt-1 font-mono text-[10px] uppercase tracking-widest text-[#5c7078]">
                  Countries covered
                </div>
              </div>
              <div>
                <div className="font-display text-xl font-semibold">
                  99.98%
                </div>
                <div className="mt-1 font-mono text-[10px] uppercase tracking-widest text-[#5c7078]">
                  Uptime
                </div>
              </div>
            </div>
          </div>
        </main>

        {/* Live feed ticker */}
        <div className="flex items-center gap-6 overflow-hidden border-t border-white/10 bg-black/30 px-6 py-3 backdrop-blur-sm lg:px-16">
          <div className="flex shrink-0 items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-[#4ff0d7]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#4ff0d7] animate-pulse" />
            Live feed
          </div>
          <div className="relative flex-1 overflow-hidden">
            <div className="ticker-track flex w-max gap-10 whitespace-nowrap font-mono text-[11px] uppercase tracking-widest text-[#5c7078]">
              {[...tickerItems, ...tickerItems].map((item, i) => (
                <span key={i}>{item}</span>
              ))}
            </div>
          </div>
          <div className="hidden shrink-0 font-mono text-[11px] uppercase tracking-widest text-[#5c7078] sm:block">
            &copy; 2026 GeoSecure
          </div>
        </div>
      </div>
    </div>
  );
}
