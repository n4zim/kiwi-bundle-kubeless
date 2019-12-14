FROM node:alpine-13

WORKDIR /app

RUN yarn

USER 1000

CMD [ "node", "kubeless.js" ]
