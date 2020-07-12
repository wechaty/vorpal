#!/usr/bin/env ts-node

import {
  test,
}          from 'tstest'

import { createFixture } from 'wechaty'

import {
  Vorpal,
  CommandInstance,
}                   from './vorpal/mod'

import { VorpalIo } from './vorpal-io'

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

    const future = vorpal.exec('ask', undefined, io.open())
    await new Promise(setImmediate)

    t.deepEqual(fixture.moList[0].text(), QUESTION, 'should send QUESTION to fixture')

    io.getStdinSub()!.next(ANSWER)
    await future  // execute the ask

    t.equal(answer, ANSWER, 'should get the answer from ask')

    io.close()
  }
})
