import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import huoiVanhRaftPolygons from '../../data/huoiVanhRaftPolygons.json';
import huoiVanhCoordinates from '../../data/huoiVanhCoordinates.json';
import huoiVanhRaftPolygonsV2 from '../../data/huoiVanhRaftPolygons_v2.json';
import huoiVanhCoordinatesV2 from '../../data/huoiVanhCoordinates_v2.json';
import huoiVanhTerrainMesh from '../../data/huoiVanhTerrainMesh.json';
import { WindParams, LayerVisibility, SelectedElement, LoadedIfcMetadata } from './types';

export interface ThreeCanvasRef {
  resetCamera: () => void;
  setCameraPreset: (preset: 'overview' | 'topDown' | 'waterLevel' | 'raftFocus', raftId?: number) => void;
  captureSnapshot: () => string;
}

interface ThreeSimulationCanvasProps {
  windParams: WindParams;
  layers: LayerVisibility;
  waterLevel_m: number; // default 384.5
  ifcData: LoadedIfcMetadata | null;
  selectedElement: SelectedElement | null;
  onSelectElement: (elem: SelectedElement | null) => void;
  designVersion?: 'v1' | 'v2';
}

// Coordinate origin centering constants for Huổi Vanh
const ORIGIN_X = 110.33;
const ORIGIN_Y = 61.66;
const WATER_DATUM_Z = 384.5;

export const ThreeSimulationCanvas = forwardRef<ThreeCanvasRef, ThreeSimulationCanvasProps>(
  (
    {
      windParams,
      layers,
      waterLevel_m,
      ifcData,
      selectedElement,
      onSelectElement,
      designVersion = 'v2'
    },
    ref
  ) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const sceneRef = useRef<THREE.Scene | null>(null);
    const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const controlsRef = useRef<OrbitControls | null>(null);

    // Dynamic layer groups
    const raftsGroupRef = useRef<THREE.Group>(new THREE.Group());
    const linesGroupRef = useRef<THREE.Group>(new THREE.Group());
    const pilesGroupRef = useRef<THREE.Group>(new THREE.Group());
    const waterMeshRef = useRef<THREE.Mesh | null>(null);
    const terrainGroupRef = useRef<THREE.Group>(new THREE.Group());
    const windParticlesRef = useRef<THREE.Points | null>(null);
    const particlePositionsRef = useRef<Float32Array | null>(null);
    const ifcGroupRef = useRef<THREE.Group | null>(null);
    const axesGridGroupRef = useRef<THREE.Group>(new THREE.Group());

    // Interactive raycaster
    const raycasterRef = useRef<THREE.Raycaster>(new THREE.Raycaster());
    const mouseRef = useRef<THREE.Vector2>(new THREE.Vector2());

    // Dynamic line meshes for tension coloring & picking
    const lineMeshesRef = useRef<Map<string, { line: THREE.Line; material: THREE.LineBasicMaterial; tension: number }>>(
      new Map()
    );
    const raftMeshesRef = useRef<Map<number, { group: THREE.Group; basePosition: THREE.Vector3 }>>(new Map());

    const [hoveredInfo, setHoveredInfo] = useState<string | null>(null);

    // Expose imperative methods to parent
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
            cameraRef.current.position.set(0, 750, 0);
            controlsRef.current.target.set(0, 0, 0);
            break;
          case 'waterLevel':
            cameraRef.current.position.set(0, 12, 280);
            controlsRef.current.target.set(0, 0, 0);
            break;
          case 'raftFocus': {
            const targetRaft = raftMeshesRef.current.get(raftId || 1);
            if (targetRaft) {
              const pos = targetRaft.basePosition;
              cameraRef.current.position.set(pos.x + 80, 60, pos.z + 80);
              controlsRef.current.target.copy(pos);
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

    // Initialize Three.js Scene
    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      const width = container.clientWidth || 800;
      const height = container.clientHeight || 600;

      // 1. Scene
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0xf1f5f9); // slate-100 atmospheric background
      scene.fog = new THREE.FogExp2(0xe2e8f0, 0.0006);
      sceneRef.current = scene;

      // 2. Camera
      const camera = new THREE.PerspectiveCamera(45, width / height, 1, 3000);
      camera.position.set(0, 320, 420);
      cameraRef.current = camera;

      // 3. Renderer
      const renderer = new THREE.WebGLRenderer({
        antialias: true,
        preserveDrawingBuffer: true,
        powerPreference: 'high-performance'
      });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      container.appendChild(renderer.domElement);
      rendererRef.current = renderer;

      // 4. OrbitControls
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.maxPolarAngle = Math.PI / 2 - 0.02; // prevent going below horizon
      controls.minDistance = 15;
      controls.maxDistance = 1800;
      controls.target.set(0, 0, 0);
      controlsRef.current = controls;

      // 5. Lighting
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
      scene.add(ambientLight);

      const hemiLight = new THREE.HemisphereLight(0xdbeafe, 0x334155, 0.6);
      hemiLight.position.set(0, 200, 0);
      scene.add(hemiLight);

      const sunLight = new THREE.DirectionalLight(0xfffbeb, 1.2);
      sunLight.position.set(250, 400, 200);
      sunLight.castShadow = true;
      sunLight.shadow.mapSize.width = 2048;
      sunLight.shadow.mapSize.height = 2048;
      sunLight.shadow.camera.near = 50;
      sunLight.shadow.camera.far = 1000;
      const d = 400;
      sunLight.shadow.camera.left = -d;
      sunLight.shadow.camera.right = d;
      sunLight.shadow.camera.top = d;
      sunLight.shadow.camera.bottom = -d;
      scene.add(sunLight);

      // 6. Lake Water Surface Plane
      const waterGeom = new THREE.PlaneGeometry(1200, 1200, 64, 64);
      waterGeom.rotateX(-Math.PI / 2);
      const waterMat = new THREE.MeshStandardMaterial({
        color: 0x0284c7,
        roughness: 0.1,
        metalness: 0.2,
        transparent: true,
        opacity: 0.62,
        depthWrite: false
      });
      const waterMesh = new THREE.Mesh(waterGeom, waterMat);
      waterMesh.position.y = 0; // Datum water level
      waterMesh.receiveShadow = true;
      scene.add(waterMesh);
      waterMeshRef.current = waterMesh;

      // 7. Lake Basin & Surrounding Terrain
      const terrainGroup = new THREE.Group();
      scene.add(terrainGroup);
      terrainGroupRef.current = terrainGroup;

      const { bounds, gridSize, elevations } = huoiVanhTerrainMesh;
      const tWidth = bounds.maxX - bounds.minX;
      const tHeight = bounds.maxY - bounds.minY;
      const basinGeom = new THREE.PlaneGeometry(tWidth, tHeight, gridSize - 1, gridSize - 1);
      basinGeom.rotateX(-Math.PI / 2);
      const midX = (bounds.minX + bounds.maxX) / 2 - ORIGIN_X;
      const midZ = -((bounds.minY + bounds.maxY) / 2 - ORIGIN_Y);
      basinGeom.translate(midX, 0, midZ);

      const posAttr = basinGeom.attributes.position;
      const colors = new Float32Array(posAttr.count * 3);

      for (let i = 0; i < posAttr.count; i++) {
        const r = Math.floor(i / gridSize);
        const c = i % gridSize;
        const elev = elevations[r] && elevations[r][c] !== undefined ? elevations[r][c] : 384.5;
        const y = elev - WATER_DATUM_Z;
        posAttr.setY(i, y);

        // Elevation-based coloring:
        if (elev < 384.2) {
          // Submerged lakebed silt
          colors[i * 3 + 0] = 0.15;
          colors[i * 3 + 1] = 0.22;
          colors[i * 3 + 2] = 0.28;
        } else if (elev < 387.0) {
          // Shoreline banks (sand/clay/rock)
          colors[i * 3 + 0] = 0.46;
          colors[i * 3 + 1] = 0.42;
          colors[i * 3 + 2] = 0.32;
        } else {
          // Surrounding forested hills
          const green = Math.min(0.48, 0.26 + (elev - 387) * 0.005);
          colors[i * 3 + 0] = 0.18;
          colors[i * 3 + 1] = green;
          colors[i * 3 + 2] = 0.16;
        }
      }
      basinGeom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      basinGeom.computeVertexNormals();

      const terrainMat = new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.85,
        metalness: 0.1,
        flatShading: true
      });
      const terrainMesh = new THREE.Mesh(basinGeom, terrainMat);
      terrainMesh.receiveShadow = true;
      terrainGroup.add(terrainMesh);

      // 8. Add Groups to Scene
      scene.add(raftsGroupRef.current);
      scene.add(linesGroupRef.current);
      scene.add(pilesGroupRef.current);
      scene.add(axesGridGroupRef.current);

      // 9. Coordinate Axes & Grid
      const grid = new THREE.GridHelper(1000, 50, 0x0284c7, 0xcbd5e1);
      grid.position.y = -18;
      axesGridGroupRef.current.add(grid);

      // Compass Rose on ground
      const compassGroup = new THREE.Group();
      compassGroup.position.set(380, 2, -380);
      const ringGeom = new THREE.RingGeometry(18, 20, 32);
      ringGeom.rotateX(-Math.PI / 2);
      const ringMat = new THREE.MeshBasicMaterial({ color: 0x0284c7, side: THREE.DoubleSide });
      compassGroup.add(new THREE.Mesh(ringGeom, ringMat));

      // North Arrow
      const arrowGeom = new THREE.ConeGeometry(4, 14, 16);
      arrowGeom.rotateX(Math.PI / 2);
      arrowGeom.translate(0, 0, -10);
      const arrowMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
      compassGroup.add(new THREE.Mesh(arrowGeom, arrowMat));
      axesGridGroupRef.current.add(compassGroup);

      // 10. Wind Particle Flow System
      const particleCount = 1200;
      const particleGeom = new THREE.BufferGeometry();
      const pPositions = new Float32Array(particleCount * 3);
      for (let i = 0; i < particleCount; i++) {
        pPositions[i * 3 + 0] = (Math.random() - 0.5) * 900;
        pPositions[i * 3 + 1] = 2 + Math.random() * 25; // 2m to 27m above water
        pPositions[i * 3 + 2] = (Math.random() - 0.5) * 900;
      }
      particleGeom.setAttribute('position', new THREE.BufferAttribute(pPositions, 3));
      particlePositionsRef.current = pPositions;

      const pMat = new THREE.PointsMaterial({
        color: 0x38bdf8,
        size: 3.5,
        transparent: true,
        opacity: 0.65,
        blending: THREE.AdditiveBlending
      });
      const particles = new THREE.Points(particleGeom, pMat);
      scene.add(particles);
      windParticlesRef.current = particles;

      // 11. Animation Loop
      let animationFrameId: number;
      const clock = new THREE.Clock();

      const animate = () => {
        animationFrameId = requestAnimationFrame(animate);

        const delta = clock.getDelta();
        const time = clock.getElapsedTime();

        // Animate water subtle wave
        if (waterMeshRef.current) {
          const waterPos = waterMeshRef.current.geometry.attributes.position;
          for (let i = 0; i < waterPos.count; i += 3) {
            const u = waterPos.getX(i);
            const v = waterPos.getZ(i);
            const waveY = Math.sin(u * 0.05 + time * 1.5) * 0.08 + Math.cos(v * 0.05 + time * 1.2) * 0.08;
            waterPos.setY(i, waveY);
          }
          waterPos.needsUpdate = true;
        }

        // Animate Wind Particle Streamlines
        if (windParticlesRef.current && particlePositionsRef.current) {
          const pos = particlePositionsRef.current;
          const rad = (windParams.direction * Math.PI) / 180;
          const speed = (windParams.speed * delta * 12) / 10; // scaled visual velocity
          const dx = Math.sin(rad) * speed;
          const dz = -Math.cos(rad) * speed;

          for (let i = 0; i < particleCount; i++) {
            pos[i * 3 + 0] += dx;
            pos[i * 3 + 2] += dz;

            // Lift over rafts when passing near center
            const x = pos[i * 3 + 0];
            const z = pos[i * 3 + 2];
            if (Math.abs(x) < 250 && Math.abs(z) < 250) {
              pos[i * 3 + 1] = 5 + Math.sin(time * 3 + i) * 1.5;
            }

            // Boundary wrapping
            if (pos[i * 3 + 0] > 450) pos[i * 3 + 0] = -450;
            if (pos[i * 3 + 0] < -450) pos[i * 3 + 0] = 450;
            if (pos[i * 3 + 2] > 450) pos[i * 3 + 2] = -450;
            if (pos[i * 3 + 2] < -450) pos[i * 3 + 2] = 450;
          }
          windParticlesRef.current.geometry.attributes.position.needsUpdate = true;
        }

        // Floating dynamic motion of rafts
        raftMeshesRef.current.forEach(({ group, basePosition }) => {
          const rad = (windParams.direction * Math.PI) / 180;
          // Dynamic surge offset proportional to wind speed squared
          const windDynamicFactor = Math.pow(windParams.speed / 30, 2) * 2.5;
          const driftX = Math.sin(rad) * windDynamicFactor;
          const driftZ = -Math.cos(rad) * windDynamicFactor;
          const bobbing = Math.sin(time * 2 + basePosition.x) * 0.05;

          group.position.set(basePosition.x + driftX, basePosition.y + bobbing, basePosition.z + driftZ);
        });

        controls.update();
        renderer.render(scene, camera);
      };

      animate();

      // Resize listener
      const handleResize = () => {
        if (!container || !renderer || !camera) return;
        const w = container.clientWidth;
        const h = container.clientHeight;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      };
      window.addEventListener('resize', handleResize);

      return () => {
        cancelAnimationFrame(animationFrameId);
        window.removeEventListener('resize', handleResize);
        if (container.contains(renderer.domElement)) {
          container.removeChild(renderer.domElement);
        }
        renderer.dispose();
      };
    }, []);

    // Build Procedural 3D Model: 12 Raft Clusters & 299 Mooring Lines & Piles
    useEffect(() => {
      const raftsGroup = raftsGroupRef.current;
      const linesGroup = linesGroupRef.current;
      const pilesGroup = pilesGroupRef.current;

      // Clear existing children
      while (raftsGroup.children.length > 0) {
        raftsGroup.remove(raftsGroup.children[0]);
      }
      while (linesGroup.children.length > 0) {
        linesGroup.remove(linesGroup.children[0]);
      }
      while (pilesGroup.children.length > 0) {
        pilesGroup.remove(pilesGroup.children[0]);
      }
      raftMeshesRef.current.clear();
      lineMeshesRef.current.clear();

      // 1. Build 12 Solar FPV Raft Clusters
      const raftPlatformMat = new THREE.MeshStandardMaterial({
        color: 0x334155, // dark pontoon base
        roughness: 0.4,
        metalness: 0.3
      });

      const solarPanelMat = new THREE.MeshStandardMaterial({
        color: 0x0f2744, // deep navy solar cell
        roughness: 0.2,
        metalness: 0.8
      });

      const activeRaftPolygons = designVersion === 'v1' ? huoiVanhRaftPolygons : huoiVanhRaftPolygonsV2;
      const activeCoordinates = designVersion === 'v1' ? huoiVanhCoordinates : huoiVanhCoordinatesV2;
      const waterOffset = waterLevel_m - WATER_DATUM_Z;

      activeRaftPolygons.forEach((raft) => {
        const raftGroup = new THREE.Group();
        raftGroup.name = `Raft_${raft.id}`;

        // Compute centroid
        let sumX = 0;
        let sumY = 0;
        raft.points.forEach((p) => {
          sumX += p.x;
          sumY += p.y;
        });
        const cx = sumX / raft.points.length;
        const cy = sumY / raft.points.length;

        const threeCenterX = cx - ORIGIN_X;
        const threeCenterZ = -(cy - ORIGIN_Y);

        // Raft Polygon Shape
        const shape = new THREE.Shape();
        raft.points.forEach((p, idx) => {
          const relX = p.x - cx;
          const relZ = -(p.y - cy);
          if (idx === 0) {
            shape.moveTo(relX, relZ);
          } else {
            shape.lineTo(relX, relZ);
          }
        });
        shape.closePath();

        // Extrude floating pontoon body
        const extrudeSettings = {
          depth: 0.7,
          bevelEnabled: true,
          bevelSegments: 2,
          steps: 1,
          bevelSize: 0.1,
          bevelThickness: 0.1
        };
        const geom = new THREE.ExtrudeGeometry(shape, extrudeSettings);
        geom.rotateX(Math.PI / 2); // align flat with water plane

        const platformMesh = new THREE.Mesh(geom, raftPlatformMat);
        platformMesh.castShadow = true;
        platformMesh.receiveShadow = true;
        raftGroup.add(platformMesh);

        // Add solar panel arrays on top
        const bbox = new THREE.Box3().setFromObject(platformMesh);
        const sizeX = bbox.max.x - bbox.min.x;
        const sizeZ = bbox.max.z - bbox.min.z;

        const rowCount = Math.max(3, Math.floor(sizeZ / 8));
        const colCount = Math.max(3, Math.floor(sizeX / 6));

        for (let r = 0; r < rowCount; r++) {
          for (let c = 0; c < colCount; c++) {
            const panelGeom = new THREE.BoxGeometry(5.2, 0.12, 3.8);
            panelGeom.rotateX(-0.26); // 15-degree tilt facing South
            const panel = new THREE.Mesh(panelGeom, solarPanelMat);
            const px = bbox.min.x + (c + 0.5) * (sizeX / colCount);
            const pz = bbox.min.z + (r + 0.5) * (sizeZ / rowCount);
            panel.position.set(px, 0.45, pz);
            panel.castShadow = true;
            raftGroup.add(panel);
          }
        }

        // Perimeter walkway outline
        const edgesGeom = new THREE.EdgesGeometry(geom);
        const edgesLine = new THREE.LineSegments(
          edgesGeom,
          new THREE.LineBasicMaterial({ color: 0x64748b, linewidth: 2 })
        );
        raftGroup.add(edgesLine);

        // Position raft cluster group in world at current water level
        const basePos = new THREE.Vector3(threeCenterX, 0.2 + waterOffset, threeCenterZ);
        raftGroup.position.copy(basePos);
        raftGroup.userData = {
          type: 'raft',
          id: raft.id,
          title: `BÈ ${raft.id}`,
          area: raft.area_m2
        };

        raftsGroup.add(raftGroup);
        raftMeshesRef.current.set(raft.id, { group: raftGroup, basePosition: basePos });
      });

      // 2. Build Mooring Lines (Catenary Curves) and Piles
      const pileShoreGeom = new THREE.CylinderGeometry(0.45, 0.45, 2.5, 16);
      const pileShoreMat = new THREE.MeshStandardMaterial({
        color: 0x475569, // concrete shore pile
        roughness: 0.7,
        metalness: 0.2
      });

      const pileBedGeom = new THREE.BoxGeometry(1.6, 1.2, 1.6);
      const pileBedMat = new THREE.MeshStandardMaterial({
        color: 0x1e293b, // submerged concrete sinker block
        roughness: 0.9,
        metalness: 0.1
      });

      activeCoordinates.forEach((coord) => {
        // Start: Raft connection bollard tracks water level
        const pRaft = new THREE.Vector3(coord.xRaft - ORIGIN_X, 0.2 + waterOffset, -(coord.yRaft - ORIGIN_Y));

        // End: Anchor location
        const anchorElev = (coord.zAnchor - WATER_DATUM_Z);
        const pAnchor = new THREE.Vector3(
          coord.xAnchor - ORIGIN_X,
          anchorElev,
          -(coord.yAnchor - ORIGIN_Y)
        );

        // Generate 3D Catenary Spline Curve
        const points: THREE.Vector3[] = [];
        const segments = 16;
        const isBed = coord.type === 'BED';

        // Catenary sag factor tightens as water rises, sags as water drops
        const tensionSagFactor = Math.max(0.4, 1.0 - (waterOffset / 12));

        for (let i = 0; i <= segments; i++) {
          const t = i / segments;
          const x = THREE.MathUtils.lerp(pRaft.x, pAnchor.x, t);
          const z = THREE.MathUtils.lerp(pRaft.z, pAnchor.z, t);
          let y = THREE.MathUtils.lerp(pRaft.y, pAnchor.y, t);

          if (isBed) {
            // Bed anchor: cable sags downward towards lakebed
            const sagFactor = 4 * t * (1 - t);
            const sagDepth = Math.min(8.0, coord.span * 0.12) * tensionSagFactor;
            y -= sagFactor * sagDepth;
          } else {
            // Shore anchor: slight natural sag
            const sagFactor = 4 * t * (1 - t);
            y -= sagFactor * Math.min(2.5, coord.span * 0.05) * tensionSagFactor;
          }
          points.push(new THREE.Vector3(x, y, z));
        }

        const lineGeom = new THREE.BufferGeometry().setFromPoints(points);
        const lineMat = new THREE.LineBasicMaterial({
          color: isBed ? 0x0284c7 : 0x10b981,
          linewidth: 2
        });
        const lineMesh = new THREE.Line(lineGeom, lineMat);
        lineMesh.userData = {
          type: 'line',
          code: coord.code,
          raft: coord.raft,
          anchorType: coord.type,
          span: coord.span,
          azimuth: coord.azimuth,
          zAnchor: coord.zAnchor
        };
        linesGroup.add(lineMesh);
        lineMeshesRef.current.set(coord.code, { line: lineMesh, material: lineMat, tension: 0 });

        // Add 3D Anchor Pile
        if (isBed) {
          const bedPile = new THREE.Mesh(pileBedGeom, pileBedMat);
          bedPile.position.set(pAnchor.x, pAnchor.y - 0.4, pAnchor.z);
          bedPile.castShadow = true;
          bedPile.receiveShadow = true;
          bedPile.userData = { type: 'pile', code: coord.code, pileType: 'BED_ANCHOR' };
          pilesGroup.add(bedPile);
        } else {
          const shorePile = new THREE.Mesh(pileShoreGeom, pileShoreMat);
          shorePile.position.set(pAnchor.x, pAnchor.y + 0.8, pAnchor.z);
          shorePile.castShadow = true;
          shorePile.receiveShadow = true;
          shorePile.userData = { type: 'pile', code: coord.code, pileType: 'SHORE_PILE' };
          pilesGroup.add(shorePile);
        }
      });
    }, [designVersion, waterLevel_m]);

    // Update Line Tension Colors & Aerodynamic Drag forces when wind changes
    useEffect(() => {
      const windRad = (windParams.direction * Math.PI) / 180;
      const windVel = windParams.speed * windParams.gustFactor;
      const activeCoordinates = designVersion === 'v1' ? huoiVanhCoordinates : huoiVanhCoordinatesV2;

      lineMeshesRef.current.forEach((item, code) => {
        const coord = activeCoordinates.find((c) => c.code === code);
        if (!coord) return;

        // Angle between wind vector and anchor line azimuth
        const lineRad = (coord.azimuth * Math.PI) / 180;
        const angleDiff = Math.abs(windRad - lineRad);
        const cosFactor = Math.cos(angleDiff);

        // Lines opposing the wind take heavy tension
        // Base pre-tension ~20 kN + dynamic aerodynamic tension up to ~110 kN
        const dynamicTension = Math.max(0, cosFactor) * Math.pow(windVel / 29.7, 2) * 95;
        const totalTension = 22 + dynamicTension;
        const allowableTension = 140; // kN for PES cable
        const ratio = totalTension / allowableTension;

        item.tension = totalTension;

        // Dynamic Color: Emerald (< 50%) -> Amber (50-80%) -> Red (> 80%)
        if (ratio < 0.5) {
          item.material.color.setHex(0x10b981); // Emerald safe
        } else if (ratio < 0.8) {
          item.material.color.setHex(0xf59e0b); // Amber warning
        } else {
          item.material.color.setHex(0xef4444); // Red critical
        }

        // Highlight if this is the currently selected element
        if (selectedElement && selectedElement.id === code) {
          item.material.color.setHex(0xfacc15); // bright gold highlight
        }
      });
    }, [windParams, selectedElement, designVersion]);

    // Handle Layer Visibility Toggles
    useEffect(() => {
      raftsGroupRef.current.visible = layers.rafts;
      linesGroupRef.current.visible = layers.mooringLines;
      pilesGroupRef.current.visible = layers.shorePiles || layers.bedPiles;
      if (waterMeshRef.current) waterMeshRef.current.visible = layers.waterSurface;
      terrainGroupRef.current.visible = layers.lakeTerrain;
      if (windParticlesRef.current) windParticlesRef.current.visible = layers.windStreamlines;
      axesGridGroupRef.current.visible = layers.axesAndGrid;

      // Solar panel children inside rafts
      raftMeshesRef.current.forEach(({ group }) => {
        group.children.forEach((child) => {
          if (child instanceof THREE.Mesh && child.geometry instanceof THREE.BoxGeometry) {
            child.visible = layers.solarPanels;
          }
        });
      });
    }, [layers]);

    // Handle Water Level elevation change
    useEffect(() => {
      if (waterMeshRef.current) {
        waterMeshRef.current.position.y = waterLevel_m - WATER_DATUM_Z;
      }
    }, [waterLevel_m]);

    // Handle Uploaded IFC Model insertion
    useEffect(() => {
      const scene = sceneRef.current;
      if (!scene) return;

      if (ifcGroupRef.current) {
        scene.remove(ifcGroupRef.current);
        ifcGroupRef.current = null;
      }

      if (ifcData && ifcData.rootGroup) {
        scene.add(ifcData.rootGroup);
        ifcGroupRef.current = ifcData.rootGroup;
        ifcData.rootGroup.visible = layers.ifcModel;
      }
    }, [ifcData, layers.ifcModel]);

    // Pointer Click & Hover Raycaster for Object Inspection
    const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
      const container = containerRef.current;
      const camera = cameraRef.current;
      const scene = sceneRef.current;
      if (!container || !camera || !scene) return;

      const rect = container.getBoundingClientRect();
      mouseRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouseRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycasterRef.current.setFromCamera(mouseRef.current, camera);

      // Check intersections with rafts
      const raftIntersects = raycasterRef.current.intersectObjects(raftsGroupRef.current.children, true);
      if (raftIntersects.length > 0) {
        let current: THREE.Object3D | null = raftIntersects[0].object;
        while (current && !current.userData.id && current.parent) {
          current = current.parent;
        }
        if (current && current.userData.type === 'raft') {
          const raftId = current.userData.id;
          const activeRaftPolygons = designVersion === 'v1' ? huoiVanhRaftPolygons : huoiVanhRaftPolygonsV2;
          const activeCoordinates = designVersion === 'v1' ? huoiVanhCoordinates : huoiVanhCoordinatesV2;
          const raft = activeRaftPolygons.find((r) => r.id === raftId);
          onSelectElement({
            type: 'raft',
            id: `BÈ ${raftId}`,
            title: `Cụm Bè Pin Mặt Trời BÈ ${raftId}`,
            data: {
              'Tên cụm': `BÈ ${raftId}`,
              'Diện tích đo CAD': `${raft?.area_m2 || 0} m²`,
              'Số lượng cáp neo': activeCoordinates.filter((c) => c.raft === `BÈ ${raftId}`).length,
              'Tọa độ tâm': `X=${(current.position.x + ORIGIN_X).toFixed(1)}m, Y=${(-current.position.z + ORIGIN_Y).toFixed(1)}m`,
              'Trạng thái': 'Đang vận hành bình thường'
            }
          });
          return;
        }
      }

      // Check intersections with mooring lines
      const lineIntersects = raycasterRef.current.intersectObjects(linesGroupRef.current.children, false);
      if (lineIntersects.length > 0) {
        const lineMesh = lineIntersects[0].object;
        const u = lineMesh.userData;
        if (u && u.type === 'line') {
          const item = lineMeshesRef.current.get(u.code);
          onSelectElement({
            type: 'line',
            id: u.code,
            title: `Tuyến Cáp Neo ${u.code}`,
            data: {
              'Mã tuyến cáp': u.code,
              'Thuộc cụm bè': u.raft,
              'Loại neo': u.anchorType === 'SHORE' ? 'Cọc neo bờ (SHORE)' : 'Cọc đáy hồ (BED)',
              'Chiều dài nhịp (Span)': `${u.span} m`,
              'Góc phương vị (Azimuth)': `${u.azimuth}°`,
              'Cao trình neo (Z)': `${u.zAnchor} m`,
              'Lực căng tính toán': `${item ? item.tension.toFixed(1) : '24.5'} kN`,
              'Hệ số an toàn SF': `${(140 / (item ? item.tension : 24.5)).toFixed(2)} (> 1.67 ĐẠT)`
            }
          });
          return;
        }
      }

      // Deselect if clicking empty water/sky
      onSelectElement(null);
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
      const container = containerRef.current;
      const camera = cameraRef.current;
      if (!container || !camera) return;

      const rect = container.getBoundingClientRect();
      mouseRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouseRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycasterRef.current.setFromCamera(mouseRef.current, camera);
      const intersects = raycasterRef.current.intersectObjects([
        ...raftsGroupRef.current.children,
        ...linesGroupRef.current.children
      ]);

      if (intersects.length > 0) {
        const obj = intersects[0].object;
        if (obj.userData.type === 'line') {
          setHoveredInfo(`Tuyến cáp: ${obj.userData.code} (${obj.userData.anchorType})`);
        } else if (obj.userData.type === 'raft' || obj.parent?.userData.type === 'raft') {
          const id = obj.userData.id || obj.parent?.userData.id;
          setHoveredInfo(`Cụm Bè ${id}`);
        }
      } else {
        setHoveredInfo(null);
      }
    };

    return (
      <div className="relative w-full h-full min-h-[580px] bg-slate-900 rounded-2xl overflow-hidden shadow-xl border border-slate-700/60 select-none">
        {/* Three.js Canvas Container */}
        <div
          ref={containerRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          className="w-full h-full cursor-grab active:cursor-grabbing"
        />

        {/* Hover Tooltip Overlay */}
        {hoveredInfo && (
          <div className="absolute top-4 left-4 pointer-events-none bg-slate-900/90 backdrop-blur-md text-white text-xs font-mono px-3 py-1.5 rounded-lg border border-brand-500/40 shadow-lg animate-fade-in flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-brand-400 animate-pulse" />
            {hoveredInfo}
          </div>
        )}

        {/* Wind Compass HUD overlay in corner */}
        <div className="absolute bottom-4 left-4 pointer-events-none bg-slate-900/85 backdrop-blur-md p-3 rounded-xl border border-slate-700/70 text-white shadow-xl text-xs space-y-1">
          <div className="flex items-center gap-2 text-brand-300 font-semibold uppercase tracking-wider text-[10px]">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            Trường gió động lực 3D
          </div>
          <div className="font-mono text-sm font-bold text-slate-100">
            {windParams.speed.toFixed(1)} m/s ({((windParams.speed * 3.6)).toFixed(0)} km/h)
          </div>
          <div className="text-[11px] text-slate-400 flex items-center gap-2">
            <span>Hướng gió:</span>
            <span className="text-amber-300 font-mono font-bold">{windParams.direction}°</span>
            <span>(Hệ tọa độ Bắc 0°)</span>
          </div>
        </div>
      </div>
    );
  }
);
