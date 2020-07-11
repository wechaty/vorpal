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
  take,
}                   from 'rxjs/operators'
import {
  talkers,
  types,
}                   from 'wechaty-plugin-contrib'

export interface ObsIo {
  stdin: Observable<types.SayableMessage>
  stdout: Subject<types.SayableMessage>
  stderr: Subject<string>
  message: Message,
  wechaty: Wechaty,
  prompt: (question: string) => Promise<types.SayableMessage>,
}

// FIXME(huan, 202007): fix the typing of this operator function!
// function addDelay <T> () {
//   return concatMap<T, any>(item => concat(
//     of(item),                 // emit first item right away
//     EMPTY.pipe(delay(1000)),  // delay next item
//   ))
// }

class VorpalIo {

  static busyState: {
    [id: string]: true
  } = {}

  static from (message: Message) {
    return new this(message)
  }

  protected stdinSub?  : Subject<types.SayableMessage>
  protected stdoutSub? : Subject<types.SayableMessage>
  protected stderrSub? : Subject<string>

  constructor (
    protected message: Message,
  ) {
    log.verbose('VorpalIo', 'constructor(%s)', message)
  }

  open (): ObsIo {
    log.verbose('VorpalIo', 'open()')

    if (this.busy()) {
      throw new Error(`Vorpal Io for ${this.message} is busy!`)
    }

    this.setBusy(true)

    return {
      message: this.message,
      prompt: this.prompt.bind(this),
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

  async prompt (question: string): Promise<types.SayableMessage> {
    log.verbose('VorpalIo', 'prompt(%s)', question)

    if (!this.busy()) {
      throw new Error('VorpalIo is not in duty(busy), can not use prompt()')
    }

    this.stdout().next(question)

    const answer = await this.stdin()
      .pipe(
        take(1),
      ).toPromise()

    return answer
  }

  protected id () {
    const talker  = this.message.talker()
    const room    = this.message.room()

    if (!talker) {
      // FIXME(huan, 202007): I can not remember why the message.form() could be undefined ...
      return cuid()
    }

    let id
    if (room) {
      id = `${talker.id}@${room.id}`
    } else {
      id = talker.id
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

  protected stdin (): Observable<types.SayableMessage> {
    log.verbose('VorpalIo', 'stdin()')

    if (this.stdinSub) {
      return this.stdinSub.asObservable()
    }

    const vorpalMessage = this.message
    const vorpalRoom    = this.message.room()
    const vorpalTalker  = this.message.talker()

    let vorpalMention: boolean

    const sub = new Subject<types.SayableMessage>()

    const onMessage = async (message: Message) => {
      log.verbose('VorpalIo', 'stdin() onMessage(%s)', message)

      if (message.talker() === vorpalTalker)  { return }
      if (message.room() === vorpalRoom)      { return }

      if (typeof vorpalMention === 'undefined') {
        vorpalMention = await vorpalMessage.mentionSelf()
      }
      /**
       * Requires consistent in a command session:
       *  always mention the bot, or
       *  always not mention the bot
       */
      const mention = await message.mentionSelf()
      if (vorpalMention && !mention)  { return }
      if (!vorpalMention && mention)  { return }

      const sayableMsg = await types.toSayableMessage(message)
      if (!sayableMsg)                { return }

      log.verbose('VorpalIo', 'stdin() onMessage() match', message)
      sub.next(sayableMsg)
    }

    log.verbose('VorpalIo', 'stdin() registering onMessage() on wechaty ...')
    this.message.wechaty.on('message', onMessage)

    this.stdinSub = sub
    const onComplete = () => {
      log.verbose('VorpalIo', 'stdin() onComplete()')
      this.message.wechaty.off('message', onMessage)
      this.stdinSub = undefined
    }

    sub.subscribe({ complete: onComplete })

    return sub.asObservable()
  }

  protected stdout (): Subject<types.SayableMessage> {
    log.verbose('VorpalIo', 'stdout()')

    if (this.stdoutSub) {
      return this.stdoutSub
    }

    const sub = new Subject<types.SayableMessage>()

    this.stdoutSub = sub
    const onComplete = () => {
      log.verbose('VorpalIo', 'stdout() onComplete()')
      this.stdoutSub = undefined
    }

    const onNext = async (msg: types.SayableMessage) => {
      log.verbose('VorpalIo', 'stdout() next(%s)', msg)

      const talk = talkers.messageTalker(msg)
      try {
        await talk(this.message)
      } catch (e) {
        log.error('VorpalIo', 'stdout() next() rejection: %s', e)
      }
    }

    // FIXME(huan): use an operator function to replace concatMap(...)
    sub.pipe(
      concatMap(item => concat(
        of(item),                 // emit first item right away
        EMPTY.pipe(delay(1000)),  // delay next item
      ))
    ).subscribe({
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

    const onNext = async (msg: types.SayableMessage) => {
      log.verbose('VorpalIo', 'stderr() onNext(%s)', msg)
      const talker = talkers.messageTalker(msg)
      try {
        await talker(this.message)
      } catch (e) {
        log.error('VorpalIo', 'stderr() next() rejection: %s', e)
      }
    }

    // FIXME: use an operator function to replace concatMap(...)
    sub.pipe(
      concatMap(item => concat(
        of(item),                 // emit first item right away
        EMPTY.pipe(delay(1000)),  // delay next item
      ))
    ).subscribe({
      complete: onComplete,
      next: onNext,
    })

    return sub
  }

}

export {
  VorpalIo,
}
