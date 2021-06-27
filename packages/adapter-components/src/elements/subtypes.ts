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
import { isContainerType, ObjectType, isObjectType } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'

const { awu } = collections.asynciterable

export const getSubtypes = async (types: ObjectType[]): Promise<ObjectType[]> => {
  const subtypes: Record<string, ObjectType> = {}

  const findSubtypes = async (type: ObjectType): Promise<void> => {
    await awu(Object.values(type.fields)).forEach(async field => {
      const fieldContainerOrType = await field.getType()
      const fieldType = isContainerType(fieldContainerOrType)
        ? await fieldContainerOrType.getInnerType()
        : fieldContainerOrType

      if (!isObjectType(fieldType)
        || fieldType.elemID.getFullName() in subtypes
        || types.includes(fieldType)) {
        return
      }

      subtypes[fieldType.elemID.getFullName()] = fieldType
      await findSubtypes(fieldType)
    })
  }

  await awu(types).forEach(findSubtypes)

  return Object.values(subtypes)
}
