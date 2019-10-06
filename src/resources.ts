import { EBiome } from '../../terranova/src/simulation/worldTypes';


export enum EResource {
  TIMBER,
  FISH,
  MEAT,
  BERRIES
}

type BiomeResources = Map<EBiome, Map<EResource, [number, number]>>;

export const biomeResources: BiomeResources = new Map([
  [EBiome.TEMPERATE_FOREST, new Map([
    [EResource.TIMBER, [1_000, 10_000]],
  ])],
]);