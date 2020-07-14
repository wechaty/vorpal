import { log }    from 'wechaty'
import { types }  from 'wechaty-plugin-contrib'
import {
  take,
  mapTo,
}                from 'rxjs/operators'
import {
  timer,
  merge,
}                 from 'rxjs'

import { ObsIo } from './vorpal-io'

interface AskOptions {
  /**
   * in seconds
   */
  timeout?: number,
  default?: string,
}

function asker (io: ObsIo) {
  log.verbose('WechatyVorpal', 'asker(%s)', io.message)

  return async function ask (
    question: string,
    options: AskOptions = {},
  ): Promise<types.SayableMessage> {
    log.verbose('WechatyVorpal', 'ask(%s, %s)', question, JSON.stringify(options))

    const normalizedOptions = {
      timeout: 60,
      ...options,
    }

    const timeout = normalizedOptions.timeout

    if (!Number.isInteger(timeout)) {
      throw new Error('WechatyVorpal ask(): timeout must be integer. we got: ' + timeout)
    }
    if (timeout <= 0 || timeout >= 24 * 60 * 60) {
      throw new Error('WechatyVorpal ask(): timeout(in seconds) must >= 0 && < 86400 (1 day). we got: ' + timeout)
    }

    io.stdout.next(question)

    // console.info('timeout:', timeout)
    // console.info('default:', options.default)

    const answer = await merge(
      io.stdin,
      /**
       * Timeout. Set to default
        */
      timer(timeout * 1000).pipe(
        mapTo(options.default),
      )
    ).pipe(take(1)).toPromise()

    // console.info('answer:', answer)
    return answer
  }
}

export { asker }
