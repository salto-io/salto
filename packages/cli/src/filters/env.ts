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
import yargs from 'yargs'

import { loadConfig } from '@salto-io/core'
import { ParsedCliInput } from '../types'
import { ParserFilter, ParsedCliInputFilter } from '../filter'
import { EnvironmentArgs, EnvironmentParsedCliInput } from '../commands/env'

type EnvironmentFilter = ParserFilter<EnvironmentArgs>
  & ParsedCliInputFilter<EnvironmentArgs, EnvironmentParsedCliInput>

export const environmentFilter: EnvironmentFilter = {
  transformParser(parser: yargs.Argv): yargs.Argv<EnvironmentArgs> {
    return parser
      .options({
        env: {
          alias: ['e'],
          describe: 'The name of the environment to use',
          type: 'string',
          string: true,
          demandOption: false,
        },
      }) as yargs.Argv<EnvironmentArgs>
  },

  async transformParsedCliInput(
    input: ParsedCliInput<EnvironmentArgs>
  ): Promise<ParsedCliInput<EnvironmentArgs>> {
    const args = input.args as yargs.Arguments<EnvironmentArgs>
    const workspaceConfig = (await loadConfig('.'))

    if (args.env && !(args.env in workspaceConfig.envs)) {
      throw new Error(`Environment ${args.env} isn't configured. Use salto env create.`)
    }
    return input
  },
}
