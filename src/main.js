import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

const $=s=>document.querySelector(s), canvas=$('#gameCanvas');
const scene=new THREE.Scene(); scene.background=new THREE.Color(0x13272d); scene.fog=new THREE.Fog(0x13272d,18,52);
const camera=new THREE.PerspectiveCamera(55,innerWidth/innerHeight,.1,100); camera.position.set(0,8,12);
const renderer=new THREE.WebGLRenderer({canvas,antialias:true}); renderer.setSize(innerWidth,innerHeight); renderer.setPixelRatio(Math.min(devicePixelRatio,2)); renderer.shadowMap.enabled=true;
scene.add(new THREE.HemisphereLight(0xbcecff,0x263329,2)); const sun=new THREE.DirectionalLight(0xffffff,2.5);sun.position.set(-8,18,10);sun.castShadow=true;scene.add(sun);

const chars={camera:{name:'CAMERAMAN',health:100,damage:25,speed:85,color:0xb7c5c7,skill:null},speaker:{name:'SPEAKERMAN',health:90,damage:22,speed:95,color:0xd3d7d5,skill:'SOUNDWAVE'},tv:{name:'TVMAN',health:110,damage:20,speed:75,color:0x86dcf2,skill:'BLUE SCREEN'}};
let selected='camera', playing=false, enemies=[], effects=[], score=0, wave=1, hp=100, move={x:0,z:0}, cooldown=0, skillActive=0, punchTime=0;

function mat(c,rough=.7){return new THREE.MeshStandardMaterial({color:c,roughness:rough})}
function makeUnit(type,enemy=false){const g=new THREE.Group(); const dark=mat(0x17272b), suit=mat(enemy?0x9f9b73:type=== 'tv'?0x86c8d9:0x9ba9aa);
 const body=new THREE.Mesh(new THREE.BoxGeometry(.9,1.15,.55),suit);body.position.y=1.65;body.castShadow=true;g.add(body);
 const head=new THREE.Mesh(new THREE.BoxGeometry(.95,.82,.72),suit);head.position.y=2.55;head.castShadow=true;if(type==='tv'){head.geometry=new THREE.BoxGeometry(1.05,.82,.48);const screen=new THREE.Mesh(new THREE.PlaneGeometry(.72,.48),mat(enemy?0x161616:0x29bfe3));screen.position.set(0,0,.255);head.add(screen)}else if(type==='speaker'){head.geometry=new THREE.CylinderGeometry(.5,.5,.38,20);head.rotation.x=Math.PI/2;const cone=new THREE.Mesh(new THREE.CylinderGeometry(.36,.36,.18,20),mat(0x20292b));cone.rotation.x=Math.PI/2;cone.position.z=.24;head.add(cone)}else{head.geometry=new THREE.BoxGeometry(.78,.72,.65);const lens=new THREE.Mesh(new THREE.CylinderGeometry(.19,.19,.08,16),mat(0x071013,0));lens.rotation.x=Math.PI/2;lens.position.z=.36;head.add(lens)}g.add(head);
 for(const x of [-.32,.32]){const leg=new THREE.Mesh(new THREE.BoxGeometry(.38,.85,.42),dark);leg.position.set(x,.55,0);leg.castShadow=true;g.add(leg)}
 g.userData={head,body};return g}

const ground=new THREE.Mesh(new THREE.PlaneGeometry(50,50),mat(0x4c5d58));ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene.add(ground);
for(let i=-20;i<=20;i+=4){const road=new THREE.Mesh(new THREE.BoxGeometry(.08,.02,50),mat(i%8===0?0x67766e:0x596963));road.position.set(i,.01,0);scene.add(road)}
for(let i=0;i<22;i++){const x=(i%2?1:-1)*(6+(i%5)*2.4),z=-20+(i*3)%40;const c=new THREE.Mesh(new THREE.BoxGeometry(1.7,2.8+(i%3),1.7),mat(i%3?0x667a78:0x526866));c.position.set(x,1.4,z);c.castShadow=true;c.receiveShadow=true;scene.add(c)}
const player=makeUnit(selected);scene.add(player);

function spawnEnemy(){const e=makeUnit('camera',true);e.scale.set(.95,.95,.95);e.position.set((Math.random()*2-1)*15,0,-10-Math.random()*12);e.userData.health=80+(wave-1)*18;e.userData.glasses=Math.random()<.55; if(e.userData.glasses){const glass=new THREE.Mesh(new THREE.BoxGeometry(.85,.25,.04),new THREE.MeshBasicMaterial({color:0x3de9ff,transparent:true,opacity:.65}));glass.position.set(0,2.55,.38);e.add(glass)}scene.add(e);enemies.push(e)}
function clearArena(){enemies.forEach(e=>scene.remove(e));enemies=[]}

function setRace(r){selected=r;const p=$('#previewUnit');p.className='unit '+(r==='speaker'?'speaker-preview':r==='tv'?'tv-preview':'camera-preview');const c=chars[r];$('#raceTitle').textContent=r==='camera'?'RACE 01':r==='speaker'?'RACE 02':'RACE 03';$('#unitName').textContent=c.name;$('#healthVal').textContent=c.health;$('#damageVal').textContent=c.damage;$('#speedVal').textContent=c.speed;$('#healthBar').style.width=c.health+'%';$('#damageBar').style.width=c.damage*3+'%';$('#speedBar').style.width=c.speed+'%';$('#abilityInfo').innerHTML=c.skill?`<small>SPECIAL · ${r==='speaker'?'CD 15 SEC':'CD 25 SEC'}</small><b>${c.skill}</b><p>${r==='speaker'?'50 damage · AOE · 4 seconds':'Stuns enemies without glasses · 6 seconds'}</p>`:'<small>SPECIAL</small><b>NO SPECIAL SKILL</b><p>Balanced fighter with fast attacks.</p>'}

$('#characterBtn').onclick=()=>{show('character')};document.querySelectorAll('[data-back]').forEach(b=>b.onclick=()=>show(b.dataset.back));document.querySelectorAll('.race').forEach(b=>b.onclick=()=>{document.querySelectorAll('.race').forEach(x=>x.classList.remove('active'));b.classList.add('active');setRace(b.dataset.race)});
$('#selectBtn').onclick=()=>show('lobby');
$('#playBtn').onclick=startGame;$('#leaveBtn').onclick=()=>{playing=false;clearArena();show('lobby')};
function show(id){document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));$('#'+id).classList.add('active');canvas.style.visibility=id==='hud'?'visible':'hidden'}

function startGame(){clearArena();scene.remove(player);Object.assign(player,makeUnit(selected)); // replace via clone contents not object
 while(player.children.length)player.remove(player.children[0]);const fresh=makeUnit(selected);fresh.children.forEach(c=>player.add(c));
 player.position.set(0,0,8);score=0;wave=1;hp=chars[selected].health;cooldown=0;skillActive=0;for(let i=0;i<4;i++)spawnEnemy();playing=true;show('hud');$('#hudName').textContent=chars[selected].name;updateHp();updateUI()}

function updateHp(){ $('#hpFill').style.width=Math.max(0,hp/chars[selected].health*100)+'%'}
function updateUI(){ $('#score').textContent=score;$('#waveNum').textContent=wave;const b=$('#cooldown');if(cooldown>0){b.style.opacity=1;b.textContent=Math.ceil(cooldown)}else b.style.opacity=0}

function punch(){if(!playing)return;punchTime=.18;let hit=false;enemies.forEach(e=>{if(e.position.distanceTo(player.position)<2.1){e.userData.health-=chars[selected].damage;hit=true}});if(hit){$('#hitmarker').classList.add('show');setTimeout(()=>$('#hitmarker').classList.remove('show'),100)}}
$('#punchBtn').onclick=punch;$('#gamePunch').onclick=punch;
function skill(){if(!playing||cooldown>0||selected==='camera')return;const type=selected;if(type==='speaker'){cooldown=15;skillActive=4;effects.push({type:'sound',time:4,mesh:makeWave(player.position,0xd6ecff)})}else{cooldown=25;skillActive=6;effects.push({type:'blue',time:6,mesh:makeBlue(player.position)})}}
$('#skillBtn').onclick=skill;
function makeWave(pos,color){const ring=new THREE.Mesh(new THREE.RingGeometry(.5,.8,32),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.75,side:THREE.DoubleSide}));ring.rotation.x=-Math.PI/2;ring.position.copy(pos);ring.position.y=.12;scene.add(ring);return ring}
function makeBlue(pos){const light=new THREE.PointLight(0x4ecaff,6,12);light.position.set(pos.x,pos.y+2,pos.z);scene.add(light);const cone=new THREE.Mesh(new THREE.CylinderGeometry(.2,4,7,32,1,true),new THREE.MeshBasicMaterial({color:0x66d7ff,transparent:true,opacity:.16,side:THREE.DoubleSide}));cone.position.set(pos.x,3.5,pos.z);scene.add(cone);cone.userData.light=light;return cone}

const keys={};addEventListener('keydown',e=>{keys[e.key.toLowerCase()]=true;if(e.code==='Space')punch();if(e.key==='e'||e.key==='E')skill()});addEventListener('keyup',e=>keys[e.key.toLowerCase()]=false);
const joy=$('#joystick'),stick=$('#stick');let joyActive=false;joy.addEventListener('pointerdown',e=>{joyActive=true;joy.setPointerCapture(e.pointerId)});joy.addEventListener('pointermove',e=>{if(!joyActive)return;const r=joy.getBoundingRect(),dx=e.clientX-(r.left+r.width/2),dy=e.clientY-(r.top+r.height/2),len=Math.min(38,Math.hypot(dx,dy)),a=Math.atan2(dy,dx);move.x=Math.cos(a)*len/38;move.z=Math.sin(a)*len/38;stick.style.transform=`translate(${Math.cos(a)*len}px,${Math.sin(a)*len}px)`});joy.addEventListener('pointerup',()=>{joyActive=false;move.x=move.z=0;stick.style.transform='translate(0,0)'})

let last=performance.now();function animate(now){requestAnimationFrame(animate);const dt=Math.min(.035,(now-last)/1000);last=now;
 if(playing){let mx=(keys.d||keys.arrowright?1:0)-(keys.a||keys.arrowleft?1:0)+move.x,mz=(keys.s||keys.arrowdown?1:0)-(keys.w||keys.arrowup?1:0)+move.z;const l=Math.hypot(mx,mz);if(l>1){mx/=l;mz/=l}player.position.x+=mx*chars[selected].speed*.045*dt*6;player.position.z+=mz*chars[selected].speed*.045*dt*6;player.position.x=Math.max(-18,Math.min(18,player.position.x));player.position.z=Math.max(-20,Math.min(18,player.position.z));if(l>.05)player.rotation.y=Math.atan2(mx,mz);
 if(punchTime>0){punchTime-=dt;player.rotation.x=-.12}else player.rotation.x=0;
 if(cooldown>0)cooldown-=dt;skillActive=Math.max(0,skillActive-dt);updateUI();
 enemies.forEach((e,i)=>{if(e.userData.health<=0){scene.remove(e);enemies.splice(i,1);score+=100;return}const stunned=effects.some(f=>f.type==='blue'&&f.time>0&&e.position.distanceTo(player.position)<5.5&&!e.userData.glasses);if(!stunned){const d=e.position.clone().sub(player.position);d.y=0;if(d.length()>1.1){d.normalize();e.position.addScaledVector(d,-dt*.9);e.rotation.y=Math.atan2(d.x,d.z)}else if(Math.random()<dt*.7){hp-=4;updateHp();if(hp<=0){hp=0;updateHp();playing=false;setTimeout(()=>{clearArena();show('lobby')},700)}}}});
 if(enemies.length===0){wave++;$('#waveNotice').animate([{opacity:0,transform:'translateX(-50%) scale(.5)'},{opacity:1,transform:'translateX(-50%) scale(1)'},{opacity:0}],700);for(let i=0;i<4+wave;i++)spawnEnemy()}
 effects.forEach((f,fi)=>{f.time-=dt;if(f.type==='sound'){f.mesh.scale.multiplyScalar(1+dt*3);f.mesh.material.opacity=Math.max(0,f.time/4);enemies.forEach(e=>{if(e.position.distanceTo(player.position)<f.mesh.scale.x*2.2)e.userData.health-=50*dt*.55})}else{f.mesh.scale.set(1,1+Math.sin(now*.02)*.04,1);f.mesh.material.opacity=.12+Math.sin(now*.012)*.05}if(f.time<=0){scene.remove(f.mesh);if(f.mesh.userData.light)scene.remove(f.mesh.userData.light);effects.splice(fi,1)}});
 }
 camera.position.lerp(new THREE.Vector3(player.position.x,7.2,player.position.z+10),.08);camera.lookAt(player.position.x,1.5,player.position.z);renderer.render(scene,camera)}
setRace('camera');show('lobby');animate(performance.now());
