
'use strict'

const fs = require('fs');
const natural = require('natural');
const basePath = './server/classifier/';

function identify(data){
    var res;
    //console.log(data);   
    return new Promise((resolve,reject)=>{
        
        //Load Classifier
        if (fs.existsSync(basePath+'classifier.json')){
            natural.BayesClassifier.load(basePath+'classifier.json', null, function(err, classifier) {
                if(err){
                    console.log(err);
                }else{
                    res = classifier.classify(data);               
                    if (res != undefined)resolve(res);
                    else reject(); 
                }                              
            });
        }
       
        //Create and Save Classifier
        else{
            const classifier = new natural.BayesClassifier();
            
            //Training data for negative case
            classifier.addDocument(['my unit-tests failed.',
                                    'everything is going wrong', 'why do bad things keep happening',          
                                    'this is not good', 'this is awful'], 'negative')
            
            //Training data for positive case
            classifier.addDocument(['what a great day.','i love this band',
                                    'what a beautiful sunset', 'how good is this'], 'positive')

            classifier.train()          
            
            //Save Classifier in JSON
            classifier.save(basePath + 'classifier.json', function (err, classifier) {
                if (err) {
                console.log(err);
                }else{
                    let res = classifier.classify(data); 
                    if (res != undefined)resolve(res); 
                    else reject();                      
                } 
            });             
                        
        }  
    });
}

module.exports = {identify};


/*function to be added to twitter handling
const nltk = require('../classifier/natural.js');

async function fnAsync(data) {
    let response = await nltk.identify(data);
    //return response;
    //if( response)    
    console.log(response); // "Promise resolved"
    //Process result
    
  }
//Replace sample text with tweet
fnAsync('i hate this');  
*/
