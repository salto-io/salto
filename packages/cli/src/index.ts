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
import sourceMapSupport from 'source-map-support'
import { configFromDisk, telemetrySender } from '@salto-io/core'
import { versionString, versionObj } from './version'
import cli from './cli'
import { CliExitCode } from './types'
import commandBuilders from './commands'
import oraSpinner from './ora_spinner'

sourceMapSupport.install()

const {
  stdin, stdout, stderr, argv,
} = process

const args = argv.slice(2)

const main = async (): Promise<CliExitCode> => {
  const oraSpinnerCreator = oraSpinner({ outputStream: stdout })
  const config = await configFromDisk()
  const telemetry = telemetrySender(
    config.telemetry,
    {
      installationID: config.installationID,
      app: 'cli',
      version: versionObj.version,
      versionString,
    }
  )
  return cli({
    input: { args, stdin, telemetry },
    output: { stdout, stderr },
    commandBuilders,
    spinnerCreator: oraSpinnerCreator,
  })
}

main().then(exitCode => process.exit(exitCode))
