import './style.css';
import * as d3 from 'd3';
import { geoVoronoi } from 'd3-geo-voronoi';
import { alea } from 'seedrandom';
const Poisson = require('poisson-disk-sampling');


class DebugGroup {
  constructor(public label: string) {
    console.groupCollapsed(label)
    console.time(label);
  }

  end() {
    console.timeEnd(this.label);
    console.groupEnd();
  }
}

let g;

const seed = 'fuck';
const rng = alea(seed);

g = new DebugGroup('generate points');
// const points = d3.range(100_000).map(() => {
//   return [360 * rng(), 90 * (rng() - rng())]
// });
const size = 0.75;
const p = new Poisson([360, 180], size, size, 30, rng);
const points: any = p.fill().map((point: any) => [point[0], point[1] - 90]);
console.log(`${points.length} points`);
g.end();

const alpha = 5;
const degrees = 180 / Math.PI;
const radians = 1 / degrees;
let features;

g = new DebugGroup('voronoi relaxation');
for (let n = 0; n < 1; n++) {
  console.log(`Iteration ${n}`);
  let v = geoVoronoi(points);
  const polygons: any = v.polygons();
  features = polygons.features;
  // features.forEach((poly: any, i: number) => {
  //   const c = d3.geoCentroid(poly);
  //   points[i][0] += alpha * degrees * Math.sin(radians * (c[0] - points[i][0]));
  //   points[i][1] += alpha * (c[1] - points[i][1]);
  // });
}
g.end();

g = new DebugGroup('generate projection');
const projection = d3.geoOrthographic();
const path = d3.geoPath().projection(projection)
const svg = d3.select("svg");
g.end();

g = new DebugGroup('render');
svg
  .append("path")
  .attr("id", "sphere")
  .datum({type: "Sphere"})
  .attr("d", path)
svg
  .append("g")
  .attr("class", "polygons")
  .selectAll("path")
  .data(features)
  .enter()
  .append("path")
  .attr("d", path)
  .attr("fill", function fill(feature: any, i: any) {
    return d3.schemeCategory10[i % 10]
  })
g.end();

// svg
//   .append("g")
//   .attr("class", "sites")
//   .selectAll("path")
//   .data(points.features)
//   .enter()
//   .append("path")
//   .attr("d", path)

// gentle animation
// d3.interval(function(elapsed) {
//   projection.rotate([elapsed / 150, 0])
//   svg.selectAll("path").attr("d", path)
// }, 50)
