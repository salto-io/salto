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
import { Element, ElemID, InstanceElement, ObjectType, ReferenceExpression } from '@salto-io/adapter-api'
import { naclCase } from '@salto-io/adapter-utils'

export const MISSING_ANNOTATION = 'salto_missing_ref'
export const MISSING_REF_PREFIX = 'missing_'

export const checkMissingRef = (element: Element): boolean => element.annotations?.[MISSING_ANNOTATION] === true

export const createMissingInstance = (adapter: string, typeName: string, refName: string): InstanceElement =>
  new InstanceElement(
    naclCase(`${MISSING_REF_PREFIX}${refName}`),
    new ObjectType({ elemID: new ElemID(adapter, typeName) }),
    {},
    undefined,
    { [MISSING_ANNOTATION]: true },
  )

export const createMissingValueReference = (elemID: ElemID, value: string): ReferenceExpression =>
  new ReferenceExpression(elemID.createNestedID(naclCase(`${MISSING_REF_PREFIX}${value}`)))
