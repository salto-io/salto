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

import { values } from '@salto-io/lowerdash'
import { definitions } from '@salto-io/adapter-components'
import _ from 'lodash'
import { SUPPORTED_DIRECTORY_OBJECT_ODATA_TYPE_NAME_TO_TYPE_NAME } from '../../constants'

const { isPlainObject } = values

// Microsoft Graph OData query language does not support selecting the @odata.type field, but we need it for reference resolution.
export const adjustEntitiesWithExpandedMembers: definitions.AdjustFunction = ({ value, typeName }) => {
  if (!isPlainObject(value)) {
    throw new Error(`Expected ${typeName} value to be an object`)
  }

  return {
    value: {
      ...value,
      members: _.get(value, 'members', [])
        .map((member: unknown): object => {
          if (!isPlainObject(member)) {
            throw new Error(`Expected ${typeName} member to be an object`)
          }

          return _.pick(member, ['id', '@odata.type'])
        })
        .filter((member: object) =>
          Object.keys(SUPPORTED_DIRECTORY_OBJECT_ODATA_TYPE_NAME_TO_TYPE_NAME).includes(_.get(member, '@odata.type')),
        ),
    },
  }
}
