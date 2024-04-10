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

import { definitions } from '@salto-io/adapter-components'
import { assertValue } from './generic'

const isNumber = (value: unknown): value is number => typeof value === 'number'

/**
 * AdjustFunction that increases the version number of a page for deploy modification change.
 */
export const increasePagesVersion: definitions.AdjustFunction<definitions.deploy.ChangeAndContext> = item => {
  const value = assertValue(item.value)
  const version = assertValue(value.version)
  const { number } = version
  if (!isNumber(number)) {
    return { value }
  }
  return {
    value: {
      ...value,
      version: {
        ...version,
        number: number + 1,
      },
    },
  }
}
