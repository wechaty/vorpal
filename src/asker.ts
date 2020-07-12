import { log }    from 'wechaty'
import { types }  from 'wechaty-plugin-contrib'
import { take }   from 'rxjs/operators'

import { ObsIo } from './vorpal-io'

function asker (io: ObsIo) {
  log.verbose('WechatyVorpal', 'asker(%s)', io.message)

  return async function (question: string): Promise<types.SayableMessage> {
    log.verbose('WechatyVorpal', 'ask(%s)', question)

    io.stdout.next(question)

    const answer = await io.stdin
      .pipe(
        take(1),
      ).toPromise()

    return answer
  }
}

export { asker }
