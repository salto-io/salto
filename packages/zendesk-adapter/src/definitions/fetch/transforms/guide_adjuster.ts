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
import { values as lowerdashValues } from '@salto-io/lowerdash'
import _ from 'lodash'

// this transformer adds the brand id to guide elements, to know the source of each element
export const transform: definitions.AdjustFunctionSingle = async ({ value, context }) => {
  if (!lowerdashValues.isPlainObject(value)) {
    throw new Error('unexpected value for guide item, not transforming')
  }
  const brandId = context.brandId ?? _.get(context.parent, 'brand')
  if (brandId === undefined) {
    return { value }
  }

  return {
    value: {
      ...value,
      // Defining Zendesk Guide element to its corresponding brand (= subdomain)
      brand: brandId,
    },
  }
}
