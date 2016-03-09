var _ = require('underscore');
var async = require('async');

function LimitGroup(limits) {
  if (!(this instanceof LimitGroup)) {
    return new LimitGroup(limits);
  }

  self.limits = _.flatten(limits || []);
};

LimitGroup.prototype.push = function(limit) {
  return self.limits.push(limit);
};

LimitGroup.prototype.increment = function(amount, time, cb) {
  async.parallel(self.limits.map(function(limit) {
    return function(cb) {
      limit.increment(amount, time, function(err, success) {

      });
    }
  }),
  function(err, results) {

  });
};

LimitGroup.prototype.increment_or_raise = function(amount, time) {

};

LimitGroup.prototype.decrement = function(amount, time) {

};

LimitGroup.prototype.would_exceed = function(amount) {

};

LimitGroup.prototype.limit_exceeded = function(amount) {

};

LimitGroup.prototype.reset = function() {

};

LimitGroup.prototype.remaining = function() {

};

LimitGroup.prototype.flatten = function() {

};

module.exports = LimitGroup;
