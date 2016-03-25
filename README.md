# alexa-voice-service

> Library for interacting with [Alexa Voice Service](https://developer.amazon.com/public/solutions/alexa/alexa-voice-service) in the browser.

#### **THIS LIBRARY IS STILL IN DEVELOPMENT**.

With this library you are able to record audio in *mono channel, sampled at 16k Hz, and signed 16 bit PCM encoding* which is required by AVS.

# Example

View the full [example code](/example).

```javascript
var avs = new AVS();

avs.requestMic().then(mediaStreamReady);

startButton.addEventListener('click', () => {
  avs.startRecording();
});

stopButton.addEventListener('click', () => {
  avs.stopRecording().then((dataView) => {
    const blob = new Blob ([dataView], {
      type: 'audio/wav'
    });

    avs.playBlob(blob);
    sendBlob(blob);
  });
});

avs.on('log', (message) => {
  logOutput.innerHTML += `<li>LOG: ${message}</li>`;
});

avs.on('error', (error) => {
  logOutput.innerHTML += `<li>ERROR: ${error}</li>`;
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
      handleResponse(xhr.response);
    }
  };
  xhr.send(fd);
}
```

# Documentation

Most methods return a promise.

```javascript
AVS(options) - constructor

options:
  debug - {boolean} logs to console

avs.requestMic() -> promise(stream)
avs.connectMediaStream(stream) -> promise;

avs.stopRecording() -> promise;
avs.startRecording() -> promise;
avs.playBlob(blob) -> promise;

avs.on(identifier, callback)

identifiers:
  log - when a log occurs
  error - when an error occurs
```

# TODO

- [ ] Support for different Tx/Rx types (ArrayBuffer, Base64, FormData, etc.)
- [ ] Handle AVS responses
- [ ] Create response audio player
- [ ] Support for WebSocket Tx/Rx
- [ ] Better documentation
- [ ] Make it work in Node environment

# License

MIT
