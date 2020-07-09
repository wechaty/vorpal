import {
  // Arg,
  Command,
}           from './command'

import {
  // CommandInstance,
  Args, CommandInstance,
}                   from './command-instance'

export type ArgTypes = {
  [P in 'string' | 'boolean']: unknown
}

// type ParseFn = (str: string, args: string | Args) => string
// type ValidateFn = (instance: CommandInstance, args: Args) => string
// type CancelFn = (instance: CommandInstance) => void
// type FnFn = (args: Arg[], onComplete: (err?: Error) => void) => void

export type Action = (
  this: CommandInstance,
  args: Args,
  callback: Function,
) => number | Promise<number>

export interface MatchParts<T extends Args | string> {
  args: T
  command?: null | Command
}

export type ParsedCommand = {
  command: string
  match?: null | Command
  matchArgs: string | Args
  pipes: CommandInstance[]
}
