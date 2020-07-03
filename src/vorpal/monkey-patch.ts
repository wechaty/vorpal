import 'vorpal'
const util = require('vorpal/util')

const ui = (global as any).__vorpal.ui.exports

if (!ui) {
  throw new Error('Vorpal monkey patch: can not find `global.__vorpal.ui.exports` after imported vorpal module.')
}

function monkeyPatch (
  logArgsList: any[][],
) {
  ui.log = function log () {
    let args = util.fixArgsForApply(arguments)
    args = typeof this._pipeFn === 'function'
      ? this._pipeFn(args)
      : args
    if (args === '') {
      return this
    }
    args = util.fixArgsForApply(args)
    if (this.midPrompt()) {
      const data = this.pause()
      logArgsList.push(args)
      if (typeof data !== 'undefined' && data !== false) {
        this.resume(data)
      } else {
        logArgsList.push(['Log got back \'false\' as data. This shouldn\'t happen.', data])
      }
    } else {
      logArgsList.push(args)
    }
    return this
  }
}

export { monkeyPatch }
