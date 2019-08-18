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
import { PlanetView } from './PlanetView';


let ctx: Worker = self as any;

let view: PlanetView;
let textureMap: Record<string, THREE.Texture> = {};

/**
 * Event handlers
 */

function onInit(data: InitEventData) {
  const {
    canvases,
    textures,
    size,
    devicePixelRatio,
  } = data;  
  // setup textures
  for (const item of textures) {
    const texture = new THREE.DataTexture(new Uint8Array(item.data), item.size.width, item.size.height);
    textureMap[item.name] = texture;
    texture.needsUpdate = true;
  }
  console.log('textureMap', textureMap);

  const earthImageData = jpeg.decode(textureMap.earth.image.data, true);
  console.log('earthImageData', earthImageData);

  const resources = {
    earthImageData,
  };
  view = new PlanetView({
    devicePixelRatio,
    canvases,
    resources,
    screenSize: size,
  });

  view.render();
}

async function onGenerate(data: GenerateEventData) {
  view.planet.generate(data.options)
  return true;
}

function onRotate(data: RotateEventData) {
  view.rotate(data.clientX, data.clientY, data.shouldReset);
}

function onZoom(data: ZoomEventData) {
  view.zoom(data.zoomDiff);
}

function onResize(data: ResizeEventData) {
  view.resizeScene(data.width, data.height);
}

function onMouseMove(data: MouseMoveEventData) {
  view.setHoverCell(data.x, data.y);
}

const worker = new ReactiveWorker(ctx, false)
  .on<InitEventData>(ERenderWorkerEvent.INIT, onInit)
  .on(ERenderWorkerEvent.GENERATE, onGenerate, true)
  .on<ZoomEventData>(ERenderWorkerEvent.ZOOM, onZoom)
  .on<ResizeEventData>(ERenderWorkerEvent.RESIZE, onResize)
  .on<RotateEventData>(ERenderWorkerEvent.ROTATE, onRotate)
  .on<MouseMoveEventData>(ERenderWorkerEvent.MOUSEMOVE, onMouseMove);