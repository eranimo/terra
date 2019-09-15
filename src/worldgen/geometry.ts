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
import { getUV } from '../utils';


export function generateNoize3D(seed: number, persistence: number = 2 / 3, length: number = 5) {
  let randomNoise = new SimplexNoise(makeRandFloat(seed));
  const amplitudes = Array.from({ length }, (_, octave) => Math.pow(persistence, octave));

  return function fbm_noise(nx: number, ny: number, nz: number): number {
    let sum = 0, sumOfAmplitudes = 0;
    for (let octave = 0; octave < amplitudes.length; octave++) {
      let frequency = 1 << octave;
      sum += amplitudes[octave] * randomNoise.noise3D(nx * frequency, ny * frequency, nz * frequency);
      sumOfAmplitudes += amplitudes[octave];
    }
    return sum / sumOfAmplitudes;
  }
}

export function generateNoize2D(seed: number, persistence: number = 2 / 3, length: number = 5) {
  let randomNoise = new SimplexNoise(makeRandFloat(seed));
  const amplitudes = Array.from({ length }, (_, octave) => Math.pow(persistence, octave));

  return function fbm_noise(nx: number, ny: number): number {
    let sum = 0, sumOfAmplitudes = 0;
    for (let octave = 0; octave < amplitudes.length; octave++) {
      let frequency = 1 << octave;
      sum += amplitudes[octave] * randomNoise.noise2D(nx * frequency, ny * frequency);
      sumOfAmplitudes += amplitudes[octave];
    }
    return sum / sumOfAmplitudes;
  }
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

export function coordinateForSide(mesh, { r_xyz, t_xyz }, s: number) {
  const inner_t = mesh.s_inner_t(s);
  const outer_t = mesh.s_outer_t(s);
  const begin_r = mesh.s_begin_r(s);

  return [
    t_xyz[3 * inner_t], t_xyz[3 * inner_t + 1], t_xyz[3 * inner_t + 2],
    t_xyz[3 * outer_t], t_xyz[3 * outer_t + 1], t_xyz[3 * outer_t + 2],
    r_xyz[3 * begin_r], r_xyz[3 * begin_r + 1], r_xyz[3 * begin_r + 2],
  ];
}

export function generateVoronoiGeometry(mesh, { r_xyz, t_xyz }, r_color_fn) {
  const { numSides } = mesh;
  const xyz = [];
  const tm = [];

  for (let s = 0; s < numSides; s++) {
    const inner_t = mesh.s_inner_t(s);
    const outer_t = mesh.s_outer_t(s);
    const begin_r = mesh.s_begin_r(s);

    const rgb = r_color_fn(begin_r);

    xyz.push(
      t_xyz[3 * inner_t], t_xyz[3 * inner_t + 1], t_xyz[3 * inner_t + 2],
      t_xyz[3 * outer_t], t_xyz[3 * outer_t + 1], t_xyz[3 * outer_t + 2],
      r_xyz[3 * begin_r], r_xyz[3 * begin_r + 1], r_xyz[3 * begin_r + 2],
    );
    tm.push(rgb, rgb, rgb);
  }
  return { xyz, tm };
}

export function generateMinimapGeometry(mesh, { minimap_r_xyz, minimap_t_xyz }, r_color_fn) {
  const { numSides } = mesh;
  let xy = [], tm = [];

  for (let s = 0; s < numSides; s++) {
    const inner_t = mesh.s_inner_t(s);
    const outer_t = mesh.s_outer_t(s);
    const begin_r = mesh.s_begin_r(s);
    let rgb = r_color_fn(begin_r);
    const p1 = getUV([minimap_t_xyz[3 * inner_t], minimap_t_xyz[3 * inner_t + 1], minimap_t_xyz[3 * inner_t + 2]]);
    const p2 = getUV([minimap_t_xyz[3 * outer_t], minimap_t_xyz[3 * outer_t + 1], minimap_t_xyz[3 * outer_t + 2]]);
    const p3 = getUV([minimap_r_xyz[3 * begin_r], minimap_r_xyz[3 * begin_r + 1], minimap_r_xyz[3 * begin_r + 2]]);
    xy.push(...p1, ...p2, ...p3);
    tm.push(
      rgb, rgb, rgb
    );
  }
  return { xy, tm };
}

export class QuadGeometry {
  I: Int32Array; // I = indices for indexed drawing mode
  xyz: Float32Array; // position in 3-space
  tm: Float32Array; // temperature, moisture

  setMesh({ numSides, numRegions, numTriangles }) {
    this.I = new Int32Array(3 * numSides);
    this.xyz = new Float32Array(3 * (numRegions + numTriangles));
    this.tm = new Float32Array(2 * (numRegions + numTriangles));
  }

  setMap(
    mesh: TriangleMesh,
    globe: Globe,
    protrudeHeight: number = 0.1
  ) {
    const { r_xyz, t_xyz, s_flow, r_elevation, t_elevation, r_moisture, t_moisture } = globe;
    const { numSides, numRegions, numTriangles } = mesh;
    const { xyz, tm, I } = this;

    for (let t = 0; t < numTriangles; t++) {
      const e = Math.max(0, t_elevation[t]) * protrudeHeight * 0.2;
      t_xyz[3 * t] = t_xyz[3 * t] + (t_xyz[3 * t] * e);
      t_xyz[3 * t + 1] = t_xyz[3 * t + 1] + (t_xyz[3 * t + 1] * e);
      t_xyz[3 * t + 2] = t_xyz[3 * t + 2] + (t_xyz[3 * t + 2] * e);
    }
    for (let r = 0; r < numRegions; r++) {
      const e = Math.max(0, r_elevation[r]) * protrudeHeight * 0.2;
      r_xyz[3 * r] = r_xyz[3 * r] + (r_xyz[3 * r] * e);
      r_xyz[3 * r + 1] = r_xyz[3 * r + 1] + (r_xyz[3 * r + 1] * e);
      r_xyz[3 * r + 2] = r_xyz[3 * r + 2] + (r_xyz[3 * r + 2] * e);
    }

    xyz.set(r_xyz);
    xyz.set(t_xyz, r_xyz.length);

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
      const opposite_s = mesh.s_opposite_s(s);
      const r1 = mesh.s_begin_r(s);
      const r2 = mesh.s_begin_r(opposite_s);
      const t1 = mesh.s_inner_t(s);
      const t2 = mesh.s_inner_t(opposite_s);

      // Each quadrilateral is turned into two triangles, so each
      // half-edge gets turned into one. There are two ways to fold
      // a quadrilateral. This is usually a nuisance but in this
      // case it's a feature. See the explanation here
      // https://www.redblobgames.com/x/1725-procedural-elevation/#rendering
      let coast = r_elevation[r1] < 0.0 || r_elevation[r2] < 0.0;
      if (coast || s_flow[s] > 0 || s_flow[opposite_s] > 0) {
        // It's a coastal or river edge, forming a valley
        I[i++] = r1;
        I[i++] = numRegions + t2;
        I[i++] = numRegions + t1;
        count_valley++;
      } else {
        // It's a ridge
        I[i++] = r1;
        I[i++] = r2;
        I[i++] = numRegions + t1;
        count_ridge++;
      }
    }

    console.log('ridge=', count_ridge, ', valley=', count_valley);
  }
}