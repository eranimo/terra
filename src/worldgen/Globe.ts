import TriangleMesh from '@redblobgames/dual-mesh';
import { makeRandFloat } from '@redblobgames/prng';
import { vec3 } from 'gl-matrix';
import { createMapMode, mapModeDefs, MapModeData } from '../mapModes';
import { CellPoints, EMapMode, GlobeData, IGlobeOptions, CellGlobeData } from '../types';
import { getLatLng, intersectTriangle, distance3D, logGroupTime } from '../utils';
import { coordinateForSide, generateTriangleCenters } from './geometry';
import { makeSphere } from "./SphereMesh";
import { Vector3 } from "@babylonjs/core/Maths/math";


function createCoastline(mesh: TriangleMesh, globe: Globe) {
  let points = [];
  let widths = [];

  for (let s = 0; s < mesh.numSides; s++) {
    const begin_r = mesh.s_begin_r(s);
    const end_r = mesh.s_end_r(s);

    if (globe.r_elevation[begin_r] < 0 && globe.r_elevation[end_r] >= 0) {
      const inner_t = mesh.s_inner_t(s);
      const outer_t = mesh.s_outer_t(s);
      const p1 = globe.t_xyz.slice(3 * inner_t, 3 * inner_t + 3);
      const p2 = globe.t_xyz.slice(3 * outer_t, 3 * outer_t + 3);

      points.push(...p1, ...p1, ...p2, ...p2);
      widths.push(0, 2, 2, 0);
    }
  }
  return {
    points,
    widths,
  }
}

const MIN_RIVER_WIDTH = 1;
const MAX_RIVER_WIDTH = 5;


type RiverNode = {
  t: number;
  size: number;
  children: RiverNode[];
}
function createRivers(mesh: TriangleMesh, globe: Globe) {
  // map of river segment outer to inner IDs
  const riverSegmentMap = new Map<number, number[]>();
  const riverSideMap = new Map<string, number>(); // high_t.low_t => side
  for (let s = 0; s < mesh.numSides; s++) {
    if (globe.s_flow[s] > 1) {
      const inner_t = mesh.s_inner_t(s);
      const outer_t = mesh.s_outer_t(s);
      const inner_t_height = globe.t_elevation[inner_t];
      const outer_t_height = globe.t_elevation[outer_t];
      let lowest_t: number;
      let highest_t: number;
      if (inner_t_height < outer_t_height) {
        lowest_t = inner_t;
        highest_t = outer_t;
      } else {
        lowest_t = outer_t;
        highest_t = inner_t;
      }
      riverSideMap.set(`${highest_t}-${lowest_t}`, s);
      if (riverSegmentMap.has(lowest_t)) {
        riverSegmentMap.get(lowest_t).push(highest_t);
      } else {
        riverSegmentMap.set(lowest_t, [highest_t]);
      }
    }
  }

  let riverCoastPoints: number[] = []; // array of triangle IDs of river points that start on the coast
  for (let s = 0; s < mesh.numSides; s++) {
    const t = mesh.s_outer_t(s);
    const down_s = globe.t_downflow_s[t];
    const down_r_begin = globe.mesh.s_begin_r(down_s);
    const down_r_end = globe.mesh.s_end_r(down_s);

    const isCoast = globe.r_elevation[down_r_begin] <= 0 || globe.r_elevation[down_r_end] <= 0;
    if (globe.s_flow[s] > 1 && isCoast) {
      riverCoastPoints.push(t);
    }
  }

  const stepInner = (t: number): RiverNode => {
    const children = step(t);
    const size = children.length === 0 ? 0 : Math.max(...children.map(c => c.size)) + 1;
    return {
      t,
      children,
      size,
    };
  };
  const step = (t_river_point: number) => {
    const nextPoints = riverSegmentMap.get(t_river_point);
    if (nextPoints === undefined) return [];
    return nextPoints.map(stepInner);
  }

  const riverSegments = riverCoastPoints.map(stepInner);
  console.log('riverSegments', riverSegments);
  console.log('riverSideMap', riverSideMap);

  let riversSet: Set<Array<number>> = new Set();
  const stepRiver = (segment: RiverNode, riverList: number[]) => {
    riverList.push(segment.t);
    riversSet.add(riverList);
    const firstChild = segment.children[0];
    const secondChild = segment.children[1];
    if (firstChild) {
      if (!secondChild) {
        // if only one child, continue river
        stepRiver(firstChild, riverList);
      } else {
        if (firstChild.size === secondChild.size) {
          // if both children are equal, start new rivers
          stepRiver(firstChild, [segment.t]);
          stepRiver(secondChild, [segment.t]);
        } else if (firstChild.size > secondChild.size) {
          // if left child is more, continue river to the left
          stepRiver(firstChild, riverList);
          stepRiver(secondChild, [segment.t]);
        } else {
          // if right child is more, continue river to the right
          stepRiver(firstChild, [segment.t]);
          stepRiver(secondChild, riverList);
        }
      }
    }
  }

  riverSegments.forEach(segment => stepRiver(segment, []));
  console.log('rivers', riversSet);
  const river_t = Array.from(riversSet);

  const rivers: number[] = [];
  river_t.forEach(river => {
    const riverReverse = river.reverse();
    for (let t = 0; t < riverReverse.length; t++) {
      const this_t = riverReverse[t];
      const next_t = riverReverse[t + 1];
      if (!next_t) continue;

      const this_t_vec = globe.t_vec.get(this_t);
      const next_t_vec = globe.t_vec.get(next_t);
      const side1 = riverSideMap.get(`${this_t}-${next_t}`);
      const side2 = globe.mesh.s_opposite_s(side1);
      const s1_begin_r = globe.mesh.s_begin_r(side1);
      const s1_end_r = globe.mesh.s_end_r(side1);
      const s2_begin_r = globe.mesh.s_begin_r(side2);
      const s2_end_r = globe.mesh.s_end_r(side2);

      const p1 = Vector3.Lerp(this_t_vec, globe.r_vec.get(s1_begin_r), 0.1).asArray();
      const p2 = Vector3.Lerp(this_t_vec, globe.r_vec.get(s1_end_r), 0.1).asArray()
      const p3 = Vector3.Lerp(next_t_vec, globe.r_vec.get(s2_begin_r), 0.1).asArray();
      const p4 = Vector3.Lerp(next_t_vec, globe.r_vec.get(s2_end_r), 0.1).asArray();

      const center = Vector3.Lerp(this_t_vec, next_t_vec, 0.5).asArray()
      rivers.push(
        // cap
        ...p1,
        ...this_t_vec.asArray(),
        ...p2,

        ...p1,
        ...p2,
        ...center,

        ...p3,
        ...p4,
        ...center,

        ...p2,
        ...p3,
        ...center,
        
        ...p4,
        ...p1,
        ...center,

        // cap
        ...p3,
        ...next_t_vec.asArray(),
        ...p4,
      );
    }
  });
  console.log('rivers', rivers);

  return rivers;
}

function createPlateVectors(mesh: TriangleMesh, globe: Globe) {
  const line_xyz = [];
  const line_rgba = [];

  for (let r = 0; r < mesh.numRegions; r++) {
    line_xyz.push(globe.r_xyz.slice(3 * r, 3 * r + 3));
    line_rgba.push([1, 1, 1, 1]);
    line_xyz.push(
      vec3.add([] as any, globe.r_xyz.slice(3 * r, 3 * r + 3),
      vec3.scale([] as any, globe.plate_vec[globe.r_plate[r]], 2 / Math.sqrt(globe.options.sphere.numberCells)))
    );
    line_rgba.push([1, 0, 0, 0]);
  }
  return { line_xyz, line_rgba };
}

function createPlateBorders(mesh: TriangleMesh, globe: Globe) {
  const points = [];
  const widths = [];

  for (let s = 0; s < mesh.numSides; s++) {
    const begin_r = mesh.s_begin_r(s);
    const end_r = mesh.s_end_r(s);
    if (globe.r_plate[begin_r] !== globe.r_plate[end_r]) {
      let inner_t = mesh.s_inner_t(s),
        outer_t = mesh.s_outer_t(s);
      const x = globe.t_xyz.slice(3 * inner_t, 3 * inner_t + 3);
      const y = globe.t_xyz.slice(3 * outer_t, 3 * outer_t + 3);
      points.push(...x, ...x, ...y, ...y);
      widths.push(0, 3, 3, 0);
    }
  }

  return { points, widths };
}

function createCellBorders(mesh: TriangleMesh, globe: Globe) {
  const points: number[][][][] = [];

  let sides = [];
  for (let r = 0; r < mesh.numRegions * 1; r++) {
    mesh.r_circulate_s(sides, r);
    const regionPoints: number[][][] = [];
    for (let s of sides) {
      const inner_t = mesh.s_inner_t(s);
      const outer_t = mesh.s_outer_t(s);
      const p1 = globe.t_xyz.slice(3 * inner_t, 3 * inner_t + 3);
      const p2 = globe.t_xyz.slice(3 * outer_t, 3 * outer_t + 3);
      regionPoints.push([
        [p2[0], p2[1], p2[2]],
        [p1[0], p1[1], p1[2]],
      ]);
    }
    points.push(regionPoints);
  }
  return points;
}


export class Globe {
  mesh: TriangleMesh;
  r_xyz: number[];
  latlong: number[];
  triangleGeometry: Float32Array;
  minimapGeometry: Float32Array;

  t_xyz: Float32Array;
  minimap_t_xyz: Float32Array; // without height added
  minimap_r_xyz: Float32Array; // without height added
  r_elevation: Float32Array;
  t_elevation: Float32Array;
  r_moisture: Float32Array;
  t_moisture: Float32Array;
  r_biome: Float32Array;
  t_downflow_s: Int32Array;
  order_t: Int32Array;
  t_flow: Float32Array;
  s_flow: Float32Array;
  r_roughness: Float32Array;
  max_roughness: number;
  r_desirability: Float32Array;

  r_moisture_zone: number[];
  r_temperature_zone: number[];

  plate_r: Set<number>;
  r_plate: Int32Array;
  plate_vec: any[];
  plate_is_ocean: Set<unknown>;
  r_lat_long: Float32Array;
  r_temperature: number[];
  min_temperature: number;
  max_temperature: number;

  r_distance_to_ocean: number[];
  r_coast: number[];
  max_distance_to_ocean: number;
  insolation: Float32Array;
  sideTriangles: number[][][];
  cellBorders: number[][];

  mapModeColor: Float32Array;
  mapModeValue: Float32Array;
  mapModeCache: Map<EMapMode, MapModeData>;
  t_vec: Map<number, Vector3>;
  r_vec: Map<number, Vector3>;

  constructor(public options: IGlobeOptions, public mapMode: EMapMode) {
    console.log('options', options)
    console.time('make sphere');
    const { mesh, r_xyz, latlong } = makeSphere(options.sphere.numberCells, options.sphere.jitter, makeRandFloat(options.core.seed));
    console.timeEnd('make sphere');
    this.mesh = mesh;
    console.log('mesh', mesh)
    
    this.mapModeColor = new Float32Array(new SharedArrayBuffer(Float32Array.BYTES_PER_ELEMENT * this.mesh.numSides * 4 * 3));
    this.mapModeValue = new Float32Array(new SharedArrayBuffer(Float32Array.BYTES_PER_ELEMENT * this.mesh.numRegions));
    this.r_xyz = r_xyz;
    this.latlong = latlong;

    console.time('make quad geometry');
    console.timeEnd('make quad geometry');

    console.time('make triangles');
    this.t_xyz = generateTriangleCenters(mesh, this);
    console.timeEnd('make triangles');
    this.r_elevation = new Float32Array(mesh.numRegions);
    this.r_biome = new Float32Array(mesh.numRegions);
    this.r_moisture = new Float32Array(mesh.numRegions);
    this.r_roughness = new Float32Array(mesh.numRegions);
    
    this.minimap_t_xyz = new Float32Array(mesh.numTriangles);
    this.t_elevation = new Float32Array(mesh.numTriangles);
    this.t_moisture = new Float32Array(mesh.numTriangles);
    this.t_downflow_s = new Int32Array(mesh.numTriangles);
    this.order_t = new Int32Array(mesh.numTriangles);
    this.t_flow = new Float32Array(mesh.numTriangles);
    this.s_flow = new Float32Array(mesh.numSides);

    this.r_temperature = [];
    this.max_roughness = 0;

    this.r_lat_long = new Float32Array(mesh.numRegions * 2);
    for (let r = 0; r < this.mesh.numRegions; r++) {
      const x = this.r_xyz[3 * r];
      const y = this.r_xyz[3 * r + 1];
      const z = this.r_xyz[3 * r + 2];
      const [lat, long] = getLatLng([x, y, z]);
      this.r_lat_long[2 * r] = lat;
      this.r_lat_long[2 * r + 1] = long;
    }

    this.mapModeCache = new Map();
  }

  setup() {
    const { t_xyz, r_xyz, mesh } = this;
    this.sideTriangles = [];
    for (let s = 0; s < mesh.numSides; s++) {
      const inner_t = mesh.s_inner_t(s);
      const outer_t = mesh.s_outer_t(s);
      const begin_r = mesh.s_begin_r(s);
      const p1 = [t_xyz[3 * inner_t], t_xyz[3 * inner_t + 1], t_xyz[3 * inner_t + 2]];
      const p2 = [t_xyz[3 * outer_t], t_xyz[3 * outer_t + 1], t_xyz[3 * outer_t + 2]];
      const p3 = [r_xyz[3 * begin_r], r_xyz[3 * begin_r + 1], r_xyz[3 * begin_r + 2]];
      
      this.sideTriangles[s] = [p1, p2, p3];
    }

    const t_vec: Map<number, Vector3> = new Map();
    for (let t = 0; t < this.mesh.numTriangles; t++) {
      const xyz = [this.t_xyz[3 * t], this.t_xyz[3 * t + 1], this.t_xyz[3 * t + 2]];
      t_vec.set(t, new Vector3(xyz[0], xyz[1], xyz[2]));
    }

    const r_vec: Map<number, Vector3> = new Map();
    for (let r = 0; r < this.mesh.numRegions; r++) {
      const xyz = [this.r_xyz[3 * r], this.r_xyz[3 * r + 1], this.r_xyz[3 * r + 2]];
      r_vec.set(r, new Vector3(xyz[0], xyz[1], xyz[2]));
    }
    this.t_vec = t_vec;
    this.r_vec = r_vec;

    this.cellBorders = [];
    for (let r = 0; r < this.mesh.numRegions; r++) {
      this.cellBorders[r] = this.getBorderForCell(r);
    }
  }

  getLatLongForCell(cell: number): [number, number] {
    const lat = this.r_lat_long[2 * cell];
    const long = this.r_lat_long[2 * cell + 1];
    return [lat, long];
  }

  public setupMapMode() {
    const def = mapModeDefs.get(this.mapMode);
    let data: MapModeData;
    if (this.mapModeCache.has(this.mapMode)) {
      data = this.mapModeCache.get(this.mapMode);
    } else {
      data = createMapMode(this, def);
    }
    this.mapModeCache.set(this.mapMode, data);
    this.mapModeColor.set(data.rgba);
    this.mapModeValue.set(data.values);
  }

  resetMapMode(mapMode: EMapMode) {
    const def = mapModeDefs.get(mapMode);
    const data = createMapMode(this, def);
    this.mapModeCache.set(mapMode, data);
    if (this.mapMode === mapMode) {
      this.mapModeColor.set(data.rgba);
      this.mapModeValue.set(data.values);
    }
  }

  public setMapMode(mapMode: EMapMode) {
    this.mapMode = mapMode;
    this.setupMapMode();
  }

  @logGroupTime('Globe export')
  public export(): GlobeData {
    console.time('map mode colors');
    this.setupMapMode();
    console.timeEnd('map mode colors');
    
    return {
      mapModeColor: this.mapModeColor,
      mapModeValue: this.mapModeValue,
      t_xyz: this.t_xyz,
      r_xyz: new Float32Array(this.r_xyz),
      triangleGeometry: this.triangleGeometry,
      minimapGeometry: this.minimapGeometry,
      coastline: createCoastline(this.mesh, this),
      rivers: createRivers(this.mesh, this),
      plateVectors: createPlateVectors(this.mesh, this),
      plateBorders: createPlateBorders(this.mesh, this),
      cellBorders: createCellBorders(this.mesh, this),
    };
  }

  getBorderForCell(r: number) {
    let points = [];
    const sides = this.mesh.r_circulate_s([], r);
    for (const s of sides) {
      const inner_t = this.mesh.s_inner_t(s);
      const outer_t = this.mesh.s_outer_t(s);
      const p1 = this.t_xyz.slice(3 * inner_t, 3 * inner_t + 3);
      const p2 = this.t_xyz.slice(3 * outer_t, 3 * outer_t + 3);
      points.push(...p1, ...p2);
    }

    return points;
  }

  getCellData(r: number): CellGlobeData {
    return {
      lat_long: this.getLatLongForCell(r),
      temperature: this.r_temperature[r],
      moisture: this.r_moisture[r],
      elevation: this.r_elevation[r],
      distance_to_ocean: this.r_distance_to_ocean[r],
      biome: this.r_biome[r],
      desirability: this.r_desirability[r],
      insolation: this.insolation[r],
    };
  }

  getIntersectedCell(rayPoint, rayDir): CellPoints | null {
    let maxT = -1e10;
    for (let s = 0; s < this.mesh.numSides; s++) {
      const begin_r = this.mesh.s_begin_r(s);
      const t = intersectTriangle(
        rayPoint,
        rayDir,
        this.sideTriangles[s][0],
        this.sideTriangles[s][1],
        this.sideTriangles[s][2],
      );
      if (t !== null) {
        if (t > maxT) {
          maxT = t;
          return {
            cell: begin_r,
            points: this.cellBorders[begin_r],
          };
        }
      }
    }
    return null;
  }

  temperatureTick() {
    // let neighbors = [];
    let neighbors;
    for (let r = 0; r < this.mesh.numRegions; r++) {
      const r_temp = this.r_temperature[r];
      neighbors = this.mesh.r_circulate_r([], r);

      for (const nr of neighbors) {
        const nr_temp = this.r_temperature[nr];
        if (nr_temp < r_temp) {
          const part = (r_temp - nr_temp) / neighbors.length;
          this.r_temperature[r] += part;
        }
      }
    }
  }

  public coordinatesForCell(cell: number): number[] {
    const sides = [];
    this.mesh.r_circulate_s(sides, cell);
    const xyz = [];
    for (const side of sides) {
      xyz.push(...coordinateForSide(this.mesh, this, side));
    }
    return xyz;
  }
}