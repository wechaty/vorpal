/* eslint-disable sort-keys */
import { EventEmitter } from 'events'

import type { Message }  from 'wechaty'

import * as utils from './utils/mod.js'
import type { ObsIo } from '../vorpal-io.js'

import { Command }          from './command.js'
import { CommandInstance }  from './command-instance.js'
import { Session }          from './session.js'
import { commons }          from './vorpal-commons.js'

interface VorpalMeta {
  version?    : string,
  title?      : string,
  description?: string,
  banner?     : string,
}

interface CommandXOptions {
  noHelp?  : boolean,
  mode?    : boolean,
  default? : boolean,
}

type VorpalExtension = (
  // eslint-disable-next-line
  vorpal   : Vorpal,
  options? : Object,
) => void

class Vorpal extends EventEmitter {

  private meta: VorpalMeta

  public commands: Command[]

  // private util: any
  // public session: Session
  private isCommandArgKeyPairNormalized: boolean

  public _help: any

  protected _message?: Message

  get message (): Message {
    if (!this._message) {
      throw new Error('Vorpal has not set Message instance yet')
    }
    return this._message
  }

  set message (newMessage: Message) {
    if (this._message) {
      throw new Error('Message from Vorpal can not set twice!')
    }
    this._message = newMessage
  }

  constructor () {
    super()
    // Registered `vorpal.command` commands and
    // their options.
    this.commands = []

    // // Expose common utilities, like padding.
    // this.util = utils

    // Allow unix-like key value pair normalization to be turned off by toggling this switch on.
    this.isCommandArgKeyPairNormalized = true

    this.meta = {}

    this._init()
  }

  /**
   * Extension to `constructor`.
   * @api private
   */

  public _init () {
    this.use(commons)
  }

  /**
   * Sets version of your application's API.
   *
   * @param {String} version
   * @return {Vorpal}
   * @api public
   */

  public version (version: string): this {
    this.meta.version = version
    return this
  }

  /**
   * Sets the title of your application.
   *
   * @param {String} title
   * @return {Vorpal}
   * @api public
   */

  public title (title: string) {
    this.meta.title = title
    return this
  }

  /**
   * Sets the description of your application.
   *
   * @param {String} description
   * @return {Vorpal}
   * @api public
   */

  public description (description: string) {
    this.meta.description = description
    return this
  }

  /**
   * Sets the banner of your application.
   *
   * @param {String} banner
   * @return {Vorpal}
   * @api public
   */

  public banner (banner: string) {
    this.meta.banner = banner
    return this
  }

  /**
   * Imports a library of Vorpal API commands
   * from another Node module as an extension
   * of Vorpal.
   *
   * @param {Array} extension
   * @return {Vorpal}
   * @api public
   */

  public use (
    extension: string
            | VorpalExtension
            | Command | Command[],
    options?: Object,
  ): this {
    if (typeof extension === 'function') {
      extension.call(this, this, options)
    } else if (typeof extension === 'string') {
      /* eslint-disable-next-line @typescript-eslint/no-var-requires */
      const module = require(extension)
      return this.use(module, options)
    } else {
      extension = Array.isArray(extension) ? extension : [extension]
      for (const cmd of extension) {
        if (cmd.command) {
          const command = this.command(cmd.command)
          // eslint-disable-next-line
          if (cmd.description) {
            command.description(cmd.description as any)
          }
          // eslint-disable-next-line
          if (cmd.options) {
            cmd.options = Array.isArray(cmd.options) ? cmd.options : [cmd.options]
            for (let j = 0; j < cmd.options.length; ++j) {
              command.option((cmd.options[j] as any)[0], (cmd.options[j] as any)[1])
            }
          }
          // eslint-disable-next-line
          if (cmd.action) {
            command.action(cmd.action as any)
          }
        }
      }
    }
    return this
  }

  /**
   * Registers a new command in the vorpal API.
   *
   * @param {String} name
   * @param {String} desc
   * @param {Object} opts
   * @return {Command}
   * @api public
   */

  public command (
    name: string,
    desc?: string,
    opts: CommandXOptions = {},
  ): Command {
    name = String(name)

    const args = name.match(/(\[[^\]]*\]|<[^>]*>)/g) || []

    const cmdNameRegExp = /^([^[<]*)/
    const cmdName = cmdNameRegExp.exec(name)![0]!.trim()

    const cmd = new Command(cmdName, this)

    if (desc) {
      cmd.description(desc)
    }

    cmd._noHelp = Boolean(opts.noHelp)
    cmd._default = opts.default || false
    cmd._parseExpectedArgs(args)

    let exists = false
    for (let i = 0; i < this.commands.length; ++i) {
      exists = this.commands[i]!._name === cmd._name ? true : exists
      if (exists) {
        this.commands[i] = cmd
        break
      }
    }
    if (!exists) {
      this.commands.push(cmd)
    }

    this.emit('command_registered', { command: cmd, name })

    return cmd
  }

  /**
   * Registers a 'default' command in the vorpal API.
   * This is executed when no command matches are found.
   *
   * @param {String} name
   * @param {String} desc
   * @param {Object} opts
   * @return {Command}
   * @api public
   */
  public default (name: string, desc: string, opts: CommandXOptions): Command {
    return this.command(name, desc, {
      ...opts,
      default: true,
    })
  }

  /**
   * Delegates to ui.log.
   *
   * @param {String} log
   * @return {Vorpal}
   * @api public
   */

  // public log (...args: string[]) {
  //   this.session.log(...args)
  //   return this
  // }

  /**
   * Intercepts all logging through `vorpal.log`
   * and runs it through the function declared by
   * `vorpal.pipe()`.
   *
   * @param {Function} fn
   * @return {Vorpal}
   * @api public
   */

  // public pipe (fn: Function) {
  //   this.session._pipeFn = fn
  //   return this
  // }

  /**
   * Executes a vorpal API command and
   * returns the response either through a
   * callback or Promise in the absence
   * of a callback.
   *
   * @param {String} cmd
   * @param {Function} cb
   * @return {Promise or Vorpal}
   * @api public
   */

  public async exec (
    command: string,
    args?: object,
    obsio?: ObsIo,
  ): Promise<number | string> {
    args = args || {}

    const self = this

    const commandData = utils.parseCommand(command, this.commands)

    const session = new Session(this, obsio)

    const item: utils.CommandExecutionItem = {
      args: args as any,
      command: commandData.command,
      pipes: commandData.pipes,
      session: session,
      obsio,
    }

    const match = commandData.match
    const matchArgs = commandData.matchArgs as string

    function throwHelp (cmd: any, msg?: string, alternativeMatch?: any) {
      void cmd
      if (msg) {
        if (obsio) {
          obsio.stdout.next(msg)
        } else {
          cmd.session.log(msg)
        }
      }
      const pickedMatch = alternativeMatch || match
      if (obsio) {
        obsio.stdout.next(pickedMatch.helpInformation())
      } else {
        cmd.session.log(pickedMatch.helpInformation())
      }
    }

    // function callback (cmd: any, err?: any, msg?: any) {
    //   if (!err && cmd.resolve) {
    //     return msg
    //   } else if (err && cmd.reject) {
    //     throw msg
    //   }
    // }

    if (!match) {
      // If no command match, just return.
      const helpMsg = this._commandHelp(item.command)
      if (obsio) {
        obsio.stderr.next('Invalid command')
        obsio.stdout.next(helpMsg)
        return 1
      } else {
        item.session.log(helpMsg)
        return 'Invalid command.'
      }
    }

    item.fn = match._fn as any
    item.validate = match._validate
    item.commandObject = match

    item.args = utils.buildCommandArgs(
      matchArgs,
      match,
      item,
      self.isCommandArgKeyPairNormalized,
    )

    // If we get a string back, it's a validation error.
    // Show help and return.
    if (typeof item.args === 'string' || typeof item.args !== 'object') {
      throwHelp(item, item.args)
      // return callback(item, undefined, item.args)
      if (obsio) {
        return 1
      }
      return item.args
    }

    // Build the piped commands.
    let allValid = true
    for (let j = 0; j < item.pipes!.length; ++j) {
      const commandParts = utils.matchCommand(item.pipes![j] as any, self.commands)
      if (!commandParts.command) {
        const helpMsg = self._commandHelp(item.pipes![j] as any)
        if (obsio) {
          obsio.stdout.next(helpMsg)
        } else {
          item.session.log(helpMsg)
        }
        allValid = false
        break
      }
      commandParts.args = (utils.buildCommandArgs(
        commandParts.args,
        commandParts.command,
      ) as unknown) as string
      if (typeof commandParts.args === 'string' || typeof commandParts.args !== 'object') {
        throwHelp(item, commandParts.args, commandParts.command)
        allValid = false
        break
      }
      item.pipes![j] = commandParts as any
    }
    // If invalid piped commands, return.
    if (!allValid) {
      // return callback(item)
      return 1
    }

    // If `--help` or `/?` is passed, do help.
    if (item.args.options['help'] && typeof match._help === 'function') {
      // If the command has a custom help function, run it
      // as the actual "command". In this way it can go through
      // the whole cycle and expect a callback.
      item.fn = match._help as any
      delete item.validate
      delete item._cancel
    } else if (item.args.options['help']) {
      // Otherwise, throw the standard help.
      throwHelp(item, '')
      // return callback(item)
      return 0
    }

    // Builds commandInstance objects for every
    // command and piped command included in the
    // execution string.

    // Build the instances for each pipe.
    item.pipes = (item.pipes as any).map(function (pipe: any) {
      return new CommandInstance({
        commandWrapper: item,
        command: pipe.command._name,
        commandObject: pipe.command,
        args: pipe.args,
        obsio: obsio,
      })
    })

    // Reverse through the pipes and assign the
    // `downstream` object of each parent to its
    // child command.
    for (let k = item.pipes!.length - 1; k > -1; --k) {
      const downstream = item.pipes![k + 1]
      ;(item.pipes as any)[k].downstream = downstream
    }

    return new Promise((resolve, reject) => {
      item.session.execCommandSet(item, function (wrapper: any, err: any, data: any) {
        void wrapper
        if (err) {
          reject(data)
        } else {
          // if (typeof data === 'string') {
          //   data = stripAnsi(data)
          //   if (options?.obsio) {
          //     options.obsio.stdout.next(data)
          //   } else {
          //     item.session.log(data)
          //   }
          //   resolve(0)
          // } else {
          resolve(data)
          // }
        }
      })
    })
  }

  /**
   * Returns the instance of  given command.
   *
   * @param {String} cmd
   * @return {Command}
   * @api public
   */

  public find (name: string) {
    return this.commands.find(command => command._name === name)
  }

  /**
   * Registers custom help.
   *
   * @param {Function} fn
   * @return {Vorpal}
   * @api public
   */

  public help (fn: Function) {
    this._help = fn
  }

  /**
   * Returns help string for a given command.
   *
   * @param {String} command
   * @api private
   */

  public _commandHelp (command?: string) {
    if (!this.commands.length) {
      return ''
    }

    if (this._help !== undefined && typeof this._help === 'function') {
      return this._help(command)
    }

    let matches = []
    const singleMatches = []

    command = command ? String(command).trim() : undefined
    for (const _command of this.commands) {
      const parts = String(_command._name).split(' ')
      if (parts.length === 1 && parts[0] === command && !_command._hidden && !_command._default) {
        singleMatches.push(command)
      }
      let str = ''
      for (const part of parts) {
        str = String(str + ' ' + part).trim()
        if (str === command && !_command._hidden && !_command._default) {
          matches.push(_command)
          break
        }
      }
    }

    const invalidString = command && matches.length === 0 && singleMatches.length === 0
      ? ['', '  Invalid Command. Showing Help:', ''].join('\n')
      : ''

    const commandMatch = matches.length > 0
    const commandMatchLength = commandMatch
      ? String(command)
        .trim()
        .split(' ').length + 1
      : 1
    matches = matches.length === 0 ? this.commands : matches

    const skipGroups = !(matches.length + 6 > process.stdout.rows)

    const commands = matches
      .filter(function (cmd) {
        return !cmd._noHelp
      })
      .filter(function (cmd) {
        return !cmd._default
      })
      .filter(function (cmd) {
        return !cmd._hidden
      })
      .filter(function (cmd) {
        if (skipGroups === true) {
          return true
        }
        return (
          String(cmd._name)
            .trim()
            .split(' ').length <= commandMatchLength
        )
      })
      .map(cmd => {
        const args = cmd._args.map(arg => utils.humanReadableArgName(arg)).join(' ')

        return [
          cmd._name
            + ((cmd as any)._alias ? '|' + (cmd as any)._alias : '')
            + (cmd.options.length ? ' [options]' : '')
            + ' '
            + args,
          cmd.description() || '',
        ]
      })

    const width = commands.reduce(function (max, commandX) {
      return Math.max(max, (commandX[0] as any).length)
    }, 0)

    const counts = {} as { [key: string]: any }

    let groups = matches
      .filter(function (cmd) {
        return (
          String(cmd._name)
            .trim()
            .split(' ').length > commandMatchLength
        )
      })
      .map(function (cmd) {
        return String(cmd._name)
          .split(' ')
          .slice(0, commandMatchLength)
          .join(' ')
      })
      .map(function (cmd) {
        counts[cmd] = counts[cmd] || 0
        counts[cmd]++
        return cmd
      })

    groups = [...new Set(...groups)]

    groups = groups.map(function (cmd) {
      const prefix = `    ${utils.pad(cmd + ' *', width)}  ${counts[cmd]} sub-command${
        counts[cmd] === 1 ? '' : 's'
      }.`
      return prefix
    })

    groups = skipGroups ? [] : groups

    const commandsString = commands.length < 1
      ? ''
      : '\n  Commands:\n\n'
        + commands
          .map(function (cmd) {
            const prefix = '    ' + utils.pad(cmd[0] as any, width) + '  '
            const suffixArr = (cmd[1] as any).split('\n')
            for (let i = 0; i < suffixArr.length; ++i) {
              if (i !== 0) {
                suffixArr[i] = utils.pad('', width + 6) + suffixArr[i]
              }
            }
            const suffix = suffixArr.join('\n')
            return prefix + suffix
          })
          .join('\n')
            + '\n\n'

    const groupsString = groups.length < 1
      ? ''
      : '  Command Groups:\n\n' + groups.join('\n') + '\n'

    return String(
      this._helpHeader(!!invalidString) + invalidString + commandsString + '\n' + groupsString,
    )
      .replace(/\n\n\n/g, '\n\n')
      .replace(/\n\n$/, '\n')
  }

  public _helpHeader (hideTitle: boolean) {
    const header = []

    if (this.meta.banner) {
      header.push(utils.padRow(this.meta.banner), '')
    }

    // Only show under specific conditions
    if (this.meta.title && !hideTitle) {
      let title = this.meta.title

      if (this.meta.version) {
        title += ' v' + this.meta.version
      }

      header.push(utils.padRow(title))

      if (this.meta.description) {
        header.push(utils.padRow(this.meta.description))
      }
    }

    // Pad the top and bottom
    if (header.length) {
      header.unshift('')
      header.push('')
    }

    return header.join('\n')
  }

}

export type {
  VorpalExtension,
}
export { Vorpal }
