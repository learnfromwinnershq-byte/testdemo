"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

type Faction = "赤潮聯隊" | "藍穹同盟";
type Domain = "sea" | "land";
type Weapon = "torpedo" | "cannon" | "missile" | "air" | "rail";
type Tag = "light" | "vehicle" | "armor" | "capital" | "carrier" | "future";

type UnitSpec = {
  id: string; name: string; subtitle: string; domain: Domain; unlock: number;
  hp: number; speed: number; damage: number; armor: number; range: number;
  fireRate: number; weapon: Weapon; tag: Tag; expValue: number; ability: string;
};

const UNITS: UnitSpec[] = [
  { id:"razorfin", name:"刃鰭快艇", subtitle:"高速越級魚雷突襲", domain:"sea", unlock:1, hp:360, speed:178, damage:84, armor:8, range:280, fireRate:.78, weapon:"torpedo", tag:"light", expValue:260, ability:"深潛魚雷" },
  { id:"reefguard", name:"礁衞艦", subtitle:"均衡護航與持續火力", domain:"sea", unlock:4, hp:760, speed:126, damage:62, armor:20, range:330, fireRate:.52, weapon:"cannon", tag:"armor", expValue:520, ability:"攔截彈幕" },
  { id:"starbreaker", name:"星槌導彈艦", subtitle:"海上核心 · 雙域壓制", domain:"sea", unlock:10, hp:1680, speed:92, damage:118, armor:34, range:440, fireRate:.86, weapon:"missile", tag:"capital", expValue:1000, ability:"蜂羣齊射" },
  { id:"skywhale", name:"雲鯨母艦", subtitle:"自動艦載機作戰羣", domain:"sea", unlock:15, hp:2200, speed:67, damage:46, armor:38, range:390, fireRate:.42, weapon:"air", tag:"carrier", expValue:1400, ability:"全翼出擊" },
  { id:"dustlynx", name:"塵猞戰車", subtitle:"快速偵察與側襲", domain:"land", unlock:1, hp:420, speed:164, damage:48, armor:12, range:260, fireRate:.43, weapon:"cannon", tag:"vehicle", expValue:280, ability:"渦輪突進" },
  { id:"ironroot", name:"鐵根重坦", subtitle:"陣地突破與車輛剋制", domain:"land", unlock:3, hp:980, speed:104, damage:92, armor:32, range:310, fireRate:.82, weapon:"cannon", tag:"armor", expValue:650, ability:"複合護盾" },
  { id:"thunderrail", name:"霆軌火炮", subtitle:"遠程曲射 · 跨海打擊", domain:"land", unlock:8, hp:620, speed:82, damage:145, armor:15, range:490, fireRate:1.18, weapon:"rail", tag:"vehicle", expValue:820, ability:"超距標定" },
  { id:"miragewalker", name:"蜃行無人堡", subtitle:"未來無人集羣核心", domain:"land", unlock:14, hp:1450, speed:116, damage:105, armor:31, range:380, fireRate:.65, weapon:"missile", tag:"future", expValue:1200, ability:"鏡像蜂羣" },
];

const weaponColor: Record<Weapon,string> = { torpedo:"#60eaff", cannon:"#ffd16a", missile:"#ff7c61", air:"#d8b4ff", rail:"#d9ff6a" };
const factionColor: Record<Faction,string> = { "赤潮聯隊":"#ff4f62", "藍穹同盟":"#3bc4ff" };
const xpNeed = (level:number) => Math.round(level * level * 60 * (level <= 5 ? 1 : level <= 10 ? 1.4 : level <= 15 ? 1.9 : 2.6));

type Combatant = { id:number; x:number; y:number; vx:number; vy:number; angle:number; hp:number; maxHp:number; faction:Faction; spec:UnitSpec; score:number; name:string; respawn:number; fireCd:number; };
type Shot = { x:number; y:number; vx:number; vy:number; life:number; damage:number; weapon:Weapon; faction:Faction; owner:"player"|number; radius:number; };
type Energy = { x:number; y:number; tier:1|2|3; value:number; pulse:number; domain:Domain; };
type Plane = { x:number; y:number; angle:number; orbit:number; cooldown:number; faction:Faction; };

const BOT_NAMES = ["霜線","北辰","零號錨","燧石","海霧","野火","長風","稜鏡","沉沙","遠雷","幽灣","白塔","逆潮","矩陣","流螢","斷崖"];

export default function GameClient() {
  const [faction, setFaction] = useState<Faction>("藍穹同盟");
  const [selectedId, setSelectedId] = useState("razorfin");
  const [phase, setPhase] = useState<"lobby"|"battle">("lobby");
  const [showBlueprint, setShowBlueprint] = useState(false);
  const [chatMode, setChatMode] = useState<"全部"|"隊伍">("隊伍");
  const [chatInput, setChatInput] = useState("");
  const [messages, setMessages] = useState(["[系統] 歡迎嚟到裂潮戰線原型伺服器", "[隊伍] 霜線：能源井附近集合！"]);
  const [hud, setHud] = useState({ hp:360, maxHp:360, level:1, xp:0, next:60, score:0, kills:0, rank:1, rewardIn:60, ability:0, red:100, blue:100 });
  const [leaders, setLeaders] = useState<{name:string;score:number;self?:boolean;faction:Faction}[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const keys = useRef<Record<string,boolean>>({});
  const mouse = useRef({ x:0, y:0, down:false });
  const selected = useMemo(() => UNITS.find(u=>u.id===selectedId) || UNITS[0], [selectedId]);
  const game = useRef({
    player:{ x:0,y:0,angle:0,hp:360,fireCd:0,abilityCd:0,invuln:0 },
    bots:[] as Combatant[], shots:[] as Shot[], energy:[] as Energy[], planes:[] as Plane[],
    xp:0, level:1, score:0, kills:0, minute:60, redBase:100, blueBase:100,
    last:0, uiTick:0, started:false, width:1200, height:700,
  });

  useEffect(() => setFaction(Math.random() > .5 ? "赤潮聯隊" : "藍穹同盟"), []);

  const resetBattle = useCallback((spec:UnitSpec) => {
    const g = game.current;
    const w = g.width, h = g.height;
    const coast = w*.57;
    g.player = { x: spec.domain==="sea" ? coast*.42 : coast+(w-coast)*.5, y:h*.55, angle:0, hp:spec.hp, fireCd:0, abilityCd:0, invuln:1.2 };
    g.xp=0; g.level=1; g.score=0; g.kills=0; g.minute=60; g.redBase=100; g.blueBase=100; g.shots=[]; g.planes=[];
    g.energy = Array.from({length:16},(_,i) => {
      const domain:Domain = i%2 ? "land":"sea";
      const tier = ((i%7===0?3:i%3===0?2:1) as 1|2|3);
      return { x:domain==="sea"?40+Math.random()*(coast-80):coast+40+Math.random()*(w-coast-80), y:60+Math.random()*(h-120), tier, value:tier===1?18:tier===2?42:90, pulse:Math.random()*6, domain };
    });
    g.bots = Array.from({length:16},(_,i) => {
      const botSpec=UNITS[(i*3+Math.floor(Math.random()*3))%UNITS.length];
      const bf:Faction=i%2?"赤潮聯隊":"藍穹同盟";
      const bx=botSpec.domain==="sea"?50+Math.random()*(coast-100):coast+50+Math.random()*(w-coast-100);
      return {id:i,x:bx,y:60+Math.random()*(h-120),vx:0,vy:0,angle:0,hp:botSpec.hp,maxHp:botSpec.hp,faction:bf,spec:botSpec,score:Math.floor(Math.random()*650),name:BOT_NAMES[i],respawn:0,fireCd:Math.random()};
    });
    if(spec.weapon==="air") g.planes=Array.from({length:8},(_,i)=>({x:g.player.x,y:g.player.y,angle:i*Math.PI/4,orbit:36+(i%3)*13,cooldown:Math.random(),faction}));
    g.started=true; g.last=performance.now();
    setHud({hp:spec.hp,maxHp:spec.hp,level:1,xp:0,next:xpNeed(1),score:0,kills:0,rank:1,rewardIn:60,ability:0,red:100,blue:100});
  },[faction]);

  const startGame = () => { resetBattle(selected); setPhase("battle"); };

  useEffect(() => {
    const down=(e:KeyboardEvent)=>{ if(["w","a","s","d","arrowup","arrowdown","arrowleft","arrowright"," ","q"].includes(e.key.toLowerCase())) e.preventDefault(); keys.current[e.key.toLowerCase()]=true; };
    const up=(e:KeyboardEvent)=>{ keys.current[e.key.toLowerCase()]=false; };
    window.addEventListener("keydown",down); window.addEventListener("keyup",up);
    return()=>{window.removeEventListener("keydown",down);window.removeEventListener("keyup",up)};
  },[]);

  useEffect(() => {
    if(phase!=="battle") return;
    const canvas=canvasRef.current!;
    const ctx=canvas.getContext("2d")!;
    let raf=0;
    const coastX=(y:number,w:number)=>w*.57+Math.sin(y*.018)*18+Math.sin(y*.006)*28;
    const isValid=(x:number,y:number,domain:Domain,w:number)=>domain==="sea" ? x<coastX(y,w)-8 : x>coastX(y,w)+8;
    const spawnEnergy=(e:Energy,w:number,h:number)=>{ const coast=w*.57; e.x=e.domain==="sea"?30+Math.random()*(coast-65):coast+35+Math.random()*(w-coast-65); e.y=45+Math.random()*(h-90); e.pulse=0; };
    const multiplier=(weapon:Weapon,tag:Tag)=> weapon==="torpedo"&&(tag==="capital"||tag==="carrier")?2.05:weapon==="air"&&tag==="armor"?1.55:weapon==="missile"&&tag==="carrier"?1.45:weapon==="cannon"&&tag==="vehicle"?1.4:weapon==="rail"&&tag==="future"?1.25:1;
    const damageAfterArmor=(raw:number,armor:number,weapon:Weapon,tag:Tag)=>raw*multiplier(weapon,tag)*(100/(100+armor))*(.91+Math.random()*.18);
    const fire=(x:number,y:number,angle:number,spec:UnitSpec,owner:"player"|number,ownerFaction:Faction,boost=1)=>{
      const speed=spec.weapon==="torpedo"?260:spec.weapon==="missile"?390:spec.weapon==="rail"?610:430;
      game.current.shots.push({x:x+Math.cos(angle)*18,y:y+Math.sin(angle)*18,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,life:spec.range/speed,damage:spec.damage*boost,weapon:spec.weapon,faction:ownerFaction,owner,radius:spec.weapon==="missile"?5:spec.weapon==="torpedo"?6:3});
    };
    const gainXp=(amount:number)=>{
      const g=game.current; g.xp+=amount;
      while(g.level<20 && g.xp>=xpNeed(g.level)){g.xp-=xpNeed(g.level);g.level++;setMessages(m=>[...m.slice(-4),`[系統] 指揮等級升到 ${g.level} 級`]);}
    };
    const drawUnit=(x:number,y:number,angle:number,spec:UnitSpec,color:string,isPlayer=false)=>{
      ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.shadowColor=color;ctx.shadowBlur=isPlayer?13:5;ctx.lineWidth=isPlayer?2.5:1.5;ctx.strokeStyle=isPlayer?"#fff":color;ctx.fillStyle=color+"b8";
      if(spec.domain==="sea"){
        ctx.beginPath();ctx.moveTo(22,0);ctx.lineTo(9,-10);ctx.lineTo(-17,-9);ctx.lineTo(-23,0);ctx.lineTo(-17,9);ctx.lineTo(9,10);ctx.closePath();ctx.fill();ctx.stroke();
        ctx.fillStyle="#08131e";ctx.fillRect(-5,-5,11,10); if(spec.tag==="carrier"){ctx.fillStyle="#c8d8df";ctx.fillRect(-15,-3,28,6);}
      }else{
        ctx.fillRect(-17,-11,34,22);ctx.strokeRect(-17,-11,34,22);ctx.fillStyle="#071117";ctx.fillRect(-7,-7,15,14);ctx.fillStyle=color;ctx.fillRect(0,-2,23,4);
        if(spec.tag==="future"){ctx.beginPath();ctx.arc(-10,0,5,0,Math.PI*2);ctx.fill();}
      }
      if(isPlayer){ctx.strokeStyle=color;ctx.globalAlpha=.55;ctx.beginPath();ctx.arc(0,0,29,0,Math.PI*2);ctx.stroke();}
      ctx.restore();
    };
    const resize=()=>{const r=canvas.getBoundingClientRect();const d=Math.min(devicePixelRatio,2);if(canvas.width!==r.width*d||canvas.height!==r.height*d){canvas.width=r.width*d;canvas.height=r.height*d;canvas.style.width=r.width+"px";canvas.style.height=r.height+"px";}ctx.setTransform(d,0,0,d,0,0);game.current.width=r.width;game.current.height=r.height;};
    const loop=(now:number)=>{
      resize(); const g=game.current,w=g.width,h=g.height,spec=selected; const dt=Math.min((now-g.last)/1000,.033);g.last=now;g.uiTick+=dt;g.minute-=dt;
      if(g.minute<=0){const rank=[{score:g.score},...g.bots.map(b=>({score:b.score}))].sort((a,b)=>b.score-a.score).findIndex(x=>x.score===g.score)+1;if(rank<=10){const reward=Math.max(1,Math.round(spec.expValue*.01));gainXp(reward);setMessages(m=>[...m.slice(-4),`[排行] TOP10 每分鐘獎勵 +${reward} 經驗`]);}g.minute=60;}
      const p=g.player; p.fireCd=Math.max(0,p.fireCd-dt);p.abilityCd=Math.max(0,p.abilityCd-dt);p.invuln=Math.max(0,p.invuln-dt);
      const dx=(keys.current.d||keys.current.arrowright?1:0)-(keys.current.a||keys.current.arrowleft?1:0),dy=(keys.current.s||keys.current.arrowdown?1:0)-(keys.current.w||keys.current.arrowup?1:0);const mag=Math.hypot(dx,dy)||1;
      let nx=Math.max(24,Math.min(w-24,p.x+dx/mag*spec.speed*dt)),ny=Math.max(30,Math.min(h-28,p.y+dy/mag*spec.speed*dt)); if(isValid(nx,ny,spec.domain,w)){p.x=nx;p.y=ny;}
      if(dx||dy)p.angle=Math.atan2(dy,dx); if(mouse.current.x||mouse.current.y)p.angle=Math.atan2(mouse.current.y-p.y,mouse.current.x-p.x);
      if((mouse.current.down||keys.current[" "])&&p.fireCd<=0){fire(p.x,p.y,p.angle,spec,"player",faction);p.fireCd=spec.fireRate;}
      if(keys.current.q&&p.abilityCd<=0){p.abilityCd=10;if(spec.id==="starbreaker"||spec.weapon==="missile"){for(let i=-2;i<=2;i++)fire(p.x,p.y,p.angle+i*.13,spec,"player",faction,1.1);}else if(spec.weapon==="air"){for(let i=0;i<5;i++)fire(p.x,p.y,p.angle+(i-2)*.16,spec,"player",faction,1.25);}else if(spec.id==="dustlynx"){p.x+=Math.cos(p.angle)*70;p.y+=Math.sin(p.angle)*70;}else{p.invuln=3;}keys.current.q=false;}
      for(const e of g.energy){e.pulse+=dt;const dist=Math.hypot(e.x-p.x,e.y-p.y);if(dist<145){const pull=(145-dist)*2.8+40;e.x+=(p.x-e.x)/Math.max(dist,1)*pull*dt;e.y+=(p.y-e.y)/Math.max(dist,1)*pull*dt;}if(dist<24){gainXp(e.value);g.score+=e.tier*7;spawnEnergy(e,w,h);}}
      for(const b of g.bots){if(b.respawn>0){b.respawn-=dt;if(b.respawn<=0){b.hp=b.maxHp;b.x=b.spec.domain==="sea"?45+Math.random()*w*.48:w*.64+Math.random()*w*.3;b.y=50+Math.random()*(h-100);}continue;}b.fireCd=Math.max(0,b.fireCd-dt);let tx=p.x,ty=p.y;const hostile=b.faction!==faction;const dist=Math.hypot(tx-b.x,ty-b.y);if(hostile&&dist<520){b.angle=Math.atan2(ty-b.y,tx-b.x);if(dist>b.spec.range*.72){const bx=b.x+Math.cos(b.angle)*b.spec.speed*.43*dt,by=b.y+Math.sin(b.angle)*b.spec.speed*.43*dt;if(isValid(bx,by,b.spec.domain,w)){b.x=bx;b.y=by;}}if(dist<b.spec.range&&b.fireCd<=0){fire(b.x,b.y,b.angle,b.spec,b.id,b.faction);b.fireCd=b.spec.fireRate*1.35;}}else{b.angle+=Math.sin(now*.0005+b.id)*.018;const bx=b.x+Math.cos(b.angle)*b.spec.speed*.18*dt,by=b.y+Math.sin(b.angle)*b.spec.speed*.18*dt;if(isValid(bx,by,b.spec.domain,w)){b.x=bx;b.y=by;}else b.angle+=Math.PI*.7;}}
      for(const plane of g.planes){plane.cooldown-=dt;plane.angle+=dt*1.2;plane.x=p.x+Math.cos(plane.angle)*plane.orbit;plane.y=p.y+Math.sin(plane.angle)*plane.orbit*.55;const target=g.bots.filter(b=>b.respawn<=0&&b.faction!==faction).sort((a,b)=>Math.hypot(a.x-plane.x,a.y-plane.y)-Math.hypot(b.x-plane.x,b.y-plane.y))[0];if(target&&plane.cooldown<=0&&Math.hypot(target.x-plane.x,target.y-plane.y)<390){fire(plane.x,plane.y,Math.atan2(target.y-plane.y,target.x-plane.x),spec,"player",faction,.58);plane.cooldown=1.6;}}
      for(let i=g.shots.length-1;i>=0;i--){const s=g.shots[i];s.x+=s.vx*dt;s.y+=s.vy*dt;s.life-=dt;let hit=false;if(s.owner!=="player"&&s.faction!==faction&&p.invuln<=0&&Math.hypot(s.x-p.x,s.y-p.y)<20){p.hp-=damageAfterArmor(s.damage,spec.armor,s.weapon,spec.tag);hit=true;if(p.hp<=0){p.hp=spec.hp;p.invuln=3;g.score=Math.max(0,g.score-40);p.x=spec.domain==="sea"?w*.22:w*.78;p.y=h*.52;setMessages(m=>[...m.slice(-4),"[戰況] 單位重構完成，返到前線"]);}}if(s.faction===faction||s.owner==="player"){for(const b of g.bots){if(b.respawn<=0&&b.faction!==s.faction&&Math.hypot(s.x-b.x,s.y-b.y)<20){b.hp-=damageAfterArmor(s.damage,b.spec.armor,s.weapon,b.spec.tag);hit=true;if(b.hp<=0){b.respawn=4.5;b.score=Math.max(0,b.score-15);if(s.owner==="player"){const reward=Math.round(b.spec.expValue*.25);gainXp(reward);g.score+=Math.round(b.spec.expValue*.13);g.kills++;setMessages(m=>[...m.slice(-4),`[戰果] 擊毀 ${b.spec.name}，+${reward} 經驗`]);}}break;}}}if(hit||s.life<=0||s.x<0||s.x>w||s.y<0||s.y>h)g.shots.splice(i,1);}
      ctx.clearRect(0,0,w,h);const coastPoints:Array<[number,number]>=[];for(let y=0;y<=h+20;y+=20)coastPoints.push([coastX(y,w),y]);
      const ocean=ctx.createLinearGradient(0,0,w*.6,h);ocean.addColorStop(0,"#061d2c");ocean.addColorStop(1,"#0b3c50");ctx.fillStyle=ocean;ctx.fillRect(0,0,w,h);
      ctx.save();ctx.beginPath();ctx.moveTo(coastPoints[0][0],0);for(const q of coastPoints)ctx.lineTo(q[0],q[1]);ctx.lineTo(w,h);ctx.lineTo(w,0);ctx.closePath();const land=ctx.createLinearGradient(w*.57,0,w,h);land.addColorStop(0,"#263526");land.addColorStop(1,"#18291f");ctx.fillStyle=land;ctx.fill();ctx.restore();
      ctx.strokeStyle="#76e0d366";ctx.lineWidth=2;ctx.beginPath();coastPoints.forEach((q,i)=>i?ctx.lineTo(q[0],q[1]):ctx.moveTo(q[0],q[1]));ctx.stroke();
      ctx.globalAlpha=.12;ctx.strokeStyle="#76d7ff";for(let y=30;y<h;y+=58){ctx.beginPath();ctx.moveTo(10,y);ctx.bezierCurveTo(w*.18,y-12,w*.35,y+14,w*.54,y);ctx.stroke();}ctx.globalAlpha=1;
      ctx.fillStyle="#647a5b55";for(let i=0;i<7;i++){const x=w*(.65+(i%3)*.11),y=80+Math.floor(i/3)*180+(i%2)*45;ctx.fillRect(x,y,46+(i%2)*25,35);ctx.strokeStyle="#9fb28a55";ctx.strokeRect(x,y,46+(i%2)*25,35);}ctx.font="10px monospace";ctx.fillStyle="#a7bd9c";ctx.fillText("灰港城",w*.74,52);ctx.fillText("前沿基地",w*.85,h-42);
      for(const e of g.energy){const colors=["","#7af2d0","#ffd76b","#ff8af2"];ctx.save();ctx.translate(e.x,e.y);ctx.rotate(e.pulse);ctx.shadowColor=colors[e.tier];ctx.shadowBlur=12+e.tier*4;ctx.strokeStyle=colors[e.tier];ctx.lineWidth=2;ctx.beginPath();for(let i=0;i<6;i++){const a=i*Math.PI/3;(i?ctx.lineTo:ctx.moveTo).call(ctx,Math.cos(a)*(7+e.tier*2),Math.sin(a)*(7+e.tier*2));}ctx.closePath();ctx.stroke();ctx.fillStyle=colors[e.tier]+"33";ctx.fill();ctx.restore();}
      for(const s of g.shots){ctx.fillStyle=weaponColor[s.weapon];ctx.shadowColor=ctx.fillStyle;ctx.shadowBlur=9;ctx.beginPath();ctx.arc(s.x,s.y,s.radius,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;}
      for(const b of g.bots){if(b.respawn>0)continue;drawUnit(b.x,b.y,b.angle,b.spec,factionColor[b.faction]);ctx.fillStyle="#02080b99";ctx.fillRect(b.x-18,b.y-24,36,4);ctx.fillStyle=factionColor[b.faction];ctx.fillRect(b.x-18,b.y-24,36*(b.hp/b.maxHp),4);ctx.font="9px monospace";ctx.textAlign="center";ctx.fillStyle="#c7d7da";ctx.fillText(b.name,b.x,b.y-29);}
      for(const pl of g.planes){ctx.save();ctx.translate(pl.x,pl.y);ctx.rotate(pl.angle+Math.PI/2);ctx.fillStyle=factionColor[pl.faction];ctx.beginPath();ctx.moveTo(0,-7);ctx.lineTo(5,6);ctx.lineTo(0,3);ctx.lineTo(-5,6);ctx.closePath();ctx.fill();ctx.restore();}
      drawUnit(p.x,p.y,p.angle,spec,factionColor[faction],true);ctx.textAlign="center";ctx.font="bold 10px monospace";ctx.fillStyle="#fff";ctx.fillText("你",p.x,p.y-35);
      if(g.uiTick>.12){g.uiTick=0;const rows=[{name:"你",score:g.score,self:true,faction},...g.bots.map(b=>({name:b.name,score:b.score,faction:b.faction}))].sort((a,b)=>b.score-a.score).slice(0,10);const rank=[{score:g.score,self:true},...g.bots.map(b=>({score:b.score,self:false}))].sort((a,b)=>b.score-a.score).findIndex(x=>x.self)+1;setLeaders(rows);setHud({hp:Math.max(0,Math.round(p.hp)),maxHp:spec.hp,level:g.level,xp:Math.round(g.xp),next:xpNeed(g.level),score:g.score,kills:g.kills,rank,rewardIn:Math.ceil(g.minute),ability:Math.ceil(p.abilityCd),red:g.redBase,blue:g.blueBase});}
      raf=requestAnimationFrame(loop);
    };
    raf=requestAnimationFrame(loop);return()=>cancelAnimationFrame(raf);
  },[phase,selected,faction]);

  const pointer=(e:React.PointerEvent<HTMLCanvasElement>)=>{const r=e.currentTarget.getBoundingClientRect();mouse.current.x=e.clientX-r.left;mouse.current.y=e.clientY-r.top;};
  const sendChat=(e:FormEvent)=>{e.preventDefault();if(!chatInput.trim())return;setMessages(m=>[...m.slice(-5),`[${chatMode}] 你：${chatInput.trim()}`]);setChatInput("");};

  return <main className="game-shell">
    {phase==="lobby" ? <section className="lobby">
      <div className="scanlines" />
      <header className="brandbar"><div className="brandmark">RT</div><div><b>裂潮戰線</b><span>海陸即時戰爭原型</span></div><button onClick={()=>setShowBlueprint(true)}>遊戲藍圖</button></header>
      <div className="lobby-grid">
        <div className="hero-copy"><div className="eyebrow">伺服器 01 · 邊境海域</div><h1>海陸一圖，<br/><em>全域開戰。</em></h1><p>揸住原創艦艇同未來戰車，搶會主動匯聚嘅能源核心。冇絕對強者，只有啱嘅編隊同時機。</p><div className="server-row"><span className="live-dot"/>伺服器在線 <b>128</b><span>平均延遲 32ms</span></div></div>
        <div className="enlist-card"><div className="assignment"><span>系統已經分配陣營</span><strong style={{color:factionColor[faction]}}>{faction}</strong><small>每局自動平衡，唔影響帳號成長</small></div><h2>揀出擊單位</h2><div className="domain-tabs"><span>海軍單位</span><span>陸軍單位</span></div><div className="unit-grid">{UNITS.map(u=><button key={u.id} className={`unit-card ${selectedId===u.id?"selected":""}`} onClick={()=>setSelectedId(u.id)}><i>{u.domain==="sea"?"艦":"陸"}</i><div><b>{u.name}</b><span>{u.subtitle}</span></div><small>LV.{u.unlock}</small></button>)}</div><div className="selected-stats"><span>耐久 <b>{selected.hp}</b></span><span>機動 <b>{selected.speed}</b></span><span>火力 <b>{selected.damage}</b></span><span>裝甲 <b>{selected.armor}</b></span></div><button className="deploy" onClick={startGame}>即刻出擊 <kbd>ENTER</kbd></button><p className="prototype-note">原型體驗模式：全部單位已經開放 · 正式成長會跟等級解鎖</p></div>
      </div>
      <footer className="lobby-footer"><span>WASD 移動</span><span>滑鼠瞄準 / 左鍵射擊</span><span>Q 戰術技能</span><span>能源自動吸附</span></footer>
    </section> : <section className="battle" ref={wrapRef}>
      <canvas ref={canvasRef} onPointerMove={pointer} onPointerDown={e=>{pointer(e);mouse.current.down=true}} onPointerUp={()=>mouse.current.down=false} onPointerLeave={()=>mouse.current.down=false}/>
      <div className="top-hud"><div className="player-id"><span className="faction-chip" style={{background:factionColor[faction]}}>{faction[0]}</span><div><b>無名指揮官 <small>LV.{hud.level}</small></b><span>{selected.name} · {selected.weapon.toUpperCase()}</span></div></div><div className="war-score"><div className="red"><b>{hud.red}</b><span>赤潮主基地</span></div><div className="battle-clock">能源爭奪戰<small>全域交戰緊</small></div><div className="blue"><b>{hud.blue}</b><span>藍穹主基地</span></div></div><div className="top-actions"><button onClick={()=>setShowBlueprint(true)}>戰術檔案</button><button onClick={()=>setPhase("lobby")}>離開戰場</button></div></div>
      <aside className="leaderboard"><div className="panel-title"><span>戰鬥積分</span><b>頭十名</b></div><div className="reward-timer">榜內每分鐘 +1% 單位經驗 <strong>{hud.rewardIn}s</strong></div>{leaders.map((r,i)=><div className={`leader-row ${r.self?"self":""}`} key={r.name}><em>{String(i+1).padStart(2,"0")}</em><i style={{background:factionColor[r.faction]}}/><span>{r.name}</span><b>{r.score}</b></div>)}</aside>
      <div className="status-panel"><div className="hp-label"><span>結構完整度</span><b>{hud.hp} / {hud.maxHp}</b></div><div className="bar hp"><i style={{width:`${hud.hp/hud.maxHp*100}%`}}/></div><div className="xp-label"><span>指揮經驗 · LV.{hud.level}</span><b>{hud.xp} / {hud.next}</b></div><div className="bar xp"><i style={{width:`${hud.xp/hud.next*100}%`}}/></div><div className="stat-strip"><span>擊毀 <b>{hud.kills}</b></span><span>積分 <b>{hud.score}</b></span><span>排名 <b>#{hud.rank}</b></span></div></div>
      <div className="chat-panel"><div className="chat-tabs"><button className={chatMode==="全部"?"active":""} onClick={()=>setChatMode("全部")}>全部</button><button className={chatMode==="隊伍"?"active":""} onClick={()=>setChatMode("隊伍")}>隊伍</button></div><div className="messages">{messages.map((m,i)=><p key={i}>{m}</p>)}</div><form onSubmit={sendChat}><input value={chatInput} onChange={e=>setChatInput(e.target.value)} placeholder="撳 Enter 傳送訊息" maxLength={80}/><button>傳送</button></form></div>
      <div className="ability-dock"><div className="weapon-slot"><small>主武器</small><b style={{color:weaponColor[selected.weapon]}}>{selected.weapon==="torpedo"?"深水魚雷":selected.weapon==="missile"?"脈衝導彈":selected.weapon==="air"?"艦載機羣":selected.weapon==="rail"?"磁軌炮":"聚能炮"}</b><kbd>左鍵</kbd></div><div className={`ability-slot ${hud.ability?"cooling":""}`}><small>戰術能力</small><b>{selected.ability}</b><kbd>{hud.ability?hud.ability+"s":"Q"}</kbd></div></div>
      <div className="controls-hint"><span>WASD</span> 移動　<span>滑鼠</span> 瞄準　<span>左鍵</span> 射擊　<span>Q</span> 技能</div>
      <div className="minimap"><div className="mini-sea"/><div className="mini-land"/><i className="you-dot" style={{background:factionColor[faction]}}/><span>戰術地圖</span></div>
      <div className="mobile-controls"><div><button onPointerDown={()=>keys.current.w=true} onPointerUp={()=>keys.current.w=false}>↑</button><button onPointerDown={()=>keys.current.a=true} onPointerUp={()=>keys.current.a=false}>←</button><button onPointerDown={()=>keys.current.s=true} onPointerUp={()=>keys.current.s=false}>↓</button><button onPointerDown={()=>keys.current.d=true} onPointerUp={()=>keys.current.d=false}>→</button></div><button className="mobile-fire" onPointerDown={()=>mouse.current.down=true} onPointerUp={()=>mouse.current.down=false}>開火</button></div>
    </section>}
    {showBlueprint&&<div className="modal-backdrop" onMouseDown={()=>setShowBlueprint(false)}><article className="blueprint" onMouseDown={e=>e.stopPropagation()}><button className="modal-close" onClick={()=>setShowBlueprint(false)}>×</button><div className="eyebrow">製作藍圖 · 版本 0.1</div><h2>裂潮戰線：由原型去到萬人世界</h2><div className="blueprint-grid"><section><b>核心循環</b><p>揀單位 → 搶能源 → 跨域擊殺 → 升級解鎖 → 攻破基地。每局 18–25 分鐘，長期等級 1–20。</p></section><section><b>權威伺服器</b><p>客戶端只會提交輸入；分區戰鬥服以 20Hz 演算移動、碰撞同傷害，10Hz 廣播快照。</p></section><section><b>公平剋制</b><p>魚雷克大型艦、空軍克裝甲、導彈克母艦、重炮克無人平臺；組隊集火永遠有效。</p></section><section><b>持久數據</b><p>帳號、等級、單位庫同戰績會入關係數據庫；即時排名同會話會入記憶體快取。</p></section><section><b>規模路線</b><p>原型單一實例 → 房間分片 → 區域服 → 跨區戰場同持久世界事件，邏輯保持伺服器權威。</p></section><section><b>商業化邊界</b><p>只賣外觀、通行證同便利收藏；唔賣戰鬥屬性，賽季單位靠遊玩解鎖。</p></section></div><a href="/RIFT-TIDE-GDD.md" download>下載完整 GDD</a></article></div>}
  </main>;
}
