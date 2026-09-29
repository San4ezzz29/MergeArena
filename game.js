// ==========================================
// MERGE ARENA — v1.5
// + Юниты 5-6 уровней, усиленные апгрейды,
//   стрельба в несколько колонок, медленнее враги
// ==========================================

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

let W, H;
function resize() {
    W = canvas.width = Math.min(window.innerWidth, 540);
    H = canvas.height = Math.min(window.innerHeight, 960);
}
resize();
window.addEventListener('resize', resize);

// ==========================================
// 🚀 YANDEX GAMES SDK
// ==========================================
let ysdk = null;
let sdkReady = false;
let isAdShowing = false;
let userLang = 'ru';

async function initYandexSDK() {
    return new Promise((resolve) => {
        if (typeof YaGames === 'undefined') {
            console.log('Yandex SDK не найден. Локальный режим.');
            sdkReady = true;
            resolve();
            return;
        }
        YaGames.init().then(sdk => {
            ysdk = sdk;
            try { userLang = sdk.environment.i18n.lang || 'ru'; } catch (e) { userLang = 'ru'; }
            console.log('Yandex SDK инициализирован. Язык игрока:', userLang);
            try {
                if (sdk.features && sdk.features.LoadingAPI) sdk.features.LoadingAPI.ready();
            } catch (e) {}
            sdkReady = true;
            resolve();
        }).catch(err => {
            console.error('Ошибка инициализации SDK:', err);
            sdkReady = true;
            resolve();
        });
    });
}

function showRewardedAd(onReward) {
    if (!ysdk) { onReward(); return; }
    if (isAdShowing) return;
    isAdShowing = true;
    ysdk.adv.showRewardedVideo({
        callbacks: {
            onOpen: () => {},
            onRewarded: () => { onReward(); },
            onClose: () => { isAdShowing = false; },
            onError: (e) => { isAdShowing = false; console.error('Ошибка рекламы:', e); }
        }
    });
}

let lastInterstitialTime = 0;
const INTERSTITIAL_COOLDOWN = 180000;

function showInterstitialAd() {
    if (!ysdk || isAdShowing) return;
    const now = Date.now();
    if (now - lastInterstitialTime < INTERSTITIAL_COOLDOWN) return;
    lastInterstitialTime = now;
    isAdShowing = true;
    ysdk.adv.showFullscreenAdv({
        callbacks: {
            onClose: () => { isAdShowing = false; },
            onError: (e) => { isAdShowing = false; console.error('Interstitial ошибка:', e); }
        }
    });
}

// ==========================================
// 🎵 ЗВУК
// ==========================================
let audioCtx = null;
let soundMuted = localStorage.getItem('mergeArena_muted') === '1';

function initAudio() {
    if (!audioCtx) {
        try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (err) { return; }
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
}
function playTone(freq, duration, type, volume) {
    if (soundMuted || !audioCtx || isAdShowing) return;
    try {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = type || 'square';
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
        gain.gain.setValueAtTime(volume || 0.03, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
        osc.connect(gain); gain.connect(audioCtx.destination);
        osc.start(); osc.stop(audioCtx.currentTime + duration);
    } catch (err) {}
}
let _lastShootSound = 0;
function sfxShoot() { const n = performance.now(); if (n - _lastShootSound < 90) return; _lastShootSound = n; playTone(1500 + Math.random() * 200, 0.03, 'square', 0.015); }
function sfxHit()   { playTone(650 + Math.random() * 150, 0.05, 'triangle', 0.035); }
function sfxKill()  { playTone(180, 0.14, 'sawtooth', 0.05); setTimeout(() => playTone(90, 0.18, 'sawtooth', 0.04), 30); }
function sfxHurt()  { playTone(110, 0.35, 'sawtooth', 0.07); }
function sfxWaveStart() { playTone(440, 0.1, 'sine', 0.05); setTimeout(() => playTone(660, 0.12, 'sine', 0.05), 90); setTimeout(() => playTone(880, 0.15, 'sine', 0.05), 190); }
function sfxGameOver() { playTone(220, 0.3, 'sawtooth', 0.07); setTimeout(() => playTone(160, 0.4, 'sawtooth', 0.07), 200); setTimeout(() => playTone(110, 0.6, 'sawtooth', 0.07), 450); }
function sfxBuy() { playTone(700, 0.08, 'sine', 0.05); setTimeout(() => playTone(1050, 0.12, 'sine', 0.05), 70); }
function sfxError() { playTone(200, 0.15, 'square', 0.04); }
function sfxAchievement() {
    playTone(523, 0.12, 'sine', 0.06);
    setTimeout(() => playTone(659, 0.12, 'sine', 0.06), 100);
    setTimeout(() => playTone(784, 0.12, 'sine', 0.06), 200);
    setTimeout(() => playTone(1047, 0.3, 'sine', 0.06), 300);
}
function sfxCombo() { playTone(880, 0.06, 'square', 0.04); setTimeout(() => playTone(1200, 0.08, 'square', 0.04), 50); }
function sfxBossSpawn() { playTone(80, 0.5, 'sawtooth', 0.09); setTimeout(() => playTone(60, 0.7, 'sawtooth', 0.09), 300); }
function sfxBossKill() {
    playTone(220, 0.2, 'sine', 0.08);
    setTimeout(() => playTone(330, 0.2, 'sine', 0.08), 150);
    setTimeout(() => playTone(440, 0.2, 'sine', 0.08), 300);
    setTimeout(() => playTone(660, 0.5, 'sine', 0.08), 450);
}
function sfxChapter() {
    playTone(392, 0.15, 'sine', 0.07);
    setTimeout(() => playTone(523, 0.15, 'sine', 0.07), 130);
    setTimeout(() => playTone(659, 0.15, 'sine', 0.07), 260);
    setTimeout(() => playTone(784, 0.5, 'sine', 0.07), 390);
}
function sfxUpgrade() {
    playTone(600, 0.1, 'sine', 0.06);
    setTimeout(() => playTone(900, 0.12, 'sine', 0.06), 80);
    setTimeout(() => playTone(1300, 0.18, 'sine', 0.06), 160);
}
function sfxUnitDeath() { playTone(300, 0.2, 'sawtooth', 0.05); setTimeout(() => playTone(150, 0.3, 'sawtooth', 0.05), 100); }
function sfxBoost() {
    playTone(523, 0.1, 'sine', 0.07);
    setTimeout(() => playTone(784, 0.1, 'sine', 0.07), 80);
    setTimeout(() => playTone(1047, 0.1, 'sine', 0.07), 160);
    setTimeout(() => playTone(1319, 0.4, 'sine', 0.08), 240);
}

// ==========================================
// КОНСТАНТЫ
// ==========================================
const COLS = 5;
const ROWS = 6;
let CELL_SIZE = 100;
let GRID_X = 0, GRID_Y = 200;
const TOP_UI = 200;

function calcGrid() {
    const padding = 20;
    const availW = W - padding * 2;
    const availH = H - TOP_UI - 40;
    const cell = Math.min(availW / COLS, availH / ROWS);
    GRID_X = (W - cell * COLS) / 2;
    GRID_Y = TOP_UI + 20;
    return cell;
}

// 🆕 6 уровней юнитов. pierce = сколько колонок покрывает (1, 3 или 5).
const UNIT_TYPES = {
    1: { name: 'Мечник',    color: '#4ade80', accent: '#e5e7eb', damage: 1,  cooldown: 0.9,  maxHp: 8,  pierce: 1 },
    2: { name: 'Рыцарь',    color: '#60a5fa', accent: '#93c5fd', damage: 2,  cooldown: 0.7,  maxHp: 12, pierce: 1 },
    3: { name: 'Паладин',   color: '#a78bfa', accent: '#fde68a', damage: 4,  cooldown: 0.55, maxHp: 16, pierce: 1 },
    4: { name: 'Генерал',   color: '#f59e0b', accent: '#fbbf24', damage: 8,  cooldown: 0.45, maxHp: 24, pierce: 1 },
    5: { name: 'Маршал',    color: '#ec4899', accent: '#fbcfe8', damage: 16, cooldown: 0.35, maxHp: 32, pierce: 3 },
    6: { name: 'Император', color: '#e2e8f0', accent: '#fbbf24', damage: 32, cooldown: 0.3,  maxHp: 48, pierce: 5 }
};

const SHOP_UNITS = [
    { type: 1, price: 10 },
    { type: 2, price: 30 },
    { type: 3, price: 80 },
    { type: 4, price: 200 }
];

const ENEMY_TYPES = {
    normal:   { name: 'Обычный',       color: '#ef4444', hpMul: 1,   speedMul: 1,   size: 0.22, resist: 0    },
    tank:     { name: 'Толстый',       color: '#a855f7', hpMul: 3,   speedMul: 0.5, size: 0.28, resist: 0    },
    fast:     { name: 'Быстрый',       color: '#facc15', hpMul: 0.5, speedMul: 2.0, size: 0.16, resist: 0    },
    armored:  { name: 'Бронированный', color: '#94a3b8', hpMul: 2,   speedMul: 0.7, size: 0.24, resist: 0.5  },
    splitter: { name: 'Разделяющийся', color: '#22d3ee', hpMul: 1.5, speedMul: 0.9, size: 0.24, resist: 0    },
    healer:   { name: 'Целитель',      color: '#10b981', hpMul: 1.8, speedMul: 0.6, size: 0.20, resist: 0.3  },
    shooter:  { name: 'Стрелок',       color: '#d946ef', hpMul: 1.2, speedMul: 0.8, size: 0.22, resist: 0, isShooter: true },
    boss:     { name: 'БОСС',          color: '#111827', hpMul: 6,   speedMul: 0.3, size: 0.42, resist: 0.2, isShooter: true }
};

function getEnemyTypesForWave(w) {
    if (w % 10 === 0) return ['boss'];
    const pool = ['normal'];
    if (w >= 3) pool.push('tank');
    if (w >= 5) pool.push('fast');
    if (w >= 8) pool.push('shooter');
    if (w >= 10) pool.push('armored');
    if (w >= 14) pool.push('splitter');
    if (w >= 20) pool.push('healer');
    return pool;
}

// ==========================================
// 🏆 ДОСТИЖЕНИЯ
// ==========================================
const ACHIEVEMENTS = [
    { id: 'firstBlood',    icon: '🩸', name: 'Первая кровь',     desc: 'Убей первого врага',           reward: 5   },
    { id: 'mergeMaster',   icon: '🥈', name: 'Мерж-мастер',      desc: 'Собери первого Паладина',      reward: 20  },
    { id: 'generalissimo', icon: '🥇', name: 'Генералиссимус',   desc: 'Собери Генерала',              reward: 50  },
    { id: 'marshal',       icon: '🎖️', name: 'Маршал',           desc: 'Собери первого Маршала',       reward: 100 },
    { id: 'emperor',       icon: '👑', name: 'Император',         desc: 'Собери Императора',            reward: 250 },
    { id: 'richMan',       icon: '💰', name: 'Богач',            desc: 'Накопи 500 золота',            reward: 25  },
    { id: 'survivor10',    icon: '🔥', name: 'Выживший',         desc: 'Дойди до 10-й волны',          reward: 30  },
    { id: 'chapter3',      icon: '🏅', name: 'Ветеран',          desc: 'Пройди 3 главы (30 волн)',     reward: 100 },
    { id: 'chapter5',      icon: '🎯', name: 'Легенда',          desc: 'Пройди 5 глав (50 волн)',      reward: 250 },
    { id: 'untouchable',   icon: '🛡️', name: 'Непробиваемый',    desc: 'Пройди волну без потери HP',   reward: 15  },
    { id: 'sniper',        icon: '🎯', name: 'Снайпер',          desc: 'Убей 100 врагов',              reward: 30  },
    { id: 'comboMaster',   icon: '⚡', name: 'Комбо-мастер',     desc: 'Сделай комбо ×5',              reward: 20  },
    { id: 'martyr',        icon: '💀', name: 'Мученик',          desc: 'Проиграй первый раз',          reward: 5   },
    { id: 'shopaholic',    icon: '🛒', name: 'Шопоголик',        desc: 'Купи 10 юнитов',               reward: 15  },
    { id: 'bossSlayer',    icon: '👑', name: 'Убийца боссов',    desc: 'Убей первого босса',           reward: 40  },
    { id: 'upgrader',      icon: '⚙️', name: 'Инженер',          desc: 'Улучши урон 5 раз',            reward: 40  },
    { id: 'armyBoost',     icon: '🚀', name: 'Полководец',       desc: 'Используй «⚡ +1 уровень»',    reward: 30  },
    { id: 'survivedDeath', icon: '💚', name: 'Живучий',          desc: 'Потеряй юнита и отбей волну',  reward: 20  }
];

let unlocked = {};
let stats = { totalKills: 0, unitsBought: 0, maxCombo: 0, gamesPlayed: 0, bossesKilled: 0, chaptersCleared: 0, damageUpgrades: 0, unitsLost: 0, boostsUsed: 0 };
try { unlocked = JSON.parse(localStorage.getItem('mergeArena_achievements') || '{}') || {}; } catch (e) { unlocked = {}; }
try { stats = Object.assign(stats, JSON.parse(localStorage.getItem('mergeArena_stats') || '{}') || {}); } catch (e) {}

function saveProgress() {
    localStorage.setItem('mergeArena_achievements', JSON.stringify(unlocked));
    localStorage.setItem('mergeArena_stats', JSON.stringify(stats));
}
function checkAchievement(id) {
    if (unlocked[id]) return false;
    const a = ACHIEVEMENTS.find(x => x.id === id);
    if (!a) return false;
    unlocked[id] = true;
    gold += a.reward;
    achievementPopups.push({ icon: a.icon, name: a.name, reward: a.reward, life: 3.0, maxLife: 3.0 });
    sfxAchievement();
    saveProgress();
    return true;
}

// ==========================================
// СОСТОЯНИЕ
// ==========================================
let grid = [];
let damageUpgradeLevel = 0;
let hpUpgradeLevel = 0;

function getDamageMultiplier() { return 1 + damageUpgradeLevel * 0.15; } // +15% за уровень
function getHpBonus() { return hpUpgradeLevel * 2; } // +2 HP за уровень
function getDamageUpgradeCost() { return Math.floor(80 * Math.pow(1.4, damageUpgradeLevel)); }
function getHpUpgradeCost() { return Math.floor(120 * Math.pow(1.5, hpUpgradeLevel)); }
function getBoostCost() { return 500; } // фиксированная цена «+1 уровень всем»

function getUnitMaxHp(type) { return UNIT_TYPES[type].maxHp + getHpBonus(); }

function makeUnit(type) {
    return { type: type, cooldown: 0, recoil: 0, hp: getUnitMaxHp(type), maxHp: getUnitMaxHp(type), hitFlash: 0 };
}

function resetGrid() {
    grid = [];
    for (let r = 0; r < ROWS; r++) {
        grid[r] = [];
        for (let c = 0; c < COLS; c++) grid[r][c] = null;
    }
    grid[5][1] = makeUnit(1);
    grid[5][2] = makeUnit(1);
    grid[4][3] = makeUnit(2);
}
resetGrid();

let enemies = [];
let bullets = [];
let enemyBullets = [];
let flashes = [];
let floaters = [];
let particles = [];
let damageNumbers = [];
let achievementPopups = [];
let wave = 0;
let playerHp = 5;
const MAX_HP = 5;
let gold = 0;
let gameState = 'loading';
let shopOpen = false;
let achievementsOpen = false;
let notification = null;
let bestWave = parseInt(localStorage.getItem('mergeArena_bestWave') || '0', 10);
let bossWarning = 0;
let chapterBanner = 0;

let wavePhases = 0;
let currentPhase = 0;
let phaseCountdown = 0;
let allPhasesSpawned = false;
let phaseLabelTimer = 0;

let shakeTime = 0, shakeIntensity = 0;
let screenFlash = 0;
let combo = 0, comboTimer = 0;
let hpAtWaveStart = MAX_HP;
let unitsLostThisWave = 0;

let rewardedAdAvailable = true;

function notify(text, color) { notification = { text, life: 1.8, maxLife: 1.8, color: color || '#e2e8f0' }; }
function triggerShake(intensity, duration) { shakeIntensity = Math.max(shakeIntensity, intensity); shakeTime = Math.max(shakeTime, duration); }
function spawnParticles(x, y, color, count, speed, size) {
    for (let i = 0; i < count; i++) {
        const ang = Math.random() * Math.PI * 2;
        const sp = speed * (0.5 + Math.random() * 0.8);
        particles.push({
            x, y,
            vx: Math.cos(ang) * sp,
            vy: Math.sin(ang) * sp - 30,
            life: 0.4 + Math.random() * 0.3,
            maxLife: 0.7,
            color,
            size: size * (0.6 + Math.random() * 0.6)
        });
    }
}

// ==========================================
// ГЕОМЕТРИЯ UI
// ==========================================
function getMainButtons() {
    const gap = 10;
    const totalW = W - 40;
    const bw = (totalW - gap * 2) / 3;
    const bh = 56;
    const y = 110;
    return {
        ad:    { x: 20, y, w: bw, h: bh },
        shop:  { x: 20 + bw + gap, y, w: bw, h: bh },
        start: { x: 20 + (bw + gap) * 2, y, w: bw, h: bh }
    };
}
function getShopPanel() { const w = Math.min(W - 40, 440); const h = 580; return { x: (W - w) / 2, y: (H - h) / 2, w, h }; }
function getUpgradeRects() {
    const p = getShopPanel();
    const pad = 20;
    const rowH = 54;
    const halfW = (p.w - pad * 3) / 2;
    return {
        dmg:   { x: p.x + pad, y: p.y + 78, w: halfW, h: rowH },
        hp:    { x: p.x + pad * 2 + halfW, y: p.y + 78, w: halfW, h: rowH },
        boost: { x: p.x + pad, y: p.y + 78 + rowH + 8, w: p.w - pad * 2, h: rowH }
    };
}
function getShopItemRects() {
    const p = getShopPanel();
    const pad = 20, rowH = 62, gap = 8;
    const items = [];
    for (let i = 0; i < SHOP_UNITS.length; i++) {
        items.push({ x: p.x + pad, y: p.y + 78 + 54 + 8 + 54 + 16 + i * (rowH + gap), w: p.w - pad * 2, h: rowH });
    }
    return items;
}
function getSoundButton() { return { x: W - 44, y: 6, w: 36, h: 36 }; }
function getAchievementsButton() { return { x: W - 86, y: 6, w: 36, h: 36 }; }
function getAchievementsPanel() { const w = Math.min(W - 40, 440); const h = 660; return { x: (W - w) / 2, y: (H - h) / 2, w, h }; }
function inRect(px, py, r) { return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h; }

// ==========================================
// ВВОД
// ==========================================
let dragging = null;

function getPointer(e) {
    const rect = canvas.getBoundingClientRect();
    let t;
    if (e.touches && e.touches.length > 0) t = e.touches[0];
    else if (e.changedTouches && e.changedTouches.length > 0) t = e.changedTouches[0];
    else t = e;
    return { x: t.clientX - rect.left, y: t.clientY - rect.top };
}
function pickCell(px, py) {
    const cell = CELL_SIZE;
    const col = Math.floor((px - GRID_X) / cell);
    const row = Math.floor((py - GRID_Y) / cell);
    if (row >= 0 && row < ROWS && col >= 0 && col < COLS) return { row, col };
    return null;
}

canvas.addEventListener('mousedown', e => onDown(e));
canvas.addEventListener('mousemove', e => onMove(e));
canvas.addEventListener('mouseup', e => onUp(e));
canvas.addEventListener('touchstart', e => { e.preventDefault(); onDown(e); }, { passive: false });
canvas.addEventListener('touchmove', e => { e.preventDefault(); onMove(e); }, { passive: false });
canvas.addEventListener('touchend', e => { e.preventDefault(); onUp(e); }, { passive: false });

function onDown(e) {
    if (isAdShowing || gameState === 'loading') return;
    initAudio();
    const p = getPointer(e);

    if (inRect(p.x, p.y, getSoundButton())) {
        soundMuted = !soundMuted;
        localStorage.setItem('mergeArena_muted', soundMuted ? '1' : '0');
        if (!soundMuted) { playTone(900, 0.08, 'sine', 0.05); setTimeout(() => playTone(1300, 0.12, 'sine', 0.05), 80); }
        return;
    }
    if (inRect(p.x, p.y, getAchievementsButton())) { achievementsOpen = !achievementsOpen; shopOpen = false; return; }

    if (achievementsOpen) {
        const panel = getAchievementsPanel();
        if (!inRect(p.x, p.y, panel)) { achievementsOpen = false; return; }
        const closeBtn = { x: panel.x + panel.w - 50, y: panel.y + 10, w: 40, h: 40 };
        if (inRect(p.x, p.y, closeBtn)) { achievementsOpen = false; return; }
        return;
    }

    if (gameState === 'gameover') { restart(); return; }

    if (shopOpen) {
        const panel = getShopPanel();
        if (!inRect(p.x, p.y, panel)) { shopOpen = false; return; }
        const closeBtn = { x: panel.x + panel.w - 50, y: panel.y + 10, w: 40, h: 40 };
        if (inRect(p.x, p.y, closeBtn)) { shopOpen = false; return; }
        const up = getUpgradeRects();
        if (inRect(p.x, p.y, up.dmg)) { tryBuyUpgrade('dmg'); return; }
        if (inRect(p.x, p.y, up.hp))  { tryBuyUpgrade('hp');  return; }
        if (inRect(p.x, p.y, up.boost)) { tryBuyBoost(); return; }
        const items = getShopItemRects();
        for (let i = 0; i < items.length; i++) {
            if (inRect(p.x, p.y, items[i])) { tryBuy(SHOP_UNITS[i]); return; }
        }
        return;
    }

    if (gameState === 'idle') {
        const btns = getMainButtons();
        if (inRect(p.x, p.y, btns.ad)) { triggerRewardedAd(); return; }
        if (inRect(p.x, p.y, btns.shop)) { shopOpen = true; return; }
        if (inRect(p.x, p.y, btns.start)) { startWave(); return; }
    }

    const cell = pickCell(p.x, p.y);
    if (!cell) return;
    const unit = grid[cell.row][cell.col];
    if (unit) {
        dragging = { type: unit.type, fromRow: cell.row, fromCol: cell.col, x: p.x, y: p.y };
        grid[cell.row][cell.col] = null;
    }
}
function onMove(e) {
    if (isAdShowing) return;
    const p = getPointer(e);
    if (dragging) { dragging.x = p.x; dragging.y = p.y; }
}
function onUp(e) {
    if (isAdShowing) return;
    if (!dragging) return;
    const p = getPointer(e);
    const cell = pickCell(p.x, p.y);
    if (cell) {
        const target = grid[cell.row][cell.col];
        if (!target) {
            grid[cell.row][cell.col] = makeUnit(dragging.type);
        } else if (target.type === dragging.type && target.type < 6) {
            // Мерж: 1+1→2, ..., 4+4→5, 5+5→6
            const newType = target.type + 1;
            const fresh = makeUnit(newType);
            fresh.hp = Math.min(fresh.maxHp, Math.max(fresh.hp, target.hp + 3));
            grid[cell.row][cell.col] = fresh;
            playTone(700, 0.08, 'sine', 0.04);
            setTimeout(() => playTone(1000, 0.1, 'sine', 0.04), 60);
            const cx = GRID_X + cell.col * CELL_SIZE + CELL_SIZE / 2;
            const cy = GRID_Y + cell.row * CELL_SIZE + CELL_SIZE / 2;
            spawnParticles(cx, cy, UNIT_TYPES[newType].color, 14, 200, 5);
            if (newType === 3) checkAchievement('mergeMaster');
            if (newType === 4) checkAchievement('generalissimo');
            if (newType === 5) checkAchievement('marshal');
            if (newType === 6) checkAchievement('emperor');
        } else {
            grid[dragging.fromRow][dragging.fromCol] = makeUnit(dragging.type);
        }
    } else {
        grid[dragging.fromRow][dragging.fromCol] = makeUnit(dragging.type);
    }
    dragging = null;
}

// ==========================================
// 🎁 РЕКЛАМА ЗА НАГРАДУ
// ==========================================
function triggerRewardedAd() {
    if (!rewardedAdAvailable) { notify('Реклама пока недоступна', '#ef4444'); return; }
    rewardedAdAvailable = false;
    notify('Загружаем рекламу...', '#94a3b8');
    showRewardedAd(() => {
        gold += 50;
        notify('+50 золота за рекламу!', '#fbbf24');
        playTone(700, 0.1, 'sine', 0.06);
        setTimeout(() => playTone(1000, 0.15, 'sine', 0.06), 100);
        setTimeout(() => { rewardedAdAvailable = true; }, 60000);
    });
    if (!ysdk) setTimeout(() => { rewardedAdAvailable = true; }, 30000);
}

// ==========================================
// МАГАЗИН
// ==========================================
function findFreeCell() {
    for (let r = ROWS - 1; r >= 0; r--) {
        for (let c = 0; c < COLS; c++) if (!grid[r][c]) return { row: r, col: c };
    }
    return null;
}
function tryBuy(item) {
    if (gold < item.price) { notify('Не хватает золота!', '#ef4444'); sfxError(); return; }
    const spot = findFreeCell();
    if (!spot) { notify('Нет места на поле!', '#ef4444'); sfxError(); return; }
    gold -= item.price;
    grid[spot.row][spot.col] = makeUnit(item.type);
    stats.unitsBought++;
    saveProgress();
    sfxBuy();
    notify('Куплен ' + UNIT_TYPES[item.type].name + '!', '#22c55e');
    if (stats.unitsBought >= 10) checkAchievement('shopaholic');
}
function tryBuyUpgrade(kind) {
    const cost = kind === 'dmg' ? getDamageUpgradeCost() : getHpUpgradeCost();
    if (gold < cost) { notify('Не хватает золота!', '#ef4444'); sfxError(); return; }
    gold -= cost;
    if (kind === 'dmg') {
        damageUpgradeLevel++;
        stats.damageUpgrades = damageUpgradeLevel;
        notify('💥 Урон всех юнитов: +' + (damageUpgradeLevel * 15) + '%', '#f59e0b');
        if (damageUpgradeLevel >= 5) checkAchievement('upgrader');
    } else {
        hpUpgradeLevel++;
        notify('❤️ HP юнитов: +' + (hpUpgradeLevel * 2), '#ef4444');
        for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
            const u = grid[r][c];
            if (u) {
                const oldMax = u.maxHp;
                u.maxHp = getUnitMaxHp(u.type);
                u.hp += (u.maxHp - oldMax);
            }
        }
    }
    sfxUpgrade();
    saveProgress();
}

// 🆕 Буст: +1 уровень всем юнитам на поле
function tryBuyBoost() {
    const cost = getBoostCost();
    if (gold < cost) { notify('Не хватает золота!', '#ef4444'); sfxError(); return; }
    // Проверим, есть ли хоть один юнит не на 6 уровне
    let hasUpgradable = false;
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
        const u = grid[r][c];
        if (u && u.type < 6) hasUpgradable = true;
    }
    if (!hasUpgradable) { notify('Все юниты на максимуме!', '#ef4444'); sfxError(); return; }
    gold -= cost;
    stats.boostsUsed++;
    saveProgress();
    sfxBoost();
    triggerShake(8, 0.4);
    screenFlash = 0.3;
    // Повышаем всех
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
        const u = grid[r][c];
        if (!u) continue;
        if (u.type < 6) {
            const newType = u.type + 1;
            const fresh = makeUnit(newType);
            fresh.hp = Math.min(fresh.maxHp, fresh.maxHp); // полное HP после буста
            grid[r][c] = fresh;
            const cx = GRID_X + c * CELL_SIZE + CELL_SIZE / 2;
            const cy = GRID_Y + r * CELL_SIZE + CELL_SIZE / 2;
            spawnParticles(cx, cy, UNIT_TYPES[newType].color, 12, 220, 4);
        }
    }
    notify('🚀 Вся армия +1 уровень!', '#fbbf24');
    checkAchievement('armyBoost');
}

// ==========================================
// ВОЛНЫ
// ==========================================
let pendingEnemies = [];

function calcPhaseCount(w) {
    if (w <= 3) return 1;
    if (w <= 7) return 2;
    if (w <= 11) return 3;
    return 4;
}

function buildEnemyQueue() {
    pendingEnemies = [];
    const typesPool = getEnemyTypesForWave(wave);
    if (wave % 10 === 0) {
        pendingEnemies.push({ typeId: 'boss' });
    } else {
        const totalCount = 2 + Math.floor(wave * 0.8); // меньше врагов — но каждый жирнее
        for (let i = 0; i < totalCount; i++) {
            const typeId = typesPool[Math.floor(Math.random() * typesPool.length)];
            pendingEnemies.push({ typeId });
        }
    }
}

function spawnPhaseEnemies() {
    if (pendingEnemies.length === 0) return;
    const phasesLeft = wavePhases - currentPhase + 1;
    const toSpawn = Math.max(1, Math.ceil(pendingEnemies.length / phasesLeft));
    const slice = pendingEnemies.splice(0, toSpawn);
    for (let i = 0; i < slice.length; i++) {
        spawnEnemy(slice[i].typeId, i, slice.length);
    }
}

function spawnEnemy(typeId, slotIndex, totalSlots) {
    const def = ENEMY_TYPES[typeId];
    // 🆕 Медленнее HP и скорость
    const baseHp = 3 + wave * 1.5;
    const baseSpeed = 25 + wave * 3;
    const hp = Math.max(1, Math.round(baseHp * def.hpMul));
    const speed = baseSpeed * def.speedMul;
    const col = Math.floor((slotIndex / totalSlots) * COLS + Math.random() * 0.9) % COLS;

    const enemy = {
        typeId: typeId, col: col,
        y: GRID_Y - 40 - Math.random() * 100,
        hp: hp, maxHp: hp, speed: speed,
        baseHp: baseHp, baseSpeed: baseSpeed,
        hitFlash: 0, spawnProgress: 0,
        isBoss: typeId === 'boss',
        isShooter: !!def.isShooter,
        shooterStopped: false,
        shootTimer: 0,
        stopY: GRID_Y + CELL_SIZE * (1 + Math.random() * 2)
    };
    enemies.push(enemy);
}

function startWave() {
    wave++;
    gameState = 'wave';
    shopOpen = false; achievementsOpen = false;
    hpAtWaveStart = playerHp;
    unitsLostThisWave = 0;
    sfxWaveStart();
    if (wave >= 10) checkAchievement('survivor10');

    wavePhases = calcPhaseCount(wave);
    currentPhase = 0;
    phaseCountdown = 0;
    allPhasesSpawned = false;
    buildEnemyQueue();

    if (wave % 10 === 0) {
        bossWarning = 3.0;
        sfxBossSpawn();
        triggerShake(10, 0.5);
    }

    nextPhase();
}

function nextPhase() {
    currentPhase++;
    spawnPhaseEnemies();
    phaseLabelTimer = 1.5;
    if (currentPhase >= wavePhases || pendingEnemies.length === 0) {
        allPhasesSpawned = true;
    }
}

function restart() {
    enemies = []; bullets = []; enemyBullets = []; flashes = []; floaters = [];
    particles = []; damageNumbers = []; achievementPopups = [];
    pendingEnemies = [];
    wave = 0; playerHp = MAX_HP; gold = 0;
    damageUpgradeLevel = 0; hpUpgradeLevel = 0;
    gameState = 'idle'; shopOpen = false; achievementsOpen = false;
    notification = null; combo = 0; comboTimer = 0; screenFlash = 0;
    bossWarning = 0; chapterBanner = 0;
    wavePhases = 0; currentPhase = 0; phaseCountdown = 0; allPhasesSpawned = false;
    resetGrid();
}
function goldForKill(e) { let base = 2 + Math.floor(wave / 3); if (e && e.isBoss) base *= 10; return base; }
// ==========================================
// ОБНОВЛЕНИЕ
// ==========================================
function update(dt) {
    if (!sdkReady || isAdShowing) return;

    if (shakeTime > 0) { shakeTime -= dt; if (shakeTime <= 0) shakeIntensity = 0; }
    if (screenFlash > 0) screenFlash = Math.max(0, screenFlash - dt * 3);
    if (comboTimer > 0) { comboTimer -= dt; if (comboTimer <= 0) combo = 0; }
    if (bossWarning > 0) bossWarning -= dt;
    if (chapterBanner > 0) chapterBanner -= dt;
    if (phaseLabelTimer > 0) phaseLabelTimer -= dt;

    for (let i = flashes.length - 1; i >= 0; i--) { flashes[i].life -= dt; if (flashes[i].life <= 0) flashes.splice(i, 1); }
    for (let i = floaters.length - 1; i >= 0; i--) {
        floaters[i].life -= dt; floaters[i].y += floaters[i].vy * dt;
        if (floaters[i].life <= 0) floaters.splice(i, 1);
    }
    for (let i = damageNumbers.length - 1; i >= 0; i--) {
        const d = damageNumbers[i];
        d.life -= dt; d.y += d.vy * dt; d.vy += 40 * dt;
        if (d.life <= 0) damageNumbers.splice(i, 1);
    }
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life -= dt; p.vy += 400 * dt;
        p.x += p.vx * dt; p.y += p.vy * dt;
        if (p.life <= 0) particles.splice(i, 1);
    }
    for (let i = achievementPopups.length - 1; i >= 0; i--) {
        achievementPopups[i].life -= dt;
        if (achievementPopups[i].life <= 0) achievementPopups.splice(i, 1);
    }
    if (notification) { notification.life -= dt; if (notification.life <= 0) notification = null; }

    for (const e of enemies) {
        if (e.hitFlash > 0) e.hitFlash -= dt * 5;
        if (e.spawnProgress < 1) e.spawnProgress = Math.min(1, e.spawnProgress + dt * 3);
    }

    // Юниты: регенерация + recoil
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            const u = grid[r][c];
            if (!u) continue;
            if (u.recoil > 0) u.recoil = Math.max(0, u.recoil - dt * 5);
            if (u.hitFlash > 0) u.hitFlash -= dt * 5;
            if (u.hp < u.maxHp) u.hp = Math.min(u.maxHp, u.hp + 0.6 * dt);
        }
    }

    if (gameState !== 'wave') return;

    // Многофазность
    if (!allPhasesSpawned && enemies.length <= 1 && phaseCountdown <= 0) {
        phaseCountdown = 1.6;
    }
    if (phaseCountdown > 0) {
        phaseCountdown -= dt;
        if (phaseCountdown <= 0 && !allPhasesSpawned) {
            nextPhase();
        }
    }

    // Враги
    for (let i = enemies.length - 1; i >= 0; i--) {
        const e = enemies[i];

        if (e.isShooter && !e.shooterStopped && e.y >= e.stopY) {
            e.shooterStopped = true;
        }
        if (e.isShooter && e.shooterStopped) {
            e.shootTimer -= dt;
            if (e.shootTimer <= 0) {
                e.shootTimer = 2.2;
                let targetUnit = null;
                let targetRow = -1;
                for (let rr = 0; rr < ROWS; rr++) {
                    if (grid[rr][e.col]) { targetUnit = grid[rr][e.col]; targetRow = rr; break; }
                }
                if (targetUnit) {
                    const ex = GRID_X + e.col * CELL_SIZE + CELL_SIZE / 2;
                    const ey = e.y;
                    const tx = GRID_X + e.col * CELL_SIZE + CELL_SIZE / 2;
                    const ty = GRID_Y + targetRow * CELL_SIZE + CELL_SIZE / 2;
                    const dx = tx - ex, dy = ty - ey;
                    const len = Math.hypot(dx, dy) || 1;
                    enemyBullets.push({
                        x: ex, y: ey,
                        vx: (dx / len) * 260,
                        vy: (dy / len) * 260,
                        damage: e.isBoss ? 3 : 1,
                        col: e.col
                    });
                    playTone(400, 0.05, 'square', 0.02);
                }
            }
        } else {
            e.y += e.speed * dt;
        }

        if (e.y > GRID_Y + CELL_SIZE * ROWS + 20) {
            enemies.splice(i, 1);
            playerHp--;
            screenFlash = 1;
            triggerShake(8, 0.35);
            sfxHurt();
            if (playerHp <= 0) {
                playerHp = 0;
                gameState = 'gameover';
                sfxGameOver();
                if (wave > bestWave) { bestWave = wave; localStorage.setItem('mergeArena_bestWave', String(bestWave)); }
                stats.gamesPlayed++;
                saveProgress();
                checkAchievement('martyr');
                return;
            }
        }
    }

    // Лечение от целителей
    for (const healer of enemies) {
        if (healer.typeId !== 'healer') continue;
        if (!healer._healTick) healer._healTick = 0;
        healer._healTick += dt;
        if (healer._healTick >= 1) {
            healer._healTick = 0;
            for (const e of enemies) {
                if (e === healer) continue;
                if (Math.abs(e.col - healer.col) <= 1 && Math.abs(e.y - healer.y) < CELL_SIZE * 1.5) {
                    if (e.hp < e.maxHp) {
                        e.hp = Math.min(e.maxHp, e.hp + 4);
                        flashes.push({ x: GRID_X + e.col * CELL_SIZE + CELL_SIZE / 2, y: e.y, life: 0.4, maxLife: 0.4, color: '#10b981', size: CELL_SIZE * 0.3 });
                    }
                }
            }
        }
    }

    // 🆕 Стрельба юнитов — с поддержкой pierce (несколько колонок)
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            const unit = grid[r][c];
            if (!unit) continue;
            unit.cooldown -= dt;
            if (unit.cooldown > 0) continue;
            const t = UNIT_TYPES[unit.type];
            const pierce = t.pierce || 1;
            const unitX = GRID_X + c * CELL_SIZE + CELL_SIZE / 2;
            const unitY = GRID_Y + r * CELL_SIZE + CELL_SIZE / 2;

            // Определяем колонки, которые покрывает юнит
            let colsToHit = [];
            if (pierce === 1) {
                colsToHit = [c];
            } else if (pierce === 3) {
                colsToHit = [c - 1, c, c + 1].filter(x => x >= 0 && x < COLS);
            } else if (pierce >= 5) {
                colsToHit = [0, 1, 2, 3, 4];
            }

            let fired = false;
            const dmg = t.damage * getDamageMultiplier();

            for (const colIdx of colsToHit) {
                // Находим ближайшего врага в колонке
                let target = null, bestDist = Infinity;
                for (const e of enemies) {
                    if (e.col !== colIdx) continue;
                    if (e.spawnProgress < 1) continue;
                    if (e.y < unitY) { const d = Math.abs(unitY - e.y); if (d < bestDist) { bestDist = d; target = e; } }
                }
                if (!target) continue;

                const eX = GRID_X + target.col * CELL_SIZE + CELL_SIZE / 2;
                const eY = target.y;
                const dx = eX - unitX, dy = eY - unitY;
                const len = Math.hypot(dx, dy) || 1;
                const speed = 600;
                bullets.push({
                    x: unitX, y: unitY,
                    vx: (dx / len) * speed, vy: (dy / len) * speed,
                    target, damage: dmg, color: t.color
                });
                fired = true;
            }

            if (fired) {
                flashes.push({ x: unitX, y: unitY, life: 0.15, maxLife: 0.15, color: '#ffffaa', size: CELL_SIZE * 0.3 });
                unit.recoil = 1;
                sfxShoot();
                unit.cooldown = t.cooldown;
            }
        }
    }

    // Пули юнитов
    for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        b.x += b.vx * dt; b.y += b.vy * dt;
        if (!enemies.includes(b.target)) { bullets.splice(i, 1); continue; }
        const eX = GRID_X + b.target.col * CELL_SIZE + CELL_SIZE / 2;
        const eY = b.target.y;
        const dist = Math.hypot(b.x - eX, b.y - eY);
        if (dist < CELL_SIZE * 0.2) {
            const targetDef = ENEMY_TYPES[b.target.typeId] || ENEMY_TYPES.normal;
            let dmg = b.damage;
            if (targetDef.resist > 0) dmg = Math.max(1, dmg * (1 - targetDef.resist));
            b.target.hp -= dmg;
            b.target.hitFlash = 1;
            flashes.push({ x: eX, y: eY, life: 0.2, maxLife: 0.2, color: '#ffcc44', size: CELL_SIZE * 0.4 });
            spawnParticles(eX, eY, '#ffdd55', 5, 130, 3);
            damageNumbers.push({
                x: eX + (Math.random() * 20 - 10), y: eY - 10,
                vy: -60, life: 0.55, maxLife: 0.55,
                text: '-' + Math.round(dmg), color: '#ffe066', size: 16
            });
            sfxHit();
            if (b.target.hp <= 0) {
                killEnemy(b.target, eX, eY);
            }
            bullets.splice(i, 1);
        }
        if (b.y < -50 || b.y > H + 50 || b.x < -50 || b.x > W + 50) bullets.splice(i, 1);
    }

    // Пули врагов
    for (let i = enemyBullets.length - 1; i >= 0; i--) {
        const b = enemyBullets[i];
        b.x += b.vx * dt; b.y += b.vy * dt;
        const col = Math.floor((b.x - GRID_X) / CELL_SIZE);
        const row = Math.floor((b.y - GRID_Y) / CELL_SIZE);
        let hit = false;
        if (row >= 0 && row < ROWS && col >= 0 && col < COLS) {
            const unit = grid[row][col];
            if (unit) {
                const ucx = GRID_X + col * CELL_SIZE + CELL_SIZE / 2;
                const ucy = GRID_Y + row * CELL_SIZE + CELL_SIZE / 2;
                const d = Math.hypot(b.x - ucx, b.y - ucy);
                if (d < CELL_SIZE * 0.32) {
                    unit.hp -= b.damage;
                    unit.hitFlash = 1;
                    spawnParticles(b.x, b.y, '#ef4444', 6, 130, 3);
                    damageNumbers.push({
                        x: b.x, y: b.y - 10,
                        vy: -50, life: 0.5, maxLife: 0.5,
                        text: '-' + b.damage, color: '#ff6666', size: 14
                    });
                    if (unit.hp <= 0) {
                        grid[row][col] = null;
                        stats.unitsLost++;
                        unitsLostThisWave++;
                        sfxUnitDeath();
                        spawnParticles(ucx, ucy, UNIT_TYPES[unit.type].color, 20, 220, 5);
                        triggerShake(6, 0.3);
                        notify('Юнит погиб!', '#ef4444');
                        saveProgress();
                    }
                    hit = true;
                }
            }
        }
        if (hit || b.y < -50 || b.y > H + 50 || b.x < -50 || b.x > W + 50) {
            enemyBullets.splice(i, 1);
        }
    }

    if (enemies.length === 0 && allPhasesSpawned) {
        gameState = 'idle';
        if (playerHp === hpAtWaveStart && wave >= 2) checkAchievement('untouchable');
        if (unitsLostThisWave > 0 && wave >= 3) checkAchievement('survivedDeath');

        if (wave > 0 && wave % 10 === 0) {
            const chapterNum = wave / 10;
            const chapterBonus = 80 + chapterNum * 40;
            gold += chapterBonus;
            stats.chaptersCleared = Math.max(stats.chaptersCleared, chapterNum);
            saveProgress();
            sfxChapter();
            chapterBanner = 4.0;
            notify('🏅 Глава ' + chapterNum + ' пройдена! +' + chapterBonus + '💰', '#fbbf24');
            if (chapterNum >= 3) checkAchievement('chapter3');
            if (chapterNum >= 5) checkAchievement('chapter5');
        }

        setTimeout(() => showInterstitialAd(), 300);
    }
}

// Обработка убийства
function killEnemy(killed, eX, eY) {
    const idx = enemies.indexOf(killed);
    if (idx >= 0) enemies.splice(idx, 1);

    if (killed.typeId === 'splitter') {
        const childHp = Math.max(1, Math.round(killed.baseHp * ENEMY_TYPES.fast.hpMul * 0.6));
        for (let k = 0; k < 2; k++) {
            const childCol = Math.max(0, Math.min(COLS - 1, killed.col + (k === 0 ? -1 : 1)));
            enemies.push({
                typeId: 'fast', col: childCol,
                y: killed.y - k * 8,
                hp: childHp, maxHp: childHp,
                speed: killed.baseSpeed * ENEMY_TYPES.fast.speedMul,
                baseHp: killed.baseHp, baseSpeed: killed.baseSpeed,
                hitFlash: 0, spawnProgress: 1,
                isBoss: false, isShooter: false, shooterStopped: false, shootTimer: 0
            });
        }
        spawnParticles(eX, eY, '#22d3ee', 20, 250, 4);
    }

    combo++;
    comboTimer = 2.0;
    if (combo > stats.maxCombo) { stats.maxCombo = combo; saveProgress(); if (combo >= 5) checkAchievement('comboMaster'); }

    let reward = goldForKill(killed);
    if (combo >= 3) reward += Math.floor(combo / 2);
    gold += reward;
    if (gold >= 500) checkAchievement('richMan');

    if (killed.isBoss) {
        sfxBossKill();
        triggerShake(14, 0.6);
        screenFlash = 0.5;
        spawnParticles(eX, eY, '#fbbf24', 40, 320, 5);
        spawnParticles(eX, eY, '#ef4444', 30, 280, 4);
        stats.bossesKilled++;
        saveProgress();
        checkAchievement('bossSlayer');
    } else if (killed.typeId === 'healer') {
        sfxKill();
        triggerShake(3, 0.15);
        spawnParticles(eX, eY, '#10b981', 15, 250, 4);
    } else {
        sfxKill();
        triggerShake(4, 0.18);
        spawnParticles(eX, eY, '#ef4444', 10, 220, 4);
    }
    if (combo >= 3 && !killed.isBoss) sfxCombo();

    floaters.push({ x: eX, y: eY, vy: -60, text: '+' + reward + '💰', color: '#fbbf24', life: 0.9, maxLife: 0.9 });

    stats.totalKills++;
    if (stats.totalKills >= 100) checkAchievement('sniper');
    if (stats.totalKills === 1) checkAchievement('firstBlood');
    saveProgress();
}

// ==========================================
// ОТРИСОВКА
// ==========================================
function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}

function render(time) {
    CELL_SIZE = calcGrid();

    if (gameState === 'loading') {
        ctx.fillStyle = '#16213e';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#e2e8f0';
        ctx.font = 'bold 28px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('MERGE ARENA', W / 2, H / 2 - 40);
        ctx.fillStyle = '#94a3b8';
        ctx.font = '18px Arial';
        ctx.fillText('Загрузка...', W / 2, H / 2 + 10);
        const barW = W * 0.6, barH = 8;
        const barX = (W - barW) / 2, barY = H / 2 + 50;
        ctx.fillStyle = 'rgba(255,255,255,0.1)';
        roundRect(barX, barY, barW, barH, 4); ctx.fill();
        const progress = (time % 1500) / 1500;
        ctx.fillStyle = '#22c55e';
        roundRect(barX, barY, barW * progress, barH, 4); ctx.fill();
        return;
    }

    let sx = 0, sy = 0;
    if (shakeTime > 0) {
        const k = shakeTime * 3;
        sx = (Math.random() * 2 - 1) * shakeIntensity * k;
        sy = (Math.random() * 2 - 1) * shakeIntensity * k;
    }

    ctx.fillStyle = '#16213e';
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.translate(sx, sy);

    // 🆕 Подсветка колонок, покрываемых Маршалом/Императором
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            const unit = grid[r][c];
            if (!unit) continue;
            const t = UNIT_TYPES[unit.type];
            if (t.pierce > 1) {
                const cols = t.pierce >= 5 ? [0,1,2,3,4] : [c-1, c, c+1].filter(x => x >= 0 && x < COLS);
                for (const cc of cols) {
                    const x = GRID_X + cc * CELL_SIZE;
                    const y = GRID_Y + r * CELL_SIZE;
                    ctx.fillStyle = 'rgba(236,72,153,0.06)';
                    ctx.fillRect(x + 2, y + 2, CELL_SIZE - 4, CELL_SIZE - 4);
                }
            }
        }
    }

    // Сетка
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            const x = GRID_X + c * CELL_SIZE;
            const y = GRID_Y + r * CELL_SIZE;
            ctx.fillStyle = 'rgba(255,255,255,0.03)';
            ctx.fillRect(x + 2, y + 2, CELL_SIZE - 4, CELL_SIZE - 4);
            ctx.strokeStyle = 'rgba(255,255,255,0.08)';
            ctx.strokeRect(x + 2, y + 2, CELL_SIZE - 4, CELL_SIZE - 4);
        }
    }

    // Юниты
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
        const unit = grid[r][c];
        if (!unit) continue;
        drawUnitAt(GRID_X + c * CELL_SIZE, GRID_Y + r * CELL_SIZE, CELL_SIZE, unit, 1, time);
    }

    // Враги
    for (const e of enemies) drawEnemy(e);

    // Пули юнитов
    for (const b of bullets) {
        ctx.fillStyle = b.color; ctx.globalAlpha = 0.35;
        ctx.beginPath(); ctx.arc(b.x - b.vx * 0.015, b.y - b.vy * 0.015, 5, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
        ctx.shadowColor = b.color; ctx.shadowBlur = 12;
        ctx.fillStyle = '#fffbe6';
        ctx.beginPath(); ctx.arc(b.x, b.y, 4, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
    }

    // Пули врагов
    for (const b of enemyBullets) {
        ctx.shadowColor = '#ef4444';
        ctx.shadowBlur = 12;
        ctx.fillStyle = '#ff8080';
        ctx.beginPath(); ctx.arc(b.x, b.y, 5, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
    }

    // Вспышки
    for (const f of flashes) {
        const k = f.life / f.maxLife;
        const size = f.size * (1 - k * 0.6);
        ctx.globalAlpha = k;
        const grad = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, size);
        grad.addColorStop(0, f.color);
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.arc(f.x, f.y, size, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
    }

    // Частицы
    for (const p of particles) {
        const k = p.life / p.maxLife;
        ctx.globalAlpha = k;
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
    }

    // Числа урона
    for (const d of damageNumbers) {
        const k = d.life / d.maxLife;
        ctx.globalAlpha = Math.min(1, k * 1.8);
        ctx.fillStyle = d.color;
        ctx.font = 'bold ' + d.size + 'px Arial';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.shadowColor = '#000'; ctx.shadowBlur = 4;
        ctx.fillText(d.text, d.x, d.y);
        ctx.shadowBlur = 0; ctx.globalAlpha = 1;
    }

    // Золото
    for (const fl of floaters) {
        const k = fl.life / fl.maxLife;
        ctx.globalAlpha = Math.min(1, k * 1.5);
        ctx.fillStyle = fl.color;
        ctx.font = 'bold 20px Arial';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.shadowColor = '#000'; ctx.shadowBlur = 6;
        ctx.fillText(fl.text, fl.x, fl.y);
        ctx.shadowBlur = 0; ctx.globalAlpha = 1;
    }

    // Перетаскиваемый юнит
    if (dragging) {
        const fakeUnit = { type: dragging.type, recoil: 0, hp: 1, maxHp: 1, hitFlash: 0 };
        drawUnitAt(dragging.x - CELL_SIZE / 2, dragging.y - CELL_SIZE / 2, CELL_SIZE, fakeUnit, 0.85, time);
    }

    ctx.restore();

    if (screenFlash > 0) {
        ctx.fillStyle = 'rgba(220,38,38,' + (screenFlash * 0.35) + ')';
        ctx.fillRect(0, 0, W, H);
    }

    // UI
    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 22px Arial';
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillText('MERGE ARENA', W / 2, 28);

    ctx.font = 'bold 15px Arial';
    ctx.fillStyle = '#94a3b8';
    ctx.textAlign = 'left';
    ctx.fillText('❤️ ' + playerHp + '/' + MAX_HP, 16, 28);

    drawSoundButton();
    drawAchievementsButton();

    ctx.font = 'bold 14px Arial';
    ctx.fillStyle = '#fbbf24';
    const goldText = '💰 ' + gold;
    const bestText = '🏆 ' + bestWave;
    const waveText = '⚔️ ' + wave + (wave > 0 ? ' Гл.' + Math.ceil(wave/10) : '');
    let upgText = '';
    if (damageUpgradeLevel > 0 || hpUpgradeLevel > 0) {
        upgText = ' · 💥' + damageUpgradeLevel + ' ❤️+' + (hpUpgradeLevel * 2);
    }
    const statsText = goldText + '   ' + bestText + '   ' + waveText + upgText;
    ctx.textAlign = 'center';
    ctx.fillText(statsText, W / 2, 62);

    // Кнопки (idle)
    if (gameState === 'idle') {
        const btns = getMainButtons();
        const pulse = 1 + Math.sin(time * 0.005) * 0.03;

        ctx.fillStyle = rewardedAdAvailable ? '#f59e0b' : '#475569';
        roundRect(btns.ad.x, btns.ad.y, btns.ad.w, btns.ad.h, 12); ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 15px Arial';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('🎁 +50💰', btns.ad.x + btns.ad.w / 2, btns.ad.y + btns.ad.h / 2);

        ctx.fillStyle = '#3b82f6';
        roundRect(btns.shop.x, btns.shop.y, btns.shop.w, btns.shop.h, 12); ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.fillText('🛒 МАГАЗИН', btns.shop.x + btns.shop.w / 2, btns.shop.y + btns.shop.h / 2);

        const sW = btns.start.w * pulse, sH = btns.start.h * pulse;
        const sX = btns.start.x - (sW - btns.start.w) / 2;
        const sY = btns.start.y - (sH - btns.start.h) / 2;
        ctx.fillStyle = '#22c55e';
        roundRect(sX, sY, sW, sH, 12); ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 14px Arial';
        ctx.fillText(wave === 0 ? '▶ СТАРТ' : '▶ ВОЛНА', btns.start.x + btns.start.w / 2, btns.start.y + btns.start.h / 2);
    } else if (gameState === 'wave') {
        let statusText = '⚔️ Бой идёт...';
        if (!allPhasesSpawned) {
            statusText = '⚔️ Залп ' + currentPhase + '/' + wavePhases;
            if (phaseCountdown > 0) statusText += ' · пауза';
        }
        ctx.fillStyle = '#facc15';
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(statusText, W / 2, 130);

        if (combo >= 3) {
            const k = Math.min(1, comboTimer / 0.4);
            ctx.globalAlpha = k;
            ctx.fillStyle = '#fbbf24';
            ctx.font = 'bold 34px Arial';
            ctx.textAlign = 'center';
            ctx.shadowColor = '#000'; ctx.shadowBlur = 8;
            ctx.fillText('COMBO ×' + combo + '!', W / 2, 172);
            ctx.shadowBlur = 0;
            ctx.globalAlpha = 1;
        }
    }

    // Баннер фазы
    if (phaseLabelTimer > 0 && !allPhasesSpawned) {
        const k = Math.min(1, phaseLabelTimer / 0.4);
        ctx.globalAlpha = k * 0.95;
        ctx.fillStyle = 'rgba(250,204,21,0.9)';
        const bw = 260, bh = 50;
        roundRect((W - bw) / 2, H / 2 - bh / 2, bw, bh, 12); ctx.fill();
        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 22px Arial';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('⚔️ Залп ' + currentPhase + '/' + wavePhases, W / 2, H / 2);
        ctx.globalAlpha = 1;
    }

    // Босс-баннер
    if (bossWarning > 0) {
        const k = Math.min(1, bossWarning / 0.4);
        ctx.globalAlpha = k * 0.9;
        ctx.fillStyle = 'rgba(127,29,29,0.9)';
        const bw = Math.min(W - 40, 340);
        const bh = 70;
        roundRect((W - bw) / 2, H / 2 - bh / 2, bw, bh, 14); ctx.fill();
        ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 2.5;
        roundRect((W - bw) / 2, H / 2 - bh / 2, bw, bh, 14); ctx.stroke();
        ctx.fillStyle = '#fbbf24';
        ctx.font = 'bold 26px Arial';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('⚠️ БОСС ИДЁТ!', W / 2, H / 2 - 8);
        ctx.fillStyle = '#fca5a5';
        ctx.font = 'bold 14px Arial';
        ctx.fillText('Приготовься!', W / 2, H / 2 + 18);
        ctx.globalAlpha = 1;
    }

    // Баннер главы
    if (chapterBanner > 0) {
        const k = Math.min(1, chapterBanner / 0.5);
        ctx.globalAlpha = k;
        ctx.fillStyle = 'rgba(15,23,42,0.9)';
        const bw = Math.min(W - 40, 380);
        const bh = 100;
        roundRect((W - bw) / 2, H / 2 - bh / 2, bw, bh, 16); ctx.fill();
        ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 3;
        roundRect((W - bw) / 2, H / 2 - bh / 2, bw, bh, 16); ctx.stroke();
        ctx.fillStyle = '#fbbf24';
        ctx.font = 'bold 30px Arial';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('🏅 ГЛАВА ' + Math.floor(wave/10) + ' ПРОЙДЕНА!', W / 2, H / 2 - 15);
        ctx.fillStyle = '#22c55e';
        ctx.font = 'bold 20px Arial';
        ctx.fillText('+' + (80 + Math.floor(wave/10) * 40) + ' 💰', W / 2, H / 2 + 25);
        ctx.globalAlpha = 1;
    }

    // Тост
    if (notification) {
        const k = Math.min(1, notification.life / 0.4);
        ctx.globalAlpha = k;
        ctx.fillStyle = 'rgba(0,0,0,0.8)';
        const tw = 280, th = 50;
        roundRect((W - tw) / 2, H - 90, tw, th, 12); ctx.fill();
        ctx.fillStyle = notification.color;
        ctx.font = 'bold 18px Arial';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(notification.text, W / 2, H - 65);
        ctx.globalAlpha = 1;
    }

    // Всплывашки достижений
    for (let i = 0; i < achievementPopups.length; i++) {
        const a = achievementPopups[i];
        const k = Math.min(1, a.life / 0.4);
        const appearK = Math.min(1, (a.maxLife - a.life) / 0.3);
        const yBase = 100 + i * 62;
        ctx.globalAlpha = k * appearK * 0.92;
        const pw = Math.min(W - 40, 380);
        const px = (W - pw) / 2;
        const ph = 56;
        ctx.fillStyle = 'rgba(15,23,42,0.92)';
        roundRect(px, yBase, pw, ph, 12); ctx.fill();
        ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 2;
        roundRect(px, yBase, pw, ph, 12); ctx.stroke();
        ctx.font = '26px Arial';
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillText(a.icon, px + 12, yBase + ph / 2);
        ctx.fillStyle = '#fbbf24';
        ctx.font = 'bold 10px Arial';
        ctx.fillText('🏆 ДОСТИЖЕНИЕ', px + 50, yBase + 16);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 15px Arial';
        ctx.fillText(a.name, px + 50, yBase + 38);
        ctx.fillStyle = '#fbbf24';
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'right';
        ctx.fillText('+' + a.reward + '💰', px + pw - 12, yBase + ph / 2);
        ctx.globalAlpha = 1;
    }

    if (shopOpen) drawShop();
    if (achievementsOpen) drawAchievements();
    if (gameState === 'gameover') drawGameOver();
}

function drawSoundButton() {
    const b = getSoundButton();
    ctx.fillStyle = soundMuted ? 'rgba(239,68,68,0.2)' : 'rgba(34,197,94,0.2)';
    roundRect(b.x, b.y, b.w, b.h, 8); ctx.fill();
    ctx.strokeStyle = soundMuted ? '#ef4444' : '#22c55e'; ctx.lineWidth = 1.5;
    roundRect(b.x, b.y, b.w, b.h, 8); ctx.stroke();
    ctx.font = '18px Arial';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(soundMuted ? '🔇' : '🔊', b.x + b.w / 2, b.y + b.h / 2 + 1);
}
function drawAchievementsButton() {
    const b = getAchievementsButton();
    const total = ACHIEVEMENTS.length;
    const got = Object.keys(unlocked).length;
    ctx.fillStyle = 'rgba(251,191,36,0.2)';
    roundRect(b.x, b.y, b.w, b.h, 8); ctx.fill();
    ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 1.5;
    roundRect(b.x, b.y, b.w, b.h, 8); ctx.stroke();
    ctx.font = '16px Arial';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('🏆', b.x + b.w / 2, b.y + b.h / 2 - 2);
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 9px Arial';
    ctx.fillText(got + '/' + total, b.x + b.w / 2, b.y + b.h - 6);
}

function drawShop() {
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    ctx.fillRect(0, 0, W, H);
    const p = getShopPanel();
    ctx.fillStyle = '#1e293b';
    roundRect(p.x, p.y, p.w, p.h, 16); ctx.fill();
    ctx.strokeStyle = '#3b82f6'; ctx.lineWidth = 2;
    roundRect(p.x, p.y, p.w, p.h, 16); ctx.stroke();

    ctx.fillStyle = '#e2e8f0'; ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('🛒 МАГАЗИН', p.x + p.w / 2, p.y + 28);

    ctx.fillStyle = '#ef4444';
    roundRect(p.x + p.w - 46, p.y + 8, 38, 38, 10); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 22px Arial';
    ctx.fillText('✕', p.x + p.w - 27, p.y + 27);

    ctx.fillStyle = '#fbbf24'; ctx.font = 'bold 15px Arial';
    ctx.fillText('💰 ' + gold, p.x + p.w / 2, p.y + 55);

    // Улучшения
    const up = getUpgradeRects();
    drawUpgradeBtn(up.dmg, '💥 Урон', '+' + (damageUpgradeLevel * 15) + '%', getDamageUpgradeCost(), gold >= getDamageUpgradeCost(), '#ef4444');
    drawUpgradeBtn(up.hp,  '❤️ HP',  '+' + (hpUpgradeLevel * 2),       getHpUpgradeCost(),      gold >= getHpUpgradeCost(),      '#ec4899');

    // Кнопка буста
    const boostCost = getBoostCost();
    const canBoost = gold >= boostCost;
    ctx.fillStyle = canBoost ? 'rgba(168,85,247,0.2)' : 'rgba(255,255,255,0.03)';
    roundRect(up.boost.x, up.boost.y, up.boost.w, up.boost.h, 10); ctx.fill();
    ctx.strokeStyle = canBoost ? '#a855f7' : '#475569'; ctx.lineWidth = 2;
    roundRect(up.boost.x, up.boost.y, up.boost.w, up.boost.h, 10); ctx.stroke();
    ctx.fillStyle = canBoost ? '#e2e8f0' : '#64748b';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('🚀 ВСЯ АРМИЯ +1 УРОВЕНЬ', up.boost.x + up.boost.w / 2, up.boost.y + 18);
    ctx.fillStyle = canBoost ? '#fbbf24' : '#64748b';
    ctx.font = 'bold 13px Arial';
    ctx.fillText('💰 ' + boostCost, up.boost.x + up.boost.w / 2, up.boost.y + 38);

    // Юниты
    const items = getShopItemRects();
    for (let i = 0; i < items.length; i++) {
        const r = items[i];
        const item = SHOP_UNITS[i];
        const t = UNIT_TYPES[item.type];
        const canBuy = gold >= item.price;
        ctx.fillStyle = canBuy ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.05)';
        roundRect(r.x, r.y, r.w, r.h, 10); ctx.fill();
        ctx.strokeStyle = canBuy ? '#22c55e' : '#475569'; ctx.lineWidth = 1.5;
        roundRect(r.x, r.y, r.w, r.h, 10); ctx.stroke();
        const fakeUnit = { type: item.type, recoil: 0, hp: 1, maxHp: 1, hitFlash: 0 };
        drawUnitAt(r.x + 6, r.y + 4, 52, fakeUnit, 1, performance.now());
        ctx.textAlign = 'left';
        ctx.fillStyle = '#e2e8f0'; ctx.font = 'bold 15px Arial';
        ctx.fillText(t.name, r.x + 66, r.y + 22);
        ctx.fillStyle = canBuy ? '#fbbf24' : '#64748b'; ctx.font = 'bold 13px Arial';
        ctx.fillText('💰 ' + item.price, r.x + 66, r.y + 42);
        ctx.fillStyle = canBuy ? '#22c55e' : '#334155';
        const bx = r.x + r.w - 90, by = r.y + 12, bw = 78, bh = 36;
        roundRect(bx, by, bw, bh, 8); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.font = 'bold 13px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('КУПИТЬ', bx + bw / 2, by + bh / 2);
    }
}

function drawUpgradeBtn(r, label, bonus, cost, canBuy, color) {
    ctx.fillStyle = canBuy ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.02)';
    roundRect(r.x, r.y, r.w, r.h, 10); ctx.fill();
    ctx.strokeStyle = canBuy ? color : '#475569'; ctx.lineWidth = 1.5;
    roundRect(r.x, r.y, r.w, r.h, 10); ctx.stroke();

    ctx.fillStyle = canBuy ? '#e2e8f0' : '#64748b';
    ctx.font = 'bold 13px Arial';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(label + ' ' + bonus, r.x + r.w / 2, r.y + 16);
    ctx.fillStyle = canBuy ? '#fbbf24' : '#64748b';
    ctx.font = 'bold 12px Arial';
    ctx.fillText('💰 ' + cost, r.x + r.w / 2, r.y + 38);
}

function drawAchievements() {
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(0, 0, W, H);
    const p = getAchievementsPanel();
    ctx.fillStyle = '#1e293b';
    roundRect(p.x, p.y, p.w, p.h, 16); ctx.fill();
    ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 2;
    roundRect(p.x, p.y, p.w, p.h, 16); ctx.stroke();
    ctx.fillStyle = '#fbbf24'; ctx.font = 'bold 22px Arial';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('🏆 ДОСТИЖЕНИЯ', p.x + p.w / 2, p.y + 32);
    ctx.fillStyle = '#ef4444';
    roundRect(p.x + p.w - 46, p.y + 8, 38, 38, 10); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 22px Arial';
    ctx.fillText('✕', p.x + p.w - 27, p.y + 27);
    const total = ACHIEVEMENTS.length;
    const got = Object.keys(unlocked).length;
    ctx.fillStyle = '#94a3b8'; ctx.font = 'bold 13px Arial';
    ctx.fillText('Открыто: ' + got + ' из ' + total, p.x + p.w / 2, p.y + 58);

    const pad = 14;
    const startY = p.y + 76;
    const rowH = 32;
    for (let i = 0; i < ACHIEVEMENTS.length; i++) {
        const a = ACHIEVEMENTS[i];
        const y = startY + i * rowH;
        const isUnlocked = !!unlocked[a.id];
        ctx.fillStyle = isUnlocked ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.03)';
        roundRect(p.x + pad, y, p.w - pad * 2, rowH - 3, 6); ctx.fill();
        ctx.strokeStyle = isUnlocked ? 'rgba(34,197,94,0.5)' : 'rgba(255,255,255,0.08)';
        ctx.lineWidth = 1;
        roundRect(p.x + pad, y, p.w - pad * 2, rowH - 3, 6); ctx.stroke();
        ctx.font = '14px Arial';
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.globalAlpha = isUnlocked ? 1 : 0.35;
        ctx.fillText(a.icon, p.x + pad + 6, y + (rowH - 3) / 2);
        ctx.globalAlpha = 1;
        ctx.fillStyle = isUnlocked ? '#e2e8f0' : '#64748b';
        ctx.font = 'bold 11px Arial';
        ctx.fillText(a.name, p.x + pad + 30, y + 10);
        ctx.fillStyle = isUnlocked ? '#94a3b8' : '#475569';
        ctx.font = '9px Arial';
        ctx.fillText(a.desc, p.x + pad + 30, y + 22);
        ctx.textAlign = 'right';
        if (isUnlocked) {
            ctx.fillStyle = '#22c55e'; ctx.font = 'bold 10px Arial';
            ctx.fillText('✓ +' + a.reward + '💰', p.x + p.w - pad - 6, y + (rowH - 3) / 2);
        } else {
            ctx.fillStyle = '#64748b'; ctx.font = 'bold 10px Arial';
            ctx.fillText('+ ' + a.reward + '💰', p.x + p.w - pad - 6, y + (rowH - 3) / 2);
        }
    }
}

function drawGameOver() {
    ctx.fillStyle = 'rgba(0,0,0,0.85)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ef4444'; ctx.font = 'bold 40px Arial';
    ctx.fillText('ИГРА ОКОНЧЕНА', W / 2, H / 2 - 140);
    ctx.fillStyle = '#e2e8f0'; ctx.font = '20px Arial';
    ctx.fillText('Дошёл до волны ' + wave + ' (Глава ' + Math.ceil(wave/10) + ')', W / 2, H / 2 - 70);
    ctx.fillStyle = '#fbbf24'; ctx.font = 'bold 22px Arial';
    ctx.fillText('Заработал: ' + gold + ' 💰', W / 2, H / 2 - 30);
    ctx.fillStyle = '#a78bfa'; ctx.font = 'bold 18px Arial';
    ctx.fillText('🏆 Рекорд: волна ' + bestWave, W / 2, H / 2 + 10);
    ctx.fillStyle = '#94a3b8'; ctx.font = '15px Arial';
    const total = ACHIEVEMENTS.length;
    const got = Object.keys(unlocked).length;
    ctx.fillText('Достижений: ' + got + '/' + total, W / 2, H / 2 + 45);
    ctx.fillStyle = '#22c55e'; ctx.font = 'bold 22px Arial';
    ctx.fillText('Нажми в любом месте', W / 2, H / 2 + 120);
    ctx.fillStyle = '#94a3b8'; ctx.font = '18px Arial';
    ctx.fillText('чтобы начать заново', W / 2, H / 2 + 150);
}

// ==========================================
// 👹 ВРАГИ
// ==========================================
function drawEnemy(e) {
    const def = ENEMY_TYPES[e.typeId] || ENEMY_TYPES.normal;
    const cx = GRID_X + e.col * CELL_SIZE + CELL_SIZE / 2;
    const cy = e.y;
    const scale = e.spawnProgress;
    if (scale <= 0.01) return;
    const radius = CELL_SIZE * def.size * scale;
    const flash = Math.max(0, e.hitFlash || 0);
    const baseColor = flash > 0 ? '#ffffff' : def.color;
    ctx.globalAlpha = scale;

    if (e.typeId === 'fast') {
        ctx.shadowColor = def.color; ctx.shadowBlur = flash > 0 ? 20 : 10;
        ctx.fillStyle = baseColor;
        ctx.beginPath();
        ctx.moveTo(cx, cy + radius);
        ctx.lineTo(cx - radius, cy - radius * 0.8);
        ctx.lineTo(cx + radius, cy - radius * 0.8);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.stroke();
    } else if (e.typeId === 'tank') {
        ctx.shadowColor = def.color; ctx.shadowBlur = flash > 0 ? 20 : 10;
        ctx.fillStyle = baseColor;
        roundRect(cx - radius, cy - radius, radius * 2, radius * 2, 8); ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2;
        roundRect(cx - radius, cy - radius, radius * 2, radius * 2, 8); ctx.stroke();
    } else if (e.typeId === 'armored') {
        ctx.shadowColor = def.color; ctx.shadowBlur = flash > 0 ? 20 : 10;
        ctx.fillStyle = baseColor;
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
            const a = (i / 8) * Math.PI * 2;
            const innerR = radius * 0.85;
            const outerR = radius * 1.15;
            const a1 = a - 0.15, a2 = a + 0.15;
            ctx.lineTo(cx + Math.cos(a1) * innerR, cy + Math.sin(a1) * innerR);
            ctx.lineTo(cx + Math.cos(a) * outerR, cy + Math.sin(a) * outerR);
            ctx.lineTo(cx + Math.cos(a2) * innerR, cy + Math.sin(a2) * innerR);
        }
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.fillStyle = flash > 0 ? '#ffffff' : '#64748b';
        ctx.beginPath(); ctx.arc(cx, cy, radius * 0.6, 0, Math.PI * 2); ctx.fill();
    } else if (e.typeId === 'splitter') {
        ctx.shadowColor = def.color; ctx.shadowBlur = flash > 0 ? 25 : 14;
        ctx.fillStyle = baseColor;
        ctx.beginPath();
        ctx.moveTo(cx, cy - radius);
        ctx.lineTo(cx + radius, cy);
        ctx.lineTo(cx, cy + radius);
        ctx.lineTo(cx - radius, cy);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.stroke();
        ctx.strokeStyle = '#0e7490'; ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy - radius * 0.7);
        ctx.lineTo(cx - 2, cy - radius * 0.2);
        ctx.lineTo(cx + 2, cy + radius * 0.2);
        ctx.lineTo(cx, cy + radius * 0.7);
        ctx.stroke();
    } else if (e.typeId === 'healer') {
        const pulse = 1 + Math.sin(performance.now() * 0.006) * 0.08;
        ctx.shadowColor = def.color; ctx.shadowBlur = flash > 0 ? 25 : 16;
        ctx.globalAlpha = scale * 0.4;
        ctx.fillStyle = '#10b981';
        ctx.beginPath(); ctx.arc(cx, cy, radius * 1.5 * pulse, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = scale;
        ctx.fillStyle = baseColor;
        ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = '#ffffff'; ctx.shadowBlur = 6;
        const cw = radius * 0.25, ch = radius * 0.9;
        ctx.fillRect(cx - cw / 2, cy - ch / 2, cw, ch);
        ctx.fillRect(cx - ch / 2, cy - cw / 2, ch, cw);
        ctx.shadowBlur = 0;
    } else if (e.typeId === 'shooter') {
        ctx.shadowColor = def.color; ctx.shadowBlur = flash > 0 ? 25 : 14;
        ctx.fillStyle = baseColor;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
            const x = cx + Math.cos(a) * radius;
            const y = cy + Math.sin(a) * radius;
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(cx, cy, radius * 0.45, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#7c3aed';
        ctx.beginPath(); ctx.arc(cx, cy, radius * 0.22, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#a78bfa';
        if (!e.shooterStopped) {
            ctx.fillRect(cx - 2, cy - radius * 1.4, 4, radius * 0.6);
        } else {
            ctx.fillRect(cx - 2, cy + radius, 4, radius * 0.6);
        }
    } else if (e.typeId === 'boss') {
        ctx.shadowColor = '#ef4444';
        ctx.shadowBlur = flash > 0 ? 30 : 22;
        const grad = ctx.createRadialGradient(cx, cy - radius * 0.3, radius * 0.15, cx, cy, radius);
        grad.addColorStop(0, flash > 0 ? '#ffffff' : '#7f1d1d');
        grad.addColorStop(1, flash > 0 ? '#ffffff' : '#0f172a');
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 3; ctx.stroke();
        const eyeOffX = radius * 0.35, eyeOffY = -radius * 0.15, eyeR = radius * 0.18;
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath(); ctx.arc(cx - eyeOffX, cy + eyeOffY, eyeR, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(cx + eyeOffX, cy + eyeOffY, eyeR, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#000';
        ctx.beginPath(); ctx.arc(cx - eyeOffX, cy + eyeOffY, eyeR * 0.5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(cx + eyeOffX, cy + eyeOffY, eyeR * 0.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        const crownY = cy - radius - 4;
        const crownW = radius * 1.1;
        ctx.moveTo(cx - crownW / 2, crownY);
        ctx.lineTo(cx - crownW / 2 + 6, crownY - 12);
        ctx.lineTo(cx - crownW / 6, crownY);
        ctx.lineTo(cx, crownY - 14);
        ctx.lineTo(cx + crownW / 6, crownY);
        ctx.lineTo(cx + crownW / 2 - 6, crownY - 12);
        ctx.lineTo(cx + crownW / 2, crownY);
        ctx.closePath();
        ctx.fill();
    } else {
        ctx.shadowColor = def.color;
        ctx.shadowBlur = flash > 0 ? 20 : 8;
        ctx.fillStyle = baseColor;
        ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.stroke();
    }

    // HP bar
    const barW = Math.max(CELL_SIZE * 0.7, radius * 2);
    const barX = cx - barW / 2;
    const barY = cy - radius - (e.isBoss ? 20 : 12);
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(barX, barY, barW, e.isBoss ? 8 : 6);
    const hpPercent = e.hp / e.maxHp;
    ctx.fillStyle = e.isBoss ? '#fbbf24' : (hpPercent > 0.5 ? '#22c55e' : (hpPercent > 0.2 ? '#facc15' : '#ef4444'));
    ctx.fillRect(barX, barY, barW * hpPercent, e.isBoss ? 8 : 6);
    ctx.globalAlpha = 1;
}

// ==========================================
// 🎨 ЮНИТЫ (6 уровней)
// ==========================================
function drawUnitAt(x, y, size, unit, alpha, time) {
    const type = unit.type;
    const t = UNIT_TYPES[type];
    if (!t) return;
    const recoilK = Math.max(0, unit.recoil || 0);
    const breathe = 1 + Math.sin((time + type * 500) * 0.004) * 0.025;
    const recoilOffsetY = recoilK * 4;
    const recoilSquash = 1 - recoilK * 0.08;
    const hitK = Math.max(0, unit.hitFlash || 0);
    ctx.globalAlpha = alpha;

    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(x + size / 2, y + size - 8, size * 0.28, size * 0.08, 0, 0, Math.PI * 2);
    ctx.fill();

    const cx = x + size / 2;
    const cy = y + size / 2 + recoilOffsetY;
    const radius = size * 0.34 * breathe * recoilSquash;

    const grad = ctx.createRadialGradient(cx, cy - radius * 0.4, radius * 0.2, cx, cy, radius);
    if (hitK > 0.2) {
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.35, '#ffaaaa');
        grad.addColorStop(1, '#ff5555');
    } else {
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.35, t.color);
        grad.addColorStop(1, t.color);
    }
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 2; ctx.stroke();

    // Спец-аура для 5-6 уровней
    if (type === 5) {
        ctx.strokeStyle = 'rgba(236,72,153,0.8)';
        ctx.lineWidth = 2;
        ctx.shadowColor = '#ec4899';
        ctx.shadowBlur = 15;
        ctx.beginPath(); ctx.arc(cx, cy, radius + 3, 0, Math.PI * 2); ctx.stroke();
        ctx.shadowBlur = 0;
    } else if (type === 6) {
        const pulse = 1 + Math.sin(time * 0.008) * 0.12;
        ctx.strokeStyle = 'rgba(251,191,36,0.9)';
        ctx.lineWidth = 3;
        ctx.shadowColor = '#fbbf24';
        ctx.shadowBlur = 20;
        ctx.beginPath(); ctx.arc(cx, cy, radius * pulse + 4, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.arc(cx, cy, radius * pulse + 10, 0, Math.PI * 2); ctx.stroke();
        ctx.shadowBlur = 0;
    }

    if (type === 1) drawSwordsman(cx, cy, radius, t);
    else if (type === 2) drawKnight(cx, cy, radius, t);
    else if (type === 3) drawPaladin(cx, cy, radius, t, time);
    else if (type === 4) drawGeneral(cx, cy, radius, t, time);
    else if (type === 5) drawMarshal(cx, cy, radius, t, time);
    else if (type === 6) drawEmperor(cx, cy, radius, t, time);

    if (recoilK > 0.4) {
        ctx.globalAlpha = alpha * (recoilK - 0.4) / 0.6;
        ctx.strokeStyle = '#fffbb0';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(cx, cy - radius - 4);
        ctx.lineTo(cx, cy - radius - 12);
        ctx.stroke();
    }

    // HP bar юнита
    if (unit.maxHp > 1 && unit.hp < unit.maxHp) {
        ctx.globalAlpha = alpha;
        const barW = radius * 1.8;
        const barX = cx - barW / 2;
        const barY = cy + radius + 4;
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(barX, barY, barW, 4);
        const hpP = Math.max(0, unit.hp / unit.maxHp);
        ctx.fillStyle = hpP > 0.5 ? '#22c55e' : (hpP > 0.25 ? '#facc15' : '#ef4444');
        ctx.fillRect(barX, barY, barW * hpP, 4);
    }

    ctx.globalAlpha = 1;
}

function drawSwordsman(cx, cy, radius, t) {
    ctx.save();
    ctx.translate(cx + radius * 0.7, cy - radius * 0.3);
    ctx.rotate(-0.5);
    ctx.fillStyle = '#e5e7eb';
    ctx.fillRect(-2, -radius * 0.9, 4, radius * 1.1);
    ctx.fillStyle = '#92400e';
    ctx.fillRect(-3, 0, 6, 6);
    ctx.fillStyle = '#6b7280';
    ctx.fillRect(-6, -2, 12, 3);
    ctx.restore();
    ctx.fillStyle = '#94a3b8';
    ctx.beginPath();
    ctx.arc(cx - radius * 0.7, cy, radius * 0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#475569'; ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.strokeStyle = '#475569';
    ctx.beginPath();
    ctx.moveTo(cx - radius * 0.7, cy - radius * 0.25);
    ctx.lineTo(cx - radius * 0.7, cy + radius * 0.25);
    ctx.moveTo(cx - radius * 0.95, cy);
    ctx.lineTo(cx - radius * 0.45, cy);
    ctx.stroke();
}

function drawKnight(cx, cy, radius, t) {
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - radius * 0.5, cy - radius * 0.5);
    ctx.quadraticCurveTo(cx - radius * 1.1, cy - radius * 1.1, cx - radius * 0.7, cy - radius * 1.4);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + radius * 0.5, cy - radius * 0.5);
    ctx.quadraticCurveTo(cx + radius * 1.1, cy - radius * 1.1, cx + radius * 0.7, cy - radius * 1.4);
    ctx.stroke();
    ctx.fillStyle = 'rgba(15,23,42,0.85)';
    ctx.beginPath();
    ctx.ellipse(cx, cy + radius * 0.05, radius * 0.7, radius * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#93c5fd';
    ctx.lineWidth = 1.5;
    for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(cx - radius * 0.55, cy + radius * 0.05 + i * radius * 0.18);
        ctx.lineTo(cx + radius * 0.55, cy + radius * 0.05 + i * radius * 0.18);
        ctx.stroke();
    }
    ctx.fillStyle = '#3b82f6';
    ctx.beginPath();
    ctx.moveTo(cx, cy + radius * 0.6);
    ctx.lineTo(cx + radius * 0.35, cy + radius * 0.85);
    ctx.lineTo(cx, cy + radius * 1.05);
    ctx.lineTo(cx - radius * 0.35, cy + radius * 0.85);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#1e40af'; ctx.lineWidth = 1.5; ctx.stroke();
}

function drawPaladin(cx, cy, radius, t, time) {
    const haloPulse = 1 + Math.sin(time * 0.006) * 0.1;
    ctx.strokeStyle = '#fde68a';
    ctx.lineWidth = 3;
    ctx.shadowColor = '#fde68a';
    ctx.shadowBlur = 15;
    ctx.beginPath();
    ctx.ellipse(cx, cy - radius * 1.1, radius * 0.7 * haloPulse, radius * 0.18, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#fde68a';
    ctx.shadowColor = '#fde68a';
    ctx.shadowBlur = 8;
    const crossW = radius * 0.16;
    const crossH = radius * 0.7;
    ctx.fillRect(cx - crossW / 2, cy - crossH * 0.4, crossW, crossH);
    ctx.fillRect(cx - crossH * 0.25, cy - crossW / 2 - radius * 0.05, crossH * 0.5, crossW);
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(139,92,246,0.6)';
    ctx.beginPath();
    ctx.moveTo(cx - radius * 0.9, cy);
    ctx.lineTo(cx - radius * 1.15, cy + radius * 0.9);
    ctx.lineTo(cx + radius * 1.15, cy + radius * 0.9);
    ctx.lineTo(cx + radius * 0.9, cy);
    ctx.closePath();
    ctx.fill();
}

function drawGeneral(cx, cy, radius, t, time) {
    ctx.fillStyle = 'rgba(127,29,29,0.75)';
    ctx.beginPath();
    ctx.moveTo(cx - radius * 1.05, cy - radius * 0.3);
    ctx.lineTo(cx - radius * 1.25, cy + radius);
    ctx.lineTo(cx + radius * 1.25, cy + radius);
    ctx.lineTo(cx + radius * 1.05, cy - radius * 0.3);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath(); ctx.arc(cx - radius * 0.65, cy + radius * 0.4, radius * 0.16, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + radius * 0.65, cy + radius * 0.4, radius * 0.16, 0, Math.PI * 2); ctx.fill();
    const crownY = cy - radius * 0.85;
    const crownW = radius * 1.3;
    ctx.fillStyle = '#fbbf24';
    ctx.shadowColor = '#fbbf24';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(cx - crownW / 2, crownY);
    ctx.lineTo(cx - crownW / 2 + 4, crownY - 8);
    ctx.lineTo(cx - crownW / 6, crownY);
    ctx.lineTo(cx, crownY - 12);
    ctx.lineTo(cx + crownW / 6, crownY);
    ctx.lineTo(cx + crownW / 2 - 4, crownY - 8);
    ctx.lineTo(cx + crownW / 2, crownY);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    const starPulse = 1 + Math.sin(time * 0.005) * 0.15;
    drawStar(cx, cy + radius * 0.05, radius * 0.35 * starPulse, radius * 0.18, 5, '#fbbf24');
}

// 🩷 МАРШАЛ — плащ, трезубец, три звезды
function drawMarshal(cx, cy, radius, t, time) {
    // Плащ
    ctx.fillStyle = 'rgba(190,24,93,0.85)';
    ctx.beginPath();
    ctx.moveTo(cx - radius * 1.15, cy - radius * 0.3);
    ctx.lineTo(cx - radius * 1.35, cy + radius * 1.1);
    ctx.lineTo(cx + radius * 1.35, cy + radius * 1.1);
    ctx.lineTo(cx + radius * 1.15, cy - radius * 0.3);
    ctx.closePath();
    ctx.fill();

    // Трезубец
    ctx.save();
    ctx.translate(cx + radius * 0.85, cy);
    ctx.strokeStyle = '#fbcfe8';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, -radius * 0.9);
    ctx.lineTo(0, radius * 0.9);
    ctx.stroke();
    // Зубья
    ctx.beginPath();
    ctx.moveTo(-radius * 0.25, -radius * 0.9);
    ctx.lineTo(0, -radius * 0.6);
    ctx.lineTo(radius * 0.25, -radius * 0.9);
    ctx.stroke();
    ctx.restore();

    // Корона поменьше
    const crownY = cy - radius * 0.95;
    const crownW = radius * 1.2;
    ctx.fillStyle = '#fbcfe8';
    ctx.shadowColor = '#ec4899';
    ctx.shadowBlur = 15;
    ctx.beginPath();
    ctx.moveTo(cx - crownW / 2, crownY);
    ctx.lineTo(cx - crownW / 2 + 3, crownY - 10);
    ctx.lineTo(cx - crownW / 6, crownY);
    ctx.lineTo(cx, crownY - 14);
    ctx.lineTo(cx + crownW / 6, crownY);
    ctx.lineTo(cx + crownW / 2 - 3, crownY - 10);
    ctx.lineTo(cx + crownW / 2, crownY);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;

    // Три звезды
    const pulse = 1 + Math.sin(time * 0.007) * 0.1;
    drawStar(cx - radius * 0.4, cy + radius * 0.15, radius * 0.16 * pulse, radius * 0.08, 5, '#fbcfe8');
    drawStar(cx, cy + radius * 0.25, radius * 0.18 * pulse, radius * 0.09, 5, '#fbcfe8');
    drawStar(cx + radius * 0.4, cy + radius * 0.15, radius * 0.16 * pulse, radius * 0.08, 5, '#fbcfe8');
}

// ⚪ ИМПЕРАТОР — двойная аура, скипетр, огромная корона
function drawEmperor(cx, cy, radius, t, time) {
    // Двойной плащ
    ctx.fillStyle = 'rgba(30,41,59,0.9)';
    ctx.beginPath();
    ctx.moveTo(cx - radius * 1.25, cy - radius * 0.3);
    ctx.lineTo(cx - radius * 1.5, cy + radius * 1.2);
    ctx.lineTo(cx + radius * 1.5, cy + radius * 1.2);
    ctx.lineTo(cx + radius * 1.25, cy - radius * 0.3);
    ctx.closePath();
    ctx.fill();

    // Внутренний золотой контур
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - radius * 1.1, cy - radius * 0.2);
    ctx.lineTo(cx - radius * 1.3, cy + radius * 1.05);
    ctx.lineTo(cx + radius * 1.3, cy + radius * 1.05);
    ctx.lineTo(cx + radius * 1.1, cy - radius * 0.2);
    ctx.stroke();

    // Скипетр со звездой
    ctx.save();
    ctx.translate(cx + radius * 0.9, cy);
    ctx.strokeStyle = '#fde68a';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, -radius * 0.4);
    ctx.lineTo(0, radius * 1.0);
    ctx.stroke();
    ctx.restore();
    drawStar(cx + radius * 0.9, cy - radius * 0.55, radius * 0.22, radius * 0.1, 5, '#fde68a');

    // Огромная корона
    const crownY = cy - radius * 1.0;
    const crownW = radius * 1.5;
    ctx.fillStyle = '#fde68a';
    ctx.shadowColor = '#fbbf24';
    ctx.shadowBlur = 25;
    ctx.beginPath();
    ctx.moveTo(cx - crownW / 2, crownY);
    ctx.lineTo(cx - crownW / 2 + 5, crownY - 14);
    ctx.lineTo(cx - crownW / 5, crownY);
    ctx.lineTo(cx - crownW / 10, crownY - 20);
    ctx.lineTo(cx, crownY - 5);
    ctx.lineTo(cx + crownW / 10, crownY - 20);
    ctx.lineTo(cx + crownW / 5, crownY);
    ctx.lineTo(cx + crownW / 2 - 5, crownY - 14);
    ctx.lineTo(cx + crownW / 2, crownY);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;

    // Пульсирующая звезда на груди
    const pulse = 1 + Math.sin(time * 0.006) * 0.2;
    drawStar(cx, cy + radius * 0.05, radius * 0.5 * pulse, radius * 0.24, 6, '#fffbe6');
}

function drawStar(cx, cy, outerR, innerR, points, color) {
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    for (let i = 0; i < points * 2; i++) {
        const r = i % 2 === 0 ? outerR : innerR;
        const a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
        const x = cx + Math.cos(a) * r;
        const y = cy + Math.sin(a) * r;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
}

// ==========================================
// 🔇 ПОТЕРЯ ФОКУСА
// ==========================================
window.addEventListener('blur', () => {
    if (audioCtx && audioCtx.state === 'running') audioCtx.suspend();
});
window.addEventListener('focus', () => {
    if (audioCtx && !soundMuted && audioCtx.state === 'suspended') audioCtx.resume();
});

// ==========================================
// ГЛАВНЫЙ ЦИКЛ
// ==========================================
let lastFrame = 0;
function loop(time) {
    const dt = Math.min((time - lastFrame) / 1000, 0.1);
    lastFrame = time;
    update(dt);
    render(time);
    requestAnimationFrame(loop);
}

initYandexSDK().then(() => {
    gameState = 'idle';
    console.log('Игра запущена!');
    requestAnimationFrame(loop);
});