#!/usr/bin/env ts-node

import {
  test,
  sinon,
}          from 'tstest'

import {
  Contact,
  Message,
  Wechaty,
  Room,
}               from 'wechaty'
import {
  Subject,
  Observable,
}               from 'rxjs'

import { VorpalIo } from './vorpal-io'
import cuid from 'cuid'

const messageFixture = () => {
  const contactId = cuid() + '#contact'
  const roomId    = cuid() + '#room'
  const messageId = cuid() + '#message'

  const wechaty = new Wechaty({ puppet: 'wechaty-puppet-mock' })

  const output = [] as any[]
  wechaty.on('message', (...args: any[]) => output.push(args))

  const input = [] as any[]
  const message = {
    from: () => ({
      id: contactId,
    } as any as Contact),
    id: messageId,
    room: () => ({
      id: roomId,
    } as any as Room),
    say: (...args: any[]) => input.push(args),
    wechaty,
  } as any as Message

  return {
    input,
    message,
    output,
  }
}

class VorpalIoTest extends VorpalIo {

  getStdinSub () { return this.stdinSub }
  getStdoutSub () { return this.stdoutSub }
  getStderrSub () { return this.stderrSub }

}

test('VorpalIo smoke testing', async t => {
  const fixture = messageFixture()

  const io = VorpalIo.from(fixture.message)
  t.ok(io, 'should instantiate an instance of VorpalIo')
})

test('VorpalIo obsio()', async t => {
  const fixture = messageFixture()

  const io = VorpalIo.from(fixture.message)
  const obsio = io.obsio()

  t.true(obsio.stderr instanceof Subject, 'should get stderr as Subject')
  t.true(obsio.stdout instanceof Subject, 'should get stdout as Subject')
  t.true(obsio.stdin instanceof Observable, 'should get stdin as Subject')
})

test('VorpalIo busy()', async t => {
  const fixture = messageFixture()

  const io = new VorpalIoTest(fixture.message)
  t.false(io.busy(), 'should not busy right after initializing from message')

  const obsio = io.obsio()
  void obsio
  t.true(io.busy(), 'should be busy after get obsio()')

  io.close()
  t.false(io.busy(), 'should not busy after close()')
})

test('VorpalIo close()', async t => {
  const fixture = messageFixture()

  const io = new VorpalIoTest(fixture.message)

  const obsio = io.obsio()
  void obsio

  t.true(io.getStderrSub(), 'should be subscription after called obsio()')
  t.true(io.getStdoutSub(), 'should be subscription after called obsio()')
  t.true(io.getStdinSub(), 'should be subscription after called obsio()')

  io.close()

  t.false(io.getStderrSub(), 'should be undefined after close')
  t.false(io.getStdoutSub(), 'should be undefined after close')
  t.false(io.getStdinSub(), 'should be undefined after close')
})

test('VorpalIo obsio() stdout', async t => {
  const fixture = messageFixture()

  const io = new VorpalIoTest(fixture.message)
  const obsio = io.obsio()

  const TEXT = 'hello'

  obsio.stdout.next(TEXT)
  await new Promise(resolve => setImmediate(resolve))

  t.deepEqual(fixture.input, [[TEXT]], 'should pass stdout to wechaty')
})

test('VorpalIo obsio() stderr', async t => {
  const fixture = messageFixture()

  const io = new VorpalIoTest(fixture.message)
  const obsio = io.obsio()

  const TEXT = 'hello'

  obsio.stderr.next(TEXT)
  await new Promise(resolve => setImmediate(resolve))

  t.deepEqual(fixture.input, [[TEXT]], 'should pass stderr to wechaty')
})

test('VorpalIo obsio() stdin', async t => {
  const fixture = messageFixture()

  const io = new VorpalIoTest(fixture.message)
  const obsio = io.obsio()

  const spy = sinon.spy()
  obsio.stdin.subscribe(spy)

  const { message: MESSAGE } = messageFixture()
  fixture.message.wechaty.emit('message', MESSAGE)
  await new Promise(resolve => setImmediate(resolve))

  t.true(spy.called, 'should call say when stdin got something')
  t.equal(spy.args[0][0], MESSAGE, 'should get message from subscribe')
  t.deepEqual(spy.args, fixture.output, 'should match wechaty & obs')
})
