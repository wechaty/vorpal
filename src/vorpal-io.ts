import {
  Message,
  log,
  Wechaty,
}                   from 'wechaty'
import cuid         from 'cuid'

import {
  Observable,
  Subject,
  EMPTY,
  concat,
  of,
}                   from 'rxjs'
import {
  concatMap,
  delay,
}                   from 'rxjs/operators'
import { talkers }  from 'wechaty-plugin-contrib'

import { SayableMessage } from './wechaty-vorpal'

export interface ObsIo {
  stdin: Observable<SayableMessage>
  stdout: Subject<SayableMessage>
  stderr: Subject<string>
  message: Message,
  wechaty: Wechaty,
}

// const addDelay = () => concatMap<any, any>(item => concat(
//   of(item),                 // emit first item right away
//   EMPTY.pipe(delay(1000)),  // delay next item
// ))

class VorpalIo {

  static busyState: {
    [id: string]: true
  } = {}

  static from (message: Message) {
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
      message: this.message,
      stderr : this.stderr(),
      stdin  : this.stdin(),
      stdout : this.stdout(),
      wechaty: this.message.wechaty,
    }
  }

  busy (): boolean {
    const isBusy = !!(VorpalIo.busyState[this.id()])
    log.verbose('VorpalIo', 'busy() = %s', isBusy)
    return isBusy
  }

  close (): void {
    log.verbose('VorpalIo', 'close()')

    if (this.stdinSub) {
      this.stdinSub.complete()
    }
    if (this.stderrSub) {
      this.stderrSub.complete()
    }
    if (this.stdoutSub) {
      this.stdoutSub.complete()
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

    let id
    if (room) {
      id = `${from.id}@${room.id}`
    } else {
      id = from.id
    }

    // log.silly('VorpalIo', 'id() = %s', id)
    return id
  }

  protected setBusy (busy: boolean): void {
    log.verbose('VorpalIo', 'setBusy(%s) for %s', busy, this.message)
    if (busy) {
      VorpalIo.busyState[this.id()] = true
    } else {
      delete VorpalIo.busyState[this.id()]
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

      log.verbose('VorpalIo', 'stdin() onMessage(%s)', message)
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
      log.verbose('VorpalIo', 'stdout() next(%s)', msg)

      const talk = talkers.messageTalker(msg)
      try {
        await talk(this.message)
      } catch (e) {
        log.error('VorpalIo', 'stdout() next() rejection: %s', e)
      }
    }

    sub.pipe(
      concatMap(item => concat(
        of(item),                 // emit first item right away
        EMPTY.pipe(delay(1000)),  // delay next item
      ))
    ).subscribe({
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

    const next = async (msg: SayableMessage) => {
      log.verbose('VorpalIo', 'stderr() next(%s)', msg)
      const talker = talkers.messageTalker(msg)
      try {
        await talker(this.message)
      } catch (e) {
        log.error('VorpalIo', 'stderr() next() rejection: %s', e)
      }
    }

    sub.pipe(
      concatMap(item => concat(
        of(item),                 // emit first item right away
        EMPTY.pipe(delay(1000)),  // delay next item
      ))
    ).subscribe({
      complete,
      next,
    })

    return sub
  }

}

export {
  VorpalIo,
}
