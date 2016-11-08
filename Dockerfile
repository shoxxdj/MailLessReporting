FROM node:6.5.0

RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

COPY app/package.json /usr/src/app/
RUN npm install

VOLUME app/ /usr/src/app

EXPOSE 8080
ENTRYPOINT ["node","server.js"]
