export class CellGroup {
  cells: number[];

  constructor(
    public name: string,
    public color: number[],
    cells: number[] = []
  ) {
    this.cells = cells;
  }

  get size() {
    return this.cells.length;
  }
}
