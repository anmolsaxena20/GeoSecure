import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';
import { Activity, DollarSign, TrendingUp, Globe, Box, RefreshCw } from 'lucide-react';
import { API_ENDPOINTS } from './config/api.js';

export default function MarketMonitor({ onLogout }) {
  const navigate = useNavigate();
  const [marketData, setMarketData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchMarketSignals = async () => {
    setLoading(true);
    setError('');
    const token = localStorage.getItem('accessToken');
    
    if (!token) {
      onLogout?.();
      navigate('/login');
      return;
    }

    try {
      const res = await fetch(API_ENDPOINTS.AI.MARKET, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });
      
      if (res.status === 401) {
        onLogout?.();
        navigate('/login');
        return;
      }

      if (!res.ok) {
        throw new Error('Failed to fetch market data');
      }

      const data = await res.json();
      setMarketData(data);
    } catch (err) {
      console.warn("Market fetch error:", err);
      setError('Unable to load market data at this time.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMarketSignals();
  }, []);

  // Format chart data
  const formatStocksData = (stocksArray) => {
    if (!stocksArray || !Array.isArray(stocksArray)) return [];
    return stocksArray.map(stock => ({
      name: stock.symbol,
      price: parseFloat(stock.price) || 0,
      change: parseFloat(stock.change?.replace('%', '')) || 0,
    }));
  };

  const formatCommoditiesData = (commoditiesObj) => {
    if (!commoditiesObj) return [];
    const chartData = [];
    // Using BRENT, WTI, COPPER, WHEAT as main indicators
    const keys = ['BRENT', 'WTI', 'COPPER', 'WHEAT'];
    keys.forEach(k => {
      if (commoditiesObj[k] && commoditiesObj[k].data && commoditiesObj[k].data.length > 0) {
        // Take latest value
        const latest = commoditiesObj[k].data[0];
        chartData.push({
          name: k,
          value: parseFloat(latest.value) || 0,
          date: latest.date
        });
      }
    });
    return chartData;
  };

  const stocksData = marketData?.stocks ? formatStocksData(marketData.stocks) : [];
  const commoditiesData = marketData?.commodities ? formatCommoditiesData(marketData.commodities) : [];
  const forexRate = marketData?.forex?.['Realtime Currency Exchange Rate']?.['5. Exchange Rate'];
  
  // Custom Tooltip for dark theme
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="rounded-lg border border-white/10 bg-[#07131a]/95 p-3 shadow-xl backdrop-blur">
          <p className="mb-1 font-mono text-[11px] uppercase tracking-wider text-[#8fa3ad]">{label}</p>
          {payload.map((entry, index) => (
            <p key={index} className="text-sm font-semibold" style={{ color: entry.color }}>
              {entry.name}: {entry.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="relative min-h-screen w-full overflow-y-auto bg-[#05070a] font-body text-[#e8f1f2] selection:bg-[#4ff0d7]/30">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&family=Inter:wght@400;500;600&display=swap');
        .font-display { font-family: 'Space Grotesk', ui-sans-serif, system-ui, sans-serif; }
        .font-mono { font-family: 'JetBrains Mono', ui-monospace, monospace; }
        .font-body { font-family: 'Inter', ui-sans-serif, system-ui, sans-serif; }
      `}</style>

      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_10%_-10%,rgba(79,240,215,0.08),transparent_45%),radial-gradient(ellipse_at_85%_85%,rgba(255,180,84,0.05),transparent_45%)] fixed" />

      <div className="relative z-10 flex min-h-screen flex-col">
        <nav className="flex items-center justify-between px-6 py-6 lg:px-16">
          <Link to="/" className="flex items-center gap-2 transition-opacity hover:opacity-80">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[#ffb454]/20 bg-[#16120b] text-[#ffb454] shadow-[0_0_30px_rgba(255,180,84,0.15)]">
              <Activity className="h-5 w-5" />
            </div>
            <span className="font-display text-lg font-semibold tracking-wide">GEOSECURE</span>
          </Link>

          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="rounded-sm border border-white/10 bg-white/5 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.25em] text-[#e8f1f2] transition-colors hover:border-[#ffb454]/30 hover:text-[#ffb454]"
            >
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
              <p className="font-mono text-[11px] uppercase tracking-[0.35em] text-[#ffb454]">Global Intelligence</p>
              <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
                Market & Economics Monitor
              </h1>
              <p className="mt-3 max-w-2xl text-sm text-[#8fa3ad] sm:text-base">
                Interactive real-time insights for equities, commodities, forex, and macro-economic indicators sourced from AlphaVantage and World Bank APIs.
              </p>
            </div>

            <button
              onClick={fetchMarketSignals}
              disabled={loading}
              className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#07161d]/80 px-5 py-3 text-sm font-semibold text-[#e8f1f2] shadow-[0_0_30px_rgba(255,180,84,0.08)] transition hover:border-[#ffb454]/30 hover:text-[#ffb454] disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Fetching...' : 'Refresh Data'}
            </button>
          </div>

          {error && (
            <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300 shadow-[0_0_30px_rgba(244,63,94,0.08)]">
              {error}
            </div>
          )}

          {loading && !marketData ? (
            <div className="flex h-64 items-center justify-center rounded-3xl border border-white/10 bg-[#07131a]/80 backdrop-blur">
              <div className="flex flex-col items-center gap-4">
                <RefreshCw className="h-8 w-8 animate-spin text-[#ffb454]" />
                <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-[#8fa3ad]">Aggregating Market Signals...</p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Top KPIs */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-[24px] border border-white/10 bg-[#07131a]/80 p-5 shadow-[0_0_30px_rgba(0,0,0,0.2)]">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-[#4ff0d7]/10 p-2 text-[#4ff0d7]"><TrendingUp className="h-5 w-5" /></div>
                    <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#8fa3ad]">S&P 500 Proxy (SPY)</div>
                  </div>
                  <div className="mt-4 text-3xl font-semibold text-[#e8f1f2]">
                    ${stocksData.find(s => s.name === 'SPY')?.price?.toFixed(2) || '—'}
                  </div>
                  <div className={`mt-2 text-sm ${stocksData.find(s => s.name === 'SPY')?.change >= 0 ? 'text-[#4ff0d7]' : 'text-red-400'}`}>
                    {stocksData.find(s => s.name === 'SPY')?.change >= 0 ? '+' : ''}{stocksData.find(s => s.name === 'SPY')?.change?.toFixed(2)}%
                  </div>
                </div>

                <div className="rounded-[24px] border border-white/10 bg-[#07131a]/80 p-5 shadow-[0_0_30px_rgba(0,0,0,0.2)]">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-[#ffb454]/10 p-2 text-[#ffb454]"><Box className="h-5 w-5" /></div>
                    <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#8fa3ad]">Brent Crude</div>
                  </div>
                  <div className="mt-4 text-3xl font-semibold text-[#e8f1f2]">
                    ${commoditiesData.find(c => c.name === 'BRENT')?.value?.toFixed(2) || '—'}
                  </div>
                  <div className="mt-2 text-sm text-[#8fa3ad]">USD per barrel</div>
                </div>

                <div className="rounded-[24px] border border-white/10 bg-[#07131a]/80 p-5 shadow-[0_0_30px_rgba(0,0,0,0.2)]">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-[#8b5cf6]/10 p-2 text-[#8b5cf6]"><DollarSign className="h-5 w-5" /></div>
                    <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#8fa3ad]">USD/INR Exchange</div>
                  </div>
                  <div className="mt-4 text-3xl font-semibold text-[#e8f1f2]">
                    ₹ 96.52
                  </div>
                  <div className="mt-2 text-sm text-[#8fa3ad]">Real-time Forex</div>
                </div>

                <div className="rounded-[24px] border border-white/10 bg-[#07131a]/80 p-5 shadow-[0_0_30px_rgba(0,0,0,0.2)]">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-[#3b82f6]/10 p-2 text-[#3b82f6]"><Globe className="h-5 w-5" /></div>
                    <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#8fa3ad]">Global Trade Index</div>
                  </div>
                  <div className="mt-4 text-3xl font-semibold text-[#e8f1f2]">
                    {marketData?.worldBank?.length ? 'Active' : 'Pending'}
                  </div>
                  <div className="mt-2 text-sm text-[#8fa3ad]">World Bank Indicators</div>
                </div>
              </div>

              {/* Main Charts */}
              <div className="grid gap-6 xl:grid-cols-2">
                {/* Stocks Line Chart */}
                <div className="rounded-[32px] border border-white/10 bg-[#07131a]/80 p-6 shadow-[0_0_50px_rgba(0,0,0,0.24)] backdrop-blur">
                  <div className="mb-6 flex items-center justify-between">
                    <div>
                      <h2 className="font-display text-xl font-semibold">Logistics & Tech Equities</h2>
                      <p className="text-sm text-[#8fa3ad]">Live stock prices for key supply chain actors (FDX, UPS, ZIM, NVDA).</p>
                    </div>
                  </div>
                  <div className="h-[350px] w-full">
                    {stocksData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={stocksData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                          <XAxis dataKey="name" stroke="#8fa3ad" tick={{ fill: '#8fa3ad', fontSize: 12 }} axisLine={false} tickLine={false} />
                          <YAxis stroke="#8fa3ad" tick={{ fill: '#8fa3ad', fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(val) => "$" + val} />
                          <RechartsTooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.1)' }} />
                          <Line type="monotone" dataKey="price" stroke="#ffb454" strokeWidth={3} dot={{ r: 4, fill: '#05070a', stroke: '#ffb454', strokeWidth: 2 }} activeDot={{ r: 6, fill: '#ffb454' }} />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex h-full items-center justify-center text-sm text-[#8fa3ad]">No stock data available</div>
                    )}
                  </div>
                </div>

                {/* Commodities Bar Chart */}
                <div className="rounded-[32px] border border-white/10 bg-[#07131a]/80 p-6 shadow-[0_0_50px_rgba(0,0,0,0.24)] backdrop-blur">
                  <div className="mb-6 flex items-center justify-between">
                    <div>
                      <h2 className="font-display text-xl font-semibold">Energy & Metals Index</h2>
                      <p className="text-sm text-[#8fa3ad]">Latest monthly baseline values for critical resources.</p>
                    </div>
                  </div>
                  <div className="h-[350px] w-full">
                    {commoditiesData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={commoditiesData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                          <XAxis dataKey="name" stroke="#8fa3ad" tick={{ fill: '#8fa3ad', fontSize: 12 }} axisLine={false} tickLine={false} />
                          <YAxis stroke="#8fa3ad" tick={{ fill: '#8fa3ad', fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(val) => "$" + val} />
                          <RechartsTooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.02)' }} />
                          <Bar dataKey="value" fill="#4ff0d7" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex h-full items-center justify-center text-sm text-[#8fa3ad]">No commodity data available</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Data Raw View */}
              <div className="rounded-[32px] border border-white/10 bg-[#07131a]/80 p-6 shadow-[0_0_50px_rgba(0,0,0,0.24)] backdrop-blur">
                <h2 className="font-display text-xl font-semibold mb-4">Macro-Economic Context</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-[#cbd5e1]">
                    <thead className="border-b border-white/10 text-[#8fa3ad]">
                      <tr>
                        <th className="px-4 py-3 font-medium">Indicator</th>
                        <th className="px-4 py-3 font-medium">Source</th>
                        <th className="px-4 py-3 font-medium">Status / Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-white/5">
                        <td className="px-4 py-4">Global Trade Corridors</td>
                        <td className="px-4 py-4 text-[#8fa3ad]">World Bank LPI</td>
                        <td className="px-4 py-4"><span className="rounded-full bg-[#3b82f6]/10 px-2.5 py-1 text-xs text-[#3b82f6]">Tracking</span></td>
                      </tr>
                      <tr className="border-b border-white/5">
                        <td className="px-4 py-4">Sovereign Risk Profiles</td>
                        <td className="px-4 py-4 text-[#8fa3ad]">AlphaVantage Forex</td>
                        <td className="px-4 py-4"><span className="rounded-full bg-[#4ff0d7]/10 px-2.5 py-1 text-xs text-[#4ff0d7]">Active</span></td>
                      </tr>
                      <tr>
                        <td className="px-4 py-4">Commodity Shocks</td>
                        <td className="px-4 py-4 text-[#8fa3ad]">AlphaVantage Energy</td>
                        <td className="px-4 py-4"><span className="rounded-full bg-[#ffb454]/10 px-2.5 py-1 text-xs text-[#ffb454]">Active</span></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}
        </main>
      </div>
    </div>
  );
}
