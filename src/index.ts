import './style.css';
import Renderer from 'worker-loader!./renderer.worker';



const canvas = (document.getElementById('root') as HTMLCanvasElement)
const offscreen = canvas.transferControlToOffscreen();
const renderer = new Renderer();
renderer.postMessage({ type: 'init', data: { offscreen } }, [offscreen as any]);
renderer.onmessage = (event) => {
  console.log(event);
}





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
