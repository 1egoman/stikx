const estraverse = require('estraverse');
const { getModules, traverse } = require('../common');

module.exports = async function(modules, opts, [selector, params]) {
  const all = getModules(modules, selector).map(async mod => {
    if (!mod.parameters) {
      return;
    }

    // Create a list of parameter names for each module. This is used to quickly check if a variable
    // name is one of interest. Ie, this could be ['e', 't', 'n']
    const parameterNames = Object.values(mod.parameters).map(i => i.name);

    let currentScope = opts.scopeManager.acquire(mod.ast.node); // module scope

    // Update all references to all veriables defined in the module function
    // to `require`, `module`, and `exports`.
    traverse(mod.ast.body, {
      enter(node, parent, parentKey) {
        if (node.type === 'Identifier' && parameterNames.includes(node.name)) {

          // Find the variable by the name of the identifier in the current scope.
          const variable = currentScope.variables.find(i => i.name === node.name);

          // Ensure that the variable was defined in the module level scope.
          if (variable && variable.scope.block === mod.ast.node) {
            // Figure out what the variable should be renamed to - `module`, `exports`, or `require`.
            let newName = null;
            switch (variable.name) {
            case mod.parameters.module.name:
              newName = 'module';
              break;
            case mod.parameters.exports.name:
              newName = 'exports';
              break;
            case mod.parameters.require.name:
              newName = 'require';
              break;
            default: break;
            }

            // Rename each reference of the variable.
            variable.references.forEach(ref => {
              ref.identifier.name = newName;
            });
          }
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

    // Update the variable references in the module function's parameters
    if (mod.parameters.module) { mod.parameters.module.name = 'module'; }
    if (mod.parameters.exports) { mod.parameters.exports.name = 'exports'; }
    if (mod.parameters.require) { mod.parameters.require.name = 'require'; }
  });

  await Promise.all(all);
}
