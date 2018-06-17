const fs = require('fs');
const path = require('path');

const camelCase = require('camelcase');
const acorn = require('acorn');

const escope = require('escope');

const pwd = __dirname;

const modules = [];
const opts = {};


const bundle = fs.readFileSync(path.join(pwd, '..', 'build-bundle', 'bundle.js'));

opts.ast = acorn.parse(bundle);

opts.scopeManager = escope.analyze(opts.ast);
opts.scopeManager.acquire(opts.ast); // global scope


module.exports = {
  get modules() {
    return modules;
  },
  get opts() {
    return opts;
  },

  ALL: 'all',
};

const dirs = fs.readdirSync(pwd)
  .filter(i => fs.lstatSync(path.join(pwd, i)).isDirectory() && fs.existsSync(path.join(pwd, i, 'index.js')))
  .forEach(i => {
    const fn = require(path.join(pwd, i));
    module.exports[camelCase(i)] = (...args) => {
      const ret = fn.apply(module.exports, [modules, opts, args]);
      return ret;
    }

    for (let property in fn) {
      module.exports[camelCase(i)][property] = fn[property];
    }
  });
