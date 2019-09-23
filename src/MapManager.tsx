import { mat4, vec3 } from 'gl-matrix';
import { times } from 'lodash';
import createLine from 'regl-line';
import { Globe } from './worldgen/Globe';
import { MapMode, mapModeDefs } from './mapModes';
import Renderer from './Renderer';
import { EDrawMode, EMapMode, IDrawOptions, IGlobeOptions, biomeTitles } from './types';
import { getLatLng, ImageRef, intersectTriangle, logGroupTime } from './utils';
import { ObservableDict } from './utils/ObservableDict';
import { CellGroup } from "./CellGroup";
import { BehaviorSubject } from 'rxjs';


export const initialOptions: IGlobeOptions = {
  core: {
    seed: 123,
  },
  sphere: {
    numberCells: 35_000,
    jitter: 0.6,
    protrudeHeight: 0.25,
  },
  hydrology: {
    flowModifier: 0.2,
    moistureModifier: 0,
  },
  climate: {
    temperatureModifier: 0,
  },
  geology: {
    numberPlates: 25,
    oceanPlatePercent: 1,
    terrainRoughness: 0.5,
    heightModifier: -0.25,
    plateCollisionThreshold: 0.75,
  },
};
Object.freeze(initialOptions);

interface IPreset {
  name: string;
  desc: string;
  options: IGlobeOptions;
}

export const presets: IPreset[] = [
  {
    name: 'Temperate',
    desc: 'A planet with temperate climate',
    options: initialOptions,
  },
  {
    name: 'Cold',
    desc: 'A planet with a cold climate',
    options: {
      ...initialOptions,
      climate: {
        temperatureModifier: -0.5,
      }
    }
  },
  {
    name: 'Hot',
    desc: 'A planet with a hot climate',
    options: {
      ...initialOptions,
      climate: {
        temperatureModifier: 0.5,
      }
    }
  }
]

const initialDrawOptions: IDrawOptions = {
  drawMode: EDrawMode.CENTROID,
  grid: false,
  plateBorders: false,
  plateVectors: false,
  rivers: true,
  cellCenters: false,
  surface: true,
  regions: false,
  coastline: false,
  mapMode: EMapMode.BIOME,
};


/**
 * Renders a Globe instance
 * Contains CellGroups
 */
export class MapManager {
  globeOptions$: BehaviorSubject<IGlobeOptions>;
  drawOptions$: ObservableDict<IDrawOptions>;
  renderer: ReturnType<typeof Renderer>;
  camera: any;
  globe: Globe;
  removeDrawLoop: any;
  hoveredCell: BehaviorSubject<number>;
  minimapContext: CanvasRenderingContext2D;
  cellGroups: Set<CellGroup>;
  cell_group_xyz: number[];
  cell_group_rgba: number[];
  cell_group_lines: any[];
  cell_cell_group: Record<number, CellGroup>;
  mapModes: Record<string, MapMode>;

  constructor(protected screenCanvas: HTMLCanvasElement, protected minimapCanvas: HTMLCanvasElement, protected images: ImageRef[]) {
    this.globeOptions$ = new BehaviorSubject<IGlobeOptions>(Object.assign({}, initialOptions));
    this.drawOptions$ = new ObservableDict(initialDrawOptions);

    this.hoveredCell = new BehaviorSubject(null);
    this.cellGroups = new Set();
    this.cell_cell_group = {};
    this.mapModes = {};
    this.cell_group_lines = [];
    this.cellGroups.add(new CellGroup('foo', [0.5, 0.5, 0.5, 1], [15881, 16114, 16258, 16347, 16580, 16724, 16868, 16635]));
    const renderer = Renderer(screenCanvas, minimapCanvas, this.onLoad(screenCanvas), images);
    this.renderer = renderer;
    this.drawOptions$.subscribe(() => renderer.camera.setDirty());
    this.removeDrawLoop = renderer.regl.frame(() => {
      renderer.camera.run((state) => {
        if (!state.dirty)
          return;
        renderer.regl.clear({ color: [0, 0, 0, 1], depth: 1 });
        this.draw();
      });
    });
    (window as any).manager = this;
    (window as any).renderer = renderer;
    this.globeOptions$.subscribe(() => {
      this.generate();
    });

    // redraw minimap when draw option changes
    this.drawOptions$.ofKey('mapMode').subscribe(() => this.drawMinimap());

    // minimap events
    const jumpToPosition = (x: number, y: number) => {
      const { width, height } = minimapCanvas.getBoundingClientRect();
      const cx = (x / width) - 0.5;
      const cy = (y / height) - 0.5;
      const lat = cx * 360;
      const long = cy * 180;
      this.renderer.camera.centerLatLong(lat, long);
    };
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

  @logGroupTime('init map modes')
  initMapModes() {
    for (const [mapMode, def] of mapModeDefs) {
      this.mapModes[mapMode] = new MapMode(this.globe, def);
      console.log(mapMode, this.mapModes[mapMode]);
    }
  }

  onLoad = (canvas) => () => {
    let isPanning = false;
    canvas.addEventListener('mouseup', () => isPanning = false);
    canvas.addEventListener('mousedown', (event) => {
      if (this.hoveredCell.value && event.shiftKey) {
        const { r_xyz } = this.globe;
        const h_xyz = [r_xyz[3 * this.hoveredCell.value], r_xyz[3 * this.hoveredCell.value + 1], r_xyz[3 * this.hoveredCell.value + 2]];
        const [long, lat] = getLatLng(h_xyz);
        this.renderer.camera.centerLatLong(lat, long);
      }
      else {
        // console.log(this.hoveredCell);
      }
      isPanning = true;
      this.hoveredCell.next(null);
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
      const rayPoint = vec3.transformMat4([] as any, [
        2.0 * mouseX / canvas.width - 1.0,
        -2.0 * mouseY / canvas.height + 1.0,
        0.0
      ], invVp);
      // get the position of the camera.
      const rayOrigin = vec3.transformMat4([] as any, [0, 0, 0], mat4.invert([] as any, view));
      const rayDir = vec3.negate([] as any, vec3.normalize([] as any, vec3.subtract([] as any, rayPoint, rayOrigin)));
      const { mesh, t_xyz, r_xyz } = this.globe;
      let sides = [];
      let maxT = -1e10;
      this.hoveredCell.next(null);
      for (let s = 0; s < mesh.numSides; s++) {
        const inner_t = mesh.s_inner_t(s);
        const outer_t = mesh.s_outer_t(s);
        const begin_r = mesh.s_begin_r(s);
        const x = [t_xyz[3 * inner_t], t_xyz[3 * inner_t + 1], t_xyz[3 * inner_t + 2]];
        const y = [t_xyz[3 * outer_t], t_xyz[3 * outer_t + 1], t_xyz[3 * outer_t + 2]];
        const z = [r_xyz[3 * begin_r], r_xyz[3 * begin_r + 1], r_xyz[3 * begin_r + 2]];
        const tri = [x, y, z];
        let out = [];
        const t = intersectTriangle(out, rayPoint, rayDir, tri);
        if (t !== null) {
          // console.log(s, t, out);
          if (t > maxT) {
            maxT = t;
            this.hoveredCell.next(mesh.s_begin_r(s));
            break;
          }
        }
      }
      this.renderer.camera.setDirty();
    });
  };

  destroy() {
    this.removeDrawLoop();
  }

  resetCamera() {
    this.destroy();
  }

  @logGroupTime('calculate cell groups')
  calculateCellGroups() {
    this.cell_group_xyz = [];
    this.cell_group_rgba = [];
    for (const region of this.cellGroups) {
      for (const cell of region.cells) {
        const xyz = this.globe.coordinatesForCell(cell);
        this.cell_cell_group[cell] = region;
        this.cell_group_xyz.push(...xyz);
        this.cell_group_rgba.push(...times(xyz.length / 3).map(() => region.color) as any);
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
          if (this.cell_cell_group[end_r] != region) {
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
      this.cell_group_lines.push(line);
    }
  }

  @logGroupTime('generate')
  generate() {
    const globe = new Globe(this.globeOptions$.value as IGlobeOptions);
    delete (window as any).globe;
    delete this.globe;
    (window as any).globe = this.globe;
    this.globe = globe;
    console.log('globe', globe);

    this.initMapModes();
    this.calculateCellGroups();
    this.renderer.camera.setDirty();
    this.drawMinimap();
  }

  draw() {
    const { mesh, triangleGeometry, minimapGeometry, quadGeometry, r_xyz } = this.globe;
    if (this.drawOptions$.get('mapMode') === EMapMode.NONE) {
      if (this.drawOptions$.get('drawMode') == EDrawMode[EDrawMode.CENTROID]) {
        this.renderer.renderTriangles({
          a_xyz: triangleGeometry.xyz,
          a_tm: triangleGeometry.tm,
          count: triangleGeometry.xyz.length / 3,
        });
      }
      else if (this.drawOptions$.get('drawMode') == EDrawMode[EDrawMode.QUADS]) {
        this.renderer.renderIndexedTriangles({
          a_xyz: quadGeometry.xyz,
          a_tm: quadGeometry.tm,
          elements: quadGeometry.I,
        } as any);
      }
    }
    if (this.drawOptions$.get('rivers')) {
      this.renderer.drawRivers(mesh, this.globe, 0.5);
    }
    if (this.drawOptions$.get('plateVectors')) {
      this.renderer.drawPlateVectors(mesh, this.globe, this.globeOptions$.value);
    }
    if (this.drawOptions$.get('plateBorders')) {
      this.renderer.drawPlateBoundaries(mesh, this.globe);
    }
    if (this.drawOptions$.get('grid')) {
      this.renderer.drawCellBorders(mesh, this.globe);
    }
    if (this.drawOptions$.get('cellCenters')) {
      let u_pointsize = 10.0 + (100 / Math.sqrt(this.globeOptions$.value['numberCells']));
      this.renderer.renderPoints({
        u_pointsize,
        a_xyz: r_xyz,
        count: mesh.numRegions,
      });
    }
    if (this.hoveredCell.value) {
      this.renderer.drawCellBorder(mesh, this.globe, this.hoveredCell.value);
    }
    if (this.drawOptions$.get('regions')) {
      this.renderer.renderCellColor({
        scale: mat4.fromScaling(mat4.create(), [1.001, 1.001, 1.001]),
        a_xyz: this.cell_group_xyz,
        a_rgba: this.cell_group_rgba,
        count: this.cell_group_xyz.length / 3,
      } as any);
      for (const line of this.cell_group_lines) {
        line.draw({
          model: mat4.fromScaling(mat4.create(), [1.0011, 1.0011, 1.0011])
        });
      }
    }
    if (this.drawOptions$.get('surface') && this.drawOptions$.get('mapMode')) {
      const mapMode = this.mapModes[this.drawOptions$.get('mapMode')];
      if (mapMode) {
        this.renderer.renderCellColor({
          scale: mat4.fromScaling(mat4.create(), [1, 1, 1]),
          a_xyz: triangleGeometry.xyz,
          a_rgba: mapMode.rgba,
          count: triangleGeometry.xyz.length / 3,
        } as any);
      }
    }
    if (this.drawOptions$.get('coastline')) {
      this.renderer.drawCoastline(mesh, this.globe);
    }
    this.renderer.renderStarbox();
  }

  @logGroupTime('draw minimap')
  drawMinimap() {
    const { minimapGeometry } = this.globe;
    // draw minimap
    if (this.drawOptions$.get('mapMode') !== EMapMode.NONE) {
      const mapMode = this.mapModes[this.drawOptions$.get('mapMode')];
      if (mapMode) {
        this.renderer.renderMinimapCellColor({
          scale: mat4.fromScaling(mat4.create(), [1.001, 1.001, 1.001]),
          a_xy: minimapGeometry.xy,
          a_rgba: mapMode.minimap_rgba,
          count: minimapGeometry.xy.length / 2,
        });
      }
    } else {
      this.renderer.renderMinimap({
        a_xy: minimapGeometry.xy,
        a_tm: minimapGeometry.tm,
        count: minimapGeometry.xy.length / 2,
      });
    }
  }
}
