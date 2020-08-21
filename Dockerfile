FROM node:lts
WORKDIR /app
COPY package-lock.json .
COPY package.json .
RUN npm i
COPY main.js .
COPY joined.mp3 .
COPY leaved.mp3 .
COPY output.mp3 .
COPY token.json .
COPY gtoken.json .
RUN mkdir mp3
CMD ["node","main.js"]