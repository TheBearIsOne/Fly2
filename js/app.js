import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createAircraftModels } from './models/aircraft.js';
import { createCreatureModels } from './models/creatures.js';
import { createDuneModels } from './models/dune.js';

const _v1=new THREE.Vector3(),_v2=new THREE.Vector3(),_v3=new THREE.Vector3(),_v4=new THREE.Vector3(),_v5=new THREE.Vector3(),_v6=new THREE.Vector3();
const _q1=new THREE.Quaternion(),_q2=new THREE.Quaternion(),_q3=new THREE.Quaternion();
const _euler=new THREE.Euler();const _mat4=new THREE.Matrix4();
const AX_X=new THREE.Vector3(1,0,0),AX_Y=new THREE.Vector3(0,1,0),AX_Z=new THREE.Vector3(0,0,1);
const clamp=THREE.MathUtils.clamp;
const smoothstep=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};

const _dc={};function el(id){if(!(id in _dc))_dc[id]=document.getElementById(id);return _dc[id];}
function setText(id,v){const e=el(id);if(e)e.textContent=v;}
function setColor(id,v){const e=el(id);if(e)e.style.color=v;}
function showEl(id,d){const e=el(id);if(e)e.style.display=d;}

function chunkRng(cx,cz,salt){
  const seed=((cx*73856093)^(cz*19349663)^(salt||0))>>>0;
  let s=seed;
  return()=>{
    s=(s*1664525+1013904223)>>>0;
    return s/4294967296;
  };
}

function makePoints(scene,count,size,vertexColors,opacity,additive){
  const geo=new THREE.BufferGeometry();
  const pos=new Float32Array(count*3);
  const col=vertexColors?new Float32Array(count*3):null;

  for(let i=0;i<count;i++)pos[i*3+1]=-999;

  geo.setAttribute('position',new THREE.BufferAttribute(pos,3));

  if(col)geo.setAttribute('color',new THREE.BufferAttribute(col,3));

  geo.boundingSphere=new THREE.Sphere(new THREE.Vector3(0,0,0),20000);

  const m=new THREE.PointsMaterial({
    size,
    vertexColors:!!vertexColors,
    transparent:true,
    opacity:opacity!=null?opacity:.9,
    depthWrite:false
  });

  if(additive)m.blending=THREE.AdditiveBlending;

  const pts=new THREE.Points(geo,m);
  pts.frustumCulled=false;
  scene.add(pts);

  return{
    points:pts,
    pos,
    col,
    vel:new Array(count).fill(0).map(()=>({x:0,y:0,z:0,life:0,settled:0,cool:0,vy:0}))
  };
}

const windUniforms={uTime:{value:0},uStr:{value:0},uDir:{value:new THREE.Vector2(1,0)}};

function windVec(){
  const a=SETTINGS.windDir*Math.PI/180;
  return new THREE.Vector3(Math.cos(a)*SETTINGS.windStrength,0,Math.sin(a)*SETTINGS.windStrength);
}

// ИСПРАВЛЕНО: строка шейдера без разрыва обычной кавычки
function addSway(m){
  m.onBeforeCompile=(sh)=>{
    sh.uniforms.uTime=windUniforms.uTime;
    sh.uniforms.uStr=windUniforms.uStr;
    sh.uniforms.uDir=windUniforms.uDir;

    sh.vertexShader=`uniform float uTime;uniform float uStr;uniform vec2 uDir;
` + sh.vertexShader.replace('#include <begin_vertex>',
`#include <begin_vertex>
float sw = sin(uTime*1.6 + position.x*0.4 + position.z*0.3) * uStr * 0.02 * max(position.y,0.0);
transformed.x += uDir.x * sw; transformed.z += uDir.y * sw;`);
  };

  m.customProgramCacheKey=()=>'sway';

  return m;
}

class SimplexNoise{
  constructor(seed=Math.random()){
    this.grad3=[[1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],[1,0,1],[-1,0,1],[1,0,-1],[-1,0,-1],[0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1]];
    this.p=new Uint8Array(256);

    let s=seed*2147483647;

    const rng=()=>{
      s=(s*16807)%2147483647;
      return(s-1)/2147483646;
    };

    for(let i=0;i<256;i++)this.p[i]=i;

    for(let i=255;i>0;i--){
      const j=Math.floor(rng()*(i+1));
      [this.p[i],this.p[j]]=[this.p[j],this.p[i]];
    }

    this.perm=new Uint8Array(512);
    this.permMod12=new Uint8Array(512);

    for(let i=0;i<512;i++){
      this.perm[i]=this.p[i&255];
      this.permMod12[i]=this.perm[i]%12;
    }
  }

  noise2D(x,y){
    const F2=0.5*(Math.sqrt(3)-1),G2=(3-Math.sqrt(3))/6;

    const s=(x+y)*F2;
    const i=Math.floor(x+s),j=Math.floor(y+s);
    const t=(i+j)*G2;

    const X0=i-t,Y0=j-t;
    const x0=x-X0,y0=y-Y0;

    const i1=x0>y0?1:0,j1=x0>y0?0:1;

    const x1=x0-i1+G2,y1=y0-j1+G2;
    const x2=x0-1+2*G2,y2=y0-1+2*G2;

    const ii=i&255,jj=j&255;

    const gi0=this.permMod12[ii+this.perm[jj]];
    const gi1=this.permMod12[ii+i1+this.perm[jj+j1]];
    const gi2=this.permMod12[ii+1+this.perm[jj+1]];

    let n0=0,n1=0,n2=0;

    let t0=0.5-x0*x0-y0*y0;

    if(t0>=0){
      t0*=t0;
      n0=t0*t0*(this.grad3[gi0][0]*x0+this.grad3[gi0][1]*y0);
    }

    let t1=0.5-x1*x1-y1*y1;

    if(t1>=0){
      t1*=t1;
      n1=t1*t1*(this.grad3[gi1][0]*x1+this.grad3[gi1][1]*y1);
    }

    let t2=0.5-x2*x2-y2*y2;

    if(t2>=0){
      t2*=t2;
      n2=t2*t2*(this.grad3[gi2][0]*x2+this.grad3[gi2][1]*y2);
    }

    return 70*(n0+n1+n2);
  }

  fbm(x,y,octaves=3){
    let s=0,a=1,f=1,m=0;

    for(let i=0;i<octaves;i++){
      s+=this.noise2D(x*f,y*f)*a;
      m+=a;
      a*=.5;
      f*=2;
    }

    return s/m;
  }
}

const DEFAULT_CHUNK_SIZE=128, DEFAULT_CHUNK_RES=24;
const MIST_RADIUS=5, CHUNKS_PER_FRAME=6, WATER_LEVEL=2;
const BOAT_DRAFT=0.18;
const ANIMAL_WATER_MARGIN=1.2, ANIMAL_SPAWN_MARGIN=1.5;
const VOLCANO_SAFE=600;
const ASSET_BASE='https://cdn.jsdelivr.net/gh/mordman/Assets@main/LowPolly/Models/';
const MIST_LAYERS=[{dy:0.9,fade:1.0},{dy:3.2,fade:0.55}];
const SWIMMERS=new Set(['crocodile','frog','turtle','duck','snake']);

// ИСПРАВЛЕНО: в Дюне нет обычного червя в списке животных
const WORLDS=[
{id:'temperate',name:'Умеренный',emoji:'🌲',desc:'Леса, луга, большие горы',veg:'temperate',animals:['bear','deer','rabbit','wolf','fox','moose']},
{id:'desert',name:'Пустыня',emoji:'️',desc:'Дюны, только оазисы',veg:'desert',animals:['camel','snake','lizard','dog']},
{id:'swamp',name:'Великие Болота',emoji:'🐊',desc:'Топи, камыш, кувшинки',veg:'swamp',animals:['crocodile','frog','heron','snake','turtle','boar','duck']},
{id:'jungle',name:'Джунгли',emoji:'🌴',desc:'Густые джунгли, реки',veg:'jungle',animals:['monkey','jaguar','snake','frog','boar','parrot']},
{id:'prehistoric',name:'Доисторический',emoji:'🦖',desc:'Динозавры, пальмы',veg:'prehistoric',animals:['trex','raptor','bronto','ptero']},
{id:'volcano',name:'Вулкан',emoji:'🌋',desc:'Один вулкан, гейзеры, пепел',veg:'volcano',animals:['wolf','lizard','heron']},
{id:'dune',name:'Дюна (Arrakis)',emoji:'🪱',desc:'Пустыня Арракис, один червь, Фремены',veg:'dune',animals:['fremen','harkonnen','sandtrout']}];

let CURRENT_WORLD=WORLDS[0];

const SETTINGS={
  worldSeed:1337,
  startX:0,
  startZ:0,
  startAlt:80,
  dayLength:4,
  viewDistance:12,
  detailDistance:2,
  treeDistance:6,
  grassCount:220,
  rockCount:12,
  treeDensity:1,
  animals:12,
  mistHeight:1,
  mistDensity:0.16,
  stallSpeed:14,
  handling:1,
  thrust:1,
  grass:true,
  shadows:true,
  chunkSize:DEFAULT_CHUNK_SIZE,
  chunkRes:DEFAULT_CHUNK_RES,
  camDist:15,
  camHeight:6,
  windStrength:4,
  windDir:45,
  useModels:false,
  procDetail:8,
  texGrass:'',
  texRock:'',
  texAsphalt:'',
  texWindow:'',
  texRoof:'',
  texSand:'',
  keyUp:'KeyW',
  keyDown:'KeyS',
  keyLeft:'KeyA',
  keyRight:'KeyD',
  keyYawL:'KeyQ',
  keyYawR:'KeyE',
  keyThrUp:'ShiftLeft',
  keyThrDn:'ControlLeft',
  keyGear:'KeyG',
  keyFlaps:'KeyF',
  keyWalk:'KeyV',
  keyShoot:'Space',
  keySettings:'KeyP',
  keyReset:'KeyR',
  keyTime:'KeyT',
  keyWx1:'Digit1',
  keyWx2:'Digit2',
  keyWx3:'Digit3',
  keyWx4:'Digit4',
  blasterFireRate:5,
  blasterAccuracy:.92
};

const SETTINGS_DEF=[
{key:'keyUp',label:'Клавиша: ВВЕРХ (тангаж)',type:'key'},
{key:'keyDown',label:'Клавиша: ВНИЗ (тангаж)',type:'key'},
{key:'keyLeft',label:'Клавиша: влево / крен',type:'key'},
{key:'keyRight',label:'Клавиша: вправо / крен',type:'key'},
{key:'keyYawL',label:'Клавиша: рыскание влево',type:'key'},
{key:'keyYawR',label:'Клавиша: рыскание вправо',type:'key'},
{key:'keyThrUp',label:'Клавиша: газ +',type:'key'},
{key:'keyThrDn',label:'Клавиша: газ −',type:'key'},
{key:'keyGear',label:'Клавиша: шасси',type:'key'},
{key:'keyFlaps',label:'Клавиша: закрылки',type:'key'},
{key:'keyWalk',label:'Клавиша: ходьба',type:'key'},
{key:'keyShoot',label:'Клавиша: бластер',type:'key'},
{key:'keySettings',label:'Клавиша: настройки',type:'key'},
{key:'keyReset',label:'Клавиша: сброс',type:'key'},
{key:'keyTime',label:'Клавиша: время суток',type:'key'},
{key:'keyWx1',label:'Клавиша: погода ясно',type:'key'},
{key:'keyWx2',label:'Клавиша: погода дождь',type:'key'},
{key:'keyWx3',label:'Клавиша: погода гроза',type:'key'},
{key:'keyWx4',label:'Клавиша: погода снег',type:'key'},
{key:'worldSeed',label:'Seed мира',min:1,max:99999,step:1},
{key:'startX',label:'Старт X',min:-1000,max:1000,step:50},
{key:'startZ',label:'Старт Z',min:-1000,max:1000,step:50},
{key:'startAlt',label:'Высота старта,м',min:20,max:1000,step:10},
{key:'dayLength',label:'Длина суток,мин',min:1,max:20,step:.5},
{key:'windStrength',label:'Сила ветра,м/с',min:0,max:200,step:.5},
{key:'windDir',label:'Направление ветра°',min:0,max:360,step:5},
{key:'camDist',label:'Дистанция камеры,м',min:5,max:80,step:1},
{key:'camHeight',label:'Высота камеры,м',min:2,max:40,step:1},
{key:'chunkSize',label:'Размер чанка,м',min:2,max:256,step:16},
{key:'chunkRes',label:'Разрешение чанка',min:8,max:48,step:4},
{key:'viewDistance',label:'Дальность чанков',min:4,max:120,step:1},
{key:'detailDistance',label:'Дальность объектов',min:1,max:60,step:1},
{key:'treeDistance',label:'Дальность деревьев',min:2,max:120,step:1},
{key:'grassCount',label:'Травы/чанк',min:0,max:500,step:10},
{key:'rockCount',label:'Камней/чанк',min:0,max:30,step:1},
{key:'treeDensity',label:'Плотность деревьев×',min:0,max:2,step:.1},
{key:'animals',label:'Животных/чанк',min:0,max:300,step:1},
{key:'mistHeight',label:'Высота тумана×',min:.5,max:30,step:.1},
{key:'mistDensity',label:'Плотность тумана',min:0,max:.9,step:.02},
{key:'stallSpeed',label:'Сваливание,м/с',min:8,max:20,step:1},
{key:'handling',label:'Чувствительность×',min:.5,max:2,step:.05},
{key:'thrust',label:'Тяга×',min:.5,max:1.5,step:.05},
{key:'blasterFireRate',label:'Скорострельность бластера',min:1,max:12,step:.5},
{key:'blasterAccuracy',label:'Точность бластера',min:.5,max:1,step:.01},
{key:'procDetail',label:'Полигоны процедурных',min:4,max:32,step:4},
{key:'grass',label:'Трава',toggle:true},
{key:'shadows',label:'Тени',toggle:true},
{key:'useModels',label:'Загружать GLB-модели',toggle:true},
{key:'texGrass',label:'URL травы',type:'text'},
{key:'texRock',label:'URL камня',type:'text'},
{key:'texAsphalt',label:'URL асфальта',type:'text'},
{key:'texWindow',label:'URL окон',type:'text'},
{key:'texRoof',label:'URL крыши',type:'text'},
{key:'texSand',label:'URL песка',type:'text'}];

function prettyKey(c){
  if(!c)return '—';

  return c
    .replace(/^Key/,'')
    .replace(/^Digit/,'')
    .replace('ShiftLeft','LShift')
    .replace('ShiftRight','RShift')
    .replace('ControlLeft','LCtrl')
    .replace('ControlRight','RCtrl')
    .replace('AltLeft','LAlt')
    .replace('AltRight','RAlt')
    .replace('ArrowUp','↑')
    .replace('ArrowDown','↓')
    .replace('ArrowLeft','←')
    .replace('ArrowRight','→')
    .replace('Space','Space')
    .replace('Minus','-')
    .replace('Equal','=');
}

function updateHelp(){
  const K=SETTINGS;
  const e=el('controls-help');

  if(!e)return;

  e.innerHTML=`<b>УПРАВЛЕНИЕ:</b><br><kbd>${prettyKey(K.keyUp)}</kbd> вверх <kbd>${prettyKey(K.keyDown)}</kbd> вниз <kbd>${prettyKey(K.keyLeft)}</kbd>/<kbd>${prettyKey(K.keyRight)}</kbd> крен+поворот <kbd>${prettyKey(K.keyYawL)}</kbd>/<kbd>${prettyKey(K.keyYawR)}</kbd> рыскание<br><kbd>${prettyKey(K.keyThrUp)}</kbd>/<kbd>${prettyKey(K.keyThrDn)}</kbd> газ <kbd>${prettyKey(K.keyFlaps)}</kbd> закрылки <kbd>${prettyKey(K.keyGear)}</kbd> шасси<br><kbd>${prettyKey(K.keyWalk)}</kbd> выйти/сесть <kbd>${prettyKey(K.keyShoot)}</kbd>/ЛКМ бластер <kbd>${prettyKey(K.keySettings)}</kbd> настройки <kbd>${prettyKey(K.keyReset)}</kbd> сброс<br><kbd>${prettyKey(K.keyWx1)}…${prettyKey(K.keyWx4)}</kbd> погода <kbd>${prettyKey(K.keyTime)}</kbd> время <kbd>Esc</kbd> мир`;
}

let keyListen=null;

window.addEventListener('keydown',e=>{
  if(keyListen){
    e.preventDefault();
    e.stopPropagation();

    SETTINGS[keyListen.key]=e.code;
    keyListen.btn.textContent=prettyKey(e.code);
    keyListen=null;

    updateHelp();
  }
},true);

function setSettingUI(k,v){
  const i=document.querySelector(`#settings-rows input[data-key="${k}"]`);
  if(i)i.value=v;

  const s=el('sv-'+k);
  if(s)s.textContent=v;
}

function applySetting(k,v){
  SETTINGS[k]=v;

  if(k.startsWith('tex')){
    textures.setURL(k.slice(3).toLowerCase(),v);
    return;
  }

  if(k.startsWith('key')){
    updateHelp();
    return;
  }

  if(k==='procDetail'){
    for(const key in _treeGeoCache)delete _treeGeoCache[key];
  }

  if(k==='detailDistance'&&SETTINGS.treeDistance<v){
    SETTINGS.treeDistance=v;
    setSettingUI('treeDistance',v);
  }

  if(k==='treeDistance'&&v<SETTINGS.detailDistance){
    SETTINGS.treeDistance=SETTINGS.detailDistance;
    setSettingUI('treeDistance',SETTINGS.detailDistance);
  }

  if(k==='dayLength'&&weather)weather.dayDuration=v*60;

  if(k==='mistHeight'&&chunkManager){
    for(const c of chunkManager.chunks.values()){
      if(c.mist){
        c.mist.children.forEach(p=>p.position.y=WATER_LEVEL+p.userData.baseDy*v);
      }
    }
  }

  if(k==='grass'&&chunkManager){
    for(const c of chunkManager.chunks.values()){
      if(c.grassMesh)c.grassMesh.visible=v;
    }
  }

  if(k==='grassCount'&&chunkManager){
    for(const c of chunkManager.chunks.values()){
      if(c.lod===2)c.rebuildGrass(v);
    }
  }

  if(k==='rockCount'&&chunkManager){
    for(const c of chunkManager.chunks.values()){
      if(c.lod===2)c.rebuildRocks(v);
    }
  }

  if(k==='shadows'&&renderer){
    renderer.shadowMap.enabled=v;
    if(weather)weather.sun.castShadow=v;
    renderer.shadowMap.needsUpdate=true;
  }
}

function buildSettingsUI(){
  const b=el('settings-rows');
  b.innerHTML='';

  for(const d of SETTINGS_DEF){
    const r=document.createElement('div');
    r.className='srow'+(d.toggle?' tog':'');

    if(d.toggle){
      r.innerHTML=`<span>${d.label}</span>`;

      const cb=document.createElement('input');
      cb.type='checkbox';
      cb.checked=SETTINGS[d.key];
      cb.dataset.key=d.key;
      cb.addEventListener('change',()=>applySetting(d.key,cb.checked));

      r.appendChild(cb);
    } else if(d.type==='text'){
      r.innerHTML=`<div class="sl"><span>${d.label}</span></div>`;

      const ti=document.createElement('input');
      ti.type='text';
      ti.value=SETTINGS[d.key]||'';
      ti.placeholder='canvas';
      ti.dataset.key=d.key;
      ti.addEventListener('change',()=>applySetting(d.key,ti.value));

      r.appendChild(ti);
    } else if(d.type==='key'){
      r.innerHTML=`<div class="sl"><span>${d.label}</span></div>`;

      const bt=document.createElement('button');
      bt.className='kbtn';
      bt.textContent=prettyKey(SETTINGS[d.key]);

      bt.addEventListener('click',()=>{
        keyListen={key:d.key,btn:bt};
        bt.textContent='нажмите клавишу…';
      });

      r.appendChild(bt);
    } else {
      r.innerHTML=`<div class="sl"><span>${d.label}</span><span class="sv" id="sv-${d.key}">${SETTINGS[d.key]}</span></div>`;

      const rg=document.createElement('input');
      rg.type='range';
      rg.min=d.min;
      rg.max=d.max;
      rg.step=d.step;
      rg.value=SETTINGS[d.key];
      rg.dataset.key=d.key;

      rg.addEventListener('input',()=>{
        const v=parseFloat(rg.value);
        applySetting(d.key,v);

        const s=el('sv-'+d.key);
        if(s)s.textContent=v;
      });

      r.appendChild(rg);
    }

    b.appendChild(r);
  }
}

function toggleSettings(){
  const p=el('settings-panel');
  p.style.display=(p.style.display==='none'||!p.style.display)?'block':'none';
}

function SEG(base){
  return Math.max(3,Math.round(base*SETTINGS.procDetail/8));
}

const testResults=[];

function test(n,f){
  try{
    const r=f();

    if(r===false)throw new Error('false');

    testResults.push({name:n,pass:true});

    console.log(`✓ ${n}`);
  }catch(e){
    testResults.push({name:n,pass:false,error:e.message});

    console.error(`✗ ${n}: ${e.message}`);
  }
}

function renderTests(){
  const e=el('test-results');

  if(!e)return;

  e.innerHTML=testResults.map(t=>`<div class="${t.pass?'pass':'fail'}">${t.pass?'✓':'✗'} ${t.name}${t.error?': '+t.error:''}</div>`).join('');
}

class AssetManager{
  constructor(){
    this.loader=new GLTFLoader();
    this.cache=new Map();
    this.loaded=0;
    this.total=0;
    this.failed=new Set();
    this.partsCache=new Map();
  }

  async load(u){
    if(this.cache.has(u))return this.cache.get(u);
    if(this.failed.has(u))return null;

    this.total++;

    try{
      const g=await this.loader.loadAsync(u);
      const m=g.scene;

      m.traverse(c=>{
        if(c.isMesh){
          c.castShadow=false;
          c.receiveShadow=true;
        }
      });

      this.cache.set(u,m);
      this.loaded++;

      const b=el('load-bar');
      if(b)b.style.width=(this.loaded/this.total*100)+'%';

      return m;
    }catch(e){
      this.failed.add(u);
      return null;
    }
  }

  get(u){
    return this.cache.get(u);
  }

  getParts(k,b){
    if(this.partsCache.has(k))return this.partsCache.get(k);

    let r=null;

    if(k.startsWith('url:'))r=this.get(k.slice(4));
    if(!r&&b)r=b();

    if(!r){
      this.partsCache.set(k,null);
      return null;
    }

    r.updateMatrixWorld(true);

    const p=[];

    r.traverse(o=>{
      if(o.isMesh){
        o.geometry.userData.shared=true;

        if(Array.isArray(o.material)){
          o.material.forEach(m=>m.userData.shared=true);
        } else {
          o.material.userData.shared=true;
        }

        p.push({
          geometry:o.geometry,
          material:o.material,
          matrix:o.matrixWorld.clone()
        });
      }
    });

    this.partsCache.set(k,p);

    return p;
  }
}

const assets=new AssetManager();

class TextureManager{
  constructor(){
    this.tex={};
    this.buildAll();
  }

  buildAll(){
    this.tex.grass=this._noise('#6a9a5a',70,120,60);
    this.tex.rock=this._noise('#8a8a8a',110,110,110);
    this.tex.asphalt=this._noise('#4a4a50',60,60,60);
    this.tex.window=this._window();
    this.tex.roof=this._roof();
    this.tex.sand=this._noise('#d8b888',200,180,140);
  }

  setURL(name,url){
    const t=this.tex[name];

    if(!t||!url)return;

    const img=new Image();
    img.crossOrigin='anonymous';

    img.onload=()=>{
      t.image=img;
      t.needsUpdate=true;
    };

    img.onerror=()=>console.warn('tex fail, keep canvas:',name);

    img.src=url;
  }

  _noise(base,r0,g0,b0){
    const c=document.createElement('canvas');
    c.width=c.height=256;

    const x=c.getContext('2d');

    x.fillStyle=base;
    x.fillRect(0,0,256,256);

    for(let i=0;i<2500;i++){
      const r=Math.random();

      x.fillStyle=`rgba(${r0+r*50},${g0+r*50},${b0+r*40},0.5)`;
      x.fillRect(Math.random()*256,Math.random()*256,1+Math.random()*2,1+Math.random()*3);
    }

    const t=new THREE.CanvasTexture(c);
    t.wrapS=t.wrapT=THREE.RepeatWrapping;
    t.repeat.set(8,8);
    t.colorSpace=THREE.SRGBColorSpace;

    return t;
  }

  _window(){
    const c=document.createElement('canvas');
    c.width=c.height=128;

    const x=c.getContext('2d');

    x.fillStyle='#c8b8a0';
    x.fillRect(0,0,128,128);
    x.fillStyle='#3a4a65';

    for(let i=0;i<4;i++){
      for(let j=0;j<4;j++){
        const px=12+i*28,py=12+j*28;

        x.fillRect(px,py,18,18);

        const g=x.createLinearGradient(px,py,px,py+18);
        g.addColorStop(0,'#7090b0');
        g.addColorStop(1,'#3a4a65');

        x.fillStyle=g;
        x.fillRect(px+2,py+2,14,14);
        x.fillStyle='#3a4a65';
      }
    }

    const t=new THREE.CanvasTexture(c);
    t.wrapS=t.wrapT=THREE.RepeatWrapping;
    t.colorSpace=THREE.SRGBColorSpace;

    return t;
  }

  _roof(){
    const c=document.createElement('canvas');
    c.width=128;
    c.height=128;

    const x=c.getContext('2d');

    x.fillStyle='#995544';
    x.fillRect(0,0,128,128);

    for(let j=0;j<16;j++){
      for(let i=0;i<16;i++){
        const v=Math.random();

        x.fillStyle=v<.5?'#884433':v<.8?'#aa6655':'#bb7766';
        x.fillRect(i*8+(j%2?4:0),j*8,8,8);
      }
    }

    const t=new THREE.CanvasTexture(c);
    t.wrapS=t.wrapT=THREE.RepeatWrapping;
    t.repeat.set(2,2);
    t.colorSpace=THREE.SRGBColorSpace;

    return t;
  }
}

const textures=new TextureManager();

let envMap=null;
const _mc={};

function mat(k,f){
  if(!_mc[k]){
    _mc[k]=f();
    _mc[k].userData.shared=true;
  }

  return _mc[k];
}

const COL={
  turquoise:0x6fd3e9,
  turquoiseDark:0x5ab8cf,
  coral:0xf08078,
  coralDark:0xd86862,
  cream:0xf8ecd8,
  dark:0x3a3a44,
  white:0xfafafa,
  yellow:0xf8d878,
  red:0xe86860,
  wood:0x9a7a50,
  woodLight:0xd8b888,
  blue:0x5a9fd8,
  sand:0xd4a843,
  dune:0xc8a060
};

// ИСПРАВЛЕНО: убран дублирующийся ключ sand, добавлен sandTex
const M={
  body:()=>mat('body',()=>new THREE.MeshPhysicalMaterial({color:COL.turquoise,roughness:.25,clearcoat:1,clearcoatRoughness:.06,envMapIntensity:1.4})),
  bodyDark:()=>mat('bodyDark',()=>new THREE.MeshPhysicalMaterial({color:COL.turquoiseDark,roughness:.32,clearcoat:.9,envMapIntensity:1.2})),
  bodyPainted:()=>mat('bodyPainted',()=>new THREE.MeshPhysicalMaterial({vertexColors:true,roughness:.25,clearcoat:1,clearcoatRoughness:.06,envMapIntensity:1.4})),
  coral:()=>mat('coral',()=>new THREE.MeshPhysicalMaterial({color:COL.coral,roughness:.3,clearcoat:.9,envMapIntensity:1.2})),
  coralDark:()=>mat('coralDark',()=>new THREE.MeshPhysicalMaterial({color:COL.coralDark,roughness:.42,clearcoat:.7,envMapIntensity:1.1})),
  cream:()=>mat('cream',()=>new THREE.MeshPhysicalMaterial({color:COL.cream,roughness:.42,clearcoat:.6,envMapIntensity:1.1})),
  dark:()=>mat('dark',()=>new THREE.MeshPhysicalMaterial({color:COL.dark,roughness:.5,metalness:.4,envMapIntensity:1.3})),
  white:()=>mat('white',()=>new THREE.MeshPhysicalMaterial({color:COL.white,roughness:.28,clearcoat:.9,envMapIntensity:1.4})),
  yellow:()=>mat('yellow',()=>new THREE.MeshPhysicalMaterial({color:COL.yellow,roughness:.3,clearcoat:.9,envMapIntensity:1.2})),
  red:()=>mat('red',()=>new THREE.MeshPhysicalMaterial({color:COL.red,roughness:.3,clearcoat:.9,envMapIntensity:1.2})),
  wood:()=>mat('wood',()=>new THREE.MeshPhysicalMaterial({color:COL.wood,roughness:.6,clearcoat:.3,envMapIntensity:.9})),
  woodLight:()=>mat('woodLight',()=>new THREE.MeshPhysicalMaterial({color:COL.woodLight,roughness:.5,clearcoat:.25,clearcoatRoughness:.4,envMapIntensity:1})),
  blue:()=>mat('blue',()=>new THREE.MeshPhysicalMaterial({color:COL.blue,roughness:.28,clearcoat:1,envMapIntensity:1.3})),
  sand:()=>mat('sand',()=>new THREE.MeshPhysicalMaterial({color:COL.sand,roughness:.7,clearcoat:.5,envMapIntensity:1.1})),
  dune:()=>mat('dune',()=>new THREE.MeshPhysicalMaterial({color:COL.dune,roughness:.6,clearcoat:.4,envMapIntensity:1})),
  glass:()=>mat('glass',()=>new THREE.MeshPhysicalMaterial({color:0xa8dce8,roughness:.08,transparent:true,opacity:.5,side:THREE.DoubleSide,envMapIntensity:2})),
  glassDark:()=>mat('glassDark',()=>new THREE.MeshPhysicalMaterial({color:0x445566,roughness:.1,transparent:true,opacity:.72,side:THREE.DoubleSide,envMapIntensity:1.6})),
  grass:()=>mat('grass',()=>addSway(new THREE.MeshLambertMaterial({color:0x7aa86a,side:THREE.DoubleSide}))),
  reed:()=>mat('reed',()=>addSway(new THREE.MeshLambertMaterial({color:0x5a7a4a}))),
  lily:()=>mat('lily',()=>new THREE.MeshLambertMaterial({color:0x4a8a4a,side:THREE.DoubleSide})),
  water:()=>mat('water',()=>new THREE.MeshPhysicalMaterial({color:0x4a8ec8,transparent:true,opacity:.8,roughness:.06,clearcoat:1,clearcoatRoughness:.08,envMapIntensity:2.2,reflectivity:1})),
  mist:()=>mat('mist',()=>new THREE.MeshBasicMaterial({color:0xf0f4f8,transparent:true,opacity:0,depthWrite:false,fog:false})),
  rock:()=>mat('rock',()=>new THREE.MeshStandardMaterial({map:textures.tex.rock,roughness:.85})),
  sandTex:()=>mat('sandTex',()=>new THREE.MeshStandardMaterial({map:textures.tex.sand,roughness:.95})),
  bush:()=>mat('bush',()=>addSway(new THREE.MeshLambertMaterial({color:0x6a9a5a}))),
  fern:()=>mat('fern',()=>addSway(new THREE.MeshLambertMaterial({color:0x2e7d32,side:THREE.DoubleSide}))),
  animal:c=>mat('an'+c,()=>new THREE.MeshLambertMaterial({color:c}))
};

const _treeGeoCache={};

function paintedGeo(geo,color){
  const c=new THREE.Color(color);
  const n=geo.attributes.position.count;
  const a=new Float32Array(n*3);

  for(let i=0;i<n;i++){
    a[i*3]=c.r;
    a[i*3+1]=c.g;
    a[i*3+2]=c.b;
  }

  geo.setAttribute('color',new THREE.BufferAttribute(a,3));

  return geo;
}

function worldTreeGeo(world){
  const key=world+'_'+SETTINGS.procDetail;

  if(_treeGeoCache[key])return _treeGeoCache[key];

  const S=SEG;
  let g=null;

  if(world==='desert'||world==='dune'){
    const a=new THREE.CylinderGeometry(.22,.28,2.2,S(7));
    a.translate(0,1.1,0);

    const arm=new THREE.CylinderGeometry(.12,.14,.8,S(6));
    arm.translate(0,.4,0);
    arm.rotateZ(Math.PI/2);
    arm.translate(.4,1.4,0);

    g=mergeGeometries([paintedGeo(a,0x60a05a),paintedGeo(arm,0x60a05a)],false);
  } else if(world==='jungle'){
    const tr=new THREE.CylinderGeometry(.3,.55,6,S(6));
    tr.translate(0,3,0);

    const c1=new THREE.SphereGeometry(2.8,S(7),S(6));
    c1.translate(0,7,0);

    const c2=new THREE.SphereGeometry(1.9,S(7),S(6));
    c2.translate(.8,8.6,.5);

    g=mergeGeometries([
      paintedGeo(tr,0x6a4a2a),
      paintedGeo(c1,0x2e6b30),
      paintedGeo(c2,0x3f8f3f)
    ],false);
  } else if(world==='prehistoric'){
    const tr=new THREE.CylinderGeometry(.14,.22,3.4,S(6));
    tr.translate(0,1.7,0);

    const fr=[];

    for(let i=0;i<6;i++){
      const f=new THREE.ConeGeometry(.28,1.8,S(4));
      f.translate(0,.9,0);
      f.rotateZ(1.15);
      f.rotateY(i/6*Math.PI*2);
      f.translate(0,3.3,0);
      fr.push(f);
    }

    g=mergeGeometries([
      paintedGeo(tr,0x9a7a50),
      ...fr.map(f=>paintedGeo(f,0x4e9d52))
    ],false);
  } else if(world==='swamp'){
    const tr=new THREE.CylinderGeometry(.16,.3,2.6,S(6));
    tr.translate(0,1.3,0);

    const top=new THREE.ConeGeometry(.7,1.4,S(6));
    top.translate(0,3.0,0);

    g=mergeGeometries([
      paintedGeo(tr,0x6a5a4a),
      paintedGeo(top,0x6a7a4a)
    ],false);
  } else {
    const tr=new THREE.CylinderGeometry(.22,.38,3,S(5));
    tr.translate(0,1.5,0);

    const c1=new THREE.ConeGeometry(1.9,3.2,S(6));
    c1.translate(0,4.2,0);

    const c2=new THREE.ConeGeometry(1.3,2.4,S(6));
    c2.translate(0,6.2,0);

    g=mergeGeometries([
      paintedGeo(tr,0x5a3a20),
      paintedGeo(c1,0x4a7a4a),
      paintedGeo(c2,0x558a55)
    ],false);
  }

  g.userData.shared=true;
  _treeGeoCache[key]=g;

  return g;
}

function treeMat(){
  return addSway(mat('ftreeM',()=>new THREE.MeshLambertMaterial({vertexColors:true})));
}

function getWindowTex(){
  return textures.tex.window;
}

function getRoofTex(){
  return textures.tex.roof;
}

function buildWorldHouse(w){
  const g=new THREE.Group();

  let rad=4;
  let hgt=3.5;

  const woodM=new THREE.MeshStandardMaterial({color:0x8a6a4a,roughness:.8});
  const wallM=new THREE.MeshStandardMaterial({map:getWindowTex(),roughness:.8});
  const roofM=new THREE.MeshStandardMaterial({map:getRoofTex(),roughness:.9});
  const thatchM=new THREE.MeshStandardMaterial({color:0xb89858,roughness:1});
  const adobeM=new THREE.MeshStandardMaterial({color:0xc8a878,roughness:.9});
  const stoneM=new THREE.MeshStandardMaterial({map:textures.tex.rock,roughness:.9});
  const hideM=new THREE.MeshStandardMaterial({color:0xa88868,roughness:1});

  if(w==='desert'||w==='dune'){
    const b=new THREE.Mesh(new THREE.BoxGeometry(6,3,6),adobeM);
    b.position.y=1.5;
    b.castShadow=true;
    g.add(b);

    const r=new THREE.Mesh(new THREE.BoxGeometry(6.6,.4,6.6),adobeM);
    r.position.y=3.2;
    g.add(r);

    const d=new THREE.Mesh(new THREE.BoxGeometry(1,2,.2),woodM);
    d.position.set(0,1,3.05);
    g.add(d);

    hgt=3.4;
    rad=4.2;
  } else if(w==='swamp'||w==='jungle'){
    for(const[x,z]of[[-2,-2],[2,-2],[-2,2],[2,2]]){
      const p=new THREE.Mesh(new THREE.CylinderGeometry(.15,.18,2.4,6),woodM);
      p.position.set(x,1.2,z);
      g.add(p);
    }

    const f=new THREE.Mesh(new THREE.BoxGeometry(5,.3,5),woodM);
    f.position.y=2.4;
    g.add(f);

    const wl=new THREE.Mesh(
      new THREE.BoxGeometry(4.4,2,4.4),
      w==='jungle'
        ? new THREE.MeshStandardMaterial({color:0x9a8a5a,roughness:.9})
        : wallM
    );

    wl.position.y=3.5;
    wl.castShadow=true;
    g.add(wl);

    const rf=new THREE.Mesh(new THREE.ConeGeometry(3.6,1.8,4),thatchM);
    rf.position.y=5.4;
    rf.rotation.y=Math.PI/4;
    rf.castShadow=true;
    g.add(rf);

    hgt=6;
    rad=3.6;
  } else if(w==='prehistoric'){
    const tent=new THREE.Mesh(new THREE.ConeGeometry(2.6,3.6,8),hideM);
    tent.position.y=1.8;
    tent.castShadow=true;
    g.add(tent);

    for(let i=0;i<6;i++){
      const a=i/6*Math.PI*2;

      const s=new THREE.Mesh(new THREE.DodecahedronGeometry(.4,0),stoneM);
      s.position.set(Math.cos(a)*3.4,.3,Math.sin(a)*3.4);
      g.add(s);
    }

    hgt=3.6;
    rad=3.4;
  } else if(w==='volcano'){
    const b=new THREE.Mesh(new THREE.BoxGeometry(5,2.6,5),stoneM);
    b.position.y=1.3;
    b.castShadow=true;
    g.add(b);

    const r=new THREE.Mesh(new THREE.BoxGeometry(5.6,.5,5.6),stoneM);
    r.position.y=2.8;
    g.add(r);

    hgt=3;
    rad=3.6;
  } else {
    const b=new THREE.Mesh(new THREE.BoxGeometry(6,3,6),wallM);
    b.position.y=1.5;
    b.castShadow=true;
    g.add(b);

    const r=new THREE.Mesh(new THREE.ConeGeometry(4.6,2,4),roofM);
    r.position.y=4;
    r.rotation.y=Math.PI/4;
    r.castShadow=true;
    g.add(r);

    const d=new THREE.Mesh(new THREE.BoxGeometry(1,2,.2),woodM);
    d.position.set(0,1,3.05);
    g.add(d);

    const ch=new THREE.Mesh(new THREE.BoxGeometry(.5,1.6,.5),stoneM);
    ch.position.set(1.8,3.6,1.8);
    g.add(ch);

    hgt=5;
    rad=4.2;
  }

  return{g,rad,hgt};
}

const {buildToyPlane,buildYellowBiplane,buildSkyCruiser,buildTwinProp,buildAirship,buildBoat,buildJeep,buildOrnithopter}=createAircraftModels({THREE,M,COL,SEG});

const {ANIMAL_BUILDERS:BASE_ANIMAL_BUILDERS,fremen,harkonnen}=createCreatureModels({THREE,M,SEG});

const {shaiHulud,duneTransport}=createDuneModels({THREE,M,SEG});

const ANIMAL_BUILDERS={...BASE_ANIMAL_BUILDERS,worm:()=>shaiHulud(3)};

const AIRCRAFT_CATALOG=[
  {id:'turquoise',name:'Turquoise Dream',type:'Мультяшный низкоплан',builder:'buildToyPlane',scale:1.7,maxSpeed:72,handling:1.15,desc:'Спортивный'},
  {id:'sunny',name:'Sunny Baron',type:'Биплан',builder:'buildYellowBiplane',scale:1.6,maxSpeed:46,handling:.95,desc:'Медленный, подъёмный'},
  {id:'cruiser',name:'Sky Cruiser',type:'Высокоплан',builder:'buildSkyCruiser',scale:1.6,maxSpeed:62,handling:1,desc:'Стабильный'},
  {id:'twin',name:'Twin Comet',type:'Двухвинтовой скоростной',builder:'buildTwinProp',scale:1.6,maxSpeed:95,handling:1.3,desc:'Быстрый, 2 винта'},
  {id:'airship',name:'Sky Whale',type:'Дирижабль',builder:'buildAirship',scale:1,maxSpeed:34,handling:.3,buoy:true,noGear:true,camBack:30,camUp:9,desc:'V — ходьба'},
  {id:'boat',name:'Lake Runner',type:'Катер',builder:'buildBoat',scale:1.2,maxSpeed:16,handling:.8,waterOnly:true,noGear:true,camBack:10,camUp:3.5,desc:'Только вода'},
  {id:'jeep',name:'Sahara Jeep',type:'Внедорожник с кабиной',builder:'buildJeep',scale:1,maxSpeed:30,handling:1,ground:true,noGear:true,camBack:8,camUp:3,desc:'Кабина, рессоры, следы'},
  {id:'ornithopter',name:'Atreides Ornithopter',type:'Орнитоптер (Meng DS-007)',builder:'buildOrnithopter',scale:1.5,maxSpeed:85,handling:1.2,noGear:true,camBack:12,camUp:4,desc:'Крылья как у стрекозы',ornithopter:true}
];

const BUILDERS={
  buildToyPlane,
  buildYellowBiplane,
  buildSkyCruiser,
  buildTwinProp,
  buildAirship,
  buildBoat,
  buildJeep,
  buildOrnithopter
};

class SkyDome{
  constructor(sc){
    this.mat=new THREE.ShaderMaterial({
      side:THREE.BackSide,
      depthWrite:false,
      uniforms:{
        time:{value:0},
        storm:{value:0},
        sf:{value:1},
        top:{value:new THREE.Color(0x7ab8e8)},
        horizon:{value:new THREE.Color(0xe8f0f5)}
      },
      vertexShader:`
        varying vec3 vD;
        void main(){
          vD=normalize(position);
          gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
        }
      `,
      fragmentShader:`
        uniform float time,storm,sf;
        uniform vec3 top,horizon;
        varying vec3 vD;

        float h2(vec2 p){
          return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);
        }

        float n2(vec2 p){
          vec2 i=floor(p),f=fract(p);
          vec2 u=f*f*(3.-2.*f);
          return mix(
            mix(h2(i),h2(i+vec2(1,0)),u.x),
            mix(h2(i+vec2(0,1)),h2(i+vec2(1,1)),u.x),
            u.y
          );
        }

        float fb(vec2 p){
          float v=0.,a=.5;
          for(int i=0;i<4;i++){
            v+=a*n2(p);
            p*=2.03;
            a*=.5;
          }
          return v;
        }

        void main(){
          float h=vD.y;
          vec3 sky=mix(horizon,top,pow(clamp(h,0.,1.),.5));
          sky=mix(sky,vec3(.95,.65,.45),(1.-sf)*.4*clamp(1.-abs(h)*3.,0.,1.));

          if(h>0.02){
            vec2 uv=vD.xz/(h+.18)*.5+vec2(time*.005,time*.0025);
            float n=fb(uv);

            float cov=mix(.50,.28,storm);
            float c=smoothstep(cov,cov+.25,n);

            vec3 cc=mix(vec3(.98,.98,1.0),vec3(.45,.46,.5),storm);
            sky=mix(sky,cc,c*smoothstep(0.,.1,h)*.85);
          } else {
            sky=mix(sky,horizon,.6);
          }

          gl_FragColor=vec4(sky,1.);
        }
      `
    });

    this.mesh=new THREE.Mesh(new THREE.SphereGeometry(3000,24,14),this.mat);
    this.mesh.frustumCulled=false;
    sc.add(this.mesh);
  }

  update(cp,t,st,sf){
    this.mesh.position.copy(cp);
    this.mat.uniforms.time.value=t;
    this.mat.uniforms.storm.value+=(st-this.mat.uniforms.storm.value)*.03;
    this.mat.uniforms.sf.value=sf;
  }
}

class StormClouds{
  constructor(sc){
    this.group=new THREE.Group();

    const cv=document.createElement('canvas');
    cv.width=cv.height=128;

    const cx=cv.getContext('2d');
    const gr=cx.createRadialGradient(64,64,8,64,64,62);

    gr.addColorStop(0,'rgba(255,255,255,.95)');
    gr.addColorStop(.55,'rgba(255,255,255,.55)');
    gr.addColorStop(1,'rgba(255,255,255,0)');

    cx.fillStyle=gr;
    cx.fillRect(0,0,128,128);

    this.tex=new THREE.CanvasTexture(cv);
    this.offsets=[];

    for(let i=0;i<14;i++){
      const m=new THREE.SpriteMaterial({
        map:this.tex,
        transparent:true,
        opacity:0,
        depthWrite:false,
        color:0x606068
      });

      const s=new THREE.Sprite(m);
      s.scale.set(180+Math.random()*160,60+Math.random()*50,1);

      this.offsets.push(new THREE.Vector3(
        (Math.random()-.5)*1200,
        140+Math.random()*60,
        (Math.random()-.5)*1200
      ));

      this.group.add(s);
    }

    this.group.visible=false;
    sc.add(this.group);
  }

  setVisible(v){
    this.group.visible=v;
  }

  update(p,dt,d){
    if(!this.group.visible)return;

    this.group.children.forEach((s,i)=>{
      const o=this.offsets[i];

      o.x+=dt*3;
      if(o.x>700)o.x=-700;

      s.position.set(p.x+o.x,o.y,p.z+o.z);
      s.material.opacity+=(d-s.material.opacity)*.03;
    });
  }
}

class BirdFlock{
  constructor(sc,n=6){
    this.birds=[];

    const bm=M.animal(0x4a4a54);
    const wm=mat('birdwing',()=>new THREE.MeshLambertMaterial({
      color:0x65657a,
      side:THREE.DoubleSide
    }));

    const bg=new THREE.SphereGeometry(.14,6,4);
    const wg=new THREE.BoxGeometry(.42,.02,.75);

    bg.scale(1.8,.9,.9);

    for(let i=0;i<n;i++){
      const g=new THREE.Group();
      g.add(new THREE.Mesh(bg,bm));

      const pL=new THREE.Group();
      pL.position.z=.08;

      const wl=new THREE.Mesh(wg,wm);
      wl.position.z=.4;

      pL.add(wl);
      g.add(pL);

      const pR=new THREE.Group();
      pR.position.z=-.08;

      const wr=new THREE.Mesh(wg,wm);
      wr.position.z=-.4;

      pR.add(wr);
      g.add(pR);

      sc.add(g);

      this.birds.push({
        g,
        pL,
        pR,
        center:new THREE.Vector3(
          (Math.random()-.5)*300,
          60+Math.random()*50,
          (Math.random()-.5)*300
        ),
        radius:30+Math.random()*60,
        angle:Math.random()*6.28,
        speed:6+Math.random()*6,
        fs:8+Math.random()*5,
        ph:Math.random()*10
      });
    }
  }

  update(dt,t,p,wind){
    for(const b of this.birds){
      if(b.center.distanceTo(p)>500){
        b.center.set(
          p.x+(Math.random()-.5)*300,
          50+Math.random()*60,
          p.z+(Math.random()-.5)*300
        );
      }

      b.angle+=b.speed/b.radius*dt;

      const wx=wind?wind.x*.3:0;
      const wz=wind?wind.z*.3:0;

      b.g.position.set(
        b.center.x+Math.cos(b.angle)*b.radius+wx,
        b.center.y+Math.sin(t*.4+b.ph)*3,
        b.center.z+Math.sin(b.angle)*b.radius+wz
      );

      b.g.rotation.y=-(b.angle+Math.PI/2);

      const f=Math.sin(t*b.fs+b.ph);

      b.pL.rotation.x=f*.8;
      b.pR.rotation.x=-f*.8;
    }
  }
}

class GlintSystem{
  constructor(sc){
    this.scene=sc;

    const mk=()=>{
      const cv=document.createElement('canvas');
      cv.width=cv.height=64;

      const x=cv.getContext('2d');
      const gr=x.createRadialGradient(32,32,0,32,32,32);

      gr.addColorStop(0,'rgba(255,250,220,1)');
      gr.addColorStop(.4,'rgba(255,240,180,.5)');
      gr.addColorStop(1,'rgba(255,230,150,0)');

      x.fillStyle=gr;
      x.fillRect(0,0,64,64);

      const sp=new THREE.Sprite(new THREE.SpriteMaterial({
        map:new THREE.CanvasTexture(cv),
        transparent:true,
        opacity:0,
        blending:THREE.AdditiveBlending,
        depthWrite:false,
        fog:false
      }));

      sc.add(sp);
      return sp;
    };

    this.waterGlint=mk();
    this.planeGlint=mk();

    this.waterGlint.material.opacity=0;
    this.planeGlint.material.opacity=0;
  }

  update(camPos,sunPos,aircraft,waterY){
    if(!camPos||!sunPos){
      this.waterGlint.material.opacity=0;
      this.planeGlint.material.opacity=0;
      return;
    }

    const dx=sunPos.x-camPos.x;
    const dy=sunPos.y-camPos.y;
    const dz=sunPos.z-camPos.z;

    const dL=Math.hypot(dx,dy,dz)||1;

    const ux=dx/dL;
    const uy=dy/dL;
    const uz=dz/dL;

    const rx=ux;
    const ry=-uy;
    const rz=uz;

    let shown=false;

    if(uy>0.05 && ry<0){
      const tHit=(waterY-camPos.y)/ry;

      if(tHit>0 && tHit<2000){
        this.waterGlint.position.set(
          camPos.x+rx*tHit,
          waterY+0.3,
          camPos.z+rz*tHit
        );

        const sc=clamp(tHit*0.15,10,80);

        this.waterGlint.scale.set(sc,sc*0.3,1);
        this.waterGlint.material.opacity=0.5*clamp(uy*3,0,1);

        shown=true;
      }
    }

    if(!shown)this.waterGlint.material.opacity=0;

    if(aircraft && !aircraft.crashed && aircraft.position && !aircraft.config.ground){
      const tsx=sunPos.x-aircraft.position.x;
      const tsy=sunPos.y-aircraft.position.y;
      const tsz=sunPos.z-aircraft.position.z;

      const tsL=Math.hypot(tsx,tsy,tsz)||1;

      const tcx=camPos.x-aircraft.position.x;
      const tcy=camPos.y-aircraft.position.y;
      const tcz=camPos.z-aircraft.position.z;

      const tcL=Math.hypot(tcx,tcy,tcz)||1;

      const hx=tsx/tsL+tcx/tcL;
      const hy=tsy/tsL+tcy/tcL;
      const hz=tsz/tsL+tcz/tcL;

      const hL=Math.hypot(hx,hy,hz)||1;

      const q=aircraft.orientation;

      const upx=2*(q.x*q.y-q.w*q.z);
      const upy=1-2*(q.x*q.x+q.z*q.z);
      const upz=2*(q.y*q.z+q.w*q.x);

      const spec=Math.pow(clamp(
        (hx/hL)*upx+(hy/hL)*upy+(hz/hL)*upz,
        0,
        1
      ),24);

      if(spec>0.05){
        this.planeGlint.position.copy(aircraft.position)
          .addScaledVector(_v1.set(upx,upy,upz),2);

        this.planeGlint.scale.set(6,6,1);
        this.planeGlint.material.opacity=spec*0.8;
      } else {
        this.planeGlint.material.opacity=0;
      }
    } else {
      this.planeGlint.material.opacity=0;
    }
  }
}

class DustSystem{
  constructor(sc){
    this.pool=makePoints(sc,200,1.6,true,.7);
    this.cursor=0;
  }

  emit(p,color,count,wind){
    const P=this.pool;

    for(let k=0;k<count;k++){
      const i=this.cursor;
      this.cursor=(this.cursor+1)%P.vel.length;

      const ve=P.vel[i];
      ve.life=1;

      P.pos[i*3]=p.x+(Math.random()-.5)*4;
      P.pos[i*3+1]=p.y-1+Math.random();
      P.pos[i*3+2]=p.z+(Math.random()-.5)*4;

      ve.x=(Math.random()-.5)*4+(wind?wind.x*.4:0);
      ve.y=2+Math.random()*3;
      ve.z=(Math.random()-.5)*4+(wind?wind.z*.4:0);

      P.col[i*3]=color.r;
      P.col[i*3+1]=color.g;
      P.col[i*3+2]=color.b;
    }

    P.points.geometry.attributes.position.needsUpdate=true;
    P.points.geometry.attributes.color.needsUpdate=true;
  }

  update(dt){
    const P=this.pool;

    for(let i=0;i<P.vel.length;i++){
      const ve=P.vel[i];
      if(ve.life<=0)continue;

      ve.life-=dt*.8;
      ve.y-=4*dt;

      P.pos[i*3]+=ve.x*dt;
      P.pos[i*3+1]+=ve.y*dt;
      P.pos[i*3+2]+=ve.z*dt;

      if(ve.life<=0)P.pos[i*3+1]=-999;
    }

    P.points.geometry.attributes.position.needsUpdate=true;
    P.points.geometry.attributes.color.needsUpdate=true;
  }
}

class TrackSystem{
  constructor(sc){
    this.scene=sc;
    this.N=600;

    this.geo=new THREE.BoxGeometry(0.9,0.02,0.28);
    this.geo.userData.shared=true;

    this.mat=new THREE.MeshStandardMaterial({
      color:0x3a3028,
      roughness:1
    });

    this.im=new THREE.InstancedMesh(this.geo,this.mat,this.N);
    this.im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    this.ages=new Float32Array(this.N).fill(999);

    this.tx=new Float32Array(this.N);
    this.ty=new Float32Array(this.N);
    this.tz=new Float32Array(this.N);
    this.tyaw=new Float32Array(this.N);

    this.cursor=0;
    this.d=new THREE.Object3D();

    this.hideAll();

    sc.add(this.im);
  }

  hideAll(){
    for(let i=0;i<this.N;i++){
      this.setM(i,0,-999,0,0,0);
    }
  }

  setM(i,x,y,z,yaw,s){
    const d=this.d;

    d.position.set(x,y,z);
    d.rotation.set(0,yaw,0);
    d.scale.set(s,s,s);
    d.updateMatrix();

    this.im.setMatrixAt(i,d.matrix);
  }

  emit(x,y,z,yaw){
    const i=this.cursor;
    this.cursor=(this.cursor+1)%this.N;

    this.ages[i]=0;

    this.tx[i]=x;
    this.ty[i]=y;
    this.tz[i]=z;
    this.tyaw[i]=yaw;

    this.setM(i,x,y,z,yaw,1);

    this.im.instanceMatrix.needsUpdate=true;
  }

  update(dt){
    let need=false;

    for(let i=0;i<this.N;i++){
      if(this.ages[i]<999){
        this.ages[i]+=dt;

        const s=clamp(1-this.ages[i]/6,0,1);

        if(s<=0){
          this.setM(i,0,-999,0,0,0);
          this.ages[i]=999;
        } else {
          this.setM(i,this.tx[i],this.ty[i],this.tz[i],this.tyaw[i],s);
        }

        need=true;
      }
    }

    if(need)this.im.instanceMatrix.needsUpdate=true;
  }
}

let tracks=null;

class VolcanoSystem{
  constructor(sc,terr){
    this.scene=sc;
    this.terr=terr;
    this.geysers=[];
    this.lastCell='';

    this.volcano=this.mkVolcano(
      terr.volcanoCenter.x,
      terr.volcanoCenter.z
    );
  }

  dispose(){
    if(this.volcano){
      for(const k of['lavaP','smokeP','ashP','flowP']){
        if(this.volcano[k])this.scene.remove(this.volcano[k].points);
      }

      if(this.volcano.lava)this.scene.remove(this.volcano.lava);
    }

    for(const gy of this.geysers){
      this.scene.remove(gy.pool.points);
    }

    this.geysers=[];
    this.volcano=null;
  }

  update(dt,t,player,wind){
    const cell=Math.floor(player.x/250)+','+Math.floor(player.z/250);

    if(cell!==this.lastCell){
      this.lastCell=cell;
      this.rebuildGeysers(player);
    }

    this.updVolcano(this.volcano,dt,t,wind);

    for(const gy of this.geysers){
      this.updGeyser(gy,dt,t);
    }
  }

  rebuildGeysers(p){
    for(const gy of this.geysers){
      this.scene.remove(gy.pool.points);
    }

    this.geysers=[];

    const gi=Math.floor(p.x/250);
    const gj=Math.floor(p.z/250);

    for(let i=gi-1;i<=gi+1;i++){
      for(let j=gj-1;j<=gj+1;j++){
        const h=Math.abs(Math.sin(i*127.1+j*311.7))*10000%1;

        if(h<.35){
          const gx=i*250+(Math.abs(Math.sin(i*311.7+j*127.1))*10000%1-.5)*120;
          const gz=j*250+(Math.abs(Math.sin(i*127.1+j*311.7))*10000%1-.5)*120;

          if(Math.hypot(gx-this.volcano.x,gz-this.volcano.z)<150)continue;

          this.geysers.push(this.mkGeyser(gx,gz));
        }
      }
    }
  }

  mkVolcano(x,z){
    const lavaP=makePoints(this.scene,400,1.4,true,.95,true);
    const smokeP=makePoints(this.scene,150,6,true,.6,false);
    const ashP=makePoints(this.scene,2000,0.7,true,.85,false);
    const flowP=makePoints(this.scene,600,1.0,true,.95,true);

    const summit=this.terr.volcanoHeight(x,z);

    const lava=new THREE.Mesh(
      new THREE.CircleGeometry(35,20),
      new THREE.MeshBasicMaterial({
        color:0xff5522,
        transparent:true,
        opacity:.95
      })
    );

    lava.rotation.x=-Math.PI/2;
    lava.position.set(x,summit-8,z);
    lava.frustumCulled=false;

    this.scene.add(lava);

    return{
      lavaP,
      smokeP,
      ashP,
      flowP,
      x,
      z,
      summit,
      lava,
      phase:0,
      position:new THREE.Vector3(x,0,z)
    };
  }

  updVolcano(v,dt,t,wind){
    v.phase+=dt;

    const period=8;
    const burst=(v.phase%period)<6;

    const wx=wind?wind.x:0;
    const wz=wind?wind.z:0;

    v.lava.material.opacity=.8+Math.sin(t*8)*.2;

    let P=v.lavaP;

    for(let i=0;i<P.vel.length;i++){
      const ve=P.vel[i];

      if(ve.life<=0){
        if(burst&&Math.random()<.8){
          ve.life=.001;

          const sp=2.2;

          ve.x=(Math.random()-.5)*10*sp;
          ve.y=(20+Math.random()*28)*sp;
          ve.z=(Math.random()-.5)*10*sp;

          P.pos[i*3]=v.x;
          P.pos[i*3+1]=v.summit-6;
          P.pos[i*3+2]=v.z;
        }

        continue;
      }

      ve.life+=dt*.4;
      ve.y-=28*dt;

      P.pos[i*3]+=(ve.x+wx)*dt;
      P.pos[i*3+1]+=ve.y*dt;
      P.pos[i*3+2]+=(ve.z+wz)*dt;

      const f=clamp(1-ve.life,0,1);

      P.col[i*3]=1;
      P.col[i*3+1]=.2+f*.6;
      P.col[i*3+2]=f*.2;

      if(ve.life>1||P.pos[i*3+1]<v.summit-80){
        ve.life=0;
        P.pos[i*3+1]=-999;
      }
    }

    P.points.geometry.attributes.position.needsUpdate=true;
    P.points.geometry.attributes.color.needsUpdate=true;

    P=v.smokeP;

    for(let i=0;i<P.vel.length;i++){
      const ve=P.vel[i];

      if(ve.life<=0){
        ve.life=.001;

        ve.x=(Math.random()-.5)*4;
        ve.y=8+Math.random()*6;
        ve.z=(Math.random()-.5)*4;

        P.pos[i*3]=v.x;
        P.pos[i*3+1]=v.summit-5;
        P.pos[i*3+2]=v.z;
      }

      ve.life+=dt*.15;
      ve.y-=1*dt;

      P.pos[i*3]+=(ve.x+wx*1.5)*dt;
      P.pos[i*3+1]+=ve.y*dt;
      P.pos[i*3+2]+=(ve.z+wz*1.5)*dt;

      const f=clamp(1-ve.life,0,1);
      const g=.35+f*.2;

      P.col[i*3]=g;
      P.col[i*3+1]=g;
      P.col[i*3+2]=g+.02;

      if(ve.life>1||P.pos[i*3+1]>v.summit+120){
        ve.life=0;
        P.pos[i*3+1]=-999;
      }
    }

    P.points.geometry.attributes.position.needsUpdate=true;
    P.points.geometry.attributes.color.needsUpdate=true;

    P=v.ashP;

    for(let i=0;i<P.vel.length;i++){
      const ve=P.vel[i];

      if(ve.life<=0){
        const chance=burst?0.9:0.35;

        if(Math.random()<chance){
          ve.life=.001;
          ve.settled=0;

          ve.x=(Math.random()-.5)*16;
          ve.y=10+Math.random()*18;
          ve.z=(Math.random()-.5)*16;

          P.pos[i*3]=v.x+(Math.random()-.5)*24;
          P.pos[i*3+1]=v.summit-4;
          P.pos[i*3+2]=v.z+(Math.random()-.5)*24;
        }

        continue;
      }

      ve.life+=dt*.09;

      if(!ve.settled){
        ve.y-=2.4*dt;

        P.pos[i*3]+=(ve.x+wx*2.4)*dt;
        P.pos[i*3+1]+=ve.y*dt;
        P.pos[i*3+2]+=(ve.z+wz*2.4)*dt;

        const gh=this.terr.getHeight(P.pos[i*3],P.pos[i*3+2]);

        if(P.pos[i*3+1]<=gh+0.3){
          ve.settled=1;
          P.pos[i*3+1]=gh+0.2;
        }
      }

      const g=0.32+(ve.settled?0.12:0.20);

      P.col[i*3]=g;
      P.col[i*3+1]=g;
      P.col[i*3+2]=g+0.02;

      if(ve.life>1){
        ve.life=0;
        P.pos[i*3+1]=-999;
      }
    }

    P.points.geometry.attributes.position.needsUpdate=true;
    P.points.geometry.attributes.color.needsUpdate=true;

    P=v.flowP;

    for(let i=0;i<P.vel.length;i++){
      const ve=P.vel[i];

      if(ve.life<=0){
        const chance=burst?0.9:0.5;

        if(Math.random()<chance){
          ve.life=.001;
          ve.cool=0;

          const ang=Math.random()*Math.PI*2;
          const rr=26+Math.random()*14;

          P.pos[i*3]=v.x+Math.cos(ang)*rr;
          P.pos[i*3+1]=v.summit-6;
          P.pos[i*3+2]=v.z+Math.sin(ang)*rr;
        }

        continue;
      }

      ve.life+=dt*.04;
      ve.cool+=dt*.06;

      const cx=P.pos[i*3];
      const cz=P.pos[i*3+2];

      const h0=this.terr.getHeight(cx,cz);
      const hx=this.terr.getHeight(cx+2,cz);
      const hz=this.terr.getHeight(cx,cz+2);

      let dx=-(hx-h0);
      let dz=-(hz-h0);

      const L=Math.hypot(dx,dz)||1;

      dx/=L;
      dz/=L;

      const speed=6*(1-ve.cool*.3);

      const nx=cx+dx*speed*dt;
      const nz=cz+dz*speed*dt;

      const nh=this.terr.getHeight(nx,nz);

      P.pos[i*3]=nx;
      P.pos[i*3+1]=nh+0.4;
      P.pos[i*3+2]=nz;

      const c=clamp(1-ve.cool,0,1);

      P.col[i*3]=1;
      P.col[i*3+1]=.25+c*.5;
      P.col[i*3+2]=c*.12;

      const dFromC=Math.hypot(nx-v.x,nz-v.z);

      if(ve.life>1||ve.cool>=1||nh<v.summit-120||dFromC>260){
        ve.life=0;
        P.pos[i*3+1]=-999;
      }
    }

    P.points.geometry.attributes.position.needsUpdate=true;
    P.points.geometry.attributes.color.needsUpdate=true;
  }

  mkGeyser(x,z){
    const pool=makePoints(this.scene,100,1.4,false,.8,false);
    pool.points.material.color.set(0xd8ecff);

    return{
      pool,
      x,
      z,
      ground:this.terr.getHeight(x,z),
      phase:Math.random()*12
    };
  }

  updGeyser(gy,dt,t){
    gy.phase+=dt;

    const act=(gy.phase%11)<2.2;
    const P=gy.pool;

    for(let i=0;i<P.vel.length;i++){
      const ve=P.vel[i];

      if(act&&ve.life<=0){
        ve.life=.001;
        ve.y=14+Math.random()*10;

        P.pos[i*3]=gy.x+(Math.random()-.5)*1.5;
        P.pos[i*3+1]=gy.ground;
        P.pos[i*3+2]=gy.z+(Math.random()-.5)*1.5;
      }

      if(ve.life>0){
        ve.life+=dt*.7;
        ve.y-=20*dt;

        P.pos[i*3+1]+=ve.y*dt;

        if(ve.life>1||P.pos[i*3+1]<gy.ground){
          ve.life=0;
          P.pos[i*3+1]=gy.ground;
        }
      }
    }

    P.points.geometry.attributes.position.needsUpdate=true;
  }
}

class ExplosionSystem{
  constructor(sc,terr){
    this.scene=sc;
    this.terr=terr;
    this.particles=makePoints(sc,800,1.8,true,.95,true);
    this.cursor=0;
  }

  dispose(){
    this.scene.remove(this.particles.points);
  }

  explode(x,y,z,radius=6,strength=1){
    if(this.terr.addCrater){
      this.terr.addCrater(x,z,radius*0.9,radius*0.35*strength);
    }

    const P=this.particles;
    const count=Math.min(220,P.vel.length);

    for(let n=0;n<count;n++){
      const i=this.cursor;
      this.cursor=(this.cursor+1)%P.vel.length;

      const ve=P.vel[i];
      ve.life=1;

      P.pos[i*3]=x+(Math.random()-.5)*2;
      P.pos[i*3+1]=y+Math.random();
      P.pos[i*3+2]=z+(Math.random()-.5)*2;

      const a=Math.random()*Math.PI*2;
      const el=Math.random()*Math.PI*0.5;
      const sp=(6+Math.random()*16)*strength;

      ve.x=Math.cos(a)*Math.cos(el)*sp;
      ve.y=Math.sin(el)*sp+5;
      ve.z=Math.sin(a)*Math.cos(el)*sp;

      const c=Math.random();

      if(c<0.45){
        P.col[i*3]=1;
        P.col[i*3+1]=0.55;
        P.col[i*3+2]=0.08;
      } else if(c<0.75){
        P.col[i*3]=1;
        P.col[i*3+1]=0.25;
        P.col[i*3+2]=0.05;
      } else {
        P.col[i*3]=0.35;
        P.col[i*3+1]=0.35;
        P.col[i*3+2]=0.35;
      }
    }

    P.points.geometry.attributes.position.needsUpdate=true;
    P.points.geometry.attributes.color.needsUpdate=true;

    if(typeof chunkManager!=='undefined' && chunkManager && chunkManager.rebuildAround){
      chunkManager.rebuildAround(x,z,radius*2);
    }
  }

  update(dt){
    const P=this.particles;

    for(let i=0;i<P.vel.length;i++){
      const ve=P.vel[i];
      if(ve.life<=0)continue;

      ve.life-=dt*0.75;
      ve.y-=16*dt;

      P.pos[i*3]+=ve.x*dt;
      P.pos[i*3+1]+=ve.y*dt;
      P.pos[i*3+2]+=ve.z*dt;

      const gh=this.terr.getHeight(P.pos[i*3],P.pos[i*3+2]);

      if(ve.life<=0||P.pos[i*3+1]<gh-0.5){
        ve.life=0;
        P.pos[i*3+1]=-999;
      }
    }

    P.points.geometry.attributes.position.needsUpdate=true;
  }
}

// ОДИН червь Шай-Хулуд: ползает под землёй, оставляет след,
// иногда выныривает как кит, атакует низко летящего игрока.
class ShaiHuludSystem{
  constructor(sc,terr){
    this.scene=sc;
    this.terr=terr;
    this.size=3;

    this.built=shaiHulud(this.size);
    this.built.group.rotation.order='YXZ';
    this.built.group.visible=false;
    sc.add(this.built.group);

    this.x=(Math.random()-.5)*600;
    this.z=(Math.random()-.5)*600;
    this.heading=Math.random()*Math.PI*2;

    this.targetX=this.x;
    this.targetZ=this.z;

    this.state='underground';
    this.timer=0;
    this.emergeT=0;
    this.breachHeight=16;
    this.breachDuration=1.7;
    this.slamDuration=1.25;
    this.attackRun=false;
    this.attackType='momentum';
    this.huntSpeed=18;
    this.pits=[];
    this.whaleTimer=14+Math.random()*10;
    this.attackCooldown=0;
    this.trailAcc=0;

    this.sand=makePoints(sc,700,2.6,true,.95,false);
    this.trail=makePoints(sc,350,2.2,true,.8,false);

    this.sandCursor=0;
    this.trailCursor=0;

    this.worm={
      data:this.built,
      x:this.x,
      z:this.z,
      state:this.state
    };

    this.pickTarget();
  }

  dispose(){
    this.scene.remove(this.built.group);
    this.scene.remove(this.sand.points);
    this.scene.remove(this.trail.points);
  }

  pickTarget(){
    const a=Math.random()*Math.PI*2;
    const d=180+Math.random()*420;

    this.targetX=this.x+Math.cos(a)*d;
    this.targetZ=this.z+Math.sin(a)*d;
  }

  angleTo(tx,tz){
    return Math.atan2(tz-this.z,tx-this.x);
  }

  turnTowards(target,dt,rate){
    let d=target-this.heading;

    while(d>Math.PI)d-=Math.PI*2;
    while(d<-Math.PI)d+=Math.PI*2;

    this.heading+=clamp(d,-rate*dt,rate*dt);
  }

  emitTrail(x,z){
    const P=this.trail;
    const i=this.trailCursor;

    this.trailCursor=(this.trailCursor+1)%P.vel.length;

    const ve=P.vel[i];
    ve.life=1;

    const gh=this.terr.getHeight(x,z);

    P.pos[i*3]=x+(Math.random()-.5)*4.5;
    P.pos[i*3+1]=gh+0.35+Math.random()*0.8;
    P.pos[i*3+2]=z+(Math.random()-.5)*4.5;

    ve.x=(Math.random()-.5)*2.5;
    ve.y=1.2+Math.random()*2.5;
    ve.z=(Math.random()-.5)*2.5;

    P.col[i*3]=0.84;
    P.col[i*3+1]=0.68;
    P.col[i*3+2]=0.30;

    P.points.geometry.attributes.position.needsUpdate=true;
    P.points.geometry.attributes.color.needsUpdate=true;
  }

  emitBoil(x,z,intensity=1){
    const P=this.sand;
    const count=Math.floor(18+intensity*24);
    const gh=this.terr.getHeight(x,z);

    for(let n=0;n<count;n++){
      const i=this.sandCursor;
      this.sandCursor=(this.sandCursor+1)%P.vel.length;

      const ve=P.vel[i];
      const angle=Math.random()*Math.PI*2;
      const speed=(3+Math.random()*8)*intensity;

      ve.life=.35+Math.random()*.45;
      ve.x=Math.cos(angle)*speed;
      ve.y=3+Math.random()*7*intensity;
      ve.z=Math.sin(angle)*speed;

      P.pos[i*3]=x+(Math.random()-.5)*(6+intensity*5);
      P.pos[i*3+1]=gh+.15+Math.random();
      P.pos[i*3+2]=z+(Math.random()-.5)*(6+intensity*5);

      P.col[i*3]=0.86;
      P.col[i*3+1]=0.67;
      P.col[i*3+2]=0.28;
    }

    P.points.geometry.attributes.position.needsUpdate=true;
    P.points.geometry.attributes.color.needsUpdate=true;
  }

  createPit(x,z,radius=13,depth=5){
    const pit={x,z,radius,depth,maxDepth:depth,life:4,maxLife:4};
    this.terr.craters.push(pit);
    this.pits.push(pit);

    if(chunkManager && chunkManager.rebuildAround){
      chunkManager.rebuildAround(x,z,radius*2);
    }
  }

  updatePits(dt){
    for(let i=this.pits.length-1;i>=0;i--){
      const pit=this.pits[i];
      pit.life-=dt;
      pit.depth=pit.maxDepth*Math.max(0,pit.life/pit.maxLife);

      if(pit.life<=0){
        const index=this.terr.craters.indexOf(pit);
        if(index>=0)this.terr.craters.splice(index,1);
        this.pits.splice(i,1);

        if(chunkManager && chunkManager.rebuildAround){
          chunkManager.rebuildAround(pit.x,pit.z,pit.radius*2);
        }
      }
    }
  }

  burst(x,z,count=280){
    const P=this.sand;
    const gh=this.terr.getHeight(x,z);

    for(let n=0;n<count;n++){
      const i=this.sandCursor;
      this.sandCursor=(this.sandCursor+1)%P.vel.length;

      const ve=P.vel[i];
      ve.life=1;

      P.pos[i*3]=x+(Math.random()-.5)*10;
      P.pos[i*3+1]=gh+Math.random()*2.5;
      P.pos[i*3+2]=z+(Math.random()-.5)*10;

      const a=Math.random()*Math.PI*2;
      const sp=7+Math.random()*20;

      ve.x=Math.cos(a)*sp;
      ve.y=10+Math.random()*24;
      ve.z=Math.sin(a)*sp;

      P.col[i*3]=0.86;
      P.col[i*3+1]=0.70;
      P.col[i*3+2]=0.30;
    }

    P.points.geometry.attributes.position.needsUpdate=true;
    P.points.geometry.attributes.color.needsUpdate=true;
  }

  updateParticles(dt){
    for(const P of[this.sand,this.trail]){
      let any=false;

      for(let i=0;i<P.vel.length;i++){
        const ve=P.vel[i];
        if(ve.life<=0)continue;

        any=true;

        ve.life-=dt*(P===this.trail?0.55:0.7);
        ve.y-=18*dt;

        P.pos[i*3]+=ve.x*dt;
        P.pos[i*3+1]+=ve.y*dt;
        P.pos[i*3+2]+=ve.z*dt;

        const gh=this.terr.getHeight(P.pos[i*3],P.pos[i*3+2]);

        if(ve.life<=0||P.pos[i*3+1]<gh-0.5){
          ve.life=0;
          P.pos[i*3+1]=-999;
        }
      }

      if(any)P.points.geometry.attributes.position.needsUpdate=true;
    }
  }

  update(dt,t,playerPos){
    this.timer+=dt;

    if(this.attackCooldown>0)this.attackCooldown-=dt;

    this.updateParticles(dt);
    this.updatePits(dt);

    const pGh=this.terr.getHeight(playerPos.x,playerPos.z);
    const pAlt=playerPos.y-pGh;
    const dist=Math.hypot(this.x-playerPos.x,this.z-playerPos.z);
    const playerSpeed=aircraft?Math.hypot(aircraft.velocity.x,aircraft.velocity.z):0;
    const vibration=pAlt<24?playerSpeed:0;

    const g=this.built.group;

    if(this.state==='underground'){
      this.turnTowards(this.angleTo(this.targetX,this.targetZ),dt,1.6);

      const speed=16;

      this.x+=Math.cos(this.heading)*speed*dt;
      this.z+=Math.sin(this.heading)*speed*dt;

      if(Math.hypot(this.targetX-this.x,this.targetZ-this.z)<14){
        this.pickTarget();
      }

      this.trailAcc+=dt;

      if(this.trailAcc>0.035){
        this.trailAcc=0;
        this.emitTrail(this.x,this.z);
      }

      this.whaleTimer-=dt;

      if(this.whaleTimer<=0){
        this.state='breach';
        this.timer=0;
        this.attackRun=false;
        this.whaleTimer=16+Math.random()*14;
        this.burst(this.x,this.z,220);
      }

      if(dist<280 && vibration>8 && this.attackCooldown<=0){
        this.state='hunt';
        this.timer=0;
        this.huntSpeed=18;
      }

      g.visible=false;

    } else if(this.state==='hunt'){
      this.turnTowards(this.angleTo(playerPos.x,playerPos.z),dt,3.2);
      this.huntSpeed=Math.min(42,this.huntSpeed+18*dt);
      this.x+=Math.cos(this.heading)*this.huntSpeed*dt;
      this.z+=Math.sin(this.heading)*this.huntSpeed*dt;

      const intensity=clamp(1-dist/280,0,1);
      this.emitBoil(this.x,this.z,.7+intensity*1.6);

      if(dist<70 && pAlt<12 && aircraft && !aircraft.config.waterOnly){
        const drag=clamp(1-dist/75,.1,.8);
        aircraft.speed*=Math.max(.22,1-drag*dt*2.4);
      }

      if(dist<14){
        this.attackType=vibration>16?'momentum':'vertical';
        this.timer=0;
        this.emergeT=0;
        this.attackRun=this.attackType==='momentum';
        this.state=this.attackRun?'breach':'vertical-rise';
        this.burst(this.x,this.z,420);
      }

      g.visible=false;

    } else if(this.state==='breach'){
      this.turnTowards(this.angleTo(playerPos.x,playerPos.z),dt,2.5);

      const speed=10;

      this.x+=Math.cos(this.heading)*speed*dt;
      this.z+=Math.sin(this.heading)*speed*dt;

      this.emergeT=Math.min(1,this.timer/this.breachDuration);

      if(this.emergeT>=1){
        this.state=this.attackRun?'attack':'slam';
        this.timer=0;
      }

      g.visible=true;

    } else if(this.state==='vertical-rise'){
      this.x=playerPos.x;
      this.z=playerPos.z;
      this.emergeT=Math.min(1,this.timer/1.05);

      if(this.emergeT>=1){
        this.state='vertical-slam';
        this.timer=0;
      }

      g.visible=true;

    } else if(this.state==='vertical-slam'){
      this.x=playerPos.x;
      this.z=playerPos.z;
      this.emergeT=Math.max(0,1-this.timer/.72);

      if(dist<10 && pAlt<14 && aircraft && !aircraft.crashed){
        aircraft.crash('Поглощён Шай-Хулудом');
      }

      if(this.emergeT<=0){
        this.createPit(this.x,this.z,15,6);
        this.burst(this.x,this.z,460);
        this.state='underground';
        this.timer=0;
        this.attackCooldown=10;
        this.pickTarget();
        g.visible=false;
      }

      g.visible=this.emergeT>0;

    } else if(this.state==='slam'){
      const speed=22;

      this.x+=Math.cos(this.heading)*speed*dt;
      this.z+=Math.sin(this.heading)*speed*dt;
      this.emergeT=Math.max(0,1-this.timer/this.slamDuration);

      if(this.emergeT<=0){
        this.createPit(this.x,this.z,14,5);
        this.burst(this.x,this.z,320);
        this.state='underground';
        this.timer=0;
        this.pickTarget();
        g.visible=false;
      }

      g.visible=this.emergeT>0;

    } else if(this.state==='emerge'){
      this.turnTowards(this.angleTo(playerPos.x,playerPos.z),dt,2.5);

      this.emergeT=Math.min(1,this.timer/2.1);

      if(this.emergeT>=1){
        this.state='attack';
        this.timer=0;
      }

      g.visible=true;

    } else if(this.state==='attack'){
      this.turnTowards(this.angleTo(playerPos.x,playerPos.z),dt,2.8);

      const speed=31;

      this.x+=Math.cos(this.heading)*speed*dt;
      this.z+=Math.sin(this.heading)*speed*dt;

      if(
        dist<9 &&
        pAlt<11 &&
        typeof aircraft!=='undefined' &&
        aircraft &&
        !aircraft.crashed
      ){
        aircraft.crash('Схвачен Шай-Хулудом');
      }

      if(this.timer>2.4 || dist>220 || pAlt>35){
        this.state='slam';
        this.timer=0;
        this.emergeT=1;
        this.attackCooldown=8;
      }

      g.visible=true;

    } else if(this.state==='submerge'){
      this.emergeT=Math.max(0,1-this.timer/1.8);

      if(this.emergeT<=0){
        this.state='underground';
        this.timer=0;
        this.pickTarget();
        g.visible=false;
      }

      g.visible=this.emergeT>0.02;
    }

    const groundH=this.terr.getHeight(this.x,this.z);

    let y=groundH;
    let pitch=0;

    if(this.state==='underground'){
      y=groundH-10;
    } else if(this.state==='hunt'){
      y=groundH-8;
    } else if(this.state==='breach'){
      y=groundH-7+this.emergeT*(this.breachHeight+7);
      pitch=-1.15+this.emergeT*.8;
    } else if(this.state==='slam'){
      const progress=1-this.emergeT;
      y=groundH+this.breachHeight*(1-progress*progress);
      pitch=-.35+progress*1.35;
    } else if(this.state==='vertical-rise'){
      y=groundH-7+this.emergeT*29;
      pitch=-Math.PI/2;
    } else if(this.state==='vertical-slam'){
      const progress=1-this.emergeT;
      y=groundH+22*(1-progress*progress);
      pitch=Math.PI/2;
    } else if(this.state==='emerge'){
      y=groundH-8+this.emergeT*22;
      pitch=-1.25+this.emergeT*1.1;
    } else if(this.state==='attack'){
      y=groundH+12+Math.sin(t*2.2)*2.5;
      pitch=-0.12;
    } else if(this.state==='submerge'){
      y=groundH-8+this.emergeT*22;
      pitch=-1.25+this.emergeT*1.1;
    }

    g.position.set(this.x,y,this.z);
    g.rotation.set(pitch,-this.heading,0,'YXZ');

    const segs=this.built.segments;

    for(let i=0;i<segs.length;i++){
      const s=segs[i];
      s.visible=true;

      const amp=this.state==='attack'?0.8:0.28;
      s.position.y=Math.sin(t*5.2-i*0.55)*amp;
      s.position.z=Math.sin(t*3.1-i*0.42)*0.28;
    }

    if(this.built.mouth){
      this.built.mouth.visible=true;
      const opening=this.state==='vertical-rise'?1+this.emergeT*.7:1;
      this.built.mouth.scale.set(1,opening,opening);
    }

    this.worm.x=this.x;
    this.worm.z=this.z;
    this.worm.state=this.state;

    const warning=el('worm-warning');

    if(warning){
      warning.style.display=(
        this.state==='underground' &&
        dist<120 &&
        pAlt<22
      )?'block':'none';
    }
  }
}

// Битвы фременов и харконненов: стрельба, гранаты, подкрепления и взрывы.
class BattleSystem{
  constructor(sc,terr,explosionSys){
    this.scene=sc;
    this.terr=terr;
    this.explosionSys=explosionSys||null;

    this.battles=[];
    this.projectiles=[];
    this.grenades=[];
    this.playerBolts=[];
    this.fallen=[];
    this.transports=[];

    this.lastBattle=8;
    this.battleInterval=25;

    this.projGeo=new THREE.SphereGeometry(0.08,4,4);
    this.projGeo.userData.shared=true;

    this.grenadeGeo=new THREE.SphereGeometry(0.15,6,6);
    this.grenadeGeo.userData.shared=true;
  }

  dispose(){
    for(const b of this.battles){
      for(const u of [...b.fremen,...b.harkonnen]){
        if(u.alive){
          this.scene.remove(u.data.group);
          u.alive=false;
        }
      }
    }

    for(const p of this.projectiles){
      this.scene.remove(p.mesh);
      p.mesh.material.dispose();
    }

    for(const g of this.grenades){
      this.scene.remove(g.mesh);
      g.mesh.material.dispose();
    }

    for(const bolt of this.playerBolts){
      this.scene.remove(bolt.line);
      bolt.line.geometry.dispose();
      bolt.line.material.dispose();
    }

    for(const f of this.fallen){
      this.scene.remove(f.group);
    }

    for(const transport of this.transports){
      this.scene.remove(transport.group);
    }

    this.battles=[];
    this.projectiles=[];
    this.grenades=[];
    this.playerBolts=[];
    this.fallen=[];
    this.transports=[];

    this.projGeo.dispose();
    this.grenadeGeo.dispose();
  }

  spawnBattle(x,z){
    const fremenCount=3+Math.floor(Math.random()*3);
    const harkCount=3+Math.floor(Math.random()*3);

    const f=[];
    const h=[];

    for(let i=0;i<fremenCount;i++){
      const fr=fremen();

      const angle=Math.random()*Math.PI*2;
      const dist=5+Math.random()*8;

      const wx=x+Math.cos(angle)*dist;
      const wz=z+Math.sin(angle)*dist;

      fr.group.position.set(wx,this.terr.getHeight(wx,wz),wz);
      fr.group.rotation.y=Math.random()*Math.PI*2;

      this.scene.add(fr.group);

      f.push({
        data:fr,
        target:null,
        attackTimer:0,
        shootTimer:Math.random()*0.6,
        grenadeTimer:5+Math.random()*5,
        alive:true,
        hp:3
      });
    }

    for(let i=0;i<harkCount;i++){
      const hk=harkonnen();

      const angle=Math.random()*Math.PI*2;
      const dist=15+Math.random()*10;

      const wx=x+Math.cos(angle)*dist;
      const wz=z+Math.sin(angle)*dist;

      hk.group.position.set(wx,this.terr.getHeight(wx,wz),wz);
      hk.group.rotation.y=Math.random()*Math.PI*2;

      this.scene.add(hk.group);

      h.push({
        data:hk,
        target:null,
        attackTimer:0,
        shootTimer:Math.random()*0.6,
        grenadeTimer:5+Math.random()*5,
        alive:true,
        hp:3
      });
    }

    this.battles.push({
      fremen:f,
      harkonnen:h,
      center:new THREE.Vector3(x,0,z),
      timer:0,
      endTimer:0,
      reinforcementTimer:12+Math.random()*8
    });
  }

  createUnit(isHark,x,z){
    const data=isHark?harkonnen():fremen();
    data.group.position.set(x,this.terr.getHeight(x,z),z);
    data.group.rotation.y=Math.random()*Math.PI*2;
    this.scene.add(data.group);

    return{
      data,
      target:null,
      attackTimer:0,
      shootTimer:Math.random()*0.6,
      grenadeTimer:5+Math.random()*5,
      alive:true,
      hp:3
    };
  }

  summonTransport(b,isHark){
    const angle=Math.random()*Math.PI*2;
    const distance=180;
    const x=b.center.x+Math.cos(angle)*distance;
    const z=b.center.z+Math.sin(angle)*distance;
    const group=duneTransport();

    group.position.set(x,this.terr.getHeight(x,z)+45,z);
    group.rotation.y=Math.atan2(b.center.z-z,b.center.x-x);
    this.scene.add(group);

    this.transports.push({
      group,
      battle:b,
      isHark,
      deployed:false,
      life:0
    });
  }

  updateTransports(dt){
    for(let i=this.transports.length-1;i>=0;i--){
      const transport=this.transports[i];
      const target=transport.battle.center;
      const position=transport.group.position;
      const dx=target.x-position.x;
      const dz=target.z-position.z;
      const distance=Math.hypot(dx,dz);

      transport.life+=dt;

      if(!transport.deployed){
        position.x+=dx/distance*36*dt;
        position.z+=dz/distance*36*dt;
        position.y=this.terr.getHeight(position.x,position.z)+38;
        transport.group.rotation.y=Math.atan2(dz,dx);

        if(distance<10){
          transport.deployed=true;

          for(let n=0;n<3;n++){
            const a=Math.random()*Math.PI*2;
            const x=target.x+Math.cos(a)*(8+Math.random()*7);
            const z=target.z+Math.sin(a)*(8+Math.random()*7);
            const unit=this.createUnit(transport.isHark,x,z);
            (transport.isHark?transport.battle.harkonnen:transport.battle.fremen).push(unit);
          }
        }
      } else {
        position.x+=Math.cos(transport.group.rotation.y)*42*dt;
        position.z+=Math.sin(transport.group.rotation.y)*42*dt;
        position.y=this.terr.getHeight(position.x,position.z)+38;

        if(transport.life>14){
          this.scene.remove(transport.group);
          this.transports.splice(i,1);
        }
      }
    }
  }

  fireProjectile(from,to,isHark){
    const mat=new THREE.MeshBasicMaterial({
      color:isHark?0xff4444:0x44ffaa
    });

    const mesh=new THREE.Mesh(this.projGeo,mat);
    mesh.position.copy(from);

    this.scene.add(mesh);

    const dir=new THREE.Vector3().subVectors(to,from);

    if(dir.lengthSq()<0.001){
      dir.set(1,0,0);
    }

    dir.normalize().multiplyScalar(70);

    this.projectiles.push({
      mesh,
      pos:from.clone(),
      vel:dir,
      life:1.6,
      isHark
    });
  }

  throwGrenade(from,target,isHark){
    const mat=new THREE.MeshStandardMaterial({
      color:0x334433,
      roughness:0.7
    });

    const mesh=new THREE.Mesh(this.grenadeGeo,mat);
    mesh.position.copy(from);
    mesh.castShadow=true;

    this.scene.add(mesh);

    const dx=target.x-from.x;
    const dz=target.z-from.z;

    const t=1.1;

    const vx=dx/t;
    const vz=dz/t;
    const vy=(target.y-from.y+0.5*9.8*t*t)/t;

    this.grenades.push({
      mesh,
      pos:from.clone(),
      vel:new THREE.Vector3(vx,vy,vz),
      life:t+0.2,
      isHark
    });
  }

  killUnit(u,dir){
    if(!u.alive)return;

    u.alive=false;

    const g=u.data.group;

    this.fallen.push({
      group:g,
      vel:new THREE.Vector3(
        dir?dir.x*0.3:(Math.random()-.5)*2,
        3+Math.random()*2,
        dir?dir.z*0.3:(Math.random()-.5)*2
      ),
      rotVel:new THREE.Vector3(
        (Math.random()-.5)*8,
        (Math.random()-.5)*8,
        (Math.random()-.5)*8
      ),
      age:0
    });
  }

  damageUnitsAround(x,y,z,radius,dmg){
    for(const b of this.battles){
      for(const u of [...b.fremen,...b.harkonnen]){
        if(!u.alive)continue;

        const d=u.data.group.position.distanceTo(new THREE.Vector3(x,y,z));

        if(d<radius){
          u.hp-=dmg;

          if(u.hp<=0){
            const dir=new THREE.Vector3(
              u.data.group.position.x-x,
              0,
              u.data.group.position.z-z
            ).normalize();

            this.killUnit(u,dir);
          }
        }
      }
    }
  }

  firePlayerBlaster(origin,direction,range,damage){
    let hit=null;
    let hitDistance=range;

    for(const battle of this.battles){
      for(const unit of [...battle.fremen,...battle.harkonnen]){
        if(!unit.alive)continue;

        _v1.subVectors(unit.data.group.position,origin);
        const along=_v1.dot(direction);

        if(along<0||along>hitDistance)continue;

        _v2.copy(direction).multiplyScalar(along).add(origin);

        if(_v2.distanceToSquared(unit.data.group.position)>1.1)continue;

        hit=unit;
        hitDistance=along;
      }
    }

    const end=_v3.copy(direction).multiplyScalar(hitDistance).add(origin);
    const geometry=new THREE.BufferGeometry().setFromPoints([origin,end]);
    const material=new THREE.LineBasicMaterial({color:0x55d8ff,transparent:true,opacity:.9});
    const line=new THREE.Line(geometry,material);

    this.scene.add(line);
    this.playerBolts.push({line,life:.08});

    if(hit){
      hit.hp-=damage;

      if(hit.hp<=0)this.killUnit(hit,direction);
    }
  }

  update(dt,t,playerPos){
    this.lastBattle+=dt;
    this.updateTransports(dt);

    if(this.lastBattle>this.battleInterval && this.battles.length<2){
      this.lastBattle=0;
      this.battleInterval=20+Math.random()*30;

      const angle=Math.random()*Math.PI*2;
      const dist=100+Math.random()*200;

      this.spawnBattle(
        playerPos.x+Math.cos(angle)*dist,
        playerPos.z+Math.sin(angle)*dist
      );
    }

    for(let bi=this.battles.length-1;bi>=0;bi--){
      const b=this.battles[bi];
      b.timer+=dt;
      b.reinforcementTimer-=dt;

      if(b.reinforcementTimer<=0){
        const fAlive=b.fremen.filter(u=>u.alive).length;
        const hAlive=b.harkonnen.filter(u=>u.alive).length;

        if(fAlive>0 && hAlive>0){
          this.summonTransport(b,hAlive<=fAlive);
          b.reinforcementTimer=22+Math.random()*14;
        }
      }

      for(const fr of b.fremen){
        if(!fr.alive)continue;

        let nearest=null;
        let minD=999;

        for(const hk of b.harkonnen){
          if(!hk.alive)continue;

          const d=fr.data.group.position.distanceTo(hk.data.group.position);

          if(d<minD){
            minD=d;
            nearest=hk;
          }
        }

        if(nearest){
          fr.target=nearest;

          const dx=nearest.data.group.position.x-fr.data.group.position.x;
          const dz=nearest.data.group.position.z-fr.data.group.position.z;
          const dist=Math.hypot(dx,dz);

          if(dist>18){
            const speed=2.6*dt;

            fr.data.group.position.x+=dx/dist*speed;
            fr.data.group.position.z+=dz/dist*speed;
            fr.data.group.position.y=this.terr.getHeight(
              fr.data.group.position.x,
              fr.data.group.position.z
            );

            fr.data.group.rotation.y=Math.atan2(dz,dx);
          } else {
            fr.shootTimer-=dt;

            if(fr.shootTimer<=0 && dist<45){
              fr.shootTimer=0.45+Math.random()*0.4;

              const from=fr.data.group.position.clone().add(new THREE.Vector3(0,1.3,0));
              const to=nearest.data.group.position.clone().add(new THREE.Vector3(0,1.2,0));

              to.x+=(Math.random()-.5)*1.2;
              to.y+=(Math.random()-.5)*0.5;
              to.z+=(Math.random()-.5)*1.2;

              this.fireProjectile(from,to,false);
            }

            fr.grenadeTimer-=dt;

            if(fr.grenadeTimer<=0 && dist<30 && dist>8){
              fr.grenadeTimer=8+Math.random()*6;

              const from=fr.data.group.position.clone().add(new THREE.Vector3(0,1.5,0));
              const to=nearest.data.group.position.clone();

              this.throwGrenade(from,to,false);
            }
          }
        }

        const legs=fr.data.legs;

        for(let i=0;i<legs.length;i++){
          legs[i].rotation.x=Math.sin(t*8+i*Math.PI)*0.4;
        }
      }

      for(const hk of b.harkonnen){
        if(!hk.alive)continue;

        let nearest=null;
        let minD=999;

        for(const fr of b.fremen){
          if(!fr.alive)continue;

          const d=hk.data.group.position.distanceTo(fr.data.group.position);

          if(d<minD){
            minD=d;
            nearest=fr;
          }
        }

        if(nearest){
          hk.target=nearest;

          const dx=nearest.data.group.position.x-hk.data.group.position.x;
          const dz=nearest.data.group.position.z-hk.data.group.position.z;
          const dist=Math.hypot(dx,dz);

          if(dist>18){
            const speed=1.9*dt;

            hk.data.group.position.x+=dx/dist*speed;
            hk.data.group.position.z+=dz/dist*speed;
            hk.data.group.position.y=this.terr.getHeight(
              hk.data.group.position.x,
              hk.data.group.position.z
            );

            hk.data.group.rotation.y=Math.atan2(dz,dx);
          } else {
            hk.shootTimer-=dt;

            if(hk.shootTimer<=0 && dist<50){
              hk.shootTimer=0.4+Math.random()*0.35;

              const from=hk.data.group.position.clone().add(new THREE.Vector3(0,1.3,0));
              const to=nearest.data.group.position.clone().add(new THREE.Vector3(0,1.2,0));

              to.x+=(Math.random()-.5)*1.2;
              to.y+=(Math.random()-.5)*0.5;
              to.z+=(Math.random()-.5)*1.2;

              this.fireProjectile(from,to,true);
            }

            hk.grenadeTimer-=dt;

            if(hk.grenadeTimer<=0 && dist<32 && dist>8){
              hk.grenadeTimer=10+Math.random()*8;

              const from=hk.data.group.position.clone().add(new THREE.Vector3(0,1.5,0));
              const to=nearest.data.group.position.clone();

              this.throwGrenade(from,to,true);
            }
          }
        }

        const legs=hk.data.legs;

        for(let i=0;i<legs.length;i++){
          legs[i].rotation.x=Math.sin(t*6+i*Math.PI)*0.3;
        }
      }

      const fAlive=b.fremen.filter(u=>u.alive).length;
      const hAlive=b.harkonnen.filter(u=>u.alive).length;

      if(fAlive===0 && hAlive===0){
        b.endTimer+=dt;

        if(b.endTimer>3){
          this.battles.splice(bi,1);
        }
      } else if(fAlive===0 || hAlive===0){
        b.endTimer+=dt;

        if(b.endTimer>10){
          for(const u of [...b.fremen,...b.harkonnen]){
            if(u.alive){
              this.scene.remove(u.data.group);
              u.alive=false;
            }
          }

          this.battles.splice(bi,1);
        }
      } else {
        b.endTimer=0;
      }
    }

    for(let i=this.projectiles.length-1;i>=0;i--){
      const p=this.projectiles[i];

      p.life-=dt;
      p.pos.addScaledVector(p.vel,dt);
      p.mesh.position.copy(p.pos);

      let hit=false;

      for(const b of this.battles){
        const targets=p.isHark?b.fremen:b.harkonnen;

        for(const u of targets){
          if(!u.alive)continue;

          if(p.pos.distanceTo(u.data.group.position)<1.1){
            u.hp--;

            if(u.hp<=0){
              this.killUnit(u,p.vel.clone().normalize().multiplyScalar(2));
            }

            hit=true;
            break;
          }
        }

        if(hit)break;
      }

      const gh=this.terr.getHeight(p.pos.x,p.pos.z);

      if(p.pos.y<gh+0.1){
        hit=true;
      }

      if(hit||p.life<=0){
        this.scene.remove(p.mesh);
        p.mesh.material.dispose();
        this.projectiles.splice(i,1);
      }
    }

    for(let i=this.grenades.length-1;i>=0;i--){
      const g=this.grenades[i];

      g.life-=dt;
      g.vel.y-=9.8*dt;
      g.pos.addScaledVector(g.vel,dt);

      g.mesh.position.copy(g.pos);
      g.mesh.rotation.x+=dt*8;
      g.mesh.rotation.z+=dt*5;

      const gh=this.terr.getHeight(g.pos.x,g.pos.z);

      if(g.pos.y<=gh+0.2 || g.life<=0){
        if(this.explosionSys){
          this.explosionSys.explode(g.pos.x,gh+0.5,g.pos.z,7,1.25);
        }

        this.damageUnitsAround(g.pos.x,gh+0.5,g.pos.z,8,2);

        this.scene.remove(g.mesh);
        g.mesh.material.dispose();
        this.grenades.splice(i,1);
      }
    }

    for(let i=this.fallen.length-1;i>=0;i--){
      const f=this.fallen[i];

      f.age+=dt;
      f.vel.y-=9.8*dt;

      f.group.position.addScaledVector(f.vel,dt);

      f.group.rotation.x+=f.rotVel.x*dt;
      f.group.rotation.y+=f.rotVel.y*dt;
      f.group.rotation.z+=f.rotVel.z*dt;

      const gh=this.terr.getHeight(f.group.position.x,f.group.position.z);

      if(f.group.position.y<gh){
        f.group.position.y=gh;
        f.vel.set(0,0,0);
        f.rotVel.multiplyScalar(0.4);
      }

      if(f.age>6){
        this.scene.remove(f.group);
        this.fallen.splice(i,1);
      }
    }

    for(let i=this.playerBolts.length-1;i>=0;i--){
      const bolt=this.playerBolts[i];
      bolt.life-=dt;

      if(bolt.life<=0){
        this.scene.remove(bolt.line);
        bolt.line.geometry.dispose();
        bolt.line.material.dispose();
        this.playerBolts.splice(i,1);
      }
    }
  }
}

class TerrainGenerator{
  constructor(world,seed,chunkSize){
    this.world=world;
    this.seed=seed;
    this.chunkSize=chunkSize||SETTINGS.chunkSize;

    this.noise=new SimplexNoise(seed);
    this.moisture=new SimplexNoise(seed+1);
    this.river=new SimplexNoise(seed+2);
    this.animalNoise=new SimplexNoise(seed+3);

    this.volcanoCenter=this._seedVolcano();
    this.megaMountain=this._seedMega();

    // Кратеры от взрывов
    this.craters=[];
  }

  _h(a,b){
    return Math.abs(Math.sin(a*127.1+b*311.7))*10000%1;
  }

  _seedVolcano(){
    const a=this._h(this.seed,1);
    const b=this._h(this.seed,2);
    return new THREE.Vector3((a*2-1)*400,0,(b*2-1)*400);
  }

  _seedMega(){
    const r=this._h(this.seed,7);
    const a=this._h(this.seed,5);
    const b=this._h(this.seed,6);
    return{active:r<.45,x:(a*2-1)*900,z:(b*2-1)*900,h:300+r*140,r:420};
  }

  megaHeight(x,z){
    const m=this.megaMountain;
    if(!m.active)return 0;
    const d=Math.hypot(x-m.x,z-m.z);
    if(d>=m.r)return 0;
    const t=1-d/m.r;
    return m.h*Math.pow(t,1.6);
  }

  volcanoHeight(x,z){
    if(this.world.id!=='volcano')return 0;
    const d=Math.hypot(x-this.volcanoCenter.x,z-this.volcanoCenter.z);
    const R=260;
    if(d>=R)return 0;
    let c=(1-d/R)*130;
    if(d<45)c-=(1-d/45)*55;
    return c;
  }

  snowLine(){return 120;}

  oasisAt(x,z){
    const o=this.noise.noise2D(x*.0012,z*.0012);
    return o>0.90?(o-0.90)/0.10:0;
  }

  addCrater(x,z,radius,depth){
    this.craters.push({x,z,radius,depth});
    if(this.craters.length>120)this.craters.shift();
  }

  getHeight(x,z){
    const w=this.world.id;
    const base=this.noise.fbm(x*.0025,z*.0025,4);
    const hills=Math.max(0,this.noise.noise2D(x*.007,z*.007))*14;
    const rangeMask=Math.max(0,this.noise.noise2D(x*.001,z*.001));
    const range=Math.pow(Math.max(0,this.noise.fbm(x*.0035,z*.0035,4)),1.6)*rangeMask*160;
    const ridge=Math.pow(1-Math.abs(this.noise.fbm(x*.003,z*.003,4)),2)*rangeMask*180;
    const mega=this.megaHeight(x,z);

    let h=0;

    if(w==='desert'||w==='dune'){
      h=8+this.noise.fbm(x*.004,z*.004,3)*6+Math.max(0,this.noise.noise2D(x*.006,z*.006))*6;
      if(w==='dune'){h+=Math.sin(x*.01)*Math.cos(z*.008)*15+Math.sin(x*.005+z*.003)*10;}
      h=Math.max(h,WATER_LEVEL+1.5);
      const o=this.oasisAt(x,z);
      if(o>0){const t=smoothstep(0,1,o);h=h*(1-t)+(WATER_LEVEL-2)*t;}
    } else if(w==='swamp'){
      const b=this.noise.fbm(x*.004,z*.004,3);
      h=WATER_LEVEL-1.5+b*3;
    } else if(w==='jungle'){
      h=6+base*16+hills*1.2+range*0.5;
      const rn=this.river.noise2D(x*.0025,z*.0025);
      const rw=Math.max(0,1-Math.abs(rn)*3);
      if(rw>0.2){const tt=smoothstep(0.2,0.9,rw);h=h*(1-tt)+(WATER_LEVEL-1)*tt;}
      else{const wet=this.moisture.noise2D(x*.003,z*.003);if(wet>.72&&h<12)h=WATER_LEVEL-0.5;}
      h=Math.max(h,-8);
    } else if(w==='volcano'){
      const b2=this.noise.fbm(x*.003,z*.003,3);
      h=8+b2*10+this.volcanoHeight(x,z);
    } else {
      h=8+base*22+hills+range+ridge+mega;
      const wet=this.moisture.noise2D(x*.002,z*.002);
      if(wet>.68&&h<14)h=WATER_LEVEL-.5-(wet-.68)*2;
      else if(wet>.6&&h<15)h=WATER_LEVEL+.6+(wet-.6)*1.5;
      const rn=this.river.noise2D(x*.002,z*.002);
      const rw=Math.max(0,1-Math.abs(rn)*4);
      if(rw>0.15){const tt=smoothstep(0.15,0.85,rw);h=h*(1-tt)+(WATER_LEVEL-1.5)*tt;}
      h=Math.max(h,-12);
    }

    // Применяем кратеры от взрывов
    for(const c of this.craters){
      const d=Math.hypot(x-c.x,z-c.z);
      if(d<c.radius){
        const t=1-d/c.radius;
        h-=c.depth*t*t;
      }
    }

    return h;
  }

  getMoisture(x,z){return(this.moisture.noise2D(x*.002,z*.002)+1)/2;}
  getAnimalDensity(x,z){return(this.animalNoise.noise2D(x*.005,z*.005)+1)/2;}

  getBiome(h,m){
    const w=this.world.id;
    if(w==='desert'||w==='dune')return h<WATER_LEVEL?'oasis':'desert';
    if(w==='swamp')return h<WATER_LEVEL?'water':'swamp';
    if(w==='jungle')return h<WATER_LEVEL?'water':(h>60?'mountain':'jungle');
    if(w==='volcano')return h>50?'volcano':'rocky';
    if(h>this.snowLine())return'snow';
    if(h<WATER_LEVEL)return'water';
    if(h<WATER_LEVEL+1.5)return'swamp';
    if(h>60)return'mountain';
    if(h>40)return'alpine';
    if(m>.7)return'swamp';
    if(m>.5)return'forest';
    if(m>.3)return'plains';
    return'rocky';
  }
}

const _dummy=new THREE.Object3D();
const _m4b=new THREE.Matrix4();

class Chunk{
  constructor(cx,cz,sc,terr,lod,chunkSize,chunkRes){
    this.cx=cx;this.cz=cz;this.scene=sc;this.terrain=terr;this.lod=lod;
    this.chunkSize=chunkSize||SETTINGS.chunkSize;this.res=chunkRes||SETTINGS.chunkRes;
    this.group=new THREE.Group();this.group.position.set(cx*this.chunkSize,0,cz*this.chunkSize);
    this.colliders=[];this.animals=[];this.instanced=[];
    this.grassMesh=null;this.rockMesh=null;this.terrainMesh=null;this.mist=null;this.smokers=null;
    this.build();sc.add(this.group);
  }

  addInstanced(parts,matrices,cs){
    if(!parts||!matrices.length)return;
    for(const p of parts){
      const im=new THREE.InstancedMesh(p.geometry,p.material,matrices.length);
      for(let i=0;i<matrices.length;i++){_m4b.multiplyMatrices(matrices[i],p.matrix);im.setMatrixAt(i,_m4b);}
      im.instanceMatrix.needsUpdate=true;im.castShadow=!!cs;im.receiveShadow=true;im.computeBoundingSphere();
      this.group.add(im);this.instanced.push(im);
    }
  }

  build(){
    const hw=this.buildTerrain();if(hw){this.buildWater();this.buildMist();}
    if(this.lod===2){this.buildVeg();this.buildRocks(SETTINGS.rockCount);this.buildStructures(true);this.buildAnimals();this.buildGrassWith(SETTINGS.grassCount);}
    else{this.buildTreesFar();if(this.lod===1)this.buildStructures(false);}
  }

  rebuild(){
    const sc=this.scene;
    this.dispose();
    this.group=new THREE.Group();this.group.position.set(this.cx*this.chunkSize,0,this.cz*this.chunkSize);
    this.colliders=[];this.animals=[];this.instanced=[];
    this.grassMesh=null;this.rockMesh=null;this.terrainMesh=null;this.mist=null;this.smokers=null;
    sc.add(this.group);
    this.build();
  }

  buildTerrain(){
    const geo=new THREE.PlaneGeometry(this.chunkSize,this.chunkSize,this.res,this.res);geo.rotateX(-Math.PI/2);
    const pos=geo.attributes.position;const col=new Float32Array(pos.count*3);
    const wX=this.cx*this.chunkSize,wZ=this.cz*this.chunkSize;let minH=1e9;
    for(let i=0;i<pos.count;i++){
      const x=wX+pos.getX(i),z=wZ+pos.getZ(i);
      const h=this.terrain.getHeight(x,z);if(h<minH)minH=h;pos.setY(i,h);
      const b=this.terrain.getBiome(h,this.terrain.getMoisture(x,z));let c;
      if(b==='snow')c=new THREE.Color(.95,.96,.98);
      else if(b==='desert')c=new THREE.Color(.9,.82,.6);
      else if(b==='oasis')c=new THREE.Color(.5,.6,.4);
      else if(b==='swamp')c=new THREE.Color(.42,.5,.4);
      else if(b==='jungle')c=new THREE.Color(.28,.5,.26);
      else if(b==='volcano')c=new THREE.Color(.42,.36,.32);
      else if(b==='mountain')c=new THREE.Color(.66,.66,.68);
      else if(b==='alpine')c=new THREE.Color(.7,.74,.66);
      else if(b==='forest')c=new THREE.Color(.4,.58,.38);
      else if(b==='plains')c=new THREE.Color(.55,.66,.45);
      else if(b==='rocky')c=new THREE.Color(.6,.58,.52);
      else c=new THREE.Color(.45,.56,.45);
      col[i*3]=c.r;col[i*3+1]=c.g;col[i*3+2]=c.b;
    }
    geo.setAttribute('color',new THREE.BufferAttribute(col,3));geo.computeVertexNormals();
    const isDesert=this.terrain.world.id==='desert'||this.terrain.world.id==='dune';
    const m=new THREE.Mesh(geo,mat('terr'+(isDesert?'D':''),()=>new THREE.MeshStandardMaterial({map:isDesert?textures.tex.sand:textures.tex.grass,vertexColors:true,flatShading:true,roughness:.9})));
    m.receiveShadow=true;this.terrainMesh=m;this.group.add(m);
    return minH<WATER_LEVEL+.5;
  }

  buildWater(){
    const geo=new THREE.PlaneGeometry(this.chunkSize,this.chunkSize,1,1);geo.rotateX(-Math.PI/2);
    const w=new THREE.Mesh(geo,M.water());w.position.y=WATER_LEVEL;this.group.add(w);
  }

  buildMist(){
    const wX=this.cx*this.chunkSize,wZ=this.cz*this.chunkSize;
    const mask=(x,z)=>clamp((WATER_LEVEL+2-this.terrain.getHeight(x,z))/2,0,1);let any=0;
    for(let i=0;i<=8&&!any;i++)for(let j=0;j<=8;j++){if(mask(wX-this.chunkSize/2+i*this.chunkSize/8,wZ-this.chunkSize/2+j*this.chunkSize/8)>.05){any=1;break;}}
    if(!any)return;this.mist=new THREE.Group();
    for(let li=0;li<MIST_LAYERS.length;li++){
      const geo=new THREE.PlaneGeometry(this.chunkSize,this.chunkSize,16,16);geo.rotateX(-Math.PI/2);
      const pos=geo.attributes.position;const col=new Float32Array(pos.count*4);
      for(let i=0;i<pos.count;i++){
        const a=mask(wX+pos.getX(i),wZ+pos.getZ(i));
        col[i*4]=.94;col[i*4+1]=.96;col[i*4+2]=.97;col[i*4+3]=a;
      }
      geo.setAttribute('color',new THREE.BufferAttribute(col,4));
      const m=M.mist().clone();m.vertexColors=true;m.opacity=0;m.userData.shared=false;
      const pl=new THREE.Mesh(geo,m);pl.position.y=WATER_LEVEL+MIST_LAYERS[li].dy*SETTINGS.mistHeight;pl.renderOrder=5+li;pl.userData.fade=MIST_LAYERS[li].fade;pl.userData.baseDy=MIST_LAYERS[li].dy;this.mist.add(pl);
    }
    this.mist.visible=false;this.group.add(this.mist);
  }

  buildTreesFar(){
    const w=this.terrain.world.veg;if(w==='volcano'||w==='desert'||w==='dune')return;
    const rng=chunkRng(this.cx,this.cz,1);const geo=worldTreeGeo(w);const m=treeMat();const matrices=[];
    for(let i=0;i<60;i++){
      const lx=(rng()-.5)*this.chunkSize,lz=(rng()-.5)*this.chunkSize;
      const wx=this.cx*this.chunkSize+lx,wz=this.cz*this.chunkSize+lz;
      const h=this.terrain.getHeight(wx,wz),b=this.terrain.getBiome(h,this.terrain.getMoisture(wx,wz));
      if(b==='water'||b==='swamp'||b==='snow'||h>75)continue;
      const d=Math.min(1,(b==='forest'||b==='jungle'||b==='prehistoric'?0.9:b==='plains'?0.2:0.3)*SETTINGS.treeDensity);if(rng()>d)continue;
      const sc=.8+rng()*.8;_dummy.position.set(lx,h,lz);_dummy.rotation.set(0,rng()*6.283,0);_dummy.scale.setScalar(sc);_dummy.updateMatrix();
      matrices.push(_dummy.matrix.clone());
      if(this.lod===1)this.colliders.push({position:new THREE.Vector3(wx,h+3.2*sc,wz),radius:2.3*sc,type:'tree'});
    }
    if(!matrices.length)return;
    this.addInstanced([{geometry:geo,material:m,matrix:new THREE.Matrix4()}],matrices,true);
  }

  buildVeg(){
    const W=this.terrain.world;const w=W.veg;const rng=chunkRng(this.cx,this.cz,2);
    if(w==='volcano'||w==='dune')return;
    if(w==='desert'){
      const cacti=[];
      for(let i=0;i<8;i++){
        const lx=(rng()-.5)*this.chunkSize,lz=(rng()-.5)*this.chunkSize;
        const wx=this.cx*this.chunkSize+lx,wz=this.cz*this.chunkSize+lz;
        const h=this.terrain.getHeight(wx,wz);if(h>WATER_LEVEL+4)continue;
        _dummy.position.set(lx,h,lz);_dummy.rotation.set(0,rng()*6.283,0);_dummy.scale.setScalar(.8+rng()*.6);_dummy.updateMatrix();cacti.push(_dummy.matrix.clone());
      }
      if(cacti.length)this.addInstanced([{geometry:worldTreeGeo('desert'),material:treeMat(),matrix:new THREE.Matrix4()}],cacti,true);
      return;
    }
    const geo=worldTreeGeo(w);const m=treeMat();const mult=w==='jungle'?1.6:1;const matrices=[];const tc=Math.round(70*SETTINGS.treeDensity*mult);
    for(let i=0;i<tc;i++){
      const lx=(rng()-.5)*this.chunkSize,lz=(rng()-.5)*this.chunkSize;
      const wx=this.cx*this.chunkSize+lx,wz=this.cz*this.chunkSize+lz;
      const h=this.terrain.getHeight(wx,wz),b=this.terrain.getBiome(h,this.terrain.getMoisture(wx,wz));
      if(b==='water'||b==='swamp'||b==='snow'||h>75)continue;
      const d=b==='forest'||b==='jungle'?1:b==='plains'?.25:.4;if(rng()>d)continue;
      const sc=(0.8+rng()*.8)*(w==='prehistoric'?1.4:w==='jungle'?1.5:1.6);
      _dummy.position.set(lx,h,lz);_dummy.rotation.set(0,rng()*6.283,0);_dummy.scale.setScalar(sc);_dummy.updateMatrix();
      matrices.push(_dummy.matrix.clone());this.colliders.push({position:new THREE.Vector3(wx,h+sc*2,wz),radius:sc,type:'tree'});
    }
    this.addInstanced([{geometry:geo,material:m,matrix:new THREE.Matrix4()}],matrices,true);
    if(w==='jungle'){
      const ferns=[];
      for(let i=0;i<120;i++){
        const lx=(rng()-.5)*this.chunkSize,lz=(rng()-.5)*this.chunkSize;
        const h=this.terrain.getHeight(this.cx*this.chunkSize+lx,this.cz*this.chunkSize+lz);if(h<WATER_LEVEL)continue;
        _dummy.position.set(lx,h+.2,lz);_dummy.rotation.set(0,rng()*6.283,0);_dummy.scale.setScalar(.6+rng()*.8);_dummy.updateMatrix();ferns.push(_dummy.matrix.clone());
      }
      const fg=mat('ferngeo',()=>{const g2=new THREE.ConeGeometry(.5,.9,5);g2.translate(0,.45,0);g2.userData.shared=true;return g2;});
      this.addInstanced([{geometry:fg,material:M.fern(),matrix:new THREE.Matrix4()}],ferns,false);
    }
    if(w==='swamp'){
      const reeds=[];
      for(let i=0;i<220;i++){
        const lx=(rng()-.5)*this.chunkSize,lz=(rng()-.5)*this.chunkSize;
        const h=this.terrain.getHeight(this.cx*this.chunkSize+lx,this.cz*this.chunkSize+lz);if(h>WATER_LEVEL+1.2||h<WATER_LEVEL-1.5)continue;
        _dummy.position.set(lx,h-.1,lz);_dummy.rotation.set(0,rng()*6.283,0);_dummy.scale.setScalar(.8+rng());_dummy.updateMatrix();reeds.push(_dummy.matrix.clone());
      }
      const rg=mat('reedgeo',()=>{const g2=new THREE.ConeGeometry(.06,1.6,SEG(4));g2.translate(0,.8,0);g2.userData.shared=true;return g2;});
      this.addInstanced([{geometry:rg,material:M.reed(),matrix:new THREE.Matrix4()}],reeds,false);
      const lilies=[];
      for(let i=0;i<60;i++){
        const lx=(rng()-.5)*this.chunkSize,lz=(rng()-.5)*this.chunkSize;
        const h=this.terrain.getHeight(this.cx*this.chunkSize+lx,this.cz*this.chunkSize+lz);if(h>WATER_LEVEL+0.3||h<WATER_LEVEL-1.2)continue;
        _dummy.position.set(lx,WATER_LEVEL+0.05,lz);_dummy.rotation.set(0,rng()*6.283,0);_dummy.scale.setScalar(.5+rng()*.6);_dummy.updateMatrix();lilies.push(_dummy.matrix.clone());
      }
      const lg=mat('lilygeo',()=>{const g2=new THREE.CylinderGeometry(.4,.4,.04,SEG(8));g2.userData.shared=true;return g2;});
      this.addInstanced([{geometry:lg,material:M.lily(),matrix:new THREE.Matrix4()}],lilies,false);
    }
    const bushes=[];
    for(let i=0;i<(w==='jungle'?24:14);i++){
      const lx=(rng()-.5)*this.chunkSize,lz=(rng()-.5)*this.chunkSize;
      const h=this.terrain.getHeight(this.cx*this.chunkSize+lx,this.cz*this.chunkSize+lz);if(h<WATER_LEVEL)continue;
      _dummy.position.set(lx,h+.3,lz);_dummy.rotation.set(0,rng()*6.283,0);_dummy.scale.setScalar(.8+rng()*.5);_dummy.updateMatrix();bushes.push(_dummy.matrix.clone());
    }
    const bg2=mat('bushgeo',()=>{const g2=new THREE.SphereGeometry(.6,SEG(6),SEG(5));g2.scale(1,.7,1);g2.userData.shared=true;return g2;});
    this.addInstanced([{geometry:bg2,material:M.bush(),matrix:new THREE.Matrix4()}],bushes,false);
  }

  buildRocks(count){
    const rng=chunkRng(this.cx,this.cz,4);const matrices=[];
    for(let i=0;i<count;i++){
      const lx=(rng()-.5)*this.chunkSize,lz=(rng()-.5)*this.chunkSize;
      const wx=this.cx*this.chunkSize+lx,wz=this.cz*this.chunkSize+lz;
      const h=this.terrain.getHeight(wx,wz);if(h<WATER_LEVEL)continue;const sz=.3+rng()*(6/9);
      _dummy.position.set(lx,h+sz*.4,lz);_dummy.rotation.set(0,rng()*6.283,0);_dummy.scale.setScalar(sz);_dummy.updateMatrix();
      matrices.push(_dummy.matrix.clone());this.colliders.push({position:new THREE.Vector3(wx,h+1,wz),radius:sz+.5,type:'rock'});
    }
    if(!matrices.length)return;
    const rg=mat('rockgeo',()=>{const g2=new THREE.DodecahedronGeometry(1,0);g2.userData.shared=true;return g2;});
    const im=new THREE.InstancedMesh(rg,M.rock(),matrices.length);
    matrices.forEach((m,i)=>im.setMatrixAt(i,m));im.instanceMatrix.needsUpdate=true;im.computeBoundingSphere();im.receiveShadow=true;
    this.rockMesh=im;this.group.add(im);this.instanced.push(im);
  }

  rebuildRocks(c){
    if(this.rockMesh){this.group.remove(this.rockMesh);const i=this.instanced.indexOf(this.rockMesh);if(i>=0)this.instanced.splice(i,1);this.rockMesh.dispose();this.rockMesh=null;}
    this.colliders=this.colliders.filter(c2=>c2.type!=='rock');if(c>0)this.buildRocks(c);
  }

  buildGrassWith(count){
    const w=this.terrain.world.veg;if(w==='desert'||w==='volcano'||w==='dune')return;
    const rng=chunkRng(this.cx,this.cz,5);const matrices=[];
    for(let i=0;i<count;i++){
      const lx=(rng()-.5)*this.chunkSize,lz=(rng()-.5)*this.chunkSize;
      const h=this.terrain.getHeight(this.cx*this.chunkSize+lx,this.cz*this.chunkSize+lz);
      const b=this.terrain.getBiome(h,this.terrain.getMoisture(this.cx*this.chunkSize+lx,this.cz*this.chunkSize+lz));
      if(b==='water'||b==='swamp'||b==='mountain'||b==='volcano'||b==='snow'||h>60)continue;const hgt=.3+rng()*.5;
      _dummy.position.set(lx,h,lz);_dummy.rotation.set(0,rng()*6.283,0);_dummy.scale.set(.15+rng()*.2,hgt,1);_dummy.updateMatrix();matrices.push(_dummy.matrix.clone());
    }
    if(!matrices.length)return;
    const gg=mat('grassgeo',()=>{const g2=new THREE.PlaneGeometry(1,1);g2.translate(0,.5,0);g2.userData.shared=true;return g2;});
    const im=new THREE.InstancedMesh(gg,M.grass(),matrices.length);
    matrices.forEach((m,i)=>im.setMatrixAt(i,m));im.instanceMatrix.needsUpdate=true;im.computeBoundingSphere();im.visible=SETTINGS.grass;
    this.grassMesh=im;this.group.add(im);this.instanced.push(im);
  }

  rebuildGrass(c){
    if(this.grassMesh){this.group.remove(this.grassMesh);const i=this.instanced.indexOf(this.grassMesh);if(i>=0)this.instanced.splice(i,1);this.grassMesh.dispose();this.grassMesh=null;}
    if(c>0)this.buildGrassWith(c);
  }

  buildStructures(ws){
    const W=this.terrain.world;const w=W.veg;const wX=this.cx*this.chunkSize,wZ=this.cz*this.chunkSize;
    const rng=chunkRng(this.cx,this.cz,6);
    const glb=(w==='temperate'&&SETTINGS.useModels)?assets.getParts('url:'+ASSET_BASE+'house/HouseBeams12.glb',null):null;
    const n=rng()<.14?(2+Math.floor(rng()*3)):0;
    for(let i=0;i<n;i++){
      const lx=(rng()-.5)*this.chunkSize*.8,lz=(rng()-.5)*this.chunkSize*.8;
      const wx=wX+lx,wz=wZ+lz;
      if(Math.hypot(wx-this.terrain.volcanoCenter.x,wz-this.terrain.volcanoCenter.z)<VOLCANO_SAFE)continue;
      const h=this.terrain.getHeight(wx,wz);const stilt=(w==='swamp'||w==='jungle');
      if(h<WATER_LEVEL+(stilt?-0.5:2))continue;if(h>this.terrain.snowLine())continue;
      const rot=rng()*6.283;
      if(glb){
        const sc=1.5;
        for(const p of glb){
          const im=new THREE.InstancedMesh(p.geometry,p.material,1);
          _m4b.compose(new THREE.Vector3(lx,h,lz),new THREE.Quaternion().setFromEuler(new THREE.Euler(0,rot,0)),new THREE.Vector3(sc,sc,sc));
          if(p.matrix){_m4b.multiply(p.matrix);}
          im.setMatrixAt(0,_m4b);im.instanceMatrix.needsUpdate=true;this.group.add(im);this.instanced.push(im);
        }
        this.colliders.push({position:new THREE.Vector3(wx,h+2,wz),radius:5,type:'house'});
      } else {
        const hs=buildWorldHouse(w);hs.g.position.set(lx,h,lz);hs.g.rotation.y=rot;this.group.add(hs.g);
        this.colliders.push({position:new THREE.Vector3(wx,h+hs.hgt/2,wz),radius:hs.rad,type:'house'});
      }
      if(ws)this.group.add(this.createSmoke(wx,h+4,wz));
    }
  }

  createSmoke(x,y,z){
    const pool=makePoints(this.scene,20,1.5,false,.5,false);pool.points.material.color.set(0xbbbbbb);
    pool.update=(dt)=>{
      for(let i=0;i<pool.vel.length;i++){
        const ve=pool.vel[i];ve.life+=dt*.5;
        if(ve.life>1){ve.life=0;pool.pos[i*3]=x;pool.pos[i*3+1]=y;pool.pos[i*3+2]=z;ve.vy=.03+Math.random()*.03;}
        pool.pos[i*3+1]+=ve.vy;pool.pos[i*3]+=(Math.random()-.5)*.02;pool.pos[i*3+2]+=(Math.random()-.5)*.02;
      }
      pool.points.geometry.attributes.position.needsUpdate=true;
    };
    this.smokers=this.smokers||[];this.smokers.push(pool);return pool.points;
  }

  buildAnimals(){
    const W=this.terrain.world;const rng=chunkRng(this.cx,this.cz,7);
    const list=W.animals;const isSwamp=W.id==='swamp';const isJungle=W.id==='jungle';
    for(let i=0;i<((isSwamp||isJungle)?SETTINGS.animals*2:SETTINGS.animals);i++){
      const lx=(rng()-.5)*this.chunkSize,lz=(rng()-.5)*this.chunkSize;
      const wx=this.cx*this.chunkSize+lx,wz=this.cz*this.chunkSize+lz;
      if(Math.hypot(wx-this.terrain.volcanoCenter.x,wz-this.terrain.volcanoCenter.z)<VOLCANO_SAFE)continue;
      const h=this.terrain.getHeight(wx,wz);const b=this.terrain.getBiome(h,this.terrain.getMoisture(wx,wz));
      const type=list[Math.floor(rng()*list.length)];
      if(type==='worm')continue; // Червь не спавнится как обычное животное
      const isSwimmer=SWIMMERS.has(type);const minH=isSwimmer?WATER_LEVEL-1.0:WATER_LEVEL+ANIMAL_SPAWN_MARGIN;
      if(h<minH||b==='mountain'||b==='volcano'||b==='snow'||this.terrain.getAnimalDensity(wx,wz)<.2)continue;
      if(b==='forest'&&!isSwamp&&!isJungle&&rng()<.5)continue;
      const ai=new AnimalAI2(ANIMAL_BUILDERS[type](),wx,wz,this.terrain,rng());
      this.animals.push(ai);this.scene.add(ai.grp);
    }
  }

  update(dt,t){
    for(const a of this.animals)a.update(dt,t);
    if(this.smokers)for(const s of this.smokers)s.update(dt);
  }

  dispose(){
    this.scene.remove(this.group);
    for(const a of this.animals)this.scene.remove(a.grp);
    for(const im of this.instanced)im.dispose();
    this.group.traverse(o=>{
      if(o.isInstancedMesh)return;
      if(o.geometry&&!o.geometry.userData.shared)o.geometry.dispose();
      if(o.material){const mats=Array.isArray(o.material)?o.material:[o.material];for(const m of mats){if(m&&m.userData&&!m.userData.shared)m.dispose();}}
    });
  }
}

class AnimalAI2{
  constructor(built,x,z,terr,seed){
    this.grp=built.group;this.legs=built.legs;this.head=built.head;this.tail=built.tail;this.ears=built.ears;this.cfg=built.cfg;
    this.fly=!!built.fly;this.swim=!!built.swim;this.wingL=built.wingL;this.wingR=built.wingR;this.snakeSegs=built.snakeSegs;this.terrain=terr;this.worm=!!built.worm;
    this.home=new THREE.Vector3(x,0,z);this.dir=seed*6.28;this.state=this.cfg.states[0];this.timer=1+seed*3;this.phase=seed*20;this.seed=seed;
    this.grp.scale.setScalar(.9+seed*.5);this.grp.rotation.y=-this.dir;
    this.grp.position.set(x,terr.getHeight(x,z),z);
  }

  update(dt,t){
    this.timer-=dt;
    if(this.timer<=0){
      const st=this.cfg.states;this.state=st[Math.floor(Math.abs(Math.sin(this.seed*91+t*.37))*st.length)%st.length];
      this.timer=this.state==='idle'||this.state==='look'?2+Math.abs(Math.sin(this.seed*13))*3:3+Math.abs(Math.sin(this.seed*7))*5;
      if(this.state==='walk'||this.state==='run'||this.state==='hop'||this.state==='fly')this.dir+=(Math.abs(Math.sin(this.seed*31+t))-.5)*2.5;
    }
    const st=this.state;const moving=st==='walk'||st==='run'||st==='hop'||st==='graze'||st==='fly';let bob=0;
    if(moving){
      const dx=this.home.x-this.grp.position.x,dz=this.home.z-this.grp.position.z;
      if(Math.hypot(dx,dz)>(this.fly?80:22))this.dir=Math.atan2(dz,dx);
      const mult=st==='run'?2.4:st==='graze'?.25:st==='hop'?1.6:st==='fly'?2:1;const sp=this.cfg.speed*mult;this.phase+=dt*sp*4;
      const dX=Math.cos(this.dir),dZ=Math.sin(this.dir);const step=sp*dt;const nx=this.grp.position.x+dX*step,nz=this.grp.position.z+dZ*step;
      const hN=this.terrain.getHeight(nx,nz);
      if(!this.fly&&!this.swim&&hN<WATER_LEVEL+ANIMAL_WATER_MARGIN){this.dir+=Math.PI*.7;this.timer=Math.max(this.timer,.6);}
      else{this.grp.position.x=nx;this.grp.position.z=nz;}
      const amp=st==='run'?.8:st==='graze'?.2:.5;
      for(let i=0;i<this.legs.length;i++)this.legs[i].rotation.x=Math.sin(this.phase+(i%2)*Math.PI+(i>1?Math.PI:0))*amp;
      if(this.fly&&this.wingL){const f=Math.sin(this.phase*2);this.wingL.rotation.x=f*.7;this.wingR.rotation.x=-f*.7;}
      if(this.snakeSegs)for(let i=0;i<this.snakeSegs.length;i++)this.snakeSegs[i].position.z=Math.sin(this.phase+i*.6)*.15;
      if(st==='run')bob=Math.abs(Math.sin(this.phase))*.12;else if(st==='walk')bob=Math.sin(this.phase*2)*.04;else if(st==='hop')bob=Math.abs(Math.sin(this.phase*.6))*.35;
      if(this.tail&&!this.fly)this.tail.rotation.y=Math.sin(this.phase*1.7)*.5;
    }
    else{for(const l of this.legs)l.rotation.x*=.9;if(this.tail&&!this.fly)this.tail.rotation.y*=.9;if(this.fly&&this.wingL){this.wingL.rotation.x*=.9;this.wingR.rotation.x*=.9;}}
    if(this.head){
      if(st==='look'){this.head.rotation.y+=(Math.sin(t*2.2+this.seed*3)*.9-this.head.rotation.y)*Math.min(1,dt*5);this.head.rotation.x*=.9;}
      else if(st==='graze'){this.head.rotation.x+=(.75-this.head.rotation.x)*Math.min(1,dt*3);this.head.rotation.y*=.9;}
      else{this.head.rotation.x*=.9;this.head.rotation.y=Math.sin(t*.6+this.seed*10)*.3;}
    }
    const gh=this.terrain.getHeight(this.grp.position.x,this.grp.position.z);let gy;
    if(this.fly)gy=gh+22+Math.sin(t*.5+this.seed)*6;
    else if(this.swim&&gh<WATER_LEVEL)gy=WATER_LEVEL-0.15;
    else gy=gh+bob;
    this.grp.position.y=gy;
    const target=-this.dir;let d=target-this.grp.rotation.y;while(d>Math.PI)d-=6.283;while(d<-Math.PI)d+=6.283;this.grp.rotation.y+=d*Math.min(1,dt*3);
  }
}

class ChunkManager{
  constructor(sc,terr){this.scene=sc;this.terrain=terr;this.chunks=new Map();this.queue=[];this.chunkSize=SETTINGS.chunkSize;}
  key(cx,cz){return cx+','+cz;}
  lodFor(d){return d<=SETTINGS.detailDistance?2:d<=SETTINGS.treeDistance?1:0;}

  update(px,pz){
    const VD=SETTINGS.viewDistance;const pcx=Math.floor(px/this.chunkSize),pcz=Math.floor(pz/this.chunkSize);const need=new Set();this.queue.length=0;
    for(let dx=-VD;dx<=VD;dx++)for(let dz=-VD;dz<=VD;dz++){
      const cx=pcx+dx,cz=pcz+dz,k=this.key(cx,cz);need.add(k);
      const dist=Math.max(Math.abs(dx),Math.abs(dz));const wl=this.lodFor(dist);const ex=this.chunks.get(k);
      if(ex){if(ex.lod<wl){ex.dispose();this.chunks.delete(k);this.queue.push({cx,cz,dist,lod:wl});}}else this.queue.push({cx,cz,dist,lod:wl});
    }
    for(const[k,c]of this.chunks.entries())if(!need.has(k)){c.dispose();this.chunks.delete(k);}
    this.queue.sort((a,b)=>a.dist-b.dist);
  }

  processQueue(l=CHUNKS_PER_FRAME){
    let n=0;while(this.queue.length&&n<l){const q=this.queue.shift();const k=this.key(q.cx,q.cz);if(this.chunks.has(k))continue;this.chunks.set(k,new Chunk(q.cx,q.cz,this.scene,this.terrain,q.lod,this.chunkSize,SETTINGS.chunkRes));n++;}
  }

  rebuildAround(x,z,radius){
    const pcx=Math.floor(x/this.chunkSize);
    const pcz=Math.floor(z/this.chunkSize);
    const r=Math.ceil(radius/this.chunkSize)+1;
    for(let dx=-r;dx<=r;dx++)for(let dz=-r;dz<=r;dz++){
      const c=this.chunks.get(this.key(pcx+dx,pcz+dz));
      if(c&&c.lod===2){c.rebuild();}
    }
  }

  getColliders(p,r=100){
    const out=[];
    for(const c of this.chunks.values()){
      for(const c2 of c.colliders)if(c2.position.distanceTo(p)<r)out.push(c2);
      for(const a of c.animals){const ap=a.grp.position;if(ap.distanceTo(p)<r)out.push({position:ap,radius:Math.max(0.6,a.grp.scale.x*1.2),type:'animal'});}
    }
    return out;
  }

  getHeightAt(x,z){return this.terrain.getHeight(x,z);}
  getBiomeAt(x,z){return this.terrain.getBiome(this.terrain.getHeight(x,z),this.terrain.getMoisture(x,z));}

  updateChunks(dt,t,mist,pcx,pcz){
    for(const c of this.chunks.values()){
      if(c.lod===2)c.update(dt,t);
      if(c.mist){const d=Math.max(Math.abs(c.cx-pcx),Math.abs(c.cz-pcz));c.mist.visible=d<=MIST_RADIUS&&mist>.004;if(c.mist.visible)c.mist.children.forEach(p=>p.material.opacity=mist*p.userData.fade);}
    }
  }
}

class DebrisSystem{
  constructor(sc){this.scene=sc;this.pieces=[];}
  spawn(pos,vel,orientation){
    const colors=[COL.turquoise,COL.coral,COL.white,COL.dark,0x999999];
    for(let i=0;i<40;i++){
      const size=.3+Math.random()*.9;const g=new THREE.Group();
      const mat=new THREE.MeshStandardMaterial({color:colors[Math.floor(Math.random()*colors.length)],roughness:.7,metalness:.3});
      const mesh=new THREE.Mesh(new THREE.BoxGeometry(size,size*.3,size*.6),mat);g.add(mesh);
      g.position.copy(pos).add(new THREE.Vector3((Math.random()-.5)*4,(Math.random()-.5)*2,(Math.random()-.5)*4));
      g.quaternion.copy(orientation);this.scene.add(g);
      this.pieces.push({g,vx:(Math.random()-.5)*30+vel.x*.3,vy:Math.random()*20+Math.abs(vel.y)*.5+5,vz:(Math.random()-.5)*30+vel.z*.3,
      rx:(Math.random()-.5)*8,ry:(Math.random()-.5)*8,rz:(Math.random()-.5)*8,life:3+Math.random()*1.5,age:0});
    }
  }
  update(dt){
    for(let i=this.pieces.length-1;i>=0;i--){
      const p=this.pieces[i];p.age+=dt;p.vy-=25*dt;
      p.g.position.x+=p.vx*dt;p.g.position.y+=p.vy*dt;p.g.position.z+=p.vz*dt;
      p.g.rotation.x+=p.rx*dt;p.g.rotation.y+=p.ry*dt;p.g.rotation.z+=p.rz*dt;
      const h=terrain?terrain.getHeight(p.g.position.x,p.g.position.z):0;
      if(p.g.position.y<h){p.g.position.y=h;p.vy*=-.25;p.vx*=.6;p.vz*=.6;}
      if(p.age>p.life){this.scene.remove(p.g);this.pieces.splice(i,1);}
    }
  }
}

let debris=null,dust=null,explosionSys=null;

class Aircraft{
  constructor(sc,cfg){
    this.scene=sc;
    this.config=cfg;
    this.group=new THREE.Group();
    sc.add(this.group);

    this.position=new THREE.Vector3(0,80,0);
    this.prevPosition=new THREE.Vector3(0,80,0);
    this.velocity=new THREE.Vector3(30,0,0);

    this.orientation=new THREE.Quaternion();
    this.pitch=0;
    this.roll=0;
    this.yaw=0;
    this._yawAngle=0;

    this.throttle=.5;
    this.speed=30;
    this.crashed=false;
    this.health=100;

    this.onGround=false;
    this.bank=0;
    this._trackTimer=0;
    this.spawnGrace=0;

    this._pRate=0;
    this._rRate=0;
    this._yRate=0;
    this._swayPhase=Math.random()*10;

    this.gearDeployed=true;
    this.gearAnimation=1;
    this.flapDeployed=false;
    this.flapAnimation=0;

    this.autopilot=false;
    this.autoAlt=0;

    this.input={pitch:0,roll:0,yaw:0};

    this.built=BUILDERS[cfg.builder]();
    this.model=this.built.group;
    this.model.scale.setScalar(cfg.scale);

    this.model.traverse(c=>{
      if(c.isMesh&&c.material){
        (Array.isArray(c.material)?c.material:[c.material]).forEach(m=>{
          if(m.envMap!==undefined)m.envMap=envMap;
        });
      }
    });

    this.model.updateMatrixWorld(true);

    const box=new THREE.Box3().setFromObject(this.model);

    this.modelSize=box.getSize(new THREE.Vector3());
    this.collRadius=clamp(Math.max(this.modelSize.x,this.modelSize.z)*.35,1.2,8);
    this.crashAlt=cfg.waterOnly||cfg.ground?0:Math.max(.6,-box.min.y);

    this.group.add(this.model);
    this.group.visible=true;

    this.deck=this.built.deck||null;
    this.propeller=this.built.propeller;
    this.propellerR=this.built.propellerR||null;

    this.ailerons=this.built.ailerons;
    this.flaps=this.built.flaps;
    this.elevator=this.built.elevator;
    this.rudder=this.built.rudder;
    this.gear=this.built.gear;

    this.wheels=this.built.wheels||null;
    this.wingPivots=this.built.wingPivots||null;
    this.ornithopter=!!cfg.ornithopter;
  }

  applyStartPos(){
    this.spawnGrace=2.5;

    if(this.config.waterOnly){
      this.position.copy(findWaterSpawn());
    } else if(this.config.ground){
      let gx=SETTINGS.startX,gz=SETTINGS.startZ;
      let found=false;

      if(chunkManager){
        for(let r=0;r<=120&&!found;r+=6){
          for(let a=0;a<12;a++){
            const an=a/12*Math.PI*2+(r?0.3:0);

            const x=SETTINGS.startX+Math.cos(an)*r;
            const z=SETTINGS.startZ+Math.sin(an)*r;

            const hgt=terrain.getHeight(x,z);

            if(hgt<WATER_LEVEL+0.5)continue;

            if(Math.abs(terrain.getHeight(x+3,z)-hgt)>2 || Math.abs(terrain.getHeight(x,z+3)-hgt)>2)continue;

            const p=new THREE.Vector3(x,hgt,z);

            if(chunkManager.getColliders(p,12).length===0){
              gx=x;
              gz=z;
              found=true;
              break;
            }
          }
        }
      }

      const gy=terrain.getHeight(gx,gz);
      this.position.set(gx,gy,gz);
    } else {
      const gx=SETTINGS.startX;
      const gz=SETTINGS.startZ;
      const gy=terrain.getHeight(gx,gz);

      this.position.set(
        gx,
        Math.max(gy+Math.max(20,SETTINGS.startAlt),WATER_LEVEL+20),
        gz
      );
    }

    this.prevPosition.copy(this.position);
    this.velocity.set(this.config.ground?0:30,0,0);
    this.orientation.set(0,0,0,1);
    this._yawAngle=0;

    this.speed=this.config.ground?0:(this.config.waterOnly?0:30);
    this.pitch=0;
    this.roll=0;
  }

  toggleGear(){
    if(this.config.noGear){
      setText(
        'gear',
        this.config.waterOnly
          ? 'НЕТ(КАТЕР)'
          : this.config.ground
            ? 'НЕТ(ДЖИП)'
            : 'НЕТ(ДИРИЖ/ОРНИ)'
      );
      return;
    }

    this.gearDeployed=!this.gearDeployed;

    setText('gear',this.gearDeployed?'▼':'▲');
    setColor('gear',this.gearDeployed?'#8c8':'#f88');
  }

  toggleFlaps(){
    if(!this.flaps||!this.flaps.left){
      setText('flaps','НЕТ');
      return;
    }

    this.flapDeployed=!this.flapDeployed;

    setText('flaps',this.flapDeployed?'100%':'0%');
    setColor('flaps',this.flapDeployed?'#ff8':'#8c8');
  }

  getForward(){
    return _v6.set(1,0,0).applyQuaternion(this.orientation);
  }

  updateOrnithopter(dt,cm,tG,wind){
    const cfg=this.config;
    const h=cfg.handling*SETTINGS.handling;

    if(this.autopilot){
      const er=this.autoAlt-this.position.y;

      this.input.pitch=clamp(er*.05,-.5,.5);
      this.input.roll*=.9;
      this.input.yaw=Math.sin(tG*.06)*.2;
      this.throttle=.5;
    }

    const sm=4.0;

    this._pRate+=(this.input.pitch-this._pRate)*Math.min(1,dt*sm);
    this._rRate+=(this.input.roll-this._rRate)*Math.min(1,dt*sm);
    this._yRate+=(this.input.yaw-this._yRate)*Math.min(1,dt*sm);

    this.pitch=clamp(this.pitch+this._pRate*1.1*h*dt,-1.1,1.1);
    this.roll=clamp(this.roll+this._rRate*1.8*h*dt,-1.4,1.4);

    if(Math.abs(this._rRate)<0.05)this.roll*=(1-Math.min(1,dt*2));

    this._yawAngle+=this._yRate*0.9*h*dt;
    this._yawAngle-=this.roll*0.9*dt;

    if(wind&&wind.lengthSq()>0.1){
      const wa=Math.atan2(-wind.z,wind.x);

      let d=wa-this._yawAngle;

      while(d>Math.PI)d-=6.283;
      while(d<-Math.PI)d+=6.283;

      this._yawAngle+=d*dt*0.25*(wind.length()/20);
    }

    _q1.setFromAxisAngle(AX_Y,this._yawAngle);
    _q2.setFromAxisAngle(AX_Z,this.pitch);
    _q3.setFromAxisAngle(AX_X,this.roll);

    this.orientation.copy(_q1).multiply(_q2).multiply(_q3);

    const fwd=this.getForward();

    let target=this.throttle*cfg.maxSpeed;

    target+=clamp(-fwd.y,0,1)*cfg.maxSpeed*0.5;
    target-=clamp(fwd.y,0,1)*cfg.maxSpeed*0.35;
    target=Math.max(0,target);

    this.speed+=(target-this.speed)*Math.min(1,dt*1.2);

    this.velocity.copy(fwd).multiplyScalar(this.speed);

    if(wind)this.velocity.add(wind);

    this.position.addScaledVector(this.velocity,dt);

    if(this.throttle<0.3){
      this.position.y-=dt*8*(0.3-this.throttle)/0.3;
    }

    const windMag=wind?wind.length():0;

    this._swayPhase+=dt*3.5;

    const swayP=Math.sin(this._swayPhase*1.7)*0.10*(windMag/10);
    const swayR=Math.sin(this._swayPhase*2.3)*0.09*(windMag/10);

    _q2.setFromEuler(_euler.set(swayR,0,swayP));
    this.orientation.multiply(_q2);

    this.bank=this.roll;

    // ИСПРАВЛЕННЫЕ КРЫЛЬЯ ОРНИТОПТЕРА: быстрее и с фазовым сдвигом как у стрекозы
    if(this.wingPivots){
      const flapSpeed=15+this.throttle*20;

      const frontAngle=Math.sin(tG*flapSpeed)*0.9;
      const rearAngle=Math.sin(tG*flapSpeed+Math.PI*0.3)*0.75;

      this.wingPivots.fl.rotation.x=frontAngle;
      this.wingPivots.fr.rotation.x=-frontAngle;
      this.wingPivots.rl.rotation.x=rearAngle;
      this.wingPivots.rr.rotation.x=-rearAngle;
    }

    const gH=cm.getHeightAt(this.position.x,this.position.z);
    const alt=this.position.y-gH;
    const wheelH=this.crashAlt;

    if(alt<=wheelH){
      this.position.y=gH+wheelH;
      this.onGround=true;
    } else {
      this.onGround=false;
    }

    this.group.position.copy(this.position);
    this.group.quaternion.copy(this.orientation);

    this.checkCollisions(cm,gH,alt,this.crashAlt);
  }

  updateJeep(dt,cm){
    const cfg=this.config;
    const h=cfg.handling*SETTINGS.handling;

    const steer=clamp(this.input.roll+this.input.yaw,-1,1);

    this.throttle=clamp(
      this.throttle+(this.input.pitch>0?0.6:this.input.pitch<0?-0.6:0)*dt,
      -0.5,
      1
    );

    const gas=this.throttle;

    const fx=Math.cos(this._yawAngle);
    const fz=-Math.sin(this._yawAngle);

    const rx=-fz;
    const rz=fx;

    const e=1.5;
    const x=this.position.x;
    const z=this.position.z;

    const gh=cm.getHeightAt(x,z);

    const gx=(cm.getHeightAt(x+e,z)-cm.getHeightAt(x-e,z))/(2*e);
    const gz=(cm.getHeightAt(x,z+e)-cm.getHeightAt(x,z-e))/(2*e);

    const slopeHead=gx*fx+gz*fz;

    const nrm=new THREE.Vector3(-gx,1,-gz).normalize();

    // ИСПРАВЛЕНО: убран несуществующий cfg.thrust
    const engineA=gas*(cfg.maxSpeed*0.55)*SETTINGS.thrust;

    const resist=0.7*Math.sign(this.speed)+0.012*this.speed*Math.abs(this.speed);

    const aLong=engineA-slopeHead*9.8-resist;

    this.speed+=aLong*dt;
    this.speed=clamp(this.speed,-cfg.maxSpeed*0.4,cfg.maxSpeed);

    const wb=3.0;
    const steerAng=steer*0.55;

    const yawRate=(this.speed/wb)*Math.tan(steerAng);

    this._yawAngle-=yawRate*dt;

    const px=x+fx*1.6;
    const pz=z+fz*1.6;

    if(cm.getHeightAt(px,pz)<WATER_LEVEL-0.5){
      this.speed=Math.max(0,this.speed-30*dt);
    } else {
      this.position.x+=fx*this.speed*dt;
      this.position.z+=fz*this.speed*dt;
    }

    const gh2=cm.getHeightAt(this.position.x,this.position.z);

    this.position.y+=((gh2-this.position.y))*Math.min(1,dt*12);

    const fwd=new THREE.Vector3(fx,0,fz);
    fwd.addScaledVector(nrm,-fwd.dot(nrm)).normalize();

    const Zv=new THREE.Vector3().crossVectors(fwd,nrm).normalize();

    _mat4.makeBasis(fwd,nrm,Zv);

    this.orientation.setFromRotationMatrix(_mat4);

    this.velocity.set(fx*this.speed,0,fz*this.speed);

    this.bank=Math.atan2(gx*rx+gz*rz,1);

    const wr=0.45;

    if(this.wheels){
      for(let i=0;i<this.wheels.length;i++){
        const wg=this.wheels[i];

        if(wg.userData.spin){
          wg.userData.spin.rotation.z+=(this.speed/wr)*dt;
        }

        wg.rotation.y=wg.userData.front?(-steer*0.5):0;

        const lx=wg.position.x;
        const lz=wg.position.z;

        const wx=this.position.x+lx*fx+lz*rx;
        const wz=this.position.z+lx*fz+lz*rz;

        const wGround=cm.getHeightAt(wx,wz);

        wg.position.y=wg.userData.baseY+clamp(wGround-gh2,-0.25,0.25);
      }
    }

    if(tracks&&Math.abs(this.speed)>2){
      this._trackTimer+=dt;

      if(this._trackTimer>0.08){
        this._trackTimer=0;

        for(const s of[0.9,-0.9]){
          const wx=this.position.x-fx*1.5+rx*s;
          const wz=this.position.z-fz*1.5+rz*s;

          const wt=cm.getHeightAt(wx,wz);

          if(wt>WATER_LEVEL-0.2){
            tracks.emit(wx,wt+0.02,wz,this._yawAngle);
          }
        }
      }
    }

    this.group.position.copy(this.position);
    this.group.quaternion.copy(this.orientation);

    this.checkCollisions(cm,gh2,999,this.crashAlt);
  }

  updateBoat(dt,cm,tG){
    const cfg=this.config;
    const h=cfg.handling*SETTINGS.handling;

    const steer=clamp(this.input.roll+this.input.yaw,-1,1);

    this.throttle=clamp(this.throttle+this.input.pitch*0.6*dt,-0.35,1);

    const wave=(x,z)=>Math.sin(tG*1.7+x*0.05)*0.06+Math.sin(tG*2.3+z*0.07)*0.05;

    const x=this.position.x;
    const z=this.position.z;

    const surface=WATER_LEVEL+wave(x,z);

    const hullBottom=this.position.y-0.3;

    this.position.y+=(surface-hullBottom-0.15)*Math.min(1,dt*10);

    const thr=this.throttle*8;

    this.speed+=(thr-0.05*this.speed*Math.abs(this.speed)-0.3*Math.sign(this.speed))*dt;

    this.speed=clamp(this.speed,-cfg.maxSpeed*0.4,cfg.maxSpeed);

    this.yaw+=(steer*1.6*h-this.yaw)*Math.min(1,dt*4);

    this._yawAngle-=this.yaw*clamp(this.speed/6,-1,1)*dt;

    const fx=Math.cos(this._yawAngle);
    const fz=-Math.sin(this._yawAngle);

    const rx=-fz;
    const rz=fx;

    const px=x+fx*2.0;
    const pz=z+fz*2.0;

    if(cm.getHeightAt(px,pz)>surface-0.15){
      this.speed=Math.max(0,this.speed-40*dt);
    } else {
      this.position.x+=fx*this.speed*dt;
      this.position.z+=fz*this.speed*dt;
    }

    const wF=wave(x+fx*2,z+fz*2);
    const wB=wave(x-fx*2,z-fz*2);
    const wR=wave(x+rx*1.2,z+rz*1.2);
    const wL=wave(x-rx*1.2,z-rz*1.2);

    const pitch=Math.atan2(wF-wB,4)-clamp(this.speed*0.01,-0.1,0.1);
    const roll=Math.atan2(wR-wL,2.4);

    const nrm=new THREE.Vector3(-((wF-wB)/4)*0.5,1,-((wR-wL)/2.4)*0.5).normalize();

    const fwd=new THREE.Vector3(fx,0,fz);
    fwd.addScaledVector(nrm,-fwd.dot(nrm)).normalize();

    const Zv=new THREE.Vector3().crossVectors(fwd,nrm).normalize();

    _mat4.makeBasis(fwd,nrm,Zv);

    this.orientation.setFromRotationMatrix(_mat4);

    this.velocity.set(fx*this.speed,0,fz*this.speed);

    this.bank=roll;

    this.group.position.copy(this.position);
    this.group.quaternion.copy(this.orientation);

    if(this.propeller){
      this.propeller.rotation.x+=(5+Math.abs(this.throttle)*60)*dt*(this.throttle<0?-1:1);
    }

    if(this.rudder){
      this.rudder.rotation.y=-this.yaw*0.5;
    }
  }

  updateArcade(dt,cm,tG,wind){
    const cfg=this.config;
    const h=cfg.handling*SETTINGS.handling;

    if(this.autopilot){
      const er=this.autoAlt-this.position.y;

      this.input.pitch=clamp(er*.05,-.5,.5);
      this.input.roll*=.9;
      this.input.yaw=Math.sin(tG*.06)*.2;
      this.throttle=.5;
    }

    const sm=4.0;

    this._pRate+=(this.input.pitch-this._pRate)*Math.min(1,dt*sm);
    this._rRate+=(this.input.roll-this._rRate)*Math.min(1,dt*sm);
    this._yRate+=(this.input.yaw-this._yRate)*Math.min(1,dt*sm);

    this.pitch=clamp(this.pitch+this._pRate*1.1*h*dt,-1.1,1.1);
    this.roll=clamp(this.roll+this._rRate*1.8*h*dt,-1.4,1.4);

    if(Math.abs(this._rRate)<0.05)this.roll*=(1-Math.min(1,dt*2));

    this._yawAngle+=this._yRate*0.9*h*dt;
    this._yawAngle-=this.roll*0.9*dt;

    if(wind&&wind.lengthSq()>0.1){
      const wa=Math.atan2(-wind.z,wind.x);

      let d=wa-this._yawAngle;

      while(d>Math.PI)d-=6.283;
      while(d<-Math.PI)d+=6.283;

      this._yawAngle+=d*dt*0.25*(wind.length()/20);
    }

    _q1.setFromAxisAngle(AX_Y,this._yawAngle);
    _q2.setFromAxisAngle(AX_Z,this.pitch);
    _q3.setFromAxisAngle(AX_X,this.roll);

    this.orientation.copy(_q1).multiply(_q2).multiply(_q3);

    const fwd=this.getForward();

    let target=this.throttle*cfg.maxSpeed;

    target+=clamp(-fwd.y,0,1)*cfg.maxSpeed*0.5;
    target-=clamp(fwd.y,0,1)*cfg.maxSpeed*0.35;
    target=Math.max(0,target);

    this.speed+=(target-this.speed)*Math.min(1,dt*1.2);

    this.velocity.copy(fwd).multiplyScalar(this.speed);

    if(wind)this.velocity.add(wind);

    this.position.addScaledVector(this.velocity,dt);

    if(this.throttle<0.3){
      this.position.y-=dt*8*(0.3-this.throttle)/0.3;
    }

    const windMag=wind?wind.length():0;

    this._swayPhase+=dt*3.5;

    const swayP=Math.sin(this._swayPhase*1.7)*0.10*(windMag/10);
    const swayR=Math.sin(this._swayPhase*2.3)*0.09*(windMag/10);

    _q2.setFromEuler(_euler.set(swayR,0,swayP));
    this.orientation.multiply(_q2);

    this.bank=this.roll;

    const gH=cm.getHeightAt(this.position.x,this.position.z);
    const alt=this.position.y-gH;
    const wheelH=this.crashAlt;

    if(alt<=wheelH){
      this.position.y=gH+wheelH;
      this.onGround=true;
    } else {
      this.onGround=false;
    }

    this.group.position.copy(this.position);
    this.group.quaternion.copy(this.orientation);

    if(this.propeller)this.propeller.rotation.x+=(20+this.throttle*90)*dt;
    if(this.propellerR)this.propellerR.rotation.x+=(20+this.throttle*90)*dt;

    if(this.ailerons.left)this.ailerons.left.rotation.z=this._rRate*.6;
    if(this.ailerons.right)this.ailerons.right.rotation.z=-this._rRate*.6;

    if(this.flaps&&this.flaps.left){
      const ft=this.flapDeployed?1:0;

      this.flapAnimation+=(ft-this.flapAnimation)*Math.min(1,dt*2.5);

      this.flaps.left.rotation.z=this.flapAnimation*.6;
      this.flaps.right.rotation.z=this.flapAnimation*.6;
    }

    if(this.elevator)this.elevator.rotation.z=-this._pRate*.6;
    if(this.rudder)this.rudder.rotation.y=this._yRate*.6;

    if(this.gear){
      const gt=this.gearDeployed?1:0;

      this.gearAnimation+=(gt-this.gearAnimation)*Math.min(1,dt*3);

      this.gear.position.y=(1-this.gearAnimation)*.9;
      this.gear.scale.setScalar(.4+this.gearAnimation*.6);
    }

    this.checkCollisions(cm,gH,alt,this.crashAlt);
  }

  update(dt,cm,tG=0,wind=null){
    if(this.crashed)return;

    if(this.spawnGrace>0)this.spawnGrace-=dt;

    this.prevPosition.copy(this.position);

    if(this.config.ground){
      this.updateJeep(dt,cm);
      return;
    }

    if(this.config.waterOnly){
      this.updateBoat(dt,cm,tG);
      return;
    }

    if(this.ornithopter){
      this.updateOrnithopter(dt,cm,tG,wind);
      return;
    }

    this.updateArcade(dt,cm,tG,wind);
  }

  checkCollisions(cm,gH,alt,cA){
    if(this.spawnGrace>0)return;

    const pG=cm.getHeightAt(this.prevPosition.x,this.prevPosition.z);
    const pA=this.prevPosition.y-pG;

    if(!this.config.ground&&!this.config.waterOnly&&alt<cA){
      if(!this.gearDeployed&&!this.config.noGear&&this.speed>20){
        this.crash('Посадка с убранным шасси');
        return;
      }

      const hard=this.velocity.y<-12 || Math.abs(this.bank)>.6 || this.speed>45 || (pA>cA+1.5&&alt<cA&&!this.onGround);

      if(hard){
        this.crash('Столкновение с землёй');
        return;
      }

      this.position.y=gH+cA;

      if(this.velocity.y<0)this.velocity.y=0;
    }

    const r=this.collRadius;

    for(const c of cm.getColliders(this.position,60+r)){
      const nm=c.type==='tree'?'деревом':c.type==='house'?'зданием':c.type==='animal'?'животным':'камнем';

      if(this.position.distanceTo(c.position)<c.radius+r){
        this.crash('Столкновение с '+nm);
        return;
      }

      const ray=new THREE.Ray(
        this.prevPosition.clone(),
        _v1.copy(this.position).sub(this.prevPosition).normalize()
      );

      const hit=new THREE.Vector3();

      if(ray.intersectSphere(new THREE.Sphere(c.position,c.radius+r),hit)&&hit.distanceTo(this.prevPosition)<this.position.distanceTo(this.prevPosition)){
        this.crash('Столкновение с '+nm);
        return;
      }
    }
  }

  crash(r){
    if(this.crashed||this.spawnGrace>0)return;

    this.crashed=true;

    const isActive=(typeof aircraft!=='undefined'&&aircraft===this);

    if(isActive){
      if(debris)debris.spawn(this.position.clone(),this.velocity.clone(),this.orientation.clone());

      this.model.visible=false;

      setText('crash-reason',r);
      showEl('crash-screen','flex');
    }
  }

  resetPosition(){
    this.applyStartPos();

    this.pitch=this.roll=this.yaw=0;
    this.crashed=false;
    this.onGround=false;
    this.bank=0;
    this.spawnGrace=2.5;
    this.health=100;

    this._pRate=0;
    this._rRate=0;
    this._yRate=0;

    this.gearDeployed=true;
    this.gearAnimation=1;
    this.flapDeployed=false;
    this.flapAnimation=0;
    this.throttle=.5;

    this.model.visible=true;

    showEl('crash-screen','none');

    setText(
      'gear',
      this.config.noGear
        ? (
            this.config.waterOnly
              ? 'НЕТ(КАТЕР)'
              : this.config.ground
                ? 'НЕТ(ДЖИП)'
                : 'НЕТ(ДИРИЖ/ОРНИ)'
          )
        : '▼'
    );

    setColor('gear','#8c8');

    setText('flaps','0%');
    setColor('flaps','#8c8');
  }

  getSpeed(){
    return this.speed*3.6;
  }
}

function findWaterSpawn(){
  for(let r=0;r<=3000;r+=40){
    for(let a=0;a<12;a++){
      const an=a/12*Math.PI*2+r*.01;

      const x=Math.cos(an)*r;
      const z=Math.sin(an)*r;

      if(terrain.getHeight(x,z)<WATER_LEVEL-0.5){
        return new THREE.Vector3(x,WATER_LEVEL-BOAT_DRAFT,z);
      }
    }
  }

  return new THREE.Vector3(0,WATER_LEVEL-BOAT_DRAFT,0);
}

class WeatherSystem{
  constructor(sc,cam,sky,sc2){
    this.scene=sc;
    this.camera=cam;
    this.sky=sky;
    this.stormClouds=sc2;

    this.currentWeather='clear';
    this.timeOfDay=.5;
    this.dayDuration=SETTINGS.dayLength*60;
    this.lightning={timer:0};

    this.sun=new THREE.DirectionalLight(0xfff4e0,1.2);
    this.sun.castShadow=SETTINGS.shadows;
    this.sun.shadow.mapSize.set(1024,1024);

    Object.assign(this.sun.shadow.camera,{
      left:-150,
      right:150,
      top:150,
      bottom:-150,
      far:1200
    });

    sc.add(this.sun);

    this.sunTarget=new THREE.Object3D();
    sc.add(this.sunTarget);
    this.sun.target=this.sunTarget;

    this.hemi=new THREE.HemisphereLight(0xa8c4dc,0x5a4a3a,0.6);
    sc.add(this.hemi);

    sc.fog=new THREE.Fog(0xa8c4d8,350,2600);

    this.sunDisc=new THREE.Mesh(
      new THREE.SphereGeometry(15,12,10),
      new THREE.MeshBasicMaterial({
        color:0xfff4d0,
        fog:false
      })
    );

    sc.add(this.sunDisc);

    const fc=document.createElement('canvas');
    fc.width=fc.height=128;

    const cx=fc.getContext('2d');
    const gr=cx.createRadialGradient(64,64,0,64,64,64);

    gr.addColorStop(0,'rgba(255,250,220,1)');
    gr.addColorStop(.3,'rgba(255,244,200,.5)');
    gr.addColorStop(1,'rgba(255,236,180,0)');

    cx.fillStyle=gr;
    cx.fillRect(0,0,128,128);

    this.flare=new THREE.Sprite(new THREE.SpriteMaterial({
      map:new THREE.CanvasTexture(fc),
      color:0xfff4d0,
      transparent:true,
      opacity:.8,
      blending:THREE.AdditiveBlending,
      fog:false,
      depthTest:false
    }));

    this.flare.scale.set(40,40,1);
    sc.add(this.flare);

    this.rain=this.mk(1500,0x99aacc,.3,-30);
    this.snow=this.mk(1200,0xfafafa,.8,-4);
    this.sand=this.mk(2000,0xd4a843,.4,-15);
  }

  mk(c,col,s,vy){
    const geo=new THREE.BufferGeometry();
    const pos=new Float32Array(c*3);
    const v=[];

    for(let i=0;i<c;i++){
      pos[i*3]=(Math.random()-.5)*400;
      pos[i*3+1]=Math.random()*150;
      pos[i*3+2]=(Math.random()-.5)*400;

      v.push({
        vy,
        vx:(Math.random()-.5)*2,
        vz:(Math.random()-.5)*2
      });
    }

    geo.setAttribute('position',new THREE.BufferAttribute(pos,3));

    const p=new THREE.Points(geo,new THREE.PointsMaterial({
      color:col,
      size:s,
      transparent:true,
      opacity:.7,
      depthWrite:false
    }));

    p.userData={velocities:v};
    p.visible=false;
    p.frustumCulled=false;

    this.scene.add(p);

    return p;
  }

  getMistFactor(t){
    const r=smoothstep(.20,.27,t);
    const f=smoothstep(.32,.50,t);
    return r*(1-f);
  }

  isPrecip(){
    return ['rain','storm','snow','sandstorm'].includes(this.currentWeather);
  }

  setWeather(t){
    this.currentWeather=t;

    this.rain.visible=t==='rain'||t==='storm';
    this.snow.visible=t==='snow';
    this.sand.visible=t==='sandstorm';

    this.stormClouds.setVisible(this.isPrecip());
  }

  update(dt,p){
    this.timeOfDay=(this.timeOfDay+dt/this.dayDuration)%1;

    const an=(this.timeOfDay-.25)*Math.PI*2;

    const sp=new THREE.Vector3(
      p.x+Math.cos(an)*400,
      Math.sin(an)*400,
      p.z+80
    );

    this.sun.position.copy(sp);
    this.sunTarget.position.copy(p);

    const sf=Math.max(0,Math.sin(an));

    this.sunDisc.position.copy(sp);

    const ts=sp.clone().sub(this.camera.position);
    const cd=new THREE.Vector3(0,0,-1).applyQuaternion(this.camera.quaternion);

    const dot=ts.normalize().dot(cd);

    const vis=sf>.1&&dot>.3&&this.currentWeather==='clear';

    this.flare.visible=vis;

    if(vis){
      this.flare.position.copy(this.camera.position.clone().lerp(sp,.3));
      this.flare.material.opacity=Math.pow(dot,3)*sf*.8;
    }

    this.sun.intensity=Math.max(.08,sf*1.4);
    this.hemi.intensity=.35+sf*.45;

    const st=
      this.currentWeather==='storm'?1:
      this.currentWeather==='rain'?.7:
      this.currentWeather==='snow'?.55:
      this.currentWeather==='sandstorm'?.8:
      0;

    this.sky.update(this.camera.position,performance.now()/1000,st,sf);
    this.stormClouds.update(p,dt,.75);

    this.scene.fog.color.copy(
      sf>.5?new THREE.Color(0xa8c4d8):
      sf>.1?new THREE.Color(0xd8b8a0):
      new THREE.Color(0x1a2230)
    );

    if(this.currentWeather==='sandstorm'){
      this.scene.fog.color.set(0xc8a060);
      this.scene.fog.near=50;
      this.scene.fog.far=800;
    } else {
      this.scene.fog.near=350;
      this.scene.fog.far=2600;
    }

    if(this.currentWeather==='storm'){
      this.sun.intensity*=.3;

      this.lightning.timer-=dt;

      if(this.lightning.timer<=0){
        if(Math.random()<.03){
          this.sun.intensity=5;
          this.lightning.timer=.15;
        } else {
          this.lightning.timer=1+Math.random()*3;
        }
      }
    }

    for(const s of[this.rain,this.snow,this.sand]){
      if(!s.visible)continue;

      const pos=s.geometry.attributes.position;
      const v=s.userData.velocities;

      for(let i=0;i<v.length;i++){
        pos.setXYZ(
          i,
          pos.getX(i)+v[i].vx*dt,
          pos.getY(i)+v[i].vy*dt,
          pos.getZ(i)+v[i].vz*dt
        );

        if(
          pos.getY(i)<0||
          Math.abs(pos.getX(i)-p.x)>200||
          Math.abs(pos.getZ(i)-p.z)>200
        ){
          pos.setXYZ(
            i,
            p.x+(Math.random()-.5)*400,
            150+Math.random()*80,
            p.z+(Math.random()-.5)*400
          );
        }
      }

      pos.needsUpdate=true;
    }
  }

  getTimeString(){
    const h=Math.floor(this.timeOfDay*24);
    const m=Math.floor((this.timeOfDay*24-h)*60);

    return String(h).padStart(2,'0')+':'+String(m).padStart(2,'0');
  }

  getWeatherName(){
    return{
      clear:'ЯСНО',
      rain:'ДОЖДЬ',
      storm:'ГРОЗА',
      snow:'СНЕГ',
      sandstorm:'ПЕСЧ. БУРЯ'
    }[this.currentWeather]||'ЯСНО';
  }
}

class ChaseCamera{
  constructor(cam,a){
    this.camera=cam;
    this.aircraft=a;
  }

  update(dt){
    const c=this.aircraft.config;

    const back=SETTINGS.camDist*((c.camBack||15)/15);
    const up=SETTINGS.camHeight*((c.camUp||6)/6);

    const t=_v1.set(-back,up,0).applyQuaternion(this.aircraft.orientation).add(this.aircraft.position);

    this.camera.position.lerp(t,3*dt);

    const l=_v2.copy(this.aircraft.position).addScaledVector(this.aircraft.getForward(),8);

    this.camera.lookAt(l);
  }
}

// ИСПРАВЛЕННЫЙ InputManager: можно удалять старые слушатели
class InputManager{
  constructor(a,w){
    this.aircraft=a;
    this.weather=w;
    this.keys=new Set();

    this._onKeyDown=e=>{
      this.keys.add(e.code);

      const K=SETTINGS;

      const wm={};

      wm[K.keyWx1]='clear';
      wm[K.keyWx2]='rain';
      wm[K.keyWx3]='storm';
      wm[K.keyWx4]='snow';

      if(wm[e.code]){
        this.weather.setWeather(wm[e.code]);
        this.syncButtons();
      }

      if(e.code===K.keyTime)this.weather.timeOfDay=(this.weather.timeOfDay+.25)%1;
      if(e.code===K.keyReset)this.aircraft.resetPosition();
      if(e.code===K.keyGear)this.aircraft.toggleGear();
      if(e.code===K.keyFlaps)this.aircraft.toggleFlaps();
      if(e.code===K.keyWalk)toggleMode();
      if(e.code===K.keyShoot)playerFiring=true;
      if(e.code===K.keySettings)toggleSettings();

      if(e.code==='Escape'){
        if(document.pointerLockElement)document.exitPointerLock();
        showWorldSelect();
      }

      const prevent=[
        K.keyUp,K.keyDown,K.keyLeft,K.keyRight,
        K.keyYawL,K.keyYawR,K.keyThrUp,K.keyThrDn,
        K.keyGear,K.keyFlaps,K.keyWalk,K.keySettings,K.keyReset,
        K.keyShoot,
        'Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'
      ];

      if(prevent.includes(e.code))e.preventDefault();
    };

    this._onKeyUp=e=>{
      this.keys.delete(e.code);
      if(e.code===SETTINGS.keyShoot)playerFiring=false;
    };

    window.addEventListener('keydown',this._onKeyDown);
    window.addEventListener('keyup',this._onKeyUp);
  }

  dispose(){
    window.removeEventListener('keydown',this._onKeyDown);
    window.removeEventListener('keyup',this._onKeyUp);
  }

  syncButtons(){
    document.querySelectorAll('#weather-panel button').forEach(b=>b.classList.remove('active'));

    const b=document.querySelector(`#weather-panel button[data-wx="${this.weather.currentWeather}"]`);

    if(b)b.classList.add('active');
  }

  wasd(){
    const K=SETTINGS;

    let f=0,r=0;

    if(this.keys.has(K.keyUp))f++;
    if(this.keys.has(K.keyDown))f--;
    if(this.keys.has(K.keyRight))r++;
    if(this.keys.has(K.keyLeft))r--;

    return{f,r};
  }

  update(){
    const K=SETTINGS;
    const a=this.aircraft;

    a.input.pitch=0;
    a.input.roll=0;
    a.input.yaw=0;

    if(this.keys.has(K.keyUp))a.input.pitch=1;
    else if(this.keys.has(K.keyDown))a.input.pitch=-1;

    if(this.keys.has(K.keyLeft))a.input.roll=-1;
    else if(this.keys.has(K.keyRight))a.input.roll=1;

    if(this.keys.has(K.keyYawL))a.input.yaw=1;
    else if(this.keys.has(K.keyYawR))a.input.yaw=-1;

    if(this.keys.has(K.keyThrUp))a.throttle=Math.min(1,a.throttle+.01);
    if(this.keys.has(K.keyThrDn))a.throttle=Math.max(0,a.throttle-.01);
  }
}

const touch={
  left:{id:-1,x:0,y:0,ox:0,oy:0},
  right:{id:-1,x:0,y:0,ox:0,oy:0}
};

const sticks={};

function makeStickEl(){
  const d=document.createElement('div');
  d.className='stick';
  d.innerHTML='<div class="knob"></div>';

  el('touch-ui').appendChild(d);

  return d;
}

function showStick(s,x,y){
  const s2=sticks[s];

  s2.style.display='block';
  s2.style.left=(x-55)+'px';
  s2.style.top=(y-55)+'px';
  s2.firstChild.style.transform='translate(0,0)';
}

function moveKnob(s,x,y){
  sticks[s].firstChild.style.transform=`translate(${x*42}px,${y*42}px)`;
}

function hideStick(s){
  sticks[s].style.display='none';
}

function bindTouch(){
  showEl('touch-ui','block');

  sticks.left=makeStickEl();
  sticks.right=makeStickEl();

  const zone=s=>{
    const z=el(s==='left'?'zone-l':'zone-r');

    z.addEventListener('touchstart',e=>{
      for(const t of e.changedTouches){
        if(touch[s].id!==-1)continue;

        touch[s].id=t.identifier;
        touch[s].ox=t.clientX;
        touch[s].oy=t.clientY;
        touch[s].x=0;
        touch[s].y=0;

        showStick(s,t.clientX,t.clientY);
      }

      e.preventDefault();
    },{passive:false});

    z.addEventListener('touchmove',e=>{
      for(const t of e.changedTouches){
        if(touch[s].id===t.identifier){
          touch[s].x=clamp((t.clientX-touch[s].ox)/55,-1,1);
          touch[s].y=clamp((t.clientY-touch[s].oy)/55,-1,1);

          moveKnob(s,touch[s].x,touch[s].y);
        }
      }

      e.preventDefault();
    },{passive:false});

    const end=e=>{
      for(const t of e.changedTouches){
        if(touch[s].id===t.identifier){
          touch[s].id=-1;
          touch[s].x=0;
          touch[s].y=0;

          hideStick(s);
        }
      }
    };

    z.addEventListener('touchend',end);
    z.addEventListener('touchcancel',end);
  };

  zone('left');
  zone('right');

  const bind=(id,f)=>{
    const b=el(id);

    b.addEventListener('touchstart',e=>{
      e.preventDefault();
      e.stopPropagation();
      f();
    },{passive:false});
  };

  bind('tb-v',()=>toggleMode());
  bind('tb-g',()=>aircraft&&aircraft.toggleGear());
  bind('tb-f',()=>aircraft&&aircraft.toggleFlaps());
  bind('tb-r',()=>aircraft&&aircraft.resetPosition());
}

function physAircraft(id){
  const use=id?AIRCRAFT_CATALOG.find(c=>c.id===id):AIRCRAFT_CATALOG[2];

  const a=new Aircraft(scene,use);

  const gy=terrain.getHeight(0,0);

  if(use.ground)a.position.set(0,gy,0);
  else a.position.set(0,gy+800,0);

  a.prevPosition.copy(a.position);
  a.speed=use.ground?0:30;
  a.spawnGrace=0;

  const tmpCM=new ChunkManager(scene,terrain);
  tmpCM.chunkSize=terrain.chunkSize;

  for(let dx=-3;dx<=3;dx++){
    for(let dz=-3;dz<=3;dz++){
      tmpCM.chunks.set(
        tmpCM.key(dx,dz),
        new Chunk(dx,dz,scene,terrain,2,tmpCM.chunkSize,SETTINGS.chunkRes)
      );
    }
  }

  a._tmpCM=tmpCM;

  return a;
}

function physRun(fn,id){
  const a=physAircraft(id);
  const cm2=a._tmpCM;

  try{
    fn(a,cm2);
  } finally {
    cm2.chunks.forEach(c=>{
      try{
        c.dispose();
      }catch(e){}
    });

    cm2.chunks.clear();

    scene.remove(a.group);
  }
}

function runTests(terr,aircraft,weather,cm,birds){
  test('SimplexNoise [-1,1]',()=>{
    const n=new SimplexNoise(1);

    for(let i=0;i<100;i++){
      const v=n.noise2D(Math.random()*100,Math.random()*100);
      if(v<-1||v>1)throw new Error('Out');
    }

    return true;
  });

  test('Terrain height valid',()=>{
    for(let i=0;i<30;i++){
      const h=terrain.getHeight(Math.random()*1000-500,Math.random()*1000-500);
      if(isNaN(h)||h<-20||h>450)throw new Error('Bad');
    }

    return true;
  });

  test('Большие горы есть',()=>{
    const t=new TerrainGenerator(WORLDS[0],SETTINGS.worldSeed);

    let maxH=0;

    for(let i=0;i<400;i++){
      maxH=Math.max(maxH,t.getHeight(Math.random()*3000-1500,Math.random()*3000-1500));
    }

    if(maxH<100)throw new Error('нет гор: '+maxH.toFixed(1));

    return true;
  });

  test('Старт по умолчанию 80м',()=>{
    if(SETTINGS.startAlt!==80)throw new Error('дефолт не 80');
    return true;
  });

  test('W — нос ВВЕРХ',()=>{
    physRun((a,useCM)=>{
      a.spawnGrace=0;
      a.throttle=.6;
      a.input.pitch=1;

      for(let i=0;i<60;i++)a.update(.03,useCM);

      const fy=a.getForward().y;

      if(fy<0.15)throw new Error('W не поднимает нос fy='+fy.toFixed(2));
    });

    return true;
  });

  test('S — нос ВНИЗ',()=>{
    physRun((a,useCM)=>{
      a.spawnGrace=0;
      a.throttle=.6;
      a.input.pitch=-1;

      for(let i=0;i<60;i++)a.update(.03,useCM);

      const fy=a.getForward().y;

      if(fy>-0.15)throw new Error('S не опускает нос fy='+fy.toFixed(2));
    });

    return true;
  });

  test('Самолёт летит вперёд (газ=0.6)',()=>{
    physRun((a,useCM)=>{
      a.spawnGrace=0;
      a.throttle=0.6;

      const x0=a.position.x;

      for(let i=0;i<120;i++)a.update(.03,useCM);

      const dx=a.position.x-x0;

      if(dx<10)throw new Error('не летит вперёд dx='+dx.toFixed(1));
    });

    return true;
  });

  test('Самолёт снижается (газ=0)',()=>{
    physRun((a,useCM)=>{
      a.spawnGrace=0;
      a.throttle=0;
      a.speed=30;

      const y0=a.position.y;

      for(let i=0;i<150;i++)a.update(.03,useCM);

      const dy=a.position.y-y0;

      if(dy>=-1)throw new Error('не снижается dy='+dy.toFixed(1));
    });

    return true;
  });

  test('Ветер разворачивает нос по ветру',()=>{
    physRun((a,useCM)=>{
      a.spawnGrace=0;
      a.throttle=0;
      a.speed=0;
      a._yawAngle=0;

      const wind=new THREE.Vector3(0,0,10);

      for(let i=0;i<120;i++)a.update(.03,useCM,0,wind);

      const yaw=a._yawAngle;
      const windAngle=Math.atan2(-10,0);

      let diff=windAngle-yaw;

      while(diff>Math.PI)diff-=Math.PI*2;
      while(diff<-Math.PI)diff+=Math.PI*2;

      if(Math.abs(diff)>1.4)throw new Error('нос не развернулся к ветру, diff='+diff.toFixed(2));
    });

    return true;
  });

  test('Ветер колышет самолёт',()=>{
    physRun((a,useCM)=>{
      a.spawnGrace=0;
      a.throttle=0.4;
      a.speed=15;

      const wind=new THREE.Vector3(12,0,0);
      const y0=a.orientation.clone();

      let swayed=false;

      for(let i=0;i<60;i++){
        a.update(.03,useCM,0,wind);

        if(Math.abs(a.orientation.z-y0.z)>0.005 || Math.abs(a.orientation.x-y0.x)>0.005){
          swayed=true;
        }
      }

      if(!swayed)throw new Error('не колышет');
    });

    return true;
  });

  test('Сопротивление управлению (сглаживание)',()=>{
    physRun((a,useCM)=>{
      a.spawnGrace=0;
      a.throttle=0.5;
      a.input.roll=1;

      a.update(.016,useCM);

      const r1=a._rRate;

      if(Math.abs(r1)>=0.9)throw new Error('нет сглаживания _rRate='+r1.toFixed(2));
    });

    return true;
  });

  test('D — правый поворот',()=>{
    physRun((a,useCM)=>{
      a.spawnGrace=0;
      a.throttle=.6;
      a.input.roll=1;

      for(let i=0;i<120;i++)a.update(.03,useCM);

      const z=a.getForward().z;

      if(z<0.1)throw new Error('D не поворачивает вправо z='+z.toFixed(2));
    });

    return true;
  });

  test('Джип: кабина есть',()=>{
    const b=BUILDERS.buildJeep();

    let glass=false;

    b.group.traverse(o=>{
      if(o.isMesh&&o.material===M.glass())glass=true;
    });

    if(!glass)throw new Error('нет лобового стекла');
    if(!b.wheels||b.wheels.length!==4)throw new Error('нет 4 колёс');

    return true;
  });

  test('Джип: наклон корпуса по рельефу',()=>{
    physRun((a,useCM)=>{
      a.spawnGrace=0;
      a.throttle=.8;

      for(let i=0;i<80;i++)a.update(.03,useCM);

      const up=new THREE.Vector3(0,1,0).applyQuaternion(a.orientation);

      const e=1.5;
      const x=a.position.x;
      const z=a.position.z;

      const gx=(useCM.getHeightAt(x+e,z)-useCM.getHeightAt(x-e,z))/(2*e);
      const gz=(useCM.getHeightAt(x,z+e)-useCM.getHeightAt(x,z-e))/(2*e);

      const nrm=new THREE.Vector3(-gx,1,-gz).normalize();

      if(up.dot(nrm)<0.8)throw new Error('корпус не по наклону');
    },'jeep');

    return true;
  });

  test('Джип: колёса рулятся',()=>{
    physRun((a,useCM)=>{
      a.spawnGrace=0;
      a.throttle=.8;
      a.input.roll=1;

      for(let i=0;i<30;i++)a.update(.03,useCM);

      const fw=a.wheels.find(w=>w.userData.front);

      if(Math.abs(fw.rotation.y)<0.05)throw new Error('передние колёса не рулятся');
    },'jeep');

    return true;
  });

  test('Джип: D вправо',()=>{
    physRun((a,useCM)=>{
      a.spawnGrace=0;
      a.throttle=1;
      a.input.roll=1;

      for(let i=0;i<60;i++)a.update(.03,useCM);

      const f1=new THREE.Vector3(Math.cos(a._yawAngle),0,-Math.sin(a._yawAngle));

      if(f1.z<0.05)throw new Error('D не поворачивает джип вправо');
    },'jeep');

    return true;
  });

  test('Лодка: D вправо',()=>{
    const cfg=AIRCRAFT_CATALOG.find(c=>c.id==='boat');
    const b=new Aircraft(scene,cfg);

    try{
      b.applyStartPos();
      b.spawnGrace=0;
      b.throttle=1;
      b.speed=5;

      const y0=b._yawAngle;

      b.input.roll=1;

      for(let i=0;i<60;i++)b.update(.03,chunkManager,i*.03);

      if(b._yawAngle-y0>0)throw new Error('D поворачивает влево');
    } finally {
      scene.remove(b.group);
    }

    return true;
  });

  test('Лава ТОЛЬКО в вулкане',()=>{
    const isV=CURRENT_WORLD.id==='volcano';

    if(isV!==(volcSys!==null))throw new Error('volcSys не соответствует миру');

    return true;
  });

  test('Лава течёт мелкими частицами',()=>{
    const needDispose=(CURRENT_WORLD.id!=='volcano');

    const t=needDispose?new TerrainGenerator(WORLDS[5],SETTINGS.worldSeed):terrain;
    const vs=needDispose?new VolcanoSystem(scene,t):volcSys;

    const v=vs.volcano;

    if(v.flowP.points.material.size>1.5)throw new Error('крупные пиксели');

    v.phase=0;

    for(let i=0;i<300;i++){
      vs.updVolcano(v,0.05,i*0.05,{x:0,z:0});
    }

    let flowed=0;

    for(let i=0;i<v.flowP.vel.length;i++){
      if(v.flowP.vel[i].life>0 && v.flowP.pos[i*3+1]<v.summit-15)flowed++;
    }

    if(needDispose)vs.dispose();

    if(flowed<3)throw new Error('лава не стекает');

    return true;
  });

  test('Пустыня: НЕТ озёр, только оазисы',()=>{
    const t=new TerrainGenerator(WORLDS[1],SETTINGS.worldSeed);

    let water=0;
    let oasis=0;

    for(let i=0;i<800;i++){
      const x=Math.random()*2400-1200;
      const z=Math.random()*2400-1200;

      const h=t.getHeight(x,z);

      if(h<WATER_LEVEL){
        water++;

        if(t.getBiome(h,.5)==='oasis')oasis++;
      }
    }

    if(water>0 && oasis!==water)throw new Error('вода не только в оазисах');
    if(water>800*0.03)throw new Error('много воды');

    return true;
  });

  test('У вулкана нет домов и животных',()=>{
    const oldW=CURRENT_WORLD;
    CURRENT_WORLD=WORLDS[5];

    const t=new TerrainGenerator(WORLDS[5],SETTINGS.worldSeed);
    const ts=new THREE.Scene();

    const cx=Math.round(t.volcanoCenter.x/SETTINGS.chunkSize);
    const cz=Math.round(t.volcanoCenter.z/SETTINGS.chunkSize);

    let houses=0;
    let animals=0;

    for(let dx=-1;dx<=1;dx++){
      for(let dz=-1;dz<=1;dz++){
        const ch=new Chunk(cx+dx,cz+dz,ts,t,2,SETTINGS.chunkSize,SETTINGS.chunkRes);

        houses+=ch.colliders.filter(c=>c.type==='house').length;
        animals+=ch.animals.length;

        ch.dispose();
      }
    }

    CURRENT_WORLD=oldW;

    if(houses>0 || animals>0)throw new Error('есть дома/животные у вулкана');

    return true;
  });

  test('Дома свои для каждого мира',()=>{
    const a=buildWorldHouse('desert');
    const b=buildWorldHouse('jungle');
    const c=buildWorldHouse('prehistoric');
    const d=buildWorldHouse('volcano');
    const e=buildWorldHouse('temperate');

    const cnt=x=>{
      let n=0;

      x.g.traverse(o=>{
        if(o.isMesh)n++;
      });

      return n;
    };

    const set=new Set([cnt(a),cnt(b),cnt(c),cnt(d),cnt(e)]);

    if(set.size<3)throw new Error('дома одинаковые');

    return true;
  });

  test('Джунгли густые',()=>{
    const oldW=CURRENT_WORLD;
    CURRENT_WORLD=WORLDS[3];

    const t=new TerrainGenerator(WORLDS[3],SETTINGS.worldSeed);
    const ts=new THREE.Scene();

    const ch=new Chunk(0,0,ts,t,2,SETTINGS.chunkSize,SETTINGS.chunkRes);

    let trees=0;

    ch.group.traverse(o=>{
      if(o.isInstancedMesh&&o.material===treeMat())trees+=o.count;
    });

    ch.dispose();

    CURRENT_WORLD=oldW;

    if(trees<40)throw new Error('не густо');

    return true;
  });

  test('Ветер влияет на самолёт',()=>{
    physRun((a,useCM)=>{
      const oldW=SETTINGS.windStrength;

      SETTINGS.windStrength=15;

      a.throttle=.6;
      a.spawnGrace=0;

      const p0=a.position.clone();

      for(let i=0;i<60;i++){
        a.update(.05,useCM,0,new THREE.Vector3(15,0,0));
      }

      const drift=Math.hypot(a.position.x-p0.x,a.position.z-p0.z);

      SETTINGS.windStrength=oldW;

      if(drift<1)throw new Error('ветер не сносит');
    });

    return true;
  });

  test('Seed детерминирует мир',()=>{
    const a=new TerrainGenerator(WORLDS[0],1234);
    const b=new TerrainGenerator(WORLDS[0],1234);

    if(Math.abs(a.getHeight(100,100)-b.getHeight(100,100))>1e-9){
      throw new Error('не детерминирован');
    }

    return true;
  });

  test('Свои деревья для миров',()=>{
    const a=worldTreeGeo('desert');
    const b=worldTreeGeo('prehistoric');
    const c=worldTreeGeo('swamp');
    const d=worldTreeGeo('jungle');

    if(a===b || b===c || c===d)throw new Error('одинаковы');

    return true;
  });

  test('Животные прижаты к земле',()=>{
    const oldW=CURRENT_WORLD;
    CURRENT_WORLD=WORLDS[0];

    const t=new TerrainGenerator(WORLDS[0],SETTINGS.worldSeed);
    const ts=new THREE.Scene();

    const ch=new Chunk(0,0,ts,t,2,SETTINGS.chunkSize,SETTINGS.chunkRes);

    let ok=true;

    for(const a of ch.animals){
      if(a.fly || a.swim)continue;

      for(let i=0;i<30;i++)a.update(.05,i*.05);

      const gh=t.getHeight(a.grp.position.x,a.grp.position.z);

      if(Math.abs(a.grp.position.y-gh)>1.5)ok=false;
    }

    ch.dispose();

    CURRENT_WORLD=oldW;

    if(!ok)throw new Error('животные не на земле');

    return true;
  });

  test('В воде только пловцы',()=>{
    if(ANIMAL_BUILDERS['deer']().swim)throw new Error('олень пловец');
    if(!ANIMAL_BUILDERS['crocodile']().swim)throw new Error('крокодил не пловец');

    return true;
  });

  test('8 транспортов разные ЛТХ',()=>{
    if(AIRCRAFT_CATALOG.length!==8)throw new Error('cat');

    if(new Set(AIRCRAFT_CATALOG.map(p=>p.maxSpeed)).size!==8){
      throw new Error('same');
    }

    return true;
  });

  test('Малый газ → падение',()=>{
    physRun((a,useCM)=>{
      a.throttle=0;
      a.spawnGrace=0;

      const y0=a.position.y;

      let fell=false;
      let minY=y0;

      for(let i=0;i<1000;i++){
        a.update(.03,useCM);

        if(a.position.y<minY)minY=a.position.y;

        if(a.velocity.y<-2)fell=true;

        if(a.crashed){
          fell=true;
          break;
        }
      }

      if(!fell || y0-minY<10)throw new Error('не падает');
    });

    return true;
  });

  test('Пикирование разгоняет',()=>{
    physRun((a,useCM)=>{
      a.throttle=.35;
      a.spawnGrace=0;

      for(let i=0;i<60;i++)a.update(.016,useCM);

      const s0=a.speed;

      a.input.pitch=-1;

      for(let i=0;i<150;i++)a.update(.016,useCM);

      const s1=a.speed;

      if(!(s1>s0+1))throw new Error('не разгоняет '+s0.toFixed(1)+'→'+s1.toFixed(1));
    });

    return true;
  });

  test('Вираж креном',()=>{
    physRun((a,useCM)=>{
      a.spawnGrace=0;

      const h0=Math.atan2(a.getForward().z,a.getForward().x);

      a.input.roll=1;

      for(let i=0;i<60;i++)a.update(.016,useCM);

      a.input.pitch=0.3;

      for(let i=0;i<120;i++)a.update(.016,useCM);

      const h1=Math.atan2(a.getForward().z,a.getForward().x);

      let d=Math.abs(h1-h0)*57.3;

      if(d>180)d=360-d;

      if(d<15)throw new Error('курс d='+d.toFixed(1));
    });

    return true;
  });

  test('Коллизии: животные',()=>{
    physRun((a,useCM)=>{
      let target=null;

      for(const c of useCM.chunks.values()){
        if(c.animals.length){
          target=c.animals[0];
          break;
        }
      }

      if(!target)return;

      a.crashed=false;
      a.model.visible=true;
      a.spawnGrace=0;

      const tp=target.grp.position;

      a.position.set(tp.x-40,tp.y+2,tp.z);
      a.prevPosition.copy(a.position);

      a.velocity.set(40,0,0);
      a.speed=40;
      a.orientation.set(0,0,0,1);
      a.throttle=.3;

      let cr=false;

      for(let i=0;i<200&&!cr;i++){
        a.update(.03,useCM);
        cr=a.crashed;
      }

      if(!cr)throw new Error('не столкнулся с животным');
    });

    return true;
  });

  test('Коллизии: дома',()=>{
    physRun((a,useCM)=>{
      const c=useCM.chunks.values().next().value;

      c.colliders.push({
        position:new THREE.Vector3(a.position.x+40,a.position.y,a.position.z),
        radius:5,
        type:'house'
      });

      a.crashed=false;
      a.model.visible=true;
      a.spawnGrace=0;

      a.velocity.set(40,0,0);
      a.speed=40;
      a.orientation.set(0,0,0,1);
      a.throttle=.3;

      let cr=false;

      for(let i=0;i<200&&!cr;i++){
        a.update(.03,useCM);
        cr=a.crashed;
      }

      if(!cr)throw new Error('не столкнулся с домом');
    });

    return true;
  });

  test('Разваливание при крушении',()=>{
    if(!aircraft || aircraft.config.waterOnly || aircraft.config.ground)return true;

    if(!debris)throw new Error('нет обломков');

    const had=debris.pieces.length;

    aircraft.resetPosition();
    aircraft.crash('тест');

    const has=debris.pieces.length>had;

    aircraft.resetPosition();

    debris.pieces.forEach(p=>scene.remove(p.g));
    debris.pieces.length=0;

    if(!has)throw new Error('обломки не созданы');

    return true;
  });

  test('Туман утро/полдень',()=>{
    const f=t=>weather.getMistFactor(t);

    if(f(.3)<.9)throw new Error('пик');
    if(f(.5)>.01)throw new Error('не рассеялся');

    return true;
  });

  test('Катер: плавучесть у поверхности',()=>{
    const cfg=AIRCRAFT_CATALOG.find(c=>c.id==='boat');
    const b=new Aircraft(scene,cfg);

    try{
      b.applyStartPos();
      b.spawnGrace=0;
      b.throttle=0;

      for(let i=0;i<200;i++)b.update(.03,chunkManager,i*.03);

      const dy=Math.abs(b.position.y-(WATER_LEVEL-BOAT_DRAFT));

      if(dy>0.8)throw new Error('осадка плывёт dy='+dy.toFixed(2));
    } finally {
      scene.remove(b.group);
    }

    return true;
  });

  test('Тучи при осадках',()=>{
    weather.setWeather('rain');

    if(!weather.stormClouds.group.visible)throw new Error('туч');

    weather.setWeather('clear');

    if(weather.stormClouds.group.visible)throw new Error('тучи при ясно');

    return true;
  });

  test('Птицы машут',()=>{
    const b=birds.birds[0];

    const p0=b.g.position.clone();
    const w0=b.pL.rotation.x;

    birds.update(.5,1,new THREE.Vector3(0,80,0),null);

    if(b.g.position.distanceTo(p0)<.01)throw new Error('не летит');
    if(b.pL.rotation.x===w0)throw new Error('не машет');

    return true;
  });

  test('Крушение о деревья/камни',()=>{
    physRun((a,useCM)=>{
      const offs=[[4,0],[5,1],[4,2],[6,1],[3,2],[5,3],[6,3],[4,4],[7,2],[2,3],[6,5],[5,5]];

      const found={1:null,2:null,rock:null};
      const held=[];

      for(const lod of[1,2]){
        for(const[dx,dz]of offs){
          const c=new Chunk(dx,dz,scene,terrain,lod,SETTINGS.chunkSize,SETTINGS.chunkRes);

          held.push(c);

          const t=c.colliders.find(c2=>c2.type==='tree');
          const r=c.colliders.find(c2=>c2.type==='rock');

          if(t&&!found[lod])found[lod]=t;
          if(r&&!found.rock)found.rock=r;

          if(found[lod]&&(found.rock||lod===1))break;
        }
      }

      const clean=()=>held.forEach(c=>{
        try{
          c.dispose();
        }catch(e){}
      });

      if(!found[1] || !found[2]){
        clean();
        return;
      }

      const tg=[found[1],found[2],found.rock].filter(Boolean);

      let fail=null;

      for(const p of tg){
        a.crashed=false;
        a.model.visible=true;
        a.spawnGrace=0;

        a.position.set(p.position.x-45,p.position.y,p.position.z);
        a.prevPosition.copy(a.position);

        a.velocity.set(40,0,0);
        a.speed=40;
        a.orientation.set(0,0,0,1);
        a.throttle=.25;

        let cr=false;

        for(let i=0;i<200&&!cr;i++){
          a.update(.03,useCM);
          cr=a.crashed;
        }

        if(!cr){
          fail='не разбился о '+p.type;
          break;
        }
      }

      clean();

      if(fail)throw new Error(fail);
    });

    return true;
  });

  test('Орнитоптер: крылья машут',()=>{
    const cfg=AIRCRAFT_CATALOG.find(c=>c.id==='ornithopter');
    const o=new Aircraft(scene,cfg);

    try{
      o.spawnGrace=0;
      o.throttle=0.6;

      const wp0=o.wingPivots.fl.rotation.x;

      for(let i=0;i<30;i++)o.update(.05,chunkManager,i*.05);

      const wp1=o.wingPivots.fl.rotation.x;

      if(Math.abs(wp1-wp0)<0.01)throw new Error('крылья не машут');
    } finally {
      scene.remove(o.group);
    }

    return true;
  });

  test('Мир Dune существует',()=>{
    const d=WORLDS.find(w=>w.id==='dune');

    if(!d)throw new Error('мир Dune не найден');

    return true;
  });

  test('Дюна: червь не спавнится в чанках',()=>{
    const d=WORLDS.find(w=>w.id==='dune');

    if(d.animals.includes('worm'))throw new Error('worm есть в списке животных Дюны');

    const oldW=CURRENT_WORLD;
    CURRENT_WORLD=d;

    const t=new TerrainGenerator(d,1234,SETTINGS.chunkSize);
    const ts=new THREE.Scene();

    let worms=0;

    for(let cx=-1;cx<=1;cx++){
      for(let cz=-1;cz<=1;cz++){
        const ch=new Chunk(cx,cz,ts,t,2,SETTINGS.chunkSize,SETTINGS.chunkRes);

        for(const a of ch.animals){
          if(a.worm)worms++;
        }

        ch.dispose();
      }
    }

    CURRENT_WORLD=oldW;

    if(worms>0)throw new Error('найдены статические черви в чанках: '+worms);

    return true;
  });

  test('Червь один, целый и движется',()=>{
    const d=WORLDS.find(w=>w.id==='dune');

    const oldW=CURRENT_WORLD;
    CURRENT_WORLD=d;

    const t=new TerrainGenerator(d,1234,SETTINGS.chunkSize);
    const ts=new THREE.Scene();

    const sys=new ShaiHuludSystem(ts,t);

    if(!sys.worm)throw new Error('червь не создан');
    if(sys.worms)throw new Error('найден лишний массив червей');

    const b=sys.built;

    if(!b.segments || b.segments.length<10)throw new Error('мало сегментов тела');

    for(let i=1;i<b.segments.length;i++){
      const dist=b.segments[i].position.distanceTo(b.segments[i-1].position);

      if(dist>sys.size*1.1)throw new Error('разрыв между сегментами '+i+': '+dist.toFixed(2));
    }

    if(b.mouth && b.head){
      const mouthDist=b.mouth.position.distanceTo(b.head.position);

      if(mouthDist>1.9)throw new Error('пасть далеко от головы: '+mouthDist.toFixed(2));
    }

    sys.state='underground';
    sys.heading=0;
    sys.targetX=sys.x+250;
    sys.targetZ=sys.z;

    const x0=sys.x;

    for(let i=0;i<80;i++){
      sys.update(0.05,i*0.05,new THREE.Vector3(sys.x+2000,1000,sys.z));
    }

    if(Math.abs(sys.x-x0)<2)throw new Error('червь не двигается');

    sys.dispose();

    CURRENT_WORLD=oldW;

    return true;
  });

  test('Взрыв оставляет кратер',()=>{
    const t=new TerrainGenerator(WORLDS[1],1234,SETTINGS.chunkSize);

    const x=100;
    const z=100;

    const h0=t.getHeight(x,z);

    const es=new ExplosionSystem(scene,t);

    es.explode(x,h0,z,8,1);

    const h1=t.getHeight(x,z);

    es.dispose();

    if(h1>=h0)throw new Error('кратер не создан');

    return true;
  });

  renderTests();
}

let previewScenes=[],menuVisible=false;

let scene,camera,renderer,aircraft,chunkManager,weather,terrain,input,chaseCam,volcSys,glints,shaiHuludSys,battleSys;
let skyDome,stormClouds,birds,player=null,walkMode=false,mouseDrag=false,viewArms=null;
let playerFiring=false,lastPlayerShot=-Infinity;
let lastTime=performance.now(),isGameRunning=false,shadowTick=0,fpsAcc=0,fpsCount=0;

function clearPreviews(){
  for(const p of previewScenes){
    try{
      p.renderer.dispose();
    }catch(e){}

    try{
      if(p.renderer.forceContextLoss)p.renderer.forceContextLoss();
    }catch(e){}
  }

  previewScenes.length=0;
}

function buildWorldSelect(){
  const gr=el('world-grid');
  gr.innerHTML='';

  WORLDS.forEach(w=>{
    const c=document.createElement('div');
    c.className='card';

    c.innerHTML=`<div class="emoji">${w.emoji}</div><h3>${w.name}</h3><div class="type">${w.desc}</div><div class="stats">Fauna: <b>${w.animals.slice(0,3).join(', ')}</b>…</div>`;

    c.addEventListener('click',()=>{
      CURRENT_WORLD=w;
      showAircraftSelect();
    });

    gr.appendChild(c);
  });
}

function showWorldSelect(){
  if(document.pointerLockElement)document.exitPointerLock();

  menuVisible=true;
  isGameRunning=false;

  showEl('crash-screen','none');
  showEl('world-select','flex');
  showEl('aircraft-select','none');

  showEl('hud','none');
  showEl('weather-panel','none');
  showEl('controls-help','none');
  showEl('crosshair','none');
  showEl('minimap','none');
  showEl('radar','none');
  showEl('health-bar','none');
  showEl('worm-warning','none');
}

function showAircraftSelect(){
  menuVisible=true;

  showEl('crash-screen','none');
  showEl('world-select','none');
  showEl('aircraft-select','flex');

  el('air-sub').textContent='Мир: '+CURRENT_WORLD.name+' '+CURRENT_WORLD.emoji+' · seed '+SETTINGS.worldSeed;

  clearPreviews();

  const gr=el('aircraft-grid');
  gr.innerHTML='';

  AIRCRAFT_CATALOG.forEach(pl=>{
    const c=document.createElement('div');

    c.className='card'+(
      pl.id==='airship'?' airship':
      pl.id==='boat'?' boat':
      pl.id==='twin'?' twin':
      pl.id==='jeep'?' jeep':
      pl.id==='ornithopter'?' ornithopter':''
    );

    const cv=document.createElement('canvas');
    cv.width=260;
    cv.height=90;

    c.appendChild(cv);

    const h=document.createElement('h3');
    h.textContent=pl.name;

    c.appendChild(h);

    const t=document.createElement('div');
    t.className='type';
    t.textContent=pl.type;

    c.appendChild(t);

    const s=document.createElement('div');
    s.className='stats';

    s.innerHTML=`Скорость <b>${pl.maxSpeed}</b> Управл. <b>${(pl.handling*100).toFixed(0)}%</b>`;

    c.appendChild(s);

    c.addEventListener('click',()=>startGame(pl));

    gr.appendChild(c);

    setupPreview(cv,pl);
  });
}

function setupPreview(cv,pl){
  const sc=new THREE.Scene();

  sc.background=envMap||new THREE.Color(0x101828);

  if(envMap)sc.environment=envMap;

  const cam=new THREE.PerspectiveCamera(40,cv.width/cv.height,.1,100);
  cam.position.set(9,4,9);

  const r=new THREE.WebGLRenderer({canvas:cv,antialias:true});

  r.setSize(cv.width,cv.height,false);
  r.toneMapping=THREE.ACESFilmicToneMapping;

  sc.add(new THREE.DirectionalLight(0xfff4e0,1.4));
  sc.add(new THREE.HemisphereLight(0xa8c4dc,0x5a4a3a,0.6));

  const b=BUILDERS[pl.builder]();
  const m=b.group;

  m.scale.setScalar(pl.scale);

  m.traverse(c=>{
    if(c.isMesh&&c.material){
      (Array.isArray(c.material)?c.material:[c.material]).forEach(mm=>{
        if(mm.envMap!==undefined)mm.envMap=envMap;
      });
    }
  });

  sc.add(m);

  cam.lookAt(0,0,0);

  previewScenes.push({
    sc,
    cam,
    renderer:r,
    model:m,
    rot:0,
    prop:b.propeller
  });
}

function animatePreviews(){
  if(!menuVisible)return;

  const as=el('aircraft-select');

  if(!as || as.style.display==='none')return;

  for(const p of previewScenes){
    p.rot+=.012;

    p.model.rotation.y=p.rot;

    if(p.prop)p.prop.rotation.x+=.3;

    p.renderer.render(p.sc,p.cam);
  }
}

function toggleMode(){
  if(!aircraft)return;

  if(walkMode){
    if(player&&player.world&&!player.canBoard(aircraft)){
      setText('mode','ПОДОЙДИТЕ К ТРАНСПОРТУ');
      return;
    }

    if(player&&player.setMode)player.setMode('pilot');
    if(player&&player.world)player=null;

    walkMode=false;
    playerFiring=false;
    aircraft.autopilot=false;

    if(viewArms)viewArms.visible=false;
    if(document.pointerLockElement)document.exitPointerLock();
    setText('mode','ПИЛОТ');
    return;
  }

  if(aircraft.deck){
    if(!player)player=new GondolaPlayer(aircraft.group,aircraft.deck);
    aircraft.autopilot=true;
    aircraft.autoAlt=aircraft.position.y;
    player.setMode('walk');
  } else {
    if(!aircraft.onGround||Math.abs(aircraft.speed)>4){
      setText('mode','ПОСАДИТЕСЬ И ОСТАНОВИТЕСЬ');
      return;
    }

    aircraft.throttle=0;
    player=new GroundPlayer(aircraft,chunkManager);
  }

  walkMode=true;

  if(viewArms)viewArms.visible=true;

  try{
    if(renderer.domElement.requestPointerLock)renderer.domElement.requestPointerLock();
  }catch(e){}

  setText('mode','ПЕШКОМ');
}

document.addEventListener('mousedown',e=>{
  if(!walkMode)return;
  mouseDrag=true;
  if(e.button===0)playerFiring=true;
});

document.addEventListener('mouseup',e=>{
  mouseDrag=false;
  if(e.button===0)playerFiring=false;
});

document.addEventListener('mousemove',e=>{
  if(!walkMode || !player)return;

  if(document.pointerLockElement || mouseDrag){
    player.viewYaw-=e.movementX*.0025;
    player.viewPitch=clamp(player.viewPitch+e.movementY*.002,-.9,.9);
  }
});

class GondolaPlayer{
  constructor(parent,deck){
    this.parent=parent;
    this.deck=deck;

    this.local=new THREE.Vector3(deck.helmX||0,deck.y||0,0);

    this.viewYaw=0;
    this.viewPitch=0;
    this.walkPhase=0;
    this.mode='pilot';
  }

  setMode(m){
    this.mode=m;

    if(m==='walk'){
      this.walkPhase=0;
    }
  }

  update(dt,mv={f:0,r:0},lk={x:0,y:0}){
    if(this.mode!=='walk')return;

    this.viewYaw+=lk.x||0;
    this.viewPitch=clamp(this.viewPitch+(lk.y||0),-.9,.9);

    const speed=2.4;

    const f=clamp(mv.f||0,-1,1);
    const r=clamp(mv.r||0,-1,1);

    const fx=Math.cos(this.viewYaw);
    const fz=-Math.sin(this.viewYaw);

    const rx=Math.sin(this.viewYaw);
    const rz=Math.cos(this.viewYaw);

    let nx=this.local.x+(fx*f+rx*r)*speed*dt;
    let nz=this.local.z+(fz*f+rz*r)*speed*dt;

    const minX=this.deck.minX+0.35;
    const maxX=this.deck.maxX-0.35;

    const minZ=-this.deck.halfW+0.25;
    const maxZ=this.deck.halfW-0.25;

    this.local.x=clamp(nx,minX,maxX);
    this.local.z=clamp(nz,minZ,maxZ);
    this.local.y=this.deck.y;

    if(Math.abs(f)+Math.abs(r)>0.05){
      this.walkPhase+=dt*7;
    }
  }
}

class GroundPlayer{
  constructor(vehicle,cm){
    this.world=new THREE.Vector3();
    this.viewYaw=vehicle._yawAngle;
    this.viewPitch=0;
    this.walkPhase=0;

    _v1.set(0,0,1).applyQuaternion(vehicle.orientation);
    this.world.copy(vehicle.position).addScaledVector(_v1,vehicle.collRadius+1.2);
    this.world.y=cm.getHeightAt(this.world.x,this.world.z);
  }

  canBoard(vehicle){
    return vehicle.onGround&&this.world.distanceToSquared(vehicle.position)<25;
  }

  update(dt,mv={f:0,r:0},lk={x:0,y:0},cm){
    this.viewYaw+=lk.x||0;
    this.viewPitch=clamp(this.viewPitch+(lk.y||0),-.9,.9);

    const f=clamp(mv.f||0,-1,1);
    const r=clamp(mv.r||0,-1,1);
    const fx=Math.cos(this.viewYaw);
    const fz=-Math.sin(this.viewYaw);
    const rx=Math.sin(this.viewYaw);
    const rz=Math.cos(this.viewYaw);

    _v1.set(
      this.world.x+(fx*f+rx*r)*4.2*dt,
      this.world.y,
      this.world.z+(fz*f+rz*r)*4.2*dt
    );

    const blocked=cm.getColliders(_v1,1).some(c=>_v1.distanceToSquared(c.position)<(c.radius+0.45)**2);

    if(!blocked)this.world.copy(_v1);
    this.world.y=cm.getHeightAt(this.world.x,this.world.z);

    if(Math.abs(f)+Math.abs(r)>0.05)this.walkPhase+=dt*10;
  }
}

function firePlayerBlaster(now){
  if(!battleSys||!walkMode||!player||now-lastPlayerShot<1000/SETTINGS.blasterFireRate)return;

  lastPlayerShot=now;
  camera.getWorldDirection(_v1);

  const spread=(1-SETTINGS.blasterAccuracy)*.24;
  _v1.x+=(Math.random()-.5)*spread;
  _v1.y+=(Math.random()-.5)*spread;
  _v1.z+=(Math.random()-.5)*spread;
  _v1.normalize();

  battleSys.firePlayerBlaster(camera.position,_v1,180,1);
}

function createViewArms(cam){
  const g=new THREE.Group();

  const m=new THREE.MeshStandardMaterial({
    color:0xe8c0a0,
    roughness:0.7
  });

  const geo=new THREE.BoxGeometry(0.08,0.08,0.55);

  const left=new THREE.Mesh(geo,m);

  left.position.set(-0.22,-0.28,-0.5);
  left.rotation.x=0.55;

  const right=left.clone();

  right.position.x=0.22;

  const blasterM=new THREE.MeshStandardMaterial({
    color:0x303944,
    emissive:0x1d6b94,
    emissiveIntensity:.8,
    metalness:.7,
    roughness:.35
  });
  const blaster=new THREE.Mesh(new THREE.BoxGeometry(.12,.12,.52),blasterM);
  blaster.position.set(.18,-.24,-.74);
  blaster.rotation.x=.18;

  g.add(left,right,blaster);

  g.visible=false;

  cam.add(g);

  return g;
}

async function init(){
  setText('load-text','Создание неба и текстур...');

  const tmp=new THREE.WebGLRenderer();
  const pm=new THREE.PMREMGenerator(tmp);

  pm.compileEquirectangularShader();

  const es=new THREE.Scene();

  es.add(new THREE.Mesh(
    new THREE.SphereGeometry(500,24,14),
    new THREE.ShaderMaterial({
      side:THREE.BackSide,
      vertexShader:'varying vec3 vW;void main(){vW=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:'varying vec3 vW;void main(){float h=normalize(vW).y;gl_FragColor=vec4(mix(vec3(.9,.94,.97),vec3(.45,.68,.88),pow(max(h,0.),.5)),1.);}'
    })
  ));

  envMap=pm.fromScene(es,.04).texture;

  pm.dispose();
  tmp.dispose();

  setText('load-text','Загрузка ландшафта...');

  if(SETTINGS.useModels){
    await Promise.all([
      assets.load(ASSET_BASE+'natural/Trees/Pine/Flat_Tree_Pine_large.glb'),
      assets.load(ASSET_BASE+'house/HouseBeams12.glb')
    ].map(p=>p.catch(()=>null)));
  }

  if('ontouchstart' in window || navigator.maxTouchPoints>0){
    bindTouch();
  }

  const b=el('load-bar');

  if(b)b.style.width='100%';

  showEl('loading','none');

  buildSettingsUI();
  updateHelp();
  buildWorldSelect();

  showEl('world-select','flex');

  animate();
}

function startGame(cfg){
  menuVisible=false;

  showEl('crash-screen','none');
  showEl('world-select','none');
  showEl('aircraft-select','none');

  showEl('hud','block');
  showEl('weather-panel','flex');
  showEl('controls-help','block');
  showEl('crosshair','block');
  showEl('minimap','block');
  showEl('radar','block');
  showEl('health-bar','block');

  setText('plane-name',cfg.name);
  setText('world-name',CURRENT_WORLD.name);

  if(!scene){
    scene=new THREE.Scene();

    camera=new THREE.PerspectiveCamera(70,innerWidth/innerHeight,.5,6000);
    camera.position.set(0,100,20);

    scene.add(camera);

    renderer=new THREE.WebGLRenderer({
      antialias:true,
      powerPreference:'high-performance'
    });

    renderer.setSize(innerWidth,innerHeight);
    renderer.setPixelRatio(Math.min(1.5,devicePixelRatio));

    renderer.shadowMap.enabled=SETTINGS.shadows;
    renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    renderer.shadowMap.autoUpdate=false;

    renderer.toneMapping=THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure=1.05;
    renderer.outputColorSpace=THREE.SRGBColorSpace;

    document.body.appendChild(renderer.domElement);

    window.addEventListener('resize',()=>{
      camera.aspect=innerWidth/innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(innerWidth,innerHeight);
    });

    skyDome=new SkyDome(scene);
    stormClouds=new StormClouds(scene);
    birds=new BirdFlock(scene,6);

    debris=new DebrisSystem(scene);
    dust=new DustSystem(scene);
    glints=new GlintSystem(scene);
    tracks=new TrackSystem(scene);

    viewArms=createViewArms(camera);

    el('settings-btn').onclick=toggleSettings;
  }

  terrain=new TerrainGenerator(CURRENT_WORLD,SETTINGS.worldSeed,SETTINGS.chunkSize);

  if(chunkManager){
    chunkManager.chunks.forEach(c=>{
      try{
        c.dispose();
      }catch(e){}
    });

    chunkManager.chunks.clear();
  }

  chunkManager=new ChunkManager(scene,terrain);
  chunkManager.chunkSize=SETTINGS.chunkSize;

  for(let dx=-SETTINGS.detailDistance;dx<=SETTINGS.detailDistance;dx++){
    for(let dz=-SETTINGS.detailDistance;dz<=SETTINGS.detailDistance;dz++){
      chunkManager.chunks.set(
        chunkManager.key(dx,dz),
        new Chunk(dx,dz,scene,terrain,2,SETTINGS.chunkSize,SETTINGS.chunkRes)
      );
    }
  }

  chunkManager.update(0,0);

  if(!weather)weather=new WeatherSystem(scene,camera,skyDome,stormClouds);

  weather.setWeather('clear');

  if(explosionSys){
    explosionSys.dispose();
    explosionSys=null;
  }

  explosionSys=new ExplosionSystem(scene,terrain);

  if(volcSys){
    volcSys.dispose();
    volcSys=null;
  }

  if(CURRENT_WORLD.id==='volcano'){
    volcSys=new VolcanoSystem(scene,terrain);
  }

  if(shaiHuludSys){
    shaiHuludSys.dispose();
    shaiHuludSys=null;
  }

  if(CURRENT_WORLD.id==='dune'){
    shaiHuludSys=new ShaiHuludSystem(scene,terrain);
  }

  if(battleSys){
    battleSys.dispose();
    battleSys=null;
  }

  if(CURRENT_WORLD.id==='dune'){
    battleSys=new BattleSystem(scene,terrain,explosionSys);
  }

  if(aircraft){
    scene.remove(aircraft.group);
    aircraft=null;
  }

  player=null;
  walkMode=false;
  playerFiring=false;

  if(viewArms)viewArms.visible=false;

  aircraft=new Aircraft(scene,cfg);
  aircraft.applyStartPos();

  chunkManager.update(aircraft.position.x,aircraft.position.z);

  if(aircraft.deck){
    player=new GondolaPlayer(aircraft.group,aircraft.deck);
  }

  chaseCam=new ChaseCamera(camera,aircraft);

  if(input)input.dispose();

  input=new InputManager(aircraft,weather);

  setText(
    'mode',
    cfg.ground?'ВОЖДЕНИЕ':
    cfg.waterOnly?'КАПИТАН':
    cfg.ornithopter?'ОРНИТОПТЕР':
    'ПИЛОТ'
  );

  setText(
    'gear',
    cfg.noGear?(
      cfg.waterOnly?'НЕТ(КАТЕР)':
      cfg.ground?'НЕТ(ДЖИП)':
      'НЕТ(ДИРИЖ/ОРНИ)'
    ):'▼'
  );

  updateHelp();

  runTests(terrain,aircraft,weather,chunkManager,birds);

  document.querySelectorAll('#weather-panel button[data-wx]').forEach(b=>{
    b.onclick=()=>{
      weather.setWeather(b.dataset.wx);
      input.syncButtons();
    };
  });

  el('cycle-btn').onclick=()=>{
    weather.timeOfDay=(weather.timeOfDay+.25)%1;
  };

  isGameRunning=true;
  lastTime=performance.now();
}

function walkCamera(dt){
  const pl=player;

  let eW;

  if(pl.world){
    eW=_v1.copy(pl.world);
    eW.y+=1.55;
  } else {
    aircraft.group.updateMatrixWorld();
    eW=aircraft.group.localToWorld(_v1.set(pl.local.x,pl.local.y+1.55,pl.local.z));
  }

  camera.position.copy(eW);

  const cp=Math.cos(pl.viewPitch);
  const sp=Math.sin(pl.viewPitch);

  const fx=Math.cos(pl.viewYaw);
  const fz=-Math.sin(pl.viewYaw);

  const dL=_v2.set(fx*cp,-sp,fz*cp);

  if(!pl.world)dL.transformDirection(aircraft.group.matrixWorld);

  camera.lookAt(eW.x+dL.x,eW.y+dL.y,eW.z+dL.z);

  if(viewArms){
    viewArms.position.y=Math.sin(pl.walkPhase)*.015;
    viewArms.rotation.z=Math.sin(pl.walkPhase*.5)*.02;
  }
}

const SAND_COL=new THREE.Color(0xd8b888);

function updateMinimap(){
  if(!aircraft || !chunkManager)return;

  const canvas=el('minimap-canvas');

  if(!canvas)return;

  const ctx=canvas.getContext('2d');

  ctx.fillStyle='rgba(10,15,10,0.8)';
  ctx.fillRect(0,0,150,150);

  const scale=0.5;
  const cx=75;
  const cy=75;

  ctx.fillStyle='#4a8';
  ctx.beginPath();
  ctx.arc(cx,cy,3,0,Math.PI*2);
  ctx.fill();

  for(const[key,c]of chunkManager.chunks){
    if(c.lod<2)continue;

    const dx=(c.cx*SETTINGS.chunkSize-aircraft.position.x)*scale;
    const dz=(c.cz*SETTINGS.chunkSize-aircraft.position.z)*scale;

    if(Math.abs(dx)<70 && Math.abs(dz)<70){
      ctx.fillStyle=c.colliders.length>0?'#a84':'#484';
      ctx.fillRect(cx+dx-2,cy+dz-2,4,4);
    }
  }

  if(shaiHuludSys && shaiHuludSys.worm){
    const dx=(shaiHuludSys.worm.x-aircraft.position.x)*scale;
    const dz=(shaiHuludSys.worm.z-aircraft.position.z)*scale;

    if(Math.abs(dx)<70 && Math.abs(dz)<70){
      ctx.fillStyle='#f44';
      ctx.beginPath();
      ctx.arc(cx+dx,cy+dz,4,0,Math.PI*2);
      ctx.fill();
    }
  }

  ctx.fillStyle='#ff4';
  ctx.beginPath();
  ctx.arc(cx,cy,4,0,Math.PI*2);
  ctx.fill();
}

function updateRadar(){
  if(!aircraft || !battleSys || !shaiHuludSys)return;

  const canvas=el('radar-canvas');

  if(!canvas)return;

  const ctx=canvas.getContext('2d');

  ctx.fillStyle='rgba(10,20,10,0.8)';
  ctx.fillRect(0,0,120,120);

  const cx=60;
  const cy=60;
  const scale=0.3;

  if(shaiHuludSys.worm){
    const w=shaiHuludSys.worm;

    const dx=(w.x-aircraft.position.x)*scale;
    const dz=(w.z-aircraft.position.z)*scale;

    if(Math.abs(dx)<55 && Math.abs(dz)<55){
      ctx.fillStyle='#f44';
      ctx.beginPath();
      ctx.arc(cx+dx,cy+dz,4,0,Math.PI*2);
      ctx.fill();
    }
  }

  for(const b of battleSys.battles){
    const dx=(b.center.x-aircraft.position.x)*scale;
    const dz=(b.center.z-aircraft.position.z)*scale;

    if(Math.abs(dx)<55 && Math.abs(dz)<55){
      ctx.fillStyle='#ff4';
      ctx.fillRect(cx+dx-3,cy+dz-3,6,6);
    }
  }

  ctx.fillStyle='#4f4';
  ctx.beginPath();
  ctx.arc(cx,cy,3,0,Math.PI*2);
  ctx.fill();
}

function animate(){
  requestAnimationFrame(animate);

  const now=performance.now();

  const dt=Math.min(.05,(now-lastTime)/1000);

  lastTime=now;

  const t=now/1000;

  animatePreviews();

  windUniforms.uTime.value=t;
  windUniforms.uStr.value=SETTINGS.windStrength;

  const wa=SETTINGS.windDir*Math.PI/180;

  windUniforms.uDir.value.set(Math.cos(wa),Math.sin(wa));

  const wind=windVec();

  if(isGameRunning && aircraft && renderer){
    const ta=touch.left.id!==-1 || touch.right.id!==-1;

    if(!walkMode){
      input.update();

      if(ta){
        if(aircraft.config.waterOnly || aircraft.config.ground){
          aircraft.input.pitch=clamp(-touch.left.y,-1,1);
          aircraft.input.roll=clamp(touch.left.x+touch.right.x,-1,1);
          aircraft.input.yaw=0;
        } else {
          aircraft.input.pitch=clamp(aircraft.input.pitch-touch.left.y,-1,1);
          aircraft.input.roll=clamp(aircraft.input.roll+touch.left.x,-1,1);
          aircraft.input.yaw=clamp(aircraft.input.yaw+touch.right.x,-1,1);
          aircraft.throttle=clamp(aircraft.throttle-touch.right.y*dt*.8,0,1);
        }
      }
    } else {
      aircraft.input.pitch=aircraft.input.roll=aircraft.input.yaw=0;
    }

    if(walkMode && player){
      const w=input.wasd();

      const mv={
        f:clamp(w.f-touch.left.y,-1,1),
        r:clamp(w.r+touch.left.x,-1,1)
      };

      const lk={
        x:-touch.right.x*dt*2.4,
        y:touch.right.y*dt*1.6
      };

      player.update(dt,mv,lk,chunkManager);
    }

    if(!walkMode||!player||!player.world)aircraft.update(dt,chunkManager,t,wind);

    if(playerFiring)firePlayerBlaster(now);

    const focusPosition=walkMode&&player&&player.world?player.world:aircraft.position;

    chunkManager.update(focusPosition.x,focusPosition.z);
    chunkManager.processQueue(CHUNKS_PER_FRAME);

    const pcx=Math.floor(focusPosition.x/chunkManager.chunkSize);
    const pcz=Math.floor(focusPosition.z/chunkManager.chunkSize);

    chunkManager.updateChunks(
      dt,
      t,
      weather.getMistFactor(weather.timeOfDay)*SETTINGS.mistDensity,
      pcx,
      pcz
    );

    if(volcSys)volcSys.update(dt,t,focusPosition,wind);
    if(explosionSys)explosionSys.update(dt);
    if(shaiHuludSys)shaiHuludSys.update(dt,t,focusPosition);
    if(battleSys)battleSys.update(dt,t,focusPosition);

    if(debris)debris.update(dt);
    if(tracks)tracks.update(dt);

    if(dust && CURRENT_WORLD.id==='desert' && !aircraft.crashed && !aircraft.config.waterOnly){
      const gH=chunkManager.getHeightAt(aircraft.position.x,aircraft.position.z);

      const lowAlt=aircraft.config.ground?0:(aircraft.position.y-gH);

      if(
        (aircraft.config.ground && Math.abs(aircraft.speed)>8) ||
        (!aircraft.config.ground && lowAlt<12 && aircraft.speed>15)
      ){
        dust.emit(aircraft.position,SAND_COL,2,wind);
      }
    }

    if(dust)dust.update(dt);

    weather.update(dt,focusPosition);
    birds.update(dt,t,focusPosition,wind);

    if(walkMode && player)walkCamera(dt);
    else chaseCam.update(dt);

    if(glints && !aircraft.crashed){
      const an=(weather.timeOfDay-.25)*Math.PI*2;

      const sunPos=_v4.set(
        aircraft.position.x+Math.cos(an)*400,
        Math.sin(an)*400,
        aircraft.position.z+80
      );

      glints.update(camera.position,sunPos,aircraft,WATER_LEVEL);
    } else if(glints){
      glints.waterGlint.material.opacity=0;
      glints.planeGlint.material.opacity=0;
    }

    shadowTick++;

    if(shadowTick%20===0)renderer.shadowMap.needsUpdate=true;

    const gr=chunkManager.getHeightAt(aircraft.position.x,aircraft.position.z);

    setText('alt',Math.max(0,Math.round(aircraft.position.y-gr))+' м');
    setText('spd',Math.round(aircraft.getSpeed())+' км/ч');
    setText('wind',SETTINGS.windStrength.toFixed(0)+' м/с');
    setText('thr',Math.round(aircraft.throttle*100)+'%');
    setText('time',weather.getTimeString());
    setText('wx',weather.getWeatherName());
    setText('chunks',chunkManager.chunks.size);
    setText('health',Math.round(aircraft.health)+'%');

    const healthFill=el('health-fill');

    if(healthFill)healthFill.style.width=aircraft.health+'%';

    renderer.render(scene,camera);

    fpsAcc+=dt;
    fpsCount++;

    if(fpsAcc>=.5){
      setText('perf',Math.round(fpsCount/fpsAcc)+'/'+renderer.info.render.calls);

      fpsAcc=0;
      fpsCount=0;
    }

    if(fpsCount%30===0){
      updateMinimap();
      updateRadar();
    }
  }
}

init().catch(e=>{
  console.error(e);
  setText('load-text','ОШИБКА: '+e.message);
});
