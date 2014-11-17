MQTT Client
=================

[MQTT](http://mqtt.org/) (Message Queuing Telemetry Transport Protocol), is a light-weight publish/subscribe based protocol for connected devices.

There are a number of excellent Node-based implementations of MQTT available, I recommend using these for your production cases, I created this project primarily as an educational tool, to aid my understanding and basic exploration of the protocol. 

## Usage

run `node index.js`, by default the client will connect and publish to a public / test MQTT broker, `test.mosquitto.org`

Currently supported functionality includes:

* connect
* disconnect
* subscribe
* unsubscribe
* publish
* ping (keep alive)
* very basic response identification / handling

To Do:

* Full response handling 
* QOS
* TLS & Authentication support

You can run your own MQTT broker with a server like [mosquitto](http://mosquitto.org/) or [mosca](https://github.com/mcollina/mosca).

If you have mosquitto installed (`apt-get install mosquitto` or `brew install mosquitto`, etc), you may find their command line tools helpful for testing.

Here's a subscribe example:
	
	mosquitto_sub -h test.mosquitto.org -t "random/"

You can publish like this:

	mosquitto_pub -h test.mosquitto.org -t "random/" -m "hello, world"
 
## License

MIT
