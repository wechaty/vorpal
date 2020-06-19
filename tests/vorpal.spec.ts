#!/usr/bin/env ts-node

import test  from 'tstest'

import Vorpal, {
  Action,
  CommandInstance,
}                   from 'vorpal'

test('smoke testing', async t => {
  const vorpal = new Vorpal()

  vorpal.version('1.2.3')
  t.equal((vorpal as any)._version, '1.2.3', 'set the version')
})

test('command() foo', async t => {
  const vorpal = new Vorpal()
  const fooAction: Action = async function (
    this: CommandInstance,
    args,
  ) {
    /**
     * This action function is take from the vorpal official unit test
     */
    return args as any
  }

  vorpal
    .command('foo [bars...]')
    .option('-t --test', 'test')
    .action(fooAction)

  const fixture = {
    bars: [
      'bar1',
      'bar2',
    ],
    options: {
      test: true,
    },
  }
  const result = await vorpal.execSync('foo bar1 bar2 -t')
  t.deepEqual(result, fixture, 'should execute a command with no options')
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
    args,
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
