import { ReactiveWorker } from '../utils/workers';
import { Globe } from './Globe';
import { mapModeDefs } from '../mapModes';
import { GameLoop } from './GameLoop';

const game = new GameLoop(error => {
  console.error(error);
});

const ctx: Worker = self as any;
const worker = new ReactiveWorker(ctx, false);
let globe: Globe;

worker.on('init', ({ options, mapMode }) => {
  console.log('worldgen init', options);

  globe = new Globe(options, mapMode);

  console.log('!globe', globe)

  game.state.speedIndex.subscribe(speedIndex => worker.send('speedIndex', speedIndex));
  game.state.speed.subscribe(speed => worker.send('speed', speed));
  game.state.running.subscribe(running => worker.send('running', running));
  game.date$.subscribe(date => {
    worker.send('date', date);
  });

  worker.send('generate', globe.export());
}, true);

worker.on('getIntersectedCell', async ({ point, dir }) => {
  return globe.getIntersectedCell(point, dir);
}, true);

worker.on('getCellData', async (r) => {
  return globe.getCellData(r);
}, true);

worker.on('setMapMode', async (mapMode) => {
  globe.setMapMode(mapMode);
}, true);

worker.on('start', async () => game.start());
worker.on('stop', async () => game.stop());
worker.on('faster', async () => game.faster());
worker.on('slower', async () => game.slower());
