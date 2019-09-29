import React, { useState } from 'react';
import { MapManager } from '../MapManager';
import { Box, Heading, Text } from '@chakra-ui/core';
import { useObservable } from 'react-use';
import { round } from 'lodash';
import { biomeTitles } from '../types';


function formatLatLong(lat: number, long: number): string {
  return [
    `${Math.abs(round(lat, 2))}${lat < 0 ? '°S' : `°N`}`,
    `${Math.abs(round(long, 2))}${long < 0 ? '°W' : `°E`}`,
  ].join(' ')
}

export function CellInfo({ manager }: { manager: MapManager }) {
  return null;
  // const hoverCell = useObservable(manager.hoveredCell);

  // if (hoverCell === null || hoverCell === undefined) return null;

  // const [lat, long] = manager.globe.r_lat_long[hoverCell];
  // return (
  //   <Box
  //     p={5}
  //     width={360}
  //     position="fixed"
  //     right="0"
  //     bottom="180px"
  //     bg="rgba(23, 25, 35, 0.95)"
  //     borderWidth="1px"
  //     borderColor="gray.600"
  //     transform="translate(-1px, 1px)"
  //   >
  //     <Heading size="sm" mb={5}>
  //       {formatLatLong(lat, long)}
  //     </Heading>
  //     <table>
  //       <tbody>
  //         <tr>
  //           <td><Text color="gray.400" mr={5}>Temperature</Text></td>
  //           <td>{round(manager.globe.r_temperature[hoverCell], 2)}</td>
  //         </tr>
  //         <tr>
  //           <td><Text color="gray.400" mr={5}>Moisture</Text></td>
  //           <td>{round(manager.globe.r_moisture[hoverCell], 2)}</td>
  //         </tr>
  //         <tr>
  //           <td><Text color="gray.400" mr={5}>Elevation</Text></td>
  //           <td>{round(manager.globe.r_elevation[hoverCell], 2)}</td>
  //         </tr>
  //         <tr>
  //           <td><Text color="gray.400" mr={5}>Distance to ocean</Text></td>
  //           <td>{manager.globe.r_distance_to_ocean[hoverCell] || 'N/A'}</td>
  //         </tr>
  //         <tr>
  //           <td><Text color="gray.400" mr={5}>Biome</Text></td>
  //           <td>{biomeTitles[manager.globe.r_biome[hoverCell]] || 'None'}</td>
  //         </tr>
  //       </tbody>
  //     </table>
  //   </Box>
  // )
}