(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
const AVS = require('../');
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
(function () {
  'use strict';

  const AVS = require('./lib/AVS');

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

},{"./lib/AVS":7}],7:[function(require,module,exports){
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

      // Ensure that the file can be loaded in environments where navigator is not defined (node servers)
      if (!navigator.getUserMedia) {
        navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia;
      }

      navigator.getUserMedia({
        audio: true
      }, stream => {
        this._log('Microphone connected.');
        return this.connectMediaStream(stream).then(resolve);
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

module.exports = AVS;

},{"./AmazonErrorCodes.js":8,"./Observable.js":9,"./Player.js":10,"./utils/arrayBufferToString.js":12,"./utils/downsampleBuffer.js":13,"./utils/interleave.js":14,"./utils/mergeBuffers.js":15,"./utils/writeUTFBytes.js":16,"buffer":2,"http-message-parser":17,"qs":18}],8:[function(require,module,exports){
'use strict';

module.exports = {
  InvalidAccessTokenException: 'com.amazon.alexahttpproxy.exceptions.InvalidAccessTokenException'
};

},{}],9:[function(require,module,exports){
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

},{}],10:[function(require,module,exports){
'use strict';

const Observable = require('./Observable');
const arrayBufferToAudioBuffer = require('./utils/arrayBufferToAudioBuffer');
const toString = Object.prototype.toString;

class Player {
  constructor() {
    window.AudioContext = window.AudioContext || window.webkitAudioContext;

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

},{"./Observable":9,"./utils/arrayBufferToAudioBuffer":11}],11:[function(require,module,exports){
'use strict';

function arrayBufferToAudioBuffer(arrayBuffer, context) {
  window.AudioContext = window.AudioContext || window.webkitAudioContext;

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

},{}],14:[function(require,module,exports){
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

},{}],15:[function(require,module,exports){
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

},{}],16:[function(require,module,exports){
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJpbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9idWZmZXIvaW5kZXguanMiLCJub2RlX21vZHVsZXMvYnVmZmVyL25vZGVfbW9kdWxlcy9iYXNlNjQtanMvbGliL2I2NC5qcyIsIm5vZGVfbW9kdWxlcy9idWZmZXIvbm9kZV9tb2R1bGVzL2llZWU3NTQvaW5kZXguanMiLCJub2RlX21vZHVsZXMvYnVmZmVyL25vZGVfbW9kdWxlcy9pc2FycmF5L2luZGV4LmpzIiwiLi4vaW5kZXguanMiLCIuLi9saWIvQVZTLmpzIiwiLi4vbGliL0FtYXpvbkVycm9yQ29kZXMuanMiLCIuLi9saWIvT2JzZXJ2YWJsZS5qcyIsIi4uL2xpYi9QbGF5ZXIuanMiLCIuLi9saWIvdXRpbHMvYXJyYXlCdWZmZXJUb0F1ZGlvQnVmZmVyLmpzIiwiLi4vbGliL3V0aWxzL2FycmF5QnVmZmVyVG9TdHJpbmcuanMiLCIuLi9saWIvdXRpbHMvZG93bnNhbXBsZUJ1ZmZlci5qcyIsIi4uL2xpYi91dGlscy9pbnRlcmxlYXZlLmpzIiwiLi4vbGliL3V0aWxzL21lcmdlQnVmZmVycy5qcyIsIi4uL2xpYi91dGlscy93cml0ZVVURkJ5dGVzLmpzIiwiLi4vbm9kZV9tb2R1bGVzL2h0dHAtbWVzc2FnZS1wYXJzZXIvaHR0cC1tZXNzYWdlLXBhcnNlci5qcyIsIi4uL25vZGVfbW9kdWxlcy9xcy9saWIvaW5kZXguanMiLCIuLi9ub2RlX21vZHVsZXMvcXMvbGliL3BhcnNlLmpzIiwiLi4vbm9kZV9tb2R1bGVzL3FzL2xpYi9zdHJpbmdpZnkuanMiLCIuLi9ub2RlX21vZHVsZXMvcXMvbGliL3V0aWxzLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUEsTUFBTSxNQUFNLFFBQVEsS0FBUixDQUFOO0FBQ04sTUFBTSxTQUFTLElBQUksTUFBSjs7QUFFZixNQUFNLE1BQU0sSUFBSSxHQUFKLENBQVE7QUFDbEIsU0FB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Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDaDdDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ0xBLENBQUMsWUFBVztBQUNWLGVBRFU7O0FBR1YsUUFBTSxNQUFNLFFBQVEsV0FBUixD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QUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUNsVUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDVEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BLQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbklBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsImNvbnN0IEFWUyA9IHJlcXVpcmUoJy4uLycpO1xuY29uc3QgcGxheWVyID0gQVZTLlBsYXllcjtcblxuY29uc3QgYXZzID0gbmV3IEFWUyh7XG4gIGRlYnVnOiB0cnVlLFxuICBjbGllbnRJZDogJ2Ftem4xLmFwcGxpY2F0aW9uLW9hMi1jbGllbnQuNjk2YWI5MGZjNTg0NGZkYmI4ZWZjMTczOTRhNzljMDAnLFxuICBkZXZpY2VJZDogJ3Rlc3RfZGV2aWNlJyxcbiAgZGV2aWNlU2VyaWFsTnVtYmVyOiAxMjMsXG4gIHJlZGlyZWN0VXJpOiBgaHR0cHM6Ly8ke3dpbmRvdy5sb2NhdGlvbi5ob3N0fS9hdXRocmVzcG9uc2VgXG59KTtcblxuYXZzLm9uKEFWUy5FdmVudFR5cGVzLlRPS0VOX1NFVCwgKCkgPT4ge1xuICBsb2dpbkJ0bi5kaXNhYmxlZCA9IHRydWU7XG4gIGxvZ291dEJ0bi5kaXNhYmxlZCA9IGZhbHNlO1xuICBzdGFydFJlY29yZGluZy5kaXNhYmxlZCA9IGZhbHNlO1xuICBzdG9wUmVjb3JkaW5nLmRpc2FibGVkID0gdHJ1ZTtcbn0pO1xuXG5hdnMub24oQVZTLkV2ZW50VHlwZXMuUkVDT1JEX1NUQVJULCAoKSA9PiB7XG4gIHN0YXJ0UmVjb3JkaW5nLmRpc2FibGVkID0gdHJ1ZTtcbiAgc3RvcFJlY29yZGluZy5kaXNhYmxlZCA9IGZhbHNlO1xufSk7XG5cbmF2cy5vbihBVlMuRXZlbnRUeXBlcy5SRUNPUkRfU1RPUCwgKCkgPT4ge1xuICBzdGFydFJlY29yZGluZy5kaXNhYmxlZCA9IGZhbHNlO1xuICBzdG9wUmVjb3JkaW5nLmRpc2FibGVkID0gdHJ1ZTtcbn0pO1xuXG5hdnMub24oQVZTLkV2ZW50VHlwZXMuTE9HT1VULCAoKSA9PiB7XG4gIGxvZ2luQnRuLmRpc2FibGVkID0gZmFsc2U7XG4gIGxvZ291dEJ0bi5kaXNhYmxlZCA9IHRydWU7XG4gIHN0YXJ0UmVjb3JkaW5nLmRpc2FibGVkID0gdHJ1ZTtcbiAgc3RvcFJlY29yZGluZy5kaXNhYmxlZCA9IHRydWU7XG59KTtcblxuYXZzLm9uKEFWUy5FdmVudFR5cGVzLlRPS0VOX0lOVkFMSUQsICgpID0+IHtcbiAgYXZzLmxvZ291dCgpXG4gIC50aGVuKGxvZ2luKVxufSk7XG5cbmF2cy5vbihBVlMuRXZlbnRUeXBlcy5MT0csIGxvZyk7XG5hdnMub24oQVZTLkV2ZW50VHlwZXMuRVJST1IsIGxvZ0Vycm9yKTtcblxuYXZzLnBsYXllci5vbihBVlMuUGxheWVyLkV2ZW50VHlwZXMuTE9HLCBsb2cpO1xuYXZzLnBsYXllci5vbihBVlMuUGxheWVyLkV2ZW50VHlwZXMuRVJST1IsIGxvZ0Vycm9yKTtcblxuYXZzLnBsYXllci5vbihBVlMuUGxheWVyLkV2ZW50VHlwZXMuUExBWSwgKCkgPT4ge1xuICBwbGF5QXVkaW8uZGlzYWJsZWQgPSB0cnVlO1xuICByZXBsYXlBdWRpby5kaXNhYmxlZCA9IHRydWU7XG4gIHBhdXNlQXVkaW8uZGlzYWJsZWQgPSBmYWxzZTtcbiAgc3RvcEF1ZGlvLmRpc2FibGVkID0gZmFsc2U7XG59KTtcblxuYXZzLnBsYXllci5vbihBVlMuUGxheWVyLkV2ZW50VHlwZXMuRU5ERUQsICgpID0+IHtcbiAgcGxheUF1ZGlvLmRpc2FibGVkID0gdHJ1ZTtcbiAgcmVwbGF5QXVkaW8uZGlzYWJsZWQgPSBmYWxzZTtcbiAgcGF1c2VBdWRpby5kaXNhYmxlZCA9IHRydWU7XG4gIHN0b3BBdWRpby5kaXNhYmxlZCA9IHRydWU7XG59KTtcblxuYXZzLnBsYXllci5vbihBVlMuUGxheWVyLkV2ZW50VHlwZXMuU1RPUCwgKCkgPT4ge1xuICBwbGF5QXVkaW8uZGlzYWJsZWQgPSB0cnVlO1xuICByZXBsYXlBdWRpby5kaXNhYmxlZCA9IGZhbHNlO1xuICBwYXVzZUF1ZGlvLmRpc2FibGVkID0gZmFsc2U7XG4gIHN0b3BBdWRpby5kaXNhYmxlZCA9IGZhbHNlO1xufSk7XG5cbmF2cy5wbGF5ZXIub24oQVZTLlBsYXllci5FdmVudFR5cGVzLlBBVVNFLCAoKSA9PiB7XG4gIHBsYXlBdWRpby5kaXNhYmxlZCA9IGZhbHNlO1xuICByZXBsYXlBdWRpby5kaXNhYmxlZCA9IGZhbHNlO1xuICBwYXVzZUF1ZGlvLmRpc2FibGVkID0gdHJ1ZTtcbiAgc3RvcEF1ZGlvLmRpc2FibGVkID0gdHJ1ZTtcbn0pO1xuXG5hdnMucGxheWVyLm9uKEFWUy5QbGF5ZXIuRXZlbnRUeXBlcy5SRVBMQVksICgpID0+IHtcbiAgcGxheUF1ZGlvLmRpc2FibGVkID0gdHJ1ZTtcbiAgcmVwbGF5QXVkaW8uZGlzYWJsZWQgPSB0cnVlO1xuICBwYXVzZUF1ZGlvLmRpc2FibGVkID0gZmFsc2U7XG4gIHN0b3BBdWRpby5kaXNhYmxlZCA9IGZhbHNlO1xufSk7XG5cbmZ1bmN0aW9uIGxvZyhtZXNzYWdlKSB7XG4gIGxvZ091dHB1dC5pbm5lckhUTUwgKz0gYDxsaT5MT0c6ICR7bWVzc2FnZX08L2xpPmA7XG59XG5cbmZ1bmN0aW9uIGxvZ0Vycm9yKGVycm9yKSB7XG4gIGxvZ091dHB1dC5pbm5lckhUTUwgKz0gYDxsaT5FUlJPUjogJHtlcnJvcn08L2xpPmA7XG59XG5cbmNvbnN0IGxvZ2luQnRuID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2xvZ2luJyk7XG5jb25zdCBsb2dvdXRCdG4gPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnbG9nb3V0Jyk7XG5jb25zdCBsb2dPdXRwdXQgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnbG9nJyk7XG5jb25zdCBzdGFydFJlY29yZGluZyA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdzdGFydFJlY29yZGluZycpO1xuY29uc3Qgc3RvcFJlY29yZGluZyA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdzdG9wUmVjb3JkaW5nJyk7XG5jb25zdCBzdG9wQXVkaW8gPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnc3RvcEF1ZGlvJyk7XG5jb25zdCBwYXVzZUF1ZGlvID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3BhdXNlQXVkaW8nKTtcbmNvbnN0IHBsYXlBdWRpbyA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdwbGF5QXVkaW8nKTtcbmNvbnN0IHJlcGxheUF1ZGlvID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3JlcGxheUF1ZGlvJyk7XG5cbi8qXG4vLyBJZiB1c2luZyBjbGllbnQgc2VjcmV0XG5hdnMuZ2V0Q29kZUZyb21VcmwoKVxuIC50aGVuKGNvZGUgPT4gYXZzLmdldFRva2VuRnJvbUNvZGUoY29kZSkpXG4udGhlbih0b2tlbiA9PiBsb2NhbFN0b3JhZ2Uuc2V0SXRlbSgndG9rZW4nLCB0b2tlbikpXG4udGhlbihyZWZyZXNoVG9rZW4gPT4gbG9jYWxTdG9yYWdlLnNldEl0ZW0oJ3JlZnJlc2hUb2tlbicsIHJlZnJlc2hUb2tlbikpXG4udGhlbigoKSA9PiBhdnMucmVxdWVzdE1pYygpKVxuLnRoZW4oKCkgPT4gYXZzLnJlZnJlc2hUb2tlbigpKVxuLmNhdGNoKCgpID0+IHtcblxufSk7XG4qL1xuXG5hdnMuZ2V0VG9rZW5Gcm9tVXJsKClcbi50aGVuKCgpID0+IGF2cy5nZXRUb2tlbigpKVxuLnRoZW4odG9rZW4gPT4gbG9jYWxTdG9yYWdlLnNldEl0ZW0oJ3Rva2VuJywgdG9rZW4pKVxuLnRoZW4oKCkgPT4gYXZzLnJlcXVlc3RNaWMoKSlcbi5jYXRjaCgoKSA9PiB7XG4gIGNvbnN0IGNhY2hlZFRva2VuID0gbG9jYWxTdG9yYWdlLmdldEl0ZW0oJ3Rva2VuJyk7XG5cbiAgaWYgKGNhY2hlZFRva2VuKSB7XG4gICAgYXZzLnNldFRva2VuKGNhY2hlZFRva2VuKTtcbiAgICByZXR1cm4gYXZzLnJlcXVlc3RNaWMoKTtcbiAgfVxufSk7XG5cbmxvZ2luQnRuLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgbG9naW4pO1xuXG5mdW5jdGlvbiBsb2dpbihldmVudCkge1xuICByZXR1cm4gYXZzLmxvZ2luKClcbiAgLnRoZW4oKCkgPT4gYXZzLnJlcXVlc3RNaWMoKSlcbiAgLmNhdGNoKCgpID0+IHt9KTtcblxuICAvKlxuICAvLyBJZiB1c2luZyBjbGllbnQgc2VjcmV0XG4gIGF2cy5sb2dpbih7cmVzcG9uc2VUeXBlOiAnY29kZSd9KVxuICAudGhlbigoKSA9PiBhdnMucmVxdWVzdE1pYygpKVxuICAuY2F0Y2goKCkgPT4ge30pO1xuICAqL1xufVxuXG5sb2dvdXRCdG4uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBsb2dvdXQpO1xuXG5mdW5jdGlvbiBsb2dvdXQoKSB7XG4gIHJldHVybiBhdnMubG9nb3V0KClcbiAgLnRoZW4oKCkgPT4ge1xuICAgIGxvY2FsU3RvcmFnZS5yZW1vdmVJdGVtKCd0b2tlbicpO1xuICAgIHdpbmRvdy5sb2NhdGlvbi5oYXNoID0gJyc7XG4gIH0pO1xufVxuXG5zdGFydFJlY29yZGluZy5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHtcbiAgYXZzLnN0YXJ0UmVjb3JkaW5nKCk7XG59KTtcblxuc3RvcFJlY29yZGluZy5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHtcbiAgYXZzLnN0b3BSZWNvcmRpbmcoKS50aGVuKGRhdGFWaWV3ID0+IHtcbiAgICBhdnMucGxheWVyLmVtcHR5UXVldWUoKVxuICAgIC50aGVuKCgpID0+IGF2cy5wbGF5ZXIuZW5xdWV1ZShkYXRhVmlldykpXG4gICAgLnRoZW4oKCkgPT4gYXZzLnBsYXllci5wbGF5KCkpXG4gICAgLmNhdGNoKGVycm9yID0+IHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoZXJyb3IpO1xuICAgIH0pO1xuXG4gICAgLy9zZW5kQmxvYihibG9iKTtcbiAgICBhdnMuc2VuZEF1ZGlvKGRhdGFWaWV3KVxuICAgIC50aGVuKHJlc3BvbnNlID0+IHtcblxuICAgICAgaWYgKHJlc3BvbnNlLm11bHRpcGFydC5sZW5ndGggPiAxKSB7XG4gICAgICAgIGNvbnN0IHR5cGVkQXJyYXkgPSByZXNwb25zZS5tdWx0aXBhcnRbMV0uYm9keTtcblxuICAgICAgICBhdnMucGxheWVyLmVucXVldWUodHlwZWRBcnJheSlcbiAgICAgICAgLnRoZW4oKCkgPT4gYXZzLnBsYXllci5wbGF5KCkpXG4gICAgICAgIC5jYXRjaChlcnJvciA9PiB7XG4gICAgICAgICAgY29uc29sZS5lcnJvcihlcnJvcik7XG4gICAgICAgIH0pO1xuICAgICAgfVxuXG4gICAgfSlcbiAgICAuY2F0Y2goZXJyb3IgPT4ge1xuICAgICAgY29uc29sZS5lcnJvcihlcnJvcik7XG4gICAgfSk7XG4gIH0pO1xufSk7XG5cbnN0b3BBdWRpby5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIChldmVudCkgPT4ge1xuICBhdnMucGxheWVyLnN0b3AoKTtcbn0pO1xuXG5wYXVzZUF1ZGlvLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKGV2ZW50KSA9PiB7XG4gIGF2cy5wbGF5ZXIucGF1c2UoKTtcbn0pO1xuXG5wbGF5QXVkaW8uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoZXZlbnQpID0+IHtcbiAgYXZzLnBsYXllci5wbGF5KCk7XG59KTtcblxucmVwbGF5QXVkaW8uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoZXZlbnQpID0+IHtcbiAgYXZzLnBsYXllci5yZXBsYXkoKTtcbn0pO1xuXG5mdW5jdGlvbiBzZW5kQmxvYihibG9iKSB7XG4gIGNvbnN0IHhociA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xuICBjb25zdCBmZCA9IG5ldyBGb3JtRGF0YSgpO1xuXG4gIGZkLmFwcGVuZCgnZm5hbWUnLCAnYXVkaW8ud2F2Jyk7XG4gIGZkLmFwcGVuZCgnZGF0YScsIGJsb2IpO1xuXG4gIHhoci5vcGVuKCdQT1NUJywgJ2h0dHA6Ly9sb2NhbGhvc3Q6NTU1NS9hdWRpbycsIHRydWUpO1xuICB4aHIucmVzcG9uc2VUeXBlID0gJ2Jsb2InO1xuXG4gIHhoci5vbmxvYWQgPSAoZXZlbnQpID0+IHtcbiAgICBpZiAoeGhyLnN0YXR1cyA9PSAyMDApIHtcbiAgICAgIGNvbnNvbGUubG9nKHhoci5yZXNwb25zZSk7XG4gICAgICAvL2NvbnN0IHJlc3BvbnNlQmxvYiA9IG5ldyBCbG9iKFt4aHIucmVzcG9uc2VdLCB7dHlwZTogJ2F1ZGlvL21wMyd9KTtcbiAgICB9XG4gIH07XG4gIHhoci5zZW5kKGZkKTtcbn1cbiIsIi8qIVxuICogVGhlIGJ1ZmZlciBtb2R1bGUgZnJvbSBub2RlLmpzLCBmb3IgdGhlIGJyb3dzZXIuXG4gKlxuICogQGF1dGhvciAgIEZlcm9zcyBBYm91a2hhZGlqZWggPGZlcm9zc0BmZXJvc3Mub3JnPiA8aHR0cDovL2Zlcm9zcy5vcmc+XG4gKiBAbGljZW5zZSAgTUlUXG4gKi9cbi8qIGVzbGludC1kaXNhYmxlIG5vLXByb3RvICovXG5cbid1c2Ugc3RyaWN0J1xuXG52YXIgYmFzZTY0ID0gcmVxdWlyZSgnYmFzZTY0LWpzJylcbnZhciBpZWVlNzU0ID0gcmVxdWlyZSgnaWVlZTc1NCcpXG52YXIgaXNBcnJheSA9IHJlcXVpcmUoJ2lzYXJyYXknKVxuXG5leHBvcnRzLkJ1ZmZlciA9IEJ1ZmZlclxuZXhwb3J0cy5TbG93QnVmZmVyID0gU2xvd0J1ZmZlclxuZXhwb3J0cy5JTlNQRUNUX01BWF9CWVRFUyA9IDUwXG5CdWZmZXIucG9vbFNpemUgPSA4MTkyIC8vIG5vdCB1c2VkIGJ5IHRoaXMgaW1wbGVtZW50YXRpb25cblxudmFyIHJvb3RQYXJlbnQgPSB7fVxuXG4vKipcbiAqIElmIGBCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVGA6XG4gKiAgID09PSB0cnVlICAgIFVzZSBVaW50OEFycmF5IGltcGxlbWVudGF0aW9uIChmYXN0ZXN0KVxuICogICA9PT0gZmFsc2UgICBVc2UgT2JqZWN0IGltcGxlbWVudGF0aW9uIChtb3N0IGNvbXBhdGlibGUsIGV2ZW4gSUU2KVxuICpcbiAqIEJyb3dzZXJzIHRoYXQgc3VwcG9ydCB0eXBlZCBhcnJheXMgYXJlIElFIDEwKywgRmlyZWZveCA0KywgQ2hyb21lIDcrLCBTYWZhcmkgNS4xKyxcbiAqIE9wZXJhIDExLjYrLCBpT1MgNC4yKy5cbiAqXG4gKiBEdWUgdG8gdmFyaW91cyBicm93c2VyIGJ1Z3MsIHNvbWV0aW1lcyB0aGUgT2JqZWN0IGltcGxlbWVudGF0aW9uIHdpbGwgYmUgdXNlZCBldmVuXG4gKiB3aGVuIHRoZSBicm93c2VyIHN1cHBvcnRzIHR5cGVkIGFycmF5cy5cbiAqXG4gKiBOb3RlOlxuICpcbiAqICAgLSBGaXJlZm94IDQtMjkgbGFja3Mgc3VwcG9ydCBmb3IgYWRkaW5nIG5ldyBwcm9wZXJ0aWVzIHRvIGBVaW50OEFycmF5YCBpbnN0YW5jZXMsXG4gKiAgICAgU2VlOiBodHRwczovL2J1Z3ppbGxhLm1vemlsbGEub3JnL3Nob3dfYnVnLmNnaT9pZD02OTU0MzguXG4gKlxuICogICAtIENocm9tZSA5LTEwIGlzIG1pc3NpbmcgdGhlIGBUeXBlZEFycmF5LnByb3RvdHlwZS5zdWJhcnJheWAgZnVuY3Rpb24uXG4gKlxuICogICAtIElFMTAgaGFzIGEgYnJva2VuIGBUeXBlZEFycmF5LnByb3RvdHlwZS5zdWJhcnJheWAgZnVuY3Rpb24gd2hpY2ggcmV0dXJucyBhcnJheXMgb2ZcbiAqICAgICBpbmNvcnJlY3QgbGVuZ3RoIGluIHNvbWUgc2l0dWF0aW9ucy5cblxuICogV2UgZGV0ZWN0IHRoZXNlIGJ1Z2d5IGJyb3dzZXJzIGFuZCBzZXQgYEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUYCB0byBgZmFsc2VgIHNvIHRoZXlcbiAqIGdldCB0aGUgT2JqZWN0IGltcGxlbWVudGF0aW9uLCB3aGljaCBpcyBzbG93ZXIgYnV0IGJlaGF2ZXMgY29ycmVjdGx5LlxuICovXG5CdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCA9IGdsb2JhbC5UWVBFRF9BUlJBWV9TVVBQT1JUICE9PSB1bmRlZmluZWRcbiAgPyBnbG9iYWwuVFlQRURfQVJSQVlfU1VQUE9SVFxuICA6IHR5cGVkQXJyYXlTdXBwb3J0KClcblxuZnVuY3Rpb24gdHlwZWRBcnJheVN1cHBvcnQgKCkge1xuICB0cnkge1xuICAgIHZhciBhcnIgPSBuZXcgVWludDhBcnJheSgxKVxuICAgIGFyci5mb28gPSBmdW5jdGlvbiAoKSB7IHJldHVybiA0MiB9XG4gICAgcmV0dXJuIGFyci5mb28oKSA9PT0gNDIgJiYgLy8gdHlwZWQgYXJyYXkgaW5zdGFuY2VzIGNhbiBiZSBhdWdtZW50ZWRcbiAgICAgICAgdHlwZW9mIGFyci5zdWJhcnJheSA9PT0gJ2Z1bmN0aW9uJyAmJiAvLyBjaHJvbWUgOS0xMCBsYWNrIGBzdWJhcnJheWBcbiAgICAgICAgYXJyLnN1YmFycmF5KDEsIDEpLmJ5dGVMZW5ndGggPT09IDAgLy8gaWUxMCBoYXMgYnJva2VuIGBzdWJhcnJheWBcbiAgfSBjYXRjaCAoZSkge1xuICAgIHJldHVybiBmYWxzZVxuICB9XG59XG5cbmZ1bmN0aW9uIGtNYXhMZW5ndGggKCkge1xuICByZXR1cm4gQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlRcbiAgICA/IDB4N2ZmZmZmZmZcbiAgICA6IDB4M2ZmZmZmZmZcbn1cblxuLyoqXG4gKiBUaGUgQnVmZmVyIGNvbnN0cnVjdG9yIHJldHVybnMgaW5zdGFuY2VzIG9mIGBVaW50OEFycmF5YCB0aGF0IGhhdmUgdGhlaXJcbiAqIHByb3RvdHlwZSBjaGFuZ2VkIHRvIGBCdWZmZXIucHJvdG90eXBlYC4gRnVydGhlcm1vcmUsIGBCdWZmZXJgIGlzIGEgc3ViY2xhc3Mgb2ZcbiAqIGBVaW50OEFycmF5YCwgc28gdGhlIHJldHVybmVkIGluc3RhbmNlcyB3aWxsIGhhdmUgYWxsIHRoZSBub2RlIGBCdWZmZXJgIG1ldGhvZHNcbiAqIGFuZCB0aGUgYFVpbnQ4QXJyYXlgIG1ldGhvZHMuIFNxdWFyZSBicmFja2V0IG5vdGF0aW9uIHdvcmtzIGFzIGV4cGVjdGVkIC0tIGl0XG4gKiByZXR1cm5zIGEgc2luZ2xlIG9jdGV0LlxuICpcbiAqIFRoZSBgVWludDhBcnJheWAgcHJvdG90eXBlIHJlbWFpbnMgdW5tb2RpZmllZC5cbiAqL1xuZnVuY3Rpb24gQnVmZmVyIChhcmcpIHtcbiAgaWYgKCEodGhpcyBpbnN0YW5jZW9mIEJ1ZmZlcikpIHtcbiAgICAvLyBBdm9pZCBnb2luZyB0aHJvdWdoIGFuIEFyZ3VtZW50c0FkYXB0b3JUcmFtcG9saW5lIGluIHRoZSBjb21tb24gY2FzZS5cbiAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA+IDEpIHJldHVybiBuZXcgQnVmZmVyKGFyZywgYXJndW1lbnRzWzFdKVxuICAgIHJldHVybiBuZXcgQnVmZmVyKGFyZylcbiAgfVxuXG4gIGlmICghQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICB0aGlzLmxlbmd0aCA9IDBcbiAgICB0aGlzLnBhcmVudCA9IHVuZGVmaW5lZFxuICB9XG5cbiAgLy8gQ29tbW9uIGNhc2UuXG4gIGlmICh0eXBlb2YgYXJnID09PSAnbnVtYmVyJykge1xuICAgIHJldHVybiBmcm9tTnVtYmVyKHRoaXMsIGFyZylcbiAgfVxuXG4gIC8vIFNsaWdodGx5IGxlc3MgY29tbW9uIGNhc2UuXG4gIGlmICh0eXBlb2YgYXJnID09PSAnc3RyaW5nJykge1xuICAgIHJldHVybiBmcm9tU3RyaW5nKHRoaXMsIGFyZywgYXJndW1lbnRzLmxlbmd0aCA+IDEgPyBhcmd1bWVudHNbMV0gOiAndXRmOCcpXG4gIH1cblxuICAvLyBVbnVzdWFsLlxuICByZXR1cm4gZnJvbU9iamVjdCh0aGlzLCBhcmcpXG59XG5cbi8vIFRPRE86IExlZ2FjeSwgbm90IG5lZWRlZCBhbnltb3JlLiBSZW1vdmUgaW4gbmV4dCBtYWpvciB2ZXJzaW9uLlxuQnVmZmVyLl9hdWdtZW50ID0gZnVuY3Rpb24gKGFycikge1xuICBhcnIuX19wcm90b19fID0gQnVmZmVyLnByb3RvdHlwZVxuICByZXR1cm4gYXJyXG59XG5cbmZ1bmN0aW9uIGZyb21OdW1iZXIgKHRoYXQsIGxlbmd0aCkge1xuICB0aGF0ID0gYWxsb2NhdGUodGhhdCwgbGVuZ3RoIDwgMCA/IDAgOiBjaGVja2VkKGxlbmd0aCkgfCAwKVxuICBpZiAoIUJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAgdGhhdFtpXSA9IDBcbiAgICB9XG4gIH1cbiAgcmV0dXJuIHRoYXRcbn1cblxuZnVuY3Rpb24gZnJvbVN0cmluZyAodGhhdCwgc3RyaW5nLCBlbmNvZGluZykge1xuICBpZiAodHlwZW9mIGVuY29kaW5nICE9PSAnc3RyaW5nJyB8fCBlbmNvZGluZyA9PT0gJycpIGVuY29kaW5nID0gJ3V0ZjgnXG5cbiAgLy8gQXNzdW1wdGlvbjogYnl0ZUxlbmd0aCgpIHJldHVybiB2YWx1ZSBpcyBhbHdheXMgPCBrTWF4TGVuZ3RoLlxuICB2YXIgbGVuZ3RoID0gYnl0ZUxlbmd0aChzdHJpbmcsIGVuY29kaW5nKSB8IDBcbiAgdGhhdCA9IGFsbG9jYXRlKHRoYXQsIGxlbmd0aClcblxuICB0aGF0LndyaXRlKHN0cmluZywgZW5jb2RpbmcpXG4gIHJldHVybiB0aGF0XG59XG5cbmZ1bmN0aW9uIGZyb21PYmplY3QgKHRoYXQsIG9iamVjdCkge1xuICBpZiAoQnVmZmVyLmlzQnVmZmVyKG9iamVjdCkpIHJldHVybiBmcm9tQnVmZmVyKHRoYXQsIG9iamVjdClcblxuICBpZiAoaXNBcnJheShvYmplY3QpKSByZXR1cm4gZnJvbUFycmF5KHRoYXQsIG9iamVjdClcblxuICBpZiAob2JqZWN0ID09IG51bGwpIHtcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdtdXN0IHN0YXJ0IHdpdGggbnVtYmVyLCBidWZmZXIsIGFycmF5IG9yIHN0cmluZycpXG4gIH1cblxuICBpZiAodHlwZW9mIEFycmF5QnVmZmVyICE9PSAndW5kZWZpbmVkJykge1xuICAgIGlmIChvYmplY3QuYnVmZmVyIGluc3RhbmNlb2YgQXJyYXlCdWZmZXIpIHtcbiAgICAgIHJldHVybiBmcm9tVHlwZWRBcnJheSh0aGF0LCBvYmplY3QpXG4gICAgfVxuICAgIGlmIChvYmplY3QgaW5zdGFuY2VvZiBBcnJheUJ1ZmZlcikge1xuICAgICAgcmV0dXJuIGZyb21BcnJheUJ1ZmZlcih0aGF0LCBvYmplY3QpXG4gICAgfVxuICB9XG5cbiAgaWYgKG9iamVjdC5sZW5ndGgpIHJldHVybiBmcm9tQXJyYXlMaWtlKHRoYXQsIG9iamVjdClcblxuICByZXR1cm4gZnJvbUpzb25PYmplY3QodGhhdCwgb2JqZWN0KVxufVxuXG5mdW5jdGlvbiBmcm9tQnVmZmVyICh0aGF0LCBidWZmZXIpIHtcbiAgdmFyIGxlbmd0aCA9IGNoZWNrZWQoYnVmZmVyLmxlbmd0aCkgfCAwXG4gIHRoYXQgPSBhbGxvY2F0ZSh0aGF0LCBsZW5ndGgpXG4gIGJ1ZmZlci5jb3B5KHRoYXQsIDAsIDAsIGxlbmd0aClcbiAgcmV0dXJuIHRoYXRcbn1cblxuZnVuY3Rpb24gZnJvbUFycmF5ICh0aGF0LCBhcnJheSkge1xuICB2YXIgbGVuZ3RoID0gY2hlY2tlZChhcnJheS5sZW5ndGgpIHwgMFxuICB0aGF0ID0gYWxsb2NhdGUodGhhdCwgbGVuZ3RoKVxuICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbmd0aDsgaSArPSAxKSB7XG4gICAgdGhhdFtpXSA9IGFycmF5W2ldICYgMjU1XG4gIH1cbiAgcmV0dXJuIHRoYXRcbn1cblxuLy8gRHVwbGljYXRlIG9mIGZyb21BcnJheSgpIHRvIGtlZXAgZnJvbUFycmF5KCkgbW9ub21vcnBoaWMuXG5mdW5jdGlvbiBmcm9tVHlwZWRBcnJheSAodGhhdCwgYXJyYXkpIHtcbiAgdmFyIGxlbmd0aCA9IGNoZWNrZWQoYXJyYXkubGVuZ3RoKSB8IDBcbiAgdGhhdCA9IGFsbG9jYXRlKHRoYXQsIGxlbmd0aClcbiAgLy8gVHJ1bmNhdGluZyB0aGUgZWxlbWVudHMgaXMgcHJvYmFibHkgbm90IHdoYXQgcGVvcGxlIGV4cGVjdCBmcm9tIHR5cGVkXG4gIC8vIGFycmF5cyB3aXRoIEJZVEVTX1BFUl9FTEVNRU5UID4gMSBidXQgaXQncyBjb21wYXRpYmxlIHdpdGggdGhlIGJlaGF2aW9yXG4gIC8vIG9mIHRoZSBvbGQgQnVmZmVyIGNvbnN0cnVjdG9yLlxuICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbmd0aDsgaSArPSAxKSB7XG4gICAgdGhhdFtpXSA9IGFycmF5W2ldICYgMjU1XG4gIH1cbiAgcmV0dXJuIHRoYXRcbn1cblxuZnVuY3Rpb24gZnJvbUFycmF5QnVmZmVyICh0aGF0LCBhcnJheSkge1xuICBhcnJheS5ieXRlTGVuZ3RoIC8vIHRoaXMgdGhyb3dzIGlmIGBhcnJheWAgaXMgbm90IGEgdmFsaWQgQXJyYXlCdWZmZXJcblxuICBpZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICAvLyBSZXR1cm4gYW4gYXVnbWVudGVkIGBVaW50OEFycmF5YCBpbnN0YW5jZSwgZm9yIGJlc3QgcGVyZm9ybWFuY2VcbiAgICB0aGF0ID0gbmV3IFVpbnQ4QXJyYXkoYXJyYXkpXG4gICAgdGhhdC5fX3Byb3RvX18gPSBCdWZmZXIucHJvdG90eXBlXG4gIH0gZWxzZSB7XG4gICAgLy8gRmFsbGJhY2s6IFJldHVybiBhbiBvYmplY3QgaW5zdGFuY2Ugb2YgdGhlIEJ1ZmZlciBjbGFzc1xuICAgIHRoYXQgPSBmcm9tVHlwZWRBcnJheSh0aGF0LCBuZXcgVWludDhBcnJheShhcnJheSkpXG4gIH1cbiAgcmV0dXJuIHRoYXRcbn1cblxuZnVuY3Rpb24gZnJvbUFycmF5TGlrZSAodGhhdCwgYXJyYXkpIHtcbiAgdmFyIGxlbmd0aCA9IGNoZWNrZWQoYXJyYXkubGVuZ3RoKSB8IDBcbiAgdGhhdCA9IGFsbG9jYXRlKHRoYXQsIGxlbmd0aClcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7IGkgKz0gMSkge1xuICAgIHRoYXRbaV0gPSBhcnJheVtpXSAmIDI1NVxuICB9XG4gIHJldHVybiB0aGF0XG59XG5cbi8vIERlc2VyaWFsaXplIHsgdHlwZTogJ0J1ZmZlcicsIGRhdGE6IFsxLDIsMywuLi5dIH0gaW50byBhIEJ1ZmZlciBvYmplY3QuXG4vLyBSZXR1cm5zIGEgemVyby1sZW5ndGggYnVmZmVyIGZvciBpbnB1dHMgdGhhdCBkb24ndCBjb25mb3JtIHRvIHRoZSBzcGVjLlxuZnVuY3Rpb24gZnJvbUpzb25PYmplY3QgKHRoYXQsIG9iamVjdCkge1xuICB2YXIgYXJyYXlcbiAgdmFyIGxlbmd0aCA9IDBcblxuICBpZiAob2JqZWN0LnR5cGUgPT09ICdCdWZmZXInICYmIGlzQXJyYXkob2JqZWN0LmRhdGEpKSB7XG4gICAgYXJyYXkgPSBvYmplY3QuZGF0YVxuICAgIGxlbmd0aCA9IGNoZWNrZWQoYXJyYXkubGVuZ3RoKSB8IDBcbiAgfVxuICB0aGF0ID0gYWxsb2NhdGUodGhhdCwgbGVuZ3RoKVxuXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuZ3RoOyBpICs9IDEpIHtcbiAgICB0aGF0W2ldID0gYXJyYXlbaV0gJiAyNTVcbiAgfVxuICByZXR1cm4gdGhhdFxufVxuXG5pZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgQnVmZmVyLnByb3RvdHlwZS5fX3Byb3RvX18gPSBVaW50OEFycmF5LnByb3RvdHlwZVxuICBCdWZmZXIuX19wcm90b19fID0gVWludDhBcnJheVxuICBpZiAodHlwZW9mIFN5bWJvbCAhPT0gJ3VuZGVmaW5lZCcgJiYgU3ltYm9sLnNwZWNpZXMgJiZcbiAgICAgIEJ1ZmZlcltTeW1ib2wuc3BlY2llc10gPT09IEJ1ZmZlcikge1xuICAgIC8vIEZpeCBzdWJhcnJheSgpIGluIEVTMjAxNi4gU2VlOiBodHRwczovL2dpdGh1Yi5jb20vZmVyb3NzL2J1ZmZlci9wdWxsLzk3XG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KEJ1ZmZlciwgU3ltYm9sLnNwZWNpZXMsIHtcbiAgICAgIHZhbHVlOiBudWxsLFxuICAgICAgY29uZmlndXJhYmxlOiB0cnVlXG4gICAgfSlcbiAgfVxufSBlbHNlIHtcbiAgLy8gcHJlLXNldCBmb3IgdmFsdWVzIHRoYXQgbWF5IGV4aXN0IGluIHRoZSBmdXR1cmVcbiAgQnVmZmVyLnByb3RvdHlwZS5sZW5ndGggPSB1bmRlZmluZWRcbiAgQnVmZmVyLnByb3RvdHlwZS5wYXJlbnQgPSB1bmRlZmluZWRcbn1cblxuZnVuY3Rpb24gYWxsb2NhdGUgKHRoYXQsIGxlbmd0aCkge1xuICBpZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICAvLyBSZXR1cm4gYW4gYXVnbWVudGVkIGBVaW50OEFycmF5YCBpbnN0YW5jZSwgZm9yIGJlc3QgcGVyZm9ybWFuY2VcbiAgICB0aGF0ID0gbmV3IFVpbnQ4QXJyYXkobGVuZ3RoKVxuICAgIHRoYXQuX19wcm90b19fID0gQnVmZmVyLnByb3RvdHlwZVxuICB9IGVsc2Uge1xuICAgIC8vIEZhbGxiYWNrOiBSZXR1cm4gYW4gb2JqZWN0IGluc3RhbmNlIG9mIHRoZSBCdWZmZXIgY2xhc3NcbiAgICB0aGF0Lmxlbmd0aCA9IGxlbmd0aFxuICB9XG5cbiAgdmFyIGZyb21Qb29sID0gbGVuZ3RoICE9PSAwICYmIGxlbmd0aCA8PSBCdWZmZXIucG9vbFNpemUgPj4+IDFcbiAgaWYgKGZyb21Qb29sKSB0aGF0LnBhcmVudCA9IHJvb3RQYXJlbnRcblxuICByZXR1cm4gdGhhdFxufVxuXG5mdW5jdGlvbiBjaGVja2VkIChsZW5ndGgpIHtcbiAgLy8gTm90ZTogY2Fubm90IHVzZSBgbGVuZ3RoIDwga01heExlbmd0aGAgaGVyZSBiZWNhdXNlIHRoYXQgZmFpbHMgd2hlblxuICAvLyBsZW5ndGggaXMgTmFOICh3aGljaCBpcyBvdGhlcndpc2UgY29lcmNlZCB0byB6ZXJvLilcbiAgaWYgKGxlbmd0aCA+PSBrTWF4TGVuZ3RoKCkpIHtcbiAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcignQXR0ZW1wdCB0byBhbGxvY2F0ZSBCdWZmZXIgbGFyZ2VyIHRoYW4gbWF4aW11bSAnICtcbiAgICAgICAgICAgICAgICAgICAgICAgICAnc2l6ZTogMHgnICsga01heExlbmd0aCgpLnRvU3RyaW5nKDE2KSArICcgYnl0ZXMnKVxuICB9XG4gIHJldHVybiBsZW5ndGggfCAwXG59XG5cbmZ1bmN0aW9uIFNsb3dCdWZmZXIgKHN1YmplY3QsIGVuY29kaW5nKSB7XG4gIGlmICghKHRoaXMgaW5zdGFuY2VvZiBTbG93QnVmZmVyKSkgcmV0dXJuIG5ldyBTbG93QnVmZmVyKHN1YmplY3QsIGVuY29kaW5nKVxuXG4gIHZhciBidWYgPSBuZXcgQnVmZmVyKHN1YmplY3QsIGVuY29kaW5nKVxuICBkZWxldGUgYnVmLnBhcmVudFxuICByZXR1cm4gYnVmXG59XG5cbkJ1ZmZlci5pc0J1ZmZlciA9IGZ1bmN0aW9uIGlzQnVmZmVyIChiKSB7XG4gIHJldHVybiAhIShiICE9IG51bGwgJiYgYi5faXNCdWZmZXIpXG59XG5cbkJ1ZmZlci5jb21wYXJlID0gZnVuY3Rpb24gY29tcGFyZSAoYSwgYikge1xuICBpZiAoIUJ1ZmZlci5pc0J1ZmZlcihhKSB8fCAhQnVmZmVyLmlzQnVmZmVyKGIpKSB7XG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcignQXJndW1lbnRzIG11c3QgYmUgQnVmZmVycycpXG4gIH1cblxuICBpZiAoYSA9PT0gYikgcmV0dXJuIDBcblxuICB2YXIgeCA9IGEubGVuZ3RoXG4gIHZhciB5ID0gYi5sZW5ndGhcblxuICBmb3IgKHZhciBpID0gMCwgbGVuID0gTWF0aC5taW4oeCwgeSk7IGkgPCBsZW47ICsraSkge1xuICAgIGlmIChhW2ldICE9PSBiW2ldKSB7XG4gICAgICB4ID0gYVtpXVxuICAgICAgeSA9IGJbaV1cbiAgICAgIGJyZWFrXG4gICAgfVxuICB9XG5cbiAgaWYgKHggPCB5KSByZXR1cm4gLTFcbiAgaWYgKHkgPCB4KSByZXR1cm4gMVxuICByZXR1cm4gMFxufVxuXG5CdWZmZXIuaXNFbmNvZGluZyA9IGZ1bmN0aW9uIGlzRW5jb2RpbmcgKGVuY29kaW5nKSB7XG4gIHN3aXRjaCAoU3RyaW5nKGVuY29kaW5nKS50b0xvd2VyQ2FzZSgpKSB7XG4gICAgY2FzZSAnaGV4JzpcbiAgICBjYXNlICd1dGY4JzpcbiAgICBjYXNlICd1dGYtOCc6XG4gICAgY2FzZSAnYXNjaWknOlxuICAgIGNhc2UgJ2JpbmFyeSc6XG4gICAgY2FzZSAnYmFzZTY0JzpcbiAgICBjYXNlICdyYXcnOlxuICAgIGNhc2UgJ3VjczInOlxuICAgIGNhc2UgJ3Vjcy0yJzpcbiAgICBjYXNlICd1dGYxNmxlJzpcbiAgICBjYXNlICd1dGYtMTZsZSc6XG4gICAgICByZXR1cm4gdHJ1ZVxuICAgIGRlZmF1bHQ6XG4gICAgICByZXR1cm4gZmFsc2VcbiAgfVxufVxuXG5CdWZmZXIuY29uY2F0ID0gZnVuY3Rpb24gY29uY2F0IChsaXN0LCBsZW5ndGgpIHtcbiAgaWYgKCFpc0FycmF5KGxpc3QpKSB0aHJvdyBuZXcgVHlwZUVycm9yKCdsaXN0IGFyZ3VtZW50IG11c3QgYmUgYW4gQXJyYXkgb2YgQnVmZmVycy4nKVxuXG4gIGlmIChsaXN0Lmxlbmd0aCA9PT0gMCkge1xuICAgIHJldHVybiBuZXcgQnVmZmVyKDApXG4gIH1cblxuICB2YXIgaVxuICBpZiAobGVuZ3RoID09PSB1bmRlZmluZWQpIHtcbiAgICBsZW5ndGggPSAwXG4gICAgZm9yIChpID0gMDsgaSA8IGxpc3QubGVuZ3RoOyBpKyspIHtcbiAgICAgIGxlbmd0aCArPSBsaXN0W2ldLmxlbmd0aFxuICAgIH1cbiAgfVxuXG4gIHZhciBidWYgPSBuZXcgQnVmZmVyKGxlbmd0aClcbiAgdmFyIHBvcyA9IDBcbiAgZm9yIChpID0gMDsgaSA8IGxpc3QubGVuZ3RoOyBpKyspIHtcbiAgICB2YXIgaXRlbSA9IGxpc3RbaV1cbiAgICBpdGVtLmNvcHkoYnVmLCBwb3MpXG4gICAgcG9zICs9IGl0ZW0ubGVuZ3RoXG4gIH1cbiAgcmV0dXJuIGJ1ZlxufVxuXG5mdW5jdGlvbiBieXRlTGVuZ3RoIChzdHJpbmcsIGVuY29kaW5nKSB7XG4gIGlmICh0eXBlb2Ygc3RyaW5nICE9PSAnc3RyaW5nJykgc3RyaW5nID0gJycgKyBzdHJpbmdcblxuICB2YXIgbGVuID0gc3RyaW5nLmxlbmd0aFxuICBpZiAobGVuID09PSAwKSByZXR1cm4gMFxuXG4gIC8vIFVzZSBhIGZvciBsb29wIHRvIGF2b2lkIHJlY3Vyc2lvblxuICB2YXIgbG93ZXJlZENhc2UgPSBmYWxzZVxuICBmb3IgKDs7KSB7XG4gICAgc3dpdGNoIChlbmNvZGluZykge1xuICAgICAgY2FzZSAnYXNjaWknOlxuICAgICAgY2FzZSAnYmluYXJ5JzpcbiAgICAgIC8vIERlcHJlY2F0ZWRcbiAgICAgIGNhc2UgJ3Jhdyc6XG4gICAgICBjYXNlICdyYXdzJzpcbiAgICAgICAgcmV0dXJuIGxlblxuICAgICAgY2FzZSAndXRmOCc6XG4gICAgICBjYXNlICd1dGYtOCc6XG4gICAgICAgIHJldHVybiB1dGY4VG9CeXRlcyhzdHJpbmcpLmxlbmd0aFxuICAgICAgY2FzZSAndWNzMic6XG4gICAgICBjYXNlICd1Y3MtMic6XG4gICAgICBjYXNlICd1dGYxNmxlJzpcbiAgICAgIGNhc2UgJ3V0Zi0xNmxlJzpcbiAgICAgICAgcmV0dXJuIGxlbiAqIDJcbiAgICAgIGNhc2UgJ2hleCc6XG4gICAgICAgIHJldHVybiBsZW4gPj4+IDFcbiAgICAgIGNhc2UgJ2Jhc2U2NCc6XG4gICAgICAgIHJldHVybiBiYXNlNjRUb0J5dGVzKHN0cmluZykubGVuZ3RoXG4gICAgICBkZWZhdWx0OlxuICAgICAgICBpZiAobG93ZXJlZENhc2UpIHJldHVybiB1dGY4VG9CeXRlcyhzdHJpbmcpLmxlbmd0aCAvLyBhc3N1bWUgdXRmOFxuICAgICAgICBlbmNvZGluZyA9ICgnJyArIGVuY29kaW5nKS50b0xvd2VyQ2FzZSgpXG4gICAgICAgIGxvd2VyZWRDYXNlID0gdHJ1ZVxuICAgIH1cbiAgfVxufVxuQnVmZmVyLmJ5dGVMZW5ndGggPSBieXRlTGVuZ3RoXG5cbmZ1bmN0aW9uIHNsb3dUb1N0cmluZyAoZW5jb2RpbmcsIHN0YXJ0LCBlbmQpIHtcbiAgdmFyIGxvd2VyZWRDYXNlID0gZmFsc2VcblxuICBzdGFydCA9IHN0YXJ0IHwgMFxuICBlbmQgPSBlbmQgPT09IHVuZGVmaW5lZCB8fCBlbmQgPT09IEluZmluaXR5ID8gdGhpcy5sZW5ndGggOiBlbmQgfCAwXG5cbiAgaWYgKCFlbmNvZGluZykgZW5jb2RpbmcgPSAndXRmOCdcbiAgaWYgKHN0YXJ0IDwgMCkgc3RhcnQgPSAwXG4gIGlmIChlbmQgPiB0aGlzLmxlbmd0aCkgZW5kID0gdGhpcy5sZW5ndGhcbiAgaWYgKGVuZCA8PSBzdGFydCkgcmV0dXJuICcnXG5cbiAgd2hpbGUgKHRydWUpIHtcbiAgICBzd2l0Y2ggKGVuY29kaW5nKSB7XG4gICAgICBjYXNlICdoZXgnOlxuICAgICAgICByZXR1cm4gaGV4U2xpY2UodGhpcywgc3RhcnQsIGVuZClcblxuICAgICAgY2FzZSAndXRmOCc6XG4gICAgICBjYXNlICd1dGYtOCc6XG4gICAgICAgIHJldHVybiB1dGY4U2xpY2UodGhpcywgc3RhcnQsIGVuZClcblxuICAgICAgY2FzZSAnYXNjaWknOlxuICAgICAgICByZXR1cm4gYXNjaWlTbGljZSh0aGlzLCBzdGFydCwgZW5kKVxuXG4gICAgICBjYXNlICdiaW5hcnknOlxuICAgICAgICByZXR1cm4gYmluYXJ5U2xpY2UodGhpcywgc3RhcnQsIGVuZClcblxuICAgICAgY2FzZSAnYmFzZTY0JzpcbiAgICAgICAgcmV0dXJuIGJhc2U2NFNsaWNlKHRoaXMsIHN0YXJ0LCBlbmQpXG5cbiAgICAgIGNhc2UgJ3VjczInOlxuICAgICAgY2FzZSAndWNzLTInOlxuICAgICAgY2FzZSAndXRmMTZsZSc6XG4gICAgICBjYXNlICd1dGYtMTZsZSc6XG4gICAgICAgIHJldHVybiB1dGYxNmxlU2xpY2UodGhpcywgc3RhcnQsIGVuZClcblxuICAgICAgZGVmYXVsdDpcbiAgICAgICAgaWYgKGxvd2VyZWRDYXNlKSB0aHJvdyBuZXcgVHlwZUVycm9yKCdVbmtub3duIGVuY29kaW5nOiAnICsgZW5jb2RpbmcpXG4gICAgICAgIGVuY29kaW5nID0gKGVuY29kaW5nICsgJycpLnRvTG93ZXJDYXNlKClcbiAgICAgICAgbG93ZXJlZENhc2UgPSB0cnVlXG4gICAgfVxuICB9XG59XG5cbi8vIFRoZSBwcm9wZXJ0eSBpcyB1c2VkIGJ5IGBCdWZmZXIuaXNCdWZmZXJgIGFuZCBgaXMtYnVmZmVyYCAoaW4gU2FmYXJpIDUtNykgdG8gZGV0ZWN0XG4vLyBCdWZmZXIgaW5zdGFuY2VzLlxuQnVmZmVyLnByb3RvdHlwZS5faXNCdWZmZXIgPSB0cnVlXG5cbkJ1ZmZlci5wcm90b3R5cGUudG9TdHJpbmcgPSBmdW5jdGlvbiB0b1N0cmluZyAoKSB7XG4gIHZhciBsZW5ndGggPSB0aGlzLmxlbmd0aCB8IDBcbiAgaWYgKGxlbmd0aCA9PT0gMCkgcmV0dXJuICcnXG4gIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAwKSByZXR1cm4gdXRmOFNsaWNlKHRoaXMsIDAsIGxlbmd0aClcbiAgcmV0dXJuIHNsb3dUb1N0cmluZy5hcHBseSh0aGlzLCBhcmd1bWVudHMpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUuZXF1YWxzID0gZnVuY3Rpb24gZXF1YWxzIChiKSB7XG4gIGlmICghQnVmZmVyLmlzQnVmZmVyKGIpKSB0aHJvdyBuZXcgVHlwZUVycm9yKCdBcmd1bWVudCBtdXN0IGJlIGEgQnVmZmVyJylcbiAgaWYgKHRoaXMgPT09IGIpIHJldHVybiB0cnVlXG4gIHJldHVybiBCdWZmZXIuY29tcGFyZSh0aGlzLCBiKSA9PT0gMFxufVxuXG5CdWZmZXIucHJvdG90eXBlLmluc3BlY3QgPSBmdW5jdGlvbiBpbnNwZWN0ICgpIHtcbiAgdmFyIHN0ciA9ICcnXG4gIHZhciBtYXggPSBleHBvcnRzLklOU1BFQ1RfTUFYX0JZVEVTXG4gIGlmICh0aGlzLmxlbmd0aCA+IDApIHtcbiAgICBzdHIgPSB0aGlzLnRvU3RyaW5nKCdoZXgnLCAwLCBtYXgpLm1hdGNoKC8uezJ9L2cpLmpvaW4oJyAnKVxuICAgIGlmICh0aGlzLmxlbmd0aCA+IG1heCkgc3RyICs9ICcgLi4uICdcbiAgfVxuICByZXR1cm4gJzxCdWZmZXIgJyArIHN0ciArICc+J1xufVxuXG5CdWZmZXIucHJvdG90eXBlLmNvbXBhcmUgPSBmdW5jdGlvbiBjb21wYXJlIChiKSB7XG4gIGlmICghQnVmZmVyLmlzQnVmZmVyKGIpKSB0aHJvdyBuZXcgVHlwZUVycm9yKCdBcmd1bWVudCBtdXN0IGJlIGEgQnVmZmVyJylcbiAgcmV0dXJuIEJ1ZmZlci5jb21wYXJlKHRoaXMsIGIpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUuaW5kZXhPZiA9IGZ1bmN0aW9uIGluZGV4T2YgKHZhbCwgYnl0ZU9mZnNldCkge1xuICBpZiAoYnl0ZU9mZnNldCA+IDB4N2ZmZmZmZmYpIGJ5dGVPZmZzZXQgPSAweDdmZmZmZmZmXG4gIGVsc2UgaWYgKGJ5dGVPZmZzZXQgPCAtMHg4MDAwMDAwMCkgYnl0ZU9mZnNldCA9IC0weDgwMDAwMDAwXG4gIGJ5dGVPZmZzZXQgPj49IDBcblxuICBpZiAodGhpcy5sZW5ndGggPT09IDApIHJldHVybiAtMVxuICBpZiAoYnl0ZU9mZnNldCA+PSB0aGlzLmxlbmd0aCkgcmV0dXJuIC0xXG5cbiAgLy8gTmVnYXRpdmUgb2Zmc2V0cyBzdGFydCBmcm9tIHRoZSBlbmQgb2YgdGhlIGJ1ZmZlclxuICBpZiAoYnl0ZU9mZnNldCA8IDApIGJ5dGVPZmZzZXQgPSBNYXRoLm1heCh0aGlzLmxlbmd0aCArIGJ5dGVPZmZzZXQsIDApXG5cbiAgaWYgKHR5cGVvZiB2YWwgPT09ICdzdHJpbmcnKSB7XG4gICAgaWYgKHZhbC5sZW5ndGggPT09IDApIHJldHVybiAtMSAvLyBzcGVjaWFsIGNhc2U6IGxvb2tpbmcgZm9yIGVtcHR5IHN0cmluZyBhbHdheXMgZmFpbHNcbiAgICByZXR1cm4gU3RyaW5nLnByb3RvdHlwZS5pbmRleE9mLmNhbGwodGhpcywgdmFsLCBieXRlT2Zmc2V0KVxuICB9XG4gIGlmIChCdWZmZXIuaXNCdWZmZXIodmFsKSkge1xuICAgIHJldHVybiBhcnJheUluZGV4T2YodGhpcywgdmFsLCBieXRlT2Zmc2V0KVxuICB9XG4gIGlmICh0eXBlb2YgdmFsID09PSAnbnVtYmVyJykge1xuICAgIGlmIChCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCAmJiBVaW50OEFycmF5LnByb3RvdHlwZS5pbmRleE9mID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICByZXR1cm4gVWludDhBcnJheS5wcm90b3R5cGUuaW5kZXhPZi5jYWxsKHRoaXMsIHZhbCwgYnl0ZU9mZnNldClcbiAgICB9XG4gICAgcmV0dXJuIGFycmF5SW5kZXhPZih0aGlzLCBbIHZhbCBdLCBieXRlT2Zmc2V0KVxuICB9XG5cbiAgZnVuY3Rpb24gYXJyYXlJbmRleE9mIChhcnIsIHZhbCwgYnl0ZU9mZnNldCkge1xuICAgIHZhciBmb3VuZEluZGV4ID0gLTFcbiAgICBmb3IgKHZhciBpID0gMDsgYnl0ZU9mZnNldCArIGkgPCBhcnIubGVuZ3RoOyBpKyspIHtcbiAgICAgIGlmIChhcnJbYnl0ZU9mZnNldCArIGldID09PSB2YWxbZm91bmRJbmRleCA9PT0gLTEgPyAwIDogaSAtIGZvdW5kSW5kZXhdKSB7XG4gICAgICAgIGlmIChmb3VuZEluZGV4ID09PSAtMSkgZm91bmRJbmRleCA9IGlcbiAgICAgICAgaWYgKGkgLSBmb3VuZEluZGV4ICsgMSA9PT0gdmFsLmxlbmd0aCkgcmV0dXJuIGJ5dGVPZmZzZXQgKyBmb3VuZEluZGV4XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBmb3VuZEluZGV4ID0gLTFcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIC0xXG4gIH1cblxuICB0aHJvdyBuZXcgVHlwZUVycm9yKCd2YWwgbXVzdCBiZSBzdHJpbmcsIG51bWJlciBvciBCdWZmZXInKVxufVxuXG5mdW5jdGlvbiBoZXhXcml0ZSAoYnVmLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKSB7XG4gIG9mZnNldCA9IE51bWJlcihvZmZzZXQpIHx8IDBcbiAgdmFyIHJlbWFpbmluZyA9IGJ1Zi5sZW5ndGggLSBvZmZzZXRcbiAgaWYgKCFsZW5ndGgpIHtcbiAgICBsZW5ndGggPSByZW1haW5pbmdcbiAgfSBlbHNlIHtcbiAgICBsZW5ndGggPSBOdW1iZXIobGVuZ3RoKVxuICAgIGlmIChsZW5ndGggPiByZW1haW5pbmcpIHtcbiAgICAgIGxlbmd0aCA9IHJlbWFpbmluZ1xuICAgIH1cbiAgfVxuXG4gIC8vIG11c3QgYmUgYW4gZXZlbiBudW1iZXIgb2YgZGlnaXRzXG4gIHZhciBzdHJMZW4gPSBzdHJpbmcubGVuZ3RoXG4gIGlmIChzdHJMZW4gJSAyICE9PSAwKSB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgaGV4IHN0cmluZycpXG5cbiAgaWYgKGxlbmd0aCA+IHN0ckxlbiAvIDIpIHtcbiAgICBsZW5ndGggPSBzdHJMZW4gLyAyXG4gIH1cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgIHZhciBwYXJzZWQgPSBwYXJzZUludChzdHJpbmcuc3Vic3RyKGkgKiAyLCAyKSwgMTYpXG4gICAgaWYgKGlzTmFOKHBhcnNlZCkpIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBoZXggc3RyaW5nJylcbiAgICBidWZbb2Zmc2V0ICsgaV0gPSBwYXJzZWRcbiAgfVxuICByZXR1cm4gaVxufVxuXG5mdW5jdGlvbiB1dGY4V3JpdGUgKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCkge1xuICByZXR1cm4gYmxpdEJ1ZmZlcih1dGY4VG9CeXRlcyhzdHJpbmcsIGJ1Zi5sZW5ndGggLSBvZmZzZXQpLCBidWYsIG9mZnNldCwgbGVuZ3RoKVxufVxuXG5mdW5jdGlvbiBhc2NpaVdyaXRlIChidWYsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpIHtcbiAgcmV0dXJuIGJsaXRCdWZmZXIoYXNjaWlUb0J5dGVzKHN0cmluZyksIGJ1Ziwgb2Zmc2V0LCBsZW5ndGgpXG59XG5cbmZ1bmN0aW9uIGJpbmFyeVdyaXRlIChidWYsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpIHtcbiAgcmV0dXJuIGFzY2lpV3JpdGUoYnVmLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxufVxuXG5mdW5jdGlvbiBiYXNlNjRXcml0ZSAoYnVmLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKSB7XG4gIHJldHVybiBibGl0QnVmZmVyKGJhc2U2NFRvQnl0ZXMoc3RyaW5nKSwgYnVmLCBvZmZzZXQsIGxlbmd0aClcbn1cblxuZnVuY3Rpb24gdWNzMldyaXRlIChidWYsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpIHtcbiAgcmV0dXJuIGJsaXRCdWZmZXIodXRmMTZsZVRvQnl0ZXMoc3RyaW5nLCBidWYubGVuZ3RoIC0gb2Zmc2V0KSwgYnVmLCBvZmZzZXQsIGxlbmd0aClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZSA9IGZ1bmN0aW9uIHdyaXRlIChzdHJpbmcsIG9mZnNldCwgbGVuZ3RoLCBlbmNvZGluZykge1xuICAvLyBCdWZmZXIjd3JpdGUoc3RyaW5nKVxuICBpZiAob2Zmc2V0ID09PSB1bmRlZmluZWQpIHtcbiAgICBlbmNvZGluZyA9ICd1dGY4J1xuICAgIGxlbmd0aCA9IHRoaXMubGVuZ3RoXG4gICAgb2Zmc2V0ID0gMFxuICAvLyBCdWZmZXIjd3JpdGUoc3RyaW5nLCBlbmNvZGluZylcbiAgfSBlbHNlIGlmIChsZW5ndGggPT09IHVuZGVmaW5lZCAmJiB0eXBlb2Ygb2Zmc2V0ID09PSAnc3RyaW5nJykge1xuICAgIGVuY29kaW5nID0gb2Zmc2V0XG4gICAgbGVuZ3RoID0gdGhpcy5sZW5ndGhcbiAgICBvZmZzZXQgPSAwXG4gIC8vIEJ1ZmZlciN3cml0ZShzdHJpbmcsIG9mZnNldFssIGxlbmd0aF1bLCBlbmNvZGluZ10pXG4gIH0gZWxzZSBpZiAoaXNGaW5pdGUob2Zmc2V0KSkge1xuICAgIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgICBpZiAoaXNGaW5pdGUobGVuZ3RoKSkge1xuICAgICAgbGVuZ3RoID0gbGVuZ3RoIHwgMFxuICAgICAgaWYgKGVuY29kaW5nID09PSB1bmRlZmluZWQpIGVuY29kaW5nID0gJ3V0ZjgnXG4gICAgfSBlbHNlIHtcbiAgICAgIGVuY29kaW5nID0gbGVuZ3RoXG4gICAgICBsZW5ndGggPSB1bmRlZmluZWRcbiAgICB9XG4gIC8vIGxlZ2FjeSB3cml0ZShzdHJpbmcsIGVuY29kaW5nLCBvZmZzZXQsIGxlbmd0aCkgLSByZW1vdmUgaW4gdjAuMTNcbiAgfSBlbHNlIHtcbiAgICB2YXIgc3dhcCA9IGVuY29kaW5nXG4gICAgZW5jb2RpbmcgPSBvZmZzZXRcbiAgICBvZmZzZXQgPSBsZW5ndGggfCAwXG4gICAgbGVuZ3RoID0gc3dhcFxuICB9XG5cbiAgdmFyIHJlbWFpbmluZyA9IHRoaXMubGVuZ3RoIC0gb2Zmc2V0XG4gIGlmIChsZW5ndGggPT09IHVuZGVmaW5lZCB8fCBsZW5ndGggPiByZW1haW5pbmcpIGxlbmd0aCA9IHJlbWFpbmluZ1xuXG4gIGlmICgoc3RyaW5nLmxlbmd0aCA+IDAgJiYgKGxlbmd0aCA8IDAgfHwgb2Zmc2V0IDwgMCkpIHx8IG9mZnNldCA+IHRoaXMubGVuZ3RoKSB7XG4gICAgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ2F0dGVtcHQgdG8gd3JpdGUgb3V0c2lkZSBidWZmZXIgYm91bmRzJylcbiAgfVxuXG4gIGlmICghZW5jb2RpbmcpIGVuY29kaW5nID0gJ3V0ZjgnXG5cbiAgdmFyIGxvd2VyZWRDYXNlID0gZmFsc2VcbiAgZm9yICg7Oykge1xuICAgIHN3aXRjaCAoZW5jb2RpbmcpIHtcbiAgICAgIGNhc2UgJ2hleCc6XG4gICAgICAgIHJldHVybiBoZXhXcml0ZSh0aGlzLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxuXG4gICAgICBjYXNlICd1dGY4JzpcbiAgICAgIGNhc2UgJ3V0Zi04JzpcbiAgICAgICAgcmV0dXJuIHV0ZjhXcml0ZSh0aGlzLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxuXG4gICAgICBjYXNlICdhc2NpaSc6XG4gICAgICAgIHJldHVybiBhc2NpaVdyaXRlKHRoaXMsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpXG5cbiAgICAgIGNhc2UgJ2JpbmFyeSc6XG4gICAgICAgIHJldHVybiBiaW5hcnlXcml0ZSh0aGlzLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxuXG4gICAgICBjYXNlICdiYXNlNjQnOlxuICAgICAgICAvLyBXYXJuaW5nOiBtYXhMZW5ndGggbm90IHRha2VuIGludG8gYWNjb3VudCBpbiBiYXNlNjRXcml0ZVxuICAgICAgICByZXR1cm4gYmFzZTY0V3JpdGUodGhpcywgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aClcblxuICAgICAgY2FzZSAndWNzMic6XG4gICAgICBjYXNlICd1Y3MtMic6XG4gICAgICBjYXNlICd1dGYxNmxlJzpcbiAgICAgIGNhc2UgJ3V0Zi0xNmxlJzpcbiAgICAgICAgcmV0dXJuIHVjczJXcml0ZSh0aGlzLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxuXG4gICAgICBkZWZhdWx0OlxuICAgICAgICBpZiAobG93ZXJlZENhc2UpIHRocm93IG5ldyBUeXBlRXJyb3IoJ1Vua25vd24gZW5jb2Rpbmc6ICcgKyBlbmNvZGluZylcbiAgICAgICAgZW5jb2RpbmcgPSAoJycgKyBlbmNvZGluZykudG9Mb3dlckNhc2UoKVxuICAgICAgICBsb3dlcmVkQ2FzZSA9IHRydWVcbiAgICB9XG4gIH1cbn1cblxuQnVmZmVyLnByb3RvdHlwZS50b0pTT04gPSBmdW5jdGlvbiB0b0pTT04gKCkge1xuICByZXR1cm4ge1xuICAgIHR5cGU6ICdCdWZmZXInLFxuICAgIGRhdGE6IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKHRoaXMuX2FyciB8fCB0aGlzLCAwKVxuICB9XG59XG5cbmZ1bmN0aW9uIGJhc2U2NFNsaWNlIChidWYsIHN0YXJ0LCBlbmQpIHtcbiAgaWYgKHN0YXJ0ID09PSAwICYmIGVuZCA9PT0gYnVmLmxlbmd0aCkge1xuICAgIHJldHVybiBiYXNlNjQuZnJvbUJ5dGVBcnJheShidWYpXG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIGJhc2U2NC5mcm9tQnl0ZUFycmF5KGJ1Zi5zbGljZShzdGFydCwgZW5kKSlcbiAgfVxufVxuXG5mdW5jdGlvbiB1dGY4U2xpY2UgKGJ1Ziwgc3RhcnQsIGVuZCkge1xuICBlbmQgPSBNYXRoLm1pbihidWYubGVuZ3RoLCBlbmQpXG4gIHZhciByZXMgPSBbXVxuXG4gIHZhciBpID0gc3RhcnRcbiAgd2hpbGUgKGkgPCBlbmQpIHtcbiAgICB2YXIgZmlyc3RCeXRlID0gYnVmW2ldXG4gICAgdmFyIGNvZGVQb2ludCA9IG51bGxcbiAgICB2YXIgYnl0ZXNQZXJTZXF1ZW5jZSA9IChmaXJzdEJ5dGUgPiAweEVGKSA/IDRcbiAgICAgIDogKGZpcnN0Qnl0ZSA+IDB4REYpID8gM1xuICAgICAgOiAoZmlyc3RCeXRlID4gMHhCRikgPyAyXG4gICAgICA6IDFcblxuICAgIGlmIChpICsgYnl0ZXNQZXJTZXF1ZW5jZSA8PSBlbmQpIHtcbiAgICAgIHZhciBzZWNvbmRCeXRlLCB0aGlyZEJ5dGUsIGZvdXJ0aEJ5dGUsIHRlbXBDb2RlUG9pbnRcblxuICAgICAgc3dpdGNoIChieXRlc1BlclNlcXVlbmNlKSB7XG4gICAgICAgIGNhc2UgMTpcbiAgICAgICAgICBpZiAoZmlyc3RCeXRlIDwgMHg4MCkge1xuICAgICAgICAgICAgY29kZVBvaW50ID0gZmlyc3RCeXRlXG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrXG4gICAgICAgIGNhc2UgMjpcbiAgICAgICAgICBzZWNvbmRCeXRlID0gYnVmW2kgKyAxXVxuICAgICAgICAgIGlmICgoc2Vjb25kQnl0ZSAmIDB4QzApID09PSAweDgwKSB7XG4gICAgICAgICAgICB0ZW1wQ29kZVBvaW50ID0gKGZpcnN0Qnl0ZSAmIDB4MUYpIDw8IDB4NiB8IChzZWNvbmRCeXRlICYgMHgzRilcbiAgICAgICAgICAgIGlmICh0ZW1wQ29kZVBvaW50ID4gMHg3Rikge1xuICAgICAgICAgICAgICBjb2RlUG9pbnQgPSB0ZW1wQ29kZVBvaW50XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrXG4gICAgICAgIGNhc2UgMzpcbiAgICAgICAgICBzZWNvbmRCeXRlID0gYnVmW2kgKyAxXVxuICAgICAgICAgIHRoaXJkQnl0ZSA9IGJ1ZltpICsgMl1cbiAgICAgICAgICBpZiAoKHNlY29uZEJ5dGUgJiAweEMwKSA9PT0gMHg4MCAmJiAodGhpcmRCeXRlICYgMHhDMCkgPT09IDB4ODApIHtcbiAgICAgICAgICAgIHRlbXBDb2RlUG9pbnQgPSAoZmlyc3RCeXRlICYgMHhGKSA8PCAweEMgfCAoc2Vjb25kQnl0ZSAmIDB4M0YpIDw8IDB4NiB8ICh0aGlyZEJ5dGUgJiAweDNGKVxuICAgICAgICAgICAgaWYgKHRlbXBDb2RlUG9pbnQgPiAweDdGRiAmJiAodGVtcENvZGVQb2ludCA8IDB4RDgwMCB8fCB0ZW1wQ29kZVBvaW50ID4gMHhERkZGKSkge1xuICAgICAgICAgICAgICBjb2RlUG9pbnQgPSB0ZW1wQ29kZVBvaW50XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrXG4gICAgICAgIGNhc2UgNDpcbiAgICAgICAgICBzZWNvbmRCeXRlID0gYnVmW2kgKyAxXVxuICAgICAgICAgIHRoaXJkQnl0ZSA9IGJ1ZltpICsgMl1cbiAgICAgICAgICBmb3VydGhCeXRlID0gYnVmW2kgKyAzXVxuICAgICAgICAgIGlmICgoc2Vjb25kQnl0ZSAmIDB4QzApID09PSAweDgwICYmICh0aGlyZEJ5dGUgJiAweEMwKSA9PT0gMHg4MCAmJiAoZm91cnRoQnl0ZSAmIDB4QzApID09PSAweDgwKSB7XG4gICAgICAgICAgICB0ZW1wQ29kZVBvaW50ID0gKGZpcnN0Qnl0ZSAmIDB4RikgPDwgMHgxMiB8IChzZWNvbmRCeXRlICYgMHgzRikgPDwgMHhDIHwgKHRoaXJkQnl0ZSAmIDB4M0YpIDw8IDB4NiB8IChmb3VydGhCeXRlICYgMHgzRilcbiAgICAgICAgICAgIGlmICh0ZW1wQ29kZVBvaW50ID4gMHhGRkZGICYmIHRlbXBDb2RlUG9pbnQgPCAweDExMDAwMCkge1xuICAgICAgICAgICAgICBjb2RlUG9pbnQgPSB0ZW1wQ29kZVBvaW50XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChjb2RlUG9pbnQgPT09IG51bGwpIHtcbiAgICAgIC8vIHdlIGRpZCBub3QgZ2VuZXJhdGUgYSB2YWxpZCBjb2RlUG9pbnQgc28gaW5zZXJ0IGFcbiAgICAgIC8vIHJlcGxhY2VtZW50IGNoYXIgKFUrRkZGRCkgYW5kIGFkdmFuY2Ugb25seSAxIGJ5dGVcbiAgICAgIGNvZGVQb2ludCA9IDB4RkZGRFxuICAgICAgYnl0ZXNQZXJTZXF1ZW5jZSA9IDFcbiAgICB9IGVsc2UgaWYgKGNvZGVQb2ludCA+IDB4RkZGRikge1xuICAgICAgLy8gZW5jb2RlIHRvIHV0ZjE2IChzdXJyb2dhdGUgcGFpciBkYW5jZSlcbiAgICAgIGNvZGVQb2ludCAtPSAweDEwMDAwXG4gICAgICByZXMucHVzaChjb2RlUG9pbnQgPj4+IDEwICYgMHgzRkYgfCAweEQ4MDApXG4gICAgICBjb2RlUG9pbnQgPSAweERDMDAgfCBjb2RlUG9pbnQgJiAweDNGRlxuICAgIH1cblxuICAgIHJlcy5wdXNoKGNvZGVQb2ludClcbiAgICBpICs9IGJ5dGVzUGVyU2VxdWVuY2VcbiAgfVxuXG4gIHJldHVybiBkZWNvZGVDb2RlUG9pbnRzQXJyYXkocmVzKVxufVxuXG4vLyBCYXNlZCBvbiBodHRwOi8vc3RhY2tvdmVyZmxvdy5jb20vYS8yMjc0NzI3Mi82ODA3NDIsIHRoZSBicm93c2VyIHdpdGhcbi8vIHRoZSBsb3dlc3QgbGltaXQgaXMgQ2hyb21lLCB3aXRoIDB4MTAwMDAgYXJncy5cbi8vIFdlIGdvIDEgbWFnbml0dWRlIGxlc3MsIGZvciBzYWZldHlcbnZhciBNQVhfQVJHVU1FTlRTX0xFTkdUSCA9IDB4MTAwMFxuXG5mdW5jdGlvbiBkZWNvZGVDb2RlUG9pbnRzQXJyYXkgKGNvZGVQb2ludHMpIHtcbiAgdmFyIGxlbiA9IGNvZGVQb2ludHMubGVuZ3RoXG4gIGlmIChsZW4gPD0gTUFYX0FSR1VNRU5UU19MRU5HVEgpIHtcbiAgICByZXR1cm4gU3RyaW5nLmZyb21DaGFyQ29kZS5hcHBseShTdHJpbmcsIGNvZGVQb2ludHMpIC8vIGF2b2lkIGV4dHJhIHNsaWNlKClcbiAgfVxuXG4gIC8vIERlY29kZSBpbiBjaHVua3MgdG8gYXZvaWQgXCJjYWxsIHN0YWNrIHNpemUgZXhjZWVkZWRcIi5cbiAgdmFyIHJlcyA9ICcnXG4gIHZhciBpID0gMFxuICB3aGlsZSAoaSA8IGxlbikge1xuICAgIHJlcyArPSBTdHJpbmcuZnJvbUNoYXJDb2RlLmFwcGx5KFxuICAgICAgU3RyaW5nLFxuICAgICAgY29kZVBvaW50cy5zbGljZShpLCBpICs9IE1BWF9BUkdVTUVOVFNfTEVOR1RIKVxuICAgIClcbiAgfVxuICByZXR1cm4gcmVzXG59XG5cbmZ1bmN0aW9uIGFzY2lpU2xpY2UgKGJ1Ziwgc3RhcnQsIGVuZCkge1xuICB2YXIgcmV0ID0gJydcbiAgZW5kID0gTWF0aC5taW4oYnVmLmxlbmd0aCwgZW5kKVxuXG4gIGZvciAodmFyIGkgPSBzdGFydDsgaSA8IGVuZDsgaSsrKSB7XG4gICAgcmV0ICs9IFN0cmluZy5mcm9tQ2hhckNvZGUoYnVmW2ldICYgMHg3RilcbiAgfVxuICByZXR1cm4gcmV0XG59XG5cbmZ1bmN0aW9uIGJpbmFyeVNsaWNlIChidWYsIHN0YXJ0LCBlbmQpIHtcbiAgdmFyIHJldCA9ICcnXG4gIGVuZCA9IE1hdGgubWluKGJ1Zi5sZW5ndGgsIGVuZClcblxuICBmb3IgKHZhciBpID0gc3RhcnQ7IGkgPCBlbmQ7IGkrKykge1xuICAgIHJldCArPSBTdHJpbmcuZnJvbUNoYXJDb2RlKGJ1ZltpXSlcbiAgfVxuICByZXR1cm4gcmV0XG59XG5cbmZ1bmN0aW9uIGhleFNsaWNlIChidWYsIHN0YXJ0LCBlbmQpIHtcbiAgdmFyIGxlbiA9IGJ1Zi5sZW5ndGhcblxuICBpZiAoIXN0YXJ0IHx8IHN0YXJ0IDwgMCkgc3RhcnQgPSAwXG4gIGlmICghZW5kIHx8IGVuZCA8IDAgfHwgZW5kID4gbGVuKSBlbmQgPSBsZW5cblxuICB2YXIgb3V0ID0gJydcbiAgZm9yICh2YXIgaSA9IHN0YXJ0OyBpIDwgZW5kOyBpKyspIHtcbiAgICBvdXQgKz0gdG9IZXgoYnVmW2ldKVxuICB9XG4gIHJldHVybiBvdXRcbn1cblxuZnVuY3Rpb24gdXRmMTZsZVNsaWNlIChidWYsIHN0YXJ0LCBlbmQpIHtcbiAgdmFyIGJ5dGVzID0gYnVmLnNsaWNlKHN0YXJ0LCBlbmQpXG4gIHZhciByZXMgPSAnJ1xuICBmb3IgKHZhciBpID0gMDsgaSA8IGJ5dGVzLmxlbmd0aDsgaSArPSAyKSB7XG4gICAgcmVzICs9IFN0cmluZy5mcm9tQ2hhckNvZGUoYnl0ZXNbaV0gKyBieXRlc1tpICsgMV0gKiAyNTYpXG4gIH1cbiAgcmV0dXJuIHJlc1xufVxuXG5CdWZmZXIucHJvdG90eXBlLnNsaWNlID0gZnVuY3Rpb24gc2xpY2UgKHN0YXJ0LCBlbmQpIHtcbiAgdmFyIGxlbiA9IHRoaXMubGVuZ3RoXG4gIHN0YXJ0ID0gfn5zdGFydFxuICBlbmQgPSBlbmQgPT09IHVuZGVmaW5lZCA/IGxlbiA6IH5+ZW5kXG5cbiAgaWYgKHN0YXJ0IDwgMCkge1xuICAgIHN0YXJ0ICs9IGxlblxuICAgIGlmIChzdGFydCA8IDApIHN0YXJ0ID0gMFxuICB9IGVsc2UgaWYgKHN0YXJ0ID4gbGVuKSB7XG4gICAgc3RhcnQgPSBsZW5cbiAgfVxuXG4gIGlmIChlbmQgPCAwKSB7XG4gICAgZW5kICs9IGxlblxuICAgIGlmIChlbmQgPCAwKSBlbmQgPSAwXG4gIH0gZWxzZSBpZiAoZW5kID4gbGVuKSB7XG4gICAgZW5kID0gbGVuXG4gIH1cblxuICBpZiAoZW5kIDwgc3RhcnQpIGVuZCA9IHN0YXJ0XG5cbiAgdmFyIG5ld0J1ZlxuICBpZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICBuZXdCdWYgPSB0aGlzLnN1YmFycmF5KHN0YXJ0LCBlbmQpXG4gICAgbmV3QnVmLl9fcHJvdG9fXyA9IEJ1ZmZlci5wcm90b3R5cGVcbiAgfSBlbHNlIHtcbiAgICB2YXIgc2xpY2VMZW4gPSBlbmQgLSBzdGFydFxuICAgIG5ld0J1ZiA9IG5ldyBCdWZmZXIoc2xpY2VMZW4sIHVuZGVmaW5lZClcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHNsaWNlTGVuOyBpKyspIHtcbiAgICAgIG5ld0J1ZltpXSA9IHRoaXNbaSArIHN0YXJ0XVxuICAgIH1cbiAgfVxuXG4gIGlmIChuZXdCdWYubGVuZ3RoKSBuZXdCdWYucGFyZW50ID0gdGhpcy5wYXJlbnQgfHwgdGhpc1xuXG4gIHJldHVybiBuZXdCdWZcbn1cblxuLypcbiAqIE5lZWQgdG8gbWFrZSBzdXJlIHRoYXQgYnVmZmVyIGlzbid0IHRyeWluZyB0byB3cml0ZSBvdXQgb2YgYm91bmRzLlxuICovXG5mdW5jdGlvbiBjaGVja09mZnNldCAob2Zmc2V0LCBleHQsIGxlbmd0aCkge1xuICBpZiAoKG9mZnNldCAlIDEpICE9PSAwIHx8IG9mZnNldCA8IDApIHRocm93IG5ldyBSYW5nZUVycm9yKCdvZmZzZXQgaXMgbm90IHVpbnQnKVxuICBpZiAob2Zmc2V0ICsgZXh0ID4gbGVuZ3RoKSB0aHJvdyBuZXcgUmFuZ2VFcnJvcignVHJ5aW5nIHRvIGFjY2VzcyBiZXlvbmQgYnVmZmVyIGxlbmd0aCcpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZFVJbnRMRSA9IGZ1bmN0aW9uIHJlYWRVSW50TEUgKG9mZnNldCwgYnl0ZUxlbmd0aCwgbm9Bc3NlcnQpIHtcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBieXRlTGVuZ3RoID0gYnl0ZUxlbmd0aCB8IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCBieXRlTGVuZ3RoLCB0aGlzLmxlbmd0aClcblxuICB2YXIgdmFsID0gdGhpc1tvZmZzZXRdXG4gIHZhciBtdWwgPSAxXG4gIHZhciBpID0gMFxuICB3aGlsZSAoKytpIDwgYnl0ZUxlbmd0aCAmJiAobXVsICo9IDB4MTAwKSkge1xuICAgIHZhbCArPSB0aGlzW29mZnNldCArIGldICogbXVsXG4gIH1cblxuICByZXR1cm4gdmFsXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZFVJbnRCRSA9IGZ1bmN0aW9uIHJlYWRVSW50QkUgKG9mZnNldCwgYnl0ZUxlbmd0aCwgbm9Bc3NlcnQpIHtcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBieXRlTGVuZ3RoID0gYnl0ZUxlbmd0aCB8IDBcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIGNoZWNrT2Zmc2V0KG9mZnNldCwgYnl0ZUxlbmd0aCwgdGhpcy5sZW5ndGgpXG4gIH1cblxuICB2YXIgdmFsID0gdGhpc1tvZmZzZXQgKyAtLWJ5dGVMZW5ndGhdXG4gIHZhciBtdWwgPSAxXG4gIHdoaWxlIChieXRlTGVuZ3RoID4gMCAmJiAobXVsICo9IDB4MTAwKSkge1xuICAgIHZhbCArPSB0aGlzW29mZnNldCArIC0tYnl0ZUxlbmd0aF0gKiBtdWxcbiAgfVxuXG4gIHJldHVybiB2YWxcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkVUludDggPSBmdW5jdGlvbiByZWFkVUludDggKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCAxLCB0aGlzLmxlbmd0aClcbiAgcmV0dXJuIHRoaXNbb2Zmc2V0XVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRVSW50MTZMRSA9IGZ1bmN0aW9uIHJlYWRVSW50MTZMRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDIsIHRoaXMubGVuZ3RoKVxuICByZXR1cm4gdGhpc1tvZmZzZXRdIHwgKHRoaXNbb2Zmc2V0ICsgMV0gPDwgOClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkVUludDE2QkUgPSBmdW5jdGlvbiByZWFkVUludDE2QkUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCAyLCB0aGlzLmxlbmd0aClcbiAgcmV0dXJuICh0aGlzW29mZnNldF0gPDwgOCkgfCB0aGlzW29mZnNldCArIDFdXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZFVJbnQzMkxFID0gZnVuY3Rpb24gcmVhZFVJbnQzMkxFIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgNCwgdGhpcy5sZW5ndGgpXG5cbiAgcmV0dXJuICgodGhpc1tvZmZzZXRdKSB8XG4gICAgICAodGhpc1tvZmZzZXQgKyAxXSA8PCA4KSB8XG4gICAgICAodGhpc1tvZmZzZXQgKyAyXSA8PCAxNikpICtcbiAgICAgICh0aGlzW29mZnNldCArIDNdICogMHgxMDAwMDAwKVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRVSW50MzJCRSA9IGZ1bmN0aW9uIHJlYWRVSW50MzJCRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDQsIHRoaXMubGVuZ3RoKVxuXG4gIHJldHVybiAodGhpc1tvZmZzZXRdICogMHgxMDAwMDAwKSArXG4gICAgKCh0aGlzW29mZnNldCArIDFdIDw8IDE2KSB8XG4gICAgKHRoaXNbb2Zmc2V0ICsgMl0gPDwgOCkgfFxuICAgIHRoaXNbb2Zmc2V0ICsgM10pXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEludExFID0gZnVuY3Rpb24gcmVhZEludExFIChvZmZzZXQsIGJ5dGVMZW5ndGgsIG5vQXNzZXJ0KSB7XG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgYnl0ZUxlbmd0aCA9IGJ5dGVMZW5ndGggfCAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgYnl0ZUxlbmd0aCwgdGhpcy5sZW5ndGgpXG5cbiAgdmFyIHZhbCA9IHRoaXNbb2Zmc2V0XVxuICB2YXIgbXVsID0gMVxuICB2YXIgaSA9IDBcbiAgd2hpbGUgKCsraSA8IGJ5dGVMZW5ndGggJiYgKG11bCAqPSAweDEwMCkpIHtcbiAgICB2YWwgKz0gdGhpc1tvZmZzZXQgKyBpXSAqIG11bFxuICB9XG4gIG11bCAqPSAweDgwXG5cbiAgaWYgKHZhbCA+PSBtdWwpIHZhbCAtPSBNYXRoLnBvdygyLCA4ICogYnl0ZUxlbmd0aClcblxuICByZXR1cm4gdmFsXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEludEJFID0gZnVuY3Rpb24gcmVhZEludEJFIChvZmZzZXQsIGJ5dGVMZW5ndGgsIG5vQXNzZXJ0KSB7XG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgYnl0ZUxlbmd0aCA9IGJ5dGVMZW5ndGggfCAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgYnl0ZUxlbmd0aCwgdGhpcy5sZW5ndGgpXG5cbiAgdmFyIGkgPSBieXRlTGVuZ3RoXG4gIHZhciBtdWwgPSAxXG4gIHZhciB2YWwgPSB0aGlzW29mZnNldCArIC0taV1cbiAgd2hpbGUgKGkgPiAwICYmIChtdWwgKj0gMHgxMDApKSB7XG4gICAgdmFsICs9IHRoaXNbb2Zmc2V0ICsgLS1pXSAqIG11bFxuICB9XG4gIG11bCAqPSAweDgwXG5cbiAgaWYgKHZhbCA+PSBtdWwpIHZhbCAtPSBNYXRoLnBvdygyLCA4ICogYnl0ZUxlbmd0aClcblxuICByZXR1cm4gdmFsXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEludDggPSBmdW5jdGlvbiByZWFkSW50OCAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDEsIHRoaXMubGVuZ3RoKVxuICBpZiAoISh0aGlzW29mZnNldF0gJiAweDgwKSkgcmV0dXJuICh0aGlzW29mZnNldF0pXG4gIHJldHVybiAoKDB4ZmYgLSB0aGlzW29mZnNldF0gKyAxKSAqIC0xKVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRJbnQxNkxFID0gZnVuY3Rpb24gcmVhZEludDE2TEUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCAyLCB0aGlzLmxlbmd0aClcbiAgdmFyIHZhbCA9IHRoaXNbb2Zmc2V0XSB8ICh0aGlzW29mZnNldCArIDFdIDw8IDgpXG4gIHJldHVybiAodmFsICYgMHg4MDAwKSA/IHZhbCB8IDB4RkZGRjAwMDAgOiB2YWxcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkSW50MTZCRSA9IGZ1bmN0aW9uIHJlYWRJbnQxNkJFIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgMiwgdGhpcy5sZW5ndGgpXG4gIHZhciB2YWwgPSB0aGlzW29mZnNldCArIDFdIHwgKHRoaXNbb2Zmc2V0XSA8PCA4KVxuICByZXR1cm4gKHZhbCAmIDB4ODAwMCkgPyB2YWwgfCAweEZGRkYwMDAwIDogdmFsXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEludDMyTEUgPSBmdW5jdGlvbiByZWFkSW50MzJMRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDQsIHRoaXMubGVuZ3RoKVxuXG4gIHJldHVybiAodGhpc1tvZmZzZXRdKSB8XG4gICAgKHRoaXNbb2Zmc2V0ICsgMV0gPDwgOCkgfFxuICAgICh0aGlzW29mZnNldCArIDJdIDw8IDE2KSB8XG4gICAgKHRoaXNbb2Zmc2V0ICsgM10gPDwgMjQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEludDMyQkUgPSBmdW5jdGlvbiByZWFkSW50MzJCRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDQsIHRoaXMubGVuZ3RoKVxuXG4gIHJldHVybiAodGhpc1tvZmZzZXRdIDw8IDI0KSB8XG4gICAgKHRoaXNbb2Zmc2V0ICsgMV0gPDwgMTYpIHxcbiAgICAodGhpc1tvZmZzZXQgKyAyXSA8PCA4KSB8XG4gICAgKHRoaXNbb2Zmc2V0ICsgM10pXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEZsb2F0TEUgPSBmdW5jdGlvbiByZWFkRmxvYXRMRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDQsIHRoaXMubGVuZ3RoKVxuICByZXR1cm4gaWVlZTc1NC5yZWFkKHRoaXMsIG9mZnNldCwgdHJ1ZSwgMjMsIDQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEZsb2F0QkUgPSBmdW5jdGlvbiByZWFkRmxvYXRCRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDQsIHRoaXMubGVuZ3RoKVxuICByZXR1cm4gaWVlZTc1NC5yZWFkKHRoaXMsIG9mZnNldCwgZmFsc2UsIDIzLCA0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWREb3VibGVMRSA9IGZ1bmN0aW9uIHJlYWREb3VibGVMRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDgsIHRoaXMubGVuZ3RoKVxuICByZXR1cm4gaWVlZTc1NC5yZWFkKHRoaXMsIG9mZnNldCwgdHJ1ZSwgNTIsIDgpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZERvdWJsZUJFID0gZnVuY3Rpb24gcmVhZERvdWJsZUJFIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgOCwgdGhpcy5sZW5ndGgpXG4gIHJldHVybiBpZWVlNzU0LnJlYWQodGhpcywgb2Zmc2V0LCBmYWxzZSwgNTIsIDgpXG59XG5cbmZ1bmN0aW9uIGNoZWNrSW50IChidWYsIHZhbHVlLCBvZmZzZXQsIGV4dCwgbWF4LCBtaW4pIHtcbiAgaWYgKCFCdWZmZXIuaXNCdWZmZXIoYnVmKSkgdGhyb3cgbmV3IFR5cGVFcnJvcignYnVmZmVyIG11c3QgYmUgYSBCdWZmZXIgaW5zdGFuY2UnKVxuICBpZiAodmFsdWUgPiBtYXggfHwgdmFsdWUgPCBtaW4pIHRocm93IG5ldyBSYW5nZUVycm9yKCd2YWx1ZSBpcyBvdXQgb2YgYm91bmRzJylcbiAgaWYgKG9mZnNldCArIGV4dCA+IGJ1Zi5sZW5ndGgpIHRocm93IG5ldyBSYW5nZUVycm9yKCdpbmRleCBvdXQgb2YgcmFuZ2UnKVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlVUludExFID0gZnVuY3Rpb24gd3JpdGVVSW50TEUgKHZhbHVlLCBvZmZzZXQsIGJ5dGVMZW5ndGgsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgYnl0ZUxlbmd0aCA9IGJ5dGVMZW5ndGggfCAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIGJ5dGVMZW5ndGgsIE1hdGgucG93KDIsIDggKiBieXRlTGVuZ3RoKSwgMClcblxuICB2YXIgbXVsID0gMVxuICB2YXIgaSA9IDBcbiAgdGhpc1tvZmZzZXRdID0gdmFsdWUgJiAweEZGXG4gIHdoaWxlICgrK2kgPCBieXRlTGVuZ3RoICYmIChtdWwgKj0gMHgxMDApKSB7XG4gICAgdGhpc1tvZmZzZXQgKyBpXSA9ICh2YWx1ZSAvIG11bCkgJiAweEZGXG4gIH1cblxuICByZXR1cm4gb2Zmc2V0ICsgYnl0ZUxlbmd0aFxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlVUludEJFID0gZnVuY3Rpb24gd3JpdGVVSW50QkUgKHZhbHVlLCBvZmZzZXQsIGJ5dGVMZW5ndGgsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgYnl0ZUxlbmd0aCA9IGJ5dGVMZW5ndGggfCAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIGJ5dGVMZW5ndGgsIE1hdGgucG93KDIsIDggKiBieXRlTGVuZ3RoKSwgMClcblxuICB2YXIgaSA9IGJ5dGVMZW5ndGggLSAxXG4gIHZhciBtdWwgPSAxXG4gIHRoaXNbb2Zmc2V0ICsgaV0gPSB2YWx1ZSAmIDB4RkZcbiAgd2hpbGUgKC0taSA+PSAwICYmIChtdWwgKj0gMHgxMDApKSB7XG4gICAgdGhpc1tvZmZzZXQgKyBpXSA9ICh2YWx1ZSAvIG11bCkgJiAweEZGXG4gIH1cblxuICByZXR1cm4gb2Zmc2V0ICsgYnl0ZUxlbmd0aFxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlVUludDggPSBmdW5jdGlvbiB3cml0ZVVJbnQ4ICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIDEsIDB4ZmYsIDApXG4gIGlmICghQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHZhbHVlID0gTWF0aC5mbG9vcih2YWx1ZSlcbiAgdGhpc1tvZmZzZXRdID0gKHZhbHVlICYgMHhmZilcbiAgcmV0dXJuIG9mZnNldCArIDFcbn1cblxuZnVuY3Rpb24gb2JqZWN0V3JpdGVVSW50MTYgKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuKSB7XG4gIGlmICh2YWx1ZSA8IDApIHZhbHVlID0gMHhmZmZmICsgdmFsdWUgKyAxXG4gIGZvciAodmFyIGkgPSAwLCBqID0gTWF0aC5taW4oYnVmLmxlbmd0aCAtIG9mZnNldCwgMik7IGkgPCBqOyBpKyspIHtcbiAgICBidWZbb2Zmc2V0ICsgaV0gPSAodmFsdWUgJiAoMHhmZiA8PCAoOCAqIChsaXR0bGVFbmRpYW4gPyBpIDogMSAtIGkpKSkpID4+PlxuICAgICAgKGxpdHRsZUVuZGlhbiA/IGkgOiAxIC0gaSkgKiA4XG4gIH1cbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZVVJbnQxNkxFID0gZnVuY3Rpb24gd3JpdGVVSW50MTZMRSAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCAyLCAweGZmZmYsIDApXG4gIGlmIChCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkge1xuICAgIHRoaXNbb2Zmc2V0XSA9ICh2YWx1ZSAmIDB4ZmYpXG4gICAgdGhpc1tvZmZzZXQgKyAxXSA9ICh2YWx1ZSA+Pj4gOClcbiAgfSBlbHNlIHtcbiAgICBvYmplY3RXcml0ZVVJbnQxNih0aGlzLCB2YWx1ZSwgb2Zmc2V0LCB0cnVlKVxuICB9XG4gIHJldHVybiBvZmZzZXQgKyAyXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVVSW50MTZCRSA9IGZ1bmN0aW9uIHdyaXRlVUludDE2QkUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgMiwgMHhmZmZmLCAwKVxuICBpZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICB0aGlzW29mZnNldF0gPSAodmFsdWUgPj4+IDgpXG4gICAgdGhpc1tvZmZzZXQgKyAxXSA9ICh2YWx1ZSAmIDB4ZmYpXG4gIH0gZWxzZSB7XG4gICAgb2JqZWN0V3JpdGVVSW50MTYodGhpcywgdmFsdWUsIG9mZnNldCwgZmFsc2UpXG4gIH1cbiAgcmV0dXJuIG9mZnNldCArIDJcbn1cblxuZnVuY3Rpb24gb2JqZWN0V3JpdGVVSW50MzIgKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuKSB7XG4gIGlmICh2YWx1ZSA8IDApIHZhbHVlID0gMHhmZmZmZmZmZiArIHZhbHVlICsgMVxuICBmb3IgKHZhciBpID0gMCwgaiA9IE1hdGgubWluKGJ1Zi5sZW5ndGggLSBvZmZzZXQsIDQpOyBpIDwgajsgaSsrKSB7XG4gICAgYnVmW29mZnNldCArIGldID0gKHZhbHVlID4+PiAobGl0dGxlRW5kaWFuID8gaSA6IDMgLSBpKSAqIDgpICYgMHhmZlxuICB9XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVVSW50MzJMRSA9IGZ1bmN0aW9uIHdyaXRlVUludDMyTEUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgNCwgMHhmZmZmZmZmZiwgMClcbiAgaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgdGhpc1tvZmZzZXQgKyAzXSA9ICh2YWx1ZSA+Pj4gMjQpXG4gICAgdGhpc1tvZmZzZXQgKyAyXSA9ICh2YWx1ZSA+Pj4gMTYpXG4gICAgdGhpc1tvZmZzZXQgKyAxXSA9ICh2YWx1ZSA+Pj4gOClcbiAgICB0aGlzW29mZnNldF0gPSAodmFsdWUgJiAweGZmKVxuICB9IGVsc2Uge1xuICAgIG9iamVjdFdyaXRlVUludDMyKHRoaXMsIHZhbHVlLCBvZmZzZXQsIHRydWUpXG4gIH1cbiAgcmV0dXJuIG9mZnNldCArIDRcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZVVJbnQzMkJFID0gZnVuY3Rpb24gd3JpdGVVSW50MzJCRSAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCA0LCAweGZmZmZmZmZmLCAwKVxuICBpZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICB0aGlzW29mZnNldF0gPSAodmFsdWUgPj4+IDI0KVxuICAgIHRoaXNbb2Zmc2V0ICsgMV0gPSAodmFsdWUgPj4+IDE2KVxuICAgIHRoaXNbb2Zmc2V0ICsgMl0gPSAodmFsdWUgPj4+IDgpXG4gICAgdGhpc1tvZmZzZXQgKyAzXSA9ICh2YWx1ZSAmIDB4ZmYpXG4gIH0gZWxzZSB7XG4gICAgb2JqZWN0V3JpdGVVSW50MzIodGhpcywgdmFsdWUsIG9mZnNldCwgZmFsc2UpXG4gIH1cbiAgcmV0dXJuIG9mZnNldCArIDRcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUludExFID0gZnVuY3Rpb24gd3JpdGVJbnRMRSAodmFsdWUsIG9mZnNldCwgYnl0ZUxlbmd0aCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgdmFyIGxpbWl0ID0gTWF0aC5wb3coMiwgOCAqIGJ5dGVMZW5ndGggLSAxKVxuXG4gICAgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgYnl0ZUxlbmd0aCwgbGltaXQgLSAxLCAtbGltaXQpXG4gIH1cblxuICB2YXIgaSA9IDBcbiAgdmFyIG11bCA9IDFcbiAgdmFyIHN1YiA9IHZhbHVlIDwgMCA/IDEgOiAwXG4gIHRoaXNbb2Zmc2V0XSA9IHZhbHVlICYgMHhGRlxuICB3aGlsZSAoKytpIDwgYnl0ZUxlbmd0aCAmJiAobXVsICo9IDB4MTAwKSkge1xuICAgIHRoaXNbb2Zmc2V0ICsgaV0gPSAoKHZhbHVlIC8gbXVsKSA+PiAwKSAtIHN1YiAmIDB4RkZcbiAgfVxuXG4gIHJldHVybiBvZmZzZXQgKyBieXRlTGVuZ3RoXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVJbnRCRSA9IGZ1bmN0aW9uIHdyaXRlSW50QkUgKHZhbHVlLCBvZmZzZXQsIGJ5dGVMZW5ndGgsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIHZhciBsaW1pdCA9IE1hdGgucG93KDIsIDggKiBieXRlTGVuZ3RoIC0gMSlcblxuICAgIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIGJ5dGVMZW5ndGgsIGxpbWl0IC0gMSwgLWxpbWl0KVxuICB9XG5cbiAgdmFyIGkgPSBieXRlTGVuZ3RoIC0gMVxuICB2YXIgbXVsID0gMVxuICB2YXIgc3ViID0gdmFsdWUgPCAwID8gMSA6IDBcbiAgdGhpc1tvZmZzZXQgKyBpXSA9IHZhbHVlICYgMHhGRlxuICB3aGlsZSAoLS1pID49IDAgJiYgKG11bCAqPSAweDEwMCkpIHtcbiAgICB0aGlzW29mZnNldCArIGldID0gKCh2YWx1ZSAvIG11bCkgPj4gMCkgLSBzdWIgJiAweEZGXG4gIH1cblxuICByZXR1cm4gb2Zmc2V0ICsgYnl0ZUxlbmd0aFxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlSW50OCA9IGZ1bmN0aW9uIHdyaXRlSW50OCAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCAxLCAweDdmLCAtMHg4MClcbiAgaWYgKCFCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkgdmFsdWUgPSBNYXRoLmZsb29yKHZhbHVlKVxuICBpZiAodmFsdWUgPCAwKSB2YWx1ZSA9IDB4ZmYgKyB2YWx1ZSArIDFcbiAgdGhpc1tvZmZzZXRdID0gKHZhbHVlICYgMHhmZilcbiAgcmV0dXJuIG9mZnNldCArIDFcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUludDE2TEUgPSBmdW5jdGlvbiB3cml0ZUludDE2TEUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgMiwgMHg3ZmZmLCAtMHg4MDAwKVxuICBpZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICB0aGlzW29mZnNldF0gPSAodmFsdWUgJiAweGZmKVxuICAgIHRoaXNbb2Zmc2V0ICsgMV0gPSAodmFsdWUgPj4+IDgpXG4gIH0gZWxzZSB7XG4gICAgb2JqZWN0V3JpdGVVSW50MTYodGhpcywgdmFsdWUsIG9mZnNldCwgdHJ1ZSlcbiAgfVxuICByZXR1cm4gb2Zmc2V0ICsgMlxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlSW50MTZCRSA9IGZ1bmN0aW9uIHdyaXRlSW50MTZCRSAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCAyLCAweDdmZmYsIC0weDgwMDApXG4gIGlmIChCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkge1xuICAgIHRoaXNbb2Zmc2V0XSA9ICh2YWx1ZSA+Pj4gOClcbiAgICB0aGlzW29mZnNldCArIDFdID0gKHZhbHVlICYgMHhmZilcbiAgfSBlbHNlIHtcbiAgICBvYmplY3RXcml0ZVVJbnQxNih0aGlzLCB2YWx1ZSwgb2Zmc2V0LCBmYWxzZSlcbiAgfVxuICByZXR1cm4gb2Zmc2V0ICsgMlxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlSW50MzJMRSA9IGZ1bmN0aW9uIHdyaXRlSW50MzJMRSAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCA0LCAweDdmZmZmZmZmLCAtMHg4MDAwMDAwMClcbiAgaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgdGhpc1tvZmZzZXRdID0gKHZhbHVlICYgMHhmZilcbiAgICB0aGlzW29mZnNldCArIDFdID0gKHZhbHVlID4+PiA4KVxuICAgIHRoaXNbb2Zmc2V0ICsgMl0gPSAodmFsdWUgPj4+IDE2KVxuICAgIHRoaXNbb2Zmc2V0ICsgM10gPSAodmFsdWUgPj4+IDI0KVxuICB9IGVsc2Uge1xuICAgIG9iamVjdFdyaXRlVUludDMyKHRoaXMsIHZhbHVlLCBvZmZzZXQsIHRydWUpXG4gIH1cbiAgcmV0dXJuIG9mZnNldCArIDRcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUludDMyQkUgPSBmdW5jdGlvbiB3cml0ZUludDMyQkUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgNCwgMHg3ZmZmZmZmZiwgLTB4ODAwMDAwMDApXG4gIGlmICh2YWx1ZSA8IDApIHZhbHVlID0gMHhmZmZmZmZmZiArIHZhbHVlICsgMVxuICBpZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICB0aGlzW29mZnNldF0gPSAodmFsdWUgPj4+IDI0KVxuICAgIHRoaXNbb2Zmc2V0ICsgMV0gPSAodmFsdWUgPj4+IDE2KVxuICAgIHRoaXNbb2Zmc2V0ICsgMl0gPSAodmFsdWUgPj4+IDgpXG4gICAgdGhpc1tvZmZzZXQgKyAzXSA9ICh2YWx1ZSAmIDB4ZmYpXG4gIH0gZWxzZSB7XG4gICAgb2JqZWN0V3JpdGVVSW50MzIodGhpcywgdmFsdWUsIG9mZnNldCwgZmFsc2UpXG4gIH1cbiAgcmV0dXJuIG9mZnNldCArIDRcbn1cblxuZnVuY3Rpb24gY2hlY2tJRUVFNzU0IChidWYsIHZhbHVlLCBvZmZzZXQsIGV4dCwgbWF4LCBtaW4pIHtcbiAgaWYgKG9mZnNldCArIGV4dCA+IGJ1Zi5sZW5ndGgpIHRocm93IG5ldyBSYW5nZUVycm9yKCdpbmRleCBvdXQgb2YgcmFuZ2UnKVxuICBpZiAob2Zmc2V0IDwgMCkgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ2luZGV4IG91dCBvZiByYW5nZScpXG59XG5cbmZ1bmN0aW9uIHdyaXRlRmxvYXQgKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgY2hlY2tJRUVFNzU0KGJ1ZiwgdmFsdWUsIG9mZnNldCwgNCwgMy40MDI4MjM0NjYzODUyODg2ZSszOCwgLTMuNDAyODIzNDY2Mzg1Mjg4NmUrMzgpXG4gIH1cbiAgaWVlZTc1NC53cml0ZShidWYsIHZhbHVlLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgMjMsIDQpXG4gIHJldHVybiBvZmZzZXQgKyA0XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVGbG9hdExFID0gZnVuY3Rpb24gd3JpdGVGbG9hdExFICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gd3JpdGVGbG9hdCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCB0cnVlLCBub0Fzc2VydClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUZsb2F0QkUgPSBmdW5jdGlvbiB3cml0ZUZsb2F0QkUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiB3cml0ZUZsb2F0KHRoaXMsIHZhbHVlLCBvZmZzZXQsIGZhbHNlLCBub0Fzc2VydClcbn1cblxuZnVuY3Rpb24gd3JpdGVEb3VibGUgKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgY2hlY2tJRUVFNzU0KGJ1ZiwgdmFsdWUsIG9mZnNldCwgOCwgMS43OTc2OTMxMzQ4NjIzMTU3RSszMDgsIC0xLjc5NzY5MzEzNDg2MjMxNTdFKzMwOClcbiAgfVxuICBpZWVlNzU0LndyaXRlKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCA1MiwgOClcbiAgcmV0dXJuIG9mZnNldCArIDhcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZURvdWJsZUxFID0gZnVuY3Rpb24gd3JpdGVEb3VibGVMRSAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgcmV0dXJuIHdyaXRlRG91YmxlKHRoaXMsIHZhbHVlLCBvZmZzZXQsIHRydWUsIG5vQXNzZXJ0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlRG91YmxlQkUgPSBmdW5jdGlvbiB3cml0ZURvdWJsZUJFICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gd3JpdGVEb3VibGUodGhpcywgdmFsdWUsIG9mZnNldCwgZmFsc2UsIG5vQXNzZXJ0KVxufVxuXG4vLyBjb3B5KHRhcmdldEJ1ZmZlciwgdGFyZ2V0U3RhcnQ9MCwgc291cmNlU3RhcnQ9MCwgc291cmNlRW5kPWJ1ZmZlci5sZW5ndGgpXG5CdWZmZXIucHJvdG90eXBlLmNvcHkgPSBmdW5jdGlvbiBjb3B5ICh0YXJnZXQsIHRhcmdldFN0YXJ0LCBzdGFydCwgZW5kKSB7XG4gIGlmICghc3RhcnQpIHN0YXJ0ID0gMFxuICBpZiAoIWVuZCAmJiBlbmQgIT09IDApIGVuZCA9IHRoaXMubGVuZ3RoXG4gIGlmICh0YXJnZXRTdGFydCA+PSB0YXJnZXQubGVuZ3RoKSB0YXJnZXRTdGFydCA9IHRhcmdldC5sZW5ndGhcbiAgaWYgKCF0YXJnZXRTdGFydCkgdGFyZ2V0U3RhcnQgPSAwXG4gIGlmIChlbmQgPiAwICYmIGVuZCA8IHN0YXJ0KSBlbmQgPSBzdGFydFxuXG4gIC8vIENvcHkgMCBieXRlczsgd2UncmUgZG9uZVxuICBpZiAoZW5kID09PSBzdGFydCkgcmV0dXJuIDBcbiAgaWYgKHRhcmdldC5sZW5ndGggPT09IDAgfHwgdGhpcy5sZW5ndGggPT09IDApIHJldHVybiAwXG5cbiAgLy8gRmF0YWwgZXJyb3IgY29uZGl0aW9uc1xuICBpZiAodGFyZ2V0U3RhcnQgPCAwKSB7XG4gICAgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ3RhcmdldFN0YXJ0IG91dCBvZiBib3VuZHMnKVxuICB9XG4gIGlmIChzdGFydCA8IDAgfHwgc3RhcnQgPj0gdGhpcy5sZW5ndGgpIHRocm93IG5ldyBSYW5nZUVycm9yKCdzb3VyY2VTdGFydCBvdXQgb2YgYm91bmRzJylcbiAgaWYgKGVuZCA8IDApIHRocm93IG5ldyBSYW5nZUVycm9yKCdzb3VyY2VFbmQgb3V0IG9mIGJvdW5kcycpXG5cbiAgLy8gQXJlIHdlIG9vYj9cbiAgaWYgKGVuZCA+IHRoaXMubGVuZ3RoKSBlbmQgPSB0aGlzLmxlbmd0aFxuICBpZiAodGFyZ2V0Lmxlbmd0aCAtIHRhcmdldFN0YXJ0IDwgZW5kIC0gc3RhcnQpIHtcbiAgICBlbmQgPSB0YXJnZXQubGVuZ3RoIC0gdGFyZ2V0U3RhcnQgKyBzdGFydFxuICB9XG5cbiAgdmFyIGxlbiA9IGVuZCAtIHN0YXJ0XG4gIHZhciBpXG5cbiAgaWYgKHRoaXMgPT09IHRhcmdldCAmJiBzdGFydCA8IHRhcmdldFN0YXJ0ICYmIHRhcmdldFN0YXJ0IDwgZW5kKSB7XG4gICAgLy8gZGVzY2VuZGluZyBjb3B5IGZyb20gZW5kXG4gICAgZm9yIChpID0gbGVuIC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICAgIHRhcmdldFtpICsgdGFyZ2V0U3RhcnRdID0gdGhpc1tpICsgc3RhcnRdXG4gICAgfVxuICB9IGVsc2UgaWYgKGxlbiA8IDEwMDAgfHwgIUJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgLy8gYXNjZW5kaW5nIGNvcHkgZnJvbSBzdGFydFxuICAgIGZvciAoaSA9IDA7IGkgPCBsZW47IGkrKykge1xuICAgICAgdGFyZ2V0W2kgKyB0YXJnZXRTdGFydF0gPSB0aGlzW2kgKyBzdGFydF1cbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgVWludDhBcnJheS5wcm90b3R5cGUuc2V0LmNhbGwoXG4gICAgICB0YXJnZXQsXG4gICAgICB0aGlzLnN1YmFycmF5KHN0YXJ0LCBzdGFydCArIGxlbiksXG4gICAgICB0YXJnZXRTdGFydFxuICAgIClcbiAgfVxuXG4gIHJldHVybiBsZW5cbn1cblxuLy8gZmlsbCh2YWx1ZSwgc3RhcnQ9MCwgZW5kPWJ1ZmZlci5sZW5ndGgpXG5CdWZmZXIucHJvdG90eXBlLmZpbGwgPSBmdW5jdGlvbiBmaWxsICh2YWx1ZSwgc3RhcnQsIGVuZCkge1xuICBpZiAoIXZhbHVlKSB2YWx1ZSA9IDBcbiAgaWYgKCFzdGFydCkgc3RhcnQgPSAwXG4gIGlmICghZW5kKSBlbmQgPSB0aGlzLmxlbmd0aFxuXG4gIGlmIChlbmQgPCBzdGFydCkgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ2VuZCA8IHN0YXJ0JylcblxuICAvLyBGaWxsIDAgYnl0ZXM7IHdlJ3JlIGRvbmVcbiAgaWYgKGVuZCA9PT0gc3RhcnQpIHJldHVyblxuICBpZiAodGhpcy5sZW5ndGggPT09IDApIHJldHVyblxuXG4gIGlmIChzdGFydCA8IDAgfHwgc3RhcnQgPj0gdGhpcy5sZW5ndGgpIHRocm93IG5ldyBSYW5nZUVycm9yKCdzdGFydCBvdXQgb2YgYm91bmRzJylcbiAgaWYgKGVuZCA8IDAgfHwgZW5kID4gdGhpcy5sZW5ndGgpIHRocm93IG5ldyBSYW5nZUVycm9yKCdlbmQgb3V0IG9mIGJvdW5kcycpXG5cbiAgdmFyIGlcbiAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ251bWJlcicpIHtcbiAgICBmb3IgKGkgPSBzdGFydDsgaSA8IGVuZDsgaSsrKSB7XG4gICAgICB0aGlzW2ldID0gdmFsdWVcbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgdmFyIGJ5dGVzID0gdXRmOFRvQnl0ZXModmFsdWUudG9TdHJpbmcoKSlcbiAgICB2YXIgbGVuID0gYnl0ZXMubGVuZ3RoXG4gICAgZm9yIChpID0gc3RhcnQ7IGkgPCBlbmQ7IGkrKykge1xuICAgICAgdGhpc1tpXSA9IGJ5dGVzW2kgJSBsZW5dXG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHRoaXNcbn1cblxuLy8gSEVMUEVSIEZVTkNUSU9OU1xuLy8gPT09PT09PT09PT09PT09PVxuXG52YXIgSU5WQUxJRF9CQVNFNjRfUkUgPSAvW14rXFwvMC05QS1aYS16LV9dL2dcblxuZnVuY3Rpb24gYmFzZTY0Y2xlYW4gKHN0cikge1xuICAvLyBOb2RlIHN0cmlwcyBvdXQgaW52YWxpZCBjaGFyYWN0ZXJzIGxpa2UgXFxuIGFuZCBcXHQgZnJvbSB0aGUgc3RyaW5nLCBiYXNlNjQtanMgZG9lcyBub3RcbiAgc3RyID0gc3RyaW5ndHJpbShzdHIpLnJlcGxhY2UoSU5WQUxJRF9CQVNFNjRfUkUsICcnKVxuICAvLyBOb2RlIGNvbnZlcnRzIHN0cmluZ3Mgd2l0aCBsZW5ndGggPCAyIHRvICcnXG4gIGlmIChzdHIubGVuZ3RoIDwgMikgcmV0dXJuICcnXG4gIC8vIE5vZGUgYWxsb3dzIGZvciBub24tcGFkZGVkIGJhc2U2NCBzdHJpbmdzIChtaXNzaW5nIHRyYWlsaW5nID09PSksIGJhc2U2NC1qcyBkb2VzIG5vdFxuICB3aGlsZSAoc3RyLmxlbmd0aCAlIDQgIT09IDApIHtcbiAgICBzdHIgPSBzdHIgKyAnPSdcbiAgfVxuICByZXR1cm4gc3RyXG59XG5cbmZ1bmN0aW9uIHN0cmluZ3RyaW0gKHN0cikge1xuICBpZiAoc3RyLnRyaW0pIHJldHVybiBzdHIudHJpbSgpXG4gIHJldHVybiBzdHIucmVwbGFjZSgvXlxccyt8XFxzKyQvZywgJycpXG59XG5cbmZ1bmN0aW9uIHRvSGV4IChuKSB7XG4gIGlmIChuIDwgMTYpIHJldHVybiAnMCcgKyBuLnRvU3RyaW5nKDE2KVxuICByZXR1cm4gbi50b1N0cmluZygxNilcbn1cblxuZnVuY3Rpb24gdXRmOFRvQnl0ZXMgKHN0cmluZywgdW5pdHMpIHtcbiAgdW5pdHMgPSB1bml0cyB8fCBJbmZpbml0eVxuICB2YXIgY29kZVBvaW50XG4gIHZhciBsZW5ndGggPSBzdHJpbmcubGVuZ3RoXG4gIHZhciBsZWFkU3Vycm9nYXRlID0gbnVsbFxuICB2YXIgYnl0ZXMgPSBbXVxuXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICBjb2RlUG9pbnQgPSBzdHJpbmcuY2hhckNvZGVBdChpKVxuXG4gICAgLy8gaXMgc3Vycm9nYXRlIGNvbXBvbmVudFxuICAgIGlmIChjb2RlUG9pbnQgPiAweEQ3RkYgJiYgY29kZVBvaW50IDwgMHhFMDAwKSB7XG4gICAgICAvLyBsYXN0IGNoYXIgd2FzIGEgbGVhZFxuICAgICAgaWYgKCFsZWFkU3Vycm9nYXRlKSB7XG4gICAgICAgIC8vIG5vIGxlYWQgeWV0XG4gICAgICAgIGlmIChjb2RlUG9pbnQgPiAweERCRkYpIHtcbiAgICAgICAgICAvLyB1bmV4cGVjdGVkIHRyYWlsXG4gICAgICAgICAgaWYgKCh1bml0cyAtPSAzKSA+IC0xKSBieXRlcy5wdXNoKDB4RUYsIDB4QkYsIDB4QkQpXG4gICAgICAgICAgY29udGludWVcbiAgICAgICAgfSBlbHNlIGlmIChpICsgMSA9PT0gbGVuZ3RoKSB7XG4gICAgICAgICAgLy8gdW5wYWlyZWQgbGVhZFxuICAgICAgICAgIGlmICgodW5pdHMgLT0gMykgPiAtMSkgYnl0ZXMucHVzaCgweEVGLCAweEJGLCAweEJEKVxuICAgICAgICAgIGNvbnRpbnVlXG4gICAgICAgIH1cblxuICAgICAgICAvLyB2YWxpZCBsZWFkXG4gICAgICAgIGxlYWRTdXJyb2dhdGUgPSBjb2RlUG9pbnRcblxuICAgICAgICBjb250aW51ZVxuICAgICAgfVxuXG4gICAgICAvLyAyIGxlYWRzIGluIGEgcm93XG4gICAgICBpZiAoY29kZVBvaW50IDwgMHhEQzAwKSB7XG4gICAgICAgIGlmICgodW5pdHMgLT0gMykgPiAtMSkgYnl0ZXMucHVzaCgweEVGLCAweEJGLCAweEJEKVxuICAgICAgICBsZWFkU3Vycm9nYXRlID0gY29kZVBvaW50XG4gICAgICAgIGNvbnRpbnVlXG4gICAgICB9XG5cbiAgICAgIC8vIHZhbGlkIHN1cnJvZ2F0ZSBwYWlyXG4gICAgICBjb2RlUG9pbnQgPSAobGVhZFN1cnJvZ2F0ZSAtIDB4RDgwMCA8PCAxMCB8IGNvZGVQb2ludCAtIDB4REMwMCkgKyAweDEwMDAwXG4gICAgfSBlbHNlIGlmIChsZWFkU3Vycm9nYXRlKSB7XG4gICAgICAvLyB2YWxpZCBibXAgY2hhciwgYnV0IGxhc3QgY2hhciB3YXMgYSBsZWFkXG4gICAgICBpZiAoKHVuaXRzIC09IDMpID4gLTEpIGJ5dGVzLnB1c2goMHhFRiwgMHhCRiwgMHhCRClcbiAgICB9XG5cbiAgICBsZWFkU3Vycm9nYXRlID0gbnVsbFxuXG4gICAgLy8gZW5jb2RlIHV0ZjhcbiAgICBpZiAoY29kZVBvaW50IDwgMHg4MCkge1xuICAgICAgaWYgKCh1bml0cyAtPSAxKSA8IDApIGJyZWFrXG4gICAgICBieXRlcy5wdXNoKGNvZGVQb2ludClcbiAgICB9IGVsc2UgaWYgKGNvZGVQb2ludCA8IDB4ODAwKSB7XG4gICAgICBpZiAoKHVuaXRzIC09IDIpIDwgMCkgYnJlYWtcbiAgICAgIGJ5dGVzLnB1c2goXG4gICAgICAgIGNvZGVQb2ludCA+PiAweDYgfCAweEMwLFxuICAgICAgICBjb2RlUG9pbnQgJiAweDNGIHwgMHg4MFxuICAgICAgKVxuICAgIH0gZWxzZSBpZiAoY29kZVBvaW50IDwgMHgxMDAwMCkge1xuICAgICAgaWYgKCh1bml0cyAtPSAzKSA8IDApIGJyZWFrXG4gICAgICBieXRlcy5wdXNoKFxuICAgICAgICBjb2RlUG9pbnQgPj4gMHhDIHwgMHhFMCxcbiAgICAgICAgY29kZVBvaW50ID4+IDB4NiAmIDB4M0YgfCAweDgwLFxuICAgICAgICBjb2RlUG9pbnQgJiAweDNGIHwgMHg4MFxuICAgICAgKVxuICAgIH0gZWxzZSBpZiAoY29kZVBvaW50IDwgMHgxMTAwMDApIHtcbiAgICAgIGlmICgodW5pdHMgLT0gNCkgPCAwKSBicmVha1xuICAgICAgYnl0ZXMucHVzaChcbiAgICAgICAgY29kZVBvaW50ID4+IDB4MTIgfCAweEYwLFxuICAgICAgICBjb2RlUG9pbnQgPj4gMHhDICYgMHgzRiB8IDB4ODAsXG4gICAgICAgIGNvZGVQb2ludCA+PiAweDYgJiAweDNGIHwgMHg4MCxcbiAgICAgICAgY29kZVBvaW50ICYgMHgzRiB8IDB4ODBcbiAgICAgIClcbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIGNvZGUgcG9pbnQnKVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiBieXRlc1xufVxuXG5mdW5jdGlvbiBhc2NpaVRvQnl0ZXMgKHN0cikge1xuICB2YXIgYnl0ZUFycmF5ID0gW11cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBzdHIubGVuZ3RoOyBpKyspIHtcbiAgICAvLyBOb2RlJ3MgY29kZSBzZWVtcyB0byBiZSBkb2luZyB0aGlzIGFuZCBub3QgJiAweDdGLi5cbiAgICBieXRlQXJyYXkucHVzaChzdHIuY2hhckNvZGVBdChpKSAmIDB4RkYpXG4gIH1cbiAgcmV0dXJuIGJ5dGVBcnJheVxufVxuXG5mdW5jdGlvbiB1dGYxNmxlVG9CeXRlcyAoc3RyLCB1bml0cykge1xuICB2YXIgYywgaGksIGxvXG4gIHZhciBieXRlQXJyYXkgPSBbXVxuICBmb3IgKHZhciBpID0gMDsgaSA8IHN0ci5sZW5ndGg7IGkrKykge1xuICAgIGlmICgodW5pdHMgLT0gMikgPCAwKSBicmVha1xuXG4gICAgYyA9IHN0ci5jaGFyQ29kZUF0KGkpXG4gICAgaGkgPSBjID4+IDhcbiAgICBsbyA9IGMgJSAyNTZcbiAgICBieXRlQXJyYXkucHVzaChsbylcbiAgICBieXRlQXJyYXkucHVzaChoaSlcbiAgfVxuXG4gIHJldHVybiBieXRlQXJyYXlcbn1cblxuZnVuY3Rpb24gYmFzZTY0VG9CeXRlcyAoc3RyKSB7XG4gIHJldHVybiBiYXNlNjQudG9CeXRlQXJyYXkoYmFzZTY0Y2xlYW4oc3RyKSlcbn1cblxuZnVuY3Rpb24gYmxpdEJ1ZmZlciAoc3JjLCBkc3QsIG9mZnNldCwgbGVuZ3RoKSB7XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICBpZiAoKGkgKyBvZmZzZXQgPj0gZHN0Lmxlbmd0aCkgfHwgKGkgPj0gc3JjLmxlbmd0aCkpIGJyZWFrXG4gICAgZHN0W2kgKyBvZmZzZXRdID0gc3JjW2ldXG4gIH1cbiAgcmV0dXJuIGlcbn1cbiIsIid1c2Ugc3RyaWN0J1xuXG5leHBvcnRzLnRvQnl0ZUFycmF5ID0gdG9CeXRlQXJyYXlcbmV4cG9ydHMuZnJvbUJ5dGVBcnJheSA9IGZyb21CeXRlQXJyYXlcblxudmFyIGxvb2t1cCA9IFtdXG52YXIgcmV2TG9va3VwID0gW11cbnZhciBBcnIgPSB0eXBlb2YgVWludDhBcnJheSAhPT0gJ3VuZGVmaW5lZCcgPyBVaW50OEFycmF5IDogQXJyYXlcblxuZnVuY3Rpb24gaW5pdCAoKSB7XG4gIHZhciBjb2RlID0gJ0FCQ0RFRkdISUpLTE1OT1BRUlNUVVZXWFlaYWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXowMTIzNDU2Nzg5Ky8nXG4gIGZvciAodmFyIGkgPSAwLCBsZW4gPSBjb2RlLmxlbmd0aDsgaSA8IGxlbjsgKytpKSB7XG4gICAgbG9va3VwW2ldID0gY29kZVtpXVxuICAgIHJldkxvb2t1cFtjb2RlLmNoYXJDb2RlQXQoaSldID0gaVxuICB9XG5cbiAgcmV2TG9va3VwWyctJy5jaGFyQ29kZUF0KDApXSA9IDYyXG4gIHJldkxvb2t1cFsnXycuY2hhckNvZGVBdCgwKV0gPSA2M1xufVxuXG5pbml0KClcblxuZnVuY3Rpb24gdG9CeXRlQXJyYXkgKGI2NCkge1xuICB2YXIgaSwgaiwgbCwgdG1wLCBwbGFjZUhvbGRlcnMsIGFyclxuICB2YXIgbGVuID0gYjY0Lmxlbmd0aFxuXG4gIGlmIChsZW4gJSA0ID4gMCkge1xuICAgIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBzdHJpbmcuIExlbmd0aCBtdXN0IGJlIGEgbXVsdGlwbGUgb2YgNCcpXG4gIH1cblxuICAvLyB0aGUgbnVtYmVyIG9mIGVxdWFsIHNpZ25zIChwbGFjZSBob2xkZXJzKVxuICAvLyBpZiB0aGVyZSBhcmUgdHdvIHBsYWNlaG9sZGVycywgdGhhbiB0aGUgdHdvIGNoYXJhY3RlcnMgYmVmb3JlIGl0XG4gIC8vIHJlcHJlc2VudCBvbmUgYnl0ZVxuICAvLyBpZiB0aGVyZSBpcyBvbmx5IG9uZSwgdGhlbiB0aGUgdGhyZWUgY2hhcmFjdGVycyBiZWZvcmUgaXQgcmVwcmVzZW50IDIgYnl0ZXNcbiAgLy8gdGhpcyBpcyBqdXN0IGEgY2hlYXAgaGFjayB0byBub3QgZG8gaW5kZXhPZiB0d2ljZVxuICBwbGFjZUhvbGRlcnMgPSBiNjRbbGVuIC0gMl0gPT09ICc9JyA/IDIgOiBiNjRbbGVuIC0gMV0gPT09ICc9JyA/IDEgOiAwXG5cbiAgLy8gYmFzZTY0IGlzIDQvMyArIHVwIHRvIHR3byBjaGFyYWN0ZXJzIG9mIHRoZSBvcmlnaW5hbCBkYXRhXG4gIGFyciA9IG5ldyBBcnIobGVuICogMyAvIDQgLSBwbGFjZUhvbGRlcnMpXG5cbiAgLy8gaWYgdGhlcmUgYXJlIHBsYWNlaG9sZGVycywgb25seSBnZXQgdXAgdG8gdGhlIGxhc3QgY29tcGxldGUgNCBjaGFyc1xuICBsID0gcGxhY2VIb2xkZXJzID4gMCA/IGxlbiAtIDQgOiBsZW5cblxuICB2YXIgTCA9IDBcblxuICBmb3IgKGkgPSAwLCBqID0gMDsgaSA8IGw7IGkgKz0gNCwgaiArPSAzKSB7XG4gICAgdG1wID0gKHJldkxvb2t1cFtiNjQuY2hhckNvZGVBdChpKV0gPDwgMTgpIHwgKHJldkxvb2t1cFtiNjQuY2hhckNvZGVBdChpICsgMSldIDw8IDEyKSB8IChyZXZMb29rdXBbYjY0LmNoYXJDb2RlQXQoaSArIDIpXSA8PCA2KSB8IHJldkxvb2t1cFtiNjQuY2hhckNvZGVBdChpICsgMyldXG4gICAgYXJyW0wrK10gPSAodG1wID4+IDE2KSAmIDB4RkZcbiAgICBhcnJbTCsrXSA9ICh0bXAgPj4gOCkgJiAweEZGXG4gICAgYXJyW0wrK10gPSB0bXAgJiAweEZGXG4gIH1cblxuICBpZiAocGxhY2VIb2xkZXJzID09PSAyKSB7XG4gICAgdG1wID0gKHJldkxvb2t1cFtiNjQuY2hhckNvZGVBdChpKV0gPDwgMikgfCAocmV2TG9va3VwW2I2NC5jaGFyQ29kZUF0KGkgKyAxKV0gPj4gNClcbiAgICBhcnJbTCsrXSA9IHRtcCAmIDB4RkZcbiAgfSBlbHNlIGlmIChwbGFjZUhvbGRlcnMgPT09IDEpIHtcbiAgICB0bXAgPSAocmV2TG9va3VwW2I2NC5jaGFyQ29kZUF0KGkpXSA8PCAxMCkgfCAocmV2TG9va3VwW2I2NC5jaGFyQ29kZUF0KGkgKyAxKV0gPDwgNCkgfCAocmV2TG9va3VwW2I2NC5jaGFyQ29kZUF0KGkgKyAyKV0gPj4gMilcbiAgICBhcnJbTCsrXSA9ICh0bXAgPj4gOCkgJiAweEZGXG4gICAgYXJyW0wrK10gPSB0bXAgJiAweEZGXG4gIH1cblxuICByZXR1cm4gYXJyXG59XG5cbmZ1bmN0aW9uIHRyaXBsZXRUb0Jhc2U2NCAobnVtKSB7XG4gIHJldHVybiBsb29rdXBbbnVtID4+IDE4ICYgMHgzRl0gKyBsb29rdXBbbnVtID4+IDEyICYgMHgzRl0gKyBsb29rdXBbbnVtID4+IDYgJiAweDNGXSArIGxvb2t1cFtudW0gJiAweDNGXVxufVxuXG5mdW5jdGlvbiBlbmNvZGVDaHVuayAodWludDgsIHN0YXJ0LCBlbmQpIHtcbiAgdmFyIHRtcFxuICB2YXIgb3V0cHV0ID0gW11cbiAgZm9yICh2YXIgaSA9IHN0YXJ0OyBpIDwgZW5kOyBpICs9IDMpIHtcbiAgICB0bXAgPSAodWludDhbaV0gPDwgMTYpICsgKHVpbnQ4W2kgKyAxXSA8PCA4KSArICh1aW50OFtpICsgMl0pXG4gICAgb3V0cHV0LnB1c2godHJpcGxldFRvQmFzZTY0KHRtcCkpXG4gIH1cbiAgcmV0dXJuIG91dHB1dC5qb2luKCcnKVxufVxuXG5mdW5jdGlvbiBmcm9tQnl0ZUFycmF5ICh1aW50OCkge1xuICB2YXIgdG1wXG4gIHZhciBsZW4gPSB1aW50OC5sZW5ndGhcbiAgdmFyIGV4dHJhQnl0ZXMgPSBsZW4gJSAzIC8vIGlmIHdlIGhhdmUgMSBieXRlIGxlZnQsIHBhZCAyIGJ5dGVzXG4gIHZhciBvdXRwdXQgPSAnJ1xuICB2YXIgcGFydHMgPSBbXVxuICB2YXIgbWF4Q2h1bmtMZW5ndGggPSAxNjM4MyAvLyBtdXN0IGJlIG11bHRpcGxlIG9mIDNcblxuICAvLyBnbyB0aHJvdWdoIHRoZSBhcnJheSBldmVyeSB0aHJlZSBieXRlcywgd2UnbGwgZGVhbCB3aXRoIHRyYWlsaW5nIHN0dWZmIGxhdGVyXG4gIGZvciAodmFyIGkgPSAwLCBsZW4yID0gbGVuIC0gZXh0cmFCeXRlczsgaSA8IGxlbjI7IGkgKz0gbWF4Q2h1bmtMZW5ndGgpIHtcbiAgICBwYXJ0cy5wdXNoKGVuY29kZUNodW5rKHVpbnQ4LCBpLCAoaSArIG1heENodW5rTGVuZ3RoKSA+IGxlbjIgPyBsZW4yIDogKGkgKyBtYXhDaHVua0xlbmd0aCkpKVxuICB9XG5cbiAgLy8gcGFkIHRoZSBlbmQgd2l0aCB6ZXJvcywgYnV0IG1ha2Ugc3VyZSB0byBub3QgZm9yZ2V0IHRoZSBleHRyYSBieXRlc1xuICBpZiAoZXh0cmFCeXRlcyA9PT0gMSkge1xuICAgIHRtcCA9IHVpbnQ4W2xlbiAtIDFdXG4gICAgb3V0cHV0ICs9IGxvb2t1cFt0bXAgPj4gMl1cbiAgICBvdXRwdXQgKz0gbG9va3VwWyh0bXAgPDwgNCkgJiAweDNGXVxuICAgIG91dHB1dCArPSAnPT0nXG4gIH0gZWxzZSBpZiAoZXh0cmFCeXRlcyA9PT0gMikge1xuICAgIHRtcCA9ICh1aW50OFtsZW4gLSAyXSA8PCA4KSArICh1aW50OFtsZW4gLSAxXSlcbiAgICBvdXRwdXQgKz0gbG9va3VwW3RtcCA+PiAxMF1cbiAgICBvdXRwdXQgKz0gbG9va3VwWyh0bXAgPj4gNCkgJiAweDNGXVxuICAgIG91dHB1dCArPSBsb29rdXBbKHRtcCA8PCAyKSAmIDB4M0ZdXG4gICAgb3V0cHV0ICs9ICc9J1xuICB9XG5cbiAgcGFydHMucHVzaChvdXRwdXQpXG5cbiAgcmV0dXJuIHBhcnRzLmpvaW4oJycpXG59XG4iLCJleHBvcnRzLnJlYWQgPSBmdW5jdGlvbiAoYnVmZmVyLCBvZmZzZXQsIGlzTEUsIG1MZW4sIG5CeXRlcykge1xuICB2YXIgZSwgbVxuICB2YXIgZUxlbiA9IG5CeXRlcyAqIDggLSBtTGVuIC0gMVxuICB2YXIgZU1heCA9ICgxIDw8IGVMZW4pIC0gMVxuICB2YXIgZUJpYXMgPSBlTWF4ID4+IDFcbiAgdmFyIG5CaXRzID0gLTdcbiAgdmFyIGkgPSBpc0xFID8gKG5CeXRlcyAtIDEpIDogMFxuICB2YXIgZCA9IGlzTEUgPyAtMSA6IDFcbiAgdmFyIHMgPSBidWZmZXJbb2Zmc2V0ICsgaV1cblxuICBpICs9IGRcblxuICBlID0gcyAmICgoMSA8PCAoLW5CaXRzKSkgLSAxKVxuICBzID4+PSAoLW5CaXRzKVxuICBuQml0cyArPSBlTGVuXG4gIGZvciAoOyBuQml0cyA+IDA7IGUgPSBlICogMjU2ICsgYnVmZmVyW29mZnNldCArIGldLCBpICs9IGQsIG5CaXRzIC09IDgpIHt9XG5cbiAgbSA9IGUgJiAoKDEgPDwgKC1uQml0cykpIC0gMSlcbiAgZSA+Pj0gKC1uQml0cylcbiAgbkJpdHMgKz0gbUxlblxuICBmb3IgKDsgbkJpdHMgPiAwOyBtID0gbSAqIDI1NiArIGJ1ZmZlcltvZmZzZXQgKyBpXSwgaSArPSBkLCBuQml0cyAtPSA4KSB7fVxuXG4gIGlmIChlID09PSAwKSB7XG4gICAgZSA9IDEgLSBlQmlhc1xuICB9IGVsc2UgaWYgKGUgPT09IGVNYXgpIHtcbiAgICByZXR1cm4gbSA/IE5hTiA6ICgocyA/IC0xIDogMSkgKiBJbmZpbml0eSlcbiAgfSBlbHNlIHtcbiAgICBtID0gbSArIE1hdGgucG93KDIsIG1MZW4pXG4gICAgZSA9IGUgLSBlQmlhc1xuICB9XG4gIHJldHVybiAocyA/IC0xIDogMSkgKiBtICogTWF0aC5wb3coMiwgZSAtIG1MZW4pXG59XG5cbmV4cG9ydHMud3JpdGUgPSBmdW5jdGlvbiAoYnVmZmVyLCB2YWx1ZSwgb2Zmc2V0LCBpc0xFLCBtTGVuLCBuQnl0ZXMpIHtcbiAgdmFyIGUsIG0sIGNcbiAgdmFyIGVMZW4gPSBuQnl0ZXMgKiA4IC0gbUxlbiAtIDFcbiAgdmFyIGVNYXggPSAoMSA8PCBlTGVuKSAtIDFcbiAgdmFyIGVCaWFzID0gZU1heCA+PiAxXG4gIHZhciBydCA9IChtTGVuID09PSAyMyA/IE1hdGgucG93KDIsIC0yNCkgLSBNYXRoLnBvdygyLCAtNzcpIDogMClcbiAgdmFyIGkgPSBpc0xFID8gMCA6IChuQnl0ZXMgLSAxKVxuICB2YXIgZCA9IGlzTEUgPyAxIDogLTFcbiAgdmFyIHMgPSB2YWx1ZSA8IDAgfHwgKHZhbHVlID09PSAwICYmIDEgLyB2YWx1ZSA8IDApID8gMSA6IDBcblxuICB2YWx1ZSA9IE1hdGguYWJzKHZhbHVlKVxuXG4gIGlmIChpc05hTih2YWx1ZSkgfHwgdmFsdWUgPT09IEluZmluaXR5KSB7XG4gICAgbSA9IGlzTmFOKHZhbHVlKSA/IDEgOiAwXG4gICAgZSA9IGVNYXhcbiAgfSBlbHNlIHtcbiAgICBlID0gTWF0aC5mbG9vcihNYXRoLmxvZyh2YWx1ZSkgLyBNYXRoLkxOMilcbiAgICBpZiAodmFsdWUgKiAoYyA9IE1hdGgucG93KDIsIC1lKSkgPCAxKSB7XG4gICAgICBlLS1cbiAgICAgIGMgKj0gMlxuICAgIH1cbiAgICBpZiAoZSArIGVCaWFzID49IDEpIHtcbiAgICAgIHZhbHVlICs9IHJ0IC8gY1xuICAgIH0gZWxzZSB7XG4gICAgICB2YWx1ZSArPSBydCAqIE1hdGgucG93KDIsIDEgLSBlQmlhcylcbiAgICB9XG4gICAgaWYgKHZhbHVlICogYyA+PSAyKSB7XG4gICAgICBlKytcbiAgICAgIGMgLz0gMlxuICAgIH1cblxuICAgIGlmIChlICsgZUJpYXMgPj0gZU1heCkge1xuICAgICAgbSA9IDBcbiAgICAgIGUgPSBlTWF4XG4gICAgfSBlbHNlIGlmIChlICsgZUJpYXMgPj0gMSkge1xuICAgICAgbSA9ICh2YWx1ZSAqIGMgLSAxKSAqIE1hdGgucG93KDIsIG1MZW4pXG4gICAgICBlID0gZSArIGVCaWFzXG4gICAgfSBlbHNlIHtcbiAgICAgIG0gPSB2YWx1ZSAqIE1hdGgucG93KDIsIGVCaWFzIC0gMSkgKiBNYXRoLnBvdygyLCBtTGVuKVxuICAgICAgZSA9IDBcbiAgICB9XG4gIH1cblxuICBmb3IgKDsgbUxlbiA+PSA4OyBidWZmZXJbb2Zmc2V0ICsgaV0gPSBtICYgMHhmZiwgaSArPSBkLCBtIC89IDI1NiwgbUxlbiAtPSA4KSB7fVxuXG4gIGUgPSAoZSA8PCBtTGVuKSB8IG1cbiAgZUxlbiArPSBtTGVuXG4gIGZvciAoOyBlTGVuID4gMDsgYnVmZmVyW29mZnNldCArIGldID0gZSAmIDB4ZmYsIGkgKz0gZCwgZSAvPSAyNTYsIGVMZW4gLT0gOCkge31cblxuICBidWZmZXJbb2Zmc2V0ICsgaSAtIGRdIHw9IHMgKiAxMjhcbn1cbiIsInZhciB0b1N0cmluZyA9IHt9LnRvU3RyaW5nO1xuXG5tb2R1bGUuZXhwb3J0cyA9IEFycmF5LmlzQXJyYXkgfHwgZnVuY3Rpb24gKGFycikge1xuICByZXR1cm4gdG9TdHJpbmcuY2FsbChhcnIpID09ICdbb2JqZWN0IEFycmF5XSc7XG59O1xuIiwiKGZ1bmN0aW9uKCkge1xuICAndXNlIHN0cmljdCc7XG5cbiAgY29uc3QgQVZTID0gcmVxdWlyZSgnLi9saWIvQVZTJyk7XG5cbiAgaWYgKHR5cGVvZiBleHBvcnRzICE9PSAndW5kZWZpbmVkJykge1xuICAgIGlmICh0eXBlb2YgbW9kdWxlICE9PSAndW5kZWZpbmVkJyAmJiBtb2R1bGUuZXhwb3J0cykge1xuICAgICAgZXhwb3J0cyA9IG1vZHVsZS5leHBvcnRzID0gQVZTO1xuICAgIH1cbiAgICBleHBvcnRzLkFWUyA9IEFWUztcbiAgfVxuXG4gIGlmICh0eXBlb2YgZGVmaW5lID09PSAnZnVuY3Rpb24nICYmIGRlZmluZS5hbWQpIHtcbiAgICBkZWZpbmUoW10sIGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIEFWUztcbiAgICB9KTtcbiAgfVxuXG4gIGlmICh0eXBlb2Ygd2luZG93ID09PSAnb2JqZWN0Jykge1xuICAgIHdpbmRvdy5BVlMgPSBBVlM7XG4gIH1cbn0pKCk7XG4iLCIndXNlIHN0cmljdCc7XG5cbmNvbnN0IEJ1ZmZlciA9IHJlcXVpcmUoJ2J1ZmZlcicpLkJ1ZmZlcjtcbmNvbnN0IHFzID0gcmVxdWlyZSgncXMnKTtcbmNvbnN0IGh0dHBNZXNzYWdlUGFyc2VyID0gcmVxdWlyZSgnaHR0cC1tZXNzYWdlLXBhcnNlcicpO1xuXG5jb25zdCBBTUFaT05fRVJST1JfQ09ERVMgPSByZXF1aXJlKCcuL0FtYXpvbkVycm9yQ29kZXMuanMnKTtcbmNvbnN0IE9ic2VydmFibGUgPSByZXF1aXJlKCcuL09ic2VydmFibGUuanMnKTtcbmNvbnN0IFBsYXllciA9IHJlcXVpcmUoJy4vUGxheWVyLmpzJyk7XG5jb25zdCBhcnJheUJ1ZmZlclRvU3RyaW5nID0gcmVxdWlyZSgnLi91dGlscy9hcnJheUJ1ZmZlclRvU3RyaW5nLmpzJyk7XG5jb25zdCB3cml0ZVVURkJ5dGVzID0gcmVxdWlyZSgnLi91dGlscy93cml0ZVVURkJ5dGVzLmpzJyk7XG5jb25zdCBtZXJnZUJ1ZmZlcnMgPSByZXF1aXJlKCcuL3V0aWxzL21lcmdlQnVmZmVycy5qcycpO1xuY29uc3QgaW50ZXJsZWF2ZSA9IHJlcXVpcmUoJy4vdXRpbHMvaW50ZXJsZWF2ZS5qcycpO1xuY29uc3QgZG93bnNhbXBsZUJ1ZmZlciA9IHJlcXVpcmUoJy4vdXRpbHMvZG93bnNhbXBsZUJ1ZmZlci5qcycpO1xuXG5jbGFzcyBBVlMge1xuICBjb25zdHJ1Y3RvcihvcHRpb25zID0ge30pIHtcbiAgICBPYnNlcnZhYmxlKHRoaXMpO1xuXG4gICAgdGhpcy5fYnVmZmVyU2l6ZSA9IDIwNDg7XG4gICAgdGhpcy5faW5wdXRDaGFubmVscyA9IDE7XG4gICAgdGhpcy5fb3V0cHV0Q2hhbm5lbHMgPSAxO1xuICAgIHRoaXMuX2xlZnRDaGFubmVsID0gW107XG4gICAgdGhpcy5fcmlnaHRDaGFubmVsID0gW107XG4gICAgdGhpcy5fYXVkaW9Db250ZXh0ID0gbnVsbDtcbiAgICB0aGlzLl9yZWNvcmRlciA9IG51bGw7XG4gICAgdGhpcy5fc2FtcGxlUmF0ZSA9IG51bGw7XG4gICAgdGhpcy5fb3V0cHV0U2FtcGxlUmF0ZSA9IDE2MDAwO1xuICAgIHRoaXMuX2F1ZGlvSW5wdXQgPSBudWxsO1xuICAgIHRoaXMuX3ZvbHVtZU5vZGUgPSBudWxsO1xuICAgIHRoaXMuX2RlYnVnID0gZmFsc2U7XG4gICAgdGhpcy5fdG9rZW4gPSBudWxsO1xuICAgIHRoaXMuX3JlZnJlc2hUb2tlbiA9IG51bGw7XG4gICAgdGhpcy5fY2xpZW50SWQgPSBudWxsO1xuICAgIHRoaXMuX2NsaWVudFNlY3JldCA9IG51bGw7XG4gICAgdGhpcy5fZGV2aWNlSWQ9IG51bGw7XG4gICAgdGhpcy5fZGV2aWNlU2VyaWFsTnVtYmVyID0gbnVsbDtcbiAgICB0aGlzLl9yZWRpcmVjdFVyaSA9IG51bGw7XG4gICAgdGhpcy5fYXVkaW9RdWV1ZSA9IFtdO1xuXG4gICAgaWYgKG9wdGlvbnMudG9rZW4pIHtcbiAgICAgIHRoaXMuc2V0VG9rZW4ob3B0aW9ucy50b2tlbik7XG4gICAgfVxuXG4gICAgaWYgKG9wdGlvbnMucmVmcmVzaFRva2VuKSB7XG4gICAgICB0aGlzLnNldFJlZnJlc2hUb2tlbihvcHRpb25zLnJlZnJlc2hUb2tlbik7XG4gICAgfVxuXG4gICAgaWYgKG9wdGlvbnMuY2xpZW50SWQpIHtcbiAgICAgIHRoaXMuc2V0Q2xpZW50SWQob3B0aW9ucy5jbGllbnRJZCk7XG4gICAgfVxuXG4gICAgaWYgKG9wdGlvbnMuY2xpZW50U2VjcmV0KSB7XG4gICAgICB0aGlzLnNldENsaWVudFNlY3JldChvcHRpb25zLmNsaWVudFNlY3JldCk7XG4gICAgfVxuXG4gICAgaWYgKG9wdGlvbnMuZGV2aWNlSWQpIHtcbiAgICAgIHRoaXMuc2V0RGV2aWNlSWQob3B0aW9ucy5kZXZpY2VJZCk7XG4gICAgfVxuXG4gICAgaWYgKG9wdGlvbnMuZGV2aWNlU2VyaWFsTnVtYmVyKSB7XG4gICAgICB0aGlzLnNldERldmljZVNlcmlhbE51bWJlcihvcHRpb25zLmRldmljZVNlcmlhbE51bWJlcik7XG4gICAgfVxuXG4gICAgaWYgKG9wdGlvbnMucmVkaXJlY3RVcmkpIHtcbiAgICAgIHRoaXMuc2V0UmVkaXJlY3RVcmkob3B0aW9ucy5yZWRpcmVjdFVyaSk7XG4gICAgfVxuXG4gICAgaWYgKG9wdGlvbnMuZGVidWcpIHtcbiAgICAgIHRoaXMuc2V0RGVidWcob3B0aW9ucy5kZWJ1Zyk7XG4gICAgfVxuXG4gICAgdGhpcy5wbGF5ZXIgPSBuZXcgUGxheWVyKCk7XG4gIH1cblxuICBfbG9nKHR5cGUsIG1lc3NhZ2UpIHtcbiAgICBpZiAodHlwZSAmJiAhbWVzc2FnZSkge1xuICAgICAgbWVzc2FnZSA9IHR5cGU7XG4gICAgICB0eXBlID0gJ2xvZyc7XG4gICAgfVxuXG4gICAgc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICB0aGlzLmVtaXQoQVZTLkV2ZW50VHlwZXMuTE9HLCBtZXNzYWdlKTtcbiAgICB9LCAwKTtcblxuICAgIGlmICh0aGlzLl9kZWJ1Zykge1xuICAgICAgY29uc29sZVt0eXBlXShtZXNzYWdlKTtcbiAgICB9XG4gIH1cblxuICBsb2dpbihvcHRpb25zID0ge30pIHtcbiAgICByZXR1cm4gdGhpcy5wcm9tcHRVc2VyTG9naW4ob3B0aW9ucyk7XG4gIH1cblxuICBsb2dvdXQoKSB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgIHRoaXMuX3Rva2VuID0gbnVsbDtcbiAgICAgIHRoaXMuX3JlZnJlc2hUb2tlbiA9IG51bGw7XG4gICAgICB0aGlzLmVtaXQoQVZTLkV2ZW50VHlwZXMuTE9HT1VUKTtcbiAgICAgIHRoaXMuX2xvZygnTG9nZ2VkIG91dCcpO1xuICAgICAgcmVzb2x2ZSgpO1xuICAgIH0pO1xuICB9XG5cbiAgcHJvbXB0VXNlckxvZ2luKG9wdGlvbnMgPSB7cmVzcG9uc2VUeXBlOiAndG9rZW4nLCBuZXdXaW5kb3c6IGZhbHNlfSkge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICBpZiAodHlwZW9mIG9wdGlvbnMucmVzcG9uc2VUeXBlID09PSAndW5kZWZpbmVkJykge1xuICAgICAgICBvcHRpb25zLnJlc3BvbnNlVHlwZSA9ICd0b2tlbic7XG4gICAgICB9XG5cbiAgICAgIGlmICh0eXBlb2Ygb3B0aW9ucy5yZXNwb25zZVR5cGUgIT09ICdzdHJpbmcnKSB7XG4gICAgICAgIGNvbnN0IGVycm9yID0gbmV3IEVycm9yKCdgcmVzcG9uc2VUeXBlYCBtdXN0IGEgc3RyaW5nLicpO1xuICAgICAgICB0aGlzLl9sb2coZXJyb3IpO1xuICAgICAgICByZXR1cm4gcmVqZWN0KGVycm9yKTtcbiAgICAgIH1cblxuICAgICAgY29uc3QgbmV3V2luZG93ID0gISFvcHRpb25zLm5ld1dpbmRvdztcblxuICAgICAgY29uc3QgcmVzcG9uc2VUeXBlID0gb3B0aW9ucy5yZXNwb25zZVR5cGU7XG5cbiAgICAgIGlmICghKHJlc3BvbnNlVHlwZSA9PT0gJ2NvZGUnIHx8IHJlc3BvbnNlVHlwZSA9PT0gJ3Rva2VuJykpIHtcbiAgICAgICAgY29uc3QgZXJyb3IgPSBuZXcgRXJyb3IoJ2ByZXNwb25zZVR5cGVgIG11c3QgYmUgZWl0aGVyIGBjb2RlYCBvciBgdG9rZW5gLicpO1xuICAgICAgICB0aGlzLl9sb2coZXJyb3IpO1xuICAgICAgICByZXR1cm4gcmVqZWN0KGVycm9yKTtcbiAgICAgIH1cblxuICAgICAgY29uc3Qgc2NvcGUgPSAnYWxleGE6YWxsJztcbiAgICAgIGNvbnN0IHNjb3BlRGF0YSA9IHtcbiAgICAgICAgW3Njb3BlXToge1xuICAgICAgICAgIHByb2R1Y3RJRDogdGhpcy5fZGV2aWNlSWQsXG4gICAgICAgICAgcHJvZHVjdEluc3RhbmNlQXR0cmlidXRlczoge1xuICAgICAgICAgICAgZGV2aWNlU2VyaWFsTnVtYmVyOiB0aGlzLl9kZXZpY2VTZXJpYWxOdW1iZXJcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH07XG5cbiAgICAgIGNvbnN0IGF1dGhVcmwgPSBgaHR0cHM6Ly93d3cuYW1hem9uLmNvbS9hcC9vYT9jbGllbnRfaWQ9JHt0aGlzLl9jbGllbnRJZH0mc2NvcGU9JHtlbmNvZGVVUklDb21wb25lbnQoc2NvcGUpfSZzY29wZV9kYXRhPSR7ZW5jb2RlVVJJQ29tcG9uZW50KEpTT04uc3RyaW5naWZ5KHNjb3BlRGF0YSkpfSZyZXNwb25zZV90eXBlPSR7cmVzcG9uc2VUeXBlfSZyZWRpcmVjdF91cmk9JHtlbmNvZGVVUkkodGhpcy5fcmVkaXJlY3RVcmkpfWBcblxuICAgICAgaWYgKG5ld1dpbmRvdykge1xuICAgICAgICB3aW5kb3cub3BlbihhdXRoVXJsKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHdpbmRvdy5sb2NhdGlvbi5ocmVmID0gYXV0aFVybDtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIGdldFRva2VuRnJvbUNvZGUoY29kZSkge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICBpZiAodHlwZW9mIGNvZGUgIT09ICdzdHJpbmcnKSB7XG4gICAgICAgIGNvbnN0IGVycm9yID0gbmV3IFR5cGVFcnJvcignYGNvZGVgIG11c3QgYmUgYSBzdHJpbmcuJyk7XG4gICAgICAgIHRoaXMuX2xvZyhlcnJvcik7XG4gICAgICAgIHJldHVybiByZWplY3QoZXJyb3IpO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBncmFudFR5cGUgPSAnYXV0aG9yaXphdGlvbl9jb2RlJztcbiAgICAgIGNvbnN0IHBvc3REYXRhID0gYGdyYW50X3R5cGU9JHtncmFudFR5cGV9JmNvZGU9JHtjb2RlfSZjbGllbnRfaWQ9JHt0aGlzLl9jbGllbnRJZH0mY2xpZW50X3NlY3JldD0ke3RoaXMuX2NsaWVudFNlY3JldH0mcmVkaXJlY3RfdXJpPSR7ZW5jb2RlVVJJQ29tcG9uZW50KHRoaXMuX3JlZGlyZWN0VXJpKX1gO1xuICAgICAgY29uc3QgdXJsID0gJ2h0dHBzOi8vYXBpLmFtYXpvbi5jb20vYXV0aC9vMi90b2tlbic7XG5cbiAgICAgIGNvbnN0IHhociA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xuXG4gICAgICB4aHIub3BlbignUE9TVCcsIHVybCwgdHJ1ZSk7XG4gICAgICB4aHIuc2V0UmVxdWVzdEhlYWRlcignQ29udGVudC1UeXBlJywgJ2FwcGxpY2F0aW9uL3gtd3d3LWZvcm0tdXJsZW5jb2RlZDtjaGFyc2V0PVVURi04Jyk7XG4gICAgICB4aHIub25sb2FkID0gKGV2ZW50KSA9PiB7XG4gICAgICAgIGNvbnNvbGUubG9nKCdSRVNQT05TRScsIHhoci5yZXNwb25zZSk7XG5cbiAgICAgICAgbGV0IHJlc3BvbnNlID0geGhyLnJlc3BvbnNlO1xuXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgcmVzcG9uc2UgPSBKU09OLnBhcnNlKHhoci5yZXNwb25zZSk7XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgdGhpcy5fbG9nKGVycm9yKTtcbiAgICAgICAgICByZXR1cm4gcmVqZWN0KGVycm9yKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGlzT2JqZWN0ID0gcmVzcG9uc2UgaW5zdGFuY2VvZiBPYmplY3Q7XG4gICAgICAgIGNvbnN0IGVycm9yRGVzY3JpcHRpb24gPSBpc09iamVjdCAmJiByZXNwb25zZS5lcnJvcl9kZXNjcmlwdGlvbjtcblxuICAgICAgICBpZiAoZXJyb3JEZXNjcmlwdGlvbikge1xuICAgICAgICAgIGNvbnN0IGVycm9yID0gbmV3IEVycm9yKGVycm9yRGVzY3JpcHRpb24pO1xuICAgICAgICAgIHRoaXMuX2xvZyhlcnJvcik7XG4gICAgICAgICAgcmV0dXJuIHJlamVjdChlcnJvcik7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCB0b2tlbiA9IHJlc3BvbnNlLmFjY2Vzc190b2tlbjtcbiAgICAgICAgY29uc3QgcmVmcmVzaFRva2VuID0gcmVzcG9uc2UucmVmcmVzaF90b2tlbjtcbiAgICAgICAgY29uc3QgdG9rZW5UeXBlID0gcmVzcG9uc2UudG9rZW5fdHlwZTtcbiAgICAgICAgY29uc3QgZXhwaXJlc0luID0gcmVzcG9uc2UuZXhwaXJlc0luO1xuXG4gICAgICAgIHRoaXMuc2V0VG9rZW4odG9rZW4pXG4gICAgICAgIHRoaXMuc2V0UmVmcmVzaFRva2VuKHJlZnJlc2hUb2tlbilcblxuICAgICAgICB0aGlzLmVtaXQoQVZTLkV2ZW50VHlwZXMuTE9HSU4pO1xuICAgICAgICB0aGlzLl9sb2coJ0xvZ2dlZCBpbi4nKTtcbiAgICAgICAgcmVzb2x2ZShyZXNwb25zZSk7XG4gICAgICB9O1xuXG4gICAgICB4aHIub25lcnJvciA9IChlcnJvcikgPT4ge1xuICAgICAgICB0aGlzLl9sb2coZXJyb3IpO1xuICAgICAgICByZWplY3QoZXJyb3IpO1xuICAgICAgfTtcblxuICAgICAgeGhyLnNlbmQocG9zdERhdGEpO1xuICAgIH0pO1xuICB9XG5cbiAgcmVmcmVzaFRva2VuKCkge1xuICAgIHJldHVybiB0aGlzLmdldFRva2VuRnJvbVJlZnJlc2hUb2tlbih0aGlzLl9yZWZyZXNoVG9rZW4pXG4gICAgLnRoZW4oKCkgPT4ge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgdG9rZW46IHRoaXMuX3Rva2VuLFxuICAgICAgICByZWZyZXNoVG9rZW46IHRoaXMuX3JlZnJlc2hUb2tlblxuICAgICAgfTtcbiAgICB9KTtcbiAgfVxuXG4gIGdldFRva2VuRnJvbVJlZnJlc2hUb2tlbihyZWZyZXNoVG9rZW4gPSB0aGlzLl9yZWZyZXNoVG9rZW4pIHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgaWYgKHR5cGVvZiByZWZyZXNoVG9rZW4gIT09ICdzdHJpbmcnKSB7XG4gICAgICAgIGNvbnN0IGVycm9yID0gbmV3IEVycm9yKCdgcmVmcmVzaFRva2VuYCBtdXN0IGEgc3RyaW5nLicpO1xuICAgICAgICB0aGlzLl9sb2coZXJyb3IpO1xuICAgICAgICByZXR1cm4gcmVqZWN0KGVycm9yKTtcbiAgICAgIH1cblxuICAgICAgY29uc3QgZ3JhbnRUeXBlID0gJ3JlZnJlc2hfdG9rZW4nO1xuICAgICAgY29uc3QgcG9zdERhdGEgPSBgZ3JhbnRfdHlwZT0ke2dyYW50VHlwZX0mcmVmcmVzaF90b2tlbj0ke3JlZnJlc2hUb2tlbn0mY2xpZW50X2lkPSR7dGhpcy5fY2xpZW50SWR9JmNsaWVudF9zZWNyZXQ9JHt0aGlzLl9jbGllbnRTZWNyZXR9JnJlZGlyZWN0X3VyaT0ke2VuY29kZVVSSUNvbXBvbmVudCh0aGlzLl9yZWRpcmVjdFVyaSl9YDtcbiAgICAgIGNvbnN0IHVybCA9ICdodHRwczovL2FwaS5hbWF6b24uY29tL2F1dGgvbzIvdG9rZW4nO1xuICAgICAgY29uc3QgeGhyID0gbmV3IFhNTEh0dHBSZXF1ZXN0KCk7XG5cbiAgICAgIHhoci5vcGVuKCdQT1NUJywgdXJsLCB0cnVlKTtcbiAgICAgIHhoci5zZXRSZXF1ZXN0SGVhZGVyKCdDb250ZW50LVR5cGUnLCAnYXBwbGljYXRpb24veC13d3ctZm9ybS11cmxlbmNvZGVkO2NoYXJzZXQ9VVRGLTgnKTtcbiAgICAgIHhoci5yZXNwb25zZVR5cGUgPSAnanNvbic7XG4gICAgICB4aHIub25sb2FkID0gKGV2ZW50KSA9PiB7XG4gICAgICAgIGNvbnN0IHJlc3BvbnNlID0geGhyLnJlc3BvbnNlO1xuXG4gICAgICAgIGlmIChyZXNwb25zZS5lcnJvcikge1xuICAgICAgICAgIGNvbnN0IGVycm9yID0gcmVzcG9uc2UuZXJyb3IubWVzc2FnZTtcbiAgICAgICAgICB0aGlzLmVtaXQoQVZTLkV2ZW50VHlwZXMuRVJST1IsIGVycm9yKTtcblxuICAgICAgICAgIHJldHVybiByZWplY3QoZXJyb3IpO1xuICAgICAgICB9IGVsc2UgIHtcbiAgICAgICAgICBjb25zdCB0b2tlbiA9IHJlc3BvbnNlLmFjY2Vzc190b2tlbjtcbiAgICAgICAgICBjb25zdCByZWZyZXNoVG9rZW4gPSByZXNwb25zZS5yZWZyZXNoX3Rva2VuO1xuXG4gICAgICAgICAgdGhpcy5zZXRUb2tlbih0b2tlbik7XG4gICAgICAgICAgdGhpcy5zZXRSZWZyZXNoVG9rZW4ocmVmcmVzaFRva2VuKTtcblxuICAgICAgICAgIHJldHVybiByZXNvbHZlKHRva2VuKTtcbiAgICAgICAgfVxuICAgICAgfTtcblxuICAgICAgeGhyLm9uZXJyb3IgPSAoZXJyb3IpID0+IHtcbiAgICAgICAgdGhpcy5fbG9nKGVycm9yKTtcbiAgICAgICAgcmVqZWN0KGVycm9yKTtcbiAgICAgIH07XG5cbiAgICAgIHhoci5zZW5kKHBvc3REYXRhKTtcbiAgICB9KTtcbiAgfVxuXG4gIGdldFRva2VuRnJvbVVybCgpIHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgbGV0IGhhc2ggPSB3aW5kb3cubG9jYXRpb24uaGFzaC5zdWJzdHIoMSk7XG5cbiAgICAgIGNvbnN0IHF1ZXJ5ID0gcXMucGFyc2UoaGFzaCk7XG4gICAgICBjb25zdCB0b2tlbiA9IHF1ZXJ5LmFjY2Vzc190b2tlbjtcbiAgICAgIGNvbnN0IHJlZnJlc2hUb2tlbiA9IHF1ZXJ5LnJlZnJlc2hfdG9rZW47XG4gICAgICBjb25zdCB0b2tlblR5cGUgPSBxdWVyeS50b2tlbl90eXBlO1xuICAgICAgY29uc3QgZXhwaXJlc0luID0gcXVlcnkuZXhwaXJlc0luO1xuXG4gICAgICBpZiAodG9rZW4pIHtcbiAgICAgICAgdGhpcy5zZXRUb2tlbih0b2tlbilcbiAgICAgICAgdGhpcy5lbWl0KEFWUy5FdmVudFR5cGVzLkxPR0lOKTtcbiAgICAgICAgdGhpcy5fbG9nKCdMb2dnZWQgaW4uJyk7XG5cbiAgICAgICAgaWYgKHJlZnJlc2hUb2tlbikge1xuICAgICAgICAgIHRoaXMuc2V0UmVmcmVzaFRva2VuKHJlZnJlc2hUb2tlbik7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gcmVzb2x2ZSh0b2tlbik7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiByZWplY3QoKTtcbiAgICB9KTtcbiAgfVxuXG4gIGdldENvZGVGcm9tVXJsKCkge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICBjb25zdCBxdWVyeSA9IHFzLnBhcnNlKHdpbmRvdy5sb2NhdGlvbi5zZWFyY2guc3Vic3RyKDEpKTtcbiAgICAgIGNvbnN0IGNvZGUgPSBxdWVyeS5jb2RlO1xuXG4gICAgICBpZiAoY29kZSkge1xuICAgICAgICByZXR1cm4gcmVzb2x2ZShjb2RlKTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHJlamVjdChudWxsKTtcbiAgICB9KTtcbiAgfVxuXG4gIHNldFRva2VuKHRva2VuKSB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgIGlmICh0eXBlb2YgdG9rZW4gPT09ICdzdHJpbmcnKSB7XG4gICAgICAgIHRoaXMuX3Rva2VuID0gdG9rZW47XG4gICAgICAgIHRoaXMuZW1pdChBVlMuRXZlbnRUeXBlcy5UT0tFTl9TRVQpO1xuICAgICAgICB0aGlzLl9sb2coJ1Rva2VuIHNldC4nKTtcbiAgICAgICAgcmVzb2x2ZSh0aGlzLl90b2tlbik7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb25zdCBlcnJvciA9IG5ldyBUeXBlRXJyb3IoJ2B0b2tlbmAgbXVzdCBiZSBhIHN0cmluZy4nKTtcbiAgICAgICAgdGhpcy5fbG9nKGVycm9yKTtcbiAgICAgICAgcmVqZWN0KGVycm9yKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIHNldFJlZnJlc2hUb2tlbihyZWZyZXNoVG9rZW4pIHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgaWYgKHR5cGVvZiByZWZyZXNoVG9rZW4gPT09ICdzdHJpbmcnKSB7XG4gICAgICAgIHRoaXMuX3JlZnJlc2hUb2tlbiA9IHJlZnJlc2hUb2tlbjtcbiAgICAgICAgdGhpcy5lbWl0KEFWUy5FdmVudFR5cGVzLlJFRlJFU0hfVE9LRU5fU0VUKTtcbiAgICAgICAgdGhpcy5fbG9nKCdSZWZyZXNoIHRva2VuIHNldC4nKTtcbiAgICAgICAgcmVzb2x2ZSh0aGlzLl9yZWZyZXNoVG9rZW4pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uc3QgZXJyb3IgPSBuZXcgVHlwZUVycm9yKCdgcmVmcmVzaFRva2VuYCBtdXN0IGJlIGEgc3RyaW5nLicpO1xuICAgICAgICB0aGlzLl9sb2coZXJyb3IpO1xuICAgICAgICByZWplY3QoZXJyb3IpO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgc2V0Q2xpZW50SWQoY2xpZW50SWQpIHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgaWYgKHR5cGVvZiBjbGllbnRJZCA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgdGhpcy5fY2xpZW50SWQgPSBjbGllbnRJZDtcbiAgICAgICAgcmVzb2x2ZSh0aGlzLl9jbGllbnRJZCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb25zdCBlcnJvciA9IG5ldyBUeXBlRXJyb3IoJ2BjbGllbnRJZGAgbXVzdCBiZSBhIHN0cmluZy4nKTtcbiAgICAgICAgdGhpcy5fbG9nKGVycm9yKTtcbiAgICAgICAgcmVqZWN0KGVycm9yKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIHNldENsaWVudFNlY3JldChjbGllbnRTZWNyZXQpIHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgaWYgKHR5cGVvZiBjbGllbnRTZWNyZXQgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgIHRoaXMuX2NsaWVudFNlY3JldCA9IGNsaWVudFNlY3JldDtcbiAgICAgICAgcmVzb2x2ZSh0aGlzLl9jbGllbnRTZWNyZXQpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uc3QgZXJyb3IgPSBuZXcgVHlwZUVycm9yKCdgY2xpZW50U2VjcmV0YCBtdXN0IGJlIGEgc3RyaW5nJyk7XG4gICAgICAgIHRoaXMuX2xvZyhlcnJvcik7XG4gICAgICAgIHJlamVjdChlcnJvcik7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICBzZXREZXZpY2VJZChkZXZpY2VJZCkge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICBpZiAodHlwZW9mIGRldmljZUlkID09PSAnc3RyaW5nJykge1xuICAgICAgICB0aGlzLl9kZXZpY2VJZCA9IGRldmljZUlkO1xuICAgICAgICByZXNvbHZlKHRoaXMuX2RldmljZUlkKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnN0IGVycm9yID0gbmV3IFR5cGVFcnJvcignYGRldmljZUlkYCBtdXN0IGJlIGEgc3RyaW5nLicpO1xuICAgICAgICB0aGlzLl9sb2coZXJyb3IpO1xuICAgICAgICByZWplY3QoZXJyb3IpO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgc2V0RGV2aWNlU2VyaWFsTnVtYmVyKGRldmljZVNlcmlhbE51bWJlcikge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICBpZiAodHlwZW9mIGRldmljZVNlcmlhbE51bWJlciA9PT0gJ251bWJlcicgfHwgdHlwZW9mIGRldmljZVNlcmlhbE51bWJlciA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgdGhpcy5fZGV2aWNlU2VyaWFsTnVtYmVyID0gZGV2aWNlU2VyaWFsTnVtYmVyO1xuICAgICAgICByZXNvbHZlKHRoaXMuX2RldmljZVNlcmlhbE51bWJlcik7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb25zdCBlcnJvciA9IG5ldyBUeXBlRXJyb3IoJ2BkZXZpY2VTZXJpYWxOdW1iZXJgIG11c3QgYmUgYSBudW1iZXIgb3Igc3RyaW5nLicpO1xuICAgICAgICB0aGlzLl9sb2coZXJyb3IpO1xuICAgICAgICByZWplY3QoZXJyb3IpO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgc2V0UmVkaXJlY3RVcmkocmVkaXJlY3RVcmkpIHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgaWYgKHR5cGVvZiByZWRpcmVjdFVyaSA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgdGhpcy5fcmVkaXJlY3RVcmkgPSByZWRpcmVjdFVyaTtcbiAgICAgICAgcmVzb2x2ZSh0aGlzLl9yZWRpcmVjdFVyaSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb25zdCBlcnJvciA9IG5ldyBUeXBlRXJyb3IoJ2ByZWRpcmVjdFVyaWAgbXVzdCBiZSBhIHN0cmluZy4nKTtcbiAgICAgICAgdGhpcy5fbG9nKGVycm9yKTtcbiAgICAgICAgcmVqZWN0KGVycm9yKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIHNldERlYnVnKGRlYnVnKSB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgIGlmICh0eXBlb2YgZGVidWcgPT09ICdib29sZWFuJykge1xuICAgICAgICB0aGlzLl9kZWJ1ZyA9IGRlYnVnO1xuICAgICAgICByZXNvbHZlKHRoaXMuX2RlYnVnKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnN0IGVycm9yID0gbmV3IFR5cGVFcnJvcignYGRlYnVnYCBtdXN0IGJlIGEgYm9vbGVhbi4nKTtcbiAgICAgICAgdGhpcy5fbG9nKGVycm9yKTtcbiAgICAgICAgcmVqZWN0KGVycm9yKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIGdldFRva2VuKCkge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICBjb25zdCB0b2tlbiA9IHRoaXMuX3Rva2VuO1xuXG4gICAgICBpZiAodG9rZW4pIHtcbiAgICAgICAgcmV0dXJuIHJlc29sdmUodG9rZW4pO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gcmVqZWN0KCk7XG4gICAgfSk7XG4gIH1cblxuICBnZXRSZWZyZXNoVG9rZW4oKSB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgIGNvbnN0IHJlZnJlc2hUb2tlbiA9IHRoaXMuX3JlZnJlc2hUb2tlbjtcblxuICAgICAgaWYgKHJlZnJlc2hUb2tlbikge1xuICAgICAgICByZXR1cm4gcmVzb2x2ZShyZWZyZXNoVG9rZW4pO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gcmVqZWN0KCk7XG4gICAgfSk7XG4gIH1cblxuICByZXF1ZXN0TWljKCkge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICB0aGlzLl9sb2coJ1JlcXVlc3RpbmcgbWljcm9waG9uZS4nKTtcblxuICAgICAgLy8gRW5zdXJlIHRoYXQgdGhlIGZpbGUgY2FuIGJlIGxvYWRlZCBpbiBlbnZpcm9ubWVudHMgd2hlcmUgbmF2aWdhdG9yIGlzIG5vdCBkZWZpbmVkIChub2RlIHNlcnZlcnMpXG4gICAgICBpZiAoIW5hdmlnYXRvci5nZXRVc2VyTWVkaWEpIHtcbiAgICAgICAgbmF2aWdhdG9yLmdldFVzZXJNZWRpYSA9IG5hdmlnYXRvci5nZXRVc2VyTWVkaWEgfHwgbmF2aWdhdG9yLndlYmtpdEdldFVzZXJNZWRpYSB8fFxuICAgICAgICAgIG5hdmlnYXRvci5tb3pHZXRVc2VyTWVkaWEgfHwgbmF2aWdhdG9yLm1zR2V0VXNlck1lZGlhO1xuICAgICAgfVxuXG4gICAgICBuYXZpZ2F0b3IuZ2V0VXNlck1lZGlhKHtcbiAgICAgICAgYXVkaW86IHRydWVcbiAgICAgIH0sIChzdHJlYW0pID0+IHtcbiAgICAgICAgdGhpcy5fbG9nKCdNaWNyb3Bob25lIGNvbm5lY3RlZC4nKTtcbiAgICAgICAgcmV0dXJuIHRoaXMuY29ubmVjdE1lZGlhU3RyZWFtKHN0cmVhbSkudGhlbihyZXNvbHZlKTtcbiAgICAgIH0sIChlcnJvcikgPT4ge1xuICAgICAgICB0aGlzLl9sb2coJ2Vycm9yJywgZXJyb3IpO1xuICAgICAgICB0aGlzLmVtaXQoQVZTLkV2ZW50VHlwZXMuRVJST1IsIGVycm9yKTtcbiAgICAgICAgcmV0dXJuIHJlamVjdChlcnJvcik7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxuXG4gIGNvbm5lY3RNZWRpYVN0cmVhbShzdHJlYW0pIHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgY29uc3QgaXNNZWRpYVN0cmVhbSA9IE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChzdHJlYW0pID09PSAnW29iamVjdCBNZWRpYVN0cmVhbV0nO1xuXG4gICAgICBpZiAoIWlzTWVkaWFTdHJlYW0pIHtcbiAgICAgICAgY29uc3QgZXJyb3IgPSBuZXcgVHlwZUVycm9yKCdBcmd1bWVudCBtdXN0IGJlIGEgYE1lZGlhU3RyZWFtYCBvYmplY3QuJylcbiAgICAgICAgdGhpcy5fbG9nKCdlcnJvcicsIGVycm9yKVxuICAgICAgICB0aGlzLmVtaXQoQVZTLkV2ZW50VHlwZXMuRVJST1IsIGVycm9yKTtcbiAgICAgICAgcmV0dXJuIHJlamVjdChlcnJvcik7XG4gICAgICB9XG5cbiAgICAgIHRoaXMuX2F1ZGlvQ29udGV4dCA9IG5ldyBBdWRpb0NvbnRleHQoKTtcbiAgICAgIHRoaXMuX3NhbXBsZVJhdGUgPSB0aGlzLl9hdWRpb0NvbnRleHQuc2FtcGxlUmF0ZTtcblxuICAgICAgdGhpcy5fbG9nKGBTYW1wbGUgcmF0ZTogJHt0aGlzLl9zYW1wbGVSYXRlfS5gKTtcblxuICAgICAgdGhpcy5fdm9sdW1lTm9kZSA9IHRoaXMuX2F1ZGlvQ29udGV4dC5jcmVhdGVHYWluKCk7XG4gICAgICB0aGlzLl9hdWRpb0lucHV0ID0gdGhpcy5fYXVkaW9Db250ZXh0LmNyZWF0ZU1lZGlhU3RyZWFtU291cmNlKHN0cmVhbSk7XG5cbiAgICAgIHRoaXMuX2F1ZGlvSW5wdXQuY29ubmVjdCh0aGlzLl92b2x1bWVOb2RlKTtcblxuICAgICAgdGhpcy5fcmVjb3JkZXIgPSB0aGlzLl9hdWRpb0NvbnRleHQuY3JlYXRlU2NyaXB0UHJvY2Vzc29yKHRoaXMuX2J1ZmZlclNpemUsIHRoaXMuX2lucHV0Q2hhbm5lbHMsIHRoaXMuX291dHB1dENoYW5uZWxzKTtcblxuICAgICAgdGhpcy5fcmVjb3JkZXIub25hdWRpb3Byb2Nlc3MgPSAoZXZlbnQpID0+IHtcbiAgICAgICAgaWYgKCF0aGlzLl9pc1JlY29yZGluZykge1xuICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGxlZnQgPSBldmVudC5pbnB1dEJ1ZmZlci5nZXRDaGFubmVsRGF0YSgwKTtcbiAgICAgICAgdGhpcy5fbGVmdENoYW5uZWwucHVzaChuZXcgRmxvYXQzMkFycmF5KGxlZnQpKTtcblxuICAgICAgICBpZiAodGhpcy5faW5wdXRDaGFubmVscyA+IDEpIHtcbiAgICAgICAgICBjb25zdCByaWdodCA9IGV2ZW50LmlucHV0QnVmZmVyLmdldENoYW5uZWxEYXRhKDEpO1xuICAgICAgICAgIHRoaXMuX3JpZ2h0Q2hhbm5lbC5wdXNoKG5ldyBGbG9hdDMyQXJyYXkocmlnaHQpKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX3JlY29yZGluZ0xlbmd0aCArPSB0aGlzLl9idWZmZXJTaXplO1xuICAgICAgfTtcblxuICAgICAgdGhpcy5fdm9sdW1lTm9kZS5jb25uZWN0KHRoaXMuX3JlY29yZGVyKTtcbiAgICAgIHRoaXMuX3JlY29yZGVyLmNvbm5lY3QodGhpcy5fYXVkaW9Db250ZXh0LmRlc3RpbmF0aW9uKTtcbiAgICAgIHRoaXMuX2xvZyhgTWVkaWEgc3RyZWFtIGNvbm5lY3RlZC5gKTtcblxuICAgICAgcmV0dXJuIHJlc29sdmUoc3RyZWFtKTtcbiAgICB9KTtcbiAgfVxuXG4gIHN0YXJ0UmVjb3JkaW5nKCkge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICBpZiAoIXRoaXMuX2F1ZGlvSW5wdXQpIHtcbiAgICAgICAgY29uc3QgZXJyb3IgPSBuZXcgRXJyb3IoJ05vIE1lZGlhIFN0cmVhbSBjb25uZWN0ZWQuJyk7XG4gICAgICAgIHRoaXMuX2xvZygnZXJyb3InLCBlcnJvcik7XG4gICAgICAgIHRoaXMuZW1pdChBVlMuRXZlbnRUeXBlcy5FUlJPUiwgZXJyb3IpO1xuICAgICAgICByZXR1cm4gcmVqZWN0KGVycm9yKTtcbiAgICAgIH1cblxuICAgICAgdGhpcy5faXNSZWNvcmRpbmcgPSB0cnVlO1xuICAgICAgdGhpcy5fbGVmdENoYW5uZWwubGVuZ3RoID0gdGhpcy5fcmlnaHRDaGFubmVsLmxlbmd0aCA9IDA7XG4gICAgICB0aGlzLl9yZWNvcmRpbmdMZW5ndGggPSAwO1xuICAgICAgdGhpcy5fbG9nKGBSZWNvcmRpbmcgc3RhcnRlZC5gKTtcbiAgICAgIHRoaXMuZW1pdChBVlMuRXZlbnRUeXBlcy5SRUNPUkRfU1RBUlQpO1xuXG4gICAgICByZXR1cm4gcmVzb2x2ZSgpO1xuICAgIH0pO1xuICB9XG5cbiAgc3RvcFJlY29yZGluZygpIHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgaWYgKCF0aGlzLl9pc1JlY29yZGluZykge1xuICAgICAgICB0aGlzLmVtaXQoQVZTLkV2ZW50VHlwZXMuUkVDT1JEX1NUT1ApO1xuICAgICAgICB0aGlzLl9sb2coJ1JlY29yZGluZyBzdG9wcGVkLicpO1xuICAgICAgICByZXR1cm4gcmVzb2x2ZSgpO1xuICAgICAgfVxuXG4gICAgICB0aGlzLl9pc1JlY29yZGluZyA9IGZhbHNlO1xuXG4gICAgICBjb25zdCBsZWZ0QnVmZmVyID0gbWVyZ2VCdWZmZXJzKHRoaXMuX2xlZnRDaGFubmVsLCB0aGlzLl9yZWNvcmRpbmdMZW5ndGgpO1xuICAgICAgbGV0IGludGVybGVhdmVkID0gbnVsbDtcblxuICAgICAgaWYgKHRoaXMuX291dHB1dENoYW5uZWxzID4gMSkge1xuICAgICAgICBjb25zdCByaWdodEJ1ZmZlciA9IG1lcmdlQnVmZmVycyh0aGlzLl9yaWdodENoYW5uZWwsIHRoaXMuX3JlY29yZGluZ0xlbmd0aCk7XG4gICAgICAgIGludGVybGVhdmVkID0gaW50ZXJsZWF2ZShsZWZ0QnVmZmVyLCByaWdodEJ1ZmZlcik7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBpbnRlcmxlYXZlZCA9IGludGVybGVhdmUobGVmdEJ1ZmZlcik7XG4gICAgICB9XG5cbiAgICAgIGludGVybGVhdmVkID0gZG93bnNhbXBsZUJ1ZmZlcihpbnRlcmxlYXZlZCwgdGhpcy5fc2FtcGxlUmF0ZSwgdGhpcy5fb3V0cHV0U2FtcGxlUmF0ZSk7XG5cbiAgICAgIGNvbnN0IGJ1ZmZlciA9IG5ldyBBcnJheUJ1ZmZlcig0NCArIGludGVybGVhdmVkLmxlbmd0aCAqIDIpO1xuICAgICAgY29uc3QgdmlldyA9IG5ldyBEYXRhVmlldyhidWZmZXIpO1xuXG4gICAgICAvKipcbiAgICAgICAqIEBjcmVkaXQgaHR0cHM6Ly9naXRodWIuY29tL21hdHRkaWFtb25kL1JlY29yZGVyanNcbiAgICAgICAqL1xuICAgICAgd3JpdGVVVEZCeXRlcyh2aWV3LCAwLCAnUklGRicpO1xuICAgICAgdmlldy5zZXRVaW50MzIoNCwgNDQgKyBpbnRlcmxlYXZlZC5sZW5ndGggKiAyLCB0cnVlKTtcbiAgICAgIHdyaXRlVVRGQnl0ZXModmlldywgOCwgJ1dBVkUnKTtcbiAgICAgIHdyaXRlVVRGQnl0ZXModmlldywgMTIsICdmbXQgJyk7XG4gICAgICB2aWV3LnNldFVpbnQzMigxNiwgMTYsIHRydWUpO1xuICAgICAgdmlldy5zZXRVaW50MTYoMjAsIDEsIHRydWUpO1xuICAgICAgdmlldy5zZXRVaW50MTYoMjIsIHRoaXMuX291dHB1dENoYW5uZWxzLCB0cnVlKTtcbiAgICAgIHZpZXcuc2V0VWludDMyKDI0LCB0aGlzLl9vdXRwdXRTYW1wbGVSYXRlLCB0cnVlKTtcbiAgICAgIHZpZXcuc2V0VWludDMyKDI4LCB0aGlzLl9vdXRwdXRTYW1wbGVSYXRlICogNCwgdHJ1ZSk7XG4gICAgICB2aWV3LnNldFVpbnQxNigzMiwgNCwgdHJ1ZSk7XG4gICAgICB2aWV3LnNldFVpbnQxNigzNCwgMTYsIHRydWUpO1xuICAgICAgd3JpdGVVVEZCeXRlcyh2aWV3LCAzNiwgJ2RhdGEnKTtcbiAgICAgIHZpZXcuc2V0VWludDMyKDQwLCBpbnRlcmxlYXZlZC5sZW5ndGggKiAyLCB0cnVlKTtcblxuICAgICAgY29uc3QgbGVuZ3RoID0gaW50ZXJsZWF2ZWQubGVuZ3RoO1xuICAgICAgY29uc3Qgdm9sdW1lID0gMTtcbiAgICAgIGxldCBpbmRleCA9IDQ0O1xuXG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGxlbmd0aDsgaSsrKXtcbiAgICAgICAgdmlldy5zZXRJbnQxNihpbmRleCwgaW50ZXJsZWF2ZWRbaV0gKiAoMHg3RkZGICogdm9sdW1lKSwgdHJ1ZSk7XG4gICAgICAgIGluZGV4ICs9IDI7XG4gICAgICB9XG5cbiAgICAgIHRoaXMuX2xvZyhgUmVjb3JkaW5nIHN0b3BwZWQuYCk7XG4gICAgICB0aGlzLmVtaXQoQVZTLkV2ZW50VHlwZXMuUkVDT1JEX1NUT1ApO1xuICAgICAgcmV0dXJuIHJlc29sdmUodmlldyk7XG4gICAgfSk7XG4gIH1cblxuICBzZW5kQXVkaW8gKGRhdGFWaWV3KSB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgIGNvbnN0IHhociA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xuICAgICAgY29uc3QgdXJsID0gJ2h0dHBzOi8vYWNjZXNzLWFsZXhhLW5hLmFtYXpvbi5jb20vdjEvYXZzL3NwZWVjaHJlY29nbml6ZXIvcmVjb2duaXplJztcblxuICAgICAgeGhyLm9wZW4oJ1BPU1QnLCB1cmwsIHRydWUpO1xuICAgICAgeGhyLnJlc3BvbnNlVHlwZSA9ICdhcnJheWJ1ZmZlcic7XG4gICAgICB4aHIub25sb2FkID0gKGV2ZW50KSA9PiB7XG4gICAgICAgIGNvbnNvbGUubG9nKCdSRVNQT05TRScsIHhoci5yZXNwb25zZSk7XG5cbiAgICAgICAgY29uc3QgYnVmZmVyID0gbmV3IEJ1ZmZlcih4aHIucmVzcG9uc2UpO1xuXG4gICAgICAgIGlmICh4aHIuc3RhdHVzID09PSAyMDApIHtcbiAgICAgICAgICBjb25zdCBwYXJzZWRNZXNzYWdlID0gaHR0cE1lc3NhZ2VQYXJzZXIoYnVmZmVyKTtcbiAgICAgICAgICByZXNvbHZlKHBhcnNlZE1lc3NhZ2UpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGxldCBlcnJvciA9IG5ldyBFcnJvcignQW4gZXJyb3Igb2NjdXJlZCB3aXRoIHJlcXVlc3QuJyk7XG4gICAgICAgICAgbGV0IHJlc3BvbnNlID0ge307XG5cbiAgICAgICAgICBpZiAoIXhoci5yZXNwb25zZS5ieXRlTGVuZ3RoKSB7XG4gICAgICAgICAgICBlcnJvciA9IG5ldyBFcnJvcignRW1wdHkgcmVzcG9uc2UuJyk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgIHJlc3BvbnNlID0gSlNPTi5wYXJzZShhcnJheUJ1ZmZlclRvU3RyaW5nKGJ1ZmZlcikpO1xuICAgICAgICAgICAgfSBjYXRjaChlcnIpIHtcbiAgICAgICAgICAgICAgZXJyb3IgPSBlcnI7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgaWYgKHJlc3BvbnNlLmVycm9yIGluc3RhbmNlb2YgT2JqZWN0KSB7XG4gICAgICAgICAgICBpZiAocmVzcG9uc2UuZXJyb3IuY29kZSA9PT0gQU1BWk9OX0VSUk9SX0NPREVTLkludmFsaWRBY2Nlc3NUb2tlbkV4Y2VwdGlvbikge1xuICAgICAgICAgICAgICB0aGlzLmVtaXQoQVZTLkV2ZW50VHlwZXMuVE9LRU5fSU5WQUxJRCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGVycm9yID0gcmVzcG9uc2UuZXJyb3IubWVzc2FnZTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICB0aGlzLmVtaXQoQVZTLkV2ZW50VHlwZXMuRVJST1IsIGVycm9yKTtcbiAgICAgICAgICByZXR1cm4gcmVqZWN0KGVycm9yKTtcbiAgICAgICAgfVxuICAgICAgfTtcblxuICAgICAgeGhyLm9uZXJyb3IgPSAoZXJyb3IpID0+IHtcbiAgICAgICAgdGhpcy5fbG9nKGVycm9yKTtcbiAgICAgICAgcmVqZWN0KGVycm9yKTtcbiAgICAgIH07XG5cbiAgICAgIGNvbnN0IEJPVU5EQVJZID0gJ0JPVU5EQVJZMTIzNCc7XG4gICAgICBjb25zdCBCT1VOREFSWV9EQVNIRVMgPSAnLS0nO1xuICAgICAgY29uc3QgTkVXTElORSA9ICdcXHJcXG4nO1xuICAgICAgY29uc3QgTUVUQURBVEFfQ09OVEVOVF9ESVNQT1NJVElPTiA9ICdDb250ZW50LURpc3Bvc2l0aW9uOiBmb3JtLWRhdGE7IG5hbWU9XCJtZXRhZGF0YVwiJztcbiAgICAgIGNvbnN0IE1FVEFEQVRBX0NPTlRFTlRfVFlQRSA9ICdDb250ZW50LVR5cGU6IGFwcGxpY2F0aW9uL2pzb247IGNoYXJzZXQ9VVRGLTgnO1xuICAgICAgY29uc3QgQVVESU9fQ09OVEVOVF9UWVBFID0gJ0NvbnRlbnQtVHlwZTogYXVkaW8vTDE2OyByYXRlPTE2MDAwOyBjaGFubmVscz0xJztcbiAgICAgIGNvbnN0IEFVRElPX0NPTlRFTlRfRElTUE9TSVRJT04gPSAnQ29udGVudC1EaXNwb3NpdGlvbjogZm9ybS1kYXRhOyBuYW1lPVwiYXVkaW9cIic7XG5cbiAgICAgIGNvbnN0IG1ldGFkYXRhID0ge1xuICAgICAgICBtZXNzYWdlSGVhZGVyOiB7fSxcbiAgICAgICAgbWVzc2FnZUJvZHk6IHtcbiAgICAgICAgICBwcm9maWxlOiAnYWxleGEtY2xvc2UtdGFsaycsXG4gICAgICAgICAgbG9jYWxlOiAnZW4tdXMnLFxuICAgICAgICAgIGZvcm1hdDogJ2F1ZGlvL0wxNjsgcmF0ZT0xNjAwMDsgY2hhbm5lbHM9MSdcbiAgICAgICAgfVxuICAgICAgfTtcblxuICAgICAgY29uc3QgcG9zdERhdGFTdGFydCA9IFtcbiAgICAgICAgTkVXTElORSwgQk9VTkRBUllfREFTSEVTLCBCT1VOREFSWSwgTkVXTElORSwgTUVUQURBVEFfQ09OVEVOVF9ESVNQT1NJVElPTiwgTkVXTElORSwgTUVUQURBVEFfQ09OVEVOVF9UWVBFLFxuICAgICAgICBORVdMSU5FLCBORVdMSU5FLCBKU09OLnN0cmluZ2lmeShtZXRhZGF0YSksIE5FV0xJTkUsIEJPVU5EQVJZX0RBU0hFUywgQk9VTkRBUlksIE5FV0xJTkUsXG4gICAgICAgIEFVRElPX0NPTlRFTlRfRElTUE9TSVRJT04sIE5FV0xJTkUsIEFVRElPX0NPTlRFTlRfVFlQRSwgTkVXTElORSwgTkVXTElORVxuICAgICAgXS5qb2luKCcnKTtcblxuICAgICAgY29uc3QgcG9zdERhdGFFbmQgPSBbTkVXTElORSwgQk9VTkRBUllfREFTSEVTLCBCT1VOREFSWSwgQk9VTkRBUllfREFTSEVTLCBORVdMSU5FXS5qb2luKCcnKTtcblxuICAgICAgY29uc3Qgc2l6ZSA9IHBvc3REYXRhU3RhcnQubGVuZ3RoICsgZGF0YVZpZXcuYnl0ZUxlbmd0aCArIHBvc3REYXRhRW5kLmxlbmd0aDtcbiAgICAgIGNvbnN0IHVpbnQ4QXJyYXkgPSBuZXcgVWludDhBcnJheShzaXplKTtcbiAgICAgIGxldCBpID0gMDtcblxuICAgICAgZm9yICg7IGkgPCBwb3N0RGF0YVN0YXJ0Lmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHVpbnQ4QXJyYXlbaV0gPSBwb3N0RGF0YVN0YXJ0LmNoYXJDb2RlQXQoaSkgJiAweEZGO1xuICAgICAgfVxuXG4gICAgICBmb3IgKGxldCBqID0gMDsgaiA8IGRhdGFWaWV3LmJ5dGVMZW5ndGggOyBpKyssIGorKykge1xuICAgICAgICB1aW50OEFycmF5W2ldID0gZGF0YVZpZXcuZ2V0VWludDgoaik7XG4gICAgICB9XG5cbiAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgcG9zdERhdGFFbmQubGVuZ3RoOyBpKyssIGorKykge1xuICAgICAgICB1aW50OEFycmF5W2ldID0gcG9zdERhdGFFbmQuY2hhckNvZGVBdChqKSAmIDB4RkY7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IHBheWxvYWQgPSB1aW50OEFycmF5LmJ1ZmZlcjtcblxuICAgICAgeGhyLnNldFJlcXVlc3RIZWFkZXIoJ0F1dGhvcml6YXRpb24nLCBgQmVhcmVyICR7dGhpcy5fdG9rZW59YCk7XG4gICAgICB4aHIuc2V0UmVxdWVzdEhlYWRlcignQ29udGVudC1UeXBlJywgJ211bHRpcGFydC9mb3JtLWRhdGE7IGJvdW5kYXJ5PScgKyBCT1VOREFSWSk7XG4gICAgICB4aHIuc2VuZChwYXlsb2FkKTtcbiAgICB9KTtcbiAgfVxuXG4gIHN0YXRpYyBnZXQgRXZlbnRUeXBlcygpIHtcbiAgICByZXR1cm4ge1xuICAgICAgTE9HOiAnbG9nJyxcbiAgICAgIEVSUk9SOiAnZXJyb3InLFxuICAgICAgTE9HSU46ICdsb2dpbicsXG4gICAgICBMT0dPVVQ6ICdsb2dvdXQnLFxuICAgICAgUkVDT1JEX1NUQVJUOiAncmVjb3JkU3RhcnQnLFxuICAgICAgUkVDT1JEX1NUT1A6ICdyZWNvcmRTdG9wJyxcbiAgICAgIFRPS0VOX1NFVDogJ3Rva2VuU2V0JyxcbiAgICAgIFJFRlJFU0hfVE9LRU5fU0VUOiAncmVmcmVzaFRva2VuU2V0JyxcbiAgICAgIFRPS0VOX0lOVkFMSUQ6ICd0b2tlbkludmFsaWQnXG4gICAgfTtcbiAgfVxuXG4gIHN0YXRpYyBnZXQgUGxheWVyKCkge1xuICAgIHJldHVybiBQbGF5ZXI7XG4gIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSBBVlM7XG4iLCIndXNlIHN0cmljdCc7XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICBJbnZhbGlkQWNjZXNzVG9rZW5FeGNlcHRpb246ICdjb20uYW1hem9uLmFsZXhhaHR0cHByb3h5LmV4Y2VwdGlvbnMuSW52YWxpZEFjY2Vzc1Rva2VuRXhjZXB0aW9uJ1xufTtcbiIsIid1c2Ugc3RyaWN0JztcblxuZnVuY3Rpb24gT2JzZXJ2YWJsZShlbCkge1xuICBsZXQgY2FsbGJhY2tzID0ge307XG5cbiAgZWwub24gPSBmdW5jdGlvbihuYW1lLCBmbikge1xuICAgIGlmICh0eXBlb2YgZm4gIT09ICdmdW5jdGlvbicpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ1NlY29uZCBhcmd1bWVudCBmb3IgXCJvblwiIG1ldGhvZCBtdXN0IGJlIGEgZnVuY3Rpb24uJyk7XG4gICAgfVxuXG4gICAgKGNhbGxiYWNrc1tuYW1lXSA9IGNhbGxiYWNrc1tuYW1lXSB8fCBbXSkucHVzaChmbik7XG5cbiAgICByZXR1cm4gZWw7XG4gIH07XG5cbiAgZWwub25lID0gZnVuY3Rpb24obmFtZSwgZm4pIHtcbiAgICBmbi5vbmUgPSB0cnVlO1xuICAgIHJldHVybiBlbC5vbi5jYWxsKGVsLCBuYW1lLCBmbik7XG4gIH07XG5cbiAgZWwub2ZmID0gZnVuY3Rpb24obmFtZSwgZm4pIHtcbiAgICBpZiAobmFtZSA9PT0gJyonKSB7XG4gICAgICBjYWxsYmFja3MgPSB7fTtcbiAgICAgIHJldHVybiBjYWxsYmFja3NcbiAgICB9XG5cbiAgICBpZiAoIWNhbGxiYWNrc1tuYW1lXSkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIGlmIChmbikge1xuICAgICAgaWYgKHR5cGVvZiBmbiAhPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdTZWNvbmQgYXJndW1lbnQgZm9yIFwib2ZmXCIgbWV0aG9kIG11c3QgYmUgYSBmdW5jdGlvbi4nKTtcbiAgICAgIH1cblxuICAgICAgY2FsbGJhY2tzW25hbWVdID0gY2FsbGJhY2tzW25hbWVdLm1hcChmdW5jdGlvbihmbSwgaSkge1xuICAgICAgICBpZiAoZm0gPT09IGZuKSB7XG4gICAgICAgICAgY2FsbGJhY2tzW25hbWVdLnNwbGljZShpLCAxKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGRlbGV0ZSBjYWxsYmFja3NbbmFtZV07XG4gICAgfVxuICB9O1xuXG4gIGVsLmVtaXQgPSBmdW5jdGlvbihuYW1lIC8qLCBhcmdzICovKSB7XG4gICAgaWYgKCFjYWxsYmFja3NbbmFtZV0gfHwgIWNhbGxiYWNrc1tuYW1lXS5sZW5ndGgpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCBhcmdzID0gW10uc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpO1xuXG4gICAgY2FsbGJhY2tzW25hbWVdLmZvckVhY2goZnVuY3Rpb24oZm4sIGkpIHtcbiAgICAgIGlmIChmbikge1xuICAgICAgICBmbi5hcHBseShmbiwgYXJncyk7XG4gICAgICAgIGlmIChmbi5vbmUpIHtcbiAgICAgICAgICBjYWxsYmFja3NbbmFtZV0uc3BsaWNlKGksIDEpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICByZXR1cm4gZWw7XG4gIH07XG5cbiAgcmV0dXJuIGVsO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IE9ic2VydmFibGU7XG4iLCIndXNlIHN0cmljdCc7XG5cbmNvbnN0IE9ic2VydmFibGUgPSByZXF1aXJlKCcuL09ic2VydmFibGUnKTtcbmNvbnN0IGFycmF5QnVmZmVyVG9BdWRpb0J1ZmZlciA9IHJlcXVpcmUoJy4vdXRpbHMvYXJyYXlCdWZmZXJUb0F1ZGlvQnVmZmVyJyk7XG5jb25zdCB0b1N0cmluZyA9IE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmc7XG5cbmNsYXNzIFBsYXllciB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHdpbmRvdy5BdWRpb0NvbnRleHQgPSB3aW5kb3cuQXVkaW9Db250ZXh0IHx8IHdpbmRvdy53ZWJraXRBdWRpb0NvbnRleHQ7XG5cbiAgICB0aGlzLl9xdWV1ZSA9IFtdO1xuICAgIHRoaXMuX2N1cnJlbnRTb3VyY2UgPSBudWxsO1xuICAgIHRoaXMuX2N1cnJlbnRCdWZmZXIgPSBudWxsO1xuICAgIHRoaXMuX2NvbnRleHQgPSBuZXcgQXVkaW9Db250ZXh0KCk7XG5cbiAgICBPYnNlcnZhYmxlKHRoaXMpO1xuICB9XG5cbiAgX2xvZyh0eXBlLCBtZXNzYWdlKSB7XG4gICAgaWYgKHR5cGUgJiYgIW1lc3NhZ2UpIHtcbiAgICAgIG1lc3NhZ2UgPSB0eXBlO1xuICAgICAgdHlwZSA9ICdsb2cnO1xuICAgIH1cblxuICAgIHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgdGhpcy5lbWl0KFBsYXllci5FdmVudFR5cGVzLkxPRywgbWVzc2FnZSk7XG4gICAgfSwgMCk7XG5cbiAgICBpZiAodGhpcy5fZGVidWcpIHtcbiAgICAgIGNvbnNvbGVbdHlwZV0obWVzc2FnZSk7XG4gICAgfVxuICB9XG5cbiAgZW1wdHlRdWV1ZSgpIHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgdGhpcy5fcXVldWUgPSBbXTtcbiAgICAgIHJlc29sdmUoKTtcbiAgICB9KTtcbiAgfVxuXG4gIGVucXVldWUoaXRlbSkge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICBpZiAoIWl0ZW0pIHtcbiAgICAgICAgY29uc3QgZXJyb3IgPSBuZXcgRXJyb3IoJ2FyZ3VtZW50IGNhbm5vdCBiZSBlbXB0eS4nKTtcbiAgICAgICAgdGhpcy5fbG9nKGVycm9yKTtcbiAgICAgICAgcmV0dXJuIHJlamVjdChlcnJvcik7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IHN0cmluZ1R5cGUgPSB0b1N0cmluZy5jYWxsKGl0ZW0pO1xuXG4gICAgICBjb25zdCBwcm9jZWVkID0gKGF1ZGlvQnVmZmVyKSA9PiB7XG4gICAgICAgIHRoaXMuX3F1ZXVlLnB1c2goYXVkaW9CdWZmZXIpO1xuICAgICAgICB0aGlzLl9sb2coJ0VucXVldWUgYXVkaW8nKTtcbiAgICAgICAgdGhpcy5lbWl0KFBsYXllci5FdmVudFR5cGVzLkVOUVVFVUUpO1xuICAgICAgICByZXR1cm4gcmVzb2x2ZShhdWRpb0J1ZmZlcik7XG4gICAgICB9O1xuXG4gICAgICBpZiAoc3RyaW5nVHlwZSA9PT0gJ1tvYmplY3QgRGF0YVZpZXddJyB8fCBzdHJpbmdUeXBlID09PSAnW29iamVjdCBVaW50OEFycmF5XScpIHtcbiAgICAgICAgYXJyYXlCdWZmZXJUb0F1ZGlvQnVmZmVyKGl0ZW0uYnVmZmVyLCB0aGlzLl9jb250ZXh0KVxuICAgICAgICAudGhlbihwcm9jZWVkKTtcbiAgICAgIH0gZWxzZSBpZiAoc3RyaW5nVHlwZSA9PT0gJ1tvYmplY3QgQXVkaW9CdWZmZXJdJykge1xuICAgICAgICBwcm9jZWVkKGl0ZW0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uc3QgZXJyb3IgPSBuZXcgRXJyb3IoJ0ludmFsaWQgdHlwZS4nKTtcbiAgICAgICAgdGhpcy5lbWl0KCdlcnJvcicsIGVycm9yKTtcbiAgICAgICAgcmV0dXJuIHJlamVjdChlcnJvcik7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICBkZXF1ZSgpIHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgY29uc3QgaXRlbSA9IHRoaXMuX3F1ZXVlLnNoaWZ0KCk7XG5cbiAgICAgIGlmIChpdGVtKSB7XG4gICAgICAgIHRoaXMuX2xvZygnRGVxdWUgYXVkaW8nKTtcbiAgICAgICAgdGhpcy5lbWl0KFBsYXllci5FdmVudFR5cGVzLkRFUVVFKTtcbiAgICAgICAgcmV0dXJuIHJlc29sdmUoaXRlbSk7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiByZWplY3QoKTtcbiAgICB9KTtcbiAgfVxuXG4gIHBsYXkoKSB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgIGlmICh0aGlzLl9jb250ZXh0LnN0YXRlID09PSAnc3VzcGVuZGVkJykge1xuICAgICAgICB0aGlzLl9jb250ZXh0LnJlc3VtZSgpO1xuXG4gICAgICAgIHRoaXMuX2xvZygnUGxheSBhdWRpbycpO1xuICAgICAgICB0aGlzLmVtaXQoUGxheWVyLkV2ZW50VHlwZXMuUExBWSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gdGhpcy5kZXF1ZSgpXG4gICAgICAgIC50aGVuKGF1ZGlvQnVmZmVyID0+IHtcbiAgICAgICAgICB0aGlzLnBsYXlBdWRpb0J1ZmZlcihhdWRpb0J1ZmZlcilcblxuICAgICAgICAgIHRoaXMuX2xvZygnUGxheSBhdWRpbycpO1xuICAgICAgICAgIHRoaXMuZW1pdChQbGF5ZXIuRXZlbnRUeXBlcy5QTEFZKTtcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICBzdG9wKCkge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgIGlmICh0aGlzLl9jdXJyZW50U291cmNlKSB7XG4gICAgICAgICAgdGhpcy5fY3VycmVudFNvdXJjZS5vbmVuZGVkID0gZnVuY3Rpb24oKSB7fTtcbiAgICAgICAgICB0aGlzLl9jdXJyZW50U291cmNlLnN0b3AoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX2xvZygnU3RvcCBhdWRpbycpO1xuICAgICAgICB0aGlzLmVtaXQoUGxheWVyLkV2ZW50VHlwZXMuU1RPUCk7XG4gICAgfSk7XG4gIH1cblxuICBwYXVzZSgpIHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICBpZiAodGhpcy5fY29udGV4dC5zdGF0ZSA9PT0gJ3J1bm5pbmcnKSB7XG4gICAgICAgICAgdGhpcy5fY29udGV4dC5zdXNwZW5kKCk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9sb2coJ1BhdXNlIGF1ZGlvJyk7XG4gICAgICAgIHRoaXMuZW1pdChQbGF5ZXIuRXZlbnRUeXBlcy5QQVVTRSk7XG4gICAgfSk7XG4gIH1cblxuICByZXBsYXkoKSB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgaWYgKHRoaXMuX2N1cnJlbnRCdWZmZXIpIHtcbiAgICAgICAgICB0aGlzLl9sb2coJ1JlcGxheSBhdWRpbycpO1xuICAgICAgICAgIHRoaXMuZW1pdChQbGF5ZXIuRXZlbnRUeXBlcy5SRVBMQVkpO1xuXG4gICAgICAgICAgaWYgKHRoaXMuX2NvbnRleHQuc3RhdGUgPT09ICdzdXNwZW5kZWQnKSB7XG4gICAgICAgICAgICB0aGlzLl9jb250ZXh0LnJlc3VtZSgpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIHRoaXMuX2N1cnJlbnRTb3VyY2Uuc3RvcCgpO1xuICAgICAgICAgIHRoaXMuX2N1cnJlbnRTb3VyY2Uub25lbmRlZCA9IGZ1bmN0aW9uKCkge307XG5cbiAgICAgICAgICByZXR1cm4gdGhpcy5wbGF5QXVkaW9CdWZmZXIodGhpcy5fY3VycmVudEJ1ZmZlcik7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgY29uc3QgZXJyb3IgPSBuZXcgRXJyb3IoJ05vIGF1ZGlvIHNvdXJjZSBsb2FkZWQuJyk7XG4gICAgICAgICAgdGhpcy5lbWl0KCdlcnJvcicsIGVycm9yKVxuICAgICAgICAgIHJlamVjdCgpO1xuICAgICAgICB9XG4gICAgfSk7XG4gIH1cblxuICBwbGF5QmxvYihibG9iKSB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgIGlmICghYmxvYikge1xuICAgICAgICByZWplY3QoKTtcbiAgICAgIH1cblxuICAgICAgY29uc3Qgb2JqZWN0VXJsID0gVVJMLmNyZWF0ZU9iamVjdFVSTChibG9iKTtcbiAgICAgIGNvbnN0IGF1ZGlvID0gbmV3IEF1ZGlvKCk7XG4gICAgICBhdWRpby5zcmMgPSBvYmplY3RVcmw7XG5cbiAgICAgIGF1ZGlvLmFkZEV2ZW50TGlzdGVuZXIoJ2VuZGVkJywgKCkgPT4ge1xuICAgICAgICB0aGlzLl9sb2coJ0F1ZGlvIGVuZGVkJyk7XG4gICAgICAgIHRoaXMuZW1pdChQbGF5ZXIuRXZlbnRUeXBlcy5FTkRFRCk7XG4gICAgICB9KTtcblxuICAgICAgYXVkaW8ub25sb2FkID0gKGV2ZW50KSA9PiB7XG4gICAgICAgIFVSTC5yZXZva2VPYmplY3RVcmwob2JqZWN0VXJsKTtcbiAgICAgIH07XG5cbiAgICAgIHRoaXMuX2xvZygnQXVkaW8gcGxheSBzdGFydGVkLicpO1xuICAgICAgYXVkaW8ucGxheSgpO1xuXG4gICAgICByZXNvbHZlKCk7XG4gICAgfSk7XG4gIH1cblxuICBwbGF5QXVkaW9CdWZmZXIoYnVmZmVyKSB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgIGNvbnN0IHNvdXJjZSA9IHRoaXMuX2NvbnRleHQuY3JlYXRlQnVmZmVyU291cmNlKCk7XG4gICAgICBzb3VyY2UuYnVmZmVyID0gYnVmZmVyO1xuICAgICAgc291cmNlLmNvbm5lY3QodGhpcy5fY29udGV4dC5kZXN0aW5hdGlvbik7XG4gICAgICBzb3VyY2Uuc3RhcnQoMCk7XG4gICAgICB0aGlzLl9jdXJyZW50QnVmZmVyID0gYnVmZmVyO1xuICAgICAgdGhpcy5fY3VycmVudFNvdXJjZSA9IHNvdXJjZTtcblxuICAgICAgc291cmNlLm9uZW5kZWQgPSAoZXZlbnQpID0+IHtcbiAgICAgICAgdGhpcy5fbG9nKCdBdWRpbyBlbmRlZCcpO1xuICAgICAgICB0aGlzLmVtaXQoUGxheWVyLkV2ZW50VHlwZXMuRU5ERUQpO1xuICAgICAgfTtcblxuICAgICAgc291cmNlLm9uZXJyb3IgPSAoZXJyb3IpID0+IHtcbiAgICAgICAgdGhpcy5lbWl0KCdlcnJvcicsIGVycm9yKTtcbiAgICAgIH07XG5cbiAgICAgIHJlc29sdmUoKTtcbiAgICB9KTtcbiAgfVxuXG4gIHN0YXRpYyBnZXQgRXZlbnRUeXBlcygpIHtcbiAgICByZXR1cm4ge1xuICAgICAgTE9HOiAnbG9nJyxcbiAgICAgIEVSUk9SOiAnZXJyb3InLFxuICAgICAgUExBWTogJ3BsYXknLFxuICAgICAgUkVQTEFZOiAncmVwbGF5JyxcbiAgICAgIFBBVVNFOiAncGF1c2UnLFxuICAgICAgU1RPUDogJ3BhdXNlJyxcbiAgICAgIEVOUVVFVUU6ICdlbnF1ZXVlJyxcbiAgICAgIERFUVVFOiAnZGVxdWUnXG4gICAgfTtcbiAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IFBsYXllcjtcbiIsIid1c2Ugc3RyaWN0JztcblxuZnVuY3Rpb24gYXJyYXlCdWZmZXJUb0F1ZGlvQnVmZmVyKGFycmF5QnVmZmVyLCBjb250ZXh0KSB7XG4gIHdpbmRvdy5BdWRpb0NvbnRleHQgPSB3aW5kb3cuQXVkaW9Db250ZXh0IHx8IHdpbmRvdy53ZWJraXRBdWRpb0NvbnRleHQ7XG5cbiAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICBpZiAoY29udGV4dCkge1xuICAgICAgaWYgKE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChjb250ZXh0KSAhPT0gJ1tvYmplY3QgQXVkaW9Db250ZXh0XScpIHtcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignYGNvbnRleHRgIG11c3QgYmUgYW4gQXVkaW9Db250ZXh0Jyk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnRleHQgPSBuZXcgQXVkaW9Db250ZXh0KCk7XG4gICAgfVxuXG4gICAgY29udGV4dC5kZWNvZGVBdWRpb0RhdGEoYXJyYXlCdWZmZXIsIHJlc29sdmUsIHJlamVjdCk7XG4gIH0pO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGFycmF5QnVmZmVyVG9BdWRpb0J1ZmZlcjtcbiIsIid1c2Ugc3RyaWN0JztcblxuLyoqXG4gKiBAY3JlZGl0IGh0dHBzOi8vZGV2ZWxvcGVycy5nb29nbGUuY29tL3dlYi91cGRhdGVzLzIwMTIvMDYvSG93LXRvLWNvbnZlcnQtQXJyYXlCdWZmZXItdG8tYW5kLWZyb20tU3RyaW5nP2hsPWVuXG4gKi9cbmZ1bmN0aW9uIGFycmF5QnVmZmVyVG9TdHJpbmcoYnVmZmVyKSB7XG4gIHJldHVybiBTdHJpbmcuZnJvbUNoYXJDb2RlLmFwcGx5KG51bGwsIG5ldyBVaW50MTZBcnJheShidWZmZXIpKTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBhcnJheUJ1ZmZlclRvU3RyaW5nO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG4vKipcbiAqIEBjcmVkaXQgaHR0cDovL3N0YWNrb3ZlcmZsb3cuY29tL2EvMjYyNDUyNjBcbiAqL1xuZnVuY3Rpb24gZG93bnNhbXBsZUJ1ZmZlcihidWZmZXIsIGlucHV0U2FtcGxlUmF0ZSwgb3V0cHV0U2FtcGxlUmF0ZSkge1xuICBpZiAoaW5wdXRTYW1wbGVSYXRlID09PSBvdXRwdXRTYW1wbGVSYXRlKSB7XG4gICAgcmV0dXJuIGJ1ZmZlcjtcbiAgfVxuXG4gIGlmIChpbnB1dFNhbXBsZVJhdGUgPCBvdXRwdXRTYW1wbGVSYXRlKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdPdXRwdXQgc2FtcGxlIHJhdGUgbXVzdCBiZSBsZXNzIHRoYW4gaW5wdXQgc2FtcGxlIHJhdGUuJyk7XG4gIH1cblxuICBjb25zdCBzYW1wbGVSYXRlUmF0aW8gPSBpbnB1dFNhbXBsZVJhdGUgLyBvdXRwdXRTYW1wbGVSYXRlO1xuICBjb25zdCBuZXdMZW5ndGggPSBNYXRoLnJvdW5kKGJ1ZmZlci5sZW5ndGggLyBzYW1wbGVSYXRlUmF0aW8pO1xuICBsZXQgcmVzdWx0ID0gbmV3IEZsb2F0MzJBcnJheShuZXdMZW5ndGgpO1xuICBsZXQgb2Zmc2V0UmVzdWx0ID0gMDtcbiAgbGV0IG9mZnNldEJ1ZmZlciA9IDA7XG5cbiAgd2hpbGUgKG9mZnNldFJlc3VsdCA8IHJlc3VsdC5sZW5ndGgpIHtcbiAgICBsZXQgbmV4dE9mZnNldEJ1ZmZlciA9IE1hdGgucm91bmQoKG9mZnNldFJlc3VsdCArIDEpICogc2FtcGxlUmF0ZVJhdGlvKTtcbiAgICBsZXQgYWNjdW0gPSAwO1xuICAgIGxldCBjb3VudCA9IDA7XG5cbiAgICBmb3IgKHZhciBpID0gb2Zmc2V0QnVmZmVyOyBpIDwgbmV4dE9mZnNldEJ1ZmZlciAmJiBpIDwgYnVmZmVyLmxlbmd0aDsgaSsrKSB7XG4gICAgICBhY2N1bSArPSBidWZmZXJbaV07XG4gICAgICBjb3VudCsrO1xuICAgIH1cblxuICAgIHJlc3VsdFtvZmZzZXRSZXN1bHRdID0gYWNjdW0gLyBjb3VudDtcbiAgICBvZmZzZXRSZXN1bHQrKztcbiAgICBvZmZzZXRCdWZmZXIgPSBuZXh0T2Zmc2V0QnVmZmVyO1xuICB9XG5cbiAgcmV0dXJuIHJlc3VsdDtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBkb3duc2FtcGxlQnVmZmVyO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG4vKipcbiAqIEBjcmVkaXQgaHR0cHM6Ly9naXRodWIuY29tL21hdHRkaWFtb25kL1JlY29yZGVyanNcbiAqL1xuZnVuY3Rpb24gaW50ZXJsZWF2ZShsZWZ0Q2hhbm5lbCwgcmlnaHRDaGFubmVsKSB7XG4gIGlmIChsZWZ0Q2hhbm5lbCAmJiAhcmlnaHRDaGFubmVsKSB7XG4gICAgcmV0dXJuIGxlZnRDaGFubmVsO1xuICB9XG5cbiAgY29uc3QgbGVuZ3RoID0gbGVmdENoYW5uZWwubGVuZ3RoICsgcmlnaHRDaGFubmVsLmxlbmd0aDtcbiAgbGV0IHJlc3VsdCA9IG5ldyBGbG9hdDMyQXJyYXkobGVuZ3RoKTtcbiAgbGV0IGlucHV0SW5kZXggPSAwO1xuXG4gIGZvciAobGV0IGluZGV4ID0gMDsgaW5kZXggPCBsZW5ndGg7ICl7XG4gICAgcmVzdWx0W2luZGV4KytdID0gbGVmdENoYW5uZWxbaW5wdXRJbmRleF07XG4gICAgcmVzdWx0W2luZGV4KytdID0gcmlnaHRDaGFubmVsW2lucHV0SW5kZXhdO1xuICAgIGlucHV0SW5kZXgrKztcbiAgfVxuXG4gIHJldHVybiByZXN1bHQ7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gaW50ZXJsZWF2ZTtcbiIsIid1c2Ugc3RyaWN0JztcblxuLyoqXG4gKiBAY3JlZGl0IGh0dHBzOi8vZ2l0aHViLmNvbS9tYXR0ZGlhbW9uZC9SZWNvcmRlcmpzXG4gKi9cbmZ1bmN0aW9uIG1lcmdlQnVmZmVycyhjaGFubmVsQnVmZmVyLCByZWNvcmRpbmdMZW5ndGgpe1xuICBjb25zdCByZXN1bHQgPSBuZXcgRmxvYXQzMkFycmF5KHJlY29yZGluZ0xlbmd0aCk7XG4gIGNvbnN0IGxlbmd0aCA9IGNoYW5uZWxCdWZmZXIubGVuZ3RoO1xuICBsZXQgb2Zmc2V0ID0gMDtcblxuICBmb3IgKGxldCBpID0gMDsgaSA8IGxlbmd0aDsgaSsrKXtcbiAgICBsZXQgYnVmZmVyID0gY2hhbm5lbEJ1ZmZlcltpXTtcblxuICAgIHJlc3VsdC5zZXQoYnVmZmVyLCBvZmZzZXQpO1xuICAgIG9mZnNldCArPSBidWZmZXIubGVuZ3RoO1xuICB9XG5cbiAgcmV0dXJuIHJlc3VsdDtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBtZXJnZUJ1ZmZlcnM7XG4iLCIndXNlIHN0cmljdCc7XG5cbi8qKlxuICogQGNyZWRpdCBodHRwczovL2dpdGh1Yi5jb20vbWF0dGRpYW1vbmQvUmVjb3JkZXJqc1xuICovXG5mdW5jdGlvbiB3cml0ZVVURkJ5dGVzKHZpZXcsIG9mZnNldCwgc3RyaW5nKSB7XG4gIGNvbnN0IGxlbmd0aCA9IHN0cmluZy5sZW5ndGg7XG5cbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBsZW5ndGg7IGkrKyl7XG4gICAgdmlldy5zZXRVaW50OChvZmZzZXQgKyBpLCBzdHJpbmcuY2hhckNvZGVBdChpKSk7XG4gIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSB3cml0ZVVURkJ5dGVzO1xuIiwiKGZ1bmN0aW9uKHJvb3QpIHtcbiAgJ3VzZSBzdHJpY3QnO1xuXG4gIGZ1bmN0aW9uIGh0dHBNZXNzYWdlUGFyc2VyKG1lc3NhZ2UpIHtcbiAgICBjb25zdCByZXN1bHQgPSB7XG4gICAgICBodHRwVmVyc2lvbjogbnVsbCxcbiAgICAgIHN0YXR1c0NvZGU6IG51bGwsXG4gICAgICBzdGF0dXNNZXNzYWdlOiBudWxsLFxuICAgICAgbWV0aG9kOiBudWxsLFxuICAgICAgdXJsOiBudWxsLFxuICAgICAgaGVhZGVyczogbnVsbCxcbiAgICAgIGJvZHk6IG51bGwsXG4gICAgICBib3VuZGFyeTogbnVsbCxcbiAgICAgIG11bHRpcGFydDogbnVsbFxuICAgIH07XG5cbiAgICB2YXIgbWVzc2FnZVN0cmluZyA9ICcnO1xuICAgIHZhciBoZWFkZXJOZXdsaW5lSW5kZXggPSAwO1xuICAgIHZhciBmdWxsQm91bmRhcnkgPSBudWxsO1xuXG4gICAgaWYgKGh0dHBNZXNzYWdlUGFyc2VyLl9pc0J1ZmZlcihtZXNzYWdlKSkge1xuICAgICAgbWVzc2FnZVN0cmluZyA9IG1lc3NhZ2UudG9TdHJpbmcoKTtcbiAgICB9IGVsc2UgaWYgKHR5cGVvZiBtZXNzYWdlID09PSAnc3RyaW5nJykge1xuICAgICAgbWVzc2FnZVN0cmluZyA9IG1lc3NhZ2U7XG4gICAgICBtZXNzYWdlID0gaHR0cE1lc3NhZ2VQYXJzZXIuX2NyZWF0ZUJ1ZmZlcihtZXNzYWdlU3RyaW5nKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9XG5cbiAgICAvKlxuICAgICAqIFN0cmlwIGV4dHJhIHJldHVybiBjaGFyYWN0ZXJzXG4gICAgICovXG4gICAgbWVzc2FnZVN0cmluZyA9IG1lc3NhZ2VTdHJpbmcucmVwbGFjZSgvXFxyXFxuL2dpbSwgJ1xcbicpO1xuXG4gICAgLypcbiAgICAgKiBUcmltIGxlYWRpbmcgd2hpdGVzcGFjZVxuICAgICAqL1xuICAgIChmdW5jdGlvbigpIHtcbiAgICAgIGNvbnN0IGZpcnN0Tm9uV2hpdGVzcGFjZVJlZ2V4ID0gL1tcXHctXSsvZ2ltO1xuICAgICAgY29uc3QgZmlyc3ROb25XaGl0ZXNwYWNlSW5kZXggPSBtZXNzYWdlU3RyaW5nLnNlYXJjaChmaXJzdE5vbldoaXRlc3BhY2VSZWdleCk7XG4gICAgICBpZiAoZmlyc3ROb25XaGl0ZXNwYWNlSW5kZXggPiAwKSB7XG4gICAgICAgIG1lc3NhZ2UgPSBtZXNzYWdlLnNsaWNlKGZpcnN0Tm9uV2hpdGVzcGFjZUluZGV4LCBtZXNzYWdlLmxlbmd0aCk7XG4gICAgICAgIG1lc3NhZ2VTdHJpbmcgPSBtZXNzYWdlLnRvU3RyaW5nKCk7XG4gICAgICB9XG4gICAgfSkoKTtcblxuICAgIC8qIFBhcnNlIHJlcXVlc3QgbGluZVxuICAgICAqL1xuICAgIChmdW5jdGlvbigpIHtcbiAgICAgIGNvbnN0IHBvc3NpYmxlUmVxdWVzdExpbmUgPSBtZXNzYWdlU3RyaW5nLnNwbGl0KC9cXG58XFxyXFxuLylbMF07XG4gICAgICBjb25zdCByZXF1ZXN0TGluZU1hdGNoID0gcG9zc2libGVSZXF1ZXN0TGluZS5tYXRjaChodHRwTWVzc2FnZVBhcnNlci5fcmVxdWVzdExpbmVSZWdleCk7XG5cbiAgICAgIGlmIChBcnJheS5pc0FycmF5KHJlcXVlc3RMaW5lTWF0Y2gpICYmIHJlcXVlc3RMaW5lTWF0Y2gubGVuZ3RoID4gMSkge1xuICAgICAgICByZXN1bHQuaHR0cFZlcnNpb24gPSBwYXJzZUZsb2F0KHJlcXVlc3RMaW5lTWF0Y2hbMV0pO1xuICAgICAgICByZXN1bHQuc3RhdHVzQ29kZSA9IHBhcnNlSW50KHJlcXVlc3RMaW5lTWF0Y2hbMl0pO1xuICAgICAgICByZXN1bHQuc3RhdHVzTWVzc2FnZSA9IHJlcXVlc3RMaW5lTWF0Y2hbM107XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb25zdCByZXNwb25zZUxpbmVNYXRoID0gcG9zc2libGVSZXF1ZXN0TGluZS5tYXRjaChodHRwTWVzc2FnZVBhcnNlci5fcmVzcG9uc2VMaW5lUmVnZXgpO1xuICAgICAgICBpZiAoQXJyYXkuaXNBcnJheShyZXNwb25zZUxpbmVNYXRoKSAmJiByZXNwb25zZUxpbmVNYXRoLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgICByZXN1bHQubWV0aG9kID0gcmVzcG9uc2VMaW5lTWF0aFsxXTtcbiAgICAgICAgICByZXN1bHQudXJsID0gcmVzcG9uc2VMaW5lTWF0aFsyXTtcbiAgICAgICAgICByZXN1bHQuaHR0cFZlcnNpb24gPSBwYXJzZUZsb2F0KHJlc3BvbnNlTGluZU1hdGhbM10pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSkoKTtcblxuICAgIC8qIFBhcnNlIGhlYWRlcnNcbiAgICAgKi9cbiAgICAoZnVuY3Rpb24oKSB7XG4gICAgICBoZWFkZXJOZXdsaW5lSW5kZXggPSBtZXNzYWdlU3RyaW5nLnNlYXJjaChodHRwTWVzc2FnZVBhcnNlci5faGVhZGVyTmV3bGluZVJlZ2V4KTtcbiAgICAgIGlmIChoZWFkZXJOZXdsaW5lSW5kZXggPiAtMSkge1xuICAgICAgICBoZWFkZXJOZXdsaW5lSW5kZXggPSBoZWFkZXJOZXdsaW5lSW5kZXggKyAxOyAvLyAxIGZvciBuZXdsaW5lIGxlbmd0aFxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLyogVGhlcmUncyBubyBsaW5lIGJyZWFrcyBzbyBjaGVjayBpZiByZXF1ZXN0IGxpbmUgZXhpc3RzXG4gICAgICAgICAqIGJlY2F1c2UgdGhlIG1lc3NhZ2UgbWlnaHQgYmUgYWxsIGhlYWRlcnMgYW5kIG5vIGJvZHlcbiAgICAgICAgICovXG4gICAgICAgIGlmIChyZXN1bHQuaHR0cFZlcnNpb24pIHtcbiAgICAgICAgICBoZWFkZXJOZXdsaW5lSW5kZXggPSBtZXNzYWdlU3RyaW5nLmxlbmd0aDtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBjb25zdCBoZWFkZXJzU3RyaW5nID0gbWVzc2FnZVN0cmluZy5zdWJzdHIoMCwgaGVhZGVyTmV3bGluZUluZGV4KTtcbiAgICAgIGNvbnN0IGhlYWRlcnMgPSBodHRwTWVzc2FnZVBhcnNlci5fcGFyc2VIZWFkZXJzKGhlYWRlcnNTdHJpbmcpO1xuXG4gICAgICBpZiAoT2JqZWN0LmtleXMoaGVhZGVycykubGVuZ3RoID4gMCkge1xuICAgICAgICByZXN1bHQuaGVhZGVycyA9IGhlYWRlcnM7XG5cbiAgICAgICAgLy8gVE9PRDogZXh0cmFjdCBib3VuZGFyeS5cbiAgICAgIH1cbiAgICB9KSgpO1xuXG4gICAgLyogVHJ5IHRvIGdldCBib3VuZGFyeSBpZiBubyBib3VuZGFyeSBoZWFkZXJcbiAgICAgKi9cbiAgICAoZnVuY3Rpb24oKSB7XG4gICAgICBpZiAoIXJlc3VsdC5ib3VuZGFyeSkge1xuICAgICAgICBjb25zdCBib3VuZGFyeU1hdGNoID0gbWVzc2FnZVN0cmluZy5tYXRjaChodHRwTWVzc2FnZVBhcnNlci5fYm91bmRhcnlSZWdleCk7XG5cbiAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkoYm91bmRhcnlNYXRjaCkgJiYgYm91bmRhcnlNYXRjaC5sZW5ndGgpIHtcbiAgICAgICAgICBmdWxsQm91bmRhcnkgPSBib3VuZGFyeU1hdGNoWzBdLnJlcGxhY2UoL1tcXHJcXG5dKy9naSwgJycpO1xuICAgICAgICAgIGNvbnN0IGJvdW5kYXJ5ID0gZnVsbEJvdW5kYXJ5LnJlcGxhY2UoL14tLS8sJycpO1xuICAgICAgICAgIHJlc3VsdC5ib3VuZGFyeSA9IGJvdW5kYXJ5O1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSkoKTtcblxuICAgIC8qIFBhcnNlIGJvZHlcbiAgICAgKi9cbiAgICAoZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgc3RhcnQgPSBoZWFkZXJOZXdsaW5lSW5kZXg7XG4gICAgICB2YXIgZW5kID0gbWVzc2FnZS5sZW5ndGg7XG4gICAgICBjb25zdCBmaXJzdEJvdW5kYXJ5SW5kZXggPSBtZXNzYWdlU3RyaW5nLmluZGV4T2YoZnVsbEJvdW5kYXJ5KTtcblxuICAgICAgaWYgKGZpcnN0Qm91bmRhcnlJbmRleCA+IC0xKSB7XG4gICAgICAgIHN0YXJ0ID0gaGVhZGVyTmV3bGluZUluZGV4O1xuICAgICAgICBlbmQgPSBmaXJzdEJvdW5kYXJ5SW5kZXg7XG4gICAgICB9XG5cbiAgICAgIGlmIChoZWFkZXJOZXdsaW5lSW5kZXggPiAtMSkge1xuICAgICAgICBjb25zdCBib2R5ID0gbWVzc2FnZS5zbGljZShzdGFydCwgZW5kKTtcblxuICAgICAgICBpZiAoYm9keSAmJiBib2R5Lmxlbmd0aCkge1xuICAgICAgICAgIHJlc3VsdC5ib2R5ID0gaHR0cE1lc3NhZ2VQYXJzZXIuX2lzRmFrZUJ1ZmZlcihib2R5KSA/IGJvZHkudG9TdHJpbmcoKSA6IGJvZHk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9KSgpO1xuXG4gICAgLyogUGFyc2UgbXVsdGlwYXJ0IHNlY3Rpb25zXG4gICAgICovXG4gICAgKGZ1bmN0aW9uKCkge1xuICAgICAgaWYgKHJlc3VsdC5ib3VuZGFyeSkge1xuICAgICAgICBjb25zdCBtdWx0aXBhcnRTdGFydCA9IG1lc3NhZ2VTdHJpbmcuaW5kZXhPZihmdWxsQm91bmRhcnkpICsgZnVsbEJvdW5kYXJ5Lmxlbmd0aDtcbiAgICAgICAgY29uc3QgbXVsdGlwYXJ0RW5kID0gbWVzc2FnZVN0cmluZy5sYXN0SW5kZXhPZihmdWxsQm91bmRhcnkpO1xuICAgICAgICBjb25zdCBtdWx0aXBhcnRCb2R5ID0gbWVzc2FnZVN0cmluZy5zdWJzdHIobXVsdGlwYXJ0U3RhcnQsIG11bHRpcGFydEVuZCk7XG4gICAgICAgIGNvbnN0IHBhcnRzID0gbXVsdGlwYXJ0Qm9keS5zcGxpdChmdWxsQm91bmRhcnkpO1xuXG4gICAgICAgIHJlc3VsdC5tdWx0aXBhcnQgPSBwYXJ0cy5maWx0ZXIoaHR0cE1lc3NhZ2VQYXJzZXIuX2lzVHJ1dGh5KS5tYXAoZnVuY3Rpb24ocGFydCwgaSkge1xuICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IHtcbiAgICAgICAgICAgIGhlYWRlcnM6IG51bGwsXG4gICAgICAgICAgICBib2R5OiBudWxsXG4gICAgICAgICAgfTtcblxuICAgICAgICAgIGNvbnN0IG5ld2xpbmVSZWdleCA9IC9cXG5cXG58XFxyXFxuXFxyXFxuL2dpbTtcbiAgICAgICAgICB2YXIgbmV3bGluZUluZGV4ID0gMDtcbiAgICAgICAgICB2YXIgbmV3bGluZU1hdGNoID0gbmV3bGluZVJlZ2V4LmV4ZWMocGFydCk7XG4gICAgICAgICAgdmFyIGJvZHkgPSBudWxsO1xuXG4gICAgICAgICAgaWYgKG5ld2xpbmVNYXRjaCkge1xuICAgICAgICAgICAgbmV3bGluZUluZGV4ID0gbmV3bGluZU1hdGNoLmluZGV4O1xuICAgICAgICAgICAgaWYgKG5ld2xpbmVNYXRjaC5pbmRleCA8PSAwKSB7XG4gICAgICAgICAgICAgIG5ld2xpbmVNYXRjaCA9IG5ld2xpbmVSZWdleC5leGVjKHBhcnQpO1xuICAgICAgICAgICAgICBpZiAobmV3bGluZU1hdGNoKSB7XG4gICAgICAgICAgICAgICAgbmV3bGluZUluZGV4ID0gbmV3bGluZU1hdGNoLmluZGV4O1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgY29uc3QgcG9zc2libGVIZWFkZXJzU3RyaW5nID0gcGFydC5zdWJzdHIoMCwgbmV3bGluZUluZGV4KTtcblxuICAgICAgICAgIGlmIChuZXdsaW5lSW5kZXggPiAtMSkge1xuICAgICAgICAgICAgY29uc3QgaGVhZGVycyA9IGh0dHBNZXNzYWdlUGFyc2VyLl9wYXJzZUhlYWRlcnMocG9zc2libGVIZWFkZXJzU3RyaW5nKTtcbiAgICAgICAgICAgIGlmIChPYmplY3Qua2V5cyhoZWFkZXJzKS5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgIHJlc3VsdC5oZWFkZXJzID0gaGVhZGVycztcblxuICAgICAgICAgICAgICB2YXIgYm91bmRhcnlJbmRleGVzID0gW107XG4gICAgICAgICAgICAgIGZvciAodmFyIGogPSAwOyBqIDwgbWVzc2FnZS5sZW5ndGg7IGorKykge1xuICAgICAgICAgICAgICAgIHZhciBib3VuZGFyeU1hdGNoID0gbWVzc2FnZS5zbGljZShqLCBqICsgZnVsbEJvdW5kYXJ5Lmxlbmd0aCkudG9TdHJpbmcoKTtcblxuICAgICAgICAgICAgICAgIGlmIChib3VuZGFyeU1hdGNoID09PSBmdWxsQm91bmRhcnkpIHtcbiAgICAgICAgICAgICAgICAgIGJvdW5kYXJ5SW5kZXhlcy5wdXNoKGopO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgIHZhciBib3VuZGFyeU5ld2xpbmVJbmRleGVzID0gW107XG4gICAgICAgICAgICAgIGJvdW5kYXJ5SW5kZXhlcy5zbGljZSgwLCBib3VuZGFyeUluZGV4ZXMubGVuZ3RoIC0gMSkuZm9yRWFjaChmdW5jdGlvbihtLCBrKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgcGFydEJvZHkgPSBtZXNzYWdlLnNsaWNlKGJvdW5kYXJ5SW5kZXhlc1trXSwgYm91bmRhcnlJbmRleGVzW2sgKyAxXSkudG9TdHJpbmcoKTtcbiAgICAgICAgICAgICAgICB2YXIgaGVhZGVyTmV3bGluZUluZGV4ID0gcGFydEJvZHkuc2VhcmNoKC9cXG5cXG58XFxyXFxuXFxyXFxuL2dpbSkgKyAyO1xuICAgICAgICAgICAgICAgIGhlYWRlck5ld2xpbmVJbmRleCAgPSBib3VuZGFyeUluZGV4ZXNba10gKyBoZWFkZXJOZXdsaW5lSW5kZXg7XG4gICAgICAgICAgICAgICAgYm91bmRhcnlOZXdsaW5lSW5kZXhlcy5wdXNoKGhlYWRlck5ld2xpbmVJbmRleCk7XG4gICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgIGJvZHkgPSBtZXNzYWdlLnNsaWNlKGJvdW5kYXJ5TmV3bGluZUluZGV4ZXNbaV0sIGJvdW5kYXJ5SW5kZXhlc1tpICsgMV0pO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgYm9keSA9IHBhcnQ7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGJvZHkgPSBwYXJ0O1xuICAgICAgICAgIH1cblxuICAgICAgICAgIHJlc3VsdC5ib2R5ID0gaHR0cE1lc3NhZ2VQYXJzZXIuX2lzRmFrZUJ1ZmZlcihib2R5KSA/IGJvZHkudG9TdHJpbmcoKSA6IGJvZHk7XG5cbiAgICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9KSgpO1xuXG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIGh0dHBNZXNzYWdlUGFyc2VyLl9pc1RydXRoeSA9IGZ1bmN0aW9uIF9pc1RydXRoeSh2KSB7XG4gICAgcmV0dXJuICEhdjtcbiAgfTtcblxuICBodHRwTWVzc2FnZVBhcnNlci5faXNOdW1lcmljID0gZnVuY3Rpb24gX2lzTnVtZXJpYyh2KSB7XG4gICAgaWYgKHR5cGVvZiB2ID09PSAnbnVtYmVyJyAmJiAhaXNOYU4odikpIHtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIHYgPSAodnx8JycpLnRvU3RyaW5nKCkudHJpbSgpO1xuXG4gICAgaWYgKCF2KSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgcmV0dXJuICFpc05hTih2KTtcbiAgfTtcblxuICBodHRwTWVzc2FnZVBhcnNlci5faXNCdWZmZXIgPSBmdW5jdGlvbihpdGVtKSB7XG4gICAgcmV0dXJuICgoaHR0cE1lc3NhZ2VQYXJzZXIuX2lzTm9kZUJ1ZmZlclN1cHBvcnRlZCgpICYmXG4gICAgICAgICAgICB0eXBlb2YgZ2xvYmFsID09PSAnb2JqZWN0JyAmJlxuICAgICAgICAgICAgZ2xvYmFsLkJ1ZmZlci5pc0J1ZmZlcihpdGVtKSkgfHxcbiAgICAgICAgICAgIChpdGVtIGluc3RhbmNlb2YgT2JqZWN0ICYmXG4gICAgICAgICAgICAgaXRlbS5faXNCdWZmZXIpKTtcbiAgfTtcblxuICBodHRwTWVzc2FnZVBhcnNlci5faXNOb2RlQnVmZmVyU3VwcG9ydGVkID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuICh0eXBlb2YgZ2xvYmFsID09PSAnb2JqZWN0JyAmJlxuICAgICAgICAgICAgdHlwZW9mIGdsb2JhbC5CdWZmZXIgPT09ICdmdW5jdGlvbicgJiZcbiAgICAgICAgICAgIHR5cGVvZiBnbG9iYWwuQnVmZmVyLmlzQnVmZmVyID09PSAnZnVuY3Rpb24nKTtcbiAgfTtcblxuICBodHRwTWVzc2FnZVBhcnNlci5fcGFyc2VIZWFkZXJzID0gZnVuY3Rpb24gX3BhcnNlSGVhZGVycyhib2R5KSB7XG4gICAgY29uc3QgaGVhZGVycyA9IHt9O1xuXG4gICAgaWYgKHR5cGVvZiBib2R5ICE9PSAnc3RyaW5nJykge1xuICAgICAgcmV0dXJuIGhlYWRlcnM7XG4gICAgfVxuXG4gICAgYm9keS5zcGxpdCgvW1xcclxcbl0vKS5mb3JFYWNoKGZ1bmN0aW9uKHN0cmluZykge1xuICAgICAgY29uc3QgbWF0Y2ggPSBzdHJpbmcubWF0Y2goLyhbXFx3LV0rKTpcXHMqKC4qKS9pKTtcblxuICAgICAgaWYgKEFycmF5LmlzQXJyYXkobWF0Y2gpICYmIG1hdGNoLmxlbmd0aCA9PT0gMykge1xuICAgICAgICBjb25zdCBrZXkgPSBtYXRjaFsxXTtcbiAgICAgICAgY29uc3QgdmFsdWUgPSBtYXRjaFsyXTtcblxuICAgICAgICBoZWFkZXJzW2tleV0gPSBodHRwTWVzc2FnZVBhcnNlci5faXNOdW1lcmljKHZhbHVlKSA/IE51bWJlcih2YWx1ZSkgOiB2YWx1ZTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIHJldHVybiBoZWFkZXJzO1xuICB9O1xuXG4gIGh0dHBNZXNzYWdlUGFyc2VyLl9yZXF1ZXN0TGluZVJlZ2V4ID0gL0hUVFBcXC8oMVxcLjB8MVxcLjF8MlxcLjApXFxzKyhcXGQrKVxccysoW1xcd1xccy1fXSspL2k7XG4gIGh0dHBNZXNzYWdlUGFyc2VyLl9yZXNwb25zZUxpbmVSZWdleCA9IC8oR0VUfFBPU1R8UFVUfERFTEVURXxQQVRDSHxPUFRJT05TfEhFQUR8VFJBQ0V8Q09OTkVDVClcXHMrKC4qKVxccytIVFRQXFwvKDFcXC4wfDFcXC4xfDJcXC4wKS9pO1xuICBodHRwTWVzc2FnZVBhcnNlci5faGVhZGVyTmV3bGluZVJlZ2V4ID0gL15bXFxyXFxuXSsvZ2ltO1xuICBodHRwTWVzc2FnZVBhcnNlci5fYm91bmRhcnlSZWdleCA9IC8oXFxufFxcclxcbikrLS1bXFx3LV0rKFxcbnxcXHJcXG4pKy9nO1xuXG4gIGh0dHBNZXNzYWdlUGFyc2VyLl9jcmVhdGVCdWZmZXIgPSBmdW5jdGlvbihkYXRhKSB7XG4gICAgaWYgKGh0dHBNZXNzYWdlUGFyc2VyLl9pc05vZGVCdWZmZXJTdXBwb3J0ZWQoKSkge1xuICAgICAgcmV0dXJuIG5ldyBCdWZmZXIoZGF0YSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIG5ldyBodHRwTWVzc2FnZVBhcnNlci5fRmFrZUJ1ZmZlcihkYXRhKTtcbiAgfTtcblxuICBodHRwTWVzc2FnZVBhcnNlci5faXNGYWtlQnVmZmVyID0gZnVuY3Rpb24gaXNGYWtlQnVmZmVyKG9iaikge1xuICAgIHJldHVybiBvYmogaW5zdGFuY2VvZiBodHRwTWVzc2FnZVBhcnNlci5fRmFrZUJ1ZmZlcjtcbiAgfTtcblxuICBodHRwTWVzc2FnZVBhcnNlci5fRmFrZUJ1ZmZlciA9IGZ1bmN0aW9uIEZha2VCdWZmZXIoZGF0YSkge1xuICAgIGlmICghKHRoaXMgaW5zdGFuY2VvZiBodHRwTWVzc2FnZVBhcnNlci5fRmFrZUJ1ZmZlcikpIHtcbiAgICAgIHJldHVybiBuZXcgaHR0cE1lc3NhZ2VQYXJzZXIuX0Zha2VCdWZmZXIoZGF0YSk7XG4gICAgfVxuXG4gICAgdGhpcy5kYXRhID0gW107XG5cbiAgICBpZiAoQXJyYXkuaXNBcnJheShkYXRhKSkge1xuICAgICAgdGhpcy5kYXRhID0gZGF0YTtcbiAgICB9IGVsc2UgaWYgKHR5cGVvZiBkYXRhID09PSAnc3RyaW5nJykge1xuICAgICAgdGhpcy5kYXRhID0gW10uc2xpY2UuY2FsbChkYXRhKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBMaXZlT2JqZWN0KCkge31cbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoTGl2ZU9iamVjdC5wcm90b3R5cGUsICdsZW5ndGgnLCB7XG4gICAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5kYXRhLmxlbmd0aDtcbiAgICAgIH0uYmluZCh0aGlzKVxuICAgIH0pO1xuXG4gICAgdGhpcy5sZW5ndGggPSAobmV3IExpdmVPYmplY3QoKSkubGVuZ3RoO1xuICB9O1xuXG4gIGh0dHBNZXNzYWdlUGFyc2VyLl9GYWtlQnVmZmVyLnByb3RvdHlwZS5zbGljZSA9IGZ1bmN0aW9uIHNsaWNlKCkge1xuICAgIHZhciBuZXdBcnJheSA9IFtdLnNsaWNlLmFwcGx5KHRoaXMuZGF0YSwgYXJndW1lbnRzKTtcbiAgICByZXR1cm4gbmV3IGh0dHBNZXNzYWdlUGFyc2VyLl9GYWtlQnVmZmVyKG5ld0FycmF5KTtcbiAgfTtcblxuICBodHRwTWVzc2FnZVBhcnNlci5fRmFrZUJ1ZmZlci5wcm90b3R5cGUuc2VhcmNoID0gZnVuY3Rpb24gc2VhcmNoKCkge1xuICAgIHJldHVybiBbXS5zZWFyY2guYXBwbHkodGhpcy5kYXRhLCBhcmd1bWVudHMpO1xuICB9O1xuXG4gIGh0dHBNZXNzYWdlUGFyc2VyLl9GYWtlQnVmZmVyLnByb3RvdHlwZS5pbmRleE9mID0gZnVuY3Rpb24gaW5kZXhPZigpIHtcbiAgICByZXR1cm4gW10uaW5kZXhPZi5hcHBseSh0aGlzLmRhdGEsIGFyZ3VtZW50cyk7XG4gIH07XG5cbiAgaHR0cE1lc3NhZ2VQYXJzZXIuX0Zha2VCdWZmZXIucHJvdG90eXBlLnRvU3RyaW5nID0gZnVuY3Rpb24gdG9TdHJpbmcoKSB7XG4gICAgcmV0dXJuIHRoaXMuZGF0YS5qb2luKCcnKTtcbiAgfTtcblxuICBpZiAodHlwZW9mIGV4cG9ydHMgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgaWYgKHR5cGVvZiBtb2R1bGUgIT09ICd1bmRlZmluZWQnICYmIG1vZHVsZS5leHBvcnRzKSB7XG4gICAgICBleHBvcnRzID0gbW9kdWxlLmV4cG9ydHMgPSBodHRwTWVzc2FnZVBhcnNlcjtcbiAgICB9XG4gICAgZXhwb3J0cy5odHRwTWVzc2FnZVBhcnNlciA9IGh0dHBNZXNzYWdlUGFyc2VyO1xuICB9IGVsc2UgaWYgKHR5cGVvZiBkZWZpbmUgPT09ICdmdW5jdGlvbicgJiYgZGVmaW5lLmFtZCkge1xuICAgIGRlZmluZShbXSwgZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gaHR0cE1lc3NhZ2VQYXJzZXI7XG4gICAgfSk7XG4gIH0gZWxzZSB7XG4gICAgcm9vdC5odHRwTWVzc2FnZVBhcnNlciA9IGh0dHBNZXNzYWdlUGFyc2VyO1xuICB9XG5cbn0pKHRoaXMpO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgU3RyaW5naWZ5ID0gcmVxdWlyZSgnLi9zdHJpbmdpZnknKTtcbnZhciBQYXJzZSA9IHJlcXVpcmUoJy4vcGFyc2UnKTtcblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gICAgc3RyaW5naWZ5OiBTdHJpbmdpZnksXG4gICAgcGFyc2U6IFBhcnNlXG59O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgVXRpbHMgPSByZXF1aXJlKCcuL3V0aWxzJyk7XG5cbnZhciBpbnRlcm5hbHMgPSB7XG4gICAgZGVsaW1pdGVyOiAnJicsXG4gICAgZGVwdGg6IDUsXG4gICAgYXJyYXlMaW1pdDogMjAsXG4gICAgcGFyYW1ldGVyTGltaXQ6IDEwMDAsXG4gICAgc3RyaWN0TnVsbEhhbmRsaW5nOiBmYWxzZSxcbiAgICBwbGFpbk9iamVjdHM6IGZhbHNlLFxuICAgIGFsbG93UHJvdG90eXBlczogZmFsc2UsXG4gICAgYWxsb3dEb3RzOiBmYWxzZVxufTtcblxuaW50ZXJuYWxzLnBhcnNlVmFsdWVzID0gZnVuY3Rpb24gKHN0ciwgb3B0aW9ucykge1xuICAgIHZhciBvYmogPSB7fTtcbiAgICB2YXIgcGFydHMgPSBzdHIuc3BsaXQob3B0aW9ucy5kZWxpbWl0ZXIsIG9wdGlvbnMucGFyYW1ldGVyTGltaXQgPT09IEluZmluaXR5ID8gdW5kZWZpbmVkIDogb3B0aW9ucy5wYXJhbWV0ZXJMaW1pdCk7XG5cbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHBhcnRzLmxlbmd0aDsgKytpKSB7XG4gICAgICAgIHZhciBwYXJ0ID0gcGFydHNbaV07XG4gICAgICAgIHZhciBwb3MgPSBwYXJ0LmluZGV4T2YoJ109JykgPT09IC0xID8gcGFydC5pbmRleE9mKCc9JykgOiBwYXJ0LmluZGV4T2YoJ109JykgKyAxO1xuXG4gICAgICAgIGlmIChwb3MgPT09IC0xKSB7XG4gICAgICAgICAgICBvYmpbVXRpbHMuZGVjb2RlKHBhcnQpXSA9ICcnO1xuXG4gICAgICAgICAgICBpZiAob3B0aW9ucy5zdHJpY3ROdWxsSGFuZGxpbmcpIHtcbiAgICAgICAgICAgICAgICBvYmpbVXRpbHMuZGVjb2RlKHBhcnQpXSA9IG51bGw7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB2YXIga2V5ID0gVXRpbHMuZGVjb2RlKHBhcnQuc2xpY2UoMCwgcG9zKSk7XG4gICAgICAgICAgICB2YXIgdmFsID0gVXRpbHMuZGVjb2RlKHBhcnQuc2xpY2UocG9zICsgMSkpO1xuXG4gICAgICAgICAgICBpZiAoT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKG9iaiwga2V5KSkge1xuICAgICAgICAgICAgICAgIG9ialtrZXldID0gW10uY29uY2F0KG9ialtrZXldKS5jb25jYXQodmFsKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgb2JqW2tleV0gPSB2YWw7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gb2JqO1xufTtcblxuaW50ZXJuYWxzLnBhcnNlT2JqZWN0ID0gZnVuY3Rpb24gKGNoYWluLCB2YWwsIG9wdGlvbnMpIHtcbiAgICBpZiAoIWNoYWluLmxlbmd0aCkge1xuICAgICAgICByZXR1cm4gdmFsO1xuICAgIH1cblxuICAgIHZhciByb290ID0gY2hhaW4uc2hpZnQoKTtcblxuICAgIHZhciBvYmo7XG4gICAgaWYgKHJvb3QgPT09ICdbXScpIHtcbiAgICAgICAgb2JqID0gW107XG4gICAgICAgIG9iaiA9IG9iai5jb25jYXQoaW50ZXJuYWxzLnBhcnNlT2JqZWN0KGNoYWluLCB2YWwsIG9wdGlvbnMpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBvYmogPSBvcHRpb25zLnBsYWluT2JqZWN0cyA/IE9iamVjdC5jcmVhdGUobnVsbCkgOiB7fTtcbiAgICAgICAgdmFyIGNsZWFuUm9vdCA9IHJvb3RbMF0gPT09ICdbJyAmJiByb290W3Jvb3QubGVuZ3RoIC0gMV0gPT09ICddJyA/IHJvb3Quc2xpY2UoMSwgcm9vdC5sZW5ndGggLSAxKSA6IHJvb3Q7XG4gICAgICAgIHZhciBpbmRleCA9IHBhcnNlSW50KGNsZWFuUm9vdCwgMTApO1xuICAgICAgICBpZiAoXG4gICAgICAgICAgICAhaXNOYU4oaW5kZXgpICYmXG4gICAgICAgICAgICByb290ICE9PSBjbGVhblJvb3QgJiZcbiAgICAgICAgICAgIFN0cmluZyhpbmRleCkgPT09IGNsZWFuUm9vdCAmJlxuICAgICAgICAgICAgaW5kZXggPj0gMCAmJlxuICAgICAgICAgICAgKG9wdGlvbnMucGFyc2VBcnJheXMgJiYgaW5kZXggPD0gb3B0aW9ucy5hcnJheUxpbWl0KVxuICAgICAgICApIHtcbiAgICAgICAgICAgIG9iaiA9IFtdO1xuICAgICAgICAgICAgb2JqW2luZGV4XSA9IGludGVybmFscy5wYXJzZU9iamVjdChjaGFpbiwgdmFsLCBvcHRpb25zKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIG9ialtjbGVhblJvb3RdID0gaW50ZXJuYWxzLnBhcnNlT2JqZWN0KGNoYWluLCB2YWwsIG9wdGlvbnMpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIG9iajtcbn07XG5cbmludGVybmFscy5wYXJzZUtleXMgPSBmdW5jdGlvbiAoZ2l2ZW5LZXksIHZhbCwgb3B0aW9ucykge1xuICAgIGlmICghZ2l2ZW5LZXkpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8vIFRyYW5zZm9ybSBkb3Qgbm90YXRpb24gdG8gYnJhY2tldCBub3RhdGlvblxuICAgIHZhciBrZXkgPSBvcHRpb25zLmFsbG93RG90cyA/IGdpdmVuS2V5LnJlcGxhY2UoL1xcLihbXlxcLlxcW10rKS9nLCAnWyQxXScpIDogZ2l2ZW5LZXk7XG5cbiAgICAvLyBUaGUgcmVnZXggY2h1bmtzXG5cbiAgICB2YXIgcGFyZW50ID0gL14oW15cXFtcXF1dKikvO1xuICAgIHZhciBjaGlsZCA9IC8oXFxbW15cXFtcXF1dKlxcXSkvZztcblxuICAgIC8vIEdldCB0aGUgcGFyZW50XG5cbiAgICB2YXIgc2VnbWVudCA9IHBhcmVudC5leGVjKGtleSk7XG5cbiAgICAvLyBTdGFzaCB0aGUgcGFyZW50IGlmIGl0IGV4aXN0c1xuXG4gICAgdmFyIGtleXMgPSBbXTtcbiAgICBpZiAoc2VnbWVudFsxXSkge1xuICAgICAgICAvLyBJZiB3ZSBhcmVuJ3QgdXNpbmcgcGxhaW4gb2JqZWN0cywgb3B0aW9uYWxseSBwcmVmaXgga2V5c1xuICAgICAgICAvLyB0aGF0IHdvdWxkIG92ZXJ3cml0ZSBvYmplY3QgcHJvdG90eXBlIHByb3BlcnRpZXNcbiAgICAgICAgaWYgKCFvcHRpb25zLnBsYWluT2JqZWN0cyAmJiBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5KHNlZ21lbnRbMV0pKSB7XG4gICAgICAgICAgICBpZiAoIW9wdGlvbnMuYWxsb3dQcm90b3R5cGVzKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAga2V5cy5wdXNoKHNlZ21lbnRbMV0pO1xuICAgIH1cblxuICAgIC8vIExvb3AgdGhyb3VnaCBjaGlsZHJlbiBhcHBlbmRpbmcgdG8gdGhlIGFycmF5IHVudGlsIHdlIGhpdCBkZXB0aFxuXG4gICAgdmFyIGkgPSAwO1xuICAgIHdoaWxlICgoc2VnbWVudCA9IGNoaWxkLmV4ZWMoa2V5KSkgIT09IG51bGwgJiYgaSA8IG9wdGlvbnMuZGVwdGgpIHtcbiAgICAgICAgaSArPSAxO1xuICAgICAgICBpZiAoIW9wdGlvbnMucGxhaW5PYmplY3RzICYmIE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkoc2VnbWVudFsxXS5yZXBsYWNlKC9cXFt8XFxdL2csICcnKSkpIHtcbiAgICAgICAgICAgIGlmICghb3B0aW9ucy5hbGxvd1Byb3RvdHlwZXMpIHtcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBrZXlzLnB1c2goc2VnbWVudFsxXSk7XG4gICAgfVxuXG4gICAgLy8gSWYgdGhlcmUncyBhIHJlbWFpbmRlciwganVzdCBhZGQgd2hhdGV2ZXIgaXMgbGVmdFxuXG4gICAgaWYgKHNlZ21lbnQpIHtcbiAgICAgICAga2V5cy5wdXNoKCdbJyArIGtleS5zbGljZShzZWdtZW50LmluZGV4KSArICddJyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGludGVybmFscy5wYXJzZU9iamVjdChrZXlzLCB2YWwsIG9wdGlvbnMpO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAoc3RyLCBvcHRzKSB7XG4gICAgdmFyIG9wdGlvbnMgPSBvcHRzIHx8IHt9O1xuICAgIG9wdGlvbnMuZGVsaW1pdGVyID0gdHlwZW9mIG9wdGlvbnMuZGVsaW1pdGVyID09PSAnc3RyaW5nJyB8fCBVdGlscy5pc1JlZ0V4cChvcHRpb25zLmRlbGltaXRlcikgPyBvcHRpb25zLmRlbGltaXRlciA6IGludGVybmFscy5kZWxpbWl0ZXI7XG4gICAgb3B0aW9ucy5kZXB0aCA9IHR5cGVvZiBvcHRpb25zLmRlcHRoID09PSAnbnVtYmVyJyA/IG9wdGlvbnMuZGVwdGggOiBpbnRlcm5hbHMuZGVwdGg7XG4gICAgb3B0aW9ucy5hcnJheUxpbWl0ID0gdHlwZW9mIG9wdGlvbnMuYXJyYXlMaW1pdCA9PT0gJ251bWJlcicgPyBvcHRpb25zLmFycmF5TGltaXQgOiBpbnRlcm5hbHMuYXJyYXlMaW1pdDtcbiAgICBvcHRpb25zLnBhcnNlQXJyYXlzID0gb3B0aW9ucy5wYXJzZUFycmF5cyAhPT0gZmFsc2U7XG4gICAgb3B0aW9ucy5hbGxvd0RvdHMgPSB0eXBlb2Ygb3B0aW9ucy5hbGxvd0RvdHMgPT09ICdib29sZWFuJyA/IG9wdGlvbnMuYWxsb3dEb3RzIDogaW50ZXJuYWxzLmFsbG93RG90cztcbiAgICBvcHRpb25zLnBsYWluT2JqZWN0cyA9IHR5cGVvZiBvcHRpb25zLnBsYWluT2JqZWN0cyA9PT0gJ2Jvb2xlYW4nID8gb3B0aW9ucy5wbGFpbk9iamVjdHMgOiBpbnRlcm5hbHMucGxhaW5PYmplY3RzO1xuICAgIG9wdGlvbnMuYWxsb3dQcm90b3R5cGVzID0gdHlwZW9mIG9wdGlvbnMuYWxsb3dQcm90b3R5cGVzID09PSAnYm9vbGVhbicgPyBvcHRpb25zLmFsbG93UHJvdG90eXBlcyA6IGludGVybmFscy5hbGxvd1Byb3RvdHlwZXM7XG4gICAgb3B0aW9ucy5wYXJhbWV0ZXJMaW1pdCA9IHR5cGVvZiBvcHRpb25zLnBhcmFtZXRlckxpbWl0ID09PSAnbnVtYmVyJyA/IG9wdGlvbnMucGFyYW1ldGVyTGltaXQgOiBpbnRlcm5hbHMucGFyYW1ldGVyTGltaXQ7XG4gICAgb3B0aW9ucy5zdHJpY3ROdWxsSGFuZGxpbmcgPSB0eXBlb2Ygb3B0aW9ucy5zdHJpY3ROdWxsSGFuZGxpbmcgPT09ICdib29sZWFuJyA/IG9wdGlvbnMuc3RyaWN0TnVsbEhhbmRsaW5nIDogaW50ZXJuYWxzLnN0cmljdE51bGxIYW5kbGluZztcblxuICAgIGlmIChcbiAgICAgICAgc3RyID09PSAnJyB8fFxuICAgICAgICBzdHIgPT09IG51bGwgfHxcbiAgICAgICAgdHlwZW9mIHN0ciA9PT0gJ3VuZGVmaW5lZCdcbiAgICApIHtcbiAgICAgICAgcmV0dXJuIG9wdGlvbnMucGxhaW5PYmplY3RzID8gT2JqZWN0LmNyZWF0ZShudWxsKSA6IHt9O1xuICAgIH1cblxuICAgIHZhciB0ZW1wT2JqID0gdHlwZW9mIHN0ciA9PT0gJ3N0cmluZycgPyBpbnRlcm5hbHMucGFyc2VWYWx1ZXMoc3RyLCBvcHRpb25zKSA6IHN0cjtcbiAgICB2YXIgb2JqID0gb3B0aW9ucy5wbGFpbk9iamVjdHMgPyBPYmplY3QuY3JlYXRlKG51bGwpIDoge307XG5cbiAgICAvLyBJdGVyYXRlIG92ZXIgdGhlIGtleXMgYW5kIHNldHVwIHRoZSBuZXcgb2JqZWN0XG5cbiAgICB2YXIga2V5cyA9IE9iamVjdC5rZXlzKHRlbXBPYmopO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwga2V5cy5sZW5ndGg7ICsraSkge1xuICAgICAgICB2YXIga2V5ID0ga2V5c1tpXTtcbiAgICAgICAgdmFyIG5ld09iaiA9IGludGVybmFscy5wYXJzZUtleXMoa2V5LCB0ZW1wT2JqW2tleV0sIG9wdGlvbnMpO1xuICAgICAgICBvYmogPSBVdGlscy5tZXJnZShvYmosIG5ld09iaiwgb3B0aW9ucyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIFV0aWxzLmNvbXBhY3Qob2JqKTtcbn07XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBVdGlscyA9IHJlcXVpcmUoJy4vdXRpbHMnKTtcblxudmFyIGludGVybmFscyA9IHtcbiAgICBkZWxpbWl0ZXI6ICcmJyxcbiAgICBhcnJheVByZWZpeEdlbmVyYXRvcnM6IHtcbiAgICAgICAgYnJhY2tldHM6IGZ1bmN0aW9uIChwcmVmaXgpIHtcbiAgICAgICAgICAgIHJldHVybiBwcmVmaXggKyAnW10nO1xuICAgICAgICB9LFxuICAgICAgICBpbmRpY2VzOiBmdW5jdGlvbiAocHJlZml4LCBrZXkpIHtcbiAgICAgICAgICAgIHJldHVybiBwcmVmaXggKyAnWycgKyBrZXkgKyAnXSc7XG4gICAgICAgIH0sXG4gICAgICAgIHJlcGVhdDogZnVuY3Rpb24gKHByZWZpeCkge1xuICAgICAgICAgICAgcmV0dXJuIHByZWZpeDtcbiAgICAgICAgfVxuICAgIH0sXG4gICAgc3RyaWN0TnVsbEhhbmRsaW5nOiBmYWxzZSxcbiAgICBza2lwTnVsbHM6IGZhbHNlLFxuICAgIGVuY29kZTogdHJ1ZVxufTtcblxuaW50ZXJuYWxzLnN0cmluZ2lmeSA9IGZ1bmN0aW9uIChvYmplY3QsIHByZWZpeCwgZ2VuZXJhdGVBcnJheVByZWZpeCwgc3RyaWN0TnVsbEhhbmRsaW5nLCBza2lwTnVsbHMsIGVuY29kZSwgZmlsdGVyLCBzb3J0LCBhbGxvd0RvdHMpIHtcbiAgICB2YXIgb2JqID0gb2JqZWN0O1xuICAgIGlmICh0eXBlb2YgZmlsdGVyID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIG9iaiA9IGZpbHRlcihwcmVmaXgsIG9iaik7XG4gICAgfSBlbHNlIGlmIChVdGlscy5pc0J1ZmZlcihvYmopKSB7XG4gICAgICAgIG9iaiA9IFN0cmluZyhvYmopO1xuICAgIH0gZWxzZSBpZiAob2JqIGluc3RhbmNlb2YgRGF0ZSkge1xuICAgICAgICBvYmogPSBvYmoudG9JU09TdHJpbmcoKTtcbiAgICB9IGVsc2UgaWYgKG9iaiA9PT0gbnVsbCkge1xuICAgICAgICBpZiAoc3RyaWN0TnVsbEhhbmRsaW5nKSB7XG4gICAgICAgICAgICByZXR1cm4gZW5jb2RlID8gVXRpbHMuZW5jb2RlKHByZWZpeCkgOiBwcmVmaXg7XG4gICAgICAgIH1cblxuICAgICAgICBvYmogPSAnJztcbiAgICB9XG5cbiAgICBpZiAodHlwZW9mIG9iaiA9PT0gJ3N0cmluZycgfHwgdHlwZW9mIG9iaiA9PT0gJ251bWJlcicgfHwgdHlwZW9mIG9iaiA9PT0gJ2Jvb2xlYW4nKSB7XG4gICAgICAgIGlmIChlbmNvZGUpIHtcbiAgICAgICAgICAgIHJldHVybiBbVXRpbHMuZW5jb2RlKHByZWZpeCkgKyAnPScgKyBVdGlscy5lbmNvZGUob2JqKV07XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIFtwcmVmaXggKyAnPScgKyBvYmpdO1xuICAgIH1cblxuICAgIHZhciB2YWx1ZXMgPSBbXTtcblxuICAgIGlmICh0eXBlb2Ygb2JqID09PSAndW5kZWZpbmVkJykge1xuICAgICAgICByZXR1cm4gdmFsdWVzO1xuICAgIH1cblxuICAgIHZhciBvYmpLZXlzO1xuICAgIGlmIChBcnJheS5pc0FycmF5KGZpbHRlcikpIHtcbiAgICAgICAgb2JqS2V5cyA9IGZpbHRlcjtcbiAgICB9IGVsc2Uge1xuICAgICAgICB2YXIga2V5cyA9IE9iamVjdC5rZXlzKG9iaik7XG4gICAgICAgIG9iaktleXMgPSBzb3J0ID8ga2V5cy5zb3J0KHNvcnQpIDoga2V5cztcbiAgICB9XG5cbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IG9iaktleXMubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgdmFyIGtleSA9IG9iaktleXNbaV07XG5cbiAgICAgICAgaWYgKHNraXBOdWxscyAmJiBvYmpba2V5XSA9PT0gbnVsbCkge1xuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoQXJyYXkuaXNBcnJheShvYmopKSB7XG4gICAgICAgICAgICB2YWx1ZXMgPSB2YWx1ZXMuY29uY2F0KGludGVybmFscy5zdHJpbmdpZnkob2JqW2tleV0sIGdlbmVyYXRlQXJyYXlQcmVmaXgocHJlZml4LCBrZXkpLCBnZW5lcmF0ZUFycmF5UHJlZml4LCBzdHJpY3ROdWxsSGFuZGxpbmcsIHNraXBOdWxscywgZW5jb2RlLCBmaWx0ZXIsIHNvcnQsIGFsbG93RG90cykpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdmFsdWVzID0gdmFsdWVzLmNvbmNhdChpbnRlcm5hbHMuc3RyaW5naWZ5KG9ialtrZXldLCBwcmVmaXggKyAoYWxsb3dEb3RzID8gJy4nICsga2V5IDogJ1snICsga2V5ICsgJ10nKSwgZ2VuZXJhdGVBcnJheVByZWZpeCwgc3RyaWN0TnVsbEhhbmRsaW5nLCBza2lwTnVsbHMsIGVuY29kZSwgZmlsdGVyLCBzb3J0LCBhbGxvd0RvdHMpKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiB2YWx1ZXM7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIChvYmplY3QsIG9wdHMpIHtcbiAgICB2YXIgb2JqID0gb2JqZWN0O1xuICAgIHZhciBvcHRpb25zID0gb3B0cyB8fCB7fTtcbiAgICB2YXIgZGVsaW1pdGVyID0gdHlwZW9mIG9wdGlvbnMuZGVsaW1pdGVyID09PSAndW5kZWZpbmVkJyA/IGludGVybmFscy5kZWxpbWl0ZXIgOiBvcHRpb25zLmRlbGltaXRlcjtcbiAgICB2YXIgc3RyaWN0TnVsbEhhbmRsaW5nID0gdHlwZW9mIG9wdGlvbnMuc3RyaWN0TnVsbEhhbmRsaW5nID09PSAnYm9vbGVhbicgPyBvcHRpb25zLnN0cmljdE51bGxIYW5kbGluZyA6IGludGVybmFscy5zdHJpY3ROdWxsSGFuZGxpbmc7XG4gICAgdmFyIHNraXBOdWxscyA9IHR5cGVvZiBvcHRpb25zLnNraXBOdWxscyA9PT0gJ2Jvb2xlYW4nID8gb3B0aW9ucy5za2lwTnVsbHMgOiBpbnRlcm5hbHMuc2tpcE51bGxzO1xuICAgIHZhciBlbmNvZGUgPSB0eXBlb2Ygb3B0aW9ucy5lbmNvZGUgPT09ICdib29sZWFuJyA/IG9wdGlvbnMuZW5jb2RlIDogaW50ZXJuYWxzLmVuY29kZTtcbiAgICB2YXIgc29ydCA9IHR5cGVvZiBvcHRpb25zLnNvcnQgPT09ICdmdW5jdGlvbicgPyBvcHRpb25zLnNvcnQgOiBudWxsO1xuICAgIHZhciBhbGxvd0RvdHMgPSB0eXBlb2Ygb3B0aW9ucy5hbGxvd0RvdHMgPT09ICd1bmRlZmluZWQnID8gZmFsc2UgOiBvcHRpb25zLmFsbG93RG90cztcbiAgICB2YXIgb2JqS2V5cztcbiAgICB2YXIgZmlsdGVyO1xuICAgIGlmICh0eXBlb2Ygb3B0aW9ucy5maWx0ZXIgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgZmlsdGVyID0gb3B0aW9ucy5maWx0ZXI7XG4gICAgICAgIG9iaiA9IGZpbHRlcignJywgb2JqKTtcbiAgICB9IGVsc2UgaWYgKEFycmF5LmlzQXJyYXkob3B0aW9ucy5maWx0ZXIpKSB7XG4gICAgICAgIG9iaktleXMgPSBmaWx0ZXIgPSBvcHRpb25zLmZpbHRlcjtcbiAgICB9XG5cbiAgICB2YXIga2V5cyA9IFtdO1xuXG4gICAgaWYgKHR5cGVvZiBvYmogIT09ICdvYmplY3QnIHx8IG9iaiA9PT0gbnVsbCkge1xuICAgICAgICByZXR1cm4gJyc7XG4gICAgfVxuXG4gICAgdmFyIGFycmF5Rm9ybWF0O1xuICAgIGlmIChvcHRpb25zLmFycmF5Rm9ybWF0IGluIGludGVybmFscy5hcnJheVByZWZpeEdlbmVyYXRvcnMpIHtcbiAgICAgICAgYXJyYXlGb3JtYXQgPSBvcHRpb25zLmFycmF5Rm9ybWF0O1xuICAgIH0gZWxzZSBpZiAoJ2luZGljZXMnIGluIG9wdGlvbnMpIHtcbiAgICAgICAgYXJyYXlGb3JtYXQgPSBvcHRpb25zLmluZGljZXMgPyAnaW5kaWNlcycgOiAncmVwZWF0JztcbiAgICB9IGVsc2Uge1xuICAgICAgICBhcnJheUZvcm1hdCA9ICdpbmRpY2VzJztcbiAgICB9XG5cbiAgICB2YXIgZ2VuZXJhdGVBcnJheVByZWZpeCA9IGludGVybmFscy5hcnJheVByZWZpeEdlbmVyYXRvcnNbYXJyYXlGb3JtYXRdO1xuXG4gICAgaWYgKCFvYmpLZXlzKSB7XG4gICAgICAgIG9iaktleXMgPSBPYmplY3Qua2V5cyhvYmopO1xuICAgIH1cblxuICAgIGlmIChzb3J0KSB7XG4gICAgICAgIG9iaktleXMuc29ydChzb3J0KTtcbiAgICB9XG5cbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IG9iaktleXMubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgdmFyIGtleSA9IG9iaktleXNbaV07XG5cbiAgICAgICAgaWYgKHNraXBOdWxscyAmJiBvYmpba2V5XSA9PT0gbnVsbCkge1xuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cblxuICAgICAgICBrZXlzID0ga2V5cy5jb25jYXQoaW50ZXJuYWxzLnN0cmluZ2lmeShvYmpba2V5XSwga2V5LCBnZW5lcmF0ZUFycmF5UHJlZml4LCBzdHJpY3ROdWxsSGFuZGxpbmcsIHNraXBOdWxscywgZW5jb2RlLCBmaWx0ZXIsIHNvcnQsIGFsbG93RG90cykpO1xuICAgIH1cblxuICAgIHJldHVybiBrZXlzLmpvaW4oZGVsaW1pdGVyKTtcbn07XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBoZXhUYWJsZSA9IChmdW5jdGlvbiAoKSB7XG4gICAgdmFyIGFycmF5ID0gbmV3IEFycmF5KDI1Nik7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCAyNTY7ICsraSkge1xuICAgICAgICBhcnJheVtpXSA9ICclJyArICgoaSA8IDE2ID8gJzAnIDogJycpICsgaS50b1N0cmluZygxNikpLnRvVXBwZXJDYXNlKCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGFycmF5O1xufSgpKTtcblxuZXhwb3J0cy5hcnJheVRvT2JqZWN0ID0gZnVuY3Rpb24gKHNvdXJjZSwgb3B0aW9ucykge1xuICAgIHZhciBvYmogPSBvcHRpb25zLnBsYWluT2JqZWN0cyA/IE9iamVjdC5jcmVhdGUobnVsbCkgOiB7fTtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHNvdXJjZS5sZW5ndGg7ICsraSkge1xuICAgICAgICBpZiAodHlwZW9mIHNvdXJjZVtpXSAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgIG9ialtpXSA9IHNvdXJjZVtpXTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBvYmo7XG59O1xuXG5leHBvcnRzLm1lcmdlID0gZnVuY3Rpb24gKHRhcmdldCwgc291cmNlLCBvcHRpb25zKSB7XG4gICAgaWYgKCFzb3VyY2UpIHtcbiAgICAgICAgcmV0dXJuIHRhcmdldDtcbiAgICB9XG5cbiAgICBpZiAodHlwZW9mIHNvdXJjZSAhPT0gJ29iamVjdCcpIHtcbiAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkodGFyZ2V0KSkge1xuICAgICAgICAgICAgdGFyZ2V0LnB1c2goc291cmNlKTtcbiAgICAgICAgfSBlbHNlIGlmICh0eXBlb2YgdGFyZ2V0ID09PSAnb2JqZWN0Jykge1xuICAgICAgICAgICAgdGFyZ2V0W3NvdXJjZV0gPSB0cnVlO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIFt0YXJnZXQsIHNvdXJjZV07XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gdGFyZ2V0O1xuICAgIH1cblxuICAgIGlmICh0eXBlb2YgdGFyZ2V0ICE9PSAnb2JqZWN0Jykge1xuICAgICAgICByZXR1cm4gW3RhcmdldF0uY29uY2F0KHNvdXJjZSk7XG4gICAgfVxuXG4gICAgdmFyIG1lcmdlVGFyZ2V0ID0gdGFyZ2V0O1xuICAgIGlmIChBcnJheS5pc0FycmF5KHRhcmdldCkgJiYgIUFycmF5LmlzQXJyYXkoc291cmNlKSkge1xuICAgICAgICBtZXJnZVRhcmdldCA9IGV4cG9ydHMuYXJyYXlUb09iamVjdCh0YXJnZXQsIG9wdGlvbnMpO1xuICAgIH1cblxuXHRyZXR1cm4gT2JqZWN0LmtleXMoc291cmNlKS5yZWR1Y2UoZnVuY3Rpb24gKGFjYywga2V5KSB7XG4gICAgICAgIHZhciB2YWx1ZSA9IHNvdXJjZVtrZXldO1xuXG4gICAgICAgIGlmIChPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwoYWNjLCBrZXkpKSB7XG4gICAgICAgICAgICBhY2Nba2V5XSA9IGV4cG9ydHMubWVyZ2UoYWNjW2tleV0sIHZhbHVlLCBvcHRpb25zKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGFjY1trZXldID0gdmFsdWU7XG4gICAgICAgIH1cblx0XHRyZXR1cm4gYWNjO1xuICAgIH0sIG1lcmdlVGFyZ2V0KTtcbn07XG5cbmV4cG9ydHMuZGVjb2RlID0gZnVuY3Rpb24gKHN0cikge1xuICAgIHRyeSB7XG4gICAgICAgIHJldHVybiBkZWNvZGVVUklDb21wb25lbnQoc3RyLnJlcGxhY2UoL1xcKy9nLCAnICcpKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIHJldHVybiBzdHI7XG4gICAgfVxufTtcblxuZXhwb3J0cy5lbmNvZGUgPSBmdW5jdGlvbiAoc3RyKSB7XG4gICAgLy8gVGhpcyBjb2RlIHdhcyBvcmlnaW5hbGx5IHdyaXR0ZW4gYnkgQnJpYW4gV2hpdGUgKG1zY2RleCkgZm9yIHRoZSBpby5qcyBjb3JlIHF1ZXJ5c3RyaW5nIGxpYnJhcnkuXG4gICAgLy8gSXQgaGFzIGJlZW4gYWRhcHRlZCBoZXJlIGZvciBzdHJpY3RlciBhZGhlcmVuY2UgdG8gUkZDIDM5ODZcbiAgICBpZiAoc3RyLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICByZXR1cm4gc3RyO1xuICAgIH1cblxuICAgIHZhciBzdHJpbmcgPSB0eXBlb2Ygc3RyID09PSAnc3RyaW5nJyA/IHN0ciA6IFN0cmluZyhzdHIpO1xuXG4gICAgdmFyIG91dCA9ICcnO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgc3RyaW5nLmxlbmd0aDsgKytpKSB7XG4gICAgICAgIHZhciBjID0gc3RyaW5nLmNoYXJDb2RlQXQoaSk7XG5cbiAgICAgICAgaWYgKFxuICAgICAgICAgICAgYyA9PT0gMHgyRCB8fCAvLyAtXG4gICAgICAgICAgICBjID09PSAweDJFIHx8IC8vIC5cbiAgICAgICAgICAgIGMgPT09IDB4NUYgfHwgLy8gX1xuICAgICAgICAgICAgYyA9PT0gMHg3RSB8fCAvLyB+XG4gICAgICAgICAgICAoYyA+PSAweDMwICYmIGMgPD0gMHgzOSkgfHwgLy8gMC05XG4gICAgICAgICAgICAoYyA+PSAweDQxICYmIGMgPD0gMHg1QSkgfHwgLy8gYS16XG4gICAgICAgICAgICAoYyA+PSAweDYxICYmIGMgPD0gMHg3QSkgLy8gQS1aXG4gICAgICAgICkge1xuICAgICAgICAgICAgb3V0ICs9IHN0cmluZy5jaGFyQXQoaSk7XG4gICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChjIDwgMHg4MCkge1xuICAgICAgICAgICAgb3V0ID0gb3V0ICsgaGV4VGFibGVbY107XG4gICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChjIDwgMHg4MDApIHtcbiAgICAgICAgICAgIG91dCA9IG91dCArIChoZXhUYWJsZVsweEMwIHwgKGMgPj4gNildICsgaGV4VGFibGVbMHg4MCB8IChjICYgMHgzRildKTtcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGMgPCAweEQ4MDAgfHwgYyA+PSAweEUwMDApIHtcbiAgICAgICAgICAgIG91dCA9IG91dCArIChoZXhUYWJsZVsweEUwIHwgKGMgPj4gMTIpXSArIGhleFRhYmxlWzB4ODAgfCAoKGMgPj4gNikgJiAweDNGKV0gKyBoZXhUYWJsZVsweDgwIHwgKGMgJiAweDNGKV0pO1xuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cblxuICAgICAgICBpICs9IDE7XG4gICAgICAgIGMgPSAweDEwMDAwICsgKCgoYyAmIDB4M0ZGKSA8PCAxMCkgfCAoc3RyaW5nLmNoYXJDb2RlQXQoaSkgJiAweDNGRikpO1xuICAgICAgICBvdXQgKz0gKGhleFRhYmxlWzB4RjAgfCAoYyA+PiAxOCldICsgaGV4VGFibGVbMHg4MCB8ICgoYyA+PiAxMikgJiAweDNGKV0gKyBoZXhUYWJsZVsweDgwIHwgKChjID4+IDYpICYgMHgzRildICsgaGV4VGFibGVbMHg4MCB8IChjICYgMHgzRildKTtcbiAgICB9XG5cbiAgICByZXR1cm4gb3V0O1xufTtcblxuZXhwb3J0cy5jb21wYWN0ID0gZnVuY3Rpb24gKG9iaiwgcmVmZXJlbmNlcykge1xuICAgIGlmICh0eXBlb2Ygb2JqICE9PSAnb2JqZWN0JyB8fCBvYmogPT09IG51bGwpIHtcbiAgICAgICAgcmV0dXJuIG9iajtcbiAgICB9XG5cbiAgICB2YXIgcmVmcyA9IHJlZmVyZW5jZXMgfHwgW107XG4gICAgdmFyIGxvb2t1cCA9IHJlZnMuaW5kZXhPZihvYmopO1xuICAgIGlmIChsb29rdXAgIT09IC0xKSB7XG4gICAgICAgIHJldHVybiByZWZzW2xvb2t1cF07XG4gICAgfVxuXG4gICAgcmVmcy5wdXNoKG9iaik7XG5cbiAgICBpZiAoQXJyYXkuaXNBcnJheShvYmopKSB7XG4gICAgICAgIHZhciBjb21wYWN0ZWQgPSBbXTtcblxuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IG9iai5sZW5ndGg7ICsraSkge1xuICAgICAgICAgICAgaWYgKHR5cGVvZiBvYmpbaV0gIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICAgICAgY29tcGFjdGVkLnB1c2gob2JqW2ldKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBjb21wYWN0ZWQ7XG4gICAgfVxuXG4gICAgdmFyIGtleXMgPSBPYmplY3Qua2V5cyhvYmopO1xuICAgIGZvciAodmFyIGogPSAwOyBqIDwga2V5cy5sZW5ndGg7ICsraikge1xuICAgICAgICB2YXIga2V5ID0ga2V5c1tqXTtcbiAgICAgICAgb2JqW2tleV0gPSBleHBvcnRzLmNvbXBhY3Qob2JqW2tleV0sIHJlZnMpO1xuICAgIH1cblxuICAgIHJldHVybiBvYmo7XG59O1xuXG5leHBvcnRzLmlzUmVnRXhwID0gZnVuY3Rpb24gKG9iaikge1xuICAgIHJldHVybiBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwob2JqKSA9PT0gJ1tvYmplY3QgUmVnRXhwXSc7XG59O1xuXG5leHBvcnRzLmlzQnVmZmVyID0gZnVuY3Rpb24gKG9iaikge1xuICAgIGlmIChvYmogPT09IG51bGwgfHwgdHlwZW9mIG9iaiA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIHJldHVybiAhIShvYmouY29uc3RydWN0b3IgJiYgb2JqLmNvbnN0cnVjdG9yLmlzQnVmZmVyICYmIG9iai5jb25zdHJ1Y3Rvci5pc0J1ZmZlcihvYmopKTtcbn07XG4iXX0=
