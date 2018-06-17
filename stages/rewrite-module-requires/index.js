const { getModules, traverse } = require('../common');
const debug = require('debug')('styx:rewrite-module-requires');

module.exports = async function rewriteModuleRequires(modules, opts, [selector, mapping]) {
  const all = getModules(modules, selector).map(async mod => {
    let dependants, nodes;

    if (!mod.parameters) {
      return
    }

    // First, get all dependencies of module.
    try {
      const values = await this.moduleDependencies(mod);
      dependants = values.dependants;
      nodes = values.nodes;
    } catch (e) {
      debug(`Error parsing module ${mod.id} with styx.moduleDependencies: ${e.stack}`);
      return
    }

    // Then, replace each dependency with the value specified in the mapping.
    dependants.forEach((dependencyId, index) => {
      if (mapping[dependencyId]) {
        nodes[index].arguments[0].value = mapping[dependencyId];
      } else {
        debug(`Warning: require(${dependencyId}) in module ${mod.id} was not replaced, no mapping was specified.`);
        nodes[index].arguments[0].value = `./${nodes[index].arguments[0].value}`;
      }
    });
  });

  await Promise.all(all);

  return modules;
}
