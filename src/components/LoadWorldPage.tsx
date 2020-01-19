import { Box, Spinner } from '@chakra-ui/core';
import React, { useContext, useEffect, useState } from 'react';
import { Subscription } from 'rxjs';
import { GlobeManager } from '../GlobeManager';
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


let globeManager: GlobeManager;

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
    globeManager = new GlobeManager(client, record.options);
    loadingSubscription = globeManager.loading$.subscribe(isLoading => {
      setLoading(isLoading);
    });
    return () => loadingSubscription.unsubscribe();
  }, []);


  return (
    <Box>
      <WorldUI globeManager={globeManager} loadedWorldName={worldName} />
      {isLoading && <LoadingOverlay />}
      {!isLoading && <MapViewer globeManager={globeManager} />}
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

  return <LoadedWorldUI worldName="worldName" record={worldLoadState.value} />;  
}