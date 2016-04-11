# Example

Run in root of this repo:

```bash
python -m SimpleHTTPServer 9000
```

Then navigate to:

```text
http://localhost:9000/example
```

# Example

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

##### Receving file in Express example

```javascript
const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const cors = require('cors');
const multer  = require('multer');
const upload = multer({ dest: 'uploads/' })

app.use(bodyParser.urlencoded({ extended: true}))
app.use(bodyParser.json());
app.use(cors());

app.post('/audio', upload.single('data'), (req, res) => {
  res.json(req.file);
});

app.listen(5555);
```
