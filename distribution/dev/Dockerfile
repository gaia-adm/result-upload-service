FROM ubuntu:trusty

ENV http_proxy 'http://proxy.bbn.hp.com:8080'
ENV https_proxy 'http://proxy.bbn.hp.com:8080'

#RUN
#  apt-get update && apt-get dist-upgrade

RUN   \
  apt-get -y -qq install wget

# Install Node
RUN   \
  cd /opt && \
  wget http://nodejs.org/dist/v0.12.4/node-v0.12.4-linux-x64.tar.gz && \
  tar -xzf node-v0.12.4-linux-x64.tar.gz && \
  mv node-v0.12.4-linux-x64 node && \
  cd /usr/local/bin && \
  ln -s /opt/node/bin/* . && \
  rm -f /opt/node-v0.12.4-linux-x64.tar.gz

RUN npm install -g nodemon

# Set the working directory
WORKDIR   /src

CMD ["/bin/bash"]

