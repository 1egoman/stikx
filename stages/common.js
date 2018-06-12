const acorn = require('acorn');
const flatten = require('lodash.flatten');

exports.traverse = function traverse(node, fn, path=[]) {
  const potentialModuleArrays = [];
  if (fn(node)) {
    potentialModuleArrays.push({value: node, path});
  }

  // Traverse into nodes further down the tree.
  let resultantModuleArrays = [];
  node && Object.keys(node).forEach(key => {
    if (Array.isArray(node[key])) {
      resultantModuleArrays = [
        ...resultantModuleArrays,
        ...node[key].map((e, i) => traverse(e, fn, [...path, key, i])),
      ];
    } else if (node[key] instanceof acorn.Node) {
      resultantModuleArrays = [
        ...resultantModuleArrays,
        traverse(node[key], fn, [...path, key]),
      ];
    }
  });

  return flatten([
    ...potentialModuleArrays,
    ...resultantModuleArrays,
  ]);
}

