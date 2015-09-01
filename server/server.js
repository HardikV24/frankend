var express = require('express');
var Firebase = require("firebase");
var fs = require("fs");

var app = express();

// Manages Firebase app info.
var FB = JSON.parse(fs.readFileSync("fb.json", "utf8"));

var myFirebaseRef = new Firebase(FB.link + "/docData/docs");
var data = [];

myFirebaseRef.once("value", function(snapshot) {
  data = snapshot.val();
}, function (err) {
  console.log("READ FAILED: " + err.code);
});

myFirebaseRef.on("child_changed", function(snapshot) {
  data[snapshot.key()] = snapshot.val();
}, function (err) {
  console.log("READ FAILED: " + err.code);
});

// Entity object (well, really an array) indices.
var ID_IND = 0;
var TYPE_IND = 1;
var CHAR_OFFSETS_IND = 2;
var START_OFFSET_IND = 0;
var END_OFFSET_IND = 1;

// Get the type of the entity (i.e. tag type).
var getType = function (entity) { return entity[TYPE_IND]; };
var setType = function (entity, type) { entity[TYPE_IND] = type; };
// Get starting character offset for the entity.
var getStartOffset = function (entity) { return entity[CHAR_OFFSETS_IND][0][START_OFFSET_IND]; };
// Get ending character offset for the entity.
var getEndOffset = function (entity) { return entity[CHAR_OFFSETS_IND][0][END_OFFSET_IND]; };

// Checks equality between two entities.s
var entityEquals = function(entity1, entity2) {
  return (entity1[ID_IND] == entity2[ID_IND] &&
    getType(entity1) == getType(entity2) &&
    getStartOffset(entity1) == getStartOffset(entity2) &&
    getEndOffset(entity1) == getEndOffset(entity2));
};

app.get('/docs', function(req, res){
  res.header("Access-Control-Allow-Origin", "*");
  
  var docNameIndexData = [];
  for (var i = 0; i < data.length; i++)
    docNameIndexData.push({name: data[i].name, index: i});
  
  res.json(docNameIndexData);
});

app.get('/show', function(req, res){
  res.header("Access-Control-Allow-Origin", "*");
  
  var tag = req.query.character;
  var WINDOW_LENGTH = 200;
  
  console.log("Show: " + tag);
  
  var showItems = [];
  data.forEach(function(doc) {
      // Entities with the same type, sorted in ascending order of character offsets.
      var sameTypeEntities = doc.entities.filter(function (e) { return getType(e) == tag; }).sort(function (e1, e2) {
        return getStartOffset(e1) - getStartOffset(e2);
      });
      
      sameTypeEntities.forEach(function (e) {
        var startOffset = getStartOffset(e);
        var endOffset = getEndOffset(e);
        showItems.push({
          docName: doc.name,
          entity: e,
          span: doc.text.substring(startOffset, endOffset),
          pretext: doc.text.substring((startOffset - WINDOW_LENGTH < 0) ? 0 : startOffset - WINDOW_LENGTH, startOffset).trim(),
          posttext: doc.text.substring(endOffset + 1, 
            (endOffset + WINDOW_LENGTH > doc.text.length) ? doc.text.length : endOffset + WINDOW_LENGTH).trim()
        });
      });
  });
  
  res.json(showItems);
});

app.get('/replace', function(req, res) {
  res.header("Access-Control-Allow-Origin", "*");

  var oldType = req.query.old_type;
  var replacementType = req.query.replacement_type;

  console.log("Delete: " + oldType + ", Replace: " + replacementType);

  var removeEntity = function(entities, entity) {
    return entities.filter(function(e) {
      return !entityEquals(e, entity);
    });
  };

  var errs = [];

  for (var i = 0; i < data.length; i++) {
    var doc = data[i];
    var entitiesToRemove = [];

    var modified = false;
    doc.entities.forEach(function(entity) {
      if (entity[1] == oldType) {
        modified = true;
        if (doc.entities.filter(function(e) {
            return getStartOffset(entity) == getStartOffset(e) && getType(e) == replacementType;
          }).length == 0) {
          setType(entity, replacementType);
        }
        else
          entitiesToRemove.push(entity);
      }
    });

    entitiesToRemove.forEach(function(entity) {
      doc.entities = removeEntity(doc.entities, entity);
    });

    if (modified) {
      myFirebaseRef.child(i + "").set(doc, function(err) {
        if (err)
          errs.push(err);
      });
    }
  }

  if (errs.length > 0) {
    res.json({
      "result": "ERRORS: " + errs
    });
  } else {
    res.json({
      "result": "SUCCESS"
    });
  }
});

app.listen(process.env.PORT || 3000, process.env.IP || "0.0.0.0", function(){
  console.log("Frankend is alive!");
});
