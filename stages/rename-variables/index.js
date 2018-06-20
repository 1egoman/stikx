const estraverse = require('estraverse');
const { getModules, traverse } = require('../common');

module.exports = async function(modules, opts, [selector, {map}]) {
  return getModules(modules, selector).map(mod => {
    let currentScope = opts.scopeManager.acquire(mod.ast.node);

    traverse(mod.ast.body, {
      enter(node, parent, parentKey) {
        if (node && node.type === 'Identifier') {
          // const requireReference = currentScope.references
          //   .find(i => i.identifier.name === mod.parameters.require.name);

          currentScope.variables.forEach(variable => {
            if (variable.scope.block !== mod.ast.node) {
              const newName = map(variable.name);
              variable.references.forEach(reference => {
                reference.identifier.name = newName;
              });
            }
          })
        }

        if (node && /Function/.test(node.type)) {
          currentScope = opts.scopeManager.acquire(node);  // get current function scope
        }
      },
      leave(node, parent) {
        if (node && /Function/.test(node.type)) {
          currentScope = currentScope.upper;  // set to parent scope
        }
      },
    });
  });
}
