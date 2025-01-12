/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ElemID, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import { filterUtils } from '@salto-io/adapter-components'
import JiraClient from '../../../src/client/client'
import { JIRA, WORKFLOW_TYPE_NAME } from '../../../src/constants'
import resolutionPropertyFilter from '../../../src/filters/workflow/resolution_property_filter'
import { getFilterParams, mockClient } from '../../utils'

describe('resolutionPropertyFilter', () => {
  let filter: filterUtils.FilterWith<'onFetch' | 'preDeploy' | 'onDeploy'>
  let workflowType: ObjectType
  let instance: InstanceElement
  let client: JiraClient
  beforeEach(async () => {
    workflowType = new ObjectType({
      elemID: new ElemID(JIRA, WORKFLOW_TYPE_NAME),
    })
    instance = new InstanceElement('instance', workflowType, {
      transitions: {
        tran1: {
          name: 'tran1',
          properties: {
            'jira.field.resolution.include': '1,2',
            b: '3,4',
          },
        },
        tran2: {
          name: 'tran2',
        },
      },
    })
    const { client: cli, paginator } = mockClient()
    client = cli
    filter = resolutionPropertyFilter(
      getFilterParams({
        client,
        paginator,
      }),
    ) as typeof filter
  })

  describe('onFetch', () => {
    it('should split the resolution property', async () => {
      await filter.onFetch([instance])
      expect(instance.value).toEqual({
        transitions: {
          tran1: {
            name: 'tran1',
            properties: {
              'jira.field.resolution.include': ['1', '2'],
              b: '3,4',
            },
          },
          tran2: {
            name: 'tran2',
          },
        },
      })
    })

    it('should do nothing if there are no transitions', async () => {
      delete instance.value.transitions
      await filter.onFetch([instance])
      expect(instance.value).toEqual({})
    })
  })

  describe('preDeploy', () => {
    it('should join the resolution property', async () => {
      instance.value.transitions.tran1.properties['jira.field.resolution.include'] = ['1', '2']
      await filter.preDeploy([toChange({ after: instance })])

      expect(instance.value).toEqual({
        transitions: {
          tran1: {
            name: 'tran1',
            properties: {
              'jira.field.resolution.include': '1,2',
              b: '3,4',
            },
          },
          tran2: {
            name: 'tran2',
          },
        },
      })
    })

    it('should do nothing if there are no transitions', async () => {
      delete instance.value.transitions
      await filter.preDeploy([toChange({ after: instance })])
      expect(instance.value).toEqual({})
    })
  })

  describe('onDeploy', () => {
    it('should split the resolution property', async () => {
      await filter.onDeploy([toChange({ after: instance })])

      expect(instance.value).toEqual({
        transitions: {
          tran1: {
            name: 'tran1',
            properties: {
              'jira.field.resolution.include': ['1', '2'],
              b: '3,4',
            },
          },
          tran2: {
            name: 'tran2',
          },
        },
      })
    })
  })
})
