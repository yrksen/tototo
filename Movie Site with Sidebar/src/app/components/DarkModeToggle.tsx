import { Moon, Sun } from "lucide-react";
import { useEffect } from "react";

interface DarkModeToggleProps {
  isDark: boolean;
  onToggle: () => void;
}

export function DarkModeToggle({ isDark, onToggle }: DarkModeToggleProps) {
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  return (
    <button
      onClick={onToggle}
      className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      aria-label="Toggle dark mode"
    >
      {isDark ? (
        <Sun className="size-5 text-yellow-400" />
      ) : (
        <Moon className="size-5 text-gray-600" />
      )}
    </button>
  );
}
