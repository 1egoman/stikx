const estraverse = require('estraverse');
const { getModules, traverse } = require('../common');

const COMMON_SYMBOLS = [
  '',
  'module',
  'object',
];

module.exports = async function(modules, opts, [selector]) {
  // An array of pairs, where each paid contains a module id and a guessed name
  // guessedNames = [ [0, 'NameGuess'], [1, null], ... ]:
  const guessedNames = getModules(modules, selector).map(mod => {
    const moduleInterestingPhrases = [];

    traverse(mod.ast.body, {
      enter(node, parent, parentKey) {
        if (node &&
          // Locate any string in the module
          node.type === 'Literal' && typeof node.value === 'string' &&
          // That is over five chars long
          node.value.length > 5 &&
          // And that has capitol letters in it
          node.value.toLowerCase() !== node.value
        ) {
          moduleInterestingPhrases.push(node.value);
        }
      },
    });

    const results = moduleInterestingPhrases
    .map(i => {
      return  i.match(/([A-Z][a-z]+)*/g) ||    /* First, try to find all pascalcase words */
              i.match(/[a-z]*([A-Z][a-z]+)*/g) /* Second, fallback to finding all camelcase words */
    })
    .reduce((acc, i) => [...acc, ...i], []) /* Flatten nested arrays */
    .filter(i => !COMMON_SYMBOLS.includes(i.toLowerCase())) /* Exclude common symbols */

    if (results.length === 0) {
      return [mod.id, null];
    }

    const resultLengths = results.map(r => r.length);
    const maxResultLengthIndex = resultLengths.indexOf(Math.max.apply(Math, resultLengths));
    return [mod.id, results[maxResultLengthIndex]];
  });

  // Convert array of pairs into object
  return guessedNames.reduce(
    (acc, [key, value]) => ({...acc, [key]: value}),
    {},
  );
}
