export interface StorageUsage {
  usage_bytes: number;
  capacity_bytes: number | null;
}

export function voiceWsUrl(): string {
  const host = window.location.hostname;
  const port = window.location.port || (window.location.protocol === "https:" ? "443" : "80");
  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  return `${protocol}://${host}:${port}/api/chat`;
}

export async function getStorageUsage(): Promise<StorageUsage> {
  return { usage_bytes: 0, capacity_bytes: null };
}
