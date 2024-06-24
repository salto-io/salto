/*
 *                      Copyright 2024 Salto Labs Ltd.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with
 * the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { ElemID, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { ADAPTER_NAME, SPACE_TYPE_NAME } from '../../src/constants'
import { uniqueSpaceKeyValidator } from '../../src/change_validators'

describe('uniqueSpaceKeyValidator', () => {
  const spaceObjectType = new ObjectType({ elemID: new ElemID(ADAPTER_NAME, SPACE_TYPE_NAME) })
  const space1 = new InstanceElement('space1', spaceObjectType, { key: 'space1' })
  const space2 = new InstanceElement('space2', spaceObjectType, { key: 'space2' })
  const elementSource = buildElementsSourceFromElements([spaceObjectType, space1, space2])
  it('should return change error for duplicate space key on addition', async () => {
    const changes = [
      toChange({
        after: new InstanceElement('new space', spaceObjectType, {
          key: 'space1',
        }),
      }),
    ]
    const res = await uniqueSpaceKeyValidator(changes, elementSource)

    expect(res).toHaveLength(1)
    expect(res[0].detailedMessage).toEqual('key: space1 is already in use in space: confluence.space.instance.space1')
  })
  it('should return change error for duplicate space key on modification', async () => {
    const after = space1.clone()
    after.value.key = 'space2'
    const changes = [
      toChange({
        before: space1.clone(),
        after,
      }),
    ]
    const res = await uniqueSpaceKeyValidator(changes, elementSource)

    expect(res).toHaveLength(1)
    expect(res[0].detailedMessage).toEqual('key: space2 is already in use in space: confluence.space.instance.space2')
  })
  it('should not return change error when modifying a space', async () => {
    const after = space1.clone()
    after.value.someNewFiled = 'hep hep'
    const changes = [
      toChange({
        before: space1.clone(),
        after,
      }),
    ]
    const res = await uniqueSpaceKeyValidator(changes, elementSource)
    expect(res).toHaveLength(0)
  })
  it('should not return change error when adding a space with unique key', async () => {
    const changes = [
      toChange({
        after: new InstanceElement('new space', spaceObjectType, {
          key: 'new key',
        }),
      }),
    ]
    const res = await uniqueSpaceKeyValidator(changes, elementSource)
    expect(res).toHaveLength(0)
  })
  it('should return no change error when there is no elementSource', async () => {
    const changes = [
      toChange({
        after: new InstanceElement('new space', spaceObjectType, {
          key: 'space1',
        }),
      }),
    ]
    const res = await uniqueSpaceKeyValidator(changes)

    expect(res).toHaveLength(0)
  })
})
