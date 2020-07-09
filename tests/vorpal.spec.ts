#!/usr/bin/env ts-node

import test  from 'tstest'

import {
  Action,
  CommandInstance,
  Vorpal,
  Args,
}                   from '../src/vorpal/mod'

import { VorpalIo } from '../src/vorpal-io'

import {
  messageFixture,
}                   from './message-fixture.spec'

test('smoke testing', async t => {
  const vorpal = new Vorpal()

  vorpal.version('1.2.3')
  t.equal((vorpal as any).meta.version, '1.2.3', 'set the version')
})

test('command() foo', async t => {
  const vorpal = new Vorpal()

  let actualArgs
  const fooAction: Action = async function (
    args: Args,
  ) {
    /**
     * This action function is take from the vorpal official unit test
     */
    actualArgs = args
  }

  vorpal
    .command('foo [bars...]')
    .option('-t --test', 'test')
    .action(fooAction)

  const EXPECTED_ARGS = {
    bars: [
      'bar1',
      'bar2',
    ],
    options: {
      test: true,
    },
    rawCommand: 'foo bar1 bar2 -t',
  }
  await vorpal.exec('foo bar1 bar2 -t')
  t.deepEqual(actualArgs, EXPECTED_ARGS, 'should execute a command with no options')
})

test('command() stdout pipe redirect', async t => {
  const EXPECTED_TEXT = 'vorpal for chatbot'

  const vorpal = new Vorpal()
  const fooAction: Action = async function (
    this: CommandInstance,
  ) {
    this.log(EXPECTED_TEXT)
  }

  let output = ''
  const collect: Action = async function (
    this: CommandInstance,
    args: Args,
  ) {
    output = args.stdin[0]
  }

  vorpal
    .command('foo')
    .action(fooAction)

  vorpal
    .command('collect')
    .action(collect)

  await vorpal.exec('foo | collect')

  t.deepEqual(output, EXPECTED_TEXT, 'should execute a command and get the output')
})

test.skip('hacker-news', async t => {
  const vorpal = new Vorpal()

  vorpal.use(require('vorpal-hacker-news'))

  const fixture = messageFixture()
  const io = VorpalIo.from(fixture.message)

  const ret = await vorpal.exec('hacker-news --length 3', undefined, {
    message: fixture.message,
    obsio: io.obsio(),
  })

  t.true(/points/i.test(String(ret)), 'should include "points" form hacker news ret')
  t.true(/Hacker News/i.test(fixture.input[0]), 'should get the stdout with hacker news')
})

test('Vorpal help command with options', async t => {
  const EXPECTED_RE = /-t --option +test option/

  const vorpal = new Vorpal()
  vorpal
    .command('foo')
    .option('-t --option', 'test option')
    .action(async () => {})

  const fixture = messageFixture()
  const io = VorpalIo.from(fixture.message)

  await vorpal.exec('help foo', undefined, {
    message: fixture.message,
    obsio: io.obsio(),
  })
  await new Promise(resolve => setImmediate(resolve))

  t.true(EXPECTED_RE.test(fixture.input[0][0]), 'should get the help stdout with options message')
})

test('Vorpal compatibility: command actions that call this.log() twice', async t => {
  const EXPECTED_INPUT = [
    ['one'],
    ['two'],
  ]

  const vorpal = new Vorpal()
  vorpal
    .command('log_twice')
    .action(async function (this: any) {
      this.log('one')
      this.log('two')
    })

  const fixture = messageFixture()
  const io = VorpalIo.from(fixture.message)

  await vorpal.exec('log_twice', undefined, {
    message: fixture.message,
    obsio: io.obsio(),
  })
  // FIXME(huan): remove the 2500 timer
  await new Promise(resolve => setTimeout(resolve, 2500))

  t.deepEqual(fixture.input, EXPECTED_INPUT, 'should get one/two as fixture input')
})

test('Vorpal compatibility: command actions that return a str', async t => {
  const TEXT = 'str'

  const vorpal = new Vorpal()
  vorpal
    .command('ret_str')
    .action(async function (this: any) {
      return TEXT as any
    })

  const fixture = messageFixture()
  const io = VorpalIo.from(fixture.message)

  const ret = await vorpal.exec('ret_str', undefined, {
    message: fixture.message,
    obsio: io.obsio(),
  })
  await new Promise(resolve => setImmediate(resolve))

  t.equal(ret, TEXT, 'should get TEXT from return string')
})

test('Vorpal compatibility: command actions with a callback', async t => {
  const TEXT = 'callback text'

  const vorpal = new Vorpal()
  vorpal
    .command('callback')
    .action(function (this: any, args: any, callback: any) {
      void args
      setImmediate(() => callback(undefined, TEXT))
    })

  const fixture = messageFixture()
  const io = VorpalIo.from(fixture.message)

  const ret = await vorpal.exec('callback', undefined, {
    message: fixture.message,
    obsio: io.obsio(),
  })
  await new Promise(resolve => setImmediate(resolve))

  t.deepEqual(ret, TEXT, 'should get TEXT from callback')
})

test('Vorpal compatibility: command actions log with a callback', async t => {
  const TEXT_LOG = 'log text'
  const TEXT_CB = 'callback text'

  const vorpal = new Vorpal()
  vorpal
    .command('callback')
    .action(function (this: any, args: any, callback) {
      void args
      this.log(TEXT_LOG)
      setImmediate(() => callback(undefined, TEXT_CB))
    })

  const fixture = messageFixture()
  const io = VorpalIo.from(fixture.message)

  const ret = await vorpal.exec('callback', undefined, {
    message: fixture.message,
    obsio: io.obsio(),
  })
  await new Promise(resolve => setTimeout(resolve))

  t.equal(ret, TEXT_CB, 'should use callback data as ret')
  t.deepEqual(fixture.input, [[TEXT_LOG]], 'should get TEXT_LOG from log')
})
