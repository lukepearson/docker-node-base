#!/usr/bin/with-contenv node

'use strict';

const fs = require('fs');
const os = require('os');
const http = require('http');
const https = require('https');

var chainLines = fs.readFileSync('/etc/ssl/certs/ca-certificates.crt', 'utf8').split("\n");
var cert = [];
var certificateAuthority = [];
chainLines.forEach(function(line) {
  cert.push(line);
  if (line.match(/-END CERTIFICATE-/)) {
    certificateAuthority.push(cert.join("\n"));
    cert = [];
  }
});

const outputWritePath = "/var/run/s6/container_environment/";

const exchangeAddress = process.env.EXCHANGE_HOST;
const overrideVaultToken = process.env.VAULT_TOKEN;
const containerHostname = os.hostname();

console.log('Sending container hostname: ' + containerHostname);

const vaultInfo = getVaultHost();

if (!vaultInfo) {
    console.error('Unable to fetch secrets');
    process.exit(1)
}

const vaultSecure = vaultInfo.secure;
const vaultHost = vaultInfo.host;
const vaultPort = vaultInfo.port || 8200;

let vaultToken;
getAuthenticationToken(onAuthenticationToken);

function onAuthenticationToken(err, token, responseCode) {

    if (err) {
        console.error(err);
        process.exit(1)
    }

    if(responseCode != '200')
    {
        console.error('Could not get exchange token, ' + responseCode + ' response.');
        process.exit(1);
    }

    console.log("Token");
    console.log(token);

    vaultToken = token;
    getSecretListFromVault(false, onSecretListFromVault)
}

function onSecretListFromVault(err, secretList) {
    if (err) {
        console.error(err);
        process.exit(1)
    }

    if(typeof secretList == 'undefined' || secretList.length < 1)
    {
        console.error('Could not find ANY secrets.');
        process.exit(1);
    }

    secretList.forEach(getSecretAndWrite);
}


// Helpers

function getAuthenticationToken(callback) {
    if (overrideVaultToken) {
        return callback(null, overrideVaultToken, 200)
    }

    let opts = {
        hostname: exchangeAddress,
        path: `/token`,
        port: 443,
        method: 'POST',
        data: JSON.stringify({"containerId": containerHostname}),
        headers: {"Content-Type":"application/json"}
    };

    makeRequest(opts, true, callback)
}

function getSecretListFromVault(path, callback) {

    if(!path)
    {
        path = `/v1/secret/`;
    }

    makeRequest({
            host: vaultHost,
            path: path + `?list=true`,
            port: vaultPort,
            headers: {
                "x-vault-token": vaultToken
            },
            ca: certificateAuthority
        },
        vaultSecure,
        (err, response) => {
            recurseVaultStructure(err, response, callback, path);
        }
    );
}

function recurseVaultStructure(err, response, callback, path)
{
    if (err) {
        return callback(err)
    }

    let parsedResponse;
    try {
        parsedResponse = JSON.parse(response)
    } catch (e) {
        console.error(e);
        return callback(e)
    }

    if (!parsedResponse.data || !parsedResponse.data.keys) {
        return callback(new Error('Cannot find .data.keys in response'))
    }

    let secretList = parsedResponse.data.keys;

    let secretPromises = secretList.map(function(key) {

        return new Promise(function(resolve, reject){
            if(key.slice(-1) == '/') {
                console.log('Recursing into path: ' + path + key);
                getSecretListFromVault(path + key, function(err, newSecretKeys) {
                    if(err) {
                        reject(err);
                        return;
                    }

                    resolve(newSecretKeys);
                });

            }
            else {
                console.log('Adding key: ' + path + key);
                resolve([path + key]);
            }
        });

    });

    Promise.all(secretPromises).then(function(secretKeys){
        let flatKeys = [].concat.apply([], secretKeys);

        onSecretListFromVault(false, flatKeys);
    }).catch(function(err) {

    });
}


function getSecretsFromVault(key, callback) {

    makeRequest({
        host: vaultHost,
        path: key,
        port: vaultPort,
        headers: {
            'x-vault-token': vaultToken
        },
        ca: certificateAuthority
    }, vaultSecure, (err, response) => {
        if (err) {
            return callback(err)
        }

        let parsedResponse;
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
        console.error(err);
        process.exit(1)
    }

    if (secrets) {
        Object.keys(secrets).forEach((key) => {
            let secret = secrets[key];
            console.log(`Writing secret: ${key}`);
            fs.writeFileSync(outputWritePath + key, secret);
        });
    }
}

function makeRequest(options, secure, callback) {
    let httpRequest = secure ? https.request : http.request;


    let req = httpRequest(options, function(response) {
        let responseData = '';
        response.on('data', function(chunk) {
            responseData += chunk;
        });

        response.on('end', function() {
            callback(null, responseData, response.statusCode);
        });
    });

    if(options.method == 'POST') {
        req.write(options.data);
    }

    req.end();

    req.on('error', (e) => {
        return callback(e)
    })
}

function getVaultHost() {
    if (!process.env.VAULT_ADDR) {
        console.warn(`$VAULT_ADDR is not set!`);
        return
    }

    let match = process.env.VAULT_ADDR.match(/([a-z]+):\/\/(.*):?(:(\d+))/)

    if (!match || !match[1] || !match[2]) {
        console.warn(
            `Unable to find vault host. Environment variable $VAULT_ADDR is set to ${process.env.VAULT_ADDR}`
        );
        return
    }

    return {
        secure: match[1] === 'https',
        host: match[2],
        port: match[4] || 8200
    };
}
