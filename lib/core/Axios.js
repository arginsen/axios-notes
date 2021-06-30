'use strict';

var utils = require('./../utils');
var buildURL = require('../helpers/buildURL');
var InterceptorManager = require('./InterceptorManager');
var dispatchRequest = require('./dispatchRequest');
var mergeConfig = require('./mergeConfig');

/**
 * Create a new instance of Axios
 *
 * @param {Object} instanceConfig The default config for the instance
 */
function Axios(instanceConfig) {
  this.defaults = instanceConfig;
  // 请求拦截器、响应拦截器
  this.interceptors = {
    request: new InterceptorManager(),
    response: new InterceptorManager()
  };
}

/**
 * Dispatch a request
 *
 * @param {Object} config The config specific for this request (merged with this.defaults)
 */
Axios.prototype.request = function request(config) {
  /*eslint no-param-reassign:0*/
  // Allow for axios('example/url'[, config]) a la fetch API
  if (typeof config === 'string') {
    config = arguments[1] || {};
    config.url = arguments[0];
  } else {
    config = config || {};
  }

  config = mergeConfig(this.defaults, config);
  config.method = config.method ? config.method.toLowerCase() : 'get';

  // Hook up interceptors middleware
  var chain = [dispatchRequest, undefined];
  var promise = Promise.resolve(config); // 生成promise实例 等价于 new Promise(resolve => resolve(config))

  // 手动添加拦截器测试
  // ----------------------
  axios.interceptors.request.use(function (config) {
    console.log('------request------success------2');
    return config;
  }, function (error) {
    console.log('------request------error------2');
    return Promise.reject(error);
  });

  axios.interceptors.request.use(function (config) {
    console.log('------request------success------1');
    return config;
  }, function (error) {
    console.log('------request------error------1');
    return Promise.reject(error);
  });

  axios.interceptors.response.use(function (response) {
    console.log('------response------success------1');
    return response;
  }, function (error) {
    console.log('------response------error------1');
    return Promise.reject(error);
  });

  axios.interceptors.response.use(function (response) {
    console.log('------response------success------2');
    return response;
  }, function (error) {
    console.log('------response------error------2');
    return Promise.reject(error);
  });
  // ----------------------

  // 遍历用户设置的请求拦截器
  this.interceptors.request.forEach(function unshiftRequestInterceptors(interceptor) {
    chain.unshift(interceptor.fulfilled, interceptor.rejected); // 拦截器成功的函数、拦截器失败的函数
  });

  this.interceptors.response.forEach(function pushResponseInterceptors(interceptor) {
    chain.push(interceptor.fulfilled, interceptor.rejected);
  });

  // 遍历chain数组，每次从头移除两个作为then的两个参数(success, error)
  // promise 链式调用，先执行请求拦截器的内容，再派发请求，
  // 此时传入上个函数成功后的config作为dispatchRequest的参数，
  // 执行完后then返回适配器adapter处理后的响应数据（promise对象）
  // 再执行相应拦截器函数
  while (chain.length) {
    promise = promise.then(chain.shift(), chain.shift());
  }

  return promise;
};

Axios.prototype.getUri = function getUri(config) {
  config = mergeConfig(this.defaults, config);
  return buildURL(config.url, config.params, config.paramsSerializer).replace(/^\?/, '');
};

// Provide aliases for supported request methods
utils.forEach(['delete', 'get', 'head', 'options'], function forEachMethodNoData(method) {
  /*eslint func-names:0*/
  Axios.prototype[method] = function(url, config) {
    return this.request(utils.merge(config || {}, {
      method: method,
      url: url
    }));
  };
});

utils.forEach(['post', 'put', 'patch'], function forEachMethodWithData(method) {
  /*eslint func-names:0*/
  Axios.prototype[method] = function(url, data, config) {
    return this.request(utils.merge(config || {}, {
      method: method,
      url: url,
      data: data
    }));
  };
});

module.exports = Axios;
