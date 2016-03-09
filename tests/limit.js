var assert = require('assert');
var async = require('async');
var timekeeper = require('timekeeper');

var TrafficJam = require('../index');

describe('initialize', function() {
  it('should raise an argument error on missing action', function(done) {
    function new_limit() {
      new TrafficJam.Limit(null, 'user1', 3, 3600);
    }
    function expected_error(err) {
      if ((err instanceof Error) && /action is required/.test(err)) {
        return true;
      }
    }
    assert.throws(new_limit, expected_error, 'unexpected error');
    done();
  });

  it('should raise an argument error on missing value', function(done) {
    function new_limit() {
      new TrafficJam.Limit('test', null, 3, 3600);
    }
    function expected_error(err) {
      if ((err instanceof Error) && /value is required/.test(err)) {
        return true;
      }
    }
    assert.throws(new_limit, expected_error, 'unexpected error');
    done();
  });

  it('should raise an argument error on missing max', function(done) {
    function new_limit() {
      new TrafficJam.Limit('test', 'user1', null, 3600);
    }
    function expected_error(err) {
      if ((err instanceof Error) && /max is required/.test(err)) {
        return true;
      }
    }
    assert.throws(new_limit, expected_error, 'unexpected error');
    done();
  });

  it('should raise an argument error on missing period', function(done) {
    function new_limit() {
      new TrafficJam.Limit('test', 'user1', 3, null);
    }
    function expected_error(err) {
      if ((err instanceof Error) && /period is required/.test(err)) {
        return true;
      }
    }
    assert.throws(new_limit, expected_error, 'unexpected error');
    done();
  });
});

describe('increment', function() {
  var state = {};

  beforeEach('reset limit', function(done) {
    state.limit = new TrafficJam.Limit('test', 'user1', 3, 60 * 60);
    state.limit.reset(done);
    timekeeper.reset();
  });

  it('should be true when rate limit is not exceeded', function(done) {
    state.limit.increment(1, null, function(err, success) {
      assert.ifError(err);
      assert(success);
      done();
    });
  });

  it('should be false when raise limit is exceeded', function(done) {
    async.series({
      one: function(cb) {
        state.limit.increment(1, null, function(err, success) {
          assert.ifError(err);
          assert(success);
          cb(null);
        });
      },
      two: function(cb) {
        state.limit.increment(2, null, function(err, success) {
          assert.ifError(err);
          assert(success);
          cb(null);
        });
      },
      three: function(cb) {
        state.limit.increment(1, null, function(err, success) {
          assert.ifError(err);
          assert(!success);
          cb(null);
        });
      }
    }, function(err, results) {
      assert.ifError(err);
      done();
    });
  });

  it('should raise an argument error if given a float', function(done) {
    state.limit.increment(1.5, null, function(err, success) {
      assert(err);
      assert(err.message, 'amount must be an integer');
      done();
    });
  });

  it('should be a no-op when limit would be exceeded', function(done) {
    async.series({
      one: function(cb) {
        state.limit.increment(2, null, function(err, success) {
          assert.ifError(err);
          assert(success);
          cb(null);
        });
      },
      two: function(cb) {
        state.limit.increment(2, null, function(err, success) {
          assert.ifError(err);
          assert(!success);
          cb(null);
        });
      },
      three: function(cb) {
        state.limit.increment(1, null, function(err, success) {
          assert.ifError(err);
          assert(success);
          cb(null);
        });
      }
    }, function(err, results) {
      assert.ifError(err);
      done();
    });
  });

  it('should be true when sufficient time passes', function(done) {
    async.series({
      one: function(cb) {
        state.limit.increment(3, null, function(err, success) {
          assert.ifError(err);
          assert(success);
          cb(null);
        });
      },
      two: function(cb) {
        var now = (new Date()).getTime();
        var then = now + (state.limit.period / 2 * 1000);
        timekeeper.travel(then);
        cb(null);
      },
      three: function(cb) {
        state.limit.increment(1, null, function(err, success) {
          assert.ifError(err);
          assert(success);
          cb(null);
        });
      }
    }, function(err, results) {
      assert.ifError(err);
      done();
    });
  });

  // it('should only call eval once', function(done) {
  // });

  describe('when increment is processed for a past time', function() {
    it('should discount the past increment by the time drift', function(done) {
      var time = (new Date()).getTime();
      async.series({
        one: function(cb) {
          state.limit.increment(1, time, function(err, success) {
            assert.ifError(err);
            assert(success);
            cb(null);
          });
        },
        two: function(cb) {
          state.limit.increment(2, (time - state.limit.period / 3), function(err, success) {
            assert.ifError(err);
            assert(success);
            cb(null);
          });
        },
        three: function(cb) {
          state.limit.used(function(err, used) {
            assert.ifError(err);
            assert.equal(used, 2);
            cb();
          });
        }
      }, function(err, results) {
        assert.ifError(err);
        done();
      });
    });
  });

  describe('when decrement is processed for a past time', function() {
    it('should discount the past decrement by the time drift', function(done) {
      var time = (new Date()).getTime();
      async.series({
        one: function(cb) {
          state.limit.increment(2, (time - state.limit.period / 3), function(err, success) {
            assert.ifError(err);
            assert(success);
            cb(null);
          });
        },
        two: function(cb) {
          state.limit.increment(2, time, function(err, success) {
            assert.ifError(err);
            assert(success);
            cb(null);
          });
        },
        three: function(cb) {
          state.limit.used(function(err, used) {
            assert.ifError(err);
            assert.equal(used, 3);
            cb(null);
          });
        },
        four: function(cb) {
          state.limit.decrement(2, (time - state.limit.period / 3), function(err, success) {
            assert.ifError(err);
            assert(success);
            cb(null);
          });
        },
        five: function(cb) {
          state.limit.used(function(err, used) {
            assert.ifError(err);
            assert.equal(used, 2);
            cb(null);
          });
        }
      }, function(err, results) {
        assert.ifError(err);
        done();
      });
    });
  });

  describe('when max is zero', function() {
    var state = {};

    beforeEach('reset limit', function(done) {
      state.limit = new TrafficJam.Limit('test', 'user1', 0, 60 * 60);
      state.limit.reset(done);
      timekeeper.reset();
    });

    it('should be false for any positive amount', function(done) {
      state.limit.increment(null, null, function(err, success) {
        assert.ifError(err);
        assert(!success);
        done();
      });
    });
  });

  describe('when max is changed to a a lower amount', function() {
    it('should still expire after period', function(done) {
      async.series({
        one: function(cb) {
          state.limit = new TrafficJam.Limit('test', 'user1', 4, 60);
          state.limit.increment_or_raise(4, null, function(err, success) {
            assert.ifError(err);
            assert(success);
            cb(null);
          });
        },
        two: function(cb) {
          state.limit = new TrafficJam.Limit('test', 'user1', 2, 60);
          state.limit.increment_or_raise(0, null, function(err, success) {
            assert.ifError(err);
            assert(success);
            cb(null);
          });
        },
        three: function(cb) {
          var now = (new Date()).getTime();
          var then = now + (state.limit.period * 1000);
          timekeeper.travel(then);
          state.limit.used(function(err, used) {
            assert.ifError(err);
            assert.equal(used, 0);
            cb(null);
          });
        }
      }, function(err, results) {
        assert.ifError(err);
        done();
      });
    });
  });
});

describe('increment_or_raise', function() {
  var state = {};

  beforeEach('reset limit', function(done) {
    state.limit = new TrafficJam.Limit('test', 'user1', 3, 60 * 60);
    state.limit.reset(done);
    timekeeper.reset();
  });

  it('should not raise error when rate limit is not exceeded', function(done) {
    state.limit.increment_or_raise(1, null, function(err, success) {
      assert.ifError(err);
      assert(success);
      done();
    });
  });

  it('should raise error when rate limit is exceeded', function(done) {
    state.limit.increment_or_raise(3, null, function(err, success) {
      assert.ifError(err);
      assert(success);
      state.limit.increment_or_raise(1, null, function(err, success) {
        assert(err);
        assert(err.message, 'limit exceeded');
        done();
      });
    });
  });
});

describe('would_exceed', function() {
  var state = {};

  beforeEach('reset limit', function(done) {
    state.limit = new TrafficJam.Limit('test', 'user1', 3, 60 * 60);
    state.limit.reset(done);
    timekeeper.reset();
  });

  it('should be true when amount would exceed limit', function(done) {
    state.limit.increment(2, null, function(err, success) {
      assert.ifError(err);
      assert(success);
      state.limit.would_exceed(2, function(err, would_exceed) {
        assert.ifError(err);
        assert(would_exceed);
        done();
      });
    });
  });

  it('should be false when amount would not exceed limit', function(done) {
    state.limit.increment(2, null, function(err, success) {
      assert.ifError(err);
      assert(success);
      state.limit.would_exceed(1, function(err, would_exceed) {
        assert.ifError(err);
        assert(!would_exceed);
        done();
      });
    });
  });
});

describe('used', function() {
  var state = {};

  beforeEach('reset limit', function(done) {
    state.limit = new TrafficJam.Limit('test', 'user1', 3, 60 * 60);
    state.limit.reset(done);
    timekeeper.reset();
  });

  it('should be 0 when there has been no incrementing', function(done) {
    state.limit.used(function(err, used) {
      assert.ifError(err);
      assert.equal(used, 0);
      done();
    });
  });

  it('should be the amount used', function(done) {
    state.limit.increment(1, null, function(err, success) {
      assert.ifError(err);
      assert(success);

      state.limit.used(function(err, used) {
        assert.ifError(err);
        assert.equal(used, 1);
        done();
      });
    });
  });

  it('should decrease over time', function(done) {
    state.limit.increment(2, null, function(err, success) {
      assert.ifError(err);
      assert(success);
      var now = (new Date()).getTime();
      var then = now + (state.limit.period / 2 * 1000);
      timekeeper.travel(then);

      state.limit.used(function(err, used) {
        assert.ifError(err);
        assert.equal(used, 1);
        done();
      });
    })
  });

  it('should not exceed maximum when limit changes', function(done) {
    state.limit.increment(3, null, function(err, success) {
      assert.ifError(err);
      assert(success);
      var limit2 = new TrafficJam.Limit('test', 'user1', 2, 60 * 60);
      limit2.used(function(err, used) {
        assert.ifError(err);
        assert.equal(used, 2);
        done();
      });
    });
  });
});

describe('reset', function() {
  var state = {};

  beforeEach('reset limit', function(done) {
    state.limit = new TrafficJam.Limit('test', 'user1', 3, 60 * 60);
    state.limit.reset(done);
    timekeeper.reset();
  });

  it('should reset current count to 0', function(done) {
    state.limit.increment(3, null, incremented_1);

    function incremented_1(err, success) {
      assert.ifError(err);
      assert(success);
      state.limit.used(used_1);
    }

    function used_1(err, used) {
      assert.ifError(err);
      assert.equal(used, 3);
      state.limit.reset(reset_1);
    }

    function reset_1(err) {
      assert.ifError(err);
      state.limit.used(used_2);
    }

    function used_2(err, used) {
      assert.ifError(err);
      assert.equal(used, 0);
      done();
    }
  });
});

describe('decrement', function() {
  var state = {};

  beforeEach('reset limit', function(done) {
    state.limit = new TrafficJam.Limit('test', 'user1', 3, 60 * 60);
    state.limit.reset(done);
    timekeeper.reset();
  });

  it('should reduce the amount used', function(done) {
    state.limit.increment(3, null, increment_1);

    function increment_1(err, success) {
      assert.ifError(err);
      assert(success);
      state.limit.decrement(2, null, decrement_1);
    }

    function decrement_1(err) {
      assert.ifError(err);
      state.limit.used(used_1);
    }

    function used_1(err, used) {
      assert.ifError(err);
      assert.equal(used, 1);
      done();
    }
  });

  it('should not lower amount used below 0', function(done) {
    state.limit.decrement(2, null, decrement_1);

    function decrement_1(err) {
      assert.ifError(err);
      state.limit.increment(4, null, increment_1);
    }

    function increment_1(err, success) {
      assert.ifError(err);
      assert(!success);
      state.limit.used(used_1);
    }

    function used_1(err, used) {
      assert.ifError(err);
      assert.equal(used, 0);
      done();
    }
  });
});
