import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { API_ENDPOINTS } from "./config/api.js";

function CrosshairMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="text-[#4ff0d7]">
      <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.2" />
      <path d="M10 1V5M10 15V19M1 10H5M15 10H19" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="10" cy="10" r="1.4" fill="currentColor" />
    </svg>
  );
}

function Pill({ children, tone = "teal" }) {
  const toneStyles = {
    teal: "border-[#4ff0d7]/20 bg-[#4ff0d7]/10 text-[#4ff0d7]",
    amber: "border-[#ffb454]/20 bg-[#ffb454]/10 text-[#ffb454]",
    slate: "border-white/10 bg-white/5 text-[#c9d5da]",
    red: "border-red-400/20 bg-red-500/10 text-red-300",
  };

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.25em] ${toneStyles[tone]}`}>
      {children}
    </span>
  );
}

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 1,
});

function parseMaybeJson(value, fallback) {
  if (value == null) return fallback;
  if (typeof value === "object") return value;

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function formatCurrency(value, currency = "USD") {
  if (value == null || Number.isNaN(Number(value))) {
    return "-";
  }

  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(Number(value));
  } catch {
    return currencyFormatter.format(Number(value));
  }
}

function formatNumber(value) {
  if (value == null || Number.isNaN(Number(value))) {
    return "-";
  }

  return numberFormatter.format(Number(value));
}

function scoreTone(score) {
  const numericScore = Number(score) || 0;

  if (numericScore >= 80) return "teal";
  if (numericScore >= 60) return "amber";
  return "red";
}

function latestTimestamp(item) {
  return item?.analysis_timestamp || item?.created_at || item?.timestamp || null;
}

function RecommendationDetail({ item }) {
  const topAlternatives = parseMaybeJson(item?.top_ranked_alternatives, []);
  const riskBreakdown = parseMaybeJson(item?.risk_breakdown, {});
  const costComparison = parseMaybeJson(item?.cost_comparison, {});
  const decisionFactors = parseMaybeJson(item?.decision_factors, []);
  const dataSources = parseMaybeJson(item?.data_sources_used, []);
  const weightedScoring = parseMaybeJson(item?.weighted_scoring, {});
  const supplierDetails = parseMaybeJson(item?.supplier_details, {});

  return (
    <div className="space-y-5 rounded-2xl border border-white/10 bg-[#07131a]/90 p-5 shadow-[0_0_40px_rgba(0,0,0,0.3)] backdrop-blur">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-[0.35em] text-[#4ff0d7]">Selected recommendation</div>
          <h2 className="mt-2 font-display text-2xl font-semibold text-[#e8f1f2]">
            {item?.commodity || "Procurement recommendation"}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#8fa3ad]">
            {item?.recommendation_summary || item?.rationale || "No summary is available for this recommendation."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Pill tone={scoreTone(item?.procurement_score || item?.procurement_score_percent)}>
            Score {formatNumber(item?.procurement_score || item?.procurement_score_percent)}
          </Pill>
          <Pill tone={item?.urgency === "CRITICAL" || item?.urgency === "HIGH" ? "red" : "amber"}>
            {item?.urgency || "Medium"}
          </Pill>
          <Pill tone={item?.refinery_compatibility === "COMPATIBLE" ? "teal" : "amber"}>
            {item?.refinery_compatibility || "Compatibility unknown"}
          </Pill>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Alternative source" value={item?.alternative_source || item?.recommended_source || "-"} />
        <MetricCard label="Route type" value={item?.route_type || "-"} />
        <MetricCard label="Estimated cost" value={formatCurrency(item?.cost_usd, item?.currency || "USD")} />
        <MetricCard label="Transit days" value={formatNumber(item?.transit_days)} />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <InfoPanel title="Decision factors" items={decisionFactors.map((entry) => `${entry.factor || "Factor"}: ${entry.description || ""}`)} />
        <InfoPanel title="Data sources" items={dataSources.length ? dataSources : ["No source metadata available"]} />
      </div>

      <div className="grid gap-3 xl:grid-cols-3">
        <Panel title="Risk breakdown">
          <div className="grid gap-2 text-sm text-[#b3c0c8]">
            <RiskLine label="Disruption" value={riskBreakdown.disruption_probability_percent ?? riskBreakdown.disruption_probability} />
            <RiskLine label="Geopolitical" value={riskBreakdown.geopolitical_risk_score} />
            <RiskLine label="Weather" value={riskBreakdown.weather_risk_score} />
            <RiskLine label="Congestion" value={riskBreakdown.congestion_risk_score} />
            <RiskLine label="Overall" value={riskBreakdown.overall_risk_score} highlight />
          </div>
        </Panel>

        <Panel title="Cost comparison">
          <div className="grid gap-2 text-sm text-[#b3c0c8]">
            <RiskLine label="Base" value={costComparison.base_cost_usd} currency />
            <RiskLine label="Freight" value={costComparison.freight_cost_usd} currency />
            <RiskLine label="Tariffs" value={costComparison.customs_tariffs_usd} currency />
            <RiskLine label="Total landed" value={costComparison.total_landed_cost_usd} currency highlight />
            <RiskLine label="Savings / premium" value={costComparison.savings_or_premium_usd} currency />
          </div>
        </Panel>

        <Panel title="Supplier profile">
          <div className="grid gap-2 text-sm text-[#b3c0c8]">
            <KeyValue label="Supplier" value={supplierDetails.supplier_name || item?.recommended_source || item?.alternative_source || "-"} />
            <KeyValue label="Country" value={supplierDetails.country || "-"} />
            <KeyValue label="LPI" value={supplierDetails.lpi_score ?? "-"} />
            <KeyValue label="Port" value={supplierDetails.harbor_size || supplierDetails.harbor_type || "-"} />
          </div>
        </Panel>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Panel title="Top ranked alternatives">
          <div className="space-y-2">
            {(topAlternatives.length ? topAlternatives : [{ name: "No alternatives ranked", score_percent: null, rank: 1 }]).map((alternative) => (
              <div key={`${alternative.rank || alternative.name}`} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                <div>
                  <div className="font-medium text-[#e8f1f2]">{alternative.name}</div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-[#8fa3ad]">Rank {alternative.rank || "-"}</div>
                </div>
                <Pill tone={scoreTone(alternative.score_percent)}>{formatNumber(alternative.score_percent)}%</Pill>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Immediate action">
          <p className="text-sm leading-relaxed text-[#b3c0c8]">
            {item?.next_recommended_action || "No action guidance is available for this recommendation."}
          </p>
          <div className="mt-4 rounded-xl border border-[#4ff0d7]/15 bg-[#4ff0d7]/8 p-4">
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#4ff0d7]">Weighted scoring</div>
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm text-[#b3c0c8]">
              <KeyValue label="Logistics" value={weightedScoring.logistics_weight ?? item?.logistics_performance_index ?? "-"} />
              <KeyValue label="Cost" value={weightedScoring.cost_weight ?? "-"} />
              <KeyValue label="Risk" value={weightedScoring.risk_weight ?? "-"} />
              <KeyValue label="Overall" value={weightedScoring.calculated_overall_score ?? item?.procurement_score ?? item?.procurement_score_percent ?? "-"} />
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}

function MetricCard({ label, value }) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#050b11]/80 p-4">
      <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#8fa3ad]">{label}</div>
      <div className="mt-2 break-words font-display text-lg text-[#e8f1f2]">{value}</div>
    </div>
  );
}

function Panel({ title, children }) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#050b11]/80 p-4">
      <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.35em] text-[#8fa3ad]">{title}</div>
      {children}
    </div>
  );
}

function InfoPanel({ title, items }) {
  return (
    <Panel title={title}>
      <div className="space-y-2 text-sm text-[#b3c0c8]">
        {items.map((item, index) => (
          <div key={`${title}-${index}`} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 leading-relaxed">
            {item}
          </div>
        ))}
      </div>
    </Panel>
  );
}

function KeyValue({ label, value }) {
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-[#8fa3ad]">{label}</div>
      <div className="mt-1 text-[#e8f1f2]">{value}</div>
    </div>
  );
}

function RiskLine({ label, value, highlight = false, currency = false }) {
  const displayValue = currency ? formatCurrency(value) : `${formatNumber(value)}${value == null ? "" : currency ? "" : "%"}`;

  return (
    <div className={`flex items-center justify-between rounded-lg border px-3 py-2 ${highlight ? "border-[#4ff0d7]/20 bg-[#4ff0d7]/10" : "border-white/10 bg-white/5"}`}>
      <span>{label}</span>
      <span className={highlight ? "text-[#4ff0d7]" : "text-[#e8f1f2]"}>{displayValue}</span>
    </div>
  );
}

export default function ProcumentOrchestrator({ onLogout }) {
  const navigate = useNavigate();
  const [recommendations, setRecommendations] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");

  const token = localStorage.getItem("accessToken");

  const selectedRecommendation = useMemo(() => {
    if (!recommendations.length) return null;
    return recommendations.find((item) => item.id === selectedId) || recommendations[0];
  }, [recommendations, selectedId]);

  const summary = useMemo(() => {
    const highUrgency = recommendations.filter((item) => ["HIGH", "CRITICAL"].includes(item.urgency)).length;
    const avgScore = recommendations.length
      ? recommendations.reduce((total, item) => total + (Number(item.procurement_score) || Number(item.procurement_score_percent) || 0), 0) / recommendations.length
      : 0;
    const compatible = recommendations.filter((item) => item.refinery_compatibility === "COMPATIBLE").length;
    const latest = recommendations[0] ? latestTimestamp(recommendations[0]) : null;

    return { highUrgency, avgScore, compatible, latest };
  }, [recommendations]);

  const fetchRecommendations = async ({ forceRun = false } = {}) => {
    if (!token) {
      navigate("/login", { replace: true });
      return;
    }

    setError("");

    try {
      if (forceRun) {
        setRunning(true);
        const runResponse = await fetch(API_ENDPOINTS.PROCUREMENT.RUN, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          credentials: "include",
        });

        if (!runResponse.ok) {
          const payload = await runResponse.json().catch(() => ({}));
          throw new Error(payload.message || "Unable to run procurement orchestrator");
        }
      }

      const response = await fetch(API_ENDPOINTS.PROCUREMENT.RECOMMENDATIONS, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        credentials: "include",
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (response.status === 401) {
          await onLogout?.();
          navigate("/login", { replace: true });
          return;
        }

        throw new Error(payload.message || "Unable to load procurement recommendations");
      }

      const rows = Array.isArray(payload) ? payload : payload?.rows || payload?.recommendations || [];
      setRecommendations(rows);
      setSelectedId((currentId) => currentId || rows[0]?.id || null);
    } catch (fetchError) {
      setError(fetchError.message);
      if (String(fetchError.message).toLowerCase().includes("unauthorized")) {
        await onLogout?.();
        navigate("/login", { replace: true });
      }
    } finally {
      setLoading(false);
      setRunning(false);
    }
  };

  useEffect(() => {
    fetchRecommendations();
  }, []);

  return (
    <div className="min-h-screen bg-[#05070a] text-[#e8f1f2]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_20%_0%,rgba(79,240,215,0.12),transparent_45%),radial-gradient(ellipse_at_80%_90%,rgba(255,180,84,0.08),transparent_45%)]" />
      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-[1600px] flex-col px-6 py-6 lg:px-16">
        <nav className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-5">
          <Link to="/" className="flex items-center gap-2 transition-opacity hover:opacity-80">
            <CrosshairMark />
            <span className="font-display text-lg font-semibold tracking-wide">GEOSECURE</span>
          </Link>

          <div className="flex flex-wrap items-center gap-3">
            <Link to="/" className="rounded-full border border-white/10 bg-white/5 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.28em] text-[#e8f1f2] transition-colors hover:border-[#4ff0d7]/30 hover:text-[#4ff0d7]">
              Back home
            </Link>
            <button
              onClick={onLogout}
              className="rounded-full border border-red-500/30 bg-red-500/10 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.28em] text-red-300 transition-colors hover:border-red-400/50 hover:bg-red-500/20"
            >
              Logout
            </button>
          </div>
        </nav>

        <header className="grid gap-5 py-8 xl:grid-cols-[1.2fr,0.8fr] xl:items-end">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-[0.35em] text-[#4ff0d7]">Adaptive procurement orchestrator</div>
            <h1 className="mt-3 max-w-4xl font-display text-4xl font-semibold tracking-tight sm:text-5xl">
              Procument Orchestrator
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-relaxed text-[#8fa3ad] sm:text-base">
              Identifies and ranks alternative crude sources and logistics routes, factoring in spot pricing, tanker availability, port congestion, and refinery grade compatibility so procurement teams can act within hours.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:justify-self-end">
            <StatCard label="Recommendations" value={recommendations.length} accent="teal" />
            <StatCard label="Avg score" value={`${formatNumber(summary.avgScore)}%`} accent="amber" />
          </div>
        </header>

        {error && (
          <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 font-mono text-sm text-red-300">
            {error}
          </div>
        )}

        <main className="grid flex-1 gap-6 xl:grid-cols-[0.95fr,1.4fr]">
          <section className="space-y-6 rounded-2xl border border-white/10 bg-[#07131a]/90 p-5 shadow-[0_0_40px_rgba(0,0,0,0.22)] backdrop-blur">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="font-mono text-[11px] uppercase tracking-[0.32em] text-[#8fa3ad]">Command panel</div>
                <h2 className="mt-2 font-display text-2xl font-semibold">Live recommendation feed</h2>
              </div>
              <button
                onClick={() => fetchRecommendations({ forceRun: true })}
                disabled={running}
                className="rounded-full border border-[#4ff0d7]/30 bg-[#4ff0d7]/10 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.28em] text-[#4ff0d7] transition-colors hover:bg-[#4ff0d7]/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {running ? "Running..." : "Run orchestrator"}
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <StatCard label="High urgency" value={summary.highUrgency} accent="red" />
              <StatCard label="Compatible" value={summary.compatible} accent="teal" />
              <StatCard label="Latest update" value={summary.latest ? new Date(summary.latest).toLocaleString() : "-"} accent="slate" />
            </div>

            <div className="space-y-3">
              {loading ? (
                <LoadingState />
              ) : recommendations.length ? (
                recommendations.map((item) => {
                  const score = Number(item.procurement_score) || Number(item.procurement_score_percent) || 0;
                  const isSelected = selectedRecommendation?.id === item.id;

                  return (
                    <button
                      key={item.id}
                      onClick={() => setSelectedId(item.id)}
                      className={`w-full rounded-2xl border p-4 text-left transition-colors ${isSelected ? "border-[#4ff0d7]/30 bg-[#4ff0d7]/10" : "border-white/10 bg-[#050b11]/80 hover:border-[#4ff0d7]/20"}`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="font-display text-xl text-[#e8f1f2]">{item.commodity}</div>
                          <div className="mt-1 font-mono text-[11px] uppercase tracking-[0.3em] text-[#8fa3ad]">
                            {item.current_source || "Current source unavailable"}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Pill tone={scoreTone(score)}>{formatNumber(score)}%</Pill>
                          <Pill tone={item.urgency === "CRITICAL" || item.urgency === "HIGH" ? "red" : "amber"}>{item.urgency || "MEDIUM"}</Pill>
                        </div>
                      </div>
                      <p className="mt-3 text-sm leading-relaxed text-[#b3c0c8]">
                        {item.recommendation_summary || item.rationale || "No summary provided."}
                      </p>
                      <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.24em] text-[#8fa3ad]">
                        <span>{item.route_type || "Route TBD"}</span>
                        <span>•</span>
                        <span>{item.refinery_compatibility || "Compatibility unknown"}</span>
                        <span>•</span>
                        <span>{item.next_recommended_action || "Action pending"}</span>
                      </div>
                    </button>
                  );
                })
              ) : (
                <EmptyState onRun={() => fetchRecommendations({ forceRun: true })} running={running} />
              )}
            </div>
          </section>

          <section>
            {selectedRecommendation ? (
              <RecommendationDetail item={selectedRecommendation} />
            ) : (
              <div className="rounded-2xl border border-white/10 bg-[#07131a]/90 p-6 text-sm text-[#8fa3ad]">
                No recommendation is selected.
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}

function StatCard({ label, value, accent = "teal" }) {
  const accentStyles = {
    teal: "border-[#4ff0d7]/20 bg-[#4ff0d7]/10 text-[#4ff0d7]",
    amber: "border-[#ffb454]/20 bg-[#ffb454]/10 text-[#ffb454]",
    red: "border-red-400/20 bg-red-500/10 text-red-300",
    slate: "border-white/10 bg-white/5 text-[#e8f1f2]",
  };

  return (
    <div className={`rounded-2xl border px-4 py-3 ${accentStyles[accent]}`}>
      <div className="font-mono text-[10px] uppercase tracking-[0.28em] opacity-80">{label}</div>
      <div className="mt-2 break-words font-display text-lg font-semibold text-[#e8f1f2]">{value}</div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="animate-pulse rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="h-4 w-2/5 rounded bg-white/10" />
          <div className="mt-3 h-3 w-4/5 rounded bg-white/10" />
          <div className="mt-2 h-3 w-3/5 rounded bg-white/10" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({ onRun, running }) {
  return (
    <div className="rounded-2xl border border-dashed border-[#4ff0d7]/25 bg-[#050b11]/80 p-6 text-center">
      <div className="font-display text-2xl text-[#e8f1f2]">No procurement recommendations yet</div>
      <p className="mt-3 text-sm leading-relaxed text-[#8fa3ad]">
        Run the orchestrator to generate ranked crude sources, logistics routes, and action-ready procurement guidance.
      </p>
      <button
        onClick={onRun}
        disabled={running}
        className="mt-5 rounded-full border border-[#4ff0d7]/30 bg-[#4ff0d7]/10 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.28em] text-[#4ff0d7] transition-colors hover:bg-[#4ff0d7]/20 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {running ? "Running..." : "Run orchestrator"}
      </button>
    </div>
  );
}