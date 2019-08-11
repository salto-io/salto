import { EOL } from 'os'
import _ from 'lodash'
import yargonaut from 'yargonaut' // this must appear before the import from yargs
import yargs from 'yargs/yargs'
import { Argv, Arguments } from 'yargs'
import { WriteStream, CommandBuilder, YargsCommandBuilder } from './types'
import { registerBuilders } from './builder'

const LOGO_TEXT = '\u00B0 salto' // \u00B0 is for the salto 'dot'
const LOGO_FONT = 'standard'
const MAX_WIDTH = 100

const writeLogo = (outStream: WriteStream): void => {
  outStream.write(yargonaut.asFont(LOGO_TEXT, LOGO_FONT))
  outStream.write(EOL)
}

const onNoArgs = (parser: Argv, outStream: WriteStream): void => {
  if (outStream.isTTY) {
    writeLogo(outStream)
  }

  // Pending PR: https://github.com/yargs/yargs/pull/1386
  // @ts-ignore TS2345
  parser.showHelp((s: string) => outStream.write(s))

  outStream.write(EOL)
}

const showUsageComment = (parser: Argv, outStream: WriteStream): void => {
  // TODO: argv.$0 is undefined for some reason, need to open an issue/PR at yargs.
  // This is a workaround for now.
  // @ts-ignore TS2345
  const scriptName = parser.$0

  outStream.write(`See '${scriptName} --help' for usage information`)
  outStream.write(EOL)
}

const parserFailureHandler = (
  outStream: WriteStream, msg: string, err?: Error,
): void => {
  if (err && !msg) {
    throw err
  }

  outStream.write(msg)
  outStream.write(EOL)
}

const monkeyPatchShowHelpForColors = (parser: Argv, outStream: WriteStream): void => {
  // wrapping a function without changing its args
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  parser.showHelp = _.wrap(parser.showHelp, (savedShowHelp, ...args: any[]) => {
    if (outStream.isTTY && outStream.hasColors()) {
      yargonaut.style('green')
    }

    return savedShowHelp.call(parser, ...args)
  })
}

type AugmentedYargsParser = Argv & {
  hadError: boolean
}

const createYargsParser = (
  stderr: WriteStream,
): AugmentedYargsParser => {
  let hadError = false

  const parser = yargs()
    .strict()
    .completion('completion', false as unknown as string)
    .exitProcess(false)
    .help('h')
    .alias('h', 'help')
    .fail((msg, err) => {
      parserFailureHandler(stderr, msg, err)
      hadError = true
    })

  parser.wrap(Math.min(MAX_WIDTH, parser.terminalWidth()))

  monkeyPatchShowHelpForColors(parser, stderr)

  Object.defineProperty(parser, 'hadError', { get: () => hadError })

  return parser as AugmentedYargsParser
}

export type ParseResult =
  { status: 'command'; parsedArgs: Arguments; builder: CommandBuilder } |
  { status: 'error' } |
  { status: 'empty' }

const parse = (
  commandBuilders: YargsCommandBuilder[],
  { args }: { args: string[] },
  { stdout, stderr }: { stdout: WriteStream; stderr: WriteStream },
): Promise<ParseResult> => new Promise<ParseResult>((resolve, reject) => {
  const parser = createYargsParser(stderr)
  const commandSelected = registerBuilders(parser, commandBuilders)

  if (args.length === 0) {
    onNoArgs(parser, stderr)
    resolve({ status: 'error' })
    return
  }

  parser.parse(args, {}, (err, parsedArgs, outText) => {
    if (err) {
      reject(err)
      return
    }

    stdout.write(outText)

    // let the event loop process the commandSelected promise
    setTimeout(() => {
      if (parser.hadError) {
        stdout.write(EOL)
        showUsageComment(parser, stderr)
        resolve({ status: 'error' })
      } else if (commandSelected.done) {
        commandSelected.then(builder => resolve({ status: 'command', parsedArgs, builder }))
      } else { // "--help" or "--version"
        resolve({ status: 'empty' })
      }
    }, 0)
  })
})

export default parse
