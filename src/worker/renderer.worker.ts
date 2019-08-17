import { geoVoronoi } from 'd3-geo-voronoi';
import { alea } from 'seedrandom';
import { DebugGroup } from '../debug';
import { InitEventData, RotateEventData, ZoomEventData, ERenderWorkerEvent, ResizeEventData, GenerateEventData, MouseMoveEventData } from '../types';
import * as THREE from 'three';
import * as d3 from 'd3';
import { getGeoPointsSpiral } from '../utils';
import { clamp } from 'lodash';
import jpeg from 'jpeg-js';
import { ReactiveWorker } from '../utils/workers';
import { geoContains } from 'd3';


let ctx: Worker = self as any;

let g: DebugGroup;
let rng: () => number;

let canvas: OffscreenCanvas;
let camera: THREE.PerspectiveCamera;
let scene: THREE.Scene;
let renderer: THREE.WebGLRenderer;
let screenSize: { width: number, height: number };
let textureMaterial: THREE.MeshBasicMaterial;
let surfaceMaterial: THREE.MeshBasicMaterial;
let canvasTexture: OffscreenCanvas;
let sphere: THREE.Mesh;
let textureMap: Record<string, THREE.Texture> = {};
let earthImageData;
let canvasSurface: OffscreenCanvas;
let mouse = new THREE.Vector2();
let cursor = new THREE.Vector2();
let currentHoverCell = null;
const raycaster = new THREE.Raycaster();
let path;
let surfaceContext: CanvasRenderingContext2D;
let surfaceTexture: THREE.Texture;
const group = new THREE.Group();
let projection;

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
  const geometry = new THREE.SphereGeometry(10, 64, 64);
  textureMaterial = new THREE.MeshLambertMaterial({
    color: 0x333333,
    wireframe: false,
    transparent: false,
  });
  sphere = new THREE.Mesh(geometry, textureMaterial);
  camera.position.z = 20;

  const surfaceGeo = new THREE.SphereGeometry(10.01, 64, 64);
  surfaceMaterial = new THREE.MeshBasicMaterial({
    transparent: true,
  });
  const surface = new THREE.Mesh(surfaceGeo, surfaceMaterial);
  group.add(sphere, surface);
  scene.add(group);

  render();
}

let frameID: number;
let lastUpdatedHoverCell = null;
function render() {
  frameID = requestAnimationFrame(render);
  if (currentHoverCell !== lastUpdatedHoverCell) {
    drawSurface();
    lastUpdatedHoverCell = currentHoverCell;
  }
  renderer.render(scene, camera);
}

function resizeScene(width: number, height: number) {
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  screenSize.width = width;
  screenSize.height = height;
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
  polygons.features.forEach((feature, index) => {
    const d = path(feature.geometry);
    const p = new Path2D(d);
    // const color = d3.schemeCategory10[index % 10];
    // const color = `rgb(${rng() * 255}, ${rng() * 255}, ${rng() * 255})`;
    const color = getEarthColorForPoint(feature.properties.site)
    ctx.fillStyle = color;
    ctx.fill(p);
    // ctx.strokeStyle = 'black';
    // ctx.stroke(p);
  });
  return canvasTexture;
}

function textureFromCanvas(canvas: OffscreenCanvas): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(canvas as any);
  texture.needsUpdate = true;
  return texture;
}

let polygons;
function generate(cells) {
  let gg = new DebugGroup('generate points');
  const points = getGeoPointsSpiral(cells, rng);
  console.log('points', points);
  console.log(`${points.length} points`);
  gg.end();

  gg = new DebugGroup('voronoi');
  let v = geoVoronoi(points);
  polygons = v.polygons();
  console.log('polygons', polygons);
  gg.end();

  // setup projection
  projection = d3.geoEquirectangular()
    .fitSize([canvasTexture.width, canvasTexture.height], polygons);
  path = d3.geoPath().projection(projection);
  console.log('projection', projection);

  gg = new DebugGroup('draw');  
  const texture = textureFromCanvas(drawPolygonsOnCanvas(polygons));
  console.log('texture', texture);
  textureMaterial.map = texture;
  textureMaterial.needsUpdate = true;
  gg.end()

  surfaceContext = canvasSurface.getContext('2d') as any;
  surfaceTexture = textureFromCanvas(canvasSurface);
  surfaceTexture.minFilter = THREE.NearestFilter;
  surfaceMaterial.map = surfaceTexture;
  surfaceMaterial.needsUpdate = true;
}

const geoPath = d3.geoPath();
function drawSurface() {
  console.log('draw surface');
  if (!surfaceContext) return;
  surfaceContext.clearRect(0, 0, 360 * 24, 180 * 24);

  if (currentHoverCell) {
    surfaceContext.fillStyle = 'rgba(255, 0, 0, 0.5)';
    surfaceContext.strokeStyle = 'rgba(255, 0, 0, 1)';
    const d = path(currentHoverCell.geometry);
    const p = new Path2D(d);
    surfaceContext.stroke(p);
    surfaceContext.fill(p);
    surfaceTexture.needsUpdate = true;
    surfaceMaterial.needsUpdate = true;
  } else {
    console.log('no hover cell');
  }
}

/**
 * Event handlers
 */

function onInit(data: InitEventData) {
  const { canvases: { offscreen, texture, surface }, textures, size } = data;
  canvasTexture = texture;
  canvasSurface = surface;
  console.log(size);
  screenSize = size;
  
  // setup textures
  for (const item of textures) {
    const texture = new THREE.DataTexture(new Uint8Array(item.data), item.size.width, item.size.height);
    textureMap[item.name] = texture;
    texture.needsUpdate = true;
  }
  console.log('textureMap', textureMap);

  earthImageData = jpeg.decode(textureMap.earth.image.data, true);
  console.log('earthImageData', earthImageData);

  console.log('canvasTexture', canvasTexture);
  
  initScene(offscreen as any);
  drawSurface();
}

async function onGenerate(data: GenerateEventData) {
  const { seed, cells } = data.options;
  rng = alea(seed.toString());
  generate(cells);
  return true;
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
  group.rotation.y += ( moveX * .005);
  group.rotation.x += ( moveY * .005);

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

function polgonContainingPoint(point: THREE.Vector2) {
  for (const cell of polygons.features) {
    if (geoContains(cell, [point.x, point.y])) {
      return cell;
    }
  }
}
function onMouseMove(data: MouseMoveEventData) {
  const { x, y } = data;
  mouse.set(( (x / screenSize.width) * 2 ) - 1, -((y / screenSize.height) * 2 ) + 1);
  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(group.children);
  let selectedIntersect = intersects[0];
  if (selectedIntersect && selectedIntersect.uv) {
    var uv = selectedIntersect.uv;
    (selectedIntersect.object as any).material.map.transformUv(uv);
    // console.log('uv', uv);
    cursor.set(
      (uv.x * 360) + 180,
      90 - (uv.y * 180),
    );
    // console.log('cursor', cursor);
    const cell = polgonContainingPoint(cursor);
    // console.log(cell.properties.site);
    currentHoverCell = cell;
  } else {
    currentHoverCell = null;
  }
}

const worker = new ReactiveWorker(ctx, false)
  .on<InitEventData>(ERenderWorkerEvent.INIT, onInit)
  .on(ERenderWorkerEvent.GENERATE, onGenerate, true)
  .on<ZoomEventData>(ERenderWorkerEvent.ZOOM, onZoom)
  .on<ResizeEventData>(ERenderWorkerEvent.RESIZE, onResize)
  .on<RotateEventData>(ERenderWorkerEvent.ROTATE, onRotate)
  .on<MouseMoveEventData>(ERenderWorkerEvent.MOUSEMOVE, onMouseMove);