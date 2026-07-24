import { useState, useEffect } from "react";

export function useViewedPresets() {
  const [viewed, setViewed] = useState<string[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("storiiA_viewed_presets");
      if (stored) {
        setViewed(JSON.parse(stored));
      }
    } catch {
      // ignore
    }
  }, []);

  const markAsViewed = (id: string) => {
    if (!viewed.includes(id)) {
      const updated = [...viewed, id];
      setViewed(updated);
      localStorage.setItem("storiiA_viewed_presets", JSON.stringify(updated));
    }
  };

  const isNew = (id: string, createdAt: string) => {
    if (viewed.includes(id)) return false;
    const daysOld = (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24);
    return daysOld <= 14;
  };

  return { viewed, markAsViewed, isNew };
}
