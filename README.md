# alexa-voice-service.js

> Library for interacting with [Alexa Voice Service (AVS)](https://developer.amazon.com/public/solutions/alexa/alexa-voice-service) in the browser.

NOTE: THIS LIBRARY IS STILL IN DEVELOPMENT.

Things you can do with this library now:

- Login with Amazon
- Request microphone
- Record user audio
- Send user audio to AVS
- Parse response from AVS
- Play MP3 response from AVS

The audio recorded in this library is *mono channel, sampled at 16k Hz, and signed 16 bit PCM encoding* which is required by AVS.

# Demo

[http://lab.moogs.io/alexa-voice-service](http://lab.moogs.io/alexa-voice-service)

# Install

```bash
npm install alexa-voice-service
```

# Example

View the full [example code](/example).

# Documentation

Most methods return a promise.

```javascript
AVS(options) - constructor

options:
  debug - {boolean} logs to console
  clientId - {string} AVS client id found in portal
  clientSecret - {string} AVS client secret found in portal. Only needed if using `code` response type.
  deviceId - {string} AVS device Id found in portal
  deviceSerialNumber - {number} serial number for this device (can be made up)
  redirectUri - {string} redirect uri set in portal

avs.login({responseType: 'code, token (default)', newWindow: false}) -> promise(response);
avs.promptUserLogin() -> promise();
avs.getTokenFromUrl() -> promise(token);
avs.getCodeFromUrl() -> promise(code);
avs.getTokenFromCode(code) -> promise(response);

avs.requestMic() -> promise(stream);
avs.connectMediaStream(stream) -> promise;

avs.stopRecording() -> promise;
avs.startRecording() -> promise;
avs.playBlob(blob) -> promise;
avs.sendAudio(dataView) -> promise(response);

avs.on(identifier, callback)

identifiers:
  log - when a log occurs
  error - when an error occurs
  login - when user is logged in
  recordStart - when recording is started
  recordStop - when recording is stopped
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
