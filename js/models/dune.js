export function createDuneModels({THREE,M,SEG}){
// ИСПРАВЛЕННЫЙ ШАЙ-ХУЛУД: непрерывное тело, пасть рядом с головой
function shaiHulud(size=1){
  const g=new THREE.Group();

  const bodyM=M.animal(0x8a7a5a);
  const ringM=M.animal(0x5a4a3a);
  const mouthM=M.animal(0x4a3a2a);
  const toothM=M.animal(0xe8e8e8);

  const segments=[];
  const segCount=14;
  const spacing=1.05*size;

  for(let i=0;i<segCount;i++){
    const r=Math.max(0.22,(0.85-i*0.02))*size;

    const s=new THREE.Mesh(new THREE.SphereGeometry(r,SEG(8),SEG(6)),bodyM);
    s.scale.set(1.45,0.9,0.9);
    s.position.set(-i*spacing,0,0);
    s.castShadow=true;

    g.add(s);
    segments.push(s);

    if(i>0&&i<segCount-1){
      const ring=new THREE.Mesh(new THREE.TorusGeometry(r*1.02,0.06*size,6,12),ringM);
      ring.rotation.y=Math.PI/2;
      ring.position.set(-i*spacing,0,0);
      g.add(ring);
    }
  }

  const head=segments[0];

  const mouth=new THREE.Mesh(
    new THREE.CylinderGeometry(0.5*size,0.65*size,0.55*size,SEG(12)),
    mouthM
  );

  mouth.rotation.z=Math.PI/2;
  mouth.position.set(0.75*size,0,0);
  mouth.userData.isMouth=true;

  g.add(mouth);

  for(let i=0;i<10;i++){
    const a=i/10*Math.PI*2;

    const tooth=new THREE.Mesh(new THREE.ConeGeometry(0.08*size,0.35*size,4),toothM);
    tooth.position.set(
      1.05*size,
      Math.cos(a)*0.5*size,
      Math.sin(a)*0.5*size
    );

    tooth.rotation.z=-Math.PI/2;

    g.add(tooth);
  }

  return{
    group:g,
    legs:[],
    head,
    tail:segments[segments.length-1],
    mouth,
    ears:[],
    worm:true,
    segments,
    cfg:{
      speed:25,
      states:['underground','whale','emerge','attack','submerge']
    }
  };
}


function duneTransport(){
  const group=new THREE.Group();
  const hullMat=M.animal(0x4a5360);
  const wingMat=M.animal(0x28313a);
  const engineMat=M.animal(0x8f9a9f);

  const hull=new THREE.Mesh(new THREE.BoxGeometry(6,1.2,2.1),hullMat);
  hull.castShadow=true;
  group.add(hull);

  const nose=new THREE.Mesh(new THREE.ConeGeometry(1.1,2.2,SEG(6)),hullMat);
  nose.rotation.z=-Math.PI/2;
  nose.position.x=4.1;
  group.add(nose);

  const wing=new THREE.Mesh(new THREE.BoxGeometry(4.6,.16,8),wingMat);
  wing.position.set(-.4,-.1,0);
  wing.castShadow=true;
  group.add(wing);

  for(const z of[-2.6,2.6]){
    const engine=new THREE.Mesh(new THREE.CylinderGeometry(.48,.48,1.8,SEG(8)),engineMat);
    engine.rotation.z=Math.PI/2;
    engine.position.set(.4,-.25,z);
    group.add(engine);
  }

  return group;
}


  return{shaiHulud,duneTransport};
}
