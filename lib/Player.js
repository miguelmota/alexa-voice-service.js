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

      const proceed = (audioBuffer) => {
        this._queue.push(audioBuffer);
        this._log('Enqueue audio');
        this.emit(Player.EventTypes.ENQUEUE);
        return resolve();
      };

      if (stringType === '[object DataView]' || stringType === '[object Uint8Array]') {
        arrayBufferToAudioBuffer(item.buffer)
        .then(proceed);
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
      return this.dequeue()
      .then(audioBuffer => {
        this._log('Play audio');
        this.emit(Player.EventTypes.PLAY);
        this.playAudioBuffer(audioBuffer)
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

      audio.onload = (event) => {
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

      source.onended = (event) => {
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
