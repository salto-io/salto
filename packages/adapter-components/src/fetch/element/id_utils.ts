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
import { ElemID, OBJECT_NAME, OBJECT_SERVICE_ID, ServiceIds, Values, toServiceIdsString } from '@salto-io/adapter-api'
import { NameMappingOptions } from '../../definitions'

export const getNameMapping = (
  name: string,
  nameMapping?: NameMappingOptions,
): string => {
  switch (nameMapping) {
    case 'lowercase': return name.toLowerCase()
    case 'uppercase': return name.toUpperCase()
    default: return name
  }
}

export const createServiceIDs = ({ entry, serviceIdFields, typeID }: {
  entry: Values
  serviceIdFields: string[]
  typeID: ElemID
}): ServiceIds => ({
  ..._.pick(entry, serviceIdFields),
  [OBJECT_SERVICE_ID]: toServiceIdsString({
    [OBJECT_NAME]: typeID.getFullName(),
  }),
})
