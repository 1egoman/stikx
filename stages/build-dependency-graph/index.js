const estraverse = require('estraverse');
const escope = require('escope');

const CACHE = {};

module.exports = async function(modules, opts, [mod]) {
  if (CACHE[mod.id]) {
    return CACHE[mod.id];
  }

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

  CACHE[mod.id] = dependants;
  return dependants;
}
