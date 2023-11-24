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
import _ from 'lodash'
import { Element, Field, ReferenceExpression, InstanceElement, ElemID, getField, isReferenceExpression } from '@salto-io/adapter-api'
import { resolvePath, GetLookupNameFunc } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { multiIndex } from '@salto-io/lowerdash'

const log = logger(module)

export type ContextValueMapperFunc = (val: string) => string | undefined
export type ContextFunc = ({ instance, elemByElemID, field, fieldPath }: {
  instance: InstanceElement
  elemByElemID: multiIndex.Index<[string], Element>
  field: Field
  fieldPath?: ElemID
  levelsUp?: number
}) => Promise<string | undefined>

export const findParentPath = (currentFieldPath: ElemID, numLevels = 0): ElemID => {
  const getParentPath = (p: ElemID): ElemID => {
    const isNum = (str: string | undefined): boolean => (
      !_.isEmpty(str) && !Number.isNaN(_.toNumber(str))
    )
    let path = p
    // ignore array indices
    while (isNum(path.getFullNameParts().pop())) {
      path = path.createParentID()
    }
    return path.createParentID()
  }
  if (numLevels <= 0) {
    return getParentPath(currentFieldPath)
  }
  return findParentPath(getParentPath(currentFieldPath), numLevels - 1)
}

/**
 * Use the value of a neighbor field as the context for finding the referenced element.
 *
 * @param contextFieldName    The name of the neighboring field (same level)
 * @param levelsUp            How many levels to go up in the instance's type definition before
 *                            looking for the neighbor or "top" for top-level element
 * @param contextValueMapper  An additional function to use to convert the value before the lookup
 */
export const neighborContextGetter = ({
  contextFieldName,
  levelsUp = 0,
  contextValueMapper,
  getLookUpName,
}: {
  contextFieldName: string
  levelsUp?: number | 'top'
  contextValueMapper?: ContextValueMapperFunc
  getLookUpName: GetLookupNameFunc
}): ContextFunc => (async ({ instance, elemByElemID, fieldPath }) => {
  if (fieldPath === undefined || contextFieldName === undefined) {
    return undefined
  }

  const resolveReference = async (
    context: ReferenceExpression,
    path?: ElemID
  ): Promise<string | undefined> => {
    const contextField = await getField(
      await instance.getType(),
      fieldPath.createTopLevelParentID().path
    )
    const refWithValue = new ReferenceExpression(
      context.elemID,
      context.value ?? elemByElemID.get(context.elemID.getFullName()),
    )
    return getLookUpName({ ref: refWithValue, field: contextField, path, element: instance })
  }

  try {
    const parent = levelsUp === 'top' ? fieldPath.createTopLevelParentID().parent : findParentPath(fieldPath, levelsUp)
    if (parent.isConfigType()) {
      // went up too many levels, the current rule is irrelevant for this potential reference
      return undefined
    }
    const contextPath = parent.createNestedID(contextFieldName)
    const context = resolvePath(instance, contextPath)
    const contextStr = isReferenceExpression(context)
      ? await resolveReference(context, contextPath)
      : context

    if (!_.isString(contextStr)) {
      return undefined
    }
    return contextValueMapper ? contextValueMapper(contextStr) : contextStr
  } catch (e) {
    log.error('could not resolve context for reference. error: %s, params: %s, stack: %s', e, { fieldPath, contextFieldName, levelsUp }, (e as Error).stack)
    return undefined
  }
})
