#!/usr/bin/env -S node --no-warnings --loader ts-node/esm
import {
  WechatyVorpal,
  VERSION,
}                       from 'wechaty-vorpal'

async function main () {
  if (typeof WechatyVorpal !== 'function') {
    throw new Error('WechatyVorpal is not a function')
  }

  if (VERSION === '0.0.0') {
    throw new Error('version should be set before publishing')
  }
  return 0
}

main()
  .then(process.exit)
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
