document.addEventListener('DOMContentLoaded', () => {
    // --- Element Selectors ---
    const gameArea = document.getElementById('game-area');
    const world = document.getElementById('world');
    const p1ScoreEl = document.getElementById('p1-score');
    const p2ScoreEl = document.getElementById('p2-score');
    const levelEl = document.getElementById('level');
    const flowersLeftEl = document.getElementById('flowers-left');
    const timerEl = document.getElementById('timer');
    const livesEl = document.getElementById('lives');
    const messageScreen = document.getElementById('message-screen');
    const levelMessageScreen = document.getElementById('level-message-screen');
    const startButton = document.getElementById('start-button');
    const helpScreen = document.getElementById('help-screen');
    const helpButton = document.getElementById('help-button');
    const closeHelpButton = document.getElementById('close-help-button');
    const devIndicator = document.getElementById('dev-mode-indicator');
    const externalHelpButton = document.getElementById('external-help-button'); // NEW

    // --- Game Constants & State ---
    const gameConstants = { GRAVITY: 0.35, THRUST: 0.6, PLAYER_SPEED: 4.5, BOUNCE_VELOCITY: -5, MAX_FALL_SPEED: 8, LEVEL_TIME: 180, };
    let state = {};
    const keys = { ArrowUp: false, ArrowLeft: false, ArrowRight: false, w: false, a: false, d: false, ' ': false };
    const playerControls = [
        { up: ['w', ' '], left: 'a', right: 'd' },
        { up: ['ArrowUp'], left: 'ArrowLeft', right: 'ArrowRight' }
    ];
    
    // --- Cloud Class ---
    class Cloud {
        constructor(x, y, isThunder = false) {
            this.isThunder = isThunder;
            this.x = x;
            this.y = y;
            this.el = document.createElement('div');
            this.el.className = 'cloud-container';
            world.insertBefore(this.el, world.firstChild);
            const numPuffs = 10 + Math.random() * 5;
            let minX = Infinity, maxX = -Infinity;
            for (let i = 0; i < numPuffs; i++) {
                const puff = document.createElement('div');
                puff.className = `cloud-puff ${this.isThunder ? 'thunder' : 'regular'}`;
                const offsetX = (Math.random() - 0.5) * 150;
                const offsetY = (Math.random() - 0.5) * 50;
                const radius = 20 + Math.random() * 20;
                puff.style.width = `${radius * 2}px`;
                puff.style.height = `${radius * 2}px`;
                puff.style.left = `${offsetX}px`;
                puff.style.top = `${offsetY}px`;
                this.el.appendChild(puff);
                minX = Math.min(minX, offsetX - radius);
                maxX = Math.max(maxX, offsetX + radius);
            }
            this.width = maxX - minX;
            this.el.style.transform = `translate(${this.x}px, ${this.y}px)`;
        }
        update() {
            const speedMultiplier = this.isThunder ? 0.6 : 0.4;
            this.x -= speedMultiplier;
            this.el.style.transform = `translate(${this.x}px, ${this.y}px)`;
        }
        destroy() { this.el.remove(); }
    }

    // --- Game Initialization ---
    function resetGame() {
        state = { level: 1, totalScore: 0, lives: 3, gameLoopId: null, timerId: null, gameOver: false, isTwoPlayer: false, devMode: false };
    }

    function resetLevelState() {
        // We only reset level-specific state here. Players' core data (like score) is handled separately.
        state.platforms = []; state.thorns = []; state.flowers = []; state.clouds = [];
        state.frame = 0; state.flowersToCollect = 0; state.timeLeft = gameConstants.LEVEL_TIME;
        state.levelInProgress = false; state.cameraY = 0;
        state.players = []; // This clears the old player objects (DOM elements, positions, etc.)
    }

    function startGame() {
        resetGame();
        messageScreen.classList.add('hidden');
        p2ScoreEl.classList.add('hidden');
        startLevel();
    }
    
    function startLevel() {
        const oldScores = (state.players || []).map(p => p ? p.score : 0);
        
        resetLevelState();
        clearDynamicElements();
        prepopulateClouds(15); 

        const levelConfig = getLevelConfig(state.level);
        state.flowersToCollect = levelConfig.flowers;
        generateLevel(levelConfig.platforms, levelConfig.thorns, levelConfig.flowers);
        
        const worldRect = world.getBoundingClientRect();
        const startY = worldRect.height - 200;
        
        addPlayer(0, startY, oldScores[0] || 0);

        if (state.isTwoPlayer) {
            addPlayer(1, startY, oldScores[1] || 0);
        }

        const startPlatform = { x: worldRect.width / 2 - 80, y: startY + 100, width: 200, height: 20, };
        startPlatform.el = createGameObject('platform', '🌿', startPlatform.x, startPlatform.y);
        state.platforms.push(startPlatform);
        
        updateCamera();
        updateHUD();
        showLevelMessage(`Level ${state.level}`, 1500, () => {
            state.levelInProgress = true;
            if (state.timerId) clearInterval(state.timerId);
            state.timerId = setInterval(updateTimer, 1000);
            if(state.gameLoopId) cancelAnimationFrame(state.gameLoopId);
            gameLoop();
        });
    }

    function addPlayer(playerIndex, startY, score = 0) {
        const worldRect = world.getBoundingClientRect();
        const player = {
            id: playerIndex + 1,
            el: null,
            hitboxEl: null, // NEW
            x: worldRect.width / 2 + (playerIndex === 0 ? -40 : 40),
            y: startY,
            vx: 0, vy: 0, width: 40, height: 40,
            lastDirection: -1,
            score: score,
            controls: playerControls[playerIndex]
        };
        player.el = createGameObject(`player player-${player.id}-glow`, '🐝', player.x, player.y);
        player.hitboxEl = createHitbox(player.x, player.y, player.width, player.height); // NEW
        state.players[playerIndex] = player;
    }

    // --- Level Generation & Clouds ---
    function prepopulateClouds(count) {
        const worldRect = world.getBoundingClientRect();
        for (let i = 0; i < count; i++) {
            state.clouds.push(new Cloud(Math.random() * worldRect.width, Math.random() * worldRect.height, Math.random() < 0.3));
        }
    }

    function getLevelConfig(level) {
        return { flowers: Math.min(5 + level * 2, 50), platforms: Math.min(10 + level * 2, 40), thorns: Math.min(5 + Math.floor(level * 1.5), 45) };
    }

    function generateLevel(platformCount, thornCount, flowerCount) {
        const worldRect = world.getBoundingClientRect();
        let flowerPlaced = 0;
        let platformsForFlowers = [];
        for (let i = 0; i < platformCount; i++) {
            const platform = { x: Math.random() * (worldRect.width - 80), y: Math.random() * (worldRect.height - 250), width: 80, height: 20 };
            platform.el = createGameObject('platform', '🌿', platform.x, platform.y);
            // Hitbox for platforms isn't strictly needed for gameplay (collision is one-way from top) but useful for dev mode
            platform.hitboxEl = createHitbox(platform.x, platform.y, platform.width, platform.height);
            state.platforms.push(platform);
            platformsForFlowers.push(platform);
        }
        while(flowerPlaced < flowerCount && platformsForFlowers.length > 0) {
            const platformIndex = Math.floor(Math.random() * platformsForFlowers.length);
            const platform = platformsForFlowers[platformIndex];
            const flowerX = platform.x + 20; const flowerY = platform.y - 30;
            const flowerEl = createGameObject('flower', '🌼', flowerX, flowerY);
            const flower = { el: flowerEl, x: flowerX, y: flowerY, width: 35, height: 35 }; // NEW: assign to variable
            flower.hitboxEl = createHitbox(flower.x, flower.y, flower.width, flower.height); // NEW
            state.flowers.push(flower);
            platformsForFlowers.splice(platformIndex, 1);
            flowerPlaced++;
        }
        
        const thornGroupCount = Math.floor(thornCount / 3);
        for (let i = 0; i < thornGroupCount; i++) {
            const clusterCenterX = Math.random() * (worldRect.width - 120) + 60;
            const clusterCenterY = Math.random() * (worldRect.height - 350);
            const playerStartX = worldRect.width / 2;
            const playerStartY = worldRect.height - 200;
            if (Math.abs(clusterCenterX - playerStartX) < 200 && Math.abs(clusterCenterY - playerStartY) < 200) {
                i--; continue;
            }
            const thornPositions = [
                { x: clusterCenterX, y: clusterCenterY },
                { x: clusterCenterX - 25 + (Math.random() * 10 - 5), y: clusterCenterY + 5 + (Math.random() * 10 - 5) },
                { x: clusterCenterX + 25 + (Math.random() * 10 - 5), y: clusterCenterY + 5 + (Math.random() * 10 - 5) }
            ];
            for (const pos of thornPositions) {
                const thorn = { x: pos.x, y: pos.y, width: 40, height: 40, };
                thorn.el = createGameObject('thorn', '🌵', thorn.x, thorn.y);
                thorn.hitboxEl = createHitbox(thorn.x, thorn.y, thorn.width, thorn.height); // NEW
                state.thorns.push(thorn);
            }
        }
    }

    function handleCloudGeneration() {
        state.frame++;
        const worldRect = world.getBoundingClientRect();
        if (state.frame % 150 === 0) {
            state.clouds.push(new Cloud(worldRect.width + 100, Math.random() * worldRect.height));
        }
        if (state.frame % 300 === 0) {
            state.clouds.push(new Cloud(worldRect.width + 200, Math.random() * worldRect.height, true));
        }
    }

    function updateAndDrawClouds() {
        for (let i = state.clouds.length - 1; i >= 0; i--) {
            const cloud = state.clouds[i];
            cloud.update();
            if (cloud.x + cloud.width < 0) {
                cloud.destroy();
                state.clouds.splice(i, 1);
            }
        }
    }

    // --- Game Loop ---
    function gameLoop() {
        if (state.gameOver) return;
        if(state.levelInProgress){
            handleCloudGeneration();
            updateAndDrawClouds();
            handleInput();
            updatePlayers();
            handleCollisions();
        }
        drawPlayers();
        updateCamera();
        state.gameLoopId = requestAnimationFrame(gameLoop);
    }

    function handleInput() {
        state.players.forEach(player => {
            if (!player) return;
            player.vx = 0;
            if (keys[player.controls.left]) { player.vx = -gameConstants.PLAYER_SPEED; player.lastDirection = 1; }
            if (keys[player.controls.right]) { player.vx = gameConstants.PLAYER_SPEED; player.lastDirection = -1; }
            if (player.controls.up.some(key => keys[key])) { player.vy -= gameConstants.THRUST; }
        });
    }

    function updatePlayers() {
        const worldRect = world.getBoundingClientRect();
        const screenHeight = gameArea.clientHeight;

        if (!state.isTwoPlayer || state.players.length < 2 || !state.players[1]) {
            const p = state.players[0];
            if (!p) return;
            p.vy += gameConstants.GRAVITY;
            if (p.vy > gameConstants.MAX_FALL_SPEED) p.vy = gameConstants.MAX_FALL_SPEED;
            p.x += p.vx;
            p.y += p.vy;
        } else {
            const p1 = state.players[0];
            const p2 = state.players[1];
            [p1, p2].forEach(p => {
                p.vy += gameConstants.GRAVITY;
                if (p.vy > gameConstants.MAX_FALL_SPEED) p.vy = gameConstants.MAX_FALL_SPEED;
                p.x += p.vx;
            });
            let p1_nextY = p1.y + p1.vy;
            let p2_nextY = p2.y + p2.vy;
            const topPlayer = (p1_nextY < p2_nextY) ? p1 : p2;
            const bottomPlayer = (p1_nextY < p2_nextY) ? p2 : p1;
            const topPlayer_nextY = (p1_nextY < p2_nextY) ? p1_nextY : p2_nextY;
            const bottomPlayer_nextY = (p1_nextY < p2_nextY) ? p2_nextY : p1_nextY;
            if ((bottomPlayer_nextY + bottomPlayer.height) - topPlayer_nextY > screenHeight) {
                const midpoint = (topPlayer_nextY + (bottomPlayer_nextY + bottomPlayer.height)) / 2;
                topPlayer.y = midpoint - (screenHeight / 2);
                bottomPlayer.y = midpoint + (screenHeight / 2) - bottomPlayer.height;
                p1.vy = 0;
                p2.vy = 0;
            } else {
                p1.y = p1_nextY;
                p2.y = p2_nextY;
            }
        }
        
        state.players.forEach(p => {
            if (!p) return;
            if (p.x < 0) p.x = 0;
            if (p.x + p.width > worldRect.width) p.x = worldRect.width - p.width;
            if (p.y < 0) { p.y = 0; p.vy = 0; }
            if (p.y + p.height > worldRect.height) handleDeath();
        });
    }
    
    function updateCamera() {
        const gameRect = gameArea.getBoundingClientRect();
        const worldRect = world.getBoundingClientRect();
        
        const p1_y = state.players[0].y;
        const p2_y = state.players[1]?.y || p1_y;
        const averagePlayerY = (p1_y + p2_y) / 2;

        let targetCameraY = averagePlayerY - (gameRect.height / 2);
        const maxCameraY = worldRect.height - gameRect.height;
        if (targetCameraY > maxCameraY) targetCameraY = maxCameraY;
        if (targetCameraY < 0) targetCameraY = 0;
        state.cameraY = targetCameraY;
        gameArea.scrollTop = state.cameraY;
    }

    function handleCollisions() {
        state.players.forEach(p => {
            if (!p) return;
            for (const thorn of state.thorns) { if (isColliding(p, thorn)) { handleDeath(); return; } }
            for (let i = state.flowers.length - 1; i >= 0; i--) { const flower = state.flowers[i]; if (isColliding(p, flower)) { collectFlower(flower, i, p); } }
            for (const platform of state.platforms) {
                if (isColliding(p, platform)) {
                    const prevPlayerBottom = (p.y - p.vy) + p.height;
                    if (p.vy > 0 && prevPlayerBottom <= platform.y + 5) { p.y = platform.y - p.height; p.vy = gameConstants.BOUNCE_VELOCITY; }
                }
            }
        });
    }
    
    // --- State Changers & Handlers ---
    function collectFlower(flower, index, player) {
        flower.el.remove();
        if (flower.hitboxEl) flower.hitboxEl.remove(); // NEW: remove hitbox
        state.flowers.splice(index, 1);
        player.score += 100;
        state.totalScore = state.players.reduce((sum, p) => sum + (p ? p.score : 0), 0); // Recalculate total score
        state.flowersToCollect--;
        updateHUD();
        if (state.flowersToCollect <= 0) { nextLevel(); }
    }

    function nextLevel() {
        state.levelInProgress = false; 
        state.totalScore += Math.max(0, state.timeLeft * 10);
        if (state.totalScore > 0) {
            const timeBonus = Math.max(0, state.timeLeft * 10);
            state.players.forEach(p => {
                if(p) {
                    const scoreContribution = p.score / state.totalScore;
                    p.score += Math.round(timeBonus * scoreContribution);
                }
            });
        }
        
        state.level++;
        if (state.level % 3 === 0) state.lives++;
        showLevelMessage("Level Complete!", 2000, startLevel);
    }

    function handleDeath() {
        if (state.devMode) return;
        if (!state.levelInProgress) return;
        state.levelInProgress = false; 
        state.lives--;
        updateHUD();
        if (state.lives <= 0) {
            endGame(); 
        } else {
            showLevelMessage("Try Again", 2000, startLevel);
        }
    }

    function endGame() {
        state.gameOver = true; 
        clearInterval(state.timerId); 
        cancelAnimationFrame(state.gameLoopId);
        messageScreen.querySelector('h1').textContent = 'Game Over';
        const p = messageScreen.querySelectorAll('.instructions');
        const finalP1Score = state.players[0]?.score || 0;
        const finalP2Score = state.players[1]?.score || 0;
        state.totalScore = finalP1Score + finalP2Score;

        p[0].textContent = `Final Score: ${state.totalScore}`;
        p[1].textContent = `P1: ${finalP1Score}`;
        if (state.isTwoPlayer) {
            p[1].textContent += ` | P2: ${finalP2Score}`;
        }
        p[2].textContent = `Reached Level: ${state.level}`;
        p[3].textContent = '';
        startButton.textContent = 'Play Again'; 
        messageScreen.classList.remove('hidden');
    }

    function updateTimer() {
        if (state.devMode) return;
        if (state.levelInProgress) { state.timeLeft--; updateHUD(); if (state.timeLeft <= 0) handleDeath(); }
    }

    // --- Drawing & UI ---
    function updateHUD() {
        p1ScoreEl.textContent = `P1: ${state.players[0]?.score || 0}`;
        if (state.isTwoPlayer) {
            p2ScoreEl.textContent = `P2: ${state.players[1]?.score || 0}`;
        }
        levelEl.textContent = `LEVEL: ${state.level}`;
        flowersLeftEl.textContent = `🌼: ${state.flowersToCollect}`;
        livesEl.textContent = `LIVES: ${'🐝'.repeat(Math.max(0, state.lives))}`;
        const minutes = Math.floor(state.timeLeft / 60); const seconds = state.timeLeft % 60;
        timerEl.textContent = `⏱️ ${minutes}:${String(seconds).padStart(2, '0')}`;
    }
    
    function drawPlayers() {
        state.players.forEach(player => {
            if (!player || !player.el) return;
            player.el.style.transform = `translate(${player.x}px, ${player.y}px) scaleX(${player.lastDirection})`;
            if (player.hitboxEl) { // NEW: update hitbox position
                player.hitboxEl.style.transform = `translate(${player.x}px, ${player.y}px)`;
            }
        });
    }

    function showLevelMessage(text, duration, callback) {
        levelMessageScreen.textContent = text; levelMessageScreen.classList.remove('hidden');
        setTimeout(() => { levelMessageScreen.classList.add('hidden'); if (callback) callback(); }, duration);
    }
    
    // --- Utility Functions ---
    function createGameObject(className, emoji, x, y) {
        const el = document.createElement('div');
        el.className = `game-object ${className}`; el.textContent = emoji;
        el.style.transform = `translate(${x}px, ${y}px)`;
        world.appendChild(el);
        return el;
    }
    
    // NEW: Hitbox creation utility
    function createHitbox(x, y, width, height) {
        const hitboxEl = document.createElement('div');
        hitboxEl.className = 'hitbox';
        if (!state.devMode) hitboxEl.classList.add('hidden');
        hitboxEl.style.width = `${width}px`;
        hitboxEl.style.height = `${height}px`;
        hitboxEl.style.transform = `translate(${x}px, ${y}px)`;
        world.appendChild(hitboxEl);
        return hitboxEl;
    }

    function isColliding(rect1, rect2) {
        return ( rect1.x < rect2.x + rect2.width && rect1.x + rect1.width > rect2.x && rect1.y < rect2.y + rect2.height && rect1.y + rect1.height > rect2.y );
    }
    
    function clearDynamicElements() { world.innerHTML = ''; }

    // --- Dev Mode ---
    function toggleDevMode() {
        state.devMode = !state.devMode;
        devIndicator.classList.toggle('hidden', !state.devMode);
        document.querySelectorAll('.hitbox').forEach(box => { // NEW: toggle all hitboxes
            box.classList.toggle('hidden', !state.devMode);
        });
        console.log(`Dev mode ${state.devMode ? 'enabled' : 'disabled'}.`);
        if (state.devMode) {
            console.log('Commands: [N] Next Level');
        }
    }

    // --- Event Listeners ---
    window.addEventListener('keydown', e => { 
        // NEW: Toggle dev mode with 'D' key, but don't prevent movement.
        if (e.key.toLowerCase() === 'd' && !e.repeat) {
            toggleDevMode();
        }

        if (e.key in keys) { e.preventDefault(); keys[e.key] = true; }

        if (e.key === 'ArrowUp' && !state.isTwoPlayer && state.gameLoopId) {
            e.preventDefault();
            state.isTwoPlayer = true;
            addPlayer(1, state.players[0].y, 0); // P2 starts with 0 score
            p2ScoreEl.classList.remove('hidden');
            console.log("Player 2 has joined the game!");
        }

        // MODIFIED: 'H' key toggles help screen
        if (e.key.toLowerCase() === 'h') {
            if (messageScreen.classList.contains('hidden')) {
               helpScreen.classList.toggle('hidden');
            }
        }

        if (state.devMode && state.levelInProgress) {
            if (e.key.toLowerCase() === 'n') {
                console.log("DEV: Skipping to next level.");
                nextLevel();
            }
        }
    });

    window.addEventListener('keyup', e => { if (e.key in keys) { e.preventDefault(); keys[e.key] = false; } });
    
    startButton.addEventListener('click', startGame);
    helpButton.addEventListener('click', () => helpScreen.classList.remove('hidden'));
    closeHelpButton.addEventListener('click', () => helpScreen.classList.add('hidden'));
    externalHelpButton.addEventListener('click', () => helpScreen.classList.remove('hidden')); // NEW
});
