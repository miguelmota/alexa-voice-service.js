(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
(function () {
  'use strict';

  const Buffer = require('buffer').Buffer;
  const qs = require('qs');
  const httpMessageParser = require('http-message-parser');

  const AMAZON_ERROR_CODES = require('./lib/AmazonErrorCodes');
  const Observable = require('./lib/Observable');
  const Player = require('./lib/player');
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
          this.emit(AVS.EventTypes.LOGIN);
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

},{"./lib/AmazonErrorCodes":3,"./lib/Observable":4,"./lib/player":5,"./lib/utils/arrayBufferToString":7,"./lib/utils/downsampleBuffer":8,"./lib/utils/interleave":9,"./lib/utils/mergeBuffers":10,"./lib/utils/writeUTFBytes":11,"buffer":17,"http-message-parser":12,"qs":13}],2:[function(require,module,exports){
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
  stopRe.disabled = true;
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
  pauseAudio.disabled = false;
  stopAudio.disabled = false;
});

avs.player.on(AVS.Player.EventTypes.ENDED, () => {
  playAudio.disabled = true;
  pauseAudio.disabled = true;
  stopAudio.disabled = true;
});

avs.player.on(AVS.Player.EventTypes.STOP, () => {
  playAudio.disabled = false;
  pauseAudio.disabled = false;
  stopAudio.disabled = false;
});

avs.player.on(AVS.Player.EventTypes.PAUSE, () => {
  playAudio.disabled = true;
  pauseAudio.disabled = false;
  stopAudio.disabled = false;
});

avs.player.on(AVS.Player.EventTypes.REPLAY, () => {});

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
  avs.plaer.play();
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
        return resolve();
      };

      if (stringType === '[object DataView]' || stringType === '[object Uint8Array]') {
        arrayBufferToAudioBuffer(item.buffer).then(proceed);
      } else if (stringType === '[object AudioBuffer]') {
        proceed(item);
      } else {
        const error = new Error('Invalid type.');
        this._log(error);
        return reject(error);
      }
    });
  }

  dequeue() {
    return new Promise((resolve, reject) => {
      const item = this._queue.shift();

      if (item) {
        this._log('Dequeue audio');
        this.emit(Player.EventTypes.DEQUEUE);
        return resolve(item);
      }

      return reject();
    });
  }

  play() {
    return new Promise((resolve, reject) => {
      return this.dequeue().then(audioBuffer => {
        this._log('Play audio');
        this.emit(Player.EventTypes.PLAY);
        this.playAudioBuffer(audioBuffer);
      });
    });
  }

  stop() {
    return new Promise((resolve, reject) => {
      if (this._currentSource) {
        this._currentSource.stop();
      }

      this._log('Stop audio');
      this.emit(Player.EventTypes.STOP);
    });
  }

  pause() {
    return new Promise((resolve, reject) => {
      if (this._currentSource) {
        this._currentSource.pause();
      }

      this._log('Pause audio');
      this.emit(Player.EventTypes.PAUSE);
    });
  }

  replay() {
    return new Promise((resolve, reject) => {
      this._log('Replay audio');
      this.emit(Player.EventTypes.REPLAY);
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
      this._currentSource = audio;

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

      source.onended = event => {
        this._log('Audio ended');
        this.emit(Player.EventTypes.ENDED);
      };

      this._currentSource = source;
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
      DEQUEUE: 'dequeue'
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL3Vzci9sb2NhbC9saWIvbm9kZV9tb2R1bGVzL3dhdGNoaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIuLi9hdnMuanMiLCJpbmRleC5qcyIsIi4uL2xpYi9BbWF6b25FcnJvckNvZGVzLmpzIiwiLi4vbGliL09ic2VydmFibGUuanMiLCIuLi9saWIvcGxheWVyLmpzIiwiLi4vbGliL3V0aWxzL2FycmF5QnVmZmVyVG9BdWRpb0J1ZmZlci5qcyIsIi4uL2xpYi91dGlscy9hcnJheUJ1ZmZlclRvU3RyaW5nLmpzIiwiLi4vbGliL3V0aWxzL2Rvd25zYW1wbGVCdWZmZXIuanMiLCIuLi9saWIvdXRpbHMvaW50ZXJsZWF2ZS5qcyIsIi4uL2xpYi91dGlscy9tZXJnZUJ1ZmZlcnMuanMiLCIuLi9saWIvdXRpbHMvd3JpdGVVVEZCeXRlcy5qcyIsIi4uL25vZGVfbW9kdWxlcy9odHRwLW1lc3NhZ2UtcGFyc2VyL2h0dHAtbWVzc2FnZS1wYXJzZXIuanMiLCIuLi9ub2RlX21vZHVsZXMvcXMvbGliL2luZGV4LmpzIiwiLi4vbm9kZV9tb2R1bGVzL3FzL2xpYi9wYXJzZS5qcyIsIi4uL25vZGVfbW9kdWxlcy9xcy9saWIvc3RyaW5naWZ5LmpzIiwiLi4vbm9kZV9tb2R1bGVzL3FzL2xpYi91dGlscy5qcyIsIi4uLy4uLy4uLy4uLy4uL3Vzci9sb2NhbC9saWIvbm9kZV9tb2R1bGVzL3dhdGNoaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9idWZmZXIvaW5kZXguanMiLCIuLi8uLi8uLi8uLi8uLi91c3IvbG9jYWwvbGliL25vZGVfbW9kdWxlcy93YXRjaGlmeS9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnVmZmVyL25vZGVfbW9kdWxlcy9iYXNlNjQtanMvbGliL2I2NC5qcyIsIi4uLy4uLy4uLy4uLy4uL3Vzci9sb2NhbC9saWIvbm9kZV9tb2R1bGVzL3dhdGNoaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9idWZmZXIvbm9kZV9tb2R1bGVzL2llZWU3NTQvaW5kZXguanMiLCIuLi8uLi8uLi8uLi8uLi91c3IvbG9jYWwvbGliL25vZGVfbW9kdWxlcy93YXRjaGlmeS9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnVmZmVyL25vZGVfbW9kdWxlcy9pc2FycmF5L2luZGV4LmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUEsQ0FBQyxZQUFXO0FBQ1YsZUFEVTs7QUFHVixRQUFNLFNBQVMsUUFBUSxRQUFSLEVBQWtCLE1BQWxCLENBSEw7QUFJVixRQUFNLEtBQUssUUFBUSxJQUFSLENBQUwsQ0FKSTtBQUtWLFFBQU0sb0JBQW9CLFFBQVEscUJBQVIsQ0FBcEIsQ0FMSTs7QUFPVixRQUFNLHFCQUFxQixRQUFRLHdCQUFSLENBQXJCLENBUEk7QUFRVixRQUFNLGFBQWEsUUFBUSxrQkFBUixDQUFiLENBUkk7QUFTVixRQUFNLFNBQVMsUUFBUSxjQUFSLENBQVQsQ0FUSTtBQVVWLFFBQU0sc0JBQXNCLFFBQVEsaUNBQVIsQ0FBdEIsQ0FWSTtBQVdWLFFBQU0sZ0JBQWdCLFFBQVEsMkJBQVIsQ0FBaEIsQ0FYSTtBQVlWLFFBQU0sZUFBZSxRQUFRLDBCQUFSLENBQWYsQ0FaSTtBQWFWLFFBQU0sYUFBYSxRQUFRLHdCQUFSLENBQWIsQ0FiSTtBQWNWLFFBQU0sbUJBQW1CLFFBQVEsOEJBQVIsQ0FBbkIsQ0FkSTs7QUFnQlYsTUFBSSxDQUFDLFVBQVUsWUFBVixFQUF3QjtBQUMzQixjQUFVLFlBQVYsR0FBeUIsVUFBVSxZQUFWLElBQTBCLFVBQVUsa0JBQVYsSUFDakQsVUFBVSxlQUFWLElBQTZCLFVBQVUsY0FBVixDQUZKO0dBQTdCOztBQUtBLFFBQU0sR0FBTixDQUFVO0FBQ1IsZ0JBQVksVUFBVSxFQUFWLEVBQWM7QUFDeEIsaUJBQVcsSUFBWCxFQUR3Qjs7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Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQ2xVQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNUQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcEtBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNuSUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQ2xLQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDaDdDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIihmdW5jdGlvbigpIHtcbiAgJ3VzZSBzdHJpY3QnO1xuXG4gIGNvbnN0IEJ1ZmZlciA9IHJlcXVpcmUoJ2J1ZmZlcicpLkJ1ZmZlcjtcbiAgY29uc3QgcXMgPSByZXF1aXJlKCdxcycpO1xuICBjb25zdCBodHRwTWVzc2FnZVBhcnNlciA9IHJlcXVpcmUoJ2h0dHAtbWVzc2FnZS1wYXJzZXInKTtcblxuICBjb25zdCBBTUFaT05fRVJST1JfQ09ERVMgPSByZXF1aXJlKCcuL2xpYi9BbWF6b25FcnJvckNvZGVzJyk7XG4gIGNvbnN0IE9ic2VydmFibGUgPSByZXF1aXJlKCcuL2xpYi9PYnNlcnZhYmxlJyk7XG4gIGNvbnN0IFBsYXllciA9IHJlcXVpcmUoJy4vbGliL3BsYXllcicpO1xuICBjb25zdCBhcnJheUJ1ZmZlclRvU3RyaW5nID0gcmVxdWlyZSgnLi9saWIvdXRpbHMvYXJyYXlCdWZmZXJUb1N0cmluZycpO1xuICBjb25zdCB3cml0ZVVURkJ5dGVzID0gcmVxdWlyZSgnLi9saWIvdXRpbHMvd3JpdGVVVEZCeXRlcycpO1xuICBjb25zdCBtZXJnZUJ1ZmZlcnMgPSByZXF1aXJlKCcuL2xpYi91dGlscy9tZXJnZUJ1ZmZlcnMnKTtcbiAgY29uc3QgaW50ZXJsZWF2ZSA9IHJlcXVpcmUoJy4vbGliL3V0aWxzL2ludGVybGVhdmUnKTtcbiAgY29uc3QgZG93bnNhbXBsZUJ1ZmZlciA9IHJlcXVpcmUoJy4vbGliL3V0aWxzL2Rvd25zYW1wbGVCdWZmZXInKTtcblxuICBpZiAoIW5hdmlnYXRvci5nZXRVc2VyTWVkaWEpIHtcbiAgICBuYXZpZ2F0b3IuZ2V0VXNlck1lZGlhID0gbmF2aWdhdG9yLmdldFVzZXJNZWRpYSB8fCBuYXZpZ2F0b3Iud2Via2l0R2V0VXNlck1lZGlhIHx8XG4gICAgICBuYXZpZ2F0b3IubW96R2V0VXNlck1lZGlhIHx8IG5hdmlnYXRvci5tc0dldFVzZXJNZWRpYTtcbiAgfVxuXG4gIGNsYXNzIEFWUyB7XG4gICAgY29uc3RydWN0b3Iob3B0aW9ucyA9IHt9KSB7XG4gICAgICBPYnNlcnZhYmxlKHRoaXMpO1xuXG4gICAgICB0aGlzLl9idWZmZXJTaXplID0gMjA0ODtcbiAgICAgIHRoaXMuX2lucHV0Q2hhbm5lbHMgPSAxO1xuICAgICAgdGhpcy5fb3V0cHV0Q2hhbm5lbHMgPSAxO1xuICAgICAgdGhpcy5fbGVmdENoYW5uZWwgPSBbXTtcbiAgICAgIHRoaXMuX3JpZ2h0Q2hhbm5lbCA9IFtdO1xuICAgICAgdGhpcy5fYXVkaW9Db250ZXh0ID0gbnVsbDtcbiAgICAgIHRoaXMuX3JlY29yZGVyID0gbnVsbDtcbiAgICAgIHRoaXMuX3NhbXBsZVJhdGUgPSBudWxsO1xuICAgICAgdGhpcy5fb3V0cHV0U2FtcGxlUmF0ZSA9IDE2MDAwO1xuICAgICAgdGhpcy5fYXVkaW9JbnB1dCA9IG51bGw7XG4gICAgICB0aGlzLl92b2x1bWVOb2RlID0gbnVsbDtcbiAgICAgIHRoaXMuX2RlYnVnID0gZmFsc2U7XG4gICAgICB0aGlzLl90b2tlbiA9IG51bGw7XG4gICAgICB0aGlzLl9yZWZyZXNoVG9rZW4gPSBudWxsO1xuICAgICAgdGhpcy5fY2xpZW50SWQgPSBudWxsO1xuICAgICAgdGhpcy5fY2xpZW50U2VjcmV0ID0gbnVsbDtcbiAgICAgIHRoaXMuX2RldmljZUlkPSBudWxsO1xuICAgICAgdGhpcy5fZGV2aWNlU2VyaWFsTnVtYmVyID0gbnVsbDtcbiAgICAgIHRoaXMuX3JlZGlyZWN0VXJpID0gbnVsbDtcbiAgICAgIHRoaXMuX2F1ZGlvUXVldWUgPSBbXTtcblxuICAgICAgaWYgKG9wdGlvbnMudG9rZW4pIHtcbiAgICAgICAgdGhpcy5zZXRUb2tlbihvcHRpb25zLnRva2VuKTtcbiAgICAgIH1cblxuICAgICAgaWYgKG9wdGlvbnMucmVmcmVzaFRva2VuKSB7XG4gICAgICAgIHRoaXMuc2V0UmVmcmVzaFRva2VuKG9wdGlvbnMucmVmcmVzaFRva2VuKTtcbiAgICAgIH1cblxuICAgICAgaWYgKG9wdGlvbnMuY2xpZW50SWQpIHtcbiAgICAgICAgdGhpcy5zZXRDbGllbnRJZChvcHRpb25zLmNsaWVudElkKTtcbiAgICAgIH1cblxuICAgICAgaWYgKG9wdGlvbnMuY2xpZW50U2VjcmV0KSB7XG4gICAgICAgIHRoaXMuc2V0Q2xpZW50U2VjcmV0KG9wdGlvbnMuY2xpZW50U2VjcmV0KTtcbiAgICAgIH1cblxuICAgICAgaWYgKG9wdGlvbnMuZGV2aWNlSWQpIHtcbiAgICAgICAgdGhpcy5zZXREZXZpY2VJZChvcHRpb25zLmRldmljZUlkKTtcbiAgICAgIH1cblxuICAgICAgaWYgKG9wdGlvbnMuZGV2aWNlU2VyaWFsTnVtYmVyKSB7XG4gICAgICAgIHRoaXMuc2V0RGV2aWNlU2VyaWFsTnVtYmVyKG9wdGlvbnMuZGV2aWNlU2VyaWFsTnVtYmVyKTtcbiAgICAgIH1cblxuICAgICAgaWYgKG9wdGlvbnMucmVkaXJlY3RVcmkpIHtcbiAgICAgICAgdGhpcy5zZXRSZWRpcmVjdFVyaShvcHRpb25zLnJlZGlyZWN0VXJpKTtcbiAgICAgIH1cblxuICAgICAgaWYgKG9wdGlvbnMuZGVidWcpIHtcbiAgICAgICAgdGhpcy5zZXREZWJ1ZyhvcHRpb25zLmRlYnVnKTtcbiAgICAgIH1cblxuICAgICAgdGhpcy5wbGF5ZXIgPSBuZXcgUGxheWVyKCk7XG4gICAgfVxuXG4gICAgX2xvZyh0eXBlLCBtZXNzYWdlKSB7XG4gICAgICBpZiAodHlwZSAmJiAhbWVzc2FnZSkge1xuICAgICAgICBtZXNzYWdlID0gdHlwZTtcbiAgICAgICAgdHlwZSA9ICdsb2cnO1xuICAgICAgfVxuXG4gICAgICBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgdGhpcy5lbWl0KEFWUy5FdmVudFR5cGVzLkxPRywgbWVzc2FnZSk7XG4gICAgICB9LCAwKTtcblxuICAgICAgaWYgKHRoaXMuX2RlYnVnKSB7XG4gICAgICAgIGNvbnNvbGVbdHlwZV0obWVzc2FnZSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgbG9naW4ob3B0aW9ucyA9IHt9KSB7XG4gICAgICByZXR1cm4gdGhpcy5wcm9tcHRVc2VyTG9naW4ob3B0aW9ucyk7XG4gICAgfVxuXG4gICAgbG9nb3V0KCkge1xuICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgdGhpcy5fdG9rZW4gPSBudWxsO1xuICAgICAgICB0aGlzLl9yZWZyZXNoVG9rZW4gPSBudWxsO1xuICAgICAgICB0aGlzLmVtaXQoQVZTLkV2ZW50VHlwZXMuTE9HT1VUKTtcbiAgICAgICAgdGhpcy5fbG9nKCdMb2dnZWQgb3V0Jyk7XG4gICAgICAgIHJlc29sdmUoKTtcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIHByb21wdFVzZXJMb2dpbihvcHRpb25zID0ge3Jlc3BvbnNlVHlwZTogJ3Rva2VuJywgbmV3V2luZG93OiBmYWxzZX0pIHtcbiAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgIGlmICh0eXBlb2Ygb3B0aW9ucy5yZXNwb25zZVR5cGUgPT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgb3B0aW9ucy5yZXNwb25zZVR5cGUgPSAndG9rZW4nO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHR5cGVvZiBvcHRpb25zLnJlc3BvbnNlVHlwZSAhPT0gJ3N0cmluZycpIHtcbiAgICAgICAgICBjb25zdCBlcnJvciA9IG5ldyBFcnJvcignYHJlc3BvbnNlVHlwZWAgbXVzdCBhIHN0cmluZy4nKTtcbiAgICAgICAgICB0aGlzLl9sb2coZXJyb3IpO1xuICAgICAgICAgIHJldHVybiByZWplY3QoZXJyb3IpO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgbmV3V2luZG93ID0gISFvcHRpb25zLm5ld1dpbmRvdztcblxuICAgICAgICBjb25zdCByZXNwb25zZVR5cGUgPSBvcHRpb25zLnJlc3BvbnNlVHlwZTtcblxuICAgICAgICBpZiAoIShyZXNwb25zZVR5cGUgPT09ICdjb2RlJyB8fCByZXNwb25zZVR5cGUgPT09ICd0b2tlbicpKSB7XG4gICAgICAgICAgY29uc3QgZXJyb3IgPSBuZXcgRXJyb3IoJ2ByZXNwb25zZVR5cGVgIG11c3QgYmUgZWl0aGVyIGBjb2RlYCBvciBgdG9rZW5gLicpO1xuICAgICAgICAgIHRoaXMuX2xvZyhlcnJvcik7XG4gICAgICAgICAgcmV0dXJuIHJlamVjdChlcnJvcik7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBzY29wZSA9ICdhbGV4YTphbGwnO1xuICAgICAgICBjb25zdCBzY29wZURhdGEgPSB7XG4gICAgICAgICAgW3Njb3BlXToge1xuICAgICAgICAgICAgcHJvZHVjdElEOiB0aGlzLl9kZXZpY2VJZCxcbiAgICAgICAgICAgIHByb2R1Y3RJbnN0YW5jZUF0dHJpYnV0ZXM6IHtcbiAgICAgICAgICAgICAgZGV2aWNlU2VyaWFsTnVtYmVyOiB0aGlzLl9kZXZpY2VTZXJpYWxOdW1iZXJcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH07XG5cbiAgICAgICAgY29uc3QgYXV0aFVybCA9IGBodHRwczovL3d3dy5hbWF6b24uY29tL2FwL29hP2NsaWVudF9pZD0ke3RoaXMuX2NsaWVudElkfSZzY29wZT0ke2VuY29kZVVSSUNvbXBvbmVudChzY29wZSl9JnNjb3BlX2RhdGE9JHtlbmNvZGVVUklDb21wb25lbnQoSlNPTi5zdHJpbmdpZnkoc2NvcGVEYXRhKSl9JnJlc3BvbnNlX3R5cGU9JHtyZXNwb25zZVR5cGV9JnJlZGlyZWN0X3VyaT0ke2VuY29kZVVSSSh0aGlzLl9yZWRpcmVjdFVyaSl9YFxuXG4gICAgICAgIGlmIChuZXdXaW5kb3cpIHtcbiAgICAgICAgICB3aW5kb3cub3BlbihhdXRoVXJsKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB3aW5kb3cubG9jYXRpb24uaHJlZiA9IGF1dGhVcmw7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH1cblxuICAgIGdldFRva2VuRnJvbUNvZGUoY29kZSkge1xuICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgaWYgKHR5cGVvZiBjb2RlICE9PSAnc3RyaW5nJykge1xuICAgICAgICAgIGNvbnN0IGVycm9yID0gbmV3IFR5cGVFcnJvcignYGNvZGVgIG11c3QgYmUgYSBzdHJpbmcuJyk7XG4gICAgICAgICAgdGhpcy5fbG9nKGVycm9yKTtcbiAgICAgICAgICByZXR1cm4gcmVqZWN0KGVycm9yKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGdyYW50VHlwZSA9ICdhdXRob3JpemF0aW9uX2NvZGUnO1xuICAgICAgICBjb25zdCBwb3N0RGF0YSA9IGBncmFudF90eXBlPSR7Z3JhbnRUeXBlfSZjb2RlPSR7Y29kZX0mY2xpZW50X2lkPSR7dGhpcy5fY2xpZW50SWR9JmNsaWVudF9zZWNyZXQ9JHt0aGlzLl9jbGllbnRTZWNyZXR9JnJlZGlyZWN0X3VyaT0ke2VuY29kZVVSSUNvbXBvbmVudCh0aGlzLl9yZWRpcmVjdFVyaSl9YDtcbiAgICAgICAgY29uc3QgdXJsID0gJ2h0dHBzOi8vYXBpLmFtYXpvbi5jb20vYXV0aC9vMi90b2tlbic7XG5cbiAgICAgICAgY29uc3QgeGhyID0gbmV3IFhNTEh0dHBSZXF1ZXN0KCk7XG5cbiAgICAgICAgeGhyLm9wZW4oJ1BPU1QnLCB1cmwsIHRydWUpO1xuICAgICAgICB4aHIuc2V0UmVxdWVzdEhlYWRlcignQ29udGVudC1UeXBlJywgJ2FwcGxpY2F0aW9uL3gtd3d3LWZvcm0tdXJsZW5jb2RlZDtjaGFyc2V0PVVURi04Jyk7XG4gICAgICAgIHhoci5vbmxvYWQgPSAoZXZlbnQpID0+IHtcbiAgICAgICAgICBjb25zb2xlLmxvZygnUkVTUE9OU0UnLCB4aHIucmVzcG9uc2UpO1xuXG4gICAgICAgICAgbGV0IHJlc3BvbnNlID0geGhyLnJlc3BvbnNlO1xuXG4gICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIHJlc3BvbnNlID0gSlNPTi5wYXJzZSh4aHIucmVzcG9uc2UpO1xuICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICB0aGlzLl9sb2coZXJyb3IpO1xuICAgICAgICAgICAgcmV0dXJuIHJlamVjdChlcnJvcik7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgY29uc3QgaXNPYmplY3QgPSByZXNwb25zZSBpbnN0YW5jZW9mIE9iamVjdDtcbiAgICAgICAgICBjb25zdCBlcnJvckRlc2NyaXB0aW9uID0gaXNPYmplY3QgJiYgcmVzcG9uc2UuZXJyb3JfZGVzY3JpcHRpb247XG5cbiAgICAgICAgICBpZiAoZXJyb3JEZXNjcmlwdGlvbikge1xuICAgICAgICAgICAgY29uc3QgZXJyb3IgPSBuZXcgRXJyb3IoZXJyb3JEZXNjcmlwdGlvbik7XG4gICAgICAgICAgICB0aGlzLl9sb2coZXJyb3IpO1xuICAgICAgICAgICAgcmV0dXJuIHJlamVjdChlcnJvcik7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgY29uc3QgdG9rZW4gPSByZXNwb25zZS5hY2Nlc3NfdG9rZW47XG4gICAgICAgICAgY29uc3QgcmVmcmVzaFRva2VuID0gcmVzcG9uc2UucmVmcmVzaF90b2tlbjtcbiAgICAgICAgICBjb25zdCB0b2tlblR5cGUgPSByZXNwb25zZS50b2tlbl90eXBlO1xuICAgICAgICAgIGNvbnN0IGV4cGlyZXNJbiA9IHJlc3BvbnNlLmV4cGlyZXNJbjtcblxuICAgICAgICAgIHRoaXMuc2V0VG9rZW4odG9rZW4pXG4gICAgICAgICAgdGhpcy5zZXRSZWZyZXNoVG9rZW4ocmVmcmVzaFRva2VuKVxuXG4gICAgICAgICAgdGhpcy5lbWl0KEFWUy5FdmVudFR5cGVzLkxPR0lOKTtcbiAgICAgICAgICB0aGlzLl9sb2coJ0xvZ2dlZCBpbi4nKTtcbiAgICAgICAgICByZXNvbHZlKHJlc3BvbnNlKTtcbiAgICAgICAgfTtcblxuICAgICAgICB4aHIub25lcnJvciA9IChlcnJvcikgPT4ge1xuICAgICAgICAgIHRoaXMuX2xvZyhlcnJvcik7XG4gICAgICAgICAgcmVqZWN0KGVycm9yKTtcbiAgICAgICAgfTtcblxuICAgICAgICB4aHIuc2VuZChwb3N0RGF0YSk7XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICByZWZyZXNoVG9rZW4oKSB7XG4gICAgICByZXR1cm4gdGhpcy5nZXRUb2tlbkZyb21SZWZyZXNoVG9rZW4odGhpcy5fcmVmcmVzaFRva2VuKVxuICAgICAgICAgICAgICAudGhlbigoKSA9PiB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgIHRva2VuOiB0aGlzLl90b2tlbixcbiAgICAgICAgICAgICAgICAgIHJlZnJlc2hUb2tlbjogdGhpcy5fcmVmcmVzaFRva2VuXG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgZ2V0VG9rZW5Gcm9tUmVmcmVzaFRva2VuKHJlZnJlc2hUb2tlbiA9IHRoaXMuX3JlZnJlc2hUb2tlbikge1xuICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgaWYgKHR5cGVvZiByZWZyZXNoVG9rZW4gIT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgY29uc3QgZXJyb3IgPSBuZXcgRXJyb3IoJ2ByZWZyZXNoVG9rZW5gIG11c3QgYSBzdHJpbmcuJyk7XG4gICAgICAgICAgdGhpcy5fbG9nKGVycm9yKTtcbiAgICAgICAgICByZXR1cm4gcmVqZWN0KGVycm9yKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGdyYW50VHlwZSA9ICdyZWZyZXNoX3Rva2VuJztcbiAgICAgICAgY29uc3QgcG9zdERhdGEgPSBgZ3JhbnRfdHlwZT0ke2dyYW50VHlwZX0mcmVmcmVzaF90b2tlbj0ke3JlZnJlc2hUb2tlbn0mY2xpZW50X2lkPSR7dGhpcy5fY2xpZW50SWR9JmNsaWVudF9zZWNyZXQ9JHt0aGlzLl9jbGllbnRTZWNyZXR9JnJlZGlyZWN0X3VyaT0ke2VuY29kZVVSSUNvbXBvbmVudCh0aGlzLl9yZWRpcmVjdFVyaSl9YDtcbiAgICAgICAgY29uc3QgdXJsID0gJ2h0dHBzOi8vYXBpLmFtYXpvbi5jb20vYXV0aC9vMi90b2tlbic7XG4gICAgICAgIGNvbnN0IHhociA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xuXG4gICAgICAgIHhoci5vcGVuKCdQT1NUJywgdXJsLCB0cnVlKTtcbiAgICAgICAgeGhyLnNldFJlcXVlc3RIZWFkZXIoJ0NvbnRlbnQtVHlwZScsICdhcHBsaWNhdGlvbi94LXd3dy1mb3JtLXVybGVuY29kZWQ7Y2hhcnNldD1VVEYtOCcpO1xuICAgICAgICB4aHIucmVzcG9uc2VUeXBlID0gJ2pzb24nO1xuICAgICAgICB4aHIub25sb2FkID0gKGV2ZW50KSA9PiB7XG4gICAgICAgICAgY29uc3QgcmVzcG9uc2UgPSB4aHIucmVzcG9uc2U7XG5cbiAgICAgICAgICBpZiAocmVzcG9uc2UuZXJyb3IpIHtcbiAgICAgICAgICAgIGNvbnN0IGVycm9yID0gcmVzcG9uc2UuZXJyb3IubWVzc2FnZTtcbiAgICAgICAgICAgIHRoaXMuZW1pdChBVlMuRXZlbnRUeXBlcy5FUlJPUiwgZXJyb3IpO1xuXG4gICAgICAgICAgICByZXR1cm4gcmVqZWN0KGVycm9yKTtcbiAgICAgICAgICB9IGVsc2UgIHtcbiAgICAgICAgICAgIGNvbnN0IHRva2VuID0gcmVzcG9uc2UuYWNjZXNzX3Rva2VuO1xuICAgICAgICAgICAgY29uc3QgcmVmcmVzaFRva2VuID0gcmVzcG9uc2UucmVmcmVzaF90b2tlbjtcblxuICAgICAgICAgICAgdGhpcy5zZXRUb2tlbih0b2tlbik7XG4gICAgICAgICAgICB0aGlzLnNldFJlZnJlc2hUb2tlbihyZWZyZXNoVG9rZW4pO1xuXG4gICAgICAgICAgICByZXR1cm4gcmVzb2x2ZSh0b2tlbik7XG4gICAgICAgICAgfVxuICAgICAgICB9O1xuXG4gICAgICAgIHhoci5vbmVycm9yID0gKGVycm9yKSA9PiB7XG4gICAgICAgICAgdGhpcy5fbG9nKGVycm9yKTtcbiAgICAgICAgICByZWplY3QoZXJyb3IpO1xuICAgICAgICB9O1xuXG4gICAgICAgIHhoci5zZW5kKHBvc3REYXRhKTtcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIGdldFRva2VuRnJvbVVybCgpIHtcbiAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgIGxldCBxdWVyeVN0cmluZyA9IHdpbmRvdy5sb2NhdGlvbi5ocmVmLnNwbGl0KCc/IycpO1xuXG4gICAgICAgIGlmIChxdWVyeVN0cmluZy5sZW5ndGggPT09IDIpIHtcbiAgICAgICAgICBxdWVyeVN0cmluZyA9IHF1ZXJ5U3RyaW5nWzFdO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHF1ZXJ5U3RyaW5nID0gd2luZG93LmxvY2F0aW9uLnNlYXJjaC5zdWJzdHIoMSk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBxdWVyeSA9IHFzLnBhcnNlKHF1ZXJ5U3RyaW5nKTtcbiAgICAgICAgY29uc3QgdG9rZW4gPSBxdWVyeS5hY2Nlc3NfdG9rZW47XG4gICAgICAgIGNvbnN0IHJlZnJlc2hUb2tlbiA9IHF1ZXJ5LnJlZnJlc2hfdG9rZW47XG4gICAgICAgIGNvbnN0IHRva2VuVHlwZSA9IHF1ZXJ5LnRva2VuX3R5cGU7XG4gICAgICAgIGNvbnN0IGV4cGlyZXNJbiA9IHF1ZXJ5LmV4cGlyZXNJbjtcblxuICAgICAgICBpZiAodG9rZW4pIHtcbiAgICAgICAgICB0aGlzLnNldFRva2VuKHRva2VuKVxuICAgICAgICAgIHRoaXMuZW1pdChBVlMuRXZlbnRUeXBlcy5MT0dJTik7XG4gICAgICAgICAgdGhpcy5fbG9nKCdMb2dnZWQgaW4uJyk7XG5cbiAgICAgICAgICBpZiAocmVmcmVzaFRva2VuKSB7XG4gICAgICAgICAgICB0aGlzLnNldFJlZnJlc2hUb2tlbihyZWZyZXNoVG9rZW4pO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIHJldHVybiByZXNvbHZlKHRva2VuKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiByZWplY3QobnVsbCk7XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBnZXRDb2RlRnJvbVVybCgpIHtcbiAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgIGNvbnN0IHF1ZXJ5ID0gcXMucGFyc2Uod2luZG93LmxvY2F0aW9uLnNlYXJjaC5zdWJzdHIoMSkpO1xuICAgICAgICBjb25zdCBjb2RlID0gcXVlcnkuY29kZTtcblxuICAgICAgICBpZiAoY29kZSkge1xuICAgICAgICAgIHJldHVybiByZXNvbHZlKGNvZGUpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHJlamVjdChudWxsKTtcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIHNldFRva2VuKHRva2VuKSB7XG4gICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICBpZiAodHlwZW9mIHRva2VuID09PSAnc3RyaW5nJykge1xuICAgICAgICAgIHRoaXMuX3Rva2VuID0gdG9rZW47XG4gICAgICAgICAgdGhpcy5lbWl0KEFWUy5FdmVudFR5cGVzLlRPS0VOX1NFVCk7XG4gICAgICAgICAgdGhpcy5fbG9nKCdUb2tlbiBzZXQuJyk7XG4gICAgICAgICAgcmVzb2x2ZSh0aGlzLl90b2tlbik7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgY29uc3QgZXJyb3IgPSBuZXcgVHlwZUVycm9yKCdgdG9rZW5gIG11c3QgYmUgYSBzdHJpbmcuJyk7XG4gICAgICAgICAgdGhpcy5fbG9nKGVycm9yKTtcbiAgICAgICAgICByZWplY3QoZXJyb3IpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBzZXRSZWZyZXNoVG9rZW4ocmVmcmVzaFRva2VuKSB7XG4gICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICBpZiAodHlwZW9mIHJlZnJlc2hUb2tlbiA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICB0aGlzLl9yZWZyZXNoVG9rZW4gPSByZWZyZXNoVG9rZW47XG4gICAgICAgICAgdGhpcy5lbWl0KEFWUy5FdmVudFR5cGVzLlJFRlJFU0hfVE9LRU5fU0VUKTtcbiAgICAgICAgICB0aGlzLl9sb2coJ1JlZnJlc2ggdG9rZW4gc2V0LicpO1xuICAgICAgICAgIHJlc29sdmUodGhpcy5fcmVmcmVzaFRva2VuKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBjb25zdCBlcnJvciA9IG5ldyBUeXBlRXJyb3IoJ2ByZWZyZXNoVG9rZW5gIG11c3QgYmUgYSBzdHJpbmcuJyk7XG4gICAgICAgICAgdGhpcy5fbG9nKGVycm9yKTtcbiAgICAgICAgICByZWplY3QoZXJyb3IpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBzZXRDbGllbnRJZChjbGllbnRJZCkge1xuICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgaWYgKHR5cGVvZiBjbGllbnRJZCA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICB0aGlzLl9jbGllbnRJZCA9IGNsaWVudElkO1xuICAgICAgICAgIHJlc29sdmUodGhpcy5fY2xpZW50SWQpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGNvbnN0IGVycm9yID0gbmV3IFR5cGVFcnJvcignYGNsaWVudElkYCBtdXN0IGJlIGEgc3RyaW5nLicpO1xuICAgICAgICAgIHRoaXMuX2xvZyhlcnJvcik7XG4gICAgICAgICAgcmVqZWN0KGVycm9yKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgc2V0Q2xpZW50U2VjcmV0KGNsaWVudFNlY3JldCkge1xuICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgaWYgKHR5cGVvZiBjbGllbnRTZWNyZXQgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgdGhpcy5fY2xpZW50U2VjcmV0ID0gY2xpZW50U2VjcmV0O1xuICAgICAgICAgIHJlc29sdmUodGhpcy5fY2xpZW50U2VjcmV0KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBjb25zdCBlcnJvciA9IG5ldyBUeXBlRXJyb3IoJ2BjbGllbnRTZWNyZXRgIG11c3QgYmUgYSBzdHJpbmcnKTtcbiAgICAgICAgICB0aGlzLl9sb2coZXJyb3IpO1xuICAgICAgICAgIHJlamVjdChlcnJvcik7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH1cblxuICAgIHNldERldmljZUlkKGRldmljZUlkKSB7XG4gICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICBpZiAodHlwZW9mIGRldmljZUlkID09PSAnc3RyaW5nJykge1xuICAgICAgICAgIHRoaXMuX2RldmljZUlkID0gZGV2aWNlSWQ7XG4gICAgICAgICAgcmVzb2x2ZSh0aGlzLl9kZXZpY2VJZCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgY29uc3QgZXJyb3IgPSBuZXcgVHlwZUVycm9yKCdgZGV2aWNlSWRgIG11c3QgYmUgYSBzdHJpbmcuJyk7XG4gICAgICAgICAgdGhpcy5fbG9nKGVycm9yKTtcbiAgICAgICAgICByZWplY3QoZXJyb3IpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBzZXREZXZpY2VTZXJpYWxOdW1iZXIoZGV2aWNlU2VyaWFsTnVtYmVyKSB7XG4gICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICBpZiAodHlwZW9mIGRldmljZVNlcmlhbE51bWJlciA9PT0gJ251bWJlcicgfHwgdHlwZW9mIGRldmljZVNlcmlhbE51bWJlciA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICB0aGlzLl9kZXZpY2VTZXJpYWxOdW1iZXIgPSBkZXZpY2VTZXJpYWxOdW1iZXI7XG4gICAgICAgICAgcmVzb2x2ZSh0aGlzLl9kZXZpY2VTZXJpYWxOdW1iZXIpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGNvbnN0IGVycm9yID0gbmV3IFR5cGVFcnJvcignYGRldmljZVNlcmlhbE51bWJlcmAgbXVzdCBiZSBhIG51bWJlciBvciBzdHJpbmcuJyk7XG4gICAgICAgICAgdGhpcy5fbG9nKGVycm9yKTtcbiAgICAgICAgICByZWplY3QoZXJyb3IpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBzZXRSZWRpcmVjdFVyaShyZWRpcmVjdFVyaSkge1xuICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgaWYgKHR5cGVvZiByZWRpcmVjdFVyaSA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICB0aGlzLl9yZWRpcmVjdFVyaSA9IHJlZGlyZWN0VXJpO1xuICAgICAgICAgIHJlc29sdmUodGhpcy5fcmVkaXJlY3RVcmkpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGNvbnN0IGVycm9yID0gbmV3IFR5cGVFcnJvcignYHJlZGlyZWN0VXJpYCBtdXN0IGJlIGEgc3RyaW5nLicpO1xuICAgICAgICAgIHRoaXMuX2xvZyhlcnJvcik7XG4gICAgICAgICAgcmVqZWN0KGVycm9yKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgc2V0RGVidWcoZGVidWcpIHtcbiAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgIGlmICh0eXBlb2YgZGVidWcgPT09ICdib29sZWFuJykge1xuICAgICAgICAgIHRoaXMuX2RlYnVnID0gZGVidWc7XG4gICAgICAgICAgcmVzb2x2ZSh0aGlzLl9kZWJ1Zyk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgY29uc3QgZXJyb3IgPSBuZXcgVHlwZUVycm9yKCdgZGVidWdgIG11c3QgYmUgYSBib29sZWFuLicpO1xuICAgICAgICAgIHRoaXMuX2xvZyhlcnJvcik7XG4gICAgICAgICAgcmVqZWN0KGVycm9yKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgZ2V0VG9rZW4oKSB7XG4gICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICBjb25zdCB0b2tlbiA9IHRoaXMuX3Rva2VuO1xuXG4gICAgICAgIGlmICh0b2tlbikge1xuICAgICAgICAgIHJldHVybiByZXNvbHZlKHRva2VuKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiByZWplY3QoKTtcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIGdldFJlZnJlc2hUb2tlbigpIHtcbiAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgIGNvbnN0IHJlZnJlc2hUb2tlbiA9IHRoaXMuX3JlZnJlc2hUb2tlbjtcblxuICAgICAgICBpZiAocmVmcmVzaFRva2VuKSB7XG4gICAgICAgICAgcmV0dXJuIHJlc29sdmUocmVmcmVzaFRva2VuKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiByZWplY3QoKTtcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIHJlcXVlc3RNaWMoKSB7XG4gICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICB0aGlzLl9sb2coJ1JlcXVlc3RpbmcgbWljcm9waG9uZS4nKTtcbiAgICAgICAgbmF2aWdhdG9yLmdldFVzZXJNZWRpYSh7XG4gICAgICAgICAgICBhdWRpbzogdHJ1ZVxuICAgICAgICB9LCAoc3RyZWFtKSA9PiB7XG4gICAgICAgICAgICB0aGlzLl9sb2coJ01pY3JvcGhvbmUgY29ubmVjdGVkLicpO1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuY29ubmVjdE1lZGlhU3RyZWFtKHN0cmVhbSkudGhlbigoKSA9PiB7XG4gICAgICAgICAgICAgIHJldHVybiByZXNvbHZlKHN0cmVhbSk7XG4gICAgICAgIH0pfSwgKGVycm9yKSA9PiB7XG4gICAgICAgICAgdGhpcy5fbG9nKCdlcnJvcicsIGVycm9yKTtcbiAgICAgICAgICB0aGlzLmVtaXQoQVZTLkV2ZW50VHlwZXMuRVJST1IsIGVycm9yKTtcbiAgICAgICAgICByZXR1cm4gcmVqZWN0KGVycm9yKTtcbiAgICAgICAgfSk7XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBjb25uZWN0TWVkaWFTdHJlYW0oc3RyZWFtKSB7XG4gICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICBjb25zdCBpc01lZGlhU3RyZWFtID0gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKHN0cmVhbSkgPT09ICdbb2JqZWN0IE1lZGlhU3RyZWFtXSc7XG5cbiAgICAgICAgaWYgKCFpc01lZGlhU3RyZWFtKSB7XG4gICAgICAgICAgY29uc3QgZXJyb3IgPSBuZXcgVHlwZUVycm9yKCdBcmd1bWVudCBtdXN0IGJlIGEgYE1lZGlhU3RyZWFtYCBvYmplY3QuJylcbiAgICAgICAgICB0aGlzLl9sb2coJ2Vycm9yJywgZXJyb3IpXG4gICAgICAgICAgdGhpcy5lbWl0KEFWUy5FdmVudFR5cGVzLkVSUk9SLCBlcnJvcik7XG4gICAgICAgICAgcmV0dXJuIHJlamVjdChlcnJvcik7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9hdWRpb0NvbnRleHQgPSBuZXcgQXVkaW9Db250ZXh0KCk7XG4gICAgICAgIHRoaXMuX3NhbXBsZVJhdGUgPSB0aGlzLl9hdWRpb0NvbnRleHQuc2FtcGxlUmF0ZTtcblxuICAgICAgICB0aGlzLl9sb2coYFNhbXBsZSByYXRlOiAke3RoaXMuX3NhbXBsZVJhdGV9LmApO1xuXG4gICAgICAgIHRoaXMuX3ZvbHVtZU5vZGUgPSB0aGlzLl9hdWRpb0NvbnRleHQuY3JlYXRlR2FpbigpO1xuICAgICAgICB0aGlzLl9hdWRpb0lucHV0ID0gdGhpcy5fYXVkaW9Db250ZXh0LmNyZWF0ZU1lZGlhU3RyZWFtU291cmNlKHN0cmVhbSk7XG5cbiAgICAgICAgdGhpcy5fYXVkaW9JbnB1dC5jb25uZWN0KHRoaXMuX3ZvbHVtZU5vZGUpO1xuXG4gICAgICAgIHRoaXMuX3JlY29yZGVyID0gdGhpcy5fYXVkaW9Db250ZXh0LmNyZWF0ZVNjcmlwdFByb2Nlc3Nvcih0aGlzLl9idWZmZXJTaXplLCB0aGlzLl9pbnB1dENoYW5uZWxzLCB0aGlzLl9vdXRwdXRDaGFubmVscyk7XG5cbiAgICAgICAgdGhpcy5fcmVjb3JkZXIub25hdWRpb3Byb2Nlc3MgPSAoZXZlbnQpID0+IHtcbiAgICAgICAgICAgIGlmICghdGhpcy5faXNSZWNvcmRpbmcpIHtcbiAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBsZWZ0ID0gZXZlbnQuaW5wdXRCdWZmZXIuZ2V0Q2hhbm5lbERhdGEoMCk7XG4gICAgICAgICAgICB0aGlzLl9sZWZ0Q2hhbm5lbC5wdXNoKG5ldyBGbG9hdDMyQXJyYXkobGVmdCkpO1xuXG4gICAgICAgICAgICBpZiAodGhpcy5faW5wdXRDaGFubmVscyA+IDEpIHtcbiAgICAgICAgICAgICAgY29uc3QgcmlnaHQgPSBldmVudC5pbnB1dEJ1ZmZlci5nZXRDaGFubmVsRGF0YSgxKTtcbiAgICAgICAgICAgICAgdGhpcy5fcmlnaHRDaGFubmVsLnB1c2gobmV3IEZsb2F0MzJBcnJheShyaWdodCkpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzLl9yZWNvcmRpbmdMZW5ndGggKz0gdGhpcy5fYnVmZmVyU2l6ZTtcbiAgICAgICAgfTtcblxuICAgICAgICB0aGlzLl92b2x1bWVOb2RlLmNvbm5lY3QodGhpcy5fcmVjb3JkZXIpO1xuICAgICAgICB0aGlzLl9yZWNvcmRlci5jb25uZWN0KHRoaXMuX2F1ZGlvQ29udGV4dC5kZXN0aW5hdGlvbik7XG4gICAgICAgIHRoaXMuX2xvZyhgTWVkaWEgc3RyZWFtIGNvbm5lY3RlZC5gKTtcblxuICAgICAgICByZXR1cm4gcmVzb2x2ZSgpO1xuICAgICAgfSk7XG4gICAgfVxuXG4gICAgc3RhcnRSZWNvcmRpbmcoKSB7XG4gICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICBpZiAoIXRoaXMuX2F1ZGlvSW5wdXQpIHtcbiAgICAgICAgICBjb25zdCBlcnJvciA9IG5ldyBFcnJvcignTm8gTWVkaWEgU3RyZWFtIGNvbm5lY3RlZC4nKTtcbiAgICAgICAgICB0aGlzLl9sb2coJ2Vycm9yJywgZXJyb3IpO1xuICAgICAgICAgIHRoaXMuZW1pdChBVlMuRXZlbnRUeXBlcy5FUlJPUiwgZXJyb3IpO1xuICAgICAgICAgIHJldHVybiByZWplY3QoZXJyb3IpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5faXNSZWNvcmRpbmcgPSB0cnVlO1xuICAgICAgICB0aGlzLl9sZWZ0Q2hhbm5lbC5sZW5ndGggPSB0aGlzLl9yaWdodENoYW5uZWwubGVuZ3RoID0gMDtcbiAgICAgICAgdGhpcy5fcmVjb3JkaW5nTGVuZ3RoID0gMDtcbiAgICAgICAgdGhpcy5fbG9nKGBSZWNvcmRpbmcgc3RhcnRlZC5gKTtcbiAgICAgICAgdGhpcy5lbWl0KEFWUy5FdmVudFR5cGVzLlJFQ09SRF9TVEFSVCk7XG5cbiAgICAgICAgcmV0dXJuIHJlc29sdmUoKTtcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIHN0b3BSZWNvcmRpbmcoKSB7XG4gICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICBpZiAoIXRoaXMuX2lzUmVjb3JkaW5nKSB7XG4gICAgICAgICAgdGhpcy5lbWl0KEFWUy5FdmVudFR5cGVzLlJFQ09SRF9TVE9QKTtcbiAgICAgICAgICB0aGlzLl9sb2coJ1JlY29yZGluZyBzdG9wcGVkLicpO1xuICAgICAgICAgIHJldHVybiByZXNvbHZlKCk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9pc1JlY29yZGluZyA9IGZhbHNlO1xuXG4gICAgICAgIGNvbnN0IGxlZnRCdWZmZXIgPSBtZXJnZUJ1ZmZlcnModGhpcy5fbGVmdENoYW5uZWwsIHRoaXMuX3JlY29yZGluZ0xlbmd0aCk7XG4gICAgICAgIGxldCBpbnRlcmxlYXZlZCA9IG51bGw7XG5cbiAgICAgICAgaWYgKHRoaXMuX291dHB1dENoYW5uZWxzID4gMSkge1xuICAgICAgICAgIGNvbnN0IHJpZ2h0QnVmZmVyID0gbWVyZ2VCdWZmZXJzKHRoaXMuX3JpZ2h0Q2hhbm5lbCwgdGhpcy5fcmVjb3JkaW5nTGVuZ3RoKTtcbiAgICAgICAgICBpbnRlcmxlYXZlZCA9IGludGVybGVhdmUobGVmdEJ1ZmZlciwgcmlnaHRCdWZmZXIpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGludGVybGVhdmVkID0gaW50ZXJsZWF2ZShsZWZ0QnVmZmVyKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGludGVybGVhdmVkID0gZG93bnNhbXBsZUJ1ZmZlcihpbnRlcmxlYXZlZCwgdGhpcy5fc2FtcGxlUmF0ZSwgdGhpcy5fb3V0cHV0U2FtcGxlUmF0ZSk7XG5cbiAgICAgICAgY29uc3QgYnVmZmVyID0gbmV3IEFycmF5QnVmZmVyKDQ0ICsgaW50ZXJsZWF2ZWQubGVuZ3RoICogMik7XG4gICAgICAgIGNvbnN0IHZpZXcgPSBuZXcgRGF0YVZpZXcoYnVmZmVyKTtcblxuICAgICAgLyoqXG4gICAgICAgKiBAY3JlZGl0IGh0dHBzOi8vZ2l0aHViLmNvbS9tYXR0ZGlhbW9uZC9SZWNvcmRlcmpzXG4gICAgICAgKi9cbiAgICAgICAgd3JpdGVVVEZCeXRlcyh2aWV3LCAwLCAnUklGRicpO1xuICAgICAgICB2aWV3LnNldFVpbnQzMig0LCA0NCArIGludGVybGVhdmVkLmxlbmd0aCAqIDIsIHRydWUpO1xuICAgICAgICB3cml0ZVVURkJ5dGVzKHZpZXcsIDgsICdXQVZFJyk7XG4gICAgICAgIHdyaXRlVVRGQnl0ZXModmlldywgMTIsICdmbXQgJyk7XG4gICAgICAgIHZpZXcuc2V0VWludDMyKDE2LCAxNiwgdHJ1ZSk7XG4gICAgICAgIHZpZXcuc2V0VWludDE2KDIwLCAxLCB0cnVlKTtcbiAgICAgICAgdmlldy5zZXRVaW50MTYoMjIsIHRoaXMuX291dHB1dENoYW5uZWxzLCB0cnVlKTtcbiAgICAgICAgdmlldy5zZXRVaW50MzIoMjQsIHRoaXMuX291dHB1dFNhbXBsZVJhdGUsIHRydWUpO1xuICAgICAgICB2aWV3LnNldFVpbnQzMigyOCwgdGhpcy5fb3V0cHV0U2FtcGxlUmF0ZSAqIDQsIHRydWUpO1xuICAgICAgICB2aWV3LnNldFVpbnQxNigzMiwgNCwgdHJ1ZSk7XG4gICAgICAgIHZpZXcuc2V0VWludDE2KDM0LCAxNiwgdHJ1ZSk7XG4gICAgICAgIHdyaXRlVVRGQnl0ZXModmlldywgMzYsICdkYXRhJyk7XG4gICAgICAgIHZpZXcuc2V0VWludDMyKDQwLCBpbnRlcmxlYXZlZC5sZW5ndGggKiAyLCB0cnVlKTtcblxuICAgICAgICBjb25zdCBsZW5ndGggPSBpbnRlcmxlYXZlZC5sZW5ndGg7XG4gICAgICAgIGNvbnN0IHZvbHVtZSA9IDE7XG4gICAgICAgIGxldCBpbmRleCA9IDQ0O1xuXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspe1xuICAgICAgICAgIHZpZXcuc2V0SW50MTYoaW5kZXgsIGludGVybGVhdmVkW2ldICogKDB4N0ZGRiAqIHZvbHVtZSksIHRydWUpO1xuICAgICAgICAgIGluZGV4ICs9IDI7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9sb2coYFJlY29yZGluZyBzdG9wcGVkLmApO1xuICAgICAgICB0aGlzLmVtaXQoQVZTLkV2ZW50VHlwZXMuUkVDT1JEX1NUT1ApO1xuICAgICAgICByZXR1cm4gcmVzb2x2ZSh2aWV3KTtcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIHNlbmRBdWRpbyAoZGF0YVZpZXcpIHtcbiAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgIGNvbnN0IHhociA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xuICAgICAgICBjb25zdCB1cmwgPSAnaHR0cHM6Ly9hY2Nlc3MtYWxleGEtbmEuYW1hem9uLmNvbS92MS9hdnMvc3BlZWNocmVjb2duaXplci9yZWNvZ25pemUnO1xuXG4gICAgICAgIHhoci5vcGVuKCdQT1NUJywgdXJsLCB0cnVlKTtcbiAgICAgICAgeGhyLnJlc3BvbnNlVHlwZSA9ICdhcnJheWJ1ZmZlcic7XG4gICAgICAgIHhoci5vbmxvYWQgPSAoZXZlbnQpID0+IHtcbiAgICAgICAgICBjb25zb2xlLmxvZygnUkVTUE9OU0UnLCB4aHIucmVzcG9uc2UpO1xuXG4gICAgICAgICAgY29uc3QgYnVmZmVyID0gbmV3IEJ1ZmZlcih4aHIucmVzcG9uc2UpO1xuXG4gICAgICAgICAgaWYgKHhoci5zdGF0dXMgPT09IDIwMCkge1xuICAgICAgICAgICAgY29uc3QgcGFyc2VkTWVzc2FnZSA9IGh0dHBNZXNzYWdlUGFyc2VyKGJ1ZmZlcik7XG4gICAgICAgICAgICByZXNvbHZlKHBhcnNlZE1lc3NhZ2UpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBsZXQgZXJyb3IgPSBuZXcgRXJyb3IoJ0FuIGVycm9yIG9jY3VyZWQgd2l0aCByZXF1ZXN0LicpO1xuICAgICAgICAgICAgbGV0IHJlc3BvbnNlID0ge307XG5cbiAgICAgICAgICAgIGlmICgheGhyLnJlc3BvbnNlLmJ5dGVMZW5ndGgpIHtcbiAgICAgICAgICAgICAgZXJyb3IgPSBuZXcgRXJyb3IoJ0VtcHR5IHJlc3BvbnNlLicpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICByZXNwb25zZSA9IEpTT04ucGFyc2UoYXJyYXlCdWZmZXJUb1N0cmluZyhidWZmZXIpKTtcbiAgICAgICAgICAgICAgfSBjYXRjaChlcnIpIHtcbiAgICAgICAgICAgICAgICBlcnJvciA9IGVycjtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAocmVzcG9uc2UuZXJyb3IgaW5zdGFuY2VvZiBPYmplY3QpIHtcbiAgICAgICAgICAgICAgaWYgKHJlc3BvbnNlLmVycm9yLmNvZGUgPT09IEFNQVpPTl9FUlJPUl9DT0RFUy5JbnZhbGlkQWNjZXNzVG9rZW5FeGNlcHRpb24pIHtcbiAgICAgICAgICAgICAgICB0aGlzLmVtaXQoQVZTLkV2ZW50VHlwZXMuVE9LRU5fSU5WQUxJRCk7XG4gICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICBlcnJvciA9IHJlc3BvbnNlLmVycm9yLm1lc3NhZ2U7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMuZW1pdChBVlMuRXZlbnRUeXBlcy5FUlJPUiwgZXJyb3IpO1xuICAgICAgICAgICAgcmV0dXJuIHJlamVjdChlcnJvcik7XG4gICAgICAgICAgfVxuICAgICAgICB9O1xuXG4gICAgICAgIHhoci5vbmVycm9yID0gKGVycm9yKSA9PiB7XG4gICAgICAgICAgdGhpcy5fbG9nKGVycm9yKTtcbiAgICAgICAgICByZWplY3QoZXJyb3IpO1xuICAgICAgICB9O1xuXG4gICAgICAgIGNvbnN0IEJPVU5EQVJZID0gJ0JPVU5EQVJZMTIzNCc7XG4gICAgICAgIGNvbnN0IEJPVU5EQVJZX0RBU0hFUyA9ICctLSc7XG4gICAgICAgIGNvbnN0IE5FV0xJTkUgPSAnXFxyXFxuJztcbiAgICAgICAgY29uc3QgTUVUQURBVEFfQ09OVEVOVF9ESVNQT1NJVElPTiA9ICdDb250ZW50LURpc3Bvc2l0aW9uOiBmb3JtLWRhdGE7IG5hbWU9XCJtZXRhZGF0YVwiJztcbiAgICAgICAgY29uc3QgTUVUQURBVEFfQ09OVEVOVF9UWVBFID0gJ0NvbnRlbnQtVHlwZTogYXBwbGljYXRpb24vanNvbjsgY2hhcnNldD1VVEYtOCc7XG4gICAgICAgIGNvbnN0IEFVRElPX0NPTlRFTlRfVFlQRSA9ICdDb250ZW50LVR5cGU6IGF1ZGlvL0wxNjsgcmF0ZT0xNjAwMDsgY2hhbm5lbHM9MSc7XG4gICAgICAgIGNvbnN0IEFVRElPX0NPTlRFTlRfRElTUE9TSVRJT04gPSAnQ29udGVudC1EaXNwb3NpdGlvbjogZm9ybS1kYXRhOyBuYW1lPVwiYXVkaW9cIic7XG5cbiAgICAgICAgY29uc3QgbWV0YWRhdGEgPSB7XG4gICAgICAgICAgbWVzc2FnZUhlYWRlcjoge30sXG4gICAgICAgICAgbWVzc2FnZUJvZHk6IHtcbiAgICAgICAgICAgIHByb2ZpbGU6ICdhbGV4YS1jbG9zZS10YWxrJyxcbiAgICAgICAgICAgIGxvY2FsZTogJ2VuLXVzJyxcbiAgICAgICAgICAgIGZvcm1hdDogJ2F1ZGlvL0wxNjsgcmF0ZT0xNjAwMDsgY2hhbm5lbHM9MSdcbiAgICAgICAgICB9XG4gICAgICAgIH07XG5cbiAgICAgICAgY29uc3QgcG9zdERhdGFTdGFydCA9IFtcbiAgICAgICAgICBORVdMSU5FLCBCT1VOREFSWV9EQVNIRVMsIEJPVU5EQVJZLCBORVdMSU5FLCBNRVRBREFUQV9DT05URU5UX0RJU1BPU0lUSU9OLCBORVdMSU5FLCBNRVRBREFUQV9DT05URU5UX1RZUEUsXG4gICAgICAgICAgTkVXTElORSwgTkVXTElORSwgSlNPTi5zdHJpbmdpZnkobWV0YWRhdGEpLCBORVdMSU5FLCBCT1VOREFSWV9EQVNIRVMsIEJPVU5EQVJZLCBORVdMSU5FLFxuICAgICAgICAgIEFVRElPX0NPTlRFTlRfRElTUE9TSVRJT04sIE5FV0xJTkUsIEFVRElPX0NPTlRFTlRfVFlQRSwgTkVXTElORSwgTkVXTElORVxuICAgICAgICBdLmpvaW4oJycpO1xuXG4gICAgICAgIGNvbnN0IHBvc3REYXRhRW5kID0gW05FV0xJTkUsIEJPVU5EQVJZX0RBU0hFUywgQk9VTkRBUlksIEJPVU5EQVJZX0RBU0hFUywgTkVXTElORV0uam9pbignJyk7XG5cbiAgICAgICAgY29uc3Qgc2l6ZSA9IHBvc3REYXRhU3RhcnQubGVuZ3RoICsgZGF0YVZpZXcuYnl0ZUxlbmd0aCArIHBvc3REYXRhRW5kLmxlbmd0aDtcbiAgICAgICAgY29uc3QgdWludDhBcnJheSA9IG5ldyBVaW50OEFycmF5KHNpemUpO1xuICAgICAgICBsZXQgaSA9IDA7XG5cbiAgICAgICAgZm9yICg7IGkgPCBwb3N0RGF0YVN0YXJ0Lmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgdWludDhBcnJheVtpXSA9IHBvc3REYXRhU3RhcnQuY2hhckNvZGVBdChpKSAmIDB4RkY7XG4gICAgICAgIH1cblxuICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IGRhdGFWaWV3LmJ5dGVMZW5ndGggOyBpKyssIGorKykge1xuICAgICAgICAgIHVpbnQ4QXJyYXlbaV0gPSBkYXRhVmlldy5nZXRVaW50OChqKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgcG9zdERhdGFFbmQubGVuZ3RoOyBpKyssIGorKykge1xuICAgICAgICAgIHVpbnQ4QXJyYXlbaV0gPSBwb3N0RGF0YUVuZC5jaGFyQ29kZUF0KGopICYgMHhGRjtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHBheWxvYWQgPSB1aW50OEFycmF5LmJ1ZmZlcjtcblxuICAgICAgICB4aHIuc2V0UmVxdWVzdEhlYWRlcignQXV0aG9yaXphdGlvbicsIGBCZWFyZXIgJHt0aGlzLl90b2tlbn1gKTtcbiAgICAgICAgeGhyLnNldFJlcXVlc3RIZWFkZXIoJ0NvbnRlbnQtVHlwZScsICdtdWx0aXBhcnQvZm9ybS1kYXRhOyBib3VuZGFyeT0nICsgQk9VTkRBUlkpO1xuICAgICAgICB4aHIuc2VuZChwYXlsb2FkKTtcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIHN0YXRpYyBnZXQgRXZlbnRUeXBlcygpIHtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIExPRzogJ2xvZycsXG4gICAgICAgIEVSUk9SOiAnZXJyb3InLFxuICAgICAgICBMT0dJTjogJ2xvZ2luJyxcbiAgICAgICAgTE9HT1VUOiAnbG9nb3V0JyxcbiAgICAgICAgUkVDT1JEX1NUQVJUOiAncmVjb3JkU3RhcnQnLFxuICAgICAgICBSRUNPUkRfU1RPUDogJ3JlY29yZFN0b3AnLFxuICAgICAgICBUT0tFTl9TRVQ6ICd0b2tlblNldCcsXG4gICAgICAgIFJFRlJFU0hfVE9LRU5fU0VUOiAncmVmcmVzaFRva2VuU2V0JyxcbiAgICAgICAgVE9LRU5fSU5WQUxJRDogJ3Rva2VuSW52YWxpZCdcbiAgICAgIH07XG4gICAgfVxuXG4gICAgc3RhdGljIGdldCBQbGF5ZXIoKSB7XG4gICAgICByZXR1cm4gUGxheWVyO1xuICAgIH1cbiAgfVxuXG4gIGlmICh0eXBlb2YgZXhwb3J0cyAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICBpZiAodHlwZW9mIG1vZHVsZSAhPT0gJ3VuZGVmaW5lZCcgJiYgbW9kdWxlLmV4cG9ydHMpIHtcbiAgICAgIGV4cG9ydHMgPSBtb2R1bGUuZXhwb3J0cyA9IEFWUztcbiAgICB9XG4gICAgZXhwb3J0cy5BVlMgPSBBVlM7XG4gIH1cblxuICBpZiAodHlwZW9mIGRlZmluZSA9PT0gJ2Z1bmN0aW9uJyAmJiBkZWZpbmUuYW1kKSB7XG4gICAgZGVmaW5lKFtdLCBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiBBVlM7XG4gICAgfSk7XG4gIH1cblxuICBpZiAodHlwZW9mIHdpbmRvdyA9PT0gJ29iamVjdCcpIHtcbiAgICB3aW5kb3cuQVZTID0gQVZTO1xuICB9XG5cbn0pKCk7XG4iLCJjb25zdCBBVlMgPSByZXF1aXJlKCcuLi9hdnMnKTtcbmNvbnN0IHBsYXllciA9IEFWUy5QbGF5ZXI7XG5cbmNvbnN0IGF2cyA9IG5ldyBBVlMoe1xuICBkZWJ1ZzogdHJ1ZSxcbiAgY2xpZW50SWQ6ICdhbXpuMS5hcHBsaWNhdGlvbi1vYTItY2xpZW50LjY5NmFiOTBmYzU4NDRmZGJiOGVmYzE3Mzk0YTc5YzAwJyxcbiAgZGV2aWNlSWQ6ICd0ZXN0X2RldmljZScsXG4gIGRldmljZVNlcmlhbE51bWJlcjogMTIzLFxuICByZWRpcmVjdFVyaTogYGh0dHBzOi8vJHt3aW5kb3cubG9jYXRpb24uaG9zdH0vYXV0aHJlc3BvbnNlYFxufSk7XG5cbmF2cy5vbihBVlMuRXZlbnRUeXBlcy5UT0tFTl9TRVQsICgpID0+IHtcbiAgbG9naW5CdG4uZGlzYWJsZWQgPSB0cnVlO1xuICBsb2dvdXRCdG4uZGlzYWJsZWQgPSBmYWxzZTtcbiAgc3RhcnRSZWNvcmRpbmcuZGlzYWJsZWQgPSBmYWxzZTtcbiAgc3RvcFJlY29yZGluZy5kaXNhYmxlZCA9IHRydWU7XG59KTtcblxuYXZzLm9uKEFWUy5FdmVudFR5cGVzLlJFQ09SRF9TVEFSVCwgKCkgPT4ge1xuICBzdGFydFJlY29yZGluZy5kaXNhYmxlZCA9IHRydWU7XG4gIHN0b3BSZWNvcmRpbmcuZGlzYWJsZWQgPSBmYWxzZTtcbn0pO1xuXG5hdnMub24oQVZTLkV2ZW50VHlwZXMuUkVDT1JEX1NUT1AsICgpID0+IHtcbiAgc3RhcnRSZWNvcmRpbmcuZGlzYWJsZWQgPSBmYWxzZTtcbiAgc3RvcFJlY29yZGluZy5kaXNhYmxlZCA9IHRydWU7XG59KTtcblxuYXZzLm9uKEFWUy5FdmVudFR5cGVzLkxPR09VVCwgKCkgPT4ge1xuICBsb2dpbkJ0bi5kaXNhYmxlZCA9IGZhbHNlO1xuICBsb2dvdXRCdG4uZGlzYWJsZWQgPSB0cnVlO1xuICBzdGFydFJlY29yZGluZy5kaXNhYmxlZCA9IHRydWU7XG4gIHN0b3BSZS5kaXNhYmxlZCA9IHRydWU7XG59KTtcblxuYXZzLm9uKEFWUy5FdmVudFR5cGVzLlRPS0VOX0lOVkFMSUQsICgpID0+IHtcbiAgYXZzLmxvZ291dCgpXG4gIC50aGVuKGxvZ2luKVxufSk7XG5cbmF2cy5vbihBVlMuRXZlbnRUeXBlcy5MT0csIGxvZyk7XG5hdnMub24oQVZTLkV2ZW50VHlwZXMuRVJST1IsIGxvZ0Vycm9yKTtcblxuYXZzLnBsYXllci5vbihBVlMuUGxheWVyLkV2ZW50VHlwZXMuTE9HLCBsb2cpO1xuYXZzLnBsYXllci5vbihBVlMuUGxheWVyLkV2ZW50VHlwZXMuRVJST1IsIGxvZ0Vycm9yKTtcblxuYXZzLnBsYXllci5vbihBVlMuUGxheWVyLkV2ZW50VHlwZXMuUExBWSwgKCkgPT4ge1xuICBwbGF5QXVkaW8uZGlzYWJsZWQgPSB0cnVlO1xuICBwYXVzZUF1ZGlvLmRpc2FibGVkID0gZmFsc2U7XG4gIHN0b3BBdWRpby5kaXNhYmxlZCA9IGZhbHNlO1xufSk7XG5cbmF2cy5wbGF5ZXIub24oQVZTLlBsYXllci5FdmVudFR5cGVzLkVOREVELCAoKSA9PiB7XG4gIHBsYXlBdWRpby5kaXNhYmxlZCA9IHRydWU7XG4gIHBhdXNlQXVkaW8uZGlzYWJsZWQgPSB0cnVlO1xuICBzdG9wQXVkaW8uZGlzYWJsZWQgPSB0cnVlO1xufSk7XG5cbmF2cy5wbGF5ZXIub24oQVZTLlBsYXllci5FdmVudFR5cGVzLlNUT1AsICgpID0+IHtcbiAgcGxheUF1ZGlvLmRpc2FibGVkID0gZmFsc2U7XG4gIHBhdXNlQXVkaW8uZGlzYWJsZWQgPSBmYWxzZTtcbiAgc3RvcEF1ZGlvLmRpc2FibGVkID0gZmFsc2U7XG59KTtcblxuYXZzLnBsYXllci5vbihBVlMuUGxheWVyLkV2ZW50VHlwZXMuUEFVU0UsICgpID0+IHtcbiAgcGxheUF1ZGlvLmRpc2FibGVkID0gdHJ1ZTtcbiAgcGF1c2VBdWRpby5kaXNhYmxlZCA9IGZhbHNlO1xuICBzdG9wQXVkaW8uZGlzYWJsZWQgPSBmYWxzZTtcbn0pO1xuXG5hdnMucGxheWVyLm9uKEFWUy5QbGF5ZXIuRXZlbnRUeXBlcy5SRVBMQVksICgpID0+IHtcblxufSk7XG5cbmZ1bmN0aW9uIGxvZyhtZXNzYWdlKSB7XG4gIGxvZ091dHB1dC5pbm5lckhUTUwgKz0gYDxsaT5MT0c6ICR7bWVzc2FnZX08L2xpPmA7XG59XG5cbmZ1bmN0aW9uIGxvZ0Vycm9yKGVycm9yKSB7XG4gIGxvZ091dHB1dC5pbm5lckhUTUwgKz0gYDxsaT5FUlJPUjogJHtlcnJvcn08L2xpPmA7XG59XG5cbmNvbnN0IGxvZ2luQnRuID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2xvZ2luJyk7XG5jb25zdCBsb2dvdXRCdG4gPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnbG9nb3V0Jyk7XG5jb25zdCBsb2dPdXRwdXQgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnbG9nJyk7XG5jb25zdCBzdGFydFJlY29yZGluZyA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdzdGFydFJlY29yZGluZycpO1xuY29uc3Qgc3RvcFJlY29yZGluZyA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdzdG9wUmVjb3JkaW5nJyk7XG5jb25zdCBzdG9wQXVkaW8gPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnc3RvcEF1ZGlvJyk7XG5jb25zdCBwYXVzZUF1ZGlvID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3BhdXNlQXVkaW8nKTtcbmNvbnN0IHBsYXlBdWRpbyA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdwbGF5QXVkaW8nKTtcbmNvbnN0IHJlcGxheUF1ZGlvID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3JlcGxheUF1ZGlvJyk7XG5cbi8qXG4vLyBJZiB1c2luZyBjbGllbnQgc2VjcmV0XG5hdnMuZ2V0Q29kZUZyb21VcmwoKVxuIC50aGVuKGNvZGUgPT4gYXZzLmdldFRva2VuRnJvbUNvZGUoY29kZSkpXG4udGhlbih0b2tlbiA9PiBsb2NhbFN0b3JhZ2Uuc2V0SXRlbSgndG9rZW4nLCB0b2tlbikpXG4udGhlbihyZWZyZXNoVG9rZW4gPT4gbG9jYWxTdG9yYWdlLnNldEl0ZW0oJ3JlZnJlc2hUb2tlbicsIHJlZnJlc2hUb2tlbikpXG4udGhlbigoKSA9PiBhdnMucmVxdWVzdE1pYygpKVxuLnRoZW4oKCkgPT4gYXZzLnJlZnJlc2hUb2tlbigpKVxuLmNhdGNoKCgpID0+IHtcblxufSk7XG4qL1xuXG5hdnMuZ2V0VG9rZW5Gcm9tVXJsKClcbi50aGVuKCgpID0+IGF2cy5nZXRUb2tlbigpKVxuLnRoZW4odG9rZW4gPT4gbG9jYWxTdG9yYWdlLnNldEl0ZW0oJ3Rva2VuJywgdG9rZW4pKVxuLnRoZW4oKCkgPT4gYXZzLnJlcXVlc3RNaWMoKSlcbi5jYXRjaCgoKSA9PiB7XG4gIGNvbnN0IGNhY2hlZFRva2VuID0gbG9jYWxTdG9yYWdlLmdldEl0ZW0oJ3Rva2VuJyk7XG5cbiAgaWYgKGNhY2hlZFRva2VuKSB7XG4gICAgYXZzLnNldFRva2VuKGNhY2hlZFRva2VuKTtcbiAgICByZXR1cm4gYXZzLnJlcXVlc3RNaWMoKTtcbiAgfVxufSk7XG5cbmxvZ2luQnRuLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgbG9naW4pO1xuXG5mdW5jdGlvbiBsb2dpbihldmVudCkge1xuICByZXR1cm4gYXZzLmxvZ2luKClcbiAgLnRoZW4oKCkgPT4gYXZzLnJlcXVlc3RNaWMoKSlcbiAgLmNhdGNoKCgpID0+IHt9KTtcblxuICAvKlxuICAvLyBJZiB1c2luZyBjbGllbnQgc2VjcmV0XG4gIGF2cy5sb2dpbih7cmVzcG9uc2VUeXBlOiAnY29kZSd9KVxuICAudGhlbigoKSA9PiBhdnMucmVxdWVzdE1pYygpKVxuICAuY2F0Y2goKCkgPT4ge30pO1xuICAqL1xufVxuXG5sb2dvdXRCdG4uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBsb2dvdXQpO1xuXG5mdW5jdGlvbiBsb2dvdXQoKSB7XG4gIHJldHVybiBhdnMubG9nb3V0KClcbiAgLnRoZW4oKCkgPT4ge1xuICAgIGxvY2FsU3RvcmFnZS5yZW1vdmVJdGVtKCd0b2tlbicpO1xuICAgIHdpbmRvdy5sb2NhdGlvbi5oYXNoID0gJyc7XG4gIH0pO1xufVxuXG5zdGFydFJlY29yZGluZy5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHtcbiAgYXZzLnN0YXJ0UmVjb3JkaW5nKCk7XG59KTtcblxuc3RvcFJlY29yZGluZy5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHtcbiAgYXZzLnN0b3BSZWNvcmRpbmcoKS50aGVuKGRhdGFWaWV3ID0+IHtcbiAgICBhdnMucGxheWVyLmVtcHR5UXVldWUoKVxuICAgIC50aGVuKCgpID0+IGF2cy5wbGF5ZXIuZW5xdWV1ZShkYXRhVmlldykpXG4gICAgLnRoZW4oKCkgPT4gYXZzLnBsYXllci5wbGF5KCkpXG4gICAgLmNhdGNoKGVycm9yID0+IHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoZXJyb3IpO1xuICAgIH0pO1xuXG4gICAgLy9zZW5kQmxvYihibG9iKTtcbiAgICBhdnMuc2VuZEF1ZGlvKGRhdGFWaWV3KVxuICAgIC50aGVuKHJlc3BvbnNlID0+IHtcblxuICAgICAgaWYgKHJlc3BvbnNlLm11bHRpcGFydC5sZW5ndGggPiAxKSB7XG4gICAgICAgIGNvbnN0IHR5cGVkQXJyYXkgPSByZXNwb25zZS5tdWx0aXBhcnRbMV0uYm9keTtcblxuICAgICAgICBhdnMucGxheWVyLmVucXVldWUodHlwZWRBcnJheSlcbiAgICAgICAgLnRoZW4oKCkgPT4gYXZzLnBsYXllci5wbGF5KCkpXG4gICAgICAgIC5jYXRjaChlcnJvciA9PiB7XG4gICAgICAgICAgY29uc29sZS5lcnJvcihlcnJvcik7XG4gICAgICAgIH0pO1xuICAgICAgfVxuXG4gICAgfSlcbiAgICAuY2F0Y2goZXJyb3IgPT4ge1xuICAgICAgY29uc29sZS5lcnJvcihlcnJvcik7XG4gICAgfSk7XG4gIH0pO1xufSk7XG5cbnN0b3BBdWRpby5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIChldmVudCkgPT4ge1xuICBhdnMucGxheWVyLnN0b3AoKTtcbn0pO1xuXG5wYXVzZUF1ZGlvLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKGV2ZW50KSA9PiB7XG4gIGF2cy5wbGF5ZXIucGF1c2UoKTtcbn0pO1xuXG5wbGF5QXVkaW8uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoZXZlbnQpID0+IHtcbiAgYXZzLnBsYWVyLnBsYXkoKTtcbn0pO1xuXG5mdW5jdGlvbiBzZW5kQmxvYihibG9iKSB7XG4gIGNvbnN0IHhociA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xuICBjb25zdCBmZCA9IG5ldyBGb3JtRGF0YSgpO1xuXG4gIGZkLmFwcGVuZCgnZm5hbWUnLCAnYXVkaW8ud2F2Jyk7XG4gIGZkLmFwcGVuZCgnZGF0YScsIGJsb2IpO1xuXG4gIHhoci5vcGVuKCdQT1NUJywgJ2h0dHA6Ly9sb2NhbGhvc3Q6NTU1NS9hdWRpbycsIHRydWUpO1xuICB4aHIucmVzcG9uc2VUeXBlID0gJ2Jsb2InO1xuXG4gIHhoci5vbmxvYWQgPSAoZXZlbnQpID0+IHtcbiAgICBpZiAoeGhyLnN0YXR1cyA9PSAyMDApIHtcbiAgICAgIGNvbnNvbGUubG9nKHhoci5yZXNwb25zZSk7XG4gICAgICAvL2NvbnN0IHJlc3BvbnNlQmxvYiA9IG5ldyBCbG9iKFt4aHIucmVzcG9uc2VdLCB7dHlwZTogJ2F1ZGlvL21wMyd9KTtcbiAgICB9XG4gIH07XG4gIHhoci5zZW5kKGZkKTtcbn1cbiIsIid1c2Ugc3RyaWN0JztcblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gIEludmFsaWRBY2Nlc3NUb2tlbkV4Y2VwdGlvbjogJ2NvbS5hbWF6b24uYWxleGFodHRwcHJveHkuZXhjZXB0aW9ucy5JbnZhbGlkQWNjZXNzVG9rZW5FeGNlcHRpb24nXG59O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG5mdW5jdGlvbiBPYnNlcnZhYmxlKGVsKSB7XG4gIGxldCBjYWxsYmFja3MgPSB7fTtcblxuICBlbC5vbiA9IGZ1bmN0aW9uKG5hbWUsIGZuKSB7XG4gICAgaWYgKHR5cGVvZiBmbiAhPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignU2Vjb25kIGFyZ3VtZW50IGZvciBcIm9uXCIgbWV0aG9kIG11c3QgYmUgYSBmdW5jdGlvbi4nKTtcbiAgICB9XG5cbiAgICAoY2FsbGJhY2tzW25hbWVdID0gY2FsbGJhY2tzW25hbWVdIHx8IFtdKS5wdXNoKGZuKTtcblxuICAgIHJldHVybiBlbDtcbiAgfTtcblxuICBlbC5vbmUgPSBmdW5jdGlvbihuYW1lLCBmbikge1xuICAgIGZuLm9uZSA9IHRydWU7XG4gICAgcmV0dXJuIGVsLm9uLmNhbGwoZWwsIG5hbWUsIGZuKTtcbiAgfTtcblxuICBlbC5vZmYgPSBmdW5jdGlvbihuYW1lLCBmbikge1xuICAgIGlmIChuYW1lID09PSAnKicpIHtcbiAgICAgIGNhbGxiYWNrcyA9IHt9O1xuICAgICAgcmV0dXJuIGNhbGxiYWNrc1xuICAgIH1cblxuICAgIGlmICghY2FsbGJhY2tzW25hbWVdKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgaWYgKGZuKSB7XG4gICAgICBpZiAodHlwZW9mIGZuICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ1NlY29uZCBhcmd1bWVudCBmb3IgXCJvZmZcIiBtZXRob2QgbXVzdCBiZSBhIGZ1bmN0aW9uLicpO1xuICAgICAgfVxuXG4gICAgICBjYWxsYmFja3NbbmFtZV0gPSBjYWxsYmFja3NbbmFtZV0ubWFwKGZ1bmN0aW9uKGZtLCBpKSB7XG4gICAgICAgIGlmIChmbSA9PT0gZm4pIHtcbiAgICAgICAgICBjYWxsYmFja3NbbmFtZV0uc3BsaWNlKGksIDEpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgZGVsZXRlIGNhbGxiYWNrc1tuYW1lXTtcbiAgICB9XG4gIH07XG5cbiAgZWwuZW1pdCA9IGZ1bmN0aW9uKG5hbWUgLyosIGFyZ3MgKi8pIHtcbiAgICBpZiAoIWNhbGxiYWNrc1tuYW1lXSB8fCAhY2FsbGJhY2tzW25hbWVdLmxlbmd0aCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IGFyZ3MgPSBbXS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMSk7XG5cbiAgICBjYWxsYmFja3NbbmFtZV0uZm9yRWFjaChmdW5jdGlvbihmbiwgaSkge1xuICAgICAgaWYgKGZuKSB7XG4gICAgICAgIGZuLmFwcGx5KGZuLCBhcmdzKTtcbiAgICAgICAgaWYgKGZuLm9uZSkge1xuICAgICAgICAgIGNhbGxiYWNrc1tuYW1lXS5zcGxpY2UoaSwgMSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9KTtcblxuICAgIHJldHVybiBlbDtcbiAgfTtcblxuICByZXR1cm4gZWw7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gT2JzZXJ2YWJsZTtcbiIsIid1c2Ugc3RyaWN0JztcblxuY29uc3QgT2JzZXJ2YWJsZSA9IHJlcXVpcmUoJy4vT2JzZXJ2YWJsZScpO1xuY29uc3QgYXJyYXlCdWZmZXJUb0F1ZGlvQnVmZmVyID0gcmVxdWlyZSgnLi91dGlscy9hcnJheUJ1ZmZlclRvQXVkaW9CdWZmZXInKTtcbmNvbnN0IHRvU3RyaW5nID0gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZztcblxuY2xhc3MgUGxheWVyIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgdGhpcy5fcXVldWUgPSBbXTtcbiAgICB0aGlzLl9jdXJyZW50U291cmNlID0gbnVsbDtcbiAgICB0aGlzLl9jb250ZXh0ID0gbmV3IEF1ZGlvQ29udGV4dCgpO1xuXG4gICAgT2JzZXJ2YWJsZSh0aGlzKTtcbiAgfVxuXG4gIF9sb2codHlwZSwgbWVzc2FnZSkge1xuICAgIGlmICh0eXBlICYmICFtZXNzYWdlKSB7XG4gICAgICBtZXNzYWdlID0gdHlwZTtcbiAgICAgIHR5cGUgPSAnbG9nJztcbiAgICB9XG5cbiAgICBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgIHRoaXMuZW1pdChQbGF5ZXIuRXZlbnRUeXBlcy5MT0csIG1lc3NhZ2UpO1xuICAgIH0sIDApO1xuXG4gICAgaWYgKHRoaXMuX2RlYnVnKSB7XG4gICAgICBjb25zb2xlW3R5cGVdKG1lc3NhZ2UpO1xuICAgIH1cbiAgfVxuXG4gIGVtcHR5UXVldWUoKSB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgIHRoaXMuX3F1ZXVlID0gW107XG4gICAgICByZXNvbHZlKCk7XG4gICAgfSk7XG4gIH1cblxuICBlbnF1ZXVlKGl0ZW0pIHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgaWYgKCFpdGVtKSB7XG4gICAgICAgIGNvbnN0IGVycm9yID0gbmV3IEVycm9yKCdhcmd1bWVudCBjYW5ub3QgYmUgZW1wdHkuJyk7XG4gICAgICAgIHRoaXMuX2xvZyhlcnJvcik7XG4gICAgICAgIHJldHVybiByZWplY3QoZXJyb3IpO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBzdHJpbmdUeXBlID0gdG9TdHJpbmcuY2FsbChpdGVtKTtcblxuICAgICAgY29uc3QgcHJvY2VlZCA9IChhdWRpb0J1ZmZlcikgPT4ge1xuICAgICAgICB0aGlzLl9xdWV1ZS5wdXNoKGF1ZGlvQnVmZmVyKTtcbiAgICAgICAgdGhpcy5fbG9nKCdFbnF1ZXVlIGF1ZGlvJyk7XG4gICAgICAgIHRoaXMuZW1pdChQbGF5ZXIuRXZlbnRUeXBlcy5FTlFVRVVFKTtcbiAgICAgICAgcmV0dXJuIHJlc29sdmUoKTtcbiAgICAgIH07XG5cbiAgICAgIGlmIChzdHJpbmdUeXBlID09PSAnW29iamVjdCBEYXRhVmlld10nIHx8IHN0cmluZ1R5cGUgPT09ICdbb2JqZWN0IFVpbnQ4QXJyYXldJykge1xuICAgICAgICBhcnJheUJ1ZmZlclRvQXVkaW9CdWZmZXIoaXRlbS5idWZmZXIpXG4gICAgICAgIC50aGVuKHByb2NlZWQpO1xuICAgICAgfSBlbHNlIGlmIChzdHJpbmdUeXBlID09PSAnW29iamVjdCBBdWRpb0J1ZmZlcl0nKSB7XG4gICAgICAgIHByb2NlZWQoaXRlbSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb25zdCBlcnJvciA9IG5ldyBFcnJvcignSW52YWxpZCB0eXBlLicpO1xuICAgICAgICB0aGlzLl9sb2coZXJyb3IpO1xuICAgICAgICByZXR1cm4gcmVqZWN0KGVycm9yKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIGRlcXVldWUoKSB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgIGNvbnN0IGl0ZW0gPSB0aGlzLl9xdWV1ZS5zaGlmdCgpO1xuXG4gICAgICBpZiAoaXRlbSkge1xuICAgICAgICB0aGlzLl9sb2coJ0RlcXVldWUgYXVkaW8nKTtcbiAgICAgICAgdGhpcy5lbWl0KFBsYXllci5FdmVudFR5cGVzLkRFUVVFVUUpO1xuICAgICAgICByZXR1cm4gcmVzb2x2ZShpdGVtKTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHJlamVjdCgpO1xuICAgIH0pO1xuICB9XG5cbiAgcGxheSgpIHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgcmV0dXJuIHRoaXMuZGVxdWV1ZSgpXG4gICAgICAudGhlbihhdWRpb0J1ZmZlciA9PiB7XG4gICAgICAgIHRoaXMuX2xvZygnUGxheSBhdWRpbycpO1xuICAgICAgICB0aGlzLmVtaXQoUGxheWVyLkV2ZW50VHlwZXMuUExBWSk7XG4gICAgICAgIHRoaXMucGxheUF1ZGlvQnVmZmVyKGF1ZGlvQnVmZmVyKVxuICAgICAgfSk7XG4gICAgfSk7XG4gIH1cblxuICBzdG9wKCkge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgIGlmICh0aGlzLl9jdXJyZW50U291cmNlKSB7XG4gICAgICAgICAgdGhpcy5fY3VycmVudFNvdXJjZS5zdG9wKCk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9sb2coJ1N0b3AgYXVkaW8nKTtcbiAgICAgICAgdGhpcy5lbWl0KFBsYXllci5FdmVudFR5cGVzLlNUT1ApO1xuICAgIH0pO1xuICB9XG5cbiAgcGF1c2UoKSB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgaWYgKHRoaXMuX2N1cnJlbnRTb3VyY2UpIHtcbiAgICAgICAgICB0aGlzLl9jdXJyZW50U291cmNlLnBhdXNlKCk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9sb2coJ1BhdXNlIGF1ZGlvJyk7XG4gICAgICAgIHRoaXMuZW1pdChQbGF5ZXIuRXZlbnRUeXBlcy5QQVVTRSk7XG4gICAgfSk7XG4gIH1cblxuICByZXBsYXkoKSB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgdGhpcy5fbG9nKCdSZXBsYXkgYXVkaW8nKTtcbiAgICAgICAgdGhpcy5lbWl0KFBsYXllci5FdmVudFR5cGVzLlJFUExBWSk7XG4gICAgfSk7XG4gIH1cblxuICBwbGF5QmxvYihibG9iKSB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgIGlmICghYmxvYikge1xuICAgICAgICByZWplY3QoKTtcbiAgICAgIH1cblxuICAgICAgY29uc3Qgb2JqZWN0VXJsID0gVVJMLmNyZWF0ZU9iamVjdFVSTChibG9iKTtcbiAgICAgIGNvbnN0IGF1ZGlvID0gbmV3IEF1ZGlvKCk7XG4gICAgICBhdWRpby5zcmMgPSBvYmplY3RVcmw7XG4gICAgICB0aGlzLl9jdXJyZW50U291cmNlID0gYXVkaW87XG5cbiAgICAgIGF1ZGlvLmFkZEV2ZW50TGlzdGVuZXIoJ2VuZGVkJywgKCkgPT4ge1xuICAgICAgICB0aGlzLl9sb2coJ0F1ZGlvIGVuZGVkJyk7XG4gICAgICAgIHRoaXMuZW1pdChQbGF5ZXIuRXZlbnRUeXBlcy5FTkRFRCk7XG4gICAgICB9KTtcblxuICAgICAgYXVkaW8ub25sb2FkID0gKGV2ZW50KSA9PiB7XG4gICAgICAgIFVSTC5yZXZva2VPYmplY3RVcmwob2JqZWN0VXJsKTtcbiAgICAgIH07XG5cbiAgICAgIHRoaXMuX2xvZygnQXVkaW8gcGxheSBzdGFydGVkLicpO1xuICAgICAgYXVkaW8ucGxheSgpO1xuXG4gICAgICByZXNvbHZlKCk7XG4gICAgfSk7XG4gIH1cblxuICBwbGF5QXVkaW9CdWZmZXIoYnVmZmVyKSB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgIGNvbnN0IHNvdXJjZSA9IHRoaXMuX2NvbnRleHQuY3JlYXRlQnVmZmVyU291cmNlKCk7XG4gICAgICBzb3VyY2UuYnVmZmVyID0gYnVmZmVyO1xuICAgICAgc291cmNlLmNvbm5lY3QodGhpcy5fY29udGV4dC5kZXN0aW5hdGlvbik7XG4gICAgICBzb3VyY2Uuc3RhcnQoMCk7XG5cbiAgICAgIHNvdXJjZS5vbmVuZGVkID0gKGV2ZW50KSA9PiB7XG4gICAgICAgIHRoaXMuX2xvZygnQXVkaW8gZW5kZWQnKTtcbiAgICAgICAgdGhpcy5lbWl0KFBsYXllci5FdmVudFR5cGVzLkVOREVEKTtcbiAgICAgIH07XG5cbiAgICAgIHRoaXMuX2N1cnJlbnRTb3VyY2UgPSBzb3VyY2U7XG4gICAgICByZXNvbHZlKCk7XG4gICAgfSk7XG4gIH1cblxuICBzdGF0aWMgZ2V0IEV2ZW50VHlwZXMoKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIExPRzogJ2xvZycsXG4gICAgICBFUlJPUjogJ2Vycm9yJyxcbiAgICAgIFBMQVk6ICdwbGF5JyxcbiAgICAgIFJFUExBWTogJ3JlcGxheScsXG4gICAgICBQQVVTRTogJ3BhdXNlJyxcbiAgICAgIFNUT1A6ICdwYXVzZScsXG4gICAgICBFTlFVRVVFOiAnZW5xdWV1ZScsXG4gICAgICBERVFVRVVFOiAnZGVxdWV1ZSdcbiAgICB9O1xuICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gUGxheWVyO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG53aW5kb3cuQXVkaW9Db250ZXh0ID0gd2luZG93LkF1ZGlvQ29udGV4dCB8fCB3aW5kb3cud2Via2l0QXVkaW9Db250ZXh0O1xuXG5mdW5jdGlvbiBhcnJheUJ1ZmZlclRvQXVkaW9CdWZmZXIoYXJyYXlCdWZmZXIsIGNvbnRleHQpIHtcbiAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICBpZiAoY29udGV4dCkge1xuICAgICAgaWYgKE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChjb250ZXh0KSAhPT0gJ1tvYmplY3QgQXVkaW9Db250ZXh0XScpIHtcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignYGNvbnRleHRgIG11c3QgYmUgYW4gQXVkaW9Db250ZXh0Jyk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnRleHQgPSBuZXcgQXVkaW9Db250ZXh0KCk7XG4gICAgfVxuXG4gICAgY29udGV4dC5kZWNvZGVBdWRpb0RhdGEoYXJyYXlCdWZmZXIsIHJlc29sdmUsIHJlamVjdCk7XG4gIH0pO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGFycmF5QnVmZmVyVG9BdWRpb0J1ZmZlcjtcbiIsIid1c2Ugc3RyaWN0JztcblxuLyoqXG4gKiBAY3JlZGl0IGh0dHBzOi8vZGV2ZWxvcGVycy5nb29nbGUuY29tL3dlYi91cGRhdGVzLzIwMTIvMDYvSG93LXRvLWNvbnZlcnQtQXJyYXlCdWZmZXItdG8tYW5kLWZyb20tU3RyaW5nP2hsPWVuXG4gKi9cbmZ1bmN0aW9uIGFycmF5QnVmZmVyVG9TdHJpbmcoYnVmZmVyKSB7XG4gIHJldHVybiBTdHJpbmcuZnJvbUNoYXJDb2RlLmFwcGx5KG51bGwsIG5ldyBVaW50MTZBcnJheShidWZmZXIpKTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBhcnJheUJ1ZmZlclRvU3RyaW5nO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG4vKipcbiAqIEBjcmVkaXQgaHR0cDovL3N0YWNrb3ZlcmZsb3cuY29tL2EvMjYyNDUyNjBcbiAqL1xuZnVuY3Rpb24gZG93bnNhbXBsZUJ1ZmZlcihidWZmZXIsIGlucHV0U2FtcGxlUmF0ZSwgb3V0cHV0U2FtcGxlUmF0ZSkge1xuICBpZiAoaW5wdXRTYW1wbGVSYXRlID09PSBvdXRwdXRTYW1wbGVSYXRlKSB7XG4gICAgcmV0dXJuIGJ1ZmZlcjtcbiAgfVxuXG4gIGlmIChpbnB1dFNhbXBsZVJhdGUgPCBvdXRwdXRTYW1wbGVSYXRlKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdPdXRwdXQgc2FtcGxlIHJhdGUgbXVzdCBiZSBsZXNzIHRoYW4gaW5wdXQgc2FtcGxlIHJhdGUuJyk7XG4gIH1cblxuICBjb25zdCBzYW1wbGVSYXRlUmF0aW8gPSBpbnB1dFNhbXBsZVJhdGUgLyBvdXRwdXRTYW1wbGVSYXRlO1xuICBjb25zdCBuZXdMZW5ndGggPSBNYXRoLnJvdW5kKGJ1ZmZlci5sZW5ndGggLyBzYW1wbGVSYXRlUmF0aW8pO1xuICBsZXQgcmVzdWx0ID0gbmV3IEZsb2F0MzJBcnJheShuZXdMZW5ndGgpO1xuICBsZXQgb2Zmc2V0UmVzdWx0ID0gMDtcbiAgbGV0IG9mZnNldEJ1ZmZlciA9IDA7XG5cbiAgd2hpbGUgKG9mZnNldFJlc3VsdCA8IHJlc3VsdC5sZW5ndGgpIHtcbiAgICBsZXQgbmV4dE9mZnNldEJ1ZmZlciA9IE1hdGgucm91bmQoKG9mZnNldFJlc3VsdCArIDEpICogc2FtcGxlUmF0ZVJhdGlvKTtcbiAgICBsZXQgYWNjdW0gPSAwO1xuICAgIGxldCBjb3VudCA9IDA7XG5cbiAgICBmb3IgKHZhciBpID0gb2Zmc2V0QnVmZmVyOyBpIDwgbmV4dE9mZnNldEJ1ZmZlciAmJiBpIDwgYnVmZmVyLmxlbmd0aDsgaSsrKSB7XG4gICAgICBhY2N1bSArPSBidWZmZXJbaV07XG4gICAgICBjb3VudCsrO1xuICAgIH1cblxuICAgIHJlc3VsdFtvZmZzZXRSZXN1bHRdID0gYWNjdW0gLyBjb3VudDtcbiAgICBvZmZzZXRSZXN1bHQrKztcbiAgICBvZmZzZXRCdWZmZXIgPSBuZXh0T2Zmc2V0QnVmZmVyO1xuICB9XG5cbiAgcmV0dXJuIHJlc3VsdDtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBkb3duc2FtcGxlQnVmZmVyO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG4vKipcbiAqIEBjcmVkaXQgaHR0cHM6Ly9naXRodWIuY29tL21hdHRkaWFtb25kL1JlY29yZGVyanNcbiAqL1xuZnVuY3Rpb24gaW50ZXJsZWF2ZShsZWZ0Q2hhbm5lbCwgcmlnaHRDaGFubmVsKSB7XG4gIGlmIChsZWZ0Q2hhbm5lbCAmJiAhcmlnaHRDaGFubmVsKSB7XG4gICAgcmV0dXJuIGxlZnRDaGFubmVsO1xuICB9XG5cbiAgY29uc3QgbGVuZ3RoID0gbGVmdENoYW5uZWwubGVuZ3RoICsgcmlnaHRDaGFubmVsLmxlbmd0aDtcbiAgbGV0IHJlc3VsdCA9IG5ldyBGbG9hdDMyQXJyYXkobGVuZ3RoKTtcbiAgbGV0IGlucHV0SW5kZXggPSAwO1xuXG4gIGZvciAobGV0IGluZGV4ID0gMDsgaW5kZXggPCBsZW5ndGg7ICl7XG4gICAgcmVzdWx0W2luZGV4KytdID0gbGVmdENoYW5uZWxbaW5wdXRJbmRleF07XG4gICAgcmVzdWx0W2luZGV4KytdID0gcmlnaHRDaGFubmVsW2lucHV0SW5kZXhdO1xuICAgIGlucHV0SW5kZXgrKztcbiAgfVxuXG4gIHJldHVybiByZXN1bHQ7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gaW50ZXJsZWF2ZTtcbiIsIid1c2Ugc3RyaWN0JztcblxuLyoqXG4gKiBAY3JlZGl0IGh0dHBzOi8vZ2l0aHViLmNvbS9tYXR0ZGlhbW9uZC9SZWNvcmRlcmpzXG4gKi9cbmZ1bmN0aW9uIG1lcmdlQnVmZmVycyhjaGFubmVsQnVmZmVyLCByZWNvcmRpbmdMZW5ndGgpe1xuICBjb25zdCByZXN1bHQgPSBuZXcgRmxvYXQzMkFycmF5KHJlY29yZGluZ0xlbmd0aCk7XG4gIGNvbnN0IGxlbmd0aCA9IGNoYW5uZWxCdWZmZXIubGVuZ3RoO1xuICBsZXQgb2Zmc2V0ID0gMDtcblxuICBmb3IgKGxldCBpID0gMDsgaSA8IGxlbmd0aDsgaSsrKXtcbiAgICBsZXQgYnVmZmVyID0gY2hhbm5lbEJ1ZmZlcltpXTtcblxuICAgIHJlc3VsdC5zZXQoYnVmZmVyLCBvZmZzZXQpO1xuICAgIG9mZnNldCArPSBidWZmZXIubGVuZ3RoO1xuICB9XG5cbiAgcmV0dXJuIHJlc3VsdDtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBtZXJnZUJ1ZmZlcnM7XG4iLCIndXNlIHN0cmljdCc7XG5cbi8qKlxuICogQGNyZWRpdCBodHRwczovL2dpdGh1Yi5jb20vbWF0dGRpYW1vbmQvUmVjb3JkZXJqc1xuICovXG5mdW5jdGlvbiB3cml0ZVVURkJ5dGVzKHZpZXcsIG9mZnNldCwgc3RyaW5nKSB7XG4gIGNvbnN0IGxlbmd0aCA9IHN0cmluZy5sZW5ndGg7XG5cbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBsZW5ndGg7IGkrKyl7XG4gICAgdmlldy5zZXRVaW50OChvZmZzZXQgKyBpLCBzdHJpbmcuY2hhckNvZGVBdChpKSk7XG4gIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSB3cml0ZVVURkJ5dGVzO1xuIiwiKGZ1bmN0aW9uKHJvb3QpIHtcbiAgJ3VzZSBzdHJpY3QnO1xuXG4gIGZ1bmN0aW9uIGh0dHBNZXNzYWdlUGFyc2VyKG1lc3NhZ2UpIHtcbiAgICBjb25zdCByZXN1bHQgPSB7XG4gICAgICBodHRwVmVyc2lvbjogbnVsbCxcbiAgICAgIHN0YXR1c0NvZGU6IG51bGwsXG4gICAgICBzdGF0dXNNZXNzYWdlOiBudWxsLFxuICAgICAgbWV0aG9kOiBudWxsLFxuICAgICAgdXJsOiBudWxsLFxuICAgICAgaGVhZGVyczogbnVsbCxcbiAgICAgIGJvZHk6IG51bGwsXG4gICAgICBib3VuZGFyeTogbnVsbCxcbiAgICAgIG11bHRpcGFydDogbnVsbFxuICAgIH07XG5cbiAgICB2YXIgbWVzc2FnZVN0cmluZyA9ICcnO1xuICAgIHZhciBoZWFkZXJOZXdsaW5lSW5kZXggPSAwO1xuICAgIHZhciBmdWxsQm91bmRhcnkgPSBudWxsO1xuXG4gICAgaWYgKGh0dHBNZXNzYWdlUGFyc2VyLl9pc0J1ZmZlcihtZXNzYWdlKSkge1xuICAgICAgbWVzc2FnZVN0cmluZyA9IG1lc3NhZ2UudG9TdHJpbmcoKTtcbiAgICB9IGVsc2UgaWYgKHR5cGVvZiBtZXNzYWdlID09PSAnc3RyaW5nJykge1xuICAgICAgbWVzc2FnZVN0cmluZyA9IG1lc3NhZ2U7XG4gICAgICBtZXNzYWdlID0gaHR0cE1lc3NhZ2VQYXJzZXIuX2NyZWF0ZUJ1ZmZlcihtZXNzYWdlU3RyaW5nKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9XG5cbiAgICAvKlxuICAgICAqIFN0cmlwIGV4dHJhIHJldHVybiBjaGFyYWN0ZXJzXG4gICAgICovXG4gICAgbWVzc2FnZVN0cmluZyA9IG1lc3NhZ2VTdHJpbmcucmVwbGFjZSgvXFxyXFxuL2dpbSwgJ1xcbicpO1xuXG4gICAgLypcbiAgICAgKiBUcmltIGxlYWRpbmcgd2hpdGVzcGFjZVxuICAgICAqL1xuICAgIChmdW5jdGlvbigpIHtcbiAgICAgIGNvbnN0IGZpcnN0Tm9uV2hpdGVzcGFjZVJlZ2V4ID0gL1tcXHctXSsvZ2ltO1xuICAgICAgY29uc3QgZmlyc3ROb25XaGl0ZXNwYWNlSW5kZXggPSBtZXNzYWdlU3RyaW5nLnNlYXJjaChmaXJzdE5vbldoaXRlc3BhY2VSZWdleCk7XG4gICAgICBpZiAoZmlyc3ROb25XaGl0ZXNwYWNlSW5kZXggPiAwKSB7XG4gICAgICAgIG1lc3NhZ2UgPSBtZXNzYWdlLnNsaWNlKGZpcnN0Tm9uV2hpdGVzcGFjZUluZGV4LCBtZXNzYWdlLmxlbmd0aCk7XG4gICAgICAgIG1lc3NhZ2VTdHJpbmcgPSBtZXNzYWdlLnRvU3RyaW5nKCk7XG4gICAgICB9XG4gICAgfSkoKTtcblxuICAgIC8qIFBhcnNlIHJlcXVlc3QgbGluZVxuICAgICAqL1xuICAgIChmdW5jdGlvbigpIHtcbiAgICAgIGNvbnN0IHBvc3NpYmxlUmVxdWVzdExpbmUgPSBtZXNzYWdlU3RyaW5nLnNwbGl0KC9cXG58XFxyXFxuLylbMF07XG4gICAgICBjb25zdCByZXF1ZXN0TGluZU1hdGNoID0gcG9zc2libGVSZXF1ZXN0TGluZS5tYXRjaChodHRwTWVzc2FnZVBhcnNlci5fcmVxdWVzdExpbmVSZWdleCk7XG5cbiAgICAgIGlmIChBcnJheS5pc0FycmF5KHJlcXVlc3RMaW5lTWF0Y2gpICYmIHJlcXVlc3RMaW5lTWF0Y2gubGVuZ3RoID4gMSkge1xuICAgICAgICByZXN1bHQuaHR0cFZlcnNpb24gPSBwYXJzZUZsb2F0KHJlcXVlc3RMaW5lTWF0Y2hbMV0pO1xuICAgICAgICByZXN1bHQuc3RhdHVzQ29kZSA9IHBhcnNlSW50KHJlcXVlc3RMaW5lTWF0Y2hbMl0pO1xuICAgICAgICByZXN1bHQuc3RhdHVzTWVzc2FnZSA9IHJlcXVlc3RMaW5lTWF0Y2hbM107XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb25zdCByZXNwb25zZUxpbmVNYXRoID0gcG9zc2libGVSZXF1ZXN0TGluZS5tYXRjaChodHRwTWVzc2FnZVBhcnNlci5fcmVzcG9uc2VMaW5lUmVnZXgpO1xuICAgICAgICBpZiAoQXJyYXkuaXNBcnJheShyZXNwb25zZUxpbmVNYXRoKSAmJiByZXNwb25zZUxpbmVNYXRoLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgICByZXN1bHQubWV0aG9kID0gcmVzcG9uc2VMaW5lTWF0aFsxXTtcbiAgICAgICAgICByZXN1bHQudXJsID0gcmVzcG9uc2VMaW5lTWF0aFsyXTtcbiAgICAgICAgICByZXN1bHQuaHR0cFZlcnNpb24gPSBwYXJzZUZsb2F0KHJlc3BvbnNlTGluZU1hdGhbM10pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSkoKTtcblxuICAgIC8qIFBhcnNlIGhlYWRlcnNcbiAgICAgKi9cbiAgICAoZnVuY3Rpb24oKSB7XG4gICAgICBoZWFkZXJOZXdsaW5lSW5kZXggPSBtZXNzYWdlU3RyaW5nLnNlYXJjaChodHRwTWVzc2FnZVBhcnNlci5faGVhZGVyTmV3bGluZVJlZ2V4KTtcbiAgICAgIGlmIChoZWFkZXJOZXdsaW5lSW5kZXggPiAtMSkge1xuICAgICAgICBoZWFkZXJOZXdsaW5lSW5kZXggPSBoZWFkZXJOZXdsaW5lSW5kZXggKyAxOyAvLyAxIGZvciBuZXdsaW5lIGxlbmd0aFxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLyogVGhlcmUncyBubyBsaW5lIGJyZWFrcyBzbyBjaGVjayBpZiByZXF1ZXN0IGxpbmUgZXhpc3RzXG4gICAgICAgICAqIGJlY2F1c2UgdGhlIG1lc3NhZ2UgbWlnaHQgYmUgYWxsIGhlYWRlcnMgYW5kIG5vIGJvZHlcbiAgICAgICAgICovXG4gICAgICAgIGlmIChyZXN1bHQuaHR0cFZlcnNpb24pIHtcbiAgICAgICAgICBoZWFkZXJOZXdsaW5lSW5kZXggPSBtZXNzYWdlU3RyaW5nLmxlbmd0aDtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBjb25zdCBoZWFkZXJzU3RyaW5nID0gbWVzc2FnZVN0cmluZy5zdWJzdHIoMCwgaGVhZGVyTmV3bGluZUluZGV4KTtcbiAgICAgIGNvbnN0IGhlYWRlcnMgPSBodHRwTWVzc2FnZVBhcnNlci5fcGFyc2VIZWFkZXJzKGhlYWRlcnNTdHJpbmcpO1xuXG4gICAgICBpZiAoT2JqZWN0LmtleXMoaGVhZGVycykubGVuZ3RoID4gMCkge1xuICAgICAgICByZXN1bHQuaGVhZGVycyA9IGhlYWRlcnM7XG5cbiAgICAgICAgLy8gVE9PRDogZXh0cmFjdCBib3VuZGFyeS5cbiAgICAgIH1cbiAgICB9KSgpO1xuXG4gICAgLyogVHJ5IHRvIGdldCBib3VuZGFyeSBpZiBubyBib3VuZGFyeSBoZWFkZXJcbiAgICAgKi9cbiAgICAoZnVuY3Rpb24oKSB7XG4gICAgICBpZiAoIXJlc3VsdC5ib3VuZGFyeSkge1xuICAgICAgICBjb25zdCBib3VuZGFyeU1hdGNoID0gbWVzc2FnZVN0cmluZy5tYXRjaChodHRwTWVzc2FnZVBhcnNlci5fYm91bmRhcnlSZWdleCk7XG5cbiAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkoYm91bmRhcnlNYXRjaCkgJiYgYm91bmRhcnlNYXRjaC5sZW5ndGgpIHtcbiAgICAgICAgICBmdWxsQm91bmRhcnkgPSBib3VuZGFyeU1hdGNoWzBdLnJlcGxhY2UoL1tcXHJcXG5dKy9naSwgJycpO1xuICAgICAgICAgIGNvbnN0IGJvdW5kYXJ5ID0gZnVsbEJvdW5kYXJ5LnJlcGxhY2UoL14tLS8sJycpO1xuICAgICAgICAgIHJlc3VsdC5ib3VuZGFyeSA9IGJvdW5kYXJ5O1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSkoKTtcblxuICAgIC8qIFBhcnNlIGJvZHlcbiAgICAgKi9cbiAgICAoZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgc3RhcnQgPSBoZWFkZXJOZXdsaW5lSW5kZXg7XG4gICAgICB2YXIgZW5kID0gbWVzc2FnZS5sZW5ndGg7XG4gICAgICBjb25zdCBmaXJzdEJvdW5kYXJ5SW5kZXggPSBtZXNzYWdlU3RyaW5nLmluZGV4T2YoZnVsbEJvdW5kYXJ5KTtcblxuICAgICAgaWYgKGZpcnN0Qm91bmRhcnlJbmRleCA+IC0xKSB7XG4gICAgICAgIHN0YXJ0ID0gaGVhZGVyTmV3bGluZUluZGV4O1xuICAgICAgICBlbmQgPSBmaXJzdEJvdW5kYXJ5SW5kZXg7XG4gICAgICB9XG5cbiAgICAgIGlmIChoZWFkZXJOZXdsaW5lSW5kZXggPiAtMSkge1xuICAgICAgICBjb25zdCBib2R5ID0gbWVzc2FnZS5zbGljZShzdGFydCwgZW5kKTtcblxuICAgICAgICBpZiAoYm9keSAmJiBib2R5Lmxlbmd0aCkge1xuICAgICAgICAgIHJlc3VsdC5ib2R5ID0gaHR0cE1lc3NhZ2VQYXJzZXIuX2lzRmFrZUJ1ZmZlcihib2R5KSA/IGJvZHkudG9TdHJpbmcoKSA6IGJvZHk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9KSgpO1xuXG4gICAgLyogUGFyc2UgbXVsdGlwYXJ0IHNlY3Rpb25zXG4gICAgICovXG4gICAgKGZ1bmN0aW9uKCkge1xuICAgICAgaWYgKHJlc3VsdC5ib3VuZGFyeSkge1xuICAgICAgICBjb25zdCBtdWx0aXBhcnRTdGFydCA9IG1lc3NhZ2VTdHJpbmcuaW5kZXhPZihmdWxsQm91bmRhcnkpICsgZnVsbEJvdW5kYXJ5Lmxlbmd0aDtcbiAgICAgICAgY29uc3QgbXVsdGlwYXJ0RW5kID0gbWVzc2FnZVN0cmluZy5sYXN0SW5kZXhPZihmdWxsQm91bmRhcnkpO1xuICAgICAgICBjb25zdCBtdWx0aXBhcnRCb2R5ID0gbWVzc2FnZVN0cmluZy5zdWJzdHIobXVsdGlwYXJ0U3RhcnQsIG11bHRpcGFydEVuZCk7XG4gICAgICAgIGNvbnN0IHBhcnRzID0gbXVsdGlwYXJ0Qm9keS5zcGxpdChmdWxsQm91bmRhcnkpO1xuXG4gICAgICAgIHJlc3VsdC5tdWx0aXBhcnQgPSBwYXJ0cy5maWx0ZXIoaHR0cE1lc3NhZ2VQYXJzZXIuX2lzVHJ1dGh5KS5tYXAoZnVuY3Rpb24ocGFydCwgaSkge1xuICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IHtcbiAgICAgICAgICAgIGhlYWRlcnM6IG51bGwsXG4gICAgICAgICAgICBib2R5OiBudWxsXG4gICAgICAgICAgfTtcblxuICAgICAgICAgIGNvbnN0IG5ld2xpbmVSZWdleCA9IC9cXG5cXG58XFxyXFxuXFxyXFxuL2dpbTtcbiAgICAgICAgICB2YXIgbmV3bGluZUluZGV4ID0gMDtcbiAgICAgICAgICB2YXIgbmV3bGluZU1hdGNoID0gbmV3bGluZVJlZ2V4LmV4ZWMocGFydCk7XG4gICAgICAgICAgdmFyIGJvZHkgPSBudWxsO1xuXG4gICAgICAgICAgaWYgKG5ld2xpbmVNYXRjaCkge1xuICAgICAgICAgICAgbmV3bGluZUluZGV4ID0gbmV3bGluZU1hdGNoLmluZGV4O1xuICAgICAgICAgICAgaWYgKG5ld2xpbmVNYXRjaC5pbmRleCA8PSAwKSB7XG4gICAgICAgICAgICAgIG5ld2xpbmVNYXRjaCA9IG5ld2xpbmVSZWdleC5leGVjKHBhcnQpO1xuICAgICAgICAgICAgICBpZiAobmV3bGluZU1hdGNoKSB7XG4gICAgICAgICAgICAgICAgbmV3bGluZUluZGV4ID0gbmV3bGluZU1hdGNoLmluZGV4O1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgY29uc3QgcG9zc2libGVIZWFkZXJzU3RyaW5nID0gcGFydC5zdWJzdHIoMCwgbmV3bGluZUluZGV4KTtcblxuICAgICAgICAgIGlmIChuZXdsaW5lSW5kZXggPiAtMSkge1xuICAgICAgICAgICAgY29uc3QgaGVhZGVycyA9IGh0dHBNZXNzYWdlUGFyc2VyLl9wYXJzZUhlYWRlcnMocG9zc2libGVIZWFkZXJzU3RyaW5nKTtcbiAgICAgICAgICAgIGlmIChPYmplY3Qua2V5cyhoZWFkZXJzKS5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgIHJlc3VsdC5oZWFkZXJzID0gaGVhZGVycztcblxuICAgICAgICAgICAgICB2YXIgYm91bmRhcnlJbmRleGVzID0gW107XG4gICAgICAgICAgICAgIGZvciAodmFyIGogPSAwOyBqIDwgbWVzc2FnZS5sZW5ndGg7IGorKykge1xuICAgICAgICAgICAgICAgIHZhciBib3VuZGFyeU1hdGNoID0gbWVzc2FnZS5zbGljZShqLCBqICsgZnVsbEJvdW5kYXJ5Lmxlbmd0aCkudG9TdHJpbmcoKTtcblxuICAgICAgICAgICAgICAgIGlmIChib3VuZGFyeU1hdGNoID09PSBmdWxsQm91bmRhcnkpIHtcbiAgICAgICAgICAgICAgICAgIGJvdW5kYXJ5SW5kZXhlcy5wdXNoKGopO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgIHZhciBib3VuZGFyeU5ld2xpbmVJbmRleGVzID0gW107XG4gICAgICAgICAgICAgIGJvdW5kYXJ5SW5kZXhlcy5zbGljZSgwLCBib3VuZGFyeUluZGV4ZXMubGVuZ3RoIC0gMSkuZm9yRWFjaChmdW5jdGlvbihtLCBrKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgcGFydEJvZHkgPSBtZXNzYWdlLnNsaWNlKGJvdW5kYXJ5SW5kZXhlc1trXSwgYm91bmRhcnlJbmRleGVzW2sgKyAxXSkudG9TdHJpbmcoKTtcbiAgICAgICAgICAgICAgICB2YXIgaGVhZGVyTmV3bGluZUluZGV4ID0gcGFydEJvZHkuc2VhcmNoKC9cXG5cXG58XFxyXFxuXFxyXFxuL2dpbSkgKyAyO1xuICAgICAgICAgICAgICAgIGhlYWRlck5ld2xpbmVJbmRleCAgPSBib3VuZGFyeUluZGV4ZXNba10gKyBoZWFkZXJOZXdsaW5lSW5kZXg7XG4gICAgICAgICAgICAgICAgYm91bmRhcnlOZXdsaW5lSW5kZXhlcy5wdXNoKGhlYWRlck5ld2xpbmVJbmRleCk7XG4gICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgIGJvZHkgPSBtZXNzYWdlLnNsaWNlKGJvdW5kYXJ5TmV3bGluZUluZGV4ZXNbaV0sIGJvdW5kYXJ5SW5kZXhlc1tpICsgMV0pO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgYm9keSA9IHBhcnQ7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGJvZHkgPSBwYXJ0O1xuICAgICAgICAgIH1cblxuICAgICAgICAgIHJlc3VsdC5ib2R5ID0gaHR0cE1lc3NhZ2VQYXJzZXIuX2lzRmFrZUJ1ZmZlcihib2R5KSA/IGJvZHkudG9TdHJpbmcoKSA6IGJvZHk7XG5cbiAgICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9KSgpO1xuXG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIGh0dHBNZXNzYWdlUGFyc2VyLl9pc1RydXRoeSA9IGZ1bmN0aW9uIF9pc1RydXRoeSh2KSB7XG4gICAgcmV0dXJuICEhdjtcbiAgfTtcblxuICBodHRwTWVzc2FnZVBhcnNlci5faXNOdW1lcmljID0gZnVuY3Rpb24gX2lzTnVtZXJpYyh2KSB7XG4gICAgaWYgKHR5cGVvZiB2ID09PSAnbnVtYmVyJyAmJiAhaXNOYU4odikpIHtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIHYgPSAodnx8JycpLnRvU3RyaW5nKCkudHJpbSgpO1xuXG4gICAgaWYgKCF2KSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgcmV0dXJuICFpc05hTih2KTtcbiAgfTtcblxuICBodHRwTWVzc2FnZVBhcnNlci5faXNCdWZmZXIgPSBmdW5jdGlvbihpdGVtKSB7XG4gICAgcmV0dXJuICgoaHR0cE1lc3NhZ2VQYXJzZXIuX2lzTm9kZUJ1ZmZlclN1cHBvcnRlZCgpICYmXG4gICAgICAgICAgICB0eXBlb2YgZ2xvYmFsID09PSAnb2JqZWN0JyAmJlxuICAgICAgICAgICAgZ2xvYmFsLkJ1ZmZlci5pc0J1ZmZlcihpdGVtKSkgfHxcbiAgICAgICAgICAgIChpdGVtIGluc3RhbmNlb2YgT2JqZWN0ICYmXG4gICAgICAgICAgICAgaXRlbS5faXNCdWZmZXIpKTtcbiAgfTtcblxuICBodHRwTWVzc2FnZVBhcnNlci5faXNOb2RlQnVmZmVyU3VwcG9ydGVkID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuICh0eXBlb2YgZ2xvYmFsID09PSAnb2JqZWN0JyAmJlxuICAgICAgICAgICAgdHlwZW9mIGdsb2JhbC5CdWZmZXIgPT09ICdmdW5jdGlvbicgJiZcbiAgICAgICAgICAgIHR5cGVvZiBnbG9iYWwuQnVmZmVyLmlzQnVmZmVyID09PSAnZnVuY3Rpb24nKTtcbiAgfTtcblxuICBodHRwTWVzc2FnZVBhcnNlci5fcGFyc2VIZWFkZXJzID0gZnVuY3Rpb24gX3BhcnNlSGVhZGVycyhib2R5KSB7XG4gICAgY29uc3QgaGVhZGVycyA9IHt9O1xuXG4gICAgaWYgKHR5cGVvZiBib2R5ICE9PSAnc3RyaW5nJykge1xuICAgICAgcmV0dXJuIGhlYWRlcnM7XG4gICAgfVxuXG4gICAgYm9keS5zcGxpdCgvW1xcclxcbl0vKS5mb3JFYWNoKGZ1bmN0aW9uKHN0cmluZykge1xuICAgICAgY29uc3QgbWF0Y2ggPSBzdHJpbmcubWF0Y2goLyhbXFx3LV0rKTpcXHMqKC4qKS9pKTtcblxuICAgICAgaWYgKEFycmF5LmlzQXJyYXkobWF0Y2gpICYmIG1hdGNoLmxlbmd0aCA9PT0gMykge1xuICAgICAgICBjb25zdCBrZXkgPSBtYXRjaFsxXTtcbiAgICAgICAgY29uc3QgdmFsdWUgPSBtYXRjaFsyXTtcblxuICAgICAgICBoZWFkZXJzW2tleV0gPSBodHRwTWVzc2FnZVBhcnNlci5faXNOdW1lcmljKHZhbHVlKSA/IE51bWJlcih2YWx1ZSkgOiB2YWx1ZTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIHJldHVybiBoZWFkZXJzO1xuICB9O1xuXG4gIGh0dHBNZXNzYWdlUGFyc2VyLl9yZXF1ZXN0TGluZVJlZ2V4ID0gL0hUVFBcXC8oMVxcLjB8MVxcLjF8MlxcLjApXFxzKyhcXGQrKVxccysoW1xcd1xccy1fXSspL2k7XG4gIGh0dHBNZXNzYWdlUGFyc2VyLl9yZXNwb25zZUxpbmVSZWdleCA9IC8oR0VUfFBPU1R8UFVUfERFTEVURXxQQVRDSHxPUFRJT05TfEhFQUR8VFJBQ0V8Q09OTkVDVClcXHMrKC4qKVxccytIVFRQXFwvKDFcXC4wfDFcXC4xfDJcXC4wKS9pO1xuICBodHRwTWVzc2FnZVBhcnNlci5faGVhZGVyTmV3bGluZVJlZ2V4ID0gL15bXFxyXFxuXSsvZ2ltO1xuICBodHRwTWVzc2FnZVBhcnNlci5fYm91bmRhcnlSZWdleCA9IC8oXFxufFxcclxcbikrLS1bXFx3LV0rKFxcbnxcXHJcXG4pKy9nO1xuXG4gIGh0dHBNZXNzYWdlUGFyc2VyLl9jcmVhdGVCdWZmZXIgPSBmdW5jdGlvbihkYXRhKSB7XG4gICAgaWYgKGh0dHBNZXNzYWdlUGFyc2VyLl9pc05vZGVCdWZmZXJTdXBwb3J0ZWQoKSkge1xuICAgICAgcmV0dXJuIG5ldyBCdWZmZXIoZGF0YSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIG5ldyBodHRwTWVzc2FnZVBhcnNlci5fRmFrZUJ1ZmZlcihkYXRhKTtcbiAgfTtcblxuICBodHRwTWVzc2FnZVBhcnNlci5faXNGYWtlQnVmZmVyID0gZnVuY3Rpb24gaXNGYWtlQnVmZmVyKG9iaikge1xuICAgIHJldHVybiBvYmogaW5zdGFuY2VvZiBodHRwTWVzc2FnZVBhcnNlci5fRmFrZUJ1ZmZlcjtcbiAgfTtcblxuICBodHRwTWVzc2FnZVBhcnNlci5fRmFrZUJ1ZmZlciA9IGZ1bmN0aW9uIEZha2VCdWZmZXIoZGF0YSkge1xuICAgIGlmICghKHRoaXMgaW5zdGFuY2VvZiBodHRwTWVzc2FnZVBhcnNlci5fRmFrZUJ1ZmZlcikpIHtcbiAgICAgIHJldHVybiBuZXcgaHR0cE1lc3NhZ2VQYXJzZXIuX0Zha2VCdWZmZXIoZGF0YSk7XG4gICAgfVxuXG4gICAgdGhpcy5kYXRhID0gW107XG5cbiAgICBpZiAoQXJyYXkuaXNBcnJheShkYXRhKSkge1xuICAgICAgdGhpcy5kYXRhID0gZGF0YTtcbiAgICB9IGVsc2UgaWYgKHR5cGVvZiBkYXRhID09PSAnc3RyaW5nJykge1xuICAgICAgdGhpcy5kYXRhID0gW10uc2xpY2UuY2FsbChkYXRhKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBMaXZlT2JqZWN0KCkge31cbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoTGl2ZU9iamVjdC5wcm90b3R5cGUsICdsZW5ndGgnLCB7XG4gICAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5kYXRhLmxlbmd0aDtcbiAgICAgIH0uYmluZCh0aGlzKVxuICAgIH0pO1xuXG4gICAgdGhpcy5sZW5ndGggPSAobmV3IExpdmVPYmplY3QoKSkubGVuZ3RoO1xuICB9O1xuXG4gIGh0dHBNZXNzYWdlUGFyc2VyLl9GYWtlQnVmZmVyLnByb3RvdHlwZS5zbGljZSA9IGZ1bmN0aW9uIHNsaWNlKCkge1xuICAgIHZhciBuZXdBcnJheSA9IFtdLnNsaWNlLmFwcGx5KHRoaXMuZGF0YSwgYXJndW1lbnRzKTtcbiAgICByZXR1cm4gbmV3IGh0dHBNZXNzYWdlUGFyc2VyLl9GYWtlQnVmZmVyKG5ld0FycmF5KTtcbiAgfTtcblxuICBodHRwTWVzc2FnZVBhcnNlci5fRmFrZUJ1ZmZlci5wcm90b3R5cGUuc2VhcmNoID0gZnVuY3Rpb24gc2VhcmNoKCkge1xuICAgIHJldHVybiBbXS5zZWFyY2guYXBwbHkodGhpcy5kYXRhLCBhcmd1bWVudHMpO1xuICB9O1xuXG4gIGh0dHBNZXNzYWdlUGFyc2VyLl9GYWtlQnVmZmVyLnByb3RvdHlwZS5pbmRleE9mID0gZnVuY3Rpb24gaW5kZXhPZigpIHtcbiAgICByZXR1cm4gW10uaW5kZXhPZi5hcHBseSh0aGlzLmRhdGEsIGFyZ3VtZW50cyk7XG4gIH07XG5cbiAgaHR0cE1lc3NhZ2VQYXJzZXIuX0Zha2VCdWZmZXIucHJvdG90eXBlLnRvU3RyaW5nID0gZnVuY3Rpb24gdG9TdHJpbmcoKSB7XG4gICAgcmV0dXJuIHRoaXMuZGF0YS5qb2luKCcnKTtcbiAgfTtcblxuICBpZiAodHlwZW9mIGV4cG9ydHMgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgaWYgKHR5cGVvZiBtb2R1bGUgIT09ICd1bmRlZmluZWQnICYmIG1vZHVsZS5leHBvcnRzKSB7XG4gICAgICBleHBvcnRzID0gbW9kdWxlLmV4cG9ydHMgPSBodHRwTWVzc2FnZVBhcnNlcjtcbiAgICB9XG4gICAgZXhwb3J0cy5odHRwTWVzc2FnZVBhcnNlciA9IGh0dHBNZXNzYWdlUGFyc2VyO1xuICB9IGVsc2UgaWYgKHR5cGVvZiBkZWZpbmUgPT09ICdmdW5jdGlvbicgJiYgZGVmaW5lLmFtZCkge1xuICAgIGRlZmluZShbXSwgZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gaHR0cE1lc3NhZ2VQYXJzZXI7XG4gICAgfSk7XG4gIH0gZWxzZSB7XG4gICAgcm9vdC5odHRwTWVzc2FnZVBhcnNlciA9IGh0dHBNZXNzYWdlUGFyc2VyO1xuICB9XG5cbn0pKHRoaXMpO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgU3RyaW5naWZ5ID0gcmVxdWlyZSgnLi9zdHJpbmdpZnknKTtcbnZhciBQYXJzZSA9IHJlcXVpcmUoJy4vcGFyc2UnKTtcblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gICAgc3RyaW5naWZ5OiBTdHJpbmdpZnksXG4gICAgcGFyc2U6IFBhcnNlXG59O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgVXRpbHMgPSByZXF1aXJlKCcuL3V0aWxzJyk7XG5cbnZhciBpbnRlcm5hbHMgPSB7XG4gICAgZGVsaW1pdGVyOiAnJicsXG4gICAgZGVwdGg6IDUsXG4gICAgYXJyYXlMaW1pdDogMjAsXG4gICAgcGFyYW1ldGVyTGltaXQ6IDEwMDAsXG4gICAgc3RyaWN0TnVsbEhhbmRsaW5nOiBmYWxzZSxcbiAgICBwbGFpbk9iamVjdHM6IGZhbHNlLFxuICAgIGFsbG93UHJvdG90eXBlczogZmFsc2UsXG4gICAgYWxsb3dEb3RzOiBmYWxzZVxufTtcblxuaW50ZXJuYWxzLnBhcnNlVmFsdWVzID0gZnVuY3Rpb24gKHN0ciwgb3B0aW9ucykge1xuICAgIHZhciBvYmogPSB7fTtcbiAgICB2YXIgcGFydHMgPSBzdHIuc3BsaXQob3B0aW9ucy5kZWxpbWl0ZXIsIG9wdGlvbnMucGFyYW1ldGVyTGltaXQgPT09IEluZmluaXR5ID8gdW5kZWZpbmVkIDogb3B0aW9ucy5wYXJhbWV0ZXJMaW1pdCk7XG5cbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHBhcnRzLmxlbmd0aDsgKytpKSB7XG4gICAgICAgIHZhciBwYXJ0ID0gcGFydHNbaV07XG4gICAgICAgIHZhciBwb3MgPSBwYXJ0LmluZGV4T2YoJ109JykgPT09IC0xID8gcGFydC5pbmRleE9mKCc9JykgOiBwYXJ0LmluZGV4T2YoJ109JykgKyAxO1xuXG4gICAgICAgIGlmIChwb3MgPT09IC0xKSB7XG4gICAgICAgICAgICBvYmpbVXRpbHMuZGVjb2RlKHBhcnQpXSA9ICcnO1xuXG4gICAgICAgICAgICBpZiAob3B0aW9ucy5zdHJpY3ROdWxsSGFuZGxpbmcpIHtcbiAgICAgICAgICAgICAgICBvYmpbVXRpbHMuZGVjb2RlKHBhcnQpXSA9IG51bGw7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB2YXIga2V5ID0gVXRpbHMuZGVjb2RlKHBhcnQuc2xpY2UoMCwgcG9zKSk7XG4gICAgICAgICAgICB2YXIgdmFsID0gVXRpbHMuZGVjb2RlKHBhcnQuc2xpY2UocG9zICsgMSkpO1xuXG4gICAgICAgICAgICBpZiAoT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKG9iaiwga2V5KSkge1xuICAgICAgICAgICAgICAgIG9ialtrZXldID0gW10uY29uY2F0KG9ialtrZXldKS5jb25jYXQodmFsKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgb2JqW2tleV0gPSB2YWw7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gb2JqO1xufTtcblxuaW50ZXJuYWxzLnBhcnNlT2JqZWN0ID0gZnVuY3Rpb24gKGNoYWluLCB2YWwsIG9wdGlvbnMpIHtcbiAgICBpZiAoIWNoYWluLmxlbmd0aCkge1xuICAgICAgICByZXR1cm4gdmFsO1xuICAgIH1cblxuICAgIHZhciByb290ID0gY2hhaW4uc2hpZnQoKTtcblxuICAgIHZhciBvYmo7XG4gICAgaWYgKHJvb3QgPT09ICdbXScpIHtcbiAgICAgICAgb2JqID0gW107XG4gICAgICAgIG9iaiA9IG9iai5jb25jYXQoaW50ZXJuYWxzLnBhcnNlT2JqZWN0KGNoYWluLCB2YWwsIG9wdGlvbnMpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBvYmogPSBvcHRpb25zLnBsYWluT2JqZWN0cyA/IE9iamVjdC5jcmVhdGUobnVsbCkgOiB7fTtcbiAgICAgICAgdmFyIGNsZWFuUm9vdCA9IHJvb3RbMF0gPT09ICdbJyAmJiByb290W3Jvb3QubGVuZ3RoIC0gMV0gPT09ICddJyA/IHJvb3Quc2xpY2UoMSwgcm9vdC5sZW5ndGggLSAxKSA6IHJvb3Q7XG4gICAgICAgIHZhciBpbmRleCA9IHBhcnNlSW50KGNsZWFuUm9vdCwgMTApO1xuICAgICAgICBpZiAoXG4gICAgICAgICAgICAhaXNOYU4oaW5kZXgpICYmXG4gICAgICAgICAgICByb290ICE9PSBjbGVhblJvb3QgJiZcbiAgICAgICAgICAgIFN0cmluZyhpbmRleCkgPT09IGNsZWFuUm9vdCAmJlxuICAgICAgICAgICAgaW5kZXggPj0gMCAmJlxuICAgICAgICAgICAgKG9wdGlvbnMucGFyc2VBcnJheXMgJiYgaW5kZXggPD0gb3B0aW9ucy5hcnJheUxpbWl0KVxuICAgICAgICApIHtcbiAgICAgICAgICAgIG9iaiA9IFtdO1xuICAgICAgICAgICAgb2JqW2luZGV4XSA9IGludGVybmFscy5wYXJzZU9iamVjdChjaGFpbiwgdmFsLCBvcHRpb25zKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIG9ialtjbGVhblJvb3RdID0gaW50ZXJuYWxzLnBhcnNlT2JqZWN0KGNoYWluLCB2YWwsIG9wdGlvbnMpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIG9iajtcbn07XG5cbmludGVybmFscy5wYXJzZUtleXMgPSBmdW5jdGlvbiAoZ2l2ZW5LZXksIHZhbCwgb3B0aW9ucykge1xuICAgIGlmICghZ2l2ZW5LZXkpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8vIFRyYW5zZm9ybSBkb3Qgbm90YXRpb24gdG8gYnJhY2tldCBub3RhdGlvblxuICAgIHZhciBrZXkgPSBvcHRpb25zLmFsbG93RG90cyA/IGdpdmVuS2V5LnJlcGxhY2UoL1xcLihbXlxcLlxcW10rKS9nLCAnWyQxXScpIDogZ2l2ZW5LZXk7XG5cbiAgICAvLyBUaGUgcmVnZXggY2h1bmtzXG5cbiAgICB2YXIgcGFyZW50ID0gL14oW15cXFtcXF1dKikvO1xuICAgIHZhciBjaGlsZCA9IC8oXFxbW15cXFtcXF1dKlxcXSkvZztcblxuICAgIC8vIEdldCB0aGUgcGFyZW50XG5cbiAgICB2YXIgc2VnbWVudCA9IHBhcmVudC5leGVjKGtleSk7XG5cbiAgICAvLyBTdGFzaCB0aGUgcGFyZW50IGlmIGl0IGV4aXN0c1xuXG4gICAgdmFyIGtleXMgPSBbXTtcbiAgICBpZiAoc2VnbWVudFsxXSkge1xuICAgICAgICAvLyBJZiB3ZSBhcmVuJ3QgdXNpbmcgcGxhaW4gb2JqZWN0cywgb3B0aW9uYWxseSBwcmVmaXgga2V5c1xuICAgICAgICAvLyB0aGF0IHdvdWxkIG92ZXJ3cml0ZSBvYmplY3QgcHJvdG90eXBlIHByb3BlcnRpZXNcbiAgICAgICAgaWYgKCFvcHRpb25zLnBsYWluT2JqZWN0cyAmJiBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5KHNlZ21lbnRbMV0pKSB7XG4gICAgICAgICAgICBpZiAoIW9wdGlvbnMuYWxsb3dQcm90b3R5cGVzKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAga2V5cy5wdXNoKHNlZ21lbnRbMV0pO1xuICAgIH1cblxuICAgIC8vIExvb3AgdGhyb3VnaCBjaGlsZHJlbiBhcHBlbmRpbmcgdG8gdGhlIGFycmF5IHVudGlsIHdlIGhpdCBkZXB0aFxuXG4gICAgdmFyIGkgPSAwO1xuICAgIHdoaWxlICgoc2VnbWVudCA9IGNoaWxkLmV4ZWMoa2V5KSkgIT09IG51bGwgJiYgaSA8IG9wdGlvbnMuZGVwdGgpIHtcbiAgICAgICAgaSArPSAxO1xuICAgICAgICBpZiAoIW9wdGlvbnMucGxhaW5PYmplY3RzICYmIE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkoc2VnbWVudFsxXS5yZXBsYWNlKC9cXFt8XFxdL2csICcnKSkpIHtcbiAgICAgICAgICAgIGlmICghb3B0aW9ucy5hbGxvd1Byb3RvdHlwZXMpIHtcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBrZXlzLnB1c2goc2VnbWVudFsxXSk7XG4gICAgfVxuXG4gICAgLy8gSWYgdGhlcmUncyBhIHJlbWFpbmRlciwganVzdCBhZGQgd2hhdGV2ZXIgaXMgbGVmdFxuXG4gICAgaWYgKHNlZ21lbnQpIHtcbiAgICAgICAga2V5cy5wdXNoKCdbJyArIGtleS5zbGljZShzZWdtZW50LmluZGV4KSArICddJyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGludGVybmFscy5wYXJzZU9iamVjdChrZXlzLCB2YWwsIG9wdGlvbnMpO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAoc3RyLCBvcHRzKSB7XG4gICAgdmFyIG9wdGlvbnMgPSBvcHRzIHx8IHt9O1xuICAgIG9wdGlvbnMuZGVsaW1pdGVyID0gdHlwZW9mIG9wdGlvbnMuZGVsaW1pdGVyID09PSAnc3RyaW5nJyB8fCBVdGlscy5pc1JlZ0V4cChvcHRpb25zLmRlbGltaXRlcikgPyBvcHRpb25zLmRlbGltaXRlciA6IGludGVybmFscy5kZWxpbWl0ZXI7XG4gICAgb3B0aW9ucy5kZXB0aCA9IHR5cGVvZiBvcHRpb25zLmRlcHRoID09PSAnbnVtYmVyJyA/IG9wdGlvbnMuZGVwdGggOiBpbnRlcm5hbHMuZGVwdGg7XG4gICAgb3B0aW9ucy5hcnJheUxpbWl0ID0gdHlwZW9mIG9wdGlvbnMuYXJyYXlMaW1pdCA9PT0gJ251bWJlcicgPyBvcHRpb25zLmFycmF5TGltaXQgOiBpbnRlcm5hbHMuYXJyYXlMaW1pdDtcbiAgICBvcHRpb25zLnBhcnNlQXJyYXlzID0gb3B0aW9ucy5wYXJzZUFycmF5cyAhPT0gZmFsc2U7XG4gICAgb3B0aW9ucy5hbGxvd0RvdHMgPSB0eXBlb2Ygb3B0aW9ucy5hbGxvd0RvdHMgPT09ICdib29sZWFuJyA/IG9wdGlvbnMuYWxsb3dEb3RzIDogaW50ZXJuYWxzLmFsbG93RG90cztcbiAgICBvcHRpb25zLnBsYWluT2JqZWN0cyA9IHR5cGVvZiBvcHRpb25zLnBsYWluT2JqZWN0cyA9PT0gJ2Jvb2xlYW4nID8gb3B0aW9ucy5wbGFpbk9iamVjdHMgOiBpbnRlcm5hbHMucGxhaW5PYmplY3RzO1xuICAgIG9wdGlvbnMuYWxsb3dQcm90b3R5cGVzID0gdHlwZW9mIG9wdGlvbnMuYWxsb3dQcm90b3R5cGVzID09PSAnYm9vbGVhbicgPyBvcHRpb25zLmFsbG93UHJvdG90eXBlcyA6IGludGVybmFscy5hbGxvd1Byb3RvdHlwZXM7XG4gICAgb3B0aW9ucy5wYXJhbWV0ZXJMaW1pdCA9IHR5cGVvZiBvcHRpb25zLnBhcmFtZXRlckxpbWl0ID09PSAnbnVtYmVyJyA/IG9wdGlvbnMucGFyYW1ldGVyTGltaXQgOiBpbnRlcm5hbHMucGFyYW1ldGVyTGltaXQ7XG4gICAgb3B0aW9ucy5zdHJpY3ROdWxsSGFuZGxpbmcgPSB0eXBlb2Ygb3B0aW9ucy5zdHJpY3ROdWxsSGFuZGxpbmcgPT09ICdib29sZWFuJyA/IG9wdGlvbnMuc3RyaWN0TnVsbEhhbmRsaW5nIDogaW50ZXJuYWxzLnN0cmljdE51bGxIYW5kbGluZztcblxuICAgIGlmIChcbiAgICAgICAgc3RyID09PSAnJyB8fFxuICAgICAgICBzdHIgPT09IG51bGwgfHxcbiAgICAgICAgdHlwZW9mIHN0ciA9PT0gJ3VuZGVmaW5lZCdcbiAgICApIHtcbiAgICAgICAgcmV0dXJuIG9wdGlvbnMucGxhaW5PYmplY3RzID8gT2JqZWN0LmNyZWF0ZShudWxsKSA6IHt9O1xuICAgIH1cblxuICAgIHZhciB0ZW1wT2JqID0gdHlwZW9mIHN0ciA9PT0gJ3N0cmluZycgPyBpbnRlcm5hbHMucGFyc2VWYWx1ZXMoc3RyLCBvcHRpb25zKSA6IHN0cjtcbiAgICB2YXIgb2JqID0gb3B0aW9ucy5wbGFpbk9iamVjdHMgPyBPYmplY3QuY3JlYXRlKG51bGwpIDoge307XG5cbiAgICAvLyBJdGVyYXRlIG92ZXIgdGhlIGtleXMgYW5kIHNldHVwIHRoZSBuZXcgb2JqZWN0XG5cbiAgICB2YXIga2V5cyA9IE9iamVjdC5rZXlzKHRlbXBPYmopO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwga2V5cy5sZW5ndGg7ICsraSkge1xuICAgICAgICB2YXIga2V5ID0ga2V5c1tpXTtcbiAgICAgICAgdmFyIG5ld09iaiA9IGludGVybmFscy5wYXJzZUtleXMoa2V5LCB0ZW1wT2JqW2tleV0sIG9wdGlvbnMpO1xuICAgICAgICBvYmogPSBVdGlscy5tZXJnZShvYmosIG5ld09iaiwgb3B0aW9ucyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIFV0aWxzLmNvbXBhY3Qob2JqKTtcbn07XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBVdGlscyA9IHJlcXVpcmUoJy4vdXRpbHMnKTtcblxudmFyIGludGVybmFscyA9IHtcbiAgICBkZWxpbWl0ZXI6ICcmJyxcbiAgICBhcnJheVByZWZpeEdlbmVyYXRvcnM6IHtcbiAgICAgICAgYnJhY2tldHM6IGZ1bmN0aW9uIChwcmVmaXgpIHtcbiAgICAgICAgICAgIHJldHVybiBwcmVmaXggKyAnW10nO1xuICAgICAgICB9LFxuICAgICAgICBpbmRpY2VzOiBmdW5jdGlvbiAocHJlZml4LCBrZXkpIHtcbiAgICAgICAgICAgIHJldHVybiBwcmVmaXggKyAnWycgKyBrZXkgKyAnXSc7XG4gICAgICAgIH0sXG4gICAgICAgIHJlcGVhdDogZnVuY3Rpb24gKHByZWZpeCkge1xuICAgICAgICAgICAgcmV0dXJuIHByZWZpeDtcbiAgICAgICAgfVxuICAgIH0sXG4gICAgc3RyaWN0TnVsbEhhbmRsaW5nOiBmYWxzZSxcbiAgICBza2lwTnVsbHM6IGZhbHNlLFxuICAgIGVuY29kZTogdHJ1ZVxufTtcblxuaW50ZXJuYWxzLnN0cmluZ2lmeSA9IGZ1bmN0aW9uIChvYmplY3QsIHByZWZpeCwgZ2VuZXJhdGVBcnJheVByZWZpeCwgc3RyaWN0TnVsbEhhbmRsaW5nLCBza2lwTnVsbHMsIGVuY29kZSwgZmlsdGVyLCBzb3J0LCBhbGxvd0RvdHMpIHtcbiAgICB2YXIgb2JqID0gb2JqZWN0O1xuICAgIGlmICh0eXBlb2YgZmlsdGVyID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIG9iaiA9IGZpbHRlcihwcmVmaXgsIG9iaik7XG4gICAgfSBlbHNlIGlmIChVdGlscy5pc0J1ZmZlcihvYmopKSB7XG4gICAgICAgIG9iaiA9IFN0cmluZyhvYmopO1xuICAgIH0gZWxzZSBpZiAob2JqIGluc3RhbmNlb2YgRGF0ZSkge1xuICAgICAgICBvYmogPSBvYmoudG9JU09TdHJpbmcoKTtcbiAgICB9IGVsc2UgaWYgKG9iaiA9PT0gbnVsbCkge1xuICAgICAgICBpZiAoc3RyaWN0TnVsbEhhbmRsaW5nKSB7XG4gICAgICAgICAgICByZXR1cm4gZW5jb2RlID8gVXRpbHMuZW5jb2RlKHByZWZpeCkgOiBwcmVmaXg7XG4gICAgICAgIH1cblxuICAgICAgICBvYmogPSAnJztcbiAgICB9XG5cbiAgICBpZiAodHlwZW9mIG9iaiA9PT0gJ3N0cmluZycgfHwgdHlwZW9mIG9iaiA9PT0gJ251bWJlcicgfHwgdHlwZW9mIG9iaiA9PT0gJ2Jvb2xlYW4nKSB7XG4gICAgICAgIGlmIChlbmNvZGUpIHtcbiAgICAgICAgICAgIHJldHVybiBbVXRpbHMuZW5jb2RlKHByZWZpeCkgKyAnPScgKyBVdGlscy5lbmNvZGUob2JqKV07XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIFtwcmVmaXggKyAnPScgKyBvYmpdO1xuICAgIH1cblxuICAgIHZhciB2YWx1ZXMgPSBbXTtcblxuICAgIGlmICh0eXBlb2Ygb2JqID09PSAndW5kZWZpbmVkJykge1xuICAgICAgICByZXR1cm4gdmFsdWVzO1xuICAgIH1cblxuICAgIHZhciBvYmpLZXlzO1xuICAgIGlmIChBcnJheS5pc0FycmF5KGZpbHRlcikpIHtcbiAgICAgICAgb2JqS2V5cyA9IGZpbHRlcjtcbiAgICB9IGVsc2Uge1xuICAgICAgICB2YXIga2V5cyA9IE9iamVjdC5rZXlzKG9iaik7XG4gICAgICAgIG9iaktleXMgPSBzb3J0ID8ga2V5cy5zb3J0KHNvcnQpIDoga2V5cztcbiAgICB9XG5cbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IG9iaktleXMubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgdmFyIGtleSA9IG9iaktleXNbaV07XG5cbiAgICAgICAgaWYgKHNraXBOdWxscyAmJiBvYmpba2V5XSA9PT0gbnVsbCkge1xuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoQXJyYXkuaXNBcnJheShvYmopKSB7XG4gICAgICAgICAgICB2YWx1ZXMgPSB2YWx1ZXMuY29uY2F0KGludGVybmFscy5zdHJpbmdpZnkob2JqW2tleV0sIGdlbmVyYXRlQXJyYXlQcmVmaXgocHJlZml4LCBrZXkpLCBnZW5lcmF0ZUFycmF5UHJlZml4LCBzdHJpY3ROdWxsSGFuZGxpbmcsIHNraXBOdWxscywgZW5jb2RlLCBmaWx0ZXIsIHNvcnQsIGFsbG93RG90cykpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdmFsdWVzID0gdmFsdWVzLmNvbmNhdChpbnRlcm5hbHMuc3RyaW5naWZ5KG9ialtrZXldLCBwcmVmaXggKyAoYWxsb3dEb3RzID8gJy4nICsga2V5IDogJ1snICsga2V5ICsgJ10nKSwgZ2VuZXJhdGVBcnJheVByZWZpeCwgc3RyaWN0TnVsbEhhbmRsaW5nLCBza2lwTnVsbHMsIGVuY29kZSwgZmlsdGVyLCBzb3J0LCBhbGxvd0RvdHMpKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiB2YWx1ZXM7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIChvYmplY3QsIG9wdHMpIHtcbiAgICB2YXIgb2JqID0gb2JqZWN0O1xuICAgIHZhciBvcHRpb25zID0gb3B0cyB8fCB7fTtcbiAgICB2YXIgZGVsaW1pdGVyID0gdHlwZW9mIG9wdGlvbnMuZGVsaW1pdGVyID09PSAndW5kZWZpbmVkJyA/IGludGVybmFscy5kZWxpbWl0ZXIgOiBvcHRpb25zLmRlbGltaXRlcjtcbiAgICB2YXIgc3RyaWN0TnVsbEhhbmRsaW5nID0gdHlwZW9mIG9wdGlvbnMuc3RyaWN0TnVsbEhhbmRsaW5nID09PSAnYm9vbGVhbicgPyBvcHRpb25zLnN0cmljdE51bGxIYW5kbGluZyA6IGludGVybmFscy5zdHJpY3ROdWxsSGFuZGxpbmc7XG4gICAgdmFyIHNraXBOdWxscyA9IHR5cGVvZiBvcHRpb25zLnNraXBOdWxscyA9PT0gJ2Jvb2xlYW4nID8gb3B0aW9ucy5za2lwTnVsbHMgOiBpbnRlcm5hbHMuc2tpcE51bGxzO1xuICAgIHZhciBlbmNvZGUgPSB0eXBlb2Ygb3B0aW9ucy5lbmNvZGUgPT09ICdib29sZWFuJyA/IG9wdGlvbnMuZW5jb2RlIDogaW50ZXJuYWxzLmVuY29kZTtcbiAgICB2YXIgc29ydCA9IHR5cGVvZiBvcHRpb25zLnNvcnQgPT09ICdmdW5jdGlvbicgPyBvcHRpb25zLnNvcnQgOiBudWxsO1xuICAgIHZhciBhbGxvd0RvdHMgPSB0eXBlb2Ygb3B0aW9ucy5hbGxvd0RvdHMgPT09ICd1bmRlZmluZWQnID8gZmFsc2UgOiBvcHRpb25zLmFsbG93RG90cztcbiAgICB2YXIgb2JqS2V5cztcbiAgICB2YXIgZmlsdGVyO1xuICAgIGlmICh0eXBlb2Ygb3B0aW9ucy5maWx0ZXIgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgZmlsdGVyID0gb3B0aW9ucy5maWx0ZXI7XG4gICAgICAgIG9iaiA9IGZpbHRlcignJywgb2JqKTtcbiAgICB9IGVsc2UgaWYgKEFycmF5LmlzQXJyYXkob3B0aW9ucy5maWx0ZXIpKSB7XG4gICAgICAgIG9iaktleXMgPSBmaWx0ZXIgPSBvcHRpb25zLmZpbHRlcjtcbiAgICB9XG5cbiAgICB2YXIga2V5cyA9IFtdO1xuXG4gICAgaWYgKHR5cGVvZiBvYmogIT09ICdvYmplY3QnIHx8IG9iaiA9PT0gbnVsbCkge1xuICAgICAgICByZXR1cm4gJyc7XG4gICAgfVxuXG4gICAgdmFyIGFycmF5Rm9ybWF0O1xuICAgIGlmIChvcHRpb25zLmFycmF5Rm9ybWF0IGluIGludGVybmFscy5hcnJheVByZWZpeEdlbmVyYXRvcnMpIHtcbiAgICAgICAgYXJyYXlGb3JtYXQgPSBvcHRpb25zLmFycmF5Rm9ybWF0O1xuICAgIH0gZWxzZSBpZiAoJ2luZGljZXMnIGluIG9wdGlvbnMpIHtcbiAgICAgICAgYXJyYXlGb3JtYXQgPSBvcHRpb25zLmluZGljZXMgPyAnaW5kaWNlcycgOiAncmVwZWF0JztcbiAgICB9IGVsc2Uge1xuICAgICAgICBhcnJheUZvcm1hdCA9ICdpbmRpY2VzJztcbiAgICB9XG5cbiAgICB2YXIgZ2VuZXJhdGVBcnJheVByZWZpeCA9IGludGVybmFscy5hcnJheVByZWZpeEdlbmVyYXRvcnNbYXJyYXlGb3JtYXRdO1xuXG4gICAgaWYgKCFvYmpLZXlzKSB7XG4gICAgICAgIG9iaktleXMgPSBPYmplY3Qua2V5cyhvYmopO1xuICAgIH1cblxuICAgIGlmIChzb3J0KSB7XG4gICAgICAgIG9iaktleXMuc29ydChzb3J0KTtcbiAgICB9XG5cbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IG9iaktleXMubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgdmFyIGtleSA9IG9iaktleXNbaV07XG5cbiAgICAgICAgaWYgKHNraXBOdWxscyAmJiBvYmpba2V5XSA9PT0gbnVsbCkge1xuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cblxuICAgICAgICBrZXlzID0ga2V5cy5jb25jYXQoaW50ZXJuYWxzLnN0cmluZ2lmeShvYmpba2V5XSwga2V5LCBnZW5lcmF0ZUFycmF5UHJlZml4LCBzdHJpY3ROdWxsSGFuZGxpbmcsIHNraXBOdWxscywgZW5jb2RlLCBmaWx0ZXIsIHNvcnQsIGFsbG93RG90cykpO1xuICAgIH1cblxuICAgIHJldHVybiBrZXlzLmpvaW4oZGVsaW1pdGVyKTtcbn07XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBoZXhUYWJsZSA9IChmdW5jdGlvbiAoKSB7XG4gICAgdmFyIGFycmF5ID0gbmV3IEFycmF5KDI1Nik7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCAyNTY7ICsraSkge1xuICAgICAgICBhcnJheVtpXSA9ICclJyArICgoaSA8IDE2ID8gJzAnIDogJycpICsgaS50b1N0cmluZygxNikpLnRvVXBwZXJDYXNlKCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGFycmF5O1xufSgpKTtcblxuZXhwb3J0cy5hcnJheVRvT2JqZWN0ID0gZnVuY3Rpb24gKHNvdXJjZSwgb3B0aW9ucykge1xuICAgIHZhciBvYmogPSBvcHRpb25zLnBsYWluT2JqZWN0cyA/IE9iamVjdC5jcmVhdGUobnVsbCkgOiB7fTtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHNvdXJjZS5sZW5ndGg7ICsraSkge1xuICAgICAgICBpZiAodHlwZW9mIHNvdXJjZVtpXSAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgIG9ialtpXSA9IHNvdXJjZVtpXTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBvYmo7XG59O1xuXG5leHBvcnRzLm1lcmdlID0gZnVuY3Rpb24gKHRhcmdldCwgc291cmNlLCBvcHRpb25zKSB7XG4gICAgaWYgKCFzb3VyY2UpIHtcbiAgICAgICAgcmV0dXJuIHRhcmdldDtcbiAgICB9XG5cbiAgICBpZiAodHlwZW9mIHNvdXJjZSAhPT0gJ29iamVjdCcpIHtcbiAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkodGFyZ2V0KSkge1xuICAgICAgICAgICAgdGFyZ2V0LnB1c2goc291cmNlKTtcbiAgICAgICAgfSBlbHNlIGlmICh0eXBlb2YgdGFyZ2V0ID09PSAnb2JqZWN0Jykge1xuICAgICAgICAgICAgdGFyZ2V0W3NvdXJjZV0gPSB0cnVlO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIFt0YXJnZXQsIHNvdXJjZV07XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gdGFyZ2V0O1xuICAgIH1cblxuICAgIGlmICh0eXBlb2YgdGFyZ2V0ICE9PSAnb2JqZWN0Jykge1xuICAgICAgICByZXR1cm4gW3RhcmdldF0uY29uY2F0KHNvdXJjZSk7XG4gICAgfVxuXG4gICAgdmFyIG1lcmdlVGFyZ2V0ID0gdGFyZ2V0O1xuICAgIGlmIChBcnJheS5pc0FycmF5KHRhcmdldCkgJiYgIUFycmF5LmlzQXJyYXkoc291cmNlKSkge1xuICAgICAgICBtZXJnZVRhcmdldCA9IGV4cG9ydHMuYXJyYXlUb09iamVjdCh0YXJnZXQsIG9wdGlvbnMpO1xuICAgIH1cblxuXHRyZXR1cm4gT2JqZWN0LmtleXMoc291cmNlKS5yZWR1Y2UoZnVuY3Rpb24gKGFjYywga2V5KSB7XG4gICAgICAgIHZhciB2YWx1ZSA9IHNvdXJjZVtrZXldO1xuXG4gICAgICAgIGlmIChPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwoYWNjLCBrZXkpKSB7XG4gICAgICAgICAgICBhY2Nba2V5XSA9IGV4cG9ydHMubWVyZ2UoYWNjW2tleV0sIHZhbHVlLCBvcHRpb25zKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGFjY1trZXldID0gdmFsdWU7XG4gICAgICAgIH1cblx0XHRyZXR1cm4gYWNjO1xuICAgIH0sIG1lcmdlVGFyZ2V0KTtcbn07XG5cbmV4cG9ydHMuZGVjb2RlID0gZnVuY3Rpb24gKHN0cikge1xuICAgIHRyeSB7XG4gICAgICAgIHJldHVybiBkZWNvZGVVUklDb21wb25lbnQoc3RyLnJlcGxhY2UoL1xcKy9nLCAnICcpKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIHJldHVybiBzdHI7XG4gICAgfVxufTtcblxuZXhwb3J0cy5lbmNvZGUgPSBmdW5jdGlvbiAoc3RyKSB7XG4gICAgLy8gVGhpcyBjb2RlIHdhcyBvcmlnaW5hbGx5IHdyaXR0ZW4gYnkgQnJpYW4gV2hpdGUgKG1zY2RleCkgZm9yIHRoZSBpby5qcyBjb3JlIHF1ZXJ5c3RyaW5nIGxpYnJhcnkuXG4gICAgLy8gSXQgaGFzIGJlZW4gYWRhcHRlZCBoZXJlIGZvciBzdHJpY3RlciBhZGhlcmVuY2UgdG8gUkZDIDM5ODZcbiAgICBpZiAoc3RyLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICByZXR1cm4gc3RyO1xuICAgIH1cblxuICAgIHZhciBzdHJpbmcgPSB0eXBlb2Ygc3RyID09PSAnc3RyaW5nJyA/IHN0ciA6IFN0cmluZyhzdHIpO1xuXG4gICAgdmFyIG91dCA9ICcnO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgc3RyaW5nLmxlbmd0aDsgKytpKSB7XG4gICAgICAgIHZhciBjID0gc3RyaW5nLmNoYXJDb2RlQXQoaSk7XG5cbiAgICAgICAgaWYgKFxuICAgICAgICAgICAgYyA9PT0gMHgyRCB8fCAvLyAtXG4gICAgICAgICAgICBjID09PSAweDJFIHx8IC8vIC5cbiAgICAgICAgICAgIGMgPT09IDB4NUYgfHwgLy8gX1xuICAgICAgICAgICAgYyA9PT0gMHg3RSB8fCAvLyB+XG4gICAgICAgICAgICAoYyA+PSAweDMwICYmIGMgPD0gMHgzOSkgfHwgLy8gMC05XG4gICAgICAgICAgICAoYyA+PSAweDQxICYmIGMgPD0gMHg1QSkgfHwgLy8gYS16XG4gICAgICAgICAgICAoYyA+PSAweDYxICYmIGMgPD0gMHg3QSkgLy8gQS1aXG4gICAgICAgICkge1xuICAgICAgICAgICAgb3V0ICs9IHN0cmluZy5jaGFyQXQoaSk7XG4gICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChjIDwgMHg4MCkge1xuICAgICAgICAgICAgb3V0ID0gb3V0ICsgaGV4VGFibGVbY107XG4gICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChjIDwgMHg4MDApIHtcbiAgICAgICAgICAgIG91dCA9IG91dCArIChoZXhUYWJsZVsweEMwIHwgKGMgPj4gNildICsgaGV4VGFibGVbMHg4MCB8IChjICYgMHgzRildKTtcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGMgPCAweEQ4MDAgfHwgYyA+PSAweEUwMDApIHtcbiAgICAgICAgICAgIG91dCA9IG91dCArIChoZXhUYWJsZVsweEUwIHwgKGMgPj4gMTIpXSArIGhleFRhYmxlWzB4ODAgfCAoKGMgPj4gNikgJiAweDNGKV0gKyBoZXhUYWJsZVsweDgwIHwgKGMgJiAweDNGKV0pO1xuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cblxuICAgICAgICBpICs9IDE7XG4gICAgICAgIGMgPSAweDEwMDAwICsgKCgoYyAmIDB4M0ZGKSA8PCAxMCkgfCAoc3RyaW5nLmNoYXJDb2RlQXQoaSkgJiAweDNGRikpO1xuICAgICAgICBvdXQgKz0gKGhleFRhYmxlWzB4RjAgfCAoYyA+PiAxOCldICsgaGV4VGFibGVbMHg4MCB8ICgoYyA+PiAxMikgJiAweDNGKV0gKyBoZXhUYWJsZVsweDgwIHwgKChjID4+IDYpICYgMHgzRildICsgaGV4VGFibGVbMHg4MCB8IChjICYgMHgzRildKTtcbiAgICB9XG5cbiAgICByZXR1cm4gb3V0O1xufTtcblxuZXhwb3J0cy5jb21wYWN0ID0gZnVuY3Rpb24gKG9iaiwgcmVmZXJlbmNlcykge1xuICAgIGlmICh0eXBlb2Ygb2JqICE9PSAnb2JqZWN0JyB8fCBvYmogPT09IG51bGwpIHtcbiAgICAgICAgcmV0dXJuIG9iajtcbiAgICB9XG5cbiAgICB2YXIgcmVmcyA9IHJlZmVyZW5jZXMgfHwgW107XG4gICAgdmFyIGxvb2t1cCA9IHJlZnMuaW5kZXhPZihvYmopO1xuICAgIGlmIChsb29rdXAgIT09IC0xKSB7XG4gICAgICAgIHJldHVybiByZWZzW2xvb2t1cF07XG4gICAgfVxuXG4gICAgcmVmcy5wdXNoKG9iaik7XG5cbiAgICBpZiAoQXJyYXkuaXNBcnJheShvYmopKSB7XG4gICAgICAgIHZhciBjb21wYWN0ZWQgPSBbXTtcblxuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IG9iai5sZW5ndGg7ICsraSkge1xuICAgICAgICAgICAgaWYgKHR5cGVvZiBvYmpbaV0gIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICAgICAgY29tcGFjdGVkLnB1c2gob2JqW2ldKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBjb21wYWN0ZWQ7XG4gICAgfVxuXG4gICAgdmFyIGtleXMgPSBPYmplY3Qua2V5cyhvYmopO1xuICAgIGZvciAodmFyIGogPSAwOyBqIDwga2V5cy5sZW5ndGg7ICsraikge1xuICAgICAgICB2YXIga2V5ID0ga2V5c1tqXTtcbiAgICAgICAgb2JqW2tleV0gPSBleHBvcnRzLmNvbXBhY3Qob2JqW2tleV0sIHJlZnMpO1xuICAgIH1cblxuICAgIHJldHVybiBvYmo7XG59O1xuXG5leHBvcnRzLmlzUmVnRXhwID0gZnVuY3Rpb24gKG9iaikge1xuICAgIHJldHVybiBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwob2JqKSA9PT0gJ1tvYmplY3QgUmVnRXhwXSc7XG59O1xuXG5leHBvcnRzLmlzQnVmZmVyID0gZnVuY3Rpb24gKG9iaikge1xuICAgIGlmIChvYmogPT09IG51bGwgfHwgdHlwZW9mIG9iaiA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIHJldHVybiAhIShvYmouY29uc3RydWN0b3IgJiYgb2JqLmNvbnN0cnVjdG9yLmlzQnVmZmVyICYmIG9iai5jb25zdHJ1Y3Rvci5pc0J1ZmZlcihvYmopKTtcbn07XG4iLCIvKiFcbiAqIFRoZSBidWZmZXIgbW9kdWxlIGZyb20gbm9kZS5qcywgZm9yIHRoZSBicm93c2VyLlxuICpcbiAqIEBhdXRob3IgICBGZXJvc3MgQWJvdWtoYWRpamVoIDxmZXJvc3NAZmVyb3NzLm9yZz4gPGh0dHA6Ly9mZXJvc3Mub3JnPlxuICogQGxpY2Vuc2UgIE1JVFxuICovXG4vKiBlc2xpbnQtZGlzYWJsZSBuby1wcm90byAqL1xuXG4ndXNlIHN0cmljdCdcblxudmFyIGJhc2U2NCA9IHJlcXVpcmUoJ2Jhc2U2NC1qcycpXG52YXIgaWVlZTc1NCA9IHJlcXVpcmUoJ2llZWU3NTQnKVxudmFyIGlzQXJyYXkgPSByZXF1aXJlKCdpc2FycmF5JylcblxuZXhwb3J0cy5CdWZmZXIgPSBCdWZmZXJcbmV4cG9ydHMuU2xvd0J1ZmZlciA9IFNsb3dCdWZmZXJcbmV4cG9ydHMuSU5TUEVDVF9NQVhfQllURVMgPSA1MFxuQnVmZmVyLnBvb2xTaXplID0gODE5MiAvLyBub3QgdXNlZCBieSB0aGlzIGltcGxlbWVudGF0aW9uXG5cbnZhciByb290UGFyZW50ID0ge31cblxuLyoqXG4gKiBJZiBgQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlRgOlxuICogICA9PT0gdHJ1ZSAgICBVc2UgVWludDhBcnJheSBpbXBsZW1lbnRhdGlvbiAoZmFzdGVzdClcbiAqICAgPT09IGZhbHNlICAgVXNlIE9iamVjdCBpbXBsZW1lbnRhdGlvbiAobW9zdCBjb21wYXRpYmxlLCBldmVuIElFNilcbiAqXG4gKiBCcm93c2VycyB0aGF0IHN1cHBvcnQgdHlwZWQgYXJyYXlzIGFyZSBJRSAxMCssIEZpcmVmb3ggNCssIENocm9tZSA3KywgU2FmYXJpIDUuMSssXG4gKiBPcGVyYSAxMS42KywgaU9TIDQuMisuXG4gKlxuICogRHVlIHRvIHZhcmlvdXMgYnJvd3NlciBidWdzLCBzb21ldGltZXMgdGhlIE9iamVjdCBpbXBsZW1lbnRhdGlvbiB3aWxsIGJlIHVzZWQgZXZlblxuICogd2hlbiB0aGUgYnJvd3NlciBzdXBwb3J0cyB0eXBlZCBhcnJheXMuXG4gKlxuICogTm90ZTpcbiAqXG4gKiAgIC0gRmlyZWZveCA0LTI5IGxhY2tzIHN1cHBvcnQgZm9yIGFkZGluZyBuZXcgcHJvcGVydGllcyB0byBgVWludDhBcnJheWAgaW5zdGFuY2VzLFxuICogICAgIFNlZTogaHR0cHM6Ly9idWd6aWxsYS5tb3ppbGxhLm9yZy9zaG93X2J1Zy5jZ2k/aWQ9Njk1NDM4LlxuICpcbiAqICAgLSBDaHJvbWUgOS0xMCBpcyBtaXNzaW5nIHRoZSBgVHlwZWRBcnJheS5wcm90b3R5cGUuc3ViYXJyYXlgIGZ1bmN0aW9uLlxuICpcbiAqICAgLSBJRTEwIGhhcyBhIGJyb2tlbiBgVHlwZWRBcnJheS5wcm90b3R5cGUuc3ViYXJyYXlgIGZ1bmN0aW9uIHdoaWNoIHJldHVybnMgYXJyYXlzIG9mXG4gKiAgICAgaW5jb3JyZWN0IGxlbmd0aCBpbiBzb21lIHNpdHVhdGlvbnMuXG5cbiAqIFdlIGRldGVjdCB0aGVzZSBidWdneSBicm93c2VycyBhbmQgc2V0IGBCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVGAgdG8gYGZhbHNlYCBzbyB0aGV5XG4gKiBnZXQgdGhlIE9iamVjdCBpbXBsZW1lbnRhdGlvbiwgd2hpY2ggaXMgc2xvd2VyIGJ1dCBiZWhhdmVzIGNvcnJlY3RseS5cbiAqL1xuQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQgPSBnbG9iYWwuVFlQRURfQVJSQVlfU1VQUE9SVCAhPT0gdW5kZWZpbmVkXG4gID8gZ2xvYmFsLlRZUEVEX0FSUkFZX1NVUFBPUlRcbiAgOiB0eXBlZEFycmF5U3VwcG9ydCgpXG5cbmZ1bmN0aW9uIHR5cGVkQXJyYXlTdXBwb3J0ICgpIHtcbiAgdHJ5IHtcbiAgICB2YXIgYXJyID0gbmV3IFVpbnQ4QXJyYXkoMSlcbiAgICBhcnIuZm9vID0gZnVuY3Rpb24gKCkgeyByZXR1cm4gNDIgfVxuICAgIHJldHVybiBhcnIuZm9vKCkgPT09IDQyICYmIC8vIHR5cGVkIGFycmF5IGluc3RhbmNlcyBjYW4gYmUgYXVnbWVudGVkXG4gICAgICAgIHR5cGVvZiBhcnIuc3ViYXJyYXkgPT09ICdmdW5jdGlvbicgJiYgLy8gY2hyb21lIDktMTAgbGFjayBgc3ViYXJyYXlgXG4gICAgICAgIGFyci5zdWJhcnJheSgxLCAxKS5ieXRlTGVuZ3RoID09PSAwIC8vIGllMTAgaGFzIGJyb2tlbiBgc3ViYXJyYXlgXG4gIH0gY2F0Y2ggKGUpIHtcbiAgICByZXR1cm4gZmFsc2VcbiAgfVxufVxuXG5mdW5jdGlvbiBrTWF4TGVuZ3RoICgpIHtcbiAgcmV0dXJuIEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUXG4gICAgPyAweDdmZmZmZmZmXG4gICAgOiAweDNmZmZmZmZmXG59XG5cbi8qKlxuICogVGhlIEJ1ZmZlciBjb25zdHJ1Y3RvciByZXR1cm5zIGluc3RhbmNlcyBvZiBgVWludDhBcnJheWAgdGhhdCBoYXZlIHRoZWlyXG4gKiBwcm90b3R5cGUgY2hhbmdlZCB0byBgQnVmZmVyLnByb3RvdHlwZWAuIEZ1cnRoZXJtb3JlLCBgQnVmZmVyYCBpcyBhIHN1YmNsYXNzIG9mXG4gKiBgVWludDhBcnJheWAsIHNvIHRoZSByZXR1cm5lZCBpbnN0YW5jZXMgd2lsbCBoYXZlIGFsbCB0aGUgbm9kZSBgQnVmZmVyYCBtZXRob2RzXG4gKiBhbmQgdGhlIGBVaW50OEFycmF5YCBtZXRob2RzLiBTcXVhcmUgYnJhY2tldCBub3RhdGlvbiB3b3JrcyBhcyBleHBlY3RlZCAtLSBpdFxuICogcmV0dXJucyBhIHNpbmdsZSBvY3RldC5cbiAqXG4gKiBUaGUgYFVpbnQ4QXJyYXlgIHByb3RvdHlwZSByZW1haW5zIHVubW9kaWZpZWQuXG4gKi9cbmZ1bmN0aW9uIEJ1ZmZlciAoYXJnKSB7XG4gIGlmICghKHRoaXMgaW5zdGFuY2VvZiBCdWZmZXIpKSB7XG4gICAgLy8gQXZvaWQgZ29pbmcgdGhyb3VnaCBhbiBBcmd1bWVudHNBZGFwdG9yVHJhbXBvbGluZSBpbiB0aGUgY29tbW9uIGNhc2UuXG4gICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPiAxKSByZXR1cm4gbmV3IEJ1ZmZlcihhcmcsIGFyZ3VtZW50c1sxXSlcbiAgICByZXR1cm4gbmV3IEJ1ZmZlcihhcmcpXG4gIH1cblxuICBpZiAoIUJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgdGhpcy5sZW5ndGggPSAwXG4gICAgdGhpcy5wYXJlbnQgPSB1bmRlZmluZWRcbiAgfVxuXG4gIC8vIENvbW1vbiBjYXNlLlxuICBpZiAodHlwZW9mIGFyZyA9PT0gJ251bWJlcicpIHtcbiAgICByZXR1cm4gZnJvbU51bWJlcih0aGlzLCBhcmcpXG4gIH1cblxuICAvLyBTbGlnaHRseSBsZXNzIGNvbW1vbiBjYXNlLlxuICBpZiAodHlwZW9mIGFyZyA9PT0gJ3N0cmluZycpIHtcbiAgICByZXR1cm4gZnJvbVN0cmluZyh0aGlzLCBhcmcsIGFyZ3VtZW50cy5sZW5ndGggPiAxID8gYXJndW1lbnRzWzFdIDogJ3V0ZjgnKVxuICB9XG5cbiAgLy8gVW51c3VhbC5cbiAgcmV0dXJuIGZyb21PYmplY3QodGhpcywgYXJnKVxufVxuXG4vLyBUT0RPOiBMZWdhY3ksIG5vdCBuZWVkZWQgYW55bW9yZS4gUmVtb3ZlIGluIG5leHQgbWFqb3IgdmVyc2lvbi5cbkJ1ZmZlci5fYXVnbWVudCA9IGZ1bmN0aW9uIChhcnIpIHtcbiAgYXJyLl9fcHJvdG9fXyA9IEJ1ZmZlci5wcm90b3R5cGVcbiAgcmV0dXJuIGFyclxufVxuXG5mdW5jdGlvbiBmcm9tTnVtYmVyICh0aGF0LCBsZW5ndGgpIHtcbiAgdGhhdCA9IGFsbG9jYXRlKHRoYXQsIGxlbmd0aCA8IDAgPyAwIDogY2hlY2tlZChsZW5ndGgpIHwgMClcbiAgaWYgKCFCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkge1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAgIHRoYXRbaV0gPSAwXG4gICAgfVxuICB9XG4gIHJldHVybiB0aGF0XG59XG5cbmZ1bmN0aW9uIGZyb21TdHJpbmcgKHRoYXQsIHN0cmluZywgZW5jb2RpbmcpIHtcbiAgaWYgKHR5cGVvZiBlbmNvZGluZyAhPT0gJ3N0cmluZycgfHwgZW5jb2RpbmcgPT09ICcnKSBlbmNvZGluZyA9ICd1dGY4J1xuXG4gIC8vIEFzc3VtcHRpb246IGJ5dGVMZW5ndGgoKSByZXR1cm4gdmFsdWUgaXMgYWx3YXlzIDwga01heExlbmd0aC5cbiAgdmFyIGxlbmd0aCA9IGJ5dGVMZW5ndGgoc3RyaW5nLCBlbmNvZGluZykgfCAwXG4gIHRoYXQgPSBhbGxvY2F0ZSh0aGF0LCBsZW5ndGgpXG5cbiAgdGhhdC53cml0ZShzdHJpbmcsIGVuY29kaW5nKVxuICByZXR1cm4gdGhhdFxufVxuXG5mdW5jdGlvbiBmcm9tT2JqZWN0ICh0aGF0LCBvYmplY3QpIHtcbiAgaWYgKEJ1ZmZlci5pc0J1ZmZlcihvYmplY3QpKSByZXR1cm4gZnJvbUJ1ZmZlcih0aGF0LCBvYmplY3QpXG5cbiAgaWYgKGlzQXJyYXkob2JqZWN0KSkgcmV0dXJuIGZyb21BcnJheSh0aGF0LCBvYmplY3QpXG5cbiAgaWYgKG9iamVjdCA9PSBudWxsKSB7XG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcignbXVzdCBzdGFydCB3aXRoIG51bWJlciwgYnVmZmVyLCBhcnJheSBvciBzdHJpbmcnKVxuICB9XG5cbiAgaWYgKHR5cGVvZiBBcnJheUJ1ZmZlciAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICBpZiAob2JqZWN0LmJ1ZmZlciBpbnN0YW5jZW9mIEFycmF5QnVmZmVyKSB7XG4gICAgICByZXR1cm4gZnJvbVR5cGVkQXJyYXkodGhhdCwgb2JqZWN0KVxuICAgIH1cbiAgICBpZiAob2JqZWN0IGluc3RhbmNlb2YgQXJyYXlCdWZmZXIpIHtcbiAgICAgIHJldHVybiBmcm9tQXJyYXlCdWZmZXIodGhhdCwgb2JqZWN0KVxuICAgIH1cbiAgfVxuXG4gIGlmIChvYmplY3QubGVuZ3RoKSByZXR1cm4gZnJvbUFycmF5TGlrZSh0aGF0LCBvYmplY3QpXG5cbiAgcmV0dXJuIGZyb21Kc29uT2JqZWN0KHRoYXQsIG9iamVjdClcbn1cblxuZnVuY3Rpb24gZnJvbUJ1ZmZlciAodGhhdCwgYnVmZmVyKSB7XG4gIHZhciBsZW5ndGggPSBjaGVja2VkKGJ1ZmZlci5sZW5ndGgpIHwgMFxuICB0aGF0ID0gYWxsb2NhdGUodGhhdCwgbGVuZ3RoKVxuICBidWZmZXIuY29weSh0aGF0LCAwLCAwLCBsZW5ndGgpXG4gIHJldHVybiB0aGF0XG59XG5cbmZ1bmN0aW9uIGZyb21BcnJheSAodGhhdCwgYXJyYXkpIHtcbiAgdmFyIGxlbmd0aCA9IGNoZWNrZWQoYXJyYXkubGVuZ3RoKSB8IDBcbiAgdGhhdCA9IGFsbG9jYXRlKHRoYXQsIGxlbmd0aClcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7IGkgKz0gMSkge1xuICAgIHRoYXRbaV0gPSBhcnJheVtpXSAmIDI1NVxuICB9XG4gIHJldHVybiB0aGF0XG59XG5cbi8vIER1cGxpY2F0ZSBvZiBmcm9tQXJyYXkoKSB0byBrZWVwIGZyb21BcnJheSgpIG1vbm9tb3JwaGljLlxuZnVuY3Rpb24gZnJvbVR5cGVkQXJyYXkgKHRoYXQsIGFycmF5KSB7XG4gIHZhciBsZW5ndGggPSBjaGVja2VkKGFycmF5Lmxlbmd0aCkgfCAwXG4gIHRoYXQgPSBhbGxvY2F0ZSh0aGF0LCBsZW5ndGgpXG4gIC8vIFRydW5jYXRpbmcgdGhlIGVsZW1lbnRzIGlzIHByb2JhYmx5IG5vdCB3aGF0IHBlb3BsZSBleHBlY3QgZnJvbSB0eXBlZFxuICAvLyBhcnJheXMgd2l0aCBCWVRFU19QRVJfRUxFTUVOVCA+IDEgYnV0IGl0J3MgY29tcGF0aWJsZSB3aXRoIHRoZSBiZWhhdmlvclxuICAvLyBvZiB0aGUgb2xkIEJ1ZmZlciBjb25zdHJ1Y3Rvci5cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7IGkgKz0gMSkge1xuICAgIHRoYXRbaV0gPSBhcnJheVtpXSAmIDI1NVxuICB9XG4gIHJldHVybiB0aGF0XG59XG5cbmZ1bmN0aW9uIGZyb21BcnJheUJ1ZmZlciAodGhhdCwgYXJyYXkpIHtcbiAgYXJyYXkuYnl0ZUxlbmd0aCAvLyB0aGlzIHRocm93cyBpZiBgYXJyYXlgIGlzIG5vdCBhIHZhbGlkIEFycmF5QnVmZmVyXG5cbiAgaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgLy8gUmV0dXJuIGFuIGF1Z21lbnRlZCBgVWludDhBcnJheWAgaW5zdGFuY2UsIGZvciBiZXN0IHBlcmZvcm1hbmNlXG4gICAgdGhhdCA9IG5ldyBVaW50OEFycmF5KGFycmF5KVxuICAgIHRoYXQuX19wcm90b19fID0gQnVmZmVyLnByb3RvdHlwZVxuICB9IGVsc2Uge1xuICAgIC8vIEZhbGxiYWNrOiBSZXR1cm4gYW4gb2JqZWN0IGluc3RhbmNlIG9mIHRoZSBCdWZmZXIgY2xhc3NcbiAgICB0aGF0ID0gZnJvbVR5cGVkQXJyYXkodGhhdCwgbmV3IFVpbnQ4QXJyYXkoYXJyYXkpKVxuICB9XG4gIHJldHVybiB0aGF0XG59XG5cbmZ1bmN0aW9uIGZyb21BcnJheUxpa2UgKHRoYXQsIGFycmF5KSB7XG4gIHZhciBsZW5ndGggPSBjaGVja2VkKGFycmF5Lmxlbmd0aCkgfCAwXG4gIHRoYXQgPSBhbGxvY2F0ZSh0aGF0LCBsZW5ndGgpXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuZ3RoOyBpICs9IDEpIHtcbiAgICB0aGF0W2ldID0gYXJyYXlbaV0gJiAyNTVcbiAgfVxuICByZXR1cm4gdGhhdFxufVxuXG4vLyBEZXNlcmlhbGl6ZSB7IHR5cGU6ICdCdWZmZXInLCBkYXRhOiBbMSwyLDMsLi4uXSB9IGludG8gYSBCdWZmZXIgb2JqZWN0LlxuLy8gUmV0dXJucyBhIHplcm8tbGVuZ3RoIGJ1ZmZlciBmb3IgaW5wdXRzIHRoYXQgZG9uJ3QgY29uZm9ybSB0byB0aGUgc3BlYy5cbmZ1bmN0aW9uIGZyb21Kc29uT2JqZWN0ICh0aGF0LCBvYmplY3QpIHtcbiAgdmFyIGFycmF5XG4gIHZhciBsZW5ndGggPSAwXG5cbiAgaWYgKG9iamVjdC50eXBlID09PSAnQnVmZmVyJyAmJiBpc0FycmF5KG9iamVjdC5kYXRhKSkge1xuICAgIGFycmF5ID0gb2JqZWN0LmRhdGFcbiAgICBsZW5ndGggPSBjaGVja2VkKGFycmF5Lmxlbmd0aCkgfCAwXG4gIH1cbiAgdGhhdCA9IGFsbG9jYXRlKHRoYXQsIGxlbmd0aClcblxuICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbmd0aDsgaSArPSAxKSB7XG4gICAgdGhhdFtpXSA9IGFycmF5W2ldICYgMjU1XG4gIH1cbiAgcmV0dXJuIHRoYXRcbn1cblxuaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gIEJ1ZmZlci5wcm90b3R5cGUuX19wcm90b19fID0gVWludDhBcnJheS5wcm90b3R5cGVcbiAgQnVmZmVyLl9fcHJvdG9fXyA9IFVpbnQ4QXJyYXlcbiAgaWYgKHR5cGVvZiBTeW1ib2wgIT09ICd1bmRlZmluZWQnICYmIFN5bWJvbC5zcGVjaWVzICYmXG4gICAgICBCdWZmZXJbU3ltYm9sLnNwZWNpZXNdID09PSBCdWZmZXIpIHtcbiAgICAvLyBGaXggc3ViYXJyYXkoKSBpbiBFUzIwMTYuIFNlZTogaHR0cHM6Ly9naXRodWIuY29tL2Zlcm9zcy9idWZmZXIvcHVsbC85N1xuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShCdWZmZXIsIFN5bWJvbC5zcGVjaWVzLCB7XG4gICAgICB2YWx1ZTogbnVsbCxcbiAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZVxuICAgIH0pXG4gIH1cbn0gZWxzZSB7XG4gIC8vIHByZS1zZXQgZm9yIHZhbHVlcyB0aGF0IG1heSBleGlzdCBpbiB0aGUgZnV0dXJlXG4gIEJ1ZmZlci5wcm90b3R5cGUubGVuZ3RoID0gdW5kZWZpbmVkXG4gIEJ1ZmZlci5wcm90b3R5cGUucGFyZW50ID0gdW5kZWZpbmVkXG59XG5cbmZ1bmN0aW9uIGFsbG9jYXRlICh0aGF0LCBsZW5ndGgpIHtcbiAgaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgLy8gUmV0dXJuIGFuIGF1Z21lbnRlZCBgVWludDhBcnJheWAgaW5zdGFuY2UsIGZvciBiZXN0IHBlcmZvcm1hbmNlXG4gICAgdGhhdCA9IG5ldyBVaW50OEFycmF5KGxlbmd0aClcbiAgICB0aGF0Ll9fcHJvdG9fXyA9IEJ1ZmZlci5wcm90b3R5cGVcbiAgfSBlbHNlIHtcbiAgICAvLyBGYWxsYmFjazogUmV0dXJuIGFuIG9iamVjdCBpbnN0YW5jZSBvZiB0aGUgQnVmZmVyIGNsYXNzXG4gICAgdGhhdC5sZW5ndGggPSBsZW5ndGhcbiAgfVxuXG4gIHZhciBmcm9tUG9vbCA9IGxlbmd0aCAhPT0gMCAmJiBsZW5ndGggPD0gQnVmZmVyLnBvb2xTaXplID4+PiAxXG4gIGlmIChmcm9tUG9vbCkgdGhhdC5wYXJlbnQgPSByb290UGFyZW50XG5cbiAgcmV0dXJuIHRoYXRcbn1cblxuZnVuY3Rpb24gY2hlY2tlZCAobGVuZ3RoKSB7XG4gIC8vIE5vdGU6IGNhbm5vdCB1c2UgYGxlbmd0aCA8IGtNYXhMZW5ndGhgIGhlcmUgYmVjYXVzZSB0aGF0IGZhaWxzIHdoZW5cbiAgLy8gbGVuZ3RoIGlzIE5hTiAod2hpY2ggaXMgb3RoZXJ3aXNlIGNvZXJjZWQgdG8gemVyby4pXG4gIGlmIChsZW5ndGggPj0ga01heExlbmd0aCgpKSB7XG4gICAgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ0F0dGVtcHQgdG8gYWxsb2NhdGUgQnVmZmVyIGxhcmdlciB0aGFuIG1heGltdW0gJyArXG4gICAgICAgICAgICAgICAgICAgICAgICAgJ3NpemU6IDB4JyArIGtNYXhMZW5ndGgoKS50b1N0cmluZygxNikgKyAnIGJ5dGVzJylcbiAgfVxuICByZXR1cm4gbGVuZ3RoIHwgMFxufVxuXG5mdW5jdGlvbiBTbG93QnVmZmVyIChzdWJqZWN0LCBlbmNvZGluZykge1xuICBpZiAoISh0aGlzIGluc3RhbmNlb2YgU2xvd0J1ZmZlcikpIHJldHVybiBuZXcgU2xvd0J1ZmZlcihzdWJqZWN0LCBlbmNvZGluZylcblxuICB2YXIgYnVmID0gbmV3IEJ1ZmZlcihzdWJqZWN0LCBlbmNvZGluZylcbiAgZGVsZXRlIGJ1Zi5wYXJlbnRcbiAgcmV0dXJuIGJ1ZlxufVxuXG5CdWZmZXIuaXNCdWZmZXIgPSBmdW5jdGlvbiBpc0J1ZmZlciAoYikge1xuICByZXR1cm4gISEoYiAhPSBudWxsICYmIGIuX2lzQnVmZmVyKVxufVxuXG5CdWZmZXIuY29tcGFyZSA9IGZ1bmN0aW9uIGNvbXBhcmUgKGEsIGIpIHtcbiAgaWYgKCFCdWZmZXIuaXNCdWZmZXIoYSkgfHwgIUJ1ZmZlci5pc0J1ZmZlcihiKSkge1xuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ0FyZ3VtZW50cyBtdXN0IGJlIEJ1ZmZlcnMnKVxuICB9XG5cbiAgaWYgKGEgPT09IGIpIHJldHVybiAwXG5cbiAgdmFyIHggPSBhLmxlbmd0aFxuICB2YXIgeSA9IGIubGVuZ3RoXG5cbiAgZm9yICh2YXIgaSA9IDAsIGxlbiA9IE1hdGgubWluKHgsIHkpOyBpIDwgbGVuOyArK2kpIHtcbiAgICBpZiAoYVtpXSAhPT0gYltpXSkge1xuICAgICAgeCA9IGFbaV1cbiAgICAgIHkgPSBiW2ldXG4gICAgICBicmVha1xuICAgIH1cbiAgfVxuXG4gIGlmICh4IDwgeSkgcmV0dXJuIC0xXG4gIGlmICh5IDwgeCkgcmV0dXJuIDFcbiAgcmV0dXJuIDBcbn1cblxuQnVmZmVyLmlzRW5jb2RpbmcgPSBmdW5jdGlvbiBpc0VuY29kaW5nIChlbmNvZGluZykge1xuICBzd2l0Y2ggKFN0cmluZyhlbmNvZGluZykudG9Mb3dlckNhc2UoKSkge1xuICAgIGNhc2UgJ2hleCc6XG4gICAgY2FzZSAndXRmOCc6XG4gICAgY2FzZSAndXRmLTgnOlxuICAgIGNhc2UgJ2FzY2lpJzpcbiAgICBjYXNlICdiaW5hcnknOlxuICAgIGNhc2UgJ2Jhc2U2NCc6XG4gICAgY2FzZSAncmF3JzpcbiAgICBjYXNlICd1Y3MyJzpcbiAgICBjYXNlICd1Y3MtMic6XG4gICAgY2FzZSAndXRmMTZsZSc6XG4gICAgY2FzZSAndXRmLTE2bGUnOlxuICAgICAgcmV0dXJuIHRydWVcbiAgICBkZWZhdWx0OlxuICAgICAgcmV0dXJuIGZhbHNlXG4gIH1cbn1cblxuQnVmZmVyLmNvbmNhdCA9IGZ1bmN0aW9uIGNvbmNhdCAobGlzdCwgbGVuZ3RoKSB7XG4gIGlmICghaXNBcnJheShsaXN0KSkgdGhyb3cgbmV3IFR5cGVFcnJvcignbGlzdCBhcmd1bWVudCBtdXN0IGJlIGFuIEFycmF5IG9mIEJ1ZmZlcnMuJylcblxuICBpZiAobGlzdC5sZW5ndGggPT09IDApIHtcbiAgICByZXR1cm4gbmV3IEJ1ZmZlcigwKVxuICB9XG5cbiAgdmFyIGlcbiAgaWYgKGxlbmd0aCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgbGVuZ3RoID0gMFxuICAgIGZvciAoaSA9IDA7IGkgPCBsaXN0Lmxlbmd0aDsgaSsrKSB7XG4gICAgICBsZW5ndGggKz0gbGlzdFtpXS5sZW5ndGhcbiAgICB9XG4gIH1cblxuICB2YXIgYnVmID0gbmV3IEJ1ZmZlcihsZW5ndGgpXG4gIHZhciBwb3MgPSAwXG4gIGZvciAoaSA9IDA7IGkgPCBsaXN0Lmxlbmd0aDsgaSsrKSB7XG4gICAgdmFyIGl0ZW0gPSBsaXN0W2ldXG4gICAgaXRlbS5jb3B5KGJ1ZiwgcG9zKVxuICAgIHBvcyArPSBpdGVtLmxlbmd0aFxuICB9XG4gIHJldHVybiBidWZcbn1cblxuZnVuY3Rpb24gYnl0ZUxlbmd0aCAoc3RyaW5nLCBlbmNvZGluZykge1xuICBpZiAodHlwZW9mIHN0cmluZyAhPT0gJ3N0cmluZycpIHN0cmluZyA9ICcnICsgc3RyaW5nXG5cbiAgdmFyIGxlbiA9IHN0cmluZy5sZW5ndGhcbiAgaWYgKGxlbiA9PT0gMCkgcmV0dXJuIDBcblxuICAvLyBVc2UgYSBmb3IgbG9vcCB0byBhdm9pZCByZWN1cnNpb25cbiAgdmFyIGxvd2VyZWRDYXNlID0gZmFsc2VcbiAgZm9yICg7Oykge1xuICAgIHN3aXRjaCAoZW5jb2RpbmcpIHtcbiAgICAgIGNhc2UgJ2FzY2lpJzpcbiAgICAgIGNhc2UgJ2JpbmFyeSc6XG4gICAgICAvLyBEZXByZWNhdGVkXG4gICAgICBjYXNlICdyYXcnOlxuICAgICAgY2FzZSAncmF3cyc6XG4gICAgICAgIHJldHVybiBsZW5cbiAgICAgIGNhc2UgJ3V0ZjgnOlxuICAgICAgY2FzZSAndXRmLTgnOlxuICAgICAgICByZXR1cm4gdXRmOFRvQnl0ZXMoc3RyaW5nKS5sZW5ndGhcbiAgICAgIGNhc2UgJ3VjczInOlxuICAgICAgY2FzZSAndWNzLTInOlxuICAgICAgY2FzZSAndXRmMTZsZSc6XG4gICAgICBjYXNlICd1dGYtMTZsZSc6XG4gICAgICAgIHJldHVybiBsZW4gKiAyXG4gICAgICBjYXNlICdoZXgnOlxuICAgICAgICByZXR1cm4gbGVuID4+PiAxXG4gICAgICBjYXNlICdiYXNlNjQnOlxuICAgICAgICByZXR1cm4gYmFzZTY0VG9CeXRlcyhzdHJpbmcpLmxlbmd0aFxuICAgICAgZGVmYXVsdDpcbiAgICAgICAgaWYgKGxvd2VyZWRDYXNlKSByZXR1cm4gdXRmOFRvQnl0ZXMoc3RyaW5nKS5sZW5ndGggLy8gYXNzdW1lIHV0ZjhcbiAgICAgICAgZW5jb2RpbmcgPSAoJycgKyBlbmNvZGluZykudG9Mb3dlckNhc2UoKVxuICAgICAgICBsb3dlcmVkQ2FzZSA9IHRydWVcbiAgICB9XG4gIH1cbn1cbkJ1ZmZlci5ieXRlTGVuZ3RoID0gYnl0ZUxlbmd0aFxuXG5mdW5jdGlvbiBzbG93VG9TdHJpbmcgKGVuY29kaW5nLCBzdGFydCwgZW5kKSB7XG4gIHZhciBsb3dlcmVkQ2FzZSA9IGZhbHNlXG5cbiAgc3RhcnQgPSBzdGFydCB8IDBcbiAgZW5kID0gZW5kID09PSB1bmRlZmluZWQgfHwgZW5kID09PSBJbmZpbml0eSA/IHRoaXMubGVuZ3RoIDogZW5kIHwgMFxuXG4gIGlmICghZW5jb2RpbmcpIGVuY29kaW5nID0gJ3V0ZjgnXG4gIGlmIChzdGFydCA8IDApIHN0YXJ0ID0gMFxuICBpZiAoZW5kID4gdGhpcy5sZW5ndGgpIGVuZCA9IHRoaXMubGVuZ3RoXG4gIGlmIChlbmQgPD0gc3RhcnQpIHJldHVybiAnJ1xuXG4gIHdoaWxlICh0cnVlKSB7XG4gICAgc3dpdGNoIChlbmNvZGluZykge1xuICAgICAgY2FzZSAnaGV4JzpcbiAgICAgICAgcmV0dXJuIGhleFNsaWNlKHRoaXMsIHN0YXJ0LCBlbmQpXG5cbiAgICAgIGNhc2UgJ3V0ZjgnOlxuICAgICAgY2FzZSAndXRmLTgnOlxuICAgICAgICByZXR1cm4gdXRmOFNsaWNlKHRoaXMsIHN0YXJ0LCBlbmQpXG5cbiAgICAgIGNhc2UgJ2FzY2lpJzpcbiAgICAgICAgcmV0dXJuIGFzY2lpU2xpY2UodGhpcywgc3RhcnQsIGVuZClcblxuICAgICAgY2FzZSAnYmluYXJ5JzpcbiAgICAgICAgcmV0dXJuIGJpbmFyeVNsaWNlKHRoaXMsIHN0YXJ0LCBlbmQpXG5cbiAgICAgIGNhc2UgJ2Jhc2U2NCc6XG4gICAgICAgIHJldHVybiBiYXNlNjRTbGljZSh0aGlzLCBzdGFydCwgZW5kKVxuXG4gICAgICBjYXNlICd1Y3MyJzpcbiAgICAgIGNhc2UgJ3Vjcy0yJzpcbiAgICAgIGNhc2UgJ3V0ZjE2bGUnOlxuICAgICAgY2FzZSAndXRmLTE2bGUnOlxuICAgICAgICByZXR1cm4gdXRmMTZsZVNsaWNlKHRoaXMsIHN0YXJ0LCBlbmQpXG5cbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIGlmIChsb3dlcmVkQ2FzZSkgdGhyb3cgbmV3IFR5cGVFcnJvcignVW5rbm93biBlbmNvZGluZzogJyArIGVuY29kaW5nKVxuICAgICAgICBlbmNvZGluZyA9IChlbmNvZGluZyArICcnKS50b0xvd2VyQ2FzZSgpXG4gICAgICAgIGxvd2VyZWRDYXNlID0gdHJ1ZVxuICAgIH1cbiAgfVxufVxuXG4vLyBUaGUgcHJvcGVydHkgaXMgdXNlZCBieSBgQnVmZmVyLmlzQnVmZmVyYCBhbmQgYGlzLWJ1ZmZlcmAgKGluIFNhZmFyaSA1LTcpIHRvIGRldGVjdFxuLy8gQnVmZmVyIGluc3RhbmNlcy5cbkJ1ZmZlci5wcm90b3R5cGUuX2lzQnVmZmVyID0gdHJ1ZVxuXG5CdWZmZXIucHJvdG90eXBlLnRvU3RyaW5nID0gZnVuY3Rpb24gdG9TdHJpbmcgKCkge1xuICB2YXIgbGVuZ3RoID0gdGhpcy5sZW5ndGggfCAwXG4gIGlmIChsZW5ndGggPT09IDApIHJldHVybiAnJ1xuICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMCkgcmV0dXJuIHV0ZjhTbGljZSh0aGlzLCAwLCBsZW5ndGgpXG4gIHJldHVybiBzbG93VG9TdHJpbmcuYXBwbHkodGhpcywgYXJndW1lbnRzKVxufVxuXG5CdWZmZXIucHJvdG90eXBlLmVxdWFscyA9IGZ1bmN0aW9uIGVxdWFscyAoYikge1xuICBpZiAoIUJ1ZmZlci5pc0J1ZmZlcihiKSkgdGhyb3cgbmV3IFR5cGVFcnJvcignQXJndW1lbnQgbXVzdCBiZSBhIEJ1ZmZlcicpXG4gIGlmICh0aGlzID09PSBiKSByZXR1cm4gdHJ1ZVxuICByZXR1cm4gQnVmZmVyLmNvbXBhcmUodGhpcywgYikgPT09IDBcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5pbnNwZWN0ID0gZnVuY3Rpb24gaW5zcGVjdCAoKSB7XG4gIHZhciBzdHIgPSAnJ1xuICB2YXIgbWF4ID0gZXhwb3J0cy5JTlNQRUNUX01BWF9CWVRFU1xuICBpZiAodGhpcy5sZW5ndGggPiAwKSB7XG4gICAgc3RyID0gdGhpcy50b1N0cmluZygnaGV4JywgMCwgbWF4KS5tYXRjaCgvLnsyfS9nKS5qb2luKCcgJylcbiAgICBpZiAodGhpcy5sZW5ndGggPiBtYXgpIHN0ciArPSAnIC4uLiAnXG4gIH1cbiAgcmV0dXJuICc8QnVmZmVyICcgKyBzdHIgKyAnPidcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5jb21wYXJlID0gZnVuY3Rpb24gY29tcGFyZSAoYikge1xuICBpZiAoIUJ1ZmZlci5pc0J1ZmZlcihiKSkgdGhyb3cgbmV3IFR5cGVFcnJvcignQXJndW1lbnQgbXVzdCBiZSBhIEJ1ZmZlcicpXG4gIHJldHVybiBCdWZmZXIuY29tcGFyZSh0aGlzLCBiKVxufVxuXG5CdWZmZXIucHJvdG90eXBlLmluZGV4T2YgPSBmdW5jdGlvbiBpbmRleE9mICh2YWwsIGJ5dGVPZmZzZXQpIHtcbiAgaWYgKGJ5dGVPZmZzZXQgPiAweDdmZmZmZmZmKSBieXRlT2Zmc2V0ID0gMHg3ZmZmZmZmZlxuICBlbHNlIGlmIChieXRlT2Zmc2V0IDwgLTB4ODAwMDAwMDApIGJ5dGVPZmZzZXQgPSAtMHg4MDAwMDAwMFxuICBieXRlT2Zmc2V0ID4+PSAwXG5cbiAgaWYgKHRoaXMubGVuZ3RoID09PSAwKSByZXR1cm4gLTFcbiAgaWYgKGJ5dGVPZmZzZXQgPj0gdGhpcy5sZW5ndGgpIHJldHVybiAtMVxuXG4gIC8vIE5lZ2F0aXZlIG9mZnNldHMgc3RhcnQgZnJvbSB0aGUgZW5kIG9mIHRoZSBidWZmZXJcbiAgaWYgKGJ5dGVPZmZzZXQgPCAwKSBieXRlT2Zmc2V0ID0gTWF0aC5tYXgodGhpcy5sZW5ndGggKyBieXRlT2Zmc2V0LCAwKVxuXG4gIGlmICh0eXBlb2YgdmFsID09PSAnc3RyaW5nJykge1xuICAgIGlmICh2YWwubGVuZ3RoID09PSAwKSByZXR1cm4gLTEgLy8gc3BlY2lhbCBjYXNlOiBsb29raW5nIGZvciBlbXB0eSBzdHJpbmcgYWx3YXlzIGZhaWxzXG4gICAgcmV0dXJuIFN0cmluZy5wcm90b3R5cGUuaW5kZXhPZi5jYWxsKHRoaXMsIHZhbCwgYnl0ZU9mZnNldClcbiAgfVxuICBpZiAoQnVmZmVyLmlzQnVmZmVyKHZhbCkpIHtcbiAgICByZXR1cm4gYXJyYXlJbmRleE9mKHRoaXMsIHZhbCwgYnl0ZU9mZnNldClcbiAgfVxuICBpZiAodHlwZW9mIHZhbCA9PT0gJ251bWJlcicpIHtcbiAgICBpZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQgJiYgVWludDhBcnJheS5wcm90b3R5cGUuaW5kZXhPZiA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgcmV0dXJuIFVpbnQ4QXJyYXkucHJvdG90eXBlLmluZGV4T2YuY2FsbCh0aGlzLCB2YWwsIGJ5dGVPZmZzZXQpXG4gICAgfVxuICAgIHJldHVybiBhcnJheUluZGV4T2YodGhpcywgWyB2YWwgXSwgYnl0ZU9mZnNldClcbiAgfVxuXG4gIGZ1bmN0aW9uIGFycmF5SW5kZXhPZiAoYXJyLCB2YWwsIGJ5dGVPZmZzZXQpIHtcbiAgICB2YXIgZm91bmRJbmRleCA9IC0xXG4gICAgZm9yICh2YXIgaSA9IDA7IGJ5dGVPZmZzZXQgKyBpIDwgYXJyLmxlbmd0aDsgaSsrKSB7XG4gICAgICBpZiAoYXJyW2J5dGVPZmZzZXQgKyBpXSA9PT0gdmFsW2ZvdW5kSW5kZXggPT09IC0xID8gMCA6IGkgLSBmb3VuZEluZGV4XSkge1xuICAgICAgICBpZiAoZm91bmRJbmRleCA9PT0gLTEpIGZvdW5kSW5kZXggPSBpXG4gICAgICAgIGlmIChpIC0gZm91bmRJbmRleCArIDEgPT09IHZhbC5sZW5ndGgpIHJldHVybiBieXRlT2Zmc2V0ICsgZm91bmRJbmRleFxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZm91bmRJbmRleCA9IC0xXG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiAtMVxuICB9XG5cbiAgdGhyb3cgbmV3IFR5cGVFcnJvcigndmFsIG11c3QgYmUgc3RyaW5nLCBudW1iZXIgb3IgQnVmZmVyJylcbn1cblxuZnVuY3Rpb24gaGV4V3JpdGUgKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCkge1xuICBvZmZzZXQgPSBOdW1iZXIob2Zmc2V0KSB8fCAwXG4gIHZhciByZW1haW5pbmcgPSBidWYubGVuZ3RoIC0gb2Zmc2V0XG4gIGlmICghbGVuZ3RoKSB7XG4gICAgbGVuZ3RoID0gcmVtYWluaW5nXG4gIH0gZWxzZSB7XG4gICAgbGVuZ3RoID0gTnVtYmVyKGxlbmd0aClcbiAgICBpZiAobGVuZ3RoID4gcmVtYWluaW5nKSB7XG4gICAgICBsZW5ndGggPSByZW1haW5pbmdcbiAgICB9XG4gIH1cblxuICAvLyBtdXN0IGJlIGFuIGV2ZW4gbnVtYmVyIG9mIGRpZ2l0c1xuICB2YXIgc3RyTGVuID0gc3RyaW5nLmxlbmd0aFxuICBpZiAoc3RyTGVuICUgMiAhPT0gMCkgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIGhleCBzdHJpbmcnKVxuXG4gIGlmIChsZW5ndGggPiBzdHJMZW4gLyAyKSB7XG4gICAgbGVuZ3RoID0gc3RyTGVuIC8gMlxuICB9XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICB2YXIgcGFyc2VkID0gcGFyc2VJbnQoc3RyaW5nLnN1YnN0cihpICogMiwgMiksIDE2KVxuICAgIGlmIChpc05hTihwYXJzZWQpKSB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgaGV4IHN0cmluZycpXG4gICAgYnVmW29mZnNldCArIGldID0gcGFyc2VkXG4gIH1cbiAgcmV0dXJuIGlcbn1cblxuZnVuY3Rpb24gdXRmOFdyaXRlIChidWYsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpIHtcbiAgcmV0dXJuIGJsaXRCdWZmZXIodXRmOFRvQnl0ZXMoc3RyaW5nLCBidWYubGVuZ3RoIC0gb2Zmc2V0KSwgYnVmLCBvZmZzZXQsIGxlbmd0aClcbn1cblxuZnVuY3Rpb24gYXNjaWlXcml0ZSAoYnVmLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKSB7XG4gIHJldHVybiBibGl0QnVmZmVyKGFzY2lpVG9CeXRlcyhzdHJpbmcpLCBidWYsIG9mZnNldCwgbGVuZ3RoKVxufVxuXG5mdW5jdGlvbiBiaW5hcnlXcml0ZSAoYnVmLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKSB7XG4gIHJldHVybiBhc2NpaVdyaXRlKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aClcbn1cblxuZnVuY3Rpb24gYmFzZTY0V3JpdGUgKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCkge1xuICByZXR1cm4gYmxpdEJ1ZmZlcihiYXNlNjRUb0J5dGVzKHN0cmluZyksIGJ1Ziwgb2Zmc2V0LCBsZW5ndGgpXG59XG5cbmZ1bmN0aW9uIHVjczJXcml0ZSAoYnVmLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKSB7XG4gIHJldHVybiBibGl0QnVmZmVyKHV0ZjE2bGVUb0J5dGVzKHN0cmluZywgYnVmLmxlbmd0aCAtIG9mZnNldCksIGJ1Ziwgb2Zmc2V0LCBsZW5ndGgpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGUgPSBmdW5jdGlvbiB3cml0ZSAoc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCwgZW5jb2RpbmcpIHtcbiAgLy8gQnVmZmVyI3dyaXRlKHN0cmluZylcbiAgaWYgKG9mZnNldCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgZW5jb2RpbmcgPSAndXRmOCdcbiAgICBsZW5ndGggPSB0aGlzLmxlbmd0aFxuICAgIG9mZnNldCA9IDBcbiAgLy8gQnVmZmVyI3dyaXRlKHN0cmluZywgZW5jb2RpbmcpXG4gIH0gZWxzZSBpZiAobGVuZ3RoID09PSB1bmRlZmluZWQgJiYgdHlwZW9mIG9mZnNldCA9PT0gJ3N0cmluZycpIHtcbiAgICBlbmNvZGluZyA9IG9mZnNldFxuICAgIGxlbmd0aCA9IHRoaXMubGVuZ3RoXG4gICAgb2Zmc2V0ID0gMFxuICAvLyBCdWZmZXIjd3JpdGUoc3RyaW5nLCBvZmZzZXRbLCBsZW5ndGhdWywgZW5jb2RpbmddKVxuICB9IGVsc2UgaWYgKGlzRmluaXRlKG9mZnNldCkpIHtcbiAgICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gICAgaWYgKGlzRmluaXRlKGxlbmd0aCkpIHtcbiAgICAgIGxlbmd0aCA9IGxlbmd0aCB8IDBcbiAgICAgIGlmIChlbmNvZGluZyA9PT0gdW5kZWZpbmVkKSBlbmNvZGluZyA9ICd1dGY4J1xuICAgIH0gZWxzZSB7XG4gICAgICBlbmNvZGluZyA9IGxlbmd0aFxuICAgICAgbGVuZ3RoID0gdW5kZWZpbmVkXG4gICAgfVxuICAvLyBsZWdhY3kgd3JpdGUoc3RyaW5nLCBlbmNvZGluZywgb2Zmc2V0LCBsZW5ndGgpIC0gcmVtb3ZlIGluIHYwLjEzXG4gIH0gZWxzZSB7XG4gICAgdmFyIHN3YXAgPSBlbmNvZGluZ1xuICAgIGVuY29kaW5nID0gb2Zmc2V0XG4gICAgb2Zmc2V0ID0gbGVuZ3RoIHwgMFxuICAgIGxlbmd0aCA9IHN3YXBcbiAgfVxuXG4gIHZhciByZW1haW5pbmcgPSB0aGlzLmxlbmd0aCAtIG9mZnNldFxuICBpZiAobGVuZ3RoID09PSB1bmRlZmluZWQgfHwgbGVuZ3RoID4gcmVtYWluaW5nKSBsZW5ndGggPSByZW1haW5pbmdcblxuICBpZiAoKHN0cmluZy5sZW5ndGggPiAwICYmIChsZW5ndGggPCAwIHx8IG9mZnNldCA8IDApKSB8fCBvZmZzZXQgPiB0aGlzLmxlbmd0aCkge1xuICAgIHRocm93IG5ldyBSYW5nZUVycm9yKCdhdHRlbXB0IHRvIHdyaXRlIG91dHNpZGUgYnVmZmVyIGJvdW5kcycpXG4gIH1cblxuICBpZiAoIWVuY29kaW5nKSBlbmNvZGluZyA9ICd1dGY4J1xuXG4gIHZhciBsb3dlcmVkQ2FzZSA9IGZhbHNlXG4gIGZvciAoOzspIHtcbiAgICBzd2l0Y2ggKGVuY29kaW5nKSB7XG4gICAgICBjYXNlICdoZXgnOlxuICAgICAgICByZXR1cm4gaGV4V3JpdGUodGhpcywgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aClcblxuICAgICAgY2FzZSAndXRmOCc6XG4gICAgICBjYXNlICd1dGYtOCc6XG4gICAgICAgIHJldHVybiB1dGY4V3JpdGUodGhpcywgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aClcblxuICAgICAgY2FzZSAnYXNjaWknOlxuICAgICAgICByZXR1cm4gYXNjaWlXcml0ZSh0aGlzLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxuXG4gICAgICBjYXNlICdiaW5hcnknOlxuICAgICAgICByZXR1cm4gYmluYXJ5V3JpdGUodGhpcywgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aClcblxuICAgICAgY2FzZSAnYmFzZTY0JzpcbiAgICAgICAgLy8gV2FybmluZzogbWF4TGVuZ3RoIG5vdCB0YWtlbiBpbnRvIGFjY291bnQgaW4gYmFzZTY0V3JpdGVcbiAgICAgICAgcmV0dXJuIGJhc2U2NFdyaXRlKHRoaXMsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpXG5cbiAgICAgIGNhc2UgJ3VjczInOlxuICAgICAgY2FzZSAndWNzLTInOlxuICAgICAgY2FzZSAndXRmMTZsZSc6XG4gICAgICBjYXNlICd1dGYtMTZsZSc6XG4gICAgICAgIHJldHVybiB1Y3MyV3JpdGUodGhpcywgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aClcblxuICAgICAgZGVmYXVsdDpcbiAgICAgICAgaWYgKGxvd2VyZWRDYXNlKSB0aHJvdyBuZXcgVHlwZUVycm9yKCdVbmtub3duIGVuY29kaW5nOiAnICsgZW5jb2RpbmcpXG4gICAgICAgIGVuY29kaW5nID0gKCcnICsgZW5jb2RpbmcpLnRvTG93ZXJDYXNlKClcbiAgICAgICAgbG93ZXJlZENhc2UgPSB0cnVlXG4gICAgfVxuICB9XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUudG9KU09OID0gZnVuY3Rpb24gdG9KU09OICgpIHtcbiAgcmV0dXJuIHtcbiAgICB0eXBlOiAnQnVmZmVyJyxcbiAgICBkYXRhOiBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbCh0aGlzLl9hcnIgfHwgdGhpcywgMClcbiAgfVxufVxuXG5mdW5jdGlvbiBiYXNlNjRTbGljZSAoYnVmLCBzdGFydCwgZW5kKSB7XG4gIGlmIChzdGFydCA9PT0gMCAmJiBlbmQgPT09IGJ1Zi5sZW5ndGgpIHtcbiAgICByZXR1cm4gYmFzZTY0LmZyb21CeXRlQXJyYXkoYnVmKVxuICB9IGVsc2Uge1xuICAgIHJldHVybiBiYXNlNjQuZnJvbUJ5dGVBcnJheShidWYuc2xpY2Uoc3RhcnQsIGVuZCkpXG4gIH1cbn1cblxuZnVuY3Rpb24gdXRmOFNsaWNlIChidWYsIHN0YXJ0LCBlbmQpIHtcbiAgZW5kID0gTWF0aC5taW4oYnVmLmxlbmd0aCwgZW5kKVxuICB2YXIgcmVzID0gW11cblxuICB2YXIgaSA9IHN0YXJ0XG4gIHdoaWxlIChpIDwgZW5kKSB7XG4gICAgdmFyIGZpcnN0Qnl0ZSA9IGJ1ZltpXVxuICAgIHZhciBjb2RlUG9pbnQgPSBudWxsXG4gICAgdmFyIGJ5dGVzUGVyU2VxdWVuY2UgPSAoZmlyc3RCeXRlID4gMHhFRikgPyA0XG4gICAgICA6IChmaXJzdEJ5dGUgPiAweERGKSA/IDNcbiAgICAgIDogKGZpcnN0Qnl0ZSA+IDB4QkYpID8gMlxuICAgICAgOiAxXG5cbiAgICBpZiAoaSArIGJ5dGVzUGVyU2VxdWVuY2UgPD0gZW5kKSB7XG4gICAgICB2YXIgc2Vjb25kQnl0ZSwgdGhpcmRCeXRlLCBmb3VydGhCeXRlLCB0ZW1wQ29kZVBvaW50XG5cbiAgICAgIHN3aXRjaCAoYnl0ZXNQZXJTZXF1ZW5jZSkge1xuICAgICAgICBjYXNlIDE6XG4gICAgICAgICAgaWYgKGZpcnN0Qnl0ZSA8IDB4ODApIHtcbiAgICAgICAgICAgIGNvZGVQb2ludCA9IGZpcnN0Qnl0ZVxuICAgICAgICAgIH1cbiAgICAgICAgICBicmVha1xuICAgICAgICBjYXNlIDI6XG4gICAgICAgICAgc2Vjb25kQnl0ZSA9IGJ1ZltpICsgMV1cbiAgICAgICAgICBpZiAoKHNlY29uZEJ5dGUgJiAweEMwKSA9PT0gMHg4MCkge1xuICAgICAgICAgICAgdGVtcENvZGVQb2ludCA9IChmaXJzdEJ5dGUgJiAweDFGKSA8PCAweDYgfCAoc2Vjb25kQnl0ZSAmIDB4M0YpXG4gICAgICAgICAgICBpZiAodGVtcENvZGVQb2ludCA+IDB4N0YpIHtcbiAgICAgICAgICAgICAgY29kZVBvaW50ID0gdGVtcENvZGVQb2ludFxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBicmVha1xuICAgICAgICBjYXNlIDM6XG4gICAgICAgICAgc2Vjb25kQnl0ZSA9IGJ1ZltpICsgMV1cbiAgICAgICAgICB0aGlyZEJ5dGUgPSBidWZbaSArIDJdXG4gICAgICAgICAgaWYgKChzZWNvbmRCeXRlICYgMHhDMCkgPT09IDB4ODAgJiYgKHRoaXJkQnl0ZSAmIDB4QzApID09PSAweDgwKSB7XG4gICAgICAgICAgICB0ZW1wQ29kZVBvaW50ID0gKGZpcnN0Qnl0ZSAmIDB4RikgPDwgMHhDIHwgKHNlY29uZEJ5dGUgJiAweDNGKSA8PCAweDYgfCAodGhpcmRCeXRlICYgMHgzRilcbiAgICAgICAgICAgIGlmICh0ZW1wQ29kZVBvaW50ID4gMHg3RkYgJiYgKHRlbXBDb2RlUG9pbnQgPCAweEQ4MDAgfHwgdGVtcENvZGVQb2ludCA+IDB4REZGRikpIHtcbiAgICAgICAgICAgICAgY29kZVBvaW50ID0gdGVtcENvZGVQb2ludFxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBicmVha1xuICAgICAgICBjYXNlIDQ6XG4gICAgICAgICAgc2Vjb25kQnl0ZSA9IGJ1ZltpICsgMV1cbiAgICAgICAgICB0aGlyZEJ5dGUgPSBidWZbaSArIDJdXG4gICAgICAgICAgZm91cnRoQnl0ZSA9IGJ1ZltpICsgM11cbiAgICAgICAgICBpZiAoKHNlY29uZEJ5dGUgJiAweEMwKSA9PT0gMHg4MCAmJiAodGhpcmRCeXRlICYgMHhDMCkgPT09IDB4ODAgJiYgKGZvdXJ0aEJ5dGUgJiAweEMwKSA9PT0gMHg4MCkge1xuICAgICAgICAgICAgdGVtcENvZGVQb2ludCA9IChmaXJzdEJ5dGUgJiAweEYpIDw8IDB4MTIgfCAoc2Vjb25kQnl0ZSAmIDB4M0YpIDw8IDB4QyB8ICh0aGlyZEJ5dGUgJiAweDNGKSA8PCAweDYgfCAoZm91cnRoQnl0ZSAmIDB4M0YpXG4gICAgICAgICAgICBpZiAodGVtcENvZGVQb2ludCA+IDB4RkZGRiAmJiB0ZW1wQ29kZVBvaW50IDwgMHgxMTAwMDApIHtcbiAgICAgICAgICAgICAgY29kZVBvaW50ID0gdGVtcENvZGVQb2ludFxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoY29kZVBvaW50ID09PSBudWxsKSB7XG4gICAgICAvLyB3ZSBkaWQgbm90IGdlbmVyYXRlIGEgdmFsaWQgY29kZVBvaW50IHNvIGluc2VydCBhXG4gICAgICAvLyByZXBsYWNlbWVudCBjaGFyIChVK0ZGRkQpIGFuZCBhZHZhbmNlIG9ubHkgMSBieXRlXG4gICAgICBjb2RlUG9pbnQgPSAweEZGRkRcbiAgICAgIGJ5dGVzUGVyU2VxdWVuY2UgPSAxXG4gICAgfSBlbHNlIGlmIChjb2RlUG9pbnQgPiAweEZGRkYpIHtcbiAgICAgIC8vIGVuY29kZSB0byB1dGYxNiAoc3Vycm9nYXRlIHBhaXIgZGFuY2UpXG4gICAgICBjb2RlUG9pbnQgLT0gMHgxMDAwMFxuICAgICAgcmVzLnB1c2goY29kZVBvaW50ID4+PiAxMCAmIDB4M0ZGIHwgMHhEODAwKVxuICAgICAgY29kZVBvaW50ID0gMHhEQzAwIHwgY29kZVBvaW50ICYgMHgzRkZcbiAgICB9XG5cbiAgICByZXMucHVzaChjb2RlUG9pbnQpXG4gICAgaSArPSBieXRlc1BlclNlcXVlbmNlXG4gIH1cblxuICByZXR1cm4gZGVjb2RlQ29kZVBvaW50c0FycmF5KHJlcylcbn1cblxuLy8gQmFzZWQgb24gaHR0cDovL3N0YWNrb3ZlcmZsb3cuY29tL2EvMjI3NDcyNzIvNjgwNzQyLCB0aGUgYnJvd3NlciB3aXRoXG4vLyB0aGUgbG93ZXN0IGxpbWl0IGlzIENocm9tZSwgd2l0aCAweDEwMDAwIGFyZ3MuXG4vLyBXZSBnbyAxIG1hZ25pdHVkZSBsZXNzLCBmb3Igc2FmZXR5XG52YXIgTUFYX0FSR1VNRU5UU19MRU5HVEggPSAweDEwMDBcblxuZnVuY3Rpb24gZGVjb2RlQ29kZVBvaW50c0FycmF5IChjb2RlUG9pbnRzKSB7XG4gIHZhciBsZW4gPSBjb2RlUG9pbnRzLmxlbmd0aFxuICBpZiAobGVuIDw9IE1BWF9BUkdVTUVOVFNfTEVOR1RIKSB7XG4gICAgcmV0dXJuIFN0cmluZy5mcm9tQ2hhckNvZGUuYXBwbHkoU3RyaW5nLCBjb2RlUG9pbnRzKSAvLyBhdm9pZCBleHRyYSBzbGljZSgpXG4gIH1cblxuICAvLyBEZWNvZGUgaW4gY2h1bmtzIHRvIGF2b2lkIFwiY2FsbCBzdGFjayBzaXplIGV4Y2VlZGVkXCIuXG4gIHZhciByZXMgPSAnJ1xuICB2YXIgaSA9IDBcbiAgd2hpbGUgKGkgPCBsZW4pIHtcbiAgICByZXMgKz0gU3RyaW5nLmZyb21DaGFyQ29kZS5hcHBseShcbiAgICAgIFN0cmluZyxcbiAgICAgIGNvZGVQb2ludHMuc2xpY2UoaSwgaSArPSBNQVhfQVJHVU1FTlRTX0xFTkdUSClcbiAgICApXG4gIH1cbiAgcmV0dXJuIHJlc1xufVxuXG5mdW5jdGlvbiBhc2NpaVNsaWNlIChidWYsIHN0YXJ0LCBlbmQpIHtcbiAgdmFyIHJldCA9ICcnXG4gIGVuZCA9IE1hdGgubWluKGJ1Zi5sZW5ndGgsIGVuZClcblxuICBmb3IgKHZhciBpID0gc3RhcnQ7IGkgPCBlbmQ7IGkrKykge1xuICAgIHJldCArPSBTdHJpbmcuZnJvbUNoYXJDb2RlKGJ1ZltpXSAmIDB4N0YpXG4gIH1cbiAgcmV0dXJuIHJldFxufVxuXG5mdW5jdGlvbiBiaW5hcnlTbGljZSAoYnVmLCBzdGFydCwgZW5kKSB7XG4gIHZhciByZXQgPSAnJ1xuICBlbmQgPSBNYXRoLm1pbihidWYubGVuZ3RoLCBlbmQpXG5cbiAgZm9yICh2YXIgaSA9IHN0YXJ0OyBpIDwgZW5kOyBpKyspIHtcbiAgICByZXQgKz0gU3RyaW5nLmZyb21DaGFyQ29kZShidWZbaV0pXG4gIH1cbiAgcmV0dXJuIHJldFxufVxuXG5mdW5jdGlvbiBoZXhTbGljZSAoYnVmLCBzdGFydCwgZW5kKSB7XG4gIHZhciBsZW4gPSBidWYubGVuZ3RoXG5cbiAgaWYgKCFzdGFydCB8fCBzdGFydCA8IDApIHN0YXJ0ID0gMFxuICBpZiAoIWVuZCB8fCBlbmQgPCAwIHx8IGVuZCA+IGxlbikgZW5kID0gbGVuXG5cbiAgdmFyIG91dCA9ICcnXG4gIGZvciAodmFyIGkgPSBzdGFydDsgaSA8IGVuZDsgaSsrKSB7XG4gICAgb3V0ICs9IHRvSGV4KGJ1ZltpXSlcbiAgfVxuICByZXR1cm4gb3V0XG59XG5cbmZ1bmN0aW9uIHV0ZjE2bGVTbGljZSAoYnVmLCBzdGFydCwgZW5kKSB7XG4gIHZhciBieXRlcyA9IGJ1Zi5zbGljZShzdGFydCwgZW5kKVxuICB2YXIgcmVzID0gJydcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBieXRlcy5sZW5ndGg7IGkgKz0gMikge1xuICAgIHJlcyArPSBTdHJpbmcuZnJvbUNoYXJDb2RlKGJ5dGVzW2ldICsgYnl0ZXNbaSArIDFdICogMjU2KVxuICB9XG4gIHJldHVybiByZXNcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5zbGljZSA9IGZ1bmN0aW9uIHNsaWNlIChzdGFydCwgZW5kKSB7XG4gIHZhciBsZW4gPSB0aGlzLmxlbmd0aFxuICBzdGFydCA9IH5+c3RhcnRcbiAgZW5kID0gZW5kID09PSB1bmRlZmluZWQgPyBsZW4gOiB+fmVuZFxuXG4gIGlmIChzdGFydCA8IDApIHtcbiAgICBzdGFydCArPSBsZW5cbiAgICBpZiAoc3RhcnQgPCAwKSBzdGFydCA9IDBcbiAgfSBlbHNlIGlmIChzdGFydCA+IGxlbikge1xuICAgIHN0YXJ0ID0gbGVuXG4gIH1cblxuICBpZiAoZW5kIDwgMCkge1xuICAgIGVuZCArPSBsZW5cbiAgICBpZiAoZW5kIDwgMCkgZW5kID0gMFxuICB9IGVsc2UgaWYgKGVuZCA+IGxlbikge1xuICAgIGVuZCA9IGxlblxuICB9XG5cbiAgaWYgKGVuZCA8IHN0YXJ0KSBlbmQgPSBzdGFydFxuXG4gIHZhciBuZXdCdWZcbiAgaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgbmV3QnVmID0gdGhpcy5zdWJhcnJheShzdGFydCwgZW5kKVxuICAgIG5ld0J1Zi5fX3Byb3RvX18gPSBCdWZmZXIucHJvdG90eXBlXG4gIH0gZWxzZSB7XG4gICAgdmFyIHNsaWNlTGVuID0gZW5kIC0gc3RhcnRcbiAgICBuZXdCdWYgPSBuZXcgQnVmZmVyKHNsaWNlTGVuLCB1bmRlZmluZWQpXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBzbGljZUxlbjsgaSsrKSB7XG4gICAgICBuZXdCdWZbaV0gPSB0aGlzW2kgKyBzdGFydF1cbiAgICB9XG4gIH1cblxuICBpZiAobmV3QnVmLmxlbmd0aCkgbmV3QnVmLnBhcmVudCA9IHRoaXMucGFyZW50IHx8IHRoaXNcblxuICByZXR1cm4gbmV3QnVmXG59XG5cbi8qXG4gKiBOZWVkIHRvIG1ha2Ugc3VyZSB0aGF0IGJ1ZmZlciBpc24ndCB0cnlpbmcgdG8gd3JpdGUgb3V0IG9mIGJvdW5kcy5cbiAqL1xuZnVuY3Rpb24gY2hlY2tPZmZzZXQgKG9mZnNldCwgZXh0LCBsZW5ndGgpIHtcbiAgaWYgKChvZmZzZXQgJSAxKSAhPT0gMCB8fCBvZmZzZXQgPCAwKSB0aHJvdyBuZXcgUmFuZ2VFcnJvcignb2Zmc2V0IGlzIG5vdCB1aW50JylcbiAgaWYgKG9mZnNldCArIGV4dCA+IGxlbmd0aCkgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ1RyeWluZyB0byBhY2Nlc3MgYmV5b25kIGJ1ZmZlciBsZW5ndGgnKVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRVSW50TEUgPSBmdW5jdGlvbiByZWFkVUludExFIChvZmZzZXQsIGJ5dGVMZW5ndGgsIG5vQXNzZXJ0KSB7XG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgYnl0ZUxlbmd0aCA9IGJ5dGVMZW5ndGggfCAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgYnl0ZUxlbmd0aCwgdGhpcy5sZW5ndGgpXG5cbiAgdmFyIHZhbCA9IHRoaXNbb2Zmc2V0XVxuICB2YXIgbXVsID0gMVxuICB2YXIgaSA9IDBcbiAgd2hpbGUgKCsraSA8IGJ5dGVMZW5ndGggJiYgKG11bCAqPSAweDEwMCkpIHtcbiAgICB2YWwgKz0gdGhpc1tvZmZzZXQgKyBpXSAqIG11bFxuICB9XG5cbiAgcmV0dXJuIHZhbFxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRVSW50QkUgPSBmdW5jdGlvbiByZWFkVUludEJFIChvZmZzZXQsIGJ5dGVMZW5ndGgsIG5vQXNzZXJ0KSB7XG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgYnl0ZUxlbmd0aCA9IGJ5dGVMZW5ndGggfCAwXG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICBjaGVja09mZnNldChvZmZzZXQsIGJ5dGVMZW5ndGgsIHRoaXMubGVuZ3RoKVxuICB9XG5cbiAgdmFyIHZhbCA9IHRoaXNbb2Zmc2V0ICsgLS1ieXRlTGVuZ3RoXVxuICB2YXIgbXVsID0gMVxuICB3aGlsZSAoYnl0ZUxlbmd0aCA+IDAgJiYgKG11bCAqPSAweDEwMCkpIHtcbiAgICB2YWwgKz0gdGhpc1tvZmZzZXQgKyAtLWJ5dGVMZW5ndGhdICogbXVsXG4gIH1cblxuICByZXR1cm4gdmFsXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZFVJbnQ4ID0gZnVuY3Rpb24gcmVhZFVJbnQ4IChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgMSwgdGhpcy5sZW5ndGgpXG4gIHJldHVybiB0aGlzW29mZnNldF1cbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkVUludDE2TEUgPSBmdW5jdGlvbiByZWFkVUludDE2TEUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCAyLCB0aGlzLmxlbmd0aClcbiAgcmV0dXJuIHRoaXNbb2Zmc2V0XSB8ICh0aGlzW29mZnNldCArIDFdIDw8IDgpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZFVJbnQxNkJFID0gZnVuY3Rpb24gcmVhZFVJbnQxNkJFIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgMiwgdGhpcy5sZW5ndGgpXG4gIHJldHVybiAodGhpc1tvZmZzZXRdIDw8IDgpIHwgdGhpc1tvZmZzZXQgKyAxXVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRVSW50MzJMRSA9IGZ1bmN0aW9uIHJlYWRVSW50MzJMRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDQsIHRoaXMubGVuZ3RoKVxuXG4gIHJldHVybiAoKHRoaXNbb2Zmc2V0XSkgfFxuICAgICAgKHRoaXNbb2Zmc2V0ICsgMV0gPDwgOCkgfFxuICAgICAgKHRoaXNbb2Zmc2V0ICsgMl0gPDwgMTYpKSArXG4gICAgICAodGhpc1tvZmZzZXQgKyAzXSAqIDB4MTAwMDAwMClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkVUludDMyQkUgPSBmdW5jdGlvbiByZWFkVUludDMyQkUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCA0LCB0aGlzLmxlbmd0aClcblxuICByZXR1cm4gKHRoaXNbb2Zmc2V0XSAqIDB4MTAwMDAwMCkgK1xuICAgICgodGhpc1tvZmZzZXQgKyAxXSA8PCAxNikgfFxuICAgICh0aGlzW29mZnNldCArIDJdIDw8IDgpIHxcbiAgICB0aGlzW29mZnNldCArIDNdKVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRJbnRMRSA9IGZ1bmN0aW9uIHJlYWRJbnRMRSAob2Zmc2V0LCBieXRlTGVuZ3RoLCBub0Fzc2VydCkge1xuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGJ5dGVMZW5ndGggPSBieXRlTGVuZ3RoIHwgMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIGJ5dGVMZW5ndGgsIHRoaXMubGVuZ3RoKVxuXG4gIHZhciB2YWwgPSB0aGlzW29mZnNldF1cbiAgdmFyIG11bCA9IDFcbiAgdmFyIGkgPSAwXG4gIHdoaWxlICgrK2kgPCBieXRlTGVuZ3RoICYmIChtdWwgKj0gMHgxMDApKSB7XG4gICAgdmFsICs9IHRoaXNbb2Zmc2V0ICsgaV0gKiBtdWxcbiAgfVxuICBtdWwgKj0gMHg4MFxuXG4gIGlmICh2YWwgPj0gbXVsKSB2YWwgLT0gTWF0aC5wb3coMiwgOCAqIGJ5dGVMZW5ndGgpXG5cbiAgcmV0dXJuIHZhbFxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRJbnRCRSA9IGZ1bmN0aW9uIHJlYWRJbnRCRSAob2Zmc2V0LCBieXRlTGVuZ3RoLCBub0Fzc2VydCkge1xuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGJ5dGVMZW5ndGggPSBieXRlTGVuZ3RoIHwgMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIGJ5dGVMZW5ndGgsIHRoaXMubGVuZ3RoKVxuXG4gIHZhciBpID0gYnl0ZUxlbmd0aFxuICB2YXIgbXVsID0gMVxuICB2YXIgdmFsID0gdGhpc1tvZmZzZXQgKyAtLWldXG4gIHdoaWxlIChpID4gMCAmJiAobXVsICo9IDB4MTAwKSkge1xuICAgIHZhbCArPSB0aGlzW29mZnNldCArIC0taV0gKiBtdWxcbiAgfVxuICBtdWwgKj0gMHg4MFxuXG4gIGlmICh2YWwgPj0gbXVsKSB2YWwgLT0gTWF0aC5wb3coMiwgOCAqIGJ5dGVMZW5ndGgpXG5cbiAgcmV0dXJuIHZhbFxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRJbnQ4ID0gZnVuY3Rpb24gcmVhZEludDggKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCAxLCB0aGlzLmxlbmd0aClcbiAgaWYgKCEodGhpc1tvZmZzZXRdICYgMHg4MCkpIHJldHVybiAodGhpc1tvZmZzZXRdKVxuICByZXR1cm4gKCgweGZmIC0gdGhpc1tvZmZzZXRdICsgMSkgKiAtMSlcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkSW50MTZMRSA9IGZ1bmN0aW9uIHJlYWRJbnQxNkxFIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgMiwgdGhpcy5sZW5ndGgpXG4gIHZhciB2YWwgPSB0aGlzW29mZnNldF0gfCAodGhpc1tvZmZzZXQgKyAxXSA8PCA4KVxuICByZXR1cm4gKHZhbCAmIDB4ODAwMCkgPyB2YWwgfCAweEZGRkYwMDAwIDogdmFsXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEludDE2QkUgPSBmdW5jdGlvbiByZWFkSW50MTZCRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDIsIHRoaXMubGVuZ3RoKVxuICB2YXIgdmFsID0gdGhpc1tvZmZzZXQgKyAxXSB8ICh0aGlzW29mZnNldF0gPDwgOClcbiAgcmV0dXJuICh2YWwgJiAweDgwMDApID8gdmFsIHwgMHhGRkZGMDAwMCA6IHZhbFxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRJbnQzMkxFID0gZnVuY3Rpb24gcmVhZEludDMyTEUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCA0LCB0aGlzLmxlbmd0aClcblxuICByZXR1cm4gKHRoaXNbb2Zmc2V0XSkgfFxuICAgICh0aGlzW29mZnNldCArIDFdIDw8IDgpIHxcbiAgICAodGhpc1tvZmZzZXQgKyAyXSA8PCAxNikgfFxuICAgICh0aGlzW29mZnNldCArIDNdIDw8IDI0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRJbnQzMkJFID0gZnVuY3Rpb24gcmVhZEludDMyQkUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCA0LCB0aGlzLmxlbmd0aClcblxuICByZXR1cm4gKHRoaXNbb2Zmc2V0XSA8PCAyNCkgfFxuICAgICh0aGlzW29mZnNldCArIDFdIDw8IDE2KSB8XG4gICAgKHRoaXNbb2Zmc2V0ICsgMl0gPDwgOCkgfFxuICAgICh0aGlzW29mZnNldCArIDNdKVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRGbG9hdExFID0gZnVuY3Rpb24gcmVhZEZsb2F0TEUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCA0LCB0aGlzLmxlbmd0aClcbiAgcmV0dXJuIGllZWU3NTQucmVhZCh0aGlzLCBvZmZzZXQsIHRydWUsIDIzLCA0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRGbG9hdEJFID0gZnVuY3Rpb24gcmVhZEZsb2F0QkUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCA0LCB0aGlzLmxlbmd0aClcbiAgcmV0dXJuIGllZWU3NTQucmVhZCh0aGlzLCBvZmZzZXQsIGZhbHNlLCAyMywgNClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkRG91YmxlTEUgPSBmdW5jdGlvbiByZWFkRG91YmxlTEUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCA4LCB0aGlzLmxlbmd0aClcbiAgcmV0dXJuIGllZWU3NTQucmVhZCh0aGlzLCBvZmZzZXQsIHRydWUsIDUyLCA4KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWREb3VibGVCRSA9IGZ1bmN0aW9uIHJlYWREb3VibGVCRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDgsIHRoaXMubGVuZ3RoKVxuICByZXR1cm4gaWVlZTc1NC5yZWFkKHRoaXMsIG9mZnNldCwgZmFsc2UsIDUyLCA4KVxufVxuXG5mdW5jdGlvbiBjaGVja0ludCAoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBleHQsIG1heCwgbWluKSB7XG4gIGlmICghQnVmZmVyLmlzQnVmZmVyKGJ1ZikpIHRocm93IG5ldyBUeXBlRXJyb3IoJ2J1ZmZlciBtdXN0IGJlIGEgQnVmZmVyIGluc3RhbmNlJylcbiAgaWYgKHZhbHVlID4gbWF4IHx8IHZhbHVlIDwgbWluKSB0aHJvdyBuZXcgUmFuZ2VFcnJvcigndmFsdWUgaXMgb3V0IG9mIGJvdW5kcycpXG4gIGlmIChvZmZzZXQgKyBleHQgPiBidWYubGVuZ3RoKSB0aHJvdyBuZXcgUmFuZ2VFcnJvcignaW5kZXggb3V0IG9mIHJhbmdlJylcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZVVJbnRMRSA9IGZ1bmN0aW9uIHdyaXRlVUludExFICh2YWx1ZSwgb2Zmc2V0LCBieXRlTGVuZ3RoLCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGJ5dGVMZW5ndGggPSBieXRlTGVuZ3RoIHwgMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCBieXRlTGVuZ3RoLCBNYXRoLnBvdygyLCA4ICogYnl0ZUxlbmd0aCksIDApXG5cbiAgdmFyIG11bCA9IDFcbiAgdmFyIGkgPSAwXG4gIHRoaXNbb2Zmc2V0XSA9IHZhbHVlICYgMHhGRlxuICB3aGlsZSAoKytpIDwgYnl0ZUxlbmd0aCAmJiAobXVsICo9IDB4MTAwKSkge1xuICAgIHRoaXNbb2Zmc2V0ICsgaV0gPSAodmFsdWUgLyBtdWwpICYgMHhGRlxuICB9XG5cbiAgcmV0dXJuIG9mZnNldCArIGJ5dGVMZW5ndGhcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZVVJbnRCRSA9IGZ1bmN0aW9uIHdyaXRlVUludEJFICh2YWx1ZSwgb2Zmc2V0LCBieXRlTGVuZ3RoLCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGJ5dGVMZW5ndGggPSBieXRlTGVuZ3RoIHwgMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCBieXRlTGVuZ3RoLCBNYXRoLnBvdygyLCA4ICogYnl0ZUxlbmd0aCksIDApXG5cbiAgdmFyIGkgPSBieXRlTGVuZ3RoIC0gMVxuICB2YXIgbXVsID0gMVxuICB0aGlzW29mZnNldCArIGldID0gdmFsdWUgJiAweEZGXG4gIHdoaWxlICgtLWkgPj0gMCAmJiAobXVsICo9IDB4MTAwKSkge1xuICAgIHRoaXNbb2Zmc2V0ICsgaV0gPSAodmFsdWUgLyBtdWwpICYgMHhGRlxuICB9XG5cbiAgcmV0dXJuIG9mZnNldCArIGJ5dGVMZW5ndGhcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZVVJbnQ4ID0gZnVuY3Rpb24gd3JpdGVVSW50OCAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCAxLCAweGZmLCAwKVxuICBpZiAoIUJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB2YWx1ZSA9IE1hdGguZmxvb3IodmFsdWUpXG4gIHRoaXNbb2Zmc2V0XSA9ICh2YWx1ZSAmIDB4ZmYpXG4gIHJldHVybiBvZmZzZXQgKyAxXG59XG5cbmZ1bmN0aW9uIG9iamVjdFdyaXRlVUludDE2IChidWYsIHZhbHVlLCBvZmZzZXQsIGxpdHRsZUVuZGlhbikge1xuICBpZiAodmFsdWUgPCAwKSB2YWx1ZSA9IDB4ZmZmZiArIHZhbHVlICsgMVxuICBmb3IgKHZhciBpID0gMCwgaiA9IE1hdGgubWluKGJ1Zi5sZW5ndGggLSBvZmZzZXQsIDIpOyBpIDwgajsgaSsrKSB7XG4gICAgYnVmW29mZnNldCArIGldID0gKHZhbHVlICYgKDB4ZmYgPDwgKDggKiAobGl0dGxlRW5kaWFuID8gaSA6IDEgLSBpKSkpKSA+Pj5cbiAgICAgIChsaXR0bGVFbmRpYW4gPyBpIDogMSAtIGkpICogOFxuICB9XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVVSW50MTZMRSA9IGZ1bmN0aW9uIHdyaXRlVUludDE2TEUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgMiwgMHhmZmZmLCAwKVxuICBpZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICB0aGlzW29mZnNldF0gPSAodmFsdWUgJiAweGZmKVxuICAgIHRoaXNbb2Zmc2V0ICsgMV0gPSAodmFsdWUgPj4+IDgpXG4gIH0gZWxzZSB7XG4gICAgb2JqZWN0V3JpdGVVSW50MTYodGhpcywgdmFsdWUsIG9mZnNldCwgdHJ1ZSlcbiAgfVxuICByZXR1cm4gb2Zmc2V0ICsgMlxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlVUludDE2QkUgPSBmdW5jdGlvbiB3cml0ZVVJbnQxNkJFICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIDIsIDB4ZmZmZiwgMClcbiAgaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgdGhpc1tvZmZzZXRdID0gKHZhbHVlID4+PiA4KVxuICAgIHRoaXNbb2Zmc2V0ICsgMV0gPSAodmFsdWUgJiAweGZmKVxuICB9IGVsc2Uge1xuICAgIG9iamVjdFdyaXRlVUludDE2KHRoaXMsIHZhbHVlLCBvZmZzZXQsIGZhbHNlKVxuICB9XG4gIHJldHVybiBvZmZzZXQgKyAyXG59XG5cbmZ1bmN0aW9uIG9iamVjdFdyaXRlVUludDMyIChidWYsIHZhbHVlLCBvZmZzZXQsIGxpdHRsZUVuZGlhbikge1xuICBpZiAodmFsdWUgPCAwKSB2YWx1ZSA9IDB4ZmZmZmZmZmYgKyB2YWx1ZSArIDFcbiAgZm9yICh2YXIgaSA9IDAsIGogPSBNYXRoLm1pbihidWYubGVuZ3RoIC0gb2Zmc2V0LCA0KTsgaSA8IGo7IGkrKykge1xuICAgIGJ1ZltvZmZzZXQgKyBpXSA9ICh2YWx1ZSA+Pj4gKGxpdHRsZUVuZGlhbiA/IGkgOiAzIC0gaSkgKiA4KSAmIDB4ZmZcbiAgfVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlVUludDMyTEUgPSBmdW5jdGlvbiB3cml0ZVVJbnQzMkxFICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIDQsIDB4ZmZmZmZmZmYsIDApXG4gIGlmIChCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkge1xuICAgIHRoaXNbb2Zmc2V0ICsgM10gPSAodmFsdWUgPj4+IDI0KVxuICAgIHRoaXNbb2Zmc2V0ICsgMl0gPSAodmFsdWUgPj4+IDE2KVxuICAgIHRoaXNbb2Zmc2V0ICsgMV0gPSAodmFsdWUgPj4+IDgpXG4gICAgdGhpc1tvZmZzZXRdID0gKHZhbHVlICYgMHhmZilcbiAgfSBlbHNlIHtcbiAgICBvYmplY3RXcml0ZVVJbnQzMih0aGlzLCB2YWx1ZSwgb2Zmc2V0LCB0cnVlKVxuICB9XG4gIHJldHVybiBvZmZzZXQgKyA0XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVVSW50MzJCRSA9IGZ1bmN0aW9uIHdyaXRlVUludDMyQkUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgNCwgMHhmZmZmZmZmZiwgMClcbiAgaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgdGhpc1tvZmZzZXRdID0gKHZhbHVlID4+PiAyNClcbiAgICB0aGlzW29mZnNldCArIDFdID0gKHZhbHVlID4+PiAxNilcbiAgICB0aGlzW29mZnNldCArIDJdID0gKHZhbHVlID4+PiA4KVxuICAgIHRoaXNbb2Zmc2V0ICsgM10gPSAodmFsdWUgJiAweGZmKVxuICB9IGVsc2Uge1xuICAgIG9iamVjdFdyaXRlVUludDMyKHRoaXMsIHZhbHVlLCBvZmZzZXQsIGZhbHNlKVxuICB9XG4gIHJldHVybiBvZmZzZXQgKyA0XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVJbnRMRSA9IGZ1bmN0aW9uIHdyaXRlSW50TEUgKHZhbHVlLCBvZmZzZXQsIGJ5dGVMZW5ndGgsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIHZhciBsaW1pdCA9IE1hdGgucG93KDIsIDggKiBieXRlTGVuZ3RoIC0gMSlcblxuICAgIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIGJ5dGVMZW5ndGgsIGxpbWl0IC0gMSwgLWxpbWl0KVxuICB9XG5cbiAgdmFyIGkgPSAwXG4gIHZhciBtdWwgPSAxXG4gIHZhciBzdWIgPSB2YWx1ZSA8IDAgPyAxIDogMFxuICB0aGlzW29mZnNldF0gPSB2YWx1ZSAmIDB4RkZcbiAgd2hpbGUgKCsraSA8IGJ5dGVMZW5ndGggJiYgKG11bCAqPSAweDEwMCkpIHtcbiAgICB0aGlzW29mZnNldCArIGldID0gKCh2YWx1ZSAvIG11bCkgPj4gMCkgLSBzdWIgJiAweEZGXG4gIH1cblxuICByZXR1cm4gb2Zmc2V0ICsgYnl0ZUxlbmd0aFxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlSW50QkUgPSBmdW5jdGlvbiB3cml0ZUludEJFICh2YWx1ZSwgb2Zmc2V0LCBieXRlTGVuZ3RoLCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICB2YXIgbGltaXQgPSBNYXRoLnBvdygyLCA4ICogYnl0ZUxlbmd0aCAtIDEpXG5cbiAgICBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCBieXRlTGVuZ3RoLCBsaW1pdCAtIDEsIC1saW1pdClcbiAgfVxuXG4gIHZhciBpID0gYnl0ZUxlbmd0aCAtIDFcbiAgdmFyIG11bCA9IDFcbiAgdmFyIHN1YiA9IHZhbHVlIDwgMCA/IDEgOiAwXG4gIHRoaXNbb2Zmc2V0ICsgaV0gPSB2YWx1ZSAmIDB4RkZcbiAgd2hpbGUgKC0taSA+PSAwICYmIChtdWwgKj0gMHgxMDApKSB7XG4gICAgdGhpc1tvZmZzZXQgKyBpXSA9ICgodmFsdWUgLyBtdWwpID4+IDApIC0gc3ViICYgMHhGRlxuICB9XG5cbiAgcmV0dXJuIG9mZnNldCArIGJ5dGVMZW5ndGhcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUludDggPSBmdW5jdGlvbiB3cml0ZUludDggKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgMSwgMHg3ZiwgLTB4ODApXG4gIGlmICghQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHZhbHVlID0gTWF0aC5mbG9vcih2YWx1ZSlcbiAgaWYgKHZhbHVlIDwgMCkgdmFsdWUgPSAweGZmICsgdmFsdWUgKyAxXG4gIHRoaXNbb2Zmc2V0XSA9ICh2YWx1ZSAmIDB4ZmYpXG4gIHJldHVybiBvZmZzZXQgKyAxXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVJbnQxNkxFID0gZnVuY3Rpb24gd3JpdGVJbnQxNkxFICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIDIsIDB4N2ZmZiwgLTB4ODAwMClcbiAgaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgdGhpc1tvZmZzZXRdID0gKHZhbHVlICYgMHhmZilcbiAgICB0aGlzW29mZnNldCArIDFdID0gKHZhbHVlID4+PiA4KVxuICB9IGVsc2Uge1xuICAgIG9iamVjdFdyaXRlVUludDE2KHRoaXMsIHZhbHVlLCBvZmZzZXQsIHRydWUpXG4gIH1cbiAgcmV0dXJuIG9mZnNldCArIDJcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUludDE2QkUgPSBmdW5jdGlvbiB3cml0ZUludDE2QkUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgMiwgMHg3ZmZmLCAtMHg4MDAwKVxuICBpZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICB0aGlzW29mZnNldF0gPSAodmFsdWUgPj4+IDgpXG4gICAgdGhpc1tvZmZzZXQgKyAxXSA9ICh2YWx1ZSAmIDB4ZmYpXG4gIH0gZWxzZSB7XG4gICAgb2JqZWN0V3JpdGVVSW50MTYodGhpcywgdmFsdWUsIG9mZnNldCwgZmFsc2UpXG4gIH1cbiAgcmV0dXJuIG9mZnNldCArIDJcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUludDMyTEUgPSBmdW5jdGlvbiB3cml0ZUludDMyTEUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgNCwgMHg3ZmZmZmZmZiwgLTB4ODAwMDAwMDApXG4gIGlmIChCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkge1xuICAgIHRoaXNbb2Zmc2V0XSA9ICh2YWx1ZSAmIDB4ZmYpXG4gICAgdGhpc1tvZmZzZXQgKyAxXSA9ICh2YWx1ZSA+Pj4gOClcbiAgICB0aGlzW29mZnNldCArIDJdID0gKHZhbHVlID4+PiAxNilcbiAgICB0aGlzW29mZnNldCArIDNdID0gKHZhbHVlID4+PiAyNClcbiAgfSBlbHNlIHtcbiAgICBvYmplY3RXcml0ZVVJbnQzMih0aGlzLCB2YWx1ZSwgb2Zmc2V0LCB0cnVlKVxuICB9XG4gIHJldHVybiBvZmZzZXQgKyA0XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVJbnQzMkJFID0gZnVuY3Rpb24gd3JpdGVJbnQzMkJFICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIDQsIDB4N2ZmZmZmZmYsIC0weDgwMDAwMDAwKVxuICBpZiAodmFsdWUgPCAwKSB2YWx1ZSA9IDB4ZmZmZmZmZmYgKyB2YWx1ZSArIDFcbiAgaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgdGhpc1tvZmZzZXRdID0gKHZhbHVlID4+PiAyNClcbiAgICB0aGlzW29mZnNldCArIDFdID0gKHZhbHVlID4+PiAxNilcbiAgICB0aGlzW29mZnNldCArIDJdID0gKHZhbHVlID4+PiA4KVxuICAgIHRoaXNbb2Zmc2V0ICsgM10gPSAodmFsdWUgJiAweGZmKVxuICB9IGVsc2Uge1xuICAgIG9iamVjdFdyaXRlVUludDMyKHRoaXMsIHZhbHVlLCBvZmZzZXQsIGZhbHNlKVxuICB9XG4gIHJldHVybiBvZmZzZXQgKyA0XG59XG5cbmZ1bmN0aW9uIGNoZWNrSUVFRTc1NCAoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBleHQsIG1heCwgbWluKSB7XG4gIGlmIChvZmZzZXQgKyBleHQgPiBidWYubGVuZ3RoKSB0aHJvdyBuZXcgUmFuZ2VFcnJvcignaW5kZXggb3V0IG9mIHJhbmdlJylcbiAgaWYgKG9mZnNldCA8IDApIHRocm93IG5ldyBSYW5nZUVycm9yKCdpbmRleCBvdXQgb2YgcmFuZ2UnKVxufVxuXG5mdW5jdGlvbiB3cml0ZUZsb2F0IChidWYsIHZhbHVlLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIGNoZWNrSUVFRTc1NChidWYsIHZhbHVlLCBvZmZzZXQsIDQsIDMuNDAyODIzNDY2Mzg1Mjg4NmUrMzgsIC0zLjQwMjgyMzQ2NjM4NTI4ODZlKzM4KVxuICB9XG4gIGllZWU3NTQud3JpdGUoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIDIzLCA0KVxuICByZXR1cm4gb2Zmc2V0ICsgNFxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlRmxvYXRMRSA9IGZ1bmN0aW9uIHdyaXRlRmxvYXRMRSAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgcmV0dXJuIHdyaXRlRmxvYXQodGhpcywgdmFsdWUsIG9mZnNldCwgdHJ1ZSwgbm9Bc3NlcnQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVGbG9hdEJFID0gZnVuY3Rpb24gd3JpdGVGbG9hdEJFICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gd3JpdGVGbG9hdCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCBmYWxzZSwgbm9Bc3NlcnQpXG59XG5cbmZ1bmN0aW9uIHdyaXRlRG91YmxlIChidWYsIHZhbHVlLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIGNoZWNrSUVFRTc1NChidWYsIHZhbHVlLCBvZmZzZXQsIDgsIDEuNzk3NjkzMTM0ODYyMzE1N0UrMzA4LCAtMS43OTc2OTMxMzQ4NjIzMTU3RSszMDgpXG4gIH1cbiAgaWVlZTc1NC53cml0ZShidWYsIHZhbHVlLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgNTIsIDgpXG4gIHJldHVybiBvZmZzZXQgKyA4XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVEb3VibGVMRSA9IGZ1bmN0aW9uIHdyaXRlRG91YmxlTEUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiB3cml0ZURvdWJsZSh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCB0cnVlLCBub0Fzc2VydClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZURvdWJsZUJFID0gZnVuY3Rpb24gd3JpdGVEb3VibGVCRSAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgcmV0dXJuIHdyaXRlRG91YmxlKHRoaXMsIHZhbHVlLCBvZmZzZXQsIGZhbHNlLCBub0Fzc2VydClcbn1cblxuLy8gY29weSh0YXJnZXRCdWZmZXIsIHRhcmdldFN0YXJ0PTAsIHNvdXJjZVN0YXJ0PTAsIHNvdXJjZUVuZD1idWZmZXIubGVuZ3RoKVxuQnVmZmVyLnByb3RvdHlwZS5jb3B5ID0gZnVuY3Rpb24gY29weSAodGFyZ2V0LCB0YXJnZXRTdGFydCwgc3RhcnQsIGVuZCkge1xuICBpZiAoIXN0YXJ0KSBzdGFydCA9IDBcbiAgaWYgKCFlbmQgJiYgZW5kICE9PSAwKSBlbmQgPSB0aGlzLmxlbmd0aFxuICBpZiAodGFyZ2V0U3RhcnQgPj0gdGFyZ2V0Lmxlbmd0aCkgdGFyZ2V0U3RhcnQgPSB0YXJnZXQubGVuZ3RoXG4gIGlmICghdGFyZ2V0U3RhcnQpIHRhcmdldFN0YXJ0ID0gMFxuICBpZiAoZW5kID4gMCAmJiBlbmQgPCBzdGFydCkgZW5kID0gc3RhcnRcblxuICAvLyBDb3B5IDAgYnl0ZXM7IHdlJ3JlIGRvbmVcbiAgaWYgKGVuZCA9PT0gc3RhcnQpIHJldHVybiAwXG4gIGlmICh0YXJnZXQubGVuZ3RoID09PSAwIHx8IHRoaXMubGVuZ3RoID09PSAwKSByZXR1cm4gMFxuXG4gIC8vIEZhdGFsIGVycm9yIGNvbmRpdGlvbnNcbiAgaWYgKHRhcmdldFN0YXJ0IDwgMCkge1xuICAgIHRocm93IG5ldyBSYW5nZUVycm9yKCd0YXJnZXRTdGFydCBvdXQgb2YgYm91bmRzJylcbiAgfVxuICBpZiAoc3RhcnQgPCAwIHx8IHN0YXJ0ID49IHRoaXMubGVuZ3RoKSB0aHJvdyBuZXcgUmFuZ2VFcnJvcignc291cmNlU3RhcnQgb3V0IG9mIGJvdW5kcycpXG4gIGlmIChlbmQgPCAwKSB0aHJvdyBuZXcgUmFuZ2VFcnJvcignc291cmNlRW5kIG91dCBvZiBib3VuZHMnKVxuXG4gIC8vIEFyZSB3ZSBvb2I/XG4gIGlmIChlbmQgPiB0aGlzLmxlbmd0aCkgZW5kID0gdGhpcy5sZW5ndGhcbiAgaWYgKHRhcmdldC5sZW5ndGggLSB0YXJnZXRTdGFydCA8IGVuZCAtIHN0YXJ0KSB7XG4gICAgZW5kID0gdGFyZ2V0Lmxlbmd0aCAtIHRhcmdldFN0YXJ0ICsgc3RhcnRcbiAgfVxuXG4gIHZhciBsZW4gPSBlbmQgLSBzdGFydFxuICB2YXIgaVxuXG4gIGlmICh0aGlzID09PSB0YXJnZXQgJiYgc3RhcnQgPCB0YXJnZXRTdGFydCAmJiB0YXJnZXRTdGFydCA8IGVuZCkge1xuICAgIC8vIGRlc2NlbmRpbmcgY29weSBmcm9tIGVuZFxuICAgIGZvciAoaSA9IGxlbiAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgICB0YXJnZXRbaSArIHRhcmdldFN0YXJ0XSA9IHRoaXNbaSArIHN0YXJ0XVxuICAgIH1cbiAgfSBlbHNlIGlmIChsZW4gPCAxMDAwIHx8ICFCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkge1xuICAgIC8vIGFzY2VuZGluZyBjb3B5IGZyb20gc3RhcnRcbiAgICBmb3IgKGkgPSAwOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgIHRhcmdldFtpICsgdGFyZ2V0U3RhcnRdID0gdGhpc1tpICsgc3RhcnRdXG4gICAgfVxuICB9IGVsc2Uge1xuICAgIFVpbnQ4QXJyYXkucHJvdG90eXBlLnNldC5jYWxsKFxuICAgICAgdGFyZ2V0LFxuICAgICAgdGhpcy5zdWJhcnJheShzdGFydCwgc3RhcnQgKyBsZW4pLFxuICAgICAgdGFyZ2V0U3RhcnRcbiAgICApXG4gIH1cblxuICByZXR1cm4gbGVuXG59XG5cbi8vIGZpbGwodmFsdWUsIHN0YXJ0PTAsIGVuZD1idWZmZXIubGVuZ3RoKVxuQnVmZmVyLnByb3RvdHlwZS5maWxsID0gZnVuY3Rpb24gZmlsbCAodmFsdWUsIHN0YXJ0LCBlbmQpIHtcbiAgaWYgKCF2YWx1ZSkgdmFsdWUgPSAwXG4gIGlmICghc3RhcnQpIHN0YXJ0ID0gMFxuICBpZiAoIWVuZCkgZW5kID0gdGhpcy5sZW5ndGhcblxuICBpZiAoZW5kIDwgc3RhcnQpIHRocm93IG5ldyBSYW5nZUVycm9yKCdlbmQgPCBzdGFydCcpXG5cbiAgLy8gRmlsbCAwIGJ5dGVzOyB3ZSdyZSBkb25lXG4gIGlmIChlbmQgPT09IHN0YXJ0KSByZXR1cm5cbiAgaWYgKHRoaXMubGVuZ3RoID09PSAwKSByZXR1cm5cblxuICBpZiAoc3RhcnQgPCAwIHx8IHN0YXJ0ID49IHRoaXMubGVuZ3RoKSB0aHJvdyBuZXcgUmFuZ2VFcnJvcignc3RhcnQgb3V0IG9mIGJvdW5kcycpXG4gIGlmIChlbmQgPCAwIHx8IGVuZCA+IHRoaXMubGVuZ3RoKSB0aHJvdyBuZXcgUmFuZ2VFcnJvcignZW5kIG91dCBvZiBib3VuZHMnKVxuXG4gIHZhciBpXG4gIGlmICh0eXBlb2YgdmFsdWUgPT09ICdudW1iZXInKSB7XG4gICAgZm9yIChpID0gc3RhcnQ7IGkgPCBlbmQ7IGkrKykge1xuICAgICAgdGhpc1tpXSA9IHZhbHVlXG4gICAgfVxuICB9IGVsc2Uge1xuICAgIHZhciBieXRlcyA9IHV0ZjhUb0J5dGVzKHZhbHVlLnRvU3RyaW5nKCkpXG4gICAgdmFyIGxlbiA9IGJ5dGVzLmxlbmd0aFxuICAgIGZvciAoaSA9IHN0YXJ0OyBpIDwgZW5kOyBpKyspIHtcbiAgICAgIHRoaXNbaV0gPSBieXRlc1tpICUgbGVuXVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiB0aGlzXG59XG5cbi8vIEhFTFBFUiBGVU5DVElPTlNcbi8vID09PT09PT09PT09PT09PT1cblxudmFyIElOVkFMSURfQkFTRTY0X1JFID0gL1teK1xcLzAtOUEtWmEtei1fXS9nXG5cbmZ1bmN0aW9uIGJhc2U2NGNsZWFuIChzdHIpIHtcbiAgLy8gTm9kZSBzdHJpcHMgb3V0IGludmFsaWQgY2hhcmFjdGVycyBsaWtlIFxcbiBhbmQgXFx0IGZyb20gdGhlIHN0cmluZywgYmFzZTY0LWpzIGRvZXMgbm90XG4gIHN0ciA9IHN0cmluZ3RyaW0oc3RyKS5yZXBsYWNlKElOVkFMSURfQkFTRTY0X1JFLCAnJylcbiAgLy8gTm9kZSBjb252ZXJ0cyBzdHJpbmdzIHdpdGggbGVuZ3RoIDwgMiB0byAnJ1xuICBpZiAoc3RyLmxlbmd0aCA8IDIpIHJldHVybiAnJ1xuICAvLyBOb2RlIGFsbG93cyBmb3Igbm9uLXBhZGRlZCBiYXNlNjQgc3RyaW5ncyAobWlzc2luZyB0cmFpbGluZyA9PT0pLCBiYXNlNjQtanMgZG9lcyBub3RcbiAgd2hpbGUgKHN0ci5sZW5ndGggJSA0ICE9PSAwKSB7XG4gICAgc3RyID0gc3RyICsgJz0nXG4gIH1cbiAgcmV0dXJuIHN0clxufVxuXG5mdW5jdGlvbiBzdHJpbmd0cmltIChzdHIpIHtcbiAgaWYgKHN0ci50cmltKSByZXR1cm4gc3RyLnRyaW0oKVxuICByZXR1cm4gc3RyLnJlcGxhY2UoL15cXHMrfFxccyskL2csICcnKVxufVxuXG5mdW5jdGlvbiB0b0hleCAobikge1xuICBpZiAobiA8IDE2KSByZXR1cm4gJzAnICsgbi50b1N0cmluZygxNilcbiAgcmV0dXJuIG4udG9TdHJpbmcoMTYpXG59XG5cbmZ1bmN0aW9uIHV0ZjhUb0J5dGVzIChzdHJpbmcsIHVuaXRzKSB7XG4gIHVuaXRzID0gdW5pdHMgfHwgSW5maW5pdHlcbiAgdmFyIGNvZGVQb2ludFxuICB2YXIgbGVuZ3RoID0gc3RyaW5nLmxlbmd0aFxuICB2YXIgbGVhZFN1cnJvZ2F0ZSA9IG51bGxcbiAgdmFyIGJ5dGVzID0gW11cblxuICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgY29kZVBvaW50ID0gc3RyaW5nLmNoYXJDb2RlQXQoaSlcblxuICAgIC8vIGlzIHN1cnJvZ2F0ZSBjb21wb25lbnRcbiAgICBpZiAoY29kZVBvaW50ID4gMHhEN0ZGICYmIGNvZGVQb2ludCA8IDB4RTAwMCkge1xuICAgICAgLy8gbGFzdCBjaGFyIHdhcyBhIGxlYWRcbiAgICAgIGlmICghbGVhZFN1cnJvZ2F0ZSkge1xuICAgICAgICAvLyBubyBsZWFkIHlldFxuICAgICAgICBpZiAoY29kZVBvaW50ID4gMHhEQkZGKSB7XG4gICAgICAgICAgLy8gdW5leHBlY3RlZCB0cmFpbFxuICAgICAgICAgIGlmICgodW5pdHMgLT0gMykgPiAtMSkgYnl0ZXMucHVzaCgweEVGLCAweEJGLCAweEJEKVxuICAgICAgICAgIGNvbnRpbnVlXG4gICAgICAgIH0gZWxzZSBpZiAoaSArIDEgPT09IGxlbmd0aCkge1xuICAgICAgICAgIC8vIHVucGFpcmVkIGxlYWRcbiAgICAgICAgICBpZiAoKHVuaXRzIC09IDMpID4gLTEpIGJ5dGVzLnB1c2goMHhFRiwgMHhCRiwgMHhCRClcbiAgICAgICAgICBjb250aW51ZVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gdmFsaWQgbGVhZFxuICAgICAgICBsZWFkU3Vycm9nYXRlID0gY29kZVBvaW50XG5cbiAgICAgICAgY29udGludWVcbiAgICAgIH1cblxuICAgICAgLy8gMiBsZWFkcyBpbiBhIHJvd1xuICAgICAgaWYgKGNvZGVQb2ludCA8IDB4REMwMCkge1xuICAgICAgICBpZiAoKHVuaXRzIC09IDMpID4gLTEpIGJ5dGVzLnB1c2goMHhFRiwgMHhCRiwgMHhCRClcbiAgICAgICAgbGVhZFN1cnJvZ2F0ZSA9IGNvZGVQb2ludFxuICAgICAgICBjb250aW51ZVxuICAgICAgfVxuXG4gICAgICAvLyB2YWxpZCBzdXJyb2dhdGUgcGFpclxuICAgICAgY29kZVBvaW50ID0gKGxlYWRTdXJyb2dhdGUgLSAweEQ4MDAgPDwgMTAgfCBjb2RlUG9pbnQgLSAweERDMDApICsgMHgxMDAwMFxuICAgIH0gZWxzZSBpZiAobGVhZFN1cnJvZ2F0ZSkge1xuICAgICAgLy8gdmFsaWQgYm1wIGNoYXIsIGJ1dCBsYXN0IGNoYXIgd2FzIGEgbGVhZFxuICAgICAgaWYgKCh1bml0cyAtPSAzKSA+IC0xKSBieXRlcy5wdXNoKDB4RUYsIDB4QkYsIDB4QkQpXG4gICAgfVxuXG4gICAgbGVhZFN1cnJvZ2F0ZSA9IG51bGxcblxuICAgIC8vIGVuY29kZSB1dGY4XG4gICAgaWYgKGNvZGVQb2ludCA8IDB4ODApIHtcbiAgICAgIGlmICgodW5pdHMgLT0gMSkgPCAwKSBicmVha1xuICAgICAgYnl0ZXMucHVzaChjb2RlUG9pbnQpXG4gICAgfSBlbHNlIGlmIChjb2RlUG9pbnQgPCAweDgwMCkge1xuICAgICAgaWYgKCh1bml0cyAtPSAyKSA8IDApIGJyZWFrXG4gICAgICBieXRlcy5wdXNoKFxuICAgICAgICBjb2RlUG9pbnQgPj4gMHg2IHwgMHhDMCxcbiAgICAgICAgY29kZVBvaW50ICYgMHgzRiB8IDB4ODBcbiAgICAgIClcbiAgICB9IGVsc2UgaWYgKGNvZGVQb2ludCA8IDB4MTAwMDApIHtcbiAgICAgIGlmICgodW5pdHMgLT0gMykgPCAwKSBicmVha1xuICAgICAgYnl0ZXMucHVzaChcbiAgICAgICAgY29kZVBvaW50ID4+IDB4QyB8IDB4RTAsXG4gICAgICAgIGNvZGVQb2ludCA+PiAweDYgJiAweDNGIHwgMHg4MCxcbiAgICAgICAgY29kZVBvaW50ICYgMHgzRiB8IDB4ODBcbiAgICAgIClcbiAgICB9IGVsc2UgaWYgKGNvZGVQb2ludCA8IDB4MTEwMDAwKSB7XG4gICAgICBpZiAoKHVuaXRzIC09IDQpIDwgMCkgYnJlYWtcbiAgICAgIGJ5dGVzLnB1c2goXG4gICAgICAgIGNvZGVQb2ludCA+PiAweDEyIHwgMHhGMCxcbiAgICAgICAgY29kZVBvaW50ID4+IDB4QyAmIDB4M0YgfCAweDgwLFxuICAgICAgICBjb2RlUG9pbnQgPj4gMHg2ICYgMHgzRiB8IDB4ODAsXG4gICAgICAgIGNvZGVQb2ludCAmIDB4M0YgfCAweDgwXG4gICAgICApXG4gICAgfSBlbHNlIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBjb2RlIHBvaW50JylcbiAgICB9XG4gIH1cblxuICByZXR1cm4gYnl0ZXNcbn1cblxuZnVuY3Rpb24gYXNjaWlUb0J5dGVzIChzdHIpIHtcbiAgdmFyIGJ5dGVBcnJheSA9IFtdXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgc3RyLmxlbmd0aDsgaSsrKSB7XG4gICAgLy8gTm9kZSdzIGNvZGUgc2VlbXMgdG8gYmUgZG9pbmcgdGhpcyBhbmQgbm90ICYgMHg3Ri4uXG4gICAgYnl0ZUFycmF5LnB1c2goc3RyLmNoYXJDb2RlQXQoaSkgJiAweEZGKVxuICB9XG4gIHJldHVybiBieXRlQXJyYXlcbn1cblxuZnVuY3Rpb24gdXRmMTZsZVRvQnl0ZXMgKHN0ciwgdW5pdHMpIHtcbiAgdmFyIGMsIGhpLCBsb1xuICB2YXIgYnl0ZUFycmF5ID0gW11cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBzdHIubGVuZ3RoOyBpKyspIHtcbiAgICBpZiAoKHVuaXRzIC09IDIpIDwgMCkgYnJlYWtcblxuICAgIGMgPSBzdHIuY2hhckNvZGVBdChpKVxuICAgIGhpID0gYyA+PiA4XG4gICAgbG8gPSBjICUgMjU2XG4gICAgYnl0ZUFycmF5LnB1c2gobG8pXG4gICAgYnl0ZUFycmF5LnB1c2goaGkpXG4gIH1cblxuICByZXR1cm4gYnl0ZUFycmF5XG59XG5cbmZ1bmN0aW9uIGJhc2U2NFRvQnl0ZXMgKHN0cikge1xuICByZXR1cm4gYmFzZTY0LnRvQnl0ZUFycmF5KGJhc2U2NGNsZWFuKHN0cikpXG59XG5cbmZ1bmN0aW9uIGJsaXRCdWZmZXIgKHNyYywgZHN0LCBvZmZzZXQsIGxlbmd0aCkge1xuICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgaWYgKChpICsgb2Zmc2V0ID49IGRzdC5sZW5ndGgpIHx8IChpID49IHNyYy5sZW5ndGgpKSBicmVha1xuICAgIGRzdFtpICsgb2Zmc2V0XSA9IHNyY1tpXVxuICB9XG4gIHJldHVybiBpXG59XG4iLCIndXNlIHN0cmljdCdcblxuZXhwb3J0cy50b0J5dGVBcnJheSA9IHRvQnl0ZUFycmF5XG5leHBvcnRzLmZyb21CeXRlQXJyYXkgPSBmcm9tQnl0ZUFycmF5XG5cbnZhciBsb29rdXAgPSBbXVxudmFyIHJldkxvb2t1cCA9IFtdXG52YXIgQXJyID0gdHlwZW9mIFVpbnQ4QXJyYXkgIT09ICd1bmRlZmluZWQnID8gVWludDhBcnJheSA6IEFycmF5XG5cbmZ1bmN0aW9uIGluaXQgKCkge1xuICB2YXIgY29kZSA9ICdBQkNERUZHSElKS0xNTk9QUVJTVFVWV1hZWmFiY2RlZmdoaWprbG1ub3BxcnN0dXZ3eHl6MDEyMzQ1Njc4OSsvJ1xuICBmb3IgKHZhciBpID0gMCwgbGVuID0gY29kZS5sZW5ndGg7IGkgPCBsZW47ICsraSkge1xuICAgIGxvb2t1cFtpXSA9IGNvZGVbaV1cbiAgICByZXZMb29rdXBbY29kZS5jaGFyQ29kZUF0KGkpXSA9IGlcbiAgfVxuXG4gIHJldkxvb2t1cFsnLScuY2hhckNvZGVBdCgwKV0gPSA2MlxuICByZXZMb29rdXBbJ18nLmNoYXJDb2RlQXQoMCldID0gNjNcbn1cblxuaW5pdCgpXG5cbmZ1bmN0aW9uIHRvQnl0ZUFycmF5IChiNjQpIHtcbiAgdmFyIGksIGosIGwsIHRtcCwgcGxhY2VIb2xkZXJzLCBhcnJcbiAgdmFyIGxlbiA9IGI2NC5sZW5ndGhcblxuICBpZiAobGVuICUgNCA+IDApIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgc3RyaW5nLiBMZW5ndGggbXVzdCBiZSBhIG11bHRpcGxlIG9mIDQnKVxuICB9XG5cbiAgLy8gdGhlIG51bWJlciBvZiBlcXVhbCBzaWducyAocGxhY2UgaG9sZGVycylcbiAgLy8gaWYgdGhlcmUgYXJlIHR3byBwbGFjZWhvbGRlcnMsIHRoYW4gdGhlIHR3byBjaGFyYWN0ZXJzIGJlZm9yZSBpdFxuICAvLyByZXByZXNlbnQgb25lIGJ5dGVcbiAgLy8gaWYgdGhlcmUgaXMgb25seSBvbmUsIHRoZW4gdGhlIHRocmVlIGNoYXJhY3RlcnMgYmVmb3JlIGl0IHJlcHJlc2VudCAyIGJ5dGVzXG4gIC8vIHRoaXMgaXMganVzdCBhIGNoZWFwIGhhY2sgdG8gbm90IGRvIGluZGV4T2YgdHdpY2VcbiAgcGxhY2VIb2xkZXJzID0gYjY0W2xlbiAtIDJdID09PSAnPScgPyAyIDogYjY0W2xlbiAtIDFdID09PSAnPScgPyAxIDogMFxuXG4gIC8vIGJhc2U2NCBpcyA0LzMgKyB1cCB0byB0d28gY2hhcmFjdGVycyBvZiB0aGUgb3JpZ2luYWwgZGF0YVxuICBhcnIgPSBuZXcgQXJyKGxlbiAqIDMgLyA0IC0gcGxhY2VIb2xkZXJzKVxuXG4gIC8vIGlmIHRoZXJlIGFyZSBwbGFjZWhvbGRlcnMsIG9ubHkgZ2V0IHVwIHRvIHRoZSBsYXN0IGNvbXBsZXRlIDQgY2hhcnNcbiAgbCA9IHBsYWNlSG9sZGVycyA+IDAgPyBsZW4gLSA0IDogbGVuXG5cbiAgdmFyIEwgPSAwXG5cbiAgZm9yIChpID0gMCwgaiA9IDA7IGkgPCBsOyBpICs9IDQsIGogKz0gMykge1xuICAgIHRtcCA9IChyZXZMb29rdXBbYjY0LmNoYXJDb2RlQXQoaSldIDw8IDE4KSB8IChyZXZMb29rdXBbYjY0LmNoYXJDb2RlQXQoaSArIDEpXSA8PCAxMikgfCAocmV2TG9va3VwW2I2NC5jaGFyQ29kZUF0KGkgKyAyKV0gPDwgNikgfCByZXZMb29rdXBbYjY0LmNoYXJDb2RlQXQoaSArIDMpXVxuICAgIGFycltMKytdID0gKHRtcCA+PiAxNikgJiAweEZGXG4gICAgYXJyW0wrK10gPSAodG1wID4+IDgpICYgMHhGRlxuICAgIGFycltMKytdID0gdG1wICYgMHhGRlxuICB9XG5cbiAgaWYgKHBsYWNlSG9sZGVycyA9PT0gMikge1xuICAgIHRtcCA9IChyZXZMb29rdXBbYjY0LmNoYXJDb2RlQXQoaSldIDw8IDIpIHwgKHJldkxvb2t1cFtiNjQuY2hhckNvZGVBdChpICsgMSldID4+IDQpXG4gICAgYXJyW0wrK10gPSB0bXAgJiAweEZGXG4gIH0gZWxzZSBpZiAocGxhY2VIb2xkZXJzID09PSAxKSB7XG4gICAgdG1wID0gKHJldkxvb2t1cFtiNjQuY2hhckNvZGVBdChpKV0gPDwgMTApIHwgKHJldkxvb2t1cFtiNjQuY2hhckNvZGVBdChpICsgMSldIDw8IDQpIHwgKHJldkxvb2t1cFtiNjQuY2hhckNvZGVBdChpICsgMildID4+IDIpXG4gICAgYXJyW0wrK10gPSAodG1wID4+IDgpICYgMHhGRlxuICAgIGFycltMKytdID0gdG1wICYgMHhGRlxuICB9XG5cbiAgcmV0dXJuIGFyclxufVxuXG5mdW5jdGlvbiB0cmlwbGV0VG9CYXNlNjQgKG51bSkge1xuICByZXR1cm4gbG9va3VwW251bSA+PiAxOCAmIDB4M0ZdICsgbG9va3VwW251bSA+PiAxMiAmIDB4M0ZdICsgbG9va3VwW251bSA+PiA2ICYgMHgzRl0gKyBsb29rdXBbbnVtICYgMHgzRl1cbn1cblxuZnVuY3Rpb24gZW5jb2RlQ2h1bmsgKHVpbnQ4LCBzdGFydCwgZW5kKSB7XG4gIHZhciB0bXBcbiAgdmFyIG91dHB1dCA9IFtdXG4gIGZvciAodmFyIGkgPSBzdGFydDsgaSA8IGVuZDsgaSArPSAzKSB7XG4gICAgdG1wID0gKHVpbnQ4W2ldIDw8IDE2KSArICh1aW50OFtpICsgMV0gPDwgOCkgKyAodWludDhbaSArIDJdKVxuICAgIG91dHB1dC5wdXNoKHRyaXBsZXRUb0Jhc2U2NCh0bXApKVxuICB9XG4gIHJldHVybiBvdXRwdXQuam9pbignJylcbn1cblxuZnVuY3Rpb24gZnJvbUJ5dGVBcnJheSAodWludDgpIHtcbiAgdmFyIHRtcFxuICB2YXIgbGVuID0gdWludDgubGVuZ3RoXG4gIHZhciBleHRyYUJ5dGVzID0gbGVuICUgMyAvLyBpZiB3ZSBoYXZlIDEgYnl0ZSBsZWZ0LCBwYWQgMiBieXRlc1xuICB2YXIgb3V0cHV0ID0gJydcbiAgdmFyIHBhcnRzID0gW11cbiAgdmFyIG1heENodW5rTGVuZ3RoID0gMTYzODMgLy8gbXVzdCBiZSBtdWx0aXBsZSBvZiAzXG5cbiAgLy8gZ28gdGhyb3VnaCB0aGUgYXJyYXkgZXZlcnkgdGhyZWUgYnl0ZXMsIHdlJ2xsIGRlYWwgd2l0aCB0cmFpbGluZyBzdHVmZiBsYXRlclxuICBmb3IgKHZhciBpID0gMCwgbGVuMiA9IGxlbiAtIGV4dHJhQnl0ZXM7IGkgPCBsZW4yOyBpICs9IG1heENodW5rTGVuZ3RoKSB7XG4gICAgcGFydHMucHVzaChlbmNvZGVDaHVuayh1aW50OCwgaSwgKGkgKyBtYXhDaHVua0xlbmd0aCkgPiBsZW4yID8gbGVuMiA6IChpICsgbWF4Q2h1bmtMZW5ndGgpKSlcbiAgfVxuXG4gIC8vIHBhZCB0aGUgZW5kIHdpdGggemVyb3MsIGJ1dCBtYWtlIHN1cmUgdG8gbm90IGZvcmdldCB0aGUgZXh0cmEgYnl0ZXNcbiAgaWYgKGV4dHJhQnl0ZXMgPT09IDEpIHtcbiAgICB0bXAgPSB1aW50OFtsZW4gLSAxXVxuICAgIG91dHB1dCArPSBsb29rdXBbdG1wID4+IDJdXG4gICAgb3V0cHV0ICs9IGxvb2t1cFsodG1wIDw8IDQpICYgMHgzRl1cbiAgICBvdXRwdXQgKz0gJz09J1xuICB9IGVsc2UgaWYgKGV4dHJhQnl0ZXMgPT09IDIpIHtcbiAgICB0bXAgPSAodWludDhbbGVuIC0gMl0gPDwgOCkgKyAodWludDhbbGVuIC0gMV0pXG4gICAgb3V0cHV0ICs9IGxvb2t1cFt0bXAgPj4gMTBdXG4gICAgb3V0cHV0ICs9IGxvb2t1cFsodG1wID4+IDQpICYgMHgzRl1cbiAgICBvdXRwdXQgKz0gbG9va3VwWyh0bXAgPDwgMikgJiAweDNGXVxuICAgIG91dHB1dCArPSAnPSdcbiAgfVxuXG4gIHBhcnRzLnB1c2gob3V0cHV0KVxuXG4gIHJldHVybiBwYXJ0cy5qb2luKCcnKVxufVxuIiwiZXhwb3J0cy5yZWFkID0gZnVuY3Rpb24gKGJ1ZmZlciwgb2Zmc2V0LCBpc0xFLCBtTGVuLCBuQnl0ZXMpIHtcbiAgdmFyIGUsIG1cbiAgdmFyIGVMZW4gPSBuQnl0ZXMgKiA4IC0gbUxlbiAtIDFcbiAgdmFyIGVNYXggPSAoMSA8PCBlTGVuKSAtIDFcbiAgdmFyIGVCaWFzID0gZU1heCA+PiAxXG4gIHZhciBuQml0cyA9IC03XG4gIHZhciBpID0gaXNMRSA/IChuQnl0ZXMgLSAxKSA6IDBcbiAgdmFyIGQgPSBpc0xFID8gLTEgOiAxXG4gIHZhciBzID0gYnVmZmVyW29mZnNldCArIGldXG5cbiAgaSArPSBkXG5cbiAgZSA9IHMgJiAoKDEgPDwgKC1uQml0cykpIC0gMSlcbiAgcyA+Pj0gKC1uQml0cylcbiAgbkJpdHMgKz0gZUxlblxuICBmb3IgKDsgbkJpdHMgPiAwOyBlID0gZSAqIDI1NiArIGJ1ZmZlcltvZmZzZXQgKyBpXSwgaSArPSBkLCBuQml0cyAtPSA4KSB7fVxuXG4gIG0gPSBlICYgKCgxIDw8ICgtbkJpdHMpKSAtIDEpXG4gIGUgPj49ICgtbkJpdHMpXG4gIG5CaXRzICs9IG1MZW5cbiAgZm9yICg7IG5CaXRzID4gMDsgbSA9IG0gKiAyNTYgKyBidWZmZXJbb2Zmc2V0ICsgaV0sIGkgKz0gZCwgbkJpdHMgLT0gOCkge31cblxuICBpZiAoZSA9PT0gMCkge1xuICAgIGUgPSAxIC0gZUJpYXNcbiAgfSBlbHNlIGlmIChlID09PSBlTWF4KSB7XG4gICAgcmV0dXJuIG0gPyBOYU4gOiAoKHMgPyAtMSA6IDEpICogSW5maW5pdHkpXG4gIH0gZWxzZSB7XG4gICAgbSA9IG0gKyBNYXRoLnBvdygyLCBtTGVuKVxuICAgIGUgPSBlIC0gZUJpYXNcbiAgfVxuICByZXR1cm4gKHMgPyAtMSA6IDEpICogbSAqIE1hdGgucG93KDIsIGUgLSBtTGVuKVxufVxuXG5leHBvcnRzLndyaXRlID0gZnVuY3Rpb24gKGJ1ZmZlciwgdmFsdWUsIG9mZnNldCwgaXNMRSwgbUxlbiwgbkJ5dGVzKSB7XG4gIHZhciBlLCBtLCBjXG4gIHZhciBlTGVuID0gbkJ5dGVzICogOCAtIG1MZW4gLSAxXG4gIHZhciBlTWF4ID0gKDEgPDwgZUxlbikgLSAxXG4gIHZhciBlQmlhcyA9IGVNYXggPj4gMVxuICB2YXIgcnQgPSAobUxlbiA9PT0gMjMgPyBNYXRoLnBvdygyLCAtMjQpIC0gTWF0aC5wb3coMiwgLTc3KSA6IDApXG4gIHZhciBpID0gaXNMRSA/IDAgOiAobkJ5dGVzIC0gMSlcbiAgdmFyIGQgPSBpc0xFID8gMSA6IC0xXG4gIHZhciBzID0gdmFsdWUgPCAwIHx8ICh2YWx1ZSA9PT0gMCAmJiAxIC8gdmFsdWUgPCAwKSA/IDEgOiAwXG5cbiAgdmFsdWUgPSBNYXRoLmFicyh2YWx1ZSlcblxuICBpZiAoaXNOYU4odmFsdWUpIHx8IHZhbHVlID09PSBJbmZpbml0eSkge1xuICAgIG0gPSBpc05hTih2YWx1ZSkgPyAxIDogMFxuICAgIGUgPSBlTWF4XG4gIH0gZWxzZSB7XG4gICAgZSA9IE1hdGguZmxvb3IoTWF0aC5sb2codmFsdWUpIC8gTWF0aC5MTjIpXG4gICAgaWYgKHZhbHVlICogKGMgPSBNYXRoLnBvdygyLCAtZSkpIDwgMSkge1xuICAgICAgZS0tXG4gICAgICBjICo9IDJcbiAgICB9XG4gICAgaWYgKGUgKyBlQmlhcyA+PSAxKSB7XG4gICAgICB2YWx1ZSArPSBydCAvIGNcbiAgICB9IGVsc2Uge1xuICAgICAgdmFsdWUgKz0gcnQgKiBNYXRoLnBvdygyLCAxIC0gZUJpYXMpXG4gICAgfVxuICAgIGlmICh2YWx1ZSAqIGMgPj0gMikge1xuICAgICAgZSsrXG4gICAgICBjIC89IDJcbiAgICB9XG5cbiAgICBpZiAoZSArIGVCaWFzID49IGVNYXgpIHtcbiAgICAgIG0gPSAwXG4gICAgICBlID0gZU1heFxuICAgIH0gZWxzZSBpZiAoZSArIGVCaWFzID49IDEpIHtcbiAgICAgIG0gPSAodmFsdWUgKiBjIC0gMSkgKiBNYXRoLnBvdygyLCBtTGVuKVxuICAgICAgZSA9IGUgKyBlQmlhc1xuICAgIH0gZWxzZSB7XG4gICAgICBtID0gdmFsdWUgKiBNYXRoLnBvdygyLCBlQmlhcyAtIDEpICogTWF0aC5wb3coMiwgbUxlbilcbiAgICAgIGUgPSAwXG4gICAgfVxuICB9XG5cbiAgZm9yICg7IG1MZW4gPj0gODsgYnVmZmVyW29mZnNldCArIGldID0gbSAmIDB4ZmYsIGkgKz0gZCwgbSAvPSAyNTYsIG1MZW4gLT0gOCkge31cblxuICBlID0gKGUgPDwgbUxlbikgfCBtXG4gIGVMZW4gKz0gbUxlblxuICBmb3IgKDsgZUxlbiA+IDA7IGJ1ZmZlcltvZmZzZXQgKyBpXSA9IGUgJiAweGZmLCBpICs9IGQsIGUgLz0gMjU2LCBlTGVuIC09IDgpIHt9XG5cbiAgYnVmZmVyW29mZnNldCArIGkgLSBkXSB8PSBzICogMTI4XG59XG4iLCJ2YXIgdG9TdHJpbmcgPSB7fS50b1N0cmluZztcblxubW9kdWxlLmV4cG9ydHMgPSBBcnJheS5pc0FycmF5IHx8IGZ1bmN0aW9uIChhcnIpIHtcbiAgcmV0dXJuIHRvU3RyaW5nLmNhbGwoYXJyKSA9PSAnW29iamVjdCBBcnJheV0nO1xufTtcbiJdfQ==
