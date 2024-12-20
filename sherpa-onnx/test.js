// Copyright (c)  2024  Xiaomi Corporation
const sherpa_onnx = require('sherpa-onnx');
const fs = require('fs-extra');
const path = require('path');

function createKeywordSpotter() {
  // Please download test files from
  // https://github.com/k2-fsa/sherpa-onnx/releases/tag/kws-models
  const keywordsFile = './keywords.txt';
  const keywords = fs.readFileSync(keywordsFile, 'utf-8');
  const config = {
    featConfig: {
      sampleRate: 16000,
      featureDim: 80
    },
    modelConfig: {
      transducer: {
        encoder: './encoder-epoch-12-avg-2-chunk-16-left-64.onnx',
        decoder: './decoder-epoch-12-avg-2-chunk-16-left-64.onnx',
        joiner: './joiner-epoch-12-avg-2-chunk-16-left-64.onnx'
      },
      tokens: './tokens.txt',
      // numThreads: 2,
      // provider: 'cpu',
      debug: 1
    },
    keywords: 'w én s ēn t è k ǎ s uǒ  @文森特卡索\n' + 'f ǎ g uó @法国'
  };

  return sherpa_onnx.createKws(config);
}

const kws = createKeywordSpotter();
const stream = kws.createStream();
const waveFilename = './test_wavs/3.wav';

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
