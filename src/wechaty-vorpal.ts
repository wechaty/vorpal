import {
  Wechaty,
  WechatyPlugin,
  log,
  Message,
}                   from 'wechaty'
import {
  matchers,
}                   from 'wechaty-plugin-contrib'

import Vorpal       from 'vorpal'
import {
  simpleExec,
}                   from './stdout-assembler'

export interface WechatyVorpalConfig {
  use: string[],

  contact? : matchers.ContactMatcherOptions,
  room?    : matchers.RoomMatcherOptions,
}

function WechatyVorpal (config: WechatyVorpalConfig): WechatyPlugin {
  log.verbose('WechatyVorpal', 'WechatyVorpal(%s)', JSON.stringify(config))

  const matchContact = matchers.contactMatcher(config.contact)
  const matchRoom    = matchers.roomMatcher(config.room)

  const vorpal = new Vorpal()

  config.use.forEach(m => vorpal.use(m))
  log.verbose('WechatyVorpal', 'WechatyVorpal() %s vorpal module installed', config.use.length)

  return function WechatyVorpalPlugin (wechaty: Wechaty) {
    log.verbose('WechatyVorpal', 'WechatyVorpalPlugin(%s)', wechaty)

    wechaty.on('message', async message => {
      const room = message.room()
      const from = message.from()

      if (room) {
        if (!await matchRoom(room))             { return }
      } else if (from) {
        if (!await matchContact(from))          { return }
      } else                                    { return }

      if (message.type() !== Message.Type.Text) { return }

      const command = message.text()

      const stdout = await simpleExec(vorpal, command)
      await message.say(stdout)
    })
  }
}

export { WechatyVorpal }
