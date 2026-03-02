class FlowerProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.activeSounds = [];
        this.buffers = { tink: null, tonk: null };

        this.port.onmessage = (e) => {
            if (e.data.type === 'load') {
                // Load buffers directly into memory ONCE
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
