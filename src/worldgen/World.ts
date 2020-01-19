import { IGlobeOptions, EMapMode, WorldData, ICellGroupOptions, ICellGroupData, ICellGroupTooltipData, CellWorldData } from '../types';
import { GlobeGen } from './GlobeGen';
import { Globe } from './Globe';
import { times } from 'lodash';
import { Subject } from 'rxjs';
import { degreesToRadians } from '../utils';
import createGraph, { Graph } from 'ngraph.graph';
import path from 'ngraph.path';
import { Mesh } from '@babylonjs/core';
import { v4 as uuid } from 'uuid';

export class CellGroup {
  public cells: Set<number>;

  constructor(
    public id: number,
    public world: World,
    public options: ICellGroupOptions,
    cells: number[] = [],
  ) {
    this.cells = new Set(cells);
  }

  addCell(...cell: number[]) {
    for (const r of cell) {
      this.cells.add(r);
    }
    this.world.calculateCellGroup(this);
  }

  removeCell(cell: number) {
    this.cells.delete(cell);
    this.world.calculateCellGroup(this);
  }
}

export interface IWorldOptions {
  initialMapMode: EMapMode;
}

type CellNodeData = {
  r: number;
  elevation: number;
}

type CellLinkData = {
  deltaHeight: number;
}

export class World {
  globeGen: GlobeGen;
  globe: Globe;

  cellGroups: Set<CellGroup>;

  // mapping of cell id to cell group name
  cellCellGroup: Map<number, string>;

  // calculated cell group borders and cells
  cellGroupIndices: Int32Array;

  cellGroupUpdates$: Subject<ICellGroupData>;

  // population count array for map mode
  // TODO: hook up to Population
  cellPopulationCount: Int32Array;

  graph: Graph<CellNodeData, CellLinkData>;
  private cellGroupID: number;
  
  // TODO: factor out into static create and load methods
  constructor(
    globeOptions: IGlobeOptions,
    worldOptions: IWorldOptions,
  ) {
    this.globeGen = new GlobeGen();
    this.globe = this.globeGen.generate(globeOptions, worldOptions.initialMapMode);
    this.globeGen.update(0);

    this.cellGroups = new Set();
    this.cellCellGroup = new Map();
    this.cellGroupIndices = new Int32Array(new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT * this.globe.mesh.numRegions));
    this.cellGroupUpdates$ = new Subject<ICellGroupData>();
    this.cellGroupID = 0;

    this.cellPopulationCount = new Int32Array(new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT * this.globe.mesh.numRegions));
    this.cellPopulationCount.fill(0);

    // build ngraph

    console.time('build world graph');
    this.graph = createGraph<CellNodeData, CellLinkData>();
    this.graph.beginUpdate();
    for (let r = 0; r < this.globe.mesh.numRegions; r++) {
      this.graph.addNode(r, {
        r,
        elevation: this.globe.r_elevation[r],
      });
      const neighbors = this.globe.mesh.r_circulate_r([], r);
      for (const n of neighbors) {
        this.graph.addLink(r, n, {
          deltaHeight: this.globe.r_elevation[n] - this.globe.r_elevation[r],
        });
      }
    }
    this.graph.endUpdate();
    console.timeEnd('build world graph');
    console.log('world graph', this.graph);

    const pathfinder = path.aStar(this.graph, {
      distance: (from, to, link) => {
        if (from.data.elevation > 0 && to.data.elevation < 0) {
          return Infinity;
        }
        return this.distanceBetweenCells(from.data.r, to.data.r);
      }
    });

    // console.time('short path');
    // console.log('short path', pathfinder.find(19368, 15166));
    // console.timeEnd('short path');

    // console.time('long path');
    // console.log('long path', pathfinder.find(19368, 880));
    // console.timeEnd('long path');

    // console.time('impossible path');
    // console.log('impossible path', pathfinder.find(19368, 28649));
    // console.timeEnd('impossible path');
  }

  getData(): WorldData {
    return {
      globe: this.globe.getData(),
      cellGroupIndices: this.cellGroupIndices,
    };
  }

  getCellData(cell: number): CellWorldData {
    return {
      globe: this.globe.getCellData(cell),
      cellGroup: this.cellCellGroup.get(cell),
    }
  }

  distanceBetweenCells(cellA: number, cellB: number) {
    const [latA, longA] = this.globe.getLatLongForCell(cellA);
    const [latB, longB] = this.globe.getLatLongForCell(cellB);
    const latARadians = degreesToRadians(latA);
    const latBRadians = degreesToRadians(latB);
    const longARadians = degreesToRadians(longA);
    const longBRadians = degreesToRadians(longB);
    const deltaLongRadians = (longARadians - longBRadians);
    const radius = 1;
    return Math.acos(
      Math.sin(latARadians) * Math.sin(latBRadians) +
      Math.cos(latARadians) * Math.cos(latBRadians) * Math.cos(deltaLongRadians)
    ) * radius;
  }

  /**
   * Run the Globe climate simulation
   * 
   * @param yearRatio Percent through the year
   */
  updateGlobe(yearRatio: number) {
    this.globeGen.update(yearRatio);
  }

  createCellGroup(options: ICellGroupOptions) {
    const cellGroup = new CellGroup(this.cellGroupID, this, options);
    this.cellGroupID++;
    this.cellGroups.add(cellGroup);
    this.calculateCellGroup(cellGroup);
    return cellGroup;
  }

  getCellGroupForCell(cell: number): ICellGroupTooltipData | null {
    for (const group of this.cellGroups) {
      if (group.cells.has(cell)) {
        return {
          name: group.options.name
        };
      }
    }
    return null;
  }

  calculateCellGroup(cellGroup: CellGroup) {
    const { name, color } = cellGroup.options;
    const cells_xyz: number[][] = [];
    const label_position = [0, 0, 0];
    for (const cell of cellGroup.cells) {
      const xyz = this.globe.coordinatesForCell(cell);
      this.cellCellGroup.set(cell, name);
      label_position[0] += xyz[0];
      label_position[1] += xyz[1];
      label_position[2] += xyz[2];
      cells_xyz.push(xyz);
    }

    label_position[0] /= cellGroup.cells.size;
    label_position[1] /= cellGroup.cells.size;
    label_position[2] /= cellGroup.cells.size;

    // find all points for sides not facing this region
    let border = [];
    let sides = [];
    for (const cell of cellGroup.cells) {
      let cellSides = [];
      this.globe.mesh.r_circulate_s(cellSides, cell);
      for (const s of cellSides) {
        sides.push(s);
        const begin_r = this.globe.mesh.s_begin_r(s);
        const end_r = this.globe.mesh.s_end_r(s);
        const inner_t = this.globe.mesh.s_inner_t(s);
        const outer_t = this.globe.mesh.s_outer_t(s);
        const p1 = this.globe.t_xyz.slice(3 * inner_t, 3 * inner_t + 3);
        const p2 = this.globe.t_xyz.slice(3 * outer_t, 3 * outer_t + 3);
        if (this.cellCellGroup.get(end_r) != name) {
          border.push([ p1, p2 ]);
        }
      }
    }

    for (const cell of cellGroup.cells) {
      this.cellGroupIndices[cell] = cellGroup.id;
    }

    const data: ICellGroupData = {
      id: cellGroup.id,
      name,
      label_position,
      sides,
      border,
      color,
    };

    this.cellGroupUpdates$.next(data);
  }

}