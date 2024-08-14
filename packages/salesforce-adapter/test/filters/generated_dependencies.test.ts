/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  Change,
  CORE_ANNOTATIONS,
  ElemID,
  InstanceElement,
  ObjectType,
  ReferenceExpression,
  toChange,
} from '@salto-io/adapter-api'
import { createCustomObjectType, defaultFilterContext } from '../utils'
import { FilterWith } from './mocks'
import filterCreator from '../../src/filters/generated_dependencies'

describe('Generated dependencies filter', () => {
  let filter: FilterWith<'preDeploy' | 'onDeploy'>

  const generateTypeBefore = (): ObjectType =>
    createCustomObjectType('mock', {
      annotations: {
        [CORE_ANNOTATIONS.GENERATED_DEPENDENCIES]: [
          {
            reference: new ReferenceExpression(new ElemID('salesforce', 'refTypeBefore')),
          },
          {
            reference: new ReferenceExpression(new ElemID('salesforce', 'otherRefType')),
          },
        ],
      },
    })
  const generateTypeAfter = (): ObjectType =>
    createCustomObjectType('mock', {
      annotations: {
        [CORE_ANNOTATIONS.GENERATED_DEPENDENCIES]: [
          {
            reference: new ReferenceExpression(new ElemID('salesforce', 'refType')),
          },
          {
            reference: new ReferenceExpression(new ElemID('salesforce', 'otherRefType')),
          },
        ],
      },
    })
  const generateInstance = (type: ObjectType): InstanceElement =>
    new InstanceElement('inst', type, undefined, undefined, {
      [CORE_ANNOTATIONS.GENERATED_DEPENDENCIES]: [
        {
          reference: new ReferenceExpression(new ElemID('salesforce', 'refType', 'instance', 'inst')),
        },
        {
          reference: new ReferenceExpression(new ElemID('salesforce', 'otherRefType', 'instance', 'inst')),
        },
      ],
    })
  const generateTypeWithNoAnnotations = (): ObjectType => createCustomObjectType('mock', {})
  const generateInstanceWithNoAnnotations = (type: ObjectType): InstanceElement => new InstanceElement('inst', type)

  const generateChanges = (): Change[] => {
    const typeAfter = generateTypeAfter()

    return [
      toChange({ before: generateTypeBefore(), after: typeAfter }),
      toChange({ after: generateInstance(typeAfter) }),
    ]
  }

  const generateChangesWithNoGeneratedDependenciesAfter = (): Change[] => {
    const typeAfter = generateTypeWithNoAnnotations()

    return [
      toChange({ before: generateTypeBefore(), after: typeAfter }),
      toChange({ after: generateInstanceWithNoAnnotations(typeAfter) }),
    ]
  }

  beforeEach(() => {
    filter = filterCreator({ config: defaultFilterContext }) as typeof filter
  })

  describe('preDeploy and onDeploy', () => {
    it('should remove generated dependencies and restore them', async () => {
      const changes = generateChanges()

      await filter.preDeploy(changes)
      expect(changes).toEqual(generateChangesWithNoGeneratedDependenciesAfter())

      await filter.onDeploy(changes)
      expect(changes).toEqual(generateChanges())
    })
  })
})
