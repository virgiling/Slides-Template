// Marp CLI 4.5.1 has no server/watch host option. Restrict only this child process.
// Exports/builds do not load this file. Do not modify installed packages or user config.
const net = require('node:net');
const listen = net.Server.prototype.listen;
net.Server.prototype.listen = function (...args) {
  if (typeof args[0] === 'number') {
    const port = args.shift();
    const backlog = args.find(value => typeof value === 'number');
    const callback = args.find(value => typeof value === 'function');
    args = [{ port, host: '127.0.0.1', ...(backlog === undefined ? {} : { backlog }) }];
    if (callback) args.push(callback);
  } else if (args[0] && typeof args[0] === 'object' && 'port' in args[0]) {
    args[0] = { ...args[0], host: '127.0.0.1' };
  }
  return listen.apply(this, args);
};
