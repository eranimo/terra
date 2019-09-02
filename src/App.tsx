import React, { useEffect, useRef, useState } from 'react';
import { IGlobeOptions } from './types';
import { useObservable } from './utils/hooks';
import { ObservableDict } from './utils/ObservableDict';
import { Globe } from './Globe';
import Renderer from './Renderer';
import { mat4 } from 'gl-matrix';
import { useWindowSize } from 'react-use';
import { clamp } from 'lodash';


let drawMode = 'centroid';
let draw_plateVectors = true;
let draw_plateBoundaries = true;
let drawCellCenter = false;

const initialOptions: IGlobeOptions = {
  seed: 123,
  numberCells: 10_000,
  jitter: 0.3,
  numberPlates: 20,
  flowModifier: 0.5,
}
class GameManager {
  options$: ObservableDict<IGlobeOptions>;
  renderer: ReturnType<typeof Renderer>;
  camera: any;
  globe: Globe;

  removeDrawLoop: any;

  constructor(canvas: HTMLCanvasElement) {
    this.options$ = new ObservableDict(initialOptions);

    const renderer = Renderer(canvas, this.onLoad(canvas));
    this.renderer = renderer;
    this.removeDrawLoop = renderer.regl.frame(() => {
      renderer.camera((state) => {
        if (!state.dirty) return;
        renderer.regl.clear({ color: [0, 0, 0, 1], depth: 1 });
        this.draw(state);
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

  draw(state) {
    const { mesh, triangleGeometry, quadGeometry, r_xyz } = this.globe;

    // if (drawMode === 'centroid') {
    //   this.renderer.renderTriangles({
    //     a_xyz: triangleGeometry.xyz,
    //     a_tm: triangleGeometry.tm,
    //     count: triangleGeometry.xyz.length / 3,
    //   });
    // } else if (drawMode === 'quads') {
    //   this.renderer.renderIndexedTriangles({
    //     a_xyz: quadGeometry.xyz,
    //     a_tm: quadGeometry.tm,
    //     elements: quadGeometry.I,
    //   } as any);
    // }

    // this.renderer.drawRivers(
    //   mesh,
    //   this.globe,
    //   0.5
    // );

    // if (draw_plateVectors) {
    //   // this.renderer.drawPlateVectors(mesh, this.globe, this.options$.toObject());
    // }
    // if (draw_plateBoundaries) {
    //   this.renderer.drawPlateBoundaries(mesh, this.globe);
    // }

    this.renderer.drawCellBorders(mesh, this.globe);

    if (drawCellCenter) {
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
  const seed = useObservable(manager.options$.ofKey('seed'), manager.options$.value.seed);
  const cells = useObservable(manager.options$.ofKey('numberCells'), manager.options$.value.numberCells);
  const plates = useObservable(manager.options$.ofKey('numberPlates'), manager.options$.value.numberPlates);
  const flowModifier = useObservable(manager.options$.ofKey('flowModifier'), manager.options$.value.flowModifier);
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