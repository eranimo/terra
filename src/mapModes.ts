import colormap from 'colormap';
import { clamp } from 'lodash';
import { Globe } from './Globe';
import { EMapMode } from './types';


export interface IMapModeColorMap {
  colors: Record<string, any>;
  color: (values: {
    moisture: number,
    height: number,
    temperature: number
  }, colors) => number[];
}

export class MapMode {
  xyz: number[];
  rgba: number[];
  
  constructor(
    public globe: Globe,
    public mapMode: EMapMode,
    mapModeColor: IMapModeColorMap
  ) {
    this.xyz = [];
    this.rgba = [];
    let values = { moisture: null, height: null, temperature: null };
    const { r_xyz, t_xyz } = globe;
    for (let r = 0; r < this.globe.mesh.numRegions; r++) {
      values.moisture = this.globe.r_moisture[r];
      values.height = this.globe.r_elevation[r];
      values.temperature = this.globe.r_temperature[r];
      const color = mapModeColor.color(values, mapModeColor.colors);
      const sides = [];
      globe.mesh.r_circulate_s(sides, r);
      for (const s of sides) {
        const inner_t = globe.mesh.s_inner_t(s);
        const outer_t = globe.mesh.s_outer_t(s);
        const begin_r = globe.mesh.s_begin_r(s);
        this.xyz.push(
          t_xyz[3 * inner_t], t_xyz[3 * inner_t + 1], t_xyz[3 * inner_t + 2],
          t_xyz[3 * outer_t], t_xyz[3 * outer_t + 1], t_xyz[3 * outer_t + 2],
          r_xyz[3 * begin_r], r_xyz[3 * begin_r + 1], r_xyz[3 * begin_r + 2],
        )
        this.rgba.push(
          ...color,
          ...color,
          ...color,
        );
      }
    }
  }
}

export const mapModeDefs: Map<EMapMode, IMapModeColorMap> = new Map([
  [EMapMode.ELEVATION, {
    colors: {
      earth: colormap({
        colormap: 'earth',
        nshades: 100,
        format: 'float',
        alpha: 1,
      })
    },
    color: ({ height }, colors) => {
      const heightFixed = (height + 1) / 2;
      const index = clamp(Math.round(heightFixed * 100), 0, 99);
      if (colors.earth[index]) {
        return colors.earth[index];
      }
      return [0, 0, 0, 1];
    },
  }],
  [EMapMode.MOISTURE, {
    colors: {
      main: colormap({
        colormap: 'YiGnBu',
        nshades: 100,
        format: 'float',
        alpha: 1,
      }),
    },
    color: ({ moisture }, colors) => {
      const moistureFixed = (moisture + 1) / 2;
      const index = clamp(Math.round(moistureFixed * 100), 0, 99);
      if (colors.main[index]) {
        return colors.main[index];
      }
      return [0, 0, 0, 1];
    },
  }],
  [EMapMode.TEMPERATURE, {
    colors: {
      main: colormap({
        colormap: 'jet',
        nshades: 100,
        format: 'float',
        alpha: 1,
      }),
    },
    color: ({ temperature }, colors) => {
      const index = clamp(Math.round(temperature * 100), 0, 99);
      if (colors.main[index]) {
        return colors.main[index];
      }
      return [0, 0, 0, 1];
    },
  }],
]);