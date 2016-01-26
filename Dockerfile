FROM gaiaadm/nodejs:0.12.6

ARG http_proxy
ARG https_proxy

RUN npm install -g nodemon grunt

# Set the working directory
WORKDIR /src

CMD ["/bin/bash"]
