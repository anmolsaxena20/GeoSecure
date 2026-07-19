import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  BarChart3,
  MessageCircle,
  Cpu,
  Globe,
  LayoutGrid,
  MapPin,
  Play,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from 'lucide-react'

const scenarioOptions = [
  { value: 'normal', label: 'Standard Operations' },
  { value: 'cyclone', label: 'Gujarat Cyclone Impact' },
  { value: 'pipeline_leak', label: 'Mumbai High Pipeline Leak' },
  { value: 'floods', label: 'Assam Regional Floods' },
  { value: 'geopolitical', label: 'Middle East Maritime Disruption' },
]

const kpiData = [
  { label: 'Overall Network Risk', value: '41', unit: '/100', sub: 'Level: Moderate', accent: 'text-[#f59e0b]' },
  { label: 'Refinery Capacity Utilization', value: '77', unit: '%', sub: 'Active: 3.1M bbl/d', accent: 'text-[#4ff0d7]' },
  { label: 'Terminal Supply Sufficiency', value: '12', unit: 'days', sub: 'Average reserve cover', accent: 'text-[#10b981]' },
  { label: 'Brent Crude Benchmark', value: '92.8', unit: '/bbl', sub: 'Forex: 83.1 INR/USD', accent: 'text-[#f43f5e]' },
]

const agentCards = [
  {
    title: 'Disruption Risk Agent',
    subtitle: 'Scans ports, weather & trade corridors',
    description: 'Monitors global trade lanes and updates shipping risk score probabilities.',
    icon: ShieldCheck,
    accent: 'bg-[#4ff0d7]/10 text-[#4ff0d7]',
  },
  {
    title: 'Supply Chain Economies Agent',
    subtitle: 'Analyzes GDP, inflation & logistics performance',
    description: 'Calculates macro-economic impacts of energy price shocks.',
    icon: Cpu,
    accent: 'bg-[#f59e0b]/10 text-[#f59e0b]',
  },
]

const corridorRisks = [
  { corridor: 'Mumbai–Nhava Sheva', probability: '24%', level: 'Medium' },
  { corridor: 'Kolkata–Chittagong', probability: '38%', level: 'High' },
  { corridor: 'Chennai–Tuticorin', probability: '18%', level: 'Low' },
  { corridor: 'Jamnagar–Vadinar', probability: '29%', level: 'Medium' },
]

const chartBars = [
  { label: 'Refineries', value: 72, tone: 'bg-[#4ff0d7]' },
  { label: 'Pipelines', value: 58, tone: 'bg-[#f59e0b]' },
  { label: 'Storage', value: 81, tone: 'bg-[#10b981]' },
  { label: 'Distribution', value: 66, tone: 'bg-[#8b5cf6]' },
]

const initialNodes = [
  { id: 1, name: 'Mumbai High Offshore', type: 'Wellhead', health: 88, capacity: '350,000 bbl/d' },
  { id: 2, name: 'Jamnagar Refinery', type: 'Refinery', health: 74, capacity: '540,000 bbl/d' },
  { id: 3, name: 'Kochi Storage Hub', type: 'Terminal', health: 91, capacity: '220,000 bbl/d' },
]

export default function DigitalTwin({ isAuthenticated }) {
  const [activeTab, setActiveTab] = useState('simulation')
  const [scenario, setScenario] = useState('normal')
  const [selectedNode, setSelectedNode] = useState(null)
  const [nodeHealth, setNodeHealth] = useState(88)
  const [nodeDescription, setNodeDescription] = useState('')
  const [messages, setMessages] = useState([
    {
      id: 1,
      author: 'assistant',
      content:
        "Greetings! I am the GeoSecure Supply Chain Copilot. I have loaded India's energy network layout. If you disrupt any refinery or pipeline, ask me for mitigation options.",
    },
  ])
  const [chatInput, setChatInput] = useState('')
  const [tickerMessage, setTickerMessage] = useState('Retrieving threat feed and global news...')

  useEffect(() => {
    const messages = [
      'Cyclone signal strengthening across Gujarat coast.',
      'Pipeline pressure drop detected near Mumbai High.',
      'Port congestion rising at Chennai import terminals.',
      'Rail transit delay impacting Assam fuel inbound.',
    ]
    let index = 0
    const interval = window.setInterval(() => {
      setTickerMessage(messages[index % messages.length])
      index += 1
    }, 6500)

    return () => window.clearInterval(interval)
  }, [])

  const selectedNodeData = useMemo(
    () => initialNodes.find((node) => node.id === selectedNode) ?? null,
    [selectedNode],
  )

  const handleSelectNode = (id) => {
    setSelectedNode(id)
    const node = initialNodes.find((item) => item.id === id)
    setNodeHealth(node?.health ?? 88)
    setNodeDescription('')
    setActiveTab('simulation')
  }

  const handleApplyStress = () => {
    if (!selectedNodeData) return
    setMessages((prev) => [
      ...prev,
      {
        id: prev.length + 1,
        author: 'user',
        content: `Apply simulated stress to ${selectedNodeData.name}: ${nodeDescription || 'decrease capacity and raise risk'}`,
      },
    ])
    setChatInput('')
  }

  const handleSendChat = () => {
    if (!chatInput.trim()) return
    setMessages((prev) => [
      ...prev,
      { id: prev.length + 1, author: 'user', content: chatInput.trim() },
    ])
    setChatInput('')
  }

  const healthBadge = (value) => {
    if (value >= 80) return 'Healthy'
    if (value >= 60) return 'Stable'
    return 'At risk'
  }

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
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[#4ff0d7]/20 bg-[#0c1320] text-[#4ff0d7] shadow-[0_0_30px_rgba(79,240,215,0.15)]">
              <Globe className="h-5 w-5" />
            </div>
            <span className="font-display text-lg font-semibold tracking-wide">GEOSECURE</span>
          </Link>

          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="font-mono text-xs uppercase tracking-[0.25em] text-[#8fa3ad] transition-colors hover:text-[#e8f1f2]"
            >
              Overview
            </Link>
            <Link
              to="/dashboard"
              className="font-mono text-xs uppercase tracking-[0.25em] text-[#8fa3ad] transition-colors hover:text-[#e8f1f2]"
            >
              Dashboard
            </Link>
            <button
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="rounded-sm border border-white/10 bg-white/5 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.25em] text-[#e8f1f2] transition-colors hover:border-[#4ff0d7]/30 hover:text-[#4ff0d7]"
            >
              Top
            </button>
          </div>
        </nav>

        <main className="flex-1 px-6 pb-12 lg:px-16">
          <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.35em] text-[#4ff0d7]">Digital twin command center</p>
              <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
                India Energy Network Digital Twin
              </h1>
              <p className="mt-3 max-w-2xl text-sm text-[#8fa3ad] sm:text-base">
                Simulate supply chain events across ports, refineries, pipelines and terminals with a native React interface built for GeoSecure.
              </p>
            </div>

            <div className="rounded-sm border border-[#4ff0d7]/20 bg-[#07161d]/80 px-4 py-3 shadow-[0_0_30px_rgba(79,240,215,0.08)]">
              <div className="font-mono text-[11px] uppercase tracking-[0.3em] text-[#8fa3ad]">Active system state</div>
              <div className="mt-1 font-display text-xl text-[#4ff0d7]">Real-time geospatial simulation</div>
            </div>
          </div>

          {!isAuthenticated && (
            <div className="mb-6 rounded-3xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200 shadow-[0_0_30px_rgba(251,191,36,0.08)]">
              You are viewing the demo Digital Twin. Sign in to unlock full scenario write operations.
            </div>
          )}

          <div className="grid gap-6 xl:grid-cols-[1.45fr,1fr]">
            <section className="rounded-[28px] border border-white/10 bg-[#07131a]/80 p-6 shadow-[0_0_70px_rgba(0,0,0,0.28)] backdrop-blur md:p-8">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {kpiData.map((item) => (
                  <div key={item.label} className="rounded-3xl border border-white/10 bg-[#0c1522]/80 p-4">
                    <div className="font-mono text-[11px] uppercase tracking-[0.28em] text-[#8fa3ad]">{item.label}</div>
                    <div className="mt-3 flex items-end gap-2">
                      <span className={`text-3xl font-semibold ${item.accent}`}>{item.value}</span>
                      <span className="pb-1 text-sm text-[#8fa3ad]">{item.unit}</span>
                    </div>
                    <p className="mt-2 text-sm text-[#8fa3ad]">{item.sub}</p>
                  </div>
                ))}
              </div>

              <div className="mt-6 rounded-[28px] border border-white/10 bg-[#091018]/80 p-4 shadow-[inset_0_0_0_1px_rgba(79,240,215,0.05)]">
                <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="font-display text-xl font-semibold">Network simulator</h2>
                    <p className="mt-1 text-sm text-[#8fa3ad]">Choose a preset to emulate regional energy events in the Digital Twin.</p>
                  </div>
                  <div className="flex items-center gap-3 rounded-3xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-[#e8f1f2]">
                    <Sparkles className="h-4 w-4 text-[#4ff0d7]" />
                    <select
                      value={scenario}
                      onChange={(event) => setScenario(event.target.value)}
                      className="min-w-[190px] bg-transparent text-sm text-[#e8f1f2] outline-none"
                    >
                      {scenarioOptions.map((option) => (
                        <option key={option.value} value={option.value} className="bg-[#05070a] text-[#e8f1f2]">
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="relative overflow-hidden rounded-3xl bg-[#06111d] p-6">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(79,240,215,0.14),transparent_40%),radial-gradient(circle_at_bottom_right,rgba(255,180,84,0.08),transparent_35%)]" />
                  <div className="relative grid gap-6 lg:grid-cols-[1fr,0.88fr]">
                    <div className="space-y-3">
                      <div className="rounded-3xl border border-white/10 bg-[#0b1626]/80 p-4 text-sm text-[#cbd5e1]">
                        This map synthesizes location, risk, and infrastructure statuses from the Digital Twin model. Tap a node to preview its current condition and then apply a simulated stress event.
                      </div>

                      <div className="grid gap-3 sm:grid-cols-3">
                        {initialNodes.map((node) => (
                          <button
                            key={node.id}
                            type="button"
                            onClick={() => handleSelectNode(node.id)}
                            className={`rounded-3xl border px-4 py-4 text-left transition-all duration-200 ${
                              selectedNode === node.id
                                ? 'border-[#4ff0d7] bg-[#0f1d31] shadow-[0_0_30px_rgba(79,240,215,0.12)]'
                                : 'border-white/10 bg-[#08101d] hover:border-[#4ff0d7]/50'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <span className="font-semibold text-[#e8f1f2]">{node.name}</span>
                              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[11px] uppercase tracking-[0.24em] text-[#8fa3ad]">{node.type}</span>
                            </div>
                            <p className="mt-3 text-sm text-[#8fa3ad]">Health: {node.health}%</p>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-[28px] border border-white/10 bg-[#07121c]/90 p-5 shadow-[0_0_40px_rgba(0,0,0,0.22)]">
                      <div className="mb-4 flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#4ff0d7]/10 text-[#4ff0d7]">
                          <MapPin className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-[0.3em] text-[#8fa3ad]">Selected node</p>
                          <h3 className="mt-1 text-lg font-semibold text-[#e8f1f2]">{selectedNodeData?.name ?? 'Tap a node to begin'}</h3>
                        </div>
                      </div>

                      {selectedNodeData ? (
                        <div className="space-y-5">
                          <div className="rounded-3xl border border-white/10 bg-[#0b1422]/80 p-4">
                            <div className="flex items-center justify-between text-sm text-[#8fa3ad]">
                              <span>Operational health</span>
                              <span className="font-semibold text-[#e8f1f2]">{nodeHealth}%</span>
                            </div>
                            <input
                              type="range"
                              min="0"
                              max="100"
                              value={nodeHealth}
                              onChange={(event) => setNodeHealth(Number(event.target.value))}
                              className="mt-3 w-full accent-[#4ff0d7]"
                            />
                            <div className="mt-2 flex items-center justify-between text-[11px] uppercase tracking-[0.24em] text-[#8fa3ad]">
                              <span>0% Disrupted</span>
                              <span>100% Healthy</span>
                            </div>
                          </div>

                          <div className="rounded-3xl border border-white/10 bg-[#0b1422]/80 p-4">
                            <div className="flex items-center justify-between text-sm text-[#8fa3ad]">
                              <span>Production capacity</span>
                              <span className="font-semibold text-[#e8f1f2]">{selectedNodeData.capacity}</span>
                            </div>
                            <p className="mt-3 text-sm text-[#cbd5e1]">Health status: <span className="font-medium text-[#4ff0d7]">{healthBadge(nodeHealth)}</span></p>
                          </div>

                          <label className="block text-sm text-[#8fa3ad]">
                            Active incident description
                            <textarea
                              value={nodeDescription}
                              onChange={(event) => setNodeDescription(event.target.value)}
                              placeholder="e.g. Cyclone damage to offshore platform..."
                              className="mt-3 h-24 w-full rounded-3xl border border-white/10 bg-[#04111f]/90 p-4 text-sm text-[#e8f1f2] outline-none placeholder:text-[#6b7280]"
                            />
                          </label>

                          <div className="flex flex-col gap-3 sm:flex-row">
                            <button
                              type="button"
                              onClick={handleApplyStress}
                              className="flex-1 rounded-3xl bg-[#4ff0d7] px-4 py-3 text-sm font-semibold text-[#05070a] transition hover:bg-[#3cc9d4]"
                            >
                              <Play className="mr-2 inline-block h-4 w-4" /> Apply Stress
                            </button>
                            <button
                              type="button"
                              onClick={() => setSelectedNode(null)}
                              className="flex-1 rounded-3xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-[#e8f1f2] transition hover:border-[#4ff0d7]/30 hover:text-[#4ff0d7]"
                            >
                              <RefreshCcw className="mr-2 inline-block h-4 w-4" /> Clear Selection
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-3xl border border-dashed border-white/10 bg-[#08101c]/80 p-8 text-center text-sm text-[#8fa3ad]">
                          Select a node on the map panel to inspect its details and run a simulated disruption.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 rounded-[28px] border border-white/10 bg-[#0b1422]/80 p-6 shadow-[0_0_40px_rgba(0,0,0,0.24)]">
                <div className="mb-4 flex items-center justify-between gap-4">
                  <div>
                    <h2 className="font-display text-xl font-semibold">Asset operating levels</h2>
                    <p className="mt-1 text-sm text-[#8fa3ad]">High-level balance across refineries, transport, storage, and distribution.</p>
                  </div>
                  <div className="rounded-full border border-[#4ff0d7]/20 bg-[#4ff0d7]/10 px-3 py-1 text-[10px] uppercase tracking-[0.3em] text-[#4ff0d7]">
                    Live overview
                  </div>
                </div>

                <div className="space-y-4">
                  {chartBars.map((bar) => (
                    <div key={bar.label} className="space-y-2">
                      <div className="flex items-center justify-between text-sm text-[#cbd5e1]">
                        <span>{bar.label}</span>
                        <span className="font-semibold text-[#e8f1f2]">{bar.value}%</span>
                      </div>
                      <div className="h-3 overflow-hidden rounded-full bg-white/5">
                        <div className={`h-full rounded-full ${bar.tone}`} style={{ width: `${bar.value}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <aside className="flex flex-col gap-6">
              <div className="rounded-[28px] border border-white/10 bg-[#07131a]/80 p-5 shadow-[0_0_50px_rgba(0,0,0,0.28)] backdrop-blur">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="font-display text-xl font-semibold">Command center</h2>
                    <p className="mt-1 text-sm text-[#8fa3ad]">Switch between simulation, AI and copilot views.</p>
                  </div>
                  <div className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs uppercase tracking-[0.3em] text-[#8fa3ad]">
                    <LayoutGrid className="mr-2 h-3.5 w-3.5" /> Tabs
                  </div>
                </div>

                <div className="grid gap-2 sm:grid-cols-3">
                  <button
                    type="button"
                    onClick={() => setActiveTab('simulation')}
                    className={`rounded-3xl px-4 py-3 text-left text-sm transition ${
                      activeTab === 'simulation'
                        ? 'border border-[#4ff0d7] bg-[#0f1d31] text-[#e8f1f2] shadow-[0_0_30px_rgba(79,240,215,0.12)]'
                        : 'border border-white/10 bg-[#07131a] text-[#8fa3ad] hover:border-[#4ff0d7]/40'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4" /> Simulator
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('agents')}
                    className={`rounded-3xl px-4 py-3 text-left text-sm transition ${
                      activeTab === 'agents'
                        ? 'border border-[#4ff0d7] bg-[#0f1d31] text-[#e8f1f2] shadow-[0_0_30px_rgba(79,240,215,0.12)]'
                        : 'border border-white/10 bg-[#07131a] text-[#8fa3ad] hover:border-[#4ff0d7]/40'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <Cpu className="h-4 w-4" /> AI Agents
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('copilot')}
                    className={`rounded-3xl px-4 py-3 text-left text-sm transition ${
                      activeTab === 'copilot'
                        ? 'border border-[#4ff0d7] bg-[#0f1d31] text-[#e8f1f2] shadow-[0_0_30px_rgba(79,240,215,0.12)]'
                        : 'border border-white/10 bg-[#07131a] text-[#8fa3ad] hover:border-[#4ff0d7]/40'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <MessageCircle className="h-4 w-4" /> Copilot
                    </span>
                  </button>
                </div>

                <div className="mt-6 space-y-6">
                  {activeTab === 'simulation' && (
                    <div className="space-y-6">
                      <div className="rounded-3xl border border-white/10 bg-[#0c1522]/80 p-5">
                        <div className="mb-4 flex items-center gap-3">
                          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#4ff0d7]/10 text-[#4ff0d7]">
                            <Sparkles className="h-5 w-5" />
                          </div>
                          <div>
                            <h3 className="font-display text-lg font-semibold">Interactive control</h3>
                            <p className="mt-1 text-sm text-[#8fa3ad]">Select a node and run an event simulation from the map module.</p>
                          </div>
                        </div>
                        <div className="rounded-3xl border border-white/10 bg-[#061018]/80 p-4 text-sm text-[#cbd5e1]">
                          Click an infrastructure node on the left panel to preview disruption impact and modify its operating health.
                        </div>
                      </div>

                      <div className="rounded-3xl border border-white/10 bg-[#0c1522]/80 p-5">
                        {selectedNodeData ? (
                          <div className="space-y-4">
                            <div className="flex items-center justify-between text-sm text-[#8fa3ad]">
                              <span className="font-semibold text-[#e8f1f2]">{selectedNodeData.name}</span>
                              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.26em] text-[#8fa3ad]">
                                {selectedNodeData.type}
                              </span>
                            </div>
                            <div className="grid gap-3">
                              <div className="rounded-3xl border border-white/10 bg-[#07101c]/80 p-4 text-sm">
                                <div className="flex items-center justify-between text-[#8fa3ad]">
                                  <span>Operational health</span>
                                  <strong className="text-[#e8f1f2]">{nodeHealth}%</strong>
                                </div>
                                <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/5">
                                  <div className="h-full rounded-full bg-[#4ff0d7]" style={{ width: `${nodeHealth}%` }} />
                                </div>
                              </div>
                              <div className="rounded-3xl border border-white/10 bg-[#07101c]/80 p-4 text-sm">
                                <div className="flex items-center justify-between text-[#8fa3ad]">
                                  <span>Capacity rating</span>
                                  <strong className="text-[#e8f1f2]">{selectedNodeData.capacity}</strong>
                                </div>
                                <p className="mt-3 text-sm text-[#cbd5e1]">Health state: <span className="text-[#4ff0d7]">{healthBadge(nodeHealth)}</span></p>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="rounded-3xl border border-dashed border-white/10 bg-[#06101b]/80 p-6 text-sm text-[#8fa3ad]">
                            Select a node on the left panel to view its details.
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {activeTab === 'agents' && (
                    <div className="space-y-6">
                      <div className="space-y-4">
                        {agentCards.map((agent) => {
                          const Icon = agent.icon
                          return (
                            <div key={agent.title} className="rounded-3xl border border-white/10 bg-[#0c1522]/80 p-5">
                              <div className="flex items-center gap-3">
                                <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${agent.accent}`}>
                                  <Icon className="h-5 w-5" />
                                </div>
                                <div>
                                  <h3 className="font-display text-lg font-semibold text-[#e8f1f2]">{agent.title}</h3>
                                  <p className="text-sm text-[#8fa3ad]">{agent.subtitle}</p>
                                </div>
                              </div>
                              <p className="mt-4 text-sm leading-6 text-[#cbd5e1]">{agent.description}</p>
                              <button
                                type="button"
                                className="mt-5 inline-flex items-center gap-2 rounded-3xl border border-white/10 bg-[#4ff0d7]/10 px-4 py-3 text-sm font-semibold text-[#4ff0d7] transition hover:bg-[#4ff0d7]/15"
                              >
                                <Play className="h-4 w-4" /> Run agent
                              </button>
                            </div>
                          )
                        })}
                      </div>

                      <div className="rounded-3xl border border-white/10 bg-[#07101b]/80 p-5">
                        <div className="mb-4 flex items-center justify-between">
                          <div>
                            <h3 className="font-display text-lg font-semibold text-[#e8f1f2]">Active corridor risk probabilities</h3>
                            <p className="text-sm text-[#8fa3ad]">Latest computed corridor threat levels from the twin model.</p>
                          </div>
                          <span className="rounded-full border border-[#4ff0d7]/20 bg-[#4ff0d7]/10 px-3 py-1 text-[10px] uppercase tracking-[0.3em] text-[#4ff0d7]">
                            Updated
                          </span>
                        </div>
                        <div className="overflow-hidden rounded-3xl border border-white/10 bg-[#08101d]/80">
                          <table className="w-full text-left text-sm text-[#cbd5e1]">
                            <thead className="border-b border-white/10 text-[#8fa3ad]">
                              <tr>
                                <th className="px-4 py-3">Corridor</th>
                                <th className="px-4 py-3">Probability</th>
                                <th className="px-4 py-3">Risk</th>
                              </tr>
                            </thead>
                            <tbody>
                              {corridorRisks.map((row) => (
                                <tr key={row.corridor} className="border-b border-white/10 last:border-0">
                                  <td className="px-4 py-4">{row.corridor}</td>
                                  <td className="px-4 py-4 text-[#e8f1f2]">{row.probability}</td>
                                  <td className="px-4 py-4">
                                    <span
                                      className={`inline-flex rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.24em] ${
                                        row.level === 'High'
                                          ? 'bg-[#f43f5e]/15 text-[#f43f5e]'
                                          : row.level === 'Medium'
                                          ? 'bg-[#f59e0b]/15 text-[#f59e0b]'
                                          : 'bg-[#4ff0d7]/15 text-[#4ff0d7]'
                                      }`}
                                    >
                                      {row.level}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'copilot' && (
                    <div className="space-y-6">
                      <div className="rounded-3xl border border-white/10 bg-[#0c1522]/80 p-5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#4ff0d7]/10 text-[#4ff0d7]">
                            <MessageCircle className="h-5 w-5" />
                          </div>
                          <div>
                            <h3 className="font-display text-lg font-semibold text-[#e8f1f2]">Supply chain AI Copilot</h3>
                            <p className="text-sm text-[#8fa3ad]">Ask questions about route alternatives, refinery status or mitigation actions.</p>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-3xl border border-white/10 bg-[#07101d]/80 p-4">
                        <div className="flex h-[320px] flex-col gap-3 overflow-y-auto rounded-[32px] border border-white/10 bg-[#08101d]/95 p-4 text-sm text-[#cbd5e1]">
                          {messages.map((item) => (
                            <div
                              key={item.id}
                              className={`rounded-3xl p-4 ${
                                item.author === 'assistant'
                                  ? 'bg-[#081827] text-[#cbd5e1]'
                                  : 'self-end bg-[#4ff0d7]/10 text-[#e8f1f2]'
                              }`}
                            >
                              <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.3em] text-[#8fa3ad]">
                                <span>{item.author === 'assistant' ? 'Copilot' : 'You'}</span>
                              </div>
                              <p className="whitespace-pre-line text-sm leading-6">{item.content}</p>
                            </div>
                          ))}
                        </div>

                        <div className="mt-4 flex gap-3">
                          <input
                            value={chatInput}
                            onChange={(event) => setChatInput(event.target.value)}
                            placeholder="Ask about disruption mitigation, route alternatives, or system health..."
                            className="flex-1 rounded-3xl border border-white/10 bg-[#04101b]/90 px-4 py-3 text-sm text-[#e8f1f2] outline-none placeholder:text-[#6b7280]"
                          />
                          <button
                            type="button"
                            onClick={handleSendChat}
                            className="rounded-3xl bg-[#4ff0d7] px-5 py-3 text-sm font-semibold text-[#05070a] transition hover:bg-[#3cc9d4]"
                          >
                            Send
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </aside>
          </div>

          <div className="mt-6 rounded-[32px] border border-white/10 bg-[#07131a]/80 p-6 shadow-[0_0_50px_rgba(0,0,0,0.24)]">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.35em] text-[#4ff0d7]">Threat alert</p>
                <h2 className="mt-2 font-display text-2xl font-semibold">Live risk ticker</h2>
              </div>
              <div className="rounded-full border border-[#4ff0d7]/20 bg-[#4ff0d7]/10 px-3 py-1 text-[10px] uppercase tracking-[0.3em] text-[#4ff0d7]">
                {scenarioOptions.find((option) => option.value === scenario)?.label}
              </div>
            </div>
            <div className="mt-5 rounded-3xl border border-white/10 bg-[#08101d]/80 px-5 py-4 text-sm text-[#cbd5e1]">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-4 w-4 text-[#f59e0b]" />
                <span>{tickerMessage}</span>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
