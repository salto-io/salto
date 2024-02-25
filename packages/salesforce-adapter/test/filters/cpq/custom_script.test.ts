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
  ObjectType,
  ElemID,
  Element,
  InstanceElement,
  ListType,
  ChangeDataType,
  Change,
  toChange,
  getChangeData,
  isModificationChange,
  isAdditionChange,
  ModificationChange,
  isObjectTypeChange,
  AdditionChange,
  StaticFile,
  isFieldChange,
  Field,
  createRefToElmWithValue,
} from '@salto-io/adapter-api'
import { fullApiName } from '../../../src/filters/utils'
import {
  SALESFORCE,
  CPQ_CUSTOM_SCRIPT,
  API_NAME,
  CPQ_CONSUMPTION_RATE_FIELDS,
  CPQ_GROUP_FIELDS,
  METADATA_TYPE,
  CUSTOM_OBJECT,
  CPQ_CODE_FIELD,
} from '../../../src/constants'
import { Types } from '../../../src/transformers/transformer'
import filterCreator from '../../../src/filters/cpq/custom_script'
import { defaultFilterContext } from '../../utils'
import { FilterWith } from '../mocks'

describe('cpq custom script filter', () => {
  type FilterType = FilterWith<'onFetch' | 'onDeploy' | 'preDeploy'>
  let filter: FilterType
  let elements: Element[]

  const mockCustomScriptElemenID = new ElemID(SALESFORCE, CPQ_CUSTOM_SCRIPT)
  const mockCustomScriptObject = new ObjectType({
    elemID: mockCustomScriptElemenID,
    fields: {
      [CPQ_CONSUMPTION_RATE_FIELDS]: {
        refType: createRefToElmWithValue(Types.primitiveDataTypes.LongTextArea),
        annotations: {
          [API_NAME]: fullApiName(
            CPQ_CUSTOM_SCRIPT,
            CPQ_CONSUMPTION_RATE_FIELDS,
          ),
        },
      },
      [CPQ_GROUP_FIELDS]: {
        refType: createRefToElmWithValue(Types.primitiveDataTypes.LongTextArea),
        annotations: {
          [API_NAME]: fullApiName(CPQ_CUSTOM_SCRIPT, CPQ_GROUP_FIELDS),
        },
      },
      [CPQ_CODE_FIELD]: {
        refType: createRefToElmWithValue(Types.primitiveDataTypes.Text),
        annotations: {
          [API_NAME]: fullApiName(CPQ_CUSTOM_SCRIPT, CPQ_CODE_FIELD),
        },
      },
      randomField: {
        refType: createRefToElmWithValue(Types.primitiveDataTypes.Text),
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
  const cpqCodeContent = Buffer.from('if (this === "code") return true')
  const afterOnFetchCustomScriptValues = {
    [CPQ_CONSUMPTION_RATE_FIELDS]: ['lala', 'zaza', 'baba'],
    [CPQ_GROUP_FIELDS]: null,
    [CPQ_CODE_FIELD]: new StaticFile({
      content: cpqCodeContent,
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
    filter = filterCreator({ config: defaultFilterContext }) as FilterType
  })

  describe('onFetch', () => {
    beforeAll(async () => {
      elements = [
        mockCustomScriptObject.clone(),
        mockCustomScriptInstance.clone(),
      ]
      await filter.onFetch(elements)
    })

    it('Should change fieldsRefList fields type to list of text', async () => {
      const customScriptObj = elements.find((element) =>
        element.elemID.isEqual(mockCustomScriptObject.elemID),
      ) as ObjectType
      expect(customScriptObj).toBeDefined()
      expect(
        await customScriptObj.fields[CPQ_CONSUMPTION_RATE_FIELDS].getType(),
      ).toEqual(new ListType(Types.primitiveDataTypes.Text))
      expect(await customScriptObj.fields[CPQ_GROUP_FIELDS].getType()).toEqual(
        new ListType(Types.primitiveDataTypes.Text),
      )
    })

    it('Should only change values of multi-line string in fieldsRefList to array of strings and code to static file', () => {
      const customScriptInstance = elements.find((element) =>
        element.elemID.isEqual(mockCustomScriptInstance.elemID),
      ) as InstanceElement
      expect(customScriptInstance.value[CPQ_CONSUMPTION_RATE_FIELDS]).toEqual(
        afterOnFetchCustomScriptValues[CPQ_CONSUMPTION_RATE_FIELDS],
      )
      expect(customScriptInstance.value[CPQ_CODE_FIELD]).toEqual(
        afterOnFetchCustomScriptValues[CPQ_CODE_FIELD],
      )
      expect(customScriptInstance.value[CPQ_GROUP_FIELDS]).toEqual(
        fromServiceCustomScriptValues[CPQ_GROUP_FIELDS],
      )
      expect(customScriptInstance.value.randomField).toEqual(
        fromServiceCustomScriptValues.randomField,
      )
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

      it('Should change fieldsRefList fields type to list of text', async () => {
        const cpqCustomScriptObjAddChange = changes.find(
          (change) =>
            isAdditionChange(change) &&
            isObjectTypeChange(change) &&
            getChangeData(change).elemID.isEqual(mockCustomScriptObject.elemID),
        )
        expect(cpqCustomScriptObjAddChange).toBeDefined()
        const object = getChangeData(
          cpqCustomScriptObjAddChange as AdditionChange<ObjectType>,
        )
        expect(
          await object.fields[CPQ_CONSUMPTION_RATE_FIELDS].getType(),
        ).toEqual(new ListType(Types.primitiveDataTypes.Text))
        expect(await object.fields[CPQ_GROUP_FIELDS].getType()).toEqual(
          new ListType(Types.primitiveDataTypes.Text),
        )
      })

      it('Should only change values of multi-line string in fieldsRefList to array of strings', () => {
        const customScriptInstanceAdd = changes.find(
          (change) =>
            getChangeData(change).elemID.isEqual(
              mockCustomScriptInstance.elemID,
            ) && isAdditionChange(change),
        )
        expect(customScriptInstanceAdd).toBeDefined()
        const changeData = getChangeData(
          customScriptInstanceAdd as Change,
        ) as InstanceElement
        expect(changeData.value[CPQ_CONSUMPTION_RATE_FIELDS]).toEqual(
          afterOnFetchCustomScriptValues[CPQ_CONSUMPTION_RATE_FIELDS],
        )
        expect(fromServiceCustomScriptValues[CPQ_CODE_FIELD]).toEqual(
          fromServiceCustomScriptValues[CPQ_CODE_FIELD],
        )
        expect(changeData.value[CPQ_GROUP_FIELDS]).toEqual(
          fromServiceCustomScriptValues[CPQ_GROUP_FIELDS],
        )
        expect(changeData.value.randomField).toEqual(
          fromServiceCustomScriptValues.randomField,
        )
      })
    })

    describe('Modification changes', () => {
      beforeAll(async () => {
        const beforeType = mockCustomScriptObject.clone()
        const afterType = mockCustomScriptObject.clone()
        changes = [
          toChange({
            before: mockCustomScriptInstance.clone(),
            after: mockCustomScriptInstance.clone(),
          }),
          toChange({
            before: beforeType.fields[CPQ_CONSUMPTION_RATE_FIELDS],
            after: afterType.fields[CPQ_CONSUMPTION_RATE_FIELDS],
          }),
          toChange({
            before: beforeType,
            after: afterType,
          }),
        ]
        await filter.onDeploy(changes)
      })

      it('should change field type to list of text for modified fields', async () => {
        const cpqFieldChange = changes.find(
          isFieldChange,
        ) as ModificationChange<Field>
        expect(cpqFieldChange).toBeDefined()
        expect(await cpqFieldChange.data.before.getType()).toEqual(
          new ListType(Types.primitiveDataTypes.Text),
        )
        expect(await cpqFieldChange.data.after.getType()).toEqual(
          new ListType(Types.primitiveDataTypes.Text),
        )
      })

      it('should not change field types in object modification', async () => {
        const cpqTypeChange = changes.find(
          isObjectTypeChange,
        ) as ModificationChange<ObjectType>
        expect(cpqTypeChange).toBeDefined()
        expect(
          await cpqTypeChange.data.before.fields[CPQ_GROUP_FIELDS].getType(),
        ).toEqual(
          await mockCustomScriptObject.fields[CPQ_GROUP_FIELDS].getType(),
        )
        expect(
          await cpqTypeChange.data.after.fields[CPQ_GROUP_FIELDS].getType(),
        ).toEqual(
          await mockCustomScriptObject.fields[CPQ_GROUP_FIELDS].getType(),
        )
      })

      it('Should only change values of multi-line string in fieldsRefList to array of strings', () => {
        const customScriptInstanceModify = changes.find(
          (change) =>
            getChangeData(change).elemID.isEqual(
              mockCustomScriptInstance.elemID,
            ) && isModificationChange(change),
        )
        expect(customScriptInstanceModify).toBeDefined()
        const changeData = getChangeData(
          customScriptInstanceModify as Change,
        ) as InstanceElement
        expect(changeData.value[CPQ_CONSUMPTION_RATE_FIELDS]).toEqual(
          afterOnFetchCustomScriptValues[CPQ_CONSUMPTION_RATE_FIELDS],
        )
        expect(changeData.value[CPQ_CODE_FIELD]).toEqual(
          fromServiceCustomScriptValues[CPQ_CODE_FIELD],
        )
        expect(changeData.value[CPQ_GROUP_FIELDS]).toEqual(
          fromServiceCustomScriptValues[CPQ_GROUP_FIELDS],
        )
        expect(changeData.value.randomField).toEqual(
          fromServiceCustomScriptValues.randomField,
        )
      })
    })
  })

  describe('preDeploy', () => {
    let changes: Change<ChangeDataType>[]
    const mockAfterOnFetchCustomScriptObject = mockCustomScriptObject.clone()
    mockAfterOnFetchCustomScriptObject.fields[
      CPQ_CONSUMPTION_RATE_FIELDS
    ].refType = createRefToElmWithValue(
      new ListType(Types.primitiveDataTypes.Text),
    )
    mockAfterOnFetchCustomScriptObject.fields[CPQ_GROUP_FIELDS].refType =
      createRefToElmWithValue(new ListType(Types.primitiveDataTypes.Text))
    const mockAfterResolveCustomScriptInstance =
      mockAfterOnFetchCustomScriptInstance.clone()
    // Simulating resolve on the static-file
    mockAfterResolveCustomScriptInstance.value[CPQ_CODE_FIELD] =
      cpqCodeContent.toString('utf-8')
    describe('Modification changes', () => {
      beforeAll(async () => {
        const beforeType = mockAfterOnFetchCustomScriptObject.clone()
        const afterType = mockAfterOnFetchCustomScriptObject.clone()
        changes = [
          toChange({
            before: mockAfterResolveCustomScriptInstance.clone(),
            after: mockAfterResolveCustomScriptInstance.clone(),
          }),
          toChange({
            before: beforeType.fields[CPQ_CONSUMPTION_RATE_FIELDS],
            after: afterType.fields[CPQ_CONSUMPTION_RATE_FIELDS],
          }),
          toChange({
            before: beforeType,
            after: afterType,
          }),
        ]
        await filter.preDeploy(changes)
      })

      it('Should change fieldRefList fields type to long text', async () => {
        const cpqFieldChange = changes.find(
          isFieldChange,
        ) as ModificationChange<Field>
        expect(cpqFieldChange).toBeDefined()
        expect(await cpqFieldChange.data.before.getType()).toEqual(
          Types.primitiveDataTypes.LongTextArea,
        )
        expect(await cpqFieldChange.data.after.getType()).toEqual(
          Types.primitiveDataTypes.LongTextArea,
        )
      })

      it('Should not change field types in the object type modification', async () => {
        const cpqTypeChange = changes.find(
          isObjectTypeChange,
        ) as ModificationChange<ObjectType>
        expect(cpqTypeChange).toBeDefined()
        expect(
          await cpqTypeChange.data.before.fields[CPQ_GROUP_FIELDS].getType(),
        ).toEqual(
          await mockAfterOnFetchCustomScriptObject.fields[
            CPQ_GROUP_FIELDS
          ].getType(),
        )
        expect(
          await cpqTypeChange.data.after.fields[CPQ_GROUP_FIELDS].getType(),
        ).toEqual(
          await mockAfterOnFetchCustomScriptObject.fields[
            CPQ_GROUP_FIELDS
          ].getType(),
        )
      })

      it('Should only change values of multi-line string in fieldsRefList', () => {
        const customScriptInstanceModify = changes.find(
          (change) =>
            getChangeData(change).elemID.isEqual(
              mockAfterOnFetchCustomScriptInstance.elemID,
            ) && isModificationChange(change),
        )
        expect(customScriptInstanceModify).toBeDefined()
        const afterElement = (
          customScriptInstanceModify as ModificationChange<InstanceElement>
        ).data.after
        expect(afterElement.value[CPQ_CONSUMPTION_RATE_FIELDS]).toEqual(
          'lala\nzaza\nbaba',
        )
        expect(afterElement.value[CPQ_CODE_FIELD]).toEqual(
          fromServiceCustomScriptValues[CPQ_CODE_FIELD],
        )
        expect(afterElement.value[CPQ_GROUP_FIELDS]).toEqual(
          fromServiceCustomScriptValues[CPQ_GROUP_FIELDS],
        )
        expect(afterElement.value.randomField).toEqual(
          fromServiceCustomScriptValues.randomField,
        )
        const beforeElement = (
          customScriptInstanceModify as ModificationChange<InstanceElement>
        ).data.before
        expect(beforeElement.value[CPQ_CONSUMPTION_RATE_FIELDS]).toEqual(
          'lala\nzaza\nbaba',
        )
        expect(beforeElement.value[CPQ_CODE_FIELD]).toEqual(
          fromServiceCustomScriptValues[CPQ_CODE_FIELD],
        )
        expect(beforeElement.value[CPQ_GROUP_FIELDS]).toEqual(
          fromServiceCustomScriptValues[CPQ_GROUP_FIELDS],
        )
        expect(beforeElement.value.randomField).toEqual(
          fromServiceCustomScriptValues.randomField,
        )
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

      it('Should change fieldsRefList fields type to long text on addition change', async () => {
        const cpqCustomScriptObjAddChange = changes.find(
          (change) =>
            isAdditionChange(change) &&
            isObjectTypeChange(change) &&
            getChangeData(change).elemID.isEqual(mockCustomScriptObject.elemID),
        )
        expect(cpqCustomScriptObjAddChange).toBeDefined()
        const object = getChangeData(
          cpqCustomScriptObjAddChange as AdditionChange<ObjectType>,
        )
        expect(
          await object.fields[CPQ_CONSUMPTION_RATE_FIELDS].getType(),
        ).toEqual(Types.primitiveDataTypes.LongTextArea)
        expect(await object.fields[CPQ_GROUP_FIELDS].getType()).toEqual(
          Types.primitiveDataTypes.LongTextArea,
        )
      })

      it('Should only change values of multi-line string in fieldsRefList', () => {
        const customScriptInstanceAdd = changes.find(
          (change) =>
            getChangeData(change).elemID.isEqual(
              mockAfterOnFetchCustomScriptInstance.elemID,
            ) && isAdditionChange(change),
        )
        expect(customScriptInstanceAdd).toBeDefined()
        const changeData = getChangeData(
          customScriptInstanceAdd as Change,
        ) as InstanceElement
        expect(changeData.value[CPQ_CONSUMPTION_RATE_FIELDS]).toEqual(
          'lala\nzaza\nbaba',
        )
        expect(changeData.value[CPQ_CODE_FIELD]).toEqual(
          fromServiceCustomScriptValues[CPQ_CODE_FIELD],
        )
        expect(changeData.value[CPQ_GROUP_FIELDS]).toEqual(
          fromServiceCustomScriptValues[CPQ_GROUP_FIELDS],
        )
        expect(changeData.value.randomField).toEqual(
          fromServiceCustomScriptValues.randomField,
        )
      })
    })
  })
})
