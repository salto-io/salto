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
import { BuiltinTypes, ChangeDataType, CORE_ANNOTATIONS, ElemID, Field, InstanceElement, ObjectType, ReferenceExpression, toChange } from '@salto-io/adapter-api'
import immutableChangesValidator from '../../src/change_validators/immutable_changes'
import { CUSTOM_RECORD_TYPE, NETSUITE, PATH, SCRIPT_ID } from '../../src/constants'
import { addressFormType } from '../../src/autogen/types/standard_types/addressForm'
import { entitycustomfieldType } from '../../src/autogen/types/standard_types/entitycustomfield'
import { fileType } from '../../src/types/file_cabinet_types'


describe('customization type change validator', () => {
  const file = fileType()
  const entitycustomfield = entitycustomfieldType().type
  const addressForm = addressFormType().type
  describe('SCRIPT_ID', () => {
    describe('has been modified', () => {
      it('should have change error for custom type', async () => {
        const entityCustomFieldInstance = new InstanceElement('elementName',
          entitycustomfield, {
            [SCRIPT_ID]: 'custentity_my_script_id',
          })
        const after = entityCustomFieldInstance.clone()
        after.value[SCRIPT_ID] = 'modified'
        const changeErrors = await immutableChangesValidator(
          [toChange({ before: entityCustomFieldInstance, after })]
        )
        expect(changeErrors).toHaveLength(1)
        expect(changeErrors[0].severity).toEqual('Error')
        expect(changeErrors[0].elemID).toEqual(entityCustomFieldInstance.elemID)
      })

      it('should have change error for customrecord type', async () => {
        const type = new ObjectType({
          elemID: new ElemID(NETSUITE, 'customrecord1'),
          annotationRefsOrTypes: {
            [SCRIPT_ID]: BuiltinTypes.SERVICE_ID,
          },
          annotations: {
            metadataType: CUSTOM_RECORD_TYPE,
            [SCRIPT_ID]: 'customrecord1',
          },
        })
        const after = type.clone()
        after.annotations[SCRIPT_ID] = 'modified'
        const changeErrors = await immutableChangesValidator(
          [toChange({ before: type, after })]
        )
        expect(changeErrors).toHaveLength(1)
        expect(changeErrors[0].severity).toEqual('Error')
        expect(changeErrors[0].elemID).toEqual(type.elemID)
      })

      it('should not have change error for non customrecord type', async () => {
        const type = new ObjectType({
          elemID: new ElemID(NETSUITE, 'non_customrecord1'),
          annotationRefsOrTypes: {
            [SCRIPT_ID]: BuiltinTypes.SERVICE_ID,
          },
          annotations: {
            [SCRIPT_ID]: 'non_customrecord1',
          },
        })
        const after = type.clone()
        after.annotations[SCRIPT_ID] = 'modified'
        const changeErrors = await immutableChangesValidator(
          [toChange({ before: type, after })]
        )
        expect(changeErrors).toHaveLength(0)
      })

      it('should have change error for custom field', async () => {
        const field = new Field(
          new ObjectType({
            elemID: new ElemID(NETSUITE, 'customrecord1'),
            annotations: { metadataType: CUSTOM_RECORD_TYPE },
          }),
          'custom_field',
          BuiltinTypes.STRING,
          { [SCRIPT_ID]: 'custom_field' },
        )
        const after = field.clone()
        after.annotations[SCRIPT_ID] = 'modified'
        const changeErrors = await immutableChangesValidator(
          [toChange({ before: field, after })]
        )
        expect(changeErrors).toHaveLength(1)
        expect(changeErrors[0].severity).toEqual('Error')
        expect(changeErrors[0].elemID).toEqual(field.elemID)
      })

      it('should not have change error for internal field', async () => {
        const field = new Field(
          new ObjectType({ elemID: new ElemID(NETSUITE, 'customrecord1') }),
          'non_custom_field',
          BuiltinTypes.STRING,
          { [SCRIPT_ID]: 'non_custom_field' },
        )
        const after = field.clone()
        after.annotations[SCRIPT_ID] = 'modified'
        const changeErrors = await immutableChangesValidator(
          [toChange({ before: field, after })]
        )
        expect(changeErrors).toHaveLength(0)
      })
    })
    describe('is missing on added change', () => {
      it('should have change error for custom type', async () => {
        const entityCustomFieldInstance = new InstanceElement('elementName', entitycustomfield)
        const changeErrors = await immutableChangesValidator(
          [toChange({ after: entityCustomFieldInstance })]
        )
        expect(changeErrors).toHaveLength(1)
        expect(changeErrors[0].severity).toEqual('Error')
        expect(changeErrors[0].elemID).toEqual(entityCustomFieldInstance.elemID)
      })

      it('should have change error for customrecord type', async () => {
        const type = new ObjectType({
          elemID: new ElemID(NETSUITE, 'customrecord1'),
          annotationRefsOrTypes: {
            [SCRIPT_ID]: BuiltinTypes.SERVICE_ID,
          },
          annotations: {
            metadataType: CUSTOM_RECORD_TYPE,
          },
        })
        const changeErrors = await immutableChangesValidator(
          [toChange({ after: type })]
        )
        expect(changeErrors).toHaveLength(1)
        expect(changeErrors[0].severity).toEqual('Error')
        expect(changeErrors[0].elemID).toEqual(type.elemID)
      })

      it('should not have change error for non customrecord type', async () => {
        const type = new ObjectType({
          elemID: new ElemID(NETSUITE, 'non_customrecord1'),
          annotationRefsOrTypes: {
            [SCRIPT_ID]: BuiltinTypes.SERVICE_ID,
          },
        })
        const changeErrors = await immutableChangesValidator(
          [toChange({ after: type })]
        )
        expect(changeErrors).toHaveLength(0)
      })

      it('should have change error for custom field with customrecord parent', async () => {
        const field = new Field(
          new ObjectType({
            elemID: new ElemID(NETSUITE, 'customrecord1'),
            annotations: { metadataType: CUSTOM_RECORD_TYPE },
          }),
          'custom_field',
          BuiltinTypes.STRING,
        )
        const changeErrors = await immutableChangesValidator(
          [toChange({ after: field })]
        )
        expect(changeErrors).toHaveLength(1)
        expect(changeErrors[0].severity).toEqual('Error')
        expect(changeErrors[0].elemID).toEqual(field.elemID)
      })

      it('should not have change error for custom field with non customrecord parent', async () => {
        const field = new Field(
          new ObjectType({ elemID: new ElemID(NETSUITE, 'non_customrecord1') }),
          'custom_field',
          BuiltinTypes.STRING,
        )
        const changeErrors = await immutableChangesValidator(
          [toChange({ after: field })]
        )
        expect(changeErrors).toHaveLength(0)
      })

      it('should not have change error for internal field', async () => {
        const field = new Field(
          new ObjectType({ elemID: new ElemID(NETSUITE, 'customrecord1') }),
          'non_custom_field',
          BuiltinTypes.STRING,
        )
        const changeErrors = await immutableChangesValidator(
          [toChange({ after: field })]
        )
        expect(changeErrors).toHaveLength(0)
      })
    })

    describe('is missing refType', () => {
      it('when modified, should not have change error for type without refType but with script id', async () => {
        const type = new ObjectType({
          elemID: new ElemID(NETSUITE, 'customrecord1'),
          annotationRefsOrTypes: {
            [SCRIPT_ID]: BuiltinTypes.SERVICE_ID,
          },
          annotations: {
            [SCRIPT_ID]: 'customrecord1',
          },
        })
        const after = type.clone()
        after.annotationRefTypes = {}
        const changeErrors = await immutableChangesValidator(
          [toChange({ before: type, after })]
        )
        expect(changeErrors).toHaveLength(0)
      })

      it('when added, should have change error for type without refType and no script id', async () => {
        const type = new ObjectType({
          elemID: new ElemID(NETSUITE, 'customrecord1'),
          annotationRefsOrTypes: {
          },
          annotations: {
            metadataType: CUSTOM_RECORD_TYPE,
          },
        })
        const changeErrors = await immutableChangesValidator(
          [toChange({ after: type })]
        )
        expect(changeErrors).toHaveLength(1)
        expect(changeErrors[0].severity).toEqual('Error')
        expect(changeErrors[0].elemID).toEqual(type.elemID)
      })
    })

    it('should not have errors for elements with SCRIPT_ID', async () => {
      const entityCustomFieldInstance = new InstanceElement('elementName',
        entitycustomfield, {
          [SCRIPT_ID]: 'custentity_my_script_id',
        })
      const type = new ObjectType({
        elemID: new ElemID(NETSUITE, 'customrecord1'),
        annotationRefsOrTypes: {
          [SCRIPT_ID]: BuiltinTypes.SERVICE_ID,
        },
        annotations: {
          [SCRIPT_ID]: 'customrecord1',
        },
      })
      const field = new Field(
        new ObjectType({ elemID: new ElemID(NETSUITE, 'customrecord1') }),
        'custom_field',
        BuiltinTypes.STRING,
        { [SCRIPT_ID]: 'custom_field' },
      )

      new Array<ChangeDataType>(entityCustomFieldInstance, type, field).forEach(async element => {
        const change = await immutableChangesValidator([toChange({ after: element })])
        expect(change).toEqual([])
      })
    })
  })

  it('should have change error if file cabinet type PATH has been modified', async () => {
    const fileInstance = new InstanceElement('fileInstance', file, {
      [PATH]: 'Templates/content.html',
    })
    const after = fileInstance.clone()
    after.value[PATH] = 'Templates/modified.html'
    const changeErrors = await immutableChangesValidator(
      [toChange({ before: fileInstance, after })]
    )
    expect(changeErrors).toHaveLength(1)
    expect(changeErrors[0].severity).toEqual('Error')
    expect(changeErrors[0].elemID).toEqual(fileInstance.elemID)
  })

  it('should have change error if file cabinet type parent has been modified', async () => {
    const fileInstance = new InstanceElement('fileInstance', file, {}, undefined, {
      [CORE_ANNOTATIONS.PARENT]: ['[/Templates/content]'],
    })
    const after = fileInstance.clone()
    after.annotations[CORE_ANNOTATIONS.PARENT] = ['[/Templates/modified]']
    const changeErrors = await immutableChangesValidator(
      [toChange({ before: fileInstance, after })]
    )
    expect(changeErrors).toHaveLength(1)
    expect(changeErrors[0].severity).toEqual('Error')
    expect(changeErrors[0].elemID).toEqual(fileInstance.elemID)
  })

  it('should not have change error if custom type regular field has been modified', async () => {
    const entityCustomFieldInstance = new InstanceElement('elementName',
      entitycustomfield, {
        [SCRIPT_ID]: 'custentity_my_script_id',
        label: 'original',
      })
    const after = entityCustomFieldInstance.clone()
    after.value.label = 'modified'
    const changeErrors = await immutableChangesValidator(
      [toChange({ before: entityCustomFieldInstance, after })]
    )
    expect(changeErrors).toHaveLength(0)
  })

  it('should not have change error if file cabinet type regular field has been modified', async () => {
    const fileInstance = new InstanceElement(
      'fileInstance',
      file,
      {
        [PATH]: 'Templates/content.html',
        content: 'original',
      },
      undefined,
      {
        [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(
          new ElemID('netsuite', 'someType', 'instance', 'someInstance'),
          new InstanceElement('someInstance', new ObjectType({ elemID: new ElemID('netsuite', 'someType') })),
        )],
      }
    )
    const after = fileInstance.clone()
    after.value.content = 'modified'
    const changeErrors = await immutableChangesValidator(
      [toChange({ before: fileInstance, after })]
    )
    expect(changeErrors).toHaveLength(0)
  })

  it('should have change error if identifier field has been modified', async () => {
    const accountingPeriodType = new ObjectType({
      elemID: new ElemID(NETSUITE, 'accountingPeriod'),
      fields: {
        identifier: { refType: BuiltinTypes.SERVICE_ID },
      },
      annotations: { source: 'soap' },
    })
    const before = new InstanceElement('instance', accountingPeriodType, { identifier: 'a' })
    const after = new InstanceElement('instance', accountingPeriodType, { identifier: 'b' })

    const changeErrors = await immutableChangesValidator(
      [toChange({ before, after })]
    )
    expect(changeErrors).toHaveLength(1)
    expect(changeErrors[0].severity).toEqual('Error')
    expect(changeErrors[0].elemID).toEqual(after.elemID)
  })

  it('should have change error if fields used for identifier fields have been modified', async () => {
    const accountingPeriodType = new ObjectType({
      elemID: new ElemID(NETSUITE, 'accountingPeriod'),
      annotations: { source: 'soap' },
    })
    const before = new InstanceElement('instance', accountingPeriodType, { fiscalCalendar: { name: 'a' } })
    const after = new InstanceElement('instance', accountingPeriodType, { fiscalCalendar: { name: 'b' } })

    const changeErrors = await immutableChangesValidator(
      [toChange({ before, after })]
    )
    expect(changeErrors).toHaveLength(1)
    expect(changeErrors[0].severity).toEqual('Error')
    expect(changeErrors[0].elemID).toEqual(after.elemID)
  })

  it('should have change error if instance application_id was modified', async () => {
    const before = new InstanceElement('instance', addressForm, { application_id: 'a' })
    const after = new InstanceElement('instance', addressForm, { application_id: 'b' })

    const changeErrors = await immutableChangesValidator(
      [toChange({ before, after })]
    )
    expect(changeErrors).toHaveLength(1)
    expect(changeErrors[0].severity).toEqual('Error')
    expect(changeErrors[0].elemID).toEqual(after.elemID)
  })

  it('should have change error if type application_id was modified', async () => {
    const before = new ObjectType({ elemID: new ElemID(NETSUITE, 'customrecord1'),
      annotationRefsOrTypes: {
        [SCRIPT_ID]: BuiltinTypes.SERVICE_ID,
      },
      annotations: { application_id: 'a' } })
    const after = new ObjectType({ elemID: new ElemID(NETSUITE, 'customrecord1'),
      annotationRefsOrTypes: {
        [SCRIPT_ID]: BuiltinTypes.SERVICE_ID,
      },
      annotations: { application_id: 'b' } })

    const changeErrors = await immutableChangesValidator(
      [toChange({ before, after })]
    )
    expect(changeErrors).toHaveLength(1)
    expect(changeErrors[0].severity).toEqual('Error')
    expect(changeErrors[0].elemID).toEqual(after.elemID)
  })
})
