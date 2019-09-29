import { mat4, vec3 } from 'gl-matrix';
import { times } from 'lodash';
import createLine from 'regl-line';
import { Globe } from './worldgen/Globe';
import { mapModeDefs } from './mapModes';
import Renderer from './Renderer';
import { EMapMode, IDrawOptions, IGlobeOptions, biomeTitles, defaultDrawOptions, mapModeDrawOptions, monthTitles, GlobeData } from './types';
import { getLatLng, ImageRef, intersectTriangle, logGroupTime } from './utils';
import { ObservableDict } from './utils/ObservableDict';
import { CellGroup } from "./CellGroup";
import { BehaviorSubject } from 'rxjs';
import { WorldgenClient } from './worldgen/WorldgenClient';


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


const DEFAULT_MAP_MODE = EMapMode.BIOME;

/**
 * Renders a Globe instance
 * Contains CellGroups
 */
export class MapManager {
  globeOptions$: BehaviorSubject<IGlobeOptions>;
  drawOptions$: ObservableDict<IDrawOptions>;
  renderer: ReturnType<typeof Renderer>;
  camera: any;
  globe: GlobeData;
  removeDrawLoop: any;
  hoveredCell: BehaviorSubject<number>;
  minimapContext: CanvasRenderingContext2D;
  cellGroups: Set<CellGroup>;
  cell_group_xyz: number[];
  cell_group_rgba: number[];
  cell_group_lines: any[];
  cell_cell_group: Record<number, CellGroup>;
  mapMode$: BehaviorSubject<EMapMode>;

  renderState: {
    rivers: any,
    coastline: any,
    plateBorders: any,
  };

  constructor(protected screenCanvas: HTMLCanvasElement, protected minimapCanvas: HTMLCanvasElement, protected images: ImageRef[]) {
    this.globeOptions$ = new BehaviorSubject<IGlobeOptions>(Object.assign({}, initialOptions));
    this.mapMode$ = new BehaviorSubject<EMapMode>(localStorage.lastMapMode || DEFAULT_MAP_MODE);
    this.drawOptions$ = new ObservableDict({
      ...defaultDrawOptions,
      ...mapModeDrawOptions[DEFAULT_MAP_MODE],
    });

    this.hoveredCell = new BehaviorSubject(null);
    this.cellGroups = new Set();
    this.cell_cell_group = {};
    this.cell_group_lines = [];
    this.cellGroups.add(new CellGroup('foo', [0.5, 0.5, 0.5, 1], [15881, 16114, 16258, 16347, 16580, 16724, 16868, 16635]));
    const renderer = Renderer(screenCanvas, minimapCanvas, this.onLoad(screenCanvas), images);
    this.renderer = renderer;
    this.drawOptions$.subscribe(() => renderer.camera.setDirty());

    (window as any).manager = this;
    (window as any).renderer = renderer;
    this.globeOptions$.subscribe(() => {
      this.generate();
    });

    // redraw minimap when draw option changes
    this.mapMode$.subscribe(mapMode => {
      localStorage.lastMapMode = mapMode;
      this.drawOptions$.replace({
        ...defaultDrawOptions,
        ...mapModeDrawOptions[mapMode],
      })
      if (this.globe) {
        this.drawMinimap();
      }
    });

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

  startRenderLoop() {
    this.removeDrawLoop = this.renderer.regl.frame(() => {
      this.renderer.camera.run((state) => {
        if (!state.dirty) return;
        this.renderer.regl.clear({ color: [0, 0, 0, 1], depth: 1 });
        this.draw();
      });
    });
  }

  @logGroupTime('init map modes')
  initMapModes() {
    // for (const [mapMode, def] of mapModeDefs) {
    //   this.mapModes[mapMode] = new MapMode(this.globe, def);
    //   console.log(mapMode, this.mapModes[mapMode]);
    // }
  }

  onLoad = (canvas) => () => {
    // let isPanning = false;
    // canvas.addEventListener('mouseup', () => isPanning = false);
    // canvas.addEventListener('mousedown', (event) => {
    //   if (this.hoveredCell.value && event.shiftKey) {
    //     const { r_xyz } = this.globe;
    //     const h_xyz = [r_xyz[3 * this.hoveredCell.value], r_xyz[3 * this.hoveredCell.value + 1], r_xyz[3 * this.hoveredCell.value + 2]];
    //     const [long, lat] = getLatLng(h_xyz);
    //     this.renderer.camera.centerLatLong(lat, long);
    //   }
    //   else {
    //     // console.log(this.hoveredCell);
    //   }
    //   isPanning = true;
    //   this.hoveredCell.next(null);
    // });
    // canvas.addEventListener('mousemove', (event) => {
    //   if (event.shiftKey || isPanning) return;
    //   const { left, top } = canvas.getBoundingClientRect();
    //   const { clientX, clientY } = event;
    //   const mouseX = clientX - left;
    //   const mouseY = clientY - top;
    //   const { projection, view } = this.renderer.camera.state;
    //   const vp = mat4.multiply([] as any, projection, view);
    //   let invVp = mat4.invert([] as any, vp);
    //   // get a single point on the camera ray.
    //   const rayPoint = vec3.transformMat4([] as any, [
    //     2.0 * mouseX / canvas.width - 1.0,
    //     -2.0 * mouseY / canvas.height + 1.0,
    //     0.0
    //   ], invVp);
    //   // get the position of the camera.
    //   const rayOrigin = vec3.transformMat4([] as any, [0, 0, 0], mat4.invert([] as any, view));
    //   const rayDir = vec3.negate([] as any, vec3.normalize([] as any, vec3.subtract([] as any, rayPoint, rayOrigin)));
    //   const { mesh, t_xyz, r_xyz } = this.globe;
    //   let sides = [];
    //   let maxT = -1e10;
    //   this.hoveredCell.next(null);
    //   for (let s = 0; s < mesh.numSides; s++) {
    //     const inner_t = mesh.s_inner_t(s);
    //     const outer_t = mesh.s_outer_t(s);
    //     const begin_r = mesh.s_begin_r(s);
    //     const x = [t_xyz[3 * inner_t], t_xyz[3 * inner_t + 1], t_xyz[3 * inner_t + 2]];
    //     const y = [t_xyz[3 * outer_t], t_xyz[3 * outer_t + 1], t_xyz[3 * outer_t + 2]];
    //     const z = [r_xyz[3 * begin_r], r_xyz[3 * begin_r + 1], r_xyz[3 * begin_r + 2]];
    //     const tri = [x, y, z];
    //     let out = [];
    //     const t = intersectTriangle(out, rayPoint, rayDir, tri);
    //     if (t !== null) {
    //       // console.log(s, t, out);
    //       if (t > maxT) {
    //         maxT = t;
    //         this.hoveredCell.next(mesh.s_begin_r(s));
    //         break;
    //       }
    //     }
    //   }
    //   this.renderer.camera.setDirty();
    // });
  };

  destroy() {
    this.removeDrawLoop();
  }

  resetCamera() {
    this.destroy();
  }

  @logGroupTime('calculate cell groups')
  calculateCellGroups() {
    // this.cell_group_xyz = [];
    // this.cell_group_rgba = [];
    // for (const region of this.cellGroups) {
    //   for (const cell of region.cells) {
    //     const xyz = this.globe.coordinatesForCell(cell);
    //     this.cell_cell_group[cell] = region;
    //     this.cell_group_xyz.push(...xyz);
    //     this.cell_group_rgba.push(...times(xyz.length / 3).map(() => region.color) as any);
    //   }
    //   // find all points for sides not facing this region
    //   let points = [];
    //   let widths = [];
    //   for (const cell of region.cells) {
    //     let sides = [];
    //     this.globe.mesh.r_circulate_s(sides, cell);
    //     for (const s of sides) {
    //       const begin_r = this.globe.mesh.s_begin_r(s);
    //       const end_r = this.globe.mesh.s_end_r(s);
    //       const inner_t = this.globe.mesh.s_inner_t(s);
    //       const outer_t = this.globe.mesh.s_outer_t(s);
    //       const p1 = this.globe.t_xyz.slice(3 * inner_t, 3 * inner_t + 3);
    //       const p2 = this.globe.t_xyz.slice(3 * outer_t, 3 * outer_t + 3);
    //       if (this.cell_cell_group[end_r] != region) {
    //         points.push(...p1, ...p1, ...p2, ...p2);
    //         widths.push(0, 2, 2, 0);
    //       }
    //     }
    //   }
    //   const line = createLine(this.renderer.regl, {
    //     color: [0.0, 0.0, 0.0, 0.5],
    //     widths,
    //     points,
    //   });
    //   this.cell_group_lines.push(line);
    // }
  }

  @logGroupTime('generate')
  async generate() {
    const worldgen = new WorldgenClient();
    const result = await worldgen.newWorld(this.globeOptions$.value);
    this.globe = result;
    console.log('worldgen', worldgen);
    this.setupRendering();
    this.startRenderLoop();
    
    // const globe = new Globe(this.globeOptions$.value as IGlobeOptions);
    // delete (window as any).globe;
    // delete this.globe;
    // (window as any).globe = this.globe;
    // this.globe = globe;
    // console.log('globe', globe);

    // this.calculateCellGroups();
    // this.renderer.camera.setDirty();
    this.drawMinimap();


    // setInterval(() => {
    //   this.globe.currentMonth = ((this.globe.currentMonth + 1) % 12);
    //   console.log(monthTitles[this.globe.currentMonth]);
    //   this.mapModes[EMapMode.TEMPERATURE].generate();
    //   this.renderer.camera.setDirty();
    //   this.drawMinimap();
    // }, 1000);
  }

  setupRendering() {
    this.renderState = {
      rivers: createLine(this.renderer.regl, {
        color: [0.0, 0.0, 1.0, 1.0],
        widths: this.globe.rivers.widths,
        points: this.globe.rivers.points,
        miter: 1
      }),
      coastline: createLine(this.renderer.regl, {
        color: [0.0, 0.0, 0.0, 1.0],
        widths: this.globe.coastline.widths,
        points: this.globe.coastline.points,
        miter: 1
      }),
      plateBorders: createLine(this.renderer.regl, {
        color: [1.0, 0.0, 0.0, 1.0],
        widths: this.globe.plateBorders.widths,
        points: this.globe.plateBorders.points,
      })
    }
  }

  draw() {
    const { mapModeColors, triangleGeometry } = this.globe;
    if (this.drawOptions$.get('rivers')) {
      this.renderState.rivers.draw({
        model: mat4.fromScaling(mat4.create(), [1.0011, 1.0011, 1.0011])
      });
    }
    if (this.drawOptions$.get('plateVectors')) {
      this.renderer.drawPlateVectors(this.globe.plateVectors.line_xyz, this.globe.plateVectors.line_rgba);
    }
    if (this.drawOptions$.get('plateBorders')) {
      this.renderState.plateBorders.draw({
        model: mat4.fromScaling(mat4.create(), [1.0011, 1.0011, 1.0011])
      });
    }
    // if (this.drawOptions$.get('grid')) {
    //   this.renderer.drawCellBorders(mesh, this.globe);
    // }
    // if (this.drawOptions$.get('cellCenters')) {
    //   let u_pointsize = 10.0 + (100 / Math.sqrt(this.globeOptions$.value['numberCells']));
    //   this.renderer.renderPoints({
    //     u_pointsize,
    //     a_xyz: r_xyz,
    //     count: mesh.numRegions,
    //   });
    // }
    // if (this.hoveredCell.value) {
    //   this.renderer.drawCellBorder(mesh, this.globe, this.hoveredCell.value);
    // }
    // if (this.drawOptions$.get('regions')) {
    //   this.renderer.renderCellColor({
    //     scale: mat4.fromScaling(mat4.create(), [1.001, 1.001, 1.001]),
    //     a_xyz: this.cell_group_xyz,
    //     a_rgba: this.cell_group_rgba,
    //     count: this.cell_group_xyz.length / 3,
    //   } as any);
    //   for (const line of this.cell_group_lines) {
    //     line.draw({
    //       model: mat4.fromScaling(mat4.create(), [1.0011, 1.0011, 1.0011])
    //     });
    //   }
    // }

    if (this.drawOptions$.get('surface') && this.mapMode$.value) {
      const rgba = mapModeColors[this.mapMode$.value];
      if (rgba) {
        this.renderer.renderCellColor({
          scale: mat4.fromScaling(mat4.create(), [1, 1, 1]),
          a_xyz: triangleGeometry,
          a_rgba: rgba,
          count: triangleGeometry.length / 3,
        } as any);
      }
    }
    if (this.drawOptions$.get('coastline')) {
      this.renderState.coastline.draw({
        model: mat4.fromScaling(mat4.create(), [1.0011, 1.0011, 1.0011])
      });
    }
    this.renderer.renderStarbox();
  }

  @logGroupTime('draw minimap')
  drawMinimap() {
    const { minimapGeometry, mapModeColors } = this.globe;
    // draw minimap
    const rgba = mapModeColors[this.mapMode$.value];
    if (rgba) {
      this.renderer.renderMinimapCellColor({
        scale: mat4.fromScaling(mat4.create(), [1.001, 1.001, 1.001]),
        a_xy: minimapGeometry,
        a_rgba: rgba,
        count: minimapGeometry.length / 2,
      });
    }
  }
}
