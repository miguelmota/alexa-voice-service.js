(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
(function (root) {
  'use strict';

  const Buffer = require('buffer').Buffer;
  const qs = require('qs');
  const httpMessageParser = require('http-message-parser');

  if (!navigator.getUserMedia) {
    navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia;
  }

  const AMAZON_ERROR_CODES = {
    InvalidAccessTokenException: 'com.amazon.alexahttpproxy.exceptions.InvalidAccessTokenException'
  };

  class AVS {
    constructor(options = {}) {
      observable(this);

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
      this._refreshToken = null;
      this._clientId = null;
      this._clientSecret = null;
      this._deviceId = null;
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
    }

    _log(type, message) {
      if (type && !message) {
        message = type;
        type = 'log';
      }

      setTimeout(() => {
        this.emit('log', message);
      }, 0);

      if (this._debug) {
        console[type](message);
      }
    }

    login(options = {}) {
      return this.promptUserLogin(options);
    }

    logout() {
      return new Promise((resolve, reject) => {
        this._token = null;
        this._refreshToken = null;
        this.emit('logout');
        this._log('Loggedout');
        resolve();
      });
    }

    promptUserLogin(options = { responseType: 'token', newWindow: false }) {
      return new Promise((resolve, reject) => {
        if (typeof options.responseType === 'undefined') {
          options.responseType = 'token';
        }

        if (typeof options.responseType !== 'string') {
          const error = new Error('`responseType` must a string.');
          this._log(error);
          return reject(error);
        }

        const newWindow = !!options.newWindow;

        const responseType = options.responseType;

        if (!(responseType === 'code' || responseType === 'token')) {
          const error = new Error('`responseType` must be either `code` or `token`.');
          this._log(error);
          return reject(error);
        }

        const scope = 'alexa:all';
        const scopeData = {
          [scope]: {
            productID: this._deviceId,
            productInstanceAttributes: {
              deviceSerialNumber: this._deviceSerialNumber
            }
          }
        };

        const authUrl = `https://www.amazon.com/ap/oa?client_id=${ this._clientId }&scope=${ encodeURIComponent(scope) }&scope_data=${ encodeURIComponent(JSON.stringify(scopeData)) }&response_type=${ responseType }&redirect_uri=${ encodeURI(this._redirectUri) }`;

        if (newWindow) {
          window.open(authUrl);
        } else {
          window.location.href = authUrl;
        }
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
        const postData = `grant_type=${ grantType }&code=${ code }&client_id=${ this._clientId }&client_secret=${ this._clientSecret }&redirect_uri=${ encodeURIComponent(this._redirectUri) }`;
        const url = 'https://api.amazon.com/auth/o2/token';

        const xhr = new XMLHttpRequest();

        xhr.open('POST', url, true);
        xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded;charset=UTF-8');
        xhr.onload = event => {
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

          this.setToken(token);
          this.setRefreshToken(refreshToken);

          this.emit('login');
          this._log('Logged in.');
          resolve(response);
        };

        xhr.onerror = error => {
          this._log(error);
          reject(error);
        };

        xhr.send(postData);
      });
    }

    refreshToken() {
      return this.getTokenFromRefreshToken(this._refreshToken).then(() => {
        return {
          token: this._token,
          refreshToken: this._refreshToken
        };
      });
    }

    getTokenFromRefreshToken(refreshToken = this._refreshToken) {
      return new Promise((resolve, reject) => {
        if (typeof refreshToken !== 'string') {
          const error = new Error('`refreshToken` must a string.');
          this._log(error);
          return reject(error);
        }

        const grantType = 'refresh_token';
        const postData = `grant_type=${ grantType }&refresh_token=${ refreshToken }&client_id=${ this._clientId }&client_secret=${ this._clientSecret }&redirect_uri=${ encodeURIComponent(this._redirectUri) }`;
        const url = 'https://api.amazon.com/auth/o2/token';
        const xhr = new XMLHttpRequest();

        xhr.open('POST', url, true);
        xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded;charset=UTF-8');
        xhr.responseType = 'json';
        xhr.onload = event => {
          const response = xhr.response;

          if (response.error) {
            const error = response.error.message;
            this.emit('error', error);

            return reject(error);
          } else {
            const token = response.access_token;
            const refreshToken = response.refresh_token;

            this.setToken(token);
            this.setRefreshToken(refreshToken);

            return resolve(token);
          }
        };

        xhr.onerror = error => {
          this._log(error);
          reject(error);
        };

        xhr.send(postData);
      });
    }

    getTokenFromUrl() {
      return new Promise((resolve, reject) => {
        let queryString = window.location.href.split('?#');

        if (queryString.length === 2) {
          queryString = queryString[1];
        } else {
          queryString = window.location.search.substr(1);
        }

        const query = qs.parse(queryString);
        const token = query.access_token;
        const refreshToken = query.refresh_token;
        const tokenType = query.token_type;
        const expiresIn = query.expiresIn;

        if (token) {
          this.setToken(token);
          this.emit('login');
          this._log('Logged in.');

          if (refreshToken) {
            this.setRefreshToken(refreshToken);
          }

          return resolve(token);
        }

        return reject(null);
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
          this.emit('tokenSet');
          this._log('Token set.');
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
          this.emit('refreshTokenSet');
          this._log('Refresh token set.');
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

    getToken() {
      return new Promise((resolve, reject) => {
        const token = this._token;

        if (token) {
          return resolve(token);
        }

        return reject();
      });
    }

    getRefreshToken() {
      return new Promise((resolve, reject) => {
        const refreshToken = this._refreshToken;

        if (refreshToken) {
          return resolve(refreshToken);
        }

        return reject();
      });
    }

    requestMic() {
      return new Promise((resolve, reject) => {
        this._log('Requesting microphone.');
        navigator.getUserMedia({
          audio: true
        }, stream => {
          this._log('Microphone connected.');
          return this.connectMediaStream(stream).then(() => {
            return resolve(stream);
          });
        }, error => {
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
          const error = new TypeError('Argument must be a `MediaStream` object.');
          this._log('error', error);
          this.emit('error', error);
          return reject(error);
        }

        this._audioContext = new AudioContext();
        this._sampleRate = this._audioContext.sampleRate;

        this._log(`Sample rate: ${ this._sampleRate }.`);

        this._volumeNode = this._audioContext.createGain();
        this._audioInput = this._audioContext.createMediaStreamSource(stream);

        this._audioInput.connect(this._volumeNode);

        this._recorder = this._audioContext.createScriptProcessor(this._bufferSize, this._inputChannels, this._outputChannels);

        this._recorder.onaudioprocess = event => {
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

        for (let i = 0; i < length; i++) {
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

        audio.onload = event => {
          URL.revokeObjectUrl(objectUrl);
        };

        this._log('Audio play started.');
        audio.play();

        resolve();
      });
    }

    sendAudio(dataView) {
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        const url = 'https://access-alexa-na.amazon.com/v1/avs/speechrecognizer/recognize';

        xhr.open('POST', url, true);
        xhr.responseType = 'arraybuffer';
        xhr.onload = event => {
          console.log('RESPONSE', xhr.response);

          const buffer = new Buffer(xhr.response);

          if (xhr.status === 200) {
            const parsedMessage = httpMessageParser(buffer);
            resolve(parsedMessage);
          } else {
            let error = new Error('An error occured with request.');
            let response = {};

            if (!xhr.response.byteLength) {
              error = new Error('Empty response.');
            } else {
              try {
                response = JSON.parse(Helpers.arrayBufferToString(buffer));
              } catch (err) {
                error = err;
              }
            }

            if (response.error instanceof Object) {
              if (response.error.code) {
                // refresh token?
              }

              error = response.error.message;
            }

            this.emit('error', error);
            return reject(error);
          }
        };

        xhr.onerror = error => {
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

        const metadata = {
          messageHeader: {},
          messageBody: {
            profile: 'alexa-close-talk',
            locale: 'en-us',
            format: 'audio/L16; rate=16000; channels=1'
          }
        };

        const postDataStart = [NEWLINE, BOUNDARY_DASHES, BOUNDARY, NEWLINE, METADATA_CONTENT_DISPOSITION, NEWLINE, METADATA_CONTENT_TYPE, NEWLINE, NEWLINE, JSON.stringify(metadata), NEWLINE, BOUNDARY_DASHES, BOUNDARY, NEWLINE, AUDIO_CONTENT_DISPOSITION, NEWLINE, AUDIO_CONTENT_TYPE, NEWLINE, NEWLINE].join('');

        const postDataEnd = [NEWLINE, BOUNDARY_DASHES, BOUNDARY, BOUNDARY_DASHES, NEWLINE].join('');

        const size = postDataStart.length + dataView.byteLength + postDataEnd.length;
        const uint8Array = new Uint8Array(size);
        let i = 0;

        for (; i < postDataStart.length; i++) {
          uint8Array[i] = postDataStart.charCodeAt(i) & 0xFF;
        }

        for (let j = 0; j < dataView.byteLength; i++, j++) {
          uint8Array[i] = dataView.getUint8(j);
        }

        for (let j = 0; j < postDataEnd.length; i++, j++) {
          uint8Array[i] = postDataEnd.charCodeAt(j) & 0xFF;
        }

        const payload = uint8Array.buffer;

        xhr.setRequestHeader('Authorization', `Bearer ${ this._token }`);
        xhr.setRequestHeader('Content-Type', 'multipart/form-data; boundary=' + BOUNDARY);
        xhr.send(payload);
      });
    }

    static get EventTypes() {
      return {
        LOG: 'log',
        ERROR: 'error',
        LOGIN: 'login',
        LOGOUT: 'logout',
        RECORD_START: 'recordStart',
        RECORD_STOP: 'recordStop',
        TOKEN_SET: 'tokenSet',
        REFRESH_TOKEN_SET: 'refreshTokenSet'
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
    static interleave(leftChannel, rightChannel) {
      if (leftChannel && !rightChannel) {
        return leftChannel;
      }

      const length = leftChannel.length + rightChannel.length;
      let result = new Float32Array(length);
      let inputIndex = 0;

      for (let index = 0; index < length;) {
        result[index++] = leftChannel[inputIndex];
        result[index++] = rightChannel[inputIndex];
        inputIndex++;
      }

      return result;
    }

    /**
     * @credit https://github.com/mattdiamond/Recorderjs
     */
    static mergeBuffers(channelBuffer, recordingLength) {
      const result = new Float32Array(recordingLength);
      const length = channelBuffer.length;
      let offset = 0;

      for (let i = 0; i < length; i++) {
        let buffer = channelBuffer[i];

        result.set(buffer, offset);
        offset += buffer.length;
      }

      return result;
    }

    /**
     * @credit https://github.com/mattdiamond/Recorderjs
     */
    static writeUTFBytes(view, offset, string) {
      const length = string.length;

      for (let i = 0; i < length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    }

    /**
     * @credit https://developers.google.com/web/updates/2012/06/How-to-convert-ArrayBuffer-to-and-from-String?hl=en
     */
    static arrayBufferToString(buffer) {
      return String.fromCharCode.apply(null, new Uint16Array(buffer));
    }
  }

  function observable(el) {
    let callbacks = {};

    el.on = function (name, fn) {
      if (typeof fn !== 'function') {
        throw new TypeError('Second argument for "on" method must be a function.');
      }

      (callbacks[name] = callbacks[name] || []).push(fn);

      return el;
    };

    el.one = function (name, fn) {
      fn.one = true;
      return el.on.call(el, name, fn);
    };

    el.off = function (name, fn) {
      if (name === '*') {
        callbacks = {};
        return callbacks;
      }

      if (!callbacks[name]) {
        return false;
      }

      if (fn) {
        if (typeof fn !== 'function') {
          throw new TypeError('Second argument for "off" method must be a function.');
        }

        callbacks[name] = callbacks[name].map(function (fm, i) {
          if (fm === fn) {
            callbacks[name].splice(i, 1);
          }
        });
      } else {
        delete callbacks[name];
      }
    };

    el.emit = function (name /*, args */) {
      if (!callbacks[name] || !callbacks[name].length) {
        return;
      }

      const args = [].slice.call(arguments, 1);

      callbacks[name].forEach(function (fn, i) {
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
    define([], function () {
      return AVS;
    });
  } else {
    root.AVS = AVS;
  }
})(this);

},{"buffer":8,"http-message-parser":3,"qs":4}],2:[function(require,module,exports){
const AVS = require('../avs');
const player = AVS.Player;

const avs = new AVS({
  debug: true,
  clientId: 'amzn1.application-oa2-client.696ab90fc5844fdbb8efc17394a79c00',
  deviceId: 'test_device',
  deviceSerialNumber: 123,
  redirectUri: `https://${ window.location.host }/authresponse`
});

avs.on(AVS.EventTypes.TOKEN_SET, () => {
  login.disabled = true;
  logout.disabled = false;
  start.disabled = false;
  stop.disabled = true;
});

avs.on(AVS.EventTypes.RECORD_START, () => {
  start.disabled = true;
  stop.disabled = false;
});

avs.on(AVS.EventTypes.RECORD_STOP, () => {
  start.disabled = false;
  stop.disabled = true;
});

avs.on(AVS.EventTypes.LOGOUT, () => {
  login.disabled = false;
  logout.disabled = true;
  start.disabled = true;
  stop.disabled = true;
});

avs.on(AVS.EventTypes.LOG, message => {
  logOutput.innerHTML += `<li>LOG: ${ message }</li>`;
});

avs.on(AVS.EventTypes.ERROR, error => {
  logOutput.innerHTML += `<li>ERROR: ${ error }</li>`;
});

const login = document.getElementById('login');
const logout = document.getElementById('logout');
const logOutput = document.getElementById('log');
const start = document.getElementById('start');
const stop = document.getElementById('stop');

/*
// If using client secret
avs.getCodeFromUrl()
 .then(code => avs.getTokenFromCode(code))
.then(token => localStorage.setItem('token', token))
.then(refreshToken => localStorage.setItem('refreshToken', refreshToken))
.then(() => avs.requestMic())
.then(() => avs.refreshToken())
.catch(() => {

});
*/

avs.getTokenFromUrl().then(() => avs.getToken()).then(token => localStorage.setItem('token', token)).then(() => avs.requestMic()).catch(() => {
  const cachedToken = localStorage.getItem('token');

  if (cachedToken) {
    avs.setToken(cachedToken);
    return avs.requestMic();
  }
});

login.addEventListener('click', event => {
  avs.login().then(() => avs.requestMic()).catch(() => {});

  /*
  // If using client secret
  avs.login({responseType: 'code'})
  .then(() => avs.requestMic())
  .catch(() => {});
  */
});

logout.addEventListener('click', () => {
  avs.logout().then(() => {
    localStorage.removeItem('token');
    window.location.hash = '';
  });
});

start.addEventListener('click', () => {
  avs.startRecording();
});

stop.addEventListener('click', () => {
  avs.stopRecording().then(dataView => {
    const blob = new Blob([dataView], {
      type: 'audio/wav'
    });

    avs.playBlob(blob);
    //sendBlob(blob);
    avs.sendAudio(dataView).then(response => {

      window.AudioContext = window.AudioContext || window.webkitAudioContext;
      const context = new AudioContext();

      const int8 = response.multipart[1].body;
      const dst = new ArrayBuffer(int8.byteLength);
      new Uint8Array(dst).set(new Uint8Array(int8));

      context.decodeAudioData(dst, function (buffer) {
        playSound(buffer);
      }, () => {});

      function playSound(buffer) {
        const source = context.createBufferSource();
        source.buffer = buffer;
        source.connect(context.destination);
        source.start(0);
      }
    });
  });
});

function sendBlob(blob) {
  const xhr = new XMLHttpRequest();
  const fd = new FormData();

  fd.append('fname', 'audio.wav');
  fd.append('data', blob);

  xhr.open('POST', 'http://localhost:5555/audio', true);
  xhr.responseType = 'blob';

  xhr.onload = event => {
    if (xhr.status == 200) {
      console.log(xhr.response);
      //const responseBlob = new Blob([xhr.response], {type: 'audio/mp3'});
    }
  };
  xhr.send(fd);
}

},{"../avs":1}],3:[function(require,module,exports){
(function (global,Buffer){
(function(root) {
  'use strict';

  function httpMessageParser(message) {
    const result = {
      httpVersion: null,
      statusCode: null,
      statusMessage: null,
      method: null,
      url: null,
      headers: null,
      body: null,
      boundary: null,
      multipart: null
    };

    var messageString = '';
    var headerNewlineIndex = 0;
    var fullBoundary = null;

    if (httpMessageParser._isBuffer(message)) {
      messageString = message.toString();
    } else if (typeof message === 'string') {
      messageString = message;
      message = httpMessageParser._createBuffer(messageString);
    } else {
      return result;
    }

    /*
     * Strip extra return characters
     */
    messageString = messageString.replace(/\r\n/gim, '\n');

    /*
     * Trim leading whitespace
     */
    (function() {
      const firstNonWhitespaceRegex = /[\w-]+/gim;
      const firstNonWhitespaceIndex = messageString.search(firstNonWhitespaceRegex);
      if (firstNonWhitespaceIndex > 0) {
        message = message.slice(firstNonWhitespaceIndex, message.length);
        messageString = message.toString();
      }
    })();

    /* Parse request line
     */
    (function() {
      const possibleRequestLine = messageString.split(/\n|\r\n/)[0];
      const requestLineMatch = possibleRequestLine.match(httpMessageParser._requestLineRegex);

      if (Array.isArray(requestLineMatch) && requestLineMatch.length > 1) {
        result.httpVersion = parseFloat(requestLineMatch[1]);
        result.statusCode = parseInt(requestLineMatch[2]);
        result.statusMessage = requestLineMatch[3];
      } else {
        const responseLineMath = possibleRequestLine.match(httpMessageParser._responseLineRegex);
        if (Array.isArray(responseLineMath) && responseLineMath.length > 1) {
          result.method = responseLineMath[1];
          result.url = responseLineMath[2];
          result.httpVersion = parseFloat(responseLineMath[3]);
        }
      }
    })();

    /* Parse headers
     */
    (function() {
      headerNewlineIndex = messageString.search(httpMessageParser._headerNewlineRegex);
      if (headerNewlineIndex > -1) {
        headerNewlineIndex = headerNewlineIndex + 1; // 1 for newline length
      } else {
        /* There's no line breaks so check if request line exists
         * because the message might be all headers and no body
         */
        if (result.httpVersion) {
          headerNewlineIndex = messageString.length;
        }
      }

      const headersString = messageString.substr(0, headerNewlineIndex);
      const headers = httpMessageParser._parseHeaders(headersString);

      if (Object.keys(headers).length > 0) {
        result.headers = headers;

        // TOOD: extract boundary.
      }
    })();

    /* Try to get boundary if no boundary header
     */
    (function() {
      if (!result.boundary) {
        const boundaryMatch = messageString.match(httpMessageParser._boundaryRegex);

        if (Array.isArray(boundaryMatch) && boundaryMatch.length) {
          fullBoundary = boundaryMatch[0].replace(/[\r\n]+/gi, '');
          const boundary = fullBoundary.replace(/^--/,'');
          result.boundary = boundary;
        }
      }
    })();

    /* Parse body
     */
    (function() {
      var start = headerNewlineIndex;
      var end = message.length;
      const firstBoundaryIndex = messageString.indexOf(fullBoundary);

      if (firstBoundaryIndex > -1) {
        start = headerNewlineIndex;
        end = firstBoundaryIndex;
      }

      if (headerNewlineIndex > -1) {
        const body = message.slice(start, end);

        if (body && body.length) {
          result.body = httpMessageParser._isFakeBuffer(body) ? body.toString() : body;
        }
      }
    })();

    /* Parse multipart sections
     */
    (function() {
      if (result.boundary) {
        const multipartStart = messageString.indexOf(fullBoundary) + fullBoundary.length;
        const multipartEnd = messageString.lastIndexOf(fullBoundary);
        const multipartBody = messageString.substr(multipartStart, multipartEnd);
        const parts = multipartBody.split(fullBoundary);

        result.multipart = parts.filter(httpMessageParser._isTruthy).map(function(part, i) {
          const result = {
            headers: null,
            body: null
          };

          const newlineRegex = /\n\n|\r\n\r\n/gim;
          var newlineIndex = 0;
          var newlineMatch = newlineRegex.exec(part);
          var body = null;

          if (newlineMatch) {
            newlineIndex = newlineMatch.index;
            if (newlineMatch.index <= 0) {
              newlineMatch = newlineRegex.exec(part);
              if (newlineMatch) {
                newlineIndex = newlineMatch.index;
              }
            }
          }

          const possibleHeadersString = part.substr(0, newlineIndex);

          if (newlineIndex > -1) {
            const headers = httpMessageParser._parseHeaders(possibleHeadersString);
            if (Object.keys(headers).length > 0) {
              result.headers = headers;

              var boundaryIndexes = [];
              for (var j = 0; j < message.length; j++) {
                var boundaryMatch = message.slice(j, j + fullBoundary.length).toString();

                if (boundaryMatch === fullBoundary) {
                  boundaryIndexes.push(j);
                }
              }

              var boundaryNewlineIndexes = [];
              boundaryIndexes.slice(0, boundaryIndexes.length - 1).forEach(function(m, k) {
                const partBody = message.slice(boundaryIndexes[k], boundaryIndexes[k + 1]).toString();
                var headerNewlineIndex = partBody.search(/\n\n|\r\n\r\n/gim) + 2;
                headerNewlineIndex  = boundaryIndexes[k] + headerNewlineIndex;
                boundaryNewlineIndexes.push(headerNewlineIndex);
              });

              body = message.slice(boundaryNewlineIndexes[i], boundaryIndexes[i + 1]);
            } else {
              body = part;
            }
          } else {
            body = part;
          }

          result.body = httpMessageParser._isFakeBuffer(body) ? body.toString() : body;

          return result;
        });
      }
    })();

    return result;
  }

  httpMessageParser._isTruthy = function _isTruthy(v) {
    return !!v;
  };

  httpMessageParser._isNumeric = function _isNumeric(v) {
    if (typeof v === 'number' && !isNaN(v)) {
      return true;
    }

    v = (v||'').toString().trim();

    if (!v) {
      return false;
    }

    return !isNaN(v);
  };

  httpMessageParser._isBuffer = function(item) {
    return ((httpMessageParser._isNodeBufferSupported() &&
            typeof global === 'object' &&
            global.Buffer.isBuffer(item)) ||
            (item instanceof Object &&
             item._isBuffer));
  };

  httpMessageParser._isNodeBufferSupported = function() {
    return (typeof global === 'object' &&
            typeof global.Buffer === 'function' &&
            typeof global.Buffer.isBuffer === 'function');
  };

  httpMessageParser._parseHeaders = function _parseHeaders(body) {
    const headers = {};

    if (typeof body !== 'string') {
      return headers;
    }

    body.split(/[\r\n]/).forEach(function(string) {
      const match = string.match(/([\w-]+):\s*(.*)/i);

      if (Array.isArray(match) && match.length === 3) {
        const key = match[1];
        const value = match[2];

        headers[key] = httpMessageParser._isNumeric(value) ? Number(value) : value;
      }
    });

    return headers;
  };

  httpMessageParser._requestLineRegex = /HTTP\/(1\.0|1\.1|2\.0)\s+(\d+)\s+([\w\s-_]+)/i;
  httpMessageParser._responseLineRegex = /(GET|POST|PUT|DELETE|PATCH|OPTIONS|HEAD|TRACE|CONNECT)\s+(.*)\s+HTTP\/(1\.0|1\.1|2\.0)/i;
  httpMessageParser._headerNewlineRegex = /^[\r\n]+/gim;
  httpMessageParser._boundaryRegex = /(\n|\r\n)+--[\w-]+(\n|\r\n)+/g;

  httpMessageParser._createBuffer = function(data) {
    if (httpMessageParser._isNodeBufferSupported()) {
      return new Buffer(data);
    }

    return new httpMessageParser._FakeBuffer(data);
  };

  httpMessageParser._isFakeBuffer = function isFakeBuffer(obj) {
    return obj instanceof httpMessageParser._FakeBuffer;
  };

  httpMessageParser._FakeBuffer = function FakeBuffer(data) {
    if (!(this instanceof httpMessageParser._FakeBuffer)) {
      return new httpMessageParser._FakeBuffer(data);
    }

    this.data = [];

    if (Array.isArray(data)) {
      this.data = data;
    } else if (typeof data === 'string') {
      this.data = [].slice.call(data);
    }

    function LiveObject() {}
    Object.defineProperty(LiveObject.prototype, 'length', {
      get: function() {
        return this.data.length;
      }.bind(this)
    });

    this.length = (new LiveObject()).length;
  };

  httpMessageParser._FakeBuffer.prototype.slice = function slice() {
    var newArray = [].slice.apply(this.data, arguments);
    return new httpMessageParser._FakeBuffer(newArray);
  };

  httpMessageParser._FakeBuffer.prototype.search = function search() {
    return [].search.apply(this.data, arguments);
  };

  httpMessageParser._FakeBuffer.prototype.indexOf = function indexOf() {
    return [].indexOf.apply(this.data, arguments);
  };

  httpMessageParser._FakeBuffer.prototype.toString = function toString() {
    return this.data.join('');
  };

  if (typeof exports !== 'undefined') {
    if (typeof module !== 'undefined' && module.exports) {
      exports = module.exports = httpMessageParser;
    }
    exports.httpMessageParser = httpMessageParser;
  } else if (typeof define === 'function' && define.amd) {
    define([], function() {
      return httpMessageParser;
    });
  } else {
    root.httpMessageParser = httpMessageParser;
  }

})(this);

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer)

},{"buffer":8}],4:[function(require,module,exports){
'use strict';

var Stringify = require('./stringify');
var Parse = require('./parse');

module.exports = {
    stringify: Stringify,
    parse: Parse
};

},{"./parse":5,"./stringify":6}],5:[function(require,module,exports){
'use strict';

var Utils = require('./utils');

var internals = {
    delimiter: '&',
    depth: 5,
    arrayLimit: 20,
    parameterLimit: 1000,
    strictNullHandling: false,
    plainObjects: false,
    allowPrototypes: false,
    allowDots: false
};

internals.parseValues = function (str, options) {
    var obj = {};
    var parts = str.split(options.delimiter, options.parameterLimit === Infinity ? undefined : options.parameterLimit);

    for (var i = 0; i < parts.length; ++i) {
        var part = parts[i];
        var pos = part.indexOf(']=') === -1 ? part.indexOf('=') : part.indexOf(']=') + 1;

        if (pos === -1) {
            obj[Utils.decode(part)] = '';

            if (options.strictNullHandling) {
                obj[Utils.decode(part)] = null;
            }
        } else {
            var key = Utils.decode(part.slice(0, pos));
            var val = Utils.decode(part.slice(pos + 1));

            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                obj[key] = [].concat(obj[key]).concat(val);
            } else {
                obj[key] = val;
            }
        }
    }

    return obj;
};

internals.parseObject = function (chain, val, options) {
    if (!chain.length) {
        return val;
    }

    var root = chain.shift();

    var obj;
    if (root === '[]') {
        obj = [];
        obj = obj.concat(internals.parseObject(chain, val, options));
    } else {
        obj = options.plainObjects ? Object.create(null) : {};
        var cleanRoot = root[0] === '[' && root[root.length - 1] === ']' ? root.slice(1, root.length - 1) : root;
        var index = parseInt(cleanRoot, 10);
        if (
            !isNaN(index) &&
            root !== cleanRoot &&
            String(index) === cleanRoot &&
            index >= 0 &&
            (options.parseArrays && index <= options.arrayLimit)
        ) {
            obj = [];
            obj[index] = internals.parseObject(chain, val, options);
        } else {
            obj[cleanRoot] = internals.parseObject(chain, val, options);
        }
    }

    return obj;
};

internals.parseKeys = function (givenKey, val, options) {
    if (!givenKey) {
        return;
    }

    // Transform dot notation to bracket notation
    var key = options.allowDots ? givenKey.replace(/\.([^\.\[]+)/g, '[$1]') : givenKey;

    // The regex chunks

    var parent = /^([^\[\]]*)/;
    var child = /(\[[^\[\]]*\])/g;

    // Get the parent

    var segment = parent.exec(key);

    // Stash the parent if it exists

    var keys = [];
    if (segment[1]) {
        // If we aren't using plain objects, optionally prefix keys
        // that would overwrite object prototype properties
        if (!options.plainObjects && Object.prototype.hasOwnProperty(segment[1])) {
            if (!options.allowPrototypes) {
                return;
            }
        }

        keys.push(segment[1]);
    }

    // Loop through children appending to the array until we hit depth

    var i = 0;
    while ((segment = child.exec(key)) !== null && i < options.depth) {
        i += 1;
        if (!options.plainObjects && Object.prototype.hasOwnProperty(segment[1].replace(/\[|\]/g, ''))) {
            if (!options.allowPrototypes) {
                continue;
            }
        }
        keys.push(segment[1]);
    }

    // If there's a remainder, just add whatever is left

    if (segment) {
        keys.push('[' + key.slice(segment.index) + ']');
    }

    return internals.parseObject(keys, val, options);
};

module.exports = function (str, opts) {
    var options = opts || {};
    options.delimiter = typeof options.delimiter === 'string' || Utils.isRegExp(options.delimiter) ? options.delimiter : internals.delimiter;
    options.depth = typeof options.depth === 'number' ? options.depth : internals.depth;
    options.arrayLimit = typeof options.arrayLimit === 'number' ? options.arrayLimit : internals.arrayLimit;
    options.parseArrays = options.parseArrays !== false;
    options.allowDots = typeof options.allowDots === 'boolean' ? options.allowDots : internals.allowDots;
    options.plainObjects = typeof options.plainObjects === 'boolean' ? options.plainObjects : internals.plainObjects;
    options.allowPrototypes = typeof options.allowPrototypes === 'boolean' ? options.allowPrototypes : internals.allowPrototypes;
    options.parameterLimit = typeof options.parameterLimit === 'number' ? options.parameterLimit : internals.parameterLimit;
    options.strictNullHandling = typeof options.strictNullHandling === 'boolean' ? options.strictNullHandling : internals.strictNullHandling;

    if (
        str === '' ||
        str === null ||
        typeof str === 'undefined'
    ) {
        return options.plainObjects ? Object.create(null) : {};
    }

    var tempObj = typeof str === 'string' ? internals.parseValues(str, options) : str;
    var obj = options.plainObjects ? Object.create(null) : {};

    // Iterate over the keys and setup the new object

    var keys = Object.keys(tempObj);
    for (var i = 0; i < keys.length; ++i) {
        var key = keys[i];
        var newObj = internals.parseKeys(key, tempObj[key], options);
        obj = Utils.merge(obj, newObj, options);
    }

    return Utils.compact(obj);
};

},{"./utils":7}],6:[function(require,module,exports){
'use strict';

var Utils = require('./utils');

var internals = {
    delimiter: '&',
    arrayPrefixGenerators: {
        brackets: function (prefix) {
            return prefix + '[]';
        },
        indices: function (prefix, key) {
            return prefix + '[' + key + ']';
        },
        repeat: function (prefix) {
            return prefix;
        }
    },
    strictNullHandling: false,
    skipNulls: false,
    encode: true
};

internals.stringify = function (object, prefix, generateArrayPrefix, strictNullHandling, skipNulls, encode, filter, sort, allowDots) {
    var obj = object;
    if (typeof filter === 'function') {
        obj = filter(prefix, obj);
    } else if (Utils.isBuffer(obj)) {
        obj = String(obj);
    } else if (obj instanceof Date) {
        obj = obj.toISOString();
    } else if (obj === null) {
        if (strictNullHandling) {
            return encode ? Utils.encode(prefix) : prefix;
        }

        obj = '';
    }

    if (typeof obj === 'string' || typeof obj === 'number' || typeof obj === 'boolean') {
        if (encode) {
            return [Utils.encode(prefix) + '=' + Utils.encode(obj)];
        }
        return [prefix + '=' + obj];
    }

    var values = [];

    if (typeof obj === 'undefined') {
        return values;
    }

    var objKeys;
    if (Array.isArray(filter)) {
        objKeys = filter;
    } else {
        var keys = Object.keys(obj);
        objKeys = sort ? keys.sort(sort) : keys;
    }

    for (var i = 0; i < objKeys.length; ++i) {
        var key = objKeys[i];

        if (skipNulls && obj[key] === null) {
            continue;
        }

        if (Array.isArray(obj)) {
            values = values.concat(internals.stringify(obj[key], generateArrayPrefix(prefix, key), generateArrayPrefix, strictNullHandling, skipNulls, encode, filter, sort, allowDots));
        } else {
            values = values.concat(internals.stringify(obj[key], prefix + (allowDots ? '.' + key : '[' + key + ']'), generateArrayPrefix, strictNullHandling, skipNulls, encode, filter, sort, allowDots));
        }
    }

    return values;
};

module.exports = function (object, opts) {
    var obj = object;
    var options = opts || {};
    var delimiter = typeof options.delimiter === 'undefined' ? internals.delimiter : options.delimiter;
    var strictNullHandling = typeof options.strictNullHandling === 'boolean' ? options.strictNullHandling : internals.strictNullHandling;
    var skipNulls = typeof options.skipNulls === 'boolean' ? options.skipNulls : internals.skipNulls;
    var encode = typeof options.encode === 'boolean' ? options.encode : internals.encode;
    var sort = typeof options.sort === 'function' ? options.sort : null;
    var allowDots = typeof options.allowDots === 'undefined' ? false : options.allowDots;
    var objKeys;
    var filter;
    if (typeof options.filter === 'function') {
        filter = options.filter;
        obj = filter('', obj);
    } else if (Array.isArray(options.filter)) {
        objKeys = filter = options.filter;
    }

    var keys = [];

    if (typeof obj !== 'object' || obj === null) {
        return '';
    }

    var arrayFormat;
    if (options.arrayFormat in internals.arrayPrefixGenerators) {
        arrayFormat = options.arrayFormat;
    } else if ('indices' in options) {
        arrayFormat = options.indices ? 'indices' : 'repeat';
    } else {
        arrayFormat = 'indices';
    }

    var generateArrayPrefix = internals.arrayPrefixGenerators[arrayFormat];

    if (!objKeys) {
        objKeys = Object.keys(obj);
    }

    if (sort) {
        objKeys.sort(sort);
    }

    for (var i = 0; i < objKeys.length; ++i) {
        var key = objKeys[i];

        if (skipNulls && obj[key] === null) {
            continue;
        }

        keys = keys.concat(internals.stringify(obj[key], key, generateArrayPrefix, strictNullHandling, skipNulls, encode, filter, sort, allowDots));
    }

    return keys.join(delimiter);
};

},{"./utils":7}],7:[function(require,module,exports){
'use strict';

var hexTable = (function () {
    var array = new Array(256);
    for (var i = 0; i < 256; ++i) {
        array[i] = '%' + ((i < 16 ? '0' : '') + i.toString(16)).toUpperCase();
    }

    return array;
}());

exports.arrayToObject = function (source, options) {
    var obj = options.plainObjects ? Object.create(null) : {};
    for (var i = 0; i < source.length; ++i) {
        if (typeof source[i] !== 'undefined') {
            obj[i] = source[i];
        }
    }

    return obj;
};

exports.merge = function (target, source, options) {
    if (!source) {
        return target;
    }

    if (typeof source !== 'object') {
        if (Array.isArray(target)) {
            target.push(source);
        } else if (typeof target === 'object') {
            target[source] = true;
        } else {
            return [target, source];
        }

        return target;
    }

    if (typeof target !== 'object') {
        return [target].concat(source);
    }

    var mergeTarget = target;
    if (Array.isArray(target) && !Array.isArray(source)) {
        mergeTarget = exports.arrayToObject(target, options);
    }

	return Object.keys(source).reduce(function (acc, key) {
        var value = source[key];

        if (Object.prototype.hasOwnProperty.call(acc, key)) {
            acc[key] = exports.merge(acc[key], value, options);
        } else {
            acc[key] = value;
        }
		return acc;
    }, mergeTarget);
};

exports.decode = function (str) {
    try {
        return decodeURIComponent(str.replace(/\+/g, ' '));
    } catch (e) {
        return str;
    }
};

exports.encode = function (str) {
    // This code was originally written by Brian White (mscdex) for the io.js core querystring library.
    // It has been adapted here for stricter adherence to RFC 3986
    if (str.length === 0) {
        return str;
    }

    var string = typeof str === 'string' ? str : String(str);

    var out = '';
    for (var i = 0; i < string.length; ++i) {
        var c = string.charCodeAt(i);

        if (
            c === 0x2D || // -
            c === 0x2E || // .
            c === 0x5F || // _
            c === 0x7E || // ~
            (c >= 0x30 && c <= 0x39) || // 0-9
            (c >= 0x41 && c <= 0x5A) || // a-z
            (c >= 0x61 && c <= 0x7A) // A-Z
        ) {
            out += string.charAt(i);
            continue;
        }

        if (c < 0x80) {
            out = out + hexTable[c];
            continue;
        }

        if (c < 0x800) {
            out = out + (hexTable[0xC0 | (c >> 6)] + hexTable[0x80 | (c & 0x3F)]);
            continue;
        }

        if (c < 0xD800 || c >= 0xE000) {
            out = out + (hexTable[0xE0 | (c >> 12)] + hexTable[0x80 | ((c >> 6) & 0x3F)] + hexTable[0x80 | (c & 0x3F)]);
            continue;
        }

        i += 1;
        c = 0x10000 + (((c & 0x3FF) << 10) | (string.charCodeAt(i) & 0x3FF));
        out += (hexTable[0xF0 | (c >> 18)] + hexTable[0x80 | ((c >> 12) & 0x3F)] + hexTable[0x80 | ((c >> 6) & 0x3F)] + hexTable[0x80 | (c & 0x3F)]);
    }

    return out;
};

exports.compact = function (obj, references) {
    if (typeof obj !== 'object' || obj === null) {
        return obj;
    }

    var refs = references || [];
    var lookup = refs.indexOf(obj);
    if (lookup !== -1) {
        return refs[lookup];
    }

    refs.push(obj);

    if (Array.isArray(obj)) {
        var compacted = [];

        for (var i = 0; i < obj.length; ++i) {
            if (typeof obj[i] !== 'undefined') {
                compacted.push(obj[i]);
            }
        }

        return compacted;
    }

    var keys = Object.keys(obj);
    for (var j = 0; j < keys.length; ++j) {
        var key = keys[j];
        obj[key] = exports.compact(obj[key], refs);
    }

    return obj;
};

exports.isRegExp = function (obj) {
    return Object.prototype.toString.call(obj) === '[object RegExp]';
};

exports.isBuffer = function (obj) {
    if (obj === null || typeof obj === 'undefined') {
        return false;
    }

    return !!(obj.constructor && obj.constructor.isBuffer && obj.constructor.isBuffer(obj));
};

},{}],8:[function(require,module,exports){
(function (global){
/*!
 * The buffer module from node.js, for the browser.
 *
 * @author   Feross Aboukhadijeh <feross@feross.org> <http://feross.org>
 * @license  MIT
 */
/* eslint-disable no-proto */

'use strict'

var base64 = require('base64-js')
var ieee754 = require('ieee754')
var isArray = require('isarray')

exports.Buffer = Buffer
exports.SlowBuffer = SlowBuffer
exports.INSPECT_MAX_BYTES = 50
Buffer.poolSize = 8192 // not used by this implementation

var rootParent = {}

/**
 * If `Buffer.TYPED_ARRAY_SUPPORT`:
 *   === true    Use Uint8Array implementation (fastest)
 *   === false   Use Object implementation (most compatible, even IE6)
 *
 * Browsers that support typed arrays are IE 10+, Firefox 4+, Chrome 7+, Safari 5.1+,
 * Opera 11.6+, iOS 4.2+.
 *
 * Due to various browser bugs, sometimes the Object implementation will be used even
 * when the browser supports typed arrays.
 *
 * Note:
 *
 *   - Firefox 4-29 lacks support for adding new properties to `Uint8Array` instances,
 *     See: https://bugzilla.mozilla.org/show_bug.cgi?id=695438.
 *
 *   - Chrome 9-10 is missing the `TypedArray.prototype.subarray` function.
 *
 *   - IE10 has a broken `TypedArray.prototype.subarray` function which returns arrays of
 *     incorrect length in some situations.

 * We detect these buggy browsers and set `Buffer.TYPED_ARRAY_SUPPORT` to `false` so they
 * get the Object implementation, which is slower but behaves correctly.
 */
Buffer.TYPED_ARRAY_SUPPORT = global.TYPED_ARRAY_SUPPORT !== undefined
  ? global.TYPED_ARRAY_SUPPORT
  : typedArraySupport()

function typedArraySupport () {
  try {
    var arr = new Uint8Array(1)
    arr.foo = function () { return 42 }
    return arr.foo() === 42 && // typed array instances can be augmented
        typeof arr.subarray === 'function' && // chrome 9-10 lack `subarray`
        arr.subarray(1, 1).byteLength === 0 // ie10 has broken `subarray`
  } catch (e) {
    return false
  }
}

function kMaxLength () {
  return Buffer.TYPED_ARRAY_SUPPORT
    ? 0x7fffffff
    : 0x3fffffff
}

/**
 * The Buffer constructor returns instances of `Uint8Array` that have their
 * prototype changed to `Buffer.prototype`. Furthermore, `Buffer` is a subclass of
 * `Uint8Array`, so the returned instances will have all the node `Buffer` methods
 * and the `Uint8Array` methods. Square bracket notation works as expected -- it
 * returns a single octet.
 *
 * The `Uint8Array` prototype remains unmodified.
 */
function Buffer (arg) {
  if (!(this instanceof Buffer)) {
    // Avoid going through an ArgumentsAdaptorTrampoline in the common case.
    if (arguments.length > 1) return new Buffer(arg, arguments[1])
    return new Buffer(arg)
  }

  if (!Buffer.TYPED_ARRAY_SUPPORT) {
    this.length = 0
    this.parent = undefined
  }

  // Common case.
  if (typeof arg === 'number') {
    return fromNumber(this, arg)
  }

  // Slightly less common case.
  if (typeof arg === 'string') {
    return fromString(this, arg, arguments.length > 1 ? arguments[1] : 'utf8')
  }

  // Unusual.
  return fromObject(this, arg)
}

// TODO: Legacy, not needed anymore. Remove in next major version.
Buffer._augment = function (arr) {
  arr.__proto__ = Buffer.prototype
  return arr
}

function fromNumber (that, length) {
  that = allocate(that, length < 0 ? 0 : checked(length) | 0)
  if (!Buffer.TYPED_ARRAY_SUPPORT) {
    for (var i = 0; i < length; i++) {
      that[i] = 0
    }
  }
  return that
}

function fromString (that, string, encoding) {
  if (typeof encoding !== 'string' || encoding === '') encoding = 'utf8'

  // Assumption: byteLength() return value is always < kMaxLength.
  var length = byteLength(string, encoding) | 0
  that = allocate(that, length)

  that.write(string, encoding)
  return that
}

function fromObject (that, object) {
  if (Buffer.isBuffer(object)) return fromBuffer(that, object)

  if (isArray(object)) return fromArray(that, object)

  if (object == null) {
    throw new TypeError('must start with number, buffer, array or string')
  }

  if (typeof ArrayBuffer !== 'undefined') {
    if (object.buffer instanceof ArrayBuffer) {
      return fromTypedArray(that, object)
    }
    if (object instanceof ArrayBuffer) {
      return fromArrayBuffer(that, object)
    }
  }

  if (object.length) return fromArrayLike(that, object)

  return fromJsonObject(that, object)
}

function fromBuffer (that, buffer) {
  var length = checked(buffer.length) | 0
  that = allocate(that, length)
  buffer.copy(that, 0, 0, length)
  return that
}

function fromArray (that, array) {
  var length = checked(array.length) | 0
  that = allocate(that, length)
  for (var i = 0; i < length; i += 1) {
    that[i] = array[i] & 255
  }
  return that
}

// Duplicate of fromArray() to keep fromArray() monomorphic.
function fromTypedArray (that, array) {
  var length = checked(array.length) | 0
  that = allocate(that, length)
  // Truncating the elements is probably not what people expect from typed
  // arrays with BYTES_PER_ELEMENT > 1 but it's compatible with the behavior
  // of the old Buffer constructor.
  for (var i = 0; i < length; i += 1) {
    that[i] = array[i] & 255
  }
  return that
}

function fromArrayBuffer (that, array) {
  array.byteLength // this throws if `array` is not a valid ArrayBuffer

  if (Buffer.TYPED_ARRAY_SUPPORT) {
    // Return an augmented `Uint8Array` instance, for best performance
    that = new Uint8Array(array)
    that.__proto__ = Buffer.prototype
  } else {
    // Fallback: Return an object instance of the Buffer class
    that = fromTypedArray(that, new Uint8Array(array))
  }
  return that
}

function fromArrayLike (that, array) {
  var length = checked(array.length) | 0
  that = allocate(that, length)
  for (var i = 0; i < length; i += 1) {
    that[i] = array[i] & 255
  }
  return that
}

// Deserialize { type: 'Buffer', data: [1,2,3,...] } into a Buffer object.
// Returns a zero-length buffer for inputs that don't conform to the spec.
function fromJsonObject (that, object) {
  var array
  var length = 0

  if (object.type === 'Buffer' && isArray(object.data)) {
    array = object.data
    length = checked(array.length) | 0
  }
  that = allocate(that, length)

  for (var i = 0; i < length; i += 1) {
    that[i] = array[i] & 255
  }
  return that
}

if (Buffer.TYPED_ARRAY_SUPPORT) {
  Buffer.prototype.__proto__ = Uint8Array.prototype
  Buffer.__proto__ = Uint8Array
  if (typeof Symbol !== 'undefined' && Symbol.species &&
      Buffer[Symbol.species] === Buffer) {
    // Fix subarray() in ES2016. See: https://github.com/feross/buffer/pull/97
    Object.defineProperty(Buffer, Symbol.species, {
      value: null,
      configurable: true
    })
  }
} else {
  // pre-set for values that may exist in the future
  Buffer.prototype.length = undefined
  Buffer.prototype.parent = undefined
}

function allocate (that, length) {
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    // Return an augmented `Uint8Array` instance, for best performance
    that = new Uint8Array(length)
    that.__proto__ = Buffer.prototype
  } else {
    // Fallback: Return an object instance of the Buffer class
    that.length = length
  }

  var fromPool = length !== 0 && length <= Buffer.poolSize >>> 1
  if (fromPool) that.parent = rootParent

  return that
}

function checked (length) {
  // Note: cannot use `length < kMaxLength` here because that fails when
  // length is NaN (which is otherwise coerced to zero.)
  if (length >= kMaxLength()) {
    throw new RangeError('Attempt to allocate Buffer larger than maximum ' +
                         'size: 0x' + kMaxLength().toString(16) + ' bytes')
  }
  return length | 0
}

function SlowBuffer (subject, encoding) {
  if (!(this instanceof SlowBuffer)) return new SlowBuffer(subject, encoding)

  var buf = new Buffer(subject, encoding)
  delete buf.parent
  return buf
}

Buffer.isBuffer = function isBuffer (b) {
  return !!(b != null && b._isBuffer)
}

Buffer.compare = function compare (a, b) {
  if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b)) {
    throw new TypeError('Arguments must be Buffers')
  }

  if (a === b) return 0

  var x = a.length
  var y = b.length

  for (var i = 0, len = Math.min(x, y); i < len; ++i) {
    if (a[i] !== b[i]) {
      x = a[i]
      y = b[i]
      break
    }
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
}

Buffer.isEncoding = function isEncoding (encoding) {
  switch (String(encoding).toLowerCase()) {
    case 'hex':
    case 'utf8':
    case 'utf-8':
    case 'ascii':
    case 'binary':
    case 'base64':
    case 'raw':
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      return true
    default:
      return false
  }
}

Buffer.concat = function concat (list, length) {
  if (!isArray(list)) throw new TypeError('list argument must be an Array of Buffers.')

  if (list.length === 0) {
    return new Buffer(0)
  }

  var i
  if (length === undefined) {
    length = 0
    for (i = 0; i < list.length; i++) {
      length += list[i].length
    }
  }

  var buf = new Buffer(length)
  var pos = 0
  for (i = 0; i < list.length; i++) {
    var item = list[i]
    item.copy(buf, pos)
    pos += item.length
  }
  return buf
}

function byteLength (string, encoding) {
  if (typeof string !== 'string') string = '' + string

  var len = string.length
  if (len === 0) return 0

  // Use a for loop to avoid recursion
  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'ascii':
      case 'binary':
      // Deprecated
      case 'raw':
      case 'raws':
        return len
      case 'utf8':
      case 'utf-8':
        return utf8ToBytes(string).length
      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return len * 2
      case 'hex':
        return len >>> 1
      case 'base64':
        return base64ToBytes(string).length
      default:
        if (loweredCase) return utf8ToBytes(string).length // assume utf8
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}
Buffer.byteLength = byteLength

function slowToString (encoding, start, end) {
  var loweredCase = false

  start = start | 0
  end = end === undefined || end === Infinity ? this.length : end | 0

  if (!encoding) encoding = 'utf8'
  if (start < 0) start = 0
  if (end > this.length) end = this.length
  if (end <= start) return ''

  while (true) {
    switch (encoding) {
      case 'hex':
        return hexSlice(this, start, end)

      case 'utf8':
      case 'utf-8':
        return utf8Slice(this, start, end)

      case 'ascii':
        return asciiSlice(this, start, end)

      case 'binary':
        return binarySlice(this, start, end)

      case 'base64':
        return base64Slice(this, start, end)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return utf16leSlice(this, start, end)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = (encoding + '').toLowerCase()
        loweredCase = true
    }
  }
}

// The property is used by `Buffer.isBuffer` and `is-buffer` (in Safari 5-7) to detect
// Buffer instances.
Buffer.prototype._isBuffer = true

Buffer.prototype.toString = function toString () {
  var length = this.length | 0
  if (length === 0) return ''
  if (arguments.length === 0) return utf8Slice(this, 0, length)
  return slowToString.apply(this, arguments)
}

Buffer.prototype.equals = function equals (b) {
  if (!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
  if (this === b) return true
  return Buffer.compare(this, b) === 0
}

Buffer.prototype.inspect = function inspect () {
  var str = ''
  var max = exports.INSPECT_MAX_BYTES
  if (this.length > 0) {
    str = this.toString('hex', 0, max).match(/.{2}/g).join(' ')
    if (this.length > max) str += ' ... '
  }
  return '<Buffer ' + str + '>'
}

Buffer.prototype.compare = function compare (b) {
  if (!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
  return Buffer.compare(this, b)
}

Buffer.prototype.indexOf = function indexOf (val, byteOffset) {
  if (byteOffset > 0x7fffffff) byteOffset = 0x7fffffff
  else if (byteOffset < -0x80000000) byteOffset = -0x80000000
  byteOffset >>= 0

  if (this.length === 0) return -1
  if (byteOffset >= this.length) return -1

  // Negative offsets start from the end of the buffer
  if (byteOffset < 0) byteOffset = Math.max(this.length + byteOffset, 0)

  if (typeof val === 'string') {
    if (val.length === 0) return -1 // special case: looking for empty string always fails
    return String.prototype.indexOf.call(this, val, byteOffset)
  }
  if (Buffer.isBuffer(val)) {
    return arrayIndexOf(this, val, byteOffset)
  }
  if (typeof val === 'number') {
    if (Buffer.TYPED_ARRAY_SUPPORT && Uint8Array.prototype.indexOf === 'function') {
      return Uint8Array.prototype.indexOf.call(this, val, byteOffset)
    }
    return arrayIndexOf(this, [ val ], byteOffset)
  }

  function arrayIndexOf (arr, val, byteOffset) {
    var foundIndex = -1
    for (var i = 0; byteOffset + i < arr.length; i++) {
      if (arr[byteOffset + i] === val[foundIndex === -1 ? 0 : i - foundIndex]) {
        if (foundIndex === -1) foundIndex = i
        if (i - foundIndex + 1 === val.length) return byteOffset + foundIndex
      } else {
        foundIndex = -1
      }
    }
    return -1
  }

  throw new TypeError('val must be string, number or Buffer')
}

function hexWrite (buf, string, offset, length) {
  offset = Number(offset) || 0
  var remaining = buf.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }

  // must be an even number of digits
  var strLen = string.length
  if (strLen % 2 !== 0) throw new Error('Invalid hex string')

  if (length > strLen / 2) {
    length = strLen / 2
  }
  for (var i = 0; i < length; i++) {
    var parsed = parseInt(string.substr(i * 2, 2), 16)
    if (isNaN(parsed)) throw new Error('Invalid hex string')
    buf[offset + i] = parsed
  }
  return i
}

function utf8Write (buf, string, offset, length) {
  return blitBuffer(utf8ToBytes(string, buf.length - offset), buf, offset, length)
}

function asciiWrite (buf, string, offset, length) {
  return blitBuffer(asciiToBytes(string), buf, offset, length)
}

function binaryWrite (buf, string, offset, length) {
  return asciiWrite(buf, string, offset, length)
}

function base64Write (buf, string, offset, length) {
  return blitBuffer(base64ToBytes(string), buf, offset, length)
}

function ucs2Write (buf, string, offset, length) {
  return blitBuffer(utf16leToBytes(string, buf.length - offset), buf, offset, length)
}

Buffer.prototype.write = function write (string, offset, length, encoding) {
  // Buffer#write(string)
  if (offset === undefined) {
    encoding = 'utf8'
    length = this.length
    offset = 0
  // Buffer#write(string, encoding)
  } else if (length === undefined && typeof offset === 'string') {
    encoding = offset
    length = this.length
    offset = 0
  // Buffer#write(string, offset[, length][, encoding])
  } else if (isFinite(offset)) {
    offset = offset | 0
    if (isFinite(length)) {
      length = length | 0
      if (encoding === undefined) encoding = 'utf8'
    } else {
      encoding = length
      length = undefined
    }
  // legacy write(string, encoding, offset, length) - remove in v0.13
  } else {
    var swap = encoding
    encoding = offset
    offset = length | 0
    length = swap
  }

  var remaining = this.length - offset
  if (length === undefined || length > remaining) length = remaining

  if ((string.length > 0 && (length < 0 || offset < 0)) || offset > this.length) {
    throw new RangeError('attempt to write outside buffer bounds')
  }

  if (!encoding) encoding = 'utf8'

  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'hex':
        return hexWrite(this, string, offset, length)

      case 'utf8':
      case 'utf-8':
        return utf8Write(this, string, offset, length)

      case 'ascii':
        return asciiWrite(this, string, offset, length)

      case 'binary':
        return binaryWrite(this, string, offset, length)

      case 'base64':
        // Warning: maxLength not taken into account in base64Write
        return base64Write(this, string, offset, length)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return ucs2Write(this, string, offset, length)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}

Buffer.prototype.toJSON = function toJSON () {
  return {
    type: 'Buffer',
    data: Array.prototype.slice.call(this._arr || this, 0)
  }
}

function base64Slice (buf, start, end) {
  if (start === 0 && end === buf.length) {
    return base64.fromByteArray(buf)
  } else {
    return base64.fromByteArray(buf.slice(start, end))
  }
}

function utf8Slice (buf, start, end) {
  end = Math.min(buf.length, end)
  var res = []

  var i = start
  while (i < end) {
    var firstByte = buf[i]
    var codePoint = null
    var bytesPerSequence = (firstByte > 0xEF) ? 4
      : (firstByte > 0xDF) ? 3
      : (firstByte > 0xBF) ? 2
      : 1

    if (i + bytesPerSequence <= end) {
      var secondByte, thirdByte, fourthByte, tempCodePoint

      switch (bytesPerSequence) {
        case 1:
          if (firstByte < 0x80) {
            codePoint = firstByte
          }
          break
        case 2:
          secondByte = buf[i + 1]
          if ((secondByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0x1F) << 0x6 | (secondByte & 0x3F)
            if (tempCodePoint > 0x7F) {
              codePoint = tempCodePoint
            }
          }
          break
        case 3:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0xC | (secondByte & 0x3F) << 0x6 | (thirdByte & 0x3F)
            if (tempCodePoint > 0x7FF && (tempCodePoint < 0xD800 || tempCodePoint > 0xDFFF)) {
              codePoint = tempCodePoint
            }
          }
          break
        case 4:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          fourthByte = buf[i + 3]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80 && (fourthByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0x12 | (secondByte & 0x3F) << 0xC | (thirdByte & 0x3F) << 0x6 | (fourthByte & 0x3F)
            if (tempCodePoint > 0xFFFF && tempCodePoint < 0x110000) {
              codePoint = tempCodePoint
            }
          }
      }
    }

    if (codePoint === null) {
      // we did not generate a valid codePoint so insert a
      // replacement char (U+FFFD) and advance only 1 byte
      codePoint = 0xFFFD
      bytesPerSequence = 1
    } else if (codePoint > 0xFFFF) {
      // encode to utf16 (surrogate pair dance)
      codePoint -= 0x10000
      res.push(codePoint >>> 10 & 0x3FF | 0xD800)
      codePoint = 0xDC00 | codePoint & 0x3FF
    }

    res.push(codePoint)
    i += bytesPerSequence
  }

  return decodeCodePointsArray(res)
}

// Based on http://stackoverflow.com/a/22747272/680742, the browser with
// the lowest limit is Chrome, with 0x10000 args.
// We go 1 magnitude less, for safety
var MAX_ARGUMENTS_LENGTH = 0x1000

function decodeCodePointsArray (codePoints) {
  var len = codePoints.length
  if (len <= MAX_ARGUMENTS_LENGTH) {
    return String.fromCharCode.apply(String, codePoints) // avoid extra slice()
  }

  // Decode in chunks to avoid "call stack size exceeded".
  var res = ''
  var i = 0
  while (i < len) {
    res += String.fromCharCode.apply(
      String,
      codePoints.slice(i, i += MAX_ARGUMENTS_LENGTH)
    )
  }
  return res
}

function asciiSlice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; i++) {
    ret += String.fromCharCode(buf[i] & 0x7F)
  }
  return ret
}

function binarySlice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; i++) {
    ret += String.fromCharCode(buf[i])
  }
  return ret
}

function hexSlice (buf, start, end) {
  var len = buf.length

  if (!start || start < 0) start = 0
  if (!end || end < 0 || end > len) end = len

  var out = ''
  for (var i = start; i < end; i++) {
    out += toHex(buf[i])
  }
  return out
}

function utf16leSlice (buf, start, end) {
  var bytes = buf.slice(start, end)
  var res = ''
  for (var i = 0; i < bytes.length; i += 2) {
    res += String.fromCharCode(bytes[i] + bytes[i + 1] * 256)
  }
  return res
}

Buffer.prototype.slice = function slice (start, end) {
  var len = this.length
  start = ~~start
  end = end === undefined ? len : ~~end

  if (start < 0) {
    start += len
    if (start < 0) start = 0
  } else if (start > len) {
    start = len
  }

  if (end < 0) {
    end += len
    if (end < 0) end = 0
  } else if (end > len) {
    end = len
  }

  if (end < start) end = start

  var newBuf
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    newBuf = this.subarray(start, end)
    newBuf.__proto__ = Buffer.prototype
  } else {
    var sliceLen = end - start
    newBuf = new Buffer(sliceLen, undefined)
    for (var i = 0; i < sliceLen; i++) {
      newBuf[i] = this[i + start]
    }
  }

  if (newBuf.length) newBuf.parent = this.parent || this

  return newBuf
}

/*
 * Need to make sure that buffer isn't trying to write out of bounds.
 */
function checkOffset (offset, ext, length) {
  if ((offset % 1) !== 0 || offset < 0) throw new RangeError('offset is not uint')
  if (offset + ext > length) throw new RangeError('Trying to access beyond buffer length')
}

Buffer.prototype.readUIntLE = function readUIntLE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }

  return val
}

Buffer.prototype.readUIntBE = function readUIntBE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) {
    checkOffset(offset, byteLength, this.length)
  }

  var val = this[offset + --byteLength]
  var mul = 1
  while (byteLength > 0 && (mul *= 0x100)) {
    val += this[offset + --byteLength] * mul
  }

  return val
}

Buffer.prototype.readUInt8 = function readUInt8 (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 1, this.length)
  return this[offset]
}

Buffer.prototype.readUInt16LE = function readUInt16LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  return this[offset] | (this[offset + 1] << 8)
}

Buffer.prototype.readUInt16BE = function readUInt16BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  return (this[offset] << 8) | this[offset + 1]
}

Buffer.prototype.readUInt32LE = function readUInt32LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return ((this[offset]) |
      (this[offset + 1] << 8) |
      (this[offset + 2] << 16)) +
      (this[offset + 3] * 0x1000000)
}

Buffer.prototype.readUInt32BE = function readUInt32BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] * 0x1000000) +
    ((this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    this[offset + 3])
}

Buffer.prototype.readIntLE = function readIntLE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readIntBE = function readIntBE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var i = byteLength
  var mul = 1
  var val = this[offset + --i]
  while (i > 0 && (mul *= 0x100)) {
    val += this[offset + --i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readInt8 = function readInt8 (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 1, this.length)
  if (!(this[offset] & 0x80)) return (this[offset])
  return ((0xff - this[offset] + 1) * -1)
}

Buffer.prototype.readInt16LE = function readInt16LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset] | (this[offset + 1] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt16BE = function readInt16BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset + 1] | (this[offset] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt32LE = function readInt32LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset]) |
    (this[offset + 1] << 8) |
    (this[offset + 2] << 16) |
    (this[offset + 3] << 24)
}

Buffer.prototype.readInt32BE = function readInt32BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] << 24) |
    (this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    (this[offset + 3])
}

Buffer.prototype.readFloatLE = function readFloatLE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, true, 23, 4)
}

Buffer.prototype.readFloatBE = function readFloatBE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, false, 23, 4)
}

Buffer.prototype.readDoubleLE = function readDoubleLE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, true, 52, 8)
}

Buffer.prototype.readDoubleBE = function readDoubleBE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, false, 52, 8)
}

function checkInt (buf, value, offset, ext, max, min) {
  if (!Buffer.isBuffer(buf)) throw new TypeError('buffer must be a Buffer instance')
  if (value > max || value < min) throw new RangeError('value is out of bounds')
  if (offset + ext > buf.length) throw new RangeError('index out of range')
}

Buffer.prototype.writeUIntLE = function writeUIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkInt(this, value, offset, byteLength, Math.pow(2, 8 * byteLength), 0)

  var mul = 1
  var i = 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUIntBE = function writeUIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkInt(this, value, offset, byteLength, Math.pow(2, 8 * byteLength), 0)

  var i = byteLength - 1
  var mul = 1
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUInt8 = function writeUInt8 (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 1, 0xff, 0)
  if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value)
  this[offset] = (value & 0xff)
  return offset + 1
}

function objectWriteUInt16 (buf, value, offset, littleEndian) {
  if (value < 0) value = 0xffff + value + 1
  for (var i = 0, j = Math.min(buf.length - offset, 2); i < j; i++) {
    buf[offset + i] = (value & (0xff << (8 * (littleEndian ? i : 1 - i)))) >>>
      (littleEndian ? i : 1 - i) * 8
  }
}

Buffer.prototype.writeUInt16LE = function writeUInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value & 0xff)
    this[offset + 1] = (value >>> 8)
  } else {
    objectWriteUInt16(this, value, offset, true)
  }
  return offset + 2
}

Buffer.prototype.writeUInt16BE = function writeUInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 8)
    this[offset + 1] = (value & 0xff)
  } else {
    objectWriteUInt16(this, value, offset, false)
  }
  return offset + 2
}

function objectWriteUInt32 (buf, value, offset, littleEndian) {
  if (value < 0) value = 0xffffffff + value + 1
  for (var i = 0, j = Math.min(buf.length - offset, 4); i < j; i++) {
    buf[offset + i] = (value >>> (littleEndian ? i : 3 - i) * 8) & 0xff
  }
}

Buffer.prototype.writeUInt32LE = function writeUInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset + 3] = (value >>> 24)
    this[offset + 2] = (value >>> 16)
    this[offset + 1] = (value >>> 8)
    this[offset] = (value & 0xff)
  } else {
    objectWriteUInt32(this, value, offset, true)
  }
  return offset + 4
}

Buffer.prototype.writeUInt32BE = function writeUInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 24)
    this[offset + 1] = (value >>> 16)
    this[offset + 2] = (value >>> 8)
    this[offset + 3] = (value & 0xff)
  } else {
    objectWriteUInt32(this, value, offset, false)
  }
  return offset + 4
}

Buffer.prototype.writeIntLE = function writeIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) {
    var limit = Math.pow(2, 8 * byteLength - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = 0
  var mul = 1
  var sub = value < 0 ? 1 : 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeIntBE = function writeIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) {
    var limit = Math.pow(2, 8 * byteLength - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = byteLength - 1
  var mul = 1
  var sub = value < 0 ? 1 : 0
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeInt8 = function writeInt8 (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 1, 0x7f, -0x80)
  if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value)
  if (value < 0) value = 0xff + value + 1
  this[offset] = (value & 0xff)
  return offset + 1
}

Buffer.prototype.writeInt16LE = function writeInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value & 0xff)
    this[offset + 1] = (value >>> 8)
  } else {
    objectWriteUInt16(this, value, offset, true)
  }
  return offset + 2
}

Buffer.prototype.writeInt16BE = function writeInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 8)
    this[offset + 1] = (value & 0xff)
  } else {
    objectWriteUInt16(this, value, offset, false)
  }
  return offset + 2
}

Buffer.prototype.writeInt32LE = function writeInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value & 0xff)
    this[offset + 1] = (value >>> 8)
    this[offset + 2] = (value >>> 16)
    this[offset + 3] = (value >>> 24)
  } else {
    objectWriteUInt32(this, value, offset, true)
  }
  return offset + 4
}

Buffer.prototype.writeInt32BE = function writeInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (value < 0) value = 0xffffffff + value + 1
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 24)
    this[offset + 1] = (value >>> 16)
    this[offset + 2] = (value >>> 8)
    this[offset + 3] = (value & 0xff)
  } else {
    objectWriteUInt32(this, value, offset, false)
  }
  return offset + 4
}

function checkIEEE754 (buf, value, offset, ext, max, min) {
  if (offset + ext > buf.length) throw new RangeError('index out of range')
  if (offset < 0) throw new RangeError('index out of range')
}

function writeFloat (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 4, 3.4028234663852886e+38, -3.4028234663852886e+38)
  }
  ieee754.write(buf, value, offset, littleEndian, 23, 4)
  return offset + 4
}

Buffer.prototype.writeFloatLE = function writeFloatLE (value, offset, noAssert) {
  return writeFloat(this, value, offset, true, noAssert)
}

Buffer.prototype.writeFloatBE = function writeFloatBE (value, offset, noAssert) {
  return writeFloat(this, value, offset, false, noAssert)
}

function writeDouble (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 8, 1.7976931348623157E+308, -1.7976931348623157E+308)
  }
  ieee754.write(buf, value, offset, littleEndian, 52, 8)
  return offset + 8
}

Buffer.prototype.writeDoubleLE = function writeDoubleLE (value, offset, noAssert) {
  return writeDouble(this, value, offset, true, noAssert)
}

Buffer.prototype.writeDoubleBE = function writeDoubleBE (value, offset, noAssert) {
  return writeDouble(this, value, offset, false, noAssert)
}

// copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
Buffer.prototype.copy = function copy (target, targetStart, start, end) {
  if (!start) start = 0
  if (!end && end !== 0) end = this.length
  if (targetStart >= target.length) targetStart = target.length
  if (!targetStart) targetStart = 0
  if (end > 0 && end < start) end = start

  // Copy 0 bytes; we're done
  if (end === start) return 0
  if (target.length === 0 || this.length === 0) return 0

  // Fatal error conditions
  if (targetStart < 0) {
    throw new RangeError('targetStart out of bounds')
  }
  if (start < 0 || start >= this.length) throw new RangeError('sourceStart out of bounds')
  if (end < 0) throw new RangeError('sourceEnd out of bounds')

  // Are we oob?
  if (end > this.length) end = this.length
  if (target.length - targetStart < end - start) {
    end = target.length - targetStart + start
  }

  var len = end - start
  var i

  if (this === target && start < targetStart && targetStart < end) {
    // descending copy from end
    for (i = len - 1; i >= 0; i--) {
      target[i + targetStart] = this[i + start]
    }
  } else if (len < 1000 || !Buffer.TYPED_ARRAY_SUPPORT) {
    // ascending copy from start
    for (i = 0; i < len; i++) {
      target[i + targetStart] = this[i + start]
    }
  } else {
    Uint8Array.prototype.set.call(
      target,
      this.subarray(start, start + len),
      targetStart
    )
  }

  return len
}

// fill(value, start=0, end=buffer.length)
Buffer.prototype.fill = function fill (value, start, end) {
  if (!value) value = 0
  if (!start) start = 0
  if (!end) end = this.length

  if (end < start) throw new RangeError('end < start')

  // Fill 0 bytes; we're done
  if (end === start) return
  if (this.length === 0) return

  if (start < 0 || start >= this.length) throw new RangeError('start out of bounds')
  if (end < 0 || end > this.length) throw new RangeError('end out of bounds')

  var i
  if (typeof value === 'number') {
    for (i = start; i < end; i++) {
      this[i] = value
    }
  } else {
    var bytes = utf8ToBytes(value.toString())
    var len = bytes.length
    for (i = start; i < end; i++) {
      this[i] = bytes[i % len]
    }
  }

  return this
}

// HELPER FUNCTIONS
// ================

var INVALID_BASE64_RE = /[^+\/0-9A-Za-z-_]/g

function base64clean (str) {
  // Node strips out invalid characters like \n and \t from the string, base64-js does not
  str = stringtrim(str).replace(INVALID_BASE64_RE, '')
  // Node converts strings with length < 2 to ''
  if (str.length < 2) return ''
  // Node allows for non-padded base64 strings (missing trailing ===), base64-js does not
  while (str.length % 4 !== 0) {
    str = str + '='
  }
  return str
}

function stringtrim (str) {
  if (str.trim) return str.trim()
  return str.replace(/^\s+|\s+$/g, '')
}

function toHex (n) {
  if (n < 16) return '0' + n.toString(16)
  return n.toString(16)
}

function utf8ToBytes (string, units) {
  units = units || Infinity
  var codePoint
  var length = string.length
  var leadSurrogate = null
  var bytes = []

  for (var i = 0; i < length; i++) {
    codePoint = string.charCodeAt(i)

    // is surrogate component
    if (codePoint > 0xD7FF && codePoint < 0xE000) {
      // last char was a lead
      if (!leadSurrogate) {
        // no lead yet
        if (codePoint > 0xDBFF) {
          // unexpected trail
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        } else if (i + 1 === length) {
          // unpaired lead
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        }

        // valid lead
        leadSurrogate = codePoint

        continue
      }

      // 2 leads in a row
      if (codePoint < 0xDC00) {
        if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
        leadSurrogate = codePoint
        continue
      }

      // valid surrogate pair
      codePoint = (leadSurrogate - 0xD800 << 10 | codePoint - 0xDC00) + 0x10000
    } else if (leadSurrogate) {
      // valid bmp char, but last char was a lead
      if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
    }

    leadSurrogate = null

    // encode utf8
    if (codePoint < 0x80) {
      if ((units -= 1) < 0) break
      bytes.push(codePoint)
    } else if (codePoint < 0x800) {
      if ((units -= 2) < 0) break
      bytes.push(
        codePoint >> 0x6 | 0xC0,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x10000) {
      if ((units -= 3) < 0) break
      bytes.push(
        codePoint >> 0xC | 0xE0,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x110000) {
      if ((units -= 4) < 0) break
      bytes.push(
        codePoint >> 0x12 | 0xF0,
        codePoint >> 0xC & 0x3F | 0x80,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else {
      throw new Error('Invalid code point')
    }
  }

  return bytes
}

function asciiToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    // Node's code seems to be doing this and not & 0x7F..
    byteArray.push(str.charCodeAt(i) & 0xFF)
  }
  return byteArray
}

function utf16leToBytes (str, units) {
  var c, hi, lo
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    if ((units -= 2) < 0) break

    c = str.charCodeAt(i)
    hi = c >> 8
    lo = c % 256
    byteArray.push(lo)
    byteArray.push(hi)
  }

  return byteArray
}

function base64ToBytes (str) {
  return base64.toByteArray(base64clean(str))
}

function blitBuffer (src, dst, offset, length) {
  for (var i = 0; i < length; i++) {
    if ((i + offset >= dst.length) || (i >= src.length)) break
    dst[i + offset] = src[i]
  }
  return i
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"base64-js":9,"ieee754":10,"isarray":11}],9:[function(require,module,exports){
'use strict'

exports.toByteArray = toByteArray
exports.fromByteArray = fromByteArray

var lookup = []
var revLookup = []
var Arr = typeof Uint8Array !== 'undefined' ? Uint8Array : Array

function init () {
  var code = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  for (var i = 0, len = code.length; i < len; ++i) {
    lookup[i] = code[i]
    revLookup[code.charCodeAt(i)] = i
  }

  revLookup['-'.charCodeAt(0)] = 62
  revLookup['_'.charCodeAt(0)] = 63
}

init()

function toByteArray (b64) {
  var i, j, l, tmp, placeHolders, arr
  var len = b64.length

  if (len % 4 > 0) {
    throw new Error('Invalid string. Length must be a multiple of 4')
  }

  // the number of equal signs (place holders)
  // if there are two placeholders, than the two characters before it
  // represent one byte
  // if there is only one, then the three characters before it represent 2 bytes
  // this is just a cheap hack to not do indexOf twice
  placeHolders = b64[len - 2] === '=' ? 2 : b64[len - 1] === '=' ? 1 : 0

  // base64 is 4/3 + up to two characters of the original data
  arr = new Arr(len * 3 / 4 - placeHolders)

  // if there are placeholders, only get up to the last complete 4 chars
  l = placeHolders > 0 ? len - 4 : len

  var L = 0

  for (i = 0, j = 0; i < l; i += 4, j += 3) {
    tmp = (revLookup[b64.charCodeAt(i)] << 18) | (revLookup[b64.charCodeAt(i + 1)] << 12) | (revLookup[b64.charCodeAt(i + 2)] << 6) | revLookup[b64.charCodeAt(i + 3)]
    arr[L++] = (tmp >> 16) & 0xFF
    arr[L++] = (tmp >> 8) & 0xFF
    arr[L++] = tmp & 0xFF
  }

  if (placeHolders === 2) {
    tmp = (revLookup[b64.charCodeAt(i)] << 2) | (revLookup[b64.charCodeAt(i + 1)] >> 4)
    arr[L++] = tmp & 0xFF
  } else if (placeHolders === 1) {
    tmp = (revLookup[b64.charCodeAt(i)] << 10) | (revLookup[b64.charCodeAt(i + 1)] << 4) | (revLookup[b64.charCodeAt(i + 2)] >> 2)
    arr[L++] = (tmp >> 8) & 0xFF
    arr[L++] = tmp & 0xFF
  }

  return arr
}

function tripletToBase64 (num) {
  return lookup[num >> 18 & 0x3F] + lookup[num >> 12 & 0x3F] + lookup[num >> 6 & 0x3F] + lookup[num & 0x3F]
}

function encodeChunk (uint8, start, end) {
  var tmp
  var output = []
  for (var i = start; i < end; i += 3) {
    tmp = (uint8[i] << 16) + (uint8[i + 1] << 8) + (uint8[i + 2])
    output.push(tripletToBase64(tmp))
  }
  return output.join('')
}

function fromByteArray (uint8) {
  var tmp
  var len = uint8.length
  var extraBytes = len % 3 // if we have 1 byte left, pad 2 bytes
  var output = ''
  var parts = []
  var maxChunkLength = 16383 // must be multiple of 3

  // go through the array every three bytes, we'll deal with trailing stuff later
  for (var i = 0, len2 = len - extraBytes; i < len2; i += maxChunkLength) {
    parts.push(encodeChunk(uint8, i, (i + maxChunkLength) > len2 ? len2 : (i + maxChunkLength)))
  }

  // pad the end with zeros, but make sure to not forget the extra bytes
  if (extraBytes === 1) {
    tmp = uint8[len - 1]
    output += lookup[tmp >> 2]
    output += lookup[(tmp << 4) & 0x3F]
    output += '=='
  } else if (extraBytes === 2) {
    tmp = (uint8[len - 2] << 8) + (uint8[len - 1])
    output += lookup[tmp >> 10]
    output += lookup[(tmp >> 4) & 0x3F]
    output += lookup[(tmp << 2) & 0x3F]
    output += '='
  }

  parts.push(output)

  return parts.join('')
}

},{}],10:[function(require,module,exports){
exports.read = function (buffer, offset, isLE, mLen, nBytes) {
  var e, m
  var eLen = nBytes * 8 - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var nBits = -7
  var i = isLE ? (nBytes - 1) : 0
  var d = isLE ? -1 : 1
  var s = buffer[offset + i]

  i += d

  e = s & ((1 << (-nBits)) - 1)
  s >>= (-nBits)
  nBits += eLen
  for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8) {}

  m = e & ((1 << (-nBits)) - 1)
  e >>= (-nBits)
  nBits += mLen
  for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8) {}

  if (e === 0) {
    e = 1 - eBias
  } else if (e === eMax) {
    return m ? NaN : ((s ? -1 : 1) * Infinity)
  } else {
    m = m + Math.pow(2, mLen)
    e = e - eBias
  }
  return (s ? -1 : 1) * m * Math.pow(2, e - mLen)
}

exports.write = function (buffer, value, offset, isLE, mLen, nBytes) {
  var e, m, c
  var eLen = nBytes * 8 - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0)
  var i = isLE ? 0 : (nBytes - 1)
  var d = isLE ? 1 : -1
  var s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0

  value = Math.abs(value)

  if (isNaN(value) || value === Infinity) {
    m = isNaN(value) ? 1 : 0
    e = eMax
  } else {
    e = Math.floor(Math.log(value) / Math.LN2)
    if (value * (c = Math.pow(2, -e)) < 1) {
      e--
      c *= 2
    }
    if (e + eBias >= 1) {
      value += rt / c
    } else {
      value += rt * Math.pow(2, 1 - eBias)
    }
    if (value * c >= 2) {
      e++
      c /= 2
    }

    if (e + eBias >= eMax) {
      m = 0
      e = eMax
    } else if (e + eBias >= 1) {
      m = (value * c - 1) * Math.pow(2, mLen)
      e = e + eBias
    } else {
      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen)
      e = 0
    }
  }

  for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8) {}

  e = (e << mLen) | m
  eLen += mLen
  for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8) {}

  buffer[offset + i - d] |= s * 128
}

},{}],11:[function(require,module,exports){
var toString = {}.toString;

module.exports = Array.isArray || function (arr) {
  return toString.call(arr) == '[object Array]';
};

},{}]},{},[2])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL3Vzci9sb2NhbC9saWIvbm9kZV9tb2R1bGVzL3dhdGNoaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIuLi9hdnMuanMiLCJpbmRleC5qcyIsIi4uL25vZGVfbW9kdWxlcy9odHRwLW1lc3NhZ2UtcGFyc2VyL2h0dHAtbWVzc2FnZS1wYXJzZXIuanMiLCIuLi9ub2RlX21vZHVsZXMvcXMvbGliL2luZGV4LmpzIiwiLi4vbm9kZV9tb2R1bGVzL3FzL2xpYi9wYXJzZS5qcyIsIi4uL25vZGVfbW9kdWxlcy9xcy9saWIvc3RyaW5naWZ5LmpzIiwiLi4vbm9kZV9tb2R1bGVzL3FzL2xpYi91dGlscy5qcyIsIi4uLy4uLy4uLy4uLy4uL3Vzci9sb2NhbC9saWIvbm9kZV9tb2R1bGVzL3dhdGNoaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9idWZmZXIvaW5kZXguanMiLCIuLi8uLi8uLi8uLi8uLi91c3IvbG9jYWwvbGliL25vZGVfbW9kdWxlcy93YXRjaGlmeS9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnVmZmVyL25vZGVfbW9kdWxlcy9iYXNlNjQtanMvbGliL2I2NC5qcyIsIi4uLy4uLy4uLy4uLy4uL3Vzci9sb2NhbC9saWIvbm9kZV9tb2R1bGVzL3dhdGNoaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9idWZmZXIvbm9kZV9tb2R1bGVzL2llZWU3NTQvaW5kZXguanMiLCIuLi8uLi8uLi8uLi8uLi91c3IvbG9jYWwvbGliL25vZGVfbW9kdWxlcy93YXRjaGlmeS9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnVmZmVyL25vZGVfbW9kdWxlcy9pc2FycmF5L2luZGV4LmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUEsQ0FBQyxVQUFTLElB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O0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDbFVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwS0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25JQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7O0FDbEtBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUNoN0NBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN0dBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiKGZ1bmN0aW9uKHJvb3QpIHtcbiAgJ3VzZSBzdHJpY3QnO1xuY29uc3QgQnVmZmVyID0gcmVxdWlyZSgnYnVmZmVyJykuQnVmZmVyO1xuICBjb25zdCBxcyA9IHJlcXVpcmUoJ3FzJyk7XG4gIGNvbnN0IGh0dHBNZXNzYWdlUGFyc2VyID0gcmVxdWlyZSgnaHR0cC1tZXNzYWdlLXBhcnNlcicpO1xuXG4gIGlmICghbmF2aWdhdG9yLmdldFVzZXJNZWRpYSkge1xuICAgIG5hdmlnYXRvci5nZXRVc2VyTWVkaWEgPSBuYXZpZ2F0b3IuZ2V0VXNlck1lZGlhIHx8IG5hdmlnYXRvci53ZWJraXRHZXRVc2VyTWVkaWEgfHxcbiAgICAgIG5hdmlnYXRvci5tb3pHZXRVc2VyTWVkaWEgfHwgbmF2aWdhdG9yLm1zR2V0VXNlck1lZGlhO1xuICB9XG5cbiAgY29uc3QgQU1BWk9OX0VSUk9SX0NPREVTID0ge1xuICAgSW52YWxpZEFjY2Vzc1Rva2VuRXhjZXB0aW9uOiAnY29tLmFtYXpvbi5hbGV4YWh0dHBwcm94eS5leGNlcHRpb25zLkludmFsaWRBY2Nlc3NUb2tlbkV4Y2VwdGlvbidcbiAgfTtcblxuICBjbGFzcyBBVlMge1xuICAgIGNvbnN0cnVjdG9yKG9wdGlvbnMgPSB7fSkge1xuICAgICAgb2JzZXJ2YWJsZSh0aGlzKTtcblxuICAgICAgdGhpcy5fYnVmZmVyU2l6ZSA9IDIwNDg7XG4gICAgICB0aGlzLl9pbnB1dENoYW5uZWxzID0gMTtcbiAgICAgIHRoaXMuX291dHB1dENoYW5uZWxzID0gMTtcbiAgICAgIHRoaXMuX2xlZnRDaGFubmVsID0gW107XG4gICAgICB0aGlzLl9yaWdodENoYW5uZWwgPSBbXTtcbiAgICAgIHRoaXMuX2F1ZGlvQ29udGV4dCA9IG51bGw7XG4gICAgICB0aGlzLl9yZWNvcmRlciA9IG51bGw7XG4gICAgICB0aGlzLl9zYW1wbGVSYXRlID0gbnVsbDtcbiAgICAgIHRoaXMuX291dHB1dFNhbXBsZVJhdGUgPSAxNjAwMDtcbiAgICAgIHRoaXMuX2F1ZGlvSW5wdXQgPSBudWxsO1xuICAgICAgdGhpcy5fdm9sdW1lTm9kZSA9IG51bGw7XG4gICAgICB0aGlzLl9kZWJ1ZyA9IGZhbHNlO1xuICAgICAgdGhpcy5fdG9rZW4gPSBudWxsO1xuICAgICAgdGhpcy5fcmVmcmVzaFRva2VuID0gbnVsbDtcbiAgICAgIHRoaXMuX2NsaWVudElkID0gbnVsbDtcbiAgICAgIHRoaXMuX2NsaWVudFNlY3JldCA9IG51bGw7XG4gICAgICB0aGlzLl9kZXZpY2VJZD0gbnVsbDtcbiAgICAgIHRoaXMuX2RldmljZVNlcmlhbE51bWJlciA9IG51bGw7XG4gICAgICB0aGlzLl9yZWRpcmVjdFVyaSA9IG51bGw7XG5cbiAgICAgIGlmIChvcHRpb25zLnRva2VuKSB7XG4gICAgICAgIHRoaXMuc2V0VG9rZW4ob3B0aW9ucy50b2tlbik7XG4gICAgICB9XG5cbiAgICAgIGlmIChvcHRpb25zLnJlZnJlc2hUb2tlbikge1xuICAgICAgICB0aGlzLnNldFJlZnJlc2hUb2tlbihvcHRpb25zLnJlZnJlc2hUb2tlbik7XG4gICAgICB9XG5cbiAgICAgIGlmIChvcHRpb25zLmNsaWVudElkKSB7XG4gICAgICAgIHRoaXMuc2V0Q2xpZW50SWQob3B0aW9ucy5jbGllbnRJZCk7XG4gICAgICB9XG5cbiAgICAgIGlmIChvcHRpb25zLmNsaWVudFNlY3JldCkge1xuICAgICAgICB0aGlzLnNldENsaWVudFNlY3JldChvcHRpb25zLmNsaWVudFNlY3JldCk7XG4gICAgICB9XG5cbiAgICAgIGlmIChvcHRpb25zLmRldmljZUlkKSB7XG4gICAgICAgIHRoaXMuc2V0RGV2aWNlSWQob3B0aW9ucy5kZXZpY2VJZCk7XG4gICAgICB9XG5cbiAgICAgIGlmIChvcHRpb25zLmRldmljZVNlcmlhbE51bWJlcikge1xuICAgICAgICB0aGlzLnNldERldmljZVNlcmlhbE51bWJlcihvcHRpb25zLmRldmljZVNlcmlhbE51bWJlcik7XG4gICAgICB9XG5cbiAgICAgIGlmIChvcHRpb25zLnJlZGlyZWN0VXJpKSB7XG4gICAgICAgIHRoaXMuc2V0UmVkaXJlY3RVcmkob3B0aW9ucy5yZWRpcmVjdFVyaSk7XG4gICAgICB9XG5cbiAgICAgIGlmIChvcHRpb25zLmRlYnVnKSB7XG4gICAgICAgIHRoaXMuc2V0RGVidWcob3B0aW9ucy5kZWJ1Zyk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgX2xvZyh0eXBlLCBtZXNzYWdlKSB7XG4gICAgICBpZiAodHlwZSAmJiAhbWVzc2FnZSkge1xuICAgICAgICBtZXNzYWdlID0gdHlwZTtcbiAgICAgICAgdHlwZSA9ICdsb2cnO1xuICAgICAgfVxuXG4gICAgICBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgdGhpcy5lbWl0KCdsb2cnLCBtZXNzYWdlKTtcbiAgICAgIH0sIDApO1xuXG4gICAgICBpZiAodGhpcy5fZGVidWcpIHtcbiAgICAgICAgY29uc29sZVt0eXBlXShtZXNzYWdlKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBsb2dpbihvcHRpb25zID0ge30pIHtcbiAgICAgIHJldHVybiB0aGlzLnByb21wdFVzZXJMb2dpbihvcHRpb25zKTtcbiAgICB9XG5cbiAgICBsb2dvdXQoKSB7XG4gICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICB0aGlzLl90b2tlbiA9IG51bGw7XG4gICAgICAgIHRoaXMuX3JlZnJlc2hUb2tlbiA9IG51bGw7XG4gICAgICAgIHRoaXMuZW1pdCgnbG9nb3V0Jyk7XG4gICAgICAgIHRoaXMuX2xvZygnTG9nZ2Vkb3V0Jyk7XG4gICAgICAgIHJlc29sdmUoKTtcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIHByb21wdFVzZXJMb2dpbihvcHRpb25zID0ge3Jlc3BvbnNlVHlwZTogJ3Rva2VuJywgbmV3V2luZG93OiBmYWxzZX0pIHtcbiAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgIGlmICh0eXBlb2Ygb3B0aW9ucy5yZXNwb25zZVR5cGUgPT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgb3B0aW9ucy5yZXNwb25zZVR5cGUgPSAndG9rZW4nO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHR5cGVvZiBvcHRpb25zLnJlc3BvbnNlVHlwZSAhPT0gJ3N0cmluZycpIHtcbiAgICAgICAgICBjb25zdCBlcnJvciA9IG5ldyBFcnJvcignYHJlc3BvbnNlVHlwZWAgbXVzdCBhIHN0cmluZy4nKTtcbiAgICAgICAgICB0aGlzLl9sb2coZXJyb3IpO1xuICAgICAgICAgIHJldHVybiByZWplY3QoZXJyb3IpO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgbmV3V2luZG93ID0gISFvcHRpb25zLm5ld1dpbmRvdztcblxuICAgICAgICBjb25zdCByZXNwb25zZVR5cGUgPSBvcHRpb25zLnJlc3BvbnNlVHlwZTtcblxuICAgICAgICBpZiAoIShyZXNwb25zZVR5cGUgPT09ICdjb2RlJyB8fCByZXNwb25zZVR5cGUgPT09ICd0b2tlbicpKSB7XG4gICAgICAgICAgY29uc3QgZXJyb3IgPSBuZXcgRXJyb3IoJ2ByZXNwb25zZVR5cGVgIG11c3QgYmUgZWl0aGVyIGBjb2RlYCBvciBgdG9rZW5gLicpO1xuICAgICAgICAgIHRoaXMuX2xvZyhlcnJvcik7XG4gICAgICAgICAgcmV0dXJuIHJlamVjdChlcnJvcik7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBzY29wZSA9ICdhbGV4YTphbGwnO1xuICAgICAgICBjb25zdCBzY29wZURhdGEgPSB7XG4gICAgICAgICAgW3Njb3BlXToge1xuICAgICAgICAgICAgcHJvZHVjdElEOiB0aGlzLl9kZXZpY2VJZCxcbiAgICAgICAgICAgIHByb2R1Y3RJbnN0YW5jZUF0dHJpYnV0ZXM6IHtcbiAgICAgICAgICAgICAgZGV2aWNlU2VyaWFsTnVtYmVyOiB0aGlzLl9kZXZpY2VTZXJpYWxOdW1iZXJcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH07XG5cbiAgICAgICAgY29uc3QgYXV0aFVybCA9IGBodHRwczovL3d3dy5hbWF6b24uY29tL2FwL29hP2NsaWVudF9pZD0ke3RoaXMuX2NsaWVudElkfSZzY29wZT0ke2VuY29kZVVSSUNvbXBvbmVudChzY29wZSl9JnNjb3BlX2RhdGE9JHtlbmNvZGVVUklDb21wb25lbnQoSlNPTi5zdHJpbmdpZnkoc2NvcGVEYXRhKSl9JnJlc3BvbnNlX3R5cGU9JHtyZXNwb25zZVR5cGV9JnJlZGlyZWN0X3VyaT0ke2VuY29kZVVSSSh0aGlzLl9yZWRpcmVjdFVyaSl9YFxuXG4gICAgICAgIGlmIChuZXdXaW5kb3cpIHtcbiAgICAgICAgICB3aW5kb3cub3BlbihhdXRoVXJsKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB3aW5kb3cubG9jYXRpb24uaHJlZiA9IGF1dGhVcmw7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH1cblxuICAgIGdldFRva2VuRnJvbUNvZGUoY29kZSkge1xuICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgaWYgKHR5cGVvZiBjb2RlICE9PSAnc3RyaW5nJykge1xuICAgICAgICAgIGNvbnN0IGVycm9yID0gbmV3IFR5cGVFcnJvcignYGNvZGVgIG11c3QgYmUgYSBzdHJpbmcuJyk7XG4gICAgICAgICAgdGhpcy5fbG9nKGVycm9yKTtcbiAgICAgICAgICByZXR1cm4gcmVqZWN0KGVycm9yKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGdyYW50VHlwZSA9ICdhdXRob3JpemF0aW9uX2NvZGUnO1xuICAgICAgICBjb25zdCBwb3N0RGF0YSA9IGBncmFudF90eXBlPSR7Z3JhbnRUeXBlfSZjb2RlPSR7Y29kZX0mY2xpZW50X2lkPSR7dGhpcy5fY2xpZW50SWR9JmNsaWVudF9zZWNyZXQ9JHt0aGlzLl9jbGllbnRTZWNyZXR9JnJlZGlyZWN0X3VyaT0ke2VuY29kZVVSSUNvbXBvbmVudCh0aGlzLl9yZWRpcmVjdFVyaSl9YDtcbiAgICAgICAgY29uc3QgdXJsID0gJ2h0dHBzOi8vYXBpLmFtYXpvbi5jb20vYXV0aC9vMi90b2tlbic7XG5cbiAgICAgICAgY29uc3QgeGhyID0gbmV3IFhNTEh0dHBSZXF1ZXN0KCk7XG5cbiAgICAgICAgeGhyLm9wZW4oJ1BPU1QnLCB1cmwsIHRydWUpO1xuICAgICAgICB4aHIuc2V0UmVxdWVzdEhlYWRlcignQ29udGVudC1UeXBlJywgJ2FwcGxpY2F0aW9uL3gtd3d3LWZvcm0tdXJsZW5jb2RlZDtjaGFyc2V0PVVURi04Jyk7XG4gICAgICAgIHhoci5vbmxvYWQgPSAoZXZlbnQpID0+IHtcbiAgICAgICAgICBjb25zb2xlLmxvZygnUkVTUE9OU0UnLCB4aHIucmVzcG9uc2UpO1xuXG4gICAgICAgICAgbGV0IHJlc3BvbnNlID0geGhyLnJlc3BvbnNlO1xuXG4gICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIHJlc3BvbnNlID0gSlNPTi5wYXJzZSh4aHIucmVzcG9uc2UpO1xuICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICB0aGlzLl9sb2coZXJyb3IpO1xuICAgICAgICAgICAgcmV0dXJuIHJlamVjdChlcnJvcik7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgY29uc3QgaXNPYmplY3QgPSByZXNwb25zZSBpbnN0YW5jZW9mIE9iamVjdDtcbiAgICAgICAgICBjb25zdCBlcnJvckRlc2NyaXB0aW9uID0gaXNPYmplY3QgJiYgcmVzcG9uc2UuZXJyb3JfZGVzY3JpcHRpb247XG5cbiAgICAgICAgICBpZiAoZXJyb3JEZXNjcmlwdGlvbikge1xuICAgICAgICAgICAgY29uc3QgZXJyb3IgPSBuZXcgRXJyb3IoZXJyb3JEZXNjcmlwdGlvbik7XG4gICAgICAgICAgICB0aGlzLl9sb2coZXJyb3IpO1xuICAgICAgICAgICAgcmV0dXJuIHJlamVjdChlcnJvcik7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgY29uc3QgdG9rZW4gPSByZXNwb25zZS5hY2Nlc3NfdG9rZW47XG4gICAgICAgICAgY29uc3QgcmVmcmVzaFRva2VuID0gcmVzcG9uc2UucmVmcmVzaF90b2tlbjtcbiAgICAgICAgICBjb25zdCB0b2tlblR5cGUgPSByZXNwb25zZS50b2tlbl90eXBlO1xuICAgICAgICAgIGNvbnN0IGV4cGlyZXNJbiA9IHJlc3BvbnNlLmV4cGlyZXNJbjtcblxuICAgICAgICAgIHRoaXMuc2V0VG9rZW4odG9rZW4pXG4gICAgICAgICAgdGhpcy5zZXRSZWZyZXNoVG9rZW4ocmVmcmVzaFRva2VuKVxuXG4gICAgICAgICAgdGhpcy5lbWl0KCdsb2dpbicpO1xuICAgICAgICAgIHRoaXMuX2xvZygnTG9nZ2VkIGluLicpO1xuICAgICAgICAgIHJlc29sdmUocmVzcG9uc2UpO1xuICAgICAgICB9O1xuXG4gICAgICAgIHhoci5vbmVycm9yID0gKGVycm9yKSA9PiB7XG4gICAgICAgICAgdGhpcy5fbG9nKGVycm9yKTtcbiAgICAgICAgICByZWplY3QoZXJyb3IpO1xuICAgICAgICB9O1xuXG4gICAgICAgIHhoci5zZW5kKHBvc3REYXRhKTtcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIHJlZnJlc2hUb2tlbigpIHtcbiAgICAgIHJldHVybiB0aGlzLmdldFRva2VuRnJvbVJlZnJlc2hUb2tlbih0aGlzLl9yZWZyZXNoVG9rZW4pXG4gICAgICAgICAgICAgIC50aGVuKCgpID0+IHtcbiAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgdG9rZW46IHRoaXMuX3Rva2VuLFxuICAgICAgICAgICAgICAgICAgcmVmcmVzaFRva2VuOiB0aGlzLl9yZWZyZXNoVG9rZW5cbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBnZXRUb2tlbkZyb21SZWZyZXNoVG9rZW4ocmVmcmVzaFRva2VuID0gdGhpcy5fcmVmcmVzaFRva2VuKSB7XG4gICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICBpZiAodHlwZW9mIHJlZnJlc2hUb2tlbiAhPT0gJ3N0cmluZycpIHtcbiAgICAgICAgICBjb25zdCBlcnJvciA9IG5ldyBFcnJvcignYHJlZnJlc2hUb2tlbmAgbXVzdCBhIHN0cmluZy4nKTtcbiAgICAgICAgICB0aGlzLl9sb2coZXJyb3IpO1xuICAgICAgICAgIHJldHVybiByZWplY3QoZXJyb3IpO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgZ3JhbnRUeXBlID0gJ3JlZnJlc2hfdG9rZW4nO1xuICAgICAgICBjb25zdCBwb3N0RGF0YSA9IGBncmFudF90eXBlPSR7Z3JhbnRUeXBlfSZyZWZyZXNoX3Rva2VuPSR7cmVmcmVzaFRva2VufSZjbGllbnRfaWQ9JHt0aGlzLl9jbGllbnRJZH0mY2xpZW50X3NlY3JldD0ke3RoaXMuX2NsaWVudFNlY3JldH0mcmVkaXJlY3RfdXJpPSR7ZW5jb2RlVVJJQ29tcG9uZW50KHRoaXMuX3JlZGlyZWN0VXJpKX1gO1xuICAgICAgICBjb25zdCB1cmwgPSAnaHR0cHM6Ly9hcGkuYW1hem9uLmNvbS9hdXRoL28yL3Rva2VuJztcbiAgICAgICAgY29uc3QgeGhyID0gbmV3IFhNTEh0dHBSZXF1ZXN0KCk7XG5cbiAgICAgICAgeGhyLm9wZW4oJ1BPU1QnLCB1cmwsIHRydWUpO1xuICAgICAgICB4aHIuc2V0UmVxdWVzdEhlYWRlcignQ29udGVudC1UeXBlJywgJ2FwcGxpY2F0aW9uL3gtd3d3LWZvcm0tdXJsZW5jb2RlZDtjaGFyc2V0PVVURi04Jyk7XG4gICAgICAgIHhoci5yZXNwb25zZVR5cGUgPSAnanNvbic7XG4gICAgICAgIHhoci5vbmxvYWQgPSAoZXZlbnQpID0+IHtcbiAgICAgICAgICBjb25zdCByZXNwb25zZSA9IHhoci5yZXNwb25zZTtcblxuICAgICAgICAgIGlmIChyZXNwb25zZS5lcnJvcikge1xuICAgICAgICAgICAgY29uc3QgZXJyb3IgPSByZXNwb25zZS5lcnJvci5tZXNzYWdlO1xuICAgICAgICAgICAgdGhpcy5lbWl0KCdlcnJvcicsIGVycm9yKTtcblxuICAgICAgICAgICAgcmV0dXJuIHJlamVjdChlcnJvcik7XG4gICAgICAgICAgfSBlbHNlICB7XG4gICAgICAgICAgICBjb25zdCB0b2tlbiA9IHJlc3BvbnNlLmFjY2Vzc190b2tlbjtcbiAgICAgICAgICAgIGNvbnN0IHJlZnJlc2hUb2tlbiA9IHJlc3BvbnNlLnJlZnJlc2hfdG9rZW47XG5cbiAgICAgICAgICAgIHRoaXMuc2V0VG9rZW4odG9rZW4pO1xuICAgICAgICAgICAgdGhpcy5zZXRSZWZyZXNoVG9rZW4ocmVmcmVzaFRva2VuKTtcblxuICAgICAgICAgICAgcmV0dXJuIHJlc29sdmUodG9rZW4pO1xuICAgICAgICAgIH1cbiAgICAgICAgfTtcblxuICAgICAgICB4aHIub25lcnJvciA9IChlcnJvcikgPT4ge1xuICAgICAgICAgIHRoaXMuX2xvZyhlcnJvcik7XG4gICAgICAgICAgcmVqZWN0KGVycm9yKTtcbiAgICAgICAgfTtcblxuICAgICAgICB4aHIuc2VuZChwb3N0RGF0YSk7XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBnZXRUb2tlbkZyb21VcmwoKSB7XG4gICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICBsZXQgcXVlcnlTdHJpbmcgPSB3aW5kb3cubG9jYXRpb24uaHJlZi5zcGxpdCgnPyMnKTtcblxuICAgICAgICBpZiAocXVlcnlTdHJpbmcubGVuZ3RoID09PSAyKSB7XG4gICAgICAgICAgcXVlcnlTdHJpbmcgPSBxdWVyeVN0cmluZ1sxXTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBxdWVyeVN0cmluZyA9IHdpbmRvdy5sb2NhdGlvbi5zZWFyY2guc3Vic3RyKDEpO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgcXVlcnkgPSBxcy5wYXJzZShxdWVyeVN0cmluZyk7XG4gICAgICAgIGNvbnN0IHRva2VuID0gcXVlcnkuYWNjZXNzX3Rva2VuO1xuICAgICAgICBjb25zdCByZWZyZXNoVG9rZW4gPSBxdWVyeS5yZWZyZXNoX3Rva2VuO1xuICAgICAgICBjb25zdCB0b2tlblR5cGUgPSBxdWVyeS50b2tlbl90eXBlO1xuICAgICAgICBjb25zdCBleHBpcmVzSW4gPSBxdWVyeS5leHBpcmVzSW47XG5cbiAgICAgICAgaWYgKHRva2VuKSB7XG4gICAgICAgICAgdGhpcy5zZXRUb2tlbih0b2tlbilcbiAgICAgICAgICB0aGlzLmVtaXQoJ2xvZ2luJyk7XG4gICAgICAgICAgdGhpcy5fbG9nKCdMb2dnZWQgaW4uJyk7XG5cbiAgICAgICAgICBpZiAocmVmcmVzaFRva2VuKSB7XG4gICAgICAgICAgICB0aGlzLnNldFJlZnJlc2hUb2tlbihyZWZyZXNoVG9rZW4pO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIHJldHVybiByZXNvbHZlKHRva2VuKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiByZWplY3QobnVsbCk7XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBnZXRDb2RlRnJvbVVybCgpIHtcbiAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgIGNvbnN0IHF1ZXJ5ID0gcXMucGFyc2Uod2luZG93LmxvY2F0aW9uLnNlYXJjaC5zdWJzdHIoMSkpO1xuICAgICAgICBjb25zdCBjb2RlID0gcXVlcnkuY29kZTtcblxuICAgICAgICBpZiAoY29kZSkge1xuICAgICAgICAgIHJldHVybiByZXNvbHZlKGNvZGUpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHJlamVjdChudWxsKTtcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIHNldFRva2VuKHRva2VuKSB7XG4gICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICBpZiAodHlwZW9mIHRva2VuID09PSAnc3RyaW5nJykge1xuICAgICAgICAgIHRoaXMuX3Rva2VuID0gdG9rZW47XG4gICAgICAgICAgdGhpcy5lbWl0KCd0b2tlblNldCcpO1xuICAgICAgICAgIHRoaXMuX2xvZygnVG9rZW4gc2V0LicpO1xuICAgICAgICAgIHJlc29sdmUodGhpcy5fdG9rZW4pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGNvbnN0IGVycm9yID0gbmV3IFR5cGVFcnJvcignYHRva2VuYCBtdXN0IGJlIGEgc3RyaW5nLicpO1xuICAgICAgICAgIHRoaXMuX2xvZyhlcnJvcik7XG4gICAgICAgICAgcmVqZWN0KGVycm9yKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgc2V0UmVmcmVzaFRva2VuKHJlZnJlc2hUb2tlbikge1xuICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgaWYgKHR5cGVvZiByZWZyZXNoVG9rZW4gPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgdGhpcy5fcmVmcmVzaFRva2VuID0gcmVmcmVzaFRva2VuO1xuICAgICAgICAgIHRoaXMuZW1pdCgncmVmcmVzaFRva2VuU2V0Jyk7XG4gICAgICAgICAgdGhpcy5fbG9nKCdSZWZyZXNoIHRva2VuIHNldC4nKTtcbiAgICAgICAgICByZXNvbHZlKHRoaXMuX3JlZnJlc2hUb2tlbik7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgY29uc3QgZXJyb3IgPSBuZXcgVHlwZUVycm9yKCdgcmVmcmVzaFRva2VuYCBtdXN0IGJlIGEgc3RyaW5nLicpO1xuICAgICAgICAgIHRoaXMuX2xvZyhlcnJvcik7XG4gICAgICAgICAgcmVqZWN0KGVycm9yKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgc2V0Q2xpZW50SWQoY2xpZW50SWQpIHtcbiAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgIGlmICh0eXBlb2YgY2xpZW50SWQgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgdGhpcy5fY2xpZW50SWQgPSBjbGllbnRJZDtcbiAgICAgICAgICByZXNvbHZlKHRoaXMuX2NsaWVudElkKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBjb25zdCBlcnJvciA9IG5ldyBUeXBlRXJyb3IoJ2BjbGllbnRJZGAgbXVzdCBiZSBhIHN0cmluZy4nKTtcbiAgICAgICAgICB0aGlzLl9sb2coZXJyb3IpO1xuICAgICAgICAgIHJlamVjdChlcnJvcik7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH1cblxuICAgIHNldENsaWVudFNlY3JldChjbGllbnRTZWNyZXQpIHtcbiAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgIGlmICh0eXBlb2YgY2xpZW50U2VjcmV0ID09PSAnc3RyaW5nJykge1xuICAgICAgICAgIHRoaXMuX2NsaWVudFNlY3JldCA9IGNsaWVudFNlY3JldDtcbiAgICAgICAgICByZXNvbHZlKHRoaXMuX2NsaWVudFNlY3JldCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgY29uc3QgZXJyb3IgPSBuZXcgVHlwZUVycm9yKCdgY2xpZW50U2VjcmV0YCBtdXN0IGJlIGEgc3RyaW5nJyk7XG4gICAgICAgICAgdGhpcy5fbG9nKGVycm9yKTtcbiAgICAgICAgICByZWplY3QoZXJyb3IpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBzZXREZXZpY2VJZChkZXZpY2VJZCkge1xuICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgaWYgKHR5cGVvZiBkZXZpY2VJZCA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICB0aGlzLl9kZXZpY2VJZCA9IGRldmljZUlkO1xuICAgICAgICAgIHJlc29sdmUodGhpcy5fZGV2aWNlSWQpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGNvbnN0IGVycm9yID0gbmV3IFR5cGVFcnJvcignYGRldmljZUlkYCBtdXN0IGJlIGEgc3RyaW5nLicpO1xuICAgICAgICAgIHRoaXMuX2xvZyhlcnJvcik7XG4gICAgICAgICAgcmVqZWN0KGVycm9yKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgc2V0RGV2aWNlU2VyaWFsTnVtYmVyKGRldmljZVNlcmlhbE51bWJlcikge1xuICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgaWYgKHR5cGVvZiBkZXZpY2VTZXJpYWxOdW1iZXIgPT09ICdudW1iZXInIHx8IHR5cGVvZiBkZXZpY2VTZXJpYWxOdW1iZXIgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgdGhpcy5fZGV2aWNlU2VyaWFsTnVtYmVyID0gZGV2aWNlU2VyaWFsTnVtYmVyO1xuICAgICAgICAgIHJlc29sdmUodGhpcy5fZGV2aWNlU2VyaWFsTnVtYmVyKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBjb25zdCBlcnJvciA9IG5ldyBUeXBlRXJyb3IoJ2BkZXZpY2VTZXJpYWxOdW1iZXJgIG11c3QgYmUgYSBudW1iZXIgb3Igc3RyaW5nLicpO1xuICAgICAgICAgIHRoaXMuX2xvZyhlcnJvcik7XG4gICAgICAgICAgcmVqZWN0KGVycm9yKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgc2V0UmVkaXJlY3RVcmkocmVkaXJlY3RVcmkpIHtcbiAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgIGlmICh0eXBlb2YgcmVkaXJlY3RVcmkgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgdGhpcy5fcmVkaXJlY3RVcmkgPSByZWRpcmVjdFVyaTtcbiAgICAgICAgICByZXNvbHZlKHRoaXMuX3JlZGlyZWN0VXJpKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBjb25zdCBlcnJvciA9IG5ldyBUeXBlRXJyb3IoJ2ByZWRpcmVjdFVyaWAgbXVzdCBiZSBhIHN0cmluZy4nKTtcbiAgICAgICAgICB0aGlzLl9sb2coZXJyb3IpO1xuICAgICAgICAgIHJlamVjdChlcnJvcik7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH1cblxuICAgIHNldERlYnVnKGRlYnVnKSB7XG4gICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICBpZiAodHlwZW9mIGRlYnVnID09PSAnYm9vbGVhbicpIHtcbiAgICAgICAgICB0aGlzLl9kZWJ1ZyA9IGRlYnVnO1xuICAgICAgICAgIHJlc29sdmUodGhpcy5fZGVidWcpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGNvbnN0IGVycm9yID0gbmV3IFR5cGVFcnJvcignYGRlYnVnYCBtdXN0IGJlIGEgYm9vbGVhbi4nKTtcbiAgICAgICAgICB0aGlzLl9sb2coZXJyb3IpO1xuICAgICAgICAgIHJlamVjdChlcnJvcik7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH1cblxuICAgIGdldFRva2VuKCkge1xuICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgY29uc3QgdG9rZW4gPSB0aGlzLl90b2tlbjtcblxuICAgICAgICBpZiAodG9rZW4pIHtcbiAgICAgICAgICByZXR1cm4gcmVzb2x2ZSh0b2tlbik7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gcmVqZWN0KCk7XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBnZXRSZWZyZXNoVG9rZW4oKSB7XG4gICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICBjb25zdCByZWZyZXNoVG9rZW4gPSB0aGlzLl9yZWZyZXNoVG9rZW47XG5cbiAgICAgICAgaWYgKHJlZnJlc2hUb2tlbikge1xuICAgICAgICAgIHJldHVybiByZXNvbHZlKHJlZnJlc2hUb2tlbik7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gcmVqZWN0KCk7XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICByZXF1ZXN0TWljKCkge1xuICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgdGhpcy5fbG9nKCdSZXF1ZXN0aW5nIG1pY3JvcGhvbmUuJyk7XG4gICAgICAgIG5hdmlnYXRvci5nZXRVc2VyTWVkaWEoe1xuICAgICAgICAgICAgYXVkaW86IHRydWVcbiAgICAgICAgfSwgKHN0cmVhbSkgPT4ge1xuICAgICAgICAgICAgdGhpcy5fbG9nKCdNaWNyb3Bob25lIGNvbm5lY3RlZC4nKTtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmNvbm5lY3RNZWRpYVN0cmVhbShzdHJlYW0pLnRoZW4oKCkgPT4ge1xuICAgICAgICAgICAgICByZXR1cm4gcmVzb2x2ZShzdHJlYW0pO1xuICAgICAgICB9KX0sIChlcnJvcikgPT4ge1xuICAgICAgICAgIHRoaXMuX2xvZygnZXJyb3InLCBlcnJvcik7XG4gICAgICAgICAgdGhpcy5lbWl0KCdlcnJvcicsIGVycm9yKTtcbiAgICAgICAgICByZXR1cm4gcmVqZWN0KGVycm9yKTtcbiAgICAgICAgfSk7XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBjb25uZWN0TWVkaWFTdHJlYW0oc3RyZWFtKSB7XG4gICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICBjb25zdCBpc01lZGlhU3RyZWFtID0gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKHN0cmVhbSkgPT09ICdbb2JqZWN0IE1lZGlhU3RyZWFtXSc7XG5cbiAgICAgICAgaWYgKCFpc01lZGlhU3RyZWFtKSB7XG4gICAgICAgICAgY29uc3QgZXJyb3IgPSBuZXcgVHlwZUVycm9yKCdBcmd1bWVudCBtdXN0IGJlIGEgYE1lZGlhU3RyZWFtYCBvYmplY3QuJylcbiAgICAgICAgICB0aGlzLl9sb2coJ2Vycm9yJywgZXJyb3IpXG4gICAgICAgICAgdGhpcy5lbWl0KCdlcnJvcicsIGVycm9yKTtcbiAgICAgICAgICByZXR1cm4gcmVqZWN0KGVycm9yKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX2F1ZGlvQ29udGV4dCA9IG5ldyBBdWRpb0NvbnRleHQoKTtcbiAgICAgICAgdGhpcy5fc2FtcGxlUmF0ZSA9IHRoaXMuX2F1ZGlvQ29udGV4dC5zYW1wbGVSYXRlO1xuXG4gICAgICAgIHRoaXMuX2xvZyhgU2FtcGxlIHJhdGU6ICR7dGhpcy5fc2FtcGxlUmF0ZX0uYCk7XG5cbiAgICAgICAgdGhpcy5fdm9sdW1lTm9kZSA9IHRoaXMuX2F1ZGlvQ29udGV4dC5jcmVhdGVHYWluKCk7XG4gICAgICAgIHRoaXMuX2F1ZGlvSW5wdXQgPSB0aGlzLl9hdWRpb0NvbnRleHQuY3JlYXRlTWVkaWFTdHJlYW1Tb3VyY2Uoc3RyZWFtKTtcblxuICAgICAgICB0aGlzLl9hdWRpb0lucHV0LmNvbm5lY3QodGhpcy5fdm9sdW1lTm9kZSk7XG5cbiAgICAgICAgdGhpcy5fcmVjb3JkZXIgPSB0aGlzLl9hdWRpb0NvbnRleHQuY3JlYXRlU2NyaXB0UHJvY2Vzc29yKHRoaXMuX2J1ZmZlclNpemUsIHRoaXMuX2lucHV0Q2hhbm5lbHMsIHRoaXMuX291dHB1dENoYW5uZWxzKTtcblxuICAgICAgICB0aGlzLl9yZWNvcmRlci5vbmF1ZGlvcHJvY2VzcyA9IChldmVudCkgPT4ge1xuICAgICAgICAgICAgaWYgKCF0aGlzLl9pc1JlY29yZGluZykge1xuICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IGxlZnQgPSBldmVudC5pbnB1dEJ1ZmZlci5nZXRDaGFubmVsRGF0YSgwKTtcbiAgICAgICAgICAgIHRoaXMuX2xlZnRDaGFubmVsLnB1c2gobmV3IEZsb2F0MzJBcnJheShsZWZ0KSk7XG5cbiAgICAgICAgICAgIGlmICh0aGlzLl9pbnB1dENoYW5uZWxzID4gMSkge1xuICAgICAgICAgICAgICBjb25zdCByaWdodCA9IGV2ZW50LmlucHV0QnVmZmVyLmdldENoYW5uZWxEYXRhKDEpO1xuICAgICAgICAgICAgICB0aGlzLl9yaWdodENoYW5uZWwucHVzaChuZXcgRmxvYXQzMkFycmF5KHJpZ2h0KSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMuX3JlY29yZGluZ0xlbmd0aCArPSB0aGlzLl9idWZmZXJTaXplO1xuICAgICAgICB9O1xuXG4gICAgICAgIHRoaXMuX3ZvbHVtZU5vZGUuY29ubmVjdCh0aGlzLl9yZWNvcmRlcik7XG4gICAgICAgIHRoaXMuX3JlY29yZGVyLmNvbm5lY3QodGhpcy5fYXVkaW9Db250ZXh0LmRlc3RpbmF0aW9uKTtcbiAgICAgICAgdGhpcy5fbG9nKGBNZWRpYSBzdHJlYW0gY29ubmVjdGVkLmApO1xuXG4gICAgICAgIHJldHVybiByZXNvbHZlKCk7XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBzdGFydFJlY29yZGluZygpIHtcbiAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgIGlmICghdGhpcy5fYXVkaW9JbnB1dCkge1xuICAgICAgICAgIGNvbnN0IGVycm9yID0gbmV3IEVycm9yKCdObyBNZWRpYSBTdHJlYW0gY29ubmVjdGVkLicpO1xuICAgICAgICAgIHRoaXMuX2xvZygnZXJyb3InLCBlcnJvcik7XG4gICAgICAgICAgdGhpcy5lbWl0KCdlcnJvcicsIGVycm9yKTtcbiAgICAgICAgICByZXR1cm4gcmVqZWN0KGVycm9yKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX2lzUmVjb3JkaW5nID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5fbGVmdENoYW5uZWwubGVuZ3RoID0gdGhpcy5fcmlnaHRDaGFubmVsLmxlbmd0aCA9IDA7XG4gICAgICAgIHRoaXMuX3JlY29yZGluZ0xlbmd0aCA9IDA7XG4gICAgICAgIHRoaXMuX2xvZyhgUmVjb3JkaW5nIHN0YXJ0ZWQuYCk7XG4gICAgICAgIHRoaXMuZW1pdCgncmVjb3JkU3RhcnQnKTtcblxuICAgICAgICByZXR1cm4gcmVzb2x2ZSgpO1xuICAgICAgfSk7XG4gICAgfVxuXG4gICAgc3RvcFJlY29yZGluZygpIHtcbiAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgIGlmICghdGhpcy5faXNSZWNvcmRpbmcpIHtcbiAgICAgICAgICB0aGlzLmVtaXQoJ3JlY29yZFN0b3AnKTtcbiAgICAgICAgICB0aGlzLl9sb2coJ1JlY29yZGluZyBzdG9wcGVkLicpO1xuICAgICAgICAgIHJldHVybiByZXNvbHZlKCk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9pc1JlY29yZGluZyA9IGZhbHNlO1xuXG4gICAgICAgIGNvbnN0IGxlZnRCdWZmZXIgPSBIZWxwZXJzLm1lcmdlQnVmZmVycyh0aGlzLl9sZWZ0Q2hhbm5lbCwgdGhpcy5fcmVjb3JkaW5nTGVuZ3RoKTtcbiAgICAgICAgbGV0IGludGVybGVhdmVkID0gbnVsbDtcblxuICAgICAgICBpZiAodGhpcy5fb3V0cHV0Q2hhbm5lbHMgPiAxKSB7XG4gICAgICAgICAgY29uc3QgcmlnaHRCdWZmZXIgPSBIZWxwZXJzLm1lcmdlQnVmZmVycyh0aGlzLl9yaWdodENoYW5uZWwsIHRoaXMuX3JlY29yZGluZ0xlbmd0aCk7XG4gICAgICAgICAgaW50ZXJsZWF2ZWQgPSBIZWxwZXJzLmludGVybGVhdmUobGVmdEJ1ZmZlciwgcmlnaHRCdWZmZXIpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGludGVybGVhdmVkID0gSGVscGVycy5pbnRlcmxlYXZlKGxlZnRCdWZmZXIpO1xuICAgICAgICB9XG5cbiAgICAgICAgaW50ZXJsZWF2ZWQgPSBIZWxwZXJzLmRvd25zYW1wbGVCdWZmZXIoaW50ZXJsZWF2ZWQsIHRoaXMuX3NhbXBsZVJhdGUsIHRoaXMuX291dHB1dFNhbXBsZVJhdGUpO1xuXG4gICAgICAgIGNvbnN0IGJ1ZmZlciA9IG5ldyBBcnJheUJ1ZmZlcig0NCArIGludGVybGVhdmVkLmxlbmd0aCAqIDIpO1xuICAgICAgICBjb25zdCB2aWV3ID0gbmV3IERhdGFWaWV3KGJ1ZmZlcik7XG5cbiAgICAgIC8qKlxuICAgICAgICogQGNyZWRpdCBodHRwczovL2dpdGh1Yi5jb20vbWF0dGRpYW1vbmQvUmVjb3JkZXJqc1xuICAgICAgICovXG4gICAgICAgIEhlbHBlcnMud3JpdGVVVEZCeXRlcyh2aWV3LCAwLCAnUklGRicpO1xuICAgICAgICB2aWV3LnNldFVpbnQzMig0LCA0NCArIGludGVybGVhdmVkLmxlbmd0aCAqIDIsIHRydWUpO1xuICAgICAgICBIZWxwZXJzLndyaXRlVVRGQnl0ZXModmlldywgOCwgJ1dBVkUnKTtcbiAgICAgICAgSGVscGVycy53cml0ZVVURkJ5dGVzKHZpZXcsIDEyLCAnZm10ICcpO1xuICAgICAgICB2aWV3LnNldFVpbnQzMigxNiwgMTYsIHRydWUpO1xuICAgICAgICB2aWV3LnNldFVpbnQxNigyMCwgMSwgdHJ1ZSk7XG4gICAgICAgIHZpZXcuc2V0VWludDE2KDIyLCB0aGlzLl9vdXRwdXRDaGFubmVscywgdHJ1ZSk7XG4gICAgICAgIHZpZXcuc2V0VWludDMyKDI0LCB0aGlzLl9vdXRwdXRTYW1wbGVSYXRlLCB0cnVlKTtcbiAgICAgICAgdmlldy5zZXRVaW50MzIoMjgsIHRoaXMuX291dHB1dFNhbXBsZVJhdGUgKiA0LCB0cnVlKTtcbiAgICAgICAgdmlldy5zZXRVaW50MTYoMzIsIDQsIHRydWUpO1xuICAgICAgICB2aWV3LnNldFVpbnQxNigzNCwgMTYsIHRydWUpO1xuICAgICAgICBIZWxwZXJzLndyaXRlVVRGQnl0ZXModmlldywgMzYsICdkYXRhJyk7XG4gICAgICAgIHZpZXcuc2V0VWludDMyKDQwLCBpbnRlcmxlYXZlZC5sZW5ndGggKiAyLCB0cnVlKTtcblxuICAgICAgICBjb25zdCBsZW5ndGggPSBpbnRlcmxlYXZlZC5sZW5ndGg7XG4gICAgICAgIGNvbnN0IHZvbHVtZSA9IDE7XG4gICAgICAgIGxldCBpbmRleCA9IDQ0O1xuXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspe1xuICAgICAgICAgIHZpZXcuc2V0SW50MTYoaW5kZXgsIGludGVybGVhdmVkW2ldICogKDB4N0ZGRiAqIHZvbHVtZSksIHRydWUpO1xuICAgICAgICAgIGluZGV4ICs9IDI7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9sb2coYFJlY29yZGluZyBzdG9wcGVkLmApO1xuICAgICAgICB0aGlzLmVtaXQoJ3JlY29yZFN0b3AnKTtcbiAgICAgICAgcmV0dXJuIHJlc29sdmUodmlldyk7XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBwbGF5QmxvYihibG9iKSB7XG4gICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICBpZiAoIWJsb2IpIHtcbiAgICAgICAgICByZWplY3QoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IG9iamVjdFVybCA9IFVSTC5jcmVhdGVPYmplY3RVUkwoYmxvYik7XG4gICAgICAgIGNvbnN0IGF1ZGlvID0gbmV3IEF1ZGlvKCk7XG4gICAgICAgIGF1ZGlvLnNyYyA9IG9iamVjdFVybDtcblxuICAgICAgICBhdWRpby5hZGRFdmVudExpc3RlbmVyKCdlbmRlZCcsICgpID0+IHtcbiAgICAgICAgICB0aGlzLl9sb2coJ0F1ZGlvIHBsYXkgZW5kZWQuJyk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGF1ZGlvLm9ubG9hZCA9IChldmVudCkgPT4ge1xuICAgICAgICAgIFVSTC5yZXZva2VPYmplY3RVcmwob2JqZWN0VXJsKTtcbiAgICAgICAgfTtcblxuICAgICAgICB0aGlzLl9sb2coJ0F1ZGlvIHBsYXkgc3RhcnRlZC4nKTtcbiAgICAgICAgYXVkaW8ucGxheSgpO1xuXG4gICAgICAgIHJlc29sdmUoKTtcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIHNlbmRBdWRpbyAoZGF0YVZpZXcpIHtcbiAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgIGNvbnN0IHhociA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xuICAgICAgICBjb25zdCB1cmwgPSAnaHR0cHM6Ly9hY2Nlc3MtYWxleGEtbmEuYW1hem9uLmNvbS92MS9hdnMvc3BlZWNocmVjb2duaXplci9yZWNvZ25pemUnO1xuXG4gICAgICAgIHhoci5vcGVuKCdQT1NUJywgdXJsLCB0cnVlKTtcbiAgICAgICAgeGhyLnJlc3BvbnNlVHlwZSA9ICdhcnJheWJ1ZmZlcic7XG4gICAgICAgIHhoci5vbmxvYWQgPSAoZXZlbnQpID0+IHtcbiAgICAgICAgICBjb25zb2xlLmxvZygnUkVTUE9OU0UnLCB4aHIucmVzcG9uc2UpO1xuXG4gICAgICAgICAgY29uc3QgYnVmZmVyID0gbmV3IEJ1ZmZlcih4aHIucmVzcG9uc2UpO1xuXG4gICAgICAgICAgaWYgKHhoci5zdGF0dXMgPT09IDIwMCkge1xuICAgICAgICAgICAgY29uc3QgcGFyc2VkTWVzc2FnZSA9IGh0dHBNZXNzYWdlUGFyc2VyKGJ1ZmZlcik7XG4gICAgICAgICAgICByZXNvbHZlKHBhcnNlZE1lc3NhZ2UpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBsZXQgZXJyb3IgPSBuZXcgRXJyb3IoJ0FuIGVycm9yIG9jY3VyZWQgd2l0aCByZXF1ZXN0LicpO1xuICAgICAgICAgICAgbGV0IHJlc3BvbnNlID0ge307XG5cbiAgICAgICAgICAgIGlmICgheGhyLnJlc3BvbnNlLmJ5dGVMZW5ndGgpIHtcbiAgICAgICAgICAgICAgZXJyb3IgPSBuZXcgRXJyb3IoJ0VtcHR5IHJlc3BvbnNlLicpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICByZXNwb25zZSA9IEpTT04ucGFyc2UoSGVscGVycy5hcnJheUJ1ZmZlclRvU3RyaW5nKGJ1ZmZlcikpO1xuICAgICAgICAgICAgICB9IGNhdGNoKGVycikge1xuICAgICAgICAgICAgICAgIGVycm9yID0gZXJyO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChyZXNwb25zZS5lcnJvciBpbnN0YW5jZW9mIE9iamVjdCkge1xuICAgICAgICAgICAgICBpZiAocmVzcG9uc2UuZXJyb3IuY29kZSkge1xuICAgICAgICAgICAgICAgIC8vIHJlZnJlc2ggdG9rZW4/XG4gICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICBlcnJvciA9IHJlc3BvbnNlLmVycm9yLm1lc3NhZ2U7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMuZW1pdCgnZXJyb3InLCBlcnJvcik7XG4gICAgICAgICAgICByZXR1cm4gcmVqZWN0KGVycm9yKTtcbiAgICAgICAgICB9XG4gICAgICAgIH07XG5cbiAgICAgICAgeGhyLm9uZXJyb3IgPSAoZXJyb3IpID0+IHtcbiAgICAgICAgICB0aGlzLl9sb2coZXJyb3IpO1xuICAgICAgICAgIHJlamVjdChlcnJvcik7XG4gICAgICAgIH07XG5cbiAgICAgICAgY29uc3QgQk9VTkRBUlkgPSAnQk9VTkRBUlkxMjM0JztcbiAgICAgICAgY29uc3QgQk9VTkRBUllfREFTSEVTID0gJy0tJztcbiAgICAgICAgY29uc3QgTkVXTElORSA9ICdcXHJcXG4nO1xuICAgICAgICBjb25zdCBNRVRBREFUQV9DT05URU5UX0RJU1BPU0lUSU9OID0gJ0NvbnRlbnQtRGlzcG9zaXRpb246IGZvcm0tZGF0YTsgbmFtZT1cIm1ldGFkYXRhXCInO1xuICAgICAgICBjb25zdCBNRVRBREFUQV9DT05URU5UX1RZUEUgPSAnQ29udGVudC1UeXBlOiBhcHBsaWNhdGlvbi9qc29uOyBjaGFyc2V0PVVURi04JztcbiAgICAgICAgY29uc3QgQVVESU9fQ09OVEVOVF9UWVBFID0gJ0NvbnRlbnQtVHlwZTogYXVkaW8vTDE2OyByYXRlPTE2MDAwOyBjaGFubmVscz0xJztcbiAgICAgICAgY29uc3QgQVVESU9fQ09OVEVOVF9ESVNQT1NJVElPTiA9ICdDb250ZW50LURpc3Bvc2l0aW9uOiBmb3JtLWRhdGE7IG5hbWU9XCJhdWRpb1wiJztcblxuICAgICAgICBjb25zdCBtZXRhZGF0YSA9IHtcbiAgICAgICAgICBtZXNzYWdlSGVhZGVyOiB7fSxcbiAgICAgICAgICBtZXNzYWdlQm9keToge1xuICAgICAgICAgICAgcHJvZmlsZTogJ2FsZXhhLWNsb3NlLXRhbGsnLFxuICAgICAgICAgICAgbG9jYWxlOiAnZW4tdXMnLFxuICAgICAgICAgICAgZm9ybWF0OiAnYXVkaW8vTDE2OyByYXRlPTE2MDAwOyBjaGFubmVscz0xJ1xuICAgICAgICAgIH1cbiAgICAgICAgfTtcblxuICAgICAgICBjb25zdCBwb3N0RGF0YVN0YXJ0ID0gW1xuICAgICAgICAgIE5FV0xJTkUsIEJPVU5EQVJZX0RBU0hFUywgQk9VTkRBUlksIE5FV0xJTkUsIE1FVEFEQVRBX0NPTlRFTlRfRElTUE9TSVRJT04sIE5FV0xJTkUsIE1FVEFEQVRBX0NPTlRFTlRfVFlQRSxcbiAgICAgICAgICBORVdMSU5FLCBORVdMSU5FLCBKU09OLnN0cmluZ2lmeShtZXRhZGF0YSksIE5FV0xJTkUsIEJPVU5EQVJZX0RBU0hFUywgQk9VTkRBUlksIE5FV0xJTkUsXG4gICAgICAgICAgQVVESU9fQ09OVEVOVF9ESVNQT1NJVElPTiwgTkVXTElORSwgQVVESU9fQ09OVEVOVF9UWVBFLCBORVdMSU5FLCBORVdMSU5FXG4gICAgICAgIF0uam9pbignJyk7XG5cbiAgICAgICAgY29uc3QgcG9zdERhdGFFbmQgPSBbTkVXTElORSwgQk9VTkRBUllfREFTSEVTLCBCT1VOREFSWSwgQk9VTkRBUllfREFTSEVTLCBORVdMSU5FXS5qb2luKCcnKTtcblxuICAgICAgICBjb25zdCBzaXplID0gcG9zdERhdGFTdGFydC5sZW5ndGggKyBkYXRhVmlldy5ieXRlTGVuZ3RoICsgcG9zdERhdGFFbmQubGVuZ3RoO1xuICAgICAgICBjb25zdCB1aW50OEFycmF5ID0gbmV3IFVpbnQ4QXJyYXkoc2l6ZSk7XG4gICAgICAgIGxldCBpID0gMDtcblxuICAgICAgICBmb3IgKDsgaSA8IHBvc3REYXRhU3RhcnQubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICB1aW50OEFycmF5W2ldID0gcG9zdERhdGFTdGFydC5jaGFyQ29kZUF0KGkpICYgMHhGRjtcbiAgICAgICAgfVxuXG4gICAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgZGF0YVZpZXcuYnl0ZUxlbmd0aCA7IGkrKywgaisrKSB7XG4gICAgICAgICAgdWludDhBcnJheVtpXSA9IGRhdGFWaWV3LmdldFVpbnQ4KGopO1xuICAgICAgICB9XG5cbiAgICAgICAgZm9yIChsZXQgaiA9IDA7IGogPCBwb3N0RGF0YUVuZC5sZW5ndGg7IGkrKywgaisrKSB7XG4gICAgICAgICAgdWludDhBcnJheVtpXSA9IHBvc3REYXRhRW5kLmNoYXJDb2RlQXQoaikgJiAweEZGO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgcGF5bG9hZCA9IHVpbnQ4QXJyYXkuYnVmZmVyO1xuXG4gICAgICAgIHhoci5zZXRSZXF1ZXN0SGVhZGVyKCdBdXRob3JpemF0aW9uJywgYEJlYXJlciAke3RoaXMuX3Rva2VufWApO1xuICAgICAgICB4aHIuc2V0UmVxdWVzdEhlYWRlcignQ29udGVudC1UeXBlJywgJ211bHRpcGFydC9mb3JtLWRhdGE7IGJvdW5kYXJ5PScgKyBCT1VOREFSWSk7XG4gICAgICAgIHhoci5zZW5kKHBheWxvYWQpO1xuICAgICAgfSk7XG4gICAgfVxuXG4gICAgc3RhdGljIGdldCBFdmVudFR5cGVzKCkge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgTE9HOiAnbG9nJyxcbiAgICAgICAgRVJST1I6ICdlcnJvcicsXG4gICAgICAgIExPR0lOOiAnbG9naW4nLFxuICAgICAgICBMT0dPVVQ6ICdsb2dvdXQnLFxuICAgICAgICBSRUNPUkRfU1RBUlQ6ICdyZWNvcmRTdGFydCcsXG4gICAgICAgIFJFQ09SRF9TVE9QOiAncmVjb3JkU3RvcCcsXG4gICAgICAgIFRPS0VOX1NFVDogJ3Rva2VuU2V0JyxcbiAgICAgICAgUkVGUkVTSF9UT0tFTl9TRVQ6ICdyZWZyZXNoVG9rZW5TZXQnXG4gICAgICB9O1xuICAgIH1cbiAgfVxuXG4gIGNsYXNzIEhlbHBlcnMge1xuICAgIC8qKlxuICAgICAqIEBjcmVkaXQgaHR0cDovL3N0YWNrb3ZlcmZsb3cuY29tL2EvMjYyNDUyNjBcbiAgICAgKi9cbiAgICBzdGF0aWMgZG93bnNhbXBsZUJ1ZmZlcihidWZmZXIsIGlucHV0U2FtcGxlUmF0ZSwgb3V0cHV0U2FtcGxlUmF0ZSkge1xuICAgICAgaWYgKGlucHV0U2FtcGxlUmF0ZSA9PT0gb3V0cHV0U2FtcGxlUmF0ZSkge1xuICAgICAgICByZXR1cm4gYnVmZmVyO1xuICAgICAgfVxuXG4gICAgICBpZiAoaW5wdXRTYW1wbGVSYXRlIDwgb3V0cHV0U2FtcGxlUmF0ZSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ091dHB1dCBzYW1wbGUgcmF0ZSBtdXN0IGJlIGxlc3MgdGhhbiBpbnB1dCBzYW1wbGUgcmF0ZS4nKTtcbiAgICAgIH1cblxuICAgICAgY29uc3Qgc2FtcGxlUmF0ZVJhdGlvID0gaW5wdXRTYW1wbGVSYXRlIC8gb3V0cHV0U2FtcGxlUmF0ZTtcbiAgICAgIGNvbnN0IG5ld0xlbmd0aCA9IE1hdGgucm91bmQoYnVmZmVyLmxlbmd0aCAvIHNhbXBsZVJhdGVSYXRpbyk7XG4gICAgICBsZXQgcmVzdWx0ID0gbmV3IEZsb2F0MzJBcnJheShuZXdMZW5ndGgpO1xuICAgICAgbGV0IG9mZnNldFJlc3VsdCA9IDA7XG4gICAgICBsZXQgb2Zmc2V0QnVmZmVyID0gMDtcblxuICAgICAgd2hpbGUgKG9mZnNldFJlc3VsdCA8IHJlc3VsdC5sZW5ndGgpIHtcbiAgICAgICAgbGV0IG5leHRPZmZzZXRCdWZmZXIgPSBNYXRoLnJvdW5kKChvZmZzZXRSZXN1bHQgKyAxKSAqIHNhbXBsZVJhdGVSYXRpbyk7XG4gICAgICAgIGxldCBhY2N1bSA9IDA7XG4gICAgICAgIGxldCBjb3VudCA9IDA7XG5cbiAgICAgICAgZm9yICh2YXIgaSA9IG9mZnNldEJ1ZmZlcjsgaSA8IG5leHRPZmZzZXRCdWZmZXIgJiYgaSA8IGJ1ZmZlci5sZW5ndGg7IGkrKykge1xuICAgICAgICAgIGFjY3VtICs9IGJ1ZmZlcltpXTtcbiAgICAgICAgICBjb3VudCsrO1xuICAgICAgICB9XG5cbiAgICAgICAgcmVzdWx0W29mZnNldFJlc3VsdF0gPSBhY2N1bSAvIGNvdW50O1xuICAgICAgICBvZmZzZXRSZXN1bHQrKztcbiAgICAgICAgb2Zmc2V0QnVmZmVyID0gbmV4dE9mZnNldEJ1ZmZlcjtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAY3JlZGl0IGh0dHBzOi8vZ2l0aHViLmNvbS9tYXR0ZGlhbW9uZC9SZWNvcmRlcmpzXG4gICAgICovXG4gICAgc3RhdGljIGludGVybGVhdmUobGVmdENoYW5uZWwsIHJpZ2h0Q2hhbm5lbCl7XG4gICAgICBpZiAobGVmdENoYW5uZWwgJiYgIXJpZ2h0Q2hhbm5lbCkge1xuICAgICAgICByZXR1cm4gbGVmdENoYW5uZWw7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IGxlbmd0aCA9IGxlZnRDaGFubmVsLmxlbmd0aCArIHJpZ2h0Q2hhbm5lbC5sZW5ndGg7XG4gICAgICBsZXQgcmVzdWx0ID0gbmV3IEZsb2F0MzJBcnJheShsZW5ndGgpO1xuICAgICAgbGV0IGlucHV0SW5kZXggPSAwO1xuXG4gICAgICBmb3IgKGxldCBpbmRleCA9IDA7IGluZGV4IDwgbGVuZ3RoOyApe1xuICAgICAgICByZXN1bHRbaW5kZXgrK10gPSBsZWZ0Q2hhbm5lbFtpbnB1dEluZGV4XTtcbiAgICAgICAgcmVzdWx0W2luZGV4KytdID0gcmlnaHRDaGFubmVsW2lucHV0SW5kZXhdO1xuICAgICAgICBpbnB1dEluZGV4Kys7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQGNyZWRpdCBodHRwczovL2dpdGh1Yi5jb20vbWF0dGRpYW1vbmQvUmVjb3JkZXJqc1xuICAgICAqL1xuICAgIHN0YXRpYyBtZXJnZUJ1ZmZlcnMoY2hhbm5lbEJ1ZmZlciwgcmVjb3JkaW5nTGVuZ3RoKXtcbiAgICAgIGNvbnN0IHJlc3VsdCA9IG5ldyBGbG9hdDMyQXJyYXkocmVjb3JkaW5nTGVuZ3RoKTtcbiAgICAgIGNvbnN0IGxlbmd0aCA9IGNoYW5uZWxCdWZmZXIubGVuZ3RoO1xuICAgICAgbGV0IG9mZnNldCA9IDA7XG5cbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspe1xuICAgICAgICBsZXQgYnVmZmVyID0gY2hhbm5lbEJ1ZmZlcltpXTtcblxuICAgICAgICByZXN1bHQuc2V0KGJ1ZmZlciwgb2Zmc2V0KTtcbiAgICAgICAgb2Zmc2V0ICs9IGJ1ZmZlci5sZW5ndGg7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQGNyZWRpdCBodHRwczovL2dpdGh1Yi5jb20vbWF0dGRpYW1vbmQvUmVjb3JkZXJqc1xuICAgICAqL1xuICAgIHN0YXRpYyB3cml0ZVVURkJ5dGVzKHZpZXcsIG9mZnNldCwgc3RyaW5nKXtcbiAgICAgIGNvbnN0IGxlbmd0aCA9IHN0cmluZy5sZW5ndGg7XG5cbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspe1xuICAgICAgICB2aWV3LnNldFVpbnQ4KG9mZnNldCArIGksIHN0cmluZy5jaGFyQ29kZUF0KGkpKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAY3JlZGl0IGh0dHBzOi8vZGV2ZWxvcGVycy5nb29nbGUuY29tL3dlYi91cGRhdGVzLzIwMTIvMDYvSG93LXRvLWNvbnZlcnQtQXJyYXlCdWZmZXItdG8tYW5kLWZyb20tU3RyaW5nP2hsPWVuXG4gICAgICovXG4gICAgc3RhdGljIGFycmF5QnVmZmVyVG9TdHJpbmcoYnVmZmVyKSB7XG4gICAgICByZXR1cm4gU3RyaW5nLmZyb21DaGFyQ29kZS5hcHBseShudWxsLCBuZXcgVWludDE2QXJyYXkoYnVmZmVyKSk7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gb2JzZXJ2YWJsZShlbCkge1xuICAgIGxldCBjYWxsYmFja3MgPSB7fTtcblxuICAgIGVsLm9uID0gZnVuY3Rpb24obmFtZSwgZm4pIHtcbiAgICAgIGlmICh0eXBlb2YgZm4gIT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignU2Vjb25kIGFyZ3VtZW50IGZvciBcIm9uXCIgbWV0aG9kIG11c3QgYmUgYSBmdW5jdGlvbi4nKTtcbiAgICAgIH1cblxuICAgICAgKGNhbGxiYWNrc1tuYW1lXSA9IGNhbGxiYWNrc1tuYW1lXSB8fCBbXSkucHVzaChmbik7XG5cbiAgICAgIHJldHVybiBlbDtcbiAgICB9O1xuXG4gICAgZWwub25lID0gZnVuY3Rpb24obmFtZSwgZm4pIHtcbiAgICAgIGZuLm9uZSA9IHRydWU7XG4gICAgICByZXR1cm4gZWwub24uY2FsbChlbCwgbmFtZSwgZm4pO1xuICAgIH07XG5cbiAgICBlbC5vZmYgPSBmdW5jdGlvbihuYW1lLCBmbikge1xuICAgICAgaWYgKG5hbWUgPT09ICcqJykge1xuICAgICAgICBjYWxsYmFja3MgPSB7fTtcbiAgICAgICAgcmV0dXJuIGNhbGxiYWNrc1xuICAgICAgfVxuXG4gICAgICBpZiAoIWNhbGxiYWNrc1tuYW1lXSkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG5cbiAgICAgIGlmIChmbikge1xuICAgICAgICBpZiAodHlwZW9mIGZuICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignU2Vjb25kIGFyZ3VtZW50IGZvciBcIm9mZlwiIG1ldGhvZCBtdXN0IGJlIGEgZnVuY3Rpb24uJyk7XG4gICAgICAgIH1cblxuICAgICAgICBjYWxsYmFja3NbbmFtZV0gPSBjYWxsYmFja3NbbmFtZV0ubWFwKGZ1bmN0aW9uKGZtLCBpKSB7XG4gICAgICAgICAgaWYgKGZtID09PSBmbikge1xuICAgICAgICAgICAgY2FsbGJhY2tzW25hbWVdLnNwbGljZShpLCAxKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZGVsZXRlIGNhbGxiYWNrc1tuYW1lXTtcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgZWwuZW1pdCA9IGZ1bmN0aW9uKG5hbWUgLyosIGFyZ3MgKi8pIHtcbiAgICAgIGlmICghY2FsbGJhY2tzW25hbWVdIHx8ICFjYWxsYmFja3NbbmFtZV0ubGVuZ3RoKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgY29uc3QgYXJncyA9IFtdLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcblxuICAgICAgY2FsbGJhY2tzW25hbWVdLmZvckVhY2goZnVuY3Rpb24oZm4sIGkpIHtcbiAgICAgICAgaWYgKGZuKSB7XG4gICAgICAgICAgZm4uYXBwbHkoZm4sIGFyZ3MpO1xuICAgICAgICAgIGlmIChmbi5vbmUpIHtcbiAgICAgICAgICAgIGNhbGxiYWNrc1tuYW1lXS5zcGxpY2UoaSwgMSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9KTtcblxuICAgICAgcmV0dXJuIGVsO1xuICAgIH07XG5cbiAgICByZXR1cm4gZWw7XG4gIH1cblxuICBpZiAodHlwZW9mIGV4cG9ydHMgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgaWYgKHR5cGVvZiBtb2R1bGUgIT09ICd1bmRlZmluZWQnICYmIG1vZHVsZS5leHBvcnRzKSB7XG4gICAgICBleHBvcnRzID0gbW9kdWxlLmV4cG9ydHMgPSBBVlM7XG4gICAgfVxuICAgIGV4cG9ydHMuQVZTID0gQVZTO1xuICB9IGVsc2UgaWYgKHR5cGVvZiBkZWZpbmUgPT09ICdmdW5jdGlvbicgJiYgZGVmaW5lLmFtZCkge1xuICAgIGRlZmluZShbXSwgZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gQVZTO1xuICAgIH0pO1xuICB9IGVsc2Uge1xuICAgIHJvb3QuQVZTID0gQVZTO1xuICB9XG5cbn0pKHRoaXMpO1xuIiwiY29uc3QgQVZTID0gcmVxdWlyZSgnLi4vYXZzJyk7XG5jb25zdCBwbGF5ZXIgPSBBVlMuUGxheWVyO1xuXG5jb25zdCBhdnMgPSBuZXcgQVZTKHtcbiAgZGVidWc6IHRydWUsXG4gIGNsaWVudElkOiAnYW16bjEuYXBwbGljYXRpb24tb2EyLWNsaWVudC42OTZhYjkwZmM1ODQ0ZmRiYjhlZmMxNzM5NGE3OWMwMCcsXG4gIGRldmljZUlkOiAndGVzdF9kZXZpY2UnLFxuICBkZXZpY2VTZXJpYWxOdW1iZXI6IDEyMyxcbiAgcmVkaXJlY3RVcmk6IGBodHRwczovLyR7d2luZG93LmxvY2F0aW9uLmhvc3R9L2F1dGhyZXNwb25zZWBcbn0pO1xuXG5hdnMub24oQVZTLkV2ZW50VHlwZXMuVE9LRU5fU0VULCAoKSA9PiB7XG4gIGxvZ2luLmRpc2FibGVkID0gdHJ1ZTtcbiAgbG9nb3V0LmRpc2FibGVkID0gZmFsc2U7XG4gIHN0YXJ0LmRpc2FibGVkID0gZmFsc2U7XG4gIHN0b3AuZGlzYWJsZWQgPSB0cnVlO1xufSk7XG5cbmF2cy5vbihBVlMuRXZlbnRUeXBlcy5SRUNPUkRfU1RBUlQsICgpID0+IHtcbiAgc3RhcnQuZGlzYWJsZWQgPSB0cnVlO1xuICBzdG9wLmRpc2FibGVkID0gZmFsc2U7XG59KTtcblxuYXZzLm9uKEFWUy5FdmVudFR5cGVzLlJFQ09SRF9TVE9QLCAoKSA9PiB7XG4gIHN0YXJ0LmRpc2FibGVkID0gZmFsc2U7XG4gIHN0b3AuZGlzYWJsZWQgPSB0cnVlO1xufSk7XG5cbmF2cy5vbihBVlMuRXZlbnRUeXBlcy5MT0dPVVQsICgpID0+IHtcbiAgbG9naW4uZGlzYWJsZWQgPSBmYWxzZTtcbiAgbG9nb3V0LmRpc2FibGVkID0gdHJ1ZTtcbiAgc3RhcnQuZGlzYWJsZWQgPSB0cnVlO1xuICBzdG9wLmRpc2FibGVkID0gdHJ1ZTtcbn0pO1xuXG5hdnMub24oQVZTLkV2ZW50VHlwZXMuTE9HLCAobWVzc2FnZSkgPT4ge1xuICBsb2dPdXRwdXQuaW5uZXJIVE1MICs9IGA8bGk+TE9HOiAke21lc3NhZ2V9PC9saT5gO1xufSk7XG5cbmF2cy5vbihBVlMuRXZlbnRUeXBlcy5FUlJPUiwgKGVycm9yKSA9PiB7XG4gIGxvZ091dHB1dC5pbm5lckhUTUwgKz0gYDxsaT5FUlJPUjogJHtlcnJvcn08L2xpPmA7XG59KTtcblxuY29uc3QgbG9naW4gPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnbG9naW4nKTtcbmNvbnN0IGxvZ291dCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdsb2dvdXQnKTtcbmNvbnN0IGxvZ091dHB1dCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdsb2cnKTtcbmNvbnN0IHN0YXJ0ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3N0YXJ0Jyk7XG5jb25zdCBzdG9wID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3N0b3AnKTtcblxuLypcbi8vIElmIHVzaW5nIGNsaWVudCBzZWNyZXRcbmF2cy5nZXRDb2RlRnJvbVVybCgpXG4gLnRoZW4oY29kZSA9PiBhdnMuZ2V0VG9rZW5Gcm9tQ29kZShjb2RlKSlcbi50aGVuKHRva2VuID0+IGxvY2FsU3RvcmFnZS5zZXRJdGVtKCd0b2tlbicsIHRva2VuKSlcbi50aGVuKHJlZnJlc2hUb2tlbiA9PiBsb2NhbFN0b3JhZ2Uuc2V0SXRlbSgncmVmcmVzaFRva2VuJywgcmVmcmVzaFRva2VuKSlcbi50aGVuKCgpID0+IGF2cy5yZXF1ZXN0TWljKCkpXG4udGhlbigoKSA9PiBhdnMucmVmcmVzaFRva2VuKCkpXG4uY2F0Y2goKCkgPT4ge1xuXG59KTtcbiovXG5cbmF2cy5nZXRUb2tlbkZyb21VcmwoKVxuLnRoZW4oKCkgPT4gYXZzLmdldFRva2VuKCkpXG4udGhlbih0b2tlbiA9PiBsb2NhbFN0b3JhZ2Uuc2V0SXRlbSgndG9rZW4nLCB0b2tlbikpXG4udGhlbigoKSA9PiBhdnMucmVxdWVzdE1pYygpKVxuLmNhdGNoKCgpID0+IHtcbiAgY29uc3QgY2FjaGVkVG9rZW4gPSBsb2NhbFN0b3JhZ2UuZ2V0SXRlbSgndG9rZW4nKTtcblxuICBpZiAoY2FjaGVkVG9rZW4pIHtcbiAgICBhdnMuc2V0VG9rZW4oY2FjaGVkVG9rZW4pO1xuICAgIHJldHVybiBhdnMucmVxdWVzdE1pYygpO1xuICB9XG59KTtcblxubG9naW4uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoZXZlbnQpID0+IHtcbiAgYXZzLmxvZ2luKClcbiAgLnRoZW4oKCkgPT4gYXZzLnJlcXVlc3RNaWMoKSlcbiAgLmNhdGNoKCgpID0+IHt9KTtcblxuICAvKlxuICAvLyBJZiB1c2luZyBjbGllbnQgc2VjcmV0XG4gIGF2cy5sb2dpbih7cmVzcG9uc2VUeXBlOiAnY29kZSd9KVxuICAudGhlbigoKSA9PiBhdnMucmVxdWVzdE1pYygpKVxuICAuY2F0Y2goKCkgPT4ge30pO1xuICAqL1xufSk7XG5cbmxvZ291dC5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHtcbiAgYXZzLmxvZ291dCgpXG4gIC50aGVuKCgpID0+IHtcbiAgICBsb2NhbFN0b3JhZ2UucmVtb3ZlSXRlbSgndG9rZW4nKTtcbiAgICB3aW5kb3cubG9jYXRpb24uaGFzaCA9ICcnO1xuICB9KTtcbn0pO1xuXG5zdGFydC5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHtcbiAgYXZzLnN0YXJ0UmVjb3JkaW5nKCk7XG59KTtcblxuc3RvcC5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHtcbiAgYXZzLnN0b3BSZWNvcmRpbmcoKS50aGVuKGRhdGFWaWV3ID0+IHtcbiAgICBjb25zdCBibG9iID0gbmV3IEJsb2IgKFtkYXRhVmlld10sIHtcbiAgICAgIHR5cGU6ICdhdWRpby93YXYnXG4gICAgfSk7XG5cbiAgICBhdnMucGxheUJsb2IoYmxvYik7XG4gICAgLy9zZW5kQmxvYihibG9iKTtcbiAgICBhdnMuc2VuZEF1ZGlvKGRhdGFWaWV3KVxuICAgIC50aGVuKHJlc3BvbnNlID0+IHtcblxuICAgICAgd2luZG93LkF1ZGlvQ29udGV4dCA9IHdpbmRvdy5BdWRpb0NvbnRleHQgfHwgd2luZG93LndlYmtpdEF1ZGlvQ29udGV4dDtcbiAgICAgIGNvbnN0IGNvbnRleHQgPSBuZXcgQXVkaW9Db250ZXh0KCk7XG5cbiAgICAgIGNvbnN0IGludDggPSByZXNwb25zZS5tdWx0aXBhcnRbMV0uYm9keTtcbiAgICAgIGNvbnN0IGRzdCA9IG5ldyBBcnJheUJ1ZmZlcihpbnQ4LmJ5dGVMZW5ndGgpO1xuICAgICAgbmV3IFVpbnQ4QXJyYXkoZHN0KS5zZXQobmV3IFVpbnQ4QXJyYXkoaW50OCkpO1xuXG4gICAgICBjb250ZXh0LmRlY29kZUF1ZGlvRGF0YShkc3QsIGZ1bmN0aW9uKGJ1ZmZlcikge1xuICAgICAgICBwbGF5U291bmQoYnVmZmVyKTtcbiAgICAgIH0sICgpID0+IHt9KTtcblxuICAgICAgZnVuY3Rpb24gcGxheVNvdW5kKGJ1ZmZlcikge1xuICAgICAgICBjb25zdCBzb3VyY2UgPSBjb250ZXh0LmNyZWF0ZUJ1ZmZlclNvdXJjZSgpO1xuICAgICAgICBzb3VyY2UuYnVmZmVyID0gYnVmZmVyO1xuICAgICAgICBzb3VyY2UuY29ubmVjdChjb250ZXh0LmRlc3RpbmF0aW9uKTtcbiAgICAgICAgc291cmNlLnN0YXJ0KDApO1xuICAgICAgfVxuXG4gICAgfSlcbiAgfSk7XG59KTtcblxuZnVuY3Rpb24gc2VuZEJsb2IoYmxvYikge1xuICBjb25zdCB4aHIgPSBuZXcgWE1MSHR0cFJlcXVlc3QoKTtcbiAgY29uc3QgZmQgPSBuZXcgRm9ybURhdGEoKTtcblxuICBmZC5hcHBlbmQoJ2ZuYW1lJywgJ2F1ZGlvLndhdicpO1xuICBmZC5hcHBlbmQoJ2RhdGEnLCBibG9iKTtcblxuICB4aHIub3BlbignUE9TVCcsICdodHRwOi8vbG9jYWxob3N0OjU1NTUvYXVkaW8nLCB0cnVlKTtcbiAgeGhyLnJlc3BvbnNlVHlwZSA9ICdibG9iJztcblxuICB4aHIub25sb2FkID0gKGV2ZW50KSA9PiB7XG4gICAgaWYgKHhoci5zdGF0dXMgPT0gMjAwKSB7XG4gICAgICBjb25zb2xlLmxvZyh4aHIucmVzcG9uc2UpO1xuICAgICAgLy9jb25zdCByZXNwb25zZUJsb2IgPSBuZXcgQmxvYihbeGhyLnJlc3BvbnNlXSwge3R5cGU6ICdhdWRpby9tcDMnfSk7XG4gICAgfVxuICB9O1xuICB4aHIuc2VuZChmZCk7XG59XG4iLCIoZnVuY3Rpb24ocm9vdCkge1xuICAndXNlIHN0cmljdCc7XG5cbiAgZnVuY3Rpb24gaHR0cE1lc3NhZ2VQYXJzZXIobWVzc2FnZSkge1xuICAgIGNvbnN0IHJlc3VsdCA9IHtcbiAgICAgIGh0dHBWZXJzaW9uOiBudWxsLFxuICAgICAgc3RhdHVzQ29kZTogbnVsbCxcbiAgICAgIHN0YXR1c01lc3NhZ2U6IG51bGwsXG4gICAgICBtZXRob2Q6IG51bGwsXG4gICAgICB1cmw6IG51bGwsXG4gICAgICBoZWFkZXJzOiBudWxsLFxuICAgICAgYm9keTogbnVsbCxcbiAgICAgIGJvdW5kYXJ5OiBudWxsLFxuICAgICAgbXVsdGlwYXJ0OiBudWxsXG4gICAgfTtcblxuICAgIHZhciBtZXNzYWdlU3RyaW5nID0gJyc7XG4gICAgdmFyIGhlYWRlck5ld2xpbmVJbmRleCA9IDA7XG4gICAgdmFyIGZ1bGxCb3VuZGFyeSA9IG51bGw7XG5cbiAgICBpZiAoaHR0cE1lc3NhZ2VQYXJzZXIuX2lzQnVmZmVyKG1lc3NhZ2UpKSB7XG4gICAgICBtZXNzYWdlU3RyaW5nID0gbWVzc2FnZS50b1N0cmluZygpO1xuICAgIH0gZWxzZSBpZiAodHlwZW9mIG1lc3NhZ2UgPT09ICdzdHJpbmcnKSB7XG4gICAgICBtZXNzYWdlU3RyaW5nID0gbWVzc2FnZTtcbiAgICAgIG1lc3NhZ2UgPSBodHRwTWVzc2FnZVBhcnNlci5fY3JlYXRlQnVmZmVyKG1lc3NhZ2VTdHJpbmcpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH1cblxuICAgIC8qXG4gICAgICogU3RyaXAgZXh0cmEgcmV0dXJuIGNoYXJhY3RlcnNcbiAgICAgKi9cbiAgICBtZXNzYWdlU3RyaW5nID0gbWVzc2FnZVN0cmluZy5yZXBsYWNlKC9cXHJcXG4vZ2ltLCAnXFxuJyk7XG5cbiAgICAvKlxuICAgICAqIFRyaW0gbGVhZGluZyB3aGl0ZXNwYWNlXG4gICAgICovXG4gICAgKGZ1bmN0aW9uKCkge1xuICAgICAgY29uc3QgZmlyc3ROb25XaGl0ZXNwYWNlUmVnZXggPSAvW1xcdy1dKy9naW07XG4gICAgICBjb25zdCBmaXJzdE5vbldoaXRlc3BhY2VJbmRleCA9IG1lc3NhZ2VTdHJpbmcuc2VhcmNoKGZpcnN0Tm9uV2hpdGVzcGFjZVJlZ2V4KTtcbiAgICAgIGlmIChmaXJzdE5vbldoaXRlc3BhY2VJbmRleCA+IDApIHtcbiAgICAgICAgbWVzc2FnZSA9IG1lc3NhZ2Uuc2xpY2UoZmlyc3ROb25XaGl0ZXNwYWNlSW5kZXgsIG1lc3NhZ2UubGVuZ3RoKTtcbiAgICAgICAgbWVzc2FnZVN0cmluZyA9IG1lc3NhZ2UudG9TdHJpbmcoKTtcbiAgICAgIH1cbiAgICB9KSgpO1xuXG4gICAgLyogUGFyc2UgcmVxdWVzdCBsaW5lXG4gICAgICovXG4gICAgKGZ1bmN0aW9uKCkge1xuICAgICAgY29uc3QgcG9zc2libGVSZXF1ZXN0TGluZSA9IG1lc3NhZ2VTdHJpbmcuc3BsaXQoL1xcbnxcXHJcXG4vKVswXTtcbiAgICAgIGNvbnN0IHJlcXVlc3RMaW5lTWF0Y2ggPSBwb3NzaWJsZVJlcXVlc3RMaW5lLm1hdGNoKGh0dHBNZXNzYWdlUGFyc2VyLl9yZXF1ZXN0TGluZVJlZ2V4KTtcblxuICAgICAgaWYgKEFycmF5LmlzQXJyYXkocmVxdWVzdExpbmVNYXRjaCkgJiYgcmVxdWVzdExpbmVNYXRjaC5sZW5ndGggPiAxKSB7XG4gICAgICAgIHJlc3VsdC5odHRwVmVyc2lvbiA9IHBhcnNlRmxvYXQocmVxdWVzdExpbmVNYXRjaFsxXSk7XG4gICAgICAgIHJlc3VsdC5zdGF0dXNDb2RlID0gcGFyc2VJbnQocmVxdWVzdExpbmVNYXRjaFsyXSk7XG4gICAgICAgIHJlc3VsdC5zdGF0dXNNZXNzYWdlID0gcmVxdWVzdExpbmVNYXRjaFszXTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnN0IHJlc3BvbnNlTGluZU1hdGggPSBwb3NzaWJsZVJlcXVlc3RMaW5lLm1hdGNoKGh0dHBNZXNzYWdlUGFyc2VyLl9yZXNwb25zZUxpbmVSZWdleCk7XG4gICAgICAgIGlmIChBcnJheS5pc0FycmF5KHJlc3BvbnNlTGluZU1hdGgpICYmIHJlc3BvbnNlTGluZU1hdGgubGVuZ3RoID4gMSkge1xuICAgICAgICAgIHJlc3VsdC5tZXRob2QgPSByZXNwb25zZUxpbmVNYXRoWzFdO1xuICAgICAgICAgIHJlc3VsdC51cmwgPSByZXNwb25zZUxpbmVNYXRoWzJdO1xuICAgICAgICAgIHJlc3VsdC5odHRwVmVyc2lvbiA9IHBhcnNlRmxvYXQocmVzcG9uc2VMaW5lTWF0aFszXSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9KSgpO1xuXG4gICAgLyogUGFyc2UgaGVhZGVyc1xuICAgICAqL1xuICAgIChmdW5jdGlvbigpIHtcbiAgICAgIGhlYWRlck5ld2xpbmVJbmRleCA9IG1lc3NhZ2VTdHJpbmcuc2VhcmNoKGh0dHBNZXNzYWdlUGFyc2VyLl9oZWFkZXJOZXdsaW5lUmVnZXgpO1xuICAgICAgaWYgKGhlYWRlck5ld2xpbmVJbmRleCA+IC0xKSB7XG4gICAgICAgIGhlYWRlck5ld2xpbmVJbmRleCA9IGhlYWRlck5ld2xpbmVJbmRleCArIDE7IC8vIDEgZm9yIG5ld2xpbmUgbGVuZ3RoXG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvKiBUaGVyZSdzIG5vIGxpbmUgYnJlYWtzIHNvIGNoZWNrIGlmIHJlcXVlc3QgbGluZSBleGlzdHNcbiAgICAgICAgICogYmVjYXVzZSB0aGUgbWVzc2FnZSBtaWdodCBiZSBhbGwgaGVhZGVycyBhbmQgbm8gYm9keVxuICAgICAgICAgKi9cbiAgICAgICAgaWYgKHJlc3VsdC5odHRwVmVyc2lvbikge1xuICAgICAgICAgIGhlYWRlck5ld2xpbmVJbmRleCA9IG1lc3NhZ2VTdHJpbmcubGVuZ3RoO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IGhlYWRlcnNTdHJpbmcgPSBtZXNzYWdlU3RyaW5nLnN1YnN0cigwLCBoZWFkZXJOZXdsaW5lSW5kZXgpO1xuICAgICAgY29uc3QgaGVhZGVycyA9IGh0dHBNZXNzYWdlUGFyc2VyLl9wYXJzZUhlYWRlcnMoaGVhZGVyc1N0cmluZyk7XG5cbiAgICAgIGlmIChPYmplY3Qua2V5cyhoZWFkZXJzKS5sZW5ndGggPiAwKSB7XG4gICAgICAgIHJlc3VsdC5oZWFkZXJzID0gaGVhZGVycztcblxuICAgICAgICAvLyBUT09EOiBleHRyYWN0IGJvdW5kYXJ5LlxuICAgICAgfVxuICAgIH0pKCk7XG5cbiAgICAvKiBUcnkgdG8gZ2V0IGJvdW5kYXJ5IGlmIG5vIGJvdW5kYXJ5IGhlYWRlclxuICAgICAqL1xuICAgIChmdW5jdGlvbigpIHtcbiAgICAgIGlmICghcmVzdWx0LmJvdW5kYXJ5KSB7XG4gICAgICAgIGNvbnN0IGJvdW5kYXJ5TWF0Y2ggPSBtZXNzYWdlU3RyaW5nLm1hdGNoKGh0dHBNZXNzYWdlUGFyc2VyLl9ib3VuZGFyeVJlZ2V4KTtcblxuICAgICAgICBpZiAoQXJyYXkuaXNBcnJheShib3VuZGFyeU1hdGNoKSAmJiBib3VuZGFyeU1hdGNoLmxlbmd0aCkge1xuICAgICAgICAgIGZ1bGxCb3VuZGFyeSA9IGJvdW5kYXJ5TWF0Y2hbMF0ucmVwbGFjZSgvW1xcclxcbl0rL2dpLCAnJyk7XG4gICAgICAgICAgY29uc3QgYm91bmRhcnkgPSBmdWxsQm91bmRhcnkucmVwbGFjZSgvXi0tLywnJyk7XG4gICAgICAgICAgcmVzdWx0LmJvdW5kYXJ5ID0gYm91bmRhcnk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9KSgpO1xuXG4gICAgLyogUGFyc2UgYm9keVxuICAgICAqL1xuICAgIChmdW5jdGlvbigpIHtcbiAgICAgIHZhciBzdGFydCA9IGhlYWRlck5ld2xpbmVJbmRleDtcbiAgICAgIHZhciBlbmQgPSBtZXNzYWdlLmxlbmd0aDtcbiAgICAgIGNvbnN0IGZpcnN0Qm91bmRhcnlJbmRleCA9IG1lc3NhZ2VTdHJpbmcuaW5kZXhPZihmdWxsQm91bmRhcnkpO1xuXG4gICAgICBpZiAoZmlyc3RCb3VuZGFyeUluZGV4ID4gLTEpIHtcbiAgICAgICAgc3RhcnQgPSBoZWFkZXJOZXdsaW5lSW5kZXg7XG4gICAgICAgIGVuZCA9IGZpcnN0Qm91bmRhcnlJbmRleDtcbiAgICAgIH1cblxuICAgICAgaWYgKGhlYWRlck5ld2xpbmVJbmRleCA+IC0xKSB7XG4gICAgICAgIGNvbnN0IGJvZHkgPSBtZXNzYWdlLnNsaWNlKHN0YXJ0LCBlbmQpO1xuXG4gICAgICAgIGlmIChib2R5ICYmIGJvZHkubGVuZ3RoKSB7XG4gICAgICAgICAgcmVzdWx0LmJvZHkgPSBodHRwTWVzc2FnZVBhcnNlci5faXNGYWtlQnVmZmVyKGJvZHkpID8gYm9keS50b1N0cmluZygpIDogYm9keTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0pKCk7XG5cbiAgICAvKiBQYXJzZSBtdWx0aXBhcnQgc2VjdGlvbnNcbiAgICAgKi9cbiAgICAoZnVuY3Rpb24oKSB7XG4gICAgICBpZiAocmVzdWx0LmJvdW5kYXJ5KSB7XG4gICAgICAgIGNvbnN0IG11bHRpcGFydFN0YXJ0ID0gbWVzc2FnZVN0cmluZy5pbmRleE9mKGZ1bGxCb3VuZGFyeSkgKyBmdWxsQm91bmRhcnkubGVuZ3RoO1xuICAgICAgICBjb25zdCBtdWx0aXBhcnRFbmQgPSBtZXNzYWdlU3RyaW5nLmxhc3RJbmRleE9mKGZ1bGxCb3VuZGFyeSk7XG4gICAgICAgIGNvbnN0IG11bHRpcGFydEJvZHkgPSBtZXNzYWdlU3RyaW5nLnN1YnN0cihtdWx0aXBhcnRTdGFydCwgbXVsdGlwYXJ0RW5kKTtcbiAgICAgICAgY29uc3QgcGFydHMgPSBtdWx0aXBhcnRCb2R5LnNwbGl0KGZ1bGxCb3VuZGFyeSk7XG5cbiAgICAgICAgcmVzdWx0Lm11bHRpcGFydCA9IHBhcnRzLmZpbHRlcihodHRwTWVzc2FnZVBhcnNlci5faXNUcnV0aHkpLm1hcChmdW5jdGlvbihwYXJ0LCBpKSB7XG4gICAgICAgICAgY29uc3QgcmVzdWx0ID0ge1xuICAgICAgICAgICAgaGVhZGVyczogbnVsbCxcbiAgICAgICAgICAgIGJvZHk6IG51bGxcbiAgICAgICAgICB9O1xuXG4gICAgICAgICAgY29uc3QgbmV3bGluZVJlZ2V4ID0gL1xcblxcbnxcXHJcXG5cXHJcXG4vZ2ltO1xuICAgICAgICAgIHZhciBuZXdsaW5lSW5kZXggPSAwO1xuICAgICAgICAgIHZhciBuZXdsaW5lTWF0Y2ggPSBuZXdsaW5lUmVnZXguZXhlYyhwYXJ0KTtcbiAgICAgICAgICB2YXIgYm9keSA9IG51bGw7XG5cbiAgICAgICAgICBpZiAobmV3bGluZU1hdGNoKSB7XG4gICAgICAgICAgICBuZXdsaW5lSW5kZXggPSBuZXdsaW5lTWF0Y2guaW5kZXg7XG4gICAgICAgICAgICBpZiAobmV3bGluZU1hdGNoLmluZGV4IDw9IDApIHtcbiAgICAgICAgICAgICAgbmV3bGluZU1hdGNoID0gbmV3bGluZVJlZ2V4LmV4ZWMocGFydCk7XG4gICAgICAgICAgICAgIGlmIChuZXdsaW5lTWF0Y2gpIHtcbiAgICAgICAgICAgICAgICBuZXdsaW5lSW5kZXggPSBuZXdsaW5lTWF0Y2guaW5kZXg7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG5cbiAgICAgICAgICBjb25zdCBwb3NzaWJsZUhlYWRlcnNTdHJpbmcgPSBwYXJ0LnN1YnN0cigwLCBuZXdsaW5lSW5kZXgpO1xuXG4gICAgICAgICAgaWYgKG5ld2xpbmVJbmRleCA+IC0xKSB7XG4gICAgICAgICAgICBjb25zdCBoZWFkZXJzID0gaHR0cE1lc3NhZ2VQYXJzZXIuX3BhcnNlSGVhZGVycyhwb3NzaWJsZUhlYWRlcnNTdHJpbmcpO1xuICAgICAgICAgICAgaWYgKE9iamVjdC5rZXlzKGhlYWRlcnMpLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgcmVzdWx0LmhlYWRlcnMgPSBoZWFkZXJzO1xuXG4gICAgICAgICAgICAgIHZhciBib3VuZGFyeUluZGV4ZXMgPSBbXTtcbiAgICAgICAgICAgICAgZm9yICh2YXIgaiA9IDA7IGogPCBtZXNzYWdlLmxlbmd0aDsgaisrKSB7XG4gICAgICAgICAgICAgICAgdmFyIGJvdW5kYXJ5TWF0Y2ggPSBtZXNzYWdlLnNsaWNlKGosIGogKyBmdWxsQm91bmRhcnkubGVuZ3RoKS50b1N0cmluZygpO1xuXG4gICAgICAgICAgICAgICAgaWYgKGJvdW5kYXJ5TWF0Y2ggPT09IGZ1bGxCb3VuZGFyeSkge1xuICAgICAgICAgICAgICAgICAgYm91bmRhcnlJbmRleGVzLnB1c2goaik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgdmFyIGJvdW5kYXJ5TmV3bGluZUluZGV4ZXMgPSBbXTtcbiAgICAgICAgICAgICAgYm91bmRhcnlJbmRleGVzLnNsaWNlKDAsIGJvdW5kYXJ5SW5kZXhlcy5sZW5ndGggLSAxKS5mb3JFYWNoKGZ1bmN0aW9uKG0sIGspIHtcbiAgICAgICAgICAgICAgICBjb25zdCBwYXJ0Qm9keSA9IG1lc3NhZ2Uuc2xpY2UoYm91bmRhcnlJbmRleGVzW2tdLCBib3VuZGFyeUluZGV4ZXNbayArIDFdKS50b1N0cmluZygpO1xuICAgICAgICAgICAgICAgIHZhciBoZWFkZXJOZXdsaW5lSW5kZXggPSBwYXJ0Qm9keS5zZWFyY2goL1xcblxcbnxcXHJcXG5cXHJcXG4vZ2ltKSArIDI7XG4gICAgICAgICAgICAgICAgaGVhZGVyTmV3bGluZUluZGV4ICA9IGJvdW5kYXJ5SW5kZXhlc1trXSArIGhlYWRlck5ld2xpbmVJbmRleDtcbiAgICAgICAgICAgICAgICBib3VuZGFyeU5ld2xpbmVJbmRleGVzLnB1c2goaGVhZGVyTmV3bGluZUluZGV4KTtcbiAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgICAgYm9keSA9IG1lc3NhZ2Uuc2xpY2UoYm91bmRhcnlOZXdsaW5lSW5kZXhlc1tpXSwgYm91bmRhcnlJbmRleGVzW2kgKyAxXSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBib2R5ID0gcGFydDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgYm9keSA9IHBhcnQ7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgcmVzdWx0LmJvZHkgPSBodHRwTWVzc2FnZVBhcnNlci5faXNGYWtlQnVmZmVyKGJvZHkpID8gYm9keS50b1N0cmluZygpIDogYm9keTtcblxuICAgICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH0pKCk7XG5cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgaHR0cE1lc3NhZ2VQYXJzZXIuX2lzVHJ1dGh5ID0gZnVuY3Rpb24gX2lzVHJ1dGh5KHYpIHtcbiAgICByZXR1cm4gISF2O1xuICB9O1xuXG4gIGh0dHBNZXNzYWdlUGFyc2VyLl9pc051bWVyaWMgPSBmdW5jdGlvbiBfaXNOdW1lcmljKHYpIHtcbiAgICBpZiAodHlwZW9mIHYgPT09ICdudW1iZXInICYmICFpc05hTih2KSkge1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgdiA9ICh2fHwnJykudG9TdHJpbmcoKS50cmltKCk7XG5cbiAgICBpZiAoIXYpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICByZXR1cm4gIWlzTmFOKHYpO1xuICB9O1xuXG4gIGh0dHBNZXNzYWdlUGFyc2VyLl9pc0J1ZmZlciA9IGZ1bmN0aW9uKGl0ZW0pIHtcbiAgICByZXR1cm4gKChodHRwTWVzc2FnZVBhcnNlci5faXNOb2RlQnVmZmVyU3VwcG9ydGVkKCkgJiZcbiAgICAgICAgICAgIHR5cGVvZiBnbG9iYWwgPT09ICdvYmplY3QnICYmXG4gICAgICAgICAgICBnbG9iYWwuQnVmZmVyLmlzQnVmZmVyKGl0ZW0pKSB8fFxuICAgICAgICAgICAgKGl0ZW0gaW5zdGFuY2VvZiBPYmplY3QgJiZcbiAgICAgICAgICAgICBpdGVtLl9pc0J1ZmZlcikpO1xuICB9O1xuXG4gIGh0dHBNZXNzYWdlUGFyc2VyLl9pc05vZGVCdWZmZXJTdXBwb3J0ZWQgPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gKHR5cGVvZiBnbG9iYWwgPT09ICdvYmplY3QnICYmXG4gICAgICAgICAgICB0eXBlb2YgZ2xvYmFsLkJ1ZmZlciA9PT0gJ2Z1bmN0aW9uJyAmJlxuICAgICAgICAgICAgdHlwZW9mIGdsb2JhbC5CdWZmZXIuaXNCdWZmZXIgPT09ICdmdW5jdGlvbicpO1xuICB9O1xuXG4gIGh0dHBNZXNzYWdlUGFyc2VyLl9wYXJzZUhlYWRlcnMgPSBmdW5jdGlvbiBfcGFyc2VIZWFkZXJzKGJvZHkpIHtcbiAgICBjb25zdCBoZWFkZXJzID0ge307XG5cbiAgICBpZiAodHlwZW9mIGJvZHkgIT09ICdzdHJpbmcnKSB7XG4gICAgICByZXR1cm4gaGVhZGVycztcbiAgICB9XG5cbiAgICBib2R5LnNwbGl0KC9bXFxyXFxuXS8pLmZvckVhY2goZnVuY3Rpb24oc3RyaW5nKSB7XG4gICAgICBjb25zdCBtYXRjaCA9IHN0cmluZy5tYXRjaCgvKFtcXHctXSspOlxccyooLiopL2kpO1xuXG4gICAgICBpZiAoQXJyYXkuaXNBcnJheShtYXRjaCkgJiYgbWF0Y2gubGVuZ3RoID09PSAzKSB7XG4gICAgICAgIGNvbnN0IGtleSA9IG1hdGNoWzFdO1xuICAgICAgICBjb25zdCB2YWx1ZSA9IG1hdGNoWzJdO1xuXG4gICAgICAgIGhlYWRlcnNba2V5XSA9IGh0dHBNZXNzYWdlUGFyc2VyLl9pc051bWVyaWModmFsdWUpID8gTnVtYmVyKHZhbHVlKSA6IHZhbHVlO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgcmV0dXJuIGhlYWRlcnM7XG4gIH07XG5cbiAgaHR0cE1lc3NhZ2VQYXJzZXIuX3JlcXVlc3RMaW5lUmVnZXggPSAvSFRUUFxcLygxXFwuMHwxXFwuMXwyXFwuMClcXHMrKFxcZCspXFxzKyhbXFx3XFxzLV9dKykvaTtcbiAgaHR0cE1lc3NhZ2VQYXJzZXIuX3Jlc3BvbnNlTGluZVJlZ2V4ID0gLyhHRVR8UE9TVHxQVVR8REVMRVRFfFBBVENIfE9QVElPTlN8SEVBRHxUUkFDRXxDT05ORUNUKVxccysoLiopXFxzK0hUVFBcXC8oMVxcLjB8MVxcLjF8MlxcLjApL2k7XG4gIGh0dHBNZXNzYWdlUGFyc2VyLl9oZWFkZXJOZXdsaW5lUmVnZXggPSAvXltcXHJcXG5dKy9naW07XG4gIGh0dHBNZXNzYWdlUGFyc2VyLl9ib3VuZGFyeVJlZ2V4ID0gLyhcXG58XFxyXFxuKSstLVtcXHctXSsoXFxufFxcclxcbikrL2c7XG5cbiAgaHR0cE1lc3NhZ2VQYXJzZXIuX2NyZWF0ZUJ1ZmZlciA9IGZ1bmN0aW9uKGRhdGEpIHtcbiAgICBpZiAoaHR0cE1lc3NhZ2VQYXJzZXIuX2lzTm9kZUJ1ZmZlclN1cHBvcnRlZCgpKSB7XG4gICAgICByZXR1cm4gbmV3IEJ1ZmZlcihkYXRhKTtcbiAgICB9XG5cbiAgICByZXR1cm4gbmV3IGh0dHBNZXNzYWdlUGFyc2VyLl9GYWtlQnVmZmVyKGRhdGEpO1xuICB9O1xuXG4gIGh0dHBNZXNzYWdlUGFyc2VyLl9pc0Zha2VCdWZmZXIgPSBmdW5jdGlvbiBpc0Zha2VCdWZmZXIob2JqKSB7XG4gICAgcmV0dXJuIG9iaiBpbnN0YW5jZW9mIGh0dHBNZXNzYWdlUGFyc2VyLl9GYWtlQnVmZmVyO1xuICB9O1xuXG4gIGh0dHBNZXNzYWdlUGFyc2VyLl9GYWtlQnVmZmVyID0gZnVuY3Rpb24gRmFrZUJ1ZmZlcihkYXRhKSB7XG4gICAgaWYgKCEodGhpcyBpbnN0YW5jZW9mIGh0dHBNZXNzYWdlUGFyc2VyLl9GYWtlQnVmZmVyKSkge1xuICAgICAgcmV0dXJuIG5ldyBodHRwTWVzc2FnZVBhcnNlci5fRmFrZUJ1ZmZlcihkYXRhKTtcbiAgICB9XG5cbiAgICB0aGlzLmRhdGEgPSBbXTtcblxuICAgIGlmIChBcnJheS5pc0FycmF5KGRhdGEpKSB7XG4gICAgICB0aGlzLmRhdGEgPSBkYXRhO1xuICAgIH0gZWxzZSBpZiAodHlwZW9mIGRhdGEgPT09ICdzdHJpbmcnKSB7XG4gICAgICB0aGlzLmRhdGEgPSBbXS5zbGljZS5jYWxsKGRhdGEpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIExpdmVPYmplY3QoKSB7fVxuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShMaXZlT2JqZWN0LnByb3RvdHlwZSwgJ2xlbmd0aCcsIHtcbiAgICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmRhdGEubGVuZ3RoO1xuICAgICAgfS5iaW5kKHRoaXMpXG4gICAgfSk7XG5cbiAgICB0aGlzLmxlbmd0aCA9IChuZXcgTGl2ZU9iamVjdCgpKS5sZW5ndGg7XG4gIH07XG5cbiAgaHR0cE1lc3NhZ2VQYXJzZXIuX0Zha2VCdWZmZXIucHJvdG90eXBlLnNsaWNlID0gZnVuY3Rpb24gc2xpY2UoKSB7XG4gICAgdmFyIG5ld0FycmF5ID0gW10uc2xpY2UuYXBwbHkodGhpcy5kYXRhLCBhcmd1bWVudHMpO1xuICAgIHJldHVybiBuZXcgaHR0cE1lc3NhZ2VQYXJzZXIuX0Zha2VCdWZmZXIobmV3QXJyYXkpO1xuICB9O1xuXG4gIGh0dHBNZXNzYWdlUGFyc2VyLl9GYWtlQnVmZmVyLnByb3RvdHlwZS5zZWFyY2ggPSBmdW5jdGlvbiBzZWFyY2goKSB7XG4gICAgcmV0dXJuIFtdLnNlYXJjaC5hcHBseSh0aGlzLmRhdGEsIGFyZ3VtZW50cyk7XG4gIH07XG5cbiAgaHR0cE1lc3NhZ2VQYXJzZXIuX0Zha2VCdWZmZXIucHJvdG90eXBlLmluZGV4T2YgPSBmdW5jdGlvbiBpbmRleE9mKCkge1xuICAgIHJldHVybiBbXS5pbmRleE9mLmFwcGx5KHRoaXMuZGF0YSwgYXJndW1lbnRzKTtcbiAgfTtcblxuICBodHRwTWVzc2FnZVBhcnNlci5fRmFrZUJ1ZmZlci5wcm90b3R5cGUudG9TdHJpbmcgPSBmdW5jdGlvbiB0b1N0cmluZygpIHtcbiAgICByZXR1cm4gdGhpcy5kYXRhLmpvaW4oJycpO1xuICB9O1xuXG4gIGlmICh0eXBlb2YgZXhwb3J0cyAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICBpZiAodHlwZW9mIG1vZHVsZSAhPT0gJ3VuZGVmaW5lZCcgJiYgbW9kdWxlLmV4cG9ydHMpIHtcbiAgICAgIGV4cG9ydHMgPSBtb2R1bGUuZXhwb3J0cyA9IGh0dHBNZXNzYWdlUGFyc2VyO1xuICAgIH1cbiAgICBleHBvcnRzLmh0dHBNZXNzYWdlUGFyc2VyID0gaHR0cE1lc3NhZ2VQYXJzZXI7XG4gIH0gZWxzZSBpZiAodHlwZW9mIGRlZmluZSA9PT0gJ2Z1bmN0aW9uJyAmJiBkZWZpbmUuYW1kKSB7XG4gICAgZGVmaW5lKFtdLCBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiBodHRwTWVzc2FnZVBhcnNlcjtcbiAgICB9KTtcbiAgfSBlbHNlIHtcbiAgICByb290Lmh0dHBNZXNzYWdlUGFyc2VyID0gaHR0cE1lc3NhZ2VQYXJzZXI7XG4gIH1cblxufSkodGhpcyk7XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBTdHJpbmdpZnkgPSByZXF1aXJlKCcuL3N0cmluZ2lmeScpO1xudmFyIFBhcnNlID0gcmVxdWlyZSgnLi9wYXJzZScpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgICBzdHJpbmdpZnk6IFN0cmluZ2lmeSxcbiAgICBwYXJzZTogUGFyc2Vcbn07XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBVdGlscyA9IHJlcXVpcmUoJy4vdXRpbHMnKTtcblxudmFyIGludGVybmFscyA9IHtcbiAgICBkZWxpbWl0ZXI6ICcmJyxcbiAgICBkZXB0aDogNSxcbiAgICBhcnJheUxpbWl0OiAyMCxcbiAgICBwYXJhbWV0ZXJMaW1pdDogMTAwMCxcbiAgICBzdHJpY3ROdWxsSGFuZGxpbmc6IGZhbHNlLFxuICAgIHBsYWluT2JqZWN0czogZmFsc2UsXG4gICAgYWxsb3dQcm90b3R5cGVzOiBmYWxzZSxcbiAgICBhbGxvd0RvdHM6IGZhbHNlXG59O1xuXG5pbnRlcm5hbHMucGFyc2VWYWx1ZXMgPSBmdW5jdGlvbiAoc3RyLCBvcHRpb25zKSB7XG4gICAgdmFyIG9iaiA9IHt9O1xuICAgIHZhciBwYXJ0cyA9IHN0ci5zcGxpdChvcHRpb25zLmRlbGltaXRlciwgb3B0aW9ucy5wYXJhbWV0ZXJMaW1pdCA9PT0gSW5maW5pdHkgPyB1bmRlZmluZWQgOiBvcHRpb25zLnBhcmFtZXRlckxpbWl0KTtcblxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgcGFydHMubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgdmFyIHBhcnQgPSBwYXJ0c1tpXTtcbiAgICAgICAgdmFyIHBvcyA9IHBhcnQuaW5kZXhPZignXT0nKSA9PT0gLTEgPyBwYXJ0LmluZGV4T2YoJz0nKSA6IHBhcnQuaW5kZXhPZignXT0nKSArIDE7XG5cbiAgICAgICAgaWYgKHBvcyA9PT0gLTEpIHtcbiAgICAgICAgICAgIG9ialtVdGlscy5kZWNvZGUocGFydCldID0gJyc7XG5cbiAgICAgICAgICAgIGlmIChvcHRpb25zLnN0cmljdE51bGxIYW5kbGluZykge1xuICAgICAgICAgICAgICAgIG9ialtVdGlscy5kZWNvZGUocGFydCldID0gbnVsbDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHZhciBrZXkgPSBVdGlscy5kZWNvZGUocGFydC5zbGljZSgwLCBwb3MpKTtcbiAgICAgICAgICAgIHZhciB2YWwgPSBVdGlscy5kZWNvZGUocGFydC5zbGljZShwb3MgKyAxKSk7XG5cbiAgICAgICAgICAgIGlmIChPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwob2JqLCBrZXkpKSB7XG4gICAgICAgICAgICAgICAgb2JqW2tleV0gPSBbXS5jb25jYXQob2JqW2tleV0pLmNvbmNhdCh2YWwpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBvYmpba2V5XSA9IHZhbDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBvYmo7XG59O1xuXG5pbnRlcm5hbHMucGFyc2VPYmplY3QgPSBmdW5jdGlvbiAoY2hhaW4sIHZhbCwgb3B0aW9ucykge1xuICAgIGlmICghY2hhaW4ubGVuZ3RoKSB7XG4gICAgICAgIHJldHVybiB2YWw7XG4gICAgfVxuXG4gICAgdmFyIHJvb3QgPSBjaGFpbi5zaGlmdCgpO1xuXG4gICAgdmFyIG9iajtcbiAgICBpZiAocm9vdCA9PT0gJ1tdJykge1xuICAgICAgICBvYmogPSBbXTtcbiAgICAgICAgb2JqID0gb2JqLmNvbmNhdChpbnRlcm5hbHMucGFyc2VPYmplY3QoY2hhaW4sIHZhbCwgb3B0aW9ucykpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIG9iaiA9IG9wdGlvbnMucGxhaW5PYmplY3RzID8gT2JqZWN0LmNyZWF0ZShudWxsKSA6IHt9O1xuICAgICAgICB2YXIgY2xlYW5Sb290ID0gcm9vdFswXSA9PT0gJ1snICYmIHJvb3Rbcm9vdC5sZW5ndGggLSAxXSA9PT0gJ10nID8gcm9vdC5zbGljZSgxLCByb290Lmxlbmd0aCAtIDEpIDogcm9vdDtcbiAgICAgICAgdmFyIGluZGV4ID0gcGFyc2VJbnQoY2xlYW5Sb290LCAxMCk7XG4gICAgICAgIGlmIChcbiAgICAgICAgICAgICFpc05hTihpbmRleCkgJiZcbiAgICAgICAgICAgIHJvb3QgIT09IGNsZWFuUm9vdCAmJlxuICAgICAgICAgICAgU3RyaW5nKGluZGV4KSA9PT0gY2xlYW5Sb290ICYmXG4gICAgICAgICAgICBpbmRleCA+PSAwICYmXG4gICAgICAgICAgICAob3B0aW9ucy5wYXJzZUFycmF5cyAmJiBpbmRleCA8PSBvcHRpb25zLmFycmF5TGltaXQpXG4gICAgICAgICkge1xuICAgICAgICAgICAgb2JqID0gW107XG4gICAgICAgICAgICBvYmpbaW5kZXhdID0gaW50ZXJuYWxzLnBhcnNlT2JqZWN0KGNoYWluLCB2YWwsIG9wdGlvbnMpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgb2JqW2NsZWFuUm9vdF0gPSBpbnRlcm5hbHMucGFyc2VPYmplY3QoY2hhaW4sIHZhbCwgb3B0aW9ucyk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gb2JqO1xufTtcblxuaW50ZXJuYWxzLnBhcnNlS2V5cyA9IGZ1bmN0aW9uIChnaXZlbktleSwgdmFsLCBvcHRpb25zKSB7XG4gICAgaWYgKCFnaXZlbktleSkge1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy8gVHJhbnNmb3JtIGRvdCBub3RhdGlvbiB0byBicmFja2V0IG5vdGF0aW9uXG4gICAgdmFyIGtleSA9IG9wdGlvbnMuYWxsb3dEb3RzID8gZ2l2ZW5LZXkucmVwbGFjZSgvXFwuKFteXFwuXFxbXSspL2csICdbJDFdJykgOiBnaXZlbktleTtcblxuICAgIC8vIFRoZSByZWdleCBjaHVua3NcblxuICAgIHZhciBwYXJlbnQgPSAvXihbXlxcW1xcXV0qKS87XG4gICAgdmFyIGNoaWxkID0gLyhcXFtbXlxcW1xcXV0qXFxdKS9nO1xuXG4gICAgLy8gR2V0IHRoZSBwYXJlbnRcblxuICAgIHZhciBzZWdtZW50ID0gcGFyZW50LmV4ZWMoa2V5KTtcblxuICAgIC8vIFN0YXNoIHRoZSBwYXJlbnQgaWYgaXQgZXhpc3RzXG5cbiAgICB2YXIga2V5cyA9IFtdO1xuICAgIGlmIChzZWdtZW50WzFdKSB7XG4gICAgICAgIC8vIElmIHdlIGFyZW4ndCB1c2luZyBwbGFpbiBvYmplY3RzLCBvcHRpb25hbGx5IHByZWZpeCBrZXlzXG4gICAgICAgIC8vIHRoYXQgd291bGQgb3ZlcndyaXRlIG9iamVjdCBwcm90b3R5cGUgcHJvcGVydGllc1xuICAgICAgICBpZiAoIW9wdGlvbnMucGxhaW5PYmplY3RzICYmIE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkoc2VnbWVudFsxXSkpIHtcbiAgICAgICAgICAgIGlmICghb3B0aW9ucy5hbGxvd1Byb3RvdHlwZXMpIHtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBrZXlzLnB1c2goc2VnbWVudFsxXSk7XG4gICAgfVxuXG4gICAgLy8gTG9vcCB0aHJvdWdoIGNoaWxkcmVuIGFwcGVuZGluZyB0byB0aGUgYXJyYXkgdW50aWwgd2UgaGl0IGRlcHRoXG5cbiAgICB2YXIgaSA9IDA7XG4gICAgd2hpbGUgKChzZWdtZW50ID0gY2hpbGQuZXhlYyhrZXkpKSAhPT0gbnVsbCAmJiBpIDwgb3B0aW9ucy5kZXB0aCkge1xuICAgICAgICBpICs9IDE7XG4gICAgICAgIGlmICghb3B0aW9ucy5wbGFpbk9iamVjdHMgJiYgT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eShzZWdtZW50WzFdLnJlcGxhY2UoL1xcW3xcXF0vZywgJycpKSkge1xuICAgICAgICAgICAgaWYgKCFvcHRpb25zLmFsbG93UHJvdG90eXBlcykge1xuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGtleXMucHVzaChzZWdtZW50WzFdKTtcbiAgICB9XG5cbiAgICAvLyBJZiB0aGVyZSdzIGEgcmVtYWluZGVyLCBqdXN0IGFkZCB3aGF0ZXZlciBpcyBsZWZ0XG5cbiAgICBpZiAoc2VnbWVudCkge1xuICAgICAgICBrZXlzLnB1c2goJ1snICsga2V5LnNsaWNlKHNlZ21lbnQuaW5kZXgpICsgJ10nKTtcbiAgICB9XG5cbiAgICByZXR1cm4gaW50ZXJuYWxzLnBhcnNlT2JqZWN0KGtleXMsIHZhbCwgb3B0aW9ucyk7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIChzdHIsIG9wdHMpIHtcbiAgICB2YXIgb3B0aW9ucyA9IG9wdHMgfHwge307XG4gICAgb3B0aW9ucy5kZWxpbWl0ZXIgPSB0eXBlb2Ygb3B0aW9ucy5kZWxpbWl0ZXIgPT09ICdzdHJpbmcnIHx8IFV0aWxzLmlzUmVnRXhwKG9wdGlvbnMuZGVsaW1pdGVyKSA/IG9wdGlvbnMuZGVsaW1pdGVyIDogaW50ZXJuYWxzLmRlbGltaXRlcjtcbiAgICBvcHRpb25zLmRlcHRoID0gdHlwZW9mIG9wdGlvbnMuZGVwdGggPT09ICdudW1iZXInID8gb3B0aW9ucy5kZXB0aCA6IGludGVybmFscy5kZXB0aDtcbiAgICBvcHRpb25zLmFycmF5TGltaXQgPSB0eXBlb2Ygb3B0aW9ucy5hcnJheUxpbWl0ID09PSAnbnVtYmVyJyA/IG9wdGlvbnMuYXJyYXlMaW1pdCA6IGludGVybmFscy5hcnJheUxpbWl0O1xuICAgIG9wdGlvbnMucGFyc2VBcnJheXMgPSBvcHRpb25zLnBhcnNlQXJyYXlzICE9PSBmYWxzZTtcbiAgICBvcHRpb25zLmFsbG93RG90cyA9IHR5cGVvZiBvcHRpb25zLmFsbG93RG90cyA9PT0gJ2Jvb2xlYW4nID8gb3B0aW9ucy5hbGxvd0RvdHMgOiBpbnRlcm5hbHMuYWxsb3dEb3RzO1xuICAgIG9wdGlvbnMucGxhaW5PYmplY3RzID0gdHlwZW9mIG9wdGlvbnMucGxhaW5PYmplY3RzID09PSAnYm9vbGVhbicgPyBvcHRpb25zLnBsYWluT2JqZWN0cyA6IGludGVybmFscy5wbGFpbk9iamVjdHM7XG4gICAgb3B0aW9ucy5hbGxvd1Byb3RvdHlwZXMgPSB0eXBlb2Ygb3B0aW9ucy5hbGxvd1Byb3RvdHlwZXMgPT09ICdib29sZWFuJyA/IG9wdGlvbnMuYWxsb3dQcm90b3R5cGVzIDogaW50ZXJuYWxzLmFsbG93UHJvdG90eXBlcztcbiAgICBvcHRpb25zLnBhcmFtZXRlckxpbWl0ID0gdHlwZW9mIG9wdGlvbnMucGFyYW1ldGVyTGltaXQgPT09ICdudW1iZXInID8gb3B0aW9ucy5wYXJhbWV0ZXJMaW1pdCA6IGludGVybmFscy5wYXJhbWV0ZXJMaW1pdDtcbiAgICBvcHRpb25zLnN0cmljdE51bGxIYW5kbGluZyA9IHR5cGVvZiBvcHRpb25zLnN0cmljdE51bGxIYW5kbGluZyA9PT0gJ2Jvb2xlYW4nID8gb3B0aW9ucy5zdHJpY3ROdWxsSGFuZGxpbmcgOiBpbnRlcm5hbHMuc3RyaWN0TnVsbEhhbmRsaW5nO1xuXG4gICAgaWYgKFxuICAgICAgICBzdHIgPT09ICcnIHx8XG4gICAgICAgIHN0ciA9PT0gbnVsbCB8fFxuICAgICAgICB0eXBlb2Ygc3RyID09PSAndW5kZWZpbmVkJ1xuICAgICkge1xuICAgICAgICByZXR1cm4gb3B0aW9ucy5wbGFpbk9iamVjdHMgPyBPYmplY3QuY3JlYXRlKG51bGwpIDoge307XG4gICAgfVxuXG4gICAgdmFyIHRlbXBPYmogPSB0eXBlb2Ygc3RyID09PSAnc3RyaW5nJyA/IGludGVybmFscy5wYXJzZVZhbHVlcyhzdHIsIG9wdGlvbnMpIDogc3RyO1xuICAgIHZhciBvYmogPSBvcHRpb25zLnBsYWluT2JqZWN0cyA/IE9iamVjdC5jcmVhdGUobnVsbCkgOiB7fTtcblxuICAgIC8vIEl0ZXJhdGUgb3ZlciB0aGUga2V5cyBhbmQgc2V0dXAgdGhlIG5ldyBvYmplY3RcblxuICAgIHZhciBrZXlzID0gT2JqZWN0LmtleXModGVtcE9iaik7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBrZXlzLmxlbmd0aDsgKytpKSB7XG4gICAgICAgIHZhciBrZXkgPSBrZXlzW2ldO1xuICAgICAgICB2YXIgbmV3T2JqID0gaW50ZXJuYWxzLnBhcnNlS2V5cyhrZXksIHRlbXBPYmpba2V5XSwgb3B0aW9ucyk7XG4gICAgICAgIG9iaiA9IFV0aWxzLm1lcmdlKG9iaiwgbmV3T2JqLCBvcHRpb25zKTtcbiAgICB9XG5cbiAgICByZXR1cm4gVXRpbHMuY29tcGFjdChvYmopO1xufTtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIFV0aWxzID0gcmVxdWlyZSgnLi91dGlscycpO1xuXG52YXIgaW50ZXJuYWxzID0ge1xuICAgIGRlbGltaXRlcjogJyYnLFxuICAgIGFycmF5UHJlZml4R2VuZXJhdG9yczoge1xuICAgICAgICBicmFja2V0czogZnVuY3Rpb24gKHByZWZpeCkge1xuICAgICAgICAgICAgcmV0dXJuIHByZWZpeCArICdbXSc7XG4gICAgICAgIH0sXG4gICAgICAgIGluZGljZXM6IGZ1bmN0aW9uIChwcmVmaXgsIGtleSkge1xuICAgICAgICAgICAgcmV0dXJuIHByZWZpeCArICdbJyArIGtleSArICddJztcbiAgICAgICAgfSxcbiAgICAgICAgcmVwZWF0OiBmdW5jdGlvbiAocHJlZml4KSB7XG4gICAgICAgICAgICByZXR1cm4gcHJlZml4O1xuICAgICAgICB9XG4gICAgfSxcbiAgICBzdHJpY3ROdWxsSGFuZGxpbmc6IGZhbHNlLFxuICAgIHNraXBOdWxsczogZmFsc2UsXG4gICAgZW5jb2RlOiB0cnVlXG59O1xuXG5pbnRlcm5hbHMuc3RyaW5naWZ5ID0gZnVuY3Rpb24gKG9iamVjdCwgcHJlZml4LCBnZW5lcmF0ZUFycmF5UHJlZml4LCBzdHJpY3ROdWxsSGFuZGxpbmcsIHNraXBOdWxscywgZW5jb2RlLCBmaWx0ZXIsIHNvcnQsIGFsbG93RG90cykge1xuICAgIHZhciBvYmogPSBvYmplY3Q7XG4gICAgaWYgKHR5cGVvZiBmaWx0ZXIgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgb2JqID0gZmlsdGVyKHByZWZpeCwgb2JqKTtcbiAgICB9IGVsc2UgaWYgKFV0aWxzLmlzQnVmZmVyKG9iaikpIHtcbiAgICAgICAgb2JqID0gU3RyaW5nKG9iaik7XG4gICAgfSBlbHNlIGlmIChvYmogaW5zdGFuY2VvZiBEYXRlKSB7XG4gICAgICAgIG9iaiA9IG9iai50b0lTT1N0cmluZygpO1xuICAgIH0gZWxzZSBpZiAob2JqID09PSBudWxsKSB7XG4gICAgICAgIGlmIChzdHJpY3ROdWxsSGFuZGxpbmcpIHtcbiAgICAgICAgICAgIHJldHVybiBlbmNvZGUgPyBVdGlscy5lbmNvZGUocHJlZml4KSA6IHByZWZpeDtcbiAgICAgICAgfVxuXG4gICAgICAgIG9iaiA9ICcnO1xuICAgIH1cblxuICAgIGlmICh0eXBlb2Ygb2JqID09PSAnc3RyaW5nJyB8fCB0eXBlb2Ygb2JqID09PSAnbnVtYmVyJyB8fCB0eXBlb2Ygb2JqID09PSAnYm9vbGVhbicpIHtcbiAgICAgICAgaWYgKGVuY29kZSkge1xuICAgICAgICAgICAgcmV0dXJuIFtVdGlscy5lbmNvZGUocHJlZml4KSArICc9JyArIFV0aWxzLmVuY29kZShvYmopXTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gW3ByZWZpeCArICc9JyArIG9ial07XG4gICAgfVxuXG4gICAgdmFyIHZhbHVlcyA9IFtdO1xuXG4gICAgaWYgKHR5cGVvZiBvYmogPT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgIHJldHVybiB2YWx1ZXM7XG4gICAgfVxuXG4gICAgdmFyIG9iaktleXM7XG4gICAgaWYgKEFycmF5LmlzQXJyYXkoZmlsdGVyKSkge1xuICAgICAgICBvYmpLZXlzID0gZmlsdGVyO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHZhciBrZXlzID0gT2JqZWN0LmtleXMob2JqKTtcbiAgICAgICAgb2JqS2V5cyA9IHNvcnQgPyBrZXlzLnNvcnQoc29ydCkgOiBrZXlzO1xuICAgIH1cblxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgb2JqS2V5cy5sZW5ndGg7ICsraSkge1xuICAgICAgICB2YXIga2V5ID0gb2JqS2V5c1tpXTtcblxuICAgICAgICBpZiAoc2tpcE51bGxzICYmIG9ialtrZXldID09PSBudWxsKSB7XG4gICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChBcnJheS5pc0FycmF5KG9iaikpIHtcbiAgICAgICAgICAgIHZhbHVlcyA9IHZhbHVlcy5jb25jYXQoaW50ZXJuYWxzLnN0cmluZ2lmeShvYmpba2V5XSwgZ2VuZXJhdGVBcnJheVByZWZpeChwcmVmaXgsIGtleSksIGdlbmVyYXRlQXJyYXlQcmVmaXgsIHN0cmljdE51bGxIYW5kbGluZywgc2tpcE51bGxzLCBlbmNvZGUsIGZpbHRlciwgc29ydCwgYWxsb3dEb3RzKSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB2YWx1ZXMgPSB2YWx1ZXMuY29uY2F0KGludGVybmFscy5zdHJpbmdpZnkob2JqW2tleV0sIHByZWZpeCArIChhbGxvd0RvdHMgPyAnLicgKyBrZXkgOiAnWycgKyBrZXkgKyAnXScpLCBnZW5lcmF0ZUFycmF5UHJlZml4LCBzdHJpY3ROdWxsSGFuZGxpbmcsIHNraXBOdWxscywgZW5jb2RlLCBmaWx0ZXIsIHNvcnQsIGFsbG93RG90cykpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHZhbHVlcztcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKG9iamVjdCwgb3B0cykge1xuICAgIHZhciBvYmogPSBvYmplY3Q7XG4gICAgdmFyIG9wdGlvbnMgPSBvcHRzIHx8IHt9O1xuICAgIHZhciBkZWxpbWl0ZXIgPSB0eXBlb2Ygb3B0aW9ucy5kZWxpbWl0ZXIgPT09ICd1bmRlZmluZWQnID8gaW50ZXJuYWxzLmRlbGltaXRlciA6IG9wdGlvbnMuZGVsaW1pdGVyO1xuICAgIHZhciBzdHJpY3ROdWxsSGFuZGxpbmcgPSB0eXBlb2Ygb3B0aW9ucy5zdHJpY3ROdWxsSGFuZGxpbmcgPT09ICdib29sZWFuJyA/IG9wdGlvbnMuc3RyaWN0TnVsbEhhbmRsaW5nIDogaW50ZXJuYWxzLnN0cmljdE51bGxIYW5kbGluZztcbiAgICB2YXIgc2tpcE51bGxzID0gdHlwZW9mIG9wdGlvbnMuc2tpcE51bGxzID09PSAnYm9vbGVhbicgPyBvcHRpb25zLnNraXBOdWxscyA6IGludGVybmFscy5za2lwTnVsbHM7XG4gICAgdmFyIGVuY29kZSA9IHR5cGVvZiBvcHRpb25zLmVuY29kZSA9PT0gJ2Jvb2xlYW4nID8gb3B0aW9ucy5lbmNvZGUgOiBpbnRlcm5hbHMuZW5jb2RlO1xuICAgIHZhciBzb3J0ID0gdHlwZW9mIG9wdGlvbnMuc29ydCA9PT0gJ2Z1bmN0aW9uJyA/IG9wdGlvbnMuc29ydCA6IG51bGw7XG4gICAgdmFyIGFsbG93RG90cyA9IHR5cGVvZiBvcHRpb25zLmFsbG93RG90cyA9PT0gJ3VuZGVmaW5lZCcgPyBmYWxzZSA6IG9wdGlvbnMuYWxsb3dEb3RzO1xuICAgIHZhciBvYmpLZXlzO1xuICAgIHZhciBmaWx0ZXI7XG4gICAgaWYgKHR5cGVvZiBvcHRpb25zLmZpbHRlciA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICBmaWx0ZXIgPSBvcHRpb25zLmZpbHRlcjtcbiAgICAgICAgb2JqID0gZmlsdGVyKCcnLCBvYmopO1xuICAgIH0gZWxzZSBpZiAoQXJyYXkuaXNBcnJheShvcHRpb25zLmZpbHRlcikpIHtcbiAgICAgICAgb2JqS2V5cyA9IGZpbHRlciA9IG9wdGlvbnMuZmlsdGVyO1xuICAgIH1cblxuICAgIHZhciBrZXlzID0gW107XG5cbiAgICBpZiAodHlwZW9mIG9iaiAhPT0gJ29iamVjdCcgfHwgb2JqID09PSBudWxsKSB7XG4gICAgICAgIHJldHVybiAnJztcbiAgICB9XG5cbiAgICB2YXIgYXJyYXlGb3JtYXQ7XG4gICAgaWYgKG9wdGlvbnMuYXJyYXlGb3JtYXQgaW4gaW50ZXJuYWxzLmFycmF5UHJlZml4R2VuZXJhdG9ycykge1xuICAgICAgICBhcnJheUZvcm1hdCA9IG9wdGlvbnMuYXJyYXlGb3JtYXQ7XG4gICAgfSBlbHNlIGlmICgnaW5kaWNlcycgaW4gb3B0aW9ucykge1xuICAgICAgICBhcnJheUZvcm1hdCA9IG9wdGlvbnMuaW5kaWNlcyA/ICdpbmRpY2VzJyA6ICdyZXBlYXQnO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIGFycmF5Rm9ybWF0ID0gJ2luZGljZXMnO1xuICAgIH1cblxuICAgIHZhciBnZW5lcmF0ZUFycmF5UHJlZml4ID0gaW50ZXJuYWxzLmFycmF5UHJlZml4R2VuZXJhdG9yc1thcnJheUZvcm1hdF07XG5cbiAgICBpZiAoIW9iaktleXMpIHtcbiAgICAgICAgb2JqS2V5cyA9IE9iamVjdC5rZXlzKG9iaik7XG4gICAgfVxuXG4gICAgaWYgKHNvcnQpIHtcbiAgICAgICAgb2JqS2V5cy5zb3J0KHNvcnQpO1xuICAgIH1cblxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgb2JqS2V5cy5sZW5ndGg7ICsraSkge1xuICAgICAgICB2YXIga2V5ID0gb2JqS2V5c1tpXTtcblxuICAgICAgICBpZiAoc2tpcE51bGxzICYmIG9ialtrZXldID09PSBudWxsKSB7XG4gICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGtleXMgPSBrZXlzLmNvbmNhdChpbnRlcm5hbHMuc3RyaW5naWZ5KG9ialtrZXldLCBrZXksIGdlbmVyYXRlQXJyYXlQcmVmaXgsIHN0cmljdE51bGxIYW5kbGluZywgc2tpcE51bGxzLCBlbmNvZGUsIGZpbHRlciwgc29ydCwgYWxsb3dEb3RzKSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGtleXMuam9pbihkZWxpbWl0ZXIpO1xufTtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIGhleFRhYmxlID0gKGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgYXJyYXkgPSBuZXcgQXJyYXkoMjU2KTtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IDI1NjsgKytpKSB7XG4gICAgICAgIGFycmF5W2ldID0gJyUnICsgKChpIDwgMTYgPyAnMCcgOiAnJykgKyBpLnRvU3RyaW5nKDE2KSkudG9VcHBlckNhc2UoKTtcbiAgICB9XG5cbiAgICByZXR1cm4gYXJyYXk7XG59KCkpO1xuXG5leHBvcnRzLmFycmF5VG9PYmplY3QgPSBmdW5jdGlvbiAoc291cmNlLCBvcHRpb25zKSB7XG4gICAgdmFyIG9iaiA9IG9wdGlvbnMucGxhaW5PYmplY3RzID8gT2JqZWN0LmNyZWF0ZShudWxsKSA6IHt9O1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgc291cmNlLmxlbmd0aDsgKytpKSB7XG4gICAgICAgIGlmICh0eXBlb2Ygc291cmNlW2ldICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgb2JqW2ldID0gc291cmNlW2ldO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIG9iajtcbn07XG5cbmV4cG9ydHMubWVyZ2UgPSBmdW5jdGlvbiAodGFyZ2V0LCBzb3VyY2UsIG9wdGlvbnMpIHtcbiAgICBpZiAoIXNvdXJjZSkge1xuICAgICAgICByZXR1cm4gdGFyZ2V0O1xuICAgIH1cblxuICAgIGlmICh0eXBlb2Ygc291cmNlICE9PSAnb2JqZWN0Jykge1xuICAgICAgICBpZiAoQXJyYXkuaXNBcnJheSh0YXJnZXQpKSB7XG4gICAgICAgICAgICB0YXJnZXQucHVzaChzb3VyY2UpO1xuICAgICAgICB9IGVsc2UgaWYgKHR5cGVvZiB0YXJnZXQgPT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgICB0YXJnZXRbc291cmNlXSA9IHRydWU7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gW3RhcmdldCwgc291cmNlXTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB0YXJnZXQ7XG4gICAgfVxuXG4gICAgaWYgKHR5cGVvZiB0YXJnZXQgIT09ICdvYmplY3QnKSB7XG4gICAgICAgIHJldHVybiBbdGFyZ2V0XS5jb25jYXQoc291cmNlKTtcbiAgICB9XG5cbiAgICB2YXIgbWVyZ2VUYXJnZXQgPSB0YXJnZXQ7XG4gICAgaWYgKEFycmF5LmlzQXJyYXkodGFyZ2V0KSAmJiAhQXJyYXkuaXNBcnJheShzb3VyY2UpKSB7XG4gICAgICAgIG1lcmdlVGFyZ2V0ID0gZXhwb3J0cy5hcnJheVRvT2JqZWN0KHRhcmdldCwgb3B0aW9ucyk7XG4gICAgfVxuXG5cdHJldHVybiBPYmplY3Qua2V5cyhzb3VyY2UpLnJlZHVjZShmdW5jdGlvbiAoYWNjLCBrZXkpIHtcbiAgICAgICAgdmFyIHZhbHVlID0gc291cmNlW2tleV07XG5cbiAgICAgICAgaWYgKE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChhY2MsIGtleSkpIHtcbiAgICAgICAgICAgIGFjY1trZXldID0gZXhwb3J0cy5tZXJnZShhY2Nba2V5XSwgdmFsdWUsIG9wdGlvbnMpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgYWNjW2tleV0gPSB2YWx1ZTtcbiAgICAgICAgfVxuXHRcdHJldHVybiBhY2M7XG4gICAgfSwgbWVyZ2VUYXJnZXQpO1xufTtcblxuZXhwb3J0cy5kZWNvZGUgPSBmdW5jdGlvbiAoc3RyKSB7XG4gICAgdHJ5IHtcbiAgICAgICAgcmV0dXJuIGRlY29kZVVSSUNvbXBvbmVudChzdHIucmVwbGFjZSgvXFwrL2csICcgJykpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgcmV0dXJuIHN0cjtcbiAgICB9XG59O1xuXG5leHBvcnRzLmVuY29kZSA9IGZ1bmN0aW9uIChzdHIpIHtcbiAgICAvLyBUaGlzIGNvZGUgd2FzIG9yaWdpbmFsbHkgd3JpdHRlbiBieSBCcmlhbiBXaGl0ZSAobXNjZGV4KSBmb3IgdGhlIGlvLmpzIGNvcmUgcXVlcnlzdHJpbmcgbGlicmFyeS5cbiAgICAvLyBJdCBoYXMgYmVlbiBhZGFwdGVkIGhlcmUgZm9yIHN0cmljdGVyIGFkaGVyZW5jZSB0byBSRkMgMzk4NlxuICAgIGlmIChzdHIubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIHJldHVybiBzdHI7XG4gICAgfVxuXG4gICAgdmFyIHN0cmluZyA9IHR5cGVvZiBzdHIgPT09ICdzdHJpbmcnID8gc3RyIDogU3RyaW5nKHN0cik7XG5cbiAgICB2YXIgb3V0ID0gJyc7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBzdHJpbmcubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgdmFyIGMgPSBzdHJpbmcuY2hhckNvZGVBdChpKTtcblxuICAgICAgICBpZiAoXG4gICAgICAgICAgICBjID09PSAweDJEIHx8IC8vIC1cbiAgICAgICAgICAgIGMgPT09IDB4MkUgfHwgLy8gLlxuICAgICAgICAgICAgYyA9PT0gMHg1RiB8fCAvLyBfXG4gICAgICAgICAgICBjID09PSAweDdFIHx8IC8vIH5cbiAgICAgICAgICAgIChjID49IDB4MzAgJiYgYyA8PSAweDM5KSB8fCAvLyAwLTlcbiAgICAgICAgICAgIChjID49IDB4NDEgJiYgYyA8PSAweDVBKSB8fCAvLyBhLXpcbiAgICAgICAgICAgIChjID49IDB4NjEgJiYgYyA8PSAweDdBKSAvLyBBLVpcbiAgICAgICAgKSB7XG4gICAgICAgICAgICBvdXQgKz0gc3RyaW5nLmNoYXJBdChpKTtcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGMgPCAweDgwKSB7XG4gICAgICAgICAgICBvdXQgPSBvdXQgKyBoZXhUYWJsZVtjXTtcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGMgPCAweDgwMCkge1xuICAgICAgICAgICAgb3V0ID0gb3V0ICsgKGhleFRhYmxlWzB4QzAgfCAoYyA+PiA2KV0gKyBoZXhUYWJsZVsweDgwIHwgKGMgJiAweDNGKV0pO1xuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoYyA8IDB4RDgwMCB8fCBjID49IDB4RTAwMCkge1xuICAgICAgICAgICAgb3V0ID0gb3V0ICsgKGhleFRhYmxlWzB4RTAgfCAoYyA+PiAxMildICsgaGV4VGFibGVbMHg4MCB8ICgoYyA+PiA2KSAmIDB4M0YpXSArIGhleFRhYmxlWzB4ODAgfCAoYyAmIDB4M0YpXSk7XG4gICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGkgKz0gMTtcbiAgICAgICAgYyA9IDB4MTAwMDAgKyAoKChjICYgMHgzRkYpIDw8IDEwKSB8IChzdHJpbmcuY2hhckNvZGVBdChpKSAmIDB4M0ZGKSk7XG4gICAgICAgIG91dCArPSAoaGV4VGFibGVbMHhGMCB8IChjID4+IDE4KV0gKyBoZXhUYWJsZVsweDgwIHwgKChjID4+IDEyKSAmIDB4M0YpXSArIGhleFRhYmxlWzB4ODAgfCAoKGMgPj4gNikgJiAweDNGKV0gKyBoZXhUYWJsZVsweDgwIHwgKGMgJiAweDNGKV0pO1xuICAgIH1cblxuICAgIHJldHVybiBvdXQ7XG59O1xuXG5leHBvcnRzLmNvbXBhY3QgPSBmdW5jdGlvbiAob2JqLCByZWZlcmVuY2VzKSB7XG4gICAgaWYgKHR5cGVvZiBvYmogIT09ICdvYmplY3QnIHx8IG9iaiA9PT0gbnVsbCkge1xuICAgICAgICByZXR1cm4gb2JqO1xuICAgIH1cblxuICAgIHZhciByZWZzID0gcmVmZXJlbmNlcyB8fCBbXTtcbiAgICB2YXIgbG9va3VwID0gcmVmcy5pbmRleE9mKG9iaik7XG4gICAgaWYgKGxvb2t1cCAhPT0gLTEpIHtcbiAgICAgICAgcmV0dXJuIHJlZnNbbG9va3VwXTtcbiAgICB9XG5cbiAgICByZWZzLnB1c2gob2JqKTtcblxuICAgIGlmIChBcnJheS5pc0FycmF5KG9iaikpIHtcbiAgICAgICAgdmFyIGNvbXBhY3RlZCA9IFtdO1xuXG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgb2JqLmxlbmd0aDsgKytpKSB7XG4gICAgICAgICAgICBpZiAodHlwZW9mIG9ialtpXSAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgICAgICBjb21wYWN0ZWQucHVzaChvYmpbaV0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGNvbXBhY3RlZDtcbiAgICB9XG5cbiAgICB2YXIga2V5cyA9IE9iamVjdC5rZXlzKG9iaik7XG4gICAgZm9yICh2YXIgaiA9IDA7IGogPCBrZXlzLmxlbmd0aDsgKytqKSB7XG4gICAgICAgIHZhciBrZXkgPSBrZXlzW2pdO1xuICAgICAgICBvYmpba2V5XSA9IGV4cG9ydHMuY29tcGFjdChvYmpba2V5XSwgcmVmcyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIG9iajtcbn07XG5cbmV4cG9ydHMuaXNSZWdFeHAgPSBmdW5jdGlvbiAob2JqKSB7XG4gICAgcmV0dXJuIE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChvYmopID09PSAnW29iamVjdCBSZWdFeHBdJztcbn07XG5cbmV4cG9ydHMuaXNCdWZmZXIgPSBmdW5jdGlvbiAob2JqKSB7XG4gICAgaWYgKG9iaiA9PT0gbnVsbCB8fCB0eXBlb2Ygb2JqID09PSAndW5kZWZpbmVkJykge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgcmV0dXJuICEhKG9iai5jb25zdHJ1Y3RvciAmJiBvYmouY29uc3RydWN0b3IuaXNCdWZmZXIgJiYgb2JqLmNvbnN0cnVjdG9yLmlzQnVmZmVyKG9iaikpO1xufTtcbiIsIi8qIVxuICogVGhlIGJ1ZmZlciBtb2R1bGUgZnJvbSBub2RlLmpzLCBmb3IgdGhlIGJyb3dzZXIuXG4gKlxuICogQGF1dGhvciAgIEZlcm9zcyBBYm91a2hhZGlqZWggPGZlcm9zc0BmZXJvc3Mub3JnPiA8aHR0cDovL2Zlcm9zcy5vcmc+XG4gKiBAbGljZW5zZSAgTUlUXG4gKi9cbi8qIGVzbGludC1kaXNhYmxlIG5vLXByb3RvICovXG5cbid1c2Ugc3RyaWN0J1xuXG52YXIgYmFzZTY0ID0gcmVxdWlyZSgnYmFzZTY0LWpzJylcbnZhciBpZWVlNzU0ID0gcmVxdWlyZSgnaWVlZTc1NCcpXG52YXIgaXNBcnJheSA9IHJlcXVpcmUoJ2lzYXJyYXknKVxuXG5leHBvcnRzLkJ1ZmZlciA9IEJ1ZmZlclxuZXhwb3J0cy5TbG93QnVmZmVyID0gU2xvd0J1ZmZlclxuZXhwb3J0cy5JTlNQRUNUX01BWF9CWVRFUyA9IDUwXG5CdWZmZXIucG9vbFNpemUgPSA4MTkyIC8vIG5vdCB1c2VkIGJ5IHRoaXMgaW1wbGVtZW50YXRpb25cblxudmFyIHJvb3RQYXJlbnQgPSB7fVxuXG4vKipcbiAqIElmIGBCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVGA6XG4gKiAgID09PSB0cnVlICAgIFVzZSBVaW50OEFycmF5IGltcGxlbWVudGF0aW9uIChmYXN0ZXN0KVxuICogICA9PT0gZmFsc2UgICBVc2UgT2JqZWN0IGltcGxlbWVudGF0aW9uIChtb3N0IGNvbXBhdGlibGUsIGV2ZW4gSUU2KVxuICpcbiAqIEJyb3dzZXJzIHRoYXQgc3VwcG9ydCB0eXBlZCBhcnJheXMgYXJlIElFIDEwKywgRmlyZWZveCA0KywgQ2hyb21lIDcrLCBTYWZhcmkgNS4xKyxcbiAqIE9wZXJhIDExLjYrLCBpT1MgNC4yKy5cbiAqXG4gKiBEdWUgdG8gdmFyaW91cyBicm93c2VyIGJ1Z3MsIHNvbWV0aW1lcyB0aGUgT2JqZWN0IGltcGxlbWVudGF0aW9uIHdpbGwgYmUgdXNlZCBldmVuXG4gKiB3aGVuIHRoZSBicm93c2VyIHN1cHBvcnRzIHR5cGVkIGFycmF5cy5cbiAqXG4gKiBOb3RlOlxuICpcbiAqICAgLSBGaXJlZm94IDQtMjkgbGFja3Mgc3VwcG9ydCBmb3IgYWRkaW5nIG5ldyBwcm9wZXJ0aWVzIHRvIGBVaW50OEFycmF5YCBpbnN0YW5jZXMsXG4gKiAgICAgU2VlOiBodHRwczovL2J1Z3ppbGxhLm1vemlsbGEub3JnL3Nob3dfYnVnLmNnaT9pZD02OTU0MzguXG4gKlxuICogICAtIENocm9tZSA5LTEwIGlzIG1pc3NpbmcgdGhlIGBUeXBlZEFycmF5LnByb3RvdHlwZS5zdWJhcnJheWAgZnVuY3Rpb24uXG4gKlxuICogICAtIElFMTAgaGFzIGEgYnJva2VuIGBUeXBlZEFycmF5LnByb3RvdHlwZS5zdWJhcnJheWAgZnVuY3Rpb24gd2hpY2ggcmV0dXJucyBhcnJheXMgb2ZcbiAqICAgICBpbmNvcnJlY3QgbGVuZ3RoIGluIHNvbWUgc2l0dWF0aW9ucy5cblxuICogV2UgZGV0ZWN0IHRoZXNlIGJ1Z2d5IGJyb3dzZXJzIGFuZCBzZXQgYEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUYCB0byBgZmFsc2VgIHNvIHRoZXlcbiAqIGdldCB0aGUgT2JqZWN0IGltcGxlbWVudGF0aW9uLCB3aGljaCBpcyBzbG93ZXIgYnV0IGJlaGF2ZXMgY29ycmVjdGx5LlxuICovXG5CdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCA9IGdsb2JhbC5UWVBFRF9BUlJBWV9TVVBQT1JUICE9PSB1bmRlZmluZWRcbiAgPyBnbG9iYWwuVFlQRURfQVJSQVlfU1VQUE9SVFxuICA6IHR5cGVkQXJyYXlTdXBwb3J0KClcblxuZnVuY3Rpb24gdHlwZWRBcnJheVN1cHBvcnQgKCkge1xuICB0cnkge1xuICAgIHZhciBhcnIgPSBuZXcgVWludDhBcnJheSgxKVxuICAgIGFyci5mb28gPSBmdW5jdGlvbiAoKSB7IHJldHVybiA0MiB9XG4gICAgcmV0dXJuIGFyci5mb28oKSA9PT0gNDIgJiYgLy8gdHlwZWQgYXJyYXkgaW5zdGFuY2VzIGNhbiBiZSBhdWdtZW50ZWRcbiAgICAgICAgdHlwZW9mIGFyci5zdWJhcnJheSA9PT0gJ2Z1bmN0aW9uJyAmJiAvLyBjaHJvbWUgOS0xMCBsYWNrIGBzdWJhcnJheWBcbiAgICAgICAgYXJyLnN1YmFycmF5KDEsIDEpLmJ5dGVMZW5ndGggPT09IDAgLy8gaWUxMCBoYXMgYnJva2VuIGBzdWJhcnJheWBcbiAgfSBjYXRjaCAoZSkge1xuICAgIHJldHVybiBmYWxzZVxuICB9XG59XG5cbmZ1bmN0aW9uIGtNYXhMZW5ndGggKCkge1xuICByZXR1cm4gQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlRcbiAgICA/IDB4N2ZmZmZmZmZcbiAgICA6IDB4M2ZmZmZmZmZcbn1cblxuLyoqXG4gKiBUaGUgQnVmZmVyIGNvbnN0cnVjdG9yIHJldHVybnMgaW5zdGFuY2VzIG9mIGBVaW50OEFycmF5YCB0aGF0IGhhdmUgdGhlaXJcbiAqIHByb3RvdHlwZSBjaGFuZ2VkIHRvIGBCdWZmZXIucHJvdG90eXBlYC4gRnVydGhlcm1vcmUsIGBCdWZmZXJgIGlzIGEgc3ViY2xhc3Mgb2ZcbiAqIGBVaW50OEFycmF5YCwgc28gdGhlIHJldHVybmVkIGluc3RhbmNlcyB3aWxsIGhhdmUgYWxsIHRoZSBub2RlIGBCdWZmZXJgIG1ldGhvZHNcbiAqIGFuZCB0aGUgYFVpbnQ4QXJyYXlgIG1ldGhvZHMuIFNxdWFyZSBicmFja2V0IG5vdGF0aW9uIHdvcmtzIGFzIGV4cGVjdGVkIC0tIGl0XG4gKiByZXR1cm5zIGEgc2luZ2xlIG9jdGV0LlxuICpcbiAqIFRoZSBgVWludDhBcnJheWAgcHJvdG90eXBlIHJlbWFpbnMgdW5tb2RpZmllZC5cbiAqL1xuZnVuY3Rpb24gQnVmZmVyIChhcmcpIHtcbiAgaWYgKCEodGhpcyBpbnN0YW5jZW9mIEJ1ZmZlcikpIHtcbiAgICAvLyBBdm9pZCBnb2luZyB0aHJvdWdoIGFuIEFyZ3VtZW50c0FkYXB0b3JUcmFtcG9saW5lIGluIHRoZSBjb21tb24gY2FzZS5cbiAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA+IDEpIHJldHVybiBuZXcgQnVmZmVyKGFyZywgYXJndW1lbnRzWzFdKVxuICAgIHJldHVybiBuZXcgQnVmZmVyKGFyZylcbiAgfVxuXG4gIGlmICghQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICB0aGlzLmxlbmd0aCA9IDBcbiAgICB0aGlzLnBhcmVudCA9IHVuZGVmaW5lZFxuICB9XG5cbiAgLy8gQ29tbW9uIGNhc2UuXG4gIGlmICh0eXBlb2YgYXJnID09PSAnbnVtYmVyJykge1xuICAgIHJldHVybiBmcm9tTnVtYmVyKHRoaXMsIGFyZylcbiAgfVxuXG4gIC8vIFNsaWdodGx5IGxlc3MgY29tbW9uIGNhc2UuXG4gIGlmICh0eXBlb2YgYXJnID09PSAnc3RyaW5nJykge1xuICAgIHJldHVybiBmcm9tU3RyaW5nKHRoaXMsIGFyZywgYXJndW1lbnRzLmxlbmd0aCA+IDEgPyBhcmd1bWVudHNbMV0gOiAndXRmOCcpXG4gIH1cblxuICAvLyBVbnVzdWFsLlxuICByZXR1cm4gZnJvbU9iamVjdCh0aGlzLCBhcmcpXG59XG5cbi8vIFRPRE86IExlZ2FjeSwgbm90IG5lZWRlZCBhbnltb3JlLiBSZW1vdmUgaW4gbmV4dCBtYWpvciB2ZXJzaW9uLlxuQnVmZmVyLl9hdWdtZW50ID0gZnVuY3Rpb24gKGFycikge1xuICBhcnIuX19wcm90b19fID0gQnVmZmVyLnByb3RvdHlwZVxuICByZXR1cm4gYXJyXG59XG5cbmZ1bmN0aW9uIGZyb21OdW1iZXIgKHRoYXQsIGxlbmd0aCkge1xuICB0aGF0ID0gYWxsb2NhdGUodGhhdCwgbGVuZ3RoIDwgMCA/IDAgOiBjaGVja2VkKGxlbmd0aCkgfCAwKVxuICBpZiAoIUJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAgdGhhdFtpXSA9IDBcbiAgICB9XG4gIH1cbiAgcmV0dXJuIHRoYXRcbn1cblxuZnVuY3Rpb24gZnJvbVN0cmluZyAodGhhdCwgc3RyaW5nLCBlbmNvZGluZykge1xuICBpZiAodHlwZW9mIGVuY29kaW5nICE9PSAnc3RyaW5nJyB8fCBlbmNvZGluZyA9PT0gJycpIGVuY29kaW5nID0gJ3V0ZjgnXG5cbiAgLy8gQXNzdW1wdGlvbjogYnl0ZUxlbmd0aCgpIHJldHVybiB2YWx1ZSBpcyBhbHdheXMgPCBrTWF4TGVuZ3RoLlxuICB2YXIgbGVuZ3RoID0gYnl0ZUxlbmd0aChzdHJpbmcsIGVuY29kaW5nKSB8IDBcbiAgdGhhdCA9IGFsbG9jYXRlKHRoYXQsIGxlbmd0aClcblxuICB0aGF0LndyaXRlKHN0cmluZywgZW5jb2RpbmcpXG4gIHJldHVybiB0aGF0XG59XG5cbmZ1bmN0aW9uIGZyb21PYmplY3QgKHRoYXQsIG9iamVjdCkge1xuICBpZiAoQnVmZmVyLmlzQnVmZmVyKG9iamVjdCkpIHJldHVybiBmcm9tQnVmZmVyKHRoYXQsIG9iamVjdClcblxuICBpZiAoaXNBcnJheShvYmplY3QpKSByZXR1cm4gZnJvbUFycmF5KHRoYXQsIG9iamVjdClcblxuICBpZiAob2JqZWN0ID09IG51bGwpIHtcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdtdXN0IHN0YXJ0IHdpdGggbnVtYmVyLCBidWZmZXIsIGFycmF5IG9yIHN0cmluZycpXG4gIH1cblxuICBpZiAodHlwZW9mIEFycmF5QnVmZmVyICE9PSAndW5kZWZpbmVkJykge1xuICAgIGlmIChvYmplY3QuYnVmZmVyIGluc3RhbmNlb2YgQXJyYXlCdWZmZXIpIHtcbiAgICAgIHJldHVybiBmcm9tVHlwZWRBcnJheSh0aGF0LCBvYmplY3QpXG4gICAgfVxuICAgIGlmIChvYmplY3QgaW5zdGFuY2VvZiBBcnJheUJ1ZmZlcikge1xuICAgICAgcmV0dXJuIGZyb21BcnJheUJ1ZmZlcih0aGF0LCBvYmplY3QpXG4gICAgfVxuICB9XG5cbiAgaWYgKG9iamVjdC5sZW5ndGgpIHJldHVybiBmcm9tQXJyYXlMaWtlKHRoYXQsIG9iamVjdClcblxuICByZXR1cm4gZnJvbUpzb25PYmplY3QodGhhdCwgb2JqZWN0KVxufVxuXG5mdW5jdGlvbiBmcm9tQnVmZmVyICh0aGF0LCBidWZmZXIpIHtcbiAgdmFyIGxlbmd0aCA9IGNoZWNrZWQoYnVmZmVyLmxlbmd0aCkgfCAwXG4gIHRoYXQgPSBhbGxvY2F0ZSh0aGF0LCBsZW5ndGgpXG4gIGJ1ZmZlci5jb3B5KHRoYXQsIDAsIDAsIGxlbmd0aClcbiAgcmV0dXJuIHRoYXRcbn1cblxuZnVuY3Rpb24gZnJvbUFycmF5ICh0aGF0LCBhcnJheSkge1xuICB2YXIgbGVuZ3RoID0gY2hlY2tlZChhcnJheS5sZW5ndGgpIHwgMFxuICB0aGF0ID0gYWxsb2NhdGUodGhhdCwgbGVuZ3RoKVxuICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbmd0aDsgaSArPSAxKSB7XG4gICAgdGhhdFtpXSA9IGFycmF5W2ldICYgMjU1XG4gIH1cbiAgcmV0dXJuIHRoYXRcbn1cblxuLy8gRHVwbGljYXRlIG9mIGZyb21BcnJheSgpIHRvIGtlZXAgZnJvbUFycmF5KCkgbW9ub21vcnBoaWMuXG5mdW5jdGlvbiBmcm9tVHlwZWRBcnJheSAodGhhdCwgYXJyYXkpIHtcbiAgdmFyIGxlbmd0aCA9IGNoZWNrZWQoYXJyYXkubGVuZ3RoKSB8IDBcbiAgdGhhdCA9IGFsbG9jYXRlKHRoYXQsIGxlbmd0aClcbiAgLy8gVHJ1bmNhdGluZyB0aGUgZWxlbWVudHMgaXMgcHJvYmFibHkgbm90IHdoYXQgcGVvcGxlIGV4cGVjdCBmcm9tIHR5cGVkXG4gIC8vIGFycmF5cyB3aXRoIEJZVEVTX1BFUl9FTEVNRU5UID4gMSBidXQgaXQncyBjb21wYXRpYmxlIHdpdGggdGhlIGJlaGF2aW9yXG4gIC8vIG9mIHRoZSBvbGQgQnVmZmVyIGNvbnN0cnVjdG9yLlxuICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbmd0aDsgaSArPSAxKSB7XG4gICAgdGhhdFtpXSA9IGFycmF5W2ldICYgMjU1XG4gIH1cbiAgcmV0dXJuIHRoYXRcbn1cblxuZnVuY3Rpb24gZnJvbUFycmF5QnVmZmVyICh0aGF0LCBhcnJheSkge1xuICBhcnJheS5ieXRlTGVuZ3RoIC8vIHRoaXMgdGhyb3dzIGlmIGBhcnJheWAgaXMgbm90IGEgdmFsaWQgQXJyYXlCdWZmZXJcblxuICBpZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICAvLyBSZXR1cm4gYW4gYXVnbWVudGVkIGBVaW50OEFycmF5YCBpbnN0YW5jZSwgZm9yIGJlc3QgcGVyZm9ybWFuY2VcbiAgICB0aGF0ID0gbmV3IFVpbnQ4QXJyYXkoYXJyYXkpXG4gICAgdGhhdC5fX3Byb3RvX18gPSBCdWZmZXIucHJvdG90eXBlXG4gIH0gZWxzZSB7XG4gICAgLy8gRmFsbGJhY2s6IFJldHVybiBhbiBvYmplY3QgaW5zdGFuY2Ugb2YgdGhlIEJ1ZmZlciBjbGFzc1xuICAgIHRoYXQgPSBmcm9tVHlwZWRBcnJheSh0aGF0LCBuZXcgVWludDhBcnJheShhcnJheSkpXG4gIH1cbiAgcmV0dXJuIHRoYXRcbn1cblxuZnVuY3Rpb24gZnJvbUFycmF5TGlrZSAodGhhdCwgYXJyYXkpIHtcbiAgdmFyIGxlbmd0aCA9IGNoZWNrZWQoYXJyYXkubGVuZ3RoKSB8IDBcbiAgdGhhdCA9IGFsbG9jYXRlKHRoYXQsIGxlbmd0aClcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7IGkgKz0gMSkge1xuICAgIHRoYXRbaV0gPSBhcnJheVtpXSAmIDI1NVxuICB9XG4gIHJldHVybiB0aGF0XG59XG5cbi8vIERlc2VyaWFsaXplIHsgdHlwZTogJ0J1ZmZlcicsIGRhdGE6IFsxLDIsMywuLi5dIH0gaW50byBhIEJ1ZmZlciBvYmplY3QuXG4vLyBSZXR1cm5zIGEgemVyby1sZW5ndGggYnVmZmVyIGZvciBpbnB1dHMgdGhhdCBkb24ndCBjb25mb3JtIHRvIHRoZSBzcGVjLlxuZnVuY3Rpb24gZnJvbUpzb25PYmplY3QgKHRoYXQsIG9iamVjdCkge1xuICB2YXIgYXJyYXlcbiAgdmFyIGxlbmd0aCA9IDBcblxuICBpZiAob2JqZWN0LnR5cGUgPT09ICdCdWZmZXInICYmIGlzQXJyYXkob2JqZWN0LmRhdGEpKSB7XG4gICAgYXJyYXkgPSBvYmplY3QuZGF0YVxuICAgIGxlbmd0aCA9IGNoZWNrZWQoYXJyYXkubGVuZ3RoKSB8IDBcbiAgfVxuICB0aGF0ID0gYWxsb2NhdGUodGhhdCwgbGVuZ3RoKVxuXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuZ3RoOyBpICs9IDEpIHtcbiAgICB0aGF0W2ldID0gYXJyYXlbaV0gJiAyNTVcbiAgfVxuICByZXR1cm4gdGhhdFxufVxuXG5pZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgQnVmZmVyLnByb3RvdHlwZS5fX3Byb3RvX18gPSBVaW50OEFycmF5LnByb3RvdHlwZVxuICBCdWZmZXIuX19wcm90b19fID0gVWludDhBcnJheVxuICBpZiAodHlwZW9mIFN5bWJvbCAhPT0gJ3VuZGVmaW5lZCcgJiYgU3ltYm9sLnNwZWNpZXMgJiZcbiAgICAgIEJ1ZmZlcltTeW1ib2wuc3BlY2llc10gPT09IEJ1ZmZlcikge1xuICAgIC8vIEZpeCBzdWJhcnJheSgpIGluIEVTMjAxNi4gU2VlOiBodHRwczovL2dpdGh1Yi5jb20vZmVyb3NzL2J1ZmZlci9wdWxsLzk3XG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KEJ1ZmZlciwgU3ltYm9sLnNwZWNpZXMsIHtcbiAgICAgIHZhbHVlOiBudWxsLFxuICAgICAgY29uZmlndXJhYmxlOiB0cnVlXG4gICAgfSlcbiAgfVxufSBlbHNlIHtcbiAgLy8gcHJlLXNldCBmb3IgdmFsdWVzIHRoYXQgbWF5IGV4aXN0IGluIHRoZSBmdXR1cmVcbiAgQnVmZmVyLnByb3RvdHlwZS5sZW5ndGggPSB1bmRlZmluZWRcbiAgQnVmZmVyLnByb3RvdHlwZS5wYXJlbnQgPSB1bmRlZmluZWRcbn1cblxuZnVuY3Rpb24gYWxsb2NhdGUgKHRoYXQsIGxlbmd0aCkge1xuICBpZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICAvLyBSZXR1cm4gYW4gYXVnbWVudGVkIGBVaW50OEFycmF5YCBpbnN0YW5jZSwgZm9yIGJlc3QgcGVyZm9ybWFuY2VcbiAgICB0aGF0ID0gbmV3IFVpbnQ4QXJyYXkobGVuZ3RoKVxuICAgIHRoYXQuX19wcm90b19fID0gQnVmZmVyLnByb3RvdHlwZVxuICB9IGVsc2Uge1xuICAgIC8vIEZhbGxiYWNrOiBSZXR1cm4gYW4gb2JqZWN0IGluc3RhbmNlIG9mIHRoZSBCdWZmZXIgY2xhc3NcbiAgICB0aGF0Lmxlbmd0aCA9IGxlbmd0aFxuICB9XG5cbiAgdmFyIGZyb21Qb29sID0gbGVuZ3RoICE9PSAwICYmIGxlbmd0aCA8PSBCdWZmZXIucG9vbFNpemUgPj4+IDFcbiAgaWYgKGZyb21Qb29sKSB0aGF0LnBhcmVudCA9IHJvb3RQYXJlbnRcblxuICByZXR1cm4gdGhhdFxufVxuXG5mdW5jdGlvbiBjaGVja2VkIChsZW5ndGgpIHtcbiAgLy8gTm90ZTogY2Fubm90IHVzZSBgbGVuZ3RoIDwga01heExlbmd0aGAgaGVyZSBiZWNhdXNlIHRoYXQgZmFpbHMgd2hlblxuICAvLyBsZW5ndGggaXMgTmFOICh3aGljaCBpcyBvdGhlcndpc2UgY29lcmNlZCB0byB6ZXJvLilcbiAgaWYgKGxlbmd0aCA+PSBrTWF4TGVuZ3RoKCkpIHtcbiAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcignQXR0ZW1wdCB0byBhbGxvY2F0ZSBCdWZmZXIgbGFyZ2VyIHRoYW4gbWF4aW11bSAnICtcbiAgICAgICAgICAgICAgICAgICAgICAgICAnc2l6ZTogMHgnICsga01heExlbmd0aCgpLnRvU3RyaW5nKDE2KSArICcgYnl0ZXMnKVxuICB9XG4gIHJldHVybiBsZW5ndGggfCAwXG59XG5cbmZ1bmN0aW9uIFNsb3dCdWZmZXIgKHN1YmplY3QsIGVuY29kaW5nKSB7XG4gIGlmICghKHRoaXMgaW5zdGFuY2VvZiBTbG93QnVmZmVyKSkgcmV0dXJuIG5ldyBTbG93QnVmZmVyKHN1YmplY3QsIGVuY29kaW5nKVxuXG4gIHZhciBidWYgPSBuZXcgQnVmZmVyKHN1YmplY3QsIGVuY29kaW5nKVxuICBkZWxldGUgYnVmLnBhcmVudFxuICByZXR1cm4gYnVmXG59XG5cbkJ1ZmZlci5pc0J1ZmZlciA9IGZ1bmN0aW9uIGlzQnVmZmVyIChiKSB7XG4gIHJldHVybiAhIShiICE9IG51bGwgJiYgYi5faXNCdWZmZXIpXG59XG5cbkJ1ZmZlci5jb21wYXJlID0gZnVuY3Rpb24gY29tcGFyZSAoYSwgYikge1xuICBpZiAoIUJ1ZmZlci5pc0J1ZmZlcihhKSB8fCAhQnVmZmVyLmlzQnVmZmVyKGIpKSB7XG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcignQXJndW1lbnRzIG11c3QgYmUgQnVmZmVycycpXG4gIH1cblxuICBpZiAoYSA9PT0gYikgcmV0dXJuIDBcblxuICB2YXIgeCA9IGEubGVuZ3RoXG4gIHZhciB5ID0gYi5sZW5ndGhcblxuICBmb3IgKHZhciBpID0gMCwgbGVuID0gTWF0aC5taW4oeCwgeSk7IGkgPCBsZW47ICsraSkge1xuICAgIGlmIChhW2ldICE9PSBiW2ldKSB7XG4gICAgICB4ID0gYVtpXVxuICAgICAgeSA9IGJbaV1cbiAgICAgIGJyZWFrXG4gICAgfVxuICB9XG5cbiAgaWYgKHggPCB5KSByZXR1cm4gLTFcbiAgaWYgKHkgPCB4KSByZXR1cm4gMVxuICByZXR1cm4gMFxufVxuXG5CdWZmZXIuaXNFbmNvZGluZyA9IGZ1bmN0aW9uIGlzRW5jb2RpbmcgKGVuY29kaW5nKSB7XG4gIHN3aXRjaCAoU3RyaW5nKGVuY29kaW5nKS50b0xvd2VyQ2FzZSgpKSB7XG4gICAgY2FzZSAnaGV4JzpcbiAgICBjYXNlICd1dGY4JzpcbiAgICBjYXNlICd1dGYtOCc6XG4gICAgY2FzZSAnYXNjaWknOlxuICAgIGNhc2UgJ2JpbmFyeSc6XG4gICAgY2FzZSAnYmFzZTY0JzpcbiAgICBjYXNlICdyYXcnOlxuICAgIGNhc2UgJ3VjczInOlxuICAgIGNhc2UgJ3Vjcy0yJzpcbiAgICBjYXNlICd1dGYxNmxlJzpcbiAgICBjYXNlICd1dGYtMTZsZSc6XG4gICAgICByZXR1cm4gdHJ1ZVxuICAgIGRlZmF1bHQ6XG4gICAgICByZXR1cm4gZmFsc2VcbiAgfVxufVxuXG5CdWZmZXIuY29uY2F0ID0gZnVuY3Rpb24gY29uY2F0IChsaXN0LCBsZW5ndGgpIHtcbiAgaWYgKCFpc0FycmF5KGxpc3QpKSB0aHJvdyBuZXcgVHlwZUVycm9yKCdsaXN0IGFyZ3VtZW50IG11c3QgYmUgYW4gQXJyYXkgb2YgQnVmZmVycy4nKVxuXG4gIGlmIChsaXN0Lmxlbmd0aCA9PT0gMCkge1xuICAgIHJldHVybiBuZXcgQnVmZmVyKDApXG4gIH1cblxuICB2YXIgaVxuICBpZiAobGVuZ3RoID09PSB1bmRlZmluZWQpIHtcbiAgICBsZW5ndGggPSAwXG4gICAgZm9yIChpID0gMDsgaSA8IGxpc3QubGVuZ3RoOyBpKyspIHtcbiAgICAgIGxlbmd0aCArPSBsaXN0W2ldLmxlbmd0aFxuICAgIH1cbiAgfVxuXG4gIHZhciBidWYgPSBuZXcgQnVmZmVyKGxlbmd0aClcbiAgdmFyIHBvcyA9IDBcbiAgZm9yIChpID0gMDsgaSA8IGxpc3QubGVuZ3RoOyBpKyspIHtcbiAgICB2YXIgaXRlbSA9IGxpc3RbaV1cbiAgICBpdGVtLmNvcHkoYnVmLCBwb3MpXG4gICAgcG9zICs9IGl0ZW0ubGVuZ3RoXG4gIH1cbiAgcmV0dXJuIGJ1ZlxufVxuXG5mdW5jdGlvbiBieXRlTGVuZ3RoIChzdHJpbmcsIGVuY29kaW5nKSB7XG4gIGlmICh0eXBlb2Ygc3RyaW5nICE9PSAnc3RyaW5nJykgc3RyaW5nID0gJycgKyBzdHJpbmdcblxuICB2YXIgbGVuID0gc3RyaW5nLmxlbmd0aFxuICBpZiAobGVuID09PSAwKSByZXR1cm4gMFxuXG4gIC8vIFVzZSBhIGZvciBsb29wIHRvIGF2b2lkIHJlY3Vyc2lvblxuICB2YXIgbG93ZXJlZENhc2UgPSBmYWxzZVxuICBmb3IgKDs7KSB7XG4gICAgc3dpdGNoIChlbmNvZGluZykge1xuICAgICAgY2FzZSAnYXNjaWknOlxuICAgICAgY2FzZSAnYmluYXJ5JzpcbiAgICAgIC8vIERlcHJlY2F0ZWRcbiAgICAgIGNhc2UgJ3Jhdyc6XG4gICAgICBjYXNlICdyYXdzJzpcbiAgICAgICAgcmV0dXJuIGxlblxuICAgICAgY2FzZSAndXRmOCc6XG4gICAgICBjYXNlICd1dGYtOCc6XG4gICAgICAgIHJldHVybiB1dGY4VG9CeXRlcyhzdHJpbmcpLmxlbmd0aFxuICAgICAgY2FzZSAndWNzMic6XG4gICAgICBjYXNlICd1Y3MtMic6XG4gICAgICBjYXNlICd1dGYxNmxlJzpcbiAgICAgIGNhc2UgJ3V0Zi0xNmxlJzpcbiAgICAgICAgcmV0dXJuIGxlbiAqIDJcbiAgICAgIGNhc2UgJ2hleCc6XG4gICAgICAgIHJldHVybiBsZW4gPj4+IDFcbiAgICAgIGNhc2UgJ2Jhc2U2NCc6XG4gICAgICAgIHJldHVybiBiYXNlNjRUb0J5dGVzKHN0cmluZykubGVuZ3RoXG4gICAgICBkZWZhdWx0OlxuICAgICAgICBpZiAobG93ZXJlZENhc2UpIHJldHVybiB1dGY4VG9CeXRlcyhzdHJpbmcpLmxlbmd0aCAvLyBhc3N1bWUgdXRmOFxuICAgICAgICBlbmNvZGluZyA9ICgnJyArIGVuY29kaW5nKS50b0xvd2VyQ2FzZSgpXG4gICAgICAgIGxvd2VyZWRDYXNlID0gdHJ1ZVxuICAgIH1cbiAgfVxufVxuQnVmZmVyLmJ5dGVMZW5ndGggPSBieXRlTGVuZ3RoXG5cbmZ1bmN0aW9uIHNsb3dUb1N0cmluZyAoZW5jb2RpbmcsIHN0YXJ0LCBlbmQpIHtcbiAgdmFyIGxvd2VyZWRDYXNlID0gZmFsc2VcblxuICBzdGFydCA9IHN0YXJ0IHwgMFxuICBlbmQgPSBlbmQgPT09IHVuZGVmaW5lZCB8fCBlbmQgPT09IEluZmluaXR5ID8gdGhpcy5sZW5ndGggOiBlbmQgfCAwXG5cbiAgaWYgKCFlbmNvZGluZykgZW5jb2RpbmcgPSAndXRmOCdcbiAgaWYgKHN0YXJ0IDwgMCkgc3RhcnQgPSAwXG4gIGlmIChlbmQgPiB0aGlzLmxlbmd0aCkgZW5kID0gdGhpcy5sZW5ndGhcbiAgaWYgKGVuZCA8PSBzdGFydCkgcmV0dXJuICcnXG5cbiAgd2hpbGUgKHRydWUpIHtcbiAgICBzd2l0Y2ggKGVuY29kaW5nKSB7XG4gICAgICBjYXNlICdoZXgnOlxuICAgICAgICByZXR1cm4gaGV4U2xpY2UodGhpcywgc3RhcnQsIGVuZClcblxuICAgICAgY2FzZSAndXRmOCc6XG4gICAgICBjYXNlICd1dGYtOCc6XG4gICAgICAgIHJldHVybiB1dGY4U2xpY2UodGhpcywgc3RhcnQsIGVuZClcblxuICAgICAgY2FzZSAnYXNjaWknOlxuICAgICAgICByZXR1cm4gYXNjaWlTbGljZSh0aGlzLCBzdGFydCwgZW5kKVxuXG4gICAgICBjYXNlICdiaW5hcnknOlxuICAgICAgICByZXR1cm4gYmluYXJ5U2xpY2UodGhpcywgc3RhcnQsIGVuZClcblxuICAgICAgY2FzZSAnYmFzZTY0JzpcbiAgICAgICAgcmV0dXJuIGJhc2U2NFNsaWNlKHRoaXMsIHN0YXJ0LCBlbmQpXG5cbiAgICAgIGNhc2UgJ3VjczInOlxuICAgICAgY2FzZSAndWNzLTInOlxuICAgICAgY2FzZSAndXRmMTZsZSc6XG4gICAgICBjYXNlICd1dGYtMTZsZSc6XG4gICAgICAgIHJldHVybiB1dGYxNmxlU2xpY2UodGhpcywgc3RhcnQsIGVuZClcblxuICAgICAgZGVmYXVsdDpcbiAgICAgICAgaWYgKGxvd2VyZWRDYXNlKSB0aHJvdyBuZXcgVHlwZUVycm9yKCdVbmtub3duIGVuY29kaW5nOiAnICsgZW5jb2RpbmcpXG4gICAgICAgIGVuY29kaW5nID0gKGVuY29kaW5nICsgJycpLnRvTG93ZXJDYXNlKClcbiAgICAgICAgbG93ZXJlZENhc2UgPSB0cnVlXG4gICAgfVxuICB9XG59XG5cbi8vIFRoZSBwcm9wZXJ0eSBpcyB1c2VkIGJ5IGBCdWZmZXIuaXNCdWZmZXJgIGFuZCBgaXMtYnVmZmVyYCAoaW4gU2FmYXJpIDUtNykgdG8gZGV0ZWN0XG4vLyBCdWZmZXIgaW5zdGFuY2VzLlxuQnVmZmVyLnByb3RvdHlwZS5faXNCdWZmZXIgPSB0cnVlXG5cbkJ1ZmZlci5wcm90b3R5cGUudG9TdHJpbmcgPSBmdW5jdGlvbiB0b1N0cmluZyAoKSB7XG4gIHZhciBsZW5ndGggPSB0aGlzLmxlbmd0aCB8IDBcbiAgaWYgKGxlbmd0aCA9PT0gMCkgcmV0dXJuICcnXG4gIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAwKSByZXR1cm4gdXRmOFNsaWNlKHRoaXMsIDAsIGxlbmd0aClcbiAgcmV0dXJuIHNsb3dUb1N0cmluZy5hcHBseSh0aGlzLCBhcmd1bWVudHMpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUuZXF1YWxzID0gZnVuY3Rpb24gZXF1YWxzIChiKSB7XG4gIGlmICghQnVmZmVyLmlzQnVmZmVyKGIpKSB0aHJvdyBuZXcgVHlwZUVycm9yKCdBcmd1bWVudCBtdXN0IGJlIGEgQnVmZmVyJylcbiAgaWYgKHRoaXMgPT09IGIpIHJldHVybiB0cnVlXG4gIHJldHVybiBCdWZmZXIuY29tcGFyZSh0aGlzLCBiKSA9PT0gMFxufVxuXG5CdWZmZXIucHJvdG90eXBlLmluc3BlY3QgPSBmdW5jdGlvbiBpbnNwZWN0ICgpIHtcbiAgdmFyIHN0ciA9ICcnXG4gIHZhciBtYXggPSBleHBvcnRzLklOU1BFQ1RfTUFYX0JZVEVTXG4gIGlmICh0aGlzLmxlbmd0aCA+IDApIHtcbiAgICBzdHIgPSB0aGlzLnRvU3RyaW5nKCdoZXgnLCAwLCBtYXgpLm1hdGNoKC8uezJ9L2cpLmpvaW4oJyAnKVxuICAgIGlmICh0aGlzLmxlbmd0aCA+IG1heCkgc3RyICs9ICcgLi4uICdcbiAgfVxuICByZXR1cm4gJzxCdWZmZXIgJyArIHN0ciArICc+J1xufVxuXG5CdWZmZXIucHJvdG90eXBlLmNvbXBhcmUgPSBmdW5jdGlvbiBjb21wYXJlIChiKSB7XG4gIGlmICghQnVmZmVyLmlzQnVmZmVyKGIpKSB0aHJvdyBuZXcgVHlwZUVycm9yKCdBcmd1bWVudCBtdXN0IGJlIGEgQnVmZmVyJylcbiAgcmV0dXJuIEJ1ZmZlci5jb21wYXJlKHRoaXMsIGIpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUuaW5kZXhPZiA9IGZ1bmN0aW9uIGluZGV4T2YgKHZhbCwgYnl0ZU9mZnNldCkge1xuICBpZiAoYnl0ZU9mZnNldCA+IDB4N2ZmZmZmZmYpIGJ5dGVPZmZzZXQgPSAweDdmZmZmZmZmXG4gIGVsc2UgaWYgKGJ5dGVPZmZzZXQgPCAtMHg4MDAwMDAwMCkgYnl0ZU9mZnNldCA9IC0weDgwMDAwMDAwXG4gIGJ5dGVPZmZzZXQgPj49IDBcblxuICBpZiAodGhpcy5sZW5ndGggPT09IDApIHJldHVybiAtMVxuICBpZiAoYnl0ZU9mZnNldCA+PSB0aGlzLmxlbmd0aCkgcmV0dXJuIC0xXG5cbiAgLy8gTmVnYXRpdmUgb2Zmc2V0cyBzdGFydCBmcm9tIHRoZSBlbmQgb2YgdGhlIGJ1ZmZlclxuICBpZiAoYnl0ZU9mZnNldCA8IDApIGJ5dGVPZmZzZXQgPSBNYXRoLm1heCh0aGlzLmxlbmd0aCArIGJ5dGVPZmZzZXQsIDApXG5cbiAgaWYgKHR5cGVvZiB2YWwgPT09ICdzdHJpbmcnKSB7XG4gICAgaWYgKHZhbC5sZW5ndGggPT09IDApIHJldHVybiAtMSAvLyBzcGVjaWFsIGNhc2U6IGxvb2tpbmcgZm9yIGVtcHR5IHN0cmluZyBhbHdheXMgZmFpbHNcbiAgICByZXR1cm4gU3RyaW5nLnByb3RvdHlwZS5pbmRleE9mLmNhbGwodGhpcywgdmFsLCBieXRlT2Zmc2V0KVxuICB9XG4gIGlmIChCdWZmZXIuaXNCdWZmZXIodmFsKSkge1xuICAgIHJldHVybiBhcnJheUluZGV4T2YodGhpcywgdmFsLCBieXRlT2Zmc2V0KVxuICB9XG4gIGlmICh0eXBlb2YgdmFsID09PSAnbnVtYmVyJykge1xuICAgIGlmIChCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCAmJiBVaW50OEFycmF5LnByb3RvdHlwZS5pbmRleE9mID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICByZXR1cm4gVWludDhBcnJheS5wcm90b3R5cGUuaW5kZXhPZi5jYWxsKHRoaXMsIHZhbCwgYnl0ZU9mZnNldClcbiAgICB9XG4gICAgcmV0dXJuIGFycmF5SW5kZXhPZih0aGlzLCBbIHZhbCBdLCBieXRlT2Zmc2V0KVxuICB9XG5cbiAgZnVuY3Rpb24gYXJyYXlJbmRleE9mIChhcnIsIHZhbCwgYnl0ZU9mZnNldCkge1xuICAgIHZhciBmb3VuZEluZGV4ID0gLTFcbiAgICBmb3IgKHZhciBpID0gMDsgYnl0ZU9mZnNldCArIGkgPCBhcnIubGVuZ3RoOyBpKyspIHtcbiAgICAgIGlmIChhcnJbYnl0ZU9mZnNldCArIGldID09PSB2YWxbZm91bmRJbmRleCA9PT0gLTEgPyAwIDogaSAtIGZvdW5kSW5kZXhdKSB7XG4gICAgICAgIGlmIChmb3VuZEluZGV4ID09PSAtMSkgZm91bmRJbmRleCA9IGlcbiAgICAgICAgaWYgKGkgLSBmb3VuZEluZGV4ICsgMSA9PT0gdmFsLmxlbmd0aCkgcmV0dXJuIGJ5dGVPZmZzZXQgKyBmb3VuZEluZGV4XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBmb3VuZEluZGV4ID0gLTFcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIC0xXG4gIH1cblxuICB0aHJvdyBuZXcgVHlwZUVycm9yKCd2YWwgbXVzdCBiZSBzdHJpbmcsIG51bWJlciBvciBCdWZmZXInKVxufVxuXG5mdW5jdGlvbiBoZXhXcml0ZSAoYnVmLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKSB7XG4gIG9mZnNldCA9IE51bWJlcihvZmZzZXQpIHx8IDBcbiAgdmFyIHJlbWFpbmluZyA9IGJ1Zi5sZW5ndGggLSBvZmZzZXRcbiAgaWYgKCFsZW5ndGgpIHtcbiAgICBsZW5ndGggPSByZW1haW5pbmdcbiAgfSBlbHNlIHtcbiAgICBsZW5ndGggPSBOdW1iZXIobGVuZ3RoKVxuICAgIGlmIChsZW5ndGggPiByZW1haW5pbmcpIHtcbiAgICAgIGxlbmd0aCA9IHJlbWFpbmluZ1xuICAgIH1cbiAgfVxuXG4gIC8vIG11c3QgYmUgYW4gZXZlbiBudW1iZXIgb2YgZGlnaXRzXG4gIHZhciBzdHJMZW4gPSBzdHJpbmcubGVuZ3RoXG4gIGlmIChzdHJMZW4gJSAyICE9PSAwKSB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgaGV4IHN0cmluZycpXG5cbiAgaWYgKGxlbmd0aCA+IHN0ckxlbiAvIDIpIHtcbiAgICBsZW5ndGggPSBzdHJMZW4gLyAyXG4gIH1cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgIHZhciBwYXJzZWQgPSBwYXJzZUludChzdHJpbmcuc3Vic3RyKGkgKiAyLCAyKSwgMTYpXG4gICAgaWYgKGlzTmFOKHBhcnNlZCkpIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBoZXggc3RyaW5nJylcbiAgICBidWZbb2Zmc2V0ICsgaV0gPSBwYXJzZWRcbiAgfVxuICByZXR1cm4gaVxufVxuXG5mdW5jdGlvbiB1dGY4V3JpdGUgKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCkge1xuICByZXR1cm4gYmxpdEJ1ZmZlcih1dGY4VG9CeXRlcyhzdHJpbmcsIGJ1Zi5sZW5ndGggLSBvZmZzZXQpLCBidWYsIG9mZnNldCwgbGVuZ3RoKVxufVxuXG5mdW5jdGlvbiBhc2NpaVdyaXRlIChidWYsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpIHtcbiAgcmV0dXJuIGJsaXRCdWZmZXIoYXNjaWlUb0J5dGVzKHN0cmluZyksIGJ1Ziwgb2Zmc2V0LCBsZW5ndGgpXG59XG5cbmZ1bmN0aW9uIGJpbmFyeVdyaXRlIChidWYsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpIHtcbiAgcmV0dXJuIGFzY2lpV3JpdGUoYnVmLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxufVxuXG5mdW5jdGlvbiBiYXNlNjRXcml0ZSAoYnVmLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKSB7XG4gIHJldHVybiBibGl0QnVmZmVyKGJhc2U2NFRvQnl0ZXMoc3RyaW5nKSwgYnVmLCBvZmZzZXQsIGxlbmd0aClcbn1cblxuZnVuY3Rpb24gdWNzMldyaXRlIChidWYsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpIHtcbiAgcmV0dXJuIGJsaXRCdWZmZXIodXRmMTZsZVRvQnl0ZXMoc3RyaW5nLCBidWYubGVuZ3RoIC0gb2Zmc2V0KSwgYnVmLCBvZmZzZXQsIGxlbmd0aClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZSA9IGZ1bmN0aW9uIHdyaXRlIChzdHJpbmcsIG9mZnNldCwgbGVuZ3RoLCBlbmNvZGluZykge1xuICAvLyBCdWZmZXIjd3JpdGUoc3RyaW5nKVxuICBpZiAob2Zmc2V0ID09PSB1bmRlZmluZWQpIHtcbiAgICBlbmNvZGluZyA9ICd1dGY4J1xuICAgIGxlbmd0aCA9IHRoaXMubGVuZ3RoXG4gICAgb2Zmc2V0ID0gMFxuICAvLyBCdWZmZXIjd3JpdGUoc3RyaW5nLCBlbmNvZGluZylcbiAgfSBlbHNlIGlmIChsZW5ndGggPT09IHVuZGVmaW5lZCAmJiB0eXBlb2Ygb2Zmc2V0ID09PSAnc3RyaW5nJykge1xuICAgIGVuY29kaW5nID0gb2Zmc2V0XG4gICAgbGVuZ3RoID0gdGhpcy5sZW5ndGhcbiAgICBvZmZzZXQgPSAwXG4gIC8vIEJ1ZmZlciN3cml0ZShzdHJpbmcsIG9mZnNldFssIGxlbmd0aF1bLCBlbmNvZGluZ10pXG4gIH0gZWxzZSBpZiAoaXNGaW5pdGUob2Zmc2V0KSkge1xuICAgIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgICBpZiAoaXNGaW5pdGUobGVuZ3RoKSkge1xuICAgICAgbGVuZ3RoID0gbGVuZ3RoIHwgMFxuICAgICAgaWYgKGVuY29kaW5nID09PSB1bmRlZmluZWQpIGVuY29kaW5nID0gJ3V0ZjgnXG4gICAgfSBlbHNlIHtcbiAgICAgIGVuY29kaW5nID0gbGVuZ3RoXG4gICAgICBsZW5ndGggPSB1bmRlZmluZWRcbiAgICB9XG4gIC8vIGxlZ2FjeSB3cml0ZShzdHJpbmcsIGVuY29kaW5nLCBvZmZzZXQsIGxlbmd0aCkgLSByZW1vdmUgaW4gdjAuMTNcbiAgfSBlbHNlIHtcbiAgICB2YXIgc3dhcCA9IGVuY29kaW5nXG4gICAgZW5jb2RpbmcgPSBvZmZzZXRcbiAgICBvZmZzZXQgPSBsZW5ndGggfCAwXG4gICAgbGVuZ3RoID0gc3dhcFxuICB9XG5cbiAgdmFyIHJlbWFpbmluZyA9IHRoaXMubGVuZ3RoIC0gb2Zmc2V0XG4gIGlmIChsZW5ndGggPT09IHVuZGVmaW5lZCB8fCBsZW5ndGggPiByZW1haW5pbmcpIGxlbmd0aCA9IHJlbWFpbmluZ1xuXG4gIGlmICgoc3RyaW5nLmxlbmd0aCA+IDAgJiYgKGxlbmd0aCA8IDAgfHwgb2Zmc2V0IDwgMCkpIHx8IG9mZnNldCA+IHRoaXMubGVuZ3RoKSB7XG4gICAgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ2F0dGVtcHQgdG8gd3JpdGUgb3V0c2lkZSBidWZmZXIgYm91bmRzJylcbiAgfVxuXG4gIGlmICghZW5jb2RpbmcpIGVuY29kaW5nID0gJ3V0ZjgnXG5cbiAgdmFyIGxvd2VyZWRDYXNlID0gZmFsc2VcbiAgZm9yICg7Oykge1xuICAgIHN3aXRjaCAoZW5jb2RpbmcpIHtcbiAgICAgIGNhc2UgJ2hleCc6XG4gICAgICAgIHJldHVybiBoZXhXcml0ZSh0aGlzLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxuXG4gICAgICBjYXNlICd1dGY4JzpcbiAgICAgIGNhc2UgJ3V0Zi04JzpcbiAgICAgICAgcmV0dXJuIHV0ZjhXcml0ZSh0aGlzLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxuXG4gICAgICBjYXNlICdhc2NpaSc6XG4gICAgICAgIHJldHVybiBhc2NpaVdyaXRlKHRoaXMsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpXG5cbiAgICAgIGNhc2UgJ2JpbmFyeSc6XG4gICAgICAgIHJldHVybiBiaW5hcnlXcml0ZSh0aGlzLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxuXG4gICAgICBjYXNlICdiYXNlNjQnOlxuICAgICAgICAvLyBXYXJuaW5nOiBtYXhMZW5ndGggbm90IHRha2VuIGludG8gYWNjb3VudCBpbiBiYXNlNjRXcml0ZVxuICAgICAgICByZXR1cm4gYmFzZTY0V3JpdGUodGhpcywgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aClcblxuICAgICAgY2FzZSAndWNzMic6XG4gICAgICBjYXNlICd1Y3MtMic6XG4gICAgICBjYXNlICd1dGYxNmxlJzpcbiAgICAgIGNhc2UgJ3V0Zi0xNmxlJzpcbiAgICAgICAgcmV0dXJuIHVjczJXcml0ZSh0aGlzLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxuXG4gICAgICBkZWZhdWx0OlxuICAgICAgICBpZiAobG93ZXJlZENhc2UpIHRocm93IG5ldyBUeXBlRXJyb3IoJ1Vua25vd24gZW5jb2Rpbmc6ICcgKyBlbmNvZGluZylcbiAgICAgICAgZW5jb2RpbmcgPSAoJycgKyBlbmNvZGluZykudG9Mb3dlckNhc2UoKVxuICAgICAgICBsb3dlcmVkQ2FzZSA9IHRydWVcbiAgICB9XG4gIH1cbn1cblxuQnVmZmVyLnByb3RvdHlwZS50b0pTT04gPSBmdW5jdGlvbiB0b0pTT04gKCkge1xuICByZXR1cm4ge1xuICAgIHR5cGU6ICdCdWZmZXInLFxuICAgIGRhdGE6IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKHRoaXMuX2FyciB8fCB0aGlzLCAwKVxuICB9XG59XG5cbmZ1bmN0aW9uIGJhc2U2NFNsaWNlIChidWYsIHN0YXJ0LCBlbmQpIHtcbiAgaWYgKHN0YXJ0ID09PSAwICYmIGVuZCA9PT0gYnVmLmxlbmd0aCkge1xuICAgIHJldHVybiBiYXNlNjQuZnJvbUJ5dGVBcnJheShidWYpXG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIGJhc2U2NC5mcm9tQnl0ZUFycmF5KGJ1Zi5zbGljZShzdGFydCwgZW5kKSlcbiAgfVxufVxuXG5mdW5jdGlvbiB1dGY4U2xpY2UgKGJ1Ziwgc3RhcnQsIGVuZCkge1xuICBlbmQgPSBNYXRoLm1pbihidWYubGVuZ3RoLCBlbmQpXG4gIHZhciByZXMgPSBbXVxuXG4gIHZhciBpID0gc3RhcnRcbiAgd2hpbGUgKGkgPCBlbmQpIHtcbiAgICB2YXIgZmlyc3RCeXRlID0gYnVmW2ldXG4gICAgdmFyIGNvZGVQb2ludCA9IG51bGxcbiAgICB2YXIgYnl0ZXNQZXJTZXF1ZW5jZSA9IChmaXJzdEJ5dGUgPiAweEVGKSA/IDRcbiAgICAgIDogKGZpcnN0Qnl0ZSA+IDB4REYpID8gM1xuICAgICAgOiAoZmlyc3RCeXRlID4gMHhCRikgPyAyXG4gICAgICA6IDFcblxuICAgIGlmIChpICsgYnl0ZXNQZXJTZXF1ZW5jZSA8PSBlbmQpIHtcbiAgICAgIHZhciBzZWNvbmRCeXRlLCB0aGlyZEJ5dGUsIGZvdXJ0aEJ5dGUsIHRlbXBDb2RlUG9pbnRcblxuICAgICAgc3dpdGNoIChieXRlc1BlclNlcXVlbmNlKSB7XG4gICAgICAgIGNhc2UgMTpcbiAgICAgICAgICBpZiAoZmlyc3RCeXRlIDwgMHg4MCkge1xuICAgICAgICAgICAgY29kZVBvaW50ID0gZmlyc3RCeXRlXG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrXG4gICAgICAgIGNhc2UgMjpcbiAgICAgICAgICBzZWNvbmRCeXRlID0gYnVmW2kgKyAxXVxuICAgICAgICAgIGlmICgoc2Vjb25kQnl0ZSAmIDB4QzApID09PSAweDgwKSB7XG4gICAgICAgICAgICB0ZW1wQ29kZVBvaW50ID0gKGZpcnN0Qnl0ZSAmIDB4MUYpIDw8IDB4NiB8IChzZWNvbmRCeXRlICYgMHgzRilcbiAgICAgICAgICAgIGlmICh0ZW1wQ29kZVBvaW50ID4gMHg3Rikge1xuICAgICAgICAgICAgICBjb2RlUG9pbnQgPSB0ZW1wQ29kZVBvaW50XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrXG4gICAgICAgIGNhc2UgMzpcbiAgICAgICAgICBzZWNvbmRCeXRlID0gYnVmW2kgKyAxXVxuICAgICAgICAgIHRoaXJkQnl0ZSA9IGJ1ZltpICsgMl1cbiAgICAgICAgICBpZiAoKHNlY29uZEJ5dGUgJiAweEMwKSA9PT0gMHg4MCAmJiAodGhpcmRCeXRlICYgMHhDMCkgPT09IDB4ODApIHtcbiAgICAgICAgICAgIHRlbXBDb2RlUG9pbnQgPSAoZmlyc3RCeXRlICYgMHhGKSA8PCAweEMgfCAoc2Vjb25kQnl0ZSAmIDB4M0YpIDw8IDB4NiB8ICh0aGlyZEJ5dGUgJiAweDNGKVxuICAgICAgICAgICAgaWYgKHRlbXBDb2RlUG9pbnQgPiAweDdGRiAmJiAodGVtcENvZGVQb2ludCA8IDB4RDgwMCB8fCB0ZW1wQ29kZVBvaW50ID4gMHhERkZGKSkge1xuICAgICAgICAgICAgICBjb2RlUG9pbnQgPSB0ZW1wQ29kZVBvaW50XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrXG4gICAgICAgIGNhc2UgNDpcbiAgICAgICAgICBzZWNvbmRCeXRlID0gYnVmW2kgKyAxXVxuICAgICAgICAgIHRoaXJkQnl0ZSA9IGJ1ZltpICsgMl1cbiAgICAgICAgICBmb3VydGhCeXRlID0gYnVmW2kgKyAzXVxuICAgICAgICAgIGlmICgoc2Vjb25kQnl0ZSAmIDB4QzApID09PSAweDgwICYmICh0aGlyZEJ5dGUgJiAweEMwKSA9PT0gMHg4MCAmJiAoZm91cnRoQnl0ZSAmIDB4QzApID09PSAweDgwKSB7XG4gICAgICAgICAgICB0ZW1wQ29kZVBvaW50ID0gKGZpcnN0Qnl0ZSAmIDB4RikgPDwgMHgxMiB8IChzZWNvbmRCeXRlICYgMHgzRikgPDwgMHhDIHwgKHRoaXJkQnl0ZSAmIDB4M0YpIDw8IDB4NiB8IChmb3VydGhCeXRlICYgMHgzRilcbiAgICAgICAgICAgIGlmICh0ZW1wQ29kZVBvaW50ID4gMHhGRkZGICYmIHRlbXBDb2RlUG9pbnQgPCAweDExMDAwMCkge1xuICAgICAgICAgICAgICBjb2RlUG9pbnQgPSB0ZW1wQ29kZVBvaW50XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChjb2RlUG9pbnQgPT09IG51bGwpIHtcbiAgICAgIC8vIHdlIGRpZCBub3QgZ2VuZXJhdGUgYSB2YWxpZCBjb2RlUG9pbnQgc28gaW5zZXJ0IGFcbiAgICAgIC8vIHJlcGxhY2VtZW50IGNoYXIgKFUrRkZGRCkgYW5kIGFkdmFuY2Ugb25seSAxIGJ5dGVcbiAgICAgIGNvZGVQb2ludCA9IDB4RkZGRFxuICAgICAgYnl0ZXNQZXJTZXF1ZW5jZSA9IDFcbiAgICB9IGVsc2UgaWYgKGNvZGVQb2ludCA+IDB4RkZGRikge1xuICAgICAgLy8gZW5jb2RlIHRvIHV0ZjE2IChzdXJyb2dhdGUgcGFpciBkYW5jZSlcbiAgICAgIGNvZGVQb2ludCAtPSAweDEwMDAwXG4gICAgICByZXMucHVzaChjb2RlUG9pbnQgPj4+IDEwICYgMHgzRkYgfCAweEQ4MDApXG4gICAgICBjb2RlUG9pbnQgPSAweERDMDAgfCBjb2RlUG9pbnQgJiAweDNGRlxuICAgIH1cblxuICAgIHJlcy5wdXNoKGNvZGVQb2ludClcbiAgICBpICs9IGJ5dGVzUGVyU2VxdWVuY2VcbiAgfVxuXG4gIHJldHVybiBkZWNvZGVDb2RlUG9pbnRzQXJyYXkocmVzKVxufVxuXG4vLyBCYXNlZCBvbiBodHRwOi8vc3RhY2tvdmVyZmxvdy5jb20vYS8yMjc0NzI3Mi82ODA3NDIsIHRoZSBicm93c2VyIHdpdGhcbi8vIHRoZSBsb3dlc3QgbGltaXQgaXMgQ2hyb21lLCB3aXRoIDB4MTAwMDAgYXJncy5cbi8vIFdlIGdvIDEgbWFnbml0dWRlIGxlc3MsIGZvciBzYWZldHlcbnZhciBNQVhfQVJHVU1FTlRTX0xFTkdUSCA9IDB4MTAwMFxuXG5mdW5jdGlvbiBkZWNvZGVDb2RlUG9pbnRzQXJyYXkgKGNvZGVQb2ludHMpIHtcbiAgdmFyIGxlbiA9IGNvZGVQb2ludHMubGVuZ3RoXG4gIGlmIChsZW4gPD0gTUFYX0FSR1VNRU5UU19MRU5HVEgpIHtcbiAgICByZXR1cm4gU3RyaW5nLmZyb21DaGFyQ29kZS5hcHBseShTdHJpbmcsIGNvZGVQb2ludHMpIC8vIGF2b2lkIGV4dHJhIHNsaWNlKClcbiAgfVxuXG4gIC8vIERlY29kZSBpbiBjaHVua3MgdG8gYXZvaWQgXCJjYWxsIHN0YWNrIHNpemUgZXhjZWVkZWRcIi5cbiAgdmFyIHJlcyA9ICcnXG4gIHZhciBpID0gMFxuICB3aGlsZSAoaSA8IGxlbikge1xuICAgIHJlcyArPSBTdHJpbmcuZnJvbUNoYXJDb2RlLmFwcGx5KFxuICAgICAgU3RyaW5nLFxuICAgICAgY29kZVBvaW50cy5zbGljZShpLCBpICs9IE1BWF9BUkdVTUVOVFNfTEVOR1RIKVxuICAgIClcbiAgfVxuICByZXR1cm4gcmVzXG59XG5cbmZ1bmN0aW9uIGFzY2lpU2xpY2UgKGJ1Ziwgc3RhcnQsIGVuZCkge1xuICB2YXIgcmV0ID0gJydcbiAgZW5kID0gTWF0aC5taW4oYnVmLmxlbmd0aCwgZW5kKVxuXG4gIGZvciAodmFyIGkgPSBzdGFydDsgaSA8IGVuZDsgaSsrKSB7XG4gICAgcmV0ICs9IFN0cmluZy5mcm9tQ2hhckNvZGUoYnVmW2ldICYgMHg3RilcbiAgfVxuICByZXR1cm4gcmV0XG59XG5cbmZ1bmN0aW9uIGJpbmFyeVNsaWNlIChidWYsIHN0YXJ0LCBlbmQpIHtcbiAgdmFyIHJldCA9ICcnXG4gIGVuZCA9IE1hdGgubWluKGJ1Zi5sZW5ndGgsIGVuZClcblxuICBmb3IgKHZhciBpID0gc3RhcnQ7IGkgPCBlbmQ7IGkrKykge1xuICAgIHJldCArPSBTdHJpbmcuZnJvbUNoYXJDb2RlKGJ1ZltpXSlcbiAgfVxuICByZXR1cm4gcmV0XG59XG5cbmZ1bmN0aW9uIGhleFNsaWNlIChidWYsIHN0YXJ0LCBlbmQpIHtcbiAgdmFyIGxlbiA9IGJ1Zi5sZW5ndGhcblxuICBpZiAoIXN0YXJ0IHx8IHN0YXJ0IDwgMCkgc3RhcnQgPSAwXG4gIGlmICghZW5kIHx8IGVuZCA8IDAgfHwgZW5kID4gbGVuKSBlbmQgPSBsZW5cblxuICB2YXIgb3V0ID0gJydcbiAgZm9yICh2YXIgaSA9IHN0YXJ0OyBpIDwgZW5kOyBpKyspIHtcbiAgICBvdXQgKz0gdG9IZXgoYnVmW2ldKVxuICB9XG4gIHJldHVybiBvdXRcbn1cblxuZnVuY3Rpb24gdXRmMTZsZVNsaWNlIChidWYsIHN0YXJ0LCBlbmQpIHtcbiAgdmFyIGJ5dGVzID0gYnVmLnNsaWNlKHN0YXJ0LCBlbmQpXG4gIHZhciByZXMgPSAnJ1xuICBmb3IgKHZhciBpID0gMDsgaSA8IGJ5dGVzLmxlbmd0aDsgaSArPSAyKSB7XG4gICAgcmVzICs9IFN0cmluZy5mcm9tQ2hhckNvZGUoYnl0ZXNbaV0gKyBieXRlc1tpICsgMV0gKiAyNTYpXG4gIH1cbiAgcmV0dXJuIHJlc1xufVxuXG5CdWZmZXIucHJvdG90eXBlLnNsaWNlID0gZnVuY3Rpb24gc2xpY2UgKHN0YXJ0LCBlbmQpIHtcbiAgdmFyIGxlbiA9IHRoaXMubGVuZ3RoXG4gIHN0YXJ0ID0gfn5zdGFydFxuICBlbmQgPSBlbmQgPT09IHVuZGVmaW5lZCA/IGxlbiA6IH5+ZW5kXG5cbiAgaWYgKHN0YXJ0IDwgMCkge1xuICAgIHN0YXJ0ICs9IGxlblxuICAgIGlmIChzdGFydCA8IDApIHN0YXJ0ID0gMFxuICB9IGVsc2UgaWYgKHN0YXJ0ID4gbGVuKSB7XG4gICAgc3RhcnQgPSBsZW5cbiAgfVxuXG4gIGlmIChlbmQgPCAwKSB7XG4gICAgZW5kICs9IGxlblxuICAgIGlmIChlbmQgPCAwKSBlbmQgPSAwXG4gIH0gZWxzZSBpZiAoZW5kID4gbGVuKSB7XG4gICAgZW5kID0gbGVuXG4gIH1cblxuICBpZiAoZW5kIDwgc3RhcnQpIGVuZCA9IHN0YXJ0XG5cbiAgdmFyIG5ld0J1ZlxuICBpZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICBuZXdCdWYgPSB0aGlzLnN1YmFycmF5KHN0YXJ0LCBlbmQpXG4gICAgbmV3QnVmLl9fcHJvdG9fXyA9IEJ1ZmZlci5wcm90b3R5cGVcbiAgfSBlbHNlIHtcbiAgICB2YXIgc2xpY2VMZW4gPSBlbmQgLSBzdGFydFxuICAgIG5ld0J1ZiA9IG5ldyBCdWZmZXIoc2xpY2VMZW4sIHVuZGVmaW5lZClcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHNsaWNlTGVuOyBpKyspIHtcbiAgICAgIG5ld0J1ZltpXSA9IHRoaXNbaSArIHN0YXJ0XVxuICAgIH1cbiAgfVxuXG4gIGlmIChuZXdCdWYubGVuZ3RoKSBuZXdCdWYucGFyZW50ID0gdGhpcy5wYXJlbnQgfHwgdGhpc1xuXG4gIHJldHVybiBuZXdCdWZcbn1cblxuLypcbiAqIE5lZWQgdG8gbWFrZSBzdXJlIHRoYXQgYnVmZmVyIGlzbid0IHRyeWluZyB0byB3cml0ZSBvdXQgb2YgYm91bmRzLlxuICovXG5mdW5jdGlvbiBjaGVja09mZnNldCAob2Zmc2V0LCBleHQsIGxlbmd0aCkge1xuICBpZiAoKG9mZnNldCAlIDEpICE9PSAwIHx8IG9mZnNldCA8IDApIHRocm93IG5ldyBSYW5nZUVycm9yKCdvZmZzZXQgaXMgbm90IHVpbnQnKVxuICBpZiAob2Zmc2V0ICsgZXh0ID4gbGVuZ3RoKSB0aHJvdyBuZXcgUmFuZ2VFcnJvcignVHJ5aW5nIHRvIGFjY2VzcyBiZXlvbmQgYnVmZmVyIGxlbmd0aCcpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZFVJbnRMRSA9IGZ1bmN0aW9uIHJlYWRVSW50TEUgKG9mZnNldCwgYnl0ZUxlbmd0aCwgbm9Bc3NlcnQpIHtcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBieXRlTGVuZ3RoID0gYnl0ZUxlbmd0aCB8IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCBieXRlTGVuZ3RoLCB0aGlzLmxlbmd0aClcblxuICB2YXIgdmFsID0gdGhpc1tvZmZzZXRdXG4gIHZhciBtdWwgPSAxXG4gIHZhciBpID0gMFxuICB3aGlsZSAoKytpIDwgYnl0ZUxlbmd0aCAmJiAobXVsICo9IDB4MTAwKSkge1xuICAgIHZhbCArPSB0aGlzW29mZnNldCArIGldICogbXVsXG4gIH1cblxuICByZXR1cm4gdmFsXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZFVJbnRCRSA9IGZ1bmN0aW9uIHJlYWRVSW50QkUgKG9mZnNldCwgYnl0ZUxlbmd0aCwgbm9Bc3NlcnQpIHtcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBieXRlTGVuZ3RoID0gYnl0ZUxlbmd0aCB8IDBcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIGNoZWNrT2Zmc2V0KG9mZnNldCwgYnl0ZUxlbmd0aCwgdGhpcy5sZW5ndGgpXG4gIH1cblxuICB2YXIgdmFsID0gdGhpc1tvZmZzZXQgKyAtLWJ5dGVMZW5ndGhdXG4gIHZhciBtdWwgPSAxXG4gIHdoaWxlIChieXRlTGVuZ3RoID4gMCAmJiAobXVsICo9IDB4MTAwKSkge1xuICAgIHZhbCArPSB0aGlzW29mZnNldCArIC0tYnl0ZUxlbmd0aF0gKiBtdWxcbiAgfVxuXG4gIHJldHVybiB2YWxcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkVUludDggPSBmdW5jdGlvbiByZWFkVUludDggKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCAxLCB0aGlzLmxlbmd0aClcbiAgcmV0dXJuIHRoaXNbb2Zmc2V0XVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRVSW50MTZMRSA9IGZ1bmN0aW9uIHJlYWRVSW50MTZMRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDIsIHRoaXMubGVuZ3RoKVxuICByZXR1cm4gdGhpc1tvZmZzZXRdIHwgKHRoaXNbb2Zmc2V0ICsgMV0gPDwgOClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkVUludDE2QkUgPSBmdW5jdGlvbiByZWFkVUludDE2QkUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCAyLCB0aGlzLmxlbmd0aClcbiAgcmV0dXJuICh0aGlzW29mZnNldF0gPDwgOCkgfCB0aGlzW29mZnNldCArIDFdXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZFVJbnQzMkxFID0gZnVuY3Rpb24gcmVhZFVJbnQzMkxFIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgNCwgdGhpcy5sZW5ndGgpXG5cbiAgcmV0dXJuICgodGhpc1tvZmZzZXRdKSB8XG4gICAgICAodGhpc1tvZmZzZXQgKyAxXSA8PCA4KSB8XG4gICAgICAodGhpc1tvZmZzZXQgKyAyXSA8PCAxNikpICtcbiAgICAgICh0aGlzW29mZnNldCArIDNdICogMHgxMDAwMDAwKVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRVSW50MzJCRSA9IGZ1bmN0aW9uIHJlYWRVSW50MzJCRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDQsIHRoaXMubGVuZ3RoKVxuXG4gIHJldHVybiAodGhpc1tvZmZzZXRdICogMHgxMDAwMDAwKSArXG4gICAgKCh0aGlzW29mZnNldCArIDFdIDw8IDE2KSB8XG4gICAgKHRoaXNbb2Zmc2V0ICsgMl0gPDwgOCkgfFxuICAgIHRoaXNbb2Zmc2V0ICsgM10pXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEludExFID0gZnVuY3Rpb24gcmVhZEludExFIChvZmZzZXQsIGJ5dGVMZW5ndGgsIG5vQXNzZXJ0KSB7XG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgYnl0ZUxlbmd0aCA9IGJ5dGVMZW5ndGggfCAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgYnl0ZUxlbmd0aCwgdGhpcy5sZW5ndGgpXG5cbiAgdmFyIHZhbCA9IHRoaXNbb2Zmc2V0XVxuICB2YXIgbXVsID0gMVxuICB2YXIgaSA9IDBcbiAgd2hpbGUgKCsraSA8IGJ5dGVMZW5ndGggJiYgKG11bCAqPSAweDEwMCkpIHtcbiAgICB2YWwgKz0gdGhpc1tvZmZzZXQgKyBpXSAqIG11bFxuICB9XG4gIG11bCAqPSAweDgwXG5cbiAgaWYgKHZhbCA+PSBtdWwpIHZhbCAtPSBNYXRoLnBvdygyLCA4ICogYnl0ZUxlbmd0aClcblxuICByZXR1cm4gdmFsXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEludEJFID0gZnVuY3Rpb24gcmVhZEludEJFIChvZmZzZXQsIGJ5dGVMZW5ndGgsIG5vQXNzZXJ0KSB7XG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgYnl0ZUxlbmd0aCA9IGJ5dGVMZW5ndGggfCAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgYnl0ZUxlbmd0aCwgdGhpcy5sZW5ndGgpXG5cbiAgdmFyIGkgPSBieXRlTGVuZ3RoXG4gIHZhciBtdWwgPSAxXG4gIHZhciB2YWwgPSB0aGlzW29mZnNldCArIC0taV1cbiAgd2hpbGUgKGkgPiAwICYmIChtdWwgKj0gMHgxMDApKSB7XG4gICAgdmFsICs9IHRoaXNbb2Zmc2V0ICsgLS1pXSAqIG11bFxuICB9XG4gIG11bCAqPSAweDgwXG5cbiAgaWYgKHZhbCA+PSBtdWwpIHZhbCAtPSBNYXRoLnBvdygyLCA4ICogYnl0ZUxlbmd0aClcblxuICByZXR1cm4gdmFsXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEludDggPSBmdW5jdGlvbiByZWFkSW50OCAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDEsIHRoaXMubGVuZ3RoKVxuICBpZiAoISh0aGlzW29mZnNldF0gJiAweDgwKSkgcmV0dXJuICh0aGlzW29mZnNldF0pXG4gIHJldHVybiAoKDB4ZmYgLSB0aGlzW29mZnNldF0gKyAxKSAqIC0xKVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRJbnQxNkxFID0gZnVuY3Rpb24gcmVhZEludDE2TEUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCAyLCB0aGlzLmxlbmd0aClcbiAgdmFyIHZhbCA9IHRoaXNbb2Zmc2V0XSB8ICh0aGlzW29mZnNldCArIDFdIDw8IDgpXG4gIHJldHVybiAodmFsICYgMHg4MDAwKSA/IHZhbCB8IDB4RkZGRjAwMDAgOiB2YWxcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkSW50MTZCRSA9IGZ1bmN0aW9uIHJlYWRJbnQxNkJFIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgMiwgdGhpcy5sZW5ndGgpXG4gIHZhciB2YWwgPSB0aGlzW29mZnNldCArIDFdIHwgKHRoaXNbb2Zmc2V0XSA8PCA4KVxuICByZXR1cm4gKHZhbCAmIDB4ODAwMCkgPyB2YWwgfCAweEZGRkYwMDAwIDogdmFsXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEludDMyTEUgPSBmdW5jdGlvbiByZWFkSW50MzJMRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDQsIHRoaXMubGVuZ3RoKVxuXG4gIHJldHVybiAodGhpc1tvZmZzZXRdKSB8XG4gICAgKHRoaXNbb2Zmc2V0ICsgMV0gPDwgOCkgfFxuICAgICh0aGlzW29mZnNldCArIDJdIDw8IDE2KSB8XG4gICAgKHRoaXNbb2Zmc2V0ICsgM10gPDwgMjQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEludDMyQkUgPSBmdW5jdGlvbiByZWFkSW50MzJCRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDQsIHRoaXMubGVuZ3RoKVxuXG4gIHJldHVybiAodGhpc1tvZmZzZXRdIDw8IDI0KSB8XG4gICAgKHRoaXNbb2Zmc2V0ICsgMV0gPDwgMTYpIHxcbiAgICAodGhpc1tvZmZzZXQgKyAyXSA8PCA4KSB8XG4gICAgKHRoaXNbb2Zmc2V0ICsgM10pXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEZsb2F0TEUgPSBmdW5jdGlvbiByZWFkRmxvYXRMRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDQsIHRoaXMubGVuZ3RoKVxuICByZXR1cm4gaWVlZTc1NC5yZWFkKHRoaXMsIG9mZnNldCwgdHJ1ZSwgMjMsIDQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEZsb2F0QkUgPSBmdW5jdGlvbiByZWFkRmxvYXRCRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDQsIHRoaXMubGVuZ3RoKVxuICByZXR1cm4gaWVlZTc1NC5yZWFkKHRoaXMsIG9mZnNldCwgZmFsc2UsIDIzLCA0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWREb3VibGVMRSA9IGZ1bmN0aW9uIHJlYWREb3VibGVMRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDgsIHRoaXMubGVuZ3RoKVxuICByZXR1cm4gaWVlZTc1NC5yZWFkKHRoaXMsIG9mZnNldCwgdHJ1ZSwgNTIsIDgpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZERvdWJsZUJFID0gZnVuY3Rpb24gcmVhZERvdWJsZUJFIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgOCwgdGhpcy5sZW5ndGgpXG4gIHJldHVybiBpZWVlNzU0LnJlYWQodGhpcywgb2Zmc2V0LCBmYWxzZSwgNTIsIDgpXG59XG5cbmZ1bmN0aW9uIGNoZWNrSW50IChidWYsIHZhbHVlLCBvZmZzZXQsIGV4dCwgbWF4LCBtaW4pIHtcbiAgaWYgKCFCdWZmZXIuaXNCdWZmZXIoYnVmKSkgdGhyb3cgbmV3IFR5cGVFcnJvcignYnVmZmVyIG11c3QgYmUgYSBCdWZmZXIgaW5zdGFuY2UnKVxuICBpZiAodmFsdWUgPiBtYXggfHwgdmFsdWUgPCBtaW4pIHRocm93IG5ldyBSYW5nZUVycm9yKCd2YWx1ZSBpcyBvdXQgb2YgYm91bmRzJylcbiAgaWYgKG9mZnNldCArIGV4dCA+IGJ1Zi5sZW5ndGgpIHRocm93IG5ldyBSYW5nZUVycm9yKCdpbmRleCBvdXQgb2YgcmFuZ2UnKVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlVUludExFID0gZnVuY3Rpb24gd3JpdGVVSW50TEUgKHZhbHVlLCBvZmZzZXQsIGJ5dGVMZW5ndGgsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgYnl0ZUxlbmd0aCA9IGJ5dGVMZW5ndGggfCAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIGJ5dGVMZW5ndGgsIE1hdGgucG93KDIsIDggKiBieXRlTGVuZ3RoKSwgMClcblxuICB2YXIgbXVsID0gMVxuICB2YXIgaSA9IDBcbiAgdGhpc1tvZmZzZXRdID0gdmFsdWUgJiAweEZGXG4gIHdoaWxlICgrK2kgPCBieXRlTGVuZ3RoICYmIChtdWwgKj0gMHgxMDApKSB7XG4gICAgdGhpc1tvZmZzZXQgKyBpXSA9ICh2YWx1ZSAvIG11bCkgJiAweEZGXG4gIH1cblxuICByZXR1cm4gb2Zmc2V0ICsgYnl0ZUxlbmd0aFxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlVUludEJFID0gZnVuY3Rpb24gd3JpdGVVSW50QkUgKHZhbHVlLCBvZmZzZXQsIGJ5dGVMZW5ndGgsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgYnl0ZUxlbmd0aCA9IGJ5dGVMZW5ndGggfCAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIGJ5dGVMZW5ndGgsIE1hdGgucG93KDIsIDggKiBieXRlTGVuZ3RoKSwgMClcblxuICB2YXIgaSA9IGJ5dGVMZW5ndGggLSAxXG4gIHZhciBtdWwgPSAxXG4gIHRoaXNbb2Zmc2V0ICsgaV0gPSB2YWx1ZSAmIDB4RkZcbiAgd2hpbGUgKC0taSA+PSAwICYmIChtdWwgKj0gMHgxMDApKSB7XG4gICAgdGhpc1tvZmZzZXQgKyBpXSA9ICh2YWx1ZSAvIG11bCkgJiAweEZGXG4gIH1cblxuICByZXR1cm4gb2Zmc2V0ICsgYnl0ZUxlbmd0aFxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlVUludDggPSBmdW5jdGlvbiB3cml0ZVVJbnQ4ICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIDEsIDB4ZmYsIDApXG4gIGlmICghQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHZhbHVlID0gTWF0aC5mbG9vcih2YWx1ZSlcbiAgdGhpc1tvZmZzZXRdID0gKHZhbHVlICYgMHhmZilcbiAgcmV0dXJuIG9mZnNldCArIDFcbn1cblxuZnVuY3Rpb24gb2JqZWN0V3JpdGVVSW50MTYgKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuKSB7XG4gIGlmICh2YWx1ZSA8IDApIHZhbHVlID0gMHhmZmZmICsgdmFsdWUgKyAxXG4gIGZvciAodmFyIGkgPSAwLCBqID0gTWF0aC5taW4oYnVmLmxlbmd0aCAtIG9mZnNldCwgMik7IGkgPCBqOyBpKyspIHtcbiAgICBidWZbb2Zmc2V0ICsgaV0gPSAodmFsdWUgJiAoMHhmZiA8PCAoOCAqIChsaXR0bGVFbmRpYW4gPyBpIDogMSAtIGkpKSkpID4+PlxuICAgICAgKGxpdHRsZUVuZGlhbiA/IGkgOiAxIC0gaSkgKiA4XG4gIH1cbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZVVJbnQxNkxFID0gZnVuY3Rpb24gd3JpdGVVSW50MTZMRSAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCAyLCAweGZmZmYsIDApXG4gIGlmIChCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkge1xuICAgIHRoaXNbb2Zmc2V0XSA9ICh2YWx1ZSAmIDB4ZmYpXG4gICAgdGhpc1tvZmZzZXQgKyAxXSA9ICh2YWx1ZSA+Pj4gOClcbiAgfSBlbHNlIHtcbiAgICBvYmplY3RXcml0ZVVJbnQxNih0aGlzLCB2YWx1ZSwgb2Zmc2V0LCB0cnVlKVxuICB9XG4gIHJldHVybiBvZmZzZXQgKyAyXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVVSW50MTZCRSA9IGZ1bmN0aW9uIHdyaXRlVUludDE2QkUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgMiwgMHhmZmZmLCAwKVxuICBpZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICB0aGlzW29mZnNldF0gPSAodmFsdWUgPj4+IDgpXG4gICAgdGhpc1tvZmZzZXQgKyAxXSA9ICh2YWx1ZSAmIDB4ZmYpXG4gIH0gZWxzZSB7XG4gICAgb2JqZWN0V3JpdGVVSW50MTYodGhpcywgdmFsdWUsIG9mZnNldCwgZmFsc2UpXG4gIH1cbiAgcmV0dXJuIG9mZnNldCArIDJcbn1cblxuZnVuY3Rpb24gb2JqZWN0V3JpdGVVSW50MzIgKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuKSB7XG4gIGlmICh2YWx1ZSA8IDApIHZhbHVlID0gMHhmZmZmZmZmZiArIHZhbHVlICsgMVxuICBmb3IgKHZhciBpID0gMCwgaiA9IE1hdGgubWluKGJ1Zi5sZW5ndGggLSBvZmZzZXQsIDQpOyBpIDwgajsgaSsrKSB7XG4gICAgYnVmW29mZnNldCArIGldID0gKHZhbHVlID4+PiAobGl0dGxlRW5kaWFuID8gaSA6IDMgLSBpKSAqIDgpICYgMHhmZlxuICB9XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVVSW50MzJMRSA9IGZ1bmN0aW9uIHdyaXRlVUludDMyTEUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgNCwgMHhmZmZmZmZmZiwgMClcbiAgaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgdGhpc1tvZmZzZXQgKyAzXSA9ICh2YWx1ZSA+Pj4gMjQpXG4gICAgdGhpc1tvZmZzZXQgKyAyXSA9ICh2YWx1ZSA+Pj4gMTYpXG4gICAgdGhpc1tvZmZzZXQgKyAxXSA9ICh2YWx1ZSA+Pj4gOClcbiAgICB0aGlzW29mZnNldF0gPSAodmFsdWUgJiAweGZmKVxuICB9IGVsc2Uge1xuICAgIG9iamVjdFdyaXRlVUludDMyKHRoaXMsIHZhbHVlLCBvZmZzZXQsIHRydWUpXG4gIH1cbiAgcmV0dXJuIG9mZnNldCArIDRcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZVVJbnQzMkJFID0gZnVuY3Rpb24gd3JpdGVVSW50MzJCRSAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCA0LCAweGZmZmZmZmZmLCAwKVxuICBpZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICB0aGlzW29mZnNldF0gPSAodmFsdWUgPj4+IDI0KVxuICAgIHRoaXNbb2Zmc2V0ICsgMV0gPSAodmFsdWUgPj4+IDE2KVxuICAgIHRoaXNbb2Zmc2V0ICsgMl0gPSAodmFsdWUgPj4+IDgpXG4gICAgdGhpc1tvZmZzZXQgKyAzXSA9ICh2YWx1ZSAmIDB4ZmYpXG4gIH0gZWxzZSB7XG4gICAgb2JqZWN0V3JpdGVVSW50MzIodGhpcywgdmFsdWUsIG9mZnNldCwgZmFsc2UpXG4gIH1cbiAgcmV0dXJuIG9mZnNldCArIDRcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUludExFID0gZnVuY3Rpb24gd3JpdGVJbnRMRSAodmFsdWUsIG9mZnNldCwgYnl0ZUxlbmd0aCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgdmFyIGxpbWl0ID0gTWF0aC5wb3coMiwgOCAqIGJ5dGVMZW5ndGggLSAxKVxuXG4gICAgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgYnl0ZUxlbmd0aCwgbGltaXQgLSAxLCAtbGltaXQpXG4gIH1cblxuICB2YXIgaSA9IDBcbiAgdmFyIG11bCA9IDFcbiAgdmFyIHN1YiA9IHZhbHVlIDwgMCA/IDEgOiAwXG4gIHRoaXNbb2Zmc2V0XSA9IHZhbHVlICYgMHhGRlxuICB3aGlsZSAoKytpIDwgYnl0ZUxlbmd0aCAmJiAobXVsICo9IDB4MTAwKSkge1xuICAgIHRoaXNbb2Zmc2V0ICsgaV0gPSAoKHZhbHVlIC8gbXVsKSA+PiAwKSAtIHN1YiAmIDB4RkZcbiAgfVxuXG4gIHJldHVybiBvZmZzZXQgKyBieXRlTGVuZ3RoXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVJbnRCRSA9IGZ1bmN0aW9uIHdyaXRlSW50QkUgKHZhbHVlLCBvZmZzZXQsIGJ5dGVMZW5ndGgsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIHZhciBsaW1pdCA9IE1hdGgucG93KDIsIDggKiBieXRlTGVuZ3RoIC0gMSlcblxuICAgIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIGJ5dGVMZW5ndGgsIGxpbWl0IC0gMSwgLWxpbWl0KVxuICB9XG5cbiAgdmFyIGkgPSBieXRlTGVuZ3RoIC0gMVxuICB2YXIgbXVsID0gMVxuICB2YXIgc3ViID0gdmFsdWUgPCAwID8gMSA6IDBcbiAgdGhpc1tvZmZzZXQgKyBpXSA9IHZhbHVlICYgMHhGRlxuICB3aGlsZSAoLS1pID49IDAgJiYgKG11bCAqPSAweDEwMCkpIHtcbiAgICB0aGlzW29mZnNldCArIGldID0gKCh2YWx1ZSAvIG11bCkgPj4gMCkgLSBzdWIgJiAweEZGXG4gIH1cblxuICByZXR1cm4gb2Zmc2V0ICsgYnl0ZUxlbmd0aFxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlSW50OCA9IGZ1bmN0aW9uIHdyaXRlSW50OCAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCAxLCAweDdmLCAtMHg4MClcbiAgaWYgKCFCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkgdmFsdWUgPSBNYXRoLmZsb29yKHZhbHVlKVxuICBpZiAodmFsdWUgPCAwKSB2YWx1ZSA9IDB4ZmYgKyB2YWx1ZSArIDFcbiAgdGhpc1tvZmZzZXRdID0gKHZhbHVlICYgMHhmZilcbiAgcmV0dXJuIG9mZnNldCArIDFcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUludDE2TEUgPSBmdW5jdGlvbiB3cml0ZUludDE2TEUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgMiwgMHg3ZmZmLCAtMHg4MDAwKVxuICBpZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICB0aGlzW29mZnNldF0gPSAodmFsdWUgJiAweGZmKVxuICAgIHRoaXNbb2Zmc2V0ICsgMV0gPSAodmFsdWUgPj4+IDgpXG4gIH0gZWxzZSB7XG4gICAgb2JqZWN0V3JpdGVVSW50MTYodGhpcywgdmFsdWUsIG9mZnNldCwgdHJ1ZSlcbiAgfVxuICByZXR1cm4gb2Zmc2V0ICsgMlxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlSW50MTZCRSA9IGZ1bmN0aW9uIHdyaXRlSW50MTZCRSAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCAyLCAweDdmZmYsIC0weDgwMDApXG4gIGlmIChCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkge1xuICAgIHRoaXNbb2Zmc2V0XSA9ICh2YWx1ZSA+Pj4gOClcbiAgICB0aGlzW29mZnNldCArIDFdID0gKHZhbHVlICYgMHhmZilcbiAgfSBlbHNlIHtcbiAgICBvYmplY3RXcml0ZVVJbnQxNih0aGlzLCB2YWx1ZSwgb2Zmc2V0LCBmYWxzZSlcbiAgfVxuICByZXR1cm4gb2Zmc2V0ICsgMlxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlSW50MzJMRSA9IGZ1bmN0aW9uIHdyaXRlSW50MzJMRSAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCA0LCAweDdmZmZmZmZmLCAtMHg4MDAwMDAwMClcbiAgaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgdGhpc1tvZmZzZXRdID0gKHZhbHVlICYgMHhmZilcbiAgICB0aGlzW29mZnNldCArIDFdID0gKHZhbHVlID4+PiA4KVxuICAgIHRoaXNbb2Zmc2V0ICsgMl0gPSAodmFsdWUgPj4+IDE2KVxuICAgIHRoaXNbb2Zmc2V0ICsgM10gPSAodmFsdWUgPj4+IDI0KVxuICB9IGVsc2Uge1xuICAgIG9iamVjdFdyaXRlVUludDMyKHRoaXMsIHZhbHVlLCBvZmZzZXQsIHRydWUpXG4gIH1cbiAgcmV0dXJuIG9mZnNldCArIDRcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUludDMyQkUgPSBmdW5jdGlvbiB3cml0ZUludDMyQkUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgNCwgMHg3ZmZmZmZmZiwgLTB4ODAwMDAwMDApXG4gIGlmICh2YWx1ZSA8IDApIHZhbHVlID0gMHhmZmZmZmZmZiArIHZhbHVlICsgMVxuICBpZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICB0aGlzW29mZnNldF0gPSAodmFsdWUgPj4+IDI0KVxuICAgIHRoaXNbb2Zmc2V0ICsgMV0gPSAodmFsdWUgPj4+IDE2KVxuICAgIHRoaXNbb2Zmc2V0ICsgMl0gPSAodmFsdWUgPj4+IDgpXG4gICAgdGhpc1tvZmZzZXQgKyAzXSA9ICh2YWx1ZSAmIDB4ZmYpXG4gIH0gZWxzZSB7XG4gICAgb2JqZWN0V3JpdGVVSW50MzIodGhpcywgdmFsdWUsIG9mZnNldCwgZmFsc2UpXG4gIH1cbiAgcmV0dXJuIG9mZnNldCArIDRcbn1cblxuZnVuY3Rpb24gY2hlY2tJRUVFNzU0IChidWYsIHZhbHVlLCBvZmZzZXQsIGV4dCwgbWF4LCBtaW4pIHtcbiAgaWYgKG9mZnNldCArIGV4dCA+IGJ1Zi5sZW5ndGgpIHRocm93IG5ldyBSYW5nZUVycm9yKCdpbmRleCBvdXQgb2YgcmFuZ2UnKVxuICBpZiAob2Zmc2V0IDwgMCkgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ2luZGV4IG91dCBvZiByYW5nZScpXG59XG5cbmZ1bmN0aW9uIHdyaXRlRmxvYXQgKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgY2hlY2tJRUVFNzU0KGJ1ZiwgdmFsdWUsIG9mZnNldCwgNCwgMy40MDI4MjM0NjYzODUyODg2ZSszOCwgLTMuNDAyODIzNDY2Mzg1Mjg4NmUrMzgpXG4gIH1cbiAgaWVlZTc1NC53cml0ZShidWYsIHZhbHVlLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgMjMsIDQpXG4gIHJldHVybiBvZmZzZXQgKyA0XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVGbG9hdExFID0gZnVuY3Rpb24gd3JpdGVGbG9hdExFICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gd3JpdGVGbG9hdCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCB0cnVlLCBub0Fzc2VydClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUZsb2F0QkUgPSBmdW5jdGlvbiB3cml0ZUZsb2F0QkUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiB3cml0ZUZsb2F0KHRoaXMsIHZhbHVlLCBvZmZzZXQsIGZhbHNlLCBub0Fzc2VydClcbn1cblxuZnVuY3Rpb24gd3JpdGVEb3VibGUgKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgY2hlY2tJRUVFNzU0KGJ1ZiwgdmFsdWUsIG9mZnNldCwgOCwgMS43OTc2OTMxMzQ4NjIzMTU3RSszMDgsIC0xLjc5NzY5MzEzNDg2MjMxNTdFKzMwOClcbiAgfVxuICBpZWVlNzU0LndyaXRlKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCA1MiwgOClcbiAgcmV0dXJuIG9mZnNldCArIDhcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZURvdWJsZUxFID0gZnVuY3Rpb24gd3JpdGVEb3VibGVMRSAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgcmV0dXJuIHdyaXRlRG91YmxlKHRoaXMsIHZhbHVlLCBvZmZzZXQsIHRydWUsIG5vQXNzZXJ0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlRG91YmxlQkUgPSBmdW5jdGlvbiB3cml0ZURvdWJsZUJFICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gd3JpdGVEb3VibGUodGhpcywgdmFsdWUsIG9mZnNldCwgZmFsc2UsIG5vQXNzZXJ0KVxufVxuXG4vLyBjb3B5KHRhcmdldEJ1ZmZlciwgdGFyZ2V0U3RhcnQ9MCwgc291cmNlU3RhcnQ9MCwgc291cmNlRW5kPWJ1ZmZlci5sZW5ndGgpXG5CdWZmZXIucHJvdG90eXBlLmNvcHkgPSBmdW5jdGlvbiBjb3B5ICh0YXJnZXQsIHRhcmdldFN0YXJ0LCBzdGFydCwgZW5kKSB7XG4gIGlmICghc3RhcnQpIHN0YXJ0ID0gMFxuICBpZiAoIWVuZCAmJiBlbmQgIT09IDApIGVuZCA9IHRoaXMubGVuZ3RoXG4gIGlmICh0YXJnZXRTdGFydCA+PSB0YXJnZXQubGVuZ3RoKSB0YXJnZXRTdGFydCA9IHRhcmdldC5sZW5ndGhcbiAgaWYgKCF0YXJnZXRTdGFydCkgdGFyZ2V0U3RhcnQgPSAwXG4gIGlmIChlbmQgPiAwICYmIGVuZCA8IHN0YXJ0KSBlbmQgPSBzdGFydFxuXG4gIC8vIENvcHkgMCBieXRlczsgd2UncmUgZG9uZVxuICBpZiAoZW5kID09PSBzdGFydCkgcmV0dXJuIDBcbiAgaWYgKHRhcmdldC5sZW5ndGggPT09IDAgfHwgdGhpcy5sZW5ndGggPT09IDApIHJldHVybiAwXG5cbiAgLy8gRmF0YWwgZXJyb3IgY29uZGl0aW9uc1xuICBpZiAodGFyZ2V0U3RhcnQgPCAwKSB7XG4gICAgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ3RhcmdldFN0YXJ0IG91dCBvZiBib3VuZHMnKVxuICB9XG4gIGlmIChzdGFydCA8IDAgfHwgc3RhcnQgPj0gdGhpcy5sZW5ndGgpIHRocm93IG5ldyBSYW5nZUVycm9yKCdzb3VyY2VTdGFydCBvdXQgb2YgYm91bmRzJylcbiAgaWYgKGVuZCA8IDApIHRocm93IG5ldyBSYW5nZUVycm9yKCdzb3VyY2VFbmQgb3V0IG9mIGJvdW5kcycpXG5cbiAgLy8gQXJlIHdlIG9vYj9cbiAgaWYgKGVuZCA+IHRoaXMubGVuZ3RoKSBlbmQgPSB0aGlzLmxlbmd0aFxuICBpZiAodGFyZ2V0Lmxlbmd0aCAtIHRhcmdldFN0YXJ0IDwgZW5kIC0gc3RhcnQpIHtcbiAgICBlbmQgPSB0YXJnZXQubGVuZ3RoIC0gdGFyZ2V0U3RhcnQgKyBzdGFydFxuICB9XG5cbiAgdmFyIGxlbiA9IGVuZCAtIHN0YXJ0XG4gIHZhciBpXG5cbiAgaWYgKHRoaXMgPT09IHRhcmdldCAmJiBzdGFydCA8IHRhcmdldFN0YXJ0ICYmIHRhcmdldFN0YXJ0IDwgZW5kKSB7XG4gICAgLy8gZGVzY2VuZGluZyBjb3B5IGZyb20gZW5kXG4gICAgZm9yIChpID0gbGVuIC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICAgIHRhcmdldFtpICsgdGFyZ2V0U3RhcnRdID0gdGhpc1tpICsgc3RhcnRdXG4gICAgfVxuICB9IGVsc2UgaWYgKGxlbiA8IDEwMDAgfHwgIUJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgLy8gYXNjZW5kaW5nIGNvcHkgZnJvbSBzdGFydFxuICAgIGZvciAoaSA9IDA7IGkgPCBsZW47IGkrKykge1xuICAgICAgdGFyZ2V0W2kgKyB0YXJnZXRTdGFydF0gPSB0aGlzW2kgKyBzdGFydF1cbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgVWludDhBcnJheS5wcm90b3R5cGUuc2V0LmNhbGwoXG4gICAgICB0YXJnZXQsXG4gICAgICB0aGlzLnN1YmFycmF5KHN0YXJ0LCBzdGFydCArIGxlbiksXG4gICAgICB0YXJnZXRTdGFydFxuICAgIClcbiAgfVxuXG4gIHJldHVybiBsZW5cbn1cblxuLy8gZmlsbCh2YWx1ZSwgc3RhcnQ9MCwgZW5kPWJ1ZmZlci5sZW5ndGgpXG5CdWZmZXIucHJvdG90eXBlLmZpbGwgPSBmdW5jdGlvbiBmaWxsICh2YWx1ZSwgc3RhcnQsIGVuZCkge1xuICBpZiAoIXZhbHVlKSB2YWx1ZSA9IDBcbiAgaWYgKCFzdGFydCkgc3RhcnQgPSAwXG4gIGlmICghZW5kKSBlbmQgPSB0aGlzLmxlbmd0aFxuXG4gIGlmIChlbmQgPCBzdGFydCkgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ2VuZCA8IHN0YXJ0JylcblxuICAvLyBGaWxsIDAgYnl0ZXM7IHdlJ3JlIGRvbmVcbiAgaWYgKGVuZCA9PT0gc3RhcnQpIHJldHVyblxuICBpZiAodGhpcy5sZW5ndGggPT09IDApIHJldHVyblxuXG4gIGlmIChzdGFydCA8IDAgfHwgc3RhcnQgPj0gdGhpcy5sZW5ndGgpIHRocm93IG5ldyBSYW5nZUVycm9yKCdzdGFydCBvdXQgb2YgYm91bmRzJylcbiAgaWYgKGVuZCA8IDAgfHwgZW5kID4gdGhpcy5sZW5ndGgpIHRocm93IG5ldyBSYW5nZUVycm9yKCdlbmQgb3V0IG9mIGJvdW5kcycpXG5cbiAgdmFyIGlcbiAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ251bWJlcicpIHtcbiAgICBmb3IgKGkgPSBzdGFydDsgaSA8IGVuZDsgaSsrKSB7XG4gICAgICB0aGlzW2ldID0gdmFsdWVcbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgdmFyIGJ5dGVzID0gdXRmOFRvQnl0ZXModmFsdWUudG9TdHJpbmcoKSlcbiAgICB2YXIgbGVuID0gYnl0ZXMubGVuZ3RoXG4gICAgZm9yIChpID0gc3RhcnQ7IGkgPCBlbmQ7IGkrKykge1xuICAgICAgdGhpc1tpXSA9IGJ5dGVzW2kgJSBsZW5dXG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHRoaXNcbn1cblxuLy8gSEVMUEVSIEZVTkNUSU9OU1xuLy8gPT09PT09PT09PT09PT09PVxuXG52YXIgSU5WQUxJRF9CQVNFNjRfUkUgPSAvW14rXFwvMC05QS1aYS16LV9dL2dcblxuZnVuY3Rpb24gYmFzZTY0Y2xlYW4gKHN0cikge1xuICAvLyBOb2RlIHN0cmlwcyBvdXQgaW52YWxpZCBjaGFyYWN0ZXJzIGxpa2UgXFxuIGFuZCBcXHQgZnJvbSB0aGUgc3RyaW5nLCBiYXNlNjQtanMgZG9lcyBub3RcbiAgc3RyID0gc3RyaW5ndHJpbShzdHIpLnJlcGxhY2UoSU5WQUxJRF9CQVNFNjRfUkUsICcnKVxuICAvLyBOb2RlIGNvbnZlcnRzIHN0cmluZ3Mgd2l0aCBsZW5ndGggPCAyIHRvICcnXG4gIGlmIChzdHIubGVuZ3RoIDwgMikgcmV0dXJuICcnXG4gIC8vIE5vZGUgYWxsb3dzIGZvciBub24tcGFkZGVkIGJhc2U2NCBzdHJpbmdzIChtaXNzaW5nIHRyYWlsaW5nID09PSksIGJhc2U2NC1qcyBkb2VzIG5vdFxuICB3aGlsZSAoc3RyLmxlbmd0aCAlIDQgIT09IDApIHtcbiAgICBzdHIgPSBzdHIgKyAnPSdcbiAgfVxuICByZXR1cm4gc3RyXG59XG5cbmZ1bmN0aW9uIHN0cmluZ3RyaW0gKHN0cikge1xuICBpZiAoc3RyLnRyaW0pIHJldHVybiBzdHIudHJpbSgpXG4gIHJldHVybiBzdHIucmVwbGFjZSgvXlxccyt8XFxzKyQvZywgJycpXG59XG5cbmZ1bmN0aW9uIHRvSGV4IChuKSB7XG4gIGlmIChuIDwgMTYpIHJldHVybiAnMCcgKyBuLnRvU3RyaW5nKDE2KVxuICByZXR1cm4gbi50b1N0cmluZygxNilcbn1cblxuZnVuY3Rpb24gdXRmOFRvQnl0ZXMgKHN0cmluZywgdW5pdHMpIHtcbiAgdW5pdHMgPSB1bml0cyB8fCBJbmZpbml0eVxuICB2YXIgY29kZVBvaW50XG4gIHZhciBsZW5ndGggPSBzdHJpbmcubGVuZ3RoXG4gIHZhciBsZWFkU3Vycm9nYXRlID0gbnVsbFxuICB2YXIgYnl0ZXMgPSBbXVxuXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICBjb2RlUG9pbnQgPSBzdHJpbmcuY2hhckNvZGVBdChpKVxuXG4gICAgLy8gaXMgc3Vycm9nYXRlIGNvbXBvbmVudFxuICAgIGlmIChjb2RlUG9pbnQgPiAweEQ3RkYgJiYgY29kZVBvaW50IDwgMHhFMDAwKSB7XG4gICAgICAvLyBsYXN0IGNoYXIgd2FzIGEgbGVhZFxuICAgICAgaWYgKCFsZWFkU3Vycm9nYXRlKSB7XG4gICAgICAgIC8vIG5vIGxlYWQgeWV0XG4gICAgICAgIGlmIChjb2RlUG9pbnQgPiAweERCRkYpIHtcbiAgICAgICAgICAvLyB1bmV4cGVjdGVkIHRyYWlsXG4gICAgICAgICAgaWYgKCh1bml0cyAtPSAzKSA+IC0xKSBieXRlcy5wdXNoKDB4RUYsIDB4QkYsIDB4QkQpXG4gICAgICAgICAgY29udGludWVcbiAgICAgICAgfSBlbHNlIGlmIChpICsgMSA9PT0gbGVuZ3RoKSB7XG4gICAgICAgICAgLy8gdW5wYWlyZWQgbGVhZFxuICAgICAgICAgIGlmICgodW5pdHMgLT0gMykgPiAtMSkgYnl0ZXMucHVzaCgweEVGLCAweEJGLCAweEJEKVxuICAgICAgICAgIGNvbnRpbnVlXG4gICAgICAgIH1cblxuICAgICAgICAvLyB2YWxpZCBsZWFkXG4gICAgICAgIGxlYWRTdXJyb2dhdGUgPSBjb2RlUG9pbnRcblxuICAgICAgICBjb250aW51ZVxuICAgICAgfVxuXG4gICAgICAvLyAyIGxlYWRzIGluIGEgcm93XG4gICAgICBpZiAoY29kZVBvaW50IDwgMHhEQzAwKSB7XG4gICAgICAgIGlmICgodW5pdHMgLT0gMykgPiAtMSkgYnl0ZXMucHVzaCgweEVGLCAweEJGLCAweEJEKVxuICAgICAgICBsZWFkU3Vycm9nYXRlID0gY29kZVBvaW50XG4gICAgICAgIGNvbnRpbnVlXG4gICAgICB9XG5cbiAgICAgIC8vIHZhbGlkIHN1cnJvZ2F0ZSBwYWlyXG4gICAgICBjb2RlUG9pbnQgPSAobGVhZFN1cnJvZ2F0ZSAtIDB4RDgwMCA8PCAxMCB8IGNvZGVQb2ludCAtIDB4REMwMCkgKyAweDEwMDAwXG4gICAgfSBlbHNlIGlmIChsZWFkU3Vycm9nYXRlKSB7XG4gICAgICAvLyB2YWxpZCBibXAgY2hhciwgYnV0IGxhc3QgY2hhciB3YXMgYSBsZWFkXG4gICAgICBpZiAoKHVuaXRzIC09IDMpID4gLTEpIGJ5dGVzLnB1c2goMHhFRiwgMHhCRiwgMHhCRClcbiAgICB9XG5cbiAgICBsZWFkU3Vycm9nYXRlID0gbnVsbFxuXG4gICAgLy8gZW5jb2RlIHV0ZjhcbiAgICBpZiAoY29kZVBvaW50IDwgMHg4MCkge1xuICAgICAgaWYgKCh1bml0cyAtPSAxKSA8IDApIGJyZWFrXG4gICAgICBieXRlcy5wdXNoKGNvZGVQb2ludClcbiAgICB9IGVsc2UgaWYgKGNvZGVQb2ludCA8IDB4ODAwKSB7XG4gICAgICBpZiAoKHVuaXRzIC09IDIpIDwgMCkgYnJlYWtcbiAgICAgIGJ5dGVzLnB1c2goXG4gICAgICAgIGNvZGVQb2ludCA+PiAweDYgfCAweEMwLFxuICAgICAgICBjb2RlUG9pbnQgJiAweDNGIHwgMHg4MFxuICAgICAgKVxuICAgIH0gZWxzZSBpZiAoY29kZVBvaW50IDwgMHgxMDAwMCkge1xuICAgICAgaWYgKCh1bml0cyAtPSAzKSA8IDApIGJyZWFrXG4gICAgICBieXRlcy5wdXNoKFxuICAgICAgICBjb2RlUG9pbnQgPj4gMHhDIHwgMHhFMCxcbiAgICAgICAgY29kZVBvaW50ID4+IDB4NiAmIDB4M0YgfCAweDgwLFxuICAgICAgICBjb2RlUG9pbnQgJiAweDNGIHwgMHg4MFxuICAgICAgKVxuICAgIH0gZWxzZSBpZiAoY29kZVBvaW50IDwgMHgxMTAwMDApIHtcbiAgICAgIGlmICgodW5pdHMgLT0gNCkgPCAwKSBicmVha1xuICAgICAgYnl0ZXMucHVzaChcbiAgICAgICAgY29kZVBvaW50ID4+IDB4MTIgfCAweEYwLFxuICAgICAgICBjb2RlUG9pbnQgPj4gMHhDICYgMHgzRiB8IDB4ODAsXG4gICAgICAgIGNvZGVQb2ludCA+PiAweDYgJiAweDNGIHwgMHg4MCxcbiAgICAgICAgY29kZVBvaW50ICYgMHgzRiB8IDB4ODBcbiAgICAgIClcbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIGNvZGUgcG9pbnQnKVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiBieXRlc1xufVxuXG5mdW5jdGlvbiBhc2NpaVRvQnl0ZXMgKHN0cikge1xuICB2YXIgYnl0ZUFycmF5ID0gW11cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBzdHIubGVuZ3RoOyBpKyspIHtcbiAgICAvLyBOb2RlJ3MgY29kZSBzZWVtcyB0byBiZSBkb2luZyB0aGlzIGFuZCBub3QgJiAweDdGLi5cbiAgICBieXRlQXJyYXkucHVzaChzdHIuY2hhckNvZGVBdChpKSAmIDB4RkYpXG4gIH1cbiAgcmV0dXJuIGJ5dGVBcnJheVxufVxuXG5mdW5jdGlvbiB1dGYxNmxlVG9CeXRlcyAoc3RyLCB1bml0cykge1xuICB2YXIgYywgaGksIGxvXG4gIHZhciBieXRlQXJyYXkgPSBbXVxuICBmb3IgKHZhciBpID0gMDsgaSA8IHN0ci5sZW5ndGg7IGkrKykge1xuICAgIGlmICgodW5pdHMgLT0gMikgPCAwKSBicmVha1xuXG4gICAgYyA9IHN0ci5jaGFyQ29kZUF0KGkpXG4gICAgaGkgPSBjID4+IDhcbiAgICBsbyA9IGMgJSAyNTZcbiAgICBieXRlQXJyYXkucHVzaChsbylcbiAgICBieXRlQXJyYXkucHVzaChoaSlcbiAgfVxuXG4gIHJldHVybiBieXRlQXJyYXlcbn1cblxuZnVuY3Rpb24gYmFzZTY0VG9CeXRlcyAoc3RyKSB7XG4gIHJldHVybiBiYXNlNjQudG9CeXRlQXJyYXkoYmFzZTY0Y2xlYW4oc3RyKSlcbn1cblxuZnVuY3Rpb24gYmxpdEJ1ZmZlciAoc3JjLCBkc3QsIG9mZnNldCwgbGVuZ3RoKSB7XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICBpZiAoKGkgKyBvZmZzZXQgPj0gZHN0Lmxlbmd0aCkgfHwgKGkgPj0gc3JjLmxlbmd0aCkpIGJyZWFrXG4gICAgZHN0W2kgKyBvZmZzZXRdID0gc3JjW2ldXG4gIH1cbiAgcmV0dXJuIGlcbn1cbiIsIid1c2Ugc3RyaWN0J1xuXG5leHBvcnRzLnRvQnl0ZUFycmF5ID0gdG9CeXRlQXJyYXlcbmV4cG9ydHMuZnJvbUJ5dGVBcnJheSA9IGZyb21CeXRlQXJyYXlcblxudmFyIGxvb2t1cCA9IFtdXG52YXIgcmV2TG9va3VwID0gW11cbnZhciBBcnIgPSB0eXBlb2YgVWludDhBcnJheSAhPT0gJ3VuZGVmaW5lZCcgPyBVaW50OEFycmF5IDogQXJyYXlcblxuZnVuY3Rpb24gaW5pdCAoKSB7XG4gIHZhciBjb2RlID0gJ0FCQ0RFRkdISUpLTE1OT1BRUlNUVVZXWFlaYWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXowMTIzNDU2Nzg5Ky8nXG4gIGZvciAodmFyIGkgPSAwLCBsZW4gPSBjb2RlLmxlbmd0aDsgaSA8IGxlbjsgKytpKSB7XG4gICAgbG9va3VwW2ldID0gY29kZVtpXVxuICAgIHJldkxvb2t1cFtjb2RlLmNoYXJDb2RlQXQoaSldID0gaVxuICB9XG5cbiAgcmV2TG9va3VwWyctJy5jaGFyQ29kZUF0KDApXSA9IDYyXG4gIHJldkxvb2t1cFsnXycuY2hhckNvZGVBdCgwKV0gPSA2M1xufVxuXG5pbml0KClcblxuZnVuY3Rpb24gdG9CeXRlQXJyYXkgKGI2NCkge1xuICB2YXIgaSwgaiwgbCwgdG1wLCBwbGFjZUhvbGRlcnMsIGFyclxuICB2YXIgbGVuID0gYjY0Lmxlbmd0aFxuXG4gIGlmIChsZW4gJSA0ID4gMCkge1xuICAgIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBzdHJpbmcuIExlbmd0aCBtdXN0IGJlIGEgbXVsdGlwbGUgb2YgNCcpXG4gIH1cblxuICAvLyB0aGUgbnVtYmVyIG9mIGVxdWFsIHNpZ25zIChwbGFjZSBob2xkZXJzKVxuICAvLyBpZiB0aGVyZSBhcmUgdHdvIHBsYWNlaG9sZGVycywgdGhhbiB0aGUgdHdvIGNoYXJhY3RlcnMgYmVmb3JlIGl0XG4gIC8vIHJlcHJlc2VudCBvbmUgYnl0ZVxuICAvLyBpZiB0aGVyZSBpcyBvbmx5IG9uZSwgdGhlbiB0aGUgdGhyZWUgY2hhcmFjdGVycyBiZWZvcmUgaXQgcmVwcmVzZW50IDIgYnl0ZXNcbiAgLy8gdGhpcyBpcyBqdXN0IGEgY2hlYXAgaGFjayB0byBub3QgZG8gaW5kZXhPZiB0d2ljZVxuICBwbGFjZUhvbGRlcnMgPSBiNjRbbGVuIC0gMl0gPT09ICc9JyA/IDIgOiBiNjRbbGVuIC0gMV0gPT09ICc9JyA/IDEgOiAwXG5cbiAgLy8gYmFzZTY0IGlzIDQvMyArIHVwIHRvIHR3byBjaGFyYWN0ZXJzIG9mIHRoZSBvcmlnaW5hbCBkYXRhXG4gIGFyciA9IG5ldyBBcnIobGVuICogMyAvIDQgLSBwbGFjZUhvbGRlcnMpXG5cbiAgLy8gaWYgdGhlcmUgYXJlIHBsYWNlaG9sZGVycywgb25seSBnZXQgdXAgdG8gdGhlIGxhc3QgY29tcGxldGUgNCBjaGFyc1xuICBsID0gcGxhY2VIb2xkZXJzID4gMCA/IGxlbiAtIDQgOiBsZW5cblxuICB2YXIgTCA9IDBcblxuICBmb3IgKGkgPSAwLCBqID0gMDsgaSA8IGw7IGkgKz0gNCwgaiArPSAzKSB7XG4gICAgdG1wID0gKHJldkxvb2t1cFtiNjQuY2hhckNvZGVBdChpKV0gPDwgMTgpIHwgKHJldkxvb2t1cFtiNjQuY2hhckNvZGVBdChpICsgMSldIDw8IDEyKSB8IChyZXZMb29rdXBbYjY0LmNoYXJDb2RlQXQoaSArIDIpXSA8PCA2KSB8IHJldkxvb2t1cFtiNjQuY2hhckNvZGVBdChpICsgMyldXG4gICAgYXJyW0wrK10gPSAodG1wID4+IDE2KSAmIDB4RkZcbiAgICBhcnJbTCsrXSA9ICh0bXAgPj4gOCkgJiAweEZGXG4gICAgYXJyW0wrK10gPSB0bXAgJiAweEZGXG4gIH1cblxuICBpZiAocGxhY2VIb2xkZXJzID09PSAyKSB7XG4gICAgdG1wID0gKHJldkxvb2t1cFtiNjQuY2hhckNvZGVBdChpKV0gPDwgMikgfCAocmV2TG9va3VwW2I2NC5jaGFyQ29kZUF0KGkgKyAxKV0gPj4gNClcbiAgICBhcnJbTCsrXSA9IHRtcCAmIDB4RkZcbiAgfSBlbHNlIGlmIChwbGFjZUhvbGRlcnMgPT09IDEpIHtcbiAgICB0bXAgPSAocmV2TG9va3VwW2I2NC5jaGFyQ29kZUF0KGkpXSA8PCAxMCkgfCAocmV2TG9va3VwW2I2NC5jaGFyQ29kZUF0KGkgKyAxKV0gPDwgNCkgfCAocmV2TG9va3VwW2I2NC5jaGFyQ29kZUF0KGkgKyAyKV0gPj4gMilcbiAgICBhcnJbTCsrXSA9ICh0bXAgPj4gOCkgJiAweEZGXG4gICAgYXJyW0wrK10gPSB0bXAgJiAweEZGXG4gIH1cblxuICByZXR1cm4gYXJyXG59XG5cbmZ1bmN0aW9uIHRyaXBsZXRUb0Jhc2U2NCAobnVtKSB7XG4gIHJldHVybiBsb29rdXBbbnVtID4+IDE4ICYgMHgzRl0gKyBsb29rdXBbbnVtID4+IDEyICYgMHgzRl0gKyBsb29rdXBbbnVtID4+IDYgJiAweDNGXSArIGxvb2t1cFtudW0gJiAweDNGXVxufVxuXG5mdW5jdGlvbiBlbmNvZGVDaHVuayAodWludDgsIHN0YXJ0LCBlbmQpIHtcbiAgdmFyIHRtcFxuICB2YXIgb3V0cHV0ID0gW11cbiAgZm9yICh2YXIgaSA9IHN0YXJ0OyBpIDwgZW5kOyBpICs9IDMpIHtcbiAgICB0bXAgPSAodWludDhbaV0gPDwgMTYpICsgKHVpbnQ4W2kgKyAxXSA8PCA4KSArICh1aW50OFtpICsgMl0pXG4gICAgb3V0cHV0LnB1c2godHJpcGxldFRvQmFzZTY0KHRtcCkpXG4gIH1cbiAgcmV0dXJuIG91dHB1dC5qb2luKCcnKVxufVxuXG5mdW5jdGlvbiBmcm9tQnl0ZUFycmF5ICh1aW50OCkge1xuICB2YXIgdG1wXG4gIHZhciBsZW4gPSB1aW50OC5sZW5ndGhcbiAgdmFyIGV4dHJhQnl0ZXMgPSBsZW4gJSAzIC8vIGlmIHdlIGhhdmUgMSBieXRlIGxlZnQsIHBhZCAyIGJ5dGVzXG4gIHZhciBvdXRwdXQgPSAnJ1xuICB2YXIgcGFydHMgPSBbXVxuICB2YXIgbWF4Q2h1bmtMZW5ndGggPSAxNjM4MyAvLyBtdXN0IGJlIG11bHRpcGxlIG9mIDNcblxuICAvLyBnbyB0aHJvdWdoIHRoZSBhcnJheSBldmVyeSB0aHJlZSBieXRlcywgd2UnbGwgZGVhbCB3aXRoIHRyYWlsaW5nIHN0dWZmIGxhdGVyXG4gIGZvciAodmFyIGkgPSAwLCBsZW4yID0gbGVuIC0gZXh0cmFCeXRlczsgaSA8IGxlbjI7IGkgKz0gbWF4Q2h1bmtMZW5ndGgpIHtcbiAgICBwYXJ0cy5wdXNoKGVuY29kZUNodW5rKHVpbnQ4LCBpLCAoaSArIG1heENodW5rTGVuZ3RoKSA+IGxlbjIgPyBsZW4yIDogKGkgKyBtYXhDaHVua0xlbmd0aCkpKVxuICB9XG5cbiAgLy8gcGFkIHRoZSBlbmQgd2l0aCB6ZXJvcywgYnV0IG1ha2Ugc3VyZSB0byBub3QgZm9yZ2V0IHRoZSBleHRyYSBieXRlc1xuICBpZiAoZXh0cmFCeXRlcyA9PT0gMSkge1xuICAgIHRtcCA9IHVpbnQ4W2xlbiAtIDFdXG4gICAgb3V0cHV0ICs9IGxvb2t1cFt0bXAgPj4gMl1cbiAgICBvdXRwdXQgKz0gbG9va3VwWyh0bXAgPDwgNCkgJiAweDNGXVxuICAgIG91dHB1dCArPSAnPT0nXG4gIH0gZWxzZSBpZiAoZXh0cmFCeXRlcyA9PT0gMikge1xuICAgIHRtcCA9ICh1aW50OFtsZW4gLSAyXSA8PCA4KSArICh1aW50OFtsZW4gLSAxXSlcbiAgICBvdXRwdXQgKz0gbG9va3VwW3RtcCA+PiAxMF1cbiAgICBvdXRwdXQgKz0gbG9va3VwWyh0bXAgPj4gNCkgJiAweDNGXVxuICAgIG91dHB1dCArPSBsb29rdXBbKHRtcCA8PCAyKSAmIDB4M0ZdXG4gICAgb3V0cHV0ICs9ICc9J1xuICB9XG5cbiAgcGFydHMucHVzaChvdXRwdXQpXG5cbiAgcmV0dXJuIHBhcnRzLmpvaW4oJycpXG59XG4iLCJleHBvcnRzLnJlYWQgPSBmdW5jdGlvbiAoYnVmZmVyLCBvZmZzZXQsIGlzTEUsIG1MZW4sIG5CeXRlcykge1xuICB2YXIgZSwgbVxuICB2YXIgZUxlbiA9IG5CeXRlcyAqIDggLSBtTGVuIC0gMVxuICB2YXIgZU1heCA9ICgxIDw8IGVMZW4pIC0gMVxuICB2YXIgZUJpYXMgPSBlTWF4ID4+IDFcbiAgdmFyIG5CaXRzID0gLTdcbiAgdmFyIGkgPSBpc0xFID8gKG5CeXRlcyAtIDEpIDogMFxuICB2YXIgZCA9IGlzTEUgPyAtMSA6IDFcbiAgdmFyIHMgPSBidWZmZXJbb2Zmc2V0ICsgaV1cblxuICBpICs9IGRcblxuICBlID0gcyAmICgoMSA8PCAoLW5CaXRzKSkgLSAxKVxuICBzID4+PSAoLW5CaXRzKVxuICBuQml0cyArPSBlTGVuXG4gIGZvciAoOyBuQml0cyA+IDA7IGUgPSBlICogMjU2ICsgYnVmZmVyW29mZnNldCArIGldLCBpICs9IGQsIG5CaXRzIC09IDgpIHt9XG5cbiAgbSA9IGUgJiAoKDEgPDwgKC1uQml0cykpIC0gMSlcbiAgZSA+Pj0gKC1uQml0cylcbiAgbkJpdHMgKz0gbUxlblxuICBmb3IgKDsgbkJpdHMgPiAwOyBtID0gbSAqIDI1NiArIGJ1ZmZlcltvZmZzZXQgKyBpXSwgaSArPSBkLCBuQml0cyAtPSA4KSB7fVxuXG4gIGlmIChlID09PSAwKSB7XG4gICAgZSA9IDEgLSBlQmlhc1xuICB9IGVsc2UgaWYgKGUgPT09IGVNYXgpIHtcbiAgICByZXR1cm4gbSA/IE5hTiA6ICgocyA/IC0xIDogMSkgKiBJbmZpbml0eSlcbiAgfSBlbHNlIHtcbiAgICBtID0gbSArIE1hdGgucG93KDIsIG1MZW4pXG4gICAgZSA9IGUgLSBlQmlhc1xuICB9XG4gIHJldHVybiAocyA/IC0xIDogMSkgKiBtICogTWF0aC5wb3coMiwgZSAtIG1MZW4pXG59XG5cbmV4cG9ydHMud3JpdGUgPSBmdW5jdGlvbiAoYnVmZmVyLCB2YWx1ZSwgb2Zmc2V0LCBpc0xFLCBtTGVuLCBuQnl0ZXMpIHtcbiAgdmFyIGUsIG0sIGNcbiAgdmFyIGVMZW4gPSBuQnl0ZXMgKiA4IC0gbUxlbiAtIDFcbiAgdmFyIGVNYXggPSAoMSA8PCBlTGVuKSAtIDFcbiAgdmFyIGVCaWFzID0gZU1heCA+PiAxXG4gIHZhciBydCA9IChtTGVuID09PSAyMyA/IE1hdGgucG93KDIsIC0yNCkgLSBNYXRoLnBvdygyLCAtNzcpIDogMClcbiAgdmFyIGkgPSBpc0xFID8gMCA6IChuQnl0ZXMgLSAxKVxuICB2YXIgZCA9IGlzTEUgPyAxIDogLTFcbiAgdmFyIHMgPSB2YWx1ZSA8IDAgfHwgKHZhbHVlID09PSAwICYmIDEgLyB2YWx1ZSA8IDApID8gMSA6IDBcblxuICB2YWx1ZSA9IE1hdGguYWJzKHZhbHVlKVxuXG4gIGlmIChpc05hTih2YWx1ZSkgfHwgdmFsdWUgPT09IEluZmluaXR5KSB7XG4gICAgbSA9IGlzTmFOKHZhbHVlKSA/IDEgOiAwXG4gICAgZSA9IGVNYXhcbiAgfSBlbHNlIHtcbiAgICBlID0gTWF0aC5mbG9vcihNYXRoLmxvZyh2YWx1ZSkgLyBNYXRoLkxOMilcbiAgICBpZiAodmFsdWUgKiAoYyA9IE1hdGgucG93KDIsIC1lKSkgPCAxKSB7XG4gICAgICBlLS1cbiAgICAgIGMgKj0gMlxuICAgIH1cbiAgICBpZiAoZSArIGVCaWFzID49IDEpIHtcbiAgICAgIHZhbHVlICs9IHJ0IC8gY1xuICAgIH0gZWxzZSB7XG4gICAgICB2YWx1ZSArPSBydCAqIE1hdGgucG93KDIsIDEgLSBlQmlhcylcbiAgICB9XG4gICAgaWYgKHZhbHVlICogYyA+PSAyKSB7XG4gICAgICBlKytcbiAgICAgIGMgLz0gMlxuICAgIH1cblxuICAgIGlmIChlICsgZUJpYXMgPj0gZU1heCkge1xuICAgICAgbSA9IDBcbiAgICAgIGUgPSBlTWF4XG4gICAgfSBlbHNlIGlmIChlICsgZUJpYXMgPj0gMSkge1xuICAgICAgbSA9ICh2YWx1ZSAqIGMgLSAxKSAqIE1hdGgucG93KDIsIG1MZW4pXG4gICAgICBlID0gZSArIGVCaWFzXG4gICAgfSBlbHNlIHtcbiAgICAgIG0gPSB2YWx1ZSAqIE1hdGgucG93KDIsIGVCaWFzIC0gMSkgKiBNYXRoLnBvdygyLCBtTGVuKVxuICAgICAgZSA9IDBcbiAgICB9XG4gIH1cblxuICBmb3IgKDsgbUxlbiA+PSA4OyBidWZmZXJbb2Zmc2V0ICsgaV0gPSBtICYgMHhmZiwgaSArPSBkLCBtIC89IDI1NiwgbUxlbiAtPSA4KSB7fVxuXG4gIGUgPSAoZSA8PCBtTGVuKSB8IG1cbiAgZUxlbiArPSBtTGVuXG4gIGZvciAoOyBlTGVuID4gMDsgYnVmZmVyW29mZnNldCArIGldID0gZSAmIDB4ZmYsIGkgKz0gZCwgZSAvPSAyNTYsIGVMZW4gLT0gOCkge31cblxuICBidWZmZXJbb2Zmc2V0ICsgaSAtIGRdIHw9IHMgKiAxMjhcbn1cbiIsInZhciB0b1N0cmluZyA9IHt9LnRvU3RyaW5nO1xuXG5tb2R1bGUuZXhwb3J0cyA9IEFycmF5LmlzQXJyYXkgfHwgZnVuY3Rpb24gKGFycikge1xuICByZXR1cm4gdG9TdHJpbmcuY2FsbChhcnIpID09ICdbb2JqZWN0IEFycmF5XSc7XG59O1xuIl19
