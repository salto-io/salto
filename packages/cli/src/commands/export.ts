import path from 'path'
import { exportToCsv, Workspace, dumpCsv, loadConfig } from 'salto'
import { createCommandBuilder } from '../command_builder'
import { ParsedCliInput, CliCommand, CliOutput } from '../types'
import { getConfigFromUser } from '../callbacks'
import { formatWorkspaceErrors } from '../formatter'

export const command = (
  workingDir: string,
  typeName: string,
  outputPath: string,
  { stderr }: CliOutput
):
CliCommand => ({
  async execute(): Promise<void> {
    const config = await loadConfig(workingDir)
    const workspace: Workspace = await Workspace.load(config)
    if (workspace.hasErrors()) {
      stderr.write(formatWorkspaceErrors(workspace.getWorkspaceErrors()))
    } else {
      const outputObjectsIterator = await exportToCsv(typeName, workspace, getConfigFromUser)

      // Check if output path is provided, otherwise use the template
      // <working dir>/<typeName>_<current timestamp>.csv
      const outPath = outputPath || path.join(path.resolve('./'), `${typeName}_${Date.now()}.csv`)

      let toAppend = false
      // eslint-disable-next-line no-restricted-syntax
      for await (const objects of outputObjectsIterator) {
        await dumpCsv(objects.map(instance => instance.value), outPath, toAppend)
        toAppend = true
      }
    }
  },
})

type ExportArgs = {
  'type-name': string
  'output-path': string
  'blueprint': string[]
  'blueprints-dir': string
 }
type ExportParsedCliInput = ParsedCliInput<ExportArgs>

const exportBuilder = createCommandBuilder({
  options: {
    command: 'export <type-name>',
    aliases: ['e'],
    description: 'Exports all objects of a given type to CSV',
    positional: {
      'type-name': {
        type: 'string',
        description: 'The type name of the instances for export as it appears in the blueprint',
        default: undefined, // Prevent "default: []" in the help
      },
    },
    keyed: {
      'blueprints-dir': {
        alias: 'd',
        describe: 'A path to the blueprints directory',
        string: true,
        demandOption: true,
      },
      blueprint: {
        alias: 'b',
        describe: 'Path to input blueprint file. This option can be specified multiple times',
        demandOption: false,
        array: true,
        requiresArg: true,
      },
      'output-path': {
        alias: ['o'],
        describe: 'A path to the output CSV file',
        string: true,
        demandOption: false,
      },
    },
  },

  async build(input: ExportParsedCliInput, output: CliOutput) {
    return command(input.args['blueprints-dir'], input.args['type-name'], input.args['output-path'], output)
  },
})

export default exportBuilder
