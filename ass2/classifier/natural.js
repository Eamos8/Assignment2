
'use strict'

const fs = require('fs');
const natural = require('natural');
const csv = require('fast-csv');
const basePath = './server/classifier/';
const classifier = new natural.BayesClassifier();
const data = []
function train(){
    return new Promise((resolve,reject)=>{
        fs.createReadStream(basePath+'/trainingdata.csv')
        .pipe(csv.parse({ headers: true }))
        .on('error', error => console.error(error))
        .on('data', row => {
            data.push(row)
            classifier.addDocument(row.Tweet,row.Response);
        })
        .on('end', () => {
            classifier.train()
            resolve()        
        });
    }).catch()
}

function identify(data){
    var res;   
    return new Promise((resolve,reject)=>{
        res = classifier.getClassifications(data)        
        if (res != undefined)resolve(res);
        else reject(); 
       
    });
}

module.exports = {train,identify};