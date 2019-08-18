import * as THREE from 'three';
import { Planet } from './Planet';
import { CanvasMap, Resources } from '../types';
import { clamp } from 'lodash';


export class PlanetView {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;

  screenSize: {
    width: number,
    height: number,
  };

  planet: Planet;

  lastUpdatedHoverCell: any = null;
  lastFrameID: number = null;
  currentHoverCell: any = null;

  mouse: THREE.Vector2;
  cursor: THREE.Vector2;
  raycaster: THREE.Raycaster;
  lastMove: [number, number];

  constructor(options: {
    devicePixelRatio: number,
    canvases: CanvasMap,
    resources: Resources,
    screenSize: {
      width: number,
      height: number,
    };
  }) {
    const { width, height } = options.screenSize;
    this.scene = new THREE.Scene()
    this.screenSize = options.screenSize;

    // camera
    this.camera = new THREE.PerspectiveCamera( 60, width / height, 0.5)
    this.camera.position.z = 20;
    this.renderer = new THREE.WebGLRenderer({
      antialias: false,
      alpha: true,
      canvas: (options.canvases.offscreen as any) as HTMLCanvasElement,
    });
    this.renderer.setPixelRatio(options.devicePixelRatio * 0.5);
    this.renderer.setSize(width, height, false);
    this.renderer.setClearColor( 0x000000, 0 );
    const ambientLight = new THREE.AmbientLight( 0xffffff, 5 );
    const pointLight = new THREE.PointLight( 0xffffff, 1 );
    this.scene.add(ambientLight);
    this.camera.add(pointLight);

    this.planet = new Planet(
      this.scene,
      options.canvases,
      options.resources,
    );
    
    this.mouse = new THREE.Vector2();
    this.cursor = new THREE.Vector2();
    this.raycaster = new THREE.Raycaster();
    this.lastMove = null;
  }

  render = () => {
    this.lastFrameID = requestAnimationFrame(this.render);
    if (this.currentHoverCell !== this.lastUpdatedHoverCell) {
      this.planet.drawSurface(this.currentHoverCell);
      this.lastUpdatedHoverCell = this.currentHoverCell;
    }
    this.renderer.render(this.scene, this.camera);
  }

  resizeScene(width: number, height: number) {
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.screenSize.width = width;
    this.screenSize.height = height;
    this.camera.updateProjectionMatrix();
  }

  setHoverCell(x: number, y: number) {
    this.mouse.set(( (x / this.screenSize.width) * 2 ) - 1, -((y / this.screenSize.height) * 2 ) + 1);
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.planet.sphereLayers.children);
    let selectedIntersect = intersects[0];
    if (selectedIntersect && selectedIntersect.uv) {
      var uv = selectedIntersect.uv;
      (selectedIntersect.object as any).material.map.transformUv(uv);
      this.cursor.set(
        (uv.x * 360) + 180,
        90 - (uv.y * 180),
      );
      const cell = this.planet.polgonContainingPoint(this.cursor);
      this.currentHoverCell = cell;
    } else {
      this.currentHoverCell = null;
    }
  }

  rotate(clientX: number, clientY: number, shouldReset: boolean) {
    if (shouldReset) {
      if (!this.lastMove) {
        this.lastMove = [this.screenSize.width / 2, this.screenSize.height / 2];
      }
      this.lastMove[0] = clientX;
      this.lastMove[1] = clientY;
    }

    //calculate difference between current and last mouse position
    const moveX = (clientX - this.lastMove[0]);
    const moveY = (clientY - this.lastMove[1]);
    //rotate the globe based on distance of mouse moves (x and y) 
    this.planet.sphereLayers.rotation.y += ( moveX * .005);
    this.planet.sphereLayers.rotation.x += ( moveY * .005);

    //store new position in this.lastMove
    this.lastMove[0] = clientX;
    this.lastMove[1] = clientY;
  }

  zoom(amount: number) {
    this.camera.zoom += amount;
    this.camera.zoom = clamp(this.camera.zoom, 0.1, 5);
    this.camera.updateProjectionMatrix();
  }
}