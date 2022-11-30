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

import { ElemID, InstanceElement, isObjectType, ObjectType } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { createEmptyElementsSourceIndexes, getDefaultAdapterConfig } from '../utils'
import { FilterOpts } from '../../src/filter'
import NetsuiteClient from '../../src/client/client'
import { reportdefinitionType } from '../../src/autogen/types/standard_types/reportdefinition'
import filterCreator from '../../src/filters/parse_report_definition'
import { REPORT_DEFINITION } from '../../src/constants'

jest.mock('../../src/report_definition_parsing/report_definition_parser', () => ({
  parseDefinition: jest.fn().mockResolvedValue({
    test: 'test',
  }),
}))

describe('parse report definition filtere', () => {
  let instance: InstanceElement
  let sourceInstance: InstanceElement
  let fetchOpts: FilterOpts

  describe('onFetch', () => {
    beforeEach(async () => {
      fetchOpts = {
        client: {} as NetsuiteClient,
        elementsSourceIndex: {
          getIndexes: () => Promise.resolve(createEmptyElementsSourceIndexes()),
        },
        elementsSource: buildElementsSourceFromElements([]),
        isPartial: false,
        config: await getDefaultAdapterConfig(),
      }
      const reportdefinition = reportdefinitionType().type
      instance = new InstanceElement('testReportDefinition', reportdefinition, {})
      sourceInstance = new InstanceElement('testReportDefinition', reportdefinition, {})
      instance.value.definition = 'instanceDefintion'
      sourceInstance.value.definition = 'sourceDefinition'
    })
    it('should remove old report definition type', async () => {
      const oldType = new ObjectType({ elemID: new ElemID('netsuite', 'reportdefinition'), fields: {} })
      const elements = [oldType]
      await filterCreator(fetchOpts).onFetch?.(elements)
      expect(elements.filter(isObjectType)
        .filter(e => e.elemID.typeName === REPORT_DEFINITION))
        .not.toEqual(oldType)
    })
    it('should remove double dependency type', async () => {
      const dependencyType = new ObjectType({ elemID: new ElemID('netsuite', 'reportdefinition_dependency'), fields: {} })
      const elements = [dependencyType]
      await filterCreator(fetchOpts).onFetch?.(elements)
      expect(elements.filter(isObjectType)
        .filter(e => e.elemID.typeName === REPORT_DEFINITION))
        .not.toEqual(dependencyType)
    })
    it('should add parsed definition values to instance', async () => {
      await filterCreator(fetchOpts).onFetch?.([instance])
      expect(instance.value.test).toEqual('test')
    })
    it('should change definition to sourceInstance definition', async () => {
      fetchOpts.elementsSource = buildElementsSourceFromElements([sourceInstance])
      await filterCreator(fetchOpts).onFetch?.([instance])
      expect(instance.value.definition).toEqual('sourceDefinition')
    })
  })
})
