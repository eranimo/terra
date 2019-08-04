import './style.css';
import Renderer = require('worker-loader!./renderer.worker');
import * as THREE from 'three';
import { WorkerTextureRef } from './types';


const TEXTURES = {
  stars: require('./images/stars.png'),
  earth: require('./images/earth.jpg'),
}

// initialize worker
const renderer = new Renderer();

// configure canvases
const canvas = (document.getElementById('root') as HTMLCanvasElement)
const offscreen = canvas.transferControlToOffscreen();
const c = (document.getElementById('texture') as HTMLCanvasElement) // document.createElement('canvas');
c.width = 360 * 24;
c.height = 180 * 24;
const texture = c.transferControlToOffscreen();

// load textures
const fileReader = new FileReader();

Promise.all(Object.entries(TEXTURES).map(([name, url]) => (
  new Promise((resolve, reject) => {
    fetch(url)
      .then(response => {
        if (response.ok) {
          return response;
        }
        reject();
      })
      .then(response => response.blob())
      .then((blob) => {
        const image = new Image();
        image.src = URL.createObjectURL(blob);
        image.onload = () => {
          new Response(blob).arrayBuffer()
            .then(data => (
              resolve({
                name,
                data,
                size: {
                  width: image.width,
                  height: image.height,
                }
              })
            ))
            .catch(error => reject(error))
        };
      })
  }))))
  .then((textures: WorkerTextureRef[]) => {
    console.log(textures);
    const transferList: any[] = [offscreen, texture];
    for (const item of textures) {
      transferList.push(item.data);
    }
    renderer.postMessage({
      type: 'init',
      data: {
        canvases: {
          offscreen,
          texture
        },
        textures,
      }
    }, transferList as any);

    renderer.postMessage({ type: 'generate'});
    renderer.postMessage({ type: 'render'});
  })
  .catch((error) => {
    console.error(error);
    throw new Error('Failed to load textures');
  });

renderer.onmessage = (event) => {
  console.log(event);
};
// setup events
document.getElementById('generate').addEventListener('click', () => {
  renderer.postMessage({ type: 'generate'});
  renderer.postMessage({ type: 'render'});
});
document.getElementById('render').addEventListener('click', () => {
  renderer.postMessage({ type: 'render'});
});
let isPanning = false;
canvas.addEventListener('mousedown', (event) => {
  isPanning = true;

  renderer.postMessage({
    type: 'rotate',
    data: {
      clientX: event.clientX,
      clientY: event.clientY,
      shouldReset: true,
    }
  });
});
canvas.addEventListener('mouseup', () => isPanning = false);
canvas.addEventListener('mousemove', event => {
  if (isPanning) {
    renderer.postMessage({
      type: 'rotate',
      data: {
        clientX: event.clientX,
        clientY: event.clientY,
        shouldReset: false,
      }
    });
  }
})





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
