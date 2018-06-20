const debug = require('debug')('styx:find-modules');
const { traverse } = require('../common');

function processParameters(element) {
  const count = element.params.length;

  if (count === 0) {
    return {count: 0, parameters: []};
  } else {
    // Three choices: `module`, `exports`, and `require`. Figure out which is which.
    // Notes:

    const likelyhoods = {
      module: element.params.map(_ => 0),
      exports: element.params.map(_ => 0),
      require: element.params.map(_ => 0),
    };

    // Usually the order is `module, exports, require`. So weight them such that this is
    // the base case.
    if (typeof likelyhoods.module[0] !== 'undefined') likelyhoods.module[0] += 5;
    if (typeof likelyhoods.exports[1] !== 'undefined') likelyhoods.exports[1] += 5;
    if (typeof likelyhoods.require[2] !== 'undefined') likelyhoods.require[2] += 5;

    // require is called, the others aren't. So if a value is called, then it's more
    // likely to be require.
    traverse(element.body, node => {
      if (!node || node.type !== 'CallExpression') {
        return;
      }

      for (let i = 0; i < element.params.length; i++) {
        if (node.callee.name === element.params[i].name) {
          likelyhoods.require[i] += 1
        }
      }
    });

    // Look for a `whatever.exports` sequence. If it exists, that symbol is probably
    // `module`.
    traverse(element.body, node => {
      if (!(
        node &&
        node.type == 'MemberExpression' &&
        node.property.type === 'Identifier' &&
        node.property.name === 'exports'
      )) {
        return;
      }

      for (let i = 0; i < element.params.length; i++) {
        if (node.object.name === element.params[i].name) {
          likelyhoods.module[i] += 1
        }
      }
    });

    // Use calculated likelihoods to pick `module`, `exports`, and `require` candidates.
    const mostLikelyToBeModule = element.params[likelyhoods.module.indexOf(Math.max.apply(Math, likelyhoods.module))];
    const mostLikelyToBeExports = element.params[likelyhoods.exports.indexOf(Math.max.apply(Math, likelyhoods.exports))];
    const mostLikelyToBeRequire = element.params[likelyhoods.require.indexOf(Math.max.apply(Math, likelyhoods.require))];

    return {
      count,
      module: mostLikelyToBeModule,
      exports: mostLikelyToBeExports,
      require: mostLikelyToBeRequire,
    }
  }
}

module.exports = async function(modules, opts) {
  debug(`Bundle contains ${opts.moduleList.value.elements.length} modules.`);

  opts.moduleList.value.elements.forEach((element, index) => {
    switch (true) {

    case element && element.type.indexOf('Function') === 0:
      debug(`Module ${index} is a Function`);
      modules.push({
        id: index,
        parameters: processParameters(element),
        ast: {
          node: element,
          body: element.body,
        },
      });
      break;

    case element === null || (element.type === 'Literal' && element.value === null):
      debug(`Module ${index} is null`);
      modules.push({
        id: index,
        parameters: null,
        ast: {
          node: null,
          body: null,
        },
      });
      break;

    default:
      debug(`Unknown module ast node type for module ${index}: ${element.type}`);
      break;
    }
  });
}
