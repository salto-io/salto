/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/
import { ObjectType, ElemID, toChange, dependencyChange } from '@salto-io/adapter-api'
import { deployment } from '@salto-io/adapter-components'
import { collections } from '@salto-io/lowerdash'
import { JIRA } from '../../src/constants'
import { dependencyChanger } from '../../src/dependency_changers'

jest.mock('@salto-io/adapter-components', () => {
  const actual = jest.requireActual('@salto-io/adapter-components')
  return {
    ...actual,
    deployment: {
      ...actual.deployment,
      dependency: {
        ...actual.deployment.dependency,
        removeStandaloneFieldDependency: jest.fn().mockResolvedValue([dependencyChange('add', 0, 1)]),
      },
    },
  }
})

describe('dependencyChanger', () => {
  let type: ObjectType
  beforeEach(() => {
    type = new ObjectType({
      elemID: new ElemID(JIRA, 'SomeType'),
    })
  })

  it('should call its dependencies changers', async () => {
    const inputChanges = new Map([[0, toChange({ after: type })]])
    const inputDeps = new Map<collections.set.SetId, Set<collections.set.SetId>>([[0, new Set()]])

    const dependencyChanges = [...(await dependencyChanger(inputChanges, inputDeps))]

    expect(deployment.dependency.removeStandaloneFieldDependency).toHaveBeenCalled()
    expect(dependencyChanges[0].action).toEqual('add')
    expect(dependencyChanges[0].dependency.source).toEqual(0)
    expect(dependencyChanges[0].dependency.target).toEqual(1)
  })
})
