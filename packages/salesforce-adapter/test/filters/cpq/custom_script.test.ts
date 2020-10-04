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
import { ObjectType, ElemID, Element, InstanceElement, ListType, ChangeDataType, Change, toChange, getChangeElement, isModificationChange, isAdditionChange, ModificationChange, isObjectTypeChange, AdditionChange, StaticFile } from '@salto-io/adapter-api'
import { FilterWith } from '../../../src/filter'
import { fullApiName } from '../../../src/filters/utils'
import SalesforceClient from '../../../src/client/client'
import { SALESFORCE, CPQ_CUSTOM_SCRIPT, API_NAME, CPQ_CONSUMPTION_RATE_FIELDS, CPQ_GROUP_FIELDS, METADATA_TYPE, CUSTOM_OBJECT, CPQ_CODE_FIELD } from '../../../src/constants'
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
      [CPQ_CODE_FIELD]: {
        type: Types.primitiveDataTypes.Text,
        annotations: {
          [API_NAME]: fullApiName(CPQ_CUSTOM_SCRIPT, CPQ_CODE_FIELD),
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
    [CPQ_CODE_FIELD]: 'if (this === "code") return true',
    randomField: 'stayLikeThis',
  }
  const mockCustomScripInstancePath = ['fakePath', 'fakePath2']
  const mockCustomScriptInstance = new InstanceElement(
    'customScriptInst',
    mockCustomScriptObject,
    fromServiceCustomScriptValues,
    mockCustomScripInstancePath,
  )
  const afterOnFetchCustomScriptValues = {
    [CPQ_CONSUMPTION_RATE_FIELDS]: ['lala', 'zaza', 'baba'],
    [CPQ_GROUP_FIELDS]: null,
    [CPQ_CODE_FIELD]: new StaticFile({
      content: Buffer.from('if (this === "code") return true'),
      filepath: `${mockCustomScripInstancePath.join('/')}.js`,
      encoding: 'utf-8',
    }),
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

    it('Should only change values of multi-line string in fieldsRefList to array of strings and code to static file', () => {
      const customScriptInstance = elements
        .find(element => element.elemID.isEqual(mockCustomScriptInstance.elemID)) as InstanceElement
      expect(customScriptInstance.value[CPQ_CONSUMPTION_RATE_FIELDS])
        .toEqual(afterOnFetchCustomScriptValues[CPQ_CONSUMPTION_RATE_FIELDS])
      expect(customScriptInstance.value[CPQ_CODE_FIELD])
        .toEqual(afterOnFetchCustomScriptValues[CPQ_CODE_FIELD])
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
        expect(changeElement.value[CPQ_CONSUMPTION_RATE_FIELDS])
          .toEqual(afterOnFetchCustomScriptValues[CPQ_CONSUMPTION_RATE_FIELDS])
        expect(fromServiceCustomScriptValues[CPQ_CODE_FIELD])
          .toEqual(fromServiceCustomScriptValues[CPQ_CODE_FIELD])
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
        expect(changeElement.value[CPQ_CONSUMPTION_RATE_FIELDS])
          .toEqual(afterOnFetchCustomScriptValues[CPQ_CONSUMPTION_RATE_FIELDS])
        expect(changeElement.value[CPQ_CODE_FIELD])
          .toEqual(fromServiceCustomScriptValues[CPQ_CODE_FIELD])
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
    const mockAfterResolveCustomScriptInstance = mockAfterOnFetchCustomScriptInstance
      .clone()
    // Simulating resolve on the static-file
    mockAfterResolveCustomScriptInstance
      .value[CPQ_CODE_FIELD] = mockAfterResolveCustomScriptInstance.value[CPQ_CODE_FIELD].content.toString('utf-8')
    describe('Modification changes', () => {
      beforeAll(async () => {
        changes = [
          toChange({
            before: mockAfterResolveCustomScriptInstance.clone(),
            after: mockAfterResolveCustomScriptInstance.clone(),
          }),
          toChange({
            before: mockAfterOnFetchCustomScriptObject.clone(),
            after: mockAfterOnFetchCustomScriptObject.clone(),
          }),
        ]
        await filter.preDeploy(changes)
      })

      it('Should change fieldsRefList fields type to long text on modification change', () => {
        const cpqCustomScriptObjModificationChange = changes
          .find(change =>
            (isModificationChange(change) && isObjectTypeChange(change)
              && getChangeElement(change).elemID.isEqual(mockCustomScriptObject.elemID)))
        expect(cpqCustomScriptObjModificationChange).toBeDefined()
        const afterData = (cpqCustomScriptObjModificationChange as ModificationChange<ObjectType>)
          .data.after
        expect(afterData.fields[CPQ_CONSUMPTION_RATE_FIELDS].type)
          .toEqual(Types.primitiveDataTypes.LongTextArea)
        expect(afterData.fields[CPQ_GROUP_FIELDS].type)
          .toEqual(Types.primitiveDataTypes.LongTextArea)
        const beforeData = (cpqCustomScriptObjModificationChange as ModificationChange<ObjectType>)
          .data.before
        expect(beforeData.fields[CPQ_CONSUMPTION_RATE_FIELDS].type)
          .toEqual(Types.primitiveDataTypes.LongTextArea)
        expect(beforeData.fields[CPQ_GROUP_FIELDS].type)
          .toEqual(Types.primitiveDataTypes.LongTextArea)
      })

      it('Should only change values of multi-line string in fieldsRefList', () => {
        const customScriptInstanceModify = changes
          .find(change =>
            getChangeElement(change).elemID.isEqual(mockAfterOnFetchCustomScriptInstance.elemID)
            && isModificationChange(change))
        expect(customScriptInstanceModify).toBeDefined()
        const afterElement = (customScriptInstanceModify as ModificationChange<InstanceElement>)
          .data.after
        expect(afterElement.value[CPQ_CONSUMPTION_RATE_FIELDS]).toEqual('lala\nzaza\nbaba')
        expect(afterElement.value[CPQ_CODE_FIELD])
          .toEqual(fromServiceCustomScriptValues[CPQ_CODE_FIELD])
        expect(afterElement.value[CPQ_GROUP_FIELDS])
          .toEqual(fromServiceCustomScriptValues[CPQ_GROUP_FIELDS])
        expect(afterElement.value.randomField)
          .toEqual(fromServiceCustomScriptValues.randomField)
        const beforeElement = (customScriptInstanceModify as ModificationChange<InstanceElement>)
          .data.before
        expect(beforeElement.value[CPQ_CONSUMPTION_RATE_FIELDS]).toEqual('lala\nzaza\nbaba')
        expect(beforeElement.value[CPQ_CODE_FIELD])
          .toEqual(fromServiceCustomScriptValues[CPQ_CODE_FIELD])
        expect(beforeElement.value[CPQ_GROUP_FIELDS])
          .toEqual(fromServiceCustomScriptValues[CPQ_GROUP_FIELDS])
        expect(beforeElement.value.randomField)
          .toEqual(fromServiceCustomScriptValues.randomField)
      })
    })

    describe('Addition changes', () => {
      beforeAll(async () => {
        changes = [
          toChange({ after: mockAfterResolveCustomScriptInstance.clone() }),
          toChange({ after: mockAfterOnFetchCustomScriptObject.clone() }),
        ]
        await filter.preDeploy(changes)
      })

      it('Should change fieldsRefList fields type to long text on addition change', () => {
        const cpqCustomScriptObjAddChange = changes
          .find(change =>
            (isAdditionChange(change) && isObjectTypeChange(change)
              && getChangeElement(change).elemID.isEqual(mockCustomScriptObject.elemID)))
        expect(cpqCustomScriptObjAddChange).toBeDefined()
        const object = getChangeElement(cpqCustomScriptObjAddChange as AdditionChange<ObjectType>)
        expect(object.fields[CPQ_CONSUMPTION_RATE_FIELDS].type)
          .toEqual(Types.primitiveDataTypes.LongTextArea)
        expect(object.fields[CPQ_GROUP_FIELDS].type)
          .toEqual(Types.primitiveDataTypes.LongTextArea)
      })

      it('Should only change values of multi-line string in fieldsRefList', () => {
        const customScriptInstanceAdd = changes
          .find(change =>
            getChangeElement(change).elemID.isEqual(mockAfterOnFetchCustomScriptInstance.elemID)
            && isAdditionChange(change))
        expect(customScriptInstanceAdd).toBeDefined()
        const changeElement = getChangeElement(
          customScriptInstanceAdd as Change
        ) as InstanceElement
        expect(changeElement.value[CPQ_CONSUMPTION_RATE_FIELDS]).toEqual('lala\nzaza\nbaba')
        expect(changeElement.value[CPQ_CODE_FIELD])
          .toEqual(fromServiceCustomScriptValues[CPQ_CODE_FIELD])
        expect(changeElement.value[CPQ_GROUP_FIELDS])
          .toEqual(fromServiceCustomScriptValues[CPQ_GROUP_FIELDS])
        expect(changeElement.value.randomField)
          .toEqual(fromServiceCustomScriptValues.randomField)
      })
    })
  })
})
