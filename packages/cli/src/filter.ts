import yargs from 'yargs'
import { ParsedCliInput } from './types'

type Transformer<T1, T2 extends T1> = (v: T1) => T2
type AsyncTransformer<T1, T2 extends T1> = (v: T1) => Promise<T2>

const deploy = <T1, T2 extends T1>(input: T1, ...transformers: Transformer<T1, T2>[]): T2 =>
  transformers.reduce((res, transformer) => transformer(res), input) as T2

const deployAsync = <T1, T2 extends T1>(
  input: T1, ...transformers: AsyncTransformer<T1, T2>[]
): Promise<T2> => (
    transformers.length
      ? transformers[0](input).then(v => deployAsync(v, ...transformers.slice(1)))
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

  export const deployParser = (middlewares: Filter[], parser: yargs.Argv): yargs.Argv =>
    deploy(parser, ...middlewares.filter(isParser).map(m => m.transformParser))

  export const deployParsedCliInput = (
    middlewares: Filter[], input: ParsedCliInput
  ): Promise<ParsedCliInput> =>
    deployAsync(
      input,
      ...middlewares.filter(isParsedCliInput).map(m => m.transformParsedCliInput),
    )
}
