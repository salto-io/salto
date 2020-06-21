/*
*                      Copyright 2020 Salto Labs Ltd.
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with
* the License.  You may obtain a copy of the License at
*
*     http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
import { EOL } from 'os'
import chalk from 'chalk'
import { compareLogLevels, LogLevel, logger } from '@salto-io/logging'
import { streams } from '@salto-io/lowerdash'
import { CliInput, CliOutput, CliExitCode, SpinnerCreator } from './types'
import { YargsCommandBuilder } from './command_builder'
import parse, { ERROR_STYLE } from './argparser'
import { versionString } from './version'

export const VERBOSE_LOG_LEVEL: LogLevel = 'debug'
const EVENTS_FLUSH_WAIT_TIME = 1000

const log = logger(module)
const exceptionEvent = 'workspace.error'

const increaseLoggingLogLevel = (): void => {
  const currentLogLevel = logger.config.minLevel
  const isCurrentLogLevelLower = currentLogLevel === 'none'
    || compareLogLevels(currentLogLevel, VERBOSE_LOG_LEVEL) < 0

  if (isCurrentLogLevelLower) {
    logger.setMinLevel(VERBOSE_LOG_LEVEL)
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

      log.info('CLI started. Version: %s', versionString)

      const parsedInput = { ...input, args: parsedArgs }
      const command = await commandBuilder(parsedInput, output, spinnerCreator)
      return await command.execute()
    }

    return CliExitCode.Success
  } catch (err) {
    log.error(`Caught exception: ${[err, err.stack].filter(n => n).join(EOL)}`)
    input.telemetry.sendStackEvent(exceptionEvent, err, {})

    const errorStream = output.stderr
    const unstyledErrorString = `${[err].filter(n => n).join(EOL)}`
    const errorString = streams.hasColors(errorStream)
      ? chalk`{${ERROR_STYLE} ${unstyledErrorString}}` : unstyledErrorString
    errorStream.write(errorString)
    errorStream.write(EOL)
    return CliExitCode.AppError
  } finally {
    await input.telemetry.stop(EVENTS_FLUSH_WAIT_TIME)
    await logger.end()
  }
}
