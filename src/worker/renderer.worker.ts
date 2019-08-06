import { geoVoronoi } from 'd3-geo-voronoi';
import { alea } from 'seedrandom';
import { DebugGroup } from '../debug';
import { InitEventData, RotateEventData, ZoomEventData, ERenderWorkerEvent, ResizeEventData } from '../types';
import * as THREE from 'three';
import * as d3 from 'd3';
import { getGeoPointsSpiral } from '../utils';
import { clamp } from 'lodash';
import jpeg from 'jpeg-js';
import { ReactiveWorker } from '../utils/workers';


let ctx: Worker = self as any;

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

function resizeScene(width: number, height: number) {
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
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
  const points = getGeoPointsSpiral(10_000, rng);
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

/**
 * Event handlers
 */

function onInit(data: InitEventData) {
  const { canvases: { offscreen, texture }, textures, size } = data;
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
}

function onGenerate() {
  rng = alea(Math.random().toString());
  initScene(canvas as any);
  generate();
  ctx.postMessage({
    type: 'onload'
  });
}

function onRender() {
  if (frameID) {
    cancelAnimationFrame(frameID);
  }
  animate();
}

let lastMove: [number, number];

function onRotate(data: RotateEventData) {
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
}

function onZoom(data: ZoomEventData) {
  camera.zoom += data.zoomDiff;
  camera.zoom = clamp(camera.zoom, 0.1, 5);
  camera.updateProjectionMatrix();
}

function onResize(data: ResizeEventData) {
  resizeScene(data.width, data.height);
}

const worker = new ReactiveWorker(ctx, true)
  .on<InitEventData>(ERenderWorkerEvent.INIT, onInit)
  .on(ERenderWorkerEvent.GENERATE, onGenerate)
  .on(ERenderWorkerEvent.RENDER, onRender)
  .on<ZoomEventData>(ERenderWorkerEvent.ZOOM, onZoom)
  .on<ResizeEventData>(ERenderWorkerEvent.RESIZE, onResize)
  .on<RotateEventData>(ERenderWorkerEvent.ROTATE, onRotate)