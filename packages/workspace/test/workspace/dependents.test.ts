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
import { createWorkspace } from '../common/workspace'
import { getDependents } from '../../src/workspace/dependents'

describe('dependents', () => {
  let workspace: Workspace

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

  describe.each([true, false] as const)(
    'getDependents (use old dependents calculation: %s)',
    useOldDependentsCalculation => {
      const getDependentIDs = async (elemID: ElemID): Promise<ElemID[]> => {
        const dependents = await getDependents(
          [elemID],
          await workspace.elements(),
          await workspace.getReferenceSourcesIndex(),
          id => workspace.getElementReferencedFiles(id),
          filename => workspace.getParsedNaclFile(filename),
        )
        return dependents.map(element => element.elemID)
      }

      beforeAll(async () => {
        process.env.SALTO_USE_OLD_DEPENDENTS_CALCULATION = useOldDependentsCalculation ? '1' : '0'
        workspace = await createWorkspace(mockDirStore(undefined, undefined, files))
      })

      afterAll(() => {
        delete process.env.SALTO_USE_OLD_DEPENDENTS_CALCULATION
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
    },
  )
})
