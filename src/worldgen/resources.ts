export enum EResourceType {
  TIMBER,
  FISH,
  GAME,
  FRUIT,
  VEGETABLES,
}

export const RENEWABLE = [
  EResourceType.TIMBER,
  EResourceType.FISH,
  EResourceType.GAME,
];

export const RESOURCE_GROWTH_RATE = {
  [EResourceType.TIMBER]: 10,
  [EResourceType.FISH]: 5,
  [EResourceType.GAME]: 5,
  [EResourceType.FRUIT]: 5,
}

export interface IRenewableResource {
  count: [number, number];
  monthlyGrowth: number;
}

// type BiomeResources = Map<EBiome, Map<EResourceType, IRenewableResource>>;

// export const biomeResources: BiomeResources = new Map([
//   [EBiome.TEMPERATE_FOREST, new Map([
//     [EResourceType.TIMBER, {
//       growth: 100,
//     }],
//     [EResource.BERRIES, [, 1e4]],
//   ])],
// ]);