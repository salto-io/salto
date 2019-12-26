import _ from 'lodash'
import { loadConfig } from 'salto'
import yargs from 'yargs'
import { ParsedCliInput } from '../types'
import { ParserFilter, ParsedCliInputFilter } from '../filter'

export interface ServiceCmdArgs {
  command?: string
  name?: string
}

export type ServiceCmdParsedCliInput = ParsedCliInput<ServiceCmdArgs>

type ServiceCmdFilter = ParserFilter<ServiceCmdArgs>
  & ParsedCliInputFilter<ServiceCmdArgs, ServiceCmdParsedCliInput>

const nameRequiredCommands = ['add', 'login']

export const serviceCmdFilter: ServiceCmdFilter = {
  transformParser(parser: yargs.Argv): yargs.Argv<ServiceCmdArgs> {
    return parser
      .positional('command',
        {
          type: 'string',
          choices: ['add', 'login', 'list'],
          description: 'The services management command',
        })
      .positional('name',
        {
          type: 'string',
          desc: 'The name of the service [required for add & login]',
        }).check((args: yargs.Arguments<ServiceCmdArgs>): true => {
        if (args.command && nameRequiredCommands.includes(args.command)) {
          if (_.isEmpty(args.name)) {
            throw new Error(`Missing required argument: name\n\nExample usage: salto services ${args.command} salesforce`)
          }
        }
        return true
      }) as yargs.Argv<ServiceCmdArgs>
  },

  async transformParsedCliInput(
    input: ParsedCliInput<ServiceCmdArgs>
  ): Promise<ParsedCliInput<ServiceCmdArgs>> {
    return input
  },
}

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
