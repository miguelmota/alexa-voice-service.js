'use strict';

/**
 * @credit https://github.com/mattdiamond/Recorderjs
 */
function mergeBuffers(channelBuffer, recordingLength){
  const result = new Float32Array(recordingLength);
  const length = channelBuffer.length;
  let offset = 0;

  for (let i = 0; i < length; i++){
    let buffer = channelBuffer[i];

    result.set(buffer, offset);
    offset += buffer.length;
  }

  return result;
}

module.exports = mergeBuffers;
