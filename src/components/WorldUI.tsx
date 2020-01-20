import { Box, Button, FormControl, FormLabel, Heading, Input, Modal, ModalBody, ModalCloseButton, ModalContent, ModalFooter, ModalHeader, ModalOverlay, Stack } from '@chakra-ui/core';
import React, { useState } from 'react';
import { Link, useHistory } from 'react-router-dom';
import { WorldEditorManager } from '../WorldEditorManager';
import {  worldStore } from '../records';
import { mainPageRoute } from '../routes';
import { Controls } from './Controls';


export const WorldUI: React.FC<{
  worldEditorManager: WorldEditorManager,
  loadedWorldName?: string,
}> = ({
  worldEditorManager,
  loadedWorldName,
}) => {
  const [isOptionsOpen, setOptionsOpen] = useState(false);
  const history = useHistory();

  // save modal
  const [isSaveOpen, setSaveOpen] = useState(false);
  const [worldName, setWorldName] = useState(loadedWorldName || '');
  const [savedWorldName, setSavedWorldName] = useState(loadedWorldName);

  const saveWorld = async () => {
    setSavedWorldName(worldName);
    setSaveOpen(false);
    worldEditorManager.saveWorld(worldName).then(didSave => {
      if (didSave) {
        history.push(`/world/${worldName}`);
      } else {
        window.alert('Failed to save world');
      }
    });
  };

  return (
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
      <Link to={mainPageRoute()}>
        Back
      </Link>
      <Heading mb="5">
        {savedWorldName ? `World "${savedWorldName}"` : 'New World'}
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
            <Controls worldEditorManager={worldEditorManager} />
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
                Save World
              </Button>
            </Stack>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  )
}