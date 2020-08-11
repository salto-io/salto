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
import _ from 'lodash'
import { ElemID, Field, BuiltinTypes, ObjectType, ListType, InstanceElement, DetailedChange } from '@salto-io/adapter-api'
import { ModificationDiff, RemovalDiff } from '@salto-io/dag/dist'
import { createMockNaclFileSource } from '../../common/nacl_file_source'
import { routeChanges, routePromote, routeDemote, routeCopyTo } from '../../../src/workspace/nacl_files/multi_env/routers'


const hasChanges = (
  changes: DetailedChange[],
  lookup: {action: string; id: ElemID}[]
): boolean => _.every(lookup.map(changeToFind => changes
  .find(c => changeToFind.id.isEqual(c.id) && changeToFind.action === c.action)))

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
  fields: {
    commonField,
    listField,
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
  annotationTypes: {
    boolean: BuiltinTypes.BOOLEAN,
  },
  annotations: {
    boolean: false,
  },
  fields: {
    envField,
    commonField,
    listField,
  },
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
  fields: commonObj.fields,
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
  fields: splitObjectFields.fields,
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

describe('default fetch routing', () => {
  it('should route add changes to common when there is only one configured env', async () => {
    const change: DetailedChange = {
      action: 'add',
      data: { after: newObj },
      id: newObj.elemID,
    }
    const routedChanges = await routeChanges([change], envSource, commonSource, {}, 'default')
    expect(routedChanges.primarySource).toHaveLength(0)
    expect(routedChanges.commonSource).toHaveLength(1)
    expect(routedChanges.commonSource && routedChanges.commonSource[0]).toEqual(change)
    expect(_.isEmpty(routedChanges.secondarySources)).toBeTruthy()
  })

  it('should route add changes to primary env when there are more then one configured env', async () => {
    const change: DetailedChange = {
      action: 'add',
      data: { after: newObj },
      id: newObj.elemID,
    }
    const routedChanges = await routeChanges([change], envSource, commonSource, { sec: secEnv }, 'default')
    expect(routedChanges.primarySource).toHaveLength(1)
    expect(routedChanges.commonSource).toHaveLength(0)
    expect(routedChanges.primarySource && routedChanges.primarySource[0]).toEqual(change)
    expect(_.isEmpty(routedChanges.secondarySources)).toBeTruthy()
  })

  it('should route common modify changes to common', async () => {
    const change: DetailedChange = {
      action: 'modify',
      data: { before: commonObj, after: commonObj },
      id: commonObj.elemID,
    }
    const routedChanges = await routeChanges([change], envSource, commonSource, {}, 'override')
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
    const routedChanges = await routeChanges([change], envSource, commonSource, {}, 'default')
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
    const routedChanges = await routeChanges([change], envSource, commonSource, {}, 'default')
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
    const routedChanges = await routeChanges([change], envSource, commonSource, {}, 'default')
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
    const routedChanges = await routeChanges([change], envSource, commonSource, {}, 'default')
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
    const routedChanges = await routeChanges([change], envSource, commonSource, {}, 'default')
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
  it('should route add changes of values of env specific elements to the '
    + 'env when there are multiple envs configured', async () => {
    const newField = new Field(envOnlyObj, 'dreams', BuiltinTypes.STRING)
    const change: DetailedChange = {
      action: 'add',
      data: { after: newField },
      id: newField.elemID,
    }
    const routedChanges = await routeChanges([change], envSource, commonSource, { sec: secEnv }, 'default')
    expect(routedChanges.primarySource).toHaveLength(1)
    expect(routedChanges.commonSource).toHaveLength(0)
    expect(routedChanges.primarySource && routedChanges.primarySource[0]).toEqual(change)
    expect(_.isEmpty(routedChanges.secondarySources)).toBeTruthy()
  })
  it('should route add changes of values of env specific elements to the '
    + 'env when there is only one env configured', async () => {
    const newField = new Field(envOnlyObj, 'dreams', BuiltinTypes.STRING)
    const change: DetailedChange = {
      action: 'add',
      data: { after: newField },
      id: newField.elemID,
    }
    const routedChanges = await routeChanges([change], envSource, commonSource, {}, 'default')
    expect(routedChanges.primarySource).toHaveLength(1)
    expect(routedChanges.commonSource).toHaveLength(0)
    expect(routedChanges.primarySource && routedChanges.primarySource[0]).toEqual(change)
    expect(_.isEmpty(routedChanges.secondarySources)).toBeTruthy()
  })
  it('should route add changes of values of common elements to the primary env', async () => {
    const newField = new Field(commonObj, 'dreams', BuiltinTypes.STRING)
    const change: DetailedChange = {
      action: 'add',
      data: { after: newField },
      id: newField.elemID,
    }
    const routedChanges = await routeChanges([change], envSource, commonSource, {}, 'default')
    expect(routedChanges.commonSource).toHaveLength(0)
    expect(routedChanges.primarySource).toHaveLength(1)
    expect(routedChanges.primarySource && routedChanges.primarySource[0]).toEqual(change)
    expect(_.isEmpty(routedChanges.secondarySources)).toBeTruthy()
  })
  it('should route add changes of values of split elements to the common when there is only one env', async () => {
    const newField = new Field(splitObjJoined, 'dreams', BuiltinTypes.STRING)
    const change: DetailedChange = {
      action: 'add',
      data: { after: newField },
      id: newField.elemID,
    }
    const routedChanges = await routeChanges([change], envSource, commonSource, {}, 'default')
    expect(routedChanges.commonSource).toHaveLength(1)
    expect(routedChanges.primarySource).toHaveLength(0)
    expect(routedChanges.commonSource && routedChanges.commonSource[0]).toEqual(change)
    expect(_.isEmpty(routedChanges.secondarySources)).toBeTruthy()
  })
})

describe('align fetch routing', () => {
  it('should route add changes to common', async () => {
    const change: DetailedChange = {
      action: 'add',
      data: { after: newObj },
      id: newObj.elemID,
    }
    const routedChanges = await routeChanges([change], envSource, commonSource, {}, 'align')
    expect(routedChanges.primarySource).toHaveLength(1)
    expect(routedChanges.commonSource).toHaveLength(0)
    expect(routedChanges.primarySource && routedChanges.primarySource[0]).toEqual(change)
    expect(_.isEmpty(routedChanges.secondarySources)).toBeTruthy()
  })

  it('should drop common modify changes', async () => {
    const change: DetailedChange = {
      action: 'modify',
      data: { before: commonObj, after: commonObj },
      id: commonObj.elemID,
    }
    const routedChanges = await routeChanges([change], envSource, commonSource, {}, 'align')
    expect(routedChanges.primarySource).toHaveLength(0)
    expect(routedChanges.commonSource).toHaveLength(0)
    expect(_.isEmpty(routedChanges.secondarySources)).toBeTruthy()
  })

  it('should route env modify changes to env', async () => {
    const change: DetailedChange = {
      action: 'modify',
      data: { before: envObj, after: envObj },
      id: envObj.elemID,
    }
    const routedChanges = await routeChanges([change], envSource, commonSource, {}, 'align')
    expect(routedChanges.primarySource).toHaveLength(1)
    expect(routedChanges.commonSource).toHaveLength(0)
    expect(routedChanges.primarySource && routedChanges.primarySource[0]).toEqual(change)
    expect(_.isEmpty(routedChanges.secondarySources)).toBeTruthy()
  })

  it('should split shared modify changes and drop the common part', async () => {
    const change: DetailedChange = {
      action: 'modify',
      data: { before: sharedObject, after: sharedObject },
      id: commonObj.elemID,
    }
    const routedChanges = await routeChanges([change], envSource, commonSource, {}, 'align')
    expect(routedChanges.primarySource).toHaveLength(1)
    expect(routedChanges.commonSource).toHaveLength(0)
    const envChangeBeforeElement = routedChanges.primarySource
        && (routedChanges.primarySource[0] as ModificationDiff<ObjectType>).data.before
    expect(envChangeBeforeElement).toEqual(envObj)
    const envChangeAfterElement = routedChanges.primarySource
        && (routedChanges.primarySource[0] as ModificationDiff<ObjectType>).data.after
    expect(envChangeAfterElement).toEqual(envObj)
    expect(_.isEmpty(routedChanges.secondarySources)).toBeTruthy()
  })
  it('should drop common remove changes', async () => {
    const change: DetailedChange = {
      action: 'remove',
      data: { before: commonObj },
      id: commonObj.elemID,
    }
    const routedChanges = await routeChanges([change], envSource, commonSource, {}, 'align')
    expect(routedChanges.primarySource).toHaveLength(0)
    expect(routedChanges.commonSource).toHaveLength(0)
    expect(_.isEmpty(routedChanges.secondarySources)).toBeTruthy()
  })
  it('should route env remove changes to env', async () => {
    const change: DetailedChange = {
      action: 'remove',
      data: { before: envObj },
      id: envObj.elemID,
    }
    const routedChanges = await routeChanges([change], envSource, commonSource, {}, 'align')
    expect(routedChanges.primarySource).toHaveLength(1)
    expect(routedChanges.commonSource).toHaveLength(0)
    expect(routedChanges.primarySource && routedChanges.primarySource[0]).toEqual(change)
    expect(_.isEmpty(routedChanges.secondarySources)).toBeTruthy()
  })
  it('should split shared remove changes and drop common part', async () => {
    const change: DetailedChange = {
      action: 'remove',
      data: { before: sharedObject },
      id: commonObj.elemID,
    }
    const routedChanges = await routeChanges([change], envSource, commonSource, {}, 'align')
    expect(routedChanges.primarySource).toHaveLength(1)
    expect(routedChanges.commonSource).toHaveLength(0)
    const envChangeElement = routedChanges.primarySource
        && (routedChanges.primarySource[0] as RemovalDiff<ObjectType>).data.before
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
    const routedChanges = await routeChanges([change], envSource, commonSource, {}, 'align')
    expect(routedChanges.primarySource).toHaveLength(1)
    expect(routedChanges.commonSource).toHaveLength(0)
    expect(routedChanges.primarySource && routedChanges.primarySource[0]).toEqual(change)
    expect(_.isEmpty(routedChanges.secondarySources)).toBeTruthy()
  })
  it('should route add changes of values of common elements to env', async () => {
    const newField = new Field(commonObj, 'dreams', BuiltinTypes.STRING)
    const change: DetailedChange = {
      action: 'add',
      data: { after: newField },
      id: newField.elemID,
    }
    const routedChanges = await routeChanges([change], envSource, commonSource, {}, 'align')
    expect(routedChanges.commonSource).toHaveLength(0)
    expect(routedChanges.primarySource).toHaveLength(1)
    expect(routedChanges.primarySource && routedChanges.primarySource[0]).toEqual(change)
    expect(_.isEmpty(routedChanges.secondarySources)).toBeTruthy()
  })
})

describe('override fetch routing', () => {
  it('should route add changes to common', async () => {
    const change: DetailedChange = {
      action: 'add',
      data: { after: newObj },
      id: newObj.elemID,
    }
    const routedChanges = await routeChanges([change], envSource, commonSource, {}, 'override')
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
    const routedChanges = await routeChanges([change], envSource, commonSource, {}, 'override')
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
    const routedChanges = await routeChanges([change], envSource, commonSource, {}, 'override')
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
    const routedChanges = await routeChanges([change], envSource, commonSource, {}, 'override')
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
    const routedChanges = await routeChanges([change], envSource, commonSource, {}, 'override')
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
    const routedChanges = await routeChanges([change], envSource, commonSource, {}, 'override')
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
    const routedChanges = await routeChanges([change], envSource, commonSource, {}, 'override')
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
    const routedChanges = await routeChanges([change], envSource, commonSource, {}, 'override')
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
    const routedChanges = await routeChanges([change], envSource, commonSource, {}, 'override')
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
    const routedChanges = await routeChanges([change], envSource, commonSource, {}, 'override')
    expect(routedChanges.commonSource).toHaveLength(1)
    expect(routedChanges.primarySource).toHaveLength(0)
    expect(routedChanges.commonSource && routedChanges.commonSource[0]).toEqual(change)
    expect(_.isEmpty(routedChanges.secondarySources)).toBeTruthy()
  })
})

describe('isolated routing', () => {
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

describe('track', () => {
  const onlyInEnvObj = new ObjectType({
    elemID: new ElemID('salto', 'onlyInEnvObj'),
    fields: {
      str: {
        type: BuiltinTypes.STRING,
      },
      num: {
        type: BuiltinTypes.NUMBER,
      },
    },
    annotations: {
      str: 'STR',
    },
  })

  const splitObjEnv = new ObjectType({
    elemID: new ElemID('salto', 'splitObj'),
    fields: {
      envField: {
        type: BuiltinTypes.STRING,
        annotations: {
          here: {
            we: {
              go: 'again',
            },
          },
        },
      },
      splitField: {
        type: BuiltinTypes.STRING,
        annotations: {
          env: 'ENV',
        },
      },
    },
    annotationTypes: {
      env: BuiltinTypes.STRING,
    },
    annotations: {
      env: 'ENV',
      split: {
        env: 'ENV',
      },
    },
  })

  const splitObjCommon = new ObjectType({
    elemID: new ElemID('salto', 'splitObj'),
    fields: {
      commonField: {
        type: BuiltinTypes.STRING,
        annotations: {
          here: {
            we: {
              go: 'again',
            },
          },
        },
      },
      splitField: {
        type: BuiltinTypes.STRING,
        annotations: {
          common: 'COMMON',
        },
      },
    },
    annotationTypes: {
      common: BuiltinTypes.STRING,
    },
    annotations: {
      common: 'COMMON',
      split: {
        common: 'COMMON',
      },
    },
  })

  const multiFileInstaceDefault = new InstanceElement('split', onlyInEnvObj, {
    default: 'DEFAULT',
  })
  const multiFileInstaceOther = new InstanceElement('split', onlyInEnvObj, {
    other: 'OTHER',
  })
  const multiFileInstace = new InstanceElement('split', onlyInEnvObj, {
    other: 'OTHER',
    default: 'DEFAULT',
  })

  const inSecObject = new ObjectType({
    elemID: new ElemID('salto', 'inSec'),
  })
  const primaryElements = [onlyInEnvObj, splitObjEnv, multiFileInstace, inSecObject]
  const secondaryElements = [inSecObject]
  const commonElements = [splitObjCommon]

  const primarySrc = createMockNaclFileSource(
    primaryElements,
    {
      'default.nacl': [onlyInEnvObj, splitObjEnv, multiFileInstaceDefault, inSecObject],
      'other.nacl': [multiFileInstaceOther],
    }
  )
  const commonSrc = createMockNaclFileSource(commonElements, { 'default.nacl': commonElements })
  const secondarySources = {
    sec: createMockNaclFileSource(secondaryElements, { 'default.nacl': secondaryElements }),
  }

  it('should move an entire element which does not exists in the common', async () => {
    const changes = await routePromote(
      [onlyInEnvObj.elemID],
      primarySrc,
      commonSrc,
      secondarySources
    )
    expect(changes.primarySource).toHaveLength(1)
    expect(changes.commonSource).toHaveLength(1)
    expect(changes.secondarySources?.sec).toHaveLength(0)
    const primaryChange = changes.primarySource && changes.primarySource[0]
    const commonChange = changes.commonSource && changes.commonSource[0]
    expect(primaryChange?.id).toEqual(onlyInEnvObj.elemID)
    expect(primaryChange?.action).toEqual('remove')
    expect(commonChange?.id).toEqual(onlyInEnvObj.elemID)
    expect(commonChange?.action).toEqual('add')
    expect(commonChange?.data).toEqual({ after: onlyInEnvObj })
  })

  it('should create detailed changes when an element fragment is present in the common source', async () => {
    const changes = await routePromote(
      [splitObjEnv.elemID],
      primarySrc,
      commonSrc,
      secondarySources
    )
    expect(changes.primarySource).toHaveLength(1)
    expect(changes.commonSource).toHaveLength(5)
    expect(hasChanges(changes.commonSource || [], [
      { action: 'add', id: splitObjEnv.elemID.createNestedID('annotation', 'env') },
      { action: 'add', id: splitObjEnv.elemID.createNestedID('attr', 'split', 'env') },
      { action: 'add', id: splitObjEnv.elemID.createNestedID('attr', 'env') },
      { action: 'add', id: splitObjEnv.fields.envField.elemID },
      { action: 'add', id: splitObjEnv.fields.splitField.elemID.createNestedID('env') },
    ])).toBeTruthy()
  })

  it('should wrap nested ids in an object when moving nested ids of an element with no common fragment', async () => {
    const changes = await routePromote(
      [
        onlyInEnvObj.fields.str.elemID,
        onlyInEnvObj.elemID.createNestedID('attr', 'str'),
      ],
      primarySrc,
      commonSrc,
      secondarySources
    )
    expect(changes.primarySource).toHaveLength(2)
    expect(changes.commonSource).toHaveLength(1)
    expect(hasChanges(changes.commonSource || [], [
      { action: 'add', id: onlyInEnvObj.elemID },
    ])).toBeTruthy()
  })

  it('should create detailed changes without wrapping the element if the element has fragments in common', async () => {
    const changes = await routePromote(
      [
        splitObjEnv.fields.envField.elemID,
        splitObjEnv.elemID.createNestedID('attr', 'env'),
      ],
      primarySrc,
      commonSrc,
      secondarySources
    )
    expect(changes.primarySource).toHaveLength(2)
    expect(changes.commonSource).toHaveLength(2)
    expect(hasChanges(changes.commonSource || [], [
      { action: 'add', id: splitObjEnv.fields.envField.elemID },
      { action: 'add', id: splitObjEnv.elemID.createNestedID('attr', 'env') },
    ])).toBeTruthy()
  })

  it('should maintain file structure when moving an element to common', async () => {
    const changes = await routePromote(
      [multiFileInstace.elemID],
      primarySrc,
      commonSrc,
      secondarySources
    )
    expect(changes.primarySource).toHaveLength(1)
    expect(changes.commonSource).toHaveLength(2)
    expect(changes.commonSource).toEqual([
      { action: 'add',
        id: multiFileInstace.elemID,
        path: ['default'],
        data: { after: multiFileInstaceDefault } },
      { action: 'add',
        id: multiFileInstace.elemID,
        path: ['other'],
        data: { after: multiFileInstaceOther } },
    ])
  })

  it('should delete the elements in all secondrary envs as well', async () => {
    const changes = await routePromote(
      [inSecObject.elemID],
      primarySrc,
      commonSrc,
      secondarySources
    )
    expect(changes.primarySource).toHaveLength(1)
    expect(changes.commonSource).toHaveLength(1)
    expect(changes.secondarySources?.sec).toHaveLength(1)
  })
})

describe('untrack', () => {
  const onlyInCommon = new ObjectType({
    elemID: new ElemID('salto', 'onlyInCommonObj'),
    fields: {
      str: {
        type: BuiltinTypes.STRING,
      },
      num: {
        type: BuiltinTypes.NUMBER,
      },
    },
    annotations: {
      str: 'STR',
    },
  })

  const splitObjEnv = new ObjectType({
    elemID: new ElemID('salto', 'splitObj'),
    fields: {
      envField: {
        type: BuiltinTypes.STRING,
        annotations: {
          here: {
            we: {
              go: 'again',
            },
          },
        },
      },
      splitField: {
        type: BuiltinTypes.STRING,
        annotations: {
          env: 'ENV',
        },
      },
    },
    annotationTypes: {
      env: BuiltinTypes.STRING,
    },
    annotations: {
      env: 'ENV',
      split: {
        env: 'ENV',
      },
    },
  })

  const splitObjCommon = new ObjectType({
    elemID: new ElemID('salto', 'splitObj'),
    fields: {
      commonField: {
        type: BuiltinTypes.STRING,
        annotations: {
          here: {
            we: {
              go: 'again',
            },
          },
        },
      },
      splitField: {
        type: BuiltinTypes.STRING,
        annotations: {
          common: 'COMMON',
        },
      },
    },
    annotationTypes: {
      common: BuiltinTypes.STRING,
    },
    annotations: {
      common: 'COMMON',
      split: {
        common: 'COMMON',
      },
    },
  })

  const missingFromPrimCommon = new InstanceElement('missingPrim', onlyInCommon, {
    common: 'COMMON',
  })

  const missingFromPrimSec = new InstanceElement('missingPrim', onlyInCommon, {
    sec: 'SEC',
  })

  const multiFileCommon = new InstanceElement('multiFile', onlyInCommon, {
    default: 'DEAFULT',
    other: 'OTHER',
  })

  const multiFileCommonDefault = new InstanceElement('multiFile', onlyInCommon, {
    default: 'DEAFULT',
  })

  const multiFileCommonOther = new InstanceElement('multiFile', onlyInCommon, {
    other: 'OTHER',
  })


  const primaryElements = [splitObjEnv]
  const secondaryElements = [splitObjEnv, missingFromPrimSec]
  const commonElements = [onlyInCommon, splitObjCommon, missingFromPrimCommon, multiFileCommon]

  const primarySrc = createMockNaclFileSource(
    primaryElements,
    {
      'default.nacl': primaryElements,
    }
  )
  const commonSrc = createMockNaclFileSource(commonElements, {
    'default.nacl': [onlyInCommon, splitObjCommon, missingFromPrimCommon, multiFileCommonDefault],
    'other.nacl': [multiFileCommonOther],
  })
  const secondarySources = {
    sec: createMockNaclFileSource(secondaryElements, { 'default.nacl': secondaryElements }),
  }

  it('should move add element which is only in common to all envs', async () => {
    const changes = await routeDemote(
      [onlyInCommon.elemID],
      primarySrc,
      commonSrc,
      secondarySources
    )
    expect(changes.commonSource).toHaveLength(1)
    expect(changes.primarySource).toHaveLength(1)
    expect(changes.secondarySources?.sec).toHaveLength(1)
    expect(changes.primarySource).toEqual(changes.secondarySources?.sec)
    expect(hasChanges(changes.primarySource || [], [
      { action: 'add', id: onlyInCommon.elemID },
    ])).toBeTruthy()
  })

  it('should create detailed changes for elements which are in common and have env fragments', async () => {
    const changes = await routeDemote(
      [splitObjEnv.elemID],
      primarySrc,
      commonSrc,
      secondarySources
    )
    expect(changes.commonSource).toHaveLength(1)
    expect(changes.primarySource).toHaveLength(5)
    expect(changes.secondarySources?.sec).toHaveLength(5)
    expect(changes.primarySource).toEqual(changes.secondarySources?.sec)
    expect(hasChanges(changes.primarySource || [], [
      { action: 'add', id: splitObjCommon.elemID.createNestedID('annotation', 'common') },
      { action: 'add', id: splitObjCommon.elemID.createNestedID('attr', 'split', 'common') },
      { action: 'add', id: splitObjCommon.elemID.createNestedID('attr', 'common') },
      { action: 'add', id: splitObjCommon.fields.commonField.elemID },
      { action: 'add', id: splitObjCommon.fields.splitField.elemID.createNestedID('common') },
    ])).toBeTruthy()
  })

  it('should create a different set of detailed changes accodrding the data in the actual env', async () => {
    const changes = await routeDemote(
      [missingFromPrimCommon.elemID],
      primarySrc,
      commonSrc,
      secondarySources
    )
    expect(changes.commonSource).toHaveLength(1)
    expect(changes.primarySource).toHaveLength(1)
    expect(changes.secondarySources?.sec).toHaveLength(1)
    expect(hasChanges(changes.primarySource || [], [
      { action: 'add', id: missingFromPrimCommon.elemID },
    ])).toBeTruthy()
    expect(hasChanges(changes.secondarySources?.sec ?? [], [
      { action: 'add', id: missingFromPrimCommon.elemID.createNestedID('common') },
    ])).toBeTruthy()
  })

  it('should wrap nested ids if the target env does not have the top level element', async () => {
    const changes = await routeDemote(
      [onlyInCommon.elemID.createNestedID('attr', 'str')],
      primarySrc,
      commonSrc,
      secondarySources
    )
    expect(changes.commonSource).toHaveLength(1)
    expect(changes.primarySource).toHaveLength(1)
    expect(changes.secondarySources?.sec).toHaveLength(1)
    expect(changes.primarySource).toEqual(changes.secondarySources?.sec)
    expect(hasChanges(changes.primarySource || [], [
      { action: 'add', id: onlyInCommon.elemID },
    ])).toBeTruthy()
  })

  it('should maitain file structure', async () => {
    const changes = await routeDemote(
      [multiFileCommon.elemID],
      primarySrc,
      commonSrc,
      secondarySources
    )
    expect(changes.commonSource).toHaveLength(1)
    expect(changes.primarySource).toHaveLength(2)
    expect(changes.secondarySources?.sec).toHaveLength(2)
    expect(changes.primarySource).toEqual(changes.secondarySources?.sec)
    expect(changes.primarySource).toEqual([
      { action: 'add', id: multiFileCommon.elemID, path: ['default'], data: { after: multiFileCommonDefault } },
      { action: 'add', id: multiFileCommon.elemID, path: ['other'], data: { after: multiFileCommonOther } },
    ])
  })
})

describe('copyTo', () => {
  const onlyInEnv1Obj = new ObjectType({
    elemID: new ElemID('salto', 'onlyInEnvObj'),
    fields: {
      str: {
        type: BuiltinTypes.STRING,
      },
      num: {
        type: BuiltinTypes.NUMBER,
      },
    },
    annotations: {
      str: 'STR',
    },
  })

  const splitObjEnv1 = new ObjectType({
    elemID: new ElemID('salto', 'splitObj'),
    fields: {
      e1Field: {
        type: BuiltinTypes.STRING,
        annotations: {
          here: {
            we: {
              go: 'again',
            },
          },
        },
      },
      splitField: {
        type: BuiltinTypes.STRING,
        annotations: {
          env: 'ENV',
        },
      },
    },
  })

  const splitObjEnv2 = new ObjectType({
    elemID: new ElemID('salto', 'splitObj'),
    fields: {
      e2Field: {
        type: BuiltinTypes.STRING,
        annotations: {
          here: {
            we: {
              go: 'again',
            },
          },
        },
      },
      splitField: {
        type: BuiltinTypes.STRING,
        annotations: {
          common: 'COMMON',
        },
      },
    },
  })

  const multiFileInstaceDefault = new InstanceElement('split', onlyInEnv1Obj, {
    default: 'DEFAULT',
  })
  const multiFileInstaceOther = new InstanceElement('split', onlyInEnv1Obj, {
    other: 'OTHER',
  })
  const multiFileInstace = new InstanceElement('split', onlyInEnv1Obj, {
    other: 'OTHER',
    default: 'DEFAULT',
  })

  const inSecObject = new ObjectType({
    elemID: new ElemID('salto', 'inSec'),
  })
  const primaryElements = [onlyInEnv1Obj, splitObjEnv1, multiFileInstace, inSecObject]
  const secondaryElements = [splitObjEnv2, inSecObject]

  const primarySrc = createMockNaclFileSource(
    primaryElements,
    {
      'default.nacl': [onlyInEnv1Obj, splitObjEnv1, multiFileInstaceDefault, inSecObject],
      'other.nacl': [multiFileInstaceOther],
    }
  )
  const secondarySources = {
    sec: createMockNaclFileSource(secondaryElements, { 'default.nacl': secondaryElements }),
  }

  it('should copy an entire element which does not exist in the target env', async () => {
    const changes = await routeCopyTo(
      [onlyInEnv1Obj.elemID],
      primarySrc,
      secondarySources
    )
    expect(changes.primarySource).toHaveLength(0)
    expect(changes.commonSource).toHaveLength(0)
    expect(changes.secondarySources?.sec).toHaveLength(1)
    const secondaryChange = changes.secondarySources?.sec && changes.secondarySources?.sec[0]
    expect(secondaryChange?.id).toEqual(onlyInEnv1Obj.elemID)
    expect(secondaryChange?.action).toEqual('add')
    expect(secondaryChange?.data).toEqual({ after: onlyInEnv1Obj })
  })

  it('should create detailed changes when an element fragment is present in the target env', async () => {
    const changes = await routeCopyTo(
      [splitObjEnv1.elemID],
      primarySrc,
      secondarySources
    )
    expect(changes.primarySource).toHaveLength(0)
    expect(changes.commonSource).toHaveLength(0)
    expect(changes.secondarySources?.sec).toHaveLength(4)
    expect(hasChanges(changes.secondarySources?.sec || [], [
      { action: 'remove', id: splitObjEnv2.fields.e2Field.elemID },
      { action: 'add', id: splitObjEnv1.fields.e1Field.elemID },
      { action: 'remove', id: splitObjEnv2.fields.splitField.elemID.createNestedID('common') },
      { action: 'add', id: splitObjEnv2.fields.splitField.elemID.createNestedID('env') },
    ])).toBeTruthy()
  })

  it('should wrap nested ids in an object when copying nested ids of an element'
      + ' with no fragment in the target env', async () => {
    const changes = await routeCopyTo(
      [
        onlyInEnv1Obj.fields.str.elemID,
        onlyInEnv1Obj.elemID.createNestedID('attr', 'str'),
      ],
      primarySrc,
      secondarySources
    )
    expect(changes.primarySource).toHaveLength(0)
    expect(changes.commonSource).toHaveLength(0)
    expect(changes.secondarySources?.sec).toHaveLength(1)
    expect(hasChanges(changes.secondarySources?.sec || [], [
      { action: 'add', id: onlyInEnv1Obj.elemID },
    ])).toBeTruthy()
  })

  it('should add nested fields for existing objects', async () => {
    const changes = await routeCopyTo(
      [splitObjEnv1.fields.e1Field.elemID],
      primarySrc,
      secondarySources
    )
    expect(changes.primarySource).toHaveLength(0)
    expect(changes.commonSource).toHaveLength(0)
    expect(changes.secondarySources?.sec).toHaveLength(1)
    expect(hasChanges(changes.secondarySources?.sec || [], [
      { action: 'add', id: splitObjEnv1.fields.e1Field.elemID },
    ])).toBeTruthy()
  })

  it('should maintain file structure when copying an element to target env', async () => {
    const changes = await routeCopyTo(
      [multiFileInstace.elemID],
      primarySrc,
      secondarySources
    )
    expect(changes.primarySource).toHaveLength(0)
    expect(changes.commonSource).toHaveLength(0)
    expect(changes.secondarySources?.sec).toHaveLength(2)
    expect(changes.secondarySources?.sec).toEqual([
      { action: 'add',
        id: multiFileInstace.elemID,
        path: ['default'],
        data: { after: multiFileInstaceDefault } },
      { action: 'add',
        id: multiFileInstace.elemID,
        path: ['other'],
        data: { after: multiFileInstaceOther } },
    ])
  })
})
