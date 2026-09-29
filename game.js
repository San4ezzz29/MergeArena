// ==========================================
// MERGE ARENA — Prototype v0.6
// Добавлено: кнопка вкл/выкл звука
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
// 🎵 ЗВУК (с поддержкой mute)
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
    if (soundMuted) return;
    if (!audioCtx) return;
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
    1: { name: 'Мечник',  color: '#4ade80', damage: 1, cooldown: 1.0 },
    2: { name: 'Рыцарь',  color: '#60a5fa', damage: 2, cooldown: 0.8 },
    3: { name: 'Паладин', color: '#a78bfa', damage: 4, cooldown: 0.7 },
    4: { name: 'Генерал', color: '#f59e0b', damage: 8, cooldown: 0.5 }
};

const SHOP_UNITS = [
    { type: 1, price: 10 },
    { type: 2, price: 30 },
    { type: 3, price: 80 },
    { type: 4, price: 200 }
];

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
    grid[5][1] = { type: 1, cooldown: 0 };
    grid[5][2] = { type: 1, cooldown: 0 };
    grid[4][3] = { type: 2, cooldown: 0 };
}
resetGrid();

let enemies = [];
let bullets = [];
let flashes = [];
let floaters = [];
let wave = 0;
let playerHp = 5;
const MAX_HP = 5;
let gold = 0;
let gameState = 'idle';
let shopOpen = false;
let notification = null;
let bestWave = parseInt(localStorage.getItem('mergeArena_bestWave') || '0', 10);

function notify(text, color) {
    notification = { text, life: 1.5, maxLife: 1.5, color: color || '#e2e8f0' };
}

// ==========================================
// ГЕОМЕТРИЯ UI
// ==========================================
function getMainButtons() {
    const gap = 12;
    const totalW = W - 40;
    const bw = (totalW - gap) / 2;
    const bh = 56;
    const y = 100;
    return {
        shop: { x: 20, y, w: bw, h: bh },
        start: { x: 20 + bw + gap, y, w: bw, h: bh }
    };
}
function getShopPanel() {
    const w = Math.min(W - 40, 420);
    const h = 420;
    return { x: (W - w) / 2, y: (H - h) / 2, w, h };
}
function getShopItemRects() {
    const p = getShopPanel();
    const pad = 20;
    const rowH = 70;
    const gap = 10;
    const items = [];
    for (let i = 0; i < SHOP_UNITS.length; i++) {
        items.push({ x: p.x + pad, y: p.y + 70 + i * (rowH + gap), w: p.w - pad * 2, h: rowH });
    }
    return items;
}
function getSoundButton() {
    const size = 38;
    return { x: W - size - 12, y: 48, w: size, h: size };
}
function inRect(px, py, r) {
    return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}

// ==========================================
// ВВОД
// ==========================================
let dragging = null;

function getPointer(e) {
    const rect = canvas.getBoundingClientRect();
    const t = e.touches ? e.touches[0] : e;
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

    // 🔊 Кнопка звука — работает ВСЕГДА, в любом состоянии
    const sBtn = getSoundButton();
    if (inRect(p.x, p.y, sBtn)) {
        soundMuted = !soundMuted;
        localStorage.setItem('mergeArena_muted', soundMuted ? '1' : '0');
        if (!soundMuted) {
            // 🔊 короткий подтверждающий звук при включении
            playTone(900, 0.08, 'sine', 0.05);
            setTimeout(() => playTone(1300, 0.12, 'sine', 0.05), 80);
        }
        return;
    }

    // --- Game Over ---
    if (gameState === 'gameover') { restart(); return; }

    // --- Магазин ---
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

    // --- Кнопки idle ---
    if (gameState === 'idle') {
        const btns = getMainButtons();
        if (inRect(p.x, p.y, btns.shop)) { shopOpen = true; return; }
        if (inRect(p.x, p.y, btns.start)) { startWave(); return; }
    }

    // --- Перетаскивание ---
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
            grid[cell.row][cell.col] = { type: dragging.type, cooldown: 0 };
        } else if (target.type === dragging.type && target.type < 4) {
            grid[cell.row][cell.col] = { type: target.type + 1, cooldown: 0 };
            playTone(700, 0.08, 'sine', 0.04);
            setTimeout(() => playTone(1000, 0.1, 'sine', 0.04), 60);
        } else {
            grid[dragging.fromRow][dragging.fromCol] = { type: dragging.type, cooldown: 0 };
        }
    } else {
        grid[dragging.fromRow][dragging.fromCol] = { type: dragging.type, cooldown: 0 };
    }
    dragging = null;
}

// ==========================================
// МАГАЗИН
// ==========================================
function findFreeCell() {
    for (let r = ROWS - 1; r >= 0; r--) {
        for (let c = 0; c < COLS; c++) {
            if (!grid[r][c]) return { row: r, col: c };
        }
    }
    return null;
}
function tryBuy(item) {
    if (gold < item.price) { notify('Не хватает золота!', '#ef4444'); sfxError(); return; }
    const spot = findFreeCell();
    if (!spot) { notify('Нет места на поле!', '#ef4444'); sfxError(); return; }
    gold -= item.price;
    grid[spot.row][spot.col] = { type: item.type, cooldown: 0 };
    sfxBuy();
    notify('Куплен ' + UNIT_TYPES[item.type].name + '!', '#22c55e');
}

// ==========================================
// ВОЛНЫ
// ==========================================
function startWave() {
    wave++;
    gameState = 'wave';
    shopOpen = false;
    sfxWaveStart();
    const count = 2 + wave;
    for (let i = 0; i < count; i++) {
        const hp = 3 + wave * 2;
        enemies.push({
            col: Math.floor(Math.random() * COLS),
            y: GRID_Y - 40 - Math.random() * 120,
            hp: hp, maxHp: hp,
            speed: 30 + wave * 4,
            hitFlash: 0
        });
    }
}
function restart() {
    enemies = []; bullets = []; flashes = []; floaters = [];
    wave = 0; playerHp = MAX_HP; gold = 0;
    gameState = 'idle'; shopOpen = false; notification = null;
    resetGrid();
}
function goldForKill() { return 2 + Math.floor(wave / 3); }

// ==========================================
// ОБНОВЛЕНИЕ
// ==========================================
function update(dt) {
    for (let i = flashes.length - 1; i >= 0; i--) { flashes[i].life -= dt; if (flashes[i].life <= 0) flashes.splice(i, 1); }
    for (let i = floaters.length - 1; i >= 0; i--) {
        floaters[i].life -= dt; floaters[i].y += floaters[i].vy * dt;
        if (floaters[i].life <= 0) floaters.splice(i, 1);
    }
    if (notification) { notification.life -= dt; if (notification.life <= 0) notification = null; }
    for (const e of enemies) { if (e.hitFlash > 0) e.hitFlash -= dt * 5; }

    if (gameState !== 'wave') return;

    for (let i = enemies.length - 1; i >= 0; i--) {
        const e = enemies[i];
        e.y += e.speed * dt;
        if (e.y > GRID_Y + CELL_SIZE * ROWS + 20) {
            enemies.splice(i, 1);
            playerHp--; sfxHurt();
            if (playerHp <= 0) {
                playerHp = 0;
                gameState = 'gameover';
                sfxGameOver();
                if (wave > bestWave) {
                    bestWave = wave;
                    localStorage.setItem('mergeArena_bestWave', String(bestWave));
                }
                return;
            }
        }
    }

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
                sfxShoot();
                unit.cooldown = t.cooldown;
            }
        }
    }

    for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        b.x += b.vx * dt; b.y += b.vy * dt;
        if (!enemies.includes(b.target)) { bullets.splice(i, 1); continue; }
        const eX = GRID_X + b.target.col * CELL_SIZE + CELL_SIZE / 2;
        const eY = b.target.y;
        const dist = Math.hypot(b.x - eX, b.y - eY);
        if (dist < CELL_SIZE * 0.2) {
            b.target.hp -= b.damage; b.target.hitFlash = 1;
            flashes.push({ x: eX, y: eY, life: 0.2, maxLife: 0.2, color: '#ffcc44', size: CELL_SIZE * 0.4 });
            sfxHit();
            if (b.target.hp <= 0) {
                const idx = enemies.indexOf(b.target);
                if (idx >= 0) enemies.splice(idx, 1);
                const reward = goldForKill();
                gold += reward;
                sfxKill();
                floaters.push({ x: eX, y: eY, vy: -50, text: '+' + reward + '💰', color: '#fbbf24', life: 0.9, maxLife: 0.9 });
            }
            bullets.splice(i, 1);
        }
        if (b.y < -50 || b.y > H + 50 || b.x < -50 || b.x > W + 50) bullets.splice(i, 1);
    }

    if (enemies.length === 0) gameState = 'idle';
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

function render() {
    CELL_SIZE = calcGrid();
    ctx.fillStyle = '#16213e';
    ctx.fillRect(0, 0, W, H);

    // ===== Верхний UI =====
    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 22px Arial';
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillText('MERGE ARENA', W / 2, 28);

    ctx.font = 'bold 15px Arial';
    ctx.fillStyle = '#94a3b8';
    ctx.textAlign = 'left';
    ctx.fillText('❤️ ' + playerHp + '/' + MAX_HP, 16, 28);
    ctx.textAlign = 'right';
    ctx.fillText('Волна: ' + wave, W - 16, 28);

    ctx.textAlign = 'center';
    ctx.font = 'bold 18px Arial';
    ctx.fillStyle = '#fbbf24';
    ctx.fillText('💰 ' + gold + '   🏆 ' + bestWave, W / 2, 62);

    // ===== 🔇 Кнопка звука (всегда видна) =====
    drawSoundButton();

    // ===== Кнопки (idle) =====
    if (gameState === 'idle') {
        const btns = getMainButtons();
        ctx.fillStyle = '#3b82f6';
        roundRect(btns.shop.x, btns.shop.y, btns.shop.w, btns.shop.h, 12); ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 18px Arial';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('🛒 МАГАЗИН', btns.shop.x + btns.shop.w / 2, btns.shop.y + btns.shop.h / 2);

        ctx.fillStyle = '#22c55e';
        roundRect(btns.start.x, btns.start.y, btns.start.w, btns.start.h, 12); ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.fillText(wave === 0 ? '▶ СТАРТ' : '▶ СЛЕД. ВОЛНА', btns.start.x + btns.start.w / 2, btns.start.y + btns.start.h / 2);
    } else if (gameState === 'wave') {
        ctx.fillStyle = '#facc15';
        ctx.font = 'bold 18px Arial';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('⚔️ Бой идёт...', W / 2, 128);
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

    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
        const unit = grid[r][c];
        if (!unit) continue;
        drawUnitAt(GRID_X + c * CELL_SIZE, GRID_Y + r * CELL_SIZE, CELL_SIZE, unit.type, 1);
    }

    for (const e of enemies) drawEnemy(e);

    for (const b of bullets) {
        ctx.fillStyle = b.color; ctx.globalAlpha = 0.35;
        ctx.beginPath(); ctx.arc(b.x - b.vx * 0.015, b.y - b.vy * 0.015, 5, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
        ctx.shadowColor = b.color; ctx.shadowBlur = 12;
        ctx.fillStyle = '#fffbe6';
        ctx.beginPath(); ctx.arc(b.x, b.y, 4, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
    }

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

    if (dragging) drawUnitAt(dragging.x - CELL_SIZE / 2, dragging.y - CELL_SIZE / 2, CELL_SIZE, dragging.type, 0.85);

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

    if (shopOpen) drawShop();
    if (gameState === 'gameover') drawGameOver();
}

// 🔊/🔇 Отрисовка кнопки звука
function drawSoundButton() {
    const b = getSoundButton();
    // Фон
    ctx.fillStyle = soundMuted ? 'rgba(239,68,68,0.2)' : 'rgba(34,197,94,0.2)';
    roundRect(b.x, b.y, b.w, b.h, 10); ctx.fill();
    ctx.strokeStyle = soundMuted ? '#ef4444' : '#22c55e';
    ctx.lineWidth = 1.5;
    roundRect(b.x, b.y, b.w, b.h, 10); ctx.stroke();
    // Иконка
    ctx.font = '20px Arial';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(soundMuted ? '🔇' : '🔊', b.x + b.w / 2, b.y + b.h / 2 + 1);
}

function drawShop() {
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(0, 0, W, H);
    const p = getShopPanel();
    ctx.fillStyle = '#1e293b';
    roundRect(p.x, p.y, p.w, p.h, 16); ctx.fill();
    ctx.strokeStyle = '#3b82f6'; ctx.lineWidth = 2;
    roundRect(p.x, p.y, p.w, p.h, 16); ctx.stroke();

    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 22px Arial';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('🛒 МАГАЗИН', p.x + p.w / 2, p.y + 35);

    ctx.fillStyle = '#ef4444';
    roundRect(p.x + p.w - 50, p.y + 10, 40, 40, 10); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 22px Arial';
    ctx.fillText('✕', p.x + p.w - 30, p.y + 30);

    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 16px Arial';
    ctx.fillText('💰 ' + gold, p.x + p.w / 2, p.y + 58);

    const items = getShopItemRects();
    for (let i = 0; i < items.length; i++) {
        const r = items[i];
        const item = SHOP_UNITS[i];
        const t = UNIT_TYPES[item.type];
        const canBuy = gold >= item.price;
        ctx.fillStyle = canBuy ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.05)';
        roundRect(r.x, r.y, r.w, r.h, 10); ctx.fill();
        ctx.strokeStyle = canBuy ? '#22c55e' : '#475569';
        ctx.lineWidth = 1.5;
        roundRect(r.x, r.y, r.w, r.h, 10); ctx.stroke();

        const cx = r.x + 40, cy = r.y + r.h / 2, radius = 22;
        const grad = ctx.createRadialGradient(cx, cy - radius * 0.3, radius * 0.2, cx, cy, radius);
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.3, t.color);
        grad.addColorStop(1, t.color);
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 18px Arial';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(String(item.type), cx, cy + 1);

        ctx.textAlign = 'left';
        ctx.fillStyle = '#e2e8f0';
        ctx.font = 'bold 17px Arial';
        ctx.fillText(t.name, r.x + 78, r.y + 26);
        ctx.fillStyle = canBuy ? '#fbbf24' : '#64748b';
        ctx.font = 'bold 15px Arial';
        ctx.fillText('💰 ' + item.price, r.x + 78, r.y + 50);

        ctx.fillStyle = canBuy ? '#22c55e' : '#334155';
        const bx = r.x + r.w - 100, by = r.y + 15, bw = 80, bh = 40;
        roundRect(bx, by, bw, bh, 8); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('КУПИТЬ', bx + bw / 2, by + bh / 2);
    }

    ctx.fillStyle = '#64748b';
    ctx.font = '13px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Тап по строке — купить юнита на поле', p.x + p.w / 2, p.y + p.h - 15);
}

function drawGameOver() {
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ef4444';
    ctx.font = 'bold 40px Arial';
    ctx.fillText('ИГРА ОКОНЧЕНА', W / 2, H / 2 - 130);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '20px Arial';
    ctx.fillText('Дошёл до волны ' + wave, W / 2, H / 2 - 60);
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 22px Arial';
    ctx.fillText('Заработал: ' + gold + ' 💰', W / 2, H / 2 - 20);
    ctx.fillStyle = '#a78bfa';
    ctx.font = 'bold 18px Arial';
    ctx.fillText('🏆 Рекорд: волна ' + bestWave, W / 2, H / 2 + 20);
    ctx.fillStyle = '#22c55e';
    ctx.font = 'bold 22px Arial';
    ctx.fillText('Нажми в любом месте', W / 2, H / 2 + 100);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '18px Arial';
    ctx.fillText('чтобы начать заново', W / 2, H / 2 + 130);
}

function drawEnemy(e) {
    const cx = GRID_X + e.col * CELL_SIZE + CELL_SIZE / 2;
    const cy = e.y;
    const radius = CELL_SIZE * 0.22;
    const flash = Math.max(0, e.hitFlash || 0);
    const baseColor = flash > 0 ? '#ffffff' : '#ef4444';
    ctx.shadowColor = '#ef4444';
    ctx.shadowBlur = flash > 0 ? 20 : 8;
    ctx.fillStyle = baseColor;
    ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.stroke();
    const barW = CELL_SIZE * 0.7;
    const barX = cx - barW / 2;
    const barY = cy - radius - 12;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(barX, barY, barW, 6);
    ctx.fillStyle = '#22c55e';
    ctx.fillRect(barX, barY, barW * (e.hp / e.maxHp), 6);
}

function drawUnitAt(x, y, size, type, alpha) {
    const t = UNIT_TYPES[type];
    if (!t) return;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(x + size / 2, y + size - 8, size * 0.28, size * 0.08, 0, 0, Math.PI * 2);
    ctx.fill();
    const cx = x + size / 2, cy = y + size / 2;
    const radius = size * 0.34;
    const grad = ctx.createRadialGradient(cx, cy - radius * 0.3, radius * 0.2, cx, cy, radius);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.3, t.color);
    grad.addColorStop(1, t.color);
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold ' + Math.floor(size * 0.28) + 'px Arial';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(String(type), cx, cy + 1);
    ctx.globalAlpha = 1;
}

// ==========================================
// ГЛАВНЫЙ ЦИКЛ
// ==========================================
let lastFrame = 0;
function loop(time) {
    const dt = Math.min((time - lastFrame) / 1000, 0.1);
    lastFrame = time;
    update(dt);
    render();
    requestAnimationFrame(loop);
}
requestAnimationFrame(loop);