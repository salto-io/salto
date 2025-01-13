/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ElemID, InstanceElement, ObjectType } from '@salto-io/adapter-api'
import _ from 'lodash'
import { getFilterParams } from '../utils'
import missingDescriptionsFilter from '../../src/filters/missing_descriptions'
import { Filter } from '../../src/filter'
import { getDefaultConfig, JiraConfig } from '../../src/config/config'
import { JIRA, PROJECT_ROLE_TYPE } from '../../src/constants'

describe('missingDescriptionsFilter', () => {
  let filter: Filter
  let type: ObjectType
  let instance: InstanceElement
  let config: JiraConfig

  beforeEach(async () => {
    config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))

    filter = missingDescriptionsFilter(getFilterParams({ config }))

    type = new ObjectType({
      elemID: new ElemID(JIRA, PROJECT_ROLE_TYPE),
    })

    instance = new InstanceElement('instance', type)
  })

  describe('onFetch', () => {
    it('should add description if missing', async () => {
      await filter.onFetch?.([instance])

      expect(instance.value).toEqual({
        description: '',
      })
    })

    it('should not change description if not missing', async () => {
      instance.value.description = 'description'
      await filter.onFetch?.([instance])

      expect(instance.value).toEqual({
        description: 'description',
      })
    })

    it('should not change description if not relevant type', async () => {
      instance = new InstanceElement(
        'instance',
        new ObjectType({
          elemID: new ElemID(JIRA, 'not_relevant_type'),
        }),
      )
      await filter.onFetch?.([instance])

      expect(instance.value).toEqual({})
    })
  })
})
