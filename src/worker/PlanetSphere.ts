import { CanvasMap, Resources } from "src/types";
import * as THREE from 'three';
import { Planet, RADIUS } from './Planet';
import { geoCentroid } from "d3";
import { flatten } from 'lodash';
import { measure } from "../utils";


export class PlanetSphere {
  public sphereLayers: THREE.Group;

  constructor(
    public planet: Planet,
    public scene: THREE.Scene,
    public canvases: CanvasMap,
    public resources: Resources,
  ) {
    
    this.sphereLayers = new THREE.Group();
    scene.add(this.sphereLayers);
  }

  @measure('draw')
  public draw() {
    const geometry = new THREE.BufferGeometry();
    let vertices: number[] = [];
    let i = 0;
    this.planet.triangles.features.forEach((triangle, index: number) => {
      i += index * (4 * 3);
      const coords = triangle.geometry.coordinates[0];
      coords.forEach(([lat, lon], ci: number) => {
        const x = RADIUS * Math.cos(lat) * Math.cos(lon);
        const y = RADIUS * Math.cos(lat) * Math.sin(lon);
        const z = RADIUS * Math.sin(lat);
        vertices.push(x);
        vertices.push(y);
        vertices.push(z);
      });
    });
    const verticesArray = new Float32Array(vertices);
    console.log('vertices', vertices);

    // itemSize = 3 because there are 3 values (components) per vertex
    geometry.addAttribute('position', new THREE.BufferAttribute(verticesArray, 3));
    const material = new THREE.MeshPhongMaterial({
      color: 0xff0000,
      side: THREE.FrontSide,
      wireframe: true,
    });
    const mesh = new THREE.Mesh( geometry, material );
    this.sphereLayers.add(mesh);
  }
  
  public drawSurface(currentHoverCell) {

  }

  public polgonContainingPoint(point: THREE.Vector2) {

  }
}