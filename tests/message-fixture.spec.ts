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

  const wechaty = new Wechaty({ puppet: 'wechaty-puppet-mock' })

  const output = [] as any[]
  wechaty.on('message', (...args: any[]) => output.push(args))

  const input = [] as any[]
  const message = {
    from: () => ({
      id: contactId,
    } as any as Contact),
    id: messageId,
    room: () => ({
      id: roomId,
    } as any as Room),
    say: (...args: any[]) => input.push(args),
    wechaty,
  } as any as Message

  return {
    input,
    message,
    output,
  }
}

export { messageFixture }
