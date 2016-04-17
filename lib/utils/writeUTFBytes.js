'use strict';

/**
 * @credit https://github.com/mattdiamond/Recorderjs
 */
function writeUTFBytes(view, offset, string) {
  const length = string.length;

  for (let i = 0; i < length; i++){
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

module.exports = writeUTFBytes;
