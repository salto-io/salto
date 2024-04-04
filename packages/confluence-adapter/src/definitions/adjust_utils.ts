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
import { definitions } from '@salto-io/adapter-components'
import { values as lowerdashValues } from '@salto-io/lowerdash'

const assertValue = (value: unknown): Record<string, unknown> => {
  if (!lowerdashValues.isPlainRecord(value)) {
    throw new Error('Can not deploy when the value is not an object')
  }
  return value
}

export const adjustLabelsToIdsFunc: definitions.AdjustFunction = item => {
  const value = assertValue(item.value)
  const labels = _.get(value, 'labels')
  if (_.isEmpty(labels) || !Array.isArray(labels)) {
    return { ...item, value }
  }
  return {
    ...item,
    value: {
      ...value,
      labels: labels.map(label => label.id),
    },
  }
}
