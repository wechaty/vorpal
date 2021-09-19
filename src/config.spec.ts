#!/usr/bin/env -S node --no-warnings --loader ts-node/esm

import { test } from 'tstest'

import { stripAnsi } from './config.js'

test('stripAnsi', async t => {
  t.equal(typeof stripAnsi, 'function', 'should export stripAnsi function')
})
