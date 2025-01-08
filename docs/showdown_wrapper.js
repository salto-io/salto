/*
* Copyright 2025 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/

const showdown = require('showdown')
const fs = require('fs')

showdown.extension('img_class', function() {
  return [
    {
      type: 'output',
      regex: '<img src="(.*)" (.*)/>',
      replace: '<img src="docs/$1" class="salto_md_image" $2>'
    }
  ]
})

showdown.extension('internal_link', function() {
  return [
    {
      type: 'output',
      regex: /<a href="([\w\d\-\_]+)\.md(#[\d\w\-\_]+)?">/g,
      replace: '<a href="$1_c.html$2">'
    }
  ]
})

const converter = new showdown.Converter({
  tables: true,
  ghCodeBlocks: true,
  ghCompatibleHeaderId: true,
  encodeEmails: true,
  parseImgDimensions: true,
  extensions: ['img_class', 'internal_link']
})

converter.setFlavor('github')

if(process.argv.length !== 3) {
  console.error(`usage: ${process.argv[1]} <path_to_file.md>`)
  process.exit(1)
}

const content = fs.readFileSync(process.argv[2])
const html = converter.makeHtml(content.toString())
console.log(html)
