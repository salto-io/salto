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
import { ObjectType, ElemID, Element, InstanceElement, ListType, ChangeDataType, Change, toChange, getChangeElement, isModificationChange, isAdditionChange, isFieldChange, Field, ModificationChange, isObjectTypeChange, AdditionChange } from '@salto-io/adapter-api'
import { FilterWith } from '../../../src/filter'
import { fullApiName } from '../../../src/filters/utils'
import SalesforceClient from '../../../src/client/client'
import { SALESFORCE, CPQ_CUSTOM_SCRIPT, API_NAME, CPQ_CONSUMPTION_RATE_FIELDS, CPQ_GROUP_FIELDS, METADATA_TYPE, CUSTOM_OBJECT } from '../../../src/constants'
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
          [API_NAME]: fullApiName(CPQ_CUSTOM_SCRIPT, CPQ_CONSUMPTION_RATE_FIELDS),
        },
      },
      [CPQ_GROUP_FIELDS]: {
        type: Types.primitiveDataTypes.LongTextArea,
        annotations: {
          [API_NAME]: fullApiName(CPQ_CUSTOM_SCRIPT, CPQ_GROUP_FIELDS),
        },
      },
      randomField: {
        type: Types.primitiveDataTypes.Text,
        annotations: {
          [API_NAME]: fullApiName(CPQ_CUSTOM_SCRIPT, 'randomField'),
        },
      },
    },
    annotations: {
      [API_NAME]: CPQ_CUSTOM_SCRIPT,
      [METADATA_TYPE]: CUSTOM_OBJECT,
    },
  })
  const fromServiceCustomScriptValues = {
    [CPQ_CONSUMPTION_RATE_FIELDS]: 'lala\r\nzaza\nbaba',
    [CPQ_GROUP_FIELDS]: null,
    randomField: 'stayLikeThis',
  }
  const mockCustomScriptInstance = new InstanceElement(
    'customScriptInst',
    mockCustomScriptObject,
    fromServiceCustomScriptValues,
  )
  const afterOnFetchCustomScriptValues = {
    [CPQ_CONSUMPTION_RATE_FIELDS]: ['lala', 'zaza', 'baba'],
    [CPQ_GROUP_FIELDS]: null,
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
      expect(customScriptObj.fields[CPQ_GROUP_FIELDS].type)
        .toEqual(new ListType(Types.primitiveDataTypes.Text))
    })

    it('Should only change values of multi-line string in fieldsRefList to array of strings', () => {
      const customScriptInstance = elements
        .find(element => element.elemID.isEqual(mockCustomScriptInstance.elemID)) as InstanceElement
      expect(customScriptInstance.value[CPQ_CONSUMPTION_RATE_FIELDS]).toEqual(['lala', 'zaza', 'baba'])
      expect(customScriptInstance.value[CPQ_GROUP_FIELDS])
        .toEqual(fromServiceCustomScriptValues[CPQ_GROUP_FIELDS])
      expect(customScriptInstance.value.randomField)
        .toEqual(fromServiceCustomScriptValues.randomField)
    })
  })

  describe('onDeploy', () => {
    let changes: Change<ChangeDataType>[]

    describe('Addition changes', () => {
      beforeAll(async () => {
        changes = [
          toChange({ after: mockCustomScriptInstance.clone() }),
          toChange({ after: mockCustomScriptObject.clone() }),
        ]
        await filter.onDeploy(changes)
      })

      it('Should change fieldsRefList fields type to list of text', () => {
        const cpqCustomScriptObjAddChange = changes
          .find(change =>
            (isAdditionChange(change) && isObjectTypeChange(change)
              && getChangeElement(change).elemID.isEqual(mockCustomScriptObject.elemID)))
        expect(cpqCustomScriptObjAddChange).toBeDefined()
        const object = getChangeElement(cpqCustomScriptObjAddChange as AdditionChange<ObjectType>)
        expect(object.fields[CPQ_CONSUMPTION_RATE_FIELDS].type)
          .toEqual(new ListType(Types.primitiveDataTypes.Text))
        expect(object.fields[CPQ_GROUP_FIELDS].type)
          .toEqual(new ListType(Types.primitiveDataTypes.Text))
      })

      it('Should only change values of multi-line string in fieldsRefList to array of strings', () => {
        const customScriptInstanceAdd = changes
          .find(change =>
            getChangeElement(change).elemID.isEqual(mockCustomScriptInstance.elemID)
            && isAdditionChange(change))
        expect(customScriptInstanceAdd).toBeDefined()
        const changeElement = getChangeElement(
          customScriptInstanceAdd as Change
        ) as InstanceElement
        expect(changeElement.value[CPQ_CONSUMPTION_RATE_FIELDS]).toEqual(['lala', 'zaza', 'baba'])
        expect(changeElement.value[CPQ_GROUP_FIELDS])
          .toEqual(fromServiceCustomScriptValues[CPQ_GROUP_FIELDS])
        expect(changeElement.value.randomField)
          .toEqual(fromServiceCustomScriptValues.randomField)
      })
    })

    describe('Modification changes', () => {
      beforeAll(async () => {
        changes = [
          toChange({
            before: mockCustomScriptInstance.clone(),
            after: mockCustomScriptInstance.clone(),
          }),
          toChange({
            before: mockCustomScriptObject.clone(),
            after: mockCustomScriptObject.clone(),
          }),
        ]
        await filter.onDeploy(changes)
      })

      it('Should change fieldsRefList fields type to list of text', () => {
        const cpqCustomScriptObjModificationChange = changes
          .find(change =>
            (isModificationChange(change) && isObjectTypeChange(change)
              && getChangeElement(change).elemID.isEqual(mockCustomScriptObject.elemID)))
        expect(cpqCustomScriptObjModificationChange).toBeDefined()
        const afterData = (cpqCustomScriptObjModificationChange as ModificationChange<ObjectType>)
          .data.after
        expect(afterData.fields[CPQ_CONSUMPTION_RATE_FIELDS].type)
          .toEqual(new ListType(Types.primitiveDataTypes.Text))
        expect(afterData.fields[CPQ_GROUP_FIELDS].type)
          .toEqual(new ListType(Types.primitiveDataTypes.Text))
        const beforeData = (cpqCustomScriptObjModificationChange as ModificationChange<ObjectType>)
          .data.before
        expect(beforeData.fields[CPQ_CONSUMPTION_RATE_FIELDS].type)
          .toEqual(new ListType(Types.primitiveDataTypes.Text))
        expect(beforeData.fields[CPQ_GROUP_FIELDS].type)
          .toEqual(new ListType(Types.primitiveDataTypes.Text))
      })

      it('Should only change values of multi-line string in fieldsRefList to array of strings', () => {
        const customScriptInstanceModify = changes
          .find(change =>
            getChangeElement(change).elemID.isEqual(mockCustomScriptInstance.elemID)
            && isModificationChange(change))
        expect(customScriptInstanceModify).toBeDefined()
        const changeElement = getChangeElement(
          customScriptInstanceModify as Change
        ) as InstanceElement
        expect(changeElement.value[CPQ_CONSUMPTION_RATE_FIELDS]).toEqual(['lala', 'zaza', 'baba'])
        expect(changeElement.value[CPQ_GROUP_FIELDS])
          .toEqual(fromServiceCustomScriptValues[CPQ_GROUP_FIELDS])
        expect(changeElement.value.randomField)
          .toEqual(fromServiceCustomScriptValues.randomField)
      })
    })
  })

  describe('preDeploy', () => {
    let changes: Change<ChangeDataType>[]
    const mockAfterOnFetchCustomScriptObject = mockCustomScriptObject.clone()
    mockAfterOnFetchCustomScriptObject
      .fields[CPQ_CONSUMPTION_RATE_FIELDS].type = new ListType(Types.primitiveDataTypes.Text)
    mockAfterOnFetchCustomScriptObject
      .fields[CPQ_GROUP_FIELDS].type = new ListType(Types.primitiveDataTypes.Text)
    describe('Modification changes', () => {
      beforeAll(async () => {
        changes = [
          toChange({
            before: mockAfterOnFetchCustomScriptInstance.clone(),
            after: mockAfterOnFetchCustomScriptInstance.clone(),
          }),
          toChange({
            before: mockAfterOnFetchCustomScriptObject.fields[CPQ_CONSUMPTION_RATE_FIELDS].clone(),
            after: mockAfterOnFetchCustomScriptObject.fields[CPQ_CONSUMPTION_RATE_FIELDS].clone(),
          }),
        ]
        await filter.preDeploy(changes)
      })

      it('Should change fieldsRefList fields type to long text on modification change', () => {
        const cosRateFieldModifChange = changes
          .find(change =>
            (isModificationChange(change) && isFieldChange(change)
              && getChangeElement(change).elemID
                .isEqual(mockCustomScriptObject.fields[CPQ_CONSUMPTION_RATE_FIELDS].elemID)))
        expect(cosRateFieldModifChange).toBeDefined()
        expect(
          ((cosRateFieldModifChange as ModificationChange<Field>).data.after).type
        ).toEqual(Types.primitiveDataTypes.LongTextArea)
        expect(
          ((cosRateFieldModifChange as ModificationChange<Field>).data.before).type
        ).toEqual(Types.primitiveDataTypes.LongTextArea)
      })

      it('Should only change values of multi-line string in fieldsRefList back to string in modification change', () => {
        const customScriptInstanceModify = changes
          .find(change =>
            getChangeElement(change).elemID.isEqual(mockAfterOnFetchCustomScriptInstance.elemID)
            && isModificationChange(change))
        expect(customScriptInstanceModify).toBeDefined()
        const afterElement = (customScriptInstanceModify as ModificationChange<InstanceElement>)
          .data.after
        expect(afterElement.value[CPQ_CONSUMPTION_RATE_FIELDS]).toEqual('lala\nzaza\nbaba')
        expect(afterElement.value[CPQ_GROUP_FIELDS])
          .toEqual(fromServiceCustomScriptValues[CPQ_GROUP_FIELDS])
        expect(afterElement.value.randomField)
          .toEqual(fromServiceCustomScriptValues.randomField)
        const beforeElement = (customScriptInstanceModify as ModificationChange<InstanceElement>)
          .data.before
        expect(beforeElement.value[CPQ_CONSUMPTION_RATE_FIELDS]).toEqual('lala\nzaza\nbaba')
        expect(beforeElement.value[CPQ_GROUP_FIELDS])
          .toEqual(fromServiceCustomScriptValues[CPQ_GROUP_FIELDS])
        expect(beforeElement.value.randomField)
          .toEqual(fromServiceCustomScriptValues.randomField)
      })
    })

    describe('Addition changes', () => {
      beforeAll(async () => {
        changes = [
          toChange({
            before: mockAfterOnFetchCustomScriptInstance.clone(),
            after: mockAfterOnFetchCustomScriptInstance.clone(),
          }),
          toChange({ after: mockAfterOnFetchCustomScriptInstance.clone() }),
          toChange({
            before: mockAfterOnFetchCustomScriptObject.fields[CPQ_CONSUMPTION_RATE_FIELDS].clone(),
            after: mockAfterOnFetchCustomScriptObject.fields[CPQ_CONSUMPTION_RATE_FIELDS].clone(),
          }),
          toChange({
            after: mockAfterOnFetchCustomScriptObject.fields[CPQ_CONSUMPTION_RATE_FIELDS].clone(),
          }),
        ]
        await filter.preDeploy(changes)
      })

      it('Should change fieldsRefList fields type to long text on addition change', () => {
        const cpqConsumptionRateFieldAddChange = changes
          .find(change =>
            (isAdditionChange(change) && isFieldChange(change)
              && getChangeElement(change).elemID
                .isEqual(mockCustomScriptObject.fields[CPQ_CONSUMPTION_RATE_FIELDS].elemID)))
        expect(cpqConsumptionRateFieldAddChange).toBeDefined()
        expect((getChangeElement(cpqConsumptionRateFieldAddChange as Change) as Field).type)
          .toEqual(Types.primitiveDataTypes.LongTextArea)
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
        expect(changeElement.value[CPQ_CONSUMPTION_RATE_FIELDS]).toEqual('lala\nzaza\nbaba')
        expect(changeElement.value[CPQ_GROUP_FIELDS])
          .toEqual(fromServiceCustomScriptValues[CPQ_GROUP_FIELDS])
        expect(changeElement.value.randomField)
          .toEqual(fromServiceCustomScriptValues.randomField)
      })
    })
  })
})
