import { Box, Spinner } from '@chakra-ui/core';
import React, { useContext, useEffect, useState } from 'react';
import { Subscription } from 'rxjs';
import { WorldManager } from '../WorldManager';
import { LoadingOverlay } from './LoadingOverlay';
import { MapViewer } from './MapViewer';
import { WorkerContext } from './WorkerManager';
import { WorldUI } from './WorldUI';
import { useAsync } from 'react-use';
import { worldStore } from '../records';
import { RouteComponentProps } from 'react-router';
import { MenuContainer } from './MenuContainer';
import { ISaveStoreRecord } from '../SaveStore';
import { WorldExport } from '../types';
import { WorldEditorManager } from '../WorldEditorManager';


let worldEditorManager: WorldEditorManager;

type StartGamePageProps = RouteComponentProps<{ worldName: string }>;

export const LoadedWorldUI: React.FC<{
  worldName: string,
  record: WorldExport
}> = ({ worldName, record }) => {
  const [isLoading, setLoading] = useState(true);
  const client = useContext(WorkerContext);
  console.log('record', record);

  // globe manager
  let loadingSubscription: Subscription;
  useEffect(() => {
    worldEditorManager = new WorldEditorManager(client);
    worldEditorManager.load(record);
    loadingSubscription = worldEditorManager.loading$.subscribe(isLoading => {
      setLoading(isLoading);
    });
    return () => loadingSubscription.unsubscribe();
  }, []);


  return (
    <Box>
      <WorldUI loadedWorldName={worldName} worldEditorManager={worldEditorManager} />
      {isLoading && <LoadingOverlay />}
      {!isLoading && <MapViewer worldManager={worldEditorManager} />}
    </Box>
  );
}

export const LoadWorldPage: React.FC<StartGamePageProps> = ({ match }) => {
  const worldName = match.params.worldName;
  const worldLoadState = useAsync(async () => worldStore.load(worldName))

  if (worldLoadState.loading) {
    return (
      <MenuContainer page="Load World">
        <Spinner />
      </MenuContainer>
    );
  }
  if (worldLoadState.value === undefined) {
    return (
      <MenuContainer page="Load World">
        World not found
      </MenuContainer>
    )
  }
  console.log('WORLD', worldName, worldLoadState.value);

  return <LoadedWorldUI worldName={worldName} record={worldLoadState.value} />;  
}