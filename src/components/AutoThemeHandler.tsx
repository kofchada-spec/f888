import { useEffect } from "react";
import { useTheme } from "next-themes";

export function AutoThemeHandler() {
  const { setTheme } = useTheme();

  useEffect(() => {
    const updateTheme = () => {
      const now = new Date();
      const hour = now.getHours();
      
      // Dark mode between 20h (8 PM) and 6h (6 AM)
      if (hour >= 20 || hour < 6) {
        setTheme("dark");
      } else {
        setTheme("light");
      }
    };

    // Update theme immediately
    updateTheme();

    // Update theme every hour
    const interval = setInterval(updateTheme, 60 * 60 * 1000);

    return () => clearInterval(interval);
  }, [setTheme]);

  return null;
}