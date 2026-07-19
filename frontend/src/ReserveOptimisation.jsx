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

function Pill({ children, tone = "slate" }) {
  const toneStyles = {
    teal: "border-[#4ff0d7]/20 bg-[#4ff0d7]/10 text-[#4ff0d7]",
    amber: "border-[#ffb454]/20 bg-[#ffb454]/10 text-[#ffb454]",
    slate: "border-white/10 bg-white/5 text-[#c9d5da]",
    red: "border-red-400/20 bg-red-500/10 text-red-300",
    violet: "border-[#a78bfa]/20 bg-[#a78bfa]/10 text-[#a78bfa]",
  };

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.25em] ${toneStyles[tone]}`}>
      {children}
    </span>
  );
}

function Panel({ title, children }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#050b11]/80 p-4 shadow-[0_0_40px_rgba(0,0,0,0.22)] backdrop-blur">
      <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.35em] text-[#8fa3ad]">{title}</div>
      {children}
    </div>
  );
}

function Metric({ label, value, accent = "slate" }) {
  const accentStyles = {
    teal: "border-[#4ff0d7]/20 bg-[#4ff0d7]/10 text-[#4ff0d7]",
    amber: "border-[#ffb454]/20 bg-[#ffb454]/10 text-[#ffb454]",
    red: "border-red-400/20 bg-red-500/10 text-red-300",
    slate: "border-white/10 bg-white/5 text-[#e8f1f2]",
    violet: "border-[#a78bfa]/20 bg-[#a78bfa]/10 text-[#a78bfa]",
  };

  return (
    <div className={`rounded-xl border px-4 py-3 ${accentStyles[accent]}`}>
      <div className="font-mono text-[10px] uppercase tracking-[0.28em] opacity-80">{label}</div>
      <div className="mt-2 break-words font-display text-lg font-semibold text-[#e8f1f2]">{value}</div>
    </div>
  );
}

function formatNumber(value, digits = 1) {
  const numericValue = Number(value);
  if (Number.isNaN(numericValue)) return "-";
  return numericValue.toFixed(digits);
}

function formatCurrency(value) {
  const numericValue = Number(value);
  if (Number.isNaN(numericValue)) return "-";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(numericValue);
}

function parseMaybeJson(value, fallback) {
  if (value == null) return fallback;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function KeyValue({ label, value }) {
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-[#8fa3ad]">{label}</div>
      <div className="mt-1 text-[#e8f1f2]">{value}</div>
    </div>
  );
}

function reserveTone(status) {
  if (status === "SAFE") return "teal";
  if (status === "WATCH") return "amber";
  if (status === "WARNING") return "violet";
  return "red";
}

export default function ReserveOptimisation({ onLogout }) {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const token = localStorage.getItem("accessToken");

  const scenarios = useMemo(() => parseMaybeJson(data?.scenarios, []), [data]);
  const alerts = useMemo(() => parseMaybeJson(data?.alerts, []), [data]);
  const decisionFactors = useMemo(() => parseMaybeJson(data?.decision_factors, []), [data]);
  const topFactors = useMemo(() => parseMaybeJson(data?.explainable_ai?.top_contributing_factors, []), [data]);

  const loadData = async () => {
    if (!token) {
      navigate("/login", { replace: true });
      return;
    }

    try {
      setError("");
      const response = await fetch(API_ENDPOINTS.RESERVE_OPTIMISATION.DATA, {
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

        throw new Error(payload.message || "Unable to load reserve optimisation data");
      }

      setData(payload);
    } catch (fetchError) {
      setError(fetchError.message);
      if (String(fetchError.message).toLowerCase().includes("unauthorized")) {
        await onLogout?.();
        navigate("/login", { replace: true });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const reserveStatus = data?.reserve_status || {};
  const oilPrices = data?.oil_prices || {};
  const inventory = data?.commercial_inventory || {};
  const decision = data?.decision || {};
  const forecasts = data?.forecasts || {};
  const risk = data?.supply_risk || {};
  const depletion = data?.depletion_prediction || {};
  const marketCondition = data?.market_condition || {};
  const targetReserveInfo = data?.target_reserve_info || {};
  const optimizationScore = data?.optimization_score || {};
  const procurementWindow = data?.procurement_window || {};
  const reserveSufficiency = data?.reserve_sufficiency || {};
  const economicImpact = data?.economic_impact || {};
  const decisionConfidence = data?.decision_confidence || {};

  return (
    <div className="min-h-screen bg-[#05070a] text-[#e8f1f2]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_20%_0%,rgba(79,240,215,0.12),transparent_45%),radial-gradient(ellipse_at_80%_90%,rgba(167,139,250,0.10),transparent_45%)]" />
      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-[1600px] flex-col px-6 py-6 lg:px-16">
        <nav className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-5">
          <Link to="/" className="flex items-center gap-2 transition-opacity hover:opacity-80">
            <CrosshairMark />
            <span className="font-display text-lg font-semibold tracking-wide">GEOSECURE</span>
          </Link>

          <div className="flex flex-wrap items-center gap-3">
            <Link to="/dashboard" className="rounded-full border border-white/10 bg-white/5 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.28em] text-[#e8f1f2] transition-colors hover:border-[#4ff0d7]/30 hover:text-[#4ff0d7]">
              Dashboard
            </Link>
            <Link to="/reserve-optimisation" className="rounded-full border border-[#a78bfa]/30 bg-[#a78bfa]/10 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.28em] text-[#a78bfa]">
              Reserve Optimisation
            </Link>
            <Link to="/disruption-scenario" className="rounded-full border border-white/10 bg-white/5 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.28em] text-[#e8f1f2] transition-colors hover:border-[#ffb454]/30 hover:text-[#ffb454]">
              Disruption Scenario
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
            <div className="font-mono text-[11px] uppercase tracking-[0.35em] text-[#a78bfa]">Strategic reserve optimisation</div>
            <h1 className="mt-3 max-w-4xl font-display text-4xl font-semibold tracking-tight sm:text-5xl">
              Reserve Optimisation
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-relaxed text-[#8fa3ad] sm:text-base">
              Models optimal SPR drawdown schedules against supply gap forecasts, refinery demand curves, and replenishment window estimates to support policymakers under time pressure.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:justify-self-end">
            <Metric label="Optimization score" value={`${formatNumber(optimizationScore.overall_optimization_score)} / 100`} accent="violet" />
            <Metric label="Safety status" value={reserveStatus.safety_status || "-"} accent={reserveTone(reserveStatus.safety_status)} />
          </div>
        </header>

        {error && (
          <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 font-mono text-sm text-red-300">
            {error}
          </div>
        )}

        <main className="grid flex-1 gap-6 xl:grid-cols-[0.95fr,1.35fr]">
          <section className="space-y-6 rounded-2xl border border-white/10 bg-[#07131a]/90 p-5 shadow-[0_0_40px_rgba(0,0,0,0.22)] backdrop-blur">
            <div>
              <div className="font-mono text-[11px] uppercase tracking-[0.32em] text-[#8fa3ad]">Base case</div>
              <h2 className="mt-2 font-display text-2xl font-semibold">Strategic reserve snapshot</h2>
            </div>

            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="animate-pulse rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="h-4 w-2/5 rounded bg-white/10" />
                    <div className="mt-3 h-3 w-4/5 rounded bg-white/10" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <Metric label="Capacity" value={`${formatNumber(reserveStatus.capacity_barrels / 1000000)}M bbl`} accent="slate" />
                <Metric label="Current fill" value={`${formatNumber(reserveStatus.current_fill_barrels / 1000000)}M bbl`} accent="teal" />
                <Metric label="Fill ratio" value={`${formatNumber(reserveStatus.fill_ratio_percent)}%`} accent="amber" />
                <Metric label="Cover days" value={formatNumber(reserveStatus.cover_days)} accent="violet" />
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <Panel title="Decision">
                <div className="space-y-2 text-sm text-[#b3c0c8]">
                  <KeyValue label="Action" value={decision.action || "-"} />
                  <KeyValue label="Recommended drawdown" value={`${formatNumber(decision.recommended_volume_barrels / 1000000)}M bbl`} />
                  <KeyValue label="Procurement rate" value={`${formatNumber(decision.procurement_rate_barrels_per_day)} bpd`} />
                  <KeyValue label="Confidence" value={`${formatNumber(decision.confidence_score_percent)}%`} />
                </div>
              </Panel>

              <Panel title="Market condition">
                <div className="space-y-2 text-sm text-[#b3c0c8]">
                  <KeyValue label="Price status" value={marketCondition.price_status || "-"} />
                  <KeyValue label="Sentiment" value={marketCondition.market_sentiment || "-"} />
                  <KeyValue label="Volatility" value={marketCondition.volatility_level || "-"} />
                  <KeyValue label="Risk level" value={risk.risk_level || "-"} />
                </div>
              </Panel>
            </div>

            <Panel title="Policy signals">
              <div className="space-y-2 text-sm text-[#b3c0c8]">
                <KeyValue label="Best procurement time" value={procurementWindow.best_time_to_procure || "-"} />
                <KeyValue label="Purchase timeline" value={procurementWindow.suggested_purchase_timeline || "-"} />
                <KeyValue label="Target fill" value={`${formatNumber(targetReserveInfo.target_fill_percent)}%`} />
                <KeyValue label="Deficit / surplus" value={`${formatNumber(targetReserveInfo.reserve_deficit_surplus_barrels / 1000000)}M bbl`} />
              </div>
            </Panel>

            <Panel title="Alerts">
              <div className="space-y-2 text-sm text-[#b3c0c8]">
                {alerts.length ? alerts.map((alert, index) => (
                  <div key={`${alert.type || "alert"}-${index}`} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium text-[#e8f1f2]">{alert.type || "Alert"}</span>
                      <Pill tone={alert.severity === "HIGH" || alert.severity === "CRITICAL" ? "red" : alert.severity === "MEDIUM" ? "amber" : "teal"}>
                        {alert.severity || "INFO"}
                      </Pill>
                    </div>
                    <p className="mt-2 leading-relaxed">{alert.message || "No alert message available."}</p>
                  </div>
                )) : <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">No active alerts.</div>}
              </div>
            </Panel>
          </section>

          <section className="space-y-6">
            <div className="rounded-2xl border border-white/10 bg-[#07131a]/90 p-5 shadow-[0_0_40px_rgba(0,0,0,0.22)] backdrop-blur">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="font-mono text-[11px] uppercase tracking-[0.32em] text-[#8fa3ad]">Drawdown schedule</div>
                  <h2 className="mt-2 font-display text-2xl font-semibold">Recommended response windows</h2>
                </div>
                <div className="rounded-full border border-[#a78bfa]/20 bg-[#a78bfa]/10 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.3em] text-[#a78bfa]">
                  {reserveStatus.safety_status || "UNKNOWN"}
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <Metric label="Normal supply" value={`${formatNumber(reserveSufficiency.days_of_supply_normal_demand)} days`} accent="teal" />
                <Metric label="Peak supply" value={`${formatNumber(reserveSufficiency.days_of_supply_peak_demand)} days`} accent="amber" />
                <Metric label="Emergency supply" value={`${formatNumber(reserveSufficiency.days_of_supply_emergencies)} days`} accent="red" />
                <Metric label="Budget impact" value={economicImpact.budget_impact || "-"} accent="violet" />
              </div>
            </div>

            <div className="grid gap-3 xl:grid-cols-2">
              <Panel title="Refinery demand & supply curve">
                <div className="space-y-2 text-sm text-[#b3c0c8]">
                  <KeyValue label="Forecast 30d" value={`${formatNumber(forecasts.forecast_30d)}%`} />
                  <KeyValue label="Forecast 60d" value={`${formatNumber(forecasts.forecast_60d)}%`} />
                  <KeyValue label="Forecast 90d" value={`${formatNumber(forecasts.forecast_90d)}%`} />
                  <KeyValue label="Days remaining normal" value={formatNumber(depletion.days_remaining_normal)} />
                  <KeyValue label="Days remaining disrupted" value={formatNumber(depletion.days_remaining_disrupted)} />
                </div>
              </Panel>

              <Panel title="Replenishment window">
                <div className="space-y-2 text-sm text-[#b3c0c8]">
                  <KeyValue label="Best time to replenish" value={procurementWindow.best_time_to_procure || "-"} />
                  <KeyValue label="Suggested timeline" value={procurementWindow.suggested_purchase_timeline || "-"} />
                  <KeyValue label="Estimated procurement cost" value={formatCurrency(economicImpact.estimated_procurement_cost_usd)} />
                  <KeyValue label="Potential savings" value={formatCurrency(economicImpact.potential_cost_savings_usd)} />
                </div>
              </Panel>
            </div>

            <Panel title="Scenario stress tests">
              <div className="grid gap-3 lg:grid-cols-3">
                {(scenarios.length ? scenarios : []).map((scenario, index) => (
                  <div key={scenario.name || index} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="font-display text-lg text-[#e8f1f2]">{scenario.name || `Scenario ${index + 1}`}</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Pill tone="amber">{formatNumber(scenario.simulated_price_shock_percent)}% shock</Pill>
                      <Pill tone="violet">{formatNumber(scenario.simulated_import_reduction_percent)}% import cut</Pill>
                      <Pill tone={scenario.simulated_risk_score >= 85 ? "red" : scenario.simulated_risk_score >= 70 ? "amber" : "teal"}>
                        Risk {formatNumber(scenario.simulated_risk_score)}
                      </Pill>
                    </div>
                    <div className="mt-3 text-sm text-[#b3c0c8]">Response: {scenario.recommended_response || "-"}</div>
                  </div>
                ))}
              </div>
            </Panel>

            <div className="grid gap-3 sm:grid-cols-3">
              <Metric label="Average logged risk" value={formatNumber(data?.historical_performance?.average_logged_risk_score)} accent="amber" />
              <Metric label="Previous decision" value={data?.historical_performance?.previous_decision || "-"} accent="slate" />
              <Metric label="Total decisions" value={formatNumber(data?.historical_performance?.total_decisions_logged, 0)} accent="violet" />
            </div>

            <Panel title="Explainable AI">
              <div className="grid gap-3 lg:grid-cols-2">
                <div className="space-y-2 text-sm text-[#b3c0c8]">
                  {decisionFactors.map((factor, index) => (
                    <div key={`${factor.factor || "factor"}-${index}`} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-[#e8f1f2]">{factor.factor || "Factor"}</span>
                        <span className="text-[#a78bfa]">{formatNumber(factor.weight_importance)}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="space-y-2 text-sm text-[#b3c0c8]">
                  {(topFactors.length ? topFactors : ["No contributing factors listed"]).map((factor, index) => (
                    <div key={`${factor}-${index}`} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                      {factor}
                    </div>
                  ))}
                  <div className="rounded-lg border border-[#a78bfa]/20 bg-[#a78bfa]/10 px-3 py-2 text-[#e8f1f2]">
                    {data?.explainable_ai?.expected_outcomes || "No outcome summary available."}
                  </div>
                </div>
              </div>
            </Panel>
          </section>
        </main>
      </div>
    </div>
  );
}