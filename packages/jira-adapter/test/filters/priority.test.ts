/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/
import { BuiltinTypes, ElemID, InstanceElement, ObjectType, toChange, getChangeData } from '@salto-io/adapter-api'
import _ from 'lodash'
import { getFilterParams, mockClient } from '../utils'
import priorityFilter from '../../src/filters/priority'
import { Filter } from '../../src/filter'
import { getDefaultConfig, JiraConfig } from '../../src/config/config'
import { JIRA, PRIORITY_TYPE_NAME } from '../../src/constants'
import JiraClient from '../../src/client/client'

describe('priorityFilter', () => {
  let filter: Filter
  let type: ObjectType
  let config: JiraConfig
  let client: JiraClient

  beforeEach(async () => {
    const { client: cli, paginator } = mockClient()
    client = cli

    config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
    filter = priorityFilter(
      getFilterParams({
        client,
        paginator,
        config,
      }),
    )

    type = new ObjectType({
      elemID: new ElemID(JIRA, PRIORITY_TYPE_NAME),
      fields: {
        id: { refType: BuiltinTypes.STRING },
        name: { refType: BuiltinTypes.STRING },
        description: { refType: BuiltinTypes.STRING },
        iconUrl: { refType: BuiltinTypes.STRING },
        statusColor: { refType: BuiltinTypes.STRING },
      },
    })
  })

  describe('onFetch', () => {
    it('should remove is default when it is false', async () => {
      const instance = new InstanceElement('instance', type, { isDefault: false })

      await filter.onFetch?.([instance])
      expect(instance.value).toEqual({})
    })

    it('should not remove is default when it is true', async () => {
      const instance = new InstanceElement('instance', type, { isDefault: true })

      await filter.onFetch?.([instance])
      expect(instance.value).toEqual({ isDefault: true })
    })
  })
  describe('preDeploy', () => {
    const iconUrlTruncatePath = '/folder/image.png'
    it('should concat the client base url to the instance icon url', async () => {
      const instance = new InstanceElement('instance', type, { iconUrl: iconUrlTruncatePath })
      const changes = [toChange({ after: instance })]
      await filter.preDeploy?.(changes)
      expect(getChangeData(changes[0]).value.iconUrl).toEqual(new URL(iconUrlTruncatePath, client.baseUrl).href)
    })
  })
  describe('onDeploy', () => {
    it('should remove the domain prefix from the iconUrl field', async () => {
      const iconUrlTruncatePath = '/folder/image.png'
      const instance = new InstanceElement('instance', type, {
        iconUrl: new URL(iconUrlTruncatePath, client.baseUrl).href,
      })
      const changes = [toChange({ after: instance })]
      await filter.onDeploy?.(changes)
      expect(getChangeData(changes[0]).value.iconUrl).toEqual(iconUrlTruncatePath)
    })
  })
})
