import { Accordion, AccordionHeader, AccordionItem, AccordionPanel, Box, Button, Checkbox, Collapse, Heading, Input, Select, Slider, SliderFilledTrack, SliderThumb, SliderTrack, Stack, Text } from '@chakra-ui/core';
import { get, groupBy, random, set } from 'lodash';
import React, { useState, useContext } from 'react';
import { MapManager } from '../MapManager';
import { categoryTitles, IDrawOptions } from '../types';
import { useObservable, useObservableDict } from '../utils/hooks';
import { Field } from "./Field";
import { MapManagerContainer } from './MapViewer';
import { GlobeManager } from '../GlobeManager';
import * as yup from 'yup';
import { IWorldOptions } from '../worldgen/World';


export const worldOptionsSchema = yup.object<IWorldOptions>().shape({
  core: yup.object().label('Core').shape({
    seed: yup.number().integer().label('Random Seed'),
  }),
  sphere: yup.object().label('Sphere').shape({
    numberCells: yup.number().required().integer()
      .label('Number of cells'),
    jitter: yup.number().required().min(0).max(1)
      .label('Cell jitter').meta({ component: 'slider', step: 0.1 }),
    protrudeHeight: yup.number().required().min(0).max(1)
      .label('Protrude height').meta({ component: 'slider', step: 0.1 }),
  }),
  hydrology: yup.object().label('Hydrology').shape({
    flowModifier: yup.number().required().min(0).max(1)
      .label('Flow modifier').meta({ component: 'slider', step: 0.1 }),
    moistureModifier: yup.number().required().min(-1).max(1)
      .label('Moisture modifier').meta({ component: 'slider', step: 0.1 }),
  }),
  geology: yup.object().label('Geology').shape({
    numberPlates: yup.number().required().min(0).max(100)
      .label('Number of plates').meta({ component: 'slider', step: 0.1 }),
    oceanPlatePercent: yup.number().required().min(0).max(1)
      .label('Ocean plate percent').meta({ component: 'slider', step: 0.1 }),
    plateCollisionThreshold: yup.number().required().min(0).max(1)
      .label('Plate collision threshold').meta({ component: 'slider', step: 0.1 }),
    terrainRoughness: yup.number().required().min(0).max(1)
      .label('Terrain roughness').meta({ component: 'slider', step: 0.1 }),
    heightModifier: yup.number().required().min(-1).max(1)
      .label('Height modifier').meta({ component: 'slider', step: 0.1 }),
  }),
  climate: yup.object().label('Climate').shape({
    temperatureModifier: yup.number().required().min(-1).max(1)
      .label('Temperature modifier').meta({ component: 'slider', step: 0.1 }),
  })
});



interface IControlOptions {
  min?: number;
  max?: number;
  step?: number;
  options?: { [key: string]: any }
}
interface IControlProps {
  key: string;
  value: any;
  onChange: (value: any) => any;
  options?: IControlOptions;
}
const controlTypes: Record<string, React.FC<IControlProps>> = {
  string: ({ key, value, onChange }) => (
    <Input
      id={key}
      size="sm"
      type="text"
      value={value}
      onChange={event => onChange(event.target.value)}
    />
  ),
  select: ({ key, value, onChange, options }) => (
    <Select
      id={key}
      size="sm"
      aria-labelledby=""
      value={value}
      onChange={event => onChange(event.target.value as any)}
    >
      {Object.entries(options.options).map(([key, title]) => (
        <option key={title} value={key}>{title}</option>
      ))}
    </Select>
  ),
  boolean: ({ key, value, onChange }) => (
    <Checkbox
      id={key}
      size="sm"
      isChecked={value}
      onChange={event => onChange(event.target.checked)}
    />
  ),
  integer: ({ key, value, onChange, options }) => (
    <Input
      id={key}
      size="sm"
      type="number"
      value={value}
      min={options.min}
      max={options.max}
      step={options.step}
      onChange={event => onChange(parseInt(event.target.value, 10))}
    />
  ),
  float: ({ key, value, onChange, options }) => (
    <Input
      id={key}
      size="sm"
      type="number"
      value={value}
      min={options.min}
      max={options.max}
      step={options.step}
      onChange={event => onChange(parseFloat(event.target.value))}
    />
  ),
  slider: ({ key, value, onChange, options }) => (
    <Stack isInline mt={2}>
      <Text width="40px" textAlign="right">{value}</Text>
      <Slider
        id={key}
        defaultValue={value as any}
        min={options.min}
        max={options.max}
        step={options.step}
        onChange={onChange}
      >
        <SliderTrack />
        <SliderFilledTrack />
        <SliderThumb />
      </Slider>
    </Stack>
  )
}

type ControlDef = {
  key: string;
  title: string;
  type: keyof typeof controlTypes;
  desc: string;
  options?: IControlOptions
}

const GLOBE_OPTIONS: ControlDef[] = [
  {
    key: 'core.seed',
    title: 'Seed',
    type: 'integer',
    desc: 'Seed for the random number generator',
    options: { min: 0, max: 1e10 }
  },

  // sphere
  {
    key: 'sphere.numberCells',
    title: 'Number of cells',
    type: 'integer',
    desc: 'Number of cells in the world',
    options: { min: 0, max: 500_000 },
  },
  {
    key: 'sphere.jitter',
    title: 'Cell Jitter',
    desc: 'Maximum random jitter for cell vertices, in spherical space',
    type: 'slider',
    options: { min: 0, max: 1, step: 0.05 },
  },
  {
    key: 'sphere.protrudeHeight',
    title: 'Protrude Height',
    desc: 'Amount of height (in 3D coordinate space) to protrude from the sphere to represent altitude',
    type: 'slider',
    options: { min: 0, max: 1, step: 0.05 },
  },

  // hydrology
  {
    key: 'hydrology.flowModifier',
    title: 'Flow modifier',
    desc: 'What percentage of flow to take from each cell edge',
    type: 'slider',
    options: { min: 0, max: 1, step: 0.1 },
  },
  {
    key: 'hydrology.moistureModifier',
    title: 'Moisture Modifier',
    desc: 'Multiplier for cell moisture value',
    type: 'slider',
    options: { min: -1, max: 1, step: 0.05 },
  },

  // geology
  {
    key: 'geology.numberPlates',
    title: 'Number of Plates',
    desc: 'Number of plates to generate',
    type: 'integer',
    options: { min: 0, max: 100 },
  },
  {
    key: 'geology.oceanPlatePercent',
    title: 'Ocean Plate Percent',
    desc: 'Percentage of each plate that is ocean',
    type: 'slider',
    options: { min: 0, max: 1, step: 0.1 },
  },
  {
    key: 'geology.plateCollisionThreshold',
    title: 'Plate Collision Threshold',
    desc: 'Threshold that plate collisions must reach to have an impact on height. Lower value creates more land at plate boundaries, higher creates less.',
    type: 'slider',
    options: { min: 0, max: 1, step: 0.1 },
  },
  {
    key: 'geology.terrainRoughness',
    title: 'Terrain Roughness',
    desc: 'Roughness value of the terrain generator',
    type: 'slider',
    options: { min: 0, max: 1, step: 0.05 },
  },
  {
    key: 'geology.heightModifier',
    title: 'Height Modifier',
    desc: 'Amount to add to the height at each cell',
    type: 'slider',
    options: { min: -1, max: 1, step: 0.05 },
  },

  // climate
  {
    key: 'climate.temperatureModifier',
    title: 'Temperature Modifier',
    desc: 'Multiplier for cell temperature value',
    type: 'slider',
    options: { min: -1, max: 1, step: 0.05 },
  },
];

const DRAW_OPTIONS: ControlDef[] = [
  {
    key: 'grid',
    title: 'Draw grid',
    type: 'boolean',
    desc: 'Draws grids on cell edges',
  },
  {
    key: 'plateVectors',
    title: 'Draw plate vectors',
    type: 'boolean',
    desc: 'Draws a vector line at each cell pointing in the direction of that cell\'s plate',
  },
  {
    key: 'plateBorders',
    title: 'Draw plate borders',
    type: 'boolean',
    desc: 'Draws a plate border in white',
  },
  {
    key: 'cellCenters',
    title: 'Draw cell centers',
    type: 'boolean',
    desc: 'Draws a small dot in the center of each cell at it\'s cell centroid point',
  },
  {
    key: 'rivers',
    title: 'Draw rivers',
    type: 'boolean',
    desc: 'Draws blue rivers on cell edges where they exist',
  },
  {
    key: 'surface',
    title: 'Draw surface',
    type: 'boolean',
    desc: 'Draws the planet surface',
  },
  {
    key: 'regions',
    title: 'Draw cell groups',
    type: 'boolean',
    desc: 'Draws cell groups',
  },
  {
    key: 'coastline',
    title: 'Draw coastline',
    type: 'boolean',
    desc: 'Draws border on coastline',
  }
]

export const Controls = ({ manager }: { manager: GlobeManager }) => {
  const globeOptions = useObservable(manager.globeOptions$, manager.globeOptions$.value);
  const [globeOptionsForm, setGlobeOptionsForm] = useState(globeOptions);

  const groups = Object.entries(groupBy(GLOBE_OPTIONS, i => i.key.split('.')[0]));

  const AccordionHeader$ = AccordionHeader as any; // this should have the type prop

  return (
    <form
      onSubmit={event => {
        manager.globeOptions$.next(globeOptionsForm);
        event.preventDefault();
      }}
    >
      <Accordion pt={5} pb={5}>
        {groups.map(([group, items]) => (
          <AccordionItem key={group}>
            <AccordionHeader$ type="button">{categoryTitles[group]}</AccordionHeader$>
            <AccordionPanel>
              {items.map(({ title, desc, type, key, options }) => {
                const Renderer = controlTypes[type];
                return (
                  <Field key={key} title={title} desc={desc}>
                    <Renderer
                      key={key}
                      onChange={value => {
                        setGlobeOptionsForm(set(Object.assign({}, globeOptionsForm), key, value));
                      }}
                      value={get(globeOptionsForm, key)}
                      options={options  || {}}
                    />
                  </Field>
                );
              })}
            </AccordionPanel>
          </AccordionItem>
        ))}
      </Accordion>

      <Button type="submit" size="lg" width="100%" variantColor="blue">
        Generate
      </Button>
      <Stack isInline mt={5}>
        <Button
          type="button"
          width="100%"
          size="sm"
          onClick={() => {
            setGlobeOptionsForm(set(Object.assign({}, globeOptionsForm), 'core.seed', random(1000)));
            manager.globeOptions$.next(globeOptionsForm);
          }}
        >
          Randomize Seed
        </Button>
      </Stack>
    </form>
  )
}

export const DrawOptionsTab = () => {
  const manager = useContext(MapManagerContainer.Context);
  const drawOptions = useObservableDict(manager.drawOptions$);
  return (
    <Box pt={5}>
      {DRAW_OPTIONS.map(({ title, type, key, desc, options }) => {
        const Renderer = controlTypes[type];
        return (
          <Field key={key} title={title} desc={desc}>
            <Renderer
              key={key}
              onChange={value => manager.drawOptions$.set(key as keyof IDrawOptions,  value)}
              value={drawOptions[key]}
              options={options  || {}}
            />
          </Field>
        );
      })}
    </Box>
  );
}