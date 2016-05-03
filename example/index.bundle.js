(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';

var AVS = require('../');
var player = AVS.Player;

var avs = new AVS({
  debug: true,
  clientId: 'amzn1.application-oa2-client.696ab90fc5844fdbb8efc17394a79c00',
  deviceId: 'test_device',
  deviceSerialNumber: 123,
  redirectUri: 'https://' + window.location.host + '/authresponse'
});
window.avs = avs;

avs.on(AVS.EventTypes.TOKEN_SET, function () {
  loginBtn.disabled = true;
  logoutBtn.disabled = false;
  startRecording.disabled = false;
  stopRecording.disabled = true;
});

avs.on(AVS.EventTypes.RECORD_START, function () {
  startRecording.disabled = true;
  stopRecording.disabled = false;
});

avs.on(AVS.EventTypes.RECORD_STOP, function () {
  startRecording.disabled = false;
  stopRecording.disabled = true;
});

avs.on(AVS.EventTypes.LOGOUT, function () {
  loginBtn.disabled = false;
  logoutBtn.disabled = true;
  startRecording.disabled = true;
  stopRecording.disabled = true;
});

avs.on(AVS.EventTypes.TOKEN_INVALID, function () {
  avs.logout().then(login);
});

avs.on(AVS.EventTypes.LOG, log);
avs.on(AVS.EventTypes.ERROR, logError);

avs.player.on(AVS.Player.EventTypes.LOG, log);
avs.player.on(AVS.Player.EventTypes.ERROR, logError);

avs.player.on(AVS.Player.EventTypes.PLAY, function () {
  playAudio.disabled = true;
  replayAudio.disabled = true;
  pauseAudio.disabled = false;
  stopAudio.disabled = false;
});

avs.player.on(AVS.Player.EventTypes.ENDED, function () {
  playAudio.disabled = true;
  replayAudio.disabled = false;
  pauseAudio.disabled = true;
  stopAudio.disabled = true;
});

avs.player.on(AVS.Player.EventTypes.STOP, function () {
  playAudio.disabled = true;
  replayAudio.disabled = false;
  pauseAudio.disabled = false;
  stopAudio.disabled = false;
});

avs.player.on(AVS.Player.EventTypes.PAUSE, function () {
  playAudio.disabled = false;
  replayAudio.disabled = false;
  pauseAudio.disabled = true;
  stopAudio.disabled = true;
});

avs.player.on(AVS.Player.EventTypes.REPLAY, function () {
  playAudio.disabled = true;
  replayAudio.disabled = true;
  pauseAudio.disabled = false;
  stopAudio.disabled = false;
});

function log(message) {
  logOutput.innerHTML = '<li>LOG: ' + message + '</li>' + logOutput.innerHTML;
}

function logError(error) {
  logOutput.innerHTML = '<li>ERROR: ' + error + '</li>' + logOutput.innerHTML;
}

function logAudioBlob(blob, message) {
  return new Promise(function (resolve, reject) {
    var a = document.createElement('a');
    var aDownload = document.createElement('a');
    var url = window.URL.createObjectURL(blob);
    var ext = blob.type.indexOf('mpeg') > -1 ? 'mp3' : 'wav';
    var filename = Date.now() + '.' + ext;
    a.href = url;
    a.target = '_blank';
    aDownload.href = url;
    a.textContent = filename;
    aDownload.download = filename;
    aDownload.textContent = 'download';

    audioLogOutput.innerHTML = '<li>' + message + ': ' + a.outerHTML + ' ' + aDownload.outerHTML + '</li>' + audioLogOutput.innerHTML;
    resolve(blob);
  });
}

var loginBtn = document.getElementById('login');
var logoutBtn = document.getElementById('logout');
var logOutput = document.getElementById('log');
var audioLogOutput = document.getElementById('audioLog');
var startRecording = document.getElementById('startRecording');
var stopRecording = document.getElementById('stopRecording');
var stopAudio = document.getElementById('stopAudio');
var pauseAudio = document.getElementById('pauseAudio');
var playAudio = document.getElementById('playAudio');
var replayAudio = document.getElementById('replayAudio');

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

avs.getTokenFromUrl().then(function () {
  return avs.getToken();
}).then(function (token) {
  return localStorage.setItem('token', token);
}).then(function () {
  return avs.requestMic();
}).catch(function () {
  var cachedToken = localStorage.getItem('token');

  if (cachedToken) {
    avs.setToken(cachedToken);
    return avs.requestMic();
  }
});

loginBtn.addEventListener('click', login);

function login(event) {
  return avs.login().then(function () {
    return avs.requestMic();
  }).catch(function () {});

  /*
  // If using client secret
  avs.login({responseType: 'code'})
  .then(() => avs.requestMic())
  .catch(() => {});
  */
}

logoutBtn.addEventListener('click', logout);

function logout() {
  return avs.logout().then(function () {
    localStorage.removeItem('token');
    window.location.hash = '';
  });
}

startRecording.addEventListener('click', function () {
  avs.startRecording();
});

stopRecording.addEventListener('click', function () {
  avs.stopRecording().then(function (dataView) {
    avs.player.emptyQueue().then(function () {
      return avs.audioToBlob(dataView);
    }).then(function (blob) {
      return logAudioBlob(blob, 'VOICE');
    }).then(function () {
      return avs.player.enqueue(dataView);
    }).then(function () {
      return avs.player.play();
    }).catch(function (error) {
      console.error(error);
    });

    var ab = false;
    //sendBlob(blob);
    avs.sendAudio(dataView).then(function (_ref) {
      var xhr = _ref.xhr;
      var response = _ref.response;


      var promises = [];
      var audioMap = {};
      var directives = null;

      if (response.multipart.length) {
        (function () {
          var findAudioFromContentId = function findAudioFromContentId(contentId) {
            contentId = contentId.replace('cid:', '');
            for (var key in audioMap) {
              if (key.indexOf(contentId) > -1) {
                return audioMap[key];
              }
            }
          };

          response.multipart.forEach(function (multipart) {
            var body = multipart.body;
            if (multipart.headers && multipart.headers['Content-Type'] === 'application/json') {
              try {
                body = JSON.parse(body);
              } catch (error) {
                console.error(error);
              }

              if (body && body.messageBody && body.messageBody.directives) {
                directives = body.messageBody.directives;
              }
            } else if (multipart.headers['Content-Type'] === 'audio/mpeg') {
              var start = multipart.meta.body.byteOffset.start;
              var end = multipart.meta.body.byteOffset.end;

              /**
               * Not sure if bug in buffer module or in http message parser
               * because it's joining arraybuffers so I have to this to
               * seperate them out.
               */
              var slicedBody = xhr.response.slice(start, end);

              //promises.push(avs.player.enqueue(slicedBody));
              audioMap[multipart.headers['Content-ID']] = slicedBody;
            }
          });

          directives.forEach(function (directive) {
            if (directive.namespace === 'SpeechSynthesizer') {
              if (directive.name === 'speak') {
                var contentId = directive.payload.audioContent;
                var audio = findAudioFromContentId(contentId);
                if (audio) {
                  avs.audioToBlob(audio).then(function (blob) {
                    return logAudioBlob(blob, 'RESPONSE');
                  });
                  promises.push(avs.player.enqueue(audio));
                }
              }
            } else if (directive.namespace === 'AudioPlayer') {
              if (directive.name === 'play') {
                var streams = directive.payload.audioItem.streams;
                streams.forEach(function (stream) {
                  var streamUrl = stream.streamUrl;

                  var audio = findAudioFromContentId(streamUrl);
                  if (audio) {
                    avs.audioToBlob(audio).then(function (blob) {
                      return logAudioBlob(blob, 'RESPONSE');
                    });
                    promises.push(avs.player.enqueue(audio));
                  } else if (streamUrl.indexOf('http') > -1) {
                    var _xhr = new XMLHttpRequest();
                    var url = '/parse-m3u?url=' + streamUrl.replace(/!.*$/, '');
                    _xhr.open('GET', url, true);
                    _xhr.responseType = 'json';
                    _xhr.onload = function (event) {
                      var urls = event.currentTarget.response;

                      urls.forEach(function (url) {
                        avs.player.enqueue(url);
                      });
                    };
                    _xhr.send();
                  }
                });
              } else if (directive.namespace === 'SpeechRecognizer') {
                if (directive.name === 'listen') {
                  var timeout = directive.payload.timeoutIntervalInMillis;
                  // enable mic
                }
              }
            }
          });

          if (promises.length) {
            Promise.all(promises).then(function () {
              avs.player.playQueue();
            });
          }
        })();
      }
    }).catch(function (error) {
      console.error(error);
    });
  });
});

stopAudio.addEventListener('click', function (event) {
  avs.player.stop();
});

pauseAudio.addEventListener('click', function (event) {
  avs.player.pause();
});

playAudio.addEventListener('click', function (event) {
  avs.player.play();
});

replayAudio.addEventListener('click', function (event) {
  avs.player.replay();
});

function sendBlob(blob) {
  var xhr = new XMLHttpRequest();
  var fd = new FormData();

  fd.append('fname', 'audio.wav');
  fd.append('data', blob);

  xhr.open('POST', 'http://localhost:5555/audio', true);
  xhr.responseType = 'blob';

  xhr.onload = function (event) {
    if (xhr.status == 200) {
      console.log(xhr.response);
      //const responseBlob = new Blob([xhr.response], {type: 'audio/mp3'});
    }
  };

  xhr.send(fd);
}

},{"../":6}],2:[function(require,module,exports){
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

},{"base64-js":3,"ieee754":4,"isarray":5}],3:[function(require,module,exports){
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

},{}],4:[function(require,module,exports){
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

},{}],5:[function(require,module,exports){
var toString = {}.toString;

module.exports = Array.isArray || function (arr) {
  return toString.call(arr) == '[object Array]';
};

},{}],6:[function(require,module,exports){
'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj; };

(function () {
  'use strict';

  var AVS = require('./lib/AVS');

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

},{"./lib/AVS":7}],7:[function(require,module,exports){
'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var Buffer = require('buffer').Buffer;
var qs = require('qs');
var httpMessageParser = require('http-message-parser');

var AMAZON_ERROR_CODES = require('./AmazonErrorCodes.js');
var Observable = require('./Observable.js');
var Player = require('./Player.js');
var arrayBufferToString = require('./utils/arrayBufferToString.js');
var writeUTFBytes = require('./utils/writeUTFBytes.js');
var mergeBuffers = require('./utils/mergeBuffers.js');
var interleave = require('./utils/interleave.js');
var downsampleBuffer = require('./utils/downsampleBuffer.js');

var AVS = function () {
  function AVS() {
    var options = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

    _classCallCheck(this, AVS);

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
        var hash = window.location.hash.substr(1);

        var query = qs.parse(hash);
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

        return reject();
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
          return _this18.connectMediaStream(stream).then(resolve);
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

        return resolve(stream);
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

        var leftBuffer = mergeBuffers(_this21._leftChannel, _this21._recordingLength);
        var interleaved = null;

        if (_this21._outputChannels > 1) {
          var rightBuffer = mergeBuffers(_this21._rightChannel, _this21._recordingLength);
          interleaved = interleave(leftBuffer, rightBuffer);
        } else {
          interleaved = interleave(leftBuffer);
        }

        interleaved = downsampleBuffer(interleaved, _this21._sampleRate, _this21._outputSampleRate);

        var buffer = new ArrayBuffer(44 + interleaved.length * 2);
        var view = new DataView(buffer);

        /**
         * @credit https://github.com/mattdiamond/Recorderjs
         */
        writeUTFBytes(view, 0, 'RIFF');
        view.setUint32(4, 44 + interleaved.length * 2, true);
        writeUTFBytes(view, 8, 'WAVE');
        writeUTFBytes(view, 12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, _this21._outputChannels, true);
        view.setUint32(24, _this21._outputSampleRate, true);
        view.setUint32(28, _this21._outputSampleRate * 4, true);
        view.setUint16(32, 4, true);
        view.setUint16(34, 16, true);
        writeUTFBytes(view, 36, 'data');
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
    key: 'sendAudio',
    value: function sendAudio(dataView) {
      var _this22 = this;

      return new Promise(function (resolve, reject) {
        var xhr = new XMLHttpRequest();
        var url = 'https://access-alexa-na.amazon.com/v1/avs/speechrecognizer/recognize';

        xhr.open('POST', url, true);
        xhr.responseType = 'arraybuffer';
        xhr.onload = function (event) {
          var buffer = new Buffer(xhr.response);

          if (xhr.status === 200) {
            var parsedMessage = httpMessageParser(buffer);
            resolve({ xhr: xhr, response: parsedMessage });
          } else {
            var error = new Error('An error occured with request.');
            var response = {};

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
                _this22.emit(AVS.EventTypes.TOKEN_INVALID);
              }

              error = response.error.message;
            }

            _this22.emit(AVS.EventTypes.ERROR, error);
            return reject(error);
          }
        };

        xhr.onerror = function (error) {
          _this22._log(error);
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

        xhr.setRequestHeader('Authorization', 'Bearer ' + _this22._token);
        xhr.setRequestHeader('Content-Type', 'multipart/form-data; boundary=' + BOUNDARY);
        xhr.send(payload);
      });
    }
  }, {
    key: 'audioToBlob',
    value: function audioToBlob(audio) {
      return new Promise(function (resolve, reject) {
        var blob = new Blob([audio], { type: 'audio/mpeg' });

        resolve(blob);
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
  }, {
    key: 'Player',
    get: function get() {
      return Player;
    }
  }]);

  return AVS;
}();

module.exports = AVS;

},{"./AmazonErrorCodes.js":8,"./Observable.js":9,"./Player.js":10,"./utils/arrayBufferToString.js":12,"./utils/downsampleBuffer.js":13,"./utils/interleave.js":14,"./utils/mergeBuffers.js":15,"./utils/writeUTFBytes.js":16,"buffer":2,"http-message-parser":17,"qs":18}],8:[function(require,module,exports){
'use strict';

module.exports = {
  InvalidAccessTokenException: 'com.amazon.alexahttpproxy.exceptions.InvalidAccessTokenException'
};

},{}],9:[function(require,module,exports){
'use strict';

function Observable(el) {
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

module.exports = Observable;

},{}],10:[function(require,module,exports){
'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var Observable = require('./Observable');
var arrayBufferToAudioBuffer = require('./utils/arrayBufferToAudioBuffer');
var toString = Object.prototype.toString;

var Player = function () {
  function Player() {
    _classCallCheck(this, Player);

    window.AudioContext = window.AudioContext || window.webkitAudioContext;

    this._queue = [];
    this._currentSource = null;
    this._currentBuffer = null;
    this._context = new AudioContext();

    Observable(this);
  }

  _createClass(Player, [{
    key: '_log',
    value: function _log(type, message) {
      var _this = this;

      if (type && !message) {
        message = type;
        type = 'log';
      }

      setTimeout(function () {
        _this.emit(Player.EventTypes.LOG, message);
      }, 0);

      if (this._debug) {
        console[type](message);
      }
    }
  }, {
    key: 'emptyQueue',
    value: function emptyQueue() {
      var _this2 = this;

      return new Promise(function (resolve, reject) {
        _this2._queue = [];
        _this2._audio = null;
        _this2._currentBuffer = null;
        _this2._currentSource = null;
        resolve();
      });
    }
  }, {
    key: 'enqueue',
    value: function enqueue(item) {
      var _this3 = this;

      return new Promise(function (resolve, reject) {
        if (!item) {
          var error = new Error('argument cannot be empty.');
          _this3._log(error);
          return reject(error);
        }

        var stringType = toString.call(item).replace(/\[.*\s(\w+)\]/, '$1');

        var proceed = function proceed(audioBuffer) {
          _this3._queue.push(audioBuffer);
          _this3._log('Enqueue audio');
          _this3.emit(Player.EventTypes.ENQUEUE);
          return resolve(audioBuffer);
        };

        if (stringType === 'DataView' || stringType === 'Uint8Array') {
          return arrayBufferToAudioBuffer(item.buffer, _this3._context).then(proceed);
        } else if (stringType === 'AudioBuffer') {
          return proceed(item);
        } else if (stringType === 'ArrayBuffer') {
          return arrayBufferToAudioBuffer(item, _this3._context).then(proceed);
        } else if (stringType === 'String') {
          return proceed(item);
        } else {
          var _error = new Error('Invalid type.');
          _this3.emit('error', _error);
          return reject(_error);
        }
      });
    }
  }, {
    key: 'deque',
    value: function deque() {
      var _this4 = this;

      return new Promise(function (resolve, reject) {
        var item = _this4._queue.shift();

        if (item) {
          _this4._log('Deque audio');
          _this4.emit(Player.EventTypes.DEQUE);
          return resolve(item);
        }

        return reject();
      });
    }
  }, {
    key: 'play',
    value: function play() {
      var _this5 = this;

      return new Promise(function (resolve, reject) {
        if (_this5._context.state === 'suspended') {
          _this5._context.resume();

          _this5._log('Play audio');
          _this5.emit(Player.EventTypes.PLAY);
          resolve();
        } else if (_this5._audio && _this5._audio.paused) {
          _this5._log('Play audio');
          _this5.emit(Player.EventTypes.PLAY);
          _this5._audio.play();
          resolve();
        } else {
          return _this5.deque().then(function (audioBuffer) {
            _this5._log('Play audio');
            _this5.emit(Player.EventTypes.PLAY);
            if (typeof audioBuffer === 'string') {
              return _this5.playUrl(audioBuffer);
            }
            return _this5.playAudioBuffer(audioBuffer);
          }).then(resolve);
        }
      });
    }
  }, {
    key: 'playQueue',
    value: function playQueue() {
      var _this6 = this;

      return this.play().then(function () {
        if (_this6._queue.length) {
          return _this6.playQueue();
        }
      });
    }
  }, {
    key: 'stop',
    value: function stop() {
      var _this7 = this;

      return new Promise(function (resolve, reject) {
        if (_this7._currentSource) {
          _this7._currentSource.onended = function () {};
          _this7._currentSource.stop();
        }

        if (_this7._audio) {
          _this7._audio.onended = function () {};
          _this7._audio.currentTime = 0;
          _this7._audio.pause();
        }

        _this7._log('Stop audio');
        _this7.emit(Player.EventTypes.STOP);
      });
    }
  }, {
    key: 'pause',
    value: function pause() {
      var _this8 = this;

      return new Promise(function (resolve, reject) {
        if (_this8._currentSource && _this8._context.state === 'running') {
          _this8._context.suspend();
        }

        if (_this8._audio) {
          _this8._audio.pause();
        }

        _this8._log('Pause audio');
        _this8.emit(Player.EventTypes.PAUSE);
      });
    }
  }, {
    key: 'replay',
    value: function replay() {
      var _this9 = this;

      return new Promise(function (resolve, reject) {
        if (_this9._currentBuffer) {
          _this9._log('Replay audio');
          _this9.emit(Player.EventTypes.REPLAY);

          if (_this9._context.state === 'suspended') {
            _this9._context.resume();
          }

          if (_this9._currentSource) {
            _this9._currentSource.stop();
            _this9._currentSource.onended = function () {};
          }
          return _this9.playAudioBuffer(_this9._currentBuffer);
        } else if (_this9._audio) {
          _this9._log('Replay audio');
          _this9.emit(Player.EventTypes.REPLAY);
          return _this9.playUrl(_this9._audio.src);
        } else {
          var error = new Error('No audio source loaded.');
          _this9.emit('error', error);
          reject();
        }
      });
    }
  }, {
    key: 'playBlob',
    value: function playBlob(blob) {
      var _this10 = this;

      return new Promise(function (resolve, reject) {
        if (!blob) {
          reject();
        }

        var objectUrl = URL.createObjectURL(blob);
        var audio = new Audio();
        audio.src = objectUrl;
        _this10._currentBuffer = null;
        _this10._currentSource = null;
        _this10._audio = audio;

        audio.onended = function () {
          _this10._log('Audio ended');
          _this10.emit(Player.EventTypes.ENDED);
          resolve();
        };

        audio.onerror = function (error) {
          _this10.emit('error', error);
          reject(error);
        };

        audio.onload = function (event) {
          URL.revokeObjectUrl(objectUrl);
        };

        audio.play();
      });
    }
  }, {
    key: 'playAudioBuffer',
    value: function playAudioBuffer(buffer) {
      var _this11 = this;

      return new Promise(function (resolve, reject) {
        if (!buffer) {
          reject();
        }

        var source = _this11._context.createBufferSource();
        source.buffer = buffer;
        source.connect(_this11._context.destination);
        source.start(0);
        _this11._currentBuffer = buffer;
        _this11._currentSource = source;
        _this11._audio = null;

        source.onended = function (event) {
          _this11._log('Audio ended');
          _this11.emit(Player.EventTypes.ENDED);
          resolve();
        };

        source.onerror = function (error) {
          _this11.emit('error', error);
          reject(error);
        };
      });
    }
  }, {
    key: 'playUrl',
    value: function playUrl(url) {
      var _this12 = this;

      return new Promise(function (resolve, reject) {
        var audio = new Audio();
        audio.src = url;
        _this12._currentBuffer = null;
        _this12._currentSource = null;
        _this12._audio = audio;

        audio.onended = function (event) {
          _this12._log('Audio ended');
          _this12.emit(Player.EventTypes.ENDED);
          resolve();
        };

        audio.onerror = function (error) {
          _this12.emit('error', error);
          reject(error);
        };

        audio.play();
      });
    }
  }], [{
    key: 'EventTypes',
    get: function get() {
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
  }]);

  return Player;
}();

module.exports = Player;

},{"./Observable":9,"./utils/arrayBufferToAudioBuffer":11}],11:[function(require,module,exports){
'use strict';

function arrayBufferToAudioBuffer(arrayBuffer, context) {
  window.AudioContext = window.AudioContext || window.webkitAudioContext;

  return new Promise(function (resolve, reject) {
    if (context) {
      if (Object.prototype.toString.call(context) !== '[object AudioContext]') {
        throw new TypeError('`context` must be an AudioContext');
      }
    } else {
      context = new AudioContext();
    }

    context.decodeAudioData(arrayBuffer, function (data) {
      resolve(data);
    }, reject);
  });
}

module.exports = arrayBufferToAudioBuffer;

},{}],12:[function(require,module,exports){
'use strict';

/**
 * @credit https://developers.google.com/web/updates/2012/06/How-to-convert-ArrayBuffer-to-and-from-String?hl=en
 */

function arrayBufferToString(buffer) {
  return String.fromCharCode.apply(null, new Uint16Array(buffer));
}

module.exports = arrayBufferToString;

},{}],13:[function(require,module,exports){
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

module.exports = downsampleBuffer;

},{}],14:[function(require,module,exports){
'use strict';

/**
 * @credit https://github.com/mattdiamond/Recorderjs
 */

function interleave(leftChannel, rightChannel) {
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

module.exports = interleave;

},{}],15:[function(require,module,exports){
'use strict';

/**
 * @credit https://github.com/mattdiamond/Recorderjs
 */

function mergeBuffers(channelBuffer, recordingLength) {
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

module.exports = mergeBuffers;

},{}],16:[function(require,module,exports){
'use strict';

/**
 * @credit https://github.com/mattdiamond/Recorderjs
 */

function writeUTFBytes(view, offset, string) {
  var length = string.length;

  for (var i = 0; i < length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

module.exports = writeUTFBytes;

},{}],17:[function(require,module,exports){
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
            body: null,
            meta: {
              body: {
                byteOffset: {
                  start: null,
                  end: null
                }
              }
            }
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

          let startOffset = null;
          let endOffset = null;

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

              startOffset = boundaryNewlineIndexes[i];
              endOffset = boundaryIndexes[i + 1];
              body = message.slice(startOffset, endOffset);
            } else {
              body = part;
            }
          } else {
            body = part;
          }

          result.body = httpMessageParser._isFakeBuffer(body) ? body.toString() : body;
          result.meta.body.byteOffset.start = startOffset;
          result.meta.body.byteOffset.end = endOffset;

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

},{"buffer":2}],18:[function(require,module,exports){
'use strict';

var Stringify = require('./stringify');
var Parse = require('./parse');

module.exports = {
    stringify: Stringify,
    parse: Parse
};

},{"./parse":19,"./stringify":20}],19:[function(require,module,exports){
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

},{"./utils":21}],20:[function(require,module,exports){
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

},{"./utils":21}],21:[function(require,module,exports){
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

},{}]},{},[1])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJpbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9idWZmZXIvaW5kZXguanMiLCJub2RlX21vZHVsZXMvYnVmZmVyL25vZGVfbW9kdWxlcy9iYXNlNjQtanMvbGliL2I2NC5qcyIsIm5vZGVfbW9kdWxlcy9idWZmZXIvbm9kZV9tb2R1bGVzL2llZWU3NTQvaW5kZXguanMiLCJub2RlX21vZHVsZXMvYnVmZmVyL25vZGVfbW9kdWxlcy9pc2FycmF5L2luZGV4LmpzIiwiLi4vaW5kZXguanMiLCIuLi9saWIvQVZTLmpzIiwiLi4vbGliL0FtYXpvbkVycm9yQ29kZXMuanMiLCIuLi9saWIvT2JzZXJ2YWJsZS5qcyIsIi4uL2xpYi9QbGF5ZXIuanMiLCIuLi9saWIvdXRpbHMvYXJyYXlCdWZmZXJUb0F1ZGlvQnVmZmVyLmpzIiwiLi4vbGliL3V0aWxzL2FycmF5QnVmZmVyVG9TdHJpbmcuanMiLCIuLi9saWIvdXRpbHMvZG93bnNhbXBsZUJ1ZmZlci5qcyIsIi4uL2xpYi91dGlscy9pbnRlcmxlYXZlLmpzIiwiLi4vbGliL3V0aWxzL21lcmdlQnVmZmVycy5qcyIsIi4uL2xpYi91dGlscy93cml0ZVVURkJ5dGVzLmpzIiwiLi4vbm9kZV9tb2R1bGVzL2h0dHAtbWVzc2FnZS1wYXJzZXIvaHR0cC1tZXNzYWdlLXBhcnNlci5qcyIsIi4uL25vZGVfbW9kdWxlcy9xcy9saWIvaW5kZXguanMiLCIuLi9ub2RlX21vZHVsZXMvcXMvbGliL3BhcnNlLmpzIiwiLi4vbm9kZV9tb2R1bGVzL3FzL2xpYi9zdHJpbmdpZnkuanMiLCIuLi9ub2RlX21vZHVsZXMvcXMvbGliL3V0aWxzLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7QUNBQSxJQUFNLE1BQU0sUUFBUSxLQUFSLENBQU47QUFDTixJQUFNLFNBQVMsSUFBSSxNQUFKOztBQUVmLElBQU0sTUFBTSxJQUFJLEdBQUosQ0FBUTtBQUNsQixT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QTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQ2g3Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFD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OztBQ2JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUNqVkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDVEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BLQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbklBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsImNvbnN0IEFWUyA9IHJlcXVpcmUoJy4uLycpO1xuY29uc3QgcGxheWVyID0gQVZTLlBsYXllcjtcblxuY29uc3QgYXZzID0gbmV3IEFWUyh7XG4gIGRlYnVnOiB0cnVlLFxuICBjbGllbnRJZDogJ2Ftem4xLmFwcGxpY2F0aW9uLW9hMi1jbGllbnQuNjk2YWI5MGZjNTg0NGZkYmI4ZWZjMTczOTRhNzljMDAnLFxuICBkZXZpY2VJZDogJ3Rlc3RfZGV2aWNlJyxcbiAgZGV2aWNlU2VyaWFsTnVtYmVyOiAxMjMsXG4gIHJlZGlyZWN0VXJpOiBgaHR0cHM6Ly8ke3dpbmRvdy5sb2NhdGlvbi5ob3N0fS9hdXRocmVzcG9uc2VgXG59KTtcbndpbmRvdy5hdnMgPSBhdnM7XG5cbmF2cy5vbihBVlMuRXZlbnRUeXBlcy5UT0tFTl9TRVQsICgpID0+IHtcbiAgbG9naW5CdG4uZGlzYWJsZWQgPSB0cnVlO1xuICBsb2dvdXRCdG4uZGlzYWJsZWQgPSBmYWxzZTtcbiAgc3RhcnRSZWNvcmRpbmcuZGlzYWJsZWQgPSBmYWxzZTtcbiAgc3RvcFJlY29yZGluZy5kaXNhYmxlZCA9IHRydWU7XG59KTtcblxuYXZzLm9uKEFWUy5FdmVudFR5cGVzLlJFQ09SRF9TVEFSVCwgKCkgPT4ge1xuICBzdGFydFJlY29yZGluZy5kaXNhYmxlZCA9IHRydWU7XG4gIHN0b3BSZWNvcmRpbmcuZGlzYWJsZWQgPSBmYWxzZTtcbn0pO1xuXG5hdnMub24oQVZTLkV2ZW50VHlwZXMuUkVDT1JEX1NUT1AsICgpID0+IHtcbiAgc3RhcnRSZWNvcmRpbmcuZGlzYWJsZWQgPSBmYWxzZTtcbiAgc3RvcFJlY29yZGluZy5kaXNhYmxlZCA9IHRydWU7XG59KTtcblxuYXZzLm9uKEFWUy5FdmVudFR5cGVzLkxPR09VVCwgKCkgPT4ge1xuICBsb2dpbkJ0bi5kaXNhYmxlZCA9IGZhbHNlO1xuICBsb2dvdXRCdG4uZGlzYWJsZWQgPSB0cnVlO1xuICBzdGFydFJlY29yZGluZy5kaXNhYmxlZCA9IHRydWU7XG4gIHN0b3BSZWNvcmRpbmcuZGlzYWJsZWQgPSB0cnVlO1xufSk7XG5cbmF2cy5vbihBVlMuRXZlbnRUeXBlcy5UT0tFTl9JTlZBTElELCAoKSA9PiB7XG4gIGF2cy5sb2dvdXQoKVxuICAudGhlbihsb2dpbilcbn0pO1xuXG5hdnMub24oQVZTLkV2ZW50VHlwZXMuTE9HLCBsb2cpO1xuYXZzLm9uKEFWUy5FdmVudFR5cGVzLkVSUk9SLCBsb2dFcnJvcik7XG5cbmF2cy5wbGF5ZXIub24oQVZTLlBsYXllci5FdmVudFR5cGVzLkxPRywgbG9nKTtcbmF2cy5wbGF5ZXIub24oQVZTLlBsYXllci5FdmVudFR5cGVzLkVSUk9SLCBsb2dFcnJvcik7XG5cbmF2cy5wbGF5ZXIub24oQVZTLlBsYXllci5FdmVudFR5cGVzLlBMQVksICgpID0+IHtcbiAgcGxheUF1ZGlvLmRpc2FibGVkID0gdHJ1ZTtcbiAgcmVwbGF5QXVkaW8uZGlzYWJsZWQgPSB0cnVlO1xuICBwYXVzZUF1ZGlvLmRpc2FibGVkID0gZmFsc2U7XG4gIHN0b3BBdWRpby5kaXNhYmxlZCA9IGZhbHNlO1xufSk7XG5cbmF2cy5wbGF5ZXIub24oQVZTLlBsYXllci5FdmVudFR5cGVzLkVOREVELCAoKSA9PiB7XG4gIHBsYXlBdWRpby5kaXNhYmxlZCA9IHRydWU7XG4gIHJlcGxheUF1ZGlvLmRpc2FibGVkID0gZmFsc2U7XG4gIHBhdXNlQXVkaW8uZGlzYWJsZWQgPSB0cnVlO1xuICBzdG9wQXVkaW8uZGlzYWJsZWQgPSB0cnVlO1xufSk7XG5cbmF2cy5wbGF5ZXIub24oQVZTLlBsYXllci5FdmVudFR5cGVzLlNUT1AsICgpID0+IHtcbiAgcGxheUF1ZGlvLmRpc2FibGVkID0gdHJ1ZTtcbiAgcmVwbGF5QXVkaW8uZGlzYWJsZWQgPSBmYWxzZTtcbiAgcGF1c2VBdWRpby5kaXNhYmxlZCA9IGZhbHNlO1xuICBzdG9wQXVkaW8uZGlzYWJsZWQgPSBmYWxzZTtcbn0pO1xuXG5hdnMucGxheWVyLm9uKEFWUy5QbGF5ZXIuRXZlbnRUeXBlcy5QQVVTRSwgKCkgPT4ge1xuICBwbGF5QXVkaW8uZGlzYWJsZWQgPSBmYWxzZTtcbiAgcmVwbGF5QXVkaW8uZGlzYWJsZWQgPSBmYWxzZTtcbiAgcGF1c2VBdWRpby5kaXNhYmxlZCA9IHRydWU7XG4gIHN0b3BBdWRpby5kaXNhYmxlZCA9IHRydWU7XG59KTtcblxuYXZzLnBsYXllci5vbihBVlMuUGxheWVyLkV2ZW50VHlwZXMuUkVQTEFZLCAoKSA9PiB7XG4gIHBsYXlBdWRpby5kaXNhYmxlZCA9IHRydWU7XG4gIHJlcGxheUF1ZGlvLmRpc2FibGVkID0gdHJ1ZTtcbiAgcGF1c2VBdWRpby5kaXNhYmxlZCA9IGZhbHNlO1xuICBzdG9wQXVkaW8uZGlzYWJsZWQgPSBmYWxzZTtcbn0pO1xuXG5mdW5jdGlvbiBsb2cobWVzc2FnZSkge1xuICBsb2dPdXRwdXQuaW5uZXJIVE1MID0gYDxsaT5MT0c6ICR7bWVzc2FnZX08L2xpPmAgKyBsb2dPdXRwdXQuaW5uZXJIVE1MO1xufVxuXG5mdW5jdGlvbiBsb2dFcnJvcihlcnJvcikge1xuICBsb2dPdXRwdXQuaW5uZXJIVE1MID0gYDxsaT5FUlJPUjogJHtlcnJvcn08L2xpPmAgKyBsb2dPdXRwdXQuaW5uZXJIVE1MO1xufVxuXG5mdW5jdGlvbiBsb2dBdWRpb0Jsb2IoYmxvYiwgbWVzc2FnZSkge1xuICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgIGNvbnN0IGEgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdhJyk7XG4gICAgY29uc3QgYURvd25sb2FkID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYScpO1xuICAgIGNvbnN0IHVybCA9IHdpbmRvdy5VUkwuY3JlYXRlT2JqZWN0VVJMKGJsb2IpO1xuICAgIGNvbnN0IGV4dCA9IGJsb2IudHlwZS5pbmRleE9mKCdtcGVnJykgPiAtMSA/ICdtcDMnIDogJ3dhdic7XG4gICAgY29uc3QgZmlsZW5hbWUgPSBgJHtEYXRlLm5vdygpfS4ke2V4dH1gO1xuICAgIGEuaHJlZiA9IHVybDtcbiAgICBhLnRhcmdldCA9ICdfYmxhbmsnO1xuICAgIGFEb3dubG9hZC5ocmVmID0gdXJsO1xuICAgIGEudGV4dENvbnRlbnQgPSBmaWxlbmFtZTtcbiAgICBhRG93bmxvYWQuZG93bmxvYWQgPSBmaWxlbmFtZTtcbiAgICBhRG93bmxvYWQudGV4dENvbnRlbnQgPSBgZG93bmxvYWRgO1xuXG4gICAgYXVkaW9Mb2dPdXRwdXQuaW5uZXJIVE1MID0gYDxsaT4ke21lc3NhZ2V9OiAke2Eub3V0ZXJIVE1MfSAke2FEb3dubG9hZC5vdXRlckhUTUx9PC9saT5gICthdWRpb0xvZ091dHB1dC5pbm5lckhUTUw7XG4gICAgcmVzb2x2ZShibG9iKTtcbiAgfSk7XG59XG5cbmNvbnN0IGxvZ2luQnRuID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2xvZ2luJyk7XG5jb25zdCBsb2dvdXRCdG4gPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnbG9nb3V0Jyk7XG5jb25zdCBsb2dPdXRwdXQgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnbG9nJyk7XG5jb25zdCBhdWRpb0xvZ091dHB1dCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdhdWRpb0xvZycpO1xuY29uc3Qgc3RhcnRSZWNvcmRpbmcgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnc3RhcnRSZWNvcmRpbmcnKTtcbmNvbnN0IHN0b3BSZWNvcmRpbmcgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnc3RvcFJlY29yZGluZycpO1xuY29uc3Qgc3RvcEF1ZGlvID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3N0b3BBdWRpbycpO1xuY29uc3QgcGF1c2VBdWRpbyA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdwYXVzZUF1ZGlvJyk7XG5jb25zdCBwbGF5QXVkaW8gPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncGxheUF1ZGlvJyk7XG5jb25zdCByZXBsYXlBdWRpbyA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdyZXBsYXlBdWRpbycpO1xuXG4vKlxuLy8gSWYgdXNpbmcgY2xpZW50IHNlY3JldFxuYXZzLmdldENvZGVGcm9tVXJsKClcbiAudGhlbihjb2RlID0+IGF2cy5nZXRUb2tlbkZyb21Db2RlKGNvZGUpKVxuLnRoZW4odG9rZW4gPT4gbG9jYWxTdG9yYWdlLnNldEl0ZW0oJ3Rva2VuJywgdG9rZW4pKVxuLnRoZW4ocmVmcmVzaFRva2VuID0+IGxvY2FsU3RvcmFnZS5zZXRJdGVtKCdyZWZyZXNoVG9rZW4nLCByZWZyZXNoVG9rZW4pKVxuLnRoZW4oKCkgPT4gYXZzLnJlcXVlc3RNaWMoKSlcbi50aGVuKCgpID0+IGF2cy5yZWZyZXNoVG9rZW4oKSlcbi5jYXRjaCgoKSA9PiB7XG5cbn0pO1xuKi9cblxuYXZzLmdldFRva2VuRnJvbVVybCgpXG4udGhlbigoKSA9PiBhdnMuZ2V0VG9rZW4oKSlcbi50aGVuKHRva2VuID0+IGxvY2FsU3RvcmFnZS5zZXRJdGVtKCd0b2tlbicsIHRva2VuKSlcbi50aGVuKCgpID0+IGF2cy5yZXF1ZXN0TWljKCkpXG4uY2F0Y2goKCkgPT4ge1xuICBjb25zdCBjYWNoZWRUb2tlbiA9IGxvY2FsU3RvcmFnZS5nZXRJdGVtKCd0b2tlbicpO1xuXG4gIGlmIChjYWNoZWRUb2tlbikge1xuICAgIGF2cy5zZXRUb2tlbihjYWNoZWRUb2tlbik7XG4gICAgcmV0dXJuIGF2cy5yZXF1ZXN0TWljKCk7XG4gIH1cbn0pO1xuXG5sb2dpbkJ0bi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIGxvZ2luKTtcblxuZnVuY3Rpb24gbG9naW4oZXZlbnQpIHtcbiAgcmV0dXJuIGF2cy5sb2dpbigpXG4gIC50aGVuKCgpID0+IGF2cy5yZXF1ZXN0TWljKCkpXG4gIC5jYXRjaCgoKSA9PiB7fSk7XG5cbiAgLypcbiAgLy8gSWYgdXNpbmcgY2xpZW50IHNlY3JldFxuICBhdnMubG9naW4oe3Jlc3BvbnNlVHlwZTogJ2NvZGUnfSlcbiAgLnRoZW4oKCkgPT4gYXZzLnJlcXVlc3RNaWMoKSlcbiAgLmNhdGNoKCgpID0+IHt9KTtcbiAgKi9cbn1cblxubG9nb3V0QnRuLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgbG9nb3V0KTtcblxuZnVuY3Rpb24gbG9nb3V0KCkge1xuICByZXR1cm4gYXZzLmxvZ291dCgpXG4gIC50aGVuKCgpID0+IHtcbiAgICBsb2NhbFN0b3JhZ2UucmVtb3ZlSXRlbSgndG9rZW4nKTtcbiAgICB3aW5kb3cubG9jYXRpb24uaGFzaCA9ICcnO1xuICB9KTtcbn1cblxuc3RhcnRSZWNvcmRpbmcuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7XG4gIGF2cy5zdGFydFJlY29yZGluZygpO1xufSk7XG5cbnN0b3BSZWNvcmRpbmcuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7XG4gIGF2cy5zdG9wUmVjb3JkaW5nKCkudGhlbihkYXRhVmlldyA9PiB7XG4gICAgYXZzLnBsYXllci5lbXB0eVF1ZXVlKClcbiAgICAudGhlbigoKSA9PiBhdnMuYXVkaW9Ub0Jsb2IoZGF0YVZpZXcpKVxuICAgIC50aGVuKGJsb2IgPT4gbG9nQXVkaW9CbG9iKGJsb2IsICdWT0lDRScpKVxuICAgIC50aGVuKCgpID0+IGF2cy5wbGF5ZXIuZW5xdWV1ZShkYXRhVmlldykpXG4gICAgLnRoZW4oKCkgPT4gYXZzLnBsYXllci5wbGF5KCkpXG4gICAgLmNhdGNoKGVycm9yID0+IHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoZXJyb3IpO1xuICAgIH0pO1xuXG4gICAgICAgIHZhciBhYiA9IGZhbHNlO1xuICAgIC8vc2VuZEJsb2IoYmxvYik7XG4gICAgYXZzLnNlbmRBdWRpbyhkYXRhVmlldylcbiAgICAudGhlbigoe3hociwgcmVzcG9uc2V9KSA9PiB7XG5cbiAgICAgIHZhciBwcm9taXNlcyA9IFtdO1xuICAgICAgdmFyIGF1ZGlvTWFwID0ge307XG4gICAgICB2YXIgZGlyZWN0aXZlcyA9IG51bGw7XG5cbiAgICAgIGlmIChyZXNwb25zZS5tdWx0aXBhcnQubGVuZ3RoKSB7XG4gICAgICAgIHJlc3BvbnNlLm11bHRpcGFydC5mb3JFYWNoKG11bHRpcGFydCA9PiB7XG4gICAgICAgICAgbGV0IGJvZHkgPSBtdWx0aXBhcnQuYm9keTtcbiAgICAgICAgICBpZiAobXVsdGlwYXJ0LmhlYWRlcnMgJiYgbXVsdGlwYXJ0LmhlYWRlcnNbJ0NvbnRlbnQtVHlwZSddID09PSAnYXBwbGljYXRpb24vanNvbicpIHtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgIGJvZHkgPSBKU09OLnBhcnNlKGJvZHkpO1xuICAgICAgICAgICAgfSBjYXRjaChlcnJvcikge1xuICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKGVycm9yKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKGJvZHkgJiYgYm9keS5tZXNzYWdlQm9keSAmJiBib2R5Lm1lc3NhZ2VCb2R5LmRpcmVjdGl2ZXMpIHtcbiAgICAgICAgICAgICAgZGlyZWN0aXZlcyA9IGJvZHkubWVzc2FnZUJvZHkuZGlyZWN0aXZlcztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2UgaWYgKG11bHRpcGFydC5oZWFkZXJzWydDb250ZW50LVR5cGUnXSA9PT0gJ2F1ZGlvL21wZWcnKSB7XG4gICAgICAgICAgICBjb25zdCBzdGFydCA9IG11bHRpcGFydC5tZXRhLmJvZHkuYnl0ZU9mZnNldC5zdGFydDtcbiAgICAgICAgICAgIGNvbnN0IGVuZCA9IG11bHRpcGFydC5tZXRhLmJvZHkuYnl0ZU9mZnNldC5lbmQ7XG5cbiAgICAgICAgICAgIC8qKlxuICAgICAgICAgICAgICogTm90IHN1cmUgaWYgYnVnIGluIGJ1ZmZlciBtb2R1bGUgb3IgaW4gaHR0cCBtZXNzYWdlIHBhcnNlclxuICAgICAgICAgICAgICogYmVjYXVzZSBpdCdzIGpvaW5pbmcgYXJyYXlidWZmZXJzIHNvIEkgaGF2ZSB0byB0aGlzIHRvXG4gICAgICAgICAgICAgKiBzZXBlcmF0ZSB0aGVtIG91dC5cbiAgICAgICAgICAgICAqL1xuICAgICAgICAgICAgdmFyIHNsaWNlZEJvZHkgPSB4aHIucmVzcG9uc2Uuc2xpY2Uoc3RhcnQsIGVuZCk7XG5cbiAgICAgICAgICAgIC8vcHJvbWlzZXMucHVzaChhdnMucGxheWVyLmVucXVldWUoc2xpY2VkQm9keSkpO1xuICAgICAgICAgICAgYXVkaW9NYXBbbXVsdGlwYXJ0LmhlYWRlcnNbJ0NvbnRlbnQtSUQnXV0gPSBzbGljZWRCb2R5O1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cbiAgICAgICAgZnVuY3Rpb24gZmluZEF1ZGlvRnJvbUNvbnRlbnRJZChjb250ZW50SWQpIHtcbiAgICAgICAgICBjb250ZW50SWQgPSBjb250ZW50SWQucmVwbGFjZSgnY2lkOicsICcnKTtcbiAgICAgICAgICBmb3IgKHZhciBrZXkgaW4gYXVkaW9NYXApIHtcbiAgICAgICAgICAgIGlmIChrZXkuaW5kZXhPZihjb250ZW50SWQpID4gLTEpIHtcbiAgICAgICAgICAgICAgcmV0dXJuIGF1ZGlvTWFwW2tleV07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgZGlyZWN0aXZlcy5mb3JFYWNoKGRpcmVjdGl2ZSA9PiB7XG4gICAgICAgICAgaWYgKGRpcmVjdGl2ZS5uYW1lc3BhY2UgPT09ICdTcGVlY2hTeW50aGVzaXplcicpIHtcbiAgICAgICAgICAgIGlmIChkaXJlY3RpdmUubmFtZSA9PT0gJ3NwZWFrJykge1xuICAgICAgICAgICAgICBjb25zdCBjb250ZW50SWQgPSBkaXJlY3RpdmUucGF5bG9hZC5hdWRpb0NvbnRlbnQ7XG4gICAgICAgICAgICAgIGNvbnN0IGF1ZGlvID0gZmluZEF1ZGlvRnJvbUNvbnRlbnRJZChjb250ZW50SWQpO1xuICAgICAgICAgICAgICBpZiAoYXVkaW8pIHtcbiAgICAgICAgICAgICAgICBhdnMuYXVkaW9Ub0Jsb2IoYXVkaW8pXG4gICAgICAgICAgICAgICAgLnRoZW4oYmxvYiA9PiBsb2dBdWRpb0Jsb2IoYmxvYiwgJ1JFU1BPTlNFJykpO1xuICAgICAgICAgICAgICAgIHByb21pc2VzLnB1c2goYXZzLnBsYXllci5lbnF1ZXVlKGF1ZGlvKSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2UgaWYgKGRpcmVjdGl2ZS5uYW1lc3BhY2UgPT09ICdBdWRpb1BsYXllcicpIHtcbiAgICAgICAgICAgIGlmIChkaXJlY3RpdmUubmFtZSA9PT0gJ3BsYXknKSB7XG4gICAgICAgICAgICAgIGNvbnN0IHN0cmVhbXMgPSBkaXJlY3RpdmUucGF5bG9hZC5hdWRpb0l0ZW0uc3RyZWFtcztcbiAgICAgICAgICAgICAgc3RyZWFtcy5mb3JFYWNoKHN0cmVhbSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3Qgc3RyZWFtVXJsID0gc3RyZWFtLnN0cmVhbVVybDtcblxuICAgICAgICAgICAgICAgIGNvbnN0IGF1ZGlvID0gZmluZEF1ZGlvRnJvbUNvbnRlbnRJZChzdHJlYW1VcmwpO1xuICAgICAgICAgICAgICAgIGlmIChhdWRpbykge1xuICAgICAgICAgICAgICAgICAgYXZzLmF1ZGlvVG9CbG9iKGF1ZGlvKVxuICAgICAgICAgICAgICAgICAgLnRoZW4oYmxvYiA9PiBsb2dBdWRpb0Jsb2IoYmxvYiwgJ1JFU1BPTlNFJykpO1xuICAgICAgICAgICAgICAgICAgcHJvbWlzZXMucHVzaChhdnMucGxheWVyLmVucXVldWUoYXVkaW8pKTtcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKHN0cmVhbVVybC5pbmRleE9mKCdodHRwJykgPiAtMSkge1xuICAgICAgICAgICAgICAgICAgY29uc3QgeGhyID0gbmV3IFhNTEh0dHBSZXF1ZXN0KCk7XG4gICAgICAgICAgICAgICAgICBjb25zdCB1cmwgPSBgL3BhcnNlLW0zdT91cmw9JHtzdHJlYW1VcmwucmVwbGFjZSgvIS4qJC8sICcnKX1gO1xuICAgICAgICAgICAgICAgICAgeGhyLm9wZW4oJ0dFVCcsIHVybCwgdHJ1ZSk7XG4gICAgICAgICAgICAgICAgICB4aHIucmVzcG9uc2VUeXBlID0gJ2pzb24nO1xuICAgICAgICAgICAgICAgICAgeGhyLm9ubG9hZCA9IChldmVudCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCB1cmxzID0gZXZlbnQuY3VycmVudFRhcmdldC5yZXNwb25zZTtcblxuICAgICAgICAgICAgICAgICAgICB1cmxzLmZvckVhY2godXJsID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICBhdnMucGxheWVyLmVucXVldWUodXJsKTtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgICAgeGhyLnNlbmQoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChkaXJlY3RpdmUubmFtZXNwYWNlID09PSAnU3BlZWNoUmVjb2duaXplcicpIHtcbiAgICAgICAgICAgICAgaWYgKGRpcmVjdGl2ZS5uYW1lID09PSAnbGlzdGVuJykge1xuICAgICAgICAgICAgICAgIGNvbnN0IHRpbWVvdXQgPSBkaXJlY3RpdmUucGF5bG9hZC50aW1lb3V0SW50ZXJ2YWxJbk1pbGxpcztcbiAgICAgICAgICAgICAgICAvLyBlbmFibGUgbWljXG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGlmIChwcm9taXNlcy5sZW5ndGgpIHtcbiAgICAgICAgICBQcm9taXNlLmFsbChwcm9taXNlcylcbiAgICAgICAgIC50aGVuKCgpID0+IHtcbiAgICAgICAgICAgIGF2cy5wbGF5ZXIucGxheVF1ZXVlKClcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgfSlcbiAgICAuY2F0Y2goZXJyb3IgPT4ge1xuICAgICAgY29uc29sZS5lcnJvcihlcnJvcik7XG4gICAgfSk7XG4gIH0pO1xufSk7XG5cbnN0b3BBdWRpby5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIChldmVudCkgPT4ge1xuICBhdnMucGxheWVyLnN0b3AoKTtcbn0pO1xuXG5wYXVzZUF1ZGlvLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKGV2ZW50KSA9PiB7XG4gIGF2cy5wbGF5ZXIucGF1c2UoKTtcbn0pO1xuXG5wbGF5QXVkaW8uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoZXZlbnQpID0+IHtcbiAgYXZzLnBsYXllci5wbGF5KCk7XG59KTtcblxucmVwbGF5QXVkaW8uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoZXZlbnQpID0+IHtcbiAgYXZzLnBsYXllci5yZXBsYXkoKTtcbn0pO1xuXG5mdW5jdGlvbiBzZW5kQmxvYihibG9iKSB7XG4gIGNvbnN0IHhociA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xuICBjb25zdCBmZCA9IG5ldyBGb3JtRGF0YSgpO1xuXG4gIGZkLmFwcGVuZCgnZm5hbWUnLCAnYXVkaW8ud2F2Jyk7XG4gIGZkLmFwcGVuZCgnZGF0YScsIGJsb2IpO1xuXG4gIHhoci5vcGVuKCdQT1NUJywgJ2h0dHA6Ly9sb2NhbGhvc3Q6NTU1NS9hdWRpbycsIHRydWUpO1xuICB4aHIucmVzcG9uc2VUeXBlID0gJ2Jsb2InO1xuXG4gIHhoci5vbmxvYWQgPSAoZXZlbnQpID0+IHtcbiAgICBpZiAoeGhyLnN0YXR1cyA9PSAyMDApIHtcbiAgICAgIGNvbnNvbGUubG9nKHhoci5yZXNwb25zZSk7XG4gICAgICAvL2NvbnN0IHJlc3BvbnNlQmxvYiA9IG5ldyBCbG9iKFt4aHIucmVzcG9uc2VdLCB7dHlwZTogJ2F1ZGlvL21wMyd9KTtcbiAgICB9XG4gIH07XG5cbiAgeGhyLnNlbmQoZmQpO1xufVxuIiwiLyohXG4gKiBUaGUgYnVmZmVyIG1vZHVsZSBmcm9tIG5vZGUuanMsIGZvciB0aGUgYnJvd3Nlci5cbiAqXG4gKiBAYXV0aG9yICAgRmVyb3NzIEFib3VraGFkaWplaCA8ZmVyb3NzQGZlcm9zcy5vcmc+IDxodHRwOi8vZmVyb3NzLm9yZz5cbiAqIEBsaWNlbnNlICBNSVRcbiAqL1xuLyogZXNsaW50LWRpc2FibGUgbm8tcHJvdG8gKi9cblxuJ3VzZSBzdHJpY3QnXG5cbnZhciBiYXNlNjQgPSByZXF1aXJlKCdiYXNlNjQtanMnKVxudmFyIGllZWU3NTQgPSByZXF1aXJlKCdpZWVlNzU0JylcbnZhciBpc0FycmF5ID0gcmVxdWlyZSgnaXNhcnJheScpXG5cbmV4cG9ydHMuQnVmZmVyID0gQnVmZmVyXG5leHBvcnRzLlNsb3dCdWZmZXIgPSBTbG93QnVmZmVyXG5leHBvcnRzLklOU1BFQ1RfTUFYX0JZVEVTID0gNTBcbkJ1ZmZlci5wb29sU2l6ZSA9IDgxOTIgLy8gbm90IHVzZWQgYnkgdGhpcyBpbXBsZW1lbnRhdGlvblxuXG52YXIgcm9vdFBhcmVudCA9IHt9XG5cbi8qKlxuICogSWYgYEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUYDpcbiAqICAgPT09IHRydWUgICAgVXNlIFVpbnQ4QXJyYXkgaW1wbGVtZW50YXRpb24gKGZhc3Rlc3QpXG4gKiAgID09PSBmYWxzZSAgIFVzZSBPYmplY3QgaW1wbGVtZW50YXRpb24gKG1vc3QgY29tcGF0aWJsZSwgZXZlbiBJRTYpXG4gKlxuICogQnJvd3NlcnMgdGhhdCBzdXBwb3J0IHR5cGVkIGFycmF5cyBhcmUgSUUgMTArLCBGaXJlZm94IDQrLCBDaHJvbWUgNyssIFNhZmFyaSA1LjErLFxuICogT3BlcmEgMTEuNissIGlPUyA0LjIrLlxuICpcbiAqIER1ZSB0byB2YXJpb3VzIGJyb3dzZXIgYnVncywgc29tZXRpbWVzIHRoZSBPYmplY3QgaW1wbGVtZW50YXRpb24gd2lsbCBiZSB1c2VkIGV2ZW5cbiAqIHdoZW4gdGhlIGJyb3dzZXIgc3VwcG9ydHMgdHlwZWQgYXJyYXlzLlxuICpcbiAqIE5vdGU6XG4gKlxuICogICAtIEZpcmVmb3ggNC0yOSBsYWNrcyBzdXBwb3J0IGZvciBhZGRpbmcgbmV3IHByb3BlcnRpZXMgdG8gYFVpbnQ4QXJyYXlgIGluc3RhbmNlcyxcbiAqICAgICBTZWU6IGh0dHBzOi8vYnVnemlsbGEubW96aWxsYS5vcmcvc2hvd19idWcuY2dpP2lkPTY5NTQzOC5cbiAqXG4gKiAgIC0gQ2hyb21lIDktMTAgaXMgbWlzc2luZyB0aGUgYFR5cGVkQXJyYXkucHJvdG90eXBlLnN1YmFycmF5YCBmdW5jdGlvbi5cbiAqXG4gKiAgIC0gSUUxMCBoYXMgYSBicm9rZW4gYFR5cGVkQXJyYXkucHJvdG90eXBlLnN1YmFycmF5YCBmdW5jdGlvbiB3aGljaCByZXR1cm5zIGFycmF5cyBvZlxuICogICAgIGluY29ycmVjdCBsZW5ndGggaW4gc29tZSBzaXR1YXRpb25zLlxuXG4gKiBXZSBkZXRlY3QgdGhlc2UgYnVnZ3kgYnJvd3NlcnMgYW5kIHNldCBgQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlRgIHRvIGBmYWxzZWAgc28gdGhleVxuICogZ2V0IHRoZSBPYmplY3QgaW1wbGVtZW50YXRpb24sIHdoaWNoIGlzIHNsb3dlciBidXQgYmVoYXZlcyBjb3JyZWN0bHkuXG4gKi9cbkJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUID0gZ2xvYmFsLlRZUEVEX0FSUkFZX1NVUFBPUlQgIT09IHVuZGVmaW5lZFxuICA/IGdsb2JhbC5UWVBFRF9BUlJBWV9TVVBQT1JUXG4gIDogdHlwZWRBcnJheVN1cHBvcnQoKVxuXG5mdW5jdGlvbiB0eXBlZEFycmF5U3VwcG9ydCAoKSB7XG4gIHRyeSB7XG4gICAgdmFyIGFyciA9IG5ldyBVaW50OEFycmF5KDEpXG4gICAgYXJyLmZvbyA9IGZ1bmN0aW9uICgpIHsgcmV0dXJuIDQyIH1cbiAgICByZXR1cm4gYXJyLmZvbygpID09PSA0MiAmJiAvLyB0eXBlZCBhcnJheSBpbnN0YW5jZXMgY2FuIGJlIGF1Z21lbnRlZFxuICAgICAgICB0eXBlb2YgYXJyLnN1YmFycmF5ID09PSAnZnVuY3Rpb24nICYmIC8vIGNocm9tZSA5LTEwIGxhY2sgYHN1YmFycmF5YFxuICAgICAgICBhcnIuc3ViYXJyYXkoMSwgMSkuYnl0ZUxlbmd0aCA9PT0gMCAvLyBpZTEwIGhhcyBicm9rZW4gYHN1YmFycmF5YFxuICB9IGNhdGNoIChlKSB7XG4gICAgcmV0dXJuIGZhbHNlXG4gIH1cbn1cblxuZnVuY3Rpb24ga01heExlbmd0aCAoKSB7XG4gIHJldHVybiBCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVFxuICAgID8gMHg3ZmZmZmZmZlxuICAgIDogMHgzZmZmZmZmZlxufVxuXG4vKipcbiAqIFRoZSBCdWZmZXIgY29uc3RydWN0b3IgcmV0dXJucyBpbnN0YW5jZXMgb2YgYFVpbnQ4QXJyYXlgIHRoYXQgaGF2ZSB0aGVpclxuICogcHJvdG90eXBlIGNoYW5nZWQgdG8gYEJ1ZmZlci5wcm90b3R5cGVgLiBGdXJ0aGVybW9yZSwgYEJ1ZmZlcmAgaXMgYSBzdWJjbGFzcyBvZlxuICogYFVpbnQ4QXJyYXlgLCBzbyB0aGUgcmV0dXJuZWQgaW5zdGFuY2VzIHdpbGwgaGF2ZSBhbGwgdGhlIG5vZGUgYEJ1ZmZlcmAgbWV0aG9kc1xuICogYW5kIHRoZSBgVWludDhBcnJheWAgbWV0aG9kcy4gU3F1YXJlIGJyYWNrZXQgbm90YXRpb24gd29ya3MgYXMgZXhwZWN0ZWQgLS0gaXRcbiAqIHJldHVybnMgYSBzaW5nbGUgb2N0ZXQuXG4gKlxuICogVGhlIGBVaW50OEFycmF5YCBwcm90b3R5cGUgcmVtYWlucyB1bm1vZGlmaWVkLlxuICovXG5mdW5jdGlvbiBCdWZmZXIgKGFyZykge1xuICBpZiAoISh0aGlzIGluc3RhbmNlb2YgQnVmZmVyKSkge1xuICAgIC8vIEF2b2lkIGdvaW5nIHRocm91Z2ggYW4gQXJndW1lbnRzQWRhcHRvclRyYW1wb2xpbmUgaW4gdGhlIGNvbW1vbiBjYXNlLlxuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID4gMSkgcmV0dXJuIG5ldyBCdWZmZXIoYXJnLCBhcmd1bWVudHNbMV0pXG4gICAgcmV0dXJuIG5ldyBCdWZmZXIoYXJnKVxuICB9XG5cbiAgaWYgKCFCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkge1xuICAgIHRoaXMubGVuZ3RoID0gMFxuICAgIHRoaXMucGFyZW50ID0gdW5kZWZpbmVkXG4gIH1cblxuICAvLyBDb21tb24gY2FzZS5cbiAgaWYgKHR5cGVvZiBhcmcgPT09ICdudW1iZXInKSB7XG4gICAgcmV0dXJuIGZyb21OdW1iZXIodGhpcywgYXJnKVxuICB9XG5cbiAgLy8gU2xpZ2h0bHkgbGVzcyBjb21tb24gY2FzZS5cbiAgaWYgKHR5cGVvZiBhcmcgPT09ICdzdHJpbmcnKSB7XG4gICAgcmV0dXJuIGZyb21TdHJpbmcodGhpcywgYXJnLCBhcmd1bWVudHMubGVuZ3RoID4gMSA/IGFyZ3VtZW50c1sxXSA6ICd1dGY4JylcbiAgfVxuXG4gIC8vIFVudXN1YWwuXG4gIHJldHVybiBmcm9tT2JqZWN0KHRoaXMsIGFyZylcbn1cblxuLy8gVE9ETzogTGVnYWN5LCBub3QgbmVlZGVkIGFueW1vcmUuIFJlbW92ZSBpbiBuZXh0IG1ham9yIHZlcnNpb24uXG5CdWZmZXIuX2F1Z21lbnQgPSBmdW5jdGlvbiAoYXJyKSB7XG4gIGFyci5fX3Byb3RvX18gPSBCdWZmZXIucHJvdG90eXBlXG4gIHJldHVybiBhcnJcbn1cblxuZnVuY3Rpb24gZnJvbU51bWJlciAodGhhdCwgbGVuZ3RoKSB7XG4gIHRoYXQgPSBhbGxvY2F0ZSh0aGF0LCBsZW5ndGggPCAwID8gMCA6IGNoZWNrZWQobGVuZ3RoKSB8IDApXG4gIGlmICghQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgICB0aGF0W2ldID0gMFxuICAgIH1cbiAgfVxuICByZXR1cm4gdGhhdFxufVxuXG5mdW5jdGlvbiBmcm9tU3RyaW5nICh0aGF0LCBzdHJpbmcsIGVuY29kaW5nKSB7XG4gIGlmICh0eXBlb2YgZW5jb2RpbmcgIT09ICdzdHJpbmcnIHx8IGVuY29kaW5nID09PSAnJykgZW5jb2RpbmcgPSAndXRmOCdcblxuICAvLyBBc3N1bXB0aW9uOiBieXRlTGVuZ3RoKCkgcmV0dXJuIHZhbHVlIGlzIGFsd2F5cyA8IGtNYXhMZW5ndGguXG4gIHZhciBsZW5ndGggPSBieXRlTGVuZ3RoKHN0cmluZywgZW5jb2RpbmcpIHwgMFxuICB0aGF0ID0gYWxsb2NhdGUodGhhdCwgbGVuZ3RoKVxuXG4gIHRoYXQud3JpdGUoc3RyaW5nLCBlbmNvZGluZylcbiAgcmV0dXJuIHRoYXRcbn1cblxuZnVuY3Rpb24gZnJvbU9iamVjdCAodGhhdCwgb2JqZWN0KSB7XG4gIGlmIChCdWZmZXIuaXNCdWZmZXIob2JqZWN0KSkgcmV0dXJuIGZyb21CdWZmZXIodGhhdCwgb2JqZWN0KVxuXG4gIGlmIChpc0FycmF5KG9iamVjdCkpIHJldHVybiBmcm9tQXJyYXkodGhhdCwgb2JqZWN0KVxuXG4gIGlmIChvYmplY3QgPT0gbnVsbCkge1xuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ211c3Qgc3RhcnQgd2l0aCBudW1iZXIsIGJ1ZmZlciwgYXJyYXkgb3Igc3RyaW5nJylcbiAgfVxuXG4gIGlmICh0eXBlb2YgQXJyYXlCdWZmZXIgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgaWYgKG9iamVjdC5idWZmZXIgaW5zdGFuY2VvZiBBcnJheUJ1ZmZlcikge1xuICAgICAgcmV0dXJuIGZyb21UeXBlZEFycmF5KHRoYXQsIG9iamVjdClcbiAgICB9XG4gICAgaWYgKG9iamVjdCBpbnN0YW5jZW9mIEFycmF5QnVmZmVyKSB7XG4gICAgICByZXR1cm4gZnJvbUFycmF5QnVmZmVyKHRoYXQsIG9iamVjdClcbiAgICB9XG4gIH1cblxuICBpZiAob2JqZWN0Lmxlbmd0aCkgcmV0dXJuIGZyb21BcnJheUxpa2UodGhhdCwgb2JqZWN0KVxuXG4gIHJldHVybiBmcm9tSnNvbk9iamVjdCh0aGF0LCBvYmplY3QpXG59XG5cbmZ1bmN0aW9uIGZyb21CdWZmZXIgKHRoYXQsIGJ1ZmZlcikge1xuICB2YXIgbGVuZ3RoID0gY2hlY2tlZChidWZmZXIubGVuZ3RoKSB8IDBcbiAgdGhhdCA9IGFsbG9jYXRlKHRoYXQsIGxlbmd0aClcbiAgYnVmZmVyLmNvcHkodGhhdCwgMCwgMCwgbGVuZ3RoKVxuICByZXR1cm4gdGhhdFxufVxuXG5mdW5jdGlvbiBmcm9tQXJyYXkgKHRoYXQsIGFycmF5KSB7XG4gIHZhciBsZW5ndGggPSBjaGVja2VkKGFycmF5Lmxlbmd0aCkgfCAwXG4gIHRoYXQgPSBhbGxvY2F0ZSh0aGF0LCBsZW5ndGgpXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuZ3RoOyBpICs9IDEpIHtcbiAgICB0aGF0W2ldID0gYXJyYXlbaV0gJiAyNTVcbiAgfVxuICByZXR1cm4gdGhhdFxufVxuXG4vLyBEdXBsaWNhdGUgb2YgZnJvbUFycmF5KCkgdG8ga2VlcCBmcm9tQXJyYXkoKSBtb25vbW9ycGhpYy5cbmZ1bmN0aW9uIGZyb21UeXBlZEFycmF5ICh0aGF0LCBhcnJheSkge1xuICB2YXIgbGVuZ3RoID0gY2hlY2tlZChhcnJheS5sZW5ndGgpIHwgMFxuICB0aGF0ID0gYWxsb2NhdGUodGhhdCwgbGVuZ3RoKVxuICAvLyBUcnVuY2F0aW5nIHRoZSBlbGVtZW50cyBpcyBwcm9iYWJseSBub3Qgd2hhdCBwZW9wbGUgZXhwZWN0IGZyb20gdHlwZWRcbiAgLy8gYXJyYXlzIHdpdGggQllURVNfUEVSX0VMRU1FTlQgPiAxIGJ1dCBpdCdzIGNvbXBhdGlibGUgd2l0aCB0aGUgYmVoYXZpb3JcbiAgLy8gb2YgdGhlIG9sZCBCdWZmZXIgY29uc3RydWN0b3IuXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuZ3RoOyBpICs9IDEpIHtcbiAgICB0aGF0W2ldID0gYXJyYXlbaV0gJiAyNTVcbiAgfVxuICByZXR1cm4gdGhhdFxufVxuXG5mdW5jdGlvbiBmcm9tQXJyYXlCdWZmZXIgKHRoYXQsIGFycmF5KSB7XG4gIGFycmF5LmJ5dGVMZW5ndGggLy8gdGhpcyB0aHJvd3MgaWYgYGFycmF5YCBpcyBub3QgYSB2YWxpZCBBcnJheUJ1ZmZlclxuXG4gIGlmIChCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkge1xuICAgIC8vIFJldHVybiBhbiBhdWdtZW50ZWQgYFVpbnQ4QXJyYXlgIGluc3RhbmNlLCBmb3IgYmVzdCBwZXJmb3JtYW5jZVxuICAgIHRoYXQgPSBuZXcgVWludDhBcnJheShhcnJheSlcbiAgICB0aGF0Ll9fcHJvdG9fXyA9IEJ1ZmZlci5wcm90b3R5cGVcbiAgfSBlbHNlIHtcbiAgICAvLyBGYWxsYmFjazogUmV0dXJuIGFuIG9iamVjdCBpbnN0YW5jZSBvZiB0aGUgQnVmZmVyIGNsYXNzXG4gICAgdGhhdCA9IGZyb21UeXBlZEFycmF5KHRoYXQsIG5ldyBVaW50OEFycmF5KGFycmF5KSlcbiAgfVxuICByZXR1cm4gdGhhdFxufVxuXG5mdW5jdGlvbiBmcm9tQXJyYXlMaWtlICh0aGF0LCBhcnJheSkge1xuICB2YXIgbGVuZ3RoID0gY2hlY2tlZChhcnJheS5sZW5ndGgpIHwgMFxuICB0aGF0ID0gYWxsb2NhdGUodGhhdCwgbGVuZ3RoKVxuICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbmd0aDsgaSArPSAxKSB7XG4gICAgdGhhdFtpXSA9IGFycmF5W2ldICYgMjU1XG4gIH1cbiAgcmV0dXJuIHRoYXRcbn1cblxuLy8gRGVzZXJpYWxpemUgeyB0eXBlOiAnQnVmZmVyJywgZGF0YTogWzEsMiwzLC4uLl0gfSBpbnRvIGEgQnVmZmVyIG9iamVjdC5cbi8vIFJldHVybnMgYSB6ZXJvLWxlbmd0aCBidWZmZXIgZm9yIGlucHV0cyB0aGF0IGRvbid0IGNvbmZvcm0gdG8gdGhlIHNwZWMuXG5mdW5jdGlvbiBmcm9tSnNvbk9iamVjdCAodGhhdCwgb2JqZWN0KSB7XG4gIHZhciBhcnJheVxuICB2YXIgbGVuZ3RoID0gMFxuXG4gIGlmIChvYmplY3QudHlwZSA9PT0gJ0J1ZmZlcicgJiYgaXNBcnJheShvYmplY3QuZGF0YSkpIHtcbiAgICBhcnJheSA9IG9iamVjdC5kYXRhXG4gICAgbGVuZ3RoID0gY2hlY2tlZChhcnJheS5sZW5ndGgpIHwgMFxuICB9XG4gIHRoYXQgPSBhbGxvY2F0ZSh0aGF0LCBsZW5ndGgpXG5cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7IGkgKz0gMSkge1xuICAgIHRoYXRbaV0gPSBhcnJheVtpXSAmIDI1NVxuICB9XG4gIHJldHVybiB0aGF0XG59XG5cbmlmIChCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkge1xuICBCdWZmZXIucHJvdG90eXBlLl9fcHJvdG9fXyA9IFVpbnQ4QXJyYXkucHJvdG90eXBlXG4gIEJ1ZmZlci5fX3Byb3RvX18gPSBVaW50OEFycmF5XG4gIGlmICh0eXBlb2YgU3ltYm9sICE9PSAndW5kZWZpbmVkJyAmJiBTeW1ib2wuc3BlY2llcyAmJlxuICAgICAgQnVmZmVyW1N5bWJvbC5zcGVjaWVzXSA9PT0gQnVmZmVyKSB7XG4gICAgLy8gRml4IHN1YmFycmF5KCkgaW4gRVMyMDE2LiBTZWU6IGh0dHBzOi8vZ2l0aHViLmNvbS9mZXJvc3MvYnVmZmVyL3B1bGwvOTdcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoQnVmZmVyLCBTeW1ib2wuc3BlY2llcywge1xuICAgICAgdmFsdWU6IG51bGwsXG4gICAgICBjb25maWd1cmFibGU6IHRydWVcbiAgICB9KVxuICB9XG59IGVsc2Uge1xuICAvLyBwcmUtc2V0IGZvciB2YWx1ZXMgdGhhdCBtYXkgZXhpc3QgaW4gdGhlIGZ1dHVyZVxuICBCdWZmZXIucHJvdG90eXBlLmxlbmd0aCA9IHVuZGVmaW5lZFxuICBCdWZmZXIucHJvdG90eXBlLnBhcmVudCA9IHVuZGVmaW5lZFxufVxuXG5mdW5jdGlvbiBhbGxvY2F0ZSAodGhhdCwgbGVuZ3RoKSB7XG4gIGlmIChCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkge1xuICAgIC8vIFJldHVybiBhbiBhdWdtZW50ZWQgYFVpbnQ4QXJyYXlgIGluc3RhbmNlLCBmb3IgYmVzdCBwZXJmb3JtYW5jZVxuICAgIHRoYXQgPSBuZXcgVWludDhBcnJheShsZW5ndGgpXG4gICAgdGhhdC5fX3Byb3RvX18gPSBCdWZmZXIucHJvdG90eXBlXG4gIH0gZWxzZSB7XG4gICAgLy8gRmFsbGJhY2s6IFJldHVybiBhbiBvYmplY3QgaW5zdGFuY2Ugb2YgdGhlIEJ1ZmZlciBjbGFzc1xuICAgIHRoYXQubGVuZ3RoID0gbGVuZ3RoXG4gIH1cblxuICB2YXIgZnJvbVBvb2wgPSBsZW5ndGggIT09IDAgJiYgbGVuZ3RoIDw9IEJ1ZmZlci5wb29sU2l6ZSA+Pj4gMVxuICBpZiAoZnJvbVBvb2wpIHRoYXQucGFyZW50ID0gcm9vdFBhcmVudFxuXG4gIHJldHVybiB0aGF0XG59XG5cbmZ1bmN0aW9uIGNoZWNrZWQgKGxlbmd0aCkge1xuICAvLyBOb3RlOiBjYW5ub3QgdXNlIGBsZW5ndGggPCBrTWF4TGVuZ3RoYCBoZXJlIGJlY2F1c2UgdGhhdCBmYWlscyB3aGVuXG4gIC8vIGxlbmd0aCBpcyBOYU4gKHdoaWNoIGlzIG90aGVyd2lzZSBjb2VyY2VkIHRvIHplcm8uKVxuICBpZiAobGVuZ3RoID49IGtNYXhMZW5ndGgoKSkge1xuICAgIHRocm93IG5ldyBSYW5nZUVycm9yKCdBdHRlbXB0IHRvIGFsbG9jYXRlIEJ1ZmZlciBsYXJnZXIgdGhhbiBtYXhpbXVtICcgK1xuICAgICAgICAgICAgICAgICAgICAgICAgICdzaXplOiAweCcgKyBrTWF4TGVuZ3RoKCkudG9TdHJpbmcoMTYpICsgJyBieXRlcycpXG4gIH1cbiAgcmV0dXJuIGxlbmd0aCB8IDBcbn1cblxuZnVuY3Rpb24gU2xvd0J1ZmZlciAoc3ViamVjdCwgZW5jb2RpbmcpIHtcbiAgaWYgKCEodGhpcyBpbnN0YW5jZW9mIFNsb3dCdWZmZXIpKSByZXR1cm4gbmV3IFNsb3dCdWZmZXIoc3ViamVjdCwgZW5jb2RpbmcpXG5cbiAgdmFyIGJ1ZiA9IG5ldyBCdWZmZXIoc3ViamVjdCwgZW5jb2RpbmcpXG4gIGRlbGV0ZSBidWYucGFyZW50XG4gIHJldHVybiBidWZcbn1cblxuQnVmZmVyLmlzQnVmZmVyID0gZnVuY3Rpb24gaXNCdWZmZXIgKGIpIHtcbiAgcmV0dXJuICEhKGIgIT0gbnVsbCAmJiBiLl9pc0J1ZmZlcilcbn1cblxuQnVmZmVyLmNvbXBhcmUgPSBmdW5jdGlvbiBjb21wYXJlIChhLCBiKSB7XG4gIGlmICghQnVmZmVyLmlzQnVmZmVyKGEpIHx8ICFCdWZmZXIuaXNCdWZmZXIoYikpIHtcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdBcmd1bWVudHMgbXVzdCBiZSBCdWZmZXJzJylcbiAgfVxuXG4gIGlmIChhID09PSBiKSByZXR1cm4gMFxuXG4gIHZhciB4ID0gYS5sZW5ndGhcbiAgdmFyIHkgPSBiLmxlbmd0aFxuXG4gIGZvciAodmFyIGkgPSAwLCBsZW4gPSBNYXRoLm1pbih4LCB5KTsgaSA8IGxlbjsgKytpKSB7XG4gICAgaWYgKGFbaV0gIT09IGJbaV0pIHtcbiAgICAgIHggPSBhW2ldXG4gICAgICB5ID0gYltpXVxuICAgICAgYnJlYWtcbiAgICB9XG4gIH1cblxuICBpZiAoeCA8IHkpIHJldHVybiAtMVxuICBpZiAoeSA8IHgpIHJldHVybiAxXG4gIHJldHVybiAwXG59XG5cbkJ1ZmZlci5pc0VuY29kaW5nID0gZnVuY3Rpb24gaXNFbmNvZGluZyAoZW5jb2RpbmcpIHtcbiAgc3dpdGNoIChTdHJpbmcoZW5jb2RpbmcpLnRvTG93ZXJDYXNlKCkpIHtcbiAgICBjYXNlICdoZXgnOlxuICAgIGNhc2UgJ3V0ZjgnOlxuICAgIGNhc2UgJ3V0Zi04JzpcbiAgICBjYXNlICdhc2NpaSc6XG4gICAgY2FzZSAnYmluYXJ5JzpcbiAgICBjYXNlICdiYXNlNjQnOlxuICAgIGNhc2UgJ3Jhdyc6XG4gICAgY2FzZSAndWNzMic6XG4gICAgY2FzZSAndWNzLTInOlxuICAgIGNhc2UgJ3V0ZjE2bGUnOlxuICAgIGNhc2UgJ3V0Zi0xNmxlJzpcbiAgICAgIHJldHVybiB0cnVlXG4gICAgZGVmYXVsdDpcbiAgICAgIHJldHVybiBmYWxzZVxuICB9XG59XG5cbkJ1ZmZlci5jb25jYXQgPSBmdW5jdGlvbiBjb25jYXQgKGxpc3QsIGxlbmd0aCkge1xuICBpZiAoIWlzQXJyYXkobGlzdCkpIHRocm93IG5ldyBUeXBlRXJyb3IoJ2xpc3QgYXJndW1lbnQgbXVzdCBiZSBhbiBBcnJheSBvZiBCdWZmZXJzLicpXG5cbiAgaWYgKGxpc3QubGVuZ3RoID09PSAwKSB7XG4gICAgcmV0dXJuIG5ldyBCdWZmZXIoMClcbiAgfVxuXG4gIHZhciBpXG4gIGlmIChsZW5ndGggPT09IHVuZGVmaW5lZCkge1xuICAgIGxlbmd0aCA9IDBcbiAgICBmb3IgKGkgPSAwOyBpIDwgbGlzdC5sZW5ndGg7IGkrKykge1xuICAgICAgbGVuZ3RoICs9IGxpc3RbaV0ubGVuZ3RoXG4gICAgfVxuICB9XG5cbiAgdmFyIGJ1ZiA9IG5ldyBCdWZmZXIobGVuZ3RoKVxuICB2YXIgcG9zID0gMFxuICBmb3IgKGkgPSAwOyBpIDwgbGlzdC5sZW5ndGg7IGkrKykge1xuICAgIHZhciBpdGVtID0gbGlzdFtpXVxuICAgIGl0ZW0uY29weShidWYsIHBvcylcbiAgICBwb3MgKz0gaXRlbS5sZW5ndGhcbiAgfVxuICByZXR1cm4gYnVmXG59XG5cbmZ1bmN0aW9uIGJ5dGVMZW5ndGggKHN0cmluZywgZW5jb2RpbmcpIHtcbiAgaWYgKHR5cGVvZiBzdHJpbmcgIT09ICdzdHJpbmcnKSBzdHJpbmcgPSAnJyArIHN0cmluZ1xuXG4gIHZhciBsZW4gPSBzdHJpbmcubGVuZ3RoXG4gIGlmIChsZW4gPT09IDApIHJldHVybiAwXG5cbiAgLy8gVXNlIGEgZm9yIGxvb3AgdG8gYXZvaWQgcmVjdXJzaW9uXG4gIHZhciBsb3dlcmVkQ2FzZSA9IGZhbHNlXG4gIGZvciAoOzspIHtcbiAgICBzd2l0Y2ggKGVuY29kaW5nKSB7XG4gICAgICBjYXNlICdhc2NpaSc6XG4gICAgICBjYXNlICdiaW5hcnknOlxuICAgICAgLy8gRGVwcmVjYXRlZFxuICAgICAgY2FzZSAncmF3JzpcbiAgICAgIGNhc2UgJ3Jhd3MnOlxuICAgICAgICByZXR1cm4gbGVuXG4gICAgICBjYXNlICd1dGY4JzpcbiAgICAgIGNhc2UgJ3V0Zi04JzpcbiAgICAgICAgcmV0dXJuIHV0ZjhUb0J5dGVzKHN0cmluZykubGVuZ3RoXG4gICAgICBjYXNlICd1Y3MyJzpcbiAgICAgIGNhc2UgJ3Vjcy0yJzpcbiAgICAgIGNhc2UgJ3V0ZjE2bGUnOlxuICAgICAgY2FzZSAndXRmLTE2bGUnOlxuICAgICAgICByZXR1cm4gbGVuICogMlxuICAgICAgY2FzZSAnaGV4JzpcbiAgICAgICAgcmV0dXJuIGxlbiA+Pj4gMVxuICAgICAgY2FzZSAnYmFzZTY0JzpcbiAgICAgICAgcmV0dXJuIGJhc2U2NFRvQnl0ZXMoc3RyaW5nKS5sZW5ndGhcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIGlmIChsb3dlcmVkQ2FzZSkgcmV0dXJuIHV0ZjhUb0J5dGVzKHN0cmluZykubGVuZ3RoIC8vIGFzc3VtZSB1dGY4XG4gICAgICAgIGVuY29kaW5nID0gKCcnICsgZW5jb2RpbmcpLnRvTG93ZXJDYXNlKClcbiAgICAgICAgbG93ZXJlZENhc2UgPSB0cnVlXG4gICAgfVxuICB9XG59XG5CdWZmZXIuYnl0ZUxlbmd0aCA9IGJ5dGVMZW5ndGhcblxuZnVuY3Rpb24gc2xvd1RvU3RyaW5nIChlbmNvZGluZywgc3RhcnQsIGVuZCkge1xuICB2YXIgbG93ZXJlZENhc2UgPSBmYWxzZVxuXG4gIHN0YXJ0ID0gc3RhcnQgfCAwXG4gIGVuZCA9IGVuZCA9PT0gdW5kZWZpbmVkIHx8IGVuZCA9PT0gSW5maW5pdHkgPyB0aGlzLmxlbmd0aCA6IGVuZCB8IDBcblxuICBpZiAoIWVuY29kaW5nKSBlbmNvZGluZyA9ICd1dGY4J1xuICBpZiAoc3RhcnQgPCAwKSBzdGFydCA9IDBcbiAgaWYgKGVuZCA+IHRoaXMubGVuZ3RoKSBlbmQgPSB0aGlzLmxlbmd0aFxuICBpZiAoZW5kIDw9IHN0YXJ0KSByZXR1cm4gJydcblxuICB3aGlsZSAodHJ1ZSkge1xuICAgIHN3aXRjaCAoZW5jb2RpbmcpIHtcbiAgICAgIGNhc2UgJ2hleCc6XG4gICAgICAgIHJldHVybiBoZXhTbGljZSh0aGlzLCBzdGFydCwgZW5kKVxuXG4gICAgICBjYXNlICd1dGY4JzpcbiAgICAgIGNhc2UgJ3V0Zi04JzpcbiAgICAgICAgcmV0dXJuIHV0ZjhTbGljZSh0aGlzLCBzdGFydCwgZW5kKVxuXG4gICAgICBjYXNlICdhc2NpaSc6XG4gICAgICAgIHJldHVybiBhc2NpaVNsaWNlKHRoaXMsIHN0YXJ0LCBlbmQpXG5cbiAgICAgIGNhc2UgJ2JpbmFyeSc6XG4gICAgICAgIHJldHVybiBiaW5hcnlTbGljZSh0aGlzLCBzdGFydCwgZW5kKVxuXG4gICAgICBjYXNlICdiYXNlNjQnOlxuICAgICAgICByZXR1cm4gYmFzZTY0U2xpY2UodGhpcywgc3RhcnQsIGVuZClcblxuICAgICAgY2FzZSAndWNzMic6XG4gICAgICBjYXNlICd1Y3MtMic6XG4gICAgICBjYXNlICd1dGYxNmxlJzpcbiAgICAgIGNhc2UgJ3V0Zi0xNmxlJzpcbiAgICAgICAgcmV0dXJuIHV0ZjE2bGVTbGljZSh0aGlzLCBzdGFydCwgZW5kKVxuXG4gICAgICBkZWZhdWx0OlxuICAgICAgICBpZiAobG93ZXJlZENhc2UpIHRocm93IG5ldyBUeXBlRXJyb3IoJ1Vua25vd24gZW5jb2Rpbmc6ICcgKyBlbmNvZGluZylcbiAgICAgICAgZW5jb2RpbmcgPSAoZW5jb2RpbmcgKyAnJykudG9Mb3dlckNhc2UoKVxuICAgICAgICBsb3dlcmVkQ2FzZSA9IHRydWVcbiAgICB9XG4gIH1cbn1cblxuLy8gVGhlIHByb3BlcnR5IGlzIHVzZWQgYnkgYEJ1ZmZlci5pc0J1ZmZlcmAgYW5kIGBpcy1idWZmZXJgIChpbiBTYWZhcmkgNS03KSB0byBkZXRlY3Rcbi8vIEJ1ZmZlciBpbnN0YW5jZXMuXG5CdWZmZXIucHJvdG90eXBlLl9pc0J1ZmZlciA9IHRydWVcblxuQnVmZmVyLnByb3RvdHlwZS50b1N0cmluZyA9IGZ1bmN0aW9uIHRvU3RyaW5nICgpIHtcbiAgdmFyIGxlbmd0aCA9IHRoaXMubGVuZ3RoIHwgMFxuICBpZiAobGVuZ3RoID09PSAwKSByZXR1cm4gJydcbiAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDApIHJldHVybiB1dGY4U2xpY2UodGhpcywgMCwgbGVuZ3RoKVxuICByZXR1cm4gc2xvd1RvU3RyaW5nLmFwcGx5KHRoaXMsIGFyZ3VtZW50cylcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5lcXVhbHMgPSBmdW5jdGlvbiBlcXVhbHMgKGIpIHtcbiAgaWYgKCFCdWZmZXIuaXNCdWZmZXIoYikpIHRocm93IG5ldyBUeXBlRXJyb3IoJ0FyZ3VtZW50IG11c3QgYmUgYSBCdWZmZXInKVxuICBpZiAodGhpcyA9PT0gYikgcmV0dXJuIHRydWVcbiAgcmV0dXJuIEJ1ZmZlci5jb21wYXJlKHRoaXMsIGIpID09PSAwXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUuaW5zcGVjdCA9IGZ1bmN0aW9uIGluc3BlY3QgKCkge1xuICB2YXIgc3RyID0gJydcbiAgdmFyIG1heCA9IGV4cG9ydHMuSU5TUEVDVF9NQVhfQllURVNcbiAgaWYgKHRoaXMubGVuZ3RoID4gMCkge1xuICAgIHN0ciA9IHRoaXMudG9TdHJpbmcoJ2hleCcsIDAsIG1heCkubWF0Y2goLy57Mn0vZykuam9pbignICcpXG4gICAgaWYgKHRoaXMubGVuZ3RoID4gbWF4KSBzdHIgKz0gJyAuLi4gJ1xuICB9XG4gIHJldHVybiAnPEJ1ZmZlciAnICsgc3RyICsgJz4nXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUuY29tcGFyZSA9IGZ1bmN0aW9uIGNvbXBhcmUgKGIpIHtcbiAgaWYgKCFCdWZmZXIuaXNCdWZmZXIoYikpIHRocm93IG5ldyBUeXBlRXJyb3IoJ0FyZ3VtZW50IG11c3QgYmUgYSBCdWZmZXInKVxuICByZXR1cm4gQnVmZmVyLmNvbXBhcmUodGhpcywgYilcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5pbmRleE9mID0gZnVuY3Rpb24gaW5kZXhPZiAodmFsLCBieXRlT2Zmc2V0KSB7XG4gIGlmIChieXRlT2Zmc2V0ID4gMHg3ZmZmZmZmZikgYnl0ZU9mZnNldCA9IDB4N2ZmZmZmZmZcbiAgZWxzZSBpZiAoYnl0ZU9mZnNldCA8IC0weDgwMDAwMDAwKSBieXRlT2Zmc2V0ID0gLTB4ODAwMDAwMDBcbiAgYnl0ZU9mZnNldCA+Pj0gMFxuXG4gIGlmICh0aGlzLmxlbmd0aCA9PT0gMCkgcmV0dXJuIC0xXG4gIGlmIChieXRlT2Zmc2V0ID49IHRoaXMubGVuZ3RoKSByZXR1cm4gLTFcblxuICAvLyBOZWdhdGl2ZSBvZmZzZXRzIHN0YXJ0IGZyb20gdGhlIGVuZCBvZiB0aGUgYnVmZmVyXG4gIGlmIChieXRlT2Zmc2V0IDwgMCkgYnl0ZU9mZnNldCA9IE1hdGgubWF4KHRoaXMubGVuZ3RoICsgYnl0ZU9mZnNldCwgMClcblxuICBpZiAodHlwZW9mIHZhbCA9PT0gJ3N0cmluZycpIHtcbiAgICBpZiAodmFsLmxlbmd0aCA9PT0gMCkgcmV0dXJuIC0xIC8vIHNwZWNpYWwgY2FzZTogbG9va2luZyBmb3IgZW1wdHkgc3RyaW5nIGFsd2F5cyBmYWlsc1xuICAgIHJldHVybiBTdHJpbmcucHJvdG90eXBlLmluZGV4T2YuY2FsbCh0aGlzLCB2YWwsIGJ5dGVPZmZzZXQpXG4gIH1cbiAgaWYgKEJ1ZmZlci5pc0J1ZmZlcih2YWwpKSB7XG4gICAgcmV0dXJuIGFycmF5SW5kZXhPZih0aGlzLCB2YWwsIGJ5dGVPZmZzZXQpXG4gIH1cbiAgaWYgKHR5cGVvZiB2YWwgPT09ICdudW1iZXInKSB7XG4gICAgaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUICYmIFVpbnQ4QXJyYXkucHJvdG90eXBlLmluZGV4T2YgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgIHJldHVybiBVaW50OEFycmF5LnByb3RvdHlwZS5pbmRleE9mLmNhbGwodGhpcywgdmFsLCBieXRlT2Zmc2V0KVxuICAgIH1cbiAgICByZXR1cm4gYXJyYXlJbmRleE9mKHRoaXMsIFsgdmFsIF0sIGJ5dGVPZmZzZXQpXG4gIH1cblxuICBmdW5jdGlvbiBhcnJheUluZGV4T2YgKGFyciwgdmFsLCBieXRlT2Zmc2V0KSB7XG4gICAgdmFyIGZvdW5kSW5kZXggPSAtMVxuICAgIGZvciAodmFyIGkgPSAwOyBieXRlT2Zmc2V0ICsgaSA8IGFyci5sZW5ndGg7IGkrKykge1xuICAgICAgaWYgKGFycltieXRlT2Zmc2V0ICsgaV0gPT09IHZhbFtmb3VuZEluZGV4ID09PSAtMSA/IDAgOiBpIC0gZm91bmRJbmRleF0pIHtcbiAgICAgICAgaWYgKGZvdW5kSW5kZXggPT09IC0xKSBmb3VuZEluZGV4ID0gaVxuICAgICAgICBpZiAoaSAtIGZvdW5kSW5kZXggKyAxID09PSB2YWwubGVuZ3RoKSByZXR1cm4gYnl0ZU9mZnNldCArIGZvdW5kSW5kZXhcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGZvdW5kSW5kZXggPSAtMVxuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gLTFcbiAgfVxuXG4gIHRocm93IG5ldyBUeXBlRXJyb3IoJ3ZhbCBtdXN0IGJlIHN0cmluZywgbnVtYmVyIG9yIEJ1ZmZlcicpXG59XG5cbmZ1bmN0aW9uIGhleFdyaXRlIChidWYsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpIHtcbiAgb2Zmc2V0ID0gTnVtYmVyKG9mZnNldCkgfHwgMFxuICB2YXIgcmVtYWluaW5nID0gYnVmLmxlbmd0aCAtIG9mZnNldFxuICBpZiAoIWxlbmd0aCkge1xuICAgIGxlbmd0aCA9IHJlbWFpbmluZ1xuICB9IGVsc2Uge1xuICAgIGxlbmd0aCA9IE51bWJlcihsZW5ndGgpXG4gICAgaWYgKGxlbmd0aCA+IHJlbWFpbmluZykge1xuICAgICAgbGVuZ3RoID0gcmVtYWluaW5nXG4gICAgfVxuICB9XG5cbiAgLy8gbXVzdCBiZSBhbiBldmVuIG51bWJlciBvZiBkaWdpdHNcbiAgdmFyIHN0ckxlbiA9IHN0cmluZy5sZW5ndGhcbiAgaWYgKHN0ckxlbiAlIDIgIT09IDApIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBoZXggc3RyaW5nJylcblxuICBpZiAobGVuZ3RoID4gc3RyTGVuIC8gMikge1xuICAgIGxlbmd0aCA9IHN0ckxlbiAvIDJcbiAgfVxuICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgdmFyIHBhcnNlZCA9IHBhcnNlSW50KHN0cmluZy5zdWJzdHIoaSAqIDIsIDIpLCAxNilcbiAgICBpZiAoaXNOYU4ocGFyc2VkKSkgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIGhleCBzdHJpbmcnKVxuICAgIGJ1ZltvZmZzZXQgKyBpXSA9IHBhcnNlZFxuICB9XG4gIHJldHVybiBpXG59XG5cbmZ1bmN0aW9uIHV0ZjhXcml0ZSAoYnVmLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKSB7XG4gIHJldHVybiBibGl0QnVmZmVyKHV0ZjhUb0J5dGVzKHN0cmluZywgYnVmLmxlbmd0aCAtIG9mZnNldCksIGJ1Ziwgb2Zmc2V0LCBsZW5ndGgpXG59XG5cbmZ1bmN0aW9uIGFzY2lpV3JpdGUgKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCkge1xuICByZXR1cm4gYmxpdEJ1ZmZlcihhc2NpaVRvQnl0ZXMoc3RyaW5nKSwgYnVmLCBvZmZzZXQsIGxlbmd0aClcbn1cblxuZnVuY3Rpb24gYmluYXJ5V3JpdGUgKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCkge1xuICByZXR1cm4gYXNjaWlXcml0ZShidWYsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpXG59XG5cbmZ1bmN0aW9uIGJhc2U2NFdyaXRlIChidWYsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpIHtcbiAgcmV0dXJuIGJsaXRCdWZmZXIoYmFzZTY0VG9CeXRlcyhzdHJpbmcpLCBidWYsIG9mZnNldCwgbGVuZ3RoKVxufVxuXG5mdW5jdGlvbiB1Y3MyV3JpdGUgKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCkge1xuICByZXR1cm4gYmxpdEJ1ZmZlcih1dGYxNmxlVG9CeXRlcyhzdHJpbmcsIGJ1Zi5sZW5ndGggLSBvZmZzZXQpLCBidWYsIG9mZnNldCwgbGVuZ3RoKVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlID0gZnVuY3Rpb24gd3JpdGUgKHN0cmluZywgb2Zmc2V0LCBsZW5ndGgsIGVuY29kaW5nKSB7XG4gIC8vIEJ1ZmZlciN3cml0ZShzdHJpbmcpXG4gIGlmIChvZmZzZXQgPT09IHVuZGVmaW5lZCkge1xuICAgIGVuY29kaW5nID0gJ3V0ZjgnXG4gICAgbGVuZ3RoID0gdGhpcy5sZW5ndGhcbiAgICBvZmZzZXQgPSAwXG4gIC8vIEJ1ZmZlciN3cml0ZShzdHJpbmcsIGVuY29kaW5nKVxuICB9IGVsc2UgaWYgKGxlbmd0aCA9PT0gdW5kZWZpbmVkICYmIHR5cGVvZiBvZmZzZXQgPT09ICdzdHJpbmcnKSB7XG4gICAgZW5jb2RpbmcgPSBvZmZzZXRcbiAgICBsZW5ndGggPSB0aGlzLmxlbmd0aFxuICAgIG9mZnNldCA9IDBcbiAgLy8gQnVmZmVyI3dyaXRlKHN0cmluZywgb2Zmc2V0WywgbGVuZ3RoXVssIGVuY29kaW5nXSlcbiAgfSBlbHNlIGlmIChpc0Zpbml0ZShvZmZzZXQpKSB7XG4gICAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICAgIGlmIChpc0Zpbml0ZShsZW5ndGgpKSB7XG4gICAgICBsZW5ndGggPSBsZW5ndGggfCAwXG4gICAgICBpZiAoZW5jb2RpbmcgPT09IHVuZGVmaW5lZCkgZW5jb2RpbmcgPSAndXRmOCdcbiAgICB9IGVsc2Uge1xuICAgICAgZW5jb2RpbmcgPSBsZW5ndGhcbiAgICAgIGxlbmd0aCA9IHVuZGVmaW5lZFxuICAgIH1cbiAgLy8gbGVnYWN5IHdyaXRlKHN0cmluZywgZW5jb2RpbmcsIG9mZnNldCwgbGVuZ3RoKSAtIHJlbW92ZSBpbiB2MC4xM1xuICB9IGVsc2Uge1xuICAgIHZhciBzd2FwID0gZW5jb2RpbmdcbiAgICBlbmNvZGluZyA9IG9mZnNldFxuICAgIG9mZnNldCA9IGxlbmd0aCB8IDBcbiAgICBsZW5ndGggPSBzd2FwXG4gIH1cblxuICB2YXIgcmVtYWluaW5nID0gdGhpcy5sZW5ndGggLSBvZmZzZXRcbiAgaWYgKGxlbmd0aCA9PT0gdW5kZWZpbmVkIHx8IGxlbmd0aCA+IHJlbWFpbmluZykgbGVuZ3RoID0gcmVtYWluaW5nXG5cbiAgaWYgKChzdHJpbmcubGVuZ3RoID4gMCAmJiAobGVuZ3RoIDwgMCB8fCBvZmZzZXQgPCAwKSkgfHwgb2Zmc2V0ID4gdGhpcy5sZW5ndGgpIHtcbiAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcignYXR0ZW1wdCB0byB3cml0ZSBvdXRzaWRlIGJ1ZmZlciBib3VuZHMnKVxuICB9XG5cbiAgaWYgKCFlbmNvZGluZykgZW5jb2RpbmcgPSAndXRmOCdcblxuICB2YXIgbG93ZXJlZENhc2UgPSBmYWxzZVxuICBmb3IgKDs7KSB7XG4gICAgc3dpdGNoIChlbmNvZGluZykge1xuICAgICAgY2FzZSAnaGV4JzpcbiAgICAgICAgcmV0dXJuIGhleFdyaXRlKHRoaXMsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpXG5cbiAgICAgIGNhc2UgJ3V0ZjgnOlxuICAgICAgY2FzZSAndXRmLTgnOlxuICAgICAgICByZXR1cm4gdXRmOFdyaXRlKHRoaXMsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpXG5cbiAgICAgIGNhc2UgJ2FzY2lpJzpcbiAgICAgICAgcmV0dXJuIGFzY2lpV3JpdGUodGhpcywgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aClcblxuICAgICAgY2FzZSAnYmluYXJ5JzpcbiAgICAgICAgcmV0dXJuIGJpbmFyeVdyaXRlKHRoaXMsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpXG5cbiAgICAgIGNhc2UgJ2Jhc2U2NCc6XG4gICAgICAgIC8vIFdhcm5pbmc6IG1heExlbmd0aCBub3QgdGFrZW4gaW50byBhY2NvdW50IGluIGJhc2U2NFdyaXRlXG4gICAgICAgIHJldHVybiBiYXNlNjRXcml0ZSh0aGlzLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxuXG4gICAgICBjYXNlICd1Y3MyJzpcbiAgICAgIGNhc2UgJ3Vjcy0yJzpcbiAgICAgIGNhc2UgJ3V0ZjE2bGUnOlxuICAgICAgY2FzZSAndXRmLTE2bGUnOlxuICAgICAgICByZXR1cm4gdWNzMldyaXRlKHRoaXMsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpXG5cbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIGlmIChsb3dlcmVkQ2FzZSkgdGhyb3cgbmV3IFR5cGVFcnJvcignVW5rbm93biBlbmNvZGluZzogJyArIGVuY29kaW5nKVxuICAgICAgICBlbmNvZGluZyA9ICgnJyArIGVuY29kaW5nKS50b0xvd2VyQ2FzZSgpXG4gICAgICAgIGxvd2VyZWRDYXNlID0gdHJ1ZVxuICAgIH1cbiAgfVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnRvSlNPTiA9IGZ1bmN0aW9uIHRvSlNPTiAoKSB7XG4gIHJldHVybiB7XG4gICAgdHlwZTogJ0J1ZmZlcicsXG4gICAgZGF0YTogQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwodGhpcy5fYXJyIHx8IHRoaXMsIDApXG4gIH1cbn1cblxuZnVuY3Rpb24gYmFzZTY0U2xpY2UgKGJ1Ziwgc3RhcnQsIGVuZCkge1xuICBpZiAoc3RhcnQgPT09IDAgJiYgZW5kID09PSBidWYubGVuZ3RoKSB7XG4gICAgcmV0dXJuIGJhc2U2NC5mcm9tQnl0ZUFycmF5KGJ1ZilcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gYmFzZTY0LmZyb21CeXRlQXJyYXkoYnVmLnNsaWNlKHN0YXJ0LCBlbmQpKVxuICB9XG59XG5cbmZ1bmN0aW9uIHV0ZjhTbGljZSAoYnVmLCBzdGFydCwgZW5kKSB7XG4gIGVuZCA9IE1hdGgubWluKGJ1Zi5sZW5ndGgsIGVuZClcbiAgdmFyIHJlcyA9IFtdXG5cbiAgdmFyIGkgPSBzdGFydFxuICB3aGlsZSAoaSA8IGVuZCkge1xuICAgIHZhciBmaXJzdEJ5dGUgPSBidWZbaV1cbiAgICB2YXIgY29kZVBvaW50ID0gbnVsbFxuICAgIHZhciBieXRlc1BlclNlcXVlbmNlID0gKGZpcnN0Qnl0ZSA+IDB4RUYpID8gNFxuICAgICAgOiAoZmlyc3RCeXRlID4gMHhERikgPyAzXG4gICAgICA6IChmaXJzdEJ5dGUgPiAweEJGKSA/IDJcbiAgICAgIDogMVxuXG4gICAgaWYgKGkgKyBieXRlc1BlclNlcXVlbmNlIDw9IGVuZCkge1xuICAgICAgdmFyIHNlY29uZEJ5dGUsIHRoaXJkQnl0ZSwgZm91cnRoQnl0ZSwgdGVtcENvZGVQb2ludFxuXG4gICAgICBzd2l0Y2ggKGJ5dGVzUGVyU2VxdWVuY2UpIHtcbiAgICAgICAgY2FzZSAxOlxuICAgICAgICAgIGlmIChmaXJzdEJ5dGUgPCAweDgwKSB7XG4gICAgICAgICAgICBjb2RlUG9pbnQgPSBmaXJzdEJ5dGVcbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWtcbiAgICAgICAgY2FzZSAyOlxuICAgICAgICAgIHNlY29uZEJ5dGUgPSBidWZbaSArIDFdXG4gICAgICAgICAgaWYgKChzZWNvbmRCeXRlICYgMHhDMCkgPT09IDB4ODApIHtcbiAgICAgICAgICAgIHRlbXBDb2RlUG9pbnQgPSAoZmlyc3RCeXRlICYgMHgxRikgPDwgMHg2IHwgKHNlY29uZEJ5dGUgJiAweDNGKVxuICAgICAgICAgICAgaWYgKHRlbXBDb2RlUG9pbnQgPiAweDdGKSB7XG4gICAgICAgICAgICAgIGNvZGVQb2ludCA9IHRlbXBDb2RlUG9pbnRcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWtcbiAgICAgICAgY2FzZSAzOlxuICAgICAgICAgIHNlY29uZEJ5dGUgPSBidWZbaSArIDFdXG4gICAgICAgICAgdGhpcmRCeXRlID0gYnVmW2kgKyAyXVxuICAgICAgICAgIGlmICgoc2Vjb25kQnl0ZSAmIDB4QzApID09PSAweDgwICYmICh0aGlyZEJ5dGUgJiAweEMwKSA9PT0gMHg4MCkge1xuICAgICAgICAgICAgdGVtcENvZGVQb2ludCA9IChmaXJzdEJ5dGUgJiAweEYpIDw8IDB4QyB8IChzZWNvbmRCeXRlICYgMHgzRikgPDwgMHg2IHwgKHRoaXJkQnl0ZSAmIDB4M0YpXG4gICAgICAgICAgICBpZiAodGVtcENvZGVQb2ludCA+IDB4N0ZGICYmICh0ZW1wQ29kZVBvaW50IDwgMHhEODAwIHx8IHRlbXBDb2RlUG9pbnQgPiAweERGRkYpKSB7XG4gICAgICAgICAgICAgIGNvZGVQb2ludCA9IHRlbXBDb2RlUG9pbnRcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWtcbiAgICAgICAgY2FzZSA0OlxuICAgICAgICAgIHNlY29uZEJ5dGUgPSBidWZbaSArIDFdXG4gICAgICAgICAgdGhpcmRCeXRlID0gYnVmW2kgKyAyXVxuICAgICAgICAgIGZvdXJ0aEJ5dGUgPSBidWZbaSArIDNdXG4gICAgICAgICAgaWYgKChzZWNvbmRCeXRlICYgMHhDMCkgPT09IDB4ODAgJiYgKHRoaXJkQnl0ZSAmIDB4QzApID09PSAweDgwICYmIChmb3VydGhCeXRlICYgMHhDMCkgPT09IDB4ODApIHtcbiAgICAgICAgICAgIHRlbXBDb2RlUG9pbnQgPSAoZmlyc3RCeXRlICYgMHhGKSA8PCAweDEyIHwgKHNlY29uZEJ5dGUgJiAweDNGKSA8PCAweEMgfCAodGhpcmRCeXRlICYgMHgzRikgPDwgMHg2IHwgKGZvdXJ0aEJ5dGUgJiAweDNGKVxuICAgICAgICAgICAgaWYgKHRlbXBDb2RlUG9pbnQgPiAweEZGRkYgJiYgdGVtcENvZGVQb2ludCA8IDB4MTEwMDAwKSB7XG4gICAgICAgICAgICAgIGNvZGVQb2ludCA9IHRlbXBDb2RlUG9pbnRcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKGNvZGVQb2ludCA9PT0gbnVsbCkge1xuICAgICAgLy8gd2UgZGlkIG5vdCBnZW5lcmF0ZSBhIHZhbGlkIGNvZGVQb2ludCBzbyBpbnNlcnQgYVxuICAgICAgLy8gcmVwbGFjZW1lbnQgY2hhciAoVStGRkZEKSBhbmQgYWR2YW5jZSBvbmx5IDEgYnl0ZVxuICAgICAgY29kZVBvaW50ID0gMHhGRkZEXG4gICAgICBieXRlc1BlclNlcXVlbmNlID0gMVxuICAgIH0gZWxzZSBpZiAoY29kZVBvaW50ID4gMHhGRkZGKSB7XG4gICAgICAvLyBlbmNvZGUgdG8gdXRmMTYgKHN1cnJvZ2F0ZSBwYWlyIGRhbmNlKVxuICAgICAgY29kZVBvaW50IC09IDB4MTAwMDBcbiAgICAgIHJlcy5wdXNoKGNvZGVQb2ludCA+Pj4gMTAgJiAweDNGRiB8IDB4RDgwMClcbiAgICAgIGNvZGVQb2ludCA9IDB4REMwMCB8IGNvZGVQb2ludCAmIDB4M0ZGXG4gICAgfVxuXG4gICAgcmVzLnB1c2goY29kZVBvaW50KVxuICAgIGkgKz0gYnl0ZXNQZXJTZXF1ZW5jZVxuICB9XG5cbiAgcmV0dXJuIGRlY29kZUNvZGVQb2ludHNBcnJheShyZXMpXG59XG5cbi8vIEJhc2VkIG9uIGh0dHA6Ly9zdGFja292ZXJmbG93LmNvbS9hLzIyNzQ3MjcyLzY4MDc0MiwgdGhlIGJyb3dzZXIgd2l0aFxuLy8gdGhlIGxvd2VzdCBsaW1pdCBpcyBDaHJvbWUsIHdpdGggMHgxMDAwMCBhcmdzLlxuLy8gV2UgZ28gMSBtYWduaXR1ZGUgbGVzcywgZm9yIHNhZmV0eVxudmFyIE1BWF9BUkdVTUVOVFNfTEVOR1RIID0gMHgxMDAwXG5cbmZ1bmN0aW9uIGRlY29kZUNvZGVQb2ludHNBcnJheSAoY29kZVBvaW50cykge1xuICB2YXIgbGVuID0gY29kZVBvaW50cy5sZW5ndGhcbiAgaWYgKGxlbiA8PSBNQVhfQVJHVU1FTlRTX0xFTkdUSCkge1xuICAgIHJldHVybiBTdHJpbmcuZnJvbUNoYXJDb2RlLmFwcGx5KFN0cmluZywgY29kZVBvaW50cykgLy8gYXZvaWQgZXh0cmEgc2xpY2UoKVxuICB9XG5cbiAgLy8gRGVjb2RlIGluIGNodW5rcyB0byBhdm9pZCBcImNhbGwgc3RhY2sgc2l6ZSBleGNlZWRlZFwiLlxuICB2YXIgcmVzID0gJydcbiAgdmFyIGkgPSAwXG4gIHdoaWxlIChpIDwgbGVuKSB7XG4gICAgcmVzICs9IFN0cmluZy5mcm9tQ2hhckNvZGUuYXBwbHkoXG4gICAgICBTdHJpbmcsXG4gICAgICBjb2RlUG9pbnRzLnNsaWNlKGksIGkgKz0gTUFYX0FSR1VNRU5UU19MRU5HVEgpXG4gICAgKVxuICB9XG4gIHJldHVybiByZXNcbn1cblxuZnVuY3Rpb24gYXNjaWlTbGljZSAoYnVmLCBzdGFydCwgZW5kKSB7XG4gIHZhciByZXQgPSAnJ1xuICBlbmQgPSBNYXRoLm1pbihidWYubGVuZ3RoLCBlbmQpXG5cbiAgZm9yICh2YXIgaSA9IHN0YXJ0OyBpIDwgZW5kOyBpKyspIHtcbiAgICByZXQgKz0gU3RyaW5nLmZyb21DaGFyQ29kZShidWZbaV0gJiAweDdGKVxuICB9XG4gIHJldHVybiByZXRcbn1cblxuZnVuY3Rpb24gYmluYXJ5U2xpY2UgKGJ1Ziwgc3RhcnQsIGVuZCkge1xuICB2YXIgcmV0ID0gJydcbiAgZW5kID0gTWF0aC5taW4oYnVmLmxlbmd0aCwgZW5kKVxuXG4gIGZvciAodmFyIGkgPSBzdGFydDsgaSA8IGVuZDsgaSsrKSB7XG4gICAgcmV0ICs9IFN0cmluZy5mcm9tQ2hhckNvZGUoYnVmW2ldKVxuICB9XG4gIHJldHVybiByZXRcbn1cblxuZnVuY3Rpb24gaGV4U2xpY2UgKGJ1Ziwgc3RhcnQsIGVuZCkge1xuICB2YXIgbGVuID0gYnVmLmxlbmd0aFxuXG4gIGlmICghc3RhcnQgfHwgc3RhcnQgPCAwKSBzdGFydCA9IDBcbiAgaWYgKCFlbmQgfHwgZW5kIDwgMCB8fCBlbmQgPiBsZW4pIGVuZCA9IGxlblxuXG4gIHZhciBvdXQgPSAnJ1xuICBmb3IgKHZhciBpID0gc3RhcnQ7IGkgPCBlbmQ7IGkrKykge1xuICAgIG91dCArPSB0b0hleChidWZbaV0pXG4gIH1cbiAgcmV0dXJuIG91dFxufVxuXG5mdW5jdGlvbiB1dGYxNmxlU2xpY2UgKGJ1Ziwgc3RhcnQsIGVuZCkge1xuICB2YXIgYnl0ZXMgPSBidWYuc2xpY2Uoc3RhcnQsIGVuZClcbiAgdmFyIHJlcyA9ICcnXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgYnl0ZXMubGVuZ3RoOyBpICs9IDIpIHtcbiAgICByZXMgKz0gU3RyaW5nLmZyb21DaGFyQ29kZShieXRlc1tpXSArIGJ5dGVzW2kgKyAxXSAqIDI1NilcbiAgfVxuICByZXR1cm4gcmVzXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUuc2xpY2UgPSBmdW5jdGlvbiBzbGljZSAoc3RhcnQsIGVuZCkge1xuICB2YXIgbGVuID0gdGhpcy5sZW5ndGhcbiAgc3RhcnQgPSB+fnN0YXJ0XG4gIGVuZCA9IGVuZCA9PT0gdW5kZWZpbmVkID8gbGVuIDogfn5lbmRcblxuICBpZiAoc3RhcnQgPCAwKSB7XG4gICAgc3RhcnQgKz0gbGVuXG4gICAgaWYgKHN0YXJ0IDwgMCkgc3RhcnQgPSAwXG4gIH0gZWxzZSBpZiAoc3RhcnQgPiBsZW4pIHtcbiAgICBzdGFydCA9IGxlblxuICB9XG5cbiAgaWYgKGVuZCA8IDApIHtcbiAgICBlbmQgKz0gbGVuXG4gICAgaWYgKGVuZCA8IDApIGVuZCA9IDBcbiAgfSBlbHNlIGlmIChlbmQgPiBsZW4pIHtcbiAgICBlbmQgPSBsZW5cbiAgfVxuXG4gIGlmIChlbmQgPCBzdGFydCkgZW5kID0gc3RhcnRcblxuICB2YXIgbmV3QnVmXG4gIGlmIChCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkge1xuICAgIG5ld0J1ZiA9IHRoaXMuc3ViYXJyYXkoc3RhcnQsIGVuZClcbiAgICBuZXdCdWYuX19wcm90b19fID0gQnVmZmVyLnByb3RvdHlwZVxuICB9IGVsc2Uge1xuICAgIHZhciBzbGljZUxlbiA9IGVuZCAtIHN0YXJ0XG4gICAgbmV3QnVmID0gbmV3IEJ1ZmZlcihzbGljZUxlbiwgdW5kZWZpbmVkKVxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgc2xpY2VMZW47IGkrKykge1xuICAgICAgbmV3QnVmW2ldID0gdGhpc1tpICsgc3RhcnRdXG4gICAgfVxuICB9XG5cbiAgaWYgKG5ld0J1Zi5sZW5ndGgpIG5ld0J1Zi5wYXJlbnQgPSB0aGlzLnBhcmVudCB8fCB0aGlzXG5cbiAgcmV0dXJuIG5ld0J1ZlxufVxuXG4vKlxuICogTmVlZCB0byBtYWtlIHN1cmUgdGhhdCBidWZmZXIgaXNuJ3QgdHJ5aW5nIHRvIHdyaXRlIG91dCBvZiBib3VuZHMuXG4gKi9cbmZ1bmN0aW9uIGNoZWNrT2Zmc2V0IChvZmZzZXQsIGV4dCwgbGVuZ3RoKSB7XG4gIGlmICgob2Zmc2V0ICUgMSkgIT09IDAgfHwgb2Zmc2V0IDwgMCkgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ29mZnNldCBpcyBub3QgdWludCcpXG4gIGlmIChvZmZzZXQgKyBleHQgPiBsZW5ndGgpIHRocm93IG5ldyBSYW5nZUVycm9yKCdUcnlpbmcgdG8gYWNjZXNzIGJleW9uZCBidWZmZXIgbGVuZ3RoJylcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkVUludExFID0gZnVuY3Rpb24gcmVhZFVJbnRMRSAob2Zmc2V0LCBieXRlTGVuZ3RoLCBub0Fzc2VydCkge1xuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGJ5dGVMZW5ndGggPSBieXRlTGVuZ3RoIHwgMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIGJ5dGVMZW5ndGgsIHRoaXMubGVuZ3RoKVxuXG4gIHZhciB2YWwgPSB0aGlzW29mZnNldF1cbiAgdmFyIG11bCA9IDFcbiAgdmFyIGkgPSAwXG4gIHdoaWxlICgrK2kgPCBieXRlTGVuZ3RoICYmIChtdWwgKj0gMHgxMDApKSB7XG4gICAgdmFsICs9IHRoaXNbb2Zmc2V0ICsgaV0gKiBtdWxcbiAgfVxuXG4gIHJldHVybiB2YWxcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkVUludEJFID0gZnVuY3Rpb24gcmVhZFVJbnRCRSAob2Zmc2V0LCBieXRlTGVuZ3RoLCBub0Fzc2VydCkge1xuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGJ5dGVMZW5ndGggPSBieXRlTGVuZ3RoIHwgMFxuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgY2hlY2tPZmZzZXQob2Zmc2V0LCBieXRlTGVuZ3RoLCB0aGlzLmxlbmd0aClcbiAgfVxuXG4gIHZhciB2YWwgPSB0aGlzW29mZnNldCArIC0tYnl0ZUxlbmd0aF1cbiAgdmFyIG11bCA9IDFcbiAgd2hpbGUgKGJ5dGVMZW5ndGggPiAwICYmIChtdWwgKj0gMHgxMDApKSB7XG4gICAgdmFsICs9IHRoaXNbb2Zmc2V0ICsgLS1ieXRlTGVuZ3RoXSAqIG11bFxuICB9XG5cbiAgcmV0dXJuIHZhbFxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRVSW50OCA9IGZ1bmN0aW9uIHJlYWRVSW50OCAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDEsIHRoaXMubGVuZ3RoKVxuICByZXR1cm4gdGhpc1tvZmZzZXRdXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZFVJbnQxNkxFID0gZnVuY3Rpb24gcmVhZFVJbnQxNkxFIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgMiwgdGhpcy5sZW5ndGgpXG4gIHJldHVybiB0aGlzW29mZnNldF0gfCAodGhpc1tvZmZzZXQgKyAxXSA8PCA4KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRVSW50MTZCRSA9IGZ1bmN0aW9uIHJlYWRVSW50MTZCRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDIsIHRoaXMubGVuZ3RoKVxuICByZXR1cm4gKHRoaXNbb2Zmc2V0XSA8PCA4KSB8IHRoaXNbb2Zmc2V0ICsgMV1cbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkVUludDMyTEUgPSBmdW5jdGlvbiByZWFkVUludDMyTEUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCA0LCB0aGlzLmxlbmd0aClcblxuICByZXR1cm4gKCh0aGlzW29mZnNldF0pIHxcbiAgICAgICh0aGlzW29mZnNldCArIDFdIDw8IDgpIHxcbiAgICAgICh0aGlzW29mZnNldCArIDJdIDw8IDE2KSkgK1xuICAgICAgKHRoaXNbb2Zmc2V0ICsgM10gKiAweDEwMDAwMDApXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZFVJbnQzMkJFID0gZnVuY3Rpb24gcmVhZFVJbnQzMkJFIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgNCwgdGhpcy5sZW5ndGgpXG5cbiAgcmV0dXJuICh0aGlzW29mZnNldF0gKiAweDEwMDAwMDApICtcbiAgICAoKHRoaXNbb2Zmc2V0ICsgMV0gPDwgMTYpIHxcbiAgICAodGhpc1tvZmZzZXQgKyAyXSA8PCA4KSB8XG4gICAgdGhpc1tvZmZzZXQgKyAzXSlcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkSW50TEUgPSBmdW5jdGlvbiByZWFkSW50TEUgKG9mZnNldCwgYnl0ZUxlbmd0aCwgbm9Bc3NlcnQpIHtcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBieXRlTGVuZ3RoID0gYnl0ZUxlbmd0aCB8IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCBieXRlTGVuZ3RoLCB0aGlzLmxlbmd0aClcblxuICB2YXIgdmFsID0gdGhpc1tvZmZzZXRdXG4gIHZhciBtdWwgPSAxXG4gIHZhciBpID0gMFxuICB3aGlsZSAoKytpIDwgYnl0ZUxlbmd0aCAmJiAobXVsICo9IDB4MTAwKSkge1xuICAgIHZhbCArPSB0aGlzW29mZnNldCArIGldICogbXVsXG4gIH1cbiAgbXVsICo9IDB4ODBcblxuICBpZiAodmFsID49IG11bCkgdmFsIC09IE1hdGgucG93KDIsIDggKiBieXRlTGVuZ3RoKVxuXG4gIHJldHVybiB2YWxcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkSW50QkUgPSBmdW5jdGlvbiByZWFkSW50QkUgKG9mZnNldCwgYnl0ZUxlbmd0aCwgbm9Bc3NlcnQpIHtcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBieXRlTGVuZ3RoID0gYnl0ZUxlbmd0aCB8IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCBieXRlTGVuZ3RoLCB0aGlzLmxlbmd0aClcblxuICB2YXIgaSA9IGJ5dGVMZW5ndGhcbiAgdmFyIG11bCA9IDFcbiAgdmFyIHZhbCA9IHRoaXNbb2Zmc2V0ICsgLS1pXVxuICB3aGlsZSAoaSA+IDAgJiYgKG11bCAqPSAweDEwMCkpIHtcbiAgICB2YWwgKz0gdGhpc1tvZmZzZXQgKyAtLWldICogbXVsXG4gIH1cbiAgbXVsICo9IDB4ODBcblxuICBpZiAodmFsID49IG11bCkgdmFsIC09IE1hdGgucG93KDIsIDggKiBieXRlTGVuZ3RoKVxuXG4gIHJldHVybiB2YWxcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkSW50OCA9IGZ1bmN0aW9uIHJlYWRJbnQ4IChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgMSwgdGhpcy5sZW5ndGgpXG4gIGlmICghKHRoaXNbb2Zmc2V0XSAmIDB4ODApKSByZXR1cm4gKHRoaXNbb2Zmc2V0XSlcbiAgcmV0dXJuICgoMHhmZiAtIHRoaXNbb2Zmc2V0XSArIDEpICogLTEpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEludDE2TEUgPSBmdW5jdGlvbiByZWFkSW50MTZMRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDIsIHRoaXMubGVuZ3RoKVxuICB2YXIgdmFsID0gdGhpc1tvZmZzZXRdIHwgKHRoaXNbb2Zmc2V0ICsgMV0gPDwgOClcbiAgcmV0dXJuICh2YWwgJiAweDgwMDApID8gdmFsIHwgMHhGRkZGMDAwMCA6IHZhbFxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRJbnQxNkJFID0gZnVuY3Rpb24gcmVhZEludDE2QkUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCAyLCB0aGlzLmxlbmd0aClcbiAgdmFyIHZhbCA9IHRoaXNbb2Zmc2V0ICsgMV0gfCAodGhpc1tvZmZzZXRdIDw8IDgpXG4gIHJldHVybiAodmFsICYgMHg4MDAwKSA/IHZhbCB8IDB4RkZGRjAwMDAgOiB2YWxcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkSW50MzJMRSA9IGZ1bmN0aW9uIHJlYWRJbnQzMkxFIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgNCwgdGhpcy5sZW5ndGgpXG5cbiAgcmV0dXJuICh0aGlzW29mZnNldF0pIHxcbiAgICAodGhpc1tvZmZzZXQgKyAxXSA8PCA4KSB8XG4gICAgKHRoaXNbb2Zmc2V0ICsgMl0gPDwgMTYpIHxcbiAgICAodGhpc1tvZmZzZXQgKyAzXSA8PCAyNClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkSW50MzJCRSA9IGZ1bmN0aW9uIHJlYWRJbnQzMkJFIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgNCwgdGhpcy5sZW5ndGgpXG5cbiAgcmV0dXJuICh0aGlzW29mZnNldF0gPDwgMjQpIHxcbiAgICAodGhpc1tvZmZzZXQgKyAxXSA8PCAxNikgfFxuICAgICh0aGlzW29mZnNldCArIDJdIDw8IDgpIHxcbiAgICAodGhpc1tvZmZzZXQgKyAzXSlcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkRmxvYXRMRSA9IGZ1bmN0aW9uIHJlYWRGbG9hdExFIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgNCwgdGhpcy5sZW5ndGgpXG4gIHJldHVybiBpZWVlNzU0LnJlYWQodGhpcywgb2Zmc2V0LCB0cnVlLCAyMywgNClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkRmxvYXRCRSA9IGZ1bmN0aW9uIHJlYWRGbG9hdEJFIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgNCwgdGhpcy5sZW5ndGgpXG4gIHJldHVybiBpZWVlNzU0LnJlYWQodGhpcywgb2Zmc2V0LCBmYWxzZSwgMjMsIDQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZERvdWJsZUxFID0gZnVuY3Rpb24gcmVhZERvdWJsZUxFIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgOCwgdGhpcy5sZW5ndGgpXG4gIHJldHVybiBpZWVlNzU0LnJlYWQodGhpcywgb2Zmc2V0LCB0cnVlLCA1MiwgOClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkRG91YmxlQkUgPSBmdW5jdGlvbiByZWFkRG91YmxlQkUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCA4LCB0aGlzLmxlbmd0aClcbiAgcmV0dXJuIGllZWU3NTQucmVhZCh0aGlzLCBvZmZzZXQsIGZhbHNlLCA1MiwgOClcbn1cblxuZnVuY3Rpb24gY2hlY2tJbnQgKGJ1ZiwgdmFsdWUsIG9mZnNldCwgZXh0LCBtYXgsIG1pbikge1xuICBpZiAoIUJ1ZmZlci5pc0J1ZmZlcihidWYpKSB0aHJvdyBuZXcgVHlwZUVycm9yKCdidWZmZXIgbXVzdCBiZSBhIEJ1ZmZlciBpbnN0YW5jZScpXG4gIGlmICh2YWx1ZSA+IG1heCB8fCB2YWx1ZSA8IG1pbikgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ3ZhbHVlIGlzIG91dCBvZiBib3VuZHMnKVxuICBpZiAob2Zmc2V0ICsgZXh0ID4gYnVmLmxlbmd0aCkgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ2luZGV4IG91dCBvZiByYW5nZScpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVVSW50TEUgPSBmdW5jdGlvbiB3cml0ZVVJbnRMRSAodmFsdWUsIG9mZnNldCwgYnl0ZUxlbmd0aCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBieXRlTGVuZ3RoID0gYnl0ZUxlbmd0aCB8IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgYnl0ZUxlbmd0aCwgTWF0aC5wb3coMiwgOCAqIGJ5dGVMZW5ndGgpLCAwKVxuXG4gIHZhciBtdWwgPSAxXG4gIHZhciBpID0gMFxuICB0aGlzW29mZnNldF0gPSB2YWx1ZSAmIDB4RkZcbiAgd2hpbGUgKCsraSA8IGJ5dGVMZW5ndGggJiYgKG11bCAqPSAweDEwMCkpIHtcbiAgICB0aGlzW29mZnNldCArIGldID0gKHZhbHVlIC8gbXVsKSAmIDB4RkZcbiAgfVxuXG4gIHJldHVybiBvZmZzZXQgKyBieXRlTGVuZ3RoXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVVSW50QkUgPSBmdW5jdGlvbiB3cml0ZVVJbnRCRSAodmFsdWUsIG9mZnNldCwgYnl0ZUxlbmd0aCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBieXRlTGVuZ3RoID0gYnl0ZUxlbmd0aCB8IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgYnl0ZUxlbmd0aCwgTWF0aC5wb3coMiwgOCAqIGJ5dGVMZW5ndGgpLCAwKVxuXG4gIHZhciBpID0gYnl0ZUxlbmd0aCAtIDFcbiAgdmFyIG11bCA9IDFcbiAgdGhpc1tvZmZzZXQgKyBpXSA9IHZhbHVlICYgMHhGRlxuICB3aGlsZSAoLS1pID49IDAgJiYgKG11bCAqPSAweDEwMCkpIHtcbiAgICB0aGlzW29mZnNldCArIGldID0gKHZhbHVlIC8gbXVsKSAmIDB4RkZcbiAgfVxuXG4gIHJldHVybiBvZmZzZXQgKyBieXRlTGVuZ3RoXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVVSW50OCA9IGZ1bmN0aW9uIHdyaXRlVUludDggKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgMSwgMHhmZiwgMClcbiAgaWYgKCFCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkgdmFsdWUgPSBNYXRoLmZsb29yKHZhbHVlKVxuICB0aGlzW29mZnNldF0gPSAodmFsdWUgJiAweGZmKVxuICByZXR1cm4gb2Zmc2V0ICsgMVxufVxuXG5mdW5jdGlvbiBvYmplY3RXcml0ZVVJbnQxNiAoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4pIHtcbiAgaWYgKHZhbHVlIDwgMCkgdmFsdWUgPSAweGZmZmYgKyB2YWx1ZSArIDFcbiAgZm9yICh2YXIgaSA9IDAsIGogPSBNYXRoLm1pbihidWYubGVuZ3RoIC0gb2Zmc2V0LCAyKTsgaSA8IGo7IGkrKykge1xuICAgIGJ1ZltvZmZzZXQgKyBpXSA9ICh2YWx1ZSAmICgweGZmIDw8ICg4ICogKGxpdHRsZUVuZGlhbiA/IGkgOiAxIC0gaSkpKSkgPj4+XG4gICAgICAobGl0dGxlRW5kaWFuID8gaSA6IDEgLSBpKSAqIDhcbiAgfVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlVUludDE2TEUgPSBmdW5jdGlvbiB3cml0ZVVJbnQxNkxFICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIDIsIDB4ZmZmZiwgMClcbiAgaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgdGhpc1tvZmZzZXRdID0gKHZhbHVlICYgMHhmZilcbiAgICB0aGlzW29mZnNldCArIDFdID0gKHZhbHVlID4+PiA4KVxuICB9IGVsc2Uge1xuICAgIG9iamVjdFdyaXRlVUludDE2KHRoaXMsIHZhbHVlLCBvZmZzZXQsIHRydWUpXG4gIH1cbiAgcmV0dXJuIG9mZnNldCArIDJcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZVVJbnQxNkJFID0gZnVuY3Rpb24gd3JpdGVVSW50MTZCRSAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCAyLCAweGZmZmYsIDApXG4gIGlmIChCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkge1xuICAgIHRoaXNbb2Zmc2V0XSA9ICh2YWx1ZSA+Pj4gOClcbiAgICB0aGlzW29mZnNldCArIDFdID0gKHZhbHVlICYgMHhmZilcbiAgfSBlbHNlIHtcbiAgICBvYmplY3RXcml0ZVVJbnQxNih0aGlzLCB2YWx1ZSwgb2Zmc2V0LCBmYWxzZSlcbiAgfVxuICByZXR1cm4gb2Zmc2V0ICsgMlxufVxuXG5mdW5jdGlvbiBvYmplY3RXcml0ZVVJbnQzMiAoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4pIHtcbiAgaWYgKHZhbHVlIDwgMCkgdmFsdWUgPSAweGZmZmZmZmZmICsgdmFsdWUgKyAxXG4gIGZvciAodmFyIGkgPSAwLCBqID0gTWF0aC5taW4oYnVmLmxlbmd0aCAtIG9mZnNldCwgNCk7IGkgPCBqOyBpKyspIHtcbiAgICBidWZbb2Zmc2V0ICsgaV0gPSAodmFsdWUgPj4+IChsaXR0bGVFbmRpYW4gPyBpIDogMyAtIGkpICogOCkgJiAweGZmXG4gIH1cbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZVVJbnQzMkxFID0gZnVuY3Rpb24gd3JpdGVVSW50MzJMRSAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCA0LCAweGZmZmZmZmZmLCAwKVxuICBpZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICB0aGlzW29mZnNldCArIDNdID0gKHZhbHVlID4+PiAyNClcbiAgICB0aGlzW29mZnNldCArIDJdID0gKHZhbHVlID4+PiAxNilcbiAgICB0aGlzW29mZnNldCArIDFdID0gKHZhbHVlID4+PiA4KVxuICAgIHRoaXNbb2Zmc2V0XSA9ICh2YWx1ZSAmIDB4ZmYpXG4gIH0gZWxzZSB7XG4gICAgb2JqZWN0V3JpdGVVSW50MzIodGhpcywgdmFsdWUsIG9mZnNldCwgdHJ1ZSlcbiAgfVxuICByZXR1cm4gb2Zmc2V0ICsgNFxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlVUludDMyQkUgPSBmdW5jdGlvbiB3cml0ZVVJbnQzMkJFICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIDQsIDB4ZmZmZmZmZmYsIDApXG4gIGlmIChCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkge1xuICAgIHRoaXNbb2Zmc2V0XSA9ICh2YWx1ZSA+Pj4gMjQpXG4gICAgdGhpc1tvZmZzZXQgKyAxXSA9ICh2YWx1ZSA+Pj4gMTYpXG4gICAgdGhpc1tvZmZzZXQgKyAyXSA9ICh2YWx1ZSA+Pj4gOClcbiAgICB0aGlzW29mZnNldCArIDNdID0gKHZhbHVlICYgMHhmZilcbiAgfSBlbHNlIHtcbiAgICBvYmplY3RXcml0ZVVJbnQzMih0aGlzLCB2YWx1ZSwgb2Zmc2V0LCBmYWxzZSlcbiAgfVxuICByZXR1cm4gb2Zmc2V0ICsgNFxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlSW50TEUgPSBmdW5jdGlvbiB3cml0ZUludExFICh2YWx1ZSwgb2Zmc2V0LCBieXRlTGVuZ3RoLCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICB2YXIgbGltaXQgPSBNYXRoLnBvdygyLCA4ICogYnl0ZUxlbmd0aCAtIDEpXG5cbiAgICBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCBieXRlTGVuZ3RoLCBsaW1pdCAtIDEsIC1saW1pdClcbiAgfVxuXG4gIHZhciBpID0gMFxuICB2YXIgbXVsID0gMVxuICB2YXIgc3ViID0gdmFsdWUgPCAwID8gMSA6IDBcbiAgdGhpc1tvZmZzZXRdID0gdmFsdWUgJiAweEZGXG4gIHdoaWxlICgrK2kgPCBieXRlTGVuZ3RoICYmIChtdWwgKj0gMHgxMDApKSB7XG4gICAgdGhpc1tvZmZzZXQgKyBpXSA9ICgodmFsdWUgLyBtdWwpID4+IDApIC0gc3ViICYgMHhGRlxuICB9XG5cbiAgcmV0dXJuIG9mZnNldCArIGJ5dGVMZW5ndGhcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUludEJFID0gZnVuY3Rpb24gd3JpdGVJbnRCRSAodmFsdWUsIG9mZnNldCwgYnl0ZUxlbmd0aCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgdmFyIGxpbWl0ID0gTWF0aC5wb3coMiwgOCAqIGJ5dGVMZW5ndGggLSAxKVxuXG4gICAgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgYnl0ZUxlbmd0aCwgbGltaXQgLSAxLCAtbGltaXQpXG4gIH1cblxuICB2YXIgaSA9IGJ5dGVMZW5ndGggLSAxXG4gIHZhciBtdWwgPSAxXG4gIHZhciBzdWIgPSB2YWx1ZSA8IDAgPyAxIDogMFxuICB0aGlzW29mZnNldCArIGldID0gdmFsdWUgJiAweEZGXG4gIHdoaWxlICgtLWkgPj0gMCAmJiAobXVsICo9IDB4MTAwKSkge1xuICAgIHRoaXNbb2Zmc2V0ICsgaV0gPSAoKHZhbHVlIC8gbXVsKSA+PiAwKSAtIHN1YiAmIDB4RkZcbiAgfVxuXG4gIHJldHVybiBvZmZzZXQgKyBieXRlTGVuZ3RoXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVJbnQ4ID0gZnVuY3Rpb24gd3JpdGVJbnQ4ICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIDEsIDB4N2YsIC0weDgwKVxuICBpZiAoIUJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB2YWx1ZSA9IE1hdGguZmxvb3IodmFsdWUpXG4gIGlmICh2YWx1ZSA8IDApIHZhbHVlID0gMHhmZiArIHZhbHVlICsgMVxuICB0aGlzW29mZnNldF0gPSAodmFsdWUgJiAweGZmKVxuICByZXR1cm4gb2Zmc2V0ICsgMVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlSW50MTZMRSA9IGZ1bmN0aW9uIHdyaXRlSW50MTZMRSAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCAyLCAweDdmZmYsIC0weDgwMDApXG4gIGlmIChCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkge1xuICAgIHRoaXNbb2Zmc2V0XSA9ICh2YWx1ZSAmIDB4ZmYpXG4gICAgdGhpc1tvZmZzZXQgKyAxXSA9ICh2YWx1ZSA+Pj4gOClcbiAgfSBlbHNlIHtcbiAgICBvYmplY3RXcml0ZVVJbnQxNih0aGlzLCB2YWx1ZSwgb2Zmc2V0LCB0cnVlKVxuICB9XG4gIHJldHVybiBvZmZzZXQgKyAyXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVJbnQxNkJFID0gZnVuY3Rpb24gd3JpdGVJbnQxNkJFICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIDIsIDB4N2ZmZiwgLTB4ODAwMClcbiAgaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgdGhpc1tvZmZzZXRdID0gKHZhbHVlID4+PiA4KVxuICAgIHRoaXNbb2Zmc2V0ICsgMV0gPSAodmFsdWUgJiAweGZmKVxuICB9IGVsc2Uge1xuICAgIG9iamVjdFdyaXRlVUludDE2KHRoaXMsIHZhbHVlLCBvZmZzZXQsIGZhbHNlKVxuICB9XG4gIHJldHVybiBvZmZzZXQgKyAyXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVJbnQzMkxFID0gZnVuY3Rpb24gd3JpdGVJbnQzMkxFICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIDQsIDB4N2ZmZmZmZmYsIC0weDgwMDAwMDAwKVxuICBpZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICB0aGlzW29mZnNldF0gPSAodmFsdWUgJiAweGZmKVxuICAgIHRoaXNbb2Zmc2V0ICsgMV0gPSAodmFsdWUgPj4+IDgpXG4gICAgdGhpc1tvZmZzZXQgKyAyXSA9ICh2YWx1ZSA+Pj4gMTYpXG4gICAgdGhpc1tvZmZzZXQgKyAzXSA9ICh2YWx1ZSA+Pj4gMjQpXG4gIH0gZWxzZSB7XG4gICAgb2JqZWN0V3JpdGVVSW50MzIodGhpcywgdmFsdWUsIG9mZnNldCwgdHJ1ZSlcbiAgfVxuICByZXR1cm4gb2Zmc2V0ICsgNFxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlSW50MzJCRSA9IGZ1bmN0aW9uIHdyaXRlSW50MzJCRSAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCA0LCAweDdmZmZmZmZmLCAtMHg4MDAwMDAwMClcbiAgaWYgKHZhbHVlIDwgMCkgdmFsdWUgPSAweGZmZmZmZmZmICsgdmFsdWUgKyAxXG4gIGlmIChCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkge1xuICAgIHRoaXNbb2Zmc2V0XSA9ICh2YWx1ZSA+Pj4gMjQpXG4gICAgdGhpc1tvZmZzZXQgKyAxXSA9ICh2YWx1ZSA+Pj4gMTYpXG4gICAgdGhpc1tvZmZzZXQgKyAyXSA9ICh2YWx1ZSA+Pj4gOClcbiAgICB0aGlzW29mZnNldCArIDNdID0gKHZhbHVlICYgMHhmZilcbiAgfSBlbHNlIHtcbiAgICBvYmplY3RXcml0ZVVJbnQzMih0aGlzLCB2YWx1ZSwgb2Zmc2V0LCBmYWxzZSlcbiAgfVxuICByZXR1cm4gb2Zmc2V0ICsgNFxufVxuXG5mdW5jdGlvbiBjaGVja0lFRUU3NTQgKGJ1ZiwgdmFsdWUsIG9mZnNldCwgZXh0LCBtYXgsIG1pbikge1xuICBpZiAob2Zmc2V0ICsgZXh0ID4gYnVmLmxlbmd0aCkgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ2luZGV4IG91dCBvZiByYW5nZScpXG4gIGlmIChvZmZzZXQgPCAwKSB0aHJvdyBuZXcgUmFuZ2VFcnJvcignaW5kZXggb3V0IG9mIHJhbmdlJylcbn1cblxuZnVuY3Rpb24gd3JpdGVGbG9hdCAoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICBjaGVja0lFRUU3NTQoYnVmLCB2YWx1ZSwgb2Zmc2V0LCA0LCAzLjQwMjgyMzQ2NjM4NTI4ODZlKzM4LCAtMy40MDI4MjM0NjYzODUyODg2ZSszOClcbiAgfVxuICBpZWVlNzU0LndyaXRlKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCAyMywgNClcbiAgcmV0dXJuIG9mZnNldCArIDRcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUZsb2F0TEUgPSBmdW5jdGlvbiB3cml0ZUZsb2F0TEUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiB3cml0ZUZsb2F0KHRoaXMsIHZhbHVlLCBvZmZzZXQsIHRydWUsIG5vQXNzZXJ0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlRmxvYXRCRSA9IGZ1bmN0aW9uIHdyaXRlRmxvYXRCRSAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgcmV0dXJuIHdyaXRlRmxvYXQodGhpcywgdmFsdWUsIG9mZnNldCwgZmFsc2UsIG5vQXNzZXJ0KVxufVxuXG5mdW5jdGlvbiB3cml0ZURvdWJsZSAoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICBjaGVja0lFRUU3NTQoYnVmLCB2YWx1ZSwgb2Zmc2V0LCA4LCAxLjc5NzY5MzEzNDg2MjMxNTdFKzMwOCwgLTEuNzk3NjkzMTM0ODYyMzE1N0UrMzA4KVxuICB9XG4gIGllZWU3NTQud3JpdGUoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIDUyLCA4KVxuICByZXR1cm4gb2Zmc2V0ICsgOFxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlRG91YmxlTEUgPSBmdW5jdGlvbiB3cml0ZURvdWJsZUxFICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gd3JpdGVEb3VibGUodGhpcywgdmFsdWUsIG9mZnNldCwgdHJ1ZSwgbm9Bc3NlcnQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVEb3VibGVCRSA9IGZ1bmN0aW9uIHdyaXRlRG91YmxlQkUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiB3cml0ZURvdWJsZSh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCBmYWxzZSwgbm9Bc3NlcnQpXG59XG5cbi8vIGNvcHkodGFyZ2V0QnVmZmVyLCB0YXJnZXRTdGFydD0wLCBzb3VyY2VTdGFydD0wLCBzb3VyY2VFbmQ9YnVmZmVyLmxlbmd0aClcbkJ1ZmZlci5wcm90b3R5cGUuY29weSA9IGZ1bmN0aW9uIGNvcHkgKHRhcmdldCwgdGFyZ2V0U3RhcnQsIHN0YXJ0LCBlbmQpIHtcbiAgaWYgKCFzdGFydCkgc3RhcnQgPSAwXG4gIGlmICghZW5kICYmIGVuZCAhPT0gMCkgZW5kID0gdGhpcy5sZW5ndGhcbiAgaWYgKHRhcmdldFN0YXJ0ID49IHRhcmdldC5sZW5ndGgpIHRhcmdldFN0YXJ0ID0gdGFyZ2V0Lmxlbmd0aFxuICBpZiAoIXRhcmdldFN0YXJ0KSB0YXJnZXRTdGFydCA9IDBcbiAgaWYgKGVuZCA+IDAgJiYgZW5kIDwgc3RhcnQpIGVuZCA9IHN0YXJ0XG5cbiAgLy8gQ29weSAwIGJ5dGVzOyB3ZSdyZSBkb25lXG4gIGlmIChlbmQgPT09IHN0YXJ0KSByZXR1cm4gMFxuICBpZiAodGFyZ2V0Lmxlbmd0aCA9PT0gMCB8fCB0aGlzLmxlbmd0aCA9PT0gMCkgcmV0dXJuIDBcblxuICAvLyBGYXRhbCBlcnJvciBjb25kaXRpb25zXG4gIGlmICh0YXJnZXRTdGFydCA8IDApIHtcbiAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcigndGFyZ2V0U3RhcnQgb3V0IG9mIGJvdW5kcycpXG4gIH1cbiAgaWYgKHN0YXJ0IDwgMCB8fCBzdGFydCA+PSB0aGlzLmxlbmd0aCkgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ3NvdXJjZVN0YXJ0IG91dCBvZiBib3VuZHMnKVxuICBpZiAoZW5kIDwgMCkgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ3NvdXJjZUVuZCBvdXQgb2YgYm91bmRzJylcblxuICAvLyBBcmUgd2Ugb29iP1xuICBpZiAoZW5kID4gdGhpcy5sZW5ndGgpIGVuZCA9IHRoaXMubGVuZ3RoXG4gIGlmICh0YXJnZXQubGVuZ3RoIC0gdGFyZ2V0U3RhcnQgPCBlbmQgLSBzdGFydCkge1xuICAgIGVuZCA9IHRhcmdldC5sZW5ndGggLSB0YXJnZXRTdGFydCArIHN0YXJ0XG4gIH1cblxuICB2YXIgbGVuID0gZW5kIC0gc3RhcnRcbiAgdmFyIGlcblxuICBpZiAodGhpcyA9PT0gdGFyZ2V0ICYmIHN0YXJ0IDwgdGFyZ2V0U3RhcnQgJiYgdGFyZ2V0U3RhcnQgPCBlbmQpIHtcbiAgICAvLyBkZXNjZW5kaW5nIGNvcHkgZnJvbSBlbmRcbiAgICBmb3IgKGkgPSBsZW4gLSAxOyBpID49IDA7IGktLSkge1xuICAgICAgdGFyZ2V0W2kgKyB0YXJnZXRTdGFydF0gPSB0aGlzW2kgKyBzdGFydF1cbiAgICB9XG4gIH0gZWxzZSBpZiAobGVuIDwgMTAwMCB8fCAhQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICAvLyBhc2NlbmRpbmcgY29weSBmcm9tIHN0YXJ0XG4gICAgZm9yIChpID0gMDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICB0YXJnZXRbaSArIHRhcmdldFN0YXJ0XSA9IHRoaXNbaSArIHN0YXJ0XVxuICAgIH1cbiAgfSBlbHNlIHtcbiAgICBVaW50OEFycmF5LnByb3RvdHlwZS5zZXQuY2FsbChcbiAgICAgIHRhcmdldCxcbiAgICAgIHRoaXMuc3ViYXJyYXkoc3RhcnQsIHN0YXJ0ICsgbGVuKSxcbiAgICAgIHRhcmdldFN0YXJ0XG4gICAgKVxuICB9XG5cbiAgcmV0dXJuIGxlblxufVxuXG4vLyBmaWxsKHZhbHVlLCBzdGFydD0wLCBlbmQ9YnVmZmVyLmxlbmd0aClcbkJ1ZmZlci5wcm90b3R5cGUuZmlsbCA9IGZ1bmN0aW9uIGZpbGwgKHZhbHVlLCBzdGFydCwgZW5kKSB7XG4gIGlmICghdmFsdWUpIHZhbHVlID0gMFxuICBpZiAoIXN0YXJ0KSBzdGFydCA9IDBcbiAgaWYgKCFlbmQpIGVuZCA9IHRoaXMubGVuZ3RoXG5cbiAgaWYgKGVuZCA8IHN0YXJ0KSB0aHJvdyBuZXcgUmFuZ2VFcnJvcignZW5kIDwgc3RhcnQnKVxuXG4gIC8vIEZpbGwgMCBieXRlczsgd2UncmUgZG9uZVxuICBpZiAoZW5kID09PSBzdGFydCkgcmV0dXJuXG4gIGlmICh0aGlzLmxlbmd0aCA9PT0gMCkgcmV0dXJuXG5cbiAgaWYgKHN0YXJ0IDwgMCB8fCBzdGFydCA+PSB0aGlzLmxlbmd0aCkgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ3N0YXJ0IG91dCBvZiBib3VuZHMnKVxuICBpZiAoZW5kIDwgMCB8fCBlbmQgPiB0aGlzLmxlbmd0aCkgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ2VuZCBvdXQgb2YgYm91bmRzJylcblxuICB2YXIgaVxuICBpZiAodHlwZW9mIHZhbHVlID09PSAnbnVtYmVyJykge1xuICAgIGZvciAoaSA9IHN0YXJ0OyBpIDwgZW5kOyBpKyspIHtcbiAgICAgIHRoaXNbaV0gPSB2YWx1ZVxuICAgIH1cbiAgfSBlbHNlIHtcbiAgICB2YXIgYnl0ZXMgPSB1dGY4VG9CeXRlcyh2YWx1ZS50b1N0cmluZygpKVxuICAgIHZhciBsZW4gPSBieXRlcy5sZW5ndGhcbiAgICBmb3IgKGkgPSBzdGFydDsgaSA8IGVuZDsgaSsrKSB7XG4gICAgICB0aGlzW2ldID0gYnl0ZXNbaSAlIGxlbl1cbiAgICB9XG4gIH1cblxuICByZXR1cm4gdGhpc1xufVxuXG4vLyBIRUxQRVIgRlVOQ1RJT05TXG4vLyA9PT09PT09PT09PT09PT09XG5cbnZhciBJTlZBTElEX0JBU0U2NF9SRSA9IC9bXitcXC8wLTlBLVphLXotX10vZ1xuXG5mdW5jdGlvbiBiYXNlNjRjbGVhbiAoc3RyKSB7XG4gIC8vIE5vZGUgc3RyaXBzIG91dCBpbnZhbGlkIGNoYXJhY3RlcnMgbGlrZSBcXG4gYW5kIFxcdCBmcm9tIHRoZSBzdHJpbmcsIGJhc2U2NC1qcyBkb2VzIG5vdFxuICBzdHIgPSBzdHJpbmd0cmltKHN0cikucmVwbGFjZShJTlZBTElEX0JBU0U2NF9SRSwgJycpXG4gIC8vIE5vZGUgY29udmVydHMgc3RyaW5ncyB3aXRoIGxlbmd0aCA8IDIgdG8gJydcbiAgaWYgKHN0ci5sZW5ndGggPCAyKSByZXR1cm4gJydcbiAgLy8gTm9kZSBhbGxvd3MgZm9yIG5vbi1wYWRkZWQgYmFzZTY0IHN0cmluZ3MgKG1pc3NpbmcgdHJhaWxpbmcgPT09KSwgYmFzZTY0LWpzIGRvZXMgbm90XG4gIHdoaWxlIChzdHIubGVuZ3RoICUgNCAhPT0gMCkge1xuICAgIHN0ciA9IHN0ciArICc9J1xuICB9XG4gIHJldHVybiBzdHJcbn1cblxuZnVuY3Rpb24gc3RyaW5ndHJpbSAoc3RyKSB7XG4gIGlmIChzdHIudHJpbSkgcmV0dXJuIHN0ci50cmltKClcbiAgcmV0dXJuIHN0ci5yZXBsYWNlKC9eXFxzK3xcXHMrJC9nLCAnJylcbn1cblxuZnVuY3Rpb24gdG9IZXggKG4pIHtcbiAgaWYgKG4gPCAxNikgcmV0dXJuICcwJyArIG4udG9TdHJpbmcoMTYpXG4gIHJldHVybiBuLnRvU3RyaW5nKDE2KVxufVxuXG5mdW5jdGlvbiB1dGY4VG9CeXRlcyAoc3RyaW5nLCB1bml0cykge1xuICB1bml0cyA9IHVuaXRzIHx8IEluZmluaXR5XG4gIHZhciBjb2RlUG9pbnRcbiAgdmFyIGxlbmd0aCA9IHN0cmluZy5sZW5ndGhcbiAgdmFyIGxlYWRTdXJyb2dhdGUgPSBudWxsXG4gIHZhciBieXRlcyA9IFtdXG5cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgIGNvZGVQb2ludCA9IHN0cmluZy5jaGFyQ29kZUF0KGkpXG5cbiAgICAvLyBpcyBzdXJyb2dhdGUgY29tcG9uZW50XG4gICAgaWYgKGNvZGVQb2ludCA+IDB4RDdGRiAmJiBjb2RlUG9pbnQgPCAweEUwMDApIHtcbiAgICAgIC8vIGxhc3QgY2hhciB3YXMgYSBsZWFkXG4gICAgICBpZiAoIWxlYWRTdXJyb2dhdGUpIHtcbiAgICAgICAgLy8gbm8gbGVhZCB5ZXRcbiAgICAgICAgaWYgKGNvZGVQb2ludCA+IDB4REJGRikge1xuICAgICAgICAgIC8vIHVuZXhwZWN0ZWQgdHJhaWxcbiAgICAgICAgICBpZiAoKHVuaXRzIC09IDMpID4gLTEpIGJ5dGVzLnB1c2goMHhFRiwgMHhCRiwgMHhCRClcbiAgICAgICAgICBjb250aW51ZVxuICAgICAgICB9IGVsc2UgaWYgKGkgKyAxID09PSBsZW5ndGgpIHtcbiAgICAgICAgICAvLyB1bnBhaXJlZCBsZWFkXG4gICAgICAgICAgaWYgKCh1bml0cyAtPSAzKSA+IC0xKSBieXRlcy5wdXNoKDB4RUYsIDB4QkYsIDB4QkQpXG4gICAgICAgICAgY29udGludWVcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHZhbGlkIGxlYWRcbiAgICAgICAgbGVhZFN1cnJvZ2F0ZSA9IGNvZGVQb2ludFxuXG4gICAgICAgIGNvbnRpbnVlXG4gICAgICB9XG5cbiAgICAgIC8vIDIgbGVhZHMgaW4gYSByb3dcbiAgICAgIGlmIChjb2RlUG9pbnQgPCAweERDMDApIHtcbiAgICAgICAgaWYgKCh1bml0cyAtPSAzKSA+IC0xKSBieXRlcy5wdXNoKDB4RUYsIDB4QkYsIDB4QkQpXG4gICAgICAgIGxlYWRTdXJyb2dhdGUgPSBjb2RlUG9pbnRcbiAgICAgICAgY29udGludWVcbiAgICAgIH1cblxuICAgICAgLy8gdmFsaWQgc3Vycm9nYXRlIHBhaXJcbiAgICAgIGNvZGVQb2ludCA9IChsZWFkU3Vycm9nYXRlIC0gMHhEODAwIDw8IDEwIHwgY29kZVBvaW50IC0gMHhEQzAwKSArIDB4MTAwMDBcbiAgICB9IGVsc2UgaWYgKGxlYWRTdXJyb2dhdGUpIHtcbiAgICAgIC8vIHZhbGlkIGJtcCBjaGFyLCBidXQgbGFzdCBjaGFyIHdhcyBhIGxlYWRcbiAgICAgIGlmICgodW5pdHMgLT0gMykgPiAtMSkgYnl0ZXMucHVzaCgweEVGLCAweEJGLCAweEJEKVxuICAgIH1cblxuICAgIGxlYWRTdXJyb2dhdGUgPSBudWxsXG5cbiAgICAvLyBlbmNvZGUgdXRmOFxuICAgIGlmIChjb2RlUG9pbnQgPCAweDgwKSB7XG4gICAgICBpZiAoKHVuaXRzIC09IDEpIDwgMCkgYnJlYWtcbiAgICAgIGJ5dGVzLnB1c2goY29kZVBvaW50KVxuICAgIH0gZWxzZSBpZiAoY29kZVBvaW50IDwgMHg4MDApIHtcbiAgICAgIGlmICgodW5pdHMgLT0gMikgPCAwKSBicmVha1xuICAgICAgYnl0ZXMucHVzaChcbiAgICAgICAgY29kZVBvaW50ID4+IDB4NiB8IDB4QzAsXG4gICAgICAgIGNvZGVQb2ludCAmIDB4M0YgfCAweDgwXG4gICAgICApXG4gICAgfSBlbHNlIGlmIChjb2RlUG9pbnQgPCAweDEwMDAwKSB7XG4gICAgICBpZiAoKHVuaXRzIC09IDMpIDwgMCkgYnJlYWtcbiAgICAgIGJ5dGVzLnB1c2goXG4gICAgICAgIGNvZGVQb2ludCA+PiAweEMgfCAweEUwLFxuICAgICAgICBjb2RlUG9pbnQgPj4gMHg2ICYgMHgzRiB8IDB4ODAsXG4gICAgICAgIGNvZGVQb2ludCAmIDB4M0YgfCAweDgwXG4gICAgICApXG4gICAgfSBlbHNlIGlmIChjb2RlUG9pbnQgPCAweDExMDAwMCkge1xuICAgICAgaWYgKCh1bml0cyAtPSA0KSA8IDApIGJyZWFrXG4gICAgICBieXRlcy5wdXNoKFxuICAgICAgICBjb2RlUG9pbnQgPj4gMHgxMiB8IDB4RjAsXG4gICAgICAgIGNvZGVQb2ludCA+PiAweEMgJiAweDNGIHwgMHg4MCxcbiAgICAgICAgY29kZVBvaW50ID4+IDB4NiAmIDB4M0YgfCAweDgwLFxuICAgICAgICBjb2RlUG9pbnQgJiAweDNGIHwgMHg4MFxuICAgICAgKVxuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgY29kZSBwb2ludCcpXG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGJ5dGVzXG59XG5cbmZ1bmN0aW9uIGFzY2lpVG9CeXRlcyAoc3RyKSB7XG4gIHZhciBieXRlQXJyYXkgPSBbXVxuICBmb3IgKHZhciBpID0gMDsgaSA8IHN0ci5sZW5ndGg7IGkrKykge1xuICAgIC8vIE5vZGUncyBjb2RlIHNlZW1zIHRvIGJlIGRvaW5nIHRoaXMgYW5kIG5vdCAmIDB4N0YuLlxuICAgIGJ5dGVBcnJheS5wdXNoKHN0ci5jaGFyQ29kZUF0KGkpICYgMHhGRilcbiAgfVxuICByZXR1cm4gYnl0ZUFycmF5XG59XG5cbmZ1bmN0aW9uIHV0ZjE2bGVUb0J5dGVzIChzdHIsIHVuaXRzKSB7XG4gIHZhciBjLCBoaSwgbG9cbiAgdmFyIGJ5dGVBcnJheSA9IFtdXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgc3RyLmxlbmd0aDsgaSsrKSB7XG4gICAgaWYgKCh1bml0cyAtPSAyKSA8IDApIGJyZWFrXG5cbiAgICBjID0gc3RyLmNoYXJDb2RlQXQoaSlcbiAgICBoaSA9IGMgPj4gOFxuICAgIGxvID0gYyAlIDI1NlxuICAgIGJ5dGVBcnJheS5wdXNoKGxvKVxuICAgIGJ5dGVBcnJheS5wdXNoKGhpKVxuICB9XG5cbiAgcmV0dXJuIGJ5dGVBcnJheVxufVxuXG5mdW5jdGlvbiBiYXNlNjRUb0J5dGVzIChzdHIpIHtcbiAgcmV0dXJuIGJhc2U2NC50b0J5dGVBcnJheShiYXNlNjRjbGVhbihzdHIpKVxufVxuXG5mdW5jdGlvbiBibGl0QnVmZmVyIChzcmMsIGRzdCwgb2Zmc2V0LCBsZW5ndGgpIHtcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgIGlmICgoaSArIG9mZnNldCA+PSBkc3QubGVuZ3RoKSB8fCAoaSA+PSBzcmMubGVuZ3RoKSkgYnJlYWtcbiAgICBkc3RbaSArIG9mZnNldF0gPSBzcmNbaV1cbiAgfVxuICByZXR1cm4gaVxufVxuIiwiJ3VzZSBzdHJpY3QnXG5cbmV4cG9ydHMudG9CeXRlQXJyYXkgPSB0b0J5dGVBcnJheVxuZXhwb3J0cy5mcm9tQnl0ZUFycmF5ID0gZnJvbUJ5dGVBcnJheVxuXG52YXIgbG9va3VwID0gW11cbnZhciByZXZMb29rdXAgPSBbXVxudmFyIEFyciA9IHR5cGVvZiBVaW50OEFycmF5ICE9PSAndW5kZWZpbmVkJyA/IFVpbnQ4QXJyYXkgOiBBcnJheVxuXG5mdW5jdGlvbiBpbml0ICgpIHtcbiAgdmFyIGNvZGUgPSAnQUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVphYmNkZWZnaGlqa2xtbm9wcXJzdHV2d3h5ejAxMjM0NTY3ODkrLydcbiAgZm9yICh2YXIgaSA9IDAsIGxlbiA9IGNvZGUubGVuZ3RoOyBpIDwgbGVuOyArK2kpIHtcbiAgICBsb29rdXBbaV0gPSBjb2RlW2ldXG4gICAgcmV2TG9va3VwW2NvZGUuY2hhckNvZGVBdChpKV0gPSBpXG4gIH1cblxuICByZXZMb29rdXBbJy0nLmNoYXJDb2RlQXQoMCldID0gNjJcbiAgcmV2TG9va3VwWydfJy5jaGFyQ29kZUF0KDApXSA9IDYzXG59XG5cbmluaXQoKVxuXG5mdW5jdGlvbiB0b0J5dGVBcnJheSAoYjY0KSB7XG4gIHZhciBpLCBqLCBsLCB0bXAsIHBsYWNlSG9sZGVycywgYXJyXG4gIHZhciBsZW4gPSBiNjQubGVuZ3RoXG5cbiAgaWYgKGxlbiAlIDQgPiAwKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIHN0cmluZy4gTGVuZ3RoIG11c3QgYmUgYSBtdWx0aXBsZSBvZiA0JylcbiAgfVxuXG4gIC8vIHRoZSBudW1iZXIgb2YgZXF1YWwgc2lnbnMgKHBsYWNlIGhvbGRlcnMpXG4gIC8vIGlmIHRoZXJlIGFyZSB0d28gcGxhY2Vob2xkZXJzLCB0aGFuIHRoZSB0d28gY2hhcmFjdGVycyBiZWZvcmUgaXRcbiAgLy8gcmVwcmVzZW50IG9uZSBieXRlXG4gIC8vIGlmIHRoZXJlIGlzIG9ubHkgb25lLCB0aGVuIHRoZSB0aHJlZSBjaGFyYWN0ZXJzIGJlZm9yZSBpdCByZXByZXNlbnQgMiBieXRlc1xuICAvLyB0aGlzIGlzIGp1c3QgYSBjaGVhcCBoYWNrIHRvIG5vdCBkbyBpbmRleE9mIHR3aWNlXG4gIHBsYWNlSG9sZGVycyA9IGI2NFtsZW4gLSAyXSA9PT0gJz0nID8gMiA6IGI2NFtsZW4gLSAxXSA9PT0gJz0nID8gMSA6IDBcblxuICAvLyBiYXNlNjQgaXMgNC8zICsgdXAgdG8gdHdvIGNoYXJhY3RlcnMgb2YgdGhlIG9yaWdpbmFsIGRhdGFcbiAgYXJyID0gbmV3IEFycihsZW4gKiAzIC8gNCAtIHBsYWNlSG9sZGVycylcblxuICAvLyBpZiB0aGVyZSBhcmUgcGxhY2Vob2xkZXJzLCBvbmx5IGdldCB1cCB0byB0aGUgbGFzdCBjb21wbGV0ZSA0IGNoYXJzXG4gIGwgPSBwbGFjZUhvbGRlcnMgPiAwID8gbGVuIC0gNCA6IGxlblxuXG4gIHZhciBMID0gMFxuXG4gIGZvciAoaSA9IDAsIGogPSAwOyBpIDwgbDsgaSArPSA0LCBqICs9IDMpIHtcbiAgICB0bXAgPSAocmV2TG9va3VwW2I2NC5jaGFyQ29kZUF0KGkpXSA8PCAxOCkgfCAocmV2TG9va3VwW2I2NC5jaGFyQ29kZUF0KGkgKyAxKV0gPDwgMTIpIHwgKHJldkxvb2t1cFtiNjQuY2hhckNvZGVBdChpICsgMildIDw8IDYpIHwgcmV2TG9va3VwW2I2NC5jaGFyQ29kZUF0KGkgKyAzKV1cbiAgICBhcnJbTCsrXSA9ICh0bXAgPj4gMTYpICYgMHhGRlxuICAgIGFycltMKytdID0gKHRtcCA+PiA4KSAmIDB4RkZcbiAgICBhcnJbTCsrXSA9IHRtcCAmIDB4RkZcbiAgfVxuXG4gIGlmIChwbGFjZUhvbGRlcnMgPT09IDIpIHtcbiAgICB0bXAgPSAocmV2TG9va3VwW2I2NC5jaGFyQ29kZUF0KGkpXSA8PCAyKSB8IChyZXZMb29rdXBbYjY0LmNoYXJDb2RlQXQoaSArIDEpXSA+PiA0KVxuICAgIGFycltMKytdID0gdG1wICYgMHhGRlxuICB9IGVsc2UgaWYgKHBsYWNlSG9sZGVycyA9PT0gMSkge1xuICAgIHRtcCA9IChyZXZMb29rdXBbYjY0LmNoYXJDb2RlQXQoaSldIDw8IDEwKSB8IChyZXZMb29rdXBbYjY0LmNoYXJDb2RlQXQoaSArIDEpXSA8PCA0KSB8IChyZXZMb29rdXBbYjY0LmNoYXJDb2RlQXQoaSArIDIpXSA+PiAyKVxuICAgIGFycltMKytdID0gKHRtcCA+PiA4KSAmIDB4RkZcbiAgICBhcnJbTCsrXSA9IHRtcCAmIDB4RkZcbiAgfVxuXG4gIHJldHVybiBhcnJcbn1cblxuZnVuY3Rpb24gdHJpcGxldFRvQmFzZTY0IChudW0pIHtcbiAgcmV0dXJuIGxvb2t1cFtudW0gPj4gMTggJiAweDNGXSArIGxvb2t1cFtudW0gPj4gMTIgJiAweDNGXSArIGxvb2t1cFtudW0gPj4gNiAmIDB4M0ZdICsgbG9va3VwW251bSAmIDB4M0ZdXG59XG5cbmZ1bmN0aW9uIGVuY29kZUNodW5rICh1aW50OCwgc3RhcnQsIGVuZCkge1xuICB2YXIgdG1wXG4gIHZhciBvdXRwdXQgPSBbXVxuICBmb3IgKHZhciBpID0gc3RhcnQ7IGkgPCBlbmQ7IGkgKz0gMykge1xuICAgIHRtcCA9ICh1aW50OFtpXSA8PCAxNikgKyAodWludDhbaSArIDFdIDw8IDgpICsgKHVpbnQ4W2kgKyAyXSlcbiAgICBvdXRwdXQucHVzaCh0cmlwbGV0VG9CYXNlNjQodG1wKSlcbiAgfVxuICByZXR1cm4gb3V0cHV0LmpvaW4oJycpXG59XG5cbmZ1bmN0aW9uIGZyb21CeXRlQXJyYXkgKHVpbnQ4KSB7XG4gIHZhciB0bXBcbiAgdmFyIGxlbiA9IHVpbnQ4Lmxlbmd0aFxuICB2YXIgZXh0cmFCeXRlcyA9IGxlbiAlIDMgLy8gaWYgd2UgaGF2ZSAxIGJ5dGUgbGVmdCwgcGFkIDIgYnl0ZXNcbiAgdmFyIG91dHB1dCA9ICcnXG4gIHZhciBwYXJ0cyA9IFtdXG4gIHZhciBtYXhDaHVua0xlbmd0aCA9IDE2MzgzIC8vIG11c3QgYmUgbXVsdGlwbGUgb2YgM1xuXG4gIC8vIGdvIHRocm91Z2ggdGhlIGFycmF5IGV2ZXJ5IHRocmVlIGJ5dGVzLCB3ZSdsbCBkZWFsIHdpdGggdHJhaWxpbmcgc3R1ZmYgbGF0ZXJcbiAgZm9yICh2YXIgaSA9IDAsIGxlbjIgPSBsZW4gLSBleHRyYUJ5dGVzOyBpIDwgbGVuMjsgaSArPSBtYXhDaHVua0xlbmd0aCkge1xuICAgIHBhcnRzLnB1c2goZW5jb2RlQ2h1bmsodWludDgsIGksIChpICsgbWF4Q2h1bmtMZW5ndGgpID4gbGVuMiA/IGxlbjIgOiAoaSArIG1heENodW5rTGVuZ3RoKSkpXG4gIH1cblxuICAvLyBwYWQgdGhlIGVuZCB3aXRoIHplcm9zLCBidXQgbWFrZSBzdXJlIHRvIG5vdCBmb3JnZXQgdGhlIGV4dHJhIGJ5dGVzXG4gIGlmIChleHRyYUJ5dGVzID09PSAxKSB7XG4gICAgdG1wID0gdWludDhbbGVuIC0gMV1cbiAgICBvdXRwdXQgKz0gbG9va3VwW3RtcCA+PiAyXVxuICAgIG91dHB1dCArPSBsb29rdXBbKHRtcCA8PCA0KSAmIDB4M0ZdXG4gICAgb3V0cHV0ICs9ICc9PSdcbiAgfSBlbHNlIGlmIChleHRyYUJ5dGVzID09PSAyKSB7XG4gICAgdG1wID0gKHVpbnQ4W2xlbiAtIDJdIDw8IDgpICsgKHVpbnQ4W2xlbiAtIDFdKVxuICAgIG91dHB1dCArPSBsb29rdXBbdG1wID4+IDEwXVxuICAgIG91dHB1dCArPSBsb29rdXBbKHRtcCA+PiA0KSAmIDB4M0ZdXG4gICAgb3V0cHV0ICs9IGxvb2t1cFsodG1wIDw8IDIpICYgMHgzRl1cbiAgICBvdXRwdXQgKz0gJz0nXG4gIH1cblxuICBwYXJ0cy5wdXNoKG91dHB1dClcblxuICByZXR1cm4gcGFydHMuam9pbignJylcbn1cbiIsImV4cG9ydHMucmVhZCA9IGZ1bmN0aW9uIChidWZmZXIsIG9mZnNldCwgaXNMRSwgbUxlbiwgbkJ5dGVzKSB7XG4gIHZhciBlLCBtXG4gIHZhciBlTGVuID0gbkJ5dGVzICogOCAtIG1MZW4gLSAxXG4gIHZhciBlTWF4ID0gKDEgPDwgZUxlbikgLSAxXG4gIHZhciBlQmlhcyA9IGVNYXggPj4gMVxuICB2YXIgbkJpdHMgPSAtN1xuICB2YXIgaSA9IGlzTEUgPyAobkJ5dGVzIC0gMSkgOiAwXG4gIHZhciBkID0gaXNMRSA/IC0xIDogMVxuICB2YXIgcyA9IGJ1ZmZlcltvZmZzZXQgKyBpXVxuXG4gIGkgKz0gZFxuXG4gIGUgPSBzICYgKCgxIDw8ICgtbkJpdHMpKSAtIDEpXG4gIHMgPj49ICgtbkJpdHMpXG4gIG5CaXRzICs9IGVMZW5cbiAgZm9yICg7IG5CaXRzID4gMDsgZSA9IGUgKiAyNTYgKyBidWZmZXJbb2Zmc2V0ICsgaV0sIGkgKz0gZCwgbkJpdHMgLT0gOCkge31cblxuICBtID0gZSAmICgoMSA8PCAoLW5CaXRzKSkgLSAxKVxuICBlID4+PSAoLW5CaXRzKVxuICBuQml0cyArPSBtTGVuXG4gIGZvciAoOyBuQml0cyA+IDA7IG0gPSBtICogMjU2ICsgYnVmZmVyW29mZnNldCArIGldLCBpICs9IGQsIG5CaXRzIC09IDgpIHt9XG5cbiAgaWYgKGUgPT09IDApIHtcbiAgICBlID0gMSAtIGVCaWFzXG4gIH0gZWxzZSBpZiAoZSA9PT0gZU1heCkge1xuICAgIHJldHVybiBtID8gTmFOIDogKChzID8gLTEgOiAxKSAqIEluZmluaXR5KVxuICB9IGVsc2Uge1xuICAgIG0gPSBtICsgTWF0aC5wb3coMiwgbUxlbilcbiAgICBlID0gZSAtIGVCaWFzXG4gIH1cbiAgcmV0dXJuIChzID8gLTEgOiAxKSAqIG0gKiBNYXRoLnBvdygyLCBlIC0gbUxlbilcbn1cblxuZXhwb3J0cy53cml0ZSA9IGZ1bmN0aW9uIChidWZmZXIsIHZhbHVlLCBvZmZzZXQsIGlzTEUsIG1MZW4sIG5CeXRlcykge1xuICB2YXIgZSwgbSwgY1xuICB2YXIgZUxlbiA9IG5CeXRlcyAqIDggLSBtTGVuIC0gMVxuICB2YXIgZU1heCA9ICgxIDw8IGVMZW4pIC0gMVxuICB2YXIgZUJpYXMgPSBlTWF4ID4+IDFcbiAgdmFyIHJ0ID0gKG1MZW4gPT09IDIzID8gTWF0aC5wb3coMiwgLTI0KSAtIE1hdGgucG93KDIsIC03NykgOiAwKVxuICB2YXIgaSA9IGlzTEUgPyAwIDogKG5CeXRlcyAtIDEpXG4gIHZhciBkID0gaXNMRSA/IDEgOiAtMVxuICB2YXIgcyA9IHZhbHVlIDwgMCB8fCAodmFsdWUgPT09IDAgJiYgMSAvIHZhbHVlIDwgMCkgPyAxIDogMFxuXG4gIHZhbHVlID0gTWF0aC5hYnModmFsdWUpXG5cbiAgaWYgKGlzTmFOKHZhbHVlKSB8fCB2YWx1ZSA9PT0gSW5maW5pdHkpIHtcbiAgICBtID0gaXNOYU4odmFsdWUpID8gMSA6IDBcbiAgICBlID0gZU1heFxuICB9IGVsc2Uge1xuICAgIGUgPSBNYXRoLmZsb29yKE1hdGgubG9nKHZhbHVlKSAvIE1hdGguTE4yKVxuICAgIGlmICh2YWx1ZSAqIChjID0gTWF0aC5wb3coMiwgLWUpKSA8IDEpIHtcbiAgICAgIGUtLVxuICAgICAgYyAqPSAyXG4gICAgfVxuICAgIGlmIChlICsgZUJpYXMgPj0gMSkge1xuICAgICAgdmFsdWUgKz0gcnQgLyBjXG4gICAgfSBlbHNlIHtcbiAgICAgIHZhbHVlICs9IHJ0ICogTWF0aC5wb3coMiwgMSAtIGVCaWFzKVxuICAgIH1cbiAgICBpZiAodmFsdWUgKiBjID49IDIpIHtcbiAgICAgIGUrK1xuICAgICAgYyAvPSAyXG4gICAgfVxuXG4gICAgaWYgKGUgKyBlQmlhcyA+PSBlTWF4KSB7XG4gICAgICBtID0gMFxuICAgICAgZSA9IGVNYXhcbiAgICB9IGVsc2UgaWYgKGUgKyBlQmlhcyA+PSAxKSB7XG4gICAgICBtID0gKHZhbHVlICogYyAtIDEpICogTWF0aC5wb3coMiwgbUxlbilcbiAgICAgIGUgPSBlICsgZUJpYXNcbiAgICB9IGVsc2Uge1xuICAgICAgbSA9IHZhbHVlICogTWF0aC5wb3coMiwgZUJpYXMgLSAxKSAqIE1hdGgucG93KDIsIG1MZW4pXG4gICAgICBlID0gMFxuICAgIH1cbiAgfVxuXG4gIGZvciAoOyBtTGVuID49IDg7IGJ1ZmZlcltvZmZzZXQgKyBpXSA9IG0gJiAweGZmLCBpICs9IGQsIG0gLz0gMjU2LCBtTGVuIC09IDgpIHt9XG5cbiAgZSA9IChlIDw8IG1MZW4pIHwgbVxuICBlTGVuICs9IG1MZW5cbiAgZm9yICg7IGVMZW4gPiAwOyBidWZmZXJbb2Zmc2V0ICsgaV0gPSBlICYgMHhmZiwgaSArPSBkLCBlIC89IDI1NiwgZUxlbiAtPSA4KSB7fVxuXG4gIGJ1ZmZlcltvZmZzZXQgKyBpIC0gZF0gfD0gcyAqIDEyOFxufVxuIiwidmFyIHRvU3RyaW5nID0ge30udG9TdHJpbmc7XG5cbm1vZHVsZS5leHBvcnRzID0gQXJyYXkuaXNBcnJheSB8fCBmdW5jdGlvbiAoYXJyKSB7XG4gIHJldHVybiB0b1N0cmluZy5jYWxsKGFycikgPT0gJ1tvYmplY3QgQXJyYXldJztcbn07XG4iLCIoZnVuY3Rpb24oKSB7XG4gICd1c2Ugc3RyaWN0JztcblxuICBjb25zdCBBVlMgPSByZXF1aXJlKCcuL2xpYi9BVlMnKTtcblxuICBpZiAodHlwZW9mIGV4cG9ydHMgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgaWYgKHR5cGVvZiBtb2R1bGUgIT09ICd1bmRlZmluZWQnICYmIG1vZHVsZS5leHBvcnRzKSB7XG4gICAgICBleHBvcnRzID0gbW9kdWxlLmV4cG9ydHMgPSBBVlM7XG4gICAgfVxuICAgIGV4cG9ydHMuQVZTID0gQVZTO1xuICB9XG5cbiAgaWYgKHR5cGVvZiBkZWZpbmUgPT09ICdmdW5jdGlvbicgJiYgZGVmaW5lLmFtZCkge1xuICAgIGRlZmluZShbXSwgZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gQVZTO1xuICAgIH0pO1xuICB9XG5cbiAgaWYgKHR5cGVvZiB3aW5kb3cgPT09ICdvYmplY3QnKSB7XG4gICAgd2luZG93LkFWUyA9IEFWUztcbiAgfVxufSkoKTtcbiIsIid1c2Ugc3RyaWN0JztcblxuY29uc3QgQnVmZmVyID0gcmVxdWlyZSgnYnVmZmVyJykuQnVmZmVyO1xuY29uc3QgcXMgPSByZXF1aXJlKCdxcycpO1xuY29uc3QgaHR0cE1lc3NhZ2VQYXJzZXIgPSByZXF1aXJlKCdodHRwLW1lc3NhZ2UtcGFyc2VyJyk7XG5cbmNvbnN0IEFNQVpPTl9FUlJPUl9DT0RFUyA9IHJlcXVpcmUoJy4vQW1hem9uRXJyb3JDb2Rlcy5qcycpO1xuY29uc3QgT2JzZXJ2YWJsZSA9IHJlcXVpcmUoJy4vT2JzZXJ2YWJsZS5qcycpO1xuY29uc3QgUGxheWVyID0gcmVxdWlyZSgnLi9QbGF5ZXIuanMnKTtcbmNvbnN0IGFycmF5QnVmZmVyVG9TdHJpbmcgPSByZXF1aXJlKCcuL3V0aWxzL2FycmF5QnVmZmVyVG9TdHJpbmcuanMnKTtcbmNvbnN0IHdyaXRlVVRGQnl0ZXMgPSByZXF1aXJlKCcuL3V0aWxzL3dyaXRlVVRGQnl0ZXMuanMnKTtcbmNvbnN0IG1lcmdlQnVmZmVycyA9IHJlcXVpcmUoJy4vdXRpbHMvbWVyZ2VCdWZmZXJzLmpzJyk7XG5jb25zdCBpbnRlcmxlYXZlID0gcmVxdWlyZSgnLi91dGlscy9pbnRlcmxlYXZlLmpzJyk7XG5jb25zdCBkb3duc2FtcGxlQnVmZmVyID0gcmVxdWlyZSgnLi91dGlscy9kb3duc2FtcGxlQnVmZmVyLmpzJyk7XG5cbmNsYXNzIEFWUyB7XG4gIGNvbnN0cnVjdG9yKG9wdGlvbnMgPSB7fSkge1xuICAgIE9ic2VydmFibGUodGhpcyk7XG5cbiAgICB0aGlzLl9idWZmZXJTaXplID0gMjA0ODtcbiAgICB0aGlzLl9pbnB1dENoYW5uZWxzID0gMTtcbiAgICB0aGlzLl9vdXRwdXRDaGFubmVscyA9IDE7XG4gICAgdGhpcy5fbGVmdENoYW5uZWwgPSBbXTtcbiAgICB0aGlzLl9yaWdodENoYW5uZWwgPSBbXTtcbiAgICB0aGlzLl9hdWRpb0NvbnRleHQgPSBudWxsO1xuICAgIHRoaXMuX3JlY29yZGVyID0gbnVsbDtcbiAgICB0aGlzLl9zYW1wbGVSYXRlID0gbnVsbDtcbiAgICB0aGlzLl9vdXRwdXRTYW1wbGVSYXRlID0gMTYwMDA7XG4gICAgdGhpcy5fYXVkaW9JbnB1dCA9IG51bGw7XG4gICAgdGhpcy5fdm9sdW1lTm9kZSA9IG51bGw7XG4gICAgdGhpcy5fZGVidWcgPSBmYWxzZTtcbiAgICB0aGlzLl90b2tlbiA9IG51bGw7XG4gICAgdGhpcy5fcmVmcmVzaFRva2VuID0gbnVsbDtcbiAgICB0aGlzLl9jbGllbnRJZCA9IG51bGw7XG4gICAgdGhpcy5fY2xpZW50U2VjcmV0ID0gbnVsbDtcbiAgICB0aGlzLl9kZXZpY2VJZD0gbnVsbDtcbiAgICB0aGlzLl9kZXZpY2VTZXJpYWxOdW1iZXIgPSBudWxsO1xuICAgIHRoaXMuX3JlZGlyZWN0VXJpID0gbnVsbDtcbiAgICB0aGlzLl9hdWRpb1F1ZXVlID0gW107XG5cbiAgICBpZiAob3B0aW9ucy50b2tlbikge1xuICAgICAgdGhpcy5zZXRUb2tlbihvcHRpb25zLnRva2VuKTtcbiAgICB9XG5cbiAgICBpZiAob3B0aW9ucy5yZWZyZXNoVG9rZW4pIHtcbiAgICAgIHRoaXMuc2V0UmVmcmVzaFRva2VuKG9wdGlvbnMucmVmcmVzaFRva2VuKTtcbiAgICB9XG5cbiAgICBpZiAob3B0aW9ucy5jbGllbnRJZCkge1xuICAgICAgdGhpcy5zZXRDbGllbnRJZChvcHRpb25zLmNsaWVudElkKTtcbiAgICB9XG5cbiAgICBpZiAob3B0aW9ucy5jbGllbnRTZWNyZXQpIHtcbiAgICAgIHRoaXMuc2V0Q2xpZW50U2VjcmV0KG9wdGlvbnMuY2xpZW50U2VjcmV0KTtcbiAgICB9XG5cbiAgICBpZiAob3B0aW9ucy5kZXZpY2VJZCkge1xuICAgICAgdGhpcy5zZXREZXZpY2VJZChvcHRpb25zLmRldmljZUlkKTtcbiAgICB9XG5cbiAgICBpZiAob3B0aW9ucy5kZXZpY2VTZXJpYWxOdW1iZXIpIHtcbiAgICAgIHRoaXMuc2V0RGV2aWNlU2VyaWFsTnVtYmVyKG9wdGlvbnMuZGV2aWNlU2VyaWFsTnVtYmVyKTtcbiAgICB9XG5cbiAgICBpZiAob3B0aW9ucy5yZWRpcmVjdFVyaSkge1xuICAgICAgdGhpcy5zZXRSZWRpcmVjdFVyaShvcHRpb25zLnJlZGlyZWN0VXJpKTtcbiAgICB9XG5cbiAgICBpZiAob3B0aW9ucy5kZWJ1Zykge1xuICAgICAgdGhpcy5zZXREZWJ1ZyhvcHRpb25zLmRlYnVnKTtcbiAgICB9XG5cbiAgICB0aGlzLnBsYXllciA9IG5ldyBQbGF5ZXIoKTtcbiAgfVxuXG4gIF9sb2codHlwZSwgbWVzc2FnZSkge1xuICAgIGlmICh0eXBlICYmICFtZXNzYWdlKSB7XG4gICAgICBtZXNzYWdlID0gdHlwZTtcbiAgICAgIHR5cGUgPSAnbG9nJztcbiAgICB9XG5cbiAgICBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgIHRoaXMuZW1pdChBVlMuRXZlbnRUeXBlcy5MT0csIG1lc3NhZ2UpO1xuICAgIH0sIDApO1xuXG4gICAgaWYgKHRoaXMuX2RlYnVnKSB7XG4gICAgICBjb25zb2xlW3R5cGVdKG1lc3NhZ2UpO1xuICAgIH1cbiAgfVxuXG4gIGxvZ2luKG9wdGlvbnMgPSB7fSkge1xuICAgIHJldHVybiB0aGlzLnByb21wdFVzZXJMb2dpbihvcHRpb25zKTtcbiAgfVxuXG4gIGxvZ291dCgpIHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgdGhpcy5fdG9rZW4gPSBudWxsO1xuICAgICAgdGhpcy5fcmVmcmVzaFRva2VuID0gbnVsbDtcbiAgICAgIHRoaXMuZW1pdChBVlMuRXZlbnRUeXBlcy5MT0dPVVQpO1xuICAgICAgdGhpcy5fbG9nKCdMb2dnZWQgb3V0Jyk7XG4gICAgICByZXNvbHZlKCk7XG4gICAgfSk7XG4gIH1cblxuICBwcm9tcHRVc2VyTG9naW4ob3B0aW9ucyA9IHtyZXNwb25zZVR5cGU6ICd0b2tlbicsIG5ld1dpbmRvdzogZmFsc2V9KSB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgIGlmICh0eXBlb2Ygb3B0aW9ucy5yZXNwb25zZVR5cGUgPT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgIG9wdGlvbnMucmVzcG9uc2VUeXBlID0gJ3Rva2VuJztcbiAgICAgIH1cblxuICAgICAgaWYgKHR5cGVvZiBvcHRpb25zLnJlc3BvbnNlVHlwZSAhPT0gJ3N0cmluZycpIHtcbiAgICAgICAgY29uc3QgZXJyb3IgPSBuZXcgRXJyb3IoJ2ByZXNwb25zZVR5cGVgIG11c3QgYSBzdHJpbmcuJyk7XG4gICAgICAgIHRoaXMuX2xvZyhlcnJvcik7XG4gICAgICAgIHJldHVybiByZWplY3QoZXJyb3IpO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBuZXdXaW5kb3cgPSAhIW9wdGlvbnMubmV3V2luZG93O1xuXG4gICAgICBjb25zdCByZXNwb25zZVR5cGUgPSBvcHRpb25zLnJlc3BvbnNlVHlwZTtcblxuICAgICAgaWYgKCEocmVzcG9uc2VUeXBlID09PSAnY29kZScgfHwgcmVzcG9uc2VUeXBlID09PSAndG9rZW4nKSkge1xuICAgICAgICBjb25zdCBlcnJvciA9IG5ldyBFcnJvcignYHJlc3BvbnNlVHlwZWAgbXVzdCBiZSBlaXRoZXIgYGNvZGVgIG9yIGB0b2tlbmAuJyk7XG4gICAgICAgIHRoaXMuX2xvZyhlcnJvcik7XG4gICAgICAgIHJldHVybiByZWplY3QoZXJyb3IpO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBzY29wZSA9ICdhbGV4YTphbGwnO1xuICAgICAgY29uc3Qgc2NvcGVEYXRhID0ge1xuICAgICAgICBbc2NvcGVdOiB7XG4gICAgICAgICAgcHJvZHVjdElEOiB0aGlzLl9kZXZpY2VJZCxcbiAgICAgICAgICBwcm9kdWN0SW5zdGFuY2VBdHRyaWJ1dGVzOiB7XG4gICAgICAgICAgICBkZXZpY2VTZXJpYWxOdW1iZXI6IHRoaXMuX2RldmljZVNlcmlhbE51bWJlclxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfTtcblxuICAgICAgY29uc3QgYXV0aFVybCA9IGBodHRwczovL3d3dy5hbWF6b24uY29tL2FwL29hP2NsaWVudF9pZD0ke3RoaXMuX2NsaWVudElkfSZzY29wZT0ke2VuY29kZVVSSUNvbXBvbmVudChzY29wZSl9JnNjb3BlX2RhdGE9JHtlbmNvZGVVUklDb21wb25lbnQoSlNPTi5zdHJpbmdpZnkoc2NvcGVEYXRhKSl9JnJlc3BvbnNlX3R5cGU9JHtyZXNwb25zZVR5cGV9JnJlZGlyZWN0X3VyaT0ke2VuY29kZVVSSSh0aGlzLl9yZWRpcmVjdFVyaSl9YFxuXG4gICAgICBpZiAobmV3V2luZG93KSB7XG4gICAgICAgIHdpbmRvdy5vcGVuKGF1dGhVcmwpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgd2luZG93LmxvY2F0aW9uLmhyZWYgPSBhdXRoVXJsO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgZ2V0VG9rZW5Gcm9tQ29kZShjb2RlKSB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgIGlmICh0eXBlb2YgY29kZSAhPT0gJ3N0cmluZycpIHtcbiAgICAgICAgY29uc3QgZXJyb3IgPSBuZXcgVHlwZUVycm9yKCdgY29kZWAgbXVzdCBiZSBhIHN0cmluZy4nKTtcbiAgICAgICAgdGhpcy5fbG9nKGVycm9yKTtcbiAgICAgICAgcmV0dXJuIHJlamVjdChlcnJvcik7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IGdyYW50VHlwZSA9ICdhdXRob3JpemF0aW9uX2NvZGUnO1xuICAgICAgY29uc3QgcG9zdERhdGEgPSBgZ3JhbnRfdHlwZT0ke2dyYW50VHlwZX0mY29kZT0ke2NvZGV9JmNsaWVudF9pZD0ke3RoaXMuX2NsaWVudElkfSZjbGllbnRfc2VjcmV0PSR7dGhpcy5fY2xpZW50U2VjcmV0fSZyZWRpcmVjdF91cmk9JHtlbmNvZGVVUklDb21wb25lbnQodGhpcy5fcmVkaXJlY3RVcmkpfWA7XG4gICAgICBjb25zdCB1cmwgPSAnaHR0cHM6Ly9hcGkuYW1hem9uLmNvbS9hdXRoL28yL3Rva2VuJztcblxuICAgICAgY29uc3QgeGhyID0gbmV3IFhNTEh0dHBSZXF1ZXN0KCk7XG5cbiAgICAgIHhoci5vcGVuKCdQT1NUJywgdXJsLCB0cnVlKTtcbiAgICAgIHhoci5zZXRSZXF1ZXN0SGVhZGVyKCdDb250ZW50LVR5cGUnLCAnYXBwbGljYXRpb24veC13d3ctZm9ybS11cmxlbmNvZGVkO2NoYXJzZXQ9VVRGLTgnKTtcbiAgICAgIHhoci5vbmxvYWQgPSAoZXZlbnQpID0+IHtcbiAgICAgICAgbGV0IHJlc3BvbnNlID0geGhyLnJlc3BvbnNlO1xuXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgcmVzcG9uc2UgPSBKU09OLnBhcnNlKHhoci5yZXNwb25zZSk7XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgdGhpcy5fbG9nKGVycm9yKTtcbiAgICAgICAgICByZXR1cm4gcmVqZWN0KGVycm9yKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGlzT2JqZWN0ID0gcmVzcG9uc2UgaW5zdGFuY2VvZiBPYmplY3Q7XG4gICAgICAgIGNvbnN0IGVycm9yRGVzY3JpcHRpb24gPSBpc09iamVjdCAmJiByZXNwb25zZS5lcnJvcl9kZXNjcmlwdGlvbjtcblxuICAgICAgICBpZiAoZXJyb3JEZXNjcmlwdGlvbikge1xuICAgICAgICAgIGNvbnN0IGVycm9yID0gbmV3IEVycm9yKGVycm9yRGVzY3JpcHRpb24pO1xuICAgICAgICAgIHRoaXMuX2xvZyhlcnJvcik7XG4gICAgICAgICAgcmV0dXJuIHJlamVjdChlcnJvcik7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCB0b2tlbiA9IHJlc3BvbnNlLmFjY2Vzc190b2tlbjtcbiAgICAgICAgY29uc3QgcmVmcmVzaFRva2VuID0gcmVzcG9uc2UucmVmcmVzaF90b2tlbjtcbiAgICAgICAgY29uc3QgdG9rZW5UeXBlID0gcmVzcG9uc2UudG9rZW5fdHlwZTtcbiAgICAgICAgY29uc3QgZXhwaXJlc0luID0gcmVzcG9uc2UuZXhwaXJlc0luO1xuXG4gICAgICAgIHRoaXMuc2V0VG9rZW4odG9rZW4pXG4gICAgICAgIHRoaXMuc2V0UmVmcmVzaFRva2VuKHJlZnJlc2hUb2tlbilcblxuICAgICAgICB0aGlzLmVtaXQoQVZTLkV2ZW50VHlwZXMuTE9HSU4pO1xuICAgICAgICB0aGlzLl9sb2coJ0xvZ2dlZCBpbi4nKTtcbiAgICAgICAgcmVzb2x2ZShyZXNwb25zZSk7XG4gICAgICB9O1xuXG4gICAgICB4aHIub25lcnJvciA9IChlcnJvcikgPT4ge1xuICAgICAgICB0aGlzLl9sb2coZXJyb3IpO1xuICAgICAgICByZWplY3QoZXJyb3IpO1xuICAgICAgfTtcblxuICAgICAgeGhyLnNlbmQocG9zdERhdGEpO1xuICAgIH0pO1xuICB9XG5cbiAgcmVmcmVzaFRva2VuKCkge1xuICAgIHJldHVybiB0aGlzLmdldFRva2VuRnJvbVJlZnJlc2hUb2tlbih0aGlzLl9yZWZyZXNoVG9rZW4pXG4gICAgLnRoZW4oKCkgPT4ge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgdG9rZW46IHRoaXMuX3Rva2VuLFxuICAgICAgICByZWZyZXNoVG9rZW46IHRoaXMuX3JlZnJlc2hUb2tlblxuICAgICAgfTtcbiAgICB9KTtcbiAgfVxuXG4gIGdldFRva2VuRnJvbVJlZnJlc2hUb2tlbihyZWZyZXNoVG9rZW4gPSB0aGlzLl9yZWZyZXNoVG9rZW4pIHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgaWYgKHR5cGVvZiByZWZyZXNoVG9rZW4gIT09ICdzdHJpbmcnKSB7XG4gICAgICAgIGNvbnN0IGVycm9yID0gbmV3IEVycm9yKCdgcmVmcmVzaFRva2VuYCBtdXN0IGEgc3RyaW5nLicpO1xuICAgICAgICB0aGlzLl9sb2coZXJyb3IpO1xuICAgICAgICByZXR1cm4gcmVqZWN0KGVycm9yKTtcbiAgICAgIH1cblxuICAgICAgY29uc3QgZ3JhbnRUeXBlID0gJ3JlZnJlc2hfdG9rZW4nO1xuICAgICAgY29uc3QgcG9zdERhdGEgPSBgZ3JhbnRfdHlwZT0ke2dyYW50VHlwZX0mcmVmcmVzaF90b2tlbj0ke3JlZnJlc2hUb2tlbn0mY2xpZW50X2lkPSR7dGhpcy5fY2xpZW50SWR9JmNsaWVudF9zZWNyZXQ9JHt0aGlzLl9jbGllbnRTZWNyZXR9JnJlZGlyZWN0X3VyaT0ke2VuY29kZVVSSUNvbXBvbmVudCh0aGlzLl9yZWRpcmVjdFVyaSl9YDtcbiAgICAgIGNvbnN0IHVybCA9ICdodHRwczovL2FwaS5hbWF6b24uY29tL2F1dGgvbzIvdG9rZW4nO1xuICAgICAgY29uc3QgeGhyID0gbmV3IFhNTEh0dHBSZXF1ZXN0KCk7XG5cbiAgICAgIHhoci5vcGVuKCdQT1NUJywgdXJsLCB0cnVlKTtcbiAgICAgIHhoci5zZXRSZXF1ZXN0SGVhZGVyKCdDb250ZW50LVR5cGUnLCAnYXBwbGljYXRpb24veC13d3ctZm9ybS11cmxlbmNvZGVkO2NoYXJzZXQ9VVRGLTgnKTtcbiAgICAgIHhoci5yZXNwb25zZVR5cGUgPSAnanNvbic7XG4gICAgICB4aHIub25sb2FkID0gKGV2ZW50KSA9PiB7XG4gICAgICAgIGNvbnN0IHJlc3BvbnNlID0geGhyLnJlc3BvbnNlO1xuXG4gICAgICAgIGlmIChyZXNwb25zZS5lcnJvcikge1xuICAgICAgICAgIGNvbnN0IGVycm9yID0gcmVzcG9uc2UuZXJyb3IubWVzc2FnZTtcbiAgICAgICAgICB0aGlzLmVtaXQoQVZTLkV2ZW50VHlwZXMuRVJST1IsIGVycm9yKTtcblxuICAgICAgICAgIHJldHVybiByZWplY3QoZXJyb3IpO1xuICAgICAgICB9IGVsc2UgIHtcbiAgICAgICAgICBjb25zdCB0b2tlbiA9IHJlc3BvbnNlLmFjY2Vzc190b2tlbjtcbiAgICAgICAgICBjb25zdCByZWZyZXNoVG9rZW4gPSByZXNwb25zZS5yZWZyZXNoX3Rva2VuO1xuXG4gICAgICAgICAgdGhpcy5zZXRUb2tlbih0b2tlbik7XG4gICAgICAgICAgdGhpcy5zZXRSZWZyZXNoVG9rZW4ocmVmcmVzaFRva2VuKTtcblxuICAgICAgICAgIHJldHVybiByZXNvbHZlKHRva2VuKTtcbiAgICAgICAgfVxuICAgICAgfTtcblxuICAgICAgeGhyLm9uZXJyb3IgPSAoZXJyb3IpID0+IHtcbiAgICAgICAgdGhpcy5fbG9nKGVycm9yKTtcbiAgICAgICAgcmVqZWN0KGVycm9yKTtcbiAgICAgIH07XG5cbiAgICAgIHhoci5zZW5kKHBvc3REYXRhKTtcbiAgICB9KTtcbiAgfVxuXG4gIGdldFRva2VuRnJvbVVybCgpIHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgbGV0IGhhc2ggPSB3aW5kb3cubG9jYXRpb24uaGFzaC5zdWJzdHIoMSk7XG5cbiAgICAgIGNvbnN0IHF1ZXJ5ID0gcXMucGFyc2UoaGFzaCk7XG4gICAgICBjb25zdCB0b2tlbiA9IHF1ZXJ5LmFjY2Vzc190b2tlbjtcbiAgICAgIGNvbnN0IHJlZnJlc2hUb2tlbiA9IHF1ZXJ5LnJlZnJlc2hfdG9rZW47XG4gICAgICBjb25zdCB0b2tlblR5cGUgPSBxdWVyeS50b2tlbl90eXBlO1xuICAgICAgY29uc3QgZXhwaXJlc0luID0gcXVlcnkuZXhwaXJlc0luO1xuXG4gICAgICBpZiAodG9rZW4pIHtcbiAgICAgICAgdGhpcy5zZXRUb2tlbih0b2tlbilcbiAgICAgICAgdGhpcy5lbWl0KEFWUy5FdmVudFR5cGVzLkxPR0lOKTtcbiAgICAgICAgdGhpcy5fbG9nKCdMb2dnZWQgaW4uJyk7XG5cbiAgICAgICAgaWYgKHJlZnJlc2hUb2tlbikge1xuICAgICAgICAgIHRoaXMuc2V0UmVmcmVzaFRva2VuKHJlZnJlc2hUb2tlbik7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gcmVzb2x2ZSh0b2tlbik7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiByZWplY3QoKTtcbiAgICB9KTtcbiAgfVxuXG4gIGdldENvZGVGcm9tVXJsKCkge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICBjb25zdCBxdWVyeSA9IHFzLnBhcnNlKHdpbmRvdy5sb2NhdGlvbi5zZWFyY2guc3Vic3RyKDEpKTtcbiAgICAgIGNvbnN0IGNvZGUgPSBxdWVyeS5jb2RlO1xuXG4gICAgICBpZiAoY29kZSkge1xuICAgICAgICByZXR1cm4gcmVzb2x2ZShjb2RlKTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHJlamVjdChudWxsKTtcbiAgICB9KTtcbiAgfVxuXG4gIHNldFRva2VuKHRva2VuKSB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgIGlmICh0eXBlb2YgdG9rZW4gPT09ICdzdHJpbmcnKSB7XG4gICAgICAgIHRoaXMuX3Rva2VuID0gdG9rZW47XG4gICAgICAgIHRoaXMuZW1pdChBVlMuRXZlbnRUeXBlcy5UT0tFTl9TRVQpO1xuICAgICAgICB0aGlzLl9sb2coJ1Rva2VuIHNldC4nKTtcbiAgICAgICAgcmVzb2x2ZSh0aGlzLl90b2tlbik7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb25zdCBlcnJvciA9IG5ldyBUeXBlRXJyb3IoJ2B0b2tlbmAgbXVzdCBiZSBhIHN0cmluZy4nKTtcbiAgICAgICAgdGhpcy5fbG9nKGVycm9yKTtcbiAgICAgICAgcmVqZWN0KGVycm9yKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIHNldFJlZnJlc2hUb2tlbihyZWZyZXNoVG9rZW4pIHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgaWYgKHR5cGVvZiByZWZyZXNoVG9rZW4gPT09ICdzdHJpbmcnKSB7XG4gICAgICAgIHRoaXMuX3JlZnJlc2hUb2tlbiA9IHJlZnJlc2hUb2tlbjtcbiAgICAgICAgdGhpcy5lbWl0KEFWUy5FdmVudFR5cGVzLlJFRlJFU0hfVE9LRU5fU0VUKTtcbiAgICAgICAgdGhpcy5fbG9nKCdSZWZyZXNoIHRva2VuIHNldC4nKTtcbiAgICAgICAgcmVzb2x2ZSh0aGlzLl9yZWZyZXNoVG9rZW4pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uc3QgZXJyb3IgPSBuZXcgVHlwZUVycm9yKCdgcmVmcmVzaFRva2VuYCBtdXN0IGJlIGEgc3RyaW5nLicpO1xuICAgICAgICB0aGlzLl9sb2coZXJyb3IpO1xuICAgICAgICByZWplY3QoZXJyb3IpO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgc2V0Q2xpZW50SWQoY2xpZW50SWQpIHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgaWYgKHR5cGVvZiBjbGllbnRJZCA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgdGhpcy5fY2xpZW50SWQgPSBjbGllbnRJZDtcbiAgICAgICAgcmVzb2x2ZSh0aGlzLl9jbGllbnRJZCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb25zdCBlcnJvciA9IG5ldyBUeXBlRXJyb3IoJ2BjbGllbnRJZGAgbXVzdCBiZSBhIHN0cmluZy4nKTtcbiAgICAgICAgdGhpcy5fbG9nKGVycm9yKTtcbiAgICAgICAgcmVqZWN0KGVycm9yKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIHNldENsaWVudFNlY3JldChjbGllbnRTZWNyZXQpIHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgaWYgKHR5cGVvZiBjbGllbnRTZWNyZXQgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgIHRoaXMuX2NsaWVudFNlY3JldCA9IGNsaWVudFNlY3JldDtcbiAgICAgICAgcmVzb2x2ZSh0aGlzLl9jbGllbnRTZWNyZXQpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uc3QgZXJyb3IgPSBuZXcgVHlwZUVycm9yKCdgY2xpZW50U2VjcmV0YCBtdXN0IGJlIGEgc3RyaW5nJyk7XG4gICAgICAgIHRoaXMuX2xvZyhlcnJvcik7XG4gICAgICAgIHJlamVjdChlcnJvcik7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICBzZXREZXZpY2VJZChkZXZpY2VJZCkge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICBpZiAodHlwZW9mIGRldmljZUlkID09PSAnc3RyaW5nJykge1xuICAgICAgICB0aGlzLl9kZXZpY2VJZCA9IGRldmljZUlkO1xuICAgICAgICByZXNvbHZlKHRoaXMuX2RldmljZUlkKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnN0IGVycm9yID0gbmV3IFR5cGVFcnJvcignYGRldmljZUlkYCBtdXN0IGJlIGEgc3RyaW5nLicpO1xuICAgICAgICB0aGlzLl9sb2coZXJyb3IpO1xuICAgICAgICByZWplY3QoZXJyb3IpO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgc2V0RGV2aWNlU2VyaWFsTnVtYmVyKGRldmljZVNlcmlhbE51bWJlcikge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICBpZiAodHlwZW9mIGRldmljZVNlcmlhbE51bWJlciA9PT0gJ251bWJlcicgfHwgdHlwZW9mIGRldmljZVNlcmlhbE51bWJlciA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgdGhpcy5fZGV2aWNlU2VyaWFsTnVtYmVyID0gZGV2aWNlU2VyaWFsTnVtYmVyO1xuICAgICAgICByZXNvbHZlKHRoaXMuX2RldmljZVNlcmlhbE51bWJlcik7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb25zdCBlcnJvciA9IG5ldyBUeXBlRXJyb3IoJ2BkZXZpY2VTZXJpYWxOdW1iZXJgIG11c3QgYmUgYSBudW1iZXIgb3Igc3RyaW5nLicpO1xuICAgICAgICB0aGlzLl9sb2coZXJyb3IpO1xuICAgICAgICByZWplY3QoZXJyb3IpO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgc2V0UmVkaXJlY3RVcmkocmVkaXJlY3RVcmkpIHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgaWYgKHR5cGVvZiByZWRpcmVjdFVyaSA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgdGhpcy5fcmVkaXJlY3RVcmkgPSByZWRpcmVjdFVyaTtcbiAgICAgICAgcmVzb2x2ZSh0aGlzLl9yZWRpcmVjdFVyaSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb25zdCBlcnJvciA9IG5ldyBUeXBlRXJyb3IoJ2ByZWRpcmVjdFVyaWAgbXVzdCBiZSBhIHN0cmluZy4nKTtcbiAgICAgICAgdGhpcy5fbG9nKGVycm9yKTtcbiAgICAgICAgcmVqZWN0KGVycm9yKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIHNldERlYnVnKGRlYnVnKSB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgIGlmICh0eXBlb2YgZGVidWcgPT09ICdib29sZWFuJykge1xuICAgICAgICB0aGlzLl9kZWJ1ZyA9IGRlYnVnO1xuICAgICAgICByZXNvbHZlKHRoaXMuX2RlYnVnKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnN0IGVycm9yID0gbmV3IFR5cGVFcnJvcignYGRlYnVnYCBtdXN0IGJlIGEgYm9vbGVhbi4nKTtcbiAgICAgICAgdGhpcy5fbG9nKGVycm9yKTtcbiAgICAgICAgcmVqZWN0KGVycm9yKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIGdldFRva2VuKCkge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICBjb25zdCB0b2tlbiA9IHRoaXMuX3Rva2VuO1xuXG4gICAgICBpZiAodG9rZW4pIHtcbiAgICAgICAgcmV0dXJuIHJlc29sdmUodG9rZW4pO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gcmVqZWN0KCk7XG4gICAgfSk7XG4gIH1cblxuICBnZXRSZWZyZXNoVG9rZW4oKSB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgIGNvbnN0IHJlZnJlc2hUb2tlbiA9IHRoaXMuX3JlZnJlc2hUb2tlbjtcblxuICAgICAgaWYgKHJlZnJlc2hUb2tlbikge1xuICAgICAgICByZXR1cm4gcmVzb2x2ZShyZWZyZXNoVG9rZW4pO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gcmVqZWN0KCk7XG4gICAgfSk7XG4gIH1cblxuICByZXF1ZXN0TWljKCkge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICB0aGlzLl9sb2coJ1JlcXVlc3RpbmcgbWljcm9waG9uZS4nKTtcblxuICAgICAgLy8gRW5zdXJlIHRoYXQgdGhlIGZpbGUgY2FuIGJlIGxvYWRlZCBpbiBlbnZpcm9ubWVudHMgd2hlcmUgbmF2aWdhdG9yIGlzIG5vdCBkZWZpbmVkIChub2RlIHNlcnZlcnMpXG4gICAgICBpZiAoIW5hdmlnYXRvci5nZXRVc2VyTWVkaWEpIHtcbiAgICAgICAgbmF2aWdhdG9yLmdldFVzZXJNZWRpYSA9IG5hdmlnYXRvci5nZXRVc2VyTWVkaWEgfHwgbmF2aWdhdG9yLndlYmtpdEdldFVzZXJNZWRpYSB8fFxuICAgICAgICAgIG5hdmlnYXRvci5tb3pHZXRVc2VyTWVkaWEgfHwgbmF2aWdhdG9yLm1zR2V0VXNlck1lZGlhO1xuICAgICAgfVxuXG4gICAgICBuYXZpZ2F0b3IuZ2V0VXNlck1lZGlhKHtcbiAgICAgICAgYXVkaW86IHRydWVcbiAgICAgIH0sIChzdHJlYW0pID0+IHtcbiAgICAgICAgdGhpcy5fbG9nKCdNaWNyb3Bob25lIGNvbm5lY3RlZC4nKTtcbiAgICAgICAgcmV0dXJuIHRoaXMuY29ubmVjdE1lZGlhU3RyZWFtKHN0cmVhbSkudGhlbihyZXNvbHZlKTtcbiAgICAgIH0sIChlcnJvcikgPT4ge1xuICAgICAgICB0aGlzLl9sb2coJ2Vycm9yJywgZXJyb3IpO1xuICAgICAgICB0aGlzLmVtaXQoQVZTLkV2ZW50VHlwZXMuRVJST1IsIGVycm9yKTtcbiAgICAgICAgcmV0dXJuIHJlamVjdChlcnJvcik7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxuXG4gIGNvbm5lY3RNZWRpYVN0cmVhbShzdHJlYW0pIHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgY29uc3QgaXNNZWRpYVN0cmVhbSA9IE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChzdHJlYW0pID09PSAnW29iamVjdCBNZWRpYVN0cmVhbV0nO1xuXG4gICAgICBpZiAoIWlzTWVkaWFTdHJlYW0pIHtcbiAgICAgICAgY29uc3QgZXJyb3IgPSBuZXcgVHlwZUVycm9yKCdBcmd1bWVudCBtdXN0IGJlIGEgYE1lZGlhU3RyZWFtYCBvYmplY3QuJylcbiAgICAgICAgdGhpcy5fbG9nKCdlcnJvcicsIGVycm9yKVxuICAgICAgICB0aGlzLmVtaXQoQVZTLkV2ZW50VHlwZXMuRVJST1IsIGVycm9yKTtcbiAgICAgICAgcmV0dXJuIHJlamVjdChlcnJvcik7XG4gICAgICB9XG5cbiAgICAgIHRoaXMuX2F1ZGlvQ29udGV4dCA9IG5ldyBBdWRpb0NvbnRleHQoKTtcbiAgICAgIHRoaXMuX3NhbXBsZVJhdGUgPSB0aGlzLl9hdWRpb0NvbnRleHQuc2FtcGxlUmF0ZTtcblxuICAgICAgdGhpcy5fbG9nKGBTYW1wbGUgcmF0ZTogJHt0aGlzLl9zYW1wbGVSYXRlfS5gKTtcblxuICAgICAgdGhpcy5fdm9sdW1lTm9kZSA9IHRoaXMuX2F1ZGlvQ29udGV4dC5jcmVhdGVHYWluKCk7XG4gICAgICB0aGlzLl9hdWRpb0lucHV0ID0gdGhpcy5fYXVkaW9Db250ZXh0LmNyZWF0ZU1lZGlhU3RyZWFtU291cmNlKHN0cmVhbSk7XG5cbiAgICAgIHRoaXMuX2F1ZGlvSW5wdXQuY29ubmVjdCh0aGlzLl92b2x1bWVOb2RlKTtcblxuICAgICAgdGhpcy5fcmVjb3JkZXIgPSB0aGlzLl9hdWRpb0NvbnRleHQuY3JlYXRlU2NyaXB0UHJvY2Vzc29yKHRoaXMuX2J1ZmZlclNpemUsIHRoaXMuX2lucHV0Q2hhbm5lbHMsIHRoaXMuX291dHB1dENoYW5uZWxzKTtcblxuICAgICAgdGhpcy5fcmVjb3JkZXIub25hdWRpb3Byb2Nlc3MgPSAoZXZlbnQpID0+IHtcbiAgICAgICAgaWYgKCF0aGlzLl9pc1JlY29yZGluZykge1xuICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGxlZnQgPSBldmVudC5pbnB1dEJ1ZmZlci5nZXRDaGFubmVsRGF0YSgwKTtcbiAgICAgICAgdGhpcy5fbGVmdENoYW5uZWwucHVzaChuZXcgRmxvYXQzMkFycmF5KGxlZnQpKTtcblxuICAgICAgICBpZiAodGhpcy5faW5wdXRDaGFubmVscyA+IDEpIHtcbiAgICAgICAgICBjb25zdCByaWdodCA9IGV2ZW50LmlucHV0QnVmZmVyLmdldENoYW5uZWxEYXRhKDEpO1xuICAgICAgICAgIHRoaXMuX3JpZ2h0Q2hhbm5lbC5wdXNoKG5ldyBGbG9hdDMyQXJyYXkocmlnaHQpKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX3JlY29yZGluZ0xlbmd0aCArPSB0aGlzLl9idWZmZXJTaXplO1xuICAgICAgfTtcblxuICAgICAgdGhpcy5fdm9sdW1lTm9kZS5jb25uZWN0KHRoaXMuX3JlY29yZGVyKTtcbiAgICAgIHRoaXMuX3JlY29yZGVyLmNvbm5lY3QodGhpcy5fYXVkaW9Db250ZXh0LmRlc3RpbmF0aW9uKTtcbiAgICAgIHRoaXMuX2xvZyhgTWVkaWEgc3RyZWFtIGNvbm5lY3RlZC5gKTtcblxuICAgICAgcmV0dXJuIHJlc29sdmUoc3RyZWFtKTtcbiAgICB9KTtcbiAgfVxuXG4gIHN0YXJ0UmVjb3JkaW5nKCkge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICBpZiAoIXRoaXMuX2F1ZGlvSW5wdXQpIHtcbiAgICAgICAgY29uc3QgZXJyb3IgPSBuZXcgRXJyb3IoJ05vIE1lZGlhIFN0cmVhbSBjb25uZWN0ZWQuJyk7XG4gICAgICAgIHRoaXMuX2xvZygnZXJyb3InLCBlcnJvcik7XG4gICAgICAgIHRoaXMuZW1pdChBVlMuRXZlbnRUeXBlcy5FUlJPUiwgZXJyb3IpO1xuICAgICAgICByZXR1cm4gcmVqZWN0KGVycm9yKTtcbiAgICAgIH1cblxuICAgICAgdGhpcy5faXNSZWNvcmRpbmcgPSB0cnVlO1xuICAgICAgdGhpcy5fbGVmdENoYW5uZWwubGVuZ3RoID0gdGhpcy5fcmlnaHRDaGFubmVsLmxlbmd0aCA9IDA7XG4gICAgICB0aGlzLl9yZWNvcmRpbmdMZW5ndGggPSAwO1xuICAgICAgdGhpcy5fbG9nKGBSZWNvcmRpbmcgc3RhcnRlZC5gKTtcbiAgICAgIHRoaXMuZW1pdChBVlMuRXZlbnRUeXBlcy5SRUNPUkRfU1RBUlQpO1xuXG4gICAgICByZXR1cm4gcmVzb2x2ZSgpO1xuICAgIH0pO1xuICB9XG5cbiAgc3RvcFJlY29yZGluZygpIHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgaWYgKCF0aGlzLl9pc1JlY29yZGluZykge1xuICAgICAgICB0aGlzLmVtaXQoQVZTLkV2ZW50VHlwZXMuUkVDT1JEX1NUT1ApO1xuICAgICAgICB0aGlzLl9sb2coJ1JlY29yZGluZyBzdG9wcGVkLicpO1xuICAgICAgICByZXR1cm4gcmVzb2x2ZSgpO1xuICAgICAgfVxuXG4gICAgICB0aGlzLl9pc1JlY29yZGluZyA9IGZhbHNlO1xuXG4gICAgICBjb25zdCBsZWZ0QnVmZmVyID0gbWVyZ2VCdWZmZXJzKHRoaXMuX2xlZnRDaGFubmVsLCB0aGlzLl9yZWNvcmRpbmdMZW5ndGgpO1xuICAgICAgbGV0IGludGVybGVhdmVkID0gbnVsbDtcblxuICAgICAgaWYgKHRoaXMuX291dHB1dENoYW5uZWxzID4gMSkge1xuICAgICAgICBjb25zdCByaWdodEJ1ZmZlciA9IG1lcmdlQnVmZmVycyh0aGlzLl9yaWdodENoYW5uZWwsIHRoaXMuX3JlY29yZGluZ0xlbmd0aCk7XG4gICAgICAgIGludGVybGVhdmVkID0gaW50ZXJsZWF2ZShsZWZ0QnVmZmVyLCByaWdodEJ1ZmZlcik7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBpbnRlcmxlYXZlZCA9IGludGVybGVhdmUobGVmdEJ1ZmZlcik7XG4gICAgICB9XG5cbiAgICAgIGludGVybGVhdmVkID0gZG93bnNhbXBsZUJ1ZmZlcihpbnRlcmxlYXZlZCwgdGhpcy5fc2FtcGxlUmF0ZSwgdGhpcy5fb3V0cHV0U2FtcGxlUmF0ZSk7XG5cbiAgICAgIGNvbnN0IGJ1ZmZlciA9IG5ldyBBcnJheUJ1ZmZlcig0NCArIGludGVybGVhdmVkLmxlbmd0aCAqIDIpO1xuICAgICAgY29uc3QgdmlldyA9IG5ldyBEYXRhVmlldyhidWZmZXIpO1xuXG4gICAgICAvKipcbiAgICAgICAqIEBjcmVkaXQgaHR0cHM6Ly9naXRodWIuY29tL21hdHRkaWFtb25kL1JlY29yZGVyanNcbiAgICAgICAqL1xuICAgICAgd3JpdGVVVEZCeXRlcyh2aWV3LCAwLCAnUklGRicpO1xuICAgICAgdmlldy5zZXRVaW50MzIoNCwgNDQgKyBpbnRlcmxlYXZlZC5sZW5ndGggKiAyLCB0cnVlKTtcbiAgICAgIHdyaXRlVVRGQnl0ZXModmlldywgOCwgJ1dBVkUnKTtcbiAgICAgIHdyaXRlVVRGQnl0ZXModmlldywgMTIsICdmbXQgJyk7XG4gICAgICB2aWV3LnNldFVpbnQzMigxNiwgMTYsIHRydWUpO1xuICAgICAgdmlldy5zZXRVaW50MTYoMjAsIDEsIHRydWUpO1xuICAgICAgdmlldy5zZXRVaW50MTYoMjIsIHRoaXMuX291dHB1dENoYW5uZWxzLCB0cnVlKTtcbiAgICAgIHZpZXcuc2V0VWludDMyKDI0LCB0aGlzLl9vdXRwdXRTYW1wbGVSYXRlLCB0cnVlKTtcbiAgICAgIHZpZXcuc2V0VWludDMyKDI4LCB0aGlzLl9vdXRwdXRTYW1wbGVSYXRlICogNCwgdHJ1ZSk7XG4gICAgICB2aWV3LnNldFVpbnQxNigzMiwgNCwgdHJ1ZSk7XG4gICAgICB2aWV3LnNldFVpbnQxNigzNCwgMTYsIHRydWUpO1xuICAgICAgd3JpdGVVVEZCeXRlcyh2aWV3LCAzNiwgJ2RhdGEnKTtcbiAgICAgIHZpZXcuc2V0VWludDMyKDQwLCBpbnRlcmxlYXZlZC5sZW5ndGggKiAyLCB0cnVlKTtcblxuICAgICAgY29uc3QgbGVuZ3RoID0gaW50ZXJsZWF2ZWQubGVuZ3RoO1xuICAgICAgY29uc3Qgdm9sdW1lID0gMTtcbiAgICAgIGxldCBpbmRleCA9IDQ0O1xuXG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGxlbmd0aDsgaSsrKXtcbiAgICAgICAgdmlldy5zZXRJbnQxNihpbmRleCwgaW50ZXJsZWF2ZWRbaV0gKiAoMHg3RkZGICogdm9sdW1lKSwgdHJ1ZSk7XG4gICAgICAgIGluZGV4ICs9IDI7XG4gICAgICB9XG5cbiAgICAgIHRoaXMuX2xvZyhgUmVjb3JkaW5nIHN0b3BwZWQuYCk7XG4gICAgICB0aGlzLmVtaXQoQVZTLkV2ZW50VHlwZXMuUkVDT1JEX1NUT1ApO1xuICAgICAgcmV0dXJuIHJlc29sdmUodmlldyk7XG4gICAgfSk7XG4gIH1cblxuICBzZW5kQXVkaW8gKGRhdGFWaWV3KSB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgIGNvbnN0IHhociA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xuICAgICAgY29uc3QgdXJsID0gJ2h0dHBzOi8vYWNjZXNzLWFsZXhhLW5hLmFtYXpvbi5jb20vdjEvYXZzL3NwZWVjaHJlY29nbml6ZXIvcmVjb2duaXplJztcblxuICAgICAgeGhyLm9wZW4oJ1BPU1QnLCB1cmwsIHRydWUpO1xuICAgICAgeGhyLnJlc3BvbnNlVHlwZSA9ICdhcnJheWJ1ZmZlcic7XG4gICAgICB4aHIub25sb2FkID0gKGV2ZW50KSA9PiB7XG4gICAgICAgIGNvbnN0IGJ1ZmZlciA9IG5ldyBCdWZmZXIoeGhyLnJlc3BvbnNlKTtcblxuICAgICAgICBpZiAoeGhyLnN0YXR1cyA9PT0gMjAwKSB7XG4gICAgICAgICAgY29uc3QgcGFyc2VkTWVzc2FnZSA9IGh0dHBNZXNzYWdlUGFyc2VyKGJ1ZmZlcik7XG4gICAgICAgICAgcmVzb2x2ZSh7eGhyLCByZXNwb25zZTogcGFyc2VkTWVzc2FnZX0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGxldCBlcnJvciA9IG5ldyBFcnJvcignQW4gZXJyb3Igb2NjdXJlZCB3aXRoIHJlcXVlc3QuJyk7XG4gICAgICAgICAgbGV0IHJlc3BvbnNlID0ge307XG5cbiAgICAgICAgICBpZiAoIXhoci5yZXNwb25zZS5ieXRlTGVuZ3RoKSB7XG4gICAgICAgICAgICBlcnJvciA9IG5ldyBFcnJvcignRW1wdHkgcmVzcG9uc2UuJyk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgIHJlc3BvbnNlID0gSlNPTi5wYXJzZShhcnJheUJ1ZmZlclRvU3RyaW5nKGJ1ZmZlcikpO1xuICAgICAgICAgICAgfSBjYXRjaChlcnIpIHtcbiAgICAgICAgICAgICAgZXJyb3IgPSBlcnI7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgaWYgKHJlc3BvbnNlLmVycm9yIGluc3RhbmNlb2YgT2JqZWN0KSB7XG4gICAgICAgICAgICBpZiAocmVzcG9uc2UuZXJyb3IuY29kZSA9PT0gQU1BWk9OX0VSUk9SX0NPREVTLkludmFsaWRBY2Nlc3NUb2tlbkV4Y2VwdGlvbikge1xuICAgICAgICAgICAgICB0aGlzLmVtaXQoQVZTLkV2ZW50VHlwZXMuVE9LRU5fSU5WQUxJRCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGVycm9yID0gcmVzcG9uc2UuZXJyb3IubWVzc2FnZTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICB0aGlzLmVtaXQoQVZTLkV2ZW50VHlwZXMuRVJST1IsIGVycm9yKTtcbiAgICAgICAgICByZXR1cm4gcmVqZWN0KGVycm9yKTtcbiAgICAgICAgfVxuICAgICAgfTtcblxuICAgICAgeGhyLm9uZXJyb3IgPSAoZXJyb3IpID0+IHtcbiAgICAgICAgdGhpcy5fbG9nKGVycm9yKTtcbiAgICAgICAgcmVqZWN0KGVycm9yKTtcbiAgICAgIH07XG5cbiAgICAgIGNvbnN0IEJPVU5EQVJZID0gJ0JPVU5EQVJZMTIzNCc7XG4gICAgICBjb25zdCBCT1VOREFSWV9EQVNIRVMgPSAnLS0nO1xuICAgICAgY29uc3QgTkVXTElORSA9ICdcXHJcXG4nO1xuICAgICAgY29uc3QgTUVUQURBVEFfQ09OVEVOVF9ESVNQT1NJVElPTiA9ICdDb250ZW50LURpc3Bvc2l0aW9uOiBmb3JtLWRhdGE7IG5hbWU9XCJtZXRhZGF0YVwiJztcbiAgICAgIGNvbnN0IE1FVEFEQVRBX0NPTlRFTlRfVFlQRSA9ICdDb250ZW50LVR5cGU6IGFwcGxpY2F0aW9uL2pzb247IGNoYXJzZXQ9VVRGLTgnO1xuICAgICAgY29uc3QgQVVESU9fQ09OVEVOVF9UWVBFID0gJ0NvbnRlbnQtVHlwZTogYXVkaW8vTDE2OyByYXRlPTE2MDAwOyBjaGFubmVscz0xJztcbiAgICAgIGNvbnN0IEFVRElPX0NPTlRFTlRfRElTUE9TSVRJT04gPSAnQ29udGVudC1EaXNwb3NpdGlvbjogZm9ybS1kYXRhOyBuYW1lPVwiYXVkaW9cIic7XG5cbiAgICAgIGNvbnN0IG1ldGFkYXRhID0ge1xuICAgICAgICBtZXNzYWdlSGVhZGVyOiB7fSxcbiAgICAgICAgbWVzc2FnZUJvZHk6IHtcbiAgICAgICAgICBwcm9maWxlOiAnYWxleGEtY2xvc2UtdGFsaycsXG4gICAgICAgICAgbG9jYWxlOiAnZW4tdXMnLFxuICAgICAgICAgIGZvcm1hdDogJ2F1ZGlvL0wxNjsgcmF0ZT0xNjAwMDsgY2hhbm5lbHM9MSdcbiAgICAgICAgfVxuICAgICAgfTtcblxuICAgICAgY29uc3QgcG9zdERhdGFTdGFydCA9IFtcbiAgICAgICAgTkVXTElORSwgQk9VTkRBUllfREFTSEVTLCBCT1VOREFSWSwgTkVXTElORSwgTUVUQURBVEFfQ09OVEVOVF9ESVNQT1NJVElPTiwgTkVXTElORSwgTUVUQURBVEFfQ09OVEVOVF9UWVBFLFxuICAgICAgICBORVdMSU5FLCBORVdMSU5FLCBKU09OLnN0cmluZ2lmeShtZXRhZGF0YSksIE5FV0xJTkUsIEJPVU5EQVJZX0RBU0hFUywgQk9VTkRBUlksIE5FV0xJTkUsXG4gICAgICAgIEFVRElPX0NPTlRFTlRfRElTUE9TSVRJT04sIE5FV0xJTkUsIEFVRElPX0NPTlRFTlRfVFlQRSwgTkVXTElORSwgTkVXTElORVxuICAgICAgXS5qb2luKCcnKTtcblxuICAgICAgY29uc3QgcG9zdERhdGFFbmQgPSBbTkVXTElORSwgQk9VTkRBUllfREFTSEVTLCBCT1VOREFSWSwgQk9VTkRBUllfREFTSEVTLCBORVdMSU5FXS5qb2luKCcnKTtcblxuICAgICAgY29uc3Qgc2l6ZSA9IHBvc3REYXRhU3RhcnQubGVuZ3RoICsgZGF0YVZpZXcuYnl0ZUxlbmd0aCArIHBvc3REYXRhRW5kLmxlbmd0aDtcbiAgICAgIGNvbnN0IHVpbnQ4QXJyYXkgPSBuZXcgVWludDhBcnJheShzaXplKTtcbiAgICAgIGxldCBpID0gMDtcblxuICAgICAgZm9yICg7IGkgPCBwb3N0RGF0YVN0YXJ0Lmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHVpbnQ4QXJyYXlbaV0gPSBwb3N0RGF0YVN0YXJ0LmNoYXJDb2RlQXQoaSkgJiAweEZGO1xuICAgICAgfVxuXG4gICAgICBmb3IgKGxldCBqID0gMDsgaiA8IGRhdGFWaWV3LmJ5dGVMZW5ndGggOyBpKyssIGorKykge1xuICAgICAgICB1aW50OEFycmF5W2ldID0gZGF0YVZpZXcuZ2V0VWludDgoaik7XG4gICAgICB9XG5cbiAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgcG9zdERhdGFFbmQubGVuZ3RoOyBpKyssIGorKykge1xuICAgICAgICB1aW50OEFycmF5W2ldID0gcG9zdERhdGFFbmQuY2hhckNvZGVBdChqKSAmIDB4RkY7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IHBheWxvYWQgPSB1aW50OEFycmF5LmJ1ZmZlcjtcblxuICAgICAgeGhyLnNldFJlcXVlc3RIZWFkZXIoJ0F1dGhvcml6YXRpb24nLCBgQmVhcmVyICR7dGhpcy5fdG9rZW59YCk7XG4gICAgICB4aHIuc2V0UmVxdWVzdEhlYWRlcignQ29udGVudC1UeXBlJywgJ211bHRpcGFydC9mb3JtLWRhdGE7IGJvdW5kYXJ5PScgKyBCT1VOREFSWSk7XG4gICAgICB4aHIuc2VuZChwYXlsb2FkKTtcbiAgICB9KTtcbiAgfVxuXG4gIGF1ZGlvVG9CbG9iKGF1ZGlvKSB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgIGNvbnN0IGJsb2IgPSBuZXcgQmxvYihbYXVkaW9dLCB7dHlwZTogJ2F1ZGlvL21wZWcnfSk7XG5cbiAgICAgIHJlc29sdmUoYmxvYik7XG4gICAgfSk7XG4gIH1cblxuICBzdGF0aWMgZ2V0IEV2ZW50VHlwZXMoKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIExPRzogJ2xvZycsXG4gICAgICBFUlJPUjogJ2Vycm9yJyxcbiAgICAgIExPR0lOOiAnbG9naW4nLFxuICAgICAgTE9HT1VUOiAnbG9nb3V0JyxcbiAgICAgIFJFQ09SRF9TVEFSVDogJ3JlY29yZFN0YXJ0JyxcbiAgICAgIFJFQ09SRF9TVE9QOiAncmVjb3JkU3RvcCcsXG4gICAgICBUT0tFTl9TRVQ6ICd0b2tlblNldCcsXG4gICAgICBSRUZSRVNIX1RPS0VOX1NFVDogJ3JlZnJlc2hUb2tlblNldCcsXG4gICAgICBUT0tFTl9JTlZBTElEOiAndG9rZW5JbnZhbGlkJ1xuICAgIH07XG4gIH1cblxuICBzdGF0aWMgZ2V0IFBsYXllcigpIHtcbiAgICByZXR1cm4gUGxheWVyO1xuICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gQVZTO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgSW52YWxpZEFjY2Vzc1Rva2VuRXhjZXB0aW9uOiAnY29tLmFtYXpvbi5hbGV4YWh0dHBwcm94eS5leGNlcHRpb25zLkludmFsaWRBY2Nlc3NUb2tlbkV4Y2VwdGlvbidcbn07XG4iLCIndXNlIHN0cmljdCc7XG5cbmZ1bmN0aW9uIE9ic2VydmFibGUoZWwpIHtcbiAgbGV0IGNhbGxiYWNrcyA9IHt9O1xuXG4gIGVsLm9uID0gZnVuY3Rpb24obmFtZSwgZm4pIHtcbiAgICBpZiAodHlwZW9mIGZuICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdTZWNvbmQgYXJndW1lbnQgZm9yIFwib25cIiBtZXRob2QgbXVzdCBiZSBhIGZ1bmN0aW9uLicpO1xuICAgIH1cblxuICAgIChjYWxsYmFja3NbbmFtZV0gPSBjYWxsYmFja3NbbmFtZV0gfHwgW10pLnB1c2goZm4pO1xuXG4gICAgcmV0dXJuIGVsO1xuICB9O1xuXG4gIGVsLm9uZSA9IGZ1bmN0aW9uKG5hbWUsIGZuKSB7XG4gICAgZm4ub25lID0gdHJ1ZTtcbiAgICByZXR1cm4gZWwub24uY2FsbChlbCwgbmFtZSwgZm4pO1xuICB9O1xuXG4gIGVsLm9mZiA9IGZ1bmN0aW9uKG5hbWUsIGZuKSB7XG4gICAgaWYgKG5hbWUgPT09ICcqJykge1xuICAgICAgY2FsbGJhY2tzID0ge307XG4gICAgICByZXR1cm4gY2FsbGJhY2tzXG4gICAgfVxuXG4gICAgaWYgKCFjYWxsYmFja3NbbmFtZV0pIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICBpZiAoZm4pIHtcbiAgICAgIGlmICh0eXBlb2YgZm4gIT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignU2Vjb25kIGFyZ3VtZW50IGZvciBcIm9mZlwiIG1ldGhvZCBtdXN0IGJlIGEgZnVuY3Rpb24uJyk7XG4gICAgICB9XG5cbiAgICAgIGNhbGxiYWNrc1tuYW1lXSA9IGNhbGxiYWNrc1tuYW1lXS5tYXAoZnVuY3Rpb24oZm0sIGkpIHtcbiAgICAgICAgaWYgKGZtID09PSBmbikge1xuICAgICAgICAgIGNhbGxiYWNrc1tuYW1lXS5zcGxpY2UoaSwgMSk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICBkZWxldGUgY2FsbGJhY2tzW25hbWVdO1xuICAgIH1cbiAgfTtcblxuICBlbC5lbWl0ID0gZnVuY3Rpb24obmFtZSAvKiwgYXJncyAqLykge1xuICAgIGlmICghY2FsbGJhY2tzW25hbWVdIHx8ICFjYWxsYmFja3NbbmFtZV0ubGVuZ3RoKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgYXJncyA9IFtdLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcblxuICAgIGNhbGxiYWNrc1tuYW1lXS5mb3JFYWNoKGZ1bmN0aW9uKGZuLCBpKSB7XG4gICAgICBpZiAoZm4pIHtcbiAgICAgICAgZm4uYXBwbHkoZm4sIGFyZ3MpO1xuICAgICAgICBpZiAoZm4ub25lKSB7XG4gICAgICAgICAgY2FsbGJhY2tzW25hbWVdLnNwbGljZShpLCAxKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0pO1xuXG4gICAgcmV0dXJuIGVsO1xuICB9O1xuXG4gIHJldHVybiBlbDtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBPYnNlcnZhYmxlO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG5jb25zdCBPYnNlcnZhYmxlID0gcmVxdWlyZSgnLi9PYnNlcnZhYmxlJyk7XG5jb25zdCBhcnJheUJ1ZmZlclRvQXVkaW9CdWZmZXIgPSByZXF1aXJlKCcuL3V0aWxzL2FycmF5QnVmZmVyVG9BdWRpb0J1ZmZlcicpO1xuY29uc3QgdG9TdHJpbmcgPSBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nO1xuXG5jbGFzcyBQbGF5ZXIge1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICB3aW5kb3cuQXVkaW9Db250ZXh0ID0gd2luZG93LkF1ZGlvQ29udGV4dCB8fCB3aW5kb3cud2Via2l0QXVkaW9Db250ZXh0O1xuXG4gICAgdGhpcy5fcXVldWUgPSBbXTtcbiAgICB0aGlzLl9jdXJyZW50U291cmNlID0gbnVsbDtcbiAgICB0aGlzLl9jdXJyZW50QnVmZmVyID0gbnVsbDtcbiAgICB0aGlzLl9jb250ZXh0ID0gbmV3IEF1ZGlvQ29udGV4dCgpO1xuXG4gICAgT2JzZXJ2YWJsZSh0aGlzKTtcbiAgfVxuXG4gIF9sb2codHlwZSwgbWVzc2FnZSkge1xuICAgIGlmICh0eXBlICYmICFtZXNzYWdlKSB7XG4gICAgICBtZXNzYWdlID0gdHlwZTtcbiAgICAgIHR5cGUgPSAnbG9nJztcbiAgICB9XG5cbiAgICBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgIHRoaXMuZW1pdChQbGF5ZXIuRXZlbnRUeXBlcy5MT0csIG1lc3NhZ2UpO1xuICAgIH0sIDApO1xuXG4gICAgaWYgKHRoaXMuX2RlYnVnKSB7XG4gICAgICBjb25zb2xlW3R5cGVdKG1lc3NhZ2UpO1xuICAgIH1cbiAgfVxuXG4gIGVtcHR5UXVldWUoKSB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgIHRoaXMuX3F1ZXVlID0gW107XG4gICAgICB0aGlzLl9hdWRpbyA9IG51bGw7XG4gICAgICB0aGlzLl9jdXJyZW50QnVmZmVyID0gbnVsbDtcbiAgICAgIHRoaXMuX2N1cnJlbnRTb3VyY2UgPSBudWxsO1xuICAgICAgcmVzb2x2ZSgpO1xuICAgIH0pO1xuICB9XG5cbiAgZW5xdWV1ZShpdGVtKSB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgIGlmICghaXRlbSkge1xuICAgICAgICBjb25zdCBlcnJvciA9IG5ldyBFcnJvcignYXJndW1lbnQgY2Fubm90IGJlIGVtcHR5LicpO1xuICAgICAgICB0aGlzLl9sb2coZXJyb3IpO1xuICAgICAgICByZXR1cm4gcmVqZWN0KGVycm9yKTtcbiAgICAgIH1cblxuICAgICAgY29uc3Qgc3RyaW5nVHlwZSA9IHRvU3RyaW5nLmNhbGwoaXRlbSkucmVwbGFjZSgvXFxbLipcXHMoXFx3KylcXF0vLCAnJDEnKTtcblxuICAgICAgY29uc3QgcHJvY2VlZCA9IChhdWRpb0J1ZmZlcikgPT4ge1xuICAgICAgICB0aGlzLl9xdWV1ZS5wdXNoKGF1ZGlvQnVmZmVyKTtcbiAgICAgICAgdGhpcy5fbG9nKCdFbnF1ZXVlIGF1ZGlvJyk7XG4gICAgICAgIHRoaXMuZW1pdChQbGF5ZXIuRXZlbnRUeXBlcy5FTlFVRVVFKTtcbiAgICAgICAgcmV0dXJuIHJlc29sdmUoYXVkaW9CdWZmZXIpO1xuICAgICAgfTtcblxuICAgICAgaWYgKHN0cmluZ1R5cGUgPT09ICdEYXRhVmlldycgfHwgc3RyaW5nVHlwZSA9PT0gJ1VpbnQ4QXJyYXknKSB7XG4gICAgICAgIHJldHVybiBhcnJheUJ1ZmZlclRvQXVkaW9CdWZmZXIoaXRlbS5idWZmZXIsIHRoaXMuX2NvbnRleHQpXG4gICAgICAgIC50aGVuKHByb2NlZWQpO1xuICAgICAgfSBlbHNlIGlmIChzdHJpbmdUeXBlID09PSAnQXVkaW9CdWZmZXInKSB7XG4gICAgICAgIHJldHVybiBwcm9jZWVkKGl0ZW0pO1xuICAgICAgfSBlbHNlIGlmIChzdHJpbmdUeXBlID09PSAnQXJyYXlCdWZmZXInKSB7XG4gICAgICAgIHJldHVybiBhcnJheUJ1ZmZlclRvQXVkaW9CdWZmZXIoaXRlbSwgdGhpcy5fY29udGV4dClcbiAgICAgICAgLnRoZW4ocHJvY2VlZCk7XG4gICAgICB9IGVsc2UgaWYgKHN0cmluZ1R5cGUgPT09ICdTdHJpbmcnKSB7XG4gICAgICAgIHJldHVybiBwcm9jZWVkKGl0ZW0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uc3QgZXJyb3IgPSBuZXcgRXJyb3IoJ0ludmFsaWQgdHlwZS4nKTtcbiAgICAgICAgdGhpcy5lbWl0KCdlcnJvcicsIGVycm9yKTtcbiAgICAgICAgcmV0dXJuIHJlamVjdChlcnJvcik7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICBkZXF1ZSgpIHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgY29uc3QgaXRlbSA9IHRoaXMuX3F1ZXVlLnNoaWZ0KCk7XG5cbiAgICAgIGlmIChpdGVtKSB7XG4gICAgICAgIHRoaXMuX2xvZygnRGVxdWUgYXVkaW8nKTtcbiAgICAgICAgdGhpcy5lbWl0KFBsYXllci5FdmVudFR5cGVzLkRFUVVFKTtcbiAgICAgICAgcmV0dXJuIHJlc29sdmUoaXRlbSk7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiByZWplY3QoKTtcbiAgICB9KTtcbiAgfVxuXG4gIHBsYXkoKSB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgIGlmICh0aGlzLl9jb250ZXh0LnN0YXRlID09PSAnc3VzcGVuZGVkJykge1xuICAgICAgICB0aGlzLl9jb250ZXh0LnJlc3VtZSgpO1xuXG4gICAgICAgIHRoaXMuX2xvZygnUGxheSBhdWRpbycpO1xuICAgICAgICB0aGlzLmVtaXQoUGxheWVyLkV2ZW50VHlwZXMuUExBWSk7XG4gICAgICAgIHJlc29sdmUoKTtcbiAgICAgIH0gZWxzZSBpZiAodGhpcy5fYXVkaW8gJiYgdGhpcy5fYXVkaW8ucGF1c2VkKSB7XG4gICAgICAgIHRoaXMuX2xvZygnUGxheSBhdWRpbycpO1xuICAgICAgICB0aGlzLmVtaXQoUGxheWVyLkV2ZW50VHlwZXMuUExBWSk7XG4gICAgICAgIHRoaXMuX2F1ZGlvLnBsYXkoKTtcbiAgICAgICAgcmVzb2x2ZSgpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZGVxdWUoKVxuICAgICAgICAudGhlbihhdWRpb0J1ZmZlciA9PiB7XG4gICAgICAgICAgdGhpcy5fbG9nKCdQbGF5IGF1ZGlvJyk7XG4gICAgICAgICAgdGhpcy5lbWl0KFBsYXllci5FdmVudFR5cGVzLlBMQVkpO1xuICAgICAgICAgIGlmICh0eXBlb2YgYXVkaW9CdWZmZXIgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5wbGF5VXJsKGF1ZGlvQnVmZmVyKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0dXJuIHRoaXMucGxheUF1ZGlvQnVmZmVyKGF1ZGlvQnVmZmVyKTtcbiAgICAgICAgfSkudGhlbihyZXNvbHZlKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIHBsYXlRdWV1ZSgpIHtcbiAgICByZXR1cm4gdGhpcy5wbGF5KCkudGhlbigoKSA9PiB7XG4gICAgICBpZiAodGhpcy5fcXVldWUubGVuZ3RoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnBsYXlRdWV1ZSgpO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgc3RvcCgpIHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICBpZiAodGhpcy5fY3VycmVudFNvdXJjZSkge1xuICAgICAgICAgIHRoaXMuX2N1cnJlbnRTb3VyY2Uub25lbmRlZCA9IGZ1bmN0aW9uKCkge307XG4gICAgICAgICAgdGhpcy5fY3VycmVudFNvdXJjZS5zdG9wKCk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5fYXVkaW8pIHtcbiAgICAgICAgICB0aGlzLl9hdWRpby5vbmVuZGVkID0gZnVuY3Rpb24oKSB7fTtcbiAgICAgICAgICB0aGlzLl9hdWRpby5jdXJyZW50VGltZSA9IDA7XG4gICAgICAgICAgdGhpcy5fYXVkaW8ucGF1c2UoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX2xvZygnU3RvcCBhdWRpbycpO1xuICAgICAgICB0aGlzLmVtaXQoUGxheWVyLkV2ZW50VHlwZXMuU1RPUCk7XG4gICAgfSk7XG4gIH1cblxuICBwYXVzZSgpIHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICBpZiAodGhpcy5fY3VycmVudFNvdXJjZSAmJiB0aGlzLl9jb250ZXh0LnN0YXRlID09PSAncnVubmluZycpIHtcbiAgICAgICAgICB0aGlzLl9jb250ZXh0LnN1c3BlbmQoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLl9hdWRpbykge1xuICAgICAgICAgIHRoaXMuX2F1ZGlvLnBhdXNlKCk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9sb2coJ1BhdXNlIGF1ZGlvJyk7XG4gICAgICAgIHRoaXMuZW1pdChQbGF5ZXIuRXZlbnRUeXBlcy5QQVVTRSk7XG4gICAgfSk7XG4gIH1cblxuICByZXBsYXkoKSB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgaWYgKHRoaXMuX2N1cnJlbnRCdWZmZXIpIHtcbiAgICAgICAgICB0aGlzLl9sb2coJ1JlcGxheSBhdWRpbycpO1xuICAgICAgICAgIHRoaXMuZW1pdChQbGF5ZXIuRXZlbnRUeXBlcy5SRVBMQVkpO1xuXG4gICAgICAgICAgaWYgKHRoaXMuX2NvbnRleHQuc3RhdGUgPT09ICdzdXNwZW5kZWQnKSB7XG4gICAgICAgICAgICB0aGlzLl9jb250ZXh0LnJlc3VtZSgpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGlmICh0aGlzLl9jdXJyZW50U291cmNlKSB7XG4gICAgICAgICAgICB0aGlzLl9jdXJyZW50U291cmNlLnN0b3AoKTtcbiAgICAgICAgICAgIHRoaXMuX2N1cnJlbnRTb3VyY2Uub25lbmRlZCA9IGZ1bmN0aW9uKCkge307XG4gICAgICAgICAgfVxuICAgICAgICAgIHJldHVybiB0aGlzLnBsYXlBdWRpb0J1ZmZlcih0aGlzLl9jdXJyZW50QnVmZmVyKTtcbiAgICAgICAgfSBlbHNlIGlmICh0aGlzLl9hdWRpbykge1xuICAgICAgICAgIHRoaXMuX2xvZygnUmVwbGF5IGF1ZGlvJyk7XG4gICAgICAgICAgdGhpcy5lbWl0KFBsYXllci5FdmVudFR5cGVzLlJFUExBWSk7XG4gICAgICAgICAgcmV0dXJuIHRoaXMucGxheVVybCh0aGlzLl9hdWRpby5zcmMpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGNvbnN0IGVycm9yID0gbmV3IEVycm9yKCdObyBhdWRpbyBzb3VyY2UgbG9hZGVkLicpO1xuICAgICAgICAgIHRoaXMuZW1pdCgnZXJyb3InLCBlcnJvcilcbiAgICAgICAgICByZWplY3QoKTtcbiAgICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgcGxheUJsb2IoYmxvYikge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICBpZiAoIWJsb2IpIHtcbiAgICAgICAgcmVqZWN0KCk7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IG9iamVjdFVybCA9IFVSTC5jcmVhdGVPYmplY3RVUkwoYmxvYik7XG4gICAgICBjb25zdCBhdWRpbyA9IG5ldyBBdWRpbygpO1xuICAgICAgYXVkaW8uc3JjID0gb2JqZWN0VXJsO1xuICAgICAgdGhpcy5fY3VycmVudEJ1ZmZlciA9IG51bGw7XG4gICAgICB0aGlzLl9jdXJyZW50U291cmNlID0gbnVsbDtcbiAgICAgIHRoaXMuX2F1ZGlvID0gYXVkaW87XG5cbiAgICAgIGF1ZGlvLm9uZW5kZWQgPSAoKSA9PiB7XG4gICAgICAgIHRoaXMuX2xvZygnQXVkaW8gZW5kZWQnKTtcbiAgICAgICAgdGhpcy5lbWl0KFBsYXllci5FdmVudFR5cGVzLkVOREVEKTtcbiAgICAgICAgcmVzb2x2ZSgpO1xuICAgICAgfTtcblxuICAgICAgYXVkaW8ub25lcnJvciA9IChlcnJvcikgPT4ge1xuICAgICAgICB0aGlzLmVtaXQoJ2Vycm9yJywgZXJyb3IpO1xuICAgICAgICByZWplY3QoZXJyb3IpO1xuICAgICAgfTtcblxuICAgICAgYXVkaW8ub25sb2FkID0gKGV2ZW50KSA9PiB7XG4gICAgICAgIFVSTC5yZXZva2VPYmplY3RVcmwob2JqZWN0VXJsKTtcbiAgICAgIH07XG5cbiAgICAgIGF1ZGlvLnBsYXkoKTtcbiAgICB9KTtcbiAgfVxuXG4gIHBsYXlBdWRpb0J1ZmZlcihidWZmZXIpIHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgaWYgKCFidWZmZXIpIHtcbiAgICAgICAgcmVqZWN0KCk7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IHNvdXJjZSA9IHRoaXMuX2NvbnRleHQuY3JlYXRlQnVmZmVyU291cmNlKCk7XG4gICAgICBzb3VyY2UuYnVmZmVyID0gYnVmZmVyO1xuICAgICAgc291cmNlLmNvbm5lY3QodGhpcy5fY29udGV4dC5kZXN0aW5hdGlvbik7XG4gICAgICBzb3VyY2Uuc3RhcnQoMCk7XG4gICAgICB0aGlzLl9jdXJyZW50QnVmZmVyID0gYnVmZmVyO1xuICAgICAgdGhpcy5fY3VycmVudFNvdXJjZSA9IHNvdXJjZTtcbiAgICAgIHRoaXMuX2F1ZGlvID0gbnVsbDtcblxuICAgICAgc291cmNlLm9uZW5kZWQgPSAoZXZlbnQpID0+IHtcbiAgICAgICAgdGhpcy5fbG9nKCdBdWRpbyBlbmRlZCcpO1xuICAgICAgICB0aGlzLmVtaXQoUGxheWVyLkV2ZW50VHlwZXMuRU5ERUQpO1xuICAgICAgICByZXNvbHZlKCk7XG4gICAgICB9O1xuXG4gICAgICBzb3VyY2Uub25lcnJvciA9IChlcnJvcikgPT4ge1xuICAgICAgICB0aGlzLmVtaXQoJ2Vycm9yJywgZXJyb3IpO1xuICAgICAgICByZWplY3QoZXJyb3IpO1xuICAgICAgfTtcbiAgICB9KTtcbiAgfVxuXG4gIHBsYXlVcmwodXJsKSB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgIGNvbnN0IGF1ZGlvID0gbmV3IEF1ZGlvKCk7XG4gICAgICBhdWRpby5zcmMgPSB1cmw7XG4gICAgICB0aGlzLl9jdXJyZW50QnVmZmVyID0gbnVsbDtcbiAgICAgIHRoaXMuX2N1cnJlbnRTb3VyY2UgPSBudWxsO1xuICAgICAgdGhpcy5fYXVkaW8gPSBhdWRpbztcblxuICAgICAgYXVkaW8ub25lbmRlZCA9IChldmVudCkgPT4ge1xuICAgICAgICB0aGlzLl9sb2coJ0F1ZGlvIGVuZGVkJyk7XG4gICAgICAgIHRoaXMuZW1pdChQbGF5ZXIuRXZlbnRUeXBlcy5FTkRFRCk7XG4gICAgICAgIHJlc29sdmUoKTtcbiAgICAgIH07XG5cbiAgICAgIGF1ZGlvLm9uZXJyb3IgPSAoZXJyb3IpID0+IHtcbiAgICAgICAgdGhpcy5lbWl0KCdlcnJvcicsIGVycm9yKTtcbiAgICAgICAgcmVqZWN0KGVycm9yKTtcbiAgICAgIH07XG5cbiAgICAgIGF1ZGlvLnBsYXkoKTtcbiAgICB9KTtcbiAgfVxuXG4gIHN0YXRpYyBnZXQgRXZlbnRUeXBlcygpIHtcbiAgICByZXR1cm4ge1xuICAgICAgTE9HOiAnbG9nJyxcbiAgICAgIEVSUk9SOiAnZXJyb3InLFxuICAgICAgUExBWTogJ3BsYXknLFxuICAgICAgUkVQTEFZOiAncmVwbGF5JyxcbiAgICAgIFBBVVNFOiAncGF1c2UnLFxuICAgICAgU1RPUDogJ3BhdXNlJyxcbiAgICAgIEVOUVVFVUU6ICdlbnF1ZXVlJyxcbiAgICAgIERFUVVFOiAnZGVxdWUnXG4gICAgfTtcbiAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IFBsYXllcjtcbiIsIid1c2Ugc3RyaWN0JztcblxuZnVuY3Rpb24gYXJyYXlCdWZmZXJUb0F1ZGlvQnVmZmVyKGFycmF5QnVmZmVyLCBjb250ZXh0KSB7XG4gIHdpbmRvdy5BdWRpb0NvbnRleHQgPSB3aW5kb3cuQXVkaW9Db250ZXh0IHx8IHdpbmRvdy53ZWJraXRBdWRpb0NvbnRleHQ7XG5cbiAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICBpZiAoY29udGV4dCkge1xuICAgICAgaWYgKE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChjb250ZXh0KSAhPT0gJ1tvYmplY3QgQXVkaW9Db250ZXh0XScpIHtcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignYGNvbnRleHRgIG11c3QgYmUgYW4gQXVkaW9Db250ZXh0Jyk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnRleHQgPSBuZXcgQXVkaW9Db250ZXh0KCk7XG4gICAgfVxuXG4gICAgY29udGV4dC5kZWNvZGVBdWRpb0RhdGEoYXJyYXlCdWZmZXIsIChkYXRhKSA9PiB7XG4gICAgICByZXNvbHZlKGRhdGEpO1xuICAgIH0sIHJlamVjdCk7XG4gIH0pO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGFycmF5QnVmZmVyVG9BdWRpb0J1ZmZlcjtcbiIsIid1c2Ugc3RyaWN0JztcblxuLyoqXG4gKiBAY3JlZGl0IGh0dHBzOi8vZGV2ZWxvcGVycy5nb29nbGUuY29tL3dlYi91cGRhdGVzLzIwMTIvMDYvSG93LXRvLWNvbnZlcnQtQXJyYXlCdWZmZXItdG8tYW5kLWZyb20tU3RyaW5nP2hsPWVuXG4gKi9cbmZ1bmN0aW9uIGFycmF5QnVmZmVyVG9TdHJpbmcoYnVmZmVyKSB7XG4gIHJldHVybiBTdHJpbmcuZnJvbUNoYXJDb2RlLmFwcGx5KG51bGwsIG5ldyBVaW50MTZBcnJheShidWZmZXIpKTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBhcnJheUJ1ZmZlclRvU3RyaW5nO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG4vKipcbiAqIEBjcmVkaXQgaHR0cDovL3N0YWNrb3ZlcmZsb3cuY29tL2EvMjYyNDUyNjBcbiAqL1xuZnVuY3Rpb24gZG93bnNhbXBsZUJ1ZmZlcihidWZmZXIsIGlucHV0U2FtcGxlUmF0ZSwgb3V0cHV0U2FtcGxlUmF0ZSkge1xuICBpZiAoaW5wdXRTYW1wbGVSYXRlID09PSBvdXRwdXRTYW1wbGVSYXRlKSB7XG4gICAgcmV0dXJuIGJ1ZmZlcjtcbiAgfVxuXG4gIGlmIChpbnB1dFNhbXBsZVJhdGUgPCBvdXRwdXRTYW1wbGVSYXRlKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdPdXRwdXQgc2FtcGxlIHJhdGUgbXVzdCBiZSBsZXNzIHRoYW4gaW5wdXQgc2FtcGxlIHJhdGUuJyk7XG4gIH1cblxuICBjb25zdCBzYW1wbGVSYXRlUmF0aW8gPSBpbnB1dFNhbXBsZVJhdGUgLyBvdXRwdXRTYW1wbGVSYXRlO1xuICBjb25zdCBuZXdMZW5ndGggPSBNYXRoLnJvdW5kKGJ1ZmZlci5sZW5ndGggLyBzYW1wbGVSYXRlUmF0aW8pO1xuICBsZXQgcmVzdWx0ID0gbmV3IEZsb2F0MzJBcnJheShuZXdMZW5ndGgpO1xuICBsZXQgb2Zmc2V0UmVzdWx0ID0gMDtcbiAgbGV0IG9mZnNldEJ1ZmZlciA9IDA7XG5cbiAgd2hpbGUgKG9mZnNldFJlc3VsdCA8IHJlc3VsdC5sZW5ndGgpIHtcbiAgICBsZXQgbmV4dE9mZnNldEJ1ZmZlciA9IE1hdGgucm91bmQoKG9mZnNldFJlc3VsdCArIDEpICogc2FtcGxlUmF0ZVJhdGlvKTtcbiAgICBsZXQgYWNjdW0gPSAwO1xuICAgIGxldCBjb3VudCA9IDA7XG5cbiAgICBmb3IgKHZhciBpID0gb2Zmc2V0QnVmZmVyOyBpIDwgbmV4dE9mZnNldEJ1ZmZlciAmJiBpIDwgYnVmZmVyLmxlbmd0aDsgaSsrKSB7XG4gICAgICBhY2N1bSArPSBidWZmZXJbaV07XG4gICAgICBjb3VudCsrO1xuICAgIH1cblxuICAgIHJlc3VsdFtvZmZzZXRSZXN1bHRdID0gYWNjdW0gLyBjb3VudDtcbiAgICBvZmZzZXRSZXN1bHQrKztcbiAgICBvZmZzZXRCdWZmZXIgPSBuZXh0T2Zmc2V0QnVmZmVyO1xuICB9XG5cbiAgcmV0dXJuIHJlc3VsdDtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBkb3duc2FtcGxlQnVmZmVyO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG4vKipcbiAqIEBjcmVkaXQgaHR0cHM6Ly9naXRodWIuY29tL21hdHRkaWFtb25kL1JlY29yZGVyanNcbiAqL1xuZnVuY3Rpb24gaW50ZXJsZWF2ZShsZWZ0Q2hhbm5lbCwgcmlnaHRDaGFubmVsKSB7XG4gIGlmIChsZWZ0Q2hhbm5lbCAmJiAhcmlnaHRDaGFubmVsKSB7XG4gICAgcmV0dXJuIGxlZnRDaGFubmVsO1xuICB9XG5cbiAgY29uc3QgbGVuZ3RoID0gbGVmdENoYW5uZWwubGVuZ3RoICsgcmlnaHRDaGFubmVsLmxlbmd0aDtcbiAgbGV0IHJlc3VsdCA9IG5ldyBGbG9hdDMyQXJyYXkobGVuZ3RoKTtcbiAgbGV0IGlucHV0SW5kZXggPSAwO1xuXG4gIGZvciAobGV0IGluZGV4ID0gMDsgaW5kZXggPCBsZW5ndGg7ICl7XG4gICAgcmVzdWx0W2luZGV4KytdID0gbGVmdENoYW5uZWxbaW5wdXRJbmRleF07XG4gICAgcmVzdWx0W2luZGV4KytdID0gcmlnaHRDaGFubmVsW2lucHV0SW5kZXhdO1xuICAgIGlucHV0SW5kZXgrKztcbiAgfVxuXG4gIHJldHVybiByZXN1bHQ7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gaW50ZXJsZWF2ZTtcbiIsIid1c2Ugc3RyaWN0JztcblxuLyoqXG4gKiBAY3JlZGl0IGh0dHBzOi8vZ2l0aHViLmNvbS9tYXR0ZGlhbW9uZC9SZWNvcmRlcmpzXG4gKi9cbmZ1bmN0aW9uIG1lcmdlQnVmZmVycyhjaGFubmVsQnVmZmVyLCByZWNvcmRpbmdMZW5ndGgpe1xuICBjb25zdCByZXN1bHQgPSBuZXcgRmxvYXQzMkFycmF5KHJlY29yZGluZ0xlbmd0aCk7XG4gIGNvbnN0IGxlbmd0aCA9IGNoYW5uZWxCdWZmZXIubGVuZ3RoO1xuICBsZXQgb2Zmc2V0ID0gMDtcblxuICBmb3IgKGxldCBpID0gMDsgaSA8IGxlbmd0aDsgaSsrKXtcbiAgICBsZXQgYnVmZmVyID0gY2hhbm5lbEJ1ZmZlcltpXTtcblxuICAgIHJlc3VsdC5zZXQoYnVmZmVyLCBvZmZzZXQpO1xuICAgIG9mZnNldCArPSBidWZmZXIubGVuZ3RoO1xuICB9XG5cbiAgcmV0dXJuIHJlc3VsdDtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBtZXJnZUJ1ZmZlcnM7XG4iLCIndXNlIHN0cmljdCc7XG5cbi8qKlxuICogQGNyZWRpdCBodHRwczovL2dpdGh1Yi5jb20vbWF0dGRpYW1vbmQvUmVjb3JkZXJqc1xuICovXG5mdW5jdGlvbiB3cml0ZVVURkJ5dGVzKHZpZXcsIG9mZnNldCwgc3RyaW5nKSB7XG4gIGNvbnN0IGxlbmd0aCA9IHN0cmluZy5sZW5ndGg7XG5cbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBsZW5ndGg7IGkrKyl7XG4gICAgdmlldy5zZXRVaW50OChvZmZzZXQgKyBpLCBzdHJpbmcuY2hhckNvZGVBdChpKSk7XG4gIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSB3cml0ZVVURkJ5dGVzO1xuIiwiKGZ1bmN0aW9uKHJvb3QpIHtcbiAgJ3VzZSBzdHJpY3QnO1xuXG4gIGZ1bmN0aW9uIGh0dHBNZXNzYWdlUGFyc2VyKG1lc3NhZ2UpIHtcbiAgICBjb25zdCByZXN1bHQgPSB7XG4gICAgICBodHRwVmVyc2lvbjogbnVsbCxcbiAgICAgIHN0YXR1c0NvZGU6IG51bGwsXG4gICAgICBzdGF0dXNNZXNzYWdlOiBudWxsLFxuICAgICAgbWV0aG9kOiBudWxsLFxuICAgICAgdXJsOiBudWxsLFxuICAgICAgaGVhZGVyczogbnVsbCxcbiAgICAgIGJvZHk6IG51bGwsXG4gICAgICBib3VuZGFyeTogbnVsbCxcbiAgICAgIG11bHRpcGFydDogbnVsbFxuICAgIH07XG5cbiAgICB2YXIgbWVzc2FnZVN0cmluZyA9ICcnO1xuICAgIHZhciBoZWFkZXJOZXdsaW5lSW5kZXggPSAwO1xuICAgIHZhciBmdWxsQm91bmRhcnkgPSBudWxsO1xuXG4gICAgaWYgKGh0dHBNZXNzYWdlUGFyc2VyLl9pc0J1ZmZlcihtZXNzYWdlKSkge1xuICAgICAgbWVzc2FnZVN0cmluZyA9IG1lc3NhZ2UudG9TdHJpbmcoKTtcbiAgICB9IGVsc2UgaWYgKHR5cGVvZiBtZXNzYWdlID09PSAnc3RyaW5nJykge1xuICAgICAgbWVzc2FnZVN0cmluZyA9IG1lc3NhZ2U7XG4gICAgICBtZXNzYWdlID0gaHR0cE1lc3NhZ2VQYXJzZXIuX2NyZWF0ZUJ1ZmZlcihtZXNzYWdlU3RyaW5nKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9XG5cbiAgICAvKlxuICAgICAqIFN0cmlwIGV4dHJhIHJldHVybiBjaGFyYWN0ZXJzXG4gICAgICovXG4gICAgbWVzc2FnZVN0cmluZyA9IG1lc3NhZ2VTdHJpbmcucmVwbGFjZSgvXFxyXFxuL2dpbSwgJ1xcbicpO1xuXG4gICAgLypcbiAgICAgKiBUcmltIGxlYWRpbmcgd2hpdGVzcGFjZVxuICAgICAqL1xuICAgIChmdW5jdGlvbigpIHtcbiAgICAgIGNvbnN0IGZpcnN0Tm9uV2hpdGVzcGFjZVJlZ2V4ID0gL1tcXHctXSsvZ2ltO1xuICAgICAgY29uc3QgZmlyc3ROb25XaGl0ZXNwYWNlSW5kZXggPSBtZXNzYWdlU3RyaW5nLnNlYXJjaChmaXJzdE5vbldoaXRlc3BhY2VSZWdleCk7XG4gICAgICBpZiAoZmlyc3ROb25XaGl0ZXNwYWNlSW5kZXggPiAwKSB7XG4gICAgICAgIG1lc3NhZ2UgPSBtZXNzYWdlLnNsaWNlKGZpcnN0Tm9uV2hpdGVzcGFjZUluZGV4LCBtZXNzYWdlLmxlbmd0aCk7XG4gICAgICAgIG1lc3NhZ2VTdHJpbmcgPSBtZXNzYWdlLnRvU3RyaW5nKCk7XG4gICAgICB9XG4gICAgfSkoKTtcblxuICAgIC8qIFBhcnNlIHJlcXVlc3QgbGluZVxuICAgICAqL1xuICAgIChmdW5jdGlvbigpIHtcbiAgICAgIGNvbnN0IHBvc3NpYmxlUmVxdWVzdExpbmUgPSBtZXNzYWdlU3RyaW5nLnNwbGl0KC9cXG58XFxyXFxuLylbMF07XG4gICAgICBjb25zdCByZXF1ZXN0TGluZU1hdGNoID0gcG9zc2libGVSZXF1ZXN0TGluZS5tYXRjaChodHRwTWVzc2FnZVBhcnNlci5fcmVxdWVzdExpbmVSZWdleCk7XG5cbiAgICAgIGlmIChBcnJheS5pc0FycmF5KHJlcXVlc3RMaW5lTWF0Y2gpICYmIHJlcXVlc3RMaW5lTWF0Y2gubGVuZ3RoID4gMSkge1xuICAgICAgICByZXN1bHQuaHR0cFZlcnNpb24gPSBwYXJzZUZsb2F0KHJlcXVlc3RMaW5lTWF0Y2hbMV0pO1xuICAgICAgICByZXN1bHQuc3RhdHVzQ29kZSA9IHBhcnNlSW50KHJlcXVlc3RMaW5lTWF0Y2hbMl0pO1xuICAgICAgICByZXN1bHQuc3RhdHVzTWVzc2FnZSA9IHJlcXVlc3RMaW5lTWF0Y2hbM107XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb25zdCByZXNwb25zZUxpbmVNYXRoID0gcG9zc2libGVSZXF1ZXN0TGluZS5tYXRjaChodHRwTWVzc2FnZVBhcnNlci5fcmVzcG9uc2VMaW5lUmVnZXgpO1xuICAgICAgICBpZiAoQXJyYXkuaXNBcnJheShyZXNwb25zZUxpbmVNYXRoKSAmJiByZXNwb25zZUxpbmVNYXRoLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgICByZXN1bHQubWV0aG9kID0gcmVzcG9uc2VMaW5lTWF0aFsxXTtcbiAgICAgICAgICByZXN1bHQudXJsID0gcmVzcG9uc2VMaW5lTWF0aFsyXTtcbiAgICAgICAgICByZXN1bHQuaHR0cFZlcnNpb24gPSBwYXJzZUZsb2F0KHJlc3BvbnNlTGluZU1hdGhbM10pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSkoKTtcblxuICAgIC8qIFBhcnNlIGhlYWRlcnNcbiAgICAgKi9cbiAgICAoZnVuY3Rpb24oKSB7XG4gICAgICBoZWFkZXJOZXdsaW5lSW5kZXggPSBtZXNzYWdlU3RyaW5nLnNlYXJjaChodHRwTWVzc2FnZVBhcnNlci5faGVhZGVyTmV3bGluZVJlZ2V4KTtcbiAgICAgIGlmIChoZWFkZXJOZXdsaW5lSW5kZXggPiAtMSkge1xuICAgICAgICBoZWFkZXJOZXdsaW5lSW5kZXggPSBoZWFkZXJOZXdsaW5lSW5kZXggKyAxOyAvLyAxIGZvciBuZXdsaW5lIGxlbmd0aFxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLyogVGhlcmUncyBubyBsaW5lIGJyZWFrcyBzbyBjaGVjayBpZiByZXF1ZXN0IGxpbmUgZXhpc3RzXG4gICAgICAgICAqIGJlY2F1c2UgdGhlIG1lc3NhZ2UgbWlnaHQgYmUgYWxsIGhlYWRlcnMgYW5kIG5vIGJvZHlcbiAgICAgICAgICovXG4gICAgICAgIGlmIChyZXN1bHQuaHR0cFZlcnNpb24pIHtcbiAgICAgICAgICBoZWFkZXJOZXdsaW5lSW5kZXggPSBtZXNzYWdlU3RyaW5nLmxlbmd0aDtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBjb25zdCBoZWFkZXJzU3RyaW5nID0gbWVzc2FnZVN0cmluZy5zdWJzdHIoMCwgaGVhZGVyTmV3bGluZUluZGV4KTtcbiAgICAgIGNvbnN0IGhlYWRlcnMgPSBodHRwTWVzc2FnZVBhcnNlci5fcGFyc2VIZWFkZXJzKGhlYWRlcnNTdHJpbmcpO1xuXG4gICAgICBpZiAoT2JqZWN0LmtleXMoaGVhZGVycykubGVuZ3RoID4gMCkge1xuICAgICAgICByZXN1bHQuaGVhZGVycyA9IGhlYWRlcnM7XG5cbiAgICAgICAgLy8gVE9PRDogZXh0cmFjdCBib3VuZGFyeS5cbiAgICAgIH1cbiAgICB9KSgpO1xuXG4gICAgLyogVHJ5IHRvIGdldCBib3VuZGFyeSBpZiBubyBib3VuZGFyeSBoZWFkZXJcbiAgICAgKi9cbiAgICAoZnVuY3Rpb24oKSB7XG4gICAgICBpZiAoIXJlc3VsdC5ib3VuZGFyeSkge1xuICAgICAgICBjb25zdCBib3VuZGFyeU1hdGNoID0gbWVzc2FnZVN0cmluZy5tYXRjaChodHRwTWVzc2FnZVBhcnNlci5fYm91bmRhcnlSZWdleCk7XG5cbiAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkoYm91bmRhcnlNYXRjaCkgJiYgYm91bmRhcnlNYXRjaC5sZW5ndGgpIHtcbiAgICAgICAgICBmdWxsQm91bmRhcnkgPSBib3VuZGFyeU1hdGNoWzBdLnJlcGxhY2UoL1tcXHJcXG5dKy9naSwgJycpO1xuICAgICAgICAgIGNvbnN0IGJvdW5kYXJ5ID0gZnVsbEJvdW5kYXJ5LnJlcGxhY2UoL14tLS8sJycpO1xuICAgICAgICAgIHJlc3VsdC5ib3VuZGFyeSA9IGJvdW5kYXJ5O1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSkoKTtcblxuICAgIC8qIFBhcnNlIGJvZHlcbiAgICAgKi9cbiAgICAoZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgc3RhcnQgPSBoZWFkZXJOZXdsaW5lSW5kZXg7XG4gICAgICB2YXIgZW5kID0gbWVzc2FnZS5sZW5ndGg7XG4gICAgICBjb25zdCBmaXJzdEJvdW5kYXJ5SW5kZXggPSBtZXNzYWdlU3RyaW5nLmluZGV4T2YoZnVsbEJvdW5kYXJ5KTtcblxuICAgICAgaWYgKGZpcnN0Qm91bmRhcnlJbmRleCA+IC0xKSB7XG4gICAgICAgIHN0YXJ0ID0gaGVhZGVyTmV3bGluZUluZGV4O1xuICAgICAgICBlbmQgPSBmaXJzdEJvdW5kYXJ5SW5kZXg7XG4gICAgICB9XG5cbiAgICAgIGlmIChoZWFkZXJOZXdsaW5lSW5kZXggPiAtMSkge1xuICAgICAgICBjb25zdCBib2R5ID0gbWVzc2FnZS5zbGljZShzdGFydCwgZW5kKTtcblxuICAgICAgICBpZiAoYm9keSAmJiBib2R5Lmxlbmd0aCkge1xuICAgICAgICAgIHJlc3VsdC5ib2R5ID0gaHR0cE1lc3NhZ2VQYXJzZXIuX2lzRmFrZUJ1ZmZlcihib2R5KSA/IGJvZHkudG9TdHJpbmcoKSA6IGJvZHk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9KSgpO1xuXG4gICAgLyogUGFyc2UgbXVsdGlwYXJ0IHNlY3Rpb25zXG4gICAgICovXG4gICAgKGZ1bmN0aW9uKCkge1xuICAgICAgaWYgKHJlc3VsdC5ib3VuZGFyeSkge1xuICAgICAgICBjb25zdCBtdWx0aXBhcnRTdGFydCA9IG1lc3NhZ2VTdHJpbmcuaW5kZXhPZihmdWxsQm91bmRhcnkpICsgZnVsbEJvdW5kYXJ5Lmxlbmd0aDtcbiAgICAgICAgY29uc3QgbXVsdGlwYXJ0RW5kID0gbWVzc2FnZVN0cmluZy5sYXN0SW5kZXhPZihmdWxsQm91bmRhcnkpO1xuICAgICAgICBjb25zdCBtdWx0aXBhcnRCb2R5ID0gbWVzc2FnZVN0cmluZy5zdWJzdHIobXVsdGlwYXJ0U3RhcnQsIG11bHRpcGFydEVuZCk7XG4gICAgICAgIGNvbnN0IHBhcnRzID0gbXVsdGlwYXJ0Qm9keS5zcGxpdChmdWxsQm91bmRhcnkpO1xuXG4gICAgICAgIHJlc3VsdC5tdWx0aXBhcnQgPSBwYXJ0cy5maWx0ZXIoaHR0cE1lc3NhZ2VQYXJzZXIuX2lzVHJ1dGh5KS5tYXAoZnVuY3Rpb24ocGFydCwgaSkge1xuICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IHtcbiAgICAgICAgICAgIGhlYWRlcnM6IG51bGwsXG4gICAgICAgICAgICBib2R5OiBudWxsLFxuICAgICAgICAgICAgbWV0YToge1xuICAgICAgICAgICAgICBib2R5OiB7XG4gICAgICAgICAgICAgICAgYnl0ZU9mZnNldDoge1xuICAgICAgICAgICAgICAgICAgc3RhcnQ6IG51bGwsXG4gICAgICAgICAgICAgICAgICBlbmQ6IG51bGxcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9O1xuXG4gICAgICAgICAgY29uc3QgbmV3bGluZVJlZ2V4ID0gL1xcblxcbnxcXHJcXG5cXHJcXG4vZ2ltO1xuICAgICAgICAgIHZhciBuZXdsaW5lSW5kZXggPSAwO1xuICAgICAgICAgIHZhciBuZXdsaW5lTWF0Y2ggPSBuZXdsaW5lUmVnZXguZXhlYyhwYXJ0KTtcbiAgICAgICAgICB2YXIgYm9keSA9IG51bGw7XG5cbiAgICAgICAgICBpZiAobmV3bGluZU1hdGNoKSB7XG4gICAgICAgICAgICBuZXdsaW5lSW5kZXggPSBuZXdsaW5lTWF0Y2guaW5kZXg7XG4gICAgICAgICAgICBpZiAobmV3bGluZU1hdGNoLmluZGV4IDw9IDApIHtcbiAgICAgICAgICAgICAgbmV3bGluZU1hdGNoID0gbmV3bGluZVJlZ2V4LmV4ZWMocGFydCk7XG4gICAgICAgICAgICAgIGlmIChuZXdsaW5lTWF0Y2gpIHtcbiAgICAgICAgICAgICAgICBuZXdsaW5lSW5kZXggPSBuZXdsaW5lTWF0Y2guaW5kZXg7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG5cbiAgICAgICAgICBjb25zdCBwb3NzaWJsZUhlYWRlcnNTdHJpbmcgPSBwYXJ0LnN1YnN0cigwLCBuZXdsaW5lSW5kZXgpO1xuXG4gICAgICAgICAgbGV0IHN0YXJ0T2Zmc2V0ID0gbnVsbDtcbiAgICAgICAgICBsZXQgZW5kT2Zmc2V0ID0gbnVsbDtcblxuICAgICAgICAgIGlmIChuZXdsaW5lSW5kZXggPiAtMSkge1xuICAgICAgICAgICAgY29uc3QgaGVhZGVycyA9IGh0dHBNZXNzYWdlUGFyc2VyLl9wYXJzZUhlYWRlcnMocG9zc2libGVIZWFkZXJzU3RyaW5nKTtcbiAgICAgICAgICAgIGlmIChPYmplY3Qua2V5cyhoZWFkZXJzKS5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgIHJlc3VsdC5oZWFkZXJzID0gaGVhZGVycztcblxuICAgICAgICAgICAgICB2YXIgYm91bmRhcnlJbmRleGVzID0gW107XG4gICAgICAgICAgICAgIGZvciAodmFyIGogPSAwOyBqIDwgbWVzc2FnZS5sZW5ndGg7IGorKykge1xuICAgICAgICAgICAgICAgIHZhciBib3VuZGFyeU1hdGNoID0gbWVzc2FnZS5zbGljZShqLCBqICsgZnVsbEJvdW5kYXJ5Lmxlbmd0aCkudG9TdHJpbmcoKTtcblxuICAgICAgICAgICAgICAgIGlmIChib3VuZGFyeU1hdGNoID09PSBmdWxsQm91bmRhcnkpIHtcbiAgICAgICAgICAgICAgICAgIGJvdW5kYXJ5SW5kZXhlcy5wdXNoKGopO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgIHZhciBib3VuZGFyeU5ld2xpbmVJbmRleGVzID0gW107XG4gICAgICAgICAgICAgIGJvdW5kYXJ5SW5kZXhlcy5zbGljZSgwLCBib3VuZGFyeUluZGV4ZXMubGVuZ3RoIC0gMSkuZm9yRWFjaChmdW5jdGlvbihtLCBrKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgcGFydEJvZHkgPSBtZXNzYWdlLnNsaWNlKGJvdW5kYXJ5SW5kZXhlc1trXSwgYm91bmRhcnlJbmRleGVzW2sgKyAxXSkudG9TdHJpbmcoKTtcbiAgICAgICAgICAgICAgICB2YXIgaGVhZGVyTmV3bGluZUluZGV4ID0gcGFydEJvZHkuc2VhcmNoKC9cXG5cXG58XFxyXFxuXFxyXFxuL2dpbSkgKyAyO1xuICAgICAgICAgICAgICAgIGhlYWRlck5ld2xpbmVJbmRleCAgPSBib3VuZGFyeUluZGV4ZXNba10gKyBoZWFkZXJOZXdsaW5lSW5kZXg7XG4gICAgICAgICAgICAgICAgYm91bmRhcnlOZXdsaW5lSW5kZXhlcy5wdXNoKGhlYWRlck5ld2xpbmVJbmRleCk7XG4gICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgIHN0YXJ0T2Zmc2V0ID0gYm91bmRhcnlOZXdsaW5lSW5kZXhlc1tpXTtcbiAgICAgICAgICAgICAgZW5kT2Zmc2V0ID0gYm91bmRhcnlJbmRleGVzW2kgKyAxXTtcbiAgICAgICAgICAgICAgYm9keSA9IG1lc3NhZ2Uuc2xpY2Uoc3RhcnRPZmZzZXQsIGVuZE9mZnNldCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBib2R5ID0gcGFydDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgYm9keSA9IHBhcnQ7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgcmVzdWx0LmJvZHkgPSBodHRwTWVzc2FnZVBhcnNlci5faXNGYWtlQnVmZmVyKGJvZHkpID8gYm9keS50b1N0cmluZygpIDogYm9keTtcbiAgICAgICAgICByZXN1bHQubWV0YS5ib2R5LmJ5dGVPZmZzZXQuc3RhcnQgPSBzdGFydE9mZnNldDtcbiAgICAgICAgICByZXN1bHQubWV0YS5ib2R5LmJ5dGVPZmZzZXQuZW5kID0gZW5kT2Zmc2V0O1xuXG4gICAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfSkoKTtcblxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICBodHRwTWVzc2FnZVBhcnNlci5faXNUcnV0aHkgPSBmdW5jdGlvbiBfaXNUcnV0aHkodikge1xuICAgIHJldHVybiAhIXY7XG4gIH07XG5cbiAgaHR0cE1lc3NhZ2VQYXJzZXIuX2lzTnVtZXJpYyA9IGZ1bmN0aW9uIF9pc051bWVyaWModikge1xuICAgIGlmICh0eXBlb2YgdiA9PT0gJ251bWJlcicgJiYgIWlzTmFOKHYpKSB7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICB2ID0gKHZ8fCcnKS50b1N0cmluZygpLnRyaW0oKTtcblxuICAgIGlmICghdikge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIHJldHVybiAhaXNOYU4odik7XG4gIH07XG5cbiAgaHR0cE1lc3NhZ2VQYXJzZXIuX2lzQnVmZmVyID0gZnVuY3Rpb24oaXRlbSkge1xuICAgIHJldHVybiAoKGh0dHBNZXNzYWdlUGFyc2VyLl9pc05vZGVCdWZmZXJTdXBwb3J0ZWQoKSAmJlxuICAgICAgICAgICAgdHlwZW9mIGdsb2JhbCA9PT0gJ29iamVjdCcgJiZcbiAgICAgICAgICAgIGdsb2JhbC5CdWZmZXIuaXNCdWZmZXIoaXRlbSkpIHx8XG4gICAgICAgICAgICAoaXRlbSBpbnN0YW5jZW9mIE9iamVjdCAmJlxuICAgICAgICAgICAgIGl0ZW0uX2lzQnVmZmVyKSk7XG4gIH07XG5cbiAgaHR0cE1lc3NhZ2VQYXJzZXIuX2lzTm9kZUJ1ZmZlclN1cHBvcnRlZCA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiAodHlwZW9mIGdsb2JhbCA9PT0gJ29iamVjdCcgJiZcbiAgICAgICAgICAgIHR5cGVvZiBnbG9iYWwuQnVmZmVyID09PSAnZnVuY3Rpb24nICYmXG4gICAgICAgICAgICB0eXBlb2YgZ2xvYmFsLkJ1ZmZlci5pc0J1ZmZlciA9PT0gJ2Z1bmN0aW9uJyk7XG4gIH07XG5cbiAgaHR0cE1lc3NhZ2VQYXJzZXIuX3BhcnNlSGVhZGVycyA9IGZ1bmN0aW9uIF9wYXJzZUhlYWRlcnMoYm9keSkge1xuICAgIGNvbnN0IGhlYWRlcnMgPSB7fTtcblxuICAgIGlmICh0eXBlb2YgYm9keSAhPT0gJ3N0cmluZycpIHtcbiAgICAgIHJldHVybiBoZWFkZXJzO1xuICAgIH1cblxuICAgIGJvZHkuc3BsaXQoL1tcXHJcXG5dLykuZm9yRWFjaChmdW5jdGlvbihzdHJpbmcpIHtcbiAgICAgIGNvbnN0IG1hdGNoID0gc3RyaW5nLm1hdGNoKC8oW1xcdy1dKyk6XFxzKiguKikvaSk7XG5cbiAgICAgIGlmIChBcnJheS5pc0FycmF5KG1hdGNoKSAmJiBtYXRjaC5sZW5ndGggPT09IDMpIHtcbiAgICAgICAgY29uc3Qga2V5ID0gbWF0Y2hbMV07XG4gICAgICAgIGNvbnN0IHZhbHVlID0gbWF0Y2hbMl07XG5cbiAgICAgICAgaGVhZGVyc1trZXldID0gaHR0cE1lc3NhZ2VQYXJzZXIuX2lzTnVtZXJpYyh2YWx1ZSkgPyBOdW1iZXIodmFsdWUpIDogdmFsdWU7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICByZXR1cm4gaGVhZGVycztcbiAgfTtcblxuICBodHRwTWVzc2FnZVBhcnNlci5fcmVxdWVzdExpbmVSZWdleCA9IC9IVFRQXFwvKDFcXC4wfDFcXC4xfDJcXC4wKVxccysoXFxkKylcXHMrKFtcXHdcXHMtX10rKS9pO1xuICBodHRwTWVzc2FnZVBhcnNlci5fcmVzcG9uc2VMaW5lUmVnZXggPSAvKEdFVHxQT1NUfFBVVHxERUxFVEV8UEFUQ0h8T1BUSU9OU3xIRUFEfFRSQUNFfENPTk5FQ1QpXFxzKyguKilcXHMrSFRUUFxcLygxXFwuMHwxXFwuMXwyXFwuMCkvaTtcbiAgaHR0cE1lc3NhZ2VQYXJzZXIuX2hlYWRlck5ld2xpbmVSZWdleCA9IC9eW1xcclxcbl0rL2dpbTtcbiAgaHR0cE1lc3NhZ2VQYXJzZXIuX2JvdW5kYXJ5UmVnZXggPSAvKFxcbnxcXHJcXG4pKy0tW1xcdy1dKyhcXG58XFxyXFxuKSsvZztcblxuICBodHRwTWVzc2FnZVBhcnNlci5fY3JlYXRlQnVmZmVyID0gZnVuY3Rpb24oZGF0YSkge1xuICAgIGlmIChodHRwTWVzc2FnZVBhcnNlci5faXNOb2RlQnVmZmVyU3VwcG9ydGVkKCkpIHtcbiAgICAgIHJldHVybiBuZXcgQnVmZmVyKGRhdGEpO1xuICAgIH1cblxuICAgIHJldHVybiBuZXcgaHR0cE1lc3NhZ2VQYXJzZXIuX0Zha2VCdWZmZXIoZGF0YSk7XG4gIH07XG5cbiAgaHR0cE1lc3NhZ2VQYXJzZXIuX2lzRmFrZUJ1ZmZlciA9IGZ1bmN0aW9uIGlzRmFrZUJ1ZmZlcihvYmopIHtcbiAgICByZXR1cm4gb2JqIGluc3RhbmNlb2YgaHR0cE1lc3NhZ2VQYXJzZXIuX0Zha2VCdWZmZXI7XG4gIH07XG5cbiAgaHR0cE1lc3NhZ2VQYXJzZXIuX0Zha2VCdWZmZXIgPSBmdW5jdGlvbiBGYWtlQnVmZmVyKGRhdGEpIHtcbiAgICBpZiAoISh0aGlzIGluc3RhbmNlb2YgaHR0cE1lc3NhZ2VQYXJzZXIuX0Zha2VCdWZmZXIpKSB7XG4gICAgICByZXR1cm4gbmV3IGh0dHBNZXNzYWdlUGFyc2VyLl9GYWtlQnVmZmVyKGRhdGEpO1xuICAgIH1cblxuICAgIHRoaXMuZGF0YSA9IFtdO1xuXG4gICAgaWYgKEFycmF5LmlzQXJyYXkoZGF0YSkpIHtcbiAgICAgIHRoaXMuZGF0YSA9IGRhdGE7XG4gICAgfSBlbHNlIGlmICh0eXBlb2YgZGF0YSA9PT0gJ3N0cmluZycpIHtcbiAgICAgIHRoaXMuZGF0YSA9IFtdLnNsaWNlLmNhbGwoZGF0YSk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gTGl2ZU9iamVjdCgpIHt9XG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KExpdmVPYmplY3QucHJvdG90eXBlLCAnbGVuZ3RoJywge1xuICAgICAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZGF0YS5sZW5ndGg7XG4gICAgICB9LmJpbmQodGhpcylcbiAgICB9KTtcblxuICAgIHRoaXMubGVuZ3RoID0gKG5ldyBMaXZlT2JqZWN0KCkpLmxlbmd0aDtcbiAgfTtcblxuICBodHRwTWVzc2FnZVBhcnNlci5fRmFrZUJ1ZmZlci5wcm90b3R5cGUuc2xpY2UgPSBmdW5jdGlvbiBzbGljZSgpIHtcbiAgICB2YXIgbmV3QXJyYXkgPSBbXS5zbGljZS5hcHBseSh0aGlzLmRhdGEsIGFyZ3VtZW50cyk7XG4gICAgcmV0dXJuIG5ldyBodHRwTWVzc2FnZVBhcnNlci5fRmFrZUJ1ZmZlcihuZXdBcnJheSk7XG4gIH07XG5cbiAgaHR0cE1lc3NhZ2VQYXJzZXIuX0Zha2VCdWZmZXIucHJvdG90eXBlLnNlYXJjaCA9IGZ1bmN0aW9uIHNlYXJjaCgpIHtcbiAgICByZXR1cm4gW10uc2VhcmNoLmFwcGx5KHRoaXMuZGF0YSwgYXJndW1lbnRzKTtcbiAgfTtcblxuICBodHRwTWVzc2FnZVBhcnNlci5fRmFrZUJ1ZmZlci5wcm90b3R5cGUuaW5kZXhPZiA9IGZ1bmN0aW9uIGluZGV4T2YoKSB7XG4gICAgcmV0dXJuIFtdLmluZGV4T2YuYXBwbHkodGhpcy5kYXRhLCBhcmd1bWVudHMpO1xuICB9O1xuXG4gIGh0dHBNZXNzYWdlUGFyc2VyLl9GYWtlQnVmZmVyLnByb3RvdHlwZS50b1N0cmluZyA9IGZ1bmN0aW9uIHRvU3RyaW5nKCkge1xuICAgIHJldHVybiB0aGlzLmRhdGEuam9pbignJyk7XG4gIH07XG5cbiAgaWYgKHR5cGVvZiBleHBvcnRzICE9PSAndW5kZWZpbmVkJykge1xuICAgIGlmICh0eXBlb2YgbW9kdWxlICE9PSAndW5kZWZpbmVkJyAmJiBtb2R1bGUuZXhwb3J0cykge1xuICAgICAgZXhwb3J0cyA9IG1vZHVsZS5leHBvcnRzID0gaHR0cE1lc3NhZ2VQYXJzZXI7XG4gICAgfVxuICAgIGV4cG9ydHMuaHR0cE1lc3NhZ2VQYXJzZXIgPSBodHRwTWVzc2FnZVBhcnNlcjtcbiAgfSBlbHNlIGlmICh0eXBlb2YgZGVmaW5lID09PSAnZnVuY3Rpb24nICYmIGRlZmluZS5hbWQpIHtcbiAgICBkZWZpbmUoW10sIGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIGh0dHBNZXNzYWdlUGFyc2VyO1xuICAgIH0pO1xuICB9IGVsc2Uge1xuICAgIHJvb3QuaHR0cE1lc3NhZ2VQYXJzZXIgPSBodHRwTWVzc2FnZVBhcnNlcjtcbiAgfVxuXG59KSh0aGlzKTtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIFN0cmluZ2lmeSA9IHJlcXVpcmUoJy4vc3RyaW5naWZ5Jyk7XG52YXIgUGFyc2UgPSByZXF1aXJlKCcuL3BhcnNlJyk7XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICAgIHN0cmluZ2lmeTogU3RyaW5naWZ5LFxuICAgIHBhcnNlOiBQYXJzZVxufTtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIFV0aWxzID0gcmVxdWlyZSgnLi91dGlscycpO1xuXG52YXIgaW50ZXJuYWxzID0ge1xuICAgIGRlbGltaXRlcjogJyYnLFxuICAgIGRlcHRoOiA1LFxuICAgIGFycmF5TGltaXQ6IDIwLFxuICAgIHBhcmFtZXRlckxpbWl0OiAxMDAwLFxuICAgIHN0cmljdE51bGxIYW5kbGluZzogZmFsc2UsXG4gICAgcGxhaW5PYmplY3RzOiBmYWxzZSxcbiAgICBhbGxvd1Byb3RvdHlwZXM6IGZhbHNlLFxuICAgIGFsbG93RG90czogZmFsc2Vcbn07XG5cbmludGVybmFscy5wYXJzZVZhbHVlcyA9IGZ1bmN0aW9uIChzdHIsIG9wdGlvbnMpIHtcbiAgICB2YXIgb2JqID0ge307XG4gICAgdmFyIHBhcnRzID0gc3RyLnNwbGl0KG9wdGlvbnMuZGVsaW1pdGVyLCBvcHRpb25zLnBhcmFtZXRlckxpbWl0ID09PSBJbmZpbml0eSA/IHVuZGVmaW5lZCA6IG9wdGlvbnMucGFyYW1ldGVyTGltaXQpO1xuXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBwYXJ0cy5sZW5ndGg7ICsraSkge1xuICAgICAgICB2YXIgcGFydCA9IHBhcnRzW2ldO1xuICAgICAgICB2YXIgcG9zID0gcGFydC5pbmRleE9mKCddPScpID09PSAtMSA/IHBhcnQuaW5kZXhPZignPScpIDogcGFydC5pbmRleE9mKCddPScpICsgMTtcblxuICAgICAgICBpZiAocG9zID09PSAtMSkge1xuICAgICAgICAgICAgb2JqW1V0aWxzLmRlY29kZShwYXJ0KV0gPSAnJztcblxuICAgICAgICAgICAgaWYgKG9wdGlvbnMuc3RyaWN0TnVsbEhhbmRsaW5nKSB7XG4gICAgICAgICAgICAgICAgb2JqW1V0aWxzLmRlY29kZShwYXJ0KV0gPSBudWxsO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdmFyIGtleSA9IFV0aWxzLmRlY29kZShwYXJ0LnNsaWNlKDAsIHBvcykpO1xuICAgICAgICAgICAgdmFyIHZhbCA9IFV0aWxzLmRlY29kZShwYXJ0LnNsaWNlKHBvcyArIDEpKTtcblxuICAgICAgICAgICAgaWYgKE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChvYmosIGtleSkpIHtcbiAgICAgICAgICAgICAgICBvYmpba2V5XSA9IFtdLmNvbmNhdChvYmpba2V5XSkuY29uY2F0KHZhbCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIG9ialtrZXldID0gdmFsO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIG9iajtcbn07XG5cbmludGVybmFscy5wYXJzZU9iamVjdCA9IGZ1bmN0aW9uIChjaGFpbiwgdmFsLCBvcHRpb25zKSB7XG4gICAgaWYgKCFjaGFpbi5sZW5ndGgpIHtcbiAgICAgICAgcmV0dXJuIHZhbDtcbiAgICB9XG5cbiAgICB2YXIgcm9vdCA9IGNoYWluLnNoaWZ0KCk7XG5cbiAgICB2YXIgb2JqO1xuICAgIGlmIChyb290ID09PSAnW10nKSB7XG4gICAgICAgIG9iaiA9IFtdO1xuICAgICAgICBvYmogPSBvYmouY29uY2F0KGludGVybmFscy5wYXJzZU9iamVjdChjaGFpbiwgdmFsLCBvcHRpb25zKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgb2JqID0gb3B0aW9ucy5wbGFpbk9iamVjdHMgPyBPYmplY3QuY3JlYXRlKG51bGwpIDoge307XG4gICAgICAgIHZhciBjbGVhblJvb3QgPSByb290WzBdID09PSAnWycgJiYgcm9vdFtyb290Lmxlbmd0aCAtIDFdID09PSAnXScgPyByb290LnNsaWNlKDEsIHJvb3QubGVuZ3RoIC0gMSkgOiByb290O1xuICAgICAgICB2YXIgaW5kZXggPSBwYXJzZUludChjbGVhblJvb3QsIDEwKTtcbiAgICAgICAgaWYgKFxuICAgICAgICAgICAgIWlzTmFOKGluZGV4KSAmJlxuICAgICAgICAgICAgcm9vdCAhPT0gY2xlYW5Sb290ICYmXG4gICAgICAgICAgICBTdHJpbmcoaW5kZXgpID09PSBjbGVhblJvb3QgJiZcbiAgICAgICAgICAgIGluZGV4ID49IDAgJiZcbiAgICAgICAgICAgIChvcHRpb25zLnBhcnNlQXJyYXlzICYmIGluZGV4IDw9IG9wdGlvbnMuYXJyYXlMaW1pdClcbiAgICAgICAgKSB7XG4gICAgICAgICAgICBvYmogPSBbXTtcbiAgICAgICAgICAgIG9ialtpbmRleF0gPSBpbnRlcm5hbHMucGFyc2VPYmplY3QoY2hhaW4sIHZhbCwgb3B0aW9ucyk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBvYmpbY2xlYW5Sb290XSA9IGludGVybmFscy5wYXJzZU9iamVjdChjaGFpbiwgdmFsLCBvcHRpb25zKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBvYmo7XG59O1xuXG5pbnRlcm5hbHMucGFyc2VLZXlzID0gZnVuY3Rpb24gKGdpdmVuS2V5LCB2YWwsIG9wdGlvbnMpIHtcbiAgICBpZiAoIWdpdmVuS2V5KSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAvLyBUcmFuc2Zvcm0gZG90IG5vdGF0aW9uIHRvIGJyYWNrZXQgbm90YXRpb25cbiAgICB2YXIga2V5ID0gb3B0aW9ucy5hbGxvd0RvdHMgPyBnaXZlbktleS5yZXBsYWNlKC9cXC4oW15cXC5cXFtdKykvZywgJ1skMV0nKSA6IGdpdmVuS2V5O1xuXG4gICAgLy8gVGhlIHJlZ2V4IGNodW5rc1xuXG4gICAgdmFyIHBhcmVudCA9IC9eKFteXFxbXFxdXSopLztcbiAgICB2YXIgY2hpbGQgPSAvKFxcW1teXFxbXFxdXSpcXF0pL2c7XG5cbiAgICAvLyBHZXQgdGhlIHBhcmVudFxuXG4gICAgdmFyIHNlZ21lbnQgPSBwYXJlbnQuZXhlYyhrZXkpO1xuXG4gICAgLy8gU3Rhc2ggdGhlIHBhcmVudCBpZiBpdCBleGlzdHNcblxuICAgIHZhciBrZXlzID0gW107XG4gICAgaWYgKHNlZ21lbnRbMV0pIHtcbiAgICAgICAgLy8gSWYgd2UgYXJlbid0IHVzaW5nIHBsYWluIG9iamVjdHMsIG9wdGlvbmFsbHkgcHJlZml4IGtleXNcbiAgICAgICAgLy8gdGhhdCB3b3VsZCBvdmVyd3JpdGUgb2JqZWN0IHByb3RvdHlwZSBwcm9wZXJ0aWVzXG4gICAgICAgIGlmICghb3B0aW9ucy5wbGFpbk9iamVjdHMgJiYgT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eShzZWdtZW50WzFdKSkge1xuICAgICAgICAgICAgaWYgKCFvcHRpb25zLmFsbG93UHJvdG90eXBlcykge1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGtleXMucHVzaChzZWdtZW50WzFdKTtcbiAgICB9XG5cbiAgICAvLyBMb29wIHRocm91Z2ggY2hpbGRyZW4gYXBwZW5kaW5nIHRvIHRoZSBhcnJheSB1bnRpbCB3ZSBoaXQgZGVwdGhcblxuICAgIHZhciBpID0gMDtcbiAgICB3aGlsZSAoKHNlZ21lbnQgPSBjaGlsZC5leGVjKGtleSkpICE9PSBudWxsICYmIGkgPCBvcHRpb25zLmRlcHRoKSB7XG4gICAgICAgIGkgKz0gMTtcbiAgICAgICAgaWYgKCFvcHRpb25zLnBsYWluT2JqZWN0cyAmJiBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5KHNlZ21lbnRbMV0ucmVwbGFjZSgvXFxbfFxcXS9nLCAnJykpKSB7XG4gICAgICAgICAgICBpZiAoIW9wdGlvbnMuYWxsb3dQcm90b3R5cGVzKSB7XG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAga2V5cy5wdXNoKHNlZ21lbnRbMV0pO1xuICAgIH1cblxuICAgIC8vIElmIHRoZXJlJ3MgYSByZW1haW5kZXIsIGp1c3QgYWRkIHdoYXRldmVyIGlzIGxlZnRcblxuICAgIGlmIChzZWdtZW50KSB7XG4gICAgICAgIGtleXMucHVzaCgnWycgKyBrZXkuc2xpY2Uoc2VnbWVudC5pbmRleCkgKyAnXScpO1xuICAgIH1cblxuICAgIHJldHVybiBpbnRlcm5hbHMucGFyc2VPYmplY3Qoa2V5cywgdmFsLCBvcHRpb25zKTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKHN0ciwgb3B0cykge1xuICAgIHZhciBvcHRpb25zID0gb3B0cyB8fCB7fTtcbiAgICBvcHRpb25zLmRlbGltaXRlciA9IHR5cGVvZiBvcHRpb25zLmRlbGltaXRlciA9PT0gJ3N0cmluZycgfHwgVXRpbHMuaXNSZWdFeHAob3B0aW9ucy5kZWxpbWl0ZXIpID8gb3B0aW9ucy5kZWxpbWl0ZXIgOiBpbnRlcm5hbHMuZGVsaW1pdGVyO1xuICAgIG9wdGlvbnMuZGVwdGggPSB0eXBlb2Ygb3B0aW9ucy5kZXB0aCA9PT0gJ251bWJlcicgPyBvcHRpb25zLmRlcHRoIDogaW50ZXJuYWxzLmRlcHRoO1xuICAgIG9wdGlvbnMuYXJyYXlMaW1pdCA9IHR5cGVvZiBvcHRpb25zLmFycmF5TGltaXQgPT09ICdudW1iZXInID8gb3B0aW9ucy5hcnJheUxpbWl0IDogaW50ZXJuYWxzLmFycmF5TGltaXQ7XG4gICAgb3B0aW9ucy5wYXJzZUFycmF5cyA9IG9wdGlvbnMucGFyc2VBcnJheXMgIT09IGZhbHNlO1xuICAgIG9wdGlvbnMuYWxsb3dEb3RzID0gdHlwZW9mIG9wdGlvbnMuYWxsb3dEb3RzID09PSAnYm9vbGVhbicgPyBvcHRpb25zLmFsbG93RG90cyA6IGludGVybmFscy5hbGxvd0RvdHM7XG4gICAgb3B0aW9ucy5wbGFpbk9iamVjdHMgPSB0eXBlb2Ygb3B0aW9ucy5wbGFpbk9iamVjdHMgPT09ICdib29sZWFuJyA/IG9wdGlvbnMucGxhaW5PYmplY3RzIDogaW50ZXJuYWxzLnBsYWluT2JqZWN0cztcbiAgICBvcHRpb25zLmFsbG93UHJvdG90eXBlcyA9IHR5cGVvZiBvcHRpb25zLmFsbG93UHJvdG90eXBlcyA9PT0gJ2Jvb2xlYW4nID8gb3B0aW9ucy5hbGxvd1Byb3RvdHlwZXMgOiBpbnRlcm5hbHMuYWxsb3dQcm90b3R5cGVzO1xuICAgIG9wdGlvbnMucGFyYW1ldGVyTGltaXQgPSB0eXBlb2Ygb3B0aW9ucy5wYXJhbWV0ZXJMaW1pdCA9PT0gJ251bWJlcicgPyBvcHRpb25zLnBhcmFtZXRlckxpbWl0IDogaW50ZXJuYWxzLnBhcmFtZXRlckxpbWl0O1xuICAgIG9wdGlvbnMuc3RyaWN0TnVsbEhhbmRsaW5nID0gdHlwZW9mIG9wdGlvbnMuc3RyaWN0TnVsbEhhbmRsaW5nID09PSAnYm9vbGVhbicgPyBvcHRpb25zLnN0cmljdE51bGxIYW5kbGluZyA6IGludGVybmFscy5zdHJpY3ROdWxsSGFuZGxpbmc7XG5cbiAgICBpZiAoXG4gICAgICAgIHN0ciA9PT0gJycgfHxcbiAgICAgICAgc3RyID09PSBudWxsIHx8XG4gICAgICAgIHR5cGVvZiBzdHIgPT09ICd1bmRlZmluZWQnXG4gICAgKSB7XG4gICAgICAgIHJldHVybiBvcHRpb25zLnBsYWluT2JqZWN0cyA/IE9iamVjdC5jcmVhdGUobnVsbCkgOiB7fTtcbiAgICB9XG5cbiAgICB2YXIgdGVtcE9iaiA9IHR5cGVvZiBzdHIgPT09ICdzdHJpbmcnID8gaW50ZXJuYWxzLnBhcnNlVmFsdWVzKHN0ciwgb3B0aW9ucykgOiBzdHI7XG4gICAgdmFyIG9iaiA9IG9wdGlvbnMucGxhaW5PYmplY3RzID8gT2JqZWN0LmNyZWF0ZShudWxsKSA6IHt9O1xuXG4gICAgLy8gSXRlcmF0ZSBvdmVyIHRoZSBrZXlzIGFuZCBzZXR1cCB0aGUgbmV3IG9iamVjdFxuXG4gICAgdmFyIGtleXMgPSBPYmplY3Qua2V5cyh0ZW1wT2JqKTtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGtleXMubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgdmFyIGtleSA9IGtleXNbaV07XG4gICAgICAgIHZhciBuZXdPYmogPSBpbnRlcm5hbHMucGFyc2VLZXlzKGtleSwgdGVtcE9ialtrZXldLCBvcHRpb25zKTtcbiAgICAgICAgb2JqID0gVXRpbHMubWVyZ2Uob2JqLCBuZXdPYmosIG9wdGlvbnMpO1xuICAgIH1cblxuICAgIHJldHVybiBVdGlscy5jb21wYWN0KG9iaik7XG59O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgVXRpbHMgPSByZXF1aXJlKCcuL3V0aWxzJyk7XG5cbnZhciBpbnRlcm5hbHMgPSB7XG4gICAgZGVsaW1pdGVyOiAnJicsXG4gICAgYXJyYXlQcmVmaXhHZW5lcmF0b3JzOiB7XG4gICAgICAgIGJyYWNrZXRzOiBmdW5jdGlvbiAocHJlZml4KSB7XG4gICAgICAgICAgICByZXR1cm4gcHJlZml4ICsgJ1tdJztcbiAgICAgICAgfSxcbiAgICAgICAgaW5kaWNlczogZnVuY3Rpb24gKHByZWZpeCwga2V5KSB7XG4gICAgICAgICAgICByZXR1cm4gcHJlZml4ICsgJ1snICsga2V5ICsgJ10nO1xuICAgICAgICB9LFxuICAgICAgICByZXBlYXQ6IGZ1bmN0aW9uIChwcmVmaXgpIHtcbiAgICAgICAgICAgIHJldHVybiBwcmVmaXg7XG4gICAgICAgIH1cbiAgICB9LFxuICAgIHN0cmljdE51bGxIYW5kbGluZzogZmFsc2UsXG4gICAgc2tpcE51bGxzOiBmYWxzZSxcbiAgICBlbmNvZGU6IHRydWVcbn07XG5cbmludGVybmFscy5zdHJpbmdpZnkgPSBmdW5jdGlvbiAob2JqZWN0LCBwcmVmaXgsIGdlbmVyYXRlQXJyYXlQcmVmaXgsIHN0cmljdE51bGxIYW5kbGluZywgc2tpcE51bGxzLCBlbmNvZGUsIGZpbHRlciwgc29ydCwgYWxsb3dEb3RzKSB7XG4gICAgdmFyIG9iaiA9IG9iamVjdDtcbiAgICBpZiAodHlwZW9mIGZpbHRlciA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICBvYmogPSBmaWx0ZXIocHJlZml4LCBvYmopO1xuICAgIH0gZWxzZSBpZiAoVXRpbHMuaXNCdWZmZXIob2JqKSkge1xuICAgICAgICBvYmogPSBTdHJpbmcob2JqKTtcbiAgICB9IGVsc2UgaWYgKG9iaiBpbnN0YW5jZW9mIERhdGUpIHtcbiAgICAgICAgb2JqID0gb2JqLnRvSVNPU3RyaW5nKCk7XG4gICAgfSBlbHNlIGlmIChvYmogPT09IG51bGwpIHtcbiAgICAgICAgaWYgKHN0cmljdE51bGxIYW5kbGluZykge1xuICAgICAgICAgICAgcmV0dXJuIGVuY29kZSA/IFV0aWxzLmVuY29kZShwcmVmaXgpIDogcHJlZml4O1xuICAgICAgICB9XG5cbiAgICAgICAgb2JqID0gJyc7XG4gICAgfVxuXG4gICAgaWYgKHR5cGVvZiBvYmogPT09ICdzdHJpbmcnIHx8IHR5cGVvZiBvYmogPT09ICdudW1iZXInIHx8IHR5cGVvZiBvYmogPT09ICdib29sZWFuJykge1xuICAgICAgICBpZiAoZW5jb2RlKSB7XG4gICAgICAgICAgICByZXR1cm4gW1V0aWxzLmVuY29kZShwcmVmaXgpICsgJz0nICsgVXRpbHMuZW5jb2RlKG9iaildO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBbcHJlZml4ICsgJz0nICsgb2JqXTtcbiAgICB9XG5cbiAgICB2YXIgdmFsdWVzID0gW107XG5cbiAgICBpZiAodHlwZW9mIG9iaiA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgcmV0dXJuIHZhbHVlcztcbiAgICB9XG5cbiAgICB2YXIgb2JqS2V5cztcbiAgICBpZiAoQXJyYXkuaXNBcnJheShmaWx0ZXIpKSB7XG4gICAgICAgIG9iaktleXMgPSBmaWx0ZXI7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgdmFyIGtleXMgPSBPYmplY3Qua2V5cyhvYmopO1xuICAgICAgICBvYmpLZXlzID0gc29ydCA/IGtleXMuc29ydChzb3J0KSA6IGtleXM7XG4gICAgfVxuXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBvYmpLZXlzLmxlbmd0aDsgKytpKSB7XG4gICAgICAgIHZhciBrZXkgPSBvYmpLZXlzW2ldO1xuXG4gICAgICAgIGlmIChza2lwTnVsbHMgJiYgb2JqW2tleV0gPT09IG51bGwpIHtcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkob2JqKSkge1xuICAgICAgICAgICAgdmFsdWVzID0gdmFsdWVzLmNvbmNhdChpbnRlcm5hbHMuc3RyaW5naWZ5KG9ialtrZXldLCBnZW5lcmF0ZUFycmF5UHJlZml4KHByZWZpeCwga2V5KSwgZ2VuZXJhdGVBcnJheVByZWZpeCwgc3RyaWN0TnVsbEhhbmRsaW5nLCBza2lwTnVsbHMsIGVuY29kZSwgZmlsdGVyLCBzb3J0LCBhbGxvd0RvdHMpKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHZhbHVlcyA9IHZhbHVlcy5jb25jYXQoaW50ZXJuYWxzLnN0cmluZ2lmeShvYmpba2V5XSwgcHJlZml4ICsgKGFsbG93RG90cyA/ICcuJyArIGtleSA6ICdbJyArIGtleSArICddJyksIGdlbmVyYXRlQXJyYXlQcmVmaXgsIHN0cmljdE51bGxIYW5kbGluZywgc2tpcE51bGxzLCBlbmNvZGUsIGZpbHRlciwgc29ydCwgYWxsb3dEb3RzKSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gdmFsdWVzO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAob2JqZWN0LCBvcHRzKSB7XG4gICAgdmFyIG9iaiA9IG9iamVjdDtcbiAgICB2YXIgb3B0aW9ucyA9IG9wdHMgfHwge307XG4gICAgdmFyIGRlbGltaXRlciA9IHR5cGVvZiBvcHRpb25zLmRlbGltaXRlciA9PT0gJ3VuZGVmaW5lZCcgPyBpbnRlcm5hbHMuZGVsaW1pdGVyIDogb3B0aW9ucy5kZWxpbWl0ZXI7XG4gICAgdmFyIHN0cmljdE51bGxIYW5kbGluZyA9IHR5cGVvZiBvcHRpb25zLnN0cmljdE51bGxIYW5kbGluZyA9PT0gJ2Jvb2xlYW4nID8gb3B0aW9ucy5zdHJpY3ROdWxsSGFuZGxpbmcgOiBpbnRlcm5hbHMuc3RyaWN0TnVsbEhhbmRsaW5nO1xuICAgIHZhciBza2lwTnVsbHMgPSB0eXBlb2Ygb3B0aW9ucy5za2lwTnVsbHMgPT09ICdib29sZWFuJyA/IG9wdGlvbnMuc2tpcE51bGxzIDogaW50ZXJuYWxzLnNraXBOdWxscztcbiAgICB2YXIgZW5jb2RlID0gdHlwZW9mIG9wdGlvbnMuZW5jb2RlID09PSAnYm9vbGVhbicgPyBvcHRpb25zLmVuY29kZSA6IGludGVybmFscy5lbmNvZGU7XG4gICAgdmFyIHNvcnQgPSB0eXBlb2Ygb3B0aW9ucy5zb3J0ID09PSAnZnVuY3Rpb24nID8gb3B0aW9ucy5zb3J0IDogbnVsbDtcbiAgICB2YXIgYWxsb3dEb3RzID0gdHlwZW9mIG9wdGlvbnMuYWxsb3dEb3RzID09PSAndW5kZWZpbmVkJyA/IGZhbHNlIDogb3B0aW9ucy5hbGxvd0RvdHM7XG4gICAgdmFyIG9iaktleXM7XG4gICAgdmFyIGZpbHRlcjtcbiAgICBpZiAodHlwZW9mIG9wdGlvbnMuZmlsdGVyID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIGZpbHRlciA9IG9wdGlvbnMuZmlsdGVyO1xuICAgICAgICBvYmogPSBmaWx0ZXIoJycsIG9iaik7XG4gICAgfSBlbHNlIGlmIChBcnJheS5pc0FycmF5KG9wdGlvbnMuZmlsdGVyKSkge1xuICAgICAgICBvYmpLZXlzID0gZmlsdGVyID0gb3B0aW9ucy5maWx0ZXI7XG4gICAgfVxuXG4gICAgdmFyIGtleXMgPSBbXTtcblxuICAgIGlmICh0eXBlb2Ygb2JqICE9PSAnb2JqZWN0JyB8fCBvYmogPT09IG51bGwpIHtcbiAgICAgICAgcmV0dXJuICcnO1xuICAgIH1cblxuICAgIHZhciBhcnJheUZvcm1hdDtcbiAgICBpZiAob3B0aW9ucy5hcnJheUZvcm1hdCBpbiBpbnRlcm5hbHMuYXJyYXlQcmVmaXhHZW5lcmF0b3JzKSB7XG4gICAgICAgIGFycmF5Rm9ybWF0ID0gb3B0aW9ucy5hcnJheUZvcm1hdDtcbiAgICB9IGVsc2UgaWYgKCdpbmRpY2VzJyBpbiBvcHRpb25zKSB7XG4gICAgICAgIGFycmF5Rm9ybWF0ID0gb3B0aW9ucy5pbmRpY2VzID8gJ2luZGljZXMnIDogJ3JlcGVhdCc7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgYXJyYXlGb3JtYXQgPSAnaW5kaWNlcyc7XG4gICAgfVxuXG4gICAgdmFyIGdlbmVyYXRlQXJyYXlQcmVmaXggPSBpbnRlcm5hbHMuYXJyYXlQcmVmaXhHZW5lcmF0b3JzW2FycmF5Rm9ybWF0XTtcblxuICAgIGlmICghb2JqS2V5cykge1xuICAgICAgICBvYmpLZXlzID0gT2JqZWN0LmtleXMob2JqKTtcbiAgICB9XG5cbiAgICBpZiAoc29ydCkge1xuICAgICAgICBvYmpLZXlzLnNvcnQoc29ydCk7XG4gICAgfVxuXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBvYmpLZXlzLmxlbmd0aDsgKytpKSB7XG4gICAgICAgIHZhciBrZXkgPSBvYmpLZXlzW2ldO1xuXG4gICAgICAgIGlmIChza2lwTnVsbHMgJiYgb2JqW2tleV0gPT09IG51bGwpIHtcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG5cbiAgICAgICAga2V5cyA9IGtleXMuY29uY2F0KGludGVybmFscy5zdHJpbmdpZnkob2JqW2tleV0sIGtleSwgZ2VuZXJhdGVBcnJheVByZWZpeCwgc3RyaWN0TnVsbEhhbmRsaW5nLCBza2lwTnVsbHMsIGVuY29kZSwgZmlsdGVyLCBzb3J0LCBhbGxvd0RvdHMpKTtcbiAgICB9XG5cbiAgICByZXR1cm4ga2V5cy5qb2luKGRlbGltaXRlcik7XG59O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgaGV4VGFibGUgPSAoZnVuY3Rpb24gKCkge1xuICAgIHZhciBhcnJheSA9IG5ldyBBcnJheSgyNTYpO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgMjU2OyArK2kpIHtcbiAgICAgICAgYXJyYXlbaV0gPSAnJScgKyAoKGkgPCAxNiA/ICcwJyA6ICcnKSArIGkudG9TdHJpbmcoMTYpKS50b1VwcGVyQ2FzZSgpO1xuICAgIH1cblxuICAgIHJldHVybiBhcnJheTtcbn0oKSk7XG5cbmV4cG9ydHMuYXJyYXlUb09iamVjdCA9IGZ1bmN0aW9uIChzb3VyY2UsIG9wdGlvbnMpIHtcbiAgICB2YXIgb2JqID0gb3B0aW9ucy5wbGFpbk9iamVjdHMgPyBPYmplY3QuY3JlYXRlKG51bGwpIDoge307XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBzb3VyY2UubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgaWYgKHR5cGVvZiBzb3VyY2VbaV0gIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICBvYmpbaV0gPSBzb3VyY2VbaV07XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gb2JqO1xufTtcblxuZXhwb3J0cy5tZXJnZSA9IGZ1bmN0aW9uICh0YXJnZXQsIHNvdXJjZSwgb3B0aW9ucykge1xuICAgIGlmICghc291cmNlKSB7XG4gICAgICAgIHJldHVybiB0YXJnZXQ7XG4gICAgfVxuXG4gICAgaWYgKHR5cGVvZiBzb3VyY2UgIT09ICdvYmplY3QnKSB7XG4gICAgICAgIGlmIChBcnJheS5pc0FycmF5KHRhcmdldCkpIHtcbiAgICAgICAgICAgIHRhcmdldC5wdXNoKHNvdXJjZSk7XG4gICAgICAgIH0gZWxzZSBpZiAodHlwZW9mIHRhcmdldCA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgICAgIHRhcmdldFtzb3VyY2VdID0gdHJ1ZTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiBbdGFyZ2V0LCBzb3VyY2VdO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHRhcmdldDtcbiAgICB9XG5cbiAgICBpZiAodHlwZW9mIHRhcmdldCAhPT0gJ29iamVjdCcpIHtcbiAgICAgICAgcmV0dXJuIFt0YXJnZXRdLmNvbmNhdChzb3VyY2UpO1xuICAgIH1cblxuICAgIHZhciBtZXJnZVRhcmdldCA9IHRhcmdldDtcbiAgICBpZiAoQXJyYXkuaXNBcnJheSh0YXJnZXQpICYmICFBcnJheS5pc0FycmF5KHNvdXJjZSkpIHtcbiAgICAgICAgbWVyZ2VUYXJnZXQgPSBleHBvcnRzLmFycmF5VG9PYmplY3QodGFyZ2V0LCBvcHRpb25zKTtcbiAgICB9XG5cblx0cmV0dXJuIE9iamVjdC5rZXlzKHNvdXJjZSkucmVkdWNlKGZ1bmN0aW9uIChhY2MsIGtleSkge1xuICAgICAgICB2YXIgdmFsdWUgPSBzb3VyY2Vba2V5XTtcblxuICAgICAgICBpZiAoT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKGFjYywga2V5KSkge1xuICAgICAgICAgICAgYWNjW2tleV0gPSBleHBvcnRzLm1lcmdlKGFjY1trZXldLCB2YWx1ZSwgb3B0aW9ucyk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBhY2Nba2V5XSA9IHZhbHVlO1xuICAgICAgICB9XG5cdFx0cmV0dXJuIGFjYztcbiAgICB9LCBtZXJnZVRhcmdldCk7XG59O1xuXG5leHBvcnRzLmRlY29kZSA9IGZ1bmN0aW9uIChzdHIpIHtcbiAgICB0cnkge1xuICAgICAgICByZXR1cm4gZGVjb2RlVVJJQ29tcG9uZW50KHN0ci5yZXBsYWNlKC9cXCsvZywgJyAnKSk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgICByZXR1cm4gc3RyO1xuICAgIH1cbn07XG5cbmV4cG9ydHMuZW5jb2RlID0gZnVuY3Rpb24gKHN0cikge1xuICAgIC8vIFRoaXMgY29kZSB3YXMgb3JpZ2luYWxseSB3cml0dGVuIGJ5IEJyaWFuIFdoaXRlIChtc2NkZXgpIGZvciB0aGUgaW8uanMgY29yZSBxdWVyeXN0cmluZyBsaWJyYXJ5LlxuICAgIC8vIEl0IGhhcyBiZWVuIGFkYXB0ZWQgaGVyZSBmb3Igc3RyaWN0ZXIgYWRoZXJlbmNlIHRvIFJGQyAzOTg2XG4gICAgaWYgKHN0ci5sZW5ndGggPT09IDApIHtcbiAgICAgICAgcmV0dXJuIHN0cjtcbiAgICB9XG5cbiAgICB2YXIgc3RyaW5nID0gdHlwZW9mIHN0ciA9PT0gJ3N0cmluZycgPyBzdHIgOiBTdHJpbmcoc3RyKTtcblxuICAgIHZhciBvdXQgPSAnJztcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHN0cmluZy5sZW5ndGg7ICsraSkge1xuICAgICAgICB2YXIgYyA9IHN0cmluZy5jaGFyQ29kZUF0KGkpO1xuXG4gICAgICAgIGlmIChcbiAgICAgICAgICAgIGMgPT09IDB4MkQgfHwgLy8gLVxuICAgICAgICAgICAgYyA9PT0gMHgyRSB8fCAvLyAuXG4gICAgICAgICAgICBjID09PSAweDVGIHx8IC8vIF9cbiAgICAgICAgICAgIGMgPT09IDB4N0UgfHwgLy8gflxuICAgICAgICAgICAgKGMgPj0gMHgzMCAmJiBjIDw9IDB4MzkpIHx8IC8vIDAtOVxuICAgICAgICAgICAgKGMgPj0gMHg0MSAmJiBjIDw9IDB4NUEpIHx8IC8vIGEtelxuICAgICAgICAgICAgKGMgPj0gMHg2MSAmJiBjIDw9IDB4N0EpIC8vIEEtWlxuICAgICAgICApIHtcbiAgICAgICAgICAgIG91dCArPSBzdHJpbmcuY2hhckF0KGkpO1xuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoYyA8IDB4ODApIHtcbiAgICAgICAgICAgIG91dCA9IG91dCArIGhleFRhYmxlW2NdO1xuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoYyA8IDB4ODAwKSB7XG4gICAgICAgICAgICBvdXQgPSBvdXQgKyAoaGV4VGFibGVbMHhDMCB8IChjID4+IDYpXSArIGhleFRhYmxlWzB4ODAgfCAoYyAmIDB4M0YpXSk7XG4gICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChjIDwgMHhEODAwIHx8IGMgPj0gMHhFMDAwKSB7XG4gICAgICAgICAgICBvdXQgPSBvdXQgKyAoaGV4VGFibGVbMHhFMCB8IChjID4+IDEyKV0gKyBoZXhUYWJsZVsweDgwIHwgKChjID4+IDYpICYgMHgzRildICsgaGV4VGFibGVbMHg4MCB8IChjICYgMHgzRildKTtcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgaSArPSAxO1xuICAgICAgICBjID0gMHgxMDAwMCArICgoKGMgJiAweDNGRikgPDwgMTApIHwgKHN0cmluZy5jaGFyQ29kZUF0KGkpICYgMHgzRkYpKTtcbiAgICAgICAgb3V0ICs9IChoZXhUYWJsZVsweEYwIHwgKGMgPj4gMTgpXSArIGhleFRhYmxlWzB4ODAgfCAoKGMgPj4gMTIpICYgMHgzRildICsgaGV4VGFibGVbMHg4MCB8ICgoYyA+PiA2KSAmIDB4M0YpXSArIGhleFRhYmxlWzB4ODAgfCAoYyAmIDB4M0YpXSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIG91dDtcbn07XG5cbmV4cG9ydHMuY29tcGFjdCA9IGZ1bmN0aW9uIChvYmosIHJlZmVyZW5jZXMpIHtcbiAgICBpZiAodHlwZW9mIG9iaiAhPT0gJ29iamVjdCcgfHwgb2JqID09PSBudWxsKSB7XG4gICAgICAgIHJldHVybiBvYmo7XG4gICAgfVxuXG4gICAgdmFyIHJlZnMgPSByZWZlcmVuY2VzIHx8IFtdO1xuICAgIHZhciBsb29rdXAgPSByZWZzLmluZGV4T2Yob2JqKTtcbiAgICBpZiAobG9va3VwICE9PSAtMSkge1xuICAgICAgICByZXR1cm4gcmVmc1tsb29rdXBdO1xuICAgIH1cblxuICAgIHJlZnMucHVzaChvYmopO1xuXG4gICAgaWYgKEFycmF5LmlzQXJyYXkob2JqKSkge1xuICAgICAgICB2YXIgY29tcGFjdGVkID0gW107XG5cbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBvYmoubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgICAgIGlmICh0eXBlb2Ygb2JqW2ldICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgICAgIGNvbXBhY3RlZC5wdXNoKG9ialtpXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gY29tcGFjdGVkO1xuICAgIH1cblxuICAgIHZhciBrZXlzID0gT2JqZWN0LmtleXMob2JqKTtcbiAgICBmb3IgKHZhciBqID0gMDsgaiA8IGtleXMubGVuZ3RoOyArK2opIHtcbiAgICAgICAgdmFyIGtleSA9IGtleXNbal07XG4gICAgICAgIG9ialtrZXldID0gZXhwb3J0cy5jb21wYWN0KG9ialtrZXldLCByZWZzKTtcbiAgICB9XG5cbiAgICByZXR1cm4gb2JqO1xufTtcblxuZXhwb3J0cy5pc1JlZ0V4cCA9IGZ1bmN0aW9uIChvYmopIHtcbiAgICByZXR1cm4gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKG9iaikgPT09ICdbb2JqZWN0IFJlZ0V4cF0nO1xufTtcblxuZXhwb3J0cy5pc0J1ZmZlciA9IGZ1bmN0aW9uIChvYmopIHtcbiAgICBpZiAob2JqID09PSBudWxsIHx8IHR5cGVvZiBvYmogPT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICByZXR1cm4gISEob2JqLmNvbnN0cnVjdG9yICYmIG9iai5jb25zdHJ1Y3Rvci5pc0J1ZmZlciAmJiBvYmouY29uc3RydWN0b3IuaXNCdWZmZXIob2JqKSk7XG59O1xuIl19
