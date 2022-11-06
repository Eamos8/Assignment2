const express = require('express');
const axios = require ('axios');
const router = express.Router();
const twit = require('twitter');
const needle = require('needle');

//Natural classifier
const nltk = require('../classifier/natural.js');

async function fnAsync(data) {
    await nltk.train();
    let response = await nltk.identify(data);
    //return response;
       
    console.log(response); // "Promise resolved"
    //Process result
    
  }
//Replace sample text with tweet comment out after it is placed in the 
fnAsync('i hate this');  



const token = 'AAAAAAAAAAAAAAAAAAAAAPEZYAEAAAAAfbbH%2FnxqP8iTOBREdlME2bV1dfQ%3D8ihqrVT7NIUsY9JY0ERG0wrQPZt3s2CLcsN5cQGe1rdaYIlCyM';

const rulesURL = 'https://api.twitter.com/2/tweets/search/stream/rules';
const streamURL = 'https://api.twitter.com/2/tweets/search/stream';

//router.post(rulesURL);

const twitter = new twit({
    consumer_key: 'c0RmeJtl4Ic1Qd7vpMCZza4G8',
    consumer_secret: 'qKzIJsGONfMdkF09OinA1QsR7CYU9iAdKEcyNz22yFo7JvSkm9',
    access_token: '2918602867-Ld44xCzccpgsGWsIFTTx5PMhXZfzmhKiM2VbqsF',
    access_token_secret: 'Hgen71b1Mb9QNsD0ElB2h3flfpHTIWW8IqXRHkjQfOAef', 

})

//RULES START

// Edit rules as desired below | Value for rules should be retrieved for
const rules = [{
    'value': 'dog has:images -is:retweet',
    'tag': 'dog pictures'
},
{
    'value': 'cat has:images -grumpy',
    'tag': 'cat pictures'
},
];

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

async function setRules() {

const data = {
    "add": rules
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

function streamConnect(retryAttempt) {

const stream = needle.get(streamURL, {
    headers: {
        "User-Agent": "v2FilterStreamJS",
        "Authorization": `Bearer ${token}`
    },
    timeout: 20000
});

stream.on('data', data => {
    try {
        const json = JSON.parse(data);
        console.log(json.data.text);

        //HERE IS WHERE ASYNCFUNC IS CALLED
        //filter data into text and image
        //last term will always be image
        //fnAsync(json.text)
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
            await setRules();
    
        } catch (e) {
            console.error(e);
            process.exit(1);
        }
    
        // Listen to the stream.
        streamConnect(0);
    })();
})

module.exports = router;