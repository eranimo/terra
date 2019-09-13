import React from 'react';
import { GameManager } from "../GameManager";
import { Input } from "./Input";
import { Field } from "./Field";
import { Tabs } from "./Tabs";
import { drawModeTitles, mapModeTitles } from '../types';
import { useObservableDict } from '../utils/hooks';


export function Controls({ manager }: {
  manager: GameManager;
}) {
  const seed = useObservableDict(manager.options$, 'seed');
  const cells = useObservableDict(manager.options$, 'numberCells');
  const jitter = useObservableDict(manager.options$, 'jitter');
  const plates = useObservableDict(manager.options$, 'numberPlates');
  const flowModifier = useObservableDict(manager.options$, 'flowModifier');
  const oceanPlatePercent = useObservableDict(manager.options$, 'oceanPlatePercent');
  const protrudeHeight = useObservableDict(manager.options$, 'protrudeHeight');
  const terrainRoughness = useObservableDict(manager.options$, 'terrainRoughness');
  const heightModifier = useObservableDict(manager.options$, 'heightModifier');

  const drawMode = useObservableDict(manager.drawOptions$, 'drawMode');
  const mapMode = useObservableDict(manager.drawOptions$, 'mapMode');
  const drawGrid = useObservableDict(manager.drawOptions$, 'grid');
  const drawPlateVectors = useObservableDict(manager.drawOptions$, 'plateVectors');
  const drawPlateBorders = useObservableDict(manager.drawOptions$, 'plateBorders');
  const drawCellCenters = useObservableDict(manager.drawOptions$, 'cellCenters');
  const drawRivers = useObservableDict(manager.drawOptions$, 'rivers');
  const drawSurface = useObservableDict(manager.drawOptions$, 'surface');
  const drawRegions = useObservableDict(manager.drawOptions$, 'regions');

  return (
    <div id="controls">
      <h1>Terra</h1>
      <Tabs>
        {() => ({
          generate: {
            title: 'Map options',
            render: () => (<div>
              <Field title="Seed">
                <Input type="number" value={seed} onChange={value => manager.options$.set('seed', value)} />
              </Field>

              <Field title="Number of Cells">
                <Input type="number" value={cells} min={0} onChange={value => manager.options$.set('numberCells', parseInt(value, 10))} />
              </Field>

              <Field title="Cell Jitter">
                <Input type="number" value={jitter} min={0} max={1} step={0.05} onChange={value => manager.options$.set('jitter', value)} />
              </Field>

              <Field title="Number of Plates">
                <Input type="number" value={plates} min={0} onChange={value => manager.options$.set('numberPlates', parseInt(value, 10))} />
              </Field>

              <Field title="Flow modifier">
                <Input type="number" value={flowModifier} min={0} max={1} step={0.1} onChange={value => manager.options$.set('flowModifier', value)} />
              </Field>

              <Field title="Ocean Plate Percent">
                <Input type="number" value={oceanPlatePercent} min={0} max={1} step={0.1} onChange={value => manager.options$.set('oceanPlatePercent', value)} />
              </Field>
              <Field title="Protrude Height">
                <Input type="number" value={protrudeHeight} min={0} max={1} step={0.1} onChange={value => manager.options$.set('protrudeHeight', value)} />
              </Field>
              <Field title="Terrain Roughness">
                <Input type="number" value={terrainRoughness} min={0} max={1} step={0.1} onChange={value => manager.options$.set('terrainRoughness', parseFloat(value))} />
              </Field>
              <Field title="Height Modifier">
                <Input type="number" value={heightModifier} min={0} max={1} step={0.1} onChange={value => manager.options$.set('heightModifier', parseFloat(value))} />
              </Field>
            </div>)
          },
          render: {
            title: 'Draw options',
            render: () => (<div>
              <Field title="Draw Mode">
                <select value={drawMode} onChange={event => manager.drawOptions$.set('drawMode', event.target.value as any)}>
                  {Object.entries(drawModeTitles).map(([drawMode, title]) => (<option key={title} value={drawMode}>{title}</option>))}
                </select>
              </Field>
              <Field title="Map Mode">
                <select value={mapMode} onChange={event => manager.drawOptions$.set('mapMode', event.target.value as any)}>
                  {Object.entries(mapModeTitles).map(([mapMode, title]) => (<option key={title} value={mapMode}>{title}</option>))}
                </select>
              </Field>
              <Field title="Draw Grid">
                <input type="checkbox" checked={drawGrid} onChange={event => manager.drawOptions$.set('grid', event.target.checked)} />
              </Field>

              <Field title="Draw Plate Borders">
                <input type="checkbox" checked={drawPlateBorders} onChange={event => manager.drawOptions$.set('plateBorders', event.target.checked)} />
              </Field>

              <Field title="Draw Plate Vectors">
                <input type="checkbox" checked={drawPlateVectors} onChange={event => manager.drawOptions$.set('plateVectors', event.target.checked)} />
              </Field>

              <Field title="Draw Cell Centers">
                <input type="checkbox" checked={drawCellCenters} onChange={event => manager.drawOptions$.set('cellCenters', event.target.checked)} />
              </Field>

              <Field title="Draw Rivers">
                <input type="checkbox" checked={drawRivers} onChange={event => manager.drawOptions$.set('rivers', event.target.checked)} />
              </Field>

              <Field title="Draw Surface">
                <input type="checkbox" checked={drawSurface} onChange={event => manager.drawOptions$.set('surface', event.target.checked)} />
              </Field>

              <Field title="Draw Regions">
                <input type="checkbox" checked={drawRegions} onChange={event => manager.drawOptions$.set('regions', event.target.checked)} />
              </Field>
            </div>)
          }
        })}
      </Tabs>
    </div>
  );
}
