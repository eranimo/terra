import { geoVoronoi } from 'd3-geo-voronoi';
import { alea } from 'seedrandom';
import { DebugGroup } from './debug';
import { InitEventData, EventData, RotateEventData, ZoomEventData } from './types';
import * as THREE from 'three';
import * as d3 from 'd3';
import { getGeoPointsSpiral } from './utils';
import { clamp } from 'lodash';
import jpeg from 'jpeg-js';


let g: DebugGroup;
let rng: () => number;

let canvas: OffscreenCanvas;
let camera: THREE.PerspectiveCamera;
let scene: THREE.Scene;
let renderer: THREE.WebGLRenderer;
let screenSize: { width: number, height: number };
let material: THREE.MeshBasicMaterial;
let canvasTexture: OffscreenCanvas;
let sphere: THREE.Mesh;
let textureMap: Record<string, THREE.Texture> = {};
let earthImageData;

function initScene(canvas: HTMLCanvasElement) {
  const { width, height } = screenSize;
  scene = new THREE.Scene()

  // camera
  camera = new THREE.PerspectiveCamera( 60, width / height, 0.5)
  camera.position.z = 2
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, canvas });

  // renderer
  renderer.setSize(width, height, false);
  renderer.setClearColor( 0x000000, 0 );

  // light
  scene.add( new THREE.AmbientLight( 0xffffff, 5 ) );
	const light = new THREE.PointLight( 0xffffff, 1 );
  camera.add(light);
  
  // sphere
  const geometry = new THREE.SphereGeometry(10, 32, 32);
  material = new THREE.MeshLambertMaterial({
    color: 0x333333,
    wireframe: false,
    transparent: false,
  });
  sphere = new THREE.Mesh(geometry, material);
  scene.add(sphere);
  camera.position.z = 20;
}

function getEarthColorForPoint([x, y]: [number, number]): string {
  const { width, height, data } = earthImageData;
  const nx = clamp(Math.round( (x / 360) * width ), 0, width);
  let ny = clamp(Math.round( ((y + 90) / 180) * height), 0, height);
  ny = height - ny;
  const index = (nx + ny * width) * 4;
  const r = data[index];
  const g = data[index + 1];
  const b = data[index + 2];
  // const a = data[index + 3];
  return `rgba(${r}, ${g}, ${b})`;
}

function drawPolygonsOnCanvas(polygons): OffscreenCanvas {
  const ctx = canvasTexture.getContext('2d') as OffscreenCanvasRenderingContext2D;
  const projection = d3.geoEquirectangular()
    .fitSize([canvasTexture.width, canvasTexture.height], polygons);
  const path = d3.geoPath().projection(projection);
  polygons.features.forEach((feature, index) => {
    const d = path(feature.geometry);
    const p = new Path2D(d);
    // const color = d3.schemeCategory10[index % 10];
    // const color = `rgb(${rng() * 255}, ${rng() * 255}, ${rng() * 255})`;
    const color = getEarthColorForPoint(feature.properties.site)
    ctx.fillStyle = color;
    ctx.fill(p);  
  });
  return canvasTexture;
}

function textureFromCanvas(canvas: OffscreenCanvas): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(canvas as any);
  console.log('canvas', canvas);
  texture.needsUpdate = true;
  return texture;
}

function generate() {
  let gg = new DebugGroup('generate points');
  const points = getGeoPointsSpiral(5_000, rng);
  console.log('points', points);
  console.log(`${points.length} points`);
  gg.end();

  gg = new DebugGroup('voronoi');
  let v = geoVoronoi(points);
  const polygons = v.polygons();
  console.log('polygons', polygons);
  gg.end();

  gg = new DebugGroup('draw');  
  const texture = textureFromCanvas(drawPolygonsOnCanvas(polygons));
  material.map = texture;
  material.needsUpdate = true;
  gg.end()
}

let frameID: number;
function animate() {
  frameID = requestAnimationFrame( animate )
  renderer.render( scene, camera )
}


let lastMove: [number, number];
const eventHandlers = {
  init({ canvases: { offscreen, texture }, textures, size }: InitEventData) {
    canvas = offscreen;
    canvasTexture = texture;
    console.log(size);
    screenSize = size;
    
    for (const item of textures) {
      const texture = new THREE.DataTexture(new Uint8Array(item.data), item.size.width, item.size.height);
      textureMap[item.name] = texture;
      texture.needsUpdate = true;
    }
    console.log('textureMap', textureMap);

    earthImageData = jpeg.decode(textureMap.earth.image.data, true);
    console.log('earthImageData', earthImageData)
  },

  generate() {
    rng = alea(Math.random().toString());
    initScene(canvas as any);
    generate();
  },

  render() {
    if (frameID) {
      cancelAnimationFrame(frameID);
    }
    animate();
  },

  rotate(data: RotateEventData) {
    const { clientX, clientY, shouldReset } = data;
    if (shouldReset) {
      if (!lastMove) {
        lastMove = [screenSize.width / 2, screenSize.height / 2];
      }
      lastMove[0] = clientX;
      lastMove[1] = clientY;
    }

    //calculate difference between current and last mouse position
    const moveX = (clientX - lastMove[0]);
    const moveY = (clientY - lastMove[1]);
    //rotate the globe based on distance of mouse moves (x and y) 
    sphere.rotation.y += ( moveX * .005);
    sphere.rotation.x += ( moveY * .005);

    //store new position in lastMove
    lastMove[0] = clientX;
    lastMove[1] = clientY;
  },

  zoom(data: ZoomEventData) {
    camera.zoom += data.zoomDiff;
    camera.zoom = clamp(camera.zoom, 0.1, 5);
    camera.updateProjectionMatrix();
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