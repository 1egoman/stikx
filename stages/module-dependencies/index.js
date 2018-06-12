const estraverse = require('estraverse');

class NullParametersError extends Error {}

module.exports = async function(modules, opts, [mod]) {
  if (mod.parameters === null) {
    throw new NullParametersError('Cannot parse a module with null parameters.');
  }

  // No require parameter, so module must not have any dependancies.
  if (!mod.parameters.require) {
    return {dependants: [], nodes: []};
  }

  let dependants = [], nodes = [];

  let currentScope = opts.scopeManager.acquire(mod.ast.node);

  estraverse.traverse(mod.ast.body, {
    enter(node, parent) {
      if (
        (node.type === 'Identifier' && node.name === mod.parameters.require.name) &&
        (parent && parent.type === 'CallExpression') &&
        parent.arguments.length === 1
      ) {
        const modId = parent.arguments[0].value;
        dependants.push(modId);
        nodes.push(parent);
      }

      if (/Function/.test(node.type)) {
        currentScope = opts.scopeManager.acquire(node);  // get current function scope
      }
    },
    leave(node, parent) {
      if (/Function/.test(node.type)) {
        currentScope = currentScope.upper;  // set to parent scope
      }
    },
  });

  return {dependants, nodes};
}

module.exports.NullParametersError = NullParametersError;
