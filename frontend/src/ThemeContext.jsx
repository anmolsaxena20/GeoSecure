import React, { createContext, useContext, useState, useEffect } from "react";
import { API_ENDPOINTS } from "./config/api.js";

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    try {
      const user = JSON.parse(localStorage.getItem("profileUser") || "null");
      if (user?.themePreference) return user.themePreference;
    } catch (_) {}
    return "SYSTEM";
  });

  const [resolvedTheme, setResolvedTheme] = useState("dark");

  // Sync state with localStorage changes (e.g. on login/profile update)
  useEffect(() => {
    const handleStorageChange = () => {
      try {
        const user = JSON.parse(localStorage.getItem("profileUser") || "null");
        if (user?.themePreference && user.themePreference !== theme) {
          setThemeState(user.themePreference);
        }
      } catch (_) {}
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("profileUserUpdated", handleStorageChange);
    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("profileUserUpdated", handleStorageChange);
    };
  }, [theme]);

  // Resolve system preference
  useEffect(() => {
    if (theme === "SYSTEM") {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      const handleChange = () => {
        setResolvedTheme(mediaQuery.matches ? "dark" : "light");
      };
      handleChange();
      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    } else {
      setResolvedTheme(theme.toLowerCase());
    }
  }, [theme]);

  // Apply resolved theme class to html root
  useEffect(() => {
    const root = document.documentElement;
    if (resolvedTheme === "dark") {
      root.classList.add("dark");
      root.classList.remove("light");
      root.style.colorScheme = "dark";
    } else {
      root.classList.add("light");
      root.classList.remove("dark");
      root.style.colorScheme = "light";
    }
  }, [resolvedTheme]);

  const updateLocalTheme = (newTheme) => {
    setThemeState(newTheme);
  };

  const changeTheme = async (newTheme) => {
    const token = localStorage.getItem("accessToken");
    if (!token) {
      // Local-only if not authenticated (though UI disables it)
      setThemeState(newTheme);
      return true;
    }

    try {
      // Update local state first for instant responsiveness
      setThemeState(newTheme);

      const response = await fetch(API_ENDPOINTS.USERS.THEME, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ theme: newTheme }),
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to update theme on server");
      }

      const data = await response.json();
      
      // Update stored profile info
      if (data.user) {
        localStorage.setItem("profileUser", JSON.stringify(data.user));
        window.dispatchEvent(new Event("profileUserUpdated"));
      }
      return true;
    } catch (err) {
      console.error("Error setting theme:", err);
      return false;
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme: changeTheme, updateLocalTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
