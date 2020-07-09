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
  MappedMessage,
}                   from 'wechaty-plugin-contrib/src/mappers/message-mapper'
import {
  Vorpal,
  StdoutAssembler,
  simpleExec,
}                   from './vorpal/mod'
import { VorpalIo } from './vorpal-io'

// TODO(huan): move SayableMessage to Wechaty
export type SayableMessage = MappedMessage

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
  if (exit) { exit.remove() }

  /**
   * Load all Vorpal Extensions
   */
  const extensionList = config.use
    ? Array.isArray(config.use)
      ? config.use
      : [ config.use ]
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
        const ret = await simpleExec(vorpal, command, obsio)
        void ret  // ret is the return of the action of vorpal command
      } finally {
        io.close()
      }

      // /**
      //  * If our Vorpal command returns an Observable,
      //  * Then it must a stream of `mappers.MessageMapperOptions`
      //  * Which will be used to create messages
      //  */
      // // TODO(huan): use a duck type to identify whether the ret is an Observable
      // if (ret instanceof Observable) {
      //   ret.subscribe(async (msg: SayableMessage) => {
      //     // const mapMessage = mappers.messageMapper(msg)
      //     // const msgList = await mapMessage(message)

      //     const talkMessage = talkers.messageTalker(msg)
      //     await talkMessage(message)
      //   })
      // }

    }

    wechaty.on('message', onMessage)
    return () => void wechaty.off('message', onMessage)

  }
}

export { WechatyVorpal }
