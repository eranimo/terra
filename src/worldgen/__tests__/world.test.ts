import { World } from "../World";
import { IGlobeOptions, EMapMode } from '../../types';


const globeOptions: IGlobeOptions = {
  core: {
    seed: 123,
  },
  sphere: {
    numberCells: 35_000,
    jitter: 0.6,
    protrudeHeight: 0.25,
  },
  hydrology: {
    flowModifier: 0.2,
    moistureModifier: 0,
  },
  climate: {
    temperatureModifier: 0,
    minTemperature: -40,
    maxTemperature: 30,
  },
  geology: {
    numberPlates: 25,
    oceanPlatePercent: 0.75,
    terrainRoughness: 0.5,
    heightModifier: -0.25,
    plateCollisionThreshold: 0.75,
  },
};

const worldOptions = {
  initialMapMode: EMapMode.BIOME
};

test('World', () => {
  const world = new World(globeOptions, worldOptions);

  expect(world.globe).toBeDefined();
});