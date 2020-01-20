import { ReactiveWorker } from '../utils/workers';
import { GameLoop } from './GameLoop';
import { IWorldOptions, WorldGrid, CellGroup } from './WorldGrid';
import { EMapMode } from '../types';
import { WorldGenerator } from './WorldGenerator';
import { World } from './World';
import { worldStore } from '../records';

const game = new GameLoop(error => {
  console.error(error);
});

const ctx: Worker = self as any;
const worker = new ReactiveWorker(ctx, false);
const worldGen = new WorldGenerator();

// global state
let world: World;
let worldGrid: WorldGrid;

function init() {
  worldGrid.cellGroupUpdates$.subscribe(data => {
    console.log('cell group update', data);
    worker.send('cellGroupUpdate', data);
  });

  const group1 = worldGrid.createCellGroup({
    name: 'Foobar',
    color: [0.5, 0.5, 0.5, 0.1],
  });
  group1.addCell(...[15881, 16114, 16258, 16347, 16580, 16724, 16868, 16635]);

  setTimeout(() => {
    group1.addCell(16957);
  }, 10000);


  game.addTimer({
    ticksLength: 30,
    isRepeated: true,
    onFinished: () => {
      const yearRatio = (game.state.ticks.value % 360) / 360.;
      console.log(yearRatio);
      worldGrid.updateGlobe(yearRatio);
      world.resetMapMode(EMapMode.INSOLATION);
      world.resetMapMode(EMapMode.TEMPERATURE);
      world.resetMapMode(EMapMode.MOISTURE);
      worker.send('draw');
    }
  });
}

function setup() {
  game.state.speedIndex.subscribe(speedIndex => worker.send('speedIndex', speedIndex));
  game.state.speed.subscribe(speed => worker.send('speed', speed));
  game.state.running.subscribe(running => worker.send('running', running));
  game.date$.subscribe(date => worker.send('date', date));
}

worker.on('loadWorld', (props) => {
  world = World.load(props.export, props.mapMode);
  worldGrid = new WorldGrid(world);

  init();
  setup();
  

  worker.send('generate', {
    world: world.getData(),
    grid: worldGrid.getData(),
  });
}, true);

worker.on('newWorld', ({ options, mapMode }) => {
  console.log('worldgen init', options);

  world = worldGen.generate(options, mapMode)
  worldGen.update(0)
  worldGrid = new WorldGrid(world);

  init();
  setup();

  worker.send('generate', {
    world: world.getData(),
    grid: worldGrid.getData(),
  });
}, true);

worker.on('saveWorld', async ({ name }) => {
  try {
    worldStore.save(world.export(), name);
  } catch {
    return false;
  }
  return true;
}, true);

worker.on('getIntersectedCell', async ({ point, dir }) => {
  return world.getIntersectedCell(point, dir);
}, true);

worker.on('getCellGroupForCell', async (cell) => {
  return worldGrid.getCellGroupForCell(cell);
}, true);

worker.on('getCellData', async (r) => {
  return worldGrid.getCellData(r);
}, true);

worker.on('setMapMode', async (mapMode) => {
  world.setMapMode(mapMode);
}, true);

worker.on('start', async () => game.start());
worker.on('stop', async () => game.stop());
worker.on('faster', async () => game.faster());
worker.on('slower', async () => game.slower());
