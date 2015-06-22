# result-upload-service

Result Upload Service offers a public REST endpoint for sending unprocessed data to GAIA from which measures need to be extracted. Data can be in any format supported by GAIA result processors. Typically it will be XML/JSON data - builds, tests, issue changes extracted from public REST of ALM, Jenkins, JIRA etc.

Configuration is limited as Docker network links/port mappings are expected to be used:
- server port is hardcoded to 8080 - not relevant, real port is decided by Docker port mapping
- auth server is hardcoded to authserver:9001 - requires Docker network link for "authserver"
- file storage path is set via STORAGE_PATH environment variable. In production it will be NFSv4 volume mounted in Docker
- RabbitMQ server is hardcoded to amqserver:5672 -  requires Docker network link for "amqserver"
    - credentials are configured via AMQ_USER and AMQ_PASSWORD environment variables - temporary, we need to have a service for this

Public REST:
- POST /result-upload/rest/v1/upload-file - used to send content to be processed
    - supports Content-Type "application/*" and "text/*"
    - metadata is transported in query parameters. The following metadata is supported: metric, category, name, timestamp, tags. Semantics is the same like in [metrics-gateway-service]. Metric, category and name are required.
    - responds with 200 OK if the file was accepted and its guaranteed it will be processed

The service is implemented in Node.js in order to support many parallel connections. There is no processing in the service. It saves received file to local file system (NFS v4 in production) under uuid based name. After saving file, it sends tification to RabbitMQ to exchange "result-upload" with metadata and file path. As RabbitMQ routingKey we use "metric/category".

There are three types of tests:
- unit - limited to single module, do not use OS functions or other external systems
- system - single module, but may use OS functions (file system) and external systems (RabbitMQ) - they require a network link in Docker
- rest - public REST API tests. These need a running [result-upload-service] instance and Docker network link

Building:

Gruntfile.js is used for running tests, JSHint, JSDoc. For building production image distribution/release/Dockerfile can be used. For building image for development purposes, distribution/dev/Dockerfile can be used. The dev image is meant to be used for starting "nodemon server.js" which will automatically reload Node.js server after file change. In dev environment one would setup mapping of "/src" to host file system.

Known issues:
- need to solve graceful shutdown - close all sockets/connections
- we don't handle reconnection to RabbitMQ, handle AMQ channel recreation
- no file size limits, file storage could be more optimized, separation by tenantId (each tenant different directory - need to know tenantId)
- don't send stacktrace for REST errors when in production
- support "multipart/mixed" Content-Type and batched uploads - they eliminate network latency. Could be significant when sending many small files (events).
