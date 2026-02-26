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
    const externalHelpButton = document.getElementById('external-help-button');
    const p1GpStatusEl = document.getElementById('p1-gp-status'); 
    const p2GpStatusEl = document.getElementById('p2-gp-status'); 
    // --- Mobile Control Selectors ---
    const mobileControls = document.getElementById('mobile-controls');
    const mobileLeftBtn = document.getElementById('mobile-left');
    const mobileRightBtn = document.getElementById('mobile-right');
    const mobileUpBtn = document.getElementById('mobile-up');

    // --- Game Constants & State ---
    const gameConstants = { GRAVITY: 0.35, THRUST: 0.6, PLAYER_SPEED: 4.5, BOUNCE_VELOCITY: -5, MAX_FALL_SPEED: 8, LEVEL_TIME: 180, };
    let state = {};
    const keys = { ArrowUp: false, ArrowLeft: false, ArrowRight: false, w: false, a: false, d: false, ' ': false };
    let lastFrameTime = 0;
    const targetFrameTime = 1000 / 60; // 1000ms / 60fps

    const playerControls = [
        { up: ['w', ' '], left: 'a', right: 'd' },
        { up: ['ArrowUp'], left: 'ArrowLeft', right: 'ArrowRight' }
    ];

    // --- GAMEPAD STATE ---
    let playerGamepadAssignments = { p1: null, p2: null };
    const gamepadAssignmentCooldown = {}; // Prevents rapid assignment on button hold
    const gamepads = {};

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
        playerGamepadAssignments = { p1: null, p2: null }; 
    }

    function resetLevelState() {
        state.platforms = []; state.thorns = []; state.flowers = []; state.clouds = [];
        state.frame = 0; state.flowersToCollect = 0; state.timeLeft = gameConstants.LEVEL_TIME;
        state.levelInProgress = false; state.cameraY = 0;
        state.players = [];
    }

    function startGame() {
        resetGame();
        messageScreen.classList.add('hidden');
        p2ScoreEl.classList.add('hidden');
        p2GpStatusEl.classList.add('hidden'); 
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
        updateGamepadStatusHUD(); 
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
            hitboxEl: null,
            x: worldRect.width / 2 + (playerIndex === 0 ? -40 : 40),
            y: startY,
            vx: 0, vy: 0, width: 40, height: 40,
            lastDirection: -1,
            score: score,
            controls: playerControls[playerIndex]
        };
        player.el = createGameObject(`player player-${player.id}-glow`, '🐝', player.x, player.y);
        player.hitboxEl = createHitbox(player.x, player.y, player.width, player.height);
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
        const allGeneratedObjects = [];
        const MAX_TRIES = 50;
        let platformsForFlowers = [];
        for (let i = 0; i < platformCount; i++) {
            let tries = 0;
            let placed = false;
            while (!placed && tries < MAX_TRIES) {
                const pWidth = 80;
                const pHeight = 20;
                const potentialX = Math.random() * (worldRect.width - pWidth);
                const potentialY = Math.random() * (worldRect.height - 400) + 50;
                const newRect = { x: potentialX, y: potentialY, width: pWidth, height: pHeight };
                let isValidPosition = true;
                for (const obj of allGeneratedObjects) {
                    const paddedObj = {x: obj.x - 30, y: obj.y - 30, width: obj.width + 60, height: obj.height + 60};
                    if (isColliding(newRect, paddedObj)) {
                        isValidPosition = false;
                        break;
                    }
                }
                if (isValidPosition) {
                    const platform = { ...newRect };
                    platform.el = createGameObject('platform', '🌿', platform.x, platform.y);
                    platform.hitboxEl = createHitbox(platform.x, platform.y, platform.width, platform.height);
                    state.platforms.push(platform);
                    platformsForFlowers.push(platform);
                    allGeneratedObjects.push(platform);
                    placed = true;
                }
                tries++;
            }
        }
        let flowerPlaced = 0;
        while (flowerPlaced < flowerCount && platformsForFlowers.length > 0) {
            const platformIndex = Math.floor(Math.random() * platformsForFlowers.length);
            const platform = platformsForFlowers[platformIndex];
            const fWidth = 35;
            const fHeight = 35;
            const flowerX = platform.x + (platform.width / 2) - (fWidth / 2);
            const flowerY = platform.y - fHeight;
            if (flowerY < 10) {
                platformsForFlowers.splice(platformIndex, 1);
                continue;
            }
            const flower = { x: flowerX, y: flowerY, width: fWidth, height: fHeight };
            flower.el = createGameObject('flower', '🌼', flowerX, flowerY);
            flower.hitboxEl = createHitbox(flower.x, flower.y, flower.width, flower.height);
            state.flowers.push(flower);
            allGeneratedObjects.push(flower);
            platformsForFlowers.splice(platformIndex, 1);
            flowerPlaced++;
        }
        const thornGroupCount = Math.floor(thornCount / 3);
        for (let i = 0; i < thornGroupCount; i++) {
            let tries = 0;
            let placed = false;
            while (!placed && tries < MAX_TRIES) {
                const tWidth = 40;
                const tHeight = 40;
                const clusterCenterX = Math.random() * (worldRect.width - 120) + 60;
                const clusterCenterY = Math.random() * (worldRect.height - 400) + 50;
                const playerStartX = worldRect.width / 2;
                const playerStartY = worldRect.height - 200;
                if (Math.abs(clusterCenterX - playerStartX) < 200 && Math.abs(clusterCenterY - playerStartY) < 200) {
                    tries++;
                    continue;
                }
                const thornPositions = [
                    { x: clusterCenterX, y: clusterCenterY },
                    { x: clusterCenterX - 25 + (Math.random() * 10 - 5), y: clusterCenterY + 15 + (Math.random() * 10 - 5) },
                    { x: clusterCenterX + 25 + (Math.random() * 10 - 5), y: clusterCenterY + 15 + (Math.random() * 10 - 5) }
                ];
                let isClusterValid = true;
                for (const pos of thornPositions) {
                    const newRect = { x: pos.x, y: pos.y, width: tWidth, height: tHeight };
                    for (const obj of allGeneratedObjects) {
                        const paddedObj = {x: obj.x - 15, y: obj.y - 15, width: obj.width + 30, height: obj.height + 30};
                        if (isColliding(newRect, paddedObj)) {
                            isClusterValid = false;
                            break;
                        }
                    }
                    if (!isClusterValid) break;
                }
                if (isClusterValid) {
                    for (const pos of thornPositions) {
                        const thorn = { x: pos.x, y: pos.y, width: tWidth, height: tHeight };
                        thorn.el = createGameObject('thorn', '🌵', thorn.x, thorn.y);
                        thorn.hitboxEl = createHitbox(thorn.x, thorn.y, thorn.width, thorn.height);
                        state.thorns.push(thorn);
                        allGeneratedObjects.push(thorn);
                    }
                    placed = true;
                }
                tries++;
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
    function gameLoop(timestamp) {
        // --- FRAME RATE CAP ---
        if (timestamp) {
            const elapsedTime = timestamp - lastFrameTime;
            if (elapsedTime < targetFrameTime) {
                state.gameLoopId = requestAnimationFrame(gameLoop);
                return; // Skip this frame if it's too soon
            }
            lastFrameTime = timestamp;
        }

        if (state.gameOver) return;
        if(state.levelInProgress){
            handleCloudGeneration();
            updateAndDrawClouds();
            handleKeyboardInput();
            handleGamepadInput(); 
            updatePlayers();
            handleCollisions();
        }
        drawPlayers();
        updateCamera();
        state.gameLoopId = requestAnimationFrame(gameLoop);
    }

    function handleKeyboardInput() {
        state.players.forEach(player => {
            if (!player) return;
            player.vx = 0;
            if (keys[player.controls.left]) { player.vx = -gameConstants.PLAYER_SPEED; player.lastDirection = 1; }
            if (keys[player.controls.right]) { player.vx = gameConstants.PLAYER_SPEED; player.lastDirection = -1; }
            if (player.controls.up.some(key => keys[key])) { player.vy -= gameConstants.THRUST; }
        });
    }

    // --- GAMEPAD INPUT HANDLER ---
    function setAssignmentCooldown(gamepadIndex) {
        gamepadAssignmentCooldown[gamepadIndex] = true;
        setTimeout(() => {
            delete gamepadAssignmentCooldown[gamepadIndex];
        }, 1000); 
    }

    function applyGamepadControlsToPlayer(player, pad) {
        const DEADZONE = 0.2;
        const THRUST_BUTTON_INDEX = 0;   
        const ALT_THRUST_BUTTON_INDEX = 7; 
        const DPAD_LEFT_INDEX = 14;
        const DPAD_RIGHT_INDEX = 15;

        const stickX = pad.axes[0];
        const stickY = pad.axes[1]; 
        const dpadLeft = pad.buttons[DPAD_LEFT_INDEX].pressed;
        const dpadRight = pad.buttons[DPAD_RIGHT_INDEX].pressed;
        
        const thrust = pad.buttons[THRUST_BUTTON_INDEX].pressed || 
                       pad.buttons[ALT_THRUST_BUTTON_INDEX].value > 0.1 ||
                       stickY < -DEADZONE;

        if (stickX < -DEADZONE || dpadLeft) {
            player.vx = -gameConstants.PLAYER_SPEED;
            player.lastDirection = 1;
        } else if (stickX > DEADZONE || dpadRight) {
            player.vx = gameConstants.PLAYER_SPEED;
            player.lastDirection = -1;
        }
        
        if (thrust) {
            player.vy -= gameConstants.THRUST;
        }
    }

    function handleGamepadInput() {
        const polledPads = navigator.getGamepads ? navigator.getGamepads() : [];
        if (!polledPads) return;

        const FACE_BUTTON_INDICES = [0, 1, 2, 3]; 

        for (let i = 0; i < polledPads.length; i++) {
            const pad = polledPads[i];
            if (!pad || gamepadAssignmentCooldown[i]) continue;

            const isAlreadyAssigned = (playerGamepadAssignments.p1 === i || playerGamepadAssignments.p2 === i);
            const faceButtonPressed = FACE_BUTTON_INDICES.some(index => pad.buttons[index].pressed);

            if (faceButtonPressed && !isAlreadyAssigned) {
                if (playerGamepadAssignments.p1 === null) {
                    playerGamepadAssignments.p1 = i;
                    console.log(`Gamepad ${i} assigned to Player 1.`);
                    updateGamepadStatusHUD();
                    setAssignmentCooldown(i);
                } else if (playerGamepadAssignments.p2 === null) {
                    if (!state.isTwoPlayer && state.gameLoopId) {
                        state.isTwoPlayer = true;
                        addPlayer(1, state.players[0].y, 0);
                        p2ScoreEl.classList.remove('hidden');
                        p2GpStatusEl.classList.remove('hidden');
                        console.log("Player 2 (Gamepad) has joined the game!");
                    }
                    playerGamepadAssignments.p2 = i;
                    console.log(`Gamepad ${i} assigned to Player 2.`);
                    updateGamepadStatusHUD();
                    setAssignmentCooldown(i);
                }
            }
        }
        
        if (playerGamepadAssignments.p1 !== null && state.players[0]) {
            const pad1 = polledPads[playerGamepadAssignments.p1];
            if (pad1) {
                applyGamepadControlsToPlayer(state.players[0], pad1);
            } else { 
                console.log(`P1 Gamepad (Index ${playerGamepadAssignments.p1}) disconnected.`);
                playerGamepadAssignments.p1 = null;
                updateGamepadStatusHUD();
            }
        }
        
        if (playerGamepadAssignments.p2 !== null && state.players[1]) {
            const pad2 = polledPads[playerGamepadAssignments.p2];
            if (pad2) {
                applyGamepadControlsToPlayer(state.players[1], pad2);
            } else { 
                console.log(`P2 Gamepad (Index ${playerGamepadAssignments.p2}) disconnected.`);
                playerGamepadAssignments.p2 = null;
                updateGamepadStatusHUD();
            }
        }
    }

    // --- Player & Camera Updates ---
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
        if (flower.hitboxEl) flower.hitboxEl.remove();
        state.flowers.splice(index, 1);
        player.score += 100;
        state.totalScore = state.players.reduce((sum, p) => sum + (p ? p.score : 0), 0);
        state.flowersToCollect--;
        updateHUD();
        if (state.flowersToCollect <= 0) { nextLevel(); }
    }
    function nextLevel() {
        clearInterval(state.timerId); 
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
        clearInterval(state.timerId);
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

    function updateGamepadStatusHUD() {
        p1GpStatusEl.textContent = playerGamepadAssignments.p1 !== null ? `P1: GP${playerGamepadAssignments.p1}` : 'P1: GP?';
    
        if (state.isTwoPlayer) {
            p2GpStatusEl.classList.remove('hidden');
            p2GpStatusEl.textContent = playerGamepadAssignments.p2 !== null ? `P2: GP${playerGamepadAssignments.p2}` : 'P2: GP?';
        } else {
            p2GpStatusEl.classList.add('hidden');
        }
    }
    
    function drawPlayers() {
        state.players.forEach(player => {
            if (!player || !player.el) return;
            player.el.style.transform = `translate(${player.x}px, ${player.y}px) scaleX(${player.lastDirection})`;
            if (player.hitboxEl) {
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
        document.querySelectorAll('.hitbox').forEach(box => {
            box.classList.toggle('hidden', !state.devMode);
        });
        console.log(`Dev mode ${state.devMode ? 'enabled' : 'disabled'}.`);
        if (state.devMode) {
            console.log('Commands: [N] Next Level');
        }
    }

    // --- Event Listeners ---
    window.addEventListener('keydown', e => { 
        const key = e.key.toLowerCase();
        if (key === 'j' && !e.repeat) {
            toggleDevMode();
        }

        if (e.key in keys) { e.preventDefault(); keys[e.key] = true; }

        if (e.key === 'ArrowUp' && !state.isTwoPlayer && state.gameLoopId) {
            e.preventDefault();
            state.isTwoPlayer = true;
            addPlayer(1, state.players[0].y, 0);
            p2ScoreEl.classList.remove('hidden');
            p2GpStatusEl.classList.remove('hidden'); 
            console.log("Player 2 (Keyboard) has joined the game!");
        }

        if (key === 'h') {
            if (messageScreen.classList.contains('hidden')) {
               helpScreen.classList.toggle('hidden');
            }
        }

        if (state.devMode && state.levelInProgress) {
            if (key === 'n') {
                console.log("DEV: Skipping to next level.");
                nextLevel();
            }
        }
    });
    window.addEventListener('keyup', e => { if (e.key in keys) { e.preventDefault(); keys[e.key] = false; } });
    
    // --- GAMEPAD CONNECTION LISTENERS ---
    window.addEventListener("gamepadconnected", e => {
        console.log(`Gamepad connected at index ${e.gamepad.index}: ${e.gamepad.id}.`);
        gamepads[e.gamepad.index] = e.gamepad;
    });
    window.addEventListener("gamepaddisconnected", e => {
        console.log(`Gamepad disconnected from index ${e.gamepad.index}: ${e.gamepad.id}.`);
        delete gamepads[e.gamepad.index];
        if (playerGamepadAssignments.p1 === e.gamepad.index) {
            playerGamepadAssignments.p1 = null;
            updateGamepadStatusHUD();
        }
        if (playerGamepadAssignments.p2 === e.gamepad.index) {
            playerGamepadAssignments.p2 = null;
            updateGamepadStatusHUD();
        }
    });

    startButton.addEventListener('click', startGame);
    helpButton.addEventListener('click', () => helpScreen.classList.remove('hidden'));
    closeHelpButton.addEventListener('click', () => helpScreen.classList.add('hidden'));
    externalHelpButton.addEventListener('click', () => helpScreen.classList.remove('hidden'));
    
    // --- MOBILE CONTROL LISTENERS ---
    function setupMobileControls() {
        if (!mobileControls) return;

        const addControlListener = (element, key) => {
            const pressKey = (e) => {
                e.preventDefault();
                keys[key] = true;
            };
            const releaseKey = (e) => {
                e.preventDefault();
                keys[key] = false;
            };

            element.addEventListener('touchstart', pressKey, { passive: false });
            element.addEventListener('touchend', releaseKey, { passive: false });
            element.addEventListener('touchcancel', releaseKey, { passive: false });
            element.addEventListener('mousedown', pressKey);
            element.addEventListener('mouseup', releaseKey);
            element.addEventListener('mouseleave', (e) => {
                if (e.buttons === 1) { releaseKey(e); }
            });
        };

        addControlListener(mobileLeftBtn, 'a');
        addControlListener(mobileRightBtn, 'd');
        addControlListener(mobileUpBtn, 'w');
    }

    // --- MOBILE SCALING LOGIC ---
    function toggleMobileModeStyles(isFullscreen) {
        if (isFullscreen) {
            document.body.classList.add('mobile-mode');
        } else {
            document.body.classList.remove('mobile-mode');
        }
    }

    document.addEventListener("fullscreenchange", () => {
        toggleMobileModeStyles(document.fullscreenElement != null);
    });
    document.addEventListener("webkitfullscreenchange", () => {
        toggleMobileModeStyles(document.webkitFullscreenElement != null);
    });

    // --- INITIALIZE ---
    setupMobileControls();
});
