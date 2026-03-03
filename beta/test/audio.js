/**
 * Bee Flower Bee - Audio Engine
 * Self-contained module for zero-latency, heavily optimized Web Audio API playback.
 */

// 1. Embed the AudioWorklet code as a string so we don't need a separate file
const workletCode = `
class FlowerProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.activeSounds = [];
        this.buffers = { tink: null, tonk: null };

        this.port.onmessage = (e) => {
            if (e.data.type === 'load') {
                // Load buffers directly into Worklet memory ONCE
                this.buffers[e.data.name] = e.data.buffer;
            } else if (e.data.type === 'play') {
                // Instantly play from memory without array buffer transfer lag
                const buf = this.buffers[e.data.name];
                if (buf) {
                    this.activeSounds.push({ buffer: buf, position: 0 });
                }
            }
        };
    }

    process(inputs, outputs, parameters) {
        const output = outputs[0];
        const channel = output[0];

        // 1. Clear output channel first
        for (let i = 0; i < channel.length; i++) {
            channel[i] = 0;
        }

        // 2. Mix all active sounds frame-by-frame
        for (let s = this.activeSounds.length - 1; s >= 0; s--) {
            const sound = this.activeSounds[s];
            
            for (let i = 0; i < channel.length; i++) {
                if (sound.position < sound.buffer.length) {
                    channel[i] += sound.buffer[sound.position];
                    sound.position++;
                }
            }
            
            // 3. Remove sound from queue if finished playing
            if (sound.position >= sound.buffer.length) {
                this.activeSounds.splice(s, 1);
            }
        }

        return true;
    }
}

registerProcessor('flower-processor', FlowerProcessor);
`;

// Create a blob URL to load the worklet dynamically
const workletBlob = new Blob([workletCode], { type: 'application/javascript' });
const WORKLET_URL = URL.createObjectURL(workletBlob);

// 2. The Main Audio Engine Class (Globally exposed)
window.SoundEngine = class SoundEngine {
    constructor() {
        // Core settings
        this.mode = 'buffered'; 
        this.latencyHint = 'interactive';
        this.noiseGenMode = 'offline';
        this.processingMode = 'worklet';
        this.useBufferPool = true;
        
        // Context and Nodes
        this.ctx = null;
        this.masterGain = null;
        this.limiter = null;
        this.workletNode = null;
        
        // Buffer Data
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

        // Cross-browser AudioContext support
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioContextClass({ 
            latencyHint: this.latencyHint,
            sampleRate: 44100
        });

        // Setup Master Bus & Limiter to prevent clipping
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0.5;

        this.limiter = this.ctx.createDynamicsCompressor();
        this.limiter.threshold.setValueAtTime(-10, this.ctx.currentTime);

        this.masterGain.connect(this.limiter);
        this.limiter.connect(this.ctx.destination);

        // Attempt to load AudioWorklet for zero-latency processing
        if (this.processingMode === 'worklet' && this.ctx.audioWorklet) {
            console.log("⚡ AudioWorklet pipeline requested.");
            try {
                await this.ctx.audioWorklet.addModule(WORKLET_URL);
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
        const bufferSize = this.ctx.sampleRate * 2; // 2 seconds of noise
        
        if (this.noiseGenMode === 'offline') {
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

        // Generate "Tink" Sound
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

        // Generate "Tonk" Sound
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

        // Send generated audio arrays directly into the Worklet's memory
        if (this.processingMode === 'worklet' && this.workletNode) {
            this.workletNode.port.postMessage({ type: 'load', name: 'tink', buffer: this.buffers.tink.getChannelData(0) });
            this.workletNode.port.postMessage({ type: 'load', name: 'tonk', buffer: this.buffers.tonk.getChannelData(0) });
        }

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
        this.isTinkNext = !this.isTinkNext; // Alternate sound
    }

    playBuffer(buffer) {
        if (!buffer) return;
        
        if (this.processingMode === 'worklet' && this.workletNode) {
            // Optimized Worklet trigger: Just send the name, memory is already there
            const soundName = buffer === this.buffers.tink ? 'tink' : 'tonk';
            this.workletNode.port.postMessage({ type: 'play', name: soundName });
        } else {
            // Standard playback
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
        
        // Replenish the pool position instantly
        const newSrc = this.ctx.createBufferSource();
        newSrc.buffer = bufferRef;
        pool[this.poolIndex] = newSrc;
        
        this.poolIndex = (this.poolIndex + 1) % this.BUFFER_POOL_SIZE;
    }

    // Un-buffered Procedural Generation
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
    setMode(mode) { this.mode = mode; }
    
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
        this.initContext();
        this.unlocked = false;
        this.unlock();
    }

    unlock() {
        if (this.unlocked) return;
        if (this.ctx.state === 'suspended') this.ctx.resume();

        // Play silent buffer to unlock audio engine in browsers
        const buffer = this.ctx.createBuffer(1, 1, 22050);
        const source = this.ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(this.ctx.destination);
        source.start(0);

        // Persistent silent idler prevents garbage collection dropouts
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
