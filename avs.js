(function(root) {
  'use strict';

  const Buffer = require('buffer').Buffer;
  const qs = require('qs');
  const httpMessageParser = require('http-message-parser');

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
      this._debug = false;
      this._token = null;
      this._clientId = null;
      this._deviceId= null;
      this._deviceSerialNumber = null;
      this._redirectUri = null;

      if (options.token) {
        this.setToken(options.token);
      }

      if (options.refreshToken) {
        this.setRefreshToken(options.refreshToken);
      }

      if (options.clientId) {
        this.setClientId(options.clientId);
      }

      if (options.clientSecret) {
        this.setClientSecret(options.clientSecret);
      }

      if (options.deviceId) {
        this.setDeviceId(options.deviceId);
      }

      if (options.deviceSerialNumber) {
        this.setDeviceSerialNumber(options.deviceSerialNumber);
      }

      if (options.redirectUri) {
        this.setRedirectUri(options.redirectUri);
      }

      if (options.debug) {
        this.setDebug(options.debug);
      }

      observable(this);
    }

    _log(type, message) {
      if (type && !message) {
        message = type;
        type = 'log';
      }

      this.emit('log', message);

      if (this._debug) {
        console[type](message);
      }
    }

    login() {
      return new Promise((resolve, reject) => {
        return this.getCodeFromUrl()
        .then(code => this.getTokenFromCode(code))
        .catch(() => this.promptUserLogin())
      });
    }

    promptUserLogin() {
      return new Promise((resolve, reject) => {
        const responseType ='code';
        const scope = 'alexa:all';
        const scopeData = {
          [scope]: {
            productID: this._deviceId,
            productInstanceAttributes: {
              deviceSerialNumber: this._deviceSerialNumber
            }
          }
        };

        const authUrl = `https://www.amazon.com/ap/oa?client_id=${this._clientId}&scope=${encodeURIComponent(scope)}&scope_data=${encodeURIComponent(JSON.stringify(scopeData))}&response_type=${responseType}&redirect_uri=${encodeURI(this._redirectUri)}`

        window.open(authUrl);
      });
    }

    getTokenFromCode(code) {
      return new Promise((resolve, reject) => {
        if (typeof code !== 'string') {
          const error = new TypeError('`code` must be a string.');
          this._log(error);
          return reject(error);
        }

        const grantType = 'authorization_code';
        const postData = `grant_type=${grantType}&code=${code}&client_id=${this._clientId}&client_secret=${this._clientSecret}&redirect_uri=${encodeURIComponent(this._redirectUri)}`;
        const url = 'https://api.amazon.com/auth/o2/token';

        const xhr = new XMLHttpRequest();

        xhr.open('POST', url, true);
        xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded;charset=UTF-8');
        xhr.onload = (event) => {
          console.log('RESPONSE', xhr.response);

          let response = xhr.response;

          try {
            response = JSON.parse(xhr.response);
          } catch (error) {
            this._log(error);
            return reject(error);
          }

          const isObject = response instanceof Object;
          const errorDescription = isObject && response.error_description;

          if (errorDescription) {
            const error = new Error(errorDescription);
            this._log(error);
            return reject(error);
          }

          const token = response.access_token;
          const refreshToken = response.refresh_token;
          const tokenType = response.token_type;
          const expiresIn = response.expiresIn;

          this.setToken(token)
          this.setRefreshToken(refreshToken)

          this.emit('login');
          this._log('Logged in.');
          resolve(response);
        };

        xhr.onerror = (error) => {
          this._log(error);
          reject(error);
        };

        xhr.send(postData);
      });
    }

    getCodeFromUrl() {
      return new Promise((resolve, reject) => {
        const query = qs.parse(window.location.search.substr(1));
        const code = query.code;

        if (code) {
          return resolve(code);
        }

        return reject(null);
      });
    }

    setToken(token) {
      return new Promise((resolve, reject) => {
        if (typeof token === 'string') {
          this._token = token;
          resolve(this._token);
        } else {
          const error = new TypeError('`token` must be a string.');
          this._log(error);
          reject(error);
        }
      });
    }

    setRefreshToken(refreshToken) {
      return new Promise((resolve, reject) => {
        if (typeof refreshToken === 'string') {
          this._refreshToken = refreshToken;
          resolve(this._refreshToken);
        } else {
          const error = new TypeError('`refreshToken` must be a string.');
          this._log(error);
          reject(error);
        }
      });
    }

    setClientId(clientId) {
      return new Promise((resolve, reject) => {
        if (typeof clientId === 'string') {
          this._clientId = clientId;
          resolve(this._clientId);
        } else {
          const error = new TypeError('`clientId` must be a string.');
          this._log(error);
          reject(error);
        }
      });
    }

    setClientSecret(clientSecret) {
      return new Promise((resolve, reject) => {
        if (typeof clientSecret === 'string') {
          this._clientSecret = clientSecret;
          resolve(this._clientSecret);
        } else {
          const error = new TypeError('`clientSecret` must be a string');
          this._log(error);
          reject(error);
        }
      });
    }

    setDeviceId(deviceId) {
      return new Promise((resolve, reject) => {
        if (typeof deviceId === 'string') {
          this._deviceId = deviceId;
          resolve(this._deviceId);
        } else {
          const error = new TypeError('`deviceId` must be a string.');
          this._log(error);
          reject(error);
        }
      });
    }

    setDeviceSerialNumber(deviceSerialNumber) {
      return new Promise((resolve, reject) => {
        if (typeof deviceSerialNumber === 'number' || typeof deviceSerialNumber === 'string') {
          this._deviceSerialNumber = deviceSerialNumber;
          resolve(this._deviceSerialNumber);
        } else {
          const error = new TypeError('`deviceSerialNumber` must be a number or string.');
          this._log(error);
          reject(error);
        }
      });
    }

    setRedirectUri(redirectUri) {
      return new Promise((resolve, reject) => {
        if (typeof redirectUri === 'string') {
          this._redirectUri = redirectUri;
          resolve(this._redirectUri);
        } else {
          const error = new TypeError('`redirectUri` must be a string.');
          this._log(error);
          reject(error);
        }
      });
    }

    setDebug(debug) {
      return new Promise((resolve, reject) => {
        if (typeof debug === 'boolean') {
          this._debug = debug;
          resolve(this._debug);
        } else {
          const error = new TypeError('`debug` must be a boolean.');
          this._log(error);
          reject(error);
        }
      });
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
          this.emit('error', error);
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
          this.emit('error', error);
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
          this.emit('error', error);
          return reject(error);
        }

        this._isRecording = true;
        this._leftChannel.length = this._rightChannel.length = 0;
        this._recordingLength = 0;
        this._log(`Recording started.`);
        this.emit('recordStart');

        return resolve();
      });
    }

    stopRecording() {
      return new Promise((resolve, reject) => {
        if (!this._isRecording) {
          this.emit('recordStop');
          this._log('Recording stopped.');
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
        this.emit('recordStop');
        return resolve(view);
      });
    }

    playBlob(blob) {
      return new Promise((resolve, reject) => {
        if (!blob) {
          reject();
        }

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

    sendAudio (dataView) {
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        const url = 'https://access-alexa-na.amazon.com/v1/avs/speechrecognizer/recognize';

        xhr.open('POST', url, true);
        xhr.responseType = 'arraybuffer';
        xhr.onload = (event) => {
          console.log('RESPONSE', xhr.response);
          const buffer = new Buffer(xhr.response);

          const parsedMessage = httpMessageParser(buffer);

          resolve(parsedMessage);
        };

        xhr.onerror = (error) => {
          this._log(error);
          reject(error);
        };

        const BOUNDARY = 'BOUNDARY1234';
        const BOUNDARY_DASHES = '--';
        const NEWLINE = '\r\n';
        const METADATA_CONTENT_DISPOSITION = 'Content-Disposition: form-data; name="metadata"';
        const METADATA_CONTENT_TYPE = 'Content-Type: application/json; charset=UTF-8';
        const AUDIO_CONTENT_TYPE = 'Content-Type: audio/L16; rate=16000; channels=1';
        const AUDIO_CONTENT_DISPOSITION = 'Content-Disposition: form-data; name="audio"';

        xhr.setRequestHeader('Authorization', `Bearer ${this._token}`);
        xhr.setRequestHeader('Content-Type', 'multipart/form-data; boundary=' + BOUNDARY);
        const metadata = {
          messageHeader: {},
          messageBody: {
            profile: 'alexa-close-talk',
            locale: 'en-us',
            format: 'audio/L16; rate=16000; channels=1'
          }
        };

        const postDataStart = [
          NEWLINE, BOUNDARY_DASHES, BOUNDARY, NEWLINE, METADATA_CONTENT_DISPOSITION, NEWLINE, METADATA_CONTENT_TYPE,
          NEWLINE, NEWLINE, JSON.stringify(metadata), NEWLINE, BOUNDARY_DASHES, BOUNDARY, NEWLINE,
          AUDIO_CONTENT_DISPOSITION, NEWLINE, AUDIO_CONTENT_TYPE, NEWLINE, NEWLINE
        ].join('');

        const postDataEnd = [NEWLINE, BOUNDARY_DASHES, BOUNDARY, BOUNDARY_DASHES, NEWLINE].join('');

        const size = postDataStart.length + dataView.byteLength + postDataEnd.length;
        const uint8Array = new Uint8Array(size);
        let i = 0;

        for (; i < postDataStart.length; i++) {
          uint8Array[i] = postDataStart.charCodeAt(i) & 0xFF;
        }

        for (let j = 0; j < dataView.byteLength ; i++, j++) {
          uint8Array[i] = dataView.getUint8(j);
        }

        for (let j = 0; j < postDataEnd.length; i++, j++) {
          uint8Array[i] = postDataEnd.charCodeAt(j) & 0xFF;
        }

        const payload = uint8Array.buffer;

        xhr.send(payload);
      });
    }

    static get EventTypes() {
      return {
        LOG: 'log',
        ERROR: 'error',
        LOGIN: 'login',
        RECORD_START: 'recordStart',
        RECORD_STOP: 'recordStop'
      };
    }
  }

  class Helpers {
    /**
     * @credit http://stackoverflow.com/a/26245260
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

    el.emit = function(name /*, args */) {
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
