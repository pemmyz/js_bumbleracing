document.addEventListener('DOMContentLoaded', () => {
    // --- (No changes to the top part of the file) ---
    const gameArea = document.getElementById('game-area');
    const world = document.getElementById('world');
    const scoreEl = document.getElementById('score');
    const levelEl = document.getElementById('level');
    const flowersLeftEl = document.getElementById('flowers-left');
    const timerEl = document.getElementById('timer');
    const livesEl = document.getElementById('lives');
    const messageScreen = document.getElementById('message-screen');
    const levelMessageScreen = document.getElementById('level-message-screen');
    const startButton = document.getElementById('start-button');
    const gameConstants = { GRAVITY: 0.35, THRUST: 0.6, PLAYER_SPEED: 4.5, BOUNCE_VELOCITY: -5, MAX_FALL_SPEED: 8, LEVEL_TIME: 180, };
    let state = {};
    const keys = { ArrowUp: false, ArrowLeft: false, ArrowRight: false, w: false, a: false, d: false, ' ': false };
    
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

    function resetGame() {
        state = { level: 1, score: 0, lives: 3, gameLoopId: null, timerId: null, gameOver: false, };
    }

    function resetLevelState() {
        state.player = { el: null, x: 0, y: 0, vx: 0, vy: 0, width: 40, height: 40, lastDirection: -1, };
        state.platforms = []; state.thorns = []; state.flowers = []; state.clouds = [];
        state.frame = 0; state.flowersToCollect = 0; state.timeLeft = gameConstants.LEVEL_TIME;
        state.levelInProgress = false; state.cameraY = 0;
    }

    function startGame() {
        resetGame();
        messageScreen.classList.add('hidden');
        startLevel();
    }
    
    function startLevel() {
        resetLevelState();
        clearDynamicElements();

        prepopulateClouds(15); 

        const levelConfig = getLevelConfig(state.level);
        state.flowersToCollect = levelConfig.flowers;
        generateLevel(levelConfig.platforms, levelConfig.thorns, levelConfig.flowers);
        const worldRect = world.getBoundingClientRect();
        state.player.x = worldRect.width / 2;
        state.player.y = worldRect.height - 200;
        state.player.el = createGameObject('player', '🐝', state.player.x, state.player.y);
        const startPlatform = { x: state.player.x - 20, y: state.player.y + 100, width: 80, height: 20, isStartPlatform: true, };
        startPlatform.el = createGameObject('platform', '🌿', startPlatform.x, startPlatform.y);
        state.platforms.push(startPlatform);
        const gameRect = gameArea.getBoundingClientRect();
        state.cameraY = state.player.y - (gameRect.height / 2);
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
    
    function prepopulateClouds(count) {
        const worldRect = world.getBoundingClientRect();
        for (let i = 0; i < count; i++) {
            const randomX = Math.random() * worldRect.width;
            const randomY = Math.random() * worldRect.height;
            const isThunder = Math.random() < 0.3; // 30% chance
            state.clouds.push(new Cloud(randomX, randomY, isThunder));
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
            const platform = { x: Math.random() * (worldRect.width - 80), y: Math.random() * (worldRect.height - 250), width: 80, height: 20, hasFlower: false, };
            platform.el = createGameObject('platform', '🌿', platform.x, platform.y);
            state.platforms.push(platform);
            platformsForFlowers.push(platform);
        }
        while(flowerPlaced < flowerCount && platformsForFlowers.length > 0) {
            const platformIndex = Math.floor(Math.random() * platformsForFlowers.length);
            const platform = platformsForFlowers[platformIndex];
            const flowerX = platform.x + 20; const flowerY = platform.y - 30;
            const flowerEl = createGameObject('flower', '🌼', flowerX, flowerY);
            state.flowers.push({ el: flowerEl, x: flowerX, y: flowerY, width: 35, height: 35 });
            platformsForFlowers.splice(platformIndex, 1);
            flowerPlaced++;
        }
        
        // --- MODIFIED: Thorn Generation Logic ---
        const thornGroupCount = Math.floor(thornCount / 3);
        for (let i = 0; i < thornGroupCount; i++) {
            // 1. Define a central point for the cluster, avoiding screen edges
            const clusterCenterX = Math.random() * (worldRect.width - 120) + 60;
            const clusterCenterY = Math.random() * (worldRect.height - 350); // Avoid spawning too low

            // 2. Define player start area to avoid spawning thorns there
            const playerStartX = worldRect.width / 2;
            const playerStartY = worldRect.height - 200;

            // 3. If cluster is too close to player start, retry placement
            if (Math.abs(clusterCenterX - playerStartX) < 200 && Math.abs(clusterCenterY - playerStartY) < 200) {
                i--; // Decrement i to ensure the correct number of clusters are generated
                continue;
            }

            // 4. Create three thorns in a cluster with some random variation
            const thornPositions = [
                { x: clusterCenterX, y: clusterCenterY }, // Center thorn
                { x: clusterCenterX - 25 + (Math.random() * 10 - 5), y: clusterCenterY + 5 + (Math.random() * 10 - 5) }, // Left thorn
                { x: clusterCenterX + 25 + (Math.random() * 10 - 5), y: clusterCenterY + 5 + (Math.random() * 10 - 5) }  // Right thorn
            ];

            for (const pos of thornPositions) {
                const thorn = {
                    x: pos.x,
                    y: pos.y,
                    width: 40,
                    height: 40,
                };
                thorn.el = createGameObject('thorn', '🌵', thorn.x, thorn.y);
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

    function gameLoop() {
        if (state.gameOver) return;
        if(state.levelInProgress){
            handleCloudGeneration();
            updateAndDrawClouds();
            handleInput();
            updatePlayer();
            handleCollisions();
        }
        drawPlayer();
        updateCamera();
        state.gameLoopId = requestAnimationFrame(gameLoop);
    }

    function handleInput() {
        state.player.vx = 0;
        if (keys.ArrowLeft || keys.a) { state.player.vx = -gameConstants.PLAYER_SPEED; state.player.lastDirection = 1; }
        if (keys.ArrowRight || keys.d) { state.player.vx = gameConstants.PLAYER_SPEED; state.player.lastDirection = -1; }
        if (keys.ArrowUp || keys.w || keys[' ']) { state.player.vy -= gameConstants.THRUST; }
    }

    function updatePlayer() {
        state.player.vy += gameConstants.GRAVITY;
        if (state.player.vy > gameConstants.MAX_FALL_SPEED) state.player.vy = gameConstants.MAX_FALL_SPEED;
        state.player.x += state.player.vx;
        state.player.y += state.player.vy;
        const worldRect = world.getBoundingClientRect();
        if (state.player.x < 0) state.player.x = 0;
        if (state.player.x + state.player.width > worldRect.width) state.player.x = worldRect.width - state.player.width;
        if (state.player.y < 0) { state.player.y = 0; state.player.vy = 0; }
        if (state.player.y + state.player.height > worldRect.height) handleDeath();
    }
    
    function updateCamera() {
        const gameRect = gameArea.getBoundingClientRect();
        const worldRect = world.getBoundingClientRect();
        let targetCameraY = state.player.y - (gameRect.height / 2);
        const maxCameraY = worldRect.height - gameRect.height;
        if (targetCameraY > maxCameraY) targetCameraY = maxCameraY;
        if (targetCameraY < 0) targetCameraY = 0;
        state.cameraY = targetCameraY;
        gameArea.scrollTop = state.cameraY;
    }

    function handleCollisions() {
        const p = state.player;
        for (const thorn of state.thorns) { if (isColliding(p, thorn)) { handleDeath(); return; } }
        for (let i = state.flowers.length - 1; i >= 0; i--) { const flower = state.flowers[i]; if (isColliding(p, flower)) { collectFlower(flower, i); } }
        for (const platform of state.platforms) {
            if (isColliding(p, platform)) {
                const prevPlayerBottom = (p.y - p.vy) + p.height;
                if (p.vy > 0 && prevPlayerBottom <= platform.y + 5) { p.y = platform.y - p.height; p.vy = gameConstants.BOUNCE_VELOCITY; }
            }
        }
    }
    
    function collectFlower(flower, index) {
        flower.el.remove(); state.flowers.splice(index, 1);
        state.score += 100; state.flowersToCollect--;
        updateHUD();
        if (state.flowersToCollect <= 0) { nextLevel(); }
    }

    function nextLevel() {
        state.levelInProgress = false; state.score += Math.max(0, state.timeLeft * 10); state.level++;
        if (state.level % 3 === 0) state.lives++;
        showLevelMessage("Level Complete!", 2000, startLevel);
    }

    function handleDeath() {
        if (!state.levelInProgress) return;
        state.levelInProgress = false; state.lives--;
        updateHUD();
        if (state.lives <= 0) endGame(); else showLevelMessage("Try Again", 2000, startLevel);
    }

    function endGame() {
        state.gameOver = true; clearInterval(state.timerId); cancelAnimationFrame(state.gameLoopId);
        messageScreen.querySelector('h1').textContent = 'Game Over';
        const p = messageScreen.querySelectorAll('.instructions');
        p[0].textContent = `Final Score: ${state.score}`; p[1].textContent = `Reached Level: ${state.level}`; p[2].textContent = ''; p[3].textContent = '';
        startButton.textContent = 'Play Again'; messageScreen.classList.remove('hidden');
    }

    function updateTimer() {
        if (state.levelInProgress) { state.timeLeft--; updateHUD(); if (state.timeLeft <= 0) handleDeath(); }
    }

    function updateHUD() {
        scoreEl.textContent = `SCORE: ${state.score}`; levelEl.textContent = `LEVEL: ${state.level}`;
        flowersLeftEl.textContent = `🌼: ${state.flowersToCollect}`;
        livesEl.textContent = `BEE: ${'🐝'.repeat(Math.max(0, state.lives))}`;
        const minutes = Math.floor(state.timeLeft / 60); const seconds = state.timeLeft % 60;
        timerEl.textContent = `⏱️ ${minutes}:${String(seconds).padStart(2, '0')}`;
    }
    
    function createGameObject(className, emoji, x, y) {
        const el = document.createElement('div');
        el.className = `game-object ${className}`; el.textContent = emoji;
        el.style.transform = `translate(${x}px, ${y}px)`;
        world.appendChild(el);
        return el;
    }
    
    function drawPlayer() {
        if (!state.player.el) return;
        state.player.el.style.transform = `translate(${state.player.x}px, ${state.player.y}px) scaleX(${state.player.lastDirection})`;
    }
    
    function isColliding(rect1, rect2) {
        return ( rect1.x < rect2.x + rect2.width && rect1.x + rect1.width > rect2.x && rect1.y < rect2.y + rect2.height && rect1.y + rect1.height > rect2.y );
    }
    
    function clearDynamicElements() { world.innerHTML = ''; }

    function showLevelMessage(text, duration, callback) {
        levelMessageScreen.textContent = text; levelMessageScreen.classList.remove('hidden');
        setTimeout(() => { levelMessageScreen.classList.add('hidden'); if (callback) callback(); }, duration);
    }

    window.addEventListener('keydown', e => { if (e.key in keys) { e.preventDefault(); keys[e.key] = true; } });
    window.addEventListener('keyup', e => { if (e.key in keys) { e.preventDefault(); keys[e.key] = false; } });
    startButton.addEventListener('click', startGame);
});
