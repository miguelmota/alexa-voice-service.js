'use strict';

window.AudioContext = window.AudioContext || window.webkitAudioContext;

function typedArrayToAudioBuffer(typedArray, context) {
  return new Promise((resolve, reject) => {

    if (context) {
      if (Object.prototype.toString.call(context) !== '[object AudioContext]') {
        throw new TypeError('`context` must be an AudioContext');
      }
    } else {
      context = new AudioContext();
    }

    const arrayBuffer = new ArrayBuffer(typedArray.byteLength);
    new Uint8Array(arrayBuffer).set(new Uint8Array(typedArray));

    context.decodeAudioData(arrayBuffer, resolve, reject);
  });
}

module.exports = typedArrayToAudioBuffer;
