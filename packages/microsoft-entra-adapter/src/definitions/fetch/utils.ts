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

import { validateArray, validatePlainObject } from '@salto-io/adapter-utils'
import { definitions } from '@salto-io/adapter-components'
import _ from 'lodash'
import { ODATA_TYPE_FIELD, SUPPORTED_DIRECTORY_OBJECT_ODATA_TYPE_NAME_TO_TYPE_NAME } from '../../constants'

// Microsoft Graph OData query language does not support selecting only the id and odata.type fields, so we need to
// filter them out after fetching the data.
// Also, for some types the query language does not support filtering the relevant types, so we need to filter them out
// after fetching the data.
export const adjustEntitiesWithExpandedMembers: definitions.AdjustFunction = ({ value, typeName }) => {
  validatePlainObject(value, typeName)
  const members = _.get(value, 'members', [])
  validateArray(members, `${typeName} members`)

  return {
    value: {
      ...value,
      members: members
        .map((member: unknown): object => {
          validatePlainObject(member, `${typeName} member`)
          return _.pick(member, ['id', ODATA_TYPE_FIELD])
        })
        .filter((member: object) =>
          Object.keys(SUPPORTED_DIRECTORY_OBJECT_ODATA_TYPE_NAME_TO_TYPE_NAME).includes(
            _.get(member, ODATA_TYPE_FIELD),
          ),
        ),
    },
  }
}
