/*
 * From https://www.redblobgames.com/x/1843-planet-generation/
 * Copyright 2018 Red Blob Games <redblobgames@gmail.com>
 * License: Apache v2.0 <http://www.apache.org/licenses/LICENSE-2.0.html>
 * 
 * Converted to Typescript by Kaelan Cooter (me@kaelan.org)
 */

import FlatQueue from 'flatqueue';
import TriangleMesh from '@redblobgames/dual-mesh';
import { IGlobeOptions } from '../types';
import { clamp } from 'lodash';


export function assignTriangleValues(mesh: TriangleMesh, { r_elevation, r_moisture, /* out */ t_elevation, t_moisture }) {
  const { numTriangles } = mesh;
  for (let t = 0; t < numTriangles; t++) {
    const s0 = 3 * t;
    const r1 = mesh.s_begin_r(s0);
    const r2 = mesh.s_begin_r(s0 + 1);
    const r3 = mesh.s_begin_r(s0 + 2);
    t_elevation[t] = 1 / 3 * (r_elevation[r1] + r_elevation[r2] + r_elevation[r3]);
    t_moisture[t] = 1 / 3 * (r_moisture[r1] + r_moisture[r2] + r_moisture[r3]);
  }
}


let _queue = new FlatQueue();
export function assignDownflow(mesh: TriangleMesh, { t_elevation, /* out */ t_downflow_s, /* out */ order_t }) {
  /* Use a priority queue, starting with the ocean triangles and
   * moving upwards using elevation as the priority, to visit all
   * the land triangles */
  let { numTriangles } = mesh;
  let queue_in = 0;
  t_downflow_s.fill(-999);

  /* Part 1: ocean triangles get downslope assigned to the lowest neighbor */
  for (let t = 0; t < numTriangles; t++) {
    if (t_elevation[t] < 0) {
      let best_s = -1, best_e = t_elevation[t];
      for (let j = 0; j < 3; j++) {
        const s = 3 * t + j;
        const e = t_elevation[mesh.s_outer_t(s)];
        if (e < best_e) {
          best_e = e;
          best_s = s;
        }
      }
      order_t[queue_in++] = t;
      t_downflow_s[t] = best_s;
      _queue.push(t, t_elevation[t]);
    }
  }

  /* Part 2: land triangles get visited in elevation priority */
  for (let queue_out = 0; queue_out < numTriangles; queue_out++) {
    let current_t = _queue.pop();
    for (let j = 0; j < 3; j++) {
      let s = 3 * current_t + j;
      let neighbor_t = mesh.s_outer_t(s); // uphill from current_t
      if (t_downflow_s[neighbor_t] === -999 && t_elevation[neighbor_t] >= 0.0) {
        t_downflow_s[neighbor_t] = mesh.s_opposite_s(s);
        order_t[queue_in++] = neighbor_t;
        _queue.push(neighbor_t, t_elevation[neighbor_t]);
      }
    }
  }
}


export function assignFlow(
  mesh: TriangleMesh,
  options: IGlobeOptions,
  { order_t, t_elevation, r_elevation, t_moisture, t_downflow_s, /* out */ t_flow, /* out */ s_flow }
) {
  let { numTriangles, _halfedges } = mesh;
  s_flow.fill(0);

  for (let t = 0; t < numTriangles; t++) {
    if (t_elevation[t] >= 0.0) {
      t_flow[t] = options.hydrology.flowModifier * t_moisture[t] * t_moisture[t];
    } else {
      t_flow[t] = 0;
    }
  }

  for (let i = order_t.length - 1; i >= 0; i--) {
    let tributary_t = order_t[i];
    let flow_s = t_downflow_s[tributary_t];
    let trunk_t = (_halfedges[flow_s] / 3) | 0;
    const inner = mesh.s_inner_t(flow_s);
    if (flow_s >= 0) {
      if (t_elevation[inner] >= 0) {
        t_flow[trunk_t] += t_flow[tributary_t];
        s_flow[flow_s] += t_flow[tributary_t]; // TODO: isn't s_flow[flow_s] === t_flow[?]
        if (t_elevation[trunk_t] > t_elevation[tributary_t]) {
          t_elevation[trunk_t] = t_elevation[tributary_t];
        }
      }
    }
  }

  // remove flow from ocean
  for (let s = 0; s <= mesh.numSides; s++) {
    if (s_flow[s] > 1) {
      const begin_r = mesh.s_begin_r(s);
      const end_r = mesh.s_end_r(s);
      if (r_elevation[begin_r] < 0 || r_elevation[end_r] < 0) {
        s_flow[s] = 0;
      }
    }
  }
}