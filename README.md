
# axios 源码阅读

- [调试](#调试)
- [源码](#)
  - [实例结构](#实例结构)
  - [源码结构](#源码结构)
    - [axios.js](#axios.js)
      - [bind.js](#bind.js)
      - [utils.js](#utils.js)
        - [utils.extend](#utils.extend)
        - [utils.forEach](#utils.forEach)
      - [spread.js](#spread.js)
    - [Axios.js](#Axios.js)
    - [interceptorManager.js](#interceptorManager.js)
    - [dispatchRequest.js](#dispatchRequest.js)
    - [adapters/xhr.js](#adapters/xhr.js)
    - [cancel](#cancel)
      - [cancel/CancelToken.js](#cancel/CancelToken.js)
      - [cancel/Cancel.js](#cancel/Cancel.js)
- [参考](#)

> 从上至下阅读即可，学习整个流程

# 调试

`axios` 打包后有 `sourcemap` 文件

```
下载、解压，学习源码用了 0.19.0 版本
https://github.com/axios/axios/archive/refs/tags/v0.19.0.zip

进入目录、安装运行
npm install
npm start
```

可以查看 `package.json` 文件，`npm start` 运行的是 `/sandbox/server.js`，通过 `node` 发布在 3000 端口，浏览器打开 `http://localhost:3000`，可以浏览器打断点查看`axios`运行流程是怎样的，一般看这个就可。

此外，源码目录中 `examples` 目录下有已经写好的例子，方便调试。下边做一些必要的修改，注释掉原有的启服务的代码，新添如下代码

```js
// ./examples/server.js

server = http.createServer(function (req, res) {
  var url = req.url;

  // // Process axios itself
  // if (/axios\.min\.js$/.test(url)) {
  //   pipeFileToResponse(res, '../dist/axios.min.js', 'text/javascript');
  //   return;
  // }
  // if (/axios\.min\.map$/.test(url)) {
  //   pipeFileToResponse(res, '../dist/axios.min.map', 'text/javascript');
  //   return;
  // }
  // if (/axios\.amd\.min\.js$/.test(url)) {
  //   pipeFileToResponse(res, '../dist/axios.amd.min.js', 'text/javascript');
  //   return;
  // }
  // if (/axios\.amd\.min\.map$/.test(url)) {
  //   pipeFileToResponse(res, '../dist/axios.amd.min.map', 'text/javascript');
  //   return;
  // }

  // 修改方便调试 -------------------
  if (/axios\.min\.js$/.test(url)) {
    pipeFileToResponse(res, '../dist/axios.js', 'text/javascript');
    return;
  }

  if (/axios\.map$/.test(url)) {
    pipeFileToResponse(res, '../dist/axios.map', 'text/javascript');
    return;
  }
  // -------------------------------
```

修改好后直接运行

```
npm run examples

node ./examples/server.js -p 5000 // 或直接指定端口
```

# 源码

## 实例结构

在运行了 `/sandbox/server.js` 之后，浏览器打开 `http://localhost:3000`，在调试器中可以直接打印 `axios`

```js
console.log({axios: axios});
```

显示如下：

```js
{
  axios: ƒ wrap()
    Axios: ƒ Axios(instanceConfig)
    Cancel: ƒ Cancel(message)
    CancelToken: ƒ CancelToken(executor)
    all: ƒ all(promises)
    create: ƒ create(instanceConfig)
    default: ƒ wrap()
    defaults: {transformRequest: Array(1), transformResponse: Array(1), timeout: 0, xsrfCookieName: "XSRF-TOKEN", adapter: ƒ, …}
    delete: ƒ wrap()
    get: ƒ wrap()
    getUri: ƒ wrap()
    head: ƒ wrap()
    interceptors: {request: InterceptorManager, response: InterceptorManager}
    isCancel: ƒ isCancel(value)
    options: ƒ wrap()
    patch: ƒ wrap()
    post: ƒ wrap()
    put: ƒ wrap()
    request: ƒ wrap()
    spread: ƒ spread(callback)
    arguments: (...)
    caller: (...)
    length: 0
    name: "wrap"
    prototype: {constructor: ƒ}
    __proto__: ƒ ()
    [[FunctionLocation]]: bind.js:5
    [[Scopes]]: Scopes[2]
}

```

可以看出，`axios` 本身作为一个函数，函数的位置在 `bind.js`，这是因为 `axios` 在创建时，是通过 `Axios` 构造函数先生成实例，接着使用 `bind` 方法将 `Axios` 原型上的 `request` 方法的 `this` 指向刚生成的新实例（`context`），并返回 `request` 函数，而`bind` 又返回 `wrap` 函数，即 `axios` 实际上就是被绑在新实例下的 `request` 函数

除作为一个函数本身所有的 `arguments、caller、length、name、__proto__` 属性，随后在绑定完 `request` 后，又对实例（指向新实例的`request`函数）进行扩展，将 `Axios` 原型上的属性都复制到 `instance` 上；并且 `Axios` 原型上的方法 `this` 均指向 `context`（同之前的`bind`）；接着又扩展 `instance`，将 `Axios` 传递了默认设置的新实例的属性都复制到 `instance` 上，最终返回 `instance`。

所以 `axios` 对象本身其实是一个函数，一个拥有很多属性的函数。

## 源码结构

```
-examples
-lib
  -adapters
    -http.js node环境下http请求适配器
    -README.md
    -xhr.js 浏览器环境XMLHttpReq对象适配器
  -cancel 取消请求
    -Cancel.js 构造函数Cancel，cancel对象是请求被取消时抛出的对象
    -CancelToken.js 构造函数CancelToken，用于取消请求的对象
    -isCancel.js 判断请求失败时的错误对象是否是Cancel对象
  -core
    -Axios 构造函数Axios，Axios.prototype.request方法
    -createError.js 创建一个error对象
    -dispatchRequest.js 使用对应环境的适配器向服务器发起请求
    -enhanceError.js 使用指定信息升级error对象
    -InterceptorManager.js 构造函数InterceptorManager，拦截器
    -mergeConfig.js 合并两个配置项为一个配置项
    -README.md
    -settle.js 根据响应状态码决定promise的状态
    -transformData.js 请求之前或响应之后处理data或者response
  -helpers 协助模块
    -bind.js 绑定方法到指定this上
    -buildURL.js 将params查询字符串连接到url之后
    -combineURLs.js 连接指定的ur1创建出新的url
    -cookies.js 读写、移除浏览器cookie
    -deprecatedMethod.js 向不赞成的方法发出警告
    -isAbsoluteURL.js 检查url是否是绝对路径
    -isURLSameOrigin.js 请求url和当前页面地址是否处于同一域
    -normalizeHeaderName.js 标准化header名
    -parseHeaders.js 将请求头或响应头转换成一个对象
    -README.md
    -spread.js 将一个函数包装成接收一个数组参数并将其展开成参数列表的函数
  axios.js 入口，创建axios对象
  defaults.js 默认配置
  utils.js 工具方法
-sandbox
-test
```

## 源码解析

源码入口，一般 `package.json` 会申明 `main` 主入口文件; 讲解内容均在 `lib` 文件夹下

```json
// package.json
{
  "name": "axios",
  "version": "0.19.0",
  "description": "Promise based HTTP client for the browser and node.js",
  "main": "index.js",
  // ...
}
```

同级目录下 `index.js`

```js
// index.js
module.exports = require('./lib/axios');
```

### axios.js

如上介绍的，该文件主要用于创建 `axios` 实例，实际上做了如下事：

1. 通过 `Axios` 构造函数生成默认配置的实例 `context`
2. 使用 `bind` 方法将 `Axios` 原型上的 `request` 方法的 `this` 指向刚生成的新实例（`context`），返回 `request` 函数，赋给 `instance`
3. 接着用 `extend` 方法扩展 `instance`，将 `Axios` 原型上的属性都复制到 `instance` 上，并将其上方法的 `this` 均指向 `context`
4. 继续将 `context` 对象复制到 `instance` 上，返回 `instance`，至此 `axios` 初始化实例的步骤跑完


5. 接着将 `Axios` 构造函数添加到 `axios` 上
6. 创建工厂模式，可以使用户自定义配置来创建 `axios` 实例
7. 绑定取消请求的方法
8. 绑定 `all` 和 `spread`

```js
// lib/axios.js

'use strict';

var utils = require('./utils');
var bind = require('./helpers/bind');
var Axios = require('./core/Axios');
var mergeConfig = require('./core/mergeConfig');
var defaults = require('./defaults');

/**
 * Create an instance of Axios
 *
 * @param {Object} defaultConfig The default config for the instance
 * @return {Axios} A new instance of Axios
 */
function createInstance(defaultConfig) {
  var context = new Axios(defaultConfig);
  var instance = bind(Axios.prototype.request, context);

  // Copy axios.prototype to instance
  utils.extend(instance, Axios.prototype, context);

  // Copy context to instance
  utils.extend(instance, context);

  return instance;
}

// Create the default instance to be exported
var axios = createInstance(defaults);

// Expose Axios class to allow class inheritance
axios.Axios = Axios;

// Factory for creating new instances
axios.create = function create(instanceConfig) {
  return createInstance(mergeConfig(axios.defaults, instanceConfig));
};

// Expose Cancel & CancelToken
axios.Cancel = require('./cancel/Cancel');
axios.CancelToken = require('./cancel/CancelToken');
axios.isCancel = require('./cancel/isCancel');

// Expose all/spread
axios.all = function all(promises) {
  return Promise.all(promises);
};
axios.spread = require('./helpers/spread');

module.exports = axios;

// Allow use of default import syntax in TypeScript
module.exports.default = axios;
```

#### bind.js

```js
// lib/helpers/bind.js

'use strict';

module.exports = function bind(fn, thisArg) { // 第一个参数为函数，第二个参数为对象，使函数中的this指向该对象
  return function wrap() {
    var args = new Array(arguments.length);
    for (var i = 0; i < args.length; i++) {
      args[i] = arguments[i];
    }
    return fn.apply(thisArg, args); // 当前的axios实例下，第一个参数函数的参数args（数组、类数组）作为apply方法的第二个参数；函数fn的this指向第一个参数（对象）
  };
};
```

#### utils.js

`lib/utils.js`。封装一些工具函数

##### utils.extend

遍历参数 b 对象，复制到 a 对象上，如果是函数就将 b 的属性方法用 `bind` 函数处理一遍(`this` 指向对象 c)，再复制到 a 对象

```js
function extend(a, b, thisArg) {
  forEach(b, function assignValue(val, key) {
    if (thisArg && typeof val === 'function') {
      a[key] = bind(val, thisArg);
    } else {
      a[key] = val;
    }
  });
  return a;
}
```

##### utils.forEach

遍历数组和对象。设计模式叫迭代器模式。
主要实现：判断是否数组或对象，是数组就用 `for` 循环遍历各元素，是对象就 `for...in` 遍历属性。循环执行参数函数

```js
/**
 * @param {Object|Array} obj The object to iterate
 * @param {Function} fn The callback to invoke for each item
 */
function forEach(obj, fn) {
  // Don't bother if no value provided
  // 判断 null 和 undefined 直接返回
  if (obj === null || typeof obj === 'undefined') {
    return;
  }

  // Force an array if not already something iterable
  // 如果不是对象，放在数组里。
  if (typeof obj !== 'object') {
    /*eslint no-param-reassign:0*/
    obj = [obj];
  }

  // 是数组 则用 for 循环，调用 fn 函数。参数类似 Array.prototype.forEach 的前三个参数。
  if (isArray(obj)) {
    // Iterate over array values
    for (var i = 0, l = obj.length; i < l; i++) {
      fn.call(null, obj[i], i, obj);
    }
  } else {
    // Iterate over object keys
    // 用 for in 遍历对象，但 for in 会遍历原型链上可遍历的属性。
    // 所以用 hasOwnProperty 来过滤自身属性了。
    // 其实也可以用 Object.keys 来遍历，它不遍历原型链上不可遍历的属性。
    for (var key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        fn.call(null, obj[key], key, obj);
      }
    }
  }
}
```

#### spread.js

`spread(callback)(arr)`
`spread` 函数传入参数 `callback`(回调函数)，并返回 `wrap` 函数，`wrap` 函数参数为数组 `arr`，返回 `this` 指向 `null` ，参数为 `arr` 的回调函数 `callback` 执行结果

> invoking a function and expanding an array for arguments

```js
// lib/helpers/spread.js
'use strict';

/**
 * Syntactic sugar for invoking a function and expanding an array for arguments.
 *
 * Common use case would be to use `Function.prototype.apply`.
 * -----------------------
 *  function f(x, y, z) {}
 *  var args = [1, 2, 3];
 *  f.apply(null, args);
 * -----------------------
 * 
 * With `spread` this example can be re-written.
 * @param {Function} callback
 * @returns {Function}
 */
module.exports = function spread(callback) {
  return function wrap(arr) {
    return callback.apply(null, arr);
  };
};
```

### Axios.js

1. 定义了 `Axios` 构造函数，绑定了传入的配置（初始化为默认配置）和拦截器
2. 在构造函数 `Axios` 原型上定义请求函数 `request`，初始化完成的 `axios` 本质上就是 `request` 函数，在使用时我们一般会传入自定的配置（`url、timeout`等），因此 `request` 函数首先要处理传入的配置，允许字符串或对象，再与默认配置合并赋值给 `config`。再生成一个 `promise` 对象，`resolve(config)`
3. 创建一个拦截器中间件 `chain`，先压入 `dispatchRequest` 和 `undefined`，再遍历用户设置的拦截器，向 `chain` 循环压入每个拦截器 `interceptor` 的 `fulfilled` 和 `rejected` 方法，请求的从前压入，响应的从后压入。

```js
// 完后 chain 的结构如下
Array(10)
0: ƒ (config)
1: ƒ (error)
2: ƒ (config)
3: ƒ (error)
4: ƒ dispatchRequest(config)
5: undefined
6: ƒ (config)
7: ƒ (error)
8: ƒ (config)
9: ƒ (error)
length: 10
__proto__: Array(0)
```

4. 接着循环取出 `chain`，由之前生成的 `promise` 对象链式调用，每次从 `chain` 头部取两个，作为 `promise` 的 `then` 方法的两个参数函数(success, error)，如果一路正常，在执行请求拦截器的操作同时，`config` 也被作为参数、返回值一路传递，直到 `dispatchRequest` 执行，完成具体的派发请求，获取响应结果，经过响应拦截器处理，最终返回响应结果
5. `Axios` 原型上绑定了 `getUri` 方法，也就是将 `url` 地址与传的参数拼接，一般 `post` 接口参数为对象或嵌套对象，该方法可以将其提取出，拼贴在 `url` 后边，形成一个字符串格式的 `url`
6. `Axios` 原型上绑定各个请求方法，按传不传数据分了两组，本质还是整合 `config` 调用 `request` 方法

```js
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

  // 遍历用户设置的请求拦截器，将每个拦截器的成功失败方法压入 chain
  this.interceptors.request.forEach(function unshiftRequestInterceptors(interceptor) {
    chain.unshift(interceptor.fulfilled, interceptor.rejected); // 拦截器成功的函数、拦截器失败的函数
  });

  this.interceptors.response.forEach(function pushResponseInterceptors(interceptor) {
    chain.push(interceptor.fulfilled, interceptor.rejected);
  });

  // 遍历chain数组，每次从头移除两个作为then的两个参数(success, error)
  // promise 链式调用，先执行请求拦截器的内容，再派发请求，
  // 此时传入上个函数成功后的config作为 dispatchRequest 的参数，
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
```

>也可以在 `chain` 创建后，拦截器组遍历之前手动添加拦截器作以测试：

```js
  axios.interceptors.request.use(function (config) {
    console.log('------request------success----2');
    return config;
  }, function (error) {
    console.log('------request------error------2');
    return Promise.reject(error);
  });

  axios.interceptors.request.use(function (config) {
    console.log('------request------success----1');
    return config;
  }, function (error) {
    console.log('------request------error------1');
    return Promise.reject(error);
  });

  axios.interceptors.response.use(function (response) {
    console.log('------response-----success----1');
    return response;
  }, function (error) {
    console.log('------response-----error------1');
    return Promise.reject(error);
  });

  axios.interceptors.response.use(function (response) {
    console.log('------response-----success----2');
    return response;
  }, function (error) {
    console.log('------response-----error------2');
    return Promise.reject(error);
  });
```

### interceptorManager.js

定义了拦截器构造函数，及在其原型上绑定 `use`、`eject`、`forEach` 方法。

> use、eject 方法为用户端书写，如下：

```js
// Add a request interceptor
axios.interceptors.request.use(function (config) {
  // Do something before request is sent
  return config;
}, function (error) {
  // Do something with request error
  return Promise.reject(error);
});

// Add a response interceptor
axios.interceptors.response.use(function (response) {
  // Any status code that lie within the range of 2xx cause this function to trigger
  // Do something with response data
  return response;
}, function (error) {
  // Any status codes that falls outside the range of 2xx cause this function to trigger
  // Do something with response error
  return Promise.reject(error);
});

// eject 方法移除拦截器（自定义条件）
const myInterceptor = axios.interceptors.request.use(function () {/*...*/});
axios.interceptors.request.eject(myInterceptor);
```

`use` 方法为新增一个拦截器，参数为用户侧定义的两个函数，将此两个函数组成一个对象，即为一个拦截器。

`eject` 方法通过 `use` 生成的拦截器所返回的 `id`，在**拦截器组** `this.handlers` 中删除对应的拦截器（使其为 null）

`forEach` 方法遍历**拦截器组** `this.handlers` 中每个不为 `null` 的拦截器(interceptor)执行参数函数

```js
// lib/core/InterceptorManager.js
'use strict';

var utils = require('./../utils');

function InterceptorManager() {
  this.handlers = []; // 存储拦截器
}

/**
 * Add a new interceptor to the stack
 *
 * @param {Function} fulfilled The function to handle `then` for a `Promise`
 * @param {Function} rejected The function to handle `reject` for a `Promise`
 *
 * @return {Number} An ID used to remove interceptor later
 */
InterceptorManager.prototype.use = function use(fulfilled, rejected) {
  this.handlers.push({
    fulfilled: fulfilled,
    rejected: rejected
  });
  return this.handlers.length - 1; // 新添加进的做以序号标记方便移除
};

/**
 * Remove an interceptor from the stack
 *
 * @param {Number} id The ID that was returned by `use`
 */
InterceptorManager.prototype.eject = function eject(id) { // 通过use返回的数字来删除数组中的拦截器
  if (this.handlers[id]) {
    this.handlers[id] = null;
  }
};

/**
 * Iterate over all the registered interceptors
 *
 * This method is particularly useful for skipping over any
 * interceptors that may have become `null` calling `eject`.
 *
 * @param {Function} fn The function to call for each interceptor
 */
InterceptorManager.prototype.forEach = function forEach(fn) {
  utils.forEach(this.handlers, function forEachHandler(h) {
    // h 为拦截器组遍历到的当前的元素，即拦截器对象
    // 而此函数未定义其他参数，则默认为第一个参数 obj[key]
    // 判断拦截器是否为空，过滤掉已删除的拦截器
    if (h !== null) {
      fn(h);
    }
  });
};

module.exports = InterceptorManager;
```

### dispatchRequest.js

使用配置好的适配器向服务器派发请求。

1. 检查请求取消机制是否触发，有的话当前派发就直接取消，不往下执行
2. 如果用户设置了 `baseUrl` ，就和具体请求调用的相对 `url` 拼接，一般我们写 vue 里的请求处理就是这样
3. 检查请求 `headers`，转换请求数据，拍平 `headers`，再将指定的请求方法删除 `headers`
4. 添加适配器 `adapter`，`dispatchRequest` 函数即返回适配器**执行的结果**，适配器是真正向后端发送请求的部分，`adapter` 本身是一个 `promise` 对象，传入 `config`，经过处理后，成功则返回响应数据，失败则抛出错误。经过处理后用 `then` 接受处理后的结果，再将结果转化后返回，由我们在外部处理最终响应数据的这个 `promise` 对象。(实际上整个流程就是 `request` 函数)
> then 方法接受两个回调函数作为参数，分别指定 resolved 状态和 rejected 状态的回调函数。

```js
axios.get('/api/getAllProduct').then((res) => {
    // 正常处理响应数据
  }, (err) => {
    // 可选的回调函数，用于处理 rejected 状态
  }
})
```

```js
// lib/core/dispatchRequest.js

'use strict';

var utils = require('./../utils');
var transformData = require('./transformData');
var isCancel = require('../cancel/isCancel');
var defaults = require('../defaults');
var isAbsoluteURL = require('./../helpers/isAbsoluteURL');
var combineURLs = require('./../helpers/combineURLs');

/**
 * Throws a `Cancel` if cancellation has been requested.
 */
function throwIfCancellationRequested(config) {
  if (config.cancelToken) {
    config.cancelToken.throwIfRequested();
  }
}

/**
 * Dispatch a request to the server using the configured adapter.
 *
 * @param {object} config The config that is to be used for the request
 * @returns {Promise} The Promise to be fulfilled
 */
module.exports = function dispatchRequest(config) { // 派发请求
  throwIfCancellationRequested(config);

  // Support baseURL config
  if (config.baseURL && !isAbsoluteURL(config.url)) {
    config.url = combineURLs(config.baseURL, config.url);
  }

  // Ensure headers exist
  config.headers = config.headers || {};

  // Transform request data
  config.data = transformData(
    config.data,
    config.headers,
    config.transformRequest
  );

  // Flatten headers
  config.headers = utils.merge(
    config.headers.common || {},
    config.headers[config.method] || {},
    config.headers || {}
  );

  utils.forEach(
    ['delete', 'get', 'head', 'post', 'put', 'patch', 'common'],
    function cleanHeaderConfig(method) {
      delete config.headers[method];
    }
  );

  var adapter = config.adapter || defaults.adapter;

  return adapter(config).then(function onAdapterResolution(response) {
    throwIfCancellationRequested(config);

    // Transform response data
    response.data = transformData(
      response.data,
      response.headers,
      config.transformResponse
    );

    return response;
  }, function onAdapterRejection(reason) {
    if (!isCancel(reason)) {
      throwIfCancellationRequested(config);

      // Transform response data
      if (reason && reason.response) {
        reason.response.data = transformData(
          reason.response.data,
          reason.response.headers,
          config.transformResponse
        );
      }
    }

    return Promise.reject(reason);
  });
};
```

### adapters/xhr.js

适配器 `adapter` 在 defaults.js 也就是默认配置创建实例时被初始化，根据 `XMLHttpRequest`、`process` 来判断当前环境是浏览器还是 `node` 环境，来分别引入不同的适配器，如下：

```js
// lib/defaults.js

function getDefaultAdapter() {
  var adapter;
  // 根据 XMLHttpRequest 判断
  if (typeof XMLHttpRequest !== 'undefined') {
    // For browsers use XHR adapter
    adapter = require('./adapters/xhr');
    // 根据 process 判断
  } elseif (typeof process !== 'undefined' && Object.prototype.toString.call(process) === '[object process]') {
    // For node use HTTP adapter
    adapter = require('./adapters/http');
  }
  return adapter;
}
var defaults = {
  adapter: getDefaultAdapter(),
  // ...
};
```

主要来看我们一般遇到的浏览器跨域请求 `xhr.js`

1. 整个文件返回一个 `promise` 对象，也就是说一个适配器 `adapter` 即是一个 `promise` 对象，`Promise` 构造函数用 `dispatchXhrRequest` 函数作为参数，该函数的两个参数为 `resolve` 和 `reject` 
>Promise 构造函数定义，resolve 和 reject 为两个函数，由 JavaScript 引擎提供，resolve 在异步操作成功时调用，并将异步操作的结果，作为参数传递出去

2. 准备请求数据、请求头。创建 `XMLHttpRequest` 对象，判断 `http` 授权信息。设置请求信息，构建 `url`，设置请求超时。**监听**请求状态变化(`onreadystatechange`)，如果请求准备状态不对，直接返回，从 `XHR` 对象中检查返回的状态码及返回信息，不对也直接 `return`。接着就准备响应头、响应数据，从 `XHR` 对象中提取 `response` 的数据，使用 `settle` 处理响应数据，用验证状态码的函数检测 `http` 状态码，200~300 之间的用 `resolve` 使异步操作便成功并传递响应数据出去；之外的状态码就用 `reject` 抛出错误，同时附上响应的一些信息。最后清除掉 `XHR` 对象。
3. 其次**定义** XHR 对象处理异常的方法，`onabort` 处理请求取消的情况，`onerror` 处理网络错误，`ontimeout` 处理超时。再添加 `xsrf` 头，各请求头；判断是否允许开启 `cookie`，指定跨域 `Access-Control` 请求是否应带有授权信息；添加响应类型；处理下载、上传进度；处理请求取消，判断用户侧是否设置 `cancelToken`，如有则执行取消操作，再抛出取消信息。
4. 以上工作完成后**发送**请求数据。


```js
'use strict';

var utils = require('./../utils');
var settle = require('./../core/settle');
var buildURL = require('./../helpers/buildURL');
var parseHeaders = require('./../helpers/parseHeaders');
var isURLSameOrigin = require('./../helpers/isURLSameOrigin');
var createError = require('../core/createError');

module.exports = function xhrAdapter(config) {
  return new Promise(function dispatchXhrRequest(resolve, reject) {
    var requestData = config.data;
    var requestHeaders = config.headers;

    if (utils.isFormData(requestData)) {
      delete requestHeaders['Content-Type']; // Let the browser set it
    }

    var request = new XMLHttpRequest();

    // HTTP basic authentication
    if (config.auth) {
      var username = config.auth.username || '';
      var password = config.auth.password || '';
      requestHeaders.Authorization = 'Basic ' + btoa(username + ':' + password);
    }

    request.open(config.method.toUpperCase(), buildURL(config.url, config.params, config.paramsSerializer), true);

    // Set the request timeout in MS
    request.timeout = config.timeout;

    // Listen for ready state
    request.onreadystatechange = function handleLoad() {
      if (!request || request.readyState !== 4) {
        return;
      }

      // The request errored out and we didn't get a response, this will be
      // handled by onerror instead
      // With one exception: request that using file: protocol, most browsers
      // will return status as 0 even though it's a successful request
      // 检测 http 状态码
      if (request.status === 0 && !(request.responseURL && request.responseURL.indexOf('file:') === 0)) {
        return;
      }

      // Prepare the response
      var responseHeaders = 'getAllResponseHeaders' in request ? parseHeaders(request.getAllResponseHeaders()) : null;
      var responseData = !config.responseType || config.responseType === 'text' ? request.responseText : request.response;
      var response = {
        data: responseData,
        status: request.status,
        statusText: request.statusText,
        headers: responseHeaders,
        config: config,
        request: request
      };

      settle(resolve, reject, response); // 用 http 状态码来处理数据的去向

      // Clean up request
      request = null;
    };

    // Handle browser request cancellation (as opposed to a manual cancellation)
    request.onabort = function handleAbort() {
      if (!request) {
        return;
      }

      reject(createError('Request aborted', config, 'ECONNABORTED', request));

      // Clean up request
      request = null;
    };

    // Handle low level network errors
    request.onerror = function handleError() {
      // Real errors are hidden from us by the browser
      // onerror should only fire if it's a network error
      reject(createError('Network Error', config, null, request));

      // Clean up request
      request = null;
    };

    // Handle timeout
    request.ontimeout = function handleTimeout() {
      reject(createError('timeout of ' + config.timeout + 'ms exceeded', config, 'ECONNABORTED',
        request));

      // Clean up request
      request = null;
    };

    // Add xsrf header
    // This is only done if running in a standard browser environment.
    // Specifically not if we're in a web worker, or react-native.
    if (utils.isStandardBrowserEnv()) {
      var cookies = require('./../helpers/cookies');

      // Add xsrf header
      var xsrfValue = (config.withCredentials || isURLSameOrigin(config.url)) && config.xsrfCookieName ?
        cookies.read(config.xsrfCookieName) :
        undefined;

      if (xsrfValue) {
        requestHeaders[config.xsrfHeaderName] = xsrfValue;
      }
    }

    // Add headers to the request
    if ('setRequestHeader' in request) {
      utils.forEach(requestHeaders, function setRequestHeader(val, key) {
        if (typeof requestData === 'undefined' && key.toLowerCase() === 'content-type') {
          // Remove Content-Type if data is undefined
          delete requestHeaders[key];
        } else {
          // Otherwise add header to the request
          request.setRequestHeader(key, val);
        }
      });
    }

    // Add withCredentials to request if needed
    // withCredentials 是否允许开启cookie ，指定跨域 Access-Control 请求是否应带有授权信息
    if (config.withCredentials) {
      request.withCredentials = true;
    }

    // Add responseType to request if needed
    if (config.responseType) {
      try {
        request.responseType = config.responseType;
      } catch (e) {
        // Expected DOMException thrown by browsers not compatible XMLHttpRequest Level 2.
        // But, this can be suppressed for 'json' type as it can be parsed by default 'transformResponse' function.
        if (config.responseType !== 'json') {
          throw e;
        }
      }
    }

    // Handle progress if needed
    if (typeof config.onDownloadProgress === 'function') {
      request.addEventListener('progress', config.onDownloadProgress);
    }

    // Not all browsers support upload events
    if (typeof config.onUploadProgress === 'function' && request.upload) {
      request.upload.addEventListener('progress', config.onUploadProgress);
    }

    if (config.cancelToken) { // 处理取消
      // Handle cancellation
      config.cancelToken.promise.then(function onCanceled(cancel) {
        if (!request) {
          return;
        }

        request.abort(); // 取消请求
        reject(cancel); // 抛出取消信息
        // Clean up request
        request = null;
      });
    }

    if (requestData === undefined) {
      requestData = null;
    }

    // Send the request
    request.send(requestData);
  });
};

```

### cancel

1. 在 `dispatchRequest` 流程中，多次确认是否请求已取消的操作，如有肯定就不再往下执行了。
2. 在适配器流程中，也就是在跨域请求发送前，此时检测用户是否定义取消请求，如取消，则通过已异步完成的 `config.cancelToken.promise` 的回调函数 `onCanceled` 来执行取消请求。

```js
if (config.cancelToken) {
  // Handle cancellation
  config.cancelToken.promise.then(function onCanceled(cancel) {
    if (!request) {
      return;
    }

    request.abort(); // 取消请求
    reject(cancel); // 抛出取消信息
    // Clean up request
    request = null;
  });
}
```

其中这以上片段中检测的是 `config.cancelToken`，`config` 对象下的 `cancelToken` 属性是在 `mergeConfig` 的过程中被添加进了 `config`，意思也是暴露出去由用户侧书写该属性。

在 `CancelToken.js` 中有指出如下设定:

```js
// 先初始化
const CancelToken = axios.CancelToken;
const source = CancelToken.source();
source.cancel(message);

// 再在跨域请求中写入 config
axios.get('/get/server', {
  cancelToken: source.token
}).catch(function (err) {
  if (axios.isCancel(err)) {
    console.log('Request canceled', err.message);
  } else {
    // handle error
  }
});
```

> 参照以上书写，可以直接对 `sandbox/client.html` 的 `axios` 请求改造用于取消模块的调试

从上得知，我们要定义取消请求的操作，必须先通过 `axios.CancelToken` 上定义的 `source` 方法来初始化，再传入我们想要取消时抛出的信息 `message`

#### cancel/CancelToken.js

1. `source` 方法首先定义 `cancel`，再初始化 `CancelToken` 实例赋值给 `token`，同时传入一个执行器函数，执行器函数的参数被赋值给 `cancel`，最后将 `cancel` 和 `token` 压入一个对象返回。
2. 再来看 `CancelToken` 构造函数，首先检测传入的参数是否为函数（用户可以直接传参），如不是则抛出错误（接上传入的是执行器函数 `executor(c)`）。
3. 接着创建一个 `promise` 对象，将 `resolve` 权限移出。
4. 定义 `token` ，给赋值当前的 `CancelToken` 对象。
5. 执行器函数 `executor` 传入 `cancel` 函数（参数）直接执行，函数体内语句即是 `cancel = f cancel(message)`，`source` 函数体中的 `cancel` 就可以利用闭包的原理获取 `CancelToken` 函数内的变量：`token`、`resolvePromise`，并定义了 `token.reason`，实际上也是保留 `CancelToken` 的 `this`，`this.reason` 被赋值错误信息对象，再将之前的 `promise` 对象转为完成状态，并传递错误信息对象，**等待适配器异步请求发送之前检测调用**。
6. 至此 `CancelToken` 实例生成，赋值给 `token`，此时的 `token` 和之前通过闭包获得值的 `cancel` 函数合并到一个对象返回，如下

```js
// 建议先按上方步骤看完 CancelToken 函数和 CancelToken.source 方法整个流程

// const source = CancelToken.source();
// source 初始化完成后，结构为：
{
  token: {
    promise: newPromise(function(resolve){
      resolve({ message: message})
    }),
    reason: { message: message }
  },
  cancel: function cancel(message) {
    if (token.reason) {
      return;
    }
    token.reason = { message: message };
  }
}
```

实际上用户侧初始化时是分**两步**走：

```js
//第一步执行 source 函数
const source = axios.CancelToken.source();
// 生成如下对象：暂无 reason，且 resolvePromise 也未执行
{
  token: {
    promise: newPromise(function(resolve){
      resolve({ message: message})
    })
  },
  cancel: function cancel(message) {
    if (token.reason) {
      return;
    }
    token.reason = { message: message };
  }
}

 // 第二步
source.cancel(message);
// 此时 source 对象才完整
```

`CancelToken.js` 文件源码：

```js
// lib/cancel/CancelToken.js

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
  executor(function cancel(message) { // source() 初始化时暂无 reason，调用 cancel(m) 后 
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
```

#### cancel/Cancel.js

`Cancel` 作为构造函数被用来生成一个对象，存储传入的取消信息

```js
// lib/cancel/Cancel.js

'use strict';

/**
 * A `Cancel` is an object that is thrown when an operation is canceled.
 *
 * @class
 * @param {string=} message The message.
 */
function Cancel(message) {
  this.message = message;
}

Cancel.prototype.toString = function toString() {
  return 'Cancel' + (this.message ? ': ' + this.message : '');
};

Cancel.prototype.__CANCEL__ = true;

module.exports = Cancel;
```

最后，整个 `axios` 大的框架梳理过一遍，对于初始化流程，重要部分的触发流程已详尽说明。文档按照从头至尾的顺序书写，相信到尾就可理解 `axios` 的源码

# 参考

学习 axios 源码整体架构-若川 ：https://mp.weixin.qq.com/s/GNYpgHo97xml0NxT93dHxQ
创建 axios 对象 ：https://www.cnblogs.com/hahazexia/p/9994209.html