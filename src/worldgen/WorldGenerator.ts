import { makeRandFloat, makeRandInt } from '@redblobgames/prng';
import FlatQueue from 'flatqueue';
import { clamp, isArray } from 'lodash';
import SimplexNoise from 'simplex-noise';
import { biomeRanges, EBiome, EMapMode, IGlobeOptions, moistureZoneRanges, temperatureZoneRanges } from '../types';
import { arrayStats, logGroupTime, getLatLng } from '../utils';
import { World } from './World';
import { assignRegionElevation, generatePlates } from './plates';
import { assignDownflow, assignFlow, assignTriangleValues } from './rivers';

const AXIAL_TILT : number = 22; // deg
const TEMP_RATIO : number = 52; // In game units to Celcius -12 to 40 degrees, anything beyond this is unlivable by humans
const INITIAL_VAPOR_PRESSURE : number = .61121; // Equilibrium vapor pressure at freezing
const STEFAN_BOLTZMANN_CONSTANT : number = 5.670374419 * Math.pow(10, -8); // Stefan Boltzmann Constant for calculating heat loss
const PEAK_SOLAR_FLUX : number = 1370; // Peak solar flux in W/m^2
export class WorldGenerator {
  world: World;

  @logGroupTime('globe generate')
  generate(options: IGlobeOptions, mapMode: EMapMode) {
    const seasonalRatio: number = -AXIAL_TILT * Math.cos(2 * 11 / 12 * Math.PI);
    console.time('globe geometry');
    this.world = World.create(options, mapMode);
    console.timeEnd('globe geometry');
    this.generatePlates();
    this.generateCoastline();
    this.generateInsolation(seasonalRatio);
    this.generateMoisture();
    this.generateTemperature();
    this.generateRivers();
    this.generateBiomes();
    this.generatePops();
    this.protrudeHeight();
    this.generateAverageTemperature();
    this.generateInsolation(-AXIAL_TILT);
    this.generateMoisture();
    this.generateTemperature();
    this.world.setup();
    return this.world;
  }

  update(year_ratio: number) {
    const seasonalRatio: number = -AXIAL_TILT * Math.cos(2 * year_ratio * Math.PI);
    this.generateInsolation(seasonalRatio);
    this.generateMoisture();
    this.generateTemperature();
  }

  generateAverageTemperature() {
    for (let y = 0; y < 12; y++)
    {
      const seasonalRatio: number = -AXIAL_TILT * Math.cos(2 * y/12 * Math.PI);
      this.generateInsolation(seasonalRatio);
      this.generateMoisture();
      this.updateAverageTemperature();
      console.log(this.world.r_average_temperature[0]);
    }
  }

  // https://www.itacanet.org/the-sun-as-a-source-of-energy/part-2-solar-energy-reaching-the-earths-surface/
  @logGroupTime('insolation')
  generateInsolation(seasonal_ratio) {
    const world = this.world;
    world.insolation = new Float32Array(Float32Array.BYTES_PER_ELEMENT * world.mesh.numRegions);

    console.log(seasonal_ratio);
    let randomNoise = new SimplexNoise(makeRandFloat(world.options.core.seed));
      
    for (let r = 0; r < world.mesh.numRegions; r++) {
      const x = world.r_xyz[3 * r];
      const y = world.r_xyz[3 * r + 1];
      const z = world.r_xyz[3 * r + 2];
      const [lat, long] = world.getLatLongForCell(r);
      const latRatioSeasonal = Math.max(0, Math.cos((lat - seasonal_ratio) * Math.PI / 180));
      const random1 = (randomNoise.noise3D(x, y, z) + 1) / 2;

      world.insolation[r] = latRatioSeasonal;
    }

    // normalize to 0 to 1
    const { min, max, avg } = arrayStats(world.insolation);
    for (let i = 0; i < world.insolation.length; i++) {
      world.insolation[i] = (world.insolation[i] - min) / (max - min);
    }
  }

  generatePlates() {
    const globe = this.world;

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
    for (let r = 0; r < this.world.mesh.numRegions; r++) {
      if (this.world.r_elevation[r] >= 0) {
        let numOceanNeighbors = 0;
        const neighbors = this.world.mesh.r_circulate_r([], r);
        for (const nr of neighbors) {
          if (this.world.r_elevation[nr] < 0) {
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
    for (let r = 0; r < this.world.mesh.numRegions; r++) {
      if (r_coast[r]) {
        const neighbors = this.world.mesh.r_circulate_r([], r);
        for (const nr of neighbors) {
          // if land and not coastline
          if (r_coast[nr] === false && this.world.r_elevation[nr] >= 0) {
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

      const neighbors = this.world.mesh.r_circulate_r([], r);
      for (const nr of neighbors) {
        // if land and not visited yet
        if (r_distance_to_ocean[nr] === undefined && this.world.r_elevation[nr] >= 0) {
          r_distance_to_ocean[nr] = myDistance + 1;
          queue.push(nr, r_distance_to_ocean[nr]);
        }
      }
    }

    const maxDistanceToOcean = Math.max(...Object.values(r_distance_to_ocean));
    console.log(`Max distance to ocean: ${maxDistanceToOcean}`);

    this.world.r_distance_to_ocean = r_distance_to_ocean;
    this.world.r_coast = r_coast;
    this.world.max_distance_to_ocean = maxDistanceToOcean;
  }

  @logGroupTime('moisture', true)
  private generateMoisture() {
    /**
     * Higher altitude = lower moisture
     * Closer to ocean = higher moisture
     * Lower latitudes = higher moisture
     */

    let randomNoise = new SimplexNoise(makeRandFloat(this.world.options.core.seed));
    const MODIFIER = this.world.options.hydrology.moistureModifier;
    const VARIANCE = 0.15;

    // moisture
    for (let r = 0; r < this.world.mesh.numRegions; r++) {
      // const x = this.globe.r_xyz[3 * r];
      // const y = this.globe.r_xyz[3 * r + 1];
      // const z = this.globe.r_xyz[3 * r + 2];
      const [lat, long] = this.world.getLatLongForCell(r);
      const random1 = randomNoise.noise2D(lat / (1000 * VARIANCE), long / (1000 * VARIANCE))
      const altitude = 1 - Math.max(0, this.world.r_elevation[r]);
      if (this.world.r_elevation[r] >= 0 && this.world.r_distance_to_ocean[r] > 1) {
        const inlandRatio = 1 - (this.world.r_distance_to_ocean[r] / this.world.max_distance_to_ocean);
        this.world.r_moisture[r] = clamp(
          (inlandRatio * .5 +
          (random1 *.2) +
          (altitude * .3))
        , 0, 1);
      } else {
        this.world.r_moisture[r] = 1
      }
    }


    const moisture_min = Math.min(...this.world.r_moisture.filter(i => i));
    const moisture_max = Math.max(...this.world.r_moisture.filter(i => i));
    console.log('min moisture', moisture_min);
    console.log('max moisture', moisture_max);
    // normalize moisture
    for (let r = 0; r < this.world.mesh.numRegions; r++) {
      if (this.world.r_elevation[r] >= 0) {
        this.world.r_moisture[r] = (this.world.r_moisture[r] - moisture_min) / (moisture_max - moisture_min);
        this.world.r_moisture[r] += this.world.r_moisture[r] * MODIFIER;
        this.world.r_moisture[r] = clamp(this.world.r_moisture[r], 0, 1);
      }
    }

    randomNoise = new SimplexNoise(makeRandFloat(this.world.options.core.seed * 2));
  }

  private calcWetTemp(localTemp : number, r: number): number {
    let inCelsius = localTemp;
    let currMoisture = this.world.p_moisture[r];
    let totalHeatLoss = 0;
    for(let x: number = 0; x < 4; x++)
    {
      const vaporPressure = .61121 * Math.exp((18.678 - inCelsius / 234.5) *
        (inCelsius / (inCelsius + 257.14))) * this.world.r_moisture[r]; // Buck equation for vapor pressure in kPa
      const weightRatio = .62198 * (vaporPressure - currMoisture) / 101.325;
      this.world.p_moisture[r] = vaporPressure;
      const heatLoss = ((weightRatio * 2264705) / 1003.5) / 4;
      totalHeatLoss += heatLoss;
      inCelsius -= heatLoss;
      currMoisture += (vaporPressure - currMoisture) / 4;
    }
    this.world.r_heat_loss[r] = totalHeatLoss;
    this.world.r_raw_temp[r] = inCelsius;
    const currThermalEnergy = (inCelsius + 273) * currMoisture * 2264705;
    let avgThermalEnergy = ((this.world.p_atmos_thermal_energy[r] || currThermalEnergy) + currThermalEnergy) / 2;
    this.world.p_atmos_thermal_energy[r] = currThermalEnergy;
    return inCelsius;
  }

  @logGroupTime('temperature', true)
  private generateTemperature() {
    let randomNoise = new SimplexNoise(makeRandFloat(this.world.options.core.seed));
    const { temperatureModifier, minTemperature, maxTemperature } = this.world.options.climate;
    const temperatureRange = maxTemperature + Math.abs(minTemperature);
    console.log(maxTemperature, minTemperature);
    // temperature
    for (let r = 0; r < this.world.mesh.numRegions; r++) {
      const x = this.world.r_xyz[3 * r];
      const y = this.world.r_xyz[3 * r + 1];
      const z = this.world.r_xyz[3 * r + 2];
      const altitude = 1 - Math.max(0, this.world.r_elevation[r]);
      const [lat, long] = this.world.getLatLongForCell(r);
      const random1 = (randomNoise.noise3D(x, y, z) + 1) / 2;
      let localTemp = 0;
      if (this.world.r_elevation[r] < 0) { // ocean
        const altitude = 1 + this.world.r_elevation[r];
        // shallow seas are warmer than deep oceans
        localTemp = (
          (0.10 * random1) +
          (0.20 * altitude) +
          (0.70 * this.world.insolation[r])
        );
      } else { // land
        const altitude = 1 - Math.max(0, this.world.r_elevation[r]);
        // higher is colder
        // lower is warmer
        localTemp = (
          (0.10 * random1) +
          (0.20 * altitude) +
          (0.70 * this.world.insolation[r])
        );
      }
      localTemp = clamp(localTemp || 0, 0, 1);
      const tempValue = this.calcWetTemp(temperatureRange * localTemp + minTemperature, r);
      this.world.r_temperature[r] = tempValue;
      this.world.r_temperature[r] *= temperatureModifier;
    }

    const { min, max } = arrayStats(this.world.r_temperature);

    this.world.min_temperature = min;
    this.world.max_temperature = max;

    console.log(arrayStats(this.world.r_temperature));
  }

  @logGroupTime('Average Temperature', true)
  private updateAverageTemperature() {
    const { temperatureModifier, minTemperature, maxTemperature } = this.world.options.climate;
    const temperatureRange = maxTemperature + Math.abs(minTemperature);
    // temperature
    for (let r = 0; r < this.world.mesh.numRegions; r++) {
      const x = this.world.r_xyz[3 * r];
      const y = this.world.r_xyz[3 * r + 1];
      const z = this.world.r_xyz[3 * r + 2];
      const altitude = 1 - Math.max(0, this.world.r_elevation[r]);
      const [lat, long] = this.world.getLatLongForCell(r);
      let localTemp: number = 0;
      if (this.world.r_elevation[r] < 0) { // ocean
        const altitude = 1 + this.world.r_elevation[r];
        // shallow seas are warmer than deep oceans
        localTemp = (
          (0.05) +
          (0.20 * altitude) +
          (0.70 * this.world.insolation[r])
        );
      } else { // land
        const altitude = 1 - Math.max(0, this.world.r_elevation[r]);
        // higher is colder
        // lower is warmer
        localTemp = (
          (0.05) +
          (0.20 * altitude) +
          (0.70 * this.world.insolation[r])
        );
      }
      localTemp = this.calcWetTemp(localTemp, r);

      this.world.r_average_temperature[r] = this.world.r_average_temperature[r] || 0;
      localTemp *= temperatureModifier;
      localTemp = clamp(localTemp, 0, 1);
      this.world.r_average_temperature[r] = ((localTemp * temperatureRange) + minTemperature) / 12;
    }

    const { min, max } = arrayStats(this.world.r_temperature);
    this.world.min_temperature = min;
    this.world.max_temperature = max;

    console.log(arrayStats(this.world.r_temperature));
  }

  @logGroupTime('generate pops', true)
  private generatePops() {
    const { minTemperature, maxTemperature } = this.world.options.climate;

    // calculate land desirability
    this.world.r_desirability = new Float32Array(this.world.mesh.numRegions);

    for (let r = 0; r < this.world.mesh.numRegions; r++) {
      if (this.world.r_elevation[r] < 0) {
        this.world.r_desirability[r] = 0;
        continue;
      }

      // Elevation:
      // 1 at lowest elevation
      // 0 at highest elevation
      // shape: linear
      const elevation_value = 1 - this.world.r_elevation[r];

      // Terrain Roughness
      // 1 at flat
      // 0 at rough
      const roughness_value = 1 - this.world.r_roughness[r];

      // Temperature:
      // 0 at 0 and 1 temperature (extremes)
      // 1 at 0.5 temperature (temperate)
      // shape: sine
      const temperature_ratio = (this.world.r_temperature[r] - minTemperature) / (maxTemperature - minTemperature);
      const temperature_value = Math.sin((temperature_ratio ** 2) * Math.PI);

      // Moisture:
      // 0 at 0 moisture
      // 100 at 1 moisture
      // shape: linear
      const moisture_value = this.world.r_moisture[r];

      this.world.r_desirability[r] = (
        elevation_value *
        roughness_value *
        temperature_value *
        moisture_value
      );
    }

    console.log('desirability', arrayStats(this.world.r_desirability));


    // generate pops at desirable locations

    const POP_CELLS = 10;  // number of cells to put pops
    const POP_SIZE = [100, 1000] // population size of each pop
    const POPS_PER_CELL = 5; // number of pops to add at each cell

  }

  @logGroupTime('rivers', true)
  private generateRivers() {
    // rivers
    assignTriangleValues(this.world.mesh, this.world);
    assignDownflow(this.world.mesh, this.world);
    for(let i = 0; i < 2; i++) assignFlow(this.world.mesh, this.world.options, this.world);

    this.world.minimap_t_xyz = new Float32Array(Array.from(this.world.t_xyz));
    this.world.minimap_r_xyz = new Float32Array(Array.from(this.world.r_xyz));
    console.log('map', this.world);

    // terrain roughness
    for (let r = 0; r < this.world.mesh.numRegions; r++) {
      const height = this.world.r_elevation[r];
      const triangles = this.world.mesh.r_circulate_t([], r);
      let roughness = 0;
      for (const t of triangles) {
        roughness += Math.abs(height - this.world.t_elevation[t]);
      }
      this.world.r_roughness[r] = roughness;
      if (this.world.max_roughness < roughness) {
        this.world.max_roughness = roughness;
      }
    }
  }

  @logGroupTime('biomes', true)
  private generateBiomes() {
    // biomes
    this.world.r_moisture_zone = [];
    this.world.r_temperature_zone = [];
    const { minTemperature, maxTemperature } = this.world.options.climate;

    
    for (let r = 0; r < this.world.mesh.numRegions; r++) {
      if (this.world.r_elevation[r] < 0 && this.world.r_temperature[r] < -15) {
        this.world.r_biome[r] = EBiome.GLACIAL;
        continue;
      }

      if (this.world.r_elevation[r] < -0.1) {
        this.world.r_biome[r] = EBiome.OCEAN;
      } else if (this.world.r_elevation[r] < 0) {
        this.world.r_biome[r] = EBiome.COAST;
      } else {
        const moisture = clamp(this.world.r_moisture[r], 0, 1);
        const temperature = (this.world.r_temperature[r] - minTemperature) / (maxTemperature - minTemperature);
        let moistureZone = null;
        for (const [zone, { start, end }] of Object.entries(moistureZoneRanges)) {
          if (moisture >= start && moisture <= end) {
            moistureZone = zone;
          }
        }
        this.world.r_moisture_zone[r] = moistureZone;
        let temperatureZone = null;
        for (const [zone, { start, end }] of Object.entries(temperatureZoneRanges)) {
          if (temperature >= start && temperature <= end) {
            temperatureZone = zone;
          }
        }
        this.world.r_temperature_zone[r] = temperatureZone;
        if (moistureZone === null) {
          throw new Error(`Failed to find biome for moisture: ${moisture}`);
        }
        if (temperatureZone === null) {
          throw new Error(`Failed to find biome for temperature: ${temperature}`);
        }
        const biomeTempMoisture = biomeRanges[moistureZone][temperatureZone];
        if (isArray(biomeTempMoisture)) {
          let landType = 0;
          if (this.world.r_elevation[r] < 0.6) {
            landType = 1;
          } else if (this.world.r_elevation[r] < 0.9) {
            landType = 2;
          }
          this.world.r_biome[r] = biomeTempMoisture[landType];
        } else {
          this.world.r_biome[r] = biomeTempMoisture;
        }
      }
    }
  }

  @logGroupTime('protrude height', true)
  private protrudeHeight() {
    // protrude
    const { numTriangles, numRegions } = this.world.mesh;
    const { t_xyz, r_xyz, t_elevation, r_elevation } = this.world;
    for (let t = 0; t < numTriangles; t++) {
      const e = Math.max(0, t_elevation[t]) * this.world.options.sphere.protrudeHeight * 0.2;
      t_xyz[3 * t] = t_xyz[3 * t] + (t_xyz[3 * t] * e);
      t_xyz[3 * t + 1] = t_xyz[3 * t + 1] + (t_xyz[3 * t + 1] * e);
      t_xyz[3 * t + 2] = t_xyz[3 * t + 2] + (t_xyz[3 * t + 2] * e);
    }
    for (let r = 0; r < numRegions; r++) {
      const e = Math.max(0, r_elevation[r]) * this.world.options.sphere.protrudeHeight * 0.2;
      r_xyz[3 * r] = r_xyz[3 * r] + (r_xyz[3 * r] * e);
      r_xyz[3 * r + 1] = r_xyz[3 * r + 1] + (r_xyz[3 * r + 1] * e);
      r_xyz[3 * r + 2] = r_xyz[3 * r + 2] + (r_xyz[3 * r + 2] * e);
    }
  }

}