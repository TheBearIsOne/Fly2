export function createAircraftModels({THREE,M,COL,SEG}){
function makeWingGeo(chord,span,thick,bevel){
  const h=chord/2;
  const s=new THREE.Shape();

  s.moveTo(h,0);
  s.lineTo(h*.85,span*.88);
  s.quadraticCurveTo(h*.8,span,0,span);
  s.quadraticCurveTo(-h*.8,span,-h*.85,span*.88);
  s.lineTo(-h,0);
  s.lineTo(-h*.85,-span*.88);
  s.quadraticCurveTo(-h*.8,-span,0,-span);
  s.quadraticCurveTo(h*.8,-span,h*.85,-span*.88);
  s.closePath();

  const g=new THREE.ExtrudeGeometry(s,{
    depth:thick,
    bevelEnabled:true,
    bevelThickness:bevel,
    bevelSize:bevel,
    bevelSegments:1,
    curveSegments:SEG(6)
  });

  g.rotateX(-Math.PI/2);
  g.translate(0,-thick/2,0);
  g.computeVertexNormals();

  return g;
}

function hingeSurface(w,s,t,m,p){
  const pv=new THREE.Group();
  pv.position.copy(p);

  const g=new THREE.BoxGeometry(w,t,s);
  g.translate(-w/2,0,0);

  const me=new THREE.Mesh(g,m);
  me.castShadow=true;

  pv.add(me);

  return pv;
}

function paintedFuselage(prof,fn){
  const pts=prof.map(p=>new THREE.Vector2(p[0],p[1]));
  const g=new THREE.LatheGeometry(pts,SEG(20));

  g.rotateZ(-Math.PI/2);
  g.translate(-2,0,0);
  g.computeVertexNormals();

  const pos=g.attributes.position;
  const col=new Float32Array(pos.count*3);
  const t=new THREE.Color();

  for(let i=0;i<pos.count;i++){
    fn(t,pos.getX(i),pos.getY(i));

    col[i*3]=t.r;
    col[i*3+1]=t.g;
    col[i*3+2]=t.b;
  }

  g.setAttribute('color',new THREE.BufferAttribute(col,3));

  const m=new THREE.Mesh(g,M.bodyPainted());
  m.castShadow=true;

  return m;
}

const FUSE_PROFILE=[
  [.02,0],[.10,.15],[.18,.4],[.26,.8],[.34,1.3],[.42,1.9],[.48,2.4],
  [.52,2.9],[.54,3.3],[.55,3.6],[.52,3.85],[.45,4],[.35,4.1]
];

function cowlingMesh(m){
  const cp=[
    [.5,0],[.58,.18],[.63,.42],[.62,.62],[.55,.78],[.46,.86]
  ].map(p=>new THREE.Vector2(p[0],p[1]));

  const g=new THREE.LatheGeometry(cp,SEG(20));

  g.rotateZ(-Math.PI/2);
  g.translate(1.42,0,0);
  g.computeVertexNormals();

  const c=new THREE.Mesh(g,m);
  c.material.side=THREE.DoubleSide;
  c.castShadow=true;

  return c;
}

function tailUnit(mBody,mCtrl,fh){
  fh=fh||1;

  const o={};

  o.stab=new THREE.Mesh(makeWingGeo(1.15,1.8,.07,.025),mBody);
  o.stab.position.set(-1.72,.1,0);

  o.elev=hingeSurface(.36,3.2,.06,mCtrl,new THREE.Vector3(-2.3,.1,0));

  const fs=new THREE.Shape();

  fs.moveTo(-.55,0);
  fs.lineTo(.45,0);
  fs.quadraticCurveTo(.35,.9*fh,.05,1.25*fh);
  fs.quadraticCurveTo(-.25,1.4*fh,-.45,1.15*fh);
  fs.lineTo(-.55,.55*fh);
  fs.closePath();

  o.fin=new THREE.Mesh(
    new THREE.ExtrudeGeometry(fs,{
      depth:.09,
      bevelEnabled:true,
      bevelThickness:.03,
      bevelSize:.03,
      bevelSegments:1
    }),
    mBody
  );

  o.fin.castShadow=true;
  o.fin.position.set(-1.62,.3,-.045);

  o.rud=new THREE.Group();
  o.rud.position.set(-2.18,.85*fh,0);

  const rb=new THREE.Mesh(new THREE.BoxGeometry(.3,1*fh,.07),mBody);
  rb.geometry.translate(-.15,0,0);

  o.rud.add(rb);

  return o;
}

function radialEngine(g,x,r,n=9){
  const f=new THREE.Mesh(new THREE.CylinderGeometry(r,r,.08,SEG(16)),M.dark());
  f.rotation.z=Math.PI/2;
  f.position.set(x,0,0);
  g.add(f);

  for(let i=0;i<n;i++){
    const a=i/n*Math.PI*2;

    const c=new THREE.Mesh(new THREE.CylinderGeometry(.055,.055,.26,SEG(5)),M.dark());
    c.rotation.x=a;
    c.position.set(x+.05,Math.cos(a)*r*.62,Math.sin(a)*r*.62);

    g.add(c);
  }
}

function makeProp(blades,bm,tm,r=1.45){
  const p=new THREE.Group();

  const s=new THREE.Mesh(new THREE.ConeGeometry(.15,.34,SEG(12)),M.cream());
  s.rotation.z=-Math.PI/2;
  s.position.x=.12;

  p.add(s);

  for(let i=0;i<blades;i++){
    const h=new THREE.Group();
    h.rotation.x=i/blades*Math.PI*2;

    const b=new THREE.Mesh(new THREE.BoxGeometry(.05,r,.16),bm);
    b.position.y=r*.58;
    b.rotation.y=.35;

    h.add(b);

    if(tm){
      const t=new THREE.Mesh(new THREE.BoxGeometry(.05,.16,.16),tm);
      t.position.y=r*1.06;
      t.rotation.y=.35;

      h.add(t);
    }

    p.add(h);
  }

  return p;
}

function makeGear(g,o={}){
  const sm=o.strutMat||M.coral();
  const hm=o.hubMat||M.cream();

  const gear=new THREE.Group();

  for(const z of[.95,-.95]){
    const st=new THREE.Mesh(new THREE.CylinderGeometry(.045,.045,.95,SEG(6)),sm);
    st.position.set(.55,-.62,z*.62);
    st.rotation.x=z>0?-.55:.55;
    gear.add(st);

    const t=new THREE.Mesh(new THREE.CylinderGeometry(.28,.28,.15,SEG(14)),M.dark());
    t.rotation.x=Math.PI/2;
    t.position.set(.55,-1.02,z);
    gear.add(t);

    const h=new THREE.Mesh(new THREE.CylinderGeometry(.12,.12,.17,SEG(10)),hm);
    h.rotation.x=Math.PI/2;
    h.position.set(.55,-1.02,z);
    gear.add(h);

    if(o.pants){
      const p=new THREE.Mesh(new THREE.SphereGeometry(.34,SEG(10),SEG(8)),o.pants);
      p.scale.set(1.5,.9,.8);
      p.position.set(.62,-.98,z);
      gear.add(p);
    }
  }

  const ax=new THREE.Mesh(new THREE.CylinderGeometry(.04,.04,1.9,SEG(6)),sm);
  ax.rotation.x=Math.PI/2;
  ax.position.set(.55,-1.02,0);
  gear.add(ax);

  const tw=new THREE.Mesh(new THREE.CylinderGeometry(.09,.09,.07,SEG(10)),M.dark());
  tw.rotation.x=Math.PI/2;
  tw.position.set(-1.85,-.42,0);
  gear.add(tw);

  g.add(gear);

  return gear;
}

function wingUnit(mEdge,mMain,edgeGeo,mainGeo,ailSpan,flapSpan){
  const group=new THREE.Group();

  const we=new THREE.Mesh(edgeGeo,mEdge);
  const wm=new THREE.Mesh(mainGeo,mMain);

  wm.castShadow=true;

  group.add(we);
  group.add(wm);

  const aL=hingeSurface(.45,ailSpan,.07,mMain,new THREE.Vector3(-.25,0,3.25));
  const aR=hingeSurface(.45,ailSpan,.07,mMain,new THREE.Vector3(-.25,0,-3.25));
  const fL=hingeSurface(.5,flapSpan,.07,mMain,new THREE.Vector3(-.27,0,1.45));
  const fR=hingeSurface(.5,flapSpan,.07,mMain,new THREE.Vector3(-.27,0,-1.45));

  group.add(aL);
  group.add(aR);
  group.add(fL);
  group.add(fR);

  return{
    group,
    ailerons:{left:aL,right:aR},
    flaps:{left:fL,right:fR},
    wings:{edge:we,main:wm}
  };
}

function buildPropPlane(opts){
  const g=new THREE.Group();

  g.add(paintedFuselage(FUSE_PROFILE,opts.paint));
  g.add(cowlingMesh(opts.cowMat));

  radialEngine(g,2.16,.42,opts.cyl||9);

  const prop=makeProp(opts.blades,opts.propMat,opts.tipMat,opts.propR||1.45);
  prop.position.set(2.32,0,0);
  g.add(prop);

  const w=opts.wing;

  g.add(w.group);
  w.group.position.copy(opts.wingPos);

  const t=tailUnit(opts.tailMat,opts.tailCtrl,opts.fh||1);

  g.add(t.stab);
  g.add(t.elev);
  g.add(t.fin);
  g.add(t.rud);

  const gear=makeGear(g,opts.gear||{});

  return{
    group:g,
    propeller:prop,
    propellerR:opts.propR2||null,
    ailerons:w.ailerons,
    flaps:w.flaps,
    elevator:t.elev,
    rudder:t.rud,
    gear,
    wings:w.wings
  };
}

function buildToyPlane(){
  const w=wingUnit(
    M.coral(),
    M.body(),
    makeWingGeo(1.85,4.32,.08,.03),
    makeWingGeo(1.6,4.32,.16,.05),
    1.3,
    1.8
  );

  const can=new THREE.Mesh(
    new THREE.SphereGeometry(.48,SEG(16),SEG(10),0,Math.PI*2,0,Math.PI/2),
    M.glass()
  );

  can.scale.set(1.55,.95,1.05);
  can.position.set(.55,.4,0);

  const r=buildPropPlane({
    paint:(c,x,y)=>{
      if(x>1.12&&x<1.45)c.copy(new THREE.Color(COL.cream));
      else if(y<-.1&&x<1.12)c.copy(new THREE.Color(COL.cream));
      else c.copy(new THREE.Color(COL.turquoise));
    },
    cowMat:M.coral(),
    blades:2,
    propMat:M.cream(),
    tipMat:M.coral(),
    wing:w,
    wingPos:new THREE.Vector3(.55,-.18,0),
    tailMat:M.coral(),
    tailCtrl:M.coralDark()
  });

  r.group.add(can);

  return r;
}

function buildYellowBiplane(){
  const g=new THREE.Group();

  g.add(paintedFuselage(FUSE_PROFILE,(c,x)=>{
    if(x>-1.3&&x<-.7)c.copy(new THREE.Color(COL.red));
    else c.copy(new THREE.Color(COL.yellow));
  }));

  g.add(cowlingMesh(M.yellow()));

  radialEngine(g,2.16,.42);

  const prop=makeProp(3,M.wood(),null,1.5);
  prop.position.set(2.32,0,0);
  g.add(prop);

  const wl=new THREE.Mesh(makeWingGeo(1.5,4.3,.12,.04),M.yellow());
  wl.position.set(.55,-.35,0);
  g.add(wl);

  const wh=new THREE.Mesh(makeWingGeo(1.6,4.5,.12,.04),M.yellow());
  wh.castShadow=true;
  wh.position.set(.55,1.15,0);
  g.add(wh);

  const aL=hingeSurface(.42,1.2,.06,M.yellow(),new THREE.Vector3(-.16,-.35,3.2));
  const aR=hingeSurface(.42,1.2,.06,M.yellow(),new THREE.Vector3(-.16,-.35,-3.2));

  g.add(aL);
  g.add(aR);

  const fL=hingeSurface(.45,1.6,.06,M.yellow(),new THREE.Vector3(-.18,-.35,1.4));
  const fR=hingeSurface(.45,1.6,.06,M.yellow(),new THREE.Vector3(-.18,-.35,-1.4));

  g.add(fL);
  g.add(fR);

  const t=tailUnit(M.yellow(),M.yellow(),1);

  g.add(t.stab);
  g.add(t.elev);
  g.add(t.fin);
  g.add(t.rud);

  const gear=makeGear(g,{strutMat:M.wood(),hubMat:M.white()});

  return{
    group:g,
    propeller:prop,
    ailerons:{left:aL,right:aR},
    flaps:{left:fL,right:fR},
    elevator:t.elev,
    rudder:t.rud,
    gear,
    wings:{edge:wl,main:wh}
  };
}

function buildSkyCruiser(){
  const w=wingUnit(
    M.white(),
    M.white(),
    makeWingGeo(1.7,4.6,.14,.05),
    makeWingGeo(1.7,4.6,.14,.05),
    1.4,
    1.8
  );

  const can=new THREE.Mesh(
    new THREE.SphereGeometry(.46,SEG(16),SEG(10),0,Math.PI*2,0,Math.PI/2),
    M.glassDark()
  );

  can.scale.set(1.7,.9,1);
  can.position.set(.7,.42,0);

  const r=buildPropPlane({
    paint:(c,x,y)=>{
      if(y>-.18&&y<.02&&x<1.4)c.copy(new THREE.Color(COL.blue));
      else c.copy(new THREE.Color(COL.white));
    },
    cowMat:M.white(),
    blades:2,
    propMat:M.dark(),
    cyl:7,
    propR:1.4,
    wing:w,
    wingPos:new THREE.Vector3(.6,.78,0),
    tailMat:M.white(),
    tailCtrl:M.white(),
    gear:{strutMat:M.white(),hubMat:M.dark(),pants:M.white()}
  });

  r.group.add(can);

  return r;
}

function buildTwinProp(){
  const g=new THREE.Group();

  g.add(paintedFuselage(FUSE_PROFILE,(c,x,y)=>{
    if(x>1.0&&x<1.5)c.copy(new THREE.Color(COL.red));
    else if(y<-.15)c.copy(new THREE.Color(COL.red));
    else c.copy(new THREE.Color(COL.white));
  }));

  g.add(cowlingMesh(M.red()));

  const w=new THREE.Mesh(makeWingGeo(1.6,5.2,.12,.05),M.white());
  w.castShadow=true;
  w.position.set(.5,.35,0);
  g.add(w);

  const mkNac=()=>{
    const n=new THREE.Group();

    const nac=new THREE.Mesh(new THREE.CylinderGeometry(.32,.28,1.6,SEG(10)),M.red());
    nac.rotation.z=Math.PI/2;
    n.add(nac);

    const p=makeProp(3,M.dark(),null,1.3);
    p.position.x=.9;
    n.add(p);

    return p;
  };

  const nL=new THREE.Group();
  nL.position.set(.6,.35,1.6);

  const pL=mkNac();
  nL.add(pL);
  g.add(nL);

  const nR=new THREE.Group();
  nR.position.set(.6,.35,-1.6);

  const pR=mkNac();
  nR.add(pR);
  g.add(nR);

  const aL=hingeSurface(.42,1.6,.06,M.white(),new THREE.Vector3(-.2,.35,3.6));
  const aR=hingeSurface(.42,1.6,.06,M.white(),new THREE.Vector3(-.2,.35,-3.6));

  g.add(aL);
  g.add(aR);

  const fL=hingeSurface(.48,2.0,.06,M.white(),new THREE.Vector3(-.22,.35,1.6));
  const fR=hingeSurface(.48,2.0,.06,M.white(),new THREE.Vector3(-.22,.35,-1.6));

  g.add(fL);
  g.add(fR);

  const can=new THREE.Mesh(
    new THREE.SphereGeometry(.44,SEG(16),SEG(10),0,Math.PI*2,0,Math.PI/2),
    M.glassDark()
  );

  can.scale.set(1.8,.85,1);
  can.position.set(.6,.4,0);
  g.add(can);

  const t=tailUnit(M.white(),M.white(),1.1);

  g.add(t.stab);
  g.add(t.elev);
  g.add(t.fin);
  g.add(t.rud);

  const gear=makeGear(g,{strutMat:M.white(),hubMat:M.dark()});

  return{
    group:g,
    propeller:pL,
    propellerR:pR,
    ailerons:{left:aL,right:aR},
    flaps:{left:fL,right:fR},
    elevator:t.elev,
    rudder:t.rud,
    gear,
    wings:{edge:w,main:w}
  };
}

function buildAirship(){
  const g=new THREE.Group();

  const eM=M.cream();
  const rM=M.red();
  const wL=M.woodLight();
  const dM=M.dark();

  const env=new THREE.Mesh(new THREE.SphereGeometry(1,SEG(18),SEG(14)),eM);
  env.scale.set(7.5,3.1,3.1);
  env.castShadow=true;
  g.add(env);

  for(const[x,r]of[[-2.2,2.75],[.6,3.05],[3,2.5]]){
    const r2=new THREE.Mesh(new THREE.TorusGeometry(r,.07,SEG(6),SEG(24)),rM);
    r2.rotation.y=Math.PI/2;
    r2.position.x=x;
    g.add(r2);
  }

  const fV=new THREE.Mesh(new THREE.BoxGeometry(2.6,1.9,.12),rM);
  fV.position.set(-6.6,1.7,0);
  g.add(fV);

  const fVB=fV.clone();
  fVB.position.y=-1.7;
  g.add(fVB);

  const fH=new THREE.Mesh(new THREE.BoxGeometry(2.6,.12,1.9),rM);
  fH.position.set(-6.6,0,1.7);
  g.add(fH);

  const fH2=fH.clone();
  fH2.position.z=-1.7;
  g.add(fH2);

  const rud=new THREE.Group();
  rud.position.set(-6.9,1.7,0);

  const rm=new THREE.Mesh(new THREE.BoxGeometry(1.3,1.5,.1),rM);
  rm.geometry.translate(-.55,0,0);

  rud.add(rm);
  g.add(rud);

  const elev=new THREE.Group();
  elev.position.set(-6.9,0,0);

  const em=new THREE.Mesh(new THREE.BoxGeometry(1.2,.1,2.4),rM);
  em.geometry.translate(-.5,0,0);

  elev.add(em);
  g.add(elev);

  const dY=-3.45;

  const fl=new THREE.Mesh(new THREE.BoxGeometry(5.2,.18,2.2),wL);
  fl.position.set(0,dY,0);
  fl.receiveShadow=true;
  g.add(fl);

  const wF=new THREE.Mesh(new THREE.BoxGeometry(.14,1,2.2),wL);
  wF.position.set(2.6,dY+.5,0);
  g.add(wF);

  const wB=wF.clone();
  wB.position.x=-2.6;
  g.add(wB);

  const wL2=new THREE.Mesh(new THREE.BoxGeometry(5.2,1,.14),wL);
  wL2.position.set(0,dY+.5,1.1);
  g.add(wL2);

  const wR=wL2.clone();
  wR.position.z=-1.1;
  g.add(wR);

  const mk=()=>{
    const p=new THREE.Group();

    const s=new THREE.Mesh(new THREE.ConeGeometry(.08,.16,SEG(8)),dM);
    s.rotation.z=-Math.PI/2;
    p.add(s);

    for(let i=0;i<3;i++){
      const h=new THREE.Group();
      h.rotation.x=i*2.094;

      const b=new THREE.Mesh(new THREE.BoxGeometry(.025,.8,.07),dM);
      b.position.y=.4;

      h.add(b);
      p.add(h);
    }

    return p;
  };

  const nL=new THREE.Mesh(new THREE.CylinderGeometry(.28,.28,1.4,SEG(10)),dM);
  nL.rotation.z=Math.PI/2;
  nL.position.set(.3,dY+1.1,1.5);
  g.add(nL);

  const nR=nL.clone();
  nR.position.z=-1.5;
  g.add(nR);

  const pL=mk();
  pL.position.set(1.15,dY+1.1,1.5);
  g.add(pL);

  const pR=mk();
  pR.position.set(1.15,dY+1.1,-1.5);
  g.add(pR);

  const hm=new THREE.Mesh(new THREE.BoxGeometry(.35,.9,.7),wL);
  hm.position.set(2.1,dY+.55,0);
  g.add(hm);

  const deck={
    minX:-2.4,
    maxX:2.4,
    halfW:.95,
    y:dY+.09,
    helmX:1.7
  };

  return{
    group:g,
    propeller:pL,
    propellerR:pR,
    ailerons:{left:null,right:null},
    flaps:{left:null,right:null},
    elevator:elev,
    rudder:rud,
    gear:null,
    deck,
    wings:{main:env,edge:env}
  };
}

function buildBoat(){
  const g=new THREE.Group();

  const hM=M.white();
  const dM=M.woodLight();
  const dk=M.dark();
  const rM=M.red();

  const s=new THREE.Shape();

  s.moveTo(2.7,.3);
  s.lineTo(2,.62);
  s.lineTo(-2.1,.62);
  s.lineTo(-2.6,.35);
  s.lineTo(-2.2,.02);
  s.lineTo(1.7,.02);
  s.closePath();

  const hg=new THREE.ExtrudeGeometry(s,{
    depth:1.6,
    bevelEnabled:true,
    bevelThickness:.06,
    bevelSize:.06,
    bevelSegments:1
  });

  hg.translate(0,0,-.8);

  const hull=new THREE.Mesh(hg,hM);
  hull.castShadow=true;
  g.add(hull);

  const st=new THREE.Mesh(new THREE.BoxGeometry(4.9,.12,1.74),rM);
  st.position.set(.05,.5,0);
  g.add(st);

  const dk2=new THREE.Mesh(new THREE.BoxGeometry(4.4,.08,1.5),dM);
  dk2.position.set(-.2,.66,0);
  g.add(dk2);

  const con=new THREE.Mesh(new THREE.BoxGeometry(.5,.55,.9),hM);
  con.position.set(.5,.98,0);
  g.add(con);

  const mo=new THREE.Mesh(new THREE.BoxGeometry(.35,.6,.35),dk);
  mo.position.set(-2.55,.75,0);
  g.add(mo);

  const prop=new THREE.Group();

  for(let i=0;i<3;i++){
    const h=new THREE.Group();
    h.rotation.x=i*2.094;

    const b=new THREE.Mesh(new THREE.BoxGeometry(.03,.5,.1),dk);
    b.position.y=.28;

    h.add(b);
    prop.add(h);
  }

  prop.position.set(-2.68,-.3,0);
  g.add(prop);

  const rud=new THREE.Group();
  rud.position.set(-2.5,-.15,0);

  const b=new THREE.Mesh(new THREE.BoxGeometry(.35,.3,.04),dk);
  b.geometry.translate(-.15,0,0);

  rud.add(b);
  g.add(rud);

  return{
    group:g,
    propeller:prop,
    propellerR:null,
    ailerons:{left:null,right:null},
    flaps:{left:null,right:null},
    elevator:null,
    rudder:rud,
    gear:null,
    wings:{main:hull,edge:hull},
    waterOnly:true,
    deck:null
  };
}

function buildJeep(){
  const g=new THREE.Group();

  const frameM=new THREE.MeshStandardMaterial({
    color:0x3a3f3a,
    roughness:.7,
    metalness:.4
  });

  const railG=new THREE.BoxGeometry(3.6,0.16,0.16);

  const r1=new THREE.Mesh(railG,frameM);
  r1.position.set(0,0.55,0.8);
  r1.castShadow=true;
  g.add(r1);

  const r2=new THREE.Mesh(railG,frameM);
  r2.position.set(0,0.55,-0.8);
  r2.castShadow=true;
  g.add(r2);

  const crossG=new THREE.BoxGeometry(0.16,0.12,1.76);

  for(const cx of[1.5,0.2,-1.5]){
    const c=new THREE.Mesh(crossG,frameM);
    c.position.set(cx,0.55,0);
    g.add(c);
  }

  const engine=new THREE.Mesh(new THREE.BoxGeometry(0.7,0.4,0.8),M.dark());
  engine.position.set(1.3,0.8,0);
  g.add(engine);

  const seat=new THREE.Mesh(new THREE.BoxGeometry(0.5,0.12,0.9),M.dark());
  seat.position.set(-0.5,0.75,0);
  g.add(seat);

  const back=new THREE.Mesh(new THREE.BoxGeometry(0.1,0.5,0.9),M.dark());
  back.position.set(-0.75,1.0,0);
  g.add(back);

  const dash=new THREE.Mesh(new THREE.BoxGeometry(0.25,0.3,1.4),M.dark());
  dash.position.set(0.35,0.95,0);
  g.add(dash);

  const col=new THREE.Mesh(new THREE.CylinderGeometry(0.03,0.03,0.3,6),M.dark());
  col.rotation.z=1.1;
  col.position.set(0.18,1.05,0.35);
  g.add(col);

  const sw=new THREE.Mesh(new THREE.TorusGeometry(0.16,0.03,6,12),M.dark());
  sw.rotation.y=Math.PI/2;
  sw.rotation.x=0.4;
  sw.position.set(0.06,1.16,0.35);
  g.add(sw);

  const ws=new THREE.Mesh(new THREE.BoxGeometry(0.05,0.6,1.4),M.glass());
  ws.position.set(0.45,1.35,0);
  ws.rotation.z=-0.35;
  g.add(ws);

  const roof=new THREE.Mesh(new THREE.BoxGeometry(1.4,0.08,1.6),frameM);
  roof.position.set(-0.3,1.75,0);
  roof.castShadow=true;
  g.add(roof);

  const sideL=new THREE.Mesh(new THREE.BoxGeometry(1.2,0.35,0.06),frameM);
  sideL.position.set(-0.3,0.95,0.8);
  g.add(sideL);

  const sideR=sideL.clone();
  sideR.position.z=-0.8;
  g.add(sideR);

  const postG=new THREE.CylinderGeometry(0.05,0.05,0.8,6);

  const p1=new THREE.Mesh(postG,frameM);
  p1.position.set(-0.9,1.35,0.7);
  g.add(p1);

  const p2=new THREE.Mesh(postG,frameM);
  p2.position.set(-0.9,1.35,-0.7);
  g.add(p2);

  const p3=new THREE.Mesh(postG,frameM);
  p3.position.set(0.4,1.35,0.7);
  g.add(p3);

  const p4=new THREE.Mesh(postG,frameM);
  p4.position.set(0.4,1.35,-0.7);
  g.add(p4);

  const wheels=[];

  const wheelGeo=new THREE.CylinderGeometry(0.45,0.45,0.3,SEG(12));
  wheelGeo.rotateX(Math.PI/2);

  const hubGeo=new THREE.CylinderGeometry(.15,.15,.34,SEG(8));
  hubGeo.rotateX(Math.PI/2);

  const wheelM=new THREE.MeshStandardMaterial({
    color:0x222222,
    roughness:.9
  });

  const hubM=new THREE.MeshStandardMaterial({
    color:0x888888,
    roughness:.5
  });

  for(const[fx,fz]of[[1.5,0.9],[1.5,-0.9],[-1.5,0.9],[-1.5,-0.9]]){
    const wg=new THREE.Group();

    const wm=new THREE.Mesh(wheelGeo,wheelM);
    wm.castShadow=true;
    wg.add(wm);

    const hub=new THREE.Mesh(hubGeo,hubM);
    wg.add(hub);

    wg.position.set(fx,0.45,fz);

    wg.userData.baseY=0.45;
    wg.userData.front=fx>0;
    wg.userData.spin=wm;

    g.add(wg);
    wheels.push(wg);
  }

  return{
    group:g,
    wheels,
    propeller:null,
    propellerR:null,
    ailerons:{left:null,right:null},
    flaps:{left:null,right:null},
    elevator:null,
    rudder:null,
    gear:null,
    wings:{main:r1,edge:r1}
  };
}

// ИСПРАВЛЕННЫЙ ОРНИТОПТЕР: крылья развёрнуты как у стрекозы
function buildOrnithopter(){
  const g=new THREE.Group();

  const bodyM=M.sand();
  const darkM=M.dark();
  const glassM=M.glassDark();
  const accentM=M.dune();

  const bodyGeo=new THREE.CapsuleGeometry(.6,3,8,16);
  const body=new THREE.Mesh(bodyGeo,bodyM);

  body.rotation.z=Math.PI/2;
  body.position.set(.5,0,0);
  body.castShadow=true;

  g.add(body);

  const cockpit=new THREE.Mesh(
    new THREE.SphereGeometry(.5,12,10,0,Math.PI*2,0,Math.PI/2),
    glassM
  );

  cockpit.scale.set(1.3,.9,1);
  cockpit.position.set(1.2,.3,0);

  g.add(cockpit);

  // Передняя пара длинных крыльев. Корни заходят в фюзеляж, чтобы взмах не открывал зазор.
  const wingGeoFront=new THREE.BoxGeometry(0.45,0.06,3.2);

  const wingPivotFL=new THREE.Group();
  wingPivotFL.position.set(.5,.25,.48);

  const wingFL=new THREE.Mesh(wingGeoFront,accentM);
  wingFL.position.z=1.6;
  wingFL.castShadow=true;

  wingPivotFL.add(wingFL);
  g.add(wingPivotFL);

  const wingPivotFR=new THREE.Group();
  wingPivotFR.position.set(.5,.25,-.48);

  const wingFR=new THREE.Mesh(wingGeoFront,accentM);
  wingFR.position.z=-1.6;
  wingFR.castShadow=true;

  wingPivotFR.add(wingFR);
  g.add(wingPivotFR);

  // Задняя пара крыльев чуть короче, с тем же перекрытием корпуса.
  const wingGeoRear=new THREE.BoxGeometry(0.38,0.05,2.6);

  const wingPivotRL=new THREE.Group();
  wingPivotRL.position.set(-.6,.2,.48);

  const wingRL=new THREE.Mesh(wingGeoRear,accentM);
  wingRL.position.z=1.3;
  wingRL.castShadow=true;

  wingPivotRL.add(wingRL);
  g.add(wingPivotRL);

  const wingPivotRR=new THREE.Group();
  wingPivotRR.position.set(-.6,.2,-.48);

  const wingRR=new THREE.Mesh(wingGeoRear,accentM);
  wingRR.position.z=-1.3;
  wingRR.castShadow=true;

  wingPivotRR.add(wingRR);
  g.add(wingPivotRR);

  const tail=new THREE.Mesh(new THREE.ConeGeometry(.3,1.2,8),darkM);
  tail.rotation.z=-Math.PI/2;
  tail.position.set(-2,0,0);
  g.add(tail);

  const tailFin=new THREE.Mesh(new THREE.BoxGeometry(.8,.6,.05),darkM);
  tailFin.position.set(-1.8,.4,0);
  g.add(tailFin);

  for(const z of[.4,-.4]){
    const eng=new THREE.Mesh(new THREE.CylinderGeometry(.15,.15,.8,8),darkM);
    eng.rotation.z=Math.PI/2;
    eng.position.set(0,0,z);
    g.add(eng);
  }

  const emblem=new THREE.Mesh(new THREE.ConeGeometry(.15,.4,4),accentM);
  emblem.position.set(.5,.65,0);
  g.add(emblem);

  return{
    group:g,
    propeller:null,
    propellerR:null,
    ailerons:{left:null,right:null},
    flaps:{left:null,right:null},
    elevator:null,
    rudder:null,
    gear:null,
    wings:{main:body,edge:body},
    wingPivots:{
      fl:wingPivotFL,
      fr:wingPivotFR,
      rl:wingPivotRL,
      rr:wingPivotRR
    },
    ornithopter:true
  };
}


  return{buildToyPlane,buildYellowBiplane,buildSkyCruiser,buildTwinProp,buildAirship,buildBoat,buildJeep,buildOrnithopter};
}
