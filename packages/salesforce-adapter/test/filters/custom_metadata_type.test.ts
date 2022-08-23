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


import { BuiltinTypes, Change, ElemID, getChangeData, ObjectType, toChange } from '@salto-io/adapter-api'
import filterCreator from '../../src/filters/custom_metadata_type'
import { defaultFilterContext } from '../utils'
import { API_NAME, SALESFORCE } from '../../src/constants'
import { FilterWith } from '../../src/filter'

describe('customMetadataTypeFilter', () => {
  const CUSTOM_METADATA_TYPE_NAME = 'TestCustomMetadataType__mdt'
  const filter = (): FilterWith<'onFetch' | 'preDeploy'> => filterCreator({
    config: defaultFilterContext,
  }) as FilterWith<'onFetch' | 'preDeploy'>

  describe('onFetch', () => {
    let elements: ObjectType[]
    describe('when custom metadata type contains a non deployable field', () => {
      beforeEach(async () => {
        const customMetadataTypeWithNonDeployableField = new ObjectType({
          elemID: new ElemID(SALESFORCE, CUSTOM_METADATA_TYPE_NAME),
          fields: {
            Language: { refType: BuiltinTypes.STRING },
            DeployableField: { refType: BuiltinTypes.NUMBER },
          },
          annotations: {
            [API_NAME]: CUSTOM_METADATA_TYPE_NAME,
          },
        })
        elements = [customMetadataTypeWithNonDeployableField]
        await filter().onFetch(elements)
      })
      it('should omit the field from the ObjectType', () => {
        expect(Object.keys(elements[0].fields)).toEqual(['DeployableField'])
      })
    })
  })
  describe('onDeploy', () => {
    let changes: Change<ObjectType>[] = []
    describe('when custom metadata type contains a non deployable field', () => {
      beforeEach(async () => {
        const customMetadataTypeWithNonDeployableField = new ObjectType({
          elemID: new ElemID(SALESFORCE, CUSTOM_METADATA_TYPE_NAME),
          fields: {
            Language: { refType: BuiltinTypes.STRING },
            DeployableField: { refType: BuiltinTypes.NUMBER },
          },
          annotations: {
            [API_NAME]: CUSTOM_METADATA_TYPE_NAME,
          },
        })
        changes = [toChange({ after: customMetadataTypeWithNonDeployableField })]
        await filter().preDeploy(changes)
      })
      it('should omit the field from the ObjectType', () => {
        expect(Object.keys(getChangeData(changes[0]).fields)).toEqual(['DeployableField'])
      })
    })

    describe('when custom metadata type contains a non deployable annotation', () => {
      beforeEach(async () => {
        const customMetadataTypeWithNonDeployableField = new ObjectType({
          elemID: new ElemID(SALESFORCE, CUSTOM_METADATA_TYPE_NAME),
          fields: {
            DeployableField: { refType: BuiltinTypes.NUMBER },
          },
          annotations: {
            [API_NAME]: CUSTOM_METADATA_TYPE_NAME,
            deploymentStatus: 'Deployed',
          },
        })
        changes = [toChange({ after: customMetadataTypeWithNonDeployableField })]
        await filter().preDeploy(changes)
      })
      it('should omit the annotation from the ObjectType', () => {
        expect(Object.keys(getChangeData(changes[0]).annotations)).toEqual([API_NAME])
      })
    })
  })
})
