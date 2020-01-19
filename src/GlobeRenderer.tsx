import { GlobeData, IDrawOptions, ICellGroupData } from './types';
import { logFuncTime, logGroupTime } from './utils';
import { Engine, Scene, MeshBuilder, HemisphericLight, Mesh, Vector3, Color3, ArcRotateCamera, StandardMaterial, VertexData, Color4, CubeTexture, Texture, VertexBuffer, SolidParticleSystem, SolidParticle, Quaternion, Ray, Material, ActionManager, ExecuteCodeAction, SubMesh, LinesMesh, EdgesRenderer, DynamicTexture } from '@babylonjs/core';
import { Subject } from 'rxjs';


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
    colors.push(globe.mapModeColor[(4 * t) + 0], globe.mapModeColor[(4 * t) + 1], globe.mapModeColor[(4 * t) + 2], globe.mapModeColor[(4 * t) + 3]);
  }

  console.log('num faces', globe.triangleGeometry.length / 3 / 3);
  vertexData.indices = indices;
  vertexData.colors = colors;
  // compute normals
  var normals = [];
  VertexData.ComputeNormals(vertexData.positions, indices, normals);
  vertexData.normals = normals;
  vertexData.applyToMesh(mesh);
  mesh.convertToFlatShadedMesh();
  console.log('vertexData', vertexData);
  mesh.scaling = new Vector3(20, 20, 20);
  // disable lighting
  material.emissiveColor = new Color3(1, 1, 1);
  material.disableLighting = true;
  return mesh;
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
  borders.isPickable = false;
  return borders;
}


function createCoastlineMesh(globe: GlobeData, scene: Scene) {
  const points: Vector3[][] = globe.coastline.map(points => (
    points.map(p => Vector3.FromArray(p))
  ));
  const borders = MeshBuilder.CreateLineSystem('coastline', {
    lines: points,
  }, scene);
  borders.color = new Color3(0, 0, 0);
  borders.enableEdgesRendering();
  borders.edgesWidth = 1;
  borders.edgesColor = new Color4(0, 0, 0, 1);
  borders.alpha = 1;
  borders.scaling = new Vector3(20.002, 20.002, 20.002);
  borders.isPickable = false;
  return borders;
}

const RIVER_COLOR = new Color3(0, 0, 1);

function createRivers(globe: GlobeData, scene: Scene) {
  const riverMesh = new Mesh('rivers', scene);
  riverMesh.isPickable = false;
  var riverMaterial = new StandardMaterial('river', scene);
  riverMaterial.diffuseColor = RIVER_COLOR;
  riverMaterial.emissiveColor = RIVER_COLOR;
  riverMaterial.specularColor = RIVER_COLOR;
  riverMaterial.disableLighting = true;
  riverMesh.material = riverMaterial;

  const pointsWidthMap: Map<number, Vector3[][]> = new Map();

  globe.rivers.forEach((river, index) => {
    for (let p = 0; p < river.points.length - 1; p++) {
      const thisPoint = Vector3.FromArray(river.points[p]);
      const nextPoint = Vector3.FromArray(river.points[p + 1]);
      const width = Math.floor(river.widths[p] + river.widths[p + 1] / 2);
      if (!pointsWidthMap.has(width)) {
        pointsWidthMap.set(width, []);
      }
      pointsWidthMap.get(width).push([ thisPoint, nextPoint ]);
    }
  });

  for (const [width, points] of pointsWidthMap) {
    const riverSegments = MeshBuilder.CreateLineSystem(`rivers-${width}`, {
      lines: points,
    }, scene);
    riverSegments.enableEdgesRendering();
    riverSegments.color = RIVER_COLOR;
    riverSegments.edgesWidth = width;
    riverSegments.edgesColor = RIVER_COLOR.toColor4(1);
    riverSegments.scaling = new Vector3(20.001, 20.001, 20.001);
    riverSegments.material = riverMaterial;
    riverSegments.isPickable = false;
    riverMesh.addChild(riverSegments);
  }

  return riverMesh;
}

function createSkybox(scene: Scene) {
  const skybox = MeshBuilder.CreateBox("skyBox", { size: 1000.0 }, scene);
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

function createPlateVectors(globe: GlobeData, engine: Engine, scene: Scene) {
  const arrowMesh = MeshBuilder.CreateCylinder('arrowMesh', {
    diameterTop: 0,
    height: 1.5,
    tessellation: 4
  }, scene);

  var arrowMaterial = new StandardMaterial('arrowMaterial', scene);
  arrowMesh.alwaysSelectAsActiveMesh = true;
  arrowMesh.isVisible = false;

  const arrowSystem = new SolidParticleSystem('arrowSystem', scene, {
    updatable: false,
    isPickable: false,
  });

  const arrows = globe.plateVectors;
  arrowSystem.addShape(arrowMesh, arrows.length, {
    positionFunction: (particle: SolidParticle, i, s) => {
      const arrow = arrows[s];
      particle.position.set(arrow.position[0] * 20.05, arrow.position[1] * 20.05, arrow.position[2] * 20.01);
      const ray = Ray.CreateNewFromTo(Vector3.Zero(), particle.position);
      const axis = Vector3.Cross(Vector3.Up(), ray.direction).normalize();
      const axis2 = Vector3.Cross(axis, Vector3.FromArray(arrow.rotation)).normalize();
      const angle = Math.acos(Vector3.Dot(axis2, ray.direction));
      particle.rotationQuaternion = Quaternion.RotationAxis(axis2, angle);
      particle.scaling.set(0.05, 0.05, 0.05);
      particle.color = new Color4(arrow.color[0], arrow.color[1], arrow.color[2], arrow.color[3]);
    }
  });
  arrowMesh.dispose();
  const particleMesh = arrowSystem.buildMesh();
  particleMesh.material = arrowMaterial;
  particleMesh.hasVertexAlpha = true;
  particleMesh.isPickable = false;
  return particleMesh;
}

const selectedCellBorderColor = new Color4(0, 0, 0, 1);

export type GlobeEvents = {
  cellClicked: Subject<number>,
}

export type GlobeLabel = {
  cellGroup: ICellGroupData;
  position: Vector3;
  color: Color4,
}

export class GlobeRenderer {
  public globe: GlobeData;
  private engine: Engine;
  private scene: Scene;
  private sunLight: HemisphericLight;
  public planet: Mesh;
  private borders: Mesh;
  public camera: ArcRotateCamera;
  private rivers: Mesh;
  private skybox: Mesh;
  private hasRendered: boolean;
  plateVectors: Mesh;
  private events$: GlobeEvents;
  private selectedCellBorder: LinesMesh;
  coastline: LinesMesh;
  labels: GlobeLabel[];
  cellGroupOverlays: Map<number, Mesh>;
  cellGroupLabels: Map<number, Mesh>;

  constructor(
    canvas: HTMLCanvasElement,
    events$: GlobeEvents
  ) {
    this.events$ = events$;
    this.engine = new Engine(canvas);
    this.scene = new Scene(this.engine);
    this.hasRendered = false;
    // enable debug layer
    (window as any).debugLayer = this.scene.debugLayer;
    this.scene.clearColor = new Color4(0.5, 0.5, 0.5, 1.0);

    const camera = new ArcRotateCamera("camera1", 0, 0, 0, new Vector3(0, 0, -0), this.scene);
    camera.inertia = 0.5;
    camera.panningSensibility = 100;
    camera.setPosition(new Vector3(-60, 0, 0));
    camera.attachControl(canvas, true);
    camera.lowerRadiusLimit = 22;
    camera.upperRadiusLimit = 60;
    this.camera = camera;

    // debug lighting
    const sun = new HemisphericLight('sun', new Vector3(0, 0, 1), this.scene);
    sun.diffuse = new Color3(1, 1, 1);
    sun.specular = new Color3(1, 1, 1);
    sun.groundColor = new Color3(1, 1, 1);
    sun.intensity = 1;
    this.sunLight = sun;

    this.cellGroupOverlays = new Map();
    this.cellGroupLabels = new Map();
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
    this.planet = createGlobeMesh(globe, this.scene);
    this.planet.actionManager = new ActionManager(this.scene);
    this.planet.updateFacetData();

    this.borders = createCellBorderMesh(globe, this.scene);
    this.coastline = createCoastlineMesh(globe, this.scene);
    this.rivers = logFuncTime('render rivers', () => createRivers(globe, this.scene));
    this.skybox = createSkybox(this.scene);
    this.plateVectors = logFuncTime('render plate arrows', () => createPlateVectors(globe, this.engine, this.scene));
    this.hasRendered = true;
  }

  @logGroupTime('add cell group')
  addCellGroupOverlay(data: ICellGroupData) {
    let overlayMesh: Mesh;
    if (this.cellGroupOverlays.has(data.id)) {
      overlayMesh = this.cellGroupOverlays.get(data.id);
    } else {
      const name = `cellGroup-${data.name}`;
      overlayMesh = new Mesh(name, this.scene);
      this.cellGroupOverlays.set(data.id, overlayMesh);
      overlayMesh.scaling = new Vector3(20, 20, 20);
    }

    const positions = new Float32Array(data.sides.length * 9);
    for (let s = 0; s < data.sides.length; s++) {
      const side = data.sides[s];
      const face = this.globe.triangleGeometry.slice(side * 9, side * 9 + 9);
      positions.set(face, s * 9);
    }
    const indices = [];
    for (let t = 0; t < positions.length / 3; t++) {
      indices.push(t);
    }
    console.log('position', positions);
    const vertexData = new VertexData();
    vertexData.positions = positions;
    vertexData.indices = indices;
    const normals = [];
    VertexData.ComputeNormals(vertexData.positions, indices, normals);
    vertexData.normals = normals;
    vertexData.applyToMesh(overlayMesh);

    const overlayMaterial = new StandardMaterial(name, this.scene);
    overlayMaterial.diffuseColor = Color3.FromArray(data.color);
    overlayMaterial.emissiveColor = Color3.FromArray(data.color);
    overlayMaterial.specularColor = Color3.FromArray(data.color);
    overlayMaterial.disableLighting = true;

    overlayMesh.material = overlayMaterial;
    overlayMesh.isPickable = false;
  }

  @logGroupTime('add label')
  addCellGroupLabel(label: GlobeLabel) {
    const { name, id } = label.cellGroup;

    // remove old label if updating
    if (this.cellGroupLabels.has(id)) {
      this.cellGroupLabels.get(id).dispose();
    }
    console.log('added label', label);
    const width = name.length;
    const height = 1;
    const plane = MeshBuilder.CreatePlane('plane', {
      width,
      height,
    }, this.scene);
    plane.position = label.position.scaleInPlace(20.05);
    plane.lookAt(Vector3.Zero());

    const dynamicTexture = new DynamicTexture(`label-texture-${id}`, {
      width: width * 200,
      height: height * 200,
    }, this.scene, false);
    dynamicTexture.hasAlpha = true;
    
    const font_type = "Arial";

    // Check width of text for given font type at any size of font
    const ctx = dynamicTexture.getContext();
    const size = 2; // any value will work
    ctx.font = size + "px " + font_type;
    const textWidth = ctx.measureText(name).width;

    // Calculate ratio of text width to size of font used
    const ratio = textWidth/size;

    // set font to be actually used to write text on dynamic texture
    const font_size = Math.floor((width * 20) / (ratio * 1)); // size of multiplier (1) can be adjusted, increase for smaller text
    const font = font_size + "px " + font_type;

    // Draw text
    dynamicTexture.drawText(name, null, null, font, "#FFF", null, true);

    // create material
    const mat = new StandardMaterial("mat", this.scene);
    mat.diffuseTexture = dynamicTexture;

    // apply material
    plane.material = mat;
    plane.isPickable = false;

    this.cellGroupLabels.set(id, plane);
    return plane;
  }

  public setupEvents() {
    let lastAlpha = null;
    let lastBeta = null;
    this.planet.actionManager.registerAction(new ExecuteCodeAction(
      {
        trigger: ActionManager.OnPickDownTrigger,
      },
      event => {
        lastAlpha = this.camera.alpha;
        lastBeta = this.camera.beta;
      }
    ));
    this.planet.actionManager.registerAction(new ExecuteCodeAction(
      {
        trigger: ActionManager.OnPickUpTrigger,
      },
      (event) => {
        if (lastAlpha !== this.camera.alpha || lastBeta !== this.camera.beta) {
          return;
        }
        const pickResult = this.scene.pick(event.pointerX, event.pointerY,
          mesh => mesh == this.planet,
          false,
          this.camera,
        );
        const cell = this.globe.sideToCell[pickResult.faceId];
        console.log('clicked on ', cell)
        this.events$.cellClicked.next(cell);
      }
    ));

    // this.scene.registerBeforeRender(() => {
      // const pickResult = this.scene.pick(this.scene.pointerX, this.scene.pointerY,
      //   mesh => mesh == this.planet,
      //   false,
      //   this.camera,
      // );

    //   if (pickResult.hit) {
    //     const result = pickResult.pickedMesh.getFacetPosition(pickResult.faceId);
    //     console.log(pickResult);
    //     console.log('cell', this.globe.sideToCell[pickResult.faceId])
    //   }
    // });
  }

  public setSelectedCellBorder(cell: number) {
    if (this.selectedCellBorder) {
      this.selectedCellBorder.dispose();
    }
    if (cell === null) { 
      return;
    }
    const selectedCellBorderPoints = this.globe.cellBorders[cell];
    this.selectedCellBorder = MeshBuilder.CreateLineSystem('selectedCellBorder', {
      lines: selectedCellBorderPoints.map(points => (
        points.map(p => Vector3.FromArray(p)
      ))),
    }, this.scene);
    this.selectedCellBorder.color = new Color3(0, 0, 0);
    this.selectedCellBorder.alpha = 0.5;
    this.selectedCellBorder.scaling = new Vector3(20.002, 20.002, 20.002);
    this.selectedCellBorder.isPickable = false;
    this.selectedCellBorder.enableEdgesRendering();
    this.selectedCellBorder.edgesWidth = 2;
    this.selectedCellBorder.edgesColor = selectedCellBorderColor
  }

  public onDrawOptionsChanged(options: IDrawOptions) {
    if (!this.hasRendered) return;
    this.planet.setEnabled(options.renderPlanet);
    this.borders.setEnabled(options.drawGrid);
    this.coastline.setEnabled(options.drawCoastlineBorder);
    this.rivers.setEnabled(options.drawRivers);
    this.plateVectors.setEnabled(options.drawPlateVectors);
  }

  public updateColors(globe: GlobeData) {
    console.log('update colors');
    const colors = [];
    for (let t = 0; t < globe.triangleGeometry.length / 3; t++) {
      colors.push(globe.mapModeColor[(4 * t) + 0], globe.mapModeColor[(4 * t) + 1], globe.mapModeColor[(4 * t) + 2], globe.mapModeColor[(4 * t) + 3]);
    }
    this.planet.setVerticesData(VertexBuffer.ColorKind, colors);
  }
}
