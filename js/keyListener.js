const codeArea = document.getElementById('codeArea')
import codeSample from './code.js'

let code = codeSample[Math.floor(Math.random() * codeSample.length)]
let index = 0

function regexIndexOf(text, re, i) {
    var indexInSuffix = text.slice(i).search(re);
    return indexInSuffix < 0 ? indexInSuffix : indexInSuffix + i;
}

code = code.replace(/\n/g, '§')

document.addEventListener('keydown', (key) => {
    if (!code[index]) return
    
    if (code[index] === ' ') index = regexIndexOf(code, /[a-z0-9]/i, index)

    codeArea.innerHTML = code.slice(0, index).replace(/§/g, '<br>')
    index += 3
    
    document.body.scrollIntoView(false)
})