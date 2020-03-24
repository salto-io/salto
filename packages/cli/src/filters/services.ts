/*
*                      Copyright 2020 Salto Labs Ltd.
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with
* the License.  You may obtain a copy of the License at
*
*     http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
import _ from 'lodash'
import yargs from 'yargs'
import { loadConfig, currentEnvConfig } from '@salto-io/core'
import { ParsedCliInput } from '../types'
import { ParserFilter, ParsedCliInputFilter } from '../filter'

export interface ServiceCmdArgs {
  command: string
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
        }).check((args: yargs.Arguments<{
          command?: string
          name?: string
        }>): true => {
        if (args.command && nameRequiredCommands.includes(args.command)) {
          if (_.isEmpty(args.name)) {
            throw new Error(`Missing required argument: name\n\nExample usage: @salto-io/core services ${args.command} salesforce`)
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

export interface ServicesArgs { services: string[]; env: string }

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
    const workspaceConfig = (await loadConfig('.'))
    workspaceConfig.currentEnv = args.env ?? workspaceConfig.currentEnv
    const workspaceServices = currentEnvConfig(workspaceConfig).services
    if (workspaceServices.length === 0) {
      throw new Error(
        `No services are configured for env=${workspaceConfig.currentEnv}. Use salto services add'.`
      )
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
