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
import { CROSS_SERVICE_SUPPORTED_APPS } from '../../../constants'
import { BlockBase } from '../recipe_block_types'

export type ZuoraBlock = BlockBase & {
  as: string
  provider: 'zuora'
  input: {
    object: string
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const isZuoraBlock = (value: any, application: string): value is ZuoraBlock =>
  _.isObjectLike(value) &&
  CROSS_SERVICE_SUPPORTED_APPS.zuora_billing.includes(application) &&
  value.provider === application &&
  _.isString(value.keyword) &&
  _.isObjectLike(value.input) &&
  _.isString(value.input.object) &&
  _.isString(value.as)
