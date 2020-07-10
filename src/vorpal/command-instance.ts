import { Message } from 'wechaty'
import {
  types,
}                   from 'wechaty-plugin-contrib'
import { Command } from './command'
import { Session } from './session'
import { Observable, Subject } from 'rxjs'

import { ObsIo }   from '../vorpal-io'

export type Args = {
  [arg: string]: string | string[]
} & ArgsOptions

interface ArgsOptions {
  options: {
    [arg: string]: string | number | boolean
  }
}

interface CommandInstanceOptions {
  commandWrapper?: any
  args?: Args
  commandObject?: Command
  command?: any
  callback?: any
  downstream?: CommandInstance
  obsio?: ObsIo
}

export class CommandInstance {

  public commandWrapper: any
  public args?: Args
  public commandObject: any
  public command: Command
  public session: Session
  public parent: any
  public callback: any
  public downstream?: CommandInstance

  protected obsio?: ObsIo

  get stdin ()   : Observable<types.SayableMessage> { return this.obsio!.stdin    }
  get stdout ()  : Subject<types.SayableMessage>    { return this.obsio!.stdout   }
  get stderr ()  : Subject<string>                  { return this.obsio!.stderr   }
  get message () : Message                          { return this.obsio!.message  }
  get prompt ()                                     { return this.obsio!.prompt }

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
    obsio,
  }: CommandInstanceOptions = {}) {
    this.command = command
    this.commandObject = commandObject
    this.args = args
    this.commandWrapper = commandWrapper
    this.session = commandWrapper.session
    this.parent = this.session.vorpal
    this.callback = callback
    this.downstream = downstream

    this.obsio = obsio
  }

  /**
   * Route stdout either through a piped command, or the session's stdout.
   */

  public log (...args: string[]) {
    if (this.downstream) {
      const fn = this.downstream.commandObject._fn || (() => {})
      this.session.registerCommand()
      this.downstream.args!.stdin = args
      const onComplete = (err?: Error) => {
        if (err) {
          this.session.log(String(err.stack || err))
          this.session.parent.emit('client_command_error', {
            command: this.downstream!.command,
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
          onComplete()
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

  public help (command: string) {
    return this.session.help(command)
  }

}
