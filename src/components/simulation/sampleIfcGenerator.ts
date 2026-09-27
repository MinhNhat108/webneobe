import huoiVanhRaftPolygons from '../../data/huoiVanhRaftPolygons.json';
import huoiVanhCoordinates from '../../data/huoiVanhCoordinates.json';

/**
 * Generates a valid STEP-format IFC2X3 file for the Huổi Vanh Floating Solar PV project.
 * Contains Project, Site, Water surface, Raft assemblies, Mooring members, and Piles.
 */
export function generateHuoiVanhSampleIfc(): string {
  const timestamp = new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15);

  let idCounter = 1;
  const nextId = () => `#${idCounter++}`;

  const lines: string[] = [];

  // Header
  lines.push('ISO-10303-21;');
  lines.push('HEADER;');
  lines.push("FILE_DESCRIPTION(('ViewDefinition [CoordinationView]','IFC2X3'),'2;1');");
  lines.push(`FILE_NAME('Huoi_Vanh_FPV_Mooring_Model.ifc','${timestamp}',('Technical Engineer'),('EVN / PECC2'),'WebNeoBe Simulation 1.0','WebNeoBe IFC Exporter','Approved');`);
  lines.push("FILE_SCHEMA(('IFC2X3'));");
  lines.push('ENDSEC;');
  lines.push('DATA;');

  // Organization, Person, Application, OwnerHistory
  const idOwnerHistory = '#1';
  const idPersonOrg = '#2';
  const idApp = '#3';
  const idPerson = '#4';
  const idOrg = '#5';
  lines.push(`${idOwnerHistory}=IFCOWNERHISTORY(${idPersonOrg},${idApp},.READWRITE.,.NOCHANGE.,$,$,$,1700000000);`);
  lines.push(`${idPersonOrg}=IFCPERSONANDORGANIZATION(${idPerson},${idOrg},$);`);
  lines.push(`${idApp}=IFCAPPLICATION(${idOrg},'1.0','WebNeoBe 3D Simulation','WebNeoBe');`);
  lines.push(`${idPerson}=IFCPERSON($,'BIM_Engineer','Chu Giap',$,$,$,$,$);`);
  lines.push(`${idOrg}=IFCORGANIZATION($,'PECC2 Consulting','Hydropower & Solar Engineering',$,$);`);

  // Units
  const idSiMeter = '#6';
  const idSiRadian = '#7';
  const idSiSecond = '#8';
  const idUnitAssign = '#9';
  lines.push(`${idSiMeter}=IFCSIUNIT(*,.LENGTHUNIT.,$,.METRE.);`);
  lines.push(`${idSiRadian}=IFCSIUNIT(*,.PLANEANGLEUNIT.,$,.RADIAN.);`);
  lines.push(`${idSiSecond}=IFCSIUNIT(*,.TIMEUNIT.,$,.SECOND.);`);
  lines.push(`${idUnitAssign}=IFCUNITASSIGNMENT((${idSiMeter},${idSiRadian},${idSiSecond}));`);

  // World Coordinate System
  const idOrigin = '#10';
  const idAxisZ = '#11';
  const idAxisX = '#12';
  const idPlacement3D = '#13';
  lines.push(`${idOrigin}=IFCCARTESIANPOINT((0.,0.,0.));`);
  lines.push(`${idAxisZ}=IFCDIRECTION((0.,0.,1.));`);
  lines.push(`${idAxisX}=IFCDIRECTION((1.,0.,0.));`);
  lines.push(`${idPlacement3D}=IFCAXIS2PLACEMENT3D(${idOrigin},${idAxisZ},${idAxisX});`);

  // Geometric Representation Context
  const idGeomContext = '#14';
  lines.push(`${idGeomContext}=IFCGEOMETRICREPRESENTATIONCONTEXT($,'Model',3,1.E-05,${idPlacement3D},$);`);

  // Project
  const idProject = '#15';
  lines.push(`${idProject}=IFCPROJECT('1M4k9G0qX9Qv6X2P4p0A1b',${idOwnerHistory},'DuAn_DMT_LongHo_HuoiVanh','Mooring and Floating Solar PV Raft System',$,$,$,(${idGeomContext}),${idUnitAssign});`);

  // Site
  const idSitePlacement = '#16';
  const idSite = '#17';
  lines.push(`${idSitePlacement}=IFCLOCALPLACEMENT($,${idPlacement3D});`);
  lines.push(`${idSite}=IFCSITE('2N5l0H1rY0Rw7Y3Q5q1B2c',${idOwnerHistory},'HoChua_HuoiVanh','Reservoir Water Surface and Mooring Grid',.ELEMENT.,${idSitePlacement},$,$,.USERDEFINED.,$,$,384.5,$,$);`);

  // Rafts as Element Assemblies (sample 12 rafts)
  idCounter = 18;
  huoiVanhRaftPolygons.slice(0, 12).forEach((raft, idx) => {
    const raftName = `BE_${raft.id}`;
    const cx = (raft.points.reduce((acc, p) => acc + p.x, 0) / raft.points.length).toFixed(3);
    const cy = (raft.points.reduce((acc, p) => acc + p.y, 0) / raft.points.length).toFixed(3);

    const ptId = nextId();
    const plcId = nextId();
    const assyId = nextId();

    lines.push(`${ptId}=IFCCARTESIANPOINT((${cx},${cy},384.5));`);
    lines.push(`${plcId}=IFCLOCALPLACEMENT(${idSitePlacement},IFCAXIS2PLACEMENT3D(${ptId},${idAxisZ},${idAxisX}));`);
    lines.push(`${assyId}=IFCELEMENTASSEMBLY('3O6m1I2sZ1Sx8Z4R6r2C${idx.toString().padStart(2, '0')}',${idOwnerHistory},'${raftName}','FPV Solar Raft Cluster - Area: ${raft.area_m2}m2',$,${plcId},$,$,.NOTDEFINED.);`);
  });

  // Piles & Anchor lines sample (first 30 lines)
  huoiVanhCoordinates.slice(0, 30).forEach((line, idx) => {
    const ptRaft = nextId();
    const ptAnchor = nextId();
    const pileId = nextId();
    const lineId = nextId();

    lines.push(`${ptRaft}=IFCCARTESIANPOINT((${line.xRaft.toFixed(3)},${line.yRaft.toFixed(3)},384.5));`);
    lines.push(`${ptAnchor}=IFCCARTESIANPOINT((${line.xAnchor.toFixed(3)},${line.yAnchor.toFixed(3)},${line.zAnchor.toFixed(3)}));`);
    lines.push(`${pileId}=IFCPILE('4P7n2J3tA2Ty9A5S7s3D${idx.toString().padStart(2, '0')}',${idOwnerHistory},'COC_${line.code}','${line.type === 'SHORE' ? 'Shore Pile D0.45m' : 'Bed Anchor Pile D0.35m'}',$,IFCLOCALPLACEMENT(${idSitePlacement},IFCAXIS2PLACEMENT3D(${ptAnchor},${idAxisZ},${idAxisX})),$,$,.USERDEFINED.);`);
    lines.push(`${lineId}=IFCMEMBER('5Q8o3K4uB3Uz0B6T8t4E${idx.toString().padStart(2, '0')}',${idOwnerHistory},'CAP_${line.code}','Mooring Line Span: ${line.span}m Azimuth: ${line.azimuth}deg',$,IFCLOCALPLACEMENT(${idSitePlacement},IFCAXIS2PLACEMENT3D(${ptRaft},${idAxisZ},${idAxisX})),$,$);`);
  });

  lines.push('ENDSEC;');
  lines.push('END-ISO-10303-21;');

  return lines.join('\n');
}
