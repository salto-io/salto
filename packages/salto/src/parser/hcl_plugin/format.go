package main

import (
	"bytes"

	"github.com/hashicorp/hcl2/hcl"
	"github.com/hashicorp/hcl2/hcl/hclsyntax"
	"github.com/hashicorp/hcl2/hclwrite"
)

var nilToken = &hclwrite.Token{
	Type:         hclsyntax.TokenNil,
	Bytes:        []byte{},
	SpacesBefore: 0,
}

var newLineToken = &hclwrite.Token{
	Type:  hclsyntax.TokenNewline,
	Bytes: []byte{'\n'},
}

//Checks if the token is the first token in in the line.
func isFirstInLine(tokens hclwrite.Tokens, pos int) bool {
	for i := pos - 1; i >= 0; i-- {
		cur := tokens[i]
		if cur.Type == hclsyntax.TokenNewline {
			return true
		}
		if cur.Type != hclsyntax.TokenIdent {
			return false
		}
	}
	return true
}

//Decides where a new newline token is needed.
//We only need to add new lines in attr values which are arrays or
//objects, if they are not already properly formated.
func newLineAfterToken(tokens hclwrite.Tokens, i int) bool {
	var before, after *hclwrite.Token
	subject := tokens[i]
	if i > 0 {
		before = tokens[i-1]
	} else {
		before = nilToken
	}
	if i+1 < len(tokens) {
		after = tokens[i+1]
	} else {
		after = nilToken
	}
	switch subject.Type {
	case hclsyntax.TokenOBrack:
		return after.Type != hclsyntax.TokenNewline && after.Type != hclsyntax.TokenCBrack
	case hclsyntax.TokenComma:
		return after.Type != hclsyntax.TokenNewline
	case hclsyntax.TokenOBrace:
		return after.Type != hclsyntax.TokenNewline && after.Type != hclsyntax.TokenCBrace
	}
	switch after.Type {
	case hclsyntax.TokenCBrack:
		return !isFirstInLine(tokens, i+1) && before.Type != hclsyntax.TokenOBrack
	case hclsyntax.TokenCBrace:
		return !isFirstInLine(tokens, i+1) && before.Type != hclsyntax.TokenOBrace
	}
	return false
}

func formatNewLines(tokens hclwrite.Tokens) hclwrite.Tokens {
	formattedTokens := make(hclwrite.Tokens, 0)
	for i, token := range tokens {
		formattedTokens = append(formattedTokens, token)
		if newLineAfterToken(tokens, i) {
			formattedTokens = append(formattedTokens, newLineToken)
		}
	}
	return formattedTokens
}

func createWriterTokens(nativeTokens hclsyntax.Tokens) hclwrite.Tokens {
	tokBuf := make(hclwrite.Tokens, len(nativeTokens))
	var lastByteOffset int
	for i := range nativeTokens {
		tokBuf[i] = &hclwrite.Token{
			Type:         nativeTokens[i].Type,
			Bytes:        nativeTokens[i].Bytes,
			SpacesBefore: nativeTokens[i].Range.Start.Byte - lastByteOffset,
		}

		lastByteOffset = nativeTokens[i].Range.End.Byte
	}
	return tokBuf
}

// The default HCL formatter does add newlines in lists an objects so we
// created this method to add new lines where desired, and then call the
// default formatter.
func format(src []byte) []byte {
	nativeTokens, _ := hclsyntax.LexConfig(src, "", hcl.Pos{Byte: 0, Line: 1, Column: 1})
	//Convert to writer tokens so we don't have to worry about source position information
	//for the new tokens we'll add
	writerTokens := createWriterTokens(nativeTokens)
	tokens := formatNewLines(writerTokens)
	//We need to convert to bytes before calling HCL's format since the public
	//format method accepts it as it inputs. There is a private format method
	//which receives writerTokens, but we can't use it because encapsulation :/
	buf := &bytes.Buffer{}
	tokens.WriteTo(buf)
	return hclwrite.Format(buf.Bytes())
}
