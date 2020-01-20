import { Box } from '@chakra-ui/core';
import React, { useContext, useEffect, useState } from 'react';
import { Subscription } from 'rxjs';
import { WorldManager } from '../WorldManager';
import { LoadingOverlay } from './LoadingOverlay';
import { MapViewer } from './MapViewer';
import { WorkerContext } from './WorkerManager';
import { WorldUI } from './WorldUI';
import { WorldEditorManager } from '../WorldEditorManager';


let worldEditorManager: WorldEditorManager;

export const NewWorldPage = () => {
  const client = useContext(WorkerContext);

  // globe manager
  const [isLoading, setLoading] = useState(true);
  let loadingSubscription: Subscription;
  useEffect(() => {
    worldEditorManager = new WorldEditorManager(client);
    worldEditorManager.generate();

    loadingSubscription = worldEditorManager.loading$.subscribe(isLoading => setLoading(isLoading));
    return () => loadingSubscription.unsubscribe();
  }, []);


  return (
    <Box>
      <WorldUI worldEditorManager={worldEditorManager} />
      {isLoading && <LoadingOverlay />}
      {!isLoading && <MapViewer worldManager={worldEditorManager} />}
    </Box>
  );
}