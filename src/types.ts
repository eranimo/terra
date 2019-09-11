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