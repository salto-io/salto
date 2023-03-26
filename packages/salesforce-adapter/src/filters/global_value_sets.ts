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
import { Element, ObjectType, Field, ReferenceExpression, ElemID, isObjectType } from '@salto-io/adapter-api'
import { multiIndex } from '@salto-io/lowerdash'
import { FilterWith, LocalFilterCreator } from '../filter'
import { VALUE_SET_FIELDS } from '../constants'
import { isCustomObject, apiName } from '../transformers/transformer'
import { isInstanceOfType, buildElementsSourceForFetch } from './utils'

export const GLOBAL_VALUE_SET = 'GlobalValueSet'
export const CUSTOM_VALUE = 'customValue'
export const MASTER_LABEL = 'master_label'

const addGlobalValueSetRefToObject = (
  object: ObjectType,
  gvsToRef: multiIndex.Index<[string], ElemID>
): void => {
  const getValueSetName = (field: Field): string | undefined =>
    field.annotations[VALUE_SET_FIELDS.VALUE_SET_NAME]

  Object.values(object.fields)
    .forEach(f => {
      const valueSetName = getValueSetName(f)
      if (valueSetName === undefined) {
        return
      }
      const valueSetId = gvsToRef.get(valueSetName)
      if (valueSetId) {
        f.annotations[VALUE_SET_FIELDS.VALUE_SET_NAME] = new ReferenceExpression(valueSetId)
      }
    })
}

/**
 * Create filter that adds global value set references where needed
 */
const filterCreator: LocalFilterCreator = ({ config }): FilterWith<'onFetch'> => ({
  name: 'globalValueSetFilter',
  /**
   * @param elements the already fetched elements
   */
  onFetch: async (elements: Element[]): Promise<void> => {
    const referenceElements = buildElementsSourceForFetch(elements, config)
    const valueSetNameToRef = await multiIndex.keyByAsync({
      iter: await referenceElements.getAll(),
      filter: isInstanceOfType(GLOBAL_VALUE_SET),
      key: async inst => [await apiName(inst)],
      map: inst => inst.elemID,
    })
    const customObjects = elements.filter(isObjectType).filter(isCustomObject)
    customObjects.forEach(object => addGlobalValueSetRefToObject(object, valueSetNameToRef))
  },
})

export default filterCreator
