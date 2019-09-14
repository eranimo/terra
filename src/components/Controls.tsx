import React, { useState } from 'react';
import { GameManager } from "../GameManager";
import { Input } from "./Input";
import { Field } from "./Field";
import { Tabs } from "./Tabs";
import { drawModeTitles, mapModeTitles, IGlobeOptions, IDrawOptions } from '../types';
import { useObservableDictKey, useObservable, useObservableDict } from '../utils/hooks';


interface IControlOptions {
  min?: number;
  max?: number;
  step?: number;
  options?: { [key: string]: any }
}
interface IControlProps {
  value: any;
  onChange: (value: any) => any;
  options?: IControlOptions;
}
const controlTypes: Record<string, React.FC<IControlProps>> = {
  string: ({ value, onChange }) => (
    <Input
      type="text"
      value={value}
      onChange={event => onChange(event.target.value)}
    />
  ),
  select: ({ value, onChange, options }) => (
    <select
      value={value}
      onChange={event => onChange(event.target.value as any)}
    >
      {Object.entries(options.options).map(([key, title]) => (
        <option key={title} value={key}>{title}</option>
      ))}
    </select>
  ),
  boolean: ({ value, onChange }) => (
    <input
      type="checkbox"
      checked={value}
      onChange={event => onChange(event.target.checked)}
    />
  ),
  integer: ({ value, onChange, options }) => (
    <input
      type="number"
      value={value}
      min={options.min}
      max={options.max}
      step={options.step}
      onChange={event => onChange(parseInt(event.target.value, 10))}
    />
  ),
  float: ({ value, onChange, options }) => (
    <input
      type="number"
      value={value}
      min={options.min}
      max={options.max}
      step={options.step}
      onChange={event => onChange(parseFloat(event.target.value))}
    />
  ),
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
    key: 'seed',
    title: 'Seed',
    type: 'integer',
    desc: 'Seed for the random number generator',
  },
  {
    key: 'numberCells',
    title: 'Number of cells',
    type: 'integer',
    desc: 'Number of cells in the world',
    options: { min: 0, max: 100_000 },
  },
  {
    key: 'jitter',
    title: 'Cell Jitter',
    desc: 'Maximum random jitter for cell vertices, in spherical space',
    type: 'integer',
    options: { min: 0, max: 1, step: 0.05 },
  },
  {
    key: 'numberPlates',
    title: 'Number of Plates',
    desc: 'Number of plates to generate',
    type: 'integer',
  },
  {
    key: 'flowModifier',
    title: 'Flow modifier',
    desc: 'What percentage of flow to take from each cell edge',
    type: 'float',
    options: { min: 0, max: 1, step: 0.1 },
  },
  {
    key: 'oceanPlatePercent',
    title: 'Ocean Plate Percent',
    desc: 'Percentage of each plate that is ocean',
    type: 'float',
    options: { min: 0, max: 1, step: 0.1 },
  },
  {
    key: 'protrudeHeight',
    title: 'Protrude Height',
    desc: 'Amount of height (in 3D coordinate space) to protrude from the sphere to represent altitude',
    type: 'float',
    options: { min: 0, max: 1, step: 0.05 },
  },
  {
    key: 'terrainRoughness',
    title: 'Terrain Roughness',
    desc: 'Roughness value of the terrain generator',
    type: 'float',
    options: { min: 0, max: 1, step: 0.1 },
  },
  {
    key: 'heightModifier',
    title: 'Height Modifier',
    desc: 'Amount to add to the height at each cell',
    type: 'float',
    options: { min: -1, max: 1, step: 0.1 },
  },
];

const DRAW_OPTIONS: ControlDef[] = [
  {
    key: 'drawMode',
    title: 'Draw mode',
    type: 'select',
    desc: 'Changes the drawing method for planet surfaces',
    options: { options: drawModeTitles, }
  },
  {
    key: 'mapMode',
    title: 'Map mode',
    type: 'select',
    desc: 'Changes the current mode view, which show important statistics',
    options: { options: mapModeTitles, }
  },
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
]

export function Controls({ manager }: {
  manager: GameManager;
}) {
  const globeOptions = useObservable(manager.globeOptions$, manager.globeOptions$.value);
  const [globeOptionsForm, setGlobeOptionsForm] = useState(globeOptions);

  const drawOptions = useObservableDict(manager.drawOptions$);

  return (
    <div id="controls">
      <h1>Terra</h1>
      <Tabs>
        {() => ({
          generate: {
            title: 'Map options',
            render: () => (
              <form
                onSubmit={event => {
                  manager.globeOptions$.next(globeOptionsForm);
                  event.preventDefault();
                }}
              >
                {GLOBE_OPTIONS.map(({ title, desc, type, key, options }) => {
                  const Renderer = controlTypes[type];
                  return (
                    <Field title={title} key={title} desc={desc}>
                      <Renderer
                        onChange={value => setGlobeOptionsForm({
                          ...globeOptionsForm,
                          [key as keyof IGlobeOptions]: value
                        })}
                        value={globeOptionsForm[key]}
                        options={options  || {}}
                      />
                    </Field>
                  );
                })}
                <Field>
                  <button type="submit">
                    Generate
                  </button>
                </Field>
              </form>
            )
          },
          render: {
            title: 'Draw options',
            render: () => (
              <div>
                {DRAW_OPTIONS.map(({ title, type, key, desc, options }) => {
                  const Renderer = controlTypes[type];
                  return (
                    <Field title={title} key={title} desc={desc}>
                      <Renderer
                        onChange={value => manager.drawOptions$.set(key as keyof IDrawOptions,  value)}
                        value={drawOptions[key]}
                        options={options  || {}}
                      />
                    </Field>
                  );
                })}
              </div>
            ),
          }
        })}
      </Tabs>
    </div>
  );
}
