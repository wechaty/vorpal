import {
  Wechaty,
  WechatyPlugin,
  Message,
  log,
}                   from 'wechaty'
import {
  matchers,
}                   from 'wechaty-plugin-contrib'
import {
  Vorpal,
}                   from './vorpal/mod'
import { VorpalIo } from './vorpal-io'

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
   * Remove the default `exit` command
   */
  const exit = vorpal.find('exit')
  if (exit) { exit.remove() }

  /**
   * Load all Vorpal Extensions
   */
  const extensionList = config.use
    ? Array.isArray(config.use)
      ? config.use
      : [config.use]
    : []

  extensionList.forEach(m => vorpal.use(m))
  log.verbose('WechatyVorpal', 'WechatyVorpal() %s vorpal module installed', config.use.length)

  const matchPlugin = (message: Message): boolean => {
    if (message.self())                       { return false }
    if (message.type() !== Message.Type.Text) { return false }
    return true
  }

  const matchConfig = async (message: Message): Promise<boolean> => {
    const room = message.room()
    const from = message.from()

    if (room) {
      if (!await matchRoom(room))                 { return false }
      const atSelf = await message.mentionSelf()
      if (config.at && !atSelf)                   { return false }
    } else if (from) {
      if (!await matchContact(from))              { return false }
    } else                                        { return false }

    return true
  }

  /**
   * Connect with Wechaty
   */
  return function WechatyVorpalPlugin (wechaty: Wechaty) {
    log.verbose('WechatyVorpal', 'WechatyVorpalPlugin(%s)', wechaty)

    async function onMessage (message: Message) {

      if (!await matchPlugin(message))  { return }
      if (!await matchConfig(message))  { return }

      const io = VorpalIo.from(message)
      if (io.busy())                    { return }

      const command = await message.mentionText()

      try {
        const obsio = io.obsio()

        const ret = await vorpal.exec(
          command,
          undefined,
          obsio,
        )

        if (ret !== 0) {
          log.error('WechatyVorpal', 'WechatyVorpalPlugin() onMessage() command<%s> exit code %s', command, ret)
        }

      } finally {
        io.close()
      }

    }

    wechaty.on('message', onMessage)
    return () => wechaty.off('message', onMessage)

  }
}

export { WechatyVorpal }
