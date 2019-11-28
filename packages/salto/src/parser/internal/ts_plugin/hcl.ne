@{%
	const _  =  require('lodash')
	const lexer = require('./lexer').default
	const converters = require('./converters')
	// This file is auto-generated using nearly js (see build-parser in package.json)
	// Do not attempt to modifiy this file, modify hcl.ne instead. (unless you are in hcl.ne)
	// in that case - have a blast!
%}

# Pass your lexer object using the @lexer option:
@lexer lexer 

main -> _nl (blockItem __nl:? {% d=> d[0] %}):* {% d=> _.flatten(d.filter(d => d)) %}
block -> blockLabels "{" _nl (blockItem __nl {% id %}):* "}" {% d => convertors.convertBlock(d[0], d[3], d[4]) %}
blockLabels -> %word __ (label __ {% d => d[0] %}):* {% d=> _.flatten([d[0], d[2]]) %}
label -> 
	  %word {% id %}
	| string {% id %}
blockItem -> 
	  block {% id %}
	| attr {% id %}
attr -> (%word {% id %} | string {% id %}) _ "=" _ value {% d => convertors.convertAttr(d[0], d[4]) %}
array -> "[" _nl arrayItems "]" {% d => convertors.convertArray(d[0], d[2], d[3])%}
arrayItems ->
	  null {% () => [] %}
	| value _nl ("," _nl value _nl {% d => d[2] %}):* {% d => _.flatten([d[0], d[2]]) %}
object -> %oCurly _nl objectItems "}" {% d => convertors.convertObject(d[0], d[2], d[3]) %}
objectItems ->
	  null {% () => [] %}
	| attr _nl (",":? _nl attr _nl {% d=> d[2] %}):* {% d => _.flatten([d[0], d[2]]) %}
value -> 
	  primitive {% id %}
	| array {% id %}
	| object {% id %}

primitive ->
	  %number {% d => converters.convertNumber(d[0]) %}
	| string {% id %}
	| %boolean {% d => converters.convertBoolean(d[0]) %}
	| %word {% d => converters.convertReference(d[0]) %}
	| multilineString {% id %}

string -> "\"" (%content {% id %} |%reference {% id %}):* "\"" {% d => convertors.convertString(d[0], d[1], d[2]) %}
multilineString -> %mlStart (%content {% id %} | %reference {% id %}):* %mlEnd {% d => convertors.convertMultilineString(d[0], d[1], d[2]) %}
_nl  -> (%ws | %newline | %comment ):* {% () => null %}
__nl -> (%ws | %newline | %comment ):+ {% () => null %}
_ -> (%ws | %comment ):* {% () => null %}
__ -> (%ws | %comment ):+ {% () => null %}
