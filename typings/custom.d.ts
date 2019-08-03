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