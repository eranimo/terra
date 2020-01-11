import { hexToRgb } from './utils/color';

export type Size = {
  width: number,
  height: number,
}

export interface IGlobeOptions {
  core: {
    seed: number,
  },
  sphere: {
    numberCells: number,
    jitter: number,
    protrudeHeight: number,
  },
  hydrology: {
    flowModifier: number,
    moistureModifier: number,
  },
  climate: {
    temperatureModifier: number,
    minTemperature: number,
    maxTemperature: number,
  },
  geology: {
    numberPlates: number,
    oceanPlatePercent: number,
    terrainRoughness: number,
    plateCollisionThreshold: number,
    heightModifier: number,
  },
}


export interface IGameOptions {
  core: {
    name: string,
    enableDevMode: boolean,
  },
  sim: {
    numStartingCivs: number,
  },
}

export const categoryTitles = {
  core: 'Core',
  sphere: 'Sphere',
  hydrology: 'Hydrology',
  climate: 'Climate',
  geology: 'Geology',
}

export enum EMapMode {
  ELEVATION = 'ELEVATION',
  TECTONICS = 'TECTONICS',
  MOISTURE = 'MOISTURE',
  TEMPERATURE = 'TEMPERATURE',
  INSOLATION = 'INSOLATION',
  ROUGHNESS = 'ROUGHNESS',
  DESIRABILITY = 'DESIRABILITY',
  BIOME = 'BIOME',
  FLOW = 'FLOW',
}

export interface IDrawOptions {
  drawGrid: boolean,
  drawPlateBorders: boolean,
  drawPlateVectors: boolean,
  drawCellCenters: boolean,
  drawRivers: boolean,
  renderPlanet: boolean,
  renderCellRegions: boolean,
  drawCoastlineBorder: boolean,
}

export const defaultDrawOptions: IDrawOptions = {
  drawGrid: false,
  drawPlateBorders: false,
  drawPlateVectors: false,
  drawRivers: true,
  drawCellCenters: false,
  renderPlanet: true,
  renderCellRegions: true,
  drawCoastlineBorder: false,
};

export const mapModeDrawOptions: Record<EMapMode, Partial<IDrawOptions>> = {
  [EMapMode.ELEVATION]: {
    drawCoastlineBorder: true,
    drawRivers: false,
  },
  [EMapMode.MOISTURE]: {
    drawCoastlineBorder: true,
  },
  [EMapMode.TEMPERATURE]: {
    drawCoastlineBorder: true,
    drawRivers: false,
  },
  [EMapMode.INSOLATION]: {
    drawCoastlineBorder: true,
    drawRivers: false,
  },
  [EMapMode.ROUGHNESS]: {
    drawCoastlineBorder: true,
    drawRivers: false,
  },
  [EMapMode.BIOME]: {},
  [EMapMode.FLOW]: {
    drawCoastlineBorder: true,
  },
  [EMapMode.TECTONICS]: {
    drawRivers: false,
    drawPlateBorders: true,
    drawPlateVectors: true,
  },
  [EMapMode.DESIRABILITY]: {
    drawRivers: false,
    drawCoastlineBorder: true,
  },
}

export const mapModeTitles = {
  [EMapMode.ELEVATION]: 'Elevation',
  [EMapMode.TECTONICS]: 'Plate Tectonics',
  [EMapMode.MOISTURE]: 'Moisture',
  [EMapMode.TEMPERATURE]: 'Temperature',
  [EMapMode.INSOLATION]: 'Insolation',
  [EMapMode.ROUGHNESS]: 'Terrain Roughness',
  [EMapMode.DESIRABILITY]: 'Desirability',
  [EMapMode.BIOME]: 'Biomes',
  [EMapMode.FLOW]: 'Flow',
}

export enum EMonth {
  JANUARY,
  FEBRUARY,
  MARCH,
  APRIL,
  MAY,
  JUNE,
  JULY,
  AUGUST,
  SEPTEMBER,
  OCTOBER,
  NOVEMBER,
  DECEMBER,
}

export const monthTitles = {
  [EMonth.JANUARY]: 'January',
  [EMonth.FEBRUARY]: 'February',
  [EMonth.MARCH]: 'March',
  [EMonth.APRIL]: 'April',
  [EMonth.MAY]: 'May',
  [EMonth.JUNE]: 'June',
  [EMonth.JULY]: 'July',
  [EMonth.AUGUST]: 'August',
  [EMonth.SEPTEMBER]: 'September',
  [EMonth.OCTOBER]: 'October',
  [EMonth.NOVEMBER]: 'November',
  [EMonth.DECEMBER]: 'December',
}

export enum EBiome {
  NONE,

  OCEAN,
  COAST,
  
  GLACIAL,
  TUNDRA,
  ALPINE_TUNDRA,
  BOREAL_FOREST,
  SHRUBLAND,
  MONTANE_FOREST,
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
  SUPERARID,
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
  [EMoistureZone.BARREN]:    { start: 0.00, end: 0.08 },
  [EMoistureZone.SUPERARID]: { start: 0.08, end: 0.15 },
  [EMoistureZone.ARID]:      { start: 0.15, end: 0.30 },
  [EMoistureZone.SEMIARID]:  { start: 0.30, end: 0.50 },
  [EMoistureZone.SEMIWET]:   { start: 0.50, end: 0.75 },
  [EMoistureZone.WET]:       { start: 0.75, end: 1 },
}

export const temperatureZoneRanges = {
  [ETemperatureZone.ARCTIC]: { start: 0, end: 0.2 },
  [ETemperatureZone.SUBARCTIC]: { start: 0.2, end: 0.4 },
  [ETemperatureZone.TEMPERATE]: { start: 0.4, end: 0.6 },
  [ETemperatureZone.SUBTROPICAL]: { start: 0.6, end: 0.8 },
  [ETemperatureZone.TROPICAL]: { start: 0.8, end: 1 },
}

// mapping between moisture zones and temperatures which returns biome
export const biomeRanges = {
  [EMoistureZone.BARREN]: {
    [ETemperatureZone.ARCTIC]: EBiome.GLACIAL,
    [ETemperatureZone.SUBARCTIC]: [EBiome.TUNDRA, EBiome.TUNDRA, EBiome.ALPINE_TUNDRA],
    [ETemperatureZone.TEMPERATE]: EBiome.DESERT,
    [ETemperatureZone.SUBTROPICAL]: EBiome.DESERT,
    [ETemperatureZone.TROPICAL]: EBiome.DESERT,
  },
  [EMoistureZone.SUPERARID]: {
    [ETemperatureZone.ARCTIC]: EBiome.GLACIAL,
    [ETemperatureZone.SUBARCTIC]: [EBiome.TUNDRA, EBiome.TUNDRA, EBiome.ALPINE_TUNDRA],
    [ETemperatureZone.TEMPERATE]: [EBiome.SHRUBLAND, EBiome.SHRUBLAND, EBiome.MONTANE_FOREST],
    [ETemperatureZone.SUBTROPICAL]: EBiome.GRASSLAND,
    [ETemperatureZone.TROPICAL]: EBiome.DESERT,
  },
  [EMoistureZone.ARID]: {
    [ETemperatureZone.ARCTIC]: EBiome.GLACIAL,
    [ETemperatureZone.SUBARCTIC]: [EBiome.TUNDRA, EBiome.TUNDRA, EBiome.ALPINE_TUNDRA],
    [ETemperatureZone.TEMPERATE]: EBiome.GRASSLAND,
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
  [EBiome.ALPINE_TUNDRA]: 'Alpine Tundra',
  [EBiome.BOREAL_FOREST]: 'Boreal Forest',
  [EBiome.SHRUBLAND]: 'Scrubland',
  [EBiome.MONTANE_FOREST]: 'Montane Forest',
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
  [EBiome.MONTANE_FOREST]: '#A1B377',
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
  [EBiome.ALPINE_TUNDRA]: hexToRgb('#9ba38f'),
  [EBiome.BOREAL_FOREST]: hexToRgb('#42562F'),
  [EBiome.SHRUBLAND]: hexToRgb('#D7CC9E'),
  [EBiome.MONTANE_FOREST]: hexToRgb('#A1B377'),
  [EBiome.WOODLAND]: hexToRgb('#9fb277'),
  [EBiome.GRASSLAND]: hexToRgb('#9fb981'),
  [EBiome.SAVANNA]: hexToRgb('#C9CD7C'),
  [EBiome.DESERT]: hexToRgb('#D9BF8C'),
  [EBiome.TEMPERATE_FOREST]: hexToRgb('#4d703a'),
  [EBiome.TEMPERATE_RAINFOREST]: hexToRgb('#425D27'),
  [EBiome.TROPICAL_FOREST]: hexToRgb('#4d703a'),
  [EBiome.TROPICAL_RAINFOREST]: hexToRgb('#426D18'),
};


export type SharedArray<T> = {
  array: T,
  buffer: SharedArrayBuffer,
};

export type River = {
  length: number;
  points: number[][];
  widths: number[];
}

export type Arrow = {
  position: number[];
  rotation: number[];
  color: number[];
}

export type GlobeData = {
  t_xyz: Float32Array;
  r_xyz: Float32Array;
  triangleGeometry: Float32Array,
  minimapGeometry: Float32Array,
  mapModeColor: Float32Array;
  mapModeValue: Float32Array;
  coastline: {
    points: number[],
    widths: number[],
  };
  rivers: River[],
  plateVectors: Arrow[];
  plateBorders: {
    points: number[],
    widths: number[],
  };
  cellBorders: number[][][][],
  sideToCell: Int32Array,
  sidesInCell: Int32Array,
}

export type WorldData = {
  globe: GlobeData,
}

export type CellPoints = {
  cell: number; // r value
  points: number[]
};

export type CellGlobeData = {
  lat_long: [number, number],
  temperature: number,
  insolation: number,
  moisture: number,
  elevation: number,
  distance_to_ocean: number,
  desirability: number,
  biome: number,
}

export type CellWorldData = {
  globe: CellGlobeData;
  cellGroup: string;
}

export interface ICellGroupOptions {
  name: string;
  color: number[];
}

export interface ICellGroupData {
  name: string;
  cells_xyz: number[];
  cells_rgba: number[];
  border_points: number[];
  border_widths: number[];
}

export interface ICellGroupTooltipData {
  name: string;
}