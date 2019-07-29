import * as d3 from 'd3';
import { geoVoronoi } from 'd3-geo-voronoi';
import { alea } from 'seedrandom';
import { DebugGroup } from './debug';
import { FeatureCollection, Feature, Geometry } from 'geojson';
import { RenderWorkerEventType, RenderWorkerEventHandler, InitEventData, EventData, RotateEventData } from './types';
const Poisson = require('poisson-disk-sampling');
import * as THREE from 'three';
import OrbitControls from 'three-orbitcontrols';
import Triangulate from './triangulate';
import drawThreeGeo from './threeGeoJSON';

let g;
const seed = 'fuck';
const rng = alea(seed);

type WorldMap = {
  features: Feature<Geometry>[],
  path: d3.GeoPath<any, d3.GeoPermissibleObjects>,
  projection: d3.GeoProjection;
}
function generate() {
  let gg = new DebugGroup('generate points');
  const size = 40;
  const p = new Poisson([360, 180], size, size, 30, rng);
  const points: any = p.fill().map((point: any) => [point[0], point[1] - 90]);
  console.log(`${points.length} points`);
  gg.end();

  gg = new DebugGroup('translate points into geojson');
  let v = geoVoronoi(points);
  const polygons = v.polygons();
  gg.end();

  gg = new DebugGroup('triangulating triangles');
  console.log('polygons', polygons);
  drawThreeGeo(
    polygons,
    10.000,
    'sphere',
    {
      color: 0x80FF80,
      linewidth: 2
    },
    planet
  );
  gg.end();

}

let canvas: OffscreenCanvas;
let worldMap: WorldMap;
let camera: THREE.PerspectiveCamera;
let scene: THREE.Scene;
let renderer: THREE.WebGLRenderer;
let planet: THREE.Object3D;
const WIDTH = 960;
const HEIGHT = 500;

function initScene(canvas: HTMLCanvasElement) {
  console.log('canvas', canvas);
  scene = new THREE.Scene()
  camera = new THREE.PerspectiveCamera( 75, WIDTH / HEIGHT, 0.1)
  camera.position.z = 2
  renderer = new THREE.WebGLRenderer({ canvas });
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