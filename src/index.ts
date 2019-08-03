import './style.css';
import Renderer = require('worker-loader!./renderer.worker');



const canvas = (document.getElementById('root') as HTMLCanvasElement)
const offscreen = canvas.transferControlToOffscreen();
const renderer = new Renderer();
const c = (document.getElementById('texture') as HTMLCanvasElement) // document.createElement('canvas');
c.width = 360 * 24;
c.height = 180 * 24;
const texture = c.transferControlToOffscreen();
renderer.postMessage({ type: 'init', data: { offscreen, texture } }, [offscreen as any, texture as any]);
renderer.postMessage({ type: 'generate'});
renderer.postMessage({ type: 'render'});
renderer.onmessage = (event) => {
  console.log(event);
}

document.getElementById('generate').addEventListener('click', () => {
  renderer.postMessage({ type: 'generate'});
  renderer.postMessage({ type: 'render'});
});
document.getElementById('render').addEventListener('click', () => {
  renderer.postMessage({ type: 'render'});
});

const rotateUp = (angle: number) => [0, angle, 0];
const rotateDown = (angle: number) => [0, -angle, 0];
const rotateLeft = (angle: number) => [-angle, 0, 0];
const rotateRight = (angle: number) => [angle, 0, 0];
const ROTATE_BY = 25;
document.getElementById('rotate-left').addEventListener('click', () => {
  renderer.postMessage({ type: 'rotate', data: { angles: rotateLeft(ROTATE_BY) }});
});
document.getElementById('rotate-right').addEventListener('click', () => {
  renderer.postMessage({ type: 'rotate', data: { angles: rotateRight(ROTATE_BY) }});
});
document.getElementById('rotate-up').addEventListener('click', () => {
  renderer.postMessage({ type: 'rotate', data: { angles: rotateUp(ROTATE_BY) }});
});
document.getElementById('rotate-down').addEventListener('click', () => {
  renderer.postMessage({ type: 'rotate', data: { angles: rotateDown(ROTATE_BY) }});
});





// const svg = d3.select("svg");
// svg
//   .append("path")
//   .attr("id", "sphere")
//   .datum({type: "Sphere"})
//   .attr("d", path)
// svg
//   .append("g")
//   .attr("class", "polygons")
//   .selectAll("path")
//   .data(features)
//   .enter()
//   .append("path")
//   .attr("d", path)
//   .attr("fill", function fill(feature: any, i: any) {
//     return d3.schemeCategory10[i % 10]
//   })
// g.end();

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
