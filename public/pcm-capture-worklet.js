class LifeLensPcmCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.phase = 0;
    this.samples = [];
    this.chunkSize = 320;
  }

  process(inputs) {
    const channel = inputs[0]?.[0];
    if (!channel) return true;

    for (let index = 0; index < channel.length; index += 1) {
      this.phase += 16000;
      if (this.phase < sampleRate) continue;
      this.phase -= sampleRate;

      const value = Math.max(-1, Math.min(1, channel[index]));
      this.samples.push(value < 0 ? value * 32768 : value * 32767);
      if (this.samples.length === this.chunkSize) {
        const pcm = Int16Array.from(this.samples);
        this.samples = [];
        this.port.postMessage(pcm.buffer, [pcm.buffer]);
      }
    }

    return true;
  }
}

registerProcessor("lifelens-pcm-capture", LifeLensPcmCapture);
