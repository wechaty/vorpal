/**
 * Function library for Vorpal's out-of-the-box
 * API commands. Imported into a Vorpal server
 * through vorpal.use(module).
 */

import { Vorpal } from './vorpal'
import { CommandInstance } from './command-instance'

export default function (vorpal: Vorpal) {
  /**
   * Help for a particular command.
   */

  vorpal
    .command('help [command...]')
    .description('Provides help for a given command.')
    .action(function (this: CommandInstance, args, cb) {
      if (args.command) {
        args.command = args.command.join(' ')
        const commandWithName = this.parent.commands.find(
          command => command._name === String(args.command).trim()
        )
        if (commandWithName && !commandWithName._hidden) {
          if (typeof commandWithName._help === 'function') {
            commandWithName._help(args.command, str => {
              this.log(str)
              cb()
            })
            return
          }
          this.log(commandWithName.helpInformation())
        } else {
          this.log(this.parent._commandHelp(args.command))
        }
      } else {
        this.log(this.parent._commandHelp(args.command))
      }
      cb()
    })

  /**
   * Exits Vorpal.
   */

  vorpal
    .command('exit')
    .alias('quit')
    .description('Exits application.')
    .action(function (args) {
      args.options = args.options || {}
      args.options.sessionId = this.session.id
      this.parent.exit(args.options)
    })
}
