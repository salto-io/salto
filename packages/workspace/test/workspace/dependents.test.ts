/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { ElemID } from '@salto-io/adapter-api'
import { Workspace } from '../../src/workspace/workspace'
import { mockDirStore } from '../common/nacl_file_store'
import { createWorkspace, createState } from '../common/workspace'
import { getDependents } from '../../src/workspace/dependents'
import { naclFilesSource, NaclFilesSource } from '../../src/workspace/nacl_files'
import { mockStaticFilesSource, persistentMockCreateRemoteMap } from '../utils'
import { createMockNaclFileSource } from '../common/nacl_file_source'

describe('dependents', () => {
  let workspace: Workspace
  let naclFiles: NaclFilesSource

  const primFile = `
  type salto.prim is string {
  }
`

  const baseFile = `
  type salto.base {
    salto.prim str {
    }
  }
`

  const baseInstFile = `
  salto.base aBaseInst {
    str = "test"
  }
`

  const refBaseInstFile = `
  salto.base bBaseInst {
    str = salto.base.instance.aBaseInst.str
  }
`

  const anotherRefBaseInstFile = `
  salto.base cBaseInst {
    str = salto.base.instance.bBaseInst.str
  }
`

  const objFile = `
  type salto.obj {
    salto.base base {
    }
  }
`

  const objInstFile = `
  salto.obj objInst {
    base = {
      str = "test"
    }
  }
`

  const files = {
    primFile,
    baseFile,
    objFile,
    baseInstFile,
    refBaseInstFile,
    anotherRefBaseInstFile,
    objInstFile,
  }

  describe('getDependents', () => {
    const getDependentIDs = async (elemID: ElemID): Promise<ElemID[]> => {
      const dependents = await getDependents(
        [elemID],
        await workspace.elements(),
        await workspace.getReferenceSourcesIndex(),
      )
      return dependents.map(element => element.elemID)
    }

    beforeAll(async () => {
      naclFiles = await naclFilesSource(
        '',
        mockDirStore(undefined, undefined, files),
        mockStaticFilesSource(),
        persistentMockCreateRemoteMap(),
        true,
      )
      workspace = await createWorkspace(undefined, undefined, undefined, undefined, undefined, undefined, {
        '': {
          naclFiles,
        },
        default: {
          naclFiles: createMockNaclFileSource([]),
          state: createState([], true),
        },
      })
    })

    describe('type dependents', () => {
      let dependentIDs: ElemID[]

      beforeAll(async () => {
        dependentIDs = await getDependentIDs(new ElemID('salto', 'prim'))
      })
      it('should have the correct amount of dependents', () => {
        expect(dependentIDs).toHaveLength(6)
      })
      it('should have dependent type because of a field type', () => {
        expect(dependentIDs.find(id => id.getFullName() === 'salto.base')).toBeDefined()
      })
      it('should have dependent type because of a field type that is dependent too', () => {
        expect(dependentIDs.find(id => id.getFullName() === 'salto.obj')).toBeDefined()
      })
      it('should have dependent instances that their type is a dependent too', () => {
        expect(dependentIDs.find(id => id.getFullName() === 'salto.base.instance.aBaseInst')).toBeDefined()
        expect(dependentIDs.find(id => id.getFullName() === 'salto.base.instance.bBaseInst')).toBeDefined()
        expect(dependentIDs.find(id => id.getFullName() === 'salto.base.instance.cBaseInst')).toBeDefined()
        expect(dependentIDs.find(id => id.getFullName() === 'salto.obj.instance.objInst')).toBeDefined()
      })
    })

    describe('reference dependents', () => {
      let dependentIDs: ElemID[]

      beforeAll(async () => {
        dependentIDs = await getDependentIDs(new ElemID('salto', 'base', 'instance', 'aBaseInst'))
      })
      it('should have the correct amount of dependents', () => {
        expect(dependentIDs).toHaveLength(2)
      })
      it('should have a dependent that have a reference to the input ID', () => {
        expect(dependentIDs.find(id => id.getFullName() === 'salto.base.instance.bBaseInst')).toBeDefined()
      })
      it('should have a dependent that have a reference to another dependent ID', () => {
        expect(dependentIDs.find(id => id.getFullName() === 'salto.base.instance.cBaseInst')).toBeDefined()
      })
    })

    describe('when element is not referenced', () => {
      let dependentIDs: ElemID[]

      beforeAll(async () => {
        dependentIDs = await getDependentIDs(new ElemID('salto', 'obj', 'instance', 'objInst'))
      })
      it('should have no dependents', () => {
        expect(dependentIDs).toHaveLength(0)
      })
    })
  })
})
