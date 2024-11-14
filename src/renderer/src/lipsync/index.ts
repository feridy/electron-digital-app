export class LipSync {
  audioContext!: AudioContext;

  threshold!: number;

  smoothness!: number;

  pitch!: number;

  fftSize = 1024;

  samplingFrequency = 44100;

  refFBins = [0, 500, 700, 3000, 6000];

  indicesFrequencies: number[] = [];

  fBins: number[] = [];

  sample!: AudioBufferSourceNode;

  gainNode!: GainNode;

  analyser!: AnalyserNode;

  data!: Float32Array;

  isWorking = false;

  processor!: ScriptProcessorNode;

  energyBin: number[] = [];

  bufferNode?: AudioNode | AudioBufferSourceNode | MediaElementAudioSourceNode;

  blendShapes = {
    blendShapeKiss: 0,
    blendShapeLips: 0,
    blendShapeMouth: 0
  };

  updates: (() => void)[] = [];

  constructor(
    audioContext: AudioContext,
    options?: { threshold?: number; smoothness?: number; pitch?: number; update?: () => void }
  ) {
    this.audioContext = audioContext;
    this.threshold = options?.threshold || 0.5;
    this.smoothness = options?.smoothness || 0.6;
    this.pitch = options?.pitch || 1;

    this.defineFBins(this.pitch);

    this.init(options?.update);
  }

  defineFBins(pitch: number) {
    for (let i = 0; i < this.refFBins.length; i++) this.fBins[i] = this.refFBins[i] * pitch;
  }

  init(callback?: () => void) {
    const context = this.audioContext;
    // Sound source
    this.sample = context.createBufferSource();
    // Gain Node
    this.gainNode = context.createGain();
    // Analyser
    this.analyser = context.createAnalyser();
    // FFT size
    this.analyser.fftSize = this.fftSize;
    // FFT smoothing
    this.analyser.smoothingTimeConstant = this.smoothness;
    this.analyser.minDecibels = -160;
    this.analyser.maxDecibels = -25;

    // FFT buffer
    this.data = new Float32Array(this.analyser.frequencyBinCount);

    this.processor = context.createScriptProcessor(this.fftSize * 2, 1, 1);
    this.analyser.connect(this.processor);

    this.processor.onaudioprocess = () => {
      if (!this.isWorking || !this.bufferNode) return;
      this.analyser.getFloatFrequencyData(this.data);
      const stPSD = this.getstPSD();
      let _blendShapeKiss = 0;
      let _blendShapeLips = 0;
      let _blendShapeMouth = 0;
      const energyBin = new Float32Array(this.fBins.length);
      for (let m = 0; m < this.fBins.length - 1; m++) {
        for (let j = this.indicesFrequencies[m]; j <= this.indicesFrequencies[m + 1]; j++) {
          if (stPSD[j] > 0) {
            energyBin[m] += stPSD[j];
          }
        }

        energyBin[m] /= this.indicesFrequencies[m + 1] - this.indicesFrequencies[m];
      }
      if (energyBin[1] > 0.2) {
        _blendShapeKiss = 1 - 2 * energyBin[2];
      } else {
        _blendShapeKiss = (1 - 2 * energyBin[2]) * 5 * energyBin[1];
      }

      // _blendShapeKiss += energyBin[0] / 4;

      _blendShapeLips = Math.min(3 * energyBin[3] + energyBin[0], 1);
      _blendShapeMouth = Math.min(2 * (energyBin[1] + energyBin[3]) - energyBin[0], 1);

      this.energyBin = Array.from(energyBin);

      this.blendShapes = {
        blendShapeKiss: _blendShapeKiss,
        blendShapeLips: _blendShapeLips,
        blendShapeMouth: _blendShapeMouth
      };

      callback?.();
    };

    this.processor.connect(context.destination);
  }

  start(bufferNode: AudioBufferSourceNode | MediaElementAudioSourceNode) {
    if (this.isWorking) return;
    console.log('Buffer play.');
    this.isWorking = true;
    for (let m = 0; m < this.fBins.length; m++) {
      this.indicesFrequencies[m] = Math.round(
        ((2 * this.fftSize) / this.samplingFrequency) * this.fBins[m]
      );
    }
    bufferNode.connect(this.analyser);

    this.bufferNode = bufferNode;
  }

  connect(node: AudioNode) {
    if (this.isWorking) return;
    console.log('Buffer play.');
    for (let m = 0; m < this.fBins.length; m++) {
      this.indicesFrequencies[m] = Math.round(
        ((2 * this.fftSize) / this.samplingFrequency) * this.fBins[m]
      );
    }
    node.connect(this.analyser);

    this.bufferNode = node;
  }

  stop() {
    this.isWorking = false;
    if (this.bufferNode?.numberOfOutputs) {
      this.bufferNode?.disconnect();
    }

    this.bufferNode = undefined;
  }

  getstPSD() {
    const stPSD = new Float32Array(this.data.length);
    for (let i = 0; i < this.data.length; i++) {
      stPSD[i] = this.threshold + (this.data[i] + 20) / 140;
    }

    return stPSD;
  }
}
