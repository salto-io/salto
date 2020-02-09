import yargs from 'yargs'
import _ from 'lodash'
import { ParsedCliInput } from '../types'
import { ParserFilter, ParsedCliInputFilter } from '../filter'

export interface EnvsCmdArgs {
  command: string
  name: string
}

export type EnvsCmdParsedCliInput = ParsedCliInput<EnvsCmdArgs>

type EnvsCmdFilter = ParserFilter<EnvsCmdArgs>
  & ParsedCliInputFilter<EnvsCmdArgs, EnvsCmdParsedCliInput>

const nameRequiredCommands = ['create', 'set']
export const envsCmdFilter: EnvsCmdFilter = {
  transformParser(parser: yargs.Argv): yargs.Argv<EnvsCmdArgs> {
    return parser
      .positional('command',
        {
          type: 'string',
          choices: ['create', 'set', 'list'],
          description: 'The enviornment management command',
        })
      .positional('name',
        {
          type: 'string',
          desc: 'The name of the enviornment',
        }).check((args: yargs.Arguments<{
          command?: string
          name?: string
        }>): true => {
        if (args.command) {
          if (_.isEmpty(args.name) && nameRequiredCommands.includes(args.command)) {
            throw new Error('Missing required argument: name\n\n'
              + `Example usage: salto env ${args.command} <envName>`)
          }
          if (!_.isEmpty(args.name) && !nameRequiredCommands.includes(args.command)) {
            throw new Error(`Unknown argument: ${args.name}\n\n`
              + `Example usage: salto env ${args.command}`)
          }
        }
        return true
      }) as yargs.Argv<EnvsCmdArgs>
  },

  async transformParsedCliInput(
    input: ParsedCliInput<EnvsCmdArgs>
  ): Promise<ParsedCliInput<EnvsCmdArgs>> {
    return input
  },
}
