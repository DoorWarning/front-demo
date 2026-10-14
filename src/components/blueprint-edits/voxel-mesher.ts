import * as THREE from 'three';

// Minecraft-style meshing: only faces that touch air are emitted, and each vertex gets an
// ambient-occlusion brightness from the three cells around that corner.

export interface MeshCell {
  x: number;
  y: number;
  z: number;
  blockId: number;
}

export interface MeshOptions {
  /** Cells that hide a neighbor's face when they sit next to it. */
  hidesFace: (cell: MeshCell, neighbor: MeshCell) => boolean;
  /** Cells that darken corners next to them. */
  occludes: (neighbor: MeshCell) => boolean;
  /** Base color for a cell; multiplied by the AO brightness. */
  colorOf: (cell: MeshCell, cellIndex: number) => THREE.Color;
}

export interface VoxelMesh {
  geometry: THREE.BufferGeometry;
  /** Triangle index / 2 -> index into the cells passed in. */
  faceCells: number[];
}

// Strip textures hold six 32px faces in BoxGeometry face order [+X, -X, +Y, -Y, +Z, -Z].
const FACE_COUNT = 6;
// Corner brightness by number of occluding neighbors (0 = fully open).
const AO_LEVELS = [1, 0.8, 0.66, 0.52];

interface FaceTemplate {
  normal: THREE.Vector3;
  corners: THREE.Vector3[];
  uvs: THREE.Vector2[];
}

// Read faces from BoxGeometry so texture orientation matches three.js exactly.
const FACE_TEMPLATES: FaceTemplate[] = (() => {
  const box = new THREE.BoxGeometry(1, 1, 1);
  const position = box.getAttribute('position');
  const normal = box.getAttribute('normal');
  const uv = box.getAttribute('uv');
  const vec3 = (attribute: typeof position, i: number) =>
    new THREE.Vector3(attribute.getX(i), attribute.getY(i), attribute.getZ(i));
  const faces = Array.from({ length: FACE_COUNT }, (_, face) => {
    const start = face * 4;
    return {
      normal: vec3(normal, start),
      corners: [0, 1, 2, 3].map((i) => vec3(position, start + i)),
      uvs: [0, 1, 2, 3].map((i) => new THREE.Vector2(uv.getX(start + i), uv.getY(start + i))),
    };
  });
  box.dispose();
  return faces;
})();

const keyOf = (x: number, y: number, z: number) => `${x},${y},${z}`;

export function buildCellLookup(cells: MeshCell[]): Map<string, MeshCell> {
  return new Map(cells.map((cell) => [keyOf(cell.x, cell.y, cell.z), cell]));
}

/**
 * Builds one merged mesh for `cells`, checking neighbors against `lookup`
 * (which may hold more cells than are being drawn, e.g. other block types).
 */
export function buildVoxelMesh(
  cells: MeshCell[],
  lookup: Map<string, MeshCell>,
  options: MeshOptions,
): VoxelMesh {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const faceCells: number[] = [];

  const occludedAt = (x: number, y: number, z: number) => {
    const neighbor = lookup.get(keyOf(x, y, z));
    return neighbor !== undefined && options.occludes(neighbor) ? 1 : 0;
  };

  cells.forEach((cell, cellIndex) => {
    const base = options.colorOf(cell, cellIndex);
    FACE_TEMPLATES.forEach((face, faceIndex) => {
      const n = face.normal;
      const neighbor = lookup.get(keyOf(cell.x + n.x, cell.y + n.y, cell.z + n.z));
      if (neighbor && options.hidesFace(cell, neighbor)) {
        return;
      }

      const ao = face.corners.map((corner) => {
        // The two in-plane directions pointing toward this corner.
        const sideA = new THREE.Vector3();
        const sideB = new THREE.Vector3();
        if (n.x !== 0) {
          sideA.set(0, Math.sign(corner.y), 0);
          sideB.set(0, 0, Math.sign(corner.z));
        } else if (n.y !== 0) {
          sideA.set(Math.sign(corner.x), 0, 0);
          sideB.set(0, 0, Math.sign(corner.z));
        } else {
          sideA.set(Math.sign(corner.x), 0, 0);
          sideB.set(0, Math.sign(corner.y), 0);
        }
        const ox = cell.x + n.x;
        const oy = cell.y + n.y;
        const oz = cell.z + n.z;
        const a = occludedAt(ox + sideA.x, oy + sideA.y, oz + sideA.z);
        const b = occludedAt(ox + sideB.x, oy + sideB.y, oz + sideB.z);
        const c = occludedAt(
          ox + sideA.x + sideB.x,
          oy + sideA.y + sideB.y,
          oz + sideA.z + sideB.z,
        );
        return a && b ? 3 : a + b + c;
      });

      const vertexStart = positions.length / 3;
      face.corners.forEach((corner, i) => {
        positions.push(cell.x + corner.x, cell.y + corner.y, cell.z + corner.z);
        normals.push(n.x, n.y, n.z);
        uvs.push((faceIndex + face.uvs[i].x) / FACE_COUNT, face.uvs[i].y);
        const brightness = AO_LEVELS[ao[i]];
        colors.push(base.r * brightness, base.g * brightness, base.b * brightness);
      });

      // BoxGeometry corners form a 2x2 grid (0 1 / 2 3). Split along the less occluded diagonal so
      // a single dark corner fades evenly instead of streaking across the face.
      const [v0, v1, v2, v3] = [0, 1, 2, 3].map((i) => vertexStart + i);
      if (ao[0] + ao[3] > ao[1] + ao[2]) {
        indices.push(v0, v2, v1, v2, v3, v1);
      } else {
        indices.push(v0, v2, v3, v0, v3, v1);
      }
      faceCells.push(cellIndex);
    });
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  return { geometry, faceCells };
}
