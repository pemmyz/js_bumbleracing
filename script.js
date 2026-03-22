document.addEventListener('DOMContentLoaded', () => {

    // --- AUDIO SYSTEM SETUP ---
    
    // 1. New Advanced Engine (Loaded from audio.js)
    const advancedAudio = new window.SoundEngine();

    // 2. Original Fallback Audio Engine (Preserved from old logic)
    const OriginalAudio = {
        ctx: null, limiter: null, noiseBuffer: null, isTinkNext: true,
        init() {
            if (this.ctx) return;
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            this.limiter = this.ctx.createDynamicsCompressor();
            this.limiter.threshold.setValueAtTime(-10, this.ctx.currentTime);
            this.limiter.connect(this.ctx.destination);

            const bufferSize = this.ctx.sampleRate * 2;
            this.noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
            const data = this.noiseBuffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
        },
        playFlowerSound() {
            if (!this.ctx) this.init();
            if (this.ctx.state === 'suspended') this.ctx.resume();
            this.isTinkNext ? this.playTink() : this.playTonk();
            this.isTinkNext = !this.isTinkNext;
        },
        finalVolume() { return 0.2; },
        playTink() {
            const now = this.ctx.currentTime;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(1500, now);
            osc.frequency.exponentialRampToValueAtTime(800, now + 0.1);
            gain.gain.setValueAtTime(1.5 * this.finalVolume(), now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
            
            const noise = this.ctx.createBufferSource();
            noise.buffer = this.noiseBuffer;
            const noiseFilter = this.ctx.createBiquadFilter();
            noiseFilter.type = 'highpass';
            noiseFilter.frequency.value = 2000;
            const noiseGain = this.ctx.createGain();
            noiseGain.gain.setValueAtTime(0.5 * this.finalVolume(), now);
            noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
            noise.connect(noiseFilter);
            noiseFilter.connect(noiseGain);
            noiseGain.connect(this.limiter);

            osc.connect(gain);
            gain.connect(this.limiter);
            osc.start(now); osc.stop(now + 0.1);
            noise.start(now); noise.stop(now + 0.05);
        },
        playTonk() {
            const now = this.ctx.currentTime;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(450, now);
            osc.frequency.exponentialRampToValueAtTime(200, now + 0.2);
            gain.gain.setValueAtTime(2.0 * this.finalVolume(), now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
            
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'bandpass'; filter.frequency.value = 600;
            
            const noise = this.ctx.createBufferSource();
            noise.buffer = this.noiseBuffer;
            const noiseFilter = this.ctx.createBiquadFilter();
            noiseFilter.type = 'bandpass'; noiseFilter.frequency.value = 800;
            const noiseGain = this.ctx.createGain();
            noiseGain.gain.setValueAtTime(1 * this.finalVolume(), now);
            noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
            noise.connect(noiseFilter); noiseFilter.connect(noiseGain);
            noiseGain.connect(this.limiter);
            
            osc.connect(filter); filter.connect(gain); gain.connect(this.limiter);
            osc.start(now); osc.stop(now + 0.2);
            noise.start(now); noise.stop(now + 0.05);
        }
    };

    // User interaction unlocks audio systems
    document.addEventListener('click', () => {
        advancedAudio.unlock();
        OriginalAudio.init();
    }, { once: true });


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
    const helpScreen = document.getElementById('help-screen');
    const audioSettingsScreen = document.getElementById('audio-settings-screen');
    
    const startButton = document.getElementById('start-button');
    const helpButton = document.getElementById('help-button');
    const closeHelpButton = document.getElementById('close-help-button');
    const externalHelpButton = document.getElementById('external-help-button');
    const openAudioMenuBtn = document.getElementById('open-audio-menu-button');
    const closeAudioMenuBtn = document.getElementById('close-audio-menu-button');
    const applyRestartAudioBtn = document.getElementById('apply-restart-audio-button');
    const resetAudioDefaultsBtn = document.getElementById('reset-audio-defaults-button');
    
    const devIndicator = document.getElementById('dev-mode-indicator');
    const p1GpStatusEl = document.getElementById('p1-gp-status'); 
    const p2GpStatusEl = document.getElementById('p2-gp-status'); 
    
    // --- Settings Selectors ---
    const speedSelect = document.getElementById('speed-select');
    const fpsCounterEl = document.getElementById('fps-counter');
    const toggleFpsCheckbox = document.getElementById('toggle-fps');
    const lockFpsCheckbox = document.getElementById('lock-fps');
    
    // Hitbox Setting Selectors
    const hitboxStyleSelect = document.getElementById('hitbox-style-select');
    const toggleHitboxesCheckbox = document.getElementById('toggle-hitboxes');

    // Audio Setting Selectors
    const useNewAudioToggle = document.getElementById('use-new-audio');
    const audioModeSelect = document.getElementById('audio-mode');
    const audioProcSelect = document.getElementById('audio-processing');
    const audioPoolToggle = document.getElementById('audio-pool');
    const audioLatSelect = document.getElementById('audio-latency');
    const audioNoiseSelect = document.getElementById('audio-noise');
    
    // Tweak Selectors
    const tweakZeroCopy = document.getElementById('tweak-zero-copy');
    const tweakFastLoop = document.getElementById('tweak-fast-loop');
    const tweakAndroidHack = document.getElementById('tweak-android-hack');
    const tweakIdlerMute = document.getElementById('tweak-idler-mute');
    const tweakDomPool = document.getElementById('tweak-dom-pool');

    // --- Mobile Control Selectors ---
    const mobileControls = document.getElementById('mobile-controls');
    const mobileLeftBtn = document.getElementById('mobile-left');
    const mobileRightBtn = document.getElementById('mobile-right');
    const mobileUpBtn = document.getElementById('mobile-up');
    const mobileToggleBtn = document.getElementById('mobile-btn');

    // --- Scaling Logic & Mobile Mode ---
    function scaleGame() {
        const screen = document.getElementById("screen");
        const isFullscreen = document.fullscreenElement || document.webkitFullscreenElement;

        if (isFullscreen) {
            const baseWidth = 960;
            const baseHeight = 720;
            const scale = Math.min(
                window.innerWidth / baseWidth,
                window.innerHeight / baseHeight
            );
            screen.style.transform = `scale(${scale})`;
            document.body.classList.add('mobile-mode');
        } else {
            screen.style.transform = 'none'; 
            document.body.classList.remove('mobile-mode');
        }
    }

    function goFull() {
        const el = document.documentElement;
        if (el.requestFullscreen) el.requestFullscreen();
        else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
    }

    window.addEventListener("resize", scaleGame);
    window.addEventListener("fullscreenchange", scaleGame);
    window.addEventListener("webkitfullscreenchange", scaleGame);
    scaleGame();


    // --- Game Constants & State ---
    const gameConstants = { GRAVITY: 0.35, THRUST: 0.6, PLAYER_SPEED: 4.5, BOUNCE_VELOCITY: -5, MAX_FALL_SPEED: 8, LEVEL_TIME: 180, };
    let state = { 
        useNewAudio: true, 
        fastDomClear: true,
        hitboxStyle: hitboxStyleSelect ? hitboxStyleSelect.value : 'current',
        showHitboxes: toggleHitboxesCheckbox ? toggleHitboxesCheckbox.checked : false,
        devMode: false
    }; 
    const keys = { ArrowUp: false, ArrowLeft: false, ArrowRight: false, w: false, a: false, d: false, ' ': false };
    
    let lastFrameTime = 0;
    let lastRenderTime = 0;
    let accumulator = 0;
    let gameSpeed = 1.0;
    const targetFrameTime = 1000 / 60; 
    
    let showFps = false;
    let lockFps = true; 
    let framesThisSecond = 0;
    let lastFpsUpdateTime = 0;

    const playerControls = [
        { up: ['w', ' '], left: 'a', right: 'd' },
        { up: ['ArrowUp'], left: 'ArrowLeft', right: 'ArrowRight' }
    ];

    let playerGamepadAssignments = { p1: null, p2: null };
    const gamepadAssignmentCooldown = {}; 
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
        state = { ...state, level: 1, totalScore: 0, lives: 3, gameLoopId: null, gameOver: false, isTwoPlayer: false };
        playerGamepadAssignments = { p1: null, p2: null }; 
    }

    function resetLevelState() {
        state.platforms = []; state.thorns = []; state.flowers = []; state.clouds = [];
        state.frame = 0; state.flowersToCollect = 0; state.timeLeft = gameConstants.LEVEL_TIME;
        state.levelInProgress = false; state.cameraY = 0;
        state.players = [];
        state.timerAccumulator = 0;
    }

    function startGame() {
        advancedAudio.unlock();
        OriginalAudio.init();

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
        
        const worldHeight = world.offsetHeight;
        const worldWidth = world.offsetWidth;
        const startY = worldHeight - 200;
        
        addPlayer(0, startY, oldScores[0] || 0);

        if (state.isTwoPlayer) {
            addPlayer(1, startY, oldScores[1] || 0);
        }

        const startPlatform = { x: worldWidth / 2 - 80, y: startY + 100, width: 200, height: 20, };
        startPlatform.el = createGameObject('platform', '🌿', startPlatform.x, startPlatform.y);
        attachHitbox(startPlatform, 'platform');
        state.platforms.push(startPlatform);
        
        updateCamera();
        updateHUD();
        updateGamepadStatusHUD(); 
        showLevelMessage(`Level ${state.level}`, 1500, () => {
            state.levelInProgress = true;
            
            lastFrameTime = performance.now();
            lastRenderTime = lastFrameTime;
            accumulator = 0;
            
            if(state.gameLoopId) cancelAnimationFrame(state.gameLoopId);
            gameLoop();
        });
    }

    function addPlayer(playerIndex, startY, score = 0) {
        const worldWidth = world.offsetWidth;
        const player = {
            id: playerIndex + 1,
            el: null,
            hitboxEl: null,
            x: worldWidth / 2 + (playerIndex === 0 ? -40 : 40),
            y: startY,
            vx: 0, vy: 0, width: 40, height: 40,
            lastDirection: -1,
            score: score,
            controls: playerControls[playerIndex]
        };
        player.el = createGameObject(`player player-${player.id}-glow`, '🐝', player.x, player.y);
        attachHitbox(player, 'player');
        state.players[playerIndex] = player;
    }

    function prepopulateClouds(count) {
        const w = world.offsetWidth;
        const h = world.offsetHeight;
        for (let i = 0; i < count; i++) {
            state.clouds.push(new Cloud(Math.random() * w, Math.random() * h, Math.random() < 0.3));
        }
    }
    function getLevelConfig(level) {
        return { flowers: Math.min(5 + level * 2, 50), platforms: Math.min(10 + level * 2, 40), thorns: Math.min(5 + Math.floor(level * 1.5), 45) };
    }
    function generateLevel(platformCount, thornCount, flowerCount) {
        const w = world.offsetWidth;
        const h = world.offsetHeight;
        const allGeneratedObjects = [];
        const MAX_TRIES = 50;
        let platformsForFlowers = [];
        for (let i = 0; i < platformCount; i++) {
            let tries = 0;
            let placed = false;
            while (!placed && tries < MAX_TRIES) {
                const pWidth = 80;
                const pHeight = 20;
                const potentialX = Math.random() * (w - pWidth);
                const potentialY = Math.random() * (h - 400) + 50;
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
                    attachHitbox(platform, 'platform');
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
            attachHitbox(flower, 'flower');
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
                const clusterCenterX = Math.random() * (w - 120) + 60;
                const clusterCenterY = Math.random() * (h - 400) + 50;
                const playerStartX = w / 2;
                const playerStartY = h - 200;
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
                        attachHitbox(thorn, 'thorn');
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
        const w = world.offsetWidth;
        const h = world.offsetHeight;
        if (state.frame % 150 === 0) {
            state.clouds.push(new Cloud(w + 100, Math.random() * h));
        }
        if (state.frame % 300 === 0) {
            state.clouds.push(new Cloud(w + 200, Math.random() * h, true));
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

    // --- Game Loop (Fixed Timestep) ---
    function gameLoop(timestamp) {
        if (!timestamp) timestamp = performance.now();
        if (lastFrameTime === 0) {
            lastFrameTime = timestamp;
            lastRenderTime = timestamp;
        }
        
        if (lockFps) {
            let elapsedRender = timestamp - lastRenderTime;
            if (elapsedRender < targetFrameTime - 1) { 
                state.gameLoopId = requestAnimationFrame(gameLoop);
                return; 
            }
            lastRenderTime = timestamp - (elapsedRender % targetFrameTime);
        } else {
            lastRenderTime = timestamp;
        }

        let dt = timestamp - lastFrameTime;
        lastFrameTime = timestamp;

        if (dt > 250) dt = 250; 
        
        if (showFps) {
            framesThisSecond++;
            if (timestamp - lastFpsUpdateTime >= 1000) {
                fpsCounterEl.textContent = `FPS: ${framesThisSecond}`;
                framesThisSecond = 0;
                lastFpsUpdateTime = timestamp;
            }
        }

        accumulator += dt * gameSpeed;

        if (state.gameOver) return;

        let logicUpdated = false;
        
        while (accumulator >= targetFrameTime) {
            if(state.levelInProgress){
                handleCloudGeneration();
                updateAndDrawClouds();
                handleKeyboardInput();
                handleGamepadInput(); 
                updatePlayers();
                handleCollisions();
                
                if (!state.devMode) {
                    state.timerAccumulator += targetFrameTime;
                    if (state.timerAccumulator >= 1000) {
                        updateTimer();
                        state.timerAccumulator -= 1000;
                    }
                }
            }
            accumulator -= targetFrameTime;
            logicUpdated = true;
        }

        if (logicUpdated || !state.levelInProgress) {
            drawPlayers();
            updateCamera();
        }

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

    function updatePlayers() {
        const worldWidth = world.offsetWidth;
        const worldHeight = world.offsetHeight;
        const screenHeight = 720;

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
            if (p.x + p.width > worldWidth) p.x = worldWidth - p.width;
            if (p.y < 0) { p.y = 0; p.vy = 0; }
            if (p.y + p.height > worldHeight) handleDeath();
        });
    }
    
    function updateCamera() {
        const gameRectHeight = 720;
        const worldHeight = world.offsetHeight;
        
        const p1_y = state.players[0].y;
        const p2_y = state.players[1]?.y || p1_y;
        const averagePlayerY = (p1_y + p2_y) / 2;

        let targetCameraY = averagePlayerY - (gameRectHeight / 2);
        const maxCameraY = worldHeight - gameRectHeight;
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

    function collectFlower(flower, index, player) {
        // Toggle routing to selected sound engine
        if (state.useNewAudio) {
            advancedAudio.playFlowerSound();
        } else {
            OriginalAudio.playFlowerSound();
        }

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
        startButton.textContent = 'Play Again'; 
        messageScreen.classList.remove('hidden');
    }
    function updateTimer() {
        if (state.devMode) return;
        if (state.levelInProgress) { 
            state.timeLeft--; 
            updateHUD(); 
            if (state.timeLeft <= 0) handleDeath(); 
        }
    }

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
            if (player.hitboxEl && player.hitbox) {
                player.hitboxEl.style.transform = `translate(${player.x + player.hitbox.offsetX}px, ${player.y + player.hitbox.offsetY}px)`;
            }
        });
    }
    
    function showLevelMessage(text, duration, callback) {
        levelMessageScreen.textContent = text; levelMessageScreen.classList.remove('hidden');
        setTimeout(() => { levelMessageScreen.classList.add('hidden'); if (callback) callback(); }, duration / gameSpeed);
    }
    
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
        if (!state.showHitboxes && !state.devMode) hitboxEl.classList.add('hidden');
        hitboxEl.style.width = `${width}px`;
        hitboxEl.style.height = `${height}px`;
        hitboxEl.style.transform = `translate(${x}px, ${y}px)`;
        world.appendChild(hitboxEl);
        return hitboxEl;
    }

    function attachHitbox(obj, type) {
        let hb = { offsetX: 0, offsetY: 0, width: obj.width, height: obj.height };
        
        if (state.hitboxStyle === 'new') {
            if (type === 'player') hb = { offsetX: 8, offsetY: 10, width: obj.width - 16, height: obj.height - 12 };
            // Cactus is tighter, especially from the top
            else if (type === 'thorn') hb = { offsetX: 12, offsetY: 18, width: obj.width - 24, height: obj.height - 18 };
            else if (type === 'flower') hb = { offsetX: 6, offsetY: 6, width: obj.width - 12, height: obj.height - 12 };
            // Platform stays standard size
        }
        
        obj.hitbox = hb;
        obj.type = type; // Save type to easily refresh later
        
        if (obj.hitboxEl) {
            // Update existing element directly
            obj.hitboxEl.style.width = `${hb.width}px`;
            obj.hitboxEl.style.height = `${hb.height}px`;
            obj.hitboxEl.style.transform = `translate(${obj.x + hb.offsetX}px, ${obj.y + hb.offsetY}px)`;
        } else {
            // Create for the first time
            obj.hitboxEl = createHitbox(obj.x + hb.offsetX, obj.y + hb.offsetY, hb.width, hb.height);
        }
    }

    function refreshAllHitboxes() {
        if (state.players) state.players.forEach(p => { if (p) attachHitbox(p, 'player'); });
        if (state.platforms) state.platforms.forEach(p => attachHitbox(p, 'platform'));
        if (state.thorns) state.thorns.forEach(t => attachHitbox(t, 'thorn'));
        if (state.flowers) state.flowers.forEach(f => attachHitbox(f, 'flower'));
    }

    function getAbsRect(obj) {
        if (obj.hitbox) {
            return { x: obj.x + obj.hitbox.offsetX, y: obj.y + obj.hitbox.offsetY, width: obj.hitbox.width, height: obj.hitbox.height };
        }
        return { x: obj.x, y: obj.y, width: obj.width, height: obj.height };
    }
    
    function isColliding(obj1, obj2) {
        const r1 = getAbsRect(obj1);
        const r2 = getAbsRect(obj2);
        return ( r1.x < r2.x + r2.width && r1.x + r1.width > r2.x && r1.y < r2.y + r2.height && r1.y + r1.height > r2.y );
    }
    
    function clearDynamicElements() { 
        if (state.fastDomClear) {
            // 🔥 TWEAK: Prevents massive reflow & GC spike
            while (world.firstChild) {
                world.removeChild(world.firstChild);
            }
        } else {
            world.innerHTML = ''; // Original method
        }
    }

    function updateHitboxVisibility() {
        document.querySelectorAll('.hitbox').forEach(box => {
            if (state.devMode || state.showHitboxes) {
                box.classList.remove('hidden');
            } else {
                box.classList.add('hidden');
            }
        });
    }

    function toggleDevMode() {
        state.devMode = !state.devMode;
        devIndicator.classList.toggle('hidden', !state.devMode);
        updateHitboxVisibility();
        
        console.log(`Dev mode ${state.devMode ? 'enabled' : 'disabled'}.`);
        if (state.devMode) {
            console.log('Commands: [N] Next Level');
        }
    }

    window.addEventListener('keydown', e => { 
        const key = e.key.toLowerCase();
        
        if (key === 'j' && !e.repeat) {
            toggleDevMode();
        }

        if (key === 'v' && !e.repeat) {
            state.showHitboxes = !state.showHitboxes;
            if (toggleHitboxesCheckbox) toggleHitboxesCheckbox.checked = state.showHitboxes;
            updateHitboxVisibility();
            console.log(`Hitboxes ${state.showHitboxes ? 'shown' : 'hidden'}.`);
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
            if (messageScreen.classList.contains('hidden') && audioSettingsScreen.classList.contains('hidden')) {
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

    // Menus
    startButton.addEventListener('click', startGame);
    helpButton.addEventListener('click', () => helpScreen.classList.remove('hidden'));
    closeHelpButton.addEventListener('click', () => helpScreen.classList.add('hidden'));
    externalHelpButton.addEventListener('click', () => helpScreen.classList.remove('hidden'));
    
    // Audio Settings Menu Wiring
    openAudioMenuBtn.addEventListener('click', () => {
        helpScreen.classList.add('hidden');
        audioSettingsScreen.classList.remove('hidden');
    });
    
    closeAudioMenuBtn.addEventListener('click', () => {
        audioSettingsScreen.classList.add('hidden');
        helpScreen.classList.remove('hidden');
    });

    applyRestartAudioBtn.addEventListener('click', () => {
        audioSettingsScreen.classList.add('hidden');
        startGame(); // Starts a new game (settings are already applied dynamically via 'change' events)
    });

    resetAudioDefaultsBtn.addEventListener('click', () => {
        // Reset UI to Defaults
        useNewAudioToggle.checked = true;
        audioModeSelect.value = 'buffered';
        audioProcSelect.value = 'worklet';
        audioPoolToggle.checked = true;
        audioLatSelect.value = 'interactive';
        audioNoiseSelect.value = 'offline';
        tweakZeroCopy.checked = true;
        tweakFastLoop.checked = true;
        tweakAndroidHack.checked = true;
        tweakIdlerMute.checked = true;
        tweakDomPool.checked = true;

        // Dispatch change events to trigger attached logic (updates internal state)
        [useNewAudioToggle, audioModeSelect, audioProcSelect, audioPoolToggle, 
         audioLatSelect, audioNoiseSelect, tweakZeroCopy, tweakFastLoop, 
         tweakAndroidHack, tweakIdlerMute, tweakDomPool].forEach(el => el.dispatchEvent(new Event('change')));
    });

    useNewAudioToggle.addEventListener('change', (e) => state.useNewAudio = e.target.checked);
    audioModeSelect.addEventListener('change', (e) => advancedAudio.setMode(e.target.value));
    audioProcSelect.addEventListener('change', (e) => advancedAudio.setAdvancedOptions({ processingMode: e.target.value }));
    audioPoolToggle.addEventListener('change', (e) => advancedAudio.setAdvancedOptions({ useBufferPool: e.target.checked }));
    audioLatSelect.addEventListener('change', (e) => advancedAudio.setLatencyHint(e.target.value));
    audioNoiseSelect.addEventListener('change', (e) => advancedAudio.setAdvancedOptions({ noiseGenMode: e.target.value }));

    // Tweak Listeners
    tweakZeroCopy.addEventListener('change', (e) => advancedAudio.tweaks.zeroCopy = e.target.checked);
    tweakFastLoop.addEventListener('change', (e) => {
        advancedAudio.tweaks.fastLoop = e.target.checked;
        if (advancedAudio.workletNode) {
            advancedAudio.workletNode.port.postMessage({ type: 'tweak', fastLoop: e.target.checked });
        }
    });
    tweakAndroidHack.addEventListener('change', (e) => {
        advancedAudio.tweaks.androidHack = e.target.checked;
        // Requires "Apply & Restart" to reboot engine with 0.00001 latency hint
    });
    tweakIdlerMute.addEventListener('change', (e) => {
        advancedAudio.tweaks.idlerMute = e.target.checked;
        // Requires "Apply & Restart" to re-instantiate the idler node
    });
    tweakDomPool.addEventListener('change', (e) => state.fastDomClear = e.target.checked);

    mobileToggleBtn.addEventListener('click', goFull);

    speedSelect.addEventListener('change', (e) => {
        gameSpeed = parseFloat(e.target.value);
        console.log(`Game speed updated to: ${gameSpeed}x`);
    });

    toggleFpsCheckbox.addEventListener('change', (e) => {
        showFps = e.target.checked;
        fpsCounterEl.classList.toggle('hidden', !showFps);
        if (showFps) {
            framesThisSecond = 0;
            lastFpsUpdateTime = performance.now();
        }
    });

    lockFpsCheckbox.addEventListener('change', (e) => {
        lockFps = e.target.checked;
        lastRenderTime = performance.now(); 
    });

    hitboxStyleSelect.addEventListener('change', (e) => {
        state.hitboxStyle = e.target.value;
        refreshAllHitboxes(); // Apply dynamically to current game
    });

    toggleHitboxesCheckbox.addEventListener('change', (e) => {
        state.showHitboxes = e.target.checked;
        updateHitboxVisibility();
    });

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

    setupMobileControls();
});
