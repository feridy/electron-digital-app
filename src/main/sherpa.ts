import sherpa from 'sherpa-onnx';
import path from 'path';
import fs from 'fs-extra';

export function createKeywordSpotter() {
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
      tokens: path.join(process.cwd(), './sherpa-onnx/tokens.txt')
      // debug: 0
    },
    keywords
  };

  return sherpa.createKws(config);
}

export async function detectedKeyword(samples: Float32Array | string) {
  const kws = await createKeywordSpotter();
  const stream = kws.createStream();
  if (typeof samples === 'string') {
    const wave = sherpa.readWave(samples);
    stream.acceptWaveform(wave.sampleRate, wave.samples);
  } else {
    stream.acceptWaveform(kws.config.featConfig.sampleRate, samples);
  }
  const detectedKeywords: string[] = [];
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
}
