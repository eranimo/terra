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
  heightModifier: number,
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
}

export const mapModeTitles = {
  [EMapMode.NONE]: 'None',
  [EMapMode.ELEVATION]: 'Elevation',
  [EMapMode.MOISTURE]: 'Moisture',
  [EMapMode.TEMPERATURE]: 'Temperature',
}

export const drawModeTitles = {
  [EDrawMode.QUADS]: 'Quads',
  [EDrawMode.CENTROID]: 'Centroids',
}

export enum EBiome {
  NONE,
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
  [ETemperatureZone.ARCTIC]: { start: 0, end: 0.15 },
  [ETemperatureZone.SUBARCTIC]: { start: 0.15, end: 0.3 },
  [ETemperatureZone.TEMPERATE]: { start: 0.3, end: 0.6 },
  [ETemperatureZone.SUBTROPICAL]: { start: 0.6, end: 0.85 },
  [ETemperatureZone.TROPICAL]: { start: 0.85, end: 1 },
}

// mapping between moisture zones and temperatures which returns biome
export const biomeRanges = {
  [EMoistureZone.BARREN]: {
    [ETemperatureZone.ARCTIC]: EBiome.TUNDRA,
    [ETemperatureZone.SUBARCTIC]: EBiome.TUNDRA,
    [ETemperatureZone.TEMPERATE]: EBiome.GRASSLAND,
    [ETemperatureZone.SUBTROPICAL]: EBiome.GRASSLAND,
    [ETemperatureZone.TROPICAL]: EBiome.DESERT,
  },
  [EMoistureZone.ARID]: {
    [ETemperatureZone.ARCTIC]: EBiome.TUNDRA,
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