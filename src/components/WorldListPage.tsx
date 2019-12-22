import { Box, Breadcrumb, BreadcrumbItem, BreadcrumbLink, Button, Link as ChakraLink, Spinner, Stack, Text } from '@chakra-ui/core';
import React from 'react';
import { FaTrash } from 'react-icons/fa';
import { Link } from 'react-router-dom';
import { useAsyncRetry } from 'react-use';
import { worldStore } from '../records';
import { MenuContainer } from './MenuContainer';
import { loadWorldPageRoute } from '../routes';


const ChakraLink$ = ChakraLink as any;
const BreadcrumbLink$ = BreadcrumbLink as any;
const Button$ = Button as any;

export const WorldListPage = ({}) => {
  const worldSavesState = useAsyncRetry(async () => {
    return worldStore.getSaves()
  });
  console.log(worldSavesState);


  return (
    <MenuContainer page="New World">
      <Text fontSize="md">
        Load a saved world to begin playing, or <ChakraLink$ color="blue.200" as={Link} to="/new-world">create one</ChakraLink$>.
      </Text>
      {worldSavesState.loading && <Spinner />}
      {worldSavesState.value && worldSavesState.value.length === 0 && (
        <Text fontSize="md" mt="5">
          <Box mb="5">
            There are no saved worlds. You must create a world before playing.
          </Box>

          <Button$ as={Link} to="/new-world" variantColor="blue" size="lg">
            New World
          </Button$>
        </Text>
      )}
      {worldSavesState.value && worldSavesState.value.length > 0 && (
        <Box
          mt="5"
          borderColor="gray.700"
          borderWidth="1px"
          rounded="lg"
          p="5"
        >
          <table style={{ width: '100%' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>World Name</th>
                <th style={{ textAlign: 'left' }}>Date</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {worldSavesState.value.map(item => (
                <tr key={item.name}>
                  <td>{item.name}</td>
                  <td>
                    {new Date(item.createdAt).toLocaleDateString()} {new Date(item.createdAt).toLocaleTimeString()}
                  </td>
                  <td>
                    <Stack isInline spacing="2">
                      <Button$
                        as={Link}
                        to={loadWorldPageRoute(item.name)}
                        size="sm"
                        variant="ghost"
                        variantColor="blue"
                      >
                        Load
                      </Button$>
                      <Button
                        size="sm"
                        variant="ghost"
                        variantColor="red"
                        onClick={async () => {
                          await worldStore.removeSave(item.name);
                          worldSavesState.retry();
                        }}
                      >
                        <Box as={FaTrash} />
                      </Button>
                    </Stack>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Box>
      )}
    </MenuContainer>
  )
}