//
// defaultOpts wraps a function accepting an "opts" object and returns a function accepting
// a partial opts object, allowing to specify the defaults.
//
// Examples:
//
// type MyOpts = { num: number; str: string }
//
// const myFunc = defaultOpts(
//   ({ num, str }: MyOpts): void => {
//     // actual function body accepting all opts' properties: both num and str are set.
//   },
//   { num: 42, str: 'def' },          // default values for all opts properties
// )
//
// myFunc()                            // will receive: { num: 42, str: 'def' }
// myFunc({ num: 43 })                 // will receive: { num: 43, str: 'def' }
// myFunc({ num: 43, str: 'other' })   // will receive: { num: 43, str: 'other' }
//
// ------------------------------------------------------------------------------------------
//
// defaultOpts.withRequired is similar to defaultOpts, but returns a function accepting an "opts"
// object where some of its properties are required (have no defaults)
//
// Example:
//
// type MyRequiredOpts = { reqNum: number; reqStr: string }
// type MyPartialOpts = { optNum: number; optStr: string }
// type MyOpts = MyRequiredOpts & MyPartialOpts
//
// const myFunc = defaultOpts.withRequired<MyPartialOpts, MyRequiredOpts, void>(
//   ({ reqNum, reqStr, optNum, optlStr }: MyOpts): void => {
//     // actual function body accepting all opts' properties: all are set
//   },
//   { optNum: 42, optStr: 'def' },                  // default values for all optional properties
// )
//
// myFunc()                                          // DOES NOT COMPILE! opts arg is required
// myFunc({ reqNum: 12, reqStr: 'req' })             // minimum opts - all required properties
// myFunc({ reqNum: 12, reqStr: 'req', optNum: 43 }) // also override some optional properties
//

import { OptsValidators, withOptsValidation } from './opts_validator'

type DefaultOpts<TOpts> = { DEFAULT_OPTS: TOpts }

const addDefaults = <T, TOpts>(
  o: T, defaults: TOpts
): T & DefaultOpts<TOpts> => Object.assign(o, { DEFAULT_OPTS: Object.freeze(defaults) })

type FuncAcceptingOpts<
  TOpts extends {},
  TReturn,
> = ((opts?: TOpts) => TReturn) & DefaultOpts<TOpts>

const defaultOpts = <TOpts extends {}, TReturn>(
  f: (opts: TOpts) => TReturn,
  defaults: TOpts,
  validators: OptsValidators<TOpts> = {}
): FuncAcceptingOpts<Partial<TOpts>, TReturn> => {
  const fWithValidation = withOptsValidation(f, validators)
  const fWithDefaults = (
    opts: Partial<TOpts> = {}
  ): TReturn => fWithValidation({ ...defaults, ...opts })
  return addDefaults(fWithDefaults, defaults)
}

type FuncAcceptingDefaultAndRequiredOpts<
  TPartialOpts extends {},
  TRequiredOpts extends {},
  TReturn,
  > = ((opts: Partial<TPartialOpts> & TRequiredOpts) => TReturn) & DefaultOpts<TPartialOpts>

// A different helper for functions with required options in addition to the default-able options.
// The difference is that in this case the "opts" arg is always required (in minimum it will have
// the required options).
// Needed because I couldn't make a single version with a *sometimes-optional* "opts" arg.
const withRequired = <
  TPartialOpts extends {},
  TRequiredOpts extends {},
  TReturn,
>(
    f: (opts: TPartialOpts & TRequiredOpts) => TReturn,
    defaults: TPartialOpts,
    validators: OptsValidators<TPartialOpts & TRequiredOpts> = {},
  ): FuncAcceptingDefaultAndRequiredOpts<TPartialOpts, TRequiredOpts, TReturn> => {
  const fWithValidation = withOptsValidation(f, validators)
  const fWithDefaults = (
    opts: Partial<TPartialOpts> & TRequiredOpts
  ): TReturn => fWithValidation({ ...defaults, ...opts })
  return addDefaults(fWithDefaults, defaults)
}

defaultOpts.withRequired = withRequired

export default defaultOpts
