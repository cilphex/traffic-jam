var crypto = require('crypto');
var async = require('async');
var Config = require('./configuration');

function Limit(action, value, max, period) {
  if (!(this instanceof Limit)) {
    return new Limit(action, value, max, period);
  }

  if (!action) throw new Error('action is required');
  if (!value) throw new Error('value is required');
  if (max === null || max === undefined) throw new Error('max is required');
  if (!period) throw new Error('period is required');

  this.action = action;
  this.value = value;
  this.max = max;
  this.period = period;

  this.config = Config;
  this.redis = this.config.redis;
  this.key = this.key_from_value();
};

Limit.prototype.key_from_value = function() {
  var hash = crypto.createHash('md5')
    .update(this.value)
    .digest('base64');
  hash = hash.slice(0, this.config.hash_length);
  hash = [this.config.key_prefix, this.action, hash].join(':');
  return hash;
};

Limit.prototype.would_exceed = function(amount, cb) {
  var self = this;

  this.used(function(err, used) {
    if (err) {
      return cb(err);
    }
    var would_exceed = (used + amount) > self.max;
    cb(null, would_exceed);
  });
};

Limit.prototype.limit_exceeded = function(amount, cb) {
  var self = this;

  this.would_exceed(amount, function(err, would_exceed) {
    if (err) {
      return cb(err);
    }
    if (would_exceed) {
      return cb(null, self);
    }
    cb(null, null);
  });
};

Limit.prototype.increment = function(amount, time, cb) {
  if (amount === undefined || amount === null) {
    amount = 1;
  }

  if (this.max === 0) {
    return cb(null, (amount <= 0));
  }

  if (amount != parseInt(amount)) {
    var err = new Error('amount must be an integer');
    return cb(err);
  }

  var self = this;
  var timestamp = parseInt(time || 0) || (new Date()).getTime();
  var new_amount;
  var new_timestamp;

  this.redis.hget(this.key, 'timestamp', old_timestamp_found);

  function old_timestamp_found(err, old_timestamp) {
    if (err) {
      return cb(err);
    }

    old_timestamp = parseInt(old_timestamp);

    if (!old_timestamp) {
      new_amount = amount;
      new_timestamp = timestamp;
      return check_amount();
    }

    // var time_diff = Math.round((timestamp - old_timestamp) / 1000);
    var time_diff = timestamp - old_timestamp;
    var drift_amount = time_diff * self.max / self.period;

    if (time_diff < 0) {
      var incr_amount;
      var incr_magnitude;
      if (amount < 0) {
        incr_amount = amount - drift_amount;
        incr_magnitude = -incr_amount;
      }
      else {
        incr_amount = amount + drift_amount;
        incr_magnitude = incr_amount;
      }
      if (incr_magnitude <= 0) {
        return cb(null, true);
      }
      self.redis.hget(self.key, 'amount', function(err, old_amount) {
        if (err) {
          return cb(err);
        }
        old_amount = parseFloat(old_amount || 0);
        old_amount = Math.min(old_amount, self.max);
        new_amount = old_amount + incr_amount;
        new_timestamp = old_timestamp;
        check_amount();
      });
    }
    else {
      self.redis.hget(self.key, 'amount', function(err, old_amount) {
        if (err) {
          return cb(err);
        }
        old_amount = parseFloat(old_amount || 0);
        old_amount = Math.min(old_amount, self.max);
        var current_amount = Math.max(old_amount - drift_amount, 0);
        new_amount = current_amount + amount;
        new_timestamp = timestamp;
        check_amount();
      });
    }
  }

  function check_amount() {
    if (new_amount > self.max) {
      return cb(null, false);
    }

    async.parallel({
      set_amount: function(done) {
        self.redis.hset(self.key, 'amount', new_amount, done);
      },
      set_timestamp: function(done) {
        self.redis.hset(self.key, 'timestamp', new_timestamp, done);
      },
      set_expire: function(done) {
        self.redis.expire(self.key, self.period, done);
      }
    }, function(err, results) {
      if (err) {
        return cb(err);
      }
      cb(null, true);
    });
  }
};

Limit.prototype.increment_or_raise = function(amount, time, cb) {
  this.increment(amount, time, function(err, success) {
    if (err) {
      return cb(err);
    }
    if (!success) {
      var err = new Error('limit exceeded');
      return cb(err);
    }
    cb(null, success);
  });
};

Limit.prototype.decrement = function(amount, time, cb) {
  this.increment(-amount, time, cb);
};

Limit.prototype.reset = function(cb) {
  this.redis.del(this.key, key_deleted);

  function key_deleted(err) {
    if (err) {
      return cb(err);
    }
    cb(null);
  }
};

Limit.prototype.used = function(cb) {
  var self = this;

  if (this.max === 0) {
    return cb(null, 0);
  }

  this.redis.hgetall(this.key, value_found);

  function value_found(err, obj) {
    if (err) {
      return cb(err);
    }

    obj = obj || {};
    var timestamp = parseInt(obj.timestamp);
    var amount = parseFloat(obj.amount);

    if (timestamp && amount) {
      var now = (new Date()).getTime();
      var time_passed = Math.round((now - timestamp) / 1000);
      var drift = self.max * time_passed / self.period;
      var last_amount = Math.min(amount, self.max);

      // TODO (craig): Fix these variable names
      var xxx = Math.ceil(last_amount - drift);
      var yyy = Math.max(xxx, 0);
      cb(null, yyy);
    }
    else {
      cb(null, 0);
    }
  }
};

Limit.prototype.remaining = function() {
  return this.max() - this.used();
};

Limit.prototype.flatten = function() {
  return [this];
};

module.exports = Limit;
