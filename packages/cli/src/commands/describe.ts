import { Blueprint, describeElement } from 'salto'
import { createCommandBuilder } from '../builder'
import { ParsedCliInput, CliCommand, CliOutput } from '../types'
import * as bf from '../filters/blueprints'
import { formatSearchResults } from '../formatter'

export const command = (blueprints: Blueprint[], words: string[], { stdout }: CliOutput):
CliCommand => ({
  async execute(): Promise<void> {
    const searchResult = await describeElement(words, blueprints)
    stdout.write(formatSearchResults(searchResult))
  },
})

type DescribeArgs = bf.Args & { 'words': string[] }
type DescribeParsedCliInput = ParsedCliInput<DescribeArgs> & bf.BlueprintsParsedCliInput

const builder = createCommandBuilder({
  options: {
    command: 'describe <words...>',
    aliases: ['d'],
    description: 'Shows all available types and attributes for the adapters of the related services',
    positional: {
      words: {
        type: 'string',
        description: 'Words to search',
        default: undefined, // Prevent "default: []" in the help
      },
    },
  },

  filters: [bf.requiredFilter],

  async build(input: DescribeParsedCliInput, output: CliOutput) {
    return command(input.blueprints, input.args.words, output)
  },
})

export default builder
