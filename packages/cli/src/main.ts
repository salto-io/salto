/*
 *                      Copyright 2024 Salto Labs Ltd.
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
import sourceMapSupport from 'source-map-support'
import os from 'os'
import { configFromDisk, telemetrySender } from '@salto-io/core'
import { logger } from '@salto-io/logging'
import { versionString, versionDetails } from './version'
import cli from './cli'
import { CliExitCode } from './types'
import commandDefs from './commands'
import oraSpinner from './ora_spinner'

const EVENTS_FLUSH_WAIT_TIME = 1000

sourceMapSupport.install()

const { stdout, stderr, argv } = process
const log = logger(module)

const args = argv.slice(2)

const main = async (): Promise<CliExitCode> => {
  const oraSpinnerCreator = oraSpinner({ outputStream: stdout })
  const config = await configFromDisk()
  const telemetry = telemetrySender(config.telemetry, {
    installationID: config.installationID,
    app: 'cli',
    version: versionDetails.version,
    versionString,
  })
  const [nodeExecLoc, saltoExecLoc, ...cmdLineArgs] = process.argv
  const cmdStr = ['salto', ...cmdLineArgs].join(' ')
  log.info(
    'CLI started. Version: %s, Node exec location: %s, Salto exec location: %s, Current dir: %s',
    versionString,
    nodeExecLoc,
    saltoExecLoc,
    process.cwd(),
  )
  log.debug('OS properties - platform: %s, release: %s, arch %s', os.platform(), os.release(), os.arch())
  log.debug('Installation ID: %s', config.installationID)
  log.info('running "%s"', cmdStr)
  try {
    const ret = await cli({
      input: { args, telemetry, config: config.command },
      output: { stdout, stderr },
      commandDefs,
      spinnerCreator: oraSpinnerCreator,
      workspacePath: '.',
    })
    return ret
  } finally {
    // Telemetry emits a log when stopping so it must be stopped before the logger
    await telemetry.stop(EVENTS_FLUSH_WAIT_TIME)
    await logger.end()
  }
}
// eslint-disable-next-line @typescript-eslint/no-floating-promises
main().then(exitCode => process.exit(exitCode))
