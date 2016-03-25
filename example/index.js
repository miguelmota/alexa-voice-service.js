var avs = new AVS({
  debug: true
});

var logOutput = document.getElementById('log');
var start = document.getElementById('start');
var stop = document.getElementById('stop');

avs.on('log', (message) => {
  logOutput.innerHTML += `<li>LOG: ${message}</li>`;
});

avs.on('error', (error) => {
  logOutput.innerHTML += `<li>ERROR: ${error}</li>`;
});

avs.requestMic();

start.addEventListener('click', () => {
  avs.startRecording();
});

stop.addEventListener('click', () => {
  avs.stopRecording().then((dataView) => {
    const blob = new Blob ([dataView], {
      type: 'audio/wav'
    });

    avs.playBlob(blob);
    sendBlob(blob);
  });
});

function sendBlob(blob) {
  const xhr = new XMLHttpRequest();
  const fd = new FormData();

  fd.append('fname', 'audio.wav');
  fd.append('data', blob);

  xhr.open('POST', 'http://localhost:5555/audio', true);
  xhr.responseType = 'blob';

  xhr.onload = (evt) => {
    if (xhr.status == 200) {
      console.log(xhr.response);
      //const responseBlob = new Blob([xhr.response], {type: 'audio/mp3'});
    }
  };
  xhr.send(fd);
}
