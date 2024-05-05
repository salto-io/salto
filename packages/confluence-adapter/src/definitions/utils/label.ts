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
import { validateValue } from './generic'

/**
 * AdjustFunction that converts labels object array to ids array.
 */
export const adjustLabelsToIdsFunc: definitions.AdjustFunction = item => {
  const value = validateValue(item.value)
  const labels = _.get(value, 'labels')
  if (_.isEmpty(labels) || !Array.isArray(labels)) {
    return { value }
  }
  return {
    value: {
      ...value,
      labels: labels.map(label => label.id),
    },
  }
}
