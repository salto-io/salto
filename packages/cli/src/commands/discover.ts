import {
  discover as apiDiscover,
  Workspace,
  loadConfig,
  discoverFunc,
  ChangeWithConflict,
} from 'salto'
import { createCommandBuilder } from '../command_builder'
import { ParsedCliInput, CliCommand, CliOutput, CliExitCode } from '../types'
import { getConfigFromUser, getApprovedChanges as cliGetApprovedChanges } from '../callbacks'
import { formatChangesSummary } from '../formatter'
import Prompts from '../prompts'
import { validateWorkspace } from '../workspace'

type approveChangesFunc =
  (changes: ReadonlyArray<ChangeWithConflict>) => Promise<ReadonlyArray<ChangeWithConflict>>

export const discoverCommand = async (
  workspace: Workspace,
  force: boolean,
  output: CliOutput,
  discover: discoverFunc,
  getApprovedChanges: approveChangesFunc,
): Promise<CliExitCode> => {
  const outputLine = (text: string): void => output.stdout.write(`${text}\n`)
  if (!validateWorkspace(workspace, output.stderr)) {
    return CliExitCode.AppError
  }
  outputLine(Prompts.DISCOVER_BEGIN)
  // Unpack changes to array so we can iterate on them more than once
  const changes = [...await discover(workspace, getConfigFromUser)]
  // If the workspace starts empty there is no point in showing a huge amount of changes
  const isEmptyWorkspace = workspace.elements.filter(elem => !elem.elemID.isConfig()).length === 0
  const changesToApply = force || isEmptyWorkspace
    ? changes
    : await getApprovedChanges(changes)
  outputLine(formatChangesSummary(changes.length, changesToApply.length))
  if (changesToApply.length > 0) {
    await workspace.updateBlueprints(...changesToApply.map(change => change.change))
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
    return discoverCommand(workspace, force, output, apiDiscover, cliGetApprovedChanges)
  },
})

type DiscoverArgs = {
  force: boolean
}
type DiscoverParsedCliInput = ParsedCliInput<DiscoverArgs>

const discoverBuilder = createCommandBuilder({
  options: {
    command: 'discover',
    aliases: ['dis'],
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

  async build(input: DiscoverParsedCliInput, output: CliOutput) {
    return command('.', input.args.force, output)
  },
})

export default discoverBuilder
