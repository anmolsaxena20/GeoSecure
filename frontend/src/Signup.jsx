import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";

/**
 * GeoSecure Sign Up Page
 * Matches the geospatial security theme with cyan, amber, and deep space aesthetics
 */

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

const Signup = ({ onSignupSuccess }) => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
    agreeTerms: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const validateForm = () => {
    if (!formData.firstName.trim()) {
      setError("First name is required");
      return false;
    }
    if (!formData.email.trim()) {
      setError("Email is required");
      return false;
    }
    if (!formData.password.trim()) {
      setError("Password is required");
      return false;
    }
    if (formData.password.length < 8) {
      setError("Password must be at least 8 characters long");
      return false;
    }
    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return false;
    }
    if (!formData.agreeTerms) {
      setError("You must agree to Terms of Service and Privacy Policy");
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("http://localhost:3000/api/auth/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          password: formData.password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Sign up failed");
      }

      // Store token if provided
      if (data.accessToken) {
        localStorage.setItem("accessToken", data.accessToken);
      }

      // Call success callback
      if (onSignupSuccess) {
        onSignupSuccess(data);
      }

      // Redirect to home
      navigate("/");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignup = () => {
    window.location.href = "http://localhost:3000/api/auth/google";
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#05070a] font-body text-[#e8f1f2] selection:bg-[#4ff0d7]/30">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&family=Inter:wght@400;500;600&display=swap');
        .font-display { font-family: 'Space Grotesk', ui-sans-serif, system-ui, sans-serif; }
        .font-mono { font-family: 'JetBrains Mono', ui-monospace, monospace; }
        .font-body { font-family: 'Inter', ui-sans-serif, system-ui, sans-serif; }
      `}</style>

      {/* Vignette / color grade */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_-10%,rgba(79,240,215,0.08),transparent_60%),radial-gradient(ellipse_at_85%_85%,rgba(255,180,84,0.05),transparent_50%)]" />

      {/* Foreground content */}
      <div className="relative z-10 flex min-h-screen flex-col">
        {/* Nav */}
        <nav className="flex items-center justify-between px-6 py-6 lg:px-16">
          <Link to="/" className="flex items-center gap-2 transition-opacity hover:opacity-80">
            <CrosshairMark />
            <span className="font-display text-lg font-semibold tracking-wide">
              GEOSECURE
            </span>
          </Link>
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
            <Link to="/" className="font-mono text-xs uppercase tracking-widest text-[#8fa3ad] transition-colors hover:text-[#e8f1f2]">
              Back to home
            </Link>
          </div>
        </nav>

        {/* Signup form container */}
        <main className="flex flex-1 items-center justify-center px-6 py-8 lg:px-16">
          <div className="w-full max-w-md">
            {/* Header */}
            <div className="mb-8 text-center">
              <div className="mb-4 flex justify-center">
                <svg
                  width="48"
                  height="48"
                  viewBox="0 0 100 100"
                  xmlns="http://www.w3.org/2000/svg"
                  className="text-[#ffb454]"
                >
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    opacity="0.3"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="35"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1"
                    opacity="0.2"
                  />
                  <circle cx="50" cy="20" r="2.5" fill="currentColor" />
                  <circle cx="75" cy="40" r="2" fill="currentColor" />
                  <circle cx="70" cy="65" r="2.5" fill="currentColor" />
                  <circle cx="40" cy="75" r="2" fill="currentColor" />
                  <circle cx="20" cy="55" r="2.5" fill="currentColor" />
                  <circle cx="35" cy="30" r="2" fill="currentColor" />
                  <line
                    x1="50"
                    y1="20"
                    x2="75"
                    y2="40"
                    stroke="currentColor"
                    strokeWidth="0.8"
                    opacity="0.5"
                  />
                  <line
                    x1="75"
                    y1="40"
                    x2="70"
                    y2="65"
                    stroke="currentColor"
                    strokeWidth="0.8"
                    opacity="0.5"
                  />
                  <line
                    x1="70"
                    y1="65"
                    x2="40"
                    y2="75"
                    stroke="currentColor"
                    strokeWidth="0.8"
                    opacity="0.5"
                  />
                  <line
                    x1="40"
                    y1="75"
                    x2="20"
                    y2="55"
                    stroke="currentColor"
                    strokeWidth="0.8"
                    opacity="0.5"
                  />
                </svg>
              </div>
              <h1 className="font-display text-3xl font-semibold tracking-tight">
                Join GeoSecure
              </h1>
              <p className="mt-2 font-mono text-xs uppercase tracking-[0.3em] text-[#ffb454]">
                Geospatial Intelligence Platform
              </p>
            </div>

            {/* Error message */}
            {error && (
              <div className="mb-6 rounded-sm border border-red-500/30 bg-red-500/10 px-4 py-3 font-mono text-sm text-red-400">
                <div className="flex items-center gap-2">
                  <span>⚠</span>
                  <span>{error}</span>
                </div>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* First Name */}
              <div>
                <label htmlFor="firstName" className="block font-mono text-xs uppercase tracking-widest text-[#8fa3ad]">
                  First Name *
                </label>
                <input
                  id="firstName"
                  type="text"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  placeholder="John"
                  className="mt-2 w-full rounded-sm border border-white/10 bg-white/5 px-4 py-3 font-mono text-sm text-[#e8f1f2] placeholder:text-[#5c7078] transition-colors focus:border-[#ffb454]/40 focus:bg-white/8 focus:outline-none focus:ring-1 focus:ring-[#ffb454]/20"
                  required
                  disabled={loading}
                />
              </div>

              {/* Last Name */}
              <div>
                <label htmlFor="lastName" className="block font-mono text-xs uppercase tracking-widest text-[#8fa3ad]">
                  Last Name
                </label>
                <input
                  id="lastName"
                  type="text"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  placeholder="Doe"
                  className="mt-2 w-full rounded-sm border border-white/10 bg-white/5 px-4 py-3 font-mono text-sm text-[#e8f1f2] placeholder:text-[#5c7078] transition-colors focus:border-[#ffb454]/40 focus:bg-white/8 focus:outline-none focus:ring-1 focus:ring-[#ffb454]/20"
                  disabled={loading}
                />
              </div>

              {/* Email */}
              <div>
                <label htmlFor="email" className="block font-mono text-xs uppercase tracking-widest text-[#8fa3ad]">
                  Email Address *
                </label>
                <input
                  id="email"
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="security@geosecure.ai"
                  className="mt-2 w-full rounded-sm border border-white/10 bg-white/5 px-4 py-3 font-mono text-sm text-[#e8f1f2] placeholder:text-[#5c7078] transition-colors focus:border-[#ffb454]/40 focus:bg-white/8 focus:outline-none focus:ring-1 focus:ring-[#ffb454]/20"
                  required
                  disabled={loading}
                />
              </div>

              {/* Password */}
              <div>
                <label htmlFor="password" className="block font-mono text-xs uppercase tracking-widest text-[#8fa3ad]">
                  Password *
                </label>
                <div className="relative mt-2">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="••••••••"
                    className="w-full rounded-sm border border-white/10 bg-white/5 px-4 py-3 font-mono text-sm text-[#e8f1f2] placeholder:text-[#5c7078] transition-colors focus:border-[#ffb454]/40 focus:bg-white/8 focus:outline-none focus:ring-1 focus:ring-[#ffb454]/20"
                    required
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={loading}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#ffb454]/60 transition-colors hover:text-[#ffb454] disabled:opacity-50"
                  >
                    {showPassword ? "🙈" : "👁"}
                  </button>
                </div>
                <p className="mt-1 font-mono text-xs text-[#5c7078]">
                  Minimum 8 characters
                </p>
              </div>

              {/* Confirm Password */}
              <div>
                <label htmlFor="confirmPassword" className="block font-mono text-xs uppercase tracking-widest text-[#8fa3ad]">
                  Confirm Password *
                </label>
                <div className="relative mt-2">
                  <input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    placeholder="••••••••"
                    className="w-full rounded-sm border border-white/10 bg-white/5 px-4 py-3 font-mono text-sm text-[#e8f1f2] placeholder:text-[#5c7078] transition-colors focus:border-[#ffb454]/40 focus:bg-white/8 focus:outline-none focus:ring-1 focus:ring-[#ffb454]/20"
                    required
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    disabled={loading}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#ffb454]/60 transition-colors hover:text-[#ffb454] disabled:opacity-50"
                  >
                    {showConfirmPassword ? "🙈" : "👁"}
                  </button>
                </div>
              </div>

              {/* Terms & Conditions */}
              <div className="pt-2">
                <label className="flex items-start gap-3 font-mono text-xs text-[#8fa3ad] transition-colors hover:text-[#e8f1f2] cursor-pointer">
                  <input
                    type="checkbox"
                    name="agreeTerms"
                    checked={formData.agreeTerms}
                    onChange={handleChange}
                    className="mt-1 rounded border-[#ffb454]/30 bg-white/5 accent-[#ffb454]"
                    required
                    disabled={loading}
                  />
                  <span>
                    I agree to the{" "}
                    <a href="#terms" className="text-[#ffb454] hover:underline">
                      Terms of Service
                    </a>
                    {" "}and{" "}
                    <a href="#privacy" className="text-[#ffb454] hover:underline">
                      Privacy Policy
                    </a>
                    *
                  </span>
                </label>
              </div>

              {/* Sign Up Button */}
              <button
                type="submit"
                disabled={loading}
                className="mt-6 w-full rounded-sm bg-[#ffb454] px-6 py-3 font-mono text-xs font-semibold uppercase tracking-widest text-[#04141c] transition-colors hover:bg-[#ffc876] disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Creating Account...</span>
                  </>
                ) : (
                  <>
                    <span>Create Account</span>
                    <span>→</span>
                  </>
                )}
              </button>
            </form>

            {/* Divider */}
            <div className="my-6 flex items-center gap-4">
              <div className="h-px flex-1 bg-gradient-to-r from-white/10 to-transparent" />
              <span className="font-mono text-xs uppercase tracking-widest text-[#5c7078]">
                Or
              </span>
              <div className="h-px flex-1 bg-gradient-to-l from-white/10 to-transparent" />
            </div>

            {/* Google OAuth */}
            <button
              type="button"
              onClick={handleGoogleSignup}
              disabled={loading}
              className="w-full rounded-sm border border-white/10 bg-white/5 px-6 py-3 font-mono text-xs font-semibold uppercase tracking-widest text-[#e8f1f2] transition-colors hover:bg-white/10 hover:border-[#ffb454]/40 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <span>Sign up with Google</span>
              <span>G</span>
            </button>

            {/* Footer */}
            <div className="mt-8 space-y-4 border-t border-white/10 pt-6 text-center text-xs">
              <p className="text-[#8fa3ad]">
                Already have an account?{" "}
                <Link to="/login" className="text-[#ffb454] transition-colors hover:text-[#ffc876]">
                  Sign in
                </Link>
              </p>
              <p className="font-mono text-[10px] text-[#5c7078]">
                By signing up, you agree to our{" "}
                <a href="#terms" className="text-[#ffb454] hover:underline">
                  Terms of Service
                </a>
                {" "}and{" "}
                <a href="#privacy" className="text-[#ffb454] hover:underline">
                  Privacy Policy
                </a>
              </p>
            </div>

            {/* Security badge */}
            <div className="mt-6 rounded-sm border border-[#ffb454]/20 bg-[#ffb454]/5 px-4 py-2 text-center font-mono text-xs text-[#ffb454]">
              <span>🔒 Enterprise Grade Security</span>
            </div>
          </div>
        </main>

        {/* Footer ticker */}
        <div className="flex items-center gap-6 border-t border-white/10 bg-black/30 px-6 py-3 backdrop-blur-sm lg:px-16">
          <div className="flex shrink-0 items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-[#ffb454]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#ffb454] animate-pulse" />
            Secure
          </div>
          <div className="hidden shrink-0 font-mono text-[11px] uppercase tracking-widest text-[#5c7078] sm:block">
            &copy; 2026 GeoSecure
          </div>
        </div>
      </div>
    </div>
  );
};

export default Signup;
