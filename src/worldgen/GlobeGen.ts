import { makeRandFloat, makeRandInt } from '@redblobgames/prng';
import FlatQueue from 'flatqueue';
import { clamp, isArray } from 'lodash';
import SimplexNoise from 'simplex-noise';
import { biomeRanges, EBiome, EMapMode, IGlobeOptions, moistureZoneRanges, temperatureZoneRanges } from '../types';
import { arrayStats, logGroupTime, getLatLng } from '../utils';
import { Globe } from './Globe';
import { assignRegionElevation, generatePlates } from './plates';
import { assignDownflow, assignFlow, assignTriangleValues } from './rivers';
import { generateVoronoiGeometry, generateMinimapGeometry } from './geometry';


export class GlobeGen {
  globe: Globe;

  generate(options: IGlobeOptions, mapMode: EMapMode) {
    this.globe = new Globe(options, mapMode);
    this.generatePlates();
    this.generateCoastline();
    this.generateTemperature();
    this.generateMoisture();
    this.generateRivers();
    this.generateBiomes();
    this.generatePops();
    this.protrudeHeight();
    this.setupGeometry();

    return this.globe;
  }

  update(year_ratio: number) {
    this.generateInsolation(year_ratio);
  }

  @logGroupTime('setup geometry')
  private setupGeometry() {
    const r_color_fn = (r: number) => {
      let m = this.globe.r_moisture[r];
      let e = this.globe.r_elevation[r];
      return [e, m];
    }

    this.globe.triangleGeometry = generateVoronoiGeometry(this.globe.mesh, this.globe, r_color_fn);
    this.globe.minimapGeometry = generateMinimapGeometry(this.globe.mesh, this.globe, r_color_fn);
  }

  // https://www.itacanet.org/the-sun-as-a-source-of-energy/part-2-solar-energy-reaching-the-earths-surface/
  @logGroupTime('insolation')
  generateInsolation(year_ratio) {
    const globe = this.globe;
    globe.insolation = new Float32Array(Float32Array.BYTES_PER_ELEMENT * globe.mesh.numRegions);

    const AXIAL_TILT = 22; // deg
    const seasonalRatio: number = -AXIAL_TILT * Math.cos(2 * year_ratio * Math.PI);
    console.log(year_ratio);
    console.log(seasonalRatio);
    let randomNoise = new SimplexNoise(makeRandFloat(globe.options.core.seed));
      
    for (let r = 0; r < globe.mesh.numRegions; r++) {
      const x = globe.r_xyz[3 * r];
      const y = globe.r_xyz[3 * r + 1];
      const z = globe.r_xyz[3 * r + 2];
      const [lat, long] = globe.getLatLongForCell(r);
      const latRatioSeasonal = Math.max(0, Math.cos((lat - seasonalRatio) * Math.PI / 180));
      const random1 = (randomNoise.noise3D(x, y, z) + 1) / 2;

      if (globe.r_elevation[r] < 0) { // ocean
        const altitude = 1 + globe.r_elevation[r];
        // shallow seas are warmer than deep oceans
        globe.insolation[r] = (
          (0.05 * random1) +
          (0.20 * altitude) +
          (0.75 * latRatioSeasonal)
        );
      } else { // land
        const altitude = 1 - Math.max(0, globe.r_elevation[r]);
        // higher is colder
        // lower is warmer
        globe.insolation[r] = (
          (0.05 * random1) +
          (0.20 * altitude) +
          (0.75 * latRatioSeasonal)
        );
      }
    }

    // normalize to 0 to 1
    const { min, max, avg } = arrayStats(globe.insolation);
    for (let i = 0; i < globe.insolation.length; i++) {
      globe.insolation[i] = (globe.insolation[i] - min) / (max - min);
    }
  }

  generatePlates() {
    const globe = this.globe;

    let result = generatePlates(globe.mesh, globe.options, globe.r_xyz);
    globe.plate_r = result.plate_r;
    globe.r_plate = result.r_plate;
    globe.plate_vec = result.plate_vec;
    globe.plate_is_ocean = new Set();

    // height
    for (let r of globe.plate_r) {
      if (makeRandInt(r)(100) < (100 * globe.options.geology.oceanPlatePercent)) {
        globe.plate_is_ocean.add(r);
        // TODO: either make tiny plates non-ocean, or make sure tiny plates don't create seeds for rivers
      }
    }
    assignRegionElevation(globe.mesh, globe.options, globe);
  }

  private generateCoastline() {
    let r_distance_to_ocean = [];
    let r_coast = [];
    const queue = new FlatQueue();
    for (let r = 0; r < this.globe.mesh.numRegions; r++) {
      if (this.globe.r_elevation[r] >= 0) {
        let numOceanNeighbors = 0;
        const neighbors = this.globe.mesh.r_circulate_r([], r);
        for (const nr of neighbors) {
          if (this.globe.r_elevation[nr] < 0) {
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
    for (let r = 0; r < this.globe.mesh.numRegions; r++) {
      if (r_coast[r]) {
        const neighbors = this.globe.mesh.r_circulate_r([], r);
        for (const nr of neighbors) {
          // if land and not coastline
          if (r_coast[nr] === false && this.globe.r_elevation[nr] >= 0) {
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

      const neighbors = this.globe.mesh.r_circulate_r([], r);
      for (const nr of neighbors) {
        // if land and not visited yet
        if (r_distance_to_ocean[nr] === undefined && this.globe.r_elevation[nr] >= 0) {
          r_distance_to_ocean[nr] = myDistance + 1;
          queue.push(nr, r_distance_to_ocean[nr]);
        }
      }
    }

    const maxDistanceToOcean = Math.max(...Object.values(r_distance_to_ocean));
    console.log(`Max distance to ocean: ${maxDistanceToOcean}`);

    this.globe.r_distance_to_ocean = r_distance_to_ocean;
    this.globe.r_coast = r_coast;
    this.globe.max_distance_to_ocean = maxDistanceToOcean;
  }

  @logGroupTime('moisture', true)
  private generateMoisture() {
    /**
     * Higher altitude = lower moisture
     * Closer to ocean = higher moisture
     * Lower latitudes = higher moisture
     */

    let randomNoise = new SimplexNoise(makeRandFloat(this.globe.options.core.seed));
    const MODIFIER = this.globe.options.hydrology.moistureModifier;
    const VARIANCE = 0.15;

    // moisture
    for (let r = 0; r < this.globe.mesh.numRegions; r++) {
      // const x = this.globe.r_xyz[3 * r];
      // const y = this.globe.r_xyz[3 * r + 1];
      // const z = this.globe.r_xyz[3 * r + 2];
      const [lat, long] = this.globe.getLatLongForCell(r);
      const latRatio = 1 - (Math.abs(lat) / 90);
      const random1 = randomNoise.noise2D(lat / (1000 * VARIANCE), long / (1000 * VARIANCE))
      const altitude = 1 - Math.max(0, this.globe.r_elevation[r]);
      if (this.globe.r_elevation[r] >= 0) {
        const inlandRatio = 1 - (this.globe.r_distance_to_ocean[r] / this.globe.max_distance_to_ocean);
        this.globe.r_moisture[r] = clamp(
          (((latRatio + inlandRatio) / 3) +
          (random1 / 2)) * altitude
        , 0, 1);
      }
    }


    const moisture_min = Math.min(...this.globe.r_moisture.filter(i => i));
    const moisture_max = Math.max(...this.globe.r_moisture.filter(i => i));
    console.log('min moisture', moisture_min);
    console.log('max moisture', moisture_max);
    // normalize moisture
    for (let r = 0; r < this.globe.mesh.numRegions; r++) {
      if (this.globe.r_elevation[r] >= 0) {
        this.globe.r_moisture[r] = (this.globe.r_moisture[r] - moisture_min) / (moisture_max - moisture_min);
        this.globe.r_moisture[r] += this.globe.r_moisture[r] * MODIFIER;
        this.globe.r_moisture[r] = clamp(this.globe.r_moisture[r], 0, 1);
      }
    }

    randomNoise = new SimplexNoise(makeRandFloat(this.globe.options.core.seed * 2));
  }

  @logGroupTime('temperature', true)
  private generateTemperature() {
    let randomNoise = new SimplexNoise(makeRandFloat(this.globe.options.core.seed));
    // temperature
    for (let r = 0; r < this.globe.mesh.numRegions; r++) {
      const x = this.globe.r_xyz[3 * r];
      const y = this.globe.r_xyz[3 * r + 1];
      const z = this.globe.r_xyz[3 * r + 2];
      const altitude = 1 - Math.max(0, this.globe.r_elevation[r]);
      const [lat, long] = this.globe.getLatLongForCell(r);
      const latRatio = 1 - (Math.abs(lat) / 90);
      const random1 = (randomNoise.noise3D(x, y, z) + 1) / 2;
      if (this.globe.r_elevation[r] < 0) { // ocean
        const altitude = 1 + this.globe.r_elevation[r];
        // shallow seas are warmer than deep oceans
        this.globe.r_temperature[r] = (
          (0.10 * random1) +
          (0.20 * altitude) +
          (0.70 * latRatio)
        );
      } else { // land
        const altitude = 1 - Math.max(0, this.globe.r_elevation[r]);
        // higher is colder
        // lower is warmer
        this.globe.r_temperature[r] = (
          (0.10 * random1) +
          (0.20 * altitude) +
          (0.70 * latRatio)
        );
      }

      this.globe.r_temperature[r] += this.globe.r_temperature[r] * this.globe.options.climate.temperatureModifier;
      this.globe.r_temperature[r] = clamp(this.globe.r_temperature[r], 0, 1);
    }


    const { min, max } = arrayStats(this.globe.r_temperature);

    for (let r = 0; r < this.globe.mesh.numRegions; r++) {
      this.globe.r_temperature[r] = (this.globe.r_temperature[r] - min) / (max - min);
    }
  }

  @logGroupTime('generate pops', true)
  private generatePops() {

    // calculate land desirability
    this.globe.r_desirability = new Float32Array(this.globe.mesh.numRegions);

    for (let r = 0; r < this.globe.mesh.numRegions; r++) {
      if (this.globe.r_elevation[r] < 0) {
        this.globe.r_desirability[r] = 0;
        continue;
      }

      // Elevation:
      // 1 at lowest elevation
      // 0 at highest elevation
      // shape: linear
      const elevation_value = 1 - this.globe.r_elevation[r];

      // Temperature:
      // 0 at 0 and 1 temperature (extremes)
      // 100 at 0.5 temperature (temperate)
      // shape: sine
      const temperature_value = Math.sin(this.globe.r_temperature[r] * Math.PI);

      // Moisture:
      // 0 at 0 moisture
      // 100 at 1 moisture
      // shape: linear
      const moisture_value = this.globe.r_moisture[r];

      this.globe.r_desirability[r] = elevation_value * temperature_value * moisture_value;
    }

    console.log('desirability', arrayStats(this.globe.r_desirability));


    // generate pops at desirable locations

    const POP_CELLS = 10;  // number of cells to put pops
    const POP_SIZE = [100, 1000] // population size of each pop
    const POPS_PER_CELL = 5; // number of pops to add at each cell

  }

  @logGroupTime('rivers', true)
  private generateRivers() {
    // rivers
    assignTriangleValues(this.globe.mesh, this.globe);
    assignDownflow(this.globe.mesh, this.globe);
    for(let i = 0; i < 2; i++) assignFlow(this.globe.mesh, this.globe.options, this.globe);

    this.globe.minimap_t_xyz = new Float32Array(Array.from(this.globe.t_xyz));
    this.globe.minimap_r_xyz = new Float32Array(Array.from(this.globe.r_xyz));
    console.log('map', this.globe);

    // terrain roughness
    for (let r = 0; r < this.globe.mesh.numRegions; r++) {
      const height = this.globe.r_elevation[r];
      const triangles = this.globe.mesh.r_circulate_t([], r);
      let roughness = 0;
      for (const t of triangles) {
        roughness += Math.abs(height - this.globe.t_elevation[t]);
      }
      this.globe.r_roughness[r] = roughness;
      if (this.globe.max_roughness < roughness) {
        this.globe.max_roughness = roughness;
      }
    }
  }

  @logGroupTime('biomes', true)
  private generateBiomes() {
    // biomes
    this.globe.r_moisture_zone = [];
    this.globe.r_temperature_zone = [];
    
    for (let r = 0; r < this.globe.mesh.numRegions; r++) {
      if (this.globe.r_elevation[r] < 0 && this.globe.r_temperature[r] < 0.15) {
        this.globe.r_biome[r] = EBiome.GLACIAL;
        continue;
      }

      if (this.globe.r_elevation[r] < -0.1) {
        this.globe.r_biome[r] = EBiome.OCEAN;
      } else if (this.globe.r_elevation[r] < 0) {
        this.globe.r_biome[r] = EBiome.COAST;
      } else {
        const moisture = clamp(this.globe.r_moisture[r], 0, 1);
        const temperature = clamp(this.globe.r_temperature[r], 0, 1);
        let moistureZone = null;
        for (const [zone, { start, end }] of Object.entries(moistureZoneRanges)) {
          if (moisture >= start && moisture <= end) {
            moistureZone = zone;
          }
        }
        this.globe.r_moisture_zone[r] = moistureZone;
        let temperatureZone = null;
        for (const [zone, { start, end }] of Object.entries(temperatureZoneRanges)) {
          if (temperature >= start && temperature <= end) {
            temperatureZone = zone;
          }
        }
        this.globe.r_temperature_zone[r] = temperatureZone;
        if (moistureZone === null) {
          throw new Error(`Failed to find biome for moisture: ${moisture}`);
        }
        if (temperatureZone === null) {
          throw new Error(`Failed to find biome for temperature: ${temperature}`);
        }
        const biomeTempMoisture = biomeRanges[moistureZone][temperatureZone];
        if (isArray(biomeTempMoisture)) {
          let landType = 0;
          if (this.globe.r_elevation[r] < 0.6) {
            landType = 1;
          } else if (this.globe.r_elevation[r] < 0.9) {
            landType = 2;
          }
          this.globe.r_biome[r] = biomeTempMoisture[landType];
        } else {
          this.globe.r_biome[r] = biomeTempMoisture;
        }
      }
    }
  }

  @logGroupTime('protrude height', true)
  private protrudeHeight() {
    // protrude
    const { numTriangles, numRegions } = this.globe.mesh;
    const { t_xyz, r_xyz, t_elevation, r_elevation } = this.globe;
    for (let t = 0; t < numTriangles; t++) {
      const e = Math.max(0, t_elevation[t]) * this.globe.options.sphere.protrudeHeight * 0.2;
      t_xyz[3 * t] = t_xyz[3 * t] + (t_xyz[3 * t] * e);
      t_xyz[3 * t + 1] = t_xyz[3 * t + 1] + (t_xyz[3 * t + 1] * e);
      t_xyz[3 * t + 2] = t_xyz[3 * t + 2] + (t_xyz[3 * t + 2] * e);
    }
    for (let r = 0; r < numRegions; r++) {
      const e = Math.max(0, r_elevation[r]) * this.globe.options.sphere.protrudeHeight * 0.2;
      r_xyz[3 * r] = r_xyz[3 * r] + (r_xyz[3 * r] * e);
      r_xyz[3 * r + 1] = r_xyz[3 * r + 1] + (r_xyz[3 * r + 1] * e);
      r_xyz[3 * r + 2] = r_xyz[3 * r + 2] + (r_xyz[3 * r + 2] * e);
    }
  }

}