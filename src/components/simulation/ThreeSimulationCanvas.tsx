import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef, useMemo } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { WindParams, LayerVisibility, SelectedElement, LoadedIfcMetadata } from './types';
import { useProjectStore } from '../../store/useProjectStore';
import {
  MNDB_M,
  TERRAIN_NX,
  TERRAIN_NY,
  nodeGround,
  nodeX,
  nodeY,
  toScene,
  terrainTriangleIndices,
  wetNodes,
  depthAt,
  RAFT_MODELS,
  RaftModel,
  raftWaterline,
  buildPileModels,
  buildCableModels,
  buildBlockAnchors,
  blockUtilisation,
  BlockAnchor,
  PileModel,
  CLEAT_ABOVE_WATERLINE_M,
  RaftMooringState,
  utilisationColour
} from './sceneModel';
import { evaluateDeadweightBlock } from '../../lib/calc/deadweight';

export interface ThreeCanvasRef {
  resetCamera: () => void;
  setCameraPreset: (preset: 'overview' | 'topDown' | 'waterLevel' | 'raftFocus', raftId?: number) => void;
  captureSnapshot: () => string;
}

interface ThreeSimulationCanvasProps {
  windParams: WindParams;
  layers: LayerVisibility;
  /** Reservoir level, PROJECT datum (MNDB = 384.5 m). */
  waterLevel_m: number;
  ifcData: LoadedIfcMetadata | null;
  selectedElement: SelectedElement | null;
  onSelectElement: (elem: SelectedElement | null) => void;
  /** Engine results per raft at the current wind speed (governing tension, utilisations). */
  mooringStates: Map<string, RaftMooringState>;
}

/** Terrain colour by elevation relative to the normal water level. */
function groundColour(z: number): [number, number, number] {
  const d = z - MNDB_M;
  if (d < -3) return [0.2, 0.26, 0.3];      // reservoir bed
  if (d < 0) return [0.34, 0.36, 0.33];     // shallow margin
  if (d < 1.6) return [0.55, 0.49, 0.37];   // bank (up to MNLKT)
  const g = Math.min(0.5, 0.28 + d * 0.006);
  return [0.2, g, 0.17];                     // hillside
}

const fmt = (v: number, d = 2) => v.toFixed(d);

export const ThreeSimulationCanvas = forwardRef<ThreeCanvasRef, ThreeSimulationCanvasProps>(
  ({ windParams, layers, waterLevel_m, ifcData, selectedElement, onSelectElement, mooringStates }, ref) => {
    const solarTilt_deg = useProjectStore((s) => s.currentProject.raft.solarTilt_deg ?? 15);
    const shoreArm_e_m = useProjectStore((s) => s.currentProject.anchor.shoreArm_e_m);
    const bed1Stickup_m = useProjectStore((s) => s.currentProject.anchor.bed1Stickup_m);
    // Pile sizes of the raft being edited in Tab 2 (the other 11 keep the design catalogue).
    const activeRaftId = useProjectStore((s) => s.activeRaftId);
    const shoreD_m = useProjectStore((s) => s.currentProject.anchor.shoreD_m);
    const shoreL_m = useProjectStore((s) => s.currentProject.anchor.shoreL_m);
    const bed1D_m = useProjectStore((s) => s.currentProject.anchor.bed1D_m);
    const bed1L_m = useProjectStore((s) => s.currentProject.anchor.bed1L_m);
    // PA2 (comparison option): the 175 lake-bed anchors are gravity blocks.
    const mooringOption = useProjectStore((s) => s.mooringOption);
    const costInputs = useProjectStore((s) => s.costInputs);
    const currentProject = useProjectStore((s) => s.currentProject);
    const blocks = useMemo(
      () => (mooringOption === 'PA2_DEADWEIGHT' ? buildBlockAnchors(currentProject, activeRaftId, costInputs) : undefined),
      [mooringOption, currentProject, activeRaftId, costInputs]
    );

    const containerRef = useRef<HTMLDivElement>(null);
    const sceneRef = useRef<THREE.Scene | null>(null);
    const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const controlsRef = useRef<OrbitControls | null>(null);

    const terrainMeshRef = useRef<THREE.Mesh | null>(null);
    const waterMeshRef = useRef<THREE.Mesh | null>(null);
    const raftsGroupRef = useRef<THREE.Group>(new THREE.Group());
    const pilesGroupRef = useRef<THREE.Group>(new THREE.Group());
    const cablesRef = useRef<THREE.LineSegments | null>(null);
    const windParticlesRef = useRef<THREE.Points | null>(null);
    const particlePositionsRef = useRef<Float32Array | null>(null);
    const ifcGroupRef = useRef<THREE.Group | null>(null);
    const axesGridGroupRef = useRef<THREE.Group>(new THREE.Group());
    const raftGroupsRef = useRef<Map<number, THREE.Group>>(new Map());
    const panelMeshesRef = useRef<THREE.InstancedMesh[]>([]);
    const pileMeshesRef = useRef<{
      shoreAbove: THREE.InstancedMesh | null;
      shoreEmbed: THREE.InstancedMesh | null;
      bedAbove: THREE.InstancedMesh | null;
      bedEmbed: THREE.InstancedMesh | null;
    }>({ shoreAbove: null, shoreEmbed: null, bedAbove: null, bedEmbed: null });

    const windRef = useRef(windParams);
    windRef.current = windParams;

    const raycasterRef = useRef<THREE.Raycaster>(new THREE.Raycaster());
    const mouseRef = useRef<THREE.Vector2>(new THREE.Vector2());
    const [hoveredInfo, setHoveredInfo] = useState<string | null>(null);

    // The 304 piles and their cables at their CAD positions; sizes as designed,
    // except the active raft, which shows the side / L_tk entered in Tab 2.
    const piles = useMemo(
      () => buildPileModels({ shoreArm_e_m, bed1Stickup_m, shoreD_m, shoreL_m, bed1D_m, bed1L_m }, `BÈ ${activeRaftId}`, blocks),
      [shoreArm_e_m, bed1Stickup_m, shoreD_m, shoreL_m, bed1D_m, bed1L_m, activeRaftId, blocks]
    );
    const cables = useMemo(() => buildCableModels(piles), [piles]);
    const shorePiles = useMemo(() => piles.filter((p) => p.type === 'SHORE'), [piles]);
    const bedPiles = useMemo(() => piles.filter((p) => p.type === 'BED'), [piles]);

    /** Waterline of every raft at the current level (floating or aground). */
    const raftLines = useMemo(() => {
      const m = new Map<string, { waterline_m: number; aground: boolean }>();
      for (const r of RAFT_MODELS) m.set(r.name, raftWaterline(r, waterLevel_m));
      return m;
    }, [waterLevel_m]);

    useImperativeHandle(ref, () => ({
      resetCamera: () => {
        if (!cameraRef.current || !controlsRef.current) return;
        cameraRef.current.position.set(0, 320, 420);
        controlsRef.current.target.set(0, 0, 0);
        controlsRef.current.update();
      },
      setCameraPreset: (preset, raftId) => {
        if (!cameraRef.current || !controlsRef.current) return;
        switch (preset) {
          case 'overview':
            cameraRef.current.position.set(0, 320, 420);
            controlsRef.current.target.set(0, 0, 0);
            break;
          case 'topDown':
            cameraRef.current.position.set(0, 750, 0.1);
            controlsRef.current.target.set(0, 0, 0);
            break;
          case 'waterLevel':
            cameraRef.current.position.set(0, 12, 280);
            controlsRef.current.target.set(0, 0, 0);
            break;
          case 'raftFocus': {
            const g = raftGroupsRef.current.get(raftId || 1);
            if (g) {
              cameraRef.current.position.set(g.position.x + 80, g.position.y + 60, g.position.z + 80);
              controlsRef.current.target.copy(g.position);
            }
            break;
          }
        }
        controlsRef.current.update();
      },
      captureSnapshot: () => {
        if (!rendererRef.current || !sceneRef.current || !cameraRef.current) return '';
        rendererRef.current.render(sceneRef.current, cameraRef.current);
        return rendererRef.current.domElement.toDataURL('image/png');
      }
    }));

    // ------------------------------------------------------------ scene init
    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;
      const width = container.clientWidth || 800;
      const height = container.clientHeight || 600;

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0xf1f5f9);
      scene.fog = new THREE.FogExp2(0xe2e8f0, 0.00045);
      sceneRef.current = scene;

      const camera = new THREE.PerspectiveCamera(45, width / height, 0.5, 4000);
      camera.position.set(0, 320, 420);
      cameraRef.current = camera;

      const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      container.appendChild(renderer.domElement);
      rendererRef.current = renderer;

      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.maxPolarAngle = Math.PI / 2 - 0.02;
      controls.minDistance = 8;
      controls.maxDistance = 2200;
      controlsRef.current = controls;

      scene.add(new THREE.AmbientLight(0xffffff, 0.65));
      const hemi = new THREE.HemisphereLight(0xdbeafe, 0x334155, 0.6);
      hemi.position.set(0, 200, 0);
      scene.add(hemi);
      const sun = new THREE.DirectionalLight(0xfffbeb, 1.2);
      sun.position.set(250, 400, 200);
      sun.castShadow = true;
      sun.shadow.mapSize.set(2048, 2048);
      sun.shadow.camera.near = 50;
      sun.shadow.camera.far = 1200;
      Object.assign(sun.shadow.camera, { left: -450, right: 450, top: 450, bottom: -450 });
      scene.add(sun);

      // Terrain: the IFC Toposolid in the PROJECT datum, row 0 = south.
      const n = TERRAIN_NX * TERRAIN_NY;
      const tPos = new Float32Array(n * 3);
      const tCol = new Float32Array(n * 3);
      for (let r = 0; r < TERRAIN_NY; r++) {
        for (let c = 0; c < TERRAIN_NX; c++) {
          const k = r * TERRAIN_NX + c;
          const g = nodeGround(r, c);
          const s = toScene(nodeX(c), nodeY(r), g ?? MNDB_M);
          tPos.set([s.x, s.y, s.z], k * 3);
          tCol.set(groundColour(g ?? MNDB_M), k * 3);
        }
      }
      const tGeom = new THREE.BufferGeometry();
      tGeom.setAttribute('position', new THREE.BufferAttribute(tPos, 3));
      tGeom.setAttribute('color', new THREE.BufferAttribute(tCol, 3));
      tGeom.setIndex(terrainTriangleIndices());
      tGeom.computeVertexNormals();
      const tMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0.05, flatShading: true, side: THREE.DoubleSide });
      const terrain = new THREE.Mesh(tGeom, tMat);
      terrain.receiveShadow = true;
      scene.add(terrain);
      terrainMeshRef.current = terrain;

      // Water: same grid nodes, drawn only over the flooded part of the valley
      // (index rebuilt when the level changes).
      const wGeom = new THREE.BufferGeometry();
      wGeom.setAttribute('position', new THREE.BufferAttribute(tPos.slice(), 3));
      const wMat = new THREE.MeshStandardMaterial({
        color: 0x0284c7, roughness: 0.12, metalness: 0.2, transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide
      });
      const water = new THREE.Mesh(wGeom, wMat);
      water.renderOrder = 2;
      scene.add(water);
      waterMeshRef.current = water;

      scene.add(raftsGroupRef.current);
      scene.add(pilesGroupRef.current);
      scene.add(axesGridGroupRef.current);

      const grid = new THREE.GridHelper(1200, 60, 0x0284c7, 0xcbd5e1);
      grid.position.y = 376.8 - 17.5 - MNDB_M - 2; // just under the lowest modelled ground
      axesGridGroupRef.current.add(grid);
      const compass = new THREE.Group();
      compass.position.set(380, 25, -380);
      const ring = new THREE.RingGeometry(18, 20, 32);
      ring.rotateX(-Math.PI / 2);
      compass.add(new THREE.Mesh(ring, new THREE.MeshBasicMaterial({ color: 0x0284c7, side: THREE.DoubleSide })));
      const arrow = new THREE.ConeGeometry(4, 14, 16);
      arrow.rotateX(-Math.PI / 2); // points to −Z = north
      arrow.translate(0, 0, -10);
      compass.add(new THREE.Mesh(arrow, new THREE.MeshBasicMaterial({ color: 0xef4444 })));
      axesGridGroupRef.current.add(compass);

      // Wind particles (visual only).
      const particleCount = 1400;
      const pPos = new Float32Array(particleCount * 3);
      for (let i = 0; i < particleCount; i++) {
        pPos[i * 3] = (Math.random() - 0.5) * 900;
        pPos[i * 3 + 1] = 2 + Math.random() * 25;
        pPos[i * 3 + 2] = (Math.random() - 0.5) * 900;
      }
      const pGeom = new THREE.BufferGeometry();
      pGeom.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
      particlePositionsRef.current = pPos;
      const particles = new THREE.Points(pGeom, new THREE.PointsMaterial({ color: 0x38bdf8, size: 3.2, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false }));
      scene.add(particles);
      windParticlesRef.current = particles;

      let frame = 0;
      const clock = new THREE.Clock();
      const animate = () => {
        frame = requestAnimationFrame(animate);
        const dt = clock.getDelta();
        const w = windRef.current;
        if (windParticlesRef.current && particlePositionsRef.current) {
          const pos = particlePositionsRef.current;
          const rad = (w.direction * Math.PI) / 180;
          // Wind blowing FROM `direction` travels towards direction + 180°.
          const step = (w.speed * dt * 12) / 10;
          const dx = -Math.sin(rad) * step;
          const dz = Math.cos(rad) * step;
          for (let i = 0; i < particleCount; i++) {
            pos[i * 3] += dx;
            pos[i * 3 + 2] += dz;
            if (pos[i * 3] > 450) pos[i * 3] = -450; else if (pos[i * 3] < -450) pos[i * 3] = 450;
            if (pos[i * 3 + 2] > 450) pos[i * 3 + 2] = -450; else if (pos[i * 3 + 2] < -450) pos[i * 3 + 2] = 450;
          }
          windParticlesRef.current.geometry.attributes.position.needsUpdate = true;
        }
        controls.update();
        renderer.render(scene, camera);
      };
      animate();

      const onResize = () => {
        const w = container.clientWidth, h = container.clientHeight;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      };
      window.addEventListener('resize', onResize);
      return () => {
        cancelAnimationFrame(frame);
        window.removeEventListener('resize', onResize);
        if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
        renderer.dispose();
      };
    }, []);

    // ------------------------------------------------------------ rafts (per tilt)
    useEffect(() => {
      const group = raftsGroupRef.current;
      group.clear();
      raftGroupsRef.current.clear();
      panelMeshesRef.current = [];
      const platformMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.4, metalness: 0.3 });
      const panelMat = new THREE.MeshStandardMaterial({ color: 0x0f2744, roughness: 0.2, metalness: 0.8 });
      const tilt = (solarTilt_deg * Math.PI) / 180;
      const panelGeom = new THREE.BoxGeometry(5.2, 0.12, 3.8);
      panelGeom.rotateX(-tilt);

      RAFT_MODELS.forEach((raft: RaftModel) => {
        const { centroid, points } = raft.polygon;
        const shape = new THREE.Shape();
        points.forEach((p, i) => {
          const x = p.x - centroid.x, z = -(p.y - centroid.y);
          if (i === 0) shape.moveTo(x, z); else shape.lineTo(x, z);
        });
        shape.closePath();
        const geom = new THREE.ExtrudeGeometry(shape, { depth: 0.7, bevelEnabled: false });
        geom.rotateX(Math.PI / 2); // flat, extruded downward from y = 0
        const rg = new THREE.Group();
        rg.name = `Raft_${raft.id}`;
        const platform = new THREE.Mesh(geom, platformMat);
        platform.castShadow = true;
        platform.receiveShadow = true;
        rg.add(platform);
        rg.add(new THREE.LineSegments(new THREE.EdgesGeometry(geom), new THREE.LineBasicMaterial({ color: 0x64748b })));

        // Solar panels, instanced (one draw call per raft).
        const bbox = new THREE.Box3().setFromObject(platform);
        const sx = bbox.max.x - bbox.min.x, sz = bbox.max.z - bbox.min.z;
        const rows = Math.max(3, Math.floor(sz / 8)), cols = Math.max(3, Math.floor(sx / 6));
        const slots: Array<[number, number]> = [];
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const px = bbox.min.x + (c + 0.5) * (sx / cols), pz = bbox.min.z + (r + 0.5) * (sz / rows);
            // keep panels on the pontoon: the outline is not always a rectangle
            const shapePt = new THREE.Vector2(px, pz);
            if (shape.getPoints().length && isInsideShape(shapePt, shape)) slots.push([px, pz]);
          }
        }
        const panels = new THREE.InstancedMesh(panelGeom, panelMat, slots.length);
        const m = new THREE.Matrix4();
        slots.forEach(([px, pz], i) => { m.makeTranslation(px, 0.45, pz); panels.setMatrixAt(i, m); });
        panels.castShadow = true;
        panels.visible = layers.solarPanels;
        rg.add(panels);
        panelMeshesRef.current.push(panels);

        rg.userData = { type: 'raft', id: raft.id, name: raft.name };
        group.add(rg);
        raftGroupsRef.current.set(raft.id, rg);
      });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [solarTilt_deg]);

    // Raft heights follow the water (or rest on the ground when it is too low).
    useEffect(() => {
      RAFT_MODELS.forEach((raft) => {
        const rg = raftGroupsRef.current.get(raft.id);
        if (!rg) return;
        const wl = raftLines.get(raft.name)!;
        const s = toScene(raft.polygon.centroid.x, raft.polygon.centroid.y, wl.waterline_m);
        rg.position.set(s.x, s.y + 0.2, s.z);
      });
    }, [raftLines, solarTilt_deg]);

    // ------------------------------------------------------------ water
    useEffect(() => {
      const water = waterMeshRef.current;
      if (!water) return;
      const pos = water.geometry.attributes.position as THREE.BufferAttribute;
      const y = waterLevel_m - MNDB_M;
      for (let k = 0; k < pos.count; k++) pos.setY(k, y);
      pos.needsUpdate = true;
      const wet = wetNodes(waterLevel_m);
      const idx: number[] = [];
      const id = (r: number, c: number) => r * TERRAIN_NX + c;
      for (let r = 0; r < TERRAIN_NY - 1; r++) {
        for (let c = 0; c < TERRAIN_NX - 1; c++) {
          // Any wet corner: the terrain hides the part of the quad above ground,
          // which draws the shoreline where the ground crosses the level.
          if (!(wet[id(r, c)] || wet[id(r, c + 1)] || wet[id(r + 1, c)] || wet[id(r + 1, c + 1)])) continue;
          idx.push(id(r, c), id(r + 1, c + 1), id(r, c + 1), id(r, c), id(r + 1, c), id(r + 1, c + 1));
        }
      }
      water.geometry.setIndex(idx);
      water.geometry.computeVertexNormals();
    }, [waterLevel_m]);

    // ------------------------------------------------------------ piles
    useEffect(() => {
      const group = pilesGroupRef.current;
      group.clear();
      const unit = new THREE.BoxGeometry(1, 1, 1);
      const aboveMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, metalness: 0.15 });
      const embedMat = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.8, metalness: 0.05, transparent: true, opacity: 0.85 });
      const build = (list: PileModel[], part: 'above' | 'embed', mat: THREE.Material) => {
        const mesh = new THREE.InstancedMesh(unit, mat, list.length);
        const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), pv = new THREE.Vector3();
        list.forEach((p, i) => {
          const top = part === 'above' ? p.head_m : p.ground_m;
          const bottom = part === 'above' ? p.ground_m : p.toe_m;
          const c = toScene(p.x, p.y, (top + bottom) / 2);
          pv.set(c.x, c.y, c.z);
          sc.set(p.side_m, Math.max(0.01, top - bottom), p.side_m);
          m.compose(pv, q, sc);
          mesh.setMatrixAt(i, m);
        });
        mesh.castShadow = part === 'above';
        mesh.userData = { type: 'pile', part, list };
        group.add(mesh);
        return mesh;
      };
      pileMeshesRef.current = {
        shoreAbove: build(shorePiles, 'above', aboveMat),
        shoreEmbed: build(shorePiles, 'embed', embedMat),
        bedAbove: build(bedPiles, 'above', aboveMat.clone()),
        bedEmbed: build(bedPiles, 'embed', embedMat.clone())
      };
    }, [shorePiles, bedPiles]);

    // Pile colours: the raft's governing Broms utilisation (engine), gold when selected.
    useEffect(() => {
      const { shoreAbove, bedAbove } = pileMeshesRef.current;
      const paint = (mesh: THREE.InstancedMesh | null, list: PileModel[], kind: 'shore' | 'bed') => {
        if (!mesh) return;
        const col = new THREE.Color();
        list.forEach((p, i) => {
          const st = mooringStates.get(p.raft);
          const u = !st ? NaN
            : p.block ? blockUtilisation(p.block, st.tension_kN, costInputs)
            : kind === 'shore' ? st.shorePileUtil : st.bedPileUtil;
          col.setHex(selectedElement?.id === p.code ? 0xfacc15 : utilisationColour(u));
          mesh.setColorAt(i, col);
        });
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      };
      paint(shoreAbove, shorePiles, 'shore');
      paint(bedAbove, bedPiles, 'bed');
    }, [mooringStates, selectedElement, shorePiles, bedPiles, costInputs]);

    // ------------------------------------------------------------ cables
    useEffect(() => {
      const scene = sceneRef.current;
      if (!scene) return;
      if (cablesRef.current) {
        scene.remove(cablesRef.current);
        cablesRef.current.geometry.dispose();
      }
      const pos = new Float32Array(cables.length * 6);
      const col = new Float32Array(cables.length * 6);
      const c3 = new THREE.Color();
      cables.forEach((cb, i) => {
        const wl = raftLines.get(cb.raft)!;
        const a = toScene(cb.cleat.x, cb.cleat.y, wl.waterline_m + CLEAT_ABOVE_WATERLINE_M);
        const b = toScene(cb.pile.x, cb.pile.y, cb.pile.head_m);
        pos.set([a.x, a.y, a.z, b.x, b.y, b.z], i * 6);
        const st = mooringStates.get(cb.raft);
        c3.setHex(selectedElement?.id === cb.code ? 0xfacc15 : utilisationColour(st ? st.cableUtil : NaN));
        col.set([c3.r, c3.g, c3.b, c3.r, c3.g, c3.b], i * 6);
      });
      const geom = new THREE.BufferGeometry();
      geom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geom.setAttribute('color', new THREE.BufferAttribute(col, 3));
      const lines = new THREE.LineSegments(geom, new THREE.LineBasicMaterial({ vertexColors: true }));
      lines.userData = { type: 'cables' };
      lines.visible = layers.mooringLines;
      scene.add(lines);
      cablesRef.current = lines;
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cables, raftLines, mooringStates, selectedElement]);

    // ------------------------------------------------------------ layers
    useEffect(() => {
      raftsGroupRef.current.visible = layers.rafts;
      panelMeshesRef.current.forEach((p) => { p.visible = layers.solarPanels; });
      if (cablesRef.current) cablesRef.current.visible = layers.mooringLines;
      const pm = pileMeshesRef.current;
      if (pm.shoreAbove) pm.shoreAbove.visible = layers.shorePiles;
      if (pm.shoreEmbed) pm.shoreEmbed.visible = layers.shorePiles;
      if (pm.bedAbove) pm.bedAbove.visible = layers.bedPiles;
      if (pm.bedEmbed) pm.bedEmbed.visible = layers.bedPiles;
      if (waterMeshRef.current) waterMeshRef.current.visible = layers.waterSurface;
      const terrain = terrainMeshRef.current;
      if (terrain) {
        terrain.visible = layers.lakeTerrain;
        const mat = terrain.material as THREE.MeshStandardMaterial;
        // X-ray: see-through ground so the embedded pile lengths show.
        mat.transparent = layers.terrainXray;
        mat.opacity = layers.terrainXray ? 0.28 : 1;
        mat.depthWrite = !layers.terrainXray;
        mat.needsUpdate = true;
      }
      if (windParticlesRef.current) windParticlesRef.current.visible = layers.windStreamlines;
      axesGridGroupRef.current.visible = layers.axesAndGrid;
    }, [layers, piles]);

    // ------------------------------------------------------------ uploaded IFC
    useEffect(() => {
      const scene = sceneRef.current;
      if (!scene) return;
      if (ifcGroupRef.current) {
        scene.remove(ifcGroupRef.current);
        ifcGroupRef.current = null;
      }
      if (ifcData?.rootGroup) {
        scene.add(ifcData.rootGroup);
        ifcGroupRef.current = ifcData.rootGroup;
        ifcData.rootGroup.visible = layers.ifcModel;
      }
    }, [ifcData, layers.ifcModel]);

    // ------------------------------------------------------------ picking
    const pick = (e: React.PointerEvent<HTMLDivElement>) => {
      const container = containerRef.current, camera = cameraRef.current;
      if (!container || !camera) return null;
      const rect = container.getBoundingClientRect();
      mouseRef.current.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      const rc = raycasterRef.current;
      rc.setFromCamera(mouseRef.current, camera);
      rc.params.Line = { threshold: 1.2 };
      const targets: THREE.Object3D[] = [];
      const pm = pileMeshesRef.current;
      if (layers.shorePiles && pm.shoreAbove) targets.push(pm.shoreAbove, pm.shoreEmbed!);
      if (layers.bedPiles && pm.bedAbove) targets.push(pm.bedAbove, pm.bedEmbed!);
      if (layers.mooringLines && cablesRef.current) targets.push(cablesRef.current);
      if (layers.rafts) targets.push(...raftsGroupRef.current.children);
      return rc.intersectObjects(targets, true)[0] ?? null;
    };

    /** Flags values that come from a Tab 2 trial rather than the frozen design. */
    const trialNote = (st: RaftMooringState | undefined): Record<string, string> =>
      st?.isActive && st.deviations.length > 0
        ? { 'Trạng thái': `⚠️ Đang thử nghiệm – khác thiết kế chốt (${st.deviations.map((d) => `${d.label} ${d.design} → ${d.current}`).join('; ')})` }
        : {};

    const describeBlock = (p: PileModel, b: BlockAnchor): SelectedElement => {
      const st = mooringStates.get(p.raft);
      const T = st?.tension_kN ?? 0;
      const e = evaluateDeadweightBlock(b.block, T, b.cableAngle_deg, costInputs.mu);
      const ok = e.sfSlide >= costInputs.sfSlide && e.sfUplift >= costInputs.sfUplift;
      const depth = depthAt(p.x, p.y, waterLevel_m);
      return {
        type: 'pile',
        id: p.code,
        title: `Khối bê tông neo đáy ${p.code} (${p.raft}) — PA2`,
        data: {
          'Tuyến cáp': p.line,
          'Thuộc cụm bè': p.raft,
          'Kích thước L × W × H': `${fmt(b.block.L_m)} × ${fmt(b.block.W_m)} × ${fmt(b.block.H_m)} m`,
          'Trọng lượng W (trong không khí)': `${fmt(b.block.mass_t, 1)} tấn (${fmt(b.block.volume_m3, 1)} m³)`,
          'Trọng lượng chìm W_sub': `${fmt(b.block.weightSub_kN, 0)} kN`,
          'Lực cáp tại vận tốc gió đang chọn': `T = ${fmt(T, 1)} kN, góc ${fmt(b.cableAngle_deg, 1)}° → H = ${fmt(e.H_kN, 1)} kN, V = ${fmt(e.V_kN, 1)} kN`,
          [`SF trượt (μ = ${costInputs.mu})`]: `${fmt(e.sfSlide, 2)} (yêu cầu ≥ ${costInputs.sfSlide})`,
          'SF nhấc bổng': `${fmt(e.sfUplift, 2)} (yêu cầu ≥ ${costInputs.sfUplift})`,
          'SF lật (cáp buộc đỉnh khối)': fmt(e.sfOverturn, 2),
          'Chi phối khi định cỡ': b.block.governing === 'sliding' ? 'Chống trượt' : 'Chống nhấc bổng',
          'Số lần cẩu / điểm neo': b.lifts > 1 ? `${b.lifts} (vượt sức nâng cẩu ${costInputs.craneCapacity_t} T, phải chia khối)` : '1',
          'Cao độ đáy hồ': `${fmt(p.ground_m)} m`,
          'Mực nước tại khối': depth === null ? '—' : depth > 0 ? `ngập ${fmt(depth)} m` : `trên mặt nước ${fmt(-depth)} m`,
          'Kết luận': ok ? 'ĐẠT' : 'KHÔNG ĐẠT',
          'Lưu ý': 'Chưa kiểm tra sức chịu tải / lún của bùn đáy hồ dưới khối',
          ...trialNote(st)
        }
      };
    };

    const describePile = (p: PileModel): SelectedElement => {
      if (p.block) return describeBlock(p, p.block);
      const st = mooringStates.get(p.raft);
      const u = st ? (p.type === 'SHORE' ? st.shorePileUtil : st.bedPileUtil) : NaN;
      const depth = depthAt(p.x, p.y, waterLevel_m);
      return {
        type: 'pile',
        id: p.code,
        title: `Cọc ${p.type === 'SHORE' ? 'neo bờ' : 'đáy hồ'} ${p.code}`,
        data: {
          'Tuyến cáp': p.line,
          'Thuộc cụm bè': p.raft,
          'Tiết diện': `Vuông BTCT ${Math.round(p.side_m * 1000)}×${Math.round(p.side_m * 1000)} mm`,
          'Chiều sâu ngàm L_tk': `${fmt(p.embed_m)} m`,
          'Đoạn nhô khỏi nền': `${fmt(p.stickup_m)} m`,
          'Cao độ mặt đất': `${fmt(p.ground_m)} m`,
          'Cao độ đỉnh cọc': `${fmt(p.head_m)} m`,
          'Cao độ mũi cọc': `${fmt(p.toe_m)} m`,
          'Mực nước tại cọc': depth === null ? '—' : depth > 0 ? `ngập ${fmt(depth)} m` : `trên mặt nước ${fmt(-depth)} m`,
          'Hệ số sử dụng Broms (bè)': Number.isFinite(u) ? fmt(u, 2) : '—',
          ...trialNote(st)
        }
      };
    };

    const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
      const hit = pick(e);
      if (!hit) { onSelectElement(null); return; }
      const obj = hit.object;
      if (obj instanceof THREE.InstancedMesh && obj.userData.type === 'pile' && hit.instanceId !== undefined) {
        onSelectElement(describePile((obj.userData.list as PileModel[])[hit.instanceId]));
        return;
      }
      if (obj === cablesRef.current && hit.index !== undefined) {
        const cb = cables[Math.floor(hit.index / 2)];
        const st = mooringStates.get(cb.raft);
        const wl = raftLines.get(cb.raft)!;
        const cleatZ = wl.waterline_m + CLEAT_ABOVE_WATERLINE_M;
        const length3d = Math.hypot(cb.pile.x - cb.cleat.x, cb.pile.y - cb.cleat.y, cb.pile.head_m - cleatZ);
        const slope = (Math.atan2(cleatZ - cb.pile.head_m, cb.span_m) * 180) / Math.PI;
        onSelectElement({
          type: 'line',
          id: cb.code,
          title: `Tuyến cáp neo ${cb.code}`,
          data: {
            'Thuộc cụm bè': cb.raft,
            'Loại neo': cb.type === 'SHORE' ? 'Cọc bờ' : 'Cọc đáy hồ',
            'Cọc': cb.pile.code,
            'Loại cáp': st?.cable ?? '—',
            'Nhịp mặt bằng': `${fmt(cb.span_m)} m`,
            'Chiều dài 3D (căng thẳng)': `${fmt(length3d)} m`,
            'Góc cáp so với phương ngang': `${fmt(slope, 1)}°`,
            'Lực căng thiết kế (bè)': st ? `${fmt(st.tension_kN, 1)} kN` : '—',
            'MBL cáp': st ? `${fmt(st.mbl_kN, 0)} kN` : '—',
            'Hệ số an toàn SF = MBL/T': st ? fmt(st.safetyFactor, 2) : '—',
            'Hệ số sử dụng cáp': st ? fmt(st.cableUtil, 3) : '—',
            ...trialNote(st)
          }
        });
        return;
      }
      let cur: THREE.Object3D | null = obj;
      while (cur && cur.userData.type !== 'raft') cur = cur.parent;
      if (cur) {
        const raft = RAFT_MODELS.find((r) => r.id === cur!.userData.id)!;
        const st = mooringStates.get(raft.name);
        const wl = raftLines.get(raft.name)!;
        const lines = cables.filter((c) => c.raft === raft.name);
        onSelectElement({
          type: 'raft',
          id: raft.name,
          title: `Cụm bè pin mặt trời ${raft.name}`,
          data: {
            'Diện tích (đa giác CAD)': `${raft.polygon.area_m2.toLocaleString('vi-VN')} m²`,
            'Chu vi': `${fmt(raft.polygon.perimeter_m, 1)} m`,
            'Số tuyến cáp': `${lines.length} (bờ ${lines.filter((l) => l.type === 'SHORE').length} / đáy ${lines.filter((l) => l.type === 'BED').length})`,
            'Loại cáp': st?.cable ?? '—',
            'Lực căng thiết kế T_max': st ? `${fmt(st.tension_kN, 1)} kN` : '—',
            'Hệ số an toàn cáp SF': st ? fmt(st.safetyFactor, 2) : '—',
            'Kết luận tính toán': st?.verdict === 'PASS' ? 'ĐẠT' : st?.verdict ?? '—',
            'Mực nước bè': wl.aground ? `MẮC CẠN (đáy bè tựa nền ${fmt(raft.shallowestGround_m)} m)` : `${fmt(wl.waterline_m)} m`,
            'Nước sâu nhỏ nhất dưới bè': `${fmt(Math.max(0, waterLevel_m - raft.shallowestGround_m))} m`,
            ...trialNote(st)
          }
        });
        return;
      }
      onSelectElement(null);
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
      const hit = pick(e);
      if (!hit) { setHoveredInfo(null); return; }
      const obj = hit.object;
      if (obj instanceof THREE.InstancedMesh && obj.userData.type === 'pile' && hit.instanceId !== undefined) {
        const p = (obj.userData.list as PileModel[])[hit.instanceId];
        setHoveredInfo(p.block
          ? `Khối BT ${p.code} · ${fmt(p.block.block.L_m)}×${fmt(p.block.block.W_m)}×${fmt(p.block.block.H_m)} m · ${fmt(p.block.block.mass_t, 1)} T`
          : `Cọc ${p.code} · ${Math.round(p.side_m * 1000)}×${Math.round(p.side_m * 1000)} · L_tk ${fmt(p.embed_m)} m`);
      } else if (obj === cablesRef.current && hit.index !== undefined) {
        const cb = cables[Math.floor(hit.index / 2)];
        setHoveredInfo(`Tuyến cáp ${cb.code} (${cb.type === 'SHORE' ? 'bờ' : 'đáy'}) · ${cb.raft}`);
      } else {
        let cur: THREE.Object3D | null = obj;
        while (cur && cur.userData.type !== 'raft') cur = cur.parent;
        setHoveredInfo(cur ? `Cụm ${cur.userData.name}` : null);
      }
    };

    const aground = RAFT_MODELS.filter((r) => raftLines.get(r.name)?.aground).map((r) => r.name);

    return (
      <div className="relative w-full h-full min-h-[580px] bg-slate-900 rounded-2xl overflow-hidden shadow-xl border border-slate-700/60 select-none">
        <div
          ref={containerRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          className="w-full h-full cursor-grab active:cursor-grabbing"
        />

        {hoveredInfo && (
          <div className="absolute top-4 left-4 pointer-events-none bg-slate-900/90 backdrop-blur-md text-white text-xs font-mono px-3 py-1.5 rounded-lg border border-brand-500/40 shadow-lg flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-brand-400 animate-pulse" />
            {hoveredInfo}
          </div>
        )}

        {aground.length > 0 && (
          <div className="absolute top-4 right-4 pointer-events-none max-w-xs bg-amber-500/95 text-amber-950 text-xs font-semibold px-3 py-2 rounded-lg shadow-lg">
            ⚠ Mực nước {fmt(waterLevel_m)} m: {aground.join(', ')} mắc cạn theo địa hình IFC
          </div>
        )}

        <div className="absolute bottom-4 left-4 pointer-events-none bg-slate-900/85 backdrop-blur-md p-3 rounded-xl border border-slate-700/70 text-white shadow-xl text-xs space-y-1">
          <div className="flex items-center gap-2 text-brand-300 font-semibold uppercase tracking-wider text-[10px]">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            Gió & mực nước
          </div>
          <div className="font-mono text-sm font-bold text-slate-100">
            {windParams.speed.toFixed(1)} m/s · hướng {windParams.direction}°
          </div>
          <div className="text-[11px] text-slate-300 font-mono">Mực nước hồ {fmt(waterLevel_m)} m</div>
          <div className="flex items-center gap-2 text-[10px] text-slate-400 pt-1">
            <span className="w-2 h-2 rounded-sm bg-emerald-500" />&lt;0.7
            <span className="w-2 h-2 rounded-sm bg-amber-500" />0.7–1.0
            <span className="w-2 h-2 rounded-sm bg-red-500" />&gt;1.0
            <span>(hệ số sử dụng)</span>
          </div>
        </div>
      </div>
    );
  }
);

/** Point-in-shape test in the raft's local plane (panels stay on the pontoon). */
function isInsideShape(p: THREE.Vector2, shape: THREE.Shape): boolean {
  const pts = shape.getPoints();
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i], b = pts[j];
    if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}
