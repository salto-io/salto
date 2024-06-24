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
import { Validator, validate } from '../validators'

type Opts = { [k: string]: unknown }

type FuncAcceptingOpts<TOpts extends {}, TReturn> = (opts: TOpts) => TReturn

export type OptValidator<TOpts extends Opts, TVal> = Validator<TVal, TOpts>

export type OptsValidators<TOpts extends Opts> = Partial<{
  [P in keyof TOpts]: OptValidator<TOpts, TOpts[P]>
}>

export const validateAll = <TOpts extends Opts>(validators: OptsValidators<TOpts>, opts: TOpts): void => {
  Object.entries(validators).forEach(([optName, validator]) => {
    validate<unknown, string & keyof TOpts, TOpts>(validator as Validator<unknown, TOpts>, opts[optName], optName, opts)
  })
}

export const withOptsValidation =
  <TOpts extends {}, TReturn>(
    f: FuncAcceptingOpts<TOpts, TReturn>,
    validators: OptsValidators<TOpts>,
  ): FuncAcceptingOpts<TOpts, TReturn> =>
  opts => {
    validateAll(validators, opts)
    return f(opts)
  }
