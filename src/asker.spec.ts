#!/usr/bin/env -S node --no-warnings --loader ts-node/esm

import {
  test,
  // sinon,
}          from 'tstest'

import {
  WechatyBuilder,
}                     from 'wechaty'

import {
  PuppetMock,
  mock,
}                     from 'wechaty-puppet-mock'
import {
  createFixture,
}                     from 'wechaty-mocker'
import {
  Vorpal,
  CommandContext,
}                   from './vorpal/mod.js'

import { VorpalIo } from './vorpal-io.js'

import { WechatyVorpal } from './wechaty-vorpal.js'

class VorpalIoTest extends VorpalIo {

  getStdinSub ()  { return this.stdinSub }
  getStdoutSub () { return this.stdoutSub }
  getStderrSub () { return this.stderrSub }

}

test('ask()', async t => {
  for await (const fixture of createFixture()) {
    const vorpal = new Vorpal()

    const io = new VorpalIoTest(fixture.wechaty.message)

    const QUESTION = 'how are you?'
    const ANSWER   = 'fine, thank you.'

    let answer: undefined | string

    vorpal.command('ask')
      .action(async function action (this: CommandContext) {
        const msg = await this.ask(QUESTION)
        if (typeof msg === 'string') {
          answer = msg
        }
      })

    try {
      const obsio = io.open()
      const future = vorpal.exec('ask', undefined, obsio)
      await new Promise(setImmediate)

      t.same(fixture.moList[0]!.text(), QUESTION, 'should send QUESTION to fixture')

      io.getStdinSub()!.next(ANSWER)
      await future  // execute the ask

      t.equal(answer, ANSWER, 'should get the answer from ask')
    } finally {
      io.close()
    }
  }
})

test('asker() with mocker', async t => {
  /**
   * Install Vorpal Plugin & Ask Extension
   */
  const DING    = 'ding'
  const DONG    = 'dong'
  const COMMAND = 'dingdong'

  let ANSWER: any

  const VorpalExtension = (vorpal: Vorpal) => {
    vorpal
      .command(COMMAND)
      .action(async function action (this: CommandContext) {
        ANSWER = await this.ask(DING)
      })
  }

  const WechatyVorpalPlugin = WechatyVorpal({
    contact: true,
    use: VorpalExtension,
  })

  /**
   * Initialize Wechaty
   */
  const mocker = new mock.Mocker()
  const puppet = new PuppetMock({ mocker })
  const wechaty = WechatyBuilder.build({ puppet })

  wechaty.use(WechatyVorpalPlugin)
  await wechaty.start()

  const bot    = mocker.createContact({ name: 'Bot' })
  const player = mocker.createContact({ name: 'Player' })
  mocker.login(bot)

  /**
   * Answer Logic
   */
  const onPlayerMessage = (message: mock.MessageMock) => {
    const text = message.text()
    const talker = message.talker()
    if (text === DING) {
      player.say(DONG).to(talker)
    }
  }
  player.on('message', onPlayerMessage)

  player.say(COMMAND).to(bot)
  await new Promise(setImmediate)

  await wechaty.stop()

  t.equal(ANSWER, DONG, 'should get dong as the answer of the ask command')
})

/**
 * FIXME(huan, 202007): use sinon.useFakeTimers() to test the RxJS timer()
 */
test('ask() with timeout & default options', async t => {
  // const sandbox = sinon.createSandbox()
  // const clock = sandbox.useFakeTimers()

  const COMMAND  = 'ask'
  const QUESTION = 'how are you?'
  const ANSWER   = 'fine, thank you.'
  const TIMEOUT  = 1

  let answer: undefined | string

  async function askAction (this: CommandContext) {
    const msg = await this.ask(QUESTION, {
      default: ANSWER,
      timeout: TIMEOUT,
    })

    if (typeof msg === 'string') {
      answer = msg
    }
  }

  const extension = (vorpal: Vorpal) => {
    vorpal
      .command(COMMAND)
      .action(askAction)
  }

  const plugin = WechatyVorpal({
    contact: true,
    use: extension,
  })

  for await (const fixture of createFixture()) {
    fixture.wechaty.wechaty.use(plugin)

    fixture.mocker.player.say(COMMAND).to(fixture.mocker.bot)

    await new Promise(setImmediate)
    await new Promise(setImmediate)
    await new Promise(setImmediate)

    const future = new Promise(resolve => setTimeout(resolve, 1 + TIMEOUT * 1000))
    // clock.runToLast()
    // clock.runAll()
    // clock.runMicrotasks()
    // clock.runAll()
    // clock.tick(100000 + TIMEOUT * 1000)

    // clock.runToLast()
    await future

    // await new Promise(setImmediate)

    t.equal(answer, ANSWER, 'should get the answer from ask with timeout/default options')
  }

  // clock.restore()
  // sandbox.restore()
})
