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
  Element,
  ElemID,
  getChangeData,
  InstanceElement,
  isAdditionChange,
  isRemovalChange,
  isSaltoElementError,
  ReadOnlyElementsSource,
  ReferenceExpression,
  SeverityLevel,
  toChange,
} from '@salto-io/adapter-api'
import { filterUtils, client as clientUtils } from '@salto-io/adapter-components'
import _ from 'lodash'
import { MockInterface } from '@salto-io/test-utils'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { createEmptyType, generateOptionInstances, getFilterParams, mockClient } from '../../utils'
import { getDefaultConfig, JiraConfig } from '../../../src/config/config'
import optionsDeploymentFilter from '../../../src/filters/fields/context_options_deployment_filter'
import JiraClient from '../../../src/client/client'
import {
  FIELD_CONTEXT_OPTION_TYPE_NAME,
  FIELD_CONTEXT_TYPE_NAME,
  FIELD_TYPE_NAME,
  OPTIONS_ORDER_TYPE_NAME,
} from '../../../src/filters/fields/constants'
import { JSP_API_HEADERS } from '../../../src/client/headers'

describe('ContextOptionsDeployment', () => {
  let filter: filterUtils.FilterWith<'onFetch' | 'deploy'>
  let config: JiraConfig
  let client: JiraClient
  let connection: MockInterface<clientUtils.APIConnection>
  let paginator: clientUtils.Paginator
  let elements: Element[]
  let elementsSource: ReadOnlyElementsSource
  // Done here as it is needed got the 10K options, and we want to create them once
  const fieldInstance = new InstanceElement('field', createEmptyType(FIELD_TYPE_NAME), { id: '1field' })
  let contextInstance: InstanceElement
  let changes: Change<InstanceElement>[]
  let addOption1: InstanceElement
  let addOption2: InstanceElement

  beforeEach(() => {
    config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
    config.fetch.splitFieldContextOptions = true
    ;({ connection, client, paginator } = mockClient())
    const optionType = createEmptyType(FIELD_CONTEXT_OPTION_TYPE_NAME)
    contextInstance = new InstanceElement(
      'context',
      createEmptyType(FIELD_CONTEXT_TYPE_NAME),
      { id: '1context' },
      undefined,
      {
        [CORE_ANNOTATIONS.PARENT]: new ReferenceExpression(fieldInstance.elemID, fieldInstance),
      },
    )
    addOption1 = new InstanceElement('option0', optionType, { value: 'p1' }, undefined, {
      [CORE_ANNOTATIONS.PARENT]: new ReferenceExpression(contextInstance.elemID, contextInstance),
    })
    addOption2 = new InstanceElement('option1', optionType, { value: 'p2' }, undefined, {
      [CORE_ANNOTATIONS.PARENT]: new ReferenceExpression(contextInstance.elemID, contextInstance),
    })
    const optionsInstances = _.range(2, 6).map(
      i =>
        new InstanceElement(`option${i}`, optionType, { id: `${i}option` }, undefined, {
          [CORE_ANNOTATIONS.PARENT]: new ReferenceExpression(contextInstance.elemID, contextInstance),
        }),
    )
    const randomInstance = new InstanceElement('random', createEmptyType('random'), {})
    elements = [fieldInstance, contextInstance, addOption1, addOption2, ...optionsInstances, randomInstance]
    elementsSource = buildElementsSourceFromElements(elements)
    filter = optionsDeploymentFilter(
      getFilterParams({
        client,
        paginator,
        config,
        elementsSource,
      }),
    ) as typeof filter
    changes = [
      toChange({ after: addOption1 }),
      toChange({ after: addOption2 }),
      toChange({ before: addOption1, after: optionsInstances[0] }),
      toChange({ before: addOption1, after: optionsInstances[1] }),
      toChange({ before: optionsInstances[2] }),
      toChange({ before: optionsInstances[3] }),
      toChange({ after: randomInstance }),
    ]
  })
  it('should not call outside APIs if flag is off', async () => {
    config.fetch.splitFieldContextOptions = false
    filter = optionsDeploymentFilter(
      getFilterParams({
        client,
        paginator,
        config,
      }),
    ) as typeof filter
    await filter.deploy(changes)
    expect(connection.post).not.toHaveBeenCalled()
    expect(connection.put).not.toHaveBeenCalled()
    expect(connection.delete).not.toHaveBeenCalled()
  })
  it('should return all changes if flag is off', async () => {
    config.fetch.splitFieldContextOptions = false
    filter = optionsDeploymentFilter(
      getFilterParams({
        client,
        paginator,
        config,
      }),
    ) as typeof filter
    const result = await filter.deploy(changes)
    expect(result.leftoverChanges).toHaveLength(7)
    expect(result.deployResult.errors).toHaveLength(0)
    expect(result.deployResult.appliedChanges).toHaveLength(0)
  })
  it('should return an error if not all options are of the same context', async () => {
    const sameFieldInstance = new InstanceElement('field2', createEmptyType(FIELD_TYPE_NAME), { id: '1field' })
    const differentContextInstance = new InstanceElement(
      'context2',
      createEmptyType(FIELD_CONTEXT_TYPE_NAME),
      { id: '2context' },
      undefined,
      {
        [CORE_ANNOTATIONS.PARENT]: new ReferenceExpression(sameFieldInstance.elemID, sameFieldInstance),
      },
    )
    const differentOptionInstance = new InstanceElement(
      'differentContextOption',
      createEmptyType(FIELD_CONTEXT_OPTION_TYPE_NAME),
      { id: 'ddOption' },
      undefined,
      {
        [CORE_ANNOTATIONS.PARENT]: new ReferenceExpression(differentContextInstance.elemID, differentContextInstance),
      },
    )
    changes[1] = toChange({ after: differentOptionInstance })
    const result = await filter.deploy(changes)
    expect(result.leftoverChanges).toHaveLength(1)
    expect(result.deployResult.errors).toHaveLength(6)
    expect(result.deployResult.errors[1]).toEqual({
      elemID: differentOptionInstance.elemID,
      message: 'Inner problem occurred during deployment of custom field context options, please contact support',
      detailedMessage:
        'Inner problem occurred during deployment of custom field context options, please contact support',
      severity: 'Error',
    })
    expect(result.deployResult.appliedChanges).toHaveLength(0)
  })
  it('should return an error if not all options are of the same field', async () => {
    const differentFieldInstance = new InstanceElement('field2', createEmptyType(FIELD_TYPE_NAME), { id: '2field' })
    const sameContextInstance = new InstanceElement(
      'context2',
      createEmptyType(FIELD_CONTEXT_TYPE_NAME),
      { id: '1context' },
      undefined,
      {
        [CORE_ANNOTATIONS.PARENT]: new ReferenceExpression(differentFieldInstance.elemID, differentFieldInstance),
      },
    )
    const differentOptionInstance = new InstanceElement(
      'differentContextOption',
      createEmptyType(FIELD_CONTEXT_OPTION_TYPE_NAME),
      { id: 'ddOption' },
      undefined,
      {
        [CORE_ANNOTATIONS.PARENT]: new ReferenceExpression(sameContextInstance.elemID, sameContextInstance),
      },
    )
    changes[0] = toChange({ after: differentOptionInstance })
    const result = await filter.deploy(changes)
    expect(result.leftoverChanges).toHaveLength(1)
    expect(result.deployResult.errors).toHaveLength(6)
    expect(result.deployResult.errors[0]).toEqual({
      elemID: differentOptionInstance.elemID,
      message: 'Inner problem occurred during deployment of custom field context options, please contact support',
      detailedMessage:
        'Inner problem occurred during deployment of custom field context options, please contact support',
      severity: 'Error',
    })
    expect(result.deployResult.appliedChanges).toHaveLength(0)
  })
  it('should return an error if the service responds with an array', async () => {
    connection.post.mockResolvedValueOnce({
      status: 200,
      data: [],
    })
    const result = await filter.deploy(changes)
    expect(result.leftoverChanges).toHaveLength(1)
    expect(result.deployResult.errors).toHaveLength(6)
    expect(result.deployResult.appliedChanges).toHaveLength(0)
  })
  it('should call post on addition', async () => {
    await filter.deploy(changes)
    expect(connection.post).toHaveBeenCalledTimes(1)
    expect(connection.post).toHaveBeenCalledWith(
      '/rest/api/3/field/1field/context/1context/option',
      {
        options: [{ value: 'p1' }, { value: 'p2' }],
      },
      undefined,
    )
  })
  it('should call put on modification', async () => {
    await filter.deploy(changes)
    expect(connection.put).toHaveBeenCalledTimes(1)
    expect(connection.put).toHaveBeenCalledWith(
      '/rest/api/3/field/1field/context/1context/option',
      {
        options: [{ id: '2option' }, { id: '3option' }],
      },
      undefined,
    )
  })
  it('should call delete on removal', async () => {
    await filter.deploy(changes)
    expect(connection.delete).toHaveBeenCalledTimes(2)
    expect(connection.delete).toHaveBeenCalledWith(
      '/rest/api/3/field/1field/context/1context/option/4option',
      undefined,
    )
    expect(connection.delete).toHaveBeenCalledWith(
      '/rest/api/3/field/1field/context/1context/option/5option',
      undefined,
    )
  })
  it('should remove cascading options before their parents', async () => {
    addOption1.value.id = '1option'
    addOption2.value.id = '2option'
    const cascadeInstance = new InstanceElement(
      'cascadeOption',
      createEmptyType(FIELD_CONTEXT_OPTION_TYPE_NAME),
      { id: 'cascadeOption' },
      undefined,
      {
        [CORE_ANNOTATIONS.PARENT]: new ReferenceExpression(addOption1.elemID, addOption1),
      },
    )
    changes = [
      toChange({ before: addOption1 }),
      toChange({ before: cascadeInstance }),
      toChange({ before: addOption2 }),
    ]
    await filter.deploy(changes)
    expect(connection.delete).toHaveBeenCalledTimes(3)
    expect(connection.delete).toHaveBeenNthCalledWith(
      1,
      '/rest/api/3/field/1field/context/1context/option/cascadeOption',
      undefined,
    )
    expect(connection.delete).toHaveBeenCalledWith(
      '/rest/api/3/field/1field/context/1context/option/1option',
      undefined,
    )
    expect(connection.delete).toHaveBeenCalledWith(
      '/rest/api/3/field/1field/context/1context/option/2option',
      undefined,
    )
  })
  it('should return a correct deployment result', async () => {
    const result = await filter.deploy(changes)
    expect(result.leftoverChanges).toHaveLength(1)
    expect(result.deployResult.errors).toHaveLength(0)
    expect(result.deployResult.appliedChanges).toHaveLength(6)
  })

  it('should properly handle salto errors', async () => {
    connection.post.mockRejectedValueOnce({
      message: 'error message',
      severity: 'info' as SeverityLevel,
      elemID: new ElemID('bla'),
    })
    const result = await filter.deploy(changes)
    expect(result.leftoverChanges).toHaveLength(1)
    expect(result.deployResult.errors).toHaveLength(6)
    expect(isSaltoElementError(result.deployResult.errors[0])).toBeTruthy()
    expect(result.deployResult.errors[0]).toHaveProperty('elemID', getChangeData(changes[0]).elemID)
    expect(result.deployResult.appliedChanges).toHaveLength(0)
  })
  it('should properly handle non salto errors', async () => {
    connection.post.mockRejectedValueOnce(new Error('error message'))
    const result = await filter.deploy(changes)
    expect(result.leftoverChanges).toHaveLength(1)
    expect(result.deployResult.errors).toHaveLength(6)
    expect(isSaltoElementError(result.deployResult.errors[0])).toBeTruthy()
    expect(result.deployResult.errors[0]).toHaveProperty('elemID', getChangeData(changes[0]).elemID)
    expect(result.deployResult.appliedChanges).toHaveLength(0)
  })
  it('should not issue an error if a removal fails with 404', async () => {
    connection.delete.mockImplementation(async () => {
      throw new clientUtils.HTTPError('message', {
        status: 404,
        data: {},
      })
    })
    const removalChanges = changes.filter(isRemovalChange)
    const result = await filter.deploy(removalChanges)
    expect(result.leftoverChanges).toHaveLength(0)
    expect(result.deployResult.errors).toHaveLength(0)
    expect(result.deployResult.appliedChanges).toHaveLength(2)
  })
  describe('cascading options', () => {
    let contextInstance2: InstanceElement
    beforeEach(() => {
      const optionType = createEmptyType(FIELD_CONTEXT_OPTION_TYPE_NAME)
      connection.post.mockResolvedValueOnce({
        status: 200,
        data: {
          options: [
            {
              id: '4',
              value: 'p1',
            },
            {
              id: '5',
              value: 'p2',
            },
          ],
        },
      })
      connection.post.mockResolvedValueOnce({
        status: 200,
        data: {
          options: [
            {
              optionId: '4',
              id: '10',
              value: 'p1cas10',
            },
            {
              optionId: '5',
              id: '20',
              value: 'p2cas20',
            },
            {
              optionId: '4',
              id: '11',
              value: 'p1cas11',
            },
            {
              optionId: '5',
              id: '22',
              value: 'p2cas21',
            },
          ],
        },
      })
      const orderType = createEmptyType(OPTIONS_ORDER_TYPE_NAME)
      contextInstance2 = new InstanceElement(
        'context2',
        createEmptyType(FIELD_CONTEXT_TYPE_NAME),
        { id: '2context' },
        undefined,
        {
          [CORE_ANNOTATIONS.PARENT]: new ReferenceExpression(fieldInstance.elemID, fieldInstance),
        },
      )
      const orderInstance1 = new InstanceElement(
        'order1',
        orderType,
        {
          options: [
            new ReferenceExpression(getChangeData(changes[0]).elemID, _.cloneDeep(getChangeData(changes[0]))),
            new ReferenceExpression(getChangeData(changes[1]).elemID, _.cloneDeep(getChangeData(changes[1]))),
          ],
        },
        undefined,
        { [CORE_ANNOTATIONS.PARENT]: new ReferenceExpression(contextInstance.elemID, contextInstance) },
      )
      const orderInstance2 = new InstanceElement(
        'order2',
        orderType,
        {
          options: [
            new ReferenceExpression(getChangeData(changes[2]).elemID, _.cloneDeep(getChangeData(changes[2]))),
            new ReferenceExpression(getChangeData(changes[3]).elemID, _.cloneDeep(getChangeData(changes[3]))),
          ],
        },
        undefined,
        {
          [CORE_ANNOTATIONS.PARENT]: new ReferenceExpression(contextInstance2.elemID, contextInstance2),
        },
      )
      const cascadeInstance10 = new InstanceElement(
        'p1cas10',
        optionType,
        {
          value: 'p1cas10',
        },
        undefined,
        {
          [CORE_ANNOTATIONS.PARENT]: new ReferenceExpression(
            getChangeData(changes[0]).elemID,
            _.cloneDeep(getChangeData(changes[0])),
          ),
        },
      )
      const cascadeInstance11 = new InstanceElement(
        'p1cas11',
        optionType,
        {
          value: 'p1cas11',
        },
        undefined,
        {
          [CORE_ANNOTATIONS.PARENT]: new ReferenceExpression(
            getChangeData(changes[0]).elemID,
            _.cloneDeep(getChangeData(changes[0])),
          ),
        },
      )
      const cascadeInstance20 = new InstanceElement(
        'p2cas20',
        optionType,
        {
          value: 'p2cas20',
        },
        undefined,
        {
          [CORE_ANNOTATIONS.PARENT]: new ReferenceExpression(
            getChangeData(changes[1]).elemID,
            _.cloneDeep(getChangeData(changes[1])),
          ),
        },
      )
      const cascadeInstance21 = new InstanceElement(
        'p2cas21',
        optionType,
        {
          value: 'p2cas21',
        },
        undefined,
        {
          [CORE_ANNOTATIONS.PARENT]: new ReferenceExpression(
            getChangeData(changes[1]).elemID,
            _.cloneDeep(getChangeData(changes[1])),
          ),
        },
      )
      const cascadeOrderInstance1 = new InstanceElement(
        'cascadeOrder1',
        orderType,
        {
          options: [
            new ReferenceExpression(cascadeInstance10.elemID, _.cloneDeep(cascadeInstance10)),
            new ReferenceExpression(cascadeInstance11.elemID, _.cloneDeep(cascadeInstance11)),
          ],
        },
        undefined,
        {
          [CORE_ANNOTATIONS.PARENT]: new ReferenceExpression(addOption1.elemID, addOption1),
        },
      )
      const cascadeOrderInstance2 = new InstanceElement(
        'cascadeOrder2',
        orderType,
        {
          options: [
            new ReferenceExpression(cascadeInstance20.elemID, _.cloneDeep(cascadeInstance20)),
            new ReferenceExpression(cascadeInstance21.elemID, _.cloneDeep(cascadeInstance21)),
          ],
        },
        undefined,
        {
          [CORE_ANNOTATIONS.PARENT]: new ReferenceExpression(addOption2.elemID, addOption2),
        },
      )
      contextInstance2.value.defaultValue = {
        // done here as there are circular references
        optionId: new ReferenceExpression(addOption1.elemID, addOption1),
        cascadingOptionId: new ReferenceExpression(cascadeInstance20.elemID, cascadeInstance20),
      }
      elementsSource = buildElementsSourceFromElements([
        ...elements,
        orderInstance1,
        orderInstance2,
        cascadeInstance10,
        cascadeInstance11,
        cascadeInstance20,
        cascadeInstance21,
        cascadeOrderInstance1,
        cascadeOrderInstance2,
      ])
      filter = optionsDeploymentFilter(
        getFilterParams({
          client,
          paginator,
          config,
          elementsSource,
        }),
      ) as typeof filter
      changes = changes.concat([
        toChange({ after: orderInstance1 }),
        toChange({ after: orderInstance2 }),
        toChange({ after: cascadeInstance10 }),
        toChange({ after: cascadeInstance11 }),
        toChange({ after: cascadeInstance20 }),
        toChange({ after: cascadeInstance21 }),
        toChange({ after: cascadeOrderInstance1 }),
        toChange({ after: cascadeOrderInstance2 }),
      ])
    })
    it('should deploy cascading options', async () => {
      await filter.deploy(changes)
      expect(connection.post).toHaveBeenCalledTimes(2)
      expect(connection.post).toHaveBeenNthCalledWith(
        1,
        '/rest/api/3/field/1field/context/1context/option',
        {
          options: [{ value: 'p1' }, { value: 'p2' }],
        },
        undefined,
      )
      expect(connection.post).toHaveBeenNthCalledWith(
        2,
        '/rest/api/3/field/1field/context/1context/option',
        {
          options: [
            {
              optionId: '4',
              value: 'p1cas10',
            },
            {
              optionId: '4',
              value: 'p1cas11',
            },
            {
              optionId: '5',
              value: 'p2cas20',
            },
            {
              optionId: '5',
              value: 'p2cas21',
            },
          ],
        },
        undefined,
      )
    })
    it('should return a correct result', async () => {
      const result = await filter.deploy(changes)
      expect(result.leftoverChanges).toHaveLength(5)
      expect(result.deployResult.errors).toHaveLength(0)
      expect(result.deployResult.appliedChanges).toHaveLength(10)
    })
    it('should add id to additions', async () => {
      await filter.deploy(changes)
      expect(getChangeData(changes[0]).value.id).toEqual('4')
      expect(getChangeData(changes[1]).value.id).toEqual('5')
    })
    it('should not modify the option changes except for the id in additions', async () => {
      const optionChanges = changes.filter(
        change => getChangeData(change).elemID.typeName === FIELD_CONTEXT_OPTION_TYPE_NAME,
      )
      const originalOptionChanges = _.cloneDeep(optionChanges)
      await filter.deploy(changes)
      optionChanges.filter(isAdditionChange).forEach(change => {
        delete change.data.after.value.id
      })
      optionChanges.forEach((change, i) => {
        expect(change).toEqual(originalOptionChanges[i])
      })
    })
    it('should update the context default value with option ids', async () => {
      changes.push(toChange({ after: contextInstance2 }))
      await filter.deploy(changes)
      expect(contextInstance2.value.defaultValue.optionId.value.value.id).toEqual('4')
      expect(contextInstance2.value.defaultValue.cascadingOptionId.value.value.id).toEqual('20')
    })
  })
  it('should add cascading options ids when there are duplicate values', async () => {
    connection.post.mockResolvedValueOnce({
      status: 200,
      data: {
        options: [
          {
            id: '4',
            value: 'p1',
          },
          {
            id: '5',
            value: 'p2',
          },
        ],
      },
    })
    connection.post.mockResolvedValueOnce({
      status: 200,
      data: {
        options: [
          {
            id: '14',
            value: 'dup',
            optionId: '4',
          },
          {
            id: '15',
            value: 'dup',
            optionId: '5',
          },
        ],
      },
    })
    const cascadeInstance20 = new InstanceElement(
      'p2cas20',
      createEmptyType(FIELD_CONTEXT_OPTION_TYPE_NAME),
      {
        value: 'dup',
      },
      undefined,
      {
        [CORE_ANNOTATIONS.PARENT]: new ReferenceExpression(addOption1.elemID, addOption1),
      },
    )
    const cascadeInstance21 = new InstanceElement(
      'p2cas21',
      createEmptyType(FIELD_CONTEXT_OPTION_TYPE_NAME),
      {
        value: 'dup',
      },
      undefined,
      {
        [CORE_ANNOTATIONS.PARENT]: new ReferenceExpression(addOption2.elemID, addOption2),
      },
    )
    changes = [
      toChange({ after: cascadeInstance20 }),
      toChange({ after: cascadeInstance21 }),
      toChange({ after: addOption1 }),
      toChange({ after: addOption2 }),
    ]
    await filter.deploy(changes)
    expect(cascadeInstance20.value.id).toEqual('14')
    expect(cascadeInstance21.value.id).toEqual('15')
  })

  it('should call post with 1000 or less batches', async () => {
    const largeOptionsList = generateOptionInstances({ count: 1001, parent: contextInstance })
    connection.post.mockImplementation(async (_no, data) => {
      const { options } = data as { options: unknown[] }
      if (options.length > 1000) {
        throw Error('bad')
      }
      return {
        data: {
          options: [
            {
              id: '4',
              value: 'auto1',
            },
          ],
        },
        status: 200,
      }
    })
    await filter.deploy(largeOptionsList.map(instance => toChange({ after: instance })))
    expect(connection.post).toHaveBeenCalledTimes(2)
    expect(connection.post).toHaveBeenNthCalledWith(
      2,
      '/rest/api/3/field/1field/context/1context/option',
      {
        options: [
          expect.objectContaining({
            value: 'auto1000',
          }),
        ],
      },
      undefined,
    )
  })
  it('should prevent deployment of default values if options deployment fails', async () => {
    connection.post.mockRejectedValueOnce(new Error('error'))
    contextInstance.value.defaultValue = {
      optionId: new ReferenceExpression(addOption1.elemID, addOption1),
    }
    const result = await filter.deploy([toChange({ after: contextInstance }), toChange({ after: addOption1 })])
    expect(result.leftoverChanges).toHaveLength(0)
    expect(result.deployResult.errors).toHaveLength(2)
    expect(result.deployResult.appliedChanges).toHaveLength(0)
    expect(result.deployResult.errors[1]).toEqual({
      elemID: contextInstance.elemID,
      message: 'Could not deploy default value',
      detailedMessage: `The context field will be deployed without the default value, as the default value depends on a field context option ${addOption1.elemID.getFullName()} that could not be deployed.`,
      severity: 'Error',
    })
  })
  describe('more than 10K', () => {
    describe('setContextOptions', () => {
      describe('change has over 10K options', () => {
        // Set long timeout as we create instance with more than 10K options
        jest.setTimeout(1000 * 60 * 1)
        const tenKContext = new InstanceElement(
          'context10k',
          createEmptyType(FIELD_CONTEXT_TYPE_NAME),
          { id: '1context10K' },
          undefined,
          {
            [CORE_ANNOTATIONS.PARENT]: new ReferenceExpression(fieldInstance.elemID, fieldInstance),
          },
        )
        const tenKOptions = generateOptionInstances({ count: 10010, parent: tenKContext, addId: true })
        const order10k = new InstanceElement(
          'order10k',
          createEmptyType(OPTIONS_ORDER_TYPE_NAME),
          {
            options: tenKOptions.map(option => new ReferenceExpression(option.elemID, option)),
          },
          undefined,
          {
            [CORE_ANNOTATIONS.PARENT]: new ReferenceExpression(tenKContext.elemID, tenKContext),
          },
        )

        beforeEach(async () => {
          elementsSource = buildElementsSourceFromElements([order10k, tenKContext, ...tenKOptions])
          filter = optionsDeploymentFilter(
            getFilterParams({
              client,
              paginator,
              config,
              elementsSource,
            }),
          ) as typeof filter
          connection.post.mockImplementation(async (url, data) => {
            if (url === '/secure/admin/EditCustomFieldOptions!add.jspa') {
              return {
                data: {},
                status: 200,
              }
            }

            const { options } = data as { options: unknown[] }
            if (options.length > 1000) {
              throw Error('bad')
            }
            return {
              data: {
                options: [],
              },
              status: 200,
            }
          })
          connection.get.mockResolvedValueOnce({
            status: 200,
            data: {
              startAt: 0,
              total: 1,
              values: [
                {
                  id: '10010000',
                  value: 'auto10000',
                  disabled: false,
                },
              ],
            },
          })
          connection.get.mockResolvedValueOnce({
            status: 200,
            data: {
              startAt: 0,
              total: 1,
              values: [
                {
                  id: '10010000',
                  value: 'auto10000',
                  disabled: false,
                },
                {
                  id: '1001000011',
                  value: 'c11',
                  disabled: false,
                  optionId: '10010000',
                },
              ],
            },
          })
        })
        it('should use public API for first 10K options, and than use private API for all other options.', async () => {
          const optionsAfter = tenKOptions
          await filter.deploy(optionsAfter.map(instance => toChange({ after: instance })))
          expect(connection.post).toHaveBeenCalledTimes(20)
          expect(connection.post).toHaveBeenNthCalledWith(
            11,
            '/secure/admin/EditCustomFieldOptions!add.jspa',
            new URLSearchParams({ addValue: 'auto10000', fieldConfigId: '1context10K' }),
            {
              headers: JSP_API_HEADERS,
              params: undefined,
              responseType: undefined,
            },
          )
        })
        it('should use only private API if all added options are over 10K', async () => {
          tenKOptions[10].value = {
            value: 'auto10010',
            position: 10010,
          }
          changes = tenKOptions.map(instance => toChange({ before: instance, after: instance }))
          changes[10] = toChange({ after: tenKOptions[10] })
          await filter.deploy(changes)
          expect(connection.post).toHaveBeenCalledTimes(1)
          expect(connection.post).toHaveBeenNthCalledWith(
            1,
            '/secure/admin/EditCustomFieldOptions!add.jspa',
            new URLSearchParams({ addValue: 'auto10010', fieldConfigId: '1context10K' }),
            {
              headers: JSP_API_HEADERS,
              params: undefined,
              responseType: undefined,
            },
          )
        })
        it('should add cascading options through private API', async () => {
          tenKOptions[1].value.id = '10001'
          tenKOptions[0] = new InstanceElement(
            'cascadeOption',
            createEmptyType(FIELD_CONTEXT_OPTION_TYPE_NAME),
            {
              value: 'c11',
            },
            undefined,
            {
              [CORE_ANNOTATIONS.PARENT]: new ReferenceExpression(tenKOptions[1].elemID, tenKOptions[1]),
            },
          )
          changes = tenKOptions.map(instance => toChange({ before: instance, after: instance }))
          changes[0] = toChange({ after: tenKOptions[0] })
          await filter.deploy(changes)
          expect(connection.post).toHaveBeenCalledTimes(1)
          expect(connection.post).toHaveBeenCalledWith(
            '/secure/admin/EditCustomFieldOptions!add.jspa',
            new URLSearchParams({
              addValue: 'c11',
              fieldConfigId: '1context10K',
              selectedParentOptionId: '10001',
            }),
            {
              headers: JSP_API_HEADERS,
              params: undefined,
              responseType: undefined,
            },
          )
        })
        it('should issue proper error when paginator is undefined', async () => {
          filter = optionsDeploymentFilter(
            getFilterParams({
              client,
              paginator: undefined,
              config,
              elementsSource,
            }),
          ) as typeof filter
          await filter.deploy(tenKOptions.map(instance => toChange({ after: instance })))
          expect(connection.post).toHaveBeenCalledTimes(10)
        })
      })
    })
  })
})
