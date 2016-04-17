(function() {
  'use strict';

  const AVS = require('./lib/AVS');

  if (typeof exports !== 'undefined') {
    if (typeof module !== 'undefined' && module.exports) {
      exports = module.exports = AVS;
    }
    exports.AVS = AVS;
  }

  if (typeof define === 'function' && define.amd) {
    define([], function() {
      return AVS;
    });
  }

  if (typeof window === 'object') {
    window.AVS = AVS;
  }
})();
