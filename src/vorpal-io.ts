import {
  Message,
  log,
  Wechaty,
}                   from 'wechaty'

import {
  Observable,
  Subject,
}                   from 'rxjs'
import {
  talkers,
  types,
}                   from 'wechaty-plugin-contrib'
import type { WechatyImpl } from 'wechaty/impls'

export interface ObsIo {
  stdin   : Observable<types.TalkerMessage>
  stdout  : Subject<types.TalkerMessage>
  stderr  : Subject<string>
  message : Message,
  wechaty : Wechaty,
}

class VorpalIo {

  static readonly busySet = new Set<string>()

  static from (message: Message) {
    return new this(message)
  }

  protected stdinSub?  : Subject<types.TalkerMessage>
  protected stdoutSub? : Subject<types.TalkerMessage>
  protected stderrSub? : Subject<string>

  protected readonly id: string

  constructor (
    protected message: Message,
  ) {
    log.verbose('VorpalIo', 'constructor(%s)', message)

    this.id = this.generateId()
  }

  protected generateId () {
    const talker  = this.message.talker()
    const room    = this.message.room()

    let id
    if (room) {
      id = `${talker.id}@${room.id}`
    } else {
      id = talker.id
    }

    // log.verbose('VorpalIo', 'id() = %s', id)
    return id
  }

  open (): ObsIo {
    log.verbose('VorpalIo', 'open()')

    if (this.busy()) {
      throw new Error(`Vorpal Io for ${this.id} is busy!`)
    }

    this.setBusy(true)

    return {
      message : this.message,
      stderr  : this.stderr(),
      stdin   : this.stdin(),
      stdout  : this.stdout(),
      wechaty : this.message.wechaty,
    }
  }

  busy (): boolean {
    log.verbose('VorpalIo', 'busy() for id=%s', this.id)

    const isBusy = VorpalIo.busySet.has(this.id)
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

  protected setBusy (busy: boolean): void {
    log.verbose('VorpalIo', 'setBusy(%s) for %s', busy, this.id)
    if (busy) {
      VorpalIo.busySet.add(this.id)
    } else {
      VorpalIo.busySet.delete(this.id)
    }
  }

  protected stdin (): Observable<types.TalkerMessage> {
    log.verbose('VorpalIo', 'stdin()')

    if (this.stdinSub) {
      return this.stdinSub.asObservable()
    }

    const vorpalRoom    = this.message.room()
    const vorpalTalker  = this.message.talker()

    // const vorpalMessage = this.message
    // let vorpalMention: boolean

    const sub = new Subject<types.TalkerMessage>()

    const onMessage = async (message: Message) => {
      log.verbose('VorpalIo', 'stdin() onMessage(%s)', message)

      if (message.talker() !== vorpalTalker)  { return }
      if (message.room() !== vorpalRoom)      { return }

      // if (typeof vorpalMention === 'undefined') {
      //   vorpalMention = await vorpalMessage.mentionSelf()
      // }
      // /**
      //  * Requires consistent in a command session:
      //  *  always mention the bot, or
      //  *  always not mention the bot
      //  */
      // const mention = await message.mentionSelf()
      // if (vorpalMention && !mention)  { return }
      // if (!vorpalMention && mention)  { return }

      const sayableMsg = await types.talkerMessageFrom(message)
      if (!sayableMsg)                { return }

      log.verbose('VorpalIo', 'stdin() onMessage() match', message)

      // Add io to the end of the task queue
      // setImmediate(() => sub.next(sayableMsg))

      sub.next(sayableMsg)

    }

    log.verbose('VorpalIo', 'stdin() registering onMessage() on wechaty.on(message) ... listenerCount: %s',
      (this.message.wechaty as WechatyImpl).listenerCount('message'),
    )
    this.message.wechaty.on('message', onMessage)

    this.stdinSub = sub
    const onComplete = () => {
      log.verbose('VorpalIo', 'stdin() onComplete() listenerCount: %s',
        (this.message.wechaty as WechatyImpl).listenerCount('message'),
      )

      this.message.wechaty.off('message', onMessage)

      log.verbose('VorpalIo', 'stdin() onComplete() wechaty.off(message)-ed listenerCount: %s',
        (this.message.wechaty as WechatyImpl).listenerCount('message'),
      )

      this.stdinSub = undefined
    }

    sub.subscribe({ complete: onComplete })

    return sub.asObservable()
  }

  protected stdout (): Subject<types.TalkerMessage> {
    log.verbose('VorpalIo', 'stdout()')

    if (this.stdoutSub) {
      return this.stdoutSub
    }

    const sub = new Subject<types.TalkerMessage>()

    this.stdoutSub = sub
    const onComplete = () => {
      log.verbose('VorpalIo', 'stdout() onComplete()')
      this.stdoutSub = undefined
    }

    const onNext = async (msg: types.TalkerMessage) => {
      log.verbose('VorpalIo', 'stdout() next(%s)', msg)

      const talk = talkers.messageTalker(msg)
      try {

        // Clean the task queue before talk
        // await new Promise(setImmediate)

        await talk(this.message)

      } catch (e) {
        log.error('VorpalIo', 'stdout() next(%s) rejection: %s', msg, e)
        console.error(e as Error)
      }
    }

    sub.subscribe({
      complete: onComplete,
      next: onNext,
    })

    return sub
  }

  protected stderr (): Subject<string> {
    log.verbose('VorpalIo', 'stderr()')

    if (this.stderrSub) {
      return this.stderrSub
    }

    const sub = new Subject<string>()

    this.stderrSub = sub
    const onComplete = () => {
      log.verbose('VorpalIo', 'stderr() onComplete()')
      this.stderrSub = undefined
    }

    const onNext = async (msg: types.TalkerMessage) => {
      log.verbose('VorpalIo', 'stderr() onNext(%s)', msg)
      const talk = talkers.messageTalker(msg)
      try {

        // Clean the task queue before talk
        // await new Promise(setImmediate)

        await talk(this.message)

      } catch (e) {
        log.error('VorpalIo', 'stderr() next() rejection: %s', e)
      }
    }

    sub.subscribe({
      complete: onComplete,
      next: onNext,
    })

    return sub
  }

}

export {
  VorpalIo,
}
