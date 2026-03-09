import { useCallback, useState, useEffect } from "react";

export interface CustomPersona {
  id: string;
  name: string;
  prompt: string;
}

const STORAGE_KEY = "echomind_custom_personas";

function loadFromStorage(): CustomPersona[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveToStorage(personas: CustomPersona[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(personas));
  } catch (e) {
    console.warn("Failed to save custom personas", e);
  }
}

export function useCustomPersonas() {
  const [customPersonas, setCustomPersonas] = useState<CustomPersona[]>(() => loadFromStorage());

  useEffect(() => {
    saveToStorage(customPersonas);
  }, [customPersonas]);

  const addPersona = useCallback((name: string, prompt: string) => {
    const id = `custom-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    setCustomPersonas((prev) => [...prev, { id, name, prompt }]);
    return id;
  }, []);

  const updatePersona = useCallback((id: string, updates: Partial<Pick<CustomPersona, "name" | "prompt">>) => {
    setCustomPersonas((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...updates } : p))
    );
  }, []);

  const deletePersona = useCallback((id: string) => {
    setCustomPersonas((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const exportToFile = useCallback(() => {
    const data = { customPersonas, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "echomind_personas.json";
    a.click();
    URL.revokeObjectURL(url);
  }, [customPersonas]);

  const importFromFile = useCallback((file: File): Promise<number> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(String(reader.result ?? "{}"));
          const imported = Array.isArray(data.customPersonas) ? data.customPersonas : [];
          const valid = imported.filter(
            (p: CustomPersona | Record<string, unknown>): p is CustomPersona =>
              typeof p === "object" &&
              p !== null &&
              "id" in p &&
              "name" in p &&
              "prompt" in p &&
              typeof (p as CustomPersona).name === "string" &&
              typeof (p as CustomPersona).prompt === "string"
          );
          setCustomPersonas((prev) => {
            const merged = [...prev];
            valid.forEach((p: CustomPersona) => {
              const existing = merged.find((x) => x.id === p.id);
              if (!existing) {
                merged.push({ ...p, id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 9)}` });
              }
            });
            return merged;
          });
          resolve(valid.length);
        } catch {
          reject(new Error("Invalid JSON file"));
        }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });
  }, []);

  return {
    customPersonas,
    addPersona,
    updatePersona,
    deletePersona,
    exportToFile,
    importFromFile,
  };
}
