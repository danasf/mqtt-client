var net = require('net');

// helpers

/* 
   funky variable length encoding scheme from
   http://docs.oasis-open.org/mqtt/mqtt/v3.1.1/os/mqtt-v3.1.1-os.html#_Toc398718015
*/
var encodeMQTTscheme = function(number) {
  var off = 1;
  var buf = [];
  buf.push(0x30);
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


/*  
   MQTTCLIENT
*/
function MQTTClient(host, port, ident) {

  var self = this;

  this.types = {
    connect: 0x10,
    publish: 0x30,
    subscribe: 0x80
  };

  this.host = host || 'test.mosquitto.org';
  this.port = port || 1883;
  this.id = ident || 'myMQTT-' + Math.floor(Math.random() * 100);
  this.protocol = "MQIsdp";
  this.version = 3;

  this.sock = net.createConnection(this.port, this.host);

  this.sock.setEncoding('utf-8');

  this.keepalive = 30;
  this.connected = false;
  this.debug = true;

  this.sock.on("data", function(data) {
    console.log("incoming data", data);
  });
};

/* 
 connect
*/

MQTTClient.prototype.connect = function(cb) {
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


  buf[i++] = 0x00; // reserved
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


MQTTClient.prototype.publish = function(topic, payload, cb) {

  console.log("Payload:", payload.length, payload);

  // returns variable header 
  var _genVarHeader = function(topic) {
    var i = 0;
    var head = new Buffer(topic.length + 3);

    head[i++] = topic.length >> 8;
    head[i++] = topic.length & 0xFF;
    for (var n = 0; n < topic.length; n++) {
      head[i++] = topic.charCodeAt(n);
    }
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

    var varHead = _genVarHeader(topic);
    var len = payload.length + varHead.length;
    var scheme = encodeMQTTscheme(len);
    var frontHead = new Buffer(scheme);

    var pay = _genPayload(payload);

    var buf = Buffer.concat([frontHead, varHead, pay]);

    if (this.debug) {
      console.log("len: %s scheme: %s", len, scheme);
      console.log(buf, buf.length);
    }

    this.sock.write(buf,"utf-8");

    cb = cb | null;
  } else {
    throw "not connected";
  }
};

MQTTClient.prototype.subscribe = function(topic) {
  var i = 0;
  var buf = new Buffer(topic.length + 7);

  // fixed header
  buf[i++] = 0x80;              // subscribe
  buf[i++] = topic.length + 5;  // topic len + var head

  // variable header
  buf[i++] = 0x00;
  buf[i++] = 0x0A; // message id

  // length 
  buf[i++] = topic.length >> 8;
  buf[i++] = topic.length & 0xFF;

  // content
  for (var n = 0; n < topic.length; n++) {
    buf[i++] = topic.charCodeAt(n);
  }

  buf[i++] = 0x00;

  if (this.debug) {
    console.log(buf);
  }

  this.sock.write(buf);

};

/*var options = {
  host: null,
  port: null,
  identifier: null,
  keepalive: 30
};*/

/* some sample data  */


module.exports = MQTTClient;
