const fs = require('fs');
const path = require('path');

const acorn = require('acorn');
const escope = require('escope');

const inquirer = require('inquirer');
const camelCase = require('camelcase');
const chalk = require('chalk');
const mkdirp = require('mkdirp-promise');

const pwd = __dirname;

const STAGES = fs.readdirSync(pwd)
  .filter(i => fs.lstatSync(path.join(pwd, i)).isDirectory() && fs.existsSync(path.join(pwd, i, 'index.js')))

class Stikx {
  constructor(bundle, options={}) {
    this.modules = [];
    this.opts = {};
    this._logStartCursorPosition = {};

    if (typeof bundle !== 'string') {
      throw new Error('The bundle path is a required argument.');
    }

    this.bundleFilePath = bundle;
    this.bundle = fs.readFileSync(bundle);

    this.opts.ast = acorn.parse(this.bundle);

    this.opts.scopeManager = escope.analyze(this.opts.ast);
    this.opts.scopeManager.acquire(this.opts.ast); // global scope

    // Add all stages to this class dynamically.
    STAGES.forEach(i => {
      const fn = require(path.join(pwd, i));
      this[camelCase(i)] = (...args) => {
        const ret = fn.apply(this, [this.modules, this.opts, args]);
        return ret;
      }

      for (let property in fn) {
        this[camelCase(i)][property] = fn[property];
      }
    });
  }

  async ask(message, choices) {
    return inquirer.prompt([
      {
        type: 'rawlist',
        name: 'result',
        message,
        choices,
        validate(result) {
          if (!result) {
            return 'Please pick a choice.';
          } else {
            return true;
          }
        },
      },
    ]).then(answers => {
      return answers.result;
    });
  }

  logStart(taskName) {
    console.log(`Starting ${chalk.cyan(taskName)}...`);
    this.startTimestamp = new Date().getTime();
    this.lastTaskName = taskName;
  }
  logEnd(taskName=this.lastTaskName) {
    const elapsed = Math.round((new Date().getTime() - this.startTimestamp)) / 1000;
    console.log(`Completed ${chalk.cyan(taskName)}, took ${elapsed} seconds.`);
  }

  printReport() {
    console.log(this.sprintReport());
  }
  sprintReport() {
    if (!this.modules || this.modules.length === 0) {
      throw new Error('Please run .extractModules prior to running a report.');
    }
    if (!(this.opts.headModule || this.opts.headModuleChoices)) {
      throw new Error('Please run .findDependencyTreeHead prior to running a report.');
    }

    const getModulePath = mod => path.join(
      this.opts.exportLocationDir,
      this.opts.moduleMapping[mod.id] || `${mod.id}.js`,
    );

    return [
      ``,
      `# Report for ${chalk.green(this.bundleFilePath)}:`,
      ``,

      /* MODULE COUNT */
      `This bundle contains ${chalk.cyan(this.modules.length)} modules:`,
      `  - ${chalk.cyan(this.modules.filter(i => i.parameters === null).length)} modules are null`,
      `  - ${chalk.cyan(this.modules.filter(i => i.parameters && i.parameters.count < 3).length)} modules don't include a require function in their signature,`,
      `    and are "leafs" on the dependency tree`,
      ``,

      /* ENTRYPOINT */
      ...(this.opts.headModule ? [
        `A single entrypoint was found in this bundle, which has the module id of ${chalk.cyan(this.opts.headModule.id)}.`,
        `This module can be found on disk at ${chalk.cyan(getModulePath(this.opts.headModule))}`,
        ``,
        `If you want to attempt to re-bundle this code (which isn't guaranteed to work!), you'd`,
        `tell your bundling software to start at this module.`
      ] : [
        `A single entrypoint wasn't found--the huristic used isn't perfect. It's likely one of the`,
        `below is the module's entrypoint, ordered from most to least likely:`,
        ...this.opts.headModuleChoices.map(mod => (
          `  - Module ${chalk.cyan(mod.id)}, found at ${chalk.cyan(getModulePath(mod))}`
        )),
      ]),
      ``,
    ].join('\n')
  }
}

async function init(bundlePath) {
  console.log('Welcome to Stikx!');
  const answers = await inquirer.prompt([
    {
      type: 'list',
      name: 'cleanUpWebpack',
      message: 'Attempt to clean up webpack optimizations?',
      choices: ['Yes', 'No'],
      validate(result) {
        if (!result) {
          return 'Please pick a choice.';
        } else {
          return true;
        }
      },
    },
    {
      type: 'list',
      name: 'includeModuleFunction',
      message: 'When exporting modules in bundle to disk, include the wrapping function?',
      choices: ['Yes', 'No'],
      validate(result) {
        if (!result) {
          return 'Please pick a choice.';
        } else {
          return true;
        }
      },
    },
    {
      type: 'list',
      name: 'useLebab',
      message: 'Use lebab to attempt to reverse any babel transpilation? This is experimental.',
      choices: ['Yes', 'No'],
      validate(result) {
        if (!result) {
          return 'Please pick a choice.';
        } else {
          return true;
        }
      },
    },
    {
      type: 'text',
      name: 'renameEntrypoint',
      message: 'Should the bundle entrypoint be renamed? Leave blank to not rename.',
    },
  ]);

  const bundleBasename = path.basename(bundlePath).replace('.', '-').replace('/', '/');
  const bundleDir = path.join(process.cwd(), bundleBasename);

  console.log('INIT!', bundleBasename, bundleDir);
  await mkdirp(bundleDir);

  console.log('Write package.json');
  const packageJson = fs.createWriteStream(path.join(bundleDir, 'package.json'));
  packageJson.write(JSON.stringify({
    name: bundleBasename,
    version: '0.0.1',
    description: `Project to reverse engineer ${bundlePath}`,
    dependencies: {
      stikx: require('../package').version,
    },
  }, null, 2));

  console.log('Write bundle');
  const bundle = fs.createWriteStream(path.join(bundleDir, 'bundle.js'));
  fs.createReadStream(bundlePath).pipe(bundle);

  fs.createWriteStream(path.join(bundleDir, 'stikx.js')).write(`const Stikx = require('stikx');
const path = require('path');

const stikx = new Stikx(path.join(__dirname, 'bundle.js'));

// The directory stikx should output all modules that it extracts from
// the bundle. Will be created if it doesn't exist.
const OUTPUT_DIR = './output';

// A mapping of module id to module path. Can be used to give a given module a particular name.
const MODULE_NAME_MAPPING = {
  /* 10: './path/to/module.js', */
};

async function main() {
  stikx.logStart('Finding modules');
  await stikx.findModules()
  stikx.logEnd();

  stikx.logStart('Extracting modules');
  await stikx.extractModules()
  stikx.logEnd();

  stikx.logStart('Locating entrypoint module');
  const entrypoint = await stikx.findDependencyTreeHead();
  stikx.logEnd();

  ${answers.cleanUpWebpack ? [
    `stikx.logStart('Cleaning up webpack optimizations');`,
    `  await stikx.sanitize('all');`,
    `  stikx.logEnd();`,
  ].join('\n') : ''}

  stikx.logStart('Renaming modules');
  ${answers.renameEntrypoint ? [
    `if (entrypoint.success) {`,
    `    console.log(\`Mapping \${entrypoint.value.id} to ./entrypoint.js\`);`,
    `    MODULE_NAME_MAPPING[entrypoint.value.id] = './entrypoint.js';`,
    `  }`,
  ].join('\n') : ''}
  await stikx.rewriteModuleRequires('all', MODULE_NAME_MAPPING);
  stikx.logEnd();

  stikx.logStart('Renaming module parameters to module, exports, and require');
  await stikx.renameModuleParameters('all', {
    require: true,
    module: true,
    exports: true,
  });
  stikx.logEnd();

  stikx.logStart(\`Exporting to \${OUTPUT_DIR}\`);
  await stikx.exportModulesToFilesystem({
    location: OUTPUT_DIR,
    mapping: MODULE_NAME_MAPPING,

    astType: ${answers.includeModuleFunction ? `'node'` : `'body'`}

    ${answers.useLebab ? [
      `useLebab: true,`,
      `    lebabTransforms: ['let', 'arrow', 'class'],`,
      `    lebabSkipIfWarnings: false,`,
    ].join('\n') : ''}
  });
  stikx.logEnd();

  stikx.printReport();

}
main().catch(e => console.error(e.stack));`
  );
}


module.exports = Stikx;
module.exports.init = init;
