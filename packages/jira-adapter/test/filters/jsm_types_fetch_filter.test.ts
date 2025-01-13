/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { filterUtils } from '@salto-io/adapter-components'
import _ from 'lodash'
import {
  InstanceElement,
  ReferenceExpression,
  Element,
  CORE_ANNOTATIONS,
  ObjectType,
  ElemID,
  BuiltinTypes,
} from '@salto-io/adapter-api'
import { getDefaultConfig } from '../../src/config/config'
import jsmTypesFetchFilter from '../../src/filters/jsm_types_fetch_filter'
import { createEmptyType, getFilterParams } from '../utils'
import {
  CUSTOMER_PERMISSIONS_TYPE,
  JIRA,
  PROJECT_TYPE,
  SLA_CONDITIONS_PAUSE_TYPE,
  SLA_CONDITIONS_START_TYPE,
  SLA_CONDITIONS_STOP_TYPE,
} from '../../src/constants'

const mockDeployChange = jest.fn()
jest.mock('@salto-io/adapter-components', () => {
  const actual = jest.requireActual('@salto-io/adapter-components')
  return {
    ...actual,
    deployment: {
      ...actual.deployment,
      deployChange: jest.fn((...args) => mockDeployChange(...args)),
    },
  }
})

const createSlaType = (typeName: string): ObjectType =>
  new ObjectType({
    elemID: new ElemID(JIRA, typeName),
    fields: {
      conditionId: {
        refType: BuiltinTypes.STRING,
      },
      name: {
        refType: BuiltinTypes.STRING,
        annotations: { [CORE_ANNOTATIONS.CREATABLE]: true, [CORE_ANNOTATIONS.UPDATABLE]: true },
      },
    },
  })

describe('jsmTypesFetchFilter', () => {
  type FilterType = filterUtils.FilterWith<'onFetch'>
  let filter: FilterType
  let elements: Element[]
  const projectType = createEmptyType(PROJECT_TYPE)
  let projectInstance: InstanceElement
  const customerPermissionsType = createEmptyType(CUSTOMER_PERMISSIONS_TYPE)
  let customerPermissionsInstance: InstanceElement
  const slaTypeNames = [SLA_CONDITIONS_STOP_TYPE, SLA_CONDITIONS_START_TYPE, SLA_CONDITIONS_PAUSE_TYPE]

  beforeEach(() => {
    const config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
    config.fetch.enableJSM = true
    filter = jsmTypesFetchFilter(getFilterParams({ config })) as typeof filter
    projectInstance = new InstanceElement('project1', projectType, {
      id: 11111,
      name: 'project1',
      projectTypeKey: 'service_desk',
    })
  })
  describe('on fetch', () => {
    beforeEach(async () => {
      customerPermissionsInstance = new InstanceElement('customerPermissions1', customerPermissionsType, {
        id: 11111,
        projectKey: new ReferenceExpression(projectInstance.elemID, projectInstance),
        manageEnabled: false,
        autocompleteEnabled: false,
        serviceDeskOpenAccess: true,
      })
      elements = [projectType, projectInstance, customerPermissionsType, customerPermissionsInstance]
    })
    it('should add project as parent and remove projectKey from customerPermissions', async () => {
      await filter.onFetch(elements)
      expect(customerPermissionsInstance.annotations[CORE_ANNOTATIONS.PARENT]).toEqual([
        new ReferenceExpression(projectInstance.elemID, projectInstance),
      ])
      expect(customerPermissionsInstance.value.projectKey).toBeUndefined()
    })
    it('should add deploy annotations to customer permissions type', async () => {
      await filter.onFetch(elements)
      expect(customerPermissionsType.annotations[CORE_ANNOTATIONS.CREATABLE]).toBe(true)
      expect(customerPermissionsType.annotations[CORE_ANNOTATIONS.UPDATABLE]).toBe(true)
      expect(customerPermissionsType.annotations[CORE_ANNOTATIONS.DELETABLE]).toBe(true)
    })
    it('should do nothing if enableJSM is false', async () => {
      const config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
      config.fetch.enableJSM = false
      filter = jsmTypesFetchFilter(getFilterParams({ config })) as typeof filter
      await filter.onFetch(elements)
      expect(customerPermissionsInstance.annotations[CORE_ANNOTATIONS.PARENT]).toBeUndefined()
      expect(customerPermissionsInstance.value.projectKey).toEqual(
        new ReferenceExpression(projectInstance.elemID, projectInstance),
      )
    })
    it('should change the deployment annotations of icon field in object type icon', async () => {
      const objectTypeIconType = new ObjectType({
        elemID: new ElemID(JIRA, 'ObjectTypeIcon'),
        fields: {
          icon: {
            refType: BuiltinTypes.STRING,
            annotations: { [CORE_ANNOTATIONS.UPDATABLE]: true },
          },
        },
      })
      elements.push(objectTypeIconType)
      await filter.onFetch(elements)
      expect(objectTypeIconType.fields.icon.annotations[CORE_ANNOTATIONS.UPDATABLE]).toBe(false)
    })
    it('should change conditionId refType to unknown in SLA types', async () => {
      const slaTypes = slaTypeNames.map(createSlaType)
      elements.push(...slaTypes)
      await filter.onFetch(elements)
      expect(slaTypes[0].fields.conditionId.refType.elemID.name).toEqual(BuiltinTypes.UNKNOWN.elemID.name)
      expect(slaTypes[1].fields.conditionId.refType.elemID.name).toEqual(BuiltinTypes.UNKNOWN.elemID.name)
      expect(slaTypes[2].fields.conditionId.refType.elemID.name).toEqual(BuiltinTypes.UNKNOWN.elemID.name)
    })
    it('should change field type also when not all sla types are present', async () => {
      const partialSlaTypes = slaTypeNames.slice(0, 2)
      const slaTypes = partialSlaTypes.map(createSlaType)
      elements.push(...slaTypes)
      await filter.onFetch(elements)
      expect(slaTypes[0].fields.conditionId.refType.elemID.name).toEqual(BuiltinTypes.UNKNOWN.elemID.name)
      expect(slaTypes[1].fields.conditionId.refType.elemID.name).toEqual(BuiltinTypes.UNKNOWN.elemID.name)
    })
    it('should not change the conditionId refType in SLA types if conditionId field does not exist', async () => {
      const slaTypes = slaTypeNames.map(createSlaType)
      slaTypes.forEach(slaType => delete slaType.fields.conditionId)
      elements.push(...slaTypes)
      await filter.onFetch(elements)
      slaTypes.forEach(slaType => {
        expect(slaType.fields.conditionId).toBeUndefined()
      })
    })
    it('should change the deployment annotations of name field in SLA types', async () => {
      const slaTypes = slaTypeNames.map(createSlaType)
      elements.push(...slaTypes)
      await filter.onFetch(elements)
      slaTypes.forEach(slaType => {
        expect(slaType.fields.name.annotations[CORE_ANNOTATIONS.CREATABLE]).toBe(false)
        expect(slaType.fields.name.annotations[CORE_ANNOTATIONS.UPDATABLE]).toBe(false)
      })
    })
    it('should not change the deployment annotations of name field in SLA types if name field does not exist', async () => {
      const slaTypes = slaTypeNames.map(createSlaType)
      slaTypes.forEach(slaType => delete slaType.fields.name)
      elements.push(...slaTypes)
      await filter.onFetch(elements)
      slaTypes.forEach(slaType => {
        expect(slaType.fields.name).toBeUndefined()
      })
    })
  })
})
