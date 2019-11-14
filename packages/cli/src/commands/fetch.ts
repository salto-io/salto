import _ from 'lodash'
import {
  fetch as apiFetch,
  Workspace,
  fetchFunc,
  FetchChange,
} from 'salto'
import { logger } from '@salto/logging'
import { createCommandBuilder } from '../command_builder'
import { ParsedCliInput, CliCommand, CliOutput, CliExitCode, SpinnerCreator } from '../types'
import { formatChangesSummary, formatMergeErrors } from '../formatter'
import { getConfigWithHeader, getApprovedChanges as cliGetApprovedChanges } from '../callbacks'
import Prompts from '../prompts'
import { updateWorkspace, loadWorkspace } from '../workspace'

const log = logger(module)

type approveChangesFunc = (
  changes: ReadonlyArray<FetchChange>,
  interactive: boolean
) => Promise<ReadonlyArray<FetchChange>>

export const fetchCommand = async (
  workspace: Workspace,
  force: boolean,
  interactive: boolean,
  output: CliOutput,
  fetch: fetchFunc,
  getApprovedChanges: approveChangesFunc,
): Promise<CliExitCode> => {
  const outputLine = (text: string): void => output.stdout.write(`${text}\n`)

  outputLine(Prompts.FETCH_BEGIN)
  const fetchResult = await fetch(workspace, _.partial(getConfigWithHeader, output.stdout))
  // A few merge errors might have occured,
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
  outputLine(formatChangesSummary(changes.length, changesToApply.length))
  return await updateWorkspace(workspace, output, ...changesToApply)
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
    return fetchCommand(workspace, force, interactive, output, apiFetch, cliGetApprovedChanges)
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
    aliases: ['f'],
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
