import * as d3 from 'd3';
import { geoVoronoi } from 'd3-geo-voronoi';
import { alea } from 'seedrandom';
import { DebugGroup } from './debug';
import { FeatureCollection, Feature, Geometry } from 'geojson';
import { RenderWorkerEventType, RenderWorkerEventHandler, InitEventData, EventData, RotateEventData } from './types';
const Poisson = require('poisson-disk-sampling');

let g;
const seed = 'fuck';
const rng = alea(seed);

type WorldMap = {
  features: Feature<Geometry, {
      [name: string]: any;
  }>[],
  path: d3.GeoPath<any, d3.GeoPermissibleObjects>,
  projection: d3.GeoProjection;
}
function generate(): WorldMap {
  g = new DebugGroup('generate points');
  const size = 5;
  const p = new Poisson([360, 180], size, size, 30, rng);
  const points: any = p.fill().map((point: any) => [point[0], point[1] - 90]);
  console.log(`${points.length} points`);
  g.end();

  g = new DebugGroup('voronoi relaxation');
  let v = geoVoronoi(points);
  const features = (v.polygons() as FeatureCollection).features;
  console.log('features', features);
  g.end();

  g = new DebugGroup('generate projection');
  const projection = d3.geoOrthographic();
  // projection.translate([480 + 10, 250 + 100]);
  // projection.scale(100)
  // projection.rotate([-50, 10, 10])
  const path = d3.geoPath().projection(projection)
  g.end();

  return { features, path, projection };
}

let canvas: OffscreenCanvas;
let worldMap: WorldMap;

const eventHandlers = {
  init({ offscreen }: InitEventData) {
    canvas = offscreen;
  },

  generate() {
    g = new DebugGroup('generate');
    worldMap = generate();
  },

  render() {
    const ctx = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D;
    worldMap.features.forEach((feature, index) => {
      const d = worldMap.path(feature);
      const p = new Path2D(d);
      const color = d3.schemeCategory10[index % 10];
      // const color = index < (worldMap.features.length / 2) ? 'red' : 'white';
      // ctx.strokeStyle = 'black';
      ctx.fillStyle = color;
      ctx.fill(p);
      // ctx.stroke(p);
    });
  },

  rotate(data: RotateEventData) {
    const [x, y, z] = data.angles;
    const [cx, cy, cz] = worldMap.projection.rotate();
    worldMap.projection.rotate([cx + x, cy + y, cz + z]);
  }
}


self.onmessage = (event: MessageEvent) => {
  const { type, data } = event.data as EventData;
  console.log('Worker event', type, data);

  if (!(type in eventHandlers)) {
    throw new Error(`Unknown event "${type}"`);
  }

  g = new DebugGroup(type);
  eventHandlers[type](data);
  g.end();
}