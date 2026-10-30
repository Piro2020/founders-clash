import {FOUNDERS} from './founders.js';
import {PORTRAIT_SOURCES} from './portrait-sources.js';
import {createMatch,stepMatch,cpuInput,emptyInput} from './engine.js';
import {drawFounder,drawPortrait,drawStage,drawHUD,drawCombat,drawVersus,loadVisuals} from './illustrated-art.js';

const $=id=>document.getElementById(id),canvas=$('game-canvas'),ctx=canvas.getContext('2d');
let selected=0,stage=0,mode='cpu',match=null,paused=false,playing=false,sound=false,audioCtx=null,arcadeRoster=[],arcadeIndex=0,matchOpponent=1;
let lastTime=0,clock=0,attractMatch=createMatch(FOUNDERS[0],FOUNDERS[1]),visual=freshVisual(),vs=null,demo=null,demoEnd=0,idle=0,superReady=null,announcedRound=0;
const keys=new Set(),pressed=new Set(),touchHeld=new Set(),touchPressed=new Set();
const stageNames=['赤煉瓦の学舎','月下の大講堂','桜の並木道','大講堂の熱狂'];
const bindings=[{left:'KeyA',right:'KeyD',jump:'KeyW',down:'KeyS',light:'KeyJ',heavy:'KeyK',special:'KeyL',super:'KeyI'},{left:'ArrowLeft',right:'ArrowRight',jump:'ArrowUp',down:'ArrowDown',light:'Digit1',heavy:'Digit2',special:'Digit3',super:'Digit4'}];
const VS_TIME=2.2,OUTRO_TIME=2.6,DEMO_DELAY=6,FLOOR=390;
function freshVisual(){return{particles:[],dust:[],labels:[],shake:0,flash:0,combo:null,cutin:null,supercut:null,ko:null};}

// ---- Audio: one-shot effects, looping stage BGM and speech announcer (all behind the SOUND toggle) ----
function audio(){audioCtx ||= new (window.AudioContext||window.webkitAudioContext)();if(audioCtx.state==='suspended')audioCtx.resume();return audioCtx;}
function tone(ac,dest,from,to,length,wave,vol,at=ac.currentTime){const osc=ac.createOscillator(),gain=ac.createGain();osc.type=wave;osc.frequency.setValueAtTime(from,at);osc.frequency.exponentialRampToValueAtTime(Math.max(1,to),at+length);gain.gain.setValueAtTime(vol,at);gain.gain.exponentialRampToValueAtTime(.001,at+length);osc.connect(gain);gain.connect(dest);osc.start(at);osc.stop(at+length+.02);}
let noiseBuffer=null;
function noise(ac,dest,length,vol,freq,at=ac.currentTime,type='highpass'){
  noiseBuffer ||= (()=>{const buffer=ac.createBuffer(1,Math.floor(ac.sampleRate*.6),ac.sampleRate),d=buffer.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;return buffer;})();
  const src=ac.createBufferSource(),filter=ac.createBiquadFilter(),gain=ac.createGain();src.buffer=noiseBuffer;filter.type=type;filter.frequency.value=freq;gain.gain.setValueAtTime(vol,at);gain.gain.exponentialRampToValueAtTime(.001,at+length);src.connect(filter);filter.connect(gain);gain.connect(dest);src.start(at);src.stop(at+length+.02);
}
function makeSound(type){
  if(!sound)return;
  try{
    const ac=audio(),out=ac.destination,now=ac.currentTime;
    if(type==='throw'){tone(ac,out,330,70,.24,'square',.06);noise(ac,out,.2,.09,900,now+.04,'bandpass');return;}
    if(type==='knockdown'){tone(ac,out,150,36,.45,'sine',.18);noise(ac,out,.38,.1,420,now+.02,'lowpass');return;}
    if(type==='super'){[0,4,7,12].forEach((s,i)=>tone(ac,out,220*2**(s/12),880*2**(s/12),.55,'sawtooth',.028,now+i*.05));noise(ac,out,.6,.05,2800,now);return;}
    const patterns={select:[440,660,.07,'square'],swing:[210,80,.09,'triangle'],hit:[170,50,.12,'sawtooth'],block:[500,140,.10,'square'],special:[260,900,.25,'triangle'],jump:[180,400,.12,'triangle'],fight:[550,850,.24,'square'],ko:[180,65,.45,'sawtooth'],empty:[100,80,.05,'triangle'],win:[440,880,.6,'triangle'],vs:[110,660,.5,'sawtooth']};
    const [from,to,length,wave]=patterns[type]||patterns.hit;tone(ac,out,from,to,length,wave,.065,now);
  }catch{/* Sound is optional; play continues if audio is unavailable. */}
}
// Per stage: root Hz, 4 chords × 2 bars ([semitones, major?]), arpeggio (chord-tone index per 16th), bass hits per 8th.
const BGM=[
  {root:110,chords:[[0,0],[-4,1],[-2,1],[-5,0]],arp:[0,1,2,3,2,1,0,1,2,3,2,1,0,2,1,3],bass:[1,0,1,1,0,1,1,0],lead:'square'},
  {root:98,chords:[[0,0],[3,1],[-2,1],[-4,1]],arp:[0,2,1,2,3,2,1,2,0,2,1,2,3,2,1,2],bass:[1,0,0,1,1,0,1,0],lead:'triangle'},
  {root:130.81,chords:[[0,1],[-3,0],[5,1],[7,1]],arp:[0,1,2,3,0,1,2,3,3,2,1,0,3,2,1,0],bass:[1,1,0,1,1,0,1,1],lead:'square'},
  {root:87.31,chords:[[0,0],[1,1],[3,1],[-2,1]],arp:[0,0,2,1,3,1,2,0,0,0,2,1,3,2,1,2],bass:[1,0,1,0,1,1,0,1],lead:'sawtooth'}
];
let bgm=null;
function startBgm(){
  stopBgm();if(!sound)return;
  try{const ac=audio(),gain=ac.createGain();gain.gain.value=.05;gain.connect(ac.destination);bgm={gain,song:BGM[stage]||BGM[0],step:0,next:ac.currentTime+.1};bgm.timer=setInterval(()=>{try{scheduleBgm(ac);}catch{stopBgm();}},30);}catch{bgm=null;}
}
function scheduleBgm(ac){
  if(!bgm)return;const {song,gain}=bgm,dur=60/128/4;if(bgm.next<ac.currentTime-.2)bgm.next=ac.currentTime+.05;
  while(bgm.next<ac.currentTime+.15){
    const s=bgm.step,at=bgm.next,[offset,major]=song.chords[(s>>5)%4],base=song.root*2**(offset/12),tones=[0,major?4:3,7,12];
    if(s%2===0&&song.bass[(s>>1)%8]){const f=base*((s>>1)%2?2:1);tone(ac,gain,f,f*.99,dur*1.8,'triangle',.9,at);}
    const n=base*4*2**(tones[song.arp[s%16]]/12);tone(ac,gain,n,n,dur*.85,song.lead,song.lead==='triangle'?.4:.2,at);
    if(s%2===0)noise(ac,gain,.045,s%4===2?.55:.25,7500,at);
    bgm.step=(s+1)%128;bgm.next+=dur;
  }
}
function stopBgm(){if(!bgm)return;clearInterval(bgm.timer);const g=bgm.gain;bgm=null;try{g.gain.setTargetAtTime(0,audioCtx.currentTime,.05);setTimeout(()=>g.disconnect(),400);}catch{/* already gone */}}
function speak(text,lang='en-US',{rate=1,pitch=1,interrupt=false}={}){
  if(!sound)return;
  try{const synth=window.speechSynthesis;if(!synth||typeof SpeechSynthesisUtterance==='undefined')return;const u=new SpeechSynthesisUtterance(text),prefix=lang.slice(0,2).toLowerCase();
    const voice=synth.getVoices().find(v=>v.lang?.toLowerCase().replace('_','-')===lang.toLowerCase())||synth.getVoices().find(v=>v.lang?.toLowerCase().startsWith(prefix));
    u.lang=lang;if(voice)u.voice=voice;u.rate=rate;u.pitch=pitch;u.volume=.9;if(interrupt)synth.cancel();synth.speak(u);
  }catch{/* Speech is optional. */}
}
const announce=(text,interrupt=false)=>speak(text,'en-US',{rate:.92,pitch:.55,interrupt});
function silenceSpeech(){try{window.speechSynthesis?.cancel();}catch{/* unsupported */}}
function portrait(canvas,data,large=false){const c=canvas.getContext('2d');c.clearRect(0,0,canvas.width,canvas.height);drawPortrait(c,data,canvas.width,canvas.height);}
function selectFounder(id,quiet=false){
  if(playing)return;selected=id;const f=FOUNDERS[id];
  $('selected-number').textContent=`NO. ${String(id+1).padStart(2,'0')} / 20`;$('selected-school').textContent=f.school;$('selected-name').textContent=f.name;$('selected-roman').textContent=f.roman;$('selected-special').textContent=f.special;$('selected-style').textContent=f.description;$('fighter-type').textContent=f.style;
  for(const key of ['power','speed','reach'])$('stat-'+key).innerHTML=Array.from({length:5},(_,i)=>`<i class="stat-bar ${i<f[key]?'filled':''}"></i>`).join('');
  portrait($('selected-portrait'),f,true);
  document.querySelectorAll('.fighter-card').forEach((el,i)=>{el.classList.toggle('selected',i===id);el.setAttribute('aria-pressed',String(i===id));el.querySelector('.select-tag').hidden=i!==id;});
  refreshAttract();if(!quiet)makeSound('select');
}
function previewEnemy(){const target=$('opponent-select').value;return target==='random'?(selected===1?0:1):Number(target);}
function refreshAttract(){const enemy=previewEnemy();if(demo)stopDemo();attractMatch=createMatch(FOUNDERS[selected],FOUNDERS[enemy]);document.querySelector('.preview-caption').innerHTML=`${FOUNDERS[selected].roman.split(' ')[0]} <b>VS</b> ${FOUNDERS[enemy].roman.split(' ')[0]}`;}
function mountRoster(){
  $('roster').innerHTML=FOUNDERS.map((f,i)=>`<button class="fighter-card" data-founder="${i}" aria-pressed="false" aria-label="${f.name}・${f.school}を選ぶ"><div class="portrait-wrap"><span class="card-number">${String(i+1).padStart(2,'0')}</span><canvas width="116" height="120" aria-hidden="true"></canvas><span class="select-tag" hidden>1P</span></div><div class="card-text"><span class="card-school">${f.school}</span><span class="card-name">${f.name}</span></div></button>`).join('');
  document.querySelectorAll('.fighter-card').forEach((card,i)=>{const portraitCanvas=card.querySelector('canvas');portrait(portraitCanvas,FOUNDERS[i]);const img=document.createElement('img');img.src=portraitCanvas.toDataURL('image/png');img.width=116;img.height=120;img.alt='';portraitCanvas.replaceWith(img);card.addEventListener('click',()=>selectFounder(i));});
  $('opponent-select').innerHTML='<option value="random">おまかせ — RANDOM</option>'+FOUNDERS.map((f,i)=>`<option value="${i}" ${i===1?'selected':''}>${f.name} / ${f.school}</option>`).join('');
  $('archive-grid').innerHTML=FOUNDERS.map((f,i)=>`<article class="archive-item"><span>NO. ${String(i+1).padStart(2,'0')} · ${f.year}</span><h3>${f.name}</h3><p><strong>${f.school}</strong><br>${f.bio}</p><p class="archive-quote">「${f.special}」</p><p>${f.quoteContext||''}</p><a href="${f.quoteSource||f.source}" target="_blank" rel="noopener noreferrer">言葉の出典を読む ↗</a><p class="portrait-credit">写真・肖像を参照した創作イラスト</p><a href="${PORTRAIT_SOURCES[i].url}" target="_blank" rel="noopener noreferrer">肖像の参照元：${PORTRAIT_SOURCES[i].publisher} ↗</a><br><a href="${f.source}" target="_blank" rel="noopener noreferrer">創立者の資料を読む ↗</a></article>`).join('');
}
function setMode(value){
  if(playing)return;mode=value;document.querySelectorAll('[data-mode]').forEach(el=>{const on=el.dataset.mode===mode;el.classList.toggle('active',on);el.setAttribute('aria-pressed',String(on));});
  $('mode-label').textContent=mode==='versus'?'1P VS 2P':mode==='arcade'?'ARCADE / 5 BATTLES':'1P VS CPU';
  document.querySelector('.difficulty-row').style.visibility=mode==='versus'?'hidden':'visible';$('opponent-select').disabled=mode==='arcade';$('opponent-label').textContent=mode==='versus'?'PLAYER 2':'対戦相手';
  $('start-note').textContent=mode==='versus'?'2P：←→移動・↑ジャンプ・↓しゃがみ / 1・2・3で攻撃・4で超必殺':'2ラウンド先取 / 99カウント / ↓↘→＋攻撃で必殺技・密着して前＋強で投げ';
}
function randomOpponent(){const choices=FOUNDERS.filter(f=>f.id!==selected);return choices[Math.floor(Math.random()*choices.length)].id;}
function startMatch(freshArcade=true){
  if(mode==='arcade'){
    if(freshArcade){arcadeRoster=FOUNDERS.filter(f=>f.id!==selected).map(f=>f.id);for(let i=arcadeRoster.length-1;i>0;i--){let j=Math.floor(Math.random()*(i+1));[arcadeRoster[i],arcadeRoster[j]]=[arcadeRoster[j],arcadeRoster[i]];}arcadeRoster=arcadeRoster.slice(0,5);arcadeIndex=0;}
    matchOpponent=arcadeRoster[arcadeIndex];$('opponent-select').value=String(matchOpponent);
  }else{const value=$('opponent-select').value;matchOpponent=value==='random'?randomOpponent():Number(value);}
  match=createMatch(FOUNDERS[selected],FOUNDERS[matchOpponent],{difficulty:$('difficulty').value});playing=true;paused=false;
  visual=freshVisual();demo=null;vs={time:0};superReady=null;announcedRound=0;keys.clear();pressed.clear();touchHeld.clear();touchPressed.clear();
  $('attract-overlay').hidden=true;$('result-overlay').hidden=true;$('pause-overlay').hidden=true;$('pause-button').disabled=false;
  $('arena-label').textContent=mode==='arcade'?`ARCADE / BATTLE ${arcadeIndex+1} OF 5`:'LIVE BATTLE';$('start-button').innerHTML='一時停止 <span>Ⅱ</span>';
  document.body.classList.add('playing');lockSelection(true);syncTouchControls();silenceSpeech();makeSound('vs');startBgm();
  $('game-status').textContent=`${FOUNDERS[selected].name} 対 ${FOUNDERS[matchOpponent].name}。対戦開始。`;
  $('arena').focus({preventScroll:true});if(window.innerWidth<681)document.querySelector('.arena-shell').scrollIntoView({behavior:'smooth',block:'start'});
}
function lockSelection(locked){document.querySelectorAll('.fighter-card,[data-mode],[data-stage],#random-button,#difficulty').forEach(el=>el.disabled=locked);$('opponent-select').disabled=locked||mode==='arcade';}
function resetToSelect(){playing=false;paused=false;match=null;vs=null;idle=0;visual=freshVisual();stopBgm();silenceSpeech();keys.clear();pressed.clear();touchHeld.clear();touchPressed.clear();$('pause-overlay').hidden=true;$('result-overlay').hidden=true;$('attract-overlay').hidden=false;$('pause-button').disabled=true;$('arena-label').textContent='BATTLE PREVIEW';$('start-button').innerHTML='対戦開始 <span>↗</span>';document.body.classList.remove('playing');lockSelection(false);syncTouchControls();refreshAttract();$('start-button').focus({preventScroll:true});}
function togglePause(value){if(!playing||(match.phase==='finished'&&!(visual.outro&&!visual.outro.done)))return;/* the outro can still be paused */paused=typeof value==='boolean'?value:!paused;$('pause-overlay').hidden=!paused;keys.clear();pressed.clear();touchHeld.clear();touchPressed.clear();document.querySelectorAll('.touch-controls .held').forEach(el=>el.classList.remove('held'));if(paused){stopBgm();silenceSpeech();}else startBgm();syncTouchControls();if(paused)$('resume-button').focus({preventScroll:true});else $('arena').focus({preventScroll:true});}
function finishMatch(){
  const won=match.winner===0,arcadeNext=mode==='arcade'&&won&&arcadeIndex<4,champion=mode==='arcade'&&won&&arcadeIndex===4;
  $('result-kicker').textContent=champion?'FIVE FOUNDERS. ONE CHAMPION.':mode==='arcade'?`ARCADE / ${arcadeIndex+1} OF 5`:'MATCH FINISHED';
  $('result-title').textContent=champion?'ALL CLEAR!':mode==='versus'?`PLAYER ${match.winner+1} WINS`:won?'YOU WIN!':'YOU LOSE';
  $('result-description').textContent=champion?`${FOUNDERS[selected].name}、5人抜き達成。\n学びに、終わりはない。`:`${match.fighters[match.winner].data.name}の勝利。\n${match.wins[0]} — ${match.wins[1]}${arcadeNext?'　次の創立者が待っている。':''}`;
  $('rematch-button').innerHTML=arcadeNext?'次の対戦へ <span>↗</span>':mode==='arcade'?'もう一度5人抜き <span>↗</span>':'もう一度対戦 <span>↗</span>';
  $('result-overlay').hidden=false;$('start-button').innerHTML='選択画面へ <span>↗</span>';$('pause-button').disabled=true;syncTouchControls();stopBgm();makeSound(won||mode==='versus'?'win':'ko');if(won||mode==='versus')announce('You win');$('game-status').textContent=$('result-description').textContent;$('rematch-button').focus({preventScroll:true});
}
function inputFor(index){
  const map=bindings[index],touch=index===0,held=key=>keys.has(map[key])||(touch&&touchHeld.has(key)),edge=key=>pressed.has(map[key])||(touch&&touchPressed.has(key));
  // Back-input guard lives in the engine; `block` only comes from the touch 盾 button.
  return{...emptyInput(),x:Number(held('right'))-Number(held('left')),down:held('down'),jump:edge('jump'),block:touch&&touchHeld.has('block'),light:edge('light'),heavy:edge('heavy'),special:edge('special'),super:edge('super')};
}
function burst(x,y,count,color,spread=200){for(let i=0;i<count;i++){const angle=Math.random()*Math.PI*2,speed=70+Math.random()*spread;visual.particles.push({x,y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed-45,life:.2+Math.random()*.25,size:2+Math.random()*5,color:i%3?'#eff2ca':color});}}
function handleEvents(events,m,isDemo=false){for(const e of events){
  const fighter=m.fighters[e.index];
  if(e.type==='hit'||e.type==='block'){
    visual.shake=Math.max(visual.shake,e.type==='block'?2:e.kind==='super'?11:e.kind==='special'?8:e.knockdown?7:4);burst(e.x,e.y,e.type==='block'?9:e.kind==='super'?28:18,e.color);
    if(e.type==='hit'){visual.labels.push({text:`−${Math.round(e.damage)}`,x:e.x,y:e.y-45,life:.8,max:.8,color:'#fcf0d4',hit:true});if(e.combo>1)visual.combo={count:e.combo,index:e.index,life:1.5,pop:.25};}
    else visual.labels.push({text:'GUARD',x:e.x,y:e.y-50,life:.5,color:'#d3e7d3'});
  }
  if(e.type==='special')visual.cutin={index:e.index,life:.95,duration:.95};
  if(e.type==='super'){visual.cutin=null;const duration=m.freeze>0?m.freeze:.6;visual.supercut={index:e.index,life:duration,duration};if(!isDemo&&fighter)speak(fighter.data.special,'ja-JP',{rate:1.05,interrupt:true});}
  if(e.type==='throw'&&fighter){visual.labels.push({text:'投げ',x:fighter.x,y:fighter.y-205,life:.9,color:'#ffd36a',big:true});visual.shake=Math.max(visual.shake,6);}
  if(e.type==='knockdown'&&fighter){visual.shake=Math.max(visual.shake,5);for(let i=0;i<16;i++)visual.dust.push({x:fighter.x+(Math.random()-.5)*130,y:FLOOR-Math.random()*14,vx:(Math.random()-.5)*110,vy:-10-Math.random()*45,life:.5+Math.random()*.4,size:5+Math.random()*9});}
  if(e.type==='ko'){visual.flash=1;visual.shake=16;visual.ko={perfect:!!e.perfect,timeup:!!e.timeup,age:0};if(!isDemo){announce(e.timeup?'Time!':'K.O.',true);if(e.perfect)announce('Perfect');}}
  if(e.type==='round')visual.ko=null;
  if(e.type==='fight'&&!isDemo)announce('Fight!');
  if(e.type==='empty'&&fighter)visual.labels.push({text:'信念ゲージが足りない',x:fighter.x,y:205,life:.7,color:'#f0d8af'});
  if(e.type==='land')for(let i=0;i<5;i++)visual.particles.push({x:e.x+(Math.random()-.5)*50,y:FLOOR,vx:(Math.random()-.5)*80,vy:-Math.random()*40,life:.24,size:4,color:'#c2c6a5'});
  if(e.type==='finished'){if(!isDemo&&!visual.outro)visual.outro={time:0,winner:e.winner??m.winner,perfect:!!visual.ko?.perfect};}
  else if(!isDemo&&['swing','hit','block','special','super','throw','knockdown','jump','fight','ko','empty'].includes(e.type))makeSound(e.type);
}}
function updateVisual(dt){
  for(const p of visual.particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=450*dt;p.life-=dt;}visual.particles=visual.particles.filter(p=>p.life>0);
  for(const d of visual.dust){d.x+=d.vx*dt;d.y+=d.vy*dt;d.vx*=.94;d.life-=dt;}visual.dust=visual.dust.filter(d=>d.life>0);
  for(const l of visual.labels){l.y-=dt*20;l.life-=dt;}visual.labels=visual.labels.filter(l=>l.life>0);
  if(visual.cutin)visual.cutin.life-=dt;if(visual.supercut)visual.supercut.life-=dt;if(visual.combo){visual.combo.life-=dt;visual.combo.pop-=dt;}if(visual.ko)visual.ko.age+=dt;
  visual.shake=Math.max(0,visual.shake-dt*32);visual.flash=Math.max(0,visual.flash-dt*3);
}
// ---- Attract mode: CPU vs CPU demo of the previewed pair after DEMO_DELAY seconds without input ----
function startDemo(){demo=createMatch(FOUNDERS[selected],FOUNDERS[previewEnemy()],{difficulty:'hard'});demoEnd=0;visual=freshVisual();$('attract-overlay').hidden=true;}
function stopDemo(){demo=null;idle=0;visual=freshVisual();if(!playing)$('attract-overlay').hidden=false;}
function userActivity(){idle=0;if(demo&&!playing)stopDemo();}
function demoOverlay(){
  ctx.save();ctx.fillStyle='#07060dcc';ctx.fillRect(0,404,960,76);ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.font='900 italic 30px "Barlow Condensed",sans-serif';ctx.fillStyle=Math.floor(clock*2)%2?'#ffd462':'#fff4d7';ctx.fillText('DEMO — PRESS START',480,436);
  ctx.font='700 11px "Noto Sans JP",sans-serif';ctx.fillStyle='#d9b98f';ctx.fillText('クリック・タップ・キー入力で選択画面に戻ります',480,462);ctx.restore();
}
function syncSuperButton(){const ready=!!match&&match.fighters[0].meter>=100;if(ready===superReady)return;superReady=ready;const button=document.querySelector('[data-input="super"]');if(button){button.classList.toggle('ready',ready);button.setAttribute('aria-disabled',String(!ready));}}
function frame(timestamp){
  const dt=Math.min((timestamp-lastTime)/1000||0,.033);lastTime=timestamp;clock+=dt;
  if(playing&&match){
    if(!paused){
      if(vs){vs.time+=dt;if(vs.time>.5&&(pressed.size||touchPressed.size))vs.time=VS_TIME;if(vs.time>=VS_TIME)vs=null;}
      else{handleEvents(stepMatch(match,[inputFor(0),mode==='versus'?inputFor(1):cpuInput(match,dt,1)],dt),match);if(match.phase==='intro'&&announcedRound!==match.round){announcedRound=match.round;announce(`Round ${match.round}`,true);}}
      pressed.clear();touchPressed.clear();updateVisual(dt);
    }
    // Post-match outro: hold the arena (victory / down poses + WINNER banner) before the result overlay; input stays locked.
    const out=visual.outro;if(out){if(out.winner!=null)match.fighters.forEach((f,i)=>{f.pose=i===out.winner?'victory':'down';});if(!paused&&!out.done&&(out.time+=dt)>=OUTRO_TIME){out.done=true;finishMatch();}}
    if(vs)drawVersus(ctx,match.fighters[0].data,match.fighters[1].data,vs.time,clock);else drawCombat(ctx,match,visual,clock,stage);
    syncSuperButton();
  }else{
    if(!demo){idle+=dt;if(idle>=DEMO_DELAY&&!document.hidden&&!document.querySelector('dialog[open]')&&!$('start-button').disabled)startDemo();}
    if(demo){
      handleEvents(stepMatch(demo,[cpuInput(demo,dt,0),cpuInput(demo,dt,1)],dt),demo,true);updateVisual(dt);
      if(demo.phase==='finished'&&(demoEnd+=dt)>3)startDemo();
      drawCombat(ctx,demo,visual,clock,stage);demoOverlay();
    }else{
      drawStage(ctx,stage,clock);const [a,b]=attractMatch.fighters;a.x=576;b.x=810;
      for(const f of [a,b]){ctx.fillStyle='#223b3566';ctx.beginPath();ctx.ellipse(f.x,397,49,9,0,0,Math.PI*2);ctx.fill();drawFounder(ctx,f.data,f.x,390,1.9,f.facing,{time:clock,grounded:true,pose:'idle'});}
      drawHUD(ctx,attractMatch,true,clock);
    }
  }
  requestAnimationFrame(frame);
}
function syncTouchControls(){const touch=matchMedia('(pointer: coarse)').matches||window.innerWidth<=680;$('touch-controls').hidden=!(playing&&!paused&&match?.phase!=='finished'&&touch);}
function openDialog(id){if(playing&&!paused)togglePause(true);$(id).showModal();}

$('start-button').disabled=true;
try{await loadVisuals((done,total)=>{$('asset-progress').textContent=`肖像とステージを読み込み中… ${done} / ${total}`;});$('asset-loading').hidden=true;}
catch(error){$('asset-progress').textContent='画像の読み込みに失敗しました。ページを再読み込みしてください。';console.error(error);throw error;}
mountRoster();selectFounder(0,true);$('start-button').disabled=false;
$('start-button').addEventListener('click',()=>visual.outro&&!visual.outro.done?null:playing?(match.phase==='finished'?resetToSelect():togglePause()):startMatch());
$('random-button').addEventListener('click',()=>selectFounder(randomOpponent()));
$('opponent-select').addEventListener('change',refreshAttract);
document.querySelectorAll('[data-mode]').forEach(el=>el.addEventListener('click',()=>setMode(el.dataset.mode)));
document.querySelectorAll('[data-stage]').forEach(el=>el.addEventListener('click',()=>{if(playing)return;stage=Number(el.dataset.stage);document.querySelectorAll('[data-stage]').forEach(btn=>{const on=Number(btn.dataset.stage)===stage;btn.classList.toggle('active',on);btn.setAttribute('aria-pressed',String(on));});makeSound('select');}));
$('pause-button').addEventListener('click',()=>togglePause());$('resume-button').addEventListener('click',()=>togglePause(false));$('quit-button').addEventListener('click',resetToSelect);$('result-back-button').addEventListener('click',resetToSelect);
$('rematch-button').addEventListener('click',()=>{if(mode==='arcade'&&match.winner===0&&arcadeIndex<4){arcadeIndex++;startMatch(false);}else startMatch(true);});
$('help-button').addEventListener('click',()=>openDialog('help-dialog'));$('controls-more').addEventListener('click',()=>openDialog('help-dialog'));$('archive-button').addEventListener('click',()=>openDialog('archive-dialog'));$('sources-button').addEventListener('click',()=>openDialog('archive-dialog'));
document.querySelectorAll('dialog').forEach(dialog=>{dialog.querySelectorAll('.close-dialog,.close-help').forEach(el=>el.addEventListener('click',()=>dialog.close()));dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});});
$('sound-button').addEventListener('click',()=>{sound=!sound;$('sound-button').innerHTML=`♪ <span>SOUND ${sound?'ON':'OFF'}</span>`;$('sound-button').setAttribute('aria-pressed',String(sound));$('sound-button').setAttribute('aria-label',sound?'サウンドをオフにする':'サウンドをオンにする');makeSound('select');if(!sound){stopBgm();silenceSpeech();}else if(playing&&!paused&&match?.phase!=='finished')startBgm();});
$('fullscreen-button').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if(document.querySelector('.arena-shell').requestFullscreen)await (matchMedia('(pointer: coarse)').matches?document.documentElement:document.querySelector('.arena-shell')).requestFullscreen();else openDialog('help-dialog');}catch{$('game-status').textContent='このブラウザでは全画面表示を利用できません。';}});
document.addEventListener('keydown',e=>{
  if(document.querySelector('dialog[open]'))return;
  if(['Escape','KeyP'].includes(e.code)&&playing){e.preventDefault();if(!e.repeat)togglePause();return;}
  if(!playing||paused||match?.phase==='finished')return;
  const accepted=[...Object.values(bindings[0]),...Object.values(bindings[1])];
  const code=e.code.startsWith('Numpad')?'Digit'+e.code.slice(6):e.code;
  if(e.repeat){if(accepted.includes(code))e.preventDefault();return;}
  if(accepted.includes(code)){e.preventDefault();if(!keys.has(code))pressed.add(code);keys.add(code);}
});
document.addEventListener('keyup',e=>{keys.delete(e.code.startsWith('Numpad')?'Digit'+e.code.slice(6):e.code);});
window.addEventListener('blur',()=>{keys.clear();pressed.clear();if(playing&&!paused)togglePause(true);});document.addEventListener('visibilitychange',()=>{if(document.hidden&&playing&&!paused)togglePause(true);});
document.querySelectorAll('[data-input]').forEach(button=>{
  const name=button.dataset.input;
  const pointers=new Set(); // per-button pointer tracking: a second finger lifting must not release the first
  button.addEventListener('pointerdown',e=>{e.preventDefault();button.setPointerCapture(e.pointerId);pointers.add(e.pointerId);touchHeld.add(name);touchPressed.add(name);button.classList.add('held');});
  for(const type of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(type,e=>{e.preventDefault();if(!pointers.delete(e.pointerId)||pointers.size)return;touchHeld.delete(name);button.classList.remove('held');});
});
window.addEventListener('resize',syncTouchControls);
for(const type of ['keydown','pointerdown','wheel','touchstart'])document.addEventListener(type,userActivity,{capture:true,passive:true});
requestAnimationFrame(frame);
