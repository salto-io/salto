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

const showdown = require('showdown')
const fs = require('fs')

showdown.extension('img_class', function() {
  return [
    {
      type: 'output',
      regex: '<img (.*)/>',
      replace: '<img class="salto_md_image" $1>'
    }
  ]
})

showdown.extension('internal_link', function() {
  return [
    {
      type: 'output',
      regex: /<a href="([\w\d\-\_]+)\.md">/g,
      replace: '<a href="#" onclick="return placeContent(\'$1.html\')">'
    },
    {
      type: 'output',
      regex: /<a href="([\w\d\-\_]+)\.md(#[\d\w\-\_]+)">/g,
      replace: '<a href="#$3" onclick="return placeContent(\'$1.html\')">'
    },
    {
      type: 'output',
      regex: /<a href="(#[\d\w\-\_]+)">/g,
      replace: '<a href="#$1">'
    }
  ]
})

const converter = new showdown.Converter({
  flavor: 'github',
  tables: true,
  parseImgDimensions: true,
  ghCodeBlocks: true,
  ghCompatibleHeaderId: true,
  encodeEmails: true,
  parseImgDimensions: true,
  extensions: ['img_class', 'internal_link']
});

if(process.argv.length !== 3) {
  console.error(`usage: ${process.argv[1]} <path_to_file.md>`)
  process.exit(1)
}

const content = fs.readFileSync(process.argv[2])
const html = converter.makeHtml(content.toString())
console.log(html)
