import React, { useEffect, useRef, useState } from 'react';
import { IGlobeOptions } from './types';
import { useObservable } from './utils/hooks';
import { ObservableDict } from './utils/ObservableDict';
import { Globe } from './Globe';
import Renderer from './Renderer';
import { mat4 } from 'gl-matrix';
import { useWindowSize } from 'react-use';


const camera = {
  dirty: false,
  rotation: {
    x: 0,
    y: 0,
    z: 0,
  },
  zoom: 1,
};

function onLoad() {
  const canvas = document.querySelector('canvas');
  document.addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft') {
      camera.rotation.x += 0.1;
      camera.dirty = true;
    } else if (event.key === 'ArrowRight') {
      camera.rotation.x -= 0.1;
      camera.dirty = true;
    } else if (event.key === 'ArrowUp') {
      camera.rotation.y += 0.1;
      camera.dirty = true;
    } else if (event.key === 'ArrowDown') {
      camera.rotation.y -= 0.1;
      camera.dirty = true;
    } else if (event.key === 'd') {
      camera.rotation.z += 0.1;
      camera.dirty = true;
    }
  });

  let isPanning = false;
  let panX = 0;
  let panY = 0;
  let lastX = 0;
  let lastY = 0;
  canvas.addEventListener('mousedown', event => {
    isPanning = true;
    panX = event.screenX;
    panY = event.screenY;
  });
  canvas.addEventListener('mouseup', event => {
    isPanning = false;
    lastX = camera.rotation.x;
    lastY = camera.rotation.y;
  });
  canvas.addEventListener('mousemove', (event) => {
    const x = event.screenX;
    const y = event.screenY
    if (isPanning) {
      camera.rotation.x = (lastX + (x - panX) / 300) % (Math.PI * 2);
      camera.rotation.y = (lastY + (y - panY) / 300) % (Math.PI * 2);
      camera.dirty = true;
    }
  });

  window.addEventListener('wheel', event => {
    camera.zoom += event.deltaY * 0.005;
    camera.dirty = true;
  });
}

let drawMode = 'centroid';
let draw_plateVectors = false;
let draw_plateBoundaries = false;
let drawCellCenter = false;

const initialOptions: IGlobeOptions = {
  seed: 123,
  numberCells: 10_000,
  jitter: 0.75,
  numberPlates: 30,
}
class GameManager {
  options$: ObservableDict<IGlobeOptions>;
  renderer: ReturnType<typeof Renderer>;
  globe: Globe;

  constructor(canvas: HTMLCanvasElement) {
    this.options$ = new ObservableDict(initialOptions);
    this.generate();

    const renderer = Renderer(canvas, onLoad);
    this.renderer = renderer;
    camera.dirty = true;

    renderer.regl.frame(() => {
      if (!camera.dirty) return;
      renderer.regl.clear({ color: [0, 0, 0, 1] })
      this.draw();
    });
  }

  generate() {
    const globe = new Globe(this.options$.toObject() as any);
    this.globe = globe;
    camera.dirty = true;
  }

  draw() {
    let u_projection = mat4.create();
    const sizeRatio = window.innerWidth / window.innerHeight;
    mat4.scale(u_projection, u_projection, [camera.zoom, sizeRatio * camera.zoom, 1]);
    mat4.rotate(u_projection, u_projection, -camera.rotation.x, [0, 1, 0]);
    mat4.rotate(u_projection, u_projection, -camera.rotation.y, [1, 0, 0]);
    mat4.rotate(u_projection, u_projection, -camera.rotation.z, [0, 0, 1]);

    const u_projection_line = mat4.clone(u_projection);
    mat4.scale(u_projection_line, u_projection_line, [1.0001, 1.0001, 1.0001]);

    const { mesh, triangleGeometry, quadGeometry, r_xyz } = this.globe;

    if (drawMode === 'centroid') {
      this.renderer.renderTriangles({
        u_projection,
        a_xyz: triangleGeometry.xyz,
        a_tm: triangleGeometry.tm,
        count: triangleGeometry.xyz.length / 3,
      });
    } else if (drawMode === 'quads') {
      this.renderer.renderIndexedTriangles({
        u_projection,
        a_xyz: quadGeometry.xyz,
        a_tm: quadGeometry.tm,
        elements: quadGeometry.I,
      } as any);
    }

    this.renderer.drawRivers(u_projection_line, mesh, this.globe);

    if (draw_plateVectors) {
      this.renderer.drawPlateVectors(u_projection, mesh, this.globe);
    }
    if (draw_plateBoundaries) {
      this.renderer.drawPlateBoundaries(u_projection_line, mesh, this.globe);
    }

    if (drawCellCenter) {
      let u_pointsize = 0.1 + 100 / Math.sqrt(this.options$.get('numberCells'));
      this.renderer.renderPoints({
        u_projection,
        u_pointsize,
        a_xyz: r_xyz,
        count: mesh.numRegions,
      });
    }
    camera.dirty = true;
  }
}

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

function Controls({ manager }: { manager: GameManager }) {
  const seed = useObservable(manager.options$.ofKey('seed'), manager.options$.value.seed);
  const cells = useObservable(manager.options$.ofKey('numberCells'), manager.options$.value.numberCells);
  const plates = useObservable(manager.options$.ofKey('numberPlates'), manager.options$.value.numberPlates);
  return (
    <div id="controls">
      <h1>Terra</h1>
      <fieldset>
        <legend>Seed</legend>

        <Input
          type="number"
          value={seed}
          onChange={value => manager.options$.set('seed', value)}
        />
      </fieldset>

      <fieldset>
        <legend>Number of Cells:</legend>

        <Input
          type="number"
          value={cells}
          onChange={value => manager.options$.set('numberCells', parseInt(value, 10))}
        />
      </fieldset>

      <fieldset>
        <legend>Number of Plates:</legend>

        <Input
          type="number"
          value={plates}
          onChange={value => manager.options$.set('numberPlates', parseInt(value, 10))}
        />
      </fieldset>
    </div>
  );
}

export function App() {
  const screenRef = useRef();
  const [manager, setManager] = useState(null);

  useEffect(() => {
    const manager = new GameManager(screenRef.current);
    console.log('manager', manager);
    setManager(manager);

    manager.options$.subscribe(() => {
      manager.generate();
    });
  }, []);

  const { width, height } = useWindowSize();

  return (
    <div>
      {!manager && <div id="loading">Loading...</div>}
      <canvas
        ref={screenRef}
        width={width}
        height={height}
      />
      {manager && <Controls manager={manager} />}
    </div>
  );
}