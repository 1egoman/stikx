const fs = require('fs');
const path = require('path');

const { getModules } = require('../common');

const escodegen = require('escodegen');
const mkdirp = require('mkdirp-promise');

module.exports = async function(modules, opts, [params]) {
  if (!params.location) {
    throw new Error('A .location value is a required parameter for export-modules-to-filesystem');
  }

  const all = (params.selector ? getModules(modules, params.selector) : modules).map(async mod => {
    // Generate a filepath to the new module.
    const moduleName = (params.mapping ? params.mapping[mod.id] : false) || `${mod.id}.js`;
    let modulePath = path.join(params.location, moduleName);

    // Prepend with the value of `.` if the path specified is not an absolute path.
    if (!path.isAbsolute(modulePath)) {
      modulePath = path.join(path.resolve('.'), modulePath);
    }

    const contents = mod.ast[params.astType || 'node'] ? escodegen.generate(mod.ast[params.astType || 'node']) : '';

    // Make directory for module to reside in
    await mkdirp(path.dirname(modulePath));

    // Write module to filesystem
    await new Promise((resolve, reject) => {
      fs.writeFile(modulePath, contents, err => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      })
    });
  });

  await Promise.all(all);
}
