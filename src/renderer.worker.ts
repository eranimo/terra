import { geoVoronoi } from 'd3-geo-voronoi';
import { alea } from 'seedrandom';
import { DebugGroup } from './debug';
import { FeatureCollection, Polygon, Feature, Geometry, Point } from 'geojson';
import { RenderWorkerEventType, RenderWorkerEventHandler, InitEventData, EventData, RotateEventData } from './types';
const Poisson = require('poisson-disk-sampling');
import * as THREE from 'three';
import drawThreeGeo from './threeGeoJSON';
import { isEqual } from 'lodash';
import { stitch } from './stitch';

// typescript can go fuck itself
const bboxClip = require('@turf/bbox-clip').default;


interface VoronoiProps {
  neighbors: number[],
  site: [number, number],
  sitecoordinates: [number, number],
}


let g;
const seed = 'fuck';
const rng = alea(seed);

function generate() {
  let gg = new DebugGroup('generate points');
  const size = 50;
  const p = new Poisson([360, 180], size, size, 300, rng);
  const points: [number, number][] = p.fill().map((point: any) => [point[0], point[1] - 90]);
  console.log(`${points.length} points`);
  gg.end();

  gg = new DebugGroup('voronoi');
  let v = geoVoronoi(points);
  const polygons = v.polygons();
  console.log('polygons', polygons);
  gg.end();

  gg = new DebugGroup('draw');
  for (const feature of polygons.features) {
    drawThreeGeo(
      feature,
      10,
      'sphere',
      {
        color: 0x80FF80,
        linewidth: 2
      },
      planet
    );
  }
  gg.end()
}

let canvas: OffscreenCanvas;
let camera: THREE.PerspectiveCamera;
let scene: THREE.Scene;
let renderer: THREE.WebGLRenderer;
let planet: THREE.Group;
const WIDTH = 960;
const HEIGHT = 500;

function initScene(canvas: HTMLCanvasElement) {
  console.log('canvas', canvas);
  scene = new THREE.Scene()
  camera = new THREE.PerspectiveCamera( 60, WIDTH / HEIGHT, 0.5)
  camera.position.z = 2
  renderer = new THREE.WebGLRenderer({ antialias: true, canvas });
  renderer.setSize(WIDTH, HEIGHT, false);
  
  planet = new THREE.Group();
  const geometry = new THREE.SphereGeometry(10, 32, 32);
  const material = new THREE.MeshBasicMaterial({
    color: 0x333333,
    wireframe: false,
    transparent: false
  });
  const sphere = new THREE.Mesh(geometry, material);
  planet.add(sphere);
  scene.add(planet);
  camera.position.z = 20;
}

function animate() {
  requestAnimationFrame( animate )
  // planet.rotation.z += 0.003
  // planet.rotation.x += 0.001
  // planet.rotation.y += 0.001
  renderer.render( scene, camera )
}

const eventHandlers = {
  init({ offscreen }: InitEventData) {
    canvas = offscreen;
  },

  generate() {
    initScene(canvas as any);
    generate();
  },

  render() {
    animate();
  },

  rotate(data: RotateEventData) {
    const [x, y, z] = data.angles;
    planet.rotation.x += x;
    planet.rotation.y += y;
    planet.rotation.z += z;
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