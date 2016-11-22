#!/usr/bin/with-contenv node

'use strict';

const fs = require('fs');
const https = require('https');

const outputWritePath = "/var/run/s6/container_environment/";

const vaultGroup = process.env.VAULT_GROUP;
const exchangeAddress = process.env.EXCHANGE_HOST;
const exchangeCaPath = process.env.EXCHANGE_CA_PATH;

const vaultHost = getVaultHost();

if (!vaultHost) {
  console.error('Unable to fetch secrets');
  process.exit(1)
}

let vaultToken;
getAuthenticationToken(onAuthenticationToken);

function onAuthenticationToken(err, token) {
  if (err) {
      console.error(err)
      process.exit(1)
  }
  vaultToken = token
  getSecretListFromVault(onSecretListFromVault)
}

function onSecretListFromVault(err, secretList) {
  if (err) {
    console.error(err)
    process.exit(1)
  }
  secretList.forEach(getSecretAndWrite);
}


// Helpers

function getAuthenticationToken(callback) {
  let opts = {
    hostname: exchangeAddress,
    path: `/group/token/${ vaultGroup }`,
    port: 443,
  }

  if (exchangeCaPath) {
    opts.ca = loadExchangeCa(exchangeCaPath)
  }

  makeRequest(opts, callback)
}

function getSecretListFromVault(callback) {
  makeRequest({
    host: vaultHost,
    path: `/v1/secret/${ vaultGroup }/?list=true`,
    port: 8200,
    headers: {
      'x-vault-token': vaultToken
    }
  }, (err, response) => {
    if (err) {
        return callback(err)
    }

    let secretList = JSON.parse(response).data.keys;
    callback(null, secretList);
  });

}


function getSecretsFromVault(key, callback) {
  makeRequest({
    host: vaultHost,
    path: `/v1/secret/${ vaultGroup }/${ key }`,
    port: '8200',
    headers: {
      'x-vault-token': vaultToken
    }
  }, (err, response) => {
    if (err) {
        return callback(err)
    }
    let secrets = JSON.parse(response);
    callback(null, secrets.data);
  });

}

function getSecretAndWrite(secret) {
  getSecretsFromVault(secret, writeSecretData);
}

function writeSecretData(err, secrets) {
  if (err) {
    console.error(err)
    process.exit(1)
  }

  Object.keys(secrets).forEach((key) => {
    let secret = secrets[key];
    console.log(`Writing secret: ${key}`);
    fs.writeFileSync(outputWritePath + key, secret);
  });
}

function makeRequest(options, callback) {
  let req = https.request(options, function(response) {
    let responseData = ''
    response.on('data', function(chunk) {
      responseData += chunk;
    });

    response.on('end', function() {
      callback(null, responseData);
    });
  });

  req.end()

  req.on('error', (e) => {
    return callback(e)
  })
}

function getVaultHost() {
  if (!process.env.VAULT_ADDR) {
    console.warn(`$VAULT_ADDR is not set!`);
    return
  }

  let hostname = process.env.VAULT_ADDR.match(/:\/\/(.*):/);
  if (hostname == null) {
    console.warn(
      `Unable to find vault host. Environment variable $VAULT_ADDR is set to ${process.env.VAULT_ADDR}`
    );
    return
  }
  return hostname[1];
}

function loadExchangeCa(path) {
  return fs.readFileSync(path).toString()
}
