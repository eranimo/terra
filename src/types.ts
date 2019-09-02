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
}

export interface IDrawOptions {
  grid: boolean,
  plateBorders: boolean,
  plateVectors: boolean,
  cellCenters: boolean,
  rivers: boolean,
  surface: boolean,
}