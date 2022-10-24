/*
*                      Copyright 2022 Salto Labs Ltd.
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
import { ElemID, InstanceElement, ObjectType, ReferenceExpression, toChange } from '@salto-io/adapter-api'
import { ARTICLE_LABEL_TYPE_NAME, ARTICLE_TYPE_NAME, ZENDESK } from '../../src/constants'
import { articleLabelAdditionValidator } from '../../src/change_validators/article_label_addition'

describe('articleLabelAddition', () => {
  const labelInstance = new InstanceElement(
    'testLabel',
    new ObjectType({ elemID: new ElemID(ZENDESK, ARTICLE_LABEL_TYPE_NAME) }),
    { name: 'testLabel' }
  )
  const articleInstance = new InstanceElement(
    'testArticle',
    new ObjectType({ elemID: new ElemID(ZENDESK, ARTICLE_TYPE_NAME) }),
    { label_names: [new ReferenceExpression(labelInstance.elemID, labelInstance)] }
  )
  it('should return a warning if a non assigned label is added', async () => {
    const errors = await articleLabelAdditionValidator(
      [
        toChange({ after: labelInstance }),
      ],
    )
    expect(errors).toEqual([{
      elemID: labelInstance.elemID,
      severity: 'Warning',
      message: 'Label has not been added',
      detailedMessage: 'testLabel label has not been added, please make sure to assign it to articles',
    }])
  })
  it('should not return a warning if assigned label is added', async () => {
    const errors = await articleLabelAdditionValidator(
      [
        toChange({ after: labelInstance }),
        toChange({ after: articleInstance }),
      ],
    )
    expect(errors).toHaveLength(0)
  })
  it('should return a warning if label is added and removed from an aritcle instance', async () => {
    const errors = await articleLabelAdditionValidator(
      [
        toChange({ after: labelInstance }),
        toChange({ before: articleInstance }),
      ],
    )
    expect(errors).toEqual([{
      elemID: labelInstance.elemID,
      severity: 'Warning',
      message: 'Label has not been added',
      detailedMessage: 'testLabel label has not been added, please make sure to assign it to articles',
    }])
  })
})
