/*
 * From https://www.redblobgames.com/x/1843-planet-generation/
 * Copyright 2018 Red Blob Games <redblobgames@gmail.com>
 * License: Apache v2.0 <http://www.apache.org/licenses/LICENSE-2.0.html>
 * 
 * Converted to Typescript by Kaelan Cooter <me@kaelan.org>
 */

import Delaunator from 'delaunator';
import TriangleMesh from '@redblobgames/dual-mesh';


let _randomLat = [], _randomLon = [];
function generateFibonacciSphere(N: number, jitter: number, randFloat: () => number) {
  let a_latlong = [];

  // Second algorithm from http://web.archive.org/web/20120421191837/http://www.cgafaq.info/wiki/Evenly_distributed_points_on_sphere
  const s = 3.6 / Math.sqrt(N);
  const dlong = Math.PI * (3 - Math.sqrt(5));  /* ~2.39996323 */
  const dz = 2.0 / N;
  for (let k = 0, long = 0, z = 1 - dz / 2; k !== N; k++ , z -= dz) {
    let r = Math.sqrt(1 - z * z);
    let latDeg = Math.asin(z) * 180 / Math.PI;
    let lonDeg = long * 180 / Math.PI;
    if (_randomLat[k] === undefined) _randomLat[k] = randFloat() - randFloat();
    if (_randomLon[k] === undefined) _randomLon[k] = randFloat() - randFloat();
    latDeg += jitter * _randomLat[k] * (latDeg - Math.asin(Math.max(-1, z - dz * 2 * Math.PI * r / s)) * 180 / Math.PI);
    lonDeg += jitter * _randomLon[k] * (s / r * 180 / Math.PI);
    a_latlong.push(latDeg, lonDeg % 360.0);
    long += dlong;
  }
  return a_latlong;
}


/* calculate x,y,z from spherical coordinates lat,lon and then push
 * them onto out array; for one-offs pass [] as the first argument */
function pushCartesianFromSpherical(out: number[], latDeg: number, lonDeg: number) {
  const latRad = latDeg / 180.0 * Math.PI;
  const lonRad = lonDeg / 180.0 * Math.PI;
  out.push(Math.cos(latRad) * Math.cos(lonRad),
    Math.cos(latRad) * Math.sin(lonRad),
    Math.sin(latRad));
  return out;
}


/** Add south pole back into the mesh.
 *
 * We run the Delaunay Triangulation on all points *except* the south
 * pole, which gets mapped to infinity with the stereographic
 * projection. This function adds the south pole into the
 * triangulation. The Delaunator guide explains how the halfedges have
 * to be connected to make the mesh work.
 * <https://mapbox.github.io/delaunator/>
 *
 * Returns the new {triangles, halfedges} for the triangulation with
 * one additional point added around the convex hull.
 */
function addSouthPoleToMesh(southPoleId: number, { triangles, halfedges }) {
  // This logic is from <https://github.com/redblobgames/dual-mesh>,
  // where I use it to insert a "ghost" region on the "back" side of
  // the planar map. The same logic works here. In that code I use
  // "s" for edges ("sides"), "r" for regions ("points"), t for triangles
  let numSides = triangles.length;
  function s_next_s(s) { return (s % 3 == 2) ? s - 2 : s + 1; }

  let numUnpairedSides = 0, firstUnpairedSide = -1;
  let pointIdToSideId = []; // seed to side
  for (let s = 0; s < numSides; s++) {
    if (halfedges[s] === -1) {
      numUnpairedSides++;
      pointIdToSideId[triangles[s]] = s;
      firstUnpairedSide = s;
    }
  }

  let newTriangles = new Int32Array(numSides + 3 * numUnpairedSides);
  let newHalfedges = new Int32Array(numSides + 3 * numUnpairedSides);
  newTriangles.set(triangles);
  newHalfedges.set(halfedges);

  for (let i = 0, s = firstUnpairedSide;
    i < numUnpairedSides;
    i++ , s = pointIdToSideId[newTriangles[s_next_s(s)]]) {

    // Construct a pair for the unpaired side s
    let newSide = numSides + 3 * i;
    newHalfedges[s] = newSide;
    newHalfedges[newSide] = s;
    newTriangles[newSide] = newTriangles[s_next_s(s)];

    // Construct a triangle connecting the new side to the south pole
    newTriangles[newSide + 1] = newTriangles[s];
    newTriangles[newSide + 2] = southPoleId;
    let k = numSides + (3 * i + 4) % (3 * numUnpairedSides);
    newHalfedges[newSide + 2] = k;
    newHalfedges[k] = newSide + 2;
  }

  return {
    triangles: newTriangles,
    halfedges: newHalfedges,
  };
}


function stereographicProjection(r_xyz: number[]) {
  // See <https://en.wikipedia.org/wiki/Stereographic_projection>
  const degToRad = Math.PI / 180;
  let numPoints = r_xyz.length / 3;
  let r_XY: number[] = [];
  for (let r = 0; r < numPoints; r++) {
    const x = r_xyz[3 * r];
    const y = r_xyz[3 * r + 1];
    const z = r_xyz[3 * r + 2];

    const X = x / (1 - z);
    const Y = y / (1 - z);
    r_XY.push(X, Y);
  }
  return r_XY;
}

export type SphereMesh = {
  mesh: TriangleMesh,
  r_xyz: number[],
  latlong: number[],
}

export function makeSphere(N: number, jitter: number, randFloat: () => number): SphereMesh {
  const latlong = generateFibonacciSphere(N, jitter, randFloat);
  const r_xyz = [];
  for (let r = 0; r < latlong.length / 2; r++) {
    pushCartesianFromSpherical(r_xyz, latlong[2 * r], latlong[2 * r + 1]);
  }

  const delaunay = new Delaunator(stereographicProjection(r_xyz));

  /* TODO: rotate an existing point into this spot instead of creating one */
  r_xyz.push(0, 0, 1);
  const delaunayWithPole = addSouthPoleToMesh(r_xyz.length / 3 - 1, delaunay);

  let dummy_r_vertex = [[0, 0]];
  for (let i = 1; i < N + 1; i++) {
    dummy_r_vertex[i] = dummy_r_vertex[0];
  }

  let mesh = new TriangleMesh({
    numBoundaryRegions: 0,
    numSolidSides: delaunayWithPole.triangles.length,
    _r_vertex: dummy_r_vertex,
    _triangles: delaunayWithPole.triangles,
    _halfedges: delaunayWithPole.halfedges,
  });

  return { mesh, r_xyz, latlong };
}
