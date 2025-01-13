/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { InstanceElement } from '@salto-io/adapter-api'
import { filterUtils } from '@salto-io/adapter-components'
import { PROJECT_TYPE } from '../../src/constants'
import { createEmptyType, getFilterParams } from '../utils'
import removeSimplifiedFieldProjectFilter from '../../src/filters/remove_simplified_field_project'

describe('removeSimplifiedFieldProjectFilter', () => {
  type FilterType = filterUtils.FilterWith<'onFetch'>
  let filter: FilterType
  const projectInstance = new InstanceElement('project1', createEmptyType(PROJECT_TYPE), {
    id: 11111,
    name: 'project1',
    simplified: false,
    projectTypeKey: 'software',
  })
  const elements = [projectInstance]
  it('should remove simplified field from project instance', async () => {
    filter = removeSimplifiedFieldProjectFilter(getFilterParams({})) as typeof filter
    await filter.onFetch(elements)
    expect(projectInstance.value.simplified).toBeUndefined()
  })
})
