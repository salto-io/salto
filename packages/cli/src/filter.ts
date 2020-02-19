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
import { ParsedCliInput } from './types'

type Transformer<T1, T2 extends T1> = (v: T1) => T2
type AsyncTransformer<T1, T2 extends T1> = (v: T1) => Promise<T2>

const apply = <T1, T2 extends T1>(input: T1, ...transformers: Transformer<T1, T2>[]): T2 =>
  transformers.reduce((res, transformer) => transformer(res), input) as T2

const applyAsync = <T1, T2 extends T1>(
  input: T1, ...transformers: AsyncTransformer<T1, T2>[]
): Promise<T2> => (
    transformers.length
      ? transformers[0](input).then(v => applyAsync(v, ...transformers.slice(1)))
      : Promise.resolve(input as T2)
  )

export interface ParserFilter<TArgs = {}, TArgv extends yargs.Argv<TArgs> = yargs.Argv<TArgs>> {
  transformParser: Transformer<yargs.Argv, TArgv>
}

export interface ParsedCliInputFilter<
  TArgs = {},
  TParsedCliInput extends ParsedCliInput<TArgs> = ParsedCliInput<TArgs>
> {
  transformParsedCliInput: AsyncTransformer<ParsedCliInput<TArgs>, TParsedCliInput>
}

export type Filter<
  TArgs = {},
  TParsedCliInput extends ParsedCliInput<TArgs> = ParsedCliInput<TArgs>
> = ParserFilter<TArgs> | ParsedCliInputFilter<TArgs>

// namespace used for clarity here
// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace Filter {
  const isParser = (f: Filter): f is ParserFilter => 'transformParser' in f

  const isParsedCliInput = (f: Filter): f is ParsedCliInputFilter => 'transformParsedCliInput' in f

  export const applyParser = (middlewares: Filter[], parser: yargs.Argv): yargs.Argv =>
    apply(parser, ...middlewares.filter(isParser).map(m => m.transformParser))

  export const applyParsedCliInput = (
    middlewares: Filter[], input: ParsedCliInput
  ): Promise<ParsedCliInput> =>
    applyAsync(
      input,
      ...middlewares.filter(isParsedCliInput).map(m => m.transformParsedCliInput),
    )
}
