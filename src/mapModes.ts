import colormap from 'colormap';
import { clamp } from 'lodash';
import { Globe } from './worldgen/Globe';
import { EMapMode, biomeColors } from './types';
import { getUV } from './utils';


interface ICellData {
  biome: number;
  roughness: number;
  moisture: number;
  height: number;
  temperature: number;
}

export interface IMapModeColorMap {
  colors?: Record<string, any>;
  key: keyof ICellData,
  color: (
    value: number,
    colors: Record<string, { [index: number]: number[] }>,
  ) => number[];
}

interface IMapModeMesh {
  surface: {
    xyz: number[];
    rgba: number[];
  };
  minimap: {
    xy: number[];
    rgba: number[][];
  };
}

// TODO: improve performance by not copying xyz for each map mode
export const buildMapModeMeshes = (
  globe: Globe
): Record<EMapMode, IMapModeMesh> => {
  const mapModes = {};
  for (const [mapMode, def] of mapModeDefs) {
    mapModes[mapMode] = {
      surface: {
        xyz: [],
        rgba: [],
      },
      minimap: {
        xy: [],
        rgba: [],
      }
    };
  }
  let values = { biome: null, roughness: null, moisture: null, height: null, temperature: null };
  const { minimap_r_xyz, minimap_t_xyz, r_xyz, t_xyz } = globe;

  for (let r = 0; r < globe.mesh.numRegions; r++) {
    values.biome = globe.r_biome[r];
    values.moisture = globe.r_moisture[r];
    values.height = globe.r_elevation[r];
    values.temperature = globe.r_temperature[r];
    values.roughness = globe.r_roughness[r] / globe.max_roughness;

    const sides = [];
    globe.mesh.r_circulate_s(sides, r);
    let numSides = 0;
    const xyz = [];
    const xy = [];

    for (const s of sides) {
      const inner_t = globe.mesh.s_inner_t(s);
      const outer_t = globe.mesh.s_outer_t(s);
      const begin_r = globe.mesh.s_begin_r(s);
      const p1 = [t_xyz[3 * inner_t], t_xyz[3 * inner_t + 1], t_xyz[3 * inner_t + 2]];
      const p2 = [t_xyz[3 * outer_t], t_xyz[3 * outer_t + 1], t_xyz[3 * outer_t + 2]];
      const p3 = [r_xyz[3 * begin_r], r_xyz[3 * begin_r + 1], r_xyz[3 * begin_r + 2]];

      const p1m = [minimap_t_xyz[3 * inner_t], minimap_t_xyz[3 * inner_t + 1], minimap_t_xyz[3 * inner_t + 2]];
      const p2m = [minimap_t_xyz[3 * outer_t], minimap_t_xyz[3 * outer_t + 1], minimap_t_xyz[3 * outer_t + 2]];
      const p3m = [minimap_r_xyz[3 * begin_r], minimap_r_xyz[3 * begin_r + 1], minimap_r_xyz[3 * begin_r + 2]];

      const p1_uv = getUV(p1m as any);
      const p2_uv = getUV(p2m as any);
      const p3_uv = getUV(p3m as any);

      xyz.push(...p1, ...p2, ...p3);
      xy.push(...p1_uv, ...p2_uv, ...p3_uv);
      numSides++;
    }

    for (const [mapMode, def] of mapModeDefs) {
      const color = def.color(values[def.key], def.colors);
      mapModes[mapMode].minimap.xy.push(...xy);
      mapModes[mapMode].surface.xyz.push(...xyz);
      for (let s = 0; s < numSides; s++) {
        mapModes[mapMode].surface.rgba.push(...color, ...color, ...color);
      }
      for (let s = 0; s < numSides; s++) {
        mapModes[mapMode].minimap.rgba.push(color, color, color);
      }
    }
  }
  return mapModes as Record<EMapMode, IMapModeMesh>;
}

export const mapModeDefs: Map<EMapMode, IMapModeColorMap> = new Map([
  [EMapMode.ELEVATION, {
    key: 'height',
    colors: {
      water: colormap({
        colormap: 'bathymetry',
        nshades: 100,
        format: 'float',
        alpha: 1,
      }),
      land: colormap({
        colormap: 'chlorophyll',
        nshades: 100,
        format: 'float',
        alpha: 1,
      })
    },
    color: (value, colors) => {
      if (value < 0) {
        const heightFixed = 1 - Math.abs(value);
        const index = clamp(Math.round(heightFixed * 100), 0, 99);
        if (colors.water[index]) {
          return colors.water[index];
        }
      } else {
        const index = clamp(Math.round(value * 100), 0, 99);
        if (colors.land[index]) {
          return colors.land[index];
        }
      }
      return [0, 0, 0, 1];
    },
  }],
  [EMapMode.MOISTURE, {
    key: 'moisture',
    colors: {
      main: colormap({
        colormap: 'cool',
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
  [EMapMode.BIOME, {
    key: 'biome',
    color: (value) => {
      return biomeColors[value] || [0, 0, 0, 1];
    },
  }],
]);