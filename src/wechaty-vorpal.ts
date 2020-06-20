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
  StdoutAssembler,
  simpleExec,
}                   from './stdout-assembler'

type VorpalExtensionFunction = (vorpal: Vorpal, options: any) => void
type VorpalExtension = string | VorpalExtensionFunction
type VorpalExtensions = VorpalExtension | VorpalExtension[]

export interface WechatyVorpalConfig {
  use: VorpalExtensions,

  contact? : matchers.ContactMatcherOptions,
  room?    : matchers.RoomMatcherOptions,
  at?      : boolean,
}

function WechatyVorpal (config: WechatyVorpalConfig): WechatyPlugin {
  log.verbose('WechatyVorpal', 'WechatyVorpal(%s)', JSON.stringify(config))

  const matchContact = matchers.contactMatcher(config.contact)
  const matchRoom    = matchers.roomMatcher(config.room)

  const vorpal = new Vorpal()
  vorpal.use(StdoutAssembler())

  let extensionList: VorpalExtension[] = []
  if (config.use) {
    if (Array.isArray(config.use)) {
      extensionList = config.use
    } else {
      extensionList = [ config.use ]
    }
  }

  extensionList.forEach(m => vorpal.use(m))
  log.verbose('WechatyVorpal', 'WechatyVorpal() %s vorpal module installed', config.use.length)

  return function WechatyVorpalPlugin (wechaty: Wechaty) {
    log.verbose('WechatyVorpal', 'WechatyVorpalPlugin(%s)', wechaty)

    wechaty.on('message', async message => {
      const room = message.room()
      const from = message.from()

      if (room) {
        if (!await matchRoom(room))                 { return }

        const atSelf = await message.mentionSelf()
        if (config.at && !atSelf)                   { return }

      } else if (from) {
        if (!await matchContact(from))              { return }

      } else                                        { return }

      if (message.type() !== Message.Type.Text)     { return }

      const command = message.text()

      const stdout = await simpleExec(vorpal, command)
      await message.say(stdout)
    })
  }
}

export { WechatyVorpal }
