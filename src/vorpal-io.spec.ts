#!/usr/bin/env -S node --no-warnings --loader ts-node/esm

import {
  test,
  sinon,
}          from 'tstest'

import {
  Subject,
  Observable,
}               from 'rxjs'

import { createFixture } from 'wechaty-mocker'

import {
  Vorpal,
  Action,
  CommandContext,
}                   from './vorpal/mod.js'

import { VorpalIo } from './vorpal-io.js'

class VorpalIoTest extends VorpalIo {

  getStdinSub ()  { return this.stdinSub }
  getStdoutSub () { return this.stdoutSub }
  getStderrSub () { return this.stderrSub }

}

test('VorpalIo smoke testing', async t => {
  for await (const fixture of createFixture()) {
    const io = VorpalIo.from(fixture.wechaty.message)
    t.ok(io, 'should instantiate an instance of VorpalIo')
  }
})

test('VorpalIo obsio()', async t => {
  for await (const fixture of createFixture()) {
    const io = VorpalIo.from(fixture.wechaty.message)
    const obsio = io.open()

    t.ok(obsio.stderr instanceof Subject, 'should get stderr as Subject')
    t.ok(obsio.stdout instanceof Subject, 'should get stdout as Subject')
    t.ok(obsio.stdin instanceof Observable, 'should get stdin as Subject')
  }
})

test('VorpalIo busy()', async t => {
  for await (const fixture of createFixture()) {
    const io = new VorpalIoTest(fixture.wechaty.message)
    t.notOk(io.busy(), 'should not busy right after initializing from message')

    const obsio = io.open()
    void obsio
    t.ok(io.busy(), 'should be busy after get obsio()')

    io.close()
    t.notOk(io.busy(), 'should not busy after close()')
  }
})

test('VorpalIo close()', async t => {
  for await (const fixture of createFixture()) {
    const io = new VorpalIoTest(fixture.wechaty.message)

    const obsio = io.open()
    void obsio

    t.ok(io.getStderrSub(), 'should be subscription after called obsio()')
    t.ok(io.getStdoutSub(), 'should be subscription after called obsio()')
    t.ok(io.getStdinSub(),  'should be subscription after called obsio()')

    io.close()

    t.notOk(io.getStderrSub(), 'should be undefined after close')
    t.notOk(io.getStdoutSub(), 'should be undefined after close')
    t.notOk(io.getStdinSub(), 'should be undefined after close')
  }
})

test('VorpalIo obsio() stdout', async t => {
  for await (const fixture of createFixture()) {
    const io = new VorpalIoTest(fixture.wechaty.message)
    const obsio = io.open()

    const TEXT = 'hello'

    obsio.stdout.next(TEXT)
    await new Promise(setImmediate)

    t.same(fixture.moList[0]!.text(), TEXT, 'should pass stdout to wechaty')
  }
})

test('VorpalIo obsio() stderr', async t => {
  for await (const fixture of createFixture()) {

    const io = new VorpalIoTest(fixture.wechaty.message)
    const obsio = io.open()

    const TEXT = 'hello'

    obsio.stderr.next(TEXT)
    await new Promise(setImmediate)

    t.same(fixture.moList[0]!.text(), TEXT, 'should pass stderr to wechaty')
  }
})

test('VorpalIo obsio() stdin', async t => {
  for await (const fixture of createFixture()) {
    // console.info('fixture.wechaty.message.id:', fixture.wechaty.message.id)

    const io = new VorpalIoTest(fixture.wechaty.message)
    const obsio = io.open()

    const spy = sinon.spy()
    obsio.stdin.subscribe(spy)

    const TEXT = 'hello, world!'
    fixture.mocker.player.say(TEXT).to(fixture.mocker.bot)
    await new Promise(setImmediate)

    t.ok(spy.called, 'should call say when stdin got something')
    t.equal(spy.args[0]![0], TEXT, 'should get message from subscribe')
  }
})

/**
 *
 * Integration Tests with Vorpal
 *
 */

test('obsio for known command', async t => {
  const EXPECTED_TEXT = 'vorpal for chatbot'
  const EXPECTED_RET = 42

  const vorpal = new Vorpal()

  const fooAction: Action = async function (
    this: CommandContext,
  ) {
    this.log(EXPECTED_TEXT)
    return EXPECTED_RET
  }

  vorpal
    .command('foo')
    .action(fooAction)

  for await (const fixture of createFixture()) {
    const io = VorpalIo.from(fixture.wechaty.message)

    const ret = await vorpal.exec('foo', undefined, io.open())
    await new Promise(setImmediate)

    t.equal(ret, EXPECTED_RET, 'should return ' + EXPECTED_RET)
    t.same(fixture.moList[0]!.text(), EXPECTED_TEXT, 'should get the expected stdout')
  }
})

test('obsio for unknown command', async t => {
  const vorpal = new Vorpal()

  for await (const fixture of createFixture()) {
    const io = VorpalIo.from(fixture.wechaty.message)

    const ret = await vorpal.exec('unknown_command', undefined, io.open())
    await new Promise(setImmediate)

    t.equal(ret, 1, 'should return 1 for unknown command')
    t.same(fixture.moList[0]!.text(), 'Invalid command', 'should get the expected invalid command message')
  }
})

test('obsio with command instance', async t => {
  for await (const fixture of createFixture()) {
    const vorpal = new Vorpal()

    const io = VorpalIo.from(fixture.wechaty.message)

    const TEXT = 'test'
    const RET = 42

    vorpal.command('test')
      .action(async function action (this: CommandContext) {
        this.stdout.next(TEXT)
        return RET
      })

    // void io
    const ret = await vorpal.exec('test', undefined, io.open())
    await new Promise(setImmediate)

    t.equal(ret, RET, 'should return ' + RET + ' for test command')
    t.same(fixture.moList[0]!.text(), TEXT, 'should get the expected TEXT message')

    io.close()
  }
})

test('obsio with command instance return undefined', async t => {
  for await (const fixture of createFixture()) {
    const vorpal = new Vorpal()

    const io = VorpalIo.from(fixture.wechaty.message)

    vorpal.command('test')
      .action(async function action () {})

    // void io
    const ret = await vorpal.exec('test', undefined, io.open())
    await new Promise(setImmediate)

    t.equal(ret, 0, 'should return 0 for void action')

    io.close()
  }
})

test('obsio with message', async t => {
  for await (const fixture of createFixture()) {
    const vorpal = new Vorpal()

    const io = VorpalIo.from(fixture.wechaty.message)

    let message

    vorpal.command('test')
      .action(async function action (this: CommandContext) {
        message = this.message
      })

    await vorpal.exec('test', undefined, io.open())
    await new Promise(setImmediate)

    t.equal(message, fixture.wechaty.message, 'should return get the message from command instance')

    io.close()
  }
})

test('io.open() listener cleanup', async t => {
  for await (const fixture of createFixture()) {
    const NUM = fixture.wechaty.wechaty.listenerCount('message')

    const io = new VorpalIoTest(fixture.wechaty.message)
    t.equal(
      fixture.wechaty.wechaty.listenerCount('message'),
      NUM,
      'should not add listener on message after instantiated VorpalIo: ' + NUM,
    )

    io.open()
    t.equal(
      fixture.wechaty.wechaty.listenerCount('message'),
      NUM + 1,
      'should be 1 more listener on message after io.open()',
    )

    io.close()
    t.equal(
      fixture.wechaty.wechaty.listenerCount('message'),
      NUM,
      'should clean the listener on message after io.clos()',
    )
  }
})
