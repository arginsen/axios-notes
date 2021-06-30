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
