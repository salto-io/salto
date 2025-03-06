/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { Element, ObjectType, Field, ReferenceExpression, isObjectType } from '@salto-io/adapter-api'
import { multiIndex } from '@salto-io/lowerdash'
import { FilterCreator } from '../filter'
import { VALUE_SET_FIELDS } from '../constants'
import { apiName } from '../transformers/transformer'
import { isInstanceOfType, buildElementsSourceForFetch, isCustomObjectSync } from './utils'

export const GLOBAL_VALUE_SET = 'GlobalValueSet'
export const CUSTOM_VALUE = 'customValue'
export const MASTER_LABEL = 'master_label'

const addGlobalValueSetRefToObject = (object: ObjectType, gvsToRef: multiIndex.Index<[string], Element>): void => {
  const getValueSetName = (field: Field): string | undefined => field.annotations[VALUE_SET_FIELDS.VALUE_SET_NAME]

  Object.values(object.fields).forEach(f => {
    const valueSetName = getValueSetName(f)
    if (valueSetName === undefined) {
      return
    }
    const valueSetInstance = gvsToRef.get(valueSetName)
    if (valueSetInstance) {
      f.annotations[VALUE_SET_FIELDS.VALUE_SET_NAME] = new ReferenceExpression(
        valueSetInstance.elemID,
        valueSetInstance,
      )
    }
  })
}

/**
 * Create filter that adds global value set references where needed
 */
const filterCreator: FilterCreator = ({ config }) => ({
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
    })
    const customObjects = elements.filter(isObjectType).filter(isCustomObjectSync)
    customObjects.forEach(object => addGlobalValueSetRefToObject(object, valueSetNameToRef))
  },
})

export default filterCreator
