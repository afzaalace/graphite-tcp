var tcp = require('net');
var inject = require('reconnect-core');

module.exports = inject(function(){
   return tcp.connect.apply(null, arguments);
});
