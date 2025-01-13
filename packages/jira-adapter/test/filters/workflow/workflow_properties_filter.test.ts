/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ElemID, getChangeData, InstanceElement, ListType, MapType, ObjectType, toChange } from '@salto-io/adapter-api'
import { filterUtils } from '@salto-io/adapter-components'
import JiraClient from '../../../src/client/client'
import { JIRA, WORKFLOW_TYPE_NAME } from '../../../src/constants'
import workflowPropertiesFilter from '../../../src/filters/workflow/workflow_properties_filter'
import { getFilterParams, mockClient } from '../../utils'

describe('workflowPropertiesFilter', () => {
  let filter: filterUtils.FilterWith<'onFetch' | 'deploy'>
  let workflowType: ObjectType
  let workflowStatusType: ObjectType
  let workflowTransitionType: ObjectType
  let client: JiraClient
  beforeEach(async () => {
    workflowStatusType = new ObjectType({ elemID: new ElemID(JIRA, 'WorkflowStatus') })
    workflowTransitionType = new ObjectType({ elemID: new ElemID(JIRA, 'Transition') })
    workflowType = new ObjectType({
      elemID: new ElemID(JIRA, WORKFLOW_TYPE_NAME),
      fields: {
        statuses: { refType: new ListType(workflowStatusType) },
        transitions: { refType: new MapType(workflowTransitionType) },
      },
    })

    const { client: cli, paginator } = mockClient()
    client = cli
    filter = workflowPropertiesFilter(
      getFilterParams({
        client,
        paginator,
      }),
    ) as typeof filter
  })

  describe('onFetch', () => {
    it('should set the properties field in WorkflowStatus', async () => {
      const elements = [workflowStatusType]
      await filter.onFetch(elements)
      expect(workflowStatusType.fields.properties).toBeDefined()
      expect(elements).toHaveLength(2)
    })

    it('should set the properties field in Transition', async () => {
      const elements = [workflowTransitionType]
      await filter.onFetch(elements)
      expect(workflowTransitionType.fields.properties).toBeDefined()
      expect(elements).toHaveLength(2)
    })

    it('should replace properties from map to list in statuses', async () => {
      const instance = new InstanceElement('instance', workflowType, {
        statuses: [
          {
            properties: {
              a: '1',
              b: '2',
            },
          },
          {
            properties: {
              c: '3',
              d: '4',
            },
          },
        ],
        transitions: {},
      })
      await filter.onFetch([instance])
      expect(instance.value).toEqual({
        statuses: [
          {
            properties: [
              { key: 'a', value: '1' },
              { key: 'b', value: '2' },
            ],
          },
          {
            properties: [
              { key: 'c', value: '3' },
              { key: 'd', value: '4' },
            ],
          },
        ],
        transitions: {},
      })
    })

    it('should replace properties from map to list in transitions', async () => {
      const instance = new InstanceElement('instance', workflowType, {
        transitions: {
          a: {
            name: 'a',
            properties: {
              a: '1',
              b: '2',
            },
          },
          b: {
            name: 'b',
            properties: {
              c: '3',
              d: '4',
            },
          },
        },
      })
      await filter.onFetch([instance])
      expect(instance.value).toEqual({
        transitions: {
          a: {
            name: 'a',
            properties: [
              { key: 'a', value: '1' },
              { key: 'b', value: '2' },
            ],
          },
          b: {
            name: 'b',
            properties: [
              { key: 'c', value: '3' },
              { key: 'd', value: '4' },
            ],
          },
        },
      })
    })
  })

  describe('pre/on Deploy', () => {
    it('should replace properties from list to map statuses', async () => {
      const instance = new InstanceElement('instance', workflowType, {
        statuses: [
          {
            properties: [
              { key: 'a', value: '1' },
              { key: 'b', value: '2' },
            ],
          },
          {
            properties: [
              { key: 'c', value: '3' },
              { key: 'd', value: '4' },
            ],
          },
        ],
        transitions: {},
      })
      const changes = [toChange({ after: instance })]
      await filter.preDeploy?.(changes)

      const instanceAfter = getChangeData(changes[0])
      expect(instanceAfter.value).toEqual({
        statuses: [
          {
            properties: {
              a: '1',
              b: '2',
            },
          },
          {
            properties: {
              c: '3',
              d: '4',
            },
          },
        ],
        transitions: {},
      })

      await filter.onDeploy?.(changes)

      const instanceBefore = getChangeData(changes[0])
      expect(instanceBefore.value).toEqual(instance.value)
    })

    it('should replace properties from list to map transitions', async () => {
      const instance = new InstanceElement('instance', workflowType, {
        transitions: {
          a: {
            name: 'a',
            properties: [
              { key: 'a', value: '1' },
              { key: 'b', value: '2' },
            ],
          },
          b: {
            name: 'b',
            properties: [
              { key: 'c', value: '3' },
              { key: 'd', value: '4' },
            ],
          },
        },
      })
      const changes = [toChange({ after: instance })]
      await filter.preDeploy?.(changes)

      const instanceAfter = getChangeData(changes[0])
      expect(instanceAfter.value).toEqual({
        transitions: {
          a: {
            name: 'a',
            properties: {
              a: '1',
              b: '2',
            },
          },
          b: {
            name: 'b',
            properties: {
              c: '3',
              d: '4',
            },
          },
        },
      })

      await filter.onDeploy?.(changes)

      const instanceBefore = getChangeData(changes[0])
      expect(instanceBefore.value).toEqual(instance.value)
    })
  })
})
