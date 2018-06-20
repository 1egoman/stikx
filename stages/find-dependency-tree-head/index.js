const estraverse = require('estraverse');
const debug = require('debug')('styx:find-dependency-tree-head');

/* Find the module at the head of the module depedency tree.
 *
 * The head module is defined as:
 * - A module that is not depended on by any other module.
 * - A module that can `require` in other modules.
 */
module.exports = async function(modules, opts, [mod]) {
  let notHeadModules = [];

  // Calculate array of dependencies of other modules.
  const all = modules.map(async mod => {
    try {
      const { dependants } = await this.moduleDependencies(mod);
      debug(`Completed parsing module ${mod.id}, has dependants of ${dependants}`);
      notHeadModules = [...notHeadModules, ...dependants];
    } catch (e) {
      debug(`Error in parsing module dependencies, continuing... ${e.stack}`);
      return
    }
  });

  await Promise.all(all);

  const moduleHeadPossibilities = modules.filter(mod =>
    !notHeadModules.includes(mod.id) &&
    mod.parameters
  );

  if (moduleHeadPossibilities.length === 1) {
    opts.headModule = moduleHeadPossibilities[0];
    return {success: true, value: moduleHeadPossibilities[0]};
  } else {
    opts.headModuleChoices = moduleHeadPossibilities.sort((a, b) => {
      // Sort from smallest module to largest. Webpack tends to make a smaller entrypoint that
      // requires in the real entrypoint.
      return JSON.stringify(a.ast.body).length - JSON.stringify(b.ast.body).length;
    });
    return { success: false, choices: opts.headModuleChoices };
  }
}
