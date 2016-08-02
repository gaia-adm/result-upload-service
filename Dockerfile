FROM gaiaadm/nodejs:4.4.7

RUN npm install -g nodemon grunt

# Set the working directory
WORKDIR /src

# copy all sources
COPY . /src

RUN npm install

EXPOSE  8080

CMD ["node", "/src/server.js"]
