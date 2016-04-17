'use strict';

/**
 * @credit https://github.com/mattdiamond/Recorderjs
 */
function interleave(leftChannel, rightChannel) {
  if (leftChannel && !rightChannel) {
    return leftChannel;
  }

  const length = leftChannel.length + rightChannel.length;
  let result = new Float32Array(length);
  let inputIndex = 0;

  for (let index = 0; index < length; ){
    result[index++] = leftChannel[inputIndex];
    result[index++] = rightChannel[inputIndex];
    inputIndex++;
  }

  return result;
}

module.exports = interleave;
