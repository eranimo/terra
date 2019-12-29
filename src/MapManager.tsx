import { mat4, vec3 } from 'gl-matrix';
import createLine from 'regl-line';
import { BehaviorSubject } from 'rxjs';
import { CellPoints, defaultDrawOptions, EMapMode, GlobeData, IDrawOptions, IGlobeOptions, mapModeDrawOptions, ICellGroupData } from './types';
import { ImageRef, logGroupTime } from './utils';
import { ObservableDict } from './utils/ObservableDict';
import { WorldgenClient } from './worldgen/WorldgenClient';
import { Cancellable } from 'regl';
import { mapModeDefs } from './mapModes';
import { Engine, Scene, MeshBuilder, HemisphericLight, Mesh, Vector3, Color3, ArcRotateCamera, StandardMaterial, VertexData, Color4, CubeTexture, Texture, Material } from '@babylonjs/core';

import "@babylonjs/core/Debug/debugLayer";
import "@babylonjs/inspector";


const DEFAULT_MAP_MODE = EMapMode.BIOME;


function createGlobeMesh(globe: GlobeData, scene: Scene) {
  const material = new StandardMaterial('globe', scene);
  const mesh = new Mesh('globe', scene);
  mesh.material = material;
  mesh.useVertexColors = true;

  const vertexData = new VertexData();

  // positions from triangle geometry
  vertexData.positions = globe.triangleGeometry;
  const indices = [];

  // compute colors
  const colors = [];
  let indiciesCount = 0;
  for (let t = 0; t < globe.triangleGeometry.length / 3; t++) {
    indices.push(t);
    colors.push(
      globe.mapModeColor[(4 * t) + 0],
      globe.mapModeColor[(4 * t) + 1],
      globe.mapModeColor[(4 * t) + 2],
      globe.mapModeColor[(4 * t) + 3],
    );
  }
  vertexData.indices = indices;
  vertexData.colors = colors;

  // compute normals
  var normals = [];
  VertexData.ComputeNormals(vertexData.positions, indices, normals);
  vertexData.normals = normals;

  vertexData.applyToMesh(mesh);

  console.log('vertexData', vertexData);
  mesh.scaling = new Vector3(20, 20, 20);

  // disable lighting
  material.emissiveColor = new Color3(1, 1, 1);
  material.disableLighting = true;
  return { mesh, vertexData };
}

function createCellBorderMesh(globe: GlobeData, scene: Scene) {
  const points: Vector3[][] = [];

  for (let r = 0; r < globe.cellBorders.length; r++) {
    globe.cellBorders[r].forEach(side => {
      const regionLines = [];
      side.forEach(point => {
        regionLines.push(new Vector3(point[0], point[1], point[2]));
      });
      points.push(regionLines);
    });
  }
  const borders = MeshBuilder.CreateLineSystem('border', {
    lines: points,
  }, scene);
  borders.color = new Color3(0, 0, 0);
  borders.alpha = 0.5;
  borders.scaling = new Vector3(20.002, 20.002, 20.002);
  return borders;
}

function createRivers(globe: GlobeData, scene: Scene) {
  const material = new StandardMaterial('rivers', scene);
  const mesh = new Mesh('rivers', scene);
  material.specularColor = new Color3(1, 1, 1);
  mesh.material = material;
  mesh.scaling = new Vector3(20.001, 20.001, 20.001);
  const vertexData = new VertexData();
  const indices = [];
  let colors = [];
  for (let i = 0; i < globe.rivers.length / 3; i++) {
    indices.push(i);
    colors.push(0, 0, 1, 1);
  }
  vertexData.positions = globe.rivers;
  vertexData.indices = indices;
  vertexData.colors = colors;
  var normals = [];
  VertexData.ComputeNormals(vertexData.positions, indices, normals);
  vertexData.normals = normals;
  vertexData.applyToMesh(mesh);
  return mesh;
}

function createSkybox(scene: Scene) {
  const skybox = MeshBuilder.CreateBox("skyBox", {size:1000.0}, scene);
  const skyboxMaterial = new StandardMaterial("skyBox", scene);
  skyboxMaterial.backFaceCulling = false;
  skyboxMaterial.reflectionTexture = CubeTexture.CreateFromImages([
    require('./images/skybox_px.png'),
    require('./images/skybox_py.png'),
    require('./images/skybox_pz.png'),
    require('./images/skybox_nx.png'),
    require('./images/skybox_ny.png'),
    require('./images/skybox_nz.png'),
  ], scene);
  skyboxMaterial.reflectionTexture.coordinatesMode = Texture.SKYBOX_MODE;
  skyboxMaterial.diffuseColor = new Color3(0, 0, 0);
  skyboxMaterial.specularColor = new Color3(0, 0, 0);
  skybox.material = skyboxMaterial;
  return skybox;
}

class GlobeRenderer {
  private engine: Engine;
  private scene: Scene;
  private sunLight: HemisphericLight;
  private planet: Mesh;
  private borders: Mesh;
  private camera: ArcRotateCamera;
  private rivers: Mesh;
  public globe: GlobeData;
  private hasRendered: boolean;
  skybox: Mesh;
  planetData: VertexData;

  constructor(canvas: HTMLCanvasElement) {
    this.engine = new Engine(canvas);
    this.scene = new Scene(this.engine);
    this.hasRendered = false;

    // enable debug layer
    this.scene.debugLayer.show();
    this.scene.clearColor = new Color4(0.5, 0.5, 0.5, 1.0);

    const camera = new ArcRotateCamera(
      "camera1",
      0,
      0,
      0,
      new Vector3(0, 0, -0),
      this.scene,
    );
    camera.setPosition(new Vector3(-60, 0, 0));
    camera.attachControl(canvas, true);
    this.camera = camera;

    // debug lighting
    const sun = new HemisphericLight('sun', new Vector3(0, 0, 1), this.scene);
    sun.diffuse = new Color3(1, 1, 1);
    sun.specular = new Color3(1, 1, 1);
    sun.groundColor = new Color3(1, 1, 1);
    sun.intensity = 1;
    this.sunLight = sun;
  }

  public start() {
    this.engine.runRenderLoop(() => {
      this.scene.render();
    });
  }

  public stop() {
    this.engine.stopRenderLoop();
  }

  public renderGlobe(globe: GlobeData) {
    this.globe = globe;

    const { mesh, vertexData } = createGlobeMesh(globe, this.scene);
    this.planet = mesh;
    this.planetData = vertexData;
    this.borders = createCellBorderMesh(globe, this.scene);
    this.rivers = createRivers(globe, this.scene);
    this.skybox = createSkybox(this.scene);
    this.hasRendered = true;
  }

  public onDrawOptionsChanged(options: IDrawOptions) {
    if (!this.hasRendered) return;
    this.planet.setEnabled(options.renderPlanet);
    this.borders.setEnabled(options.drawGrid);
    this.rivers.setEnabled(options.drawRivers);
  }

  public updateColors(globe: GlobeData) {
    const colors = [];
    for (let t = 0; t < globe.triangleGeometry.length / 3; t++) {
      colors.push(
        globe.mapModeColor[(4 * t) + 0],
        globe.mapModeColor[(4 * t) + 1],
        globe.mapModeColor[(4 * t) + 2],
        globe.mapModeColor[(4 * t) + 3],
      );
    }
    this.planetData.colors = colors;
    this.planet.material.markAsDirty(Material.AllDirtyFlag);
  }
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
  selectedCell$: BehaviorSubject<CellPoints>;
  hoverCell$: BehaviorSubject<CellPoints>;
  minimapContext: CanvasRenderingContext2D;
  mapMode$: BehaviorSubject<EMapMode>;
  tooltipTextCache: Map<number, string>;

  constructor(
    public client: WorldgenClient,
    protected screenCanvas: HTMLCanvasElement,
    protected minimapCanvas: HTMLCanvasElement,
  ) {
    const startMapMode = localStorage.lastMapMode || DEFAULT_MAP_MODE;
    this.mapMode$ = new BehaviorSubject<EMapMode>(startMapMode);
    this.drawOptions$ = new ObservableDict({
      ...defaultDrawOptions,
      ...mapModeDrawOptions[startMapMode],
    });
    this.selectedCell$ = new BehaviorSubject(null);
    this.hoverCell$ = new BehaviorSubject(null);
    const renderer = new GlobeRenderer(screenCanvas);
    this.renderer = renderer;
    this.cellGroupLines = {};
    
    this.client.setMapMode(startMapMode).then(() => {
      // TODO: re-render map and minimap
    });
    
    // redraw minimap when draw option changes
    this.mapMode$.subscribe(mapMode => {
      this.onChangeMapMode(mapMode);
    });

    // minimap events
    const jumpToPosition = (x: number, y: number) => {
      const { width, height } = minimapCanvas.getBoundingClientRect();
      const cx = (x / width) - 0.5;
      const cy = (y / height) - 0.5;
      const lat = cx * 360;
      const long = cy * 180;
      // TODO: implement jump to lat long
      // this.renderer.camera.centerLatLong(lat, long);
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
        // TODO: re-render map and minimap
        console.log('draw', this.globe);
        this.renderer.updateColors(this.globe);
      }
    });

    this.cellGroups = new Map();
    this.client.worker$.on('cellGroupUpdate').subscribe((data: ICellGroupData) => {
      // TODO: re-render map and minimap
      this.cellGroups.set(data.name, data);
    });
  }

  onChangeMapMode(mapMode: EMapMode) {
    localStorage.lastMapMode = mapMode;
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
    this.renderer.start();
    this.renderer.onDrawOptionsChanged(this.drawOptions$.value);
    this.drawOptions$.subscribe(options => this.renderer.onDrawOptionsChanged(options));
    this.tooltipTextCache = new Map();
  }

  /*
  private draw() {
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
    if (this.selectedCell$.value) {
      this.renderer.drawCellBorder(this.selectedCell$.value.points);
    }
    if (this.drawOptions$.get('regions')) {
      for (const cellGroup of this.cellGroups.values()) {
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
  private drawMinimap() {
    const { minimapGeometry, mapModeColor } = this.globe;
    // draw minimap
    this.renderer.renderMinimapCellColor({
      scale: mat4.fromScaling(mat4.create(), [1.001, 1.001, 1.001]),
      a_xy: minimapGeometry,
      a_rgba: mapModeColor,
      count: minimapGeometry.length / 2,
    });
  }

  */
}
