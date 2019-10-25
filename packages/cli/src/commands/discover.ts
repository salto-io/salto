import {
  discover as apiDiscover,
  Workspace,
  loadConfig,
  discoverFunc,
  DetailedChange,
} from 'salto'
import { createCommandBuilder } from '../command_builder'
import { ParsedCliInput, CliCommand, CliOutput } from '../types'
import { getConfigFromUser, getApprovedChanges as cliGetApprovedChanges } from '../callbacks'
import { formatWorkspaceErrors, formatChangesSummary } from '../formatter'
import Prompts from '../prompts'

type approveChangesFunc =
  (changes: ReadonlyArray<DetailedChange>) => Promise<ReadonlyArray<DetailedChange>>

export const discoverCommand = async (
  workspace: Workspace,
  force: boolean,
  output: CliOutput,
  discover: discoverFunc,
  getApprovedChanges: approveChangesFunc,
): Promise<void> => {
  const outputLine = (text: string): void => output.stdout.write(`${text}\n`)
  if (workspace.hasErrors()) {
    output.stderr.write(formatWorkspaceErrors(workspace.getWorkspaceErrors()))
    return
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
    await workspace.updateBlueprints(...changesToApply)
    await workspace.flush()
  }
}

export const command = (
  workspaceDir: string,
  force: boolean,
  output: CliOutput
): CliCommand => ({
  async execute(): Promise<void> {
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
