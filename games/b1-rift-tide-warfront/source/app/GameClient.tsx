"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

type Faction = "赤潮聯隊" | "藍穹同盟";
type Weapon = "cannon" | "torpedo" | "depth" | "missile" | "air";
type Hull = "patrol" | "destroyer" | "submarine" | "cruiser" | "carrier";

type ShipSpec = {
  id: Hull;
  name: string;
  subtitle: string;
  unlock: number;
  hp: number;
  speed: number;
  turn: number;
  damage: number;
  range: number;
  reload: number;
  radar: number;
  weapon: Weapon;
  expValue: number;
  ability: string;
};

type Bot = {
  id: number;
  x: number;
  y: number;
  angle: number;
  hp: number;
  maxHp: number;
  faction: Faction;
  spec: ShipSpec;
  name: string;
  score: number;
  fireCd: number;
  respawn: number;
  drift: number;
};

type Shot = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  damage: number;
  weapon: Weapon;
  faction: Faction;
  owner: "player" | number;
  radius: number;
};

type Crate = { x: number; y: number; value: number; pulse: number; tier: 1 | 2 | 3 };
type Wake = { x: number; y: number; life: number; size: number };
type PhraseKey = "start" | "crate" | "fire" | "spot" | "hit" | "level" | "sink" | "danger" | "respawn" | "ability";
type Phrase = { line: string; jyutping: string; meaning: string; cue: string };

const SHIPS: ShipSpec[] = [
  { id: "patrol", name: "刃鰭巡邏艇", subtitle: "高速開局 · 食箱升級", unlock: 1, hp: 360, speed: 178, turn: 3.25, damage: 44, range: 250, reload: .36, radar: 430, weapon: "cannon", expValue: 240, ability: "引擎加壓" },
  { id: "destroyer", name: "礁衞驅逐艦", subtitle: "主炮連射 · 反潛護航", unlock: 4, hp: 760, speed: 132, turn: 2.35, damage: 62, range: 340, reload: .52, radar: 520, weapon: "depth", expValue: 520, ability: "深彈扇面" },
  { id: "submarine", name: "幽灣潛艇", subtitle: "低可見度 · 魚雷伏擊", unlock: 6, hp: 520, speed: 112, turn: 1.9, damage: 132, range: 370, reload: 1.25, radar: 360, weapon: "torpedo", expValue: 680, ability: "靜默下潛" },
  { id: "cruiser", name: "星槌巡洋艦", subtitle: "遠距鎖定 · 導彈壓制", unlock: 10, hp: 1480, speed: 92, turn: 1.42, damage: 118, range: 520, reload: .95, radar: 650, weapon: "missile", expValue: 1050, ability: "齊射鎖定" },
  { id: "carrier", name: "雲鯨航母", subtitle: "艦載機巡弋 · 區域支援", unlock: 15, hp: 2100, speed: 66, turn: 1.05, damage: 48, range: 470, reload: .42, radar: 720, weapon: "air", expValue: 1450, ability: "全翼出擊" },
];

const BOT_NAMES = ["霜線", "北辰", "零號錨", "燧石", "海霧", "野火", "長風", "稜鏡", "沉沙", "遠雷", "幽灣", "白塔", "逆潮", "流螢"];
const weaponColor: Record<Weapon, string> = { cannon: "#ffd16a", torpedo: "#65efff", depth: "#9dffba", missile: "#ff7c61", air: "#d8b4ff" };
const factionColor: Record<Faction, string> = { 赤潮聯隊: "#ff4f62", 藍穹同盟: "#3bc4ff" };
const xpNeed = (level: number) => Math.round(level * level * 70 * (level <= 5 ? 1 : level <= 10 ? 1.35 : 1.85));
const PHRASES: Record<PhraseKey, Phrase[]> = {
  start: [
    { line: "開船喇，望實雷達！", jyutping: "hoi1 syun4 laa3, mong6 sat6 leoi4 daat6", meaning: "即係：出發喇，要留意雷達。", cue: "出海" },
    { line: "慢慢嚟，先搵補給箱。", jyutping: "maan6 maan6 lei4, sin1 wan2 bou2 kap1 soeng1", meaning: "即係：唔使急，先去搵補給。", cue: "出海" },
  ],
  crate: [
    { line: "好嘢，執到補給！", jyutping: "hou2 je5, zap1 dou2 bou2 kap1", meaning: "即係：好彩，攞到有用物資。", cue: "補給" },
    { line: "食箱先，升級快好多。", jyutping: "sik6 soeng1 sin1, sing1 kap1 faai3 hou2 do1", meaning: "即係：先攞箱，會快啲升級。", cue: "補給" },
    { line: "呢個箱好肥，唔好放過。", jyutping: "ni1 go3 soeng1 hou2 fei4, m4 hou2 fong3 gwo3", meaning: "即係：呢個箱好抵攞。", cue: "補給" },
  ],
  fire: [
    { line: "瞄準先，唔好亂射！", jyutping: "miu4 zeon2 sin1, m4 hou2 lyun6 se6", meaning: "即係：望準先射，唔好嘥炮。", cue: "開火" },
    { line: "開火！逼佢轉向。", jyutping: "hoi1 fo2, bik1 keoi5 zyun2 hoeng3", meaning: "即係：射佢，令佢改方向。", cue: "開火" },
  ],
  spot: [
    { line: "雷達有影，準備交火。", jyutping: "leoi4 daat6 jau5 jing2, zeon2 bei6 gaau1 fo2", meaning: "即係：雷達見到敵人，準備打。", cue: "雷達" },
    { line: "敵艦入圈，保持距離。", jyutping: "dik6 laam6 jap6 hyun1, bou2 ci4 keoi5 lei4", meaning: "即係：敵艦入咗雷達圈，唔好太近。", cue: "雷達" },
  ],
  hit: [
    { line: "中咗炮，快啲拉開！", jyutping: "zung3 zo2 paau3, faai3 di1 laai1 hoi1", meaning: "即係：畀人打中，要快啲走位。", cue: "受擊" },
    { line: "船體跌緊，唔好硬頂。", jyutping: "syun4 tai2 dit3 gan2, m4 hou2 ngaang6 ding2", meaning: "即係：船就快頂唔順，要避一避。", cue: "受擊" },
  ],
  level: [
    { line: "升級喇，船體硬淨咗！", jyutping: "sing1 kap1 laa3, syun4 tai2 ngaang6 zeng6 zo2", meaning: "即係：升咗級，艘船更襟打。", cue: "升級" },
    { line: "好，裝填快咗少少。", jyutping: "hou2, zong1 tin4 faai3 zo2 siu2 siu2", meaning: "即係：重新裝彈快咗啲。", cue: "升級" },
  ],
  sink: [
    { line: "擊沉咗！做得好！", jyutping: "gik1 cam4 zo2, zou6 dak1 hou2", meaning: "即係：打沉敵艦，表現好好。", cue: "戰果" },
    { line: "靚預判，佢走唔甩。", jyutping: "leng3 jyu6 pun3, keoi5 zau2 m4 lat1", meaning: "即係：你估中佢點走，打得準。", cue: "戰果" },
  ],
  danger: [
    { line: "血量低，搵位走！", jyutping: "hyut3 loeng6 dai1, wan2 wai2 zau2", meaning: "即係：快冇血，要搵路撤退。", cue: "危險" },
    { line: "唔夠打就兜圈，唔好衝。", jyutping: "m4 gau3 daa2 zau6 dau1 hyun1, m4 hou2 cung1", meaning: "即係：打唔贏就繞路，唔好硬衝。", cue: "危險" },
  ],
  respawn: [
    { line: "唔緊要，返嚟再打。", jyutping: "m4 gan2 jiu3, faan1 lei4 zoi3 daa2", meaning: "即係：輸一次唔怕，再試多次。", cue: "重生" },
    { line: "今次學到嘢，下次避炮。", jyutping: "gam1 ci3 hok6 dou2 je5, haa6 ci3 bei6 paau3", meaning: "即係：今次記住教訓，下次避開炮火。", cue: "重生" },
  ],
  ability: [
    { line: "技能開咗，把握時機！", jyutping: "gei6 nang4 hoi1 zo2, baa2 ak1 si4 gei1", meaning: "即係：技能已經用咗，要趁機行動。", cue: "技能" },
    { line: "呢招要留畀關鍵位。", jyutping: "ni1 ziu1 jiu3 lau4 bei2 gwaan1 gin6 wai2", meaning: "即係：呢個技能要留到重要時刻。", cue: "技能" },
  ],
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function angleDiff(target: number, current: number) {
  return Math.atan2(Math.sin(target - current), Math.cos(target - current));
}

export default function GameClient() {
  const [faction, setFaction] = useState<Faction>("藍穹同盟");
  const [selectedId, setSelectedId] = useState<Hull>("patrol");
  const [phase, setPhase] = useState<"lobby" | "battle">("lobby");
  const [showBlueprint, setShowBlueprint] = useState(false);
  const [chatMode, setChatMode] = useState<"全部" | "隊伍">("隊伍");
  const [chatInput, setChatInput] = useState("");
  const [messages, setMessages] = useState(["[系統] 歡迎嚟到裂潮戰線海戰房", "[隊伍] 霜線：先食補給箱，升到二級再開火！"]);
  const [hud, setHud] = useState({ hp: 360, maxHp: 360, level: 1, xp: 0, next: 70, score: 0, kills: 0, rank: 1, reload: 0, ability: 0, radar: 430 });
  const [leaders, setLeaders] = useState<{ name: string; score: number; self?: boolean; faction: Faction }[]>([]);
  const [lesson, setLesson] = useState<Phrase>({ line: "開船喇，望實雷達！", jyutping: "hoi1 syun4 laa3, mong6 sat6 leoi4 daat6", meaning: "即係：出發喇，要留意雷達。", cue: "出海" });
  const [lessonLog, setLessonLog] = useState<Phrase[]>([]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const keys = useRef<Record<string, boolean>>({});
  const mouse = useRef({ x: 0, y: 0, down: false, right: false });
  const phraseCooldown = useRef<Record<PhraseKey, number>>({ start: 0, crate: 0, fire: 0, spot: 0, hit: 0, level: 0, sink: 0, danger: 0, respawn: 0, ability: 0 });
  const selected = useMemo(() => SHIPS.find((ship) => ship.id === selectedId) ?? SHIPS[0], [selectedId]);
  const game = useRef({
    player: { x: 0, y: 0, angle: 0, throttle: 0, hp: 360, fireCd: 0, abilityCd: 0, stealth: 0, invuln: 0 },
    bots: [] as Bot[],
    shots: [] as Shot[],
    crates: [] as Crate[],
    wakes: [] as Wake[],
    xp: 0,
    level: 1,
    score: 0,
    kills: 0,
    last: 0,
    uiTick: 0,
    width: 1200,
    height: 720,
  });

  const sayPhrase = useCallback((key: PhraseKey, minGap = 1.8) => {
    const now = performance.now() / 1000;
    if (now - phraseCooldown.current[key] < minGap) return;
    phraseCooldown.current[key] = now;
    const pool = PHRASES[key];
    const phrase = pool[Math.floor(Math.random() * pool.length)];
    setLesson(phrase);
    setLessonLog((items) => [phrase, ...items.filter((item) => item.line !== phrase.line)].slice(0, 3));
  }, []);

  useEffect(() => setFaction(Math.random() > .5 ? "赤潮聯隊" : "藍穹同盟"), []);

  const spawnCrate = (crate: Crate, width: number, height: number) => {
    crate.x = 70 + Math.random() * (width - 140);
    crate.y = 70 + Math.random() * (height - 140);
    crate.pulse = Math.random() * 6;
  };

  const resetBattle = useCallback((spec: ShipSpec) => {
    const g = game.current;
    const width = g.width;
    const height = g.height;
    g.player = { x: width * .45, y: height * .55, angle: -.25, throttle: 0, hp: spec.hp, fireCd: 0, abilityCd: 0, stealth: 0, invuln: 1.8 };
    mouse.current = { x: width * .58, y: height * .5, down: false, right: false };
    g.xp = 0;
    g.level = 1;
    g.score = 0;
    g.kills = 0;
    g.shots = [];
    g.wakes = [];
    g.crates = Array.from({ length: 20 }, (_, index) => {
      const tier = (index % 9 === 0 ? 3 : index % 4 === 0 ? 2 : 1) as 1 | 2 | 3;
      const crate = { x: 0, y: 0, tier, value: tier === 1 ? 22 : tier === 2 ? 58 : 120, pulse: 0 };
      spawnCrate(crate, width, height);
      return crate;
    });
    g.bots = Array.from({ length: 14 }, (_, index) => {
      const botSpec = SHIPS[(index * 2 + Math.floor(Math.random() * 2)) % SHIPS.length];
      const botFaction: Faction = index % 2 ? "赤潮聯隊" : "藍穹同盟";
      return {
        id: index,
        x: 70 + Math.random() * (width - 140),
        y: 70 + Math.random() * (height - 140),
        angle: Math.random() * Math.PI * 2,
        hp: botSpec.hp,
        maxHp: botSpec.hp,
        faction: botFaction,
        spec: botSpec,
        name: BOT_NAMES[index],
        score: Math.floor(Math.random() * 520),
        fireCd: Math.random(),
        respawn: 0,
        drift: Math.random() * 10,
      };
    });
    g.last = performance.now();
    setHud({ hp: spec.hp, maxHp: spec.hp, level: 1, xp: 0, next: xpNeed(1), score: 0, kills: 0, rank: 1, reload: 0, ability: 0, radar: spec.radar });
  }, []);

  const startGame = () => {
    resetBattle(selected);
    sayPhrase("start", 0);
    setPhase("battle");
  };

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright", " ", "q", "enter"].includes(key)) event.preventDefault();
      keys.current[key] = true;
      if (key === "enter" && phase === "lobby") startGame();
    };
    const up = (event: KeyboardEvent) => {
      keys.current[event.key.toLowerCase()] = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [phase, selected]);

  useEffect(() => {
    if (phase !== "battle") return;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    let raf = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const density = Math.min(devicePixelRatio, 2);
      if (canvas.width !== rect.width * density || canvas.height !== rect.height * density) {
        canvas.width = rect.width * density;
        canvas.height = rect.height * density;
      }
      ctx.setTransform(density, 0, 0, density, 0, 0);
      game.current.width = rect.width;
      game.current.height = rect.height;
    };

    const gainXp = (amount: number) => {
      const g = game.current;
      g.xp += amount;
      while (g.level < 20 && g.xp >= xpNeed(g.level)) {
        g.xp -= xpNeed(g.level);
        g.level += 1;
        g.player.hp = Math.min(selected.hp + g.level * 38, g.player.hp + 95);
        sayPhrase("level", 1);
        setMessages((items) => [...items.slice(-4), `[系統] 艦長等級升到 ${g.level}，船體加固完成`]);
      }
    };

    const shotSpeed = (weapon: Weapon) => weapon === "torpedo" ? 245 : weapon === "missile" ? 360 : weapon === "air" ? 420 : weapon === "depth" ? 210 : 510;
    const fire = (x: number, y: number, angle: number, spec: ShipSpec, owner: "player" | number, ownerFaction: Faction, boost = 1) => {
      const speed = shotSpeed(spec.weapon);
      const spread = spec.weapon === "cannon" ? (Math.random() - .5) * .06 : 0;
      game.current.shots.push({
        x: x + Math.cos(angle) * 24,
        y: y + Math.sin(angle) * 24,
        vx: Math.cos(angle + spread) * speed,
        vy: Math.sin(angle + spread) * speed,
        life: spec.range / speed,
        damage: spec.damage * boost,
        weapon: spec.weapon,
        faction: ownerFaction,
        owner,
        radius: spec.weapon === "torpedo" ? 6 : spec.weapon === "missile" ? 5 : 3,
      });
    };

    const drawShip = (x: number, y: number, angle: number, spec: ShipSpec, color: string, isPlayer = false) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.shadowColor = color;
      ctx.shadowBlur = isPlayer ? 16 : 5;
      ctx.lineWidth = isPlayer ? 2.5 : 1.5;
      ctx.strokeStyle = isPlayer ? "#ffffff" : color;
      ctx.fillStyle = `${color}c5`;
      if (spec.id === "submarine") {
        ctx.globalAlpha = isPlayer && game.current.player.stealth > 0 ? .55 : .9;
        ctx.beginPath();
        ctx.ellipse(0, 0, 24, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#071117";
        ctx.fillRect(-3, -12, 8, 7);
      } else {
        ctx.beginPath();
        ctx.moveTo(28, 0);
        ctx.lineTo(10, -12);
        ctx.lineTo(-24, -10);
        ctx.lineTo(-31, 0);
        ctx.lineTo(-24, 10);
        ctx.lineTo(10, 12);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#071117";
        ctx.fillRect(-9, -6, 18, 12);
        if (spec.id === "carrier") {
          ctx.fillStyle = "#d7e3df";
          ctx.fillRect(-21, -3, 38, 6);
        }
      }
      ctx.restore();
    };

    const loop = (now: number) => {
      resize();
      const g = game.current;
      const width = g.width;
      const height = g.height;
      const spec = selected;
      const dt = Math.min((now - g.last) / 1000, .033);
      g.last = now;
      g.uiTick += dt;
      const p = g.player;
      p.fireCd = Math.max(0, p.fireCd - dt);
      p.abilityCd = Math.max(0, p.abilityCd - dt);
      p.stealth = Math.max(0, p.stealth - dt);
      p.invuln = Math.max(0, p.invuln - dt);

      if (!mouse.current.x && !mouse.current.y) {
        mouse.current.x = p.x + Math.cos(p.angle) * 90;
        mouse.current.y = p.y + Math.sin(p.angle) * 90;
      }
      const targetAngle = Math.atan2(mouse.current.y - p.y, mouse.current.x - p.x);
      const keyboardTurn = (keys.current.d || keys.current.arrowright ? 1 : 0) - (keys.current.a || keys.current.arrowleft ? 1 : 0);
      p.angle += clamp(angleDiff(targetAngle, p.angle), -spec.turn * dt, spec.turn * dt);
      p.angle += keyboardTurn * spec.turn * dt * .35;
      const slow = keys.current.s || keys.current.arrowdown;
      const boost = keys.current.w || keys.current.arrowup;
      const desiredThrottle = slow ? .25 : boost ? 1 : .78;
      p.throttle += (desiredThrottle - p.throttle) * Math.min(1, dt * 3.2);
      p.x = clamp(p.x + Math.cos(p.angle) * spec.speed * p.throttle * dt, 34, width - 34);
      p.y = clamp(p.y + Math.sin(p.angle) * spec.speed * p.throttle * dt, 34, height - 34);
      if (Math.abs(p.throttle) > .12) g.wakes.push({ x: p.x - Math.cos(p.angle) * 24, y: p.y - Math.sin(p.angle) * 24, life: 1, size: 10 + Math.abs(p.throttle) * 18 });

      const aim = Math.atan2(mouse.current.y - p.y, mouse.current.x - p.x);
      if ((mouse.current.down || keys.current[" "]) && p.fireCd <= 0) {
        fire(p.x, p.y, aim || p.angle, spec, "player", faction, 1 + g.level * .035);
        sayPhrase("fire", 4.5);
        p.fireCd = Math.max(.14, spec.reload * (1 - Math.min(g.level, 12) * .018));
      }
      if ((keys.current.q || mouse.current.right) && p.abilityCd <= 0) {
        p.abilityCd = 10;
        sayPhrase("ability", 2);
        if (spec.id === "patrol") p.throttle = 1.45;
        if (spec.id === "submarine") p.stealth = 5;
        if (spec.id === "destroyer") for (let i = -2; i <= 2; i++) fire(p.x, p.y, p.angle + i * .2, spec, "player", faction, 1.15);
        if (spec.id === "cruiser") for (let i = -2; i <= 2; i++) fire(p.x, p.y, aim + i * .08, spec, "player", faction, 1.1);
        if (spec.id === "carrier") for (let i = 0; i < 8; i++) fire(p.x, p.y, aim + (i - 3.5) * .1, spec, "player", faction, .78);
        keys.current.q = false;
        mouse.current.right = false;
      }
      if (mouse.current.right && p.abilityCd > 0) mouse.current.right = false;

      for (const crate of g.crates) {
        crate.pulse += dt;
        const distance = Math.hypot(crate.x - p.x, crate.y - p.y);
        if (distance < 120) {
          crate.x += (p.x - crate.x) / Math.max(distance, 1) * (135 - distance) * dt * 1.8;
          crate.y += (p.y - crate.y) / Math.max(distance, 1) * (135 - distance) * dt * 1.8;
        }
        if (distance < 25) {
          gainXp(crate.value);
          sayPhrase("crate", 2.4);
          g.score += crate.tier * 10;
          spawnCrate(crate, width, height);
        }
      }

      for (const bot of g.bots) {
        if (bot.respawn > 0) {
          bot.respawn -= dt;
          if (bot.respawn <= 0) {
            bot.hp = bot.maxHp;
            bot.x = 70 + Math.random() * (width - 140);
            bot.y = 70 + Math.random() * (height - 140);
          }
          continue;
        }
        bot.fireCd = Math.max(0, bot.fireCd - dt);
        const hostile = bot.faction !== faction;
        const distance = Math.hypot(p.x - bot.x, p.y - bot.y);
        const canSeePlayer = hostile && distance < (bot.spec.radar + (p.stealth > 0 ? -220 : 0));
        const targetAngle = canSeePlayer ? Math.atan2(p.y - bot.y, p.x - bot.x) : bot.angle + Math.sin(now * .0004 + bot.drift) * .035;
        bot.angle += clamp(angleDiff(targetAngle, bot.angle), -bot.spec.turn * dt, bot.spec.turn * dt);
        const desired = canSeePlayer && distance < bot.spec.range * .68 ? .2 : .68;
        bot.x = clamp(bot.x + Math.cos(bot.angle) * bot.spec.speed * desired * dt, 34, width - 34);
        bot.y = clamp(bot.y + Math.sin(bot.angle) * bot.spec.speed * desired * dt, 34, height - 34);
        if (canSeePlayer && distance < bot.spec.range && bot.fireCd <= 0) {
          fire(bot.x, bot.y, targetAngle, bot.spec, bot.id, bot.faction, .86);
          bot.fireCd = bot.spec.reload * 1.3;
        }
        if (hostile && distance < spec.radar + g.level * 8 && distance > spec.range * .9) sayPhrase("spot", 8);
      }

      for (let i = g.shots.length - 1; i >= 0; i--) {
        const shot = g.shots[i];
        shot.x += shot.vx * dt;
        shot.y += shot.vy * dt;
        shot.life -= dt;
        let hit = false;
        if (shot.owner !== "player" && shot.faction !== faction && p.invuln <= 0 && Math.hypot(shot.x - p.x, shot.y - p.y) < 22) {
          p.hp -= shot.damage * (shot.weapon === "torpedo" && spec.id === "carrier" ? 1.55 : 1);
          sayPhrase(p.hp < spec.hp * .32 ? "danger" : "hit", 2.2);
          hit = true;
          if (p.hp <= 0) {
            p.hp = spec.hp;
            p.invuln = 3;
            p.x = width * .44;
            p.y = height * .58;
            g.score = Math.max(0, g.score - 60);
            sayPhrase("respawn", 0);
            setMessages((items) => [...items.slice(-4), "[戰況] 艦體重構完成，返到海域"]);
          }
        }
        if (shot.owner === "player" || shot.faction === faction) {
          for (const bot of g.bots) {
            if (bot.respawn <= 0 && bot.faction !== shot.faction && Math.hypot(shot.x - bot.x, shot.y - bot.y) < 22) {
              bot.hp -= shot.damage * (shot.weapon === "torpedo" && bot.spec.id === "carrier" ? 1.45 : 1);
              hit = true;
              if (bot.hp <= 0) {
                bot.respawn = 4.5;
                bot.score = Math.max(0, bot.score - 20);
                if (shot.owner === "player") {
                  const reward = Math.round(bot.spec.expValue * .26);
                  gainXp(reward);
                  sayPhrase("sink", 1);
                  g.score += Math.round(bot.spec.expValue * .14);
                  g.kills += 1;
                  setMessages((items) => [...items.slice(-4), `[戰果] 擊沉 ${bot.spec.name}，+${reward} 經驗`]);
                }
              }
              break;
            }
          }
        }
        if (hit || shot.life <= 0 || shot.x < -20 || shot.x > width + 20 || shot.y < -20 || shot.y > height + 20) g.shots.splice(i, 1);
      }

      for (let i = g.wakes.length - 1; i >= 0; i--) {
        g.wakes[i].life -= dt;
        if (g.wakes[i].life <= 0) g.wakes.splice(i, 1);
      }

      ctx.clearRect(0, 0, width, height);
      const sea = ctx.createLinearGradient(0, 0, width, height);
      sea.addColorStop(0, "#082539");
      sea.addColorStop(.55, "#0b4660");
      sea.addColorStop(1, "#061823");
      ctx.fillStyle = sea;
      ctx.fillRect(0, 0, width, height);
      ctx.globalAlpha = .12;
      ctx.strokeStyle = "#bdefff";
      for (let y = 20; y < height; y += 46) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.bezierCurveTo(width * .28, y - 12, width * .55, y + 15, width, y - 6);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#234531";
      ctx.beginPath();
      ctx.moveTo(width * .72, 0);
      ctx.lineTo(width, 0);
      ctx.lineTo(width, height * .35);
      ctx.lineTo(width * .92, height * .42);
      ctx.lineTo(width, height * .52);
      ctx.lineTo(width, height);
      ctx.lineTo(width * .84, height);
      ctx.lineTo(width * .78, height * .68);
      ctx.lineTo(width * .82, height * .42);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "#97d8b466";
      ctx.stroke();
      ctx.font = "10px monospace";
      ctx.fillStyle = "#a7d0bd";
      ctx.fillText("東岸港區", width * .84, 40);

      for (const wake of g.wakes) {
        ctx.globalAlpha = Math.max(0, wake.life) * .28;
        ctx.strokeStyle = "#d7ffff";
        ctx.beginPath();
        ctx.arc(wake.x, wake.y, wake.size * (1.2 - wake.life), 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.strokeStyle = `${factionColor[faction]}44`;
      ctx.lineWidth = 1;
      ctx.setLineDash([8, 9]);
      ctx.beginPath();
      ctx.arc(0, 0, spec.radar + g.level * 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      for (const crate of g.crates) {
        const colors = ["", "#7af2d0", "#ffd76b", "#ff8af2"];
        ctx.save();
        ctx.translate(crate.x, crate.y);
        ctx.rotate(crate.pulse);
        ctx.shadowColor = colors[crate.tier];
        ctx.shadowBlur = 14;
        ctx.strokeStyle = colors[crate.tier];
        ctx.fillStyle = `${colors[crate.tier]}2e`;
        ctx.lineWidth = 2;
        ctx.strokeRect(-8 - crate.tier, -8 - crate.tier, 16 + crate.tier * 2, 16 + crate.tier * 2);
        ctx.fillRect(-8 - crate.tier, -8 - crate.tier, 16 + crate.tier * 2, 16 + crate.tier * 2);
        ctx.restore();
      }

      for (const shot of g.shots) {
        ctx.fillStyle = weaponColor[shot.weapon];
        ctx.shadowColor = ctx.fillStyle;
        ctx.shadowBlur = 9;
        ctx.beginPath();
        ctx.arc(shot.x, shot.y, shot.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      for (const bot of g.bots) {
        if (bot.respawn > 0) continue;
        const distance = Math.hypot(bot.x - p.x, bot.y - p.y);
        if (bot.faction !== faction && distance > spec.radar + g.level * 8) continue;
        drawShip(bot.x, bot.y, bot.angle, bot.spec, factionColor[bot.faction]);
        ctx.fillStyle = "#02080b99";
        ctx.fillRect(bot.x - 22, bot.y - 28, 44, 4);
        ctx.fillStyle = factionColor[bot.faction];
        ctx.fillRect(bot.x - 22, bot.y - 28, 44 * (bot.hp / bot.maxHp), 4);
        ctx.font = "9px monospace";
        ctx.textAlign = "center";
        ctx.fillStyle = "#d6e7e9";
        ctx.fillText(bot.name, bot.x, bot.y - 34);
      }

      drawShip(p.x, p.y, p.angle, spec, factionColor[faction], true);
      ctx.textAlign = "center";
      ctx.font = "bold 10px monospace";
      ctx.fillStyle = "#fff";
      ctx.fillText("你", p.x, p.y - 38);

      if (g.uiTick > .12) {
        g.uiTick = 0;
        const rows = [{ name: "你", score: g.score, self: true, faction }, ...g.bots.map((bot) => ({ name: bot.name, score: bot.score, faction: bot.faction }))].sort((a, b) => b.score - a.score).slice(0, 10);
        const rank = [{ score: g.score, self: true }, ...g.bots.map((bot) => ({ score: bot.score, self: false }))].sort((a, b) => b.score - a.score).findIndex((row) => row.self) + 1;
        setLeaders(rows);
        setHud({ hp: Math.max(0, Math.round(p.hp)), maxHp: spec.hp + g.level * 38, level: g.level, xp: Math.round(g.xp), next: xpNeed(g.level), score: g.score, kills: g.kills, rank, reload: Math.ceil(p.fireCd * 10) / 10, ability: Math.ceil(p.abilityCd), radar: spec.radar + g.level * 8 });
      }

      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [phase, selected, faction, sayPhrase]);

  const pointer = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    mouse.current.x = event.clientX - rect.left;
    mouse.current.y = event.clientY - rect.top;
  };

  const pointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    pointer(event);
    if (event.button === 2) {
      mouse.current.right = true;
      return;
    }
    mouse.current.down = true;
  };

  const sendChat = (event: FormEvent) => {
    event.preventDefault();
    if (!chatInput.trim()) return;
    setMessages((items) => [...items.slice(-5), `[${chatMode}] 你：${chatInput.trim()}`]);
    setChatInput("");
  };

  return <main className="game-shell">
    {phase === "lobby" ? <section className="lobby">
      <div className="scanlines" />
      <header className="brandbar"><div className="brandmark">B1</div><div><b>裂潮戰線</b><span>Mk48 式俯視海戰原型</span></div><button onClick={() => setShowBlueprint(true)}>遊戲藍圖</button></header>
      <div className="lobby-grid">
        <div className="hero-copy"><div className="eyebrow">伺服器 01 · 斷灣海圖</div><h1>揸一艘艦，<br /><em>食箱升級。</em></h1><p>玩法改成即入即玩嘅俯視海戰：喺大海圖入面操控單艦，食補給箱、避開雷達盲區、用主炮、魚雷、導彈同艦載機擊沉對手。戰鬥期間會有粵語艦橋對話，邊玩邊學日常講法。</p><div className="server-row"><span className="live-dot" />海戰房在線 <b>96</b><span>平均延遲 28ms</span></div></div>
        <div className="enlist-card"><div className="assignment"><span>系統已經分配陣營</span><strong style={{ color: factionColor[faction] }}>{faction}</strong><small>陣營只影響友軍標記，核心係單艦生存同排行榜</small></div><h2>揀出擊艦種</h2><div className="unit-grid">{SHIPS.map((ship) => <button key={ship.id} className={`unit-card ${selectedId === ship.id ? "selected" : ""}`} onClick={() => setSelectedId(ship.id)}><i>{ship.id === "submarine" ? "潛" : ship.id === "carrier" ? "航" : "艦"}</i><div><b>{ship.name}</b><span>{ship.subtitle}</span></div><small>LV.{ship.unlock}</small></button>)}</div><div className="selected-stats"><span>耐久 <b>{selected.hp}</b></span><span>航速 <b>{selected.speed}</b></span><span>雷達 <b>{selected.radar}</b></span><span>射程 <b>{selected.range}</b></span></div><button className="deploy" onClick={startGame}>即刻出海 <kbd>ENTER</kbd></button><p className="prototype-note">原型體驗：全部艦種已開放 · 正式版會按艦長等級解鎖</p></div>
      </div>
      <footer className="lobby-footer"><span>滑鼠指向航行</span><span>左鍵開火</span><span>右鍵戰術武器</span><span>戰場粵語即時提示</span></footer>
    </section> : <section className="battle">
      <canvas ref={canvasRef} onPointerMove={pointer} onPointerDown={pointerDown} onPointerUp={() => mouse.current.down = false} onPointerLeave={() => mouse.current.down = false} onContextMenu={(event) => event.preventDefault()} />
      <div className="lesson-burst" aria-live="polite"><small>{lesson.cue}粵語</small><b>{lesson.line}</b><span>{lesson.jyutping}</span><em>{lesson.meaning}</em></div>
      <div className="top-hud"><div className="player-id"><span className="faction-chip" style={{ background: factionColor[faction] }}>{faction[0]}</span><div><b>無名艦長 <small>LV.{hud.level}</small></b><span>{selected.name} · 雷達 {hud.radar}</span></div></div><div className="war-score"><div><b>{hud.kills}</b><span>擊沉</span></div><div className="battle-clock">斷灣海戰<small>即時交戰緊</small></div><div><b>{hud.score}</b><span>積分</span></div></div><div className="top-actions"><button onClick={() => setShowBlueprint(true)}>戰術檔案</button><button onClick={() => setPhase("lobby")}>返去船塢</button></div></div>
      <aside className="leaderboard"><div className="panel-title"><span>海戰積分</span><b>頭十名</b></div><div className="reward-timer">食箱、擊沉同生存時間都會加分</div>{leaders.map((row, index) => <div className={`leader-row ${row.self ? "self" : ""}`} key={row.name}><em>{String(index + 1).padStart(2, "0")}</em><i style={{ background: factionColor[row.faction] }} /><span>{row.name}</span><b>{row.score}</b></div>)}</aside>
      <div className="status-panel"><div className="hp-label"><span>船體完整度</span><b>{hud.hp} / {hud.maxHp}</b></div><div className="bar hp"><i style={{ width: `${hud.hp / hud.maxHp * 100}%` }} /></div><div className="xp-label"><span>艦長經驗 · LV.{hud.level}</span><b>{hud.xp} / {hud.next}</b></div><div className="bar xp"><i style={{ width: `${hud.xp / hud.next * 100}%` }} /></div><div className="stat-strip"><span>裝填 <b>{hud.reload ? `${hud.reload}s` : "就緒"}</b></span><span>排名 <b>#{hud.rank}</b></span><span>能力 <b>{hud.ability ? `${hud.ability}s` : "Q"}</b></span></div></div>
      <div className="chat-panel"><div className="chat-tabs"><button className={chatMode === "全部" ? "active" : ""} onClick={() => setChatMode("全部")}>全部</button><button className={chatMode === "隊伍" ? "active" : ""} onClick={() => setChatMode("隊伍")}>隊伍</button></div><div className="messages">{messages.map((message, index) => <p key={index}>{message}</p>)}</div><form onSubmit={sendChat}><input value={chatInput} onChange={(event) => setChatInput(event.target.value)} placeholder="撳 Enter 傳送訊息" maxLength={80} /><button>傳送</button></form></div>
      <aside className="lesson-panel"><div className="panel-title"><span>戰場粵語</span><b>跟住講</b></div>{lessonLog.length ? lessonLog.map((item) => <div className="lesson-row" key={item.line}><strong>{item.line}</strong><span>{item.jyutping}</span><em>{item.meaning}</em></div>) : <div className="lesson-row"><strong>開船喇，望實雷達！</strong><span>hoi1 syun4 laa3, mong6 sat6 leoi4 daat6</span><em>即係：出發喇，要留意雷達。</em></div>}</aside>
      <div className="ability-dock"><div className="weapon-slot"><small>主武器</small><b style={{ color: weaponColor[selected.weapon] }}>{selected.weapon === "torpedo" ? "重型魚雷" : selected.weapon === "missile" ? "鎖定導彈" : selected.weapon === "air" ? "艦載機羣" : selected.weapon === "depth" ? "深水炸彈" : "速射主炮"}</b><kbd>左鍵</kbd></div><div className={`ability-slot ${hud.ability ? "cooling" : ""}`}><small>戰術武器</small><b>{selected.ability}</b><kbd>{hud.ability ? `${hud.ability}s` : "右鍵"}</kbd></div></div>
      <div className="controls-hint"><span>滑鼠</span> 指向航行　<span>左鍵</span> 主武器　<span>右鍵</span> 戰術武器　<span>W/S</span> 快慢速</div>
      <div className="minimap"><div className="mini-sea" /><div className="mini-land" /><i className="you-dot" style={{ background: factionColor[faction] }} /><span>雷達海圖</span></div>
      <div className="mobile-controls"><div><button onPointerDown={() => keys.current.w = true} onPointerUp={() => keys.current.w = false}>快</button><button onPointerDown={() => keys.current.a = true} onPointerUp={() => keys.current.a = false}>←</button><button onPointerDown={() => keys.current.s = true} onPointerUp={() => keys.current.s = false}>慢</button><button onPointerDown={() => keys.current.d = true} onPointerUp={() => keys.current.d = false}>→</button></div><button className="mobile-fire" onPointerDown={() => mouse.current.down = true} onPointerUp={() => mouse.current.down = false}>開火</button></div>
    </section>}
    {showBlueprint && <div className="modal-backdrop" onMouseDown={() => setShowBlueprint(false)}><article className="blueprint" onMouseDown={(event) => event.stopPropagation()}><button className="modal-close" onClick={() => setShowBlueprint(false)}>×</button><div className="eyebrow">製作藍圖 · 版本 0.3</div><h2>裂潮戰線：Mk48 式俯視海戰方向</h2><div className="blueprint-grid"><section><b>核心循環</b><p>揀艦 → 出海 → 食補給箱 → 升級船體 → 用雷達搵敵 → 擊沉對手 → 衝排行榜。</p></section><section><b>操控手感</b><p>滑鼠指向航行，船會有慣性咁轉向；左鍵開主武器，右鍵放戰術武器，W/S 只係微調快慢。</p></section><section><b>艦種分工</b><p>巡邏艇快、驅逐艦穩、潛艇伏擊、巡洋艦遠射、航母用艦載機控區。</p></section><section><b>視野系統</b><p>雷達圈決定敵艦顯示距離；潛艇技能可以短暫降低可見度，迫玩家估位同走位。</p></section><section><b>成長邊界</b><p>單局升級只加手感同存活率，正式版長線只解鎖艦種、外觀同稱號。</p></section><section><b>同 Mk48 嘅差異</b><p>保持裂潮嘅原創艦名、陣營同粵語學習設計，但介面同操作更貼近即入即玩海戰。</p></section></div><a href="/RIFT-TIDE-GDD.md" download>下載完整 GDD</a></article></div>}
  </main>;
}
