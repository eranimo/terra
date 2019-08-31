/*
 * From https://www.redblobgames.com/x/1843-planet-generation/
 * Copyright 2018 Red Blob Games <redblobgames@gmail.com>
 * License: Apache v2.0 <http://www.apache.org/licenses/LICENSE-2.0.html>
 * 
 * Modified by Kaelan Cooter (me@kaelan.org)
 */

import { makeRandFloat } from '@redblobgames/prng';
import SimplexNoise from 'simplex-noise';
import TriangleMesh from '@redblobgames/dual-mesh';
import { Globe } from './Globe';


const SEED = 123;

let _randomNoise = new SimplexNoise(makeRandFloat(SEED));
const persistence = 2 / 3;
const amplitudes = Array.from({ length: 5 }, (_, octave) => Math.pow(persistence, octave));
let triangleGeometry;

export function fbm_noise(nx, ny, nz) {
  let sum = 0, sumOfAmplitudes = 0;
  for (let octave = 0; octave < amplitudes.length; octave++) {
    let frequency = 1 << octave;
    sum += amplitudes[octave] * _randomNoise.noise3D(nx * frequency, ny * frequency, nz * frequency);
    sumOfAmplitudes += amplitudes[octave];
  }
  return sum / sumOfAmplitudes;
}

/* Calculate the centroid and push it onto an array */
function pushCentroidOfTriangle(out, ax, ay, az, bx, by, bz, cx, cy, cz) {
  // TODO: renormalize to radius 1
  out.push((ax + bx + cx) / 3, (ay + by + cy) / 3, (az + bz + cz) / 3);
}


export function generateTriangleCenters(mesh, { r_xyz }) {
  let { numTriangles } = mesh;
  let t_xyz = [];
  for (let t = 0; t < numTriangles; t++) {
    let a = mesh.s_begin_r(3 * t),
      b = mesh.s_begin_r(3 * t + 1),
      c = mesh.s_begin_r(3 * t + 2);
    pushCentroidOfTriangle(t_xyz,
      r_xyz[3 * a], r_xyz[3 * a + 1], r_xyz[3 * a + 2],
      r_xyz[3 * b], r_xyz[3 * b + 1], r_xyz[3 * b + 2],
      r_xyz[3 * c], r_xyz[3 * c + 1], r_xyz[3 * c + 2]);
  }
  return t_xyz;
}

export function generateVoronoiGeometry(mesh, { r_xyz, t_xyz }, r_color_fn) {
  const { numSides } = mesh;
  let xyz = [], tm = [];

  for (let s = 0; s < numSides; s++) {
    let inner_t = mesh.s_inner_t(s),
      outer_t = mesh.s_outer_t(s),
      begin_r = mesh.s_begin_r(s);
    let rgb = r_color_fn(begin_r);
    xyz.push(t_xyz[3 * inner_t], t_xyz[3 * inner_t + 1], t_xyz[3 * inner_t + 2],
      t_xyz[3 * outer_t], t_xyz[3 * outer_t + 1], t_xyz[3 * outer_t + 2],
      r_xyz[3 * begin_r], r_xyz[3 * begin_r + 1], r_xyz[3 * begin_r + 2]);
    tm.push(rgb, rgb, rgb);
  }
  return { xyz, tm };
}

export class QuadGeometry {
  I: Int32Array;
  xyz: Float32Array;
  tm: Float32Array;

  constructor() {
    /* xyz = position in 3-space;
       tm = temperature, moisture
       I = indices for indexed drawing mode */
  }

  setMesh({ numSides, numRegions, numTriangles }) {
    this.I = new Int32Array(3 * numSides);
    this.xyz = new Float32Array(3 * (numRegions + numTriangles));
    this.tm = new Float32Array(2 * (numRegions + numTriangles));
  }

  setMap(
    mesh: TriangleMesh,
    globe: Globe,
  ) {
    const { r_xyz, t_xyz, s_flow, r_elevation, t_elevation, r_moisture, t_moisture } = globe;
    const V = 0.95;
    const { numSides, numRegions, numTriangles } = mesh;
    const { xyz, tm, I } = this;

    xyz.set(r_xyz);
    xyz.set(t_xyz, r_xyz.length);
    // TODO: multiply all the r, t points by the elevation, taking V into account

    let p = 0;
    for (let r = 0; r < numRegions; r++) {
      tm[p++] = r_elevation[r];
      tm[p++] = r_moisture[r];
    }
    for (let t = 0; t < numTriangles; t++) {
      tm[p++] = t_elevation[t];
      tm[p++] = t_moisture[t];
    }

    let i = 0, count_valley = 0, count_ridge = 0;
    let { _halfedges, _triangles } = mesh;
    for (let s = 0; s < numSides; s++) {
      let opposite_s = mesh.s_opposite_s(s),
        r1 = mesh.s_begin_r(s),
        r2 = mesh.s_begin_r(opposite_s),
        t1 = mesh.s_inner_t(s),
        t2 = mesh.s_inner_t(opposite_s);

      // Each quadrilateral is turned into two triangles, so each
      // half-edge gets turned into one. There are two ways to fold
      // a quadrilateral. This is usually a nuisance but in this
      // case it's a feature. See the explanation here
      // https://www.redblobgames.com/x/1725-procedural-elevation/#rendering
      let coast = r_elevation[r1] < 0.0 || r_elevation[r2] < 0.0;
      if (coast || s_flow[s] > 0 || s_flow[opposite_s] > 0) {
        // It's a coastal or river edge, forming a valley
        I[i++] = r1; I[i++] = numRegions + t2; I[i++] = numRegions + t1;
        count_valley++;
      } else {
        // It's a ridge
        I[i++] = r1; I[i++] = r2; I[i++] = numRegions + t1;
        count_ridge++;
      }
    }

    console.log('ridge=', count_ridge, ', valley=', count_valley);
  }
}