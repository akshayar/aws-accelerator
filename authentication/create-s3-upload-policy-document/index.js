'use strict';

/**
 * Created by Peter Sbarski
 * Updated by Mike Chambers
 * Updated by Julian Pittas
 * Last Updated: 28/02/2018
 *
 * Required Env Vars:
 * UPLOAD_BUCKET
 * ROLE_ARN
 * UPLOAD_URI - https://s3.amazonaws.com
 */

const AWS = require('aws-sdk');
const crypto = require('crypto');
const sts = new AWS.STS();

const s3 = new AWS.S3();


const base64encode = (value) => {
  return new Buffer(value).toString('base64');
};

const generateExpirationDate = ()  => {
  // Adds a day to the current date
  let currentDate = new Date();
  currentDate = currentDate.setDate(currentDate.getDate() + 1);
  return new Date(currentDate).toISOString();
};

const generatePolicyDocument = (key, bucket)  => {

  const expiration = generateExpirationDate();

  const policy = {
      'expiration' : expiration,
      'conditions': [
          {key: key},
          {bucket: bucket},
          {acl: 'private'},
          ['starts-with', '$Content-Type', '']
      ]
  };

  return policy;

};

const encode = (policy)  => {
  return base64encode(JSON.stringify(policy)).replace('\n','');
}

const generateSignature = (encoding,tmpAccessToken)  => {
  return crypto.createHmac('sha1', tmpAccessToken.secretAccessKey).update(encoding).digest('base64');
};

const generateResponse = (status, message) => {
    return {
      statusCode: status,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body : JSON.stringify(message)
    }
};

const handler = (event, context, callback) => {

  var tmpAccessToken ={};
  sts.assumeRole({
    RoleArn: process.env.ROLE_ARN,
    RoleSessionName: 'awssdk'
  }, function(err, data) {
    if (err) { // an error occurred
      console.log('Cannot assume role');
      console.log(err, err.stack);
    } else { // successful response
      tmpAccessToken={
        accessKeyId: data.Credentials.AccessKeyId,
        secretAccessKey: data.Credentials.SecretAccessKey,
        sessionToken: data.Credentials.SessionToken
      };
      console.log('Assumed role',JSON.stringify(tmpAccessToken));
      // Get the filename from the query string parameters in the GET call
      const filename = decodeURI(event.queryStringParameters.filename);
      const directory = crypto.randomBytes(20).toString('hex');

      const key = directory + '/' + filename;
      const bucket = process.env.UPLOAD_BUCKET;

      const policyDocument = generatePolicyDocument(key, bucket);
      const encodedPolicyDocument = encode(policyDocument);
      const signature = generateSignature(encodedPolicyDocument,tmpAccessToken);

      const body = {
          signature: signature,
          encoded_policy: encodedPolicyDocument,
          access_key: tmpAccessToken.accessKeyId,
          session_token: tmpAccessToken.sessionToken,
          upload_url: (process.env.UPLOAD_URI  || 'https://s3.amazonaws.com') + '/' + bucket,
          key: key
      };

      const response = generateResponse(200, body);
      callback(null, response);
    }
  });
};

module.exports = {
  handler
};