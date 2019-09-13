/*
 * From http://www.redblobgames.com/x/1742-webgl-mapgen2/
 * Copyright 2017 Red Blob Games <redblobgames@gmail.com>
 * License: Apache v2.0 <http://www.apache.org/licenses/LICENSE-2.0.html>
 * 
 * Converted to Typescript by Kaelan Cooter <me@kaelan.org>
 */

/* Generate the biome colormap indexed by elevation -1:+1 and rainfall 0:1 */
export const width = 64;
export const height = 64;

function Colormap() {
  const pixels = new Uint8Array(width * height * 4);

  for (var y = 0, p = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let e = 2 * x / width - 1,
        m = y / height;

      let r, g, b;

      if (x === width / 2 - 3) {
        r = 48;
        g = 80;
        b = 140;
      } else if (e < 0.0) {
        r = 48 + 48 * e;
        g = 64 + 64 * e;
        b = 127 + 127 * e;
      } else { // adapted from terrain-from-noise article
        m = m * (1 - e); // higher elevation holds less moisture; TODO: should be based on slope, not elevation

        r = 210 - 100 * m;
        g = 185 - 45 * m;
        b = 139 - 45 * m;
        r = 255 * e + r * (1 - e);
        g = 255 * e + g * (1 - e);
        b = 255 * e + b * (1 - e);
      }

      pixels[p++] = r;
      pixels[p++] = g;
      pixels[p++] = b;
      pixels[p++] = 255;
    }
  }
  return pixels;
}

export const data = Colormap();
