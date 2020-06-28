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
import {
  ElemID, InstanceElement, ObjectType, ReferenceExpression,
} from '@salto-io/adapter-api'
import filterCreator from '../../src/filters/instance_references'
import { customTypes, fileCabinetTypes } from '../../src/types'
import { FILE, PATH, SCRIPT_ID, WORKFLOW } from '../../src/constants'


describe('instance_references filter', () => {
  describe('replace values', () => {
    const fileInstance = new InstanceElement('fileInstance', fileCabinetTypes[FILE], {
      [PATH]: '/Templates/file.name',
    })
    const workflowInstance = new InstanceElement('instanceName', customTypes[WORKFLOW], {
      [SCRIPT_ID]: 'top_level',
      workflowstates: {
        workflowstate: [
          {
            [SCRIPT_ID]: 'one_nesting',
            workflowactions: [
              {
                setfieldvalueaction: [
                  {
                    [SCRIPT_ID]: 'two_nesting',
                  },
                  {
                    [SCRIPT_ID]: 'two_nesting_with_inner_ref',
                    field: '[scriptid=top_level.one_nesting.two_nesting]',
                  },
                ],
              },
            ],
          },
        ],
      },
    })
    const instanceWithRefs = new InstanceElement(
      'instanceName',
      new ObjectType({ elemID: new ElemID('') }),
      {
        refToFilePath: '[/Templates/file.name]',
        refToScriptId: '[scriptid=top_level]',
        refToOneLevelNestedScriptId: '[scriptid=top_level.one_nesting]',
        refToTwoLevelNestedScriptId: '[scriptid=top_level.one_nesting.two_nesting]',
        refToNonExistingScriptId: '[scriptid=non_existing_script_id]',
        refToNonExistingPath: '[/Templates/non.existing]',
      },
    )

    filterCreator().onFetch([fileInstance, workflowInstance, instanceWithRefs])

    it('should replace path references', () => {
      expect(instanceWithRefs.value.refToFilePath)
        .toEqual(new ReferenceExpression(fileInstance.elemID.createNestedID(PATH)))
    })

    it('should replace scriptid references', () => {
      expect(instanceWithRefs.value.refToScriptId)
        .toEqual(new ReferenceExpression(workflowInstance.elemID.createNestedID(SCRIPT_ID)))
    })

    it('should replace scriptid with 1 nesting level references', () => {
      expect(instanceWithRefs.value.refToOneLevelNestedScriptId)
        .toEqual(new ReferenceExpression(workflowInstance.elemID.createNestedID('workflowstates', 'workflowstate', '0', SCRIPT_ID)))
    })

    it('should replace scriptid with 2 nesting level references', () => {
      expect(instanceWithRefs.value.refToTwoLevelNestedScriptId)
        .toEqual(new ReferenceExpression(workflowInstance.elemID.createNestedID('workflowstates', 'workflowstate', '0', 'workflowactions', '0', 'setfieldvalueaction', '0', SCRIPT_ID)))
    })

    it('should replace inner scriptid references', () => {
      expect(workflowInstance.value.workflowstates.workflowstate[0].workflowactions[0]
        .setfieldvalueaction[1].field)
        .toEqual(new ReferenceExpression(workflowInstance.elemID.createNestedID('workflowstates', 'workflowstate', '0', 'workflowactions', '0', 'setfieldvalueaction', '0', SCRIPT_ID)))
    })

    it('should not replace scriptid references for unresolved ref', () => {
      expect(instanceWithRefs.value.refToNonExistingScriptId)
        .toEqual('[scriptid=non_existing_script_id]')
    })

    it('should not replace path references for unresolved ref', () => {
      expect(instanceWithRefs.value.refToNonExistingPath)
        .toEqual('[/Templates/non.existing]')
    })
  })
})
