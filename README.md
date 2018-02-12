# alexa-voice-service.js

> Library for interacting with [Alexa Voice Service (AVS)](https://developer.amazon.com/public/solutions/alexa/alexa-voice-service) in the browser.

---

# IN NEED OF MAINTAINERS

Please ping me if you'd like to take over this library since I've been out of the loop with Alexa/AVS. Thanks!

---

## Things you can do

Things you can do with this library:

- Login with Amazon and get access token
- Get access token and refresh token from 'code' response type
- Get access token from refresh token
- Request user microphone
- Record user audio using microphone
- Send user audio to AVS
- Parse response from AVS
- Queue and play MP3 responses from AVS.

The audio recorded in this library is *mono channel, sampled at 16k Hz, and signed 16 bit PCM encoding* which is required by AVS.

# Demo

**[https://lab.miguelmota.com/alexa-voice-service](https://lab.miguelmota.com/alexa-voice-service)**

## Install

```bash
npm install alexa-voice-service
```

## Example

Follow these steps to run demo locally:

1. Git clone this repo

  ```bash
  git clone git@github.com:miguelmota/alexa-voice-service.js.git

  cd alexa-voice-service.js/example/
  ```

2. Install NPM Modules

  ```bash
  npm install
  ```

3. Run HTTPS server

  ```bash
  npm start
  ```

4. Go to browser url.

  ```bash
  open https://localhost:9745
  ```

More info in the example [README](https://github.com/miguelmota/alexa-voice-service.js/blob/master/example/README.md).

## Usage

```javascript
const AVS = require('alexa-voice-service');

const avs = new AVS(options);
```

Please check out example as noted above.

## Documentation

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
avs.promptUserLogin() -> alias to login();
avs.logout() -> promise();
avs.getTokenFromUrl() -> promise(token);
avs.getCodeFromUrl() -> promise(code);
avs.getTokenFromCode(code) -> promise(response);
avs.getTokenFromRefreshToken(refreshToken) -> promise(token)
avs.refreshToken() -> promise({token, refreshToken})
avs.getToken() -> promise(token)
avs.getRefreshToken() -> promise(refreshToken)
avs.requestMic() -> promise(stream);
avs.connectMediaStream(stream) -> promise;
avs.stopRecording() -> promise;
avs.startRecording() -> promise;
avs.sendAudio(dataView) -> promise(response); - send audio to AVS and get back an object containing response.
The response object is the parsed http message.
avs.audioToBlob(AudioBuffer | DataView) -> promise(blob) - mp3 blob

avs.on(identifier, callback)

identifiers (found under AVS.EventTypes object)
  LOG - when a log occurs.
  ERROR - when an error occurs.
  LOGIN - when user is logged in.
  LOGOUT - when user is logged out.
  RECORD_START - when recording is started.
  RECORD_STOP - when recording is stopped.
  TOKEN_SET - when token is set.
  REFRESH_TOKEN_SET - when refresh token is set.
  TOKEN_INVALID - when token is invalid, usually because it is expired.

example: avs.on(AVS.EventTypes.LOG, callback)

# Player

avs.player.enqueue(dataView|typedArray|arrayBuffer|url) -> promise(arraybuffer) - add an audio source to play queue. Converts input to AudioBuffer.
avs.player.deque() -> promise() - dequeu an audio source to play
avs.player.play() -> promise() - play next source in queue
avs.player.stop() -> promise() - stop playing
avs.player.replay() -> promise() - replay last audio source played
avs.player.pause() -> promise() - pause playing
avs.player.emptyQueue() -> promise() - empty the queue
avs.player.playBlob(blob) -> promise(blob) - play a blob source
avs.player.playAudioBuffer(audioBuffer) -> promise() - play an AudioBuffer source
avs.player.playUrl(url) -> promise(url) - play mp3 url

avs.player.on(identifier, callback)

identifiers (found under AVS.Player.EventTypes object)
  LOG - when a debug log occurs
  ERROR - when an error occurs
  PLAY - when audio source is played
  REPLAY - when audio source is replayed
  PAUSE - when audio source is paused
  STOP - when audio source is stopped playing
  ENQUEUE - when an audio source is added to queue
  DEQUE - when an audio source is removed from queue
```

## Resources

- [Alexa Voice Service (AVS) Authentication](https://miguelmota.com/blog/alexa-voice-service-authentication)

- [Generate Self-signed SSL Certificate](https://miguelmota.com/blog/generate-self-signed-ssl-certificate)

## TODO

- [ ] Better documentation

## License

MIT
