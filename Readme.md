MQTT Client
=================

[MQTT](http://mqtt.org/) (Message Queuing Telemetry Transport Protocol), is a light-weight publish/subscribe based protocol for connected devices.

There are a number of excellent Node-based implementations of MQTT available, I created this project to aid my understanding and exploration of the MQTT protocol. 

## Usage

run `node index.js`, by default the client will connect and publish to a public / test MQTT broker, `test.mosquitto.org`

Currently supported methods are:

* connect
* subscribe
* publish

You can run your own MQTT broker with a server like [mosquitto](http://mosquitto.org/) or [mosca](https://github.com/mcollina/mosca).

If you have mosquitto installed (`apt-get install mosquitto` or `brew install mosquitto`, etc), you may find their command line tools helpful for testing.

Here's a subscribe example:
	
	mosquitto_sub -h test.mosquitto.org -t "random/"

You can also publish like this:

	mosquitto_pub -h test.mosquitto.org -t "random/" -m "hello, world"
 
## License

MIT
