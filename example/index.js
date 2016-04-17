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
  stopRe.disabled = true;
});

avs.on(AVS.EventTypes.TOKEN_INVALID, () => {
  avs.logout()
  .then(login)
});

avs.on(AVS.EventTypes.LOG, log);
avs.on(AVS.EventTypes.ERROR, logError);

avs.player.on(AVS.Player.EventTypes.LOG, log);
avs.player.on(AVS.Player.EventTypes.ERROR, logError);

avs.player.on(AVS.Player.EventTypes.PLAY, () => {
  playAudio.disabled = true;
  pauseAudio.disabled = false;
  stopAudio.disabled = false;
});

avs.player.on(AVS.Player.EventTypes.ENDED, () => {
  playAudio.disabled = true;
  pauseAudio.disabled = true;
  stopAudio.disabled = true;
});

avs.player.on(AVS.Player.EventTypes.STOP, () => {
  playAudio.disabled = false;
  pauseAudio.disabled = false;
  stopAudio.disabled = false;
});

avs.player.on(AVS.Player.EventTypes.PAUSE, () => {
  playAudio.disabled = true;
  pauseAudio.disabled = false;
  stopAudio.disabled = false;
});

avs.player.on(AVS.Player.EventTypes.REPLAY, () => {

});

function log(message) {
  logOutput.innerHTML += `<li>LOG: ${message}</li>`;
}

function logError(error) {
  logOutput.innerHTML += `<li>ERROR: ${error}</li>`;
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

loginBtn.addEventListener('click', login);

function login(event) {
  return avs.login()
  .then(() => avs.requestMic())
  .catch(() => {});

  /*
  // If using client secret
  avs.login({responseType: 'code'})
  .then(() => avs.requestMic())
  .catch(() => {});
  */
}

logoutBtn.addEventListener('click', logout);

function logout() {
  return avs.logout()
  .then(() => {
    localStorage.removeItem('token');
    window.location.hash = '';
  });
}

startRecording.addEventListener('click', () => {
  avs.startRecording();
});

stopRecording.addEventListener('click', () => {
  avs.stopRecording().then(dataView => {
    avs.player.emptyQueue()
    .then(() => avs.player.enqueue(dataView))
    .then(() => avs.player.play())
    .catch(error => {
      console.error(error);
    });

    //sendBlob(blob);
    avs.sendAudio(dataView)
    .then(response => {

      if (response.multipart.length > 1) {
        const typedArray = response.multipart[1].body;

        avs.player.enqueue(typedArray)
        .then(() => avs.player.play())
        .catch(error => {
          console.error(error);
        });
      }

    })
    .catch(error => {
      console.error(error);
    });
  });
});

stopAudio.addEventListener('click', (event) => {
  avs.player.stop();
});

pauseAudio.addEventListener('click', (event) => {
  avs.player.pause();
});

playAudio.addEventListener('click', (event) => {
  avs.plaer.play();
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
