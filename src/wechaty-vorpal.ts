import {
  Wechaty,
  WechatyPlugin,
  Message,
  log,
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

  /**
   * Use StdoutAssembler to redirect stdout to buffer
   */
  vorpal.use(StdoutAssembler())

  /**
   * Remove the default `exit` command
   */
  const exit = vorpal.find('exit')
  if (exit) {
    exit.remove()
  }

  /**
   * Load all Vorpal Extentions
   */
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

  /**
   * Connect with Wechaty
   */
  return function WechatyVorpalPlugin (wechaty: Wechaty) {
    log.verbose('WechatyVorpal', 'WechatyVorpalPlugin(%s)', wechaty)

    wechaty.on('message', async message => {
      const room = message.room()
      const from = message.from()

      if (message.self())                           { return }

      if (room) {
        if (!await matchRoom(room))                 { return }

        const atSelf = await message.mentionSelf()
        if (config.at && !atSelf)                   { return }

      } else if (from) {
        if (!await matchContact(from))              { return }

      } else                                        { return }

      if (message.type() !== Message.Type.Text)     { return }

      const command = message.text()

      const simpleResult = await simpleExec(vorpal, command)

      if (simpleResult.stdout) {
        await message.say(simpleResult.stdout)
      }

      if (simpleResult.ret) {
        let retList
        if (Array.isArray(simpleResult.ret)) {
          retList = simpleResult.ret
        } else {
          retList = [ simpleResult.ret ]
        }
        for (const ret of retList) {
          if (ret instanceof Function) {
            await ret(message)
          }
          await message.say(msg)
        }
      }
    })
  }
}

export { WechatyVorpal }
