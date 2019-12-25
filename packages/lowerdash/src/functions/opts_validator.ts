import { Validator, validate } from '../validators'

type Opts = { [k: string]: unknown }

type FuncAcceptingOpts<
  TOpts extends {},
  TReturn,
  > = ((opts: TOpts) => TReturn)

export type OptValidator<TOpts extends Opts, TVal> = Validator<TVal, TOpts>

export type OptsValidators<TOpts extends Opts> = Partial<{
  [P in keyof TOpts]: OptValidator<TOpts, TOpts[P]>
}>

export const validateAll = <TOpts extends Opts>(
  validators: OptsValidators<TOpts>,
  opts: TOpts,
): void => {
  Object.entries(validators).forEach(([optName, validator]) => {
    validate<unknown, string & keyof TOpts, TOpts>(
      validator as Validator<unknown, TOpts>,
      opts[optName],
      optName,
      opts,
    )
  })
}

export const withOptsValidation = <
  TOpts extends {},
  TReturn,
  >(
    f: FuncAcceptingOpts<TOpts, TReturn>,
    validators: OptsValidators<TOpts>,
  ): FuncAcceptingOpts<TOpts, TReturn> => opts => {
    validateAll(validators, opts)
    return f(opts)
  }
