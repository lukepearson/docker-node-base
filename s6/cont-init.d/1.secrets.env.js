#!/usr/bin/with-contenv node

'use strict';

const fs = require('fs');
const http = require('http');
const https = require('https');

const outputWritePath = "/var/run/s6/container_environment/";

const vaultGroup = process.env.VAULT_GROUP;
const exchangeAddress = process.env.EXCHANGE_HOST;
const overrideVaultToken = process.env.VAULT_TOKEN;

const vaultInfo = getVaultHost();

if (!vaultInfo) {
  console.error('Unable to fetch secrets');
  process.exit(1)
}

const vaultSecure = vaultInfo.secure
const vaultHost = vaultInfo.host

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
  if (overrideVaultToken) {
    return callback(null, overrideVaultToken)
  }

  let opts = {
    hostname: exchangeAddress,
    path: `/group/token/${ vaultGroup }`,
    port: 443
  }

  makeRequest(opts, true, callback)
}

function getSecretListFromVault(callback) {
  makeRequest({
    host: vaultHost,
    path: `/v1/secret/${ vaultGroup }/?list=true`,
    port: 8200,
    headers: {
      'x-vault-token': vaultToken
    }
  }, vaultSecure, (err, response) => {
    if (err) {
        return callback(err)
    }

    let parsedResponse
    try {
        parsedResponse = JSON.parse(response)
    } catch (e) {
        return callback(e)
    }

    if (!parsedResponse.data || !parsedResponse.data.keys) {
        return callback(new Error('Cannot find .data.keys in response'))
    }

    let secretList = parsedResponse.data.keys;
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
  }, vaultSecure, (err, response) => {
    if (err) {
        return callback(err)
    }

    let parsedResponse
    try {
        parsedResponse = JSON.parse(response)
    } catch (e) {
        return callback(e)
    }

    callback(null, parsedResponse.data);
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

function makeRequest(options, secure, callback) {
  let httpRequest = secure ? https.request : http.request

  let req = httpRequest(options, function(response) {
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

  let match = process.env.VAULT_ADDR.match(/([a-z]+):\/\/(.*):?/)

  if (!match || !match[1] || !match[2]) {
    console.warn(
      `Unable to find vault host. Environment variable $VAULT_ADDR is set to ${process.env.VAULT_ADDR}`
    );
    return
  }
  return {
    secure: match[1] === 'https',
    host: match[2]
  }
}
