import * as yup from 'yup';
import { IGameOptions } from './types';


export const gameOptionsSchema = yup.object<IGameOptions>().shape({
  core: yup.object().label('Core').shape({
    name: yup.string().required().label('Game name'),
    enableDevMode: yup.boolean().meta({ component: 'checkbox' })
      .label('Enable Developer Mode'),
  }),
  sim: yup.object().label('Simulation').shape({
    numStartingCivs: yup.number().integer().required().min(0).max(100).meta({ component: 'slider', step: 1, })
    .label('Number of starting civilizations'),
  }),
});


export function startGame({ options: IGameOptions }) {
  
}