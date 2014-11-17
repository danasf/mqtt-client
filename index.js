var MQTTClient = require('./lib/mqtt-client');

/*  silly sample data */
var sampleJSON = {
  temperature: 74,
  humidity: 45,
  co: 210,
  status: "stable",
  lat: 72.02321,
  lon: -123.0213,
  random: Math.floor(Math.random() * 100),
  what: "The quick brown fox jumps over the lazy dog",
  another: "point",
  yet_another: "point",
  greeting:"おはよう"
};

/* instantiate */

var client = new MQTTClient("test.mosquitto.org");

client.connect(function() {

  // subscribe to random
  client.subscribe('random/');

  // publish a message 
  var sample = JSON.stringify(sampleJSON);
  client.publish("random/", sample);

});