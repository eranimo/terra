import React from 'react';
import { MapManager } from '../MapManager';
import { Box, Menu, MenuButton, MenuList, MenuItem, MenuOptionGroup, Button, Text } from '@chakra-ui/core';
import { mapModeTitles } from '../types';
import { useObservable } from '../utils/hooks';


const MenuItem$ = MenuItem as any;

export const ViewControl = ({ manager }: { manager: MapManager }) => {
  const mapMode = useObservable(manager.mapMode$, manager.mapMode$.value);
  return (
    <Box
      p="5"
      bg="black"
      borderWidth="1px"
      borderColor="gray.600"
      position="fixed"
      right={0}
      top={0}
    >
      <Menu>
        <MenuButton as={Button}>
        <Text color="gray.400" mr={1}>Map mode:</Text> {mapModeTitles[mapMode]}
        </MenuButton>
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
  )
}
