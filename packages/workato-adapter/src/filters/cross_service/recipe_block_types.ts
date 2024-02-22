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
import _ from 'lodash'
import Joi from 'joi'
import { createSchemeGuard } from '@salto-io/adapter-utils'

export type RefListItem = {
  label: string
  value: string
}

export type BlockBase = {
  keyword: string
  provider?: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const isListItem = (value: any): value is RefListItem =>
  _.isObjectLike(value) && _.isString(value.label) && _.isString(value.value)

export const createBlockChecker =
  <T extends BlockBase>(
    scheme: Joi.AnySchema,
    supportedApps: string[],
  ): ((value: unknown, application: string) => value is T) =>
  (value: unknown, application: string): value is T => {
    const isAdapterBlock = createSchemeGuard<T>(scheme)

    return isAdapterBlock(value) && supportedApps.includes(application) && value.provider === application
  }
