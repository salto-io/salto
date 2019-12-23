import _ from 'lodash'
import { loadConfig } from 'salto'
import yargs from 'yargs'
import { ParsedCliInput } from '../types'
import { ParserFilter, ParsedCliInputFilter } from '../filter'

export interface Arg { services: string[] }

export type ServicesParsedCliInput = ParsedCliInput<Arg>

type ServicesFilter = ParserFilter<Arg> & ParsedCliInputFilter<Arg, ServicesParsedCliInput>

export const servicesFilter: ServicesFilter = {
  transformParser(parser: yargs.Argv): yargs.Argv<Arg> {
    return parser
      .options({
        services: {
          alias: ['s'],
          describe: 'Specific services to perform this action for (default=all)',
          type: 'array',
          string: true,
        },
      }) as yargs.Argv<Arg>
  },

  async transformParsedCliInput(input: ParsedCliInput<Arg>): Promise<ParsedCliInput<Arg>> {
    const args = input.args as yargs.Arguments<Arg>
    const workspaceServices = (await loadConfig('.')).services
    if (workspaceServices.length === 0) {
      throw new Error('No services are configured for this workspace. Use \'salto services add\'.')
    }
    // This assumes the default value for input services is all configured
    // so use the default (workspace services) if nothing was inputted
    if (!args.services) {
      return _.set(input, 'args.services', workspaceServices)
    }

    const diffServices = _.difference(args.services, workspaceServices || [])
    if (diffServices.length > 0) {
      throw new Error(`Not all services (${diffServices}) are set up for this workspace`)
    }
    return input
  },
}
