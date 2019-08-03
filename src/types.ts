export type RenderWorkerEventType = 'init' | 'generate' | 'render';
export type EventData = { type: RenderWorkerEventType, data: any };
export type RenderWorkerEvent<T = any> = {
  type: RenderWorkerEventType,
  data: T,
}
export type RenderWorkerEventHandler<T extends any> = (data: T) => void;

export type InitEventData = {
  offscreen: OffscreenCanvas;
  texture: OffscreenCanvas;
}
export type RotateEventData = {
  angles: [
    number,
    number,
    number,
  ];
};