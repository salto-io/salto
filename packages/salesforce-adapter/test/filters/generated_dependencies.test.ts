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
  Change,
  CORE_ANNOTATIONS,
  ElemID,
  InstanceElement,
  ReferenceExpression,
  toChange,
} from '@salto-io/adapter-api'
import { createCustomObjectType, defaultFilterContext } from '../utils'
import { FilterWith } from './mocks'
import filterCreator from '../../src/filters/generated_dependencies'

describe('Generated dependencies filter', () => {
  let filter: FilterWith<'preDeploy' | 'onDeploy'>
  let preDeployChanges: Change[]

  const generateChanges = (): Change[] => {
    const typeBefore = createCustomObjectType('mock', {
      annotations: {
        [CORE_ANNOTATIONS.GENERATED_DEPENDENCIES]: [
          {
            reference: new ReferenceExpression(
              new ElemID('salesforce', 'refTypeBefore'),
            ),
          },
          {
            reference: new ReferenceExpression(
              new ElemID('salesforce', 'otherRefType'),
            ),
          },
        ],
      },
    })
    const typeAfter = createCustomObjectType('mock', {
      annotations: {
        [CORE_ANNOTATIONS.GENERATED_DEPENDENCIES]: [
          {
            reference: new ReferenceExpression(
              new ElemID('salesforce', 'refType'),
            ),
          },
          {
            reference: new ReferenceExpression(
              new ElemID('salesforce', 'otherRefType'),
            ),
          },
        ],
      },
    })
    const instanceToAdd = new InstanceElement(
      'toAdd',
      typeAfter,
      undefined,
      undefined,
      {
        [CORE_ANNOTATIONS.GENERATED_DEPENDENCIES]: [
          {
            reference: new ReferenceExpression(
              new ElemID('salesforce', 'refType', 'instance', 'inst'),
            ),
          },
          {
            reference: new ReferenceExpression(
              new ElemID('salesforce', 'otherRefType', 'instance', 'inst'),
            ),
          },
        ],
      },
    )
    const instanceToRemove = new InstanceElement(
      'toRemove',
      typeBefore,
      undefined,
      undefined,
      {
        [CORE_ANNOTATIONS.GENERATED_DEPENDENCIES]: [
          {
            reference: new ReferenceExpression(
              new ElemID('salesforce', 'refType', 'instance', 'inst'),
            ),
          },
          {
            reference: new ReferenceExpression(
              new ElemID('salesforce', 'otherRefType', 'instance', 'inst'),
            ),
          },
        ],
      },
    )

    return [
      toChange({ before: typeBefore, after: typeAfter }),
      toChange({ after: instanceToAdd }),
      toChange({ before: instanceToRemove }),
    ]
  }

  const generateChangesNoGeneratedDependencies = (): Change[] => {
    const type = createCustomObjectType('mock', {})
    const instanceToAdd = new InstanceElement('toAdd', type)
    const instanceToRemove = new InstanceElement('toRemove', type)

    return [
      toChange({ before: type, after: type }),
      toChange({ after: instanceToAdd }),
      toChange({ before: instanceToRemove }),
    ]
  }

  const runPreDeploy = async (...changes: Change[]): Promise<Change[]> => {
    await filter.preDeploy(changes)
    return changes
  }

  const runOnDeploy = async (...changes: Change[]): Promise<Change[]> => {
    await filter.onDeploy(changes)
    return changes
  }

  beforeAll(() => {
    filter = filterCreator({ config: defaultFilterContext }) as typeof filter
  })

  describe('preDeploy', () => {
    it('should remove generated dependencies', async () => {
      preDeployChanges = await runPreDeploy(...generateChanges())
      expect(preDeployChanges).toEqual(generateChangesNoGeneratedDependencies())
    })
  })

  describe('onDeploy', () => {
    it('should restore generated dependencies', async () => {
      const onDeployChanges = await runOnDeploy(...preDeployChanges)
      expect(onDeployChanges).toEqual(generateChanges())
    })
  })
})
