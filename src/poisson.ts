import { scaleLinear } from 'd3-scale';
import { geoDistance } from 'd3';


const n = 4e2;
const λ = scaleLinear().range([-180, 180]);

interface ICircle {
  x: number;
  y: number;
  radius?: number;
}

export function poisson(
  k: number,
  rng: () => number
) {
  const points: ICircle[] = [];
  const geometries = [];
  const findClosest = finder(points);

  return (): [number, number][] => {
    let best: ICircle = null;

    // Create k candidates, picking the best (furthest away).
    for (let i = 0; i < k; ++i) {
      const candidate: ICircle = {
        x: λ(rng()),
        y: 180 * Math.acos(rng() * 2 - 1) / Math.PI - 90
      };
      findClosest(candidate);
      if (!best || candidate.radius > best.radius) {
        best = candidate;
      }
    }

    best.radius = 1;
    points.push(best);
    geometries.push([best.x, best.y]);
    // if (geometries.length > n) geometries.shift(), points.shift();
    return geometries;
  };
}

// Find the closest circle to the candidate.
function finder(points: ICircle[]) {
  return (candidate: ICircle) => {
    candidate.radius = Infinity;
    points.forEach((point) => {
      const p = geoDistance([candidate.x, candidate.y], [point.x, point.y]) * 180 / Math.PI - point.radius;
      const radius = Math.max(0, p);
      if (radius < candidate.radius) {
        candidate.radius = radius;
      }
    });
  };
}