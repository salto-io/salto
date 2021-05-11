/*
*                      Copyright 2021 Salto Labs Ltd.
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
import { isContainerType, ObjectType } from '@salto-io/adapter-api'


export const getSubtypes = (types: ObjectType[]): ObjectType[] => {
  const subtypes: Record<string, ObjectType> = {}

  const findSubtypes = (type: ObjectType): void => {
    Object.values(type.fields).forEach(field => {
      const fieldType = isContainerType(field.type) ? field.type.innerType : field.type

      if (!(fieldType instanceof ObjectType)
        || fieldType.elemID.getFullName() in subtypes
        || types.includes(fieldType)) {
        return
      }

      subtypes[fieldType.elemID.getFullName()] = fieldType
      findSubtypes(fieldType)
    })
  }

  types.forEach(findSubtypes)

  return Object.values(subtypes)
}
