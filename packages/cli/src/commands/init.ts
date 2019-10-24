import * as path from 'path'
import { init } from 'salto'
import { createCommandBuilder } from '../command_builder'
import { ParsedCliInput, CliCommand, CliOutput } from '../types'

export const command = (
  workspaceName: string,
  { stdout, stderr }: CliOutput
): CliCommand => ({
  async execute(): Promise<void> {
    try {
      const workspace = await init(workspaceName)
      stdout.write(`Initiated workspace ${workspace.config.name} at ${path.resolve(workspace.config.baseDir)}\n`)
    } catch (e) {
      stderr.write(`Could not initiate workspace: ${e.message}\n`)
    }
  },
})

type InitArgs = {
  'workspace-name': string
}

type InitParsedCliInput = ParsedCliInput<InitArgs>

const initBuilder = createCommandBuilder({
  options: {
    command: 'init [workspace-name]',
    description: 'Initiate a Salto workspace in the current directory',
    positional: {
      'workspace-name': {
        type: 'string',
        description: 'The name of the workspace',
        default: undefined, // Prevent "default: []" in the help
      },
    },
  },

  async build(input: InitParsedCliInput, output: CliOutput) {
    return command(input.args['workspace-name'], output)
  },
})

export default initBuilder
