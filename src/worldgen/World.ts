import { IGlobeOptions, EMapMode } from "../types";
import { GlobeGen } from './GlobeGen';
import { Globe } from './Globe';


export interface IWorldOptions {
  initialMapMode: EMapMode;
}

export class World {
  globeGen: GlobeGen;
  globe: Globe;
  
  // TODO: factor out into static create and load methods
  constructor(
    globeOptions: IGlobeOptions,
    worldOptions: IWorldOptions,
  ) {
    this.globeGen = new GlobeGen();
    this.globe = this.globeGen.generate(globeOptions, worldOptions.initialMapMode);
    this.globeGen.update(0);


    // build map
    
  }


  updateGlobe(yearRatio: number) {
    this.globeGen.update(yearRatio);
  }

}