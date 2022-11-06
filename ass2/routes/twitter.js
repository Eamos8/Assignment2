const express = require('express');
const axios = require ('axios');
const router = express.Router();
const twit = require('twitter');
const needle = require('needle');
require('dotenv').config();
const AWS = require('aws-sdk');
const redis = require('redis');

//Natural classifier
const nltk = require('../classifier/natural.js');
//const redisClient = redis.createClient();
//const bucketName = "eamontest";
//const s3 = new AWS.S3({ apiVersion: "2006-03-01" });


async function fnAsync(data) {
    let response = await nltk.identify(data);
    //return response;
    //if( response)    
    console.log(response); // "Promise resolved"
    //Process result
}
//Replace sample text with tweet
//fnAsync('what a great day');

const redisClient = redis.createClient();
(async () => {
  try {
    await redisClient.connect();
  } catch (err) {
    console.log(err);
  }
})();

// S3 setup
const bucketName = "eamon-ass2";
const s3 = new AWS.S3({ apiVersion: "2006-03-01" });

(async () => {
  try {
    await s3.createBucket({ Bucket: bucketName }).promise();
    console.log(`Created bucket: ${bucketName}`);
  } catch (err) {
    // We will ignore 409 errors which indicate that the bucket already exists
    if (err.statusCode !== 409) {
      console.log(`Error creating bucket: ${err}`);
    }
  }
})();

//DO NOT MERGE FROM HERE DOWN


const token = process.env.TOKEN;


const rulesURL = 'https://api.twitter.com/2/tweets/search/stream/rules';
const streamURL = 'https://api.twitter.com/2/tweets/search/stream';

const twitter = new twit({
    consumer_key: process.env.CONSUMER_KEY,
    consumer_secret: process.env.CONSUMER_SECRET,
    access_token: process.env.ACCESS_TOKEN,
    access_token_secret: process.env.ACCESS_TOKEN_SECRET
})

async function persistence(query, data) {
    const redisKey = `tweets:${query}`;
    const s3Key = `tweets:${query}`;
    const result = await redisClient.get(redisKey);
    const params = { Bucket: bucketName, Key: s3Key };
  
    if (result) {
      // Serve from redis
      const resultJSON = JSON.parse(result);
    } else {
      //Check S3
      try {
        const s3Result = await s3.getObject(params).promise();
        // Serve from S3 and store in Redis
        const s3JSON = JSON.parse(s3Result.Body);
        redisClient.setEx(
          redisKey,
          3600,
          JSON.stringify({s3JSON })
        );
      } catch (err) {
        if (err.statusCode === 404) {
          // Serve from Wikipedia API and store in S3 and Redis
          redisClient.setEx(
            redisKey,
            3600,
            JSON.stringify({data })
          );
          const body = JSON.stringify({
            data
        });
    
        const objectParams = { Bucket: bucketName, Key: s3Key, Body: body };
        await s3.putObject(objectParams).promise();
        console.log(`Successfully uploaded data to ${bucketName}/${s3Key}`);
    
        console.log(data);
        } else {
          // Something else went wrong when accessing S3
          console.log('Something else went wrong when accessing S3');
        }
      }
    }
}

//RULES START

// Edit rules as desired below | Value for rules should be retrieved for


async function getAllRules() {

    const response = await needle('get', rulesURL, {
        headers: {
            "authorization": `Bearer ${token}`
        }
    })

    if (response.statusCode !== 200) {
        console.log("Error:", response.statusMessage, response.statusCode)
        throw new Error(response.body);
    }

    return (response.body);
}

async function deleteAllRules(rules) {

    if (!Array.isArray(rules.data)) {
        return null;
    }

    const ids = rules.data.map(rule => rule.id);

    const data = {
        "delete": {
            "ids": ids
        }
    }

    const response = await needle('post', rulesURL, data, {
        headers: {
            "content-type": "application/json",
            "authorization": `Bearer ${token}`
        }
    })

    if (response.statusCode !== 200) {
        throw new Error(response.body);
    }

    return (response.body);

}

async function setRules(ruleKeywords) {
    var keywords = ruleKeywords;
    var split = keywords.split(', ');
    var addRules = [];
    for(let i=0; i<split.length; i++){
        addRules.push({
            'value': split[i],
            'tag': split[i]
        });
    }
    const data = {
        "add": addRules
    }
    const response = await needle('post', rulesURL, data, {
        headers: {
            "content-type": "application/json",
            "authorization": `Bearer ${token}`
        }
    })

    if (response.statusCode !== 201) {
        throw new Error(response.body);
    }

    return (response.body);

}

function streamConnect(retryAttempt, number, res, keywords) {
    var tweets = [];
    var analysedTweets = [];

    const stream = needle.get(streamURL, {
        headers: {
            "User-Agent": "v2FilterStreamJS",
            "Authorization": `Bearer ${token}`
        },
        timeout: 20000
    });
    stream.on('data', data => {
        try {
            tweets.unshift(JSON.parse(data));
            console.log(Object.keys(tweets).length);
            //HERE IS WHERE ASYNCFUNC IS CALLED
            //filter data into text and image
            //last term will always be image
            if(Object.keys(tweets).length >= number){
                stream.destroy();
                console.log('stop');
                persistence(keywords, tweets);
                res.render('index');
            }
            //console.log(fnAsync(tweets.text));
            // A successful connection resets retry count.
            retryAttempt = 0;
        } catch (e) {
            if (data.detail === "This stream is currently at the maximum allowed connection limit.") {
                console.log(data.detail)
                process.exit(1)
            } else {
                // Keep alive signal received. Do nothing.
            }
        }
    }).on('err', error => {
        if (error.code !== 'ECONNRESET') {
            console.log(error.code);
            process.exit(1);
        } else {
            // This reconnection logic will attempt to reconnect when a disconnection is detected.
            // To avoid rate limits, this logic implements exponential backoff, so the wait time
            // will increase if the client cannot reconnect to the stream. 
            setTimeout(() => {
                console.warn("A connection error occurred. Reconnecting...")
                streamConnect(++retryAttempt);
            }, 2 ** retryAttempt)
        }
    });
    console.log('stream on');
    return stream;
}

//END RULES CODE




router.get('/', (req, res) => {
    (async () => {
        let currentRules;
        try {
            // Gets the complete list of rules currently applied to the stream
            currentRules = await getAllRules();
    
            // Delete all rules. Comment the line below if you want to keep your existing rules.
            await deleteAllRules(currentRules);
    
            // Add rules to the stream. Comment the line below if you don't want to add new rules.
            await setRules(req.query.keywords);
    
        } catch (e) {
            console.error(e);
            process.exit(1);
        }
    
        // Listen to the stream.
        streamConnect(0, req.query.number, res, req.query.keywords);
        
    })();
    console.log('done');
})

module.exports = router;