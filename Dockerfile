FROM node:lts-alpine3.12

WORKDIR /app

RUN apk add --no-cache \
    g++ \
    gcc \
    make \
    python3

COPY package.json package-lock.json ./

RUN npm i \
    mkdir mp3

COPY . ./

CMD ["node","main.js"]
