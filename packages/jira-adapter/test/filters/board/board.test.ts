/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { BuiltinTypes, CORE_ANNOTATIONS, ElemID, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import { filterUtils } from '@salto-io/adapter-components'
import { JIRA } from '../../../src/constants'
import boardFilter from '../../../src/filters/board/board'
import { getFilterParams } from '../../utils'

describe('boardFilter', () => {
  let filter: filterUtils.FilterWith<'onFetch' | 'preDeploy' | 'onDeploy'>
  let instance: InstanceElement
  let type: ObjectType
  beforeEach(async () => {
    filter = boardFilter(getFilterParams()) as typeof filter

    type = new ObjectType({ elemID: new ElemID(JIRA, 'Board') })

    instance = new InstanceElement('instance', type, {
      config: {
        filter: {
          id: '1',
        },
      },
    })
  })

  describe('onFetch', () => {
    it('should add filterId', async () => {
      await filter.onFetch([instance])
      expect(instance.value).toEqual({
        config: {},
        filterId: '1',
      })
    })

    it('should deployment annotation to projectId', async () => {
      const boardLocationType = new ObjectType({
        elemID: new ElemID(JIRA, 'Board_location'),
        fields: {
          projectId: {
            refType: BuiltinTypes.NUMBER,
          },
        },
      })

      await filter.onFetch([boardLocationType])
      expect(boardLocationType.fields.projectId.annotations).toEqual({
        [CORE_ANNOTATIONS.CREATABLE]: true,
      })
    })

    it('should add nothing for partial instance', async () => {
      instance.value = {}
      await filter.onFetch([instance])
      expect(instance.value).toEqual({})
    })
  })

  describe('preDeploy', () => {
    beforeEach(async () => {
      instance.value.location = { projectId: 1 }
      const change = toChange({ after: instance })
      await filter?.preDeploy([change])
    })

    it('should add location type', async () => {
      expect(instance.value.location.type).toEqual('project')
    })

    it('should rename projectId to projectKeyOrId', async () => {
      expect(instance.value.location.projectKeyOrId).toEqual(1)
      expect(instance.value.location.projectId).toBeUndefined()
    })

    it('should do nothing if instance does not have location', async () => {
      delete instance.value.location
      const instanceBefore = instance.clone()

      const change = toChange({ after: instance })
      await filter?.preDeploy([change])

      expect(instanceBefore.value).toEqual(instance.value)
    })
  })

  describe('onDeploy', () => {
    beforeEach(async () => {
      instance.value.location = { projectKeyOrId: 1, type: 'project' }
      const change = toChange({ after: instance })
      await filter?.onDeploy([change])
    })

    it('should remove location type', async () => {
      expect(instance.value.location.type).toBeUndefined()
    })

    it('should rename projectKeyOrId back to projectId', async () => {
      expect(instance.value.location.projectId).toEqual(1)
      expect(instance.value.location.projectKeyOrId).toBeUndefined()
    })

    it('should do nothing if instance does not have location', async () => {
      delete instance.value.location
      const instanceBefore = instance.clone()

      const change = toChange({ after: instance })
      await filter?.onDeploy([change])

      expect(instanceBefore.value).toEqual(instance.value)
    })
  })
})
