/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ElemID, InstanceElement, ObjectType } from '@salto-io/adapter-api'
import _ from 'lodash'
import { getFilterParams } from '../utils'
import maskingFilter, { MASK_VALUE } from '../../src/filters/masking'
import { Filter } from '../../src/filter'
import { getDefaultConfig, JiraConfig } from '../../src/config/config'
import { AUTOMATION_TYPE, JIRA } from '../../src/constants'

describe('maskingFilter', () => {
  let filter: Filter
  let type: ObjectType
  let instance: InstanceElement
  let config: JiraConfig

  beforeEach(async () => {
    config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))

    filter = maskingFilter(getFilterParams({ config }))

    type = new ObjectType({
      elemID: new ElemID(JIRA, AUTOMATION_TYPE),
    })

    instance = new InstanceElement('instance', type, {
      headers: [
        {
          name: 'name1',
          value: 'value1',
        },
        {
          name: 'name2',
          value: 'value2',
        },
        {
          name: 'aname3',
          value: 'avalue3',
        },
      ],
    })
  })

  describe('onFetch', () => {
    describe('automationHeaders', () => {
      it('should mask the sensitive headers', async () => {
        config.masking.automationHeaders = ['name.*']

        await filter.onFetch?.([instance])

        expect(instance.value).toEqual({
          headers: [
            {
              name: 'name1',
              value: MASK_VALUE,
            },
            {
              name: 'name2',
              value: MASK_VALUE,
            },
            {
              name: 'aname3',
              value: 'avalue3',
            },
          ],
        })
      })
    })

    describe('secretRegexps', () => {
      it('should mask the sensitive strings', async () => {
        config.masking.secretRegexps = ['name.*']

        await filter.onFetch?.([instance])

        expect(instance.value).toEqual({
          headers: [
            {
              name: MASK_VALUE,
              value: 'value1',
            },
            {
              name: MASK_VALUE,
              value: 'value2',
            },
            {
              name: 'aname3',
              value: 'avalue3',
            },
          ],
        })
      })
    })
  })
})
