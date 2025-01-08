/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  Change,
  CORE_ANNOTATIONS,
  ElemID,
  getChangeData,
  InstanceElement,
  ReferenceExpression,
  toChange,
} from '@salto-io/adapter-api'
import { filterUtils, client as clientUtils } from '@salto-io/adapter-components'
import _ from 'lodash'
import { createEmptyType, getFilterParams, mockClient } from '../../utils'
import { getDefaultConfig, JiraConfig } from '../../../src/config/config'
import { FIELD_TYPE } from '../../../src/constants'
import orderDeploymentFilter from '../../../src/filters/fields/context_options_order_deployment_filter'
import JiraClient from '../../../src/client/client'
import * as contextsOptions from '../../../src/filters/fields/context_options'
import { FIELD_CONTEXT_TYPE_NAME, OPTIONS_ORDER_TYPE_NAME } from '../../../src/filters/fields/constants'

describe('fieldContextOptionsOrderDeploymentFilter', () => {
  let filter: filterUtils.FilterWith<'onFetch' | 'deploy'>
  let changes: Change<InstanceElement>[]
  let config: JiraConfig
  let client: JiraClient
  let paginator: clientUtils.Paginator
  const reorderMock = jest.spyOn(contextsOptions, 'deployOptionsOrder')

  beforeEach(() => {
    reorderMock.mockClear()
    config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
    config.fetch.splitFieldContextOptions = true
    ;({ client, paginator } = mockClient())

    filter = orderDeploymentFilter(
      getFilterParams({
        client,
        paginator,
        config,
      }),
    ) as typeof filter

    const fieldInstance = new InstanceElement('field', createEmptyType(FIELD_TYPE), { id: '1field' })
    const contextInstance = new InstanceElement(
      'context',
      createEmptyType(FIELD_CONTEXT_TYPE_NAME),
      { id: '1context' },
      undefined,
      {
        [CORE_ANNOTATIONS.PARENT]: new ReferenceExpression(fieldInstance.elemID, fieldInstance),
      },
    )
    const orderInstance = new InstanceElement(
      'order',
      createEmptyType(OPTIONS_ORDER_TYPE_NAME),
      {
        options: [
          new ReferenceExpression(
            new ElemID('bla1'),
            new InstanceElement('bla1', createEmptyType('bla1'), { bla1: 1 }),
          ),
          new ReferenceExpression(
            new ElemID('bla2'),
            new InstanceElement('bla2', createEmptyType('bla2'), { bla2: 2 }),
          ),
        ],
      },
      undefined,
      {
        [CORE_ANNOTATIONS.PARENT]: new ReferenceExpression(contextInstance.elemID, contextInstance),
      },
    )
    const orderInstance2 = new InstanceElement(
      'order2',
      createEmptyType(OPTIONS_ORDER_TYPE_NAME),
      {
        options: [
          new ReferenceExpression(
            new ElemID('bla3'),
            new InstanceElement('bla3', createEmptyType('bla3'), { bla3: 3 }),
          ),
          new ReferenceExpression(
            new ElemID('bla4'),
            new InstanceElement('bla4', createEmptyType('bla4'), { bla4: 4 }),
          ),
        ],
      },
      undefined,
      {
        [CORE_ANNOTATIONS.PARENT]: new ReferenceExpression(contextInstance.elemID, contextInstance),
      },
    )
    const randomInstance = new InstanceElement('random', createEmptyType('random'), {})
    changes = [
      toChange({ after: orderInstance }),
      toChange({ after: orderInstance2 }),
      toChange({ after: randomInstance }),
    ]
  })
  it('should call reorderContextOptions', async () => {
    await filter.deploy(changes)
    expect(reorderMock).toHaveBeenCalledTimes(2)
    expect(reorderMock).toHaveBeenCalledWith(
      [{ bla1: 1 }, { bla2: 2 }],
      client,
      '/rest/api/3/field/1field/context/1context/option',
    )
    expect(reorderMock).toHaveBeenCalledWith(
      [{ bla3: 3 }, { bla4: 4 }],
      client,
      '/rest/api/3/field/1field/context/1context/option',
    )
  })
  it('should return the correct deploy results', async () => {
    const result = await filter.deploy(changes)
    expect(result.deployResult.errors).toHaveLength(0)
    expect(result.deployResult.appliedChanges).toEqual(changes.slice(0, 2))
    expect(result.leftoverChanges).toHaveLength(1)
    expect(result.leftoverChanges[0]).toEqual(changes[2])
  })
  it('should do nothing on delete change', async () => {
    changes[1] = toChange({ before: getChangeData(changes[0]) })
    const result = await filter.deploy(changes)
    expect(reorderMock).toHaveBeenCalledOnce()
    expect(result.deployResult.errors).toHaveLength(0)
    expect(result.deployResult.appliedChanges).toHaveLength(2)
    expect(result.leftoverChanges).toHaveLength(1)
  })
  it('should call with empty list when order does not have options', async () => {
    getChangeData(changes[0]).value.options = undefined
    const result = await filter.deploy(changes.slice(0, 1))
    expect(reorderMock).toHaveBeenCalledTimes(1)
    expect(reorderMock).toHaveBeenCalledWith([], client, '/rest/api/3/field/1field/context/1context/option')
    expect(result.deployResult.errors).toHaveLength(0)
    expect(result.deployResult.appliedChanges).toHaveLength(1)
    expect(result.leftoverChanges).toHaveLength(0)
  })
  it('should not deploy if flag is off', async () => {
    config.fetch.splitFieldContextOptions = false
    filter = orderDeploymentFilter(
      getFilterParams({
        client,
        paginator,
        config,
      }),
    ) as typeof filter
    const result = await filter.deploy(changes)
    expect(result.deployResult).toEqual({ appliedChanges: [], errors: [] })
    expect(result.leftoverChanges).toHaveLength(3)
    expect(reorderMock).not.toHaveBeenCalled()
  })
})
