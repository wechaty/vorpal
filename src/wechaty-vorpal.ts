import {
  Wechaty,
  WechatyPlugin,
  Message,
  log,
}                   from 'wechaty'
import {
  matchers,
  mappers,
  talkers,
}                   from 'wechaty-plugin-contrib'
import {
  Observable,
}                   from 'rxjs'
import Vorpal       from 'vorpal'

import {
  StdoutAssembler,
  simpleExec,
}                   from './stdout-assembler'

export type WechatyVorpalMessageObservable = Observable<mappers.MessageMapperOptions>

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

      const command = await message.mentionText()

      const {
        stdout,
        ret,
      }           = await simpleExec(vorpal, command)

      if (stdout) {
        await message.say(stdout)
      }

      /**
       * If our Vorpal command returns an Observable,
       * Then it must a stream of `mappers.MessageMapperOptions`
       * Which will be used to create messages
       */
      // TODO(huan): use a duck type to identify whether the ret is an Observable
      if (ret instanceof Observable) {
        ret.subscribe(async (options: mappers.MessageMapperOptions) => {
          const mapMessage = mappers.messageMapper(options)
          const msgList = await mapMessage(message)

          const talkMessage = talkers.messageTalker(msgList)
          await talkMessage(message)
        })
      }

    })
  }
}

export { WechatyVorpal }
