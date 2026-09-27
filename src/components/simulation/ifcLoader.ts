import * as THREE from 'three';
import * as WebIFC from 'web-ifc';
import { LoadedIfcMetadata } from './types';

let ifcApiInstance: WebIFC.IfcAPI | null = null;
let isInitializing = false;
let initPromise: Promise<WebIFC.IfcAPI> | null = null;

/**
 * Initializes the WebIFC wasm engine.
 */
export async function getIfcApi(): Promise<WebIFC.IfcAPI> {
  if (ifcApiInstance) return ifcApiInstance;
  if (isInitializing && initPromise) return initPromise;

  isInitializing = true;
  initPromise = (async () => {
    const api = new WebIFC.IfcAPI();
    
    // Determine path to wasm
    const baseUrl = import.meta.env.BASE_URL || './';
    const wasmPath = baseUrl.endsWith('/') ? `${baseUrl}wasm/` : `${baseUrl}/wasm/`;
    api.SetWasmPath(wasmPath);
    
    await api.Init();
    ifcApiInstance = api;
    isInitializing = false;
    return api;
  })();

  return initPromise;
}

/**
 * Parses an uploaded IFC file or ArrayBuffer into Three.js 3D meshes.
 */
export async function parseIfcFile(
  fileOrBuffer: File | ArrayBuffer,
  onProgress?: (percent: number, stepText: string) => void
): Promise<LoadedIfcMetadata> {
  onProgress?.(5, 'Đang khởi tạo máy ảo WebAssembly...');
  const api = await getIfcApi();

  let buffer: ArrayBuffer;
  let fileName = 'custom_model.ifc';
  let fileSize = 0;

  if (fileOrBuffer instanceof File) {
    fileName = fileOrBuffer.name;
    fileSize = fileOrBuffer.size;
    onProgress?.(15, `Đang đọc file ${fileName} (${(fileSize / 1024).toFixed(1)} KB)...`);
    buffer = await fileOrBuffer.arrayBuffer();
  } else {
    buffer = fileOrBuffer;
    fileSize = buffer.byteLength;
  }

  onProgress?.(30, 'Đang phân tích cú pháp cấu trúc IFC...');
  const data = new Uint8Array(buffer);
  const modelID = api.OpenModel(data);

  onProgress?.(50, 'Đang trích xuất hình học 3D & vật liệu...');

  const rootGroup = new THREE.Group();
  rootGroup.name = `IFC_${fileName}`;

  const categoryGroups = {
    terrain: new THREE.Group(),
    rafts: new THREE.Group(),
    cables: new THREE.Group(),
    piles: new THREE.Group(),
    water: new THREE.Group(),
    other: new THREE.Group()
  };

  categoryGroups.terrain.name = 'IFC_Terrain';
  categoryGroups.rafts.name = 'IFC_Rafts';
  categoryGroups.cables.name = 'IFC_Cables';
  categoryGroups.piles.name = 'IFC_Piles';
  categoryGroups.water.name = 'IFC_Water';
  categoryGroups.other.name = 'IFC_Other';

  const counts = {
    terrain: 0,
    rafts: 0,
    cables: 0,
    piles: 0,
    water: 0,
    other: 0
  };

  try {
    const flatMeshes = api.LoadAllGeometry(modelID);
    const meshCount = flatMeshes.size();

    // Default materials for IFC components
    const materials = {
      terrain: new THREE.MeshStandardMaterial({ color: 0x4d7c0f, roughness: 0.9, metalness: 0.1 }),
      rafts: new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.3, metalness: 0.6 }),
      cables: new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.4, metalness: 0.8 }),
      piles: new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.7, metalness: 0.3 }),
      water: new THREE.MeshStandardMaterial({ color: 0x0ea5e9, roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.6 }),
      other: new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.5, metalness: 0.2 })
    };

    for (let i = 0; i < meshCount; i++) {
      if (i % 20 === 0 && onProgress) {
        const pct = 50 + Math.round((i / Math.max(1, meshCount)) * 40);
        onProgress(pct, `Đang xử lý hình học đối tượng ${i + 1}/${meshCount}...`);
      }

      const flatMesh = flatMeshes.get(i);
      const expressID = flatMesh.expressID;

      // Determine entity type name
      let entityTypeName = 'IFCOBJECT';
      try {
        const lineProps = api.GetLine(modelID, expressID);
        if (lineProps && lineProps.__proto__ && lineProps.__proto__.constructor) {
          entityTypeName = lineProps.__proto__.constructor.name || 'IFCOBJECT';
        }
      } catch {
        // Fallback if line type query fails
      }

      const nameLower = entityTypeName.toLowerCase();
      let cat: keyof typeof categoryGroups = 'other';

      if (nameLower.includes('site') || nameLower.includes('geographic') || nameLower.includes('terrain')) {
        cat = 'terrain';
      } else if (nameLower.includes('assembly') || nameLower.includes('raft') || nameLower.includes('panel') || nameLower.includes('proxy')) {
        cat = 'rafts';
      } else if (nameLower.includes('member') || nameLower.includes('cable') || nameLower.includes('tendon')) {
        cat = 'cables';
      } else if (nameLower.includes('pile') || nameLower.includes('footing') || nameLower.includes('column')) {
        cat = 'piles';
      } else if (nameLower.includes('space') || nameLower.includes('water')) {
        cat = 'water';
      }

      counts[cat]++;

      const geometries = flatMesh.geometries;
      for (let j = 0; j < geometries.size(); j++) {
        const placedGeom = geometries.get(j);
        const ifcGeom = api.GetGeometry(modelID, placedGeom.geometryExpressID);

        const vPtr = ifcGeom.GetVertexData();
        const vSize = ifcGeom.GetVertexDataSize();
        const iPtr = ifcGeom.GetIndexData();
        const iSize = ifcGeom.GetIndexDataSize();

        if (vSize === 0 || iSize === 0) continue;

        const totalVertices = vSize / 6;
        const rawVertices = new Float32Array((api as any).wasmModule.HEAPF32.buffer, vPtr, vSize);
        const rawIndices = new Uint32Array((api as any).wasmModule.HEAPU32.buffer, iPtr, iSize);

        const positions = new Float32Array(totalVertices * 3);
        const normals = new Float32Array(totalVertices * 3);

        for (let k = 0; k < totalVertices; k++) {
          positions[k * 3 + 0] = rawVertices[k * 6 + 0];
          positions[k * 3 + 1] = rawVertices[k * 6 + 1];
          positions[k * 3 + 2] = rawVertices[k * 6 + 2];
          normals[k * 3 + 0] = rawVertices[k * 6 + 3];
          normals[k * 3 + 1] = rawVertices[k * 6 + 4];
          normals[k * 3 + 2] = rawVertices[k * 6 + 5];
        }

        const bufferGeom = new THREE.BufferGeometry();
        bufferGeom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        bufferGeom.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
        bufferGeom.setIndex(new THREE.BufferAttribute(new Uint32Array(rawIndices), 1));

        let mat = materials[cat];
        if (placedGeom.color && (placedGeom.color.x !== 0 || placedGeom.color.y !== 0 || placedGeom.color.z !== 0)) {
          mat = new THREE.MeshStandardMaterial({
            color: new THREE.Color(placedGeom.color.x, placedGeom.color.y, placedGeom.color.z),
            opacity: placedGeom.color.w,
            transparent: placedGeom.color.w < 1.0,
            roughness: 0.5,
            metalness: 0.3
          });
        }

        const mesh = new THREE.Mesh(bufferGeom, mat);
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        const matrix = new THREE.Matrix4().fromArray(placedGeom.flatTransformation);
        mesh.applyMatrix4(matrix);

        mesh.userData = {
          expressID,
          entityType: entityTypeName,
          category: cat
        };

        categoryGroups[cat].add(mesh);
      }
    }
  } finally {
    api.CloseModel(modelID);
  }

  // Add category groups that have children to rootGroup
  Object.entries(categoryGroups).forEach(([, group]) => {
    if (group.children.length > 0) {
      rootGroup.add(group);
    }
  });

  onProgress?.(100, 'Hoàn thành nạp mô hình IFC!');

  const totalElements = Object.values(counts).reduce((a, b) => a + b, 0);

  return {
    fileName,
    fileSize,
    elementCount: totalElements,
    schema: 'IFC2X3 / IFC4',
    categories: counts,
    rootGroup
  };
}
