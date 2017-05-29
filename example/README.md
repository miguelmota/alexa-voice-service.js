# Example

> How to run example

Start a http server

```bash
python -m http.server 8080
```

Visit [http://localhost:8080](http://localhost:8080)

## Config

Set AVS config object in the constructor

```javascript
const avs = new AVS({
  clientId: 'amzn1.application-oa2-client.123...',
  deviceId: 'example_device',
  deviceSerialNumber: 123,
  redirectUri: `https://example.com/authresponse`
});
```

## Development

Install dependencies

```bash
npm install
```

Watch and build

```bash
npm run watch
```

Build

```bash
npm run build
```

# License

MIT
