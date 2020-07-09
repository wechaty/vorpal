import {
  Message,
  log,
}                   from 'wechaty'
import cuid from 'cuid'
import {
  Observable,
  Subject,
}                 from 'rxjs'
import { talkers } from 'wechaty-plugin-contrib'

import { SayableMessage } from './wechaty-vorpal'

export interface ObsIo {
  stdin: Observable<SayableMessage>
  stdout: Subject<SayableMessage>
  stderr: Subject<string>
}

const busyState: {
  [id: string]: true
} = {}

class VorpalIo {

  static from (message: Message): VorpalIo {
    return new this(message)
  }

  protected stdinSub?  : Subject<SayableMessage>
  protected stdoutSub? : Subject<SayableMessage>
  protected stderrSub? : Subject<string>

  constructor (
    protected message: Message,
  ) {
    log.verbose('VorpalIo', 'constructor(%s)', message)
  }

  obsio (): ObsIo {
    log.verbose('VorpalIo', 'obsio()')

    if (this.busy()) {
      throw new Error(`Vorpal Io for ${this.message} is busy!`)
    }

    this.setBusy(true)

    return {
      stderr : this.stderr(),
      stdin  : this.stdin(),
      stdout : this.stdout(),
    }
  }

  busy (): boolean {
    const isBusy = !!(busyState[this.id()])
    log.verbose('VorpalIo', 'busy() = %s', isBusy)
    return isBusy
  }

  close (): void {
    log.verbose('VorpalIo', 'close()')

    if (this.stdinSub) {
      this.stdinSub.complete()
      this.stdinSub = undefined
    }
    if (this.stderrSub) {
      this.stderrSub.complete()
      this.stderrSub = undefined
    }
    if (this.stdoutSub) {
      this.stdoutSub.complete()
      this.stdoutSub = undefined
    }
    this.setBusy(false)
  }

  protected id () {
    const from = this.message.from()
    const room = this.message.room()

    if (!from) {
      // FIXME(huan, 202007): I can not remember why the message.form() could be undefined ...
      return cuid()
    }

    if (room) {
      return `${from.id}@${room.id}`
    }

    return from.id
  }

  protected setBusy (busy: boolean): void {
    log.verbose('VorpalIo', 'setBusy(%s) for %s', busy, this.message)
    if (busy) {
      busyState[this.id()] = true
    } else {
      delete busyState[this.id()]
    }
  }

  protected stdin (): Observable<SayableMessage> {

    if (this.stdinSub) {
      return this.stdinSub
    }

    const room = this.message.room()
    const from = this.message.from()

    const sub = new Subject<SayableMessage>()

    const onMessage = (message: Message) => {
      if (message.from() === from)  { return }
      if (message.room() === room)  { return }
      sub.next(message)
    }
    this.message.wechaty.on('message', onMessage)

    this.stdinSub = sub
    const complete = () => {
      this.message.wechaty.off('message', onMessage)
      this.stdinSub = undefined
    }

    sub.subscribe({ complete })

    return sub.asObservable()
  }

  protected stdout (): Subject<SayableMessage> {
    if (this.stdoutSub) {
      return this.stdoutSub
    }

    const sub = new Subject<SayableMessage>()

    this.stdoutSub = sub
    const complete = () => {
      this.stdoutSub = undefined
    }

    const next = async (msg: SayableMessage) => {
      const talker = talkers.messageTalker(msg)
      try {
        await talker(this.message)
      } catch (e) {
        log.error('VorpalIo', 'stdout() next() rejection: %s', e)
      }
    }

    sub.subscribe({
      complete,
      next,
    })

    return sub
  }

  protected stderr (): Subject<string> {
    if (this.stderrSub) {
      return this.stderrSub
    }

    const sub = new Subject<string>()

    this.stderrSub = sub
    const complete = () => {
      this.stderrSub = undefined
    }
    sub.subscribe({ complete })

    return sub
  }

}

export {
  VorpalIo,
}
