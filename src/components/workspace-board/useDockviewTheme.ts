import { useEffect, useState } from "react";
import { themeDark, themeLight } from "dockview-react";

function readIsDarkTheme(): boolean {
  return document.documentElement.classList.contains("dark");
}

export function useDockviewTheme() {
  const [isDarkTheme, setIsDarkTheme] = useState(readIsDarkTheme);

  useEffect(() => {
    const root = document.documentElement;
    const observer = new MutationObserver(() => {
      setIsDarkTheme(root.classList.contains("dark"));
    });

    observer.observe(root, {
      attributeFilter: ["class"],
      attributes: true,
    });

    return () => {
      observer.disconnect();
    };
  }, []);

  return isDarkTheme ? themeDark : themeLight;
}
