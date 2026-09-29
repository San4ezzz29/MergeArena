// ==========================================
// MERGE ARENA — v1.0
// Этап C: спрайты юнитов + анимация атаки
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
    if (soundMuted || !audioCtx) return;
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
function sfxBossSpawn() {
    playTone(80, 0.5, 'sawtooth', 0.09);
    setTimeout(() => playTone(60, 0.7, 'sawtooth', 0.09), 300);
}
function sfxBossKill() {
    playTone(220, 0.2, 'sine', 0.08);
    setTimeout(() => playTone(330, 0.2, 'sine', 0.08), 150);
    setTimeout(() => playTone(440, 0.2, 'sine', 0.08), 300);
    setTimeout(() => playTone(660, 0.5, 'sine', 0.08), 450);
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

const UNIT_TYPES = {
    1: { name: 'Мечник',  color: '#4ade80', accent: '#e5e7eb', damage: 1, cooldown: 1.0 },
    2: { name: 'Рыцарь',  color: '#60a5fa', accent: '#93c5fd', damage: 2, cooldown: 0.8 },
    3: { name: 'Паладин', color: '#a78bfa', accent: '#fde68a', damage: 4, cooldown: 0.7 },
    4: { name: 'Генерал', color: '#f59e0b', accent: '#fbbf24', damage: 8, cooldown: 0.5 }
};

const SHOP_UNITS = [
    { type: 1, price: 10 },
    { type: 2, price: 30 },
    { type: 3, price: 80 },
    { type: 4, price: 200 }
];

// ==========================================
// 👹 ТИПЫ ВРАГОВ
// ==========================================
const ENEMY_TYPES = {
    normal:    { name: 'Обычный',       color: '#ef4444', hpMul: 1,   speedMul: 1,   size: 0.22, resist: 0    },
    tank:      { name: 'Толстый',       color: '#a855f7', hpMul: 3,   speedMul: 0.5, size: 0.28, resist: 0    },
    fast:      { name: 'Быстрый',       color: '#facc15', hpMul: 0.5, speedMul: 2.0, size: 0.16, resist: 0    },
    armored:   { name: 'Бронированный', color: '#94a3b8', hpMul: 2,   speedMul: 0.7, size: 0.24, resist: 0.5  },
    boss:      { name: 'БОСС',          color: '#111827', hpMul: 12,  speedMul: 0.3, size: 0.42, resist: 0.2  }
};

function getEnemyTypesForWave(w) {
    if (w % 10 === 0) return ['boss'];
    const pool = ['normal'];
    if (w >= 3) pool.push('tank');
    if (w >= 5) pool.push('fast');
    if (w >= 8) pool.push('armored');
    return pool;
}

// ==========================================
// 🏆 ДОСТИЖЕНИЯ
// ==========================================
const ACHIEVEMENTS = [
    { id: 'firstBlood',    icon: '🩸', name: 'Первая кровь',   desc: 'Убей первого врага',         reward: 5  },
    { id: 'mergeMaster',   icon: '🥈', name: 'Мерж-мастер',    desc: 'Собери первого Паладина',    reward: 20 },
    { id: 'generalissimo', icon: '🥇', name: 'Генералиссимус', desc: 'Собери Генерала',            reward: 50 },
    { id: 'richMan',       icon: '💰', name: 'Богач',          desc: 'Накопи 500 золота',          reward: 25 },
    { id: 'survivor10',    icon: '🔥', name: 'Выживший',       desc: 'Дойди до 10-й волны',        reward: 30 },
    { id: 'untouchable',   icon: '🛡️', name: 'Непробиваемый',  desc: 'Пройди волну без потери HP', reward: 15 },
    { id: 'sniper',        icon: '🎯', name: 'Снайпер',        desc: 'Убей 100 врагов',            reward: 30 },
    { id: 'comboMaster',   icon: '⚡', name: 'Комбо-мастер',   desc: 'Сделай комбо ×5',            reward: 20 },
    { id: 'martyr',        icon: '💀', name: 'Мученик',        desc: 'Проиграй первый раз',        reward: 5  },
    { id: 'shopaholic',    icon: '🛒', name: 'Шопоголик',      desc: 'Купи 10 юнитов',             reward: 15 },
    { id: 'bossSlayer',    icon: '👑', name: 'Убийца боссов',  desc: 'Убей первого босса',         reward: 40 }
];

let unlocked = {};
let stats = { totalKills: 0, unitsBought: 0, maxCombo: 0, gamesPlayed: 0, bossesKilled: 0 };
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
function resetGrid() {
    grid = [];
    for (let r = 0; r < ROWS; r++) {
        grid[r] = [];
        for (let c = 0; c < COLS; c++) grid[r][c] = null;
    }
    grid[5][1] = { type: 1, cooldown: 0, recoil: 0 };
    grid[5][2] = { type: 1, cooldown: 0, recoil: 0 };
    grid[4][3] = { type: 2, cooldown: 0, recoil: 0 };
}
resetGrid();

let enemies = [];
let bullets = [];
let flashes = [];
let floaters = [];
let particles = [];
let damageNumbers = [];
let achievementPopups = [];
let wave = 0;
let playerHp = 5;
const MAX_HP = 5;
let gold = 0;
let gameState = 'idle';
let shopOpen = false;
let achievementsOpen = false;
let notification = null;
let bestWave = parseInt(localStorage.getItem('mergeArena_bestWave') || '0', 10);
let bossWarning = 0;

let shakeTime = 0, shakeIntensity = 0;
let screenFlash = 0;
let combo = 0, comboTimer = 0;
let hpAtWaveStart = MAX_HP;

function notify(text, color) { notification = { text, life: 1.5, maxLife: 1.5, color: color || '#e2e8f0' }; }
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
    const gap = 12;
    const totalW = W - 40;
    const bw = (totalW - gap) / 2;
    const bh = 56;
    const y = 110;
    return {
        shop: { x: 20, y, w: bw, h: bh },
        start: { x: 20 + bw + gap, y, w: bw, h: bh }
    };
}
function getShopPanel() { const w = Math.min(W - 40, 420); const h = 420; return { x: (W - w) / 2, y: (H - h) / 2, w, h }; }
function getShopItemRects() {
    const p = getShopPanel();
    const pad = 20, rowH = 70, gap = 10;
    const items = [];
    for (let i = 0; i < SHOP_UNITS.length; i++) {
        items.push({ x: p.x + pad, y: p.y + 70 + i * (rowH + gap), w: p.w - pad * 2, h: rowH });
    }
    return items;
}
function getSoundButton() { return { x: W - 44, y: 6, w: 36, h: 36 }; }
function getAchievementsButton() { return { x: W - 86, y: 6, w: 36, h: 36 }; }
function getAchievementsPanel() { const w = Math.min(W - 40, 440); const h = 600; return { x: (W - w) / 2, y: (H - h) / 2, w, h }; }
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
        const items = getShopItemRects();
        for (let i = 0; i < items.length; i++) {
            if (inRect(p.x, p.y, items[i])) { tryBuy(SHOP_UNITS[i]); return; }
        }
        return;
    }

    if (gameState === 'idle') {
        const btns = getMainButtons();
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
    const p = getPointer(e);
    if (dragging) { dragging.x = p.x; dragging.y = p.y; }
}
function onUp(e) {
    if (!dragging) return;
    const p = getPointer(e);
    const cell = pickCell(p.x, p.y);
    if (cell) {
        const target = grid[cell.row][cell.col];
        if (!target) {
            grid[cell.row][cell.col] = { type: dragging.type, cooldown: 0, recoil: 0 };
        } else if (target.type === dragging.type && target.type < 4) {
            const newType = target.type + 1;
            grid[cell.row][cell.col] = { type: newType, cooldown: 0, recoil: 0 };
            playTone(700, 0.08, 'sine', 0.04);
            setTimeout(() => playTone(1000, 0.1, 'sine', 0.04), 60);
            const cx = GRID_X + cell.col * CELL_SIZE + CELL_SIZE / 2;
            const cy = GRID_Y + cell.row * CELL_SIZE + CELL_SIZE / 2;
            spawnParticles(cx, cy, UNIT_TYPES[newType].color, 12, 180, 4);
            if (newType === 3) checkAchievement('mergeMaster');
            if (newType === 4) checkAchievement('generalissimo');
        } else {
            grid[dragging.fromRow][dragging.fromCol] = { type: dragging.type, cooldown: 0, recoil: 0 };
        }
    } else {
        grid[dragging.fromRow][dragging.fromCol] = { type: dragging.type, cooldown: 0, recoil: 0 };
    }
    dragging = null;
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
    grid[spot.row][spot.col] = { type: item.type, cooldown: 0, recoil: 0 };
    stats.unitsBought++;
    saveProgress();
    sfxBuy();
    notify('Куплен ' + UNIT_TYPES[item.type].name + '!', '#22c55e');
    if (stats.unitsBought >= 10) checkAchievement('shopaholic');
}

// ==========================================
// ВОЛНЫ
// ==========================================
function spawnEnemy(typeId, slotIndex, totalSlots) {
    const def = ENEMY_TYPES[typeId];
    const baseHp = 3 + wave * 2;
    const baseSpeed = 30 + wave * 4;
    const hp = Math.max(1, Math.round(baseHp * def.hpMul));
    const speed = baseSpeed * def.speedMul;
    const col = Math.floor((slotIndex / totalSlots) * COLS + Math.random() * 0.9) % COLS;
    enemies.push({
        typeId: typeId, col: col,
        y: GRID_Y - 40 - Math.random() * 100,
        hp: hp, maxHp: hp, speed: speed,
        hitFlash: 0, spawnProgress: 0,
        isBoss: typeId === 'boss'
    });
}
function startWave() {
    wave++;
    gameState = 'wave';
    shopOpen = false; achievementsOpen = false;
    hpAtWaveStart = playerHp;
    sfxWaveStart();
    if (wave >= 10) checkAchievement('survivor10');
    const typesPool = getEnemyTypesForWave(wave);
    if (wave % 10 === 0) {
        spawnEnemy('boss', 2, 5);
        bossWarning = 3.0;
        sfxBossSpawn();
        triggerShake(10, 0.5);
    } else {
        const count = 2 + wave;
        for (let i = 0; i < count; i++) {
            const typeId = typesPool[Math.floor(Math.random() * typesPool.length)];
            spawnEnemy(typeId, i, count);
        }
    }
}
function restart() {
    enemies = []; bullets = []; flashes = []; floaters = [];
    particles = []; damageNumbers = []; achievementPopups = [];
    wave = 0; playerHp = MAX_HP; gold = 0;
    gameState = 'idle'; shopOpen = false; achievementsOpen = false;
    notification = null; combo = 0; comboTimer = 0; screenFlash = 0;
    bossWarning = 0;
    resetGrid();
}
function goldForKill(e) { let base = 2 + Math.floor(wave / 3); if (e && e.isBoss) base *= 10; return base; }

// ==========================================
// ОБНОВЛЕНИЕ
// ==========================================
function update(dt) {
    if (shakeTime > 0) { shakeTime -= dt; if (shakeTime <= 0) shakeIntensity = 0; }
    if (screenFlash > 0) screenFlash = Math.max(0, screenFlash - dt * 3);
    if (comboTimer > 0) { comboTimer -= dt; if (comboTimer <= 0) combo = 0; }
    if (bossWarning > 0) bossWarning -= dt;

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

    // Остывание recoil юнитов
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            const u = grid[r][c];
            if (u && u.recoil > 0) u.recoil = Math.max(0, u.recoil - dt * 5);
        }
    }

    if (gameState !== 'wave') return;

    for (let i = enemies.length - 1; i >= 0; i--) {
        const e = enemies[i];
        e.y += e.speed * dt;
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

    // Стрельба юнитов
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            const unit = grid[r][c];
            if (!unit) continue;
            unit.cooldown -= dt;
            if (unit.cooldown > 0) continue;
            const unitX = GRID_X + c * CELL_SIZE + CELL_SIZE / 2;
            const unitY = GRID_Y + r * CELL_SIZE + CELL_SIZE / 2;
            let target = null, bestDist = Infinity;
            for (const e of enemies) {
                if (e.col !== c) continue;
                if (e.spawnProgress < 1) continue;
                if (e.y < unitY) { const d = Math.abs(unitY - e.y); if (d < bestDist) { bestDist = d; target = e; } }
            }
            if (target) {
                const t = UNIT_TYPES[unit.type];
                const eX = GRID_X + target.col * CELL_SIZE + CELL_SIZE / 2;
                const eY = target.y;
                const dx = eX - unitX, dy = eY - unitY;
                const len = Math.hypot(dx, dy) || 1;
                const speed = 600;
                bullets.push({ x: unitX, y: unitY, vx: (dx / len) * speed, vy: (dy / len) * speed, target, damage: t.damage, color: t.color });
                flashes.push({ x: unitX, y: unitY, life: 0.15, maxLife: 0.15, color: '#ffffaa', size: CELL_SIZE * 0.3 });
                // 🎬 Recoil — юнит дёргается вниз/назад при выстреле
                unit.recoil = 1;
                sfxShoot();
                unit.cooldown = t.cooldown;
            }
        }
    }

    // Пули
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
            if (targetDef.resist > 0) dmg = Math.max(1, Math.round(dmg * (1 - targetDef.resist)));
            b.target.hp -= dmg;
            b.target.hitFlash = 1;

            flashes.push({ x: eX, y: eY, life: 0.2, maxLife: 0.2, color: '#ffcc44', size: CELL_SIZE * 0.4 });
            spawnParticles(eX, eY, '#ffdd55', 5, 130, 3);
            damageNumbers.push({
                x: eX + (Math.random() * 20 - 10), y: eY - 10,
                vy: -60, life: 0.55, maxLife: 0.55,
                text: '-' + dmg, color: '#ffe066', size: 16
            });
            sfxHit();

            if (b.target.hp <= 0) {
                const killed = b.target;
                const idx = enemies.indexOf(killed);
                if (idx >= 0) enemies.splice(idx, 1);

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
            bullets.splice(i, 1);
        }
        if (b.y < -50 || b.y > H + 50 || b.x < -50 || b.x > W + 50) bullets.splice(i, 1);
    }

    if (enemies.length === 0) {
        gameState = 'idle';
        if (playerHp === hpAtWaveStart && wave >= 2) checkAchievement('untouchable');
    }
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

    // Пули
    for (const b of bullets) {
        ctx.fillStyle = b.color; ctx.globalAlpha = 0.35;
        ctx.beginPath(); ctx.arc(b.x - b.vx * 0.015, b.y - b.vy * 0.015, 5, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
        ctx.shadowColor = b.color; ctx.shadowBlur = 12;
        ctx.fillStyle = '#fffbe6';
        ctx.beginPath(); ctx.arc(b.x, b.y, 4, 0, Math.PI * 2); ctx.fill();
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
        const fakeUnit = { type: dragging.type, recoil: 0 };
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

    ctx.font = 'bold 16px Arial';
    ctx.fillStyle = '#fbbf24';
    const goldText = '💰 ' + gold;
    const bestText = '🏆 ' + bestWave;
    const waveText = '⚔️ Волна ' + wave;
    const totalW = ctx.measureText(goldText).width + ctx.measureText(bestText).width + ctx.measureText(waveText).width + 40;
    let curX = (W - totalW) / 2;
    ctx.textAlign = 'left';
    ctx.fillText(goldText, curX, 62); curX += ctx.measureText(goldText).width + 20;
    ctx.fillStyle = '#a78bfa';
    ctx.fillText(bestText, curX, 62); curX += ctx.measureText(bestText).width + 20;
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(waveText, curX, 62);

    if (gameState === 'idle') {
        const btns = getMainButtons();
        const pulse = 1 + Math.sin(time * 0.005) * 0.03;
        ctx.fillStyle = '#3b82f6';
        roundRect(btns.shop.x, btns.shop.y, btns.shop.w, btns.shop.h, 12); ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 18px Arial';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('🛒 МАГАЗИН', btns.shop.x + btns.shop.w / 2, btns.shop.y + btns.shop.h / 2);
        const sW = btns.start.w * pulse, sH = btns.start.h * pulse;
        const sX = btns.start.x - (sW - btns.start.w) / 2;
        const sY = btns.start.y - (sH - btns.start.h) / 2;
        ctx.fillStyle = '#22c55e';
        roundRect(sX, sY, sW, sH, 12); ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.fillText(wave === 0 ? '▶ СТАРТ' : '▶ СЛЕД. ВОЛНА', btns.start.x + btns.start.w / 2, btns.start.y + btns.start.h / 2);
    } else if (gameState === 'wave') {
        ctx.fillStyle = '#facc15';
        ctx.font = 'bold 18px Arial';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('⚔️ Бой идёт...', W / 2, 130);
        if (combo >= 3) {
            const k = Math.min(1, comboTimer / 0.4);
            ctx.globalAlpha = k;
            ctx.fillStyle = '#fbbf24';
            ctx.font = 'bold 34px Arial';
            ctx.textAlign = 'center';
            ctx.shadowColor = '#000'; ctx.shadowBlur = 8;
            ctx.fillText('COMBO ×' + combo + '!', W / 2, 168);
            ctx.shadowBlur = 0;
            ctx.globalAlpha = 1;
        }
    }

    // БОСС-баннер
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
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(0, 0, W, H);
    const p = getShopPanel();
    ctx.fillStyle = '#1e293b';
    roundRect(p.x, p.y, p.w, p.h, 16); ctx.fill();
    ctx.strokeStyle = '#3b82f6'; ctx.lineWidth = 2;
    roundRect(p.x, p.y, p.w, p.h, 16); ctx.stroke();
    ctx.fillStyle = '#e2e8f0'; ctx.font = 'bold 22px Arial';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('🛒 МАГАЗИН', p.x + p.w / 2, p.y + 35);
    ctx.fillStyle = '#ef4444';
    roundRect(p.x + p.w - 50, p.y + 10, 40, 40, 10); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 22px Arial';
    ctx.fillText('✕', p.x + p.w - 30, p.y + 30);
    ctx.fillStyle = '#fbbf24'; ctx.font = 'bold 16px Arial';
    ctx.fillText('💰 ' + gold, p.x + p.w / 2, p.y + 58);

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

        // Мини-юнит в магазине — рисуем того же типа
        const miniX = r.x + 8;
        const miniY = r.y + 6;
        const miniSize = 58;
        const fakeUnit = { type: item.type, recoil: 0 };
        drawUnitAt(miniX, miniY, miniSize, fakeUnit, 1, performance.now());

        ctx.textAlign = 'left';
        ctx.fillStyle = '#e2e8f0'; ctx.font = 'bold 17px Arial';
        ctx.fillText(t.name, r.x + 78, r.y + 26);
        ctx.fillStyle = canBuy ? '#fbbf24' : '#64748b'; ctx.font = 'bold 15px Arial';
        ctx.fillText('💰 ' + item.price, r.x + 78, r.y + 50);

        ctx.fillStyle = canBuy ? '#22c55e' : '#334155';
        const bx = r.x + r.w - 100, by = r.y + 15, bw = 80, bh = 40;
        roundRect(bx, by, bw, bh, 8); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('КУПИТЬ', bx + bw / 2, by + bh / 2);
    }
    ctx.fillStyle = '#64748b'; ctx.font = '13px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Тап по строке — купить юнита', p.x + p.w / 2, p.y + p.h - 15);
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
    ctx.fillText('🏆 ДОСТИЖЕНИЯ', p.x + p.w / 2, p.y + 35);
    ctx.fillStyle = '#ef4444';
    roundRect(p.x + p.w - 50, p.y + 10, 40, 40, 10); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 22px Arial';
    ctx.fillText('✕', p.x + p.w - 30, p.y + 30);
    const total = ACHIEVEMENTS.length;
    const got = Object.keys(unlocked).length;
    ctx.fillStyle = '#94a3b8'; ctx.font = 'bold 14px Arial';
    ctx.fillText('Открыто: ' + got + ' из ' + total, p.x + p.w / 2, p.y + 62);

    const pad = 14;
    const startY = p.y + 82;
    const rowH = 42;
    for (let i = 0; i < ACHIEVEMENTS.length; i++) {
        const a = ACHIEVEMENTS[i];
        const y = startY + i * rowH;
        const isUnlocked = !!unlocked[a.id];
        ctx.fillStyle = isUnlocked ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.03)';
        roundRect(p.x + pad, y, p.w - pad * 2, rowH - 4, 8); ctx.fill();
        ctx.strokeStyle = isUnlocked ? 'rgba(34,197,94,0.5)' : 'rgba(255,255,255,0.08)';
        ctx.lineWidth = 1;
        roundRect(p.x + pad, y, p.w - pad * 2, rowH - 4, 8); ctx.stroke();
        ctx.font = '20px Arial';
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.globalAlpha = isUnlocked ? 1 : 0.35;
        ctx.fillText(a.icon, p.x + pad + 10, y + (rowH - 4) / 2);
        ctx.globalAlpha = 1;
        ctx.fillStyle = isUnlocked ? '#e2e8f0' : '#64748b';
        ctx.font = 'bold 13px Arial';
        ctx.fillText(a.name, p.x + pad + 44, y + 13);
        ctx.fillStyle = isUnlocked ? '#94a3b8' : '#475569';
        ctx.font = '10px Arial';
        ctx.fillText(a.desc, p.x + pad + 44, y + 28);
        ctx.textAlign = 'right';
        if (isUnlocked) {
            ctx.fillStyle = '#22c55e'; ctx.font = 'bold 12px Arial';
            ctx.fillText('✓ +' + a.reward + '💰', p.x + p.w - pad - 10, y + (rowH - 4) / 2);
        } else {
            ctx.fillStyle = '#64748b'; ctx.font = 'bold 12px Arial';
            ctx.fillText('+ ' + a.reward + '💰', p.x + p.w - pad - 10, y + (rowH - 4) / 2);
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
    ctx.fillText('Дошёл до волны ' + wave, W / 2, H / 2 - 70);
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
        ctx.shadowColor = def.color;
        ctx.shadowBlur = flash > 0 ? 20 : 10;
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
        ctx.shadowColor = def.color;
        ctx.shadowBlur = flash > 0 ? 20 : 10;
        ctx.fillStyle = baseColor;
        roundRect(cx - radius, cy - radius, radius * 2, radius * 2, 8); ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2;
        roundRect(cx - radius, cy - radius, radius * 2, radius * 2, 8); ctx.stroke();
    } else if (e.typeId === 'armored') {
        ctx.shadowColor = def.color;
        ctx.shadowBlur = flash > 0 ? 20 : 10;
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
// 🎨 ЮНИТЫ — индивидуальный дизайн для каждого
// ==========================================
function drawUnitAt(x, y, size, unit, alpha, time) {
    const type = unit.type;
    const t = UNIT_TYPES[type];
    if (!t) return;

    const recoilK = Math.max(0, unit.recoil || 0);
    const breathe = 1 + Math.sin((time + type * 500) * 0.004) * 0.025;

    // Recoil: сдвиг на пару пикселей + лёгкое сжатие
    const recoilOffsetY = recoilK * 4;
    const recoilSquash = 1 - recoilK * 0.08;

    ctx.globalAlpha = alpha;

    // Тень
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(x + size / 2, y + size - 8, size * 0.28, size * 0.08, 0, 0, Math.PI * 2);
    ctx.fill();

    const cx = x + size / 2;
    const cy = y + size / 2 + recoilOffsetY;
    const radius = size * 0.34 * breathe * recoilSquash;

    // Тело — общее для всех
    const grad = ctx.createRadialGradient(cx, cy - radius * 0.4, radius * 0.2, cx, cy, radius);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.35, t.color);
    grad.addColorStop(1, t.color);
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 2; ctx.stroke();

    // Индивидуальные детали
    if (type === 1) drawSwordsman(cx, cy, radius, t);
    else if (type === 2) drawKnight(cx, cy, radius, t);
    else if (type === 3) drawPaladin(cx, cy, radius, t, time);
    else if (type === 4) drawGeneral(cx, cy, radius, t, time);

    // Recoil-дуга выстрела (короткая жёлтая полоска сверху)
    if (recoilK > 0.4) {
        ctx.globalAlpha = alpha * (recoilK - 0.4) / 0.6;
        ctx.strokeStyle = '#fffbb0';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(cx, cy - radius - 4);
        ctx.lineTo(cx, cy - radius - 12);
        ctx.stroke();
    }

    ctx.globalAlpha = 1;
}

// 🟢 МЕЧНИК — простой воин с мечом и щитом
function drawSwordsman(cx, cy, radius, t) {
    // Меч справа (диагональ)
    ctx.save();
    ctx.translate(cx + radius * 0.7, cy - radius * 0.3);
    ctx.rotate(-0.5);
    // Лезвие
    ctx.fillStyle = '#e5e7eb';
    ctx.fillRect(-2, -radius * 0.9, 4, radius * 1.1);
    // Рукоять
    ctx.fillStyle = '#92400e';
    ctx.fillRect(-3, 0, 6, 6);
    // Гарда
    ctx.fillStyle = '#6b7280';
    ctx.fillRect(-6, -2, 12, 3);
    ctx.restore();

    // Щит слева
    ctx.fillStyle = '#94a3b8';
    ctx.beginPath();
    ctx.arc(cx - radius * 0.7, cy, radius * 0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#475569'; ctx.lineWidth = 1.5;
    ctx.stroke();
    // Крест на щите
    ctx.strokeStyle = '#475569';
    ctx.beginPath();
    ctx.moveTo(cx - radius * 0.7, cy - radius * 0.25);
    ctx.lineTo(cx - radius * 0.7, cy + radius * 0.25);
    ctx.moveTo(cx - radius * 0.95, cy);
    ctx.lineTo(cx - radius * 0.45, cy);
    ctx.stroke();
}

// 🔵 РЫЦАРЬ — шлем с рогами и забралом
function drawKnight(cx, cy, radius, t) {
    // Рога на шлеме
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

    // Забрало — горизонтальные полоски
    ctx.fillStyle = 'rgba(15,23,42,0.85)';
    ctx.beginPath();
    ctx.ellipse(cx, cy + radius * 0.05, radius * 0.7, radius * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();

    // Полоски забрала
    ctx.strokeStyle = '#93c5fd';
    ctx.lineWidth = 1.5;
    for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(cx - radius * 0.55, cy + radius * 0.05 + i * radius * 0.18);
        ctx.lineTo(cx + radius * 0.55, cy + radius * 0.05 + i * radius * 0.18);
        ctx.stroke();
    }

    // Щит-ромб снизу
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

// 🟣 ПАЛАДИН — святое сияние, крест
function drawPaladin(cx, cy, radius, t, time) {
    // Ореол над головой (пульсирует)
    const haloPulse = 1 + Math.sin(time * 0.006) * 0.1;
    ctx.strokeStyle = '#fde68a';
    ctx.lineWidth = 3;
    ctx.shadowColor = '#fde68a';
    ctx.shadowBlur = 15;
    ctx.beginPath();
    ctx.ellipse(cx, cy - radius * 1.1, radius * 0.7 * haloPulse, radius * 0.18, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Крест на груди
    ctx.fillStyle = '#fde68a';
    ctx.shadowColor = '#fde68a';
    ctx.shadowBlur = 8;
    const crossW = radius * 0.16;
    const crossH = radius * 0.7;
    ctx.fillRect(cx - crossW / 2, cy - crossH * 0.4, crossW, crossH);
    ctx.fillRect(cx - crossH * 0.25, cy - crossW / 2 - radius * 0.05, crossH * 0.5, crossW);
    ctx.shadowBlur = 0;

    // Короткий плащ за спиной
    ctx.fillStyle = 'rgba(139,92,246,0.6)';
    ctx.beginPath();
    ctx.moveTo(cx - radius * 0.9, cy);
    ctx.lineTo(cx - radius * 1.15, cy + radius * 0.9);
    ctx.lineTo(cx + radius * 1.15, cy + radius * 0.9);
    ctx.lineTo(cx + radius * 0.9, cy);
    ctx.closePath();
    ctx.fill();
}

// 🟠 ГЕНЕРАЛ — корона со звездой, эполеты
function drawGeneral(cx, cy, radius, t, time) {
    // Плащ
    ctx.fillStyle = 'rgba(127,29,29,0.75)';
    ctx.beginPath();
    ctx.moveTo(cx - radius * 1.05, cy - radius * 0.3);
    ctx.lineTo(cx - radius * 1.25, cy + radius);
    ctx.lineTo(cx + radius * 1.25, cy + radius);
    ctx.lineTo(cx + radius * 1.05, cy - radius * 0.3);
    ctx.closePath();
    ctx.fill();

    // Эполеты
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath(); ctx.arc(cx - radius * 0.65, cy + radius * 0.4, radius * 0.16, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + radius * 0.65, cy + radius * 0.4, radius * 0.16, 0, Math.PI * 2); ctx.fill();

    // Корона на голове
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

    // Звезда на груди (пульсирует)
    const starPulse = 1 + Math.sin(time * 0.005) * 0.15;
    drawStar(cx, cy + radius * 0.05, radius * 0.35 * starPulse, radius * 0.18, 5, '#fbbf24');
}

// Помощник: звезда
function drawStar(cx, cy, outerR, innerR, points, color) {
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
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
requestAnimationFrame(loop);