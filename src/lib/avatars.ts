export interface AvatarPreset {
  id: string;
  name: string;
  imageUrl?: string;
  image_url?: string;
  gender?: string;
  is_free?: boolean;
}

export const AVATAR_PRESETS: AvatarPreset[] = [
  { id: "avatar-exploratrice", name: "Esploratrice Stellare", imageUrl: "/avatars/explorer.svg", image_url: "/avatars/explorer.svg", gender: "neutral" },
  { id: "avatar-cavaliere", name: "Piccolo Cavaliere", imageUrl: "/avatars/knight.svg", image_url: "/avatars/knight.svg", gender: "neutral" },
  { id: "avatar-volpe", name: "Volpe Saggia", imageUrl: "/avatars/fox.svg", image_url: "/avatars/fox.svg", gender: "neutral" },
  { id: "avatar-drago", name: "Draghetto Curioso", imageUrl: "/avatars/dragon.svg", image_url: "/avatars/dragon.svg", gender: "neutral" },
  { id: "avatar-inventore", name: "Giovane Inventore", imageUrl: "/avatars/inventor.svg", image_url: "/avatars/inventor.svg", gender: "neutral" },
  { id: "avatar-astronauta", name: "Astronauta Coraggioso", imageUrl: "/avatars/astronaut.svg", image_url: "/avatars/astronaut.svg", gender: "neutral" },
];

let dynamicPresetsCache: Record<string, string> = {};

export function registerDynamicAvatarPresets(presets: any[]) {
  if (!Array.isArray(presets)) return;
  presets.forEach((p) => {
    const url = p.image_url || p.imageUrl;
    if (p.id && url) {
      dynamicPresetsCache[p.id] = url;
    }
  });
}

export function getAvatarUrl(presetId: string | null | undefined): string {
  if (!presetId) return "/avatars/explorer.svg";
  if (dynamicPresetsCache[presetId]) return dynamicPresetsCache[presetId];
  const found = AVATAR_PRESETS.find((a) => a.id === presetId);
  if (found) return found.imageUrl || found.image_url || "/avatars/explorer.svg";
  if (presetId.startsWith("/") || presetId.startsWith("http")) return presetId;
  return "/avatars/explorer.svg";
}
