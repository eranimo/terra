import React, { useRef, useEffect, useState, useLayoutEffect } from 'react';
import { WorkerTextureRef, ERenderWorkerEvent, IWorldOptions, GenerateEventData } from './types';
import Renderer = require('worker-loader!./worker/renderer.worker');
import { useEvent } from 'react-use';
import { ReactiveWorkerClient } from './utils/workers';


class GameManager {
  screenCanvas: OffscreenCanvas;
  minimapCanvas: OffscreenCanvas;
  worker: ReactiveWorkerClient;

  constructor() {
    const renderer = new Renderer();
    this.worker = new ReactiveWorkerClient(renderer, true);

    // this.rendererWorker$.on(ERenderWorkerEvent.ONLOAD).subscribe(() => {
    //   console.log('loaded');
    // });
  }

  async init(options: {
    screenCanvas: HTMLCanvasElement,
    minimapCanvas: HTMLCanvasElement,
    onLoad: () => void,
    onError: (error: any) => void,
  }) {
    this.screenCanvas = options.screenCanvas.transferControlToOffscreen();
    this.minimapCanvas = options.minimapCanvas.transferControlToOffscreen();
    this.resize();

    const textures = await loadTextures(TEXTURES);
    await this.initializeRenderer(textures);
    await this.generateWorld();
    options.onLoad();
  }

  onResize = () => {
    this.resize();
    this.worker.action(ERenderWorkerEvent.RESIZE).send({
      width: window.innerWidth,
      height: window.innerHeight,
    });
  }

  initializeRenderer = (textures: WorkerTextureRef[]) => {
    const transferList: any[] = [this.screenCanvas, this.minimapCanvas];
    for (const item of textures) {
      transferList.push(item.data);
    }
    this.worker.action(ERenderWorkerEvent.INIT).send({
      size: {
        width: window.innerWidth,
        height: window.innerHeight,
      },
      canvases: {
        offscreen: this.screenCanvas,
        texture: this.minimapCanvas,
      },
      textures,
    }, transferList);
  }

  generateWorld() {
    return new Promise((resolve => {
      this.worker.action(ERenderWorkerEvent.GENERATE).observe().subscribe(() => {
        console.log('generate!');
        resolve();
      });
    }));
  }

  resize() {
    this.screenCanvas.width = window.innerWidth;
    this.screenCanvas.height = window.innerHeight;
  }
}

function loadTextures(textures: Record<string, string>): Promise<WorkerTextureRef[]> {
  return Promise.all(Object.entries(textures).map(([name, url]) => (
    new Promise((resolve, reject) => {
      fetch(url)
        .then(response => {
          if (response.ok) {
            return response;
          }
          reject();
        })
        .then(response => response.blob())
        .then((blob) => {
          const image = new Image();
          image.src = URL.createObjectURL(blob);
          image.onload = () => {
            new Response(blob).arrayBuffer()
              .then(data => (
                resolve({
                  name,
                  data,
                  size: {
                    width: image.width,
                    height: image.height,
                  }
                })
              ))
              .catch(error => reject(error))
          };
        })
    }))))
}

function Controls() {
  return (
    <div id="controls">
      <button id="generate">Generate</button>
    </div>
  );
}

const TEXTURES = {
  stars: require('./images/stars.png'),
  earth: require('./images/earth.jpg'),
}

let manager = new GameManager();

export function App() {
  const screenRef = useRef();
  const minimapRef = useRef();
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    manager.init({
      screenCanvas: screenRef.current,
      minimapCanvas: minimapRef.current,
      onLoad: () => setLoading(false),
      onError: (error) => setError(error),
    });
  }, []);

  useEvent('wheel', (event: WheelEvent) => {
    manager.worker.action(ERenderWorkerEvent.ZOOM).send({
      zoomDiff: event.deltaY * 0.001
    });
  }, document);

  useEvent('resize', (event: Event) => {
    manager.onResize();
  }, window);

  let isPanning = useRef(false);
  const onScreenMouseDown = (event: React.MouseEvent<HTMLCanvasElement, MouseEvent>) => {
    isPanning.current = true;
    manager.worker.action(ERenderWorkerEvent.ROTATE).send({
      clientX: event.clientX,
      clientY: event.clientY,
      shouldReset: true,
    });
  }
  const onScreenMouseUp = () => {
    isPanning.current = false;
  }
  const onScreenMouseMove = (event: React.MouseEvent<HTMLCanvasElement, MouseEvent>) => {
    if (isPanning.current) {
      manager.worker.action(ERenderWorkerEvent.ROTATE).send({
        clientX: event.clientX,
        clientY: event.clientY,
        shouldReset: false,
      });
    }
  }

  return (
    <div>
      {isLoading && <div id="loading">Loading...</div>}
      <canvas
        id="screen"
        ref={screenRef}
        onMouseDown={onScreenMouseDown}
        onMouseUp={onScreenMouseUp}
        onMouseMove={onScreenMouseMove}
      />
      <canvas width={360 * 24} height={180 * 24} id="minimap" ref={minimapRef} />
      <Controls />
    </div>
  );
}