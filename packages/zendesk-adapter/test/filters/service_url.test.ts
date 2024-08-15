/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/
import { ObjectType, ElemID, InstanceElement, CORE_ANNOTATIONS, toChange, getChangeData } from '@salto-io/adapter-api'
import { filterUtils } from '@salto-io/adapter-components'
import { ZENDESK } from '../../src/constants'
import filterCreator from '../../src/filters/service_url'
import { createFilterCreatorParams } from '../utils'

describe('service url filter', () => {
  type FilterType = filterUtils.FilterWith<'onFetch' | 'onDeploy'>
  let filter: FilterType
  const roleObjType = new ObjectType({ elemID: new ElemID(ZENDESK, 'custom_role') })
  const roleInst = new InstanceElement('role', roleObjType, { id: 11, name: 'role' })
  const testObjType = new ObjectType({ elemID: new ElemID(ZENDESK, 'test') })
  const testInst = new InstanceElement('test', testObjType, { id: 11, name: 'test' })

  beforeEach(async () => {
    jest.clearAllMocks()
    filter = filterCreator(createFilterCreatorParams({})) as FilterType
  })

  describe('onFetch', () => {
    it('should add service url annotation if it is exist in the config', async () => {
      const elements = [roleInst].map(e => e.clone())
      await filter.onFetch(elements)
      expect(elements.map(e => e.elemID.getFullName()).sort()).toEqual(['zendesk.custom_role.instance.role'])
      const [instance] = elements
      expect(instance.annotations).toEqual({
        [CORE_ANNOTATIONS.SERVICE_URL]: 'https://ignore.zendesk.com/admin/people/team/roles/11',
      })
    })
    it('should not add service url annotation if it is not exist in the config', async () => {
      const elements = [testInst].map(e => e.clone())
      await filter.onFetch(elements)
      expect(elements.map(e => e.elemID.getFullName()).sort()).toEqual(['zendesk.test.instance.test'])
      const [instance] = elements
      expect(instance.annotations).toEqual({})
    })
  })
  describe('onDeploy', () => {
    it('should add service url annotation if it is exist in the config', async () => {
      const changes = [roleInst].map(e => e.clone()).map(inst => toChange({ after: inst }))
      await filter.onDeploy(changes)
      expect(
        changes
          .map(getChangeData)
          .map(e => e.elemID.getFullName())
          .sort(),
      ).toEqual(['zendesk.custom_role.instance.role'])
      const instance = getChangeData(changes[0])
      expect(instance.annotations).toEqual({
        [CORE_ANNOTATIONS.SERVICE_URL]: 'https://ignore.zendesk.com/admin/people/team/roles/11',
      })
    })
    it('should not add service url annotation if it is not exist in the config', async () => {
      const changes = [testInst].map(e => e.clone()).map(inst => toChange({ after: inst }))
      await filter.onDeploy(changes)
      expect(
        changes
          .map(getChangeData)
          .map(e => e.elemID.getFullName())
          .sort(),
      ).toEqual(['zendesk.test.instance.test'])
      const instance = getChangeData(changes[0])
      expect(instance.annotations).toEqual({})
    })
  })
})
