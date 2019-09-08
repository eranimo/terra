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
}

export interface IDrawOptions {
  grid: boolean,
  plateBorders: boolean,
  plateVectors: boolean,
  cellCenters: boolean,
  rivers: boolean,
  surface: boolean,
  regions: boolean,
  mapMode: EMapMode,
}

export enum EMapMode {
  NONE = 'NONE',
  ELEVATION = 'ELEVATION',
  MOISTURE = 'MOISTURE',
}

export const mapModeTitles = {
  [EMapMode.NONE]: 'None',
  [EMapMode.ELEVATION]: 'Elevation',
  [EMapMode.MOISTURE]: 'Moisture',
}