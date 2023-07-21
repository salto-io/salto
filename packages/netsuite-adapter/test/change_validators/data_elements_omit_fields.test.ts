/*
*                      Copyright 2023 Salto Labs Ltd.
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

import { ObjectType, ElemID, BuiltinTypes, InstanceElement, toChange } from '@salto-io/adapter-api'
import { NETSUITE } from '../../src/constants'
import validateFieldsToOmit from '../../src/change_validators/data_elements_omit_fields'

describe('data elements omit fields change validator tests', () => {
  const subsidiaryType = new ObjectType({
    elemID: new ElemID(NETSUITE, 'subsidiary'),
    fields: {
      internalId: {
        refType: BuiltinTypes.STRING,
        annotations: {
          isAttribute: true,
        },
      },
      name: { refType: BuiltinTypes.SERVICE_ID },
      state: { refType: BuiltinTypes.STRING },
    },
    annotations: { source: 'soap' },
  })
  const classTranslationList = {
    classTranslation: {
      Danish: {
        language: 'Danish',
        name: 'Konsolideret moderselskab',
      },
    },
  }
  let subsidiaryInstance: InstanceElement
  let after: InstanceElement
  beforeEach(() => {
    subsidiaryInstance = new InstanceElement(
      'Parent_Company',
      subsidiaryType,
      {
        name: 'subsidiary_name',
        state: 'AZ',
        classTranslationList,
      }
    )
    after = subsidiaryInstance.clone()
  })
  it('should have a warning on addition change', async () => {
    const changeErrors = await validateFieldsToOmit([toChange({ after: subsidiaryInstance })])
    expect(changeErrors).toHaveLength(1)
    expect(changeErrors[0]).toEqual(
      {
        elemID: subsidiaryInstance.elemID,
        severity: 'Warning',
        message: 'Changes to the classTranslationList are not deployable',
        detailedMessage: 'Changes to the classTranslationList are not deployable and will be removed from the deployment.',
      }
    )
  })

  it('should have warning on modification changes with changes to the field', async () => {
    after.value.classTranslationList.classTranslation.Russian = {
      language: 'Russian',
      name: 'Сводная материнская компания',
    }
    const changeErrors = await validateFieldsToOmit([toChange({ before: subsidiaryInstance, after })])
    expect(changeErrors).toHaveLength(1)
    expect(changeErrors[0]).toEqual(
      {
        elemID: subsidiaryInstance.elemID,
        severity: 'Warning',
        message: 'Changes to the classTranslationList are not deployable',
        detailedMessage: 'Changes to the classTranslationList are not deployable and will be removed from the deployment.',
      }
    )
  })

  it('shouldn\'t have warning on modifications where the field hasn\'t changed', async () => {
    after.value.state = 'FLA'
    const changeErrors = await validateFieldsToOmit([toChange({ before: subsidiaryInstance, after })])
    expect(changeErrors).toHaveLength(0)
  })
})
