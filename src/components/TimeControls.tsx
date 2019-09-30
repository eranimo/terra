import React, { Fragment, useContext } from "react";
import { MapManagerContainer } from './MapViewer';
import { useObservable } from "../utils/hooks";
import { Box, Button, Stack, IconButton, Icon, PseudoBox } from '@chakra-ui/core';
import { monthTitles } from "../types";
import { IGameDate, gameSpeedTitles } from '../worldgen/GameLoop';
import { FaPlay, FaPause, FaChevronLeft, FaChevronRight} from 'react-icons/fa';


const TimeButton = ({ icon, onClick, isDisabled = false }) => (
  <PseudoBox
    color="gray.300"
    _hover={{
      color: 'blue.300',
    }}
  >
    <Button onClick={onClick} size="sm" isDisabled={isDisabled}>
      <Box
        as={icon}
      />
    </Button>
  </PseudoBox>
);

const Date = () => {
  const manager = useContext(MapManagerContainer.Context);
  const date = useObservable<IGameDate>(manager.client.worker$.on('date'), { month: 0, dayOfMonth: 1, year: 1 });
  if (!date) return null;

  const { dayOfMonth, month, year } = date;
  const monthName = monthTitles[month];
  const yearNum = year.toLocaleString();

  return <Fragment>{monthName} {dayOfMonth}, Y{yearNum}</Fragment>;
}

export const TimeControls = () => {
  const manager = useContext(MapManagerContainer.Context);
  const running = useObservable<boolean>(manager.client.worker$.on('running'), false);
  const speed = useObservable<number>(manager.client.worker$.on('speed'), 1);
  const speedIndex = useObservable<number>(manager.client.worker$.on('speedIndex'), 1);

  return (
    <Box
      p="5"
      bg="rgba(23, 25, 35, 0.95)"
      borderWidth="1px"
      borderColor="gray.600"
      position="fixed"
      left={0}
      bottom={0}
    >
      <Stack isInline spacing={5}>
        <Box>
          <TimeButton
            icon={running ? FaPause : FaPlay}
            onClick={() => {
              if (running) {
                manager.client.stop();
              } else {
                manager.client.start();
              }
            }}
          />
        </Box>
        <Button width="100px" textAlign="center" size="sm" variant="unstyled">
          <Date />
        </Button>
        <Box><TimeButton isDisabled={speedIndex === 0} icon={FaChevronLeft} onClick={() => manager.client.slower()} /></Box>
        <Button width="50px" textAlign="center" size="sm" variant="unstyled">
          {gameSpeedTitles[speed.toString()]}
        </Button>
        <Box><TimeButton isDisabled={speedIndex === 3} icon={FaChevronRight} onClick={() => manager.client.faster()} /></Box>
      </Stack>
    </Box>
  )
}