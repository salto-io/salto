/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { InstanceElement, ReferenceExpression } from '@salto-io/adapter-api'
import { filterUtils } from '@salto-io/adapter-components'
import referenceBySelfLinkFilter from '../../src/filters/references_by_self_link'
import { mockInstances, mockTypes } from '../mock_elements'
import { getFilterParams } from '../utils'

describe('referenceBySelfLinkFilter', () => {
  let filter: filterUtils.FilterWith<'onFetch'>
  beforeEach(async () => {
    filter = referenceBySelfLinkFilter(getFilterParams()) as typeof filter
  })

  describe('when an instance has a reference by self link', () => {
    let source: InstanceElement
    let target: InstanceElement
    beforeEach(async () => {
      source = new InstanceElement('my_board', mockTypes.Board, {
        self: 'https://ori-salto-test.atlassian.net/rest/api/2/board/1',
        location: {
          // note the link is using a different API version - this is on purpose
          self: 'https://ori-salto-test.atlassian.net/rest/api/2/project/10000',
        },
      })
      target = mockInstances.Project.clone()
      await filter.onFetch([source, target])
    })
    it('should create a reference', () => {
      expect(source.value.location).toBeInstanceOf(ReferenceExpression)
      expect(source.value.location.elemID).toEqual(target.elemID)
    })
  })
  describe('with reference in additional properties', () => {
    let source: InstanceElement
    let target: InstanceElement
    beforeEach(async () => {
      source = mockInstances.Board.clone()
      target = mockInstances.Project.clone()
      await filter.onFetch([source, target])
    })
    it('should create a reference', () => {
      expect(source.value.location).toBeInstanceOf(ReferenceExpression)
      expect(source.value.location.elemID).toEqual(target.elemID)
    })
  })
  describe('with link to a target that does not exist', () => {
    let source: InstanceElement
    beforeEach(async () => {
      source = mockInstances.Board.clone()
      await filter.onFetch([source])
    })
    it('should not create a reference', () => {
      expect(source.value.location).not.toBeInstanceOf(ReferenceExpression)
      expect(source.value.location).toEqual(mockInstances.Board.value.location)
    })
  })
})
