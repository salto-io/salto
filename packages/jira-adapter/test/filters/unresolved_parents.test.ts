/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { CORE_ANNOTATIONS, ElemID, InstanceElement, ObjectType, ReferenceExpression } from '@salto-io/adapter-api'
import { getFilterParams } from '../utils'
import unresolvedParentsFilter from '../../src/filters/unresolved_parents'
import { Filter } from '../../src/filter'
import { JIRA } from '../../src/constants'

describe('unresolvedParentsFilter', () => {
  let filter: Filter
  let type: ObjectType
  beforeEach(async () => {
    filter = unresolvedParentsFilter(getFilterParams({}))

    type = new ObjectType({
      elemID: new ElemID(JIRA, 'someType'),
    })
  })

  describe('onFetch', () => {
    it('should remove instances with unresolved parents', async () => {
      const inst1 = new InstanceElement('inst1', type, {}, [], {
        [CORE_ANNOTATIONS.PARENT]: [
          new ReferenceExpression(new ElemID(JIRA, 'someType', 'instance', 'existingParent')),
        ],
      })

      const parent = new InstanceElement('existingParent', type, {}, [])

      const inst2 = new InstanceElement('inst2', type, {}, [], {
        [CORE_ANNOTATIONS.PARENT]: [
          new ReferenceExpression(new ElemID(JIRA, 'someType', 'instance', 'nonExistingParent')),
        ],
      })

      const elements = [inst1, inst2, parent]
      await filter.onFetch?.(elements)
      expect(elements.map(e => e.elemID.name)).toEqual(['inst1', 'existingParent'])
    })
  })
})
