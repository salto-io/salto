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
import os from 'os'
import chalk from 'chalk'
import { compareLogLevels, LogLevel, logger } from '@salto-io/logging'
import { streams } from '@salto-io/lowerdash'
import { CliInput, CliOutput, CliExitCode, SpinnerCreator } from './types'
import { YargsCommandBuilder } from './command_builder'
import parse, { ERROR_STYLE } from './argparser'
import { versionString } from './version'
import { AppConfig } from '../../core/src/app_config'

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
  { input, output, commandBuilders, spinnerCreator, config }: {
    input: CliInput
    output: CliOutput
    commandBuilders: YargsCommandBuilder[]
    spinnerCreator: SpinnerCreator
    config: AppConfig
  }
): Promise<CliExitCode> => {
  const [nodeExecLoc, saltoExecLoc, ...cmdLineArgs] = process.argv
  const cmdStr = ['salto', ...cmdLineArgs].join(' ')
  const startTime = new Date()
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

      log.info('CLI started. Version: %s, Node exec location: %s, '
              + 'Salto exec location: %s, Current dir: %s',
      versionString,
      nodeExecLoc,
      saltoExecLoc,
      process.cwd())
      log.debug('OS properties - platform: %s, release: %s, arch %s', os.platform(), os.release(), os.arch())
      log.debug('Installation ID: %s', config.installationID)
      log.info('running "%s"', cmdStr)

      const parsedInput = { ...input, args: parsedArgs }
      const command = await commandBuilder(parsedInput, output, spinnerCreator)
      return await command.execute()
    }

    return CliExitCode.Success
  } catch (err) {
    log.error(`Caught exception: ${[err, err.stack].filter(n => n).join(os.EOL)}`)
    input.telemetry.sendStackEvent(exceptionEvent, err, {})

    const errorStream = output.stderr
    const unstyledErrorString = `${[err].filter(n => n).join(os.EOL)}`
    const errorString = streams.hasColors(errorStream)
      ? chalk`{${ERROR_STYLE} ${unstyledErrorString}}` : unstyledErrorString
    errorStream.write(errorString)
    errorStream.write(os.EOL)
    return CliExitCode.AppError
  } finally {
    await input.telemetry.stop(EVENTS_FLUSH_WAIT_TIME)
    log.info('ran "%s" in %d ms', cmdStr, (new Date().getTime()) - startTime.getTime())
    await logger.end()
  }
}
