import {
  Contact,
  Message,
  Room,
  Wechaty,
}           from 'wechaty'
import cuid from 'cuid'

const messageFixture = () => {
  const contactId = cuid() + '#contact'
  const roomId    = cuid() + '#room'
  const messageId = cuid() + '#message'
  const text = cuid() + '#text'

  const wechaty = new Wechaty({ puppet: 'wechaty-puppet-mock' })

  const output = [] as any[]
  wechaty.on('message', (...args: any[]) => output.push(args))

  const input = [] as any[]
  const message = {
    id: messageId,
    mentionSelf: () => false,
    room: () => ({
      id: roomId,
    } as any as Room),
    say: (...args: any[]) => input.push(args),
    talker: () => ({
      id: contactId,
    } as any as Contact),
    text: () => text,
    type: () => Message.Type.Text,
    wechaty,
  } as any as Message

  return {
    input,
    message,
    output,
  }
}

export { messageFixture }
