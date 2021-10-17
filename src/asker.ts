import {
  log,
}                   from 'wechaty'
import type { types }  from 'wechaty-plugin-contrib'
// eslint-disable-next-line
import { take }   from 'rxjs/operators'

import type { ObsIo } from './vorpal-io.js'

function asker (io: ObsIo) {
  log.verbose('WechatyVorpal', 'asker(%s)', io.message)

  return async function (question: string): Promise<types.TalkerMessage> {
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
