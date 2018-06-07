const Logger = require('../logger');
const { traverse } = require('../common');

module.exports = async function(modules, opts) {
  function isArrayWithFunctionsInside(node) {
    return  node && node.type === 'ArrayExpression' &&
            node.elements.length > 0 &&
            node.elements.every(e => {
              return e === null || (e && e.type === 'FunctionExpression')
            });
  }

  const values = traverse(opts.ast, isArrayWithFunctionsInside);
  if (values.length === 0) {
    Logger.fail(`No potential module arrays found!`);
  } else {
    Logger.success(`found ${values.length} potential, picking longest`);
  }

  const valueLengths = values.map(({path, value}) => value.elements.length);
  opts.moduleList = values[valueLengths.indexOf(Math.max.apply(Math, valueLengths))];
}
