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
  BuiltinTypes,
  ElemID,
  InstanceElement,
  ModificationChange,
  ObjectType,
  ReferenceExpression,
  toChange,
} from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { LocalFilterOpts } from '../../src/filter'
import { createEmptyElementsSourceIndexes, getDefaultAdapterConfig } from '../utils'
import filterCreator from '../../src/filters/restore_deleted_list_items_without_scriptid'
import { roleType } from '../../src/autogen/types/standard_types/role'
import { CUSTOM_RECORD_TYPE, NETSUITE, SCRIPT_ID } from '../../src/constants'
import { workflowType } from '../../src/autogen/types/standard_types/workflow'

describe('restore deleted list items with scriptid filter', () => {
  let fetchOpts: LocalFilterOpts
  let roleInstance: InstanceElement
  let nonRelevantInstance: InstanceElement

  const customRecordInstance = new ObjectType({
    elemID: new ElemID(NETSUITE, 'customrecord1'),
    annotationRefsOrTypes: {
      [SCRIPT_ID]: BuiltinTypes.SERVICE_ID,
    },
    annotations: {
      metadataType: CUSTOM_RECORD_TYPE,
      [SCRIPT_ID]: 'customrecord1',
    },
  })
  const originRoleInstance = new InstanceElement('role_test', roleType().type, {
    [SCRIPT_ID]: 'role_test',
    permissions: {
      permission: {
        TRAN_PAYMENTAUDIT: {
          permkey: 'TRAN_PAYMENTAUDIT',
          permlevel: 'EDIT',
        },
        customrecord1: {
          permkey: new ReferenceExpression(
            customRecordInstance.elemID.createNestedID('attr', SCRIPT_ID),
            customRecordInstance.annotations[SCRIPT_ID],
            customRecordInstance,
          ),
          permlevel: 'EDIT',
          restriction: 'no',
        },
      },
    },
    otherField: {
      val1: {
        val1: {
          value: 'value1',
        },
        val2: {
          value: 'value2',
        },
      },
    },
  })

  const originNonRelevantInstance = new InstanceElement('non-relevant', workflowType().type, {
    [SCRIPT_ID]: 'non-relevant',
    name: 'name1',
  })

  beforeEach(async () => {
    roleInstance = originRoleInstance.clone()
    nonRelevantInstance = originNonRelevantInstance.clone()
    fetchOpts = {
      elementsSourceIndex: {
        getIndexes: () => Promise.resolve(createEmptyElementsSourceIndexes()),
      },
      elementsSource: buildElementsSourceFromElements([]),
      isPartial: false,
      config: await getDefaultAdapterConfig(),
    }
  })

  describe('Role', () => {
    it('should not add any fields if not deleted permissions in the role', async () => {
      const after = roleInstance.clone()
      delete after.value.otherField.val1
      const change = toChange({ before: roleInstance, after }) as ModificationChange<InstanceElement>
      const nonRelevantAfter = nonRelevantInstance.clone()
      delete nonRelevantAfter.value.name
      const nonRelevantChange = toChange({
        before: nonRelevantInstance,
        after: nonRelevantAfter,
      }) as ModificationChange<InstanceElement>
      await filterCreator(fetchOpts).onDeploy?.([change, nonRelevantChange], {
        appliedChanges: [],
        errors: [],
      })
      expect(change.data.after.value.otherField.val1).toBeUndefined()
    })
    it('should add the regular permission deleted from the role', async () => {
      const after = roleInstance.clone()
      delete after.value.permissions.permission.TRAN_PAYMENTAUDIT
      const change = toChange({ before: roleInstance, after }) as ModificationChange<InstanceElement>
      await filterCreator(fetchOpts).onDeploy?.([change], {
        appliedChanges: [],
        errors: [],
      })
      expect(change.data.after.value.permissions.permission.TRAN_PAYMENTAUDIT).toEqual(
        change.data.before.value.permissions.permission.TRAN_PAYMENTAUDIT,
      )
    })
    it('should add the custom record permission deleted from the role', async () => {
      const after = roleInstance.clone()
      delete after.value.permissions.permission.customrecord1
      const change = toChange({ before: roleInstance, after }) as ModificationChange<InstanceElement>
      await filterCreator(fetchOpts).onDeploy?.([change], {
        appliedChanges: [],
        errors: [],
      })
      expect(change.data.after.value.permissions.permission.customrecord1).toEqual(
        change.data.before.value.permissions.permission.customrecord1,
      )
    })
    it('should add the whole permissions field deleted from the role', async () => {
      const after = roleInstance.clone()
      delete after.value.permissions
      const change = toChange({ before: roleInstance, after }) as ModificationChange<InstanceElement>
      await filterCreator(fetchOpts).onDeploy?.([change], {
        appliedChanges: [],
        errors: [],
      })
      expect(change.data.after.value.permissions.permission).toBeDefined()
      expect(change.data.after.value.permissions.permission.customrecord1).toEqual(
        change.data.before.value.permissions.permission.customrecord1,
      )
    })
    it('should add the whole permission list deleted from the role', async () => {
      const after = roleInstance.clone()
      delete after.value.permissions.permission
      const change = toChange({ before: roleInstance, after }) as ModificationChange<InstanceElement>
      await filterCreator(fetchOpts).onDeploy?.([change], {
        appliedChanges: [],
        errors: [],
      })
      expect(change.data.after.value.permissions.permission).toBeDefined()
      expect(change.data.after.value.permissions.permission.customrecord1).toEqual(
        change.data.before.value.permissions.permission.customrecord1,
      )
    })
  })
})
