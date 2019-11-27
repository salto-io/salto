@{%
	const _  =  require('lodash')
	const lexer = require('./lexer').default
	const convertors = require('./convertors')
	// This file is auto-generated using nearly js (see build-parser in package.json)
	// Do not attempt to modifiy this file, modify hcl.ne instead. (unless you are in hcl.ne)
	// in that case - have a blast!
%}

# Pass your lexer object using the @lexer option:
@lexer lexer 
main -> _ (blockItem __:? {% d=> d[0] %}):* {% d=> _.flatten(d.filter(d => d)) %}
block -> blockLabels "{" _ (blockItem __ {% id %}):* "}" {% d => convertors.convertBlock(d[0], d[3], d[4]) %}
blockLabels -> %word __ (label __ {% d => d[0] %}):* {% d=> _.flatten([d[0], d[2]]) %}
label -> 
	  %word {% id %}
	| string {% id %}
blockItem -> 
	  block {% id %}
	| attr {% id %}
attr -> (%word {% id %} | string {% id %}) _ "=" _ value {% d => convertors.convertAttr(d[0], d[4]) %}
array -> "[" _ arrayItems "]" {% d => convertors.convertArray(d[0], d[2], d[3])%}
arrayItems ->
	  null {% () => [] %}
	| value _ ("," _ value _ {% d => d[2] %}):* {% d => _.flatten([d[0], d[2]]) %}
object -> %oCurly _ objectItems "}" {% d => convertors.convertObject(d[0], d[2], d[3]) %}
objectItems ->
	  null {% () => [] %}
	| attr _ (",":? _ attr _ {% d=> d[2] %}):* {% d => _.flatten([d[0], d[2]]) %}
value -> 
	  primitive {% id %}
	| array {% id %}
	| object {% id %}

primitive ->
	  %number {% d => convertors.convertNumber(d[0]) %}
	| string {% id %}
	| %boolean {% d => convertors.convertBoolean(d[0]) %}
	| %word {% d => convertors.convertReference(d[0]) %}
	| multilineString {% id %}

string -> "\"" (%content {% id %} |%reference {% id %}):* "\"" {% d => convertors.convertString(d[0], d[1], d[2]) %}
multilineString -> %mlStart (%content {% id %} | %reference {% id %}):* %mlEnd {% d => convertors.convertMultilineString(d[0], d[1], d[2]) %}
_ -> (%ws | %newline | %comment ):* {% () => null %}
__ -> (%ws| %newline | %comment ):+ {% () => null %}
