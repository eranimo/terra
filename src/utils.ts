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

export function logFuncTime<T>(label: string, func: () => T) {
  console.time(label);
  const value = func();
  console.timeEnd(label);
  return value;
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
export function intersectTriangle (pt, dir, p1, p2, p3) {
  let EPSILON = 0.000001;
  let edge1 = [
    p2[0] - p1[0],
    p2[1] - p1[1],
    p2[2] - p1[2],
  ];
  let edge2 = [
    p3[0] - p1[0],
    p3[1] - p1[1],
    p3[2] - p1[2],
  ];

  // cross product of dir and edge2
  let pvec = [
    dir[1] * edge2[2] - dir[2] * edge2[1],
    dir[2] * edge2[0] - dir[0] * edge2[2],
    dir[0] * edge2[1] - dir[1] * edge2[0],
  ];

  // dot product
  let det = edge1[0] * pvec[0] + edge1[1] * pvec[1] + edge1[2] * pvec[2];

  if (det < EPSILON) return null;
  let tvec = [
    pt[0] - p1[0],
    pt[1] - p1[1],
    pt[2] - p1[2],
  ];
  const u = tvec[0] * pvec[0] + tvec[1] * pvec[1] + tvec[2] * pvec[2];
  if (u < 0 || u > det) return null;
  
  // cross product of tvec and edge1
  let qvec = [
    tvec[1] * edge1[2] - tvec[2] * edge1[1],
    tvec[2] * edge1[0] - tvec[0] * edge1[2],
    tvec[0] * edge1[1] - tvec[1] * edge1[0],
  ];
  const v = dir[0] * qvec[0] + dir[1] * qvec[1] + dir[2] * qvec[2];
  if (v < 0 || u + v > det) return null;

  const t = (edge2[0] * qvec[0] + edge2[1] * qvec[1] + edge2[2] * qvec[2]) / det;
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

export function toFloat32SAB(array: number[]) {
  const buffer = new SharedArrayBuffer(Float32Array.BYTES_PER_ELEMENT * array.length);
  const float_array = new Float32Array(buffer);
  float_array.set(array);
  return float_array;
}

export function distance3D(v1: number[], v2: number[]): number {
  const dx = v1[0] - v2[0];
  const dy = v1[1] - v2[1];
  const dz = v1[2] - v2[2];

  return Math.sqrt( dx * dx + dy * dy + dz * dz );
}

export function degreesToRadians(degrees): number {
  return degrees * (Math.PI / 180);
}