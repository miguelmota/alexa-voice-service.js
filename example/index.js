const AVS = require('../');
const player = AVS.Player;

const avs = new AVS({
  debug: true,
  clientId: 'amzn1.application-oa2-client.696ab90fc5844fdbb8efc17394a79c00',
  deviceId: 'test_device',
  deviceSerialNumber: 123,
  redirectUri: `https://${window.location.host}/authresponse`
});
window.avs = avs;

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
  avs.logout()
  .then(login)
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
  logOutput.innerHTML = `<li>LOG: ${message}</li>` + logOutput.innerHTML;
}

function logError(error) {
  logOutput.innerHTML = `<li>ERROR: ${error}</li>` + logOutput.innerHTML;
}

function logAudioBlob(blob, message) {
  return new Promise((resolve, reject) => {
    const a = document.createElement('a');
    const aDownload = document.createElement('a');
    const url = window.URL.createObjectURL(blob);
    const ext = blob.type.indexOf('mpeg') > -1 ? 'mp3' : 'wav';
    const filename = `${Date.now()}.${ext}`;
    a.href = url;
    a.target = '_blank';
    aDownload.href = url;
    a.textContent = filename;
    aDownload.download = filename;
    aDownload.textContent = `download`;

    audioLogOutput.innerHTML = `<li>${message}: ${a.outerHTML} ${aDownload.outerHTML}</li>` +audioLogOutput.innerHTML;
    resolve(blob);
  });
}

const loginBtn = document.getElementById('login');
const logoutBtn = document.getElementById('logout');
const logOutput = document.getElementById('log');
const audioLogOutput = document.getElementById('audioLog');
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
    .then(() => avs.audioToBlob(dataView))
    .then(blob => logAudioBlob(blob, 'VOICE'))
    .then(() => avs.player.enqueue(dataView))
    .then(() => avs.player.play())
    .catch(error => {
      console.error(error);
    });

        var ab = false;
    //sendBlob(blob);
    avs.sendAudio(dataView)
    .then(({xhr, response}) => {

      var promises = [];
      var audioMap = {};
      var directives = null;

      if (response.multipart.length) {
        response.multipart.forEach(multipart => {
          let body = multipart.body;
          if (multipart.headers && multipart.headers['Content-Type'] === 'application/json') {
            try {
              body = JSON.parse(body);
            } catch(error) {
              console.error(error);
            }

            if (body && body.messageBody && body.messageBody.directives) {
              directives = body.messageBody.directives;
            }
          } else if (multipart.headers['Content-Type'] === 'audio/mpeg') {
            const start = multipart.meta.body.byteOffset.start;
            const end = multipart.meta.body.byteOffset.end;

            /**
             * Not sure if bug in buffer module or in http message parser
             * because it's joining arraybuffers so I have to this to
             * seperate them out.
             */
            var slicedBody = xhr.response.slice(start, end);

            //promises.push(avs.player.enqueue(slicedBody));
            audioMap[multipart.headers['Content-ID']] = slicedBody;
          }
        });

        function findAudioFromContentId(contentId) {
          contentId = contentId.replace('cid:', '');
          for (var key in audioMap) {
            if (key.indexOf(contentId) > -1) {
              return audioMap[key];
            }
          }
        }

        directives.forEach(directive => {
          if (directive.namespace === 'SpeechSynthesizer') {
            if (directive.name === 'speak') {
              const contentId = directive.payload.audioContent;
              const audio = findAudioFromContentId(contentId);
              if (audio) {
                avs.audioToBlob(audio)
                .then(blob => logAudioBlob(blob, 'RESPONSE'));
                promises.push(avs.player.enqueue(audio));
              }
            }
          } else if (directive.namespace === 'AudioPlayer') {
            if (directive.name === 'play') {
              const streams = directive.payload.audioItem.streams;
              streams.forEach(stream => {
                const streamUrl = stream.streamUrl;

                const audio = findAudioFromContentId(streamUrl);
                if (audio) {
                  avs.audioToBlob(audio)
                  .then(blob => logAudioBlob(blob, 'RESPONSE'));
                  promises.push(avs.player.enqueue(audio));
                } else if (streamUrl.indexOf('http') > -1) {
                  const xhr = new XMLHttpRequest();
                  const url = `/parse-m3u?url=${streamUrl.replace(/!.*$/, '')}`;
                  xhr.open('GET', url, true);
                  xhr.responseType = 'json';
                  xhr.onload = (event) => {
                    const urls = event.currentTarget.response;

                    urls.forEach(url => {
                      avs.player.enqueue(url);
                    });
                  };
                  xhr.send();
                }
              });
            } else if (directive.namespace === 'SpeechRecognizer') {
              if (directive.name === 'listen') {
                const timeout = directive.payload.timeoutIntervalInMillis;
                // enable mic
              }
            }
          }
        });

        if (promises.length) {
          Promise.all(promises)
         .then(() => {
            avs.player.playQueue()
          });
        }
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
  avs.player.play();
});

replayAudio.addEventListener('click', (event) => {
  avs.player.replay();
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
