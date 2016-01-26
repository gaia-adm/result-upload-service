FROM gaiaadm/nodejs:0.12.6

ARG http_proxy
ARG https_proxy

RUN npm install -g nodemon grunt

# Set the working directory
WORKDIR /src

# copy all sources
COPY . /src

RUN npm install

EXPOSE  8080

CMD ["node", "/src/server.js"]
