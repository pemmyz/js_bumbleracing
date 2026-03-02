// v1.6.2 (Optimized for Zero Latency Worklet)
document.addEventListener('DOMContentLoaded', () => {

    // --- ELEMENT SELECTORS ---
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
    const restartGameButton = document.getElementById('restart-game-button');
    const devIndicator = document.getElementById('dev-mode-indicator');
    const externalHelpButton = document.getElementById('external-help-button');
    const p1GpStatusEl = document.getElementById('p1-gp-status');
    const p2GpStatusEl = document.getElementById('p2-gp-status'); 

    // --- SETTINGS SELECTORS ---
    const speedSelect = document.getElementById('speed-select');
    const audioModeSelect = document.getElementById('audio-mode');
    const latencyHintSelect = document.getElementById('latency-hint');
    const volumeSlider = document.getElementById('volume-slider');
    const volumeValueEl = document.getElementById('volume-value');
    const fpsCounterEl = document.getElementById('fps-counter');
    const toggleFpsCheckbox = document.getElementById('toggle-fps');
    const lockFpsCheckbox = document.getElementById('lock-fps');
    
    // --- ADVANCED AUDIO SELECTORS ---
    const processingModeSelect = document.getElementById('processing-mode');
    const noiseGenSelect = document.getElementById('noise-gen');
    const useBufferPoolCheckbox = document.getElementById('use-buffer-pool');

    // --- MOBILE CONTROLS SELECTORS ---
    const mobileControls = document.getElementById('mobile-controls');
    const mobileLeftBtn = document.getElementById('mobile-left');
    const mobileRightBtn = document.getElementById('mobile-right');
    const mobileUpBtn = document.getElementById('mobile-up');
    const mobileToggleBtn = document.getElementById('mobile-btn');

    // --- SOUND ENGINE ---
    class SoundEngine {
        constructor() {
            this.mode = 'buffered'; 
            this.latencyHint = 'interactive';
            this.noiseGenMode = 'offline';
            this.processingMode = 'worklet';
            this.useBufferPool = true;
            
            this.ctx = null;
            this.masterGain = null;
            this.limiter = null;
            this.workletNode = null;
            
            this.buffers = { tink: null, tonk: null };
            this.noiseBuffer = null;
            this.isTinkNext = true;
            this.unlocked = false;

            // Buffer Pool Variables
            this.BUFFER_POOL_SIZE = 8;
            this.tinkPool = [];
            this.tonkPool = [];
            this.poolIndex = 0;

            this.initContext();
        }

        async initContext() {
            if (this.ctx) this.ctx.close();

            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContextClass({ 
                latencyHint: this.latencyHint,
                sampleRate: 44100
            });

            this.masterGain = this.ctx.createGain();
            this.masterGain.gain.value = 0.5;

            this.limiter = this.ctx.createDynamicsCompressor();
            this.limiter.threshold.setValueAtTime(-10, this.ctx.currentTime);

            this.masterGain.connect(this.limiter);
            this.limiter.connect(this.ctx.destination);

            if (this.processingMode === 'worklet' && this.ctx.audioWorklet) {
                console.log("⚡ AudioWorklet pipeline requested.");
                try {
                    await this.ctx.audioWorklet.addModule('flower-worklet.js');
                    this.workletNode = new AudioWorkletNode(this.ctx, 'flower-processor');
                    this.workletNode.connect(this.masterGain);
                    console.log("✅ AudioWorklet successfully loaded and connected.");
                } catch(e) {
                    console.error("AudioWorklet failed to load, falling back to standard thread.", e);
                    this.processingMode = 'standard';
                }
            } else {
                this.workletNode = null;
            }

            this.noiseBuffer = await this.createNoiseBuffer();
        }

        async createNoiseBuffer() {
            const bufferSize = this.ctx.sampleRate * 2;
            
            if (this.noiseGenMode === 'offline') {
                console.log("Generating noise out of runtime (OfflineAudioContext)...");
                const offlineCtx = new OfflineAudioContext(1, bufferSize, this.ctx.sampleRate);
                const buffer = offlineCtx.createBuffer(1, bufferSize, offlineCtx.sampleRate);
                const data = buffer.getChannelData(0);
                for (let i = 0; i < bufferSize; i++) { data[i] = Math.random() * 2 - 1; }
                
                const src = offlineCtx.createBufferSource();
                src.buffer = buffer;
                src.connect(offlineCtx.destination);
                src.start(0);
                return await offlineCtx.startRendering();
            } else {
                console.log("Generating noise synchronously (Heavy)...");
                const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
                const data = buffer.getChannelData(0);
                for (let i = 0; i < bufferSize; i++) { data[i] = Math.random() * 2 - 1; }
                return buffer;
            }
        }

        async createOfflineBuffer(duration, renderCallback) {
            const offlineCtx = new OfflineAudioContext(1, 44100 * duration, 44100);
            const master = offlineCtx.createGain();
            master.connect(offlineCtx.destination);
            
            renderCallback(offlineCtx, master, this.noiseBuffer);
            return await offlineCtx.startRendering();
        }

        async preloadSounds() {
            console.log("🔊 Pre-Rendering Tink/Tonk Buffers into Memory...");

            this.buffers.tink = await this.createOfflineBuffer(0.2, (ctx, out, noiseBuf) => {
                const osc = ctx.createOscillator();
                osc.type = 'sine';
                osc.frequency.value = 1500;
                osc.frequency.exponentialRampToValueAtTime(800, 0.1);
                const env = ctx.createGain();
                env.gain.setValueAtTime(1.5, 0);
                env.gain.exponentialRampToValueAtTime(0.001, 0.1);
                osc.connect(env).connect(out);
                osc.start(0);

                if (noiseBuf) {
                    const src = ctx.createBufferSource();
                    src.buffer = noiseBuf;
                    const filter = ctx.createBiquadFilter();
                    filter.type = 'highpass';
                    filter.frequency.value = 2000;
                    const nEnv = ctx.createGain();
                    nEnv.gain.setValueAtTime(0.5, 0);
                    nEnv.gain.exponentialRampToValueAtTime(0.001, 0.05);
                    src.connect(filter).connect(nEnv).connect(out);
                    src.start(0);
                }
            });

            this.buffers.tonk = await this.createOfflineBuffer(0.3, (ctx, out, noiseBuf) => {
                const osc = ctx.createOscillator();
                osc.type = 'triangle';
                osc.frequency.value = 450;
                osc.frequency.exponentialRampToValueAtTime(200, 0.2);
                const filter = ctx.createBiquadFilter();
                filter.type = 'bandpass';
                filter.frequency.value = 600;
                const env = ctx.createGain();
                env.gain.setValueAtTime(2.0, 0);
                env.gain.exponentialRampToValueAtTime(0.001, 0.2);
                osc.connect(filter).connect(env).connect(out);
                osc.start(0);

                if (noiseBuf) {
                    const src = ctx.createBufferSource();
                    src.buffer = noiseBuf;
                    const nFilter = ctx.createBiquadFilter();
                    nFilter.type = 'bandpass';
                    nFilter.frequency.value = 800;
                    const nEnv = ctx.createGain();
                    nEnv.gain.setValueAtTime(1.0, 0);
                    nEnv.gain.exponentialRampToValueAtTime(0.001, 0.05);
                    src.connect(nFilter).connect(nEnv).connect(out);
                    src.start(0);
                }
            });

            if (this.useBufferPool) this.initPools();

            // --- ZERO-LATENCY OPTIMIZATION ---
            // Send buffers to Worklet memory once to avoid heavy IPC transfers per click
            if (this.processingMode === 'worklet' && this.workletNode) {
                this.workletNode.port.postMessage({ type: 'load', name: 'tink', buffer: this.buffers.tink.getChannelData(0) });
                this.workletNode.port.postMessage({ type: 'load', name: 'tonk', buffer: this.buffers.tonk.getChannelData(0) });
            }
            // ---------------------------------

            console.log("✅ Audio Buffers Ready.");
        }

        initPools() {
            if (!this.buffers.tink || !this.buffers.tonk) return;
            this.tinkPool = [];
            this.tonkPool = [];
            
            for (let i = 0; i < this.BUFFER_POOL_SIZE; i++) {
                const tinkSrc = this.ctx.createBufferSource();
                tinkSrc.buffer = this.buffers.tink;
                this.tinkPool.push(tinkSrc);

                const tonkSrc = this.ctx.createBufferSource();
                tonkSrc.buffer = this.buffers.tonk;
                this.tonkPool.push(tonkSrc);
            }
            console.log(`Initialized Buffer Pool (Size: ${this.BUFFER_POOL_SIZE})`);
        }

        playFlowerSound() {
            if (this.mode === 'buffered') {
                if (this.useBufferPool && this.tinkPool.length > 0 && this.processingMode !== 'worklet') {
                    this.playFromPool();
                } else {
                    this.isTinkNext ? this.playBuffer(this.buffers.tink) : this.playBuffer(this.buffers.tonk);
                }
            } else {
                this.isTinkNext ? this.playTinkRealtime() : this.playTonkRealtime();
            }
            this.isTinkNext = !this.isTinkNext;
        }

        playBuffer(buffer) {
            if (!buffer) return;
            
            if (this.processingMode === 'worklet' && this.workletNode) {
                // Optimized trigger: just send the flag, not the array
                const soundName = buffer === this.buffers.tink ? 'tink' : 'tonk';
                this.workletNode.port.postMessage({ type: 'play', name: soundName });
            } else {
                const source = this.ctx.createBufferSource();
                source.buffer = buffer;
                source.connect(this.masterGain);
                source.start(0);
            }
        }

        playFromPool() {
            const pool = this.isTinkNext ? this.tinkPool : this.tonkPool;
            const bufferRef = this.isTinkNext ? this.buffers.tink : this.buffers.tonk;
            
            const src = pool[this.poolIndex];
            src.connect(this.masterGain);
            src.start(0);
            
            const newSrc = this.ctx.createBufferSource();
            newSrc.buffer = bufferRef;
            pool[this.poolIndex] = newSrc;
            
            this.poolIndex = (this.poolIndex + 1) % this.BUFFER_POOL_SIZE;
        }

        playTinkRealtime() {
            const now = this.ctx.currentTime;
            const osc = this.ctx.createOscillator();
            osc.frequency.setValueAtTime(1500, now);
            osc.frequency.exponentialRampToValueAtTime(800, now + 0.1);
            const env = this.ctx.createGain();
            env.gain.setValueAtTime(1.5, now);
            env.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
            osc.connect(env).connect(this.masterGain);
            osc.start(now);
            osc.stop(now + 0.1);
        }

        playTonkRealtime() {
            const now = this.ctx.currentTime;
            const osc = this.ctx.createOscillator();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(450, now);
            osc.frequency.exponentialRampToValueAtTime(200, now + 0.2);
            const env = this.ctx.createGain();
            env.gain.setValueAtTime(2.0, now);
            env.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
            osc.connect(env).connect(this.masterGain);
            osc.start(now);
            osc.stop(now + 0.2);
        }

        setVolume(val) { if (this.masterGain) this.masterGain.gain.value = val; }
        setMode(mode) { this.mode = mode; console.log(`Audio Mode: ${mode}`); }
        
        setLatencyHint(hint) {
            if (hint === this.latencyHint) return;
            this.latencyHint = hint;
            this.rebootContext();
        }

        setAdvancedOptions(options) {
            let needsReboot = false;
            if (options.processingMode && options.processingMode !== this.processingMode) {
                this.processingMode = options.processingMode;
                needsReboot = true;
            }
            if (options.useBufferPool !== undefined) {
                this.useBufferPool = options.useBufferPool;
                if (this.useBufferPool) this.initPools();
            }
            if (options.noiseGenMode && options.noiseGenMode !== this.noiseGenMode) {
                this.noiseGenMode = options.noiseGenMode;
                needsReboot = true;
            }
            if (needsReboot) this.rebootContext();
        }

        rebootContext() {
            console.log("Rebooting Audio Engine to apply core settings...");
            this.initContext();
            this.unlocked = false;
            this.unlock();
        }

        unlock() {
            if (this.unlocked) return;
            if (this.ctx.state === 'suspended') this.ctx.resume();

            const buffer = this.ctx.createBuffer(1, 1, 22050);
            const source = this.ctx.createBufferSource();
            source.buffer = buffer;
            source.connect(this.ctx.destination);
            source.start(0);

            const idler = this.ctx.createOscillator();
            const idlerGain = this.ctx.createGain();
            idlerGain.gain.value = 0.001;

            idler.connect(idlerGain).connect(this.ctx.destination);
            idler.start(0);

            this.unlocked = true;
            console.log("🔓 Audio Unlocked.");
            if (!this.buffers.tink) this.preloadSounds();
        }
    }

    const soundEngine = new SoundEngine();

    // --- INTERACTION HANDLERS ---
    const events = ['touchstart', 'touchend', 'mousedown', 'keydown', 'click'];
    events.forEach(e => document.body.addEventListener(e, () => soundEngine.unlock(), { once: true, capture: true }));

    // --- SETTINGS LISTENERS ---
    volumeSlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        volumeValueEl.textContent = `${val}%`;
        soundEngine.setVolume(val / 100);
    });

    audioModeSelect.addEventListener('change', (e) => {
        let mappedMode = e.target.value === 'procedural' ? 'realtime' : 'buffered';
        soundEngine.setMode(mappedMode);
    });

    latencyHintSelect.addEventListener('change', (e) => {
        soundEngine.setLatencyHint(e.target.value);
    });

    processingModeSelect.addEventListener('change', (e) => {
        soundEngine.setAdvancedOptions({ processingMode: e.target.value });
    });

    noiseGenSelect.addEventListener('change', (e) => {
        soundEngine.setAdvancedOptions({ noiseGenMode: e.target.value });
    });

    useBufferPoolCheckbox.addEventListener('change', (e) => {
        soundEngine.setAdvancedOptions({ useBufferPool: e.target.checked });
    });

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

    // --- BUTTON LISTENERS ---
    startButton.addEventListener('click', startGame);
    helpButton.addEventListener('click', () => helpScreen.classList.remove('hidden'));
    closeHelpButton.addEventListener('click', () => helpScreen.classList.add('hidden'));
    
    restartGameButton.addEventListener('click', () => {
        helpScreen.classList.add('hidden');
        startGame();
    });

    externalHelpButton.addEventListener('click', () => helpScreen.classList.remove('hidden'));
    mobileToggleBtn.addEventListener('click', goFull);

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
        soundEngine.unlock();
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
    let state = {};
    const keys = { ArrowUp: false, ArrowLeft: false, ArrowRight: false, w: false, a: false, d: false, ' ': false };
    
    let lastFrameTime = 0;
    let lastRenderTime = 0;
    let accumulator = 0;
    let gameSpeed = 1.0;
    const targetFrameTime = 1000 / 60; 
    
    let showFps = false;
    let lockFps = false; // Defalt to unbound for low latency
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
        state = { level: 1, totalScore: 0, lives: 3, gameLoopId: null, gameOver: false, isTwoPlayer: false, devMode: false };
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
        soundEngine.unlock();

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
        player.hitboxEl = createHitbox(player.x, player.y, player.width, player.height);
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
        soundEngine.playFlowerSound();

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
            if (player.hitboxEl) {
                player.hitboxEl.style.transform = `translate(${player.x}px, ${player.y}px)`;
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

    function setupMobileControls() {
        if (!mobileControls) return;

        const addControlListener = (element, key) => {
            const pressKey = (e) => {
                e.preventDefault();
                keys[key] = true;
                soundEngine.unlock(); 
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
