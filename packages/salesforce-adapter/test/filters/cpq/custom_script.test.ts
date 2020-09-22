/*
*                      Copyright 2020 Salto Labs Ltd.
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
import { ObjectType, ElemID, Element, InstanceElement, ListType, ChangeDataType, Change, toChange, getChangeElement, isModificationChange, isAdditionChange } from '@salto-io/adapter-api'
import { FilterWith } from '../../../src/filter'
import SalesforceClient from '../../../src/client/client'
import { SALESFORCE, CPQ_CUSTOM_SCRIPT, API_NAME, CPQ_CONSUMPTION_RATE_FIELDS, CPQ_GROUP_FIELS, METADATA_TYPE, CUSTOM_OBJECT } from '../../../src/constants'
import { Types } from '../../../src/transformers/transformer'
import filterCreator from '../../../src/filters/cpq/custom_script'
import mockAdapter from '../../adapter'

describe('cpq custom script filter', () => {
  let client: SalesforceClient
  type FilterType = FilterWith<'onFetch' | 'onDeploy' | 'preDeploy'>
  let filter: FilterType
  let elements: Element[]

  const mockCustomScriptElemenID = new ElemID(SALESFORCE, CPQ_CUSTOM_SCRIPT)
  const mockCustomScriptObject = new ObjectType({
    elemID: mockCustomScriptElemenID,
    fields: {
      [CPQ_CONSUMPTION_RATE_FIELDS]: {
        type: Types.primitiveDataTypes.LongTextArea,
        annotations: {
          [API_NAME]: CPQ_CONSUMPTION_RATE_FIELDS,
        },
      },
      [CPQ_GROUP_FIELS]: {
        type: Types.primitiveDataTypes.LongTextArea,
        annotations: {
          [API_NAME]: CPQ_GROUP_FIELS,
        },
      },
      randomField: {
        type: Types.primitiveDataTypes.Text,
        annotations: {
          [API_NAME]: 'randomField',
        },
      },
    },
    annotations: {
      [API_NAME]: CPQ_CUSTOM_SCRIPT,
      [METADATA_TYPE]: CUSTOM_OBJECT,
    },
  })
  const fromServiceCustomScriptValues = {
    [CPQ_CONSUMPTION_RATE_FIELDS]: 'lala\r\nzaza\r\nbaba',
    [CPQ_GROUP_FIELS]: null,
    randomField: 'stayLikeThis',
  }
  const mockCustomScriptInstance = new InstanceElement(
    'customScriptInst',
    mockCustomScriptObject,
    fromServiceCustomScriptValues,
  )
  const afterOnFetchCustomScriptValues = {
    [CPQ_CONSUMPTION_RATE_FIELDS]: ['lala', 'zaza', 'baba'],
    [CPQ_GROUP_FIELS]: null,
    randomField: 'stayLikeThis',
  }
  const mockAfterOnFetchCustomScriptInstance = new InstanceElement(
    'afterOnFetchcustomScriptInst',
    mockCustomScriptObject,
    afterOnFetchCustomScriptValues,
  )

  beforeAll(async () => {
    ({ client } = mockAdapter({
      adapterParams: {
      },
    }))
    filter = filterCreator({ client, config: {} }) as FilterType
  })

  describe('onFetch', () => {
    beforeAll(async () => {
      elements = [
        mockCustomScriptObject.clone(),
        mockCustomScriptInstance.clone(),
      ]
      await filter.onFetch(elements)
    })

    it('Should change fieldsRefList fields type to list of text', () => {
      const customScriptObj = elements
        .find(element => element.elemID.isEqual(mockCustomScriptObject.elemID)) as ObjectType
      expect(customScriptObj).toBeDefined()
      expect(customScriptObj.fields[CPQ_CONSUMPTION_RATE_FIELDS].type)
        .toEqual(new ListType(Types.primitiveDataTypes.Text))
      expect(customScriptObj.fields[CPQ_GROUP_FIELS].type)
        .toEqual(new ListType(Types.primitiveDataTypes.Text))
    })

    it('Should only change values of multi-line string in fieldsRefList to array of strings', () => {
      const customScriptInstance = elements
        .find(element => element.elemID.isEqual(mockCustomScriptInstance.elemID)) as InstanceElement
      expect(customScriptInstance.value[CPQ_CONSUMPTION_RATE_FIELDS]).toEqual(['lala', 'zaza', 'baba'])
      expect(customScriptInstance.value[CPQ_GROUP_FIELS])
        .toEqual(fromServiceCustomScriptValues[CPQ_GROUP_FIELS])
      expect(customScriptInstance.value.randomField)
        .toEqual(fromServiceCustomScriptValues.randomField)
    })
  })

  describe('onDeploy', () => {
    let changes: Change<ChangeDataType>[]
    beforeAll(async () => {
      changes = [
        toChange({
          before: mockCustomScriptInstance.clone(),
          after: mockCustomScriptInstance.clone(),
        }),
        toChange({ after: mockCustomScriptInstance.clone() }),
      ]
      await filter.onDeploy(changes)
    })

    it('Should only change values of multi-line string in fieldsRefList to array of strings in modification change', () => {
      const customScriptInstanceModify = changes
        .find(change =>
          getChangeElement(change).elemID.isEqual(mockCustomScriptInstance.elemID)
          && isModificationChange(change))
      expect(customScriptInstanceModify).toBeDefined()
      const changeElement = getChangeElement(
        customScriptInstanceModify as Change
      ) as InstanceElement
      expect(changeElement.value[CPQ_CONSUMPTION_RATE_FIELDS]).toEqual(['lala', 'zaza', 'baba'])
      expect(changeElement.value[CPQ_GROUP_FIELS])
        .toEqual(fromServiceCustomScriptValues[CPQ_GROUP_FIELS])
      expect(changeElement.value.randomField)
        .toEqual(fromServiceCustomScriptValues.randomField)
    })

    it('Should only change values of multi-line string in fieldsRefList to array of strings in addition change', () => {
      const customScriptInstanceAdd = changes
        .find(change =>
          getChangeElement(change).elemID.isEqual(mockCustomScriptInstance.elemID)
          && isAdditionChange(change))
      expect(customScriptInstanceAdd).toBeDefined()
      const changeElement = getChangeElement(
        customScriptInstanceAdd as Change
      ) as InstanceElement
      expect(changeElement.value[CPQ_CONSUMPTION_RATE_FIELDS]).toEqual(['lala', 'zaza', 'baba'])
      expect(changeElement.value[CPQ_GROUP_FIELS])
        .toEqual(fromServiceCustomScriptValues[CPQ_GROUP_FIELS])
      expect(changeElement.value.randomField)
        .toEqual(fromServiceCustomScriptValues.randomField)
    })
  })

  describe('preDeploy', () => {
    let changes: Change<ChangeDataType>[]
    beforeAll(async () => {
      changes = [
        toChange({
          before: mockAfterOnFetchCustomScriptInstance.clone(),
          after: mockAfterOnFetchCustomScriptInstance.clone(),
        }),
        toChange({ after: mockAfterOnFetchCustomScriptInstance.clone() }),
      ]
      await filter.preDeploy(changes)
    })

    it('Should only change values of multi-line string in fieldsRefList back to string in modification change', () => {
      const customScriptInstanceModify = changes
        .find(change =>
          getChangeElement(change).elemID.isEqual(mockAfterOnFetchCustomScriptInstance.elemID)
          && isModificationChange(change))
      expect(customScriptInstanceModify).toBeDefined()
      const changeElement = getChangeElement(
        customScriptInstanceModify as Change
      ) as InstanceElement
      expect(changeElement.value[CPQ_CONSUMPTION_RATE_FIELDS]).toEqual('lala\r\nzaza\r\nbaba')
      expect(changeElement.value[CPQ_GROUP_FIELS])
        .toEqual(fromServiceCustomScriptValues[CPQ_GROUP_FIELS])
      expect(changeElement.value.randomField)
        .toEqual(fromServiceCustomScriptValues.randomField)
    })

    it('Should only change values of multi-line string in fieldsRefList back to string in addition change', () => {
      const customScriptInstanceAdd = changes
        .find(change =>
          getChangeElement(change).elemID.isEqual(mockAfterOnFetchCustomScriptInstance.elemID)
          && isAdditionChange(change))
      expect(customScriptInstanceAdd).toBeDefined()
      const changeElement = getChangeElement(
        customScriptInstanceAdd as Change
      ) as InstanceElement
      expect(changeElement.value[CPQ_CONSUMPTION_RATE_FIELDS]).toEqual('lala\r\nzaza\r\nbaba')
      expect(changeElement.value[CPQ_GROUP_FIELS])
        .toEqual(fromServiceCustomScriptValues[CPQ_GROUP_FIELS])
      expect(changeElement.value.randomField)
        .toEqual(fromServiceCustomScriptValues.randomField)
    })
  })
})
