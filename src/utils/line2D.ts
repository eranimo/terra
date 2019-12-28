import { Vector3 } from "@babylonjs/core/Maths/math";
import { Scene } from "@babylonjs/core/scene";
import { VertexData } from "@babylonjs/core/Legacy/legacy";
import { Mesh } from "@babylonjs/core/Meshes/mesh";


type Line2DOptions = {
  widths: number[];
  path: Vector3[];
  closed: boolean;
  standardUV: boolean
};

export function line2D(name: string, options: Line2DOptions, scene: Scene) {
  //Arrays for vertex positions and indices
  var positions = [];
  var indices = [];
  var normals = [];
  var widths = options.widths;
  var path = options.path;
  var closed = options.closed || false;
  let standardUV: boolean;
  if (options.standardUV === undefined) {
    standardUV = true;
  } else {
    standardUV = options.standardUV;
  }

  var interiorIndex;

  //Arrays to hold wall corner data
  var innerBaseCorners = [];
  var outerBaseCorners = [];

  var outerData = [];
  var innerData = [];
  var angle = 0;

  var nbPoints = path.length;
  var line = Vector3.Zero();
  var nextLine = Vector3.Zero();
  path[1].subtractToRef(path[0], line);
  var direction;
  var lineNormal;
  var width;

  if (nbPoints > 2 && closed) {
    path[2].subtractToRef(path[1], nextLine);
    for (var p = 0; p < nbPoints; p++) {
      angle = (
        Math.PI -
        Math.acos(
          Vector3.Dot(line, nextLine) /
            (line.length() * nextLine.length())
        )
      );
      direction = Vector3.Cross(line, nextLine).normalize().y;
      lineNormal = new Vector3(-line.z, 0, 1 * line.x).normalize();
      line.normalize();
      width = widths[(p + 1) % nbPoints] / 2;
      innerData[(p + 1) % nbPoints] = path[(p + 1) % nbPoints]
        .subtract(lineNormal.scale(width))
        .subtract(line.scale((direction * width) / Math.tan(angle / 2)));
      outerData[(p + 1) % nbPoints] = path[(p + 1) % nbPoints]
        .add(lineNormal.scale(width))
        .add(line.scale((direction * width) / Math.tan(angle / 2)));
      line = nextLine.clone();
      path[(p + 3) % nbPoints].subtractToRef(
        path[(p + 2) % nbPoints],
        nextLine
      );
    }
  } else {
    lineNormal = new Vector3(-line.z, 0, 1 * line.x).normalize();
    line.normalize();
    let width = widths[0] / 2;
    innerData[0] = path[0].subtract(lineNormal.scale(width));
    outerData[0] = path[0].add(lineNormal.scale(width));

    for (var p = 0; p < nbPoints - 2; p++) {
      path[p + 2].subtractToRef(path[p + 1], nextLine);
      angle =
        Math.PI -
        Math.acos(
          Vector3.Dot(line, nextLine) /
            (line.length() * nextLine.length())
        );
      direction = Vector3.Cross(line, nextLine).normalize().y;
      lineNormal = new Vector3(-line.z, 0, 1 * line.x).normalize();
      line.normalize();
      width = widths[p + 1] / 2;
      innerData[p + 1] = path[p + 1]
        .subtract(lineNormal.scale(width))
        .subtract(line.scale((direction * width) / Math.tan(angle / 2)));
      outerData[p + 1] = path[p + 1]
        .add(lineNormal.scale(width))
        .add(line.scale((direction * width) / Math.tan(angle / 2)));
      line = nextLine.clone();
    }
    if (nbPoints > 2) {
      path[nbPoints - 1].subtractToRef(path[nbPoints - 2], line);
      lineNormal = new Vector3(-line.z, 0, 1 * line.x).normalize();
      line.normalize();
      width = widths[nbPoints - 1] / 2;
      innerData[nbPoints - 1] = path[nbPoints - 1].subtract(
        lineNormal.scale(width)
      );
      outerData[nbPoints - 1] = path[nbPoints - 1].add(lineNormal.scale(width));
    } else {
      width = widths[1] / 2;
      innerData[1] = path[1].subtract(lineNormal.scale(width));
      outerData[1] = path[1].add(lineNormal.scale(width));
    }
  }

  var maxX = Number.MIN_VALUE;
  var minX = Number.MAX_VALUE;
  var maxZ = Number.MIN_VALUE;
  var minZ = Number.MAX_VALUE;

  for (var p = 0; p < nbPoints; p++) {
    positions.push(innerData[p].x, innerData[p].y, innerData[p].z);
    maxX = Math.max(innerData[p].x, maxX);
    minX = Math.min(innerData[p].x, minX);
    maxZ = Math.max(innerData[p].z, maxZ);
    minZ = Math.min(innerData[p].z, minZ);
  }

  for (var p = 0; p < nbPoints; p++) {
    positions.push(outerData[p].x, outerData[p].y, outerData[p].z);
    maxX = Math.max(innerData[p].x, maxX);
    minX = Math.min(innerData[p].x, minX);
    maxZ = Math.max(innerData[p].z, maxZ);
    minZ = Math.min(innerData[p].z, minZ);
  }

  for (var i = 0; i < nbPoints - 1; i++) {
    indices.push(i, i + 1, nbPoints + i + 1);
    indices.push(i, nbPoints + i + 1, nbPoints + i);
  }

  if (nbPoints > 2 && closed) {
    indices.push(nbPoints - 1, 0, nbPoints);
    indices.push(nbPoints - 1, nbPoints, 2 * nbPoints - 1);
  }

  var normals = [];
  var uvs = [];

  if (standardUV) {
    for (var p = 0; p < positions.length; p += 3) {
      uvs.push(
        (positions[p] - minX) / (maxX - minX),
        (positions[p + 2] - minZ) / (maxZ - minZ)
      );
    }
  } else {
    var flip = 0;
    var p1 = 0;
    var p2 = 0;
    var p3 = 0;
    var v0 = innerData[0];
    var v1 = innerData[1].subtract(v0);
    var v2 = outerData[0].subtract(v0);
    var v3 = outerData[1].subtract(v0);
    var axis = v1.clone();
    axis.normalize();

    p1 = Vector3.Dot(axis, v1);
    p2 = Vector3.Dot(axis, v2);
    p3 = Vector3.Dot(axis, v3);
    var minX = Math.min(0, p1, p2, p3);
    var maxX = Math.max(0, p1, p2, p3);

    uvs[2 * indices[0]] = -minX / (maxX - minX);
    uvs[2 * indices[0] + 1] = 1;
    uvs[2 * indices[5]] = (p2 - minX) / (maxX - minX);
    uvs[2 * indices[5] + 1] = 0;

    uvs[2 * indices[1]] = (p1 - minX) / (maxX - minX);
    uvs[2 * indices[1] + 1] = 1;
    uvs[2 * indices[4]] = (p3 - minX) / (maxX - minX);
    uvs[2 * indices[4] + 1] = 0;

    for (var i = 6; i < indices.length; i += 6) {
      flip = (flip + 1) % 2;
      v0 = innerData[0];
      v1 = innerData[1].subtract(v0);
      v2 = outerData[0].subtract(v0);
      v3 = outerData[1].subtract(v0);
      axis = v1.clone();
      axis.normalize();

      p1 = Vector3.Dot(axis, v1);
      p2 = Vector3.Dot(axis, v2);
      p3 = Vector3.Dot(axis, v3);
      var minX = Math.min(0, p1, p2, p3);
      var maxX = Math.max(0, p1, p2, p3);

      uvs[2 * indices[i + 1]] =
        flip + (Math.cos(flip * Math.PI) * (p1 - minX)) / (maxX - minX);
      uvs[2 * indices[i + 1] + 1] = 1;
      uvs[2 * indices[i + 4]] =
        flip + (Math.cos(flip * Math.PI) * (p3 - minX)) / (maxX - minX);
      uvs[2 * indices[i + 4] + 1] = 0;
    }
  }

  VertexData.ComputeNormals(positions, indices, normals);
  VertexData._ComputeSides(
    Mesh.DOUBLESIDE,
    positions,
    indices,
    normals,
    uvs
  );
  //Create a custom mesh
  var customMesh = new Mesh(name, scene);

  //Create a vertexData object
  var vertexData = new VertexData();

  //Assign positions and indices to vertexData
  vertexData.positions = positions;
  vertexData.indices = indices;
  vertexData.normals = normals;
  vertexData.uvs = uvs;

  //Apply vertexData to custom mesh
  vertexData.applyToMesh(customMesh);

  return customMesh;
}
