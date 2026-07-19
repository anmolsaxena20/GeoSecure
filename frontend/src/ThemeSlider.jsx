import React from "react";
import { Sun, Monitor, Moon, Lock } from "lucide-react";
import { useTheme } from "./ThemeContext.jsx";

export default function ThemeSlider({ isAuthenticated }) {
  const { theme, setTheme } = useTheme();

  const options = [
    { value: "LIGHT", label: "Light", icon: Sun },
    { value: "SYSTEM", label: "Sys", icon: Monitor },
    { value: "DARK", label: "Dark", icon: Moon },
  ];

  const selectedIndex = options.findIndex((o) => o.value === theme);

  const handleSelect = (val) => {
    if (!isAuthenticated) return;
    setTheme(val);
  };

  return (
    <div className="relative flex items-center">
      <div
        className={`relative flex items-center bg-slate-200/50 dark:bg-white/5 rounded-full p-0.5 border border-slate-300/60 dark:border-white/10 ${
          !isAuthenticated ? "opacity-60 cursor-not-allowed" : "cursor-pointer"
        }`}
        title={!isAuthenticated ? "Sign in to change theme" : "Change site theme"}
      >
        {/* Sliding background pill indicator */}
        <div
          className="absolute top-[2px] bottom-[2px] rounded-full bg-white dark:bg-[#4ff0d7]/10 shadow-sm dark:shadow-none transition-all duration-300 ease-out"
          style={{
            left: `calc(${selectedIndex * 33.33}% + 2px)`,
            width: "calc(33.33% - 4px)",
            border: theme !== "SYSTEM" ? resolvedThemeStyle(theme) : undefined
          }}
        />

        {options.map((opt) => {
          const Icon = opt.icon;
          const isActive = theme === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              disabled={!isAuthenticated}
              onClick={() => handleSelect(opt.value)}
              className={`relative z-10 flex items-center gap-1 px-2.5 py-1.5 rounded-full font-mono text-[10px] uppercase tracking-wider transition-colors outline-none focus:outline-none ${
                isActive
                  ? "text-teal-600 dark:text-[#4ff0d7] font-semibold"
                  : "text-slate-500 dark:text-[#8fa3ad] hover:text-slate-800 dark:hover:text-white"
              } ${!isAuthenticated ? "cursor-not-allowed" : "cursor-pointer"}`}
            >
              <Icon className="h-3 w-3 shrink-0" />
              <span className="hidden sm:inline-block select-none">{opt.label}</span>
            </button>
          );
        })}
      </div>

      {!isAuthenticated && (
        <div 
          className="absolute -top-1 -right-1 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-slate-400 dark:bg-slate-700 text-white shadow-sm border border-white dark:border-slate-800"
          title="Authentication required"
        >
          <Lock className="h-2.5 w-2.5" />
        </div>
      )}
    </div>
  );
}

// Small helper function to customize border style
function resolvedThemeStyle(theme) {
  if (theme === "LIGHT") return "1px solid rgba(13, 148, 136, 0.2)";
  return "1px solid rgba(79, 240, 215, 0.2)";
}
