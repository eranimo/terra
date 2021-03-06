import mouseChange from 'mouse-change';
import mouseWheel from 'mouse-wheel';
// import identity from 'gl-mat4/identity';
// import perspective from 'gl-mat4/perspective';
// import lookAt from 'gl-mat4/lookAt';
import { mat4 } from 'gl-matrix';
import { Regl } from 'regl';


var isBrowser = typeof window !== 'undefined';

export default function createCamera(regl: Regl, props: any = {}) {
  // Preserve backward-compatibilty while renaming preventDefault -> noScroll
  if (typeof props.noScroll === 'undefined') {
    props.noScroll = props.preventDefault;
  }

  var cameraState = {
    view: mat4.identity(new Float32Array(16) as any),
    projection: mat4.identity(new Float32Array(16) as any),
    center: new Float32Array(props.center || 3),
    theta: props.theta || 0,
    phi: props.phi || 0,
    distance: Math.log(props.distance || 10.0),
    eye: new Float32Array(3),
    up: new Float32Array(props.up || [0, 1, 0]),
    fovy: props.fovy || Math.PI / 4.0,
    near: typeof props.near !== 'undefined' ? props.near : 0.01,
    far: typeof props.far !== 'undefined' ? props.far : 1000.0,
    noScroll: typeof props.noScroll !== 'undefined' ? props.noScroll : false,
    flipY: !!props.flipY,
    dtheta: 0,
    dphi: 0,
    rotationSpeed: typeof props.rotationSpeed !== 'undefined' ? props.rotationSpeed : 1,
    zoomSpeed: typeof props.zoomSpeed !== 'undefined' ? props.zoomSpeed : 1,
    renderOnDirty: typeof props.renderOnDirty !== undefined ? !!props.renderOnDirty : false,
    dirty: false,
  }

  var element = props.element
  var damping = typeof props.damping !== 'undefined' ? props.damping : 0.9

  var right = new Float32Array([1, 0, 0])
  var front = new Float32Array([0, 0, 1])

  var minDistance = Math.log('minDistance' in props ? props.minDistance : 0.1)
  var maxDistance = Math.log('maxDistance' in props ? props.maxDistance : 1000)

  var ddistance = 0

  var prevX = 0
  var prevY = 0

  if (isBrowser && props.mouse !== false) {
    var source = element || regl._gl.canvas

    function getWidth() {
      return element ? element.offsetWidth : window.innerWidth
    }

    function getHeight() {
      return element ? element.offsetHeight : window.innerHeight
    }

    mouseChange(source, function (buttons, x, y) {
      if (buttons & 1) {
        var dx = (x - prevX) / getWidth()
        var dy = (y - prevY) / getHeight()

        cameraState.dtheta += cameraState.rotationSpeed * 4.0 * dx
        cameraState.dphi += cameraState.rotationSpeed * 4.0 * dy
        cameraState.dirty = true;
      }
      prevX = x
      prevY = y
    })

    mouseWheel(source, function (dx: number, dy: number) {
      ddistance += dy / getHeight() * cameraState.zoomSpeed
      cameraState.dirty = true;
    }, props.noScroll)
  }

  function damp(x) {
    var xd = x * damping
    if (Math.abs(xd) < 0.1) {
      return 0
    }
    cameraState.dirty = true;
    return xd
  }

  function clamp(x: number, lo: number, hi: number): number {
    return Math.min(Math.max(x, lo), hi)
  }

  function updateCamera(props) {
    Object.keys(props).forEach(function (prop) {
      cameraState[prop] = props[prop]
    })

    const center = cameraState.center;
    const eye = cameraState.eye;
    const up = cameraState.up;
    const dtheta = cameraState.dtheta;
    const dphi = cameraState.dphi;

    cameraState.theta += dtheta
    cameraState.phi = clamp(
      cameraState.phi + dphi,
      -Math.PI / 2.0,
      Math.PI / 2.0
    );
    cameraState.distance = clamp(
      cameraState.distance + ddistance,
      minDistance,
      maxDistance,
    );

    cameraState.dtheta = damp(dtheta)
    cameraState.dphi = damp(dphi)
    ddistance = damp(ddistance)

    const theta = cameraState.theta
    const phi = cameraState.phi
    const r = Math.exp(cameraState.distance)

    const vf = r * Math.sin(theta) * Math.cos(phi)
    const vr = r * Math.cos(theta) * Math.cos(phi)
    const vu = r * Math.sin(phi)

    for (let i = 0; i < 3; ++i) {
      eye[i] = center[i] + vf * front[i] + vr * right[i] + vu * up[i]
    }

    mat4.lookAt(cameraState.view, eye as any, center as any, up as any)
  }

  cameraState.dirty = true;

  var injectContext = regl({
    context: Object.assign({}, cameraState, {
      dirty: function () {
        return cameraState.dirty;
      },
      projection: function (context) {
        mat4.perspective(
          cameraState.projection,
          cameraState.fovy,
          context.viewportWidth / context.viewportHeight,
          cameraState.near,
          cameraState.far
        )
        if (cameraState.flipY) { cameraState.projection[5] *= -1 }
        return cameraState.projection
      }
    }),
    uniforms: Object.keys(cameraState).reduce(function (uniforms, name) {
      uniforms[name] = regl.context(name as any)
      return uniforms
    }, {})
  })

  function setupCamera(props?, block?) {
    if (props && block) {
      cameraState.dirty = true;
    }

    if (cameraState.renderOnDirty && !cameraState.dirty) return;

    if (!block) {
      block = props
      props = {}
    }

    updateCamera(props)
    injectContext(block)
    cameraState.dirty = false;
  }

  Object.keys(cameraState).forEach(function (name) {
    setupCamera[name] = cameraState[name]
  })

  const reset = () => {
    cameraState.theta = 0;
    cameraState.phi = 0;
    prevX = 0;
    prevY = 0;
    cameraState.dtheta = 0;
    cameraState.dphi = 0;
    cameraState.dirty = true;
  }

  const centerLatLong = (lat: number, long: number) => {
    cameraState.theta = (lat * Math.PI) / 180;
    cameraState.phi = (long * Math.PI) / 180;
    cameraState.dirty = true;
  }

  return {
    state: cameraState,
    run: setupCamera,
    setDirty() {
      cameraState.dirty = true;
    },
    getLatLong() {
      return [
        ((cameraState.theta * 180) / Math.PI) % 360,
        (cameraState.phi * 180) / Math.PI,
      ];
    },
    reset,
    centerLatLong
  };
}
