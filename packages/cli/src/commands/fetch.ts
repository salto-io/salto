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
  Telemetry,
} from '@salto-io/core'
import { collections, promises } from '@salto-io/lowerdash'
import { EventEmitter } from 'pietile-eventemitter'
import { logger } from '@salto-io/logging'
import { EOL } from 'os'
import { createCommandBuilder } from '../command_builder'
import {
  ParsedCliInput, CliCommand, CliOutput,
  CliExitCode, SpinnerCreator, CliTelemetry,
} from '../types'
import {
  formatChangesSummary, formatMergeErrors, formatFatalFetchError, formatStepStart,
  formatStepCompleted, formatStepFailed, formatFetchHeader, formatFetchFinish,
} from '../formatter'
import { getApprovedChanges as cliGetApprovedChanges,
  shouldUpdateConfig as cliShouldUpdateConfig } from '../callbacks'
import { updateWorkspace, loadWorkspace, getWorkspaceTelemetryTags } from '../workspace'
import Prompts from '../prompts'
import { servicesFilter, ServicesArgs } from '../filters/services'
import { getCliTelemetry } from '../telemetry'

const log = logger(module)
const { makeArray } = collections.array
const { series } = promises.array

type approveChangesFunc = (
  changes: ReadonlyArray<FetchChange>,
  interactive: boolean
) => Promise<ReadonlyArray<FetchChange>>

type shouldUpdateConfigFunc = (
  adapterName: string,
  messages: string[]
) => Promise<boolean>

export const fetchCommand = async (
  {
    workspace, force, interactive, strict,
    inputServices, cliTelemetry, output, fetch,
    getApprovedChanges, shouldUpdateConfig,
  }: {
    workspace: Workspace
    force: boolean
    interactive: boolean
    strict?: boolean
    cliTelemetry: CliTelemetry
    output: CliOutput
    fetch: fetchFunc
    getApprovedChanges: approveChangesFunc
    shouldUpdateConfig: shouldUpdateConfigFunc
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
  const workspaceTags = await getWorkspaceTelemetryTags(workspace)
  cliTelemetry.start(workspaceTags)
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
    cliTelemetry.failure(workspaceTags)
    return CliExitCode.AppError
  }

  // A few merge errors might have occurred,
  // but since it's fetch flow, we omitted the elements
  // and only print the merge errors
  if (!_.isEmpty(fetchResult.mergeErrors)) {
    log.debug(`fetch had ${fetchResult.mergeErrors} merge errors`)
    cliTelemetry.mergeErrors(fetchResult.mergeErrors.length, workspaceTags)
    output.stderr.write(formatMergeErrors(fetchResult.mergeErrors))
  }

  const adaptersConfigChanges = makeArray(fetchResult.configChanges)
    .filter(change => !_.isEmpty(change.messages))
  const abortRequests = await series(
    adaptersConfigChanges.map(change => async () => {
      const adapterName = change.config.elemID.adapter
      log.debug(`Fetching ${adapterName} requires changes to the config in order to succeed:\n${
        change.messages.join('\n')
      }`)
      const shouldWriteToConfig = await shouldUpdateConfig(
        adapterName, change.messages
      )
      if (shouldWriteToConfig) {
        await workspace.adapterConfig.set(adapterName, change.config)
      }
      return !shouldWriteToConfig
    })
  )

  if (_.some(abortRequests)) {
    return CliExitCode.UserInputError
  }

  // Unpack changes to array so we can iterate on them more than once
  const changes = [...fetchResult.changes]
  cliTelemetry.changes(changes.length, workspaceTags)
  // If the workspace starts empty there is no point in showing a huge amount of changes
  const changesToApply = force || (await workspace.isEmpty())
    ? changes
    : await getApprovedChanges(changes, interactive)

  cliTelemetry.changesToApply(changesToApply.length, workspaceTags)
  const updatingWsEmitter = new StepEmitter()
  fetchProgress.emit('workspaceWillBeUpdated', updatingWsEmitter, changes.length, changesToApply.length)
  const updatingWsSucceeded = await updateWorkspace(workspace, output, changesToApply, strict)
  if (updatingWsSucceeded) {
    updatingWsEmitter.emit('completed')
    outputLine(formatFetchFinish())
  } else {
    updatingWsEmitter.emit('failed')
  }
  if (updatingWsSucceeded) {
    cliTelemetry.success(workspaceTags)
  } else {
    cliTelemetry.failure(workspaceTags)
  }
  return updatingWsSucceeded
    ? CliExitCode.Success
    : CliExitCode.AppError
}

export const command = (
  workspaceDir: string,
  force: boolean,
  interactive: boolean,
  telemetry: Telemetry,
  output: CliOutput,
  spinnerCreator: SpinnerCreator,
  inputServices: string[],
  strict: boolean,
): CliCommand => ({
  async execute(): Promise<CliExitCode> {
    log.debug(`running fetch command on '${workspaceDir}' [force=${force}, interactive=${
      interactive}, strict=${strict}]`)

    const cliTelemetry = getCliTelemetry(telemetry, 'fetch')
    const { workspace, errored } = await loadWorkspace(workspaceDir, output, spinnerCreator)
    if (errored) {
      cliTelemetry.failure()
      return CliExitCode.AppError
    }
    return fetchCommand({
      workspace,
      force,
      interactive,
      inputServices,
      cliTelemetry,
      output,
      fetch: apiFetch,
      getApprovedChanges: cliGetApprovedChanges,
      strict,
      shouldUpdateConfig: cliShouldUpdateConfig,
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
        describe: 'Restrict fetch from modifing common configuration '
          + '(might result in changes in other env folders)',
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
      input.telemetry,
      output,
      spinnerCreator,
      input.args.services,
      input.args.strict
    )
  },
})

export default fetchBuilder
