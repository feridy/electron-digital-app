// Copyright (c)  2024  Xiaomi Corporation
const sherpa_onnx = require('sherpa-onnx');
const fs = require('fs-extra');
const path = require('path');

function createKeywordSpotter() {
  // Please download test files from
  // https://github.com/k2-fsa/sherpa-onnx/releases/tag/kws-models
  const keywordsFile = path.join(process.cwd(), './sherpa-onnx/keywords.txt');
  const keywords = fs.readFileSync(keywordsFile, 'utf-8');
  const config = {
    featConfig: {
      sampleRate: 16000,
      featureDim: 80
    },
    modelConfig: {
      transducer: {
        encoder: path.join(
          process.cwd(),
          './sherpa-onnx/encoder-epoch-12-avg-2-chunk-16-left-64.onnx'
        ),
        decoder: path.join(
          process.cwd(),
          './sherpa-onnx/decoder-epoch-12-avg-2-chunk-16-left-64.onnx'
        ),
        joiner: path.join(
          process.cwd(),
          './sherpa-onnx/joiner-epoch-12-avg-2-chunk-16-left-64.onnx'
        )
      },
      tokens: path.join(process.cwd(), './sherpa-onnx/tokens.txt'),
      numThreads: 2,
      provider: 'cpu',
      debug: 1
    },
    keywords
  };

  return sherpa_onnx.createKws(config);
}

const kws = createKeywordSpotter();
const stream = kws.createStream();
const waveFilename = path.join(process.cwd(), './sherpa-onnx/test_wavs/3.wav');

const wave = sherpa_onnx.readWave(waveFilename);
stream.acceptWaveform(wave.sampleRate, wave.samples);

const tailPadding = new Float32Array(wave.sampleRate * 0.4);
stream.acceptWaveform(kws.config.featConfig.sampleRate, tailPadding);

const detectedKeywords = [];
while (kws.isReady(stream)) {
  kws.decode(stream);
  const keyword = kws.getResult(stream).keyword;
  if (keyword != '') {
    detectedKeywords.push(keyword);
  }
}
console.log(detectedKeywords);

stream.free();
kws.free();
