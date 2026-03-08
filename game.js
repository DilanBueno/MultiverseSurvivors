import { joinRoom } from 'https://esm.sh/trystero@0.20.1/mqtt';

// Verificar se o navegador permite WebRTC (exige HTTPS ou localhost)
if (!window.isSecureContext && window.location.hostname !== 'localhost') {
    alert("AVISO: O multiplayer P2P pode não funcionar em conexões HTTP. Use HTTPS ou localhost.");
}

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreElement = document.getElementById('score');
const ammoUI = document.getElementById('ammo-ui');
const ammoCountElement = document.getElementById('ammo-count');
const healthBar = document.getElementById('health-bar');
const heatUI = document.getElementById('heat-ui');
const heatBarElement = document.getElementById('heat-bar');

// Menu Elements
const startMenu = document.getElementById('start-menu');
const charSelection = document.getElementById('char-selection');
const pauseMenu = document.getElementById('pause-menu');
const remotePauseOverlay = document.getElementById('remote-pause-overlay');
const remotePauseText = document.getElementById('remote-pause-text');
const gameOverMenu = document.getElementById('game-over');
const finalScoreElement = document.getElementById('final-score');

const hostGameButton = document.getElementById('host-game-button');
const joinGameButton = document.getElementById('join-game-button');
const nicknameInput = document.getElementById('nickname-input');
const roomCodeInput = document.getElementById('room-code-input');
const startGameButton = document.getElementById('start-game-button');
const resumeButton = document.getElementById('resume-button');
const restartButton = document.getElementById('restart-button');
const backToMenuButton = document.getElementById('back-to-menu-button');
const retryButton = document.getElementById('retry-button');
const exitButton = document.getElementById('exit-button');
const charCards = document.querySelectorAll('.char-card');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// --- Networking Setup ---
let room;
let sendUpdate, getUpdate;
let sendShoot, getShoot;
let sendEnemies, getEnemies;
let sendEnemyHit, getEnemyHit;
let sendScore, getScore;
let sendPause, getPause;

const remotePlayers = {};
let peers = [];
let isHostMode = false;
let myNickname = "Player";

function initNetwork(isHost, roomCode) {
    isHostMode = isHost;
    const appId = 'multiverse-survivors-v2';
    room = joinRoom({appId: appId}, roomCode);
    
    [sendUpdate, getUpdate] = room.makeAction('update');
    [sendShoot, getShoot] = room.makeAction('shoot');
    [sendEnemies, getEnemies] = room.makeAction('enemies');
    [sendEnemyHit, getEnemyHit] = room.makeAction('enemyHit');
    [sendScore, getScore] = room.makeAction('score');
    [sendPause, getPause] = room.makeAction('pause');

    room.onPeerJoin(peerId => {
        peers.push(peerId);
        remotePlayers[peerId] = {
            x: 0, y: 0, hero: 'scott', direction: 'baixo', isMoving: false,
            frame: 0, orbFrame: 0, isFiring: false, worldMousePos: {x: 0, y: 0},
            isTakingDamage: false, damageAnimFrame: 0, invincibility: 0, nickname: "...",
            laserEndPos: {x: 0, y: 0}
        };
    });

    room.onPeerLeave(peerId => {
        peers = peers.filter(p => p !== peerId);
        delete remotePlayers[peerId];
    });

    getUpdate((data, peerId) => {
        if (remotePlayers[peerId]) Object.assign(remotePlayers[peerId], data);
    });

    getShoot((data, peerId) => {
        if (data.hero === 'wanda') bullets.push(new Projectile(data.x, data.y, data.targetX, data.targetY));
    });

    getEnemies((data) => {
        if (!isHostMode) {
            data.forEach(e => {
                let localEnemy = enemies.find(le => le.id === e.id);
                if (localEnemy) {
                    localEnemy.x = e.x;
                    localEnemy.y = e.y;
                    if (e.health < localEnemy.health) localEnemy.health = e.health;
                } else {
                    const en = new Enemy(e.x, e.y, e.id);
                    en.health = e.health;
                    enemies.push(en);
                }
            });
            enemies = enemies.filter(le => data.find(e => e.id === le.id));
        }
    });

    getEnemyHit((data) => {
        if (isHostMode) {
            const enemy = enemies.find(e => e.id === data.id);
            if (enemy) {
                enemy.health -= data.damage;
                if (enemy.health <= 0) {
                    score += 10;
                    sendScore(score);
                    scoreElement.innerText = `Pontos: ${score}`;
                }
            }
        }
    });

    getScore((newScore) => {
        score = newScore;
        scoreElement.innerText = `Pontos: ${score}`;
    });

    getPause((data) => {
        if (data.paused) {
            currentState = STATES.PAUSED;
            remotePauseText.innerText = `${data.name} PAUSOU`;
            remotePauseOverlay.classList.remove('hidden');
        } else {
            currentState = STATES.PLAYING;
            remotePauseOverlay.classList.add('hidden');
        }
    });
}

// Assets
const sprites = {
    scott: { 'baixo': new Image(), 'cima': new Image(), 'direita': new Image(), 'esquerda': new Image(), 'parado-baixo': new Image(), 'parado-cima': new Image() },
    wanda: { andando: [], orbe: [], disparo: new Image(), dano: [] },
    enemy: new Image()
};

sprites.scott['baixo'].src = 'images/scott  summers/andando-baixo.png';
sprites.scott['cima'].src = 'images/scott  summers/andando-cima.png';
sprites.scott['direita'].src = 'images/scott  summers/andando-direita.png';
sprites.scott['esquerda'].src = 'images/scott  summers/andando-esquerda.png';
sprites.scott['parado-baixo'].src = 'images/scott  summers/parado-baixo.png';
sprites.scott['parado-cima'].src = 'images/scott  summers/parado-cima.png';

for (let i = 1; i <= 12; i++) {
    const frameName = `frame_${i.toString().padStart(2, '0')}.png`;
    sprites.wanda.andando.push(new Image()); sprites.wanda.andando[i-1].src = `images/wanda maximoff/andando/${frameName}`;
    sprites.wanda.orbe.push(new Image()); sprites.wanda.orbe[i-1].src = `images/wanda maximoff/orbe/${frameName}`;
    sprites.wanda.dano.push(new Image()); sprites.wanda.dano[i-1].src = `images/wanda maximoff/levando dano/${frameName}`;
}
sprites.wanda.disparo.src = 'images/wanda maximoff/disparo.png';
sprites.enemy.src = 'images/inimigo/zumbi.png';

const STATES = { MENU: 'MENU', SELECTION: 'SELECTION', PLAYING: 'PLAYING', PAUSED: 'PAUSED', GAMEOVER: 'GAMEOVER' };
let currentState = STATES.MENU;
let selectedHero = 'scott';
let score = 0;
let keys = {};
let mousePos = { x: 0, y: 0 };
let worldMousePos = { x: 0, y: 0 };
let isFiring = false;
let particles = [];
let bloodStains = [];
let bullets = [];
let enemySpawnInterval;
const camera = { x: 0, y: 0, lerp: 0.1, shake: 0 };

class Projectile {
    constructor(x, y, targetX, targetY) {
        this.x = x; this.y = y; this.speed = 15;
        const dx = targetX - x, dy = targetY - y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        this.vx = (dx / dist) * this.speed;
        this.vy = (dy / dist) * this.speed;
        this.angle = Math.atan2(dy, dx);
        this.life = 100;
    }
    update() {
        this.x += this.vx; this.y += this.vy; this.life--;
        if (Math.random() > 0.6) spawnSparks(this.x, this.y, '#ff0055', 1);
    }
    draw() {
        ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.angle);
        ctx.globalAlpha = 0.3; ctx.drawImage(sprites.wanda.disparo, -20, -20, 40, 40);
        ctx.globalAlpha = 1.0; ctx.drawImage(sprites.wanda.disparo, -16, -16, 32, 32);
        ctx.restore();
    }
}

class BloodStain {
    constructor(x, y) {
        this.x = x; this.y = y;
        this.size = Math.random() * 20 + 20;
        this.life = 1.0;
        this.points = [];
        for (let i = 0; i < 6; i++) this.points.push(0.6 + Math.random() * 0.5);
    }
    update() { this.life -= 0.002; }
    draw() {
        ctx.save(); ctx.globalAlpha = this.life * 0.5; ctx.fillStyle = '#440000';
        ctx.translate(this.x, this.y); ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const a = (i / 6) * Math.PI * 2; const r = this.size * this.points[i];
            if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r); else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        ctx.closePath(); ctx.fill();
        ctx.restore();
    }
}

class Particle {
    constructor(x, y, color, speedX, speedY, size, decay) {
        this.x = x; this.y = y; this.color = color;
        this.size = size || Math.random() * 4 + 1;
        this.speedX = speedX || (Math.random() - 0.5) * 10;
        this.speedY = speedY || (Math.random() - 0.5) * 10;
        this.life = 1.0;
        this.decay = decay || Math.random() * 0.08 + 0.04;
    }
    update() { this.x += this.speedX; this.y += this.speedY; this.life -= this.decay; }
    draw() { ctx.fillStyle = this.color; ctx.globalAlpha = this.life; ctx.fillRect(this.x, this.y, this.size, this.size); }
}

function spawnSparks(x, y, color = '#ff0000', count = 5, sx, sy) {
    if (particles.length > 200) return;
    for (let i = 0; i < count; i++) {
        const vx = sx !== undefined ? sx + (Math.random()-0.5)*10 : (Math.random()-0.5)*10;
        const vy = sy !== undefined ? sy + (Math.random()-0.5)*10 : (Math.random()-0.5)*10;
        particles.push(new Particle(x, y, color, vx, vy));
    }
}

window.addEventListener('keydown', e => {
    keys[e.code] = true;
    if (e.code === 'Escape') togglePause();
    if (e.code === 'KeyR' && currentState === STATES.PLAYING && selectedHero === 'wanda') player.reload();
});
window.addEventListener('keyup', e => keys[e.code] = false);
window.addEventListener('mousemove', e => { mousePos.x = e.clientX; mousePos.y = e.clientY; });
window.addEventListener('mousedown', () => { if (currentState === STATES.PLAYING) isFiring = true; });
window.addEventListener('mouseup', () => isFiring = false);

// UI Handlers
hostGameButton.onclick = () => {
    const code = roomCodeInput.value.trim();
    if (!code) return alert("Digite um código para a sala!");
    myNickname = nicknameInput.value || "Host";
    initNetwork(true, code);
    startMenu.classList.add('hidden');
    charSelection.classList.remove('hidden');
    currentState = STATES.SELECTION;
};

joinGameButton.onclick = () => {
    const code = roomCodeInput.value.trim();
    if (!code) return alert("Digite o código da sala para entrar!");
    myNickname = nicknameInput.value || "Player";
    initNetwork(false, code);
    startMenu.classList.add('hidden');
    charSelection.classList.remove('hidden');
    currentState = STATES.SELECTION;
};

charCards.forEach(card => {
    card.onclick = () => { charCards.forEach(c => c.classList.remove('selected')); card.classList.add('selected'); selectedHero = card.dataset.char; };
});
startGameButton.onclick = () => { charSelection.classList.add('hidden'); startGame(); };
resumeButton.onclick = () => togglePause();
restartButton.onclick = () => resetGame();
backToMenuButton.onclick = () => location.reload();
retryButton.onclick = () => { gameOverMenu.classList.add('hidden'); resetGame(); };
exitButton.onclick = () => location.reload();

function startGame() { 
    currentState = STATES.PLAYING; 
    if (selectedHero === 'wanda') { ammoUI.classList.remove('hidden'); heatUI.classList.add('hidden'); }
    else { heatUI.classList.remove('hidden'); ammoUI.classList.add('hidden'); }
    resetGame(); 
}
function togglePause() {
    if (currentState !== STATES.PLAYING && currentState !== STATES.PAUSED) return;
    if (currentState === STATES.PLAYING) {
        currentState = STATES.PAUSED;
        pauseMenu.classList.remove('hidden');
        isFiring = false;
        if (sendPause) sendPause({paused: true, name: myNickname});
    } else {
        if (!pauseMenu.classList.contains('hidden')) {
            currentState = STATES.PLAYING;
            pauseMenu.classList.add('hidden');
            if (sendPause) sendPause({paused: false, name: myNickname});
        }
    }
}
function triggerGameOver() {
    currentState = STATES.GAMEOVER; isFiring = false;
    finalScoreElement.innerText = `Pontos: ${score}`;
    gameOverMenu.classList.remove('hidden');
    if (enemySpawnInterval) clearInterval(enemySpawnInterval);
}

function resetGame() {
    score = 0; scoreElement.innerText = `Pontos: ${score}`; player.reset(selectedHero);
    enemies = []; particles = []; bloodStains = []; bullets = [];
    camera.shake = 0; camera.x = 0; camera.y = 0;
    pauseMenu.classList.add('hidden');
    remotePauseOverlay.classList.add('hidden');
    currentState = STATES.PLAYING;
    if (enemySpawnInterval) clearInterval(enemySpawnInterval);
    if (isHostMode) enemySpawnInterval = setInterval(spawnEnemy, 600);
}

class Player {
    constructor() {
        this.x = 0; this.y = 0; this.speed = 5; this.scale = 2.5;
        this.direction = 'baixo'; this.isMoving = false; this.hero = 'scott';
        this.frame = 0; this.animTimer = 0; this.animSpeed = 0.15;
        this.orbFrame = 0; this.orbTimer = 0; this.orbSpeed = 0.2;
        this.ammo = 30; this.maxAmmo = 30; this.isReloading = false;
        this.reloadTimer = 0; this.shootCooldown = 0;
        this.health = 10; this.maxHealth = 10; this.invincibility = 0;
        this.isTakingDamage = false; this.damageAnimFrame = 0; this.damageAnimTimer = 0;
        this.heat = 0; this.maxHeat = 600; this.isOverheated = false; this.cooldownTimer = 0;
        this.laserEndPos = {x: 0, y: 0};
    }
    reset(hero) {
        this.x = 0; this.y = 0; this.hero = hero; this.frame = 0; this.orbFrame = 0;
        this.scale = (hero === 'wanda') ? 4.5 : 2.5;
        this.ammo = 30; this.isReloading = false; this.health = 10; this.invincibility = 0; this.isTakingDamage = false;
        this.heat = 0; this.isOverheated = false; this.cooldownTimer = 0;
        this.updateHealthBar();
        this.updateHeatBar();
        if (this.hero === 'wanda') ammoCountElement.innerText = this.ammo;
    }
    takeDamage(amt) {
        if (this.invincibility > 0 || currentState !== STATES.PLAYING) return;
        this.health -= amt; this.invincibility = 60; camera.shake = 25;
        if (this.hero === 'wanda') { this.isTakingDamage = true; this.damageAnimFrame = 0; this.damageAnimTimer = 0; }
        this.updateHealthBar();
        if (this.health <= 0) triggerGameOver();
    }
    updateHealthBar() {
        const p = (this.health / this.maxHealth) * 100; healthBar.style.width = p + "%";
        if (p > 50) healthBar.style.background = "#2ecc71"; else if (p > 20) healthBar.style.background = "#f1c40f"; else healthBar.style.background = "#e74c3c";
    }
    updateHeatBar() {
        if (this.hero !== 'scott') return;
        const p = (this.heat / this.maxHeat) * 100;
        heatBarElement.style.height = p + "%";
        if (this.isOverheated) heatBarElement.classList.add('overheated'); else heatBarElement.classList.remove('overheated');
    }
    wandaShoot() {
        if (this.isReloading || this.shootCooldown > 0) return;
        if (this.ammo > 0) {
            const pos = this.getEyePosition();
            bullets.push(new Projectile(pos.x, pos.y, worldMousePos.x, worldMousePos.y));
            if (sendShoot) sendShoot({hero: 'wanda', x: pos.x, y: pos.y, targetX: worldMousePos.x, targetY: worldMousePos.y});
            this.ammo--; this.shootCooldown = 12; camera.shake = 8;
            spawnSparks(pos.x, pos.y, '#ffffff', 3); ammoCountElement.innerText = this.ammo;
        } else this.reload();
    }
    reload() { if (this.isReloading) return; this.isReloading = true; this.reloadTimer = 100; ammoCountElement.innerText = "RELOAD"; ammoCountElement.classList.add('reloading'); }
    update() {
        if (this.invincibility > 0) this.invincibility--;
        if (this.isTakingDamage) {
            this.damageAnimTimer += 0.2;
            if (this.damageAnimTimer >= 1) { this.damageAnimFrame++; this.damageAnimTimer = 0; if (this.damageAnimFrame >= 12) this.isTakingDamage = false; }
        }
        let dx = 0, dy = 0;
        if (keys['KeyW'] || keys['ArrowUp']) dy -= 1; if (keys['KeyS'] || keys['ArrowDown']) dy += 1;
        if (keys['KeyA'] || keys['ArrowLeft']) dx -= 1; if (keys['KeyD'] || keys['ArrowRight']) dx += 1;
        if (dx !== 0 || dy !== 0) {
            this.isMoving = true; const len = Math.sqrt(dx * dx + dy * dy);
            this.x += (dx / len) * this.speed; this.y += (dy / len) * this.speed;
            if (this.hero === 'scott') { if (Math.abs(dy) >= Math.abs(dx)) this.direction = dy < 0 ? 'cima' : 'baixo'; else this.direction = dx < 0 ? 'esquerda' : 'direita'; }
            else { 
                this.animTimer += this.animSpeed; if (this.animTimer >= 1) { this.frame = (this.frame + 1) % 12; this.animTimer = 0; }
                if (dx !== 0) this.direction = dx < 0 ? 'esquerda' : 'direita';
            }
        } else { this.isMoving = false; if (this.hero === 'wanda') this.frame = 0; }
        
        if (this.hero === 'scott') {
            if (isFiring && !this.isOverheated) {
                this.heat += 1;
                if (this.heat >= this.maxHeat) { this.isOverheated = true; this.heat = this.maxHeat; this.cooldownTimer = 300; }
            } else {
                if (this.isOverheated) { this.cooldownTimer--; this.heat = (this.cooldownTimer / 300) * this.maxHeat; if (this.cooldownTimer <= 0) { this.isOverheated = false; this.heat = 0; } }
                else { if (this.heat > 0) this.heat -= 2; if (this.heat < 0) this.heat = 0; }
            }
            this.updateHeatBar();
        }

        if (this.hero === 'wanda') {
            this.orbTimer += this.orbSpeed; if (this.orbTimer >= 1) { this.orbFrame = (this.orbFrame + 1) % 12; this.orbTimer = 0; }
            if (this.isReloading) { this.reloadTimer--; if (this.reloadTimer <= 0) { this.isReloading = false; this.ammo = this.maxAmmo; ammoCountElement.innerText = this.ammo; ammoCountElement.classList.remove('reloading'); } }
            if (this.shootCooldown > 0) this.shootCooldown--;
        }
    }
    draw() {
        let img;
        if (this.hero === 'scott') { let k = this.direction; if (!this.isMoving) k = (this.direction === 'cima') ? 'parado-cima' : 'parado-baixo'; img = sprites.scott[k] || sprites.scott['parado-baixo']; }
        else img = this.isTakingDamage ? sprites.wanda.dano[this.damageAnimFrame] : sprites.wanda.andando[this.frame];
        if (img && img.complete) {
            const h = 64 * this.scale; const w = h * (img.naturalWidth / img.naturalHeight);
            ctx.save(); ctx.translate(this.x, this.y);
            if (this.hero === 'wanda' && worldMousePos.x < this.x) ctx.scale(-1, 1);
            if (this.invincibility % 10 < 5) ctx.drawImage(img, -w / 2, -h / 2, w, h);
            ctx.fillStyle = "white"; ctx.font = "12px Bungee"; ctx.textAlign = "center";
            ctx.fillText(myNickname, 0, -h/2 - 10);
            if (this.hero === 'wanda') {
                const oImg = sprites.wanda.orbe[this.orbFrame];
                if (oImg && oImg.complete) {
                    const fY = Math.sin(Date.now() / 200) * 5; const oS = 0.08; const oW = oImg.naturalWidth * (this.scale / 4) * oS; const oH = oImg.naturalHeight * (this.scale / 4) * oS;
                    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(oImg, 45 - oW / 2, -35 + fY - oH / 2, oW, oH); ctx.restore();
                }
            }
            ctx.restore();
        }
    }
    getEyePosition() {
        if (this.hero === 'scott') return { x: this.x, y: this.y - (64 * this.scale) * 0.42 };
        const isFlipped = worldMousePos.x < this.x;
        return { x: this.x + (isFlipped ? -45 : 45), y: this.y - 35 };
    }
}

function drawRemotePlayer(p) {
    let img;
    const scale = (p.hero === 'wanda') ? 4.5 : 2.5;
    if (p.hero === 'scott') { 
        let k = p.direction; if (!p.isMoving) k = (p.direction === 'cima') ? 'parado-cima' : 'parado-baixo'; 
        img = sprites.scott[k] || sprites.scott['parado-baixo']; 
    }
    else img = p.isTakingDamage ? sprites.wanda.dano[p.damageAnimFrame] : sprites.wanda.andando[p.frame];
    
    if (img && img.complete) {
        const h = 64 * scale; const w = h * (img.naturalWidth / img.naturalHeight);
        ctx.save(); ctx.translate(p.x, p.y);
        if (p.hero === 'wanda' && p.worldMousePos.x < p.x) ctx.scale(-1, 1);
        if (p.invincibility % 10 < 5) ctx.drawImage(img, -w / 2, -h / 2, w, h);
        ctx.fillStyle = "rgba(255,255,255,0.8)"; ctx.font = "12px Bungee"; ctx.textAlign = "center";
        ctx.fillText(p.nickname || "Player", 0, -h/2 - 10);
        if (p.hero === 'wanda') {
            const oImg = sprites.wanda.orbe[p.orbFrame];
            if (oImg && oImg.complete) {
                const fY = Math.sin(Date.now() / 200) * 5; const oS = 0.08; const oW = oImg.naturalWidth * (scale / 4) * oS; const oH = oImg.naturalHeight * (scale / 4) * oS;
                ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(oImg, 45 - oW / 2, -35 + fY - oH / 2, oW, oH); ctx.restore();
            }
        }
        ctx.restore();
    }
    
    if (p.isFiring && p.hero === 'scott') {
        const eyePos = { x: p.x, y: p.y - (64 * scale) * 0.42 };
        drawLaser(eyePos, p.laserEndPos || p.worldMousePos);
    }
}

function drawLaser(pos, targetPos) {
    const dx = targetPos.x - pos.x, dy = targetPos.y - pos.y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    if (dist < 5) return;
    const ux = dx/dist, uy = dy/dist;
    
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const pulse = Math.sin(Date.now()/50) * 10;
    ctx.strokeStyle = 'rgba(255, 0, 0, 0.15)'; ctx.lineWidth = 40 + pulse;
    ctx.beginPath(); ctx.moveTo(pos.x, pos.y); ctx.lineTo(targetPos.x, targetPos.y); ctx.stroke();
    
    const flicker = Math.random() * 5;
    ctx.strokeStyle = '#ff0000'; ctx.lineWidth = 12 + flicker;
    ctx.beginPath(); ctx.moveTo(pos.x, pos.y); ctx.lineTo(targetPos.x, targetPos.y); ctx.stroke();
    
    ctx.strokeStyle = 'white'; ctx.lineWidth = 3 + Math.random()*2;
    ctx.beginPath(); ctx.moveTo(pos.x, pos.y);
    for(let i=0; i<dist; i+=50) {
        const tx = pos.x + ux*i + (Math.random()-0.5)*4;
        const ty = pos.y + uy*i + (Math.random()-0.5)*4;
        ctx.lineTo(tx, ty);
    }
    ctx.lineTo(targetPos.x, targetPos.y); ctx.stroke();
    
    const gradSource = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, 25);
    gradSource.addColorStop(0, 'white'); gradSource.addColorStop(0.4, 'red'); gradSource.addColorStop(1, 'transparent');
    ctx.fillStyle = gradSource; ctx.beginPath(); ctx.arc(pos.x, pos.y, 20 + flicker*2, 0, Math.PI*2); ctx.fill();
    
    const gradHit = ctx.createRadialGradient(targetPos.x, targetPos.y, 0, targetPos.x, targetPos.y, 20);
    gradHit.addColorStop(0, 'white'); gradHit.addColorStop(0.5, 'red'); gradHit.addColorStop(1, 'transparent');
    ctx.fillStyle = gradHit; ctx.beginPath(); ctx.arc(targetPos.x, targetPos.y, 15 + flicker, 0, Math.PI*2); ctx.fill();
    if (Math.random() > 0.3) spawnSparks(targetPos.x, targetPos.y, '#ffcc00', 2, -ux*15, -uy*15);
    ctx.restore();
}

class Enemy {
    constructor(x, y, id) { 
        this.id = id || Math.random().toString(36).substr(2, 9);
        this.x = x; this.y = y; this.speed = 2; this.scale = 3.2; this.health = 2.0; 
        this.laserCooldown = 0;
    }
    update(p) { 
        const dx = p.x - this.x, dy = p.y - this.y; const d = Math.sqrt(dx * dx + dy * dy); 
        if (d > 0) { this.x += (dx / d) * this.speed; this.y += (dy / d) * this.speed; } 
        if (this.laserCooldown > 0) this.laserCooldown--;
    }
    draw() { 
        if (sprites.enemy.complete) { 
            const h = 48 * this.scale; const w = h * (sprites.enemy.naturalWidth / sprites.enemy.naturalHeight); 
            ctx.drawImage(sprites.enemy, this.x - w / 2, this.y - h / 2, w, h); 
        } 
    }
    getHitbox() {
        const h = 48 * this.scale; const w = h * (sprites.enemy.naturalWidth / sprites.enemy.naturalHeight);
        return { x: this.x - w / 2, y: this.y - h / 2, w: w, h: h };
    }
}

const player = new Player();
let enemies = [];

function spawnEnemy() {
    if (currentState !== STATES.PLAYING || !isHostMode) return;
    if (enemies.length < 30) {
        const a = Math.random() * Math.PI * 2; const d = Math.max(canvas.width, canvas.height) * 0.8;
        enemies.push(new Enemy(player.x + Math.cos(a) * d, player.y + Math.sin(a) * d));
    }
}

function drawAsphalt() {
    ctx.fillStyle = '#111'; ctx.fillRect(camera.x - 100, camera.y - 100, canvas.width + 200, canvas.height + 200);
    ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 1;
    const g = 200; const ox = -camera.x % g; const oy = -camera.y % g;
    ctx.beginPath();
    for (let x = ox; x < canvas.width; x += g) { ctx.moveTo(x + camera.x, camera.y); ctx.lineTo(x + camera.x, camera.y + canvas.height); }
    for (let y = oy; y < canvas.height; y += g) { ctx.moveTo(camera.x, y + camera.y); ctx.lineTo(camera.x + canvas.width, y + camera.y); }
    ctx.stroke();
}

function update() {
    if (currentState !== STATES.PLAYING) return;
    player.update();
    if (isFiring && selectedHero === 'wanda') player.wandaShoot();

    if (sendUpdate) {
        sendUpdate({
            x: player.x, y: player.y, hero: player.hero, direction: player.direction,
            isMoving: player.isMoving, frame: player.frame, orbFrame: player.orbFrame,
            isFiring: isFiring && !player.isOverheated, worldMousePos: worldMousePos, 
            laserEndPos: player.laserEndPos, nickname: myNickname,
            isTakingDamage: player.isTakingDamage, damageAnimFrame: player.damageAnimFrame, invincibility: player.invincibility
        });
    }

    if (isHostMode && sendEnemies && enemies.length > 0) {
        sendEnemies(enemies.map(e => ({id: e.id, x: e.x, y: e.y, health: e.health})));
    }

    camera.x += (player.x - canvas.width / 2 - camera.x) * camera.lerp;
    camera.y += (player.y - canvas.height / 2 - camera.y) * camera.lerp;
    camera.shake *= 0.85; worldMousePos.x = mousePos.x + camera.x; worldMousePos.y = mousePos.y + camera.y;
    
    particles = particles.filter(p => p.life > 0); particles.forEach(p => p.update());
    bloodStains = bloodStains.filter(s => s.life > 0); bloodStains.forEach(s => s.update());
    bullets = bullets.filter(b => b.life > 0); bullets.forEach(b => b.update());
    
    if (isFiring && player.hero === 'scott' && !player.isOverheated) camera.shake = Math.max(camera.shake, 5);
    
    const pos = player.getEyePosition();
    const dx = worldMousePos.x - pos.x;
    const dy = worldMousePos.y - pos.y;
    const angle = Math.atan2(dy, dx);
    const maxDist = 3000;
    const projectedTarget = {
        x: pos.x + Math.cos(angle) * maxDist,
        y: pos.y + Math.sin(angle) * maxDist
    };
    player.laserEndPos = {x: projectedTarget.x, y: projectedTarget.y};

    if (player.hero === 'scott' && isFiring && !player.isOverheated) {
        let closestEnemy = null;
        let minDist = Infinity;
        enemies.forEach(enemy => {
            const hb = enemy.getHitbox();
            const collisionPoint = getLineRectCollisionPoint(pos.x, pos.y, projectedTarget.x, projectedTarget.y, hb.x, hb.y, hb.w, hb.h);
            if (collisionPoint) {
                const dist = Math.sqrt((pos.x - collisionPoint.x)**2 + (pos.y - collisionPoint.y)**2);
                if (dist < minDist) {
                    minDist = dist;
                    closestEnemy = enemy;
                    player.laserEndPos = collisionPoint;
                }
            }
        });
        if (closestEnemy && closestEnemy.laserCooldown <= 0) {
            if (isHostMode) closestEnemy.health -= 0.7; else sendEnemyHit({id: closestEnemy.id, damage: 0.7});
            closestEnemy.laserCooldown = 15; 
            camera.shake = 10; if (Math.random() > 0.7) spawnSparks(closestEnemy.x, closestEnemy.y, '#ff3300', 3);
        }
    }

    enemies.forEach((enemy, index) => {
        if (isHostMode) {
            let target = player;
            let minDist = Math.sqrt((player.x - enemy.x)**2 + (player.y - enemy.y)**2);
            for (const id in remotePlayers) {
                const rp = remotePlayers[id];
                const d = Math.sqrt((rp.x - enemy.x)**2 + (rp.y - enemy.y)**2);
                if (d < minDist) { minDist = d; target = rp; }
            }
            enemy.update(target);
            for (let i = index + 1; i < enemies.length; i++) {
                const other = enemies[i];
                const dx = other.x - enemy.x;
                const dy = other.y - enemy.y;
                const distSq = dx * dx + dy * dy;
                const minDistBetween = 60;
                if (distSq < minDistBetween * minDistBetween) {
                    const dist = Math.sqrt(distSq) || 1;
                    const overlap = (minDistBetween - dist) / 2;
                    const ux = dx / dist;
                    const uy = dy / dist;
                    enemy.x -= ux * overlap;
                    enemy.y -= uy * overlap;
                    other.x += ux * overlap;
                    other.y += uy * overlap;
                }
            }
        } else {
            enemy.update({x: 0, y: 0}); 
        }
        const hb = enemy.getHitbox();
        const dxP = player.x - enemy.x, dyP = player.y - enemy.y; 
        if (dxP*dxP + dyP*dyP < 1600) player.takeDamage(1);
        for (let j = bullets.length - 1; j >= 0; j--) {
            const b = bullets[j];
            if (b.x >= hb.x && b.x <= hb.x + hb.w && b.y >= hb.y && b.y <= hb.y + hb.h) {
                if (isHostMode) enemy.health -= 1.0; else sendEnemyHit({id: enemy.id, damage: 1.0});
                camera.shake = 15; spawnSparks(enemy.x, enemy.y, '#ff0055', 6); bullets.splice(j, 1);
            }
        }
        if (isHostMode && enemy.health <= 0) { 
            bloodStains.push(new BloodStain(enemy.x, enemy.y)); 
            enemies.splice(index, 1); 
            score += 10; sendScore(score); scoreElement.innerText = `Pontos: ${score}`; 
            spawnSparks(enemy.x, enemy.y, '#ffffff', 8); 
        }
    });
}

function getLineRectCollisionPoint(x1, y1, x2, y2, rx, ry, rw, rh) {
    const dx = x2 - x1, dy = y2 - y1, len = Math.sqrt(dx * dx + dy * dy);
    if (len < 1) return null;
    const ux = dx / len, uy = dy / len;
    for (let d = 0; d < len; d += 15) {
        const px = x1 + ux * d, py = y1 + uy * d;
        if (px >= rx && px <= rx + rw && py >= ry && py <= ry + rh) return {x: px, y: py};
    }
    return null;
}

function draw() {
    if (currentState === STATES.MENU || currentState === STATES.SELECTION) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    const sx = (Math.random() - 0.5) * camera.shake, sy = (Math.random() - 0.5) * camera.shake;
    ctx.translate(-camera.x + sx, -camera.y + sy);
    drawAsphalt();
    bloodStains.forEach(s => s.draw());
    enemies.forEach(e => e.draw());
    for (const id in remotePlayers) drawRemotePlayer(remotePlayers[id]);
    player.draw();
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; particles.forEach(p => p.draw()); bullets.forEach(b => b.draw()); ctx.restore();
    if (isFiring && currentState === STATES.PLAYING && player.hero === 'scott' && !player.isOverheated) drawLaser(player.getEyePosition(), player.laserEndPos);
    ctx.restore();
}

function gameLoop() { update(); draw(); requestAnimationFrame(gameLoop); }
gameLoop();
window.addEventListener('resize', () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; });
