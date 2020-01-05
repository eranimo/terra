import { GlobeData, IDrawOptions } from './types';
import { logFuncTime } from './utils';
import { Engine, Scene, MeshBuilder, HemisphericLight, Mesh, Vector3, Color3, ArcRotateCamera, StandardMaterial, VertexData, Color4, CubeTexture, Texture, VertexBuffer, SolidParticleSystem, SolidParticle, Quaternion, Ray, Material } from '@babylonjs/core';


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
  return borders;
}

const RIVER_COLOR = new Color3(0, 0, 1);

function createRivers(globe: GlobeData, scene: Scene) {
  const riverMesh = new Mesh('rivers', scene);
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
  return particleMesh;
}

export class GlobeRenderer {
  public globe: GlobeData;
  private engine: Engine;
  private scene: Scene;
  private sunLight: HemisphericLight;
  private planet: Mesh;
  private borders: Mesh;
  public camera: ArcRotateCamera;
  private rivers: Mesh;
  private skybox: Mesh;
  private hasRendered: boolean;
  plateVectors: Mesh;

  constructor(canvas: HTMLCanvasElement) {
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
    this.borders = createCellBorderMesh(globe, this.scene);
    this.rivers = logFuncTime('render rivers', () => createRivers(globe, this.scene));
    this.skybox = createSkybox(this.scene);
    this.plateVectors = logFuncTime('render plate arrows', () => createPlateVectors(globe, this.engine, this.scene));
    this.hasRendered = true;
  }

  public onDrawOptionsChanged(options: IDrawOptions) {
    if (!this.hasRendered) return;
    this.planet.setEnabled(options.renderPlanet);
    this.borders.setEnabled(options.drawGrid);
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
