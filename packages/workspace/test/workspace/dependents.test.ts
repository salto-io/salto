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
      const getDependentIDs = async (elemID: ElemID): Promise<string[]> => {
        const dependents = await getDependents(
          [elemID],
          await workspace.elements(),
          await workspace.getReferenceSourcesIndex(),
          id => workspace.getElementReferencedFiles(id),
          filename => workspace.getParsedNaclFile(filename),
        )
        return dependents.map(element => element.elemID.getFullName()).sort()
      }

      beforeAll(async () => {
        process.env.SALTO_USE_OLD_DEPENDENTS_CALCULATION = useOldDependentsCalculation ? '1' : '0'
        workspace = await createWorkspace(mockDirStore(undefined, undefined, files))
      })

      afterAll(() => {
        delete process.env.SALTO_USE_OLD_DEPENDENTS_CALCULATION
      })

      it('should calculate dependents correctly for type elemID', async () => {
        expect(await getDependentIDs(new ElemID('salto', 'prim'))).toEqual([
          'salto.base',
          'salto.base.instance.aBaseInst',
          'salto.base.instance.bBaseInst',
          'salto.base.instance.cBaseInst',
          'salto.obj',
          'salto.obj.instance.objInst',
        ])
      })

      it('should calculate dependents correctly for referenced instance elemID', async () => {
        expect(await getDependentIDs(new ElemID('salto', 'base', 'instance', 'aBaseInst'))).toEqual([
          'salto.base.instance.bBaseInst',
          'salto.base.instance.cBaseInst',
        ])
      })

      it('should have no dependents for non referenced instance elemID', async () => {
        expect(await getDependentIDs(new ElemID('salto', 'obj', 'instance', 'objInst'))).toEqual([])
      })
    },
  )
})
