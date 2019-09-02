import React, { useEffect, useRef, useState } from 'react';
import { IGlobeOptions, IDrawOptions } from './types';
import { useObservable, useObservableDict } from './utils/hooks';
import { ObservableDict } from './utils/ObservableDict';
import { Globe } from './Globe';
import Renderer from './Renderer';
import { mat4 } from 'gl-matrix';
import { useWindowSize } from 'react-use';
import { clamp } from 'lodash';


let drawMode = 'centroid';

const initialOptions: IGlobeOptions = {
  seed: 123,
  numberCells: 10_000,
  jitter: 0.3,
  numberPlates: 20,
  flowModifier: 0.5,
}
const initialDrawOptions: IDrawOptions = {
  grid: false,
  plateBorders: false,
  plateVectors: false,
  rivers: true,
  cellCenters: false,
};
class GameManager {
  options$: ObservableDict<IGlobeOptions>;
  drawOptions$: ObservableDict<IDrawOptions>;
  renderer: ReturnType<typeof Renderer>;
  camera: any;
  globe: Globe;

  removeDrawLoop: any;

  constructor(canvas: HTMLCanvasElement) {
    this.options$ = new ObservableDict(initialOptions);
    this.drawOptions$ = new ObservableDict(initialDrawOptions);

    
    const renderer = Renderer(canvas, this.onLoad(canvas));
    this.renderer = renderer;
    this.drawOptions$.subscribe(() => renderer.camera.dirty = true);
    this.removeDrawLoop = renderer.regl.frame(() => {
      renderer.camera((state) => {
        if (!state.dirty) return;
        renderer.regl.clear({ color: [0, 0, 0, 1], depth: 1 });
        this.draw();
      });
    });

    this.generate();
  }
  
  onLoad = (canvas) => () => {
  }

  destroy() {
    this.removeDrawLoop();
  }

  generate() {
    const globe = new Globe(this.options$.toObject() as any);
    this.globe = globe;
    this.renderer.camera.dirty = true;
  }

  draw() {
    const { mesh, triangleGeometry, quadGeometry, r_xyz } = this.globe;

    if (drawMode === 'centroid') {
      this.renderer.renderTriangles({
        a_xyz: triangleGeometry.xyz,
        a_tm: triangleGeometry.tm,
        count: triangleGeometry.xyz.length / 3,
      });
    } else if (drawMode === 'quads') {
      this.renderer.renderIndexedTriangles({
        a_xyz: quadGeometry.xyz,
        a_tm: quadGeometry.tm,
        elements: quadGeometry.I,
      } as any);
    }

    if (this.drawOptions$.get('rivers')) {
      this.renderer.drawRivers(
        mesh,
        this.globe,
        0.5
      );
    }

    if (this.drawOptions$.get('plateVectors')) {
      this.renderer.drawPlateVectors(mesh, this.globe, this.options$.toObject());
    }
    if (this.drawOptions$.get('plateBorders')) {
      this.renderer.drawPlateBoundaries(mesh, this.globe);
    }

    if (this.drawOptions$.get('grid')) {
      this.renderer.drawCellBorders(mesh, this.globe);
    }

    if (this.drawOptions$.get('cellCenters')) {
      let u_pointsize = 10.0 + (100 / Math.sqrt(this.options$.get('numberCells')));
      this.renderer.renderPoints({
        u_pointsize,
        a_xyz: r_xyz,
        count: mesh.numRegions,
      });
    }
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
  const seed = useObservableDict(manager.options$, 'seed');
  const cells = useObservableDict(manager.options$, 'numberCells');
  const jitter = useObservableDict(manager.options$, 'jitter');
  const plates = useObservableDict(manager.options$, 'numberPlates');
  const flowModifier = useObservableDict(manager.options$, 'flowModifier');

  const drawGrid = useObservableDict(manager.drawOptions$, 'grid');
  const drawPlateVectors = useObservableDict(manager.drawOptions$, 'plateVectors');
  const drawPlateBorders = useObservableDict(manager.drawOptions$, 'plateBorders');
  const drawCellCenters = useObservableDict(manager.drawOptions$, 'cellCenters');
  const drawRivers = useObservableDict(manager.drawOptions$, 'rivers');

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
          min={0}
          onChange={value => manager.options$.set('numberCells', parseInt(value, 10))}
        />
      </fieldset>

      <fieldset>
        <legend>Cell Jitter:</legend>

        <Input
          type="number"
          value={jitter}
          min={0}
          max={1}
          step={0.05}
          onChange={value => manager.options$.set('jitter', value)}
        />
      </fieldset>

      <fieldset>
        <legend>Number of Plates:</legend>

        <Input
          type="number"
          value={plates}
          min={0}
          onChange={value => manager.options$.set('numberPlates', parseInt(value, 10))}
        />
      </fieldset>

      <fieldset>
        <legend>Flow modifier:</legend>

        <Input
          type="number"
          value={flowModifier}
          min={0}
          max={1}
          step={0.1}
          onChange={value => manager.options$.set('flowModifier', value)}
        />
      </fieldset>

      <fieldset>
        <legend>Draw Grid:</legend>

        <input
          type="checkbox"
          checked={drawGrid}
          onChange={event => manager.drawOptions$.set('grid', event.target.checked)}
        />
      </fieldset>

      <fieldset>
        <legend>Draw Plate Borders:</legend>

        <input
          type="checkbox"
          checked={drawPlateBorders}
          onChange={event => manager.drawOptions$.set('plateBorders', event.target.checked)}
        />
      </fieldset>

      <fieldset>
        <legend>Draw Plate Vectors:</legend>

        <input
          type="checkbox"
          checked={drawPlateVectors}
          onChange={event => manager.drawOptions$.set('plateVectors', event.target.checked)}
        />
      </fieldset>

      <fieldset>
        <legend>Draw Cell Centers:</legend>

        <input
          type="checkbox"
          checked={drawCellCenters}
          onChange={event => manager.drawOptions$.set('cellCenters', event.target.checked)}
        />
      </fieldset>

      <fieldset>
        <legend>Draw Rivers:</legend>

        <input
          type="checkbox"
          checked={drawRivers}
          onChange={event => manager.drawOptions$.set('rivers', event.target.checked)}
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