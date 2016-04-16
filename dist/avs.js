'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

(function () {
  'use strict';

  var Buffer = require('buffer').Buffer;
  var qs = require('qs');
  var httpMessageParser = require('http-message-parser');

  var AMAZON_ERROR_CODES = {
    InvalidAccessTokenException: 'com.amazon.alexahttpproxy.exceptions.InvalidAccessTokenException'
  };

  var AVS = function () {
    function AVS() {
      var options = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

      _classCallCheck(this, AVS);

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
    }

    _createClass(AVS, [{
      key: '_log',
      value: function _log(type, message) {
        var _this = this;

        if (type && !message) {
          message = type;
          type = 'log';
        }

        setTimeout(function () {
          _this.emit(AVS.EventTypes.LOG, message);
        }, 0);

        if (this._debug) {
          console[type](message);
        }
      }
    }, {
      key: 'login',
      value: function login() {
        var options = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

        return this.promptUserLogin(options);
      }
    }, {
      key: 'logout',
      value: function logout() {
        var _this2 = this;

        return new Promise(function (resolve, reject) {
          _this2._token = null;
          _this2._refreshToken = null;
          _this2.emit(AVS.EventTypes.LOGOUT);
          _this2._log('Logged out');
          resolve();
        });
      }
    }, {
      key: 'promptUserLogin',
      value: function promptUserLogin() {
        var _this3 = this;

        var options = arguments.length <= 0 || arguments[0] === undefined ? { responseType: 'token', newWindow: false } : arguments[0];

        return new Promise(function (resolve, reject) {
          if (typeof options.responseType === 'undefined') {
            options.responseType = 'token';
          }

          if (typeof options.responseType !== 'string') {
            var error = new Error('`responseType` must a string.');
            _this3._log(error);
            return reject(error);
          }

          var newWindow = !!options.newWindow;

          var responseType = options.responseType;

          if (!(responseType === 'code' || responseType === 'token')) {
            var _error = new Error('`responseType` must be either `code` or `token`.');
            _this3._log(_error);
            return reject(_error);
          }

          var scope = 'alexa:all';
          var scopeData = _defineProperty({}, scope, {
            productID: _this3._deviceId,
            productInstanceAttributes: {
              deviceSerialNumber: _this3._deviceSerialNumber
            }
          });

          var authUrl = 'https://www.amazon.com/ap/oa?client_id=' + _this3._clientId + '&scope=' + encodeURIComponent(scope) + '&scope_data=' + encodeURIComponent(JSON.stringify(scopeData)) + '&response_type=' + responseType + '&redirect_uri=' + encodeURI(_this3._redirectUri);

          if (newWindow) {
            window.open(authUrl);
          } else {
            window.location.href = authUrl;
          }
        });
      }
    }, {
      key: 'getTokenFromCode',
      value: function getTokenFromCode(code) {
        var _this4 = this;

        return new Promise(function (resolve, reject) {
          if (typeof code !== 'string') {
            var error = new TypeError('`code` must be a string.');
            _this4._log(error);
            return reject(error);
          }

          var grantType = 'authorization_code';
          var postData = 'grant_type=' + grantType + '&code=' + code + '&client_id=' + _this4._clientId + '&client_secret=' + _this4._clientSecret + '&redirect_uri=' + encodeURIComponent(_this4._redirectUri);
          var url = 'https://api.amazon.com/auth/o2/token';

          var xhr = new XMLHttpRequest();

          xhr.open('POST', url, true);
          xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded;charset=UTF-8');
          xhr.onload = function (event) {
            console.log('RESPONSE', xhr.response);

            var response = xhr.response;

            try {
              response = JSON.parse(xhr.response);
            } catch (error) {
              _this4._log(error);
              return reject(error);
            }

            var isObject = response instanceof Object;
            var errorDescription = isObject && response.error_description;

            if (errorDescription) {
              var _error2 = new Error(errorDescription);
              _this4._log(_error2);
              return reject(_error2);
            }

            var token = response.access_token;
            var refreshToken = response.refresh_token;
            var tokenType = response.token_type;
            var expiresIn = response.expiresIn;

            _this4.setToken(token);
            _this4.setRefreshToken(refreshToken);

            _this4.emit(AVS.EventTypes.LOGIN);
            _this4._log('Logged in.');
            resolve(response);
          };

          xhr.onerror = function (error) {
            _this4._log(error);
            reject(error);
          };

          xhr.send(postData);
        });
      }
    }, {
      key: 'refreshToken',
      value: function refreshToken() {
        var _this5 = this;

        return this.getTokenFromRefreshToken(this._refreshToken).then(function () {
          return {
            token: _this5._token,
            refreshToken: _this5._refreshToken
          };
        });
      }
    }, {
      key: 'getTokenFromRefreshToken',
      value: function getTokenFromRefreshToken() {
        var _this6 = this;

        var refreshToken = arguments.length <= 0 || arguments[0] === undefined ? this._refreshToken : arguments[0];

        return new Promise(function (resolve, reject) {
          if (typeof refreshToken !== 'string') {
            var error = new Error('`refreshToken` must a string.');
            _this6._log(error);
            return reject(error);
          }

          var grantType = 'refresh_token';
          var postData = 'grant_type=' + grantType + '&refresh_token=' + refreshToken + '&client_id=' + _this6._clientId + '&client_secret=' + _this6._clientSecret + '&redirect_uri=' + encodeURIComponent(_this6._redirectUri);
          var url = 'https://api.amazon.com/auth/o2/token';
          var xhr = new XMLHttpRequest();

          xhr.open('POST', url, true);
          xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded;charset=UTF-8');
          xhr.responseType = 'json';
          xhr.onload = function (event) {
            var response = xhr.response;

            if (response.error) {
              var _error3 = response.error.message;
              _this6.emit(AVS.EventTypes.ERROR, _error3);

              return reject(_error3);
            } else {
              var token = response.access_token;
              var _refreshToken = response.refresh_token;

              _this6.setToken(token);
              _this6.setRefreshToken(_refreshToken);

              return resolve(token);
            }
          };

          xhr.onerror = function (error) {
            _this6._log(error);
            reject(error);
          };

          xhr.send(postData);
        });
      }
    }, {
      key: 'getTokenFromUrl',
      value: function getTokenFromUrl() {
        var _this7 = this;

        return new Promise(function (resolve, reject) {
          var queryString = window.location.href.split('?#');

          if (queryString.length === 2) {
            queryString = queryString[1];
          } else {
            queryString = window.location.search.substr(1);
          }

          var query = qs.parse(queryString);
          var token = query.access_token;
          var refreshToken = query.refresh_token;
          var tokenType = query.token_type;
          var expiresIn = query.expiresIn;

          if (token) {
            _this7.setToken(token);
            _this7.emit(AVS.EventTypes.LOGIN);
            _this7._log('Logged in.');

            if (refreshToken) {
              _this7.setRefreshToken(refreshToken);
            }

            return resolve(token);
          }

          return reject(null);
        });
      }
    }, {
      key: 'getCodeFromUrl',
      value: function getCodeFromUrl() {
        return new Promise(function (resolve, reject) {
          var query = qs.parse(window.location.search.substr(1));
          var code = query.code;

          if (code) {
            return resolve(code);
          }

          return reject(null);
        });
      }
    }, {
      key: 'setToken',
      value: function setToken(token) {
        var _this8 = this;

        return new Promise(function (resolve, reject) {
          if (typeof token === 'string') {
            _this8._token = token;
            _this8.emit(AVS.EventTypes.TOKEN_SET);
            _this8._log('Token set.');
            resolve(_this8._token);
          } else {
            var error = new TypeError('`token` must be a string.');
            _this8._log(error);
            reject(error);
          }
        });
      }
    }, {
      key: 'setRefreshToken',
      value: function setRefreshToken(refreshToken) {
        var _this9 = this;

        return new Promise(function (resolve, reject) {
          if (typeof refreshToken === 'string') {
            _this9._refreshToken = refreshToken;
            _this9.emit(AVS.EventTypes.REFRESH_TOKEN_SET);
            _this9._log('Refresh token set.');
            resolve(_this9._refreshToken);
          } else {
            var error = new TypeError('`refreshToken` must be a string.');
            _this9._log(error);
            reject(error);
          }
        });
      }
    }, {
      key: 'setClientId',
      value: function setClientId(clientId) {
        var _this10 = this;

        return new Promise(function (resolve, reject) {
          if (typeof clientId === 'string') {
            _this10._clientId = clientId;
            resolve(_this10._clientId);
          } else {
            var error = new TypeError('`clientId` must be a string.');
            _this10._log(error);
            reject(error);
          }
        });
      }
    }, {
      key: 'setClientSecret',
      value: function setClientSecret(clientSecret) {
        var _this11 = this;

        return new Promise(function (resolve, reject) {
          if (typeof clientSecret === 'string') {
            _this11._clientSecret = clientSecret;
            resolve(_this11._clientSecret);
          } else {
            var error = new TypeError('`clientSecret` must be a string');
            _this11._log(error);
            reject(error);
          }
        });
      }
    }, {
      key: 'setDeviceId',
      value: function setDeviceId(deviceId) {
        var _this12 = this;

        return new Promise(function (resolve, reject) {
          if (typeof deviceId === 'string') {
            _this12._deviceId = deviceId;
            resolve(_this12._deviceId);
          } else {
            var error = new TypeError('`deviceId` must be a string.');
            _this12._log(error);
            reject(error);
          }
        });
      }
    }, {
      key: 'setDeviceSerialNumber',
      value: function setDeviceSerialNumber(deviceSerialNumber) {
        var _this13 = this;

        return new Promise(function (resolve, reject) {
          if (typeof deviceSerialNumber === 'number' || typeof deviceSerialNumber === 'string') {
            _this13._deviceSerialNumber = deviceSerialNumber;
            resolve(_this13._deviceSerialNumber);
          } else {
            var error = new TypeError('`deviceSerialNumber` must be a number or string.');
            _this13._log(error);
            reject(error);
          }
        });
      }
    }, {
      key: 'setRedirectUri',
      value: function setRedirectUri(redirectUri) {
        var _this14 = this;

        return new Promise(function (resolve, reject) {
          if (typeof redirectUri === 'string') {
            _this14._redirectUri = redirectUri;
            resolve(_this14._redirectUri);
          } else {
            var error = new TypeError('`redirectUri` must be a string.');
            _this14._log(error);
            reject(error);
          }
        });
      }
    }, {
      key: 'setDebug',
      value: function setDebug(debug) {
        var _this15 = this;

        return new Promise(function (resolve, reject) {
          if (typeof debug === 'boolean') {
            _this15._debug = debug;
            resolve(_this15._debug);
          } else {
            var error = new TypeError('`debug` must be a boolean.');
            _this15._log(error);
            reject(error);
          }
        });
      }
    }, {
      key: 'getToken',
      value: function getToken() {
        var _this16 = this;

        return new Promise(function (resolve, reject) {
          var token = _this16._token;

          if (token) {
            return resolve(token);
          }

          return reject();
        });
      }
    }, {
      key: 'getRefreshToken',
      value: function getRefreshToken() {
        var _this17 = this;

        return new Promise(function (resolve, reject) {
          var refreshToken = _this17._refreshToken;

          if (refreshToken) {
            return resolve(refreshToken);
          }

          return reject();
        });
      }
    }, {
      key: 'requestMic',
      value: function requestMic() {
        var _this18 = this;

        return new Promise(function (resolve, reject) {
          _this18._log('Requesting microphone.');
          // Ensure that the file can be loaded in environments where navigator is not defined (node servers)
          if (!navigator.getUserMedia) {
            navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia;
          }

          navigator.getUserMedia({
            audio: true
          }, function (stream) {
            _this18._log('Microphone connected.');
            return _this18.connectMediaStream(stream).then(function () {
              return resolve(stream);
            });
          }, function (error) {
            _this18._log('error', error);
            _this18.emit(AVS.EventTypes.ERROR, error);
            return reject(error);
          });
        });
      }
    }, {
      key: 'connectMediaStream',
      value: function connectMediaStream(stream) {
        var _this19 = this;

        return new Promise(function (resolve, reject) {
          var isMediaStream = Object.prototype.toString.call(stream) === '[object MediaStream]';

          if (!isMediaStream) {
            var error = new TypeError('Argument must be a `MediaStream` object.');
            _this19._log('error', error);
            _this19.emit(AVS.EventTypes.ERROR, error);
            return reject(error);
          }

          _this19._audioContext = new AudioContext();
          _this19._sampleRate = _this19._audioContext.sampleRate;

          _this19._log('Sample rate: ' + _this19._sampleRate + '.');

          _this19._volumeNode = _this19._audioContext.createGain();
          _this19._audioInput = _this19._audioContext.createMediaStreamSource(stream);

          _this19._audioInput.connect(_this19._volumeNode);

          _this19._recorder = _this19._audioContext.createScriptProcessor(_this19._bufferSize, _this19._inputChannels, _this19._outputChannels);

          _this19._recorder.onaudioprocess = function (event) {
            if (!_this19._isRecording) {
              return false;
            }

            var left = event.inputBuffer.getChannelData(0);
            _this19._leftChannel.push(new Float32Array(left));

            if (_this19._inputChannels > 1) {
              var right = event.inputBuffer.getChannelData(1);
              _this19._rightChannel.push(new Float32Array(right));
            }

            _this19._recordingLength += _this19._bufferSize;
          };

          _this19._volumeNode.connect(_this19._recorder);
          _this19._recorder.connect(_this19._audioContext.destination);
          _this19._log('Media stream connected.');

          return resolve();
        });
      }
    }, {
      key: 'startRecording',
      value: function startRecording() {
        var _this20 = this;

        return new Promise(function (resolve, reject) {
          if (!_this20._audioInput) {
            var error = new Error('No Media Stream connected.');
            _this20._log('error', error);
            _this20.emit(AVS.EventTypes.ERROR, error);
            return reject(error);
          }

          _this20._isRecording = true;
          _this20._leftChannel.length = _this20._rightChannel.length = 0;
          _this20._recordingLength = 0;
          _this20._log('Recording started.');
          _this20.emit(AVS.EventTypes.RECORD_START);

          return resolve();
        });
      }
    }, {
      key: 'stopRecording',
      value: function stopRecording() {
        var _this21 = this;

        return new Promise(function (resolve, reject) {
          if (!_this21._isRecording) {
            _this21.emit(AVS.EventTypes.RECORD_STOP);
            _this21._log('Recording stopped.');
            return resolve();
          }

          _this21._isRecording = false;

          var leftBuffer = Helpers.mergeBuffers(_this21._leftChannel, _this21._recordingLength);
          var interleaved = null;

          if (_this21._outputChannels > 1) {
            var rightBuffer = Helpers.mergeBuffers(_this21._rightChannel, _this21._recordingLength);
            interleaved = Helpers.interleave(leftBuffer, rightBuffer);
          } else {
            interleaved = Helpers.interleave(leftBuffer);
          }

          interleaved = Helpers.downsampleBuffer(interleaved, _this21._sampleRate, _this21._outputSampleRate);

          var buffer = new ArrayBuffer(44 + interleaved.length * 2);
          var view = new DataView(buffer);

          /**
           * @credit https://github.com/mattdiamond/Recorderjs
           */
          Helpers.writeUTFBytes(view, 0, 'RIFF');
          view.setUint32(4, 44 + interleaved.length * 2, true);
          Helpers.writeUTFBytes(view, 8, 'WAVE');
          Helpers.writeUTFBytes(view, 12, 'fmt ');
          view.setUint32(16, 16, true);
          view.setUint16(20, 1, true);
          view.setUint16(22, _this21._outputChannels, true);
          view.setUint32(24, _this21._outputSampleRate, true);
          view.setUint32(28, _this21._outputSampleRate * 4, true);
          view.setUint16(32, 4, true);
          view.setUint16(34, 16, true);
          Helpers.writeUTFBytes(view, 36, 'data');
          view.setUint32(40, interleaved.length * 2, true);

          var length = interleaved.length;
          var volume = 1;
          var index = 44;

          for (var i = 0; i < length; i++) {
            view.setInt16(index, interleaved[i] * (0x7FFF * volume), true);
            index += 2;
          }

          _this21._log('Recording stopped.');
          _this21.emit(AVS.EventTypes.RECORD_STOP);
          return resolve(view);
        });
      }
    }, {
      key: 'playBlob',
      value: function playBlob(blob) {
        var _this22 = this;

        return new Promise(function (resolve, reject) {
          if (!blob) {
            reject();
          }

          var objectUrl = URL.createObjectURL(blob);
          var audio = new Audio();
          audio.src = objectUrl;

          audio.addEventListener('ended', function () {
            _this22._log('Audio play ended.');
          });

          audio.onload = function (event) {
            URL.revokeObjectUrl(objectUrl);
          };

          _this22._log('Audio play started.');
          audio.play();

          resolve();
        });
      }
    }, {
      key: 'sendAudio',
      value: function sendAudio(dataView) {
        var _this23 = this;

        return new Promise(function (resolve, reject) {
          var xhr = new XMLHttpRequest();
          var url = 'https://access-alexa-na.amazon.com/v1/avs/speechrecognizer/recognize';

          xhr.open('POST', url, true);
          xhr.responseType = 'arraybuffer';
          xhr.onload = function (event) {
            console.log('RESPONSE', xhr.response);

            var buffer = new Buffer(xhr.response);

            if (xhr.status === 200) {
              var parsedMessage = httpMessageParser(buffer);
              resolve(parsedMessage);
            } else {
              var error = new Error('An error occured with request.');
              var response = {};

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
                if (response.error.code === AMAZON_ERROR_CODES.InvalidAccessTokenException) {
                  _this23.emit(AVS.EventTypes.TOKEN_INVALID);
                }

                error = response.error.message;
              }

              _this23.emit(AVS.EventTypes.ERROR, error);
              return reject(error);
            }
          };

          xhr.onerror = function (error) {
            _this23._log(error);
            reject(error);
          };

          var BOUNDARY = 'BOUNDARY1234';
          var BOUNDARY_DASHES = '--';
          var NEWLINE = '\r\n';
          var METADATA_CONTENT_DISPOSITION = 'Content-Disposition: form-data; name="metadata"';
          var METADATA_CONTENT_TYPE = 'Content-Type: application/json; charset=UTF-8';
          var AUDIO_CONTENT_TYPE = 'Content-Type: audio/L16; rate=16000; channels=1';
          var AUDIO_CONTENT_DISPOSITION = 'Content-Disposition: form-data; name="audio"';

          var metadata = {
            messageHeader: {},
            messageBody: {
              profile: 'alexa-close-talk',
              locale: 'en-us',
              format: 'audio/L16; rate=16000; channels=1'
            }
          };

          var postDataStart = [NEWLINE, BOUNDARY_DASHES, BOUNDARY, NEWLINE, METADATA_CONTENT_DISPOSITION, NEWLINE, METADATA_CONTENT_TYPE, NEWLINE, NEWLINE, JSON.stringify(metadata), NEWLINE, BOUNDARY_DASHES, BOUNDARY, NEWLINE, AUDIO_CONTENT_DISPOSITION, NEWLINE, AUDIO_CONTENT_TYPE, NEWLINE, NEWLINE].join('');

          var postDataEnd = [NEWLINE, BOUNDARY_DASHES, BOUNDARY, BOUNDARY_DASHES, NEWLINE].join('');

          var size = postDataStart.length + dataView.byteLength + postDataEnd.length;
          var uint8Array = new Uint8Array(size);
          var i = 0;

          for (; i < postDataStart.length; i++) {
            uint8Array[i] = postDataStart.charCodeAt(i) & 0xFF;
          }

          for (var j = 0; j < dataView.byteLength; i++, j++) {
            uint8Array[i] = dataView.getUint8(j);
          }

          for (var _j = 0; _j < postDataEnd.length; i++, _j++) {
            uint8Array[i] = postDataEnd.charCodeAt(_j) & 0xFF;
          }

          var payload = uint8Array.buffer;

          xhr.setRequestHeader('Authorization', 'Bearer ' + _this23._token);
          xhr.setRequestHeader('Content-Type', 'multipart/form-data; boundary=' + BOUNDARY);
          xhr.send(payload);
        });
      }
    }], [{
      key: 'EventTypes',
      get: function get() {
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
    }]);

    return AVS;
  }();

  var Helpers = function () {
    function Helpers() {
      _classCallCheck(this, Helpers);
    }

    _createClass(Helpers, null, [{
      key: 'downsampleBuffer',

      /**
       * @credit http://stackoverflow.com/a/26245260
       */
      value: function downsampleBuffer(buffer, inputSampleRate, outputSampleRate) {
        if (inputSampleRate === outputSampleRate) {
          return buffer;
        }

        if (inputSampleRate < outputSampleRate) {
          throw new Error('Output sample rate must be less than input sample rate.');
        }

        var sampleRateRatio = inputSampleRate / outputSampleRate;
        var newLength = Math.round(buffer.length / sampleRateRatio);
        var result = new Float32Array(newLength);
        var offsetResult = 0;
        var offsetBuffer = 0;

        while (offsetResult < result.length) {
          var nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio);
          var accum = 0;
          var count = 0;

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

    }, {
      key: 'interleave',
      value: function interleave(leftChannel, rightChannel) {
        if (leftChannel && !rightChannel) {
          return leftChannel;
        }

        var length = leftChannel.length + rightChannel.length;
        var result = new Float32Array(length);
        var inputIndex = 0;

        for (var index = 0; index < length;) {
          result[index++] = leftChannel[inputIndex];
          result[index++] = rightChannel[inputIndex];
          inputIndex++;
        }

        return result;
      }

      /**
       * @credit https://github.com/mattdiamond/Recorderjs
       */

    }, {
      key: 'mergeBuffers',
      value: function mergeBuffers(channelBuffer, recordingLength) {
        var result = new Float32Array(recordingLength);
        var length = channelBuffer.length;
        var offset = 0;

        for (var i = 0; i < length; i++) {
          var buffer = channelBuffer[i];

          result.set(buffer, offset);
          offset += buffer.length;
        }

        return result;
      }

      /**
       * @credit https://github.com/mattdiamond/Recorderjs
       */

    }, {
      key: 'writeUTFBytes',
      value: function writeUTFBytes(view, offset, string) {
        var length = string.length;

        for (var i = 0; i < length; i++) {
          view.setUint8(offset + i, string.charCodeAt(i));
        }
      }

      /**
       * @credit https://developers.google.com/web/updates/2012/06/How-to-convert-ArrayBuffer-to-and-from-String?hl=en
       */

    }, {
      key: 'arrayBufferToString',
      value: function arrayBufferToString(buffer) {
        return String.fromCharCode.apply(null, new Uint16Array(buffer));
      }
    }]);

    return Helpers;
  }();

  function observable(el) {
    var callbacks = {};

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

      var args = [].slice.call(arguments, 1);

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
  }

  if (typeof define === 'function' && define.amd) {
    define([], function () {
      return AVS;
    });
  }

  if ((typeof window === 'undefined' ? 'undefined' : _typeof(window)) === 'object') {
    window.AVS = AVS;
  }
})();
