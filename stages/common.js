const acorn = require('acorn');
const flatten = require('lodash.flatten');

const noop = () => false;

exports.traverse = function traverse(node, fn, path=[], parent=null, parentKey=null) {
  let enterFn = fn, leaveFn = noop;
  if (fn.enter) {
    enterFn = fn.enter;
    leaveFn = fn.leave;
  }

  const potentialModuleArrays = [],
        enterResult = enterFn(node, parent, parentKey);

  if (enterResult && enterResult.type) { /* a single node */
    Object.assign(node, enterResult);

  } else if ( /* an array of nodes */
    parentKey &&
    Array.isArray(parent[parentKey]) &&
    Array.isArray(enterResult)
  ) {
    const nodeIndex = parent[parentKey].indexOf(node);
    
    // Remove node at nodeIndex
    parent[parentKey].splice(nodeIndex, 1);

    // Add all nodes to parent
    enterResult.reverse().forEach(n => {
      parent[parentKey].splice(nodeIndex, 0, n);
    });

  } else if (enterResult === true) {
    potentialModuleArrays.push({value: node, path});
  }

  // Traverse into nodes further down the tree.
  let resultantModuleArrays = [];
  node && Object.keys(node).forEach(key => {
    if (Array.isArray(node[key])) {
      // Perform a map, but ensure that if keys are added in the `traverse` call, that we loop over
      // those new keys too.
      const all = [];
      for (let i = 0; i < node[key].length; i++) {
        all.push(
          traverse(node[key][i], fn, [...path, key, i], node, key)
        );
      }

      resultantModuleArrays = [...resultantModuleArrays, ...all];
    } else if (node[key] && node[key].type) {
      resultantModuleArrays = [
        ...resultantModuleArrays,
        traverse(node[key], fn, [...path, key], node, key),
      ];
    }
  });

  leaveFn(node, parent, parentKey);

  return flatten([
    ...potentialModuleArrays,
    ...resultantModuleArrays,
  ]);
}

exports.getModules = function getModules(modules, selector) {
  if (typeof selector === 'number') { /* pass a single id */
    return [modules.find(i => i.id === selector)];
  } else if (selector && typeof selector.id === 'number') { /* pass a single module */
    return [selector];
  } else if (
    Array.isArray(selector) &&
    selector.every(i => typeof i === 'number')
  ) { /* array of ids */
    return selector.map(i => modules.find(j => j.id === i));
  } else if (
    Array.isArray(selector) &&
    selector.every(i => i && typeof i.id === 'number')
  ) { /* array of modules */
    return selector;
  } else if (selector.toLowerCase() === 'all') { /* all modules */
    return modules;
  } else {
    throw new Error(`Undefined module selector ${selector}`);
  }
}
