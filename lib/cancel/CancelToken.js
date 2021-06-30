'use strict';

var Cancel = require('./Cancel');

/**
 * A `CancelToken` is an object that can be used to request cancellation of an operation.
 *
 * @class
 * @param {Function} executor The executor function.
 */
function CancelToken(executor) {
  if (typeof executor !== 'function') {
    throw new TypeError('executor must be a function.');
  }

  var resolvePromise;
  // promise 得到一个 promise 对象，
  // 在请求确认 config.cancelToken 后继续执行 then，
  // 并传递参数 token.reason，实质上也就是取消的 message
  this.promise = new Promise(function promiseExecutor(resolve) {
    resolvePromise = resolve;
  });

  var token = this;
  executor(function cancel(message) {
    if (token.reason) {
      // Cancellation has already been requested
      return;
    }

    token.reason = new Cancel(message);
    resolvePromise(token.reason); // 至此 token new 成功了，source 初始化中返回
  });
}

/**
 * Throws a `Cancel` if cancellation has been requested.
 */
CancelToken.prototype.throwIfRequested = function throwIfRequested() {
  if (this.reason) {
    throw this.reason;
  }
};

/**
 * Returns an object that contains a new `CancelToken` and a function that, when called,
 * cancels the `CancelToken`.
 */

// 取消请求 config.cancelToken 是触发了source.cancel()才生成的。
/* const CancelToken = axios.CancelToken;
 * const source = CancelToken.source();
 * source.cancel(message);
 */

// source 初始化完成后，结构为：
/* {
 *   token: {
 *     promise: new Promise(function(resolve){
 *       resolve({ message: message})
 *     }),
 *     reason: { message: message }
 *   },
 *   cancel: function cancel(message) {
 *     if (token.reason) {
 *       return;
 *     }
 *     token.reason = {message: message};
 *   }
 * }
 */

CancelToken.source = function source() {
  var cancel;
  var token = new CancelToken(function executor(c) {
    cancel = c;
  });
  return {
    token: token,
    cancel: cancel
  };
};

module.exports = CancelToken;
