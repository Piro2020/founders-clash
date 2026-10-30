export const WORLD={width:960,height:480,floor:390,gravity:1750};
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
export const emptyInput=()=>({x:0,down:false,jump:false,block:false,light:false,heavy:false,special:false,super:false});
const ATTACKS={
  light:{duration:.3,start:.07,end:.16,damage:5,range:76,hitType:'mid',scale:.55,stun:.28},
  heavy:{duration:.55,start:.18,end:.31,damage:9,range:104,hitType:'mid',scale:1,stun:.32},
  crouchLight:{duration:.26,start:.06,end:.14,damage:4,range:80,hitType:'low',scale:.45,stun:.26},
  sweep:{duration:.62,start:.19,end:.33,damage:8,range:112,hitType:'low',scale:.8,stun:.3,knockdown:true},
  jumpKick:{duration:.6,start:.07,end:.45,damage:7.5,range:88,hitType:'overhead',scale:.8,stun:.3},
  throw:{duration:.5,start:.04,end:.12,damage:10,range:64,hitType:'throw',scale:0,stun:0,knockdown:true},
  special:{duration:.68,start:.21,end:.43,damage:14,range:100,hitType:'mid',scale:1,stun:.32},
  super:{duration:1.05,start:.18,end:.8,damage:10.5,range:120,hitType:'mid',scale:.2,stun:.3}};
const RANK={light:1,crouchLight:1,heavy:2,sweep:2,special:3,super:4,throw:9,jumpKick:9};
const RANGED=['projectile','wave'];
export function createFighter(data,index){return{data,index,x:index?710:250,y:WORLD.floor,vx:0,vy:0,facing:index?-1:1,hp:100,meter:40,attack:null,stun:0,invincible:0,block:false,grounded:true,walk:0,combo:0,comboTimer:0,hits:0,crouch:false,blockLow:false,down:0,pose:'idle',superFlash:0,guard:false,airAttack:false,cmd:0,hist:[],clock:0};}
const newAI=()=>[{timer:0,input:emptyInput(),hold:emptyInput()},{timer:0,input:emptyInput(),hold:emptyInput()}];
export function createMatch(a,b,options={}){return{fighters:[createFighter(a,0),createFighter(b,1)],projectiles:[],events:[],phase:'intro',phaseTime:2.3,timer:99,round:1,wins:[0,0],winner:null,roundWinner:null,hitstop:0,elapsed:0,ai:newAI(),difficulty:options.difficulty||'normal',rng:options.rng||Math.random,draws:0,slowmo:0,freeze:0,superIndex:null,pending:[{},{}]};}
const EDGES=['jump','light','heavy','special','super'];
function emit(m,type,data={}){m.events.push({type,...data});}
function startAttack(m,f,kind,command=false,cancel=false){
  if(kind==='special'&&f.meter<25||kind==='super'&&f.meter<100){emit(m,'empty',{index:f.index});return;}
  if(kind==='special')f.meter-=25;if(kind==='super')f.meter=0;
  const a=f.attack={kind,time:0,hit:false,blocked:false,spawned:false,hits:0,next:0,command,knockdown:false,...ATTACKS[kind]},t=f.data.type,sup=kind==='super';
  if(kind==='special'||sup){
    if(t==='burst'){a.range=sup?150:140;if(!sup)a.damage=13;}
    if(t==='dash'&&!sup){a.start=.12;a.end=.42;}
    if(t==='uppercut'){a.range=sup?110:94;if(!sup)a.end=.47;}
    if(!sup)a.knockdown=t==='uppercut'||t==='burst';
  }
  if(cancel){const s=a.start*.5;a.end-=a.start-s;a.start=s;a.cancel=true;}
  if(kind==='jumpKick')f.airAttack=true;
  f.block=f.blockLow=f.crouch=false;
  if(sup){m.freeze=.6;m.superIndex=f.index;f.superFlash=.6;emit(m,'super',{index:f.index,name:f.data.special});}
  else if(kind==='special')emit(m,'special',{index:f.index,name:f.data.special});
  else emit(m,'swing',{kind,index:f.index});
}
function hit(m,att,def,damage,a,sourceX,final=false){
  if(m.phase!=='fight'||def.invincible>0||def.hp<=0||def.down>0)return false;
  const ht=a.hitType,sup=a.kind==='super'||!!a.super;
  if(ht==='throw'&&(def.stun>0||!def.grounded))return false;
  const blocked=ht!=='throw'&&def.block&&def.grounded&&def.facing*(sourceX-def.x)>0&&(ht==='mid'||ht==='low'&&def.blockLow||ht==='overhead'&&!def.crouch);
  const actual=blocked?(a.kind==='light'||a.kind==='crouchLight'?0:Math.ceil(damage*(sup?.2:.13))):damage;
  def.hp=Math.max(0,def.hp-actual);
  const dir=def.x>=sourceX?1:-1,kd=!blocked&&(def.hp<=0||!!a.knockdown||final||!def.grounded);
  if(!blocked){att.combo=def.stun>0&&!def.guard?att.combo+1:1;def.attack=null;def.block=def.blockLow=false;att.comboTimer=.85;att.hits++;}
  if(kd){def.down=.95;def.stun=0;def.guard=false;def.invincible=0;def.vx=dir*(ht==='throw'?330:230);def.vy=-300;def.grounded=false;emit(m,'knockdown',{index:def.index});}
  else{def.stun=blocked?.14:a.stun||.3;def.guard=blocked;def.invincible=blocked?.08:sup?.05:.13;def.vx=dir*(blocked?100:sup?50:a.kind==='light'||a.kind==='crouchLight'?110:190);}
  def.meter=clamp(def.meter+actual*.6,0,100);
  att.meter=clamp(att.meter+(blocked?2:sup?0:a.kind==='special'?4:7),0,100);
  m.hitstop=Math.max(m.hitstop,blocked?.025:def.hp<=0?.14:a.kind==='light'||a.kind==='crouchLight'?.045:.075);  if(ht==='throw')emit(m,'throw',{index:att.index});
  emit(m,blocked?'block':'hit',{x:def.x+(sourceX<def.x?-20:20),y:def.y-70,index:att.index,damage:actual,kind:a.kind,combo:att.combo,color:att.data.color,...(blocked?{}:{knockdown:kd})});
  return blocked?'block':'hit';
}
function readCommand(f,input,dt){
  f.clock+=dt;f.cmd=Math.max(0,f.cmd-dt);
  const fx=input.x*f.facing,n=input.down?(fx>0?3:fx<0?1:2):(fx>0?6:fx<0?4:5),h=f.hist;
  if(!h.length||h[h.length-1].n!==n)h.push({n,t:f.clock});
  while(h.length>1&&f.clock-h[1].t>.45)h.shift();
  let s=0;for(const e of h)if(e.n===[2,3,6][s]&&++s===3){f.cmd=.25;f.hist=[{n,t:f.clock}];break;}
}
const poseOf=f=>f.down>0||f.hp<=0?'down':f.attack?(f.attack.kind==='throw'?'heavy':f.attack.kind):f.block?(f.blockLow?'crouchBlock':'block'):f.stun>0&&f.grounded?'hurt':!f.grounded?'jump':f.crouch?'crouch':Math.abs(f.vx)>20?'walk':'idle';
// Phase 1: timers, input, movement intent, attack start/advance. No damage is applied here.
function prepareFighter(m,f,enemy,input,dt){
  f.stun=Math.max(0,f.stun-dt);f.invincible=Math.max(0,f.invincible-dt);f.superFlash=Math.max(0,f.superFlash-dt);
  f.comboTimer-=dt;if(f.comboTimer<=0)f.combo=0;
  if(f.down>0&&f.hp>0){f.down-=dt;if(f.down<=0){f.down=0;f.invincible=.2;}}
  if(f.stun<=0)f.guard=false;
  f.meter=Math.min(100,f.meter+4.3*dt);
  const free=f.down<=0&&f.hp>0;
  if(!f.attack&&free&&f.grounded)f.facing=enemy.x>=f.x?1:-1;
  readCommand(f,input,dt);
  const back=input.x!==0&&input.x===-f.facing;
  f.block=free&&f.grounded&&!f.attack&&(!!input.block||back)&&(f.stun<=0||f.guard);
  const willJump=free&&f.grounded&&!f.attack&&f.stun<=0&&!!input.jump&&!input.block;
  f.crouch=free&&f.grounded&&!f.attack&&!!input.down&&!willJump;
  f.blockLow=f.block&&f.crouch;
  if(f.stun<=0&&free){
    const a=f.attack,cancel=a&&(a.hit||a.blocked)&&a.time>=a.end;
    if(!a){
      const speed=135+f.data.speed*21;
      f.vx=f.crouch?0:input.x*speed*(f.block?(input.block?.25:.72):1);
      if(willJump){f.vy=-640;f.grounded=false;f.block=f.blockLow=false;emit(m,'jump',{index:f.index});}
    }
    if(!a||cancel){
      const close=f.grounded&&enemy.grounded&&enemy.down<=0&&Math.abs(enemy.x-f.x)<62;let k=null,cmd=false;
      if(input.super)k='super';
      else if(f.cmd>0&&(input.light||input.heavy||input.special)){k='special';cmd=true;}
      else if(input.special)k='special';
      else if(input.heavy)k=!f.grounded?'jumpKick':close&&input.x===f.facing&&!input.down?'throw':input.down?'sweep':'heavy';
      else if(input.light)k=!f.grounded?'jumpKick':input.down?'crouchLight':'light';
      if(k==='jumpKick'&&f.airAttack)k=null;
      const r=a?RANK[a.kind]:0,allowed=!a||r===1&&(k==='heavy'||k==='sweep')||r===2&&(k==='special'||k==='super');
      if(k&&allowed){if(cmd)f.cmd=0;startAttack(m,f,k,cmd,!!a);}
    }
    if(f.attack&&f.grounded)f.vx*=Math.pow(.001,dt);
  } else if(f.grounded)f.vx*=Math.pow(f.down>0?.02:.06,dt);
  if(m.freeze>0||!f.attack)return;
  {
    const a=f.attack;a.time+=dt;
    const t=f.data.type,sup=a.kind==='super',isSp=a.kind==='special'||sup,ranged=isSp&&RANGED.includes(t);
    if(isSp&&a.time>=a.start&&!a.spawned){
      a.spawned=true;
      if(ranged){
        m.projectiles.push({owner:f.index,x:f.x+f.facing*54,y:f.y-(t==='wave'?24:68),vx:f.facing*(t==='wave'?355:410)*(sup?1.1:1),life:2.8,type:t,color:f.data.color,super:sup,damage:sup?28:(a.damage+f.data.power*1.25)*(a.command?1.15:1)});
        emit(m,'projectile',{index:f.index});
      }
      if(t==='uppercut'){f.vy=sup?-620:-500;f.grounded=false;if(!sup)f.vx=f.facing*(Math.abs(enemy.x-f.x)>70?170:40);}
    }
    if(isSp&&t==='dash'&&a.time>=a.start&&a.time<=a.end)f.vx=f.facing*(440+f.data.speed*14)*(sup?1.1:1);
    else if(sup&&!ranged&&a.time>=a.start&&a.time<=a.end)f.vx=f.facing*(Math.abs(enemy.x-f.x)>60?160:0);
  }
}
// Phase 2: melee contact from the prepared (pre-damage) state of both fighters.
function contactOf(f,enemy){
  const a=f.attack;if(!a)return null;
  const t=f.data.type,sup=a.kind==='super',isSp=a.kind==='special'||sup,ranged=isSp&&RANGED.includes(t);
  const range=a.range+(a.kind==='throw'?0:f.data.reach*5),dx=enemy.x-f.x,dy=Math.abs(enemy.y-f.y);
  const ready=sup?a.hits<3&&a.time>=a.next:!a.hit,dyMax=isSp&&t==='uppercut'||a.kind==='jumpKick'?135:a.kind==='throw'?10:95;
  if(ranged||!ready||a.time<a.start||a.time>a.end||Math.abs(dx)>=range||dy>=dyMax||!(t==='burst'&&isSp||dx*f.facing>-12))return null;
  return{f,enemy,a,x:f.x,final:sup&&a.hits===2,dmg:a.kind==='throw'?a.damage:(a.damage+f.data.power*a.scale)*(a.command?1.15:1)};
}
function applyContact(m,c){
  const{a}=c,r=hit(m,c.f,c.enemy,c.dmg,a,c.x,c.final);
  if(r){a.hit=true;a.blocked=r==='block';if(a.kind==='super'){a.hits++;a.next=a.time+.14;}}
}
// Phase 3: attack expiry and physics.
function finishFighter(m,f,dt){
  if(f.attack&&f.attack.time>=f.attack.duration)f.attack=null;
  f.x=clamp(f.x+f.vx*dt,42,918);
  if(!f.grounded){f.vy+=WORLD.gravity*dt;f.y+=f.vy*dt;if(f.y>=WORLD.floor){f.y=WORLD.floor;f.vy=0;f.grounded=true;f.airAttack=false;if(f.attack&&f.attack.kind==='jumpKick')f.attack=null;emit(m,'land',{x:f.x});}}
  f.walk+=Math.abs(f.vx)*dt*.04;
  f.pose=poseOf(f);
}
function updatePair(m,inputs,dt){
  const F=m.fighters;
  for(let i=0;i<2;i++)prepareFighter(m,F[i],F[1-i],inputs[i]||emptyInput(),dt);
  if(m.freeze>0){for(const f of F)f.pose=poseOf(f);return false;}
  const contacts=[contactOf(F[0],F[1]),contactOf(F[1],F[0])].filter(Boolean);
  for(const c of contacts)applyContact(m,c);
  for(const f of F)finishFighter(m,f,dt);
  return true;
}
export function cpuInput(m,dt,index=1){
  const ai=m.ai[index];ai.timer-=dt;if(ai.timer>0)return ai.hold;
  const f=m.fighters[index],e=m.fighters[1-index],distance=Math.abs(e.x-f.x),direction=Math.sign(e.x-f.x)||f.facing,r=m.rng;
  const difficulty=m.difficulty,skill=difficulty==='easy'?.27:difficulty==='hard'?.85:.55;
  ai.timer=difficulty==='hard'?.08+r()*.1:difficulty==='easy'?.3+r()*.23:.2+r()*.2;
  const v=emptyInput();
  if(m.phase==='fight'&&f.down<=0){
    const ea=e.attack,incoming=m.projectiles.some(p=>p.owner!==index&&Math.abs(p.x-f.x)<230&&Math.sign(f.x-p.x)===Math.sign(p.vx));
    const threat=ea&&ea.time<ea.end&&distance<190||incoming||!e.grounded&&distance<170;
    if(!f.grounded){v.x=direction;if(distance<150&&!f.airAttack)v.heavy=true;}
    else if(threat&&r()<skill){
      if(incoming&&!ea&&r()<skill*.3)v.jump=true;
      else{v.x=-direction;v.down=!!ea&&ea.hitType==='low'||!ea&&e.grounded&&r()<.25;}
    }
    else if(f.attack&&f.attack.hit&&RANK[f.attack.kind]===1&&r()<skill*.5)v.heavy=true;
    else if(distance<62&&e.grounded&&e.down<=0&&r()<.1+skill*.2){v.x=direction;v.heavy=true;}
    else if(f.meter>=100&&r()<skill*.45&&(distance<130||RANGED.includes(f.data.type)&&distance<600))v.super=true;
    else if(distance<125){const roll=r()*2-1;if(roll<0)v.x=r()<.5?-direction:0;else if(roll<.3)v.light=true;else if(roll<.42){v.light=true;v.down=true;}else if(roll<.62)v.heavy=true;else if(roll<.72){v.heavy=true;v.down=true;}else if(roll<.72+skill*.2&&f.meter>=25)v.special=true;}
    else if(f.meter>=25&&distance<620&&['projectile','wave','dash'].includes(f.data.type)&&r()<skill*.3)v.special=true;
    if(f.grounded&&!v.x&&!v.down)v.x=distance>125?direction:distance<60&&r()<.3?-direction:0;
    if(f.grounded&&!threat&&!v.special&&!v.super&&distance>160&&distance<380&&r()<skill*.16)v.jump=true;
  }
  ai.input=v;ai.hold={...emptyInput(),x:v.x,down:v.down,block:v.block};return v;
}
function resetRound(m){
  m.fighters=m.fighters.map((f,i)=>createFighter(f.data,i));m.projectiles=[];m.timer=99;m.phase='intro';m.phaseTime=2.3;m.round++;m.roundWinner=null;m.pending=[{},{}];m.ai=newAI();m.slowmo=0;m.freeze=0;m.superIndex=null;emit(m,'round',{round:m.round});
}
function endPoses(m){
  for(const f of m.fighters)f.pose=f.hp<=0?'down':m.roundWinner===f.index&&f.grounded&&!f.attack?'victory':f.pose;
}
export function stepMatch(m,inputs,dt){
  m.events=[];dt=clamp(dt,0,.035);m.elapsed+=dt;
  if(m.phase==='finished'){endPoses(m);return m.events;}
  if(m.phase==='fight'&&(m.freeze>0||m.hitstop>0)){m.pending??=[{},{}];inputs.forEach((v,i)=>{if(v&&i<2)for(const k of EDGES)if(v[k])m.pending[i][k]=true;});}
  if(m.freeze>0){m.freeze=Math.max(0,m.freeze-dt);for(const f of m.fighters)f.superFlash=Math.max(0,f.superFlash-dt);return m.events;}
  if(m.slowmo>0){m.slowmo=Math.max(0,m.slowmo-dt);dt*=.3;}
  if(m.hitstop>0){m.hitstop-=dt;return m.events;}
  if(m.phase==='intro'){
    m.phaseTime-=dt;if(m.phaseTime<=0){m.phase='fight';emit(m,'fight');}return m.events;
  }
  if(m.phase==='roundEnd'){
    updatePair(m,[emptyInput(),emptyInput()],dt);
    endPoses(m);
    m.phaseTime-=dt;if(m.phaseTime<=0){if(m.wins.some(w=>w>=2)){m.phase='finished';m.winner=m.wins[0]>=2?0:1;emit(m,'finished',{winner:m.winner});}else resetRound(m);}return m.events;
  }
  m.timer=Math.max(0,m.timer-dt);
  const pend=m.pending||[{},{}];inputs=[0,1].map(i=>({...emptyInput(),...inputs[i],...pend[i]}));m.pending=[{},{}];
  if(!updatePair(m,inputs,dt))return m.events;
  const [a,b]=m.fighters;
  const dx=b.x-a.x;
  if(Math.abs(dx)<52&&Math.abs(a.y-b.y)<92){const push=(52-Math.abs(dx))*.5,sign=dx>=0?1:-1;a.x=clamp(a.x-push*sign,42,918);b.x=clamp(b.x+push*sign,42,918);}
  for(const p of m.projectiles)for(const q of m.projectiles)if(p.owner===0&&q.owner===1&&p.life>0&&q.life>0&&Math.abs(p.x-q.x)<36&&Math.abs(p.y-q.y)<60){if(p.super&&!q.super)q.life=0;else if(q.super&&!p.super)p.life=0;else p.life=q.life=0;}
  for(const p of m.projectiles){
    if(p.life<=0)continue;
    p.x+=p.vx*dt;p.life-=dt;
    const target=m.fighters[1-p.owner];
    if(Math.abs(target.x-p.x)<40&&p.y>target.y-126&&p.y<target.y+5){if(hit(m,m.fighters[p.owner],target,p.damage,{kind:p.super?'super':'special',hitType:'mid',knockdown:p.super,super:p.super,stun:.32},p.x-p.vx*.05))p.life=0;}
  }
  m.projectiles=m.projectiles.filter(p=>p.life>0&&p.x>-50&&p.x<1010);
  for(const f of m.fighters)f.pose=poseOf(f);
  if(a.hp<=0||b.hp<=0||m.timer<=0){
    const winner=a.hp===b.hp?null:a.hp>b.hp?0:1,ko=a.hp<=0||b.hp<=0;
    m.roundWinner=winner;if(winner!==null)m.wins[winner]++;else m.draws++;
    for(const f of m.fighters)if(f.hp<=0){f.attack=null;if(f.down<=0)f.down=.95;f.pose='down';}
    if(ko)m.slowmo=.9;
    m.phase='roundEnd';m.phaseTime=2.2;
    emit(m,'ko',{winner,timeup:!ko,perfect:winner!==null&&m.fighters[winner].hp===100});
  }
  return m.events;
}
