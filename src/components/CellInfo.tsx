import React, { useState, useContext } from 'react';
import { MapManager } from '../MapManager';
import { Box, Heading, Text, Spinner } from '@chakra-ui/core';
import { useObservable } from 'react-use';
import { round } from 'lodash';
import { biomeTitles } from '../types';
import { MapManagerContainer } from './MapViewer';


function formatLatLong(lat: number, long: number): string {
  return [
    `${Math.abs(round(lat, 2))}${lat < 0 ? '°S' : `°N`}`,
    `${Math.abs(round(long, 2))}${long < 0 ? '°W' : `°E`}`,
  ].join(' ')
}

export function CellInfo() {
  const manager = useContext(MapManagerContainer.Context);
  const selectedCell = useObservable(manager.selectedCell);
  const [cellData, setCellData] = useState(null);

  if (selectedCell === null || selectedCell === undefined) return null;

  manager.client.getCellData(selectedCell.cell)
    .then(cellData => {
      setCellData(cellData);
    });
  
  if (cellData === null) {
    return <Spinner />;
  }

  const [lat, long] = cellData.lat_long;
  return (
    <Box
      p={5}
      width={360}
      position="fixed"
      right="0"
      bottom="180px"
      bg="rgba(23, 25, 35, 0.95)"
      borderWidth="1px"
      borderColor="gray.600"
      transform="translate(-1px, 1px)"
    >
      <Heading size="sm" mb={5}>
        {formatLatLong(lat, long)}
      </Heading>
      <table>
        <tbody>
          <tr>
            <td><Text color="gray.400" mr={5}>(debug) Cell ID</Text></td>
            <td>#{selectedCell.cell}</td>
          </tr>
          <tr>
            <td><Text color="gray.400" mr={5}>Temperature</Text></td>
            <td>{round(cellData.temperature, 2)}</td>
          </tr>
          <tr>
            <td><Text color="gray.400" mr={5}>Moisture</Text></td>
            <td>{round(cellData.moisture, 2)}</td>
          </tr>
          <tr>
            <td><Text color="gray.400" mr={5}>Elevation</Text></td>
            <td>{round(cellData.elevation, 2)}</td>
          </tr>
          <tr>
            <td><Text color="gray.400" mr={5}>Distance to ocean</Text></td>
            <td>{cellData.distance_to_ocean || 'N/A'}</td>
          </tr>
          <tr>
            <td><Text color="gray.400" mr={5}>Biome</Text></td>
            <td>{biomeTitles[cellData.biome] || 'None'}</td>
          </tr>
          <tr>
            <td><Text color="gray.400" mr={5}>Insolation</Text></td>
            <td>{round(cellData.insolation, 2) || 'N/A'}</td>
          </tr>
        </tbody>
      </table>
    </Box>
  )
}