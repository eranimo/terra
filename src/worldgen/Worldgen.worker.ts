import { ReactiveWorker } from '../utils/workers';
import { Globe } from './Globe';
import { mapModeDefs } from '../mapModes';


const ctx: Worker = self as any;
const worker = new ReactiveWorker(ctx, false);
let globe: Globe;

worker.on('init', (options) => {
  console.log('worldgen init', options);

  globe = new Globe(options);

  console.log('!globe', globe)

  worker.send('generate', globe.export());
}, true);

worker.on('getIntersectedCell', async ({ point, dir }) => {
  return globe.getIntersectedCell(point, dir);
}, true);

worker.on('getCellData', async (r) => {
  return globe.getCellData(r);
}, true);