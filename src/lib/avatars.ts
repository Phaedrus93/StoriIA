export interface AvatarPreset {
  id: string;
  name: string;
  imageUrl: string;
}

export const AVATAR_PRESETS: AvatarPreset[] = [
  { id: "avatar-exploratrice", name: "Esploratrice Stellare", imageUrl: "/avatars/explorer.svg" },
  { id: "avatar-cavaliere", name: "Piccolo Cavaliere", imageUrl: "/avatars/knight.svg" },
  { id: "avatar-volpe", name: "Volpe Saggia", imageUrl: "/avatars/fox.svg" },
  { id: "avatar-drago", name: "Draghetto Curioso", imageUrl: "/avatars/dragon.svg" },
  { id: "avatar-inventore", name: "Giovane Inventore", imageUrl: "/avatars/inventor.svg" },
  { id: "avatar-astronauta", name: "Astronauta Coraggioso", imageUrl: "/avatars/astronaut.svg" },
];

export function getAvatarUrl(presetId: string | null | undefined): string {
  if (!presetId) return "/avatars/explorer.svg";
  const found = AVATAR_PRESETS.find((a) => a.id === presetId);
  return found ? found.imageUrl : "/avatars/explorer.svg";
}
