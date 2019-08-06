declare module "worker-loader!*" {
  class WebpackWorker extends Worker {
    constructor();
  }
  export = WebpackWorker;
}

declare module "@turf/*" {
  var fuckTypescript: any;
  export = fuckTypescript;
}

interface Constructor<T> {
  new (...args: any[]): T;
  prototype: T;
}
