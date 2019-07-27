declare module 'poisson-disk-sampling' {
  export class Poisson {
    constructor(
      shape: number[],
      minDistance?: number,
      maxDistance?: number,
      maxTries?: number,
      rng?: () => number
    );
    fill(): number
  }
}