/**
 * Arma 3 map choices for the mission builder.
 * Whoever edits this next, please make sure to follow the format and keep the order.
 */

export type ArmaMapChoice = {
  id: string
  worldSuffix: string
  title: string
  scaleLine: string
  about: string
  needsContent?: string
}

export const ARMA_MAP_CUSTOM_ID = 'custom'

export const ARMA_MAP_CHOICES: ArmaMapChoice[] = [
  {
    id: 'altis',
    worldSuffix: 'Altis',
    title: 'Altis',
    scaleLine: 'Very large (~30×30 km)',
    about: 'Main Mediterranean island. The default large terrain from the base game.',
  },
  {
    id: 'stratis',
    worldSuffix: 'Stratis',
    title: 'Stratis',
    scaleLine: 'Small (~15×15 km)',
    about: 'Smaller, rugged islands. Included with the base game.',
  },
  {
    id: 'malden',
    worldSuffix: 'Malden',
    title: 'Malden',
    scaleLine: 'Medium (~16×16 km)',
    about: 'Arid island chain. Free anniversary terrain—no extra purchase.',
  },
  {
    id: 'tanoa',
    worldSuffix: 'Tanoa',
    title: 'Tanoa',
    scaleLine: 'Large (~100 km²)',
    about: 'South Pacific jungle and islands. You need the Apex expansion to use this map in-game.',
    needsContent: 'Apex expansion',
  },
  {
    id: 'enoch',
    worldSuffix: 'Enoch',
    title: 'Livonia',
    scaleLine: 'Large (~163 km²)',
    about: 'Cool, forested country. Missions use the world name Enoch. You need the Contact DLC to use this map in-game.',
    needsContent: 'Contact DLC',
  },
  {
    id: 'cam_lao_nam',
    worldSuffix: 'Cam_Lao_Nam',
    title: 'Cam Lao Nam',
    scaleLine: 'Medium (~20×20 km)',
    about: 'Dense jungle and river terrain from the Vietnam setting. You need the S.O.G. Prairie Fire Creator DLC to use this map in-game.',
    needsContent: 'S.O.G. Prairie Fire Creator DLC',
  },
  {
    id: 'weferlingen',
    worldSuffix: 'Weferlingen',
    title: 'Weferlingen (summer)',
    scaleLine: 'Very large (~419 km²)',
    about: 'Cold War Germany countryside. You need the Global Mobilization Creator DLC. A separate winter terrain exists as Weferlingen_Winter.',
    needsContent: 'Global Mobilization Creator DLC',
  },
  {
    id: 'weferlingen_winter',
    worldSuffix: 'Weferlingen_Winter',
    title: 'Weferlingen (winter)',
    scaleLine: 'Very large (~419 km²)',
    about: 'Winter variant of the Global Mobilization map. Same DLC requirement as summer Weferlingen.',
    needsContent: 'Global Mobilization Creator DLC',
  },
]

export function armaMapChoiceBySuffix(suffix: string): ArmaMapChoice | undefined {
  const t = suffix.trim()
  return ARMA_MAP_CHOICES.find((m) => m.worldSuffix === t)
}

export function mapSelectIdForSuffix(suffix: string): string {
  return armaMapChoiceBySuffix(suffix)?.id ?? ARMA_MAP_CUSTOM_ID
}
