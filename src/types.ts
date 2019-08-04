import * as THREE from 'three';


export type WorkerTextureRef = {
  name: string;
  size: {
    width: number;
    height: number
  }
  data: ArrayBuffer;
}

export type RenderWorkerEventType = 'init' | 'generate' | 'render';
export type EventData = { type: RenderWorkerEventType, data: any };
export type RenderWorkerEvent<T = any> = {
  type: RenderWorkerEventType,
  data: T,
}
export type RenderWorkerEventHandler<T extends any> = (data: T) => void;

export type InitEventData = {
  canvases: {
    offscreen: OffscreenCanvas;
    texture: OffscreenCanvas;
  },
  textures: WorkerTextureRef[]
}
export type RotateEventData = {
  clientX: number;
  clientY: number;
  shouldReset: boolean;
};