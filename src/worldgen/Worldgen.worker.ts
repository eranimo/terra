import { ReactiveWorker } from '../utils/workers';
import { GameLoop } from './GameLoop';
import { IWorldOptions, World } from './World';

const game = new GameLoop(error => {
  console.error(error);
});

const ctx: Worker = self as any;
const worker = new ReactiveWorker(ctx, false);
let world: World;

worker.on('init', ({ options, mapMode }) => {
  console.log('worldgen init', options);

  const worldOptions: IWorldOptions = {
    initialMapMode: mapMode
  };

  world = new World(options, worldOptions);

  world.addCellGroup({
    name: 'foo',
    color: [0.5, 0.5, 0.5, 1],
    cells: [15881, 16114, 16258, 16347, 16580, 16724, 16868, 16635]
  });

  console.log('!globe', world.globe);

  game.addTimer({
    ticksLength: 30,
    isRepeated: true,
    onFinished: () => {
      const yearRatio = (game.state.ticks.value % 360) / 360.;
      console.log(yearRatio);
      world.updateGlobe(yearRatio);
      world.globe.setupMapMode();
      worker.send('draw');
    }
  });

  game.state.speedIndex.subscribe(speedIndex => worker.send('speedIndex', speedIndex));
  game.state.speed.subscribe(speed => worker.send('speed', speed));
  game.state.running.subscribe(running => worker.send('running', running));
  game.date$.subscribe(date => {
    worker.send('date', date);
  });

  worker.send('generate', world.export());
}, true);

worker.on('getIntersectedCell', async ({ point, dir }) => {
  return world.globe.getIntersectedCell(point, dir);
}, true);

worker.on('getCellData', async (r) => {
  return world.globe.getCellData(r);
}, true);

worker.on('setMapMode', async (mapMode) => {
  world.globe.setMapMode(mapMode);
}, true);

worker.on('start', async () => game.start());
worker.on('stop', async () => game.stop());
worker.on('faster', async () => game.faster());
worker.on('slower', async () => game.slower());
