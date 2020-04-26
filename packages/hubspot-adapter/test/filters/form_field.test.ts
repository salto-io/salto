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
import _ from 'lodash'
import { InstanceElement, Values } from '@salto-io/adapter-api'
import filterCreator from '../../src/filters/form_field'
import { Types } from '../../src/transformers/transformer'
import { valuePropInstance, datePropInstance, g1PropInstance } from '../common/mock_elements'

describe('form_field filter', () => {
  const filter = filterCreator()
  const formValues = {
    portalId: 6774238,
    guid: 'guid',
    name: 'formName',
    action: '',
    method: 'POST',
    cssClass: '',
    editable: true,
    deletable: false,
    createdAt: 1500588456053,
    redirect: 'google.com',
    submitText: '',
    cloneable: false,
    captchaEnabled: true,
    formFieldGroups: [
      {
        fields: [
          {
            name: 'g1',
            label: 'g1!',
            type: 'string',
            fieldType: 'text',
            description: 'g1 property',
            required: false,
            hidden: false,
            displayOrder: 1,
            defaultValue: '',
            isSmartField: false,
            selectedOptions: [],
            options: [],
            dependentFieldFilters: [
              {
                filters: [
                  {
                    operator: 'EQ',
                    strValue: 'em@salto.io',
                    boolValue: false,
                    numberValue: 0,
                    strValues: [],
                    numberValues: [],
                  },
                ],
                dependentFormField: {
                  name: 'date_of_birth',
                  label: 'Date of birth override',
                  type: 'string',
                  fieldType: 'text',
                  description: 'l',
                  groupName: 'contactinformation',
                  displayOrder: 1,
                  required: false,
                  selectedOptions: [],
                  options: [],
                  enabled: true,
                  hidden: false,
                  isSmartField: false,
                  unselectedLabel: 'unselected',
                  placeholder: 'place',
                  dependentFieldFilters: [],
                  labelHidden: false,
                  propertyObjectType: 'CONTACT',
                  metaData: [],
                },
                formFieldAction: 'DISPLAY',
              },
            ],
          },
        ],
        default: true,
        isSmartGroup: false,
      },
      {
        fields: [
          {
            name: 'value',
            label: 'Value',
            type: 'string',
            fieldType: 'text',
            description: '',
            required: false,
            hidden: false,
            defaultValue: '',
            isSmartField: false,
            displayOrder: 1,
            selectedOptions: ['val1'],
            options: [
              {
                label: 'opt1',
                value: 'val1',
                hidden: true,
                readOnly: true,
              },
            ],
          },
        ],
        default: true,
        isSmartGroup: false,
      },
    ],
    ignoreCurrentValues: false,
    inlineMessage: 'inline',
    themeName: 'theme',
    notifyRecipients: '',
  } as Values
  const formInstance = new InstanceElement(
    'mockForm',
    Types.hubspotObjects.form,
    formValues
  )

  beforeEach(() => {
    filter.onFetch([formInstance, valuePropInstance, datePropInstance, g1PropInstance])
  })

  it('should not effect non-formFieldGroups fields', () => {
    expect(_.omit(formInstance.value, ['formFieldGroups'])).toEqual(_.omit(formValues, ['formFieldGroups']))
  })

  it('should keep the formFieldGroups and fields structure as is', () => {
    // g1 property (formfieldGroups[0].fields[0])
    expect(formInstance.value.formFieldGroups[0]).toBeDefined()
    expect(formInstance.value.formFieldGroups[0].fields[0]).toBeDefined()

    // value property (formfieldGroups[1].fields[0])
    expect(formInstance.value.formFieldGroups[1]).toBeDefined()
    expect(formInstance.value.formFieldGroups[1].fields[0]).toBeDefined()
  })

  it('should keep the dependent fields structure as it', () => {
    // date property (dependent on g1)
    expect(formInstance.value.formFieldGroups[0].fields[0].dependentFieldFilters[0]).toBeDefined()
    expect(formInstance.value.formFieldGroups[0].fields[0].dependentFieldFilters[0].filters)
      .toBeDefined()
    expect(
      formInstance.value.formFieldGroups[0].fields[0].dependentFieldFilters[0].dependentFormField
    ).toBeDefined()
  })

  it('should add references to contactProperties at field level', () => {
    // g1 property (formfieldGroups[0].fields[0])
    expect(formInstance.value.formFieldGroups[0].fields[0].contactProperty).toBeDefined()
    expect(formInstance.value.formFieldGroups[0].fields[0].contactProperty.elemId).toBeDefined()
    expect(formInstance.value.formFieldGroups[0].fields[0].contactProperty.elemId)
      .toEqual(g1PropInstance.elemID)

    // value property (formfieldGroups[1].fields[0])
    expect(formInstance.value.formFieldGroups[1].fields[0].contactProperty).toBeDefined()
    expect(formInstance.value.formFieldGroups[1].fields[0].contactProperty.elemId).toBeDefined()
    expect(formInstance.value.formFieldGroups[1].fields[0].contactProperty.elemId)
      .toEqual(valuePropInstance.elemID)
  })

  it('should create contactPropertyOverrides at field', () => {
    // g1 property (formfieldGroups[0].fields[0])
    expect(formInstance.value.formFieldGroups[0].fields[0].contactPropertyOverrides).toBeDefined()
  })

  it('should put fields with different values (form from contactProperty) in the contactPoropertyOverrides', () => {
    // g1 property (formfieldGroups[0].fields[0])
    expect(formInstance.value.formFieldGroups[0].fields[0].contactPropertyOverrides.label)
      .toBeDefined()
    expect(formInstance.value.formFieldGroups[0].fields[0].contactPropertyOverrides.label)
      .not.toEqual(g1PropInstance.value.label)
  })

  it('should not include equal values in contactPropertyOverrides', () => {
    // g1 property (formfieldGroups[0].fields[0])
    expect(formValues.formFieldGroups[0].fields[0].displayOrder)
      .toEqual(g1PropInstance.value.displayOrder)
    expect(formInstance.value.formFieldGroups[0].fields[0].contactPropertyOverrides.displayOrder)
      .toBeUndefined()
  })

  it('should put description value in helpText at top level', () => {
    // g1 property (formfieldGroups[0].fields[0])
    expect(formInstance.value.formFieldGroups[0].fields[0].helpText)
      .toEqual(formValues.formFieldGroups[0].fields[0].description)
  })

  it('should add references to contactProperties in dependent fields', () => {
    // date property (dependent on g1)
    expect(formInstance.value.formFieldGroups[0].fields[0].dependentFieldFilters[0]).toBeDefined()
    expect(
      formInstance.value.formFieldGroups[0].fields[0].dependentFieldFilters[0].dependentFormField
    ).toBeDefined()
    expect(
      formInstance.value.formFieldGroups[0].fields[0].dependentFieldFilters[0].dependentFormField
        .contactProperty
    ).toBeDefined()
    expect(
      formInstance.value.formFieldGroups[0].fields[0].dependentFieldFilters[0].dependentFormField
        .contactProperty.elemId
    ).toEqual(datePropInstance.elemID)
  })

  it('should create contactPropertyOverrides in dependent fields', () => {
    expect(
      formInstance.value.formFieldGroups[0].fields[0].dependentFieldFilters[0]
        .dependentFormField.contactPropertyOverrides
    ).toBeDefined()
  })

  it('should put values from form in overrides if diff from contactProperty in dependent fields', () => {
    expect(formInstance.value.formFieldGroups[0].fields[0].dependentFieldFilters[0]
      .dependentFormField.contactPropertyOverrides.label).toBeDefined()
    expect(formInstance.value.formFieldGroups[0].fields[0].dependentFieldFilters[0]
      .dependentFormField.contactPropertyOverrides.label)
      .not.toEqual(datePropInstance.value.label)
  })

  it('should not include equal values in contactPropertyOverrides in dependent fields', () => {
    expect(formValues.formFieldGroups[0].fields[0].dependentFieldFilters[0]
      .dependentFormField.displayOrder)
      .toEqual(datePropInstance.value.displayOrder)
    expect(formInstance.value.formFieldGroups[0].fields[0].contactPropertyOverrides.displayOrder)
      .toBeUndefined()
  })

  it('should put description value in helpText in dependent fields', () => {
    expect(formInstance.value.formFieldGroups[0].fields[0].dependentFieldFilters[0]
      .dependentFormField.helpText)
      .toEqual(formValues.formFieldGroups[0].fields[0].dependentFieldFilters[0]
        .dependentFormField.helpText)
  })
})
