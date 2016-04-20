'use strict';

function arrayBufferToAudioBuffer(url, context) {
  window.AudioContext = window.AudioContext || window.webkitAudioContext;

  return new Promise((resolve, reject) => {
    if (context) {
      if (Object.prototype.toString.call(context) !== '[object AudioContext]') {
        throw new TypeError('`context` must be an AudioContext');
      }
    } else {
      context = new AudioContext();
    }

    const xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.responseType = 'arraybuffer';

    xhr.onload = (event) => {
      context.decodeAudioData(event.response, (data) => {
        resolve(data);
      }, reject);
    };

    xhr.send();
  });
}

module.exports = arrayBufferToAudioBuffer;
