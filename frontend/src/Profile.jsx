import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AlertTriangle, Loader2, LogOut, Mail, Lock, Save, UserRound } from "lucide-react";
import { API_ENDPOINTS } from "./config/api.js";

function CrosshairMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="text-teal-600 dark:text-[#4ff0d7]">
      <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.2" />
      <path d="M10 1V5M10 15V19M1 10H5M15 10H19" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="10" cy="10" r="1.4" fill="currentColor" />
    </svg>
  );
}

function getStoredUser() {
  try {
    const raw = localStorage.getItem("profileUser");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function buildPasswordForm() {
  return {
    currentPassword: "",
    newPassword: "",
    confirmNewPassword: "",
  };
}

export default function Profile({ onLogout }) {
  const navigate = useNavigate();
  const [user, setUser] = useState(() => getStoredUser());
  const [passwordForm, setPasswordForm] = useState(() => buildPasswordForm());
  const [loading, setLoading] = useState(true);
  const [savingPassword, setSavingPassword] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [showPasswordForm, setShowPasswordForm] = useState(false);

  const token = localStorage.getItem("accessToken");

  useEffect(() => {
    if (!token) {
      navigate("/login", { replace: true });
      return;
    }

    const loadProfile = async () => {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(API_ENDPOINTS.USERS.PROFILE, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          credentials: "include",
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || "Unable to load profile");
        }

        const nextUser = data.user;
        setUser(nextUser);
        localStorage.setItem("profileUser", JSON.stringify(nextUser));
      } catch (loadError) {
        setError(loadError.message);
        if (loadError.message === "Unauthorized") {
          await onLogout?.();
          navigate("/login", { replace: true });
        }
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [navigate, onLogout, token]);

  const updatePasswordField = (field) => (event) => {
    const value = event.target.value;
    setPasswordForm((current) => ({ ...current, [field]: value }));
  };

  const handlePasswordSave = async (event) => {
    event.preventDefault();
    if (!token) return;

    if (passwordForm.newPassword !== passwordForm.confirmNewPassword) {
      setError("New passwords do not match");
      return;
    }

    setSavingPassword(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch(API_ENDPOINTS.USERS.PASSWORD, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(passwordForm),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Password update failed");
      }

      setPasswordForm(buildPasswordForm());
      setNotice("Password updated successfully.");
      setShowPasswordForm(false);
    } catch (passwordError) {
      setError(passwordError.message);
    } finally {
      setSavingPassword(false);
    }
  };

  const handleLogout = async () => {
    await onLogout?.();
    navigate("/login", { replace: true });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#05070a] flex items-center justify-center font-mono uppercase tracking-[0.35em] text-teal-600 dark:text-[#4ff0d7]">
        <Loader2 className="mr-3 h-5 w-5 animate-spin" />
        Loading profile
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-50 dark:bg-[#05070a] text-slate-800 dark:text-[#e8f1f2] selection:bg-teal-500/30 dark:selection:bg-[#4ff0d7]/30 transition-colors duration-300">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&family=Inter:wght@400;500;600&display=swap');
        .font-display { font-family: 'Space Grotesk', ui-sans-serif, system-ui, sans-serif; }
        .font-mono { font-family: 'JetBrains Mono', ui-monospace, monospace; }
        .font-body { font-family: 'Inter', ui-sans-serif, system-ui, sans-serif; }
      `}</style>

      {/* Background gradients that adapt to the theme */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(13,148,136,0.08),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(217,119,6,0.06),transparent_40%)] dark:bg-[radial-gradient(circle_at_top_left,rgba(79,240,215,0.1),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(255,180,84,0.08),transparent_40%),linear-gradient(180deg,rgba(255,255,255,0.02),transparent_40%)]" />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-5xl flex-col px-6 py-6 lg:px-8">
        <nav className="flex items-center justify-between gap-4 border-b border-slate-200 dark:border-white/10 pb-5">
          <Link to="/" className="flex items-center gap-2 transition-opacity hover:opacity-80">
            <CrosshairMark />
            <span className="font-display text-lg font-semibold tracking-wide text-slate-900 dark:text-[#e8f1f2]">GEOSECURE</span>
          </Link>

          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="rounded-full border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 py-2 font-mono text-xs uppercase tracking-widest text-slate-500 dark:text-[#8fa3ad] transition-colors hover:bg-slate-200 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-[#e8f1f2]"
            >
              Back home
            </Link>
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-2 rounded-full border border-red-500/30 bg-red-500/10 px-4 py-2 font-mono text-xs uppercase tracking-widest text-red-600 dark:text-red-300 transition-colors hover:bg-red-500/20 hover:border-red-400/50"
            >
              <LogOut className="h-3.5 w-3.5" />
              Logout
            </button>
          </div>
        </nav>

        <div className="mt-8 flex flex-col gap-6">
          {error ? (
            <div className="flex items-start gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-700 dark:text-red-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}

          {notice ? (
            <div className="rounded-2xl border border-teal-500/30 bg-teal-50 dark:bg-[#4ff0d7]/10 p-4 text-sm text-teal-800 dark:text-[#bdf8ef]">
              {notice}
            </div>
          ) : null}

          <section className="rounded-[32px] border border-slate-200/80 dark:border-white/10 bg-white/70 dark:bg-white/[0.04] p-6 shadow-xl shadow-slate-100/50 dark:shadow-black/20 backdrop-blur-xl lg:p-8">
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div className="max-w-2xl">
                <div className="font-mono text-[10px] uppercase tracking-[0.35em] text-teal-600 dark:text-[#4ff0d7]">Account</div>
                <h1 className="mt-3 font-display text-3xl leading-tight text-slate-900 dark:text-[#f4f8f9] sm:text-4xl">
                  Profile
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500 dark:text-[#8fa3ad] sm:text-base">
                  View your name and email, then update your password when needed.
                </p>
              </div>

              <div className="flex items-center gap-4 rounded-3xl border border-slate-200 dark:border-white/10 bg-slate-50/90 dark:bg-black/20 px-4 py-4">
                <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border border-teal-200 dark:border-[#4ff0d7]/20 bg-teal-50 dark:bg-[#4ff0d7]/10 text-2xl font-display text-teal-600 dark:text-[#4ff0d7]">
                  {user?.imageUrl ? (
                    <img
                      src={user.imageUrl}
                      alt="Profile"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span>{(user?.name || user?.email || "A").trim().charAt(0).toUpperCase()}</span>
                  )}
                </div>
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-slate-400 dark:text-[#8fa3ad]">Picture</div>
                  <div className="mt-1 font-display text-lg text-slate-900 dark:text-[#e8f1f2]">
                    {user?.imageUrl ? "Profile photo" : "Initial avatar"}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/25 p-4">
                <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-slate-400 dark:text-[#8fa3ad]">Name</div>
                <div className="mt-2 flex items-center gap-3 text-slate-900 dark:text-[#e8f1f2]">
                  <UserRound className="h-4 w-4 text-teal-600 dark:text-[#4ff0d7]" />
                  <span className="font-display text-lg">{user?.name || "Security operator"}</span>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/25 p-4">
                <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-slate-400 dark:text-[#8fa3ad]">Email</div>
                <div className="mt-2 flex items-center gap-3 text-slate-900 dark:text-[#e8f1f2]">
                  <Mail className="h-4 w-4 text-teal-600 dark:text-[#4ff0d7]" />
                  <span className="font-display text-lg break-all">{user?.email || "-"}</span>
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setShowPasswordForm((current) => !current)}
                className="inline-flex items-center gap-2 rounded-full bg-teal-600 hover:bg-teal-500 dark:bg-[#4ff0d7] px-5 py-3 font-mono text-xs font-semibold uppercase tracking-[0.3em] text-white dark:text-[#04141c] transition-colors dark:hover:bg-[#7bf5e1]"
              >
                <Lock className="h-4 w-4" />
                Change password
              </button>
            </div>

            {showPasswordForm && (
              <form onSubmit={handlePasswordSave} className="mt-6 space-y-4 rounded-3xl border border-slate-200 dark:border-white/10 bg-slate-50/70 dark:bg-black/20 p-5">
                <div className="font-mono text-[10px] uppercase tracking-[0.35em] text-amber-600 dark:text-[#ffb454]">Update password</div>
                <div className="grid gap-4 md:grid-cols-3">
                  <label className="block">
                    <span className="mb-2 block font-mono text-[11px] uppercase tracking-[0.25em] text-slate-500 dark:text-[#8fa3ad]">Current password</span>
                    <input
                      type="password"
                      value={passwordForm.currentPassword}
                      onChange={updatePasswordField("currentPassword")}
                      className="w-full rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-black/25 px-4 py-3 text-sm text-slate-800 dark:text-[#e8f1f2] outline-none transition-colors focus:border-amber-500 dark:focus:border-[#ffb454]/40"
                      placeholder="Current password"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block font-mono text-[11px] uppercase tracking-[0.25em] text-slate-500 dark:text-[#8fa3ad]">New password</span>
                    <input
                      type="password"
                      value={passwordForm.newPassword}
                      onChange={updatePasswordField("newPassword")}
                      className="w-full rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-black/25 px-4 py-3 text-sm text-slate-800 dark:text-[#e8f1f2] outline-none transition-colors focus:border-amber-500 dark:focus:border-[#ffb454]/40"
                      placeholder="New password"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block font-mono text-[11px] uppercase tracking-[0.25em] text-slate-500 dark:text-[#8fa3ad]">Confirm password</span>
                    <input
                      type="password"
                      value={passwordForm.confirmNewPassword}
                      onChange={updatePasswordField("confirmNewPassword")}
                      className="w-full rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-black/25 px-4 py-3 text-sm text-slate-800 dark:text-[#e8f1f2] outline-none transition-colors focus:border-amber-500 dark:focus:border-[#ffb454]/40"
                      placeholder="Confirm password"
                    />
                  </label>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowPasswordForm(false)}
                    className="rounded-full border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-5 py-3 font-mono text-xs uppercase tracking-[0.25em] text-slate-500 dark:text-[#8fa3ad] transition-colors hover:bg-slate-100 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-[#e8f1f2]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingPassword}
                    className="inline-flex items-center gap-2 rounded-full border border-amber-500/35 bg-amber-50 dark:bg-[#ffb454]/10 px-5 py-3 font-mono text-xs font-semibold uppercase tracking-[0.3em] text-amber-700 dark:text-[#ffcf93] transition-colors hover:bg-amber-100 dark:hover:bg-[#ffb454]/18 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {savingPassword ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Save password
                  </button>
                </div>
              </form>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}