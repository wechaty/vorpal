import type {
  // Arg,
  Command,
}           from './command.js'

import type {
  // CommandInstance,
  Args,
  CommandContext,
}                   from './command-instance.js'

// type ParseFn = (str: string, args: string | Args) => string
// type ValidateFn = (instance: CommandInstance, args: Args) => string
// type CancelFn = (instance: CommandInstance) => void
// type FnFn = (args: Arg[], onComplete: (err?: Error) => void) => void

type PromiseAction = (
  this: CommandContext,
  args: Args,
) => Promise<void | number>

type CallbackAction = (
  this: CommandContext,
  args: Args,
  callback: (err: any, data: any) => void,
) => void | number

export type Action = PromiseAction | CallbackAction

export interface MatchParts<T extends Args | string> {
  args: T
  command?: null | Command
}

export type ParsedCommand = {
  command: string
  match?: null | Command
  matchArgs: string | Args
  pipes: CommandContext[]
}
