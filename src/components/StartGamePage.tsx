import { Box, Heading, Spinner } from '@chakra-ui/core';
import React, { useContext } from 'react';
import { RouteComponentProps } from 'react-router';
import { useAsync } from 'react-use';
import * as yup from 'yup';
import { FormControls } from '../forms';
import { worldStore } from '../records';
import { IGameOptions } from '../types';
import { worldOptionsSchema } from './Controls';
import { MenuContainer } from './MenuContainer';
import { WorkerContext } from './WorkerManager';

const gameOptionsSchema = yup.object<IGameOptions>().shape({
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

const GameOptionsPage: React.FC<{
  worldName: string,
  world: any,
}> = ({ worldName, world }) => {
  console.log('world', world.data.options);

  const initialValues: IGameOptions = {
    core: {
      name: '',
      enableDevMode: false,
    },
    sim: {
      numStartingCivs: 10,
    },
  };

  const startGame = (values: IGameOptions) => {
    const valuesCast = gameOptionsSchema.cast(values);
    console.log(valuesCast);
  };

  return (
    <MenuContainer page="Start Game" width="50vw">
      <Box mb="5">
        <Heading size="md" as="h3" mb={3}>World Options</Heading>
        Saved world: {worldName}
        <FormControls
          schema={worldOptionsSchema}
          onSubmit={startGame}
          initialValues={world.data.options}
        />
      </Box>
      <Box>
        <Heading size="md" as="h3" mb={3}>Game Options</Heading>
        <FormControls
          schema={gameOptionsSchema}
          onSubmit={startGame}
          initialValues={initialValues}
        />
      </Box>
    </MenuContainer>
  )
  // return (
  //   <Redirect to={`/load-game/${gameID}`} />
  // )
}

type StartGamePageProps = RouteComponentProps<{ worldName: string }>;
export const StartGamePage: React.FC<StartGamePageProps> = ({ match }) => {
  const client = useContext(WorkerContext);
  const worldName = match.params.worldName;
  const worldLoadState = useAsync(async () => worldStore.load(worldName))

  if (worldLoadState.loading) {
    return (
      <MenuContainer page="Start Game">
        <Spinner />
      </MenuContainer>
    );
  }
  return <GameOptionsPage worldName={worldName} world={worldLoadState.value} />
}