import TriangleMesh from '@redblobgames/dual-mesh';
import { makeRandFloat } from '@redblobgames/prng';
import { vec3 } from 'gl-matrix';
import { createMapMode, mapModeDefs, MapModeData } from '../mapModes';
import { CellPoints, EMapMode, GlobeData, IGlobeOptions, CellGlobeData } from '../types';
import { getLatLng, intersectTriangle, distance3D } from '../utils';
import { coordinateForSide, generateTriangleCenters } from './geometry';
import { makeSphere } from "./SphereMesh";
import GlobeGenWorker from 'worker-loader!./GlobeGen.worker';
import { ReactiveWorkerClient } from '../utils/workers';


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
function createRivers(mesh: TriangleMesh, globe: Globe) {
  let points = [];
  let widths = [];
  for (let s = 0; s < mesh.numSides; s++) {
    if (globe.s_flow[s] > 1) {
      let flow = 0.1 * Math.sqrt(globe.s_flow[s]);
      const inner_t = mesh.s_inner_t(s);
      const outer_t = mesh.s_outer_t(s);
      if (flow > 1) flow = 1;
      const p1 = globe.t_xyz.slice(3 * inner_t, 3 * inner_t + 3);
      const p2 = globe.t_xyz.slice(3 * outer_t, 3 * outer_t + 3);
      points.push(...p1, ...p1, ...p2, ...p2);
      const width = Math.max(MIN_RIVER_WIDTH, flow * MAX_RIVER_WIDTH);
      widths.push(0, width, width, 0);
    }
  }

  return {
    widths,
    points,
  };
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
  const points = [];
  const rgba = [];

  let sides = [];
  for (let r = 0; r < mesh.numRegions * 1; r++) {
    mesh.r_circulate_s(sides, r);
    for (let s of sides) {
      const inner_t = mesh.s_inner_t(s);
      const outer_t = mesh.s_outer_t(s);
      const p1 = globe.t_xyz.slice(3 * inner_t, 3 * inner_t + 3);
      const p2 = globe.t_xyz.slice(3 * outer_t, 3 * outer_t + 3);
      points.push(p2, p1);
      rgba.push([0, 0, 0, 0], [0, 0, 0, 0]);
    }
  }
  return { points, rgba };
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
  r_average_temperature: number[];

  r_distance_to_ocean: number[];
  r_coast: number[];
  max_distance_to_ocean: number;
  insolation: Float32Array;
  sideTriangles: number[][][];
  cellBorders: number[][];

  mapModeColor: Float32Array;
  mapModeValue: Float32Array;
  mapModeCache: Map<EMapMode, MapModeData>;

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
    this.r_average_temperature = [];
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
    console.log(this.r_temperature[r]);
    return {
      lat_long: this.getLatLongForCell(r),
      temperature: this.r_temperature[r],
      moisture: this.r_moisture[r],
      elevation: this.r_elevation[r],
      distance_to_ocean: this.r_distance_to_ocean[r],
      biome: this.r_biome[r],
      desirability: this.r_desirability[r],
      insolation: this.insolation[r],
      average_temperature: this.r_average_temperature[r],
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