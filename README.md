# VCBot

### production

1. gcloud のトークンの json を `./gtoken.json` にしておいてください
2. discord の API トークンを `./config/token.json` にかきこんでください
3. `docker-compose build`
4. `docker-compose up -d`
   おわり

### develop

1. configディレクトリの`token.json.template`を`token.json`にして Discord のトークンを書き込んでください
2. Google Text to Speech のトークンをそこら辺に保存して
   windows:`$env:GOOGLE_APPLICATION_CREDENTIALS="/your/path/to/gtoken.json"` してください
3. `node main.js`
   おわり
