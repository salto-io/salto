/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { OptsValidators, withOptsValidation } from './opts_validator'

type DefaultOpts<TOpts> = { DEFAULT_OPTS: TOpts }

const addDefaults = <T extends {}, TOpts>(o: T, defaults: TOpts): T & DefaultOpts<TOpts> =>
  Object.assign(o, { DEFAULT_OPTS: Object.freeze(defaults) }) as T & DefaultOpts<TOpts>

type FuncAcceptingOpts<TOpts extends {}, TReturn> = ((opts?: TOpts) => TReturn) & DefaultOpts<TOpts>

const defaultOpts = <TOpts extends {}, TReturn>(
  f: (opts: TOpts) => TReturn,
  defaults: TOpts,
  validators: OptsValidators<TOpts> = {},
): FuncAcceptingOpts<Partial<TOpts>, TReturn> => {
  const fWithValidation = withOptsValidation(f, validators)
  const fWithDefaults = (opts: Partial<TOpts> = {}): TReturn => fWithValidation({ ...defaults, ...opts })
  return addDefaults(fWithDefaults, defaults)
}

type FuncAcceptingDefaultAndRequiredOpts<TPartialOpts extends {}, TRequiredOpts extends {}, TReturn> = ((
  opts: Partial<TPartialOpts> & TRequiredOpts,
) => TReturn) &
  DefaultOpts<TPartialOpts>

// A different helper for functions with required options in addition to the default-able options.
// The difference is that in this case the "opts" arg is always required (in minimum it will have
// the required options).
// Needed because I couldn't make a single version with a *sometimes-optional* "opts" arg.
const withRequired = <TPartialOpts extends {}, TRequiredOpts extends {}, TReturn>(
  f: (opts: TPartialOpts & TRequiredOpts) => TReturn,
  defaults: TPartialOpts,
  validators: OptsValidators<TPartialOpts & TRequiredOpts> = {},
): FuncAcceptingDefaultAndRequiredOpts<TPartialOpts, TRequiredOpts, TReturn> => {
  const fWithValidation = withOptsValidation(f, validators)
  const fWithDefaults = (opts: Partial<TPartialOpts> & TRequiredOpts): TReturn =>
    fWithValidation({ ...defaults, ...opts })
  return addDefaults(fWithDefaults, defaults)
}

defaultOpts.withRequired = withRequired

export default defaultOpts
