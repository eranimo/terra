import colormap from 'colormap';
import { clamp } from 'lodash';
import { Globe } from './worldgen/Globe';
import { EMapMode } from './types';
import { getUV } from './utils';


interface ICellData {
  roughness: number;
  moisture: number;
  height: number;
  temperature: number;
}

export interface IMapModeColorMap {
  colors: Record<string, any>;
  key: keyof ICellData,
  color: (
    value: number,
    colors: Record<string, { [index: number]: number[] }>,
  ) => number[];
}

export class MapMode {
  surface: {
    xyz: number[];
    rgba: number[];
  }
  minimap: {
    xy: number[];
    rgba: number[][];
  }
  
  constructor(
    public globe: Globe,
    public mapMode: EMapMode,
    mapModeColor: IMapModeColorMap
  ) {
    this.surface = {
      xyz: [],
      rgba: [],
    };
    this.minimap = {
      xy: [],
      rgba: [],
    };
    let values = { roughness: null, moisture: null, height: null, temperature: null };
    const { r_xyz, t_xyz } = globe;
    for (let r = 0; r < this.globe.mesh.numRegions; r++) {

      values.moisture = this.globe.r_moisture[r];
      values.height = this.globe.r_elevation[r];
      values.temperature = this.globe.r_temperature[r];
      values.roughness = this.globe.r_roughness[r] / this.globe.max_roughness;

      const color = mapModeColor.color(values[mapModeColor.key], mapModeColor.colors);
      const sides = [];
      globe.mesh.r_circulate_s(sides, r);
      for (const s of sides) {
        const inner_t = globe.mesh.s_inner_t(s);
        const outer_t = globe.mesh.s_outer_t(s);
        const begin_r = globe.mesh.s_begin_r(s);
        const p1 = [t_xyz[3 * inner_t], t_xyz[3 * inner_t + 1], t_xyz[3 * inner_t + 2]];
        const p2 = [t_xyz[3 * outer_t], t_xyz[3 * outer_t + 1], t_xyz[3 * outer_t + 2]];
        const p3 = [r_xyz[3 * begin_r], r_xyz[3 * begin_r + 1], r_xyz[3 * begin_r + 2]];

        const p1_uv = getUV(p1 as any);
        const p2_uv = getUV(p2 as any);
        const p3_uv = getUV(p3 as any);
        this.surface.xyz.push(...p1, ...p2, ...p3);
        this.surface.rgba.push(
          ...color,
          ...color,
          ...color,
        );
        this.minimap.xy.push(...p1_uv, ...p2_uv, ...p3_uv);
        this.minimap.rgba.push(color, color, color);
      }
    }
  }
}

export const mapModeDefs: Map<EMapMode, IMapModeColorMap> = new Map([
  [EMapMode.ELEVATION, {
    key: 'height',
    colors: {
      earth: colormap({
        colormap: 'earth',
        nshades: 100,
        format: 'float',
        alpha: 1,
      })
    },
    color: (value, colors) => {
      const heightFixed = (value + 1) / 2;
      const index = clamp(Math.round(heightFixed * 100), 0, 99);
      if (colors.earth[index]) {
        return colors.earth[index];
      }
      return [0, 0, 0, 1];
    },
  }],
  [EMapMode.MOISTURE, {
    key: 'moisture',
    colors: {
      main: colormap({
        colormap: 'YiGnBu',
        nshades: 100,
        format: 'float',
        alpha: 1,
      }),
    },
    color: (value, colors) => {
      const moistureFixed = (value + 1) / 2;
      const index = clamp(Math.round(moistureFixed * 100), 0, 99);
      if (colors.main[index]) {
        return colors.main[index];
      }
      return [0, 0, 0, 1];
    },
  }],
  [EMapMode.TEMPERATURE, {
    key: 'temperature',
    colors: {
      main: colormap({
        colormap: 'jet',
        nshades: 100,
        format: 'float',
        alpha: 1,
      }),
    },
    color: (value, colors) => {
      const index = clamp(Math.round(value * 100), 0, 99);
      if (colors.main[index]) {
        return colors.main[index];
      }
      return [0, 0, 0, 1];
    },
  }],
  [EMapMode.ROUGHNESS, {
    key: 'roughness',
    colors: {
      main: colormap({
        colormap: 'bluered',
        nshades: 100,
        format: 'float',
        alpha: 1,
      }),
    },
    color: (value, colors) => {
      const index = clamp(Math.round(value * 100), 0, 99);
      if (colors.main[index]) {
        return colors.main[index];
      }
      return [0, 0, 0, 1];
    },
  }],
]);