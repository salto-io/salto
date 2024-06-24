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
import { InstanceElement, ReferenceExpression, toChange } from '@salto-io/adapter-api'
import unreferencedFileAddition from '../../src/change_validators/unreferenced_file_addition'
import { suiteletType } from '../../src/autogen/types/standard_types/suitelet'
import { fileType } from '../../src/types/file_cabinet_types'
import { emailtemplateType } from '../../src/autogen/types/standard_types/emailtemplate'

describe('unreferenced file addition validator', () => {
  const { type: suitelet } = suiteletType()
  const { type: emailTemplate } = emailtemplateType()

  describe('script file', () => {
    const scriptFileNacl = new InstanceElement('scriptFileNacl', fileType())
    const scriptReferenceElement = new InstanceElement('scriptElemWithReference', suitelet, {
      defaultfunction: 'svda',
      scriptfile: new ReferenceExpression(scriptFileNacl.elemID),
    })
    const scriptNonReferenceElement = new InstanceElement('scriptElemWithoutReference', suitelet)

    it('Should not have a change error when adding a file and a script referencing it', async () => {
      const changeErrors = await unreferencedFileAddition([
        toChange({ after: scriptFileNacl }),
        toChange({ after: scriptReferenceElement }),
      ])
      expect(changeErrors).toHaveLength(0)
    })

    it('Should not have a change error when adding a file and changing a script to reference it', async () => {
      const changeErrors = await unreferencedFileAddition([
        toChange({ after: scriptFileNacl }),
        toChange({ before: scriptNonReferenceElement, after: scriptReferenceElement }),
      ])
      expect(changeErrors).toHaveLength(0)
    })

    it('Should not have a change error when not adding a File', async () => {
      const changeErrors = await unreferencedFileAddition([toChange({ after: scriptNonReferenceElement })])
      expect(changeErrors).toHaveLength(0)
    })

    it('Should not have a change error when modifying a file', async () => {
      const changeErrors = await unreferencedFileAddition([toChange({ before: scriptFileNacl, after: scriptFileNacl })])
      expect(changeErrors).toHaveLength(0)
    })

    it('Should have a change error when adding a file without changing (adding or modifying) any element to reference it', async () => {
      const changeErrors = await unreferencedFileAddition([
        toChange({ after: scriptFileNacl }),
        toChange({ after: scriptNonReferenceElement }),
        toChange({ before: scriptReferenceElement }),
      ])
      expect(changeErrors).toHaveLength(1)
      expect(changeErrors[0].severity).toEqual('Warning')
      expect(changeErrors[0].elemID).toBe(scriptFileNacl.elemID)
    })
  })

  describe('email template file', () => {
    const emailTemplateFileNacl = new InstanceElement('emailTemplateFileNacl', fileType())
    const emailTemplateReferenceElement = new InstanceElement('emailTemplateElemWithReference', emailTemplate, {
      addcompanyaddress: true,
      mediaitem: new ReferenceExpression(emailTemplateFileNacl.elemID),
    })
    const emailTemplateNonReferenceElement = new InstanceElement('emailTemplateElemWithoutReference', emailTemplate)

    it('Should not have a change error when adding a file and a template referencing it', async () => {
      const changeErrors = await unreferencedFileAddition([
        toChange({ after: emailTemplateFileNacl }),
        toChange({ after: emailTemplateReferenceElement }),
      ])
      expect(changeErrors).toHaveLength(0)
    })

    it('Should not have a change error when adding a file and changing a template to reference it', async () => {
      const changeErrors = await unreferencedFileAddition([
        toChange({ after: emailTemplateFileNacl }),
        toChange({ before: emailTemplateNonReferenceElement, after: emailTemplateReferenceElement }),
      ])
      expect(changeErrors).toHaveLength(0)
    })

    it('Should not have a change error when not adding an email template file', async () => {
      const changeErrors = await unreferencedFileAddition([toChange({ after: emailTemplateNonReferenceElement })])
      expect(changeErrors).toHaveLength(0)
    })

    it('Should not have a change error when modifying an email template file', async () => {
      const changeErrors = await unreferencedFileAddition([
        toChange({ before: emailTemplateFileNacl, after: emailTemplateFileNacl }),
      ])
      expect(changeErrors).toHaveLength(0)
    })

    it('Should have a change error when adding a file without changing (adding or modifying) any element to reference it', async () => {
      const changeErrors = await unreferencedFileAddition([
        toChange({ after: emailTemplateFileNacl }),
        toChange({ after: emailTemplateNonReferenceElement }),
        toChange({ before: emailTemplateReferenceElement }),
      ])
      expect(changeErrors).toHaveLength(1)
      expect(changeErrors[0].severity).toEqual('Warning')
      expect(changeErrors[0].elemID).toBe(emailTemplateFileNacl.elemID)
    })
  })
  describe('both type of files', () => {
    const emailTemplateFileNacl = new InstanceElement('emailTemplateFileNacl', fileType())
    const emailTemplateReferenceElement = new InstanceElement('emailTemplateElemWithReference', emailTemplate, {
      addcompanyaddress: true,
      mediaitem: new ReferenceExpression(emailTemplateFileNacl.elemID),
    })
    const emailTemplateNonReferenceElement = new InstanceElement('emailTemplateElemWithoutReference', emailTemplate)
    const scriptFileNacl = new InstanceElement('scriptFileNacl', fileType())
    const scriptReferenceElement = new InstanceElement('scriptElemWithReference', suitelet, {
      defaultfunction: 'svda',
      scriptfile: new ReferenceExpression(scriptFileNacl.elemID),
    })
    const scriptNonReferenceElement = new InstanceElement('scriptElemWithoutReference', suitelet)

    it('Should not have a change error when adding files and scripts/templates referencing them', async () => {
      const changeErrors = await unreferencedFileAddition([
        toChange({ after: emailTemplateFileNacl }),
        toChange({ after: emailTemplateReferenceElement }),
        toChange({ after: scriptFileNacl }),
        toChange({ after: scriptReferenceElement }),
      ])
      expect(changeErrors).toHaveLength(0)
    })

    it('Should not have a change error when adding files and changing scripts/templates to reference them', async () => {
      const changeErrors = await unreferencedFileAddition([
        toChange({ after: emailTemplateFileNacl }),
        toChange({ before: emailTemplateNonReferenceElement, after: emailTemplateReferenceElement }),
        toChange({ after: scriptFileNacl }),
        toChange({ before: scriptNonReferenceElement, after: scriptReferenceElement }),
      ])
      expect(changeErrors).toHaveLength(0)
    })

    it('Should not have a change error when not adding an email-template/script', async () => {
      const changeErrors = await unreferencedFileAddition([
        toChange({ after: emailTemplateNonReferenceElement }),
        toChange({ after: scriptNonReferenceElement }),
      ])
      expect(changeErrors).toHaveLength(0)
    })

    it('Should not have a change error when modifying an email-template/script', async () => {
      const changeErrors = await unreferencedFileAddition([
        toChange({ before: emailTemplateFileNacl, after: emailTemplateFileNacl }),
        toChange({ before: scriptFileNacl, after: scriptFileNacl }),
      ])
      expect(changeErrors).toHaveLength(0)
    })

    it('Should have a change error when adding files without changing (adding or modifying) any element to reference them', async () => {
      const changeErrors = await unreferencedFileAddition([
        toChange({ after: emailTemplateFileNacl }),
        toChange({ after: emailTemplateNonReferenceElement }),
        toChange({ before: emailTemplateReferenceElement }),
        toChange({ after: scriptFileNacl }),
        toChange({ after: scriptNonReferenceElement }),
        toChange({ before: scriptReferenceElement }),
      ])
      expect(changeErrors).toHaveLength(2)
      expect(changeErrors.map(changeError => changeError.severity)).toEqual(['Warning', 'Warning'])
      expect(changeErrors.map(changeError => changeError.elemID)).toEqual(
        expect.arrayContaining([emailTemplateFileNacl.elemID, scriptFileNacl.elemID]),
      )
    })
  })
})
