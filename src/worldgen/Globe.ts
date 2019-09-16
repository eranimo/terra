import TriangleMesh from '@redblobgames/dual-mesh';
import { makeRandFloat, makeRandInt } from '@redblobgames/prng';
import { makeSphere } from "../SphereMesh";
import { IGlobeOptions, moistureZoneRanges, temperatureZoneRanges, biomeRanges } from '../types';
import { getLatLng } from '../utils';
import { coordinateForSide, generateMinimapGeometry, generateNoize3D, generateTriangleCenters, generateVoronoiGeometry, QuadGeometry } from './geometry';
import { assignRegionElevation, generatePlates } from './plates';
import { assignDownflow, assignFlow, assignTriangleValues } from './rivers';
import { clamp } from 'lodash';


export class Globe {
  mesh: TriangleMesh;
  r_xyz: number[];
  latlong: number[];
  triangleGeometry: any;
  minimapGeometry: any;
  quadGeometry: QuadGeometry;

  t_xyz: number[];
  minimap_t_xyz: number[]; // without height added
  minimap_r_xyz: number[]; // without height added
  r_elevation: Float32Array;
  t_elevation: Float32Array;
  r_moisture: Float32Array;
  t_moisture: Float32Array;
  r_biome: Float32Array;
  t_downflow_s: Int32Array;
  order_t: Int32Array;
  t_flow: Float32Array;
  s_flow: Float32Array;

  r_moisture_zone: number[];
  r_temperature_zone: number[];

  plate_r: Set<number>;
  r_plate: Int32Array;
  plate_vec: any[];
  plate_is_ocean: Set<unknown>;
  r_lat_long: number[][];
  r_temperature: number[];

  constructor(public options: IGlobeOptions) {
    console.log('options', options)
    const { mesh, r_xyz, latlong } = makeSphere(options.numberCells, options.jitter, makeRandFloat(options.seed));
    this.mesh = mesh;
    console.log('mesh', mesh)
    this.r_xyz = r_xyz;
    this.latlong = latlong;
    this.quadGeometry = new QuadGeometry();
    this.quadGeometry.setMesh(mesh);

    this.t_xyz = generateTriangleCenters(mesh, this);
    this.minimap_t_xyz = null;
    this.r_elevation = new Float32Array(mesh.numRegions);
    this.t_elevation = new Float32Array(mesh.numTriangles);
    this.r_biome = new Float32Array(mesh.numRegions);
    this.r_moisture = new Float32Array(mesh.numRegions);
    this.t_moisture = new Float32Array(mesh.numTriangles);
    this.t_downflow_s = new Int32Array(mesh.numTriangles);
    this.order_t = new Int32Array(mesh.numTriangles);
    this.t_flow = new Float32Array(mesh.numTriangles);
    this.s_flow = new Float32Array(mesh.numSides);
    this.r_temperature = [];

    this.r_lat_long = [];
    for (let r = 0; r < this.mesh.numRegions; r++) {
      const x = this.r_xyz[3 * r];
      const y = this.r_xyz[3 * r + 1];
      const z = this.r_xyz[3 * r + 2];
      this.r_lat_long[r] = getLatLng([x, y, z]);
    }

    this.generateMap(options.oceanPlatePercent, options.protrudeHeight);
    this.setupGeometry();
  }

  generateMap(oceanPlatePercent: number, protrudeHeight: number) {
    let result = generatePlates(this.mesh, this.options, this.r_xyz);
    this.plate_r = result.plate_r;
    this.r_plate = result.r_plate;
    this.plate_vec = result.plate_vec;
    this.plate_is_ocean = new Set();

    // height
    for (let r of this.plate_r) {
      if (makeRandInt(r)(100) < (100 * oceanPlatePercent)) {
        this.plate_is_ocean.add(r);
        // TODO: either make tiny plates non-ocean, or make sure tiny plates don't create seeds for rivers
      }
    }
    assignRegionElevation(this.mesh, this.options, this);

    let noise3D = generateNoize3D(makeRandFloat(this.options.seed), 1 / 3, 5);

    // moisture
    for (let r = 0; r < this.mesh.numRegions; r++) {
      const x = this.r_xyz[3 * r];
      const y = this.r_xyz[3 * r + 1];
      const z = this.r_xyz[3 * r + 2];
      const [lat, long] = this.r_lat_long[r];
      const latRatio = 1 - (Math.abs(lat) / 90);
      this.r_moisture[r] = (
        ((noise3D(x / 2, y / 2, z / 2) + 1 / 2) * 0.75) +
        (latRatio * 0.25) +
        (((this.r_elevation[r] / -1) + 1 / 2) * 0.25)
      );
    }

    noise3D = generateNoize3D(makeRandFloat(this.options.seed * 2), 1 / 3, 5);

    // temperature
    for (let r = 0; r < this.mesh.numRegions; r++) {
      const x = this.r_xyz[3 * r];
      const y = this.r_xyz[3 * r + 1];
      const z = this.r_xyz[3 * r + 2];
      const altitude = 1 - Math.max(0, this.r_elevation[r]) / 1;
      const [lat, long] = this.r_lat_long[r];
      const latRatio = 1 - (Math.abs(lat) / 90);
      this.r_temperature[r] = (
        (0.25 * (noise3D(x, y, z) + 1 / 2)) +
        (0.50 * latRatio) + 
        (0.25 * altitude)
      );
    }

    // rivers
    console.time('rivers');
    assignTriangleValues(this.mesh, this);
    assignDownflow(this.mesh, this);
    assignFlow(this.mesh, this.options, this);
    console.timeEnd('rivers');

    this.minimap_t_xyz = Array.from(this.t_xyz);
    this.minimap_r_xyz = Array.from(this.r_xyz);

    this.quadGeometry.setMap(this.mesh, this, protrudeHeight);
    console.log('map', this);

    // biomes
    this.r_moisture_zone = [];
    this.r_temperature_zone = [];
    
    for (let r = 0; r < this.mesh.numRegions; r++) {
      const moisture = clamp(this.r_moisture[r], 0, 1);
      const temperature = clamp(this.r_temperature[r], 0, 1);
      let moistureZone = null;
      for (const [zone, { start, end }] of Object.entries(moistureZoneRanges)) {
        if (moisture >= start && moisture <= end) {
          moistureZone = zone;
        }
      }
      this.r_moisture_zone[r] = moistureZone;
      let temperatureZone = null;
      for (const [zone, { start, end }] of Object.entries(temperatureZoneRanges)) {
        if (temperature >= start && temperature <= end) {
          temperatureZone = zone;
        }
      }
      this.r_temperature_zone[r] = temperatureZone;
      if (moistureZone === null) {
        throw new Error(`Failed to find biome for moisture: ${moisture}`);
      }
      if (temperatureZone === null) {
        throw new Error(`Failed to find biome for temperature: ${temperature}`);
      }
      this.r_biome[r] = biomeRanges[moistureZone][temperatureZone];
    }

    // protrude
    const { numTriangles, numRegions } = this.mesh;
    const { t_xyz, r_xyz, t_elevation, r_elevation } = this;
    for (let t = 0; t < numTriangles; t++) {
      const e = Math.max(0, t_elevation[t]) * protrudeHeight * 0.2;
      t_xyz[3 * t] = t_xyz[3 * t] + (t_xyz[3 * t] * e);
      t_xyz[3 * t + 1] = t_xyz[3 * t + 1] + (t_xyz[3 * t + 1] * e);
      t_xyz[3 * t + 2] = t_xyz[3 * t + 2] + (t_xyz[3 * t + 2] * e);
    }
    for (let r = 0; r < numRegions; r++) {
      const e = Math.max(0, r_elevation[r]) * protrudeHeight * 0.2;
      r_xyz[3 * r] = r_xyz[3 * r] + (r_xyz[3 * r] * e);
      r_xyz[3 * r + 1] = r_xyz[3 * r + 1] + (r_xyz[3 * r + 1] * e);
      r_xyz[3 * r + 2] = r_xyz[3 * r + 2] + (r_xyz[3 * r + 2] * e);
    }
  }

  coordinatesForCell(cell: number) {
    const sides = [];
    this.mesh.r_circulate_s(sides, cell);
    const xyz = [];
    for (const side of sides) {
      xyz.push(...coordinateForSide(this.mesh, this, side));
    }
    return xyz;
  }

  setupGeometry() {
    const r_color_fn = (r: number) => {
      let m = this.r_moisture[r];
      let e = this.r_elevation[r];
      return [e, m];
    }

    this.triangleGeometry = generateVoronoiGeometry(this.mesh, this, r_color_fn);
    this.minimapGeometry = generateMinimapGeometry(this.mesh, this, r_color_fn);
  }
}