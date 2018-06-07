const chalk = require('chalk');

module.exports = {
  lastStep: null,
  start(step) {
    console.log(`* ${step}\t${chalk.cyan('working...')}`);
    this.lastStep = step;
  },
  log(msg) {
    console.log(`* ${msg}`);
  },
  success(message='', step=false) {
    let messageBreakWidth = 80 - (step || this.lastStep).length;
    let inlineMessage = '';
    if (message.length > 0 && message.length < messageBreakWidth) {
      inlineMessage = `: ${message}`;
    }
    console.log(`* ${step || this.lastStep}\t${chalk.bold.green('done')}${inlineMessage}`);

    if (message.length > 0 && message.length >= messageBreakWidth) {
      console.log(message);
    }
  },
  fail(message='', step=false) {
    let messageBreakWidth = 80 - (step || this.lastStep).length;
    let inlineMessage = '';
    if (message.length > 0 && message.length < messageBreakWidth) {
      inlineMessage = `: ${message}`;
    }
    console.log(`* ${step || this.lastStep}\t${chalk.bold.red('fail')}${inlineMessage}`);

    if (message.length > 0 && message.length >= messageBreakWidth) {
      console.log(message);
    }
  },
}

