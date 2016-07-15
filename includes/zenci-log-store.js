/**
 * Process Test task.
 */
"use strict";

require( "dotenv" ).config();
const MongoClient = require( "mongodb" ).MongoClient;
const debugF = require( "debug" );
const fs = require( "fs" );

const bind = function( fn, me ) { return function() { return fn.apply( me, arguments ); }; };

/**
 * Constructor.
 *   Prepare data for test.
 */
function Log( data ) {

  // Use a closure to preserve `this`
  var self = this;
  self.mongoUrl = process.env.MONGO_URL;
  self.mongoTable = process.env.MONGO_TABLE;
  this.status = bind( this.status, this );
  this.data = data;

  if ( !fs.existsSync( process.env.FILE_DIR + "/" + data.owner ) ) {
    fs.mkdirSync( process.env.FILE_DIR + "/" + data.owner );
  }

  if ( !fs.existsSync( process.env.FILE_DIR + "/" + data.owner + "/" + data.repository ) ) {
    fs.mkdirSync( process.env.FILE_DIR + "/" + data.owner + "/" + data.repository );
  }
  self.fileDir = process.env.FILE_DIR + "/" + data.owner + "/" + data.repository;
}

Log.prototype.data = {};
Log.prototype.fileDir = "";
Log.prototype.mongoUrl = "";
Log.prototype.mongoTable = "";

Log.prototype.debug = {
  main: debugF( "status:main" )
};

Log.prototype.status = function( callback ) {
  var self = this;

  var log = JSON.stringify( self.data.log );
  delete( self.data.log );

  MongoClient.connect( self.mongoUrl, function( err, db ) {
    if ( !err ) {
      var collection = db.collection( self.mongoTable );
      collection.insertOne( self.data, function( err, result ) {
        db.close();
        if ( !err ) {
          if ( log ) {
            fs.writeFile( self.fileDir + "/" + result.insertedId, log );
          }
          callback( null, {
            code: 200,
            answer: {
              message: "Task accepted",
              id: result.insertedId
            }
          } );
        } else {
          callback( err, null );
        }
      } );
    } else {
      callback( err, null );
    }
  } );
  return;
};

module.exports = Log;