A boilerplate project for running a nodejs daemon inside a Docker container.

Intended to be used in combination with: https://github.com/infinityworks/node-app-base

Features:
* supervised node daemon
* fetch secrets from Vault

Todo:
* force apps to expose common http interface?
** could auto-wrap these with metrics, and auto-document through a /endpoints page
* load balancer probe endpoint?

## How to use

1. Create a docker container from the image: `super6awspoc/docker-node-base`. You should lock this down to a particular version.
2. Copy your node app into /app
3. Make your node app use the npm module: `node-app-base`

### Example Dockerfile for your service

```
FROM super6awspoc/docker-node-base:1.0.0
MAINTAINER infinityworks

COPY app /app
```

## Environment variables

All environment variables are optional unless stated, though if not set their respective services may fail.

### Secret fetching

* EXCHANGE_PROTO
* EXCHANGE_HOST
* VAULT_ADDR
* VAULT_GROUP


### Log forwarding

ELASTICSEARCH_HOST
ELASTICSEARCH_PORT
LOG_SERVICE_NAME - used to enrich log meta-data
HOST_IP - used to enrich log meta-data
