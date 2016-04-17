(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
(function () {
  'use strict';

  const Buffer = require('buffer').Buffer;
  const qs = require('qs');
  const httpMessageParser = require('http-message-parser');

  const AMAZON_ERROR_CODES = require('./lib/AmazonErrorCodes');
  const Observable = require('./lib/Observable');
  const Player = require('./lib/Player');
  const arrayBufferToString = require('./lib/utils/arrayBufferToString');
  const writeUTFBytes = require('./lib/utils/writeUTFBytes');
  const mergeBuffers = require('./lib/utils/mergeBuffers');
  const interleave = require('./lib/utils/interleave');
  const downsampleBuffer = require('./lib/utils/downsampleBuffer');

  if (!navigator.getUserMedia) {
    navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia;
  }

  class AVS {
    constructor(options = {}) {
      Observable(this);

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
      this._audioQueue = [];

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

      this.player = new Player();
    }

    _log(type, message) {
      if (type && !message) {
        message = type;
        type = 'log';
      }

      setTimeout(() => {
        this.emit(AVS.EventTypes.LOG, message);
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
        this.emit(AVS.EventTypes.LOGOUT);
        this._log('Logged out');
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

          this.emit(AVS.EventTypes.LOGIN);
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
            this.emit(AVS.EventTypes.ERROR, error);

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
        let hash = window.location.hash.substr(1);

        const query = qs.parse(hash);
        const token = query.access_token;
        const refreshToken = query.refresh_token;
        const tokenType = query.token_type;
        const expiresIn = query.expiresIn;

        if (token) {
          this.setToken(token);
          this.emit(AVS.EventTypes.LOGIN);
          this._log('Logged in.');

          if (refreshToken) {
            this.setRefreshToken(refreshToken);
          }

          return resolve(token);
        }

        return reject();
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
          this.emit(AVS.EventTypes.TOKEN_SET);
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
          this.emit(AVS.EventTypes.REFRESH_TOKEN_SET);
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
          this.emit(AVS.EventTypes.ERROR, error);
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
          this.emit(AVS.EventTypes.ERROR, error);
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
          this.emit(AVS.EventTypes.ERROR, error);
          return reject(error);
        }

        this._isRecording = true;
        this._leftChannel.length = this._rightChannel.length = 0;
        this._recordingLength = 0;
        this._log(`Recording started.`);
        this.emit(AVS.EventTypes.RECORD_START);

        return resolve();
      });
    }

    stopRecording() {
      return new Promise((resolve, reject) => {
        if (!this._isRecording) {
          this.emit(AVS.EventTypes.RECORD_STOP);
          this._log('Recording stopped.');
          return resolve();
        }

        this._isRecording = false;

        const leftBuffer = mergeBuffers(this._leftChannel, this._recordingLength);
        let interleaved = null;

        if (this._outputChannels > 1) {
          const rightBuffer = mergeBuffers(this._rightChannel, this._recordingLength);
          interleaved = interleave(leftBuffer, rightBuffer);
        } else {
          interleaved = interleave(leftBuffer);
        }

        interleaved = downsampleBuffer(interleaved, this._sampleRate, this._outputSampleRate);

        const buffer = new ArrayBuffer(44 + interleaved.length * 2);
        const view = new DataView(buffer);

        /**
         * @credit https://github.com/mattdiamond/Recorderjs
         */
        writeUTFBytes(view, 0, 'RIFF');
        view.setUint32(4, 44 + interleaved.length * 2, true);
        writeUTFBytes(view, 8, 'WAVE');
        writeUTFBytes(view, 12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, this._outputChannels, true);
        view.setUint32(24, this._outputSampleRate, true);
        view.setUint32(28, this._outputSampleRate * 4, true);
        view.setUint16(32, 4, true);
        view.setUint16(34, 16, true);
        writeUTFBytes(view, 36, 'data');
        view.setUint32(40, interleaved.length * 2, true);

        const length = interleaved.length;
        const volume = 1;
        let index = 44;

        for (let i = 0; i < length; i++) {
          view.setInt16(index, interleaved[i] * (0x7FFF * volume), true);
          index += 2;
        }

        this._log(`Recording stopped.`);
        this.emit(AVS.EventTypes.RECORD_STOP);
        return resolve(view);
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
                response = JSON.parse(arrayBufferToString(buffer));
              } catch (err) {
                error = err;
              }
            }

            if (response.error instanceof Object) {
              if (response.error.code === AMAZON_ERROR_CODES.InvalidAccessTokenException) {
                this.emit(AVS.EventTypes.TOKEN_INVALID);
              }

              error = response.error.message;
            }

            this.emit(AVS.EventTypes.ERROR, error);
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
        REFRESH_TOKEN_SET: 'refreshTokenSet',
        TOKEN_INVALID: 'tokenInvalid'
      };
    }

    static get Player() {
      return Player;
    }
  }

  if (typeof exports !== 'undefined') {
    if (typeof module !== 'undefined' && module.exports) {
      exports = module.exports = AVS;
    }
    exports.AVS = AVS;
  }

  if (typeof define === 'function' && define.amd) {
    define([], function () {
      return AVS;
    });
  }

  if (typeof window === 'object') {
    window.AVS = AVS;
  }
})();

},{"./lib/AmazonErrorCodes":3,"./lib/Observable":4,"./lib/Player":5,"./lib/utils/arrayBufferToString":7,"./lib/utils/downsampleBuffer":8,"./lib/utils/interleave":9,"./lib/utils/mergeBuffers":10,"./lib/utils/writeUTFBytes":11,"buffer":17,"http-message-parser":12,"qs":13}],2:[function(require,module,exports){
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
  loginBtn.disabled = true;
  logoutBtn.disabled = false;
  startRecording.disabled = false;
  stopRecording.disabled = true;
});

avs.on(AVS.EventTypes.RECORD_START, () => {
  startRecording.disabled = true;
  stopRecording.disabled = false;
});

avs.on(AVS.EventTypes.RECORD_STOP, () => {
  startRecording.disabled = false;
  stopRecording.disabled = true;
});

avs.on(AVS.EventTypes.LOGOUT, () => {
  loginBtn.disabled = false;
  logoutBtn.disabled = true;
  startRecording.disabled = true;
  stopRecording.disabled = true;
});

avs.on(AVS.EventTypes.TOKEN_INVALID, () => {
  avs.logout().then(login);
});

avs.on(AVS.EventTypes.LOG, log);
avs.on(AVS.EventTypes.ERROR, logError);

avs.player.on(AVS.Player.EventTypes.LOG, log);
avs.player.on(AVS.Player.EventTypes.ERROR, logError);

avs.player.on(AVS.Player.EventTypes.PLAY, () => {
  playAudio.disabled = true;
  replayAudio.disabled = true;
  pauseAudio.disabled = false;
  stopAudio.disabled = false;
});

avs.player.on(AVS.Player.EventTypes.ENDED, () => {
  playAudio.disabled = true;
  replayAudio.disabled = false;
  pauseAudio.disabled = true;
  stopAudio.disabled = true;
});

avs.player.on(AVS.Player.EventTypes.STOP, () => {
  playAudio.disabled = true;
  replayAudio.disabled = false;
  pauseAudio.disabled = false;
  stopAudio.disabled = false;
});

avs.player.on(AVS.Player.EventTypes.PAUSE, () => {
  playAudio.disabled = false;
  replayAudio.disabled = false;
  pauseAudio.disabled = true;
  stopAudio.disabled = true;
});

avs.player.on(AVS.Player.EventTypes.REPLAY, () => {
  playAudio.disabled = true;
  replayAudio.disabled = true;
  pauseAudio.disabled = false;
  stopAudio.disabled = false;
});

function log(message) {
  logOutput.innerHTML += `<li>LOG: ${ message }</li>`;
}

function logError(error) {
  logOutput.innerHTML += `<li>ERROR: ${ error }</li>`;
}

const loginBtn = document.getElementById('login');
const logoutBtn = document.getElementById('logout');
const logOutput = document.getElementById('log');
const startRecording = document.getElementById('startRecording');
const stopRecording = document.getElementById('stopRecording');
const stopAudio = document.getElementById('stopAudio');
const pauseAudio = document.getElementById('pauseAudio');
const playAudio = document.getElementById('playAudio');
const replayAudio = document.getElementById('replayAudio');

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

loginBtn.addEventListener('click', login);

function login(event) {
  return avs.login().then(() => avs.requestMic()).catch(() => {});

  /*
  // If using client secret
  avs.login({responseType: 'code'})
  .then(() => avs.requestMic())
  .catch(() => {});
  */
}

logoutBtn.addEventListener('click', logout);

function logout() {
  return avs.logout().then(() => {
    localStorage.removeItem('token');
    window.location.hash = '';
  });
}

startRecording.addEventListener('click', () => {
  avs.startRecording();
});

stopRecording.addEventListener('click', () => {
  avs.stopRecording().then(dataView => {
    avs.player.emptyQueue().then(() => avs.player.enqueue(dataView)).then(() => avs.player.play()).catch(error => {
      console.error(error);
    });

    //sendBlob(blob);
    avs.sendAudio(dataView).then(response => {

      if (response.multipart.length > 1) {
        const typedArray = response.multipart[1].body;

        avs.player.enqueue(typedArray).then(() => avs.player.play()).catch(error => {
          console.error(error);
        });
      }
    }).catch(error => {
      console.error(error);
    });
  });
});

stopAudio.addEventListener('click', event => {
  avs.player.stop();
});

pauseAudio.addEventListener('click', event => {
  avs.player.pause();
});

playAudio.addEventListener('click', event => {
  avs.player.play();
});

replayAudio.addEventListener('click', event => {
  avs.player.replay();
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
'use strict';

module.exports = {
  InvalidAccessTokenException: 'com.amazon.alexahttpproxy.exceptions.InvalidAccessTokenException'
};

},{}],4:[function(require,module,exports){
'use strict';

function Observable(el) {
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

module.exports = Observable;

},{}],5:[function(require,module,exports){
'use strict';

const Observable = require('./Observable');
const arrayBufferToAudioBuffer = require('./utils/arrayBufferToAudioBuffer');
const toString = Object.prototype.toString;

class Player {
  constructor() {
    this._queue = [];
    this._currentSource = null;
    this._currentBuffer = null;
    this._context = new AudioContext();

    Observable(this);
  }

  _log(type, message) {
    if (type && !message) {
      message = type;
      type = 'log';
    }

    setTimeout(() => {
      this.emit(Player.EventTypes.LOG, message);
    }, 0);

    if (this._debug) {
      console[type](message);
    }
  }

  emptyQueue() {
    return new Promise((resolve, reject) => {
      this._queue = [];
      resolve();
    });
  }

  enqueue(item) {
    return new Promise((resolve, reject) => {
      if (!item) {
        const error = new Error('argument cannot be empty.');
        this._log(error);
        return reject(error);
      }

      const stringType = toString.call(item);

      const proceed = audioBuffer => {
        this._queue.push(audioBuffer);
        this._log('Enqueue audio');
        this.emit(Player.EventTypes.ENQUEUE);
        return resolve(audioBuffer);
      };

      if (stringType === '[object DataView]' || stringType === '[object Uint8Array]') {
        arrayBufferToAudioBuffer(item.buffer, this._context).then(proceed);
      } else if (stringType === '[object AudioBuffer]') {
        proceed(item);
      } else {
        const error = new Error('Invalid type.');
        this.emit('error', error);
        return reject(error);
      }
    });
  }

  deque() {
    return new Promise((resolve, reject) => {
      const item = this._queue.shift();

      if (item) {
        this._log('Deque audio');
        this.emit(Player.EventTypes.DEQUE);
        return resolve(item);
      }

      return reject();
    });
  }

  play() {
    return new Promise((resolve, reject) => {
      if (this._context.state === 'suspended') {
        this._context.resume();

        this._log('Play audio');
        this.emit(Player.EventTypes.PLAY);
      } else {
        return this.deque().then(audioBuffer => {
          this.playAudioBuffer(audioBuffer);

          this._log('Play audio');
          this.emit(Player.EventTypes.PLAY);
        });
      }
    });
  }

  stop() {
    return new Promise((resolve, reject) => {
      if (this._currentSource) {
        this._currentSource.onended = function () {};
        this._currentSource.stop();
      }

      this._log('Stop audio');
      this.emit(Player.EventTypes.STOP);
    });
  }

  pause() {
    return new Promise((resolve, reject) => {
      if (this._context.state === 'running') {
        this._context.suspend();
      }

      this._log('Pause audio');
      this.emit(Player.EventTypes.PAUSE);
    });
  }

  replay() {
    return new Promise((resolve, reject) => {
      if (this._currentBuffer) {
        this._log('Replay audio');
        this.emit(Player.EventTypes.REPLAY);

        if (this._context.state === 'suspended') {
          this._context.resume();
        }

        this._currentSource.stop();
        this._currentSource.onended = function () {};

        return this.playAudioBuffer(this._currentBuffer);
      } else {
        const error = new Error('No audio source loaded.');
        this.emit('error', error);
        reject();
      }
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
        this._log('Audio ended');
        this.emit(Player.EventTypes.ENDED);
      });

      audio.onload = event => {
        URL.revokeObjectUrl(objectUrl);
      };

      this._log('Audio play started.');
      audio.play();

      resolve();
    });
  }

  playAudioBuffer(buffer) {
    return new Promise((resolve, reject) => {
      const source = this._context.createBufferSource();
      source.buffer = buffer;
      source.connect(this._context.destination);
      source.start(0);
      this._currentBuffer = buffer;
      this._currentSource = source;

      source.onended = event => {
        this._log('Audio ended');
        this.emit(Player.EventTypes.ENDED);
      };

      source.onerror = error => {
        this.emit('error', error);
      };

      resolve();
    });
  }

  static get EventTypes() {
    return {
      LOG: 'log',
      ERROR: 'error',
      PLAY: 'play',
      REPLAY: 'replay',
      PAUSE: 'pause',
      STOP: 'pause',
      ENQUEUE: 'enqueue',
      DEQUE: 'deque'
    };
  }
}

module.exports = Player;

},{"./Observable":4,"./utils/arrayBufferToAudioBuffer":6}],6:[function(require,module,exports){
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

},{}],7:[function(require,module,exports){
'use strict';

/**
 * @credit https://developers.google.com/web/updates/2012/06/How-to-convert-ArrayBuffer-to-and-from-String?hl=en
 */

function arrayBufferToString(buffer) {
  return String.fromCharCode.apply(null, new Uint16Array(buffer));
}

module.exports = arrayBufferToString;

},{}],8:[function(require,module,exports){
'use strict';

/**
 * @credit http://stackoverflow.com/a/26245260
 */

function downsampleBuffer(buffer, inputSampleRate, outputSampleRate) {
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

module.exports = downsampleBuffer;

},{}],9:[function(require,module,exports){
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

  for (let index = 0; index < length;) {
    result[index++] = leftChannel[inputIndex];
    result[index++] = rightChannel[inputIndex];
    inputIndex++;
  }

  return result;
}

module.exports = interleave;

},{}],10:[function(require,module,exports){
'use strict';

/**
 * @credit https://github.com/mattdiamond/Recorderjs
 */

function mergeBuffers(channelBuffer, recordingLength) {
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

module.exports = mergeBuffers;

},{}],11:[function(require,module,exports){
'use strict';

/**
 * @credit https://github.com/mattdiamond/Recorderjs
 */

function writeUTFBytes(view, offset, string) {
  const length = string.length;

  for (let i = 0; i < length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

module.exports = writeUTFBytes;

},{}],12:[function(require,module,exports){
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

},{"buffer":17}],13:[function(require,module,exports){
'use strict';

var Stringify = require('./stringify');
var Parse = require('./parse');

module.exports = {
    stringify: Stringify,
    parse: Parse
};

},{"./parse":14,"./stringify":15}],14:[function(require,module,exports){
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

},{"./utils":16}],15:[function(require,module,exports){
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

},{"./utils":16}],16:[function(require,module,exports){
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

},{}],17:[function(require,module,exports){
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

},{"base64-js":18,"ieee754":19,"isarray":20}],18:[function(require,module,exports){
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

},{}],19:[function(require,module,exports){
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

},{}],20:[function(require,module,exports){
var toString = {}.toString;

module.exports = Array.isArray || function (arr) {
  return toString.call(arr) == '[object Array]';
};

},{}]},{},[2])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL3Vzci9sb2NhbC9saWIvbm9kZV9tb2R1bGVzL3dhdGNoaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIuLi9hdnMuanMiLCJpbmRleC5qcyIsIi4uL2xpYi9BbWF6b25FcnJvckNvZGVzLmpzIiwiLi4vbGliL09ic2VydmFibGUuanMiLCIuLi9saWIvUGxheWVyLmpzIiwiLi4vbGliL3V0aWxzL2FycmF5QnVmZmVyVG9BdWRpb0J1ZmZlci5qcyIsIi4uL2xpYi91dGlscy9hcnJheUJ1ZmZlclRvU3RyaW5nLmpzIiwiLi4vbGliL3V0aWxzL2Rvd25zYW1wbGVCdWZmZXIuanMiLCIuLi9saWIvdXRpbHMvaW50ZXJsZWF2ZS5qcyIsIi4uL2xpYi91dGlscy9tZXJnZUJ1ZmZlcnMuanMiLCIuLi9saWIvdXRpbHMvd3JpdGVVVEZCeXRlcy5qcyIsIi4uL25vZGVfbW9kdWxlcy9odHRwLW1lc3NhZ2UtcGFyc2VyL2h0dHAtbWVzc2FnZS1wYXJzZXIuanMiLCIuLi9ub2RlX21vZHVsZXMvcXMvbGliL2luZGV4LmpzIiwiLi4vbm9kZV9tb2R1bGVzL3FzL2xpYi9wYXJzZS5qcyIsIi4uL25vZGVfbW9kdWxlcy9xcy9saWIvc3RyaW5naWZ5LmpzIiwiLi4vbm9kZV9tb2R1bGVzL3FzL2xpYi91dGlscy5qcyIsIi4uLy4uLy4uLy4uLy4uL3Vzci9sb2NhbC9saWIvbm9kZV9tb2R1bGVzL3dhdGNoaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9idWZmZXIvaW5kZXguanMiLCIuLi8uLi8uLi8uLi8uLi91c3IvbG9jYWwvbGliL25vZGVfbW9kdWxlcy93YXRjaGlmeS9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnVmZmVyL25vZGVfbW9kdWxlcy9iYXNlNjQtanMvbGliL2I2NC5qcyIsIi4uLy4uLy4uLy4uLy4uL3Vzci9sb2NhbC9saWIvbm9kZV9tb2R1bGVzL3dhdGNoaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9idWZmZXIvbm9kZV9tb2R1bGVzL2llZWU3NTQvaW5kZXguanMiLCIuLi8uLi8uLi8uLi8uLi91c3IvbG9jYWwvbGliL25vZGVfbW9kdWxlcy93YXRjaGlmeS9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnVmZmVyL25vZGVfbW9kdWxlcy9pc2FycmF5L2luZGV4LmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUEsQ0FBQyxZQUFXO0FBQ1YsZUFEVTs7QUFHVixRQUFNLFNBQVMsUUFBUSxRQUFSLEVBQWtCLE1BQWxCLENBSEw7QUFJVixRQUFNLEtBQUssUUFBUSxJQUFSLENBQUwsQ0FKSTtBQUtWLFFBQU0sb0JBQW9CLFFBQVEscUJBQVIsQ0FBcEIsQ0FMSTs7QUFPVixRQUFNLHFCQUFxQixRQUFRLHdCQUFSLENBQXJCLENBUEk7QUFRVixRQUFNLGFBQWEsUUFBUSxrQkFBUixDQUFiLENBUkk7QUFTVixRQUFNLFNBQVMsUUFBUSxjQUFSLENBQVQsQ0FUSTtBQVVWLFFBQU0sc0JBQXNCLFFBQVEsaUNBQVIsQ0FBdEIsQ0FWSTtBQVdWLFFBQU0sZ0JBQWdCLFFBQVEsMkJBQVIsQ0FBaEIsQ0FYSTtBQVlWLFFBQU0sZUFBZSxRQUFRLDBCQUFSLENBQWYsQ0FaSTtBQWFWLFFBQU0sYUFBYSxRQUFRLHdCQUFSLENBQWIsQ0FiSTtBQWNWLFFBQU0sbUJBQW1CLFFBQVEsOEJBQVIsQ0FBbkIsQ0FkSTs7QUFnQlYsTUFBSSxDQUFDLFVBQVUsWUFBVixFQUF3QjtBQUMzQixjQUFVLFlBQVYsR0FBeUIsVUFBVSxZQUFWLElBQTBCLFVBQVUsa0JBQVYsSUFDakQsVUFBVSxlQUFWLElBQTZCLFVBQVUsY0FBVixDQUZKO0dBQTdCOztBQUtBLFFBQU0sR0FBTixDQUFVO0FBQ1IsZ0JBQVksVUFBVSxFQUFWLEVBQWM7QUFDeEIsaUJBQVcsSUFBWCxFQUR3Qjs7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QUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUNsVUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDVEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BLQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbklBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUNsS0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQ2g3Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3R0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcEZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIoZnVuY3Rpb24oKSB7XG4gICd1c2Ugc3RyaWN0JztcblxuICBjb25zdCBCdWZmZXIgPSByZXF1aXJlKCdidWZmZXInKS5CdWZmZXI7XG4gIGNvbnN0IHFzID0gcmVxdWlyZSgncXMnKTtcbiAgY29uc3QgaHR0cE1lc3NhZ2VQYXJzZXIgPSByZXF1aXJlKCdodHRwLW1lc3NhZ2UtcGFyc2VyJyk7XG5cbiAgY29uc3QgQU1BWk9OX0VSUk9SX0NPREVTID0gcmVxdWlyZSgnLi9saWIvQW1hem9uRXJyb3JDb2RlcycpO1xuICBjb25zdCBPYnNlcnZhYmxlID0gcmVxdWlyZSgnLi9saWIvT2JzZXJ2YWJsZScpO1xuICBjb25zdCBQbGF5ZXIgPSByZXF1aXJlKCcuL2xpYi9QbGF5ZXInKTtcbiAgY29uc3QgYXJyYXlCdWZmZXJUb1N0cmluZyA9IHJlcXVpcmUoJy4vbGliL3V0aWxzL2FycmF5QnVmZmVyVG9TdHJpbmcnKTtcbiAgY29uc3Qgd3JpdGVVVEZCeXRlcyA9IHJlcXVpcmUoJy4vbGliL3V0aWxzL3dyaXRlVVRGQnl0ZXMnKTtcbiAgY29uc3QgbWVyZ2VCdWZmZXJzID0gcmVxdWlyZSgnLi9saWIvdXRpbHMvbWVyZ2VCdWZmZXJzJyk7XG4gIGNvbnN0IGludGVybGVhdmUgPSByZXF1aXJlKCcuL2xpYi91dGlscy9pbnRlcmxlYXZlJyk7XG4gIGNvbnN0IGRvd25zYW1wbGVCdWZmZXIgPSByZXF1aXJlKCcuL2xpYi91dGlscy9kb3duc2FtcGxlQnVmZmVyJyk7XG5cbiAgaWYgKCFuYXZpZ2F0b3IuZ2V0VXNlck1lZGlhKSB7XG4gICAgbmF2aWdhdG9yLmdldFVzZXJNZWRpYSA9IG5hdmlnYXRvci5nZXRVc2VyTWVkaWEgfHwgbmF2aWdhdG9yLndlYmtpdEdldFVzZXJNZWRpYSB8fFxuICAgICAgbmF2aWdhdG9yLm1vekdldFVzZXJNZWRpYSB8fCBuYXZpZ2F0b3IubXNHZXRVc2VyTWVkaWE7XG4gIH1cblxuICBjbGFzcyBBVlMge1xuICAgIGNvbnN0cnVjdG9yKG9wdGlvbnMgPSB7fSkge1xuICAgICAgT2JzZXJ2YWJsZSh0aGlzKTtcblxuICAgICAgdGhpcy5fYnVmZmVyU2l6ZSA9IDIwNDg7XG4gICAgICB0aGlzLl9pbnB1dENoYW5uZWxzID0gMTtcbiAgICAgIHRoaXMuX291dHB1dENoYW5uZWxzID0gMTtcbiAgICAgIHRoaXMuX2xlZnRDaGFubmVsID0gW107XG4gICAgICB0aGlzLl9yaWdodENoYW5uZWwgPSBbXTtcbiAgICAgIHRoaXMuX2F1ZGlvQ29udGV4dCA9IG51bGw7XG4gICAgICB0aGlzLl9yZWNvcmRlciA9IG51bGw7XG4gICAgICB0aGlzLl9zYW1wbGVSYXRlID0gbnVsbDtcbiAgICAgIHRoaXMuX291dHB1dFNhbXBsZVJhdGUgPSAxNjAwMDtcbiAgICAgIHRoaXMuX2F1ZGlvSW5wdXQgPSBudWxsO1xuICAgICAgdGhpcy5fdm9sdW1lTm9kZSA9IG51bGw7XG4gICAgICB0aGlzLl9kZWJ1ZyA9IGZhbHNlO1xuICAgICAgdGhpcy5fdG9rZW4gPSBudWxsO1xuICAgICAgdGhpcy5fcmVmcmVzaFRva2VuID0gbnVsbDtcbiAgICAgIHRoaXMuX2NsaWVudElkID0gbnVsbDtcbiAgICAgIHRoaXMuX2NsaWVudFNlY3JldCA9IG51bGw7XG4gICAgICB0aGlzLl9kZXZpY2VJZD0gbnVsbDtcbiAgICAgIHRoaXMuX2RldmljZVNlcmlhbE51bWJlciA9IG51bGw7XG4gICAgICB0aGlzLl9yZWRpcmVjdFVyaSA9IG51bGw7XG4gICAgICB0aGlzLl9hdWRpb1F1ZXVlID0gW107XG5cbiAgICAgIGlmIChvcHRpb25zLnRva2VuKSB7XG4gICAgICAgIHRoaXMuc2V0VG9rZW4ob3B0aW9ucy50b2tlbik7XG4gICAgICB9XG5cbiAgICAgIGlmIChvcHRpb25zLnJlZnJlc2hUb2tlbikge1xuICAgICAgICB0aGlzLnNldFJlZnJlc2hUb2tlbihvcHRpb25zLnJlZnJlc2hUb2tlbik7XG4gICAgICB9XG5cbiAgICAgIGlmIChvcHRpb25zLmNsaWVudElkKSB7XG4gICAgICAgIHRoaXMuc2V0Q2xpZW50SWQob3B0aW9ucy5jbGllbnRJZCk7XG4gICAgICB9XG5cbiAgICAgIGlmIChvcHRpb25zLmNsaWVudFNlY3JldCkge1xuICAgICAgICB0aGlzLnNldENsaWVudFNlY3JldChvcHRpb25zLmNsaWVudFNlY3JldCk7XG4gICAgICB9XG5cbiAgICAgIGlmIChvcHRpb25zLmRldmljZUlkKSB7XG4gICAgICAgIHRoaXMuc2V0RGV2aWNlSWQob3B0aW9ucy5kZXZpY2VJZCk7XG4gICAgICB9XG5cbiAgICAgIGlmIChvcHRpb25zLmRldmljZVNlcmlhbE51bWJlcikge1xuICAgICAgICB0aGlzLnNldERldmljZVNlcmlhbE51bWJlcihvcHRpb25zLmRldmljZVNlcmlhbE51bWJlcik7XG4gICAgICB9XG5cbiAgICAgIGlmIChvcHRpb25zLnJlZGlyZWN0VXJpKSB7XG4gICAgICAgIHRoaXMuc2V0UmVkaXJlY3RVcmkob3B0aW9ucy5yZWRpcmVjdFVyaSk7XG4gICAgICB9XG5cbiAgICAgIGlmIChvcHRpb25zLmRlYnVnKSB7XG4gICAgICAgIHRoaXMuc2V0RGVidWcob3B0aW9ucy5kZWJ1Zyk7XG4gICAgICB9XG5cbiAgICAgIHRoaXMucGxheWVyID0gbmV3IFBsYXllcigpO1xuICAgIH1cblxuICAgIF9sb2codHlwZSwgbWVzc2FnZSkge1xuICAgICAgaWYgKHR5cGUgJiYgIW1lc3NhZ2UpIHtcbiAgICAgICAgbWVzc2FnZSA9IHR5cGU7XG4gICAgICAgIHR5cGUgPSAnbG9nJztcbiAgICAgIH1cblxuICAgICAgc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgIHRoaXMuZW1pdChBVlMuRXZlbnRUeXBlcy5MT0csIG1lc3NhZ2UpO1xuICAgICAgfSwgMCk7XG5cbiAgICAgIGlmICh0aGlzLl9kZWJ1Zykge1xuICAgICAgICBjb25zb2xlW3R5cGVdKG1lc3NhZ2UpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGxvZ2luKG9wdGlvbnMgPSB7fSkge1xuICAgICAgcmV0dXJuIHRoaXMucHJvbXB0VXNlckxvZ2luKG9wdGlvbnMpO1xuICAgIH1cblxuICAgIGxvZ291dCgpIHtcbiAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgIHRoaXMuX3Rva2VuID0gbnVsbDtcbiAgICAgICAgdGhpcy5fcmVmcmVzaFRva2VuID0gbnVsbDtcbiAgICAgICAgdGhpcy5lbWl0KEFWUy5FdmVudFR5cGVzLkxPR09VVCk7XG4gICAgICAgIHRoaXMuX2xvZygnTG9nZ2VkIG91dCcpO1xuICAgICAgICByZXNvbHZlKCk7XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBwcm9tcHRVc2VyTG9naW4ob3B0aW9ucyA9IHtyZXNwb25zZVR5cGU6ICd0b2tlbicsIG5ld1dpbmRvdzogZmFsc2V9KSB7XG4gICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICBpZiAodHlwZW9mIG9wdGlvbnMucmVzcG9uc2VUeXBlID09PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgIG9wdGlvbnMucmVzcG9uc2VUeXBlID0gJ3Rva2VuJztcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0eXBlb2Ygb3B0aW9ucy5yZXNwb25zZVR5cGUgIT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgY29uc3QgZXJyb3IgPSBuZXcgRXJyb3IoJ2ByZXNwb25zZVR5cGVgIG11c3QgYSBzdHJpbmcuJyk7XG4gICAgICAgICAgdGhpcy5fbG9nKGVycm9yKTtcbiAgICAgICAgICByZXR1cm4gcmVqZWN0KGVycm9yKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IG5ld1dpbmRvdyA9ICEhb3B0aW9ucy5uZXdXaW5kb3c7XG5cbiAgICAgICAgY29uc3QgcmVzcG9uc2VUeXBlID0gb3B0aW9ucy5yZXNwb25zZVR5cGU7XG5cbiAgICAgICAgaWYgKCEocmVzcG9uc2VUeXBlID09PSAnY29kZScgfHwgcmVzcG9uc2VUeXBlID09PSAndG9rZW4nKSkge1xuICAgICAgICAgIGNvbnN0IGVycm9yID0gbmV3IEVycm9yKCdgcmVzcG9uc2VUeXBlYCBtdXN0IGJlIGVpdGhlciBgY29kZWAgb3IgYHRva2VuYC4nKTtcbiAgICAgICAgICB0aGlzLl9sb2coZXJyb3IpO1xuICAgICAgICAgIHJldHVybiByZWplY3QoZXJyb3IpO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3Qgc2NvcGUgPSAnYWxleGE6YWxsJztcbiAgICAgICAgY29uc3Qgc2NvcGVEYXRhID0ge1xuICAgICAgICAgIFtzY29wZV06IHtcbiAgICAgICAgICAgIHByb2R1Y3RJRDogdGhpcy5fZGV2aWNlSWQsXG4gICAgICAgICAgICBwcm9kdWN0SW5zdGFuY2VBdHRyaWJ1dGVzOiB7XG4gICAgICAgICAgICAgIGRldmljZVNlcmlhbE51bWJlcjogdGhpcy5fZGV2aWNlU2VyaWFsTnVtYmVyXG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9O1xuXG4gICAgICAgIGNvbnN0IGF1dGhVcmwgPSBgaHR0cHM6Ly93d3cuYW1hem9uLmNvbS9hcC9vYT9jbGllbnRfaWQ9JHt0aGlzLl9jbGllbnRJZH0mc2NvcGU9JHtlbmNvZGVVUklDb21wb25lbnQoc2NvcGUpfSZzY29wZV9kYXRhPSR7ZW5jb2RlVVJJQ29tcG9uZW50KEpTT04uc3RyaW5naWZ5KHNjb3BlRGF0YSkpfSZyZXNwb25zZV90eXBlPSR7cmVzcG9uc2VUeXBlfSZyZWRpcmVjdF91cmk9JHtlbmNvZGVVUkkodGhpcy5fcmVkaXJlY3RVcmkpfWBcblxuICAgICAgICBpZiAobmV3V2luZG93KSB7XG4gICAgICAgICAgd2luZG93Lm9wZW4oYXV0aFVybCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgd2luZG93LmxvY2F0aW9uLmhyZWYgPSBhdXRoVXJsO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBnZXRUb2tlbkZyb21Db2RlKGNvZGUpIHtcbiAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgIGlmICh0eXBlb2YgY29kZSAhPT0gJ3N0cmluZycpIHtcbiAgICAgICAgICBjb25zdCBlcnJvciA9IG5ldyBUeXBlRXJyb3IoJ2Bjb2RlYCBtdXN0IGJlIGEgc3RyaW5nLicpO1xuICAgICAgICAgIHRoaXMuX2xvZyhlcnJvcik7XG4gICAgICAgICAgcmV0dXJuIHJlamVjdChlcnJvcik7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBncmFudFR5cGUgPSAnYXV0aG9yaXphdGlvbl9jb2RlJztcbiAgICAgICAgY29uc3QgcG9zdERhdGEgPSBgZ3JhbnRfdHlwZT0ke2dyYW50VHlwZX0mY29kZT0ke2NvZGV9JmNsaWVudF9pZD0ke3RoaXMuX2NsaWVudElkfSZjbGllbnRfc2VjcmV0PSR7dGhpcy5fY2xpZW50U2VjcmV0fSZyZWRpcmVjdF91cmk9JHtlbmNvZGVVUklDb21wb25lbnQodGhpcy5fcmVkaXJlY3RVcmkpfWA7XG4gICAgICAgIGNvbnN0IHVybCA9ICdodHRwczovL2FwaS5hbWF6b24uY29tL2F1dGgvbzIvdG9rZW4nO1xuXG4gICAgICAgIGNvbnN0IHhociA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xuXG4gICAgICAgIHhoci5vcGVuKCdQT1NUJywgdXJsLCB0cnVlKTtcbiAgICAgICAgeGhyLnNldFJlcXVlc3RIZWFkZXIoJ0NvbnRlbnQtVHlwZScsICdhcHBsaWNhdGlvbi94LXd3dy1mb3JtLXVybGVuY29kZWQ7Y2hhcnNldD1VVEYtOCcpO1xuICAgICAgICB4aHIub25sb2FkID0gKGV2ZW50KSA9PiB7XG4gICAgICAgICAgY29uc29sZS5sb2coJ1JFU1BPTlNFJywgeGhyLnJlc3BvbnNlKTtcblxuICAgICAgICAgIGxldCByZXNwb25zZSA9IHhoci5yZXNwb25zZTtcblxuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICByZXNwb25zZSA9IEpTT04ucGFyc2UoeGhyLnJlc3BvbnNlKTtcbiAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgdGhpcy5fbG9nKGVycm9yKTtcbiAgICAgICAgICAgIHJldHVybiByZWplY3QoZXJyb3IpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGNvbnN0IGlzT2JqZWN0ID0gcmVzcG9uc2UgaW5zdGFuY2VvZiBPYmplY3Q7XG4gICAgICAgICAgY29uc3QgZXJyb3JEZXNjcmlwdGlvbiA9IGlzT2JqZWN0ICYmIHJlc3BvbnNlLmVycm9yX2Rlc2NyaXB0aW9uO1xuXG4gICAgICAgICAgaWYgKGVycm9yRGVzY3JpcHRpb24pIHtcbiAgICAgICAgICAgIGNvbnN0IGVycm9yID0gbmV3IEVycm9yKGVycm9yRGVzY3JpcHRpb24pO1xuICAgICAgICAgICAgdGhpcy5fbG9nKGVycm9yKTtcbiAgICAgICAgICAgIHJldHVybiByZWplY3QoZXJyb3IpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGNvbnN0IHRva2VuID0gcmVzcG9uc2UuYWNjZXNzX3Rva2VuO1xuICAgICAgICAgIGNvbnN0IHJlZnJlc2hUb2tlbiA9IHJlc3BvbnNlLnJlZnJlc2hfdG9rZW47XG4gICAgICAgICAgY29uc3QgdG9rZW5UeXBlID0gcmVzcG9uc2UudG9rZW5fdHlwZTtcbiAgICAgICAgICBjb25zdCBleHBpcmVzSW4gPSByZXNwb25zZS5leHBpcmVzSW47XG5cbiAgICAgICAgICB0aGlzLnNldFRva2VuKHRva2VuKVxuICAgICAgICAgIHRoaXMuc2V0UmVmcmVzaFRva2VuKHJlZnJlc2hUb2tlbilcblxuICAgICAgICAgIHRoaXMuZW1pdChBVlMuRXZlbnRUeXBlcy5MT0dJTik7XG4gICAgICAgICAgdGhpcy5fbG9nKCdMb2dnZWQgaW4uJyk7XG4gICAgICAgICAgcmVzb2x2ZShyZXNwb25zZSk7XG4gICAgICAgIH07XG5cbiAgICAgICAgeGhyLm9uZXJyb3IgPSAoZXJyb3IpID0+IHtcbiAgICAgICAgICB0aGlzLl9sb2coZXJyb3IpO1xuICAgICAgICAgIHJlamVjdChlcnJvcik7XG4gICAgICAgIH07XG5cbiAgICAgICAgeGhyLnNlbmQocG9zdERhdGEpO1xuICAgICAgfSk7XG4gICAgfVxuXG4gICAgcmVmcmVzaFRva2VuKCkge1xuICAgICAgcmV0dXJuIHRoaXMuZ2V0VG9rZW5Gcm9tUmVmcmVzaFRva2VuKHRoaXMuX3JlZnJlc2hUb2tlbilcbiAgICAgICAgICAgICAgLnRoZW4oKCkgPT4ge1xuICAgICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICB0b2tlbjogdGhpcy5fdG9rZW4sXG4gICAgICAgICAgICAgICAgICByZWZyZXNoVG9rZW46IHRoaXMuX3JlZnJlc2hUb2tlblxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgIH0pO1xuICAgIH1cblxuICAgIGdldFRva2VuRnJvbVJlZnJlc2hUb2tlbihyZWZyZXNoVG9rZW4gPSB0aGlzLl9yZWZyZXNoVG9rZW4pIHtcbiAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgIGlmICh0eXBlb2YgcmVmcmVzaFRva2VuICE9PSAnc3RyaW5nJykge1xuICAgICAgICAgIGNvbnN0IGVycm9yID0gbmV3IEVycm9yKCdgcmVmcmVzaFRva2VuYCBtdXN0IGEgc3RyaW5nLicpO1xuICAgICAgICAgIHRoaXMuX2xvZyhlcnJvcik7XG4gICAgICAgICAgcmV0dXJuIHJlamVjdChlcnJvcik7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBncmFudFR5cGUgPSAncmVmcmVzaF90b2tlbic7XG4gICAgICAgIGNvbnN0IHBvc3REYXRhID0gYGdyYW50X3R5cGU9JHtncmFudFR5cGV9JnJlZnJlc2hfdG9rZW49JHtyZWZyZXNoVG9rZW59JmNsaWVudF9pZD0ke3RoaXMuX2NsaWVudElkfSZjbGllbnRfc2VjcmV0PSR7dGhpcy5fY2xpZW50U2VjcmV0fSZyZWRpcmVjdF91cmk9JHtlbmNvZGVVUklDb21wb25lbnQodGhpcy5fcmVkaXJlY3RVcmkpfWA7XG4gICAgICAgIGNvbnN0IHVybCA9ICdodHRwczovL2FwaS5hbWF6b24uY29tL2F1dGgvbzIvdG9rZW4nO1xuICAgICAgICBjb25zdCB4aHIgPSBuZXcgWE1MSHR0cFJlcXVlc3QoKTtcblxuICAgICAgICB4aHIub3BlbignUE9TVCcsIHVybCwgdHJ1ZSk7XG4gICAgICAgIHhoci5zZXRSZXF1ZXN0SGVhZGVyKCdDb250ZW50LVR5cGUnLCAnYXBwbGljYXRpb24veC13d3ctZm9ybS11cmxlbmNvZGVkO2NoYXJzZXQ9VVRGLTgnKTtcbiAgICAgICAgeGhyLnJlc3BvbnNlVHlwZSA9ICdqc29uJztcbiAgICAgICAgeGhyLm9ubG9hZCA9IChldmVudCkgPT4ge1xuICAgICAgICAgIGNvbnN0IHJlc3BvbnNlID0geGhyLnJlc3BvbnNlO1xuXG4gICAgICAgICAgaWYgKHJlc3BvbnNlLmVycm9yKSB7XG4gICAgICAgICAgICBjb25zdCBlcnJvciA9IHJlc3BvbnNlLmVycm9yLm1lc3NhZ2U7XG4gICAgICAgICAgICB0aGlzLmVtaXQoQVZTLkV2ZW50VHlwZXMuRVJST1IsIGVycm9yKTtcblxuICAgICAgICAgICAgcmV0dXJuIHJlamVjdChlcnJvcik7XG4gICAgICAgICAgfSBlbHNlICB7XG4gICAgICAgICAgICBjb25zdCB0b2tlbiA9IHJlc3BvbnNlLmFjY2Vzc190b2tlbjtcbiAgICAgICAgICAgIGNvbnN0IHJlZnJlc2hUb2tlbiA9IHJlc3BvbnNlLnJlZnJlc2hfdG9rZW47XG5cbiAgICAgICAgICAgIHRoaXMuc2V0VG9rZW4odG9rZW4pO1xuICAgICAgICAgICAgdGhpcy5zZXRSZWZyZXNoVG9rZW4ocmVmcmVzaFRva2VuKTtcblxuICAgICAgICAgICAgcmV0dXJuIHJlc29sdmUodG9rZW4pO1xuICAgICAgICAgIH1cbiAgICAgICAgfTtcblxuICAgICAgICB4aHIub25lcnJvciA9IChlcnJvcikgPT4ge1xuICAgICAgICAgIHRoaXMuX2xvZyhlcnJvcik7XG4gICAgICAgICAgcmVqZWN0KGVycm9yKTtcbiAgICAgICAgfTtcblxuICAgICAgICB4aHIuc2VuZChwb3N0RGF0YSk7XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBnZXRUb2tlbkZyb21VcmwoKSB7XG4gICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICBsZXQgaGFzaCA9IHdpbmRvdy5sb2NhdGlvbi5oYXNoLnN1YnN0cigxKTtcblxuICAgICAgICBjb25zdCBxdWVyeSA9IHFzLnBhcnNlKGhhc2gpO1xuICAgICAgICBjb25zdCB0b2tlbiA9IHF1ZXJ5LmFjY2Vzc190b2tlbjtcbiAgICAgICAgY29uc3QgcmVmcmVzaFRva2VuID0gcXVlcnkucmVmcmVzaF90b2tlbjtcbiAgICAgICAgY29uc3QgdG9rZW5UeXBlID0gcXVlcnkudG9rZW5fdHlwZTtcbiAgICAgICAgY29uc3QgZXhwaXJlc0luID0gcXVlcnkuZXhwaXJlc0luO1xuXG4gICAgICAgIGlmICh0b2tlbikge1xuICAgICAgICAgIHRoaXMuc2V0VG9rZW4odG9rZW4pXG4gICAgICAgICAgdGhpcy5lbWl0KEFWUy5FdmVudFR5cGVzLkxPR0lOKTtcbiAgICAgICAgICB0aGlzLl9sb2coJ0xvZ2dlZCBpbi4nKTtcblxuICAgICAgICAgIGlmIChyZWZyZXNoVG9rZW4pIHtcbiAgICAgICAgICAgIHRoaXMuc2V0UmVmcmVzaFRva2VuKHJlZnJlc2hUb2tlbik7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgcmV0dXJuIHJlc29sdmUodG9rZW4pO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHJlamVjdCgpO1xuICAgICAgfSk7XG4gICAgfVxuXG4gICAgZ2V0Q29kZUZyb21VcmwoKSB7XG4gICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICBjb25zdCBxdWVyeSA9IHFzLnBhcnNlKHdpbmRvdy5sb2NhdGlvbi5zZWFyY2guc3Vic3RyKDEpKTtcbiAgICAgICAgY29uc3QgY29kZSA9IHF1ZXJ5LmNvZGU7XG5cbiAgICAgICAgaWYgKGNvZGUpIHtcbiAgICAgICAgICByZXR1cm4gcmVzb2x2ZShjb2RlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiByZWplY3QobnVsbCk7XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBzZXRUb2tlbih0b2tlbikge1xuICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgaWYgKHR5cGVvZiB0b2tlbiA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICB0aGlzLl90b2tlbiA9IHRva2VuO1xuICAgICAgICAgIHRoaXMuZW1pdChBVlMuRXZlbnRUeXBlcy5UT0tFTl9TRVQpO1xuICAgICAgICAgIHRoaXMuX2xvZygnVG9rZW4gc2V0LicpO1xuICAgICAgICAgIHJlc29sdmUodGhpcy5fdG9rZW4pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGNvbnN0IGVycm9yID0gbmV3IFR5cGVFcnJvcignYHRva2VuYCBtdXN0IGJlIGEgc3RyaW5nLicpO1xuICAgICAgICAgIHRoaXMuX2xvZyhlcnJvcik7XG4gICAgICAgICAgcmVqZWN0KGVycm9yKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgc2V0UmVmcmVzaFRva2VuKHJlZnJlc2hUb2tlbikge1xuICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgaWYgKHR5cGVvZiByZWZyZXNoVG9rZW4gPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgdGhpcy5fcmVmcmVzaFRva2VuID0gcmVmcmVzaFRva2VuO1xuICAgICAgICAgIHRoaXMuZW1pdChBVlMuRXZlbnRUeXBlcy5SRUZSRVNIX1RPS0VOX1NFVCk7XG4gICAgICAgICAgdGhpcy5fbG9nKCdSZWZyZXNoIHRva2VuIHNldC4nKTtcbiAgICAgICAgICByZXNvbHZlKHRoaXMuX3JlZnJlc2hUb2tlbik7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgY29uc3QgZXJyb3IgPSBuZXcgVHlwZUVycm9yKCdgcmVmcmVzaFRva2VuYCBtdXN0IGJlIGEgc3RyaW5nLicpO1xuICAgICAgICAgIHRoaXMuX2xvZyhlcnJvcik7XG4gICAgICAgICAgcmVqZWN0KGVycm9yKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgc2V0Q2xpZW50SWQoY2xpZW50SWQpIHtcbiAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgIGlmICh0eXBlb2YgY2xpZW50SWQgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgdGhpcy5fY2xpZW50SWQgPSBjbGllbnRJZDtcbiAgICAgICAgICByZXNvbHZlKHRoaXMuX2NsaWVudElkKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBjb25zdCBlcnJvciA9IG5ldyBUeXBlRXJyb3IoJ2BjbGllbnRJZGAgbXVzdCBiZSBhIHN0cmluZy4nKTtcbiAgICAgICAgICB0aGlzLl9sb2coZXJyb3IpO1xuICAgICAgICAgIHJlamVjdChlcnJvcik7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH1cblxuICAgIHNldENsaWVudFNlY3JldChjbGllbnRTZWNyZXQpIHtcbiAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgIGlmICh0eXBlb2YgY2xpZW50U2VjcmV0ID09PSAnc3RyaW5nJykge1xuICAgICAgICAgIHRoaXMuX2NsaWVudFNlY3JldCA9IGNsaWVudFNlY3JldDtcbiAgICAgICAgICByZXNvbHZlKHRoaXMuX2NsaWVudFNlY3JldCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgY29uc3QgZXJyb3IgPSBuZXcgVHlwZUVycm9yKCdgY2xpZW50U2VjcmV0YCBtdXN0IGJlIGEgc3RyaW5nJyk7XG4gICAgICAgICAgdGhpcy5fbG9nKGVycm9yKTtcbiAgICAgICAgICByZWplY3QoZXJyb3IpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBzZXREZXZpY2VJZChkZXZpY2VJZCkge1xuICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgaWYgKHR5cGVvZiBkZXZpY2VJZCA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICB0aGlzLl9kZXZpY2VJZCA9IGRldmljZUlkO1xuICAgICAgICAgIHJlc29sdmUodGhpcy5fZGV2aWNlSWQpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGNvbnN0IGVycm9yID0gbmV3IFR5cGVFcnJvcignYGRldmljZUlkYCBtdXN0IGJlIGEgc3RyaW5nLicpO1xuICAgICAgICAgIHRoaXMuX2xvZyhlcnJvcik7XG4gICAgICAgICAgcmVqZWN0KGVycm9yKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgc2V0RGV2aWNlU2VyaWFsTnVtYmVyKGRldmljZVNlcmlhbE51bWJlcikge1xuICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgaWYgKHR5cGVvZiBkZXZpY2VTZXJpYWxOdW1iZXIgPT09ICdudW1iZXInIHx8IHR5cGVvZiBkZXZpY2VTZXJpYWxOdW1iZXIgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgdGhpcy5fZGV2aWNlU2VyaWFsTnVtYmVyID0gZGV2aWNlU2VyaWFsTnVtYmVyO1xuICAgICAgICAgIHJlc29sdmUodGhpcy5fZGV2aWNlU2VyaWFsTnVtYmVyKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBjb25zdCBlcnJvciA9IG5ldyBUeXBlRXJyb3IoJ2BkZXZpY2VTZXJpYWxOdW1iZXJgIG11c3QgYmUgYSBudW1iZXIgb3Igc3RyaW5nLicpO1xuICAgICAgICAgIHRoaXMuX2xvZyhlcnJvcik7XG4gICAgICAgICAgcmVqZWN0KGVycm9yKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgc2V0UmVkaXJlY3RVcmkocmVkaXJlY3RVcmkpIHtcbiAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgIGlmICh0eXBlb2YgcmVkaXJlY3RVcmkgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgdGhpcy5fcmVkaXJlY3RVcmkgPSByZWRpcmVjdFVyaTtcbiAgICAgICAgICByZXNvbHZlKHRoaXMuX3JlZGlyZWN0VXJpKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBjb25zdCBlcnJvciA9IG5ldyBUeXBlRXJyb3IoJ2ByZWRpcmVjdFVyaWAgbXVzdCBiZSBhIHN0cmluZy4nKTtcbiAgICAgICAgICB0aGlzLl9sb2coZXJyb3IpO1xuICAgICAgICAgIHJlamVjdChlcnJvcik7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH1cblxuICAgIHNldERlYnVnKGRlYnVnKSB7XG4gICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICBpZiAodHlwZW9mIGRlYnVnID09PSAnYm9vbGVhbicpIHtcbiAgICAgICAgICB0aGlzLl9kZWJ1ZyA9IGRlYnVnO1xuICAgICAgICAgIHJlc29sdmUodGhpcy5fZGVidWcpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGNvbnN0IGVycm9yID0gbmV3IFR5cGVFcnJvcignYGRlYnVnYCBtdXN0IGJlIGEgYm9vbGVhbi4nKTtcbiAgICAgICAgICB0aGlzLl9sb2coZXJyb3IpO1xuICAgICAgICAgIHJlamVjdChlcnJvcik7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH1cblxuICAgIGdldFRva2VuKCkge1xuICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgY29uc3QgdG9rZW4gPSB0aGlzLl90b2tlbjtcblxuICAgICAgICBpZiAodG9rZW4pIHtcbiAgICAgICAgICByZXR1cm4gcmVzb2x2ZSh0b2tlbik7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gcmVqZWN0KCk7XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBnZXRSZWZyZXNoVG9rZW4oKSB7XG4gICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICBjb25zdCByZWZyZXNoVG9rZW4gPSB0aGlzLl9yZWZyZXNoVG9rZW47XG5cbiAgICAgICAgaWYgKHJlZnJlc2hUb2tlbikge1xuICAgICAgICAgIHJldHVybiByZXNvbHZlKHJlZnJlc2hUb2tlbik7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gcmVqZWN0KCk7XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICByZXF1ZXN0TWljKCkge1xuICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgdGhpcy5fbG9nKCdSZXF1ZXN0aW5nIG1pY3JvcGhvbmUuJyk7XG4gICAgICAgIG5hdmlnYXRvci5nZXRVc2VyTWVkaWEoe1xuICAgICAgICAgICAgYXVkaW86IHRydWVcbiAgICAgICAgfSwgKHN0cmVhbSkgPT4ge1xuICAgICAgICAgICAgdGhpcy5fbG9nKCdNaWNyb3Bob25lIGNvbm5lY3RlZC4nKTtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmNvbm5lY3RNZWRpYVN0cmVhbShzdHJlYW0pLnRoZW4oKCkgPT4ge1xuICAgICAgICAgICAgICByZXR1cm4gcmVzb2x2ZShzdHJlYW0pO1xuICAgICAgICB9KX0sIChlcnJvcikgPT4ge1xuICAgICAgICAgIHRoaXMuX2xvZygnZXJyb3InLCBlcnJvcik7XG4gICAgICAgICAgdGhpcy5lbWl0KEFWUy5FdmVudFR5cGVzLkVSUk9SLCBlcnJvcik7XG4gICAgICAgICAgcmV0dXJuIHJlamVjdChlcnJvcik7XG4gICAgICAgIH0pO1xuICAgICAgfSk7XG4gICAgfVxuXG4gICAgY29ubmVjdE1lZGlhU3RyZWFtKHN0cmVhbSkge1xuICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgY29uc3QgaXNNZWRpYVN0cmVhbSA9IE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChzdHJlYW0pID09PSAnW29iamVjdCBNZWRpYVN0cmVhbV0nO1xuXG4gICAgICAgIGlmICghaXNNZWRpYVN0cmVhbSkge1xuICAgICAgICAgIGNvbnN0IGVycm9yID0gbmV3IFR5cGVFcnJvcignQXJndW1lbnQgbXVzdCBiZSBhIGBNZWRpYVN0cmVhbWAgb2JqZWN0LicpXG4gICAgICAgICAgdGhpcy5fbG9nKCdlcnJvcicsIGVycm9yKVxuICAgICAgICAgIHRoaXMuZW1pdChBVlMuRXZlbnRUeXBlcy5FUlJPUiwgZXJyb3IpO1xuICAgICAgICAgIHJldHVybiByZWplY3QoZXJyb3IpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fYXVkaW9Db250ZXh0ID0gbmV3IEF1ZGlvQ29udGV4dCgpO1xuICAgICAgICB0aGlzLl9zYW1wbGVSYXRlID0gdGhpcy5fYXVkaW9Db250ZXh0LnNhbXBsZVJhdGU7XG5cbiAgICAgICAgdGhpcy5fbG9nKGBTYW1wbGUgcmF0ZTogJHt0aGlzLl9zYW1wbGVSYXRlfS5gKTtcblxuICAgICAgICB0aGlzLl92b2x1bWVOb2RlID0gdGhpcy5fYXVkaW9Db250ZXh0LmNyZWF0ZUdhaW4oKTtcbiAgICAgICAgdGhpcy5fYXVkaW9JbnB1dCA9IHRoaXMuX2F1ZGlvQ29udGV4dC5jcmVhdGVNZWRpYVN0cmVhbVNvdXJjZShzdHJlYW0pO1xuXG4gICAgICAgIHRoaXMuX2F1ZGlvSW5wdXQuY29ubmVjdCh0aGlzLl92b2x1bWVOb2RlKTtcblxuICAgICAgICB0aGlzLl9yZWNvcmRlciA9IHRoaXMuX2F1ZGlvQ29udGV4dC5jcmVhdGVTY3JpcHRQcm9jZXNzb3IodGhpcy5fYnVmZmVyU2l6ZSwgdGhpcy5faW5wdXRDaGFubmVscywgdGhpcy5fb3V0cHV0Q2hhbm5lbHMpO1xuXG4gICAgICAgIHRoaXMuX3JlY29yZGVyLm9uYXVkaW9wcm9jZXNzID0gKGV2ZW50KSA9PiB7XG4gICAgICAgICAgICBpZiAoIXRoaXMuX2lzUmVjb3JkaW5nKSB7XG4gICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3QgbGVmdCA9IGV2ZW50LmlucHV0QnVmZmVyLmdldENoYW5uZWxEYXRhKDApO1xuICAgICAgICAgICAgdGhpcy5fbGVmdENoYW5uZWwucHVzaChuZXcgRmxvYXQzMkFycmF5KGxlZnQpKTtcblxuICAgICAgICAgICAgaWYgKHRoaXMuX2lucHV0Q2hhbm5lbHMgPiAxKSB7XG4gICAgICAgICAgICAgIGNvbnN0IHJpZ2h0ID0gZXZlbnQuaW5wdXRCdWZmZXIuZ2V0Q2hhbm5lbERhdGEoMSk7XG4gICAgICAgICAgICAgIHRoaXMuX3JpZ2h0Q2hhbm5lbC5wdXNoKG5ldyBGbG9hdDMyQXJyYXkocmlnaHQpKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpcy5fcmVjb3JkaW5nTGVuZ3RoICs9IHRoaXMuX2J1ZmZlclNpemU7XG4gICAgICAgIH07XG5cbiAgICAgICAgdGhpcy5fdm9sdW1lTm9kZS5jb25uZWN0KHRoaXMuX3JlY29yZGVyKTtcbiAgICAgICAgdGhpcy5fcmVjb3JkZXIuY29ubmVjdCh0aGlzLl9hdWRpb0NvbnRleHQuZGVzdGluYXRpb24pO1xuICAgICAgICB0aGlzLl9sb2coYE1lZGlhIHN0cmVhbSBjb25uZWN0ZWQuYCk7XG5cbiAgICAgICAgcmV0dXJuIHJlc29sdmUoKTtcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIHN0YXJ0UmVjb3JkaW5nKCkge1xuICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgaWYgKCF0aGlzLl9hdWRpb0lucHV0KSB7XG4gICAgICAgICAgY29uc3QgZXJyb3IgPSBuZXcgRXJyb3IoJ05vIE1lZGlhIFN0cmVhbSBjb25uZWN0ZWQuJyk7XG4gICAgICAgICAgdGhpcy5fbG9nKCdlcnJvcicsIGVycm9yKTtcbiAgICAgICAgICB0aGlzLmVtaXQoQVZTLkV2ZW50VHlwZXMuRVJST1IsIGVycm9yKTtcbiAgICAgICAgICByZXR1cm4gcmVqZWN0KGVycm9yKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX2lzUmVjb3JkaW5nID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5fbGVmdENoYW5uZWwubGVuZ3RoID0gdGhpcy5fcmlnaHRDaGFubmVsLmxlbmd0aCA9IDA7XG4gICAgICAgIHRoaXMuX3JlY29yZGluZ0xlbmd0aCA9IDA7XG4gICAgICAgIHRoaXMuX2xvZyhgUmVjb3JkaW5nIHN0YXJ0ZWQuYCk7XG4gICAgICAgIHRoaXMuZW1pdChBVlMuRXZlbnRUeXBlcy5SRUNPUkRfU1RBUlQpO1xuXG4gICAgICAgIHJldHVybiByZXNvbHZlKCk7XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBzdG9wUmVjb3JkaW5nKCkge1xuICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgaWYgKCF0aGlzLl9pc1JlY29yZGluZykge1xuICAgICAgICAgIHRoaXMuZW1pdChBVlMuRXZlbnRUeXBlcy5SRUNPUkRfU1RPUCk7XG4gICAgICAgICAgdGhpcy5fbG9nKCdSZWNvcmRpbmcgc3RvcHBlZC4nKTtcbiAgICAgICAgICByZXR1cm4gcmVzb2x2ZSgpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5faXNSZWNvcmRpbmcgPSBmYWxzZTtcblxuICAgICAgICBjb25zdCBsZWZ0QnVmZmVyID0gbWVyZ2VCdWZmZXJzKHRoaXMuX2xlZnRDaGFubmVsLCB0aGlzLl9yZWNvcmRpbmdMZW5ndGgpO1xuICAgICAgICBsZXQgaW50ZXJsZWF2ZWQgPSBudWxsO1xuXG4gICAgICAgIGlmICh0aGlzLl9vdXRwdXRDaGFubmVscyA+IDEpIHtcbiAgICAgICAgICBjb25zdCByaWdodEJ1ZmZlciA9IG1lcmdlQnVmZmVycyh0aGlzLl9yaWdodENoYW5uZWwsIHRoaXMuX3JlY29yZGluZ0xlbmd0aCk7XG4gICAgICAgICAgaW50ZXJsZWF2ZWQgPSBpbnRlcmxlYXZlKGxlZnRCdWZmZXIsIHJpZ2h0QnVmZmVyKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBpbnRlcmxlYXZlZCA9IGludGVybGVhdmUobGVmdEJ1ZmZlcik7XG4gICAgICAgIH1cblxuICAgICAgICBpbnRlcmxlYXZlZCA9IGRvd25zYW1wbGVCdWZmZXIoaW50ZXJsZWF2ZWQsIHRoaXMuX3NhbXBsZVJhdGUsIHRoaXMuX291dHB1dFNhbXBsZVJhdGUpO1xuXG4gICAgICAgIGNvbnN0IGJ1ZmZlciA9IG5ldyBBcnJheUJ1ZmZlcig0NCArIGludGVybGVhdmVkLmxlbmd0aCAqIDIpO1xuICAgICAgICBjb25zdCB2aWV3ID0gbmV3IERhdGFWaWV3KGJ1ZmZlcik7XG5cbiAgICAgIC8qKlxuICAgICAgICogQGNyZWRpdCBodHRwczovL2dpdGh1Yi5jb20vbWF0dGRpYW1vbmQvUmVjb3JkZXJqc1xuICAgICAgICovXG4gICAgICAgIHdyaXRlVVRGQnl0ZXModmlldywgMCwgJ1JJRkYnKTtcbiAgICAgICAgdmlldy5zZXRVaW50MzIoNCwgNDQgKyBpbnRlcmxlYXZlZC5sZW5ndGggKiAyLCB0cnVlKTtcbiAgICAgICAgd3JpdGVVVEZCeXRlcyh2aWV3LCA4LCAnV0FWRScpO1xuICAgICAgICB3cml0ZVVURkJ5dGVzKHZpZXcsIDEyLCAnZm10ICcpO1xuICAgICAgICB2aWV3LnNldFVpbnQzMigxNiwgMTYsIHRydWUpO1xuICAgICAgICB2aWV3LnNldFVpbnQxNigyMCwgMSwgdHJ1ZSk7XG4gICAgICAgIHZpZXcuc2V0VWludDE2KDIyLCB0aGlzLl9vdXRwdXRDaGFubmVscywgdHJ1ZSk7XG4gICAgICAgIHZpZXcuc2V0VWludDMyKDI0LCB0aGlzLl9vdXRwdXRTYW1wbGVSYXRlLCB0cnVlKTtcbiAgICAgICAgdmlldy5zZXRVaW50MzIoMjgsIHRoaXMuX291dHB1dFNhbXBsZVJhdGUgKiA0LCB0cnVlKTtcbiAgICAgICAgdmlldy5zZXRVaW50MTYoMzIsIDQsIHRydWUpO1xuICAgICAgICB2aWV3LnNldFVpbnQxNigzNCwgMTYsIHRydWUpO1xuICAgICAgICB3cml0ZVVURkJ5dGVzKHZpZXcsIDM2LCAnZGF0YScpO1xuICAgICAgICB2aWV3LnNldFVpbnQzMig0MCwgaW50ZXJsZWF2ZWQubGVuZ3RoICogMiwgdHJ1ZSk7XG5cbiAgICAgICAgY29uc3QgbGVuZ3RoID0gaW50ZXJsZWF2ZWQubGVuZ3RoO1xuICAgICAgICBjb25zdCB2b2x1bWUgPSAxO1xuICAgICAgICBsZXQgaW5kZXggPSA0NDtcblxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGxlbmd0aDsgaSsrKXtcbiAgICAgICAgICB2aWV3LnNldEludDE2KGluZGV4LCBpbnRlcmxlYXZlZFtpXSAqICgweDdGRkYgKiB2b2x1bWUpLCB0cnVlKTtcbiAgICAgICAgICBpbmRleCArPSAyO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fbG9nKGBSZWNvcmRpbmcgc3RvcHBlZC5gKTtcbiAgICAgICAgdGhpcy5lbWl0KEFWUy5FdmVudFR5cGVzLlJFQ09SRF9TVE9QKTtcbiAgICAgICAgcmV0dXJuIHJlc29sdmUodmlldyk7XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBzZW5kQXVkaW8gKGRhdGFWaWV3KSB7XG4gICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICBjb25zdCB4aHIgPSBuZXcgWE1MSHR0cFJlcXVlc3QoKTtcbiAgICAgICAgY29uc3QgdXJsID0gJ2h0dHBzOi8vYWNjZXNzLWFsZXhhLW5hLmFtYXpvbi5jb20vdjEvYXZzL3NwZWVjaHJlY29nbml6ZXIvcmVjb2duaXplJztcblxuICAgICAgICB4aHIub3BlbignUE9TVCcsIHVybCwgdHJ1ZSk7XG4gICAgICAgIHhoci5yZXNwb25zZVR5cGUgPSAnYXJyYXlidWZmZXInO1xuICAgICAgICB4aHIub25sb2FkID0gKGV2ZW50KSA9PiB7XG4gICAgICAgICAgY29uc29sZS5sb2coJ1JFU1BPTlNFJywgeGhyLnJlc3BvbnNlKTtcblxuICAgICAgICAgIGNvbnN0IGJ1ZmZlciA9IG5ldyBCdWZmZXIoeGhyLnJlc3BvbnNlKTtcblxuICAgICAgICAgIGlmICh4aHIuc3RhdHVzID09PSAyMDApIHtcbiAgICAgICAgICAgIGNvbnN0IHBhcnNlZE1lc3NhZ2UgPSBodHRwTWVzc2FnZVBhcnNlcihidWZmZXIpO1xuICAgICAgICAgICAgcmVzb2x2ZShwYXJzZWRNZXNzYWdlKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgbGV0IGVycm9yID0gbmV3IEVycm9yKCdBbiBlcnJvciBvY2N1cmVkIHdpdGggcmVxdWVzdC4nKTtcbiAgICAgICAgICAgIGxldCByZXNwb25zZSA9IHt9O1xuXG4gICAgICAgICAgICBpZiAoIXhoci5yZXNwb25zZS5ieXRlTGVuZ3RoKSB7XG4gICAgICAgICAgICAgIGVycm9yID0gbmV3IEVycm9yKCdFbXB0eSByZXNwb25zZS4nKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgcmVzcG9uc2UgPSBKU09OLnBhcnNlKGFycmF5QnVmZmVyVG9TdHJpbmcoYnVmZmVyKSk7XG4gICAgICAgICAgICAgIH0gY2F0Y2goZXJyKSB7XG4gICAgICAgICAgICAgICAgZXJyb3IgPSBlcnI7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHJlc3BvbnNlLmVycm9yIGluc3RhbmNlb2YgT2JqZWN0KSB7XG4gICAgICAgICAgICAgIGlmIChyZXNwb25zZS5lcnJvci5jb2RlID09PSBBTUFaT05fRVJST1JfQ09ERVMuSW52YWxpZEFjY2Vzc1Rva2VuRXhjZXB0aW9uKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5lbWl0KEFWUy5FdmVudFR5cGVzLlRPS0VOX0lOVkFMSUQpO1xuICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgZXJyb3IgPSByZXNwb25zZS5lcnJvci5tZXNzYWdlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzLmVtaXQoQVZTLkV2ZW50VHlwZXMuRVJST1IsIGVycm9yKTtcbiAgICAgICAgICAgIHJldHVybiByZWplY3QoZXJyb3IpO1xuICAgICAgICAgIH1cbiAgICAgICAgfTtcblxuICAgICAgICB4aHIub25lcnJvciA9IChlcnJvcikgPT4ge1xuICAgICAgICAgIHRoaXMuX2xvZyhlcnJvcik7XG4gICAgICAgICAgcmVqZWN0KGVycm9yKTtcbiAgICAgICAgfTtcblxuICAgICAgICBjb25zdCBCT1VOREFSWSA9ICdCT1VOREFSWTEyMzQnO1xuICAgICAgICBjb25zdCBCT1VOREFSWV9EQVNIRVMgPSAnLS0nO1xuICAgICAgICBjb25zdCBORVdMSU5FID0gJ1xcclxcbic7XG4gICAgICAgIGNvbnN0IE1FVEFEQVRBX0NPTlRFTlRfRElTUE9TSVRJT04gPSAnQ29udGVudC1EaXNwb3NpdGlvbjogZm9ybS1kYXRhOyBuYW1lPVwibWV0YWRhdGFcIic7XG4gICAgICAgIGNvbnN0IE1FVEFEQVRBX0NPTlRFTlRfVFlQRSA9ICdDb250ZW50LVR5cGU6IGFwcGxpY2F0aW9uL2pzb247IGNoYXJzZXQ9VVRGLTgnO1xuICAgICAgICBjb25zdCBBVURJT19DT05URU5UX1RZUEUgPSAnQ29udGVudC1UeXBlOiBhdWRpby9MMTY7IHJhdGU9MTYwMDA7IGNoYW5uZWxzPTEnO1xuICAgICAgICBjb25zdCBBVURJT19DT05URU5UX0RJU1BPU0lUSU9OID0gJ0NvbnRlbnQtRGlzcG9zaXRpb246IGZvcm0tZGF0YTsgbmFtZT1cImF1ZGlvXCInO1xuXG4gICAgICAgIGNvbnN0IG1ldGFkYXRhID0ge1xuICAgICAgICAgIG1lc3NhZ2VIZWFkZXI6IHt9LFxuICAgICAgICAgIG1lc3NhZ2VCb2R5OiB7XG4gICAgICAgICAgICBwcm9maWxlOiAnYWxleGEtY2xvc2UtdGFsaycsXG4gICAgICAgICAgICBsb2NhbGU6ICdlbi11cycsXG4gICAgICAgICAgICBmb3JtYXQ6ICdhdWRpby9MMTY7IHJhdGU9MTYwMDA7IGNoYW5uZWxzPTEnXG4gICAgICAgICAgfVxuICAgICAgICB9O1xuXG4gICAgICAgIGNvbnN0IHBvc3REYXRhU3RhcnQgPSBbXG4gICAgICAgICAgTkVXTElORSwgQk9VTkRBUllfREFTSEVTLCBCT1VOREFSWSwgTkVXTElORSwgTUVUQURBVEFfQ09OVEVOVF9ESVNQT1NJVElPTiwgTkVXTElORSwgTUVUQURBVEFfQ09OVEVOVF9UWVBFLFxuICAgICAgICAgIE5FV0xJTkUsIE5FV0xJTkUsIEpTT04uc3RyaW5naWZ5KG1ldGFkYXRhKSwgTkVXTElORSwgQk9VTkRBUllfREFTSEVTLCBCT1VOREFSWSwgTkVXTElORSxcbiAgICAgICAgICBBVURJT19DT05URU5UX0RJU1BPU0lUSU9OLCBORVdMSU5FLCBBVURJT19DT05URU5UX1RZUEUsIE5FV0xJTkUsIE5FV0xJTkVcbiAgICAgICAgXS5qb2luKCcnKTtcblxuICAgICAgICBjb25zdCBwb3N0RGF0YUVuZCA9IFtORVdMSU5FLCBCT1VOREFSWV9EQVNIRVMsIEJPVU5EQVJZLCBCT1VOREFSWV9EQVNIRVMsIE5FV0xJTkVdLmpvaW4oJycpO1xuXG4gICAgICAgIGNvbnN0IHNpemUgPSBwb3N0RGF0YVN0YXJ0Lmxlbmd0aCArIGRhdGFWaWV3LmJ5dGVMZW5ndGggKyBwb3N0RGF0YUVuZC5sZW5ndGg7XG4gICAgICAgIGNvbnN0IHVpbnQ4QXJyYXkgPSBuZXcgVWludDhBcnJheShzaXplKTtcbiAgICAgICAgbGV0IGkgPSAwO1xuXG4gICAgICAgIGZvciAoOyBpIDwgcG9zdERhdGFTdGFydC5sZW5ndGg7IGkrKykge1xuICAgICAgICAgIHVpbnQ4QXJyYXlbaV0gPSBwb3N0RGF0YVN0YXJ0LmNoYXJDb2RlQXQoaSkgJiAweEZGO1xuICAgICAgICB9XG5cbiAgICAgICAgZm9yIChsZXQgaiA9IDA7IGogPCBkYXRhVmlldy5ieXRlTGVuZ3RoIDsgaSsrLCBqKyspIHtcbiAgICAgICAgICB1aW50OEFycmF5W2ldID0gZGF0YVZpZXcuZ2V0VWludDgoaik7XG4gICAgICAgIH1cblxuICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IHBvc3REYXRhRW5kLmxlbmd0aDsgaSsrLCBqKyspIHtcbiAgICAgICAgICB1aW50OEFycmF5W2ldID0gcG9zdERhdGFFbmQuY2hhckNvZGVBdChqKSAmIDB4RkY7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBwYXlsb2FkID0gdWludDhBcnJheS5idWZmZXI7XG5cbiAgICAgICAgeGhyLnNldFJlcXVlc3RIZWFkZXIoJ0F1dGhvcml6YXRpb24nLCBgQmVhcmVyICR7dGhpcy5fdG9rZW59YCk7XG4gICAgICAgIHhoci5zZXRSZXF1ZXN0SGVhZGVyKCdDb250ZW50LVR5cGUnLCAnbXVsdGlwYXJ0L2Zvcm0tZGF0YTsgYm91bmRhcnk9JyArIEJPVU5EQVJZKTtcbiAgICAgICAgeGhyLnNlbmQocGF5bG9hZCk7XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBzdGF0aWMgZ2V0IEV2ZW50VHlwZXMoKSB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICBMT0c6ICdsb2cnLFxuICAgICAgICBFUlJPUjogJ2Vycm9yJyxcbiAgICAgICAgTE9HSU46ICdsb2dpbicsXG4gICAgICAgIExPR09VVDogJ2xvZ291dCcsXG4gICAgICAgIFJFQ09SRF9TVEFSVDogJ3JlY29yZFN0YXJ0JyxcbiAgICAgICAgUkVDT1JEX1NUT1A6ICdyZWNvcmRTdG9wJyxcbiAgICAgICAgVE9LRU5fU0VUOiAndG9rZW5TZXQnLFxuICAgICAgICBSRUZSRVNIX1RPS0VOX1NFVDogJ3JlZnJlc2hUb2tlblNldCcsXG4gICAgICAgIFRPS0VOX0lOVkFMSUQ6ICd0b2tlbkludmFsaWQnXG4gICAgICB9O1xuICAgIH1cblxuICAgIHN0YXRpYyBnZXQgUGxheWVyKCkge1xuICAgICAgcmV0dXJuIFBsYXllcjtcbiAgICB9XG4gIH1cblxuICBpZiAodHlwZW9mIGV4cG9ydHMgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgaWYgKHR5cGVvZiBtb2R1bGUgIT09ICd1bmRlZmluZWQnICYmIG1vZHVsZS5leHBvcnRzKSB7XG4gICAgICBleHBvcnRzID0gbW9kdWxlLmV4cG9ydHMgPSBBVlM7XG4gICAgfVxuICAgIGV4cG9ydHMuQVZTID0gQVZTO1xuICB9XG5cbiAgaWYgKHR5cGVvZiBkZWZpbmUgPT09ICdmdW5jdGlvbicgJiYgZGVmaW5lLmFtZCkge1xuICAgIGRlZmluZShbXSwgZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gQVZTO1xuICAgIH0pO1xuICB9XG5cbiAgaWYgKHR5cGVvZiB3aW5kb3cgPT09ICdvYmplY3QnKSB7XG4gICAgd2luZG93LkFWUyA9IEFWUztcbiAgfVxuXG59KSgpO1xuIiwiY29uc3QgQVZTID0gcmVxdWlyZSgnLi4vYXZzJyk7XG5jb25zdCBwbGF5ZXIgPSBBVlMuUGxheWVyO1xuXG5jb25zdCBhdnMgPSBuZXcgQVZTKHtcbiAgZGVidWc6IHRydWUsXG4gIGNsaWVudElkOiAnYW16bjEuYXBwbGljYXRpb24tb2EyLWNsaWVudC42OTZhYjkwZmM1ODQ0ZmRiYjhlZmMxNzM5NGE3OWMwMCcsXG4gIGRldmljZUlkOiAndGVzdF9kZXZpY2UnLFxuICBkZXZpY2VTZXJpYWxOdW1iZXI6IDEyMyxcbiAgcmVkaXJlY3RVcmk6IGBodHRwczovLyR7d2luZG93LmxvY2F0aW9uLmhvc3R9L2F1dGhyZXNwb25zZWBcbn0pO1xuXG5hdnMub24oQVZTLkV2ZW50VHlwZXMuVE9LRU5fU0VULCAoKSA9PiB7XG4gIGxvZ2luQnRuLmRpc2FibGVkID0gdHJ1ZTtcbiAgbG9nb3V0QnRuLmRpc2FibGVkID0gZmFsc2U7XG4gIHN0YXJ0UmVjb3JkaW5nLmRpc2FibGVkID0gZmFsc2U7XG4gIHN0b3BSZWNvcmRpbmcuZGlzYWJsZWQgPSB0cnVlO1xufSk7XG5cbmF2cy5vbihBVlMuRXZlbnRUeXBlcy5SRUNPUkRfU1RBUlQsICgpID0+IHtcbiAgc3RhcnRSZWNvcmRpbmcuZGlzYWJsZWQgPSB0cnVlO1xuICBzdG9wUmVjb3JkaW5nLmRpc2FibGVkID0gZmFsc2U7XG59KTtcblxuYXZzLm9uKEFWUy5FdmVudFR5cGVzLlJFQ09SRF9TVE9QLCAoKSA9PiB7XG4gIHN0YXJ0UmVjb3JkaW5nLmRpc2FibGVkID0gZmFsc2U7XG4gIHN0b3BSZWNvcmRpbmcuZGlzYWJsZWQgPSB0cnVlO1xufSk7XG5cbmF2cy5vbihBVlMuRXZlbnRUeXBlcy5MT0dPVVQsICgpID0+IHtcbiAgbG9naW5CdG4uZGlzYWJsZWQgPSBmYWxzZTtcbiAgbG9nb3V0QnRuLmRpc2FibGVkID0gdHJ1ZTtcbiAgc3RhcnRSZWNvcmRpbmcuZGlzYWJsZWQgPSB0cnVlO1xuICBzdG9wUmVjb3JkaW5nLmRpc2FibGVkID0gdHJ1ZTtcbn0pO1xuXG5hdnMub24oQVZTLkV2ZW50VHlwZXMuVE9LRU5fSU5WQUxJRCwgKCkgPT4ge1xuICBhdnMubG9nb3V0KClcbiAgLnRoZW4obG9naW4pXG59KTtcblxuYXZzLm9uKEFWUy5FdmVudFR5cGVzLkxPRywgbG9nKTtcbmF2cy5vbihBVlMuRXZlbnRUeXBlcy5FUlJPUiwgbG9nRXJyb3IpO1xuXG5hdnMucGxheWVyLm9uKEFWUy5QbGF5ZXIuRXZlbnRUeXBlcy5MT0csIGxvZyk7XG5hdnMucGxheWVyLm9uKEFWUy5QbGF5ZXIuRXZlbnRUeXBlcy5FUlJPUiwgbG9nRXJyb3IpO1xuXG5hdnMucGxheWVyLm9uKEFWUy5QbGF5ZXIuRXZlbnRUeXBlcy5QTEFZLCAoKSA9PiB7XG4gIHBsYXlBdWRpby5kaXNhYmxlZCA9IHRydWU7XG4gIHJlcGxheUF1ZGlvLmRpc2FibGVkID0gdHJ1ZTtcbiAgcGF1c2VBdWRpby5kaXNhYmxlZCA9IGZhbHNlO1xuICBzdG9wQXVkaW8uZGlzYWJsZWQgPSBmYWxzZTtcbn0pO1xuXG5hdnMucGxheWVyLm9uKEFWUy5QbGF5ZXIuRXZlbnRUeXBlcy5FTkRFRCwgKCkgPT4ge1xuICBwbGF5QXVkaW8uZGlzYWJsZWQgPSB0cnVlO1xuICByZXBsYXlBdWRpby5kaXNhYmxlZCA9IGZhbHNlO1xuICBwYXVzZUF1ZGlvLmRpc2FibGVkID0gdHJ1ZTtcbiAgc3RvcEF1ZGlvLmRpc2FibGVkID0gdHJ1ZTtcbn0pO1xuXG5hdnMucGxheWVyLm9uKEFWUy5QbGF5ZXIuRXZlbnRUeXBlcy5TVE9QLCAoKSA9PiB7XG4gIHBsYXlBdWRpby5kaXNhYmxlZCA9IHRydWU7XG4gIHJlcGxheUF1ZGlvLmRpc2FibGVkID0gZmFsc2U7XG4gIHBhdXNlQXVkaW8uZGlzYWJsZWQgPSBmYWxzZTtcbiAgc3RvcEF1ZGlvLmRpc2FibGVkID0gZmFsc2U7XG59KTtcblxuYXZzLnBsYXllci5vbihBVlMuUGxheWVyLkV2ZW50VHlwZXMuUEFVU0UsICgpID0+IHtcbiAgcGxheUF1ZGlvLmRpc2FibGVkID0gZmFsc2U7XG4gIHJlcGxheUF1ZGlvLmRpc2FibGVkID0gZmFsc2U7XG4gIHBhdXNlQXVkaW8uZGlzYWJsZWQgPSB0cnVlO1xuICBzdG9wQXVkaW8uZGlzYWJsZWQgPSB0cnVlO1xufSk7XG5cbmF2cy5wbGF5ZXIub24oQVZTLlBsYXllci5FdmVudFR5cGVzLlJFUExBWSwgKCkgPT4ge1xuICBwbGF5QXVkaW8uZGlzYWJsZWQgPSB0cnVlO1xuICByZXBsYXlBdWRpby5kaXNhYmxlZCA9IHRydWU7XG4gIHBhdXNlQXVkaW8uZGlzYWJsZWQgPSBmYWxzZTtcbiAgc3RvcEF1ZGlvLmRpc2FibGVkID0gZmFsc2U7XG59KTtcblxuZnVuY3Rpb24gbG9nKG1lc3NhZ2UpIHtcbiAgbG9nT3V0cHV0LmlubmVySFRNTCArPSBgPGxpPkxPRzogJHttZXNzYWdlfTwvbGk+YDtcbn1cblxuZnVuY3Rpb24gbG9nRXJyb3IoZXJyb3IpIHtcbiAgbG9nT3V0cHV0LmlubmVySFRNTCArPSBgPGxpPkVSUk9SOiAke2Vycm9yfTwvbGk+YDtcbn1cblxuY29uc3QgbG9naW5CdG4gPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnbG9naW4nKTtcbmNvbnN0IGxvZ291dEJ0biA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdsb2dvdXQnKTtcbmNvbnN0IGxvZ091dHB1dCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdsb2cnKTtcbmNvbnN0IHN0YXJ0UmVjb3JkaW5nID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3N0YXJ0UmVjb3JkaW5nJyk7XG5jb25zdCBzdG9wUmVjb3JkaW5nID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3N0b3BSZWNvcmRpbmcnKTtcbmNvbnN0IHN0b3BBdWRpbyA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdzdG9wQXVkaW8nKTtcbmNvbnN0IHBhdXNlQXVkaW8gPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncGF1c2VBdWRpbycpO1xuY29uc3QgcGxheUF1ZGlvID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3BsYXlBdWRpbycpO1xuY29uc3QgcmVwbGF5QXVkaW8gPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncmVwbGF5QXVkaW8nKTtcblxuLypcbi8vIElmIHVzaW5nIGNsaWVudCBzZWNyZXRcbmF2cy5nZXRDb2RlRnJvbVVybCgpXG4gLnRoZW4oY29kZSA9PiBhdnMuZ2V0VG9rZW5Gcm9tQ29kZShjb2RlKSlcbi50aGVuKHRva2VuID0+IGxvY2FsU3RvcmFnZS5zZXRJdGVtKCd0b2tlbicsIHRva2VuKSlcbi50aGVuKHJlZnJlc2hUb2tlbiA9PiBsb2NhbFN0b3JhZ2Uuc2V0SXRlbSgncmVmcmVzaFRva2VuJywgcmVmcmVzaFRva2VuKSlcbi50aGVuKCgpID0+IGF2cy5yZXF1ZXN0TWljKCkpXG4udGhlbigoKSA9PiBhdnMucmVmcmVzaFRva2VuKCkpXG4uY2F0Y2goKCkgPT4ge1xuXG59KTtcbiovXG5cbmF2cy5nZXRUb2tlbkZyb21VcmwoKVxuLnRoZW4oKCkgPT4gYXZzLmdldFRva2VuKCkpXG4udGhlbih0b2tlbiA9PiBsb2NhbFN0b3JhZ2Uuc2V0SXRlbSgndG9rZW4nLCB0b2tlbikpXG4udGhlbigoKSA9PiBhdnMucmVxdWVzdE1pYygpKVxuLmNhdGNoKCgpID0+IHtcbiAgY29uc3QgY2FjaGVkVG9rZW4gPSBsb2NhbFN0b3JhZ2UuZ2V0SXRlbSgndG9rZW4nKTtcblxuICBpZiAoY2FjaGVkVG9rZW4pIHtcbiAgICBhdnMuc2V0VG9rZW4oY2FjaGVkVG9rZW4pO1xuICAgIHJldHVybiBhdnMucmVxdWVzdE1pYygpO1xuICB9XG59KTtcblxubG9naW5CdG4uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBsb2dpbik7XG5cbmZ1bmN0aW9uIGxvZ2luKGV2ZW50KSB7XG4gIHJldHVybiBhdnMubG9naW4oKVxuICAudGhlbigoKSA9PiBhdnMucmVxdWVzdE1pYygpKVxuICAuY2F0Y2goKCkgPT4ge30pO1xuXG4gIC8qXG4gIC8vIElmIHVzaW5nIGNsaWVudCBzZWNyZXRcbiAgYXZzLmxvZ2luKHtyZXNwb25zZVR5cGU6ICdjb2RlJ30pXG4gIC50aGVuKCgpID0+IGF2cy5yZXF1ZXN0TWljKCkpXG4gIC5jYXRjaCgoKSA9PiB7fSk7XG4gICovXG59XG5cbmxvZ291dEJ0bi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIGxvZ291dCk7XG5cbmZ1bmN0aW9uIGxvZ291dCgpIHtcbiAgcmV0dXJuIGF2cy5sb2dvdXQoKVxuICAudGhlbigoKSA9PiB7XG4gICAgbG9jYWxTdG9yYWdlLnJlbW92ZUl0ZW0oJ3Rva2VuJyk7XG4gICAgd2luZG93LmxvY2F0aW9uLmhhc2ggPSAnJztcbiAgfSk7XG59XG5cbnN0YXJ0UmVjb3JkaW5nLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xuICBhdnMuc3RhcnRSZWNvcmRpbmcoKTtcbn0pO1xuXG5zdG9wUmVjb3JkaW5nLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xuICBhdnMuc3RvcFJlY29yZGluZygpLnRoZW4oZGF0YVZpZXcgPT4ge1xuICAgIGF2cy5wbGF5ZXIuZW1wdHlRdWV1ZSgpXG4gICAgLnRoZW4oKCkgPT4gYXZzLnBsYXllci5lbnF1ZXVlKGRhdGFWaWV3KSlcbiAgICAudGhlbigoKSA9PiBhdnMucGxheWVyLnBsYXkoKSlcbiAgICAuY2F0Y2goZXJyb3IgPT4ge1xuICAgICAgY29uc29sZS5lcnJvcihlcnJvcik7XG4gICAgfSk7XG5cbiAgICAvL3NlbmRCbG9iKGJsb2IpO1xuICAgIGF2cy5zZW5kQXVkaW8oZGF0YVZpZXcpXG4gICAgLnRoZW4ocmVzcG9uc2UgPT4ge1xuXG4gICAgICBpZiAocmVzcG9uc2UubXVsdGlwYXJ0Lmxlbmd0aCA+IDEpIHtcbiAgICAgICAgY29uc3QgdHlwZWRBcnJheSA9IHJlc3BvbnNlLm11bHRpcGFydFsxXS5ib2R5O1xuXG4gICAgICAgIGF2cy5wbGF5ZXIuZW5xdWV1ZSh0eXBlZEFycmF5KVxuICAgICAgICAudGhlbigoKSA9PiBhdnMucGxheWVyLnBsYXkoKSlcbiAgICAgICAgLmNhdGNoKGVycm9yID0+IHtcbiAgICAgICAgICBjb25zb2xlLmVycm9yKGVycm9yKTtcbiAgICAgICAgfSk7XG4gICAgICB9XG5cbiAgICB9KVxuICAgIC5jYXRjaChlcnJvciA9PiB7XG4gICAgICBjb25zb2xlLmVycm9yKGVycm9yKTtcbiAgICB9KTtcbiAgfSk7XG59KTtcblxuc3RvcEF1ZGlvLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKGV2ZW50KSA9PiB7XG4gIGF2cy5wbGF5ZXIuc3RvcCgpO1xufSk7XG5cbnBhdXNlQXVkaW8uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoZXZlbnQpID0+IHtcbiAgYXZzLnBsYXllci5wYXVzZSgpO1xufSk7XG5cbnBsYXlBdWRpby5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIChldmVudCkgPT4ge1xuICBhdnMucGxheWVyLnBsYXkoKTtcbn0pO1xuXG5yZXBsYXlBdWRpby5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIChldmVudCkgPT4ge1xuICBhdnMucGxheWVyLnJlcGxheSgpO1xufSk7XG5cbmZ1bmN0aW9uIHNlbmRCbG9iKGJsb2IpIHtcbiAgY29uc3QgeGhyID0gbmV3IFhNTEh0dHBSZXF1ZXN0KCk7XG4gIGNvbnN0IGZkID0gbmV3IEZvcm1EYXRhKCk7XG5cbiAgZmQuYXBwZW5kKCdmbmFtZScsICdhdWRpby53YXYnKTtcbiAgZmQuYXBwZW5kKCdkYXRhJywgYmxvYik7XG5cbiAgeGhyLm9wZW4oJ1BPU1QnLCAnaHR0cDovL2xvY2FsaG9zdDo1NTU1L2F1ZGlvJywgdHJ1ZSk7XG4gIHhoci5yZXNwb25zZVR5cGUgPSAnYmxvYic7XG5cbiAgeGhyLm9ubG9hZCA9IChldmVudCkgPT4ge1xuICAgIGlmICh4aHIuc3RhdHVzID09IDIwMCkge1xuICAgICAgY29uc29sZS5sb2coeGhyLnJlc3BvbnNlKTtcbiAgICAgIC8vY29uc3QgcmVzcG9uc2VCbG9iID0gbmV3IEJsb2IoW3hoci5yZXNwb25zZV0sIHt0eXBlOiAnYXVkaW8vbXAzJ30pO1xuICAgIH1cbiAgfTtcbiAgeGhyLnNlbmQoZmQpO1xufVxuIiwiJ3VzZSBzdHJpY3QnO1xuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgSW52YWxpZEFjY2Vzc1Rva2VuRXhjZXB0aW9uOiAnY29tLmFtYXpvbi5hbGV4YWh0dHBwcm94eS5leGNlcHRpb25zLkludmFsaWRBY2Nlc3NUb2tlbkV4Y2VwdGlvbidcbn07XG4iLCIndXNlIHN0cmljdCc7XG5cbmZ1bmN0aW9uIE9ic2VydmFibGUoZWwpIHtcbiAgbGV0IGNhbGxiYWNrcyA9IHt9O1xuXG4gIGVsLm9uID0gZnVuY3Rpb24obmFtZSwgZm4pIHtcbiAgICBpZiAodHlwZW9mIGZuICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdTZWNvbmQgYXJndW1lbnQgZm9yIFwib25cIiBtZXRob2QgbXVzdCBiZSBhIGZ1bmN0aW9uLicpO1xuICAgIH1cblxuICAgIChjYWxsYmFja3NbbmFtZV0gPSBjYWxsYmFja3NbbmFtZV0gfHwgW10pLnB1c2goZm4pO1xuXG4gICAgcmV0dXJuIGVsO1xuICB9O1xuXG4gIGVsLm9uZSA9IGZ1bmN0aW9uKG5hbWUsIGZuKSB7XG4gICAgZm4ub25lID0gdHJ1ZTtcbiAgICByZXR1cm4gZWwub24uY2FsbChlbCwgbmFtZSwgZm4pO1xuICB9O1xuXG4gIGVsLm9mZiA9IGZ1bmN0aW9uKG5hbWUsIGZuKSB7XG4gICAgaWYgKG5hbWUgPT09ICcqJykge1xuICAgICAgY2FsbGJhY2tzID0ge307XG4gICAgICByZXR1cm4gY2FsbGJhY2tzXG4gICAgfVxuXG4gICAgaWYgKCFjYWxsYmFja3NbbmFtZV0pIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICBpZiAoZm4pIHtcbiAgICAgIGlmICh0eXBlb2YgZm4gIT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignU2Vjb25kIGFyZ3VtZW50IGZvciBcIm9mZlwiIG1ldGhvZCBtdXN0IGJlIGEgZnVuY3Rpb24uJyk7XG4gICAgICB9XG5cbiAgICAgIGNhbGxiYWNrc1tuYW1lXSA9IGNhbGxiYWNrc1tuYW1lXS5tYXAoZnVuY3Rpb24oZm0sIGkpIHtcbiAgICAgICAgaWYgKGZtID09PSBmbikge1xuICAgICAgICAgIGNhbGxiYWNrc1tuYW1lXS5zcGxpY2UoaSwgMSk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICBkZWxldGUgY2FsbGJhY2tzW25hbWVdO1xuICAgIH1cbiAgfTtcblxuICBlbC5lbWl0ID0gZnVuY3Rpb24obmFtZSAvKiwgYXJncyAqLykge1xuICAgIGlmICghY2FsbGJhY2tzW25hbWVdIHx8ICFjYWxsYmFja3NbbmFtZV0ubGVuZ3RoKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgYXJncyA9IFtdLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcblxuICAgIGNhbGxiYWNrc1tuYW1lXS5mb3JFYWNoKGZ1bmN0aW9uKGZuLCBpKSB7XG4gICAgICBpZiAoZm4pIHtcbiAgICAgICAgZm4uYXBwbHkoZm4sIGFyZ3MpO1xuICAgICAgICBpZiAoZm4ub25lKSB7XG4gICAgICAgICAgY2FsbGJhY2tzW25hbWVdLnNwbGljZShpLCAxKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0pO1xuXG4gICAgcmV0dXJuIGVsO1xuICB9O1xuXG4gIHJldHVybiBlbDtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBPYnNlcnZhYmxlO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG5jb25zdCBPYnNlcnZhYmxlID0gcmVxdWlyZSgnLi9PYnNlcnZhYmxlJyk7XG5jb25zdCBhcnJheUJ1ZmZlclRvQXVkaW9CdWZmZXIgPSByZXF1aXJlKCcuL3V0aWxzL2FycmF5QnVmZmVyVG9BdWRpb0J1ZmZlcicpO1xuY29uc3QgdG9TdHJpbmcgPSBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nO1xuXG5jbGFzcyBQbGF5ZXIge1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICB0aGlzLl9xdWV1ZSA9IFtdO1xuICAgIHRoaXMuX2N1cnJlbnRTb3VyY2UgPSBudWxsO1xuICAgIHRoaXMuX2N1cnJlbnRCdWZmZXIgPSBudWxsO1xuICAgIHRoaXMuX2NvbnRleHQgPSBuZXcgQXVkaW9Db250ZXh0KCk7XG5cbiAgICBPYnNlcnZhYmxlKHRoaXMpO1xuICB9XG5cbiAgX2xvZyh0eXBlLCBtZXNzYWdlKSB7XG4gICAgaWYgKHR5cGUgJiYgIW1lc3NhZ2UpIHtcbiAgICAgIG1lc3NhZ2UgPSB0eXBlO1xuICAgICAgdHlwZSA9ICdsb2cnO1xuICAgIH1cblxuICAgIHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgdGhpcy5lbWl0KFBsYXllci5FdmVudFR5cGVzLkxPRywgbWVzc2FnZSk7XG4gICAgfSwgMCk7XG5cbiAgICBpZiAodGhpcy5fZGVidWcpIHtcbiAgICAgIGNvbnNvbGVbdHlwZV0obWVzc2FnZSk7XG4gICAgfVxuICB9XG5cbiAgZW1wdHlRdWV1ZSgpIHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgdGhpcy5fcXVldWUgPSBbXTtcbiAgICAgIHJlc29sdmUoKTtcbiAgICB9KTtcbiAgfVxuXG4gIGVucXVldWUoaXRlbSkge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICBpZiAoIWl0ZW0pIHtcbiAgICAgICAgY29uc3QgZXJyb3IgPSBuZXcgRXJyb3IoJ2FyZ3VtZW50IGNhbm5vdCBiZSBlbXB0eS4nKTtcbiAgICAgICAgdGhpcy5fbG9nKGVycm9yKTtcbiAgICAgICAgcmV0dXJuIHJlamVjdChlcnJvcik7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IHN0cmluZ1R5cGUgPSB0b1N0cmluZy5jYWxsKGl0ZW0pO1xuXG4gICAgICBjb25zdCBwcm9jZWVkID0gKGF1ZGlvQnVmZmVyKSA9PiB7XG4gICAgICAgIHRoaXMuX3F1ZXVlLnB1c2goYXVkaW9CdWZmZXIpO1xuICAgICAgICB0aGlzLl9sb2coJ0VucXVldWUgYXVkaW8nKTtcbiAgICAgICAgdGhpcy5lbWl0KFBsYXllci5FdmVudFR5cGVzLkVOUVVFVUUpO1xuICAgICAgICByZXR1cm4gcmVzb2x2ZShhdWRpb0J1ZmZlcik7XG4gICAgICB9O1xuXG4gICAgICBpZiAoc3RyaW5nVHlwZSA9PT0gJ1tvYmplY3QgRGF0YVZpZXddJyB8fCBzdHJpbmdUeXBlID09PSAnW29iamVjdCBVaW50OEFycmF5XScpIHtcbiAgICAgICAgYXJyYXlCdWZmZXJUb0F1ZGlvQnVmZmVyKGl0ZW0uYnVmZmVyLCB0aGlzLl9jb250ZXh0KVxuICAgICAgICAudGhlbihwcm9jZWVkKTtcbiAgICAgIH0gZWxzZSBpZiAoc3RyaW5nVHlwZSA9PT0gJ1tvYmplY3QgQXVkaW9CdWZmZXJdJykge1xuICAgICAgICBwcm9jZWVkKGl0ZW0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uc3QgZXJyb3IgPSBuZXcgRXJyb3IoJ0ludmFsaWQgdHlwZS4nKTtcbiAgICAgICAgdGhpcy5lbWl0KCdlcnJvcicsIGVycm9yKTtcbiAgICAgICAgcmV0dXJuIHJlamVjdChlcnJvcik7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICBkZXF1ZSgpIHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgY29uc3QgaXRlbSA9IHRoaXMuX3F1ZXVlLnNoaWZ0KCk7XG5cbiAgICAgIGlmIChpdGVtKSB7XG4gICAgICAgIHRoaXMuX2xvZygnRGVxdWUgYXVkaW8nKTtcbiAgICAgICAgdGhpcy5lbWl0KFBsYXllci5FdmVudFR5cGVzLkRFUVVFKTtcbiAgICAgICAgcmV0dXJuIHJlc29sdmUoaXRlbSk7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiByZWplY3QoKTtcbiAgICB9KTtcbiAgfVxuXG4gIHBsYXkoKSB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgIGlmICh0aGlzLl9jb250ZXh0LnN0YXRlID09PSAnc3VzcGVuZGVkJykge1xuICAgICAgICB0aGlzLl9jb250ZXh0LnJlc3VtZSgpO1xuXG4gICAgICAgIHRoaXMuX2xvZygnUGxheSBhdWRpbycpO1xuICAgICAgICB0aGlzLmVtaXQoUGxheWVyLkV2ZW50VHlwZXMuUExBWSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gdGhpcy5kZXF1ZSgpXG4gICAgICAgIC50aGVuKGF1ZGlvQnVmZmVyID0+IHtcbiAgICAgICAgICB0aGlzLnBsYXlBdWRpb0J1ZmZlcihhdWRpb0J1ZmZlcilcblxuICAgICAgICAgIHRoaXMuX2xvZygnUGxheSBhdWRpbycpO1xuICAgICAgICAgIHRoaXMuZW1pdChQbGF5ZXIuRXZlbnRUeXBlcy5QTEFZKTtcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICBzdG9wKCkge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgIGlmICh0aGlzLl9jdXJyZW50U291cmNlKSB7XG4gICAgICAgICAgdGhpcy5fY3VycmVudFNvdXJjZS5vbmVuZGVkID0gZnVuY3Rpb24oKSB7fTtcbiAgICAgICAgICB0aGlzLl9jdXJyZW50U291cmNlLnN0b3AoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX2xvZygnU3RvcCBhdWRpbycpO1xuICAgICAgICB0aGlzLmVtaXQoUGxheWVyLkV2ZW50VHlwZXMuU1RPUCk7XG4gICAgfSk7XG4gIH1cblxuICBwYXVzZSgpIHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICBpZiAodGhpcy5fY29udGV4dC5zdGF0ZSA9PT0gJ3J1bm5pbmcnKSB7XG4gICAgICAgICAgdGhpcy5fY29udGV4dC5zdXNwZW5kKCk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9sb2coJ1BhdXNlIGF1ZGlvJyk7XG4gICAgICAgIHRoaXMuZW1pdChQbGF5ZXIuRXZlbnRUeXBlcy5QQVVTRSk7XG4gICAgfSk7XG4gIH1cblxuICByZXBsYXkoKSB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgaWYgKHRoaXMuX2N1cnJlbnRCdWZmZXIpIHtcbiAgICAgICAgICB0aGlzLl9sb2coJ1JlcGxheSBhdWRpbycpO1xuICAgICAgICAgIHRoaXMuZW1pdChQbGF5ZXIuRXZlbnRUeXBlcy5SRVBMQVkpO1xuXG4gICAgICAgICAgaWYgKHRoaXMuX2NvbnRleHQuc3RhdGUgPT09ICdzdXNwZW5kZWQnKSB7XG4gICAgICAgICAgICB0aGlzLl9jb250ZXh0LnJlc3VtZSgpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIHRoaXMuX2N1cnJlbnRTb3VyY2Uuc3RvcCgpO1xuICAgICAgICAgIHRoaXMuX2N1cnJlbnRTb3VyY2Uub25lbmRlZCA9IGZ1bmN0aW9uKCkge307XG5cbiAgICAgICAgICByZXR1cm4gdGhpcy5wbGF5QXVkaW9CdWZmZXIodGhpcy5fY3VycmVudEJ1ZmZlcik7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgY29uc3QgZXJyb3IgPSBuZXcgRXJyb3IoJ05vIGF1ZGlvIHNvdXJjZSBsb2FkZWQuJyk7XG4gICAgICAgICAgdGhpcy5lbWl0KCdlcnJvcicsIGVycm9yKVxuICAgICAgICAgIHJlamVjdCgpO1xuICAgICAgICB9XG4gICAgfSk7XG4gIH1cblxuICBwbGF5QmxvYihibG9iKSB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgIGlmICghYmxvYikge1xuICAgICAgICByZWplY3QoKTtcbiAgICAgIH1cblxuICAgICAgY29uc3Qgb2JqZWN0VXJsID0gVVJMLmNyZWF0ZU9iamVjdFVSTChibG9iKTtcbiAgICAgIGNvbnN0IGF1ZGlvID0gbmV3IEF1ZGlvKCk7XG4gICAgICBhdWRpby5zcmMgPSBvYmplY3RVcmw7XG5cbiAgICAgIGF1ZGlvLmFkZEV2ZW50TGlzdGVuZXIoJ2VuZGVkJywgKCkgPT4ge1xuICAgICAgICB0aGlzLl9sb2coJ0F1ZGlvIGVuZGVkJyk7XG4gICAgICAgIHRoaXMuZW1pdChQbGF5ZXIuRXZlbnRUeXBlcy5FTkRFRCk7XG4gICAgICB9KTtcblxuICAgICAgYXVkaW8ub25sb2FkID0gKGV2ZW50KSA9PiB7XG4gICAgICAgIFVSTC5yZXZva2VPYmplY3RVcmwob2JqZWN0VXJsKTtcbiAgICAgIH07XG5cbiAgICAgIHRoaXMuX2xvZygnQXVkaW8gcGxheSBzdGFydGVkLicpO1xuICAgICAgYXVkaW8ucGxheSgpO1xuXG4gICAgICByZXNvbHZlKCk7XG4gICAgfSk7XG4gIH1cblxuICBwbGF5QXVkaW9CdWZmZXIoYnVmZmVyKSB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgIGNvbnN0IHNvdXJjZSA9IHRoaXMuX2NvbnRleHQuY3JlYXRlQnVmZmVyU291cmNlKCk7XG4gICAgICBzb3VyY2UuYnVmZmVyID0gYnVmZmVyO1xuICAgICAgc291cmNlLmNvbm5lY3QodGhpcy5fY29udGV4dC5kZXN0aW5hdGlvbik7XG4gICAgICBzb3VyY2Uuc3RhcnQoMCk7XG4gICAgICB0aGlzLl9jdXJyZW50QnVmZmVyID0gYnVmZmVyO1xuICAgICAgdGhpcy5fY3VycmVudFNvdXJjZSA9IHNvdXJjZTtcblxuICAgICAgc291cmNlLm9uZW5kZWQgPSAoZXZlbnQpID0+IHtcbiAgICAgICAgdGhpcy5fbG9nKCdBdWRpbyBlbmRlZCcpO1xuICAgICAgICB0aGlzLmVtaXQoUGxheWVyLkV2ZW50VHlwZXMuRU5ERUQpO1xuICAgICAgfTtcblxuICAgICAgc291cmNlLm9uZXJyb3IgPSAoZXJyb3IpID0+IHtcbiAgICAgICAgdGhpcy5lbWl0KCdlcnJvcicsIGVycm9yKTtcbiAgICAgIH07XG5cbiAgICAgIHJlc29sdmUoKTtcbiAgICB9KTtcbiAgfVxuXG4gIHN0YXRpYyBnZXQgRXZlbnRUeXBlcygpIHtcbiAgICByZXR1cm4ge1xuICAgICAgTE9HOiAnbG9nJyxcbiAgICAgIEVSUk9SOiAnZXJyb3InLFxuICAgICAgUExBWTogJ3BsYXknLFxuICAgICAgUkVQTEFZOiAncmVwbGF5JyxcbiAgICAgIFBBVVNFOiAncGF1c2UnLFxuICAgICAgU1RPUDogJ3BhdXNlJyxcbiAgICAgIEVOUVVFVUU6ICdlbnF1ZXVlJyxcbiAgICAgIERFUVVFOiAnZGVxdWUnXG4gICAgfTtcbiAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IFBsYXllcjtcbiIsIid1c2Ugc3RyaWN0Jztcblxud2luZG93LkF1ZGlvQ29udGV4dCA9IHdpbmRvdy5BdWRpb0NvbnRleHQgfHwgd2luZG93LndlYmtpdEF1ZGlvQ29udGV4dDtcblxuZnVuY3Rpb24gYXJyYXlCdWZmZXJUb0F1ZGlvQnVmZmVyKGFycmF5QnVmZmVyLCBjb250ZXh0KSB7XG4gIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgaWYgKGNvbnRleHQpIHtcbiAgICAgIGlmIChPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwoY29udGV4dCkgIT09ICdbb2JqZWN0IEF1ZGlvQ29udGV4dF0nKSB7XG4gICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ2Bjb250ZXh0YCBtdXN0IGJlIGFuIEF1ZGlvQ29udGV4dCcpO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBjb250ZXh0ID0gbmV3IEF1ZGlvQ29udGV4dCgpO1xuICAgIH1cblxuICAgIGNvbnRleHQuZGVjb2RlQXVkaW9EYXRhKGFycmF5QnVmZmVyLCByZXNvbHZlLCByZWplY3QpO1xuICB9KTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBhcnJheUJ1ZmZlclRvQXVkaW9CdWZmZXI7XG4iLCIndXNlIHN0cmljdCc7XG5cbi8qKlxuICogQGNyZWRpdCBodHRwczovL2RldmVsb3BlcnMuZ29vZ2xlLmNvbS93ZWIvdXBkYXRlcy8yMDEyLzA2L0hvdy10by1jb252ZXJ0LUFycmF5QnVmZmVyLXRvLWFuZC1mcm9tLVN0cmluZz9obD1lblxuICovXG5mdW5jdGlvbiBhcnJheUJ1ZmZlclRvU3RyaW5nKGJ1ZmZlcikge1xuICByZXR1cm4gU3RyaW5nLmZyb21DaGFyQ29kZS5hcHBseShudWxsLCBuZXcgVWludDE2QXJyYXkoYnVmZmVyKSk7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gYXJyYXlCdWZmZXJUb1N0cmluZztcbiIsIid1c2Ugc3RyaWN0JztcblxuLyoqXG4gKiBAY3JlZGl0IGh0dHA6Ly9zdGFja292ZXJmbG93LmNvbS9hLzI2MjQ1MjYwXG4gKi9cbmZ1bmN0aW9uIGRvd25zYW1wbGVCdWZmZXIoYnVmZmVyLCBpbnB1dFNhbXBsZVJhdGUsIG91dHB1dFNhbXBsZVJhdGUpIHtcbiAgaWYgKGlucHV0U2FtcGxlUmF0ZSA9PT0gb3V0cHV0U2FtcGxlUmF0ZSkge1xuICAgIHJldHVybiBidWZmZXI7XG4gIH1cblxuICBpZiAoaW5wdXRTYW1wbGVSYXRlIDwgb3V0cHV0U2FtcGxlUmF0ZSkge1xuICAgIHRocm93IG5ldyBFcnJvcignT3V0cHV0IHNhbXBsZSByYXRlIG11c3QgYmUgbGVzcyB0aGFuIGlucHV0IHNhbXBsZSByYXRlLicpO1xuICB9XG5cbiAgY29uc3Qgc2FtcGxlUmF0ZVJhdGlvID0gaW5wdXRTYW1wbGVSYXRlIC8gb3V0cHV0U2FtcGxlUmF0ZTtcbiAgY29uc3QgbmV3TGVuZ3RoID0gTWF0aC5yb3VuZChidWZmZXIubGVuZ3RoIC8gc2FtcGxlUmF0ZVJhdGlvKTtcbiAgbGV0IHJlc3VsdCA9IG5ldyBGbG9hdDMyQXJyYXkobmV3TGVuZ3RoKTtcbiAgbGV0IG9mZnNldFJlc3VsdCA9IDA7XG4gIGxldCBvZmZzZXRCdWZmZXIgPSAwO1xuXG4gIHdoaWxlIChvZmZzZXRSZXN1bHQgPCByZXN1bHQubGVuZ3RoKSB7XG4gICAgbGV0IG5leHRPZmZzZXRCdWZmZXIgPSBNYXRoLnJvdW5kKChvZmZzZXRSZXN1bHQgKyAxKSAqIHNhbXBsZVJhdGVSYXRpbyk7XG4gICAgbGV0IGFjY3VtID0gMDtcbiAgICBsZXQgY291bnQgPSAwO1xuXG4gICAgZm9yICh2YXIgaSA9IG9mZnNldEJ1ZmZlcjsgaSA8IG5leHRPZmZzZXRCdWZmZXIgJiYgaSA8IGJ1ZmZlci5sZW5ndGg7IGkrKykge1xuICAgICAgYWNjdW0gKz0gYnVmZmVyW2ldO1xuICAgICAgY291bnQrKztcbiAgICB9XG5cbiAgICByZXN1bHRbb2Zmc2V0UmVzdWx0XSA9IGFjY3VtIC8gY291bnQ7XG4gICAgb2Zmc2V0UmVzdWx0Kys7XG4gICAgb2Zmc2V0QnVmZmVyID0gbmV4dE9mZnNldEJ1ZmZlcjtcbiAgfVxuXG4gIHJldHVybiByZXN1bHQ7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gZG93bnNhbXBsZUJ1ZmZlcjtcbiIsIid1c2Ugc3RyaWN0JztcblxuLyoqXG4gKiBAY3JlZGl0IGh0dHBzOi8vZ2l0aHViLmNvbS9tYXR0ZGlhbW9uZC9SZWNvcmRlcmpzXG4gKi9cbmZ1bmN0aW9uIGludGVybGVhdmUobGVmdENoYW5uZWwsIHJpZ2h0Q2hhbm5lbCkge1xuICBpZiAobGVmdENoYW5uZWwgJiYgIXJpZ2h0Q2hhbm5lbCkge1xuICAgIHJldHVybiBsZWZ0Q2hhbm5lbDtcbiAgfVxuXG4gIGNvbnN0IGxlbmd0aCA9IGxlZnRDaGFubmVsLmxlbmd0aCArIHJpZ2h0Q2hhbm5lbC5sZW5ndGg7XG4gIGxldCByZXN1bHQgPSBuZXcgRmxvYXQzMkFycmF5KGxlbmd0aCk7XG4gIGxldCBpbnB1dEluZGV4ID0gMDtcblxuICBmb3IgKGxldCBpbmRleCA9IDA7IGluZGV4IDwgbGVuZ3RoOyApe1xuICAgIHJlc3VsdFtpbmRleCsrXSA9IGxlZnRDaGFubmVsW2lucHV0SW5kZXhdO1xuICAgIHJlc3VsdFtpbmRleCsrXSA9IHJpZ2h0Q2hhbm5lbFtpbnB1dEluZGV4XTtcbiAgICBpbnB1dEluZGV4Kys7XG4gIH1cblxuICByZXR1cm4gcmVzdWx0O1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGludGVybGVhdmU7XG4iLCIndXNlIHN0cmljdCc7XG5cbi8qKlxuICogQGNyZWRpdCBodHRwczovL2dpdGh1Yi5jb20vbWF0dGRpYW1vbmQvUmVjb3JkZXJqc1xuICovXG5mdW5jdGlvbiBtZXJnZUJ1ZmZlcnMoY2hhbm5lbEJ1ZmZlciwgcmVjb3JkaW5nTGVuZ3RoKXtcbiAgY29uc3QgcmVzdWx0ID0gbmV3IEZsb2F0MzJBcnJheShyZWNvcmRpbmdMZW5ndGgpO1xuICBjb25zdCBsZW5ndGggPSBjaGFubmVsQnVmZmVyLmxlbmd0aDtcbiAgbGV0IG9mZnNldCA9IDA7XG5cbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBsZW5ndGg7IGkrKyl7XG4gICAgbGV0IGJ1ZmZlciA9IGNoYW5uZWxCdWZmZXJbaV07XG5cbiAgICByZXN1bHQuc2V0KGJ1ZmZlciwgb2Zmc2V0KTtcbiAgICBvZmZzZXQgKz0gYnVmZmVyLmxlbmd0aDtcbiAgfVxuXG4gIHJldHVybiByZXN1bHQ7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gbWVyZ2VCdWZmZXJzO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG4vKipcbiAqIEBjcmVkaXQgaHR0cHM6Ly9naXRodWIuY29tL21hdHRkaWFtb25kL1JlY29yZGVyanNcbiAqL1xuZnVuY3Rpb24gd3JpdGVVVEZCeXRlcyh2aWV3LCBvZmZzZXQsIHN0cmluZykge1xuICBjb25zdCBsZW5ndGggPSBzdHJpbmcubGVuZ3RoO1xuXG4gIGZvciAobGV0IGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspe1xuICAgIHZpZXcuc2V0VWludDgob2Zmc2V0ICsgaSwgc3RyaW5nLmNoYXJDb2RlQXQoaSkpO1xuICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gd3JpdGVVVEZCeXRlcztcbiIsIihmdW5jdGlvbihyb290KSB7XG4gICd1c2Ugc3RyaWN0JztcblxuICBmdW5jdGlvbiBodHRwTWVzc2FnZVBhcnNlcihtZXNzYWdlKSB7XG4gICAgY29uc3QgcmVzdWx0ID0ge1xuICAgICAgaHR0cFZlcnNpb246IG51bGwsXG4gICAgICBzdGF0dXNDb2RlOiBudWxsLFxuICAgICAgc3RhdHVzTWVzc2FnZTogbnVsbCxcbiAgICAgIG1ldGhvZDogbnVsbCxcbiAgICAgIHVybDogbnVsbCxcbiAgICAgIGhlYWRlcnM6IG51bGwsXG4gICAgICBib2R5OiBudWxsLFxuICAgICAgYm91bmRhcnk6IG51bGwsXG4gICAgICBtdWx0aXBhcnQ6IG51bGxcbiAgICB9O1xuXG4gICAgdmFyIG1lc3NhZ2VTdHJpbmcgPSAnJztcbiAgICB2YXIgaGVhZGVyTmV3bGluZUluZGV4ID0gMDtcbiAgICB2YXIgZnVsbEJvdW5kYXJ5ID0gbnVsbDtcblxuICAgIGlmIChodHRwTWVzc2FnZVBhcnNlci5faXNCdWZmZXIobWVzc2FnZSkpIHtcbiAgICAgIG1lc3NhZ2VTdHJpbmcgPSBtZXNzYWdlLnRvU3RyaW5nKCk7XG4gICAgfSBlbHNlIGlmICh0eXBlb2YgbWVzc2FnZSA9PT0gJ3N0cmluZycpIHtcbiAgICAgIG1lc3NhZ2VTdHJpbmcgPSBtZXNzYWdlO1xuICAgICAgbWVzc2FnZSA9IGh0dHBNZXNzYWdlUGFyc2VyLl9jcmVhdGVCdWZmZXIobWVzc2FnZVN0cmluZyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfVxuXG4gICAgLypcbiAgICAgKiBTdHJpcCBleHRyYSByZXR1cm4gY2hhcmFjdGVyc1xuICAgICAqL1xuICAgIG1lc3NhZ2VTdHJpbmcgPSBtZXNzYWdlU3RyaW5nLnJlcGxhY2UoL1xcclxcbi9naW0sICdcXG4nKTtcblxuICAgIC8qXG4gICAgICogVHJpbSBsZWFkaW5nIHdoaXRlc3BhY2VcbiAgICAgKi9cbiAgICAoZnVuY3Rpb24oKSB7XG4gICAgICBjb25zdCBmaXJzdE5vbldoaXRlc3BhY2VSZWdleCA9IC9bXFx3LV0rL2dpbTtcbiAgICAgIGNvbnN0IGZpcnN0Tm9uV2hpdGVzcGFjZUluZGV4ID0gbWVzc2FnZVN0cmluZy5zZWFyY2goZmlyc3ROb25XaGl0ZXNwYWNlUmVnZXgpO1xuICAgICAgaWYgKGZpcnN0Tm9uV2hpdGVzcGFjZUluZGV4ID4gMCkge1xuICAgICAgICBtZXNzYWdlID0gbWVzc2FnZS5zbGljZShmaXJzdE5vbldoaXRlc3BhY2VJbmRleCwgbWVzc2FnZS5sZW5ndGgpO1xuICAgICAgICBtZXNzYWdlU3RyaW5nID0gbWVzc2FnZS50b1N0cmluZygpO1xuICAgICAgfVxuICAgIH0pKCk7XG5cbiAgICAvKiBQYXJzZSByZXF1ZXN0IGxpbmVcbiAgICAgKi9cbiAgICAoZnVuY3Rpb24oKSB7XG4gICAgICBjb25zdCBwb3NzaWJsZVJlcXVlc3RMaW5lID0gbWVzc2FnZVN0cmluZy5zcGxpdCgvXFxufFxcclxcbi8pWzBdO1xuICAgICAgY29uc3QgcmVxdWVzdExpbmVNYXRjaCA9IHBvc3NpYmxlUmVxdWVzdExpbmUubWF0Y2goaHR0cE1lc3NhZ2VQYXJzZXIuX3JlcXVlc3RMaW5lUmVnZXgpO1xuXG4gICAgICBpZiAoQXJyYXkuaXNBcnJheShyZXF1ZXN0TGluZU1hdGNoKSAmJiByZXF1ZXN0TGluZU1hdGNoLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgcmVzdWx0Lmh0dHBWZXJzaW9uID0gcGFyc2VGbG9hdChyZXF1ZXN0TGluZU1hdGNoWzFdKTtcbiAgICAgICAgcmVzdWx0LnN0YXR1c0NvZGUgPSBwYXJzZUludChyZXF1ZXN0TGluZU1hdGNoWzJdKTtcbiAgICAgICAgcmVzdWx0LnN0YXR1c01lc3NhZ2UgPSByZXF1ZXN0TGluZU1hdGNoWzNdO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uc3QgcmVzcG9uc2VMaW5lTWF0aCA9IHBvc3NpYmxlUmVxdWVzdExpbmUubWF0Y2goaHR0cE1lc3NhZ2VQYXJzZXIuX3Jlc3BvbnNlTGluZVJlZ2V4KTtcbiAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkocmVzcG9uc2VMaW5lTWF0aCkgJiYgcmVzcG9uc2VMaW5lTWF0aC5sZW5ndGggPiAxKSB7XG4gICAgICAgICAgcmVzdWx0Lm1ldGhvZCA9IHJlc3BvbnNlTGluZU1hdGhbMV07XG4gICAgICAgICAgcmVzdWx0LnVybCA9IHJlc3BvbnNlTGluZU1hdGhbMl07XG4gICAgICAgICAgcmVzdWx0Lmh0dHBWZXJzaW9uID0gcGFyc2VGbG9hdChyZXNwb25zZUxpbmVNYXRoWzNdKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0pKCk7XG5cbiAgICAvKiBQYXJzZSBoZWFkZXJzXG4gICAgICovXG4gICAgKGZ1bmN0aW9uKCkge1xuICAgICAgaGVhZGVyTmV3bGluZUluZGV4ID0gbWVzc2FnZVN0cmluZy5zZWFyY2goaHR0cE1lc3NhZ2VQYXJzZXIuX2hlYWRlck5ld2xpbmVSZWdleCk7XG4gICAgICBpZiAoaGVhZGVyTmV3bGluZUluZGV4ID4gLTEpIHtcbiAgICAgICAgaGVhZGVyTmV3bGluZUluZGV4ID0gaGVhZGVyTmV3bGluZUluZGV4ICsgMTsgLy8gMSBmb3IgbmV3bGluZSBsZW5ndGhcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8qIFRoZXJlJ3Mgbm8gbGluZSBicmVha3Mgc28gY2hlY2sgaWYgcmVxdWVzdCBsaW5lIGV4aXN0c1xuICAgICAgICAgKiBiZWNhdXNlIHRoZSBtZXNzYWdlIG1pZ2h0IGJlIGFsbCBoZWFkZXJzIGFuZCBubyBib2R5XG4gICAgICAgICAqL1xuICAgICAgICBpZiAocmVzdWx0Lmh0dHBWZXJzaW9uKSB7XG4gICAgICAgICAgaGVhZGVyTmV3bGluZUluZGV4ID0gbWVzc2FnZVN0cmluZy5sZW5ndGg7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgY29uc3QgaGVhZGVyc1N0cmluZyA9IG1lc3NhZ2VTdHJpbmcuc3Vic3RyKDAsIGhlYWRlck5ld2xpbmVJbmRleCk7XG4gICAgICBjb25zdCBoZWFkZXJzID0gaHR0cE1lc3NhZ2VQYXJzZXIuX3BhcnNlSGVhZGVycyhoZWFkZXJzU3RyaW5nKTtcblxuICAgICAgaWYgKE9iamVjdC5rZXlzKGhlYWRlcnMpLmxlbmd0aCA+IDApIHtcbiAgICAgICAgcmVzdWx0LmhlYWRlcnMgPSBoZWFkZXJzO1xuXG4gICAgICAgIC8vIFRPT0Q6IGV4dHJhY3QgYm91bmRhcnkuXG4gICAgICB9XG4gICAgfSkoKTtcblxuICAgIC8qIFRyeSB0byBnZXQgYm91bmRhcnkgaWYgbm8gYm91bmRhcnkgaGVhZGVyXG4gICAgICovXG4gICAgKGZ1bmN0aW9uKCkge1xuICAgICAgaWYgKCFyZXN1bHQuYm91bmRhcnkpIHtcbiAgICAgICAgY29uc3QgYm91bmRhcnlNYXRjaCA9IG1lc3NhZ2VTdHJpbmcubWF0Y2goaHR0cE1lc3NhZ2VQYXJzZXIuX2JvdW5kYXJ5UmVnZXgpO1xuXG4gICAgICAgIGlmIChBcnJheS5pc0FycmF5KGJvdW5kYXJ5TWF0Y2gpICYmIGJvdW5kYXJ5TWF0Y2gubGVuZ3RoKSB7XG4gICAgICAgICAgZnVsbEJvdW5kYXJ5ID0gYm91bmRhcnlNYXRjaFswXS5yZXBsYWNlKC9bXFxyXFxuXSsvZ2ksICcnKTtcbiAgICAgICAgICBjb25zdCBib3VuZGFyeSA9IGZ1bGxCb3VuZGFyeS5yZXBsYWNlKC9eLS0vLCcnKTtcbiAgICAgICAgICByZXN1bHQuYm91bmRhcnkgPSBib3VuZGFyeTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0pKCk7XG5cbiAgICAvKiBQYXJzZSBib2R5XG4gICAgICovXG4gICAgKGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIHN0YXJ0ID0gaGVhZGVyTmV3bGluZUluZGV4O1xuICAgICAgdmFyIGVuZCA9IG1lc3NhZ2UubGVuZ3RoO1xuICAgICAgY29uc3QgZmlyc3RCb3VuZGFyeUluZGV4ID0gbWVzc2FnZVN0cmluZy5pbmRleE9mKGZ1bGxCb3VuZGFyeSk7XG5cbiAgICAgIGlmIChmaXJzdEJvdW5kYXJ5SW5kZXggPiAtMSkge1xuICAgICAgICBzdGFydCA9IGhlYWRlck5ld2xpbmVJbmRleDtcbiAgICAgICAgZW5kID0gZmlyc3RCb3VuZGFyeUluZGV4O1xuICAgICAgfVxuXG4gICAgICBpZiAoaGVhZGVyTmV3bGluZUluZGV4ID4gLTEpIHtcbiAgICAgICAgY29uc3QgYm9keSA9IG1lc3NhZ2Uuc2xpY2Uoc3RhcnQsIGVuZCk7XG5cbiAgICAgICAgaWYgKGJvZHkgJiYgYm9keS5sZW5ndGgpIHtcbiAgICAgICAgICByZXN1bHQuYm9keSA9IGh0dHBNZXNzYWdlUGFyc2VyLl9pc0Zha2VCdWZmZXIoYm9keSkgPyBib2R5LnRvU3RyaW5nKCkgOiBib2R5O1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSkoKTtcblxuICAgIC8qIFBhcnNlIG11bHRpcGFydCBzZWN0aW9uc1xuICAgICAqL1xuICAgIChmdW5jdGlvbigpIHtcbiAgICAgIGlmIChyZXN1bHQuYm91bmRhcnkpIHtcbiAgICAgICAgY29uc3QgbXVsdGlwYXJ0U3RhcnQgPSBtZXNzYWdlU3RyaW5nLmluZGV4T2YoZnVsbEJvdW5kYXJ5KSArIGZ1bGxCb3VuZGFyeS5sZW5ndGg7XG4gICAgICAgIGNvbnN0IG11bHRpcGFydEVuZCA9IG1lc3NhZ2VTdHJpbmcubGFzdEluZGV4T2YoZnVsbEJvdW5kYXJ5KTtcbiAgICAgICAgY29uc3QgbXVsdGlwYXJ0Qm9keSA9IG1lc3NhZ2VTdHJpbmcuc3Vic3RyKG11bHRpcGFydFN0YXJ0LCBtdWx0aXBhcnRFbmQpO1xuICAgICAgICBjb25zdCBwYXJ0cyA9IG11bHRpcGFydEJvZHkuc3BsaXQoZnVsbEJvdW5kYXJ5KTtcblxuICAgICAgICByZXN1bHQubXVsdGlwYXJ0ID0gcGFydHMuZmlsdGVyKGh0dHBNZXNzYWdlUGFyc2VyLl9pc1RydXRoeSkubWFwKGZ1bmN0aW9uKHBhcnQsIGkpIHtcbiAgICAgICAgICBjb25zdCByZXN1bHQgPSB7XG4gICAgICAgICAgICBoZWFkZXJzOiBudWxsLFxuICAgICAgICAgICAgYm9keTogbnVsbFxuICAgICAgICAgIH07XG5cbiAgICAgICAgICBjb25zdCBuZXdsaW5lUmVnZXggPSAvXFxuXFxufFxcclxcblxcclxcbi9naW07XG4gICAgICAgICAgdmFyIG5ld2xpbmVJbmRleCA9IDA7XG4gICAgICAgICAgdmFyIG5ld2xpbmVNYXRjaCA9IG5ld2xpbmVSZWdleC5leGVjKHBhcnQpO1xuICAgICAgICAgIHZhciBib2R5ID0gbnVsbDtcblxuICAgICAgICAgIGlmIChuZXdsaW5lTWF0Y2gpIHtcbiAgICAgICAgICAgIG5ld2xpbmVJbmRleCA9IG5ld2xpbmVNYXRjaC5pbmRleDtcbiAgICAgICAgICAgIGlmIChuZXdsaW5lTWF0Y2guaW5kZXggPD0gMCkge1xuICAgICAgICAgICAgICBuZXdsaW5lTWF0Y2ggPSBuZXdsaW5lUmVnZXguZXhlYyhwYXJ0KTtcbiAgICAgICAgICAgICAgaWYgKG5ld2xpbmVNYXRjaCkge1xuICAgICAgICAgICAgICAgIG5ld2xpbmVJbmRleCA9IG5ld2xpbmVNYXRjaC5pbmRleDtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cblxuICAgICAgICAgIGNvbnN0IHBvc3NpYmxlSGVhZGVyc1N0cmluZyA9IHBhcnQuc3Vic3RyKDAsIG5ld2xpbmVJbmRleCk7XG5cbiAgICAgICAgICBpZiAobmV3bGluZUluZGV4ID4gLTEpIHtcbiAgICAgICAgICAgIGNvbnN0IGhlYWRlcnMgPSBodHRwTWVzc2FnZVBhcnNlci5fcGFyc2VIZWFkZXJzKHBvc3NpYmxlSGVhZGVyc1N0cmluZyk7XG4gICAgICAgICAgICBpZiAoT2JqZWN0LmtleXMoaGVhZGVycykubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICByZXN1bHQuaGVhZGVycyA9IGhlYWRlcnM7XG5cbiAgICAgICAgICAgICAgdmFyIGJvdW5kYXJ5SW5kZXhlcyA9IFtdO1xuICAgICAgICAgICAgICBmb3IgKHZhciBqID0gMDsgaiA8IG1lc3NhZ2UubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgICAgICAgICB2YXIgYm91bmRhcnlNYXRjaCA9IG1lc3NhZ2Uuc2xpY2UoaiwgaiArIGZ1bGxCb3VuZGFyeS5sZW5ndGgpLnRvU3RyaW5nKCk7XG5cbiAgICAgICAgICAgICAgICBpZiAoYm91bmRhcnlNYXRjaCA9PT0gZnVsbEJvdW5kYXJ5KSB7XG4gICAgICAgICAgICAgICAgICBib3VuZGFyeUluZGV4ZXMucHVzaChqKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICB2YXIgYm91bmRhcnlOZXdsaW5lSW5kZXhlcyA9IFtdO1xuICAgICAgICAgICAgICBib3VuZGFyeUluZGV4ZXMuc2xpY2UoMCwgYm91bmRhcnlJbmRleGVzLmxlbmd0aCAtIDEpLmZvckVhY2goZnVuY3Rpb24obSwgaykge1xuICAgICAgICAgICAgICAgIGNvbnN0IHBhcnRCb2R5ID0gbWVzc2FnZS5zbGljZShib3VuZGFyeUluZGV4ZXNba10sIGJvdW5kYXJ5SW5kZXhlc1trICsgMV0pLnRvU3RyaW5nKCk7XG4gICAgICAgICAgICAgICAgdmFyIGhlYWRlck5ld2xpbmVJbmRleCA9IHBhcnRCb2R5LnNlYXJjaCgvXFxuXFxufFxcclxcblxcclxcbi9naW0pICsgMjtcbiAgICAgICAgICAgICAgICBoZWFkZXJOZXdsaW5lSW5kZXggID0gYm91bmRhcnlJbmRleGVzW2tdICsgaGVhZGVyTmV3bGluZUluZGV4O1xuICAgICAgICAgICAgICAgIGJvdW5kYXJ5TmV3bGluZUluZGV4ZXMucHVzaChoZWFkZXJOZXdsaW5lSW5kZXgpO1xuICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgICBib2R5ID0gbWVzc2FnZS5zbGljZShib3VuZGFyeU5ld2xpbmVJbmRleGVzW2ldLCBib3VuZGFyeUluZGV4ZXNbaSArIDFdKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIGJvZHkgPSBwYXJ0O1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBib2R5ID0gcGFydDtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICByZXN1bHQuYm9keSA9IGh0dHBNZXNzYWdlUGFyc2VyLl9pc0Zha2VCdWZmZXIoYm9keSkgPyBib2R5LnRvU3RyaW5nKCkgOiBib2R5O1xuXG4gICAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfSkoKTtcblxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICBodHRwTWVzc2FnZVBhcnNlci5faXNUcnV0aHkgPSBmdW5jdGlvbiBfaXNUcnV0aHkodikge1xuICAgIHJldHVybiAhIXY7XG4gIH07XG5cbiAgaHR0cE1lc3NhZ2VQYXJzZXIuX2lzTnVtZXJpYyA9IGZ1bmN0aW9uIF9pc051bWVyaWModikge1xuICAgIGlmICh0eXBlb2YgdiA9PT0gJ251bWJlcicgJiYgIWlzTmFOKHYpKSB7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICB2ID0gKHZ8fCcnKS50b1N0cmluZygpLnRyaW0oKTtcblxuICAgIGlmICghdikge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIHJldHVybiAhaXNOYU4odik7XG4gIH07XG5cbiAgaHR0cE1lc3NhZ2VQYXJzZXIuX2lzQnVmZmVyID0gZnVuY3Rpb24oaXRlbSkge1xuICAgIHJldHVybiAoKGh0dHBNZXNzYWdlUGFyc2VyLl9pc05vZGVCdWZmZXJTdXBwb3J0ZWQoKSAmJlxuICAgICAgICAgICAgdHlwZW9mIGdsb2JhbCA9PT0gJ29iamVjdCcgJiZcbiAgICAgICAgICAgIGdsb2JhbC5CdWZmZXIuaXNCdWZmZXIoaXRlbSkpIHx8XG4gICAgICAgICAgICAoaXRlbSBpbnN0YW5jZW9mIE9iamVjdCAmJlxuICAgICAgICAgICAgIGl0ZW0uX2lzQnVmZmVyKSk7XG4gIH07XG5cbiAgaHR0cE1lc3NhZ2VQYXJzZXIuX2lzTm9kZUJ1ZmZlclN1cHBvcnRlZCA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiAodHlwZW9mIGdsb2JhbCA9PT0gJ29iamVjdCcgJiZcbiAgICAgICAgICAgIHR5cGVvZiBnbG9iYWwuQnVmZmVyID09PSAnZnVuY3Rpb24nICYmXG4gICAgICAgICAgICB0eXBlb2YgZ2xvYmFsLkJ1ZmZlci5pc0J1ZmZlciA9PT0gJ2Z1bmN0aW9uJyk7XG4gIH07XG5cbiAgaHR0cE1lc3NhZ2VQYXJzZXIuX3BhcnNlSGVhZGVycyA9IGZ1bmN0aW9uIF9wYXJzZUhlYWRlcnMoYm9keSkge1xuICAgIGNvbnN0IGhlYWRlcnMgPSB7fTtcblxuICAgIGlmICh0eXBlb2YgYm9keSAhPT0gJ3N0cmluZycpIHtcbiAgICAgIHJldHVybiBoZWFkZXJzO1xuICAgIH1cblxuICAgIGJvZHkuc3BsaXQoL1tcXHJcXG5dLykuZm9yRWFjaChmdW5jdGlvbihzdHJpbmcpIHtcbiAgICAgIGNvbnN0IG1hdGNoID0gc3RyaW5nLm1hdGNoKC8oW1xcdy1dKyk6XFxzKiguKikvaSk7XG5cbiAgICAgIGlmIChBcnJheS5pc0FycmF5KG1hdGNoKSAmJiBtYXRjaC5sZW5ndGggPT09IDMpIHtcbiAgICAgICAgY29uc3Qga2V5ID0gbWF0Y2hbMV07XG4gICAgICAgIGNvbnN0IHZhbHVlID0gbWF0Y2hbMl07XG5cbiAgICAgICAgaGVhZGVyc1trZXldID0gaHR0cE1lc3NhZ2VQYXJzZXIuX2lzTnVtZXJpYyh2YWx1ZSkgPyBOdW1iZXIodmFsdWUpIDogdmFsdWU7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICByZXR1cm4gaGVhZGVycztcbiAgfTtcblxuICBodHRwTWVzc2FnZVBhcnNlci5fcmVxdWVzdExpbmVSZWdleCA9IC9IVFRQXFwvKDFcXC4wfDFcXC4xfDJcXC4wKVxccysoXFxkKylcXHMrKFtcXHdcXHMtX10rKS9pO1xuICBodHRwTWVzc2FnZVBhcnNlci5fcmVzcG9uc2VMaW5lUmVnZXggPSAvKEdFVHxQT1NUfFBVVHxERUxFVEV8UEFUQ0h8T1BUSU9OU3xIRUFEfFRSQUNFfENPTk5FQ1QpXFxzKyguKilcXHMrSFRUUFxcLygxXFwuMHwxXFwuMXwyXFwuMCkvaTtcbiAgaHR0cE1lc3NhZ2VQYXJzZXIuX2hlYWRlck5ld2xpbmVSZWdleCA9IC9eW1xcclxcbl0rL2dpbTtcbiAgaHR0cE1lc3NhZ2VQYXJzZXIuX2JvdW5kYXJ5UmVnZXggPSAvKFxcbnxcXHJcXG4pKy0tW1xcdy1dKyhcXG58XFxyXFxuKSsvZztcblxuICBodHRwTWVzc2FnZVBhcnNlci5fY3JlYXRlQnVmZmVyID0gZnVuY3Rpb24oZGF0YSkge1xuICAgIGlmIChodHRwTWVzc2FnZVBhcnNlci5faXNOb2RlQnVmZmVyU3VwcG9ydGVkKCkpIHtcbiAgICAgIHJldHVybiBuZXcgQnVmZmVyKGRhdGEpO1xuICAgIH1cblxuICAgIHJldHVybiBuZXcgaHR0cE1lc3NhZ2VQYXJzZXIuX0Zha2VCdWZmZXIoZGF0YSk7XG4gIH07XG5cbiAgaHR0cE1lc3NhZ2VQYXJzZXIuX2lzRmFrZUJ1ZmZlciA9IGZ1bmN0aW9uIGlzRmFrZUJ1ZmZlcihvYmopIHtcbiAgICByZXR1cm4gb2JqIGluc3RhbmNlb2YgaHR0cE1lc3NhZ2VQYXJzZXIuX0Zha2VCdWZmZXI7XG4gIH07XG5cbiAgaHR0cE1lc3NhZ2VQYXJzZXIuX0Zha2VCdWZmZXIgPSBmdW5jdGlvbiBGYWtlQnVmZmVyKGRhdGEpIHtcbiAgICBpZiAoISh0aGlzIGluc3RhbmNlb2YgaHR0cE1lc3NhZ2VQYXJzZXIuX0Zha2VCdWZmZXIpKSB7XG4gICAgICByZXR1cm4gbmV3IGh0dHBNZXNzYWdlUGFyc2VyLl9GYWtlQnVmZmVyKGRhdGEpO1xuICAgIH1cblxuICAgIHRoaXMuZGF0YSA9IFtdO1xuXG4gICAgaWYgKEFycmF5LmlzQXJyYXkoZGF0YSkpIHtcbiAgICAgIHRoaXMuZGF0YSA9IGRhdGE7XG4gICAgfSBlbHNlIGlmICh0eXBlb2YgZGF0YSA9PT0gJ3N0cmluZycpIHtcbiAgICAgIHRoaXMuZGF0YSA9IFtdLnNsaWNlLmNhbGwoZGF0YSk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gTGl2ZU9iamVjdCgpIHt9XG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KExpdmVPYmplY3QucHJvdG90eXBlLCAnbGVuZ3RoJywge1xuICAgICAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZGF0YS5sZW5ndGg7XG4gICAgICB9LmJpbmQodGhpcylcbiAgICB9KTtcblxuICAgIHRoaXMubGVuZ3RoID0gKG5ldyBMaXZlT2JqZWN0KCkpLmxlbmd0aDtcbiAgfTtcblxuICBodHRwTWVzc2FnZVBhcnNlci5fRmFrZUJ1ZmZlci5wcm90b3R5cGUuc2xpY2UgPSBmdW5jdGlvbiBzbGljZSgpIHtcbiAgICB2YXIgbmV3QXJyYXkgPSBbXS5zbGljZS5hcHBseSh0aGlzLmRhdGEsIGFyZ3VtZW50cyk7XG4gICAgcmV0dXJuIG5ldyBodHRwTWVzc2FnZVBhcnNlci5fRmFrZUJ1ZmZlcihuZXdBcnJheSk7XG4gIH07XG5cbiAgaHR0cE1lc3NhZ2VQYXJzZXIuX0Zha2VCdWZmZXIucHJvdG90eXBlLnNlYXJjaCA9IGZ1bmN0aW9uIHNlYXJjaCgpIHtcbiAgICByZXR1cm4gW10uc2VhcmNoLmFwcGx5KHRoaXMuZGF0YSwgYXJndW1lbnRzKTtcbiAgfTtcblxuICBodHRwTWVzc2FnZVBhcnNlci5fRmFrZUJ1ZmZlci5wcm90b3R5cGUuaW5kZXhPZiA9IGZ1bmN0aW9uIGluZGV4T2YoKSB7XG4gICAgcmV0dXJuIFtdLmluZGV4T2YuYXBwbHkodGhpcy5kYXRhLCBhcmd1bWVudHMpO1xuICB9O1xuXG4gIGh0dHBNZXNzYWdlUGFyc2VyLl9GYWtlQnVmZmVyLnByb3RvdHlwZS50b1N0cmluZyA9IGZ1bmN0aW9uIHRvU3RyaW5nKCkge1xuICAgIHJldHVybiB0aGlzLmRhdGEuam9pbignJyk7XG4gIH07XG5cbiAgaWYgKHR5cGVvZiBleHBvcnRzICE9PSAndW5kZWZpbmVkJykge1xuICAgIGlmICh0eXBlb2YgbW9kdWxlICE9PSAndW5kZWZpbmVkJyAmJiBtb2R1bGUuZXhwb3J0cykge1xuICAgICAgZXhwb3J0cyA9IG1vZHVsZS5leHBvcnRzID0gaHR0cE1lc3NhZ2VQYXJzZXI7XG4gICAgfVxuICAgIGV4cG9ydHMuaHR0cE1lc3NhZ2VQYXJzZXIgPSBodHRwTWVzc2FnZVBhcnNlcjtcbiAgfSBlbHNlIGlmICh0eXBlb2YgZGVmaW5lID09PSAnZnVuY3Rpb24nICYmIGRlZmluZS5hbWQpIHtcbiAgICBkZWZpbmUoW10sIGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIGh0dHBNZXNzYWdlUGFyc2VyO1xuICAgIH0pO1xuICB9IGVsc2Uge1xuICAgIHJvb3QuaHR0cE1lc3NhZ2VQYXJzZXIgPSBodHRwTWVzc2FnZVBhcnNlcjtcbiAgfVxuXG59KSh0aGlzKTtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIFN0cmluZ2lmeSA9IHJlcXVpcmUoJy4vc3RyaW5naWZ5Jyk7XG52YXIgUGFyc2UgPSByZXF1aXJlKCcuL3BhcnNlJyk7XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICAgIHN0cmluZ2lmeTogU3RyaW5naWZ5LFxuICAgIHBhcnNlOiBQYXJzZVxufTtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIFV0aWxzID0gcmVxdWlyZSgnLi91dGlscycpO1xuXG52YXIgaW50ZXJuYWxzID0ge1xuICAgIGRlbGltaXRlcjogJyYnLFxuICAgIGRlcHRoOiA1LFxuICAgIGFycmF5TGltaXQ6IDIwLFxuICAgIHBhcmFtZXRlckxpbWl0OiAxMDAwLFxuICAgIHN0cmljdE51bGxIYW5kbGluZzogZmFsc2UsXG4gICAgcGxhaW5PYmplY3RzOiBmYWxzZSxcbiAgICBhbGxvd1Byb3RvdHlwZXM6IGZhbHNlLFxuICAgIGFsbG93RG90czogZmFsc2Vcbn07XG5cbmludGVybmFscy5wYXJzZVZhbHVlcyA9IGZ1bmN0aW9uIChzdHIsIG9wdGlvbnMpIHtcbiAgICB2YXIgb2JqID0ge307XG4gICAgdmFyIHBhcnRzID0gc3RyLnNwbGl0KG9wdGlvbnMuZGVsaW1pdGVyLCBvcHRpb25zLnBhcmFtZXRlckxpbWl0ID09PSBJbmZpbml0eSA/IHVuZGVmaW5lZCA6IG9wdGlvbnMucGFyYW1ldGVyTGltaXQpO1xuXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBwYXJ0cy5sZW5ndGg7ICsraSkge1xuICAgICAgICB2YXIgcGFydCA9IHBhcnRzW2ldO1xuICAgICAgICB2YXIgcG9zID0gcGFydC5pbmRleE9mKCddPScpID09PSAtMSA/IHBhcnQuaW5kZXhPZignPScpIDogcGFydC5pbmRleE9mKCddPScpICsgMTtcblxuICAgICAgICBpZiAocG9zID09PSAtMSkge1xuICAgICAgICAgICAgb2JqW1V0aWxzLmRlY29kZShwYXJ0KV0gPSAnJztcblxuICAgICAgICAgICAgaWYgKG9wdGlvbnMuc3RyaWN0TnVsbEhhbmRsaW5nKSB7XG4gICAgICAgICAgICAgICAgb2JqW1V0aWxzLmRlY29kZShwYXJ0KV0gPSBudWxsO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdmFyIGtleSA9IFV0aWxzLmRlY29kZShwYXJ0LnNsaWNlKDAsIHBvcykpO1xuICAgICAgICAgICAgdmFyIHZhbCA9IFV0aWxzLmRlY29kZShwYXJ0LnNsaWNlKHBvcyArIDEpKTtcblxuICAgICAgICAgICAgaWYgKE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChvYmosIGtleSkpIHtcbiAgICAgICAgICAgICAgICBvYmpba2V5XSA9IFtdLmNvbmNhdChvYmpba2V5XSkuY29uY2F0KHZhbCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIG9ialtrZXldID0gdmFsO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIG9iajtcbn07XG5cbmludGVybmFscy5wYXJzZU9iamVjdCA9IGZ1bmN0aW9uIChjaGFpbiwgdmFsLCBvcHRpb25zKSB7XG4gICAgaWYgKCFjaGFpbi5sZW5ndGgpIHtcbiAgICAgICAgcmV0dXJuIHZhbDtcbiAgICB9XG5cbiAgICB2YXIgcm9vdCA9IGNoYWluLnNoaWZ0KCk7XG5cbiAgICB2YXIgb2JqO1xuICAgIGlmIChyb290ID09PSAnW10nKSB7XG4gICAgICAgIG9iaiA9IFtdO1xuICAgICAgICBvYmogPSBvYmouY29uY2F0KGludGVybmFscy5wYXJzZU9iamVjdChjaGFpbiwgdmFsLCBvcHRpb25zKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgb2JqID0gb3B0aW9ucy5wbGFpbk9iamVjdHMgPyBPYmplY3QuY3JlYXRlKG51bGwpIDoge307XG4gICAgICAgIHZhciBjbGVhblJvb3QgPSByb290WzBdID09PSAnWycgJiYgcm9vdFtyb290Lmxlbmd0aCAtIDFdID09PSAnXScgPyByb290LnNsaWNlKDEsIHJvb3QubGVuZ3RoIC0gMSkgOiByb290O1xuICAgICAgICB2YXIgaW5kZXggPSBwYXJzZUludChjbGVhblJvb3QsIDEwKTtcbiAgICAgICAgaWYgKFxuICAgICAgICAgICAgIWlzTmFOKGluZGV4KSAmJlxuICAgICAgICAgICAgcm9vdCAhPT0gY2xlYW5Sb290ICYmXG4gICAgICAgICAgICBTdHJpbmcoaW5kZXgpID09PSBjbGVhblJvb3QgJiZcbiAgICAgICAgICAgIGluZGV4ID49IDAgJiZcbiAgICAgICAgICAgIChvcHRpb25zLnBhcnNlQXJyYXlzICYmIGluZGV4IDw9IG9wdGlvbnMuYXJyYXlMaW1pdClcbiAgICAgICAgKSB7XG4gICAgICAgICAgICBvYmogPSBbXTtcbiAgICAgICAgICAgIG9ialtpbmRleF0gPSBpbnRlcm5hbHMucGFyc2VPYmplY3QoY2hhaW4sIHZhbCwgb3B0aW9ucyk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBvYmpbY2xlYW5Sb290XSA9IGludGVybmFscy5wYXJzZU9iamVjdChjaGFpbiwgdmFsLCBvcHRpb25zKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBvYmo7XG59O1xuXG5pbnRlcm5hbHMucGFyc2VLZXlzID0gZnVuY3Rpb24gKGdpdmVuS2V5LCB2YWwsIG9wdGlvbnMpIHtcbiAgICBpZiAoIWdpdmVuS2V5KSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAvLyBUcmFuc2Zvcm0gZG90IG5vdGF0aW9uIHRvIGJyYWNrZXQgbm90YXRpb25cbiAgICB2YXIga2V5ID0gb3B0aW9ucy5hbGxvd0RvdHMgPyBnaXZlbktleS5yZXBsYWNlKC9cXC4oW15cXC5cXFtdKykvZywgJ1skMV0nKSA6IGdpdmVuS2V5O1xuXG4gICAgLy8gVGhlIHJlZ2V4IGNodW5rc1xuXG4gICAgdmFyIHBhcmVudCA9IC9eKFteXFxbXFxdXSopLztcbiAgICB2YXIgY2hpbGQgPSAvKFxcW1teXFxbXFxdXSpcXF0pL2c7XG5cbiAgICAvLyBHZXQgdGhlIHBhcmVudFxuXG4gICAgdmFyIHNlZ21lbnQgPSBwYXJlbnQuZXhlYyhrZXkpO1xuXG4gICAgLy8gU3Rhc2ggdGhlIHBhcmVudCBpZiBpdCBleGlzdHNcblxuICAgIHZhciBrZXlzID0gW107XG4gICAgaWYgKHNlZ21lbnRbMV0pIHtcbiAgICAgICAgLy8gSWYgd2UgYXJlbid0IHVzaW5nIHBsYWluIG9iamVjdHMsIG9wdGlvbmFsbHkgcHJlZml4IGtleXNcbiAgICAgICAgLy8gdGhhdCB3b3VsZCBvdmVyd3JpdGUgb2JqZWN0IHByb3RvdHlwZSBwcm9wZXJ0aWVzXG4gICAgICAgIGlmICghb3B0aW9ucy5wbGFpbk9iamVjdHMgJiYgT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eShzZWdtZW50WzFdKSkge1xuICAgICAgICAgICAgaWYgKCFvcHRpb25zLmFsbG93UHJvdG90eXBlcykge1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGtleXMucHVzaChzZWdtZW50WzFdKTtcbiAgICB9XG5cbiAgICAvLyBMb29wIHRocm91Z2ggY2hpbGRyZW4gYXBwZW5kaW5nIHRvIHRoZSBhcnJheSB1bnRpbCB3ZSBoaXQgZGVwdGhcblxuICAgIHZhciBpID0gMDtcbiAgICB3aGlsZSAoKHNlZ21lbnQgPSBjaGlsZC5leGVjKGtleSkpICE9PSBudWxsICYmIGkgPCBvcHRpb25zLmRlcHRoKSB7XG4gICAgICAgIGkgKz0gMTtcbiAgICAgICAgaWYgKCFvcHRpb25zLnBsYWluT2JqZWN0cyAmJiBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5KHNlZ21lbnRbMV0ucmVwbGFjZSgvXFxbfFxcXS9nLCAnJykpKSB7XG4gICAgICAgICAgICBpZiAoIW9wdGlvbnMuYWxsb3dQcm90b3R5cGVzKSB7XG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAga2V5cy5wdXNoKHNlZ21lbnRbMV0pO1xuICAgIH1cblxuICAgIC8vIElmIHRoZXJlJ3MgYSByZW1haW5kZXIsIGp1c3QgYWRkIHdoYXRldmVyIGlzIGxlZnRcblxuICAgIGlmIChzZWdtZW50KSB7XG4gICAgICAgIGtleXMucHVzaCgnWycgKyBrZXkuc2xpY2Uoc2VnbWVudC5pbmRleCkgKyAnXScpO1xuICAgIH1cblxuICAgIHJldHVybiBpbnRlcm5hbHMucGFyc2VPYmplY3Qoa2V5cywgdmFsLCBvcHRpb25zKTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKHN0ciwgb3B0cykge1xuICAgIHZhciBvcHRpb25zID0gb3B0cyB8fCB7fTtcbiAgICBvcHRpb25zLmRlbGltaXRlciA9IHR5cGVvZiBvcHRpb25zLmRlbGltaXRlciA9PT0gJ3N0cmluZycgfHwgVXRpbHMuaXNSZWdFeHAob3B0aW9ucy5kZWxpbWl0ZXIpID8gb3B0aW9ucy5kZWxpbWl0ZXIgOiBpbnRlcm5hbHMuZGVsaW1pdGVyO1xuICAgIG9wdGlvbnMuZGVwdGggPSB0eXBlb2Ygb3B0aW9ucy5kZXB0aCA9PT0gJ251bWJlcicgPyBvcHRpb25zLmRlcHRoIDogaW50ZXJuYWxzLmRlcHRoO1xuICAgIG9wdGlvbnMuYXJyYXlMaW1pdCA9IHR5cGVvZiBvcHRpb25zLmFycmF5TGltaXQgPT09ICdudW1iZXInID8gb3B0aW9ucy5hcnJheUxpbWl0IDogaW50ZXJuYWxzLmFycmF5TGltaXQ7XG4gICAgb3B0aW9ucy5wYXJzZUFycmF5cyA9IG9wdGlvbnMucGFyc2VBcnJheXMgIT09IGZhbHNlO1xuICAgIG9wdGlvbnMuYWxsb3dEb3RzID0gdHlwZW9mIG9wdGlvbnMuYWxsb3dEb3RzID09PSAnYm9vbGVhbicgPyBvcHRpb25zLmFsbG93RG90cyA6IGludGVybmFscy5hbGxvd0RvdHM7XG4gICAgb3B0aW9ucy5wbGFpbk9iamVjdHMgPSB0eXBlb2Ygb3B0aW9ucy5wbGFpbk9iamVjdHMgPT09ICdib29sZWFuJyA/IG9wdGlvbnMucGxhaW5PYmplY3RzIDogaW50ZXJuYWxzLnBsYWluT2JqZWN0cztcbiAgICBvcHRpb25zLmFsbG93UHJvdG90eXBlcyA9IHR5cGVvZiBvcHRpb25zLmFsbG93UHJvdG90eXBlcyA9PT0gJ2Jvb2xlYW4nID8gb3B0aW9ucy5hbGxvd1Byb3RvdHlwZXMgOiBpbnRlcm5hbHMuYWxsb3dQcm90b3R5cGVzO1xuICAgIG9wdGlvbnMucGFyYW1ldGVyTGltaXQgPSB0eXBlb2Ygb3B0aW9ucy5wYXJhbWV0ZXJMaW1pdCA9PT0gJ251bWJlcicgPyBvcHRpb25zLnBhcmFtZXRlckxpbWl0IDogaW50ZXJuYWxzLnBhcmFtZXRlckxpbWl0O1xuICAgIG9wdGlvbnMuc3RyaWN0TnVsbEhhbmRsaW5nID0gdHlwZW9mIG9wdGlvbnMuc3RyaWN0TnVsbEhhbmRsaW5nID09PSAnYm9vbGVhbicgPyBvcHRpb25zLnN0cmljdE51bGxIYW5kbGluZyA6IGludGVybmFscy5zdHJpY3ROdWxsSGFuZGxpbmc7XG5cbiAgICBpZiAoXG4gICAgICAgIHN0ciA9PT0gJycgfHxcbiAgICAgICAgc3RyID09PSBudWxsIHx8XG4gICAgICAgIHR5cGVvZiBzdHIgPT09ICd1bmRlZmluZWQnXG4gICAgKSB7XG4gICAgICAgIHJldHVybiBvcHRpb25zLnBsYWluT2JqZWN0cyA/IE9iamVjdC5jcmVhdGUobnVsbCkgOiB7fTtcbiAgICB9XG5cbiAgICB2YXIgdGVtcE9iaiA9IHR5cGVvZiBzdHIgPT09ICdzdHJpbmcnID8gaW50ZXJuYWxzLnBhcnNlVmFsdWVzKHN0ciwgb3B0aW9ucykgOiBzdHI7XG4gICAgdmFyIG9iaiA9IG9wdGlvbnMucGxhaW5PYmplY3RzID8gT2JqZWN0LmNyZWF0ZShudWxsKSA6IHt9O1xuXG4gICAgLy8gSXRlcmF0ZSBvdmVyIHRoZSBrZXlzIGFuZCBzZXR1cCB0aGUgbmV3IG9iamVjdFxuXG4gICAgdmFyIGtleXMgPSBPYmplY3Qua2V5cyh0ZW1wT2JqKTtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGtleXMubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgdmFyIGtleSA9IGtleXNbaV07XG4gICAgICAgIHZhciBuZXdPYmogPSBpbnRlcm5hbHMucGFyc2VLZXlzKGtleSwgdGVtcE9ialtrZXldLCBvcHRpb25zKTtcbiAgICAgICAgb2JqID0gVXRpbHMubWVyZ2Uob2JqLCBuZXdPYmosIG9wdGlvbnMpO1xuICAgIH1cblxuICAgIHJldHVybiBVdGlscy5jb21wYWN0KG9iaik7XG59O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgVXRpbHMgPSByZXF1aXJlKCcuL3V0aWxzJyk7XG5cbnZhciBpbnRlcm5hbHMgPSB7XG4gICAgZGVsaW1pdGVyOiAnJicsXG4gICAgYXJyYXlQcmVmaXhHZW5lcmF0b3JzOiB7XG4gICAgICAgIGJyYWNrZXRzOiBmdW5jdGlvbiAocHJlZml4KSB7XG4gICAgICAgICAgICByZXR1cm4gcHJlZml4ICsgJ1tdJztcbiAgICAgICAgfSxcbiAgICAgICAgaW5kaWNlczogZnVuY3Rpb24gKHByZWZpeCwga2V5KSB7XG4gICAgICAgICAgICByZXR1cm4gcHJlZml4ICsgJ1snICsga2V5ICsgJ10nO1xuICAgICAgICB9LFxuICAgICAgICByZXBlYXQ6IGZ1bmN0aW9uIChwcmVmaXgpIHtcbiAgICAgICAgICAgIHJldHVybiBwcmVmaXg7XG4gICAgICAgIH1cbiAgICB9LFxuICAgIHN0cmljdE51bGxIYW5kbGluZzogZmFsc2UsXG4gICAgc2tpcE51bGxzOiBmYWxzZSxcbiAgICBlbmNvZGU6IHRydWVcbn07XG5cbmludGVybmFscy5zdHJpbmdpZnkgPSBmdW5jdGlvbiAob2JqZWN0LCBwcmVmaXgsIGdlbmVyYXRlQXJyYXlQcmVmaXgsIHN0cmljdE51bGxIYW5kbGluZywgc2tpcE51bGxzLCBlbmNvZGUsIGZpbHRlciwgc29ydCwgYWxsb3dEb3RzKSB7XG4gICAgdmFyIG9iaiA9IG9iamVjdDtcbiAgICBpZiAodHlwZW9mIGZpbHRlciA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICBvYmogPSBmaWx0ZXIocHJlZml4LCBvYmopO1xuICAgIH0gZWxzZSBpZiAoVXRpbHMuaXNCdWZmZXIob2JqKSkge1xuICAgICAgICBvYmogPSBTdHJpbmcob2JqKTtcbiAgICB9IGVsc2UgaWYgKG9iaiBpbnN0YW5jZW9mIERhdGUpIHtcbiAgICAgICAgb2JqID0gb2JqLnRvSVNPU3RyaW5nKCk7XG4gICAgfSBlbHNlIGlmIChvYmogPT09IG51bGwpIHtcbiAgICAgICAgaWYgKHN0cmljdE51bGxIYW5kbGluZykge1xuICAgICAgICAgICAgcmV0dXJuIGVuY29kZSA/IFV0aWxzLmVuY29kZShwcmVmaXgpIDogcHJlZml4O1xuICAgICAgICB9XG5cbiAgICAgICAgb2JqID0gJyc7XG4gICAgfVxuXG4gICAgaWYgKHR5cGVvZiBvYmogPT09ICdzdHJpbmcnIHx8IHR5cGVvZiBvYmogPT09ICdudW1iZXInIHx8IHR5cGVvZiBvYmogPT09ICdib29sZWFuJykge1xuICAgICAgICBpZiAoZW5jb2RlKSB7XG4gICAgICAgICAgICByZXR1cm4gW1V0aWxzLmVuY29kZShwcmVmaXgpICsgJz0nICsgVXRpbHMuZW5jb2RlKG9iaildO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBbcHJlZml4ICsgJz0nICsgb2JqXTtcbiAgICB9XG5cbiAgICB2YXIgdmFsdWVzID0gW107XG5cbiAgICBpZiAodHlwZW9mIG9iaiA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgcmV0dXJuIHZhbHVlcztcbiAgICB9XG5cbiAgICB2YXIgb2JqS2V5cztcbiAgICBpZiAoQXJyYXkuaXNBcnJheShmaWx0ZXIpKSB7XG4gICAgICAgIG9iaktleXMgPSBmaWx0ZXI7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgdmFyIGtleXMgPSBPYmplY3Qua2V5cyhvYmopO1xuICAgICAgICBvYmpLZXlzID0gc29ydCA/IGtleXMuc29ydChzb3J0KSA6IGtleXM7XG4gICAgfVxuXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBvYmpLZXlzLmxlbmd0aDsgKytpKSB7XG4gICAgICAgIHZhciBrZXkgPSBvYmpLZXlzW2ldO1xuXG4gICAgICAgIGlmIChza2lwTnVsbHMgJiYgb2JqW2tleV0gPT09IG51bGwpIHtcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkob2JqKSkge1xuICAgICAgICAgICAgdmFsdWVzID0gdmFsdWVzLmNvbmNhdChpbnRlcm5hbHMuc3RyaW5naWZ5KG9ialtrZXldLCBnZW5lcmF0ZUFycmF5UHJlZml4KHByZWZpeCwga2V5KSwgZ2VuZXJhdGVBcnJheVByZWZpeCwgc3RyaWN0TnVsbEhhbmRsaW5nLCBza2lwTnVsbHMsIGVuY29kZSwgZmlsdGVyLCBzb3J0LCBhbGxvd0RvdHMpKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHZhbHVlcyA9IHZhbHVlcy5jb25jYXQoaW50ZXJuYWxzLnN0cmluZ2lmeShvYmpba2V5XSwgcHJlZml4ICsgKGFsbG93RG90cyA/ICcuJyArIGtleSA6ICdbJyArIGtleSArICddJyksIGdlbmVyYXRlQXJyYXlQcmVmaXgsIHN0cmljdE51bGxIYW5kbGluZywgc2tpcE51bGxzLCBlbmNvZGUsIGZpbHRlciwgc29ydCwgYWxsb3dEb3RzKSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gdmFsdWVzO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAob2JqZWN0LCBvcHRzKSB7XG4gICAgdmFyIG9iaiA9IG9iamVjdDtcbiAgICB2YXIgb3B0aW9ucyA9IG9wdHMgfHwge307XG4gICAgdmFyIGRlbGltaXRlciA9IHR5cGVvZiBvcHRpb25zLmRlbGltaXRlciA9PT0gJ3VuZGVmaW5lZCcgPyBpbnRlcm5hbHMuZGVsaW1pdGVyIDogb3B0aW9ucy5kZWxpbWl0ZXI7XG4gICAgdmFyIHN0cmljdE51bGxIYW5kbGluZyA9IHR5cGVvZiBvcHRpb25zLnN0cmljdE51bGxIYW5kbGluZyA9PT0gJ2Jvb2xlYW4nID8gb3B0aW9ucy5zdHJpY3ROdWxsSGFuZGxpbmcgOiBpbnRlcm5hbHMuc3RyaWN0TnVsbEhhbmRsaW5nO1xuICAgIHZhciBza2lwTnVsbHMgPSB0eXBlb2Ygb3B0aW9ucy5za2lwTnVsbHMgPT09ICdib29sZWFuJyA/IG9wdGlvbnMuc2tpcE51bGxzIDogaW50ZXJuYWxzLnNraXBOdWxscztcbiAgICB2YXIgZW5jb2RlID0gdHlwZW9mIG9wdGlvbnMuZW5jb2RlID09PSAnYm9vbGVhbicgPyBvcHRpb25zLmVuY29kZSA6IGludGVybmFscy5lbmNvZGU7XG4gICAgdmFyIHNvcnQgPSB0eXBlb2Ygb3B0aW9ucy5zb3J0ID09PSAnZnVuY3Rpb24nID8gb3B0aW9ucy5zb3J0IDogbnVsbDtcbiAgICB2YXIgYWxsb3dEb3RzID0gdHlwZW9mIG9wdGlvbnMuYWxsb3dEb3RzID09PSAndW5kZWZpbmVkJyA/IGZhbHNlIDogb3B0aW9ucy5hbGxvd0RvdHM7XG4gICAgdmFyIG9iaktleXM7XG4gICAgdmFyIGZpbHRlcjtcbiAgICBpZiAodHlwZW9mIG9wdGlvbnMuZmlsdGVyID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIGZpbHRlciA9IG9wdGlvbnMuZmlsdGVyO1xuICAgICAgICBvYmogPSBmaWx0ZXIoJycsIG9iaik7XG4gICAgfSBlbHNlIGlmIChBcnJheS5pc0FycmF5KG9wdGlvbnMuZmlsdGVyKSkge1xuICAgICAgICBvYmpLZXlzID0gZmlsdGVyID0gb3B0aW9ucy5maWx0ZXI7XG4gICAgfVxuXG4gICAgdmFyIGtleXMgPSBbXTtcblxuICAgIGlmICh0eXBlb2Ygb2JqICE9PSAnb2JqZWN0JyB8fCBvYmogPT09IG51bGwpIHtcbiAgICAgICAgcmV0dXJuICcnO1xuICAgIH1cblxuICAgIHZhciBhcnJheUZvcm1hdDtcbiAgICBpZiAob3B0aW9ucy5hcnJheUZvcm1hdCBpbiBpbnRlcm5hbHMuYXJyYXlQcmVmaXhHZW5lcmF0b3JzKSB7XG4gICAgICAgIGFycmF5Rm9ybWF0ID0gb3B0aW9ucy5hcnJheUZvcm1hdDtcbiAgICB9IGVsc2UgaWYgKCdpbmRpY2VzJyBpbiBvcHRpb25zKSB7XG4gICAgICAgIGFycmF5Rm9ybWF0ID0gb3B0aW9ucy5pbmRpY2VzID8gJ2luZGljZXMnIDogJ3JlcGVhdCc7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgYXJyYXlGb3JtYXQgPSAnaW5kaWNlcyc7XG4gICAgfVxuXG4gICAgdmFyIGdlbmVyYXRlQXJyYXlQcmVmaXggPSBpbnRlcm5hbHMuYXJyYXlQcmVmaXhHZW5lcmF0b3JzW2FycmF5Rm9ybWF0XTtcblxuICAgIGlmICghb2JqS2V5cykge1xuICAgICAgICBvYmpLZXlzID0gT2JqZWN0LmtleXMob2JqKTtcbiAgICB9XG5cbiAgICBpZiAoc29ydCkge1xuICAgICAgICBvYmpLZXlzLnNvcnQoc29ydCk7XG4gICAgfVxuXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBvYmpLZXlzLmxlbmd0aDsgKytpKSB7XG4gICAgICAgIHZhciBrZXkgPSBvYmpLZXlzW2ldO1xuXG4gICAgICAgIGlmIChza2lwTnVsbHMgJiYgb2JqW2tleV0gPT09IG51bGwpIHtcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG5cbiAgICAgICAga2V5cyA9IGtleXMuY29uY2F0KGludGVybmFscy5zdHJpbmdpZnkob2JqW2tleV0sIGtleSwgZ2VuZXJhdGVBcnJheVByZWZpeCwgc3RyaWN0TnVsbEhhbmRsaW5nLCBza2lwTnVsbHMsIGVuY29kZSwgZmlsdGVyLCBzb3J0LCBhbGxvd0RvdHMpKTtcbiAgICB9XG5cbiAgICByZXR1cm4ga2V5cy5qb2luKGRlbGltaXRlcik7XG59O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgaGV4VGFibGUgPSAoZnVuY3Rpb24gKCkge1xuICAgIHZhciBhcnJheSA9IG5ldyBBcnJheSgyNTYpO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgMjU2OyArK2kpIHtcbiAgICAgICAgYXJyYXlbaV0gPSAnJScgKyAoKGkgPCAxNiA/ICcwJyA6ICcnKSArIGkudG9TdHJpbmcoMTYpKS50b1VwcGVyQ2FzZSgpO1xuICAgIH1cblxuICAgIHJldHVybiBhcnJheTtcbn0oKSk7XG5cbmV4cG9ydHMuYXJyYXlUb09iamVjdCA9IGZ1bmN0aW9uIChzb3VyY2UsIG9wdGlvbnMpIHtcbiAgICB2YXIgb2JqID0gb3B0aW9ucy5wbGFpbk9iamVjdHMgPyBPYmplY3QuY3JlYXRlKG51bGwpIDoge307XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBzb3VyY2UubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgaWYgKHR5cGVvZiBzb3VyY2VbaV0gIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICBvYmpbaV0gPSBzb3VyY2VbaV07XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gb2JqO1xufTtcblxuZXhwb3J0cy5tZXJnZSA9IGZ1bmN0aW9uICh0YXJnZXQsIHNvdXJjZSwgb3B0aW9ucykge1xuICAgIGlmICghc291cmNlKSB7XG4gICAgICAgIHJldHVybiB0YXJnZXQ7XG4gICAgfVxuXG4gICAgaWYgKHR5cGVvZiBzb3VyY2UgIT09ICdvYmplY3QnKSB7XG4gICAgICAgIGlmIChBcnJheS5pc0FycmF5KHRhcmdldCkpIHtcbiAgICAgICAgICAgIHRhcmdldC5wdXNoKHNvdXJjZSk7XG4gICAgICAgIH0gZWxzZSBpZiAodHlwZW9mIHRhcmdldCA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgICAgIHRhcmdldFtzb3VyY2VdID0gdHJ1ZTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiBbdGFyZ2V0LCBzb3VyY2VdO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHRhcmdldDtcbiAgICB9XG5cbiAgICBpZiAodHlwZW9mIHRhcmdldCAhPT0gJ29iamVjdCcpIHtcbiAgICAgICAgcmV0dXJuIFt0YXJnZXRdLmNvbmNhdChzb3VyY2UpO1xuICAgIH1cblxuICAgIHZhciBtZXJnZVRhcmdldCA9IHRhcmdldDtcbiAgICBpZiAoQXJyYXkuaXNBcnJheSh0YXJnZXQpICYmICFBcnJheS5pc0FycmF5KHNvdXJjZSkpIHtcbiAgICAgICAgbWVyZ2VUYXJnZXQgPSBleHBvcnRzLmFycmF5VG9PYmplY3QodGFyZ2V0LCBvcHRpb25zKTtcbiAgICB9XG5cblx0cmV0dXJuIE9iamVjdC5rZXlzKHNvdXJjZSkucmVkdWNlKGZ1bmN0aW9uIChhY2MsIGtleSkge1xuICAgICAgICB2YXIgdmFsdWUgPSBzb3VyY2Vba2V5XTtcblxuICAgICAgICBpZiAoT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKGFjYywga2V5KSkge1xuICAgICAgICAgICAgYWNjW2tleV0gPSBleHBvcnRzLm1lcmdlKGFjY1trZXldLCB2YWx1ZSwgb3B0aW9ucyk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBhY2Nba2V5XSA9IHZhbHVlO1xuICAgICAgICB9XG5cdFx0cmV0dXJuIGFjYztcbiAgICB9LCBtZXJnZVRhcmdldCk7XG59O1xuXG5leHBvcnRzLmRlY29kZSA9IGZ1bmN0aW9uIChzdHIpIHtcbiAgICB0cnkge1xuICAgICAgICByZXR1cm4gZGVjb2RlVVJJQ29tcG9uZW50KHN0ci5yZXBsYWNlKC9cXCsvZywgJyAnKSk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgICByZXR1cm4gc3RyO1xuICAgIH1cbn07XG5cbmV4cG9ydHMuZW5jb2RlID0gZnVuY3Rpb24gKHN0cikge1xuICAgIC8vIFRoaXMgY29kZSB3YXMgb3JpZ2luYWxseSB3cml0dGVuIGJ5IEJyaWFuIFdoaXRlIChtc2NkZXgpIGZvciB0aGUgaW8uanMgY29yZSBxdWVyeXN0cmluZyBsaWJyYXJ5LlxuICAgIC8vIEl0IGhhcyBiZWVuIGFkYXB0ZWQgaGVyZSBmb3Igc3RyaWN0ZXIgYWRoZXJlbmNlIHRvIFJGQyAzOTg2XG4gICAgaWYgKHN0ci5sZW5ndGggPT09IDApIHtcbiAgICAgICAgcmV0dXJuIHN0cjtcbiAgICB9XG5cbiAgICB2YXIgc3RyaW5nID0gdHlwZW9mIHN0ciA9PT0gJ3N0cmluZycgPyBzdHIgOiBTdHJpbmcoc3RyKTtcblxuICAgIHZhciBvdXQgPSAnJztcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHN0cmluZy5sZW5ndGg7ICsraSkge1xuICAgICAgICB2YXIgYyA9IHN0cmluZy5jaGFyQ29kZUF0KGkpO1xuXG4gICAgICAgIGlmIChcbiAgICAgICAgICAgIGMgPT09IDB4MkQgfHwgLy8gLVxuICAgICAgICAgICAgYyA9PT0gMHgyRSB8fCAvLyAuXG4gICAgICAgICAgICBjID09PSAweDVGIHx8IC8vIF9cbiAgICAgICAgICAgIGMgPT09IDB4N0UgfHwgLy8gflxuICAgICAgICAgICAgKGMgPj0gMHgzMCAmJiBjIDw9IDB4MzkpIHx8IC8vIDAtOVxuICAgICAgICAgICAgKGMgPj0gMHg0MSAmJiBjIDw9IDB4NUEpIHx8IC8vIGEtelxuICAgICAgICAgICAgKGMgPj0gMHg2MSAmJiBjIDw9IDB4N0EpIC8vIEEtWlxuICAgICAgICApIHtcbiAgICAgICAgICAgIG91dCArPSBzdHJpbmcuY2hhckF0KGkpO1xuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoYyA8IDB4ODApIHtcbiAgICAgICAgICAgIG91dCA9IG91dCArIGhleFRhYmxlW2NdO1xuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoYyA8IDB4ODAwKSB7XG4gICAgICAgICAgICBvdXQgPSBvdXQgKyAoaGV4VGFibGVbMHhDMCB8IChjID4+IDYpXSArIGhleFRhYmxlWzB4ODAgfCAoYyAmIDB4M0YpXSk7XG4gICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChjIDwgMHhEODAwIHx8IGMgPj0gMHhFMDAwKSB7XG4gICAgICAgICAgICBvdXQgPSBvdXQgKyAoaGV4VGFibGVbMHhFMCB8IChjID4+IDEyKV0gKyBoZXhUYWJsZVsweDgwIHwgKChjID4+IDYpICYgMHgzRildICsgaGV4VGFibGVbMHg4MCB8IChjICYgMHgzRildKTtcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgaSArPSAxO1xuICAgICAgICBjID0gMHgxMDAwMCArICgoKGMgJiAweDNGRikgPDwgMTApIHwgKHN0cmluZy5jaGFyQ29kZUF0KGkpICYgMHgzRkYpKTtcbiAgICAgICAgb3V0ICs9IChoZXhUYWJsZVsweEYwIHwgKGMgPj4gMTgpXSArIGhleFRhYmxlWzB4ODAgfCAoKGMgPj4gMTIpICYgMHgzRildICsgaGV4VGFibGVbMHg4MCB8ICgoYyA+PiA2KSAmIDB4M0YpXSArIGhleFRhYmxlWzB4ODAgfCAoYyAmIDB4M0YpXSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIG91dDtcbn07XG5cbmV4cG9ydHMuY29tcGFjdCA9IGZ1bmN0aW9uIChvYmosIHJlZmVyZW5jZXMpIHtcbiAgICBpZiAodHlwZW9mIG9iaiAhPT0gJ29iamVjdCcgfHwgb2JqID09PSBudWxsKSB7XG4gICAgICAgIHJldHVybiBvYmo7XG4gICAgfVxuXG4gICAgdmFyIHJlZnMgPSByZWZlcmVuY2VzIHx8IFtdO1xuICAgIHZhciBsb29rdXAgPSByZWZzLmluZGV4T2Yob2JqKTtcbiAgICBpZiAobG9va3VwICE9PSAtMSkge1xuICAgICAgICByZXR1cm4gcmVmc1tsb29rdXBdO1xuICAgIH1cblxuICAgIHJlZnMucHVzaChvYmopO1xuXG4gICAgaWYgKEFycmF5LmlzQXJyYXkob2JqKSkge1xuICAgICAgICB2YXIgY29tcGFjdGVkID0gW107XG5cbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBvYmoubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgICAgIGlmICh0eXBlb2Ygb2JqW2ldICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgICAgIGNvbXBhY3RlZC5wdXNoKG9ialtpXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gY29tcGFjdGVkO1xuICAgIH1cblxuICAgIHZhciBrZXlzID0gT2JqZWN0LmtleXMob2JqKTtcbiAgICBmb3IgKHZhciBqID0gMDsgaiA8IGtleXMubGVuZ3RoOyArK2opIHtcbiAgICAgICAgdmFyIGtleSA9IGtleXNbal07XG4gICAgICAgIG9ialtrZXldID0gZXhwb3J0cy5jb21wYWN0KG9ialtrZXldLCByZWZzKTtcbiAgICB9XG5cbiAgICByZXR1cm4gb2JqO1xufTtcblxuZXhwb3J0cy5pc1JlZ0V4cCA9IGZ1bmN0aW9uIChvYmopIHtcbiAgICByZXR1cm4gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKG9iaikgPT09ICdbb2JqZWN0IFJlZ0V4cF0nO1xufTtcblxuZXhwb3J0cy5pc0J1ZmZlciA9IGZ1bmN0aW9uIChvYmopIHtcbiAgICBpZiAob2JqID09PSBudWxsIHx8IHR5cGVvZiBvYmogPT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICByZXR1cm4gISEob2JqLmNvbnN0cnVjdG9yICYmIG9iai5jb25zdHJ1Y3Rvci5pc0J1ZmZlciAmJiBvYmouY29uc3RydWN0b3IuaXNCdWZmZXIob2JqKSk7XG59O1xuIiwiLyohXG4gKiBUaGUgYnVmZmVyIG1vZHVsZSBmcm9tIG5vZGUuanMsIGZvciB0aGUgYnJvd3Nlci5cbiAqXG4gKiBAYXV0aG9yICAgRmVyb3NzIEFib3VraGFkaWplaCA8ZmVyb3NzQGZlcm9zcy5vcmc+IDxodHRwOi8vZmVyb3NzLm9yZz5cbiAqIEBsaWNlbnNlICBNSVRcbiAqL1xuLyogZXNsaW50LWRpc2FibGUgbm8tcHJvdG8gKi9cblxuJ3VzZSBzdHJpY3QnXG5cbnZhciBiYXNlNjQgPSByZXF1aXJlKCdiYXNlNjQtanMnKVxudmFyIGllZWU3NTQgPSByZXF1aXJlKCdpZWVlNzU0JylcbnZhciBpc0FycmF5ID0gcmVxdWlyZSgnaXNhcnJheScpXG5cbmV4cG9ydHMuQnVmZmVyID0gQnVmZmVyXG5leHBvcnRzLlNsb3dCdWZmZXIgPSBTbG93QnVmZmVyXG5leHBvcnRzLklOU1BFQ1RfTUFYX0JZVEVTID0gNTBcbkJ1ZmZlci5wb29sU2l6ZSA9IDgxOTIgLy8gbm90IHVzZWQgYnkgdGhpcyBpbXBsZW1lbnRhdGlvblxuXG52YXIgcm9vdFBhcmVudCA9IHt9XG5cbi8qKlxuICogSWYgYEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUYDpcbiAqICAgPT09IHRydWUgICAgVXNlIFVpbnQ4QXJyYXkgaW1wbGVtZW50YXRpb24gKGZhc3Rlc3QpXG4gKiAgID09PSBmYWxzZSAgIFVzZSBPYmplY3QgaW1wbGVtZW50YXRpb24gKG1vc3QgY29tcGF0aWJsZSwgZXZlbiBJRTYpXG4gKlxuICogQnJvd3NlcnMgdGhhdCBzdXBwb3J0IHR5cGVkIGFycmF5cyBhcmUgSUUgMTArLCBGaXJlZm94IDQrLCBDaHJvbWUgNyssIFNhZmFyaSA1LjErLFxuICogT3BlcmEgMTEuNissIGlPUyA0LjIrLlxuICpcbiAqIER1ZSB0byB2YXJpb3VzIGJyb3dzZXIgYnVncywgc29tZXRpbWVzIHRoZSBPYmplY3QgaW1wbGVtZW50YXRpb24gd2lsbCBiZSB1c2VkIGV2ZW5cbiAqIHdoZW4gdGhlIGJyb3dzZXIgc3VwcG9ydHMgdHlwZWQgYXJyYXlzLlxuICpcbiAqIE5vdGU6XG4gKlxuICogICAtIEZpcmVmb3ggNC0yOSBsYWNrcyBzdXBwb3J0IGZvciBhZGRpbmcgbmV3IHByb3BlcnRpZXMgdG8gYFVpbnQ4QXJyYXlgIGluc3RhbmNlcyxcbiAqICAgICBTZWU6IGh0dHBzOi8vYnVnemlsbGEubW96aWxsYS5vcmcvc2hvd19idWcuY2dpP2lkPTY5NTQzOC5cbiAqXG4gKiAgIC0gQ2hyb21lIDktMTAgaXMgbWlzc2luZyB0aGUgYFR5cGVkQXJyYXkucHJvdG90eXBlLnN1YmFycmF5YCBmdW5jdGlvbi5cbiAqXG4gKiAgIC0gSUUxMCBoYXMgYSBicm9rZW4gYFR5cGVkQXJyYXkucHJvdG90eXBlLnN1YmFycmF5YCBmdW5jdGlvbiB3aGljaCByZXR1cm5zIGFycmF5cyBvZlxuICogICAgIGluY29ycmVjdCBsZW5ndGggaW4gc29tZSBzaXR1YXRpb25zLlxuXG4gKiBXZSBkZXRlY3QgdGhlc2UgYnVnZ3kgYnJvd3NlcnMgYW5kIHNldCBgQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlRgIHRvIGBmYWxzZWAgc28gdGhleVxuICogZ2V0IHRoZSBPYmplY3QgaW1wbGVtZW50YXRpb24sIHdoaWNoIGlzIHNsb3dlciBidXQgYmVoYXZlcyBjb3JyZWN0bHkuXG4gKi9cbkJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUID0gZ2xvYmFsLlRZUEVEX0FSUkFZX1NVUFBPUlQgIT09IHVuZGVmaW5lZFxuICA/IGdsb2JhbC5UWVBFRF9BUlJBWV9TVVBQT1JUXG4gIDogdHlwZWRBcnJheVN1cHBvcnQoKVxuXG5mdW5jdGlvbiB0eXBlZEFycmF5U3VwcG9ydCAoKSB7XG4gIHRyeSB7XG4gICAgdmFyIGFyciA9IG5ldyBVaW50OEFycmF5KDEpXG4gICAgYXJyLmZvbyA9IGZ1bmN0aW9uICgpIHsgcmV0dXJuIDQyIH1cbiAgICByZXR1cm4gYXJyLmZvbygpID09PSA0MiAmJiAvLyB0eXBlZCBhcnJheSBpbnN0YW5jZXMgY2FuIGJlIGF1Z21lbnRlZFxuICAgICAgICB0eXBlb2YgYXJyLnN1YmFycmF5ID09PSAnZnVuY3Rpb24nICYmIC8vIGNocm9tZSA5LTEwIGxhY2sgYHN1YmFycmF5YFxuICAgICAgICBhcnIuc3ViYXJyYXkoMSwgMSkuYnl0ZUxlbmd0aCA9PT0gMCAvLyBpZTEwIGhhcyBicm9rZW4gYHN1YmFycmF5YFxuICB9IGNhdGNoIChlKSB7XG4gICAgcmV0dXJuIGZhbHNlXG4gIH1cbn1cblxuZnVuY3Rpb24ga01heExlbmd0aCAoKSB7XG4gIHJldHVybiBCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVFxuICAgID8gMHg3ZmZmZmZmZlxuICAgIDogMHgzZmZmZmZmZlxufVxuXG4vKipcbiAqIFRoZSBCdWZmZXIgY29uc3RydWN0b3IgcmV0dXJucyBpbnN0YW5jZXMgb2YgYFVpbnQ4QXJyYXlgIHRoYXQgaGF2ZSB0aGVpclxuICogcHJvdG90eXBlIGNoYW5nZWQgdG8gYEJ1ZmZlci5wcm90b3R5cGVgLiBGdXJ0aGVybW9yZSwgYEJ1ZmZlcmAgaXMgYSBzdWJjbGFzcyBvZlxuICogYFVpbnQ4QXJyYXlgLCBzbyB0aGUgcmV0dXJuZWQgaW5zdGFuY2VzIHdpbGwgaGF2ZSBhbGwgdGhlIG5vZGUgYEJ1ZmZlcmAgbWV0aG9kc1xuICogYW5kIHRoZSBgVWludDhBcnJheWAgbWV0aG9kcy4gU3F1YXJlIGJyYWNrZXQgbm90YXRpb24gd29ya3MgYXMgZXhwZWN0ZWQgLS0gaXRcbiAqIHJldHVybnMgYSBzaW5nbGUgb2N0ZXQuXG4gKlxuICogVGhlIGBVaW50OEFycmF5YCBwcm90b3R5cGUgcmVtYWlucyB1bm1vZGlmaWVkLlxuICovXG5mdW5jdGlvbiBCdWZmZXIgKGFyZykge1xuICBpZiAoISh0aGlzIGluc3RhbmNlb2YgQnVmZmVyKSkge1xuICAgIC8vIEF2b2lkIGdvaW5nIHRocm91Z2ggYW4gQXJndW1lbnRzQWRhcHRvclRyYW1wb2xpbmUgaW4gdGhlIGNvbW1vbiBjYXNlLlxuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID4gMSkgcmV0dXJuIG5ldyBCdWZmZXIoYXJnLCBhcmd1bWVudHNbMV0pXG4gICAgcmV0dXJuIG5ldyBCdWZmZXIoYXJnKVxuICB9XG5cbiAgaWYgKCFCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkge1xuICAgIHRoaXMubGVuZ3RoID0gMFxuICAgIHRoaXMucGFyZW50ID0gdW5kZWZpbmVkXG4gIH1cblxuICAvLyBDb21tb24gY2FzZS5cbiAgaWYgKHR5cGVvZiBhcmcgPT09ICdudW1iZXInKSB7XG4gICAgcmV0dXJuIGZyb21OdW1iZXIodGhpcywgYXJnKVxuICB9XG5cbiAgLy8gU2xpZ2h0bHkgbGVzcyBjb21tb24gY2FzZS5cbiAgaWYgKHR5cGVvZiBhcmcgPT09ICdzdHJpbmcnKSB7XG4gICAgcmV0dXJuIGZyb21TdHJpbmcodGhpcywgYXJnLCBhcmd1bWVudHMubGVuZ3RoID4gMSA/IGFyZ3VtZW50c1sxXSA6ICd1dGY4JylcbiAgfVxuXG4gIC8vIFVudXN1YWwuXG4gIHJldHVybiBmcm9tT2JqZWN0KHRoaXMsIGFyZylcbn1cblxuLy8gVE9ETzogTGVnYWN5LCBub3QgbmVlZGVkIGFueW1vcmUuIFJlbW92ZSBpbiBuZXh0IG1ham9yIHZlcnNpb24uXG5CdWZmZXIuX2F1Z21lbnQgPSBmdW5jdGlvbiAoYXJyKSB7XG4gIGFyci5fX3Byb3RvX18gPSBCdWZmZXIucHJvdG90eXBlXG4gIHJldHVybiBhcnJcbn1cblxuZnVuY3Rpb24gZnJvbU51bWJlciAodGhhdCwgbGVuZ3RoKSB7XG4gIHRoYXQgPSBhbGxvY2F0ZSh0aGF0LCBsZW5ndGggPCAwID8gMCA6IGNoZWNrZWQobGVuZ3RoKSB8IDApXG4gIGlmICghQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgICB0aGF0W2ldID0gMFxuICAgIH1cbiAgfVxuICByZXR1cm4gdGhhdFxufVxuXG5mdW5jdGlvbiBmcm9tU3RyaW5nICh0aGF0LCBzdHJpbmcsIGVuY29kaW5nKSB7XG4gIGlmICh0eXBlb2YgZW5jb2RpbmcgIT09ICdzdHJpbmcnIHx8IGVuY29kaW5nID09PSAnJykgZW5jb2RpbmcgPSAndXRmOCdcblxuICAvLyBBc3N1bXB0aW9uOiBieXRlTGVuZ3RoKCkgcmV0dXJuIHZhbHVlIGlzIGFsd2F5cyA8IGtNYXhMZW5ndGguXG4gIHZhciBsZW5ndGggPSBieXRlTGVuZ3RoKHN0cmluZywgZW5jb2RpbmcpIHwgMFxuICB0aGF0ID0gYWxsb2NhdGUodGhhdCwgbGVuZ3RoKVxuXG4gIHRoYXQud3JpdGUoc3RyaW5nLCBlbmNvZGluZylcbiAgcmV0dXJuIHRoYXRcbn1cblxuZnVuY3Rpb24gZnJvbU9iamVjdCAodGhhdCwgb2JqZWN0KSB7XG4gIGlmIChCdWZmZXIuaXNCdWZmZXIob2JqZWN0KSkgcmV0dXJuIGZyb21CdWZmZXIodGhhdCwgb2JqZWN0KVxuXG4gIGlmIChpc0FycmF5KG9iamVjdCkpIHJldHVybiBmcm9tQXJyYXkodGhhdCwgb2JqZWN0KVxuXG4gIGlmIChvYmplY3QgPT0gbnVsbCkge1xuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ211c3Qgc3RhcnQgd2l0aCBudW1iZXIsIGJ1ZmZlciwgYXJyYXkgb3Igc3RyaW5nJylcbiAgfVxuXG4gIGlmICh0eXBlb2YgQXJyYXlCdWZmZXIgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgaWYgKG9iamVjdC5idWZmZXIgaW5zdGFuY2VvZiBBcnJheUJ1ZmZlcikge1xuICAgICAgcmV0dXJuIGZyb21UeXBlZEFycmF5KHRoYXQsIG9iamVjdClcbiAgICB9XG4gICAgaWYgKG9iamVjdCBpbnN0YW5jZW9mIEFycmF5QnVmZmVyKSB7XG4gICAgICByZXR1cm4gZnJvbUFycmF5QnVmZmVyKHRoYXQsIG9iamVjdClcbiAgICB9XG4gIH1cblxuICBpZiAob2JqZWN0Lmxlbmd0aCkgcmV0dXJuIGZyb21BcnJheUxpa2UodGhhdCwgb2JqZWN0KVxuXG4gIHJldHVybiBmcm9tSnNvbk9iamVjdCh0aGF0LCBvYmplY3QpXG59XG5cbmZ1bmN0aW9uIGZyb21CdWZmZXIgKHRoYXQsIGJ1ZmZlcikge1xuICB2YXIgbGVuZ3RoID0gY2hlY2tlZChidWZmZXIubGVuZ3RoKSB8IDBcbiAgdGhhdCA9IGFsbG9jYXRlKHRoYXQsIGxlbmd0aClcbiAgYnVmZmVyLmNvcHkodGhhdCwgMCwgMCwgbGVuZ3RoKVxuICByZXR1cm4gdGhhdFxufVxuXG5mdW5jdGlvbiBmcm9tQXJyYXkgKHRoYXQsIGFycmF5KSB7XG4gIHZhciBsZW5ndGggPSBjaGVja2VkKGFycmF5Lmxlbmd0aCkgfCAwXG4gIHRoYXQgPSBhbGxvY2F0ZSh0aGF0LCBsZW5ndGgpXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuZ3RoOyBpICs9IDEpIHtcbiAgICB0aGF0W2ldID0gYXJyYXlbaV0gJiAyNTVcbiAgfVxuICByZXR1cm4gdGhhdFxufVxuXG4vLyBEdXBsaWNhdGUgb2YgZnJvbUFycmF5KCkgdG8ga2VlcCBmcm9tQXJyYXkoKSBtb25vbW9ycGhpYy5cbmZ1bmN0aW9uIGZyb21UeXBlZEFycmF5ICh0aGF0LCBhcnJheSkge1xuICB2YXIgbGVuZ3RoID0gY2hlY2tlZChhcnJheS5sZW5ndGgpIHwgMFxuICB0aGF0ID0gYWxsb2NhdGUodGhhdCwgbGVuZ3RoKVxuICAvLyBUcnVuY2F0aW5nIHRoZSBlbGVtZW50cyBpcyBwcm9iYWJseSBub3Qgd2hhdCBwZW9wbGUgZXhwZWN0IGZyb20gdHlwZWRcbiAgLy8gYXJyYXlzIHdpdGggQllURVNfUEVSX0VMRU1FTlQgPiAxIGJ1dCBpdCdzIGNvbXBhdGlibGUgd2l0aCB0aGUgYmVoYXZpb3JcbiAgLy8gb2YgdGhlIG9sZCBCdWZmZXIgY29uc3RydWN0b3IuXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuZ3RoOyBpICs9IDEpIHtcbiAgICB0aGF0W2ldID0gYXJyYXlbaV0gJiAyNTVcbiAgfVxuICByZXR1cm4gdGhhdFxufVxuXG5mdW5jdGlvbiBmcm9tQXJyYXlCdWZmZXIgKHRoYXQsIGFycmF5KSB7XG4gIGFycmF5LmJ5dGVMZW5ndGggLy8gdGhpcyB0aHJvd3MgaWYgYGFycmF5YCBpcyBub3QgYSB2YWxpZCBBcnJheUJ1ZmZlclxuXG4gIGlmIChCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkge1xuICAgIC8vIFJldHVybiBhbiBhdWdtZW50ZWQgYFVpbnQ4QXJyYXlgIGluc3RhbmNlLCBmb3IgYmVzdCBwZXJmb3JtYW5jZVxuICAgIHRoYXQgPSBuZXcgVWludDhBcnJheShhcnJheSlcbiAgICB0aGF0Ll9fcHJvdG9fXyA9IEJ1ZmZlci5wcm90b3R5cGVcbiAgfSBlbHNlIHtcbiAgICAvLyBGYWxsYmFjazogUmV0dXJuIGFuIG9iamVjdCBpbnN0YW5jZSBvZiB0aGUgQnVmZmVyIGNsYXNzXG4gICAgdGhhdCA9IGZyb21UeXBlZEFycmF5KHRoYXQsIG5ldyBVaW50OEFycmF5KGFycmF5KSlcbiAgfVxuICByZXR1cm4gdGhhdFxufVxuXG5mdW5jdGlvbiBmcm9tQXJyYXlMaWtlICh0aGF0LCBhcnJheSkge1xuICB2YXIgbGVuZ3RoID0gY2hlY2tlZChhcnJheS5sZW5ndGgpIHwgMFxuICB0aGF0ID0gYWxsb2NhdGUodGhhdCwgbGVuZ3RoKVxuICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbmd0aDsgaSArPSAxKSB7XG4gICAgdGhhdFtpXSA9IGFycmF5W2ldICYgMjU1XG4gIH1cbiAgcmV0dXJuIHRoYXRcbn1cblxuLy8gRGVzZXJpYWxpemUgeyB0eXBlOiAnQnVmZmVyJywgZGF0YTogWzEsMiwzLC4uLl0gfSBpbnRvIGEgQnVmZmVyIG9iamVjdC5cbi8vIFJldHVybnMgYSB6ZXJvLWxlbmd0aCBidWZmZXIgZm9yIGlucHV0cyB0aGF0IGRvbid0IGNvbmZvcm0gdG8gdGhlIHNwZWMuXG5mdW5jdGlvbiBmcm9tSnNvbk9iamVjdCAodGhhdCwgb2JqZWN0KSB7XG4gIHZhciBhcnJheVxuICB2YXIgbGVuZ3RoID0gMFxuXG4gIGlmIChvYmplY3QudHlwZSA9PT0gJ0J1ZmZlcicgJiYgaXNBcnJheShvYmplY3QuZGF0YSkpIHtcbiAgICBhcnJheSA9IG9iamVjdC5kYXRhXG4gICAgbGVuZ3RoID0gY2hlY2tlZChhcnJheS5sZW5ndGgpIHwgMFxuICB9XG4gIHRoYXQgPSBhbGxvY2F0ZSh0aGF0LCBsZW5ndGgpXG5cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7IGkgKz0gMSkge1xuICAgIHRoYXRbaV0gPSBhcnJheVtpXSAmIDI1NVxuICB9XG4gIHJldHVybiB0aGF0XG59XG5cbmlmIChCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkge1xuICBCdWZmZXIucHJvdG90eXBlLl9fcHJvdG9fXyA9IFVpbnQ4QXJyYXkucHJvdG90eXBlXG4gIEJ1ZmZlci5fX3Byb3RvX18gPSBVaW50OEFycmF5XG4gIGlmICh0eXBlb2YgU3ltYm9sICE9PSAndW5kZWZpbmVkJyAmJiBTeW1ib2wuc3BlY2llcyAmJlxuICAgICAgQnVmZmVyW1N5bWJvbC5zcGVjaWVzXSA9PT0gQnVmZmVyKSB7XG4gICAgLy8gRml4IHN1YmFycmF5KCkgaW4gRVMyMDE2LiBTZWU6IGh0dHBzOi8vZ2l0aHViLmNvbS9mZXJvc3MvYnVmZmVyL3B1bGwvOTdcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoQnVmZmVyLCBTeW1ib2wuc3BlY2llcywge1xuICAgICAgdmFsdWU6IG51bGwsXG4gICAgICBjb25maWd1cmFibGU6IHRydWVcbiAgICB9KVxuICB9XG59IGVsc2Uge1xuICAvLyBwcmUtc2V0IGZvciB2YWx1ZXMgdGhhdCBtYXkgZXhpc3QgaW4gdGhlIGZ1dHVyZVxuICBCdWZmZXIucHJvdG90eXBlLmxlbmd0aCA9IHVuZGVmaW5lZFxuICBCdWZmZXIucHJvdG90eXBlLnBhcmVudCA9IHVuZGVmaW5lZFxufVxuXG5mdW5jdGlvbiBhbGxvY2F0ZSAodGhhdCwgbGVuZ3RoKSB7XG4gIGlmIChCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkge1xuICAgIC8vIFJldHVybiBhbiBhdWdtZW50ZWQgYFVpbnQ4QXJyYXlgIGluc3RhbmNlLCBmb3IgYmVzdCBwZXJmb3JtYW5jZVxuICAgIHRoYXQgPSBuZXcgVWludDhBcnJheShsZW5ndGgpXG4gICAgdGhhdC5fX3Byb3RvX18gPSBCdWZmZXIucHJvdG90eXBlXG4gIH0gZWxzZSB7XG4gICAgLy8gRmFsbGJhY2s6IFJldHVybiBhbiBvYmplY3QgaW5zdGFuY2Ugb2YgdGhlIEJ1ZmZlciBjbGFzc1xuICAgIHRoYXQubGVuZ3RoID0gbGVuZ3RoXG4gIH1cblxuICB2YXIgZnJvbVBvb2wgPSBsZW5ndGggIT09IDAgJiYgbGVuZ3RoIDw9IEJ1ZmZlci5wb29sU2l6ZSA+Pj4gMVxuICBpZiAoZnJvbVBvb2wpIHRoYXQucGFyZW50ID0gcm9vdFBhcmVudFxuXG4gIHJldHVybiB0aGF0XG59XG5cbmZ1bmN0aW9uIGNoZWNrZWQgKGxlbmd0aCkge1xuICAvLyBOb3RlOiBjYW5ub3QgdXNlIGBsZW5ndGggPCBrTWF4TGVuZ3RoYCBoZXJlIGJlY2F1c2UgdGhhdCBmYWlscyB3aGVuXG4gIC8vIGxlbmd0aCBpcyBOYU4gKHdoaWNoIGlzIG90aGVyd2lzZSBjb2VyY2VkIHRvIHplcm8uKVxuICBpZiAobGVuZ3RoID49IGtNYXhMZW5ndGgoKSkge1xuICAgIHRocm93IG5ldyBSYW5nZUVycm9yKCdBdHRlbXB0IHRvIGFsbG9jYXRlIEJ1ZmZlciBsYXJnZXIgdGhhbiBtYXhpbXVtICcgK1xuICAgICAgICAgICAgICAgICAgICAgICAgICdzaXplOiAweCcgKyBrTWF4TGVuZ3RoKCkudG9TdHJpbmcoMTYpICsgJyBieXRlcycpXG4gIH1cbiAgcmV0dXJuIGxlbmd0aCB8IDBcbn1cblxuZnVuY3Rpb24gU2xvd0J1ZmZlciAoc3ViamVjdCwgZW5jb2RpbmcpIHtcbiAgaWYgKCEodGhpcyBpbnN0YW5jZW9mIFNsb3dCdWZmZXIpKSByZXR1cm4gbmV3IFNsb3dCdWZmZXIoc3ViamVjdCwgZW5jb2RpbmcpXG5cbiAgdmFyIGJ1ZiA9IG5ldyBCdWZmZXIoc3ViamVjdCwgZW5jb2RpbmcpXG4gIGRlbGV0ZSBidWYucGFyZW50XG4gIHJldHVybiBidWZcbn1cblxuQnVmZmVyLmlzQnVmZmVyID0gZnVuY3Rpb24gaXNCdWZmZXIgKGIpIHtcbiAgcmV0dXJuICEhKGIgIT0gbnVsbCAmJiBiLl9pc0J1ZmZlcilcbn1cblxuQnVmZmVyLmNvbXBhcmUgPSBmdW5jdGlvbiBjb21wYXJlIChhLCBiKSB7XG4gIGlmICghQnVmZmVyLmlzQnVmZmVyKGEpIHx8ICFCdWZmZXIuaXNCdWZmZXIoYikpIHtcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdBcmd1bWVudHMgbXVzdCBiZSBCdWZmZXJzJylcbiAgfVxuXG4gIGlmIChhID09PSBiKSByZXR1cm4gMFxuXG4gIHZhciB4ID0gYS5sZW5ndGhcbiAgdmFyIHkgPSBiLmxlbmd0aFxuXG4gIGZvciAodmFyIGkgPSAwLCBsZW4gPSBNYXRoLm1pbih4LCB5KTsgaSA8IGxlbjsgKytpKSB7XG4gICAgaWYgKGFbaV0gIT09IGJbaV0pIHtcbiAgICAgIHggPSBhW2ldXG4gICAgICB5ID0gYltpXVxuICAgICAgYnJlYWtcbiAgICB9XG4gIH1cblxuICBpZiAoeCA8IHkpIHJldHVybiAtMVxuICBpZiAoeSA8IHgpIHJldHVybiAxXG4gIHJldHVybiAwXG59XG5cbkJ1ZmZlci5pc0VuY29kaW5nID0gZnVuY3Rpb24gaXNFbmNvZGluZyAoZW5jb2RpbmcpIHtcbiAgc3dpdGNoIChTdHJpbmcoZW5jb2RpbmcpLnRvTG93ZXJDYXNlKCkpIHtcbiAgICBjYXNlICdoZXgnOlxuICAgIGNhc2UgJ3V0ZjgnOlxuICAgIGNhc2UgJ3V0Zi04JzpcbiAgICBjYXNlICdhc2NpaSc6XG4gICAgY2FzZSAnYmluYXJ5JzpcbiAgICBjYXNlICdiYXNlNjQnOlxuICAgIGNhc2UgJ3Jhdyc6XG4gICAgY2FzZSAndWNzMic6XG4gICAgY2FzZSAndWNzLTInOlxuICAgIGNhc2UgJ3V0ZjE2bGUnOlxuICAgIGNhc2UgJ3V0Zi0xNmxlJzpcbiAgICAgIHJldHVybiB0cnVlXG4gICAgZGVmYXVsdDpcbiAgICAgIHJldHVybiBmYWxzZVxuICB9XG59XG5cbkJ1ZmZlci5jb25jYXQgPSBmdW5jdGlvbiBjb25jYXQgKGxpc3QsIGxlbmd0aCkge1xuICBpZiAoIWlzQXJyYXkobGlzdCkpIHRocm93IG5ldyBUeXBlRXJyb3IoJ2xpc3QgYXJndW1lbnQgbXVzdCBiZSBhbiBBcnJheSBvZiBCdWZmZXJzLicpXG5cbiAgaWYgKGxpc3QubGVuZ3RoID09PSAwKSB7XG4gICAgcmV0dXJuIG5ldyBCdWZmZXIoMClcbiAgfVxuXG4gIHZhciBpXG4gIGlmIChsZW5ndGggPT09IHVuZGVmaW5lZCkge1xuICAgIGxlbmd0aCA9IDBcbiAgICBmb3IgKGkgPSAwOyBpIDwgbGlzdC5sZW5ndGg7IGkrKykge1xuICAgICAgbGVuZ3RoICs9IGxpc3RbaV0ubGVuZ3RoXG4gICAgfVxuICB9XG5cbiAgdmFyIGJ1ZiA9IG5ldyBCdWZmZXIobGVuZ3RoKVxuICB2YXIgcG9zID0gMFxuICBmb3IgKGkgPSAwOyBpIDwgbGlzdC5sZW5ndGg7IGkrKykge1xuICAgIHZhciBpdGVtID0gbGlzdFtpXVxuICAgIGl0ZW0uY29weShidWYsIHBvcylcbiAgICBwb3MgKz0gaXRlbS5sZW5ndGhcbiAgfVxuICByZXR1cm4gYnVmXG59XG5cbmZ1bmN0aW9uIGJ5dGVMZW5ndGggKHN0cmluZywgZW5jb2RpbmcpIHtcbiAgaWYgKHR5cGVvZiBzdHJpbmcgIT09ICdzdHJpbmcnKSBzdHJpbmcgPSAnJyArIHN0cmluZ1xuXG4gIHZhciBsZW4gPSBzdHJpbmcubGVuZ3RoXG4gIGlmIChsZW4gPT09IDApIHJldHVybiAwXG5cbiAgLy8gVXNlIGEgZm9yIGxvb3AgdG8gYXZvaWQgcmVjdXJzaW9uXG4gIHZhciBsb3dlcmVkQ2FzZSA9IGZhbHNlXG4gIGZvciAoOzspIHtcbiAgICBzd2l0Y2ggKGVuY29kaW5nKSB7XG4gICAgICBjYXNlICdhc2NpaSc6XG4gICAgICBjYXNlICdiaW5hcnknOlxuICAgICAgLy8gRGVwcmVjYXRlZFxuICAgICAgY2FzZSAncmF3JzpcbiAgICAgIGNhc2UgJ3Jhd3MnOlxuICAgICAgICByZXR1cm4gbGVuXG4gICAgICBjYXNlICd1dGY4JzpcbiAgICAgIGNhc2UgJ3V0Zi04JzpcbiAgICAgICAgcmV0dXJuIHV0ZjhUb0J5dGVzKHN0cmluZykubGVuZ3RoXG4gICAgICBjYXNlICd1Y3MyJzpcbiAgICAgIGNhc2UgJ3Vjcy0yJzpcbiAgICAgIGNhc2UgJ3V0ZjE2bGUnOlxuICAgICAgY2FzZSAndXRmLTE2bGUnOlxuICAgICAgICByZXR1cm4gbGVuICogMlxuICAgICAgY2FzZSAnaGV4JzpcbiAgICAgICAgcmV0dXJuIGxlbiA+Pj4gMVxuICAgICAgY2FzZSAnYmFzZTY0JzpcbiAgICAgICAgcmV0dXJuIGJhc2U2NFRvQnl0ZXMoc3RyaW5nKS5sZW5ndGhcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIGlmIChsb3dlcmVkQ2FzZSkgcmV0dXJuIHV0ZjhUb0J5dGVzKHN0cmluZykubGVuZ3RoIC8vIGFzc3VtZSB1dGY4XG4gICAgICAgIGVuY29kaW5nID0gKCcnICsgZW5jb2RpbmcpLnRvTG93ZXJDYXNlKClcbiAgICAgICAgbG93ZXJlZENhc2UgPSB0cnVlXG4gICAgfVxuICB9XG59XG5CdWZmZXIuYnl0ZUxlbmd0aCA9IGJ5dGVMZW5ndGhcblxuZnVuY3Rpb24gc2xvd1RvU3RyaW5nIChlbmNvZGluZywgc3RhcnQsIGVuZCkge1xuICB2YXIgbG93ZXJlZENhc2UgPSBmYWxzZVxuXG4gIHN0YXJ0ID0gc3RhcnQgfCAwXG4gIGVuZCA9IGVuZCA9PT0gdW5kZWZpbmVkIHx8IGVuZCA9PT0gSW5maW5pdHkgPyB0aGlzLmxlbmd0aCA6IGVuZCB8IDBcblxuICBpZiAoIWVuY29kaW5nKSBlbmNvZGluZyA9ICd1dGY4J1xuICBpZiAoc3RhcnQgPCAwKSBzdGFydCA9IDBcbiAgaWYgKGVuZCA+IHRoaXMubGVuZ3RoKSBlbmQgPSB0aGlzLmxlbmd0aFxuICBpZiAoZW5kIDw9IHN0YXJ0KSByZXR1cm4gJydcblxuICB3aGlsZSAodHJ1ZSkge1xuICAgIHN3aXRjaCAoZW5jb2RpbmcpIHtcbiAgICAgIGNhc2UgJ2hleCc6XG4gICAgICAgIHJldHVybiBoZXhTbGljZSh0aGlzLCBzdGFydCwgZW5kKVxuXG4gICAgICBjYXNlICd1dGY4JzpcbiAgICAgIGNhc2UgJ3V0Zi04JzpcbiAgICAgICAgcmV0dXJuIHV0ZjhTbGljZSh0aGlzLCBzdGFydCwgZW5kKVxuXG4gICAgICBjYXNlICdhc2NpaSc6XG4gICAgICAgIHJldHVybiBhc2NpaVNsaWNlKHRoaXMsIHN0YXJ0LCBlbmQpXG5cbiAgICAgIGNhc2UgJ2JpbmFyeSc6XG4gICAgICAgIHJldHVybiBiaW5hcnlTbGljZSh0aGlzLCBzdGFydCwgZW5kKVxuXG4gICAgICBjYXNlICdiYXNlNjQnOlxuICAgICAgICByZXR1cm4gYmFzZTY0U2xpY2UodGhpcywgc3RhcnQsIGVuZClcblxuICAgICAgY2FzZSAndWNzMic6XG4gICAgICBjYXNlICd1Y3MtMic6XG4gICAgICBjYXNlICd1dGYxNmxlJzpcbiAgICAgIGNhc2UgJ3V0Zi0xNmxlJzpcbiAgICAgICAgcmV0dXJuIHV0ZjE2bGVTbGljZSh0aGlzLCBzdGFydCwgZW5kKVxuXG4gICAgICBkZWZhdWx0OlxuICAgICAgICBpZiAobG93ZXJlZENhc2UpIHRocm93IG5ldyBUeXBlRXJyb3IoJ1Vua25vd24gZW5jb2Rpbmc6ICcgKyBlbmNvZGluZylcbiAgICAgICAgZW5jb2RpbmcgPSAoZW5jb2RpbmcgKyAnJykudG9Mb3dlckNhc2UoKVxuICAgICAgICBsb3dlcmVkQ2FzZSA9IHRydWVcbiAgICB9XG4gIH1cbn1cblxuLy8gVGhlIHByb3BlcnR5IGlzIHVzZWQgYnkgYEJ1ZmZlci5pc0J1ZmZlcmAgYW5kIGBpcy1idWZmZXJgIChpbiBTYWZhcmkgNS03KSB0byBkZXRlY3Rcbi8vIEJ1ZmZlciBpbnN0YW5jZXMuXG5CdWZmZXIucHJvdG90eXBlLl9pc0J1ZmZlciA9IHRydWVcblxuQnVmZmVyLnByb3RvdHlwZS50b1N0cmluZyA9IGZ1bmN0aW9uIHRvU3RyaW5nICgpIHtcbiAgdmFyIGxlbmd0aCA9IHRoaXMubGVuZ3RoIHwgMFxuICBpZiAobGVuZ3RoID09PSAwKSByZXR1cm4gJydcbiAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDApIHJldHVybiB1dGY4U2xpY2UodGhpcywgMCwgbGVuZ3RoKVxuICByZXR1cm4gc2xvd1RvU3RyaW5nLmFwcGx5KHRoaXMsIGFyZ3VtZW50cylcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5lcXVhbHMgPSBmdW5jdGlvbiBlcXVhbHMgKGIpIHtcbiAgaWYgKCFCdWZmZXIuaXNCdWZmZXIoYikpIHRocm93IG5ldyBUeXBlRXJyb3IoJ0FyZ3VtZW50IG11c3QgYmUgYSBCdWZmZXInKVxuICBpZiAodGhpcyA9PT0gYikgcmV0dXJuIHRydWVcbiAgcmV0dXJuIEJ1ZmZlci5jb21wYXJlKHRoaXMsIGIpID09PSAwXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUuaW5zcGVjdCA9IGZ1bmN0aW9uIGluc3BlY3QgKCkge1xuICB2YXIgc3RyID0gJydcbiAgdmFyIG1heCA9IGV4cG9ydHMuSU5TUEVDVF9NQVhfQllURVNcbiAgaWYgKHRoaXMubGVuZ3RoID4gMCkge1xuICAgIHN0ciA9IHRoaXMudG9TdHJpbmcoJ2hleCcsIDAsIG1heCkubWF0Y2goLy57Mn0vZykuam9pbignICcpXG4gICAgaWYgKHRoaXMubGVuZ3RoID4gbWF4KSBzdHIgKz0gJyAuLi4gJ1xuICB9XG4gIHJldHVybiAnPEJ1ZmZlciAnICsgc3RyICsgJz4nXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUuY29tcGFyZSA9IGZ1bmN0aW9uIGNvbXBhcmUgKGIpIHtcbiAgaWYgKCFCdWZmZXIuaXNCdWZmZXIoYikpIHRocm93IG5ldyBUeXBlRXJyb3IoJ0FyZ3VtZW50IG11c3QgYmUgYSBCdWZmZXInKVxuICByZXR1cm4gQnVmZmVyLmNvbXBhcmUodGhpcywgYilcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5pbmRleE9mID0gZnVuY3Rpb24gaW5kZXhPZiAodmFsLCBieXRlT2Zmc2V0KSB7XG4gIGlmIChieXRlT2Zmc2V0ID4gMHg3ZmZmZmZmZikgYnl0ZU9mZnNldCA9IDB4N2ZmZmZmZmZcbiAgZWxzZSBpZiAoYnl0ZU9mZnNldCA8IC0weDgwMDAwMDAwKSBieXRlT2Zmc2V0ID0gLTB4ODAwMDAwMDBcbiAgYnl0ZU9mZnNldCA+Pj0gMFxuXG4gIGlmICh0aGlzLmxlbmd0aCA9PT0gMCkgcmV0dXJuIC0xXG4gIGlmIChieXRlT2Zmc2V0ID49IHRoaXMubGVuZ3RoKSByZXR1cm4gLTFcblxuICAvLyBOZWdhdGl2ZSBvZmZzZXRzIHN0YXJ0IGZyb20gdGhlIGVuZCBvZiB0aGUgYnVmZmVyXG4gIGlmIChieXRlT2Zmc2V0IDwgMCkgYnl0ZU9mZnNldCA9IE1hdGgubWF4KHRoaXMubGVuZ3RoICsgYnl0ZU9mZnNldCwgMClcblxuICBpZiAodHlwZW9mIHZhbCA9PT0gJ3N0cmluZycpIHtcbiAgICBpZiAodmFsLmxlbmd0aCA9PT0gMCkgcmV0dXJuIC0xIC8vIHNwZWNpYWwgY2FzZTogbG9va2luZyBmb3IgZW1wdHkgc3RyaW5nIGFsd2F5cyBmYWlsc1xuICAgIHJldHVybiBTdHJpbmcucHJvdG90eXBlLmluZGV4T2YuY2FsbCh0aGlzLCB2YWwsIGJ5dGVPZmZzZXQpXG4gIH1cbiAgaWYgKEJ1ZmZlci5pc0J1ZmZlcih2YWwpKSB7XG4gICAgcmV0dXJuIGFycmF5SW5kZXhPZih0aGlzLCB2YWwsIGJ5dGVPZmZzZXQpXG4gIH1cbiAgaWYgKHR5cGVvZiB2YWwgPT09ICdudW1iZXInKSB7XG4gICAgaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUICYmIFVpbnQ4QXJyYXkucHJvdG90eXBlLmluZGV4T2YgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgIHJldHVybiBVaW50OEFycmF5LnByb3RvdHlwZS5pbmRleE9mLmNhbGwodGhpcywgdmFsLCBieXRlT2Zmc2V0KVxuICAgIH1cbiAgICByZXR1cm4gYXJyYXlJbmRleE9mKHRoaXMsIFsgdmFsIF0sIGJ5dGVPZmZzZXQpXG4gIH1cblxuICBmdW5jdGlvbiBhcnJheUluZGV4T2YgKGFyciwgdmFsLCBieXRlT2Zmc2V0KSB7XG4gICAgdmFyIGZvdW5kSW5kZXggPSAtMVxuICAgIGZvciAodmFyIGkgPSAwOyBieXRlT2Zmc2V0ICsgaSA8IGFyci5sZW5ndGg7IGkrKykge1xuICAgICAgaWYgKGFycltieXRlT2Zmc2V0ICsgaV0gPT09IHZhbFtmb3VuZEluZGV4ID09PSAtMSA/IDAgOiBpIC0gZm91bmRJbmRleF0pIHtcbiAgICAgICAgaWYgKGZvdW5kSW5kZXggPT09IC0xKSBmb3VuZEluZGV4ID0gaVxuICAgICAgICBpZiAoaSAtIGZvdW5kSW5kZXggKyAxID09PSB2YWwubGVuZ3RoKSByZXR1cm4gYnl0ZU9mZnNldCArIGZvdW5kSW5kZXhcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGZvdW5kSW5kZXggPSAtMVxuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gLTFcbiAgfVxuXG4gIHRocm93IG5ldyBUeXBlRXJyb3IoJ3ZhbCBtdXN0IGJlIHN0cmluZywgbnVtYmVyIG9yIEJ1ZmZlcicpXG59XG5cbmZ1bmN0aW9uIGhleFdyaXRlIChidWYsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpIHtcbiAgb2Zmc2V0ID0gTnVtYmVyKG9mZnNldCkgfHwgMFxuICB2YXIgcmVtYWluaW5nID0gYnVmLmxlbmd0aCAtIG9mZnNldFxuICBpZiAoIWxlbmd0aCkge1xuICAgIGxlbmd0aCA9IHJlbWFpbmluZ1xuICB9IGVsc2Uge1xuICAgIGxlbmd0aCA9IE51bWJlcihsZW5ndGgpXG4gICAgaWYgKGxlbmd0aCA+IHJlbWFpbmluZykge1xuICAgICAgbGVuZ3RoID0gcmVtYWluaW5nXG4gICAgfVxuICB9XG5cbiAgLy8gbXVzdCBiZSBhbiBldmVuIG51bWJlciBvZiBkaWdpdHNcbiAgdmFyIHN0ckxlbiA9IHN0cmluZy5sZW5ndGhcbiAgaWYgKHN0ckxlbiAlIDIgIT09IDApIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBoZXggc3RyaW5nJylcblxuICBpZiAobGVuZ3RoID4gc3RyTGVuIC8gMikge1xuICAgIGxlbmd0aCA9IHN0ckxlbiAvIDJcbiAgfVxuICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgdmFyIHBhcnNlZCA9IHBhcnNlSW50KHN0cmluZy5zdWJzdHIoaSAqIDIsIDIpLCAxNilcbiAgICBpZiAoaXNOYU4ocGFyc2VkKSkgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIGhleCBzdHJpbmcnKVxuICAgIGJ1ZltvZmZzZXQgKyBpXSA9IHBhcnNlZFxuICB9XG4gIHJldHVybiBpXG59XG5cbmZ1bmN0aW9uIHV0ZjhXcml0ZSAoYnVmLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKSB7XG4gIHJldHVybiBibGl0QnVmZmVyKHV0ZjhUb0J5dGVzKHN0cmluZywgYnVmLmxlbmd0aCAtIG9mZnNldCksIGJ1Ziwgb2Zmc2V0LCBsZW5ndGgpXG59XG5cbmZ1bmN0aW9uIGFzY2lpV3JpdGUgKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCkge1xuICByZXR1cm4gYmxpdEJ1ZmZlcihhc2NpaVRvQnl0ZXMoc3RyaW5nKSwgYnVmLCBvZmZzZXQsIGxlbmd0aClcbn1cblxuZnVuY3Rpb24gYmluYXJ5V3JpdGUgKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCkge1xuICByZXR1cm4gYXNjaWlXcml0ZShidWYsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpXG59XG5cbmZ1bmN0aW9uIGJhc2U2NFdyaXRlIChidWYsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpIHtcbiAgcmV0dXJuIGJsaXRCdWZmZXIoYmFzZTY0VG9CeXRlcyhzdHJpbmcpLCBidWYsIG9mZnNldCwgbGVuZ3RoKVxufVxuXG5mdW5jdGlvbiB1Y3MyV3JpdGUgKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCkge1xuICByZXR1cm4gYmxpdEJ1ZmZlcih1dGYxNmxlVG9CeXRlcyhzdHJpbmcsIGJ1Zi5sZW5ndGggLSBvZmZzZXQpLCBidWYsIG9mZnNldCwgbGVuZ3RoKVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlID0gZnVuY3Rpb24gd3JpdGUgKHN0cmluZywgb2Zmc2V0LCBsZW5ndGgsIGVuY29kaW5nKSB7XG4gIC8vIEJ1ZmZlciN3cml0ZShzdHJpbmcpXG4gIGlmIChvZmZzZXQgPT09IHVuZGVmaW5lZCkge1xuICAgIGVuY29kaW5nID0gJ3V0ZjgnXG4gICAgbGVuZ3RoID0gdGhpcy5sZW5ndGhcbiAgICBvZmZzZXQgPSAwXG4gIC8vIEJ1ZmZlciN3cml0ZShzdHJpbmcsIGVuY29kaW5nKVxuICB9IGVsc2UgaWYgKGxlbmd0aCA9PT0gdW5kZWZpbmVkICYmIHR5cGVvZiBvZmZzZXQgPT09ICdzdHJpbmcnKSB7XG4gICAgZW5jb2RpbmcgPSBvZmZzZXRcbiAgICBsZW5ndGggPSB0aGlzLmxlbmd0aFxuICAgIG9mZnNldCA9IDBcbiAgLy8gQnVmZmVyI3dyaXRlKHN0cmluZywgb2Zmc2V0WywgbGVuZ3RoXVssIGVuY29kaW5nXSlcbiAgfSBlbHNlIGlmIChpc0Zpbml0ZShvZmZzZXQpKSB7XG4gICAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICAgIGlmIChpc0Zpbml0ZShsZW5ndGgpKSB7XG4gICAgICBsZW5ndGggPSBsZW5ndGggfCAwXG4gICAgICBpZiAoZW5jb2RpbmcgPT09IHVuZGVmaW5lZCkgZW5jb2RpbmcgPSAndXRmOCdcbiAgICB9IGVsc2Uge1xuICAgICAgZW5jb2RpbmcgPSBsZW5ndGhcbiAgICAgIGxlbmd0aCA9IHVuZGVmaW5lZFxuICAgIH1cbiAgLy8gbGVnYWN5IHdyaXRlKHN0cmluZywgZW5jb2RpbmcsIG9mZnNldCwgbGVuZ3RoKSAtIHJlbW92ZSBpbiB2MC4xM1xuICB9IGVsc2Uge1xuICAgIHZhciBzd2FwID0gZW5jb2RpbmdcbiAgICBlbmNvZGluZyA9IG9mZnNldFxuICAgIG9mZnNldCA9IGxlbmd0aCB8IDBcbiAgICBsZW5ndGggPSBzd2FwXG4gIH1cblxuICB2YXIgcmVtYWluaW5nID0gdGhpcy5sZW5ndGggLSBvZmZzZXRcbiAgaWYgKGxlbmd0aCA9PT0gdW5kZWZpbmVkIHx8IGxlbmd0aCA+IHJlbWFpbmluZykgbGVuZ3RoID0gcmVtYWluaW5nXG5cbiAgaWYgKChzdHJpbmcubGVuZ3RoID4gMCAmJiAobGVuZ3RoIDwgMCB8fCBvZmZzZXQgPCAwKSkgfHwgb2Zmc2V0ID4gdGhpcy5sZW5ndGgpIHtcbiAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcignYXR0ZW1wdCB0byB3cml0ZSBvdXRzaWRlIGJ1ZmZlciBib3VuZHMnKVxuICB9XG5cbiAgaWYgKCFlbmNvZGluZykgZW5jb2RpbmcgPSAndXRmOCdcblxuICB2YXIgbG93ZXJlZENhc2UgPSBmYWxzZVxuICBmb3IgKDs7KSB7XG4gICAgc3dpdGNoIChlbmNvZGluZykge1xuICAgICAgY2FzZSAnaGV4JzpcbiAgICAgICAgcmV0dXJuIGhleFdyaXRlKHRoaXMsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpXG5cbiAgICAgIGNhc2UgJ3V0ZjgnOlxuICAgICAgY2FzZSAndXRmLTgnOlxuICAgICAgICByZXR1cm4gdXRmOFdyaXRlKHRoaXMsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpXG5cbiAgICAgIGNhc2UgJ2FzY2lpJzpcbiAgICAgICAgcmV0dXJuIGFzY2lpV3JpdGUodGhpcywgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aClcblxuICAgICAgY2FzZSAnYmluYXJ5JzpcbiAgICAgICAgcmV0dXJuIGJpbmFyeVdyaXRlKHRoaXMsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpXG5cbiAgICAgIGNhc2UgJ2Jhc2U2NCc6XG4gICAgICAgIC8vIFdhcm5pbmc6IG1heExlbmd0aCBub3QgdGFrZW4gaW50byBhY2NvdW50IGluIGJhc2U2NFdyaXRlXG4gICAgICAgIHJldHVybiBiYXNlNjRXcml0ZSh0aGlzLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxuXG4gICAgICBjYXNlICd1Y3MyJzpcbiAgICAgIGNhc2UgJ3Vjcy0yJzpcbiAgICAgIGNhc2UgJ3V0ZjE2bGUnOlxuICAgICAgY2FzZSAndXRmLTE2bGUnOlxuICAgICAgICByZXR1cm4gdWNzMldyaXRlKHRoaXMsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpXG5cbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIGlmIChsb3dlcmVkQ2FzZSkgdGhyb3cgbmV3IFR5cGVFcnJvcignVW5rbm93biBlbmNvZGluZzogJyArIGVuY29kaW5nKVxuICAgICAgICBlbmNvZGluZyA9ICgnJyArIGVuY29kaW5nKS50b0xvd2VyQ2FzZSgpXG4gICAgICAgIGxvd2VyZWRDYXNlID0gdHJ1ZVxuICAgIH1cbiAgfVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnRvSlNPTiA9IGZ1bmN0aW9uIHRvSlNPTiAoKSB7XG4gIHJldHVybiB7XG4gICAgdHlwZTogJ0J1ZmZlcicsXG4gICAgZGF0YTogQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwodGhpcy5fYXJyIHx8IHRoaXMsIDApXG4gIH1cbn1cblxuZnVuY3Rpb24gYmFzZTY0U2xpY2UgKGJ1Ziwgc3RhcnQsIGVuZCkge1xuICBpZiAoc3RhcnQgPT09IDAgJiYgZW5kID09PSBidWYubGVuZ3RoKSB7XG4gICAgcmV0dXJuIGJhc2U2NC5mcm9tQnl0ZUFycmF5KGJ1ZilcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gYmFzZTY0LmZyb21CeXRlQXJyYXkoYnVmLnNsaWNlKHN0YXJ0LCBlbmQpKVxuICB9XG59XG5cbmZ1bmN0aW9uIHV0ZjhTbGljZSAoYnVmLCBzdGFydCwgZW5kKSB7XG4gIGVuZCA9IE1hdGgubWluKGJ1Zi5sZW5ndGgsIGVuZClcbiAgdmFyIHJlcyA9IFtdXG5cbiAgdmFyIGkgPSBzdGFydFxuICB3aGlsZSAoaSA8IGVuZCkge1xuICAgIHZhciBmaXJzdEJ5dGUgPSBidWZbaV1cbiAgICB2YXIgY29kZVBvaW50ID0gbnVsbFxuICAgIHZhciBieXRlc1BlclNlcXVlbmNlID0gKGZpcnN0Qnl0ZSA+IDB4RUYpID8gNFxuICAgICAgOiAoZmlyc3RCeXRlID4gMHhERikgPyAzXG4gICAgICA6IChmaXJzdEJ5dGUgPiAweEJGKSA/IDJcbiAgICAgIDogMVxuXG4gICAgaWYgKGkgKyBieXRlc1BlclNlcXVlbmNlIDw9IGVuZCkge1xuICAgICAgdmFyIHNlY29uZEJ5dGUsIHRoaXJkQnl0ZSwgZm91cnRoQnl0ZSwgdGVtcENvZGVQb2ludFxuXG4gICAgICBzd2l0Y2ggKGJ5dGVzUGVyU2VxdWVuY2UpIHtcbiAgICAgICAgY2FzZSAxOlxuICAgICAgICAgIGlmIChmaXJzdEJ5dGUgPCAweDgwKSB7XG4gICAgICAgICAgICBjb2RlUG9pbnQgPSBmaXJzdEJ5dGVcbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWtcbiAgICAgICAgY2FzZSAyOlxuICAgICAgICAgIHNlY29uZEJ5dGUgPSBidWZbaSArIDFdXG4gICAgICAgICAgaWYgKChzZWNvbmRCeXRlICYgMHhDMCkgPT09IDB4ODApIHtcbiAgICAgICAgICAgIHRlbXBDb2RlUG9pbnQgPSAoZmlyc3RCeXRlICYgMHgxRikgPDwgMHg2IHwgKHNlY29uZEJ5dGUgJiAweDNGKVxuICAgICAgICAgICAgaWYgKHRlbXBDb2RlUG9pbnQgPiAweDdGKSB7XG4gICAgICAgICAgICAgIGNvZGVQb2ludCA9IHRlbXBDb2RlUG9pbnRcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWtcbiAgICAgICAgY2FzZSAzOlxuICAgICAgICAgIHNlY29uZEJ5dGUgPSBidWZbaSArIDFdXG4gICAgICAgICAgdGhpcmRCeXRlID0gYnVmW2kgKyAyXVxuICAgICAgICAgIGlmICgoc2Vjb25kQnl0ZSAmIDB4QzApID09PSAweDgwICYmICh0aGlyZEJ5dGUgJiAweEMwKSA9PT0gMHg4MCkge1xuICAgICAgICAgICAgdGVtcENvZGVQb2ludCA9IChmaXJzdEJ5dGUgJiAweEYpIDw8IDB4QyB8IChzZWNvbmRCeXRlICYgMHgzRikgPDwgMHg2IHwgKHRoaXJkQnl0ZSAmIDB4M0YpXG4gICAgICAgICAgICBpZiAodGVtcENvZGVQb2ludCA+IDB4N0ZGICYmICh0ZW1wQ29kZVBvaW50IDwgMHhEODAwIHx8IHRlbXBDb2RlUG9pbnQgPiAweERGRkYpKSB7XG4gICAgICAgICAgICAgIGNvZGVQb2ludCA9IHRlbXBDb2RlUG9pbnRcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWtcbiAgICAgICAgY2FzZSA0OlxuICAgICAgICAgIHNlY29uZEJ5dGUgPSBidWZbaSArIDFdXG4gICAgICAgICAgdGhpcmRCeXRlID0gYnVmW2kgKyAyXVxuICAgICAgICAgIGZvdXJ0aEJ5dGUgPSBidWZbaSArIDNdXG4gICAgICAgICAgaWYgKChzZWNvbmRCeXRlICYgMHhDMCkgPT09IDB4ODAgJiYgKHRoaXJkQnl0ZSAmIDB4QzApID09PSAweDgwICYmIChmb3VydGhCeXRlICYgMHhDMCkgPT09IDB4ODApIHtcbiAgICAgICAgICAgIHRlbXBDb2RlUG9pbnQgPSAoZmlyc3RCeXRlICYgMHhGKSA8PCAweDEyIHwgKHNlY29uZEJ5dGUgJiAweDNGKSA8PCAweEMgfCAodGhpcmRCeXRlICYgMHgzRikgPDwgMHg2IHwgKGZvdXJ0aEJ5dGUgJiAweDNGKVxuICAgICAgICAgICAgaWYgKHRlbXBDb2RlUG9pbnQgPiAweEZGRkYgJiYgdGVtcENvZGVQb2ludCA8IDB4MTEwMDAwKSB7XG4gICAgICAgICAgICAgIGNvZGVQb2ludCA9IHRlbXBDb2RlUG9pbnRcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKGNvZGVQb2ludCA9PT0gbnVsbCkge1xuICAgICAgLy8gd2UgZGlkIG5vdCBnZW5lcmF0ZSBhIHZhbGlkIGNvZGVQb2ludCBzbyBpbnNlcnQgYVxuICAgICAgLy8gcmVwbGFjZW1lbnQgY2hhciAoVStGRkZEKSBhbmQgYWR2YW5jZSBvbmx5IDEgYnl0ZVxuICAgICAgY29kZVBvaW50ID0gMHhGRkZEXG4gICAgICBieXRlc1BlclNlcXVlbmNlID0gMVxuICAgIH0gZWxzZSBpZiAoY29kZVBvaW50ID4gMHhGRkZGKSB7XG4gICAgICAvLyBlbmNvZGUgdG8gdXRmMTYgKHN1cnJvZ2F0ZSBwYWlyIGRhbmNlKVxuICAgICAgY29kZVBvaW50IC09IDB4MTAwMDBcbiAgICAgIHJlcy5wdXNoKGNvZGVQb2ludCA+Pj4gMTAgJiAweDNGRiB8IDB4RDgwMClcbiAgICAgIGNvZGVQb2ludCA9IDB4REMwMCB8IGNvZGVQb2ludCAmIDB4M0ZGXG4gICAgfVxuXG4gICAgcmVzLnB1c2goY29kZVBvaW50KVxuICAgIGkgKz0gYnl0ZXNQZXJTZXF1ZW5jZVxuICB9XG5cbiAgcmV0dXJuIGRlY29kZUNvZGVQb2ludHNBcnJheShyZXMpXG59XG5cbi8vIEJhc2VkIG9uIGh0dHA6Ly9zdGFja292ZXJmbG93LmNvbS9hLzIyNzQ3MjcyLzY4MDc0MiwgdGhlIGJyb3dzZXIgd2l0aFxuLy8gdGhlIGxvd2VzdCBsaW1pdCBpcyBDaHJvbWUsIHdpdGggMHgxMDAwMCBhcmdzLlxuLy8gV2UgZ28gMSBtYWduaXR1ZGUgbGVzcywgZm9yIHNhZmV0eVxudmFyIE1BWF9BUkdVTUVOVFNfTEVOR1RIID0gMHgxMDAwXG5cbmZ1bmN0aW9uIGRlY29kZUNvZGVQb2ludHNBcnJheSAoY29kZVBvaW50cykge1xuICB2YXIgbGVuID0gY29kZVBvaW50cy5sZW5ndGhcbiAgaWYgKGxlbiA8PSBNQVhfQVJHVU1FTlRTX0xFTkdUSCkge1xuICAgIHJldHVybiBTdHJpbmcuZnJvbUNoYXJDb2RlLmFwcGx5KFN0cmluZywgY29kZVBvaW50cykgLy8gYXZvaWQgZXh0cmEgc2xpY2UoKVxuICB9XG5cbiAgLy8gRGVjb2RlIGluIGNodW5rcyB0byBhdm9pZCBcImNhbGwgc3RhY2sgc2l6ZSBleGNlZWRlZFwiLlxuICB2YXIgcmVzID0gJydcbiAgdmFyIGkgPSAwXG4gIHdoaWxlIChpIDwgbGVuKSB7XG4gICAgcmVzICs9IFN0cmluZy5mcm9tQ2hhckNvZGUuYXBwbHkoXG4gICAgICBTdHJpbmcsXG4gICAgICBjb2RlUG9pbnRzLnNsaWNlKGksIGkgKz0gTUFYX0FSR1VNRU5UU19MRU5HVEgpXG4gICAgKVxuICB9XG4gIHJldHVybiByZXNcbn1cblxuZnVuY3Rpb24gYXNjaWlTbGljZSAoYnVmLCBzdGFydCwgZW5kKSB7XG4gIHZhciByZXQgPSAnJ1xuICBlbmQgPSBNYXRoLm1pbihidWYubGVuZ3RoLCBlbmQpXG5cbiAgZm9yICh2YXIgaSA9IHN0YXJ0OyBpIDwgZW5kOyBpKyspIHtcbiAgICByZXQgKz0gU3RyaW5nLmZyb21DaGFyQ29kZShidWZbaV0gJiAweDdGKVxuICB9XG4gIHJldHVybiByZXRcbn1cblxuZnVuY3Rpb24gYmluYXJ5U2xpY2UgKGJ1Ziwgc3RhcnQsIGVuZCkge1xuICB2YXIgcmV0ID0gJydcbiAgZW5kID0gTWF0aC5taW4oYnVmLmxlbmd0aCwgZW5kKVxuXG4gIGZvciAodmFyIGkgPSBzdGFydDsgaSA8IGVuZDsgaSsrKSB7XG4gICAgcmV0ICs9IFN0cmluZy5mcm9tQ2hhckNvZGUoYnVmW2ldKVxuICB9XG4gIHJldHVybiByZXRcbn1cblxuZnVuY3Rpb24gaGV4U2xpY2UgKGJ1Ziwgc3RhcnQsIGVuZCkge1xuICB2YXIgbGVuID0gYnVmLmxlbmd0aFxuXG4gIGlmICghc3RhcnQgfHwgc3RhcnQgPCAwKSBzdGFydCA9IDBcbiAgaWYgKCFlbmQgfHwgZW5kIDwgMCB8fCBlbmQgPiBsZW4pIGVuZCA9IGxlblxuXG4gIHZhciBvdXQgPSAnJ1xuICBmb3IgKHZhciBpID0gc3RhcnQ7IGkgPCBlbmQ7IGkrKykge1xuICAgIG91dCArPSB0b0hleChidWZbaV0pXG4gIH1cbiAgcmV0dXJuIG91dFxufVxuXG5mdW5jdGlvbiB1dGYxNmxlU2xpY2UgKGJ1Ziwgc3RhcnQsIGVuZCkge1xuICB2YXIgYnl0ZXMgPSBidWYuc2xpY2Uoc3RhcnQsIGVuZClcbiAgdmFyIHJlcyA9ICcnXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgYnl0ZXMubGVuZ3RoOyBpICs9IDIpIHtcbiAgICByZXMgKz0gU3RyaW5nLmZyb21DaGFyQ29kZShieXRlc1tpXSArIGJ5dGVzW2kgKyAxXSAqIDI1NilcbiAgfVxuICByZXR1cm4gcmVzXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUuc2xpY2UgPSBmdW5jdGlvbiBzbGljZSAoc3RhcnQsIGVuZCkge1xuICB2YXIgbGVuID0gdGhpcy5sZW5ndGhcbiAgc3RhcnQgPSB+fnN0YXJ0XG4gIGVuZCA9IGVuZCA9PT0gdW5kZWZpbmVkID8gbGVuIDogfn5lbmRcblxuICBpZiAoc3RhcnQgPCAwKSB7XG4gICAgc3RhcnQgKz0gbGVuXG4gICAgaWYgKHN0YXJ0IDwgMCkgc3RhcnQgPSAwXG4gIH0gZWxzZSBpZiAoc3RhcnQgPiBsZW4pIHtcbiAgICBzdGFydCA9IGxlblxuICB9XG5cbiAgaWYgKGVuZCA8IDApIHtcbiAgICBlbmQgKz0gbGVuXG4gICAgaWYgKGVuZCA8IDApIGVuZCA9IDBcbiAgfSBlbHNlIGlmIChlbmQgPiBsZW4pIHtcbiAgICBlbmQgPSBsZW5cbiAgfVxuXG4gIGlmIChlbmQgPCBzdGFydCkgZW5kID0gc3RhcnRcblxuICB2YXIgbmV3QnVmXG4gIGlmIChCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkge1xuICAgIG5ld0J1ZiA9IHRoaXMuc3ViYXJyYXkoc3RhcnQsIGVuZClcbiAgICBuZXdCdWYuX19wcm90b19fID0gQnVmZmVyLnByb3RvdHlwZVxuICB9IGVsc2Uge1xuICAgIHZhciBzbGljZUxlbiA9IGVuZCAtIHN0YXJ0XG4gICAgbmV3QnVmID0gbmV3IEJ1ZmZlcihzbGljZUxlbiwgdW5kZWZpbmVkKVxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgc2xpY2VMZW47IGkrKykge1xuICAgICAgbmV3QnVmW2ldID0gdGhpc1tpICsgc3RhcnRdXG4gICAgfVxuICB9XG5cbiAgaWYgKG5ld0J1Zi5sZW5ndGgpIG5ld0J1Zi5wYXJlbnQgPSB0aGlzLnBhcmVudCB8fCB0aGlzXG5cbiAgcmV0dXJuIG5ld0J1ZlxufVxuXG4vKlxuICogTmVlZCB0byBtYWtlIHN1cmUgdGhhdCBidWZmZXIgaXNuJ3QgdHJ5aW5nIHRvIHdyaXRlIG91dCBvZiBib3VuZHMuXG4gKi9cbmZ1bmN0aW9uIGNoZWNrT2Zmc2V0IChvZmZzZXQsIGV4dCwgbGVuZ3RoKSB7XG4gIGlmICgob2Zmc2V0ICUgMSkgIT09IDAgfHwgb2Zmc2V0IDwgMCkgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ29mZnNldCBpcyBub3QgdWludCcpXG4gIGlmIChvZmZzZXQgKyBleHQgPiBsZW5ndGgpIHRocm93IG5ldyBSYW5nZUVycm9yKCdUcnlpbmcgdG8gYWNjZXNzIGJleW9uZCBidWZmZXIgbGVuZ3RoJylcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkVUludExFID0gZnVuY3Rpb24gcmVhZFVJbnRMRSAob2Zmc2V0LCBieXRlTGVuZ3RoLCBub0Fzc2VydCkge1xuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGJ5dGVMZW5ndGggPSBieXRlTGVuZ3RoIHwgMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIGJ5dGVMZW5ndGgsIHRoaXMubGVuZ3RoKVxuXG4gIHZhciB2YWwgPSB0aGlzW29mZnNldF1cbiAgdmFyIG11bCA9IDFcbiAgdmFyIGkgPSAwXG4gIHdoaWxlICgrK2kgPCBieXRlTGVuZ3RoICYmIChtdWwgKj0gMHgxMDApKSB7XG4gICAgdmFsICs9IHRoaXNbb2Zmc2V0ICsgaV0gKiBtdWxcbiAgfVxuXG4gIHJldHVybiB2YWxcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkVUludEJFID0gZnVuY3Rpb24gcmVhZFVJbnRCRSAob2Zmc2V0LCBieXRlTGVuZ3RoLCBub0Fzc2VydCkge1xuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGJ5dGVMZW5ndGggPSBieXRlTGVuZ3RoIHwgMFxuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgY2hlY2tPZmZzZXQob2Zmc2V0LCBieXRlTGVuZ3RoLCB0aGlzLmxlbmd0aClcbiAgfVxuXG4gIHZhciB2YWwgPSB0aGlzW29mZnNldCArIC0tYnl0ZUxlbmd0aF1cbiAgdmFyIG11bCA9IDFcbiAgd2hpbGUgKGJ5dGVMZW5ndGggPiAwICYmIChtdWwgKj0gMHgxMDApKSB7XG4gICAgdmFsICs9IHRoaXNbb2Zmc2V0ICsgLS1ieXRlTGVuZ3RoXSAqIG11bFxuICB9XG5cbiAgcmV0dXJuIHZhbFxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRVSW50OCA9IGZ1bmN0aW9uIHJlYWRVSW50OCAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDEsIHRoaXMubGVuZ3RoKVxuICByZXR1cm4gdGhpc1tvZmZzZXRdXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZFVJbnQxNkxFID0gZnVuY3Rpb24gcmVhZFVJbnQxNkxFIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgMiwgdGhpcy5sZW5ndGgpXG4gIHJldHVybiB0aGlzW29mZnNldF0gfCAodGhpc1tvZmZzZXQgKyAxXSA8PCA4KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRVSW50MTZCRSA9IGZ1bmN0aW9uIHJlYWRVSW50MTZCRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDIsIHRoaXMubGVuZ3RoKVxuICByZXR1cm4gKHRoaXNbb2Zmc2V0XSA8PCA4KSB8IHRoaXNbb2Zmc2V0ICsgMV1cbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkVUludDMyTEUgPSBmdW5jdGlvbiByZWFkVUludDMyTEUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCA0LCB0aGlzLmxlbmd0aClcblxuICByZXR1cm4gKCh0aGlzW29mZnNldF0pIHxcbiAgICAgICh0aGlzW29mZnNldCArIDFdIDw8IDgpIHxcbiAgICAgICh0aGlzW29mZnNldCArIDJdIDw8IDE2KSkgK1xuICAgICAgKHRoaXNbb2Zmc2V0ICsgM10gKiAweDEwMDAwMDApXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZFVJbnQzMkJFID0gZnVuY3Rpb24gcmVhZFVJbnQzMkJFIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgNCwgdGhpcy5sZW5ndGgpXG5cbiAgcmV0dXJuICh0aGlzW29mZnNldF0gKiAweDEwMDAwMDApICtcbiAgICAoKHRoaXNbb2Zmc2V0ICsgMV0gPDwgMTYpIHxcbiAgICAodGhpc1tvZmZzZXQgKyAyXSA8PCA4KSB8XG4gICAgdGhpc1tvZmZzZXQgKyAzXSlcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkSW50TEUgPSBmdW5jdGlvbiByZWFkSW50TEUgKG9mZnNldCwgYnl0ZUxlbmd0aCwgbm9Bc3NlcnQpIHtcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBieXRlTGVuZ3RoID0gYnl0ZUxlbmd0aCB8IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCBieXRlTGVuZ3RoLCB0aGlzLmxlbmd0aClcblxuICB2YXIgdmFsID0gdGhpc1tvZmZzZXRdXG4gIHZhciBtdWwgPSAxXG4gIHZhciBpID0gMFxuICB3aGlsZSAoKytpIDwgYnl0ZUxlbmd0aCAmJiAobXVsICo9IDB4MTAwKSkge1xuICAgIHZhbCArPSB0aGlzW29mZnNldCArIGldICogbXVsXG4gIH1cbiAgbXVsICo9IDB4ODBcblxuICBpZiAodmFsID49IG11bCkgdmFsIC09IE1hdGgucG93KDIsIDggKiBieXRlTGVuZ3RoKVxuXG4gIHJldHVybiB2YWxcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkSW50QkUgPSBmdW5jdGlvbiByZWFkSW50QkUgKG9mZnNldCwgYnl0ZUxlbmd0aCwgbm9Bc3NlcnQpIHtcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBieXRlTGVuZ3RoID0gYnl0ZUxlbmd0aCB8IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCBieXRlTGVuZ3RoLCB0aGlzLmxlbmd0aClcblxuICB2YXIgaSA9IGJ5dGVMZW5ndGhcbiAgdmFyIG11bCA9IDFcbiAgdmFyIHZhbCA9IHRoaXNbb2Zmc2V0ICsgLS1pXVxuICB3aGlsZSAoaSA+IDAgJiYgKG11bCAqPSAweDEwMCkpIHtcbiAgICB2YWwgKz0gdGhpc1tvZmZzZXQgKyAtLWldICogbXVsXG4gIH1cbiAgbXVsICo9IDB4ODBcblxuICBpZiAodmFsID49IG11bCkgdmFsIC09IE1hdGgucG93KDIsIDggKiBieXRlTGVuZ3RoKVxuXG4gIHJldHVybiB2YWxcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkSW50OCA9IGZ1bmN0aW9uIHJlYWRJbnQ4IChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgMSwgdGhpcy5sZW5ndGgpXG4gIGlmICghKHRoaXNbb2Zmc2V0XSAmIDB4ODApKSByZXR1cm4gKHRoaXNbb2Zmc2V0XSlcbiAgcmV0dXJuICgoMHhmZiAtIHRoaXNbb2Zmc2V0XSArIDEpICogLTEpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEludDE2TEUgPSBmdW5jdGlvbiByZWFkSW50MTZMRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDIsIHRoaXMubGVuZ3RoKVxuICB2YXIgdmFsID0gdGhpc1tvZmZzZXRdIHwgKHRoaXNbb2Zmc2V0ICsgMV0gPDwgOClcbiAgcmV0dXJuICh2YWwgJiAweDgwMDApID8gdmFsIHwgMHhGRkZGMDAwMCA6IHZhbFxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRJbnQxNkJFID0gZnVuY3Rpb24gcmVhZEludDE2QkUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCAyLCB0aGlzLmxlbmd0aClcbiAgdmFyIHZhbCA9IHRoaXNbb2Zmc2V0ICsgMV0gfCAodGhpc1tvZmZzZXRdIDw8IDgpXG4gIHJldHVybiAodmFsICYgMHg4MDAwKSA/IHZhbCB8IDB4RkZGRjAwMDAgOiB2YWxcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkSW50MzJMRSA9IGZ1bmN0aW9uIHJlYWRJbnQzMkxFIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgNCwgdGhpcy5sZW5ndGgpXG5cbiAgcmV0dXJuICh0aGlzW29mZnNldF0pIHxcbiAgICAodGhpc1tvZmZzZXQgKyAxXSA8PCA4KSB8XG4gICAgKHRoaXNbb2Zmc2V0ICsgMl0gPDwgMTYpIHxcbiAgICAodGhpc1tvZmZzZXQgKyAzXSA8PCAyNClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkSW50MzJCRSA9IGZ1bmN0aW9uIHJlYWRJbnQzMkJFIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgNCwgdGhpcy5sZW5ndGgpXG5cbiAgcmV0dXJuICh0aGlzW29mZnNldF0gPDwgMjQpIHxcbiAgICAodGhpc1tvZmZzZXQgKyAxXSA8PCAxNikgfFxuICAgICh0aGlzW29mZnNldCArIDJdIDw8IDgpIHxcbiAgICAodGhpc1tvZmZzZXQgKyAzXSlcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkRmxvYXRMRSA9IGZ1bmN0aW9uIHJlYWRGbG9hdExFIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgNCwgdGhpcy5sZW5ndGgpXG4gIHJldHVybiBpZWVlNzU0LnJlYWQodGhpcywgb2Zmc2V0LCB0cnVlLCAyMywgNClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkRmxvYXRCRSA9IGZ1bmN0aW9uIHJlYWRGbG9hdEJFIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgNCwgdGhpcy5sZW5ndGgpXG4gIHJldHVybiBpZWVlNzU0LnJlYWQodGhpcywgb2Zmc2V0LCBmYWxzZSwgMjMsIDQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZERvdWJsZUxFID0gZnVuY3Rpb24gcmVhZERvdWJsZUxFIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgOCwgdGhpcy5sZW5ndGgpXG4gIHJldHVybiBpZWVlNzU0LnJlYWQodGhpcywgb2Zmc2V0LCB0cnVlLCA1MiwgOClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkRG91YmxlQkUgPSBmdW5jdGlvbiByZWFkRG91YmxlQkUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCA4LCB0aGlzLmxlbmd0aClcbiAgcmV0dXJuIGllZWU3NTQucmVhZCh0aGlzLCBvZmZzZXQsIGZhbHNlLCA1MiwgOClcbn1cblxuZnVuY3Rpb24gY2hlY2tJbnQgKGJ1ZiwgdmFsdWUsIG9mZnNldCwgZXh0LCBtYXgsIG1pbikge1xuICBpZiAoIUJ1ZmZlci5pc0J1ZmZlcihidWYpKSB0aHJvdyBuZXcgVHlwZUVycm9yKCdidWZmZXIgbXVzdCBiZSBhIEJ1ZmZlciBpbnN0YW5jZScpXG4gIGlmICh2YWx1ZSA+IG1heCB8fCB2YWx1ZSA8IG1pbikgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ3ZhbHVlIGlzIG91dCBvZiBib3VuZHMnKVxuICBpZiAob2Zmc2V0ICsgZXh0ID4gYnVmLmxlbmd0aCkgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ2luZGV4IG91dCBvZiByYW5nZScpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVVSW50TEUgPSBmdW5jdGlvbiB3cml0ZVVJbnRMRSAodmFsdWUsIG9mZnNldCwgYnl0ZUxlbmd0aCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBieXRlTGVuZ3RoID0gYnl0ZUxlbmd0aCB8IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgYnl0ZUxlbmd0aCwgTWF0aC5wb3coMiwgOCAqIGJ5dGVMZW5ndGgpLCAwKVxuXG4gIHZhciBtdWwgPSAxXG4gIHZhciBpID0gMFxuICB0aGlzW29mZnNldF0gPSB2YWx1ZSAmIDB4RkZcbiAgd2hpbGUgKCsraSA8IGJ5dGVMZW5ndGggJiYgKG11bCAqPSAweDEwMCkpIHtcbiAgICB0aGlzW29mZnNldCArIGldID0gKHZhbHVlIC8gbXVsKSAmIDB4RkZcbiAgfVxuXG4gIHJldHVybiBvZmZzZXQgKyBieXRlTGVuZ3RoXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVVSW50QkUgPSBmdW5jdGlvbiB3cml0ZVVJbnRCRSAodmFsdWUsIG9mZnNldCwgYnl0ZUxlbmd0aCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBieXRlTGVuZ3RoID0gYnl0ZUxlbmd0aCB8IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgYnl0ZUxlbmd0aCwgTWF0aC5wb3coMiwgOCAqIGJ5dGVMZW5ndGgpLCAwKVxuXG4gIHZhciBpID0gYnl0ZUxlbmd0aCAtIDFcbiAgdmFyIG11bCA9IDFcbiAgdGhpc1tvZmZzZXQgKyBpXSA9IHZhbHVlICYgMHhGRlxuICB3aGlsZSAoLS1pID49IDAgJiYgKG11bCAqPSAweDEwMCkpIHtcbiAgICB0aGlzW29mZnNldCArIGldID0gKHZhbHVlIC8gbXVsKSAmIDB4RkZcbiAgfVxuXG4gIHJldHVybiBvZmZzZXQgKyBieXRlTGVuZ3RoXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVVSW50OCA9IGZ1bmN0aW9uIHdyaXRlVUludDggKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgMSwgMHhmZiwgMClcbiAgaWYgKCFCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkgdmFsdWUgPSBNYXRoLmZsb29yKHZhbHVlKVxuICB0aGlzW29mZnNldF0gPSAodmFsdWUgJiAweGZmKVxuICByZXR1cm4gb2Zmc2V0ICsgMVxufVxuXG5mdW5jdGlvbiBvYmplY3RXcml0ZVVJbnQxNiAoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4pIHtcbiAgaWYgKHZhbHVlIDwgMCkgdmFsdWUgPSAweGZmZmYgKyB2YWx1ZSArIDFcbiAgZm9yICh2YXIgaSA9IDAsIGogPSBNYXRoLm1pbihidWYubGVuZ3RoIC0gb2Zmc2V0LCAyKTsgaSA8IGo7IGkrKykge1xuICAgIGJ1ZltvZmZzZXQgKyBpXSA9ICh2YWx1ZSAmICgweGZmIDw8ICg4ICogKGxpdHRsZUVuZGlhbiA/IGkgOiAxIC0gaSkpKSkgPj4+XG4gICAgICAobGl0dGxlRW5kaWFuID8gaSA6IDEgLSBpKSAqIDhcbiAgfVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlVUludDE2TEUgPSBmdW5jdGlvbiB3cml0ZVVJbnQxNkxFICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIDIsIDB4ZmZmZiwgMClcbiAgaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgdGhpc1tvZmZzZXRdID0gKHZhbHVlICYgMHhmZilcbiAgICB0aGlzW29mZnNldCArIDFdID0gKHZhbHVlID4+PiA4KVxuICB9IGVsc2Uge1xuICAgIG9iamVjdFdyaXRlVUludDE2KHRoaXMsIHZhbHVlLCBvZmZzZXQsIHRydWUpXG4gIH1cbiAgcmV0dXJuIG9mZnNldCArIDJcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZVVJbnQxNkJFID0gZnVuY3Rpb24gd3JpdGVVSW50MTZCRSAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCAyLCAweGZmZmYsIDApXG4gIGlmIChCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkge1xuICAgIHRoaXNbb2Zmc2V0XSA9ICh2YWx1ZSA+Pj4gOClcbiAgICB0aGlzW29mZnNldCArIDFdID0gKHZhbHVlICYgMHhmZilcbiAgfSBlbHNlIHtcbiAgICBvYmplY3RXcml0ZVVJbnQxNih0aGlzLCB2YWx1ZSwgb2Zmc2V0LCBmYWxzZSlcbiAgfVxuICByZXR1cm4gb2Zmc2V0ICsgMlxufVxuXG5mdW5jdGlvbiBvYmplY3RXcml0ZVVJbnQzMiAoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4pIHtcbiAgaWYgKHZhbHVlIDwgMCkgdmFsdWUgPSAweGZmZmZmZmZmICsgdmFsdWUgKyAxXG4gIGZvciAodmFyIGkgPSAwLCBqID0gTWF0aC5taW4oYnVmLmxlbmd0aCAtIG9mZnNldCwgNCk7IGkgPCBqOyBpKyspIHtcbiAgICBidWZbb2Zmc2V0ICsgaV0gPSAodmFsdWUgPj4+IChsaXR0bGVFbmRpYW4gPyBpIDogMyAtIGkpICogOCkgJiAweGZmXG4gIH1cbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZVVJbnQzMkxFID0gZnVuY3Rpb24gd3JpdGVVSW50MzJMRSAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCA0LCAweGZmZmZmZmZmLCAwKVxuICBpZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICB0aGlzW29mZnNldCArIDNdID0gKHZhbHVlID4+PiAyNClcbiAgICB0aGlzW29mZnNldCArIDJdID0gKHZhbHVlID4+PiAxNilcbiAgICB0aGlzW29mZnNldCArIDFdID0gKHZhbHVlID4+PiA4KVxuICAgIHRoaXNbb2Zmc2V0XSA9ICh2YWx1ZSAmIDB4ZmYpXG4gIH0gZWxzZSB7XG4gICAgb2JqZWN0V3JpdGVVSW50MzIodGhpcywgdmFsdWUsIG9mZnNldCwgdHJ1ZSlcbiAgfVxuICByZXR1cm4gb2Zmc2V0ICsgNFxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlVUludDMyQkUgPSBmdW5jdGlvbiB3cml0ZVVJbnQzMkJFICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIDQsIDB4ZmZmZmZmZmYsIDApXG4gIGlmIChCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkge1xuICAgIHRoaXNbb2Zmc2V0XSA9ICh2YWx1ZSA+Pj4gMjQpXG4gICAgdGhpc1tvZmZzZXQgKyAxXSA9ICh2YWx1ZSA+Pj4gMTYpXG4gICAgdGhpc1tvZmZzZXQgKyAyXSA9ICh2YWx1ZSA+Pj4gOClcbiAgICB0aGlzW29mZnNldCArIDNdID0gKHZhbHVlICYgMHhmZilcbiAgfSBlbHNlIHtcbiAgICBvYmplY3RXcml0ZVVJbnQzMih0aGlzLCB2YWx1ZSwgb2Zmc2V0LCBmYWxzZSlcbiAgfVxuICByZXR1cm4gb2Zmc2V0ICsgNFxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlSW50TEUgPSBmdW5jdGlvbiB3cml0ZUludExFICh2YWx1ZSwgb2Zmc2V0LCBieXRlTGVuZ3RoLCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICB2YXIgbGltaXQgPSBNYXRoLnBvdygyLCA4ICogYnl0ZUxlbmd0aCAtIDEpXG5cbiAgICBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCBieXRlTGVuZ3RoLCBsaW1pdCAtIDEsIC1saW1pdClcbiAgfVxuXG4gIHZhciBpID0gMFxuICB2YXIgbXVsID0gMVxuICB2YXIgc3ViID0gdmFsdWUgPCAwID8gMSA6IDBcbiAgdGhpc1tvZmZzZXRdID0gdmFsdWUgJiAweEZGXG4gIHdoaWxlICgrK2kgPCBieXRlTGVuZ3RoICYmIChtdWwgKj0gMHgxMDApKSB7XG4gICAgdGhpc1tvZmZzZXQgKyBpXSA9ICgodmFsdWUgLyBtdWwpID4+IDApIC0gc3ViICYgMHhGRlxuICB9XG5cbiAgcmV0dXJuIG9mZnNldCArIGJ5dGVMZW5ndGhcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUludEJFID0gZnVuY3Rpb24gd3JpdGVJbnRCRSAodmFsdWUsIG9mZnNldCwgYnl0ZUxlbmd0aCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgdmFyIGxpbWl0ID0gTWF0aC5wb3coMiwgOCAqIGJ5dGVMZW5ndGggLSAxKVxuXG4gICAgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgYnl0ZUxlbmd0aCwgbGltaXQgLSAxLCAtbGltaXQpXG4gIH1cblxuICB2YXIgaSA9IGJ5dGVMZW5ndGggLSAxXG4gIHZhciBtdWwgPSAxXG4gIHZhciBzdWIgPSB2YWx1ZSA8IDAgPyAxIDogMFxuICB0aGlzW29mZnNldCArIGldID0gdmFsdWUgJiAweEZGXG4gIHdoaWxlICgtLWkgPj0gMCAmJiAobXVsICo9IDB4MTAwKSkge1xuICAgIHRoaXNbb2Zmc2V0ICsgaV0gPSAoKHZhbHVlIC8gbXVsKSA+PiAwKSAtIHN1YiAmIDB4RkZcbiAgfVxuXG4gIHJldHVybiBvZmZzZXQgKyBieXRlTGVuZ3RoXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVJbnQ4ID0gZnVuY3Rpb24gd3JpdGVJbnQ4ICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIDEsIDB4N2YsIC0weDgwKVxuICBpZiAoIUJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB2YWx1ZSA9IE1hdGguZmxvb3IodmFsdWUpXG4gIGlmICh2YWx1ZSA8IDApIHZhbHVlID0gMHhmZiArIHZhbHVlICsgMVxuICB0aGlzW29mZnNldF0gPSAodmFsdWUgJiAweGZmKVxuICByZXR1cm4gb2Zmc2V0ICsgMVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlSW50MTZMRSA9IGZ1bmN0aW9uIHdyaXRlSW50MTZMRSAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCAyLCAweDdmZmYsIC0weDgwMDApXG4gIGlmIChCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkge1xuICAgIHRoaXNbb2Zmc2V0XSA9ICh2YWx1ZSAmIDB4ZmYpXG4gICAgdGhpc1tvZmZzZXQgKyAxXSA9ICh2YWx1ZSA+Pj4gOClcbiAgfSBlbHNlIHtcbiAgICBvYmplY3RXcml0ZVVJbnQxNih0aGlzLCB2YWx1ZSwgb2Zmc2V0LCB0cnVlKVxuICB9XG4gIHJldHVybiBvZmZzZXQgKyAyXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVJbnQxNkJFID0gZnVuY3Rpb24gd3JpdGVJbnQxNkJFICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIDIsIDB4N2ZmZiwgLTB4ODAwMClcbiAgaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgdGhpc1tvZmZzZXRdID0gKHZhbHVlID4+PiA4KVxuICAgIHRoaXNbb2Zmc2V0ICsgMV0gPSAodmFsdWUgJiAweGZmKVxuICB9IGVsc2Uge1xuICAgIG9iamVjdFdyaXRlVUludDE2KHRoaXMsIHZhbHVlLCBvZmZzZXQsIGZhbHNlKVxuICB9XG4gIHJldHVybiBvZmZzZXQgKyAyXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVJbnQzMkxFID0gZnVuY3Rpb24gd3JpdGVJbnQzMkxFICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIDQsIDB4N2ZmZmZmZmYsIC0weDgwMDAwMDAwKVxuICBpZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICB0aGlzW29mZnNldF0gPSAodmFsdWUgJiAweGZmKVxuICAgIHRoaXNbb2Zmc2V0ICsgMV0gPSAodmFsdWUgPj4+IDgpXG4gICAgdGhpc1tvZmZzZXQgKyAyXSA9ICh2YWx1ZSA+Pj4gMTYpXG4gICAgdGhpc1tvZmZzZXQgKyAzXSA9ICh2YWx1ZSA+Pj4gMjQpXG4gIH0gZWxzZSB7XG4gICAgb2JqZWN0V3JpdGVVSW50MzIodGhpcywgdmFsdWUsIG9mZnNldCwgdHJ1ZSlcbiAgfVxuICByZXR1cm4gb2Zmc2V0ICsgNFxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlSW50MzJCRSA9IGZ1bmN0aW9uIHdyaXRlSW50MzJCRSAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCA0LCAweDdmZmZmZmZmLCAtMHg4MDAwMDAwMClcbiAgaWYgKHZhbHVlIDwgMCkgdmFsdWUgPSAweGZmZmZmZmZmICsgdmFsdWUgKyAxXG4gIGlmIChCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkge1xuICAgIHRoaXNbb2Zmc2V0XSA9ICh2YWx1ZSA+Pj4gMjQpXG4gICAgdGhpc1tvZmZzZXQgKyAxXSA9ICh2YWx1ZSA+Pj4gMTYpXG4gICAgdGhpc1tvZmZzZXQgKyAyXSA9ICh2YWx1ZSA+Pj4gOClcbiAgICB0aGlzW29mZnNldCArIDNdID0gKHZhbHVlICYgMHhmZilcbiAgfSBlbHNlIHtcbiAgICBvYmplY3RXcml0ZVVJbnQzMih0aGlzLCB2YWx1ZSwgb2Zmc2V0LCBmYWxzZSlcbiAgfVxuICByZXR1cm4gb2Zmc2V0ICsgNFxufVxuXG5mdW5jdGlvbiBjaGVja0lFRUU3NTQgKGJ1ZiwgdmFsdWUsIG9mZnNldCwgZXh0LCBtYXgsIG1pbikge1xuICBpZiAob2Zmc2V0ICsgZXh0ID4gYnVmLmxlbmd0aCkgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ2luZGV4IG91dCBvZiByYW5nZScpXG4gIGlmIChvZmZzZXQgPCAwKSB0aHJvdyBuZXcgUmFuZ2VFcnJvcignaW5kZXggb3V0IG9mIHJhbmdlJylcbn1cblxuZnVuY3Rpb24gd3JpdGVGbG9hdCAoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICBjaGVja0lFRUU3NTQoYnVmLCB2YWx1ZSwgb2Zmc2V0LCA0LCAzLjQwMjgyMzQ2NjM4NTI4ODZlKzM4LCAtMy40MDI4MjM0NjYzODUyODg2ZSszOClcbiAgfVxuICBpZWVlNzU0LndyaXRlKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCAyMywgNClcbiAgcmV0dXJuIG9mZnNldCArIDRcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUZsb2F0TEUgPSBmdW5jdGlvbiB3cml0ZUZsb2F0TEUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiB3cml0ZUZsb2F0KHRoaXMsIHZhbHVlLCBvZmZzZXQsIHRydWUsIG5vQXNzZXJ0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlRmxvYXRCRSA9IGZ1bmN0aW9uIHdyaXRlRmxvYXRCRSAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgcmV0dXJuIHdyaXRlRmxvYXQodGhpcywgdmFsdWUsIG9mZnNldCwgZmFsc2UsIG5vQXNzZXJ0KVxufVxuXG5mdW5jdGlvbiB3cml0ZURvdWJsZSAoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICBjaGVja0lFRUU3NTQoYnVmLCB2YWx1ZSwgb2Zmc2V0LCA4LCAxLjc5NzY5MzEzNDg2MjMxNTdFKzMwOCwgLTEuNzk3NjkzMTM0ODYyMzE1N0UrMzA4KVxuICB9XG4gIGllZWU3NTQud3JpdGUoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIDUyLCA4KVxuICByZXR1cm4gb2Zmc2V0ICsgOFxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlRG91YmxlTEUgPSBmdW5jdGlvbiB3cml0ZURvdWJsZUxFICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gd3JpdGVEb3VibGUodGhpcywgdmFsdWUsIG9mZnNldCwgdHJ1ZSwgbm9Bc3NlcnQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVEb3VibGVCRSA9IGZ1bmN0aW9uIHdyaXRlRG91YmxlQkUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiB3cml0ZURvdWJsZSh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCBmYWxzZSwgbm9Bc3NlcnQpXG59XG5cbi8vIGNvcHkodGFyZ2V0QnVmZmVyLCB0YXJnZXRTdGFydD0wLCBzb3VyY2VTdGFydD0wLCBzb3VyY2VFbmQ9YnVmZmVyLmxlbmd0aClcbkJ1ZmZlci5wcm90b3R5cGUuY29weSA9IGZ1bmN0aW9uIGNvcHkgKHRhcmdldCwgdGFyZ2V0U3RhcnQsIHN0YXJ0LCBlbmQpIHtcbiAgaWYgKCFzdGFydCkgc3RhcnQgPSAwXG4gIGlmICghZW5kICYmIGVuZCAhPT0gMCkgZW5kID0gdGhpcy5sZW5ndGhcbiAgaWYgKHRhcmdldFN0YXJ0ID49IHRhcmdldC5sZW5ndGgpIHRhcmdldFN0YXJ0ID0gdGFyZ2V0Lmxlbmd0aFxuICBpZiAoIXRhcmdldFN0YXJ0KSB0YXJnZXRTdGFydCA9IDBcbiAgaWYgKGVuZCA+IDAgJiYgZW5kIDwgc3RhcnQpIGVuZCA9IHN0YXJ0XG5cbiAgLy8gQ29weSAwIGJ5dGVzOyB3ZSdyZSBkb25lXG4gIGlmIChlbmQgPT09IHN0YXJ0KSByZXR1cm4gMFxuICBpZiAodGFyZ2V0Lmxlbmd0aCA9PT0gMCB8fCB0aGlzLmxlbmd0aCA9PT0gMCkgcmV0dXJuIDBcblxuICAvLyBGYXRhbCBlcnJvciBjb25kaXRpb25zXG4gIGlmICh0YXJnZXRTdGFydCA8IDApIHtcbiAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcigndGFyZ2V0U3RhcnQgb3V0IG9mIGJvdW5kcycpXG4gIH1cbiAgaWYgKHN0YXJ0IDwgMCB8fCBzdGFydCA+PSB0aGlzLmxlbmd0aCkgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ3NvdXJjZVN0YXJ0IG91dCBvZiBib3VuZHMnKVxuICBpZiAoZW5kIDwgMCkgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ3NvdXJjZUVuZCBvdXQgb2YgYm91bmRzJylcblxuICAvLyBBcmUgd2Ugb29iP1xuICBpZiAoZW5kID4gdGhpcy5sZW5ndGgpIGVuZCA9IHRoaXMubGVuZ3RoXG4gIGlmICh0YXJnZXQubGVuZ3RoIC0gdGFyZ2V0U3RhcnQgPCBlbmQgLSBzdGFydCkge1xuICAgIGVuZCA9IHRhcmdldC5sZW5ndGggLSB0YXJnZXRTdGFydCArIHN0YXJ0XG4gIH1cblxuICB2YXIgbGVuID0gZW5kIC0gc3RhcnRcbiAgdmFyIGlcblxuICBpZiAodGhpcyA9PT0gdGFyZ2V0ICYmIHN0YXJ0IDwgdGFyZ2V0U3RhcnQgJiYgdGFyZ2V0U3RhcnQgPCBlbmQpIHtcbiAgICAvLyBkZXNjZW5kaW5nIGNvcHkgZnJvbSBlbmRcbiAgICBmb3IgKGkgPSBsZW4gLSAxOyBpID49IDA7IGktLSkge1xuICAgICAgdGFyZ2V0W2kgKyB0YXJnZXRTdGFydF0gPSB0aGlzW2kgKyBzdGFydF1cbiAgICB9XG4gIH0gZWxzZSBpZiAobGVuIDwgMTAwMCB8fCAhQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICAvLyBhc2NlbmRpbmcgY29weSBmcm9tIHN0YXJ0XG4gICAgZm9yIChpID0gMDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICB0YXJnZXRbaSArIHRhcmdldFN0YXJ0XSA9IHRoaXNbaSArIHN0YXJ0XVxuICAgIH1cbiAgfSBlbHNlIHtcbiAgICBVaW50OEFycmF5LnByb3RvdHlwZS5zZXQuY2FsbChcbiAgICAgIHRhcmdldCxcbiAgICAgIHRoaXMuc3ViYXJyYXkoc3RhcnQsIHN0YXJ0ICsgbGVuKSxcbiAgICAgIHRhcmdldFN0YXJ0XG4gICAgKVxuICB9XG5cbiAgcmV0dXJuIGxlblxufVxuXG4vLyBmaWxsKHZhbHVlLCBzdGFydD0wLCBlbmQ9YnVmZmVyLmxlbmd0aClcbkJ1ZmZlci5wcm90b3R5cGUuZmlsbCA9IGZ1bmN0aW9uIGZpbGwgKHZhbHVlLCBzdGFydCwgZW5kKSB7XG4gIGlmICghdmFsdWUpIHZhbHVlID0gMFxuICBpZiAoIXN0YXJ0KSBzdGFydCA9IDBcbiAgaWYgKCFlbmQpIGVuZCA9IHRoaXMubGVuZ3RoXG5cbiAgaWYgKGVuZCA8IHN0YXJ0KSB0aHJvdyBuZXcgUmFuZ2VFcnJvcignZW5kIDwgc3RhcnQnKVxuXG4gIC8vIEZpbGwgMCBieXRlczsgd2UncmUgZG9uZVxuICBpZiAoZW5kID09PSBzdGFydCkgcmV0dXJuXG4gIGlmICh0aGlzLmxlbmd0aCA9PT0gMCkgcmV0dXJuXG5cbiAgaWYgKHN0YXJ0IDwgMCB8fCBzdGFydCA+PSB0aGlzLmxlbmd0aCkgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ3N0YXJ0IG91dCBvZiBib3VuZHMnKVxuICBpZiAoZW5kIDwgMCB8fCBlbmQgPiB0aGlzLmxlbmd0aCkgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ2VuZCBvdXQgb2YgYm91bmRzJylcblxuICB2YXIgaVxuICBpZiAodHlwZW9mIHZhbHVlID09PSAnbnVtYmVyJykge1xuICAgIGZvciAoaSA9IHN0YXJ0OyBpIDwgZW5kOyBpKyspIHtcbiAgICAgIHRoaXNbaV0gPSB2YWx1ZVxuICAgIH1cbiAgfSBlbHNlIHtcbiAgICB2YXIgYnl0ZXMgPSB1dGY4VG9CeXRlcyh2YWx1ZS50b1N0cmluZygpKVxuICAgIHZhciBsZW4gPSBieXRlcy5sZW5ndGhcbiAgICBmb3IgKGkgPSBzdGFydDsgaSA8IGVuZDsgaSsrKSB7XG4gICAgICB0aGlzW2ldID0gYnl0ZXNbaSAlIGxlbl1cbiAgICB9XG4gIH1cblxuICByZXR1cm4gdGhpc1xufVxuXG4vLyBIRUxQRVIgRlVOQ1RJT05TXG4vLyA9PT09PT09PT09PT09PT09XG5cbnZhciBJTlZBTElEX0JBU0U2NF9SRSA9IC9bXitcXC8wLTlBLVphLXotX10vZ1xuXG5mdW5jdGlvbiBiYXNlNjRjbGVhbiAoc3RyKSB7XG4gIC8vIE5vZGUgc3RyaXBzIG91dCBpbnZhbGlkIGNoYXJhY3RlcnMgbGlrZSBcXG4gYW5kIFxcdCBmcm9tIHRoZSBzdHJpbmcsIGJhc2U2NC1qcyBkb2VzIG5vdFxuICBzdHIgPSBzdHJpbmd0cmltKHN0cikucmVwbGFjZShJTlZBTElEX0JBU0U2NF9SRSwgJycpXG4gIC8vIE5vZGUgY29udmVydHMgc3RyaW5ncyB3aXRoIGxlbmd0aCA8IDIgdG8gJydcbiAgaWYgKHN0ci5sZW5ndGggPCAyKSByZXR1cm4gJydcbiAgLy8gTm9kZSBhbGxvd3MgZm9yIG5vbi1wYWRkZWQgYmFzZTY0IHN0cmluZ3MgKG1pc3NpbmcgdHJhaWxpbmcgPT09KSwgYmFzZTY0LWpzIGRvZXMgbm90XG4gIHdoaWxlIChzdHIubGVuZ3RoICUgNCAhPT0gMCkge1xuICAgIHN0ciA9IHN0ciArICc9J1xuICB9XG4gIHJldHVybiBzdHJcbn1cblxuZnVuY3Rpb24gc3RyaW5ndHJpbSAoc3RyKSB7XG4gIGlmIChzdHIudHJpbSkgcmV0dXJuIHN0ci50cmltKClcbiAgcmV0dXJuIHN0ci5yZXBsYWNlKC9eXFxzK3xcXHMrJC9nLCAnJylcbn1cblxuZnVuY3Rpb24gdG9IZXggKG4pIHtcbiAgaWYgKG4gPCAxNikgcmV0dXJuICcwJyArIG4udG9TdHJpbmcoMTYpXG4gIHJldHVybiBuLnRvU3RyaW5nKDE2KVxufVxuXG5mdW5jdGlvbiB1dGY4VG9CeXRlcyAoc3RyaW5nLCB1bml0cykge1xuICB1bml0cyA9IHVuaXRzIHx8IEluZmluaXR5XG4gIHZhciBjb2RlUG9pbnRcbiAgdmFyIGxlbmd0aCA9IHN0cmluZy5sZW5ndGhcbiAgdmFyIGxlYWRTdXJyb2dhdGUgPSBudWxsXG4gIHZhciBieXRlcyA9IFtdXG5cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgIGNvZGVQb2ludCA9IHN0cmluZy5jaGFyQ29kZUF0KGkpXG5cbiAgICAvLyBpcyBzdXJyb2dhdGUgY29tcG9uZW50XG4gICAgaWYgKGNvZGVQb2ludCA+IDB4RDdGRiAmJiBjb2RlUG9pbnQgPCAweEUwMDApIHtcbiAgICAgIC8vIGxhc3QgY2hhciB3YXMgYSBsZWFkXG4gICAgICBpZiAoIWxlYWRTdXJyb2dhdGUpIHtcbiAgICAgICAgLy8gbm8gbGVhZCB5ZXRcbiAgICAgICAgaWYgKGNvZGVQb2ludCA+IDB4REJGRikge1xuICAgICAgICAgIC8vIHVuZXhwZWN0ZWQgdHJhaWxcbiAgICAgICAgICBpZiAoKHVuaXRzIC09IDMpID4gLTEpIGJ5dGVzLnB1c2goMHhFRiwgMHhCRiwgMHhCRClcbiAgICAgICAgICBjb250aW51ZVxuICAgICAgICB9IGVsc2UgaWYgKGkgKyAxID09PSBsZW5ndGgpIHtcbiAgICAgICAgICAvLyB1bnBhaXJlZCBsZWFkXG4gICAgICAgICAgaWYgKCh1bml0cyAtPSAzKSA+IC0xKSBieXRlcy5wdXNoKDB4RUYsIDB4QkYsIDB4QkQpXG4gICAgICAgICAgY29udGludWVcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHZhbGlkIGxlYWRcbiAgICAgICAgbGVhZFN1cnJvZ2F0ZSA9IGNvZGVQb2ludFxuXG4gICAgICAgIGNvbnRpbnVlXG4gICAgICB9XG5cbiAgICAgIC8vIDIgbGVhZHMgaW4gYSByb3dcbiAgICAgIGlmIChjb2RlUG9pbnQgPCAweERDMDApIHtcbiAgICAgICAgaWYgKCh1bml0cyAtPSAzKSA+IC0xKSBieXRlcy5wdXNoKDB4RUYsIDB4QkYsIDB4QkQpXG4gICAgICAgIGxlYWRTdXJyb2dhdGUgPSBjb2RlUG9pbnRcbiAgICAgICAgY29udGludWVcbiAgICAgIH1cblxuICAgICAgLy8gdmFsaWQgc3Vycm9nYXRlIHBhaXJcbiAgICAgIGNvZGVQb2ludCA9IChsZWFkU3Vycm9nYXRlIC0gMHhEODAwIDw8IDEwIHwgY29kZVBvaW50IC0gMHhEQzAwKSArIDB4MTAwMDBcbiAgICB9IGVsc2UgaWYgKGxlYWRTdXJyb2dhdGUpIHtcbiAgICAgIC8vIHZhbGlkIGJtcCBjaGFyLCBidXQgbGFzdCBjaGFyIHdhcyBhIGxlYWRcbiAgICAgIGlmICgodW5pdHMgLT0gMykgPiAtMSkgYnl0ZXMucHVzaCgweEVGLCAweEJGLCAweEJEKVxuICAgIH1cblxuICAgIGxlYWRTdXJyb2dhdGUgPSBudWxsXG5cbiAgICAvLyBlbmNvZGUgdXRmOFxuICAgIGlmIChjb2RlUG9pbnQgPCAweDgwKSB7XG4gICAgICBpZiAoKHVuaXRzIC09IDEpIDwgMCkgYnJlYWtcbiAgICAgIGJ5dGVzLnB1c2goY29kZVBvaW50KVxuICAgIH0gZWxzZSBpZiAoY29kZVBvaW50IDwgMHg4MDApIHtcbiAgICAgIGlmICgodW5pdHMgLT0gMikgPCAwKSBicmVha1xuICAgICAgYnl0ZXMucHVzaChcbiAgICAgICAgY29kZVBvaW50ID4+IDB4NiB8IDB4QzAsXG4gICAgICAgIGNvZGVQb2ludCAmIDB4M0YgfCAweDgwXG4gICAgICApXG4gICAgfSBlbHNlIGlmIChjb2RlUG9pbnQgPCAweDEwMDAwKSB7XG4gICAgICBpZiAoKHVuaXRzIC09IDMpIDwgMCkgYnJlYWtcbiAgICAgIGJ5dGVzLnB1c2goXG4gICAgICAgIGNvZGVQb2ludCA+PiAweEMgfCAweEUwLFxuICAgICAgICBjb2RlUG9pbnQgPj4gMHg2ICYgMHgzRiB8IDB4ODAsXG4gICAgICAgIGNvZGVQb2ludCAmIDB4M0YgfCAweDgwXG4gICAgICApXG4gICAgfSBlbHNlIGlmIChjb2RlUG9pbnQgPCAweDExMDAwMCkge1xuICAgICAgaWYgKCh1bml0cyAtPSA0KSA8IDApIGJyZWFrXG4gICAgICBieXRlcy5wdXNoKFxuICAgICAgICBjb2RlUG9pbnQgPj4gMHgxMiB8IDB4RjAsXG4gICAgICAgIGNvZGVQb2ludCA+PiAweEMgJiAweDNGIHwgMHg4MCxcbiAgICAgICAgY29kZVBvaW50ID4+IDB4NiAmIDB4M0YgfCAweDgwLFxuICAgICAgICBjb2RlUG9pbnQgJiAweDNGIHwgMHg4MFxuICAgICAgKVxuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgY29kZSBwb2ludCcpXG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGJ5dGVzXG59XG5cbmZ1bmN0aW9uIGFzY2lpVG9CeXRlcyAoc3RyKSB7XG4gIHZhciBieXRlQXJyYXkgPSBbXVxuICBmb3IgKHZhciBpID0gMDsgaSA8IHN0ci5sZW5ndGg7IGkrKykge1xuICAgIC8vIE5vZGUncyBjb2RlIHNlZW1zIHRvIGJlIGRvaW5nIHRoaXMgYW5kIG5vdCAmIDB4N0YuLlxuICAgIGJ5dGVBcnJheS5wdXNoKHN0ci5jaGFyQ29kZUF0KGkpICYgMHhGRilcbiAgfVxuICByZXR1cm4gYnl0ZUFycmF5XG59XG5cbmZ1bmN0aW9uIHV0ZjE2bGVUb0J5dGVzIChzdHIsIHVuaXRzKSB7XG4gIHZhciBjLCBoaSwgbG9cbiAgdmFyIGJ5dGVBcnJheSA9IFtdXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgc3RyLmxlbmd0aDsgaSsrKSB7XG4gICAgaWYgKCh1bml0cyAtPSAyKSA8IDApIGJyZWFrXG5cbiAgICBjID0gc3RyLmNoYXJDb2RlQXQoaSlcbiAgICBoaSA9IGMgPj4gOFxuICAgIGxvID0gYyAlIDI1NlxuICAgIGJ5dGVBcnJheS5wdXNoKGxvKVxuICAgIGJ5dGVBcnJheS5wdXNoKGhpKVxuICB9XG5cbiAgcmV0dXJuIGJ5dGVBcnJheVxufVxuXG5mdW5jdGlvbiBiYXNlNjRUb0J5dGVzIChzdHIpIHtcbiAgcmV0dXJuIGJhc2U2NC50b0J5dGVBcnJheShiYXNlNjRjbGVhbihzdHIpKVxufVxuXG5mdW5jdGlvbiBibGl0QnVmZmVyIChzcmMsIGRzdCwgb2Zmc2V0LCBsZW5ndGgpIHtcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgIGlmICgoaSArIG9mZnNldCA+PSBkc3QubGVuZ3RoKSB8fCAoaSA+PSBzcmMubGVuZ3RoKSkgYnJlYWtcbiAgICBkc3RbaSArIG9mZnNldF0gPSBzcmNbaV1cbiAgfVxuICByZXR1cm4gaVxufVxuIiwiJ3VzZSBzdHJpY3QnXG5cbmV4cG9ydHMudG9CeXRlQXJyYXkgPSB0b0J5dGVBcnJheVxuZXhwb3J0cy5mcm9tQnl0ZUFycmF5ID0gZnJvbUJ5dGVBcnJheVxuXG52YXIgbG9va3VwID0gW11cbnZhciByZXZMb29rdXAgPSBbXVxudmFyIEFyciA9IHR5cGVvZiBVaW50OEFycmF5ICE9PSAndW5kZWZpbmVkJyA/IFVpbnQ4QXJyYXkgOiBBcnJheVxuXG5mdW5jdGlvbiBpbml0ICgpIHtcbiAgdmFyIGNvZGUgPSAnQUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVphYmNkZWZnaGlqa2xtbm9wcXJzdHV2d3h5ejAxMjM0NTY3ODkrLydcbiAgZm9yICh2YXIgaSA9IDAsIGxlbiA9IGNvZGUubGVuZ3RoOyBpIDwgbGVuOyArK2kpIHtcbiAgICBsb29rdXBbaV0gPSBjb2RlW2ldXG4gICAgcmV2TG9va3VwW2NvZGUuY2hhckNvZGVBdChpKV0gPSBpXG4gIH1cblxuICByZXZMb29rdXBbJy0nLmNoYXJDb2RlQXQoMCldID0gNjJcbiAgcmV2TG9va3VwWydfJy5jaGFyQ29kZUF0KDApXSA9IDYzXG59XG5cbmluaXQoKVxuXG5mdW5jdGlvbiB0b0J5dGVBcnJheSAoYjY0KSB7XG4gIHZhciBpLCBqLCBsLCB0bXAsIHBsYWNlSG9sZGVycywgYXJyXG4gIHZhciBsZW4gPSBiNjQubGVuZ3RoXG5cbiAgaWYgKGxlbiAlIDQgPiAwKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIHN0cmluZy4gTGVuZ3RoIG11c3QgYmUgYSBtdWx0aXBsZSBvZiA0JylcbiAgfVxuXG4gIC8vIHRoZSBudW1iZXIgb2YgZXF1YWwgc2lnbnMgKHBsYWNlIGhvbGRlcnMpXG4gIC8vIGlmIHRoZXJlIGFyZSB0d28gcGxhY2Vob2xkZXJzLCB0aGFuIHRoZSB0d28gY2hhcmFjdGVycyBiZWZvcmUgaXRcbiAgLy8gcmVwcmVzZW50IG9uZSBieXRlXG4gIC8vIGlmIHRoZXJlIGlzIG9ubHkgb25lLCB0aGVuIHRoZSB0aHJlZSBjaGFyYWN0ZXJzIGJlZm9yZSBpdCByZXByZXNlbnQgMiBieXRlc1xuICAvLyB0aGlzIGlzIGp1c3QgYSBjaGVhcCBoYWNrIHRvIG5vdCBkbyBpbmRleE9mIHR3aWNlXG4gIHBsYWNlSG9sZGVycyA9IGI2NFtsZW4gLSAyXSA9PT0gJz0nID8gMiA6IGI2NFtsZW4gLSAxXSA9PT0gJz0nID8gMSA6IDBcblxuICAvLyBiYXNlNjQgaXMgNC8zICsgdXAgdG8gdHdvIGNoYXJhY3RlcnMgb2YgdGhlIG9yaWdpbmFsIGRhdGFcbiAgYXJyID0gbmV3IEFycihsZW4gKiAzIC8gNCAtIHBsYWNlSG9sZGVycylcblxuICAvLyBpZiB0aGVyZSBhcmUgcGxhY2Vob2xkZXJzLCBvbmx5IGdldCB1cCB0byB0aGUgbGFzdCBjb21wbGV0ZSA0IGNoYXJzXG4gIGwgPSBwbGFjZUhvbGRlcnMgPiAwID8gbGVuIC0gNCA6IGxlblxuXG4gIHZhciBMID0gMFxuXG4gIGZvciAoaSA9IDAsIGogPSAwOyBpIDwgbDsgaSArPSA0LCBqICs9IDMpIHtcbiAgICB0bXAgPSAocmV2TG9va3VwW2I2NC5jaGFyQ29kZUF0KGkpXSA8PCAxOCkgfCAocmV2TG9va3VwW2I2NC5jaGFyQ29kZUF0KGkgKyAxKV0gPDwgMTIpIHwgKHJldkxvb2t1cFtiNjQuY2hhckNvZGVBdChpICsgMildIDw8IDYpIHwgcmV2TG9va3VwW2I2NC5jaGFyQ29kZUF0KGkgKyAzKV1cbiAgICBhcnJbTCsrXSA9ICh0bXAgPj4gMTYpICYgMHhGRlxuICAgIGFycltMKytdID0gKHRtcCA+PiA4KSAmIDB4RkZcbiAgICBhcnJbTCsrXSA9IHRtcCAmIDB4RkZcbiAgfVxuXG4gIGlmIChwbGFjZUhvbGRlcnMgPT09IDIpIHtcbiAgICB0bXAgPSAocmV2TG9va3VwW2I2NC5jaGFyQ29kZUF0KGkpXSA8PCAyKSB8IChyZXZMb29rdXBbYjY0LmNoYXJDb2RlQXQoaSArIDEpXSA+PiA0KVxuICAgIGFycltMKytdID0gdG1wICYgMHhGRlxuICB9IGVsc2UgaWYgKHBsYWNlSG9sZGVycyA9PT0gMSkge1xuICAgIHRtcCA9IChyZXZMb29rdXBbYjY0LmNoYXJDb2RlQXQoaSldIDw8IDEwKSB8IChyZXZMb29rdXBbYjY0LmNoYXJDb2RlQXQoaSArIDEpXSA8PCA0KSB8IChyZXZMb29rdXBbYjY0LmNoYXJDb2RlQXQoaSArIDIpXSA+PiAyKVxuICAgIGFycltMKytdID0gKHRtcCA+PiA4KSAmIDB4RkZcbiAgICBhcnJbTCsrXSA9IHRtcCAmIDB4RkZcbiAgfVxuXG4gIHJldHVybiBhcnJcbn1cblxuZnVuY3Rpb24gdHJpcGxldFRvQmFzZTY0IChudW0pIHtcbiAgcmV0dXJuIGxvb2t1cFtudW0gPj4gMTggJiAweDNGXSArIGxvb2t1cFtudW0gPj4gMTIgJiAweDNGXSArIGxvb2t1cFtudW0gPj4gNiAmIDB4M0ZdICsgbG9va3VwW251bSAmIDB4M0ZdXG59XG5cbmZ1bmN0aW9uIGVuY29kZUNodW5rICh1aW50OCwgc3RhcnQsIGVuZCkge1xuICB2YXIgdG1wXG4gIHZhciBvdXRwdXQgPSBbXVxuICBmb3IgKHZhciBpID0gc3RhcnQ7IGkgPCBlbmQ7IGkgKz0gMykge1xuICAgIHRtcCA9ICh1aW50OFtpXSA8PCAxNikgKyAodWludDhbaSArIDFdIDw8IDgpICsgKHVpbnQ4W2kgKyAyXSlcbiAgICBvdXRwdXQucHVzaCh0cmlwbGV0VG9CYXNlNjQodG1wKSlcbiAgfVxuICByZXR1cm4gb3V0cHV0LmpvaW4oJycpXG59XG5cbmZ1bmN0aW9uIGZyb21CeXRlQXJyYXkgKHVpbnQ4KSB7XG4gIHZhciB0bXBcbiAgdmFyIGxlbiA9IHVpbnQ4Lmxlbmd0aFxuICB2YXIgZXh0cmFCeXRlcyA9IGxlbiAlIDMgLy8gaWYgd2UgaGF2ZSAxIGJ5dGUgbGVmdCwgcGFkIDIgYnl0ZXNcbiAgdmFyIG91dHB1dCA9ICcnXG4gIHZhciBwYXJ0cyA9IFtdXG4gIHZhciBtYXhDaHVua0xlbmd0aCA9IDE2MzgzIC8vIG11c3QgYmUgbXVsdGlwbGUgb2YgM1xuXG4gIC8vIGdvIHRocm91Z2ggdGhlIGFycmF5IGV2ZXJ5IHRocmVlIGJ5dGVzLCB3ZSdsbCBkZWFsIHdpdGggdHJhaWxpbmcgc3R1ZmYgbGF0ZXJcbiAgZm9yICh2YXIgaSA9IDAsIGxlbjIgPSBsZW4gLSBleHRyYUJ5dGVzOyBpIDwgbGVuMjsgaSArPSBtYXhDaHVua0xlbmd0aCkge1xuICAgIHBhcnRzLnB1c2goZW5jb2RlQ2h1bmsodWludDgsIGksIChpICsgbWF4Q2h1bmtMZW5ndGgpID4gbGVuMiA/IGxlbjIgOiAoaSArIG1heENodW5rTGVuZ3RoKSkpXG4gIH1cblxuICAvLyBwYWQgdGhlIGVuZCB3aXRoIHplcm9zLCBidXQgbWFrZSBzdXJlIHRvIG5vdCBmb3JnZXQgdGhlIGV4dHJhIGJ5dGVzXG4gIGlmIChleHRyYUJ5dGVzID09PSAxKSB7XG4gICAgdG1wID0gdWludDhbbGVuIC0gMV1cbiAgICBvdXRwdXQgKz0gbG9va3VwW3RtcCA+PiAyXVxuICAgIG91dHB1dCArPSBsb29rdXBbKHRtcCA8PCA0KSAmIDB4M0ZdXG4gICAgb3V0cHV0ICs9ICc9PSdcbiAgfSBlbHNlIGlmIChleHRyYUJ5dGVzID09PSAyKSB7XG4gICAgdG1wID0gKHVpbnQ4W2xlbiAtIDJdIDw8IDgpICsgKHVpbnQ4W2xlbiAtIDFdKVxuICAgIG91dHB1dCArPSBsb29rdXBbdG1wID4+IDEwXVxuICAgIG91dHB1dCArPSBsb29rdXBbKHRtcCA+PiA0KSAmIDB4M0ZdXG4gICAgb3V0cHV0ICs9IGxvb2t1cFsodG1wIDw8IDIpICYgMHgzRl1cbiAgICBvdXRwdXQgKz0gJz0nXG4gIH1cblxuICBwYXJ0cy5wdXNoKG91dHB1dClcblxuICByZXR1cm4gcGFydHMuam9pbignJylcbn1cbiIsImV4cG9ydHMucmVhZCA9IGZ1bmN0aW9uIChidWZmZXIsIG9mZnNldCwgaXNMRSwgbUxlbiwgbkJ5dGVzKSB7XG4gIHZhciBlLCBtXG4gIHZhciBlTGVuID0gbkJ5dGVzICogOCAtIG1MZW4gLSAxXG4gIHZhciBlTWF4ID0gKDEgPDwgZUxlbikgLSAxXG4gIHZhciBlQmlhcyA9IGVNYXggPj4gMVxuICB2YXIgbkJpdHMgPSAtN1xuICB2YXIgaSA9IGlzTEUgPyAobkJ5dGVzIC0gMSkgOiAwXG4gIHZhciBkID0gaXNMRSA/IC0xIDogMVxuICB2YXIgcyA9IGJ1ZmZlcltvZmZzZXQgKyBpXVxuXG4gIGkgKz0gZFxuXG4gIGUgPSBzICYgKCgxIDw8ICgtbkJpdHMpKSAtIDEpXG4gIHMgPj49ICgtbkJpdHMpXG4gIG5CaXRzICs9IGVMZW5cbiAgZm9yICg7IG5CaXRzID4gMDsgZSA9IGUgKiAyNTYgKyBidWZmZXJbb2Zmc2V0ICsgaV0sIGkgKz0gZCwgbkJpdHMgLT0gOCkge31cblxuICBtID0gZSAmICgoMSA8PCAoLW5CaXRzKSkgLSAxKVxuICBlID4+PSAoLW5CaXRzKVxuICBuQml0cyArPSBtTGVuXG4gIGZvciAoOyBuQml0cyA+IDA7IG0gPSBtICogMjU2ICsgYnVmZmVyW29mZnNldCArIGldLCBpICs9IGQsIG5CaXRzIC09IDgpIHt9XG5cbiAgaWYgKGUgPT09IDApIHtcbiAgICBlID0gMSAtIGVCaWFzXG4gIH0gZWxzZSBpZiAoZSA9PT0gZU1heCkge1xuICAgIHJldHVybiBtID8gTmFOIDogKChzID8gLTEgOiAxKSAqIEluZmluaXR5KVxuICB9IGVsc2Uge1xuICAgIG0gPSBtICsgTWF0aC5wb3coMiwgbUxlbilcbiAgICBlID0gZSAtIGVCaWFzXG4gIH1cbiAgcmV0dXJuIChzID8gLTEgOiAxKSAqIG0gKiBNYXRoLnBvdygyLCBlIC0gbUxlbilcbn1cblxuZXhwb3J0cy53cml0ZSA9IGZ1bmN0aW9uIChidWZmZXIsIHZhbHVlLCBvZmZzZXQsIGlzTEUsIG1MZW4sIG5CeXRlcykge1xuICB2YXIgZSwgbSwgY1xuICB2YXIgZUxlbiA9IG5CeXRlcyAqIDggLSBtTGVuIC0gMVxuICB2YXIgZU1heCA9ICgxIDw8IGVMZW4pIC0gMVxuICB2YXIgZUJpYXMgPSBlTWF4ID4+IDFcbiAgdmFyIHJ0ID0gKG1MZW4gPT09IDIzID8gTWF0aC5wb3coMiwgLTI0KSAtIE1hdGgucG93KDIsIC03NykgOiAwKVxuICB2YXIgaSA9IGlzTEUgPyAwIDogKG5CeXRlcyAtIDEpXG4gIHZhciBkID0gaXNMRSA/IDEgOiAtMVxuICB2YXIgcyA9IHZhbHVlIDwgMCB8fCAodmFsdWUgPT09IDAgJiYgMSAvIHZhbHVlIDwgMCkgPyAxIDogMFxuXG4gIHZhbHVlID0gTWF0aC5hYnModmFsdWUpXG5cbiAgaWYgKGlzTmFOKHZhbHVlKSB8fCB2YWx1ZSA9PT0gSW5maW5pdHkpIHtcbiAgICBtID0gaXNOYU4odmFsdWUpID8gMSA6IDBcbiAgICBlID0gZU1heFxuICB9IGVsc2Uge1xuICAgIGUgPSBNYXRoLmZsb29yKE1hdGgubG9nKHZhbHVlKSAvIE1hdGguTE4yKVxuICAgIGlmICh2YWx1ZSAqIChjID0gTWF0aC5wb3coMiwgLWUpKSA8IDEpIHtcbiAgICAgIGUtLVxuICAgICAgYyAqPSAyXG4gICAgfVxuICAgIGlmIChlICsgZUJpYXMgPj0gMSkge1xuICAgICAgdmFsdWUgKz0gcnQgLyBjXG4gICAgfSBlbHNlIHtcbiAgICAgIHZhbHVlICs9IHJ0ICogTWF0aC5wb3coMiwgMSAtIGVCaWFzKVxuICAgIH1cbiAgICBpZiAodmFsdWUgKiBjID49IDIpIHtcbiAgICAgIGUrK1xuICAgICAgYyAvPSAyXG4gICAgfVxuXG4gICAgaWYgKGUgKyBlQmlhcyA+PSBlTWF4KSB7XG4gICAgICBtID0gMFxuICAgICAgZSA9IGVNYXhcbiAgICB9IGVsc2UgaWYgKGUgKyBlQmlhcyA+PSAxKSB7XG4gICAgICBtID0gKHZhbHVlICogYyAtIDEpICogTWF0aC5wb3coMiwgbUxlbilcbiAgICAgIGUgPSBlICsgZUJpYXNcbiAgICB9IGVsc2Uge1xuICAgICAgbSA9IHZhbHVlICogTWF0aC5wb3coMiwgZUJpYXMgLSAxKSAqIE1hdGgucG93KDIsIG1MZW4pXG4gICAgICBlID0gMFxuICAgIH1cbiAgfVxuXG4gIGZvciAoOyBtTGVuID49IDg7IGJ1ZmZlcltvZmZzZXQgKyBpXSA9IG0gJiAweGZmLCBpICs9IGQsIG0gLz0gMjU2LCBtTGVuIC09IDgpIHt9XG5cbiAgZSA9IChlIDw8IG1MZW4pIHwgbVxuICBlTGVuICs9IG1MZW5cbiAgZm9yICg7IGVMZW4gPiAwOyBidWZmZXJbb2Zmc2V0ICsgaV0gPSBlICYgMHhmZiwgaSArPSBkLCBlIC89IDI1NiwgZUxlbiAtPSA4KSB7fVxuXG4gIGJ1ZmZlcltvZmZzZXQgKyBpIC0gZF0gfD0gcyAqIDEyOFxufVxuIiwidmFyIHRvU3RyaW5nID0ge30udG9TdHJpbmc7XG5cbm1vZHVsZS5leHBvcnRzID0gQXJyYXkuaXNBcnJheSB8fCBmdW5jdGlvbiAoYXJyKSB7XG4gIHJldHVybiB0b1N0cmluZy5jYWxsKGFycikgPT0gJ1tvYmplY3QgQXJyYXldJztcbn07XG4iXX0=
