var reconnect= require('./reconnect-tcp')
var util = require('util')

function Client(options) {

  var queue = {}, client, re, id

  var defaults = {
    host: '127.0.0.1',
    port: 2003,
    family: '4',
    prefix: '',
    suffix: '',
    verbose: false,
    interval: 5000,
    callback: null
  }

  function init() {
    options = util._extend(defaults, options)

    createClient()

    id = setInterval(send, options.interval)

    return {
      add: add,
      put: put,
      close: close,
      options: options
    }
  }

  function createClient() {
    re = reconnect({}, function(reconnecClient){
      client = reconnecClient;
    })
    .on('connect', function(){
      log('TCP socket connected to ' + options.host)
    })
    .on('reconnect', function(n, delay){
      log('Reconnecting to ' + options.host + ' for the '+n+'th time with a delay of ' + delay + 'ms')
    })
    .on('disconnect', function() {
      log('TCP socket disconnected from ' + options.host)
    })
    .on('error', function(err) {
      log('TCP socket error: '+ err)
    })
    .connect(options);

    log('Creating new Graphite TCP client to ' + options.host)
  }

  function close() {
    re.disconnect()
    clearInterval(id)
  }

  function put(name, value, ts) {
	if(typeof ts == "string" && ts.length == 10)
      return add(name, value, true, ts)

    add(name, value, true)
  }

  function add(name, value, replace, ts) {
    if(typeof ts != "string" || ts.length != 10)
      ts = undefined

    var keyname = name

    if(!name || isNaN(parseFloat(value)) || value === Infinity)
      return log('Skipping invalid name/value: '+ name +' '+ value)

    if(options.prefix)
      name = options.prefix +'.'+ name

    if(options.suffix)
      name = name +'.'+ options.suffix

    var keyname = (typeof ts == "undefined") ? name : (name + ts)

    if(queue[keyname] === undefined || replace)
      queue[keyname] = { value: value }
    else
      queue[keyname].value += value

    queue[keyname].key = keyname

    queue[keyname].timestamp = (typeof ts == "undefined") ? String(Date.now()).substr(0, 10) : ts

    log('Adding metric to queue: '+ name +' '+ value)
  }

  function getQueue() {
    var text = ''

    for(var name in queue) {
      text += name +' '+ queue[name].value +' '+ queue[name].timestamp +'\n'
    }

    return text
  }

  function send() {
    if(Object.keys(queue).length === 0)
      return //log('Queue is empty. Nothing to send')

    if (!re.connected) {
      return//socket is not connected, skip this interval
    }
    var metrics = new Buffer(getQueue())

    log('Sending '+ Object.keys(queue).length +' metrics to '
      + options.host +':'+ options.port)

    client.write(metrics,
      function(err) {
      if(err)
        return log('Error sending metrics: '+ err)

      log('Metrics sent:'+ metrics.toString().replace(/^|\n/g, '\n\t'))

      if(options.callback)
        options.callback(err, metrics.toString())
    })

    queue = {}
  }

  function log(line) {
    if(options.verbose)
      console.log('[graphite-tcp]', line)
  }

  return init()
}

module.exports = {
  createClient: function(options) {
    return new Client(options)
  }
}
