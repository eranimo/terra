import { Box } from '@chakra-ui/core';
import React, { useContext, useEffect, useState } from 'react';
import { Subscription } from 'rxjs';
import { GlobeManager } from '../GlobeManager';
import { LoadingOverlay } from './LoadingOverlay';
import { MapViewer } from './MapViewer';
import { WorkerContext } from './WorkerManager';
import { WorldUI } from './WorldUI';


let globeManager: GlobeManager;

export const NewWorldPage = () => {
  const client = useContext(WorkerContext);

  // globe manager
  const [isLoading, setLoading] = useState(true);
  let loadingSubscription: Subscription;
  useEffect(() => {
    globeManager = new GlobeManager(client);
    loadingSubscription = globeManager.loading$.subscribe(isLoading => {
      setLoading(isLoading);
    });
    return () => loadingSubscription.unsubscribe();
  }, []);


  return (
    <Box>
      <WorldUI globeManager={globeManager} />
      {isLoading && <LoadingOverlay />}
      {!isLoading && <MapViewer globeManager={globeManager} />}
    </Box>
  );
}