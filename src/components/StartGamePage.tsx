import React, { useContext, useEffect } from 'react';
import { Redirect, RouteComponentProps } from 'react-router';
import { WorkerContext } from './WorkerManager';
import { usePromise, useAsync } from 'react-use';
import { worldStore, IWorldRecord } from '../records';
import { MenuContainer } from './MenuContainer';
import { Button, Spinner, FormControl, FormLabel, FormHelperText, Input, FormErrorMessage, Text, Heading, Box, Slider, Stack, SliderTrack, SliderFilledTrack, SliderThumb, Checkbox, Flex, Icon } from '@chakra-ui/core';
import { Formik, FormikHelpers, Field, FieldProps, FieldInputProps, FormikProps } from 'formik';
import { IGameOptions } from '../types';
import * as yup from 'yup';
import { Divider } from './Divider';
import styled from '@emotion/styled';
import { FaMinus, FaPlus } from 'react-icons/fa';
import { FormControls } from '../forms';
import { IWorldOptions } from '../worldgen/World';
import { worldOptionsSchema } from './Controls';


const gameOptionsSchema = yup.object<IGameOptions>().shape({
  core: yup.object().label('Core').shape({
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
      enableDevMode: false,
    },
    sim: {
      numStartingCivs: 10,
    },
  };

  const startGame = (values: IGameOptions, actions: FormikHelpers<IGameOptions>) => {
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
          onSubmit={(values) => console.log(values)}
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