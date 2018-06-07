const acorn = require('acorn');
const flatten = require('lodash.flatten');

const estraverse = require('estraverse');
const escope = require('escope');

exports.traverse = function traverse(node, fn, path=[]) {
  const potentialModuleArrays = [];
  if (fn(node)) {
    potentialModuleArrays.push({value: node, path});
  }

  // Traverse into nodes further down the tree.
  let resultantModuleArrays = [];
  node && Object.keys(node).forEach(key => {
    if (Array.isArray(node[key])) {
      resultantModuleArrays = [
        ...resultantModuleArrays,
        ...node[key].map((e, i) => traverse(e, fn, [...path, key, i])),
      ];
    } else if (node[key] instanceof acorn.Node) {
      resultantModuleArrays = [
        ...resultantModuleArrays,
        traverse(node[key], fn, [...path, key]),
      ];
    }
  });

  return flatten([
    ...potentialModuleArrays,
    ...resultantModuleArrays,
  ]);
}

exports.getDependantModules = function getDependantModules(ast, mod) {
  if (mod.parameters === null) {
    throw new Error('Cannot parse a module with null parameters.');
  }

  // No require parameter, so module must not have any dependancies.
  if (!mod.parameters.require) {
    return {};
  }

  let dependants = {};

  const scopeManager = escope.analyze(ast);
  scopeManager.acquire(ast); // global scope

  let currentScope = scopeManager.acquire(mod.ast.node);

  estraverse.traverse(mod.ast.body, {
    enter(node, parent) {
      if (
        (node.type === 'Identifier' && node.name === mod.parameters.require.name) &&
        (parent && parent.type === 'CallExpression') &&
        parent.arguments.length === 1
      ) {
        const modId = parent.arguments[0].value;
        if (dependants[modId]) {
          dependants[modId].push(parent);
        } else {
          dependants[modId] = [parent];
        }
      }

      if (/Function/.test(node.type)) {
          currentScope = scopeManager.acquire(node);  // get current function scope
      }
    },
    leave(node, parent) {
      if (/Function/.test(node.type)) {
          currentScope = currentScope.upper;  // set to parent scope
      }
    }
  });

  return dependants;
}
