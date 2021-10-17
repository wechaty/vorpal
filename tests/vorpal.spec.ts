#!/usr/bin/env -S node --no-warnings --loader ts-node/esm

import { test } from 'tstest'

import {
  createFixture,
}                   from 'wechaty-mocker'

import vorpalHackerNews from 'vorpal-hacker-news'
import inGfw from 'in-gfw'

import '../src/config.js'

import {
  Action,
  CommandContext,
  Vorpal,
  Args,
}                   from '../src/vorpal/mod.js'

import { VorpalIo } from '../src/vorpal-io.js'

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
  t.same(actualArgs, EXPECTED_ARGS, 'should execute a command with no options')
})

test('command() stdout pipe redirect', async t => {
  const EXPECTED_TEXT = 'vorpal for chatbot'

  const vorpal = new Vorpal()
  const fooAction: Action = async function (
    this: CommandContext,
  ) {
    this.log(EXPECTED_TEXT)
  }

  let output = ''
  const collect: Action = async function (
    this: CommandContext,
    args: Args,
  ) {
    output = args['stdin']![0]!
  }

  vorpal
    .command('foo')
    .action(fooAction)

  vorpal
    .command('collect')
    .action(collect)

  await vorpal.exec('foo | collect')

  t.same(output, EXPECTED_TEXT, 'should execute a command and get the output')
})

test('hacker-news', async t => {
  if (await inGfw()) {
    await t.skip('Skip Hacker News testing when in gfw')
    return
  }

  for await (const fixture of createFixture()) {
    const vorpal = new Vorpal()

    vorpal.use(vorpalHackerNews)

    const io = VorpalIo.from(fixture.wechaty.message)

    const ret = await vorpal.exec('hacker-news --length 1', undefined, io.open())
    await new Promise(setImmediate)

    t.ok(/points/i.test(String(ret)), 'should include "points" form hacker news ret')
    t.ok(/Hacker News/i.test(fixture.moList[0]!.text()), 'should get the stdout with hacker news')
  }
})

test('Vorpal help command with options', async t => {
  for await (const fixture of createFixture()) {
    const EXPECTED_RE = /-t --option +test option/

    const vorpal = new Vorpal()
    vorpal
      .command('foo')
      .option('-t --option', 'test option')
      .action(async () => {})

    const io = VorpalIo.from(fixture.wechaty.message)

    await vorpal.exec('help foo', undefined, io.open())
    await new Promise(setImmediate)

    t.ok(
      EXPECTED_RE.test(
        fixture.moList[0]!.text(),
      ),
      'should get the help stdout with options message',
    )
  }
})

test('Vorpal compatibility: command actions that call this.log() multiple times', async t => {
  for await (const fixture of createFixture()) {
    const TEXT_LIST = [
      'one',
      'two',
      'three',
    ]
    const COMMAND = 'log_multiple_times'

    const vorpal = new Vorpal()
    vorpal
      .command(COMMAND)
      .action(async function (this: CommandContext) {
        TEXT_LIST.forEach(t => this.log(t))
      })

    const io = VorpalIo.from(fixture.wechaty.message)

    await vorpal.exec(COMMAND, undefined, io.open())
    await new Promise(setImmediate)

    // FIXME(huan): remove the 2500 timer
    await new Promise(resolve => setTimeout(resolve, 2500))

    t.equal(fixture.moList.length, TEXT_LIST.length, 'should receive all TEXT_LIST')
    for (let i = 0; i < TEXT_LIST.length; i++) {
      t.ok(fixture.moList[i], `should exist moList for ${i}`)
      t.same(fixture.moList[i]!.text(), TEXT_LIST[i], `should get TEXT_LIST[${i}]`)
    }
  }
})

test('Vorpal compatibility: command actions that return a str', async t => {
  for await (const fixture of createFixture()) {
    const TEXT = 'str'

    const vorpal = new Vorpal()
    vorpal
      .command('ret_str')
      .action(async function (this: any) {
        return TEXT as any
      })

    const io = VorpalIo.from(fixture.wechaty.message)

    const ret = await vorpal.exec('ret_str', undefined, io.open())
    await new Promise(setImmediate)

    t.equal(ret, TEXT, 'should get TEXT from return string')
  }
})

test('Vorpal compatibility: command actions with a callback', async t => {
  for await (const fixture of createFixture()) {
    const TEXT = 'callback text'

    const vorpal = new Vorpal()
    vorpal
      .command('callback')
      .action(function (this: any, args: any, callback: any) {
        void args
        setImmediate(() => callback(undefined, TEXT))
      })

    const io = VorpalIo.from(fixture.wechaty.message)

    const ret = await vorpal.exec('callback', undefined, io.open())
    await new Promise(setImmediate)

    t.same(ret, TEXT, 'should get TEXT from callback')
  }
})

test('Vorpal compatibility: command actions log with a callback', async t => {
  for await (const fixture of createFixture()) {
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

    const io = VorpalIo.from(fixture.wechaty.message)

    const ret = await vorpal.exec('callback', undefined, io.open())
    await new Promise(resolve => setTimeout(resolve))

    t.equal(ret, TEXT_CB, 'should use callback data as ret')
    t.equal(fixture.moList[0]!.text(), TEXT_LOG, 'should get TEXT_LOG from log')
  }
})
