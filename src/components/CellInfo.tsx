import React, { useState, useContext } from 'react';
import { MapManager } from '../MapManager';
import { Box, Heading, Text, Spinner } from '@chakra-ui/core';
import { useObservable, usePrevious } from 'react-use';
import { round } from 'lodash';
import { biomeTitles, CellGlobeData, CellWorldData } from '../types';
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
  const [cellData, setCellData] = useState<CellWorldData>(null);
  const prevSelectedCell = usePrevious(selectedCell);

  if (selectedCell === null || selectedCell === undefined) return null;

  if (prevSelectedCell !== selectedCell) {
    manager.client.getCellData(selectedCell.cell)
      .then(cellData => {
        console.log('cellData', cellData);
        setCellData(cellData);
      });
  }
  
  if (cellData === null) {
    return <Spinner />;
  }

  const [lat, long] = cellData.globe.lat_long;
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
            <td>{round(cellData.globe.temperature, 2)}</td>
          </tr>
          <tr>
            <td><Text color="gray.400" mr={5}>Moisture</Text></td>
            <td>{round(cellData.globe.moisture, 2)}</td>
          </tr>
          <tr>
            <td><Text color="gray.400" mr={5}>Elevation</Text></td>
            <td>{round(cellData.globe.elevation, 2)}</td>
          </tr>
          <tr>
            <td><Text color="gray.400" mr={5}>Distance to ocean</Text></td>
            <td>{cellData.globe.distance_to_ocean || 'N/A'}</td>
          </tr>
          <tr>
            <td><Text color="gray.400" mr={5}>Biome</Text></td>
            <td>{biomeTitles[cellData.globe.biome] || 'None'}</td>
          </tr>
          <tr>
            <td><Text color="gray.400" mr={5}>Insolation</Text></td>
            <td>{round(cellData.globe.insolation, 2) || 'N/A'}</td>
          </tr>
          <tr>
            <td><Text color="gray.400" mr={5}>Desirability</Text></td>
            <td>{round(cellData.globe.desirability, 2) || 'N/A'}</td>
          </tr>
          {cellData.cellGroup && <tr>
            <td><Text color="gray.400" mr={5}>Cell Group</Text></td>
            <td>{cellData.cellGroup}</td>
          </tr>}
        </tbody>
      </table>
    </Box>
  )
}