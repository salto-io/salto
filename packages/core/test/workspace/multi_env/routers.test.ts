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
import { ElemID, Field, BuiltinTypes, ObjectType } from '@salto-io/adapter-api'
import _ from 'lodash'
import { RemovalDiff, ModificationDiff } from '@salto-io/dag'
import { createMockBlueprintSource } from '../../common/blueprint_source'
import { DetailedChange } from '../../../src/core/plan'
import { routeChanges } from '../../../src/workspace/blueprints/mutil_env/routers'

const objectElemID = new ElemID('salto', 'object')
const commonField = new Field(objectElemID, 'commonField', BuiltinTypes.STRING)
const envField = new Field(objectElemID, 'envField', BuiltinTypes.STRING)
const commonObj = new ObjectType({
  elemID: objectElemID,
  fields: {
    commonField,
  },
})
const envObj = new ObjectType({
  elemID: objectElemID,
  fields: {
    envField,
  },
})

const sharedObject = new ObjectType({
  elemID: objectElemID,
  fields: {
    envField,
    commonField,
  },
})

const newObj = new ObjectType({
  elemID: new ElemID('salto', 'new'),
  fields: {
  },
})

const commonSource = createMockBlueprintSource([commonObj, commonField])
const envSource = createMockBlueprintSource([envObj, envField])
const secEnv = createMockBlueprintSource([envObj, envField])

describe('normal fetch routing', () => {
  it('should route add changes to common', async () => {
    const change: DetailedChange = {
      action: 'add',
      data: { after: newObj },
      id: newObj.elemID,
    }
    const routedChanges = await routeChanges([change], envSource, commonSource, {})
    expect(routedChanges.primarySource).toHaveLength(0)
    expect(routedChanges.commonSource).toHaveLength(1)
    expect(routedChanges.commonSource && routedChanges.commonSource[0]).toEqual(change)
    expect(_.isEmpty(routedChanges.secondarySources)).toBeTruthy()
  })

  it('should route common modify changes to common', async () => {
    const change: DetailedChange = {
      action: 'modify',
      data: { before: commonObj, after: commonObj },
      id: commonObj.elemID,
    }
    const routedChanges = await routeChanges([change], envSource, commonSource, {})
    expect(routedChanges.primarySource).toHaveLength(0)
    expect(routedChanges.commonSource).toHaveLength(1)
    expect(routedChanges.commonSource && routedChanges.commonSource[0]).toEqual(change)
    expect(_.isEmpty(routedChanges.secondarySources)).toBeTruthy()
  })
  it('should route env modify changes to env', async () => {
    const change: DetailedChange = {
      action: 'modify',
      data: { before: envObj, after: envObj },
      id: envObj.elemID,
    }
    const routedChanges = await routeChanges([change], envSource, commonSource, {})
    expect(routedChanges.primarySource).toHaveLength(1)
    expect(routedChanges.commonSource).toHaveLength(0)
    expect(routedChanges.primarySource && routedChanges.primarySource[0]).toEqual(change)
    expect(_.isEmpty(routedChanges.secondarySources)).toBeTruthy()
  })
  it('should split shared modify changes to common and env', async () => {
    const change: DetailedChange = {
      action: 'modify',
      data: { before: sharedObject, after: sharedObject },
      id: commonObj.elemID,
    }
    const routedChanges = await routeChanges([change], envSource, commonSource, {})
    expect(routedChanges.primarySource).toHaveLength(1)
    expect(routedChanges.commonSource).toHaveLength(1)
    const commonChangeBeforeElement = routedChanges.commonSource
        && (routedChanges.commonSource[0] as ModificationDiff<ObjectType>).data.before
    const envChangeBeforeElement = routedChanges.primarySource
        && (routedChanges.primarySource[0] as ModificationDiff<ObjectType>).data.before
    expect(commonChangeBeforeElement).toEqual(commonObj)
    expect(envChangeBeforeElement).toEqual(envObj)
    const commonChangeAfterElement = routedChanges.commonSource
        && (routedChanges.commonSource[0] as ModificationDiff<ObjectType>).data.after
    const envChangeAfterElement = routedChanges.primarySource
        && (routedChanges.primarySource[0] as ModificationDiff<ObjectType>).data.after
    expect(commonChangeAfterElement).toEqual(commonObj)
    expect(envChangeAfterElement).toEqual(envObj)
    expect(_.isEmpty(routedChanges.secondarySources)).toBeTruthy()
  })
  it('should route common remove changes to common', async () => {
    const change: DetailedChange = {
      action: 'remove',
      data: { before: commonObj },
      id: commonObj.elemID,
    }
    const routedChanges = await routeChanges([change], envSource, commonSource, {})
    expect(routedChanges.primarySource).toHaveLength(0)
    expect(routedChanges.commonSource).toHaveLength(1)
    expect(routedChanges.commonSource && routedChanges.commonSource[0]).toEqual(change)
    expect(_.isEmpty(routedChanges.secondarySources)).toBeTruthy()
  })
  it('should route env remove changes to env', async () => {
    const change: DetailedChange = {
      action: 'remove',
      data: { before: envObj },
      id: envObj.elemID,
    }
    const routedChanges = await routeChanges([change], envSource, commonSource, {})
    expect(routedChanges.primarySource).toHaveLength(1)
    expect(routedChanges.commonSource).toHaveLength(0)
    expect(routedChanges.primarySource && routedChanges.primarySource[0]).toEqual(change)
    expect(_.isEmpty(routedChanges.secondarySources)).toBeTruthy()
  })
  it('should split shared remove changes to common and env', async () => {
    const change: DetailedChange = {
      action: 'remove',
      data: { before: sharedObject },
      id: commonObj.elemID,
    }
    const routedChanges = await routeChanges([change], envSource, commonSource, {})
    expect(routedChanges.primarySource).toHaveLength(1)
    expect(routedChanges.commonSource).toHaveLength(1)
    const commonChangeElement = routedChanges.commonSource
        && (routedChanges.commonSource[0] as RemovalDiff<ObjectType>).data.before
    const envChangeElement = routedChanges.primarySource
        && (routedChanges.primarySource[0] as RemovalDiff<ObjectType>).data.before
    expect(commonChangeElement).toEqual(commonObj)
    expect(envChangeElement).toEqual(envObj)
    expect(_.isEmpty(routedChanges.secondarySources)).toBeTruthy()
  })
})

describe('compact routing', () => {
  it('should route an add change to env', async () => {
    const change: DetailedChange = {
      action: 'add',
      data: { after: newObj },
      id: newObj.elemID,
    }
    const routedChanges = await routeChanges(
      [change],
      envSource,
      commonSource,
      { sec: secEnv },
      'strict'
    )
    expect(routedChanges.primarySource).toHaveLength(1)
    expect(routedChanges.commonSource).toHaveLength(0)
    expect(_.isEmpty(routedChanges.secondarySources)).toBeTruthy()
    expect(routedChanges.primarySource && routedChanges.primarySource[0]).toEqual(change)
  })
  it('should route an env modification change to env', async () => {
    const change: DetailedChange = {
      action: 'modify',
      data: { before: envObj, after: envObj },
      id: envObj.elemID,
    }
    const routedChanges = await routeChanges(
      [change],
      envSource,
      commonSource,
      { sec: secEnv },
      'strict'
    )
    expect(routedChanges.primarySource).toHaveLength(1)
    expect(routedChanges.commonSource).toHaveLength(0)
    expect(_.isEmpty(routedChanges.secondarySources)).toBeTruthy()
    expect(routedChanges.primarySource && routedChanges.primarySource[0]).toEqual(change)
  })
  it('should route an env remove diff to env', async () => {
    const change: DetailedChange = {
      action: 'remove',
      data: { before: envObj },
      id: envObj.elemID,
    }
    const routedChanges = await routeChanges(
      [change],
      envSource,
      commonSource,
      { sec: secEnv },
      'strict'
    )
    expect(routedChanges.primarySource).toHaveLength(1)
    expect(routedChanges.commonSource).toHaveLength(0)
    expect(_.isEmpty(routedChanges.secondarySources)).toBeTruthy()
    expect(routedChanges.primarySource && routedChanges.primarySource[0]).toEqual(change)
  })
  it('should route a common modification diff to comon and revert the change in secondary envs', async () => {
    const change: DetailedChange = {
      action: 'modify',
      data: { before: sharedObject, after: sharedObject },
      id: sharedObject.elemID,
    }
    const routedChanges = await routeChanges(
      [change],
      envSource,
      commonSource,
      { sec: secEnv },
      'strict'
    )
    expect(routedChanges.primarySource).toHaveLength(2)
    expect(routedChanges.commonSource).toHaveLength(1)
    expect(routedChanges.secondarySources?.sec).toHaveLength(1)
    expect(routedChanges.primarySource && routedChanges.primarySource[0]).toEqual({
      action: 'modify',
      data: { before: envObj, after: envObj },
      id: envObj.elemID,
    })
    expect(routedChanges.primarySource && routedChanges.primarySource[1]).toEqual({
      action: 'add',
      data: { after: commonObj },
      id: commonObj.elemID,
      path: ['test', 'path'],
    })
    expect(routedChanges.commonSource && routedChanges.commonSource[0]).toEqual({
      action: 'remove',
      data: { before: commonObj },
      id: commonObj.elemID,
      path: ['test', 'path'],
    })
    expect(routedChanges.secondarySources?.sec
            && routedChanges.secondarySources?.sec[0]).toEqual({
      action: 'add',
      data: { after: commonObj },
      id: commonObj.elemID,
      path: ['test', 'path'],
    })
  })
  it('should route a removal diff to comon and env and revert the change in secondary envs', async () => {
    const change: DetailedChange = {
      action: 'remove',
      data: { before: sharedObject },
      id: sharedObject.elemID,
    }
    const routedChanges = await routeChanges(
      [change],
      envSource,
      commonSource,
      { sec: secEnv },
      'strict'
    )
    expect(routedChanges.primarySource).toHaveLength(1)
    expect(routedChanges.commonSource).toHaveLength(1)
    expect(routedChanges.secondarySources?.sec).toHaveLength(1)
    expect(routedChanges.primarySource && routedChanges.primarySource[0]).toEqual({
      action: 'remove',
      data: { before: envObj },
      id: envObj.elemID,
    })
    expect(routedChanges.commonSource && routedChanges.commonSource[0]).toEqual({
      action: 'remove',
      data: { before: commonObj },
      id: commonObj.elemID,
      path: ['test', 'path'],
    })
    expect(routedChanges.secondarySources?.sec
            && routedChanges.secondarySources?.sec[0]).toEqual({
      action: 'add',
      data: { after: commonObj },
      id: commonObj.elemID,
      path: ['test', 'path'],
    })
  })
})
