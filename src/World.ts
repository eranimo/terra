import { IGlobeOptions, EMapMode } from "./types";
import { GlobeGen } from './worldgen/GlobeGen';
import { Globe } from './worldgen/Globe';


export interface IWorldOptions {
  initialMapMode: EMapMode;
}
export class World {
  globeGen: GlobeGen;
  globe: Globe;
  
  constructor(
    globeOptions: IGlobeOptions,
    worldOptions: IWorldOptions,
  ) {
    this.globeGen = new GlobeGen();
    this.globe = this.globeGen.generate(globeOptions, worldOptions.initialMapMode);
    this.globeGen.update(0);
  }

  updateGlobe(yearRatio: number) {
    this.globeGen.update(yearRatio);
  }

}