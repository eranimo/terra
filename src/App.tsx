import React, { useRef, useEffect, useState, useLayoutEffect } from 'react';
import { WorkerTextureRef } from './types';
import Renderer = require('worker-loader!./renderer.worker');
import { useEvent } from 'react-use';


class GameManager {
  screenCanvas: OffscreenCanvas;
  minimapCanvas: OffscreenCanvas;
  rendererWorker: Renderer;

  state: {
    isPanning: false,
  };

  constructor() {
    this.rendererWorker = new Renderer();
  }

  init(options: {
    screenCanvas: HTMLCanvasElement,
    minimapCanvas: HTMLCanvasElement,
    onLoad: () => void,
    onError: (error: any) => void,
  }) {
    this.screenCanvas = options.screenCanvas.transferControlToOffscreen();
    this.minimapCanvas = options.minimapCanvas.transferControlToOffscreen();
    this.resize();

    loadTextures(TEXTURES)
      .then(this.onLoad)
      .catch(options.onError);
  }

  sendEvent(event: string, data: any = {}, transferList?: Transferable[]) {
    setImmediate(() => {
      this.rendererWorker.postMessage(
        {
          type: event,
          data,
        },
        transferList,
      );
    });
  }

  onLoad = (textures: WorkerTextureRef[]) => {
    const transferList: any[] = [this.screenCanvas, this.minimapCanvas];
    for (const item of textures) {
      transferList.push(item.data);
    }
    this.sendEvent('init', {
      size: {
        width: window.innerWidth,
        height: window.innerHeight,
      },
      canvases: {
        offscreen: this.screenCanvas,
        texture: this.minimapCanvas,
      },
      textures,
    }, transferList as any);
    this.sendEvent('generate');
    this.sendEvent('render');
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

export function App() {
  const screenRef = useRef();
  const minimapRef = useRef();
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  let manager = new GameManager();

  useEffect(() => {
    manager.init({
      screenCanvas: screenRef.current,
      minimapCanvas: minimapRef.current,
      onLoad: () => setLoading(false),
      onError: (error) => setError(error),
    });
  }, []);

  useEvent('wheel', (event: WheelEvent) => {
    manager.sendEvent('zoom', {
      zoomDiff: event.deltaY * 0.001
    });
  }, document);

  let isPanning = useRef(false);

  const onScreenMouseDown = (event: React.MouseEvent<HTMLCanvasElement, MouseEvent>) => {
    isPanning.current = true;
    manager.sendEvent('rotate', {
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
      manager.sendEvent('rotate', {
        clientX: event.clientX,
        clientY: event.clientY,
        shouldReset: false,
      });
    }
  }

  return (
    <div>
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