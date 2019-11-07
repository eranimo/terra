import React, { useState, useContext, useEffect } from 'react';
import { MapViewer } from './MapViewer';
import { WorkerContext } from './WorkerManager';
import { GlobeManager } from '../GlobeManager';
import { Box, Stack, Heading, Button, Modal, ModalContent, ModalOverlay, ModalHeader, ModalCloseButton, ModalBody, ModalFooter, Flex, Spinner, FormControl, FormLabel, Input, FormHelperText, IconButton } from '@chakra-ui/core';
import { Controls } from './Controls';
import { Subscription } from 'rxjs';
import { worldStore, IWorldRecord } from '../records';
import { Link } from 'react-router-dom';
import { mainPage } from '../routes';
import { LoadingOverlay } from './LoadingOverlay';


let globeManager: GlobeManager;

export const NewWorldPage = () => {
  const client = useContext(WorkerContext);

  const [isOptionsOpen, setOptionsOpen] = useState(false);

  // globe manager
  const [isLoading, setLoading] = useState(true);
  let loadingSubscription: Subscription;
  useEffect(() => {
    globeManager = new GlobeManager(client);

    loadingSubscription = globeManager.loading$.subscribe(isLoading => {
      console.log('globe generator loading', isLoading)
      setLoading(isLoading);
    });
  
    return () => {
      loadingSubscription.unsubscribe();
    };
  }, []);


  // save modal
  const [isSaveOpen, setSaveOpen] = useState(false);
  const [worldName, setWorldName] = useState("");

  const saveWorld = async () => {
    setSaveOpen(false);
    const worldRecord: IWorldRecord = {
      options: globeManager.globeOptions$.value,
    };
    await worldStore.save(worldRecord, worldName);
    window.alert('World Saved');
  };

  return (
    <Box>
      <Box
        p="5"
        position="fixed"
        left="0"
        top="0"
        width="400px"
        bg="rgba(23, 25, 35, 0.95)"
        borderWidth="1px"
        borderColor="gray.600"
        transform="translate(-1px, -1px)"
      >
        <Link to={mainPage()}>
          Back
        </Link>
        <Heading mb="5">
          New World
        </Heading>
        <Stack align="center" isInline>
          <Button
            size="sm"
            onClick={() => setOptionsOpen(!isOptionsOpen)}
          >
            World Options
          </Button>
          <Button
            size="sm"
            variantColor="blue"
            onClick={() => setSaveOpen(true)}
          >
            Save World
          </Button>
        </Stack>
        <Modal size="xl" isOpen={isOptionsOpen} onClose={() => setOptionsOpen(false)}>
          <ModalOverlay />
          <ModalContent>
            <ModalHeader>World Options</ModalHeader>
            <ModalCloseButton />
            <ModalBody>
              <Controls manager={globeManager} />
            </ModalBody>
          </ModalContent>
        </Modal>
        <Modal size="xl" isOpen={isSaveOpen} onClose={() => setSaveOpen(false)}>
          <ModalOverlay />
          <ModalContent>
            <ModalHeader>Save World</ModalHeader>
            <ModalCloseButton />
            <ModalBody>
              <FormControl>
                <FormLabel>World Name</FormLabel>
                <Input
                  autoFocus
                  type="text"
                  value={worldName}
                  onChange={event => setWorldName(event.target.value)}
                />
              </FormControl>
            </ModalBody>
            <ModalFooter>
              <Stack isInline spacing={5}>
                <Button
                  onClick={() => setSaveOpen(false)}
                >
                  Close
                </Button>
                <Button
                  variantColor="blue"
                  onClick={saveWorld}
                >
                  Play World
                </Button>
              </Stack>
            </ModalFooter>
          </ModalContent>
        </Modal>
      </Box>
      {isLoading && <LoadingOverlay />}
      {!isLoading && <MapViewer globeManager={globeManager} />}
    </Box>
  );
}