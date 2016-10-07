A boilerplate project for running a nodejs daemon inside a Docker container.

Intended to be used in combination with: https://github.com/infinityworksltd/node-app-base

Features:
* supervised node daemon
* fetch secrets from Vault

Todo:
* log forwarding to elasticsearch
* publish a docker container that can be descended from
* cron scheduling?
* force apps to expose common http interface?
* load balancer probe endpoint

## How to use

1. Create a docker container from the image: `super6awspoc/docker-node-base`
2. Copy your node app into /app
3. Make your node app use the npm module: `node-app-base`

## Environment variables

You will need to provide the following environment variables to initialise the container:
* EXCHANGE_PROTO
* EXCHANGE_ADDR
* VAULT_GROUP
