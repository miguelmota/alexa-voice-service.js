'use strict';

window.AudioContext = window.AudioContext || window.webkitAudioContext;

function arrayBufferToAudioBuffer(arrayBuffer, context) {
  return new Promise((resolve, reject) => {
    if (context) {
      if (Object.prototype.toString.call(context) !== '[object AudioContext]') {
        throw new TypeError('`context` must be an AudioContext');
      }
    } else {
      context = new AudioContext();
    }

    context.decodeAudioData(arrayBuffer, resolve, reject);
  });
}

module.exports = arrayBufferToAudioBuffer;
