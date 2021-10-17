/* eslint-disable sort-keys */
import type {
  MatchParts,
  ParsedCommand,
}                   from '../types.js'
import type { Command }  from '../command.js'

/**
 * Run a raw command string, e.g. foo -bar against a given list of commands,
 * and if there is a match, parse the results.
 */
export function matchCommand (
  commandName: string,
  commands: Command[] = [],
): MatchParts<string> {
  const parts = String(commandName)
    .trim()
    .split(' ')
  let match: undefined | null | Command = null
  let matchArgs = ''

  for (let i = 0; i < parts.length; i += 1) {
    const subCommandName = String(parts.slice(0, parts.length - i).join(' ')).trim()

    match = commands.find(command => command._name === subCommandName) || match

    if (!match) {
      match = commands.find(command => command._aliases.includes(subCommandName)) || match
    }

    if (match) {
      matchArgs = parts.slice(parts.length - i, parts.length).join(' ')
      break
    }
  }

  // If there's no command match, check if the there's a `catch` command,
  // which catches all missed commands.
  if (!match) {
    match = commands.find(command => command._default)

    // If there is one, we still need to make sure we aren't
    // partially matching command groups, such as `do things` when
    // there is a command `do things well`. If we match partially,
    // we still want to show the help menu for that command group.
    if (match) {
      let wordMatch = false

      commands.some(command => {
        const catchParts = String(command._name).split(' ')
        const commandParts = String((match && (match as any).command) || '').split(' ')
        let matchAll = true

        for (let i = 0; i < commandParts.length; i += 1) {
          if (catchParts[i] !== commandParts[i]) {
            matchAll = false
            break
          }
        }

        if (matchAll) {
          wordMatch = true

          return true
        }

        return false
      })

      // Huan(202110): FIXME: remove the eslint-disable
      // eslint-disable-next-line
      if (wordMatch) {
        match = undefined
      } else {
        matchArgs = commandName
      }
    }
  }

  return {
    args: matchArgs,
    command: match || null,
  }
}

/**
 * This will expand to contain one boolean key for each type of quote.
 * The value keyed by the quote is toggled off and on as quote type is opened and closed.
 * Example { "`": true, "'": false } would mean that there is an open angle quote.
 */
interface QuoteTracker {
  '`'?: boolean
  '"'?: boolean
  "'"?: boolean
}

/**
 * Prepares a command and all its parts for execution.
 */
export function parseCommand (command: string, commands: Command[] = []): ParsedCommand {
  const parsed = {
    pipes: [],
    match: null,
    matchArgs: '',
    command,
  } as ParsedCommand

  let matchParts = matchCommand(command, commands)

  function parsePipes () {
    // First, split the command by pipes naively.
    // This will split command arguments in half when the argument contains a pipe character.
    // Say "(Vorpal|vorpal)" will be split into ['say "(Vorpal', 'vorpal)'] which isn't good.
    const naivePipes = String(parsed.command)
      .trim()
      .split('|')

    // Construct empty array to place correctly split commands into.
    const newPipes = [] as string[]

    // We will look for pipe characters within these quotes to rejoin together.
    const quoteChars = ['"', "'", '`'] as const
    const includeQuotaChar = (char: string): char is '"' | "'" | '`' => {
      return quoteChars.includes(char as any)
    }

    const quoteTracker: QuoteTracker = {}

    // The current command piece before being rejoined with it's over half.
    // Since it's not common for pipes to occur in commands,
    // this is usually the entire command pipe.
    let commandPart = ''

    // Loop through each naive pipe.
    naivePipes.forEach((possiblePipe, index) => {
      // It's possible/likely that this naive pipe is the whole pipe
      // if it doesn't contain an unfinished quote.
      commandPart += possiblePipe

      // Loop through each individual character in the possible pipe
      // tracking the opening and closing of quotes.
      for (let i = 0; i < possiblePipe.length; i += 1) {
        // Huan(202110): remove the tailing ''
        const char = possiblePipe[i] || ''

        if (includeQuotaChar(char)) {
          quoteTracker[char] = !quoteTracker[char]
        }
      }

      // Does the pipe end on an unfinished quote?
      const inQuote = quoteChars.some(quoteChar => !!quoteTracker[quoteChar])

      // If the quotes have all been closed or this is the last
      // possible pipe in the array, add as pipe.
      if (!inQuote || index === naivePipes.length - 1) {
        newPipes.push(commandPart.trim())
        commandPart = ''

        // Quote was left open. The pipe character was previously
        // removed when the array was split.
      } else {
        commandPart += '|'
      }
    })

    // Set the first pipe to command and the rest to pipes.
    parsed.command = newPipes.shift()!
    parsed.pipes = parsed.pipes.concat(newPipes as any)
  }

  function parseMatch () {
    matchParts = matchCommand(parsed.command, commands)
    parsed.match = matchParts.command
    parsed.matchArgs = matchParts.args
  }

  parsePipes()
  parseMatch()

  if (parsed.match && typeof parsed.match._parse === 'function') {
    parsed.command = parsed.match._parse(parsed.command, matchParts.args || '')

    parsePipes()
    parseMatch()
  }

  return parsed
}
