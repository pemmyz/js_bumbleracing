document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const gameArea = document.getElementById('game-area');
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
        LEVEL_TIME: 60,
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
        };
        state.platforms = [];
        state.thorns = [];
        state.flowersToCollect = 0;
        state.timeLeft = gameConstants.LEVEL_TIME;
        state.levelInProgress = false;
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
        
        state.player.el = createGameObject('player', '🐝', 50, 50);
        const gameRect = gameArea.getBoundingClientRect();
        state.player.x = gameRect.width / 2;
        state.player.y = gameRect.height / 2;

        updateHUD();
        
        showLevelMessage(`Level ${state.level}`, 1500, () => {
            state.levelInProgress = true;
            if (state.timerId) clearInterval(state.timerId);
            state.timerId = setInterval(updateTimer, 1000);
            if(state.gameLoopId) cancelAnimationFrame(state.gameLoopId);
            state.gameLoopId = requestAnimationFrame(gameLoop);
        });
    }

    function getLevelConfig(level) {
        return {
            flowers: Math.min(5 + level * 2, 50),
            platforms: Math.min(10 + level, 30),
            thorns: Math.min(5 + Math.floor(level * 1.5), 45)
        };
    }

    function generateLevel(platformCount, thornCount, flowerCount) {
        const gameRect = gameArea.getBoundingClientRect();
        let flowerPlaced = 0;

        // Generate Platforms (leaves)
        for (let i = 0; i < platformCount; i++) {
            const platform = {
                x: Math.random() * (gameRect.width - 80),
                y: Math.random() * (gameRect.height * 0.8) + (gameRect.height * 0.1),
                width: 80, height: 20,
                hasFlower: false,
            };
            platform.el = createGameObject('platform', '🌿', 0, 0);
            platform.el.style.transform = `translate(${platform.x}px, ${platform.y}px)`;
            state.platforms.push(platform);
        }
        
        // Place flowers on platforms
        while(flowerPlaced < flowerCount) {
            const platform = state.platforms[Math.floor(Math.random() * state.platforms.length)];
            if (!platform.hasFlower) {
                platform.hasFlower = true;
                platform.flowerEl = createGameObject('flower', '🌼', 0, 0);
                platform.flowerEl.style.transform = `translate(${platform.x + 20}px, ${platform.y - 30}px)`;
                flowerPlaced++;
            }
        }
        
        // Generate Thorns
        for (let i = 0; i < thornCount; i++) {
            const thorn = {
                x: Math.random() * (gameRect.width - 40),
                y: Math.random() * (gameRect.height - 40),
                width: 40, height: 40,
            };
            thorn.el = createGameObject('thorn', '🌵', 0, 0);
            thorn.el.style.transform = `translate(${thorn.x}px, ${thorn.y}px)`;
            state.thorns.push(thorn);
        }
    }

    function gameLoop() {
        if (state.gameOver || !state.levelInProgress) return;
        
        handleInput();
        updatePlayer();
        handleCollisions();
        drawPlayer();
        
        state.gameLoopId = requestAnimationFrame(gameLoop);
    }

    function handleInput() {
        state.player.vx = 0;
        if (keys.ArrowLeft || keys.a) {
            state.player.vx = -gameConstants.PLAYER_SPEED;
            state.player.el.style.transform = 'scaleX(-1)';
        }
        if (keys.ArrowRight || keys.d) {
            state.player.vx = gameConstants.PLAYER_SPEED;
            state.player.el.style.transform = 'scaleX(1)';
        }
        if (keys.ArrowUp || keys.w || keys[' ']) {
            state.player.vy -= gameConstants.THRUST;
        }
    }

    function updatePlayer() {
        // Apply gravity
        state.player.vy += gameConstants.GRAVITY;
        if (state.player.vy > gameConstants.MAX_FALL_SPEED) {
            state.player.vy = gameConstants.MAX_FALL_SPEED;
        }

        // Update position
        state.player.x += state.player.vx;
        state.player.y += state.player.vy;

        // Wall collision
        const gameRect = gameArea.getBoundingClientRect();
        if (state.player.x < 0) state.player.x = 0;
        if (state.player.x + state.player.width > gameRect.width) state.player.x = gameRect.width - state.player.width;
        
        // Ceiling/Floor collision
        if (state.player.y < 0) {
            state.player.y = 0;
            state.player.vy = 0;
        }
        if (state.player.y + state.player.height > gameRect.height) {
            handleDeath();
        }
    }

    function handleCollisions() {
        const p = state.player;
        let onPlatform = false;

        // Thorn collisions
        for (const thorn of state.thorns) {
            if (isColliding(p, thorn)) {
                handleDeath();
                return;
            }
        }
        
        // Platform collisions
        for (const platform of state.platforms) {
            if (isColliding(p, platform)) {
                const prevPlayerBottom = (p.y - p.vy) + p.height;
                // Check if player was above the platform in the previous frame and is falling
                if (p.vy > 0 && prevPlayerBottom <= platform.y) {
                    p.y = platform.y - p.height;
                    p.vy = gameConstants.BOUNCE_VELOCITY;
                    onPlatform = true;

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
        state.score += state.timeLeft * 10; // Time bonus
        state.level++;
        if (state.level % 3 === 0) state.lives++; // Extra life every 3 levels
        showLevelMessage("Level Complete!", 2000, startLevel);
    }

    function handleDeath() {
        if (!state.levelInProgress) return; // Prevent multiple death calls
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
        
        const messageEl = messageScreen.querySelector('h1');
        messageEl.textContent = 'Game Over';
        const p = messageScreen.querySelectorAll('.instructions');
        p[0].textContent = `Final Score: ${state.score}`;
        p[1].textContent = `Reached Level: ${state.level}`;
        p[2].textContent = '';
        p[3].textContent = '';
        startButton.textContent = 'Play Again';
        messageScreen.classList.remove('hidden');
    }

    function updateTimer() {
        state.timeLeft--;
        updateHUD();
        if (state.timeLeft <= 0) {
            handleDeath();
        }
    }

    function updateHUD() {
        scoreEl.textContent = `SCORE: ${state.score}`;
        levelEl.textContent = `LEVEL: ${state.level}`;
        flowersLeftEl.textContent = `🌼: ${state.flowersToCollect}`;
        livesEl.textContent = `BEE: ${'🐝'.repeat(state.lives)}`;

        const minutes = Math.floor(state.timeLeft / 60);
        const seconds = state.timeLeft % 60;
        timerEl.textContent = `⏱️ ${minutes}:${String(seconds).padStart(2, '0')}`;
    }
    
    // --- UTILITY FUNCTIONS ---
    
    function createGameObject(className, emoji, x, y) {
        const el = document.createElement('div');
        el.className = `game-object ${className}`;
        el.textContent = emoji;
        el.style.left = `${x}px`;
        el.style.top = `${y}px`;
        gameArea.appendChild(el);
        return el;
    }
    
    function drawPlayer() {
        state.player.el.style.transform = `translate(${state.player.x}px, ${state.player.y}px) ${keys.ArrowLeft || keys.a ? 'scaleX(-1)' : 'scaleX(1)'}`;
    }
    
    function isColliding(rect1, rect2) {
        return (
            rect1.x < rect2.x + rect2.width &&
            rect1.x + rect1.width > rect2.x &&
            rect1.y < rect2.y + rect2.height &&
            rect1.y + rect1.height > rect2.y
        );
    }
    
    function clearDynamicElements() {
        gameArea.querySelectorAll('.game-object').forEach(el => el.remove());
    }

    function showLevelMessage(text, duration, callback) {
        levelMessageScreen.textContent = text;
        levelMessageScreen.classList.remove('hidden');
        setTimeout(() => {
            levelMessageScreen.classList.add('hidden');
            if (callback) callback();
        }, duration);
    }

    // --- EVENT LISTENERS ---
    
    window.addEventListener('keydown', e => {
        if (e.key in keys) {
            e.preventDefault();
            keys[e.key] = true;
        }
    });

    window.addEventListener('keyup', e => {
        if (e.key in keys) {
            e.preventDefault();
            keys[e.key] = false;
        }
    });
    
    startButton.addEventListener('click', startGame);
});
