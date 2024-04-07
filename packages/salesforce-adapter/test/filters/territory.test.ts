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
  BuiltinTypes,
  InstanceElement,
  toChange,
  Change,
  createRefToElmWithValue,
} from '@salto-io/adapter-api'
import filterCreator from '../../src/filters/territory'
import { createMetadataTypeElement, defaultFilterContext } from '../utils'
import {
  createInstanceElement,
  MetadataInstanceElement,
} from '../../src/transformers/transformer'
import { CONTENT_FILENAME_OVERRIDE } from '../../src/transformers/xml_transformer'
import {
  SALESFORCE,
  TERRITORY2_TYPE,
  TERRITORY2_MODEL_TYPE,
  CUSTOM_OBJECT,
} from '../../src/constants'
import { FilterWith } from './mocks'

describe('territory filter', () => {
  let filter: FilterWith<'onFetch' | 'preDeploy' | 'onDeploy'>
  beforeEach(() => {
    filter = filterCreator({ config: defaultFilterContext }) as typeof filter
  })
  describe('onFetch', () => {
    let type: ObjectType
    let instance: MetadataInstanceElement
    beforeEach(async () => {
      type = createMetadataTypeElement(TERRITORY2_TYPE, {
        fields: {
          customFields: {
            refType: new ObjectType({
              elemID: new ElemID(SALESFORCE, 'FieldValue'),
            }),
          },
          description: { refType: BuiltinTypes.STRING },
        },
      })
      instance = createInstanceElement(
        {
          fullName: 'TerModel.Territory',
          description: 'Desc',
          customFields: [
            {
              name: 'f__c',
              value: { 'attr_xsi:type': 'xsd:boolean', '#text': 'false' },
            },
          ],
        },
        type,
      )
      await filter.onFetch([type, instance])
    })
    it('should remove custom fields from instance', () => {
      expect(instance.value).not.toHaveProperty('customFields')
    })
    it('should keep other values on instance', () => {
      expect(instance.value).toHaveProperty('description', 'Desc')
    })
    it('should remove custom fields from type fields', () => {
      expect(type.fields).not.toHaveProperty('customFields')
    })
    it('should keep other fields on type', () => {
      expect(type.fields).toHaveProperty(
        'description',
        expect.objectContaining({
          refType: createRefToElmWithValue(BuiltinTypes.STRING),
        }),
      )
    })
  })

  describe('deploy pkg structure', () => {
    let territoryType: ObjectType
    let changes: Change[]
    let beforeElementTerritory: InstanceElement
    let afterElementTerritory: InstanceElement
    let beforeElementModel: InstanceElement
    let afterElementModel: InstanceElement
    let beforeRegularInstance: InstanceElement
    let afterRegularInstance: InstanceElement
    beforeAll(() => {
      territoryType = createMetadataTypeElement(TERRITORY2_TYPE, {
        fields: {
          customFields: {
            refType: new ObjectType({
              elemID: new ElemID(SALESFORCE, 'FieldValue'),
            }),
          },
          description: { refType: BuiltinTypes.STRING },
        },
        annotations: {
          suffix: 'territory2',
          dirName: 'territory2Models',
          metadataType: 'Territory2',
        },
      })
      const territoryInstance = createInstanceElement(
        {
          fullName: 'TerModel.testTerritory',
          description: 'Desc',
        },
        territoryType,
      )
      beforeElementTerritory = territoryInstance
      afterElementTerritory = territoryInstance.clone()
      afterElementTerritory.value.description = 'Desc yay'

      const modelType = createMetadataTypeElement(TERRITORY2_MODEL_TYPE, {
        fields: {
          description: {
            refType: BuiltinTypes.STRING,
          },
        },
        annotations: {
          suffix: 'territory2Model',
          dirName: 'territory2Models',
          metadataType: 'Territory2Model',
        },
      })

      const modelInstance = createInstanceElement(
        { description: 'Desc', fullName: 'TerModel' },
        modelType,
      )
      beforeElementModel = modelInstance
      afterElementModel = modelInstance.clone()
      afterElementModel.value.description = 'Desc yay'

      const nonTerritoryType = createMetadataTypeElement(CUSTOM_OBJECT, {
        fields: {
          customFields: {
            refType: new ObjectType({
              elemID: new ElemID(SALESFORCE, 'FieldValue'),
            }),
          },
          description: {
            refType: BuiltinTypes.STRING,
          },
        },
      })
      const nonTerritoryInstance = createInstanceElement(
        {
          fullName: 'myCustomObject',
          description: 'Desc',
          customFields: [
            {
              name: 'f__c',
              value: { 'attr_xsi:type': 'xsd:boolean', '#text': 'false' },
            },
          ],
        },
        nonTerritoryType,
      )
      beforeRegularInstance = nonTerritoryInstance
      afterRegularInstance = nonTerritoryInstance.clone()
      afterRegularInstance.value.description = 'bla'

      changes = [
        toChange({
          before: beforeElementTerritory,
          after: afterElementTerritory,
        }),
        toChange({ before: beforeElementModel, after: afterElementModel }),
        toChange({
          before: beforeRegularInstance,
          after: afterRegularInstance,
        }),
      ]
    })

    describe('preDeploy filter', () => {
      beforeEach(async () => {
        await filter.preDeploy(changes)
      })
      it('should add contentFileName annotation Territory2 type', () => {
        expect(afterElementTerritory.annotations).toHaveProperty(
          CONTENT_FILENAME_OVERRIDE,
        )
        expect(
          afterElementTerritory.annotations[CONTENT_FILENAME_OVERRIDE],
        ).toStrictEqual(['TerModel', 'territories', 'testTerritory.territory2'])
      })
      it('should add contentFileName annotation to Territory2Model type', () => {
        expect(afterElementModel.annotations).toHaveProperty(
          CONTENT_FILENAME_OVERRIDE,
        )
        expect(
          afterElementModel.annotations[CONTENT_FILENAME_OVERRIDE],
        ).toStrictEqual(['TerModel', 'TerModel.territory2Model'])
      })

      it('should not annotate non-territory types', () => {
        expect(afterRegularInstance.annotations).not.toHaveProperty(
          CONTENT_FILENAME_OVERRIDE,
        )
      })
    })

    describe('onDeploy filter', () => {
      beforeEach(async () => {
        await filter.preDeploy(changes)
        await filter.onDeploy(changes)
      })
      it('should delete contentFileName annotation from all instances', () => {
        expect(afterElementTerritory.annotations).not.toHaveProperty(
          CONTENT_FILENAME_OVERRIDE,
        )
        expect(afterElementModel.annotations).not.toHaveProperty(
          CONTENT_FILENAME_OVERRIDE,
        )
        expect(afterRegularInstance.annotations).not.toHaveProperty(
          CONTENT_FILENAME_OVERRIDE,
        )
      })
    })
  })
})
