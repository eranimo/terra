import { mat4, vec3 } from 'gl-matrix';
import createLine from 'regl-line';
import { BehaviorSubject } from 'rxjs';
import Renderer from './Renderer';
import { CellPoints, defaultDrawOptions, EMapMode, GlobeData, IDrawOptions, IGlobeOptions, mapModeDrawOptions, ICellGroupData } from './types';
import { ImageRef, logGroupTime } from './utils';
import { ObservableDict } from './utils/ObservableDict';
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
    oceanPlatePercent: 0.75,
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
  client: WorldgenClient;
  globeOptions$: BehaviorSubject<IGlobeOptions>;
  drawOptions$: ObservableDict<IDrawOptions>;
  renderer: ReturnType<typeof Renderer>;
  camera: any;
  globe: GlobeData;
  cellGroups: ICellGroupData[];
  cellGroupLines: Record<string, any>;
  removeDrawLoop: any;
  selectedCell: BehaviorSubject<CellPoints>;
  minimapContext: CanvasRenderingContext2D;
  mapMode$: BehaviorSubject<EMapMode>;

  renderState: {
    rivers: any,
    coastline: any,
    plateBorders: any,
  };

  constructor(
    protected screenCanvas: HTMLCanvasElement,
    protected minimapCanvas: HTMLCanvasElement,
    protected images: ImageRef[],
    protected onBeforeGenerate: () => void,
    protected onAfterGenerate: () => void,
  ) {
    this.client = new WorldgenClient();
    this.globeOptions$ = new BehaviorSubject<IGlobeOptions>(Object.assign({}, initialOptions));
    const startMapMode = localStorage.lastMapMode || DEFAULT_MAP_MODE;
    this.mapMode$ = new BehaviorSubject<EMapMode>(startMapMode);
    this.drawOptions$ = new ObservableDict({
      ...defaultDrawOptions,
      ...mapModeDrawOptions[startMapMode],
    });
    this.selectedCell = new BehaviorSubject(null);
    const renderer = Renderer(screenCanvas, minimapCanvas, this.onLoad(screenCanvas), images);
    this.renderer = renderer;
    this.cellGroupLines = {};
    this.drawOptions$.subscribe(() => renderer.camera.setDirty());

    (window as any).manager = this;
    (window as any).renderer = renderer;
    this.globeOptions$.subscribe(() => {
      this.generate();
    });

    // redraw minimap when draw option changes
    this.mapMode$.subscribe(mapMode => {
      localStorage.lastMapMode = mapMode;
      if (this.globe) {
        this.drawOptions$.replace({
          ...defaultDrawOptions,
          ...mapModeDrawOptions[mapMode],
        });
        this.client.setMapMode(mapMode).then(() => {
          renderer.camera.setDirty();
          this.drawMinimap();
        });
      }
    });

    window.addEventListener('resize', () => {
      renderer.camera.setDirty();
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

    this.client.worker$.on('draw').subscribe(() => {
      if (this.globe) {
        renderer.camera.setDirty();
        this.drawMinimap();
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

  onLoad = (canvas) => () => {
    let downX = 0;
    let downY = 0;
    canvas.addEventListener('mousedown', event => {
      downX = event.clientX;
      downY = event.clientY;
    });
    canvas.addEventListener('mouseup', event => {
      const distance = Math.sqrt(
        Math.pow(downX - event.clientX, 2) +
        Math.pow(downY - event.clientY, 2)
      );

      if (distance > 10) return;
      
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
      this.client.getIntersectedCell(
        [rayPoint[0], rayPoint[1], rayPoint[2]],
        [rayDir[0], rayDir[1], rayDir[2]],
      ).then(cellPoints => {
        console.log(this.selectedCell.value, cellPoints.cell);
        if (this.selectedCell.value && cellPoints.cell === this.selectedCell.value.cell) {
          this.selectedCell.next(null);
        } else {
          this.selectedCell.next(cellPoints);
        }
        this.renderer.camera.setDirty();
      });
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
    for (const groupData of this.cellGroups) {
      const line = createLine(this.renderer.regl, {
        color: [0.0, 0.0, 0.0, 0.5],
        widths: groupData.border_widths,
        points: groupData.border_points,
      });
      this.cellGroupLines[groupData.name] = line;
    }
  }

  @logGroupTime('generate')
  async generate() {
    this.onBeforeGenerate();
    const result = await this.client.newWorld(this.globeOptions$.value, this.mapMode$.value);
    this.globe = result.globe;
    this.cellGroups = result.cellGroups;
    console.log('worldgen', this.client);
    this.setupRendering();
    this.startRenderLoop();

    this.calculateCellGroups();
    this.drawMinimap();
    this.onAfterGenerate();
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
    const { mapModeColor, triangleGeometry } = this.globe;
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
    if (this.drawOptions$.get('grid')) {
      this.renderer.renderLines({
        scale: mat4.fromScaling(mat4.create(), [1.002, 1.002, 1.002]),
        u_multiply_rgba: [1, 1, 1, 0.5],
        u_add_rgba: [0, 0, 0, 0],
        a_xyz: this.globe.cellBorders.points,
        a_rgba: this.globe.cellBorders.rgba,
        count: this.globe.cellBorders.points.length,
      });
    }
    if (this.drawOptions$.get('cellCenters')) {
      let u_pointsize = 10.0;
      this.renderer.renderPoints({
        u_pointsize,
        a_xyz: this.globe.r_xyz,
        count: this.globe.r_xyz.length / 3,
      });
    }
    if (this.selectedCell.value) {
      this.renderer.drawCellBorder(this.selectedCell.value.points);
    }
    if (this.drawOptions$.get('regions')) {
      for (const cellGroup of this.cellGroups) {
        this.renderer.renderCellColor({
          scale: mat4.fromScaling(mat4.create(), [1.001, 1.001, 1.001]),
          a_xyz: cellGroup.cells_xyz,
          a_rgba: cellGroup.cells_rgba,
          count: cellGroup.cells_xyz.length / 3,
        } as any);

        const line = this.cellGroupLines[cellGroup.name];
        if (line) {
          line.draw({
            model: mat4.fromScaling(mat4.create(), [1.0011, 1.0011, 1.0011])
          });
        }
      }
    }

    if (this.drawOptions$.get('surface') && this.mapMode$.value) {
      this.renderer.renderCellColor({
        scale: mat4.fromScaling(mat4.create(), [1, 1, 1]),
        a_xyz: triangleGeometry,
        a_rgba: mapModeColor,
        count: triangleGeometry.length / 3,
      } as any);
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
    const { minimapGeometry, mapModeColor } = this.globe;
    // draw minimap
    this.renderer.renderMinimapCellColor({
      scale: mat4.fromScaling(mat4.create(), [1.001, 1.001, 1.001]),
      a_xy: minimapGeometry,
      a_rgba: mapModeColor,
      count: minimapGeometry.length / 2,
    });
  }
}
