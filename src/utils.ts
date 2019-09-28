import { vec3, mat4 } from 'gl-matrix';


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

export function logGroupTime(label: string, closed: boolean = false) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    descriptor.value = function (...args: any[]) {
      if (closed) {
        console.groupCollapsed(label);
      } else {
        console.group(label);
      }
      console.time(label);
      const result = originalMethod.apply(this, args);
      console.timeEnd(label);
      console.groupEnd();
      return result;
    }
  }
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
// Below is a slightly modified version of this code:
// https://github.com/substack/ray-triangle-intersection
// It does intersection between ray and triangle.
// With the original version, we had no way of accessing 't'
// But we really needed that value.
export function intersectTriangle (out, pt, dir, tri) {
  var EPSILON = 0.000001
  var edge1 = [0, 0, 0]
  var edge2 = [0, 0, 0]
  var tvec = [0, 0, 0]
  var pvec = [0, 0, 0]
  var qvec = [0, 0, 0]

  vec3.subtract(edge1 as any, tri[1], tri[0])
  vec3.subtract(edge2 as any, tri[2], tri[0])

  vec3.cross(pvec as any, dir, edge2)
  var det = vec3.dot(edge1, pvec)

  if (det < EPSILON) return null
  vec3.subtract(tvec as any, pt, tri[0])
  var u = vec3.dot(tvec, pvec)
  if (u < 0 || u > det) return null
  vec3.cross(qvec as any, tvec, edge1)
  var v = vec3.dot(dir, qvec)
  if (v < 0 || u + v > det) return null

  var t = vec3.dot(edge2, qvec) / det
  out[0] = pt[0] + t * dir[0]
  out[1] = pt[1] + t * dir[1]
  out[2] = pt[2] + t * dir[2]
  return t;
}

export function getLatLng(vector: vec3 | number[], radius: number = 1) {
  radius = radius || 200;

  var latRads = Math.acos(vector[1] / radius);
  var lngRads = Math.atan2(vector[2], vector[0]);
  var lat = (Math.PI / 2 - latRads) * (180 / Math.PI);
  var lng = (Math.PI - lngRads) * (180 / Math.PI);

  return [lat, -lng + 180];
}

export function loadImage(imageURL: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = imageURL;
    img.onload = () => resolve(img);
    img.onerror = (error: ErrorEvent) => reject(error);
  });
}


export type ImageRef = {
  name: string,
  image: HTMLImageElement,
}
export async function loadImages(
  images: Record<string, string>
): Promise<ImageRef[]> {
  const result = [];
  const promises: Promise<HTMLImageElement>[] = [];
  for (const [name, url] of Object.entries(images)) {
    const promise = loadImage(url);
    promise.then(image => result.push({ name, image }))
    promises.push(promise);
  }
  await Promise.all(promises);
  return result;
}

export function getUV([x, y, z]): [number, number] {
  return [
    0.5 + (Math.atan2(z, x) / (Math.PI * 2)),
    0.5 - (Math.asin(y) / Math.PI),
  ];
}

export function arrayStats(array: Iterable<number>) {
  let min = Infinity;
  let max = -Infinity;
  let sum = 0;
  let count = 0;
  for (const item of array) {
    if (item < min) {
      min = item;
    }
    if (item > max) {
      max = item;
    }
    count++;
    sum += item;
  }

  return {
    avg: sum / count,
    min,
    max,
  };
}