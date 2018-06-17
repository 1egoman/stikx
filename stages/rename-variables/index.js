const estraverse = require('estraverse');
const { getModules, traverse } = require('../common');

const escodegen = require('escodegen');

module.exports = async function(modules, opts, [selector, {map}]) {
  return getModules(modules, selector).map(mod => {
    let currentScope = opts.scopeManager.acquire(mod.ast.node);

    traverse(mod.ast.body, {
      enter(node, parent, parentKey) {
        if (node && node.type === 'Identifier') {
          // const requireReference = currentScope.references
          //   .find(i => i.identifier.name === mod.parameters.require.name);

          currentScope.variables.forEach(variable => {
            const newName = map(variable.name);
            variable.references.forEach(reference => {
              reference.identifier.name = newName;
            });
          })
        }

        // Convert multi-expression returns into expressions, then a return
        // ie, return 1, 2, 3 converts to 1; 2; return 3
        if (
          node && node.type === 'ReturnStatement' &&
          node.argument && /* exclude `return null` */
          node.argument.type === 'SequenceExpression'
        ) {
          const expressions = node.argument.expressions;
          return expressions.map((expression, index) => {
            if (index === expressions.length-1) {
              return Object.assign({}, node, {argument: expression});
            } else {
              return expression;
            }
          });
        }

        // Convert multi-expression variable declarations into many variable declarations.
        // ie, var a = 1, b = 2 converts to var a = 1; var b = 2
        if (node && node.type === 'VariableDeclaration' && Array.isArray(parent[parentKey])) {
          const declarations = node.declarations.slice();
          return declarations.map(declaration => Object.assign({}, node, {declarations: [declaration]}));
        }

        // Convert long sequence expressions into a bunch of expressions
        // ie, `foo(), bar(), 1` into `foo(); bar(); 1`
        if (node && node.type === 'ExpressionStatement' && node.expression.type === 'SequenceExpression' && parent.body) {
          const expressions = node.expression.expressions;
          return expressions.map(expression => Object.assign({}, node, {expression}));
        }

        // Convert !0 into true
        if (node && node.type === 'UnaryExpression' && node.operator === '!' && node.argument.type === 'Literal' && node.argument.value === 0) {
          return { type: 'Literal', value: true, raw: 'true' };
        }

        // Convert !1 into false
        if (node && node.type === 'UnaryExpression' && node.operator === '!' && node.argument.type === 'Literal' && node.argument.value === 1) {
          return { type: 'Literal', value: false, raw: 'false' };
        }

        // Replace void 0 with undefined
        if (node && node.type === 'UnaryExpression' && node.operator === 'void') {
          return { type: 'Identifier', name: 'undefined' };
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
