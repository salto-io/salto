/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { ElemID, InstanceElement, ObjectType, ReferenceExpression, toChange } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { ADAPTER_NAME, PAGE_TYPE_NAME, SPACE_TYPE_NAME } from '../../src/constants'
import { uniquePageTitleUnderSpaceValidator } from '../../src/change_validators/unique_page_title_under_space'

describe('uniquePageTitleUnderSpaceValidator', () => {
  const pageObjectType = new ObjectType({ elemID: new ElemID(ADAPTER_NAME, PAGE_TYPE_NAME) })
  const spaceObjectType = new ObjectType({ elemID: new ElemID(ADAPTER_NAME, SPACE_TYPE_NAME) })
  const space1 = new InstanceElement('space1', spaceObjectType, { key: 'space1' })
  const space2 = new InstanceElement('space2', spaceObjectType, { key: 'space2' })
  const pageInSpace1 = new InstanceElement('page1', pageObjectType, {
    title: 'title in space1',
    spaceId: new ReferenceExpression(space1.elemID),
  })
  const anotherPageInSpace1 = new InstanceElement('another page1', pageObjectType, {
    title: 'another title in space1',
    spaceId: new ReferenceExpression(space1.elemID),
  })
  const pageInSpace2 = new InstanceElement('page2', pageObjectType, {
    title: 'title in space2',
    spaceId: new ReferenceExpression(space2.elemID),
  })
  const elementSource = buildElementsSourceFromElements([
    pageObjectType,
    spaceObjectType,
    space1,
    space2,
    pageInSpace1,
    anotherPageInSpace1,
    pageInSpace2,
  ])
  it('should return change error for duplicate page titles on addition', async () => {
    const changes = [
      toChange({
        after: new InstanceElement('new page', pageObjectType, {
          title: 'title in space1',
          spaceId: new ReferenceExpression(space1.elemID),
        }),
      }),
    ]
    const res = await uniquePageTitleUnderSpaceValidator(changes, elementSource)

    expect(res).toHaveLength(1)
    expect(res[0].detailedMessage).toEqual(
      '"Page" title: title in space1 is already in use by page: confluence.page.instance.page1',
    )
  })
  it('should return change error for duplicate page titles on modification', async () => {
    const after = anotherPageInSpace1.clone()
    after.value.title = 'title in space1'
    const changes = [
      toChange({
        before: anotherPageInSpace1.clone(),
        after,
      }),
    ]
    const res = await uniquePageTitleUnderSpaceValidator(changes, elementSource)

    expect(res).toHaveLength(1)
    expect(res[0].detailedMessage).toEqual(
      '"Page" title: title in space1 is already in use by page: confluence.page.instance.page1',
    )
  })
  it('should not return change error when modifying a page', async () => {
    const after = anotherPageInSpace1.clone()
    after.value.someNewFiled = 'hep hep'
    const changes = [
      toChange({
        before: anotherPageInSpace1.clone(),
        after,
      }),
    ]
    const res = await uniquePageTitleUnderSpaceValidator(changes, elementSource)
    expect(res).toHaveLength(0)
  })
  it('should not return change error when adding a page with title exists in a different space', async () => {
    const changes = [
      toChange({
        after: new InstanceElement('new page', pageObjectType, {
          title: 'title in space1',
          spaceId: new ReferenceExpression(space2.elemID),
        }),
      }),
    ]
    const res = await uniquePageTitleUnderSpaceValidator(changes, elementSource)
    expect(res).toHaveLength(0)
  })
  it('should return no change error when there is no elementSource', async () => {
    const changes = [
      toChange({
        after: new InstanceElement('new page', pageObjectType, {
          title: 'title in space1',
          spaceId: new ReferenceExpression(space1.elemID),
        }),
      }),
    ]
    const res = await uniquePageTitleUnderSpaceValidator(changes)

    expect(res).toHaveLength(0)
  })
})
