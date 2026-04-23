import { useEffect } from "react";

export function useSystemThemeClass() {
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    function syncThemeClass(matches: boolean) {
      document.documentElement.classList.toggle("dark", matches);
    }

    syncThemeClass(mediaQuery.matches);

    const handleChange = (event: MediaQueryListEvent) => {
      syncThemeClass(event.matches);
    };

    mediaQuery.addEventListener("change", handleChange);

    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, []);
}
