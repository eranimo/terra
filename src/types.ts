import { hexToRgb } from './utils/color';
export type Size = {
  width: number,
  height: number,
}

export interface IGlobeOptions {
  seed: number,
  numberCells: number,
  jitter: number,
  numberPlates: number,
  flowModifier: number,
  oceanPlatePercent: number,
  protrudeHeight: number,
  terrainRoughness: number,
  plateCollisionThreshold: number,
  heightModifier: number,
  temperatureModifier: number;
  moistureModifier: number;
}

export interface IDrawOptions {
  grid: boolean,
  plateBorders: boolean,
  plateVectors: boolean,
  cellCenters: boolean,
  rivers: boolean,
  drawMode: EDrawMode,
  surface: boolean,
  regions: boolean,
  mapMode: EMapMode,
}

export enum EDrawMode {
  QUADS = 'QUADS',
  CENTROID = 'CENTROID',
}

export enum EMapMode {
  NONE = 'NONE',
  ELEVATION = 'ELEVATION',
  MOISTURE = 'MOISTURE',
  TEMPERATURE = 'TEMPERATURE',
  ROUGHNESS = 'ROUGHNESS',
  BIOME = 'BIOME',
}

export const mapModeTitles = {
  [EMapMode.NONE]: 'None',
  [EMapMode.ELEVATION]: 'Elevation',
  [EMapMode.MOISTURE]: 'Moisture',
  [EMapMode.TEMPERATURE]: 'Temperature',
  [EMapMode.ROUGHNESS]: 'Terrain Roughness',
  [EMapMode.BIOME]: 'Biomes',
}

export const drawModeTitles = {
  [EDrawMode.QUADS]: 'Quads',
  [EDrawMode.CENTROID]: 'Centroids',
}

export enum EBiome {
  NONE,

  OCEAN,
  COAST,
  
  GLACIAL,
  TUNDRA,
  BOREAL_FOREST,
  SHRUBLAND,
  WOODLAND,
  GRASSLAND,
  SAVANNA,
  DESERT,
  TEMPERATE_FOREST,
  TEMPERATE_RAINFOREST,
  TROPICAL_FOREST,
  TROPICAL_RAINFOREST
}

export enum EMoistureZone {
  BARREN,
  ARID,
  SEMIARID,
  SEMIWET,
  WET,
}

export enum ETemperatureZone {
  ARCTIC,
  SUBARCTIC,
  TEMPERATE,
  SUBTROPICAL,
  TROPICAL,
}

export const moistureZoneRanges = {
  [EMoistureZone.BARREN]: { start: 0/300, end: 25/300 },
  [EMoistureZone.ARID]: { start: 25/300, end: 50/300 },
  [EMoistureZone.SEMIARID]: { start: 50/300, end: 100/300 },
  [EMoistureZone.SEMIWET]: { start: 100/300, end: 200/300 },
  [EMoistureZone.WET]: { start: 200/300, end: 300/300 },
}

export const temperatureZoneRanges = {
  [ETemperatureZone.ARCTIC]: { start: 0, end: 0.2 },
  [ETemperatureZone.SUBARCTIC]: { start: 0.2, end: 0.3 },
  [ETemperatureZone.TEMPERATE]: { start: 0.3, end: 0.6 },
  [ETemperatureZone.SUBTROPICAL]: { start: 0.6, end: 0.85 },
  [ETemperatureZone.TROPICAL]: { start: 0.85, end: 1 },
}

// mapping between moisture zones and temperatures which returns biome
export const biomeRanges = {
  [EMoistureZone.BARREN]: {
    [ETemperatureZone.ARCTIC]: EBiome.GLACIAL,
    [ETemperatureZone.SUBARCTIC]: EBiome.TUNDRA,
    [ETemperatureZone.TEMPERATE]: EBiome.GRASSLAND,
    [ETemperatureZone.SUBTROPICAL]: EBiome.GRASSLAND,
    [ETemperatureZone.TROPICAL]: EBiome.DESERT,
  },
  [EMoistureZone.ARID]: {
    [ETemperatureZone.ARCTIC]: EBiome.GLACIAL,
    [ETemperatureZone.SUBARCTIC]: EBiome.TUNDRA,
    [ETemperatureZone.TEMPERATE]: EBiome.SHRUBLAND,
    [ETemperatureZone.SUBTROPICAL]: EBiome.SAVANNA,
    [ETemperatureZone.TROPICAL]: EBiome.DESERT,
  },
  [EMoistureZone.SEMIARID]: {
    [ETemperatureZone.ARCTIC]: EBiome.GLACIAL,
    [ETemperatureZone.SUBARCTIC]: EBiome.BOREAL_FOREST,
    [ETemperatureZone.TEMPERATE]: EBiome.TEMPERATE_FOREST,
    [ETemperatureZone.SUBTROPICAL]: EBiome.WOODLAND,
    [ETemperatureZone.TROPICAL]: EBiome.SAVANNA,
  },
  [EMoistureZone.SEMIWET]: {
    [ETemperatureZone.ARCTIC]: EBiome.GLACIAL,
    [ETemperatureZone.SUBARCTIC]: EBiome.BOREAL_FOREST,
    [ETemperatureZone.TEMPERATE]: EBiome.TEMPERATE_FOREST,
    [ETemperatureZone.SUBTROPICAL]: EBiome.TEMPERATE_FOREST,
    [ETemperatureZone.TROPICAL]: EBiome.TROPICAL_FOREST,
  },
  [EMoistureZone.WET]: {
    [ETemperatureZone.ARCTIC]: EBiome.GLACIAL,
    [ETemperatureZone.SUBARCTIC]: EBiome.BOREAL_FOREST,
    [ETemperatureZone.TEMPERATE]: EBiome.TEMPERATE_RAINFOREST,
    [ETemperatureZone.SUBTROPICAL]: EBiome.TEMPERATE_RAINFOREST,
    [ETemperatureZone.TROPICAL]: EBiome.TROPICAL_RAINFOREST,
  },
}

export const biomeTitles = {
  [EBiome.NONE]: 'None',
  [EBiome.GLACIAL]: 'Glacial',
  [EBiome.TUNDRA]: 'Tundra',
  [EBiome.BOREAL_FOREST]: 'Boreal Forest',
  [EBiome.SHRUBLAND]: 'Scrubland',
  [EBiome.WOODLAND]: 'Woodland',
  [EBiome.GRASSLAND]: 'Grassland',
  [EBiome.SAVANNA]: 'Savanna',
  [EBiome.DESERT]: 'Desert',
  [EBiome.TEMPERATE_FOREST]: 'Temperate Forest',
  [EBiome.TEMPERATE_RAINFOREST]: 'Temperate Rainforest',
  [EBiome.TROPICAL_FOREST]: 'Tropical Forest',
  [EBiome.TROPICAL_RAINFOREST]: 'Tropical Rainforest'
};

export const temperatureZoneTitles = {
  [ETemperatureZone.ARCTIC]: 'Arctic',
  [ETemperatureZone.SUBARCTIC]: 'Subarctic',
  [ETemperatureZone.TEMPERATE]: 'Temperate',
  [ETemperatureZone.SUBTROPICAL]: 'Subtropical',
  [ETemperatureZone.TROPICAL]: 'Tropical',
};

export const biomeLabelColors = {
  [EBiome.NONE]: '#4783A0',
  [EBiome.GLACIAL]: '#FFFFFF',
  [EBiome.TUNDRA]: '#96D1C3',
  [EBiome.BOREAL_FOREST]: '#006259',
  [EBiome.SHRUBLAND]: '#B26A47',
  [EBiome.WOODLAND]: '#B26A47',
  [EBiome.GRASSLAND]: '#F6EB64',
  [EBiome.SAVANNA]: '#C7C349',
  [EBiome.DESERT]: '#8B4D32',
  [EBiome.TEMPERATE_FOREST]: '#92D847',
  [EBiome.TEMPERATE_RAINFOREST]: '#6B842A',
  [EBiome.TROPICAL_FOREST]: '#097309',
  [EBiome.TROPICAL_RAINFOREST]: '#005100',
};

export const biomeColors = {
  [EBiome.NONE]: hexToRgb('#000000'),
  [EBiome.OCEAN]: [ (48 + 5) / 255, (80 + 5) / 255, (140 + 5) / 255, 1],
  [EBiome.COAST]: [ (58 + 10) / 255, (90 + 10) / 255, (150 + 10) / 255, 1],
  [EBiome.GLACIAL]: hexToRgb('#FFFFFF'),
  [EBiome.TUNDRA]: hexToRgb('#6e7c59'),
  [EBiome.BOREAL_FOREST]: hexToRgb('#42562F'),
  [EBiome.SHRUBLAND]: hexToRgb('#D7CC9E'),
  [EBiome.WOODLAND]: hexToRgb('#9fb277'),
  [EBiome.GRASSLAND]: hexToRgb('#9fb981'),
  [EBiome.SAVANNA]: hexToRgb('#C9CD7C'),
  [EBiome.DESERT]: hexToRgb('#D9BF8C'),
  [EBiome.TEMPERATE_FOREST]: hexToRgb('#4d703a'),
  [EBiome.TEMPERATE_RAINFOREST]: hexToRgb('#425D27'),
  [EBiome.TROPICAL_FOREST]: hexToRgb('#4d703a'),
  [EBiome.TROPICAL_RAINFOREST]: hexToRgb('#426D18'),
};
