import yargs from 'yargs'
import { ParsedCliInput } from './types'

type Transformer<T1, T2 extends T1> = (v: T1) => T2
type AsyncTransformer<T1, T2 extends T1> = (v: T1) => Promise<T2>

export const apply = <T1, T2 extends T1>(input: T1, ...transformers: Transformer<T1, T2>[]): T2 =>
  transformers.reduce((res, transformer) => transformer(res), input) as T2

export const applyAsync = <T1, T2 extends T1>(
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
  TParsedCliInput extends ParsedCliInput<TArgs> = ParsedCliInput<TArgs>> {
  transformParsedCliInput: AsyncTransformer<ParsedCliInput<TArgs>, TParsedCliInput>
}

export type Filter<
  TArgs = {},
  TArgv extends yargs.Argv<TArgs> = yargs.Argv<TArgs>,
  TParsedCliInput extends ParsedCliInput<TArgs> = ParsedCliInput<TArgs>,
> = ParserFilter<TArgs, TArgv> | ParsedCliInputFilter<TArgs, TParsedCliInput>

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
