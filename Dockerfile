FROM node:current-alpine3.14

WORKDIR /app

RUN apk add --no-cache --virtual .node-gyp \
    git \
    g++ \
    gcc \
    make \
    python3

COPY package.json package-lock.json ./

RUN npm i

COPY ./ ./

RUN mkdir mp3
RUN npm run build


RUN apk del .node-gyp

CMD ["node","build/main.js"]
