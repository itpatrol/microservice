/**
 * Process Test task.
 */
'use strict';

const MongoClient = require('mongodb').MongoClient;
const ObjectID = require('mongodb').ObjectID;
const debugF = require('debug');
const fs = require('fs');

/**
 * Constructor.
 *   Prepare data for test.
 */
function SearchClass(options, data, requestDetails) {
  // Use a closure to preserve `this`
  var self = this;
  self.mongoUrl = options.mongoUrl;
  self.mongoTable = options.mongoTable;
  self.fileDir = options.fileDir;

  self.data = data;
  self.requestDetails = requestDetails;
}

SearchClass.prototype.data = {};
SearchClass.prototype.requestDetails = {};
SearchClass.prototype.fileDir = '';
SearchClass.prototype.mongoUrl = '';
SearchClass.prototype.mongoTable = '';

SearchClass.prototype.debug = {
  debug: debugF('microservice:debug')
};

SearchClass.prototype.process = function(callback) {
  var self = this;

  var fileProperty = false;
  if (process.env.FILE_PROPERTY) {
    fileProperty = process.env.FILE_PROPERTY;
  }

  MongoClient.connect(self.mongoUrl, function(err, db) {
    if (err) {
      self.debug.debug('MongoClient:connect err: %O', err);
      return callback(err, null);
    }

    var collection = db.collection(self.mongoTable);
    var query = self.data;

    if (self.data.query) {
      query = self.data.query;
    }

    // If auth_scope active, apply filter to search.
    if (self.requestDetails.auth_scope) {
      for (var i in self.requestDetails.auth_scope) {
        query[i] = self.requestDetails.auth_scope[i];
      }
    }

    // If search by ID, make sure that we convert it to object first.
    if (query['_id']) {
      query['_id'] = new ObjectID(query['_id']);
    }

    if (query['id']) {
      query['_id'] = new ObjectID(query['id']);
      delete query['id'];
    }
    var cursor;
    if (self.data.fields) {
      cursor = collection.find(query, self.data.fields);
    } else {
      cursor = collection.find(query);
    }
    cursor.count(function(err, count) {
      if (err) {
        db.close();
        self.debug.debug('MongoClient:count err: %O', err);
        return callback(err, null);
      }

      if (self.data.sort) {
        cursor = cursor.sort(self.data.sort);
      }

      if (self.data.limit) {
        cursor = cursor.limit(self.data.limit);
      }
      if (self.data.skip) {
        cursor = cursor.skip(self.data.skip);
      }

      cursor.toArray(function(err, results) {
        db.close();
        if (err) {
          self.debug.debug('MongoClient:toArray err: %O', err);
          return callback(err, results);
        }
        if (!results || results.length == 0) {
          self.debug.debug('MongoClient:toArray object not found.');
          return callback(null, {
            code: 404,
            answer: {
              message: 'Not found'
            }
          });
        }
        if (self.data[fileProperty] == true) {
          if (self.fileDir && self.fileDir != '') {
            var filePath = '';

            for (var i in results) {
              if (results[i]._id) {
                if (self.fileDir && self.fileDir != '' && fileProperty) {
                  filePath = self.fileDir + '/' + results[i]._id;
                  if (fs.existsSync(filePath)) {
                    try {
                      if (process.env.FILE_PROPERTY_JSON) {
                        results[i][fileProperty] = JSON.parse(fs.readFileSync(filePath));
                      } else {
                        results[i][fileProperty] = fs.readFileSync(filePath).toString();
                      }
                    } catch(e) {
                      if (process.env.FILE_PROPERTY_JSON) {
                        results[i][fileProperty] = {};
                      } else {
                        results[i][fileProperty] = '';
                      }
                    }
                  }
                }
              }
            }
          }
        }
        results.forEach(function(element) {
          element.id = element._id;
          delete(element._id);
          if (self.requestDetails.auth_scope) {
            delete(element.token);
          }
        });
        return callback(null, {
          code: 200,
          answer: results,
          headers: {'x-total-count': count}
        });
      });
    });
  });
  return;
};

module.exports = SearchClass;