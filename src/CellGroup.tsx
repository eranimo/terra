import { Regl } from "regl";
import createLine from 'regl-line';

export interface ICellGroupOptions {
  name: string;
  cells: number[];
  color: number[];
}

export interface ICellGroupData {
  name: string;
  cells_xyz: number[];
  cells_rgba: number[];
  border_points: number[];
  border_widths: number[];
}