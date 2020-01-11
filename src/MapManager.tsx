import { mat4, vec3 } from 'gl-matrix';
import createLine from 'regl-line';
import { BehaviorSubject, Subject } from 'rxjs';
import { CellPoints, defaultDrawOptions, EMapMode, GlobeData, IDrawOptions, IGlobeOptions, mapModeDrawOptions, ICellGroupData } from './types';
import { ImageRef, logGroupTime, getUV } from './utils';
import { ObservableDict } from './utils/ObservableDict';
import { WorldgenClient } from './worldgen/WorldgenClient';
import { Cancellable } from 'regl';
import { mapModeDefs } from './mapModes';
import { Material, AbstractMesh, TransformNode, Particle } from '@babylonjs/core';
import REGL = require('regl');
import "@babylonjs/core/Debug/debugLayer";
import "@babylonjs/inspector";
import { GlobeRenderer, GlobeEvents } from './GlobeRenderer';


const DEFAULT_MAP_MODE = EMapMode.BIOME;


type MinimapCellColorUniforms = {
  scale: REGL.Mat4,
}

type MinimapCellColorProps = {
  scale: mat4,
  count: number,
  a_xy: Float32Array,
  a_rgba?: Float32Array,
}

function setupMinimapRenderer(canvas) {
  const reglMinimap = REGL({
    canvas,
    extensions: ['OES_element_index_uint', 'OES_standard_derivatives', 'ANGLE_instanced_arrays'],
  });
  return reglMinimap<MinimapCellColorUniforms, any, MinimapCellColorProps, any>({
    frag: `
  precision mediump float;
  varying vec4 v_rgba;

  void main() {
    gl_FragColor = v_rgba;
  }
  `,

    vert: `
  precision mediump float;
  attribute vec2 a_xy;
  varying vec4 v_rgba;
  attribute vec4 a_rgba;

  void main() {
    v_rgba = a_rgba;
    gl_Position = vec4(a_xy, 0.5, 1) - 0.5;
  }
  `,

    uniforms: {
      scale: reglMinimap.prop<MinimapCellColorUniforms, 'scale'>('scale'),
    },

    count: reglMinimap.prop<MinimapCellColorProps, 'count'>('count'),
    attributes: {
      scale: reglMinimap.prop<MinimapCellColorProps, 'scale'>('scale'),
      a_xy: reglMinimap.prop<MinimapCellColorProps, 'a_xy'>('a_xy'),
      a_rgba: reglMinimap.prop<MinimapCellColorProps, 'a_rgba'>('a_rgba'),
    },

    cull: {
      enable: true,
      face: 'front'
    },
  });
}


/**
 * Renders a Globe instance
 * Contains map state:
 *     - cell groups
 *     - hovered cell
 *     - selected cell
 *     - 
 * Contains CellGroups
 */
export class MapManager {
  drawOptions$: ObservableDict<IDrawOptions>;
  renderer: GlobeRenderer;
  camera: any;
  globe: GlobeData;
  cellGroups: Map<string, ICellGroupData>;
  cellGroupLines: Record<string, any>;
  removeDrawLoop: Cancellable;
  selectedCell$: BehaviorSubject<number>;
  hoverCell$: BehaviorSubject<CellPoints>;
  minimapContext: CanvasRenderingContext2D;
  mapMode$: BehaviorSubject<EMapMode>;
  tooltipTextCache: Map<number, string>;
  minimapRenderer: REGL.DrawCommand<any, MinimapCellColorProps>;

  constructor(
    public client: WorldgenClient,
    protected screenCanvas: HTMLCanvasElement,
    protected minimapCanvas: HTMLCanvasElement,
  ) {
    // const startMapMode = localStorage.lastMapMode || DEFAULT_MAP_MODE;
    const startMapMode = DEFAULT_MAP_MODE;
    this.mapMode$ = new BehaviorSubject<EMapMode>(startMapMode);
    this.drawOptions$ = new ObservableDict({
      ...defaultDrawOptions,
      ...mapModeDrawOptions[startMapMode],
    });
    this.selectedCell$ = new BehaviorSubject(null);
    this.hoverCell$ = new BehaviorSubject(null);
    const events$: GlobeEvents = {
      cellClicked: new Subject(),
    };
    const renderer = new GlobeRenderer(screenCanvas, events$);
    this.renderer = renderer;
    this.cellGroupLines = {};

    events$.cellClicked.subscribe(cell => {
      if (this.selectedCell$.value === cell) {
        this.selectedCell$.next(null);
      } else {
        this.selectedCell$.next(cell);
      }
    })
    
    this.client.setMapMode(startMapMode).then(() => {
      this.drawMinimap();
      this.renderer.updateColors(this.globe);
    });
    
    // redraw minimap when draw option changes
    this.mapMode$.subscribe(mapMode => {
      this.onChangeMapMode(mapMode);
    });

    this.minimapRenderer = setupMinimapRenderer(minimapCanvas);

    // minimap events
    const jumpToPosition = (x: number, y: number) => {
      const { width, height } = minimapCanvas.getBoundingClientRect();
      const cx = (x / width);
      const cy = 1 - (y / height);
      this.renderer.camera.alpha = Math.PI + (Math.PI * 2 * cx);
      this.renderer.camera.beta = Math.PI * cy;
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
        console.log('draw', this.globe);
        this.drawMinimap();
        this.renderer.updateColors(this.globe);
      }
    });

    this.cellGroups = new Map();
    this.client.worker$.on('cellGroupUpdate').subscribe((data: ICellGroupData) => {
      this.drawMinimap();
      this.cellGroups.set(data.name, data);
    });
  }

  onChangeMapMode(mapMode: EMapMode) {
    // localStorage.lastMapMode = mapMode;
    this.tooltipTextCache = new Map();
    if (this.globe) {
      this.drawOptions$.replace({
        ...defaultDrawOptions,
        ...mapModeDrawOptions[mapMode],
      });

      this.client.setMapMode(mapMode)
        .then(() => {
          // TODO: re-render map and minimap
          console.log('draw', this.globe);
          this.renderer.updateColors(this.globe);
          this.drawMinimap();
        });
    }
  }

  public stopRendering() {
    this.renderer.stop();
  }

  public setGlobe(globe: GlobeData) {
    this.globe = globe;
    console.log('WorldgenClient', this.client);
    this.renderer.renderGlobe(this.globe)
    this.renderer.setupEvents()
    this.renderer.start();
    this.renderer.onDrawOptionsChanged(this.drawOptions$.value);
    this.drawMinimap();
    this.drawOptions$.subscribe(options => this.renderer.onDrawOptionsChanged(options));
    this.tooltipTextCache = new Map();
  }

  @logGroupTime('draw minimap')
  drawMinimap() {
    const { minimapGeometry, mapModeColor } = this.globe;
    // draw minimap
    this.minimapRenderer({
      scale: mat4.fromScaling(mat4.create(), [1.001, 1.001, 1.001]),
      a_xy: minimapGeometry,
      a_rgba: mapModeColor,
      count: minimapGeometry.length / 2,
    });
  }
}
