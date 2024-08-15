/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/
import {
  InstanceElement,
  isInstanceElement,
  ObjectType,
  Element,
  ElemID,
  ReferenceExpression,
} from '@salto-io/adapter-api'
import { findObjectType } from '@salto-io/adapter-utils'
import _ from 'lodash'
import { JIRA } from '../src/constants'

export const findType = (name: string, allElements: Element[]): ObjectType => {
  const type = findObjectType(allElements, new ElemID(JIRA, name))
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

export const createReference = (elemID: ElemID, allElements: Element[], path: string[] = []): ReferenceExpression => {
  const instance = findInstance(elemID, allElements)
  return new ReferenceExpression(
    elemID.createNestedID(...path),
    _.isEmpty(path) ? instance : _.get(instance.value, path),
  )
}
