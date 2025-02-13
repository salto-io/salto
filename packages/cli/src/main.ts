/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import sourceMapSupport from 'source-map-support'
import os from 'os'
import { configFromDisk, telemetrySender } from '@salto-io/local-workspace'
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
  if (nodeExecLoc === saltoExecLoc) {
    stdout.write('Warning: Salto might not work properly when executed from the same directory as the workspace.')
  }
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
main().then(exitCode => {
  process.exitCode = exitCode
})
