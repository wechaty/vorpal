import Vorpal, {
  Action,
  Args,
  CommandInstance,
}                   from 'vorpal'

import {
  log,
}             from './config'

/**
 *
 * Huan(202006): Chatbot is more simple than the TTY environment.
 *  Simplify it by redirecting the stdout to chat conversation,
 *  and remove unnecessary component (like UI) and methods.
 *
 */
class SimpleVorpal implements Vorpal {

  ui: Vorpal.UI
  get activeCommand (): Vorpal.CommandInstance {
    return this.vorpal.activeCommand
  }

  protected vorpal: Vorpal

  constructor () {
    log.verbose('SimpleVorpal', 'constructor()')
    this.vorpal = new Vorpal()

    /**
     * Make the Vorpal interface happy
     */
    this.ui = {} as any
  }

  parse (argv: ReadonlyArray<string>): this {
    this.vorpal.parse(argv)
    return this
  }

  delimiter (value: string): this {
    void value
    throw new Error('not for chatbot')
  }

  show (): this {
    throw new Error('not for chatbot')
  }

  hide (): this {
    throw new Error('not for chatbot')
  }

  find (command: string): Vorpal.Command {
    return this.vorpal.find(command)
  }

  async exec<T={}> (command: string): Promise<T> {
    log.verbose('SimpleVorpal', 'exec(%s)', command)
    return this.vorpal.exec(command) as Promise<T>
  }

  async execSync<T={}> (command: string): Promise<T> {
    return this.vorpal.execSync(command) as Promise<T>
  }

  log (value: string, ...values: string[]): this {
    this.vorpal.log(value, ...values)
    return this
  }

  history (id: string): this {
    void id
    throw new Error('not for chatbot')
  }

  localStorage (id: string): object {
    void id
    throw new Error('not for chatbot')
  }

  help (
    value: (cmd: string) => string,
  ): this {
    this.vorpal.help(value)
    return this
  }

  pipe (
    value: (stdout: string) => string,
  ): this {
    this.vorpal.pipe(value)
    return this
  }

  use (extension: Vorpal.Extension): this {
    this.vorpal.use(extension)
    return this
  }

  catch (command: string, description?: string): Vorpal.Catch {
    void description
    // FIXME: description can not be passed to catch ??? Huan(202006)
    return this.vorpal.catch(command, /** description */)
  }

  command (command: string, description?: string): Vorpal.Command {
    return this.vorpal.command(command, description)
  }

  version (version: string): this {
    this.vorpal.version(version)
    return this
  }

  sigint (value: () => void): this {
    void value
    throw new Error('not for chatbot')
  }

}

export {
  SimpleVorpal,
  Action,
  Args,
  CommandInstance,
}
