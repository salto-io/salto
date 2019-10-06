import { Workspace, describeElement } from 'salto'
import { createCommandBuilder } from '../builder'
import { ParsedCliInput, CliCommand, CliOutput } from '../types'
import { formatSearchResults } from '../formatter'

export const command = (
  blueprintsDir: string,
  blueprints: string[] = [],
  words: string[],
  { stdout }: CliOutput
): CliCommand => ({
  async execute(): Promise<void> {
    const workspace: Workspace = await Workspace.load(blueprintsDir, blueprints)
    const searchResult = await describeElement(workspace, words)
    stdout.write(formatSearchResults(searchResult))
  },
})

type DescribeArgs = {
  blueprint: string[]
  'blueprints-dir': string
  'words': string[]
}

type DescribeParsedCliInput = ParsedCliInput<DescribeArgs>

const builder = createCommandBuilder({
  options: {
    command: 'describe <words...>',
    aliases: ['desc'],
    description: 'Shows all available types and attributes for the adapters of the related services',
    positional: {
      words: {
        type: 'string',
        description: 'Words to search',
        default: undefined, // Prevent "default: []" in the help
      },
    },
    keyed: {
      'blueprints-dir': {
        alias: 'd',
        describe: 'Path to directory containing blueprint (.bp) files',
        demandOption: false,
        string: true,
        requiresArg: true,
      },
      blueprint: {
        alias: 'b',
        describe: 'Path to input blueprint file. This option can be specified multiple times',
        demandOption: false,
        array: true,
        requiresArg: true,
      },
    },
  },

  async build(input: DescribeParsedCliInput, output: CliOutput) {
    return command(input.args['blueprints-dir'], input.args.blueprint, input.args.words, output)
  },
})

export default builder
