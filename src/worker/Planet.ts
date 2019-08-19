import * as THREE from 'three';
import { alea } from 'seedrandom';
import { IWorldOptions, Resources, CanvasMap } from '../types';
import { getGeoPointsSpiral, measure } from '../utils';
import { geoVoronoi } from 'd3-geo-voronoi';
import * as d3 from 'd3';
import { geoContains, xml } from 'd3';
import { clamp } from 'lodash';
import PolygonLookup from 'polygon-lookup';

console.log(PolygonLookup);

interface PlanetLayer {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;

  // added in generate()
  texture?: THREE.Texture;

  geo: THREE.SphereGeometry,
  mat: THREE.MeshBasicMaterial,
  mesh: THREE.Mesh,
}

function textureFromCanvas(canvas: HTMLCanvasElement): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(canvas as any);
  texture.needsUpdate = true;
  return texture;
}

const getEarthColorForPoint = earthImageData => ([x, y]: [number, number]) => {
  const { width, height, data } = earthImageData;
  const nx = clamp(Math.round( (x / 360) * width ), 0, width);
  let ny = clamp(Math.round( ((y + 90) / 180) * height), 0, height);
  ny = height - ny;
  const index = (nx + ny * width) * 4;
  const r = data[index];
  const g = data[index + 1];
  const b = data[index + 2];
  // const a = data[index + 3];
  return `rgba(${r}, ${g}, ${b})`;
}

export class Planet {
  layers: {
    terrain: PlanetLayer;
    ui: PlanetLayer;
  }
  sphereLayers: THREE.Group;
  rng: () => number;
  polygons: any;
  polytree: any;
  projection: d3.GeoProjection;
  path: d3.GeoPath<unknown>;

  constructor(
    public scene: THREE.Scene,
    public canvases: CanvasMap,
    public resources: Resources,
  ) {
    const terrainGeo = new THREE.SphereGeometry(10, 64, 64);
    const terrainMat = new THREE.MeshLambertMaterial({
      color: 0x333333,
      wireframe: false,
      transparent: false,
    });
    const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
    const layers: any = {};
    layers.terrain = {
      canvas: canvases.texture as any,
      ctx: canvases.texture.getContext('2d') as any,
      geo: terrainGeo,
      mat: terrainMat,
      mesh: terrainMesh
    };

    const uiGeo = new THREE.SphereGeometry(10.01, 64, 64);
    const uiMat = new THREE.MeshBasicMaterial({
      transparent: true,
    });
    const uiMesh = new THREE.Mesh(uiGeo, uiMat);
    layers.ui = {
      canvas: canvases.surface as any,
      ctx: canvases.surface.getContext('2d') as any,
      geo: uiGeo,
      mat: uiMat,
      mesh: uiMesh
    };
    this.layers = layers;
    console.log('layers', layers);
    this.sphereLayers = new THREE.Group();
    this.sphereLayers.add(terrainMesh, uiMesh);
    scene.add(this.sphereLayers);
  }

  @measure('generate')
  generate({ seed, cells }: IWorldOptions) {
    console.log(`(Generate) seed: ${seed} cells: ${cells}`);
    this.rng = alea(seed.toString());
    const points = getGeoPointsSpiral(cells, this.rng);
    let v = geoVoronoi(points);
    this.polygons = v.polygons();
    const kdPoints = this.polygons.features.map(feature => feature.properties.site);
    // const kdPoints = this.polygons.features.map(feature => d3.geoCentroid(feature));
    console.log('kdPoints', kdPoints);
    this.polytree = new PolygonLookup(this.polygons);
    console.log('polytree', this.polytree);

    const { width, height } = this.layers.terrain.canvas;
    this.projection = d3.geoEquirectangular()
    .fitSize([width, height], this.polygons);
    this.path = d3.geoPath().projection(this.projection);

    console.log('resources', this.resources);
    this.drawPolygonsOnCanvas(
      this.layers.terrain.ctx,
      getEarthColorForPoint(this.resources.earthImageData)
    );
    console.log('polygons', this.polygons);
    const terrainTexture = textureFromCanvas(this.layers.terrain.canvas);
    terrainTexture.minFilter = THREE.NearestFilter;
    this.layers.terrain.mat.map = terrainTexture;
    this.layers.terrain.mat.needsUpdate = true;
    this.layers.terrain.texture = terrainTexture;

    const uiTexture = textureFromCanvas(this.layers.ui.canvas);
    uiTexture.minFilter = THREE.NearestFilter;
    this.layers.ui.mat.map = uiTexture;
    this.layers.ui.mat.needsUpdate = true;
    this.layers.ui.texture = uiTexture;
  }

  private drawPolygonsOnCanvas(
    ctx: CanvasRenderingContext2D,
    getColor: (coords: [number, number]) => string,
  ) {
    this.polygons.features.forEach((feature, index) => {
      const d = this.path(feature.geometry);
      const p = new Path2D(d);
      // const color = d3.schemeCategory10[index % 10];
      // const color = `rgb(${rng() * 255}, ${rng() * 255}, ${rng() * 255})`;
      const color = getColor(feature.properties.site)
      ctx.fillStyle = color;
      ctx.fill(p);
      // ctx.strokeStyle = 'black';
      // ctx.stroke(p);
    });
  }

  // @measure('drawSurface')
  public drawSurface(currentHoverCell) {
    const ctx = this.layers.ui.ctx;
    ctx.clearRect(0, 0, 360 * 36, 180 * 36);

    if (currentHoverCell) {
      ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
      ctx.strokeStyle = 'rgba(255, 0, 0, 1)';
      const d = this.path(currentHoverCell.geometry);
      const p = new Path2D(d);
      ctx.stroke(p);
      ctx.fill(p);
      this.layers.ui.texture.needsUpdate = true;
      this.layers.ui.mat.needsUpdate = true;
    }
  }

  public polgonContainingPoint(point: THREE.Vector2) {
    const x = point.x;
    const y = point.y;
    const found = this.polytree.search(x, y);
    if (found) {
      return found;
    }
    // for (const cell of this.polygons.features) {
    //   if (geoContains(cell, [point.x, point.y])) {
    //     return cell;
    //   }
    // }
  }
}