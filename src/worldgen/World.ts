import TriangleMesh from '@redblobgames/dual-mesh';
import { makeRandFloat } from '@redblobgames/prng';
import { vec3 } from 'gl-matrix';
import { createMapMode, mapModeDefs, MapModeData } from '../mapModes';
import { CellPoints, EMapMode, WorldData, IGlobeOptions, CellGlobeData, River, Arrow, WorldExport } from '../types';
import { getLatLng, intersectTriangle, distance3D, logGroupTime, logFuncTime } from '../utils';
import { coordinateForSide, generateTriangleCenters } from './geometry';
import { makeSphere } from "./SphereMesh";
import { Vector3, Quaternion } from "@babylonjs/core/Maths/math";
import { generateVoronoiGeometry, generateMinimapGeometry } from './geometry';

function createCoastline(mesh: TriangleMesh, globe: World) {
  let points = [];

  for (let s = 0; s < mesh.numSides; s++) {
    const begin_r = mesh.s_begin_r(s);
    const end_r = mesh.s_end_r(s);

    if (globe.r_elevation[begin_r] < 0 && globe.r_elevation[end_r] >= 0) {
      const inner_t = mesh.s_inner_t(s);
      const outer_t = mesh.s_outer_t(s);
      const p1 = globe.t_xyz.slice(3 * inner_t, 3 * inner_t + 3);
      const p2 = globe.t_xyz.slice(3 * outer_t, 3 * outer_t + 3);

      points.push([ p1, p2 ]);
    }
  }
  return points;
}

const MIN_RIVER_WIDTH = 0;
const MAX_RIVER_WIDTH = 3;


type RiverNode = {
  t: number;
  size: number;
  children: RiverNode[];
}
type RiverPoint = {
  t: number;
  size: number
}

function createRivers(mesh: TriangleMesh, globe: World) {
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
  // console.log('riverSegments', riverSegments);
  // console.log('riverSideMap', riverSideMap);

  let riversSet: Set<Array<RiverPoint>> = new Set();
  const stepRiver = (segment: RiverNode, riverList: RiverPoint[]) => {
    const riverPoint = {
      t: segment.t,
      size: segment.size,
    };
    riverList.push(riverPoint);
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
          stepRiver(firstChild, [riverPoint]);
          stepRiver(secondChild, [riverPoint]);
        } else if (firstChild.size > secondChild.size) {
          // if left child is more, continue river to the left
          stepRiver(firstChild, riverList);
          stepRiver(secondChild, [riverPoint]);
        } else {
          // if right child is more, continue river to the right
          stepRiver(firstChild, [riverPoint]);
          stepRiver(secondChild, riverList);
        }
      }
    }
  }

  riverSegments.forEach(segment => stepRiver(segment, []));
  // console.log('rivers', riversSet);
  const river_t = Array.from(riversSet);

  const rivers: River[] = [];
  for (const river of river_t) {
    const points = [];
    const widths = [];
    for (const point of river) {
      points.push(globe.t_vec.get(point.t).asArray());
      let flow = 0.1 * Math.sqrt(globe.t_flow[point.t]);
      widths.push(Math.max(MIN_RIVER_WIDTH, Math.min(1, flow) * MAX_RIVER_WIDTH));
    }

    rivers.push({
      length: river[0].size,
      widths,
      points,
    });
  }

  return rivers;
}

function createPlateVectors(mesh: TriangleMesh, globe: World) {
  const arrows: Arrow[] = [];

  for (let r = 0; r < mesh.numRegions; r++) {
    const positionList = globe.r_xyz.slice(3 * r, 3 * r + 3);
    const position = vec3.fromValues(positionList[0], positionList[1], positionList[2]);
    const destination = globe.plate_vec[globe.r_plate[r]];

    const rotation = destination;
    arrows.push({
      color: [1, 1, 1, 1],
      position: [position[0], position[1], position[2]],
      rotation: [rotation[0], rotation[1], rotation[2]],
    });
  }

  return arrows;
}

function createPlateBorders(mesh: TriangleMesh, globe: World) {
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

function createCellBorders(mesh: TriangleMesh, globe: World) {
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


export class World {
  mesh: TriangleMesh;
  r_xyz: Float32Array;
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
  plate_vec: Record<number, number[]>;
  plate_is_ocean: Set<number>;
  r_lat_long: Float32Array;
  r_temperature: Float32Array;
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

  public options: IGlobeOptions;
  public mapMode: EMapMode;

  constructor(options: IGlobeOptions, mapMode: EMapMode) {
    this.options = options;
    this.mapMode = mapMode;

    // make sphere
    console.time('make sphere');
    const { mesh, r_xyz } = makeSphere(options.sphere.numberCells, options.sphere.jitter, makeRandFloat(options.core.seed));
    console.log('mesh', mesh);
    console.timeEnd('make sphere');
    this.mesh = mesh;
    
    // make triangles
    this.r_xyz = new Float32Array(r_xyz);
    console.time('make triangles');
    this.t_xyz = generateTriangleCenters(mesh, this);
    console.timeEnd('make triangles');


    this.mapModeColor = new Float32Array(new SharedArrayBuffer(Float32Array.BYTES_PER_ELEMENT * this.mesh.numSides * 4 * 3));
    this.mapModeValue = new Float32Array(new SharedArrayBuffer(Float32Array.BYTES_PER_ELEMENT * this.mesh.numRegions));
    this.mapModeCache = new Map();
  }

  static create(options: IGlobeOptions, mapMode: EMapMode): World {
    const world = new World(options, mapMode);
    const mesh = world.mesh;
    world.r_elevation = new Float32Array(mesh.numRegions);
    world.r_biome = new Float32Array(mesh.numRegions);
    world.r_moisture = new Float32Array(mesh.numRegions);
    world.r_roughness = new Float32Array(mesh.numRegions);
    world.minimap_t_xyz = new Float32Array(mesh.numTriangles);
    world.minimap_t_xyz = new Float32Array(mesh.numTriangles);
    world.plate_vec = {};
    world.t_elevation = new Float32Array(mesh.numTriangles);
    world.t_moisture = new Float32Array(mesh.numTriangles);
    world.t_downflow_s = new Int32Array(mesh.numTriangles);
    world.order_t = new Int32Array(mesh.numTriangles);
    world.t_flow = new Float32Array(mesh.numTriangles);
    world.s_flow = new Float32Array(mesh.numSides);

    world.r_temperature = new Float32Array(world.mesh.numRegions);
    world.max_roughness = 0;

    world.r_lat_long = new Float32Array(mesh.numRegions * 2);
    for (let r = 0; r < world.mesh.numRegions; r++) {
      const x = world.r_xyz[3 * r];
      const y = world.r_xyz[3 * r + 1];
      const z = world.r_xyz[3 * r + 2];
      const [lat, long] = getLatLng([x, y, z]);
      world.r_lat_long[2 * r] = lat;
      world.r_lat_long[2 * r + 1] = long;
    }
    return world;
  }

  static load(exportedGlobe: WorldExport, mapMode: EMapMode) {
    const world = new World(exportedGlobe.options, mapMode);
    world.r_elevation = exportedGlobe.r_elevation;
    world.r_biome = exportedGlobe.r_biome;
    world.r_moisture = exportedGlobe.r_moisture;
    world.r_roughness = exportedGlobe.r_roughness;
    world.minimap_t_xyz = exportedGlobe.minimap_t_xyz;
    world.minimap_r_xyz = exportedGlobe.minimap_r_xyz;
    world.plate_vec = exportedGlobe.plate_vec;
    world.t_elevation = exportedGlobe.t_elevation;
    world.t_moisture = exportedGlobe.t_moisture;
    world.t_downflow_s = exportedGlobe.t_downflow_s;
    world.order_t = exportedGlobe.order_t;
    world.t_flow = exportedGlobe.t_flow;
    world.s_flow = exportedGlobe.s_flow;
    world.r_plate = exportedGlobe.r_plate;
    world.plate_is_ocean = new Set(exportedGlobe.plate_is_ocean);
    world.r_desirability = exportedGlobe.r_desirability;
    world.r_temperature = exportedGlobe.r_temperature;
    world.insolation = exportedGlobe.insolation;
    world.r_lat_long = exportedGlobe.r_lat_long;
    world.min_temperature = exportedGlobe.min_temperature;
    world.max_temperature = exportedGlobe.max_temperature;
    world.setup();
    return world;
  }

  // post GlobeGen setup
  setup() {
    const r_color_fn = (r: number) => {
      let m = this.r_moisture[r];
      let e = this.r_elevation[r];
      return [e, m];
    }

    this.triangleGeometry = generateVoronoiGeometry(this.mesh, this, r_color_fn);
    this.minimapGeometry = generateMinimapGeometry(this.mesh, this, r_color_fn);

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
    console.log('WORLD', this);
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
      console.log(`Setting up map mode ${this.mapMode}`);
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

  public export(): WorldExport {
    return {
      options: this.options,
      r_elevation: this.r_elevation,
      r_biome: this.r_biome,
      r_moisture: this.r_moisture,
      r_roughness: this.r_roughness,
      minimap_t_xyz: this.minimap_t_xyz,
      minimap_r_xyz: this.minimap_r_xyz,
      plate_vec: this.plate_vec,
      t_elevation: this.t_elevation,
      t_moisture: this.t_moisture,
      t_downflow_s: this.t_downflow_s,
      order_t: this.order_t,
      t_flow: this.t_flow,
      s_flow: this.s_flow,
      r_lat_long: this.r_lat_long,
      r_plate: this.r_plate,
      plate_is_ocean: Array.from(this.plate_is_ocean),
      r_desirability: this.r_desirability,
      r_temperature: this.r_temperature,
      min_temperature: this.min_temperature,
      max_temperature: this.max_temperature,
      insolation: this.insolation,
    }
  }

  @logGroupTime('Get Globe Data')
  public getData(): WorldData {
    console.time('map mode colors');
    this.setupMapMode();
    console.timeEnd('map mode colors');

    const sideToCell = new Int32Array(Int32Array.BYTES_PER_ELEMENT * this.mesh.numSides);

    for (let r = 0; r < this.mesh.numRegions; r++) {
      const sides = this.mesh.r_circulate_s([], r);
      for (let r_s = 0; r_s < sides.length; r_s++) {
        const side = sides[r_s];
        sideToCell[side] = r;
      }
    }
    
    return {
      mapModeColor: this.mapModeColor,
      mapModeValue: this.mapModeValue,
      t_xyz: this.t_xyz,
      r_xyz: this.r_xyz,
      triangleGeometry: this.triangleGeometry,
      minimapGeometry: this.minimapGeometry,
      coastline: logFuncTime('createCoastline', () => createCoastline(this.mesh, this)),
      rivers: logFuncTime('createRivers', () => createRivers(this.mesh, this)),
      plateVectors: logFuncTime('createPlateVectors', () => createPlateVectors(this.mesh, this)),
      plateBorders: logFuncTime('createPlateBorders', () => createPlateBorders(this.mesh, this)),
      cellBorders: logFuncTime('createCellBorders', () => createCellBorders(this.mesh, this)),
      sideToCell,
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