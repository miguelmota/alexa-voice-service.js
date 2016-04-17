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
  logOutput.innerHTML += '<li>LOG: ' + message + '</li>';
}

function logError(error) {
  logOutput.innerHTML += '<li>ERROR: ' + error + '</li>';
}

var loginBtn = document.getElementById('login');
var logoutBtn = document.getElementById('logout');
var logOutput = document.getElementById('log');
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
      return avs.player.enqueue(dataView);
    }).then(function () {
      return avs.player.play();
    }).catch(function (error) {
      console.error(error);
    });

    //sendBlob(blob);
    avs.sendAudio(dataView).then(function (response) {

      if (response.multipart.length > 1) {
        var typedArray = response.multipart[1].body;

        avs.player.enqueue(typedArray).then(function () {
          return avs.player.play();
        }).catch(function (error) {
          console.error(error);
        });
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

        var stringType = toString.call(item);

        var proceed = function proceed(audioBuffer) {
          _this3._queue.push(audioBuffer);
          _this3._log('Enqueue audio');
          _this3.emit(Player.EventTypes.ENQUEUE);
          return resolve(audioBuffer);
        };

        if (stringType === '[object DataView]' || stringType === '[object Uint8Array]') {
          arrayBufferToAudioBuffer(item.buffer, _this3._context).then(proceed);
        } else if (stringType === '[object AudioBuffer]') {
          proceed(item);
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
        } else {
          return _this5.deque().then(function (audioBuffer) {
            _this5.playAudioBuffer(audioBuffer);

            _this5._log('Play audio');
            _this5.emit(Player.EventTypes.PLAY);
          });
        }
      });
    }
  }, {
    key: 'stop',
    value: function stop() {
      var _this6 = this;

      return new Promise(function (resolve, reject) {
        if (_this6._currentSource) {
          _this6._currentSource.onended = function () {};
          _this6._currentSource.stop();
        }

        _this6._log('Stop audio');
        _this6.emit(Player.EventTypes.STOP);
      });
    }
  }, {
    key: 'pause',
    value: function pause() {
      var _this7 = this;

      return new Promise(function (resolve, reject) {
        if (_this7._context.state === 'running') {
          _this7._context.suspend();
        }

        _this7._log('Pause audio');
        _this7.emit(Player.EventTypes.PAUSE);
      });
    }
  }, {
    key: 'replay',
    value: function replay() {
      var _this8 = this;

      return new Promise(function (resolve, reject) {
        if (_this8._currentBuffer) {
          _this8._log('Replay audio');
          _this8.emit(Player.EventTypes.REPLAY);

          if (_this8._context.state === 'suspended') {
            _this8._context.resume();
          }

          _this8._currentSource.stop();
          _this8._currentSource.onended = function () {};

          return _this8.playAudioBuffer(_this8._currentBuffer);
        } else {
          var error = new Error('No audio source loaded.');
          _this8.emit('error', error);
          reject();
        }
      });
    }
  }, {
    key: 'playBlob',
    value: function playBlob(blob) {
      var _this9 = this;

      return new Promise(function (resolve, reject) {
        if (!blob) {
          reject();
        }

        var objectUrl = URL.createObjectURL(blob);
        var audio = new Audio();
        audio.src = objectUrl;

        audio.addEventListener('ended', function () {
          _this9._log('Audio ended');
          _this9.emit(Player.EventTypes.ENDED);
        });

        audio.onload = function (event) {
          URL.revokeObjectUrl(objectUrl);
        };

        _this9._log('Audio play started.');
        audio.play();

        resolve();
      });
    }
  }, {
    key: 'playAudioBuffer',
    value: function playAudioBuffer(buffer) {
      var _this10 = this;

      return new Promise(function (resolve, reject) {
        var source = _this10._context.createBufferSource();
        source.buffer = buffer;
        source.connect(_this10._context.destination);
        source.start(0);
        _this10._currentBuffer = buffer;
        _this10._currentSource = source;

        source.onended = function (event) {
          _this10._log('Audio ended');
          _this10.emit(Player.EventTypes.ENDED);
        };

        source.onerror = function (error) {
          _this10.emit('error', error);
        };

        resolve();
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

    context.decodeAudioData(arrayBuffer, resolve, reject);
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJpbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9idWZmZXIvaW5kZXguanMiLCJub2RlX21vZHVsZXMvYnVmZmVyL25vZGVfbW9kdWxlcy9iYXNlNjQtanMvbGliL2I2NC5qcyIsIm5vZGVfbW9kdWxlcy9idWZmZXIvbm9kZV9tb2R1bGVzL2llZWU3NTQvaW5kZXguanMiLCJub2RlX21vZHVsZXMvYnVmZmVyL25vZGVfbW9kdWxlcy9pc2FycmF5L2luZGV4LmpzIiwiLi4vaW5kZXguanMiLCIuLi9saWIvQVZTLmpzIiwiLi4vbGliL0FtYXpvbkVycm9yQ29kZXMuanMiLCIuLi9saWIvT2JzZXJ2YWJsZS5qcyIsIi4uL2xpYi9QbGF5ZXIuanMiLCIuLi9saWIvdXRpbHMvYXJyYXlCdWZmZXJUb0F1ZGlvQnVmZmVyLmpzIiwiLi4vbGliL3V0aWxzL2FycmF5QnVmZmVyVG9TdHJpbmcuanMiLCIuLi9saWIvdXRpbHMvZG93bnNhbXBsZUJ1ZmZlci5qcyIsIi4uL2xpYi91dGlscy9pbnRlcmxlYXZlLmpzIiwiLi4vbGliL3V0aWxzL21lcmdlQnVmZmVycy5qcyIsIi4uL2xpYi91dGlscy93cml0ZVVURkJ5dGVzLmpzIiwiLi4vbm9kZV9tb2R1bGVzL2h0dHAtbWVzc2FnZS1wYXJzZXIvaHR0cC1tZXNzYWdlLXBhcnNlci5qcyIsIi4uL25vZGVfbW9kdWxlcy9xcy9saWIvaW5kZXguanMiLCIuLi9ub2RlX21vZHVsZXMvcXMvbGliL3BhcnNlLmpzIiwiLi4vbm9kZV9tb2R1bGVzL3FzL2xpYi9zdHJpbmdpZnkuanMiLCIuLi9ub2RlX21vZHVsZXMvcXMvbGliL3V0aWxzLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7QUNBQSxJQUFNLE1BQU0sUUFBUSxLQUFSLENBQU47QUFDTixJQUFNLFNBQVMsSUFBSSxNQUFKOztBQUVmLElBQU0sTUFBTSxJQUFJLEdBQUosQ0FBUTtBQUNsQixT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QTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQ2g3Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3R0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcEZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7Ozs7O0FDTEEsQ0FBQyxZQUFXO0FBQ1YsZUFEVTs7QUFHVixNQUFNLE1BQU0sUUFBUSxXQUFSLENBQU4sQ0FISTs7QUFLVixNQUFJLE9B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QTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDbFVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwS0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25JQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCJjb25zdCBBVlMgPSByZXF1aXJlKCcuLi8nKTtcbmNvbnN0IHBsYXllciA9IEFWUy5QbGF5ZXI7XG5cbmNvbnN0IGF2cyA9IG5ldyBBVlMoe1xuICBkZWJ1ZzogdHJ1ZSxcbiAgY2xpZW50SWQ6ICdhbXpuMS5hcHBsaWNhdGlvbi1vYTItY2xpZW50LjY5NmFiOTBmYzU4NDRmZGJiOGVmYzE3Mzk0YTc5YzAwJyxcbiAgZGV2aWNlSWQ6ICd0ZXN0X2RldmljZScsXG4gIGRldmljZVNlcmlhbE51bWJlcjogMTIzLFxuICByZWRpcmVjdFVyaTogYGh0dHBzOi8vJHt3aW5kb3cubG9jYXRpb24uaG9zdH0vYXV0aHJlc3BvbnNlYFxufSk7XG5cbmF2cy5vbihBVlMuRXZlbnRUeXBlcy5UT0tFTl9TRVQsICgpID0+IHtcbiAgbG9naW5CdG4uZGlzYWJsZWQgPSB0cnVlO1xuICBsb2dvdXRCdG4uZGlzYWJsZWQgPSBmYWxzZTtcbiAgc3RhcnRSZWNvcmRpbmcuZGlzYWJsZWQgPSBmYWxzZTtcbiAgc3RvcFJlY29yZGluZy5kaXNhYmxlZCA9IHRydWU7XG59KTtcblxuYXZzLm9uKEFWUy5FdmVudFR5cGVzLlJFQ09SRF9TVEFSVCwgKCkgPT4ge1xuICBzdGFydFJlY29yZGluZy5kaXNhYmxlZCA9IHRydWU7XG4gIHN0b3BSZWNvcmRpbmcuZGlzYWJsZWQgPSBmYWxzZTtcbn0pO1xuXG5hdnMub24oQVZTLkV2ZW50VHlwZXMuUkVDT1JEX1NUT1AsICgpID0+IHtcbiAgc3RhcnRSZWNvcmRpbmcuZGlzYWJsZWQgPSBmYWxzZTtcbiAgc3RvcFJlY29yZGluZy5kaXNhYmxlZCA9IHRydWU7XG59KTtcblxuYXZzLm9uKEFWUy5FdmVudFR5cGVzLkxPR09VVCwgKCkgPT4ge1xuICBsb2dpbkJ0bi5kaXNhYmxlZCA9IGZhbHNlO1xuICBsb2dvdXRCdG4uZGlzYWJsZWQgPSB0cnVlO1xuICBzdGFydFJlY29yZGluZy5kaXNhYmxlZCA9IHRydWU7XG4gIHN0b3BSZWNvcmRpbmcuZGlzYWJsZWQgPSB0cnVlO1xufSk7XG5cbmF2cy5vbihBVlMuRXZlbnRUeXBlcy5UT0tFTl9JTlZBTElELCAoKSA9PiB7XG4gIGF2cy5sb2dvdXQoKVxuICAudGhlbihsb2dpbilcbn0pO1xuXG5hdnMub24oQVZTLkV2ZW50VHlwZXMuTE9HLCBsb2cpO1xuYXZzLm9uKEFWUy5FdmVudFR5cGVzLkVSUk9SLCBsb2dFcnJvcik7XG5cbmF2cy5wbGF5ZXIub24oQVZTLlBsYXllci5FdmVudFR5cGVzLkxPRywgbG9nKTtcbmF2cy5wbGF5ZXIub24oQVZTLlBsYXllci5FdmVudFR5cGVzLkVSUk9SLCBsb2dFcnJvcik7XG5cbmF2cy5wbGF5ZXIub24oQVZTLlBsYXllci5FdmVudFR5cGVzLlBMQVksICgpID0+IHtcbiAgcGxheUF1ZGlvLmRpc2FibGVkID0gdHJ1ZTtcbiAgcmVwbGF5QXVkaW8uZGlzYWJsZWQgPSB0cnVlO1xuICBwYXVzZUF1ZGlvLmRpc2FibGVkID0gZmFsc2U7XG4gIHN0b3BBdWRpby5kaXNhYmxlZCA9IGZhbHNlO1xufSk7XG5cbmF2cy5wbGF5ZXIub24oQVZTLlBsYXllci5FdmVudFR5cGVzLkVOREVELCAoKSA9PiB7XG4gIHBsYXlBdWRpby5kaXNhYmxlZCA9IHRydWU7XG4gIHJlcGxheUF1ZGlvLmRpc2FibGVkID0gZmFsc2U7XG4gIHBhdXNlQXVkaW8uZGlzYWJsZWQgPSB0cnVlO1xuICBzdG9wQXVkaW8uZGlzYWJsZWQgPSB0cnVlO1xufSk7XG5cbmF2cy5wbGF5ZXIub24oQVZTLlBsYXllci5FdmVudFR5cGVzLlNUT1AsICgpID0+IHtcbiAgcGxheUF1ZGlvLmRpc2FibGVkID0gdHJ1ZTtcbiAgcmVwbGF5QXVkaW8uZGlzYWJsZWQgPSBmYWxzZTtcbiAgcGF1c2VBdWRpby5kaXNhYmxlZCA9IGZhbHNlO1xuICBzdG9wQXVkaW8uZGlzYWJsZWQgPSBmYWxzZTtcbn0pO1xuXG5hdnMucGxheWVyLm9uKEFWUy5QbGF5ZXIuRXZlbnRUeXBlcy5QQVVTRSwgKCkgPT4ge1xuICBwbGF5QXVkaW8uZGlzYWJsZWQgPSBmYWxzZTtcbiAgcmVwbGF5QXVkaW8uZGlzYWJsZWQgPSBmYWxzZTtcbiAgcGF1c2VBdWRpby5kaXNhYmxlZCA9IHRydWU7XG4gIHN0b3BBdWRpby5kaXNhYmxlZCA9IHRydWU7XG59KTtcblxuYXZzLnBsYXllci5vbihBVlMuUGxheWVyLkV2ZW50VHlwZXMuUkVQTEFZLCAoKSA9PiB7XG4gIHBsYXlBdWRpby5kaXNhYmxlZCA9IHRydWU7XG4gIHJlcGxheUF1ZGlvLmRpc2FibGVkID0gdHJ1ZTtcbiAgcGF1c2VBdWRpby5kaXNhYmxlZCA9IGZhbHNlO1xuICBzdG9wQXVkaW8uZGlzYWJsZWQgPSBmYWxzZTtcbn0pO1xuXG5mdW5jdGlvbiBsb2cobWVzc2FnZSkge1xuICBsb2dPdXRwdXQuaW5uZXJIVE1MICs9IGA8bGk+TE9HOiAke21lc3NhZ2V9PC9saT5gO1xufVxuXG5mdW5jdGlvbiBsb2dFcnJvcihlcnJvcikge1xuICBsb2dPdXRwdXQuaW5uZXJIVE1MICs9IGA8bGk+RVJST1I6ICR7ZXJyb3J9PC9saT5gO1xufVxuXG5jb25zdCBsb2dpbkJ0biA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdsb2dpbicpO1xuY29uc3QgbG9nb3V0QnRuID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2xvZ291dCcpO1xuY29uc3QgbG9nT3V0cHV0ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2xvZycpO1xuY29uc3Qgc3RhcnRSZWNvcmRpbmcgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnc3RhcnRSZWNvcmRpbmcnKTtcbmNvbnN0IHN0b3BSZWNvcmRpbmcgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnc3RvcFJlY29yZGluZycpO1xuY29uc3Qgc3RvcEF1ZGlvID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3N0b3BBdWRpbycpO1xuY29uc3QgcGF1c2VBdWRpbyA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdwYXVzZUF1ZGlvJyk7XG5jb25zdCBwbGF5QXVkaW8gPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncGxheUF1ZGlvJyk7XG5jb25zdCByZXBsYXlBdWRpbyA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdyZXBsYXlBdWRpbycpO1xuXG4vKlxuLy8gSWYgdXNpbmcgY2xpZW50IHNlY3JldFxuYXZzLmdldENvZGVGcm9tVXJsKClcbiAudGhlbihjb2RlID0+IGF2cy5nZXRUb2tlbkZyb21Db2RlKGNvZGUpKVxuLnRoZW4odG9rZW4gPT4gbG9jYWxTdG9yYWdlLnNldEl0ZW0oJ3Rva2VuJywgdG9rZW4pKVxuLnRoZW4ocmVmcmVzaFRva2VuID0+IGxvY2FsU3RvcmFnZS5zZXRJdGVtKCdyZWZyZXNoVG9rZW4nLCByZWZyZXNoVG9rZW4pKVxuLnRoZW4oKCkgPT4gYXZzLnJlcXVlc3RNaWMoKSlcbi50aGVuKCgpID0+IGF2cy5yZWZyZXNoVG9rZW4oKSlcbi5jYXRjaCgoKSA9PiB7XG5cbn0pO1xuKi9cblxuYXZzLmdldFRva2VuRnJvbVVybCgpXG4udGhlbigoKSA9PiBhdnMuZ2V0VG9rZW4oKSlcbi50aGVuKHRva2VuID0+IGxvY2FsU3RvcmFnZS5zZXRJdGVtKCd0b2tlbicsIHRva2VuKSlcbi50aGVuKCgpID0+IGF2cy5yZXF1ZXN0TWljKCkpXG4uY2F0Y2goKCkgPT4ge1xuICBjb25zdCBjYWNoZWRUb2tlbiA9IGxvY2FsU3RvcmFnZS5nZXRJdGVtKCd0b2tlbicpO1xuXG4gIGlmIChjYWNoZWRUb2tlbikge1xuICAgIGF2cy5zZXRUb2tlbihjYWNoZWRUb2tlbik7XG4gICAgcmV0dXJuIGF2cy5yZXF1ZXN0TWljKCk7XG4gIH1cbn0pO1xuXG5sb2dpbkJ0bi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIGxvZ2luKTtcblxuZnVuY3Rpb24gbG9naW4oZXZlbnQpIHtcbiAgcmV0dXJuIGF2cy5sb2dpbigpXG4gIC50aGVuKCgpID0+IGF2cy5yZXF1ZXN0TWljKCkpXG4gIC5jYXRjaCgoKSA9PiB7fSk7XG5cbiAgLypcbiAgLy8gSWYgdXNpbmcgY2xpZW50IHNlY3JldFxuICBhdnMubG9naW4oe3Jlc3BvbnNlVHlwZTogJ2NvZGUnfSlcbiAgLnRoZW4oKCkgPT4gYXZzLnJlcXVlc3RNaWMoKSlcbiAgLmNhdGNoKCgpID0+IHt9KTtcbiAgKi9cbn1cblxubG9nb3V0QnRuLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgbG9nb3V0KTtcblxuZnVuY3Rpb24gbG9nb3V0KCkge1xuICByZXR1cm4gYXZzLmxvZ291dCgpXG4gIC50aGVuKCgpID0+IHtcbiAgICBsb2NhbFN0b3JhZ2UucmVtb3ZlSXRlbSgndG9rZW4nKTtcbiAgICB3aW5kb3cubG9jYXRpb24uaGFzaCA9ICcnO1xuICB9KTtcbn1cblxuc3RhcnRSZWNvcmRpbmcuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7XG4gIGF2cy5zdGFydFJlY29yZGluZygpO1xufSk7XG5cbnN0b3BSZWNvcmRpbmcuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7XG4gIGF2cy5zdG9wUmVjb3JkaW5nKCkudGhlbihkYXRhVmlldyA9PiB7XG4gICAgYXZzLnBsYXllci5lbXB0eVF1ZXVlKClcbiAgICAudGhlbigoKSA9PiBhdnMucGxheWVyLmVucXVldWUoZGF0YVZpZXcpKVxuICAgIC50aGVuKCgpID0+IGF2cy5wbGF5ZXIucGxheSgpKVxuICAgIC5jYXRjaChlcnJvciA9PiB7XG4gICAgICBjb25zb2xlLmVycm9yKGVycm9yKTtcbiAgICB9KTtcblxuICAgIC8vc2VuZEJsb2IoYmxvYik7XG4gICAgYXZzLnNlbmRBdWRpbyhkYXRhVmlldylcbiAgICAudGhlbihyZXNwb25zZSA9PiB7XG5cbiAgICAgIGlmIChyZXNwb25zZS5tdWx0aXBhcnQubGVuZ3RoID4gMSkge1xuICAgICAgICBjb25zdCB0eXBlZEFycmF5ID0gcmVzcG9uc2UubXVsdGlwYXJ0WzFdLmJvZHk7XG5cbiAgICAgICAgYXZzLnBsYXllci5lbnF1ZXVlKHR5cGVkQXJyYXkpXG4gICAgICAgIC50aGVuKCgpID0+IGF2cy5wbGF5ZXIucGxheSgpKVxuICAgICAgICAuY2F0Y2goZXJyb3IgPT4ge1xuICAgICAgICAgIGNvbnNvbGUuZXJyb3IoZXJyb3IpO1xuICAgICAgICB9KTtcbiAgICAgIH1cblxuICAgIH0pXG4gICAgLmNhdGNoKGVycm9yID0+IHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoZXJyb3IpO1xuICAgIH0pO1xuICB9KTtcbn0pO1xuXG5zdG9wQXVkaW8uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoZXZlbnQpID0+IHtcbiAgYXZzLnBsYXllci5zdG9wKCk7XG59KTtcblxucGF1c2VBdWRpby5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIChldmVudCkgPT4ge1xuICBhdnMucGxheWVyLnBhdXNlKCk7XG59KTtcblxucGxheUF1ZGlvLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKGV2ZW50KSA9PiB7XG4gIGF2cy5wbGF5ZXIucGxheSgpO1xufSk7XG5cbnJlcGxheUF1ZGlvLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKGV2ZW50KSA9PiB7XG4gIGF2cy5wbGF5ZXIucmVwbGF5KCk7XG59KTtcblxuZnVuY3Rpb24gc2VuZEJsb2IoYmxvYikge1xuICBjb25zdCB4aHIgPSBuZXcgWE1MSHR0cFJlcXVlc3QoKTtcbiAgY29uc3QgZmQgPSBuZXcgRm9ybURhdGEoKTtcblxuICBmZC5hcHBlbmQoJ2ZuYW1lJywgJ2F1ZGlvLndhdicpO1xuICBmZC5hcHBlbmQoJ2RhdGEnLCBibG9iKTtcblxuICB4aHIub3BlbignUE9TVCcsICdodHRwOi8vbG9jYWxob3N0OjU1NTUvYXVkaW8nLCB0cnVlKTtcbiAgeGhyLnJlc3BvbnNlVHlwZSA9ICdibG9iJztcblxuICB4aHIub25sb2FkID0gKGV2ZW50KSA9PiB7XG4gICAgaWYgKHhoci5zdGF0dXMgPT0gMjAwKSB7XG4gICAgICBjb25zb2xlLmxvZyh4aHIucmVzcG9uc2UpO1xuICAgICAgLy9jb25zdCByZXNwb25zZUJsb2IgPSBuZXcgQmxvYihbeGhyLnJlc3BvbnNlXSwge3R5cGU6ICdhdWRpby9tcDMnfSk7XG4gICAgfVxuICB9O1xuICB4aHIuc2VuZChmZCk7XG59XG4iLCIvKiFcbiAqIFRoZSBidWZmZXIgbW9kdWxlIGZyb20gbm9kZS5qcywgZm9yIHRoZSBicm93c2VyLlxuICpcbiAqIEBhdXRob3IgICBGZXJvc3MgQWJvdWtoYWRpamVoIDxmZXJvc3NAZmVyb3NzLm9yZz4gPGh0dHA6Ly9mZXJvc3Mub3JnPlxuICogQGxpY2Vuc2UgIE1JVFxuICovXG4vKiBlc2xpbnQtZGlzYWJsZSBuby1wcm90byAqL1xuXG4ndXNlIHN0cmljdCdcblxudmFyIGJhc2U2NCA9IHJlcXVpcmUoJ2Jhc2U2NC1qcycpXG52YXIgaWVlZTc1NCA9IHJlcXVpcmUoJ2llZWU3NTQnKVxudmFyIGlzQXJyYXkgPSByZXF1aXJlKCdpc2FycmF5JylcblxuZXhwb3J0cy5CdWZmZXIgPSBCdWZmZXJcbmV4cG9ydHMuU2xvd0J1ZmZlciA9IFNsb3dCdWZmZXJcbmV4cG9ydHMuSU5TUEVDVF9NQVhfQllURVMgPSA1MFxuQnVmZmVyLnBvb2xTaXplID0gODE5MiAvLyBub3QgdXNlZCBieSB0aGlzIGltcGxlbWVudGF0aW9uXG5cbnZhciByb290UGFyZW50ID0ge31cblxuLyoqXG4gKiBJZiBgQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlRgOlxuICogICA9PT0gdHJ1ZSAgICBVc2UgVWludDhBcnJheSBpbXBsZW1lbnRhdGlvbiAoZmFzdGVzdClcbiAqICAgPT09IGZhbHNlICAgVXNlIE9iamVjdCBpbXBsZW1lbnRhdGlvbiAobW9zdCBjb21wYXRpYmxlLCBldmVuIElFNilcbiAqXG4gKiBCcm93c2VycyB0aGF0IHN1cHBvcnQgdHlwZWQgYXJyYXlzIGFyZSBJRSAxMCssIEZpcmVmb3ggNCssIENocm9tZSA3KywgU2FmYXJpIDUuMSssXG4gKiBPcGVyYSAxMS42KywgaU9TIDQuMisuXG4gKlxuICogRHVlIHRvIHZhcmlvdXMgYnJvd3NlciBidWdzLCBzb21ldGltZXMgdGhlIE9iamVjdCBpbXBsZW1lbnRhdGlvbiB3aWxsIGJlIHVzZWQgZXZlblxuICogd2hlbiB0aGUgYnJvd3NlciBzdXBwb3J0cyB0eXBlZCBhcnJheXMuXG4gKlxuICogTm90ZTpcbiAqXG4gKiAgIC0gRmlyZWZveCA0LTI5IGxhY2tzIHN1cHBvcnQgZm9yIGFkZGluZyBuZXcgcHJvcGVydGllcyB0byBgVWludDhBcnJheWAgaW5zdGFuY2VzLFxuICogICAgIFNlZTogaHR0cHM6Ly9idWd6aWxsYS5tb3ppbGxhLm9yZy9zaG93X2J1Zy5jZ2k/aWQ9Njk1NDM4LlxuICpcbiAqICAgLSBDaHJvbWUgOS0xMCBpcyBtaXNzaW5nIHRoZSBgVHlwZWRBcnJheS5wcm90b3R5cGUuc3ViYXJyYXlgIGZ1bmN0aW9uLlxuICpcbiAqICAgLSBJRTEwIGhhcyBhIGJyb2tlbiBgVHlwZWRBcnJheS5wcm90b3R5cGUuc3ViYXJyYXlgIGZ1bmN0aW9uIHdoaWNoIHJldHVybnMgYXJyYXlzIG9mXG4gKiAgICAgaW5jb3JyZWN0IGxlbmd0aCBpbiBzb21lIHNpdHVhdGlvbnMuXG5cbiAqIFdlIGRldGVjdCB0aGVzZSBidWdneSBicm93c2VycyBhbmQgc2V0IGBCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVGAgdG8gYGZhbHNlYCBzbyB0aGV5XG4gKiBnZXQgdGhlIE9iamVjdCBpbXBsZW1lbnRhdGlvbiwgd2hpY2ggaXMgc2xvd2VyIGJ1dCBiZWhhdmVzIGNvcnJlY3RseS5cbiAqL1xuQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQgPSBnbG9iYWwuVFlQRURfQVJSQVlfU1VQUE9SVCAhPT0gdW5kZWZpbmVkXG4gID8gZ2xvYmFsLlRZUEVEX0FSUkFZX1NVUFBPUlRcbiAgOiB0eXBlZEFycmF5U3VwcG9ydCgpXG5cbmZ1bmN0aW9uIHR5cGVkQXJyYXlTdXBwb3J0ICgpIHtcbiAgdHJ5IHtcbiAgICB2YXIgYXJyID0gbmV3IFVpbnQ4QXJyYXkoMSlcbiAgICBhcnIuZm9vID0gZnVuY3Rpb24gKCkgeyByZXR1cm4gNDIgfVxuICAgIHJldHVybiBhcnIuZm9vKCkgPT09IDQyICYmIC8vIHR5cGVkIGFycmF5IGluc3RhbmNlcyBjYW4gYmUgYXVnbWVudGVkXG4gICAgICAgIHR5cGVvZiBhcnIuc3ViYXJyYXkgPT09ICdmdW5jdGlvbicgJiYgLy8gY2hyb21lIDktMTAgbGFjayBgc3ViYXJyYXlgXG4gICAgICAgIGFyci5zdWJhcnJheSgxLCAxKS5ieXRlTGVuZ3RoID09PSAwIC8vIGllMTAgaGFzIGJyb2tlbiBgc3ViYXJyYXlgXG4gIH0gY2F0Y2ggKGUpIHtcbiAgICByZXR1cm4gZmFsc2VcbiAgfVxufVxuXG5mdW5jdGlvbiBrTWF4TGVuZ3RoICgpIHtcbiAgcmV0dXJuIEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUXG4gICAgPyAweDdmZmZmZmZmXG4gICAgOiAweDNmZmZmZmZmXG59XG5cbi8qKlxuICogVGhlIEJ1ZmZlciBjb25zdHJ1Y3RvciByZXR1cm5zIGluc3RhbmNlcyBvZiBgVWludDhBcnJheWAgdGhhdCBoYXZlIHRoZWlyXG4gKiBwcm90b3R5cGUgY2hhbmdlZCB0byBgQnVmZmVyLnByb3RvdHlwZWAuIEZ1cnRoZXJtb3JlLCBgQnVmZmVyYCBpcyBhIHN1YmNsYXNzIG9mXG4gKiBgVWludDhBcnJheWAsIHNvIHRoZSByZXR1cm5lZCBpbnN0YW5jZXMgd2lsbCBoYXZlIGFsbCB0aGUgbm9kZSBgQnVmZmVyYCBtZXRob2RzXG4gKiBhbmQgdGhlIGBVaW50OEFycmF5YCBtZXRob2RzLiBTcXVhcmUgYnJhY2tldCBub3RhdGlvbiB3b3JrcyBhcyBleHBlY3RlZCAtLSBpdFxuICogcmV0dXJucyBhIHNpbmdsZSBvY3RldC5cbiAqXG4gKiBUaGUgYFVpbnQ4QXJyYXlgIHByb3RvdHlwZSByZW1haW5zIHVubW9kaWZpZWQuXG4gKi9cbmZ1bmN0aW9uIEJ1ZmZlciAoYXJnKSB7XG4gIGlmICghKHRoaXMgaW5zdGFuY2VvZiBCdWZmZXIpKSB7XG4gICAgLy8gQXZvaWQgZ29pbmcgdGhyb3VnaCBhbiBBcmd1bWVudHNBZGFwdG9yVHJhbXBvbGluZSBpbiB0aGUgY29tbW9uIGNhc2UuXG4gICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPiAxKSByZXR1cm4gbmV3IEJ1ZmZlcihhcmcsIGFyZ3VtZW50c1sxXSlcbiAgICByZXR1cm4gbmV3IEJ1ZmZlcihhcmcpXG4gIH1cblxuICBpZiAoIUJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgdGhpcy5sZW5ndGggPSAwXG4gICAgdGhpcy5wYXJlbnQgPSB1bmRlZmluZWRcbiAgfVxuXG4gIC8vIENvbW1vbiBjYXNlLlxuICBpZiAodHlwZW9mIGFyZyA9PT0gJ251bWJlcicpIHtcbiAgICByZXR1cm4gZnJvbU51bWJlcih0aGlzLCBhcmcpXG4gIH1cblxuICAvLyBTbGlnaHRseSBsZXNzIGNvbW1vbiBjYXNlLlxuICBpZiAodHlwZW9mIGFyZyA9PT0gJ3N0cmluZycpIHtcbiAgICByZXR1cm4gZnJvbVN0cmluZyh0aGlzLCBhcmcsIGFyZ3VtZW50cy5sZW5ndGggPiAxID8gYXJndW1lbnRzWzFdIDogJ3V0ZjgnKVxuICB9XG5cbiAgLy8gVW51c3VhbC5cbiAgcmV0dXJuIGZyb21PYmplY3QodGhpcywgYXJnKVxufVxuXG4vLyBUT0RPOiBMZWdhY3ksIG5vdCBuZWVkZWQgYW55bW9yZS4gUmVtb3ZlIGluIG5leHQgbWFqb3IgdmVyc2lvbi5cbkJ1ZmZlci5fYXVnbWVudCA9IGZ1bmN0aW9uIChhcnIpIHtcbiAgYXJyLl9fcHJvdG9fXyA9IEJ1ZmZlci5wcm90b3R5cGVcbiAgcmV0dXJuIGFyclxufVxuXG5mdW5jdGlvbiBmcm9tTnVtYmVyICh0aGF0LCBsZW5ndGgpIHtcbiAgdGhhdCA9IGFsbG9jYXRlKHRoYXQsIGxlbmd0aCA8IDAgPyAwIDogY2hlY2tlZChsZW5ndGgpIHwgMClcbiAgaWYgKCFCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkge1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAgIHRoYXRbaV0gPSAwXG4gICAgfVxuICB9XG4gIHJldHVybiB0aGF0XG59XG5cbmZ1bmN0aW9uIGZyb21TdHJpbmcgKHRoYXQsIHN0cmluZywgZW5jb2RpbmcpIHtcbiAgaWYgKHR5cGVvZiBlbmNvZGluZyAhPT0gJ3N0cmluZycgfHwgZW5jb2RpbmcgPT09ICcnKSBlbmNvZGluZyA9ICd1dGY4J1xuXG4gIC8vIEFzc3VtcHRpb246IGJ5dGVMZW5ndGgoKSByZXR1cm4gdmFsdWUgaXMgYWx3YXlzIDwga01heExlbmd0aC5cbiAgdmFyIGxlbmd0aCA9IGJ5dGVMZW5ndGgoc3RyaW5nLCBlbmNvZGluZykgfCAwXG4gIHRoYXQgPSBhbGxvY2F0ZSh0aGF0LCBsZW5ndGgpXG5cbiAgdGhhdC53cml0ZShzdHJpbmcsIGVuY29kaW5nKVxuICByZXR1cm4gdGhhdFxufVxuXG5mdW5jdGlvbiBmcm9tT2JqZWN0ICh0aGF0LCBvYmplY3QpIHtcbiAgaWYgKEJ1ZmZlci5pc0J1ZmZlcihvYmplY3QpKSByZXR1cm4gZnJvbUJ1ZmZlcih0aGF0LCBvYmplY3QpXG5cbiAgaWYgKGlzQXJyYXkob2JqZWN0KSkgcmV0dXJuIGZyb21BcnJheSh0aGF0LCBvYmplY3QpXG5cbiAgaWYgKG9iamVjdCA9PSBudWxsKSB7XG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcignbXVzdCBzdGFydCB3aXRoIG51bWJlciwgYnVmZmVyLCBhcnJheSBvciBzdHJpbmcnKVxuICB9XG5cbiAgaWYgKHR5cGVvZiBBcnJheUJ1ZmZlciAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICBpZiAob2JqZWN0LmJ1ZmZlciBpbnN0YW5jZW9mIEFycmF5QnVmZmVyKSB7XG4gICAgICByZXR1cm4gZnJvbVR5cGVkQXJyYXkodGhhdCwgb2JqZWN0KVxuICAgIH1cbiAgICBpZiAob2JqZWN0IGluc3RhbmNlb2YgQXJyYXlCdWZmZXIpIHtcbiAgICAgIHJldHVybiBmcm9tQXJyYXlCdWZmZXIodGhhdCwgb2JqZWN0KVxuICAgIH1cbiAgfVxuXG4gIGlmIChvYmplY3QubGVuZ3RoKSByZXR1cm4gZnJvbUFycmF5TGlrZSh0aGF0LCBvYmplY3QpXG5cbiAgcmV0dXJuIGZyb21Kc29uT2JqZWN0KHRoYXQsIG9iamVjdClcbn1cblxuZnVuY3Rpb24gZnJvbUJ1ZmZlciAodGhhdCwgYnVmZmVyKSB7XG4gIHZhciBsZW5ndGggPSBjaGVja2VkKGJ1ZmZlci5sZW5ndGgpIHwgMFxuICB0aGF0ID0gYWxsb2NhdGUodGhhdCwgbGVuZ3RoKVxuICBidWZmZXIuY29weSh0aGF0LCAwLCAwLCBsZW5ndGgpXG4gIHJldHVybiB0aGF0XG59XG5cbmZ1bmN0aW9uIGZyb21BcnJheSAodGhhdCwgYXJyYXkpIHtcbiAgdmFyIGxlbmd0aCA9IGNoZWNrZWQoYXJyYXkubGVuZ3RoKSB8IDBcbiAgdGhhdCA9IGFsbG9jYXRlKHRoYXQsIGxlbmd0aClcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7IGkgKz0gMSkge1xuICAgIHRoYXRbaV0gPSBhcnJheVtpXSAmIDI1NVxuICB9XG4gIHJldHVybiB0aGF0XG59XG5cbi8vIER1cGxpY2F0ZSBvZiBmcm9tQXJyYXkoKSB0byBrZWVwIGZyb21BcnJheSgpIG1vbm9tb3JwaGljLlxuZnVuY3Rpb24gZnJvbVR5cGVkQXJyYXkgKHRoYXQsIGFycmF5KSB7XG4gIHZhciBsZW5ndGggPSBjaGVja2VkKGFycmF5Lmxlbmd0aCkgfCAwXG4gIHRoYXQgPSBhbGxvY2F0ZSh0aGF0LCBsZW5ndGgpXG4gIC8vIFRydW5jYXRpbmcgdGhlIGVsZW1lbnRzIGlzIHByb2JhYmx5IG5vdCB3aGF0IHBlb3BsZSBleHBlY3QgZnJvbSB0eXBlZFxuICAvLyBhcnJheXMgd2l0aCBCWVRFU19QRVJfRUxFTUVOVCA+IDEgYnV0IGl0J3MgY29tcGF0aWJsZSB3aXRoIHRoZSBiZWhhdmlvclxuICAvLyBvZiB0aGUgb2xkIEJ1ZmZlciBjb25zdHJ1Y3Rvci5cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7IGkgKz0gMSkge1xuICAgIHRoYXRbaV0gPSBhcnJheVtpXSAmIDI1NVxuICB9XG4gIHJldHVybiB0aGF0XG59XG5cbmZ1bmN0aW9uIGZyb21BcnJheUJ1ZmZlciAodGhhdCwgYXJyYXkpIHtcbiAgYXJyYXkuYnl0ZUxlbmd0aCAvLyB0aGlzIHRocm93cyBpZiBgYXJyYXlgIGlzIG5vdCBhIHZhbGlkIEFycmF5QnVmZmVyXG5cbiAgaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgLy8gUmV0dXJuIGFuIGF1Z21lbnRlZCBgVWludDhBcnJheWAgaW5zdGFuY2UsIGZvciBiZXN0IHBlcmZvcm1hbmNlXG4gICAgdGhhdCA9IG5ldyBVaW50OEFycmF5KGFycmF5KVxuICAgIHRoYXQuX19wcm90b19fID0gQnVmZmVyLnByb3RvdHlwZVxuICB9IGVsc2Uge1xuICAgIC8vIEZhbGxiYWNrOiBSZXR1cm4gYW4gb2JqZWN0IGluc3RhbmNlIG9mIHRoZSBCdWZmZXIgY2xhc3NcbiAgICB0aGF0ID0gZnJvbVR5cGVkQXJyYXkodGhhdCwgbmV3IFVpbnQ4QXJyYXkoYXJyYXkpKVxuICB9XG4gIHJldHVybiB0aGF0XG59XG5cbmZ1bmN0aW9uIGZyb21BcnJheUxpa2UgKHRoYXQsIGFycmF5KSB7XG4gIHZhciBsZW5ndGggPSBjaGVja2VkKGFycmF5Lmxlbmd0aCkgfCAwXG4gIHRoYXQgPSBhbGxvY2F0ZSh0aGF0LCBsZW5ndGgpXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuZ3RoOyBpICs9IDEpIHtcbiAgICB0aGF0W2ldID0gYXJyYXlbaV0gJiAyNTVcbiAgfVxuICByZXR1cm4gdGhhdFxufVxuXG4vLyBEZXNlcmlhbGl6ZSB7IHR5cGU6ICdCdWZmZXInLCBkYXRhOiBbMSwyLDMsLi4uXSB9IGludG8gYSBCdWZmZXIgb2JqZWN0LlxuLy8gUmV0dXJucyBhIHplcm8tbGVuZ3RoIGJ1ZmZlciBmb3IgaW5wdXRzIHRoYXQgZG9uJ3QgY29uZm9ybSB0byB0aGUgc3BlYy5cbmZ1bmN0aW9uIGZyb21Kc29uT2JqZWN0ICh0aGF0LCBvYmplY3QpIHtcbiAgdmFyIGFycmF5XG4gIHZhciBsZW5ndGggPSAwXG5cbiAgaWYgKG9iamVjdC50eXBlID09PSAnQnVmZmVyJyAmJiBpc0FycmF5KG9iamVjdC5kYXRhKSkge1xuICAgIGFycmF5ID0gb2JqZWN0LmRhdGFcbiAgICBsZW5ndGggPSBjaGVja2VkKGFycmF5Lmxlbmd0aCkgfCAwXG4gIH1cbiAgdGhhdCA9IGFsbG9jYXRlKHRoYXQsIGxlbmd0aClcblxuICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbmd0aDsgaSArPSAxKSB7XG4gICAgdGhhdFtpXSA9IGFycmF5W2ldICYgMjU1XG4gIH1cbiAgcmV0dXJuIHRoYXRcbn1cblxuaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gIEJ1ZmZlci5wcm90b3R5cGUuX19wcm90b19fID0gVWludDhBcnJheS5wcm90b3R5cGVcbiAgQnVmZmVyLl9fcHJvdG9fXyA9IFVpbnQ4QXJyYXlcbiAgaWYgKHR5cGVvZiBTeW1ib2wgIT09ICd1bmRlZmluZWQnICYmIFN5bWJvbC5zcGVjaWVzICYmXG4gICAgICBCdWZmZXJbU3ltYm9sLnNwZWNpZXNdID09PSBCdWZmZXIpIHtcbiAgICAvLyBGaXggc3ViYXJyYXkoKSBpbiBFUzIwMTYuIFNlZTogaHR0cHM6Ly9naXRodWIuY29tL2Zlcm9zcy9idWZmZXIvcHVsbC85N1xuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShCdWZmZXIsIFN5bWJvbC5zcGVjaWVzLCB7XG4gICAgICB2YWx1ZTogbnVsbCxcbiAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZVxuICAgIH0pXG4gIH1cbn0gZWxzZSB7XG4gIC8vIHByZS1zZXQgZm9yIHZhbHVlcyB0aGF0IG1heSBleGlzdCBpbiB0aGUgZnV0dXJlXG4gIEJ1ZmZlci5wcm90b3R5cGUubGVuZ3RoID0gdW5kZWZpbmVkXG4gIEJ1ZmZlci5wcm90b3R5cGUucGFyZW50ID0gdW5kZWZpbmVkXG59XG5cbmZ1bmN0aW9uIGFsbG9jYXRlICh0aGF0LCBsZW5ndGgpIHtcbiAgaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgLy8gUmV0dXJuIGFuIGF1Z21lbnRlZCBgVWludDhBcnJheWAgaW5zdGFuY2UsIGZvciBiZXN0IHBlcmZvcm1hbmNlXG4gICAgdGhhdCA9IG5ldyBVaW50OEFycmF5KGxlbmd0aClcbiAgICB0aGF0Ll9fcHJvdG9fXyA9IEJ1ZmZlci5wcm90b3R5cGVcbiAgfSBlbHNlIHtcbiAgICAvLyBGYWxsYmFjazogUmV0dXJuIGFuIG9iamVjdCBpbnN0YW5jZSBvZiB0aGUgQnVmZmVyIGNsYXNzXG4gICAgdGhhdC5sZW5ndGggPSBsZW5ndGhcbiAgfVxuXG4gIHZhciBmcm9tUG9vbCA9IGxlbmd0aCAhPT0gMCAmJiBsZW5ndGggPD0gQnVmZmVyLnBvb2xTaXplID4+PiAxXG4gIGlmIChmcm9tUG9vbCkgdGhhdC5wYXJlbnQgPSByb290UGFyZW50XG5cbiAgcmV0dXJuIHRoYXRcbn1cblxuZnVuY3Rpb24gY2hlY2tlZCAobGVuZ3RoKSB7XG4gIC8vIE5vdGU6IGNhbm5vdCB1c2UgYGxlbmd0aCA8IGtNYXhMZW5ndGhgIGhlcmUgYmVjYXVzZSB0aGF0IGZhaWxzIHdoZW5cbiAgLy8gbGVuZ3RoIGlzIE5hTiAod2hpY2ggaXMgb3RoZXJ3aXNlIGNvZXJjZWQgdG8gemVyby4pXG4gIGlmIChsZW5ndGggPj0ga01heExlbmd0aCgpKSB7XG4gICAgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ0F0dGVtcHQgdG8gYWxsb2NhdGUgQnVmZmVyIGxhcmdlciB0aGFuIG1heGltdW0gJyArXG4gICAgICAgICAgICAgICAgICAgICAgICAgJ3NpemU6IDB4JyArIGtNYXhMZW5ndGgoKS50b1N0cmluZygxNikgKyAnIGJ5dGVzJylcbiAgfVxuICByZXR1cm4gbGVuZ3RoIHwgMFxufVxuXG5mdW5jdGlvbiBTbG93QnVmZmVyIChzdWJqZWN0LCBlbmNvZGluZykge1xuICBpZiAoISh0aGlzIGluc3RhbmNlb2YgU2xvd0J1ZmZlcikpIHJldHVybiBuZXcgU2xvd0J1ZmZlcihzdWJqZWN0LCBlbmNvZGluZylcblxuICB2YXIgYnVmID0gbmV3IEJ1ZmZlcihzdWJqZWN0LCBlbmNvZGluZylcbiAgZGVsZXRlIGJ1Zi5wYXJlbnRcbiAgcmV0dXJuIGJ1ZlxufVxuXG5CdWZmZXIuaXNCdWZmZXIgPSBmdW5jdGlvbiBpc0J1ZmZlciAoYikge1xuICByZXR1cm4gISEoYiAhPSBudWxsICYmIGIuX2lzQnVmZmVyKVxufVxuXG5CdWZmZXIuY29tcGFyZSA9IGZ1bmN0aW9uIGNvbXBhcmUgKGEsIGIpIHtcbiAgaWYgKCFCdWZmZXIuaXNCdWZmZXIoYSkgfHwgIUJ1ZmZlci5pc0J1ZmZlcihiKSkge1xuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ0FyZ3VtZW50cyBtdXN0IGJlIEJ1ZmZlcnMnKVxuICB9XG5cbiAgaWYgKGEgPT09IGIpIHJldHVybiAwXG5cbiAgdmFyIHggPSBhLmxlbmd0aFxuICB2YXIgeSA9IGIubGVuZ3RoXG5cbiAgZm9yICh2YXIgaSA9IDAsIGxlbiA9IE1hdGgubWluKHgsIHkpOyBpIDwgbGVuOyArK2kpIHtcbiAgICBpZiAoYVtpXSAhPT0gYltpXSkge1xuICAgICAgeCA9IGFbaV1cbiAgICAgIHkgPSBiW2ldXG4gICAgICBicmVha1xuICAgIH1cbiAgfVxuXG4gIGlmICh4IDwgeSkgcmV0dXJuIC0xXG4gIGlmICh5IDwgeCkgcmV0dXJuIDFcbiAgcmV0dXJuIDBcbn1cblxuQnVmZmVyLmlzRW5jb2RpbmcgPSBmdW5jdGlvbiBpc0VuY29kaW5nIChlbmNvZGluZykge1xuICBzd2l0Y2ggKFN0cmluZyhlbmNvZGluZykudG9Mb3dlckNhc2UoKSkge1xuICAgIGNhc2UgJ2hleCc6XG4gICAgY2FzZSAndXRmOCc6XG4gICAgY2FzZSAndXRmLTgnOlxuICAgIGNhc2UgJ2FzY2lpJzpcbiAgICBjYXNlICdiaW5hcnknOlxuICAgIGNhc2UgJ2Jhc2U2NCc6XG4gICAgY2FzZSAncmF3JzpcbiAgICBjYXNlICd1Y3MyJzpcbiAgICBjYXNlICd1Y3MtMic6XG4gICAgY2FzZSAndXRmMTZsZSc6XG4gICAgY2FzZSAndXRmLTE2bGUnOlxuICAgICAgcmV0dXJuIHRydWVcbiAgICBkZWZhdWx0OlxuICAgICAgcmV0dXJuIGZhbHNlXG4gIH1cbn1cblxuQnVmZmVyLmNvbmNhdCA9IGZ1bmN0aW9uIGNvbmNhdCAobGlzdCwgbGVuZ3RoKSB7XG4gIGlmICghaXNBcnJheShsaXN0KSkgdGhyb3cgbmV3IFR5cGVFcnJvcignbGlzdCBhcmd1bWVudCBtdXN0IGJlIGFuIEFycmF5IG9mIEJ1ZmZlcnMuJylcblxuICBpZiAobGlzdC5sZW5ndGggPT09IDApIHtcbiAgICByZXR1cm4gbmV3IEJ1ZmZlcigwKVxuICB9XG5cbiAgdmFyIGlcbiAgaWYgKGxlbmd0aCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgbGVuZ3RoID0gMFxuICAgIGZvciAoaSA9IDA7IGkgPCBsaXN0Lmxlbmd0aDsgaSsrKSB7XG4gICAgICBsZW5ndGggKz0gbGlzdFtpXS5sZW5ndGhcbiAgICB9XG4gIH1cblxuICB2YXIgYnVmID0gbmV3IEJ1ZmZlcihsZW5ndGgpXG4gIHZhciBwb3MgPSAwXG4gIGZvciAoaSA9IDA7IGkgPCBsaXN0Lmxlbmd0aDsgaSsrKSB7XG4gICAgdmFyIGl0ZW0gPSBsaXN0W2ldXG4gICAgaXRlbS5jb3B5KGJ1ZiwgcG9zKVxuICAgIHBvcyArPSBpdGVtLmxlbmd0aFxuICB9XG4gIHJldHVybiBidWZcbn1cblxuZnVuY3Rpb24gYnl0ZUxlbmd0aCAoc3RyaW5nLCBlbmNvZGluZykge1xuICBpZiAodHlwZW9mIHN0cmluZyAhPT0gJ3N0cmluZycpIHN0cmluZyA9ICcnICsgc3RyaW5nXG5cbiAgdmFyIGxlbiA9IHN0cmluZy5sZW5ndGhcbiAgaWYgKGxlbiA9PT0gMCkgcmV0dXJuIDBcblxuICAvLyBVc2UgYSBmb3IgbG9vcCB0byBhdm9pZCByZWN1cnNpb25cbiAgdmFyIGxvd2VyZWRDYXNlID0gZmFsc2VcbiAgZm9yICg7Oykge1xuICAgIHN3aXRjaCAoZW5jb2RpbmcpIHtcbiAgICAgIGNhc2UgJ2FzY2lpJzpcbiAgICAgIGNhc2UgJ2JpbmFyeSc6XG4gICAgICAvLyBEZXByZWNhdGVkXG4gICAgICBjYXNlICdyYXcnOlxuICAgICAgY2FzZSAncmF3cyc6XG4gICAgICAgIHJldHVybiBsZW5cbiAgICAgIGNhc2UgJ3V0ZjgnOlxuICAgICAgY2FzZSAndXRmLTgnOlxuICAgICAgICByZXR1cm4gdXRmOFRvQnl0ZXMoc3RyaW5nKS5sZW5ndGhcbiAgICAgIGNhc2UgJ3VjczInOlxuICAgICAgY2FzZSAndWNzLTInOlxuICAgICAgY2FzZSAndXRmMTZsZSc6XG4gICAgICBjYXNlICd1dGYtMTZsZSc6XG4gICAgICAgIHJldHVybiBsZW4gKiAyXG4gICAgICBjYXNlICdoZXgnOlxuICAgICAgICByZXR1cm4gbGVuID4+PiAxXG4gICAgICBjYXNlICdiYXNlNjQnOlxuICAgICAgICByZXR1cm4gYmFzZTY0VG9CeXRlcyhzdHJpbmcpLmxlbmd0aFxuICAgICAgZGVmYXVsdDpcbiAgICAgICAgaWYgKGxvd2VyZWRDYXNlKSByZXR1cm4gdXRmOFRvQnl0ZXMoc3RyaW5nKS5sZW5ndGggLy8gYXNzdW1lIHV0ZjhcbiAgICAgICAgZW5jb2RpbmcgPSAoJycgKyBlbmNvZGluZykudG9Mb3dlckNhc2UoKVxuICAgICAgICBsb3dlcmVkQ2FzZSA9IHRydWVcbiAgICB9XG4gIH1cbn1cbkJ1ZmZlci5ieXRlTGVuZ3RoID0gYnl0ZUxlbmd0aFxuXG5mdW5jdGlvbiBzbG93VG9TdHJpbmcgKGVuY29kaW5nLCBzdGFydCwgZW5kKSB7XG4gIHZhciBsb3dlcmVkQ2FzZSA9IGZhbHNlXG5cbiAgc3RhcnQgPSBzdGFydCB8IDBcbiAgZW5kID0gZW5kID09PSB1bmRlZmluZWQgfHwgZW5kID09PSBJbmZpbml0eSA/IHRoaXMubGVuZ3RoIDogZW5kIHwgMFxuXG4gIGlmICghZW5jb2RpbmcpIGVuY29kaW5nID0gJ3V0ZjgnXG4gIGlmIChzdGFydCA8IDApIHN0YXJ0ID0gMFxuICBpZiAoZW5kID4gdGhpcy5sZW5ndGgpIGVuZCA9IHRoaXMubGVuZ3RoXG4gIGlmIChlbmQgPD0gc3RhcnQpIHJldHVybiAnJ1xuXG4gIHdoaWxlICh0cnVlKSB7XG4gICAgc3dpdGNoIChlbmNvZGluZykge1xuICAgICAgY2FzZSAnaGV4JzpcbiAgICAgICAgcmV0dXJuIGhleFNsaWNlKHRoaXMsIHN0YXJ0LCBlbmQpXG5cbiAgICAgIGNhc2UgJ3V0ZjgnOlxuICAgICAgY2FzZSAndXRmLTgnOlxuICAgICAgICByZXR1cm4gdXRmOFNsaWNlKHRoaXMsIHN0YXJ0LCBlbmQpXG5cbiAgICAgIGNhc2UgJ2FzY2lpJzpcbiAgICAgICAgcmV0dXJuIGFzY2lpU2xpY2UodGhpcywgc3RhcnQsIGVuZClcblxuICAgICAgY2FzZSAnYmluYXJ5JzpcbiAgICAgICAgcmV0dXJuIGJpbmFyeVNsaWNlKHRoaXMsIHN0YXJ0LCBlbmQpXG5cbiAgICAgIGNhc2UgJ2Jhc2U2NCc6XG4gICAgICAgIHJldHVybiBiYXNlNjRTbGljZSh0aGlzLCBzdGFydCwgZW5kKVxuXG4gICAgICBjYXNlICd1Y3MyJzpcbiAgICAgIGNhc2UgJ3Vjcy0yJzpcbiAgICAgIGNhc2UgJ3V0ZjE2bGUnOlxuICAgICAgY2FzZSAndXRmLTE2bGUnOlxuICAgICAgICByZXR1cm4gdXRmMTZsZVNsaWNlKHRoaXMsIHN0YXJ0LCBlbmQpXG5cbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIGlmIChsb3dlcmVkQ2FzZSkgdGhyb3cgbmV3IFR5cGVFcnJvcignVW5rbm93biBlbmNvZGluZzogJyArIGVuY29kaW5nKVxuICAgICAgICBlbmNvZGluZyA9IChlbmNvZGluZyArICcnKS50b0xvd2VyQ2FzZSgpXG4gICAgICAgIGxvd2VyZWRDYXNlID0gdHJ1ZVxuICAgIH1cbiAgfVxufVxuXG4vLyBUaGUgcHJvcGVydHkgaXMgdXNlZCBieSBgQnVmZmVyLmlzQnVmZmVyYCBhbmQgYGlzLWJ1ZmZlcmAgKGluIFNhZmFyaSA1LTcpIHRvIGRldGVjdFxuLy8gQnVmZmVyIGluc3RhbmNlcy5cbkJ1ZmZlci5wcm90b3R5cGUuX2lzQnVmZmVyID0gdHJ1ZVxuXG5CdWZmZXIucHJvdG90eXBlLnRvU3RyaW5nID0gZnVuY3Rpb24gdG9TdHJpbmcgKCkge1xuICB2YXIgbGVuZ3RoID0gdGhpcy5sZW5ndGggfCAwXG4gIGlmIChsZW5ndGggPT09IDApIHJldHVybiAnJ1xuICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMCkgcmV0dXJuIHV0ZjhTbGljZSh0aGlzLCAwLCBsZW5ndGgpXG4gIHJldHVybiBzbG93VG9TdHJpbmcuYXBwbHkodGhpcywgYXJndW1lbnRzKVxufVxuXG5CdWZmZXIucHJvdG90eXBlLmVxdWFscyA9IGZ1bmN0aW9uIGVxdWFscyAoYikge1xuICBpZiAoIUJ1ZmZlci5pc0J1ZmZlcihiKSkgdGhyb3cgbmV3IFR5cGVFcnJvcignQXJndW1lbnQgbXVzdCBiZSBhIEJ1ZmZlcicpXG4gIGlmICh0aGlzID09PSBiKSByZXR1cm4gdHJ1ZVxuICByZXR1cm4gQnVmZmVyLmNvbXBhcmUodGhpcywgYikgPT09IDBcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5pbnNwZWN0ID0gZnVuY3Rpb24gaW5zcGVjdCAoKSB7XG4gIHZhciBzdHIgPSAnJ1xuICB2YXIgbWF4ID0gZXhwb3J0cy5JTlNQRUNUX01BWF9CWVRFU1xuICBpZiAodGhpcy5sZW5ndGggPiAwKSB7XG4gICAgc3RyID0gdGhpcy50b1N0cmluZygnaGV4JywgMCwgbWF4KS5tYXRjaCgvLnsyfS9nKS5qb2luKCcgJylcbiAgICBpZiAodGhpcy5sZW5ndGggPiBtYXgpIHN0ciArPSAnIC4uLiAnXG4gIH1cbiAgcmV0dXJuICc8QnVmZmVyICcgKyBzdHIgKyAnPidcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5jb21wYXJlID0gZnVuY3Rpb24gY29tcGFyZSAoYikge1xuICBpZiAoIUJ1ZmZlci5pc0J1ZmZlcihiKSkgdGhyb3cgbmV3IFR5cGVFcnJvcignQXJndW1lbnQgbXVzdCBiZSBhIEJ1ZmZlcicpXG4gIHJldHVybiBCdWZmZXIuY29tcGFyZSh0aGlzLCBiKVxufVxuXG5CdWZmZXIucHJvdG90eXBlLmluZGV4T2YgPSBmdW5jdGlvbiBpbmRleE9mICh2YWwsIGJ5dGVPZmZzZXQpIHtcbiAgaWYgKGJ5dGVPZmZzZXQgPiAweDdmZmZmZmZmKSBieXRlT2Zmc2V0ID0gMHg3ZmZmZmZmZlxuICBlbHNlIGlmIChieXRlT2Zmc2V0IDwgLTB4ODAwMDAwMDApIGJ5dGVPZmZzZXQgPSAtMHg4MDAwMDAwMFxuICBieXRlT2Zmc2V0ID4+PSAwXG5cbiAgaWYgKHRoaXMubGVuZ3RoID09PSAwKSByZXR1cm4gLTFcbiAgaWYgKGJ5dGVPZmZzZXQgPj0gdGhpcy5sZW5ndGgpIHJldHVybiAtMVxuXG4gIC8vIE5lZ2F0aXZlIG9mZnNldHMgc3RhcnQgZnJvbSB0aGUgZW5kIG9mIHRoZSBidWZmZXJcbiAgaWYgKGJ5dGVPZmZzZXQgPCAwKSBieXRlT2Zmc2V0ID0gTWF0aC5tYXgodGhpcy5sZW5ndGggKyBieXRlT2Zmc2V0LCAwKVxuXG4gIGlmICh0eXBlb2YgdmFsID09PSAnc3RyaW5nJykge1xuICAgIGlmICh2YWwubGVuZ3RoID09PSAwKSByZXR1cm4gLTEgLy8gc3BlY2lhbCBjYXNlOiBsb29raW5nIGZvciBlbXB0eSBzdHJpbmcgYWx3YXlzIGZhaWxzXG4gICAgcmV0dXJuIFN0cmluZy5wcm90b3R5cGUuaW5kZXhPZi5jYWxsKHRoaXMsIHZhbCwgYnl0ZU9mZnNldClcbiAgfVxuICBpZiAoQnVmZmVyLmlzQnVmZmVyKHZhbCkpIHtcbiAgICByZXR1cm4gYXJyYXlJbmRleE9mKHRoaXMsIHZhbCwgYnl0ZU9mZnNldClcbiAgfVxuICBpZiAodHlwZW9mIHZhbCA9PT0gJ251bWJlcicpIHtcbiAgICBpZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQgJiYgVWludDhBcnJheS5wcm90b3R5cGUuaW5kZXhPZiA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgcmV0dXJuIFVpbnQ4QXJyYXkucHJvdG90eXBlLmluZGV4T2YuY2FsbCh0aGlzLCB2YWwsIGJ5dGVPZmZzZXQpXG4gICAgfVxuICAgIHJldHVybiBhcnJheUluZGV4T2YodGhpcywgWyB2YWwgXSwgYnl0ZU9mZnNldClcbiAgfVxuXG4gIGZ1bmN0aW9uIGFycmF5SW5kZXhPZiAoYXJyLCB2YWwsIGJ5dGVPZmZzZXQpIHtcbiAgICB2YXIgZm91bmRJbmRleCA9IC0xXG4gICAgZm9yICh2YXIgaSA9IDA7IGJ5dGVPZmZzZXQgKyBpIDwgYXJyLmxlbmd0aDsgaSsrKSB7XG4gICAgICBpZiAoYXJyW2J5dGVPZmZzZXQgKyBpXSA9PT0gdmFsW2ZvdW5kSW5kZXggPT09IC0xID8gMCA6IGkgLSBmb3VuZEluZGV4XSkge1xuICAgICAgICBpZiAoZm91bmRJbmRleCA9PT0gLTEpIGZvdW5kSW5kZXggPSBpXG4gICAgICAgIGlmIChpIC0gZm91bmRJbmRleCArIDEgPT09IHZhbC5sZW5ndGgpIHJldHVybiBieXRlT2Zmc2V0ICsgZm91bmRJbmRleFxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZm91bmRJbmRleCA9IC0xXG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiAtMVxuICB9XG5cbiAgdGhyb3cgbmV3IFR5cGVFcnJvcigndmFsIG11c3QgYmUgc3RyaW5nLCBudW1iZXIgb3IgQnVmZmVyJylcbn1cblxuZnVuY3Rpb24gaGV4V3JpdGUgKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCkge1xuICBvZmZzZXQgPSBOdW1iZXIob2Zmc2V0KSB8fCAwXG4gIHZhciByZW1haW5pbmcgPSBidWYubGVuZ3RoIC0gb2Zmc2V0XG4gIGlmICghbGVuZ3RoKSB7XG4gICAgbGVuZ3RoID0gcmVtYWluaW5nXG4gIH0gZWxzZSB7XG4gICAgbGVuZ3RoID0gTnVtYmVyKGxlbmd0aClcbiAgICBpZiAobGVuZ3RoID4gcmVtYWluaW5nKSB7XG4gICAgICBsZW5ndGggPSByZW1haW5pbmdcbiAgICB9XG4gIH1cblxuICAvLyBtdXN0IGJlIGFuIGV2ZW4gbnVtYmVyIG9mIGRpZ2l0c1xuICB2YXIgc3RyTGVuID0gc3RyaW5nLmxlbmd0aFxuICBpZiAoc3RyTGVuICUgMiAhPT0gMCkgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIGhleCBzdHJpbmcnKVxuXG4gIGlmIChsZW5ndGggPiBzdHJMZW4gLyAyKSB7XG4gICAgbGVuZ3RoID0gc3RyTGVuIC8gMlxuICB9XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICB2YXIgcGFyc2VkID0gcGFyc2VJbnQoc3RyaW5nLnN1YnN0cihpICogMiwgMiksIDE2KVxuICAgIGlmIChpc05hTihwYXJzZWQpKSB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgaGV4IHN0cmluZycpXG4gICAgYnVmW29mZnNldCArIGldID0gcGFyc2VkXG4gIH1cbiAgcmV0dXJuIGlcbn1cblxuZnVuY3Rpb24gdXRmOFdyaXRlIChidWYsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpIHtcbiAgcmV0dXJuIGJsaXRCdWZmZXIodXRmOFRvQnl0ZXMoc3RyaW5nLCBidWYubGVuZ3RoIC0gb2Zmc2V0KSwgYnVmLCBvZmZzZXQsIGxlbmd0aClcbn1cblxuZnVuY3Rpb24gYXNjaWlXcml0ZSAoYnVmLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKSB7XG4gIHJldHVybiBibGl0QnVmZmVyKGFzY2lpVG9CeXRlcyhzdHJpbmcpLCBidWYsIG9mZnNldCwgbGVuZ3RoKVxufVxuXG5mdW5jdGlvbiBiaW5hcnlXcml0ZSAoYnVmLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKSB7XG4gIHJldHVybiBhc2NpaVdyaXRlKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aClcbn1cblxuZnVuY3Rpb24gYmFzZTY0V3JpdGUgKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCkge1xuICByZXR1cm4gYmxpdEJ1ZmZlcihiYXNlNjRUb0J5dGVzKHN0cmluZyksIGJ1Ziwgb2Zmc2V0LCBsZW5ndGgpXG59XG5cbmZ1bmN0aW9uIHVjczJXcml0ZSAoYnVmLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKSB7XG4gIHJldHVybiBibGl0QnVmZmVyKHV0ZjE2bGVUb0J5dGVzKHN0cmluZywgYnVmLmxlbmd0aCAtIG9mZnNldCksIGJ1Ziwgb2Zmc2V0LCBsZW5ndGgpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGUgPSBmdW5jdGlvbiB3cml0ZSAoc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCwgZW5jb2RpbmcpIHtcbiAgLy8gQnVmZmVyI3dyaXRlKHN0cmluZylcbiAgaWYgKG9mZnNldCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgZW5jb2RpbmcgPSAndXRmOCdcbiAgICBsZW5ndGggPSB0aGlzLmxlbmd0aFxuICAgIG9mZnNldCA9IDBcbiAgLy8gQnVmZmVyI3dyaXRlKHN0cmluZywgZW5jb2RpbmcpXG4gIH0gZWxzZSBpZiAobGVuZ3RoID09PSB1bmRlZmluZWQgJiYgdHlwZW9mIG9mZnNldCA9PT0gJ3N0cmluZycpIHtcbiAgICBlbmNvZGluZyA9IG9mZnNldFxuICAgIGxlbmd0aCA9IHRoaXMubGVuZ3RoXG4gICAgb2Zmc2V0ID0gMFxuICAvLyBCdWZmZXIjd3JpdGUoc3RyaW5nLCBvZmZzZXRbLCBsZW5ndGhdWywgZW5jb2RpbmddKVxuICB9IGVsc2UgaWYgKGlzRmluaXRlKG9mZnNldCkpIHtcbiAgICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gICAgaWYgKGlzRmluaXRlKGxlbmd0aCkpIHtcbiAgICAgIGxlbmd0aCA9IGxlbmd0aCB8IDBcbiAgICAgIGlmIChlbmNvZGluZyA9PT0gdW5kZWZpbmVkKSBlbmNvZGluZyA9ICd1dGY4J1xuICAgIH0gZWxzZSB7XG4gICAgICBlbmNvZGluZyA9IGxlbmd0aFxuICAgICAgbGVuZ3RoID0gdW5kZWZpbmVkXG4gICAgfVxuICAvLyBsZWdhY3kgd3JpdGUoc3RyaW5nLCBlbmNvZGluZywgb2Zmc2V0LCBsZW5ndGgpIC0gcmVtb3ZlIGluIHYwLjEzXG4gIH0gZWxzZSB7XG4gICAgdmFyIHN3YXAgPSBlbmNvZGluZ1xuICAgIGVuY29kaW5nID0gb2Zmc2V0XG4gICAgb2Zmc2V0ID0gbGVuZ3RoIHwgMFxuICAgIGxlbmd0aCA9IHN3YXBcbiAgfVxuXG4gIHZhciByZW1haW5pbmcgPSB0aGlzLmxlbmd0aCAtIG9mZnNldFxuICBpZiAobGVuZ3RoID09PSB1bmRlZmluZWQgfHwgbGVuZ3RoID4gcmVtYWluaW5nKSBsZW5ndGggPSByZW1haW5pbmdcblxuICBpZiAoKHN0cmluZy5sZW5ndGggPiAwICYmIChsZW5ndGggPCAwIHx8IG9mZnNldCA8IDApKSB8fCBvZmZzZXQgPiB0aGlzLmxlbmd0aCkge1xuICAgIHRocm93IG5ldyBSYW5nZUVycm9yKCdhdHRlbXB0IHRvIHdyaXRlIG91dHNpZGUgYnVmZmVyIGJvdW5kcycpXG4gIH1cblxuICBpZiAoIWVuY29kaW5nKSBlbmNvZGluZyA9ICd1dGY4J1xuXG4gIHZhciBsb3dlcmVkQ2FzZSA9IGZhbHNlXG4gIGZvciAoOzspIHtcbiAgICBzd2l0Y2ggKGVuY29kaW5nKSB7XG4gICAgICBjYXNlICdoZXgnOlxuICAgICAgICByZXR1cm4gaGV4V3JpdGUodGhpcywgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aClcblxuICAgICAgY2FzZSAndXRmOCc6XG4gICAgICBjYXNlICd1dGYtOCc6XG4gICAgICAgIHJldHVybiB1dGY4V3JpdGUodGhpcywgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aClcblxuICAgICAgY2FzZSAnYXNjaWknOlxuICAgICAgICByZXR1cm4gYXNjaWlXcml0ZSh0aGlzLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxuXG4gICAgICBjYXNlICdiaW5hcnknOlxuICAgICAgICByZXR1cm4gYmluYXJ5V3JpdGUodGhpcywgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aClcblxuICAgICAgY2FzZSAnYmFzZTY0JzpcbiAgICAgICAgLy8gV2FybmluZzogbWF4TGVuZ3RoIG5vdCB0YWtlbiBpbnRvIGFjY291bnQgaW4gYmFzZTY0V3JpdGVcbiAgICAgICAgcmV0dXJuIGJhc2U2NFdyaXRlKHRoaXMsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpXG5cbiAgICAgIGNhc2UgJ3VjczInOlxuICAgICAgY2FzZSAndWNzLTInOlxuICAgICAgY2FzZSAndXRmMTZsZSc6XG4gICAgICBjYXNlICd1dGYtMTZsZSc6XG4gICAgICAgIHJldHVybiB1Y3MyV3JpdGUodGhpcywgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aClcblxuICAgICAgZGVmYXVsdDpcbiAgICAgICAgaWYgKGxvd2VyZWRDYXNlKSB0aHJvdyBuZXcgVHlwZUVycm9yKCdVbmtub3duIGVuY29kaW5nOiAnICsgZW5jb2RpbmcpXG4gICAgICAgIGVuY29kaW5nID0gKCcnICsgZW5jb2RpbmcpLnRvTG93ZXJDYXNlKClcbiAgICAgICAgbG93ZXJlZENhc2UgPSB0cnVlXG4gICAgfVxuICB9XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUudG9KU09OID0gZnVuY3Rpb24gdG9KU09OICgpIHtcbiAgcmV0dXJuIHtcbiAgICB0eXBlOiAnQnVmZmVyJyxcbiAgICBkYXRhOiBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbCh0aGlzLl9hcnIgfHwgdGhpcywgMClcbiAgfVxufVxuXG5mdW5jdGlvbiBiYXNlNjRTbGljZSAoYnVmLCBzdGFydCwgZW5kKSB7XG4gIGlmIChzdGFydCA9PT0gMCAmJiBlbmQgPT09IGJ1Zi5sZW5ndGgpIHtcbiAgICByZXR1cm4gYmFzZTY0LmZyb21CeXRlQXJyYXkoYnVmKVxuICB9IGVsc2Uge1xuICAgIHJldHVybiBiYXNlNjQuZnJvbUJ5dGVBcnJheShidWYuc2xpY2Uoc3RhcnQsIGVuZCkpXG4gIH1cbn1cblxuZnVuY3Rpb24gdXRmOFNsaWNlIChidWYsIHN0YXJ0LCBlbmQpIHtcbiAgZW5kID0gTWF0aC5taW4oYnVmLmxlbmd0aCwgZW5kKVxuICB2YXIgcmVzID0gW11cblxuICB2YXIgaSA9IHN0YXJ0XG4gIHdoaWxlIChpIDwgZW5kKSB7XG4gICAgdmFyIGZpcnN0Qnl0ZSA9IGJ1ZltpXVxuICAgIHZhciBjb2RlUG9pbnQgPSBudWxsXG4gICAgdmFyIGJ5dGVzUGVyU2VxdWVuY2UgPSAoZmlyc3RCeXRlID4gMHhFRikgPyA0XG4gICAgICA6IChmaXJzdEJ5dGUgPiAweERGKSA/IDNcbiAgICAgIDogKGZpcnN0Qnl0ZSA+IDB4QkYpID8gMlxuICAgICAgOiAxXG5cbiAgICBpZiAoaSArIGJ5dGVzUGVyU2VxdWVuY2UgPD0gZW5kKSB7XG4gICAgICB2YXIgc2Vjb25kQnl0ZSwgdGhpcmRCeXRlLCBmb3VydGhCeXRlLCB0ZW1wQ29kZVBvaW50XG5cbiAgICAgIHN3aXRjaCAoYnl0ZXNQZXJTZXF1ZW5jZSkge1xuICAgICAgICBjYXNlIDE6XG4gICAgICAgICAgaWYgKGZpcnN0Qnl0ZSA8IDB4ODApIHtcbiAgICAgICAgICAgIGNvZGVQb2ludCA9IGZpcnN0Qnl0ZVxuICAgICAgICAgIH1cbiAgICAgICAgICBicmVha1xuICAgICAgICBjYXNlIDI6XG4gICAgICAgICAgc2Vjb25kQnl0ZSA9IGJ1ZltpICsgMV1cbiAgICAgICAgICBpZiAoKHNlY29uZEJ5dGUgJiAweEMwKSA9PT0gMHg4MCkge1xuICAgICAgICAgICAgdGVtcENvZGVQb2ludCA9IChmaXJzdEJ5dGUgJiAweDFGKSA8PCAweDYgfCAoc2Vjb25kQnl0ZSAmIDB4M0YpXG4gICAgICAgICAgICBpZiAodGVtcENvZGVQb2ludCA+IDB4N0YpIHtcbiAgICAgICAgICAgICAgY29kZVBvaW50ID0gdGVtcENvZGVQb2ludFxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBicmVha1xuICAgICAgICBjYXNlIDM6XG4gICAgICAgICAgc2Vjb25kQnl0ZSA9IGJ1ZltpICsgMV1cbiAgICAgICAgICB0aGlyZEJ5dGUgPSBidWZbaSArIDJdXG4gICAgICAgICAgaWYgKChzZWNvbmRCeXRlICYgMHhDMCkgPT09IDB4ODAgJiYgKHRoaXJkQnl0ZSAmIDB4QzApID09PSAweDgwKSB7XG4gICAgICAgICAgICB0ZW1wQ29kZVBvaW50ID0gKGZpcnN0Qnl0ZSAmIDB4RikgPDwgMHhDIHwgKHNlY29uZEJ5dGUgJiAweDNGKSA8PCAweDYgfCAodGhpcmRCeXRlICYgMHgzRilcbiAgICAgICAgICAgIGlmICh0ZW1wQ29kZVBvaW50ID4gMHg3RkYgJiYgKHRlbXBDb2RlUG9pbnQgPCAweEQ4MDAgfHwgdGVtcENvZGVQb2ludCA+IDB4REZGRikpIHtcbiAgICAgICAgICAgICAgY29kZVBvaW50ID0gdGVtcENvZGVQb2ludFxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBicmVha1xuICAgICAgICBjYXNlIDQ6XG4gICAgICAgICAgc2Vjb25kQnl0ZSA9IGJ1ZltpICsgMV1cbiAgICAgICAgICB0aGlyZEJ5dGUgPSBidWZbaSArIDJdXG4gICAgICAgICAgZm91cnRoQnl0ZSA9IGJ1ZltpICsgM11cbiAgICAgICAgICBpZiAoKHNlY29uZEJ5dGUgJiAweEMwKSA9PT0gMHg4MCAmJiAodGhpcmRCeXRlICYgMHhDMCkgPT09IDB4ODAgJiYgKGZvdXJ0aEJ5dGUgJiAweEMwKSA9PT0gMHg4MCkge1xuICAgICAgICAgICAgdGVtcENvZGVQb2ludCA9IChmaXJzdEJ5dGUgJiAweEYpIDw8IDB4MTIgfCAoc2Vjb25kQnl0ZSAmIDB4M0YpIDw8IDB4QyB8ICh0aGlyZEJ5dGUgJiAweDNGKSA8PCAweDYgfCAoZm91cnRoQnl0ZSAmIDB4M0YpXG4gICAgICAgICAgICBpZiAodGVtcENvZGVQb2ludCA+IDB4RkZGRiAmJiB0ZW1wQ29kZVBvaW50IDwgMHgxMTAwMDApIHtcbiAgICAgICAgICAgICAgY29kZVBvaW50ID0gdGVtcENvZGVQb2ludFxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoY29kZVBvaW50ID09PSBudWxsKSB7XG4gICAgICAvLyB3ZSBkaWQgbm90IGdlbmVyYXRlIGEgdmFsaWQgY29kZVBvaW50IHNvIGluc2VydCBhXG4gICAgICAvLyByZXBsYWNlbWVudCBjaGFyIChVK0ZGRkQpIGFuZCBhZHZhbmNlIG9ubHkgMSBieXRlXG4gICAgICBjb2RlUG9pbnQgPSAweEZGRkRcbiAgICAgIGJ5dGVzUGVyU2VxdWVuY2UgPSAxXG4gICAgfSBlbHNlIGlmIChjb2RlUG9pbnQgPiAweEZGRkYpIHtcbiAgICAgIC8vIGVuY29kZSB0byB1dGYxNiAoc3Vycm9nYXRlIHBhaXIgZGFuY2UpXG4gICAgICBjb2RlUG9pbnQgLT0gMHgxMDAwMFxuICAgICAgcmVzLnB1c2goY29kZVBvaW50ID4+PiAxMCAmIDB4M0ZGIHwgMHhEODAwKVxuICAgICAgY29kZVBvaW50ID0gMHhEQzAwIHwgY29kZVBvaW50ICYgMHgzRkZcbiAgICB9XG5cbiAgICByZXMucHVzaChjb2RlUG9pbnQpXG4gICAgaSArPSBieXRlc1BlclNlcXVlbmNlXG4gIH1cblxuICByZXR1cm4gZGVjb2RlQ29kZVBvaW50c0FycmF5KHJlcylcbn1cblxuLy8gQmFzZWQgb24gaHR0cDovL3N0YWNrb3ZlcmZsb3cuY29tL2EvMjI3NDcyNzIvNjgwNzQyLCB0aGUgYnJvd3NlciB3aXRoXG4vLyB0aGUgbG93ZXN0IGxpbWl0IGlzIENocm9tZSwgd2l0aCAweDEwMDAwIGFyZ3MuXG4vLyBXZSBnbyAxIG1hZ25pdHVkZSBsZXNzLCBmb3Igc2FmZXR5XG52YXIgTUFYX0FSR1VNRU5UU19MRU5HVEggPSAweDEwMDBcblxuZnVuY3Rpb24gZGVjb2RlQ29kZVBvaW50c0FycmF5IChjb2RlUG9pbnRzKSB7XG4gIHZhciBsZW4gPSBjb2RlUG9pbnRzLmxlbmd0aFxuICBpZiAobGVuIDw9IE1BWF9BUkdVTUVOVFNfTEVOR1RIKSB7XG4gICAgcmV0dXJuIFN0cmluZy5mcm9tQ2hhckNvZGUuYXBwbHkoU3RyaW5nLCBjb2RlUG9pbnRzKSAvLyBhdm9pZCBleHRyYSBzbGljZSgpXG4gIH1cblxuICAvLyBEZWNvZGUgaW4gY2h1bmtzIHRvIGF2b2lkIFwiY2FsbCBzdGFjayBzaXplIGV4Y2VlZGVkXCIuXG4gIHZhciByZXMgPSAnJ1xuICB2YXIgaSA9IDBcbiAgd2hpbGUgKGkgPCBsZW4pIHtcbiAgICByZXMgKz0gU3RyaW5nLmZyb21DaGFyQ29kZS5hcHBseShcbiAgICAgIFN0cmluZyxcbiAgICAgIGNvZGVQb2ludHMuc2xpY2UoaSwgaSArPSBNQVhfQVJHVU1FTlRTX0xFTkdUSClcbiAgICApXG4gIH1cbiAgcmV0dXJuIHJlc1xufVxuXG5mdW5jdGlvbiBhc2NpaVNsaWNlIChidWYsIHN0YXJ0LCBlbmQpIHtcbiAgdmFyIHJldCA9ICcnXG4gIGVuZCA9IE1hdGgubWluKGJ1Zi5sZW5ndGgsIGVuZClcblxuICBmb3IgKHZhciBpID0gc3RhcnQ7IGkgPCBlbmQ7IGkrKykge1xuICAgIHJldCArPSBTdHJpbmcuZnJvbUNoYXJDb2RlKGJ1ZltpXSAmIDB4N0YpXG4gIH1cbiAgcmV0dXJuIHJldFxufVxuXG5mdW5jdGlvbiBiaW5hcnlTbGljZSAoYnVmLCBzdGFydCwgZW5kKSB7XG4gIHZhciByZXQgPSAnJ1xuICBlbmQgPSBNYXRoLm1pbihidWYubGVuZ3RoLCBlbmQpXG5cbiAgZm9yICh2YXIgaSA9IHN0YXJ0OyBpIDwgZW5kOyBpKyspIHtcbiAgICByZXQgKz0gU3RyaW5nLmZyb21DaGFyQ29kZShidWZbaV0pXG4gIH1cbiAgcmV0dXJuIHJldFxufVxuXG5mdW5jdGlvbiBoZXhTbGljZSAoYnVmLCBzdGFydCwgZW5kKSB7XG4gIHZhciBsZW4gPSBidWYubGVuZ3RoXG5cbiAgaWYgKCFzdGFydCB8fCBzdGFydCA8IDApIHN0YXJ0ID0gMFxuICBpZiAoIWVuZCB8fCBlbmQgPCAwIHx8IGVuZCA+IGxlbikgZW5kID0gbGVuXG5cbiAgdmFyIG91dCA9ICcnXG4gIGZvciAodmFyIGkgPSBzdGFydDsgaSA8IGVuZDsgaSsrKSB7XG4gICAgb3V0ICs9IHRvSGV4KGJ1ZltpXSlcbiAgfVxuICByZXR1cm4gb3V0XG59XG5cbmZ1bmN0aW9uIHV0ZjE2bGVTbGljZSAoYnVmLCBzdGFydCwgZW5kKSB7XG4gIHZhciBieXRlcyA9IGJ1Zi5zbGljZShzdGFydCwgZW5kKVxuICB2YXIgcmVzID0gJydcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBieXRlcy5sZW5ndGg7IGkgKz0gMikge1xuICAgIHJlcyArPSBTdHJpbmcuZnJvbUNoYXJDb2RlKGJ5dGVzW2ldICsgYnl0ZXNbaSArIDFdICogMjU2KVxuICB9XG4gIHJldHVybiByZXNcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5zbGljZSA9IGZ1bmN0aW9uIHNsaWNlIChzdGFydCwgZW5kKSB7XG4gIHZhciBsZW4gPSB0aGlzLmxlbmd0aFxuICBzdGFydCA9IH5+c3RhcnRcbiAgZW5kID0gZW5kID09PSB1bmRlZmluZWQgPyBsZW4gOiB+fmVuZFxuXG4gIGlmIChzdGFydCA8IDApIHtcbiAgICBzdGFydCArPSBsZW5cbiAgICBpZiAoc3RhcnQgPCAwKSBzdGFydCA9IDBcbiAgfSBlbHNlIGlmIChzdGFydCA+IGxlbikge1xuICAgIHN0YXJ0ID0gbGVuXG4gIH1cblxuICBpZiAoZW5kIDwgMCkge1xuICAgIGVuZCArPSBsZW5cbiAgICBpZiAoZW5kIDwgMCkgZW5kID0gMFxuICB9IGVsc2UgaWYgKGVuZCA+IGxlbikge1xuICAgIGVuZCA9IGxlblxuICB9XG5cbiAgaWYgKGVuZCA8IHN0YXJ0KSBlbmQgPSBzdGFydFxuXG4gIHZhciBuZXdCdWZcbiAgaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgbmV3QnVmID0gdGhpcy5zdWJhcnJheShzdGFydCwgZW5kKVxuICAgIG5ld0J1Zi5fX3Byb3RvX18gPSBCdWZmZXIucHJvdG90eXBlXG4gIH0gZWxzZSB7XG4gICAgdmFyIHNsaWNlTGVuID0gZW5kIC0gc3RhcnRcbiAgICBuZXdCdWYgPSBuZXcgQnVmZmVyKHNsaWNlTGVuLCB1bmRlZmluZWQpXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBzbGljZUxlbjsgaSsrKSB7XG4gICAgICBuZXdCdWZbaV0gPSB0aGlzW2kgKyBzdGFydF1cbiAgICB9XG4gIH1cblxuICBpZiAobmV3QnVmLmxlbmd0aCkgbmV3QnVmLnBhcmVudCA9IHRoaXMucGFyZW50IHx8IHRoaXNcblxuICByZXR1cm4gbmV3QnVmXG59XG5cbi8qXG4gKiBOZWVkIHRvIG1ha2Ugc3VyZSB0aGF0IGJ1ZmZlciBpc24ndCB0cnlpbmcgdG8gd3JpdGUgb3V0IG9mIGJvdW5kcy5cbiAqL1xuZnVuY3Rpb24gY2hlY2tPZmZzZXQgKG9mZnNldCwgZXh0LCBsZW5ndGgpIHtcbiAgaWYgKChvZmZzZXQgJSAxKSAhPT0gMCB8fCBvZmZzZXQgPCAwKSB0aHJvdyBuZXcgUmFuZ2VFcnJvcignb2Zmc2V0IGlzIG5vdCB1aW50JylcbiAgaWYgKG9mZnNldCArIGV4dCA+IGxlbmd0aCkgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ1RyeWluZyB0byBhY2Nlc3MgYmV5b25kIGJ1ZmZlciBsZW5ndGgnKVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRVSW50TEUgPSBmdW5jdGlvbiByZWFkVUludExFIChvZmZzZXQsIGJ5dGVMZW5ndGgsIG5vQXNzZXJ0KSB7XG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgYnl0ZUxlbmd0aCA9IGJ5dGVMZW5ndGggfCAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgYnl0ZUxlbmd0aCwgdGhpcy5sZW5ndGgpXG5cbiAgdmFyIHZhbCA9IHRoaXNbb2Zmc2V0XVxuICB2YXIgbXVsID0gMVxuICB2YXIgaSA9IDBcbiAgd2hpbGUgKCsraSA8IGJ5dGVMZW5ndGggJiYgKG11bCAqPSAweDEwMCkpIHtcbiAgICB2YWwgKz0gdGhpc1tvZmZzZXQgKyBpXSAqIG11bFxuICB9XG5cbiAgcmV0dXJuIHZhbFxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRVSW50QkUgPSBmdW5jdGlvbiByZWFkVUludEJFIChvZmZzZXQsIGJ5dGVMZW5ndGgsIG5vQXNzZXJ0KSB7XG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgYnl0ZUxlbmd0aCA9IGJ5dGVMZW5ndGggfCAwXG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICBjaGVja09mZnNldChvZmZzZXQsIGJ5dGVMZW5ndGgsIHRoaXMubGVuZ3RoKVxuICB9XG5cbiAgdmFyIHZhbCA9IHRoaXNbb2Zmc2V0ICsgLS1ieXRlTGVuZ3RoXVxuICB2YXIgbXVsID0gMVxuICB3aGlsZSAoYnl0ZUxlbmd0aCA+IDAgJiYgKG11bCAqPSAweDEwMCkpIHtcbiAgICB2YWwgKz0gdGhpc1tvZmZzZXQgKyAtLWJ5dGVMZW5ndGhdICogbXVsXG4gIH1cblxuICByZXR1cm4gdmFsXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZFVJbnQ4ID0gZnVuY3Rpb24gcmVhZFVJbnQ4IChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgMSwgdGhpcy5sZW5ndGgpXG4gIHJldHVybiB0aGlzW29mZnNldF1cbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkVUludDE2TEUgPSBmdW5jdGlvbiByZWFkVUludDE2TEUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCAyLCB0aGlzLmxlbmd0aClcbiAgcmV0dXJuIHRoaXNbb2Zmc2V0XSB8ICh0aGlzW29mZnNldCArIDFdIDw8IDgpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZFVJbnQxNkJFID0gZnVuY3Rpb24gcmVhZFVJbnQxNkJFIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgMiwgdGhpcy5sZW5ndGgpXG4gIHJldHVybiAodGhpc1tvZmZzZXRdIDw8IDgpIHwgdGhpc1tvZmZzZXQgKyAxXVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRVSW50MzJMRSA9IGZ1bmN0aW9uIHJlYWRVSW50MzJMRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDQsIHRoaXMubGVuZ3RoKVxuXG4gIHJldHVybiAoKHRoaXNbb2Zmc2V0XSkgfFxuICAgICAgKHRoaXNbb2Zmc2V0ICsgMV0gPDwgOCkgfFxuICAgICAgKHRoaXNbb2Zmc2V0ICsgMl0gPDwgMTYpKSArXG4gICAgICAodGhpc1tvZmZzZXQgKyAzXSAqIDB4MTAwMDAwMClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkVUludDMyQkUgPSBmdW5jdGlvbiByZWFkVUludDMyQkUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCA0LCB0aGlzLmxlbmd0aClcblxuICByZXR1cm4gKHRoaXNbb2Zmc2V0XSAqIDB4MTAwMDAwMCkgK1xuICAgICgodGhpc1tvZmZzZXQgKyAxXSA8PCAxNikgfFxuICAgICh0aGlzW29mZnNldCArIDJdIDw8IDgpIHxcbiAgICB0aGlzW29mZnNldCArIDNdKVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRJbnRMRSA9IGZ1bmN0aW9uIHJlYWRJbnRMRSAob2Zmc2V0LCBieXRlTGVuZ3RoLCBub0Fzc2VydCkge1xuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGJ5dGVMZW5ndGggPSBieXRlTGVuZ3RoIHwgMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIGJ5dGVMZW5ndGgsIHRoaXMubGVuZ3RoKVxuXG4gIHZhciB2YWwgPSB0aGlzW29mZnNldF1cbiAgdmFyIG11bCA9IDFcbiAgdmFyIGkgPSAwXG4gIHdoaWxlICgrK2kgPCBieXRlTGVuZ3RoICYmIChtdWwgKj0gMHgxMDApKSB7XG4gICAgdmFsICs9IHRoaXNbb2Zmc2V0ICsgaV0gKiBtdWxcbiAgfVxuICBtdWwgKj0gMHg4MFxuXG4gIGlmICh2YWwgPj0gbXVsKSB2YWwgLT0gTWF0aC5wb3coMiwgOCAqIGJ5dGVMZW5ndGgpXG5cbiAgcmV0dXJuIHZhbFxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRJbnRCRSA9IGZ1bmN0aW9uIHJlYWRJbnRCRSAob2Zmc2V0LCBieXRlTGVuZ3RoLCBub0Fzc2VydCkge1xuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGJ5dGVMZW5ndGggPSBieXRlTGVuZ3RoIHwgMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIGJ5dGVMZW5ndGgsIHRoaXMubGVuZ3RoKVxuXG4gIHZhciBpID0gYnl0ZUxlbmd0aFxuICB2YXIgbXVsID0gMVxuICB2YXIgdmFsID0gdGhpc1tvZmZzZXQgKyAtLWldXG4gIHdoaWxlIChpID4gMCAmJiAobXVsICo9IDB4MTAwKSkge1xuICAgIHZhbCArPSB0aGlzW29mZnNldCArIC0taV0gKiBtdWxcbiAgfVxuICBtdWwgKj0gMHg4MFxuXG4gIGlmICh2YWwgPj0gbXVsKSB2YWwgLT0gTWF0aC5wb3coMiwgOCAqIGJ5dGVMZW5ndGgpXG5cbiAgcmV0dXJuIHZhbFxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRJbnQ4ID0gZnVuY3Rpb24gcmVhZEludDggKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCAxLCB0aGlzLmxlbmd0aClcbiAgaWYgKCEodGhpc1tvZmZzZXRdICYgMHg4MCkpIHJldHVybiAodGhpc1tvZmZzZXRdKVxuICByZXR1cm4gKCgweGZmIC0gdGhpc1tvZmZzZXRdICsgMSkgKiAtMSlcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkSW50MTZMRSA9IGZ1bmN0aW9uIHJlYWRJbnQxNkxFIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgMiwgdGhpcy5sZW5ndGgpXG4gIHZhciB2YWwgPSB0aGlzW29mZnNldF0gfCAodGhpc1tvZmZzZXQgKyAxXSA8PCA4KVxuICByZXR1cm4gKHZhbCAmIDB4ODAwMCkgPyB2YWwgfCAweEZGRkYwMDAwIDogdmFsXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEludDE2QkUgPSBmdW5jdGlvbiByZWFkSW50MTZCRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDIsIHRoaXMubGVuZ3RoKVxuICB2YXIgdmFsID0gdGhpc1tvZmZzZXQgKyAxXSB8ICh0aGlzW29mZnNldF0gPDwgOClcbiAgcmV0dXJuICh2YWwgJiAweDgwMDApID8gdmFsIHwgMHhGRkZGMDAwMCA6IHZhbFxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRJbnQzMkxFID0gZnVuY3Rpb24gcmVhZEludDMyTEUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCA0LCB0aGlzLmxlbmd0aClcblxuICByZXR1cm4gKHRoaXNbb2Zmc2V0XSkgfFxuICAgICh0aGlzW29mZnNldCArIDFdIDw8IDgpIHxcbiAgICAodGhpc1tvZmZzZXQgKyAyXSA8PCAxNikgfFxuICAgICh0aGlzW29mZnNldCArIDNdIDw8IDI0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRJbnQzMkJFID0gZnVuY3Rpb24gcmVhZEludDMyQkUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCA0LCB0aGlzLmxlbmd0aClcblxuICByZXR1cm4gKHRoaXNbb2Zmc2V0XSA8PCAyNCkgfFxuICAgICh0aGlzW29mZnNldCArIDFdIDw8IDE2KSB8XG4gICAgKHRoaXNbb2Zmc2V0ICsgMl0gPDwgOCkgfFxuICAgICh0aGlzW29mZnNldCArIDNdKVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRGbG9hdExFID0gZnVuY3Rpb24gcmVhZEZsb2F0TEUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCA0LCB0aGlzLmxlbmd0aClcbiAgcmV0dXJuIGllZWU3NTQucmVhZCh0aGlzLCBvZmZzZXQsIHRydWUsIDIzLCA0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRGbG9hdEJFID0gZnVuY3Rpb24gcmVhZEZsb2F0QkUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCA0LCB0aGlzLmxlbmd0aClcbiAgcmV0dXJuIGllZWU3NTQucmVhZCh0aGlzLCBvZmZzZXQsIGZhbHNlLCAyMywgNClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkRG91YmxlTEUgPSBmdW5jdGlvbiByZWFkRG91YmxlTEUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCA4LCB0aGlzLmxlbmd0aClcbiAgcmV0dXJuIGllZWU3NTQucmVhZCh0aGlzLCBvZmZzZXQsIHRydWUsIDUyLCA4KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWREb3VibGVCRSA9IGZ1bmN0aW9uIHJlYWREb3VibGVCRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDgsIHRoaXMubGVuZ3RoKVxuICByZXR1cm4gaWVlZTc1NC5yZWFkKHRoaXMsIG9mZnNldCwgZmFsc2UsIDUyLCA4KVxufVxuXG5mdW5jdGlvbiBjaGVja0ludCAoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBleHQsIG1heCwgbWluKSB7XG4gIGlmICghQnVmZmVyLmlzQnVmZmVyKGJ1ZikpIHRocm93IG5ldyBUeXBlRXJyb3IoJ2J1ZmZlciBtdXN0IGJlIGEgQnVmZmVyIGluc3RhbmNlJylcbiAgaWYgKHZhbHVlID4gbWF4IHx8IHZhbHVlIDwgbWluKSB0aHJvdyBuZXcgUmFuZ2VFcnJvcigndmFsdWUgaXMgb3V0IG9mIGJvdW5kcycpXG4gIGlmIChvZmZzZXQgKyBleHQgPiBidWYubGVuZ3RoKSB0aHJvdyBuZXcgUmFuZ2VFcnJvcignaW5kZXggb3V0IG9mIHJhbmdlJylcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZVVJbnRMRSA9IGZ1bmN0aW9uIHdyaXRlVUludExFICh2YWx1ZSwgb2Zmc2V0LCBieXRlTGVuZ3RoLCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGJ5dGVMZW5ndGggPSBieXRlTGVuZ3RoIHwgMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCBieXRlTGVuZ3RoLCBNYXRoLnBvdygyLCA4ICogYnl0ZUxlbmd0aCksIDApXG5cbiAgdmFyIG11bCA9IDFcbiAgdmFyIGkgPSAwXG4gIHRoaXNbb2Zmc2V0XSA9IHZhbHVlICYgMHhGRlxuICB3aGlsZSAoKytpIDwgYnl0ZUxlbmd0aCAmJiAobXVsICo9IDB4MTAwKSkge1xuICAgIHRoaXNbb2Zmc2V0ICsgaV0gPSAodmFsdWUgLyBtdWwpICYgMHhGRlxuICB9XG5cbiAgcmV0dXJuIG9mZnNldCArIGJ5dGVMZW5ndGhcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZVVJbnRCRSA9IGZ1bmN0aW9uIHdyaXRlVUludEJFICh2YWx1ZSwgb2Zmc2V0LCBieXRlTGVuZ3RoLCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGJ5dGVMZW5ndGggPSBieXRlTGVuZ3RoIHwgMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCBieXRlTGVuZ3RoLCBNYXRoLnBvdygyLCA4ICogYnl0ZUxlbmd0aCksIDApXG5cbiAgdmFyIGkgPSBieXRlTGVuZ3RoIC0gMVxuICB2YXIgbXVsID0gMVxuICB0aGlzW29mZnNldCArIGldID0gdmFsdWUgJiAweEZGXG4gIHdoaWxlICgtLWkgPj0gMCAmJiAobXVsICo9IDB4MTAwKSkge1xuICAgIHRoaXNbb2Zmc2V0ICsgaV0gPSAodmFsdWUgLyBtdWwpICYgMHhGRlxuICB9XG5cbiAgcmV0dXJuIG9mZnNldCArIGJ5dGVMZW5ndGhcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZVVJbnQ4ID0gZnVuY3Rpb24gd3JpdGVVSW50OCAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCAxLCAweGZmLCAwKVxuICBpZiAoIUJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB2YWx1ZSA9IE1hdGguZmxvb3IodmFsdWUpXG4gIHRoaXNbb2Zmc2V0XSA9ICh2YWx1ZSAmIDB4ZmYpXG4gIHJldHVybiBvZmZzZXQgKyAxXG59XG5cbmZ1bmN0aW9uIG9iamVjdFdyaXRlVUludDE2IChidWYsIHZhbHVlLCBvZmZzZXQsIGxpdHRsZUVuZGlhbikge1xuICBpZiAodmFsdWUgPCAwKSB2YWx1ZSA9IDB4ZmZmZiArIHZhbHVlICsgMVxuICBmb3IgKHZhciBpID0gMCwgaiA9IE1hdGgubWluKGJ1Zi5sZW5ndGggLSBvZmZzZXQsIDIpOyBpIDwgajsgaSsrKSB7XG4gICAgYnVmW29mZnNldCArIGldID0gKHZhbHVlICYgKDB4ZmYgPDwgKDggKiAobGl0dGxlRW5kaWFuID8gaSA6IDEgLSBpKSkpKSA+Pj5cbiAgICAgIChsaXR0bGVFbmRpYW4gPyBpIDogMSAtIGkpICogOFxuICB9XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVVSW50MTZMRSA9IGZ1bmN0aW9uIHdyaXRlVUludDE2TEUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgMiwgMHhmZmZmLCAwKVxuICBpZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICB0aGlzW29mZnNldF0gPSAodmFsdWUgJiAweGZmKVxuICAgIHRoaXNbb2Zmc2V0ICsgMV0gPSAodmFsdWUgPj4+IDgpXG4gIH0gZWxzZSB7XG4gICAgb2JqZWN0V3JpdGVVSW50MTYodGhpcywgdmFsdWUsIG9mZnNldCwgdHJ1ZSlcbiAgfVxuICByZXR1cm4gb2Zmc2V0ICsgMlxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlVUludDE2QkUgPSBmdW5jdGlvbiB3cml0ZVVJbnQxNkJFICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIDIsIDB4ZmZmZiwgMClcbiAgaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgdGhpc1tvZmZzZXRdID0gKHZhbHVlID4+PiA4KVxuICAgIHRoaXNbb2Zmc2V0ICsgMV0gPSAodmFsdWUgJiAweGZmKVxuICB9IGVsc2Uge1xuICAgIG9iamVjdFdyaXRlVUludDE2KHRoaXMsIHZhbHVlLCBvZmZzZXQsIGZhbHNlKVxuICB9XG4gIHJldHVybiBvZmZzZXQgKyAyXG59XG5cbmZ1bmN0aW9uIG9iamVjdFdyaXRlVUludDMyIChidWYsIHZhbHVlLCBvZmZzZXQsIGxpdHRsZUVuZGlhbikge1xuICBpZiAodmFsdWUgPCAwKSB2YWx1ZSA9IDB4ZmZmZmZmZmYgKyB2YWx1ZSArIDFcbiAgZm9yICh2YXIgaSA9IDAsIGogPSBNYXRoLm1pbihidWYubGVuZ3RoIC0gb2Zmc2V0LCA0KTsgaSA8IGo7IGkrKykge1xuICAgIGJ1ZltvZmZzZXQgKyBpXSA9ICh2YWx1ZSA+Pj4gKGxpdHRsZUVuZGlhbiA/IGkgOiAzIC0gaSkgKiA4KSAmIDB4ZmZcbiAgfVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlVUludDMyTEUgPSBmdW5jdGlvbiB3cml0ZVVJbnQzMkxFICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIDQsIDB4ZmZmZmZmZmYsIDApXG4gIGlmIChCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkge1xuICAgIHRoaXNbb2Zmc2V0ICsgM10gPSAodmFsdWUgPj4+IDI0KVxuICAgIHRoaXNbb2Zmc2V0ICsgMl0gPSAodmFsdWUgPj4+IDE2KVxuICAgIHRoaXNbb2Zmc2V0ICsgMV0gPSAodmFsdWUgPj4+IDgpXG4gICAgdGhpc1tvZmZzZXRdID0gKHZhbHVlICYgMHhmZilcbiAgfSBlbHNlIHtcbiAgICBvYmplY3RXcml0ZVVJbnQzMih0aGlzLCB2YWx1ZSwgb2Zmc2V0LCB0cnVlKVxuICB9XG4gIHJldHVybiBvZmZzZXQgKyA0XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVVSW50MzJCRSA9IGZ1bmN0aW9uIHdyaXRlVUludDMyQkUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgNCwgMHhmZmZmZmZmZiwgMClcbiAgaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgdGhpc1tvZmZzZXRdID0gKHZhbHVlID4+PiAyNClcbiAgICB0aGlzW29mZnNldCArIDFdID0gKHZhbHVlID4+PiAxNilcbiAgICB0aGlzW29mZnNldCArIDJdID0gKHZhbHVlID4+PiA4KVxuICAgIHRoaXNbb2Zmc2V0ICsgM10gPSAodmFsdWUgJiAweGZmKVxuICB9IGVsc2Uge1xuICAgIG9iamVjdFdyaXRlVUludDMyKHRoaXMsIHZhbHVlLCBvZmZzZXQsIGZhbHNlKVxuICB9XG4gIHJldHVybiBvZmZzZXQgKyA0XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVJbnRMRSA9IGZ1bmN0aW9uIHdyaXRlSW50TEUgKHZhbHVlLCBvZmZzZXQsIGJ5dGVMZW5ndGgsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIHZhciBsaW1pdCA9IE1hdGgucG93KDIsIDggKiBieXRlTGVuZ3RoIC0gMSlcblxuICAgIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIGJ5dGVMZW5ndGgsIGxpbWl0IC0gMSwgLWxpbWl0KVxuICB9XG5cbiAgdmFyIGkgPSAwXG4gIHZhciBtdWwgPSAxXG4gIHZhciBzdWIgPSB2YWx1ZSA8IDAgPyAxIDogMFxuICB0aGlzW29mZnNldF0gPSB2YWx1ZSAmIDB4RkZcbiAgd2hpbGUgKCsraSA8IGJ5dGVMZW5ndGggJiYgKG11bCAqPSAweDEwMCkpIHtcbiAgICB0aGlzW29mZnNldCArIGldID0gKCh2YWx1ZSAvIG11bCkgPj4gMCkgLSBzdWIgJiAweEZGXG4gIH1cblxuICByZXR1cm4gb2Zmc2V0ICsgYnl0ZUxlbmd0aFxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlSW50QkUgPSBmdW5jdGlvbiB3cml0ZUludEJFICh2YWx1ZSwgb2Zmc2V0LCBieXRlTGVuZ3RoLCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICB2YXIgbGltaXQgPSBNYXRoLnBvdygyLCA4ICogYnl0ZUxlbmd0aCAtIDEpXG5cbiAgICBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCBieXRlTGVuZ3RoLCBsaW1pdCAtIDEsIC1saW1pdClcbiAgfVxuXG4gIHZhciBpID0gYnl0ZUxlbmd0aCAtIDFcbiAgdmFyIG11bCA9IDFcbiAgdmFyIHN1YiA9IHZhbHVlIDwgMCA/IDEgOiAwXG4gIHRoaXNbb2Zmc2V0ICsgaV0gPSB2YWx1ZSAmIDB4RkZcbiAgd2hpbGUgKC0taSA+PSAwICYmIChtdWwgKj0gMHgxMDApKSB7XG4gICAgdGhpc1tvZmZzZXQgKyBpXSA9ICgodmFsdWUgLyBtdWwpID4+IDApIC0gc3ViICYgMHhGRlxuICB9XG5cbiAgcmV0dXJuIG9mZnNldCArIGJ5dGVMZW5ndGhcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUludDggPSBmdW5jdGlvbiB3cml0ZUludDggKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgMSwgMHg3ZiwgLTB4ODApXG4gIGlmICghQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHZhbHVlID0gTWF0aC5mbG9vcih2YWx1ZSlcbiAgaWYgKHZhbHVlIDwgMCkgdmFsdWUgPSAweGZmICsgdmFsdWUgKyAxXG4gIHRoaXNbb2Zmc2V0XSA9ICh2YWx1ZSAmIDB4ZmYpXG4gIHJldHVybiBvZmZzZXQgKyAxXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVJbnQxNkxFID0gZnVuY3Rpb24gd3JpdGVJbnQxNkxFICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIDIsIDB4N2ZmZiwgLTB4ODAwMClcbiAgaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgdGhpc1tvZmZzZXRdID0gKHZhbHVlICYgMHhmZilcbiAgICB0aGlzW29mZnNldCArIDFdID0gKHZhbHVlID4+PiA4KVxuICB9IGVsc2Uge1xuICAgIG9iamVjdFdyaXRlVUludDE2KHRoaXMsIHZhbHVlLCBvZmZzZXQsIHRydWUpXG4gIH1cbiAgcmV0dXJuIG9mZnNldCArIDJcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUludDE2QkUgPSBmdW5jdGlvbiB3cml0ZUludDE2QkUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgMiwgMHg3ZmZmLCAtMHg4MDAwKVxuICBpZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICB0aGlzW29mZnNldF0gPSAodmFsdWUgPj4+IDgpXG4gICAgdGhpc1tvZmZzZXQgKyAxXSA9ICh2YWx1ZSAmIDB4ZmYpXG4gIH0gZWxzZSB7XG4gICAgb2JqZWN0V3JpdGVVSW50MTYodGhpcywgdmFsdWUsIG9mZnNldCwgZmFsc2UpXG4gIH1cbiAgcmV0dXJuIG9mZnNldCArIDJcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUludDMyTEUgPSBmdW5jdGlvbiB3cml0ZUludDMyTEUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgNCwgMHg3ZmZmZmZmZiwgLTB4ODAwMDAwMDApXG4gIGlmIChCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkge1xuICAgIHRoaXNbb2Zmc2V0XSA9ICh2YWx1ZSAmIDB4ZmYpXG4gICAgdGhpc1tvZmZzZXQgKyAxXSA9ICh2YWx1ZSA+Pj4gOClcbiAgICB0aGlzW29mZnNldCArIDJdID0gKHZhbHVlID4+PiAxNilcbiAgICB0aGlzW29mZnNldCArIDNdID0gKHZhbHVlID4+PiAyNClcbiAgfSBlbHNlIHtcbiAgICBvYmplY3RXcml0ZVVJbnQzMih0aGlzLCB2YWx1ZSwgb2Zmc2V0LCB0cnVlKVxuICB9XG4gIHJldHVybiBvZmZzZXQgKyA0XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVJbnQzMkJFID0gZnVuY3Rpb24gd3JpdGVJbnQzMkJFICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIDQsIDB4N2ZmZmZmZmYsIC0weDgwMDAwMDAwKVxuICBpZiAodmFsdWUgPCAwKSB2YWx1ZSA9IDB4ZmZmZmZmZmYgKyB2YWx1ZSArIDFcbiAgaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgdGhpc1tvZmZzZXRdID0gKHZhbHVlID4+PiAyNClcbiAgICB0aGlzW29mZnNldCArIDFdID0gKHZhbHVlID4+PiAxNilcbiAgICB0aGlzW29mZnNldCArIDJdID0gKHZhbHVlID4+PiA4KVxuICAgIHRoaXNbb2Zmc2V0ICsgM10gPSAodmFsdWUgJiAweGZmKVxuICB9IGVsc2Uge1xuICAgIG9iamVjdFdyaXRlVUludDMyKHRoaXMsIHZhbHVlLCBvZmZzZXQsIGZhbHNlKVxuICB9XG4gIHJldHVybiBvZmZzZXQgKyA0XG59XG5cbmZ1bmN0aW9uIGNoZWNrSUVFRTc1NCAoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBleHQsIG1heCwgbWluKSB7XG4gIGlmIChvZmZzZXQgKyBleHQgPiBidWYubGVuZ3RoKSB0aHJvdyBuZXcgUmFuZ2VFcnJvcignaW5kZXggb3V0IG9mIHJhbmdlJylcbiAgaWYgKG9mZnNldCA8IDApIHRocm93IG5ldyBSYW5nZUVycm9yKCdpbmRleCBvdXQgb2YgcmFuZ2UnKVxufVxuXG5mdW5jdGlvbiB3cml0ZUZsb2F0IChidWYsIHZhbHVlLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIGNoZWNrSUVFRTc1NChidWYsIHZhbHVlLCBvZmZzZXQsIDQsIDMuNDAyODIzNDY2Mzg1Mjg4NmUrMzgsIC0zLjQwMjgyMzQ2NjM4NTI4ODZlKzM4KVxuICB9XG4gIGllZWU3NTQud3JpdGUoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIDIzLCA0KVxuICByZXR1cm4gb2Zmc2V0ICsgNFxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlRmxvYXRMRSA9IGZ1bmN0aW9uIHdyaXRlRmxvYXRMRSAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgcmV0dXJuIHdyaXRlRmxvYXQodGhpcywgdmFsdWUsIG9mZnNldCwgdHJ1ZSwgbm9Bc3NlcnQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVGbG9hdEJFID0gZnVuY3Rpb24gd3JpdGVGbG9hdEJFICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gd3JpdGVGbG9hdCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCBmYWxzZSwgbm9Bc3NlcnQpXG59XG5cbmZ1bmN0aW9uIHdyaXRlRG91YmxlIChidWYsIHZhbHVlLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIGNoZWNrSUVFRTc1NChidWYsIHZhbHVlLCBvZmZzZXQsIDgsIDEuNzk3NjkzMTM0ODYyMzE1N0UrMzA4LCAtMS43OTc2OTMxMzQ4NjIzMTU3RSszMDgpXG4gIH1cbiAgaWVlZTc1NC53cml0ZShidWYsIHZhbHVlLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgNTIsIDgpXG4gIHJldHVybiBvZmZzZXQgKyA4XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVEb3VibGVMRSA9IGZ1bmN0aW9uIHdyaXRlRG91YmxlTEUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiB3cml0ZURvdWJsZSh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCB0cnVlLCBub0Fzc2VydClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZURvdWJsZUJFID0gZnVuY3Rpb24gd3JpdGVEb3VibGVCRSAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgcmV0dXJuIHdyaXRlRG91YmxlKHRoaXMsIHZhbHVlLCBvZmZzZXQsIGZhbHNlLCBub0Fzc2VydClcbn1cblxuLy8gY29weSh0YXJnZXRCdWZmZXIsIHRhcmdldFN0YXJ0PTAsIHNvdXJjZVN0YXJ0PTAsIHNvdXJjZUVuZD1idWZmZXIubGVuZ3RoKVxuQnVmZmVyLnByb3RvdHlwZS5jb3B5ID0gZnVuY3Rpb24gY29weSAodGFyZ2V0LCB0YXJnZXRTdGFydCwgc3RhcnQsIGVuZCkge1xuICBpZiAoIXN0YXJ0KSBzdGFydCA9IDBcbiAgaWYgKCFlbmQgJiYgZW5kICE9PSAwKSBlbmQgPSB0aGlzLmxlbmd0aFxuICBpZiAodGFyZ2V0U3RhcnQgPj0gdGFyZ2V0Lmxlbmd0aCkgdGFyZ2V0U3RhcnQgPSB0YXJnZXQubGVuZ3RoXG4gIGlmICghdGFyZ2V0U3RhcnQpIHRhcmdldFN0YXJ0ID0gMFxuICBpZiAoZW5kID4gMCAmJiBlbmQgPCBzdGFydCkgZW5kID0gc3RhcnRcblxuICAvLyBDb3B5IDAgYnl0ZXM7IHdlJ3JlIGRvbmVcbiAgaWYgKGVuZCA9PT0gc3RhcnQpIHJldHVybiAwXG4gIGlmICh0YXJnZXQubGVuZ3RoID09PSAwIHx8IHRoaXMubGVuZ3RoID09PSAwKSByZXR1cm4gMFxuXG4gIC8vIEZhdGFsIGVycm9yIGNvbmRpdGlvbnNcbiAgaWYgKHRhcmdldFN0YXJ0IDwgMCkge1xuICAgIHRocm93IG5ldyBSYW5nZUVycm9yKCd0YXJnZXRTdGFydCBvdXQgb2YgYm91bmRzJylcbiAgfVxuICBpZiAoc3RhcnQgPCAwIHx8IHN0YXJ0ID49IHRoaXMubGVuZ3RoKSB0aHJvdyBuZXcgUmFuZ2VFcnJvcignc291cmNlU3RhcnQgb3V0IG9mIGJvdW5kcycpXG4gIGlmIChlbmQgPCAwKSB0aHJvdyBuZXcgUmFuZ2VFcnJvcignc291cmNlRW5kIG91dCBvZiBib3VuZHMnKVxuXG4gIC8vIEFyZSB3ZSBvb2I/XG4gIGlmIChlbmQgPiB0aGlzLmxlbmd0aCkgZW5kID0gdGhpcy5sZW5ndGhcbiAgaWYgKHRhcmdldC5sZW5ndGggLSB0YXJnZXRTdGFydCA8IGVuZCAtIHN0YXJ0KSB7XG4gICAgZW5kID0gdGFyZ2V0Lmxlbmd0aCAtIHRhcmdldFN0YXJ0ICsgc3RhcnRcbiAgfVxuXG4gIHZhciBsZW4gPSBlbmQgLSBzdGFydFxuICB2YXIgaVxuXG4gIGlmICh0aGlzID09PSB0YXJnZXQgJiYgc3RhcnQgPCB0YXJnZXRTdGFydCAmJiB0YXJnZXRTdGFydCA8IGVuZCkge1xuICAgIC8vIGRlc2NlbmRpbmcgY29weSBmcm9tIGVuZFxuICAgIGZvciAoaSA9IGxlbiAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgICB0YXJnZXRbaSArIHRhcmdldFN0YXJ0XSA9IHRoaXNbaSArIHN0YXJ0XVxuICAgIH1cbiAgfSBlbHNlIGlmIChsZW4gPCAxMDAwIHx8ICFCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkge1xuICAgIC8vIGFzY2VuZGluZyBjb3B5IGZyb20gc3RhcnRcbiAgICBmb3IgKGkgPSAwOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgIHRhcmdldFtpICsgdGFyZ2V0U3RhcnRdID0gdGhpc1tpICsgc3RhcnRdXG4gICAgfVxuICB9IGVsc2Uge1xuICAgIFVpbnQ4QXJyYXkucHJvdG90eXBlLnNldC5jYWxsKFxuICAgICAgdGFyZ2V0LFxuICAgICAgdGhpcy5zdWJhcnJheShzdGFydCwgc3RhcnQgKyBsZW4pLFxuICAgICAgdGFyZ2V0U3RhcnRcbiAgICApXG4gIH1cblxuICByZXR1cm4gbGVuXG59XG5cbi8vIGZpbGwodmFsdWUsIHN0YXJ0PTAsIGVuZD1idWZmZXIubGVuZ3RoKVxuQnVmZmVyLnByb3RvdHlwZS5maWxsID0gZnVuY3Rpb24gZmlsbCAodmFsdWUsIHN0YXJ0LCBlbmQpIHtcbiAgaWYgKCF2YWx1ZSkgdmFsdWUgPSAwXG4gIGlmICghc3RhcnQpIHN0YXJ0ID0gMFxuICBpZiAoIWVuZCkgZW5kID0gdGhpcy5sZW5ndGhcblxuICBpZiAoZW5kIDwgc3RhcnQpIHRocm93IG5ldyBSYW5nZUVycm9yKCdlbmQgPCBzdGFydCcpXG5cbiAgLy8gRmlsbCAwIGJ5dGVzOyB3ZSdyZSBkb25lXG4gIGlmIChlbmQgPT09IHN0YXJ0KSByZXR1cm5cbiAgaWYgKHRoaXMubGVuZ3RoID09PSAwKSByZXR1cm5cblxuICBpZiAoc3RhcnQgPCAwIHx8IHN0YXJ0ID49IHRoaXMubGVuZ3RoKSB0aHJvdyBuZXcgUmFuZ2VFcnJvcignc3RhcnQgb3V0IG9mIGJvdW5kcycpXG4gIGlmIChlbmQgPCAwIHx8IGVuZCA+IHRoaXMubGVuZ3RoKSB0aHJvdyBuZXcgUmFuZ2VFcnJvcignZW5kIG91dCBvZiBib3VuZHMnKVxuXG4gIHZhciBpXG4gIGlmICh0eXBlb2YgdmFsdWUgPT09ICdudW1iZXInKSB7XG4gICAgZm9yIChpID0gc3RhcnQ7IGkgPCBlbmQ7IGkrKykge1xuICAgICAgdGhpc1tpXSA9IHZhbHVlXG4gICAgfVxuICB9IGVsc2Uge1xuICAgIHZhciBieXRlcyA9IHV0ZjhUb0J5dGVzKHZhbHVlLnRvU3RyaW5nKCkpXG4gICAgdmFyIGxlbiA9IGJ5dGVzLmxlbmd0aFxuICAgIGZvciAoaSA9IHN0YXJ0OyBpIDwgZW5kOyBpKyspIHtcbiAgICAgIHRoaXNbaV0gPSBieXRlc1tpICUgbGVuXVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiB0aGlzXG59XG5cbi8vIEhFTFBFUiBGVU5DVElPTlNcbi8vID09PT09PT09PT09PT09PT1cblxudmFyIElOVkFMSURfQkFTRTY0X1JFID0gL1teK1xcLzAtOUEtWmEtei1fXS9nXG5cbmZ1bmN0aW9uIGJhc2U2NGNsZWFuIChzdHIpIHtcbiAgLy8gTm9kZSBzdHJpcHMgb3V0IGludmFsaWQgY2hhcmFjdGVycyBsaWtlIFxcbiBhbmQgXFx0IGZyb20gdGhlIHN0cmluZywgYmFzZTY0LWpzIGRvZXMgbm90XG4gIHN0ciA9IHN0cmluZ3RyaW0oc3RyKS5yZXBsYWNlKElOVkFMSURfQkFTRTY0X1JFLCAnJylcbiAgLy8gTm9kZSBjb252ZXJ0cyBzdHJpbmdzIHdpdGggbGVuZ3RoIDwgMiB0byAnJ1xuICBpZiAoc3RyLmxlbmd0aCA8IDIpIHJldHVybiAnJ1xuICAvLyBOb2RlIGFsbG93cyBmb3Igbm9uLXBhZGRlZCBiYXNlNjQgc3RyaW5ncyAobWlzc2luZyB0cmFpbGluZyA9PT0pLCBiYXNlNjQtanMgZG9lcyBub3RcbiAgd2hpbGUgKHN0ci5sZW5ndGggJSA0ICE9PSAwKSB7XG4gICAgc3RyID0gc3RyICsgJz0nXG4gIH1cbiAgcmV0dXJuIHN0clxufVxuXG5mdW5jdGlvbiBzdHJpbmd0cmltIChzdHIpIHtcbiAgaWYgKHN0ci50cmltKSByZXR1cm4gc3RyLnRyaW0oKVxuICByZXR1cm4gc3RyLnJlcGxhY2UoL15cXHMrfFxccyskL2csICcnKVxufVxuXG5mdW5jdGlvbiB0b0hleCAobikge1xuICBpZiAobiA8IDE2KSByZXR1cm4gJzAnICsgbi50b1N0cmluZygxNilcbiAgcmV0dXJuIG4udG9TdHJpbmcoMTYpXG59XG5cbmZ1bmN0aW9uIHV0ZjhUb0J5dGVzIChzdHJpbmcsIHVuaXRzKSB7XG4gIHVuaXRzID0gdW5pdHMgfHwgSW5maW5pdHlcbiAgdmFyIGNvZGVQb2ludFxuICB2YXIgbGVuZ3RoID0gc3RyaW5nLmxlbmd0aFxuICB2YXIgbGVhZFN1cnJvZ2F0ZSA9IG51bGxcbiAgdmFyIGJ5dGVzID0gW11cblxuICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgY29kZVBvaW50ID0gc3RyaW5nLmNoYXJDb2RlQXQoaSlcblxuICAgIC8vIGlzIHN1cnJvZ2F0ZSBjb21wb25lbnRcbiAgICBpZiAoY29kZVBvaW50ID4gMHhEN0ZGICYmIGNvZGVQb2ludCA8IDB4RTAwMCkge1xuICAgICAgLy8gbGFzdCBjaGFyIHdhcyBhIGxlYWRcbiAgICAgIGlmICghbGVhZFN1cnJvZ2F0ZSkge1xuICAgICAgICAvLyBubyBsZWFkIHlldFxuICAgICAgICBpZiAoY29kZVBvaW50ID4gMHhEQkZGKSB7XG4gICAgICAgICAgLy8gdW5leHBlY3RlZCB0cmFpbFxuICAgICAgICAgIGlmICgodW5pdHMgLT0gMykgPiAtMSkgYnl0ZXMucHVzaCgweEVGLCAweEJGLCAweEJEKVxuICAgICAgICAgIGNvbnRpbnVlXG4gICAgICAgIH0gZWxzZSBpZiAoaSArIDEgPT09IGxlbmd0aCkge1xuICAgICAgICAgIC8vIHVucGFpcmVkIGxlYWRcbiAgICAgICAgICBpZiAoKHVuaXRzIC09IDMpID4gLTEpIGJ5dGVzLnB1c2goMHhFRiwgMHhCRiwgMHhCRClcbiAgICAgICAgICBjb250aW51ZVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gdmFsaWQgbGVhZFxuICAgICAgICBsZWFkU3Vycm9nYXRlID0gY29kZVBvaW50XG5cbiAgICAgICAgY29udGludWVcbiAgICAgIH1cblxuICAgICAgLy8gMiBsZWFkcyBpbiBhIHJvd1xuICAgICAgaWYgKGNvZGVQb2ludCA8IDB4REMwMCkge1xuICAgICAgICBpZiAoKHVuaXRzIC09IDMpID4gLTEpIGJ5dGVzLnB1c2goMHhFRiwgMHhCRiwgMHhCRClcbiAgICAgICAgbGVhZFN1cnJvZ2F0ZSA9IGNvZGVQb2ludFxuICAgICAgICBjb250aW51ZVxuICAgICAgfVxuXG4gICAgICAvLyB2YWxpZCBzdXJyb2dhdGUgcGFpclxuICAgICAgY29kZVBvaW50ID0gKGxlYWRTdXJyb2dhdGUgLSAweEQ4MDAgPDwgMTAgfCBjb2RlUG9pbnQgLSAweERDMDApICsgMHgxMDAwMFxuICAgIH0gZWxzZSBpZiAobGVhZFN1cnJvZ2F0ZSkge1xuICAgICAgLy8gdmFsaWQgYm1wIGNoYXIsIGJ1dCBsYXN0IGNoYXIgd2FzIGEgbGVhZFxuICAgICAgaWYgKCh1bml0cyAtPSAzKSA+IC0xKSBieXRlcy5wdXNoKDB4RUYsIDB4QkYsIDB4QkQpXG4gICAgfVxuXG4gICAgbGVhZFN1cnJvZ2F0ZSA9IG51bGxcblxuICAgIC8vIGVuY29kZSB1dGY4XG4gICAgaWYgKGNvZGVQb2ludCA8IDB4ODApIHtcbiAgICAgIGlmICgodW5pdHMgLT0gMSkgPCAwKSBicmVha1xuICAgICAgYnl0ZXMucHVzaChjb2RlUG9pbnQpXG4gICAgfSBlbHNlIGlmIChjb2RlUG9pbnQgPCAweDgwMCkge1xuICAgICAgaWYgKCh1bml0cyAtPSAyKSA8IDApIGJyZWFrXG4gICAgICBieXRlcy5wdXNoKFxuICAgICAgICBjb2RlUG9pbnQgPj4gMHg2IHwgMHhDMCxcbiAgICAgICAgY29kZVBvaW50ICYgMHgzRiB8IDB4ODBcbiAgICAgIClcbiAgICB9IGVsc2UgaWYgKGNvZGVQb2ludCA8IDB4MTAwMDApIHtcbiAgICAgIGlmICgodW5pdHMgLT0gMykgPCAwKSBicmVha1xuICAgICAgYnl0ZXMucHVzaChcbiAgICAgICAgY29kZVBvaW50ID4+IDB4QyB8IDB4RTAsXG4gICAgICAgIGNvZGVQb2ludCA+PiAweDYgJiAweDNGIHwgMHg4MCxcbiAgICAgICAgY29kZVBvaW50ICYgMHgzRiB8IDB4ODBcbiAgICAgIClcbiAgICB9IGVsc2UgaWYgKGNvZGVQb2ludCA8IDB4MTEwMDAwKSB7XG4gICAgICBpZiAoKHVuaXRzIC09IDQpIDwgMCkgYnJlYWtcbiAgICAgIGJ5dGVzLnB1c2goXG4gICAgICAgIGNvZGVQb2ludCA+PiAweDEyIHwgMHhGMCxcbiAgICAgICAgY29kZVBvaW50ID4+IDB4QyAmIDB4M0YgfCAweDgwLFxuICAgICAgICBjb2RlUG9pbnQgPj4gMHg2ICYgMHgzRiB8IDB4ODAsXG4gICAgICAgIGNvZGVQb2ludCAmIDB4M0YgfCAweDgwXG4gICAgICApXG4gICAgfSBlbHNlIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBjb2RlIHBvaW50JylcbiAgICB9XG4gIH1cblxuICByZXR1cm4gYnl0ZXNcbn1cblxuZnVuY3Rpb24gYXNjaWlUb0J5dGVzIChzdHIpIHtcbiAgdmFyIGJ5dGVBcnJheSA9IFtdXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgc3RyLmxlbmd0aDsgaSsrKSB7XG4gICAgLy8gTm9kZSdzIGNvZGUgc2VlbXMgdG8gYmUgZG9pbmcgdGhpcyBhbmQgbm90ICYgMHg3Ri4uXG4gICAgYnl0ZUFycmF5LnB1c2goc3RyLmNoYXJDb2RlQXQoaSkgJiAweEZGKVxuICB9XG4gIHJldHVybiBieXRlQXJyYXlcbn1cblxuZnVuY3Rpb24gdXRmMTZsZVRvQnl0ZXMgKHN0ciwgdW5pdHMpIHtcbiAgdmFyIGMsIGhpLCBsb1xuICB2YXIgYnl0ZUFycmF5ID0gW11cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBzdHIubGVuZ3RoOyBpKyspIHtcbiAgICBpZiAoKHVuaXRzIC09IDIpIDwgMCkgYnJlYWtcblxuICAgIGMgPSBzdHIuY2hhckNvZGVBdChpKVxuICAgIGhpID0gYyA+PiA4XG4gICAgbG8gPSBjICUgMjU2XG4gICAgYnl0ZUFycmF5LnB1c2gobG8pXG4gICAgYnl0ZUFycmF5LnB1c2goaGkpXG4gIH1cblxuICByZXR1cm4gYnl0ZUFycmF5XG59XG5cbmZ1bmN0aW9uIGJhc2U2NFRvQnl0ZXMgKHN0cikge1xuICByZXR1cm4gYmFzZTY0LnRvQnl0ZUFycmF5KGJhc2U2NGNsZWFuKHN0cikpXG59XG5cbmZ1bmN0aW9uIGJsaXRCdWZmZXIgKHNyYywgZHN0LCBvZmZzZXQsIGxlbmd0aCkge1xuICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgaWYgKChpICsgb2Zmc2V0ID49IGRzdC5sZW5ndGgpIHx8IChpID49IHNyYy5sZW5ndGgpKSBicmVha1xuICAgIGRzdFtpICsgb2Zmc2V0XSA9IHNyY1tpXVxuICB9XG4gIHJldHVybiBpXG59XG4iLCIndXNlIHN0cmljdCdcblxuZXhwb3J0cy50b0J5dGVBcnJheSA9IHRvQnl0ZUFycmF5XG5leHBvcnRzLmZyb21CeXRlQXJyYXkgPSBmcm9tQnl0ZUFycmF5XG5cbnZhciBsb29rdXAgPSBbXVxudmFyIHJldkxvb2t1cCA9IFtdXG52YXIgQXJyID0gdHlwZW9mIFVpbnQ4QXJyYXkgIT09ICd1bmRlZmluZWQnID8gVWludDhBcnJheSA6IEFycmF5XG5cbmZ1bmN0aW9uIGluaXQgKCkge1xuICB2YXIgY29kZSA9ICdBQkNERUZHSElKS0xNTk9QUVJTVFVWV1hZWmFiY2RlZmdoaWprbG1ub3BxcnN0dXZ3eHl6MDEyMzQ1Njc4OSsvJ1xuICBmb3IgKHZhciBpID0gMCwgbGVuID0gY29kZS5sZW5ndGg7IGkgPCBsZW47ICsraSkge1xuICAgIGxvb2t1cFtpXSA9IGNvZGVbaV1cbiAgICByZXZMb29rdXBbY29kZS5jaGFyQ29kZUF0KGkpXSA9IGlcbiAgfVxuXG4gIHJldkxvb2t1cFsnLScuY2hhckNvZGVBdCgwKV0gPSA2MlxuICByZXZMb29rdXBbJ18nLmNoYXJDb2RlQXQoMCldID0gNjNcbn1cblxuaW5pdCgpXG5cbmZ1bmN0aW9uIHRvQnl0ZUFycmF5IChiNjQpIHtcbiAgdmFyIGksIGosIGwsIHRtcCwgcGxhY2VIb2xkZXJzLCBhcnJcbiAgdmFyIGxlbiA9IGI2NC5sZW5ndGhcblxuICBpZiAobGVuICUgNCA+IDApIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgc3RyaW5nLiBMZW5ndGggbXVzdCBiZSBhIG11bHRpcGxlIG9mIDQnKVxuICB9XG5cbiAgLy8gdGhlIG51bWJlciBvZiBlcXVhbCBzaWducyAocGxhY2UgaG9sZGVycylcbiAgLy8gaWYgdGhlcmUgYXJlIHR3byBwbGFjZWhvbGRlcnMsIHRoYW4gdGhlIHR3byBjaGFyYWN0ZXJzIGJlZm9yZSBpdFxuICAvLyByZXByZXNlbnQgb25lIGJ5dGVcbiAgLy8gaWYgdGhlcmUgaXMgb25seSBvbmUsIHRoZW4gdGhlIHRocmVlIGNoYXJhY3RlcnMgYmVmb3JlIGl0IHJlcHJlc2VudCAyIGJ5dGVzXG4gIC8vIHRoaXMgaXMganVzdCBhIGNoZWFwIGhhY2sgdG8gbm90IGRvIGluZGV4T2YgdHdpY2VcbiAgcGxhY2VIb2xkZXJzID0gYjY0W2xlbiAtIDJdID09PSAnPScgPyAyIDogYjY0W2xlbiAtIDFdID09PSAnPScgPyAxIDogMFxuXG4gIC8vIGJhc2U2NCBpcyA0LzMgKyB1cCB0byB0d28gY2hhcmFjdGVycyBvZiB0aGUgb3JpZ2luYWwgZGF0YVxuICBhcnIgPSBuZXcgQXJyKGxlbiAqIDMgLyA0IC0gcGxhY2VIb2xkZXJzKVxuXG4gIC8vIGlmIHRoZXJlIGFyZSBwbGFjZWhvbGRlcnMsIG9ubHkgZ2V0IHVwIHRvIHRoZSBsYXN0IGNvbXBsZXRlIDQgY2hhcnNcbiAgbCA9IHBsYWNlSG9sZGVycyA+IDAgPyBsZW4gLSA0IDogbGVuXG5cbiAgdmFyIEwgPSAwXG5cbiAgZm9yIChpID0gMCwgaiA9IDA7IGkgPCBsOyBpICs9IDQsIGogKz0gMykge1xuICAgIHRtcCA9IChyZXZMb29rdXBbYjY0LmNoYXJDb2RlQXQoaSldIDw8IDE4KSB8IChyZXZMb29rdXBbYjY0LmNoYXJDb2RlQXQoaSArIDEpXSA8PCAxMikgfCAocmV2TG9va3VwW2I2NC5jaGFyQ29kZUF0KGkgKyAyKV0gPDwgNikgfCByZXZMb29rdXBbYjY0LmNoYXJDb2RlQXQoaSArIDMpXVxuICAgIGFycltMKytdID0gKHRtcCA+PiAxNikgJiAweEZGXG4gICAgYXJyW0wrK10gPSAodG1wID4+IDgpICYgMHhGRlxuICAgIGFycltMKytdID0gdG1wICYgMHhGRlxuICB9XG5cbiAgaWYgKHBsYWNlSG9sZGVycyA9PT0gMikge1xuICAgIHRtcCA9IChyZXZMb29rdXBbYjY0LmNoYXJDb2RlQXQoaSldIDw8IDIpIHwgKHJldkxvb2t1cFtiNjQuY2hhckNvZGVBdChpICsgMSldID4+IDQpXG4gICAgYXJyW0wrK10gPSB0bXAgJiAweEZGXG4gIH0gZWxzZSBpZiAocGxhY2VIb2xkZXJzID09PSAxKSB7XG4gICAgdG1wID0gKHJldkxvb2t1cFtiNjQuY2hhckNvZGVBdChpKV0gPDwgMTApIHwgKHJldkxvb2t1cFtiNjQuY2hhckNvZGVBdChpICsgMSldIDw8IDQpIHwgKHJldkxvb2t1cFtiNjQuY2hhckNvZGVBdChpICsgMildID4+IDIpXG4gICAgYXJyW0wrK10gPSAodG1wID4+IDgpICYgMHhGRlxuICAgIGFycltMKytdID0gdG1wICYgMHhGRlxuICB9XG5cbiAgcmV0dXJuIGFyclxufVxuXG5mdW5jdGlvbiB0cmlwbGV0VG9CYXNlNjQgKG51bSkge1xuICByZXR1cm4gbG9va3VwW251bSA+PiAxOCAmIDB4M0ZdICsgbG9va3VwW251bSA+PiAxMiAmIDB4M0ZdICsgbG9va3VwW251bSA+PiA2ICYgMHgzRl0gKyBsb29rdXBbbnVtICYgMHgzRl1cbn1cblxuZnVuY3Rpb24gZW5jb2RlQ2h1bmsgKHVpbnQ4LCBzdGFydCwgZW5kKSB7XG4gIHZhciB0bXBcbiAgdmFyIG91dHB1dCA9IFtdXG4gIGZvciAodmFyIGkgPSBzdGFydDsgaSA8IGVuZDsgaSArPSAzKSB7XG4gICAgdG1wID0gKHVpbnQ4W2ldIDw8IDE2KSArICh1aW50OFtpICsgMV0gPDwgOCkgKyAodWludDhbaSArIDJdKVxuICAgIG91dHB1dC5wdXNoKHRyaXBsZXRUb0Jhc2U2NCh0bXApKVxuICB9XG4gIHJldHVybiBvdXRwdXQuam9pbignJylcbn1cblxuZnVuY3Rpb24gZnJvbUJ5dGVBcnJheSAodWludDgpIHtcbiAgdmFyIHRtcFxuICB2YXIgbGVuID0gdWludDgubGVuZ3RoXG4gIHZhciBleHRyYUJ5dGVzID0gbGVuICUgMyAvLyBpZiB3ZSBoYXZlIDEgYnl0ZSBsZWZ0LCBwYWQgMiBieXRlc1xuICB2YXIgb3V0cHV0ID0gJydcbiAgdmFyIHBhcnRzID0gW11cbiAgdmFyIG1heENodW5rTGVuZ3RoID0gMTYzODMgLy8gbXVzdCBiZSBtdWx0aXBsZSBvZiAzXG5cbiAgLy8gZ28gdGhyb3VnaCB0aGUgYXJyYXkgZXZlcnkgdGhyZWUgYnl0ZXMsIHdlJ2xsIGRlYWwgd2l0aCB0cmFpbGluZyBzdHVmZiBsYXRlclxuICBmb3IgKHZhciBpID0gMCwgbGVuMiA9IGxlbiAtIGV4dHJhQnl0ZXM7IGkgPCBsZW4yOyBpICs9IG1heENodW5rTGVuZ3RoKSB7XG4gICAgcGFydHMucHVzaChlbmNvZGVDaHVuayh1aW50OCwgaSwgKGkgKyBtYXhDaHVua0xlbmd0aCkgPiBsZW4yID8gbGVuMiA6IChpICsgbWF4Q2h1bmtMZW5ndGgpKSlcbiAgfVxuXG4gIC8vIHBhZCB0aGUgZW5kIHdpdGggemVyb3MsIGJ1dCBtYWtlIHN1cmUgdG8gbm90IGZvcmdldCB0aGUgZXh0cmEgYnl0ZXNcbiAgaWYgKGV4dHJhQnl0ZXMgPT09IDEpIHtcbiAgICB0bXAgPSB1aW50OFtsZW4gLSAxXVxuICAgIG91dHB1dCArPSBsb29rdXBbdG1wID4+IDJdXG4gICAgb3V0cHV0ICs9IGxvb2t1cFsodG1wIDw8IDQpICYgMHgzRl1cbiAgICBvdXRwdXQgKz0gJz09J1xuICB9IGVsc2UgaWYgKGV4dHJhQnl0ZXMgPT09IDIpIHtcbiAgICB0bXAgPSAodWludDhbbGVuIC0gMl0gPDwgOCkgKyAodWludDhbbGVuIC0gMV0pXG4gICAgb3V0cHV0ICs9IGxvb2t1cFt0bXAgPj4gMTBdXG4gICAgb3V0cHV0ICs9IGxvb2t1cFsodG1wID4+IDQpICYgMHgzRl1cbiAgICBvdXRwdXQgKz0gbG9va3VwWyh0bXAgPDwgMikgJiAweDNGXVxuICAgIG91dHB1dCArPSAnPSdcbiAgfVxuXG4gIHBhcnRzLnB1c2gob3V0cHV0KVxuXG4gIHJldHVybiBwYXJ0cy5qb2luKCcnKVxufVxuIiwiZXhwb3J0cy5yZWFkID0gZnVuY3Rpb24gKGJ1ZmZlciwgb2Zmc2V0LCBpc0xFLCBtTGVuLCBuQnl0ZXMpIHtcbiAgdmFyIGUsIG1cbiAgdmFyIGVMZW4gPSBuQnl0ZXMgKiA4IC0gbUxlbiAtIDFcbiAgdmFyIGVNYXggPSAoMSA8PCBlTGVuKSAtIDFcbiAgdmFyIGVCaWFzID0gZU1heCA+PiAxXG4gIHZhciBuQml0cyA9IC03XG4gIHZhciBpID0gaXNMRSA/IChuQnl0ZXMgLSAxKSA6IDBcbiAgdmFyIGQgPSBpc0xFID8gLTEgOiAxXG4gIHZhciBzID0gYnVmZmVyW29mZnNldCArIGldXG5cbiAgaSArPSBkXG5cbiAgZSA9IHMgJiAoKDEgPDwgKC1uQml0cykpIC0gMSlcbiAgcyA+Pj0gKC1uQml0cylcbiAgbkJpdHMgKz0gZUxlblxuICBmb3IgKDsgbkJpdHMgPiAwOyBlID0gZSAqIDI1NiArIGJ1ZmZlcltvZmZzZXQgKyBpXSwgaSArPSBkLCBuQml0cyAtPSA4KSB7fVxuXG4gIG0gPSBlICYgKCgxIDw8ICgtbkJpdHMpKSAtIDEpXG4gIGUgPj49ICgtbkJpdHMpXG4gIG5CaXRzICs9IG1MZW5cbiAgZm9yICg7IG5CaXRzID4gMDsgbSA9IG0gKiAyNTYgKyBidWZmZXJbb2Zmc2V0ICsgaV0sIGkgKz0gZCwgbkJpdHMgLT0gOCkge31cblxuICBpZiAoZSA9PT0gMCkge1xuICAgIGUgPSAxIC0gZUJpYXNcbiAgfSBlbHNlIGlmIChlID09PSBlTWF4KSB7XG4gICAgcmV0dXJuIG0gPyBOYU4gOiAoKHMgPyAtMSA6IDEpICogSW5maW5pdHkpXG4gIH0gZWxzZSB7XG4gICAgbSA9IG0gKyBNYXRoLnBvdygyLCBtTGVuKVxuICAgIGUgPSBlIC0gZUJpYXNcbiAgfVxuICByZXR1cm4gKHMgPyAtMSA6IDEpICogbSAqIE1hdGgucG93KDIsIGUgLSBtTGVuKVxufVxuXG5leHBvcnRzLndyaXRlID0gZnVuY3Rpb24gKGJ1ZmZlciwgdmFsdWUsIG9mZnNldCwgaXNMRSwgbUxlbiwgbkJ5dGVzKSB7XG4gIHZhciBlLCBtLCBjXG4gIHZhciBlTGVuID0gbkJ5dGVzICogOCAtIG1MZW4gLSAxXG4gIHZhciBlTWF4ID0gKDEgPDwgZUxlbikgLSAxXG4gIHZhciBlQmlhcyA9IGVNYXggPj4gMVxuICB2YXIgcnQgPSAobUxlbiA9PT0gMjMgPyBNYXRoLnBvdygyLCAtMjQpIC0gTWF0aC5wb3coMiwgLTc3KSA6IDApXG4gIHZhciBpID0gaXNMRSA/IDAgOiAobkJ5dGVzIC0gMSlcbiAgdmFyIGQgPSBpc0xFID8gMSA6IC0xXG4gIHZhciBzID0gdmFsdWUgPCAwIHx8ICh2YWx1ZSA9PT0gMCAmJiAxIC8gdmFsdWUgPCAwKSA/IDEgOiAwXG5cbiAgdmFsdWUgPSBNYXRoLmFicyh2YWx1ZSlcblxuICBpZiAoaXNOYU4odmFsdWUpIHx8IHZhbHVlID09PSBJbmZpbml0eSkge1xuICAgIG0gPSBpc05hTih2YWx1ZSkgPyAxIDogMFxuICAgIGUgPSBlTWF4XG4gIH0gZWxzZSB7XG4gICAgZSA9IE1hdGguZmxvb3IoTWF0aC5sb2codmFsdWUpIC8gTWF0aC5MTjIpXG4gICAgaWYgKHZhbHVlICogKGMgPSBNYXRoLnBvdygyLCAtZSkpIDwgMSkge1xuICAgICAgZS0tXG4gICAgICBjICo9IDJcbiAgICB9XG4gICAgaWYgKGUgKyBlQmlhcyA+PSAxKSB7XG4gICAgICB2YWx1ZSArPSBydCAvIGNcbiAgICB9IGVsc2Uge1xuICAgICAgdmFsdWUgKz0gcnQgKiBNYXRoLnBvdygyLCAxIC0gZUJpYXMpXG4gICAgfVxuICAgIGlmICh2YWx1ZSAqIGMgPj0gMikge1xuICAgICAgZSsrXG4gICAgICBjIC89IDJcbiAgICB9XG5cbiAgICBpZiAoZSArIGVCaWFzID49IGVNYXgpIHtcbiAgICAgIG0gPSAwXG4gICAgICBlID0gZU1heFxuICAgIH0gZWxzZSBpZiAoZSArIGVCaWFzID49IDEpIHtcbiAgICAgIG0gPSAodmFsdWUgKiBjIC0gMSkgKiBNYXRoLnBvdygyLCBtTGVuKVxuICAgICAgZSA9IGUgKyBlQmlhc1xuICAgIH0gZWxzZSB7XG4gICAgICBtID0gdmFsdWUgKiBNYXRoLnBvdygyLCBlQmlhcyAtIDEpICogTWF0aC5wb3coMiwgbUxlbilcbiAgICAgIGUgPSAwXG4gICAgfVxuICB9XG5cbiAgZm9yICg7IG1MZW4gPj0gODsgYnVmZmVyW29mZnNldCArIGldID0gbSAmIDB4ZmYsIGkgKz0gZCwgbSAvPSAyNTYsIG1MZW4gLT0gOCkge31cblxuICBlID0gKGUgPDwgbUxlbikgfCBtXG4gIGVMZW4gKz0gbUxlblxuICBmb3IgKDsgZUxlbiA+IDA7IGJ1ZmZlcltvZmZzZXQgKyBpXSA9IGUgJiAweGZmLCBpICs9IGQsIGUgLz0gMjU2LCBlTGVuIC09IDgpIHt9XG5cbiAgYnVmZmVyW29mZnNldCArIGkgLSBkXSB8PSBzICogMTI4XG59XG4iLCJ2YXIgdG9TdHJpbmcgPSB7fS50b1N0cmluZztcblxubW9kdWxlLmV4cG9ydHMgPSBBcnJheS5pc0FycmF5IHx8IGZ1bmN0aW9uIChhcnIpIHtcbiAgcmV0dXJuIHRvU3RyaW5nLmNhbGwoYXJyKSA9PSAnW29iamVjdCBBcnJheV0nO1xufTtcbiIsIihmdW5jdGlvbigpIHtcbiAgJ3VzZSBzdHJpY3QnO1xuXG4gIGNvbnN0IEFWUyA9IHJlcXVpcmUoJy4vbGliL0FWUycpO1xuXG4gIGlmICh0eXBlb2YgZXhwb3J0cyAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICBpZiAodHlwZW9mIG1vZHVsZSAhPT0gJ3VuZGVmaW5lZCcgJiYgbW9kdWxlLmV4cG9ydHMpIHtcbiAgICAgIGV4cG9ydHMgPSBtb2R1bGUuZXhwb3J0cyA9IEFWUztcbiAgICB9XG4gICAgZXhwb3J0cy5BVlMgPSBBVlM7XG4gIH1cblxuICBpZiAodHlwZW9mIGRlZmluZSA9PT0gJ2Z1bmN0aW9uJyAmJiBkZWZpbmUuYW1kKSB7XG4gICAgZGVmaW5lKFtdLCBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiBBVlM7XG4gICAgfSk7XG4gIH1cblxuICBpZiAodHlwZW9mIHdpbmRvdyA9PT0gJ29iamVjdCcpIHtcbiAgICB3aW5kb3cuQVZTID0gQVZTO1xuICB9XG59KSgpO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG5jb25zdCBCdWZmZXIgPSByZXF1aXJlKCdidWZmZXInKS5CdWZmZXI7XG5jb25zdCBxcyA9IHJlcXVpcmUoJ3FzJyk7XG5jb25zdCBodHRwTWVzc2FnZVBhcnNlciA9IHJlcXVpcmUoJ2h0dHAtbWVzc2FnZS1wYXJzZXInKTtcblxuY29uc3QgQU1BWk9OX0VSUk9SX0NPREVTID0gcmVxdWlyZSgnLi9BbWF6b25FcnJvckNvZGVzLmpzJyk7XG5jb25zdCBPYnNlcnZhYmxlID0gcmVxdWlyZSgnLi9PYnNlcnZhYmxlLmpzJyk7XG5jb25zdCBQbGF5ZXIgPSByZXF1aXJlKCcuL1BsYXllci5qcycpO1xuY29uc3QgYXJyYXlCdWZmZXJUb1N0cmluZyA9IHJlcXVpcmUoJy4vdXRpbHMvYXJyYXlCdWZmZXJUb1N0cmluZy5qcycpO1xuY29uc3Qgd3JpdGVVVEZCeXRlcyA9IHJlcXVpcmUoJy4vdXRpbHMvd3JpdGVVVEZCeXRlcy5qcycpO1xuY29uc3QgbWVyZ2VCdWZmZXJzID0gcmVxdWlyZSgnLi91dGlscy9tZXJnZUJ1ZmZlcnMuanMnKTtcbmNvbnN0IGludGVybGVhdmUgPSByZXF1aXJlKCcuL3V0aWxzL2ludGVybGVhdmUuanMnKTtcbmNvbnN0IGRvd25zYW1wbGVCdWZmZXIgPSByZXF1aXJlKCcuL3V0aWxzL2Rvd25zYW1wbGVCdWZmZXIuanMnKTtcblxuY2xhc3MgQVZTIHtcbiAgY29uc3RydWN0b3Iob3B0aW9ucyA9IHt9KSB7XG4gICAgT2JzZXJ2YWJsZSh0aGlzKTtcblxuICAgIHRoaXMuX2J1ZmZlclNpemUgPSAyMDQ4O1xuICAgIHRoaXMuX2lucHV0Q2hhbm5lbHMgPSAxO1xuICAgIHRoaXMuX291dHB1dENoYW5uZWxzID0gMTtcbiAgICB0aGlzLl9sZWZ0Q2hhbm5lbCA9IFtdO1xuICAgIHRoaXMuX3JpZ2h0Q2hhbm5lbCA9IFtdO1xuICAgIHRoaXMuX2F1ZGlvQ29udGV4dCA9IG51bGw7XG4gICAgdGhpcy5fcmVjb3JkZXIgPSBudWxsO1xuICAgIHRoaXMuX3NhbXBsZVJhdGUgPSBudWxsO1xuICAgIHRoaXMuX291dHB1dFNhbXBsZVJhdGUgPSAxNjAwMDtcbiAgICB0aGlzLl9hdWRpb0lucHV0ID0gbnVsbDtcbiAgICB0aGlzLl92b2x1bWVOb2RlID0gbnVsbDtcbiAgICB0aGlzLl9kZWJ1ZyA9IGZhbHNlO1xuICAgIHRoaXMuX3Rva2VuID0gbnVsbDtcbiAgICB0aGlzLl9yZWZyZXNoVG9rZW4gPSBudWxsO1xuICAgIHRoaXMuX2NsaWVudElkID0gbnVsbDtcbiAgICB0aGlzLl9jbGllbnRTZWNyZXQgPSBudWxsO1xuICAgIHRoaXMuX2RldmljZUlkPSBudWxsO1xuICAgIHRoaXMuX2RldmljZVNlcmlhbE51bWJlciA9IG51bGw7XG4gICAgdGhpcy5fcmVkaXJlY3RVcmkgPSBudWxsO1xuICAgIHRoaXMuX2F1ZGlvUXVldWUgPSBbXTtcblxuICAgIGlmIChvcHRpb25zLnRva2VuKSB7XG4gICAgICB0aGlzLnNldFRva2VuKG9wdGlvbnMudG9rZW4pO1xuICAgIH1cblxuICAgIGlmIChvcHRpb25zLnJlZnJlc2hUb2tlbikge1xuICAgICAgdGhpcy5zZXRSZWZyZXNoVG9rZW4ob3B0aW9ucy5yZWZyZXNoVG9rZW4pO1xuICAgIH1cblxuICAgIGlmIChvcHRpb25zLmNsaWVudElkKSB7XG4gICAgICB0aGlzLnNldENsaWVudElkKG9wdGlvbnMuY2xpZW50SWQpO1xuICAgIH1cblxuICAgIGlmIChvcHRpb25zLmNsaWVudFNlY3JldCkge1xuICAgICAgdGhpcy5zZXRDbGllbnRTZWNyZXQob3B0aW9ucy5jbGllbnRTZWNyZXQpO1xuICAgIH1cblxuICAgIGlmIChvcHRpb25zLmRldmljZUlkKSB7XG4gICAgICB0aGlzLnNldERldmljZUlkKG9wdGlvbnMuZGV2aWNlSWQpO1xuICAgIH1cblxuICAgIGlmIChvcHRpb25zLmRldmljZVNlcmlhbE51bWJlcikge1xuICAgICAgdGhpcy5zZXREZXZpY2VTZXJpYWxOdW1iZXIob3B0aW9ucy5kZXZpY2VTZXJpYWxOdW1iZXIpO1xuICAgIH1cblxuICAgIGlmIChvcHRpb25zLnJlZGlyZWN0VXJpKSB7XG4gICAgICB0aGlzLnNldFJlZGlyZWN0VXJpKG9wdGlvbnMucmVkaXJlY3RVcmkpO1xuICAgIH1cblxuICAgIGlmIChvcHRpb25zLmRlYnVnKSB7XG4gICAgICB0aGlzLnNldERlYnVnKG9wdGlvbnMuZGVidWcpO1xuICAgIH1cblxuICAgIHRoaXMucGxheWVyID0gbmV3IFBsYXllcigpO1xuICB9XG5cbiAgX2xvZyh0eXBlLCBtZXNzYWdlKSB7XG4gICAgaWYgKHR5cGUgJiYgIW1lc3NhZ2UpIHtcbiAgICAgIG1lc3NhZ2UgPSB0eXBlO1xuICAgICAgdHlwZSA9ICdsb2cnO1xuICAgIH1cblxuICAgIHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgdGhpcy5lbWl0KEFWUy5FdmVudFR5cGVzLkxPRywgbWVzc2FnZSk7XG4gICAgfSwgMCk7XG5cbiAgICBpZiAodGhpcy5fZGVidWcpIHtcbiAgICAgIGNvbnNvbGVbdHlwZV0obWVzc2FnZSk7XG4gICAgfVxuICB9XG5cbiAgbG9naW4ob3B0aW9ucyA9IHt9KSB7XG4gICAgcmV0dXJuIHRoaXMucHJvbXB0VXNlckxvZ2luKG9wdGlvbnMpO1xuICB9XG5cbiAgbG9nb3V0KCkge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICB0aGlzLl90b2tlbiA9IG51bGw7XG4gICAgICB0aGlzLl9yZWZyZXNoVG9rZW4gPSBudWxsO1xuICAgICAgdGhpcy5lbWl0KEFWUy5FdmVudFR5cGVzLkxPR09VVCk7XG4gICAgICB0aGlzLl9sb2coJ0xvZ2dlZCBvdXQnKTtcbiAgICAgIHJlc29sdmUoKTtcbiAgICB9KTtcbiAgfVxuXG4gIHByb21wdFVzZXJMb2dpbihvcHRpb25zID0ge3Jlc3BvbnNlVHlwZTogJ3Rva2VuJywgbmV3V2luZG93OiBmYWxzZX0pIHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgaWYgKHR5cGVvZiBvcHRpb25zLnJlc3BvbnNlVHlwZSA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgb3B0aW9ucy5yZXNwb25zZVR5cGUgPSAndG9rZW4nO1xuICAgICAgfVxuXG4gICAgICBpZiAodHlwZW9mIG9wdGlvbnMucmVzcG9uc2VUeXBlICE9PSAnc3RyaW5nJykge1xuICAgICAgICBjb25zdCBlcnJvciA9IG5ldyBFcnJvcignYHJlc3BvbnNlVHlwZWAgbXVzdCBhIHN0cmluZy4nKTtcbiAgICAgICAgdGhpcy5fbG9nKGVycm9yKTtcbiAgICAgICAgcmV0dXJuIHJlamVjdChlcnJvcik7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IG5ld1dpbmRvdyA9ICEhb3B0aW9ucy5uZXdXaW5kb3c7XG5cbiAgICAgIGNvbnN0IHJlc3BvbnNlVHlwZSA9IG9wdGlvbnMucmVzcG9uc2VUeXBlO1xuXG4gICAgICBpZiAoIShyZXNwb25zZVR5cGUgPT09ICdjb2RlJyB8fCByZXNwb25zZVR5cGUgPT09ICd0b2tlbicpKSB7XG4gICAgICAgIGNvbnN0IGVycm9yID0gbmV3IEVycm9yKCdgcmVzcG9uc2VUeXBlYCBtdXN0IGJlIGVpdGhlciBgY29kZWAgb3IgYHRva2VuYC4nKTtcbiAgICAgICAgdGhpcy5fbG9nKGVycm9yKTtcbiAgICAgICAgcmV0dXJuIHJlamVjdChlcnJvcik7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IHNjb3BlID0gJ2FsZXhhOmFsbCc7XG4gICAgICBjb25zdCBzY29wZURhdGEgPSB7XG4gICAgICAgIFtzY29wZV06IHtcbiAgICAgICAgICBwcm9kdWN0SUQ6IHRoaXMuX2RldmljZUlkLFxuICAgICAgICAgIHByb2R1Y3RJbnN0YW5jZUF0dHJpYnV0ZXM6IHtcbiAgICAgICAgICAgIGRldmljZVNlcmlhbE51bWJlcjogdGhpcy5fZGV2aWNlU2VyaWFsTnVtYmVyXG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9O1xuXG4gICAgICBjb25zdCBhdXRoVXJsID0gYGh0dHBzOi8vd3d3LmFtYXpvbi5jb20vYXAvb2E/Y2xpZW50X2lkPSR7dGhpcy5fY2xpZW50SWR9JnNjb3BlPSR7ZW5jb2RlVVJJQ29tcG9uZW50KHNjb3BlKX0mc2NvcGVfZGF0YT0ke2VuY29kZVVSSUNvbXBvbmVudChKU09OLnN0cmluZ2lmeShzY29wZURhdGEpKX0mcmVzcG9uc2VfdHlwZT0ke3Jlc3BvbnNlVHlwZX0mcmVkaXJlY3RfdXJpPSR7ZW5jb2RlVVJJKHRoaXMuX3JlZGlyZWN0VXJpKX1gXG5cbiAgICAgIGlmIChuZXdXaW5kb3cpIHtcbiAgICAgICAgd2luZG93Lm9wZW4oYXV0aFVybCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB3aW5kb3cubG9jYXRpb24uaHJlZiA9IGF1dGhVcmw7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICBnZXRUb2tlbkZyb21Db2RlKGNvZGUpIHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgaWYgKHR5cGVvZiBjb2RlICE9PSAnc3RyaW5nJykge1xuICAgICAgICBjb25zdCBlcnJvciA9IG5ldyBUeXBlRXJyb3IoJ2Bjb2RlYCBtdXN0IGJlIGEgc3RyaW5nLicpO1xuICAgICAgICB0aGlzLl9sb2coZXJyb3IpO1xuICAgICAgICByZXR1cm4gcmVqZWN0KGVycm9yKTtcbiAgICAgIH1cblxuICAgICAgY29uc3QgZ3JhbnRUeXBlID0gJ2F1dGhvcml6YXRpb25fY29kZSc7XG4gICAgICBjb25zdCBwb3N0RGF0YSA9IGBncmFudF90eXBlPSR7Z3JhbnRUeXBlfSZjb2RlPSR7Y29kZX0mY2xpZW50X2lkPSR7dGhpcy5fY2xpZW50SWR9JmNsaWVudF9zZWNyZXQ9JHt0aGlzLl9jbGllbnRTZWNyZXR9JnJlZGlyZWN0X3VyaT0ke2VuY29kZVVSSUNvbXBvbmVudCh0aGlzLl9yZWRpcmVjdFVyaSl9YDtcbiAgICAgIGNvbnN0IHVybCA9ICdodHRwczovL2FwaS5hbWF6b24uY29tL2F1dGgvbzIvdG9rZW4nO1xuXG4gICAgICBjb25zdCB4aHIgPSBuZXcgWE1MSHR0cFJlcXVlc3QoKTtcblxuICAgICAgeGhyLm9wZW4oJ1BPU1QnLCB1cmwsIHRydWUpO1xuICAgICAgeGhyLnNldFJlcXVlc3RIZWFkZXIoJ0NvbnRlbnQtVHlwZScsICdhcHBsaWNhdGlvbi94LXd3dy1mb3JtLXVybGVuY29kZWQ7Y2hhcnNldD1VVEYtOCcpO1xuICAgICAgeGhyLm9ubG9hZCA9IChldmVudCkgPT4ge1xuICAgICAgICBjb25zb2xlLmxvZygnUkVTUE9OU0UnLCB4aHIucmVzcG9uc2UpO1xuXG4gICAgICAgIGxldCByZXNwb25zZSA9IHhoci5yZXNwb25zZTtcblxuICAgICAgICB0cnkge1xuICAgICAgICAgIHJlc3BvbnNlID0gSlNPTi5wYXJzZSh4aHIucmVzcG9uc2UpO1xuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgIHRoaXMuX2xvZyhlcnJvcik7XG4gICAgICAgICAgcmV0dXJuIHJlamVjdChlcnJvcik7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBpc09iamVjdCA9IHJlc3BvbnNlIGluc3RhbmNlb2YgT2JqZWN0O1xuICAgICAgICBjb25zdCBlcnJvckRlc2NyaXB0aW9uID0gaXNPYmplY3QgJiYgcmVzcG9uc2UuZXJyb3JfZGVzY3JpcHRpb247XG5cbiAgICAgICAgaWYgKGVycm9yRGVzY3JpcHRpb24pIHtcbiAgICAgICAgICBjb25zdCBlcnJvciA9IG5ldyBFcnJvcihlcnJvckRlc2NyaXB0aW9uKTtcbiAgICAgICAgICB0aGlzLl9sb2coZXJyb3IpO1xuICAgICAgICAgIHJldHVybiByZWplY3QoZXJyb3IpO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgdG9rZW4gPSByZXNwb25zZS5hY2Nlc3NfdG9rZW47XG4gICAgICAgIGNvbnN0IHJlZnJlc2hUb2tlbiA9IHJlc3BvbnNlLnJlZnJlc2hfdG9rZW47XG4gICAgICAgIGNvbnN0IHRva2VuVHlwZSA9IHJlc3BvbnNlLnRva2VuX3R5cGU7XG4gICAgICAgIGNvbnN0IGV4cGlyZXNJbiA9IHJlc3BvbnNlLmV4cGlyZXNJbjtcblxuICAgICAgICB0aGlzLnNldFRva2VuKHRva2VuKVxuICAgICAgICB0aGlzLnNldFJlZnJlc2hUb2tlbihyZWZyZXNoVG9rZW4pXG5cbiAgICAgICAgdGhpcy5lbWl0KEFWUy5FdmVudFR5cGVzLkxPR0lOKTtcbiAgICAgICAgdGhpcy5fbG9nKCdMb2dnZWQgaW4uJyk7XG4gICAgICAgIHJlc29sdmUocmVzcG9uc2UpO1xuICAgICAgfTtcblxuICAgICAgeGhyLm9uZXJyb3IgPSAoZXJyb3IpID0+IHtcbiAgICAgICAgdGhpcy5fbG9nKGVycm9yKTtcbiAgICAgICAgcmVqZWN0KGVycm9yKTtcbiAgICAgIH07XG5cbiAgICAgIHhoci5zZW5kKHBvc3REYXRhKTtcbiAgICB9KTtcbiAgfVxuXG4gIHJlZnJlc2hUb2tlbigpIHtcbiAgICByZXR1cm4gdGhpcy5nZXRUb2tlbkZyb21SZWZyZXNoVG9rZW4odGhpcy5fcmVmcmVzaFRva2VuKVxuICAgIC50aGVuKCgpID0+IHtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHRva2VuOiB0aGlzLl90b2tlbixcbiAgICAgICAgcmVmcmVzaFRva2VuOiB0aGlzLl9yZWZyZXNoVG9rZW5cbiAgICAgIH07XG4gICAgfSk7XG4gIH1cblxuICBnZXRUb2tlbkZyb21SZWZyZXNoVG9rZW4ocmVmcmVzaFRva2VuID0gdGhpcy5fcmVmcmVzaFRva2VuKSB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgIGlmICh0eXBlb2YgcmVmcmVzaFRva2VuICE9PSAnc3RyaW5nJykge1xuICAgICAgICBjb25zdCBlcnJvciA9IG5ldyBFcnJvcignYHJlZnJlc2hUb2tlbmAgbXVzdCBhIHN0cmluZy4nKTtcbiAgICAgICAgdGhpcy5fbG9nKGVycm9yKTtcbiAgICAgICAgcmV0dXJuIHJlamVjdChlcnJvcik7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IGdyYW50VHlwZSA9ICdyZWZyZXNoX3Rva2VuJztcbiAgICAgIGNvbnN0IHBvc3REYXRhID0gYGdyYW50X3R5cGU9JHtncmFudFR5cGV9JnJlZnJlc2hfdG9rZW49JHtyZWZyZXNoVG9rZW59JmNsaWVudF9pZD0ke3RoaXMuX2NsaWVudElkfSZjbGllbnRfc2VjcmV0PSR7dGhpcy5fY2xpZW50U2VjcmV0fSZyZWRpcmVjdF91cmk9JHtlbmNvZGVVUklDb21wb25lbnQodGhpcy5fcmVkaXJlY3RVcmkpfWA7XG4gICAgICBjb25zdCB1cmwgPSAnaHR0cHM6Ly9hcGkuYW1hem9uLmNvbS9hdXRoL28yL3Rva2VuJztcbiAgICAgIGNvbnN0IHhociA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xuXG4gICAgICB4aHIub3BlbignUE9TVCcsIHVybCwgdHJ1ZSk7XG4gICAgICB4aHIuc2V0UmVxdWVzdEhlYWRlcignQ29udGVudC1UeXBlJywgJ2FwcGxpY2F0aW9uL3gtd3d3LWZvcm0tdXJsZW5jb2RlZDtjaGFyc2V0PVVURi04Jyk7XG4gICAgICB4aHIucmVzcG9uc2VUeXBlID0gJ2pzb24nO1xuICAgICAgeGhyLm9ubG9hZCA9IChldmVudCkgPT4ge1xuICAgICAgICBjb25zdCByZXNwb25zZSA9IHhoci5yZXNwb25zZTtcblxuICAgICAgICBpZiAocmVzcG9uc2UuZXJyb3IpIHtcbiAgICAgICAgICBjb25zdCBlcnJvciA9IHJlc3BvbnNlLmVycm9yLm1lc3NhZ2U7XG4gICAgICAgICAgdGhpcy5lbWl0KEFWUy5FdmVudFR5cGVzLkVSUk9SLCBlcnJvcik7XG5cbiAgICAgICAgICByZXR1cm4gcmVqZWN0KGVycm9yKTtcbiAgICAgICAgfSBlbHNlICB7XG4gICAgICAgICAgY29uc3QgdG9rZW4gPSByZXNwb25zZS5hY2Nlc3NfdG9rZW47XG4gICAgICAgICAgY29uc3QgcmVmcmVzaFRva2VuID0gcmVzcG9uc2UucmVmcmVzaF90b2tlbjtcblxuICAgICAgICAgIHRoaXMuc2V0VG9rZW4odG9rZW4pO1xuICAgICAgICAgIHRoaXMuc2V0UmVmcmVzaFRva2VuKHJlZnJlc2hUb2tlbik7XG5cbiAgICAgICAgICByZXR1cm4gcmVzb2x2ZSh0b2tlbik7XG4gICAgICAgIH1cbiAgICAgIH07XG5cbiAgICAgIHhoci5vbmVycm9yID0gKGVycm9yKSA9PiB7XG4gICAgICAgIHRoaXMuX2xvZyhlcnJvcik7XG4gICAgICAgIHJlamVjdChlcnJvcik7XG4gICAgICB9O1xuXG4gICAgICB4aHIuc2VuZChwb3N0RGF0YSk7XG4gICAgfSk7XG4gIH1cblxuICBnZXRUb2tlbkZyb21VcmwoKSB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgIGxldCBoYXNoID0gd2luZG93LmxvY2F0aW9uLmhhc2guc3Vic3RyKDEpO1xuXG4gICAgICBjb25zdCBxdWVyeSA9IHFzLnBhcnNlKGhhc2gpO1xuICAgICAgY29uc3QgdG9rZW4gPSBxdWVyeS5hY2Nlc3NfdG9rZW47XG4gICAgICBjb25zdCByZWZyZXNoVG9rZW4gPSBxdWVyeS5yZWZyZXNoX3Rva2VuO1xuICAgICAgY29uc3QgdG9rZW5UeXBlID0gcXVlcnkudG9rZW5fdHlwZTtcbiAgICAgIGNvbnN0IGV4cGlyZXNJbiA9IHF1ZXJ5LmV4cGlyZXNJbjtcblxuICAgICAgaWYgKHRva2VuKSB7XG4gICAgICAgIHRoaXMuc2V0VG9rZW4odG9rZW4pXG4gICAgICAgIHRoaXMuZW1pdChBVlMuRXZlbnRUeXBlcy5MT0dJTik7XG4gICAgICAgIHRoaXMuX2xvZygnTG9nZ2VkIGluLicpO1xuXG4gICAgICAgIGlmIChyZWZyZXNoVG9rZW4pIHtcbiAgICAgICAgICB0aGlzLnNldFJlZnJlc2hUb2tlbihyZWZyZXNoVG9rZW4pO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHJlc29sdmUodG9rZW4pO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gcmVqZWN0KCk7XG4gICAgfSk7XG4gIH1cblxuICBnZXRDb2RlRnJvbVVybCgpIHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgY29uc3QgcXVlcnkgPSBxcy5wYXJzZSh3aW5kb3cubG9jYXRpb24uc2VhcmNoLnN1YnN0cigxKSk7XG4gICAgICBjb25zdCBjb2RlID0gcXVlcnkuY29kZTtcblxuICAgICAgaWYgKGNvZGUpIHtcbiAgICAgICAgcmV0dXJuIHJlc29sdmUoY29kZSk7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiByZWplY3QobnVsbCk7XG4gICAgfSk7XG4gIH1cblxuICBzZXRUb2tlbih0b2tlbikge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICBpZiAodHlwZW9mIHRva2VuID09PSAnc3RyaW5nJykge1xuICAgICAgICB0aGlzLl90b2tlbiA9IHRva2VuO1xuICAgICAgICB0aGlzLmVtaXQoQVZTLkV2ZW50VHlwZXMuVE9LRU5fU0VUKTtcbiAgICAgICAgdGhpcy5fbG9nKCdUb2tlbiBzZXQuJyk7XG4gICAgICAgIHJlc29sdmUodGhpcy5fdG9rZW4pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uc3QgZXJyb3IgPSBuZXcgVHlwZUVycm9yKCdgdG9rZW5gIG11c3QgYmUgYSBzdHJpbmcuJyk7XG4gICAgICAgIHRoaXMuX2xvZyhlcnJvcik7XG4gICAgICAgIHJlamVjdChlcnJvcik7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICBzZXRSZWZyZXNoVG9rZW4ocmVmcmVzaFRva2VuKSB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgIGlmICh0eXBlb2YgcmVmcmVzaFRva2VuID09PSAnc3RyaW5nJykge1xuICAgICAgICB0aGlzLl9yZWZyZXNoVG9rZW4gPSByZWZyZXNoVG9rZW47XG4gICAgICAgIHRoaXMuZW1pdChBVlMuRXZlbnRUeXBlcy5SRUZSRVNIX1RPS0VOX1NFVCk7XG4gICAgICAgIHRoaXMuX2xvZygnUmVmcmVzaCB0b2tlbiBzZXQuJyk7XG4gICAgICAgIHJlc29sdmUodGhpcy5fcmVmcmVzaFRva2VuKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnN0IGVycm9yID0gbmV3IFR5cGVFcnJvcignYHJlZnJlc2hUb2tlbmAgbXVzdCBiZSBhIHN0cmluZy4nKTtcbiAgICAgICAgdGhpcy5fbG9nKGVycm9yKTtcbiAgICAgICAgcmVqZWN0KGVycm9yKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIHNldENsaWVudElkKGNsaWVudElkKSB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgIGlmICh0eXBlb2YgY2xpZW50SWQgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgIHRoaXMuX2NsaWVudElkID0gY2xpZW50SWQ7XG4gICAgICAgIHJlc29sdmUodGhpcy5fY2xpZW50SWQpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uc3QgZXJyb3IgPSBuZXcgVHlwZUVycm9yKCdgY2xpZW50SWRgIG11c3QgYmUgYSBzdHJpbmcuJyk7XG4gICAgICAgIHRoaXMuX2xvZyhlcnJvcik7XG4gICAgICAgIHJlamVjdChlcnJvcik7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICBzZXRDbGllbnRTZWNyZXQoY2xpZW50U2VjcmV0KSB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgIGlmICh0eXBlb2YgY2xpZW50U2VjcmV0ID09PSAnc3RyaW5nJykge1xuICAgICAgICB0aGlzLl9jbGllbnRTZWNyZXQgPSBjbGllbnRTZWNyZXQ7XG4gICAgICAgIHJlc29sdmUodGhpcy5fY2xpZW50U2VjcmV0KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnN0IGVycm9yID0gbmV3IFR5cGVFcnJvcignYGNsaWVudFNlY3JldGAgbXVzdCBiZSBhIHN0cmluZycpO1xuICAgICAgICB0aGlzLl9sb2coZXJyb3IpO1xuICAgICAgICByZWplY3QoZXJyb3IpO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgc2V0RGV2aWNlSWQoZGV2aWNlSWQpIHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgaWYgKHR5cGVvZiBkZXZpY2VJZCA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgdGhpcy5fZGV2aWNlSWQgPSBkZXZpY2VJZDtcbiAgICAgICAgcmVzb2x2ZSh0aGlzLl9kZXZpY2VJZCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb25zdCBlcnJvciA9IG5ldyBUeXBlRXJyb3IoJ2BkZXZpY2VJZGAgbXVzdCBiZSBhIHN0cmluZy4nKTtcbiAgICAgICAgdGhpcy5fbG9nKGVycm9yKTtcbiAgICAgICAgcmVqZWN0KGVycm9yKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIHNldERldmljZVNlcmlhbE51bWJlcihkZXZpY2VTZXJpYWxOdW1iZXIpIHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgaWYgKHR5cGVvZiBkZXZpY2VTZXJpYWxOdW1iZXIgPT09ICdudW1iZXInIHx8IHR5cGVvZiBkZXZpY2VTZXJpYWxOdW1iZXIgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgIHRoaXMuX2RldmljZVNlcmlhbE51bWJlciA9IGRldmljZVNlcmlhbE51bWJlcjtcbiAgICAgICAgcmVzb2x2ZSh0aGlzLl9kZXZpY2VTZXJpYWxOdW1iZXIpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uc3QgZXJyb3IgPSBuZXcgVHlwZUVycm9yKCdgZGV2aWNlU2VyaWFsTnVtYmVyYCBtdXN0IGJlIGEgbnVtYmVyIG9yIHN0cmluZy4nKTtcbiAgICAgICAgdGhpcy5fbG9nKGVycm9yKTtcbiAgICAgICAgcmVqZWN0KGVycm9yKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIHNldFJlZGlyZWN0VXJpKHJlZGlyZWN0VXJpKSB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgIGlmICh0eXBlb2YgcmVkaXJlY3RVcmkgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgIHRoaXMuX3JlZGlyZWN0VXJpID0gcmVkaXJlY3RVcmk7XG4gICAgICAgIHJlc29sdmUodGhpcy5fcmVkaXJlY3RVcmkpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uc3QgZXJyb3IgPSBuZXcgVHlwZUVycm9yKCdgcmVkaXJlY3RVcmlgIG11c3QgYmUgYSBzdHJpbmcuJyk7XG4gICAgICAgIHRoaXMuX2xvZyhlcnJvcik7XG4gICAgICAgIHJlamVjdChlcnJvcik7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICBzZXREZWJ1ZyhkZWJ1Zykge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICBpZiAodHlwZW9mIGRlYnVnID09PSAnYm9vbGVhbicpIHtcbiAgICAgICAgdGhpcy5fZGVidWcgPSBkZWJ1ZztcbiAgICAgICAgcmVzb2x2ZSh0aGlzLl9kZWJ1Zyk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb25zdCBlcnJvciA9IG5ldyBUeXBlRXJyb3IoJ2BkZWJ1Z2AgbXVzdCBiZSBhIGJvb2xlYW4uJyk7XG4gICAgICAgIHRoaXMuX2xvZyhlcnJvcik7XG4gICAgICAgIHJlamVjdChlcnJvcik7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICBnZXRUb2tlbigpIHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgY29uc3QgdG9rZW4gPSB0aGlzLl90b2tlbjtcblxuICAgICAgaWYgKHRva2VuKSB7XG4gICAgICAgIHJldHVybiByZXNvbHZlKHRva2VuKTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHJlamVjdCgpO1xuICAgIH0pO1xuICB9XG5cbiAgZ2V0UmVmcmVzaFRva2VuKCkge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICBjb25zdCByZWZyZXNoVG9rZW4gPSB0aGlzLl9yZWZyZXNoVG9rZW47XG5cbiAgICAgIGlmIChyZWZyZXNoVG9rZW4pIHtcbiAgICAgICAgcmV0dXJuIHJlc29sdmUocmVmcmVzaFRva2VuKTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHJlamVjdCgpO1xuICAgIH0pO1xuICB9XG5cbiAgcmVxdWVzdE1pYygpIHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgdGhpcy5fbG9nKCdSZXF1ZXN0aW5nIG1pY3JvcGhvbmUuJyk7XG5cbiAgICAgIC8vIEVuc3VyZSB0aGF0IHRoZSBmaWxlIGNhbiBiZSBsb2FkZWQgaW4gZW52aXJvbm1lbnRzIHdoZXJlIG5hdmlnYXRvciBpcyBub3QgZGVmaW5lZCAobm9kZSBzZXJ2ZXJzKVxuICAgICAgaWYgKCFuYXZpZ2F0b3IuZ2V0VXNlck1lZGlhKSB7XG4gICAgICAgIG5hdmlnYXRvci5nZXRVc2VyTWVkaWEgPSBuYXZpZ2F0b3IuZ2V0VXNlck1lZGlhIHx8IG5hdmlnYXRvci53ZWJraXRHZXRVc2VyTWVkaWEgfHxcbiAgICAgICAgICBuYXZpZ2F0b3IubW96R2V0VXNlck1lZGlhIHx8IG5hdmlnYXRvci5tc0dldFVzZXJNZWRpYTtcbiAgICAgIH1cblxuICAgICAgbmF2aWdhdG9yLmdldFVzZXJNZWRpYSh7XG4gICAgICAgIGF1ZGlvOiB0cnVlXG4gICAgICB9LCAoc3RyZWFtKSA9PiB7XG4gICAgICAgIHRoaXMuX2xvZygnTWljcm9waG9uZSBjb25uZWN0ZWQuJyk7XG4gICAgICAgIHJldHVybiB0aGlzLmNvbm5lY3RNZWRpYVN0cmVhbShzdHJlYW0pLnRoZW4ocmVzb2x2ZSk7XG4gICAgICB9LCAoZXJyb3IpID0+IHtcbiAgICAgICAgdGhpcy5fbG9nKCdlcnJvcicsIGVycm9yKTtcbiAgICAgICAgdGhpcy5lbWl0KEFWUy5FdmVudFR5cGVzLkVSUk9SLCBlcnJvcik7XG4gICAgICAgIHJldHVybiByZWplY3QoZXJyb3IpO1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH1cblxuICBjb25uZWN0TWVkaWFTdHJlYW0oc3RyZWFtKSB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgIGNvbnN0IGlzTWVkaWFTdHJlYW0gPSBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwoc3RyZWFtKSA9PT0gJ1tvYmplY3QgTWVkaWFTdHJlYW1dJztcblxuICAgICAgaWYgKCFpc01lZGlhU3RyZWFtKSB7XG4gICAgICAgIGNvbnN0IGVycm9yID0gbmV3IFR5cGVFcnJvcignQXJndW1lbnQgbXVzdCBiZSBhIGBNZWRpYVN0cmVhbWAgb2JqZWN0LicpXG4gICAgICAgIHRoaXMuX2xvZygnZXJyb3InLCBlcnJvcilcbiAgICAgICAgdGhpcy5lbWl0KEFWUy5FdmVudFR5cGVzLkVSUk9SLCBlcnJvcik7XG4gICAgICAgIHJldHVybiByZWplY3QoZXJyb3IpO1xuICAgICAgfVxuXG4gICAgICB0aGlzLl9hdWRpb0NvbnRleHQgPSBuZXcgQXVkaW9Db250ZXh0KCk7XG4gICAgICB0aGlzLl9zYW1wbGVSYXRlID0gdGhpcy5fYXVkaW9Db250ZXh0LnNhbXBsZVJhdGU7XG5cbiAgICAgIHRoaXMuX2xvZyhgU2FtcGxlIHJhdGU6ICR7dGhpcy5fc2FtcGxlUmF0ZX0uYCk7XG5cbiAgICAgIHRoaXMuX3ZvbHVtZU5vZGUgPSB0aGlzLl9hdWRpb0NvbnRleHQuY3JlYXRlR2FpbigpO1xuICAgICAgdGhpcy5fYXVkaW9JbnB1dCA9IHRoaXMuX2F1ZGlvQ29udGV4dC5jcmVhdGVNZWRpYVN0cmVhbVNvdXJjZShzdHJlYW0pO1xuXG4gICAgICB0aGlzLl9hdWRpb0lucHV0LmNvbm5lY3QodGhpcy5fdm9sdW1lTm9kZSk7XG5cbiAgICAgIHRoaXMuX3JlY29yZGVyID0gdGhpcy5fYXVkaW9Db250ZXh0LmNyZWF0ZVNjcmlwdFByb2Nlc3Nvcih0aGlzLl9idWZmZXJTaXplLCB0aGlzLl9pbnB1dENoYW5uZWxzLCB0aGlzLl9vdXRwdXRDaGFubmVscyk7XG5cbiAgICAgIHRoaXMuX3JlY29yZGVyLm9uYXVkaW9wcm9jZXNzID0gKGV2ZW50KSA9PiB7XG4gICAgICAgIGlmICghdGhpcy5faXNSZWNvcmRpbmcpIHtcbiAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBsZWZ0ID0gZXZlbnQuaW5wdXRCdWZmZXIuZ2V0Q2hhbm5lbERhdGEoMCk7XG4gICAgICAgIHRoaXMuX2xlZnRDaGFubmVsLnB1c2gobmV3IEZsb2F0MzJBcnJheShsZWZ0KSk7XG5cbiAgICAgICAgaWYgKHRoaXMuX2lucHV0Q2hhbm5lbHMgPiAxKSB7XG4gICAgICAgICAgY29uc3QgcmlnaHQgPSBldmVudC5pbnB1dEJ1ZmZlci5nZXRDaGFubmVsRGF0YSgxKTtcbiAgICAgICAgICB0aGlzLl9yaWdodENoYW5uZWwucHVzaChuZXcgRmxvYXQzMkFycmF5KHJpZ2h0KSk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9yZWNvcmRpbmdMZW5ndGggKz0gdGhpcy5fYnVmZmVyU2l6ZTtcbiAgICAgIH07XG5cbiAgICAgIHRoaXMuX3ZvbHVtZU5vZGUuY29ubmVjdCh0aGlzLl9yZWNvcmRlcik7XG4gICAgICB0aGlzLl9yZWNvcmRlci5jb25uZWN0KHRoaXMuX2F1ZGlvQ29udGV4dC5kZXN0aW5hdGlvbik7XG4gICAgICB0aGlzLl9sb2coYE1lZGlhIHN0cmVhbSBjb25uZWN0ZWQuYCk7XG5cbiAgICAgIHJldHVybiByZXNvbHZlKHN0cmVhbSk7XG4gICAgfSk7XG4gIH1cblxuICBzdGFydFJlY29yZGluZygpIHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgaWYgKCF0aGlzLl9hdWRpb0lucHV0KSB7XG4gICAgICAgIGNvbnN0IGVycm9yID0gbmV3IEVycm9yKCdObyBNZWRpYSBTdHJlYW0gY29ubmVjdGVkLicpO1xuICAgICAgICB0aGlzLl9sb2coJ2Vycm9yJywgZXJyb3IpO1xuICAgICAgICB0aGlzLmVtaXQoQVZTLkV2ZW50VHlwZXMuRVJST1IsIGVycm9yKTtcbiAgICAgICAgcmV0dXJuIHJlamVjdChlcnJvcik7XG4gICAgICB9XG5cbiAgICAgIHRoaXMuX2lzUmVjb3JkaW5nID0gdHJ1ZTtcbiAgICAgIHRoaXMuX2xlZnRDaGFubmVsLmxlbmd0aCA9IHRoaXMuX3JpZ2h0Q2hhbm5lbC5sZW5ndGggPSAwO1xuICAgICAgdGhpcy5fcmVjb3JkaW5nTGVuZ3RoID0gMDtcbiAgICAgIHRoaXMuX2xvZyhgUmVjb3JkaW5nIHN0YXJ0ZWQuYCk7XG4gICAgICB0aGlzLmVtaXQoQVZTLkV2ZW50VHlwZXMuUkVDT1JEX1NUQVJUKTtcblxuICAgICAgcmV0dXJuIHJlc29sdmUoKTtcbiAgICB9KTtcbiAgfVxuXG4gIHN0b3BSZWNvcmRpbmcoKSB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgIGlmICghdGhpcy5faXNSZWNvcmRpbmcpIHtcbiAgICAgICAgdGhpcy5lbWl0KEFWUy5FdmVudFR5cGVzLlJFQ09SRF9TVE9QKTtcbiAgICAgICAgdGhpcy5fbG9nKCdSZWNvcmRpbmcgc3RvcHBlZC4nKTtcbiAgICAgICAgcmV0dXJuIHJlc29sdmUoKTtcbiAgICAgIH1cblxuICAgICAgdGhpcy5faXNSZWNvcmRpbmcgPSBmYWxzZTtcblxuICAgICAgY29uc3QgbGVmdEJ1ZmZlciA9IG1lcmdlQnVmZmVycyh0aGlzLl9sZWZ0Q2hhbm5lbCwgdGhpcy5fcmVjb3JkaW5nTGVuZ3RoKTtcbiAgICAgIGxldCBpbnRlcmxlYXZlZCA9IG51bGw7XG5cbiAgICAgIGlmICh0aGlzLl9vdXRwdXRDaGFubmVscyA+IDEpIHtcbiAgICAgICAgY29uc3QgcmlnaHRCdWZmZXIgPSBtZXJnZUJ1ZmZlcnModGhpcy5fcmlnaHRDaGFubmVsLCB0aGlzLl9yZWNvcmRpbmdMZW5ndGgpO1xuICAgICAgICBpbnRlcmxlYXZlZCA9IGludGVybGVhdmUobGVmdEJ1ZmZlciwgcmlnaHRCdWZmZXIpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgaW50ZXJsZWF2ZWQgPSBpbnRlcmxlYXZlKGxlZnRCdWZmZXIpO1xuICAgICAgfVxuXG4gICAgICBpbnRlcmxlYXZlZCA9IGRvd25zYW1wbGVCdWZmZXIoaW50ZXJsZWF2ZWQsIHRoaXMuX3NhbXBsZVJhdGUsIHRoaXMuX291dHB1dFNhbXBsZVJhdGUpO1xuXG4gICAgICBjb25zdCBidWZmZXIgPSBuZXcgQXJyYXlCdWZmZXIoNDQgKyBpbnRlcmxlYXZlZC5sZW5ndGggKiAyKTtcbiAgICAgIGNvbnN0IHZpZXcgPSBuZXcgRGF0YVZpZXcoYnVmZmVyKTtcblxuICAgICAgLyoqXG4gICAgICAgKiBAY3JlZGl0IGh0dHBzOi8vZ2l0aHViLmNvbS9tYXR0ZGlhbW9uZC9SZWNvcmRlcmpzXG4gICAgICAgKi9cbiAgICAgIHdyaXRlVVRGQnl0ZXModmlldywgMCwgJ1JJRkYnKTtcbiAgICAgIHZpZXcuc2V0VWludDMyKDQsIDQ0ICsgaW50ZXJsZWF2ZWQubGVuZ3RoICogMiwgdHJ1ZSk7XG4gICAgICB3cml0ZVVURkJ5dGVzKHZpZXcsIDgsICdXQVZFJyk7XG4gICAgICB3cml0ZVVURkJ5dGVzKHZpZXcsIDEyLCAnZm10ICcpO1xuICAgICAgdmlldy5zZXRVaW50MzIoMTYsIDE2LCB0cnVlKTtcbiAgICAgIHZpZXcuc2V0VWludDE2KDIwLCAxLCB0cnVlKTtcbiAgICAgIHZpZXcuc2V0VWludDE2KDIyLCB0aGlzLl9vdXRwdXRDaGFubmVscywgdHJ1ZSk7XG4gICAgICB2aWV3LnNldFVpbnQzMigyNCwgdGhpcy5fb3V0cHV0U2FtcGxlUmF0ZSwgdHJ1ZSk7XG4gICAgICB2aWV3LnNldFVpbnQzMigyOCwgdGhpcy5fb3V0cHV0U2FtcGxlUmF0ZSAqIDQsIHRydWUpO1xuICAgICAgdmlldy5zZXRVaW50MTYoMzIsIDQsIHRydWUpO1xuICAgICAgdmlldy5zZXRVaW50MTYoMzQsIDE2LCB0cnVlKTtcbiAgICAgIHdyaXRlVVRGQnl0ZXModmlldywgMzYsICdkYXRhJyk7XG4gICAgICB2aWV3LnNldFVpbnQzMig0MCwgaW50ZXJsZWF2ZWQubGVuZ3RoICogMiwgdHJ1ZSk7XG5cbiAgICAgIGNvbnN0IGxlbmd0aCA9IGludGVybGVhdmVkLmxlbmd0aDtcbiAgICAgIGNvbnN0IHZvbHVtZSA9IDE7XG4gICAgICBsZXQgaW5kZXggPSA0NDtcblxuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsZW5ndGg7IGkrKyl7XG4gICAgICAgIHZpZXcuc2V0SW50MTYoaW5kZXgsIGludGVybGVhdmVkW2ldICogKDB4N0ZGRiAqIHZvbHVtZSksIHRydWUpO1xuICAgICAgICBpbmRleCArPSAyO1xuICAgICAgfVxuXG4gICAgICB0aGlzLl9sb2coYFJlY29yZGluZyBzdG9wcGVkLmApO1xuICAgICAgdGhpcy5lbWl0KEFWUy5FdmVudFR5cGVzLlJFQ09SRF9TVE9QKTtcbiAgICAgIHJldHVybiByZXNvbHZlKHZpZXcpO1xuICAgIH0pO1xuICB9XG5cbiAgc2VuZEF1ZGlvIChkYXRhVmlldykge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICBjb25zdCB4aHIgPSBuZXcgWE1MSHR0cFJlcXVlc3QoKTtcbiAgICAgIGNvbnN0IHVybCA9ICdodHRwczovL2FjY2Vzcy1hbGV4YS1uYS5hbWF6b24uY29tL3YxL2F2cy9zcGVlY2hyZWNvZ25pemVyL3JlY29nbml6ZSc7XG5cbiAgICAgIHhoci5vcGVuKCdQT1NUJywgdXJsLCB0cnVlKTtcbiAgICAgIHhoci5yZXNwb25zZVR5cGUgPSAnYXJyYXlidWZmZXInO1xuICAgICAgeGhyLm9ubG9hZCA9IChldmVudCkgPT4ge1xuICAgICAgICBjb25zb2xlLmxvZygnUkVTUE9OU0UnLCB4aHIucmVzcG9uc2UpO1xuXG4gICAgICAgIGNvbnN0IGJ1ZmZlciA9IG5ldyBCdWZmZXIoeGhyLnJlc3BvbnNlKTtcblxuICAgICAgICBpZiAoeGhyLnN0YXR1cyA9PT0gMjAwKSB7XG4gICAgICAgICAgY29uc3QgcGFyc2VkTWVzc2FnZSA9IGh0dHBNZXNzYWdlUGFyc2VyKGJ1ZmZlcik7XG4gICAgICAgICAgcmVzb2x2ZShwYXJzZWRNZXNzYWdlKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBsZXQgZXJyb3IgPSBuZXcgRXJyb3IoJ0FuIGVycm9yIG9jY3VyZWQgd2l0aCByZXF1ZXN0LicpO1xuICAgICAgICAgIGxldCByZXNwb25zZSA9IHt9O1xuXG4gICAgICAgICAgaWYgKCF4aHIucmVzcG9uc2UuYnl0ZUxlbmd0aCkge1xuICAgICAgICAgICAgZXJyb3IgPSBuZXcgRXJyb3IoJ0VtcHR5IHJlc3BvbnNlLicpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICByZXNwb25zZSA9IEpTT04ucGFyc2UoYXJyYXlCdWZmZXJUb1N0cmluZyhidWZmZXIpKTtcbiAgICAgICAgICAgIH0gY2F0Y2goZXJyKSB7XG4gICAgICAgICAgICAgIGVycm9yID0gZXJyO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cblxuICAgICAgICAgIGlmIChyZXNwb25zZS5lcnJvciBpbnN0YW5jZW9mIE9iamVjdCkge1xuICAgICAgICAgICAgaWYgKHJlc3BvbnNlLmVycm9yLmNvZGUgPT09IEFNQVpPTl9FUlJPUl9DT0RFUy5JbnZhbGlkQWNjZXNzVG9rZW5FeGNlcHRpb24pIHtcbiAgICAgICAgICAgICAgdGhpcy5lbWl0KEFWUy5FdmVudFR5cGVzLlRPS0VOX0lOVkFMSUQpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBlcnJvciA9IHJlc3BvbnNlLmVycm9yLm1lc3NhZ2U7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgdGhpcy5lbWl0KEFWUy5FdmVudFR5cGVzLkVSUk9SLCBlcnJvcik7XG4gICAgICAgICAgcmV0dXJuIHJlamVjdChlcnJvcik7XG4gICAgICAgIH1cbiAgICAgIH07XG5cbiAgICAgIHhoci5vbmVycm9yID0gKGVycm9yKSA9PiB7XG4gICAgICAgIHRoaXMuX2xvZyhlcnJvcik7XG4gICAgICAgIHJlamVjdChlcnJvcik7XG4gICAgICB9O1xuXG4gICAgICBjb25zdCBCT1VOREFSWSA9ICdCT1VOREFSWTEyMzQnO1xuICAgICAgY29uc3QgQk9VTkRBUllfREFTSEVTID0gJy0tJztcbiAgICAgIGNvbnN0IE5FV0xJTkUgPSAnXFxyXFxuJztcbiAgICAgIGNvbnN0IE1FVEFEQVRBX0NPTlRFTlRfRElTUE9TSVRJT04gPSAnQ29udGVudC1EaXNwb3NpdGlvbjogZm9ybS1kYXRhOyBuYW1lPVwibWV0YWRhdGFcIic7XG4gICAgICBjb25zdCBNRVRBREFUQV9DT05URU5UX1RZUEUgPSAnQ29udGVudC1UeXBlOiBhcHBsaWNhdGlvbi9qc29uOyBjaGFyc2V0PVVURi04JztcbiAgICAgIGNvbnN0IEFVRElPX0NPTlRFTlRfVFlQRSA9ICdDb250ZW50LVR5cGU6IGF1ZGlvL0wxNjsgcmF0ZT0xNjAwMDsgY2hhbm5lbHM9MSc7XG4gICAgICBjb25zdCBBVURJT19DT05URU5UX0RJU1BPU0lUSU9OID0gJ0NvbnRlbnQtRGlzcG9zaXRpb246IGZvcm0tZGF0YTsgbmFtZT1cImF1ZGlvXCInO1xuXG4gICAgICBjb25zdCBtZXRhZGF0YSA9IHtcbiAgICAgICAgbWVzc2FnZUhlYWRlcjoge30sXG4gICAgICAgIG1lc3NhZ2VCb2R5OiB7XG4gICAgICAgICAgcHJvZmlsZTogJ2FsZXhhLWNsb3NlLXRhbGsnLFxuICAgICAgICAgIGxvY2FsZTogJ2VuLXVzJyxcbiAgICAgICAgICBmb3JtYXQ6ICdhdWRpby9MMTY7IHJhdGU9MTYwMDA7IGNoYW5uZWxzPTEnXG4gICAgICAgIH1cbiAgICAgIH07XG5cbiAgICAgIGNvbnN0IHBvc3REYXRhU3RhcnQgPSBbXG4gICAgICAgIE5FV0xJTkUsIEJPVU5EQVJZX0RBU0hFUywgQk9VTkRBUlksIE5FV0xJTkUsIE1FVEFEQVRBX0NPTlRFTlRfRElTUE9TSVRJT04sIE5FV0xJTkUsIE1FVEFEQVRBX0NPTlRFTlRfVFlQRSxcbiAgICAgICAgTkVXTElORSwgTkVXTElORSwgSlNPTi5zdHJpbmdpZnkobWV0YWRhdGEpLCBORVdMSU5FLCBCT1VOREFSWV9EQVNIRVMsIEJPVU5EQVJZLCBORVdMSU5FLFxuICAgICAgICBBVURJT19DT05URU5UX0RJU1BPU0lUSU9OLCBORVdMSU5FLCBBVURJT19DT05URU5UX1RZUEUsIE5FV0xJTkUsIE5FV0xJTkVcbiAgICAgIF0uam9pbignJyk7XG5cbiAgICAgIGNvbnN0IHBvc3REYXRhRW5kID0gW05FV0xJTkUsIEJPVU5EQVJZX0RBU0hFUywgQk9VTkRBUlksIEJPVU5EQVJZX0RBU0hFUywgTkVXTElORV0uam9pbignJyk7XG5cbiAgICAgIGNvbnN0IHNpemUgPSBwb3N0RGF0YVN0YXJ0Lmxlbmd0aCArIGRhdGFWaWV3LmJ5dGVMZW5ndGggKyBwb3N0RGF0YUVuZC5sZW5ndGg7XG4gICAgICBjb25zdCB1aW50OEFycmF5ID0gbmV3IFVpbnQ4QXJyYXkoc2l6ZSk7XG4gICAgICBsZXQgaSA9IDA7XG5cbiAgICAgIGZvciAoOyBpIDwgcG9zdERhdGFTdGFydC5sZW5ndGg7IGkrKykge1xuICAgICAgICB1aW50OEFycmF5W2ldID0gcG9zdERhdGFTdGFydC5jaGFyQ29kZUF0KGkpICYgMHhGRjtcbiAgICAgIH1cblxuICAgICAgZm9yIChsZXQgaiA9IDA7IGogPCBkYXRhVmlldy5ieXRlTGVuZ3RoIDsgaSsrLCBqKyspIHtcbiAgICAgICAgdWludDhBcnJheVtpXSA9IGRhdGFWaWV3LmdldFVpbnQ4KGopO1xuICAgICAgfVxuXG4gICAgICBmb3IgKGxldCBqID0gMDsgaiA8IHBvc3REYXRhRW5kLmxlbmd0aDsgaSsrLCBqKyspIHtcbiAgICAgICAgdWludDhBcnJheVtpXSA9IHBvc3REYXRhRW5kLmNoYXJDb2RlQXQoaikgJiAweEZGO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBwYXlsb2FkID0gdWludDhBcnJheS5idWZmZXI7XG5cbiAgICAgIHhoci5zZXRSZXF1ZXN0SGVhZGVyKCdBdXRob3JpemF0aW9uJywgYEJlYXJlciAke3RoaXMuX3Rva2VufWApO1xuICAgICAgeGhyLnNldFJlcXVlc3RIZWFkZXIoJ0NvbnRlbnQtVHlwZScsICdtdWx0aXBhcnQvZm9ybS1kYXRhOyBib3VuZGFyeT0nICsgQk9VTkRBUlkpO1xuICAgICAgeGhyLnNlbmQocGF5bG9hZCk7XG4gICAgfSk7XG4gIH1cblxuICBzdGF0aWMgZ2V0IEV2ZW50VHlwZXMoKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIExPRzogJ2xvZycsXG4gICAgICBFUlJPUjogJ2Vycm9yJyxcbiAgICAgIExPR0lOOiAnbG9naW4nLFxuICAgICAgTE9HT1VUOiAnbG9nb3V0JyxcbiAgICAgIFJFQ09SRF9TVEFSVDogJ3JlY29yZFN0YXJ0JyxcbiAgICAgIFJFQ09SRF9TVE9QOiAncmVjb3JkU3RvcCcsXG4gICAgICBUT0tFTl9TRVQ6ICd0b2tlblNldCcsXG4gICAgICBSRUZSRVNIX1RPS0VOX1NFVDogJ3JlZnJlc2hUb2tlblNldCcsXG4gICAgICBUT0tFTl9JTlZBTElEOiAndG9rZW5JbnZhbGlkJ1xuICAgIH07XG4gIH1cblxuICBzdGF0aWMgZ2V0IFBsYXllcigpIHtcbiAgICByZXR1cm4gUGxheWVyO1xuICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gQVZTO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgSW52YWxpZEFjY2Vzc1Rva2VuRXhjZXB0aW9uOiAnY29tLmFtYXpvbi5hbGV4YWh0dHBwcm94eS5leGNlcHRpb25zLkludmFsaWRBY2Nlc3NUb2tlbkV4Y2VwdGlvbidcbn07XG4iLCIndXNlIHN0cmljdCc7XG5cbmZ1bmN0aW9uIE9ic2VydmFibGUoZWwpIHtcbiAgbGV0IGNhbGxiYWNrcyA9IHt9O1xuXG4gIGVsLm9uID0gZnVuY3Rpb24obmFtZSwgZm4pIHtcbiAgICBpZiAodHlwZW9mIGZuICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdTZWNvbmQgYXJndW1lbnQgZm9yIFwib25cIiBtZXRob2QgbXVzdCBiZSBhIGZ1bmN0aW9uLicpO1xuICAgIH1cblxuICAgIChjYWxsYmFja3NbbmFtZV0gPSBjYWxsYmFja3NbbmFtZV0gfHwgW10pLnB1c2goZm4pO1xuXG4gICAgcmV0dXJuIGVsO1xuICB9O1xuXG4gIGVsLm9uZSA9IGZ1bmN0aW9uKG5hbWUsIGZuKSB7XG4gICAgZm4ub25lID0gdHJ1ZTtcbiAgICByZXR1cm4gZWwub24uY2FsbChlbCwgbmFtZSwgZm4pO1xuICB9O1xuXG4gIGVsLm9mZiA9IGZ1bmN0aW9uKG5hbWUsIGZuKSB7XG4gICAgaWYgKG5hbWUgPT09ICcqJykge1xuICAgICAgY2FsbGJhY2tzID0ge307XG4gICAgICByZXR1cm4gY2FsbGJhY2tzXG4gICAgfVxuXG4gICAgaWYgKCFjYWxsYmFja3NbbmFtZV0pIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICBpZiAoZm4pIHtcbiAgICAgIGlmICh0eXBlb2YgZm4gIT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignU2Vjb25kIGFyZ3VtZW50IGZvciBcIm9mZlwiIG1ldGhvZCBtdXN0IGJlIGEgZnVuY3Rpb24uJyk7XG4gICAgICB9XG5cbiAgICAgIGNhbGxiYWNrc1tuYW1lXSA9IGNhbGxiYWNrc1tuYW1lXS5tYXAoZnVuY3Rpb24oZm0sIGkpIHtcbiAgICAgICAgaWYgKGZtID09PSBmbikge1xuICAgICAgICAgIGNhbGxiYWNrc1tuYW1lXS5zcGxpY2UoaSwgMSk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICBkZWxldGUgY2FsbGJhY2tzW25hbWVdO1xuICAgIH1cbiAgfTtcblxuICBlbC5lbWl0ID0gZnVuY3Rpb24obmFtZSAvKiwgYXJncyAqLykge1xuICAgIGlmICghY2FsbGJhY2tzW25hbWVdIHx8ICFjYWxsYmFja3NbbmFtZV0ubGVuZ3RoKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgYXJncyA9IFtdLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcblxuICAgIGNhbGxiYWNrc1tuYW1lXS5mb3JFYWNoKGZ1bmN0aW9uKGZuLCBpKSB7XG4gICAgICBpZiAoZm4pIHtcbiAgICAgICAgZm4uYXBwbHkoZm4sIGFyZ3MpO1xuICAgICAgICBpZiAoZm4ub25lKSB7XG4gICAgICAgICAgY2FsbGJhY2tzW25hbWVdLnNwbGljZShpLCAxKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0pO1xuXG4gICAgcmV0dXJuIGVsO1xuICB9O1xuXG4gIHJldHVybiBlbDtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBPYnNlcnZhYmxlO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG5jb25zdCBPYnNlcnZhYmxlID0gcmVxdWlyZSgnLi9PYnNlcnZhYmxlJyk7XG5jb25zdCBhcnJheUJ1ZmZlclRvQXVkaW9CdWZmZXIgPSByZXF1aXJlKCcuL3V0aWxzL2FycmF5QnVmZmVyVG9BdWRpb0J1ZmZlcicpO1xuY29uc3QgdG9TdHJpbmcgPSBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nO1xuXG5jbGFzcyBQbGF5ZXIge1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICB3aW5kb3cuQXVkaW9Db250ZXh0ID0gd2luZG93LkF1ZGlvQ29udGV4dCB8fCB3aW5kb3cud2Via2l0QXVkaW9Db250ZXh0O1xuXG4gICAgdGhpcy5fcXVldWUgPSBbXTtcbiAgICB0aGlzLl9jdXJyZW50U291cmNlID0gbnVsbDtcbiAgICB0aGlzLl9jdXJyZW50QnVmZmVyID0gbnVsbDtcbiAgICB0aGlzLl9jb250ZXh0ID0gbmV3IEF1ZGlvQ29udGV4dCgpO1xuXG4gICAgT2JzZXJ2YWJsZSh0aGlzKTtcbiAgfVxuXG4gIF9sb2codHlwZSwgbWVzc2FnZSkge1xuICAgIGlmICh0eXBlICYmICFtZXNzYWdlKSB7XG4gICAgICBtZXNzYWdlID0gdHlwZTtcbiAgICAgIHR5cGUgPSAnbG9nJztcbiAgICB9XG5cbiAgICBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgIHRoaXMuZW1pdChQbGF5ZXIuRXZlbnRUeXBlcy5MT0csIG1lc3NhZ2UpO1xuICAgIH0sIDApO1xuXG4gICAgaWYgKHRoaXMuX2RlYnVnKSB7XG4gICAgICBjb25zb2xlW3R5cGVdKG1lc3NhZ2UpO1xuICAgIH1cbiAgfVxuXG4gIGVtcHR5UXVldWUoKSB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgIHRoaXMuX3F1ZXVlID0gW107XG4gICAgICByZXNvbHZlKCk7XG4gICAgfSk7XG4gIH1cblxuICBlbnF1ZXVlKGl0ZW0pIHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgaWYgKCFpdGVtKSB7XG4gICAgICAgIGNvbnN0IGVycm9yID0gbmV3IEVycm9yKCdhcmd1bWVudCBjYW5ub3QgYmUgZW1wdHkuJyk7XG4gICAgICAgIHRoaXMuX2xvZyhlcnJvcik7XG4gICAgICAgIHJldHVybiByZWplY3QoZXJyb3IpO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBzdHJpbmdUeXBlID0gdG9TdHJpbmcuY2FsbChpdGVtKTtcblxuICAgICAgY29uc3QgcHJvY2VlZCA9IChhdWRpb0J1ZmZlcikgPT4ge1xuICAgICAgICB0aGlzLl9xdWV1ZS5wdXNoKGF1ZGlvQnVmZmVyKTtcbiAgICAgICAgdGhpcy5fbG9nKCdFbnF1ZXVlIGF1ZGlvJyk7XG4gICAgICAgIHRoaXMuZW1pdChQbGF5ZXIuRXZlbnRUeXBlcy5FTlFVRVVFKTtcbiAgICAgICAgcmV0dXJuIHJlc29sdmUoYXVkaW9CdWZmZXIpO1xuICAgICAgfTtcblxuICAgICAgaWYgKHN0cmluZ1R5cGUgPT09ICdbb2JqZWN0IERhdGFWaWV3XScgfHwgc3RyaW5nVHlwZSA9PT0gJ1tvYmplY3QgVWludDhBcnJheV0nKSB7XG4gICAgICAgIGFycmF5QnVmZmVyVG9BdWRpb0J1ZmZlcihpdGVtLmJ1ZmZlciwgdGhpcy5fY29udGV4dClcbiAgICAgICAgLnRoZW4ocHJvY2VlZCk7XG4gICAgICB9IGVsc2UgaWYgKHN0cmluZ1R5cGUgPT09ICdbb2JqZWN0IEF1ZGlvQnVmZmVyXScpIHtcbiAgICAgICAgcHJvY2VlZChpdGVtKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnN0IGVycm9yID0gbmV3IEVycm9yKCdJbnZhbGlkIHR5cGUuJyk7XG4gICAgICAgIHRoaXMuZW1pdCgnZXJyb3InLCBlcnJvcik7XG4gICAgICAgIHJldHVybiByZWplY3QoZXJyb3IpO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgZGVxdWUoKSB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgIGNvbnN0IGl0ZW0gPSB0aGlzLl9xdWV1ZS5zaGlmdCgpO1xuXG4gICAgICBpZiAoaXRlbSkge1xuICAgICAgICB0aGlzLl9sb2coJ0RlcXVlIGF1ZGlvJyk7XG4gICAgICAgIHRoaXMuZW1pdChQbGF5ZXIuRXZlbnRUeXBlcy5ERVFVRSk7XG4gICAgICAgIHJldHVybiByZXNvbHZlKGl0ZW0pO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gcmVqZWN0KCk7XG4gICAgfSk7XG4gIH1cblxuICBwbGF5KCkge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICBpZiAodGhpcy5fY29udGV4dC5zdGF0ZSA9PT0gJ3N1c3BlbmRlZCcpIHtcbiAgICAgICAgdGhpcy5fY29udGV4dC5yZXN1bWUoKTtcblxuICAgICAgICB0aGlzLl9sb2coJ1BsYXkgYXVkaW8nKTtcbiAgICAgICAgdGhpcy5lbWl0KFBsYXllci5FdmVudFR5cGVzLlBMQVkpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZGVxdWUoKVxuICAgICAgICAudGhlbihhdWRpb0J1ZmZlciA9PiB7XG4gICAgICAgICAgdGhpcy5wbGF5QXVkaW9CdWZmZXIoYXVkaW9CdWZmZXIpXG5cbiAgICAgICAgICB0aGlzLl9sb2coJ1BsYXkgYXVkaW8nKTtcbiAgICAgICAgICB0aGlzLmVtaXQoUGxheWVyLkV2ZW50VHlwZXMuUExBWSk7XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgc3RvcCgpIHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICBpZiAodGhpcy5fY3VycmVudFNvdXJjZSkge1xuICAgICAgICAgIHRoaXMuX2N1cnJlbnRTb3VyY2Uub25lbmRlZCA9IGZ1bmN0aW9uKCkge307XG4gICAgICAgICAgdGhpcy5fY3VycmVudFNvdXJjZS5zdG9wKCk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9sb2coJ1N0b3AgYXVkaW8nKTtcbiAgICAgICAgdGhpcy5lbWl0KFBsYXllci5FdmVudFR5cGVzLlNUT1ApO1xuICAgIH0pO1xuICB9XG5cbiAgcGF1c2UoKSB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgaWYgKHRoaXMuX2NvbnRleHQuc3RhdGUgPT09ICdydW5uaW5nJykge1xuICAgICAgICAgIHRoaXMuX2NvbnRleHQuc3VzcGVuZCgpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fbG9nKCdQYXVzZSBhdWRpbycpO1xuICAgICAgICB0aGlzLmVtaXQoUGxheWVyLkV2ZW50VHlwZXMuUEFVU0UpO1xuICAgIH0pO1xuICB9XG5cbiAgcmVwbGF5KCkge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgIGlmICh0aGlzLl9jdXJyZW50QnVmZmVyKSB7XG4gICAgICAgICAgdGhpcy5fbG9nKCdSZXBsYXkgYXVkaW8nKTtcbiAgICAgICAgICB0aGlzLmVtaXQoUGxheWVyLkV2ZW50VHlwZXMuUkVQTEFZKTtcblxuICAgICAgICAgIGlmICh0aGlzLl9jb250ZXh0LnN0YXRlID09PSAnc3VzcGVuZGVkJykge1xuICAgICAgICAgICAgdGhpcy5fY29udGV4dC5yZXN1bWUoKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICB0aGlzLl9jdXJyZW50U291cmNlLnN0b3AoKTtcbiAgICAgICAgICB0aGlzLl9jdXJyZW50U291cmNlLm9uZW5kZWQgPSBmdW5jdGlvbigpIHt9O1xuXG4gICAgICAgICAgcmV0dXJuIHRoaXMucGxheUF1ZGlvQnVmZmVyKHRoaXMuX2N1cnJlbnRCdWZmZXIpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGNvbnN0IGVycm9yID0gbmV3IEVycm9yKCdObyBhdWRpbyBzb3VyY2UgbG9hZGVkLicpO1xuICAgICAgICAgIHRoaXMuZW1pdCgnZXJyb3InLCBlcnJvcilcbiAgICAgICAgICByZWplY3QoKTtcbiAgICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgcGxheUJsb2IoYmxvYikge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICBpZiAoIWJsb2IpIHtcbiAgICAgICAgcmVqZWN0KCk7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IG9iamVjdFVybCA9IFVSTC5jcmVhdGVPYmplY3RVUkwoYmxvYik7XG4gICAgICBjb25zdCBhdWRpbyA9IG5ldyBBdWRpbygpO1xuICAgICAgYXVkaW8uc3JjID0gb2JqZWN0VXJsO1xuXG4gICAgICBhdWRpby5hZGRFdmVudExpc3RlbmVyKCdlbmRlZCcsICgpID0+IHtcbiAgICAgICAgdGhpcy5fbG9nKCdBdWRpbyBlbmRlZCcpO1xuICAgICAgICB0aGlzLmVtaXQoUGxheWVyLkV2ZW50VHlwZXMuRU5ERUQpO1xuICAgICAgfSk7XG5cbiAgICAgIGF1ZGlvLm9ubG9hZCA9IChldmVudCkgPT4ge1xuICAgICAgICBVUkwucmV2b2tlT2JqZWN0VXJsKG9iamVjdFVybCk7XG4gICAgICB9O1xuXG4gICAgICB0aGlzLl9sb2coJ0F1ZGlvIHBsYXkgc3RhcnRlZC4nKTtcbiAgICAgIGF1ZGlvLnBsYXkoKTtcblxuICAgICAgcmVzb2x2ZSgpO1xuICAgIH0pO1xuICB9XG5cbiAgcGxheUF1ZGlvQnVmZmVyKGJ1ZmZlcikge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICBjb25zdCBzb3VyY2UgPSB0aGlzLl9jb250ZXh0LmNyZWF0ZUJ1ZmZlclNvdXJjZSgpO1xuICAgICAgc291cmNlLmJ1ZmZlciA9IGJ1ZmZlcjtcbiAgICAgIHNvdXJjZS5jb25uZWN0KHRoaXMuX2NvbnRleHQuZGVzdGluYXRpb24pO1xuICAgICAgc291cmNlLnN0YXJ0KDApO1xuICAgICAgdGhpcy5fY3VycmVudEJ1ZmZlciA9IGJ1ZmZlcjtcbiAgICAgIHRoaXMuX2N1cnJlbnRTb3VyY2UgPSBzb3VyY2U7XG5cbiAgICAgIHNvdXJjZS5vbmVuZGVkID0gKGV2ZW50KSA9PiB7XG4gICAgICAgIHRoaXMuX2xvZygnQXVkaW8gZW5kZWQnKTtcbiAgICAgICAgdGhpcy5lbWl0KFBsYXllci5FdmVudFR5cGVzLkVOREVEKTtcbiAgICAgIH07XG5cbiAgICAgIHNvdXJjZS5vbmVycm9yID0gKGVycm9yKSA9PiB7XG4gICAgICAgIHRoaXMuZW1pdCgnZXJyb3InLCBlcnJvcik7XG4gICAgICB9O1xuXG4gICAgICByZXNvbHZlKCk7XG4gICAgfSk7XG4gIH1cblxuICBzdGF0aWMgZ2V0IEV2ZW50VHlwZXMoKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIExPRzogJ2xvZycsXG4gICAgICBFUlJPUjogJ2Vycm9yJyxcbiAgICAgIFBMQVk6ICdwbGF5JyxcbiAgICAgIFJFUExBWTogJ3JlcGxheScsXG4gICAgICBQQVVTRTogJ3BhdXNlJyxcbiAgICAgIFNUT1A6ICdwYXVzZScsXG4gICAgICBFTlFVRVVFOiAnZW5xdWV1ZScsXG4gICAgICBERVFVRTogJ2RlcXVlJ1xuICAgIH07XG4gIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSBQbGF5ZXI7XG4iLCIndXNlIHN0cmljdCc7XG5cbmZ1bmN0aW9uIGFycmF5QnVmZmVyVG9BdWRpb0J1ZmZlcihhcnJheUJ1ZmZlciwgY29udGV4dCkge1xuICB3aW5kb3cuQXVkaW9Db250ZXh0ID0gd2luZG93LkF1ZGlvQ29udGV4dCB8fCB3aW5kb3cud2Via2l0QXVkaW9Db250ZXh0O1xuXG4gIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgaWYgKGNvbnRleHQpIHtcbiAgICAgIGlmIChPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwoY29udGV4dCkgIT09ICdbb2JqZWN0IEF1ZGlvQ29udGV4dF0nKSB7XG4gICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ2Bjb250ZXh0YCBtdXN0IGJlIGFuIEF1ZGlvQ29udGV4dCcpO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBjb250ZXh0ID0gbmV3IEF1ZGlvQ29udGV4dCgpO1xuICAgIH1cblxuICAgIGNvbnRleHQuZGVjb2RlQXVkaW9EYXRhKGFycmF5QnVmZmVyLCByZXNvbHZlLCByZWplY3QpO1xuICB9KTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBhcnJheUJ1ZmZlclRvQXVkaW9CdWZmZXI7XG4iLCIndXNlIHN0cmljdCc7XG5cbi8qKlxuICogQGNyZWRpdCBodHRwczovL2RldmVsb3BlcnMuZ29vZ2xlLmNvbS93ZWIvdXBkYXRlcy8yMDEyLzA2L0hvdy10by1jb252ZXJ0LUFycmF5QnVmZmVyLXRvLWFuZC1mcm9tLVN0cmluZz9obD1lblxuICovXG5mdW5jdGlvbiBhcnJheUJ1ZmZlclRvU3RyaW5nKGJ1ZmZlcikge1xuICByZXR1cm4gU3RyaW5nLmZyb21DaGFyQ29kZS5hcHBseShudWxsLCBuZXcgVWludDE2QXJyYXkoYnVmZmVyKSk7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gYXJyYXlCdWZmZXJUb1N0cmluZztcbiIsIid1c2Ugc3RyaWN0JztcblxuLyoqXG4gKiBAY3JlZGl0IGh0dHA6Ly9zdGFja292ZXJmbG93LmNvbS9hLzI2MjQ1MjYwXG4gKi9cbmZ1bmN0aW9uIGRvd25zYW1wbGVCdWZmZXIoYnVmZmVyLCBpbnB1dFNhbXBsZVJhdGUsIG91dHB1dFNhbXBsZVJhdGUpIHtcbiAgaWYgKGlucHV0U2FtcGxlUmF0ZSA9PT0gb3V0cHV0U2FtcGxlUmF0ZSkge1xuICAgIHJldHVybiBidWZmZXI7XG4gIH1cblxuICBpZiAoaW5wdXRTYW1wbGVSYXRlIDwgb3V0cHV0U2FtcGxlUmF0ZSkge1xuICAgIHRocm93IG5ldyBFcnJvcignT3V0cHV0IHNhbXBsZSByYXRlIG11c3QgYmUgbGVzcyB0aGFuIGlucHV0IHNhbXBsZSByYXRlLicpO1xuICB9XG5cbiAgY29uc3Qgc2FtcGxlUmF0ZVJhdGlvID0gaW5wdXRTYW1wbGVSYXRlIC8gb3V0cHV0U2FtcGxlUmF0ZTtcbiAgY29uc3QgbmV3TGVuZ3RoID0gTWF0aC5yb3VuZChidWZmZXIubGVuZ3RoIC8gc2FtcGxlUmF0ZVJhdGlvKTtcbiAgbGV0IHJlc3VsdCA9IG5ldyBGbG9hdDMyQXJyYXkobmV3TGVuZ3RoKTtcbiAgbGV0IG9mZnNldFJlc3VsdCA9IDA7XG4gIGxldCBvZmZzZXRCdWZmZXIgPSAwO1xuXG4gIHdoaWxlIChvZmZzZXRSZXN1bHQgPCByZXN1bHQubGVuZ3RoKSB7XG4gICAgbGV0IG5leHRPZmZzZXRCdWZmZXIgPSBNYXRoLnJvdW5kKChvZmZzZXRSZXN1bHQgKyAxKSAqIHNhbXBsZVJhdGVSYXRpbyk7XG4gICAgbGV0IGFjY3VtID0gMDtcbiAgICBsZXQgY291bnQgPSAwO1xuXG4gICAgZm9yICh2YXIgaSA9IG9mZnNldEJ1ZmZlcjsgaSA8IG5leHRPZmZzZXRCdWZmZXIgJiYgaSA8IGJ1ZmZlci5sZW5ndGg7IGkrKykge1xuICAgICAgYWNjdW0gKz0gYnVmZmVyW2ldO1xuICAgICAgY291bnQrKztcbiAgICB9XG5cbiAgICByZXN1bHRbb2Zmc2V0UmVzdWx0XSA9IGFjY3VtIC8gY291bnQ7XG4gICAgb2Zmc2V0UmVzdWx0Kys7XG4gICAgb2Zmc2V0QnVmZmVyID0gbmV4dE9mZnNldEJ1ZmZlcjtcbiAgfVxuXG4gIHJldHVybiByZXN1bHQ7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gZG93bnNhbXBsZUJ1ZmZlcjtcbiIsIid1c2Ugc3RyaWN0JztcblxuLyoqXG4gKiBAY3JlZGl0IGh0dHBzOi8vZ2l0aHViLmNvbS9tYXR0ZGlhbW9uZC9SZWNvcmRlcmpzXG4gKi9cbmZ1bmN0aW9uIGludGVybGVhdmUobGVmdENoYW5uZWwsIHJpZ2h0Q2hhbm5lbCkge1xuICBpZiAobGVmdENoYW5uZWwgJiYgIXJpZ2h0Q2hhbm5lbCkge1xuICAgIHJldHVybiBsZWZ0Q2hhbm5lbDtcbiAgfVxuXG4gIGNvbnN0IGxlbmd0aCA9IGxlZnRDaGFubmVsLmxlbmd0aCArIHJpZ2h0Q2hhbm5lbC5sZW5ndGg7XG4gIGxldCByZXN1bHQgPSBuZXcgRmxvYXQzMkFycmF5KGxlbmd0aCk7XG4gIGxldCBpbnB1dEluZGV4ID0gMDtcblxuICBmb3IgKGxldCBpbmRleCA9IDA7IGluZGV4IDwgbGVuZ3RoOyApe1xuICAgIHJlc3VsdFtpbmRleCsrXSA9IGxlZnRDaGFubmVsW2lucHV0SW5kZXhdO1xuICAgIHJlc3VsdFtpbmRleCsrXSA9IHJpZ2h0Q2hhbm5lbFtpbnB1dEluZGV4XTtcbiAgICBpbnB1dEluZGV4Kys7XG4gIH1cblxuICByZXR1cm4gcmVzdWx0O1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGludGVybGVhdmU7XG4iLCIndXNlIHN0cmljdCc7XG5cbi8qKlxuICogQGNyZWRpdCBodHRwczovL2dpdGh1Yi5jb20vbWF0dGRpYW1vbmQvUmVjb3JkZXJqc1xuICovXG5mdW5jdGlvbiBtZXJnZUJ1ZmZlcnMoY2hhbm5lbEJ1ZmZlciwgcmVjb3JkaW5nTGVuZ3RoKXtcbiAgY29uc3QgcmVzdWx0ID0gbmV3IEZsb2F0MzJBcnJheShyZWNvcmRpbmdMZW5ndGgpO1xuICBjb25zdCBsZW5ndGggPSBjaGFubmVsQnVmZmVyLmxlbmd0aDtcbiAgbGV0IG9mZnNldCA9IDA7XG5cbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBsZW5ndGg7IGkrKyl7XG4gICAgbGV0IGJ1ZmZlciA9IGNoYW5uZWxCdWZmZXJbaV07XG5cbiAgICByZXN1bHQuc2V0KGJ1ZmZlciwgb2Zmc2V0KTtcbiAgICBvZmZzZXQgKz0gYnVmZmVyLmxlbmd0aDtcbiAgfVxuXG4gIHJldHVybiByZXN1bHQ7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gbWVyZ2VCdWZmZXJzO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG4vKipcbiAqIEBjcmVkaXQgaHR0cHM6Ly9naXRodWIuY29tL21hdHRkaWFtb25kL1JlY29yZGVyanNcbiAqL1xuZnVuY3Rpb24gd3JpdGVVVEZCeXRlcyh2aWV3LCBvZmZzZXQsIHN0cmluZykge1xuICBjb25zdCBsZW5ndGggPSBzdHJpbmcubGVuZ3RoO1xuXG4gIGZvciAobGV0IGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspe1xuICAgIHZpZXcuc2V0VWludDgob2Zmc2V0ICsgaSwgc3RyaW5nLmNoYXJDb2RlQXQoaSkpO1xuICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gd3JpdGVVVEZCeXRlcztcbiIsIihmdW5jdGlvbihyb290KSB7XG4gICd1c2Ugc3RyaWN0JztcblxuICBmdW5jdGlvbiBodHRwTWVzc2FnZVBhcnNlcihtZXNzYWdlKSB7XG4gICAgY29uc3QgcmVzdWx0ID0ge1xuICAgICAgaHR0cFZlcnNpb246IG51bGwsXG4gICAgICBzdGF0dXNDb2RlOiBudWxsLFxuICAgICAgc3RhdHVzTWVzc2FnZTogbnVsbCxcbiAgICAgIG1ldGhvZDogbnVsbCxcbiAgICAgIHVybDogbnVsbCxcbiAgICAgIGhlYWRlcnM6IG51bGwsXG4gICAgICBib2R5OiBudWxsLFxuICAgICAgYm91bmRhcnk6IG51bGwsXG4gICAgICBtdWx0aXBhcnQ6IG51bGxcbiAgICB9O1xuXG4gICAgdmFyIG1lc3NhZ2VTdHJpbmcgPSAnJztcbiAgICB2YXIgaGVhZGVyTmV3bGluZUluZGV4ID0gMDtcbiAgICB2YXIgZnVsbEJvdW5kYXJ5ID0gbnVsbDtcblxuICAgIGlmIChodHRwTWVzc2FnZVBhcnNlci5faXNCdWZmZXIobWVzc2FnZSkpIHtcbiAgICAgIG1lc3NhZ2VTdHJpbmcgPSBtZXNzYWdlLnRvU3RyaW5nKCk7XG4gICAgfSBlbHNlIGlmICh0eXBlb2YgbWVzc2FnZSA9PT0gJ3N0cmluZycpIHtcbiAgICAgIG1lc3NhZ2VTdHJpbmcgPSBtZXNzYWdlO1xuICAgICAgbWVzc2FnZSA9IGh0dHBNZXNzYWdlUGFyc2VyLl9jcmVhdGVCdWZmZXIobWVzc2FnZVN0cmluZyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfVxuXG4gICAgLypcbiAgICAgKiBTdHJpcCBleHRyYSByZXR1cm4gY2hhcmFjdGVyc1xuICAgICAqL1xuICAgIG1lc3NhZ2VTdHJpbmcgPSBtZXNzYWdlU3RyaW5nLnJlcGxhY2UoL1xcclxcbi9naW0sICdcXG4nKTtcblxuICAgIC8qXG4gICAgICogVHJpbSBsZWFkaW5nIHdoaXRlc3BhY2VcbiAgICAgKi9cbiAgICAoZnVuY3Rpb24oKSB7XG4gICAgICBjb25zdCBmaXJzdE5vbldoaXRlc3BhY2VSZWdleCA9IC9bXFx3LV0rL2dpbTtcbiAgICAgIGNvbnN0IGZpcnN0Tm9uV2hpdGVzcGFjZUluZGV4ID0gbWVzc2FnZVN0cmluZy5zZWFyY2goZmlyc3ROb25XaGl0ZXNwYWNlUmVnZXgpO1xuICAgICAgaWYgKGZpcnN0Tm9uV2hpdGVzcGFjZUluZGV4ID4gMCkge1xuICAgICAgICBtZXNzYWdlID0gbWVzc2FnZS5zbGljZShmaXJzdE5vbldoaXRlc3BhY2VJbmRleCwgbWVzc2FnZS5sZW5ndGgpO1xuICAgICAgICBtZXNzYWdlU3RyaW5nID0gbWVzc2FnZS50b1N0cmluZygpO1xuICAgICAgfVxuICAgIH0pKCk7XG5cbiAgICAvKiBQYXJzZSByZXF1ZXN0IGxpbmVcbiAgICAgKi9cbiAgICAoZnVuY3Rpb24oKSB7XG4gICAgICBjb25zdCBwb3NzaWJsZVJlcXVlc3RMaW5lID0gbWVzc2FnZVN0cmluZy5zcGxpdCgvXFxufFxcclxcbi8pWzBdO1xuICAgICAgY29uc3QgcmVxdWVzdExpbmVNYXRjaCA9IHBvc3NpYmxlUmVxdWVzdExpbmUubWF0Y2goaHR0cE1lc3NhZ2VQYXJzZXIuX3JlcXVlc3RMaW5lUmVnZXgpO1xuXG4gICAgICBpZiAoQXJyYXkuaXNBcnJheShyZXF1ZXN0TGluZU1hdGNoKSAmJiByZXF1ZXN0TGluZU1hdGNoLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgcmVzdWx0Lmh0dHBWZXJzaW9uID0gcGFyc2VGbG9hdChyZXF1ZXN0TGluZU1hdGNoWzFdKTtcbiAgICAgICAgcmVzdWx0LnN0YXR1c0NvZGUgPSBwYXJzZUludChyZXF1ZXN0TGluZU1hdGNoWzJdKTtcbiAgICAgICAgcmVzdWx0LnN0YXR1c01lc3NhZ2UgPSByZXF1ZXN0TGluZU1hdGNoWzNdO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uc3QgcmVzcG9uc2VMaW5lTWF0aCA9IHBvc3NpYmxlUmVxdWVzdExpbmUubWF0Y2goaHR0cE1lc3NhZ2VQYXJzZXIuX3Jlc3BvbnNlTGluZVJlZ2V4KTtcbiAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkocmVzcG9uc2VMaW5lTWF0aCkgJiYgcmVzcG9uc2VMaW5lTWF0aC5sZW5ndGggPiAxKSB7XG4gICAgICAgICAgcmVzdWx0Lm1ldGhvZCA9IHJlc3BvbnNlTGluZU1hdGhbMV07XG4gICAgICAgICAgcmVzdWx0LnVybCA9IHJlc3BvbnNlTGluZU1hdGhbMl07XG4gICAgICAgICAgcmVzdWx0Lmh0dHBWZXJzaW9uID0gcGFyc2VGbG9hdChyZXNwb25zZUxpbmVNYXRoWzNdKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0pKCk7XG5cbiAgICAvKiBQYXJzZSBoZWFkZXJzXG4gICAgICovXG4gICAgKGZ1bmN0aW9uKCkge1xuICAgICAgaGVhZGVyTmV3bGluZUluZGV4ID0gbWVzc2FnZVN0cmluZy5zZWFyY2goaHR0cE1lc3NhZ2VQYXJzZXIuX2hlYWRlck5ld2xpbmVSZWdleCk7XG4gICAgICBpZiAoaGVhZGVyTmV3bGluZUluZGV4ID4gLTEpIHtcbiAgICAgICAgaGVhZGVyTmV3bGluZUluZGV4ID0gaGVhZGVyTmV3bGluZUluZGV4ICsgMTsgLy8gMSBmb3IgbmV3bGluZSBsZW5ndGhcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8qIFRoZXJlJ3Mgbm8gbGluZSBicmVha3Mgc28gY2hlY2sgaWYgcmVxdWVzdCBsaW5lIGV4aXN0c1xuICAgICAgICAgKiBiZWNhdXNlIHRoZSBtZXNzYWdlIG1pZ2h0IGJlIGFsbCBoZWFkZXJzIGFuZCBubyBib2R5XG4gICAgICAgICAqL1xuICAgICAgICBpZiAocmVzdWx0Lmh0dHBWZXJzaW9uKSB7XG4gICAgICAgICAgaGVhZGVyTmV3bGluZUluZGV4ID0gbWVzc2FnZVN0cmluZy5sZW5ndGg7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgY29uc3QgaGVhZGVyc1N0cmluZyA9IG1lc3NhZ2VTdHJpbmcuc3Vic3RyKDAsIGhlYWRlck5ld2xpbmVJbmRleCk7XG4gICAgICBjb25zdCBoZWFkZXJzID0gaHR0cE1lc3NhZ2VQYXJzZXIuX3BhcnNlSGVhZGVycyhoZWFkZXJzU3RyaW5nKTtcblxuICAgICAgaWYgKE9iamVjdC5rZXlzKGhlYWRlcnMpLmxlbmd0aCA+IDApIHtcbiAgICAgICAgcmVzdWx0LmhlYWRlcnMgPSBoZWFkZXJzO1xuXG4gICAgICAgIC8vIFRPT0Q6IGV4dHJhY3QgYm91bmRhcnkuXG4gICAgICB9XG4gICAgfSkoKTtcblxuICAgIC8qIFRyeSB0byBnZXQgYm91bmRhcnkgaWYgbm8gYm91bmRhcnkgaGVhZGVyXG4gICAgICovXG4gICAgKGZ1bmN0aW9uKCkge1xuICAgICAgaWYgKCFyZXN1bHQuYm91bmRhcnkpIHtcbiAgICAgICAgY29uc3QgYm91bmRhcnlNYXRjaCA9IG1lc3NhZ2VTdHJpbmcubWF0Y2goaHR0cE1lc3NhZ2VQYXJzZXIuX2JvdW5kYXJ5UmVnZXgpO1xuXG4gICAgICAgIGlmIChBcnJheS5pc0FycmF5KGJvdW5kYXJ5TWF0Y2gpICYmIGJvdW5kYXJ5TWF0Y2gubGVuZ3RoKSB7XG4gICAgICAgICAgZnVsbEJvdW5kYXJ5ID0gYm91bmRhcnlNYXRjaFswXS5yZXBsYWNlKC9bXFxyXFxuXSsvZ2ksICcnKTtcbiAgICAgICAgICBjb25zdCBib3VuZGFyeSA9IGZ1bGxCb3VuZGFyeS5yZXBsYWNlKC9eLS0vLCcnKTtcbiAgICAgICAgICByZXN1bHQuYm91bmRhcnkgPSBib3VuZGFyeTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0pKCk7XG5cbiAgICAvKiBQYXJzZSBib2R5XG4gICAgICovXG4gICAgKGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIHN0YXJ0ID0gaGVhZGVyTmV3bGluZUluZGV4O1xuICAgICAgdmFyIGVuZCA9IG1lc3NhZ2UubGVuZ3RoO1xuICAgICAgY29uc3QgZmlyc3RCb3VuZGFyeUluZGV4ID0gbWVzc2FnZVN0cmluZy5pbmRleE9mKGZ1bGxCb3VuZGFyeSk7XG5cbiAgICAgIGlmIChmaXJzdEJvdW5kYXJ5SW5kZXggPiAtMSkge1xuICAgICAgICBzdGFydCA9IGhlYWRlck5ld2xpbmVJbmRleDtcbiAgICAgICAgZW5kID0gZmlyc3RCb3VuZGFyeUluZGV4O1xuICAgICAgfVxuXG4gICAgICBpZiAoaGVhZGVyTmV3bGluZUluZGV4ID4gLTEpIHtcbiAgICAgICAgY29uc3QgYm9keSA9IG1lc3NhZ2Uuc2xpY2Uoc3RhcnQsIGVuZCk7XG5cbiAgICAgICAgaWYgKGJvZHkgJiYgYm9keS5sZW5ndGgpIHtcbiAgICAgICAgICByZXN1bHQuYm9keSA9IGh0dHBNZXNzYWdlUGFyc2VyLl9pc0Zha2VCdWZmZXIoYm9keSkgPyBib2R5LnRvU3RyaW5nKCkgOiBib2R5O1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSkoKTtcblxuICAgIC8qIFBhcnNlIG11bHRpcGFydCBzZWN0aW9uc1xuICAgICAqL1xuICAgIChmdW5jdGlvbigpIHtcbiAgICAgIGlmIChyZXN1bHQuYm91bmRhcnkpIHtcbiAgICAgICAgY29uc3QgbXVsdGlwYXJ0U3RhcnQgPSBtZXNzYWdlU3RyaW5nLmluZGV4T2YoZnVsbEJvdW5kYXJ5KSArIGZ1bGxCb3VuZGFyeS5sZW5ndGg7XG4gICAgICAgIGNvbnN0IG11bHRpcGFydEVuZCA9IG1lc3NhZ2VTdHJpbmcubGFzdEluZGV4T2YoZnVsbEJvdW5kYXJ5KTtcbiAgICAgICAgY29uc3QgbXVsdGlwYXJ0Qm9keSA9IG1lc3NhZ2VTdHJpbmcuc3Vic3RyKG11bHRpcGFydFN0YXJ0LCBtdWx0aXBhcnRFbmQpO1xuICAgICAgICBjb25zdCBwYXJ0cyA9IG11bHRpcGFydEJvZHkuc3BsaXQoZnVsbEJvdW5kYXJ5KTtcblxuICAgICAgICByZXN1bHQubXVsdGlwYXJ0ID0gcGFydHMuZmlsdGVyKGh0dHBNZXNzYWdlUGFyc2VyLl9pc1RydXRoeSkubWFwKGZ1bmN0aW9uKHBhcnQsIGkpIHtcbiAgICAgICAgICBjb25zdCByZXN1bHQgPSB7XG4gICAgICAgICAgICBoZWFkZXJzOiBudWxsLFxuICAgICAgICAgICAgYm9keTogbnVsbFxuICAgICAgICAgIH07XG5cbiAgICAgICAgICBjb25zdCBuZXdsaW5lUmVnZXggPSAvXFxuXFxufFxcclxcblxcclxcbi9naW07XG4gICAgICAgICAgdmFyIG5ld2xpbmVJbmRleCA9IDA7XG4gICAgICAgICAgdmFyIG5ld2xpbmVNYXRjaCA9IG5ld2xpbmVSZWdleC5leGVjKHBhcnQpO1xuICAgICAgICAgIHZhciBib2R5ID0gbnVsbDtcblxuICAgICAgICAgIGlmIChuZXdsaW5lTWF0Y2gpIHtcbiAgICAgICAgICAgIG5ld2xpbmVJbmRleCA9IG5ld2xpbmVNYXRjaC5pbmRleDtcbiAgICAgICAgICAgIGlmIChuZXdsaW5lTWF0Y2guaW5kZXggPD0gMCkge1xuICAgICAgICAgICAgICBuZXdsaW5lTWF0Y2ggPSBuZXdsaW5lUmVnZXguZXhlYyhwYXJ0KTtcbiAgICAgICAgICAgICAgaWYgKG5ld2xpbmVNYXRjaCkge1xuICAgICAgICAgICAgICAgIG5ld2xpbmVJbmRleCA9IG5ld2xpbmVNYXRjaC5pbmRleDtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cblxuICAgICAgICAgIGNvbnN0IHBvc3NpYmxlSGVhZGVyc1N0cmluZyA9IHBhcnQuc3Vic3RyKDAsIG5ld2xpbmVJbmRleCk7XG5cbiAgICAgICAgICBpZiAobmV3bGluZUluZGV4ID4gLTEpIHtcbiAgICAgICAgICAgIGNvbnN0IGhlYWRlcnMgPSBodHRwTWVzc2FnZVBhcnNlci5fcGFyc2VIZWFkZXJzKHBvc3NpYmxlSGVhZGVyc1N0cmluZyk7XG4gICAgICAgICAgICBpZiAoT2JqZWN0LmtleXMoaGVhZGVycykubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICByZXN1bHQuaGVhZGVycyA9IGhlYWRlcnM7XG5cbiAgICAgICAgICAgICAgdmFyIGJvdW5kYXJ5SW5kZXhlcyA9IFtdO1xuICAgICAgICAgICAgICBmb3IgKHZhciBqID0gMDsgaiA8IG1lc3NhZ2UubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgICAgICAgICB2YXIgYm91bmRhcnlNYXRjaCA9IG1lc3NhZ2Uuc2xpY2UoaiwgaiArIGZ1bGxCb3VuZGFyeS5sZW5ndGgpLnRvU3RyaW5nKCk7XG5cbiAgICAgICAgICAgICAgICBpZiAoYm91bmRhcnlNYXRjaCA9PT0gZnVsbEJvdW5kYXJ5KSB7XG4gICAgICAgICAgICAgICAgICBib3VuZGFyeUluZGV4ZXMucHVzaChqKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICB2YXIgYm91bmRhcnlOZXdsaW5lSW5kZXhlcyA9IFtdO1xuICAgICAgICAgICAgICBib3VuZGFyeUluZGV4ZXMuc2xpY2UoMCwgYm91bmRhcnlJbmRleGVzLmxlbmd0aCAtIDEpLmZvckVhY2goZnVuY3Rpb24obSwgaykge1xuICAgICAgICAgICAgICAgIGNvbnN0IHBhcnRCb2R5ID0gbWVzc2FnZS5zbGljZShib3VuZGFyeUluZGV4ZXNba10sIGJvdW5kYXJ5SW5kZXhlc1trICsgMV0pLnRvU3RyaW5nKCk7XG4gICAgICAgICAgICAgICAgdmFyIGhlYWRlck5ld2xpbmVJbmRleCA9IHBhcnRCb2R5LnNlYXJjaCgvXFxuXFxufFxcclxcblxcclxcbi9naW0pICsgMjtcbiAgICAgICAgICAgICAgICBoZWFkZXJOZXdsaW5lSW5kZXggID0gYm91bmRhcnlJbmRleGVzW2tdICsgaGVhZGVyTmV3bGluZUluZGV4O1xuICAgICAgICAgICAgICAgIGJvdW5kYXJ5TmV3bGluZUluZGV4ZXMucHVzaChoZWFkZXJOZXdsaW5lSW5kZXgpO1xuICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgICBib2R5ID0gbWVzc2FnZS5zbGljZShib3VuZGFyeU5ld2xpbmVJbmRleGVzW2ldLCBib3VuZGFyeUluZGV4ZXNbaSArIDFdKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIGJvZHkgPSBwYXJ0O1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBib2R5ID0gcGFydDtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICByZXN1bHQuYm9keSA9IGh0dHBNZXNzYWdlUGFyc2VyLl9pc0Zha2VCdWZmZXIoYm9keSkgPyBib2R5LnRvU3RyaW5nKCkgOiBib2R5O1xuXG4gICAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfSkoKTtcblxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICBodHRwTWVzc2FnZVBhcnNlci5faXNUcnV0aHkgPSBmdW5jdGlvbiBfaXNUcnV0aHkodikge1xuICAgIHJldHVybiAhIXY7XG4gIH07XG5cbiAgaHR0cE1lc3NhZ2VQYXJzZXIuX2lzTnVtZXJpYyA9IGZ1bmN0aW9uIF9pc051bWVyaWModikge1xuICAgIGlmICh0eXBlb2YgdiA9PT0gJ251bWJlcicgJiYgIWlzTmFOKHYpKSB7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICB2ID0gKHZ8fCcnKS50b1N0cmluZygpLnRyaW0oKTtcblxuICAgIGlmICghdikge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIHJldHVybiAhaXNOYU4odik7XG4gIH07XG5cbiAgaHR0cE1lc3NhZ2VQYXJzZXIuX2lzQnVmZmVyID0gZnVuY3Rpb24oaXRlbSkge1xuICAgIHJldHVybiAoKGh0dHBNZXNzYWdlUGFyc2VyLl9pc05vZGVCdWZmZXJTdXBwb3J0ZWQoKSAmJlxuICAgICAgICAgICAgdHlwZW9mIGdsb2JhbCA9PT0gJ29iamVjdCcgJiZcbiAgICAgICAgICAgIGdsb2JhbC5CdWZmZXIuaXNCdWZmZXIoaXRlbSkpIHx8XG4gICAgICAgICAgICAoaXRlbSBpbnN0YW5jZW9mIE9iamVjdCAmJlxuICAgICAgICAgICAgIGl0ZW0uX2lzQnVmZmVyKSk7XG4gIH07XG5cbiAgaHR0cE1lc3NhZ2VQYXJzZXIuX2lzTm9kZUJ1ZmZlclN1cHBvcnRlZCA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiAodHlwZW9mIGdsb2JhbCA9PT0gJ29iamVjdCcgJiZcbiAgICAgICAgICAgIHR5cGVvZiBnbG9iYWwuQnVmZmVyID09PSAnZnVuY3Rpb24nICYmXG4gICAgICAgICAgICB0eXBlb2YgZ2xvYmFsLkJ1ZmZlci5pc0J1ZmZlciA9PT0gJ2Z1bmN0aW9uJyk7XG4gIH07XG5cbiAgaHR0cE1lc3NhZ2VQYXJzZXIuX3BhcnNlSGVhZGVycyA9IGZ1bmN0aW9uIF9wYXJzZUhlYWRlcnMoYm9keSkge1xuICAgIGNvbnN0IGhlYWRlcnMgPSB7fTtcblxuICAgIGlmICh0eXBlb2YgYm9keSAhPT0gJ3N0cmluZycpIHtcbiAgICAgIHJldHVybiBoZWFkZXJzO1xuICAgIH1cblxuICAgIGJvZHkuc3BsaXQoL1tcXHJcXG5dLykuZm9yRWFjaChmdW5jdGlvbihzdHJpbmcpIHtcbiAgICAgIGNvbnN0IG1hdGNoID0gc3RyaW5nLm1hdGNoKC8oW1xcdy1dKyk6XFxzKiguKikvaSk7XG5cbiAgICAgIGlmIChBcnJheS5pc0FycmF5KG1hdGNoKSAmJiBtYXRjaC5sZW5ndGggPT09IDMpIHtcbiAgICAgICAgY29uc3Qga2V5ID0gbWF0Y2hbMV07XG4gICAgICAgIGNvbnN0IHZhbHVlID0gbWF0Y2hbMl07XG5cbiAgICAgICAgaGVhZGVyc1trZXldID0gaHR0cE1lc3NhZ2VQYXJzZXIuX2lzTnVtZXJpYyh2YWx1ZSkgPyBOdW1iZXIodmFsdWUpIDogdmFsdWU7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICByZXR1cm4gaGVhZGVycztcbiAgfTtcblxuICBodHRwTWVzc2FnZVBhcnNlci5fcmVxdWVzdExpbmVSZWdleCA9IC9IVFRQXFwvKDFcXC4wfDFcXC4xfDJcXC4wKVxccysoXFxkKylcXHMrKFtcXHdcXHMtX10rKS9pO1xuICBodHRwTWVzc2FnZVBhcnNlci5fcmVzcG9uc2VMaW5lUmVnZXggPSAvKEdFVHxQT1NUfFBVVHxERUxFVEV8UEFUQ0h8T1BUSU9OU3xIRUFEfFRSQUNFfENPTk5FQ1QpXFxzKyguKilcXHMrSFRUUFxcLygxXFwuMHwxXFwuMXwyXFwuMCkvaTtcbiAgaHR0cE1lc3NhZ2VQYXJzZXIuX2hlYWRlck5ld2xpbmVSZWdleCA9IC9eW1xcclxcbl0rL2dpbTtcbiAgaHR0cE1lc3NhZ2VQYXJzZXIuX2JvdW5kYXJ5UmVnZXggPSAvKFxcbnxcXHJcXG4pKy0tW1xcdy1dKyhcXG58XFxyXFxuKSsvZztcblxuICBodHRwTWVzc2FnZVBhcnNlci5fY3JlYXRlQnVmZmVyID0gZnVuY3Rpb24oZGF0YSkge1xuICAgIGlmIChodHRwTWVzc2FnZVBhcnNlci5faXNOb2RlQnVmZmVyU3VwcG9ydGVkKCkpIHtcbiAgICAgIHJldHVybiBuZXcgQnVmZmVyKGRhdGEpO1xuICAgIH1cblxuICAgIHJldHVybiBuZXcgaHR0cE1lc3NhZ2VQYXJzZXIuX0Zha2VCdWZmZXIoZGF0YSk7XG4gIH07XG5cbiAgaHR0cE1lc3NhZ2VQYXJzZXIuX2lzRmFrZUJ1ZmZlciA9IGZ1bmN0aW9uIGlzRmFrZUJ1ZmZlcihvYmopIHtcbiAgICByZXR1cm4gb2JqIGluc3RhbmNlb2YgaHR0cE1lc3NhZ2VQYXJzZXIuX0Zha2VCdWZmZXI7XG4gIH07XG5cbiAgaHR0cE1lc3NhZ2VQYXJzZXIuX0Zha2VCdWZmZXIgPSBmdW5jdGlvbiBGYWtlQnVmZmVyKGRhdGEpIHtcbiAgICBpZiAoISh0aGlzIGluc3RhbmNlb2YgaHR0cE1lc3NhZ2VQYXJzZXIuX0Zha2VCdWZmZXIpKSB7XG4gICAgICByZXR1cm4gbmV3IGh0dHBNZXNzYWdlUGFyc2VyLl9GYWtlQnVmZmVyKGRhdGEpO1xuICAgIH1cblxuICAgIHRoaXMuZGF0YSA9IFtdO1xuXG4gICAgaWYgKEFycmF5LmlzQXJyYXkoZGF0YSkpIHtcbiAgICAgIHRoaXMuZGF0YSA9IGRhdGE7XG4gICAgfSBlbHNlIGlmICh0eXBlb2YgZGF0YSA9PT0gJ3N0cmluZycpIHtcbiAgICAgIHRoaXMuZGF0YSA9IFtdLnNsaWNlLmNhbGwoZGF0YSk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gTGl2ZU9iamVjdCgpIHt9XG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KExpdmVPYmplY3QucHJvdG90eXBlLCAnbGVuZ3RoJywge1xuICAgICAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZGF0YS5sZW5ndGg7XG4gICAgICB9LmJpbmQodGhpcylcbiAgICB9KTtcblxuICAgIHRoaXMubGVuZ3RoID0gKG5ldyBMaXZlT2JqZWN0KCkpLmxlbmd0aDtcbiAgfTtcblxuICBodHRwTWVzc2FnZVBhcnNlci5fRmFrZUJ1ZmZlci5wcm90b3R5cGUuc2xpY2UgPSBmdW5jdGlvbiBzbGljZSgpIHtcbiAgICB2YXIgbmV3QXJyYXkgPSBbXS5zbGljZS5hcHBseSh0aGlzLmRhdGEsIGFyZ3VtZW50cyk7XG4gICAgcmV0dXJuIG5ldyBodHRwTWVzc2FnZVBhcnNlci5fRmFrZUJ1ZmZlcihuZXdBcnJheSk7XG4gIH07XG5cbiAgaHR0cE1lc3NhZ2VQYXJzZXIuX0Zha2VCdWZmZXIucHJvdG90eXBlLnNlYXJjaCA9IGZ1bmN0aW9uIHNlYXJjaCgpIHtcbiAgICByZXR1cm4gW10uc2VhcmNoLmFwcGx5KHRoaXMuZGF0YSwgYXJndW1lbnRzKTtcbiAgfTtcblxuICBodHRwTWVzc2FnZVBhcnNlci5fRmFrZUJ1ZmZlci5wcm90b3R5cGUuaW5kZXhPZiA9IGZ1bmN0aW9uIGluZGV4T2YoKSB7XG4gICAgcmV0dXJuIFtdLmluZGV4T2YuYXBwbHkodGhpcy5kYXRhLCBhcmd1bWVudHMpO1xuICB9O1xuXG4gIGh0dHBNZXNzYWdlUGFyc2VyLl9GYWtlQnVmZmVyLnByb3RvdHlwZS50b1N0cmluZyA9IGZ1bmN0aW9uIHRvU3RyaW5nKCkge1xuICAgIHJldHVybiB0aGlzLmRhdGEuam9pbignJyk7XG4gIH07XG5cbiAgaWYgKHR5cGVvZiBleHBvcnRzICE9PSAndW5kZWZpbmVkJykge1xuICAgIGlmICh0eXBlb2YgbW9kdWxlICE9PSAndW5kZWZpbmVkJyAmJiBtb2R1bGUuZXhwb3J0cykge1xuICAgICAgZXhwb3J0cyA9IG1vZHVsZS5leHBvcnRzID0gaHR0cE1lc3NhZ2VQYXJzZXI7XG4gICAgfVxuICAgIGV4cG9ydHMuaHR0cE1lc3NhZ2VQYXJzZXIgPSBodHRwTWVzc2FnZVBhcnNlcjtcbiAgfSBlbHNlIGlmICh0eXBlb2YgZGVmaW5lID09PSAnZnVuY3Rpb24nICYmIGRlZmluZS5hbWQpIHtcbiAgICBkZWZpbmUoW10sIGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIGh0dHBNZXNzYWdlUGFyc2VyO1xuICAgIH0pO1xuICB9IGVsc2Uge1xuICAgIHJvb3QuaHR0cE1lc3NhZ2VQYXJzZXIgPSBodHRwTWVzc2FnZVBhcnNlcjtcbiAgfVxuXG59KSh0aGlzKTtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIFN0cmluZ2lmeSA9IHJlcXVpcmUoJy4vc3RyaW5naWZ5Jyk7XG52YXIgUGFyc2UgPSByZXF1aXJlKCcuL3BhcnNlJyk7XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICAgIHN0cmluZ2lmeTogU3RyaW5naWZ5LFxuICAgIHBhcnNlOiBQYXJzZVxufTtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIFV0aWxzID0gcmVxdWlyZSgnLi91dGlscycpO1xuXG52YXIgaW50ZXJuYWxzID0ge1xuICAgIGRlbGltaXRlcjogJyYnLFxuICAgIGRlcHRoOiA1LFxuICAgIGFycmF5TGltaXQ6IDIwLFxuICAgIHBhcmFtZXRlckxpbWl0OiAxMDAwLFxuICAgIHN0cmljdE51bGxIYW5kbGluZzogZmFsc2UsXG4gICAgcGxhaW5PYmplY3RzOiBmYWxzZSxcbiAgICBhbGxvd1Byb3RvdHlwZXM6IGZhbHNlLFxuICAgIGFsbG93RG90czogZmFsc2Vcbn07XG5cbmludGVybmFscy5wYXJzZVZhbHVlcyA9IGZ1bmN0aW9uIChzdHIsIG9wdGlvbnMpIHtcbiAgICB2YXIgb2JqID0ge307XG4gICAgdmFyIHBhcnRzID0gc3RyLnNwbGl0KG9wdGlvbnMuZGVsaW1pdGVyLCBvcHRpb25zLnBhcmFtZXRlckxpbWl0ID09PSBJbmZpbml0eSA/IHVuZGVmaW5lZCA6IG9wdGlvbnMucGFyYW1ldGVyTGltaXQpO1xuXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBwYXJ0cy5sZW5ndGg7ICsraSkge1xuICAgICAgICB2YXIgcGFydCA9IHBhcnRzW2ldO1xuICAgICAgICB2YXIgcG9zID0gcGFydC5pbmRleE9mKCddPScpID09PSAtMSA/IHBhcnQuaW5kZXhPZignPScpIDogcGFydC5pbmRleE9mKCddPScpICsgMTtcblxuICAgICAgICBpZiAocG9zID09PSAtMSkge1xuICAgICAgICAgICAgb2JqW1V0aWxzLmRlY29kZShwYXJ0KV0gPSAnJztcblxuICAgICAgICAgICAgaWYgKG9wdGlvbnMuc3RyaWN0TnVsbEhhbmRsaW5nKSB7XG4gICAgICAgICAgICAgICAgb2JqW1V0aWxzLmRlY29kZShwYXJ0KV0gPSBudWxsO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdmFyIGtleSA9IFV0aWxzLmRlY29kZShwYXJ0LnNsaWNlKDAsIHBvcykpO1xuICAgICAgICAgICAgdmFyIHZhbCA9IFV0aWxzLmRlY29kZShwYXJ0LnNsaWNlKHBvcyArIDEpKTtcblxuICAgICAgICAgICAgaWYgKE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChvYmosIGtleSkpIHtcbiAgICAgICAgICAgICAgICBvYmpba2V5XSA9IFtdLmNvbmNhdChvYmpba2V5XSkuY29uY2F0KHZhbCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIG9ialtrZXldID0gdmFsO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIG9iajtcbn07XG5cbmludGVybmFscy5wYXJzZU9iamVjdCA9IGZ1bmN0aW9uIChjaGFpbiwgdmFsLCBvcHRpb25zKSB7XG4gICAgaWYgKCFjaGFpbi5sZW5ndGgpIHtcbiAgICAgICAgcmV0dXJuIHZhbDtcbiAgICB9XG5cbiAgICB2YXIgcm9vdCA9IGNoYWluLnNoaWZ0KCk7XG5cbiAgICB2YXIgb2JqO1xuICAgIGlmIChyb290ID09PSAnW10nKSB7XG4gICAgICAgIG9iaiA9IFtdO1xuICAgICAgICBvYmogPSBvYmouY29uY2F0KGludGVybmFscy5wYXJzZU9iamVjdChjaGFpbiwgdmFsLCBvcHRpb25zKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgb2JqID0gb3B0aW9ucy5wbGFpbk9iamVjdHMgPyBPYmplY3QuY3JlYXRlKG51bGwpIDoge307XG4gICAgICAgIHZhciBjbGVhblJvb3QgPSByb290WzBdID09PSAnWycgJiYgcm9vdFtyb290Lmxlbmd0aCAtIDFdID09PSAnXScgPyByb290LnNsaWNlKDEsIHJvb3QubGVuZ3RoIC0gMSkgOiByb290O1xuICAgICAgICB2YXIgaW5kZXggPSBwYXJzZUludChjbGVhblJvb3QsIDEwKTtcbiAgICAgICAgaWYgKFxuICAgICAgICAgICAgIWlzTmFOKGluZGV4KSAmJlxuICAgICAgICAgICAgcm9vdCAhPT0gY2xlYW5Sb290ICYmXG4gICAgICAgICAgICBTdHJpbmcoaW5kZXgpID09PSBjbGVhblJvb3QgJiZcbiAgICAgICAgICAgIGluZGV4ID49IDAgJiZcbiAgICAgICAgICAgIChvcHRpb25zLnBhcnNlQXJyYXlzICYmIGluZGV4IDw9IG9wdGlvbnMuYXJyYXlMaW1pdClcbiAgICAgICAgKSB7XG4gICAgICAgICAgICBvYmogPSBbXTtcbiAgICAgICAgICAgIG9ialtpbmRleF0gPSBpbnRlcm5hbHMucGFyc2VPYmplY3QoY2hhaW4sIHZhbCwgb3B0aW9ucyk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBvYmpbY2xlYW5Sb290XSA9IGludGVybmFscy5wYXJzZU9iamVjdChjaGFpbiwgdmFsLCBvcHRpb25zKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBvYmo7XG59O1xuXG5pbnRlcm5hbHMucGFyc2VLZXlzID0gZnVuY3Rpb24gKGdpdmVuS2V5LCB2YWwsIG9wdGlvbnMpIHtcbiAgICBpZiAoIWdpdmVuS2V5KSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAvLyBUcmFuc2Zvcm0gZG90IG5vdGF0aW9uIHRvIGJyYWNrZXQgbm90YXRpb25cbiAgICB2YXIga2V5ID0gb3B0aW9ucy5hbGxvd0RvdHMgPyBnaXZlbktleS5yZXBsYWNlKC9cXC4oW15cXC5cXFtdKykvZywgJ1skMV0nKSA6IGdpdmVuS2V5O1xuXG4gICAgLy8gVGhlIHJlZ2V4IGNodW5rc1xuXG4gICAgdmFyIHBhcmVudCA9IC9eKFteXFxbXFxdXSopLztcbiAgICB2YXIgY2hpbGQgPSAvKFxcW1teXFxbXFxdXSpcXF0pL2c7XG5cbiAgICAvLyBHZXQgdGhlIHBhcmVudFxuXG4gICAgdmFyIHNlZ21lbnQgPSBwYXJlbnQuZXhlYyhrZXkpO1xuXG4gICAgLy8gU3Rhc2ggdGhlIHBhcmVudCBpZiBpdCBleGlzdHNcblxuICAgIHZhciBrZXlzID0gW107XG4gICAgaWYgKHNlZ21lbnRbMV0pIHtcbiAgICAgICAgLy8gSWYgd2UgYXJlbid0IHVzaW5nIHBsYWluIG9iamVjdHMsIG9wdGlvbmFsbHkgcHJlZml4IGtleXNcbiAgICAgICAgLy8gdGhhdCB3b3VsZCBvdmVyd3JpdGUgb2JqZWN0IHByb3RvdHlwZSBwcm9wZXJ0aWVzXG4gICAgICAgIGlmICghb3B0aW9ucy5wbGFpbk9iamVjdHMgJiYgT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eShzZWdtZW50WzFdKSkge1xuICAgICAgICAgICAgaWYgKCFvcHRpb25zLmFsbG93UHJvdG90eXBlcykge1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGtleXMucHVzaChzZWdtZW50WzFdKTtcbiAgICB9XG5cbiAgICAvLyBMb29wIHRocm91Z2ggY2hpbGRyZW4gYXBwZW5kaW5nIHRvIHRoZSBhcnJheSB1bnRpbCB3ZSBoaXQgZGVwdGhcblxuICAgIHZhciBpID0gMDtcbiAgICB3aGlsZSAoKHNlZ21lbnQgPSBjaGlsZC5leGVjKGtleSkpICE9PSBudWxsICYmIGkgPCBvcHRpb25zLmRlcHRoKSB7XG4gICAgICAgIGkgKz0gMTtcbiAgICAgICAgaWYgKCFvcHRpb25zLnBsYWluT2JqZWN0cyAmJiBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5KHNlZ21lbnRbMV0ucmVwbGFjZSgvXFxbfFxcXS9nLCAnJykpKSB7XG4gICAgICAgICAgICBpZiAoIW9wdGlvbnMuYWxsb3dQcm90b3R5cGVzKSB7XG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAga2V5cy5wdXNoKHNlZ21lbnRbMV0pO1xuICAgIH1cblxuICAgIC8vIElmIHRoZXJlJ3MgYSByZW1haW5kZXIsIGp1c3QgYWRkIHdoYXRldmVyIGlzIGxlZnRcblxuICAgIGlmIChzZWdtZW50KSB7XG4gICAgICAgIGtleXMucHVzaCgnWycgKyBrZXkuc2xpY2Uoc2VnbWVudC5pbmRleCkgKyAnXScpO1xuICAgIH1cblxuICAgIHJldHVybiBpbnRlcm5hbHMucGFyc2VPYmplY3Qoa2V5cywgdmFsLCBvcHRpb25zKTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKHN0ciwgb3B0cykge1xuICAgIHZhciBvcHRpb25zID0gb3B0cyB8fCB7fTtcbiAgICBvcHRpb25zLmRlbGltaXRlciA9IHR5cGVvZiBvcHRpb25zLmRlbGltaXRlciA9PT0gJ3N0cmluZycgfHwgVXRpbHMuaXNSZWdFeHAob3B0aW9ucy5kZWxpbWl0ZXIpID8gb3B0aW9ucy5kZWxpbWl0ZXIgOiBpbnRlcm5hbHMuZGVsaW1pdGVyO1xuICAgIG9wdGlvbnMuZGVwdGggPSB0eXBlb2Ygb3B0aW9ucy5kZXB0aCA9PT0gJ251bWJlcicgPyBvcHRpb25zLmRlcHRoIDogaW50ZXJuYWxzLmRlcHRoO1xuICAgIG9wdGlvbnMuYXJyYXlMaW1pdCA9IHR5cGVvZiBvcHRpb25zLmFycmF5TGltaXQgPT09ICdudW1iZXInID8gb3B0aW9ucy5hcnJheUxpbWl0IDogaW50ZXJuYWxzLmFycmF5TGltaXQ7XG4gICAgb3B0aW9ucy5wYXJzZUFycmF5cyA9IG9wdGlvbnMucGFyc2VBcnJheXMgIT09IGZhbHNlO1xuICAgIG9wdGlvbnMuYWxsb3dEb3RzID0gdHlwZW9mIG9wdGlvbnMuYWxsb3dEb3RzID09PSAnYm9vbGVhbicgPyBvcHRpb25zLmFsbG93RG90cyA6IGludGVybmFscy5hbGxvd0RvdHM7XG4gICAgb3B0aW9ucy5wbGFpbk9iamVjdHMgPSB0eXBlb2Ygb3B0aW9ucy5wbGFpbk9iamVjdHMgPT09ICdib29sZWFuJyA/IG9wdGlvbnMucGxhaW5PYmplY3RzIDogaW50ZXJuYWxzLnBsYWluT2JqZWN0cztcbiAgICBvcHRpb25zLmFsbG93UHJvdG90eXBlcyA9IHR5cGVvZiBvcHRpb25zLmFsbG93UHJvdG90eXBlcyA9PT0gJ2Jvb2xlYW4nID8gb3B0aW9ucy5hbGxvd1Byb3RvdHlwZXMgOiBpbnRlcm5hbHMuYWxsb3dQcm90b3R5cGVzO1xuICAgIG9wdGlvbnMucGFyYW1ldGVyTGltaXQgPSB0eXBlb2Ygb3B0aW9ucy5wYXJhbWV0ZXJMaW1pdCA9PT0gJ251bWJlcicgPyBvcHRpb25zLnBhcmFtZXRlckxpbWl0IDogaW50ZXJuYWxzLnBhcmFtZXRlckxpbWl0O1xuICAgIG9wdGlvbnMuc3RyaWN0TnVsbEhhbmRsaW5nID0gdHlwZW9mIG9wdGlvbnMuc3RyaWN0TnVsbEhhbmRsaW5nID09PSAnYm9vbGVhbicgPyBvcHRpb25zLnN0cmljdE51bGxIYW5kbGluZyA6IGludGVybmFscy5zdHJpY3ROdWxsSGFuZGxpbmc7XG5cbiAgICBpZiAoXG4gICAgICAgIHN0ciA9PT0gJycgfHxcbiAgICAgICAgc3RyID09PSBudWxsIHx8XG4gICAgICAgIHR5cGVvZiBzdHIgPT09ICd1bmRlZmluZWQnXG4gICAgKSB7XG4gICAgICAgIHJldHVybiBvcHRpb25zLnBsYWluT2JqZWN0cyA/IE9iamVjdC5jcmVhdGUobnVsbCkgOiB7fTtcbiAgICB9XG5cbiAgICB2YXIgdGVtcE9iaiA9IHR5cGVvZiBzdHIgPT09ICdzdHJpbmcnID8gaW50ZXJuYWxzLnBhcnNlVmFsdWVzKHN0ciwgb3B0aW9ucykgOiBzdHI7XG4gICAgdmFyIG9iaiA9IG9wdGlvbnMucGxhaW5PYmplY3RzID8gT2JqZWN0LmNyZWF0ZShudWxsKSA6IHt9O1xuXG4gICAgLy8gSXRlcmF0ZSBvdmVyIHRoZSBrZXlzIGFuZCBzZXR1cCB0aGUgbmV3IG9iamVjdFxuXG4gICAgdmFyIGtleXMgPSBPYmplY3Qua2V5cyh0ZW1wT2JqKTtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGtleXMubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgdmFyIGtleSA9IGtleXNbaV07XG4gICAgICAgIHZhciBuZXdPYmogPSBpbnRlcm5hbHMucGFyc2VLZXlzKGtleSwgdGVtcE9ialtrZXldLCBvcHRpb25zKTtcbiAgICAgICAgb2JqID0gVXRpbHMubWVyZ2Uob2JqLCBuZXdPYmosIG9wdGlvbnMpO1xuICAgIH1cblxuICAgIHJldHVybiBVdGlscy5jb21wYWN0KG9iaik7XG59O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgVXRpbHMgPSByZXF1aXJlKCcuL3V0aWxzJyk7XG5cbnZhciBpbnRlcm5hbHMgPSB7XG4gICAgZGVsaW1pdGVyOiAnJicsXG4gICAgYXJyYXlQcmVmaXhHZW5lcmF0b3JzOiB7XG4gICAgICAgIGJyYWNrZXRzOiBmdW5jdGlvbiAocHJlZml4KSB7XG4gICAgICAgICAgICByZXR1cm4gcHJlZml4ICsgJ1tdJztcbiAgICAgICAgfSxcbiAgICAgICAgaW5kaWNlczogZnVuY3Rpb24gKHByZWZpeCwga2V5KSB7XG4gICAgICAgICAgICByZXR1cm4gcHJlZml4ICsgJ1snICsga2V5ICsgJ10nO1xuICAgICAgICB9LFxuICAgICAgICByZXBlYXQ6IGZ1bmN0aW9uIChwcmVmaXgpIHtcbiAgICAgICAgICAgIHJldHVybiBwcmVmaXg7XG4gICAgICAgIH1cbiAgICB9LFxuICAgIHN0cmljdE51bGxIYW5kbGluZzogZmFsc2UsXG4gICAgc2tpcE51bGxzOiBmYWxzZSxcbiAgICBlbmNvZGU6IHRydWVcbn07XG5cbmludGVybmFscy5zdHJpbmdpZnkgPSBmdW5jdGlvbiAob2JqZWN0LCBwcmVmaXgsIGdlbmVyYXRlQXJyYXlQcmVmaXgsIHN0cmljdE51bGxIYW5kbGluZywgc2tpcE51bGxzLCBlbmNvZGUsIGZpbHRlciwgc29ydCwgYWxsb3dEb3RzKSB7XG4gICAgdmFyIG9iaiA9IG9iamVjdDtcbiAgICBpZiAodHlwZW9mIGZpbHRlciA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICBvYmogPSBmaWx0ZXIocHJlZml4LCBvYmopO1xuICAgIH0gZWxzZSBpZiAoVXRpbHMuaXNCdWZmZXIob2JqKSkge1xuICAgICAgICBvYmogPSBTdHJpbmcob2JqKTtcbiAgICB9IGVsc2UgaWYgKG9iaiBpbnN0YW5jZW9mIERhdGUpIHtcbiAgICAgICAgb2JqID0gb2JqLnRvSVNPU3RyaW5nKCk7XG4gICAgfSBlbHNlIGlmIChvYmogPT09IG51bGwpIHtcbiAgICAgICAgaWYgKHN0cmljdE51bGxIYW5kbGluZykge1xuICAgICAgICAgICAgcmV0dXJuIGVuY29kZSA/IFV0aWxzLmVuY29kZShwcmVmaXgpIDogcHJlZml4O1xuICAgICAgICB9XG5cbiAgICAgICAgb2JqID0gJyc7XG4gICAgfVxuXG4gICAgaWYgKHR5cGVvZiBvYmogPT09ICdzdHJpbmcnIHx8IHR5cGVvZiBvYmogPT09ICdudW1iZXInIHx8IHR5cGVvZiBvYmogPT09ICdib29sZWFuJykge1xuICAgICAgICBpZiAoZW5jb2RlKSB7XG4gICAgICAgICAgICByZXR1cm4gW1V0aWxzLmVuY29kZShwcmVmaXgpICsgJz0nICsgVXRpbHMuZW5jb2RlKG9iaildO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBbcHJlZml4ICsgJz0nICsgb2JqXTtcbiAgICB9XG5cbiAgICB2YXIgdmFsdWVzID0gW107XG5cbiAgICBpZiAodHlwZW9mIG9iaiA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgcmV0dXJuIHZhbHVlcztcbiAgICB9XG5cbiAgICB2YXIgb2JqS2V5cztcbiAgICBpZiAoQXJyYXkuaXNBcnJheShmaWx0ZXIpKSB7XG4gICAgICAgIG9iaktleXMgPSBmaWx0ZXI7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgdmFyIGtleXMgPSBPYmplY3Qua2V5cyhvYmopO1xuICAgICAgICBvYmpLZXlzID0gc29ydCA/IGtleXMuc29ydChzb3J0KSA6IGtleXM7XG4gICAgfVxuXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBvYmpLZXlzLmxlbmd0aDsgKytpKSB7XG4gICAgICAgIHZhciBrZXkgPSBvYmpLZXlzW2ldO1xuXG4gICAgICAgIGlmIChza2lwTnVsbHMgJiYgb2JqW2tleV0gPT09IG51bGwpIHtcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkob2JqKSkge1xuICAgICAgICAgICAgdmFsdWVzID0gdmFsdWVzLmNvbmNhdChpbnRlcm5hbHMuc3RyaW5naWZ5KG9ialtrZXldLCBnZW5lcmF0ZUFycmF5UHJlZml4KHByZWZpeCwga2V5KSwgZ2VuZXJhdGVBcnJheVByZWZpeCwgc3RyaWN0TnVsbEhhbmRsaW5nLCBza2lwTnVsbHMsIGVuY29kZSwgZmlsdGVyLCBzb3J0LCBhbGxvd0RvdHMpKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHZhbHVlcyA9IHZhbHVlcy5jb25jYXQoaW50ZXJuYWxzLnN0cmluZ2lmeShvYmpba2V5XSwgcHJlZml4ICsgKGFsbG93RG90cyA/ICcuJyArIGtleSA6ICdbJyArIGtleSArICddJyksIGdlbmVyYXRlQXJyYXlQcmVmaXgsIHN0cmljdE51bGxIYW5kbGluZywgc2tpcE51bGxzLCBlbmNvZGUsIGZpbHRlciwgc29ydCwgYWxsb3dEb3RzKSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gdmFsdWVzO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAob2JqZWN0LCBvcHRzKSB7XG4gICAgdmFyIG9iaiA9IG9iamVjdDtcbiAgICB2YXIgb3B0aW9ucyA9IG9wdHMgfHwge307XG4gICAgdmFyIGRlbGltaXRlciA9IHR5cGVvZiBvcHRpb25zLmRlbGltaXRlciA9PT0gJ3VuZGVmaW5lZCcgPyBpbnRlcm5hbHMuZGVsaW1pdGVyIDogb3B0aW9ucy5kZWxpbWl0ZXI7XG4gICAgdmFyIHN0cmljdE51bGxIYW5kbGluZyA9IHR5cGVvZiBvcHRpb25zLnN0cmljdE51bGxIYW5kbGluZyA9PT0gJ2Jvb2xlYW4nID8gb3B0aW9ucy5zdHJpY3ROdWxsSGFuZGxpbmcgOiBpbnRlcm5hbHMuc3RyaWN0TnVsbEhhbmRsaW5nO1xuICAgIHZhciBza2lwTnVsbHMgPSB0eXBlb2Ygb3B0aW9ucy5za2lwTnVsbHMgPT09ICdib29sZWFuJyA/IG9wdGlvbnMuc2tpcE51bGxzIDogaW50ZXJuYWxzLnNraXBOdWxscztcbiAgICB2YXIgZW5jb2RlID0gdHlwZW9mIG9wdGlvbnMuZW5jb2RlID09PSAnYm9vbGVhbicgPyBvcHRpb25zLmVuY29kZSA6IGludGVybmFscy5lbmNvZGU7XG4gICAgdmFyIHNvcnQgPSB0eXBlb2Ygb3B0aW9ucy5zb3J0ID09PSAnZnVuY3Rpb24nID8gb3B0aW9ucy5zb3J0IDogbnVsbDtcbiAgICB2YXIgYWxsb3dEb3RzID0gdHlwZW9mIG9wdGlvbnMuYWxsb3dEb3RzID09PSAndW5kZWZpbmVkJyA/IGZhbHNlIDogb3B0aW9ucy5hbGxvd0RvdHM7XG4gICAgdmFyIG9iaktleXM7XG4gICAgdmFyIGZpbHRlcjtcbiAgICBpZiAodHlwZW9mIG9wdGlvbnMuZmlsdGVyID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIGZpbHRlciA9IG9wdGlvbnMuZmlsdGVyO1xuICAgICAgICBvYmogPSBmaWx0ZXIoJycsIG9iaik7XG4gICAgfSBlbHNlIGlmIChBcnJheS5pc0FycmF5KG9wdGlvbnMuZmlsdGVyKSkge1xuICAgICAgICBvYmpLZXlzID0gZmlsdGVyID0gb3B0aW9ucy5maWx0ZXI7XG4gICAgfVxuXG4gICAgdmFyIGtleXMgPSBbXTtcblxuICAgIGlmICh0eXBlb2Ygb2JqICE9PSAnb2JqZWN0JyB8fCBvYmogPT09IG51bGwpIHtcbiAgICAgICAgcmV0dXJuICcnO1xuICAgIH1cblxuICAgIHZhciBhcnJheUZvcm1hdDtcbiAgICBpZiAob3B0aW9ucy5hcnJheUZvcm1hdCBpbiBpbnRlcm5hbHMuYXJyYXlQcmVmaXhHZW5lcmF0b3JzKSB7XG4gICAgICAgIGFycmF5Rm9ybWF0ID0gb3B0aW9ucy5hcnJheUZvcm1hdDtcbiAgICB9IGVsc2UgaWYgKCdpbmRpY2VzJyBpbiBvcHRpb25zKSB7XG4gICAgICAgIGFycmF5Rm9ybWF0ID0gb3B0aW9ucy5pbmRpY2VzID8gJ2luZGljZXMnIDogJ3JlcGVhdCc7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgYXJyYXlGb3JtYXQgPSAnaW5kaWNlcyc7XG4gICAgfVxuXG4gICAgdmFyIGdlbmVyYXRlQXJyYXlQcmVmaXggPSBpbnRlcm5hbHMuYXJyYXlQcmVmaXhHZW5lcmF0b3JzW2FycmF5Rm9ybWF0XTtcblxuICAgIGlmICghb2JqS2V5cykge1xuICAgICAgICBvYmpLZXlzID0gT2JqZWN0LmtleXMob2JqKTtcbiAgICB9XG5cbiAgICBpZiAoc29ydCkge1xuICAgICAgICBvYmpLZXlzLnNvcnQoc29ydCk7XG4gICAgfVxuXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBvYmpLZXlzLmxlbmd0aDsgKytpKSB7XG4gICAgICAgIHZhciBrZXkgPSBvYmpLZXlzW2ldO1xuXG4gICAgICAgIGlmIChza2lwTnVsbHMgJiYgb2JqW2tleV0gPT09IG51bGwpIHtcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG5cbiAgICAgICAga2V5cyA9IGtleXMuY29uY2F0KGludGVybmFscy5zdHJpbmdpZnkob2JqW2tleV0sIGtleSwgZ2VuZXJhdGVBcnJheVByZWZpeCwgc3RyaWN0TnVsbEhhbmRsaW5nLCBza2lwTnVsbHMsIGVuY29kZSwgZmlsdGVyLCBzb3J0LCBhbGxvd0RvdHMpKTtcbiAgICB9XG5cbiAgICByZXR1cm4ga2V5cy5qb2luKGRlbGltaXRlcik7XG59O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgaGV4VGFibGUgPSAoZnVuY3Rpb24gKCkge1xuICAgIHZhciBhcnJheSA9IG5ldyBBcnJheSgyNTYpO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgMjU2OyArK2kpIHtcbiAgICAgICAgYXJyYXlbaV0gPSAnJScgKyAoKGkgPCAxNiA/ICcwJyA6ICcnKSArIGkudG9TdHJpbmcoMTYpKS50b1VwcGVyQ2FzZSgpO1xuICAgIH1cblxuICAgIHJldHVybiBhcnJheTtcbn0oKSk7XG5cbmV4cG9ydHMuYXJyYXlUb09iamVjdCA9IGZ1bmN0aW9uIChzb3VyY2UsIG9wdGlvbnMpIHtcbiAgICB2YXIgb2JqID0gb3B0aW9ucy5wbGFpbk9iamVjdHMgPyBPYmplY3QuY3JlYXRlKG51bGwpIDoge307XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBzb3VyY2UubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgaWYgKHR5cGVvZiBzb3VyY2VbaV0gIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICBvYmpbaV0gPSBzb3VyY2VbaV07XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gb2JqO1xufTtcblxuZXhwb3J0cy5tZXJnZSA9IGZ1bmN0aW9uICh0YXJnZXQsIHNvdXJjZSwgb3B0aW9ucykge1xuICAgIGlmICghc291cmNlKSB7XG4gICAgICAgIHJldHVybiB0YXJnZXQ7XG4gICAgfVxuXG4gICAgaWYgKHR5cGVvZiBzb3VyY2UgIT09ICdvYmplY3QnKSB7XG4gICAgICAgIGlmIChBcnJheS5pc0FycmF5KHRhcmdldCkpIHtcbiAgICAgICAgICAgIHRhcmdldC5wdXNoKHNvdXJjZSk7XG4gICAgICAgIH0gZWxzZSBpZiAodHlwZW9mIHRhcmdldCA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgICAgIHRhcmdldFtzb3VyY2VdID0gdHJ1ZTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiBbdGFyZ2V0LCBzb3VyY2VdO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHRhcmdldDtcbiAgICB9XG5cbiAgICBpZiAodHlwZW9mIHRhcmdldCAhPT0gJ29iamVjdCcpIHtcbiAgICAgICAgcmV0dXJuIFt0YXJnZXRdLmNvbmNhdChzb3VyY2UpO1xuICAgIH1cblxuICAgIHZhciBtZXJnZVRhcmdldCA9IHRhcmdldDtcbiAgICBpZiAoQXJyYXkuaXNBcnJheSh0YXJnZXQpICYmICFBcnJheS5pc0FycmF5KHNvdXJjZSkpIHtcbiAgICAgICAgbWVyZ2VUYXJnZXQgPSBleHBvcnRzLmFycmF5VG9PYmplY3QodGFyZ2V0LCBvcHRpb25zKTtcbiAgICB9XG5cblx0cmV0dXJuIE9iamVjdC5rZXlzKHNvdXJjZSkucmVkdWNlKGZ1bmN0aW9uIChhY2MsIGtleSkge1xuICAgICAgICB2YXIgdmFsdWUgPSBzb3VyY2Vba2V5XTtcblxuICAgICAgICBpZiAoT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKGFjYywga2V5KSkge1xuICAgICAgICAgICAgYWNjW2tleV0gPSBleHBvcnRzLm1lcmdlKGFjY1trZXldLCB2YWx1ZSwgb3B0aW9ucyk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBhY2Nba2V5XSA9IHZhbHVlO1xuICAgICAgICB9XG5cdFx0cmV0dXJuIGFjYztcbiAgICB9LCBtZXJnZVRhcmdldCk7XG59O1xuXG5leHBvcnRzLmRlY29kZSA9IGZ1bmN0aW9uIChzdHIpIHtcbiAgICB0cnkge1xuICAgICAgICByZXR1cm4gZGVjb2RlVVJJQ29tcG9uZW50KHN0ci5yZXBsYWNlKC9cXCsvZywgJyAnKSk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgICByZXR1cm4gc3RyO1xuICAgIH1cbn07XG5cbmV4cG9ydHMuZW5jb2RlID0gZnVuY3Rpb24gKHN0cikge1xuICAgIC8vIFRoaXMgY29kZSB3YXMgb3JpZ2luYWxseSB3cml0dGVuIGJ5IEJyaWFuIFdoaXRlIChtc2NkZXgpIGZvciB0aGUgaW8uanMgY29yZSBxdWVyeXN0cmluZyBsaWJyYXJ5LlxuICAgIC8vIEl0IGhhcyBiZWVuIGFkYXB0ZWQgaGVyZSBmb3Igc3RyaWN0ZXIgYWRoZXJlbmNlIHRvIFJGQyAzOTg2XG4gICAgaWYgKHN0ci5sZW5ndGggPT09IDApIHtcbiAgICAgICAgcmV0dXJuIHN0cjtcbiAgICB9XG5cbiAgICB2YXIgc3RyaW5nID0gdHlwZW9mIHN0ciA9PT0gJ3N0cmluZycgPyBzdHIgOiBTdHJpbmcoc3RyKTtcblxuICAgIHZhciBvdXQgPSAnJztcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHN0cmluZy5sZW5ndGg7ICsraSkge1xuICAgICAgICB2YXIgYyA9IHN0cmluZy5jaGFyQ29kZUF0KGkpO1xuXG4gICAgICAgIGlmIChcbiAgICAgICAgICAgIGMgPT09IDB4MkQgfHwgLy8gLVxuICAgICAgICAgICAgYyA9PT0gMHgyRSB8fCAvLyAuXG4gICAgICAgICAgICBjID09PSAweDVGIHx8IC8vIF9cbiAgICAgICAgICAgIGMgPT09IDB4N0UgfHwgLy8gflxuICAgICAgICAgICAgKGMgPj0gMHgzMCAmJiBjIDw9IDB4MzkpIHx8IC8vIDAtOVxuICAgICAgICAgICAgKGMgPj0gMHg0MSAmJiBjIDw9IDB4NUEpIHx8IC8vIGEtelxuICAgICAgICAgICAgKGMgPj0gMHg2MSAmJiBjIDw9IDB4N0EpIC8vIEEtWlxuICAgICAgICApIHtcbiAgICAgICAgICAgIG91dCArPSBzdHJpbmcuY2hhckF0KGkpO1xuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoYyA8IDB4ODApIHtcbiAgICAgICAgICAgIG91dCA9IG91dCArIGhleFRhYmxlW2NdO1xuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoYyA8IDB4ODAwKSB7XG4gICAgICAgICAgICBvdXQgPSBvdXQgKyAoaGV4VGFibGVbMHhDMCB8IChjID4+IDYpXSArIGhleFRhYmxlWzB4ODAgfCAoYyAmIDB4M0YpXSk7XG4gICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChjIDwgMHhEODAwIHx8IGMgPj0gMHhFMDAwKSB7XG4gICAgICAgICAgICBvdXQgPSBvdXQgKyAoaGV4VGFibGVbMHhFMCB8IChjID4+IDEyKV0gKyBoZXhUYWJsZVsweDgwIHwgKChjID4+IDYpICYgMHgzRildICsgaGV4VGFibGVbMHg4MCB8IChjICYgMHgzRildKTtcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgaSArPSAxO1xuICAgICAgICBjID0gMHgxMDAwMCArICgoKGMgJiAweDNGRikgPDwgMTApIHwgKHN0cmluZy5jaGFyQ29kZUF0KGkpICYgMHgzRkYpKTtcbiAgICAgICAgb3V0ICs9IChoZXhUYWJsZVsweEYwIHwgKGMgPj4gMTgpXSArIGhleFRhYmxlWzB4ODAgfCAoKGMgPj4gMTIpICYgMHgzRildICsgaGV4VGFibGVbMHg4MCB8ICgoYyA+PiA2KSAmIDB4M0YpXSArIGhleFRhYmxlWzB4ODAgfCAoYyAmIDB4M0YpXSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIG91dDtcbn07XG5cbmV4cG9ydHMuY29tcGFjdCA9IGZ1bmN0aW9uIChvYmosIHJlZmVyZW5jZXMpIHtcbiAgICBpZiAodHlwZW9mIG9iaiAhPT0gJ29iamVjdCcgfHwgb2JqID09PSBudWxsKSB7XG4gICAgICAgIHJldHVybiBvYmo7XG4gICAgfVxuXG4gICAgdmFyIHJlZnMgPSByZWZlcmVuY2VzIHx8IFtdO1xuICAgIHZhciBsb29rdXAgPSByZWZzLmluZGV4T2Yob2JqKTtcbiAgICBpZiAobG9va3VwICE9PSAtMSkge1xuICAgICAgICByZXR1cm4gcmVmc1tsb29rdXBdO1xuICAgIH1cblxuICAgIHJlZnMucHVzaChvYmopO1xuXG4gICAgaWYgKEFycmF5LmlzQXJyYXkob2JqKSkge1xuICAgICAgICB2YXIgY29tcGFjdGVkID0gW107XG5cbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBvYmoubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgICAgIGlmICh0eXBlb2Ygb2JqW2ldICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgICAgIGNvbXBhY3RlZC5wdXNoKG9ialtpXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gY29tcGFjdGVkO1xuICAgIH1cblxuICAgIHZhciBrZXlzID0gT2JqZWN0LmtleXMob2JqKTtcbiAgICBmb3IgKHZhciBqID0gMDsgaiA8IGtleXMubGVuZ3RoOyArK2opIHtcbiAgICAgICAgdmFyIGtleSA9IGtleXNbal07XG4gICAgICAgIG9ialtrZXldID0gZXhwb3J0cy5jb21wYWN0KG9ialtrZXldLCByZWZzKTtcbiAgICB9XG5cbiAgICByZXR1cm4gb2JqO1xufTtcblxuZXhwb3J0cy5pc1JlZ0V4cCA9IGZ1bmN0aW9uIChvYmopIHtcbiAgICByZXR1cm4gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKG9iaikgPT09ICdbb2JqZWN0IFJlZ0V4cF0nO1xufTtcblxuZXhwb3J0cy5pc0J1ZmZlciA9IGZ1bmN0aW9uIChvYmopIHtcbiAgICBpZiAob2JqID09PSBudWxsIHx8IHR5cGVvZiBvYmogPT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICByZXR1cm4gISEob2JqLmNvbnN0cnVjdG9yICYmIG9iai5jb25zdHJ1Y3Rvci5pc0J1ZmZlciAmJiBvYmouY29uc3RydWN0b3IuaXNCdWZmZXIob2JqKSk7XG59O1xuIl19
