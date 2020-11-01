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
import { ChangeGroupId, ChangeId, ElemID, InstanceElement, ObjectType, toChange, BuiltinTypes, CORE_ANNOTATIONS } from '@salto-io/adapter-api'
import { SALESFORCE, CUSTOM_OBJECT, API_NAME, METADATA_TYPE, LABEL, OBJECTS_PATH } from '../src/constants'
import { getChangeGroupIds } from '../src/group_changes'
import { createInstanceElement } from '../src/transformers/transformer'
import { mockDefaultValues, mockTypes } from './mock_elements'

describe('Group changes function', () => {
  const customObjectName = 'objectName'
  const customObject = new ObjectType(
    {
      elemID: new ElemID(SALESFORCE, customObjectName),
      annotations: {
        [API_NAME]: customObjectName,
        [METADATA_TYPE]: CUSTOM_OBJECT,
      },
      fields: {
        Name: {
          type: BuiltinTypes.STRING,
          annotations: {
            [CORE_ANNOTATIONS.REQUIRED]: false,
            [LABEL]: 'description label',
            [API_NAME]: 'Name',
          },
        },
        TestField: {
          type: BuiltinTypes.STRING,
          annotations: {
            [LABEL]: 'Test field',
            [API_NAME]: 'TestField',
          },
        },
      },
      path: [SALESFORCE, OBJECTS_PATH, customObjectName],
    }
  )
  const differentCustomObjectName = 'differentCustomObject'
  const differentCustomObject = new ObjectType(
    {
      elemID: new ElemID(SALESFORCE, differentCustomObjectName),
      annotations: {
        [API_NAME]: differentCustomObjectName,
        [METADATA_TYPE]: CUSTOM_OBJECT,
      },
      fields: {
        Name: {
          type: BuiltinTypes.STRING,
          annotations: {
            [CORE_ANNOTATIONS.REQUIRED]: false,
            [LABEL]: 'description label',
            [API_NAME]: 'Name',
          },
        },
        TestField: {
          type: BuiltinTypes.STRING,
          annotations: {
            [LABEL]: 'Test field',
            [API_NAME]: 'TestField',
          },
        },
      },
      path: [SALESFORCE, OBJECTS_PATH, differentCustomObjectName],
    }
  )
  const metadataInstance = createInstanceElement(
    mockDefaultValues.StaticResource,
    mockTypes.StaticResource,
  )
  let changeGroupIds: Map<ChangeId, ChangeGroupId>

  const addInstance = new InstanceElement('addInstance', customObject)
  const anotherAddInstance = new InstanceElement('anotherAddInstance', customObject)
  const differentAddInstance = new InstanceElement('differentAddInstance', differentCustomObject)

  const removeInstance = new InstanceElement('removeInstance', customObject)
  const anotherRemoveInstance = new InstanceElement('anotherRemoveInstance', customObject)
  const differentRemoveInstance = new InstanceElement('differentRemoveInstance', differentCustomObject)

  const modifyInstance = new InstanceElement('modifyInstance', customObject)
  const anotherModifyInstance = new InstanceElement('anotherModifyInstance', customObject)
  const differentModifyInstance = new InstanceElement('differentModifyInstance', differentCustomObject)

  beforeAll(async () => {
    changeGroupIds = await getChangeGroupIds(new Map([
      [customObject.elemID.getFullName(), toChange({ after: customObject })],
      [metadataInstance.elemID.getFullName(), toChange({ before: metadataInstance })],
      [addInstance.elemID.getFullName(), toChange({ after: addInstance })],
      [anotherAddInstance.elemID.getFullName(), toChange({ after: anotherAddInstance })],
      [differentAddInstance.elemID.getFullName(), toChange({ after: differentAddInstance })],
      [removeInstance.elemID.getFullName(), toChange({ before: removeInstance })],
      [anotherRemoveInstance.elemID.getFullName(), toChange({ before: anotherRemoveInstance })],
      [differentRemoveInstance.elemID.getFullName(), toChange({ before: differentRemoveInstance })],
      [modifyInstance.elemID.getFullName(),
        toChange({ before: modifyInstance, after: modifyInstance })],
      [anotherModifyInstance.elemID.getFullName(),
        toChange({ before: anotherModifyInstance, after: anotherModifyInstance })],
      [differentModifyInstance.elemID.getFullName(),
        toChange({ before: differentModifyInstance, after: differentModifyInstance })],
    ]))
  })

  describe('groups of metadata', () => {
    it('should have one group for all metadata related changes', () => {
      expect(changeGroupIds.get(customObject.elemID.getFullName())).toEqual(
        changeGroupIds.get(metadataInstance.elemID.getFullName())
      )
      expect(changeGroupIds.get(customObject.elemID.getFullName())).toEqual(
        'salesforce_metadata'
      )
    })
  })

  describe('groups of add changes', () => {
    it('should have same group id for all adds of same custom object', () => {
      expect(changeGroupIds.get(addInstance.elemID.getFullName()))
        .toEqual(changeGroupIds.get(anotherAddInstance.elemID.getFullName()))
      expect(changeGroupIds.get(addInstance.elemID.getFullName()))
        .toEqual(`add_${customObjectName}_instances`)
    })

    it('should have a separate group for diff type', () => {
      expect(changeGroupIds.get(differentAddInstance.elemID.getFullName()))
        .toEqual(`add_${differentCustomObjectName}_instances`)
    })
  })

  describe('groups of remove changes', () => {
    it('should have same group id for all remove of same custom object', () => {
      expect(changeGroupIds.get(removeInstance.elemID.getFullName()))
        .toEqual(changeGroupIds.get(anotherRemoveInstance.elemID.getFullName()))
      expect(changeGroupIds.get(removeInstance.elemID.getFullName()))
        .toEqual(`remove_${customObjectName}_instances`)
    })

    it('should have a separate group for diff type', () => {
      expect(changeGroupIds.get(differentRemoveInstance.elemID.getFullName()))
        .toEqual(`remove_${differentCustomObjectName}_instances`)
    })
  })

  describe('groups of modify changes', () => {
    it('should have same group id for all modify of same custom object', () => {
      expect(changeGroupIds.get(modifyInstance.elemID.getFullName()))
        .toEqual(changeGroupIds.get(anotherModifyInstance.elemID.getFullName()))
      expect(changeGroupIds.get(modifyInstance.elemID.getFullName()))
        .toEqual(`modify_${customObjectName}_instances`)
    })

    it('should have a separate group for diff type', () => {
      expect(changeGroupIds.get(differentModifyInstance.elemID.getFullName()))
        .toEqual(`modify_${differentCustomObjectName}_instances`)
    })
  })
})
