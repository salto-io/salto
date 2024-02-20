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
import { inspect } from 'util'

export class ValidationError extends Error {
  constructor(message: string, received: unknown, name?: string) {
    super([name, `should be ${message}, received: ${inspect(received)}`].filter(x => x).join(' '))
  }
}

export type Validator<TVal, TContext = {}> = (
  v: TVal,
  ctx?: TContext,
) =>
  | {
      valid: true
    }
  | {
      valid: false
      message: string
    }

export const validate = <TVal, OptName extends string, TContext = { [P in OptName]: string }>(
  validator: Validator<TVal, TContext>,
  value: TVal,
  name?: OptName,
  ctx?: TContext,
): void => {
  const v = validator(value, ctx)
  if (!v.valid) {
    throw new ValidationError(v.message, value, name)
  }
}

type MaybeWrapped<T, TContext> = T | ((ctx: TContext) => T)

const unwrap =
  <TArg, TVal, TContext>(
    nOrFunc: MaybeWrapped<TArg, TContext>,
    isUnwrapped: (o: MaybeWrapped<TArg, TContext>) => o is TArg,
    validatorMaker: (arg: TArg) => Validator<TVal, TContext>,
  ): Validator<TVal, TContext> =>
  (v, ctx) => {
    const arg = isUnwrapped(nOrFunc) ? nOrFunc : nOrFunc(ctx as TContext)
    return validatorMaker(arg)(v, ctx)
  }

const isNumber = <TContext>(arg: MaybeWrapped<number, TContext>): arg is number => typeof arg === 'number'

const some =
  <TVal, TContext>(...validators: Validator<TVal, TContext>[]): Validator<TVal, TContext> =>
  (v, ctx) => {
    const vals = [...validators]
    const messages: string[] = []
    const next = (): ReturnType<Validator<TVal, TContext>> => {
      const validator = vals.shift()
      if (validator === undefined) return { valid: false, message: messages.join(' or ') }
      const res = validator(v, ctx)
      if (res.valid) return { valid: true }
      messages.push(res.message)
      return next()
    }

    return next()
  }

const valUndefined =
  <T, TVal extends T | undefined, TContext>(): Validator<TVal, TContext> =>
  v =>
    v === undefined ? { valid: true } : { valid: false, message: 'undefined' }

const undefinedOr = <T, TVal extends T | undefined, TContext>(
  validator: Validator<T, TContext>,
): Validator<TVal, TContext> => some(valUndefined<T, TVal, TContext>(), (v, ctx) => validator(v as T, ctx))

const number =
  <TVal, TContext>(): Validator<TVal, TContext> =>
  v =>
    typeof v === 'number' ? { valid: true } : { valid: false, message: 'a number' }

const every =
  <TVal, TContext>(...validators: Validator<TVal, TContext>[]): Validator<TVal, TContext> =>
  (v, ctx) => {
    const vals = [...validators]
    const next = (): ReturnType<Validator<TVal, TContext>> => {
      const val = vals.shift()
      if (val === undefined) return { valid: true }
      const res = val(v, ctx)
      if (!res.valid) return res
      return next()
    }

    return next()
  }

const numberAnd = <TVal extends number, TContext>(validator: Validator<number, TContext>): Validator<TVal, TContext> =>
  every(number(), validator)

const numberComparison =
  <TContext, TArg = number>(
    comparison: (n: TArg, actual: number) => boolean,
    message: (n: TArg) => string,
    isUnwrapped: (o: MaybeWrapped<TArg, TContext>) => o is TArg,
  ): ((nOrFunc: MaybeWrapped<TArg, TContext>) => Validator<number, TContext>) =>
  nOrFunc =>
    numberAnd(
      unwrap(
        nOrFunc,
        isUnwrapped,
        (n: TArg) => (v: number) => (comparison(n, v) ? { valid: true } : { valid: false, message: message(n) }),
      ),
    )

const inRangeInclusive = <TContext>(): ((
  nOrFunc: MaybeWrapped<[number, number], TContext>,
) => Validator<number, TContext>) =>
  numberComparison<TContext, [number, number]>(
    ([min, max], n) => n >= min && n <= max,
    ([min, max]) => `in range [${min}, ${max}]`,
    (arg: MaybeWrapped<[number, number], TContext>): arg is [number, number] => Array.isArray(arg),
  )

export const validators = {
  undefinedOr,
  number,
  every,
  some,
  numberAnd,
  numberComparison,
  greaterOrEqualThan: numberComparison(
    (n, a) => a >= n,
    n => `greater or equal than ${n}`,
    isNumber,
  ),
  greaterThan: numberComparison(
    (n, a) => a > n,
    n => `greater than ${n}`,
    isNumber,
  ),
  inRangeInclusive,
}
