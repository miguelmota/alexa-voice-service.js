'use strict';

function Observable(el) {
  let callbacks = {};

  el.on = function(name, fn) {
    if (typeof fn !== 'function') {
      throw new TypeError('Second argument for "on" method must be a function.');
    }

    (callbacks[name] = callbacks[name] || []).push(fn);

    return el;
  };

  el.one = function(name, fn) {
    fn.one = true;
    return el.on.call(el, name, fn);
  };

  el.off = function(name, fn) {
    if (name === '*') {
      callbacks = {};
      return callbacks
    }

    if (!callbacks[name]) {
      return false;
    }

    if (fn) {
      if (typeof fn !== 'function') {
        throw new TypeError('Second argument for "off" method must be a function.');
      }

      callbacks[name] = callbacks[name].map(function(fm, i) {
        if (fm === fn) {
          callbacks[name].splice(i, 1);
        }
      });
    } else {
      delete callbacks[name];
    }
  };

  el.emit = function(name /*, args */) {
    if (!callbacks[name] || !callbacks[name].length) {
      return;
    }

    const args = [].slice.call(arguments, 1);

    callbacks[name].forEach(function(fn, i) {
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
