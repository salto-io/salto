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
import { logger } from '@salto-io/logging'
import { streams } from '@salto-io/lowerdash'
import { CliInput, CliOutput, CliExitCode, SpinnerCreator } from './types'
import { CommandOrGroupDef } from './command_builder'
import { versionString } from './version'
import { AppConfig } from '../../core/src/app_config'
import { registerCommands, createProgramCommand, COMMANDER_ERROR_NAME, VERSION_CODE, HELP_DISPLAYED_CODE } from './command_register'

const EVENTS_FLUSH_WAIT_TIME = 1000

const log = logger(module)
const exceptionEvent = 'workspace.error'
const ERROR_STYLE = 'red'

export default async (
  { input, output, commandDefs, spinnerCreator, config }: {
    input: CliInput
    output: CliOutput
    commandDefs: CommandOrGroupDef[]
    spinnerCreator: SpinnerCreator
    config: AppConfig
  }
): Promise<CliExitCode> => {
  const [nodeExecLoc, saltoExecLoc, ...cmdLineArgs] = process.argv
  const cmdStr = ['salto', ...cmdLineArgs].join(' ')
  const startTime = new Date()
  log.info('CLI started. Version: %s, Node exec location: %s, '
  + 'Salto exec location: %s, Current dir: %s',
  versionString,
  nodeExecLoc,
  saltoExecLoc,
  process.cwd())
  log.debug('OS properties - platform: %s, release: %s, arch %s', os.platform(), os.release(), os.arch())
  log.debug('Installation ID: %s', config.installationID)
  log.info('running "%s"', cmdStr)
  try {
    const program = createProgramCommand()
    registerCommands(program, commandDefs, {
      telemetry: input.telemetry,
      config: input.config,
      output,
      spinnerCreator,
    })
    await program.parseAsync(input.args, { from: 'user' })
    return CliExitCode.Success
  } catch (err) {
    // Our commander configuration is to not exit after exiting (throwing an error)
    // This handles the proper exit code if the commander had an error/help/version print
    if (err.name && err.name === COMMANDER_ERROR_NAME) {
      if (err.code === HELP_DISPLAYED_CODE || err.code === VERSION_CODE) {
        return CliExitCode.Success
      }
      return CliExitCode.UserInputError
    }
    log.error(`Caught exception: ${[err, err.stack].filter(n => n).join(os.EOL)}`)
    input.telemetry.sendStackEvent(exceptionEvent, err, {})

    const errorStream = output.stderr
    const unstyledErrorString = `${[err].filter(n => n).join(os.EOL)}`
    const errorString = streams.hasColors(errorStream)
      ? chalk`{${ERROR_STYLE} ${unstyledErrorString}}` : unstyledErrorString
    errorStream.write(errorString)
    errorStream.write(os.EOL)
    return err.exitCode ?? CliExitCode.AppError
  } finally {
    await input.telemetry.stop(EVENTS_FLUSH_WAIT_TIME)
    log.info('ran "%s" in %d ms', cmdStr, (new Date().getTime()) - startTime.getTime())
    await logger.end()
  }
}
