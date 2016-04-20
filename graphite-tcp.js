var net= require('net')
var util = require('util')

function Client(options) {

  var queue = {}, client, id

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
    client = net.createConnection(options)

    client.on('close', function() {
      log('TCP socket closed')
    })

    client.on('error', function(err) {
      log('TCP socket error: '+ err)
    })

    log('Creating new Graphite TCP client')
  }

  function close() {
    client.close()
    clearInterval(id)
  }

  function put(name, value) {
    add(name, value, true)
  }

  function add(name, value, replace) {
    if(!name || isNaN(parseFloat(value)) || value === Infinity)
      return log('Skipping invalid name/value: '+ name +' '+ value)

    if(options.prefix)
      name = options.prefix +'.'+ name

    if(options.suffix)
      name = name +'.'+ options.suffix

    if(queue[name] === undefined || replace)
      queue[name] = { value: value }
    else
      queue[name].value += value

    queue[name].timestamp = String(Date.now()).substr(0, 10)

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
      console.log('[graphite-tco]', line)
  }

  return init()
}

module.exports = {
  createClient: function(options) {
    return new Client(options)
  }
}
