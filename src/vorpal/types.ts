import {
  Arg,
  Command,
}           from '../command'

import {
  CommandInstance,
  CommandArgs,
}                   from '../command-instance'

export type ArgTypes = {
  [P in 'string' | 'boolean']: unknown
}

type ParseFn = (str: string, args: string | CommandArgs) => string
type ValidateFn = (instance: CommandInstance, args: CommandArgs) => string
type CancelFn = (instance: CommandInstance) => void
type FnFn = (args: Arg[], onComplete: (err?: Error) => void) => void

export type Action = (args: CommandArgs) => Promise<void>;
type Cancel = () => void;

export interface MatchParts<T extends CommandArgs | string> {
  args: T
  command?: Command
}

export type ParsedCommand = {
  command: string
  match?: Command
  matchArgs: string | CommandArgs
  pipes: string[]
}
