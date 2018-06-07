const fs = require('fs');
const path = require('path');

const camelCase = require('camelcase');
const acorn = require('acorn');

const Logger = require('./logger');

const pwd = __dirname;

const modules = [];
const opts = {};


const bundle = fs.readFileSync(path.join(pwd, '..', 'build-bundle', 'bundle.js'));

opts.ast = acorn.parse(bundle);


module.exports = {
  get modules() {
    return modules;
  },
  get opts() {
    return opts;
  }
};

const dirs = fs.readdirSync(pwd)
  .filter(i => fs.lstatSync(path.join(pwd, i)).isDirectory() && fs.existsSync(path.join(pwd, i, 'index.js')))
  .forEach(i => {
    const fn = require(path.join(pwd, i));
    module.exports[camelCase(i)] = (...args) => {
      Logger.start(`Step ${i}`);
      const ret = fn.apply(module.exports, [modules, opts, args]);
      return ret;
    }
  });
