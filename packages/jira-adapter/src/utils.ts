/*
*                      Copyright 2022 Salto Labs Ltd.
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
import { CORE_ANNOTATIONS, ObjectType, Element, isObjectType, getDeepInnerType } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'

const { awu } = collections.asynciterable

export const setDeploymentAnnotations = (contextType: ObjectType, fieldName: string): void => {
  if (contextType.fields[fieldName] !== undefined) {
    contextType.fields[fieldName].annotations[CORE_ANNOTATIONS.CREATABLE] = true
    contextType.fields[fieldName].annotations[CORE_ANNOTATIONS.UPDATABLE] = true
  }
}

export const findObject = (elements: Element[], name: string): ObjectType | undefined =>
  elements.filter(isObjectType).find(
    element => element.elemID.name === name
  )


export const addUpdatableAnnotationRecursively = async (type: ObjectType): Promise<void> =>
  awu(Object.values(type.fields)).forEach(async field => {
    if (!field.annotations[CORE_ANNOTATIONS.UPDATABLE]) {
      field.annotations[CORE_ANNOTATIONS.UPDATABLE] = true
      const fieldType = await getDeepInnerType(await field.getType())
      if (isObjectType(fieldType)) {
        await addUpdatableAnnotationRecursively(fieldType)
      }
    }
  })
