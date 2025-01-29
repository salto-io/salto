/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  ObjectType,
  ElemID,
  InstanceElement,
  ReferenceExpression,
  TemplateExpression,
  StaticFile,
} from '@salto-io/adapter-api'
import { createTemplateExpression } from '@salto-io/adapter-utils'
import { templateExpressionToStaticFile } from '../src/utils'
import { staticFileToTemplateExpression } from '../src/utils/template_static_file'

describe('template static file', () => {
  const article = new InstanceElement('article', new ObjectType({ elemID: new ElemID('zendesk', 'article') }), {
    id: 1,
  })
  const macro1 = new InstanceElement('macro1', new ObjectType({ elemID: new ElemID('zendesk', 'macro') }), {
    id: 2,
    actions: [{ value: 'non template', field: 'comment_value_html' }],
  })

  const singleLineTemplate = createTemplateExpression({
    parts: [
      '/hc/test/test/articles/',
      new ReferenceExpression(article.elemID),
      '/test hc/test/test/articles/',
      new ReferenceExpression(macro1.elemID),
      '/test',
    ],
  })

  const singleLineWithTemplateMarkerTemplate = createTemplateExpression({
    parts: [
      // eslint-disable-next-line no-template-curly-in-string
      '/hc/test ${ test-articles }',
      new ReferenceExpression(article.elemID),
      // eslint-disable-next-line no-template-curly-in-string
      '/test ${hc/test/test/articles/}',
      new ReferenceExpression(macro1.elemID),
      '/test}',
    ],
  })

  const singleLineRefAtBeginningAndEnd = createTemplateExpression({
    parts: [
      new ReferenceExpression(article.elemID),
      '/hc/test/test/articles/',
      new ReferenceExpression(article.elemID),
      '/test hc/test/test/articles/',
      new ReferenceExpression(macro1.elemID),
      '/test',
      new ReferenceExpression(macro1.elemID),
    ],
  })

  const singleLineSpecialChars = createTemplateExpression({
    parts: [
      '/hc/test/test/articles/',
      new ReferenceExpression(article.elemID),
      'He ${said, "Hello, World!"\tThis is a backslash: \\ 😄',
      new ReferenceExpression(macro1.elemID),
      '/test',
    ],
  })

  const multiLineTemplate = createTemplateExpression({
    parts: [
      '/hc/test/test/articles/',
      new ReferenceExpression(article.elemID),
      '\n/test hc/test/test/articles/',
      new ReferenceExpression(macro1.elemID),
      '/test',
    ],
  })

  const multiLineWithTemplateMarkerTemplate = createTemplateExpression({
    parts: [
      '/hc/test${/test/articles/',
      new ReferenceExpression(article.elemID),
      // eslint-disable-next-line no-template-curly-in-string
      '\n/test ${hc/test/test/articles/}',
      new ReferenceExpression(macro1.elemID),
      '/test}',
    ],
  })

  const multiLineRefAtBeginningAndEnd = createTemplateExpression({
    parts: [
      new ReferenceExpression(article.elemID),
      '/hc/test/test/articles/',
      new ReferenceExpression(article.elemID),
      '\n/test hc/test/test/articles/',
      new ReferenceExpression(macro1.elemID),
      '/test',
      new ReferenceExpression(macro1.elemID),
    ],
  })

  const multiLineSpecialChars = createTemplateExpression({
    parts: [
      '/hc/test/test/articles/',
      new ReferenceExpression(article.elemID),
      "\nHe ${said, ''' \"Hello, World!\"\tThis is a backslash: \\ 😄",
      new ReferenceExpression(macro1.elemID),
      '/test',
    ],
  })

  const multiLineEscapedMarker = createTemplateExpression({
    parts: [
      // eslint-disable-next-line no-template-curly-in-string
      '\\${ not.reference }\nbefore ref \\',
      new ReferenceExpression(article.elemID),
      '\n mid \\\\ and end \\',
    ],
  })

  describe('templateExpressionToStaticFile', () => {
    const testTemplateExpressionToStaticFile = async (
      templateExpression: TemplateExpression,
      stringResult: string,
    ): Promise<void> => {
      const staticContent = await templateExpressionToStaticFile(templateExpression, 'test').getContent()
      expect(staticContent).toBeDefined()
      if (staticContent === undefined) {
        return
      }
      expect(staticContent.toString()).toEqual(stringResult)
    }

    it('should create static files correctly for singleLineTemplate', async () => {
      await testTemplateExpressionToStaticFile(
        singleLineTemplate,
        // eslint-disable-next-line no-template-curly-in-string
        '/hc/test/test/articles/${ zendesk.article.instance.article }/test hc/test/test/articles/${ zendesk.macro.instance.macro1 }/test',
      )
    })
    it('should create static files correctly for singleLineWithTemplateMarkerTemplate', async () => {
      await testTemplateExpressionToStaticFile(
        singleLineWithTemplateMarkerTemplate,
        // eslint-disable-next-line no-template-curly-in-string
        '/hc/test \\${ test-articles }${ zendesk.article.instance.article }/test \\${hc/test/test/articles/}${ zendesk.macro.instance.macro1 }/test}',
      )
    })
    it('should create static files correctly for singleLineRefAtBeginningAndEnd', async () => {
      await testTemplateExpressionToStaticFile(
        singleLineRefAtBeginningAndEnd,
        // eslint-disable-next-line no-template-curly-in-string
        '${ zendesk.article.instance.article }/hc/test/test/articles/${ zendesk.article.instance.article }/test hc/test/test/articles/${ zendesk.macro.instance.macro1 }/test${ zendesk.macro.instance.macro1 }',
      )
    })
    it('should create static files correctly for singleLineSpecialChars', async () => {
      await testTemplateExpressionToStaticFile(
        singleLineSpecialChars,
        // eslint-disable-next-line no-template-curly-in-string
        '/hc/test/test/articles/${ zendesk.article.instance.article }He \\${said, "Hello, World!"\tThis is a backslash: \\ 😄${ zendesk.macro.instance.macro1 }/test',
      )
    })
    it('should create static files correctly for multiLineTemplate', async () => {
      await testTemplateExpressionToStaticFile(
        multiLineTemplate,
        // eslint-disable-next-line no-template-curly-in-string
        '/hc/test/test/articles/${ zendesk.article.instance.article }\n/test hc/test/test/articles/${ zendesk.macro.instance.macro1 }/test',
      )
    })
    it('should create static files correctly for multiLineWithTemplateMarkerTemplate', async () => {
      await testTemplateExpressionToStaticFile(
        multiLineWithTemplateMarkerTemplate,
        // eslint-disable-next-line no-template-curly-in-string
        '/hc/test\\${/test/articles/${ zendesk.article.instance.article }\n/test \\${hc/test/test/articles/}${ zendesk.macro.instance.macro1 }/test}',
      )
    })
    it('should create static files correctly for multiLineRefAtBeginningAndEnd', async () => {
      await testTemplateExpressionToStaticFile(
        multiLineRefAtBeginningAndEnd,
        // eslint-disable-next-line no-template-curly-in-string
        '${ zendesk.article.instance.article }/hc/test/test/articles/${ zendesk.article.instance.article }\n/test hc/test/test/articles/${ zendesk.macro.instance.macro1 }/test${ zendesk.macro.instance.macro1 }',
      )
    })
    it('should create static files correctly for multiLineSpecialChars', async () => {
      await testTemplateExpressionToStaticFile(
        multiLineSpecialChars,
        // eslint-disable-next-line no-template-curly-in-string
        "/hc/test/test/articles/${ zendesk.article.instance.article }\nHe \\${said, ''' \"Hello, World!\"\tThis is a backslash: \\ 😄${ zendesk.macro.instance.macro1 }/test",
      )
    })
    describe('with multi line template that contains backslashes before a reference', () => {
      let fileContent: string
      beforeEach(async () => {
        const staticContent = await templateExpressionToStaticFile(multiLineEscapedMarker, 'test').getContent()
        expect(staticContent).toBeDefined()
        if (staticContent === undefined) {
          return
        }
        fileContent = staticContent.toString()
      })
      it('should escape template marker and all leading backslashes before it', () => {
        // Original content starts with \${, we expect \ -> \\ and ${ -> \${, so the dumped content should start with \\\${
        expect(fileContent).toMatch(/\\\\\\\$\{ not.reference \}\nbefore ref.*/m)
      })
      it('should escape backslashes that appear before a reference', () => {
        // Original content has \ and then a reference, so we expect the dumped content to have \\${ ...
        expect(fileContent).toMatch(/.*before ref \\\\\$\{ zendesk.article.instance.article \}\n.*/m)
      })
      it('should not escape backslashes that are not before a reference', () => {
        expect(fileContent).toMatch(/.*\n mid \\\\ and end \\/m)
      })
      it('should escape template markers and backslashes only if they are before a template marker', async () => {
        // Putting it all together to have one test that verifies the full content
        expect(fileContent).toEqual(
          // eslint-disable-next-line no-template-curly-in-string
          '\\\\\\${ not.reference }\nbefore ref \\\\${ zendesk.article.instance.article }\n mid \\\\ and end \\',
        )
      })
    })
  })
  describe('staticFileToTemplateExpression', () => {
    const testStaticFileToTemplate = async (templateExpression: TemplateExpression): Promise<void> => {
      const staticfile = templateExpressionToStaticFile(templateExpression, 'test')
      const template = await staticFileToTemplateExpression(staticfile)
      expect(template).toEqual(templateExpression)
    }
    it('should create template correctly for singleLineTemplate', async () => {
      await testStaticFileToTemplate(singleLineTemplate)
    })
    it('should create template correctly for singleLineWithTemplateMarkerTemplate', async () => {
      await testStaticFileToTemplate(singleLineWithTemplateMarkerTemplate)
    })
    it('should create template correctly for singleLineRefAtBeginningAndEnd', async () => {
      await testStaticFileToTemplate(singleLineRefAtBeginningAndEnd)
    })
    it('should create template correctly for singleLineSpecialChars', async () => {
      await testStaticFileToTemplate(singleLineSpecialChars)
    })
    it('should create template correctly for multiLineTemplate', async () => {
      await testStaticFileToTemplate(multiLineTemplate)
    })
    it('should create template correctly for multiLineWithTemplateMarkerTemplate', async () => {
      await testStaticFileToTemplate(multiLineWithTemplateMarkerTemplate)
    })
    it('should create template correctly for multiLineRefAtBeginningAndEnd', async () => {
      await testStaticFileToTemplate(multiLineRefAtBeginningAndEnd)
    })
    it('should create template correctly for multiLineSpecialChars', async () => {
      await testStaticFileToTemplate(multiLineSpecialChars)
    })
    describe('with multi line template that contains backslashes before a reference', () => {
      it('should get the same expression after dumping to file and parsing back', async () => {
        await testStaticFileToTemplate(multiLineEscapedMarker)
      })
    })
    it('should return undefined if isTemplate is not true', async () => {
      const staticfile = new StaticFile({ isTemplate: false, filepath: 'test', content: Buffer.from('test') })
      const template = await staticFileToTemplateExpression(staticfile)
      expect(template).toBeUndefined()
    })
    it('should return undefined if content is undefined', async () => {
      const staticfile = new StaticFile({ isTemplate: true, filepath: 'test', hash: '1' })
      const template = await staticFileToTemplateExpression(staticfile)
      expect(template).toBeUndefined()
    })
    it('should not fail if there is no reference', async () => {
      const staticfile = new StaticFile({ isTemplate: true, filepath: 'test', content: Buffer.from('test') })
      const template = await staticFileToTemplateExpression(staticfile)
      expect(template).toEqual(createTemplateExpression({ parts: ['test'] }))
    })
  })
})
