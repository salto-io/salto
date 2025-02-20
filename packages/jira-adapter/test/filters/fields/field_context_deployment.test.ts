/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  BuiltinTypes,
  Change,
  CORE_ANNOTATIONS,
  ElemID,
  getChangeData,
  InstanceElement,
  ListType,
  MapType,
  ObjectType,
  ReferenceExpression,
  toChange,
} from '@salto-io/adapter-api'
import { filterUtils, client as clientUtils } from '@salto-io/adapter-components'
import { getParent } from '@salto-io/adapter-utils'
import _, { every } from 'lodash'
import { createEmptyType, getFilterParams, mockClient } from '../../utils'
import { getDefaultConfig } from '../../../src/config/config'
import { JIRA } from '../../../src/constants'
import contextDeploymentFilter from '../../../src/filters/fields/context_deployment_filter'
import JiraClient from '../../../src/client/client'
import * as contexts from '../../../src/filters/fields/contexts'
import {
  FIELD_CONTEXT_OPTION_TYPE_NAME,
  FIELD_CONTEXT_TYPE_NAME,
  OPTIONS_ORDER_TYPE_NAME,
} from '../../../src/filters/fields/constants'

describe('fieldContextDeployment', () => {
  let filter: filterUtils.FilterWith<'onFetch' | 'deploy'>
  let fieldType: ObjectType
  let contextType: ObjectType
  let optionType: ObjectType
  let defaultValueType: ObjectType
  let userFilterType: ObjectType

  let client: JiraClient
  let paginator: clientUtils.Paginator
  const deployContextChangeMock = jest.spyOn(contexts, 'deployContextChange')

  beforeEach(() => {
    deployContextChangeMock.mockClear()

    const mockCli = mockClient()
    client = mockCli.client
    paginator = mockCli.paginator

    filter = contextDeploymentFilter(
      getFilterParams({
        client,
        paginator,
      }),
    ) as typeof filter

    optionType = new ObjectType({
      elemID: new ElemID(JIRA, 'CustomFieldContextOption'),
      fields: {
        value: { refType: BuiltinTypes.STRING },
        optionId: { refType: BuiltinTypes.STRING },
        disabled: { refType: BuiltinTypes.STRING },
        position: { refType: BuiltinTypes.NUMBER },
      },
    })

    userFilterType = new ObjectType({
      elemID: new ElemID(JIRA, 'UserFilter'),
      fields: {
        groups: { refType: BuiltinTypes.STRING },
      },
    })

    defaultValueType = new ObjectType({
      elemID: new ElemID(JIRA, 'CustomFieldContextDefaultValue'),
      fields: {
        type: { refType: BuiltinTypes.STRING },
        userFilter: { refType: userFilterType },
      },
    })

    contextType = new ObjectType({
      elemID: new ElemID(JIRA, FIELD_CONTEXT_TYPE_NAME),
      fields: {
        options: { refType: new MapType(optionType) },
        defaultValue: { refType: defaultValueType },
        projectIds: { refType: new ListType(BuiltinTypes.STRING) },
        issueTypeIds: { refType: new ListType(BuiltinTypes.STRING) },
      },
    })

    fieldType = new ObjectType({
      elemID: new ElemID(JIRA, 'Field'),
      fields: {
        contexts: { refType: new ListType(contextType) },
      },
    })
  })

  describe('onFetch', () => {
    it('should add deployment annotations to context type', async () => {
      await filter.onFetch([fieldType, contextType])

      expect(fieldType.fields.contexts.annotations).toEqual({
        [CORE_ANNOTATIONS.CREATABLE]: true,
        [CORE_ANNOTATIONS.UPDATABLE]: true,
      })

      expect(contextType.fields.issueTypeIds.annotations).toEqual({
        [CORE_ANNOTATIONS.CREATABLE]: true,
        [CORE_ANNOTATIONS.UPDATABLE]: true,
      })

      expect(contextType.fields.options.annotations).toEqual({
        [CORE_ANNOTATIONS.CREATABLE]: true,
        [CORE_ANNOTATIONS.UPDATABLE]: true,
      })

      expect(optionType.fields.value.annotations).toEqual({
        [CORE_ANNOTATIONS.CREATABLE]: true,
        [CORE_ANNOTATIONS.UPDATABLE]: true,
      })

      expect(optionType.fields.optionId.annotations).toEqual({
        [CORE_ANNOTATIONS.CREATABLE]: true,
        [CORE_ANNOTATIONS.UPDATABLE]: true,
      })

      expect(optionType.fields.disabled.annotations).toEqual({
        [CORE_ANNOTATIONS.CREATABLE]: true,
        [CORE_ANNOTATIONS.UPDATABLE]: true,
      })

      expect(optionType.fields.position.annotations).toEqual({
        [CORE_ANNOTATIONS.CREATABLE]: true,
        [CORE_ANNOTATIONS.UPDATABLE]: true,
      })

      expect(contextType.fields.defaultValue.annotations).toEqual({
        [CORE_ANNOTATIONS.CREATABLE]: true,
        [CORE_ANNOTATIONS.UPDATABLE]: true,
      })

      expect(defaultValueType.fields.type.annotations).toEqual({
        [CORE_ANNOTATIONS.CREATABLE]: true,
        [CORE_ANNOTATIONS.UPDATABLE]: true,
      })

      expect(userFilterType.fields.groups.annotations).toEqual({
        [CORE_ANNOTATIONS.CREATABLE]: true,
        [CORE_ANNOTATIONS.UPDATABLE]: true,
      })
    })
  })
  describe('Deploy', () => {
    it('should call deployContextChange on addition', async () => {
      const instance = new InstanceElement('instance', contextType, {})
      const change = toChange({ after: instance })
      await filter.deploy([change])
      expect(deployContextChangeMock).toHaveBeenCalledWith(
        expect.objectContaining({
          change,
          client,
          config: getDefaultConfig({ isDataCenter: false }),
          paginator,
        }),
      )
    })
    it('should call deployContextChange on modification', async () => {
      const instance = new InstanceElement('instance', contextType, {})
      const change = toChange({ after: instance, before: instance })
      await filter.deploy([change])
      expect(deployContextChangeMock).toHaveBeenCalledWith(
        expect.objectContaining({
          change,
          client,
          config: getDefaultConfig({ isDataCenter: false }),
          paginator,
        }),
      )
    })
    it('should call deployContextChange on removal', async () => {
      fieldType = new ObjectType({
        elemID: new ElemID(JIRA, 'Field'),
        fields: {
          contexts: { refType: new ListType(contextType) },
        },
      })
      const fieldInstance = new InstanceElement('field', fieldType, {})
      const instance = new InstanceElement('instance', contextType, {}, undefined, {
        [CORE_ANNOTATIONS.PARENT]: new ReferenceExpression(fieldInstance.elemID, fieldInstance),
      })
      const change = toChange({ before: instance })
      await filter.deploy([change])
      expect(deployContextChangeMock).toHaveBeenCalledWith(
        expect.objectContaining({
          change,
          client,
          config: getDefaultConfig({ isDataCenter: false }),
          paginator,
        }),
      )
    })
    it('should not call deployContextChange on removal without parent', async () => {
      const instance = new InstanceElement('instance', contextType, {})
      const change = toChange({ before: instance })
      await filter.deploy([change])
      expect(deployContextChangeMock).not.toHaveBeenCalled()
    })
  })
  describe('Deploy with splitFieldContextOptions', () => {
    let changes: Change<InstanceElement>[]
    let orderInstance: InstanceElement
    let optionInstance: InstanceElement
    let cascadeInstance: InstanceElement
    let contextInstance: InstanceElement
    beforeEach(() => {
      const config = getDefaultConfig({ isDataCenter: false })
      config.fetch.splitFieldContextOptions = true
      filter = contextDeploymentFilter(
        getFilterParams({
          client,
          paginator,
          config,
        }),
      ) as typeof filter
      contextInstance = new InstanceElement('context', contextType, {})
      orderInstance = new InstanceElement('order', createEmptyType(OPTIONS_ORDER_TYPE_NAME), {}, undefined, {
        [CORE_ANNOTATIONS.PARENT]: new ReferenceExpression(contextInstance.elemID, _.cloneDeep(contextInstance)),
      })
      optionInstance = new InstanceElement('option', optionType, {}, undefined, {
        [CORE_ANNOTATIONS.PARENT]: new ReferenceExpression(contextInstance.elemID, _.cloneDeep(contextInstance)),
      })
      cascadeInstance = new InstanceElement('cascade', optionType, {}, undefined, {
        [CORE_ANNOTATIONS.PARENT]: new ReferenceExpression(optionInstance.elemID, _.cloneDeep(optionInstance)),
      })
      const randomInstance = new InstanceElement('random', fieldType, {})
      changes = [
        toChange({ after: contextInstance }),
        toChange({ after: orderInstance }),
        toChange({ after: randomInstance }),
        toChange({ after: optionInstance }),
        toChange({ after: cascadeInstance }),
      ]
      // mock deployContextChange
      deployContextChangeMock.mockImplementation(async ({ change }) => {
        getChangeData(change).value.id = `newId${getChangeData(change).elemID.name}`
      })
    })
    it('should update the ids of added contexts', async () => {
      await filter.deploy(changes)
      expect(getParent(optionInstance).value.id).toEqual('newIdcontext')
      expect(getParent(cascadeInstance).value.id).toBeUndefined()
      expect(getParent(getParent(cascadeInstance)).value.id).toEqual('newIdcontext')
    })
    it('should keep context changes in leftoverChanges', async () => {
      const { leftoverChanges } = await filter.deploy(changes)
      expect(leftoverChanges).toHaveLength(changes.length)
    })
    it('should mark options of deleted contexts as applied', async () => {
      const secondOptionInstance = new InstanceElement('option2', optionType, {}, undefined, {
        [CORE_ANNOTATIONS.PARENT]: new ReferenceExpression(contextInstance.elemID, _.cloneDeep(contextInstance)),
      })
      const secondCascadeInstance = new InstanceElement('cascade2', optionType, {}, undefined, {
        [CORE_ANNOTATIONS.PARENT]: new ReferenceExpression(
          secondOptionInstance.elemID,
          _.cloneDeep(secondOptionInstance),
        ),
      })
      const thirdCascadeInstance = new InstanceElement('cascade3', optionType, {}, undefined, {
        [CORE_ANNOTATIONS.PARENT]: new ReferenceExpression(
          secondOptionInstance.elemID,
          _.cloneDeep(secondOptionInstance),
        ),
      })
      const thirdOptionInstance = new InstanceElement('option3', optionType, {}, undefined, {
        [CORE_ANNOTATIONS.PARENT]: new ReferenceExpression(contextInstance.elemID, _.cloneDeep(contextInstance)),
      })

      changes = [
        toChange({ before: optionInstance }),
        toChange({ before: cascadeInstance }),
        toChange({ before: contextInstance }),
        toChange({ before: secondOptionInstance }),
        toChange({ before: secondCascadeInstance }),
        toChange({ before: thirdOptionInstance }),
        toChange({ before: thirdCascadeInstance }),
      ]
      const { deployResult, leftoverChanges } = await filter.deploy(changes)
      expect(deployResult.appliedChanges).toHaveLength(changes.length - 1)
      expect(
        every(
          deployResult.appliedChanges,
          change => getChangeData(change).elemID.typeName === FIELD_CONTEXT_OPTION_TYPE_NAME,
        ),
      ).toBeTruthy()
      expect(leftoverChanges).toHaveLength(1)
      expect(getChangeData(leftoverChanges[0]).elemID.typeName).toEqual(FIELD_CONTEXT_TYPE_NAME)
    })
    it('should not mark removal options as applied if parent is not deleted', async () => {
      const afterContext = contextInstance.clone()
      afterContext.value.description = 'newIdcontext'
      changes = [toChange({ before: optionInstance }), toChange({ before: contextInstance, after: afterContext })]
      const { deployResult, leftoverChanges } = await filter.deploy(changes)
      expect(deployResult.appliedChanges).toHaveLength(0)
      expect(leftoverChanges).toHaveLength(2)
      expect(
        leftoverChanges.find(change => getChangeData(change).elemID.typeName === FIELD_CONTEXT_OPTION_TYPE_NAME),
      ).toBeDefined()
    })

    describe('with failed addition context deployment', () => {
      let optionInstance2: InstanceElement
      let unrelatedOptionInstance: InstanceElement
      let cascadeInstance2: InstanceElement
      let unrelatedCascadeInstance: InstanceElement
      let unrelatedContextInstance: InstanceElement

      const optionErrorMessage = (context: InstanceElement): string =>
        `Element was not deployed, as it depends on ${context.elemID.getFullName()} which failed to deploy`

      beforeEach(() => {
        unrelatedContextInstance = new InstanceElement('unrelatedContext', contextType, {})
        optionInstance2 = new InstanceElement('option2', optionType, {}, undefined, {
          [CORE_ANNOTATIONS.PARENT]: new ReferenceExpression(contextInstance.elemID, _.cloneDeep(contextInstance)),
        })
        cascadeInstance2 = new InstanceElement('cascade2', optionType, {}, undefined, {
          [CORE_ANNOTATIONS.PARENT]: new ReferenceExpression(optionInstance2.elemID, _.cloneDeep(optionInstance2)),
        })
        unrelatedOptionInstance = new InstanceElement('unrelatedOption', optionType, {}, undefined, {
          [CORE_ANNOTATIONS.PARENT]: new ReferenceExpression(
            unrelatedContextInstance.elemID,
            _.cloneDeep(unrelatedContextInstance),
          ),
        })
        unrelatedCascadeInstance = new InstanceElement('unrelatedCascade', optionType, {}, undefined, {
          [CORE_ANNOTATIONS.PARENT]: new ReferenceExpression(
            unrelatedOptionInstance.elemID,
            _.cloneDeep(unrelatedOptionInstance),
          ),
        })
        changes = [
          toChange({ after: contextInstance }),
          toChange({ after: optionInstance }),
          toChange({ after: cascadeInstance }),
          toChange({ after: optionInstance2 }),
          toChange({ after: cascadeInstance2 }),
          toChange({ after: unrelatedContextInstance }),
          toChange({ after: unrelatedOptionInstance }),
          toChange({ after: unrelatedCascadeInstance }),
        ]

        deployContextChangeMock.mockImplementationOnce(() => {
          throw new Error('failed to deploy context')
        })
      })
      it('should mark options of failed context as failed', async () => {
        const { deployResult } = await filter.deploy(changes)
        expect(deployResult.errors).toHaveLength(5)
        expect(deployResult.errors[0]).toEqual({
          elemID: contextInstance.elemID,
          severity: 'Error',
          message: 'Error: failed to deploy context',
          detailedMessage: 'Error: failed to deploy context',
        })
        expect(deployResult.errors[1]).toEqual({
          elemID: optionInstance.elemID,
          severity: 'Error',
          message: optionErrorMessage(contextInstance),
          detailedMessage: optionErrorMessage(contextInstance),
        })
        expect(deployResult.errors[2]).toEqual({
          elemID: cascadeInstance.elemID,
          severity: 'Error',
          message: optionErrorMessage(contextInstance),
          detailedMessage: optionErrorMessage(contextInstance),
        })
        expect(deployResult.errors[3]).toEqual({
          elemID: optionInstance2.elemID,
          severity: 'Error',
          message: optionErrorMessage(contextInstance),
          detailedMessage: optionErrorMessage(contextInstance),
        })
        expect(deployResult.errors[4]).toEqual({
          elemID: cascadeInstance2.elemID,
          severity: 'Error',
          message: optionErrorMessage(contextInstance),
          detailedMessage: optionErrorMessage(contextInstance),
        })
      })

      it('should remove the options from the leftover changes', async () => {
        const relatedOptionNames = [
          optionInstance.elemID.getFullName(),
          cascadeInstance.elemID.getFullName(),
          optionInstance2.elemID.getFullName(),
          cascadeInstance2.elemID.getFullName(),
        ]

        const { leftoverChanges } = await filter.deploy(changes)
        expect(leftoverChanges).toHaveLength(3)
        const leftoverChangesNames = leftoverChanges.map(change => getChangeData(change).elemID.getFullName())
        expect(relatedOptionNames.every(optionName => !leftoverChangesNames.includes(optionName))).toBeTruthy()
      })

      it('should not mark options of unrelated context as failed', async () => {
        const { leftoverChanges } = await filter.deploy(changes)
        expect(leftoverChanges).toHaveLength(3)
        expect(leftoverChanges.map(change => getChangeData(change).elemID.getFullName())).toEqual([
          unrelatedOptionInstance.elemID.getFullName(),
          unrelatedCascadeInstance.elemID.getFullName(),
          unrelatedContextInstance.elemID.getFullName(),
        ])
      })
      it('should not mark options as failed if the context change is not addition', async () => {
        changes[0] = toChange({ before: contextInstance, after: contextInstance })
        const { deployResult, leftoverChanges } = await filter.deploy(changes)
        expect(deployResult.errors).toHaveLength(1)
        expect(deployResult.errors[0]).toEqual({
          elemID: contextInstance.elemID,
          severity: 'Error',
          message: 'Error: failed to deploy context',
          detailedMessage: 'Error: failed to deploy context',
        })
        expect(leftoverChanges).toHaveLength(7)
      })
    })
  })
})
