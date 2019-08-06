import React, { useRef, useEffect, useState, useLayoutEffect } from 'react';
import { WorkerTextureRef, ERenderWorkerEvent, IWorldOptions, GenerateEventData } from './types';
import Renderer = require('worker-loader!./worker/renderer.worker');
import { useEvent } from 'react-use';
import { ReactiveWorkerClient } from './utils/workers';
import { ObservableDict } from './utils/ObservableDict';
import { useObservable } from './utils/hooks';


class GameManager {
  screenCanvas: OffscreenCanvas;
  minimapCanvas: OffscreenCanvas;
  worker: ReactiveWorkerClient;
  workerOptions$: ObservableDict<IWorldOptions>;

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
    worldOptions: IWorldOptions
  }) {
    this.screenCanvas = options.screenCanvas.transferControlToOffscreen();
    this.minimapCanvas = options.minimapCanvas.transferControlToOffscreen();
    this.resize();
    this.workerOptions$ = new ObservableDict(options.worldOptions)

    const textures = await loadTextures(TEXTURES);
    await this.initializeRenderer(textures);
    await this.generateWorld(options.worldOptions);
    this.workerOptions$.subscribe(options => this.generateWorld(options));
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

  generateWorld(options: IWorldOptions) {
    return new Promise((resolve => {
      this.worker.action(ERenderWorkerEvent.GENERATE).observe({ options }).subscribe(() => {
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

let manager = new GameManager();

function Input({
  value,
  onChange,
  ...restProps
}) {
  const [_value, setValue] = useState(value);
  useEffect(() => {
    setValue(value);
  }, [value]);
  return (
    <input
      value={_value}
      onChange={event => setValue(event.target.value)}
      onBlur={() => onChange(_value)}
      onKeyDown={event => event.keyCode === 13 && onChange(_value)}
      {...restProps}
    />
  )
}

function Controls() {
  const seed = useObservable(manager.workerOptions$.ofKey('seed'), manager.workerOptions$.value.seed);
  const cells = useObservable(manager.workerOptions$.ofKey('cells'), manager.workerOptions$.value.cells);
  return (
    <div id="controls">
      <h1>Terra</h1>
      <fieldset>
        <legend>Seed</legend>

        <Input
          type="text"
          value={seed}
          onChange={value => manager.workerOptions$.set('seed', value)}
        />

        <button
          onClick={() => {
            manager.workerOptions$.set('seed', Math.random().toString());
          }}
        >
          Randomize
        </button>
      </fieldset>

      <fieldset>
        <legend>Number of Cells:</legend>

        <Input
          type="number"
          value={cells}
          onChange={value => manager.workerOptions$.set('cells', parseInt(value, 10))}
        />
      </fieldset>

      <button
        type="submit"
        onClick={() => {
          manager.generateWorld(manager.workerOptions$.value);
        }}
      >
        Regenerate
      </button>
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

  useEffect(() => {
    manager.init({
      screenCanvas: screenRef.current,
      minimapCanvas: minimapRef.current,
      onLoad: () => setLoading(false),
      worldOptions: {
        seed: 'earth',
        cells: 10000
      }
    });
  }, []);

  useEvent('wheel', (event: WheelEvent) => {
    if ((event.target as any).id === 'screen') {
      manager.worker.action(ERenderWorkerEvent.ZOOM).send({
        zoomDiff: event.deltaY * 0.001
      });
    }
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
      {!isLoading && <Controls />}
    </div>
  );
}