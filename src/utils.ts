export function fibonacciSphere(
  samples: number = 1,
  rng: () => number = Math.random,
) {
  const rnd = rng() * samples;
  const points: [number, number, number][] = [];
  const offset = 2 / samples;
  const increment = Math.PI * (3 - Math.sqrt(5));
  
  for (let i = 0; i < samples; i++) {
    const y = ((i * offset) - 1) + (offset / 2);
    const r = Math.sqrt(1 - Math.pow(y, 2));
    const phi = ((i + rnd) % samples) * increment;
    const x = Math.cos(phi) * r;
    const z = Math.sin(phi) * r;
    points.push([x, y, z]);
  }
  return points;
}

export function getGeoPointsSpiral(
  nPoints: number,
  rng: () => number = Math.random,
) {
  const geoPoints: [number, number][] = [];
  const phi = (1 + Math.sqrt(5)) / 2
  for (let i = 0; i < nPoints; i++) {
    const [x, y] = [i / phi, i / nPoints]
    const lat = x * 360 % 360;
    const long = Math.acos(2 * y - 1) / Math.PI * 180 - 90;
    const jitterX = rng() * 0.5;
    const jitterY = rng() * 0.5;
    geoPoints.push([lat + jitterX, long + jitterY])
  }
  return geoPoints
}

export function measure(label: string, thresholdMS: number = 0) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    descriptor.value = function (...args: any[]) {
      const startTime = performance.now();
      performance.mark(`${label}-start`);
      const result = originalMethod.apply(this, args);
      performance.mark(`${label}-end`);
      const endTime = performance.now();
      const timespan = endTime - startTime;
      if (timespan >= thresholdMS) {
        console.info(`Measure: ${label} (${timespan.toLocaleString()}ms)`)
      }
      performance.measure(label, `${label}-start`, `${label}-end`);
      return result;
    }
  }
}