var redis_client = require('redis').createClient();

// Config defaults
var key_prefix = 'tj';
var hash_length = 12;

// Empty limits
var limits = {};

function register(action, max, period) {
  limits[action] = {
    max: max,
    period: period
  };
}

function max(action) {
  return limits(action).max;
}

function period(action) {
  return limits(action).period;
}

function limits(action) {
  var limits = limits[action];
  if (!limits) {
    var err = new Error('Limit not found');
    err.action = action;
    throw err;
  }
  return limits;
}

module.exports = {
  register:    register,
  max:         max,
  period:      period,
  limits:      limits,
  redis:       redis_client,
  key_prefix:  key_prefix,
  hash_length: hash_length
};
