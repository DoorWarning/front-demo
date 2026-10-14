'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

import { cn } from '@/lib/utils';
import type { BlueprintDetail } from '@/types/blueprint-edits';

import { buildCellLookup, buildVoxelMesh, type MeshCell } from './voxel-mesher';

export type ViewMode = 'texture' | 'heatmap';

export interface HoveredCell {
  kind: 'base' | 'added';
  blockName: string;
  /** digCount for base cells, placeCount for added cells. */
  count: number;
  /** digRuns for base cells, placeRuns for added cells. */
  runs: number;
  position: [number, number, number];
  screenX: number;
  screenY: number;
}

interface VoxelViewerProps {
  detail: BlueprintDetail;
  mode: ViewMode;
  showAdded: boolean;
  onHover: (cell: HoveredCell | null) => void;
  className?: string;
}

const TEXTURE_BASE = '/blueprint-edits/textures/';
// Strip textures: six 32px faces in BoxGeometry material order [+X, -X, +Y, -Y, +Z, -Z].
const FACE_COUNT = 6;
// Keeps faintly edited cells visibly different from untouched ones.
const MIN_HEAT = 0.2;
// Added cells are drawn slightly smaller so they read as "not part of the blueprint".
const ADDED_SCALE = 0.88;

interface HitTarget {
  object: THREE.Mesh;
  kind: 'base' | 'added';
  /** Maps a raycast hit to an index into detail.voxels or detail.added. */
  indexOf: (hit: THREE.Intersection) => number | undefined;
}

interface Disposable {
  dispose: () => void;
}

/** Resolves a CSS color token (any syntax, including oklch) to a three.js color via a 1px canvas. */
function readCssColor(element: HTMLElement, token: string): THREE.Color {
  const value = getComputedStyle(element).getPropertyValue(token).trim();
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  const context = canvas.getContext('2d');
  if (!context || !value) {
    return new THREE.Color(0x888888);
  }
  context.fillStyle = value;
  context.fillRect(0, 0, 1, 1);
  const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
  return new THREE.Color().setRGB(r / 255, g / 255, b / 255, THREE.SRGBColorSpace);
}

/** Merged-mesh hit -> cell: each quad is two triangles. */
const faceHitIndex = (faceCells: number[], cellIndices?: number[]) => (hit: THREE.Intersection) => {
  if (hit.faceIndex === undefined || hit.faceIndex === null) {
    return undefined;
  }
  const local = faceCells[Math.floor(hit.faceIndex / 2)];
  return cellIndices ? cellIndices[local] : local;
};

export function VoxelViewer({ detail, mode, showAdded, onHover, className }: VoxelViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onHoverRef = useRef(onHover);
  const viewRef = useRef({ mode, showAdded });
  const applyViewRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    onHoverRef.current = onHover;
  }, [onHover]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return undefined;
    }

    const disposables: Disposable[] = [];
    const track = <T extends Disposable>(item: T): T => {
      disposables.push(item);
      return item;
    };

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 2000);
    const controls = new OrbitControls(camera, renderer.domElement);
    const render = () => renderer.render(scene, camera);
    controls.addEventListener('change', render);

    // Frame the blueprint: center the bounding box and back the camera off by its diagonal.
    const box = new THREE.Box3();
    [...detail.voxels, ...detail.added].forEach(([x, y, z]) => {
      box.expandByPoint(new THREE.Vector3(x - 0.5, y - 0.5, z - 0.5));
      box.expandByPoint(new THREE.Vector3(x + 0.5, y + 0.5, z + 0.5));
    });
    const center = box.getCenter(new THREE.Vector3());
    const radius = Math.max(box.getSize(new THREE.Vector3()).length() / 2, 2);
    camera.position.set(center.x + radius * 1.6, center.y + radius * 1.1, center.z + radius * 1.9);
    camera.far = radius * 20;
    camera.updateProjectionMatrix();
    controls.target.copy(center);
    controls.update();

    // Lighting: sky/ground fill plus one shadow-casting sun sized to the blueprint.
    scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8170, 1.5));
    const sun = new THREE.DirectionalLight(0xffffff, 2.2);
    sun.position.copy(center).add(new THREE.Vector3(0.55, 1, 0.35).multiplyScalar(radius * 3));
    sun.target.position.copy(center);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.03;
    const shadowCamera = sun.shadow.camera;
    shadowCamera.left = -radius * 1.3;
    shadowCamera.right = radius * 1.3;
    shadowCamera.top = radius * 1.3;
    shadowCamera.bottom = -radius * 1.3;
    shadowCamera.near = 0.1;
    shadowCamera.far = radius * 8;
    shadowCamera.updateProjectionMatrix();
    scene.add(sun, sun.target);

    // Invisible ground that only shows the shadow, so the build sits on something.
    const ground = new THREE.Mesh(
      track(new THREE.PlaneGeometry(radius * 10, radius * 10)),
      track(new THREE.ShadowMaterial({ opacity: 0.22 })),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(center.x, box.min.y - 0.001, center.z);
    ground.receiveShadow = true;
    scene.add(ground);

    const baseColor = readCssColor(container, '--edit-none');
    const digColor = readCssColor(container, '--edit-dig');
    const addColor = readCssColor(container, '--edit-add');
    const blockById = new Map(detail.blocks.map((block) => [block.id, block]));
    const isTransparent = (blockId: number) => blockById.get(blockId)?.transparent ?? false;
    const hitTargets: HitTarget[] = [];

    const loader = new THREE.TextureLoader();
    const textureCache = new Map<number, THREE.Texture>();
    const textureOf = (blockId: number) => {
      const cached = textureCache.get(blockId);
      if (cached) {
        return cached;
      }
      const texture = track(
        loader.load(`${TEXTURE_BASE}${blockById.get(blockId)?.texture ?? ''}`, render),
      );
      texture.magFilter = THREE.NearestFilter;
      texture.minFilter = THREE.NearestFilter;
      texture.colorSpace = THREE.SRGBColorSpace;
      textureCache.set(blockId, texture);
      return texture;
    };

    const baseCells: MeshCell[] = detail.voxels.map(([x, y, z, blockId]) => ({ x, y, z, blockId }));
    const baseLookup = buildCellLookup(baseCells);
    const white = new THREE.Color(1, 1, 1);

    // Texture mode: one merged mesh per block type. Transparent blocks (water, glass) do not hide
    // or darken their neighbors, except against the same block so water has no inner faces.
    const textureGroup = new THREE.Group();
    const cellIndicesByBlock = new Map<number, number[]>();
    baseCells.forEach((cell, index) => {
      const list = cellIndicesByBlock.get(cell.blockId) ?? [];
      list.push(index);
      cellIndicesByBlock.set(cell.blockId, list);
    });
    cellIndicesByBlock.forEach((cellIndices, blockId) => {
      const transparent = isTransparent(blockId);
      const { geometry, faceCells } = buildVoxelMesh(
        cellIndices.map((index) => baseCells[index]),
        baseLookup,
        {
          hidesFace: (cell, neighbor) =>
            !isTransparent(neighbor.blockId) || neighbor.blockId === cell.blockId,
          occludes: (neighbor) => !isTransparent(neighbor.blockId),
          colorOf: () => white,
        },
      );
      const mesh = new THREE.Mesh(
        track(geometry),
        track(
          new THREE.MeshLambertMaterial({
            map: textureOf(blockId),
            vertexColors: true,
            transparent,
            opacity: transparent ? 0.7 : 1,
            alphaTest: transparent ? 0 : 0.5,
          }),
        ),
      );
      mesh.castShadow = !transparent;
      mesh.receiveShadow = true;
      textureGroup.add(mesh);
      hitTargets.push({
        object: mesh,
        kind: 'base',
        indexOf: faceHitIndex(faceCells, cellIndices),
      });
    });

    // Heatmap mode: digRuns scaled to this blueprint's maximum, untouched cells stay neutral.
    const maxDigRuns = Math.max(1, ...detail.voxels.map((voxel) => voxel[5]));
    const heat = buildVoxelMesh(baseCells, baseLookup, {
      hidesFace: () => true,
      occludes: () => true,
      colorOf: (_, index) => {
        const digRuns = detail.voxels[index][5];
        const t = digRuns > 0 ? MIN_HEAT + (1 - MIN_HEAT) * (digRuns / maxDigRuns) : 0;
        return baseColor.clone().lerp(digColor, t);
      },
    });
    const heatMesh = new THREE.Mesh(
      track(heat.geometry),
      track(new THREE.MeshLambertMaterial({ vertexColors: true })),
    );
    heatMesh.castShadow = true;
    heatMesh.receiveShadow = true;
    const heatmapGroup = new THREE.Group();
    heatmapGroup.add(heatMesh);
    hitTargets.push({ object: heatMesh, kind: 'base', indexOf: faceHitIndex(heat.faceCells) });

    // Added cells. Texture mode: their real block texture tinted toward the "added" color with an
    // outline. Heatmap mode: plain translucent color, stronger where more runs placed the cell.
    const addedTextureGroup = new THREE.Group();
    const addedHeatGroup = new THREE.Group();
    if (detail.added.length > 0) {
      const addedGeometry = track(new THREE.BoxGeometry(ADDED_SCALE, ADDED_SCALE, ADDED_SCALE));
      // Same box with UVs squeezed into the 6-face strip, so one texture serves all faces
      // (cloning a texture per face re-uploads it and trips WebGL's immutable-storage check).
      const addedStripGeometry = track(addedGeometry.clone());
      const stripUv = addedStripGeometry.getAttribute('uv');
      for (let i = 0; i < stripUv.count; i += 1) {
        stripUv.setX(i, (Math.floor(i / 4) + stripUv.getX(i)) / FACE_COUNT);
      }
      stripUv.needsUpdate = true;
      const matrix = new THREE.Matrix4();
      const tint = white.clone().lerp(addColor, 0.45);

      const addedByBlock = new Map<number, number[]>();
      detail.added.forEach((voxel, index) => {
        const list = addedByBlock.get(voxel[3]) ?? [];
        list.push(index);
        addedByBlock.set(voxel[3], list);
      });
      addedByBlock.forEach((indices, blockId) => {
        const material = track(
          new THREE.MeshLambertMaterial({
            map: textureOf(blockId),
            color: tint,
            transparent: true,
            opacity: 0.85,
          }),
        );
        const mesh = new THREE.InstancedMesh(addedStripGeometry, material, indices.length);
        indices.forEach((addedIndex, instance) => {
          const [x, y, z] = detail.added[addedIndex];
          mesh.setMatrixAt(instance, matrix.makeTranslation(x, y, z));
        });
        mesh.castShadow = true;
        addedTextureGroup.add(mesh);
        hitTargets.push({
          object: mesh,
          kind: 'added',
          indexOf: (hit) => (hit.instanceId === undefined ? undefined : indices[hit.instanceId]),
        });
      });

      // One merged line mesh outlines every added cell.
      const edgeTemplate = new THREE.EdgesGeometry(addedGeometry);
      const edgePositions = edgeTemplate.getAttribute('position');
      const outline: number[] = [];
      detail.added.forEach(([x, y, z]) => {
        for (let i = 0; i < edgePositions.count; i += 1) {
          outline.push(
            edgePositions.getX(i) + x,
            edgePositions.getY(i) + y,
            edgePositions.getZ(i) + z,
          );
        }
      });
      edgeTemplate.dispose();
      const outlineGeometry = track(new THREE.BufferGeometry());
      outlineGeometry.setAttribute('position', new THREE.Float32BufferAttribute(outline, 3));
      addedTextureGroup.add(
        new THREE.LineSegments(
          outlineGeometry,
          track(new THREE.LineBasicMaterial({ color: addColor })),
        ),
      );

      const maxPlaceRuns = Math.max(1, ...detail.added.map((voxel) => voxel[5]));
      const heatAdded = new THREE.InstancedMesh(
        addedGeometry,
        track(
          new THREE.MeshLambertMaterial({ transparent: true, opacity: 0.55, depthWrite: false }),
        ),
        detail.added.length,
      );
      const color = new THREE.Color();
      detail.added.forEach(([x, y, z, , , placeRuns], index) => {
        heatAdded.setMatrixAt(index, matrix.makeTranslation(x, y, z));
        const strength = MIN_HEAT + (1 - MIN_HEAT) * (placeRuns / maxPlaceRuns);
        heatAdded.setColorAt(index, color.copy(baseColor).lerp(addColor, strength));
      });
      addedHeatGroup.add(heatAdded);
      hitTargets.push({
        object: heatAdded,
        kind: 'added',
        indexOf: (hit) => hit.instanceId,
      });
    }

    const highlight = new THREE.LineSegments(
      track(new THREE.EdgesGeometry(track(new THREE.BoxGeometry(1.04, 1.04, 1.04)))),
      track(new THREE.LineBasicMaterial({ color: readCssColor(container, '--foreground') })),
    );
    highlight.visible = false;

    scene.add(textureGroup, heatmapGroup, addedTextureGroup, addedHeatGroup, highlight);

    const applyView = () => {
      const { mode: currentMode, showAdded: currentShowAdded } = viewRef.current;
      textureGroup.visible = currentMode === 'texture';
      heatmapGroup.visible = currentMode === 'heatmap';
      addedTextureGroup.visible = currentShowAdded && currentMode === 'texture';
      addedHeatGroup.visible = currentShowAdded && currentMode === 'heatmap';
      render();
    };
    applyViewRef.current = applyView;
    applyView();

    const resize = () => {
      const { clientWidth, clientHeight } = container;
      renderer.setSize(clientWidth, clientHeight);
      camera.aspect = clientWidth / Math.max(clientHeight, 1);
      camera.updateProjectionMatrix();
      render();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    resize();

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const clearHover = () => {
      if (highlight.visible) {
        highlight.visible = false;
        render();
      }
      onHoverRef.current(null);
    };
    const handlePointerMove = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.setFromCamera(pointer, camera);
      const visibleTargets = hitTargets.filter((target) => target.object.parent?.visible);
      const [hit] = raycaster.intersectObjects(
        visibleTargets.map((target) => target.object),
        false,
      );
      const target = hit && visibleTargets.find((item) => item.object === hit.object);
      const index = target ? target.indexOf(hit) : undefined;
      if (!target || index === undefined) {
        clearHover();
        return;
      }
      const [x, y, z, blockId, count, runs] =
        target.kind === 'base' ? detail.voxels[index] : detail.added[index];
      highlight.position.set(x, y, z);
      highlight.visible = true;
      render();
      onHoverRef.current({
        kind: target.kind,
        blockName: blockById.get(blockId)?.name ?? `Block ${blockId}`,
        count,
        runs,
        position: [x, y, z],
        screenX: event.clientX - rect.left,
        screenY: event.clientY - rect.top,
      });
    };
    renderer.domElement.addEventListener('pointermove', handlePointerMove);
    renderer.domElement.addEventListener('pointerleave', clearHover);

    return () => {
      renderer.domElement.removeEventListener('pointermove', handlePointerMove);
      renderer.domElement.removeEventListener('pointerleave', clearHover);
      observer.disconnect();
      controls.dispose();
      scene.traverse((object) => {
        if (object instanceof THREE.InstancedMesh) {
          object.dispose();
        }
      });
      disposables.forEach((item) => item.dispose());
      renderer.dispose();
      renderer.domElement.remove();
      applyViewRef.current = null;
    };
  }, [detail]);

  useEffect(() => {
    viewRef.current = { mode, showAdded };
    applyViewRef.current?.();
  }, [mode, showAdded]);

  return (
    <div
      ref={containerRef}
      className={cn('relative size-full touch-none overflow-hidden', className)}
    />
  );
}
