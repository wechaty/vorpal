#!/usr/bin/env ts-node

import test  from 'tstest'

import {
  Vorpal,
  Action,
  CommandInstance,
}                   from './mod'

import {
  StdoutAssembler,
  simpleExec,
}                   from './stdout-assembler'

test('stdout assembler for known command', async t => {
  const EXPECTED_TEXT = 'vorpal for chatbot'

  const vorpal = new Vorpal()

  vorpal.use(StdoutAssembler())

  const fooAction: Action = async function (
    this: CommandInstance,
  ) {
    this.log(EXPECTED_TEXT)
  }

  vorpal
    .command('foo')
    .action(fooAction)

  const ret = await simpleExec(vorpal, 'foo')
  t.equal(ret.stdout, EXPECTED_TEXT, 'should get the expected stdout')
})

test.skip('stdout assembler for unknown command', async t => {
  const EXPECTED_TEXT_RE = /Invalid Command/i

  const vorpal = new Vorpal()

  vorpal.use(StdoutAssembler())

  const { stdout } = await simpleExec(vorpal, 'unknown_command')
  t.true(EXPECTED_TEXT_RE.test(stdout), 'should get the expected invalid command message')
})
