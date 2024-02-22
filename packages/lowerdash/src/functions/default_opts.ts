/*
 *                      Copyright 2024 Salto Labs Ltd.
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

import { OptsValidators, withOptsValidation } from './opts_validator'

type DefaultOpts<TOpts> = { DEFAULT_OPTS: TOpts }

const addDefaults = <T, TOpts>(o: T, defaults: TOpts): T & DefaultOpts<TOpts> =>
  Object.assign(o, { DEFAULT_OPTS: Object.freeze(defaults) })

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
