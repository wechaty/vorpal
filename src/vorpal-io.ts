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

const busyState: {
  [id: string]: true
} = {}

const vorpalIo = (message: Message) => {
  return new VorpalIo(message)
}

class VorpalIo {

  protected stdinSub?  : Subject<SayableMessage>
  protected stdoutSub? : Subject<SayableMessage>
  protected stderrSub? : Subject<Error>

  constructor (
    protected message: Message,
  ) {
    log.verbose('VorpalIo', 'constructor(%s)', message)
  }

  stdio () {
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
    return !!(busyState[this.id()])
  }

  close (): void {
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

    const sub = new Subject<SayableMessage>()

    const onMessage = (message: Message) => {
      // TODO: filter by the current io condition
      sub.next(message)
    }
    this.message.wechaty.on('message', onMessage)
    sub.subscribe({
      complete: () => this.message.wechaty.off('message', onMessage),
    })

    this.stdinSub = sub
    return sub.asObservable()
  }

  protected stdout (): Subject<SayableMessage> {
    if (this.stdoutSub) {
      return this.stdoutSub
    }

    const sub = new Subject<SayableMessage>()

    const next = async (msg: SayableMessage) => {
      const talker = talkers.messageTalker(msg)
      try {
        await talker(this.message)
      } catch (e) {
        log.error('VorpalIo', 'stdout() next() rejection: %s', e)
      }
    }

    sub.subscribe({ next })

    this.stdoutSub = sub
    return sub
  }

  protected stderr (): Subject<Error> {
    if (this.stderrSub) {
      return this.stderrSub
    }

    const sub = new Subject<Error>()
    this.stderrSub = sub
    return sub
  }

}

export {
  vorpalIo,
}
