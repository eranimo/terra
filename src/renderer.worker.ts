import * as d3 from 'd3';
import { geoVoronoi } from 'd3-geo-voronoi';
import { alea } from 'seedrandom';
import { DebugGroup } from './debug';
import { FeatureCollection } from 'geojson';
const Poisson = require('poisson-disk-sampling');

let g;
const seed = 'fuck';
const rng = alea(seed);

function generate() {
  g = new DebugGroup('generate points');
  const size = 1.75;
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
  const path = d3.geoPath().projection(projection)
  g.end();

  return { features, path };
}


self.onmessage = (event: MessageEvent) => {
  const { type, data } = event.data;
  console.log('Worker event', type, data);

  if (type === 'init') {
    const canvas = data.offscreen as OffscreenCanvas;
    const ctx = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D;
    const { features, path } = generate();
    g = new DebugGroup('render');
    features.forEach((feature, index) => {
      const d = path(feature);
      const p = new Path2D(d);
      const color = d3.schemeCategory10[index % 10];
      // ctx.strokeStyle = 'black';
      ctx.fillStyle = color;
      ctx.fill(p);
      // ctx.stroke(p);
    });
    g.end();
  }
}