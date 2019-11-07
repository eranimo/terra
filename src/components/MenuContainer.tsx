import { Box, Breadcrumb, BreadcrumbItem, BreadcrumbLink, Flex, Heading, Text } from '@chakra-ui/core';
import React from 'react';
import { Link } from 'react-router-dom';
import { Divider } from './Divider';
const stars = require('../images/stars.png');


const BreadcrumbLink$ = BreadcrumbLink as any;

type MenuContainerProps = {
  page?: string,
  width?: string | number,
};
export const MenuContainer: React.FC<MenuContainerProps> = ({ children, page, width = '500px' }) => {
  return (
    <Flex
      height="100vh"
      overflowY="auto"
      alignItems="center"
      flexDir="column"
      backgroundImage={`url(${stars})`}
    >
      <Box width={width} mt="10rem">
        <Heading fontSize="6xl">Terra</Heading>
        <Text color="gray.500" mt={5} mb={8} fontSize="md">
          A grand strategy game with a procedurally generated world.
        </Text>
      </Box>
      <Box
        width={width}
        height="fit-content"
        bg="rgba(23, 25, 35, 0.95)"
        borderWidth="1px"
        borderColor="gray.600"
        rounded="lg"
        padding={10}
        marginBottom={20}
      >
        {page && <>
          <Breadcrumb>
            <BreadcrumbItem>
              <BreadcrumbLink$ color="blue.200" as={Link} to="/">Main Menu</BreadcrumbLink$>
            </BreadcrumbItem>

            <BreadcrumbItem isCurrentPage>
              <BreadcrumbLink>{page}</BreadcrumbLink>
            </BreadcrumbItem>        
          </Breadcrumb>
          <Divider />
        </>}
        {children}
      </Box>
    </Flex>
  );
}
