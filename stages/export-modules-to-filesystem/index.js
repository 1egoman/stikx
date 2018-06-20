const fs = require('fs');
const path = require('path');

const { getModules } = require('../common');
const jsbeautify = require('js-beautify');
const lebab = require('lebab');

const escodegen = require('escodegen');
const mkdirp = require('mkdirp-promise');

module.exports = async function(modules, opts, [params]) {
  if (!params.location) {
    throw new Error('A .location value is a required parameter for export-modules-to-filesystem');
  }

  // Store the module mapping for later
  opts.moduleMapping = params.mapping;
  opts.exportLocationDir = params.location;

  const all = (params.selector ? getModules(modules, params.selector) : modules).map(async mod => {
    // Generate a filepath to the new module.
    const moduleName = (params.mapping ? params.mapping[mod.id] : false) || `${mod.id}.js`;
    let modulePath = path.join(params.location, moduleName);

    // Prepend with the value of `.` if the path specified is not an absolute path.
    if (!path.isAbsolute(modulePath)) {
      modulePath = path.join(path.resolve('.'), modulePath);
    }

    const contents = mod.ast[params.astType || 'node'] ? escodegen.generate(mod.ast[params.astType || 'node']) : '';
    let prettyContents;

    // Optionally, use lebab to try to reverse some babel compilation.
    if (params.useLebab) {
      let {code, warnings} = lebab.transform(contents, params.lebabTransforms || ['let', 'arrow']);

      // If lebabSkipIfWarnings is on and there are warnings, then don't use the lebab'd code
      if (warnings.length > 0 && params.lebabSkipIfWarnings) {
        code = contents;
      }

      prettyContents = jsbeautify(code || contents, { indent_size: 2 });
    } else {
      prettyContents = jsbeautify(contents, { indent_size: 2 });
    }

    // Make directory for module to reside in
    await mkdirp(path.dirname(modulePath));

    // Write module to filesystem
    await new Promise((resolve, reject) => {
      fs.writeFile(modulePath, prettyContents, err => {
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
