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
import { OnFetchFilter } from '../../src/filter'
import mockClient from '../client'
import filterCreator from '../../src/filters/form_field'
import {
  valuePropInstance,
  datePropInstance,
  g1PropInstance,
  formInstance,
} from '../common/mock_elements'

describe('form_field filter', () => {
  let filter: OnFetchFilter

  beforeEach(() => {
    const { client } = mockClient()
    filter = filterCreator({ client })
    filter.onFetch([formInstance, valuePropInstance, datePropInstance, g1PropInstance])
  })

  it('should not effect non-formFieldGroups fields', () => {
    expect(_.omit(formInstance.value, ['formFieldGroups'])).toEqual(_.omit(formInstance.value, ['formFieldGroups']))
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
    expect(formInstance.value.formFieldGroups[0].fields[0].displayOrder)
      .toEqual(g1PropInstance.value.displayOrder)
    expect(formInstance.value.formFieldGroups[0].fields[0].contactPropertyOverrides.displayOrder)
      .toBeUndefined()
  })

  it('should put description value in helpText at top level', () => {
    // g1 property (formfieldGroups[0].fields[0])
    expect(formInstance.value.formFieldGroups[0].fields[0].helpText)
      .toEqual(formInstance.value.formFieldGroups[0].fields[0].description)
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
    expect(formInstance.value.formFieldGroups[0].fields[0].dependentFieldFilters[0]
      .dependentFormField.displayOrder)
      .toEqual(datePropInstance.value.displayOrder)
    expect(formInstance.value.formFieldGroups[0].fields[0].contactPropertyOverrides.displayOrder)
      .toBeUndefined()
  })

  it('should put description value in helpText in dependent fields', () => {
    expect(formInstance.value.formFieldGroups[0].fields[0].dependentFieldFilters[0]
      .dependentFormField.helpText)
      .toEqual(formInstance.value.formFieldGroups[0].fields[0].dependentFieldFilters[0]
        .dependentFormField.helpText)
  })
})
