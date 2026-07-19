import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  BadgeCheck,
  Camera,
  Loader2,
  LogOut,
  Mail,
  Palette,
  RefreshCw,
  Save,
  Shield,
  Trash2,
  Upload,
  UserRound,
  Lock,
} from "lucide-react";
import { API_ENDPOINTS } from "./config/api.js";
import { useTheme } from "./ThemeContext.jsx";

const themeOptions = ["SYSTEM", "LIGHT", "DARK"];

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

function buildProfileForm(user) {
  return {
    name: user?.name || "",
    email: user?.email || "",
    imageUrl: user?.imageUrl || "",
    themePreference: user?.themePreference || "SYSTEM",
  };
}

function buildPasswordForm() {
  return {
    currentPassword: "",
    newPassword: "",
    confirmNewPassword: "",
  };
}

function Field({ label, icon: Icon, children, helper }) {
  return (
    <label className="block">
      <span className="mb-2 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.25em] text-slate-500 dark:text-[#8fa3ad]">
        {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
        {label}
      </span>
      {children}
      {helper ? <span className="mt-2 block text-xs text-slate-400 dark:text-[#5c7078]">{helper}</span> : null}
    </label>
  );
}

export default function Profile({ onLogout }) {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const { resolvedTheme, updateLocalTheme } = useTheme();
  
  const [user, setUser] = useState(() => getStoredUser());
  const [profileForm, setProfileForm] = useState(() => buildProfileForm(getStoredUser()));
  const [passwordForm, setPasswordForm] = useState(() => buildPasswordForm());
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const token = localStorage.getItem("accessToken");
  const isLocalAuth = user?.authProvider === "LOCAL";

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
        setProfileForm(buildProfileForm(nextUser));
        localStorage.setItem("profileUser", JSON.stringify(nextUser));
        
        // Sync theme with the central context on load
        if (nextUser?.themePreference) {
          updateLocalTheme(nextUser.themePreference);
        }
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

  const avatarLabel = (profileForm.name || user?.email || "A").trim().charAt(0).toUpperCase();

  const updateProfileField = (field) => (event) => {
    const value = event.target.value;
    setProfileForm((current) => ({ ...current, [field]: value }));
  };

  const updatePasswordField = (field) => (event) => {
    const value = event.target.value;
    setPasswordForm((current) => ({ ...current, [field]: value }));
  };

  const handleAvatarSelect = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file || !token) {
      return;
    }

    setUploadingAvatar(true);
    setError("");
    setNotice("");

    try {
      const signatureResponse = await fetch(API_ENDPOINTS.USERS.UPLOAD, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        credentials: "include",
      });

      const signatureData = await signatureResponse.json();

      if (!signatureResponse.ok) {
        throw new Error(signatureData.message || "Unable to prepare avatar upload");
      }

      const { uploadUrl, apiKey, timestamp, folder, signature } = signatureData.data;
      const uploadForm = new FormData();
      uploadForm.append("file", file);
      uploadForm.append("api_key", apiKey);
      uploadForm.append("timestamp", String(timestamp));
      uploadForm.append("folder", folder);
      uploadForm.append("signature", signature);

      const uploadResponse = await fetch(uploadUrl, {
        method: "POST",
        body: uploadForm,
      });

      const uploadData = await uploadResponse.json();

      if (!uploadResponse.ok) {
        throw new Error(uploadData.error?.message || "Avatar upload failed");
      }

      const imageUrl = uploadData.secure_url || uploadData.url;
      setProfileForm((current) => ({ ...current, imageUrl }));
      setNotice("Avatar uploaded. Save profile to apply the new image.");
    } catch (uploadError) {
      setError(uploadError.message);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleProfileSave = async (event) => {
    event.preventDefault();
    if (!token) return;

    setSavingProfile(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch(API_ENDPOINTS.USERS.UPDATE, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(profileForm),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Profile update failed");
      }

      setUser(data.user);
      setProfileForm(buildProfileForm(data.user));
      localStorage.setItem("profileUser", JSON.stringify(data.user));
      setNotice("Profile updated successfully.");
      
      // Update central theme context
      if (data.user?.themePreference) {
        updateLocalTheme(data.user.themePreference);
        window.dispatchEvent(new Event("profileUserUpdated"));
      }
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSavingProfile(false);
    }
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
    } catch (passwordError) {
      setError(passwordError.message);
    } finally {
      setSavingPassword(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!token) return;
    const confirmed = window.confirm(
      "Delete your GeoSecure account? This will permanently remove your profile."
    );

    if (!confirmed) {
      return;
    }

    setDeletingAccount(true);
    setError("");

    try {
      const response = await fetch(API_ENDPOINTS.USERS.DELETE, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        credentials: "include",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Account deletion failed");
      }

      await onLogout?.();
      navigate("/login", { replace: true });
    } catch (deleteError) {
      setError(deleteError.message);
    } finally {
      setDeletingAccount(false);
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
            <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
              <div className="max-w-2xl">
                <div className="font-mono text-[10px] uppercase tracking-[0.35em] text-teal-600 dark:text-[#4ff0d7]">Account settings</div>
                <h1 className="mt-3 font-display text-3xl leading-tight text-slate-900 dark:text-[#f4f8f9] sm:text-4xl">
                  Profile
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500 dark:text-[#8fa3ad] sm:text-base">
                  Update the information tied to your GeoSecure account, keep your security details current, and manage your profile photo from one standard settings page.
                </p>
              </div>

              {/* Avatar Box with dynamic theme background */}
              <div className="flex items-center gap-4 rounded-3xl border border-slate-200/80 dark:border-white/10 bg-slate-100/50 dark:bg-black/20 px-4 py-4">
                <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border border-teal-200 dark:border-[#4ff0d7]/25 bg-teal-50 dark:bg-[#4ff0d7]/10 text-2xl font-display text-teal-600 dark:text-[#4ff0d7]">
                  {profileForm.imageUrl ? (
                    <img src={profileForm.imageUrl} alt="Profile" className="h-full w-full object-cover" />
                  ) : (
                    <span>{avatarLabel}</span>
                  )}
                </div>
                <div>
                  <div className="font-display text-lg text-slate-900 dark:text-[#f4f8f9]">{user?.name || "Security operator"}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-[#8fa3ad]">
                    <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 dark:border-white/10 px-2.5 py-1">
                      <Shield className="h-3 w-3 text-teal-600 dark:text-[#4ff0d7]" />
                      {user?.isVerified ? "Verified" : "Pending"}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 dark:border-white/10 px-2.5 py-1">
                      <BadgeCheck className="h-3 w-3 text-amber-600 dark:text-[#ffb454]" />
                      {user?.authProvider || "LOCAL"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Upload preview area with dynamic background */}
            <div className="mt-6 rounded-3xl border border-dashed border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-black/15 p-5">
              <div className="flex items-center gap-4">
                <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/5">
                  {profileForm.imageUrl ? (
                    <img src={profileForm.imageUrl} alt="Profile" className="h-full w-full object-cover" />
                  ) : (
                    <UserRound className="h-10 w-10 text-teal-600/80 dark:text-[#4ff0d7]/80" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center gap-2 rounded-full bg-teal-600 hover:bg-teal-500 dark:bg-[#4ff0d7] px-4 py-2.5 font-mono text-xs font-semibold uppercase tracking-widest text-white dark:text-[#04141c] transition-colors dark:hover:bg-[#7bf5e1]"
                    >
                      <Camera className="h-3.5 w-3.5" />
                      Change photo
                    </button>
                    {uploadingAvatar ? <Loader2 className="h-4 w-4 animate-spin text-teal-600 dark:text-[#4ff0d7]" /> : null}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-[#8fa3ad]">
                    Use a clear profile image to make the account easier to recognize across the app. Uploading a new file will update the preview here.
                  </p>
                </div>
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarSelect} className="hidden" />
            </div>
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="rounded-[32px] border border-slate-200/80 dark:border-white/10 bg-white/70 dark:bg-white/[0.04] p-6 shadow-xl shadow-slate-100/50 dark:shadow-black/20 backdrop-blur-xl lg:p-7">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.35em] text-teal-600 dark:text-[#4ff0d7]">Profile details</div>
                  <h2 className="mt-3 font-display text-2xl text-slate-900 dark:text-[#f4f8f9]">Identity</h2>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const original = buildProfileForm(user);
                    setProfileForm(original);
                    updateLocalTheme(original.themePreference);
                  }}
                  className="rounded-full border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 py-2 font-mono text-[11px] uppercase tracking-widest text-slate-500 dark:text-[#8fa3ad] transition-colors hover:bg-slate-200 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-[#e8f1f2]"
                >
                  Reset
                </button>
              </div>

              <form onSubmit={handleProfileSave} className="mt-6 space-y-5">
                <Field label="Display name" icon={UserRound} helper="Shown across dashboards and notifications.">
                  <input
                    value={profileForm.name}
                    onChange={updateProfileField("name")}
                    className="w-full rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/25 px-4 py-3 text-sm text-slate-800 dark:text-[#e8f1f2] placeholder:text-slate-400 dark:placeholder:text-[#5c7078] outline-none transition-colors focus:border-teal-500 dark:focus:border-[#4ff0d7]/40 focus:ring-2 focus:ring-teal-100 dark:focus:ring-[#4ff0d7]/10"
                    placeholder="Security operator"
                  />
                </Field>

                <Field label="Email address" icon={Mail} helper="Used for sign-in and recovery.">
                  <input
                    type="email"
                    value={profileForm.email}
                    onChange={updateProfileField("email")}
                    className="w-full rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/25 px-4 py-3 text-sm text-slate-800 dark:text-[#e8f1f2] placeholder:text-slate-400 dark:placeholder:text-[#5c7078] outline-none transition-colors focus:border-teal-500 dark:focus:border-[#4ff0d7]/40 focus:ring-2 focus:ring-teal-100 dark:focus:ring-[#4ff0d7]/10"
                    placeholder="security@geosecure.ai"
                  />
                </Field>

                <Field label="Theme preference" icon={Palette} helper="Stored on your account for future theme settings.">
                  <div className="grid grid-cols-3 gap-2 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/25 p-2">
                    {themeOptions.map((themeVal) => {
                      const active = profileForm.themePreference === themeVal;
                      return (
                        <button
                          key={themeVal}
                          type="button"
                          onClick={() => {
                            setProfileForm((current) => ({ ...current, themePreference: themeVal }));
                            updateLocalTheme(themeVal);
                          }}
                          className={`rounded-xl px-3 py-2 font-mono text-xs uppercase tracking-widest transition-colors ${
                            active
                              ? "bg-teal-600 text-white dark:bg-[#4ff0d7] dark:text-[#04141c]"
                              : "text-slate-500 dark:text-[#8fa3ad] hover:bg-slate-200 dark:hover:bg-white/8 hover:text-slate-900 dark:hover:text-[#e8f1f2]"
                          }`}
                        >
                          {themeVal}
                        </button>
                      );
                    })}
                  </div>
                </Field>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={savingProfile}
                    className="inline-flex min-w-40 items-center justify-center gap-2 rounded-full bg-teal-600 hover:bg-teal-500 dark:bg-[#4ff0d7] px-6 py-3 font-mono text-xs font-semibold uppercase tracking-[0.3em] text-white dark:text-[#04141c] transition-colors dark:hover:bg-[#7bf5e1] disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {savingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Save changes
                  </button>
                </div>
              </form>
            </section>

            <section className="rounded-[32px] border border-slate-200/80 dark:border-white/10 bg-white/70 dark:bg-white/[0.04] p-6 shadow-xl shadow-slate-100/50 dark:shadow-black/20 backdrop-blur-xl lg:p-7">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.35em] text-amber-600 dark:text-[#ffb454]">Security</div>
                  <h2 className="mt-3 font-display text-2xl text-slate-900 dark:text-[#f4f8f9]">Password</h2>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-black/20 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.3em] text-slate-500 dark:text-[#8fa3ad]">
                  <Lock className="h-3.5 w-3.5 text-amber-600 dark:text-[#ffb454]" />
                  {isLocalAuth ? "Local account" : "External account"}
                </div>
              </div>

              <form onSubmit={handlePasswordSave} className="mt-6 space-y-5">
                {isLocalAuth ? (
                  <Field label="Current password" icon={Lock}>
                    <input
                      type="password"
                      value={passwordForm.currentPassword}
                      onChange={updatePasswordField("currentPassword")}
                      className="w-full rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/25 px-4 py-3 text-sm text-slate-800 dark:text-[#e8f1f2] placeholder:text-slate-400 dark:placeholder:text-[#5c7078] outline-none transition-colors focus:border-amber-500 dark:focus:border-[#ffb454]/40 focus:ring-2 focus:ring-amber-100 dark:focus:ring-[#ffb454]/10"
                      placeholder="Enter current password"
                    />
                  </Field>
                ) : (
                  <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-black/20 p-4 text-sm leading-6 text-slate-500 dark:text-[#8fa3ad]">
                    Password changes are managed by your external identity provider.
                  </div>
                )}

                <Field label="New password" icon={Shield}>
                  <input
                    type="password"
                    value={passwordForm.newPassword}
                    onChange={updatePasswordField("newPassword")}
                    className="w-full rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/25 px-4 py-3 text-sm text-slate-800 dark:text-[#e8f1f2] placeholder:text-slate-400 dark:placeholder:text-[#5c7078] outline-none transition-colors focus:border-amber-500 dark:focus:border-[#ffb454]/40 focus:ring-2 focus:ring-amber-100 dark:focus:ring-[#ffb454]/10"
                    placeholder="At least 8 characters"
                  />
                </Field>

                <Field label="Confirm new password" icon={Shield}>
                  <input
                    type="password"
                    value={passwordForm.confirmNewPassword}
                    onChange={updatePasswordField("confirmNewPassword")}
                    className="w-full rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/25 px-4 py-3 text-sm text-slate-800 dark:text-[#e8f1f2] placeholder:text-slate-400 dark:placeholder:text-[#5c7078] outline-none transition-colors focus:border-amber-500 dark:focus:border-[#ffb454]/40 focus:ring-2 focus:ring-amber-100 dark:focus:ring-[#ffb454]/10"
                    placeholder="Repeat new password"
                  />
                </Field>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={savingPassword}
                    className="inline-flex min-w-40 items-center justify-center gap-2 rounded-full border border-amber-500/35 bg-amber-50 dark:bg-[#ffb454]/10 px-6 py-3 font-mono text-xs font-semibold uppercase tracking-[0.3em] text-amber-700 dark:text-[#ffcf93] transition-colors hover:bg-amber-100 dark:hover:bg-[#ffb454]/18 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {savingPassword ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Update password
                  </button>
                </div>
              </form>
            </section>

            <section className="rounded-[32px] border border-red-200 dark:border-red-500/20 bg-red-50/80 dark:bg-red-500/8 p-6 shadow-xl shadow-red-100/30 dark:shadow-black/20 backdrop-blur-xl lg:p-7 lg:col-span-2">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.35em] text-red-500 dark:text-red-300">Danger zone</div>
                  <h2 className="mt-3 font-display text-2xl text-slate-900 dark:text-[#f4f8f9]">Delete account</h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-[#c9b7b7]">
                    This permanently removes your profile and cannot be undone.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleDeleteAccount}
                  disabled={deletingAccount}
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-red-300 dark:border-red-500/30 bg-red-100 dark:bg-red-500/15 px-6 py-3 font-mono text-xs font-semibold uppercase tracking-[0.3em] text-red-700 dark:text-red-200 transition-colors hover:bg-red-200 dark:hover:bg-red-500/25 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {deletingAccount ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  Delete account
                </button>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}