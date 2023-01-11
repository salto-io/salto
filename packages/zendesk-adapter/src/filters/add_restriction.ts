/*
*                      Copyright 2023 Salto Labs Ltd.
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
import {
  CORE_ANNOTATIONS,
  createRestriction,
  Element,
  isObjectType,
  ObjectType,
  RestrictionAnnotationType,
} from '@salto-io/adapter-api'
import { FilterCreator } from '../filter'

type AllRestrictionsToMake = Record<string, RestrictionAnnotationType>
type RestrictionByType = Record<string, AllRestrictionsToMake>

const TYPE_NAME_TO_FIELD_RESTRICTIONS: RestrictionByType = {
  ticket_field__custom_field_options: {
    value: {
      regex: '^[0-9A-Za-z-_.\\/~:^]+$',
      enforce_value: true,
    },
  },
}


const addRestriction = (obj: ObjectType) : void => {
  const typeToChange = TYPE_NAME_TO_FIELD_RESTRICTIONS[obj.elemID.typeName]
  Object.keys(typeToChange).forEach(field => {
    if (Object.prototype.hasOwnProperty.call(obj.fields, field)) {
      obj.fields[field].annotations[CORE_ANNOTATIONS.RESTRICTION] = createRestriction(
        typeToChange[field]
      )
    }
  })
}

const filterCreator: FilterCreator = () => ({
  onFetch: async (elements: Element[]): Promise<void> => {
    elements
      .filter(isObjectType)
      .filter(obj => Object.keys(TYPE_NAME_TO_FIELD_RESTRICTIONS).includes(obj.elemID.typeName))
      .forEach(addRestriction)
  },
})

export default filterCreator
