import React, { useState } from 'react';
import { MapManager } from '../MapManager';
import {
  Box,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  MenuOptionGroup,
  Button,
  Text,
  Stack,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton
} from '@chakra-ui/core';
import { mapModeTitles } from '../types';
import { useObservable } from '../utils/hooks';
import { DrawOptionsTab } from './Controls';


const MenuItem$ = MenuItem as any;
const MenuButton$ = MenuButton as any;

export const ViewControl = ({ manager }: { manager: MapManager }) => {
  const mapMode = useObservable(manager.mapMode$, manager.mapMode$.value);
  const [isModalOpen, setModalOpen] = useState(false);
  return (
    <Box
      p="5"
      bg="rgba(23, 25, 35, 0.95)"
      borderWidth="1px"
      borderColor="gray.600"
      position="fixed"
      right={0}
      top={0}
    >
      <Stack isInline spacing={3}>
        <Box>
          <Menu>
            <MenuButton$ as={Button} rightIcon="chevron-down">
            <Text color="gray.400" mr={1}>Map mode:</Text> {mapModeTitles[mapMode]}
            </MenuButton$>
            <MenuList>
              <MenuOptionGroup
                defaultValue={mapMode}
                type="radio"
                onChange={value => manager.mapMode$.next(value)}
              >
                {Object.entries(mapModeTitles).map(([mapMode, title]) => (
                  <MenuItem$ value={mapMode}>{title}</MenuItem$>
                ))}
              </MenuOptionGroup>
            </MenuList>
          </Menu>
        </Box>
        <Box>
          <Button rightIcon="chevron-down" onClick={() => setModalOpen(true)}>Draw Options</Button>
          <Modal isOpen={isModalOpen} onClose={() => setModalOpen(false)}>
            <ModalOverlay />
            <ModalContent bg="rgba(23, 25, 35, 0.95)">
              <ModalHeader>Draw Options</ModalHeader>
              <ModalCloseButton />
              <ModalBody>
                <DrawOptionsTab manager={manager} />
              </ModalBody>
            </ModalContent>
          </Modal>
        </Box>
      </Stack>
    </Box>
  )
}
