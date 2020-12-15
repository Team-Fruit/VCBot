FROM node:lts-alpine3.12

WORKDIR /app

RUN apk add --no-cache --virtual .node-gyp \
    g++ \
    gcc \
    make \
    python3

COPY package.json package-lock.json ./

RUN npm i \
    mkdir mp3

COPY . ./

RUN apk del .node-gyp

CMD ["node","main.js"]
