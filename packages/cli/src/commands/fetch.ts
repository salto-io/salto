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
import _ from 'lodash'
import {
  fetch as apiFetch,
  Workspace,
  fetchFunc,
  FetchChange,
  FetchProgressEvents,
  StepEmitter,
} from '@salto-io/core'
import { EventEmitter } from 'pietile-eventemitter'
import { logger } from '@salto-io/logging'
import { EOL } from 'os'
import { createCommandBuilder } from '../command_builder'
import { ParsedCliInput, CliCommand, CliOutput, CliExitCode, SpinnerCreator } from '../types'
import {
  formatChangesSummary, formatMergeErrors, formatFatalFetchError, formatStepStart,
  formatStepCompleted, formatStepFailed, formatFetchHeader, formatFetchFinish,
} from '../formatter'
import { getApprovedChanges as cliGetApprovedChanges } from '../callbacks'
import { updateWorkspace, loadWorkspace } from '../workspace'
import Prompts from '../prompts'
import { servicesFilter, ServicesArgs } from '../filters/services'

const log = logger(module)

type approveChangesFunc = (
  changes: ReadonlyArray<FetchChange>,
  interactive: boolean
) => Promise<ReadonlyArray<FetchChange>>

export const fetchCommand = async (
  { workspace, force, interactive, strict, inputServices, output, fetch, getApprovedChanges }: {
    workspace: Workspace
    force: boolean
    interactive: boolean
    strict?: boolean
    output: CliOutput
    fetch: fetchFunc
    getApprovedChanges: approveChangesFunc
    inputServices: string[]
  }): Promise<CliExitCode> => {
  const outputLine = (text: string): void => output.stdout.write(`${text}\n`)
  const progressOutputer = (
    startText: string,
    successText: string,
    defaultErrorText: string
  ) => (progress: StepEmitter) => {
    outputLine(EOL)
    outputLine(formatStepStart(startText))
    progress.on('completed', () => outputLine(formatStepCompleted(successText)))
    progress.on('failed', (errorText?: string) => {
      outputLine(formatStepFailed(errorText ?? defaultErrorText))
      outputLine(EOL)
    })
  }
  const fetchProgress = new EventEmitter<FetchProgressEvents>()
  fetchProgress.on('adaptersDidInitialize', () => {
    outputLine(formatFetchHeader())
  })

  fetchProgress.on('changesWillBeFetched', (progress: StepEmitter, adapters: string[]) => progressOutputer(
    Prompts.FETCH_GET_CHANGES_START(adapters),
    Prompts.FETCH_GET_CHANGES_FINISH(adapters),
    Prompts.FETCH_GET_CHANGES_FAIL
  )(progress))

  fetchProgress.on('diffWillBeCalculated', progressOutputer(
    Prompts.FETCH_CALC_DIFF_START,
    Prompts.FETCH_CALC_DIFF_FINISH,
    Prompts.FETCH_CALC_DIFF_FAIL,
  ))
  fetchProgress.on('workspaceWillBeUpdated', (progress: StepEmitter, changes: number, approved: number) =>
    progressOutputer(
      formatChangesSummary(changes, approved),
      Prompts.FETCH_UPDATE_WORKSPACE_SUCCESS,
      Prompts.FETCH_UPDATE_WORKSPACE_FAIL
    )(progress))

  const fetchResult = await fetch(
    workspace,
    inputServices,
    fetchProgress,
  )
  if (fetchResult.success === false) {
    output.stderr.write(formatFatalFetchError(fetchResult.mergeErrors))
    return CliExitCode.AppError
  }

  // A few merge errors might have occurred,
  // but since it's fetch flow, we omitted the elements
  // and only print the merge errors
  if (!_.isEmpty(fetchResult.mergeErrors)) {
    log.debug(`fetch had ${fetchResult.mergeErrors} merge errors`)
    output.stderr.write(formatMergeErrors(fetchResult.mergeErrors))
  }

  // Unpack changes to array so we can iterate on them more than once
  const changes = [...fetchResult.changes]
  // If the workspace starts empty there is no point in showing a huge amount of changes
  const changesToApply = force || (await workspace.isEmpty())
    ? changes
    : await getApprovedChanges(changes, interactive)

  const updatingWsEmitter = new StepEmitter()
  fetchProgress.emit('workspaceWillBeUpdated', updatingWsEmitter, changes.length, changesToApply.length)
  const updatingWsSucceeded = await updateWorkspace(workspace, output, changesToApply, strict)
  if (updatingWsSucceeded) {
    updatingWsEmitter.emit('completed')
    outputLine(formatFetchFinish())
  } else {
    updatingWsEmitter.emit('failed')
  }
  return updatingWsSucceeded
    ? CliExitCode.Success
    : CliExitCode.AppError
}

export const command = (
  workspaceDir: string,
  force: boolean,
  interactive: boolean,
  output: CliOutput,
  spinnerCreator: SpinnerCreator,
  inputServices: string[],
  strict: boolean
): CliCommand => ({
  async execute(): Promise<CliExitCode> {
    log.debug(`running fetch command on '${workspaceDir}' [force=${force}, interactive=${
      interactive}, strict=${strict}]`)
    const { workspace, errored } = await loadWorkspace(workspaceDir, output, spinnerCreator)
    if (errored) {
      return CliExitCode.AppError
    }
    return fetchCommand({
      workspace,
      force,
      interactive,
      inputServices,
      output,
      fetch: apiFetch,
      getApprovedChanges: cliGetApprovedChanges,
      strict,
    })
  },
})

type FetchArgs = {
  force: boolean
  interactive: boolean
  strict: boolean
} & ServicesArgs
type FetchParsedCliInput = ParsedCliInput<FetchArgs>

const fetchBuilder = createCommandBuilder({
  options: {
    command: 'fetch',
    description: 'Syncs this workspace\'s blueprints with the services\' current state',
    keyed: {
      force: {
        alias: ['f'],
        describe: 'Accept all incoming changes, even if there\'s a conflict with local changes',
        boolean: true,
        default: false,
        demandOption: false,
      },
      interactive: {
        alias: ['i'],
        describe: 'Interactively approve every incoming change',
        boolean: true,
        default: false,
        demandOption: false,
      },
      strict: {
        alias: ['t'],
        describe: 'Apply the fetch changes to the active enviornment only',
        boolean: true,
        default: false,
        demandOption: false,
      },
    },
  },

  filters: [servicesFilter],

  async build(input: FetchParsedCliInput, output: CliOutput, spinnerCreator: SpinnerCreator) {
    return command(
      '.',
      input.args.force,
      input.args.interactive,
      output,
      spinnerCreator,
      input.args.services,
      input.args.strict
    )
  },
})

export default fetchBuilder
