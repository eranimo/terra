const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
export function hexToRgb(hex: string): [number, number, number, number] {
  hex = hex.replace(shorthandRegex, (m, r, g, b) => {
      return r + r + g + g + b + b;
  });

  var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? [
    parseInt(result[1], 16) / 255,
    parseInt(result[2], 16) / 255,
    parseInt(result[3], 16) / 255,
    1,
  ] : null;
}

export function hexToNumber(hex: string): number {
  return parseInt(hex.replace(/^#/, ''), 16);
}
