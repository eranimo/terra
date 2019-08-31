import { makeSphere } from "./SphereMesh";
import { makeRandFloat, makeRandInt } from '@redblobgames/prng';
import TriangleMesh from '@redblobgames/dual-mesh';
import { QuadGeometry, generateTriangleCenters, generateVoronoiGeometry } from './geometry';
import { generatePlates, assignRegionElevation } from './plates';
import { assignTriangleValues, assignDownflow, assignFlow } from './rivers';
import { IGlobeOptions } from './types';


let SEED = 123;
let N = 10000;
let jitter = 0.75;

export class Globe {
  mesh: TriangleMesh;
  r_xyz: number[];
  triangleGeometry: any;
  quadGeometry: QuadGeometry;

  t_xyz: number[];
  r_elevation: Float32Array;
  t_elevation: Float32Array;
  r_moisture: Float32Array;
  t_moisture: Float32Array;
  t_downflow_s: Int32Array;
  order_t: Int32Array;
  t_flow: Float32Array;
  s_flow: Float32Array;

  plate_r: Set<number>;
  r_plate: Int32Array;
  plate_vec: any[];
  plate_is_ocean: Set<unknown>;

  constructor(options: IGlobeOptions) {
    console.log('options', options)
    const { mesh, r_xyz } = makeSphere(options.numberCells, jitter, makeRandFloat(options.seed));
    this.mesh = mesh;
    console.log('mesh', mesh)
    this.r_xyz = r_xyz;
    this.quadGeometry = new QuadGeometry();
    this.quadGeometry.setMesh(mesh);

    this.t_xyz = generateTriangleCenters(mesh, this);
    this.r_elevation = new Float32Array(mesh.numRegions);
    this.t_elevation = new Float32Array(mesh.numTriangles);
    this.r_moisture = new Float32Array(mesh.numRegions);
    this.t_moisture = new Float32Array(mesh.numTriangles);
    this.t_downflow_s = new Int32Array(mesh.numTriangles);
    this.order_t = new Int32Array(mesh.numTriangles);
    this.t_flow = new Float32Array(mesh.numTriangles);
    this.s_flow = new Float32Array(mesh.numSides);

    this.generateMap();
    this.setupGeometry();
  }

  generateMap() {
    let result = generatePlates(this.mesh, this.r_xyz);
    this.plate_r = result.plate_r;
    this.r_plate = result.r_plate;
    this.plate_vec = result.plate_vec;
    this.plate_is_ocean = new Set();
    for (let r of this.plate_r) {
      if (makeRandInt(r)(10) < 5) {
        this.plate_is_ocean.add(r);
        // TODO: either make tiny plates non-ocean, or make sure tiny plates don't create seeds for rivers
      }
    }
    assignRegionElevation(this.mesh, this);
    // TODO: assign region moisture in a better way!
    for (let r = 0; r < this.mesh.numRegions; r++) {
      this.r_moisture[r] = (this.r_plate[r] % 10) / 10.0;
    }
    assignTriangleValues(this.mesh, this);
    assignDownflow(this.mesh, this);
    assignFlow(this.mesh, this);

    this.quadGeometry.setMap(this.mesh, this);
    console.log('map', this);
  }

  setupGeometry() {
    const r_color_fn = (r: number) => {
      let m = this.r_moisture[r];
      let e = this.r_elevation[r];
      return [e, m];
    }

    this.triangleGeometry = generateVoronoiGeometry(this.mesh, this, r_color_fn);
  }
}