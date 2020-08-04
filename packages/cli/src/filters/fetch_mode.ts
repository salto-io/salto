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
import { nacl } from '@salto-io/workspace'
import { ParserFilter, ParsedCliInputFilter } from '../filter'
import { ParsedCliInput } from '../types'

export type FetchModeArgs = {
    isolated: boolean
    override: boolean
    align: boolean
    mode: nacl.RoutingMode
}

export type FetchModeCliInput = ParsedCliInput<FetchModeArgs>

type FetchModeFilter = ParserFilter<FetchModeArgs>
  & ParsedCliInputFilter<FetchModeArgs, FetchModeCliInput>

const getUpdateMode = (
  inputIsolated: boolean,
  inputOverride: boolean,
  inputAlign: boolean,
): nacl.RoutingMode => {
  if ([inputIsolated, inputOverride, inputAlign].filter(i => i).length > 1) {
    throw new Error('Can only provide one fetch mode flag.')
  }
  if (inputIsolated) {
    return 'isolated'
  }
  if (inputOverride) {
    return 'override'
  }
  if (inputAlign) {
    return 'align'
  }
  return 'default'
}

export const fetchModeFilter: FetchModeFilter = {
  transformParser(parser: yargs.Argv): yargs.Argv<FetchModeArgs> {
    return parser
      .options({
        isolated: {
          alias: ['t'],
          describe: 'Restrict changes from modifying common configuration '
                  + '(might result in changes in other env folders)',
          boolean: true,
          default: false,
          demandOption: false,
        },
        align: {
          alias: ['a'],
          describe: 'Align the current environment with the current common configuration by '
                + 'ignoring changes to the common folder',
          boolean: true,
          default: false,
          demandOption: false,
        },
        override: {
          alias: ['o'],
          describe: 'Add new values to the common folder directly.',
          boolean: true,
          default: false,
          demandOption: false,
        },
      }) as yargs.Argv<FetchModeArgs>
  },

  async transformParsedCliInput(
    input: ParsedCliInput<FetchModeArgs>
  ): Promise<ParsedCliInput<FetchModeArgs>> {
    input.args.mode = getUpdateMode(input.args.isolated, input.args.override, input.args.align)
    return input
  },
}
