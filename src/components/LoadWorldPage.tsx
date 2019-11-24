import { Box, Spinner } from '@chakra-ui/core';
import React, { useContext, useEffect, useState } from 'react';
import { Subscription } from 'rxjs';
import { GlobeManager } from '../GlobeManager';
import { LoadingOverlay } from './LoadingOverlay';
import { MapViewer } from './MapViewer';
import { WorkerContext } from './WorkerManager';
import { WorldUI } from './WorldUI';
import { useAsync } from 'react-use';
import { worldStore, IWorldRecord } from '../records';
import { RouteComponentProps } from 'react-router';
import { MenuContainer } from './MenuContainer';
import { ISaveStoreRecord } from '../SaveStore';


let globeManager: GlobeManager;

type StartGamePageProps = RouteComponentProps<{ worldName: string }>;

export const LoadedWorldUI: React.FC<{ record: ISaveStoreRecord<IWorldRecord> }> = ({ record }) => {
  const [isLoading, setLoading] = useState(true);
  const client = useContext(WorkerContext);

  // globe manager
  let loadingSubscription: Subscription;
  useEffect(() => {
    globeManager = new GlobeManager(client, record.data.options);
    loadingSubscription = globeManager.loading$.subscribe(isLoading => {
      setLoading(isLoading);
    });
    return () => loadingSubscription.unsubscribe();
  }, []);


  return (
    <Box>
      <WorldUI globeManager={globeManager} loadedWorldName={record.name} />
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
  console.log('WORLD', worldName, worldLoadState.value);

  return <LoadedWorldUI record={worldLoadState.value} />;  
}