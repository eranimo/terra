import React, { useEffect, useRef, useState, createContext } from 'react';
import { IGlobeOptions, IDrawOptions, EMapMode, mapModeTitles } from './types';
import { useObservable, useObservableDict } from './utils/hooks';
import { ObservableDict } from './utils/ObservableDict';
import { Globe } from './Globe';
import Renderer from './Renderer';
import { mat4, vec3 } from 'gl-matrix';
import { useWindowSize } from 'react-use';
import { times, clamp } from 'lodash';
import { intersectTriangle, getLatLng } from './utils';
import classNames from 'classnames';
import createLine from 'regl-line';
import colormap from 'colormap';


(window as any)._ = require('lodash');

let drawMode = 'centroid';

const initialOptions: IGlobeOptions = {
  seed: 123,
  numberCells: 35_000,
  jitter: 0.6,
  numberPlates: 12,
  flowModifier: 0.2,
  oceanPlatePercent: 0.7,
};

const initialDrawOptions: IDrawOptions = {
  grid: false,
  plateBorders: false,
  plateVectors: false,
  rivers: true,
  cellCenters: false,
  surface: true,
  regions: true,
  mapMode: EMapMode.NONE,
};

class Region {
  cells: number[];
  constructor(
    public name: string,
    public color: number[],
    cells: number[] = [],
  ) {
    this.cells = cells;
  }

  get size() {
    return this.cells.length;
  }
}


interface IMapModeColorMap {
  colormap: string;
  colors: Record<string, any>;
  color: (values: { moisture: number, height: number }, colors) => number[];
}

class MapMode {
  xyz: number[];
  rgba: number[];
  
  constructor(
    public globe: Globe,
    public mapMode: EMapMode,
    mapModeColor: IMapModeColorMap
  ) {
    this.xyz = [];
    this.rgba = [];
    let values = { moisture: null, height: null };
    const { r_xyz, t_xyz } = globe;
    for (let r = 0; r < this.globe.mesh.numRegions; r++) {
      values.moisture = this.globe.r_moisture[r];
      values.height = this.globe.r_elevation[r];
      const color = mapModeColor.color(values, mapModeColor.colors);
      const sides = [];
      globe.mesh.r_circulate_s(sides, r);
      for (const s of sides) {
        const inner_t = globe.mesh.s_inner_t(s);
        const outer_t = globe.mesh.s_outer_t(s);
        const begin_r = globe.mesh.s_begin_r(s);
        this.xyz.push(
          t_xyz[3 * inner_t], t_xyz[3 * inner_t + 1], t_xyz[3 * inner_t + 2],
          t_xyz[3 * outer_t], t_xyz[3 * outer_t + 1], t_xyz[3 * outer_t + 2],
          r_xyz[3 * begin_r], r_xyz[3 * begin_r + 1], r_xyz[3 * begin_r + 2],
        )
        this.rgba.push(
          ...color,
          ...color,
          ...color,
        );
      }
    }
  }
}

const mapModeDefs: Map<EMapMode, IMapModeColorMap> = new Map([
  [EMapMode.ELEVATION, {
    colormap: 'earth',
    colors: {
      earth: colormap({
        colormap: 'earth',
        nshades: 100,
        format: 'float',
        alpha: 1,
      })
    },
    color: ({ height }, colors) => {
      const heightFixed = (height + 1) / 2;
      const index = clamp(Math.round(heightFixed * 100), 0, 99);
      if (colors.earth[index]) {
        return colors.earth[index];
      }
      return [0, 0, 0, 1];
    },
  }],
  [EMapMode.MOISTURE, {
    colormap: 'cool',
    colors: {
      main: colormap({
        colormap: 'YiGnBu',
        nshades: 100,
        format: 'float',
        alpha: 1,
      }),
    },
    color: ({ moisture }, colors) => {
      const moistureFixed = (moisture + 1) / 2;
      const index = clamp(Math.round(moistureFixed * 100), 0, 99);
      if (colors.main[index]) {
        return colors.main[index];
      }
      return [0, 0, 0, 1];
    },
  }],
]);

class GameManager {
  options$: ObservableDict<IGlobeOptions>;
  drawOptions$: ObservableDict<IDrawOptions>;
  renderer: ReturnType<typeof Renderer>;
  camera: any;
  globe: Globe;

  removeDrawLoop: any;
  hoveredCell: any;
  minimapContext: CanvasRenderingContext2D;

  regions: Set<Region>;
  region_xyz: number[];
  region_rgba: number[];
  region_lines: any[];
  cell_region: Record<number, Region>;
  mapModes: Record<string, MapMode>;

  constructor(screenCanvas: HTMLCanvasElement, public minimapCanvas: HTMLCanvasElement) {
    this.options$ = new ObservableDict(initialOptions);
    this.drawOptions$ = new ObservableDict(initialDrawOptions);

    this.hoveredCell = null;

    this.regions = new Set();
    this.cell_region = {};
    this.region_lines = [];
    this.regions.add(new Region('foo', [0.5, 0.5, 0.5, 1], [15881, 16114, 16258, 16347, 16580, 16724, 16868, 16635]))

    const renderer = Renderer(
      screenCanvas,
      minimapCanvas,
      this.onLoad(screenCanvas)
    );
    this.renderer = renderer;
    this.drawOptions$.subscribe(() => renderer.camera.setDirty());
    this.removeDrawLoop = renderer.regl.frame(() => {
      renderer.camera.run((state) => {
        if (!state.dirty) return;
        renderer.regl.clear({ color: [0, 0, 0, 1], depth: 1 });
        this.draw();
      });
    });
    (window as any).manager = this;
    (window as any).renderer = renderer;
    
    this.generate();
    this.calculateRegions();

    // initialize map modes
    this.mapModes = {};
    for (const [mapMode, def] of mapModeDefs) {
      this.mapModes[mapMode] = new MapMode(this.globe, mapMode as any, def as any);
    }

    (window as any).globe = this.globe;


    // minimap events
    const jumpToPosition = (x: number, y: number) => {
      const { width, height } = minimapCanvas.getBoundingClientRect();
      const cx = (x / width) - 0.5;
      const cy = (y / height) - 0.5;
      const lat = cx * 360;
      const long = cy * 180;
      this.renderer.camera.centerLatLong(lat, long);
    }

    let isPanningMinimap = false;
    minimapCanvas.addEventListener('mousedown', (event: MouseEvent) => {
      jumpToPosition(event.offsetX, event.offsetY);
      isPanningMinimap = true;
    });
    minimapCanvas.addEventListener('mouseup', (event: MouseEvent) => {
      isPanningMinimap = false;
    });
    minimapCanvas.addEventListener('mousemove', (event: MouseEvent) => {
      if (isPanningMinimap) {
        jumpToPosition(event.offsetX, event.offsetY);
      }
    });
  }
  
  onLoad = (canvas) => () => {
    let isPanning = false;
    canvas.addEventListener('mouseup', () => isPanning = false );
    canvas.addEventListener('mousedown', (event) => {
      if (this.hoveredCell && event.shiftKey) {
        const { r_xyz } = this.globe;
        const h_xyz = [r_xyz[3 * this.hoveredCell], r_xyz[3 * this.hoveredCell + 1], r_xyz[3 * this.hoveredCell + 2]];
        const [long, lat] = getLatLng(h_xyz);
        this.renderer.camera.centerLatLong(lat, long);
      } else {
        // console.log(this.hoveredCell);
      }
      isPanning = true;
      this.hoveredCell = null;
    });
    canvas.addEventListener('mousemove', (event) => {
      if (event.shiftKey || isPanning) return;
      const { left, top } = canvas.getBoundingClientRect();
      const { clientX, clientY } = event;
      const mouseX = clientX - left;
      const mouseY = clientY - top;
      const { projection, view } = this.renderer.camera.state;
      const vp = mat4.multiply([] as any, projection, view);
      let invVp = mat4.invert([] as any, vp);

      // get a single point on the camera ray.
      const rayPoint = vec3.transformMat4(
        [] as any,
        [
          2.0 * mouseX / canvas.width - 1.0,
          -2.0 * mouseY / canvas.height + 1.0,
          0.0
        ],
        invVp,
      );
      // get the position of the camera.
      const rayOrigin = vec3.transformMat4([] as any, [0, 0, 0], mat4.invert([] as any, view));
      const rayDir = vec3.negate([] as any, vec3.normalize([] as any, vec3.subtract([] as any, rayPoint, rayOrigin)));

      const { mesh, t_xyz, r_xyz } = this.globe;
      let sides = [];
      let maxT = -1e10;
      this.hoveredCell = null;
      for (let s = 0; s < mesh.numSides; s++) {
        const inner_t = mesh.s_inner_t(s);
        const outer_t = mesh.s_outer_t(s);
        const begin_r = mesh.s_begin_r(s);
        const x = vec3.fromValues(t_xyz[3 * inner_t], t_xyz[3 * inner_t + 1], t_xyz[3 * inner_t + 2]);
        const y = vec3.fromValues(t_xyz[3 * outer_t], t_xyz[3 * outer_t + 1], t_xyz[3 * outer_t + 2]);
        const z = vec3.fromValues(r_xyz[3 * begin_r], r_xyz[3 * begin_r + 1], r_xyz[3 * begin_r + 2]);
        const tri = [x, y, z];

        let out = [];
        const t = intersectTriangle(out, rayPoint, rayDir, tri);
        if (t !== null) {
          // console.log(s, t, out);
          if (t > maxT) {
            maxT = t;
            this.hoveredCell = mesh.s_begin_r(s);
            break;
          }
        }
      }
      this.renderer.camera.setDirty();
    });
  }

  destroy() {
    this.removeDrawLoop();
  }

  resetCamera() {
    this.destroy();
  }

  calculateRegions() {
    this.region_xyz = [];
    this.region_rgba = [];
    for (const region of this.regions) {
      for (const cell of region.cells) {
        const xyz = this.globe.coordinatesForCell(cell);
        this.cell_region[cell] = region;
        this.region_xyz.push(...xyz);
        this.region_rgba.push(...times(xyz.length / 3).map(() => region.color) as any);
      }

      // find all points for sides not facing this region
      let points = [];
      let widths = [];
      for (const cell of region.cells) {
        let sides = [];
        this.globe.mesh.r_circulate_s(sides, cell);
        for (const s of sides) {
          const begin_r = this.globe.mesh.s_begin_r(s);
          const end_r = this.globe.mesh.s_end_r(s);
          const inner_t = this.globe.mesh.s_inner_t(s);
          const outer_t = this.globe.mesh.s_outer_t(s);
          const p1 = this.globe.t_xyz.slice(3 * inner_t, 3 * inner_t + 3);
          const p2 = this.globe.t_xyz.slice(3 * outer_t, 3 * outer_t + 3);
          if (this.cell_region[end_r] != region) {
            points.push(...p1, ...p1, ...p2, ...p2);
            widths.push(0, 2, 2, 0);
          }
        }
      }
      const line = createLine(this.renderer.regl, {
        color: [0.0, 0.0, 0.0, 0.5],
        widths,
        points,
      });
      this.region_lines.push(line);
    }
  }

  generate() {
    const globe = new Globe(this.options$.toObject() as any);
    this.globe = globe;
    this.renderer.camera.setDirty();
    this.drawMinimap();
  }

  draw() {
    const { mesh, triangleGeometry, minimapGeometry, quadGeometry, r_xyz } = this.globe;

    if (this.drawOptions$.get('mapMode') === EMapMode.NONE) {
      if (this.drawOptions$.get('surface')) {
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
      }
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

    if (this.hoveredCell) {
      this.renderer.drawCellBorder(
        mesh,
        this.globe,
        this.hoveredCell,
      );
    }

    if (this.drawOptions$.get('regions')) {
      this.renderer.renderCellColor({
        scale: mat4.fromScaling(mat4.create(), [1.001, 1.001, 1.001]),
        a_xyz: this.region_xyz,
        a_rgba: this.region_rgba,
        count: this.region_xyz.length / 3,
      } as any);

      for (const line of this.region_lines) {
        line.draw({
          model: mat4.fromScaling(mat4.create(), [1.0011, 1.0011, 1.0011])
        });
      }
    }

    if (this.drawOptions$.get('surface') && this.drawOptions$.get('mapMode')) {
      const mapMode = this.mapModes[this.drawOptions$.get('mapMode')];
      if (mapMode) {
        const { xyz, rgba } = mapMode;
        this.renderer.renderCellColor({
          scale: mat4.fromScaling(mat4.create(), [1.001, 1.001, 1.001]),
          a_xyz: xyz,
          a_rgba: rgba,
          count: xyz.length / 3,
        } as any);
      }
    }
  }

  drawMinimap() {
    const { minimapGeometry } = this.globe;

    // draw minimap
    this.renderer.renderMinimap({
      a_xy: minimapGeometry.xy,
      a_tm: minimapGeometry.tm,
      count: minimapGeometry.xy.length / 2,
    });
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
      style={{
        flex: 1,
      }}
      {...restProps}
    />
  )
}

function Field({ title, children }) {
  return (
    <label className="field">
      <span className="field__title">
        {title}
      </span>
      {children}
    </label>
  );
}

function Tabs({ children }) {
  const tabs = children();
  const firstTab = Object.keys(tabs)[0];
  const [activeTab, setActiveTab] = useState(firstTab);
  return (
    <div>
      <div className="tab-row">
        {Object.keys(tabs).map(tabID => (
          <a
            key={tabID}
            className={classNames(
              'tab',
              activeTab === tabID && 'tab--active'
            )}
            onClick={() => setActiveTab(tabID)}>
            {tabs[tabID].title}
          </a>
        ))}
      </div>
      <div>
        {tabs[activeTab].render()}
      </div>
    </div>
  )
}

function Controls({ manager }: { manager: GameManager }) {
  const seed = useObservableDict(manager.options$, 'seed');
  const cells = useObservableDict(manager.options$, 'numberCells');
  const jitter = useObservableDict(manager.options$, 'jitter');
  const plates = useObservableDict(manager.options$, 'numberPlates');
  const flowModifier = useObservableDict(manager.options$, 'flowModifier');
  const oceanPlatePercent = useObservableDict(manager.options$, 'oceanPlatePercent');

  const mapMode = useObservableDict(manager.drawOptions$, 'mapMode');
  const drawGrid = useObservableDict(manager.drawOptions$, 'grid');
  const drawPlateVectors = useObservableDict(manager.drawOptions$, 'plateVectors');
  const drawPlateBorders = useObservableDict(manager.drawOptions$, 'plateBorders');
  const drawCellCenters = useObservableDict(manager.drawOptions$, 'cellCenters');
  const drawRivers = useObservableDict(manager.drawOptions$, 'rivers');
  const drawSurface = useObservableDict(manager.drawOptions$, 'surface');
  const drawRegions = useObservableDict(manager.drawOptions$, 'regions');

  return (
    <div id="controls">
      <h1>Terra</h1>
      <Tabs>
        {() => ({
          generate: {
            title: 'Map options',
            render: () => (
              <div>
                <Field title="Seed">
                  <Input
                    type="number"
                    value={seed}
                    onChange={value => manager.options$.set('seed', value)}
                  />
                </Field>

                <Field title="Number of Cells">
                  <Input
                    type="number"
                    value={cells}
                    min={0}
                    onChange={value => manager.options$.set('numberCells', parseInt(value, 10))}
                  />
                </Field>

                <Field title="Cell Jitter">
                  <Input
                    type="number"
                    value={jitter}
                    min={0}
                    max={1}
                    step={0.05}
                    onChange={value => manager.options$.set('jitter', value)}
                  />
                </Field>

                <Field title="Number of Plates">
                  <Input
                    type="number"
                    value={plates}
                    min={0}
                    onChange={value => manager.options$.set('numberPlates', parseInt(value, 10))}
                  />
                </Field>

                <Field title="Flow modifier">
                  <Input
                    type="number"
                    value={flowModifier}
                    min={0}
                    max={1}
                    step={0.1}
                    onChange={value => manager.options$.set('flowModifier', value)}
                  />
                </Field>

                <Field title="Ocean Plate Percent">
                  <Input
                    type="number"
                    value={oceanPlatePercent}
                    min={0}
                    max={1}
                    step={0.1}
                    onChange={value => manager.options$.set('oceanPlatePercent', value)}
                  />
                </Field>
              </div>
            )
          },
          render: {
            title: 'Draw options',
            render: () => (
              <div>
                <Field title="Map Mode">
                  <select
                    value={mapMode}
                    onChange={event => manager.drawOptions$.set('mapMode', event.target.value as any)}
                  >
                    {Object.entries(mapModeTitles).map(([mapMode, title]) => (
                      <option key={title} value={mapMode}>{title}</option>
                    ))}
                  </select>
                </Field>
                <Field title="Draw Grid">
                  <input
                    type="checkbox"
                    checked={drawGrid}
                    onChange={event => manager.drawOptions$.set('grid', event.target.checked)}
                  />
                </Field>

                <Field title="Draw Plate Borders">
                  <input
                    type="checkbox"
                    checked={drawPlateBorders}
                    onChange={event => manager.drawOptions$.set('plateBorders', event.target.checked)}
                  />
                </Field>

                <Field title="Draw Plate Vectors">
                  <input
                    type="checkbox"
                    checked={drawPlateVectors}
                    onChange={event => manager.drawOptions$.set('plateVectors', event.target.checked)}
                  />
                </Field>

                <Field title="Draw Cell Centers">
                  <input
                    type="checkbox"
                    checked={drawCellCenters}
                    onChange={event => manager.drawOptions$.set('cellCenters', event.target.checked)}
                  />
                </Field>

                <Field title="Draw Rivers">
                  <input
                    type="checkbox"
                    checked={drawRivers}
                    onChange={event => manager.drawOptions$.set('rivers', event.target.checked)}
                  />
                </Field>

                <Field title="Draw Surface">
                  <input
                    type="checkbox"
                    checked={drawSurface}
                    onChange={event => manager.drawOptions$.set('surface', event.target.checked)}
                  />
                </Field>

                <Field title="Draw Regions">
                  <input
                    type="checkbox"
                    checked={drawRegions}
                    onChange={event => manager.drawOptions$.set('regions', event.target.checked)}
                  />
                </Field>
              </div>
            )
          }
        })}
      </Tabs>
    </div>
  );
}

export function App() {
  const screenRef = useRef();
  const minimapRef = useRef();
  const [manager, setManager] = useState(null);

  useEffect(() => {
    const manager = new GameManager(screenRef.current, minimapRef.current);
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
      <canvas
        className="minimap"
        ref={minimapRef}
        width={360 * 5}
        height={180 * 5}
      />
      {manager && <Controls manager={manager} />}
    </div>
  );
}