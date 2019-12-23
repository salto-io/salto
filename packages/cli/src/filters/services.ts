import _ from 'lodash'
import { loadConfig } from 'salto'
import yargs from 'yargs'
import { ParsedCliInput } from '../types'
import { ParserFilter, ParsedCliInputFilter } from '../filter'

export interface ServicesArgs { services: string[] }

export type ServicesParsedCliInput = ParsedCliInput<ServicesArgs>

type ServicesFilter = ParserFilter<ServicesArgs>
  & ParsedCliInputFilter<ServicesArgs, ServicesParsedCliInput>

export const servicesFilter: ServicesFilter = {
  transformParser(parser: yargs.Argv): yargs.Argv<ServicesArgs> {
    return parser
      .options({
        services: {
          alias: ['s'],
          describe: 'Specific services to perform this action for (default=all)',
          type: 'array',
          string: true,
        },
      }) as yargs.Argv<ServicesArgs>
  },

  async transformParsedCliInput(
    input: ParsedCliInput<ServicesArgs>
  ): Promise<ParsedCliInput<ServicesArgs>> {
    const args = input.args as yargs.Arguments<ServicesArgs>
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
