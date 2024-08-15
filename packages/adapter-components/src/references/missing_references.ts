/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
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
