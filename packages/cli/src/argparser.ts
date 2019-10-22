import { EOL } from 'os'
import yargonaut from 'yargonaut' // this must appear before the import from yargs
import yargs from 'yargs/yargs'
import { Argv, Arguments } from 'yargs'
import chalk from 'chalk'
import { WriteStream } from './types'
import { registerBuilders, YargsCommandBuilder, CommandBuilder } from './builder'

const LOGO_TEXT = '\u00B0 salto' // \u00B0 is for the salto 'dot'
const LOGO_FONT = 'Standard'
const MAX_WIDTH = 100
const DO_NOT_SHOW = '***<><><>DO NOT SHOW THIS ERROR<><><>***'
const USAGE_PREFIX = chalk.bold('Usage: ')

const writeLogo = (outStream: WriteStream): void => {
  outStream.write(yargonaut.asFont(LOGO_TEXT, LOGO_FONT))
  outStream.write(EOL)
}

const showHelpMessage = (parser: Argv, outStream: WriteStream): void => {
  // Pending PR: https://github.com/yargs/yargs/pull/1386
  // @ts-ignore TS2345
  parser.showHelp((s: string) => {
    outStream.write(USAGE_PREFIX)
    outStream.write(s)
  })
}

const onNoArgs = (parser: Argv, outStream: WriteStream): void => {
  if (outStream.isTTY) {
    writeLogo(outStream)
  }
  showHelpMessage(parser, outStream)
  outStream.write(EOL)
}

type AugmentedYargsParser = Argv & {
  errors: string[]
}

const createYargsParser = (): AugmentedYargsParser => {
  const errors: string[] = []

  const parser = yargs()
    .strict()
    .completion('completion', false as unknown as string)
    .exitProcess(false)
    .help(false)
    .fail((msg, err) => {
      if (err) throw err
      errors.push(msg)
    })

  // Define the help option explicitly to have better control of when the help message is printed
  parser.option('help', {
    alias: 'h',
    boolean: true,
    describe: 'Show help',
  })

  // Update texts and define un-wanted yargs messages
  parser.updateLocale({
    'Not enough non-option arguments: got %s, need at least %s': DO_NOT_SHOW,
    'Too many non-option arguments: got %s, maximum of %s': DO_NOT_SHOW,
    'Positionals:': 'Arguments:',
  })

  yargonaut
    .errorsStyle('red.bold')
    .helpStyle('bold')
    .style('yellow', 'required')

  parser.wrap(Math.min(MAX_WIDTH, parser.terminalWidth()))

  Object.defineProperty(parser, 'errors', { get: () => errors })

  return parser as AugmentedYargsParser
}

const handleErrors = (parser: Argv, outStream: WriteStream, errors: string[]): void => {
  let printedErrors = false
  errors.forEach((value: string) => {
    // Workaround to not show error messages we do not want
    if (value && value.length > 0 && !value.includes(DO_NOT_SHOW)) {
      outStream.write(value)
      outStream.write(EOL)
      if (!printedErrors) printedErrors = true
    }
  })

  if (printedErrors) outStream.write(EOL)
  showHelpMessage(parser, outStream)
}

export type ParseResult =
  { status: 'command'; parsedArgs: Arguments; builder: CommandBuilder } |
  { status: 'error' } |
  { status: 'help' } |
  { status: 'empty' }

const parse = (
  commandBuilders: YargsCommandBuilder[],
  { args }: { args: string[] },
  { stdout, stderr }: { stdout: WriteStream; stderr: WriteStream },
): Promise<ParseResult> => new Promise<ParseResult>((resolve, reject) => {
  const parser = createYargsParser()
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

    // When the help option is on show the help message and resolve (whether it's alone or with other args/options)
    if (parsedArgs.help) {
      showHelpMessage(parser, stdout)
      resolve({ status: 'help' })
      return
    }

    stdout.write(outText)

    // let the event loop process the commandSelected promise
    setTimeout(() => {
      if (parser.errors.length > 0) {
        handleErrors(parser, stderr, parser.errors)
        resolve({ status: 'error' })
      } else if (commandSelected.done) {
        commandSelected.then(builder => resolve({ status: 'command', parsedArgs, builder }))
      } else { // "--version"
        resolve({ status: 'empty' })
      }
    }, 0)
  })
})

export default parse
