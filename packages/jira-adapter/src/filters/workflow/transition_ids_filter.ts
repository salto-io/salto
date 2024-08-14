/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { Element, getChangeData, isAdditionOrModificationChange, isInstanceElement } from '@salto-io/adapter-api'
import { FilterCreator } from '../../filter'
import { isWorkflowV1Instance } from './types'

/**
 * A filter that deletes the transition ids from all the workflows.
 * We delete the ids since they are not env friendly and not needed
 * (since we implement modification of a workflow with addition and removal)
 */
const filter: FilterCreator = () => ({
  name: 'transitionIdsFilter',
  onFetch: async (elements: Element[]) => {
    elements
      .filter(isInstanceElement)
      .filter(isWorkflowV1Instance)
      .forEach(instance => {
        Object.values(instance.value.transitions).forEach(transition => {
          // We don't need to id after this filter since
          // in modification we remove and create a new workflow
          delete transition.id
        })
      })
  },
  onDeploy: async changes => {
    changes
      .filter(isAdditionOrModificationChange)
      .map(getChangeData)
      .filter(isInstanceElement)
      .filter(isWorkflowV1Instance)
      .forEach(instance => {
        Object.values(instance.value.transitions).forEach(transition => {
          // We don't need to id after this filter since
          // in modification we remove and create a new workflow
          delete transition.id
        })
      })
  },
})

export default filter
