module.exports = {
  generateUniqueUserId,
  logPurchaseResult
};

function generateUniqueUserId(context, events, done) {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000);
  context.vars.uniqueUserId = `artillery-${timestamp}-${random}`;
  return done();
}

function logPurchaseResult(requestParams, response, context, events, done) {
  if (response.body) {
    try {
      const body = JSON.parse(response.body);
      if (body.success) {
        events.emit('counter', 'purchase.success', 1);
      } else if (body.message && body.message.includes('already purchased')) {
        events.emit('counter', 'purchase.duplicate', 1);
      } else if (body.message && body.message.includes('sold out')) {
        events.emit('counter', 'purchase.sold_out', 1);
      } else {
        events.emit('counter', 'purchase.other_failure', 1);
      }
    } catch (e) {
      events.emit('counter', 'purchase.parse_error', 1);
    }
  }
  return done();
}