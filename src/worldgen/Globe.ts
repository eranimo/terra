import TriangleMesh from '@redblobgames/dual-mesh';
import { makeRandFloat, makeRandInt } from '@redblobgames/prng';
import { makeSphere } from "../SphereMesh";
import { IGlobeOptions, moistureZoneRanges, temperatureZoneRanges, biomeRanges, EBiome, GlobeData } from '../types';
import { getLatLng, logGroupTime, arrayStats, toFloat32SAB } from '../utils';
import { coordinateForSide, generateMinimapGeometry, generateNoize3D, generateTriangleCenters, generateVoronoiGeometry, QuadGeometry } from './geometry';
import { assignRegionElevation, generatePlates } from './plates';
import { assignDownflow, assignFlow, assignTriangleValues } from './rivers';
import { clamp, isArray } from 'lodash';
import SimplexNoise from 'simplex-noise';
import FlatQueue from 'flatqueue';
import { number } from 'prop-types';
import { mapModeDefs, createMapModeColor } from '../mapModes';


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


export class Globe {
  mesh: TriangleMesh;
  r_xyz: number[];
  latlong: number[];
  triangleGeometry: {
    xyz: Float32Array,
    tm: Float32Array,
  };
  minimapGeometry: {
    xy: Float32Array,
    tm: Float32Array,
  };
  quadGeometry: QuadGeometry;

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

  r_moisture_zone: number[];
  r_temperature_zone: number[];

  plate_r: Set<number>;
  r_plate: Int32Array;
  plate_vec: any[];
  plate_is_ocean: Set<unknown>;
  r_lat_long: number[][];
  r_temperature: number[];

  r_distance_to_ocean: number[];
  r_coast: number[];
  max_distance_to_ocean: number;
  insolation: Record<number, number[]>;
  currentMonth: number;

  constructor(public options: IGlobeOptions) {
    this.currentMonth = 0;
    console.log('options', options)
    console.time('make sphere');
    const { mesh, r_xyz, latlong } = makeSphere(options.sphere.numberCells, options.sphere.jitter, makeRandFloat(options.core.seed));
    console.timeEnd('make sphere');
    this.mesh = mesh;
    console.log('mesh', mesh)

    this.r_xyz = r_xyz;
    this.latlong = latlong;

    console.time('make quad geometry');
    this.quadGeometry = new QuadGeometry();
    this.quadGeometry.setMesh(mesh);
    console.timeEnd('make quad geometry');

    console.time('make triangles');
    this.t_xyz = generateTriangleCenters(mesh, this);
    console.timeEnd('make triangles');
    this.minimap_t_xyz = new Float32Array(mesh.numTriangles);
    this.r_elevation = new Float32Array(mesh.numRegions);
    this.t_elevation = new Float32Array(mesh.numTriangles);
    this.r_biome = new Float32Array(mesh.numRegions);
    this.r_moisture = new Float32Array(mesh.numRegions);
    this.r_roughness = new Float32Array(mesh.numRegions);
    this.max_roughness = 0;
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

    this.generateMap(options.geology.oceanPlatePercent, options.sphere.protrudeHeight);
    this.setupGeometry();
  }

  @logGroupTime('map generation')
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

    
    this.generateCoastline();
    this.generateTemperature();
    this.generateInsolation();
    this.generateMoisture();
    this.generateRivers();
    this.generateBiomes();
    this.protrudeHeight();
  }

  export(): GlobeData {
    const mapModeColors: Record<string, Float32Array> = {};
    for (const [mapMode, def] of mapModeDefs) {
      mapModeColors[mapMode] = createMapModeColor(this, def);
    }
    
    
    return {
      mapModeColors,
      t_xyz: this.t_xyz,
      triangleGeometry: this.triangleGeometry,
      minimapGeometry: this.minimapGeometry,
      coastline: createCoastline(this.mesh, this),
      rivers: createRivers(this.mesh, this),
    };
  }

  /**
   * https://www.itacanet.org/the-sun-as-a-source-of-energy/part-2-solar-energy-reaching-the-earths-surface/
   */

  @logGroupTime('insolation')
  private generateInsolation() {
    this.insolation = {};

    const DAYS_PER_MONTH = 30;
    const MONTH_COUNT = 12;
    const DAYS_PER_YEAR = DAYS_PER_MONTH * MONTH_COUNT;
    const AXIAL_TILT = 22; // deg
    let randomNoise = new SimplexNoise(makeRandFloat(this.options.core.seed));

    for (let month = 0; month < MONTH_COUNT; month++) {
      const insolation: number[] = [];
      const n = (month * DAYS_PER_MONTH) + 15;
      const year_ratio = n / DAYS_PER_YEAR;
      
      for (let r = 0; r < this.mesh.numRegions; r++) {
        const x = this.r_xyz[3 * r];
        const y = this.r_xyz[3 * r + 1];
        const z = this.r_xyz[3 * r + 2];
        const [lat, long] = this.r_lat_long[r];
        const latRatio = 1 - (Math.abs(lat) / 90);
        const seasonal = (AXIAL_TILT / (5 * latRatio + 1)) * Math.cos(2 * year_ratio * Math.PI);
        const latRatioSeasonal = 1 - (Math.abs(lat - seasonal) / 90);
        const random1 = (randomNoise.noise3D(x, y, z) + 1) / 2;
        if (this.r_elevation[r] < 0) { // ocean
          const altitude = 1 + this.r_elevation[r];
          // shallow seas are warmer than deep oceans
          insolation[r] = (
            (0.10 * random1) +
            (0.20 * altitude) +
            (0.70 * latRatioSeasonal)
          );
        } else { // land
          const altitude = 1 - Math.max(0, this.r_elevation[r]);
          // higher is colder
          // lower is warmer
          insolation[r] = (
            (0.10 * random1) +
            (0.20 * altitude) +
            (0.70 * latRatioSeasonal)
          );
        }
      }

      // normalize to 0 to 1
      const { min, max, avg } = arrayStats(insolation);
      for (let i = 0; i < insolation.length; i++) {
        insolation[i] = (insolation[i] - min) / (max - min);
      }

      this.insolation[month] = insolation;
    }

    console.log('insolation', this.insolation);
  }

  private generateCoastline() {
    let r_distance_to_ocean = [];
    let r_coast = [];
    const queue = new FlatQueue();
    for (let r = 0; r < this.mesh.numRegions; r++) {
      if (this.r_elevation[r] >= 0) {
        let numOceanNeighbors = 0;
        const neighbors = this.mesh.r_circulate_r([], r);
        for (const nr of neighbors) {
          if (this.r_elevation[nr] < 0) {
            numOceanNeighbors++;
          }
        }

        r_coast[r] = numOceanNeighbors > 0;
        if (r_coast[r]) {
          r_distance_to_ocean[r] = 1;
        }
      }
    }
    // initialize the queue with the next-most land cells next to coast cells
    for (let r = 0; r < this.mesh.numRegions; r++) {
      if (r_coast[r]) {
        const neighbors = this.mesh.r_circulate_r([], r);
        for (const nr of neighbors) {
          // if land and not coastline
          if (r_coast[nr] === false && this.r_elevation[nr] >= 0) {
            r_distance_to_ocean[nr] = 2;
            queue.push(nr, 2);
          }
        }
      }
    }

    console.log('items in queue', queue.length);

    // loop through land cells, calculating distance to ocean
    while (queue.length) {
      const r = queue.pop();
      const myDistance = r_distance_to_ocean[r];

      const neighbors = this.mesh.r_circulate_r([], r);
      for (const nr of neighbors) {
        // if land and not visited yet
        if (r_distance_to_ocean[nr] === undefined && this.r_elevation[nr] >= 0) {
          r_distance_to_ocean[nr] = myDistance + 1;
          queue.push(nr, r_distance_to_ocean[nr]);
        }
      }
    }

    const maxDistanceToOcean = Math.max(...Object.values(r_distance_to_ocean));
    console.log(`Max distance to ocean: ${maxDistanceToOcean}`);

    this.r_distance_to_ocean = r_distance_to_ocean;
    this.r_coast = r_coast;
    this.max_distance_to_ocean = maxDistanceToOcean;
  }

  @logGroupTime('moisture', true)
  private generateMoisture() {
    /**
     * Higher altitude = lower moisture
     * Closer to ocean = higher moisture
     * Lower latitudes = higher moisture
     */

    let randomNoise = new SimplexNoise(makeRandFloat(this.options.core.seed));
    const MODIFIER = this.options.hydrology.moistureModifier;
    const VARIANCE = 0.15;

    // moisture
    for (let r = 0; r < this.mesh.numRegions; r++) {
      // const x = this.r_xyz[3 * r];
      // const y = this.r_xyz[3 * r + 1];
      // const z = this.r_xyz[3 * r + 2];
      const [lat, long] = this.r_lat_long[r];
      const latRatio = 1 - (Math.abs(lat) / 90);
      const random1 = randomNoise.noise2D(lat / (1000 * VARIANCE), long / (1000 * VARIANCE))
      const altitude = 1 - Math.max(0, this.r_elevation[r]);
      if (this.r_elevation[r] >= 0) {
        const inlandRatio = 1 - (this.r_distance_to_ocean[r] / this.max_distance_to_ocean);
        this.r_moisture[r] = clamp(
          (((latRatio + inlandRatio) / 3) +
          (random1 / 2)) * altitude
        , 0, 1);
      }
    }


    const moisture_min = Math.min(...this.r_moisture.filter(i => i));
    const moisture_max = Math.max(...this.r_moisture.filter(i => i));
    console.log('min moisture', moisture_min);
    console.log('max moisture', moisture_max);
    // normalize moisture
    for (let r = 0; r < this.mesh.numRegions; r++) {
      if (this.r_elevation[r] >= 0) {
        this.r_moisture[r] = (this.r_moisture[r] - moisture_min) / (moisture_max - moisture_min);
        this.r_moisture[r] += this.r_moisture[r] * MODIFIER;
        this.r_moisture[r] = clamp(this.r_moisture[r], 0, 1);
      }
    }

    randomNoise = new SimplexNoise(makeRandFloat(this.options.core.seed * 2));
  }

  @logGroupTime('temperature', true)
  private generateTemperature() {
    let randomNoise = new SimplexNoise(makeRandFloat(this.options.core.seed));
    // temperature
    for (let r = 0; r < this.mesh.numRegions; r++) {
      const x = this.r_xyz[3 * r];
      const y = this.r_xyz[3 * r + 1];
      const z = this.r_xyz[3 * r + 2];
      const altitude = 1 - Math.max(0, this.r_elevation[r]);
      const [lat, long] = this.r_lat_long[r];
      const latRatio = 1 - (Math.abs(lat) / 90);
      const random1 = (randomNoise.noise3D(x, y, z) + 1) / 2;
      if (this.r_elevation[r] < 0) { // ocean
        const altitude = 1 + this.r_elevation[r];
        // shallow seas are warmer than deep oceans
        this.r_temperature[r] = (
          (0.10 * random1) +
          (0.20 * altitude) +
          (0.70 * latRatio)
        );
      } else { // land
        const altitude = 1 - Math.max(0, this.r_elevation[r]);
        // higher is colder
        // lower is warmer
        this.r_temperature[r] = (
          (0.10 * random1) +
          (0.20 * altitude) +
          (0.70 * latRatio)
        );
      }

      this.r_temperature[r] += this.r_temperature[r] * this.options.climate.temperatureModifier;
      this.r_temperature[r] = clamp(this.r_temperature[r], 0, 1);
    }

    const temperature_min = Math.min(...this.r_temperature.filter(i => i));
    const temperature_max = Math.max(...this.r_temperature.filter(i => i));
    console.log('min temperature', temperature_min);
    console.log('max temperature', temperature_max);

    for (let r = 0; r < this.mesh.numRegions; r++) {
      this.r_temperature[r] = (this.r_temperature[r] - temperature_min) / (temperature_max - temperature_min);
    }
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

  @logGroupTime('rivers', true)
  private generateRivers() {
    // rivers
    assignTriangleValues(this.mesh, this);
    assignDownflow(this.mesh, this);
    for(let i = 0; i < 2; i++) assignFlow(this.mesh, this.options, this);

    this.minimap_t_xyz = new Float32Array(Array.from(this.t_xyz));
    this.minimap_r_xyz = new Float32Array(Array.from(this.r_xyz));

    this.quadGeometry.setMap(this.mesh, this, this.options.sphere.protrudeHeight);
    console.log('map', this);

    // terrain roughness
    for (let r = 0; r < this.mesh.numRegions; r++) {
      const height = this.r_elevation[r];
      const triangles = this.mesh.r_circulate_t([], r);
      let roughness = 0;
      for (const t of triangles) {
        roughness += Math.abs(height - this.t_elevation[t]);
      }
      this.r_roughness[r] = roughness;
      if (this.max_roughness < roughness) {
        this.max_roughness = roughness;
      }
    }
  }

  @logGroupTime('biomes', true)
  private generateBiomes() {
    // biomes
    this.r_moisture_zone = [];
    this.r_temperature_zone = [];
    
    for (let r = 0; r < this.mesh.numRegions; r++) {
      if (this.r_elevation[r] < 0 && this.r_temperature[r] < 0.15) {
        this.r_biome[r] = EBiome.GLACIAL;
        continue;
      }

      if (this.r_elevation[r] < -0.1) {
        this.r_biome[r] = EBiome.OCEAN;
      } else if (this.r_elevation[r] < 0) {
        this.r_biome[r] = EBiome.COAST;
      } else {
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
        const biomeTempMoisture = biomeRanges[moistureZone][temperatureZone];
        if (isArray(biomeTempMoisture)) {
          let landType = 0;
          if (this.r_elevation[r] < 0.6) {
            landType = 1;
          } else if (this.r_elevation[r] < 0.9) {
            landType = 2;
          }
          this.r_biome[r] = biomeTempMoisture[landType];
        } else {
          this.r_biome[r] = biomeTempMoisture;
        }
      }
    }
  }

  @logGroupTime('protrude height', true)
  private protrudeHeight() {
    // protrude
    const { numTriangles, numRegions } = this.mesh;
    const { t_xyz, r_xyz, t_elevation, r_elevation } = this;
    for (let t = 0; t < numTriangles; t++) {
      const e = Math.max(0, t_elevation[t]) * this.options.sphere.protrudeHeight * 0.2;
      t_xyz[3 * t] = t_xyz[3 * t] + (t_xyz[3 * t] * e);
      t_xyz[3 * t + 1] = t_xyz[3 * t + 1] + (t_xyz[3 * t + 1] * e);
      t_xyz[3 * t + 2] = t_xyz[3 * t + 2] + (t_xyz[3 * t + 2] * e);
    }
    for (let r = 0; r < numRegions; r++) {
      const e = Math.max(0, r_elevation[r]) * this.options.sphere.protrudeHeight * 0.2;
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

  @logGroupTime('setup geometry')
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