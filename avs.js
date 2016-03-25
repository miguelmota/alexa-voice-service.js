(function(root) {
  'use strict';

  if (!navigator.getUserMedia) {
    navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia;
  }

  class AVS {
    constructor(options = {}) {
      this._bufferSize = 2048;
      this._inputChannels = 1;
      this._outputChannels = 1;
      this._leftChannel = [];
      this._rightChannel = [];
      this._audioContext = null;
      this._recorder = null;
      this._sampleRate = null;
      this._outputSampleRate = 16000;
      this._audioInput = null;
      this._volumeNode = null;
      this._debug = !!options.debug;

      observable(this);
    }

    _log(type, message) {
      if (type && !message) {
        message = type;
        type = 'log';
      }

      this.trigger('log', message);

      if (this._debug) {
        console[type](message);
      }
    }

    requestMic() {
      return new Promise((resolve, reject) => {
        navigator.getUserMedia({
            audio: true
        }, (stream) => {
            this._log('Microphone connected.');
            return this.connectMediaStream(stream).then(() => {
              return resolve(stream);
        })}, (error) => {
          this._log('error', error);
          this.trigger('error', error);
          return reject(error);
        });
      });
    }

    connectMediaStream(stream) {
      return new Promise((resolve, reject) => {
        const isMediaStream = Object.prototype.toString.call(stream) === '[object MediaStream]';

        if (!isMediaStream) {
          const error = new TypeError('Argument must be a `MediaStream` object.')
          this._log('error', error)
          this.trigger('error', error);
          return reject(error);
        }

        this._audioContext = new AudioContext();
        this._sampleRate = this._audioContext.sampleRate;

        this._log(`Sample rate: ${this._sampleRate}`);

        this._volumeNode = this._audioContext.createGain();
        this._audioInput = this._audioContext.createMediaStreamSource(stream);

        this._audioInput.connect(this._volumeNode);

        this._recorder = this._audioContext.createScriptProcessor(this._bufferSize, this._inputChannels, this._outputChannels);

        this._recorder.onaudioprocess = (event) => {
            if (!this._isRecording) {
              return false;
            }

            const left = event.inputBuffer.getChannelData(0);
            this._leftChannel.push(new Float32Array(left));

            if (this._inputChannels > 1) {
              const right = event.inputBuffer.getChannelData(1);
              this._rightChannel.push(new Float32Array(right));
            }

            this._recordingLength += this._bufferSize;
        };

        this._volumeNode.connect(this._recorder);
        this._recorder.connect(this._audioContext.destination);
        this._log(`Media stream connected.`);

        return resolve();
      });
    }

    startRecording() {
      return new Promise((resolve, reject) => {
        if (!this._audioInput) {
          const error = new Error('No Media Stream connected.');
          this._log('error', error);
          this.trigger('error', error);
          return reject(error);
        }

        this._isRecording = true;
        this._leftChannel.length = this._rightChannel.length = 0;
        this._recordingLength = 0;
        this._log(`Recording started.`);

        return resolve();
      });
    }

    stopRecording() {
      return new Promise((resolve, reject) => {
        if (!this._isRecording) {
          return resolve();
        }

        this._isRecording = false;

        const leftBuffer = Helpers.mergeBuffers(this._leftChannel, this._recordingLength);
        let interleaved = null;

        if (this._outputChannels > 1) {
          const rightBuffer = Helpers.mergeBuffers(this._rightChannel, this._recordingLength);
          interleaved = Helpers.interleave(leftBuffer, rightBuffer);
        } else {
          interleaved = Helpers.interleave(leftBuffer);
        }

        interleaved = Helpers.downsampleBuffer(interleaved, this._sampleRate, this._outputSampleRate);

        const buffer = new ArrayBuffer(44 + interleaved.length * 2);
        const view = new DataView(buffer);

      /**
       * @credit https://github.com/mattdiamond/Recorderjs
       */
        Helpers.writeUTFBytes(view, 0, 'RIFF');
        view.setUint32(4, 44 + interleaved.length * 2, true);
        Helpers.writeUTFBytes(view, 8, 'WAVE');
        Helpers.writeUTFBytes(view, 12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, this._outputChannels, true);
        view.setUint32(24, this._outputSampleRate, true);
        view.setUint32(28, this._outputSampleRate * 4, true);
        view.setUint16(32, 4, true);
        view.setUint16(34, 16, true);
        Helpers.writeUTFBytes(view, 36, 'data');
        view.setUint32(40, interleaved.length * 2, true);

        const length = interleaved.length;
        const volume = 1;
        let index = 44;

        for (let i = 0; i < length; i++){
          view.setInt16(index, interleaved[i] * (0x7FFF * volume), true);
          index += 2;
        }

        this._log(`Recording stopped.`);
        return resolve(view);
      });
    }

    playBlob(blob) {
      return new Promise((resolve, reject) => {
        const objectUrl = URL.createObjectURL(blob);
        const audio = new Audio();
        audio.src = objectUrl;

        audio.addEventListener('ended', () => {
          this._log('Audio play ended.');
        });

        audio.onload = (event) => {
          URL.revokeObjectUrl(objectUrl);
        };

        this._log('Audio play start.');
        audio.play();

        resolve();
      });
    }
  }

  class Helpers {
    /**
     * @credit http://stackoverflow.com/a/26245260*
     */
    static downsampleBuffer(buffer, inputSampleRate, outputSampleRate) {
      if (inputSampleRate === outputSampleRate) {
        return buffer;
      }

      if (inputSampleRate < outputSampleRate) {
        throw new Error('Output sample rate must be less than input sample rate.');
      }

      const sampleRateRatio = inputSampleRate / outputSampleRate;
      const newLength = Math.round(buffer.length / sampleRateRatio);
      let result = new Float32Array(newLength);
      let offsetResult = 0;
      let offsetBuffer = 0;

      while (offsetResult < result.length) {
        let nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio);
        let accum = 0;
        let count = 0;

        for (var i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
          accum += buffer[i];
          count++;
        }

        result[offsetResult] = accum / count;
        offsetResult++;
        offsetBuffer = nextOffsetBuffer;
      }

      return result;
    }

    /**
     * @credit https://github.com/mattdiamond/Recorderjs
     */
    static interleave(leftChannel, rightChannel){
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

    /**
     * @credit https://github.com/mattdiamond/Recorderjs
     */
    static mergeBuffers(channelBuffer, recordingLength){
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

    /**
     * @credit https://github.com/mattdiamond/Recorderjs
     */
    static writeUTFBytes(view, offset, string){
      const length = string.length;

      for (let i = 0; i < length; i++){
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    }
  }

  function observable(el) {
    let callbacks = {};

    el.on = function(name, fn) {
      if (typeof fn !== 'function') {
        throw new TypeError('Second argument for "on" method must be a function.');
      }

      (callbacks[name] = callbacks[name] || []).push(fn);

      return el;
    };

    el.one = function(name, fn) {
      fn.one = true;
      return el.on.call(el, name, fn);
    };

    el.off = function(name, fn) {
      if (name === '*') {
        callbacks = {};
        return callbacks
      }

      if (!callbacks[name]) {
        return false;
      }

      if (fn) {
        if (typeof fn !== 'function') {
          throw new TypeError('Second argument for "off" method must be a function.');
        }

        callbacks[name] = callbacks[name].map(function(fm, i) {
          if (fm === fn) {
            callbacks[name].splice(i, 1);
          }
        });
      } else {
        delete callbacks[name];
      }
    };

    el.trigger = function(name /*, args */) {
      if (!callbacks[name] || !callbacks[name].length) {
        return;
      }

      const args = [].slice.call(arguments, 1);

      callbacks[name].forEach(function(fn, i) {
        if (fn) {
          fn.apply(fn, args);
          if (fn.one) {
            callbacks[name].splice(i, 1);
          }
        }
      });

      return el;
    };

    return el;
  }

  if (typeof exports !== 'undefined') {
    if (typeof module !== 'undefined' && module.exports) {
      exports = module.exports = AVS;
    }
    exports.AVS = AVS;
  } else if (typeof define === 'function' && define.amd) {
    define([], function() {
      return AVS;
    });
  } else {
    root.AVS = AVS;
  }

})(this);
