export function createCreatureModels({THREE,M,SEG}){
function quad(o){
  const g=new THREE.Group();
  const m=M.animal(o.c);
  const s=o.s;
  const legLen=o.legLen||.7*s;

  const body=new THREE.Mesh(new THREE.SphereGeometry(.6*s,SEG(8),SEG(6)),m);
  body.scale.set(1.4,.85,.75);
  body.position.y=legLen;
  body.castShadow=true;
  g.add(body);

  const neckLen=o.neck||.25*s;

  const head=new THREE.Mesh(new THREE.SphereGeometry(.22*s,SEG(8),SEG(6)),m);
  head.position.set(.9*s,legLen+neckLen,0);
  g.add(head);

  if(o.neck){
    const nk=new THREE.Mesh(new THREE.CylinderGeometry(.07*s,.11*s,neckLen,SEG(6)),m);
    nk.position.set(.7*s,legLen+neckLen*.5,0);
    nk.rotation.z=-.5;
    g.add(nk);
  }

  if(o.antler){
    for(const z of[.12*s,-.12*s]){
      const h=new THREE.Mesh(new THREE.CylinderGeometry(.03*s,.05*s,.5*s,SEG(5)),M.animal(0xe0d8c8));
      h.position.set(.9*s,legLen+neckLen+.25*s,z);
      h.rotation.z=z>0?.4:-.4;
      g.add(h);
    }
  }

  if(o.hump){
    const h=new THREE.Mesh(new THREE.SphereGeometry(.4*s,SEG(8),SEG(6)),m);
    h.position.set(.1*s,legLen+.5*s,0);
    g.add(h);
  }

  const tail=new THREE.Mesh(new THREE.SphereGeometry(.12*s,SEG(6),SEG(5)),m);
  tail.position.set(-.9*s,legLen+.1*s,0);
  tail.scale.set(1.5,.6,.6);
  g.add(tail);

  const legs=[];

  for(const[x,z]of[[.55*s,.3*s],[.55*s,-.3*s],[-.55*s,.3*s],[-.55*s,-.3*s]]){
    const lg=new THREE.CylinderGeometry(.06*s,.08*s,legLen,SEG(6));
    lg.translate(0,-legLen/2,0);

    const l=new THREE.Mesh(lg,m);
    l.position.set(x,legLen,z);

    g.add(l);
    legs.push(l);
  }

  return{
    group:g,
    legs,
    head,
    tail,
    ears:[],
    swim:!!o.swim,
    cfg:{
      speed:o.speed||1.5,
      states:o.states||['idle','walk','look','walk','run']
    }
  };
}

function biped(o){
  const g=new THREE.Group();
  const m=M.animal(o.c);
  const s=o.s;
  const legLen=.9*s;

  const body=new THREE.Mesh(new THREE.SphereGeometry(.5*s,SEG(8),SEG(6)),m);
  body.scale.set(1.2,1.1,.8);
  body.position.y=legLen+.3*s;
  body.rotation.z=.3;
  body.castShadow=true;
  g.add(body);

  const head=new THREE.Mesh(new THREE.SphereGeometry(o.bighead?.35*s:.2*s,SEG(8),SEG(6)),m);
  head.position.set(.7*s,legLen+.8*s,0);
  g.add(head);

  if(o.bighead){
    const jaw=new THREE.Mesh(new THREE.BoxGeometry(.5*s,.18*s,.25*s),m);
    jaw.position.set(1.0*s,legLen+.7*s,0);
    g.add(jaw);
  }

  const tail=new THREE.Mesh(new THREE.CylinderGeometry(.05*s,.1*s,1.2*s,SEG(6)),m);
  tail.rotation.z=1.2;
  tail.position.set(-.8*s,legLen+.2*s,0);
  g.add(tail);

  const legs=[];

  for(const z of[.2*s,-.2*s]){
    const lg=new THREE.CylinderGeometry(.09*s,.12*s,legLen,SEG(6));
    lg.translate(0,-legLen/2,0);

    const l=new THREE.Mesh(lg,m);
    l.position.set(0,legLen,z);

    g.add(l);
    legs.push(l);
  }

  return{
    group:g,
    legs,
    head,
    tail,
    ears:[],
    cfg:{
      speed:o.speed||2.5,
      states:['idle','walk','run','look']
    }
  };
}

function flyer(s,c){
  const g=new THREE.Group();
  const m=M.animal(c);

  const body=new THREE.Mesh(new THREE.SphereGeometry(.3*s,SEG(8),SEG(6)),m);
  body.scale.set(1.6,.7,.7);
  body.castShadow=true;
  g.add(body);

  const head=new THREE.Mesh(new THREE.SphereGeometry(.15*s,SEG(8),SEG(6)),m);
  head.position.set(.5*s,.1*s,0);
  g.add(head);

  const pivL=new THREE.Group();
  pivL.position.z=.15*s;

  const wL=new THREE.Mesh(new THREE.BoxGeometry(.5*s,.03,1.4*s),m);
  wL.position.z=.7*s;

  pivL.add(wL);
  g.add(pivL);

  const pivR=new THREE.Group();
  pivR.position.z=-.15*s;

  const wR=new THREE.Mesh(new THREE.BoxGeometry(.5*s,.03,1.4*s),m);
  wR.position.z=-.7*s;

  pivR.add(wR);
  g.add(pivR);

  return{
    group:g,
    legs:[],
    head,
    tail:null,
    ears:[],
    fly:true,
    wingL:pivL,
    wingR:pivR,
    cfg:{
      speed:6,
      states:['fly']
    }
  };
}

function snake(c){
  const g=new THREE.Group();
  const m=M.animal(c);
  const segs=[];

  for(let i=0;i<6;i++){
    const s=new THREE.Mesh(new THREE.SphereGeometry(.12-.012*i,SEG(6),SEG(5)),m);
    s.position.set(-i*.18,.1,0);
    s.scale.set(1.3,.7,.9);
    g.add(s);
    segs.push(s);
  }

  const head=new THREE.Mesh(new THREE.SphereGeometry(.13,SEG(6),SEG(5)),m);
  head.position.set(.2,.12,0);
  g.add(head);

  return{
    group:g,
    legs:[],
    head,
    tail:segs[5],
    ears:[],
    swim:true,
    snakeSegs:segs,
    cfg:{
      speed:1,
      states:['idle','walk','walk']
    }
  };
}

function croco(){
  const g=new THREE.Group();
  const m=M.animal(0x607040);

  const body=new THREE.Mesh(new THREE.SphereGeometry(.5,SEG(8),SEG(6)),m);
  body.scale.set(2.2,.6,.7);
  body.position.y=.5;
  body.castShadow=true;
  g.add(body);

  const head=new THREE.Mesh(new THREE.BoxGeometry(.8,.25,.35),m);
  head.position.set(1.3,.5,0);
  g.add(head);

  const tail=new THREE.Mesh(new THREE.ConeGeometry(.25,1.4,SEG(6)),m);
  tail.rotation.z=Math.PI/2;
  tail.position.set(-1.4,.5,0);
  g.add(tail);

  const legs=[];

  for(const[x,z]of[[.6,.35],[.6,-.35],[-.6,.35],[-.6,-.35]]){
    const l=new THREE.Mesh(new THREE.CylinderGeometry(.07,.09,.5,SEG(6)),m);
    l.position.set(x,.25,z);
    g.add(l);
    legs.push(l);
  }

  return{
    group:g,
    legs,
    head,
    tail,
    ears:[],
    swim:true,
    cfg:{
      speed:1.4,
      states:['idle','walk','idle','run']
    }
  };
}

function frog(){
  const g=new THREE.Group();
  const m=M.animal(0x60a040);

  const body=new THREE.Mesh(new THREE.SphereGeometry(.18,SEG(8),SEG(6)),m);
  body.scale.set(1.2,.8,1);
  body.position.y=.15;
  g.add(body);

  const head=new THREE.Mesh(new THREE.SphereGeometry(.12,SEG(6),SEG(5)),m);
  head.position.set(.2,.2,0);
  g.add(head);

  const legs=[];

  for(const z of[.12,-.12]){
    const l=new THREE.Mesh(new THREE.CylinderGeometry(.03,.04,.2,SEG(5)),m);
    l.position.set(-.1,.1,z);
    l.rotation.z=.6;
    g.add(l);
    legs.push(l);
  }

  return{
    group:g,
    legs,
    head,
    tail:null,
    ears:[],
    swim:true,
    cfg:{
      speed:2,
      states:['idle','idle','hop','idle']
    }
  };
}

function turtle(){
  const g=new THREE.Group();
  const m=M.animal(0x4a7a4a);

  const shell=new THREE.Mesh(new THREE.SphereGeometry(.35,SEG(8),SEG(6)),m);
  shell.scale.set(1.2,.6,1);
  shell.position.y=.3;
  shell.castShadow=true;
  g.add(shell);

  const head=new THREE.Mesh(new THREE.SphereGeometry(.12,SEG(6),SEG(5)),M.animal(0x7a9a5a));
  head.position.set(.4,.3,0);
  g.add(head);

  const legs=[];

  for(const[x,z]of[[.25,.25],[.25,-.25],[-.25,.25],[-.25,-.25]]){
    const l=new THREE.Mesh(new THREE.CylinderGeometry(.05,.06,.25,SEG(5)),m);
    l.position.set(x,.12,z);
    g.add(l);
    legs.push(l);
  }

  return{
    group:g,
    legs,
    head,
    tail:null,
    ears:[],
    swim:true,
    cfg:{
      speed:.6,
      states:['idle','walk','idle']
    }
  };
}

function boar(){
  const g=new THREE.Group();
  const m=M.animal(0x5a4a3a);

  const body=new THREE.Mesh(new THREE.SphereGeometry(.5,SEG(8),SEG(6)),m);
  body.scale.set(1.5,.8,.7);
  body.position.y=.6;
  body.castShadow=true;
  g.add(body);

  const head=new THREE.Mesh(new THREE.SphereGeometry(.25,SEG(8),SEG(6)),m);
  head.position.set(.8,.6,0);
  g.add(head);

  const legs=[];

  for(const[x,z]of[[.5,.25],[.5,-.25],[-.5,.25],[-.5,-.25]]){
    const l=new THREE.Mesh(new THREE.CylinderGeometry(.06,.07,.6,SEG(5)),m);
    l.position.set(x,.3,z);
    g.add(l);
    legs.push(l);
  }

  return{
    group:g,
    legs,
    head,
    tail:null,
    ears:[],
    cfg:{
      speed:2,
      states:['idle','walk','run','idle']
    }
  };
}

function person(){
  const g=new THREE.Group();

  const shirt=M.animal([0x4477aa,0xaa5555,0x55aa77,0x8866aa][Math.floor(Math.random()*4)]);
  const pants=M.animal(0x444455);
  const skin=M.animal(0xe8c0a0);

  const legs=[];

  for(const z of[.09,-.09]){
    const lg=new THREE.CylinderGeometry(.07,.07,.8,SEG(6));
    lg.translate(0,-.4,0);

    const l=new THREE.Mesh(lg,pants);
    l.position.set(0,.8,z);

    g.add(l);
    legs.push(l);
  }

  const torso=new THREE.Mesh(new THREE.CylinderGeometry(.2,.24,.7,SEG(8)),shirt);
  torso.position.y=1.15;
  torso.castShadow=true;
  g.add(torso);

  const head=new THREE.Mesh(new THREE.SphereGeometry(.16,SEG(8),SEG(6)),skin);
  head.position.y=1.65;
  g.add(head);

  return{
    group:g,
    legs,
    head,
    tail:null,
    ears:[],
    cfg:{
      speed:1.2,
      states:['idle','walk','walk','idle']
    }
  };
}

function fremen(){
  const g=new THREE.Group();

  const suit=M.animal(0xc8a060);
  const eyes=M.animal(0x4488ff);
  const skin=M.animal(0xe8c0a0);

  const legs=[];

  for(const z of[.09,-.09]){
    const lg=new THREE.CylinderGeometry(.07,.07,.8,SEG(6));
    lg.translate(0,-.4,0);

    const l=new THREE.Mesh(lg,suit);
    l.position.set(0,.8,z);

    g.add(l);
    legs.push(l);
  }

  const torso=new THREE.Mesh(new THREE.CylinderGeometry(.2,.24,.7,SEG(8)),suit);
  torso.position.y=1.15;
  torso.castShadow=true;
  g.add(torso);

  const head=new THREE.Mesh(new THREE.SphereGeometry(.16,SEG(8),SEG(6)),skin);
  head.position.y=1.65;
  g.add(head);

  const eyeL=new THREE.Mesh(new THREE.SphereGeometry(.03,6,6),eyes);
  eyeL.position.set(.06,1.68,.12);
  g.add(eyeL);

  const eyeR=new THREE.Mesh(new THREE.SphereGeometry(.03,6,6),eyes);
  eyeR.position.set(-.06,1.68,.12);
  g.add(eyeR);

  const knife=new THREE.Mesh(new THREE.ConeGeometry(.02,.3,4),M.animal(0x888888));
  knife.position.set(.25,1.2,.1);
  knife.rotation.z=-.5;
  g.add(knife);

  return{
    group:g,
    legs,
    head,
    tail:null,
    ears:[],
    cfg:{
      speed:2.5,
      states:['idle','walk','run','fight']
    }
  };
}

function harkonnen(){
  const g=new THREE.Group();

  const armor=M.animal(0x2a2a2a);
  const skin=M.animal(0xd0b090);

  const legs=[];

  for(const z of[.09,-.09]){
    const lg=new THREE.CylinderGeometry(.08,.08,.8,SEG(6));
    lg.translate(0,-.4,0);

    const l=new THREE.Mesh(lg,armor);
    l.position.set(0,.8,z);

    g.add(l);
    legs.push(l);
  }

  const torso=new THREE.Mesh(new THREE.CylinderGeometry(.22,.26,.75,SEG(8)),armor);
  torso.position.y=1.15;
  torso.castShadow=true;
  g.add(torso);

  const head=new THREE.Mesh(new THREE.SphereGeometry(.16,SEG(8),SEG(6)),skin);
  head.position.y=1.65;
  g.add(head);

  const helmet=new THREE.Mesh(new THREE.SphereGeometry(.17,8,6,0,Math.PI*2,0,Math.PI/2),armor);
  helmet.position.y=1.68;
  g.add(helmet);

  const gun=new THREE.Mesh(new THREE.BoxGeometry(.4,.08,.08),M.animal(0x444444));
  gun.position.set(.25,1.1,.15);
  g.add(gun);

  return{
    group:g,
    legs,
    head,
    tail:null,
    ears:[],
    cfg:{
      speed:1.8,
      states:['idle','walk','run','fight']
    }
  };
}


const ANIMAL_BUILDERS={
  bear:()=>quad({s:1.5,c:0x6a4a2a}),
  deer:()=>quad({s:1.2,c:0xb0805a,neck:.5,antler:true}),
  rabbit:()=>quad({s:.4,c:0xe0e0e0}),
  wolf:()=>quad({s:1,c:0x7a7a8a}),
  fox:()=>quad({s:.6,c:0xd87838}),
  moose:()=>quad({s:1.8,c:0x5a4a3a,neck:.6,antler:true}),
  duck:()=>quad({s:.35,c:0x98b454,swim:true,speed:1}),
  heron:()=>biped({s:1.0,c:0xf0f0f0,speed:1.2}),
  monkey:()=>quad({s:.5,c:0x8a6a4a,neck:.2,speed:2.4}),
  jaguar:()=>quad({s:1.1,c:0xd8a838,speed:3}),
  parrot:()=>biped({s:.4,c:0xe04040,speed:1}),
  camel:()=>quad({s:1.6,c:0xd8b070,neck:.7,hump:true,speed:1.6}),
  snake:()=>snake(0xd8b040),
  lizard:()=>quad({s:.35,c:0x80b040,speed:2}),
  crocodile:()=>croco(),
  frog:()=>frog(),
  dog:()=>quad({s:.6,c:0x987858,speed:2.2}),
  person:()=>person(),
  turtle:()=>turtle(),
  boar:()=>boar(),
  trex:()=>biped({s:3.2,c:0x806040,bighead:true,speed:3}),
  raptor:()=>biped({s:1.4,c:0x609040,speed:4}),
  bronto:()=>quad({s:4,c:0x809070,neck:2.5,legLen:3,speed:1}),
  ptero:()=>flyer(2,0xa08060),
  fremen:()=>fremen(),
  harkonnen:()=>harkonnen(),
  sandtrout:()=>quad({s:.3,c:0x9a8a6a,speed:.5})
};


  return{ANIMAL_BUILDERS,fremen,harkonnen};
}
