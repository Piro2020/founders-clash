import {FOUNDERS} from './founders.js';
import {SPRITE_FRAMES,SPRITE_FRAMES_B,SPRITE_FRAMES_C} from './sprite-frames.js';
const sheets=[],sheetsB=[],sheetsC=[],stages=[],sprites=[],portraits=[];
const loadImage=src=>new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error(`画像を読み込めません: ${src}`));img.src=src;});
// Optional art never blocks start-up: 404 or a stalled request (3 s) both resolve to null.
const loadOptional=src=>Promise.race([loadImage(src).catch(()=>null),new Promise(resolve=>setTimeout(()=>resolve(null),3000))]);
const pad=n=>String(n).padStart(2,'0');
const poly=(c,points,color)=>{c.fillStyle=color;c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fill();};
const rect=(c,x,y,w,h,color)=>{c.fillStyle=color;c.fillRect(x,y,w,h);};
function extractSprite(image,frame){
  const {x,y,w,h}=frame,temp=document.createElement('canvas');temp.width=w;temp.height=h;
  const tc=temp.getContext('2d',{willReadFrequently:true});tc.drawImage(image,x,y,w,h,0,0,w,h);
  const pixels=tc.getImageData(0,0,w,h),mask=new Uint8Array(w*h),stack=new Int32Array(w*h);let largest=[];const parts=[];
  for(let p=0;p<mask.length;p++)mask[p]=pixels.data[p*4+3]>40?1:0;
  // Isolate the figure: keep the largest blob plus detached parts (energy balls, sleeves) that sit fully inside the frame;
  // drop anything touching the frame edge, which is a neighbouring sprite's limb.
  for(let start=0;start<mask.length;start++){
    if(!mask[start])continue;let size=1;stack[0]=start;mask[start]=0;const component=[];let edge=false;
    while(size){const p=stack[--size];component.push(p);const xx=p%w,yy=(p-xx)/w;if(xx<3||yy<3||xx>=w-3||yy>=h-3)edge=true;
      for(const q of [p-w,p+w,xx?p-1:-1,xx<w-1?p+1:-1])if(q>=0&&q<mask.length&&mask[q]){mask[q]=0;stack[size++]=q;}
    }
    if(component.length>largest.length)largest=component;
    if(!edge&&component.length>=60)parts.push(component);
  }
  for(const part of parts)if(part!==largest&&part.length<largest.length)largest=largest.concat(part);
  const keep=new Uint8Array(w*h);
  for(const p of largest)for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
    const xx=p%w+dx,yy=Math.floor(p/w)+dy;if(xx>=0&&xx<w&&yy>=0&&yy<h)keep[yy*w+xx]=1;
  }
  for(let p=0;p<keep.length;p++)if(!keep[p])pixels.data[p*4+3]=0;
  tc.putImageData(pixels,0,0);return{image:temp,x:0,y:0,w,h};
}
// Atlas columns: A = founders-NN (required), B/C = founders-b-NN / founders-c-NN (optional, may 404).
const ATLAS_COLS=[['idle','punch','kick'],['crouch','hurt','jumpKick'],['special','victory','down']];
const POSE_SPRITE={idle:'idle',walk:'idle',block:'idle',jump:'idle',crouch:'crouch',crouchBlock:'crouch',crouchLight:'crouch',sweep:'crouch',light:'punch',heavy:'kick',jumpKick:'jumpKick',special:'special',super:'special',hurt:'hurt',down:'down',victory:'victory'};
const FALLBACK={crouch:'idle',hurt:'idle',jumpKick:'kick',special:'punch',victory:'idle',down:'idle'};
const ANCHOR={idle:.5,punch:.34,kick:.30,crouch:.5,hurt:.5,jumpKick:.36,special:.38,victory:.5};
export async function loadVisuals(onProgress=()=>{}){
  // Optional files count as settled whether they load or 404, so the counter always reaches its total.
  let done=0;const total=16,tick=()=>onProgress(++done,total),tasks=[];
  for(let i=0;i<4;i++){
    tasks.push(loadImage(`./assets/founders-${pad(i+1)}.webp`).then(img=>{sheets[i]=img;tick();}));
    tasks.push(loadOptional(`./assets/founders-b-${pad(i+1)}.webp`).then(img=>{sheetsB[i]=img;tick();}));
    tasks.push(loadOptional(`./assets/founders-c-${pad(i+1)}.webp`).then(img=>{sheetsC[i]=img;tick();}));
    const stageSrc=`./assets/stage-${pad(i+1)}.webp`;tasks.push((i<3?loadImage(stageSrc):loadOptional(stageSrc)).then(img=>{stages[i]=img;tick();}));
  }
  await Promise.all(tasks);
  for(let i=0;i<20;i++){
    const sheet=Math.floor(i/5),row=i%5,set={};
    [[sheets,SPRITE_FRAMES],[sheetsB,SPRITE_FRAMES_B],[sheetsC,SPRITE_FRAMES_C]].forEach(([images,frames],atlas)=>{
      const image=images[sheet],cells=frames?.[sheet]?.[row];if(!image||!cells)return;
      ATLAS_COLS[atlas].forEach((key,col)=>{if(!cells[col])return;try{set[key]=extractSprite(image,cells[col]);}catch(error){if(!atlas)throw error;}});
    });
    sprites[i]=set;
    const portrait=document.createElement('canvas');portrait.width=240;portrait.height=260;drawPortrait(portrait.getContext('2d'),FOUNDERS[i],240,260);portraits[i]=portrait;
  }
}
export function drawPortrait(c,data,width,height){
  const sprite=sprites[data.id]?.idle;if(!sprite)return;c.save();c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';const imageH=height*2.65,imageW=imageH*sprite.w/sprite.h;
  c.drawImage(sprite.image,sprite.x,sprite.y,sprite.w,sprite.h,(width-imageW)/2,3,imageW,imageH);c.restore();
}
// Older engine builds have no `pose`; derive one so the renderer still works.
function legacyPose(s){const a=s.attack;if(s.hp===0)return'down';if(s.stun>0)return'hurt';if(a)return a.kind==='heavy'?'heavy':a.kind==='special'?'special':'light';if(s.grounded===false)return'jump';if(s.block)return'block';return Math.abs(s.vx||0)>30?'walk':'idle';}
const reducedMotion=typeof matchMedia==='function'?matchMedia('(prefers-reduced-motion: reduce)'):{matches:false};
export function drawFounder(c,data,x,y,scale=1.7,facing=1,state={}){
  const set=sprites[data.id];if(!set?.idle)return;
  const pose=state.pose||legacyPose(state),a=state.attack,progress=a?a.time/(a.duration||1):0,active=!!a&&progress>.18&&progress<.78;
  let key=POSE_SPRITE[pose]||'idle';
  if((pose==='light'||pose==='heavy')&&a&&!active)key='idle'; // wind-up / recovery show the stance
  const crouching=['crouch','crouchBlock','crouchLight','sweep'].includes(pose);
  if(active&&pose==='crouchLight')key='punch';if(active&&pose==='sweep')key='kick'; // low strikes: squashed strike frame
  const real=!!set[key];let spriteKey=real?key:FALLBACK[key]||'idle';
  const sprite=set[spriteKey]||set.idle,time=state.time||0,squash=crouching&&spriteKey!=='crouch';
  // Real crouch keeps its natural aspect at idle's pixel scale (atlas figure height ratio), so it is drawn shorter.
  let height=122*scale*(spriteKey==='crouch'?sprite.h/set.idle.h:1),width=height*sprite.w/sprite.h;
  c.save();c.translate(x,y);c.scale(facing,1);c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';
  if(key==='down'){
    // Horizontal pose: centre on x, bottom on the floor.
    if(real){width=122*scale*1.1;height=width*sprite.h/sprite.w;const cx=Math.max(width/2+6,Math.min(960-width/2-6,x));c.translate((cx-x)*facing,0);c.drawImage(sprite.image,sprite.x,sprite.y,sprite.w,sprite.h,-width/2,-height,width,height);}
    else{c.translate(height/2,-width/2);c.rotate(-Math.PI/2);c.drawImage(sprite.image,sprite.x,sprite.y,sprite.w,sprite.h,-width/2,-height,width,height);}
    c.restore();return;
  }
  const moving=pose==='walk',airborne=state.grounded===false||pose==='jump'||pose==='jumpKick';
  const stride=(state.walk||time*9)*1.2;c.translate(0,moving?-Math.abs(Math.sin(stride))*3:pose==='idle'||pose==='block'?Math.sin(time*2.8+data.id)*1.25:0);
  if(squash)c.scale(1,.72);
  if(pose==='hurt'){if(!real){c.rotate(-.16);c.translate(-8,0);}c.filter='brightness(1.7) sepia(.3)';}
  else if(airborne)c.rotate(pose==='jumpKick'?(real?0:.12):(state.vy||0)<0?-.1:.06);
  else if(moving&&!a)c.rotate(.052*(Math.sign(state.vx||0)*facing||1)); // ~3° lean toward the direction of travel
  if((pose==='crouchLight'||pose==='sweep')&&active)c.translate(pose==='sweep'?14:8,0);
  if(pose==='victory'){if(!real)c.translate(0,-Math.abs(Math.sin(time*3.2))*7);c.filter='drop-shadow(0 0 10px #ffd15c)';}
  else if(pose==='super')c.filter=`drop-shadow(0 0 14px ${data.color})`;
  if(pose==='block'||pose==='crouchBlock'||(!state.pose&&state.block)){c.scale(.97,.97);c.filter='drop-shadow(0 0 7px #81d4ff)';}
  c.drawImage(sprite.image,sprite.x,sprite.y,sprite.w,sprite.h,-width*(ANCHOR[spriteKey]??.5),-height,width,height);
  c.filter='none';c.restore();
}
const FALLBACK_SKY=[['#2a1b24','#6a3529'],['#0b1230','#2c2a55'],['#2b1f33','#7a4561'],['#1d0d17','#82391c']];
export function drawStage(c,index,time){
  c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';
  if(stages[index])c.drawImage(stages[index],0,0,960,480);
  else{const [top,bottom]=FALLBACK_SKY[index]||FALLBACK_SKY[0],g=c.createLinearGradient(0,0,0,480);g.addColorStop(0,top);g.addColorStop(.8,bottom);g.addColorStop(.805,'#1b1219');g.addColorStop(1,'#09080d');c.fillStyle=g;c.fillRect(0,0,960,480);rect(c,0,386,960,2,'#ffffff22');}
  const shade=c.createLinearGradient(0,0,0,170);shade.addColorStop(0,'#080916d9');shade.addColorStop(1,'#08091600');c.fillStyle=shade;c.fillRect(0,0,960,170);
  if(index===2){c.save();c.globalAlpha=.8;for(let i=0;i<16;i++){const x=(i*89+time*(13+i%5))%980,y=(i*37+time*22)%450;c.fillStyle=i%2?'#ffdfd6':'#f6a9ac';c.beginPath();c.ellipse(x,y,3.5,1.6,time+i,0,Math.PI*2);c.fill();}c.restore();}
  if(index===3){c.save();c.globalCompositeOperation='lighter';for(let i=0;i<3;i++){const sx=160+i*320,swing=Math.sin(time*.9+i*2.1)*190,g=c.createLinearGradient(sx,0,sx+swing,392);g.addColorStop(0,'#ffe7a855');g.addColorStop(1,'#ffb35c00');c.fillStyle=g;poly(c,[[sx-10,0],[sx+10,0],[sx+swing+90,392],[sx+swing-90,392]],g);}c.restore();}
}
function bar(c,x,y,width,hp,reversed){
  poly(c,[[x-4,y-3],[x+width+9,y-3],[x+width+3,y+22],[x-10,y+22]],'#1a1222');
  poly(c,[[x-2,y-1],[x+width+6,y-1],[x+width+1,y+20],[x-7,y+20]],'#c7aa83');
  rect(c,x,y,width,18,'#3e2035');
  const w=width*hp/100,g=c.createLinearGradient(0,y,0,y+18);g.addColorStop(0,hp<25?'#ffa163':'#fff697');g.addColorStop(.5,hp<25?'#f75b35':'#ffd55a');g.addColorStop(1,hp<25?'#b82331':'#d59b24');c.fillStyle=g;c.fillRect(reversed?x+width-w:x,y,w,18);
  rect(c,x,y,width,2,'#fff3');
}
export function drawHUD(c,m,preview=false,time=0){
  c.save();c.textBaseline='top';
  for(let i=0;i<2;i++){
    const f=m.fighters[i],left=i===0,x=left?31:535,w=393;
    c.font='900 italic 21px "Noto Sans JP",sans-serif';c.textAlign=left?'left':'right';c.fillStyle='#fff2ce';c.strokeStyle='#131221';c.lineWidth=3;c.strokeText(f.data.name,left?x:x+w,13);c.fillText(f.data.name,left?x:x+w,13);
    c.font='10px "Noto Sans JP",sans-serif';c.fillStyle='#dfbd97';c.fillText(f.data.school,left?x:x+w,43);
    bar(c,x,62,w,f.hp,!left);
    for(let j=0;j<2;j++){const xx=left?x+12+j*19:x+w-12-j*19;c.fillStyle=m.wins[i]>j?'#ffd65f':'#9b829055';c.beginPath();c.arc(xx,95,5,0,Math.PI*2);c.fill();}
    if(preview)continue;
    const mx=left?32:681,mw=246,ready=f.meter>=100,special=f.meter>=25,pulse=.5+.5*Math.sin(time*9);
    poly(c,[[mx-5,428],[mx+mw+6,428],[mx+mw,446],[mx-11,446]],'#070b18');rect(c,mx,431,mw,10,'#32334a');
    const g=c.createLinearGradient(mx,0,mx+mw,0);
    if(ready){g.addColorStop(0,'#d9851f');g.addColorStop(.5,pulse>.5?'#fff3a6':'#ffd04f');g.addColorStop(1,'#ffb43a');}else{g.addColorStop(0,'#3743cc');g.addColorStop(1,special?'#7eddf8':'#8b98dd');}
    c.fillStyle=g;const fill=mw*Math.min(100,f.meter)/100;c.fillRect(left?mx:mx+mw-fill,431,fill,10);rect(c,left?mx+mw*.25:mx+mw*.75,429,2,15,'#f7ebc3');
    if(ready){c.save();c.shadowColor='#ffcf4a';c.shadowBlur=8+12*pulse;c.strokeStyle=`rgba(255,222,120,${.45+.55*pulse})`;c.lineWidth=2;c.strokeRect(mx-1.5,429.5,mw+3,13);c.restore();}
    c.font='bold italic 11px "Barlow Condensed","Noto Sans JP",sans-serif';c.fillStyle=ready?(pulse>.5?'#fff0a0':'#ffc24a'):special?'#c4ebff':'#aaa7c6';c.textAlign=left?'left':'right';
    c.fillText(ready?'超必殺 READY  /  信念解放・極':special?'信念解放  /  SPECIAL READY':'信念  /  CHARGING',left?mx:mx+mw,453);
  }
  poly(c,[[440,6],[519,6],[527,77],[432,77]],'#211725');poly(c,[[444,9],[515,9],[521,73],[438,73]],'#7c5346');poly(c,[[447,12],[512,12],[517,70],[442,70]],'#15121f');
  c.textAlign='center';c.fillStyle='#fff1b9';c.shadowColor='#fb8e35';c.shadowBlur=7;c.font='900 italic 49px "Barlow Condensed",monospace';c.fillText(preview?'∞':String(Math.max(0,Math.ceil(m.timer))).padStart(2,'0'),480,11);c.shadowBlur=0;c.font='700 10px "Barlow Condensed",sans-serif';c.fillStyle='#f3c18c';c.fillText(preview?'EXHIBITION':`ROUND ${m.round}`,480,82);c.restore();
}
function energy(c,p,time){
  c.save();c.translate(p.x,p.y);c.scale(Math.sign(p.vx),1);const radius=p.super?54:p.type==='wave'?35:25;
  c.globalCompositeOperation='lighter';c.shadowColor=p.color;c.shadowBlur=25;const g=c.createRadialGradient(0,0,2,0,0,radius*1.4);g.addColorStop(0,'#fffadf');g.addColorStop(.2,p.color);g.addColorStop(1,p.color+'00');c.fillStyle=g;c.beginPath();c.ellipse(-8,0,radius*1.8,radius,0,0,Math.PI*2);c.fill();
  for(let i=0;i<5;i++){c.strokeStyle=i%2?'#fff6c5':p.color;c.lineWidth=2+i%2;c.beginPath();c.moveTo(-80+i*9,Math.sin(time*24+i)*20);c.quadraticCurveTo(-10,Math.cos(time*20+i)*26,26,0);c.stroke();}
  c.fillStyle='#fff9db';c.beginPath();c.ellipse(9,0,13,21,0,0,Math.PI*2);c.fill();c.restore();
}
function cutin(c,m,visual){
  const cut=visual.cutin;if(!cut||cut.life<=0)return;const f=m.fighters[cut.index];const progress=1-cut.life/cut.duration,alpha=Math.min(1,progress*7,cut.life*5);const left=cut.index===0;
  c.save();c.globalAlpha=alpha;const y=116,h=107;
  const g=c.createLinearGradient(0,0,960,0);g.addColorStop(0,left?'#68231bfa':'#080a18ee');g.addColorStop(.5,'#231522f5');g.addColorStop(1,left?'#080a18ee':'#68231bfa');
  poly(c,[[0,y+7],[960,y-8],[960,y+h-5],[0,y+h+8]],g);c.strokeStyle='#ffcc67';c.lineWidth=3;c.beginPath();c.moveTo(0,y+7);c.lineTo(960,y-8);c.moveTo(0,y+h+8);c.lineTo(960,y+h-5);c.stroke();
  c.save();c.beginPath();c.rect(left?24:748,y-2,188,h+6);c.clip();const photo=portraits[f.data.id];if(photo)c.drawImage(photo,left?20:742,y-24,194,210);c.restore();
  c.textAlign=left?'left':'right';c.font='700 italic 11px "Barlow Condensed",sans-serif';c.fillStyle='#f2cda2';c.fillText('WORDS BECOME POWER — 信念解放',left?245:715,y+23);
  const quote=f.data.special;c.font=`900 italic ${quote.length>17?29:36}px "Noto Serif JP",serif`;c.fillStyle='#ffda7c';c.shadowColor='#ab3623';c.shadowOffsetX=2;c.shadowOffsetY=3;c.fillText(quote,left?243:717,y+68,680);c.shadowOffsetX=0;c.shadowOffsetY=0;c.restore();
}
// Super freeze: darkened world + radial light behind the attacker (drawn between stage and fighters).
function superBackdrop(c,m,time){
  const f=m.fighters[m.superIndex];if(!f)return;const k=Math.min(1,(.6-m.freeze)/.08,m.freeze/.08+.25),cx=f.x,cy=f.y-95;
  c.save();c.fillStyle=`rgba(5,3,14,${.74*k})`;c.fillRect(-60,-60,1080,600);c.globalCompositeOperation='lighter';c.globalAlpha=k;
  const g=c.createRadialGradient(cx,cy,8,cx,cy,300);g.addColorStop(0,'#fffbe6');g.addColorStop(.18,f.data.color);g.addColorStop(1,f.data.color+'00');c.fillStyle=g;c.beginPath();c.arc(cx,cy,300,0,Math.PI*2);c.fill();
  c.globalAlpha=.32*k;c.fillStyle='#fff1c4';for(let i=0;i<14;i++){const a=time*1.6+i*Math.PI/7;poly(c,[[cx,cy],[cx+Math.cos(a-.05)*700,cy+Math.sin(a-.05)*700],[cx+Math.cos(a+.05)*700,cy+Math.sin(a+.05)*700]],'#fff1c4');}
  c.restore();
}
function superCutin(c,m,visual,time){
  const cut=visual.supercut;if(!cut||cut.life<=0)return;const f=m.fighters[cut.index];if(!f)return;
  const progress=1-cut.life/cut.duration,alpha=Math.min(1,progress*8,cut.life*4),left=cut.index===0,slide=(1-Math.min(1,progress*6))*(left?-260:260),y=92,h=176;
  c.save();c.globalAlpha=alpha;c.translate(slide,0);
  const g=c.createLinearGradient(0,0,960,0);g.addColorStop(0,left?'#8a1d14fc':'#05060ff2');g.addColorStop(.5,'#2a0f1cf8');g.addColorStop(1,left?'#05060ff2':'#8a1d14fc');
  poly(c,[[-300,y+16],[1260,y-14],[1260,y+h-10],[-300,y+h+16]],g);
  c.save();c.globalCompositeOperation='lighter';c.strokeStyle='#ffe2a0';c.globalAlpha=alpha*.35;for(let i=0;i<18;i++){const ly=y+10+((i*37+time*900)%(h-10)),lx=((i*173+time*2400)%1500)-300;c.lineWidth=1+i%3;c.beginPath();c.moveTo(lx,ly);c.lineTo(lx+(left?-160:160),ly);c.stroke();}c.restore();
  c.strokeStyle='#ffd56e';c.lineWidth=4;c.beginPath();c.moveTo(-300,y+16);c.lineTo(1260,y-14);c.moveTo(-300,y+h+16);c.lineTo(1260,y+h-10);c.stroke();
  c.save();c.beginPath();c.rect(left?18:682,y-4,260,h+14);c.clip();const photo=portraits[f.data.id];if(photo)c.drawImage(photo,left?10:674,y-34,276,300);c.restore();
  c.textAlign=left?'left':'right';const tx=left?300:660;
  c.font='900 italic 22px "Noto Serif JP",serif';c.fillStyle='#ffe9b4';c.shadowColor='#000';c.shadowBlur=6;c.fillText('超必殺 — 信念解放・極',tx,y+40);c.shadowBlur=0;
  const quote=f.data.special;c.font=`900 ${quote.length>15?34:quote.length>10?42:50}px "Noto Serif JP",serif`;c.lineWidth=7;c.strokeStyle='#3b0d12';c.strokeText(quote,tx,y+112,620);
  const qg=c.createLinearGradient(0,y+70,0,y+115);qg.addColorStop(0,'#fff8d0');qg.addColorStop(.55,'#ffd25a');qg.addColorStop(1,'#ff8a3a');c.fillStyle=qg;c.fillText(quote,tx,y+112,620);
  c.font='700 italic 13px "Barlow Condensed",sans-serif';c.fillStyle='#f2cda2';c.fillText(`${f.data.roman} — ${f.data.school}`,tx,y+148);
  c.restore();
}
function comboCounter(c,visual){
  const k=visual.combo;if(!k||k.life<=0||k.count<2)return;const left=k.index===0,pop=1+Math.max(0,k.pop||0)*1.6;
  c.save();c.globalAlpha=Math.min(1,k.life*3);c.translate(left?36:924,226);c.scale(pop,pop);c.textAlign=left?'left':'right';c.lineJoin='round';
  c.font='900 italic 70px "Barlow Condensed",sans-serif';c.lineWidth=9;c.strokeStyle='#1b0f1c';c.strokeText(String(k.count),0,0);
  const g=c.createLinearGradient(0,-55,0,0);g.addColorStop(0,'#fff7c8');g.addColorStop(.5,'#ffcf4f');g.addColorStop(1,'#f0612f');c.fillStyle=g;c.fillText(String(k.count),0,0);
  c.font='900 italic 21px "Barlow Condensed",sans-serif';c.lineWidth=5;c.strokeText('HIT COMBO',0,24);c.fillStyle='#fff1d4';c.fillText('HIT COMBO',0,24);c.restore();
}
function bigWord(c,word,size=88){
  c.save();c.translate(480,235);c.rotate(-.04);c.textAlign='center';c.font=`900 italic ${size}px "Barlow Condensed",sans-serif`;c.strokeStyle='#2b1424';c.lineWidth=10;c.lineJoin='round';c.strokeText(word,0,0);c.shadowOffsetX=4;c.shadowOffsetY=5;c.shadowColor='#ae342b';
  const g=c.createLinearGradient(0,-60,0,0);g.addColorStop(0,'#fff6c3');g.addColorStop(.5,'#ffd05b');g.addColorStop(1,'#f18b35');c.fillStyle=g;c.fillText(word,0,0);c.restore();
}
export function drawCombat(c,m,visual,time,stage){
  const freeze=m.freeze>0&&m.superIndex!=null&&m.fighters[m.superIndex];
  c.save();if(!reducedMotion.matches&&visual.shake>0)c.translate(Math.sin(time*91)*visual.shake,Math.cos(time*81)*visual.shake*.5);
  if(freeze&&!reducedMotion.matches){const f=m.fighters[m.superIndex],z=1+.08*Math.min(1,(.6-m.freeze)/.1,m.freeze/.1+.3),cx=f.x,cy=f.y-90;c.translate(cx,cy);c.scale(z,z);c.translate(-cx,-cy);}
  drawStage(c,stage,time);if(freeze)superBackdrop(c,m,time);
  for(const f of [...m.fighters].sort((a,b)=>(a.index===m.superIndex)-(b.index===m.superIndex)||a.y-b.y)){
    c.fillStyle='#09091566';c.beginPath();c.ellipse(f.x,393,f.pose==='down'?78:54,9,0,0,Math.PI*2);c.fill();
    const k=f.attack?.kind;
    if((k==='special'||k==='super')&&f.attack.time>.15&&f.attack.time<.5){c.save();c.globalCompositeOperation='lighter';c.strokeStyle=f.data.color;c.shadowColor=f.data.color;c.shadowBlur=25;c.lineWidth=k==='super'?11:7;const s=k==='super'?1.35:1;
      if(f.data.type==='burst'){c.beginPath();c.ellipse(f.x,f.y-80,(40+f.attack.time*170)*s,(50+f.attack.time*130)*s,0,0,Math.PI*2);c.stroke();}
      if(f.data.type==='uppercut'){c.save();c.translate(f.x,f.y);c.scale(f.facing,1);c.beginPath();c.arc(-40,-95,98*s,-1.8,.9);c.stroke();c.restore();}
      c.restore();
      if(f.data.type==='dash'){c.save();c.globalAlpha=.16;for(let j=k==='super'?5:3;j>=1;j--)drawFounder(c,f.data,f.x-f.facing*j*27,f.y,1.7,f.facing,{...f,time});c.restore();}
    }
    drawFounder(c,f.data,f.x,f.y,1.7,f.facing,{...f,time});
    if(f.block||f.pose==='block'||f.pose==='crouchBlock'){const low=f.blockLow||f.pose==='crouchBlock';c.save();c.globalCompositeOperation='lighter';c.strokeStyle='#91cbfc';c.shadowColor='#73c8ff';c.shadowBlur=20;c.lineWidth=4;c.beginPath();c.translate(f.x,f.y);c.scale(f.facing,1);c.ellipse(38,low?-58:-93,30,low?40:62,0,-1.4,1.4);c.stroke();c.restore();}
  }
  for(const p of m.projectiles)energy(c,p,time);
  c.save();c.globalCompositeOperation='lighter';for(const p of visual.particles){c.globalAlpha=Math.min(1,p.life*3);c.strokeStyle=p.color;c.lineWidth=p.size/2;c.beginPath();c.moveTo(p.x,p.y);c.lineTo(p.x-p.vx*.06,p.y-p.vy*.06);c.stroke();}c.restore();
  for(const d of visual.dust||[]){c.save();c.globalAlpha=Math.min(.55,d.life*1.4);c.fillStyle='#d8cdb4';c.beginPath();c.arc(d.x,d.y,d.size*(1.6-d.life),0,Math.PI*2);c.fill();c.restore();}
  for(const label of visual.labels){c.save();c.globalAlpha=Math.min(1,label.life*2);
    if(label.hit){const age=(label.max||.8)-label.life,s=age<.12?1.7-age*5.8:1;c.translate(label.x,label.y);c.scale(s,s);c.fillStyle=label.color;c.strokeStyle='#211325';c.lineWidth=6;c.lineJoin='round';c.font='900 italic 27px "Barlow Condensed",sans-serif';c.textAlign='center';c.strokeText(label.text,0,0);const g=c.createLinearGradient(0,-22,0,0);g.addColorStop(0,'#fffbe8');g.addColorStop(1,'#ffc65a');c.fillStyle=g;c.fillText(label.text,0,0);c.restore();continue;}
   c.fillStyle=label.color;c.strokeStyle='#211325';c.lineWidth=4;c.font=`900 italic ${label.big?28:17}px "Barlow Condensed", "Noto Sans JP",sans-serif`;c.textAlign='center';c.strokeText(label.text,label.x,label.y);c.fillText(label.text,label.x,label.y);c.restore();}
  c.restore();
  drawHUD(c,m,false,time);comboCounter(c,visual);cutin(c,m,visual);if(freeze||visual.supercut?.life>0)superCutin(c,m,visual,time);
  if(m.phase==='intro'||m.phase==='roundEnd'){
    const opening=m.phase==='intro',ko=visual.ko||{},timeUp=ko.timeup||m.timer<=0;
    const word=opening?(m.phaseTime>.72?`ROUND ${m.round}`:'FIGHT!'):m.roundWinner===null?(timeUp?'TIME UP':'DRAW'):timeUp?'TIME UP':ko.perfect&&ko.age>1.1?'PERFECT':'K.O.';
    c.fillStyle='#140c2055';c.fillRect(0,165,960,127);bigWord(c,word,word==='K.O.'?112:88);
    if(!opening){c.textAlign='center';c.font='bold 16px "Noto Sans JP",sans-serif';c.fillStyle='#fff3d3';c.fillText(m.roundWinner===null?'同点 — 次のラウンドへ':`${m.fighters[m.roundWinner].data.name}　一本！`,480,273);}
  }
  if(visual.outro?.winner!=null)winnerBanner(c,m,visual.outro);
  if(!reducedMotion.matches&&visual.flash>0){c.save();c.globalAlpha=Math.min(1,visual.flash);c.fillStyle='#fffdf4';c.fillRect(0,0,960,480);c.restore();}
}
function winnerBanner(c,m,out){
  const f=m.fighters[out.winner];if(!f)return;const t=out.time,e=1-Math.pow(1-Math.min(1,t/.3),3),word=out.perfect?'PERFECT':'WINNER';
  c.save();c.globalAlpha=Math.min(1,t*5);const y=168;
  const g=c.createLinearGradient(0,0,960,0);g.addColorStop(0,'#0000');g.addColorStop(.2,'#16091bdd');g.addColorStop(.8,'#16091bdd');g.addColorStop(1,'#0000');poly(c,[[0,y-62],[960,y-74],[960,y+52],[0,y+64]],g);
  c.strokeStyle='#ffd56e';c.lineWidth=3;c.beginPath();c.moveTo(0,y-62);c.lineTo(960,y-74);c.moveTo(0,y+64);c.lineTo(960,y+52);c.stroke();c.restore();
  c.save();c.translate(480-(1-e)*700,y+8);c.scale(1+(1-e)*.6,1+(1-e)*.6);c.rotate(-.035);bigWordAt(c,word,96);c.restore();
  c.save();c.globalAlpha=Math.min(1,Math.max(0,(t-.25)*4));c.textAlign='center';c.lineJoin='round';c.font='900 26px "Noto Serif JP",serif';c.lineWidth=6;c.strokeStyle='#1a0a12';c.strokeText(`${f.data.name}　— ${f.data.school}`,480,y+46);c.fillStyle='#fff1cf';c.fillText(`${f.data.name}　— ${f.data.school}`,480,y+46);c.restore();
}
function bigWordAt(c,word,size){c.textAlign='center';c.font=`900 italic ${size}px "Barlow Condensed",sans-serif`;c.strokeStyle='#2b1424';c.lineWidth=10;c.lineJoin='round';c.strokeText(word,0,0);c.shadowOffsetX=4;c.shadowOffsetY=5;c.shadowColor='#ae342b';const g=c.createLinearGradient(0,-size*.7,0,0);g.addColorStop(0,'#fff6c3');g.addColorStop(.5,'#ffd05b');g.addColorStop(1,'#f18b35');c.fillStyle=g;c.fillText(word,0,0);}
// Pre-fight VS screen (t = seconds elapsed, duration ≈ 2.2 s).
export function drawVersus(c,a,b,t,time){
  const e=1-Math.pow(1-Math.min(1,t/.38),3);c.save();rect(c,0,0,960,480,'#07060d');
  const ga=c.createLinearGradient(0,0,560,480);ga.addColorStop(0,a.color+'cc');ga.addColorStop(1,'#140b16');poly(c,[[0,0],[560-(1-e)*560,0],[400-(1-e)*400,480],[0,480]],ga);
  const gb=c.createLinearGradient(960,480,400,0);gb.addColorStop(0,b.color+'cc');gb.addColorStop(1,'#0b0b18');poly(c,[[960,0],[560+(1-e)*400,0],[400+(1-e)*560,480],[960,480]],gb);
  c.save();c.globalAlpha=.12;c.strokeStyle='#fff';c.lineWidth=2;for(let i=0;i<26;i++){const o=((i*61+time*420)%1400)-300;c.beginPath();c.moveTo(o,0);c.lineTo(o-160,480);c.stroke();}c.restore();
  c.strokeStyle='#ffe08a';c.lineWidth=5;c.beginPath();c.moveTo(560,0);c.lineTo(400,480);c.stroke();
  const ax=-160+(370)*e;drawFounder(c,a,ax,488,2.45,1,{time,pose:'idle',grounded:true});drawFounder(c,b,960-ax,488,2.45,-1,{time,pose:'idle',grounded:true});
  const ta=Math.min(1,Math.max(0,(t-.25)/.3));c.globalAlpha=ta;c.lineJoin='round';
  for(const [d,left] of [[a,true],[b,false]]){
    const x=left?30:930;c.textAlign=left?'left':'right';c.textBaseline='alphabetic';
    c.font='900 italic 46px "Noto Serif JP",serif';c.lineWidth=7;c.strokeStyle='#120a14';c.strokeText(d.name,x,72);c.fillStyle='#fff2c4';c.fillText(d.name,x,72);
    c.font='800 15px "Noto Sans JP",sans-serif';c.fillStyle='#ffc66d';c.strokeText(d.school,x,100);c.fillText(d.school,x,100);
    c.font='700 italic 15px "Barlow Condensed",sans-serif';c.fillStyle='#d9cbd4';c.fillText(d.roman,x,121);
    c.font=`800 ${d.special.length>16?14:17}px "Noto Serif JP",serif`;c.lineWidth=5;c.strokeText(`「${d.special}」`,x,150,400);c.fillStyle='#f5e6c8';c.fillText(`「${d.special}」`,x,150,400);
  }
  const vt=Math.max(0,t-.35),pop=vt<.25?2.2-1.2*(vt/.25):1,flash=reducedMotion.matches?0:Math.floor(time*8)%2;
  if(t>.35){c.globalAlpha=1;c.save();c.translate(480,268);c.scale(pop,pop);c.rotate(-.08);c.textAlign='center';c.font='900 italic 150px "Barlow Condensed",sans-serif';c.lineWidth=12;c.strokeStyle='#1a0710';c.strokeText('VS',0,0);
    const g=c.createLinearGradient(0,-110,0,0);g.addColorStop(0,flash?'#ffffff':'#fff4b0');g.addColorStop(.5,flash?'#ffe36a':'#ffb43c');g.addColorStop(1,flash?'#ff7a2e':'#d2321f');c.fillStyle=g;c.shadowColor=flash?'#ffcf4d':'#ff4b2b';c.shadowBlur=28;c.fillText('VS',0,0);c.restore();}
  if(t>1.95){c.globalAlpha=Math.min(1,(t-1.95)/.25);rect(c,0,0,960,480,'#000');}
  c.restore();
}
