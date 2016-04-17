'use strict';

function dataViewToBlob(dataView) {
  const blob = new Blob([dataView], {
    type: 'audio/wav'
  });

  return blob;
}

module.exports = dataViewToBlob;
