import { EOL } from 'os'
import chalk from 'chalk'
import { initializeCore } from 'salto'
import { compareLogLevels, LogLevel, logger } from '@salto/logging'
import { streams } from '@salto/lowerdash'
import { CliInput, CliOutput, CliExitCode, SpinnerCreator } from './types'
import { YargsCommandBuilder } from './command_builder'
import parse, { ERROR_STYLE } from './argparser'

export const VERBOSE_LOG_LEVEL: LogLevel = 'debug'

const log = logger(module)

const increaseLoggingLogLevel = (): void => {
  const currentLogLevel = logger.config.minLevel
  const isCurrentLogLevelLower = currentLogLevel === 'none'
    || compareLogLevels(currentLogLevel, VERBOSE_LOG_LEVEL) < 0

  if (isCurrentLogLevelLower) {
    logger.configure({ minLevel: VERBOSE_LOG_LEVEL })
  }
}

export default async (
  { input, output, commandBuilders, spinnerCreator }: {
    input: CliInput
    output: CliOutput
    commandBuilders: YargsCommandBuilder[]
    spinnerCreator: SpinnerCreator
  }
): Promise<CliExitCode> => {
  try {
    const parseResult = await parse(commandBuilders, input, output)

    if (parseResult.status === 'error') {
      return CliExitCode.UserInputError
    }

    if (parseResult.status === 'command') {
      const { parsedArgs, builder: commandBuilder } = parseResult

      if (parsedArgs.verbose) {
        increaseLoggingLogLevel()
      }

      log.info('CLI starting')

      const singleThreaded = parsedArgs['single-threaded']
      log.debug('setting singleThreaded to %s', singleThreaded)
      await initializeCore({ singleThreaded })

      const parsedInput = { ...input, args: parsedArgs }
      const command = await commandBuilder(parsedInput, output, spinnerCreator)
      return await command.execute()
    }

    return CliExitCode.Success
  } catch (err) {
    log.error(`Caught exception: ${[err, err.stack].filter(n => n).join(EOL)}`)

    const errorStream = output.stderr
    const unstyledErrorString = `${[err].filter(n => n).join(EOL)}`
    const errorString = streams.hasColors(errorStream)
      ? chalk`{${ERROR_STYLE} ${unstyledErrorString}}` : unstyledErrorString
    errorStream.write(errorString)
    errorStream.write(EOL)
    return CliExitCode.AppError
  }
}
