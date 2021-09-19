/// <reference path="./typings.d.ts" />

import {
  log,
}             from 'wechaty'

import stripAnsi from 'strip-ansi'

import { packageJson } from './package-json.js'

const VERSION = packageJson.version || '0.0.0'

export {
  log,
  stripAnsi,
  VERSION,
}
