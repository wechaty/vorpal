#!/usr/bin/env ts-node

import test  from 'tstest'

import Vorpal, {
  Action,
  CommandInstance,
}                   from 'vorpal'

import {
  StdoutAssembler,
  simpleExec,
}                   from './stdout-assembler'

test('stdout assembler', async t => {
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

  const stdout = await simpleExec(vorpal, 'foo')
  t.equal(stdout, EXPECTED_TEXT, 'should get the expected stdout')
})
