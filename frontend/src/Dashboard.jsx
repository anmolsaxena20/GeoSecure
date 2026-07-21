import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import * as THREE from "three";
import { API_ENDPOINTS } from "./config/api.js";

const commodityData = [
  {
    name: "Crude Oil",
    region: "Gulf of Hormuz",
    risk: "High",
    signal: "Conflict escalation and shipping disruption",
    trend: "+12%",
  },
  {
    name: "Coffee",
    region: "Brazil",
    risk: "Medium",
    signal: "Weather volatility affecting supply",
    trend: "+4%",
  },
  {
    name: "Lithium",
    region: "Chile",
    risk: "Low",
    signal: "Stable production and inventory buffers",
    trend: "-2%",
  },
  {
    name: "Wheat",
    region: "Black Sea",
    risk: "High",
    signal: "Port restrictions and export uncertainty",
    trend: "+9%",
  },
  {
    name: "Semiconductors",
    region: "Taiwan",
    risk: "Medium",
    signal: "Capacity constraints from regional weather",
    trend: "+3%",
  },
];

function RiskPill({ level }) {
  const normalizedLevel = String(level || "").trim().toLowerCase();
  const displayLevel = normalizedLevel ? normalizedLevel.charAt(0).toUpperCase() + normalizedLevel.slice(1) : "Unknown";
  const styles = {
    High: "border-red-400/30 bg-red-500/10 text-red-300",
    Medium: "border-[#ffb454]/30 bg-[#ffb454]/10 text-[#ffb454]",
    Low: "border-[#4ff0d7]/30 bg-[#4ff0d7]/10 text-[#4ff0d7]",
  };

  const className = styles[displayLevel] || "border-white/10 bg-white/5 text-[#c9d5da]";

  return (
    <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] ${className}`}>
      {displayLevel}
    </span>
  );
}

const PAGE_SIZE = 3;
const REFRESH_INTERVAL_MS = 30000;

function getAuthHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

function toCommodityCard(commodity) {
  const disruptionProbability = Number(commodity?.disruptionProbability) || 0;
  const riskLevel = commodity?.riskLevel || "Low";
  const updatedAt = commodity?.updatedAt ? new Date(commodity.updatedAt) : null;

  return {
    id: commodity.id,
    name: commodity.commodity,
    region: updatedAt ? `Updated ${updatedAt.toLocaleDateString(undefined, { month: "short", day: "numeric" })}` : "Live commodity feed",
    risk: riskLevel,
    signal: `Disruption probability at ${disruptionProbability}% across the live risk feed.`,
    trend: `${disruptionProbability >= 50 ? "+" : ""}${disruptionProbability}%`,
  };
}

function latLonToVector3(lat, lon, radius) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  );
}

function createGlobeTexture() {
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

  ctx.fillStyle = "#0d3d3a";
  const continents = [
    { cx: 0.18, cy: 0.32, r: 0.09, n: 16 },
    { cx: 0.24, cy: 0.62, r: 0.06, n: 10 },
    { cx: 0.48, cy: 0.26, r: 0.07, n: 12 },
    { cx: 0.52, cy: 0.55, r: 0.09, n: 18 },
    { cx: 0.69, cy: 0.3, r: 0.11, n: 20 },
    { cx: 0.78, cy: 0.68, r: 0.06, n: 8 },
  ];

  continents.forEach((continent) => {
    for (let i = 0; i < continent.n; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const distance = Math.random() * continent.r * width;
      const x = continent.cx * width + Math.cos(angle) * distance;
      const y = continent.cy * height + Math.sin(angle) * distance * 0.6;
      const radius = (0.3 + Math.random() * 0.7) * continent.r * width * 0.5;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  return new THREE.CanvasTexture(canvas);
}

function GlobeVisual() {
  const mountRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x05070a, 0.045);

    const camera = new THREE.PerspectiveCamera(45, mount.clientWidth / mount.clientHeight, 0.1, 1000);
    camera.position.set(0, 0, 4.6);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    mount.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);
    const pointLight = new THREE.PointLight(0x4ff0d7, 2.2, 15);
    pointLight.position.set(3, 2.5, 4);
    scene.add(pointLight);

    const group = new THREE.Group();
    scene.add(group);

    const globeTexture = createGlobeTexture();
    globeTexture.colorSpace = THREE.SRGBColorSpace;

    const globeGeometry = new THREE.SphereGeometry(1.65, 64, 64);
    const globeMaterial = new THREE.MeshPhongMaterial({
      map: globeTexture,
      emissive: 0x0a2f32,
      emissiveIntensity: 0.25,
      shininess: 12,
    });
    const globe = new THREE.Mesh(globeGeometry, globeMaterial);
    group.add(globe);

    const wireframe = new THREE.Mesh(
      new THREE.SphereGeometry(1.68, 32, 32),
      new THREE.MeshBasicMaterial({
        color: 0x4ff0d7,
        wireframe: true,
        transparent: true,
        opacity: 0.16,
      }),
    );
    group.add(wireframe);

    const markerPositions = [
      { lat: 25, lon: 55, color: 0xff4d4d },
      { lat: -15, lon: -60, color: 0x4ff0d7 },
      { lat: 35, lon: 140, color: 0xff4d4d },
      { lat: -30, lon: 20, color: 0x4ff0d7 },
      { lat: 10, lon: 10, color: 0xffb454 },
      { lat: -5, lon: 120, color: 0xffb454 },
    ];

    markerPositions.forEach((marker) => {
      const position = latLonToVector3(marker.lat, marker.lon, 1.68);
      const markerMesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.06, 16, 16),
        new THREE.MeshBasicMaterial({ color: marker.color }),
      );
      markerMesh.position.copy(position);
      group.add(markerMesh);

      const halo = new THREE.Mesh(
        new THREE.SphereGeometry(0.1, 16, 16),
        new THREE.MeshBasicMaterial({
          color: marker.color,
          transparent: true,
          opacity: 0.18,
        }),
      );
      halo.position.copy(position);
      group.add(halo);
    });

    const starsGeometry = new THREE.BufferGeometry();
    const starsCount = 1600;
    const starsPositions = new Float32Array(starsCount * 3);
    for (let i = 0; i < starsCount; i += 1) {
      const radius = 8 + Math.random() * 6;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      starsPositions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      starsPositions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      starsPositions[i * 3 + 2] = radius * Math.cos(phi);
    }
    starsGeometry.setAttribute("position", new THREE.BufferAttribute(starsPositions, 3));
    const starsMaterial = new THREE.PointsMaterial({ color: 0x9fdde8, size: 0.012, transparent: true, opacity: 0.9 });
    const stars = new THREE.Points(starsGeometry, starsMaterial);
    scene.add(stars);

    let animationFrameId;
    const animate = () => {
      animationFrameId = window.requestAnimationFrame(animate);
      group.rotation.y += 0.003;
      wireframe.rotation.y -= 0.0015;
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", handleResize);
      mount.innerHTML = "";
      renderer.dispose();
      globeTexture.dispose();
    };
  }, []);

  return (
    <div ref={mountRef} className="mx-auto h-[280px] w-full max-w-[320px] rounded-full border border-[#4ff0d7]/20 bg-[radial-gradient(circle_at_30%_30%,rgba(79,240,215,0.16),transparent_40%),linear-gradient(135deg,rgba(4,20,28,0.98),rgba(6,27,36,0.88))] shadow-[0_0_80px_rgba(79,240,215,0.12)]" />
  );
}

export default function Dashboard({ onLogout }) {
  const navigate = useNavigate();
  const [pinnedCommodities, setPinnedCommodities] = useState([]);
  const [availableCommodities, setAvailableCommodities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [syncingCommodityId, setSyncingCommodityId] = useState(null);
  const [hasMoreCommodities, setHasMoreCommodities] = useState(true);
  const [error, setError] = useState("");

  const token = localStorage.getItem("accessToken");

  const pinnedIds = useMemo(
    () => new Set(pinnedCommodities.map((commodity) => commodity.id)),
    [pinnedCommodities],
  );
  const topConcern = useMemo(
    () => pinnedCommodities[0] || availableCommodities[0] || commodityData[0] || null,
    [pinnedCommodities, availableCommodities],
  );
  const statusSource = availableCommodities.length > 0 ? availableCommodities : commodityData;
  const statusCounts = useMemo(
    () => statusSource.reduce(
      (accumulator, commodity) => {
        const risk = String(commodity.risk || commodity.riskLevel || "").toLowerCase();

        if (risk === "high") accumulator.high += 1;
        if (risk === "medium") accumulator.medium += 1;
        if (risk === "low") accumulator.low += 1;

        return accumulator;
      },
      { high: 0, medium: 0, low: 0 },
    ),
    [statusSource],
  );

  const handleUnauthorized = async () => {
    await onLogout?.();
    navigate("/login", { replace: true });
  };

  const loadPinnedCommodities = async () => {
    if (!token) return [];

    const response = await fetch(API_ENDPOINTS.COMMODITIES.PINNED, {
      headers: getAuthHeaders(token),
      credentials: "include",
    });
    const payload = await response.json().catch(() => ({}));

    if (response.status === 401) {
      await handleUnauthorized();
      return [];
    }

    if (!response.ok) {
      throw new Error(payload.message || "Unable to load pinned commodities");
    }

    const nextPinnedCommodities = (payload.pinnedCommodities || []).map(toCommodityCard);
    setPinnedCommodities(nextPinnedCommodities);
    return nextPinnedCommodities;
  };

  const loadCommodityPage = async ({ offset = 0, limit = PAGE_SIZE, append = false } = {}) => {
    if (!token) return [];

    const url = new URL(API_ENDPOINTS.COMMODITIES.LIST);
    url.searchParams.set("offset", String(offset));
    url.searchParams.set("limit", String(limit));

    const response = await fetch(url.toString(), {
      headers: getAuthHeaders(token),
      credentials: "include",
    });
    const payload = await response.json().catch(() => ({}));

    if (response.status === 401) {
      await handleUnauthorized();
      return [];
    }

    if (!response.ok) {
      throw new Error(payload.message || "Unable to load commodities");
    }

    const nextCommodities = (payload.availableCommodity || []).map(toCommodityCard);
    setHasMoreCommodities(Boolean(payload.hasMore));
    setAvailableCommodities((currentCommodities) => (append ? [...currentCommodities, ...nextCommodities] : nextCommodities));
    return nextCommodities;
  };

  const refreshDashboard = async () => {
    if (!token) return;

    setError("");

    try {
      const nextLimit = Math.max(PAGE_SIZE, availableCommodities.length || PAGE_SIZE);
      await Promise.all([
        loadPinnedCommodities(),
        loadCommodityPage({ offset: 0, limit: nextLimit, append: false }),
      ]);
    } catch (fetchError) {
      setError(fetchError.message || "Unable to refresh commodity dashboard");
    } finally {
      setLoading(false);
    }
  };

  const handleFetchMore = async () => {
    if (!hasMoreCommodities || loadingMore) return;

    setLoadingMore(true);
    setError("");

    try {
      await loadCommodityPage({
        offset: availableCommodities.length,
        limit: PAGE_SIZE,
        append: true,
      });
    } catch (fetchError) {
      setError(fetchError.message || "Unable to fetch more commodities");
    } finally {
      setLoadingMore(false);
    }
  };

  const handleTogglePin = async (commodity) => {
    if (!token || syncingCommodityId) return;

    const isPinned = pinnedIds.has(commodity.id);
    setSyncingCommodityId(commodity.id);
    setError("");

    try {
      const response = await fetch(API_ENDPOINTS.COMMODITIES.PINNED, {
        method: isPinned ? "DELETE" : "POST",
        headers: getAuthHeaders(token),
        credentials: "include",
        body: JSON.stringify({ commodityId: commodity.id }),
      });
      const payload = await response.json().catch(() => ({}));

      if (response.status === 401) {
        await handleUnauthorized();
        return;
      }

      if (!response.ok) {
        throw new Error(payload.message || "Unable to update pinned commodities");
      }

      setPinnedCommodities((payload.pinnedCommodities || []).map(toCommodityCard));
    } catch (pinError) {
      setError(pinError.message || "Unable to update pinned commodities");
    } finally {
      setSyncingCommodityId(null);
    }
  };

  useEffect(() => {
    refreshDashboard();
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      if (token) {
        refreshDashboard();
      }
    }, REFRESH_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [token, availableCommodities.length]);

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#05070a] font-body text-[#e8f1f2] selection:bg-[#4ff0d7]/30">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&family=Inter:wght@400;500;600&display=swap');
        .font-display { font-family: 'Space Grotesk', ui-sans-serif, system-ui, sans-serif; }
        .font-mono { font-family: 'JetBrains Mono', ui-monospace, monospace; }
        .font-body { font-family: 'Inter', ui-sans-serif, system-ui, sans-serif; }
      `}</style>

      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_10%_-10%,rgba(79,240,215,0.13),transparent_45%),radial-gradient(ellipse_at_85%_85%,rgba(255,180,84,0.08),transparent_45%)]" />

      <div className="relative z-10 flex min-h-screen flex-col">
        <nav className="flex items-center justify-between px-6 py-6 lg:px-16">
          <Link to="/" className="flex items-center gap-2 transition-opacity hover:opacity-80">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="text-[#4ff0d7]">
              <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.2" />
              <path d="M10 1V5M10 15V19M1 10H5M15 10H19" stroke="currentColor" strokeWidth="1.2" />
              <circle cx="10" cy="10" r="1.4" fill="currentColor" />
            </svg>
            <span className="font-display text-lg font-semibold tracking-wide">GEOSECURE</span>
          </Link>

          <div className="flex items-center gap-3">
            <Link to="/" className="rounded-sm border border-white/10 bg-white/5 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.25em] text-[#e8f1f2] transition-colors hover:border-[#4ff0d7]/30 hover:text-[#4ff0d7]">
              Back home
            </Link>
            <button
              onClick={onLogout}
              className="rounded-sm border border-red-500/30 bg-red-500/10 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.25em] text-red-300 transition-colors hover:border-red-400/50 hover:bg-red-500/20"
            >
              Logout
            </button>
          </div>
        </nav>

        <main className="flex-1 px-6 pb-12 lg:px-16">
          <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.35em] text-[#4ff0d7]">Live command center</p>
              <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
                Commodity risk dashboard
              </h1>
              <p className="mt-3 max-w-2xl text-sm text-[#8fa3ad] sm:text-base">
                Continuous monitoring across transport corridors, weather signals, and market stress to spotlight the commodities that need attention first.
              </p>
            </div>

            <div className="rounded-sm border border-[#4ff0d7]/20 bg-[#07161d]/80 px-4 py-3 shadow-[0_0_30px_rgba(79,240,215,0.08)]">
              <div className="font-mono text-[11px] uppercase tracking-[0.3em] text-[#8fa3ad]">Highest concern</div>
              <div className="mt-1 font-display text-xl text-[#ffb454]">
                {loading ? "Loading live commodities" : topConcern ? `${topConcern.name} • ${topConcern.region}` : "No commodities available"}
              </div>
            </div>
          </div>

          {error ? (
            <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 font-mono text-[11px] uppercase tracking-[0.25em] text-red-200">
              {error}
            </div>
          ) : null}

          <div className="grid gap-6 xl:grid-cols-[1.5fr,0.9fr]">
            <section className="rounded-xl border border-white/10 bg-[#07131a]/80 p-4 shadow-[0_0_50px_rgba(0,0,0,0.28)] backdrop-blur md:p-6">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="font-display text-xl font-semibold">Pinned commodities</h2>
                  <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.26em] text-[#8fa3ad]">Actively tracked and auto-refreshed</p>
                </div>
                <div className="rounded-full border border-[#4ff0d7]/20 bg-[#4ff0d7]/10 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.3em] text-[#4ff0d7]">
                  {pinnedCommodities.length} tracked
                </div>
              </div>

              <div className="space-y-3">
                {pinnedCommodities.length > 0 ? pinnedCommodities.map((item, index) => (
                  <div key={item.id} className="rounded-lg border border-white/10 bg-[#050b11]/70 p-4 transition-colors hover:border-[#4ff0d7]/20">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div className="flex items-start gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 font-mono text-sm text-[#4ff0d7]">
                          {index + 1}
                        </div>
                        <div>
                          <div className="font-display text-lg">{item.name}</div>
                          <div className="mt-1 font-mono text-[11px] uppercase tracking-[0.25em] text-[#8fa3ad]">{item.region}</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <RiskPill level={item.risk} />
                        <div className="font-mono text-xs text-[#e8f1f2]">{item.trend}</div>
                      </div>
                    </div>

                    <div className="mt-3 rounded-md border border-white/10 bg-white/5 px-3 py-2 font-body text-sm text-[#b3c0c8]">
                      {item.signal}
                    </div>
                  </div>
                )) : (
                  <div className="rounded-lg border border-dashed border-white/10 bg-[#050b11]/50 p-5 text-sm text-[#8fa3ad]">
                    Pin commodities from the live feed below to start auto-tracking them here.
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-xl border border-white/10 bg-[#07131a]/80 p-4 shadow-[0_0_50px_rgba(0,0,0,0.28)] backdrop-blur md:p-6">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <h2 className="font-display text-xl font-semibold">Commodity feed</h2>
                  <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.26em] text-[#8fa3ad]">Pin anything you want to watch</p>
                </div>
                <button
                  onClick={handleFetchMore}
                  disabled={!hasMoreCommodities || loadingMore}
                  className="rounded-sm border border-[#4ff0d7]/20 bg-[#4ff0d7]/10 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.3em] text-[#4ff0d7] transition-colors hover:bg-[#4ff0d7]/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loadingMore ? "Fetching..." : hasMoreCommodities ? "Fetch more" : "No more"}
                </button>
              </div>

              {loading && availableCommodities.length === 0 ? (
                <div className="rounded-lg border border-white/10 bg-[#050b11]/60 p-5 text-sm text-[#8fa3ad]">
                  Loading live commodity feed...
                </div>
              ) : availableCommodities.length > 0 ? (
                <div className="space-y-3">
                  {availableCommodities.map((item, index) => {
                    const isPinned = pinnedIds.has(item.id);

                    return (
                      <div key={item.id} className="rounded-lg border border-white/10 bg-[#050b11]/70 p-4 transition-colors hover:border-[#4ff0d7]/20">
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                          <div className="flex items-start gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 font-mono text-sm text-[#4ff0d7]">
                              {index + 1}
                            </div>
                            <div>
                              <div className="font-display text-lg">{item.name}</div>
                              <div className="mt-1 font-mono text-[11px] uppercase tracking-[0.25em] text-[#8fa3ad]">{item.region}</div>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-3">
                            <RiskPill level={item.risk} />
                            <div className="font-mono text-xs text-[#e8f1f2]">{item.trend}</div>
                            <button
                              onClick={() => handleTogglePin(item)}
                              disabled={syncingCommodityId === item.id}
                              className={`rounded-sm border px-3 py-2 font-mono text-[11px] uppercase tracking-[0.25em] transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                                isPinned
                                  ? "border-[#ffb454]/25 bg-[#ffb454]/10 text-[#ffb454] hover:bg-[#ffb454]/20"
                                  : "border-[#4ff0d7]/20 bg-[#4ff0d7]/10 text-[#4ff0d7] hover:bg-[#4ff0d7]/20"
                              }`}
                            >
                              {syncingCommodityId === item.id ? "Saving..." : isPinned ? "Unpin" : "Pin"}
                            </button>
                          </div>
                        </div>

                        <div className="mt-3 rounded-md border border-white/10 bg-white/5 px-3 py-2 font-body text-sm text-[#b3c0c8]">
                          {item.signal}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-lg border border-white/10 bg-[#050b11]/60 p-5 text-sm text-[#8fa3ad]">
                  No commodities were returned by the feed.
                </div>
              )}
            </section>

            <section className="space-y-6">
              <div className="rounded-xl border border-white/10 bg-[#07131a]/80 p-5 shadow-[0_0_50px_rgba(0,0,0,0.28)] backdrop-blur">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h2 className="font-display text-xl font-semibold">Global exposure</h2>
                    <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.26em] text-[#8fa3ad]">Threat distribution</p>
                  </div>
                  <div className="rounded-full border border-[#ffb454]/20 bg-[#ffb454]/10 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.3em] text-[#ffb454]">
                    Watchlist
                  </div>
                </div>

                <GlobeVisual />
              </div>

              <div className="rounded-xl border border-white/10 bg-[#07131a]/80 p-5 shadow-[0_0_50px_rgba(0,0,0,0.28)] backdrop-blur">
                <div className="font-mono text-[11px] uppercase tracking-[0.3em] text-[#8fa3ad]">Status summary</div>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-lg border border-red-400/20 bg-red-500/10 p-3">
                    <div className="font-display text-lg text-red-300">{statusCounts.high}</div>
                    <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.25em] text-red-200/70">High risk</div>
                  </div>
                  <div className="rounded-lg border border-[#ffb454]/20 bg-[#ffb454]/10 p-3">
                    <div className="font-display text-lg text-[#ffb454]">{statusCounts.medium}</div>
                    <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.25em] text-[#ffb454]/70">Watch</div>
                  </div>
                  <div className="rounded-lg border border-[#4ff0d7]/20 bg-[#4ff0d7]/10 p-3">
                    <div className="font-display text-lg text-[#4ff0d7]">{statusCounts.low}</div>
                    <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.25em] text-[#4ff0d7]/70">Stable</div>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
