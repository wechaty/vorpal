import {
  // Arg,
  Command,
}           from './command'

import {
  // CommandInstance,
  Args,
  CommandInstance,
}                   from './command-instance'

// type ParseFn = (str: string, args: string | Args) => string
// type ValidateFn = (instance: CommandInstance, args: Args) => string
// type CancelFn = (instance: CommandInstance) => void
// type FnFn = (args: Arg[], onComplete: (err?: Error) => void) => void

type PromiseAction = (
  this: CommandInstance,
  args: Args,
) => Promise<void | number>

type CallbackAction = (
  this: CommandInstance,
  args: Args,
  callback: (err: any, data: any) => void,
) => void | number

export type Action = PromiseAction | CallbackAction

const t: Action = function (args: Args) {
  void args
  return 42
}

type tt = ReturnType<typeof t>
void t

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
