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
import { InstanceElement, isInstanceElement, isObjectType, ObjectType, Element, ElemID, ReferenceExpression } from '@salto-io/adapter-api'


export const findType = (name: string, allElements: Element[]): ObjectType => {
  const type = allElements.filter(isObjectType).find(e => e.elemID.name === name)
  if (type === undefined) {
    throw new Error(`${name} type was not found in received elements`)
  }
  return type
}

export const findInstance = (id: ElemID, allElements: Element[]): InstanceElement => {
  const instance = allElements.filter(isInstanceElement).find(e => e.elemID.isEqual(id))
  if (instance === undefined) {
    throw new Error(`${id.getFullName()} instance was not found in received elements`)
  }
  return instance
}

export const createReference = (elemID: ElemID, allElements: Element[]): ReferenceExpression =>
  new ReferenceExpression(elemID, findInstance(elemID, allElements))
