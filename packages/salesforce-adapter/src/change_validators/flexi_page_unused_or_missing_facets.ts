/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import _ from 'lodash'
import { collections } from '@salto-io/lowerdash'
import { ChangeValidator, getChangeData, InstanceElement, isAdditionOrModificationChange } from '@salto-io/adapter-api'
import { FLEXI_PAGE_TYPE } from '../constants'
import { isInstanceOfTypeSync } from '../filters/utils'
import { TransformFuncSync } from '@salto-io/adapter-utils'

const { DefaultMap } = collections.map

const getFacetDefinitionsAndReferences = (
  element: InstanceElement,
): { facetDefinitions: Record<string, string>, facetReferences: Map<string, string[]> } => {
  const facetDefinitions: Record<string, string> = {}
  const facetReferences = new DefaultMap<string, string[]>(() => [])
    const findDefinitionsAndReferences: TransformFuncSync = ({ value, path, field }) => {
      if (_.isUndefined(field) || _.isUndefined(path)) return value
      if (isFlowNode(field.parent.fields) && path.name === FLOW_NODE_FIELD_NAMES.NAME && _.isString(value)) {
        flowNodes[value] = path
      }
      if (path.name === TARGET_REFERENCE && _.isString(value)) {
        targetReferences.get(value).push(path)
      }
      return value
    }
    transformValuesSync({
      values: element.value,
      pathID: element.elemID,
      type: element.getTypeSync(),
      transformFunc: findFlowNodesAndTargetReferences,
    })
    return { flowNodes, targetReferences }
  }
}

const changeValidator: ChangeValidator = async changes =>
  changes
    .filter(isAdditionOrModificationChange)
    .map(getChangeData)
    .filter(isInstanceOfTypeSync(FLEXI_PAGE_TYPE))
    .map(getFacetDefinitionsAndReferences)

export default changeValidator
