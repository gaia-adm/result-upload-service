CircleCI build status: [![Circle CI](https://circleci.com/gh/gaia-adm/result-upload-service.svg?style=svg)](https://circleci.com/gh/gaia-adm/result-upload-service)

# result-upload-service

Result Upload Service offers a public REST endpoint for sending unprocessed data to GAIA from which measures need to be extracted. Data can be in any format supported by GAIA result processors. Typically it will be XML/JSON data - builds, tests, issue changes extracted from public REST of ALM, Jenkins, JIRA etc.

Configuration is limited as Docker network links/port mappings are expected to be used:
- server port is hardcoded to 8080 - not relevant, real port is decided by Docker port mapping
- auth server must be specified using AUTH_SERVER env variable in the form "hostname:port"
- file storage path is set via STORAGE_PATH environment variable. In production it will be NFSv4 volume mounted in Docker
- RabbitMQ server must be specified using AMQ_SERVER env variable in the form "hostname:port"
    - credentials are configured via AMQ_USER and AMQ_PASSWORD environment variables - temporary, we need to have a service for this. AMQ_PASSWORD is optional
- use REST_STACKTRACE=true environment property to enable sending stacktraces on REST in case of error
- file size limit can be configured via UPLOAD_LIMIT environment variable. Default is 50MB

## Public REST
- POST /result-upload/rest/v1/upload-data - used to send content to be processed
    - supports Content-Type "application/*" and "text/*"
    - metadata is transported in query parameters. The following metadata is required: metric, category. All query parameters are passed to result processor.
    - responds with 200 OK if the file was accepted and its guaranteed it will be processed

The service is implemented in Node.js in order to support many parallel connections. There is no processing in the service. It saves received file to local file system (NFS v4 in production) under uuid based name. After saving file, it sends notification to RabbitMQ to exchange "result-upload" with metadata and file path. As RabbitMQ routingKey we use "metric/category".

There are three types of tests:
- unit - limited to single module, do not use OS functions or other external systems
- system - single module, but may use OS functions (file system) and external systems (RabbitMQ) - they require a network link in Docker
- rest - public REST API tests. These need a running [result-upload-service] instance and Docker network link

## Building

Gruntfile.js is used for running tests, JSHint, JSDoc.

For building production image distribution/release/Dockerfile is used. Local shell script setup.sh is used to execute statements requiring proxy (i.e npm install).
Examples:
- docker build -t gaiaadm/result-upload-service -f distribution/release/Dockerfile .

For building image for development purposes, distribution/dev/Dockerfile can be used. The dev image is meant to be used for starting "nodemon server.js" which will automatically reload Node.js server after file change. The dev image doesn't start node.js automaticlly, instead it just starts shell. It also expects npm dependencies are already available. In dev environment one would setup mapping of "/src" to host file system.

## Running

Execute:
- docker run -d -p 9006:8080 -e AMQ_USER="admin" -e AMQ_SERVER="rabbitmq:5672" -e AUTH_SERVER="sts:8080" -e STORAGE_PATH="/upload" -v "/tmp:/upload" --link rabbitmq:rabbitmq --link sts:sts --name result-upload-service gaiaadm/result-upload-service:0.1

When result-upload-service starts, it will create unique directory in /upload where uploaded files can be found. This directory can be found in log. For development purposes usage of /tmp is sufficient. For production it needs to be NFSv4 volume. Linking requires knowledge of container name/id we are linking to (i.e "sts", "rabbitmq" in example).

## Known issues
- we don't handle reconnection to RabbitMQ, handle AMQ channel recreation
- file storage could be more optimized (do not store all files in one directory), separation by tenantId (each tenant different directory - need to know tenantId)
- support "multipart/mixed" Content-Type and batched uploads - they eliminate network latency. Could be significant when sending many small files (events).
