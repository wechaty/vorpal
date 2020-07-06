import { Command } from './command'
import { Session } from './session'

export type CommandArgs = {
  [arg: string]: string | string[];
} & CommandArgsOptions;

interface CommandArgsOptions {
  options: {
    [arg: string]: string | number | boolean;
  };
}

interface CommandInstanceOptions {
  commandWrapper?: any;
  args?: CommandArgs;
  commandObject?: Command;
  command?: any;
  callback?: any;
  downstream?: CommandInstance;
}

export class CommandInstance {

  public commandWrapper: any;
  public args: CommandArgs;
  public commandObject: any;
  public command: Command;
  public session: Session
  public parent: any;
  public callback: any;
  public downstream: CommandInstance;
  /**
   * Initialize a new `CommandInstance` instance.
   *
   * @param {Object} params
   * @return {CommandInstance}
   * @api public
   */

  constructor ({
    command,
    commandObject,
    args,
    commandWrapper,
    callback,
    downstream,
  }: CommandInstanceOptions = {}) {
    this.command = command
    this.commandObject = commandObject
    this.args = args
    this.commandWrapper = commandWrapper
    this.session = commandWrapper.session
    this.parent = this.session.vorpal
    this.callback = callback
    this.downstream = downstream
  }

  /**
   * Route stdout either through a piped command, or the session's stdout.
   */

  public log (...args) {
    if (this.downstream) {
      const fn = this.downstream.commandObject._fn || (() => {})
      this.session.registerCommand()
      this.downstream.args.stdin = args
      const onComplete = (err?: Error) => {
        if (err) {
          this.session.log(err.stack || err)
          this.session.parent.emit('client_command_error', {
            command: this.downstream.command,
            error: err,
          })
        }
        this.session.completeCommand()
      }

      const validate = this.downstream.commandObject._validate
      if (typeof validate === 'function') {
        try {
          validate.call(this.downstream, this.downstream.args)
        } catch (e) {
          // Log error without piping to downstream on validation error.
          this.session.log(e.toString())
          onComplete(null)
          return
        }
      }

      const res = fn.call(this.downstream, this.downstream.args, onComplete)
      if (res instanceof Promise) {
        res
          .then(onComplete, onComplete)
          .catch(console.error)
      }
    } else {
      this.session.log(...args)
    }
  }

  public help (a) {
    return this.session.help(a)
  }

}
