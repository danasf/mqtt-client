var net = require('net'), emitter = require('events').EventEmitter, util = require('util');

// helpers

/* 
   funky variable length encoding scheme from
   http://docs.oasis-open.org/mqtt/mqtt/v3.1.1/os/mqtt-v3.1.1-os.html#_Toc304802782
*/
var encodeMQTTRemainder = function(number) {
  var off = 0;
  var buf = [];
  var encoded = 0;
  do {
    encoded = number % 128 | 0;
    number = number / 128 | 0;
    if (number > 0) {
      encoded = encoded | 128;
    }
    buf[off++] = encoded;

  } while (number > 0);

  return buf;
};

var decodeMQTTRemainder = function(data) {
  var multiplier = 1;
  var value = 0, encoded = 0, i =0;
  do {
    encoded = data[i++];
    value += (encoded & 127) * multiplier;
    multiplier *= 128;
    if(multiplier > Math.pow(128,3)) {
      throw "malformed remaining length"
    }
  } while ((encoded & 128) != 0);
  return value;
};

/* topic length and contents to buffer */
var topicToBytes = function(buf,off,topic) {
  var i=off;
  // length 
  buf[i++] = topic.length >> 8;
  buf[i++] = topic.length & 0xFF;

  // content
  for (var n = 0; n < topic.length; n++) {
    buf[i++] = topic.charCodeAt(n);
  }
  return i;
};

/*  
   MQTTCLIENT
*/
function MQTTClient(host, port, ident) {

  var self = this;

  /* 
    the 14 control packet types,
    shifted left 4, first four bits of first packet are reserved 
  */
  this.types = {
    connect: 1 << 4,
    connack: 2 << 4,
    publish: 3 << 4,
    puback: 4 << 4,
    pubrec: 5 << 4,
    pubrel: 6 << 4,
    pubcomp:7 << 4,
    subscribe: 8 << 4,
    subsack: 9 << 4,
    unsubscribe: 10 << 4,
    unsuback: 11 << 4,    
    pingreq: 12 << 4,
    pingres: 13 << 4,    
    disconnect: 14 << 4
  };

  this.host = host || 'iot.mosquitto.org';
  this.port = port || 1883;
  this.id = ident || 'myMQTT-' + Math.floor(Math.random() * 100);
  this.protocol = "MQIsdp";
  this.version = 3;

  this.sock = net.createConnection(this.port, this.host);

  this.sock.setEncoding('utf-8');

  this.keepalive = 15;
  this.connected = false;
  this.debug = true;

  this.sock.on("data", function(data) {
    var incoming = new Buffer(data);
    self.parseResponse(incoming);
  });

  this.timeout = setInterval(function() { 
    this.ping();
  },this.keepalive*1000);

};

/* 
 connect
*/

MQTTClient.prototype.connect = function(cb) {
  this.pulse.apply(this); // reset keepalive

  var i = 0;
  var buf = new Buffer(16 + this.id.length);
  // fixed header
  buf[i++] = this.types.connect; // connect
  buf[i++] = 8 + this.protocol.length + this.id.length; // length of header

  // variable header
  buf[i++] = this.protocol.length >> 8; // protocol name len MSB
  buf[i++] = this.protocol.length & 0xFF; // protocol name len LSB, 6

  for (var n = 0; n < this.protocol.length; n++) {
    buf[i++] = this.protocol.charCodeAt(n);
  }

  buf[i++] = this.version; // version
  buf[i++] = 0x02 // flags, 'new session'

  // keep alive
  buf[i++] = this.keepalive >> 8 // keep alive MSB
  buf[i++] = this.keepalive & 0xFF; // keep alive LSB


  buf[i++] = 0x00; 
  buf[i++] = this.id.length & 0xFF; // length of identifier

  // identifier
  for (var n = 0; n < this.id.length; n++) {
    buf[16 + n] = this.id.charCodeAt(n);
  }

  if (this.debug) {
    console.log(buf);
  }

  this.sock.write(buf);
  this.connected = true;
  cb() || null;
};

/* disconnect from server */
MQTTClient.prototype.disconnect = function() {
  var buf = new Buffer(2);
  buf[0] = this.types.disconnect;
  buf[1] = 0x00;
  if(this.debug) {
    console.log("disconnect");
  }
  this.sock.write(buf);
  this.connected = false;
};

/* ping pong */

MQTTClient.prototype.ping = function() {
  var buf = new Buffer(2);
  buf[0] = this.types.pingreq;
  buf[1] = 0x00;
  if(this.debug) {
    console.log("PING");
  }
  this.sock.write(buf,"utf-8");
};

/* keep things alive, reset interval */
MQTTClient.prototype.pulse = function() {
  var self = this;
  clearInterval(this.timeout);
  this.timeout = setInterval(function() { 
    self.ping();
  },this.keepalive*1000);
};

/* publish a message for a given topic */
MQTTClient.prototype.publish = function(topic, payload, cb) {
  this.pulse.apply(this); // reset keepalive

  // returns variable header 
  var _genVarHeader = function(topic) {
    var i = 0;
    var head = new Buffer(topic.length + 3);
    i = topicToBytes(head,i,topic);
    head[i++] = 10;
    return head;
  };

  // generates payload
  var _genPayload = function(payload) {

    var data = new Buffer(payload.length);

    for (var n = 0; n < payload.length; n++) {
      data[n] = payload.charCodeAt(n);
    }
    return data;
  };

  if (this.connected) {

    // generate the variable header
    var varHead = _genVarHeader(topic);
    var len = payload.length + varHead.length;  // get len of payload + topic

    // use funny MQTT encoding append publish
    var front = encodeMQTTRemainder(len);
    front.unshift(this.types.publish); 
    var fixedHead = new Buffer(front);

    var payLoad = _genPayload(payload); // payload

    // concat fixed header, var head, payload
    var buf = Buffer.concat([fixedHead, varHead, payLoad]);

    if (this.debug) {
      console.log("len: %s scheme: %s", len, front);
      console.log(buf, buf.length);
    }

    this.sock.write(buf,"utf-8");

    cb = cb | null;
  } else {
    throw "not connected";
  }
};

/* unsubscribe for a given topic */
MQTTClient.prototype.subscribe = function(topic) {
  this.pulse.apply(this); // reset keepalive

  var i = 0;
  var buf = new Buffer(topic.length + 7);

  // fixed header
  buf[i++] = this.types.subscribe;              // subscribe
  buf[i++] = topic.length + 5;  // topic len + var head

  // variable header
  buf[i++] = 0x00;
  buf[i++] = 0x0A; // message id

  i = topicToBytes(buf,i,topic);

  buf[i++] = 0x00;

  if (this.debug) {
    console.log(buf);
  }

  this.sock.write(buf);

};

/* unsubscribe from a given topic */
MQTTClient.prototype.unsubscribe = function(topic) {
  this.pulse.apply(this); // reset keepalive

  var i = 0;
  var buf = new Buffer(topic.length + 7);

  // fixed header
  buf[i++] = this.types.unsubscribe;         
  buf[i++] = topic.length + 2;  // topic len + var head

  // variable header, packet identifier
  buf[i++] = 0;
  buf[i++] = 0;

  // add topic to packet, return offset 
  i = topicToBytes(buf,i,topic);

  this.sock.write(buf);

};

MQTTClient.prototype.parseResponse = function(buf) {
  // is simple publish
  var self = this;
  var code = buf[0];
  var key = Object.keys(self.types).filter(function(key) {return self.types[key] === code})[0];
  console.log("RESPONSE TYPE, %s",key);
  console.log("Incoming buffer:",buf);
  console.log("Rendered:",buf.toString());

};

module.exports = MQTTClient;
