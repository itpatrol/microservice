/**
 * Process Test task.
 */
"use strict";

const MongoClient = require('mongodb').MongoClient;
const ObjectID = require('mongodb').ObjectID;
const debugF = require( "debug" );
const fs = require('fs');

require('dotenv').config();
const bind = function( fn, me ) { return function() { return fn.apply( me, arguments ); }; };

/**
 * Constructor.
 *   Prepare data for test.
 */
function LogGet( data, requestDetails ) {
  // Use a closure to preserve `this`
  var self = this;
  self.mongo_url = process.env.MONGO_URL
  this.status = bind( this.status, this );
  // Save original data
  this.data = data;
  this.requestDetails = requestDetails;
}

LogGet.prototype.data = {};
LogGet.prototype.requestDetails = {};
LogGet.prototype.fileDir = "";
LogGet.prototype.mongo_url = "";


LogGet.prototype.debug = {
  main: debugF( "status:main" ),
};

LogGet.prototype.status = function(callback) {
  var self = this;

  if(self.requestDetails.url.length != 24) {
    callback(null, {
      code: 403,
      answer: {
        message: 'Wrong request',
      }
    });
    return;
  }

  MongoClient.connect(self.mongo_url, function(err, db) {
    if(! err) {
      var collection = db.collection('tasks');
      var query = {
        _id: new ObjectID(self.requestDetails.url)
      };
      collection.findOne(query, function(err, result) {
        db.close();
        if(!err) {
          if(!result) {
            callback(null, {
              code: 404,
              answer: {
                message: 'Not found',
              }
            });
          } else {
            self.fileDir = process.env.FILE_DIR + '/' + result.owner + '/' + result.repository;
            result.log = JSON.parse(fs.readFileSync( self.fileDir + '/' + self.requestDetails.url ));
            callback(null, {
              code: 200,
              answer: result
            });
          }
        } else {
          callback(err, null);
        }
      });

    } else {
      callback(err, null);
    }
  });
  return;
}

module.exports = LogGet;
