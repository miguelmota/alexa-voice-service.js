'use strict';

const Buffer = require('buffer').Buffer;
const qs = require('qs');
const httpMessageParser = require('http-message-parser');

const AMAZON_ERROR_CODES = require('./AmazonErrorCodes.js');
const Observable = require('./Observable.js');
const Player = require('./Player.js');
const arrayBufferToString = require('./utils/arrayBufferToString.js');
const writeUTFBytes = require('./utils/writeUTFBytes.js');
const mergeBuffers = require('./utils/mergeBuffers.js');
const interleave = require('./utils/interleave.js');
const downsampleBuffer = require('./utils/downsampleBuffer.js');

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
    this._deviceId= null;
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

  promptUserLogin(options = {responseType: 'token', newWindow: false}) {
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

      const authUrl = `https://www.amazon.com/ap/oa?client_id=${this._clientId}&scope=${encodeURIComponent(scope)}&scope_data=${encodeURIComponent(JSON.stringify(scopeData))}&response_type=${responseType}&redirect_uri=${encodeURI(this._redirectUri)}`

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
      const postData = `grant_type=${grantType}&code=${code}&client_id=${this._clientId}&client_secret=${this._clientSecret}&redirect_uri=${encodeURIComponent(this._redirectUri)}`;
      const url = 'https://api.amazon.com/auth/o2/token';

      const xhr = new XMLHttpRequest();

      xhr.open('POST', url, true);
      xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded;charset=UTF-8');
      xhr.onload = (event) => {
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

        this.emit(AVS.EventTypes.LOGIN);
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

  refreshToken() {
    return this.getTokenFromRefreshToken(this._refreshToken)
    .then(() => {
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
      const postData = `grant_type=${grantType}&refresh_token=${refreshToken}&client_id=${this._clientId}&client_secret=${this._clientSecret}&redirect_uri=${encodeURIComponent(this._redirectUri)}`;
      const url = 'https://api.amazon.com/auth/o2/token';
      const xhr = new XMLHttpRequest();

      xhr.open('POST', url, true);
      xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded;charset=UTF-8');
      xhr.responseType = 'json';
      xhr.onload = (event) => {
        const response = xhr.response;

        if (response.error) {
          const error = response.error.message;
          this.emit(AVS.EventTypes.ERROR, error);

          return reject(error);
        } else  {
          const token = response.access_token;
          const refreshToken = response.refresh_token;

          this.setToken(token);
          this.setRefreshToken(refreshToken);

          return resolve(token);
        }
      };

      xhr.onerror = (error) => {
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
        this.setToken(token)
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

      // Ensure that the file can be loaded in environments where navigator is not defined (node servers)
      if (!navigator.getUserMedia) {
        navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia ||
          navigator.mozGetUserMedia || navigator.msGetUserMedia;
      }

      navigator.getUserMedia({
        audio: true
      }, (stream) => {
        this._log('Microphone connected.');
        return this.connectMediaStream(stream).then(resolve);
      }, (error) => {
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
        const error = new TypeError('Argument must be a `MediaStream` object.')
        this._log('error', error)
        this.emit(AVS.EventTypes.ERROR, error);
        return reject(error);
      }

      this._audioContext = new AudioContext();
      this._sampleRate = this._audioContext.sampleRate;

      this._log(`Sample rate: ${this._sampleRate}.`);

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

      return resolve(stream);
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

      for (let i = 0; i < length; i++){
        view.setInt16(index, interleaved[i] * (0x7FFF * volume), true);
        index += 2;
      }

      this._log(`Recording stopped.`);
      this.emit(AVS.EventTypes.RECORD_STOP);
      return resolve(view);
    });
  }

  sendAudio (dataView) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const url = 'https://access-alexa-na.amazon.com/v1/avs/speechrecognizer/recognize';

      xhr.open('POST', url, true);
      xhr.responseType = 'arraybuffer';
      xhr.onload = (event) => {
        const buffer = new Buffer(xhr.response);

        if (xhr.status === 200) {
          const parsedMessage = httpMessageParser(buffer);
          resolve({xhr, response: parsedMessage});
        } else {
          let error = new Error('An error occured with request.');
          let response = {};

          if (!xhr.response.byteLength) {
            error = new Error('Empty response.');
          } else {
            try {
              response = JSON.parse(arrayBufferToString(buffer));
            } catch(err) {
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

      xhr.setRequestHeader('Authorization', `Bearer ${this._token}`);
      xhr.setRequestHeader('Content-Type', 'multipart/form-data; boundary=' + BOUNDARY);
      xhr.send(payload);
    });
  }

  audioToBlob(audio) {
    return new Promise((resolve, reject) => {
      const blob = new Blob([audio], {type: 'audio/mpeg'});

      resolve(blob);
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

module.exports = AVS;
