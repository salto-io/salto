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
import {
  ElemID, InstanceElement,
  ObjectType,
  toChange,
} from '@salto-io/adapter-api'
import { dynamicContentPlaceholderModificationValidator } from '../../src/change_validators/dynamic_content_placeholder_modification'
import {
  DYNAMIC_CONTENT_ITEM_TYPE_NAME,
  ZENDESK,
} from '../../src/constants'

const createDynamicContentInstance = (name: string, placeholder: string): InstanceElement =>
  new InstanceElement(
    name,
    new ObjectType({ elemID: new ElemID(ZENDESK, DYNAMIC_CONTENT_ITEM_TYPE_NAME) }),
    {
      placeholder,
    },
  )

describe('dynamicContentPlaceholderModificationValidator', () => {
  it('returns an error if the dynamic content item placeholder is modified', async () => {
    const before = createDynamicContentInstance('dynamicContent', 'oldPlaceholder')
    const after = createDynamicContentInstance('dynamicContent', 'newPlaceholder')
    const changes = [toChange({ before, after })]
    const errors = await dynamicContentPlaceholderModificationValidator(changes)
    expect(errors).toMatchObject([
      {
        elemID: before.elemID,
        severity: 'Error',
        message: 'Dynamic content item placeholder cannot be modified',
        detailedMessage: 'Dynamic content item placeholder cannot be modified',
      },
    ])
  })
})
