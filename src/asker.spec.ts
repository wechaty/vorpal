#!/usr/bin/env ts-node

import {
  test,
}          from 'tstest'

import {
  createFixture,
  Wechaty,
}                     from 'wechaty'

import {
  PuppetMock,
  mock,
}                         from 'wechaty-puppet-mock'

import {
  Vorpal,
  CommandInstance,
}                   from './vorpal/mod'

import { VorpalIo } from './vorpal-io'

import { WechatyVorpal } from './wechaty-vorpal'

class VorpalIoTest extends VorpalIo {

  getStdinSub ()  { return this.stdinSub }
  getStdoutSub () { return this.stdoutSub }
  getStderrSub () { return this.stderrSub }

}

test('ask()', async t => {
  for await (const fixture of createFixture()) {
    const vorpal = new Vorpal()

    const io = new VorpalIoTest(fixture.message)

    const QUESTION = 'how are you?'
    const ANSWER   = 'fine, thank you.'

    let answer: undefined | string

    vorpal.command('ask')
      .action(async function action (this: CommandInstance) {
        const msg = await this.ask(QUESTION)
        if (typeof msg === 'string') {
          answer = msg
        }
      })

    try {
      const obsio = io.open()
      const future = vorpal.exec('ask', undefined, obsio)
      await new Promise(setImmediate)

      t.deepEqual(fixture.moList[0].text(), QUESTION, 'should send QUESTION to fixture')

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
      .action(async function action (this: CommandInstance) {
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
  const wechaty = new Wechaty({ puppet })

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
