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
import { logger } from '@salto-io/logging'
import { EOL } from 'os'
import _ from 'lodash'
import { promises } from '@salto-io/lowerdash'
import { loadLocalWorkspace, getDefaultAdapterConfig } from '@salto-io/core'
import { WorkspaceComponents } from '@salto-io/workspace'
import { ParsedCliInput, CliOutput, CliExitCode, CliCommand, CliTelemetry } from '../types'
import { createCommandBuilder } from '../command_builder'
import { getCliTelemetry } from '../telemetry'
import { getWorkspaceTelemetryTags } from '../workspace/workspace'
import { errorOutputLine, outputLine } from '../outputer'
import { getUserBooleanInput } from '../callbacks'
import { formatCleanWorkspace, formatCancelCommand, header, formatStepStart, formatStepFailed, formatStepCompleted } from '../formatter'
import Prompts from '../prompts'

const log = logger(module)

type CleanArgs = WorkspaceComponents & { force: boolean }

type CleanParsedCliInput = ParsedCliInput<CleanArgs>

export const command = (
  workspaceDir: string,
  cliTelemetry: CliTelemetry,
  output: CliOutput,
  force: boolean,
  cleanArgs: WorkspaceComponents,
): CliCommand => ({
  async execute(): Promise<CliExitCode> {
    log.debug(`running clean command on '${workspaceDir}', force=${force}, nacl=${
      cleanArgs.nacl}, state=${cleanArgs.state}, cache=${cleanArgs.cache}, credentials=${
      cleanArgs.credentials}, staticResources=${cleanArgs.staticResources}, serviceConfig=${cleanArgs.serviceConfig}`)

    const componentsToClean = Object.entries(cleanArgs)
      .filter(([_comp, shouldClean]) => shouldClean)
      .map(([comp]) => _.startCase(comp).toLowerCase())
    if (componentsToClean.length === 0) {
      outputLine(header(Prompts.EMPTY_PLAN), output)
      outputLine(EOL, output)
      return CliExitCode.UserInputError
    }
    if (cleanArgs.staticResources && !(cleanArgs.state && cleanArgs.cache && cleanArgs.nacl)) {
      errorOutputLine('Cannot clear static resources without clearing the state, cache and nacls', output)
      outputLine(EOL, output)
      return CliExitCode.UserInputError
    }

    const workspace = await loadLocalWorkspace(workspaceDir)
    const workspaceTags = await getWorkspaceTelemetryTags(workspace)

    outputLine(header(
      formatCleanWorkspace(componentsToClean)
    ), output)
    if (!(force || await getUserBooleanInput(Prompts.SHOULD_EXECUTE_PLAN))) {
      outputLine(formatCancelCommand, output)
      return CliExitCode.Success
    }

    outputLine(formatStepStart(Prompts.CLEAN_STARTED), output)
    cliTelemetry.start(workspaceTags)

    try {
      await workspace.clear(_.omit(cleanArgs, 'serviceConfig'))
      const configRestoreFailures: string[] = []
      if (cleanArgs.serviceConfig) {
        await promises.array.series(workspace.services().map(service => (async () => {
          const defaultConfig = getDefaultAdapterConfig(service)
          if (defaultConfig !== undefined) {
            return workspace.updateServiceConfig(service, defaultConfig)
          }
          configRestoreFailures.push(service)
          return undefined
        })))
      }
      await workspace.flush()
      if (configRestoreFailures.length > 0) {
        throw new Error(`Failed to restore config for the following services: ${configRestoreFailures}`)
      }
    } catch (e) {
      errorOutputLine(formatStepFailed(Prompts.CLEAN_FAILED(e.toString())), output)
      cliTelemetry.failure(workspaceTags)
      return CliExitCode.AppError
    }

    outputLine(formatStepCompleted(Prompts.CLEAN_FINISHED), output)
    outputLine(EOL, output)
    cliTelemetry.success(workspaceTags)
    return CliExitCode.Success
  },
})

const diffBuilder = createCommandBuilder({
  options: {
    command: 'clean',
    // this is a hidden command
    description: false as unknown as string,
    keyed: {
      force: {
        alias: ['f'],
        describe: 'Do not ask for approval before applying the changes',
        boolean: true,
        default: false,
      },
      nacl: {
        alias: ['n'],
        describe: 'Remove all nacl files',
        boolean: true,
        default: true,
      },
      state: {
        alias: ['s'],
        describe: 'Clear the state',
        boolean: true,
        default: true,
      },
      cache: {
        alias: ['c'],
        describe: 'Clear the cache',
        boolean: true,
        default: true,
      },
      // will also be available as staticResources because of camel-case-expansion
      'static-resources': {
        alias: ['r'],
        describe: 'Remove all static resources',
        boolean: true,
        default: true,
      },
      credentials: {
        alias: ['l'],
        describe: 'Clear the service login credentials',
        boolean: true,
        default: false,
      },
      // will also be available as serviceConfig because of camel-case-expansion
      'service-config': {
        alias: ['g'],
        describe: 'Restore service configuration to default',
        boolean: true,
        default: false,
      },
    },
  },

  async build(
    input: CleanParsedCliInput,
    output: CliOutput,
  ): Promise<CliCommand> {
    return command(
      '.',
      getCliTelemetry(input.telemetry, 'clean'),
      output,
      input.args.force,
      {
        nacl: input.args.nacl,
        state: input.args.state,
        cache: input.args.cache,
        staticResources: input.args.staticResources,
        credentials: input.args.credentials,
        serviceConfig: input.args.serviceConfig,
      },
    )
  },
})

export default diffBuilder
