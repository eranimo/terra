import { geoVoronoi } from 'd3-geo-voronoi';
import { alea } from 'seedrandom';
import { DebugGroup } from './debug';
import { InitEventData, EventData, RotateEventData } from './types';
import * as THREE from 'three';
import * as d3 from 'd3';
import { poisson } from './poisson';


interface VoronoiProps {
  neighbors: number[],
  site: [number, number],
  sitecoordinates: [number, number],
}


let g;
const seed = 'fuck';
const rng = alea(seed);

let canvas: OffscreenCanvas;
let camera: THREE.PerspectiveCamera;
let scene: THREE.Scene;
let renderer: THREE.WebGLRenderer;
let planet: THREE.Group;
const WIDTH = 960;
const HEIGHT = 500;
let material: THREE.MeshBasicMaterial;
let canvasTexture: OffscreenCanvas;
let sphere: THREE.Mesh;

function initScene(canvas: HTMLCanvasElement) {
  console.log('canvas', canvas);
  scene = new THREE.Scene()
  camera = new THREE.PerspectiveCamera( 60, WIDTH / HEIGHT, 0.5)
  camera.position.z = 2
  renderer = new THREE.WebGLRenderer({ antialias: true, canvas });
  renderer.setSize(WIDTH, HEIGHT, false);

  //
  scene.add( new THREE.AmbientLight( 0xffffff, 5 ) );
	
	var light = new THREE.PointLight( 0xffffff, 1 );
	camera.add(light);
  //
  
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

function drawPolygonsOnCanvas(polygons): OffscreenCanvas {
  const ctx = canvasTexture.getContext('2d') as OffscreenCanvasRenderingContext2D;
  const projection = d3.geoEquirectangular()
    .fitSize([canvasTexture.width, canvasTexture.height], polygons);
  const path = d3.geoPath().projection(projection);
  polygons.features.forEach((feature, index) => {
    const d = path(feature.geometry);
    const p = new Path2D(d);
    const color = d3.schemeCategory10[index % 10];
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
  const nextPoisson = poisson(5, rng);
  let points = [];
  for (let i = 0; i < 5_000; i++) {
    points = nextPoisson();
  }
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

const eventHandlers = {
  init({ offscreen, texture }: InitEventData) {
    canvas = offscreen;
    canvasTexture = texture;
  },

  generate() {
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
    const [x, y, z] = data.angles;
    sphere.rotation.x += x;
    sphere.rotation.y += y;
    sphere.rotation.z += z;
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