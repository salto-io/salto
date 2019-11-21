import _ from 'lodash'
import {
  fetch as apiFetch,
  Workspace,
  fetchFunc,
  FetchChange,
  FetchProgressEvents,
  StepEmitter,
} from 'salto'
import { EventEmitter } from 'pietile-eventemitter'
import { logger } from '@salto/logging'
import { createCommandBuilder } from '../command_builder'
import { ParsedCliInput, CliCommand, CliOutput, CliExitCode, SpinnerCreator } from '../types'
import { formatChangesSummary, formatMergeErrors, formatFatalFetchError, error } from '../formatter'
import { getConfigWithHeader, getApprovedChanges as cliGetApprovedChanges } from '../callbacks'
import { updateWorkspace, loadWorkspace } from '../workspace'
import Prompts from '../prompts'

const log = logger(module)

type approveChangesFunc = (
  changes: ReadonlyArray<FetchChange>,
  interactive: boolean
) => Promise<ReadonlyArray<FetchChange>>

export const fetchCommand = async (
  { workspace, force, interactive, output, spinnerCreator, fetch, getApprovedChanges }: {
    workspace: Workspace
    force: boolean
    interactive: boolean
    output: CliOutput
    spinnerCreator: SpinnerCreator
    fetch: fetchFunc
    getApprovedChanges: approveChangesFunc
  }): Promise<CliExitCode> => {
  const progressSpinner = (
    startText: string,
    successText: string,
    defaultErrorText: string
  ) => (progress: StepEmitter) => {
    const spinner = spinnerCreator(startText, { prefixText: '\n' })
    progress.on('completed', () => spinner.succeed(successText))
    progress.on('failed', (errorText?: string) => spinner.fail(errorText ?? defaultErrorText))
  }
  const fetchProgress = new EventEmitter<FetchProgressEvents>()
  fetchProgress.on('getChanges', (progress: StepEmitter, adapters: string[]) => progressSpinner(
    Prompts.FETCH_GET_CHANGES_START(adapters),
    Prompts.FETCH_GET_CHANGES_FINISH(adapters),
    error(Prompts.FETCH_GET_CHANGES_FAIL)
  )(progress))

  fetchProgress.on('calculateDiff', progressSpinner(
    Prompts.FETCH_CALC_DIFF_START,
    Prompts.FETCH_CALC_DIFF_FINISH,
    error(Prompts.FETCH_CALC_DIFF_FAIL),
  ))

  const fetchResult = await fetch(
    workspace,
    _.partial(getConfigWithHeader, output.stdout),
    fetchProgress
  )
  if (!fetchResult.success) {
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
  const isEmptyWorkspace = workspace.elements.filter(elem => !elem.elemID.isConfig()).length === 0
  const changesToApply = force || isEmptyWorkspace
    ? changes
    : await getApprovedChanges(changes, interactive)

  const updateWsSpinner = spinnerCreator(
    formatChangesSummary(changes.length, changesToApply.length),
    { prefixText: '\n' }
  )
  const updatingWsSucceeded = await updateWorkspace(workspace, output, ...changesToApply)
  if (updatingWsSucceeded) {
    updateWsSpinner.succeed(Prompts.FETCH_UPDATE_WORKSPACE_SUCCESS)
  } else {
    updateWsSpinner.fail(error(Prompts.FETCH_UPDATE_WORKSPACE_FAIL))
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
): CliCommand => ({
  async execute(): Promise<CliExitCode> {
    log.debug(`running fetch command on '${workspaceDir}' [force=${force}, interactive=${
      interactive}]`)
    const { workspace, errored } = await loadWorkspace(workspaceDir, output, spinnerCreator)
    if (errored) {
      return CliExitCode.AppError
    }
    return fetchCommand({
      workspace,
      force,
      interactive,
      output,
      spinnerCreator,
      fetch: apiFetch,
      getApprovedChanges: cliGetApprovedChanges,
    })
  },
})

type FetchArgs = {
  force: boolean
  interactive: boolean
}
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
    },
  },

  async build(input: FetchParsedCliInput, output: CliOutput, spinnerCreator: SpinnerCreator) {
    return command('.', input.args.force, input.args.interactive, output, spinnerCreator)
  },
})

export default fetchBuilder
