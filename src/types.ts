import * as THREE from 'three';


export type WorkerTextureRef = {
  name: string;
  size: {
    width: number;
    height: number
  }
  data: ArrayBuffer;
}

export type InitEventData = {
  size: {
    width: number;
    height: number;
  },
  canvases: {
    offscreen: OffscreenCanvas;
    texture: OffscreenCanvas;
    surface: OffscreenCanvas;
  },
  textures: WorkerTextureRef[]
}
export type GenerateEventData = {
  options: IWorldOptions,
}
export type RotateEventData = {
  clientX: number;
  clientY: number;
  shouldReset: boolean;
};

export type ZoomEventData = {
  zoomDiff: number;
}

export type ResizeEventData = {
  width: number;
  height: number;
}

export type MouseMoveEventData = {
  x: number;
  y: number;
}

export enum ERenderWorkerEvent {
  // client -> worker
  INIT = 'INIT',
  GENERATE = 'GENERATE',
  RENDER = 'RENDER',
  ROTATE = 'ROTATE',
  ZOOM = 'ZOOM',
  RESIZE = 'RESIZE',
  MOUSEMOVE = 'MOUSEMOVE',

  // worker -> client
}

export interface IWorldOptions {
  seed: string,
  cells: number,
}