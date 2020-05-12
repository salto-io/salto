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
import { ElemID, Field, BuiltinTypes, ObjectType, ListType, InstanceElement } from '@salto-io/adapter-api'
import _ from 'lodash'
import { RemovalDiff, ModificationDiff } from '@salto-io/dag'
import { createMockNaclFileSource } from '../../common/nacl_file_source'
import { DetailedChange } from '../../../src/core/plan'
import { routeChanges } from '../../../src/workspace/nacl_files/mutil_env/routers'

const objectElemID = new ElemID('salto', 'object')
const commonField = { name: 'commonField', type: BuiltinTypes.STRING }
const envField = { name: 'envField', type: BuiltinTypes.STRING }
const simpleObjID = new ElemID('salto', 'simple')
const simpleObj = new ObjectType({
  elemID: simpleObjID,
  annotationTypes: {
    str1: BuiltinTypes.STRING,
    str2: BuiltinTypes.STRING,
  },
})
const listField = { name: 'listField', type: new ListType(simpleObj) }
const commonObj = new ObjectType({
  elemID: objectElemID,
  annotationTypes: {
    boolean: BuiltinTypes.BOOLEAN,
  },
  annotations: {
    boolean: false,
  },
  fields: [
    commonField,
    listField,
  ],
})
const envObj = new ObjectType({
  elemID: objectElemID,
  fields: [
    envField,
  ],
})
const sharedObject = new ObjectType({
  elemID: objectElemID,
  annotationTypes: {
    boolean: BuiltinTypes.BOOLEAN,
  },
  annotations: {
    boolean: false,
  },
  fields: [
    envField,
    commonField,
    listField,
  ],
})

const newObj = new ObjectType({ elemID: new ElemID('salto', 'new') })

const commonInstance = new InstanceElement('commonInst', commonObj, {
  commonField: 'commonField',
  listField: [{
    str1: 'STR_1',
  }],
})
const splitObjectID = new ElemID('salto', 'split')
const splitObjectFields = new ObjectType({
  elemID: splitObjectID,
  fields: Object.values(commonObj.fields),
})
const splitObjectAnnotations = new ObjectType({
  elemID: splitObjectID,
  annotations: commonObj.annotations,
})
const splitObjectAnnotationTypes = new ObjectType({
  elemID: splitObjectID,
  annotationTypes: commonObj.annotationTypes,
})
const splitObjJoined = new ObjectType({
  elemID: splitObjectID,
  fields: Object.values(splitObjectFields.fields),
  annotationTypes: splitObjectAnnotationTypes.annotationTypes,
  annotations: splitObjectAnnotations.annotations,
})
const splitInstName = 'splitInst'
const splitInstance1 = new InstanceElement(
  splitInstName,
  commonObj,
  {
    commonField: 'STR',
  }
)
const splitInstance2 = new InstanceElement(
  splitInstName,
  commonObj,
  {
    listField: ['STR'],
  }
)
const splitInstanceJoined = new InstanceElement(
  splitInstName,
  commonObj,
  {
    ...splitInstance1.value,
    ...splitInstance2.value,
  }
)
const commonSource = createMockNaclFileSource(
  [commonObj, commonInstance, splitObjJoined, splitInstanceJoined],
  {
    'test/path.nacl': [commonObj, commonInstance],
    'test/anno.nacl': [splitObjectAnnotations],
    'test/annoTypes.nacl': [splitObjectAnnotationTypes],
    'test/fields.nacl': [splitObjectFields],
    'test/inst1.nacl': [splitInstance1],
    'test/inst2.nacl': [splitInstance2],
  }
)
const envOnlyID = new ElemID('salto', 'envOnly')
const envOnlyObj = new ObjectType({ elemID: envOnlyID })
const envSource = createMockNaclFileSource([envObj, envOnlyObj])
const secEnv = createMockNaclFileSource([envObj])

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
  it('should route add changes of values of env specific elements to the env', async () => {
    const newField = new Field(envOnlyObj, 'dreams', BuiltinTypes.STRING)
    const change: DetailedChange = {
      action: 'add',
      data: { after: newField },
      id: newField.elemID,
    }
    const routedChanges = await routeChanges([change], envSource, commonSource, {})
    expect(routedChanges.primarySource).toHaveLength(1)
    expect(routedChanges.commonSource).toHaveLength(0)
    expect(routedChanges.primarySource && routedChanges.primarySource[0]).toEqual(change)
    expect(_.isEmpty(routedChanges.secondarySources)).toBeTruthy()
  })
  it('should route add changes of values of common elements to the common', async () => {
    const newField = new Field(commonObj, 'dreams', BuiltinTypes.STRING)
    const change: DetailedChange = {
      action: 'add',
      data: { after: newField },
      id: newField.elemID,
    }
    const routedChanges = await routeChanges([change], envSource, commonSource, {})
    expect(routedChanges.commonSource).toHaveLength(1)
    expect(routedChanges.primarySource).toHaveLength(0)
    expect(routedChanges.commonSource && routedChanges.commonSource[0]).toEqual(change)
    expect(_.isEmpty(routedChanges.secondarySources)).toBeTruthy()
  })
  it('should route add changes of values of split elements to the common', async () => {
    const newField = new Field(splitObjJoined, 'dreams', BuiltinTypes.STRING)
    const change: DetailedChange = {
      action: 'add',
      data: { after: newField },
      id: newField.elemID,
    }
    const routedChanges = await routeChanges([change], envSource, commonSource, {})
    expect(routedChanges.commonSource).toHaveLength(1)
    expect(routedChanges.primarySource).toHaveLength(0)
    expect(routedChanges.commonSource && routedChanges.commonSource[0]).toEqual(change)
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
      'isolated'
    )
    expect(routedChanges.primarySource).toHaveLength(1)
    expect(routedChanges.commonSource).toHaveLength(0)
    expect(_.isEmpty(routedChanges.secondarySources)).toBeTruthy()
    expect(routedChanges.primarySource && routedChanges.primarySource[0])
      .toEqual(change)
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
      'isolated'
    )
    expect(routedChanges.primarySource).toHaveLength(1)
    expect(routedChanges.commonSource).toHaveLength(0)
    expect(_.isEmpty(routedChanges.secondarySources)).toBeTruthy()
    expect(routedChanges.primarySource && routedChanges.primarySource[0])
      .toEqual(change)
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
      'isolated'
    )
    expect(routedChanges.primarySource).toHaveLength(1)
    expect(routedChanges.commonSource).toHaveLength(0)
    expect(_.isEmpty(routedChanges.secondarySources)).toBeTruthy()
    expect(routedChanges.primarySource && routedChanges.primarySource[0])
      .toEqual(change)
  })
  it('should route a common modification diff to comon and revert the change in secondary envs', async () => {
    const change: DetailedChange = {
      action: 'modify',
      data: { before: sharedObject, after: sharedObject },
      id: sharedObject.elemID,
    }
    const specificChange: DetailedChange = {
      action: 'modify',
      data: { before: true, after: false },
      id: objectElemID.createNestedID('attr').createNestedID('boolean'),
    }
    const routedChanges = await routeChanges(
      [change, specificChange],
      envSource,
      commonSource,
      { sec: secEnv },
      'isolated'
    )
    expect(routedChanges.primarySource).toHaveLength(3)
    expect(routedChanges.commonSource).toHaveLength(2)
    expect(routedChanges.secondarySources?.sec).toHaveLength(2)
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
    expect(routedChanges.primarySource && routedChanges.primarySource[2]).toEqual({
      action: 'add',
      data: { after: false },
      id: sharedObject.elemID.createNestedID('attr').createNestedID('boolean'),
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
  it('should route a common removal diff to comon and revert the change in secondary envs', async () => {
    const splitObjChange: DetailedChange = {
      action: 'remove',
      data: { before: splitObjJoined },
      id: splitObjectID,
    }
    const splitInstChange: DetailedChange = {
      action: 'remove',
      data: { before: splitInstanceJoined },
      id: splitInstanceJoined.elemID,
    }
    const routedChanges = await routeChanges(
      [splitObjChange, splitInstChange],
      envSource,
      commonSource,
      { sec: secEnv },
      'isolated'
    )
    expect(routedChanges.primarySource).toHaveLength(0)
    expect(routedChanges.commonSource).toHaveLength(2)
    expect(routedChanges.commonSource && routedChanges.commonSource[0].action).toEqual('remove')
    expect(routedChanges.commonSource && routedChanges.commonSource[0].id)
      .toEqual(splitObjectID)
    expect(routedChanges.commonSource && routedChanges.commonSource[1].action).toEqual('remove')
    expect(routedChanges.commonSource && routedChanges.commonSource[1].id)
      .toEqual(splitInstanceJoined.elemID)

    const secChanges = routedChanges.secondarySources?.sec
    expect(secChanges).toHaveLength(5)
    expect(secChanges && secChanges[0]).toEqual({
      action: 'add',
      id: splitObjectID,
      data: { after: splitObjectAnnotations },
      path: ['test', 'anno'],
    })
    expect(secChanges && secChanges[1]).toEqual({
      action: 'add',
      id: splitObjectID,
      data: { after: splitObjectAnnotationTypes },
      path: ['test', 'annoTypes'],
    })
    expect(secChanges && secChanges[2]).toEqual({
      action: 'add',
      id: splitObjectID,
      data: { after: splitObjectFields },
      path: ['test', 'fields'],
    })
    expect(secChanges && secChanges[3]).toEqual({
      action: 'add',
      id: splitInstanceJoined.elemID,
      data: { after: splitInstance1 },
      path: ['test', 'inst1'],
    })
    expect(secChanges && secChanges[4]).toEqual({
      action: 'add',
      id: splitInstanceJoined.elemID,
      data: { after: splitInstance2 },
      path: ['test', 'inst2'],
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
      'isolated'
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

  it('should merge non mergeable changes into one mergeable change', async () => {
    const removeChange: DetailedChange = {
      action: 'remove',
      data: { before: 'STR_1' },
      id: commonInstance.elemID.createNestedID('0').createNestedID('str1'),
    }
    const addChange: DetailedChange = {
      action: 'add',
      data: { after: 'STR_2' },
      id: commonInstance.elemID.createNestedID('0').createNestedID('str2'),
    }
    const routedChanges = await routeChanges(
      [removeChange, addChange],
      envSource,
      commonSource,
      { sec: secEnv },
      'isolated'
    )
    expect(routedChanges.primarySource).toHaveLength(1)
    const primaryChange = routedChanges.primarySource && routedChanges.primarySource[0]
    expect(primaryChange).toEqual({
      action: 'add',
      id: commonInstance.elemID,
      data: {
        after: new InstanceElement('commonInst', commonObj, {
          commonField: 'commonField',
          listField: [{
            str1: 'STR_1',
          }],
        }),
      },
      path: ['test', 'path'],
    })
    expect(routedChanges.commonSource).toHaveLength(1)
    const commonChange = routedChanges.commonSource && routedChanges.commonSource[0]
    expect(commonChange).toEqual({
      action: 'remove',
      id: commonInstance.elemID,
      data: {
        before: commonInstance,
      },
      path: ['test', 'path'],
    })
  })
})
