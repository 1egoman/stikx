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
        // Ensure that the variable that's being used hasn't been overwritten
        // For examole, we want o detect the first 'foo', but not the second.
        // function(foo) {
        //   foo(1)              <- Want this one
        //   return function() {
        //     let foo = () => 0
        //     foo()             <- Don't want this one, the `foo` reference isn't from the module
        //   }
        // }

        // const requireReference = currentScope.references
        //   .find(i => i.identifier.name === mod.parameters.require.name);
        //
        // const wasDefinedInModuleWrappingFn = requireReference && (
        //   // Compare starting and ending characters of both blocks to test equality
        //   requireReference.from.block.start === mod.ast.node.start &&
        //   requireReference.from.block.end === mod.ast.node.end
        // );
        //
        // if (wasDefinedInModuleWrappingFn) {
        //   const modId = parent.arguments[0].value;
        //   dependants.push(modId);
        //   nodes.push(parent);
        // }

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
