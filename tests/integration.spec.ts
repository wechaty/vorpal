#!/usr/bin/env ts-node

import {
  test,
}             from 'tstest'

import { WechatyVorpal } from '../src/'

import {
  Wechaty,
}                               from 'wechaty'

import {
  PuppetMock,
}                 from 'wechaty-puppet-mock'

test.skip('integration testing', async (t) => {
  const VorpalPlugin = WechatyVorpal({ use: [] })

  const bot = Wechaty.instance({
    puppet: new PuppetMock(),
  }).use(VorpalPlugin)

  t.ok(bot, 'should get a bot')
})
