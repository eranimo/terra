/*
 * From https://www.redblobgames.com/x/1843-planet-generation/
 * Copyright 2018 Red Blob Games <redblobgames@gmail.com>
 * License: Apache v2.0 <http://www.apache.org/licenses/LICENSE-2.0.html>
 * 
 * Modified by Kaelan Cooter (me@kaelan.org)
 */
import { makeRandInt } from '@redblobgames/prng';
import TriangleMesh from '@redblobgames/dual-mesh';
import { vec3 } from 'gl-matrix';
import { generateNoize3D } from './geometry';
import { IGlobeOptions } from '../types';
import { clamp } from 'lodash';


function pickRandomRegions(
  mesh: TriangleMesh,
  N: number,
  randInt: (input: number) => number
) {
  let { numRegions } = mesh;
  let chosen_r: Set<number> = new Set();
  while (chosen_r.size < N && chosen_r.size < numRegions) {
    chosen_r.add(randInt(numRegions));
  }
  return chosen_r;
}


export function generatePlates(mesh: TriangleMesh, options: IGlobeOptions, r_xyz: number[]) {
  let r_plate = new Int32Array(mesh.numRegions);
  r_plate.fill(-1);
  let plate_r = pickRandomRegions(mesh, Math.min(options.numberPlates, options.numberCells), makeRandInt(options.seed));
  let queue = Array.from(plate_r);
  for (let r of queue) { r_plate[r] = r; }
  let out_r = [];

  const randInt = makeRandInt(options.seed);
  for (let queue_out = 0; queue_out < mesh.numRegions; queue_out++) {
    let pos = queue_out + randInt(queue.length - queue_out);
    let current_r = queue[pos];
    queue[pos] = queue[queue_out];
    mesh.r_circulate_r(out_r, current_r);
    for (let neighbor_r of out_r) {
      if (r_plate[neighbor_r] === -1) {
        r_plate[neighbor_r] = r_plate[current_r];
        queue.push(neighbor_r);
      }
    }
  }

  // Assign a random movement vector for each plate
  let plate_vec = [];
  plate_r.forEach(center_r => {
    let neighbor_r = mesh.r_circulate_r([], center_r)[0];
    const p0 = r_xyz.slice(3 * center_r, 3 * center_r + 3);
    const p1 = r_xyz.slice(3 * neighbor_r, 3 * neighbor_r + 3);
    plate_vec[center_r] = vec3.normalize([] as any, vec3.subtract([] as any, p1, p0));
  });

  return { plate_r, r_plate, plate_vec };
}


/* Distance from any point in seeds_r to all other points, but 
* don't go past any point in stop_r */
function assignDistanceField(mesh: TriangleMesh, options: IGlobeOptions, seeds_r, stop_r) {
  const randInt = makeRandInt(options.seed);
  let { numRegions } = mesh;
  let r_distance = new Float32Array(numRegions);
  r_distance.fill(Infinity);

  let queue = [];
  for (let r of seeds_r) {
    queue.push(r);
    r_distance[r] = 0;
  }

  let out_r = [];
  for (let queue_out = 0; queue_out < mesh.numRegions; queue_out++) {
    let pos = queue_out + randInt(queue.length - queue_out);
    let current_r = queue[pos];
    queue[pos] = queue[queue_out];
    mesh.r_circulate_r(out_r, current_r);
    for (let neighbor_r of out_r) {
      if (r_distance[neighbor_r] === Infinity && !stop_r.has(neighbor_r)) {
        r_distance[neighbor_r] = r_distance[current_r] + 1;
        queue.push(neighbor_r);
      }
    }
  }
  return r_distance;
  // TODO: possible enhancement: keep track of which seed is closest
  // to this point, so that we can assign variable mountain/ocean
  // elevation to each seed instead of them always being +1/-1
}


/* Calculate the collision measure, which is the amount
* that any neighbor's plate vector is pushing against 
* the current plate vector. */
const COLLISION_THRESHOLD = 0.75;
function findCollisions(mesh: TriangleMesh, r_xyz: number[], plate_is_ocean, r_plate, plate_vec) {
  let epsilon = 1e-2;
  let { numRegions } = mesh;
  let mountain_r = new Set(),
    coastline_r = new Set(),
    ocean_r = new Set();
  let r_out = [];
  for (let current_r = 0; current_r < numRegions; current_r++) {
    let bestCollision = Infinity, best_r = -1;
    mesh.r_circulate_r(r_out, current_r);
    for (let neighbor_r of r_out) {
      if (r_plate[current_r] !== r_plate[neighbor_r]) {
        const current_pos = r_xyz.slice(3 * current_r, 3 * current_r + 3);
        const neighbor_pos = r_xyz.slice(3 * neighbor_r, 3 * neighbor_r + 3);
        const distanceBefore = vec3.distance(current_pos, neighbor_pos);
        const distanceAfter = vec3.distance(
          vec3.add([] as any, current_pos, vec3.scale([] as any, plate_vec[r_plate[current_r]], epsilon)),
          vec3.add([] as any, neighbor_pos, vec3.scale([] as any, plate_vec[r_plate[neighbor_r]], epsilon))
        );
        let collision = distanceBefore - distanceAfter;
        if (collision < bestCollision) {
          best_r = neighbor_r;
          bestCollision = collision;
        }
      }
    }
    if (best_r !== -1) {
      let collided = bestCollision > COLLISION_THRESHOLD * epsilon;
      if (plate_is_ocean.has(current_r) && plate_is_ocean.has(best_r)) {
        (collided ? coastline_r : ocean_r).add(current_r);
      } else if (!plate_is_ocean.has(current_r) && !plate_is_ocean.has(best_r)) {
        if (collided) mountain_r.add(current_r);
      } else {
        (collided ? mountain_r : coastline_r).add(current_r);
      }
    }
  }
  return { mountain_r, coastline_r, ocean_r };
}


export function assignRegionElevation(
  mesh: TriangleMesh, 
  options: IGlobeOptions,
  { r_xyz, plate_is_ocean, r_plate, plate_vec, /* out */ r_elevation }
) {
  const epsilon = 1e-3;
  const fbm_noise = generateNoize3D(options.seed);
  let { numRegions } = mesh;

  let { mountain_r, coastline_r, ocean_r } = findCollisions(
    mesh, r_xyz, plate_is_ocean, r_plate, plate_vec
  );

  for (let r = 0; r < numRegions; r++) {
    if (r_plate[r] === r) {
      (plate_is_ocean.has(r) ? ocean_r : coastline_r).add(r);
    }
  }

  let stop_r = new Set();
  for (let r of mountain_r) { stop_r.add(r); }
  for (let r of coastline_r) { stop_r.add(r); }
  for (let r of ocean_r) { stop_r.add(r); }

  console.log('seeds mountain/coastline/ocean:', mountain_r.size, coastline_r.size, ocean_r.size, 'plate_is_ocean', plate_is_ocean.size, '/', options.numberPlates);
  let r_distance_a = assignDistanceField(mesh, options, mountain_r, ocean_r);
  let r_distance_b = assignDistanceField(mesh, options, ocean_r, coastline_r);
  let r_distance_c = assignDistanceField(mesh, options, coastline_r, stop_r);

  for (let r = 0; r < numRegions; r++) {
    const a = r_distance_a[r] + epsilon;
    const b = r_distance_b[r] + epsilon;
    const c = r_distance_c[r] + epsilon;
    if (a === Infinity && b === Infinity) {
      r_elevation[r] = 0.1;
    } else {
      r_elevation[r] = (1 / a - 1 / b) / (1 / a + 1 / b + 1 / c);
    }
    r_elevation[r] += options.terrainRoughness * fbm_noise(r_xyz[3 * r], r_xyz[3 * r + 1], r_xyz[3 * r + 2]);
  }

  for (let r = 0; r < numRegions; r++) {
    r_elevation[r] = clamp(r_elevation[r] + options.heightModifier, -1, 1);
  }
}
