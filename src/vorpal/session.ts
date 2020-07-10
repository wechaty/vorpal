/* eslint-disable sort-keys */
import { EventEmitter } from 'events'
import stripAnsi    from 'strip-ansi'

import * as utils from './utils/mod'

import { CommandInstance } from './command-instance'
import { Vorpal } from './vorpal'
import { ObsIo } from '../vorpal-io'

interface CommandResponse {
  error?: Error;
  data?: any;
  args?: any;
}

export class Session extends EventEmitter {

  private _registeredCommands?: number;
  private _completedCommands?: number;
  private _commandSetCallback: any;

  /**
   * Compatible with old code
   */
  public parent: Vorpal

  public _pipeFn?: Function

  /**
   * Initialize a new `Session` instance.
   *
   * @param {String} name
   * @return {Session}
   * @api public
   */

  constructor (
    public vorpal: Vorpal,
    public obsio?: ObsIo,
  ) {
    super()
    this.parent = vorpal
  }

  /**
   * Pipes logging data through any piped
   * commands, and then sends it to ._log for
   * actual logging.
   *
   * @param {String} [... arguments]
   * @return {Session}
   * @api public
   */

  /**
   * Receives and runs logging through
   * a piped function is one is provided
   * through ui.pipe(). Pauses any active
   * prompts, logs the data and then if
   * paused, resumes the prompt.
   *
   * @return {UI}
   * @api public
   */

  public log (...args: string[]) {
    args = typeof this._pipeFn === 'function'
      ? this._pipeFn(args)
      : args
    if (args.length === 0 || args[0] === '') {
      return this
    }

    if (this.obsio) {
      // FIXME(huan): args to string?
      this.obsio.stdout.next(stripAnsi(args.join(' ')))
    } else {
      args = args.map(arg => stripAnsi(arg))
      console.info(...args)
    }

    return this
  }

  /**
   * Public facing autocomplete helper.
   *
   * @param {String} str
   * @param {Array} arr
   * @return {String}
   * @api public
   */

  public help (command: string) {
    this.log(this.vorpal._commandHelp(command || ''))
  }

  /**
   * Gets a new command set ready.
   *
   * @return {session}
   * @api public
   */

  public execCommandSet (wrapper: utils.CommandExecutionItem, callback: any): void {
    const self = this
    let response: CommandResponse = {}
    // var res /* eslint-disable-line no-var */
    this._registeredCommands = 1
    this._completedCommands = 0

    // Create the command instance for the first
    // command and hook it up to the pipe chain.
    const commandInstance = new CommandInstance({
      downstream: wrapper.pipes![0] as any,
      commandObject: wrapper.commandObject,
      commandWrapper: wrapper,
      obsio: wrapper.obsio,
    })

    wrapper.commandInstance = commandInstance

    function sendDones (itm: any) {
      if (itm.commandObject && itm.commandObject._done) {
        itm.commandObject._done.call(itm)
      }
      if (itm.downstream) {
        sendDones(itm.downstream)
      }
    }

    // Gracefully handles all instances of the command completing.
    this._commandSetCallback = () => {
      const err = response.error
      const data = response.data
      const argus = response.args
      if (err) {
        let stack
        if (data && data.stack) {
          stack = data.stack
        } else if (err && err.stack) {
          stack = err.stack
        } else {
          stack = err
        }
        self.log(stack)
        self.vorpal.emit('client_command_error', { command: wrapper.command, error: err })
      } else {
        self.vorpal.emit('client_command_executed', { command: wrapper.command })
      }

      callback(wrapper, err, data, argus)
      sendDones(commandInstance)
    }

    function onCompletion (wrapperInner: any, err: any, data?: any, argus?: any) {

      // console.info(new Error().stack)
      // console.info('###', data)

      response = {
        error: err,
        data,
        args: argus,
      }
      void wrapperInner
      self.completeCommand()
    }

    let valid
    if (typeof wrapper.validate === 'function') {
      try {
        valid = wrapper.validate.call(commandInstance, wrapper.args)
      } catch (e) {
        // Complete with error on validation error
        onCompletion(wrapper, e)
        return
      }
    }
    if (valid !== true && valid !== undefined) {
      onCompletion(wrapper, valid || null)
      return
    }

    if (wrapper.args && typeof wrapper.args === 'object') {
      wrapper.args.rawCommand = wrapper.command!
    }

    // Call the root command.
    const res = wrapper.fn!.call(commandInstance, wrapper.args as any, function (...argus: any) {
      onCompletion(wrapper, argus[0], argus[1], argus)
    } as any)

    // If the command as declared by the user
    // returns a promise, handle accordingly.
    if (res instanceof Promise) {
      res
        .then(function (data) {
          if (typeof data === 'undefined') {
            data = 0
          }
          onCompletion(wrapper, undefined, data)
          return undefined
        })
        .catch(function (err) {
          onCompletion(wrapper, true, err)
        })
    }

    // return this
  }

  /**
   * Adds on a command or sub-command in progress.
   * Session keeps tracked of commands,
   * and as soon as all commands have been
   * completed, the session returns the entire
   * command set as complete.
   *
   * @return {session}
   * @api public
   */
  public registerCommand () {
    this._registeredCommands = this._registeredCommands || 0
    this._registeredCommands++
    return this
  }

  /**
   * Marks a command or subcommander as having completed.
   * If all commands have completed, calls back
   * to the root command as being done.
   *
   * @return {session}
   * @api public
   */
  public completeCommand () {
    this._completedCommands!++
    if (this._registeredCommands! <= this._completedCommands!) {
      this._registeredCommands = 0
      this._completedCommands = 0
      if (this._commandSetCallback) {
        this._commandSetCallback()
      }
      this._commandSetCallback = undefined
    }
    return this
  }

}

export default Session
