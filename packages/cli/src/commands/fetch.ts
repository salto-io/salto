import _ from 'lodash'
import {
  fetch as apiFetch,
  Workspace,
  loadConfig,
  fetchFunc,
  FetchChange,
} from 'salto'
import { createCommandBuilder } from '../command_builder'
import { ParsedCliInput, CliCommand, CliOutput, CliExitCode } from '../types'
import { getConfigFromUser, getApprovedChanges as cliGetApprovedChanges } from '../callbacks'
import { formatChangesSummary, formatMergeErrors } from '../formatter'
import Prompts from '../prompts'
import { validateWorkspace } from '../workspace'

type approveChangesFunc =
  (changes: ReadonlyArray<FetchChange>) => Promise<ReadonlyArray<FetchChange>>

export const fetchCommand = async (
  workspace: Workspace,
  force: boolean,
  output: CliOutput,
  fetch: fetchFunc,
  getApprovedChanges: approveChangesFunc,
): Promise<CliExitCode> => {
  const outputLine = (text: string): void => output.stdout.write(`${text}\n`)
  if (!validateWorkspace(workspace, output.stderr)) {
    return CliExitCode.AppError
  }
  outputLine(Prompts.FETCH_BEGIN)
  const fetchResult = await fetch(workspace, getConfigFromUser)
  // A few merge errors might have occured,
  // but since it's fetch flow, we omitted the elements
  // and only print the merge errors
  if (!_.isEmpty(fetchResult.mergeErrors)) {
    output.stderr.write(formatMergeErrors(fetchResult.mergeErrors))
  }

  // Unpack changes to array so we can iterate on them more than once
  const changes = [...fetchResult.changes]
  // If the workspace starts empty there is no point in showing a huge amount of changes
  const isEmptyWorkspace = workspace.elements.filter(elem => !elem.elemID.isConfig()).length === 0
  const changesToApply = force || isEmptyWorkspace
    ? changes
    : await getApprovedChanges(changes)
  outputLine(formatChangesSummary(changes.length, changesToApply.length))
  if (changesToApply.length > 0) {
    await workspace.updateBlueprints(...changesToApply.map(change => change.change))
    if (!validateWorkspace(workspace, output.stderr)) {
      return CliExitCode.AppError
    }
    await workspace.flush()
  }
  return CliExitCode.Success
}

export const command = (
  workspaceDir: string,
  force: boolean,
  output: CliOutput
): CliCommand => ({
  async execute(): Promise<CliExitCode> {
    const config = await loadConfig(workspaceDir)
    const workspace = await Workspace.load(config)
    return fetchCommand(workspace, force, output, apiFetch, cliGetApprovedChanges)
  },
})

type FetchArgs = {
  force: boolean
}
type FetchParsedCliInput = ParsedCliInput<FetchArgs>

const fetchBuilder = createCommandBuilder({
  options: {
    command: 'fetch',
    aliases: ['f'],
    description: 'Update blueprints and state in workspace directory',
    keyed: {
      force: {
        alias: ['f'],
        describe: 'Accept all incoming changes to the workspace',
        boolean: true,
        default: false,
        demandOption: false,
      },
    },
  },

  async build(input: FetchParsedCliInput, output: CliOutput) {
    return command('.', input.args.force, output)
  },
})

export default fetchBuilder
