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
      this._audio = null;
      this._currentBuffer = null;
      this._currentSource = null;
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

      const stringType = toString.call(item).replace(/\[.*\s(\w+)\]/, '$1');

      const proceed = (audioBuffer) => {
        this._queue.push(audioBuffer);
        this._log('Enqueue audio');
        this.emit(Player.EventTypes.ENQUEUE);
        return resolve(audioBuffer);
      };

      if (stringType === 'DataView' || stringType === 'Uint8Array') {
        return arrayBufferToAudioBuffer(item.buffer, this._context)
        .then(proceed);
      } else if (stringType === 'AudioBuffer') {
        return proceed(item);
      } else if (stringType === 'ArrayBuffer') {
        return arrayBufferToAudioBuffer(item, this._context)
        .then(proceed);
      } else if (stringType === 'String') {
        return proceed(item);
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
        resolve();
      } else if (this._audio && this._audio.paused) {
        this._log('Play audio');
        this.emit(Player.EventTypes.PLAY);
        this._audio.play();
        resolve();
      } else {
        return this.deque()
        .then(audioBuffer => {
          this._log('Play audio');
          this.emit(Player.EventTypes.PLAY);
          if (typeof audioBuffer === 'string') {
            return this.playUrl(audioBuffer);
          }
          return this.playAudioBuffer(audioBuffer);
        }).then(resolve);
      }
    });
  }

  playQueue() {
    return this.play().then(() => {
      if (this._queue.length) {
        return this.playQueue();
      }
    });
  }

  stop() {
    return new Promise((resolve, reject) => {
        if (this._currentSource) {
          this._currentSource.onended = function() {};
          this._currentSource.stop();
        }

        if (this._audio) {
          this._audio.onended = function() {};
          this._audio.currentTime = 0;
          this._audio.pause();
        }

        this._log('Stop audio');
        this.emit(Player.EventTypes.STOP);
    });
  }

  pause() {
    return new Promise((resolve, reject) => {
        if (this._currentSource && this._context.state === 'running') {
          this._context.suspend();
        }

        if (this._audio) {
          this._audio.pause();
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

          if (this._currentSource) {
            this._currentSource.stop();
            this._currentSource.onended = function() {};
          }
          return this.playAudioBuffer(this._currentBuffer);
        } else if (this._audio) {
          this._log('Replay audio');
          this.emit(Player.EventTypes.REPLAY);
          return this.playUrl(this._audio.src);
        } else {
          const error = new Error('No audio source loaded.');
          this.emit('error', error)
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
      this._currentBuffer = null;
      this._currentSource = null;
      this._audio = audio;

      audio.onended = () => {
        this._log('Audio ended');
        this.emit(Player.EventTypes.ENDED);
        resolve();
      };

      audio.onerror = (error) => {
        this.emit('error', error);
        reject(error);
      };

      audio.onload = (event) => {
        URL.revokeObjectUrl(objectUrl);
      };

      audio.play();
    });
  }

  playAudioBuffer(buffer) {
    return new Promise((resolve, reject) => {
      if (!buffer) {
        reject();
      }

      const source = this._context.createBufferSource();
      source.buffer = buffer;
      source.connect(this._context.destination);
      source.start(0);
      this._currentBuffer = buffer;
      this._currentSource = source;
      this._audio = null;

      source.onended = (event) => {
        this._log('Audio ended');
        this.emit(Player.EventTypes.ENDED);
        resolve();
      };

      source.onerror = (error) => {
        this.emit('error', error);
        reject(error);
      };
    });
  }

  playUrl(url) {
    return new Promise((resolve, reject) => {
      const audio = new Audio();
      audio.src = url;
      this._currentBuffer = null;
      this._currentSource = null;
      this._audio = audio;

      audio.onended = (event) => {
        this._log('Audio ended');
        this.emit(Player.EventTypes.ENDED);
        resolve();
      };

      audio.onerror = (error) => {
        this.emit('error', error);
        reject(error);
      };

      audio.play();
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
