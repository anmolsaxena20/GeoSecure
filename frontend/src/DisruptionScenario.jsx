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
  };

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.25em] ${toneStyles[tone]}`}>
      {children}
    </span>
  );
}

function SectionCard({ title, children }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#050b11]/80 p-4 shadow-[0_0_40px_rgba(0,0,0,0.22)] backdrop-blur">
      <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.35em] text-[#8fa3ad]">{title}</div>
      {children}
    </div>
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

function Metric({ label, value, accent = "slate" }) {
  const accentStyles = {
    teal: "border-[#4ff0d7]/20 bg-[#4ff0d7]/10 text-[#4ff0d7]",
    amber: "border-[#ffb454]/20 bg-[#ffb454]/10 text-[#ffb454]",
    red: "border-red-400/20 bg-red-500/10 text-red-300",
    slate: "border-white/10 bg-white/5 text-[#e8f1f2]",
  };

  return (
    <div className={`rounded-xl border px-4 py-3 ${accentStyles[accent]}`}>
      <div className="font-mono text-[10px] uppercase tracking-[0.28em] opacity-80">{label}</div>
      <div className="mt-2 break-words font-display text-lg font-semibold text-[#e8f1f2]">{value}</div>
    </div>
  );
}

function formatPercent(value, digits = 1) {
  const numericValue = Number(value);
  if (Number.isNaN(numericValue)) return "-";
  return `${numericValue.toFixed(digits)}%`;
}

function formatNumber(value, digits = 1) {
  const numericValue = Number(value);
  if (Number.isNaN(numericValue)) return "-";
  return numericValue.toFixed(digits);
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

function deriveScenarioImpacts(scenario, baseline) {
  const priceShock = Number(scenario?.simulated_price_shock_percent) || 0;
  const importReduction = Number(scenario?.simulated_import_reduction_percent) || 0;
  const riskScore = Number(scenario?.simulated_risk_score) || 0;
  const severity = priceShock * 0.45 + importReduction * 0.35 + riskScore * 0.2;

  const refineryRunRateDrop = Math.min(45, +(priceShock * 0.3 + importReduction * 0.7).toFixed(1));
  const domesticFuelPriceIncrease = Math.min(60, +(priceShock * 0.65 + riskScore * 0.08).toFixed(1));
  const powerStressIndex = Math.min(100, +(25 + severity).toFixed(1));
  const gdpDrag = +(severity * 0.04).toFixed(2);

  const gdpTrajectory = [
    { horizon: "30d", value: -(gdpDrag * 0.45) },
    { horizon: "90d", value: -(gdpDrag * 0.85) },
    { horizon: "180d", value: -(gdpDrag * 1.2) },
  ];

  const fuelTone = domesticFuelPriceIncrease >= 25 ? "red" : domesticFuelPriceIncrease >= 15 ? "amber" : "teal";
  const powerTone = powerStressIndex >= 70 ? "red" : powerStressIndex >= 45 ? "amber" : "teal";

  return {
    refineryRunRateDrop,
    domesticFuelPriceIncrease,
    powerStressIndex,
    powerTone,
    fuelTone,
    gdpTrajectory,
    gdpDrag,
    baselineFill: Number(baseline?.reserve_status?.fill_ratio_percent) || 0,
    baselineRisk: Number(baseline?.supply_risk?.risk_score) || 0,
  };
}

export default function DisruptionScenario({ onLogout }) {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [selectedScenarioIndex, setSelectedScenarioIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const token = localStorage.getItem("accessToken");

  const scenarios = useMemo(() => parseMaybeJson(data?.scenarios, []), [data]);
  const selectedScenario = scenarios[selectedScenarioIndex] || scenarios[0] || null;
  const derivedImpacts = useMemo(
    () => deriveScenarioImpacts(selectedScenario, data),
    [selectedScenario, data],
  );

  const loadScenarioData = async () => {
    if (!token) {
      navigate("/login", { replace: true });
      return;
    }

    try {
      setError("");
      const response = await fetch(API_ENDPOINTS.DISRUPTION.SCENARIOS, {
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

        throw new Error(payload.message || "Unable to load disruption scenarios");
      }

      setData(payload);
      setSelectedScenarioIndex(0);
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
    loadScenarioData();
  }, []);

  const reserveStatus = data?.reserve_status || {};
  const oilPrices = data?.oil_prices || {};
  const supplyRisk = data?.supply_risk || {};
  const marketCondition = data?.market_condition || {};
  const decision = data?.decision || {};
  const forecasts = data?.forecasts || {};
  const depletion = data?.depletion_prediction || {};
  const optimizationScore = data?.optimization_score || {};
  const economicImpact = data?.economic_impact || {};
  const decisionConfidence = data?.decision_confidence || {};
  const targetReserveInfo = data?.target_reserve_info || {};
  const reserveSufficiency = data?.reserve_sufficiency || {};
  const alerts = parseMaybeJson(data?.alerts, []);

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
            <div className="font-mono text-[11px] uppercase tracking-[0.35em] text-[#ffb454]">Scenario modeller</div>
            <h1 className="mt-3 max-w-4xl font-display text-4xl font-semibold tracking-tight sm:text-5xl">
              Disruption Scenario
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-relaxed text-[#8fa3ad] sm:text-base">
              Simulates specific shocks such as a Hormuz partial closure, an OPEC+ emergency cut, and a Red Sea shipping suspension, then estimates cascading impacts on refinery run rates, domestic fuel prices, power sector stress, and GDP trajectory.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:justify-self-end">
            <Metric label="Risk score" value={formatNumber(supplyRisk.risk_score)} accent="red" />
            <Metric label="Safety status" value={reserveStatus.safety_status || "-"} accent="amber" />
          </div>
        </header>

        {error && (
          <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 font-mono text-sm text-red-300">
            {error}
          </div>
        )}

        <main className="grid flex-1 gap-6 xl:grid-cols-[0.92fr,1.38fr]">
          <section className="space-y-6 rounded-2xl border border-white/10 bg-[#07131a]/90 p-5 shadow-[0_0_40px_rgba(0,0,0,0.22)] backdrop-blur">
            <div>
              <div className="font-mono text-[11px] uppercase tracking-[0.32em] text-[#8fa3ad]">Live model snapshot</div>
              <h2 className="mt-2 font-display text-2xl font-semibold">Current baseline</h2>
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
                <Metric label="Reserve fill" value={`${formatNumber(reserveStatus.fill_ratio_percent)}%`} accent="teal" />
                <Metric label="Cover days" value={formatNumber(reserveStatus.cover_days)} accent="slate" />
                <Metric label="Brent / WTI" value={`${formatNumber(oilPrices.brent_price)} / ${formatNumber(oilPrices.wti_price)}`} accent="amber" />
                <Metric label="GDP outlook" value={decisionConfidence.confidence_level || "-"} accent="red" />
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <SectionCard title="Market condition">
                <div className="space-y-2 text-sm text-[#b3c0c8]">
                  <KeyValue label="Price status" value={marketCondition.price_status || "-"} />
                  <KeyValue label="Sentiment" value={marketCondition.market_sentiment || "-"} />
                  <KeyValue label="Volatility" value={marketCondition.volatility_level || "-"} />
                </div>
              </SectionCard>

              <SectionCard title="Decision">
                <div className="space-y-2 text-sm text-[#b3c0c8]">
                  <KeyValue label="Action" value={decision.action || "-"} />
                  <KeyValue label="Confidence" value={`${formatNumber(decision.confidence_score_percent)}%`} />
                  <KeyValue label="Urgency" value={decision.urgency || "-"} />
                </div>
              </SectionCard>
            </div>

            <SectionCard title="Alert stream">
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
            </SectionCard>
          </section>

          <section className="space-y-6">
            <div className="rounded-2xl border border-white/10 bg-[#07131a]/90 p-5 shadow-[0_0_40px_rgba(0,0,0,0.22)] backdrop-blur">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="font-mono text-[11px] uppercase tracking-[0.32em] text-[#8fa3ad]">Scenarios</div>
                  <h2 className="mt-2 font-display text-2xl font-semibold">Shock library</h2>
                </div>
                <div className="rounded-full border border-[#ffb454]/20 bg-[#ffb454]/10 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.3em] text-[#ffb454]">
                  {scenarios.length} scenarios
                </div>
              </div>

              <div className="mt-4 grid gap-3">
                {scenarios.map((scenario, index) => {
                  const isSelected = index === selectedScenarioIndex;
                  return (
                    <button
                      key={scenario.name || index}
                      onClick={() => setSelectedScenarioIndex(index)}
                      className={`rounded-2xl border p-4 text-left transition-colors ${isSelected ? "border-[#ffb454]/35 bg-[#ffb454]/10" : "border-white/10 bg-[#050b11]/80 hover:border-[#ffb454]/20"}`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="font-display text-xl text-[#e8f1f2]">{scenario.name || `Scenario ${index + 1}`}</div>
                          <div className="mt-1 font-mono text-[11px] uppercase tracking-[0.28em] text-[#8fa3ad]">
                            {scenario.recommended_response || "Response pending"}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Pill tone={scenario.simulated_risk_score >= 85 ? "red" : scenario.simulated_risk_score >= 70 ? "amber" : "teal"}>
                            Risk {formatNumber(scenario.simulated_risk_score)}
                          </Pill>
                          <Pill tone="slate">{formatPercent(scenario.simulated_import_reduction_percent)}</Pill>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                        <Metric label="Price shock" value={formatPercent(scenario.simulated_price_shock_percent)} accent="amber" />
                        <Metric label="Import reduction" value={formatPercent(scenario.simulated_import_reduction_percent)} accent="teal" />
                        <Metric label="Depletion days" value={formatNumber(scenario.depletion_days_remaining)} accent="slate" />
                        <Metric label="Response" value={scenario.recommended_response || "-"} accent="red" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {selectedScenario ? (
              <div className="space-y-6 rounded-2xl border border-white/10 bg-[#07131a]/90 p-5 shadow-[0_0_40px_rgba(0,0,0,0.22)] backdrop-blur">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-mono text-[11px] uppercase tracking-[0.32em] text-[#ffb454]">Selected scenario</div>
                    <h2 className="mt-2 font-display text-2xl font-semibold">{selectedScenario.name}</h2>
                    <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[#8fa3ad]">
                      {selectedScenario.recommended_response || "No recommended response available."}
                    </p>
                  </div>
                  <Pill tone={selectedScenario.simulated_risk_score >= 85 ? "red" : selectedScenario.simulated_risk_score >= 70 ? "amber" : "teal"}>
                    Risk {formatNumber(selectedScenario.simulated_risk_score)}
                  </Pill>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <Metric label="Refinery run-rate drop" value={`${formatNumber(derivedImpacts.refineryRunRateDrop)}%`} accent="amber" />
                  <Metric label="Domestic fuel price" value={`${formatNumber(derivedImpacts.domesticFuelPriceIncrease)}%`} accent={derivedImpacts.fuelTone} />
                  <Metric label="Power sector stress" value={`${formatNumber(derivedImpacts.powerStressIndex)}/100`} accent={derivedImpacts.powerTone} />
                  <Metric label="GDP drag" value={`${formatNumber(derivedImpacts.gdpDrag)}%`} accent="red" />
                </div>

                <div className="grid gap-3 lg:grid-cols-2">
                  <SectionCard title="Cascading impact trajectory">
                    <div className="space-y-2 text-sm text-[#b3c0c8]">
                      {derivedImpacts.gdpTrajectory.map((point) => (
                        <div key={point.horizon} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                          <span>{point.horizon}</span>
                          <span className="text-[#ffb454]">{formatPercent(point.value, 2)}</span>
                        </div>
                      ))}
                    </div>
                  </SectionCard>

                  <SectionCard title="Operational signals">
                    <div className="space-y-2 text-sm text-[#b3c0c8]">
                      <KeyValue label="Refinery compatibility" value={data?.decision?.refinery_compatibility || "-"} />
                      <KeyValue label="Expected depletion" value={`${formatNumber(selectedScenario.depletion_days_remaining)} days`} />
                      <KeyValue label="Target fill" value={`${formatNumber(targetReserveInfo.target_fill_percent)}%`} />
                      <KeyValue label="Confidence" value={`${formatNumber(optimizationScore.overall_optimization_score)} / 100`} />
                    </div>
                  </SectionCard>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-white/10 bg-[#07131a]/90 p-6 text-sm text-[#8fa3ad]">
                No scenario available.
              </div>
            )}

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <Metric label="GDP forecast 30d" value={`${formatNumber(forecasts.forecast_30d)}%`} accent="teal" />
              <Metric label="GDP forecast 60d" value={`${formatNumber(forecasts.forecast_60d)}%`} accent="amber" />
              <Metric label="GDP forecast 90d" value={`${formatNumber(forecasts.forecast_90d)}%`} accent="red" />
              <Metric label="Economic impact" value={economicImpact.budget_impact || "-"} accent="slate" />
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              <SectionCard title="Reserve sufficiency">
                <div className="space-y-2 text-sm text-[#b3c0c8]">
                  <KeyValue label="Normal demand" value={`${formatNumber(reserveSufficiency.days_of_supply_normal_demand)} days`} />
                  <KeyValue label="Peak demand" value={`${formatNumber(reserveSufficiency.days_of_supply_peak_demand)} days`} />
                  <KeyValue label="Emergency" value={`${formatNumber(reserveSufficiency.days_of_supply_emergencies)} days`} />
                </div>
              </SectionCard>

              <SectionCard title="Decision factors">
                <div className="space-y-2 text-sm text-[#b3c0c8]">
                  {(parseMaybeJson(data?.decision_factors, [])).map((factor, index) => (
                    <div key={`${factor.factor || "factor"}-${index}`} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-[#e8f1f2]">{factor.factor || "Factor"}</span>
                        <span className="text-[#4ff0d7]">{formatNumber(factor.weight_importance)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </SectionCard>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#07131a]/90 p-5 shadow-[0_0_40px_rgba(0,0,0,0.22)] backdrop-blur">
              <div className="font-mono text-[11px] uppercase tracking-[0.32em] text-[#8fa3ad]">Macro summary</div>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <Metric label="Oil price trend" value={oilPrices.trend_direction || "-"} accent="amber" />
                <Metric label="Inventory trend" value={data?.commercial_inventory?.trend || "-"} accent="teal" />
                <Metric label="Latest action" value={decision.action || "-"} accent="red" />
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}