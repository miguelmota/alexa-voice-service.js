const AVS = require('../avs');
const player = AVS.Player;

const avs = new AVS({
  debug: true,
  clientId: 'amzn1.application-oa2-client.696ab90fc5844fdbb8efc17394a79c00',
  deviceId: 'test_device',
  deviceSerialNumber: 123,
  redirectUri: `https://${window.location.host}/authresponse`
});

avs.on(AVS.EventTypes.TOKEN_SET, () => {
  login.disabled = true;
  logout.disabled = false;
  start.disabled = false;
  stop.disabled = true;
});

avs.on(AVS.EventTypes.RECORD_START, () => {
  start.disabled = true;
  stop.disabled = false;
});

avs.on(AVS.EventTypes.RECORD_STOP, () => {
  start.disabled = false;
  stop.disabled = true;
});

avs.on(AVS.EventTypes.LOGOUT, () => {
  login.disabled = false;
  logout.disabled = true;
  start.disabled = true;
  stop.disabled = true;
});

avs.on(AVS.EventTypes.LOG, (message) => {
  logOutput.innerHTML += `<li>LOG: ${message}</li>`;
});

avs.on(AVS.EventTypes.ERROR, (error) => {
  logOutput.innerHTML += `<li>ERROR: ${error}</li>`;
});

const login = document.getElementById('login');
const logout = document.getElementById('logout');
const logOutput = document.getElementById('log');
const start = document.getElementById('start');
const stop = document.getElementById('stop');

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

avs.getTokenFromUrl()
.then(() => avs.getToken())
.then(token => localStorage.setItem('token', token))
.then(() => avs.requestMic())
.catch(() => {
  const cachedToken = localStorage.getItem('token');

  if (cachedToken) {
    avs.setToken(cachedToken);
    return avs.requestMic();
  }
});

login.addEventListener('click', (event) => {
  avs.login()
  .then(() => avs.requestMic())
  .catch(() => {});

  /*
  // If using client secret
  avs.login({responseType: 'code'})
  .then(() => avs.requestMic())
  .catch(() => {});
  */
});

logout.addEventListener('click', () => {
  avs.logout()
  .then(() => {
    localStorage.removeItem('token');
    window.location.hash = '';
  });
});

start.addEventListener('click', () => {
  avs.startRecording();
});

stop.addEventListener('click', () => {
  avs.stopRecording().then(dataView => {
    const blob = new Blob ([dataView], {
      type: 'audio/wav'
    });

    avs.playBlob(blob);
    //sendBlob(blob);
    avs.sendAudio(dataView)
    .then(response => {

      window.AudioContext = window.AudioContext || window.webkitAudioContext;
      const context = new AudioContext();

      const int8 = response.multipart[1].body;
      const dst = new ArrayBuffer(int8.byteLength);
      new Uint8Array(dst).set(new Uint8Array(int8));

      context.decodeAudioData(dst, function(buffer) {
        playSound(buffer);
      }, () => {});

      function playSound(buffer) {
        const source = context.createBufferSource();
        source.buffer = buffer;
        source.connect(context.destination);
        source.start(0);
      }

    })
  });
});

function sendBlob(blob) {
  const xhr = new XMLHttpRequest();
  const fd = new FormData();

  fd.append('fname', 'audio.wav');
  fd.append('data', blob);

  xhr.open('POST', 'http://localhost:5555/audio', true);
  xhr.responseType = 'blob';

  xhr.onload = (event) => {
    if (xhr.status == 200) {
      console.log(xhr.response);
      //const responseBlob = new Blob([xhr.response], {type: 'audio/mp3'});
    }
  };
  xhr.send(fd);
}
