document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
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

    // Game Constants
    const gameConstants = {
        GRAVITY: 0.35,
        THRUST: 0.6,
        PLAYER_SPEED: 4.5,
        BOUNCE_VELOCITY: -5,
        MAX_FALL_SPEED: 8,
        LEVEL_TIME: 180,
    };

    // Game State
    let state = {};

    const keys = {
        ArrowUp: false, ArrowLeft: false, ArrowRight: false,
        w: false, a: false, d: false, ' ': false
    };

    function resetGame() {
        state = {
            level: 1,
            score: 0,
            lives: 3,
            gameLoopId: null,
            timerId: null,
            gameOver: false,
        };
    }

    function resetLevelState() {
        state.player = {
            el: null, x: 0, y: 0,
            vx: 0, vy: 0,
            width: 40, height: 40,
            lastDirection: 1,
        };
        state.platforms = [];
        state.thorns = [];
        state.flowersToCollect = 0;
        state.timeLeft = gameConstants.LEVEL_TIME;
        state.levelInProgress = false;
        state.cameraY = 0;
    }

    function startGame() {
        resetGame();
        messageScreen.classList.add('hidden');
        startLevel();
    }
    
    function startLevel() {
        resetLevelState();
        clearDynamicElements();

        const levelConfig = getLevelConfig(state.level);
        state.flowersToCollect = levelConfig.flowers;
        
        generateLevel(levelConfig.platforms, levelConfig.thorns, levelConfig.flowers);
        
        const worldRect = world.getBoundingClientRect();
        // Spawn player higher up, safely away from the bottom edge
        state.player.x = worldRect.width / 2;
        state.player.y = worldRect.height - 200;
        state.player.el = createGameObject('player', '🐝', state.player.x, state.player.y);

        // --- FIX: Create a guaranteed safe starting platform ---
        const startPlatform = {
            x: state.player.x - 20,
            y: state.player.y + 100,
            width: 80, height: 20,
            hasFlower: false,
        };
        startPlatform.el = createGameObject('platform', '🌿', startPlatform.x, startPlatform.y);
        state.platforms.push(startPlatform);

        // --- FIX: Immediately center the camera on the player at the start ---
        const gameRect = gameArea.getBoundingClientRect();
        state.cameraY = state.player.y - (gameRect.height / 2);
        updateCamera(); // Force one immediate camera update

        updateHUD();
        
        showLevelMessage(`Level ${state.level}`, 1500, () => {
            state.levelInProgress = true;
            if (state.timerId) clearInterval(state.timerId);
            state.timerId = setInterval(updateTimer, 1000);
            if(state.gameLoopId) cancelAnimationFrame(state.gameLoopId);
            gameLoop();
        });
    }

    function getLevelConfig(level) {
        return {
            flowers: Math.min(5 + level * 2, 50),
            platforms: Math.min(10 + level * 2, 40),
            thorns: Math.min(5 + Math.floor(level * 1.5), 45)
        };
    }

    function generateLevel(platformCount, thornCount, flowerCount) {
        const worldRect = world.getBoundingClientRect();
        let flowerPlaced = 0;

        for (let i = 0; i < platformCount; i++) {
            const platform = {
                x: Math.random() * (worldRect.width - 80),
                y: Math.random() * (worldRect.height - 250), // Avoid spawning near very bottom
                width: 80, height: 20,
                hasFlower: false,
            };
            platform.el = createGameObject('platform', '🌿', platform.x, platform.y);
            state.platforms.push(platform);
        }
        
        while(flowerPlaced < flowerCount && state.platforms.length > 0) {
            const platform = state.platforms[Math.floor(Math.random() * state.platforms.length)];
            if (!platform.hasFlower && !platform.isStartPlatform) { // Don't put flower on start platform
                platform.hasFlower = true;
                platform.flowerEl = createGameObject('flower', '🌼', platform.x + 20, platform.y - 30);
                flowerPlaced++;
            }
        }
        
        for (let i = 0; i < thornCount; i++) {
            const thorn = {
                x: Math.random() * (worldRect.width - 40),
                y: Math.random() * (worldRect.height - 250),
                width: 40, height: 40,
            };
            // Avoid spawning thorns too close to the player's start position
            if (Math.abs(thorn.x - state.player.x) < 150 && Math.abs(thorn.y - state.player.y) < 150) {
                continue; // Skip this thorn and try again
            }
            thorn.el = createGameObject('thorn', '🌵', thorn.x, thorn.y);
            state.thorns.push(thorn);
        }
    }

    function gameLoop() {
        if (state.gameOver) return;
        if(state.levelInProgress){
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
        if (keys.ArrowLeft || keys.a) {
            state.player.vx = -gameConstants.PLAYER_SPEED;
            state.player.lastDirection = -1;
        }
        if (keys.ArrowRight || keys.d) {
            state.player.vx = gameConstants.PLAYER_SPEED;
            state.player.lastDirection = 1;
        }
        if (keys.ArrowUp || keys.w || keys[' ']) {
            state.player.vy -= gameConstants.THRUST;
        }
    }

    function updatePlayer() {
        state.player.vy += gameConstants.GRAVITY;
        if (state.player.vy > gameConstants.MAX_FALL_SPEED) {
            state.player.vy = gameConstants.MAX_FALL_SPEED;
        }

        state.player.x += state.player.vx;
        state.player.y += state.player.vy;

        const worldRect = world.getBoundingClientRect();
        if (state.player.x < 0) state.player.x = 0;
        if (state.player.x + state.player.width > worldRect.width) state.player.x = worldRect.width - state.player.width;
        
        if (state.player.y < 0) {
            state.player.y = 0;
            state.player.vy = 0;
        }
        if (state.player.y + state.player.height > worldRect.height) {
            handleDeath();
        }
    }
    
    function updateCamera() {
        const gameRect = gameArea.getBoundingClientRect();
        const worldRect = world.getBoundingClientRect();

        // --- FIX: Logic to always center camera on player ---
        let targetCameraY = state.player.y - (gameRect.height / 2);

        // Clamp camera to world boundaries
        const maxCameraY = worldRect.height - gameRect.height;
        if (targetCameraY > maxCameraY) {
            targetCameraY = maxCameraY;
        }
        if (targetCameraY < 0) {
            targetCameraY = 0;
        }
        
        state.cameraY = targetCameraY;
        gameArea.scrollTop = state.cameraY;
    }


    function handleCollisions() {
        const p = state.player;
        
        for (const thorn of state.thorns) {
            if (isColliding(p, thorn)) {
                handleDeath();
                return;
            }
        }
        
        for (const platform of state.platforms) {
            if (isColliding(p, platform)) {
                const prevPlayerBottom = (p.y - p.vy) + p.height;
                if (p.vy > 0 && prevPlayerBottom <= platform.y + 5) {
                    p.y = platform.y - p.height;
                    p.vy = gameConstants.BOUNCE_VELOCITY;

                    if (platform.hasFlower) {
                        collectFlower(platform);
                    }
                }
            }
        }
    }
    
    function collectFlower(platform) {
        platform.hasFlower = false;
        platform.flowerEl.remove();
        state.score += 100;
        state.flowersToCollect--;
        updateHUD();

        if (state.flowersToCollect <= 0) {
            nextLevel();
        }
    }

    function nextLevel() {
        state.levelInProgress = false;
        state.score += Math.max(0, state.timeLeft * 10);
        state.level++;
        if (state.level % 3 === 0) state.lives++;
        showLevelMessage("Level Complete!", 2000, startLevel);
    }

    function handleDeath() {
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
        p[0].textContent = `Final Score: ${state.score}`;
        p[1].textContent = `Reached Level: ${state.level}`;
        p[2].textContent = '';
        p[3].textContent = '';
        startButton.textContent = 'Play Again';
        messageScreen.classList.remove('hidden');
    }

    function updateTimer() {
        if (state.levelInProgress) {
            state.timeLeft--;
            updateHUD();
            if (state.timeLeft <= 0) {
                handleDeath();
            }
        }
    }

    function updateHUD() {
        scoreEl.textContent = `SCORE: ${state.score}`;
        levelEl.textContent = `LEVEL: ${state.level}`;
        flowersLeftEl.textContent = `🌼: ${state.flowersToCollect}`;
        livesEl.textContent = `BEE: ${'🐝'.repeat(Math.max(0, state.lives))}`;

        const minutes = Math.floor(state.timeLeft / 60);
        const seconds = state.timeLeft % 60;
        timerEl.textContent = `⏱️ ${minutes}:${String(seconds).padStart(2, '0')}`;
    }
    
    function createGameObject(className, emoji, x, y) {
        const el = document.createElement('div');
        el.className = `game-object ${className}`;
        el.textContent = emoji;
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
    
    function clearDynamicElements() {
        world.innerHTML = '';
    }

    function showLevelMessage(text, duration, callback) {
        levelMessageScreen.textContent = text;
        levelMessageScreen.classList.remove('hidden');
        setTimeout(() => {
            levelMessageScreen.classList.add('hidden');
            if (callback) callback();
        }, duration);
    }

    window.addEventListener('keydown', e => { if (e.key in keys) { e.preventDefault(); keys[e.key] = true; } });
    window.addEventListener('keyup', e => { if (e.key in keys) { e.preventDefault(); keys[e.key] = false; } });
    startButton.addEventListener('click', startGame);
});
