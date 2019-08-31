import * as THREE from 'three';
import { alea } from 'seedrandom';
import { IWorldOptions, Resources, CanvasMap, Size } from '../types';
import { getGeoPointsSpiral, measure } from '../utils';
import { geoVoronoi } from 'd3-geo-voronoi';
import * as d3 from 'd3';
import { geoContains, xml } from 'd3';
import { clamp } from 'lodash';
import PolygonLookup from 'polygon-lookup';
import { Feature } from 'geojson';


export const RADIUS = 10;

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
  rng: () => number;
  polygons: any;
  triangles: any;
  polygonLookup: any;
  projection: d3.GeoProjection;
  path: d3.GeoPath<unknown>;
  size: Size;
  numCells: number;

  constructor(size: Size) {
    this.size = size;
  }

  @measure('generate')
  generate({ seed, cells }: IWorldOptions) {
    // console.log(`(Generate) seed: ${seed} cells: ${cells}`
    this.rng = alea(seed.toString());
    const points = getGeoPointsSpiral(cells, this.rng);
    let v = geoVoronoi(points);
    this.polygons = v.polygons();
    this.triangles = v.triangles();
    this.numCells = this.polygons.features.length;
    this.polygonLookup = new PolygonLookup(this.polygons);
    console.log('polygons', this.polygons);
    console.log('triangles', this.triangles);

    const { width, height } = this.size;
    this.projection = d3.geoEquirectangular()
    .fitSize([width, height], this.polygons);
    this.path = d3.geoPath().projection(this.projection);
    console.log('generate');
  }

  public cellContains(cell: Feature, point: THREE.Vector2) {
    return geoContains(cell, [point.x, point.y]);
  }

  getCellPoints(cell: Feature<any>) {
    const points: [number, number, number][] = [];
    for (const point of cell.geometry.coordinates) {
      const [lat, lon] = point;
      const x = RADIUS * Math.cos(lat) * Math.cos(lon)
      const y = RADIUS * Math.cos(lat) * Math.sin(lon)
      const z = RADIUS * Math.sin(lat)
      points.push([x, y, z]);
    }
    return points;
  }
}