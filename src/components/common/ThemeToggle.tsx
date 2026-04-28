import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "../../lib/utils";

export function ThemeToggle() {
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    // Check local storage or preference
    const stored = localStorage.getItem("theme");
    const initialDark = stored ? stored === "dark" : true; // Default to dark for premium look
    setIsDark(initialDark);
    if (initialDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, []);

  const toggleTheme = () => {
    const nextDark = !isDark;
    setIsDark(nextDark);
    if (nextDark) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  };

  return (
    <button
      onClick={toggleTheme}
      className={cn(
        "h-10 w-10 flex items-center justify-center rounded-xl transition-all active:scale-90 border",
        "bg-white/5 border-white/10 text-white hover:bg-white/10",
        "dark:bg-slate-900/50 dark:border-slate-800 dark:text-slate-400"
      )}
      title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
    >
      {isDark ? (
        <Sun className="h-4 w-4 text-[--accent-neon] neon-glow" />
      ) : (
        <Moon className="h-4 w-4 text-slate-400" />
      )}
    </button>
  );
}
