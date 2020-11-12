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
import { diff, LocalChange, loadLocalWorkspace } from '@salto-io/core'
import { createElementSelectors } from '@salto-io/workspace'
import { logger } from '@salto-io/logging'
import { EOL } from 'os'
import _ from 'lodash'
import { ServicesArgs, servicesFilter } from '../filters/service'
import { EnvironmentArgs } from './env'
import { ParsedCliInput, CliOutput, CliExitCode, CliCommand, CliTelemetry } from '../types'
import { createCommandBuilder } from '../command_builder'
import { getCliTelemetry } from '../telemetry'
import { getWorkspaceTelemetryTags } from '../workspace/workspace'
import Prompts from '../prompts'
import { formatDetailedChanges, formatInvalidFilters, formatStepStart, formatStepCompleted, header } from '../formatter'
import { outputLine, errorOutputLine } from '../outputer'

const log = logger(module)

type DiffArgs = {
    detailedPlan: boolean
    elementSelector: string[]
    hidden: boolean
    state: boolean
    fromEnv: string
    toEnv: string
  } & ServicesArgs & EnvironmentArgs

type DiffParsedCliInput = ParsedCliInput<DiffArgs>

// TODO - move to formatter.ts

const printDiff = (
  changes: LocalChange[],
  detailed: boolean,
  toEnv: string,
  fromEnv: string,
  output: CliOutput
): void => {
  outputLine(EOL, output)
  outputLine(header(Prompts.DIFF_CALC_DIFF_RESULT_HEADER(toEnv, fromEnv)), output)
  if (changes.length > 0) {
    outputLine(
      formatDetailedChanges([changes.map(change => change.change)], detailed),
      output,
    )
  } else {
    outputLine('No changes', output)
  }
  outputLine(EOL, output)
}
export const command = (
  workspaceDir: string,
  detailedPlan: boolean,
  cliTelemetry: CliTelemetry,
  output: CliOutput,
  fromEnv: string,
  toEnv: string,
  inputHidden = false,
  inputState = false,
  inputServices?: string[],
  elmSelectors: string[] = []
): CliCommand => ({
  async execute(): Promise<CliExitCode> {
    log.debug(`running diff command on '${workspaceDir}', detailedPlan=${detailedPlan}
        , services=${inputServices}, fromEnv=${fromEnv}, toEnv=${toEnv}
        , inputHidden=${inputHidden}, inputState=${inputState}, elmSelectors=${elmSelectors}`)

    const { validSelectors, invalidSelectors } = createElementSelectors(elmSelectors)
    if (!_.isEmpty(invalidSelectors)) {
      errorOutputLine(formatInvalidFilters(invalidSelectors), output)
      return CliExitCode.UserInputError
    }

    const workspace = await loadLocalWorkspace('.')
    const workspaceTags = await getWorkspaceTelemetryTags(workspace)
    if (!(workspace.envs().includes(fromEnv))) {
      errorOutputLine(`Unknown environment ${fromEnv}`, output)
      return CliExitCode.UserInputError
    }
    if (!(workspace.envs().includes(toEnv))) {
      errorOutputLine(`Unknown environment ${toEnv}`, output)
      return CliExitCode.UserInputError
    }
    cliTelemetry.start(workspaceTags)
    outputLine(EOL, output)
    outputLine(formatStepStart(Prompts.DIFF_CALC_DIFF_START(toEnv, fromEnv)), output)

    const changes = await diff(
      workspace,
      fromEnv,
      toEnv,
      inputHidden,
      inputState,
      inputServices,
      validSelectors
    )
    printDiff(changes, detailedPlan, toEnv, fromEnv, output)

    outputLine(formatStepCompleted(Prompts.DIFF_CALC_DIFF_FINISH(toEnv, fromEnv)), output)
    outputLine(EOL, output)
    cliTelemetry.success(workspaceTags)

    return CliExitCode.Success
  },
})

const diffBuilder = createCommandBuilder({
  options: {
    command: 'diff <from-env> <to-env> [element-selector..]',
    description: 'Compare two workspace environments',
    positional: {
      'from-env': {
        type: 'string',
        desc: 'The environment that serves as a baseline for the comparison',
      },
      'to-env': {
        type: 'string',
        desc: 'The environment that is compared to the baseline provided by from-env',
      },
      'element-selector': {
        description: 'Array of configuration element patterns',
      },
    },
    keyed: {
      'detailed-plan': {
        alias: ['p'],
        describe: 'Print detailed changes between envs',
        boolean: true,
        default: false,
        demandOption: false,
      },
      hidden: {
        describe: 'Display changes in hidden values',
        boolean: true,
        default: false,
        demandOption: false,
      },
      state: {
        describe: 'Use the latest state files to compare the environments.',
        boolean: true,
        default: false,
        demandOption: false,
      },
    },
  },

  filters: [servicesFilter],

  async build(
    input: DiffParsedCliInput,
    output: CliOutput,
  ): Promise<CliCommand> {
    return command(
      '.',
      input.args.detailedPlan,
      getCliTelemetry(input.telemetry, 'diff'),
      output,
      input.args.fromEnv,
      input.args.toEnv,
      input.args.hidden,
      input.args.state,
      input.args.services,
      input.args.elementSelector
    )
  },
})

export default diffBuilder
