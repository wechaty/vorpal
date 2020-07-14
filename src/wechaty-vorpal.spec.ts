#!/usr/bin/env ts-node

import {
  test,
}          from 'tstest'

import { createFixture } from 'wechaty'

import { WechatyVorpal } from './wechaty-vorpal'

test('WechatyVorpalConfig.silent = undefined | false', async t => {
  for await (const fixture of createFixture()) {

    const VorpalPlugin = WechatyVorpal({
      contact: true,
      // silent: false,
      use: () => {},
    })
    fixture.wechaty.use(VorpalPlugin)

    fixture.player.say('not_exist_command').to(fixture.bot)
    await new Promise(setImmediate)

    t.true(fixture.moList.length > 0, 'should show help message for unknown command')
  }
})

test('WechatyVorpalConfig.silent = true', async t => {
  for await (const fixture of createFixture()) {

    const VorpalPlugin = WechatyVorpal({
      contact: true,
      silent: true,
      use: () => {},
    })
    fixture.wechaty.use(VorpalPlugin)

    fixture.player.say('not_exist_command').to(fixture.bot)
    await new Promise(setImmediate)

    t.equal(fixture.moList.length, 0, 'should be silent for unknown command')
  }
})
