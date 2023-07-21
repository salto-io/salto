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

import { BuiltinTypes, ElemID, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import { NETSUITE } from '../../src/constants'
import filterCreator from '../../src/filters/data_elements_omit_fields'
import { LocalFilterOpts } from '../../src/filter'

describe('data elements omit fields filter tests', () => {
  const filterOpts = {
    config: {},
    isPartial: false,
    elementsSourceIndex: {
      getIndexes: () => {
        throw new Error('should not call getIndexes')
      },
    },
  } as unknown as LocalFilterOpts
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
  })
  it('should remove field from addition change on preDeploy', async () => {
    expect(subsidiaryInstance.value.classTranslationList).toEqual(classTranslationList)
    await filterCreator(filterOpts).preDeploy?.(
      [
        toChange({ after: subsidiaryInstance }),
      ]
    )
    expect(subsidiaryInstance.value.classTranslationList).toBeUndefined()
  })

  it('should remove field from modification change if the field was modified', async () => {
    const after = subsidiaryInstance.clone()
    after.value.classTranslationList.classTranslation.Russian = {
      language: 'Russian',
      name: 'Сводная материнская компания',
    }
    await filterCreator(filterOpts).preDeploy?.(
      [
        toChange({ before: subsidiaryInstance, after }),
      ]
    )
    expect(after.value.classTranslationList).toBeUndefined()
  })

  it('should not remove field if it wasn\'t modified', async () => {
    const after = subsidiaryInstance.clone()
    after.value.state = 'FLA'
    await filterCreator(filterOpts).preDeploy?.(
      [
        toChange({ before: subsidiaryInstance, after }),
      ]
    )
    expect(after.value.classTranslationList).toEqual(classTranslationList)
  })
})
