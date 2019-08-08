import * as commands from '../commands'
import { createCommandBuilder } from '../builder'
import { ParsedCliInput, CliCommand, CliOutput } from '../types'
import { Blueprint } from '../../blueprints/blueprint'
import * as bf from '../filters/blueprints'

const command = (blueprints: Blueprint[], force: boolean): CliCommand => ({
  async execute(): Promise<void> {
    return commands.applyBase(() => Promise.resolve(blueprints), force)
  },
})

type MyParsedCliInput = ParsedCliInput<bf.ParsedArgs & { 'yes': boolean } > & bf.AddedCliInput

const builder = createCommandBuilder<bf.ParsedArgs, MyParsedCliInput>({
  options: {
    command: 'apply',
    aliases: ['a'],
    description: 'Applies changes to the target services',
    keyed: {
      yes: {
        describe: 'Do not ask for approval before applying',
        boolean: true,
      },
    },
  },

  filters: [bf.filter],

  async build(input: MyParsedCliInput, _output: CliOutput) {
    return command(input.blueprints, input.args.yes)
  },
})

export default builder
