import { IGlobeOptions, EMapMode, WorldData, ICellGroupOptions, ICellGroupData } from '../types';
import { GlobeGen } from './GlobeGen';
import { Globe } from './Globe';
import { times } from 'lodash';


export interface IWorldOptions {
  initialMapMode: EMapMode;
}

export class World {
  globeGen: GlobeGen;
  globe: Globe;
  cell_cell_group: Record<number, string>;
  cellGroupData: ICellGroupData[];
  
  // TODO: factor out into static create and load methods
  constructor(
    globeOptions: IGlobeOptions,
    worldOptions: IWorldOptions,
  ) {
    this.globeGen = new GlobeGen();
    this.globe = this.globeGen.generate(globeOptions, worldOptions.initialMapMode);
    this.globeGen.update(0);
    this.cell_cell_group = {};
    this.cellGroupData = [];

    // build map
  }

  export(): WorldData {
    return {
      globe: this.globe.export(),
      cellGroups: this.cellGroupData,
    };
  }

  updateGlobe(yearRatio: number) {
    this.globeGen.update(yearRatio);
  }

  addCellGroup(cellGroupOptions: ICellGroupOptions) {
    const { name, cells, color } = cellGroupOptions;
    const cells_xyz = [];
    const cells_rgba = [];
    for (const cell of cells) {
      const xyz = this.globe.coordinatesForCell(cell);
      this.cell_cell_group[cell] = name;
      cells_xyz.push(...xyz);
      cells_rgba.push(...times(xyz.length / 3).map(() => color) as any);
    }

    // find all points for sides not facing this region
    let points = [];
    let widths = [];
    for (const cell of cells) {
      let sides = [];
      this.globe.mesh.r_circulate_s(sides, cell);
      for (const s of sides) {
        const begin_r = this.globe.mesh.s_begin_r(s);
        const end_r = this.globe.mesh.s_end_r(s);
        const inner_t = this.globe.mesh.s_inner_t(s);
        const outer_t = this.globe.mesh.s_outer_t(s);
        const p1 = this.globe.t_xyz.slice(3 * inner_t, 3 * inner_t + 3);
        const p2 = this.globe.t_xyz.slice(3 * outer_t, 3 * outer_t + 3);
        if (this.cell_cell_group[end_r] != name) {
          points.push(...p1, ...p1, ...p2, ...p2);
          widths.push(0, 2, 2, 0);
        }
      }
    }

    this.cellGroupData.push({
      name,
      cells_xyz,
      cells_rgba,
      border_points: points,
      border_widths: widths,
    });
  }

}