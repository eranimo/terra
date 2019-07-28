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


const material = THREE.MeshBasicMaterial as any;

let g;
const seed = 'fuck';
const rng = alea(seed);

type WorldMap = {
  features: Feature<Geometry>[],
  path: d3.GeoPath<any, d3.GeoPermissibleObjects>,
  projection: d3.GeoProjection;
}
function generate(): WorldMap {
  let gg = new DebugGroup('generate points');
  const size = 20;
  const p = new Poisson([360, 180], size, size, 30, rng);
  const points: any = p.fill().map((point: any) => [point[0], point[1] - 90]);
  console.log(`${points.length} points`);
  gg.end();

  gg = new DebugGroup('translate points into geojson');
  let v = geoVoronoi(points);
  const features = (v.polygons() as FeatureCollection).features;
  gg.end();

  gg = new DebugGroup('triangulating triangles');
  const translated = Triangulate.getTriangles(
    v.polygons(),
    points,
    ''
  );
  console.log('translated', translated);
  console.log('features', features);
  gg.end();

  gg = new DebugGroup('generate projection');
  const projection = d3.geoOrthographic();
  // projection.translate([480 + 10, 250 + 100]);
  // projection.scale(100)
  // projection.rotate([-50, 10, 10])
  const path = d3.geoPath().projection(projection)
  gg.end();

  return { features: translated.features, path, projection };
}

let canvas: OffscreenCanvas;
let worldMap: WorldMap;

function colors(i: number) {
  var palette = ['#d3e2b6','#bcd6b3','#a4c9b1','#8abeb1','#68b3af']
  return palette[i % palette.length]
}

function convertCartesian(point: [number, number]): THREE.Vector3 {
  //https://bl.ocks.org/mbostock/2b85250396c17a79155302f91ec21224
  var radius = 1
  var lambda = point[0] * Math.PI / 180,
    phi = point[1] * Math.PI / 180,
    cosPhi = Math.cos(phi)
  return new THREE.Vector3(
    radius * cosPhi * Math.cos(lambda),
    radius * cosPhi * Math.sin(lambda),
    radius * Math.sin(phi)
  )
}

let camera: THREE.PerspectiveCamera;
let scene: THREE.Scene;
let renderer: THREE.WebGLRenderer;
let mapGroup: THREE.Group;
// let controls: OrbitControls;
const WIDTH = 960;
const HEIGHT = 500;

function initScene(
  canvas: HTMLCanvasElement
) {
  console.log('canvas', canvas);
  scene = new THREE.Scene()
  camera = new THREE.PerspectiveCamera( 75, WIDTH / HEIGHT, 0.1)
  camera.position.z = 2
  renderer = new THREE.WebGLRenderer({ canvas });
  renderer.setSize(WIDTH, HEIGHT, false);
  // controls = new OrbitControls( camera )
  // controls.enableZoom = false
  // document.body.appendChild( renderer.domElement )
  mapGroup = new THREE.Group()
  mapGroup.rotation.x = -Math.PI / 2
  scene.add(mapGroup)
}

function drawGlobe(worldMap: WorldMap) {
  // create a mesh for each feature in the triangles.json file
  var mapMeshes = worldMap.features.map(function(f, i) {
    var featureGeometry = new THREE.Geometry()
    var featureMaterial = new material({
      color: f.properties.nullData ? 0xe7e7e7 : colors(i)
    });
    (f.geometry as any).coordinates[0].forEach(function(t: any) {
      t.slice(0,3).map((v: [number, number]) => 
        featureGeometry.vertices.push(convertCartesian(v))
      );
    })
    // create faces from the vertices
    for (var i = 0; i < featureGeometry.vertices.length; i += 3) {
      featureGeometry.faces.push(
        new THREE.Face3(i, i + 1, i + 2)
      );
    }
    featureMaterial.side = THREE.BackSide
    // try {
    featureGeometry.computeFaceNormals()
    featureGeometry.computeVertexNormals()
    // } catch (error) {
    //   console.error(`Could not compute geometry`);
    //   return;
    // }
    return new THREE.Mesh( featureGeometry, featureMaterial )
  })
  // add meshes to mapGroup
  mapMeshes.forEach(function(mesh) {
    if (mesh) {
      mapGroup.add(mesh)
    }
  })
}

function animate() {
  requestAnimationFrame( animate )
  mapGroup.rotation.z += 0.003
  mapGroup.rotation.x += 0.001
  mapGroup.rotation.y += 0.001
  renderer.render( scene, camera )
}

const eventHandlers = {
  init({ offscreen }: InitEventData) {
    canvas = offscreen;
  },

  generate() {
    worldMap = generate();
  },

  render() {
    // const context = canvas.getContext('webgl') as WebGLRenderingContext;
    initScene(canvas as any);
    drawGlobe(worldMap);
    animate();
    console.log(mapGroup);
    // worldMap.features.forEach((feature, index) => {
    //   const d = worldMap.path(feature);
    //   const p = new Path2D(d);
    //   const color = d3.schemeCategory10[index % 10];
    //   // const color = index < (worldMap.features.length / 2) ? 'red' : 'white';
    //   // ctx.strokeStyle = 'black';
    //   ctx.fillStyle = color;
    //   ctx.fill(p);
    //   // ctx.stroke(p);
    // });
  },

  rotate(data: RotateEventData) {
    const [x, y, z] = data.angles;
    const [cx, cy, cz] = worldMap.projection.rotate();
    worldMap.projection.rotate([cx + x, cy + y, cz + z]);
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